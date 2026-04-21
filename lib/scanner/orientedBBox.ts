import { Point } from './types';

export type OrientedRect = {
  lengthMm: number;
  widthMm: number;
  angleRad: number;
};

const ZERO: OrientedRect = { lengthMm: 0, widthMm: 0, angleRad: 0 };

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(points: Point[]): Point[] {
  if (points.length <= 1) return points.slice();
  const pts = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function rectForEdge(hull: Point[], a: Point, b: Point): { length: number; width: number; angle: number; area: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of hull) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    return { length: Math.max(w, h), width: Math.min(w, h), angle: 0, area: w * h };
  }
  const ux = dx / len;
  const uy = dy / len;
  const vx = -uy;
  const vy = ux;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const p of hull) {
    const pu = p.x * ux + p.y * uy;
    const pv = p.x * vx + p.y * vy;
    if (pu < minU) minU = pu;
    if (pu > maxU) maxU = pu;
    if (pv < minV) minV = pv;
    if (pv > maxV) maxV = pv;
  }
  const sideU = maxU - minU;
  const sideV = maxV - minV;
  const length = Math.max(sideU, sideV);
  const width = Math.min(sideU, sideV);
  const angle = sideU >= sideV ? Math.atan2(uy, ux) : Math.atan2(vy, vx);
  return { length, width, angle, area: sideU * sideV };
}

export function minAreaRect(points: Point[]): OrientedRect {
  if (!points || points.length < 2) return { ...ZERO };

  const hull = convexHull(points);
  if (hull.length < 2) return { ...ZERO };

  if (hull.length === 2) {
    const a = hull[0];
    const b = hull[1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    return {
      lengthMm: length,
      widthMm: 0,
      angleRad: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  let best = rectForEdge(hull, hull[0], hull[1]);
  for (let i = 1; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const r = rectForEdge(hull, a, b);
    if (r.area < best.area) best = r;
  }

  return {
    lengthMm: best.length,
    widthMm: best.width,
    angleRad: best.angle,
  };
}
