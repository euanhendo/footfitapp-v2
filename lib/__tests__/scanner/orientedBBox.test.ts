import { minAreaRect } from '../../scanner/orientedBBox';
import { Point } from '../../scanner/types';

function rotate(p: Point, angleRad: number): Point {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

describe('minAreaRect', () => {
  it('returns zeroed result for an empty contour', () => {
    expect(minAreaRect([])).toEqual({ lengthMm: 0, widthMm: 0, angleRad: 0 });
  });

  it('returns zeroed result for a single point', () => {
    expect(minAreaRect([{ x: 1, y: 1 }])).toEqual({ lengthMm: 0, widthMm: 0, angleRad: 0 });
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
});
