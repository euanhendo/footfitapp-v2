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
- Native one-shot ARKit capture shipped (`FootfitDepthModule.swift`: warm-up
  frames, sceneDepth → base64 Float32 metres, intrinsics rescaled to the
  depth grid, gravity in the maths' camera convention), with
  `arkitDepthAdapter` as the sole bridge importer and a dev-only
  `DepthDebugScreen` for instrumented captures.
- **Unvalidated on device.** Next hardware session: capture over a real foot,
  compare to tape (~265 × 110), tune capture height guidance, then fit the
  v3 trust threshold from real confidence values.
