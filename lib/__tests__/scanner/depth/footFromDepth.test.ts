import {
  measureFootFromDepthFrame,
  orientHeelAtOrigin,
  segmentFootPoints,
} from '../../../scanner/depth/footFromDepth';
import { depthFrameToPoints } from '../../../scanner/depth/pointCloud';
import { fitFloorPlane } from '../../../scanner/depth/planeFit';
import { DepthFrame } from '../../../scanner/depth/types';

// Synthetic scenes at ARKit's depth resolution. Shapes are defined by their
// floor footprint in mm; pixels are tested against the footprint at the
// shape's own top depth, so the unprojected 3D points carry the true floor
// coordinates (a closer surface fills more pixels — pinhole projection).
type Shape = { heightMm: number; contains: (xMm: number, yMm: number) => boolean };

const FLOOR_MM = 600;
const FX = 500;

function makeScene(shapes: Shape[], width = 256, height = 192): DepthFrame {
  const intrinsics = { fx: FX, fy: FX, cx: width / 2, cy: height / 2 };
  const sorted = [...shapes].sort((a, b) => b.heightMm - a.heightMm);
  const depthMm = new Float32Array(width * height);
  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      let depth = FLOOR_MM;
      for (const shape of sorted) {
        const z = FLOOR_MM - shape.heightMm;
        const x = ((u - intrinsics.cx) * z) / FX;
        const y = ((v - intrinsics.cy) * z) / FX;
        if (shape.contains(x, y)) {
          depth = z;
          break;
        }
      }
      depthMm[v * width + u] = depth;
    }
  }
  return { width, height, depthMm, intrinsics };
}

// A 255 × 110 mm foot as an ellipse lying along the x-axis (the wide image
// axis — the depth frame is landscape, a foot capture fills it lengthwise).
const ellipseFoot: Shape = {
  heightMm: 35,
  contains: (x, y) => (x / 127.5) ** 2 + (y / 55) ** 2 <= 1,
};

// Egg-shaped foot: narrow heel, wide ball — for heel/toe disambiguation.
function eggFoot(toeTowardPositiveX: boolean): Shape {
  return {
    heightMm: 35,
    contains: (x, y) => {
      const along = toeTowardPositiveX ? x : -x;
      if (along < -127.5 || along > 127.5) return false;
      const halfWidth = 55 * (0.55 + (0.45 * (along + 127.5)) / 255);
      return Math.abs(y) <= halfWidth;
    },
  };
}

// Ankle/lower-leg lobe near the heel, taller than the foot and bulging
// sideways past the true outline — the contamination that broke v2 width.
const ankleLobe: Shape = {
  heightMm: 90,
  contains: (x, y) => (x + 85) ** 2 + (y - 35) ** 2 <= 35 ** 2,
};

const OPTS = { seed: 42, iterations: 60 };

describe('measureFootFromDepthFrame', () => {
  it('measures a clean foot to within a few mm', () => {
    const metrics = measureFootFromDepthFrame(makeScene([ellipseFoot]), OPTS);
    expect(Math.abs(metrics.lengthMm - 255)).toBeLessThanOrEqual(5);
    expect(Math.abs(metrics.widthMm - 110)).toBeLessThanOrEqual(4);
    expect(metrics.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('returns zeros for a bare floor', () => {
    const metrics = measureFootFromDepthFrame(makeScene([]), OPTS);
    expect(metrics).toEqual({ lengthMm: 0, widthMm: 0, confidence: 0 });
  });

  it('keeps true width when the ankle lobe contaminates the contour', () => {
    const scene = makeScene([ellipseFoot, ankleLobe]);

    // Prove the lobe really is in the segmented contour: the raw cross-axis
    // span exceeds the true 110 mm width…
    const points = depthFrameToPoints(scene);
    const plane = fitFloorPlane(points, OPTS)!;
    const oriented = orientHeelAtOrigin(segmentFootPoints(points, plane));
    let minX = Infinity;
    let maxX = -Infinity;
    for (const p of oriented) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
    expect(maxX - minX).toBeGreaterThan(112);

    // …yet the band width stays anatomical, as on paper.
    const metrics = measureFootFromDepthFrame(scene, OPTS);
    expect(Math.abs(metrics.widthMm - 110)).toBeLessThanOrEqual(4);
    expect(Math.abs(metrics.lengthMm - 255)).toBeLessThanOrEqual(6);
  });

  it('measures the same foot whichever way the toes point', () => {
    const towardPositive = measureFootFromDepthFrame(makeScene([eggFoot(true)]), OPTS);
    const towardNegative = measureFootFromDepthFrame(makeScene([eggFoot(false)]), OPTS);
    expect(Math.abs(towardPositive.lengthMm - 255)).toBeLessThanOrEqual(5);
    expect(Math.abs(towardNegative.lengthMm - 255)).toBeLessThanOrEqual(5);
    expect(Math.abs(towardPositive.widthMm - towardNegative.widthMm)).toBeLessThanOrEqual(4);
    // The widest slice the band can see is at 95% of the egg: ~108 mm. If the
    // flip heuristic failed, the band would top out around 95 mm instead.
    expect(towardPositive.widthMm).toBeGreaterThanOrEqual(102);
    expect(towardNegative.widthMm).toBeGreaterThanOrEqual(102);
  });
});
