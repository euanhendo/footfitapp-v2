import { BBox, DetectedContours, Mask, ReferenceKind } from './types';

export type VisionAdapter = {
  segmentFoot: (imageUri: string) => Promise<Mask>;
  detectReference: (
    imageUri: string,
    kind: ReferenceKind,
    hint?: BBox,
  ) => Promise<BBox | null>;
  detectContours?: (
    imageUri: string,
    kind: ReferenceKind,
  ) => Promise<DetectedContours | null>;
};

export function createFixedVisionAdapter(mask: Mask, referenceBox: BBox | null): VisionAdapter {
  return {
    segmentFoot: async () => mask,
    detectReference: async () => referenceBox,
  };
}
