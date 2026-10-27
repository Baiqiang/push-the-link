// Third round: hard levels. Goals go on the box layouts that are hardest to reach
// (far mode), and candidates are ranked by traps, detours and search-space size.
import type { Link, LevelData, Transform } from '../src/engine';
import type { Theme } from './generate';

const mapLinks = (d: LevelData, f: (l: Link) => Link): LevelData => {
  const map = (ls?: Link[]) => ls?.map(f);
  const modes = d.modes ? Object.fromEntries(Object.entries(d.modes).map(([k, v]) => [k, map(v)])) : undefined;
  return { ...d, links: map(d.links), modes };
};
const mirrorAsRotation = (d: LevelData) =>
  ([0, 1, 2, 3] as Transform[]).map((k) => mapLinks(d, ([a, b, t, o]) => [a, b, t === 'H' || t === 'V' ? k : t, o]));
const twoWay = (d: LevelData) => [mapLinks(d, ([a, b, t]) => [a, b, t])];
const leverStuck = (d: LevelData) =>
  (['LEFT', 'RIGHT'] as const).map((m) => ({ ...d, links: d.modes![m], modes: undefined, rail: undefined, mode_by_x: undefined, rows: d.rows.map((r) => r.replace('K', '.')) }));
const plateStuck = (d: LevelData) => (['OFF', 'ON'] as const).map((m) => ({ ...d, plates: undefined, modes: undefined, links: d.modes![m] }));
const otherShadow = (d: LevelData) => {
  const own = [...(d.links ?? [])].find(([a]) => a === '@')?.[2];
  return ([0, 1, 2, 3, 'H', 'V'] as Transform[]).filter((x) => x !== own).map((x) => mapLinks(d, ([a, b, t, o]) => (a === '@' ? [a, b, x, o] : [a, b, t, o])));
};

const ONE_ROOM = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
const SMALL_ROOM = ['########', '#......#', '#......#', '#......#', '#......#', '########'];
const TWO_ROOMS = ['#########', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#2222222#', '#########'];
const TWO_SMALL = ['#########', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#########'];
const HARD = { hard: true, far: { cap: 150_000, tries: 4 }, cap: 220_000, opt: [20, 45] as [number, number], attempts: 220 };

export const THEMES3: Theme[] = [
  {
    // Ch1 closer: two rigid pairs in one cramped room; collisions are the only way to re-align them.
    name: 'relay-tight',
    template: ONE_ROOM,
    boxes: { A: '.', B: '.', C: '.', D: '.' },
    goals: ['.', '.', '.', '.'],
    player: '.',
    networks: [{ links: [['A', 'B', 2], ['C', 'D', 0]] }, { links: [['A', 'B', 3], ['C', 'D', 2]] }, { links: [['A', 'B', 1], ['C', 'D', 3]] }],
    walls: [3, 8],
    ...HARD,
  },
  {
    // Ch2: two mirror pairs share one room.
    name: 'mirror-tight',
    template: ONE_ROOM,
    boxes: { A: '.', B: '.', C: '.', D: '.' },
    goals: ['.', '.', '.', '.'],
    player: '.',
    networks: [{ links: [['A', 'B', 'H'], ['C', 'D', 'V']] }, { links: [['A', 'B', 'V'], ['C', 'D', 'V']] }, { links: [['A', 'B', 'H'], ['C', 'D', 2]] }],
    walls: [3, 8],
    variants: mirrorAsRotation,
    ...HARD,
  },
  {
    // Ch2: one-way pair in a small room — B can be fixed by hand, A drags it.
    name: 'oneway-tight',
    template: SMALL_ROOM,
    boxes: { A: '.', B: '.' },
    goals: ['.', '.'],
    player: '.',
    networks: [{ links: [['A', 'B', 2, '>']] }, { links: [['A', 'B', 1, '>']] }, { links: [['A', 'B', 'H', '>']] }],
    walls: [2, 6],
    variants: twoWay,
    ...HARD,
    opt: [18, 40],
  },
  {
    // Ch2: a one-way chain A › B › C in one small room.
    name: 'oneway-chain3',
    template: SMALL_ROOM,
    boxes: { A: '.', B: '.', C: '.' },
    goals: ['.', '.', '.'],
    player: '.',
    networks: [
      { links: [['A', 'B', 0, '>'], ['B', 'C', 2, '>']] },
      { links: [['A', 'B', 1, '>'], ['B', 'C', 1, '>']] },
      { links: [['A', 'B', 2, '>'], ['B', 'C', 'V', '>']] },
    ],
    walls: [2, 6],
    variants: twoWay,
    ...HARD,
    far: { cap: 200_000, tries: 4 },
    cap: 260_000,
  },
  {
    // Ch3: lever flips a one-way link; everything in one room.
    name: 'lever-oneway',
    template: ['#########', '#.......#', '#..K....#', '#.......#', '#.......#', '#.......#', '#########'],
    boxes: { A: '.', B: '.' },
    goals: ['.', '.'],
    player: '.',
    rail: [[3, 2], [4, 2]],
    mode_by_x: 3,
    networks: [
      { modes: { LEFT: [['A', 'B', 0, '>']], RIGHT: [['B', 'A', 2, '>']] } },
      { modes: { LEFT: [['A', 'B', 1, '>']], RIGHT: [['A', 'B', 3, '>']] } },
      { modes: { LEFT: [['A', 'B', 'H', '>']], RIGHT: [['B', 'A', 'V', '>']] } },
    ],
    walls: [2, 7],
    variants: leverStuck,
    ...HARD,
  },
  {
    // Ch3: lever with three boxes over two rooms, bigger than level 13.
    name: 'lever-three',
    template: ['#########', '#1111111#', '#11K1111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '1', B: '2', C: '2' },
    goals: ['1', '2', '2'],
    player: '1',
    rail: [[3, 2], [4, 2]],
    mode_by_x: 3,
    networks: [
      { modes: { LEFT: [['A', 'B', 0], ['A', 'C', 2]], RIGHT: [['A', 'B', 2], ['A', 'C', 0]] } },
      { modes: { LEFT: [['A', 'B', 1], ['A', 'C', 0]], RIGHT: [['A', 'B', 0], ['A', 'C', 3]] } },
      { modes: { LEFT: [['A', 'B', 'H'], ['A', 'C', 0]], RIGHT: [['A', 'B', 0], ['A', 'C', 'V']] } },
    ],
    walls: [3, 7],
    variants: leverStuck,
    ...HARD,
  },
  {
    // Ch4: shadow does real Sokoban with two crates in a cramped room.
    name: 'sokoban-hard',
    template: ['#########', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '2', C: '2', D: '2' },
    goals: ['2', '2', '2'],
    player: '1',
    free: ['C', 'D'],
    networks: [{ links: [['@', 'A', 2]] }, { links: [['@', 'A', 0]] }, { links: [['@', 'A', 'H']] }, { links: [['@', 'A', 1]] }],
    walls: [4, 9],
    variants: otherShadow,
    ...HARD,
  },
  {
    // Ch4: you and a mirrored twin share a room with two crates.
    name: 'twins-hard',
    template: ONE_ROOM,
    boxes: { A: '.', C: '.', D: '.' },
    goals: ['.', '.', '.'],
    player: '.',
    free: ['C', 'D'],
    networks: [{ links: [['@', 'A', 'H']] }, { links: [['@', 'A', 'V']] }, { links: [['@', 'A', 2]] }],
    walls: [3, 8],
    variants: otherShadow,
    ...HARD,
  },
  {
    // Ch4: two Sokoban rooms played at once — your crate here, your shadow's crate there.
    name: 'double-sokoban',
    template: TWO_SMALL,
    boxes: { A: '2', C: '2', D: '1' },
    goals: ['2', '1', '2'],
    player: '1',
    free: ['C', 'D'],
    networks: [{ links: [['@', 'A', 0]] }, { links: [['@', 'A', 2]] }, { links: [['@', 'A', 'H']] }, { links: [['@', 'A', 'V']] }],
    walls: [3, 7],
    variants: otherShadow,
    ...HARD,
  },
  {
    // Ch5: a plain crate can hold the plate down — but it also has to end on a goal.
    name: 'plate-crate',
    template: TWO_SMALL,
    boxes: { A: '1', B: '2', C: '1' },
    goals: ['1', '2', '1'],
    player: '1',
    free: ['C'],
    plates: { region: '1', count: 1 },
    networks: [
      { modes: { OFF: [['A', 'B', 0]], ON: [['A', 'B', 2]] } },
      { modes: { OFF: [['A', 'B', 1]], ON: [['A', 'B', 3]] } },
      { modes: { OFF: [['A', 'B', 'H']], ON: [['A', 'B', 'V']] } },
    ],
    walls: [2, 6],
    variants: plateStuck,
    ...HARD,
    far: { cap: 200_000, tries: 4 },
    cap: 260_000,
  },
  {
    // Ch5 finale: plate flips the shadow; B and a crate complicate the shadow room.
    name: 'finale-hard',
    template: TWO_ROOMS,
    boxes: { A: '2', B: '1', C: '2' },
    goals: ['2', '1', '2'],
    player: '1',
    free: ['C'],
    plates: { region: '1', count: 1 },
    networks: [
      { modes: { OFF: [['@', 'A', 0], ['B', 'A', 2]], ON: [['@', 'A', 2], ['B', 'A', 0]] } },
      { modes: { OFF: [['@', 'A', 'H'], ['B', 'A', 0]], ON: [['@', 'A', 'V'], ['B', 'A', 2]] } },
      { modes: { OFF: [['@', 'A', 0], ['B', 'A', 1, '>']], ON: [['@', 'A', 1], ['B', 'A', 0, '>']] } },
    ],
    walls: [3, 8],
    variants: plateStuck,
    ...HARD,
    far: { cap: 200_000, tries: 4 },
    cap: 260_000,
  },
];
