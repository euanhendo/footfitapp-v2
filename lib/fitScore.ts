import {
  Boot,
  effectiveSizeOffset,
  recommendSize,
  UK_SIZE_TO_LENGTH_MM,
} from './fitting';
import { OwnedShoe } from './ownedShoes';

export type ScoredBoot = {
  boot: Boot;
  score: number;
  lengthScore: number;
  widthScore: number;
  explanation: string;
  isExactMatch: boolean;
};

const LENGTH_TOLERANCE = 10;
const WIDTH_TOLERANCE = 5;
export const LENGTH_WEIGHT = 0.4;
export const WIDTH_WEIGHT = 0.6;
const NEAR_MISS_MIN_SCORE = 20;
const NEAR_MISS_CAP = 5;
const LOOSE_WIDTH_BASE = 95;
const LOOSE_WIDTH_FLOOR = 75;
const LOOSE_WIDTH_TAPER_PER_MM = 2;
const IN_RANGE_WIDTH_TAPER = 8;

// Comfort-gap buckets, shared by the score curve and the human-readable
// breakdown text so the words always match the number. One UK half size
// is ~4mm of length.
const LENGTH_GAP_SNUG_MAX_MM = 1;
const LENGTH_GAP_IDEAL_MAX_MM = 4;
const LENGTH_GAP_COMFORT_MAX_MM = 7;
const LENGTH_GAP_ROOMY_MAX_MM = 10;

// Length score measures the comfort gap at the recommended size —
// `(recommendedNominalMm + effectiveSizeOffset) - adjustedLength`. A small
// positive gap is the football-boot sweet spot; negative is pinch, large is
// sloppy. filterBoots already gates out-of-range boots; this curve only
// shapes the in-range signal so the breakdown row earns its place.
export function scoreLengthFromGap(gapMm: number): number {
  if (gapMm < 0) return 60;
  if (gapMm <= LENGTH_GAP_SNUG_MAX_MM) return 80;
  if (gapMm <= LENGTH_GAP_IDEAL_MAX_MM) return 100;
  if (gapMm <= LENGTH_GAP_COMFORT_MAX_MM) return 90;
  if (gapMm <= LENGTH_GAP_ROOMY_MAX_MM) return 80;
  return 70;
}

function lengthGapAtRecommendedSize(
  boot: Boot,
  adjustedLength: number,
  ownedShoes: OwnedShoe[],
): { uk: string; insideMm: number; gapMm: number } {
  const sizeOffset = effectiveSizeOffset(boot, ownedShoes);
  const rec = recommendSize(adjustedLength, sizeOffset);
  const nominalMm = UK_SIZE_TO_LENGTH_MM[rec.uk] ?? 0;
  const insideMm = nominalMm + sizeOffset;
  return { uk: rec.uk, insideMm, gapMm: insideMm - adjustedLength };
}

function computeLengthScore(
  boot: Boot,
  adjustedLength: number,
  ownedShoes: OwnedShoe[],
): number {
  const lengthInRange = adjustedLength >= boot.minLength && adjustedLength <= boot.maxLength;
  if (!lengthInRange) {
    const overshoot = adjustedLength < boot.minLength
      ? boot.minLength - adjustedLength
      : adjustedLength - boot.maxLength;
    return Math.max(0, Math.round(60 * (1 - overshoot / LENGTH_TOLERANCE)));
  }

  return scoreLengthFromGap(lengthGapAtRecommendedSize(boot, adjustedLength, ownedShoes).gapMm);
}

// Width is asymmetric: a narrow foot in a wider boot is recoverable with laces,
// but a wide foot in a narrow boot can't be made comfortable.
export function computeWidthScore(
  value: number,
  min: number,
  max: number,
  tolerance: number,
): number {
  if (value >= min && value <= max) {
    if (min === max) return 100;
    const center = (min + max) / 2;
    const halfRange = (max - min) / 2;
    const distanceFromCenter = Math.abs(value - center);
    return Math.round(100 - IN_RANGE_WIDTH_TAPER * (distanceFromCenter / halfRange));
  }

  if (value < min) {
    const undershoot = min - value;
    return Math.max(
      LOOSE_WIDTH_FLOOR,
      Math.round(LOOSE_WIDTH_BASE - undershoot * LOOSE_WIDTH_TAPER_PER_MM),
    );
  }

  const overshoot = value - max;
  return Math.max(0, Math.round(60 * (1 - overshoot / tolerance)));
}

export function generateExplanation(
  boot: Boot,
  adjustedLength: number,
  adjustedWidth: number,
): string {
  const lengthCenter = (boot.minLength + boot.maxLength) / 2;
  const widthCenter = (boot.minWidth + boot.maxWidth) / 2;
  const lengthHalfRange = (boot.maxLength - boot.minLength) / 2;
  const widthHalfRange = (boot.maxWidth - boot.minWidth) / 2;

  const lengthInRange = adjustedLength >= boot.minLength && adjustedLength <= boot.maxLength;
  const widthInRange = adjustedWidth >= boot.minWidth && adjustedWidth <= boot.maxWidth;

  const widthTooTight = adjustedWidth > boot.maxWidth;
  const widthLoose = adjustedWidth < boot.minWidth;

  if (!lengthInRange && widthTooTight) {
    return 'Likely not ideal — outside this boot\'s range in both length and width';
  }

  if (widthTooTight) {
    const diff = Math.round(adjustedWidth - boot.maxWidth);
    return `May feel tight in width — your foot is ${diff}mm wider than this boot's range`;
  }

  if (widthLoose) {
    const diff = Math.round(boot.minWidth - adjustedWidth);
    return `Fits with room — ${diff}mm narrower than this boot, tighten laces to secure`;
  }

  if (!lengthInRange) {
    const diff = adjustedLength > boot.maxLength
      ? Math.round(adjustedLength - boot.maxLength)
      : Math.round(boot.minLength - adjustedLength);
    const direction = adjustedLength > boot.maxLength ? 'short' : 'long';
    return `May feel ${direction} — your foot is ${diff}mm ${adjustedLength > boot.maxLength ? 'longer than' : 'shorter than'} this boot's length range`;
  }

  // Both in range — check how centered
  const lengthCentered = Math.abs(adjustedLength - lengthCenter) <= lengthHalfRange * 0.5;
  const widthCentered = Math.abs(adjustedWidth - widthCenter) <= widthHalfRange * 0.5;

  if (lengthCentered && widthCentered) {
    return 'Excellent fit — your measurements sit well within this boot\'s range';
  }

  if (!widthCentered) {
    const edge = adjustedWidth > widthCenter ? 'upper' : 'lower';
    return `Good fit — width is near the ${edge} edge of this boot's range`;
  }

  const edge = adjustedLength > lengthCenter ? 'upper' : 'lower';
  return `Good fit — length is near the ${edge} edge of this boot's range`;
}

export function computeFitScore(
  boot: Boot,
  adjustedLength: number,
  adjustedWidth: number,
  ownedShoes: OwnedShoe[] = [],
): ScoredBoot {
  const lengthScore = computeLengthScore(boot, adjustedLength, ownedShoes);
  const widthScore = computeWidthScore(
    adjustedWidth,
    boot.minWidth,
    boot.maxWidth,
    WIDTH_TOLERANCE,
  );
  const score = Math.round(lengthScore * LENGTH_WEIGHT + widthScore * WIDTH_WEIGHT);
  const lengthInRange = adjustedLength >= boot.minLength && adjustedLength <= boot.maxLength;
  const widthAcceptable = adjustedWidth <= boot.maxWidth;
  const isExactMatch = lengthInRange && widthAcceptable;
  const explanation = generateExplanation(boot, adjustedLength, adjustedWidth);

  return { boot, score, lengthScore, widthScore, explanation, isExactMatch };
}

export type ScoreBreakdown = {
  lengthScore: number;
  widthScore: number;
  lengthContribution: number;
  widthContribution: number;
  lengthMax: number;
  widthMax: number;
  baseScore: number;
};

export function getScoreBreakdown(scored: ScoredBoot): ScoreBreakdown {
  const lengthContribution = Math.round(scored.lengthScore * LENGTH_WEIGHT);
  const widthContribution = Math.round(scored.widthScore * WIDTH_WEIGHT);
  return {
    lengthScore: scored.lengthScore,
    widthScore: scored.widthScore,
    lengthContribution,
    widthContribution,
    lengthMax: Math.round(100 * LENGTH_WEIGHT),
    widthMax: Math.round(100 * WIDTH_WEIGHT),
    baseScore: scored.score,
  };
}

// Human-readable companion to computeLengthScore: same recommended-size
// comfort gap, expressed as toe room instead of a score.
export function describeLengthFit(
  boot: Boot,
  adjustedLength: number,
  ownedShoes: OwnedShoe[] = [],
): string {
  const foot = Math.round(adjustedLength);
  if (adjustedLength < boot.minLength) {
    const diff = Math.max(1, Math.round(boot.minLength - adjustedLength));
    return `Your ${foot} mm foot is ${diff} mm below this boot's smallest size (${boot.minLength} mm inside)`;
  }
  if (adjustedLength > boot.maxLength) {
    const diff = Math.max(1, Math.round(adjustedLength - boot.maxLength));
    return `Your ${foot} mm foot is ${diff} mm beyond this boot's largest size (${boot.maxLength} mm inside)`;
  }

  const { uk, insideMm, gapMm } = lengthGapAtRecommendedSize(boot, adjustedLength, ownedShoes);
  if (insideMm <= 0) {
    return `Your ${foot} mm foot sits within this boot's ${boot.minLength}–${boot.maxLength} mm size run`;
  }
  const inside = Math.round(insideMm);
  const room = Math.round(gapMm);
  if (gapMm < 0) {
    const shortBy = Math.max(1, Math.round(-gapMm));
    return `UK ${uk} measures ${inside} mm inside — ${shortBy} mm shorter than your foot, so your toes will press the end; consider a half size up`;
  }
  if (gapMm <= LENGTH_GAP_SNUG_MAX_MM) {
    return `UK ${uk} measures ${inside} mm inside — ${room} mm at your toes, a very snug fit`;
  }
  if (gapMm <= LENGTH_GAP_IDEAL_MAX_MM) {
    return `UK ${uk} measures ${inside} mm inside — ${room} mm of toe room, the sweet spot`;
  }
  if (gapMm <= LENGTH_GAP_COMFORT_MAX_MM) {
    return `UK ${uk} measures ${inside} mm inside — ${room} mm of toe room, about half a size of space`;
  }
  if (gapMm <= LENGTH_GAP_ROOMY_MAX_MM) {
    return `UK ${uk} measures ${inside} mm inside — ${room} mm of toe room, about a full size of space`;
  }
  return `UK ${uk} measures ${inside} mm inside — ${room} mm of toe room, more than a full size of space; likely too loose`;
}

// Width companion: asymmetric like the score — a loose boot is recoverable
// with laces, a tight one is not. Stretch advice only on the snug edge.
export function describeWidthFit(boot: Boot, adjustedWidth: number): string {
  const foot = Math.round(adjustedWidth);
  if (adjustedWidth > boot.maxWidth) {
    const diff = Math.max(1, Math.round(adjustedWidth - boot.maxWidth));
    return `Your ${foot} mm width is ${diff} mm over this boot's ${boot.maxWidth} mm max — it will press on the sides of your foot`;
  }
  if (adjustedWidth < boot.minWidth) {
    const diff = Math.max(1, Math.round(boot.minWidth - adjustedWidth));
    return `Your ${foot} mm width is ${diff} mm under this boot's range — extra room you can take up with the laces`;
  }

  const halfRange = (boot.maxWidth - boot.minWidth) / 2;
  if (halfRange === 0) {
    return `Your ${foot} mm width sits comfortably in this boot's fit`;
  }
  const center = (boot.minWidth + boot.maxWidth) / 2;
  const edgeRatio = Math.abs(adjustedWidth - center) / halfRange;
  if (edgeRatio > 0.5 && adjustedWidth > center) {
    return `Your ${foot} mm width is close to this boot's ${boot.maxWidth} mm max — snug across the foot; it may feel tight at first and give slightly with wear`;
  }
  if (edgeRatio > 0.5) {
    return `Your ${foot} mm width is at the roomier end of this boot's ${boot.minWidth}–${boot.maxWidth} mm range — secure it with the laces`;
  }
  return `Your ${foot} mm width sits comfortably in this boot's ${boot.minWidth}–${boot.maxWidth} mm range`;
}

const BRAND_BOOST = 5;
const WIDTH_BOOST = 5;
const MAX_AFFINITY_BOOST = 10;

export function computeAffinityBoost(
  candidate: Boot,
  ownedShoes: OwnedShoe[],
  catalog: Boot[],
): { boost: number; matchedShoe: OwnedShoe | null } {
  if (ownedShoes.length === 0) return { boost: 0, matchedShoe: null };

  let bestBoost = 0;
  let bestShoe: OwnedShoe | null = null;

  for (const owned of ownedShoes) {
    const ownedBoot = catalog.find(
      (b) => b.brand === owned.brand && b.model === owned.model && b.gender === owned.gender,
    );

    let boost = 0;
    if (ownedBoot && candidate.brand === owned.brand) boost += BRAND_BOOST;
    if (ownedBoot && candidate.width === ownedBoot.width) boost += WIDTH_BOOST;

    if (boost > bestBoost) {
      bestBoost = boost;
      bestShoe = owned;
    }
  }

  return {
    boost: Math.min(bestBoost, MAX_AFFINITY_BOOST),
    matchedShoe: bestShoe,
  };
}

export function scoreAndRankBoots(
  boots: Boot[],
  adjustedLength: number,
  adjustedWidth: number,
  sport: string,
  gender: string,
  ownedShoes: OwnedShoe[] = [],
): { matches: ScoredBoot[]; nearMisses: ScoredBoot[] } {
  const eligible = boots.filter(
    (b) =>
      b.sport === sport &&
      (gender === 'unisex' || b.gender === gender || b.gender === 'unisex'),
  );

  const scored = eligible.map((boot) =>
    computeFitScore(boot, adjustedLength, adjustedWidth, ownedShoes),
  );

  const matches = scored
    .filter((s) => s.isExactMatch)
    .sort((a, b) => b.score - a.score);

  const nearMisses = scored
    .filter((s) => !s.isExactMatch && s.score > NEAR_MISS_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, NEAR_MISS_CAP);

  return { matches, nearMisses };
}
