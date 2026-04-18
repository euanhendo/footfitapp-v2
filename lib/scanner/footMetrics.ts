import { BBox, FootMetrics, Mask } from './types';

const EXPECTED_ASPECT_MIN = 2.0;
const EXPECTED_ASPECT_MAX = 3.8;
const EXPECTED_FILL_MIN = 0.45;
const EXPECTED_FILL_MAX = 0.85;

export function maskBoundingBox(mask: Mask): BBox | null {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[y * mask.width + x]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export function maskPixelCount(mask: Mask): number {
  let count = 0;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i]) count++;
  }
  return count;
}

export function computeFootMetrics(footMask: Mask, pxPerMm: number): FootMetrics {
  if (pxPerMm <= 0) {
    throw new Error('pxPerMm must be positive');
  }
  const bbox = maskBoundingBox(footMask);
  if (!bbox) {
    return { lengthMm: 0, widthMm: 0, confidence: 0 };
  }
  const longPx = Math.max(bbox.width, bbox.height);
  const shortPx = Math.min(bbox.width, bbox.height);
  const lengthMm = longPx / pxPerMm;
  const widthMm = shortPx / pxPerMm;

  const fillRatio = maskPixelCount(footMask) / (bbox.width * bbox.height);
  const aspect = lengthMm / Math.max(widthMm, 1);
  const confidence = scoreConfidence(fillRatio, aspect);

  return { lengthMm, widthMm, confidence };
}

function scoreConfidence(fillRatio: number, aspect: number): number {
  const fill = rangeScore(fillRatio, EXPECTED_FILL_MIN, EXPECTED_FILL_MAX);
  const ratio = rangeScore(aspect, EXPECTED_ASPECT_MIN, EXPECTED_ASPECT_MAX);
  return Math.max(0, Math.min(1, Math.sqrt(fill * ratio)));
}

function rangeScore(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1;
  const centre = (min + max) / 2;
  const halfRange = (max - min) / 2;
  const distance = Math.abs(value - centre) - halfRange;
  return Math.max(0, 1 - distance / halfRange);
}
