import { requireNativeModule } from 'expo-modules-core';

// Native ARKit depth bridge. Boundary rule: only
// lib/scanner/depth/arkitDepthAdapter.ts may import this file — everything
// else goes through the DepthAdapter it exposes.
export type NativeDepthFrame = {
  width: number;
  height: number;
  /** Base64 of row-major Float32 depth in metres (ARKit's native unit). */
  depthBase64: string;
  /** Base64 of row-major uint8 confidence (0 low / 1 med / 2 high); '' if unavailable. */
  confidenceBase64: string;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  /** Gravity direction in the scanner maths' camera convention. */
  gravity: number[];
};

type NativeModule = {
  isDepthSupported: () => boolean;
  captureDepthFrame: () => Promise<NativeDepthFrame>;
};

const FootfitDepth = requireNativeModule<NativeModule>('FootfitDepth');

export function isDepthSupported(): boolean {
  return FootfitDepth.isDepthSupported();
}

export function captureNativeDepthFrame(): Promise<NativeDepthFrame> {
  return FootfitDepth.captureDepthFrame();
}
