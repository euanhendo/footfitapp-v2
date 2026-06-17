import * as fs from 'fs';
import * as path from 'path';
import { base64ToBytes } from '../../../scanner/depth/base64';
import { fitFloorPlane, planeBasis, projectToFloorMm } from '../../../scanner/depth/planeFit';
import { depthFrameToPoints, unprojectPixel } from '../../../scanner/depth/pointCloud';
import {
  measureFootFromDepthFrameDebug,
  segmentFootPoints,
  pickAimedCluster,
  orientHeelAtOrigin,
  rearBandWidth,
  TRUST_MIN_CONFIDENCE_V3,
} from '../../../scanner/depth/footFromDepth';
import { DepthFrame } from '../../../scanner/depth/types';

// frame6 (2026-06-17): the first GOOD-POSE device frame — phone flat (tilt
// 2.5°), height 624 mm, foot body cleanly captured. It is rejected anyway, and
// NOT because of pose: the heel's floor-contact pixels return at LOW confidence
// (the sharp heel-to-floor depth cliff), so the medium+ filter erodes the
// rounded ~63 mm heel down to a ~21 mm sliver → heel-shape score ~0 → rejected,
// and length under-reads (244 vs truth 263). Proof below: drop the confidence
// floor and the full heel reappears in the same sensor data. The fix is
// confidence-aware heel recovery (contiguous low-conf points only, no global
// floor), to be built against a small set of these — see the decision note.
function loadFixture(name: string): DepthFrame {
  const raw = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'),
  ).raw;
  const count = raw.width * raw.height;
  const bytes = base64ToBytes(raw.depthBase64);
  const metres = new Float32Array(bytes.buffer, bytes.byteOffset, count);
  const depthMm = new Float32Array(count);
  for (let i = 0; i < count; i++) depthMm[i] = metres[i] * 1000;
  const conf = raw.confidenceBase64 ? base64ToBytes(raw.confidenceBase64) : null;
  return {
    width: raw.width,
    height: raw.height,
    depthMm,
    confidence: conf && conf.byteLength >= count ? conf.subarray(0, count) : undefined,
    intrinsics: { fx: raw.fx, fy: raw.fy, cx: raw.cx, cy: raw.cy },
    gravity:
      raw.gravity && raw.gravity.length === 3
        ? { x: raw.gravity[0], y: raw.gravity[1], z: raw.gravity[2] }
        : undefined,
  };
}

function heelRearBand(frame: DepthFrame, minConf: number): number {
  const points = depthFrameToPoints(frame, 1, 4000, minConf);
  const plane = fitFloorPlane(points)!;
  const band = segmentFootPoints(points, plane);
  const basis = planeBasis(plane.normal);
  const cx = Math.floor(frame.width / 2);
  const cy = Math.floor(frame.height / 2);
  const center = frame.depthMm[cy * frame.width + cx];
  const target =
    center > 0
      ? projectToFloorMm(plane, basis, unprojectPixel(cx, cy, center, frame.intrinsics))
      : { x: 0, y: 0 };
  return rearBandWidth(orientHeelAtOrigin(pickAimedCluster(band, target)));
}

describe('frame6 — good pose rejected by heel confidence-erosion', () => {
  const frame = loadFixture('frame6-goodpose.json');

  it('is currently rejected, with the heel eroded to a thin sliver', () => {
    const dbg = measureFootFromDepthFrameDebug(frame);
    expect(dbg.metrics.confidence).toBeLessThan(TRUST_MIN_CONFIDENCE_V3);
    expect(dbg.rearHeelWidthMm).toBeLessThan(25);
  });

  it('proves the heel IS in the data, just low-confidence', () => {
    // Medium+ filter (production setting) erodes the heel...
    expect(heelRearBand(frame, 1)).toBeLessThan(25);
    // ...but the pixels exist: keep all of them and a real ≥45 mm heel returns.
    expect(heelRearBand(frame, 0)).toBeGreaterThan(45);
  });
});
