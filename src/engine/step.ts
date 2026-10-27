import type { Dir, EventCause, FailReason, GameState, Level, MoveEvent, MoveResult, Vec } from './types';
import { PLAYER } from './types';
import { activeLinks, applyTransform, buildAdjacency, currentMode, DELTA, isSwitch, onRail } from './links';
import { cloneState, isWon } from './level';

class MoveFailure extends Error {
  constructor(public reason: FailReason) {
    super(reason.type);
  }
}

interface Pending {
  target: string;
  dir: Dir;
  by: string;
  linkIndex: number;
  phase: number;
}

export interface MoveOptions {
  /** Collect events/phases for animation and tests. The solver turns this off. */
  record?: boolean;
}

/**
 * Resolve one directional input as an atomic transaction (design §3.3).
 * Collisions recurse depth-first; link activations go through a FIFO queue.
 * The link table comes from the switch position *before* the move.
 *
 * The player may be displaced several times by collisions, but a link request
 * to the player is satisfied by any earlier move in the same direction.
 */
export function attemptMove(level: Level, state: GameState, dir: Dir, opts: MoveOptions = {}): MoveResult {
  const record = opts.record ?? true;
  const temp = cloneState(state);
  const links = activeLinks(level, state);
  const adjacency = buildAdjacency(links);
  const activated = new Set<number>();
  const movedDir = new Map<string, Dir>();
  const pending: Pending[] = [];
  const events: MoveEvent[] = [];
  const lastPhase = new Map<string, number>();

  // Occupancy index over the temp state, kept in sync as entities move.
  const occ = new Map<number, string>();
  const cell = (p: Vec) => p[1] * level.width + p[0];
  occ.set(cell(temp.player), PLAYER);
  for (const id in temp.boxes) occ.set(cell(temp.boxes[id]), id);

  const posOf = (id: string): Vec => (id === PLAYER ? temp.player : temp.boxes[id]);

  /** Returns the animation phase the move was placed in. */
  const shift = (id: string, d: Dir, trail: string[], cause: EventCause, by: string | undefined, linkIndex: number | undefined, phase: number, remote: boolean): number => {
    const fail = (type: FailReason['type']): never => {
      throw new MoveFailure({ type, entity: id, dir: d, remote });
    };

    if (trail.includes(id)) fail('cycle');
    // Boxes move at most once per turn; the player can be shoved again by collisions.
    const prev = movedDir.get(id);
    if (prev !== undefined && id !== PLAYER) fail(prev === d ? 'blocked' : 'conflict');

    const from = posOf(id);
    const [dx, dy] = DELTA[d];
    const to: Vec = [from[0] + dx, from[1] + dy];
    if (to[0] < 0 || to[1] < 0 || to[0] >= level.width || to[1] >= level.height || level.walls[to[1]][to[0]]) fail('wall');
    if (isSwitch(level, id) && !onRail(level, to, id)) fail('rail');

    let usedPhase = Math.max(phase, (lastPhase.get(id) ?? -1) + 1);
    const occupant = occ.get(cell(to));
    if (occupant !== undefined) {
      const occPhase = shift(occupant, d, [...trail, id], 'push', id, undefined, usedPhase, remote);
      usedPhase = Math.max(usedPhase, occPhase);
      if (occ.has(cell(to))) fail('blocked');
    }

    occ.delete(cell(from));
    occ.set(cell(to), id);
    if (id === PLAYER) temp.player = to;
    else temp.boxes[id] = to;
    if (!movedDir.has(id)) movedDir.set(id, d);
    lastPhase.set(id, usedPhase);
    if (record) events.push({ entity: id, from, to, dir: d, cause, by, linkIndex, phase: usedPhase });

    for (const n of adjacency.get(id) ?? []) {
      if (activated.has(n.linkIndex)) continue;
      activated.add(n.linkIndex);
      pending.push({ target: n.other, dir: applyTransform(d, n.t), by: id, linkIndex: n.linkIndex, phase: usedPhase + 1 });
    }
    return usedPhase;
  };

  try {
    shift(PLAYER, dir, [], 'input', undefined, undefined, 0, false);
    for (let head = 0; head < pending.length; head++) {
      const req = pending[head];
      const prev = movedDir.get(req.target);
      if (prev === req.dir) continue; // already satisfied this turn
      if (prev !== undefined) throw new MoveFailure({ type: 'conflict', entity: req.target, dir: req.dir, remote: true });
      shift(req.target, req.dir, [], 'link', req.by, req.linkIndex, req.phase, true);
    }
  } catch (e) {
    if (e instanceof MoveFailure) return { ok: false, reason: e.reason };
    throw e;
  }

  const phases = events.reduce((m, ev) => Math.max(m, ev.phase + 1), 0);
  return {
    ok: true,
    state: temp,
    events,
    firedLinks: [...activated].sort((a, b) => a - b),
    phases,
    modeBefore: currentMode(level, state),
    modeAfter: currentMode(level, temp),
  };
}

/** Apply a solution string; returns the state after each step, or the failing index. */
export function replay(level: Level, moves: string, start: GameState = level.initial) {
  const states: GameState[] = [start];
  let s = start;
  for (let i = 0; i < moves.length; i++) {
    const r = attemptMove(level, s, moves[i] as Dir, { record: false });
    if (!r.ok) return { ok: false as const, failedAt: i, reason: r.reason, states };
    s = r.state;
    states.push(s);
  }
  return { ok: true as const, states, won: isWon(level, s) };
}
