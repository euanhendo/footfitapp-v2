# Roadmap — April 2026

Captured from brainstorm on 2026-04-15. Guides which issues get shaped next via `/add-issue` → `/shape-issue` → `/feature`. Status refreshed 2026-04-19.

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

## Remaining

### Camera-scan Phase 3 — real vision

Boundary is live; only the model + dev client remain.

- Drop `selfie-segmentation.tflite` into `assets/models/` per [assets/models/README.md](../../assets/models/README.md).
- Build EAS dev client (`eas build --profile development --platform ios` for device, `development-simulator` for sim). Expo Go cannot load `react-native-fast-tflite`.
- Verify `tfliteVisionAdapter` produces sane `lengthMm`/`widthMm`/`confidence` on a real A4-referenced capture.
- Confirm low-confidence path correctly falls back to `ManualInput` with prefilled values.

Accuracy bar: 5 mm error is worse than manual input. Spike ships only if it clears that bar.

## Priority

1. Camera-scan Phase 3 — ship real-vision path or formally abandon.