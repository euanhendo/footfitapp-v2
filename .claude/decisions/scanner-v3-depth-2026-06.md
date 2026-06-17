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

## Where night one ended (00:19, 2026-06-13)

- **Width is solved.** Calibrated width read 109.0 / 111.7 / 108–113 across
  every stance, floor, and lighting tried all night vs ruler truth 107–110.
- **Length heel-datum is THE open problem.** Floor-contact anchoring did not
  stabilise it (medians 203.7 / 148.5, one 392 capture): where the arch
  hovers, too few low points → real foot amputated; where the shin halo is
  dense, too many → leg admitted. Slice-local rules with one threshold
  cannot serve both — stop tuning them.
- **Next design, not next dial: ankle-saddle detection.** The height profile
  along the foot axis always dips between instep and shin; cut at that
  global saddle, then take the rearmost low point behind it as the heel.
- **00:27 closing result — stance is the dominant factor.** Coached
  straight-leg bursts: upright at 5° tilt read **261.2 × 109.3 vs ruler
  263 × 107–110** (length −1.8 mm, width dead on); a slight lean at 9° tilt
  read 285.6. Production conclusion: the math is ruler-grade when the shin
  is vertical, so v3's flow must coach stance hard (v2's guide-lock lesson
  repeating) — tighten the tilt gate (5° good / 9° bad) and build the
  ankle-saddle cut as the safety net for users who lean anyway.
- **Coaching copy, in the user's own words** (he found the achievable cue —
  "stand up straight" is impossible while aiming a phone at your own foot):
  *soft bend in the knee, push the knee forward so it stacks directly over
  your ankle — shin vertical, body leaning is fine.* Use this phrasing as
  the basis for the production stance coaching.

## Frame export + first replayed real frame (2026-06-15)

Added a **Save frame** button (`captureRawDepthFrameForExport` →
`expo-file-system`/`expo-sharing` → AirDrop) so real captures replay offline
through the exact decode path. First leaning-leg frame
(`depthframe-2026-06-15T14-00-49Z`, pose tilt 4.8°, pipeline read
358 × 111 vs the same session's straight-leg burst 265.8 × 110.3) decoded and
profiled by y-bin (height + cross-foot width):

- y 200–360: width ~100 mm — real foot body + toes (dense, full width)
- y 160–190: width 23–52 mm, height ~119 mm — ankle / lower shin
- y 0–130: width 1–12 mm, sparse — the leg's floor-blended occlusion fringe

**Decisive finding (only real data could show this): a leaning capture
corrupts the heel at capture time.** The true shin (>120 mm) is removed by
the height cap, leaving a thin sparse smear behind the ankle instead of a
rounded heel — the heel datum is simply *not in the data*. The forefoot is
clean (~187 mm dense) but the heel is gone, so NO heel-cut/ankle-saddle
heuristic can recover 263 from this frame. This vindicates abandoning the
ankle-saddle approach.

**Strategy flip — reject, don't repair (v2's trust-gate lesson again).**
Leaning frames should be REJECTED so a burst median keeps only clean reads
(the 298 median in-session was good+bad mixed; rejecting the bad ones yields
~265). Tilt gate alone won't catch it (this frame was 4.8°, leg leaned with
the phone flat). The reject signal that IS present: the contour's rear end is
a thin tail (<~15 mm wide) instead of a heel (~60–70 mm wide). Implement a
v3 trust gate on "rear-width is heel-shaped", validated against a small
labelled set of saved frames — do NOT tune it on this single frame.

## Next session

- ~~Fresh ground truth~~ **Done same night: right foot = 263 × 107 by
  pen/ruler** (the old 255 figure was retracted as a mismeasurement — same
  right foot all along; ALL scanner validation to date is right-foot).
- ~~Width bias~~ **Fitted same night**: edge-pixel erosion compensation in
  pixel units scaled by pixel pitch (`LENGTH_EDGE_EROSION_PX = 1.2`,
  `WIDTH_EDGE_EROSION_PX = 2.5`, fitted at ~3.5 mm/px from raw medians
  258.8 × 98.3 vs 263 × 107). **In-sample fit, n=1 person** — both his feet
  ruler-measure identical (263 × 107–110; the "left is bigger" belief was
  disproven 2026-06-13), so true out-of-sample validation needs other
  people's feet.
- **2026-06-13 ~00:10, left-foot bursts**: medians flip-flopped 430.7 ↔
  224.0 purely on leg lean — slice-trim alone is stance-fragile. Length is
  now anchored to floor-contact points only (`anchorToFloorContact`: toes
  ~15 mm and heel pad ~25 mm touch the floor; the leg never does, so it
  cannot vote on length regardless of stance; sparse shin-halo low points
  rejected by per-slice quorum). Trim still runs first to clean the contour
  for the width/yaw fit. May shift raw length slightly — re-check
  `LENGTH_EDGE_EROSION_PX` against the next bursts.
- Then: burst capture + median, v3 trust threshold from real confidence
  values, and capture-condition guidance (hard floor beats carpet; ambient
  light helps the RGB-fused depth).

## Trust gate built + a second failure mode found (2026-06-16, replay)

User saved five fresh frames (right foot, truth 263 × 107; intended 2 vertical,
2 leaning, 2 relaxed — one was deleted, so 1/2 vertical, 3/4 leaning, 5 relaxed
by capture-time order). Replayed all five offline through the exact pipeline.
**All five are bad captures** — a clean negative set, but no good frame among
them, so the gate's *accept* path is still unconfirmed.

**Two distinct failure modes, both now rejected by confidence:**

1. **Leaning → thin-tail rear (frames 2, 5, and the 06-15 frame 0).** The
   oriented contour's rear band is a sparse <16 mm tail, not a heel; reads
   308–358. Exactly the predicted signal.
2. **NEW — too much leg in frame / forefoot confidence-dropout (frames 1, 3,
   4).** ASCII occupancy maps of the raw depth showed the shin (>120 mm) fills
   the *entire right half* of every frame, and the forefoot sits in a band of
   low-confidence pixels that the gate drops, *splitting* the foot — clustering
   then keeps only the rear blob → stubby under-reads 157–196 (aspect 1.6–1.9).
   A confidence sweep proved it isn't tunable: min-conf 0 explodes length to
   600–740 mm (phantom depth), min-conf 2 drops more. The fix is capture-side
   (aim coaching: less leg, foot centred), not math. User confirmed the whole
   foot *was* inside the guide box — so the guide box does not correspond to the
   usable depth/height-band region; that mismatch is the real culprit.

**Shipped — heel-shape trust factor (`footFromDepth.ts`).** Confidence is now
`floorScore × footScore × heelScore`, where `heelScore` ramps 0 (rear band
<20 mm = leg tail) → 1 (≥45 mm = real heel), measured by `rearBandWidth` on the
*oriented* contour (pre-anchor, so the anchor can't mask the tail). Thresholds
are anatomical, not fitted — a real heel is never <20 mm and reliably >45 mm, so
a clean foot scores 1 by construction. `TRUST_MIN_CONFIDENCE_V3 = 0.8` (v3's
analogue of v2's 0.85). The two factors are complementary: leaning frames pass
aspect but die on heel-shape; stubby frames pass heel-shape but die on aspect.
`depthTrustGate.test.ts` loads the five real fixtures
(`lib/__tests__/scanner/depth/fixtures/frame1–5.json`) and asserts each is
rejected with the right mechanism. `DepthDebugScreen` now medians **only
trusted frames** (rejects the rest, reshoot prompt) and shows the heel width +
✓TRUST/✗REJECT verdict per capture.

**NEXT (needs device):** (a) save 1–2 *good* frames — phone lower/more side-on
so the shin is a minority of the frame, foot centred — to confirm the gate's
accept path (currently validated on negatives only). (b) Fix the aim: shrink the
live guide box / add an "aim down at the foot, keep the leg out" cue so the shin
stops filling half the sensor. Do NOT tune thresholds against the negatives.

## Aim-down coaching cue + pipeline re-review (2026-06-17, no device)

Re-reviewed the whole depth pipeline against the user's goal of "narrow the
numbers to shippable today." **Finding: there is no math bug left to fix.** All
five saved fixtures are bad captures and the trust gate REJECTS every one
(leaning → heel-shape; leg-in-frame → aspect). The pipeline is not producing
wrong numbers — it is correctly refusing bad input; the math is ruler-grade on a
clean frame (261 × 109 vs 263). So the remaining blocker is not code, it is
**empirical: zero confirmed *good* frames exist, so the gate's accept path has
never fired.** That can only be produced on-device — synthesising it or tuning
thresholds against the negatives is exactly the trap to avoid.

The one code lever that increases the odds of a good frame is capture coaching,
and the live `DepthDebugScreen` coached stance/height/tilt but never said to keep
the leg out of frame — the precise cause of failure mode #2. **Shipped
(`787e389`):** an `AIM_CUE` ("Aim straight down at your foot, not along your leg —
keep your shin out of frame and the whole foot inside the guide") as the leading
top-banner line, with `STANCE_CUE` demoted to a secondary line. tsc/lint clean,
302 tests pass (lib-only suite, unaffected by the screen edit). The guide-box /
depth-FOV shrink stays deferred — it can't be calibrated blind, so do it with the
device in hand.

**Capture gates tightened (`02b0b7f`).** User asked me to dictate the pose and
cut the slack in the green window. Separated the two levers honestly: **tilt is
the accuracy lever** (5° → 261.2, 9° → 285.6 vs 263; length inflates with tilt as
the floor plane skews) so `FLAT_MAX_DEG` 8 → 5; **height is a consistency/framing
lever, not accuracy** (unprojection is distance-invariant — height doesn't bias
the mm; it only changes point density and whether the leg is in frame) so the
window tightened 500–700 (200 mm) → 525–585 (60 mm), lower-centred (~555) for
denser points and a smaller FOV footprint. Did NOT go to the literal 3 cm the
user floated — hand-hold jitter is ±1–2 cm, a 3 cm window would flicker red/green
and never catch; 6 cm is the catchable/precise balance. No measurement math
changed — capture-pose gates only. **The Save-frame payload records each
capture's height+tilt, so the first good frame gives us the proven pose and we
re-centre the window tightly on it — data-driven, not a blind guess.**

**On-screen recipe card (`2b81f94`).** The full 7-step capture recipe now lives
on `DepthDebugScreen` as a dismissible card (open on entry, "Got it" collapses,
toggle pill re-opens) so the user reads it while shooting instead of switching
apps; the live readout also prints the target window. Card + readout derive their
numbers from the gate constants so they can't drift.

**NEXT (device, user's move):** save 1–2 clean frames (phone flat/lens straight
down, foot centred in the guide with the leg out of the near edge, shin vertical,
green height ~52–58 cm, tilt < 5°) and AirDrop them; replay offline and confirm
~263 × 107 clears `TRUST_MIN_CONFIDENCE_V3`. That confirmation — not more code —
is the gate to shippable.

## Post-session work (2026-06-13, no device)

- **Shipped (safe, proven-direction):** persistent on-screen stance cue in
  the user's own words + tilt gate tightened 12° → 8° (`STANCE_CUE`,
  `FLAT_MAX_DEG` in `DepthDebugScreen`), plus burst capture (5 spaced frames
  per tap, medianed). These make the proven straight-leg path the default UX.
- **Ankle-saddle cut: attempted, then reverted — needs device data.** Coded
  `findHeelByAnkleSaddle` (instep-peak → walk rear → heel valley → cut at the
  leg rise) but a synthetic stress test exposed a real flaw: **a leaning shin
  is capped at 120 mm, the instep is only ~70 mm, so "tallest bin = instep"
  picks the leg.** Fixing it means separating leg from foot by floor-contact
  *density* — exactly the threshold (`FOOT_LOW_POINT_FRACTION`) that
  flip-flopped on device tonight. Conclusion: distinguishing a leaning leg
  from the foot in a single frame is genuinely ambiguous (floor-blended edge
  pixels along the shin are real low points), and the thresholds can't be
  tuned blind. Deferred to a device session with captured frames. The
  honest current state: **length is ruler-grade with a vertical shin
  (coached); leaning still over-reads.** Stance coaching is the primary fix,
  ankle-saddle the eventual safety net — build it WITH device frames, not
  against synthetics.
