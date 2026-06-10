import { minAreaRect } from './orientedBBox';
import { DetectedContours, Point, ReferenceKind } from './types';

const MIN_RELATIVE_AREA = 0.001;

type ContourStats = {
  contour: Point[];
  area: number;
  aspect: number;
  fillRatio: number;
};

function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function centroid(points: Point[]): Point {
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function referenceAspect(kind: ReferenceKind): number {
  switch (kind) {
    case 'a4':
      return 297 / 210;
    case 'card':
      return 85.6 / 53.98;
    case 'coin_gbp_1':
      return 1;
  }
}

function statsFor(contour: Point[]): ContourStats | null {
  if (!contour || contour.length < 3) return null;
  const rect = minAreaRect(contour);
  if (rect.lengthMm === 0) return null;
  const area = polygonArea(contour);
  if (area <= 0) return null;
  const rectArea = rect.lengthMm * Math.max(rect.widthMm, 1e-6);
  return {
    contour,
    area,
    aspect: rect.lengthMm / Math.max(rect.widthMm, 1e-6),
    fillRatio: Math.min(1, area / rectArea),
  };
}

// Bounds relative to the quad area: below = speck noise, above = the paper
// outline itself (the foot covers roughly a third of an A4)
const MIN_QUAD_AREA_RATIO = 0.001;
const MAX_QUAD_AREA_RATIO = 0.7;

export function pickFootFromQuad(
  quad: Point[],
  contours: Point[][],
): DetectedContours | null {
  if (!quad || quad.length !== 4) return null;
  const quadArea = polygonArea(quad);
  if (quadArea <= 0) return null;
  const inside = contours
    .map(statsFor)
    .filter((s): s is ContourStats => s !== null)
    .filter((s) => s.area >= quadArea * MIN_QUAD_AREA_RATIO)
    .filter((s) => s.area <= quadArea * MAX_QUAD_AREA_RATIO)
    .filter((s) => pointInPolygon(centroid(s.contour), quad));
  if (inside.length === 0) return null;
  const foot = inside.flatMap((s) => s.contour);
  return { reference: quad, foot };
}

export type QuadCandidate = {
  quad: Point[];
  brightness: number; // mean luminance inside the quad, [0,1]
};

const A4_SHORT_OVER_LONG = 210 / 297;

// White paper should out-score dark floor/wall tiles even when a tile's
// aspect happens to be closer to A4's
export function pickReferenceQuad(candidates: QuadCandidate[]): Point[] | null {
  let best: { quad: Point[]; score: number } | null = null;
  for (const c of candidates) {
    if (!c.quad || c.quad.length !== 4) continue;
    const rect = minAreaRect(c.quad);
    if (rect.lengthMm <= 0) continue;
    const aspect = rect.widthMm / rect.lengthMm;
    const score = Math.max(0, c.brightness) / (1 + 8 * Math.abs(aspect - A4_SHORT_OVER_LONG));
    if (!best || score > best.score) {
      best = { quad: c.quad, score };
    }
  }
  return best ? best.quad : null;
}

export function pickContours(
  contours: Point[][],
  referenceKind: ReferenceKind,
): DetectedContours | null {
  const stats = contours
    .map(statsFor)
    .filter((s): s is ContourStats => s !== null)
    .filter((s) => s.area >= MIN_RELATIVE_AREA);
  if (stats.length < 2) return null;

  const targetAspect = referenceAspect(referenceKind);
  const scored = stats.map((s) => ({
    s,
    score: s.fillRatio / (1 + 5 * Math.abs(s.aspect - targetAspect)),
  }));
  scored.sort((a, b) => b.score - a.score);
  const reference = scored[0].s;

  const referenceCorners = minAreaRect(reference.contour).corners;
  const remaining = stats
    .filter((s) => s !== reference)
    .filter((s) => pointInPolygon(centroid(s.contour), referenceCorners));
  if (remaining.length === 0) return null;
  const foot = remaining.flatMap((s) => s.contour);

  return { reference: reference.contour, foot };
}

export type CandidateDebug = {
  points: number;
  area: number;
  aspect: number;
  fillRatio: number;
  score: number;
};

export function debugTopCandidates(
  contours: Point[][],
  referenceKind: ReferenceKind,
  limit = 5,
): CandidateDebug[] {
  const stats = contours
    .map(statsFor)
    .filter((s): s is ContourStats => s !== null)
    .filter((s) => s.area >= MIN_RELATIVE_AREA);
  const targetAspect = referenceAspect(referenceKind);
  return stats
    .map((s) => ({
      points: s.contour.length,
      area: s.area,
      aspect: s.aspect,
      fillRatio: s.fillRatio,
      score: s.fillRatio / (1 + 5 * Math.abs(s.aspect - targetAspect)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function debugTopByPoints(contours: Point[][], limit = 5): CandidateDebug[] {
  return contours
    .filter((c) => c.length > 0)
    .map((c) => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of c) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const w = Math.max(maxX - minX, 1e-6);
      const h = Math.max(maxY - minY, 1e-6);
      const aspect = Math.max(w, h) / Math.max(Math.min(w, h), 1e-6);
      const area = polygonArea(c);
      return {
        points: c.length,
        area,
        aspect,
        fillRatio: area / (w * h),
        score: 0,
      };
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}
