import { calibrationConfidence, pixelsPerMm, pxToMm } from '../../scanner/calibration';
import { getReferenceObject } from '../../scanner/referenceObjects';

describe('pixelsPerMm', () => {
  it('returns the known scale for an upright A4 sheet at 10 px/mm', () => {
    const a4 = getReferenceObject('a4');
    const box = { x: 0, y: 0, width: 2100, height: 2970 };
    expect(pixelsPerMm(a4, box)).toBeCloseTo(10, 5);
  });

  it('is rotation-agnostic (landscape A4 gives the same scale)', () => {
    const a4 = getReferenceObject('a4');
    const portrait = { x: 0, y: 0, width: 2100, height: 2970 };
    const landscape = { x: 0, y: 0, width: 2970, height: 2100 };
    expect(pixelsPerMm(a4, landscape)).toBeCloseTo(pixelsPerMm(a4, portrait), 5);
  });

  it('averages long- and short-edge scales when aspect is slightly off', () => {
    const a4 = getReferenceObject('a4');
    const box = { x: 0, y: 0, width: 2100, height: 3000 };
    const expected = (3000 / 297 + 2100 / 210) / 2;
    expect(pixelsPerMm(a4, box)).toBeCloseTo(expected, 5);
  });

  it('throws on a zero-size bbox', () => {
    const a4 = getReferenceObject('a4');
    expect(() => pixelsPerMm(a4, { x: 0, y: 0, width: 0, height: 100 })).toThrow();
  });
});

describe('pxToMm', () => {
  it('converts pixels to millimetres using the scale', () => {
    expect(pxToMm(2600, 10)).toBe(260);
  });

  it('throws if pxPerMm is not positive', () => {
    expect(() => pxToMm(100, 0)).toThrow();
  });
});

describe('calibrationConfidence', () => {
  it('is 1.0 when the detected aspect matches the reference exactly', () => {
    const a4 = getReferenceObject('a4');
    const box = { x: 0, y: 0, width: 2100, height: 2970 };
    expect(calibrationConfidence(a4, box)).toBeCloseTo(1, 5);
  });

  it('degrades when the detected aspect drifts from the reference', () => {
    const a4 = getReferenceObject('a4');
    const box = { x: 0, y: 0, width: 1800, height: 2970 };
    expect(calibrationConfidence(a4, box)).toBeLessThan(0.95);
  });

  it('returns 0 for a zero-size bbox', () => {
    const a4 = getReferenceObject('a4');
    expect(calibrationConfidence(a4, { x: 0, y: 0, width: 0, height: 0 })).toBe(0);
  });
});
