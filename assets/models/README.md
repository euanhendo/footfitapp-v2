# Bundled TFLite models

The scanner phase 3 adapter (`lib/scanner/tfliteVisionAdapter.ts`) loads `selfie-segmentation.tflite` from this folder via `expo-asset`.

## Required file

`selfie-segmentation.tflite` — **not committed**. Download once and place it here before building the dev client.

## Source

MediaPipe Selfie Segmentation, float16 variant.

- Page: https://developers.google.com/mediapipe/solutions/vision/image_segmenter
- Direct (general model): https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
- License: Apache 2.0

```bash
curl -L -o assets/models/selfie-segmentation.tflite \
  https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
```

## Tensor shape

- Input: `[1, 256, 256, 3]` float32, RGB normalised to `0..1`
- Output: `[1, 256, 256, 1]` float32, sigmoid mask (`>= 0.5` ⇒ foreground)

If the model you bundle has a different input/output shape, update the constants at the top of `lib/scanner/tfliteVisionAdapter.ts` (`MODEL_INPUT_SIZE`, `SEGMENTATION_THRESHOLD`).

## Why the file is gitignored

TFLite weights are large (~1–2 MB) and shouldn't bloat the repo. Builds bundle the asset via `assetBundlePatterns` in `app.json`, so it has to be present locally before `eas build` or `expo run:*`.

## Upgrade path

If accuracy targets (≤3 mm length / ≤4 mm width median) aren't met with the off-the-shelf selfie segmenter, the adapter is the only place to swap. Options on the table: a custom-trained foot U-Net, or post-processing the existing mask more aggressively. The pure-math layer in `lib/scanner/*` does not change.
