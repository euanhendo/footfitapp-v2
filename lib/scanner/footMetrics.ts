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

  let maxPerp = 0;
  for (const p of foot) {
    const vx = p.x - heelEdge.a.x;
    const vy = p.y - heelEdge.a.y;
    const perp = vx * heelEdge.nx + vy * heelEdge.ny;
    if (perp > maxPerp) maxPerp = perp;
  }
  // Width across the foot's own axis (oriented box short side), so a foot
  // angled on the paper doesn't leak length into width; length gets the
  // matching cosine correction for the same angle
  const footBox = minAreaRect(foot);
  const axisDotNormal = Math.abs(
    Math.cos(footBox.angleRad) * heelEdge.nx + Math.sin(footBox.angleRad) * heelEdge.ny,
  );
  const lengthPx = Math.max(0, maxPerp) / Math.max(axisDotNormal, 0.7);
  const widthPx = footBox.widthMm;
  if (lengthPx <= 0 || widthPx <= 0) {
    return { lengthMm: 0, widthMm: 0, confidence: 0 };
  }

  const ref = getReferenceObject(referenceKind);
  const longAvgPx = (longEdges[0].length + longEdges[1].length) / 2;
  const shortAvgPx = (shortEdges[0].length + shortEdges[1].length) / 2;
  const pxPerMm = (longAvgPx / ref.longMm + shortAvgPx / ref.shortMm) / 2;
  if (pxPerMm <= 0) return { lengthMm: 0, widthMm: 0, confidence: 0 };

  const lengthMm = lengthPx / pxPerMm;
  const widthMm = widthPx / pxPerMm;

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

function scoreConfidence(fillRatio: number, aspect: number): number {
  const fill = rangeScore(fillRatio, EXPECTED_FILL_MIN, EXPECTED_FILL_MAX);
  const ratio = rangeScore(aspect, EXPECTED_ASPECT_MIN, EXPECTED_ASPECT_MAX);
  return Math.max(0, Math.min(1, Math.sqrt(fill * ratio)));
}

function rangeScore(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1;
  const centre = (min + max) / 2;
  const halfRange = (max - min) / 2;
  const distance = Math.abs(value - centre) - halfRange;
  return Math.max(0, 1 - distance / halfRange);
}
