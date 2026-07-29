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

## Good-pose SET of 5 — accept path fires, but LENGTH is the real open problem (2026-06-17)

User then AirDropped five more, all the "same picture" (committed as
`goodpose-*.json` fixtures + `goodPoseSet.test.ts`, suite 306). Replayed as a set
— this is the most important data yet and it resets the honest status:

| frame | pose | length | width | conf | heel |
|---|---|---|---|---|---|
| 11:59:28 | 583/1.9° | 221 | 106 | **100% ✓** | 75 |
| 12:00:12 | 608/2.1° | 190 | 105 | 78% | 79 |
| 12:00:19 | 611/1.4° | 241 | 108 | **100% ✓** | 53 |
| 12:00:44 | 610/2.7° | 274 | 112 | 61% | 35 |
| 12:00:53 | 604/2.6° | 229 | 111 | 33% | 28 |

- **Accept path CONFIRMED** — two frames clear the 0.8 gate (first time ever). The
  gate isn't broken-shut.
- **WIDTH is genuinely solved** — 105–112 vs truth 107 on every frame, regardless
  of confidence. Shippable.
- **LENGTH is NOT** — 190/221/241/274/229 vs truth 263; the two *accepted* frames
  read 221 and 241, both well short. Pose was perfect and consistent every time
  (tilt 1.4–2.7°), so this is NOT a capture problem the user can fix.
- **Root cause (y-bin profiles):** the dense ball of the foot is captured cleanly
  (hence width), but the point count COLLAPSES past the ball — on the 221 frame,
  137 pts/slice at y150 → 18 at y165 → 4 at y180, then only strays. **The toes
  (and sometimes the heel) are thin, near-floor, depth-discontinuity regions that
  return low confidence and get filtered out.** Length is measured tip-to-tip, so
  it truncates short and swings with how many stray extremity points survive.

**This supersedes the frame6 heel-only framing and the optimistic "ruler-grade
261×109" note** (that was a lucky single frame in a burst): the real, dominant v3
problem is **length under-read from extremity (toe + heel) confidence dropout**,
not stance, not occlusion, not the heel alone. **FIX = confidence-aware extremity
recovery:** region-grow the foot from its high-confidence core to admit
*contiguous* low-confidence points at both ends, bounded so distant floor noise
(which exploded length to 608 at minConf 0) can't re-enter. Build it against the
six committed good-pose frames; it's a real algorithm, not a dial — design it,
don't hack it. Width could ship now; length is the gate to a shippable scan.

## First GOOD-POSE frame — heel eroded by the confidence filter (2026-06-17, replay)

User AirDropped one frame before starting work (`depthframe-2026-06-17T11-15-22Z`,
committed as fixture `frame6-goodpose.json`). **It's the first good-pose capture:
phone flat (tilt 2.5°), height 624 mm, foot body cleanly captured** — yet it's
rejected (confidence 5%, length 248 vs truth 263). Profiled the contour by y-bin
and the cause is decisive and NEW (not pose, not occlusion, not a lifted heel):

- The foot body is textbook (width 83–96 mm, smooth instep→toe height slope).
- The rear is a thin **~12 mm-wide, floor-level (h 6–14 mm) tail** for 45 mm →
  `rearBandWidth` 21 mm → heel-shape score ~0.05 → confidence tanked. Length
  under-reads because the rounded heel is missing.
- **Confidence sweep is the smoking gun:** at the production medium+ filter
  (`minConf 1`) the heel reads 21 mm; **drop the filter to keep-all (`minConf 0`)
  and a full 63 mm heel reappears in the same data.** The heel's floor-contact
  pixels are simply LOW confidence — the sharp heel-to-floor depth cliff is hard
  for the RGB-fused LiDAR to resolve — so the filter erases them. (Can't just
  lower the global floor: `minConf 0` also re-admits distant floor noise and
  explodes length to 608 mm, exactly as the earlier negatives showed.)

**Conclusion:** the user's capture was good; the pipeline is eroding a real heel.
The fix is **confidence-aware heel recovery** — region-grow the foot from its
high-confidence points to admit *contiguous* low-confidence pixels (the heel)
without re-admitting distant floor noise. This is the heel-maths the decision
note always said to build WITH device frames, and frame6 is the first such frame.
**Do NOT build it against this single frame** (the n=1 trap): need 2–3 more
repeat good-pose frames first. Captured as a characterization test
(`frame6Heel.test.ts`, 304 suite) that pins the current eroded behaviour and the
low-conf-heel-exists proof — it will flip to asserting recovery once the fix lands.

**Height window raised for a flat hold (`b38f15a`).** User reported the low
525–585 hold forced a ~90° knee bend, and reaching for it makes you tilt — the
one thing that wrecks accuracy. Since height is accuracy-neutral (unprojection is
distance-invariant) it's the gate to spend on ergonomics, so raised it to
560–720 mm, biased high; tilt stays the strict 5° gate. Also confirmed from the
Swift bridge (`.gravity` world alignment, `flatTiltDeg` = camera-axis vs
straight-down): the measurement is **orientation-agnostic**, so flipping the
phone 180° flat (camera-end toward the leg) is fine and still passes the gate;
only a shin-angled tilt is rejected. The paper-scanner's any-angle freedom does
NOT transfer — it relies on the A4 homography, depth has no such reference.

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

## Confidence-aware extremity recovery BUILT (2026-06-17, replay-validated)

Built the recovery the prior sections called for, designed against all 6 good-pose
frames + the 5 negatives (not n=1, not blind-tuned). New code, all pure
`lib/scanner/depth/*`: `depthFrameLowConfPoints` (pointCloud.ts — the complement of
the medium+ filter) + `recoverExtremities` (footFromDepth.ts), inserted right after
`pickAimedCluster`; everything downstream (orient → trim → anchor) is unchanged.

**Algorithm.** Region-grow the foot OUT from its high-confidence core, admitting
only low-confidence points that are (a) **near the floor** (`hMm ≤ 25` — toe tip
~15, heel pad ~25; the leg hovers above), (b) **inside the foot's width envelope**
(perp within the core's p5–p95 half-width + 15 mm of the ball centre), and (c)
**contiguous** with the core (8 mm bins walked outward, stop at a ≥16 mm gap or a
40 mm per-end cap, require ≥12 points). Two passes separate **length** from
**width**: the ball-centred candidates set the reach frontier (the wide floor-fan
that opens up beyond the toe is offset from the ball centre and excluded, so it
can't extend length); a fill re-centred on the *local* core perp at that end (the
foot curves, so an eroded heel sits off the ball centre) then restores the heel's
full width *within* that frontier, feeding the heel-shape trust signal without
pushing length out. Every bound is anatomical, not fitted to 263.

**Validated replay (right foot, truth 263 × 107):**

| frame | before | after | width | note |
|---|---|---|---|---|
| frame6 (heel-eroded) | 248 | **263** | 105 | length fixed; heel 21→37 mm |
| goodpose-12 | 190 | **224** ✓PASS | 111 | recovered into the trusted set |
| goodpose-28 | 221 ✓ | 221 ✓ | 106 | toe-dropout: no toe in data, left alone |
| goodpose-19 | 241 ✓ | 241 ✓ | 108 | toe-dropout: left alone |
| goodpose-44 | 274 | 274 | 112 | leaning core: unchanged, still rejected |
| goodpose-53 | 229 | 229 | 111 | heel 28, conservative reject |
| frame1–5 (negatives) | — | **byte-identical, all still REJECTED** | | referee green |

**Honest outcome — what's fixed and what isn't.**
- **WIDTH** — solved, untouched (recovery only adds points outside the 30–95% band).
- **HEEL-erosion LENGTH** — fixed. frame6 (the canonical documented case) 248→263;
  goodpose-12 190→224 and now clears the trust gate. The under-read *floor* across
  the good-pose set rose from 190 to ≥221.
- **TOE-dropout (goodpose-28/19)** — NOT recoverable, and recovery correctly does
  nothing: beyond the core the only low-conf points are a wide hollow floor-fan
  (perpRel ±60–120, no centred toe), so the toe is genuinely absent from the depth
  data. This is a **capture limit** (the aim-down cue already shipped targets it),
  not a math bug. These frames pass the gate but read ~221/241.
- **frame6 / goodpose-53 still conservatively REJECTED.** Their reconstructed heel
  (~37/28 mm) is too close to leaning goodpose-44's (35 mm) for the heel-shape gate
  to separate — trusting them would also trust a leaning frame. So length-recovery
  deliberately does **not** loosen the trust gate; the burst keeps the cleaner
  frames. The stated "all 6 cluster at 263 ±12" is therefore **not** achievable from
  this data set: heel-erosion is recoverable, toe-dropout and leg-contamination are
  not — exactly the single-frame ambiguity this note has hit since 2026-06-13.

**Referee + tests.** `depthTrustGate.test.ts` (the 5 negatives) passes UNCHANGED —
the gate was not weakened. `goodPoseSet.test.ts` and `frame6Heel.test.ts` flipped
from pinning the broken behaviour to asserting the fix (width unchanged; under-read
floor lifted ≥215 and bounded <285; frame6 length 255–272 + heel >33, with an
explicit assert that its trust stays conservative). 306 tests green, tsc + lint clean.

**NEXT (device, user's move):** the remaining gap is capture quality, not code —
save good-pose frames where the **whole foot incl. toe** is inside the depth FOV
(aim straight down, leg out, foot centred), AirDrop, replay. With the toe present,
recovery + the existing pipeline should land ~263 on a *trusted* frame. Do NOT keep
tuning recovery thresholds against this set — heel-erosion is solved; toe presence
is now a capture problem.

## 2026-07-23 — shin-brace capture + toe recovery + toe-presence gate

**Capture protocol found (user-invented, validated):** seated, foot flat and
weighted, top edge of the phone braced against the shin — the camera sits in
front of the shin so the leg physically cannot enter the frame, the pose is
rock-steady (tilt ~1.3°), and the heel lands wide (~97 mm) in the rear band.
First protocol ever to produce TRUSTED frames. Freehand-over-midfoot was
retested head-to-head the same day: unstable (169–513 mm across one burst),
still loses to the brace. Fixtures: `shinbrace-16-48-{1,2}.json` (+
`shinBraceSet.test.ts`).

**Probe finding that redirected the work:** the trusted frames' toe tips WERE
in the depth bytes — 9–10 HIGH-confidence points at 3–5 mm — below the 6 mm
segmentation floor. June's "toe genuinely absent" conclusion was correct for
June's aim-along-leg captures but wrong for brace captures; the filter that
dropped these tips was height, not confidence.

**Pipeline changes (all pure, `footFromDepth.ts`):**
1. `subBandFloorSamples` — 2–6 mm points from BOTH confidence classes feed
   `recoverExtremities` as a third input, admitted only as toe TIPS: reach
   ≤ 12 mm, run ≤ 45 mm wide, ≥ 6 points, never the width fill. Floor-apron
   guard: negative frame4's floor throws a dense 2–5 mm blended apron that
   faked a 99 mm heel in the first unconstrained attempt — the tip-shape
   rules exist because of it, not aesthetics.
2. `trimLegShadow` keeps a rear slice that fails the low-point quorum only if
   heel-wide (≥45 mm) AND ≥25% of it sits below 45 mm (occluded heel's
   visible sides). Width alone re-admitted frame4's lying-across shin; the
   fraction bar is what kept all 5 negatives rejected.
3. Toe-presence trust signal: `toeScore = rangeScore(min h in front 15 mm,
   0, 12)` multiplied into confidence. Catches a front band that hovers
   (forefoot dropout). KNOWN LIMIT: June's trusted-short frames (221–232)
   still pass — their truncated front edge has blended low pixels. A
   front-band-width discriminator was considered and postponed: the egg-foot
   synthetic (widest at toe end) would need remodelling first.
4. Synthetic scenes got realistic soles (taper to 3 mm edge, fixed-point
   ray intersection) — the toe gate demands anatomy the old slabs lacked.
   Three synthetic tolerances widened (tapered edges cost a few mm at coarse
   pixel pitch); real-frame fixtures are the accuracy referee.

**Result:** shin-brace frames 244→248.9 / 249→253.5, trusted, width 104–106.
309 tests green. **Honest residual vs 263:** (a) the camera parked over the
ankle occludes the last ~10 mm of rear heel pad — probed, zero data there;
(b) sub-2 mm toe-tip edges are below LiDAR's floor. Next cheap experiment:
brace the phone a few cm further down the shin / toward the toes so the
camera sits just FORWARD of the ankle — un-occludes the heel rear while
keeping the brace geometry. Do NOT close the residual by inflating
LENGTH_EDGE_EROSION_PX against n=1 foot.

## 2026-07-29 — forward-brace falsified; anatomical trust envelopes shipped

Height-ladder session (user live, 15 bursts: heel-angle shots, straight-down
forward positions at 56/60/61/65/70 cm, POV screenshot). Verdict on June's
"brace forward of the ankle" idea: **falsified — it makes occlusion worse.**

**Geometry (now understood):** the ankle shadow scales with the camera's
forward offset. Over the ankle (July protocol) the heel loses ~10 mm; a few
cm forward, the shin lies IN frame along the foot axis (user's screenshot
shows the heel fully buried) and the loss grows to ~50 mm. Failure modes by
height, all replayed offline: 56 cm → shin merges lengthwise (333–494 mm
reads); 60–61 cm → trusted-shorts at 196–224 with a REAL-looking 85 mm rear
(the leg-trim cut edge — heel-shape gate can't tell a truncated heel from a
round one); 65–70 cm → phantom floor-level streak 40–80 mm behind the heel
(edge flare off the leg) inflating reads to 296–336, twice landing within
1 mm of truth (263.2, 264.1) — treat any lucky-length rear-tail frame as
this artifact. One frame (15:01 f2) genuinely saw sparse heel pad past the
ankle (9 pts, 87–91 mm slices) with the contour ORIENTATION FLIPPED (leg
mid-contour defeats heel-at-origin); not reproducible in follow-ups.

**Shipped (both device-motivated, anatomy-principled, NOT fixture-tuned):**
- `b8f558a` widthScore: anatomical width envelope 70–130 mm — kills
  foot+leg blobs that keep a foot-like aspect at double scale (trusted
  322–462 × 167–218 before the fix).
- `f6595ff` lengthScore: anatomical length envelope 140–330 mm — kills
  lengthwise shin merges with normal width (trusted 361 × 121 before).
All 313 tests green; the 5 negative fixtures and every previously-trusted
frame replay byte-identically.

**Standing conclusions:** (1) July over-ankle shin-brace stays the capture
protocol; its ~10 mm heel residual is a physical sensor limit, not worth
more camera-position experiments. (2) Dominant accuracy bug is now
trusted-shorts — BOTH variants: toe-truncated (June 221–232) and the new
heel-truncated (206–224 passing heelScore via the wide trim edge). Next
code work: egg-foot synthetic remodel, then end-truncation discriminators.
(3) DepthDebugScreen coach gap: "Good — hold steady" checks height/tilt
only; the shin-out-of-frame cue is unenforced (and physically impossible
from the seated forward position). (4) Replay harness pattern: temp jest
test decoding `~/Downloads/depthburst-*.json` (see 2026-07-23 crib);
today's bursts kept in Downloads as the trusted-short real-failure set.

### Evening — egg-foot remodel + toe-end truncation discriminators shipped

Replayed the day's 13 bursts and every committed fixture with end-band
instrumentation (extreme-10 mm tip width vs a 15–45 mm reference band, both
ends). Findings, in falsification order:

- **The FRONT end separates cleanly and anatomically.** Good frames' front
  tips span 27–38 mm at 23–37% of ball width. Toe-truncated shorts end in a
  cut edge at 87–99 mm — 79–90% of ball width. Phantom frontiers (the
  edge-flare streak behind 321.1; June's toe-dropout tails at 224/232) span
  4–8 mm. Shipped two multiplicative trust signals in `footFromDepth.ts`:
  `toeTaperScore` (front tip ≥ 80% of ball width → 0; no real foot's last
  10 mm approaches its ball width) and `toeSpanScore` (frontier narrower
  than a lone big toe, ramp 20 → 10 mm, → 0; a narrower frontier is a smear,
  not toes).
- **The REAR end carries no in-frame signal — measured, and twice
  falsified.** An ankle-occluded good heel shows the same rear signatures as
  a capture-truncated one: wide-blunt (shinbrace-1: 92 mm) and sparse-tip
  (shinbrace-2: 5 mm) both mirror the heel-truncated shorts (85–88 / 4 mm).
  Candidate discriminators tested and rejected: trim-cut coupling (the GOOD
  frame had cut=20, the truncated shorts cut=0 — the heel loss happens at
  capture, not at the trim) and tip-band occupancy (good side-arcs fill
  0.31 vs truncated slabs 0.42–0.46 — wrong direction). **No rear gate
  shipped, deliberately**; a rear-blunt gate would kill the settled
  protocol's good frames first. The heel-truncated variant stays bounded
  capture-side by the over-ankle protocol (~10 mm residual).
- **Replay scoreboard:** 6 of 11 trusted-bad frames now rejected at conf 0
  (toe-truncated 213.7/223.6/234.0, the 321.1 phantom trusted-long, June's
  trusted 224.3/232.0). The three good frames (14-27-49 f0 at 251.0, both
  shinbrace) keep conf 1.00 byte-identically. 5 heel-truncated shorts
  (206.6–217.4) remain trusted — all from the falsified forward-brace
  positions, in-frame indistinguishable.
- **Synthetic remodel:** the canonical test foot is now an anatomical egg —
  rounded 30 mm heel, ball (widest, 110 mm) at 70% of length, elliptical toe
  cap, and a real side profile (heel-pad rise, dorsum descent to 3 mm tips),
  so synthetic toe tips sit below the 6 mm segmentation floor and exercise
  sub-band recovery exactly like device captures. The symmetric ellipse and
  the linear wedge are gone. New synthetic negatives pin both discriminators
  (a ball-truncated cut and a phantom frontier streak). `goodPoseSet` now
  asserts NO June frame is trusted — trusted length comes only from
  shin-brace-protocol frames.

Mitigation path for the remaining heel-truncated variant is the
DepthDebugScreen coach (item 3 above), not more gate work.
