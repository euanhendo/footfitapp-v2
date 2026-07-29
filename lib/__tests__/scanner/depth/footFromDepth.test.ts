import {
  anchorToFloorContact,
  FootSample,
  measureFootFromDepthFrame,
  measureFootFromDepthFrameDebug,
  orientHeelAtOrigin,
  segmentFootPoints,
  trimLegShadow,
} from '../../../scanner/depth/footFromDepth';
import { depthFrameToPoints } from '../../../scanner/depth/pointCloud';
import { fitFloorPlane } from '../../../scanner/depth/planeFit';
import { DepthFrame } from '../../../scanner/depth/types';

// Synthetic scenes at ARKit's depth resolution. Shapes are defined by their
// floor footprint in mm; pixels are tested against the footprint at the
// shape's own top depth, so the unprojected 3D points carry the true floor
// coordinates (a closer surface fills more pixels — pinhole projection).
// `heightAt` makes a shape's surface vary with position (a real foot tapers to
// the floor at its outline — toe tips 2–5 mm, heel-pad edge likewise). Tapered
// shapes are evaluated in floor-plane coordinates so the near-floor outline
// unprojects to its exact footprint; flat shapes keep the top-depth evaluation.
type Shape = {
  heightMm: number;
  contains: (xMm: number, yMm: number) => boolean;
  heightAt?: (xMm: number, yMm: number) => number;
};

const FLOOR_MM = 600;

function makeScene(shapes: Shape[], fx = 500, width = 256, height = 192): DepthFrame {
  const intrinsics = { fx, fy: fx, cx: width / 2, cy: height / 2 };
  const sorted = [...shapes].sort((a, b) => b.heightMm - a.heightMm);
  const depthMm = new Float32Array(width * height);
  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      let depth = FLOOR_MM;
      for (const shape of sorted) {
        if (shape.heightAt) {
          // Fixed-point ray/surface intersection: the pixel ray's floor-plane
          // coords seed the height lookup, then the coords are re-derived at
          // that height until stable — so unprojecting the recorded depth
          // recovers the true surface coordinates (no interior distortion).
          let x = ((u - intrinsics.cx) * FLOOR_MM) / fx;
          let y = ((v - intrinsics.cy) * FLOOR_MM) / fx;
          for (let i = 0; i < 3; i++) {
            const z = FLOOR_MM - (shape.contains(x, y) ? shape.heightAt(x, y) : 0);
            x = ((u - intrinsics.cx) * z) / fx;
            y = ((v - intrinsics.cy) * z) / fx;
          }
          if (shape.contains(x, y)) {
            depth = FLOOR_MM - shape.heightAt(x, y);
            break;
          }
          continue;
        }
        const z = FLOOR_MM - shape.heightMm;
        const x = ((u - intrinsics.cx) * z) / fx;
        const y = ((v - intrinsics.cy) * z) / fx;
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
  // Dome profile: full height inside, tapering to the floor over the outer
  // 5% of the radius — toe tips and heel-pad edge land at 2–5 mm like a
  // real foot (device captures 2026-07-23), which the toe-presence trust
  // signal requires.
  heightAt: (x, y) => {
    const e = Math.sqrt((x / 127.5) ** 2 + (y / 55) ** 2);
    return Math.max(3, 35 * Math.min(1, (1 - e) / 0.05));
  },
};

// Egg-shaped foot: narrow heel, wide ball — for heel/toe disambiguation.
function eggFoot(toeTowardPositiveX: boolean): Shape {
  const halfWidthAt = (along: number) => 55 * (0.55 + (0.45 * (along + 127.5)) / 255);
  return {
    heightMm: 35,
    contains: (x, y) => {
      const along = toeTowardPositiveX ? x : -x;
      if (along < -127.5 || along > 127.5) return false;
      return Math.abs(y) <= halfWidthAt(along);
    },
    heightAt: (x, y) => {
      const along = toeTowardPositiveX ? x : -x;
      const edge = Math.max(Math.abs(along) / 127.5, Math.abs(y) / halfWidthAt(along));
      return Math.max(3, 35 * Math.min(1, (1 - edge) / 0.05));
    },
  };
}

// Ankle/lower-leg lobe near the heel, taller than the foot and bulging
// sideways past the true outline — the contamination that broke v2 width.
const ankleLobe: Shape = {
  heightMm: 90,
  contains: (x, y) => (x + 85) ** 2 + (y - 35) ** 2 <= 35 ** 2,
};

// Synthetic frames have perfect edges, so geometry tests disable the
// edge-erosion calibration fitted for real sensor captures.
const OPTS = { seed: 42, iterations: 60, calibrate: false };

describe('trimLegShadow', () => {
  it('cuts hovering rear slices and re-zeroes the heel', () => {
    const samples: FootSample[] = [];
    // Leg shadow: y 0–79, lowest point 100 mm up.
    for (let y = 0; y < 80; y += 5) {
      for (let x = -30; x <= 30; x += 10) samples.push({ x, y, hMm: 100 });
    }
    // Foot: y 80–335, plenty of low points.
    for (let y = 80; y <= 335; y += 5) {
      for (let x = -50; x <= 50; x += 10) samples.push({ x, y, hMm: 8 + (y % 30) });
    }
    const trimmed = trimLegShadow(samples);
    const ys = trimmed.map((p) => p.y);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(255);
    expect(trimmed.every((p) => p.hMm < 100)).toBe(true);
  });

  it('still cuts a leg ringed by floor-blended edge pixels', () => {
    const samples: FootSample[] = [];
    // Leg shadow with a thin low fringe (~13% of each slice), as seen on
    // bright hard floor: one blended edge pixel per side.
    for (let y = 0; y < 80; y += 5) {
      samples.push({ x: -35, y, hMm: 20 });
      samples.push({ x: 35, y, hMm: 25 });
      for (let x = -30; x <= 30; x += 5) samples.push({ x, y, hMm: 105 });
    }
    for (let y = 80; y <= 335; y += 5) {
      for (let x = -50; x <= 50; x += 10) samples.push({ x, y, hMm: 8 + (y % 30) });
    }
    const trimmed = trimLegShadow(samples);
    const ys = trimmed.map((p) => p.y);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(255);
  });

  it('leaves a clean foot untouched', () => {
    const samples: FootSample[] = [];
    for (let y = 0; y <= 250; y += 5) samples.push({ x: 0, y, hMm: 20 });
    expect(trimLegShadow(samples)).toHaveLength(samples.length);
    expect(trimLegShadow([])).toEqual([]);
  });
});

describe('anchorToFloorContact', () => {
  it('bounds length by near-floor points only, ignoring a hovering shin', () => {
    const samples: FootSample[] = [];
    // Hovering shin shadow with a sparse low halo (1 point per slice).
    for (let y = 0; y < 100; y += 5) {
      samples.push({ x: -30, y, hMm: 20 });
      for (let x = -25; x <= 25; x += 5) samples.push({ x, y, hMm: 100 });
    }
    // Foot y 100–355: heel pad low, instep high in the middle, toes low.
    for (let y = 100; y <= 355; y += 5) {
      for (let x = -40; x <= 40; x += 8) {
        const h = y < 180 ? 30 : y < 300 ? 60 : 15;
        samples.push({ x, y, hMm: h });
      }
    }
    const anchored = anchorToFloorContact(samples);
    const ys = anchored.map((p) => p.y);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(255);
    // The high instep stays in the contour for the width fit.
    expect(anchored.some((p) => p.hMm === 60)).toBe(true);
  });

  it('keeps everything when no low silhouette exists', () => {
    const high: FootSample[] = [];
    for (let y = 0; y <= 100; y += 10) high.push({ x: 0, y, hMm: 90 });
    expect(anchorToFloorContact(high)).toHaveLength(high.length);
    expect(anchorToFloorContact([])).toEqual([]);
  });
});

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

  it('compensates edge erosion in proportion to pixel pitch', () => {
    const scene = makeScene([ellipseFoot]);
    const raw = measureFootFromDepthFrame(scene, OPTS);
    const calibrated = measureFootFromDepthFrame(scene, { seed: 42, iterations: 60 });
    // Pixel pitch here: 600 mm floor / fx 500 = 1.2 mm per pixel.
    expect(calibrated.widthMm - raw.widthMm).toBeCloseTo(2.5 * 1.2, 0);
    expect(calibrated.lengthMm - raw.lengthMm).toBeCloseTo(1.2 * 1.2, 0);
  });

  it('exposes pipeline internals through the debug variant', () => {
    const scene = makeScene([ellipseFoot]);
    const debug = measureFootFromDepthFrameDebug(scene, OPTS);
    expect(debug.metrics).toEqual(measureFootFromDepthFrame(scene, OPTS));
    expect(debug.cloudPoints).toBe(256 * 192);
    expect(debug.footPoints).toBeGreaterThan(1000);
    expect(debug.floorInlierRatio).toBeGreaterThan(0.5);
    expect(Math.abs(debug.cameraHeightMm - 600)).toBeLessThanOrEqual(5);
  });

  it('measures only the aimed foot when other objects share the frame', () => {
    // Wide FOV like the real sensor (fx ≈ 180) so a second foot and stray
    // carpet-noise bumps fit around the aimed foot — the scene from the
    // first real capture session.
    const secondFoot: Shape = {
      heightMm: 35,
      contains: (x, y) => ((x - 60) / 127.5) ** 2 + ((y - 270) / 55) ** 2 <= 1,
    };
    const noiseBumps: Shape[] = [-320, -180, 300].map((nx, i) => ({
      heightMm: 15,
      contains: (x, y) => Math.hypot(x - nx, y + 180 + i * 25) <= 20,
    }));
    const scene = makeScene([ellipseFoot, secondFoot, ...noiseBumps], 180);
    const debug = measureFootFromDepthFrameDebug(scene, OPTS);
    expect(debug.bandPoints).toBeGreaterThan(debug.footPoints);
    // Tapered-edge feet (realistic soles, added with the toe-presence signal)
    // lose a little of their thin edge ring to the coarse 3.3 mm pixel pitch
    // at this wide FOV — a discretization cost, not a pipeline error; the
    // real-frame fixtures are the accuracy referee.
    expect(Math.abs(debug.metrics.lengthMm - 255)).toBeLessThanOrEqual(10);
    expect(Math.abs(debug.metrics.widthMm - 110)).toBeLessThanOrEqual(6);
  });

  it('rejects a foot-proportioned blob wider than any human foot', () => {
    // Foot+leg merged into one cluster at roughly double scale (the angled
    // shin-brace captures of 2026-07-29 read 322–462 × 167–218 mm at full
    // confidence): aspect stays foot-like, so only the anatomical width
    // envelope can catch it.
    const giantBlob: Shape = {
      heightMm: 35,
      contains: (x, y) => (x / 255) ** 2 + (y / 110) ** 2 <= 1,
      heightAt: (x, y) => {
        const e = Math.sqrt((x / 255) ** 2 + (y / 110) ** 2);
        return Math.max(3, 35 * Math.min(1, (1 - e) / 0.05));
      },
    };
    const metrics = measureFootFromDepthFrame(makeScene([giantBlob], 180), OPTS);
    expect(metrics.widthMm).toBeGreaterThan(130);
    expect(metrics.confidence).toBeLessThan(0.5);
  });

  it('amputates the leg occlusion shadow but keeps the heel', () => {
    // Bare shin leaning into frame: a high (105 mm) slab joined to the heel,
    // hovering off the floor — the real capture that read 353 mm median
    // against a 265 mm foot.
    const shinShadow: Shape = {
      heightMm: 105,
      contains: (x, y) => x >= -215 && x <= -115 && Math.abs(y - 10) <= 40,
    };
    const scene = makeScene([ellipseFoot, shinShadow], 180);
    const metrics = measureFootFromDepthFrame(scene, OPTS);
    // The trim walks a little further into a tapered heel edge than it did
    // into the old slab's cliff — the shadow-adjacent slices thin out
    // gradually now. Real heel behaviour is pinned by the device fixtures.
    expect(Math.abs(metrics.lengthMm - 255)).toBeLessThanOrEqual(17);
    expect(Math.abs(metrics.widthMm - 110)).toBeLessThanOrEqual(6);
  });

  it('measures the same foot whichever way the toes point', () => {
    const towardPositive = measureFootFromDepthFrame(makeScene([eggFoot(true)]), OPTS);
    const towardNegative = measureFootFromDepthFrame(makeScene([eggFoot(false)]), OPTS);
    expect(Math.abs(towardPositive.lengthMm - 255)).toBeLessThanOrEqual(6);
    expect(Math.abs(towardNegative.lengthMm - 255)).toBeLessThanOrEqual(6);
    expect(Math.abs(towardPositive.widthMm - towardNegative.widthMm)).toBeLessThanOrEqual(4);
    // The widest slice the band can see is at 95% of the egg: ~108 mm. If the
    // flip heuristic failed, the band would top out around 95 mm instead.
    expect(towardPositive.widthMm).toBeGreaterThanOrEqual(102);
    expect(towardNegative.widthMm).toBeGreaterThanOrEqual(102);
  });
});
