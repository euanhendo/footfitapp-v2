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

// Length score measures the comfort gap at the recommended size —
// `(recommendedNominalMm + effectiveSizeOffset) - adjustedLength`. A small
// positive gap is the football-boot sweet spot; negative is pinch, large is
// sloppy. filterBoots already gates out-of-range boots; this curve only
// shapes the in-range signal so the breakdown row earns its place.
export function scoreLengthFromGap(gapMm: number): number {
  if (gapMm < 0) return 60;
  if (gapMm <= 1) return 80;
  if (gapMm <= 4) return 100;
  if (gapMm <= 7) return 90;
  if (gapMm <= 10) return 80;
  return 70;
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

  const sizeOffset = effectiveSizeOffset(boot, ownedShoes);
  const rec = recommendSize(adjustedLength, sizeOffset);
  const nominalMm = UK_SIZE_TO_LENGTH_MM[rec.uk] ?? 0;
  const gap = nominalMm + sizeOffset - adjustedLength;
  return scoreLengthFromGap(gap);
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
