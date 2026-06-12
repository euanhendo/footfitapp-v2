# Scanner width: anatomical band, not min-area rect (2026-06-12)

## Symptom

Tape-measured width ≈ 110 mm; scanner returned 130 mm — twice, identically.
Length in the same scans was repeatable and plausible. Repeatable-but-wrong
means systematic geometry, not noise.

## Root cause

`measureFromQuadAndFoot` measured length robustly (max perpendicular distance
from the heel edge — contour junk can't push the toe farther away) but took
width from `minAreaRect(contour).widthMm` over the **whole** contour. A real
capture's contour includes the ankle and lower leg seen from above; that lobe
widens the rectangle's short side (or rotates the rectangle diagonally). The
asymmetry of the two code paths is why length stayed "bang on" while width
drifted 20 mm. Yesterday's good reading (raw 109.3 vs caliper 110) was a
capture whose contour happened to hug the foot; today's two captures included
leg. All existing tests used clean rectangles, which minAreaRect measures
exactly — so the contamination mode was invisible to the suite.

## Fix (`widthAcrossFootBand`, lib/scanner/footMetrics.ts)

Slice the rectified contour perpendicular to the heel-edge normal (paper +y),
keep slices 30–95% of the way from heel to toe — the zone holding the foot's
true widest cross-section (metatarsal heads), unreachable by ankle/leg — and
take the widest left-edge-to-right-edge span. Foot yaw is corrected from the
least-squares drift of slice midlines (capped at ~25°), deliberately **not**
from minAreaRect's angle, so a contaminated rect can't poison the result.
Sparse contours that populate no slice (synthetic tests) fall back to the old
oriented-box width. Length path untouched — it is device-validated.

## Status

- Branch `fix/scan-width-band`, all 266 tests green incl. a replica of the
  bug (foot + 150 mm leg lobe reads 110, was 150).
- ~~**Merge gate: device validation.**~~ **GATE PASSED 2026-06-12 evening:**
  fresh device build, user re-scanned the tape-measured foot — width read
  **110 vs tape 110** ("bang on the money"), length 265 consistent with his
  tape. Scanner v2 is now physically validated on both axes.
  `WIDTH_SILHOUETTE_BIAS_MM` stays 0.

## Open residuals

- Mid-foot shadow lobes inside the band would still inflate width; the
  redness-pass + 0.85 trust gate remain the defence there.
- ~~Cross-day length discrepancy unexplained~~ **Resolved 2026-06-12 (late):
  user retracted the 255–256 pen figure as a mismeasurement. Same right foot
  throughout; true length 263 mm (re-measured with ruler), width 107 mm by
  ruler vs 110 by tape (technique variance). Don't retune length — the
  scanner's 263 readings were correct.
