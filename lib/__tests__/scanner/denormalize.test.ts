import { denormalizePoints } from '../../scanner/denormalize';

describe('denormalizePoints', () => {
  it('scales x by width and y by height', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.25 },
      { x: 1, y: 1 },
    ];
    expect(denormalizePoints(points, 3024, 4032)).toEqual([
      { x: 0, y: 0 },
      { x: 1512, y: 1008 },
      { x: 3024, y: 4032 },
    ]);
  });

  it('restores true geometry distorted by the normalized square', () => {
    // A4 portrait in a 3:4 photo: long side along y reads as 0.55 normalized
    // but must come back to ~0.707 short/long in pixel space
    const w = 3000;
    const h = 4000;
    const longPx = 2200;
    const shortPx = longPx * (210 / 297);
    const quadNorm = [
      { x: 0.1, y: 0.1 },
      { x: 0.1 + shortPx / w, y: 0.1 },
      { x: 0.1 + shortPx / w, y: 0.1 + longPx / h },
      { x: 0.1, y: 0.1 + longPx / h },
    ];
    const quadPx = denormalizePoints(quadNorm, w, h);
    const top = Math.hypot(quadPx[1].x - quadPx[0].x, quadPx[1].y - quadPx[0].y);
    const side = Math.hypot(quadPx[2].x - quadPx[1].x, quadPx[2].y - quadPx[1].y);
    expect(Math.min(top, side) / Math.max(top, side)).toBeCloseTo(210 / 297, 3);
  });

  it('returns an empty array unchanged', () => {
    expect(denormalizePoints([], 100, 100)).toEqual([]);
  });

  it('throws on non-positive dimensions', () => {
    expect(() => denormalizePoints([{ x: 0.5, y: 0.5 }], 0, 100)).toThrow();
    expect(() => denormalizePoints([{ x: 0.5, y: 0.5 }], 100, -1)).toThrow();
  });
});
