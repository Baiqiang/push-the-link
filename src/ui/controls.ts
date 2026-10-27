import type { Dir } from '../engine';

/** Same query the CSS uses to hide the D-pad, so the text and the layout always agree. */
export const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'U',
  ArrowRight: 'R',
  ArrowDown: 'D',
  ArrowLeft: 'L',
  w: 'U',
  d: 'R',
  s: 'D',
  a: 'L',
  W: 'U',
  D: 'R',
  S: 'D',
  A: 'L',
};

export function keyToDir(key: string): Dir | null {
  return KEY_DIRS[key] ?? null;
}

/** Swipe on the board: one swipe = one move. */
export function bindSwipe(el: HTMLElement, onDir: (d: Dir) => void, onTap?: (e: PointerEvent) => void): void {
  let start: { x: number; y: number; id: number } | null = null;
  el.addEventListener('pointerdown', (e) => {
    // Gestures that start on a button belong to the button.
    if ((e.target as HTMLElement).closest('button')) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  const end = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) {
      onTap?.(e);
      return;
    }
    onDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => (start = null));
}
