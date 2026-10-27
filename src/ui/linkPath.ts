import type { Vec } from '../engine';

/**
 * Geometry for a link drawn between two entities (pixel space).
 *
 * The link is a cubic arch: both control points sit straight out from the endpoints along
 * the chord's normal, so the line leaves each box sideways and its midpoint (where the
 * label goes) is `apex` away from the chord. Close boxes get a tall arch so the line and
 * label clear both boxes instead of hiding under them.
 */
export interface Curve {
  p0: Vec;
  c1: Vec;
  c2: Vec;
  p3: Vec;
  /** Unit normal the arch bows towards. */
  n: Vec;
}

/** How far the arch's midpoint sits from the chord, in px. */
export function apexOffset(len: number, tile: number, parallel: number): number {
  const long = tile * 0.175 + len * 0.06;
  // Boxes up to ~1.5 tiles apart need the full clearance; it fades out by 3 tiles.
  const near = tile * 0.72 * Math.min(1, Math.max(0, (tile * 3 - len) / (tile * 1.5)));
  return Math.max(long, near) + parallel * tile * 0.45;
}

export function makeCurve(pa: Vec, pb: Vec, apex: number, side: 1 | -1): Curve {
  const dx = pb[0] - pa[0];
  const dy = pb[1] - pa[1];
  const len = Math.hypot(dx, dy) || 1;
  const n: Vec = [(-dy / len) * side, (dx / len) * side];
  // Cubic midpoint = chord midpoint + 0.75 × control offset.
  const b = apex / 0.75;
  return { p0: pa, c1: [pa[0] + n[0] * b, pa[1] + n[1] * b], c2: [pb[0] + n[0] * b, pb[1] + n[1] * b], p3: pb, n };
}

export function pointAt(c: Curve, u: number): Vec {
  const iu = 1 - u;
  const a = iu * iu * iu;
  const b = 3 * iu * iu * u;
  const d = 3 * iu * u * u;
  const e = u * u * u;
  return [a * c.p0[0] + b * c.c1[0] + d * c.c2[0] + e * c.p3[0], a * c.p0[1] + b * c.c1[1] + d * c.c2[1] + e * c.p3[1]];
}

export function tangentAt(c: Curve, u: number): Vec {
  const iu = 1 - u;
  const x = 3 * iu * iu * (c.c1[0] - c.p0[0]) + 6 * iu * u * (c.c2[0] - c.c1[0]) + 3 * u * u * (c.p3[0] - c.c2[0]);
  const y = 3 * iu * iu * (c.c1[1] - c.p0[1]) + 6 * iu * u * (c.c2[1] - c.c1[1]) + 3 * u * u * (c.p3[1] - c.c2[1]);
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/**
 * Curve parameter where the line leaves an endpoint's square (half-size `half` around
 * `center`). Searches the first half from the start, or the second half from the end.
 */
export function exitParam(c: Curve, center: Vec, half: number, fromStart: boolean): number {
  const inside = (u: number) => {
    const p = pointAt(c, u);
    return Math.abs(p[0] - center[0]) <= half && Math.abs(p[1] - center[1]) <= half;
  };
  let lo = fromStart ? 0 : 0.5;
  let hi = fromStart ? 0.5 : 1;
  // Invariant: `lo` side is inside (start) / outside (end).
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (inside(mid) === fromStart) lo = mid;
    else hi = mid;
  }
  return fromStart ? hi : lo;
}
