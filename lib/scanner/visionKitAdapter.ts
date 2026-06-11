import { detectScene } from '../../modules/footfit-vision';
import { pickFootFromQuad, pickReferenceQuad } from './contourPicker';
import { denormalizePoints } from './denormalize';
import { calibrateFootMetrics, measureFromQuadAndFoot } from './footMetrics';
import { DetectedContours, FootMetrics, Point, ReferenceKind } from './types';

export type DetectedQuad = {
  quad: Point[] | null;
  width: number;
  height: number;
};

// Vision coords are normalized to a unit square — convert to pixels, then
// choose the paper among candidate rectangles (bright + A4-shaped beats dark
// floor tiles). Returns a null quad when the scene has no usable paper.
async function detectPaperScene(imageUri: string) {
  const scene = await detectScene(imageUri);
  if (scene.width <= 0 || scene.height <= 0) {
    return { quad: null, contours: [], width: 0, height: 0 };
  }
  const candidatesPx = scene.candidates.map((c) => ({
    ...c,
    quad: denormalizePoints(c.quad, scene.width, scene.height),
  }));
  const fallback = scene.quad ? denormalizePoints(scene.quad, scene.width, scene.height) : null;
  const quad = pickReferenceQuad(candidatesPx) ?? fallback;
  const contours = scene.contours.map((c) => denormalizePoints(c, scene.width, scene.height));
  return { quad, contours, width: scene.width, height: scene.height };
}

export const visionKitAdapter = {
  detectContours: async (
    imageUri: string,
    _kind: ReferenceKind,
  ): Promise<DetectedContours | null> => {
    const { quad, contours } = await detectPaperScene(imageUri);
    if (!quad) return null;
    return pickFootFromQuad(quad, contours);
  },

  // Cheap probe for the auto-capture loop: paper quad in pixel coords only
  detectQuad: async (imageUri: string): Promise<DetectedQuad> => {
    const { quad, width, height } = await detectPaperScene(imageUri);
    return { quad, width, height };
  },

  // Full validated pipeline: paper quad → foot contour → homography-rectified
  // mm metrics with calibration applied
  measureFoot: async (imageUri: string, kind: ReferenceKind): Promise<FootMetrics | null> => {
    const { quad, contours } = await detectPaperScene(imageUri);
    if (!quad) return null;
    const picked = pickFootFromQuad(quad, contours);
    if (!picked) return null;
    return calibrateFootMetrics(measureFromQuadAndFoot(picked.reference, picked.foot, kind));
  },
};
