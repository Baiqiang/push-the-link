export type Vec = [x: number, y: number];
export type Dir = 'U' | 'R' | 'D' | 'L';
export type QuarterTurns = 0 | 1 | 2 | 3;
/** 0–3: rotate clockwise k × 90°. 'H': mirror left↔right. 'V': mirror up↔down. */
export type Transform = QuarterTurns | 'H' | 'V';
/**
 * [from, to, t, oneWay?]: when `from` moves in d, `to` moves in t(d).
 * Without '>' the link also works backwards with the inverse transform.
 * '@' may be used as an endpoint: the player is then part of the network.
 */
export type Link = [from: string, to: string, t: Transform, oneWay?: '>'];
/** One track switch (道岔): its position is LEFT or RIGHT. */
export type SwitchPos = 'LEFT' | 'RIGHT';
/**
 * The level's switch state as one key. Plates give OFF/ON. One track switch gives LEFT/RIGHT.
 * Several track switches give their positions joined in order, e.g. 'LEFT|RIGHT'.
 */
export type Mode = string;
export type ModeTable = Record<string, Link[]>;
/** 'lever' = track switches (K, J…); 'plate' = pressure plates. */
export type SwitchKind = 'lever' | 'plate';

/** A track switch: a pushable piece that slides between its rail cells. */
export interface SwitchDef {
  id: string;
  rail: Vec[];
  /** x ≤ mode_by_x is LEFT, otherwise RIGHT. */
  mode_by_x: number;
  /** Links this switch adds in each position (independent switches). */
  modes?: Partial<Record<SwitchPos, Link[]>>;
}

export interface GameState {
  player: Vec;
  /** A–F and any track switches (K, J). */
  boxes: Record<string, Vec>;
}

export interface Localized {
  zh: string;
  en: string;
}

/** Raw shape of an entry in levels.json. */
export interface LevelData {
  id: number;
  title: Localized;
  tag: Localized;
  rows: string[];
  links?: Link[];
  modes?: ModeTable;
  /** Shorthand for a single track switch K: its rail cells and threshold. */
  rail?: Vec[];
  mode_by_x?: number;
  /** Several track switches. Links come from `links` (always on), each switch's own
   * `modes`, and `modes` keyed by the joined positions ('LEFT|RIGHT'…) if given. */
  switches?: SwitchDef[];
  /** Pressure plates: any occupant at turn start selects modes.ON. */
  plates?: Vec[];
  /** Boxes deliberately left unlinked (plain Sokoban crates). */
  free?: string[];
  note: Localized;
  tip: Localized;
  solution: string;
  optimal: number;
}

/** Parsed, validated level with static geometry split from dynamic state. */
export interface Level {
  id: number;
  data: LevelData;
  width: number;
  height: number;
  /** walls[y][x] */
  walls: boolean[][];
  goals: Vec[];
  /** Fixed ID order used for state encoding: target boxes sorted, then the switches. */
  boxIds: string[];
  /** Boxes that must end on goals (everything except switches). */
  targetIds: string[];
  hasLever: boolean;
  /** Track switches, normalised (a legacy `rail` becomes one switch K). */
  switches: SwitchDef[];
  switchKind: SwitchKind | null;
  initial: GameState;
}

export type EventCause = 'input' | 'push' | 'link';

export interface MoveEvent {
  entity: string; // '@' for the player
  from: Vec;
  to: Vec;
  dir: Dir;
  cause: EventCause;
  /** Entity that pushed (cause 'push') or drove via link (cause 'link'). */
  by?: string;
  /** Index of the link in the active table that fired (cause 'link'). */
  linkIndex?: number;
  /** Animation phase; events in the same phase play simultaneously. */
  phase: number;
}

export type FailType = 'wall' | 'rail' | 'conflict' | 'blocked' | 'cycle';

export interface FailReason {
  type: FailType;
  /** Entity that could not move. */
  entity: string;
  /** The direction it was asked to move. */
  dir: Dir;
  /** True when the failure happened away from the player's own push line. */
  remote: boolean;
}

export type MoveResult =
  | {
      ok: true;
      state: GameState;
      events: MoveEvent[];
      /** Indices into the active link table that fired this turn. */
      firedLinks: number[];
      phases: number;
      modeBefore: Mode | null;
      modeAfter: Mode | null;
    }
  | { ok: false; reason: FailReason };

export const PLAYER = '@';
export const LEVER = 'K';
