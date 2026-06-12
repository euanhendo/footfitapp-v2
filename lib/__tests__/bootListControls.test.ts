import {
  applyBootListControls,
  collectBrands,
  BootListFilters,
  ScoredBootWithTotal,
} from '../bootListControls';
import { Boot } from '../fitting';
import { ScoredBoot } from '../fitScore';

function makeBoot(overrides: Partial<Boot>): Boot {
  return {
    brand: 'Nike',
    model: 'X',
    gender: 'mens',
    sport: 'football',
    width: 'standard',
    minLength: 248,
    maxLength: 299,
    minWidth: 89,
    maxWidth: 101,
    price: 150,
    notes: '',
    purchaseUrl: '',
    imageUrl: '',
    ...overrides,
  };
}

function makeScored(boot: Boot, score: number): ScoredBoot {
  return {
    boot,
    score,
    lengthScore: score,
    widthScore: score,
    explanation: '',
    isExactMatch: true,
  };
}

function item(boot: Boot, total: number): ScoredBootWithTotal {
  return { scored: makeScored(boot, total), total };
}

const allWidths: BootListFilters['widths'] = new Set(['narrow', 'standard', 'wide']);

describe('applyBootListControls', () => {
  const a = item(makeBoot({ brand: 'Nike', model: 'A', width: 'narrow', price: 200 }), 90);
  const b = item(makeBoot({ brand: 'Adidas', model: 'B', width: 'standard', price: 100 }), 85);
  const c = item(makeBoot({ brand: 'Puma', model: 'C', width: 'wide', price: 150 }), 80);
  const items = [a, b, c];
  const allBrands = new Set(['Nike', 'Adidas', 'Puma']);

  it('default score sort: highest total first', () => {
    const out = applyBootListControls(items, { widths: allWidths, brands: allBrands }, 'score');
    expect(out.map((i) => i.scored.boot.model)).toEqual(['A', 'B', 'C']);
  });

  it('score sort never lets a width-profile match outrank a higher total', () => {
    const wide92 = item(makeBoot({ brand: 'Puma', model: 'WideLower', width: 'wide', price: 100 }), 92);
    const std94 = item(makeBoot({ brand: 'Nike', model: 'StdHigher', width: 'standard', price: 100 }), 94);
    const out = applyBootListControls(
      [wide92, std94],
      { widths: allWidths, brands: allBrands },
      'score',
      'wide',
    );
    expect(out.map((i) => i.scored.boot.model)).toEqual(['StdHigher', 'WideLower']);
  });

  it('score ties break by width-profile match, then cheaper price', () => {
    const stdTie = item(makeBoot({ brand: 'Nike', model: 'StdTie', width: 'standard', price: 80 }), 90);
    const wideTie = item(makeBoot({ brand: 'Puma', model: 'WideTie', width: 'wide', price: 200 }), 90);
    const wideTieCheap = item(makeBoot({ brand: 'Adidas', model: 'WideTieCheap', width: 'wide', price: 120 }), 90);
    const out = applyBootListControls(
      [stdTie, wideTie, wideTieCheap],
      { widths: allWidths, brands: allBrands },
      'score',
      'wide',
    );
    expect(out.map((i) => i.scored.boot.model)).toEqual(['WideTieCheap', 'WideTie', 'StdTie']);
  });

  it('price-asc: lowest price first', () => {
    const out = applyBootListControls(items, { widths: allWidths, brands: allBrands }, 'price-asc');
    expect(out.map((i) => i.scored.boot.price)).toEqual([100, 150, 200]);
  });

  it('price-desc: highest price first', () => {
    const out = applyBootListControls(items, { widths: allWidths, brands: allBrands }, 'price-desc');
    expect(out.map((i) => i.scored.boot.price)).toEqual([200, 150, 100]);
  });

  it('width filter excludes other widths', () => {
    const out = applyBootListControls(
      items,
      { widths: new Set(['narrow']), brands: allBrands },
      'score',
    );
    expect(out.map((i) => i.scored.boot.width)).toEqual(['narrow']);
  });

  it('empty width set returns no items', () => {
    const out = applyBootListControls(items, { widths: new Set(), brands: allBrands }, 'score');
    expect(out).toEqual([]);
  });

  it('brand filter excludes other brands', () => {
    const out = applyBootListControls(
      items,
      { widths: allWidths, brands: new Set(['Nike', 'Puma']) },
      'score',
    );
    expect(out.map((i) => i.scored.boot.brand).sort()).toEqual(['Nike', 'Puma']);
  });

  it('does not mutate input array', () => {
    const snapshot = [...items];
    applyBootListControls(items, { widths: allWidths, brands: allBrands }, 'price-asc');
    expect(items).toEqual(snapshot);
  });

  describe('surface filter', () => {
    const fg = item(makeBoot({ model: 'FGOnly', surfaces: ['FG', 'SG'] }), 90);
    const turf = item(makeBoot({ model: 'TurfOnly', surfaces: ['TF', 'IC'] }), 85);
    const legacy = item(makeBoot({ model: 'NoSurfaces' }), 80);
    const surfaceItems = [fg, turf, legacy];

    it('keeps only boots sold in the selected surface', () => {
      const out = applyBootListControls(
        surfaceItems,
        { widths: allWidths, brands: allBrands, surface: 'TF' },
        'score',
      );
      expect(out.map((i) => i.scored.boot.model)).toEqual(['TurfOnly']);
    });

    it('null or omitted surface keeps everything', () => {
      const withNull = applyBootListControls(
        surfaceItems,
        { widths: allWidths, brands: allBrands, surface: null },
        'score',
      );
      expect(withNull).toHaveLength(3);
      const omitted = applyBootListControls(
        surfaceItems,
        { widths: allWidths, brands: allBrands },
        'score',
      );
      expect(omitted).toHaveLength(3);
    });

    it('excludes boots without surface data when a surface is selected', () => {
      const out = applyBootListControls(
        surfaceItems,
        { widths: allWidths, brands: allBrands, surface: 'FG' },
        'score',
      );
      expect(out.map((i) => i.scored.boot.model)).toEqual(['FGOnly']);
    });
  });

  describe('width profile preference (score sort)', () => {
    const narrowA = item(makeBoot({ brand: 'Nike', model: 'NarrowA', width: 'narrow', price: 200 }), 80);
    const standardB = item(makeBoot({ brand: 'Adidas', model: 'StandardB', width: 'standard', price: 100 }), 82);
    const standardC = item(makeBoot({ brand: 'Puma', model: 'StandardC', width: 'standard', price: 150 }), 95);
    const allBrandsSet = new Set(['Nike', 'Adidas', 'Puma']);

    it('floats close-scoring matching-width boot above non-matching', () => {
      const out = applyBootListControls(
        [standardB, narrowA],
        { widths: allWidths, brands: allBrandsSet },
        'score',
        'narrow',
      );
      expect(out.map((i) => i.scored.boot.model)).toEqual(['NarrowA', 'StandardB']);
    });

    it('does not override a clearly higher-scoring non-matching boot', () => {
      const out = applyBootListControls(
        [standardC, narrowA],
        { widths: allWidths, brands: allBrandsSet },
        'score',
        'narrow',
      );
      expect(out.map((i) => i.scored.boot.model)).toEqual(['StandardC', 'NarrowA']);
    });

    it('does not mutate the displayed total score', () => {
      const out = applyBootListControls(
        [standardB, narrowA],
        { widths: allWidths, brands: allBrandsSet },
        'score',
        'narrow',
      );
      const narrow = out.find((i) => i.scored.boot.model === 'NarrowA');
      expect(narrow?.total).toBe(80);
    });

    it('empty profile = pure score order', () => {
      const out = applyBootListControls(
        [standardB, narrowA],
        { widths: allWidths, brands: allBrandsSet },
        'score',
        '',
      );
      expect(out.map((i) => i.scored.boot.model)).toEqual(['StandardB', 'NarrowA']);
    });

    it('undefined profile = pure score order', () => {
      const out = applyBootListControls(
        [standardB, narrowA],
        { widths: allWidths, brands: allBrandsSet },
        'score',
      );
      expect(out.map((i) => i.scored.boot.model)).toEqual(['StandardB', 'NarrowA']);
    });

    it('price-asc ignores width profile', () => {
      const out = applyBootListControls(
        [standardB, narrowA],
        { widths: allWidths, brands: allBrandsSet },
        'price-asc',
        'narrow',
      );
      expect(out.map((i) => i.scored.boot.price)).toEqual([100, 200]);
    });

    it('price-desc ignores width profile', () => {
      const out = applyBootListControls(
        [standardB, narrowA],
        { widths: allWidths, brands: allBrandsSet },
        'price-desc',
        'narrow',
      );
      expect(out.map((i) => i.scored.boot.price)).toEqual([200, 100]);
    });
  });
});

describe('collectBrands', () => {
  it('returns unique brands sorted alphabetically', () => {
    const items = [
      item(makeBoot({ brand: 'Puma' }), 1),
      item(makeBoot({ brand: 'Nike' }), 1),
      item(makeBoot({ brand: 'Nike' }), 1),
      item(makeBoot({ brand: 'Adidas' }), 1),
    ];
    expect(collectBrands(items)).toEqual(['Adidas', 'Nike', 'Puma']);
  });

  it('returns empty list for empty input', () => {
    expect(collectBrands([])).toEqual([]);
  });
});
