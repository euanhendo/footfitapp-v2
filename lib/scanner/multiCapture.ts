import { FootMetrics } from './types';

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function medianMetrics(results: FootMetrics[]): FootMetrics {
  if (!results || results.length === 0) {
    throw new Error('medianMetrics requires at least one result');
  }
  const lengths = results.map((r) => r.lengthMm);
  const widths = results.map((r) => r.widthMm);
  const minConfidence = results.reduce(
    (acc, r) => (r.confidence < acc ? r.confidence : acc),
    results[0].confidence,
  );
  return {
    lengthMm: median(lengths),
    widthMm: median(widths),
    confidence: minConfidence,
  };
}
