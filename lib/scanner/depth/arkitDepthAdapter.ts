import {
  captureNativeDepthFrame,
  isDepthSupported,
} from '../../../modules/footfit-vision/depth';
import { base64ToBytes } from './base64';
import { DepthAdapter } from './depthAdapter';
import { DepthFrame } from './types';

// The one file allowed to import the native depth bridge — the depth twin of
// visionKitAdapter. Converts ARKit's metres to the pipeline's mm here, once.
export function isDepthScanSupported(): boolean {
  return isDepthSupported();
}

export const arkitDepthAdapter: DepthAdapter = {
  captureDepthFrame: async (): Promise<DepthFrame | null> => {
    const raw = await captureNativeDepthFrame();
    const count = raw.width * raw.height;
    const bytes = base64ToBytes(raw.depthBase64);
    if (bytes.byteLength < count * 4) return null;
    const metres = new Float32Array(bytes.buffer, bytes.byteOffset, count);
    const depthMm = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      depthMm[i] = metres[i] * 1000;
    }
    const confidenceBytes = raw.confidenceBase64 ? base64ToBytes(raw.confidenceBase64) : null;
    return {
      width: raw.width,
      height: raw.height,
      depthMm,
      confidence:
        confidenceBytes && confidenceBytes.byteLength >= count
          ? confidenceBytes.subarray(0, count)
          : undefined,
      intrinsics: { fx: raw.fx, fy: raw.fy, cx: raw.cx, cy: raw.cy },
      gravity:
        raw.gravity && raw.gravity.length === 3
          ? { x: raw.gravity[0], y: raw.gravity[1], z: raw.gravity[2] }
          : undefined,
    };
  },
};
