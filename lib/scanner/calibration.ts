import { BBox, ReferenceObject } from './types';

export function pixelsPerMm(reference: ReferenceObject, detectedBoxPx: BBox): number {
  const longPx = Math.max(detectedBoxPx.width, detectedBoxPx.height);
  const shortPx = Math.min(detectedBoxPx.width, detectedBoxPx.height);
  if (longPx <= 0 || shortPx <= 0) {
    throw new Error('Reference bbox must have positive width and height');
  }
  const longScale = longPx / reference.longMm;
  const shortScale = shortPx / reference.shortMm;
  return (longScale + shortScale) / 2;
}

export function pxToMm(px: number, pxPerMm: number): number {
  if (pxPerMm <= 0) {
    throw new Error('pxPerMm must be positive');
  }
  return px / pxPerMm;
}

export function calibrationConfidence(reference: ReferenceObject, detectedBoxPx: BBox): number {
  const longPx = Math.max(detectedBoxPx.width, detectedBoxPx.height);
  const shortPx = Math.min(detectedBoxPx.width, detectedBoxPx.height);
  if (longPx <= 0 || shortPx <= 0) return 0;
  const detectedRatio = shortPx / longPx;
  const expectedRatio = reference.shortMm / reference.longMm;
  const ratioError = Math.abs(detectedRatio - expectedRatio) / expectedRatio;
  return Math.max(0, 1 - ratioError);
}
