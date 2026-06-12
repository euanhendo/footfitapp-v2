// Depth-scanner (v3) data contracts. The native ARKit bridge will produce a
// DepthFrame; everything downstream of it is pure math. Depth values are
// millimetres along the camera z-axis (ARKit delivers metres — the adapter
// converts once at the boundary so the rest of the pipeline stays mm-only,
// like the rest of lib/scanner).
export type Vec3 = { x: number; y: number; z: number };

export type CameraIntrinsics = {
  /** Focal lengths and principal point in pixels of the depth map's own resolution. */
  fx: number;
  fy: number;
  cx: number;
  cy: number;
};

export type DepthFrame = {
  width: number;
  height: number;
  /** Row-major, length = width * height. Millimetres along the camera z-axis. */
  depthMm: Float32Array;
  /**
   * Per-pixel sensor confidence (0 low / 1 medium / 2 high), row-major.
   * Scene depth is RGB-fused — laser-absorbing surfaces (black fabric) get
   * invented depths flagged low. Absent on synthetic frames.
   */
  confidence?: Uint8Array;
  intrinsics: CameraIntrinsics;
  /** Gravity direction in camera space (unit vector), when the device provides it. */
  gravity?: Vec3;
};

export type FloorPlane = {
  /** Unit normal, oriented toward the camera (so heights above the floor are positive). */
  normal: Vec3;
  /** Signed offset in mm: dot(normal, p) + dMm = 0 for points on the plane. */
  dMm: number;
  /** Fraction of the sampled cloud within the inlier threshold — floor quality signal. */
  inlierRatio: number;
};
