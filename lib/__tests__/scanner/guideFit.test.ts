import { assessGuideFit, quadAspect } from '../../scanner/guideFit';
import { Point } from '../../scanner/types';

const IMG_W = 1000;
const IMG_H = 1500;

// Axis-aligned quad centred at (cx, cy) (fractions of the image) whose height
// is heightFrac of the image and whose width follows the given aspect
function quadAt(cx: number, cy: number, heightFrac: number, aspect = 0.71): Point[] {
  const h = heightFrac * IMG_H;
  const w = h * aspect;
  const x0 = cx * IMG_W - w / 2;
  const y0 = cy * IMG_H - h / 2;
  return [
    { x: x0, y: y0 },
    { x: x0 + w, y: y0 },
    { x: x0 + w, y: y0 + h },
    { x: x0, y: y0 + h },
  ];
}

describe('quadAspect', () => {
  it('returns short/long ratio for a portrait rectangle', () => {
    expect(quadAspect(quadAt(0.5, 0.5, 0.6))).toBeCloseTo(0.71, 5);
  });

  it('returns null for malformed input', () => {
    expect(quadAspect([{ x: 0, y: 0 }])).toBeNull();
  });
});

describe('assessGuideFit', () => {
  it('locks when the paper is level, centred, and fills the guide', () => {
    expect(assessGuideFit(quadAt(0.5, 0.5, 0.6), IMG_W, IMG_H)).toBe('locked');
  });

  it('reports no-paper when quad is missing or dims invalid', () => {
    expect(assessGuideFit(null, IMG_W, IMG_H)).toBe('no-paper');
    expect(assessGuideFit(quadAt(0.5, 0.5, 0.6), 0, IMG_H)).toBe('no-paper');
  });

  it('reports tilted when the aspect leaves the A4 window', () => {
    expect(assessGuideFit(quadAt(0.5, 0.5, 0.6, 0.5), IMG_W, IMG_H)).toBe('tilted');
    expect(assessGuideFit(quadAt(0.5, 0.5, 0.6, 0.95), IMG_W, IMG_H)).toBe('tilted');
  });

  it('reports too-small and too-close at the height bounds', () => {
    expect(assessGuideFit(quadAt(0.5, 0.5, 0.3), IMG_W, IMG_H)).toBe('too-small');
    expect(assessGuideFit(quadAt(0.5, 0.5, 0.9), IMG_W, IMG_H)).toBe('too-close');
  });

  it('reports off-centre when the paper sits at the frame edge', () => {
    expect(assessGuideFit(quadAt(0.15, 0.5, 0.5), IMG_W, IMG_H)).toBe('off-centre');
    expect(assessGuideFit(quadAt(0.5, 0.2, 0.5), IMG_W, IMG_H)).toBe('off-centre');
  });
});
