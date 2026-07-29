import * as fs from 'fs';
import * as path from 'path';
import { base64ToBytes } from '../../../scanner/depth/base64';
import {
  endBandWidth,
  measureFootFromDepthFrameDebug,
  rearBandWidth,
  heelShapeScore,
  toeSpanScore,
  toeTaperScore,
  TRUST_MIN_CONFIDENCE_V3,
} from '../../../scanner/depth/footFromDepth';
import { DepthFrame } from '../../../scanner/depth/types';

// Saved real device frames (2026-06-16, iPhone 15 Pro Max, user's right foot,
// ground truth 263 × 107). All five are BAD captures and form the v3 trust
// gate's negative set — see .claude/decisions/scanner-v3-depth-2026-06.md.
// Two failure modes, both rejected by confidence < TRUST_MIN_CONFIDENCE_V3:
//   - leaning shin → heel corrupted to a thin tail → over-reads 308–328
//   - too much leg in frame / forefoot confidence-dropout → stubby under-reads
// Decode is inlined because arkitDepthAdapter imports the native bridge, which
// cannot load in jest; this mirrors decodeNativeDepthFrame exactly.
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

describe('rearBandWidth + heelShapeScore (pure)', () => {
  it('reads a wide heel and ramps to a full score', () => {
    // A 60 mm-wide heel sitting at the datum.
    const heel = [];
    for (let y = 0; y <= 30; y += 5) for (let x = -30; x <= 30; x += 5) heel.push({ x, y });
    expect(rearBandWidth(heel)).toBeCloseTo(60, 0);
    expect(heelShapeScore(60)).toBe(1);
  });

  it('reads a thin leg-tail and scores zero', () => {
    const tail = [];
    for (let y = 0; y <= 30; y += 5) for (let x = -6; x <= 6; x += 3) tail.push({ x, y });
    expect(rearBandWidth(tail)).toBeLessThan(20);
    expect(heelShapeScore(rearBandWidth(tail))).toBe(0);
  });

  it('ignores points beyond the heel band and needs ≥3 points', () => {
    expect(rearBandWidth([{ x: -50, y: 200 }, { x: 50, y: 200 }])).toBe(0);
    expect(rearBandWidth([{ x: 0, y: 0 }, { x: 40, y: 5 }])).toBe(0); // only 2 in band
  });

  it('ramps linearly between tail and heel widths', () => {
    expect(heelShapeScore(20)).toBe(0);
    expect(heelShapeScore(45)).toBe(1);
    expect(heelShapeScore(32.5)).toBeCloseTo(0.5, 1);
  });
});

describe('front-end truncation scores (pure)', () => {
  it('endBandWidth spans only the requested band and needs ≥3 points', () => {
    const pts = [
      { x: -20, y: 2 },
      { x: 25, y: 8 },
      { x: 0, y: 5 },
      { x: -60, y: 40 }, // outside the band
    ];
    expect(endBandWidth(pts, 0, 10)).toBe(45);
    expect(endBandWidth(pts, 0, 4)).toBe(0); // only one point left
  });

  it('toeTaperScore passes toes and zeroes a ball-wide cut edge', () => {
    // Device good frames: front tip 23–37% of ball width.
    expect(toeTaperScore(38, 104)).toBe(1);
    // Device toe-truncated shorts: 79–90%.
    expect(toeTaperScore(99, 110)).toBe(0);
    expect(toeTaperScore(77, 110)).toBeCloseTo(0.5, 1); // 70% — mid-ramp
    expect(toeTaperScore(30, 0)).toBe(0); // degenerate width
  });

  it('toeSpanScore passes real toes and zeroes a phantom frontier', () => {
    expect(toeSpanScore(27)).toBe(1); // narrowest device good frame
    expect(toeSpanScore(8)).toBe(0); // the 321 mm streak frontier
    expect(toeSpanScore(15)).toBeCloseTo(0.5, 1);
  });
});

describe('v3 trust gate — rejects every real negative frame', () => {
  const frames = [
    { name: 'frame1.json', pose: 'vertical', mode: 'stubby', readMm: 179 },
    { name: 'frame2.json', pose: 'vertical', mode: 'leaning', readMm: 308 },
    { name: 'frame3.json', pose: 'leaning', mode: 'leaning', readMm: 196 },
    { name: 'frame4.json', pose: 'leaning', mode: 'stubby', readMm: 157 },
    { name: 'frame5.json', pose: 'relaxed', mode: 'leaning', readMm: 328 },
  ] as const;

  it.each(frames)('rejects $name ($pose, $mode, read $readMm)', ({ name, mode }) => {
    const debug = measureFootFromDepthFrameDebug(loadFixture(name));
    // The whole point: confidence drops below the trust gate, so the burst
    // median would discard this frame.
    expect(debug.metrics.confidence).toBeLessThan(TRUST_MIN_CONFIDENCE_V3);

    if (mode === 'leaning') {
      // Heel corrupted at capture time — the rear is a thin tail, heel-shape
      // factor zeroes the confidence regardless of how foot-shaped it looks.
      expect(debug.rearHeelWidthMm).toBeLessThan(20);
      expect(heelShapeScore(debug.rearHeelWidthMm)).toBe(0);
    } else {
      // Forefoot dropout leaves a real heel but a stubby contour — heel-shape
      // passes, aspect tanks the confidence instead.
      expect(debug.rearHeelWidthMm).toBeGreaterThan(45);
    }
  });
});
