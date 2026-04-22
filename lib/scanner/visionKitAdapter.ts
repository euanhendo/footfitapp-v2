import { detectContours as nativeDetectContours } from '../../modules/footfit-vision';
import { pickContours } from './contourPicker';
import { DetectedContours, ReferenceKind } from './types';

export const visionKitAdapter = {
  detectContours: async (
    imageUri: string,
    kind: ReferenceKind,
  ): Promise<DetectedContours | null> => {
    const contours = await nativeDetectContours(imageUri);
    return pickContours(contours, kind);
  },
};
