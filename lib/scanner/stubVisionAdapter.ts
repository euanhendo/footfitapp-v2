import { BBox, Mask, ReferenceKind } from './types';
import { REFERENCE_OBJECTS } from './referenceObjects';
import { VisionAdapter } from './visionAdapter';

const STUB_PX_PER_MM = 0.5;
const STUB_MASK_WIDTH = 200;
const STUB_MASK_HEIGHT = 100;

export const STUB_SCAN_IMAGE_URI = 'stub://phase2-simulated-scan.jpg';

function buildStubFootMask(): Mask {
  const data = new Uint8Array(STUB_MASK_WIDTH * STUB_MASK_HEIGHT);
  const footX = 10;
  const footY = 10;
  const footW = 130;
  const footH = 47;
  const holeX = footX + 20;
  const holeY = footY + 15;
  const holeW = 90;
  const holeH = 25;
  for (let y = footY; y < footY + footH; y++) {
    for (let x = footX; x < footX + footW; x++) {
      const inHole =
        x >= holeX && x < holeX + holeW && y >= holeY && y < holeY + holeH;
      if (!inHole) {
        data[y * STUB_MASK_WIDTH + x] = 1;
      }
    }
  }
  return { width: STUB_MASK_WIDTH, height: STUB_MASK_HEIGHT, data };
}

function buildStubReferenceBox(kind: ReferenceKind): BBox {
  const ref = REFERENCE_OBJECTS[kind];
  return {
    x: 0,
    y: 0,
    width: Math.round(ref.shortMm * STUB_PX_PER_MM),
    height: Math.round(ref.longMm * STUB_PX_PER_MM),
  };
}

export const stubVisionAdapter: VisionAdapter = {
  segmentFoot: async () => buildStubFootMask(),
  detectReference: async (_uri, kind) => buildStubReferenceBox(kind),
};
