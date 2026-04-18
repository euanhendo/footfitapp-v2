import { pixelsPerMm } from '../../scanner/calibration';
import { computeFootMetrics } from '../../scanner/footMetrics';
import { getReferenceObject } from '../../scanner/referenceObjects';
import { Mask } from '../../scanner/types';
import { createFixedVisionAdapter } from '../../scanner/visionAdapter';

function rectMask(width: number, height: number, filled: { x: number; y: number; w: number; h: number }): Mask {
  const data = new Uint8Array(width * height);
  for (let y = filled.y; y < filled.y + filled.h; y++) {
    for (let x = filled.x; x < filled.x + filled.w; x++) {
      data[y * width + x] = 1;
    }
  }
  return { width, height, data };
}

describe('VisionAdapter end-to-end (fake)', () => {
  it('feeds segmentation + reference detection into the scoring pipeline inputs', async () => {
    const a4 = getReferenceObject('a4');
    const referenceBox = { x: 0, y: 0, width: 2100, height: 2970 };
    const footMask = rectMask(3200, 3200, { x: 200, y: 200, w: 2600, h: 950 });
    const adapter = createFixedVisionAdapter(footMask, referenceBox);

    const detected = await adapter.detectReference('file://fake.jpg', 'a4');
    expect(detected).toEqual(referenceBox);

    const detectedWithHint = await adapter.detectReference('file://fake.jpg', 'a4', {
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
    expect(detectedWithHint).toEqual(referenceBox);
    const pxPerMm = pixelsPerMm(a4, detected!);
    expect(pxPerMm).toBeCloseTo(10, 5);

    const mask = await adapter.segmentFoot('file://fake.jpg');
    const metrics = computeFootMetrics(mask, pxPerMm);
    expect(metrics.lengthMm).toBe(260);
    expect(metrics.widthMm).toBe(95);
  });
});
