import { BBox, Mask, ReferenceKind } from './types';

export type VisionAdapter = {
  segmentFoot: (imageUri: string) => Promise<Mask>;
  detectReference: (
    imageUri: string,
    kind: ReferenceKind,
    hint?: BBox,
  ) => Promise<BBox | null>;
};

export function createFixedVisionAdapter(mask: Mask, referenceBox: BBox | null): VisionAdapter {
  return {
    segmentFoot: async () => mask,
    detectReference: async () => referenceBox,
  };
}
