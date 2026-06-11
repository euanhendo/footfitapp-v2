import { applyHomography, solveHomography } from '../../scanner/homography';
import { Point } from '../../scanner/types';

const unitSquare: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

describe('solveHomography', () => {
  it('returns identity for matching squares', () => {
    const h = solveHomography(unitSquare, unitSquare);
    expect(h).not.toBeNull();
    const p = applyHomography(h!, { x: 0.3, y: 0.7 });
    expect(p.x).toBeCloseTo(0.3, 6);
    expect(p.y).toBeCloseTo(0.7, 6);
  });

  it('recovers scale and translation', () => {
    const dst: Point[] = [
      { x: 10, y: 20 },
      { x: 220, y: 20 },
      { x: 220, y: 317 },
      { x: 10, y: 317 },
    ];
    const h = solveHomography(unitSquare, dst);
    const mid = applyHomography(h!, { x: 0.5, y: 0.5 });
    expect(mid.x).toBeCloseTo(115, 5);
    expect(mid.y).toBeCloseTo(168.5, 5);
  });

  it('maps all four corners exactly under perspective distortion', () => {
    // A tilted-camera trapezoid: far (top) edge compressed
    const trapezoid: Point[] = [
      { x: 120, y: 80 },
      { x: 880, y: 95 },
      { x: 1010, y: 1400 },
      { x: 15, y: 1380 },
    ];
    const rect: Point[] = [
      { x: 0, y: 0 },
      { x: 210, y: 0 },
      { x: 210, y: 297 },
      { x: 0, y: 297 },
    ];
    const h = solveHomography(trapezoid, rect);
    expect(h).not.toBeNull();
    trapezoid.forEach((src, i) => {
      const p = applyHomography(h!, src);
      expect(p.x).toBeCloseTo(rect[i].x, 4);
      expect(p.y).toBeCloseTo(rect[i].y, 4);
    });
  });

  it('round-trips points through forward and inverse mappings', () => {
    const trapezoid: Point[] = [
      { x: 120, y: 80 },
      { x: 880, y: 95 },
      { x: 1010, y: 1400 },
      { x: 15, y: 1380 },
    ];
    const rect: Point[] = [
      { x: 0, y: 0 },
      { x: 210, y: 0 },
      { x: 210, y: 297 },
      { x: 0, y: 297 },
    ];
    const forward = solveHomography(trapezoid, rect)!;
    const inverse = solveHomography(rect, trapezoid)!;
    const original: Point = { x: 105, y: 150 };
    const px = applyHomography(inverse, original);
    const back = applyHomography(forward, px);
    expect(back.x).toBeCloseTo(original.x, 4);
    expect(back.y).toBeCloseTo(original.y, 4);
  });

  it('returns null for degenerate (collinear) corners', () => {
    const degenerate: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(solveHomography(degenerate, unitSquare)).toBeNull();
  });

  it('rejects inputs that are not 4 points', () => {
    expect(solveHomography(unitSquare.slice(0, 3), unitSquare)).toBeNull();
  });
});
