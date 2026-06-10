import { requireNativeModule } from 'expo-modules-core';

import { Point } from '../../lib/scanner/types';

export type SceneQuadCandidate = {
  quad: Point[];
  brightness: number;
};

export type DetectedScene = {
  quad: Point[] | null;
  candidates: SceneQuadCandidate[];
  contours: Point[][];
  // upright pixel dimensions of the analyzed image; 0 when the installed
  // native module predates orientation support
  width: number;
  height: number;
};

type NativeScene = {
  quad: number[][] | null;
  candidates?: { quad: number[][]; brightness: number }[];
  contours: number[][][];
  width?: number;
  height?: number;
};

type NativeModule = {
  detectScene: (uri: string) => Promise<NativeScene>;
};

const FootfitVision = requireNativeModule<NativeModule>('FootfitVision');

export async function detectScene(uri: string): Promise<DetectedScene> {
  const raw = await FootfitVision.detectScene(uri);
  return {
    quad: raw.quad ? raw.quad.map(([x, y]) => ({ x, y })) : null,
    candidates: (raw.candidates ?? []).map((c) => ({
      quad: c.quad.map(([x, y]) => ({ x, y })),
      brightness: c.brightness,
    })),
    contours: raw.contours.map((contour) => contour.map(([x, y]) => ({ x, y }))),
    width: raw.width ?? 0,
    height: raw.height ?? 0,
  };
}
