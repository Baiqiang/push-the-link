import type { Dir, GameState, Level, Link, Mode, SwitchDef, SwitchPos, Transform, Vec } from './types';
import { LEVER } from './types';

export const DIRS: Dir[] = ['U', 'R', 'D', 'L'];

export const DELTA: Record<Dir, Vec> = {
  U: [0, -1],
  R: [1, 0],
  D: [0, 1],
  L: [-1, 0],
};

/** Rotate a direction clockwise by k quarter turns. */
export function rotate(dir: Dir, k: number): Dir {
  const i = DIRS.indexOf(dir);
  return DIRS[(((i + k) % 4) + 4) % 4];
}

export function applyTransform(dir: Dir, t: Transform): Dir {
  if (t === 'H') return dir === 'L' ? 'R' : dir === 'R' ? 'L' : dir;
  if (t === 'V') return dir === 'U' ? 'D' : dir === 'D' ? 'U' : dir;
  return rotate(dir, t);
}

/** Rotations invert to the opposite turn; mirrors are their own inverse. */
export function inverseTransform(t: Transform): Transform {
  return typeof t === 'number' ? (((4 - t) % 4) as Transform) : t;
}

export function sameVec(a: Vec, b: Vec): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function occupied(state: GameState, cell: Vec): boolean {
  if (sameVec(state.player, cell)) return true;
  for (const id in state.boxes) if (sameVec(state.boxes[id], cell)) return true;
  return false;
}

/** Position of one track switch, from its x coordinate. */
export function switchPos(sw: SwitchDef, state: GameState): SwitchPos {
  const p = state.boxes[sw.id];
  return p && p[0] > sw.mode_by_x ? 'RIGHT' : 'LEFT';
}

/** All track-switch positions in order, e.g. { K: 'LEFT', J: 'RIGHT' }. */
export function switchPositions(level: Level, state: GameState): Record<string, SwitchPos> {
  return Object.fromEntries(level.switches.map((sw) => [sw.id, switchPos(sw, state)]));
}

/** The switch state as one key (see Mode); null for fixed-link levels. */
export function currentMode(level: Level, state: GameState): Mode | null {
  if (level.switches.length) return level.switches.map((sw) => switchPos(sw, state)).join('|');
  if (level.data.plates) return level.data.plates.some((p) => occupied(state, p)) ? 'ON' : 'OFF';
  return null;
}

/** Plates and single switches have two positions; this is the other one. */
export function otherMode(mode: Mode): Mode {
  return ({ LEFT: 'RIGHT', RIGHT: 'LEFT', OFF: 'ON', ON: 'OFF' } as Record<string, Mode>)[mode] ?? mode;
}

/** Links for a given switch state: always-on links, each switch's own links, then the combined table. */
export function linksForMode(level: Level, mode: Mode): Link[] {
  const d = level.data;
  const out: Link[] = [...(d.links ?? [])];
  if (level.switches.length) {
    const pos = mode.split('|') as SwitchPos[];
    level.switches.forEach((sw, i) => out.push(...(sw.modes?.[pos[i]] ?? [])));
  }
  out.push(...(d.modes?.[mode] ?? []));
  return out;
}

/** The link table active for the next input, given the state before that input. */
export function activeLinks(level: Level, state: GameState): Link[] {
  const mode = currentMode(level, state);
  return mode === null ? level.data.links ?? [] : linksForMode(level, mode);
}

/** The switch state after flipping one track switch (for the "what if" panel). */
export function flipSwitch(level: Level, mode: Mode, id: string): Mode {
  const i = level.switches.findIndex((sw) => sw.id === id);
  return mode
    .split('|')
    .map((p, k) => (k === i ? otherMode(p) : p))
    .join('|');
}

export interface Neighbor {
  other: string;
  /** Transform from the mover's direction to the other end's direction. */
  t: Transform;
  linkIndex: number;
}

/** Adjacency: two-way links get a reverse edge with the inverse transform; one-way links don't. */
export function buildAdjacency(links: Link[]): Map<string, Neighbor[]> {
  const adj = new Map<string, Neighbor[]>();
  const add = (id: string, n: Neighbor) => {
    const list = adj.get(id);
    if (list) list.push(n);
    else adj.set(id, [n]);
  };
  links.forEach(([a, b, t, oneWay], linkIndex) => {
    add(a, { other: b, t, linkIndex });
    if (oneWay !== '>') add(b, { other: a, t: inverseTransform(t), linkIndex });
  });
  return adj;
}

/** Whether `pos` is on the rail of switch `id`. */
export function onRail(level: Level, pos: Vec, id = LEVER): boolean {
  // Rails are stored as JSON number arrays; compare by value, never by reference.
  const sw = level.switches.find((s) => s.id === id);
  return (sw?.rail ?? level.data.rail ?? []).some((r) => sameVec(r, pos));
}

export function isSwitch(level: Level, id: string): boolean {
  return level.switches.some((sw) => sw.id === id);
}
