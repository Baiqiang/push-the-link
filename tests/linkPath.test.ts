import { describe, expect, test } from 'vitest';
import { apexOffset, exitParam, makeCurve, pointAt } from '../src/ui/linkPath';

const T = 60; // tile size in px
const HALF = T * 0.39; // half a box

describe('link arch geometry', () => {
  for (const [name, pa, pb] of [
    ['side by side', [0, 0], [T, 0]],
    ['stacked', [0, 0], [0, T]],
    ['diagonal', [0, 0], [T, T]],
  ] as const) {
    test(`${name}: the label (arch midpoint) clears both boxes`, () => {
      const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      const c = makeCurve([...pa], [...pb], apexOffset(len, T, 0), 1);
      const mid = pointAt(c, 0.5);
      // A label pill is about 0.25 × 0.18 tiles from its centre; keep it off both boxes.
      for (const box of [pa, pb]) {
        const gapX = Math.abs(mid[0] - box[0]) - HALF;
        const gapY = Math.abs(mid[1] - box[1]) - HALF;
        expect(Math.max(gapX - T * 0.25, gapY - T * 0.18)).toBeGreaterThan(0);
      }
    });
  }

  test('the visible line starts and ends on the box borders', () => {
    const c = makeCurve([0, 0], [T, 0], apexOffset(T, T, 0), 1);
    const u0 = exitParam(c, [0, 0], HALF, true);
    const u1 = exitParam(c, [T, 0], HALF, false);
    expect(u0).toBeGreaterThan(0);
    expect(u1).toBeLessThan(1);
    const p0 = pointAt(c, u0);
    const p1 = pointAt(c, u1);
    expect(Math.max(Math.abs(p0[0]), Math.abs(p0[1]))).toBeCloseTo(HALF, 0);
    expect(Math.max(Math.abs(p1[0] - T), Math.abs(p1[1]))).toBeCloseTo(HALF, 0);
  });

  test('far apart, the arch stays shallow; parallel links fan out', () => {
    expect(apexOffset(T * 6, T, 0)).toBeLessThan(T * 0.6);
    expect(apexOffset(T, T, 1)).toBeGreaterThan(apexOffset(T, T, 0) + T * 0.4);
  });

  test('side flips the arch to the other side of the chord', () => {
    const a = pointAt(makeCurve([0, 0], [T, 0], 30, 1), 0.5);
    const b = pointAt(makeCurve([0, 0], [T, 0], 30, -1), 0.5);
    expect(a[1]).toBeCloseTo(30);
    expect(b[1]).toBeCloseTo(-30);
  });
});
