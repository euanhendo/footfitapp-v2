import { Point } from './types';

export type GuideFitStatus =
  | 'no-paper'
  | 'tilted'
  | 'too-small'
  | 'too-close'
  | 'off-centre'
  | 'locked';

// Average short/long side ratio of a detected quad — A4 is ≈ 0.707
export function quadAspect(quad: Point[]): number | null {
  if (!quad || quad.length !== 4) return null;
  const [tl, tr, br, bl] = quad;
  const top = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const right = Math.hypot(br.x - tr.x, br.y - tr.y);
  const bottom = Math.hypot(br.x - bl.x, br.y - bl.y);
  const left = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const horiz = (top + bottom) / 2;
  const vert = (right + left) / 2;
  const long = Math.max(horiz, vert);
  const short = Math.min(horiz, vert);
  if (long === 0) return null;
  return short / long;
}

// Locked = the paper genuinely fills the on-screen guide: level, centred,
// right size. Thresholds validated on-device 2026-06-11 — auto-capture must
// not fire on a sliver of paper at the frame edge.
export function assessGuideFit(quad: Point[] | null, imgW: number, imgH: number): GuideFitStatus {
  if (!quad || quad.length !== 4 || imgW <= 0 || imgH <= 0) return 'no-paper';
  const aspect = quadAspect(quad);
  if (aspect === null || aspect < 0.66 || aspect > 0.78) return 'tilted';
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const heightFrac = (Math.max(...ys) - Math.min(...ys)) / imgH;
  if (heightFrac < 0.4) return 'too-small';
  if (heightFrac > 0.8) return 'too-close';
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2 / imgW;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2 / imgH;
  if (cx < 0.3 || cx > 0.7 || cy < 0.28 || cy > 0.72) return 'off-centre';
  return 'locked';
}
