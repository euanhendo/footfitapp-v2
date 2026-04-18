import {
  computeDimensionScore,
  computeWidthScore,
  computeFitScore,
  scoreAndRankBoots,
  generateExplanation,
  getScoreBreakdown,
} from '../fitScore';
import { Boot, estimateWidthFromLength, getEstimatedLengthMm } from '../fitting';

describe('computeDimensionScore', () => {
  // Range: [248, 299], center = 273.5, halfRange = 25.5
  it('returns 100 at exact center of range', () => {
    expect(computeDimensionScore(273.5, 248, 299, 10)).toBe(100);
  });

  it('returns 60 at min boundary', () => {
    expect(computeDimensionScore(248, 248, 299, 10)).toBe(60);
  });

  it('returns 60 at max boundary', () => {
    expect(computeDimensionScore(299, 248, 299, 10)).toBe(60);
  });

  it('scores below 60 when just outside range', () => {
    // 1mm below min, tolerance 5
    const score = computeDimensionScore(247, 248, 299, 5);
    expect(score).toBe(48); // 60 * (1 - 1/5) = 48
  });

  it('returns 0 at tolerance distance outside', () => {
    expect(computeDimensionScore(243, 248, 299, 5)).toBe(0);
  });

  it('clamps to 0 when far outside', () => {
    expect(computeDimensionScore(230, 248, 299, 5)).toBe(0);
  });

  it('scores ~80 at 25% from center toward edge', () => {
    // 25% of halfRange (25.5) = 6.375 from center
    // center = 273.5, value = 273.5 + 6.375 = 279.875
    // score = 100 - 40 * (6.375 / 25.5) = 100 - 10 = 90
    expect(computeDimensionScore(279.875, 248, 299, 10)).toBe(90);
  });

  it('handles zero-width range (min === max)', () => {
    expect(computeDimensionScore(265, 265, 265, 5)).toBe(100);
    expect(computeDimensionScore(266, 265, 265, 5)).toBe(48); // 60 * (1 - 1/5)
    expect(computeDimensionScore(270, 265, 265, 5)).toBe(0);
  });

  it('handles outside on the low side', () => {
    // 2mm below min, tolerance 5
    const score = computeDimensionScore(246, 248, 299, 5);
    expect(score).toBe(36); // 60 * (1 - 2/5) = 36
  });
});

describe('computeWidthScore', () => {
  // Asymmetric: narrow foot in wider boot = recoverable via laces (mild penalty).
  // Wide foot in narrow boot = uncomfortable (steep penalty).
  it('returns 100 at the centre of the range', () => {
    // Range [89, 101], centre = 95
    expect(computeWidthScore(95, 89, 101, 5)).toBe(100);
  });

  it('tapers to 80 at the edges of the range', () => {
    // 100 - 20 * (6/6) = 80
    expect(computeWidthScore(89, 89, 101, 5)).toBe(80);
    expect(computeWidthScore(101, 89, 101, 5)).toBe(80);
  });

  it('scales in-range scores by distance from centre', () => {
    // value 98: distance 3, halfRange 6 → 100 - 20*(3/6) = 90
    expect(computeWidthScore(98, 89, 101, 5)).toBe(90);
  });

  it('returns 100 for a zero-width range at the exact value', () => {
    expect(computeWidthScore(95, 95, 95, 5)).toBe(100);
  });

  it('applies only a mild penalty when foot is narrower than boot', () => {
    // 95 - 2*1 = 93
    expect(computeWidthScore(88, 89, 101, 5)).toBe(93);
    // 95 - 2*5 = 85
    expect(computeWidthScore(84, 89, 101, 5)).toBe(85);
  });

  it('floors the loose-width score at 75 no matter how narrow', () => {
    expect(computeWidthScore(60, 89, 101, 5)).toBe(75);
  });

  it('applies a steep penalty when foot is wider than boot', () => {
    // 1mm over max, tolerance 5 → 60 * (1 - 1/5) = 48
    expect(computeWidthScore(102, 89, 101, 5)).toBe(48);
  });

  it('returns 0 once foot exceeds max by tolerance', () => {
    expect(computeWidthScore(106, 89, 101, 5)).toBe(0);
  });
});

describe('computeFitScore', () => {
  const testBoot: Boot = {
    brand: 'Nike',
    model: 'Phantom GX II Elite',
    gender: 'mens',
    sport: 'football',
    width: 'standard',
    minLength: 248,
    maxLength: 299,
    minWidth: 89,
    maxWidth: 101,
    price: 200,
    notes: 'Standard fit',
    purchaseUrl: 'https://example.com',
    imageUrl: 'https://example.com/img.png',
  };

  it('scores near 100 when perfectly centered', () => {
    // Center length = 273.5, center width = 95
    const result = computeFitScore(testBoot, 273.5, 95);
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.isExactMatch).toBe(true);
  });

  it('tapers widthScore at min-width boundary just like length', () => {
    const result = computeFitScore(testBoot, 248, 89);
    expect(result.lengthScore).toBe(60);
    // width at edge: 100 - 20*(6/6) = 80
    expect(result.widthScore).toBe(80);
    // 60*0.4 + 80*0.6 = 72
    expect(result.score).toBe(72);
    expect(result.isExactMatch).toBe(true);
  });

  it('treats narrow-foot-in-wider-boot as an exact match', () => {
    // 3mm below minWidth — laces can tighten.
    const result = computeFitScore(testBoot, 273.5, 86);
    expect(result.isExactMatch).toBe(true);
    expect(result.widthScore).toBeGreaterThanOrEqual(85);
  });

  it('marks as not exact match when width is outside', () => {
    const result = computeFitScore(testBoot, 273.5, 104); // 3mm over maxWidth
    expect(result.isExactMatch).toBe(false);
    expect(result.widthScore).toBeLessThan(60);
  });

  it('marks as not exact match when length is outside', () => {
    const result = computeFitScore(testBoot, 305, 95); // 6mm over maxLength
    expect(result.isExactMatch).toBe(false);
    expect(result.lengthScore).toBeLessThan(60);
  });

  it('marks as exact match at boundary (inclusive)', () => {
    const result = computeFitScore(testBoot, 248, 101);
    expect(result.isExactMatch).toBe(true);
  });

  it('weights width higher than length when both fall outside range', () => {
    // 2mm overshoot on each side so both use the out-of-range penalty curve.
    const widthOver = computeFitScore(testBoot, 273.5, 103);
    const lengthOver = computeFitScore(testBoot, 301, 95);
    const baseline = computeFitScore(testBoot, 273.5, 95).score;
    expect(baseline - widthOver.score).toBeGreaterThan(baseline - lengthOver.score);
  });
});

describe('generateExplanation', () => {
  const testBoot: Boot = {
    brand: 'Nike',
    model: 'Test',
    gender: 'mens',
    sport: 'football',
    width: 'standard',
    minLength: 248,
    maxLength: 299,
    minWidth: 89,
    maxWidth: 101,
    price: 200,
    notes: '',
    purchaseUrl: '',
    imageUrl: '',
  };

  it('says "Excellent fit" when both centered', () => {
    const explanation = generateExplanation(testBoot, 273.5, 95);
    expect(explanation).toContain('Excellent fit');
  });

  it('mentions width when width is outside', () => {
    const explanation = generateExplanation(testBoot, 273.5, 104);
    expect(explanation).toContain('tight');
    expect(explanation).toContain('3mm');
  });

  it('mentions length when length is outside', () => {
    const explanation = generateExplanation(testBoot, 305, 95);
    expect(explanation).toContain('short');
    expect(explanation).toContain('6mm');
  });

  it('mentions both when both outside', () => {
    const explanation = generateExplanation(testBoot, 305, 104);
    expect(explanation).toContain('both');
  });

  it('says "Good fit" when in range but near edge', () => {
    // Width near upper edge: maxWidth=101, value=100
    const explanation = generateExplanation(testBoot, 273.5, 100);
    expect(explanation).toContain('Good fit');
    expect(explanation).toContain('width');
  });
});

describe('scoreAndRankBoots', () => {
  const testBoots: Boot[] = [
    {
      brand: 'Nike',
      model: 'Phantom GX II Elite',
      gender: 'mens',
      sport: 'football',
      width: 'standard',
      minLength: 248,
      maxLength: 299,
      minWidth: 89,
      maxWidth: 101,
      price: 200,
      notes: 'Standard fit',
      purchaseUrl: 'https://example.com',
      imageUrl: 'https://example.com/img.png',
    },
    {
      brand: 'Nike',
      model: 'Mercurial Superfly',
      gender: 'mens',
      sport: 'football',
      width: 'narrow',
      minLength: 248,
      maxLength: 299,
      minWidth: 82,
      maxWidth: 94,
      price: 220,
      notes: 'Narrow fit',
      purchaseUrl: 'https://example.com',
      imageUrl: 'https://example.com/img.png',
    },
    {
      brand: 'Nike',
      model: 'Pegasus 41',
      gender: 'mens',
      sport: 'running',
      width: 'standard',
      minLength: 248,
      maxLength: 299,
      minWidth: 89,
      maxWidth: 105,
      price: 120,
      notes: 'Running shoe',
      purchaseUrl: 'https://example.com',
      imageUrl: 'https://example.com/img.png',
    },
    {
      brand: 'Adidas',
      model: 'Predator',
      gender: 'womens',
      sport: 'football',
      width: 'standard',
      minLength: 230,
      maxLength: 270,
      minWidth: 82,
      maxWidth: 96,
      price: 180,
      notes: 'Womens fit',
      purchaseUrl: 'https://example.com',
      imageUrl: 'https://example.com/img.png',
    },
    {
      brand: 'Puma',
      model: 'Future',
      gender: 'unisex',
      sport: 'football',
      width: 'wide',
      minLength: 248,
      maxLength: 299,
      minWidth: 95,
      maxWidth: 108,
      price: 190,
      notes: 'Wide unisex',
      purchaseUrl: 'https://example.com',
      imageUrl: 'https://example.com/img.png',
    },
  ];

  it('returns correct matches for centered measurements', () => {
    const { matches } = scoreAndRankBoots(testBoots, 265, 95, 'football', 'mens');
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches.every((m) => m.isExactMatch)).toBe(true);
  });

  it('filters by sport', () => {
    const { matches, nearMisses } = scoreAndRankBoots(testBoots, 265, 95, 'running', 'mens');
    const allBoots = [...matches, ...nearMisses].map((s) => s.boot);
    expect(allBoots.every((b) => b.sport === 'running')).toBe(true);
  });

  it('includes unisex boots', () => {
    const { matches } = scoreAndRankBoots(testBoots, 265, 100, 'football', 'mens');
    const models = matches.map((m) => m.boot.model);
    expect(models).toContain('Future');
  });

  it('sorts matches by score descending', () => {
    const { matches } = scoreAndRankBoots(testBoots, 265, 95, 'football', 'mens');
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
  });

  it('treats wider-than-foot boots as matches (laces can tighten)', () => {
    // Width 85 is below Phantom's minWidth (89) but still fits — laces compensate.
    const { matches } = scoreAndRankBoots(testBoots, 265, 85, 'football', 'mens');
    const matchModels = matches.map((m) => m.boot.model);
    expect(matchModels).toContain('Mercurial Superfly');
    expect(matchModels).toContain('Phantom GX II Elite');
  });

  it('puts boots too narrow for the foot into nearMisses', () => {
    // Width 96: exceeds Mercurial's maxWidth 94. Should drop to near miss for Mercurial.
    const { matches, nearMisses } = scoreAndRankBoots(testBoots, 265, 96, 'football', 'mens');
    const matchModels = matches.map((m) => m.boot.model);
    const nearMissModels = nearMisses.map((m) => m.boot.model);
    expect(matchModels).toContain('Phantom GX II Elite');
    expect(nearMissModels).toContain('Mercurial Superfly');
  });

  it('caps near misses at 5', () => {
    // Create many boots that will be near misses
    const manyBoots: Boot[] = Array.from({ length: 10 }, (_, i) => ({
      brand: `Brand${i}`,
      model: `Model${i}`,
      gender: 'mens',
      sport: 'football',
      width: 'standard',
      minLength: 280, // 265 is 15mm below, but some will score > 20
      maxLength: 299,
      minWidth: 89,
      maxWidth: 101,
      price: 100,
      notes: '',
      purchaseUrl: '',
      imageUrl: '',
    }));
    const { nearMisses } = scoreAndRankBoots(manyBoots, 265, 95, 'football', 'mens');
    expect(nearMisses.length).toBeLessThanOrEqual(5);
  });

  it('returns empty results for empty boot array', () => {
    const { matches, nearMisses } = scoreAndRankBoots([], 265, 95, 'football', 'mens');
    expect(matches).toEqual([]);
    expect(nearMisses).toEqual([]);
  });
});

// Issue #1 — narrow foot-feel + narrow boot must leave the breakdown with real
// signal. Historically the narrow width ratio sat exactly on the narrow-boot
// width locus, so estimated width landed on range centre and widthScore rounded
// to ~100 for every narrow user, hiding real mismatches.
describe('narrow-fit regression (Issue #1)', () => {
  const narrowBoot: Boot = {
    brand: 'Nike',
    model: 'Mercurial Superfly',
    gender: 'mens',
    sport: 'football',
    width: 'narrow',
    minLength: 248,
    maxLength: 299,
    minWidth: 82,
    maxWidth: 94,
    price: 220,
    notes: 'Narrow fit',
    purchaseUrl: '',
    imageUrl: '',
  };

  it('does not collapse estimated-narrow width onto the boot-range centre', () => {
    // UK 9 with a narrow profile used to land at ~90mm — within 1-2mm of the
    // narrow-boot width centre (~88mm), making widthScore round near 100 and
    // faking a perfect fit. The estimator must now spread narrow users off
    // that locus so the breakdown carries real signal.
    const length = getEstimatedLengthMm('UK', '9');
    const width = estimateWidthFromLength(length, 'narrow');
    const scored = computeFitScore(narrowBoot, length, width);

    // Length score can legitimately be very high (size lookup is accurate).
    // Width score must not — it's estimated, and cannot masquerade as measured.
    expect(scored.widthScore).toBeLessThan(80);
  });

  it('keeps narrow-profile users meaningfully informed at UK 8 and 8.5 too', () => {
    for (const size of ['8', '8.5']) {
      const length = getEstimatedLengthMm('UK', size);
      const width = estimateWidthFromLength(length, 'narrow');
      const scored = computeFitScore(narrowBoot, length, width);
      expect(scored.widthScore).toBeLessThan(95);
    }
  });
});

describe('getScoreBreakdown', () => {
  const testBoot: Boot = {
    brand: 'Nike',
    model: 'Phantom GX II Elite',
    gender: 'mens',
    sport: 'football',
    width: 'standard',
    minLength: 248,
    maxLength: 299,
    minWidth: 89,
    maxWidth: 101,
    price: 200,
    notes: '',
    purchaseUrl: '',
    imageUrl: '',
  };

  it('returns contributions that sum to the overall score', () => {
    const scored = computeFitScore(testBoot, 273.5, 95);
    const breakdown = getScoreBreakdown(scored);
    expect(breakdown.lengthContribution + breakdown.widthContribution).toBe(scored.score);
  });

  it('caps contributions at their weighted maxima', () => {
    const scored = computeFitScore(testBoot, 273.5, 95);
    const breakdown = getScoreBreakdown(scored);
    expect(breakdown.lengthMax).toBe(40);
    expect(breakdown.widthMax).toBe(60);
    expect(breakdown.lengthContribution).toBeLessThanOrEqual(40);
    expect(breakdown.widthContribution).toBeLessThanOrEqual(60);
  });

  it('preserves raw dimension scores on breakdown', () => {
    const scored = computeFitScore(testBoot, 248, 89);
    const breakdown = getScoreBreakdown(scored);
    expect(breakdown.lengthScore).toBe(60);
    expect(breakdown.widthScore).toBe(80);
    expect(breakdown.baseScore).toBe(72);
  });
});
