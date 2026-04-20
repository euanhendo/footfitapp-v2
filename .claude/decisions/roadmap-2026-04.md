# Roadmap — April 2026

Captured from brainstorm on 2026-04-15. Guides which issues get shaped next via `/add-issue` → `/shape-issue` → `/feature`. Status refreshed 2026-04-20.

## Shipped

- ✅ Score-breakdown bug — asymmetric width scoring + recentred ratios (`3125e73`).
- ✅ HomeScreen Unisex + US sizes (`4096989`).
- ✅ Rugby boot database (`4096989`).
- ✅ Measure guide screen (`c18c90c`).
- ✅ Result screen: boot images (`BootImage`) and boot-vs-user dimensions panel.
- ✅ Result filter / sort / width-preference boost (`8444baf`).
- ✅ SockSelection search + brand grouping + images (`bc2f120`).
- ✅ Camera scan spike — Phase 1 (pure-math scaffold) + Phase 2 (`ScannerScreen` + `ScanReviewScreen` with stub `VisionAdapter`, end-to-end navigable) (`bce9844`).
- ✅ Narrow-profile width-score inflation fix — Issue #1 (`2fca24d`).
- ✅ Fit-score + size-recommendation overhaul — flattened in-range curves (length 95–100, width 92–100), per-boot `sizeOffset` field, `recommendSize()` returning UK/EU/US + `borderlineTight` flag, ResultScreen shows "Foot with socks: X × Y mm" header and per-card "Suggested size" line.

## Abandoned

### Camera-scan Phase 3 — real vision (2026-04-20)

Spike halted at the model-load smoke test on real hardware (iPhone 15 Pro Max, local `npx expo run:ios --device`, free Apple ID signing). Both the MediaPipe Tasks `selfie_segmenter.tflite` (float16) and the legacy MediaPipe Solutions `selfie_segmentation.tflite` (2021 MLKit build) fail identically at tensor allocation:

```
TFLite: Failed to allocate memory for input/output tensors! Status: unresolved-ops
```

`react-native-fast-tflite@1.6.1` ships a bare TFLite interpreter whose builtin op resolver cannot register kernels for ops these models use. We never reached inference, let alone the 5 mm accuracy bar.

Getting further would need either (a) a purpose-built foot-segmentation model using only standard TFLite builtins, (b) a different RN TFLite library with a broader op registry / MediaPipe Tasks support, or (c) a wholly different CV stack. All are algorithm rework — out of scope for this spike.

**Kept in the tree for a future revival attempt** (the boundary is cheap insurance):

- [lib/scanner/](../../lib/scanner/) — pure math (calibration, footMetrics, referenceObjects) is framework-free and reusable.
- [lib/scanner/tfliteVisionAdapter.ts](../../lib/scanner/tfliteVisionAdapter.ts) — concrete adapter, the only file that imports `react-native-fast-tflite` / `expo-image-manipulator`. Untouched.
- [app/screens/ScannerScreen.tsx](../../app/screens/ScannerScreen.tsx) + [app/screens/ScanReviewScreen.tsx](../../app/screens/ScanReviewScreen.tsx) — still registered in `_layout.tsx` but **no user entry point**. The "Scan with phone" button in `ManualInputScreen` was removed.
- `react-native-fast-tflite`, `expo-camera`, `expo-image-manipulator` remain in `package.json` — removing them would rip out the boundary we want to keep.

**Practical consequences:**

- Users reach boot recommendations via shoe-size lookup or Advanced manual mm input. No camera path.
- Expo Go still can't load the app (native TFLite module is linked whether or not it's called). `expo run:ios` / `expo run:android` is the only dev path.
- If someone revives this: start by testing a swapped model against the op resolver in isolation before wiring anything to the capture screen.

### Revival intent (2026-04-20)

The fit scanner is a **north-star feature** — user has explicit intent to rebuild it, not abandon it. Reference UX: Nike's paper-reference scanner (foot on an A4 sheet → correct size returned).

Because Nike's approach is **classical CV, not ML**, a revival likely sidesteps the `react-native-fast-tflite` op-resolver problem entirely. The more tractable path is:

- Apple Vision `VNDetectContoursRequest` on iOS (edge detection against the A4 reference), **reusing the existing pure-math scaffolding in [lib/scanner/referenceObjects.ts](../../lib/scanner/referenceObjects.ts) and [lib/scanner/footMetrics.ts](../../lib/scanner/footMetrics.ts)**. No TFLite, no segmentation model.
- Or, if cross-platform is wanted later, an OpenCV-via-RN binding for the same contour approach.

**Guardrails for any revival attempt:**

- Do not revive via the same TFLite-segmentation route that failed in Phase 3 — see the `unresolved-ops` note above and the "native-ML same-error" rule.
- Smoke-test the new CV stack **in isolation** (static image → contour → mm) before touching `ScannerScreen` or `ScanReviewScreen`.
- Keep the `VisionAdapter` boundary. The new stack becomes a new concrete adapter alongside `tfliteVisionAdapter.ts`.
- Leave `lib/scanner/*` pure-math and framework-free. If the new adapter needs camera or native CV APIs, those live in the adapter, not the math.

## Priority

1. None currently shaped. Brainstorm the next milestone via `/brainstorm`.