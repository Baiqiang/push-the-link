import type { Transform } from '../engine';

/**
 * Mirror links get a drawn icon instead of a font glyph: a mirror line with two
 * triangles pointing at it (▶|◀). The vertical mirror is the same icon turned 90°,
 * so the two mirrors read as a pair and never look like ⇄ (reverse).
 * Shapes are in a -1..1 box; `toFrame` swaps axes for the vertical mirror.
 */
export interface MirrorShape {
  axis: [x: number, y: number, w: number, h: number];
  triangles: number[][];
}

export function isMirror(t: Transform): t is 'H' | 'V' {
  return t === 'H' || t === 'V';
}

export function mirrorShape(t: 'H' | 'V'): MirrorShape {
  const tri = [
    [-0.95, -0.62, -0.95, 0.62, -0.24, 0],
    [0.95, -0.62, 0.95, 0.62, 0.24, 0],
  ];
  if (t === 'H') return { axis: [-0.08, -1, 0.16, 2], triangles: tri };
  // Vertical mirror: swap x and y.
  return {
    axis: [-1, -0.08, 2, 0.16],
    triangles: tri.map((p) => [p[1], p[0], p[3], p[2], p[5], p[4]]),
  };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Inline SVG version for the DOM panels; uses currentColor. */
export function mirrorSvg(t: 'H' | 'V', size = 16): SVGSVGElement {
  const { axis, triangles } = mirrorShape(t);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-1.1 -1.1 2.2 2.2');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('mirror-icon');
  const rect = document.createElementNS(SVG_NS, 'rect');
  const [x, y, w, h] = axis;
  rect.setAttribute('x', String(x));
  rect.setAttribute('y', String(y));
  rect.setAttribute('width', String(w));
  rect.setAttribute('height', String(h));
  rect.setAttribute('rx', '0.06');
  rect.setAttribute('fill', 'currentColor');
  svg.append(rect);
  for (const p of triangles) {
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', `${p[0]},${p[1]} ${p[2]},${p[3]} ${p[4]},${p[5]}`);
    poly.setAttribute('fill', 'currentColor');
    poly.setAttribute('stroke', 'currentColor');
    poly.setAttribute('stroke-width', '0.12');
    poly.setAttribute('stroke-linejoin', 'round');
    svg.append(poly);
  }
  return svg;
}
