import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { activeLinks, attemptMove, LEVELS, type Dir, type GameState, type Level } from '../src/engine';

/**
 * Step-by-step golden trajectories for every level's reference solution.
 * The handoff package's golden_transitions.json was not provided, so this file is
 * generated from the engine once its BFS results matched every reference solution.
 * Regenerate with: UPDATE_GOLDEN=1 npm test
 */
const FILE = new URL('./golden_transitions.json', import.meta.url);

function trace(level: Level, moves: string) {
  let s: GameState = level.initial;
  const steps = [];
  for (const d of moves as unknown as Dir[]) {
    const links = activeLinks(level, s);
    const r = attemptMove(level, s, d);
    if (!r.ok) throw new Error(`level ${level.id}: ${d} failed`);
    steps.push({
      input: d,
      player: r.state.player,
      boxes: r.state.boxes,
      events: r.events.map((e) => `${e.entity}:${e.dir}:${e.cause}${e.by ? `<${e.by}` : ''}`),
      fired: r.firedLinks.map((i) => links[i].join('')),
      mode: r.modeAfter,
    });
    s = r.state;
  }
  return { level: level.id, moves, steps };
}

function build() {
  return LEVELS.map((l) => trace(l, l.data.solution));
}

test('golden transitions match', () => {
  const actual = build();
  if (process.env.UPDATE_GOLDEN || !existsSync(FILE)) {
    writeFileSync(FILE, JSON.stringify(actual, null, 1) + '\n');
  }
  const expected = JSON.parse(readFileSync(FILE, 'utf8'));
  expect(expected).toHaveLength(LEVELS.length);
  expect(actual).toEqual(expected);
});
