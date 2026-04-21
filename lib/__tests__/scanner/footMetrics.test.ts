import {
  computeFootMetrics,
  computeFootMetricsFromContour,
  maskBoundingBox,
  maskPixelCount,
} from '../../scanner/footMetrics';
import { Mask, Point } from '../../scanner/types';

function rectMask(width: number, height: number, filled: { x: number; y: number; w: number; h: number }): Mask {
  const data = new Uint8Array(width * height);
  for (let y = filled.y; y < filled.y + filled.h; y++) {
    for (let x = filled.x; x < filled.x + filled.w; x++) {
      data[y * width + x] = 1;
    }
  }
  return { width, height, data };
}

function ellipseMask(width: number, height: number, cx: number, cy: number, rx: number, ry: number): Mask {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) data[y * width + x] = 1;
    }
  }
  return { width, height, data };
}

describe('maskBoundingBox', () => {
  it('returns the tight bounding box of a filled rectangle', () => {
    const mask = rectMask(300, 100, { x: 20, y: 5, w: 260, h: 95 });
    expect(maskBoundingBox(mask)).toEqual({ x: 20, y: 5, width: 260, height: 95 });
  });

  it('returns null for an empty mask', () => {
    const mask: Mask = { width: 10, height: 10, data: new Uint8Array(100) };
    expect(maskBoundingBox(mask)).toBeNull();
  });
});

describe('maskPixelCount', () => {
  it('counts only foreground pixels', () => {
    const mask = rectMask(10, 10, { x: 0, y: 0, w: 4, h: 5 });
    expect(maskPixelCount(mask)).toBe(20);
  });
});

describe('computeFootMetrics', () => {
  it('reports length and width in mm for a 260x95 mm rectangular mask at 1 px/mm', () => {
    const mask = rectMask(300, 120, { x: 20, y: 12, w: 260, h: 95 });
    const metrics = computeFootMetrics(mask, 1);
    expect(metrics.lengthMm).toBe(260);
    expect(metrics.widthMm).toBe(95);
  });

  it('reports length and width at a non-unit scale', () => {
    const mask = rectMask(300, 120, { x: 10, y: 10, w: 260, h: 95 });
    const metrics = computeFootMetrics(mask, 2);
    expect(metrics.lengthMm).toBe(130);
    expect(metrics.widthMm).toBeCloseTo(47.5, 5);
  });

  it('returns high confidence for a realistic foot-shaped ellipse', () => {
    const mask = ellipseMask(300, 120, 150, 60, 130, 47);
    const metrics = computeFootMetrics(mask, 1);
    expect(metrics.lengthMm).toBeGreaterThanOrEqual(259);
    expect(metrics.lengthMm).toBeLessThanOrEqual(261);
    expect(metrics.widthMm).toBeGreaterThanOrEqual(93);
    expect(metrics.widthMm).toBeLessThanOrEqual(96);
    expect(metrics.confidence).toBeGreaterThan(0.9);
  });

  it('confidence is in [0, 1]', () => {
    const mask = ellipseMask(300, 120, 150, 60, 130, 47);
    const metrics = computeFootMetrics(mask, 1);
    expect(metrics.confidence).toBeGreaterThanOrEqual(0);
    expect(metrics.confidence).toBeLessThanOrEqual(1);
  });

  it('penalises masks that are too square to be a foot', () => {
    const mask = rectMask(120, 120, { x: 10, y: 10, w: 100, h: 100 });
    const metrics = computeFootMetrics(mask, 1);
    expect(metrics.confidence).toBeLessThan(0.5);
  });

  it('returns zeroed metrics for an empty mask', () => {
    const mask: Mask = { width: 10, height: 10, data: new Uint8Array(100) };
    const metrics = computeFootMetrics(mask, 1);
    expect(metrics.lengthMm).toBe(0);
    expect(metrics.widthMm).toBe(0);
    expect(metrics.confidence).toBe(0);
  });

  it('throws if pxPerMm is not positive', () => {
    const mask = rectMask(10, 10, { x: 0, y: 0, w: 5, h: 5 });
    expect(() => computeFootMetrics(mask, 0)).toThrow();
  });
});

describe('computeFootMetricsFromContour', () => {
  it('returns zeroed metrics for an empty contour', () => {
    const m = computeFootMetricsFromContour([]);
    expect(m.lengthMm).toBe(0);
    expect(m.widthMm).toBe(0);
    expect(m.confidence).toBe(0);
  });

  it('measures an axis-aligned rectangle directly in mm', () => {
    const contour: Point[] = [
      { x: 0, y: 0 },
      { x: 260, y: 0 },
      { x: 260, y: 95 },
      { x: 0, y: 95 },
    ];
    const m = computeFootMetricsFromContour(contour);
    expect(m.lengthMm).toBeCloseTo(260, 3);
    expect(m.widthMm).toBeCloseTo(95, 3);
    expect(m.confidence).toBeGreaterThan(0.9);
  });

  it('measures a rotated rectangle along its own axis, not the paper axis', () => {
    const base: Point[] = [];
    for (let t = 0; t <= 260; t += 4) base.push({ x: t, y: 0 });
    for (let t = 0; t <= 95; t += 4) base.push({ x: 260, y: t });
    for (let t = 260; t >= 0; t -= 4) base.push({ x: t, y: 95 });
    for (let t = 95; t >= 0; t -= 4) base.push({ x: 0, y: t });
    const angle = Math.PI / 7;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotated = base.map((p) => ({
      x: p.x * cos - p.y * sin + 50,
      y: p.x * sin + p.y * cos + 50,
    }));
    const m = computeFootMetricsFromContour(rotated);
    expect(m.lengthMm).toBeCloseTo(260, 0);
    expect(m.widthMm).toBeCloseTo(95, 0);
  });

  it('returns low confidence for a roughly square contour (not foot-shaped)', () => {
    const contour: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const m = computeFootMetricsFromContour(contour);
    expect(m.confidence).toBeLessThan(0.5);
  });

  it('confidence is in [0, 1]', () => {
    const contour: Point[] = [
      { x: 0, y: 0 },
      { x: 260, y: 0 },
      { x: 260, y: 95 },
      { x: 0, y: 95 },
    ];
    const m = computeFootMetricsFromContour(contour);
    expect(m.confidence).toBeGreaterThanOrEqual(0);
    expect(m.confidence).toBeLessThanOrEqual(1);
  });
});
