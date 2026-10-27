// Random-placement level search. Each theme fixes a room template and a mechanic;
// placements and extra walls are random, and BFS analysis grades every candidate.
import { attemptMove, currentMode, DIRS, replay, sameVec, stateKey, switchPositions, type GameState, type Link, type LevelData, type ModeTable, type SwitchDef, type Vec } from '../src/engine';
import { analyze, stub, tryParse, type Analysis } from './analyze';

export interface Theme {
  name: string;
  /** '#' wall, '.' or digit = floor (digit marks a region), 'o' floor that never spawns, 'K'/'J' fixed switches. */
  template: string[];
  /** Box id → region char ('.' = any spawnable floor). */
  boxes: Record<string, string>;
  /** One region per goal. */
  goals: string[];
  player: string;
  /** Pick one at random per candidate. */
  networks: Array<{ links?: Link[]; modes?: ModeTable }>;
  rail?: Vec[];
  mode_by_x?: number;
  /** Several track switches (their letters must sit in the template). */
  switches?: SwitchDef[];
  /** The solution must visit at least this many distinct switch states. */
  requireCombos?: number;
  /** Each of these switches must change position at least once along the solution. */
  requireFlips?: string[];
  free?: string[];
  /** Plates: fixed cells, or a region to place `count` plates randomly. */
  plates?: Vec[] | { region: string; count: number };
  /**
   * Place goals where the boxes end up after a random walk of this many moves,
   * instead of at random. Rigid networks almost never solve with random goals.
   */
  walk?: [number, number];
  /**
   * Place goals at box layouts that take the most moves to reach from the start
   * (BFS over the goal-less map), trying the `tries` deepest distinct layouts.
   */
  far?: { cap: number; tries: number };
  /** Use the difficulty-heavy score. */
  hard?: boolean;
  /** Analysis cap for candidates (default 60k). */
  cap?: number;
  /** Extra random interior walls: [min, max]. */
  walls: [number, number];
  opt: [number, number];
  /** Variants that must NOT accept the found solution (proves the mechanic matters). */
  variants?: (d: LevelData) => LevelData[];
  attempts: number;
}

export interface Candidate {
  data: LevelData;
  a: Analysis;
  score: number;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function score(a: Analysis): number {
  if (a.optimal === null) return -1;
  return a.optimal + a.deadFrac * 14 + a.trapRate * 40 - Math.log2(a.optimalPaths) * 2.5 + a.pushes * 0.4;
}

/** Hard levels: reward traps, detours (moves that take boxes away from goals), and big search spaces. */
export function hardScore(a: Analysis): number {
  if (a.optimal === null) return -1;
  return (
    a.optimal * 0.6 +
    a.regress * 2.2 +
    a.trapRate * 70 +
    a.deadFrac * 10 +
    Math.log10(a.reachable) * 3 -
    Math.log2(a.optimalPaths) * 2 +
    a.switches * 1.5
  );
}

export const lastStats: Record<string, number> = {};

export function search(theme: Theme, seed = 1, keep = 6): Candidate[] {
  const stat = (k: string) => (lastStats[k] = (lastStats[k] ?? 0) + 1);
  for (const k in lastStats) delete lastStats[k];
  const rand = rng(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const cellsOf = (grid: string[][], region: string) => {
    const out: Vec[] = [];
    grid.forEach((row, y) =>
      row.forEach((ch, x) => {
        if (ch === '#' || ch === 'o' || ch === 'K' || ch === 'J' || ch === 'X') return;
        if (region === '.' ? true : ch === region) out.push([x, y]);
      }),
    );
    return out;
  };
  const best: Candidate[] = [];
  const seen = new Set<string>();
  for (let n = 0; n < theme.attempts; n++) {
    const grid = theme.template.map((r) => [...r]);
    const taken = new Set<string>();
    const fixedPlates: Vec[] = Array.isArray(theme.plates) ? theme.plates : [];
    for (const p of fixedPlates) taken.add(`${p[0]},${p[1]}`);
    const take = (region: string): Vec | null => {
      const free = cellsOf(grid, region).filter(([x, y]) => !taken.has(`${x},${y}`));
      if (!free.length) return null;
      const c = pick(free);
      taken.add(`${c[0]},${c[1]}`);
      return c;
    };
    const place: Array<[string, Vec | null]> = [];
    place.push(['@', take(theme.player)]);
    for (const id in theme.boxes) place.push([id, take(theme.boxes[id])]);
    let goals: Array<Vec | null> = theme.walk || theme.far ? [] : theme.goals.map((r) => take(r));
    let plates = fixedPlates;
    if (theme.plates && !Array.isArray(theme.plates)) {
      const spec = theme.plates;
      plates = Array.from({ length: spec.count }, () => take(spec.region)).filter((p): p is Vec => !!p);
    }
    if (place.some(([, c]) => !c) || goals.some((g) => !g)) continue;
    const wallCount = theme.walls[0] + Math.floor(rand() * (theme.walls[1] - theme.walls[0] + 1));
    for (let w = 0; w < wallCount; w++) {
      const c = take('.');
      if (c) grid[c[1]][c[0]] = 'X';
    }
    const rows = grid.map((row) => row.map((ch) => (ch === 'X' ? '#' : ch === '#' || ch === 'K' || ch === 'J' ? ch : '.')).join(''));
    const net = pick(theme.networks);
    const extra = { ...net, rail: theme.rail, mode_by_x: theme.mode_by_x, switches: theme.switches, free: theme.free, plates: plates.length ? plates : undefined };

    const ids = Object.keys(theme.boxes);
    const starts = place.map(([, c]) => c!);
    // A copy with every box placed but goals hidden in sealed cells below the map.
    const goalless = () => {
      const pre = rows.slice();
      for (const [id, c] of place) pre[c![1]] = pre[c![1]].slice(0, c![0]) + id + pre[c![1]].slice(c![0] + 1);
      return tryParse(stub([...pre, '#'.repeat(pre[0].length), ...ids.map(() => '#g' + '#'.repeat(pre[0].length - 2))], extra));
    };
    const blocked = (cells: Vec[], st?: GameState) =>
      cells.some((e) => starts.some((s) => sameVec(s, e))) ||
      cells.some((e) => plates.some((p) => sameVec(p, e))) ||
      cells.some((e) => [...(theme.rail ?? []), ...(theme.switches ?? []).flatMap((sw) => sw.rail)].some((r) => sameVec(r, e))) ||
      (!!st?.boxes.K && cells.some((e) => sameVec(e, st.boxes.K)));

    let goalSets: Vec[][] = [];
    if (theme.walk) {
      const flv = goalless();
      if (!flv) {
        stat('parse');
        continue;
      }
      const len = theme.walk[0] + Math.floor(rand() * (theme.walk[1] - theme.walk[0] + 1));
      let st: GameState = flv.initial;
      // Biased walk: prefer moves that displace at least one box (70% of the time).
      const boxesMoved = (a: GameState, b: GameState) => ids.some((id) => !sameVec(a.boxes[id], b.boxes[id]));
      for (let i = 0; i < len; i++) {
        const opts = DIRS.map((d) => attemptMove(flv, st, d, { record: false })).filter((r) => r.ok);
        if (!opts.length) break;
        const pushes = opts.filter((r) => r.ok && boxesMoved(st, r.state));
        const r = pushes.length && rand() < 0.7 ? pick(pushes) : pick(opts);
        if (r.ok) st = r.state;
      }
      const ends = ids.map((id) => st.boxes[id]);
      if (blocked(ends, st)) {
        stat('overlap');
        continue;
      }
      goalSets = [ends];
    } else if (theme.far) {
      const flv = goalless();
      if (!flv) {
        stat('parse');
        continue;
      }
      // BFS: first depth at which each (unordered) box layout appears.
      const seenS = new Set<string>([stateKey(flv, flv.initial)]);
      const layoutDepth = new Map<string, { depth: number; cells: Vec[] }>();
      let frontier: GameState[] = [flv.initial];
      let depth = 0;
      while (frontier.length && seenS.size < theme.far.cap) {
        depth++;
        const next: GameState[] = [];
        for (const st of frontier) {
          for (const d of DIRS) {
            const r = attemptMove(flv, st, d, { record: false });
            if (!r.ok) continue;
            const k = stateKey(flv, r.state);
            if (seenS.has(k)) continue;
            seenS.add(k);
            next.push(r.state);
            const cells = ids.map((id) => r.state.boxes[id]);
            const lk = cells.map((c) => c.join(',')).sort().join('|');
            if (!layoutDepth.has(lk)) layoutDepth.set(lk, { depth, cells });
          }
        }
        frontier = next;
      }
      if (seenS.size >= theme.far.cap) {
        stat('capped');
        continue;
      }
      const deep = [...layoutDepth.values()]
        .filter((l) => l.depth >= theme.opt[0] && l.depth <= theme.opt[1] && !blocked(l.cells))
        .sort((a, b) => b.depth - a.depth);
      if (!deep.length) {
        stat('short');
        continue;
      }
      // The deepest few, plus a couple from the upper half for variety.
      const picks = deep.slice(0, Math.max(1, theme.far.tries - 2));
      for (let k = 0; k < 2 && deep.length > picks.length; k++) picks.push(deep[Math.floor(rand() * Math.min(deep.length, 60))]);
      goalSets = picks.map((l) => l.cells);
    } else goalSets = [goals as Vec[]];

    for (const goalCells of goalSets) {
      const rowsG = rows.slice();
      const putG = (c: Vec, ch: string) => (rowsG[c[1]] = rowsG[c[1]].slice(0, c[0]) + ch + rowsG[c[1]].slice(c[0] + 1));
      for (const g of goalCells) putG(g, 'g');
      for (const [id, c] of place) putG(c!, id);
      const key = rowsG.join('/') + JSON.stringify(net);
      if (seen.has(key)) continue;
      seen.add(key);

      const data = stub(rowsG, extra);
      const level = tryParse(data);
      if (!level) {
        stat('parse');
        continue;
      }
      const a = analyze(level, theme.cap ?? 60_000);
      if (a.optimal === null || a.capped) {
        stat(a.capped ? 'capped' : 'unsolvable');
        continue;
      }
      if (a.optimal < theme.opt[0] || a.optimal > theme.opt[1]) {
        stat(a.optimal < theme.opt[0] ? 'short' : 'long');
        continue;
      }
      if (theme.requireCombos || theme.requireFlips) {
        const r = replay(level, a.solution);
        if (!r.ok) continue;
        const combos = new Set(r.states.map((st) => currentMode(level, st)));
        const flipped = (id: string) => new Set(r.states.map((st) => switchPositions(level, st)[id])).size > 1;
        if ((theme.requireCombos && combos.size < theme.requireCombos) || (theme.requireFlips && !theme.requireFlips.every(flipped))) {
          stat('bypass');
          continue;
        }
      }
      if (theme.variants) {
        const bypass = theme.variants(data).some((v) => {
          const lv = tryParse(v);
          if (!lv) return false;
          const r = replay(lv, a.solution);
          return r.ok && r.won;
        });
        if (bypass) {
          stat('bypass');
          continue;
        }
      }
      stat('ok');
      const sc = theme.hard ? hardScore(a) : score(a);
      best.push({ data: { ...data, solution: a.solution, optimal: a.optimal }, a, score: sc });
      best.sort((x, y) => y.score - x.score);
      if (best.length > keep) best.pop();
    }
  }
  return best;
}
