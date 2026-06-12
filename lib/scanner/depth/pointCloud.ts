import { CameraIntrinsics, DepthFrame, Vec3 } from './types';

/** Pinhole unprojection: a depth-map pixel to a 3D point in camera space (mm). */
export function unprojectPixel(
  u: number,
  v: number,
  depthMm: number,
  k: CameraIntrinsics,
): Vec3 {
  return {
    x: ((u - k.cx) * depthMm) / k.fx,
    y: ((v - k.cy) * depthMm) / k.fy,
    z: depthMm,
  };
}

const DEFAULT_MAX_DEPTH_MM = 3000;

// Medium (1) and high (2) confidence are trusted; only low (0) — the
// invented depths on laser-absorbing surfaces — is dropped. High-only proved
// too aggressive on device (2026-06-12): ARKit marks object edges medium, so
// the foot outline eroded and read ~196 mm against a 265 mm foot.
const DEFAULT_MIN_CONFIDENCE = 1;

/**
 * Unproject a whole frame into a camera-space point cloud. `stride` subsamples
 * the grid (ARKit depth is 256×192 — stride 1 is ~49k points, fine for the
 * math but worth thinning on older devices). Zero, negative, non-finite and
 * far-away depths are dropped — ARKit emits zeros where it has no estimate —
 * and so are pixels below `minConfidence` when the frame carries a
 * confidence map (invented depths on laser-absorbing surfaces).
 */
export function depthFrameToPoints(
  frame: DepthFrame,
  stride = 1,
  maxDepthMm = DEFAULT_MAX_DEPTH_MM,
  minConfidence = DEFAULT_MIN_CONFIDENCE,
): Vec3[] {
  const points: Vec3[] = [];
  for (let v = 0; v < frame.height; v += stride) {
    for (let u = 0; u < frame.width; u += stride) {
      const i = v * frame.width + u;
      const d = frame.depthMm[i];
      if (!Number.isFinite(d) || d <= 0 || d > maxDepthMm) continue;
      if (frame.confidence && frame.confidence[i] < minConfidence) continue;
      points.push(unprojectPixel(u, v, d, frame.intrinsics));
    }
  }
  return points;
}
