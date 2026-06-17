import * as fs from 'fs';
import * as path from 'path';
import { base64ToBytes } from '../../../scanner/depth/base64';
import { measureFootFromDepthFrameDebug } from '../../../scanner/depth/footFromDepth';
import { DepthFrame } from '../../../scanner/depth/types';

// Five good-pose device frames (2026-06-17, user's right foot, truth 263 × 107,
// all phone-flat 1.4–2.7° at 583–611 mm — the user shot "the same picture" each
// time). They establish the two halves of the v3 status:
//   WIDTH IS SOLVED — every frame reads 105–112 mm vs truth 107.
//   LENGTH IS NOT — reads 190, 221, 241, 274, 229 vs truth 263. The dense ball
//   of the foot is captured (hence width), but the thin near-floor extremities
//   (toes especially, heel sometimes) come back low-confidence and are filtered
//   out, so length is short and unstable. Fix = confidence-aware extremity
//   recovery, to be built against this set; these assertions will tighten when
//   it lands. See .claude/decisions/scanner-v3-depth-2026-06.md.
const FILES = [
  'goodpose-11-59-28-960.json',
  'goodpose-12-00-12-046.json',
  'goodpose-12-00-19-305.json',
  'goodpose-12-00-44-024.json',
  'goodpose-12-00-53-786.json',
];

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

describe('good-pose set — width solved, length not yet', () => {
  const lengths = FILES.map((f) => measureFootFromDepthFrameDebug(loadFixture(f)).metrics.lengthMm);
  const widths = FILES.map((f) => measureFootFromDepthFrameDebug(loadFixture(f)).metrics.widthMm);

  it('width is accurate on every good-pose frame (truth ~107 mm)', () => {
    for (const w of widths) {
      expect(w).toBeGreaterThan(100);
      expect(w).toBeLessThan(115);
    }
  });

  it('length is currently unreliable — short and wide-spread (truth 263 mm)', () => {
    // Documents the open length bug: the extremities drop out, so length
    // under-reads and swings. When extremity recovery lands these will cluster
    // near 263 and this characterization should be replaced with a tolerance.
    expect(Math.min(...lengths)).toBeLessThan(210);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeGreaterThan(50);
  });
});
