import { findHeelEdge, measureFromQuadAndFoot } from '../../scanner/footMetrics';
import { Point } from '../../scanner/types';

function axisAlignedA4(pxPerMm: number): Point[] {
  const w = 297 * pxPerMm;
  const h = 210 * pxPerMm;
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

function rotate(points: Point[], degrees: number, cx: number, cy: number): Point[] {
  const rad = (degrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return points.map((p) => ({
    x: cx + (p.x - cx) * c - (p.y - cy) * s,
    y: cy + (p.x - cx) * s + (p.y - cy) * c,
  }));
}

function footRect(x0: number, x1: number, y0: number, y1: number): Point[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

describe('measureFromQuadAndFoot', () => {
  it('measures axis-aligned A4 with foot crossing a short edge', () => {
    const quad = axisAlignedA4(1);
    const foot = footRect(0, 250, 80, 140);
    const result = measureFromQuadAndFoot(quad, foot, 'a4');
    expect(Math.abs(result.lengthMm - 250)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.widthMm - 60)).toBeLessThanOrEqual(2);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('measures a 30°-rotated A4 with the same tolerance', () => {
    const base = axisAlignedA4(1);
    const foot = footRect(0, 250, 80, 140);
    const cx = 148.5;
    const cy = 105;
    const quad = rotate(base, 30, cx, cy);
    const rotatedFoot = rotate(foot, 30, cx, cy);
    const result = measureFromQuadAndFoot(quad, rotatedFoot, 'a4');
    expect(Math.abs(result.lengthMm - 250)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.widthMm - 60)).toBeLessThanOrEqual(2);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('picks a short edge as heel even when foot crosses a long edge (wrong orientation)', () => {
    const quad = axisAlignedA4(1);
    const foot = footRect(80, 220, 10, 150);
    const result = measureFromQuadAndFoot(quad, foot, 'a4');
    expect(result.lengthMm).toBeGreaterThan(200);
    expect(result.confidence).toBe(0);
  });

  it('returns zeros when quad is not 4 corners', () => {
    const result = measureFromQuadAndFoot([{ x: 0, y: 0 }], [{ x: 1, y: 1 }], 'a4');
    expect(result).toEqual({ lengthMm: 0, widthMm: 0, confidence: 0 });
  });

  it('returns zeros when foot is empty', () => {
    const result = measureFromQuadAndFoot(axisAlignedA4(1), [], 'a4');
    expect(result).toEqual({ lengthMm: 0, widthMm: 0, confidence: 0 });
  });

  it('measures width across the foot axis, not the paper, when the foot is angled', () => {
    const quad = axisAlignedA4(1);
    // 250×60 foot angled 8° on the paper, heel still crossing the short edge
    const foot = rotate(footRect(0, 250, 80, 140), 8, 0, 110);
    const result = measureFromQuadAndFoot(quad, foot, 'a4');
    expect(Math.abs(result.widthMm - 60)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.lengthMm - 250)).toBeLessThanOrEqual(5);
    expect(result.confidence).toBeGreaterThan(0);
  });
});

describe('findHeelEdge', () => {
  it('returns the short edge the foot presses against', () => {
    const quad = axisAlignedA4(1);
    const foot = footRect(0, 250, 80, 140);
    const heel = findHeelEdge(quad, foot);
    expect(heel).not.toBeNull();
    expect(heel!.a.x).toBe(0);
    expect(heel!.b.x).toBe(0);
  });

  it('tracks the heel edge under rotation', () => {
    const cx = 148.5;
    const cy = 105;
    const quad = rotate(axisAlignedA4(1), 30, cx, cy);
    const foot = rotate(footRect(0, 250, 80, 140), 30, cx, cy);
    const heel = findHeelEdge(quad, foot);
    const expected = rotate(
      [
        { x: 0, y: 0 },
        { x: 0, y: 210 },
      ],
      30,
      cx,
      cy,
    );
    expect(heel).not.toBeNull();
    const ends = [heel!.a, heel!.b];
    for (const corner of expected) {
      expect(ends.some((p) => Math.hypot(p.x - corner.x, p.y - corner.y) < 1)).toBe(true);
    }
  });

  it('returns null for malformed input', () => {
    expect(findHeelEdge([{ x: 0, y: 0 }], [{ x: 1, y: 1 }])).toBeNull();
    expect(findHeelEdge(axisAlignedA4(1), [])).toBeNull();
  });
});
