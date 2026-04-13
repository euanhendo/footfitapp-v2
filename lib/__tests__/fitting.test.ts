import {
  estimateWidthFromLength,
  getEstimatedLengthMm,
  filterBoots,
  applySocketAdjustment,
  getSocksForSport,
  Boot,
  SockEntry,
} from '../fitting';

describe('getEstimatedLengthMm', () => {
  it('returns correct mm for UK sizes', () => {
    expect(getEstimatedLengthMm('UK', '8')).toBe(265);
    expect(getEstimatedLengthMm('UK', '10')).toBe(282);
    expect(getEstimatedLengthMm('UK', '5')).toBe(240);
    expect(getEstimatedLengthMm('UK', '12')).toBe(299);
  });

  it('returns correct mm for EU sizes', () => {
    expect(getEstimatedLengthMm('EU', '42')).toBe(265);
    expect(getEstimatedLengthMm('EU', '39')).toBe(245);
    expect(getEstimatedLengthMm('EU', '47')).toBe(298);
  });

  it('returns 0 for unknown sizes', () => {
    expect(getEstimatedLengthMm('UK', '15')).toBe(0);
    expect(getEstimatedLengthMm('EU', '50')).toBe(0);
    expect(getEstimatedLengthMm('UK', '')).toBe(0);
  });

  it('trims whitespace from size input', () => {
    expect(getEstimatedLengthMm('UK', ' 8 ')).toBe(265);
    expect(getEstimatedLengthMm('EU', ' 42 ')).toBe(265);
  });
});

describe('estimateWidthFromLength', () => {
  it('applies narrow ratio (0.36)', () => {
    expect(estimateWidthFromLength(265, 'narrow')).toBe(95);
  });

  it('applies standard ratio (0.375)', () => {
    expect(estimateWidthFromLength(265, 'standard')).toBe(99);
  });

  it('applies wide ratio (0.39)', () => {
    expect(estimateWidthFromLength(265, 'wide')).toBe(103);
  });

  it('returns 0 when length is 0', () => {
    expect(estimateWidthFromLength(0, 'standard')).toBe(0);
  });

  it('rounds to nearest integer', () => {
    // 257 * 0.375 = 96.375 → 96
    expect(estimateWidthFromLength(257, 'standard')).toBe(96);
    // 261 * 0.36 = 93.96 → 94
    expect(estimateWidthFromLength(261, 'narrow')).toBe(94);
  });
});

describe('applySocketAdjustment', () => {
  it('adds thickness to both length and width', () => {
    const result = applySocketAdjustment(265, 99, 0.6);
    expect(result.adjustedLength).toBe(265.6);
    expect(result.adjustedWidth).toBe(99.6);
  });

  it('handles zero thickness', () => {
    const result = applySocketAdjustment(265, 99, 0);
    expect(result.adjustedLength).toBe(265);
    expect(result.adjustedWidth).toBe(99);
  });
});

describe('getSocksForSport', () => {
  const testSockDb: Record<string, SockEntry> = {
    nike_grip: { brand: 'Nike Grip Socks', thickness: 0.3, sport: 'football' },
    trusox_mid: { brand: 'Trusox Midweight', thickness: 0.6, sport: 'football' },
    darn_tough: { brand: 'Darn Tough Element Micro Crew', thickness: 0.3, sport: 'running' },
    smartwool_run: { brand: 'Smartwool Run Cold Weather', thickness: 0.5, sport: 'running' },
    injinji_ultra: { brand: 'Injinji Ultra Run No-Show', thickness: 0.5, sport: 'running' },
  };

  it('returns only football socks for football', () => {
    const result = getSocksForSport(testSockDb, 'football');
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.key === 'nike_grip' || s.key === 'trusox_mid')).toBe(true);
  });

  it('returns only running socks for running', () => {
    const result = getSocksForSport(testSockDb, 'running');
    expect(result).toHaveLength(3);
  });

  it('returns empty array for unknown sport', () => {
    const result = getSocksForSport(testSockDb, 'rugby');
    expect(result).toEqual([]);
  });

  it('returns items with correct shape', () => {
    const result = getSocksForSport(testSockDb, 'football');
    for (const sock of result) {
      expect(sock).toHaveProperty('key');
      expect(sock).toHaveProperty('brand');
      expect(sock).toHaveProperty('thickness');
      expect(typeof sock.key).toBe('string');
      expect(typeof sock.brand).toBe('string');
      expect(typeof sock.thickness).toBe('number');
    }
  });
});

describe('filterBoots', () => {
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

  it('filters by sport', () => {
    const results = filterBoots(testBoots, 265, 95, 'running', 'mens');
    expect(results).toHaveLength(1);
    expect(results[0].model).toBe('Pegasus 41');
  });

  it('filters by gender', () => {
    const results = filterBoots(testBoots, 260, 90, 'football', 'womens');
    expect(results.every((b) => b.gender === 'womens' || b.gender === 'unisex')).toBe(true);
  });

  it('includes unisex boots for any gender', () => {
    const results = filterBoots(testBoots, 265, 100, 'football', 'mens');
    const models = results.map((b) => b.model);
    expect(models).toContain('Future');
  });

  it('filters by length range', () => {
    // 240 is below minLength (248) for most boots
    const results = filterBoots(testBoots, 240, 90, 'football', 'mens');
    expect(results).toHaveLength(0);
  });

  it('filters by width range', () => {
    // 110 is above maxWidth for all boots
    const results = filterBoots(testBoots, 265, 110, 'football', 'mens');
    expect(results).toHaveLength(0);
  });

  it('returns multiple matches when measurements fit several boots', () => {
    // 265 length, 95 width — fits Phantom (89-101) and Future (95-108)
    const results = filterBoots(testBoots, 265, 95, 'football', 'mens');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array when nothing matches', () => {
    const results = filterBoots(testBoots, 200, 70, 'football', 'mens');
    expect(results).toEqual([]);
  });
});
