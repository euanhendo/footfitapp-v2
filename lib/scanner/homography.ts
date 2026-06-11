import { Point } from './types';

// Exact 4-point homography (DLT with h33 = 1). Solving src→dst lets the foot
// be measured in the paper's own mm coordinates, which removes perspective
// foreshortening that a single px-per-mm scale cannot represent.
export function solveHomography(src: Point[], dst: Point[]): number[] | null {
  if (src.length !== 4 || dst.length !== 4) return null;

  // Two rows per correspondence: 8 equations, 8 unknowns h0..h7
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-9) return null;
    if (pivot !== col) {
      [a[col], a[pivot]] = [a[pivot], a[col]];
      [b[col], b[pivot]] = [b[pivot], b[col]];
    }
    for (let row = col + 1; row < 8; row++) {
      const f = a[row][col] / a[col][col];
      for (let k = col; k < 8; k++) a[row][k] -= f * a[col][k];
      b[row] -= f * b[col];
    }
  }
  const h = new Array<number>(8);
  for (let row = 7; row >= 0; row--) {
    let sum = b[row];
    for (let k = row + 1; k < 8; k++) sum -= a[row][k] * h[k];
    h[row] = sum / a[row][row];
  }
  return h;
}

export function applyHomography(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + 1;
  if (Math.abs(w) < 1e-12) return { x: 0, y: 0 };
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}
