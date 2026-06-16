# FootFit — Sports Footwear Recommender

React Native (Expo) app that matches users to fitting sports footwear based on foot measurements and sock choice.

## Rules

See `.claude/rules/`: `workflow.md` (idea-to-ship loop), `screen-flow.md`, `data-rules.md`, `ui-rules.md`, `technical.md`, `commits.md`.

Three rules are load-bearing enough to inline here:

- **Route params are strings.** Parse with `Number()` on the receiving screen. Never type a param as `number`. Scanner outputs (`lengthMm`, `widthMm`, `confidence`) follow the same rule on the way out of `ScannerScreen`.
- **Persistence goes through `StorageAdapter`.** Components and screens never import `expo-secure-store` directly — inject the adapter so tests can swap it.
- **Vision goes through `VisionAdapter`.** Scanner screens never import native vision/ML modules directly — `ScannerScreen` talks to `visionKitAdapter`; only `lib/scanner/visionKitAdapter.ts` may import `modules/footfit-vision`, and only `lib/scanner/tfliteVisionAdapter.ts` (legacy) may import `react-native-fast-tflite`. Math in `lib/scanner/*` stays pure. The depth bridge (v3) follows the same pattern: only `lib/scanner/depth/arkitDepthAdapter.ts` may import `modules/footfit-vision/depth`. (`ScannerDebugScreen` and `DepthDebugScreen` deliberately poke their raw pipelines — they are the exceptions.)

## Slash commands

**Project-level** (`.claude/commands/`): `/brainstorm` · `/add-issue` · `/shape-issue` · `/retro` · `/handoff` · `/resume` · `/verify` · `/add-boot` · `/add-sock` · `/add-screen`

**User-global** (`~/.claude/commands/`): `/feature` · `/review`

Full workflow table in `workflow.md`.

## Agents

Project-tuned specialists in `.claude/agents/`: `architect` · `planner` · `tdd-guide` · `code-reviewer` · `security-reviewer` · `loop-operator` · `fit-domain-expert` · `scanner-cv-expert`. Delegate to these instead of generic globals for FootFit-specific reasoning.

## Context across sessions

- `.claude/handoff.md` — short resume-note, overwritten each `/handoff`. Read by `/resume`.
- `.claude/decisions/` — lightweight ADRs for choices worth preserving (e.g. string route params, StorageAdapter pattern).

## Commands

```bash
npm start              # Expo dev server
npm run ios|android|web
npm run lint
npm test
npx tsc --noEmit       # Type check (part of verify)
```

Or just run `/verify` to fire all three checks in parallel and get a summary.

### Dev client (required — native modules present)

Native modules are linked into the app (`modules/footfit-vision` for the live scanner; `react-native-fast-tflite` is legacy from the abandoned ML spike). Expo Go cannot load them. Use a local dev client:

```bash
npm run ios            # npx expo run:ios (simulator)
npx expo run:ios --device   # plugged-in iPhone, free Apple ID signing OK
```

### Scanner status

**Shipped 2026-06-11: classical-CV scanner v2** — Nike-style A4-reference flow on Apple Vision (`VNDetectRectanglesRequest` + dual-polarity `VNDetectContoursRequest` + a redness-map contour pass for bare skin) via the native `modules/footfit-vision` bridge. **Validated against pen-and-tape ground truth on both axes** (user's right foot — the reference foot for all scanner validation): length 263 mm, scanner agreed on-device 2026-06-12; width 107–110 mm (ruler vs tape technique variance), scanner read 110 after the anatomical width-band fix (see [.claude/decisions/scan-width-band-2026-06.md](.claude/decisions/scan-width-band-2026-06.md)). An earlier pen figure of 255–256 (2026-06-11) was a mismeasurement of the same right foot — user retracted it 2026-06-12; do not cite it. The mechanisms that made it accurate: hands-free auto-capture that only fires when the paper fills the on-screen guide (`assessGuideFit`), a trust gate (`TRUST_MIN_CONFIDENCE = 0.85`) that rejects shadow-inflated captures and reshoots, and homography rectification of the foot contour into paper-mm coordinates (kills perspective error). Flow: ManualInput → "Scan with your phone" → ScannerScreen (auto) → ScanReview → SockSelection.

The ML route stays dead — the 2026-04-20 TFLite op-resolver failure is documented in [.claude/decisions/roadmap-2026-04.md](.claude/decisions/roadmap-2026-04.md); do not attempt segmentation models again. `lib/scanner/tfliteVisionAdapter.ts` is legacy and unused by screens. **Do not re-tune scanner optics or thresholds without a new pen-measured ground truth.**

**Scanner v3 (LiDAR paperless) — groundwork in progress since 2026-06-12** (v2's full validation was the gate; see [.claude/decisions/scanner-v3-depth-2026-06.md](.claude/decisions/scanner-v3-depth-2026-06.md)). Pure depth math lives in `lib/scanner/depth/` (point cloud → RANSAC floor plane → height-band foot segmentation → the same validated `widthAcrossFootBand`), behind a `DepthAdapter` boundary mirroring `VisionAdapter` — only a future `arkitDepthAdapter.ts` may import the native ARKit bridge. The native ARKit bridge (`modules/footfit-vision/ios/FootfitDepthModule.swift` — sceneDepth + confidence map + live `FootfitDepthARView` height-coach) and a dev-only `DepthDebugScreen` (Home → dashed blue entry) exist. Width is solved (calibrated 108–113 across stance/floor/light). Length is stance-dependent: ruler-grade (261 × 109 vs 263) only with a vertical shin. Device-found failure modes (other-foot/shin clustering, black-fabric invented depth, sub-10 mm toes, leg occlusion shadow) each have unit-tested defences. **Trust gate shipped 2026-06-16 (reject, don't repair):** confidence = `floorScore × footScore × heelScore`, where `heelScore` rejects a leaning leg's thin-tail rear (`rearBandWidth` < 20 mm) vs a real heel (≥45 mm); frames below `TRUST_MIN_CONFIDENCE_V3 = 0.8` are dropped from the burst median. Validated against five real *negative* fixtures (`lib/__tests__/scanner/depth/fixtures/`, `depthTrustGate.test.ts`); a second failure mode surfaced — too much leg in frame + forefoot confidence-dropout → stubby under-reads, fixable only capture-side (aim coaching), not by threshold tuning. **Open: confirm the accept path against a clean saved frame; fix the guide-box/depth-FOV mismatch.** Read [.claude/decisions/scanner-v3-depth-2026-06.md](.claude/decisions/scanner-v3-depth-2026-06.md) before touching `lib/scanner/depth/*`.

## Key Files

| File | Purpose |
|---|---|
| `lib/fitting.ts` | Core: size conversion, width calc, boot filtering, sock adjustment, per-boot `recommendSize` (respects `sizeOffset`) |
| `lib/fitScore.ts` | Scoring algorithm — 0–100 fit score (flattened in-range curves: length 95–100, width 92–100), near-miss detection |
| `lib/fitProfile.ts` | Persisted profile — StorageAdapter pattern, versioned schema |
| `lib/ownedShoes.ts` | Persisted list of owned shoes — StorageAdapter pattern |
| `lib/bootListControls.ts` | Result-screen filter/sort + width-preference boost |
| `lib/scanner/*` | Foot-scan CV math (pure): contour picking, foot metrics, homography rectification, guide-fit lock, trust gate, reference objects |
| `lib/scanner/depth/*` | Scanner v3 depth math (pure): unprojection, RANSAC floor plane, foot-from-depth metrics; `DepthAdapter` boundary for the future ARKit bridge |
| `lib/scanner/visionKitAdapter.ts` | Concrete `VisionAdapter` over Apple Vision — only file allowed to import `modules/footfit-vision`; exposes `detectQuad` (probe) + `measureFoot` (full pipeline) |
| `modules/footfit-vision/` | Native Expo module (Swift): `VNDetectRectanglesRequest` candidates + brightness, dual-polarity + redness-map contours, EXIF-upright dims |
| `lib/scanner/tfliteVisionAdapter.ts` | Legacy `VisionAdapter` from the dead ML spike — only file allowed to import `react-native-fast-tflite`; unused by screens |
| `assets/models/` | Bundled `.tflite` weights (gitignored — legacy, see scanner status) |
| `lib/__tests__/` | Unit tests (Jest + ts-jest) |
| `bootDatabase.json` | Boot inventory (mm) — use `/add-boot` |
| `sockDatabase.json` | Sock thickness map (mm, with `sport`) — use `/add-sock` |
| `app/screens/*` | HomeScreen (entry), ManualInput, MeasureGuide, SockSelection, Result, OwnedShoes, Scanner, ScanReview, ScannerDebug |
| `app/screens/ScannerScreen.tsx` | Hands-free auto-scan: A4 guide overlay, probe loop, trust-gated burst → median → ScanReview |
| `app/screens/ScanReviewScreen.tsx` | Shows detected mm + confidence; low-confidence routes to ManualInput with prefilled values |
| `app/screens/ScannerDebugScreen.tsx` | Instrumented scanner: what-the-scanner-saw overlays, per-capture verdicts, session medians, manual controls |
| `app/_layout.tsx` | Stack navigator, route param types |

## Mistakes to Avoid

_Prune during `/retro` when entries become stale or internalised._

- No external state management — local state + route params only
- Run all 3 verify checks before reporting done: `npm test`, `npx tsc --noEmit`, `npm run lint` (or `/verify`)
- SockSelection renders dynamically via `getSocksForSport()` — never hardcode Picker.Item
- For persistence, inject a `StorageAdapter` in tests — don't mock native modules directly
- For vision, inject a `VisionAdapter` in tests — no `react-native-fast-tflite` or `expo-camera` imports inside `lib/scanner/*`
- Scanner math (`lib/scanner/*`) is pure TypeScript — if you need RN or native APIs in there, you're on the wrong side of the boundary
- Native modules (`modules/footfit-vision`, legacy `react-native-fast-tflite`) break Expo Go — use `npm run ios` / `expo run:ios --device`, not Expo Go
- Installing native Expo modules hits `~/.expo/native-modules-cache/` (outside sandbox) — expect `EPERM`, retry with sandbox disabled
