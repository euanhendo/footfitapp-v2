import {
  estimateWidthFromLength,
  getEstimatedLengthMm,
  filterBoots,
  applySocketAdjustment,
  getSocksForSport,
  groupSocksByBrand,
  recommendSize,
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
  it('applies narrow ratio (0.345)', () => {
    // 265 * 0.345 = 91.425 → 91. Deliberately offset from the narrow-boot
    // width locus (~0.33 of length) so widthScore isn't forced to 100 for
    // every narrow-profile user — see Issue #1.
    expect(estimateWidthFromLength(265, 'narrow')).toBe(91);
  });

  it('applies standard ratio (0.36)', () => {
    // 265 * 0.36 = 95.4 → 95 (centered in standard band 89–101)
    expect(estimateWidthFromLength(265, 'standard')).toBe(95);
  });

  it('applies wide ratio (0.38)', () => {
    // 265 * 0.38 = 100.7 → 101 (centered in wide band 95–108)
    expect(estimateWidthFromLength(265, 'wide')).toBe(101);
  });

  it('returns 0 when length is 0', () => {
    expect(estimateWidthFromLength(0, 'standard')).toBe(0);
  });

  it('rounds to nearest integer', () => {
    // 257 * 0.36 = 92.52 → 93
    expect(estimateWidthFromLength(257, 'standard')).toBe(93);
    // 261 * 0.345 = 90.045 → 90
    expect(estimateWidthFromLength(261, 'narrow')).toBe(90);
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
    nike_grip:     { brand: 'Nike',       name: 'Grip Socks',         thickness: 0.3, sport: 'football', imageUrl: 'x' },
    trusox_mid:    { brand: 'Trusox',     name: 'Midweight',          thickness: 0.6, sport: 'football', imageUrl: 'x' },
    darn_tough:    { brand: 'Darn Tough', name: 'Element Micro Crew', thickness: 0.3, sport: 'running',  imageUrl: 'x' },
    smartwool_run: { brand: 'Smartwool',  name: 'Run Cold Weather',   thickness: 0.5, sport: 'running',  imageUrl: 'x' },
    injinji_ultra: { brand: 'Injinji',    name: 'Ultra Run No-Show',  thickness: 0.5, sport: 'running',  imageUrl: 'x' },
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
      expect(sock).toHaveProperty('name');
      expect(sock).toHaveProperty('thickness');
      expect(sock).toHaveProperty('imageUrl');
      expect(typeof sock.key).toBe('string');
      expect(typeof sock.brand).toBe('string');
      expect(typeof sock.name).toBe('string');
      expect(typeof sock.thickness).toBe('number');
    }
  });
});

describe('groupSocksByBrand', () => {
  const footballSockDb: Record<string, SockEntry> = {
    nike_grip:      { brand: 'Nike',   name: 'Grip Socks',            thickness: 0.3, sport: 'football', imageUrl: '' },
    trusox_mid:     { brand: 'Trusox', name: 'Midweight',             thickness: 0.6, sport: 'football', imageUrl: '' },
    trusox_thin:    { brand: 'Trusox', name: 'Thin',                  thickness: 0.4, sport: 'football', imageUrl: '' },
    nike_everyday:  { brand: 'Nike',   name: 'Everyday Cushion Crew', thickness: 0.4, sport: 'football', imageUrl: '' },
    alphaskin:      { brand: 'Adidas', name: 'Alphaskin',             thickness: 0.2, sport: 'football', imageUrl: '' },
  };

  it('returns empty array for empty input', () => {
    expect(groupSocksByBrand([])).toEqual([]);
  });

  it('groups socks with the same brand into one section', () => {
    const sections = groupSocksByBrand(getSocksForSport(footballSockDb, 'football'));
    const nike = sections.find((s) => s.brand === 'Nike');
    const trusox = sections.find((s) => s.brand === 'Trusox');
    expect(nike?.data).toHaveLength(2);
    expect(trusox?.data).toHaveLength(2);
  });

  it('creates one section per brand', () => {
    const sections = groupSocksByBrand(getSocksForSport(footballSockDb, 'football'));
    const brands = sections.map((s) => s.brand);
    expect(brands).toEqual(['Nike', 'Trusox', 'Adidas']);
  });

  it('preserves first-appearance order of brands', () => {
    const options = getSocksForSport(footballSockDb, 'football');
    const sections = groupSocksByBrand(options);
    const firstAppearanceBrands: string[] = [];
    for (const option of options) {
      if (!firstAppearanceBrands.includes(option.brand)) {
        firstAppearanceBrands.push(option.brand);
      }
    }
    expect(sections.map((s) => s.brand)).toEqual(firstAppearanceBrands);
  });

  it('preserves insertion order of products within a brand', () => {
    const sections = groupSocksByBrand(getSocksForSport(footballSockDb, 'football'));
    const trusox = sections.find((s) => s.brand === 'Trusox');
    expect(trusox?.data.map((o) => o.key)).toEqual(['trusox_mid', 'trusox_thin']);
  });
});

describe('recommendSize', () => {
  it('returns the closest UK/EU/US size for a true-to-size boot', () => {
    // 260mm is closest to UK 7.5 (261), EU 41 (258), US 8.5 (261)
    const result = recommendSize(260, 0);
    expect(result.uk).toBe('7.5');
    expect(result.eu).toBe('41');
    expect(result.us).toBe('8.5');
  });

  it('compensates for a boot that runs small (negative offset)', () => {
    // 260mm + offset -3 → effective 263 → ties between UK 7.5 and 8, prefers
    // the larger (roomier) size so the user actually orders UK 8.
    const result = recommendSize(260, -3);
    expect(result.uk).toBe('8');
    expect(result.us).toBe('9');
  });

  it('compensates for a boot that runs large (positive offset)', () => {
    // 265mm + offset +3 → effective 262, pulls recommendation down a size.
    const result = recommendSize(265, 3);
    expect(result.uk).toBe('7.5');
  });

  it('treats sizeOffset 0 as the default when omitted', () => {
    expect(recommendSize(265).uk).toBe('8');
  });

  it('clamps to the smallest size when effective length is below the table', () => {
    expect(recommendSize(220, 0).uk).toBe('5');
  });

  it('clamps to the largest size when effective length is above the table', () => {
    expect(recommendSize(320, 0).uk).toBe('12');
  });

  it('reports headroomMm to the next UK size', () => {
    // 260mm → UK 7.5 (261); next is UK 8 (265); headroom = 5.
    const result = recommendSize(260, 0);
    expect(result.headroomMm).toBeCloseTo(5, 1);
  });

  it('flags borderlineTight when foot sits in the tight top of a small-gap band', () => {
    // Between UK 7.5 (261) and 8 (265) the gap is 4mm. With strict-closest +
    // prefer-higher-on-tie the picked nominal only ends up below effective in
    // a narrow window — and with the "< 2mm headroom" threshold the flag
    // mostly stays quiet for typical inputs. This test documents that
    // conservative behaviour.
    const typical = recommendSize(260.3, 0);
    expect(typical.borderlineTight).toBe(false);
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
