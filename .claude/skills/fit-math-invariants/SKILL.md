---
name: fit-math-invariants
description: Enforces FootFit's fitting math invariants when editing lib/fitting.ts, lib/fitScore.ts, or lib/fitProfile.ts. Covers mm-only units, [0,100] score bounds, asymmetric width scoring, length/width weighting, and near-miss rules. Use whenever changing fit calculation, score aggregation, or width/length tolerances.
---

# FootFit math invariants

All measurements are **millimetres**. Never mix cm or inches. Size systems (UK/EU) only exist as lookup keys in `UK_SIZE_TO_LENGTH_MM` / `EU_SIZE_TO_LENGTH_MM`; everything downstream is mm.

## Score bounds

- Every per-dimension score and the final aggregated score is clamped to `[0, 100]`.
- Any new scoring branch must end in `Math.max(0, …)` or `Math.min(100, …)` — or be provably bounded.
- Tests must assert `score >= 0 && score <= 100` for every path exercised.

## Weights (do not change without a paired test update)

```ts
LENGTH_WEIGHT = 0.4
WIDTH_WEIGHT  = 0.6
// final = round(lengthScore * 0.4 + widthScore * 0.6)
```

`getScoreBreakdown` returns `lengthMax: 40`, `widthMax: 60` — keep these consistent with the weights if you ever retune.

## Width is asymmetric

A **loose** boot is recoverable with laces; a **tight** boot is not.

- `value < min` (loose): floor at `LOOSE_WIDTH_FLOOR (75)`, taper from `LOOSE_WIDTH_BASE (95)` at `2/mm`.
- `value > max` (tight): falls off linearly over `WIDTH_TOLERANCE (5mm)` to 0.

Do **not** make tight width symmetric with loose width. That's a real-world invariant, not a bug.

## Width-profile ratios (lib/fitting.ts)

```ts
narrow:   0.36
standard: 0.375
wide:     0.39
```

Applied as `length * ratio` in `estimateWidthFromLength`. Changing these shifts every estimated width in the app.

## Length tolerance

`LENGTH_TOLERANCE = 10mm`, `WIDTH_TOLERANCE = 5mm`. Out-of-range dimensions taper from 60 to 0 over the tolerance window.

## Exact match vs near miss

- `isExactMatch = lengthInRange && widthAcceptable (adjustedWidth <= boot.maxWidth)`. Loose width still counts as exact.
- Near miss: `!isExactMatch && score > NEAR_MISS_MIN_SCORE (20)`, capped at `NEAR_MISS_CAP (5)`.

## Affinity boost

Owned-shoe boost is capped: `MAX_AFFINITY_BOOST = 10`. Brand (+5) + matching width (+5). Never uncap this — the base fit score must dominate.

## Profile schema

`FitProfile.version` is a literal `1`. Bumping it requires:
1. Migration branch in `load()` or explicit `return null` for old versions.
2. New `PROFILE_KEY` if the shape is incompatible.
3. A test covering the old-version path.

## Red flags while editing

- New scoring branch without a clamp.
- Changing a weight without updating `lengthMax`/`widthMax` in `getScoreBreakdown`.
- Symmetric width scoring creeping in.
- Hardcoded mm numbers that duplicate an existing constant — reuse the named constant.
