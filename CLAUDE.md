# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Start Expo dev server
npm run ios            # Start on iOS simulator
npm run android        # Start on Android emulator
npm run web            # Start in browser
npm run lint           # Run ESLint
```

No test suite is configured yet.

## Architecture

FootFit is a React Native (Expo) sports footwear recommender. Users input foot measurements, select a sock type, and get a filtered list of fitting footwear.

### Screen flow

`app/index.tsx` immediately redirects to `ManualInputScreen`. Navigation is a Stack defined in `app/_layout.tsx`. Foot measurements are passed as route params between screens:

1. **ManualInputScreen** — collects foot length + width via shoe size lookup (UK/EU lookup tables → estimated mm) or direct mm entry. Width is estimated from length using fixed ratios per width profile (narrow: ×0.36, standard: ×0.375, wide: ×0.39).
2. **SockSelectionScreen** — receives `footLength`/`footWidth` params, user picks a sock type from a Picker.
3. **ResultScreen** — receives `footLength`, `footWidth`, `sockType`. Adds sock thickness to both dimensions, then filters `bootDatabase.json` against each boot's `minLength`/`maxLength`/`minWidth`/`maxWidth` ranges. Renders matching boots with a "Buy on Pro:Direct Soccer" link.

### Data

- `bootDatabase.json` — array of boots: `{ brand, model, width, minLength, maxLength, minWidth, maxWidth, notes, purchaseUrl }`. All measurements in mm.
- `sockDatabase.json` — map of sock key → `{ brand, thickness }`. Thickness is added to both length and width before filtering.

### Styling

All styles are inline `StyleSheet`-style objects — no styling library, theme system, or shared components are used. Each screen defines its own colors and typography directly.
