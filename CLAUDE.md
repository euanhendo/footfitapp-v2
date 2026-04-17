# FootFit — Sports Footwear Recommender

React Native (Expo) app that matches users to fitting sports footwear based on foot measurements and sock choice.

## Rules

See `.claude/rules/`: `workflow.md` (idea-to-ship loop), `screen-flow.md`, `data-rules.md`, `ui-rules.md`, `technical.md`, `commits.md`.

Two rules are load-bearing enough to inline here:

- **Route params are strings.** Parse with `Number()` on the receiving screen. Never type a param as `number`.
- **Persistence goes through `StorageAdapter`.** Components and screens never import `expo-secure-store` directly — inject the adapter so tests can swap it.

## Slash commands

**Project-level** (`.claude/commands/`): `/brainstorm` · `/add-issue` · `/shape-issue` · `/retro` · `/handoff` · `/resume` · `/verify` · `/add-boot` · `/add-sock` · `/add-screen`

**User-global** (`~/.claude/commands/`): `/feature` · `/review`

Full workflow table in `workflow.md`.

## Agents

Project-tuned specialists in `.claude/agents/`: `architect` · `planner` · `tdd-guide` · `code-reviewer` · `security-reviewer` · `loop-operator` · `fit-domain-expert`. Delegate to these instead of generic globals for FootFit-specific reasoning.

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

## Key Files

| File | Purpose |
|---|---|
| `lib/fitting.ts` | Core: size conversion, width calc, boot filtering, sock adjustment |
| `lib/fitScore.ts` | Scoring algorithm — 0–100 fit score, near-miss detection |
| `lib/fitProfile.ts` | Persisted profile — StorageAdapter pattern, versioned schema |
| `lib/__tests__/` | Unit tests (Jest + ts-jest) |
| `bootDatabase.json` | Boot inventory (mm) — use `/add-boot` |
| `sockDatabase.json` | Sock thickness map (mm, with `sport`) — use `/add-sock` |
| `app/screens/*` | HomeScreen (entry), ManualInput, SockSelection, Result |
| `app/_layout.tsx` | Stack navigator, route param types |

## Mistakes to Avoid

_Prune during `/retro` when entries become stale or internalised._

- No external state management — local state + route params only
- Run all 3 verify checks before reporting done: `npm test`, `npx tsc --noEmit`, `npm run lint` (or `/verify`)
- SockSelection renders dynamically via `getSocksForSport()` — never hardcode Picker.Item
- For persistence, inject a `StorageAdapter` in tests — don't mock native modules directly
- Installing native Expo modules hits `~/.expo/native-modules-cache/` (outside sandbox) — expect `EPERM`, retry with sandbox disabled
- Out of scope at current stage: camera scan, analytics, remote catalog, wearables, social sharing
