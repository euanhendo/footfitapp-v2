import {
  computeDimensionScore,
  computeFitScore,
  scoreAndRankBoots,
  generateExplanation,
} from '../fitScore';
import { Boot } from '../fitting';

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

  it('scores ~60 when both at boundary', () => {
    const result = computeFitScore(testBoot, 248, 89);
    expect(result.lengthScore).toBe(60);
    expect(result.widthScore).toBe(60);
    expect(result.score).toBe(60);
    expect(result.isExactMatch).toBe(true);
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

  it('weights width higher than length', () => {
    // Both at center for length, but width at edge vs center
    const centeredWidth = computeFitScore(testBoot, 273.5, 95);
    const edgeWidth = computeFitScore(testBoot, 273.5, 89);
    // Width penalty should reduce score more than equivalent length penalty
    const centeredLength = computeFitScore(testBoot, 273.5, 95);
    const edgeLength = computeFitScore(testBoot, 248, 95);
    const widthDrop = centeredWidth.score - edgeWidth.score;
    const lengthDrop = centeredLength.score - edgeLength.score;
    expect(widthDrop).toBeGreaterThan(lengthDrop);
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

  it('puts boots outside range into nearMisses', () => {
    // Width 85 is outside Phantom (89-101) but inside Mercurial (82-94)
    const { matches, nearMisses } = scoreAndRankBoots(testBoots, 265, 85, 'football', 'mens');
    const matchModels = matches.map((m) => m.boot.model);
    expect(matchModels).toContain('Mercurial Superfly');
    // Phantom should be a near miss (85 is 4mm below min 89, within tolerance 5)
    const nearMissModels = nearMisses.map((m) => m.boot.model);
    expect(nearMissModels).toContain('Phantom GX II Elite');
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
