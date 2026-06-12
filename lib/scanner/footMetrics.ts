import { applyHomography, solveHomography } from './homography';
import { minAreaRect } from './orientedBBox';
import { getReferenceObject } from './referenceObjects';
import { BBox, DetectedContours, FootMetrics, Mask, Point, ReferenceKind } from './types';

const EXPECTED_ASPECT_MIN = 2.0;
const EXPECTED_ASPECT_MAX = 3.8;
const EXPECTED_FILL_MIN = 0.45;
const EXPECTED_FILL_MAX = 0.85;

export function maskBoundingBox(mask: Mask): BBox | null {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[y * mask.width + x]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export function maskPixelCount(mask: Mask): number {
  let count = 0;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i]) count++;
  }
  return count;
}

export function computeFootMetrics(footMask: Mask, pxPerMm: number): FootMetrics {
  if (pxPerMm <= 0) {
    throw new Error('pxPerMm must be positive');
  }
  const bbox = maskBoundingBox(footMask);
  if (!bbox) {
    return { lengthMm: 0, widthMm: 0, confidence: 0 };
  }
  const longPx = Math.max(bbox.width, bbox.height);
  const shortPx = Math.min(bbox.width, bbox.height);
  const lengthMm = longPx / pxPerMm;
  const widthMm = shortPx / pxPerMm;

  const fillRatio = maskPixelCount(footMask) / (bbox.width * bbox.height);
  const aspect = lengthMm / Math.max(widthMm, 1);
  const confidence = scoreConfidence(fillRatio, aspect);

  return { lengthMm, widthMm, confidence };
}

export function computeFootMetricsFromContour(contour: Point[]): FootMetrics {
  if (!contour || contour.length < 3) {
    return { lengthMm: 0, widthMm: 0, confidence: 0 };
  }
  const rect = minAreaRect(contour);
  if (rect.lengthMm === 0) {
    return { lengthMm: 0, widthMm: 0, confidence: 0 };
  }
  const aspect = rect.lengthMm / Math.max(rect.widthMm, 1);
  const confidence = Math.max(0, Math.min(1, rangeScore(aspect, EXPECTED_ASPECT_MIN, EXPECTED_ASPECT_MAX)));
  return {
    lengthMm: rect.lengthMm,
    widthMm: rect.widthMm,
    confidence,
  };
}

export function measureFromContours(
  detected: DetectedContours,
  referenceKind: ReferenceKind,
): FootMetrics {
  const ref = getReferenceObject(referenceKind);
  const refRect = minAreaRect(detected.reference);
  if (refRect.lengthMm <= 0 || refRect.widthMm <= 0) {
    return { lengthMm: 0, widthMm: 0, confidence: 0 };
  }
  const normPerMm = (refRect.lengthMm / ref.longMm + refRect.widthMm / ref.shortMm) / 2;
  if (normPerMm <= 0) {
    return { lengthMm: 0, widthMm: 0, confidence: 0 };
  }
  const footRect = minAreaRect(detected.foot);
  if (footRect.lengthMm <= 0) {
    return { lengthMm: 0, widthMm: 0, confidence: 0 };
  }
  const lengthMm = footRect.lengthMm / normPerMm;
  const widthMm = footRect.widthMm / normPerMm;

  const detectedRatio = refRect.widthMm / refRect.lengthMm;
  const expectedRatio = ref.shortMm / ref.longMm;
  const calibration = Math.max(0, 1 - Math.abs(detectedRatio - expectedRatio) / expectedRatio);
  const aspect = lengthMm / Math.max(widthMm, 1);
  const footScore = rangeScore(aspect, EXPECTED_ASPECT_MIN, EXPECTED_ASPECT_MAX);
  const confidence = Math.max(0, Math.min(1, calibration * footScore));

  return { lengthMm, widthMm, confidence };
}

type QuadEdge = {
  a: Point;
  b: Point;
  length: number;
  dx: number;
  dy: number;
  nx: number;
  ny: number;
};

function buildEdges(quad: Point[]): QuadEdge[] | null {
  const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4;
  const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4;
  const edges: QuadEdge[] = [];
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len = Math.hypot(vx, vy);
    if (len === 0) return null;
    const dx = vx / len;
    const dy = vy / len;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    let nx = -dy;
    let ny = dx;
    if (nx * (cx - mx) + ny * (cy - my) < 0) {
      nx = -nx;
      ny = -ny;
    }
    edges.push({ a, b, length: len, dx, dy, nx, ny });
  }
  return edges;
}

function countNearEdge(edge: QuadEdge, points: Point[]): number {
  const threshold = edge.length * 0.08;
  let count = 0;
  for (const p of points) {
    const vx = p.x - edge.a.x;
    const vy = p.y - edge.a.y;
    const perp = Math.abs(vx * edge.nx + vy * edge.ny);
    if (perp <= threshold) count++;
  }
  return count;
}

function voteHeelEdge(edges: QuadEdge[], foot: Point[]) {
  const sorted = [...edges].sort((l, r) => l.length - r.length);
  const shortEdges = [sorted[0], sorted[1]];
  const longEdges = [sorted[2], sorted[3]];
  const votesA = countNearEdge(shortEdges[0], foot);
  const votesB = countNearEdge(shortEdges[1], foot);
  return {
    heelEdge: votesA >= votesB ? shortEdges[0] : shortEdges[1],
    heelVotes: Math.max(votesA, votesB),
    toeVotes: Math.min(votesA, votesB),
    shortEdges,
    longEdges,
  };
}

export function findHeelEdge(quad: Point[], foot: Point[]): { a: Point; b: Point } | null {
  if (!quad || quad.length !== 4 || !foot || foot.length === 0) return null;
  const edges = buildEdges(quad);
  if (!edges) return null;
  const { heelEdge } = voteHeelEdge(edges, foot);
  return { a: heelEdge.a, b: heelEdge.b };
}

// Anatomical width band: a real capture's contour includes the ankle and
// lower leg seen from above, and minAreaRect's short side inflates with that
// lobe (tape 110 mm read as 130 mm, 2026-06-12). The foot's true widest
// cross-section — inside ball to outside ball — sits in the front half, where
// leg contamination can't reach. So: slice the contour perpendicular to the
// heel-edge normal (paper +y), keep only slices 30–95% of the way to the toe,
// and take the widest left-edge-to-right-edge span. Yaw is corrected from the
// drift of the slice midlines, not from minAreaRect, so a contaminated rect
// can't poison the width.
const WIDTH_BAND_START = 0.3;
const WIDTH_BAND_END = 0.95;
const WIDTH_BAND_BINS = 24;
const WIDTH_BAND_MIN_POINTS_PER_BIN = 2;
const WIDTH_BAND_MAX_YAW_SLOPE = 0.47; // tan ~25°; guide-locked feet sit well under this

export function widthAcrossFootBand(footMm: Point[], toeDistanceMm: number): number {
  if (!footMm || footMm.length < 3 || toeDistanceMm <= 0) return 0;

  const minX = new Array<number>(WIDTH_BAND_BINS).fill(Infinity);
  const maxX = new Array<number>(WIDTH_BAND_BINS).fill(-Infinity);
  const counts = new Array<number>(WIDTH_BAND_BINS).fill(0);
  const bandSpan = WIDTH_BAND_END - WIDTH_BAND_START;

  for (const p of footMm) {
    const t = p.y / toeDistanceMm;
    if (t < WIDTH_BAND_START || t > WIDTH_BAND_END) continue;
    const bin = Math.min(
      WIDTH_BAND_BINS - 1,
      Math.floor(((t - WIDTH_BAND_START) / bandSpan) * WIDTH_BAND_BINS),
    );
    if (p.x < minX[bin]) minX[bin] = p.x;
    if (p.x > maxX[bin]) maxX[bin] = p.x;
    counts[bin]++;
  }

  // Widest qualifying slice, plus a least-squares fit of slice midlines to
  // estimate foot yaw — a yawed foot's horizontal slices read wide by 1/cos.
  let widest = 0;
  let n = 0;
  let sumY = 0;
  let sumMid = 0;
  let sumYY = 0;
  let sumYMid = 0;
  for (let i = 0; i < WIDTH_BAND_BINS; i++) {
    if (counts[i] < WIDTH_BAND_MIN_POINTS_PER_BIN) continue;
    const sliceWidth = maxX[i] - minX[i];
    if (sliceWidth > widest) widest = sliceWidth;
    const yCentre = (WIDTH_BAND_START + ((i + 0.5) / WIDTH_BAND_BINS) * bandSpan) * toeDistanceMm;
    const mid = (minX[i] + maxX[i]) / 2;
    n++;
    sumY += yCentre;
    sumMid += mid;
    sumYY += yCentre * yCentre;
    sumYMid += yCentre * mid;
  }
  if (widest <= 0) return 0;

  let yawSlope = 0;
  const denom = n * sumYY - sumY * sumY;
  if (n >= 3 && Math.abs(denom) > 1e-9) {
    yawSlope = (n * sumYMid - sumY * sumMid) / denom;
    yawSlope = Math.max(-WIDTH_BAND_MAX_YAW_SLOPE, Math.min(WIDTH_BAND_MAX_YAW_SLOPE, yawSlope));
  }
  return widest / Math.sqrt(1 + yawSlope * yawSlope);
}

export function measureFromQuadAndFoot(
  quad: Point[],
  foot: Point[],
  referenceKind: ReferenceKind,
): FootMetrics {
  if (!quad || quad.length !== 4 || !foot || foot.length === 0) {
    return { lengthMm: 0, widthMm: 0, confidence: 0 };
  }
  const edges = buildEdges(quad);
  if (!edges) return { lengthMm: 0, widthMm: 0, confidence: 0 };

  const { heelEdge, heelVotes, toeVotes, shortEdges, longEdges } = voteHeelEdge(edges, foot);

  // Rectify: map the quad corners onto the paper's true mm rectangle with the
  // heel edge at y = 0, then measure the foot in paper coordinates. A tilted
  // camera compresses the wall end of the photo, so any single px-per-mm scale
  // systematically under-reads length — the homography removes that exactly.
  const ref = getReferenceObject(referenceKind);
  const heelIndex = edges.indexOf(heelEdge);
  const srcCorners = [
    heelEdge.a,
    heelEdge.b,
    quad[(heelIndex + 2) % 4],
    quad[(heelIndex + 3) % 4],
  ];
  const dstCorners = [
    { x: 0, y: 0 },
    { x: ref.shortMm, y: 0 },
    { x: ref.shortMm, y: ref.longMm },
    { x: 0, y: ref.longMm },
  ];
  const h = solveHomography(srcCorners, dstCorners);
  if (!h) return { lengthMm: 0, widthMm: 0, confidence: 0 };
  const footMm = foot.map((p) => applyHomography(h, p));

  let maxPerpMm = 0;
  for (const p of footMm) {
    if (p.y > maxPerpMm) maxPerpMm = p.y;
  }
  const footBox = minAreaRect(footMm);
  const axisDotNormal = Math.abs(Math.sin(footBox.angleRad));
  const lengthMm = maxPerpMm / Math.max(axisDotNormal, 0.7);
  // Width from the anatomical band, not the oriented box: the box's short
  // side inflates when the contour includes the ankle/leg. Sparse synthetic
  // contours (tests) can miss every band bin — fall back to the box there.
  const bandWidthMm = widthAcrossFootBand(footMm, maxPerpMm);
  const widthMm = bandWidthMm > 0 ? bandWidthMm : footBox.widthMm;
  if (lengthMm <= 0 || widthMm <= 0) {
    return { lengthMm: 0, widthMm: 0, confidence: 0 };
  }

  const longAvgPx = (longEdges[0].length + longEdges[1].length) / 2;
  const shortAvgPx = (shortEdges[0].length + shortEdges[1].length) / 2;

  const detectedRatio = shortAvgPx / longAvgPx;
  const expectedRatio = ref.shortMm / ref.longMm;
  const calibration = Math.max(0, 1 - Math.abs(detectedRatio - expectedRatio) / expectedRatio);
  const aspect = lengthMm / Math.max(widthMm, 1);
  const footScore = rangeScore(aspect, EXPECTED_ASPECT_MIN, EXPECTED_ASPECT_MAX);
  const denom = heelVotes + toeVotes;
  const heelMargin = denom > 0 ? Math.max(0, Math.min(1, (heelVotes - toeVotes) / denom)) : 0;
  const confidence = Math.max(0, Math.min(1, calibration * footScore * heelMargin));

  return { lengthMm, widthMm, confidence };
}

// The original −12 mm bias was fitted against shadow-inflated outlines. With
// the redness-map contour pass + confidence gating, a trusted capture hugs the
// skin and reads true width within ~1 mm (raw 109.3 vs caliper 110, n=1,
// 2026-06-11), so no correction. Kept as the re-fit hook for more feet.
export const WIDTH_SILHOUETTE_BIAS_MM = 0;

export function calibrateFootMetrics(metrics: FootMetrics): FootMetrics {
  if (metrics.lengthMm <= 0 || metrics.widthMm <= 0) return metrics;
  return {
    ...metrics,
    widthMm: Math.max(0, metrics.widthMm - WIDTH_SILHOUETTE_BIAS_MM),
  };
}

function scoreConfidence(fillRatio: number, aspect: number): number {
  const fill = rangeScore(fillRatio, EXPECTED_FILL_MIN, EXPECTED_FILL_MAX);
  const ratio = rangeScore(aspect, EXPECTED_ASPECT_MIN, EXPECTED_ASPECT_MAX);
  return Math.max(0, Math.min(1, Math.sqrt(fill * ratio)));
}

export function rangeScore(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1;
  const centre = (min + max) / 2;
  const halfRange = (max - min) / 2;
  const distance = Math.abs(value - centre) - halfRange;
  return Math.max(0, 1 - distance / halfRange);
}
