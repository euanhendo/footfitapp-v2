import { pickContours, pickFootFromQuad } from '../../scanner/contourPicker';
import { minAreaRect } from '../../scanner/orientedBBox';
import { Point } from '../../scanner/types';

function rect(x: number, y: number, w: number, h: number): Point[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function footShape(cx: number, cy: number, scale: number): Point[] {
  return [
    { x: cx + 0 * scale, y: cy + 0 * scale },
    { x: cx + 40 * scale, y: cy - 5 * scale },
    { x: cx + 80 * scale, y: cy + 0 * scale },
    { x: cx + 90 * scale, y: cy + 15 * scale },
    { x: cx + 85 * scale, y: cy + 30 * scale },
    { x: cx + 60 * scale, y: cy + 35 * scale },
    { x: cx + 20 * scale, y: cy + 35 * scale },
    { x: cx - 5 * scale, y: cy + 20 * scale },
  ];
}

describe('pickContours', () => {
  it('returns null when fewer than two valid contours are provided', () => {
    expect(pickContours([], 'a4')).toBeNull();
    expect(pickContours([rect(0, 0, 10, 10)], 'a4')).toBeNull();
  });

  it('ignores degenerate contours with fewer than 3 points', () => {
    const result = pickContours(
      [
        [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        rect(0, 0, 297, 210),
        footShape(100, 100, 1),
      ],
      'a4',
    );
    expect(result).not.toBeNull();
    expect(result!.reference).toHaveLength(4);
  });

  it('picks the A4-aspect rectangle as reference and the foot shape as foot', () => {
    const a4 = rect(0, 0, 297, 210);
    const foot = footShape(100, 100, 1);
    const result = pickContours([foot, a4], 'a4');
    expect(result).not.toBeNull();
    expect(result!.reference).toEqual(a4);
    expect(result!.foot).toEqual(foot);
  });

  it('prefers the rectangle over a larger irregular blob when the blob centroid is inside the reference', () => {
    const a4 = rect(0, 0, 297, 210);
    const biggerBlob = footShape(50, 50, 2);
    const result = pickContours([biggerBlob, a4], 'a4');
    expect(result!.reference).toEqual(a4);
    expect(result!.foot).toEqual(biggerBlob);
  });

  it('selects a card-aspect rectangle over an A4-aspect one when kind is card', () => {
    const card = rect(0, 0, 85.6, 53.98);
    const a4 = rect(200, 200, 297, 210);
    const footInsideCard = footShape(20, 10, 0.3);
    const result = pickContours([a4, card, footInsideCard], 'card');
    expect(result!.reference).toEqual(card);
  });

  it('rejects a foot whose centroid sits outside the reference quad', () => {
    const a4 = rect(0, 0, 297, 210);
    const insideFoot = footShape(50, 50, 1);
    const outsideFoot = footShape(1500, 1500, 5);
    const result = pickContours([outsideFoot, a4, insideFoot], 'a4');
    expect(result!.foot).toEqual(insideFoot);
  });

  it('unions all foot-fragment candidates whose centroids are inside the reference', () => {
    const a4 = rect(0, 0, 297, 210);
    const fragmentA = rect(30, 30, 20, 20);
    const fragmentB = rect(210, 110, 20, 20);
    const result = pickContours([fragmentA, a4, fragmentB], 'a4');
    expect(result).not.toBeNull();
    const unioned = minAreaRect(result!.foot);
    const fragLen = Math.max(minAreaRect(fragmentA).lengthMm, minAreaRect(fragmentB).lengthMm);
    expect(unioned.lengthMm).toBeGreaterThan(fragLen * 2);
  });

  it('returns null when no non-reference contour has its centroid inside the reference', () => {
    const a4 = rect(0, 0, 297, 210);
    const farBlob = footShape(2000, 2000, 3);
    const result = pickContours([farBlob, a4], 'a4');
    expect(result).toBeNull();
  });
});

describe('pickFootFromQuad', () => {
  const quad: Point[] = rect(0, 0, 297, 210);

  it('returns null when quad is not 4 corners', () => {
    expect(pickFootFromQuad([], [footShape(50, 50, 1)])).toBeNull();
    expect(pickFootFromQuad(quad.slice(0, 3), [footShape(50, 50, 1)])).toBeNull();
  });

  it('includes contours whose centroid sits inside the quad', () => {
    const foot = footShape(100, 100, 1);
    const result = pickFootFromQuad(quad, [foot]);
    expect(result).not.toBeNull();
    expect(result!.reference).toBe(quad);
    expect(result!.foot).toEqual(foot);
  });

  it('excludes contours whose centroid sits outside the quad', () => {
    const inside = footShape(100, 100, 1);
    const outside = footShape(1500, 1500, 5);
    const result = pickFootFromQuad(quad, [outside, inside]);
    expect(result).not.toBeNull();
    expect(result!.foot).toEqual(inside);
  });

  it('unions multiple inside contours into a single foot', () => {
    const fragA = rect(30, 30, 20, 20);
    const fragB = rect(210, 110, 20, 20);
    const result = pickFootFromQuad(quad, [fragA, fragB]);
    expect(result).not.toBeNull();
    expect(result!.foot).toHaveLength(fragA.length + fragB.length);
  });

  it('returns null when no contour is inside the quad', () => {
    const outside = footShape(2000, 2000, 3);
    expect(pickFootFromQuad(quad, [outside])).toBeNull();
  });
});
