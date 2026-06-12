import {
  computeWidthScore,
  computeFitScore,
  describeLengthFit,
  describeWidthFit,
  scoreAndRankBoots,
  scoreLengthFromGap,
  generateExplanation,
  getScoreBreakdown,
} from '../fitScore';
import { Boot, estimateWidthFromLength, getEstimatedLengthMm } from '../fitting';

describe('scoreLengthFromGap', () => {
  // Comfort gap = (recommendedNominalMm + effectiveSizeOffset) - adjustedLength.
  // Negative gap means foot is bigger than the boot's actual length at the
  // recommended size — a pinch. Large positive gap is sloppy.
  it('returns 60 for a pinch (gap < 0)', () => {
    expect(scoreLengthFromGap(-2)).toBe(60);
    expect(scoreLengthFromGap(-0.5)).toBe(60);
  });

  it('returns 80 for a tight gap (0–1 mm)', () => {
    expect(scoreLengthFromGap(0)).toBe(80);
    expect(scoreLengthFromGap(1)).toBe(80);
  });

  it('returns 100 for a sweet-spot gap (2–4 mm)', () => {
    expect(scoreLengthFromGap(2)).toBe(100);
    expect(scoreLengthFromGap(3)).toBe(100);
    expect(scoreLengthFromGap(4)).toBe(100);
  });

  it('returns 90 for a comfortable gap (>4–7 mm)', () => {
    expect(scoreLengthFromGap(5)).toBe(90);
    expect(scoreLengthFromGap(6)).toBe(90);
    expect(scoreLengthFromGap(7)).toBe(90);
  });

  it('returns 80 for a roomy gap (>7–10 mm)', () => {
    expect(scoreLengthFromGap(8)).toBe(80);
    expect(scoreLengthFromGap(10)).toBe(80);
  });

  it('returns 70 for a sloppy gap (>10 mm)', () => {
    expect(scoreLengthFromGap(12)).toBe(70);
    expect(scoreLengthFromGap(30)).toBe(70);
  });
});

describe('computeWidthScore', () => {
  // Asymmetric: narrow foot in wider boot = recoverable via laces (mild penalty).
  // Wide foot in narrow boot = uncomfortable (steep penalty).
  it('returns 100 at the centre of the range', () => {
    // Range [89, 101], centre = 95
    expect(computeWidthScore(95, 89, 101, 5)).toBe(100);
  });

  it('tapers to 92 at the edges of the range', () => {
    // 100 - 8 * (6/6) = 92
    expect(computeWidthScore(89, 89, 101, 5)).toBe(92);
    expect(computeWidthScore(101, 89, 101, 5)).toBe(92);
  });

  it('scales in-range scores by distance from centre', () => {
    // value 98: distance 3, halfRange 6 → 100 - 8*(3/6) = 96
    expect(computeWidthScore(98, 89, 101, 5)).toBe(96);
  });

  it('keeps any in-range width above 91', () => {
    for (const value of [89, 92, 95, 98, 101]) {
      expect(computeWidthScore(value, 89, 101, 5)).toBeGreaterThanOrEqual(92);
    }
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

  it('marks as exact match when measurements are inside boot range', () => {
    const result = computeFitScore(testBoot, 273.5, 95);
    expect(result.isExactMatch).toBe(true);
  });

  it('scores 100 for a foot in the sweet-spot gap at the recommended size', () => {
    // Foot 272 → closest UK 9 nominal 274, gap = 2mm → length 100.
    // Width 95 is centred in [89, 101] → width 100. Combined total 100.
    const result = computeFitScore(testBoot, 272, 95);
    expect(result.lengthScore).toBe(100);
    expect(result.score).toBe(100);
  });

  it('reflects a tight comfort gap at the recommended size', () => {
    // Foot 273.5 → UK 9 (274) is closest, gap 0.5mm → tight → 80.
    const result = computeFitScore(testBoot, 273.5, 95);
    expect(result.lengthScore).toBe(80);
  });

  it('still rewards edge-of-range measurements as in-range matches', () => {
    // Foot 248 sits on UK 6 nominal, gap 0 → 80 (tight).
    // Width 89 at minWidth → 92.
    const result = computeFitScore(testBoot, 248, 89);
    expect(result.lengthScore).toBe(80);
    expect(result.widthScore).toBe(92);
    // 80*0.4 + 92*0.6 = 32 + 55.2 = 87.2 → 87
    expect(result.score).toBe(87);
    expect(result.isExactMatch).toBe(true);
  });

  it('gives different length scores to in-range boots with different sizeOffset', () => {
    // Regression: the old flat in-range length curve collapsed every displayed
    // boot into 95–100, so the breakdown row gave no information. With the
    // comfort-gap curve, a runs-large boot (sizeOffset: +3) shifts the
    // recommended size and therefore the gap — must produce a different score.
    const runsTrue: Boot = { ...testBoot, sizeOffset: 0 };
    const runsLarge: Boot = { ...testBoot, sizeOffset: 3 };
    const a = computeFitScore(runsTrue, 274, 95);
    const b = computeFitScore(runsLarge, 274, 95);
    expect(a.lengthScore).not.toBe(b.lengthScore);
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
    // Softer in-range width taper (8pt) means narrow-in-narrow widthScore sits
    // in the 90s rather than the 80s — but must still read below a clean 100
    // so the breakdown carries real signal.
    for (const size of ['8', '8.5']) {
      const length = getEstimatedLengthMm('UK', size);
      const width = estimateWidthFromLength(length, 'narrow');
      const scored = computeFitScore(narrowBoot, length, width);
      expect(scored.widthScore).toBeLessThan(97);
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
    // Foot 248 hits UK 6 nominal exactly, so gap=0 → length 80 (tight).
    // Width 89 at minWidth → 92. Combined 80*0.4 + 92*0.6 = 87.
    const scored = computeFitScore(testBoot, 248, 89);
    const breakdown = getScoreBreakdown(scored);
    expect(breakdown.lengthScore).toBe(80);
    expect(breakdown.widthScore).toBe(92);
    expect(breakdown.baseScore).toBe(87);
  });
});

describe('describeLengthFit', () => {
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

  it('names the recommended size and toe room in the sweet spot', () => {
    // Foot 272 → closest UK 9 (274mm), gap 2mm.
    const text = describeLengthFit(testBoot, 272);
    expect(text).toContain('UK 9');
    expect(text).toContain('274 mm inside');
    expect(text).toContain('2 mm of toe room');
    expect(text).toContain('sweet spot');
  });

  it('calls a zero gap very snug', () => {
    // Foot 274 hits UK 9 nominal exactly.
    const text = describeLengthFit(testBoot, 274);
    expect(text).toContain('very snug');
  });

  it('warns about toe press when the recommended size runs short', () => {
    // Foot 271 → closest UK 8.5 (269mm), gap -2mm.
    const text = describeLengthFit(testBoot, 271);
    expect(text).toContain('UK 8.5');
    expect(text).toContain('press the end');
    expect(text).toContain('half size up');
  });

  it('accounts for a boot that runs large via sizeOffset', () => {
    // Offset 3: foot 272 → effective 269 → UK 8.5, inside 269+3=272, gap 0.
    const runsLarge: Boot = { ...testBoot, sizeOffset: 3 };
    const text = describeLengthFit(runsLarge, 272);
    expect(text).toContain('UK 8.5');
    expect(text).toContain('272 mm inside');
    expect(text).toContain('very snug');
  });

  it('translates half-a-size and full-size room for big gaps', () => {
    // The continuous junior table keeps the recommended size within ~2 mm of
    // any foot it covers, so big gaps only occur below the table floor
    // (child 10K, 176 mm) — the size has to be rounded up to the smallest.
    const longRun: Boot = { ...testBoot, minLength: 160 };
    // Foot 171 → UK 10K (176), gap 5mm.
    expect(describeLengthFit(longRun, 171)).toContain('half a size of space');
    // Foot 168 → UK 10K (176), gap 8mm.
    expect(describeLengthFit(longRun, 168)).toContain('a full size of space');
    // Foot 164 → UK 10K (176), gap 12mm.
    expect(describeLengthFit(longRun, 164)).toContain('too loose');
  });

  it('reports the distance past the size run when out of range', () => {
    expect(describeLengthFit(testBoot, 243)).toContain("5 mm below this boot's smallest size");
    expect(describeLengthFit(testBoot, 305)).toContain("6 mm beyond this boot's largest size");
  });
});

describe('describeWidthFit', () => {
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

  it('warns that a too-wide foot will press on the sides', () => {
    const text = describeWidthFit(testBoot, 105);
    expect(text).toContain('4 mm over');
    expect(text).toContain('101 mm max');
    expect(text).toContain('press on the sides');
  });

  it('flags the snug edge with stretch advice', () => {
    // 100 vs centre 95, halfRange 6 → edge ratio 0.83 on the tight side.
    const text = describeWidthFit(testBoot, 100);
    expect(text).toContain('snug across the foot');
    expect(text).toContain('give slightly with wear');
  });

  it('calls a centred width comfortable', () => {
    const text = describeWidthFit(testBoot, 95);
    expect(text).toContain('sits comfortably');
    expect(text).toContain('89–101 mm');
  });

  it('points the roomier end at the laces', () => {
    const text = describeWidthFit(testBoot, 90);
    expect(text).toContain('roomier end');
    expect(text).toContain('laces');
  });

  it('treats a narrower foot as lace-recoverable, not a failure', () => {
    const text = describeWidthFit(testBoot, 85);
    expect(text).toContain('4 mm under');
    expect(text).toContain('laces');
    expect(text).not.toContain('press');
  });

  it('handles a zero-width range', () => {
    const exact: Boot = { ...testBoot, minWidth: 95, maxWidth: 95 };
    expect(describeWidthFit(exact, 95)).toContain('sits comfortably');
  });

  it('returns non-empty text across the whole width sweep', () => {
    for (let w = 80; w <= 110; w += 1) {
      expect(describeWidthFit(testBoot, w).length).toBeGreaterThan(0);
    }
  });
});
