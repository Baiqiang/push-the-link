import type { Link, LevelData, Transform } from '../src/engine';
import type { Theme } from './generate';

const mapLinks = (d: LevelData, f: (l: Link) => Link | null): LevelData => {
  const map = (ls?: Link[]) => ls?.map(f).filter((l): l is Link => !!l);
  const modes = d.modes ? Object.fromEntries(Object.entries(d.modes).map(([k, v]) => [k, map(v)])) : undefined;
  return { ...d, links: map(d.links), modes };
};
/** Replace mirrors by every rotation: the solution must rely on reflecting. */
const mirrorAsRotation = (d: LevelData) =>
  ([0, 1, 2, 3] as Transform[]).map((k) => mapLinks(d, ([a, b, t, o]) => [a, b, t === 'H' || t === 'V' ? k : t, o]));
/** Make one-way links two-way, or reversed. */
const oneWayVariants = (d: LevelData) => [mapLinks(d, ([a, b, t]) => [a, b, t]), mapLinks(d, ([a, b, t, o]) => (o ? [b, a, t, o] : [a, b, t]))];
/** Plates stuck in one position. */
const plateVariants = (d: LevelData) =>
  (['OFF', 'ON'] as const).map((m) => ({ ...d, plates: undefined, modes: undefined, links: d.modes![m] }));
/** Lever stuck in one position. */
const leverVariants = (d: LevelData) =>
  (['LEFT', 'RIGHT'] as const).map((m) => ({ ...d, links: d.modes![m], modes: undefined, rail: undefined, mode_by_x: undefined, rows: d.rows.map((r) => r.replace('K', '.')) }));

export const THEMES: Theme[] = [
  {
    name: 'mirror-intro',
    template: ['########', '#111111#', '#111111#', '#111111#', '########', '#222222#', '#222222#', '#222222#', '########'],
    boxes: { A: '1', B: '2' },
    goals: ['1', '2'],
    player: '1',
    networks: [{ links: [['A', 'B', 'H']] }, { links: [['A', 'B', 'V']] }],
    walls: [1, 4],
    opt: [8, 16],
    variants: mirrorAsRotation,
    attempts: 2500,
  },
  {
    name: 'mirror-hard',
    template: ['#########', '#1111111#', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '1', B: '1', C: '2' },
    goals: ['1', '1', '2'],
    player: '1',
    networks: [
      { links: [['A', 'C', 'H'], ['B', 'C', 'V']] },
      { links: [['A', 'C', 'V'], ['B', 'C', 0]] },
      { links: [['A', 'B', 'H'], ['B', 'C', 'V']] },
    ],
    walls: [2, 6],
    opt: [16, 40],
    variants: mirrorAsRotation,
    attempts: 2500,
  },
  {
    name: 'oneway-intro',
    template: ['########', '#......#', '#......#', '#......#', '#......#', '#......#', '########'],
    boxes: { A: '.', B: '.' },
    goals: ['.', '.'],
    player: '.',
    networks: [{ links: [['A', 'B', 0, '>']] }, { links: [['A', 'B', 2, '>']] }, { links: [['A', 'B', 1, '>']] }],
    walls: [1, 4],
    opt: [9, 18],
    variants: oneWayVariants,
    attempts: 2500,
  },
  {
    name: 'oneway-chain',
    template: ['#########', '#1111111#', '#1111111#', '#1111111#', '#1111111#', '#1111111#', '#########'],
    boxes: { A: '1', B: '1', C: '1' },
    goals: ['1', '1', '1'],
    player: '1',
    networks: [
      { links: [['A', 'B', 0, '>'], ['B', 'C', 0, '>']] },
      { links: [['A', 'B', 2, '>'], ['B', 'C', 1, '>']] },
      { links: [['A', 'B', 1, '>'], ['B', 'C', 'H', '>']] },
      { links: [['A', 'B', 0, '>'], ['B', 'C', 2, '>'], ['C', 'A', 1, '>']] },
    ],
    walls: [2, 6],
    opt: [16, 40],
    variants: oneWayVariants,
    attempts: 2500,
  },
  {
    name: 'shadow-intro',
    template: ['#########', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '2' },
    goals: ['2'],
    player: '1',
    networks: [{ links: [['@', 'A', 0]] }, { links: [['@', 'A', 2]] }],
    walls: [2, 6],
    opt: [8, 16],
    attempts: 2500,
  },
  {
    name: 'shadow-push',
    template: ['#########', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '2', B: '1' },
    goals: ['2', '1'],
    player: '1',
    networks: [
      { links: [['@', 'A', 2], ['A', 'B', 0]] },
      { links: [['@', 'A', 1], ['A', 'B', 2]] },
      { links: [['@', 'A', 'H'], ['B', 'A', 0]] },
      { links: [['@', 'A', 0], ['B', 'A', 2]] },
    ],
    walls: [2, 5],
    opt: [12, 30],
    attempts: 2500,
  },
  {
    name: 'shadow-same-room',
    template: ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'],
    boxes: { A: '.', B: '.' },
    goals: ['.', '.'],
    player: '.',
    networks: [
      { links: [['@', 'A', 2], ['B', 'A', 0]] },
      { links: [['@', 'A', 'H'], ['A', 'B', 'V']] },
      { links: [['@', 'A', 1], ['A', 'B', 0]] },
    ],
    walls: [3, 7],
    opt: [14, 40],
    attempts: 2500,
  },
  {
    name: 'plate-intro',
    template: ['#########', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '1', B: '2' },
    goals: ['1', '2'],
    player: '1',
    plates: { region: '1', count: 1 },
    networks: [
      { modes: { OFF: [['A', 'B', 0]], ON: [['A', 'B', 2]] } },
      { modes: { OFF: [['A', 'B', 0]], ON: [['A', 'B', 1]] } },
      { modes: { OFF: [['A', 'B', 2]], ON: [['A', 'B', 'V']] } },
    ],
    walls: [1, 4],
    opt: [10, 22],
    variants: plateVariants,
    attempts: 2500,
  },
  {
    name: 'plate-hard',
    template: ['#########', '#1111111#', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '1', B: '1', C: '2' },
    goals: ['1', '1', '2'],
    player: '1',
    plates: { region: '1', count: 1 },
    networks: [
      { modes: { OFF: [['A', 'C', 0], ['B', 'C', 2]], ON: [['A', 'C', 2], ['B', 'C', 0]] } },
      { modes: { OFF: [['A', 'C', 0], ['B', 'A', 0]], ON: [['B', 'C', 1], ['A', 'B', 2]] } },
      { modes: { OFF: [['A', 'C', 'H']], ON: [['B', 'C', 'V'], ['A', 'B', 0]] } },
    ],
    walls: [2, 5],
    opt: [16, 40],
    variants: plateVariants,
    attempts: 2500,
  },
  {
    name: 'lever-hard',
    template: ['#########', '#1111111#', '#11K1111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '1', B: '2', C: '2' },
    goals: ['1', '2', '2'],
    player: '1',
    rail: [[3, 2], [4, 2]],
    mode_by_x: 3,
    networks: [
      { modes: { LEFT: [['A', 'B', 0], ['A', 'C', 2]], RIGHT: [['A', 'B', 2], ['A', 'C', 0]] } },
      { modes: { LEFT: [['A', 'B', 1], ['B', 'C', 0]], RIGHT: [['A', 'C', 3], ['B', 'C', 2]] } },
      { modes: { LEFT: [['A', 'B', 'H'], ['A', 'C', 'V']], RIGHT: [['A', 'B', 'V'], ['A', 'C', 'H']] } },
    ],
    walls: [2, 5],
    opt: [16, 40],
    variants: leverVariants,
    attempts: 2500,
  },
  {
    name: 'fork-hard',
    template: ['#########', '#1111111#', '#1111111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#########'],
    boxes: { A: '1', B: '2', C: '2' },
    goals: ['1', '2', '2'],
    player: '1',
    networks: [{ links: [['A', 'B', 0], ['A', 'C', 2]] }, { links: [['A', 'B', 1], ['A', 'C', 3]] }, { links: [['A', 'B', 0], ['A', 'C', 1]] }],
    walls: [2, 5],
    opt: [12, 30],
    attempts: 2500,
  },
  {
    name: 'relay-hard',
    template: ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'],
    boxes: { A: '.', B: '.', C: '.', D: '.' },
    goals: ['.', '.', '.', '.'],
    player: '.',
    networks: [{ links: [['A', 'B', 0], ['C', 'D', 2]] }, { links: [['A', 'B', 2], ['C', 'D', 1]] }, { links: [['A', 'B', 1], ['C', 'D', 3]] }],
    walls: [2, 6],
    opt: [14, 40],
    attempts: 1500,
  },
];
