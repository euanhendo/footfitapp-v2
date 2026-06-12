import { DepthFrame } from './types';

// v3 boundary, mirroring the VisionAdapter pattern: screens talk to a
// DepthAdapter; only a future lib/scanner/depth/arkitDepthAdapter.ts may
// import the native ARKit bridge. Everything else stays pure and injectable.
export type DepthAdapter = {
  captureDepthFrame: () => Promise<DepthFrame | null>;
};

export function createFixedDepthAdapter(frame: DepthFrame | null): DepthAdapter {
  return { captureDepthFrame: async () => frame };
}
