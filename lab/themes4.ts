// Fourth round: shorter hard levels (22–34 moves) that keep each replaced level's
// network so its text stays accurate, plus the "lever flips a one-way link" mechanic.
import type { LevelData } from '../src/engine';
import type { Theme } from './generate';
import { THEMES3 } from './themes3';

const base = (name: string) => THEMES3.find((t) => t.name === name)!;
const SHORT: [number, number] = [22, 34];
const leverStuck = (d: LevelData) =>
  (['LEFT', 'RIGHT'] as const).map((m) => ({ ...d, links: d.modes![m], modes: undefined, rail: undefined, mode_by_x: undefined, rows: d.rows.map((r) => r.replace('K', '.')) }));

/** Re-run a round-3 theme with a fixed network and the shorter length window. */
const shorter = (name: string, level: string, network: Theme['networks'][number], extra: Partial<Theme> = {}): Theme => ({
  ...base(name),
  name: `${level}-short`,
  networks: [network],
  opt: SHORT,
  ...extra,
});

// Small room with the lever on the top row so the search space stays manageable.
const LEVER_ROOM = ['########', '#......#', '#..K...#', '#......#', '#......#', '########'];
const FLIP_NETWORKS: Theme['networks'] = [
  { modes: { LEFT: [['A', 'B', 0, '>']], RIGHT: [['B', 'A', 0, '>']] } },
  { modes: { LEFT: [['A', 'B', 2, '>']], RIGHT: [['B', 'A', 2, '>']] } },
  { modes: { LEFT: [['A', 'B', 1, '>']], RIGHT: [['B', 'A', 3, '>']] } },
];
const flip = (name: string, opt: [number, number], hard: boolean, attempts: number): Theme => ({
  name,
  template: LEVER_ROOM,
  boxes: { A: '.', B: '.' },
  goals: ['.', '.'],
  player: '.',
  rail: [[3, 2], [4, 2]],
  mode_by_x: 3,
  networks: FLIP_NETWORKS,
  walls: hard ? [2, 5] : [1, 3],
  variants: (d) => [
    ...leverStuck(d),
    // Two-way in both positions must not work either: the arrow's direction has to matter.
    { ...d, modes: Object.fromEntries(Object.entries(d.modes!).map(([k, v]) => [k, v!.map(([a, b, t]) => [a, b, t])])) },
  ],
  hard,
  far: { cap: 150_000, tries: 4 },
  cap: 200_000,
  opt,
  attempts,
});

export const THEMES4: Theme[] = [
  shorter('relay-tight', 'L06', { links: [['A', 'B', 1], ['C', 'D', 3]] }),
  shorter('mirror-tight', 'L09', { links: [['A', 'B', 'V'], ['C', 'D', 'V']] }),
  shorter('oneway-tight', 'L11', { links: [['A', 'B', 1, '>']] }),
  shorter('oneway-chain3', 'L12', { links: [['A', 'B', 2, '>'], ['B', 'C', 'V', '>']] }),
  shorter('lever-three', 'L16', { modes: { LEFT: [['A', 'B', 1], ['A', 'C', 0]], RIGHT: [['A', 'B', 0], ['A', 'C', 3]] } }),
  shorter('twins-hard', 'L21', { links: [['@', 'A', 2]] }),
  shorter('double-sokoban', 'L22', { links: [['@', 'A', 'H']] }),
  shorter('plate-crate', 'L25', { modes: { OFF: [['A', 'B', 'H']], ON: [['A', 'B', 'V']] } }),
  shorter('finale-hard', 'L26', { modes: { OFF: [['@', 'A', 0], ['B', 'A', 2]], ON: [['@', 'A', 2], ['B', 'A', 0]] } }, { opt: [24, 34] }),
  flip('flip-intro', [10, 18], false, 500),
  flip('flip-hard', SHORT, true, 400),
];
