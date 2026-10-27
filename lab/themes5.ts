// Fifth round: two track switches, K and J.
//   two-switch: each switch owns one link (independent); both must be thrown.
//   switch-combo: the two positions together pick one of four networks; the solution
//   has to visit at least three of them.
import type { SwitchDef } from '../src/engine';
import type { Theme } from './generate';

// Player room on top with both switches, box room below.
const TEMPLATE = ['#########', '#1111111#', '#11K1111#', '#11J1111#', '#1111111#', '#########', '#2222222#', '#2222222#', '#2222222#', '#########'];
const K: SwitchDef = { id: 'K', rail: [[3, 2], [4, 2]], mode_by_x: 3 };
const J: SwitchDef = { id: 'J', rail: [[3, 3], [4, 3]], mode_by_x: 3 };

const common = {
  template: TEMPLATE,
  boxes: { A: '1', B: '2', C: '2' },
  goals: ['1', '2', '2'],
  player: '1',
  networks: [{}],
  far: { cap: 150_000, tries: 4 },
  cap: 220_000,
};

export const THEMES5: Theme[] = [
  ...(
    [
      [[['A', 'B', 0]], [['A', 'B', 2]], [['A', 'C', 0]], [['A', 'C', 2]]],
      [[['A', 'B', 0]], [['A', 'B', 1]], [['A', 'C', 2]], [['A', 'C', 3]]],
      [[['A', 'B', 'H']], [['A', 'B', 'V']], [['A', 'C', 0]], [['A', 'C', 2]]],
    ] as const
  ).map(
    ([kl, kr, jl, jr], i): Theme => ({
      ...common,
      name: `two-switch-${i}`,
      switches: [
        { ...K, modes: { LEFT: kl.map((l) => [...l]), RIGHT: kr.map((l) => [...l]) } as SwitchDef['modes'] },
        { ...J, modes: { LEFT: jl.map((l) => [...l]), RIGHT: jr.map((l) => [...l]) } as SwitchDef['modes'] },
      ],
      requireFlips: ['K', 'J'],
      walls: [1, 4],
      opt: [12, 22],
      attempts: 500,
    }),
  ),
  ...(
    [
      { 'LEFT|LEFT': [['A', 'B', 0], ['A', 'C', 0]], 'LEFT|RIGHT': [['A', 'B', 2], ['A', 'C', 0]], 'RIGHT|LEFT': [['A', 'B', 0], ['B', 'C', 2]], 'RIGHT|RIGHT': [['A', 'C', 1], ['B', 'C', 0]] },
      { 'LEFT|LEFT': [['A', 'B', 0], ['B', 'C', 0]], 'LEFT|RIGHT': [['A', 'B', 1], ['A', 'C', 0]], 'RIGHT|LEFT': [['A', 'C', 2], ['B', 'C', 0]], 'RIGHT|RIGHT': [['A', 'B', 'H'], ['A', 'C', 'V']] },
      { 'LEFT|LEFT': [['A', 'B', 2], ['A', 'C', 2]], 'LEFT|RIGHT': [['A', 'B', 0], ['A', 'C', 2]], 'RIGHT|LEFT': [['A', 'B', 2], ['A', 'C', 0]], 'RIGHT|RIGHT': [['A', 'B', 0], ['A', 'C', 0]] },
    ] as const
  ).map(
    (modes, i): Theme => ({
      ...common,
      name: `switch-combo-${i}`,
      switches: [K, J],
      networks: [{ modes: JSON.parse(JSON.stringify(modes)) }],
      requireCombos: 3,
      hard: true,
      walls: [2, 5],
      opt: [22, 34],
      attempts: 400,
    }),
  ),
];
