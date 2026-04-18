import { computeFootMetrics, maskBoundingBox, maskPixelCount } from '../../scanner/footMetrics';
import { Mask } from '../../scanner/types';

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
