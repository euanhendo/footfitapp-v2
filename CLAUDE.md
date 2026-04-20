# FootFit — Sports Footwear Recommender

React Native (Expo) app that matches users to fitting sports footwear based on foot measurements and sock choice.

## Rules

See `.claude/rules/`: `workflow.md` (idea-to-ship loop), `screen-flow.md`, `data-rules.md`, `ui-rules.md`, `technical.md`, `commits.md`.

Three rules are load-bearing enough to inline here:

- **Route params are strings.** Parse with `Number()` on the receiving screen. Never type a param as `number`. Scanner outputs (`lengthMm`, `widthMm`, `confidence`) follow the same rule on the way out of `ScannerScreen`.
- **Persistence goes through `StorageAdapter`.** Components and screens never import `expo-secure-store` directly — inject the adapter so tests can swap it.
- **Vision goes through `VisionAdapter`.** Scanner screens never import `react-native-fast-tflite` or camera/ML modules directly — inject the adapter so tests can swap it. Math in `lib/scanner/*` stays pure.

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

`react-native-fast-tflite` is linked into the app (even though the scanner is currently abandoned, see below). Expo Go cannot load it. Use a local dev client:

```bash
npm run ios            # npx expo run:ios (simulator)
npx expo run:ios --device   # plugged-in iPhone, free Apple ID signing OK
```

### Scanner status

The camera-scan spike (`ScannerScreen`, `tfliteVisionAdapter`, `lib/scanner/*`) is **abandoned as of 2026-04-20** — see [.claude/decisions/roadmap-2026-04.md](.claude/decisions/roadmap-2026-04.md) for the failure mode. The code is kept for a future revival attempt; the "Scan with phone" user entry point has been removed from `ManualInputScreen`. Do not add links back to `ScannerScreen` without reading the abandon note first.

## Key Files

| File | Purpose |
|---|---|
| `lib/fitting.ts` | Core: size conversion, width calc, boot filtering, sock adjustment, per-boot `recommendSize` (respects `sizeOffset`) |
| `lib/fitScore.ts` | Scoring algorithm — 0–100 fit score (flattened in-range curves: length 95–100, width 92–100), near-miss detection |
| `lib/fitProfile.ts` | Persisted profile — StorageAdapter pattern, versioned schema |
| `lib/ownedShoes.ts` | Persisted list of owned shoes — StorageAdapter pattern |
| `lib/bootListControls.ts` | Result-screen filter/sort + width-preference boost |
| `lib/scanner/*` | Foot-scan CV math: calibration, foot metrics, reference objects, VisionAdapter boundary |
| `lib/scanner/tfliteVisionAdapter.ts` | Concrete `VisionAdapter` — only file allowed to import `react-native-fast-tflite` / `expo-image-manipulator` |
| `assets/models/` | Bundled `.tflite` weights (gitignored — download per `assets/models/README.md`) |
| `lib/__tests__/` | Unit tests (Jest + ts-jest) |
| `bootDatabase.json` | Boot inventory (mm) — use `/add-boot` |
| `sockDatabase.json` | Sock thickness map (mm, with `sport`) — use `/add-sock` |
| `app/screens/*` | HomeScreen (entry), ManualInput, MeasureGuide, SockSelection, Result, OwnedShoes, Scanner, ScanReview |
| `app/screens/ScannerScreen.tsx` | `expo-camera` preview + reference-object overlay; captures photo and runs it through `VisionAdapter` |
| `app/screens/ScanReviewScreen.tsx` | Shows detected mm + confidence; low-confidence routes to ManualInput with prefilled values |
| `app/_layout.tsx` | Stack navigator, route param types |

## Mistakes to Avoid

_Prune during `/retro` when entries become stale or internalised._

- No external state management — local state + route params only
- Run all 3 verify checks before reporting done: `npm test`, `npx tsc --noEmit`, `npm run lint` (or `/verify`)
- SockSelection renders dynamically via `getSocksForSport()` — never hardcode Picker.Item
- For persistence, inject a `StorageAdapter` in tests — don't mock native modules directly
- For vision, inject a `VisionAdapter` in tests — no `react-native-fast-tflite` or `expo-camera` imports inside `lib/scanner/*`
- Scanner math (`lib/scanner/*`) is pure TypeScript — if you need RN or native APIs in there, you're on the wrong side of the boundary
- `react-native-fast-tflite` breaks Expo Go — even with scanner abandoned, the native module is linked; use `npm run ios` / `expo run:ios --device`, not Expo Go
- Installing native Expo modules hits `~/.expo/native-modules-cache/` (outside sandbox) — expect `EPERM`, retry with sandbox disabled
