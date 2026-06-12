import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

// Live ARKit preview (camera feed + ~4 Hz depth status). UI primitive like
// expo-camera's CameraView — measurement still flows through the
// DepthAdapter, never through this view.
export type DepthStatus = {
  /** Raw sensor depth at the frame centre, mm. 0 while depth warms up. */
  centerDepthMm: number;
  /** Degrees away from pointing straight down — 0 is perfectly flat. */
  flatTiltDeg: number;
  hasDepth: boolean;
};

type Props = {
  style?: StyleProp<ViewStyle>;
  onDepthStatus?: (event: { nativeEvent: DepthStatus }) => void;
};

const FootfitDepthView: React.ComponentType<Props> = requireNativeViewManager('FootfitDepth');

export default FootfitDepthView;
