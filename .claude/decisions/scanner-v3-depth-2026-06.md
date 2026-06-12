# Scanner v3: paperless depth scan — groundwork (2026-06-12)

## Why now

Scanner v2 passed full device validation today (length 265 and width 110,
both matching the user's tape — see `scan-width-band-2026-06.md`), which was
the stated gate for starting v3. User's device is an iPhone 15 Pro Max, so
LiDAR is available.

## Architecture

The deliberate design move: **v3 changes capture, not measurement.** The
depth pipeline's job is to produce the same artefact the paper pipeline
produces after homography — a foot contour in floor-plane mm coordinates,
heel at y = 0, long axis up +y — and then reuse the device-validated
`widthAcrossFootBand` and max-extent length unchanged.

Pure pipeline (`lib/scanner/depth/`, no native imports, all unit-tested on
synthetic depth frames):

1. `pointCloud.ts` — pinhole unprojection of the depth map (mm, row-major)
   into a camera-space cloud.
2. `planeFit.ts` — RANSAC + least-squares floor plane (seeded, deterministic
   in tests); heights above floor; projection into floor-mm coordinates.
3. `footFromDepth.ts` — keep points 10–120 mm above floor (cuts shin/calf,
   keeps ankle — the 30–95% width band defends against ankle exactly as on
   paper), PCA orientation with widest-slice heel/toe disambiguation,
   `FootMetrics` out with floor-quality × aspect confidence.

Boundary (`depthAdapter.ts`): screens get a `DepthAdapter` with
`captureDepthFrame()`; only a future `arkitDepthAdapter.ts` may import the
native bridge — same rule as `VisionAdapter`/`visionKitAdapter`.

## Open questions for the device phase

- **Heel anchor.** Paper gave the heel a physical datum (the paper edge). In
  depth the heel is just the contour's rear extreme — a calf leaning backward
  could stretch length. Candidate fixes if real captures show it: use the
  gravity vector to tighten the height cap, or anchor on the heel's floor
  contact. Don't guess; wait for real frames.
- **ARKit depth at close range**: sceneDepth is 256×192 and smoothed;
  LiDAR's minimum range (~250 mm) constrains how low the phone can hover.
  Capture height needs device experiments (likely 500–700 mm).
- **Confidence semantics differ from v2** (floor-inlier × aspect vs paper
  calibration × heel votes). The 0.85 trust gate does NOT transfer; v3 needs
  its own threshold fitted against device captures.
- Native work when it starts: extend `modules/footfit-vision` with an ARKit
  session (sceneDepth + intrinsics scaled to depth resolution + gravity),
  metres→mm at the bridge.

## Status

- Branch `worktree-scanner-v3-depth` (based on main + validated width fix).
- Pure math + tests shipped: 9 new tests, suite at 275 green. Synthetic
  scenes cover clean foot, bare floor, ankle-lobe contamination, and both
  foot orientations.
- Native ARKit capture shipped (`FootfitDepthModule.swift`), plus a live
  `FootfitDepthARView` (camera feed + ~4 Hz centre-depth/tilt events) driving
  a height-coach on the dev-only `DepthDebugScreen` (green at 50–70 cm,
  <12° tilt). `arkitDepthAdapter` is the sole bridge importer.

## First device session (2026-06-12 evening, iPhone 15 Pro Max)

Iterated live against the user's foot (tape ground truth ~265 × 110). Each
failure mode met on device now has a unit-tested defence:

1. **Everything-raised-is-foot** → 975 mm "foot" (other foot + shin joined
   in). Fix: cluster raised points on a 25 mm floor grid, measure only the
   cluster nearest the frame-centre aim point (`pickAimedCluster`).
2. **Black fabric** (trousers): sceneDepth is RGB-fused and invents smooth
   ramps on laser-absorbing cloth → 695 mm. Fix: bridge ships ARKit's
   per-pixel confidence map; low-confidence pixels are dropped.
   High-only proved too strict (edges are medium → contour eroded to
   196 × 95); medium+ is the setting.
3. **Toes are thinner than 10 mm** (and sink into carpet) → length
   under-read. Foot height floor lowered to 6 mm.
4. **Leg occlusion shadow** is connected to the foot, so clustering can't
   remove it → 353 median. Fix (`trimLegShadow`): rear slices whose points
   hover (no meaningful low fraction) are amputated; the heel survives
   because it touches the floor. "Any low point" was not enough — bright
   light adds a thin floor-blended halo along the shin (~10% of a slice), so
   the rule is ≥20% low points.

**End of session: median 258.8 × 98.3 over 7 captures on hard floor in good
light** (length within ~6 mm; occasional low-confidence dud frames are
median-resistant — production flow should burst-and-median like v2).

## Next session

- ~~Fresh ground truth~~ **Done same night: right foot = 263 × 107 by
  pen/ruler** (the old 255 figure was retracted as a mismeasurement — same
  right foot all along; ALL scanner validation to date is right-foot).
- ~~Width bias~~ **Fitted same night**: edge-pixel erosion compensation in
  pixel units scaled by pixel pitch (`LENGTH_EDGE_EROSION_PX = 1.2`,
  `WIDTH_EDGE_EROSION_PX = 2.5`, fitted at ~3.5 mm/px from raw medians
  258.8 × 98.3 vs 263 × 107). **In-sample fit, n=1 foot** — needs
  out-of-sample validation: the user's LEFT foot (believed slightly larger)
  is the natural first independent test.
- Then: burst capture + median, v3 trust threshold from real confidence
  values, and capture-condition guidance (hard floor beats carpet; ambient
  light helps the RGB-fused depth).
