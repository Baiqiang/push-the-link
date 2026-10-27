import type { GameState, Level, LevelData, Link, Mode, SwitchDef, SwitchKind, Vec } from './types';
import { LEVER, PLAYER } from './types';
import { linksForMode, onRail, sameVec } from './links';

const BOX_CHARS = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'J', 'K']);
/** Letters reserved for track switches; each must have a rail. */
const SWITCH_CHARS = ['J', 'K'];

export class LevelError extends Error {}

/** Parse a levels.json entry and run the static checks from design §8.1. */
export function parseLevel(data: LevelData): Level {
  const { rows } = data;
  const fail = (msg: string): never => {
    throw new LevelError(`Level ${data.id}: ${msg}`);
  };

  if (rows.length === 0) fail('empty map');
  const width = rows[0].length;
  const height = rows.length;
  if (rows.some((r) => r.length !== width)) fail('map is not rectangular');

  const walls: boolean[][] = [];
  const goals: Vec[] = [];
  const boxes: Record<string, Vec> = {};
  let player: Vec | null = null;

  rows.forEach((row, y) => {
    const wallRow: boolean[] = [];
    [...row].forEach((ch, x) => {
      wallRow.push(ch === '#');
      if (ch === 'g') goals.push([x, y]);
      else if (ch === '@') {
        if (player) fail('more than one player');
        player = [x, y];
      } else if (BOX_CHARS.has(ch)) {
        if (boxes[ch]) fail(`duplicate box ${ch}`);
        boxes[ch] = [x, y];
      } else if (ch !== '#' && ch !== '.') fail(`unknown tile '${ch}' at ${x},${y}`);
    });
    walls.push(wallRow);
  });

  if (!player) fail('no player');
  // Track switches: an explicit list, or the legacy single-K shorthand (rail + mode_by_x).
  if (data.switches && data.rail) fail('use either switches or rail, not both');
  const switches: SwitchDef[] =
    data.switches ?? (data.rail ? [{ id: LEVER, rail: data.rail, mode_by_x: data.mode_by_x ?? fail('K needs mode_by_x') }] : []);
  const switchIds = switches.map((sw) => sw.id);
  for (const ch of SWITCH_CHARS) if (boxes[ch] && !switchIds.includes(ch)) fail(`${ch} is on the map but has no rail`);
  const targetIds = Object.keys(boxes).filter((id) => !switchIds.includes(id)).sort();
  const boxIds = [...targetIds, ...switchIds];
  if (targetIds.length !== goals.length) fail(`${targetIds.length} boxes but ${goals.length} goals`);
  if (switches.length && data.plates) fail('a level uses track switches or plates, not both');

  const switchKind: SwitchKind | null = switches.length ? 'lever' : data.plates ? 'plate' : null;
  const level: Level = {
    id: data.id,
    data,
    width,
    height,
    walls,
    goals,
    boxIds,
    targetIds,
    hasLever: switches.length > 0,
    switches,
    switchKind,
    initial: { player: player!, boxes },
  };

  // Every switch state the level can be in.
  let modeNames: Mode[] = [];
  if (switchKind === 'plate') modeNames = ['OFF', 'ON'];
  else if (switchKind === 'lever') {
    modeNames = [''];
    for (let k = 0; k < switches.length; k++) modeNames = modeNames.flatMap((m) => ['LEFT', 'RIGHT'].map((p) => (k ? `${m}|${p}` : p)));
  }
  if (!switchKind && data.modes) fail('modes given but no switch or plates');
  for (const key of Object.keys(data.modes ?? {})) if (!modeNames.includes(key)) fail(`unknown mode ${key}`);
  if (switchKind === 'plate') for (const m of modeNames) if (!data.modes?.[m]) fail(`missing modes.${m}`);
  // A single switch without per-switch links needs both positions in `modes` (the classic layout).
  if (switches.length === 1 && !switches[0].modes) for (const m of modeNames) if (!data.modes?.[m]) fail(`missing modes.${m}`);
  const formal: Link[][] = switchKind ? modeNames.map((m) => linksForMode(level, m)) : [data.links ?? []];

  for (const table of formal) {
    for (const [a, b, t, oneWay] of table) {
      for (const end of [a, b]) if (end !== PLAYER && !boxes[end]) fail(`link ${a}-${b} references a missing box`);
      if (a === b) fail(`self link on ${a}`);
      if (![0, 1, 2, 3, 'H', 'V'].includes(t)) fail(`link ${a}-${b} has invalid transform ${t}`);
      if (oneWay !== undefined && oneWay !== '>') fail(`link ${a}-${b} has invalid flag ${oneWay}`);
    }
    // Every target box stays in the network in every switch position.
    for (const id of targetIds) {
      if (data.free?.includes(id)) continue;
      if (!table.some(([a, b]) => a === id || b === id)) fail(`box ${id} is unlinked in a formal mode`);
    }
  }

  for (const sw of switches) {
    if (!boxes[sw.id]) fail(`switch ${sw.id} is not on the map`);
    if (!onRail(level, boxes[sw.id], sw.id)) fail(`${sw.id} does not start on its rail`);
    const sides = new Set(sw.rail.map(([x]) => x <= sw.mode_by_x));
    if (sides.size !== 2) fail(`rail of ${sw.id} must span both positions`);
    for (const [x, y] of sw.rail) if (walls[y]?.[x] !== false) fail(`rail cell ${x},${y} is not floor`);
  }

  for (const id of data.free ?? []) if (!targetIds.includes(id)) fail(`free box ${id} is not a target box`);
  for (const p of data.plates ?? []) {
    if (walls[p[1]]?.[p[0]] !== false) fail(`plate ${p} is not floor`);
    if (goals.some((g) => sameVec(g, p))) fail(`plate ${p} overlaps a goal`);
  }

  return level;
}

export function cloneState(s: GameState): GameState {
  const boxes: Record<string, Vec> = {};
  for (const id in s.boxes) boxes[id] = [s.boxes[id][0], s.boxes[id][1]];
  return { player: [s.player[0], s.player[1]], boxes };
}

export function isWon(level: Level, s: GameState): boolean {
  return level.targetIds.every((id) => level.goals.some((g) => sameVec(g, s.boxes[id])));
}

/** Compact key used for BFS dedupe and state equality: player, then boxes in fixed ID order. */
export function stateKey(level: Level, s: GameState): string {
  let key = `${s.player[0]},${s.player[1]}`;
  for (const id of level.boxIds) key += `|${s.boxes[id][0]},${s.boxes[id][1]}`;
  return key;
}
