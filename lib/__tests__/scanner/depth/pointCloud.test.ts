import { depthFrameToPoints, unprojectPixel } from '../../../scanner/depth/pointCloud';
import { DepthFrame } from '../../../scanner/depth/types';

const intrinsics = { fx: 100, fy: 100, cx: 1, cy: 1 };

function frame(depths: number[], confidence?: number[]): DepthFrame {
  return {
    width: 2,
    height: 2,
    depthMm: new Float32Array(depths),
    confidence: confidence ? new Uint8Array(confidence) : undefined,
    intrinsics,
  };
}

describe('unprojectPixel', () => {
  it('maps the principal point to the optical axis', () => {
    expect(unprojectPixel(1, 1, 500, intrinsics)).toEqual({ x: 0, y: 0, z: 500 });
  });

  it('scales lateral offset with depth over focal length', () => {
    const p = unprojectPixel(2, 1, 500, intrinsics);
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(0);
  });
});

describe('depthFrameToPoints', () => {
  it('drops invalid depths', () => {
    const points = depthFrameToPoints(frame([500, 0, NaN, 9000]));
    expect(points).toHaveLength(1);
    expect(points[0].z).toBe(500);
  });

  it('drops pixels below the confidence floor when a map is present', () => {
    const points = depthFrameToPoints(frame([500, 500, 500, 500], [2, 1, 0, 2]));
    expect(points).toHaveLength(2);
  });

  it('keeps everything when no confidence map exists', () => {
    const points = depthFrameToPoints(frame([500, 500, 500, 500]));
    expect(points).toHaveLength(4);
  });
});
