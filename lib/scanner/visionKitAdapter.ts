import { detectScene } from '../../modules/footfit-vision';
import { pickFootFromQuad } from './contourPicker';
import { DetectedContours, ReferenceKind } from './types';

export const visionKitAdapter = {
  detectContours: async (
    imageUri: string,
    _kind: ReferenceKind,
  ): Promise<DetectedContours | null> => {
    const { quad, contours } = await detectScene(imageUri);
    if (!quad) return null;
    return pickFootFromQuad(quad, contours);
  },
};
