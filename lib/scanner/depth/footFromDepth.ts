import { rangeScore, widthAcrossFootBand } from '../footMetrics';
import { FootMetrics, Point } from '../types';
import { depthFrameToPoints, unprojectPixel } from './pointCloud';
import {
  fitFloorPlane,
  heightAboveFloorMm,
  planeBasis,
  PlaneFitOptions,
  projectToFloorMm,
} from './planeFit';
import { DepthFrame, FloorPlane, Vec3 } from './types';

// Height band that counts as "foot": below 6 mm is floor noise; above 120 mm
// is shin/calf, cut before it can stretch or widen the contour. The ankle
// (60–100 mm) survives the cut — the 30–95% width band downstream is the
// defence against it, exactly as in the paper pipeline. The floor was 10 mm
// until device captures (2026-06-12) showed toe tips are thinner than that,
// especially pressed into carpet — the toes vanished and length under-read.
const FOOT_MIN_HEIGHT_MM = 6;
const FOOT_MAX_HEIGHT_MM = 120;
const MIN_FOOT_POINTS = 40;
const ORIENT_BINS = 20;
const ORIENT_MIN_POINTS_PER_BIN = 2;
// Matches EXPECTED_ASPECT_MIN/MAX in footMetrics — a foot is 2–3.8× longer than wide.
const ASPECT_MIN = 2.0;
const ASPECT_MAX = 3.8;
// With a foot in frame the floor still owns ~2/3 of the cloud; below this the
// "floor" the RANSAC found is suspect (cluttered scene, foot too close).
const FLOOR_INLIER_GOOD_MIN = 0.35;

const ZERO: FootMetrics = { lengthMm: 0, widthMm: 0, confidence: 0 };

// Edge-erosion compensation — the depth twin of v2's WIDTH_SILHOUETTE_BIAS_MM.
// Boundary pixels blend object and floor depth, so they fail the height and
// confidence gates and the silhouette erodes by roughly a pixel per side.
// Erosion is in PIXELS, so the mm correction scales with pixel pitch
// (cameraHeight / fx). Fitted 2026-06-12 against pen+ruler ground truth
// 263 × 107 vs raw medians 258.8 × 98.3 at ~3.5 mm/px (one foot, 7 captures,
// hard floor, good light) — re-fit as more measured feet accumulate.
// Synthetic test frames have perfect edges, so geometry tests disable this
// via calibrate: false.
const WIDTH_EDGE_EROSION_PX = 2.5;
const LENGTH_EDGE_EROSION_PX = 1.2;

// Everything 10–120 mm off the floor is "raised", but not all of it is the
// aimed foot: the user's other foot, a trouser hem, furniture legs and
// carpet-pile noise all qualify (first real captures, 2026-06-12: foot +
// shin + second foot were read as one 975 mm object). So raised points are
// clustered on the floor grid and only the cluster nearest the aim point —
// the frame centre, where the guide box puts the foot — is measured.
const CLUSTER_CELL_MM = 25;
const CLUSTER_TARGET_RADIUS_MM = 200;

/** A flattened floor point that remembers how high above the floor it was. */
export type FootSample = Point & { hMm: number };

export function pickAimedCluster<P extends Point>(points: P[], target: Point): P[] {
  if (points.length === 0) return points;

  const cellIndex = new Map<string, number[]>();
  for (let i = 0; i < points.length; i++) {
    const key = `${Math.floor(points[i].x / CLUSTER_CELL_MM)},${Math.floor(points[i].y / CLUSTER_CELL_MM)}`;
    const list = cellIndex.get(key);
    if (list) list.push(i);
    else cellIndex.set(key, [i]);
  }

  // Flood-fill cells into clusters (8-connected).
  const cellCluster = new Map<string, number>();
  const clusters: { pointIndices: number[]; distanceToTarget: number }[] = [];
  for (const startKey of cellIndex.keys()) {
    if (cellCluster.has(startKey)) continue;
    const id = clusters.length;
    const cluster = { pointIndices: [] as number[], distanceToTarget: Infinity };
    const queue = [startKey];
    cellCluster.set(startKey, id);
    while (queue.length) {
      const key = queue.pop()!;
      const [cx, cy] = key.split(',').map(Number);
      const indices = cellIndex.get(key)!;
      cluster.pointIndices.push(...indices);
      const centreX = (cx + 0.5) * CLUSTER_CELL_MM;
      const centreY = (cy + 0.5) * CLUSTER_CELL_MM;
      const d = Math.hypot(centreX - target.x, centreY - target.y);
      if (d < cluster.distanceToTarget) cluster.distanceToTarget = d;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          const neighbour = `${cx + dx},${cy + dy}`;
          if (cellIndex.has(neighbour) && !cellCluster.has(neighbour)) {
            cellCluster.set(neighbour, id);
            queue.push(neighbour);
          }
        }
      }
    }
    clusters.push(cluster);
  }

  // Nearest cluster to the aim point wins; if nothing is plausibly under the
  // aim (foot off-centre), fall back to the biggest object in frame.
  let chosen = clusters[0];
  for (const c of clusters) {
    if (c.distanceToTarget < chosen.distanceToTarget) chosen = c;
  }
  if (chosen.distanceToTarget > CLUSTER_TARGET_RADIUS_MM) {
    for (const c of clusters) {
      if (c.pointIndices.length > chosen.pointIndices.length) chosen = c;
    }
  }
  return chosen.pointIndices.map((i) => points[i]);
}

/** Points 6–120 mm above the floor, flattened onto it in floor-mm coordinates. */
export function segmentFootPoints(points: Vec3[], plane: FloorPlane): FootSample[] {
  const basis = planeBasis(plane.normal);
  const foot: FootSample[] = [];
  for (const p of points) {
    const h = heightAboveFloorMm(plane, p);
    if (h < FOOT_MIN_HEIGHT_MM || h > FOOT_MAX_HEIGHT_MM) continue;
    foot.push({ ...projectToFloorMm(plane, basis, p), hMm: h });
  }
  return foot;
}

// The ankle/shin is connected to the foot, so clustering can't remove it and
// it stretches length backward (device 2026-06-12: bare leg read 353 median
// against a 265 foot, and the bent foot+shin axis poisoned the yaw correction
// so width under-read). The discriminator: real foot slices are MOSTLY
// points near floor level (toes ~10 mm, heel pad ~25 mm), while the leg's
// occlusion shadow hovers. A strict "any low point" test failed on device:
// crisp lighting draws a thin halo of floor-blended edge pixels along the
// shin outline (~10% of a slice), faking floor contact — so a slice only
// counts as foot when a meaningful fraction of it is low.
const TRIM_SLICE_MM = 10;
const LEG_ONLY_MIN_HEIGHT_MM = 55;
const FOOT_LOW_POINT_FRACTION = 0.2;

export function trimLegShadow(points: FootSample[]): FootSample[] {
  if (points.length === 0) return points;
  let maxY = 0;
  for (const p of points) {
    if (p.y > maxY) maxY = p.y;
  }
  const bins = Math.max(1, Math.ceil(maxY / TRIM_SLICE_MM));
  const total = new Array<number>(bins).fill(0);
  const low = new Array<number>(bins).fill(0);
  for (const p of points) {
    const bin = Math.min(bins - 1, Math.floor(p.y / TRIM_SLICE_MM));
    total[bin]++;
    if (p.hMm <= LEG_ONLY_MIN_HEIGHT_MM) low[bin]++;
  }
  let cut = 0;
  while (cut < bins && low[cut] < Math.max(2, total[cut] * FOOT_LOW_POINT_FRACTION)) cut++;
  if (cut === 0) return points;
  const yCut = cut * TRIM_SLICE_MM;
  return points.filter((p) => p.y >= yCut).map((p) => ({ ...p, y: p.y - yCut }));
}

/**
 * Rotate the flattened foot so its long axis runs up +y with the heel at
 * y = 0 — the frame widthAcrossFootBand expects. The axis comes from PCA.
 * Heel/toe disambiguation: the foot's widest cross-section (the ball) sits in
 * the front half, so if the widest slice lands in the rear half we flip.
 */
export function orientHeelAtOrigin<P extends Point>(points: P[]): P[] {
  if (points.length < 3) return points;
  const n = points.length;
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const phi = Math.PI / 2 - theta;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  let rotated = points.map((p) => ({
    ...p,
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  }));

  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of rotated) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  rotated = rotated.map((p) => ({ ...p, y: p.y - minY }));
  const span = maxY - minY;
  if (span <= 0) return rotated;

  const minX = new Array<number>(ORIENT_BINS).fill(Infinity);
  const maxX = new Array<number>(ORIENT_BINS).fill(-Infinity);
  const counts = new Array<number>(ORIENT_BINS).fill(0);
  for (const p of rotated) {
    const bin = Math.min(ORIENT_BINS - 1, Math.floor((p.y / span) * ORIENT_BINS));
    if (p.x < minX[bin]) minX[bin] = p.x;
    if (p.x > maxX[bin]) maxX[bin] = p.x;
    counts[bin]++;
  }
  let widestBin = -1;
  let widest = 0;
  for (let i = 0; i < ORIENT_BINS; i++) {
    if (counts[i] < ORIENT_MIN_POINTS_PER_BIN) continue;
    const w = maxX[i] - minX[i];
    if (w > widest) {
      widest = w;
      widestBin = i;
    }
  }
  if (widestBin >= 0 && (widestBin + 0.5) / ORIENT_BINS < 0.5) {
    rotated = rotated.map((p) => ({ ...p, y: span - p.y }));
  }
  return rotated;
}

export type DepthMeasureDebug = {
  metrics: FootMetrics;
  /** Unprojected cloud size — zero means the depth map was empty/invalid. */
  cloudPoints: number;
  /** Raised points everywhere in frame (pre-clustering). */
  bandPoints: number;
  /** Points in the aimed cluster — what actually gets measured. */
  footPoints: number;
  floorInlierRatio: number;
  /** Phone height above the fitted floor, mm — sanity check on the plane. */
  cameraHeightMm: number;
  /** Raw depth at the map centre, mm — what the sensor itself says is below the phone. */
  centerDepthMm: number;
  /** Effective focal length in depth-map pixels — scale sanity (expect ~190 for ARKit). */
  fxPx: number;
  /** Angle between the fitted plane and the true horizontal from gravity; ~0° = real floor. */
  gravityTiltDeg: number | null;
};

function frameDiagnostics(frame: DepthFrame) {
  const center =
    frame.depthMm[Math.floor(frame.height / 2) * frame.width + Math.floor(frame.width / 2)];
  return {
    centerDepthMm: Number.isFinite(center) ? center : 0,
    fxPx: frame.intrinsics.fx,
  };
}

function gravityTilt(plane: FloorPlane, frame: DepthFrame): number | null {
  const g = frame.gravity;
  if (!g) return null;
  const len = Math.hypot(g.x, g.y, g.z);
  if (len < 1e-6) return null;
  // The fitted normal points toward the camera; a true floor's normal is
  // exactly opposite gravity.
  const cos =
    -(plane.normal.x * g.x + plane.normal.y * g.y + plane.normal.z * g.z) / len;
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/**
 * Full pure pipeline: depth frame → floor plane → foot points → oriented
 * floor-mm contour → FootMetrics, reusing the device-validated
 * widthAcrossFootBand from the paper pipeline. Native capture is the only
 * part that lives outside this function. The debug variant exposes the
 * intermediate signals for the depth debug screen.
 */
export function measureFootFromDepthFrameDebug(
  frame: DepthFrame,
  options: PlaneFitOptions & { stride?: number; calibrate?: boolean } = {},
): DepthMeasureDebug {
  const { stride = 1, calibrate = true, ...planeOptions } = options;
  const diagnostics = frameDiagnostics(frame);
  const points = depthFrameToPoints(frame, stride);
  const plane = fitFloorPlane(points, planeOptions);
  if (!plane) {
    return {
      metrics: ZERO,
      bandPoints: 0,
      footPoints: 0,
      floorInlierRatio: 0,
      cameraHeightMm: 0,
      gravityTiltDeg: null,
      ...diagnostics,
      cloudPoints: points.length,
    };
  }

  const partial = {
    cloudPoints: points.length,
    floorInlierRatio: plane.inlierRatio,
    cameraHeightMm: plane.dMm,
    gravityTiltDeg: gravityTilt(plane, frame),
    ...diagnostics,
  };
  const band = segmentFootPoints(points, plane);

  // Aim point: the frame-centre ray projected onto the floor (the guide box
  // centres the foot there). If the centre pixel has no depth, fall back to
  // the spot directly beneath the phone — the floor frame's origin.
  const basis = planeBasis(plane.normal);
  const target =
    diagnostics.centerDepthMm > 0
      ? projectToFloorMm(
          plane,
          basis,
          unprojectPixel(
            Math.floor(frame.width / 2),
            Math.floor(frame.height / 2),
            diagnostics.centerDepthMm,
            frame.intrinsics,
          ),
        )
      : { x: 0, y: 0 };
  const foot = pickAimedCluster(band, target);
  if (foot.length < MIN_FOOT_POINTS) {
    return { ...partial, metrics: ZERO, bandPoints: band.length, footPoints: foot.length };
  }

  // Orient, amputate the leg's occlusion shadow off the rear, then re-orient:
  // the shin skews the first PCA axis, so the axis is re-derived from the
  // surviving foot-only points before measuring.
  const trimmed = trimLegShadow(orientHeelAtOrigin(foot));
  if (trimmed.length < MIN_FOOT_POINTS) {
    return { ...partial, metrics: ZERO, bandPoints: band.length, footPoints: trimmed.length };
  }
  const oriented = orientHeelAtOrigin(trimmed);
  let lengthMm = 0;
  for (const p of oriented) {
    if (p.y > lengthMm) lengthMm = p.y;
  }
  let widthMm = widthAcrossFootBand(oriented, lengthMm);
  if (lengthMm <= 0 || widthMm <= 0) {
    return { ...partial, metrics: ZERO, bandPoints: band.length, footPoints: foot.length };
  }
  if (calibrate) {
    const pixelPitchMm = plane.dMm / frame.intrinsics.fx;
    lengthMm += LENGTH_EDGE_EROSION_PX * pixelPitchMm;
    widthMm += WIDTH_EDGE_EROSION_PX * pixelPitchMm;
  }

  const aspect = lengthMm / Math.max(widthMm, 1);
  const floorScore = rangeScore(plane.inlierRatio, FLOOR_INLIER_GOOD_MIN, 1);
  const footScore = rangeScore(aspect, ASPECT_MIN, ASPECT_MAX);
  const confidence = Math.max(0, Math.min(1, floorScore * footScore));
  return {
    ...partial,
    metrics: { lengthMm, widthMm, confidence },
    bandPoints: band.length,
    footPoints: trimmed.length,
  };
}

export function measureFootFromDepthFrame(
  frame: DepthFrame,
  options: PlaneFitOptions & { stride?: number; calibrate?: boolean } = {},
): FootMetrics {
  return measureFootFromDepthFrameDebug(frame, options).metrics;
}
