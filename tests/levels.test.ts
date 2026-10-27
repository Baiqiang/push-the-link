import { describe, expect, test } from 'vitest';
import { attemptMove, isWon, LEVELS, replay, solve, type Dir } from '../src/engine';

const EXPECTED = [3, 7, 9, 7, 20, 34, 12, 16, 33, 17, 34, 34, 11, 11, 25, 21, 18, 31, 33, 34, 11, 16, 18, 22, 34, 33, 14, 21, 34, 33];

describe('all levels', () => {
  test('ids are 1..n and every level uses a distinct map', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(EXPECTED.map((_, i) => i + 1));
    expect(new Set(LEVELS.map((l) => l.data.rows.join('/'))).size).toBe(LEVELS.length);
  });

  test('reference optimal step counts', () => {
    expect(LEVELS.map((l) => l.data.optimal)).toEqual(EXPECTED);
    expect(LEVELS.map((l) => l.data.solution.length)).toEqual(EXPECTED);
  });

  for (const lv of LEVELS) {
    test(`level ${lv.id}: solution replays, wins only on the last step, BFS finds nothing shorter`, () => {
      const r = replay(lv, lv.data.solution);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.won).toBe(true);
      r.states.slice(0, -1).forEach((s) => expect(isWon(lv, s)).toBe(false));

      const bfs = solve(lv, lv.initial);
      expect(bfs.status).toBe('solved');
      // Several shortest solutions may exist; the length is what must match.
      if (bfs.status === 'solved') expect(bfs.path.length).toBe(lv.data.optimal);
    });
  }

  test('hints work from mid-solution states', () => {
    for (const lv of LEVELS) {
      const r = replay(lv, lv.data.solution.slice(0, 2));
      if (!r.ok) throw new Error('prefix failed');
      const s = r.states[r.states.length - 1];
      const bfs = solve(lv, s);
      expect(bfs.status).toBe('solved');
      if (bfs.status === 'solved') expect(bfs.path.length).toBe(lv.data.optimal - 2);
    }
  });

  test('a dead state reports unsolvable rather than a fake path', () => {
    // Walk reachable states of the quarter-turn level until one has no solution.
    const lv = LEVELS[2];
    const seen = new Set<string>();
    const queue = [lv.initial];
    let dead = null;
    while (queue.length && !dead) {
      const s = queue.shift()!;
      for (const d of ['U', 'R', 'D', 'L'] as Dir[]) {
        const r = attemptMove(lv, s, d, { record: false });
        if (!r.ok) continue;
        const key = JSON.stringify(r.state);
        if (seen.has(key)) continue;
        seen.add(key);
        if (solve(lv, r.state).status === 'unsolvable') dead = r.state;
        queue.push(r.state);
      }
    }
    expect(dead).not.toBeNull();
    expect(solve(lv, dead!).status).toBe('unsolvable');
  });

  test('solver honours its state limit', () => {
    const bfs = solve(LEVELS[14], LEVELS[14].initial, 50);
    expect(bfs.status).toBe('limit');
  });
});
