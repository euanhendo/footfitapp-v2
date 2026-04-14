import { Boot } from './fitting';
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
const LENGTH_WEIGHT = 0.4;
const WIDTH_WEIGHT = 0.6;
const NEAR_MISS_MIN_SCORE = 20;
const NEAR_MISS_CAP = 5;

export function computeDimensionScore(
  value: number,
  min: number,
  max: number,
  tolerance: number,
): number {
  if (min === max) {
    if (value === min) return 100;
    const overshoot = Math.abs(value - min);
    return Math.max(0, Math.round(60 * (1 - overshoot / tolerance)));
  }

  const center = (min + max) / 2;
  const halfRange = (max - min) / 2;

  if (value >= min && value <= max) {
    const distanceFromCenter = Math.abs(value - center);
    return Math.round(100 - 40 * (distanceFromCenter / halfRange));
  }

  const overshoot = value < min ? min - value : value - max;
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

  if (!lengthInRange && !widthInRange) {
    return 'Likely not ideal — outside this boot\'s range in both length and width';
  }

  if (!widthInRange) {
    const diff = adjustedWidth > boot.maxWidth
      ? Math.round(adjustedWidth - boot.maxWidth)
      : Math.round(boot.minWidth - adjustedWidth);
    const direction = adjustedWidth > boot.maxWidth ? 'tight' : 'loose';
    return `May feel ${direction} in width — your foot is ${diff}mm ${adjustedWidth > boot.maxWidth ? 'wider than' : 'narrower than'} this boot's range`;
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
): ScoredBoot {
  const lengthScore = computeDimensionScore(
    adjustedLength,
    boot.minLength,
    boot.maxLength,
    LENGTH_TOLERANCE,
  );
  const widthScore = computeDimensionScore(
    adjustedWidth,
    boot.minWidth,
    boot.maxWidth,
    WIDTH_TOLERANCE,
  );
  const score = Math.round(lengthScore * LENGTH_WEIGHT + widthScore * WIDTH_WEIGHT);
  const isExactMatch =
    adjustedLength >= boot.minLength &&
    adjustedLength <= boot.maxLength &&
    adjustedWidth >= boot.minWidth &&
    adjustedWidth <= boot.maxWidth;
  const explanation = generateExplanation(boot, adjustedLength, adjustedWidth);

  return { boot, score, lengthScore, widthScore, explanation, isExactMatch };
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
): { matches: ScoredBoot[]; nearMisses: ScoredBoot[] } {
  const eligible = boots.filter(
    (b) => b.sport === sport && (b.gender === gender || b.gender === 'unisex'),
  );

  const scored = eligible.map((boot) => computeFitScore(boot, adjustedLength, adjustedWidth));

  const matches = scored
    .filter((s) => s.isExactMatch)
    .sort((a, b) => b.score - a.score);

  const nearMisses = scored
    .filter((s) => !s.isExactMatch && s.score > NEAR_MISS_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, NEAR_MISS_CAP);

  return { matches, nearMisses };
}
