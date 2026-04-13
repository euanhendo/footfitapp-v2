# FootFit — Sports Footwear Recommender

React Native (Expo) app that matches users to fitting sports footwear based on foot measurements and sock choice.

## Rules

All project rules are in `.claude/rules/`:

- `workflow.md` — understand → plan → implement → verify → report
- `screen-flow.md` — navigation and route params
- `data-rules.md` — boot and sock database schemas
- `ui-rules.md` — colours, spacing, component conventions
- `technical.md` — TypeScript/Expo defaults
- `commits.md` — conventional commit format

## Commands

```bash
npm start              # Start Expo dev server
npm run ios            # Start on iOS simulator
npm run android        # Start on Android emulator
npm run web            # Start in browser
npm run lint           # Run ESLint
npm test               # Run unit tests
```

## Key Files

| File | Purpose |
|---|---|
| `lib/fitting.ts` | Core logic — size conversion, width calc, boot filtering, sock adjustment |
| `lib/__tests__/fitting.test.ts` | Unit tests for all fitting functions |
| `bootDatabase.json` | Boot inventory (50+ entries, all dimensions in mm) |
| `sockDatabase.json` | Sock thickness map (13 entries, mm values) |
| `app/screens/ResultScreen.tsx` | Final recommendations display |
| `app/screens/ManualInputScreen.tsx` | Foot measurement input |
| `app/screens/HomeScreen.tsx` | Sport & gender selection (entry point) |
| `app/screens/SockSelectionScreen.tsx` | Sock picker |
| `app/_layout.tsx` | Stack navigator, route param definitions |

## Mistakes to Avoid

_Update this list when Claude gets something wrong._

- Don't add external state management (Redux, Zustand) — app uses local state + route params only
- Don't modify boot/sock JSON without validating against `data-rules.md` schemas
- Don't forget to run all 3 verify checks (`npm test`, `npx tsc --noEmit`, `npm run lint`) before reporting done
- Route params are always strings — parse with `Number()` on the receiving screen
