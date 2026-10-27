import type { Dir, GameState, Level } from './types';
import { DIRS } from './links';
import { isWon, stateKey } from './level';
import { attemptMove } from './step';

export const DEFAULT_STATE_LIMIT = 200_000;

export type SolveResult =
  | { status: 'solved'; path: Dir[]; explored: number }
  | { status: 'unsolvable'; explored: number }
  | { status: 'limit'; explored: number };

/**
 * Breadth-first search over committed states, using the exact same attemptMove
 * as gameplay. Returns a shortest path, or a non-path status — never a fake path.
 */
export function solve(level: Level, start: GameState, limit = DEFAULT_STATE_LIMIT): SolveResult {
  if (isWon(level, start)) return { status: 'solved', path: [], explored: 1 };

  const startKey = stateKey(level, start);
  const parent = new Map<string, { prev: string; dir: Dir } | null>([[startKey, null]]);
  let frontier: GameState[] = [start];
  let frontierKeys: string[] = [startKey];

  while (frontier.length > 0) {
    const next: GameState[] = [];
    const nextKeys: string[] = [];
    for (let i = 0; i < frontier.length; i++) {
      const s = frontier[i];
      const key = frontierKeys[i];
      for (const d of DIRS) {
        const r = attemptMove(level, s, d, { record: false });
        if (!r.ok) continue;
        const k = stateKey(level, r.state);
        if (parent.has(k)) continue;
        parent.set(k, { prev: key, dir: d });
        if (isWon(level, r.state)) return { status: 'solved', path: tracePath(parent, k), explored: parent.size };
        if (parent.size >= limit) return { status: 'limit', explored: parent.size };
        next.push(r.state);
        nextKeys.push(k);
      }
    }
    frontier = next;
    frontierKeys = nextKeys;
  }
  return { status: 'unsolvable', explored: parent.size };
}

function tracePath(parent: Map<string, { prev: string; dir: Dir } | null>, end: string): Dir[] {
  const path: Dir[] = [];
  let cur = parent.get(end);
  while (cur) {
    path.push(cur.dir);
    cur = parent.get(cur.prev);
  }
  return path.reverse();
}
