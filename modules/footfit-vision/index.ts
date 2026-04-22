import { requireNativeModule } from 'expo-modules-core';

import { Point } from '../../lib/scanner/types';

type NativeModule = {
  detectContours: (uri: string) => Promise<number[][][]>;
};

const FootfitVision = requireNativeModule<NativeModule>('FootfitVision');

export async function detectContours(uri: string): Promise<Point[][]> {
  const raw = await FootfitVision.detectContours(uri);
  return raw.map((contour) => contour.map(([x, y]) => ({ x, y })));
}
