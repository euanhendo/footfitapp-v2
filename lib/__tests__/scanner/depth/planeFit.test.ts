import {
  fitFloorPlane,
  heightAboveFloorMm,
  planeBasis,
  projectToFloorMm,
} from '../../../scanner/depth/planeFit';
import { Vec3 } from '../../../scanner/depth/types';

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

function gridOnPlane(normal: Vec3, dMm: number, jitterMm = 0): Vec3[] {
  // Rays through a synthetic 32×24 pinhole grid intersected with the plane,
  // mimicking what depthFrameToPoints produces for a bare floor.
  const points: Vec3[] = [];
  let k = 0;
  for (let v = 0; v < 24; v++) {
    for (let u = 0; u < 32; u++) {
      const dir = { x: (u - 16) / 50, y: (v - 12) / 50, z: 1 };
      const denom = dot(normal, dir);
      if (Math.abs(denom) < 1e-6) continue;
      const z = -dMm / denom;
      if (z <= 0) continue;
      const jitter = jitterMm * (((k++ % 7) - 3) / 3);
      points.push({
        x: dir.x * z + normal.x * jitter,
        y: dir.y * z + normal.y * jitter,
        z: dir.z * z + normal.z * jitter,
      });
    }
  }
  return points;
}

describe('fitFloorPlane', () => {
  it('recovers a camera-facing floor perpendicular to the view axis', () => {
    const truth = { x: 0, y: 0, z: -1 };
    const points = gridOnPlane(truth, 600);
    const plane = fitFloorPlane(points, { seed: 42 });
    expect(plane).not.toBeNull();
    expect(Math.abs(dot(plane!.normal, truth))).toBeGreaterThan(0.9995);
    expect(plane!.dMm).toBeCloseTo(600, 0);
    expect(plane!.inlierRatio).toBeGreaterThan(0.95);
  });

  it('recovers a tilted floor within ~1 degree despite noise', () => {
    const truth = { x: 0.08, y: -0.12, z: -1 };
    const len = Math.hypot(truth.x, truth.y, truth.z);
    const unit = { x: truth.x / len, y: truth.y / len, z: truth.z / len };
    const points = gridOnPlane(unit, 550, 3);
    const plane = fitFloorPlane(points, { seed: 42 });
    expect(plane).not.toBeNull();
    expect(Math.abs(dot(plane!.normal, unit))).toBeGreaterThan(0.9995);
    expect(plane!.dMm).toBeCloseTo(550, -1);
  });

  it('orients the normal so the camera side is positive', () => {
    const points = gridOnPlane({ x: 0, y: 0, z: -1 }, 600);
    const plane = fitFloorPlane(points, { seed: 7 })!;
    // The camera origin is above the floor.
    expect(heightAboveFloorMm(plane, { x: 0, y: 0, z: 0 })).toBeGreaterThan(0);
    // A point 30 mm up the camera axis from the floor reads ~30 mm.
    const lifted = { x: 0, y: 0, z: 600 - 30 };
    expect(heightAboveFloorMm(plane, lifted)).toBeCloseTo(30, 0);
  });

  it('returns null for degenerate input', () => {
    expect(fitFloorPlane([], { seed: 1 })).toBeNull();
    expect(
      fitFloorPlane(
        [
          { x: 0, y: 0, z: 1 },
          { x: 0, y: 0, z: 1 },
        ],
        { seed: 1 },
      ),
    ).toBeNull();
  });
});

describe('projectToFloorMm', () => {
  it('preserves in-plane distances', () => {
    const points = gridOnPlane({ x: 0, y: 0, z: -1 }, 600);
    const plane = fitFloorPlane(points, { seed: 42 })!;
    const basis = planeBasis(plane.normal);
    const a = projectToFloorMm(plane, basis, { x: 0, y: 0, z: 600 });
    const b = projectToFloorMm(plane, basis, { x: 100, y: 0, z: 600 });
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    expect(dist).toBeCloseTo(100, 0);
  });
});
