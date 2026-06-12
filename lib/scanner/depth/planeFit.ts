import { FloorPlane, Vec3 } from './types';

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

function normalize(a: Vec3): Vec3 | null {
  const len = Math.hypot(a.x, a.y, a.z);
  return len > 1e-9 ? scale(a, 1 / len) : null;
}

// Deterministic PRNG (mulberry32) so RANSAC is reproducible in tests.
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type PlaneFitOptions = {
  iterations?: number;
  inlierThresholdMm?: number;
  seed?: number;
};

/**
 * RANSAC the dominant plane out of a camera-space cloud, then refine it by
 * least squares over the inliers. For a floor-pointing capture the floor is
 * by far the biggest plane, so the consensus winner is the floor even with a
 * foot (and ankle) in frame. The returned normal points toward the camera,
 * so heightAboveFloorMm is positive for anything standing on the floor.
 */
export function fitFloorPlane(points: Vec3[], options: PlaneFitOptions = {}): FloorPlane | null {
  const { iterations = 150, inlierThresholdMm = 8, seed = 1 } = options;
  if (points.length < 3) return null;
  const rand = mulberry32(seed);

  let bestNormal: Vec3 | null = null;
  let bestD = 0;
  let bestInliers = 0;
  for (let i = 0; i < iterations; i++) {
    const a = points[Math.floor(rand() * points.length)];
    const b = points[Math.floor(rand() * points.length)];
    const c = points[Math.floor(rand() * points.length)];
    const n = normalize(cross(sub(b, a), sub(c, a)));
    if (!n) continue;
    const d = -dot(n, a);
    let inliers = 0;
    for (const p of points) {
      if (Math.abs(dot(n, p) + d) <= inlierThresholdMm) inliers++;
    }
    if (inliers > bestInliers) {
      bestInliers = inliers;
      bestNormal = n;
      bestD = d;
    }
  }
  if (!bestNormal || bestInliers < 3) return null;

  const refined = refineByLeastSquares(points, bestNormal, bestD, inlierThresholdMm);
  let { normal, dMm } = refined;

  // Orient toward the camera: the origin (camera) is above the floor, so its
  // height dot(n, 0) + d = d must be positive.
  if (dMm < 0) {
    normal = scale(normal, -1);
    dMm = -dMm;
  }

  let finalInliers = 0;
  for (const p of points) {
    if (Math.abs(dot(normal, p) + dMm) <= inlierThresholdMm) finalInliers++;
  }
  return { normal, dMm, inlierRatio: finalInliers / points.length };
}

// Express inliers in a basis where the RANSAC normal is "up", fit the small
// height residual as a linear function of the in-plane coordinates, and fold
// the correction back into the normal. Avoids a 3×3 eigensolver while staying
// well-conditioned regardless of the plane's orientation in camera space.
function refineByLeastSquares(
  points: Vec3[],
  n: Vec3,
  d: number,
  inlierThresholdMm: number,
): { normal: Vec3; dMm: number } {
  const inliers = points.filter((p) => Math.abs(dot(n, p) + d) <= inlierThresholdMm);
  if (inliers.length < 3) return { normal: n, dMm: d };

  const centroid = scale(
    inliers.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), {
      x: 0,
      y: 0,
      z: 0,
    }),
    1 / inliers.length,
  );
  const { e1, e2 } = planeBasis(n);

  let sss = 0;
  let sst = 0;
  let stt = 0;
  let ssh = 0;
  let sth = 0;
  for (const p of inliers) {
    const q = sub(p, centroid);
    const s = dot(q, e1);
    const t = dot(q, e2);
    const h = dot(q, n);
    sss += s * s;
    sst += s * t;
    stt += t * t;
    ssh += s * h;
    sth += t * h;
  }
  const det = sss * stt - sst * sst;
  if (Math.abs(det) < 1e-9) return { normal: n, dMm: d };
  const alpha = (stt * ssh - sst * sth) / det;
  const beta = (sss * sth - sst * ssh) / det;

  // h = alpha*s + beta*t  ⇒  dot(q, n - alpha*e1 - beta*e2) = 0
  const corrected = normalize(sub(sub(n, scale(e1, alpha)), scale(e2, beta)));
  if (!corrected) return { normal: n, dMm: d };
  return { normal: corrected, dMm: -dot(corrected, centroid) };
}

/** Signed height of a camera-space point above the floor, in mm. */
export function heightAboveFloorMm(plane: FloorPlane, p: Vec3): number {
  return dot(plane.normal, p) + plane.dMm;
}

/** An orthonormal in-plane basis for projecting points onto the floor. */
export function planeBasis(normal: Vec3): { e1: Vec3; e2: Vec3 } {
  const helper: Vec3 = Math.abs(normal.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const e1 = normalize(cross(helper, normal))!;
  const e2 = cross(normal, e1);
  return { e1, e2 };
}

/** Project a camera-space point onto the floor plane, in the plane's own mm coordinates. */
export function projectToFloorMm(
  plane: FloorPlane,
  basis: { e1: Vec3; e2: Vec3 },
  p: Vec3,
): { x: number; y: number } {
  // Closest point on the plane to the camera origin anchors the 2D frame.
  const origin = scale(plane.normal, -plane.dMm);
  const q = sub(p, origin);
  return { x: dot(q, basis.e1), y: dot(q, basis.e2) };
}
