import { findHeelEdge, measureFromQuadAndFoot, widthAcrossFootBand } from '../../scanner/footMetrics';
import { applyHomography, solveHomography } from '../../scanner/homography';
import { Point } from '../../scanner/types';

function axisAlignedA4(pxPerMm: number): Point[] {
  const w = 297 * pxPerMm;
  const h = 210 * pxPerMm;
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

function rotate(points: Point[], degrees: number, cx: number, cy: number): Point[] {
  const rad = (degrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return points.map((p) => ({
    x: cx + (p.x - cx) * c - (p.y - cy) * s,
    y: cy + (p.x - cx) * s + (p.y - cy) * c,
  }));
}

function footRect(x0: number, x1: number, y0: number, y1: number): Point[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

describe('measureFromQuadAndFoot', () => {
  it('measures axis-aligned A4 with foot crossing a short edge', () => {
    const quad = axisAlignedA4(1);
    const foot = footRect(0, 250, 80, 140);
    const result = measureFromQuadAndFoot(quad, foot, 'a4');
    expect(Math.abs(result.lengthMm - 250)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.widthMm - 60)).toBeLessThanOrEqual(2);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('measures a 30°-rotated A4 with the same tolerance', () => {
    const base = axisAlignedA4(1);
    const foot = footRect(0, 250, 80, 140);
    const cx = 148.5;
    const cy = 105;
    const quad = rotate(base, 30, cx, cy);
    const rotatedFoot = rotate(foot, 30, cx, cy);
    const result = measureFromQuadAndFoot(quad, rotatedFoot, 'a4');
    expect(Math.abs(result.lengthMm - 250)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.widthMm - 60)).toBeLessThanOrEqual(2);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('picks a short edge as heel even when foot crosses a long edge (wrong orientation)', () => {
    const quad = axisAlignedA4(1);
    const foot = footRect(80, 220, 10, 150);
    const result = measureFromQuadAndFoot(quad, foot, 'a4');
    expect(result.lengthMm).toBeGreaterThan(200);
    expect(result.confidence).toBe(0);
  });

  it('returns zeros when quad is not 4 corners', () => {
    const result = measureFromQuadAndFoot([{ x: 0, y: 0 }], [{ x: 1, y: 1 }], 'a4');
    expect(result).toEqual({ lengthMm: 0, widthMm: 0, confidence: 0 });
  });

  it('returns zeros when foot is empty', () => {
    const result = measureFromQuadAndFoot(axisAlignedA4(1), [], 'a4');
    expect(result).toEqual({ lengthMm: 0, widthMm: 0, confidence: 0 });
  });

  it('measures width across the foot axis, not the paper, when the foot is angled', () => {
    const quad = axisAlignedA4(1);
    // 250×60 foot angled 8° on the paper, heel still crossing the short edge
    const foot = rotate(footRect(0, 250, 80, 140), 8, 0, 110);
    const result = measureFromQuadAndFoot(quad, foot, 'a4');
    expect(Math.abs(result.widthMm - 60)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.lengthMm - 250)).toBeLessThanOrEqual(5);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('recovers true size under perspective foreshortening (tilted camera)', () => {
    // Paper in its own mm coordinates: heel edge (wall side) at y = 0
    const paperMm: Point[] = [
      { x: 0, y: 0 },
      { x: 210, y: 0 },
      { x: 210, y: 297 },
      { x: 0, y: 297 },
    ];
    // The photo: wall end farther from the camera, so it appears compressed
    const quadPx: Point[] = [
      { x: 320, y: 100 },
      { x: 700, y: 110 },
      { x: 860, y: 1500 },
      { x: 180, y: 1480 },
    ];
    const project = solveHomography(paperMm, quadPx)!;
    // 275 × 110 mm foot, heel on the wall edge — corners plus side midpoints
    const footMmTruth: Point[] = [
      { x: 70, y: 0 },
      { x: 180, y: 0 },
      { x: 180, y: 137 },
      { x: 180, y: 275 },
      { x: 70, y: 275 },
      { x: 70, y: 137 },
    ];
    const footPx = footMmTruth.map((p) => applyHomography(project, p));
    const result = measureFromQuadAndFoot(quadPx, footPx, 'a4');
    expect(Math.abs(result.lengthMm - 275)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.widthMm - 110)).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThan(0);
  });
});

// Real Vision contours are dense (hundreds of points); sample rect edges
// every ~2mm to match, since the band-width path needs populated slices.
function densifyEdges(corners: Point[], stepMm: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len / stepMm));
    for (let s = 0; s < steps; s++) {
      out.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
    }
  }
  return out;
}

describe('width from the anatomical band', () => {
  it('measures a dense clean foot accurately', () => {
    const quad = axisAlignedA4(1);
    const foot = densifyEdges(footRect(0, 250, 80, 140), 2);
    const result = measureFromQuadAndFoot(quad, foot, 'a4');
    expect(Math.abs(result.lengthMm - 250)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.widthMm - 60)).toBeLessThanOrEqual(2);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('ignores the ankle/leg lobe near the heel (the 130mm width bug)', () => {
    const quad = axisAlignedA4(1);
    // 255 × 110 mm foot with a 150mm-wide leg/ankle lobe over the heel zone —
    // the situation that read a tape-measured 110mm foot as 130mm on device.
    const foot = [
      ...densifyEdges(footRect(0, 255, 55, 165), 2),
      ...densifyEdges(footRect(0, 40, 35, 185), 2),
    ];
    const result = measureFromQuadAndFoot(quad, foot, 'a4');
    expect(Math.abs(result.lengthMm - 255)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.widthMm - 110)).toBeLessThanOrEqual(2);
  });

  it('corrects slice width for a yawed foot via midline drift', () => {
    const quad = axisAlignedA4(1);
    const foot = densifyEdges(rotate(footRect(0, 250, 80, 140), 8, 0, 110), 2);
    const result = measureFromQuadAndFoot(quad, foot, 'a4');
    expect(Math.abs(result.widthMm - 60)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(result.lengthMm - 250)).toBeLessThanOrEqual(5);
  });

  it('returns 0 for degenerate input so callers can fall back', () => {
    expect(widthAcrossFootBand([], 100)).toBe(0);
    expect(widthAcrossFootBand([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], 0)).toBe(0);
  });
});

describe('findHeelEdge', () => {
  it('returns the short edge the foot presses against', () => {
    const quad = axisAlignedA4(1);
    const foot = footRect(0, 250, 80, 140);
    const heel = findHeelEdge(quad, foot);
    expect(heel).not.toBeNull();
    expect(heel!.a.x).toBe(0);
    expect(heel!.b.x).toBe(0);
  });

  it('tracks the heel edge under rotation', () => {
    const cx = 148.5;
    const cy = 105;
    const quad = rotate(axisAlignedA4(1), 30, cx, cy);
    const foot = rotate(footRect(0, 250, 80, 140), 30, cx, cy);
    const heel = findHeelEdge(quad, foot);
    const expected = rotate(
      [
        { x: 0, y: 0 },
        { x: 0, y: 210 },
      ],
      30,
      cx,
      cy,
    );
    expect(heel).not.toBeNull();
    const ends = [heel!.a, heel!.b];
    for (const corner of expected) {
      expect(ends.some((p) => Math.hypot(p.x - corner.x, p.y - corner.y) < 1)).toBe(true);
    }
  });

  it('returns null for malformed input', () => {
    expect(findHeelEdge([{ x: 0, y: 0 }], [{ x: 1, y: 1 }])).toBeNull();
    expect(findHeelEdge(axisAlignedA4(1), [])).toBeNull();
  });
});
