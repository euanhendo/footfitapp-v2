import { computePersonalOffsetMm } from '../fitCalibration';
import { OwnedShoe } from '../ownedShoes';

function shoe(brand: string, model: string, fitRating?: 'tight' | 'true' | 'loose'): OwnedShoe {
  return { brand, model, gender: 'mens', savedAt: '2026-04-20T00:00:00.000Z', fitRating };
}

describe('computePersonalOffsetMm', () => {
  it('returns 0 when no owned shoes', () => {
    expect(computePersonalOffsetMm([], 'Nike')).toBe(0);
  });

  it('returns 0 when no shoes of the brand', () => {
    const shoes = [shoe('Adidas', 'Predator', 'tight')];
    expect(computePersonalOffsetMm(shoes, 'Nike')).toBe(0);
  });

  it('returns 0 when brand shoes exist but none are rated', () => {
    const shoes = [shoe('Nike', 'Phantom'), shoe('Nike', 'Tiempo')];
    expect(computePersonalOffsetMm(shoes, 'Nike')).toBe(0);
  });

  it('one tight Nike rating → -1 mm (push size up)', () => {
    const shoes = [shoe('Nike', 'Phantom', 'tight')];
    expect(computePersonalOffsetMm(shoes, 'Nike')).toBe(-1);
  });

  it('one loose Nike rating → +1 mm (push size down)', () => {
    const shoes = [shoe('Nike', 'Phantom', 'loose')];
    expect(computePersonalOffsetMm(shoes, 'Nike')).toBe(1);
  });

  it('one true-to-size rating → 0 mm', () => {
    const shoes = [shoe('Nike', 'Phantom', 'true')];
    expect(computePersonalOffsetMm(shoes, 'Nike')).toBe(0);
  });

  it('averages ratings for the same brand', () => {
    // tight(-1) + true(0) → mean = -0.5
    const shoes = [shoe('Nike', 'Phantom', 'tight'), shoe('Nike', 'Tiempo', 'true')];
    expect(computePersonalOffsetMm(shoes, 'Nike')).toBe(-0.5);
  });

  it('ignores unrated shoes in the mean (no denominator contribution)', () => {
    // tight(-1) + unrated(skip) → mean = -1, not -0.5
    const shoes = [shoe('Nike', 'Phantom', 'tight'), shoe('Nike', 'Tiempo')];
    expect(computePersonalOffsetMm(shoes, 'Nike')).toBe(-1);
  });

  it('clamps at -2 mm even when many tight ratings', () => {
    const shoes = [
      shoe('Nike', 'A', 'tight'),
      shoe('Nike', 'B', 'tight'),
      shoe('Nike', 'C', 'tight'),
      shoe('Nike', 'D', 'tight'),
    ];
    // mean is -1, but cap is -2; this verifies clamp does not push *past* the mean
    expect(computePersonalOffsetMm(shoes, 'Nike')).toBe(-1);
  });

  it('clamps at +2 mm (defensive — mean cannot exceed +1 with current rules)', () => {
    const shoes = [shoe('Nike', 'A', 'loose'), shoe('Nike', 'B', 'loose')];
    expect(computePersonalOffsetMm(shoes, 'Nike')).toBe(1);
  });

  it('isolates brands — Adidas ratings do not affect Nike offset', () => {
    const shoes = [shoe('Adidas', 'Predator', 'tight'), shoe('Nike', 'Phantom', 'loose')];
    expect(computePersonalOffsetMm(shoes, 'Nike')).toBe(1);
    expect(computePersonalOffsetMm(shoes, 'Adidas')).toBe(-1);
  });

  it('brand match is exact (case sensitive)', () => {
    const shoes = [shoe('Nike', 'Phantom', 'tight')];
    expect(computePersonalOffsetMm(shoes, 'nike')).toBe(0);
  });
});
