import { medianMetrics } from '../../scanner/multiCapture';
import { FootMetrics } from '../../scanner/types';

describe('medianMetrics', () => {
  it('passes a single result through unchanged', () => {
    const one: FootMetrics = { lengthMm: 264, widthMm: 98, confidence: 0.8 };
    expect(medianMetrics([one])).toEqual(one);
  });

  it('returns the median of three results per dimension', () => {
    const results: FootMetrics[] = [
      { lengthMm: 264, widthMm: 98, confidence: 0.9 },
      { lengthMm: 262, widthMm: 100, confidence: 0.7 },
      { lengthMm: 266, widthMm: 96, confidence: 0.8 },
    ];
    const m = medianMetrics(results);
    expect(m.lengthMm).toBeCloseTo(264, 5);
    expect(m.widthMm).toBeCloseTo(98, 5);
  });

  it('uses the minimum confidence across inputs', () => {
    const results: FootMetrics[] = [
      { lengthMm: 264, widthMm: 98, confidence: 0.9 },
      { lengthMm: 262, widthMm: 100, confidence: 0.55 },
      { lengthMm: 266, widthMm: 96, confidence: 0.8 },
    ];
    const m = medianMetrics(results);
    expect(m.confidence).toBeCloseTo(0.55, 5);
  });

  it('averages the two middle values for an even-count input', () => {
    const results: FootMetrics[] = [
      { lengthMm: 260, widthMm: 95, confidence: 0.8 },
      { lengthMm: 262, widthMm: 97, confidence: 0.8 },
      { lengthMm: 268, widthMm: 99, confidence: 0.8 },
      { lengthMm: 270, widthMm: 101, confidence: 0.8 },
    ];
    const m = medianMetrics(results);
    expect(m.lengthMm).toBeCloseTo(265, 5);
    expect(m.widthMm).toBeCloseTo(98, 5);
  });

  it('throws on an empty array', () => {
    expect(() => medianMetrics([])).toThrow();
  });

  it('is robust to unsorted input order', () => {
    const results: FootMetrics[] = [
      { lengthMm: 280, widthMm: 110, confidence: 0.9 },
      { lengthMm: 250, widthMm: 85, confidence: 0.9 },
      { lengthMm: 265, widthMm: 100, confidence: 0.9 },
    ];
    const m = medianMetrics(results);
    expect(m.lengthMm).toBeCloseTo(265, 5);
    expect(m.widthMm).toBeCloseTo(100, 5);
  });
});
