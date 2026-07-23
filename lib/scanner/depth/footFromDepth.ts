import { rangeScore, widthAcrossFootBand } from '../footMetrics';
import { FootMetrics, Point } from '../types';
import { depthFrameLowConfPoints, depthFrameToPoints, unprojectPixel } from './pointCloud';
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

// Heel-shape trust factor — the v3 analogue of v2's TRUST_MIN_CONFIDENCE gate,
// fitted from real device negatives (saved frames 2026-06-16). A leaning shin
// corrupts the heel AT CAPTURE TIME: the true shin (>120 mm) is removed by the
// height cap, leaving a thin sparse smear behind the ankle instead of a rounded
// heel — the heel datum is simply not in the data, so no heuristic recovers the
// real length (replayed leaning frames read 308–358 vs a 263 mm foot). The note
// from the first replayed frame (2026-06-15) was decisive: reject, don't repair.
// The reject signal that IS present: the oriented contour's rear band is a thin
// tail (<~20 mm wide) for a leaning leg, vs a real heel (~55–70 mm). Thresholds
// are anatomical, not tuned to the negatives: a foot heel is never < 20 mm and
// reliably > 45 mm wide, so a good capture scores 1 by construction. Measured on
// the ORIENTED contour (pre-anchor) — the anchor re-zeroes onto the wide heel
// and would mask the tail.
const HEEL_BAND_MM = 30;
const TAIL_WIDTH_MM = 20;
const HEEL_WIDTH_MM = 45;

// A v3 capture below this confidence is rejected and reshot (the burst median
// keeps only trusted frames), mirroring v2's TRUST_MIN_CONFIDENCE = 0.85. Set
// at 0.8 from the real negatives: stubby forefoot-dropout frames score 0.43–0.62
// on aspect alone, leaning frames score ~0 on heel-shape, and a clean foot
// (heel ≥45 mm, aspect ~2.4) scores ~1. NOTE: validated against negatives only —
// confirm the accept path against a clean saved frame before trusting it live.
export const TRUST_MIN_CONFIDENCE_V3 = 0.8;

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

// Length anchor: the toe tips (~15 mm) and heel pad (~25 mm) are the only
// parts of the leg that come near the floor, regardless of stance. So the
// foot's length extent is defined by NEAR-FLOOR points only — the leg,
// however it leans, never gets low and simply cannot vote. The trim above
// still runs first (it cleans the contour for the width/yaw fit), but
// length no longer depends on it succeeding: device bursts 2026-06-13
// flip-flopped 430 ↔ 224 mm purely on leg lean before this anchor.
// Sparse low points (the floor-blended halo along a shin, 1–2 per slice)
// are rejected by a per-slice quorum.
const LOW_POINT_MAX_HEIGHT_MM = 45;
const LOW_ANCHOR_BIN_MM = 10;
const LOW_ANCHOR_MIN_POINTS = 4;

// --- Confidence-aware extremity recovery -------------------------------------
// The dense ball of the foot returns at medium/high confidence and forms a
// reliable core, but the thin near-floor extremities — toe tips (~15 mm) and
// the heel pad (~25 mm) — sit on a sharp depth cliff down to the floor that the
// RGB-fused LiDAR resolves only at LOW confidence, so depthFrameToPoints drops
// them and length truncates tip-to-tip (good-pose device set 2026-06-17: cores
// read 185–248 vs a 263 mm foot, width unaffected). The global confidence floor
// CANNOT be lowered — that re-admits distant invented floor depth and explodes
// length to ~600 mm. Instead we region-grow the foot OUT from its high-conf core
// and admit only the low-confidence points that are (a) NEAR THE FLOOR — the
// sole contact, not the hovering occlusion shadow behind a leaning heel,
// (b) INSIDE the core's own width envelope — so a leaning leg / ankle lobe can't
// re-enter sideways (width is already solved), and (c) spatially CONTIGUOUS with
// the core out to a bounded per-end reach — so the smear leading off to distant
// floor noise is cut at the gap. Anatomically grounded, not fitted to 263: a
// real heel/toe is a dense run that fades within a few cm of the ball; a lean
// shadow or floor smear is either out of the width envelope, sparse near-floor,
// or never fades, and is rejected by (a)/(b)/(c).
const RECOVERY_NEAR_FLOOR_MM = 25; // toe tip ~15, heel pad ~25 touch the floor; the leg hovers above
const RECOVERY_PERP_MARGIN_MM = 15; // edge pixels blend a little past the core
const RECOVERY_BIN_MM = 8; // contiguity granularity along the long axis
const RECOVERY_GAP_BINS = 2; // ≥16 mm of empty bins ends the extremity (the gap)
const RECOVERY_BIN_MIN_POINTS = 2; // a bin below this is "empty" for the gap test
const RECOVERY_END_CAP_MM = 40; // a toe/heel adds at most this beyond the ball
const RECOVERY_MIN_END_POINTS = 12; // sparse smears never reach this — recover nothing
const RECOVERY_LOCAL_END_MM = 40; // core depth used to re-centre the width fill

// Toe tips press flat against the floor. Device frames 2026-07-23 (shin-brace
// capture, truth 263): real toe-tip points sat at 3–5 mm — BELOW the
// segmentation band's 6 mm floor — at HIGH confidence, so neither the band nor
// the low-confidence complement ever showed them to recovery and length
// truncated at the ball. This sub-band slice (2 mm keeps flat-floor noise out)
// exists only as recovery INPUT — recovery's contiguity/envelope/cap bounds
// still decide what gets in; nothing below FOOT_MIN_HEIGHT_MM joins the core
// any other way.
const RECOVERY_SUB_BAND_MIN_MM = 2;
// Sub-band points are floor-adjacent, and some floors (negative frame4) throw a
// dense 2–5 mm blended apron that can fake a whole heel. So they may only vote
// as TOE TIPS: a short reach past the core, in a narrow tip-shaped run — never
// a wide slab, never the width fill. Device anatomy: burst#2's real tips sat
// 0–10 mm past the core in a ~30 mm-wide cluster; frame4's apron is 90+ mm wide.
const SUB_BAND_REACH_CAP_MM = 12;
const SUB_BAND_MAX_WIDTH_MM = 45;
const SUB_BAND_MIN_END_POINTS = 6;

// Toe-presence trust signal: the front TOE_BAND_MM of the oriented contour
// must contain at least one point near the floor — a touching toe tip (device
// 2026-07-23: 3–5 mm; June good-pose set: ≤10 mm). A forefoot-dropout frame's
// front band is the hovering dorsum (~20 mm+), which scores 0 and rejects the
// confidently-short read. Ramp matches rangeScore: 1 through 12 mm, 0 by 18.
const TOE_BAND_MM = 15;
const TOE_TIP_MAX_HEIGHT_MM = 12;

/** Near-floor samples below the segmentation band, as extremity-recovery input. */
export function subBandFloorSamples(points: Vec3[], plane: FloorPlane): FootSample[] {
  const basis = planeBasis(plane.normal);
  const out: FootSample[] = [];
  for (const p of points) {
    const h = heightAboveFloorMm(plane, p);
    if (h < RECOVERY_SUB_BAND_MIN_MM || h >= FOOT_MIN_HEIGHT_MM) continue;
    out.push({ ...projectToFloorMm(plane, basis, p), hMm: h });
  }
  return out;
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.round(q * (sorted.length - 1))));
  return sorted[idx];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// How far the foot reaches past a core end, in mm, or null if there is no real
// extremity there. `cands` is pre-filtered to near-floor, in-envelope points;
// we bin them by reach past the edge, walk outward, and stop at the first ≥16 mm
// gap (foot → distant floor) or the per-end cap. A real extremity is a
// contiguous run; a sparse smear never clears RECOVERY_MIN_END_POINTS → null.
function reachFrontier(
  edgeS: number,
  dir: number,
  cands: { s: number; pt: FootSample }[],
  subCands: { s: number; perp: number }[] = [],
): number | null {
  const nb = Math.ceil(RECOVERY_END_CAP_MM / RECOVERY_BIN_MM);
  const binReaches: number[][] = Array.from({ length: nb }, () => []);
  for (const c of cands) {
    const reach = dir * (c.s - edgeS);
    if (reach <= 0 || reach > RECOVERY_END_CAP_MM) continue;
    binReaches[Math.min(nb - 1, Math.floor(reach / RECOVERY_BIN_MM))].push(reach);
  }
  // Sub-band (below the segmentation floor) bins are tracked separately and
  // count as solid only under the toe-tip shape rules — see SUB_BAND_* above.
  const subReaches: number[][] = Array.from({ length: nb }, () => []);
  const subPerps: number[][] = Array.from({ length: nb }, () => []);
  for (const c of subCands) {
    const reach = dir * (c.s - edgeS);
    if (reach <= 0 || reach > SUB_BAND_REACH_CAP_MM) continue;
    const b = Math.min(nb - 1, Math.floor(reach / RECOVERY_BIN_MM));
    subReaches[b].push(reach);
    subPerps[b].push(c.perp);
  }
  const subSolid = (b: number) =>
    subReaches[b].length >= RECOVERY_BIN_MIN_POINTS &&
    Math.max(...subPerps[b]) - Math.min(...subPerps[b]) <= SUB_BAND_MAX_WIDTH_MM;
  let lastSolid = -1;
  let emptyRun = 0;
  for (let b = 0; b < nb; b++) {
    if (binReaches[b].length >= RECOVERY_BIN_MIN_POINTS || subSolid(b)) {
      lastSolid = b;
      emptyRun = 0;
    } else if (++emptyRun >= RECOVERY_GAP_BINS) {
      break;
    }
  }
  if (lastSolid < 0) return null;
  let total = 0;
  let subTotal = 0;
  let frontier = 0;
  for (let b = 0; b <= lastSolid; b++) {
    total += binReaches[b].length;
    for (const r of binReaches[b]) if (r > frontier) frontier = r;
    if (subSolid(b)) {
      subTotal += subReaches[b].length;
      for (const r of subReaches[b]) if (r > frontier) frontier = r;
    }
  }
  if (total >= RECOVERY_MIN_END_POINTS) return frontier;
  // A tips-only extremity: enough sub-band points in a short, narrow run.
  if (subTotal >= SUB_BAND_MIN_END_POINTS && frontier <= SUB_BAND_REACH_CAP_MM)
    return frontier;
  return null;
}

/**
 * Augment the high-confidence core with the trustworthy low-confidence points
 * at its two ends (heel + toe), so length stops truncating at the eroded
 * extremities. Returns points in the input floor-mm frame, so the existing
 * orient → trim → anchor pipeline runs unchanged. See the block comment above
 * for the bounds and why each is anatomical rather than tuned.
 */
export function recoverExtremities(
  core: FootSample[],
  lowConf: FootSample[],
  subBand: FootSample[] = [],
): FootSample[] {
  if (core.length < MIN_FOOT_POINTS || (lowConf.length === 0 && subBand.length === 0))
    return core;

  // Core PCA long axis, in floor-mm. s = along the foot, perp = across it.
  let mx = 0;
  let my = 0;
  for (const p of core) {
    mx += p.x;
    my += p.y;
  }
  mx /= core.length;
  my /= core.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of core) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const along = (p: FootSample) => (p.x - mx) * cos + (p.y - my) * sin;
  const perp = (p: FootSample) => -(p.x - mx) * sin + (p.y - my) * cos;

  // Core along-axis extent, and a robust foot half-width from the perp spread.
  // p5–p95 ignores stray outliers (an ankle lobe can't inflate the gate that
  // keeps the leg out) but spans the ball — the foot's widest part — so the
  // heel/toe, always narrower, fit inside it.
  let sMin = Infinity;
  let sMax = -Infinity;
  const perpAll: number[] = [];
  for (const p of core) {
    const s = along(p);
    if (s < sMin) sMin = s;
    if (s > sMax) sMax = s;
    perpAll.push(perp(p));
  }
  const perpSorted = [...perpAll].sort((a, b) => a - b);
  const perpMid = (percentile(perpSorted, 0.05) + percentile(perpSorted, 0.95)) / 2;
  const halfWidth = (percentile(perpSorted, 0.95) - percentile(perpSorted, 0.05)) / 2 + RECOVERY_PERP_MARGIN_MM;

  // Candidate low-conf points: near the floor (the sole contact, not the leg,
  // which hovers above RECOVERY_NEAR_FLOOR_MM) and inside the foot's width
  // envelope centred on the BALL (perpMid). The wide floor-fan that opens up
  // beyond the toe is offset from this centre and excluded — so it can't push
  // the length frontier out.
  const cands: { s: number; pt: FootSample }[] = [];
  for (const p of lowConf) {
    if (p.hMm > RECOVERY_NEAR_FLOOR_MM) continue;
    if (Math.abs(perp(p) - perpMid) > halfWidth) continue;
    cands.push({ s: along(p), pt: p });
  }
  // Sub-band candidates keep their perp so reachFrontier can apply the
  // tip-shape width rule; the envelope gate is the same ball-centred one.
  const subCands: { s: number; perp: number; pt: FootSample }[] = [];
  for (const p of subBand) {
    if (Math.abs(perp(p) - perpMid) > halfWidth) continue;
    subCands.push({ s: along(p), perp: perp(p), pt: p });
  }
  if (cands.length === 0 && subCands.length === 0) return core;

  // Recover each end in two passes that separate LENGTH from WIDTH. (1) The
  // ball-centred candidates above set the reach frontier — how far the extremity
  // extends — keeping the floor-fan out so length can't run away. (2) A fill
  // re-centred on the LOCAL core perp at that end (the foot curves, so an eroded
  // heel sits off the ball's centre) admits near-floor points only WITHIN the
  // frontier, restoring the heel's full width for the heel-shape trust signal
  // without pushing length past where the centred run actually reached.
  const recovered: FootSample[] = [...core];
  for (const [edgeS, dir] of [[sMax, 1], [sMin, -1]] as const) {
    const frontier = reachFrontier(edgeS, dir, cands, subCands);
    if (frontier === null) continue;
    const localPerps: number[] = [];
    for (const p of core) {
      const reachIn = dir * (along(p) - edgeS);
      if (reachIn <= 0 && reachIn >= -RECOVERY_LOCAL_END_MM) localPerps.push(perp(p));
    }
    const centre = localPerps.length >= 3 ? median(localPerps) : perpMid;
    for (const p of lowConf) {
      if (p.hMm > RECOVERY_NEAR_FLOOR_MM) continue;
      if (Math.abs(perp(p) - centre) > halfWidth) continue;
      const reach = dir * (along(p) - edgeS);
      if (reach > 0 && reach <= frontier) recovered.push(p);
    }
    // Sub-band tips join only within their own short reach and a tip-narrow
    // corridor about the local centre — they extend length, never width.
    for (const c of subCands) {
      if (Math.abs(c.perp - centre) > SUB_BAND_MAX_WIDTH_MM / 2 + RECOVERY_PERP_MARGIN_MM)
        continue;
      const reach = dir * (c.s - edgeS);
      if (reach > 0 && reach <= Math.min(frontier, SUB_BAND_REACH_CAP_MM))
        recovered.push(c.pt);
    }
  }
  return recovered;
}

export function anchorToFloorContact(points: FootSample[]): FootSample[] {
  if (points.length === 0) return points;
  let maxY = 0;
  for (const p of points) {
    if (p.y > maxY) maxY = p.y;
  }
  const bins = Math.max(1, Math.ceil(maxY / LOW_ANCHOR_BIN_MM));
  const lowCounts = new Array<number>(bins).fill(0);
  for (const p of points) {
    if (p.hMm > LOW_POINT_MAX_HEIGHT_MM) continue;
    lowCounts[Math.min(bins - 1, Math.floor(p.y / LOW_ANCHOR_BIN_MM))]++;
  }
  let heelBin = 0;
  while (heelBin < bins && lowCounts[heelBin] < LOW_ANCHOR_MIN_POINTS) heelBin++;
  let toeBin = bins - 1;
  while (toeBin >= 0 && lowCounts[toeBin] < LOW_ANCHOR_MIN_POINTS) toeBin--;
  if (heelBin >= toeBin) return points; // no usable low silhouette — keep everything

  // Precise extents from the low points inside the qualifying bins.
  let heelY = Infinity;
  let toeY = -Infinity;
  for (const p of points) {
    if (p.hMm > LOW_POINT_MAX_HEIGHT_MM) continue;
    const bin = Math.min(bins - 1, Math.floor(p.y / LOW_ANCHOR_BIN_MM));
    if (bin < heelBin || bin > toeBin) continue;
    if (p.y < heelY) heelY = p.y;
    if (p.y > toeY) toeY = p.y;
  }
  if (!Number.isFinite(heelY) || toeY <= heelY) return points;
  return points
    .filter((p) => p.y >= heelY && p.y <= toeY)
    .map((p) => ({ ...p, y: p.y - heelY }));
}

export function trimLegShadow(points: FootSample[]): FootSample[] {
  if (points.length === 0) return points;
  let maxY = 0;
  for (const p of points) {
    if (p.y > maxY) maxY = p.y;
  }
  const bins = Math.max(1, Math.ceil(maxY / TRIM_SLICE_MM));
  const total = new Array<number>(bins).fill(0);
  const low = new Array<number>(bins).fill(0);
  const minX = new Array<number>(bins).fill(Infinity);
  const maxX = new Array<number>(bins).fill(-Infinity);
  const sub = new Array<number>(bins).fill(0);
  for (const p of points) {
    const bin = Math.min(bins - 1, Math.floor(p.y / TRIM_SLICE_MM));
    total[bin]++;
    if (p.hMm <= LEG_ONLY_MIN_HEIGHT_MM) low[bin]++;
    if (p.hMm <= LOW_POINT_MAX_HEIGHT_MM) sub[bin]++;
    if (p.x < minX[bin]) minX[bin] = p.x;
    if (p.x > maxX[bin]) maxX[bin] = p.x;
  }
  // A rear slice is kept despite failing the low-point quorum ONLY when it is
  // simultaneously heel-wide AND a meaningful FRACTION of it sits below
  // LOW_POINT_MAX_HEIGHT_MM — the visible sides of an occluded heel.
  // Shin-brace capture 2026-07-23: the camera parked over the ankle hides the
  // rear heel pad's floor contact, so those slices fail the quorum yet span
  // ~90 mm with half their points at 20–45 mm. The two impostors both fail:
  // a shin lying across the frame is wide but HOVERS (near-zero sub-ankle
  // points), and a crisp-light shin's floor-blended halo is only ~10% of a
  // slice — below the fraction bar.
  const heelLike = (bin: number) =>
    total[bin] >= 3 &&
    maxX[bin] - minX[bin] >= HEEL_WIDTH_MM &&
    sub[bin] >= Math.max(3, Math.ceil(total[bin] * 0.25));
  let cut = 0;
  while (
    cut < bins &&
    low[cut] < Math.max(2, total[cut] * FOOT_LOW_POINT_FRACTION) &&
    !heelLike(cut)
  )
    cut++;
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

/**
 * Widest cross-foot span within HEEL_BAND_MM of the heel datum (y = 0) of an
 * oriented contour. A real heel fills this band (~55–70 mm); a leaning leg's
 * floor-blended occlusion smear leaves only a thin tail (<~20 mm). Max (not
 * mean) so a sparse-but-present heel still registers; needs ≥3 points so a
 * stray pixel can't fake a heel.
 */
export function rearBandWidth(points: Point[]): number {
  let min = Infinity;
  let max = -Infinity;
  let n = 0;
  for (const p of points) {
    if (p.y > HEEL_BAND_MM) continue;
    if (p.x < min) min = p.x;
    if (p.x > max) max = p.x;
    n++;
  }
  return n >= 3 ? max - min : 0;
}

/** 0 (tail, no heel datum) → 1 (full heel) from the rear-band span. */
export function heelShapeScore(rearWidthMm: number): number {
  return Math.max(0, Math.min(1, (rearWidthMm - TAIL_WIDTH_MM) / (HEEL_WIDTH_MM - TAIL_WIDTH_MM)));
}

export type DepthMeasureDebug = {
  metrics: FootMetrics;
  /** Cross-foot span of the oriented contour's rear band — heel vs leg-tail. */
  rearHeelWidthMm: number;
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
      rearHeelWidthMm: 0,
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
    rearHeelWidthMm: 0,
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
  const aimed = pickAimedCluster(band, target);
  if (aimed.length < MIN_FOOT_POINTS) {
    return { ...partial, metrics: ZERO, bandPoints: band.length, footPoints: aimed.length };
  }
  // Recover the eroded near-floor extremities (toe tips + heel pad) that the
  // confidence filter dropped, so length stops truncating short. Bounded so the
  // leg and distant floor noise can't re-enter — see recoverExtremities. The
  // recovery input also includes sub-band points from BOTH confidence classes:
  // flat toe tips sit at 3–5 mm, below the segmentation floor, and are dropped
  // by height — not confidence — so the low-conf complement alone misses them.
  const lowPts = depthFrameLowConfPoints(frame, stride);
  const lowBand = segmentFootPoints(lowPts, plane);
  const subBand = subBandFloorSamples(points, plane).concat(
    subBandFloorSamples(lowPts, plane),
  );
  const foot = recoverExtremities(aimed, lowBand, subBand);

  // Orient, amputate the leg's occlusion shadow off the rear, then re-orient:
  // the shin skews the first PCA axis, so the axis is re-derived from the
  // surviving foot-only points before measuring.
  const trimmed = trimLegShadow(orientHeelAtOrigin(foot));
  if (trimmed.length < MIN_FOOT_POINTS) {
    return { ...partial, metrics: ZERO, bandPoints: band.length, footPoints: trimmed.length };
  }
  const oriented = orientHeelAtOrigin(trimmed);
  // Heel-shape trust signal, read off the oriented contour before the anchor
  // re-zeroes onto the wide heel (which would hide a leaning leg's thin tail).
  const rearHeelWidthMm = rearBandWidth(oriented);
  const anchored = anchorToFloorContact(oriented);
  if (anchored.length < MIN_FOOT_POINTS) {
    return { ...partial, rearHeelWidthMm, metrics: ZERO, bandPoints: band.length, footPoints: anchored.length };
  }
  let lengthMm = 0;
  for (const p of anchored) {
    if (p.y > lengthMm) lengthMm = p.y;
  }
  // Toe-presence trust signal: real toe tips touch down near the floor at the
  // very front of the contour. When the forefoot drops out (June's goodpose-28/
  // 19 pattern) the front-most band is the hovering dorsum instead, and the
  // frame under-reads while sailing through the other gates — the exact
  // confidently-short failure a burst median must not swallow.
  let toeTipMinHMm = Infinity;
  for (const p of anchored) {
    if (p.y >= lengthMm - TOE_BAND_MM && p.hMm < toeTipMinHMm) toeTipMinHMm = p.hMm;
  }
  let widthMm = widthAcrossFootBand(anchored, lengthMm);
  if (lengthMm <= 0 || widthMm <= 0) {
    return { ...partial, rearHeelWidthMm, metrics: ZERO, bandPoints: band.length, footPoints: foot.length };
  }
  if (calibrate) {
    const pixelPitchMm = plane.dMm / frame.intrinsics.fx;
    lengthMm += LENGTH_EDGE_EROSION_PX * pixelPitchMm;
    widthMm += WIDTH_EDGE_EROSION_PX * pixelPitchMm;
  }

  // Confidence is the product of three independent trust signals, each a soft
  // 0–1 ramp: a real floor (inlier ratio), a foot-shaped aspect, and a real
  // heel (not a leaning leg's tail). A frame must look right on all three —
  // the leaning over-reads pass aspect but die on heel-shape, the forefoot-
  // dropout under-reads pass heel-shape but die on aspect.
  const aspect = lengthMm / Math.max(widthMm, 1);
  const floorScore = rangeScore(plane.inlierRatio, FLOOR_INLIER_GOOD_MIN, 1);
  const footScore = rangeScore(aspect, ASPECT_MIN, ASPECT_MAX);
  const heelScore = heelShapeScore(rearHeelWidthMm);
  const toeScore = rangeScore(toeTipMinHMm, 0, TOE_TIP_MAX_HEIGHT_MM);
  const confidence = Math.max(
    0,
    Math.min(1, floorScore * footScore * heelScore * toeScore),
  );
  return {
    ...partial,
    rearHeelWidthMm,
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
