import { minAreaRect } from '../../scanner/orientedBBox';
import { Point } from '../../scanner/types';

function rotate(p: Point, angleRad: number): Point {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

function sortCorners(corners: Point[]): Point[] {
  return corners.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
}

function expectCornersClose(actual: Point[], expected: Point[], decimals: number): void {
  const a = sortCorners(actual);
  const e = sortCorners(expected);
  expect(a.length).toBe(e.length);
  for (let i = 0; i < a.length; i++) {
    expect(a[i].x).toBeCloseTo(e[i].x, decimals);
    expect(a[i].y).toBeCloseTo(e[i].y, decimals);
  }
}

describe('minAreaRect', () => {
  it('returns zeroed result for an empty contour', () => {
    const r = minAreaRect([]);
    expect(r.lengthMm).toBe(0);
    expect(r.widthMm).toBe(0);
    expect(r.angleRad).toBe(0);
    expect(r.corners).toHaveLength(4);
  });

  it('returns zeroed result for a single point', () => {
    const r = minAreaRect([{ x: 1, y: 1 }]);
    expect(r.lengthMm).toBe(0);
    expect(r.widthMm).toBe(0);
    expect(r.angleRad).toBe(0);
    expect(r.corners).toHaveLength(4);
  });

  it('measures an axis-aligned rectangle with length on the long axis', () => {
    const corners: Point[] = [
      { x: 0, y: 0 },
      { x: 260, y: 0 },
      { x: 260, y: 95 },
      { x: 0, y: 95 },
    ];
    const r = minAreaRect(corners);
    expect(r.lengthMm).toBeCloseTo(260, 5);
    expect(r.widthMm).toBeCloseTo(95, 5);
  });

  it('measures a 45-degree rotated rectangle correctly', () => {
    const base: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ];
    const rotated = base.map((p) => rotate(p, Math.PI / 4));
    const r = minAreaRect(rotated);
    expect(r.lengthMm).toBeCloseTo(100, 3);
    expect(r.widthMm).toBeCloseTo(50, 3);
  });

  it('length is always >= width regardless of input orientation', () => {
    const tall: Point[] = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 200 },
      { x: 0, y: 200 },
    ];
    const r = minAreaRect(tall);
    expect(r.lengthMm).toBeCloseTo(200, 5);
    expect(r.widthMm).toBeCloseTo(30, 5);
    expect(r.lengthMm).toBeGreaterThanOrEqual(r.widthMm);
  });

  it('handles a dense polygon sampled around a rotated rectangle', () => {
    const base: Point[] = [];
    for (let t = 0; t <= 200; t += 2) base.push({ x: t, y: 0 });
    for (let t = 0; t <= 80; t += 2) base.push({ x: 200, y: t });
    for (let t = 200; t >= 0; t -= 2) base.push({ x: t, y: 80 });
    for (let t = 80; t >= 0; t -= 2) base.push({ x: 0, y: t });
    const angle = Math.PI / 6;
    const rotated = base.map((p) => rotate(p, angle));
    const r = minAreaRect(rotated);
    expect(r.lengthMm).toBeCloseTo(200, 1);
    expect(r.widthMm).toBeCloseTo(80, 1);
  });

  it('handles collinear points without throwing', () => {
    const line: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    const r = minAreaRect(line);
    expect(r.lengthMm).toBeCloseTo(20, 5);
    expect(r.widthMm).toBeCloseTo(0, 5);
  });

  it('returns four corners matching an axis-aligned rectangle', () => {
    const corners: Point[] = [
      { x: 0, y: 0 },
      { x: 260, y: 0 },
      { x: 260, y: 95 },
      { x: 0, y: 95 },
    ];
    const r = minAreaRect(corners);
    expectCornersClose(r.corners, corners, 3);
  });

  it('returns four corners matching a 45-degree rotated rectangle', () => {
    const base: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ];
    const rotated = base.map((p) => rotate(p, Math.PI / 4));
    const r = minAreaRect(rotated);
    expectCornersClose(r.corners, rotated, 3);
  });

  it('returned corners form a rectangle with the reported length and width', () => {
    const base: Point[] = [
      { x: 0, y: 0 },
      { x: 150, y: 0 },
      { x: 150, y: 70 },
      { x: 0, y: 70 },
    ];
    const rotated = base.map((p) => rotate(p, Math.PI / 3));
    const r = minAreaRect(rotated);
    const side01 = Math.hypot(r.corners[1].x - r.corners[0].x, r.corners[1].y - r.corners[0].y);
    const side12 = Math.hypot(r.corners[2].x - r.corners[1].x, r.corners[2].y - r.corners[1].y);
    const long = Math.max(side01, side12);
    const short = Math.min(side01, side12);
    expect(long).toBeCloseTo(r.lengthMm, 3);
    expect(short).toBeCloseTo(r.widthMm, 3);
  });
});
