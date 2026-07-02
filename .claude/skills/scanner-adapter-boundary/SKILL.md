---
name: scanner-adapter-boundary
description: Enforces the VisionAdapter boundary when editing lib/scanner/* or the scanner screens (app/screens/ScannerScreen.tsx, app/screens/ScanReviewScreen.tsx). Bans direct native-module, `expo-camera`, or ML-runtime imports from inside lib/scanner/* and mandates dependency injection for testability. Use when touching scanner math, camera capture, or CV model integration.
---

# FootFit scanner boundary

## The rule

Only **concrete adapter implementations** (today: `lib/scanner/visionKitAdapter.ts`) know that a native vision runtime exists. `lib/scanner/*` math modules and `app/screens/Scanner*.tsx` screens consume a `VisionAdapter` via dependency injection. No one else touches native vision modules or camera APIs. (The legacy TFLite adapter was removed 2026-07-02; the boundary rule outlives it.)

## Adapter shape

```ts
export type VisionAdapter = {
  segmentFoot: (imageUri: string) => Promise<Mask>;
  detectReference: (imageUri: string, kind: ReferenceKind) => Promise<BBox | null>;
};
```

Keep it minimal. If you're tempted to add `loadModel`, `warmup`, or `getTelemetry`, those belong inside the concrete adapter, not the interface. The interface's job is "given an image, give me a mask and a reference bbox" — nothing more.

## Component-side pattern

```ts
// lib/scanner/visionKitAdapter.ts (concrete)
export const visionKitAdapter: VisionAdapter = { /* uses modules/footfit-vision */ };

// app/screens/ScannerScreen.tsx
import { visionKitAdapter } from '../../lib/scanner/visionKitAdapter';
const metrics = computeFootMetrics(await visionKitAdapter.segmentFoot(uri), pxPerMm);
```

Screens **never** import `modules/footfit-vision` (or any ML runtime) directly. If you see such an import outside a concrete `*VisionAdapter.ts` file, it's a bug.

## Test-side pattern

Tests inject `createFixedVisionAdapter()` with a hand-built `Mask` and bbox — they do **not** mock the native module:

```ts
import { createFixedVisionAdapter } from '../../scanner/visionAdapter';

const adapter = createFixedVisionAdapter(knownFootMask, knownReferenceBox);
const mask = await adapter.segmentFoot('file://anything');
```

Never `jest.mock` a native vision module — same reasoning as for SecureStore: couples tests to native-module internals and breaks CI.

## Pure-math rule

`lib/scanner/{calibration,footMetrics,referenceObjects,types}.ts` must stay pure:

- No `expo-*` imports.
- No `react-native*` imports.
- No `fs`, `Buffer`, or other Node-only APIs beyond what `ts-jest` provides (`Uint8Array` is fine).
- All functions are deterministic on their inputs — no `Date.now()`, no randomness.

This is what makes `npm test` runnable without a device or simulator.

## Units & invariants

- Inputs from the adapter are in **pixels**. Outputs from the math are in **mm**. The conversion happens exactly once, via `pixelsPerMm()` in `calibration.ts`.
- `confidence` is in **[0, 1]** (not [0, 100] — that's the fit score, which is a different number).
- An empty mask must return `{ lengthMm: 0, widthMm: 0, confidence: 0 }`, never throw.
- `pxPerMm` must be positive — `calibration.ts` throws on zero/negative, and `footMetrics.ts` does the same. Don't silently clamp.

## Route-param bridge

Scanner output crosses the screen boundary as **strings** (per the route-params rule):

```
/screens/ScanReviewScreen?lengthMm=260&widthMm=95&confidence=0.92&imageUri=file%3A%2F%2F...
```

Parse with `Number()` on `ScanReviewScreen`. Never pass a `Mask` or `BBox` through route params — they belong in component state only.

## Red flags while editing

- `from 'modules/footfit-vision'` (or any ML-runtime import) in any `app/screens/*.tsx` file or in `lib/scanner/{calibration,footMetrics,referenceObjects,types,visionAdapter}.ts`.
- `import { Camera }` / `from 'expo-camera'` inside `lib/scanner/*`.
- A `lib/scanner/` helper that accepts a `CameraRef` or a `Uri` instead of an already-extracted `Mask` / `BBox`.
- `jest.mock` of a native vision module in a test.
- A `confidence` value outside [0, 1] returned from `lib/scanner/*`.
- A scanner screen reading measurement output off state that was never round-tripped through `Number()`.