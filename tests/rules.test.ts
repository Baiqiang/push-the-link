import { describe, expect, test } from 'vitest';
import { activeLinks, applyTransform, attemptMove, buildAdjacency, currentMode, flipSwitch, GameSession, parseLevel, rotate, type GameState, type LevelData, type Link } from '../src/engine';

// Rule tests build their own maps so they don't depend on level numbering.
function make(rows: string[], extra: Partial<LevelData>) {
  const data: LevelData = {
    id: 99,
    title: { zh: 't', en: 't' },
    tag: { zh: 't', en: 't' },
    rows,
    note: { zh: '', en: '' },
    tip: { zh: '', en: '' },
    solution: '',
    optimal: 0,
    ...extra,
  };
  return parseLevel(data);
}
const fixed = (rows: string[], links: Link[], free?: string[]) => make(rows, { links, free });

function okMove(...args: Parameters<typeof attemptMove>) {
  const r = attemptMove(...args);
  if (!r.ok) throw new Error(`expected success, got ${JSON.stringify(r.reason)}`);
  return r;
}

const FAR_WALL = fixed(['#########', '#....g..#', '#.@A....#', '#.......#', '#########', '#...#B..#', '#..g....#', '#########'], [['A', 'B', 2]]);
const RIGHT_UP = fixed(['#########', '#.......#', '#...g...#', '#.@A....#', '#..B.g..#', '#.......#', '#.......#', '#########'], [['A', 'B', 3]]);
const RELAY = fixed(['########', '#.g....#', '#@A.g..#', '#.D....#', '#.BCgg.#', '#......#', '########'], [['A', 'B', 0], ['C', 'D', 3]]);
const POLARITY = make(['##########', '#........#', '#..@K....#', '#...A....#', '#......g.#', '##########', '#....B...#', '#.g......#', '##########'], {
  modes: { LEFT: [['A', 'B', 0]], RIGHT: [['A', 'B', 2]] },
  rail: [[4, 2], [5, 2]],
  mode_by_x: 4,
});
const THREE = ['#######', '#.....#', '#@A..g#', '#.....#', '#..B.g#', '#.....#', '#..C.g#', '#.....#', '#######'];

describe('direction transforms', () => {
  test('rotate is clockwise', () => {
    expect(rotate('R', 1)).toBe('D');
    expect(rotate('R', 2)).toBe('L');
    expect(rotate('R', 3)).toBe('U');
  });

  test('mirrors flip one axis only', () => {
    expect(['U', 'R', 'D', 'L'].map((d) => applyTransform(d as never, 'H')).join('')).toBe('ULDR');
    expect(['U', 'R', 'D', 'L'].map((d) => applyTransform(d as never, 'V')).join('')).toBe('DRUL');
  });

  test('reverse traversal uses the inverse transform; one-way links have no reverse edge', () => {
    const adj = buildAdjacency([['A', 'B', 1], ['C', 'D', 'H'], ['E', 'F', 0, '>']]);
    expect(adj.get('B')).toEqual([{ other: 'A', t: 3, linkIndex: 0 }]);
    expect(adj.get('D')).toEqual([{ other: 'C', t: 'H', linkIndex: 1 }]);
    expect(adj.get('E')).toEqual([{ other: 'F', t: 0, linkIndex: 2 }]);
    expect(adj.get('F')).toBeUndefined();
  });
});

describe('core rules (design §9.2)', () => {
  test('T01 a remote box hitting a wall cancels the whole move', () => {
    const r = attemptMove(FAR_WALL, FAR_WALL.initial, 'R');
    expect(r).toEqual({ ok: false, reason: { type: 'wall', entity: 'B', dir: 'L', remote: true } });
    const s = new GameSession(FAR_WALL);
    s.move('R');
    expect(s.steps).toBe(0);
    expect(s.state).toEqual(FAR_WALL.initial);
  });

  test('T02 k=3: B moves up and pushes the player a second time, one step', () => {
    const s = new GameSession(RIGHT_UP);
    const r = s.move('R');
    if (!r.ok) throw new Error('move failed');
    expect(r.state.boxes).toEqual({ A: [4, 3], B: [3, 3] });
    expect(r.state.player).toEqual([3, 2]);
    expect(r.events.filter((e) => e.entity === '@').map((e) => e.cause)).toEqual(['input', 'push']);
    expect(s.steps).toBe(1);
  });

  test('T03 relay: B bumps C, firing C—D; D pushes the player', () => {
    const r = okMove(RELAY, RELAY.initial, 'R');
    expect(r.state.boxes).toEqual({ A: [3, 2], B: [3, 4], C: [4, 4], D: [2, 2] });
    expect(r.state.player).toEqual([2, 1]);
    expect(r.firedLinks).toEqual([0, 1]);
    expect(r.events.find((e) => e.entity === 'C')).toMatchObject({ cause: 'push', by: 'B', dir: 'R' });
    expect(r.events.find((e) => e.entity === 'D')).toMatchObject({ cause: 'link', by: 'C', dir: 'U' });
  });

  test('T04 fork: one box drives two partners, each moves once', () => {
    const lv = fixed(THREE, [['A', 'B', 0], ['A', 'C', 2]]);
    const r = okMove(lv, lv.initial, 'R');
    expect(r.state.boxes).toEqual({ A: [3, 2], B: [4, 4], C: [2, 6] });
    for (const id of ['A', 'B', 'C']) expect(r.events.filter((e) => e.entity === id)).toHaveLength(1);
  });

  test('T05 k=1: A right drives B down; B down drives A right', () => {
    const lv = fixed(['#######', '#.....#', '#@A...#', '#.....#', '#.B...#', '#.....#', '#.g.g.#', '#######'], [['A', 'B', 1]]);
    expect(okMove(lv, lv.initial, 'R').state.boxes.B).toEqual([2, 5]);
    const s: GameState = { player: [2, 3], boxes: { A: [2, 2], B: [2, 4] } };
    const r2 = okMove(lv, s, 'D');
    expect(r2.state.boxes).toEqual({ A: [3, 2], B: [2, 5] });
  });

  test('T06 pushing K uses the old table this turn and the new one next turn', () => {
    const r = okMove(POLARITY, POLARITY.initial, 'R');
    expect(r.state.boxes.K).toEqual([5, 2]);
    expect([r.modeBefore, r.modeAfter]).toEqual(['LEFT', 'RIGHT']);
    const r2 = attemptMove(POLARITY, r.state, 'D');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toMatchObject({ type: 'wall', entity: 'B', dir: 'U' });
    const base: GameState = { player: [3, 3], boxes: { ...POLARITY.initial.boxes } };
    expect(okMove(POLARITY, base, 'R').state.boxes.B).toEqual([6, 6]);
    expect(okMove(POLARITY, { ...base, boxes: { ...base.boxes, K: [5, 2] } }, 'R').state.boxes.B).toEqual([4, 6]);
  });

  test('T07 K cannot leave its rail', () => {
    const r = okMove(POLARITY, POLARITY.initial, 'R');
    const r2 = attemptMove(POLARITY, r.state, 'R');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toMatchObject({ type: 'rail', entity: 'K' });
    expect(attemptMove(POLARITY, { ...r.state, player: [5, 1] }, 'D').ok).toBe(false);
  });

  test('T08 conflicting link requests roll the whole turn back', () => {
    const lv = fixed(THREE, [['A', 'B', 0], ['A', 'C', 0], ['B', 'C', 2]]);
    const r = attemptMove(lv, lv.initial, 'R');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatchObject({ type: 'conflict', entity: 'C', dir: 'L' });
  });

  test('T08b a repeated request in the same direction is treated as satisfied', () => {
    const lv = fixed(THREE, [['A', 'B', 0], ['A', 'C', 0], ['B', 'C', 0]]);
    const r = okMove(lv, lv.initial, 'R');
    expect(r.state.boxes).toEqual({ A: [3, 2], B: [4, 4], C: [4, 6] });
    expect(r.events.filter((e) => e.entity === 'C')).toHaveLength(1);
  });

  test('T09 undo restores player, every box, K and steps', () => {
    const s = new GameSession(RELAY);
    s.move('R');
    s.undo();
    expect(s.state).toEqual(RELAY.initial);
    const k = new GameSession(POLARITY);
    k.move('R');
    k.move('L');
    k.undo();
    expect(k.state.boxes.K).toEqual([5, 2]);
    k.undo();
    expect(k.state).toEqual(POLARITY.initial);
    expect(k.canUndo).toBe(false);
  });
});

describe('new mechanics', () => {
  test('mirror H: A right → B left, A up → B up', () => {
    const lv = fixed(['#######', '#....@#', '#.A...#', '#.....#', '#..B..#', '#.....#', '#g...g#', '#######'], [['A', 'B', 'H']]);
    const right = okMove(lv, { player: [1, 2], boxes: lv.initial.boxes }, 'R');
    expect(right.state.boxes.B).toEqual([2, 4]);
    const up = okMove(lv, { player: [2, 3], boxes: lv.initial.boxes }, 'U');
    expect(up.state.boxes).toEqual({ A: [2, 1], B: [3, 3] });
  });

  test('one-way: pushing the source drags the target, pushing the target moves only it', () => {
    const lv = fixed(['#######', '#.....#', '#@A..g#', '#.....#', '#.B..g#', '#.....#', '#######'], [['A', 'B', 0, '>']]);
    const r = okMove(lv, lv.initial, 'R');
    expect(r.state.boxes).toEqual({ A: [3, 2], B: [3, 4] });
    const r2 = okMove(lv, { player: [1, 4], boxes: lv.initial.boxes }, 'R');
    expect(r2.state.boxes).toEqual({ A: [2, 2], B: [3, 4] });
  });

  test('shadow: a box linked to @ copies every step, even plain walking', () => {
    const lv = fixed(['#######', '#.@...#', '#.....#', '#######', '#..A..#', '#....g#', '#######'], [['@', 'A', 2]]);
    const r = okMove(lv, lv.initial, 'R');
    expect(r.state.player).toEqual([3, 1]);
    expect(r.state.boxes.A).toEqual([2, 4]);
    // The shadow blocked by a wall blocks you too.
    const r2 = attemptMove(lv, { player: [2, 2], boxes: { A: [3, 5] } }, 'U');
    expect(r2).toEqual({ ok: false, reason: { type: 'wall', entity: 'A', dir: 'D', remote: true } });
  });

  test('shadow pushes a free crate in its own room', () => {
    const lv = fixed(['#######', '#.@...#', '#.....#', '#######', '#.AC..#', '#....g#', '#.g...#', '#######'], [['@', 'A', 0]], ['C']);
    const r = okMove(lv, lv.initial, 'R');
    expect(r.state.boxes).toEqual({ A: [3, 4], C: [4, 4] });
  });

  test('shadow vs. your own push: same direction is fine, opposite is a conflict', () => {
    const same = fixed(['#######', '#.....#', '#.@A..#', '#.....#', '#..g..#', '#######'], [['@', 'A', 0]]);
    expect(okMove(same, same.initial, 'R').state.boxes.A).toEqual([4, 2]);
    const opp = fixed(['#######', '#.....#', '#.@A..#', '#.....#', '#..g..#', '#######'], [['@', 'A', 2]]);
    const r = attemptMove(opp, opp.initial, 'R');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.type).toBe('conflict');
  });

  test('a two-way link to @ is strict: pushing your own shadow sideways conflicts', () => {
    // A→R asks @ to move D (k=1), but @ is already moving R from the input.
    const lv = fixed(['########', '#.....@#', '#......#', '#.A...g#', '########'], [['A', '@', 1]]);
    const r = attemptMove(lv, { player: [1, 3], boxes: { A: [2, 3] } }, 'R');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatchObject({ type: 'conflict', entity: '@' });
  });

  test('pressure plate: anything on it at turn start selects ON', () => {
    const lv = make(['########', '#......#', '#.@.A..#', '#......#', '########', '#..B..g#', '#g.....#', '########'], {
      plates: [[3, 1]],
      modes: { OFF: [['A', 'B', 0]], ON: [['A', 'B', 2]] },
    });
    expect(currentMode(lv, lv.initial)).toBe('OFF');
    const onPlate: GameState = { player: [3, 1], boxes: lv.initial.boxes };
    expect(currentMode(lv, onPlate)).toBe('ON');
    // Off the plate: same direction.
    const fromPlate: GameState = { player: [3, 2], boxes: { A: [4, 2], B: [3, 5] } };
    const r = okMove(lv, fromPlate, 'R');
    expect(r.state.boxes.B).toEqual([4, 5]);
    // Pushing while standing on the plate uses ON for this move, even though you step off it.
    const s2: GameState = { player: [3, 1], boxes: { A: [3, 2], B: [3, 6] } };
    const r2 = okMove(lv, s2, 'D');
    expect(r2.modeBefore).toBe('ON');
    expect(r2.state.boxes.B).toEqual([3, 5]); // reversed: A down → B up
    expect(r2.modeAfter).toBe('OFF');
  });

  test('validation: free boxes may be unlinked, others may not', () => {
    const rows = ['######', '#@AB.#', '#gg..#', '######'];
    expect(() => fixed(rows, [])).toThrow(/unlinked/);
    expect(() => fixed(rows, [['@', 'A', 0]])).toThrow(/B is unlinked/);
    expect(fixed(rows, [['@', 'A', 0]], ['B']).targetIds).toEqual(['A', 'B']);
  });
});

describe('several track switches', () => {
  const ROWS = ['#########', '#..K....#', '#..J....#', '#.@A..g.#', '#########', '#..B..C.#', '#g....g.#', '#########'];
  const K = { id: 'K', rail: [[3, 1], [4, 1]] as [number, number][], mode_by_x: 3 };
  const J = { id: 'J', rail: [[3, 2], [4, 2]] as [number, number][], mode_by_x: 3 };
  // Independent: K sets A—B, J sets A—C.
  const indep = make(ROWS, {
    switches: [
      { ...K, modes: { LEFT: [['A', 'B', 0]], RIGHT: [['A', 'B', 2]] } },
      { ...J, modes: { LEFT: [['A', 'C', 0]], RIGHT: [['A', 'C', 2]] } },
    ],
  });
  const pushA = (k: number, j: number): GameState => ({ player: [2, 3], boxes: { ...indep.initial.boxes, K: [k, 1], J: [j, 2] } });

  test('each switch controls its own link; the mode key joins positions in order', () => {
    expect(indep.boxIds).toEqual(['A', 'B', 'C', 'K', 'J']);
    expect(currentMode(indep, indep.initial)).toBe('LEFT|LEFT');
    const cases: Array<[number, number, number, number]> = [
      [3, 3, 4, 7],
      [4, 3, 2, 7],
      [3, 4, 4, 5],
      [4, 4, 2, 5],
    ];
    for (const [k, j, bx, cx] of cases) {
      const r = okMove(indep, pushA(k, j), 'R');
      expect([r.state.boxes.B[0], r.state.boxes.C[0]]).toEqual([bx, cx]);
    }
  });

  test('pushing J flips only J, from the next move; J stays on its own rail', () => {
    const r = okMove(indep, { ...indep.initial, player: [2, 2] }, 'R');
    expect(r.state.boxes.J).toEqual([4, 2]);
    expect([r.modeBefore, r.modeAfter]).toEqual(['LEFT|LEFT', 'LEFT|RIGHT']);
    const r2 = attemptMove(indep, r.state, 'R');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toMatchObject({ type: 'rail', entity: 'J' });
    expect(flipSwitch(indep, 'LEFT|RIGHT', 'K')).toBe('RIGHT|RIGHT');
  });

  test('a combined table gives each of the four positions its own network', () => {
    const combo = make(ROWS, {
      switches: [K, J],
      modes: {
        'LEFT|LEFT': [['A', 'B', 0], ['A', 'C', 0]],
        'LEFT|RIGHT': [['A', 'B', 0], ['B', 'C', 2]],
        'RIGHT|LEFT': [['A', 'C', 1], ['B', 'C', 0]],
        'RIGHT|RIGHT': [['A', 'B', 'H'], ['A', 'C', 'V']],
      },
    });
    expect(activeLinks(combo, { ...combo.initial, boxes: { ...combo.initial.boxes, K: [4, 1] } })).toEqual([['A', 'C', 1], ['B', 'C', 0]]);
  });

  test('validation: every position must keep each box linked; switch letters need rails', () => {
    expect(() =>
      make(ROWS, { switches: [K, J], modes: { 'LEFT|LEFT': [['A', 'B', 0], ['A', 'C', 0]], 'LEFT|RIGHT': [['A', 'B', 0], ['A', 'C', 0]], 'RIGHT|LEFT': [['A', 'B', 0], ['A', 'C', 0]] } }),
    ).toThrow(/unlinked/);
    expect(() => make(ROWS, { switches: [{ ...K, modes: { LEFT: [['A', 'B', 0], ['A', 'C', 0]], RIGHT: [['A', 'B', 0], ['A', 'C', 0]] } }] })).toThrow(/J is on the map but has no rail/);
    expect(() => make(ROWS, { switches: [K, J], modes: { UP: [] } })).toThrow(/unknown mode/);
  });
});

describe('atomicity and misc', () => {
  test('player walking into a wall fails without a remote flag', () => {
    const r = attemptMove(FAR_WALL, { ...FAR_WALL.initial, player: [1, 1] }, 'U');
    expect(r).toEqual({ ok: false, reason: { type: 'wall', entity: '@', dir: 'U', remote: false } });
  });

  test('animation phases: link targets move after their driver', () => {
    const r = okMove(RELAY, RELAY.initial, 'R');
    const phase = (id: string) => r.events.find((e) => e.entity === id)!.phase;
    expect([phase('A'), phase('B'), phase('C'), phase('D')]).toEqual([0, 1, 1, 2]);
    expect(r.phases).toBe(3);
  });

  test('level validation rejects bad data', () => {
    expect(() => fixed(['####', '#@A#', '###'], [])).toThrow(/rectangular/);
    expect(() => fixed(['#####', '#@AB#', '#gg.#', '#####'], [['A', 'A', 0]])).toThrow();
    expect(() => fixed(['#####', '#@AB#', '#gg.#', '#####'], [['A', 'C', 0]])).toThrow(/missing/);
    expect(() => fixed(['#####', '#@AB#', '#g..#', '#####'], [['A', 'B', 0]])).toThrow(/goals/);
    expect(() => make(['#####', '#@AB#', '#gg.#', '#####'], { links: [['A', 'B', 0]], plates: [[1, 2]], modes: { OFF: [], ON: [] } })).toThrow();
  });
});
