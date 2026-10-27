// Second round: themes built around mechanics that break network rigidity
// (a fully two-way network only has one degree of freedom, so it plays like a maze).
import type { Link, LevelData, Transform } from '../src/engine';
import type { Theme } from './generate';

const mapLinks = (d: LevelData, f: (l: Link) => Link): LevelData => {
  const map = (ls?: Link[]) => ls?.map(f);
  const modes = d.modes ? Object.fromEntries(Object.entries(d.modes).map(([k, v]) => [k, map(v)])) : undefined;
  return { ...d, links: map(d.links), modes };
};
/** The shadow's transform must matter: every other transform must reject the solution. */
const otherTransforms = (d: LevelData) => {
  const own = (d.links ?? []).find(([a]) => a === '@')?.[2];
  return ([0, 1, 2, 3, 'H', 'V'] as Transform[]).filter((x) => x !== own).map((x) => mapLinks(d, ([a, b, t, o]) => (a === '@' ? [a, b, x, o] : [a, b, t, o])));
};
const leverStuck = (d: LevelData) =>
  (['LEFT', 'RIGHT'] as const).map((m) => ({ ...d, links: d.modes![m], modes: undefined, rail: undefined, mode_by_x: undefined, rows: d.rows.map((r) => r.replace('K', '.')) }));
const plateStuck = (d: LevelData) => (['OFF', 'ON'] as const).map((m) => ({ ...d, plates: undefined, modes: undefined, links: d.modes![m] }));
const mirrorAsRotation = (d: LevelData) =>
  ([0, 1, 2, 3] as Transform[]).map((k) => mapLinks(d, ([a, b, t, o]) => [a, b, t === 'H' || t === 'V' ? k : t, o]));

const TWO_ROOMS = ['#########', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#2222222#', '#########'];

export const THEMES2: Theme[] = [
  {
    // You walk an empty room; your shadow plays Sokoban next door.
    name: 'shadow-intro',
    template: ['########', '#111111#', '#111111#', '#111111#', '########', '#222222#', '#222222#', '#222222#', '########'],
    boxes: { A: '2', C: '2' },
    goals: ['2', '2'],
    player: '1',
    free: ['C'],
    networks: [{ links: [['@', 'A', 0]] }, { links: [['@', 'A', 2]] }],
    walls: [2, 5],
    walk: [30, 120],
    opt: [10, 22],
    variants: otherTransforms,
    attempts: 2000,
  },
  {
    name: 'shadow-sokoban',
    template: TWO_ROOMS,
    boxes: { A: '2', C: '2', D: '2' },
    goals: ['2', '2', '2'],
    player: '1',
    free: ['C', 'D'],
    networks: [{ links: [['@', 'A', 2]] }, { links: [['@', 'A', 1]] }, { links: [['@', 'A', 'H']] }, { links: [['@', 'A', 'V']] }],
    walls: [2, 6],
    walk: [60, 300],
    opt: [16, 40],
    variants: otherTransforms,
    attempts: 1500,
  },
  {
    // You and your mirrored twin share one room and one crate.
    name: 'shadow-twins',
    template: ['########', '#......#', '#......#', '#......#', '#......#', '#......#', '########'],
    boxes: { A: '.', C: '.' },
    goals: ['.', '.'],
    player: '.',
    free: ['C'],
    networks: [{ links: [['@', 'A', 'H']] }, { links: [['@', 'A', 'V']] }, { links: [['@', 'A', 2]] }, { links: [['@', 'A', 1]] }],
    walls: [2, 6],
    walk: [60, 300],
    opt: [12, 40],
    variants: otherTransforms,
    attempts: 2000,
  },
  {
    // A lever chooses which of two boxes is your shadow.
    name: 'shadow-lever',
    template: ['#########', '#1111111#', '#11K1111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '2', B: '2', C: '2' },
    goals: ['2', '2', '2'],
    player: '1',
    free: ['C'],
    rail: [[3, 2], [4, 2]],
    mode_by_x: 3,
    networks: [
      { modes: { LEFT: [['@', 'A', 0], ['B', 'A', 2, '>']], RIGHT: [['@', 'B', 0], ['A', 'B', 2, '>']] } },
      { modes: { LEFT: [['@', 'A', 0], ['@', 'B', 2]], RIGHT: [['@', 'A', 2], ['@', 'B', 0]] } },
      { modes: { LEFT: [['@', 'A', 'H'], ['A', 'B', 0, '>']], RIGHT: [['@', 'B', 'V'], ['B', 'A', 0, '>']] } },
    ],
    walls: [2, 5],
    walk: [60, 300],
    opt: [16, 40],
    variants: leverStuck,
    attempts: 1500,
  },
  {
    // Finale: a plate flips how your shadow follows you.
    name: 'finale',
    template: TWO_ROOMS,
    boxes: { A: '2', B: '1', C: '2' },
    goals: ['2', '2', '1'],
    player: '1',
    free: ['C'],
    plates: { region: '1', count: 1 },
    networks: [
      { modes: { OFF: [['@', 'A', 0], ['B', 'A', 2]], ON: [['@', 'A', 2], ['B', 'A', 0]] } },
      { modes: { OFF: [['@', 'A', 'H'], ['B', 'A', 0]], ON: [['@', 'A', 'V'], ['B', 'A', 2]] } },
      { modes: { OFF: [['@', 'A', 0], ['B', 'A', 1, '>']], ON: [['@', 'A', 1], ['B', 'A', 0, '>']] } },
    ],
    walls: [2, 6],
    walk: [60, 300],
    opt: [18, 45],
    variants: plateStuck,
    attempts: 1500,
  },
  {
    name: 'plate-hard',
    template: ['#########', '#1111111#', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '1', B: '1', C: '2' },
    goals: ['1', '1', '2'],
    player: '1',
    plates: { region: '1', count: 1 },
    networks: [
      { modes: { OFF: [['A', 'C', 0], ['B', 'C', 2]], ON: [['A', 'C', 2], ['B', 'C', 0]] } },
      { modes: { OFF: [['A', 'C', 0, '>'], ['B', 'C', 1, '>']], ON: [['A', 'C', 2, '>'], ['B', 'C', 3, '>']] } },
      { modes: { OFF: [['A', 'C', 'H']], ON: [['B', 'C', 'V'], ['A', 'B', 0]] } },
    ],
    walls: [2, 5],
    walk: [60, 300],
    opt: [16, 40],
    variants: plateStuck,
    attempts: 1500,
  },
  {
    // Two mirrored pairs share rooms, so collisions couple the pairs.
    name: 'mirror-hard',
    template: ['#########', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '1', B: '2', C: '1', D: '2' },
    goals: ['1', '2', '1', '2'],
    player: '1',
    networks: [
      { links: [['A', 'B', 'H'], ['C', 'D', 'V']] },
      { links: [['A', 'B', 'V'], ['C', 'D', 'H']] },
      { links: [['A', 'B', 'H'], ['C', 'D', 0]] },
    ],
    walls: [1, 5],
    walk: [60, 300],
    opt: [16, 40],
    variants: mirrorAsRotation,
    attempts: 1500,
  },
  {
    // A drives B one-way; B can still be pushed by hand.
    name: 'oneway-fork',
    template: ['#########', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '1', B: '1', C: '2' },
    goals: ['1', '1', '2'],
    player: '1',
    networks: [
      { links: [['A', 'C', 0, '>'], ['B', 'C', 2, '>']] },
      { links: [['A', 'C', 'H', '>'], ['B', 'C', 'V', '>']] },
      { links: [['A', 'C', 1, '>'], ['B', 'C', 3, '>']] },
    ],
    walls: [1, 5],
    walk: [60, 300],
    opt: [16, 40],
    variants: (d) => [mapLinks(d, ([a, b, t]) => [a, b, t])],
    attempts: 1500,
  },
];
