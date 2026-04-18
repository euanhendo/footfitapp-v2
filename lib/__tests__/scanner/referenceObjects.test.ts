import { REFERENCE_OBJECTS, getReferenceObject } from '../../scanner/referenceObjects';

describe('referenceObjects', () => {
  it('exposes ISO A4 dimensions', () => {
    const a4 = getReferenceObject('a4');
    expect(a4.longMm).toBe(297);
    expect(a4.shortMm).toBe(210);
  });

  it('exposes ISO/IEC 7810 ID-1 card dimensions', () => {
    const card = getReferenceObject('card');
    expect(card.longMm).toBeCloseTo(85.6, 2);
    expect(card.shortMm).toBeCloseTo(53.98, 2);
  });

  it('treats a coin as a square reference (diameter for both sides)', () => {
    const coin = getReferenceObject('coin_gbp_1');
    expect(coin.longMm).toBe(coin.shortMm);
  });

  it('returns the same object via the record and the getter', () => {
    expect(getReferenceObject('a4')).toBe(REFERENCE_OBJECTS.a4);
  });
});
