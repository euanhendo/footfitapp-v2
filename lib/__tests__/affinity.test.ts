import { computeAffinityBoost } from '../fitScore';
import { Boot } from '../fitting';
import { OwnedShoe } from '../ownedShoes';

const boot = (overrides: Partial<Boot> = {}): Boot => ({
  brand: 'Nike',
  model: 'Phantom GX II',
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
  ...overrides,
});

const owned = (overrides: Partial<OwnedShoe> = {}): OwnedShoe => ({
  brand: 'Nike',
  model: 'Phantom GX II',
  gender: 'mens',
  savedAt: '2026-04-14T00:00:00.000Z',
  ...overrides,
});

describe('computeAffinityBoost', () => {
  it('returns zero boost and no match when owned list is empty', () => {
    const result = computeAffinityBoost(boot(), [], []);
    expect(result.boost).toBe(0);
    expect(result.matchedShoe).toBeNull();
  });

  it('gives +5 for same brand but different width', () => {
    const candidate = boot({ brand: 'Nike', width: 'wide' });
    const ownedBoot = boot({ brand: 'Nike', model: 'Mercurial', width: 'standard' });
    const result = computeAffinityBoost(
      candidate,
      [owned({ brand: 'Nike', model: 'Mercurial' })],
      [candidate, ownedBoot],
    );
    expect(result.boost).toBe(5);
    expect(result.matchedShoe?.model).toBe('Mercurial');
  });

  it('gives +5 for same width but different brand', () => {
    const candidate = boot({ brand: 'Adidas', model: 'Predator', width: 'standard' });
    const ownedBoot = boot({ brand: 'Nike', model: 'Phantom', width: 'standard' });
    const result = computeAffinityBoost(
      candidate,
      [owned({ brand: 'Nike', model: 'Phantom' })],
      [candidate, ownedBoot],
    );
    expect(result.boost).toBe(5);
    expect(result.matchedShoe?.brand).toBe('Nike');
  });

  it('gives +10 for same brand and same width', () => {
    const candidate = boot({ brand: 'Nike', width: 'standard' });
    const ownedBoot = boot({ brand: 'Nike', model: 'Phantom GX II', width: 'standard' });
    const result = computeAffinityBoost(
      candidate,
      [owned({ brand: 'Nike', model: 'Phantom GX II' })],
      [candidate, ownedBoot],
    );
    expect(result.boost).toBe(10);
    expect(result.matchedShoe?.brand).toBe('Nike');
  });

  it('caps total boost at +10 regardless of owned count', () => {
    const candidate = boot({ brand: 'Nike', width: 'standard' });
    const catalog = [
      candidate,
      boot({ brand: 'Nike', model: 'Tiempo', width: 'standard' }),
      boot({ brand: 'Nike', model: 'Mercurial', width: 'standard' }),
    ];
    const result = computeAffinityBoost(
      candidate,
      [
        owned({ brand: 'Nike', model: 'Phantom GX II' }),
        owned({ brand: 'Nike', model: 'Tiempo' }),
        owned({ brand: 'Nike', model: 'Mercurial' }),
      ],
      catalog,
    );
    expect(result.boost).toBeLessThanOrEqual(10);
  });

  it('picks the owned shoe with the strongest match as matchedShoe', () => {
    const candidate = boot({ brand: 'Nike', width: 'standard' });
    const catalog = [
      candidate,
      boot({ brand: 'Adidas', model: 'Predator', width: 'wide' }),
      boot({ brand: 'Nike', model: 'Phantom GX II', width: 'standard' }),
    ];
    const result = computeAffinityBoost(
      candidate,
      [
        owned({ brand: 'Adidas', model: 'Predator' }),
        owned({ brand: 'Nike', model: 'Phantom GX II' }),
      ],
      catalog,
    );
    expect(result.matchedShoe?.brand).toBe('Nike');
    expect(result.boost).toBe(10);
  });

  it('returns zero when brand and width both differ from every owned shoe', () => {
    const candidate = boot({ brand: 'Puma', width: 'wide' });
    const ownedBoot = boot({ brand: 'Nike', model: 'Phantom', width: 'standard' });
    const result = computeAffinityBoost(
      candidate,
      [owned({ brand: 'Nike', model: 'Phantom' })],
      [candidate, ownedBoot],
    );
    expect(result.boost).toBe(0);
    expect(result.matchedShoe).toBeNull();
  });
});
