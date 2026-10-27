// Level-design lab: exhaustive state-space analysis used to grade candidate levels.
import { attemptMove, DIRS, isWon, parseLevel, stateKey, type Dir, type GameState, type Level, type LevelData } from '../src/engine';

export interface Analysis {
  reachable: number;
  capped: boolean;
  optimal: number | null;
  /** Reachable states from which the level can no longer be won. */
  deadFrac: number;
  /** Number of distinct shortest solutions (capped). */
  optimalPaths: number;
  /** Of all legal moves available along one optimal line, the share that walks into a dead state. */
  trapRate: number;
  solution: string;
  /** Moves in the solution that move at least one box. */
  pushes: number;
  /** Lever/plate position changes along the solution. */
  switches: number;
  /** Solution moves that increase the summed box→nearest-goal distance (detours). */
  regress: number;
}

export function analyze(level: Level, cap = 120_000): Analysis {
  const index = new Map<string, number>();
  const states: GameState[] = [];
  const succ: number[][] = [];
  const succDir: Dir[][] = [];
  const add = (s: GameState) => {
    const k = stateKey(level, s);
    let i = index.get(k);
    if (i === undefined) {
      i = states.length;
      index.set(k, i);
      states.push(s);
      succ.push([]);
      succDir.push([]);
    }
    return i;
  };
  add(level.initial);
  let capped = false;
  for (let i = 0; i < states.length; i++) {
    if (states.length > cap) {
      capped = true;
      break;
    }
    if (isWon(level, states[i])) continue; // terminal
    for (const d of DIRS) {
      const r = attemptMove(level, states[i], d, { record: false });
      if (!r.ok) continue;
      const j = add(r.state);
      succ[i].push(j);
      succDir[i].push(d);
    }
  }
  const n = states.length;
  // Reverse BFS from every winning state gives distance-to-win.
  const pred: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) for (const j of succ[i]) pred[j].push(i);
  const dist = new Int32Array(n).fill(-1);
  const q: number[] = [];
  for (let i = 0; i < n; i++) if (isWon(level, states[i])) {
    dist[i] = 0;
    q.push(i);
  }
  for (let h = 0; h < q.length; h++) for (const p of pred[q[h]]) if (dist[p] < 0) {
    dist[p] = dist[q[h]] + 1;
    q.push(p);
  }
  let dead = 0;
  for (let i = 0; i < n; i++) if (dist[i] < 0) dead++;
  const optimal = dist[0] >= 0 ? dist[0] : null;

  let optimalPaths = 0;
  let solution = '';
  let pushes = 0;
  let switches = 0;
  let regress = 0;
  const h = (st: GameState) =>
    level.targetIds.reduce((sum, id) => sum + Math.min(...level.goals.map((g) => Math.abs(g[0] - st.boxes[id][0]) + Math.abs(g[1] - st.boxes[id][1]))), 0);
  let trapMoves = 0;
  let totalMoves = 0;
  if (optimal !== null) {
    // Count shortest paths with memoised DP along dist-decreasing edges.
    const memo = new Map<number, number>();
    const count = (i: number): number => {
      if (dist[i] === 0) return 1;
      const m = memo.get(i);
      if (m !== undefined) return m;
      let c = 0;
      for (const j of succ[i]) if (dist[j] === dist[i] - 1) c = Math.min(1e6, c + count(j));
      memo.set(i, c);
      return c;
    };
    optimalPaths = count(0);
    let cur = 0;
    while (dist[cur] > 0) {
      const opts = succ[cur];
      totalMoves += opts.length;
      trapMoves += opts.filter((j) => dist[j] < 0).length;
      const k = opts.findIndex((j) => dist[j] === dist[cur] - 1);
      const d = succDir[cur][k];
      const r = attemptMove(level, states[cur], d, { record: true });
      if (r.ok && r.events.some((e) => e.entity !== '@')) pushes++;
      if (r.ok && r.modeBefore !== r.modeAfter) switches++;
      if (r.ok && h(r.state) > h(states[cur])) regress++;
      solution += d;
      cur = opts[k];
    }
  }
  return { reachable: n, capped, optimal, deadFrac: dead / n, optimalPaths, trapRate: totalMoves ? trapMoves / totalMoves : 0, solution, pushes, switches, regress };
}

export function tryParse(data: LevelData): Level | null {
  try {
    return parseLevel(data);
  } catch {
    return null;
  }
}

export function stub(rows: string[], extra: Partial<LevelData>): LevelData {
  return {
    id: 0,
    title: { zh: '', en: '' },
    tag: { zh: '', en: '' },
    rows,
    note: { zh: '', en: '' },
    tip: { zh: '', en: '' },
    solution: '',
    optimal: 0,
    ...extra,
  };
}

export function fmt(data: LevelData, a: Analysis): string {
  const extra = JSON.stringify({ links: data.links, modes: data.modes, rail: data.rail, mode_by_x: data.mode_by_x, switches: data.switches, plates: data.plates, free: data.free });
  return `opt=${a.optimal} paths=${a.optimalPaths} dead=${(a.deadFrac * 100).toFixed(0)}% trap=${(a.trapRate * 100).toFixed(0)}% pushes=${a.pushes} sw=${a.switches} back=${a.regress} states=${a.reachable}${a.capped ? '+' : ''}\n  ${a.solution}\n  ${extra}\n${data.rows.map((r) => '    ' + r).join('\n')}`;
}
