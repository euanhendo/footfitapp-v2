# Scanner v2 — classical CV, shipped 2026-06-11

A4-reference foot scanner (Apple Vision via `modules/footfit-vision`) merged to `main` after on-device validation: **scanner median 256.1 mm vs pen-and-tape 255–256 mm**. _(Correction 2026-06-12: the user retracted that pen figure as a mismeasurement — his right foot, the reference foot for all validation, is actually 263 × 107 by pen/ruler, and the v2 scanner read 263 on-device that day. See scan-width-band-2026-06.md.)_

## The decisive lesson: validate the ground truth first

Two days were spent chasing a ~20 mm "length error" that did not exist. The gate target (275 × 110) came from the owner's UK 9 size label, never from a tape measure; his right foot is actually ≈ 263 × 107 (the first pen reading of 255.5 was itself later retracted as a mismeasurement — even ground truth needs a second measurement). The error being hunted was the product thesis itself — people don't know their real size. **Any future accuracy work starts with a pen mark on the paper and a tape measure, before touching code — and measure twice.**

## What made it accurate (keep)

- **Trust gate over optics.** After two failed image-processing attempts at shadow immunity, the winning move was to stop tuning optics and let confidence reject bad captures: `TRUST_MIN_CONFIDENCE = 0.85` (clean ≥ 0.93, shadow-inflated ~0.76), auto-capture reshoots until 3 trusted. Robust statistics beat perfect optics.
- **Homography rectification** (`lib/scanner/homography.ts`). A single px-per-mm scale systematically under-reads length when the phone is tilted; measuring the foot in paper-mm coordinates removed a consistent ~5 mm and is exact by construction.
- **Redness map** (3R − 1.5G − 1.5B contour pass in Swift). Generic chroma failed — warm ambient + cool flash makes shadows chromatic; skin's red-dominance is the discriminator that survives mixed lighting.
- **Guide-lock auto-capture** (`assessGuideFit`). Users hold the phone tilted and shoot paper slivers; only firing when the paper fills the guide standardizes geometry and illumination (flash off probing, on for the burst).

## What failed (do not retry)

- Illumination normalization (divide-by-blur): `VNDetectContoursRequest` needs filled regions, not edge maps — foot read as a 2.8 mm sliver.
- Generic chroma distance from gray: shadows under mixed lighting are chromatic.
- TFLite segmentation (2026-04, see roadmap-2026-04.md): op-resolver failure is a library limit, not a model choice.

## Open residuals

- **Width is the noisy dimension**: trusted captures ranged 109–121 mm against a believed ~112 (tape-unverified). A shadow remnant can pad width without tripping the aspect-based confidence. Re-fit `WIDTH_SILHOUETTE_BIAS_MM` (currently 0) only with pen-measured widths across multiple feet.
- Heel placement depends on a flat vertical surface at the paper edge; moulded skirting pushes the heel forward. Coaching text covers it; v3 (LiDAR, paperless) is the structural fix — deferred until v2 sees use.
