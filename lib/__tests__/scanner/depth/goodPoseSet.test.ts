import * as fs from 'fs';
import * as path from 'path';
import { base64ToBytes } from '../../../scanner/depth/base64';
import { measureFootFromDepthFrameDebug } from '../../../scanner/depth/footFromDepth';
import { DepthFrame } from '../../../scanner/depth/types';

// Five good-pose device frames (2026-06-17, user's right foot, truth 263 × 107,
// all phone-flat 1.4–2.7° at 583–611 mm — the user shot "the same picture" each
// time). Status after confidence-aware extremity recovery shipped:
//   WIDTH IS SOLVED — every frame reads 105–112 mm vs truth 107 (untouched by
//   recovery, which only adds points beyond the 30–95% width band).
//   LENGTH UNDER-READ IS REDUCED — recovery region-grows the eroded near-floor
//   heel/toe back in, lifting the worst frame from 190 → 224 (raw cores were
//   190/221/241/274/229; floor now ≥ ~221). It is bounded, so nothing over-reads.
//   RESIDUAL: two frames whose whole forefoot dropped to low-confidence have no
//   toe in the depth data beyond the core (only a wide floor-fan, correctly
//   rejected by the width envelope), so they still read ~221/241 — a CAPTURE
//   limit (aim coaching), not a math one. See .claude/decisions/scanner-v3-depth-2026-06.md.
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

  it('extremity recovery lifts the under-read floor without over-reading (truth 263 mm)', () => {
    // Before recovery the worst frame read 190 mm (heel/forefoot eroded). The
    // recovery walks the contiguous near-floor extremity back in, so no good-pose
    // frame now reads catastrophically short...
    expect(Math.min(...lengths)).toBeGreaterThan(215);
    // ...and the per-end cap + width envelope keep it bounded — nothing inflates
    // past the foot (a runaway would re-admit floor noise, as minConf 0 does).
    expect(Math.max(...lengths)).toBeLessThan(285);
  });
});
