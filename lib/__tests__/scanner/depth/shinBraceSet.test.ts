import * as fs from 'fs';
import * as path from 'path';
import { base64ToBytes } from '../../../scanner/depth/base64';
import { measureFootFromDepthFrameDebug } from '../../../scanner/depth/footFromDepth';
import { DepthFrame } from '../../../scanner/depth/types';

// Two shin-brace device frames (2026-07-23, right foot, truth 263 × 107).
// Capture protocol that produced them: seated, foot flat and weighted, top
// edge of the phone braced against the shin so the camera looks straight down
// with the leg physically behind the lens. First protocol to yield TRUSTED
// frames with a real (~97 mm) heel in the rear band.
//
// What they pin after the 2026-07-23 pipeline work (sub-band toe recovery +
// occluded-heel trim retention + toe-presence trust signal):
//   TRUSTED at ~249/254 mm — toe tips (3–5 mm, high-conf, below the 6 mm
//   segmentation floor) are recovered, worth ~5 mm over the truncated core.
//   Honest residual vs the 263 ruler truth: the camera parked over the ankle
//   occludes the last ~10 mm of rear heel pad (probed: no data there), and
//   sub-2 mm toe-tip edges are below LiDAR's resolving floor. Both are
//   capture/sensor limits, NOT math bugs — do not tune thresholds to close
//   them against these two frames.
const FILES = ['shinbrace-16-48-1.json', 'shinbrace-16-48-2.json'];

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

describe('shin-brace set — trusted, toe-recovered, honest occlusion residual', () => {
  const results = FILES.map((f) => measureFootFromDepthFrameDebug(loadFixture(f)));

  it('both frames clear the trust gate with a real heel', () => {
    for (const r of results) {
      expect(r.metrics.confidence).toBeGreaterThanOrEqual(0.8);
      expect(r.rearHeelWidthMm).toBeGreaterThan(45);
    }
  });

  it('length sits in the recovered band — under-read bounded, no over-read', () => {
    for (const r of results) {
      expect(r.metrics.lengthMm).toBeGreaterThan(244);
      expect(r.metrics.lengthMm).toBeLessThan(263);
    }
  });

  it('width stays solved (truth ~107 mm)', () => {
    for (const r of results) {
      expect(r.metrics.widthMm).toBeGreaterThan(100);
      expect(r.metrics.widthMm).toBeLessThan(112);
    }
  });
});
