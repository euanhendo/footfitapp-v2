import { Point } from './types';

// Vision returns coordinates normalized to [0,1] in both axes, which distorts
// geometry on non-square images — convert to pixels before any distance math.
export function denormalizePoints(points: Point[], width: number, height: number): Point[] {
  if (width <= 0 || height <= 0) {
    throw new Error('image dimensions must be positive');
  }
  return points.map((p) => ({ x: p.x * width, y: p.y * height }));
}
