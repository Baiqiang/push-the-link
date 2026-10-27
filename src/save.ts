import type { Lang } from './i18n';

export interface LevelRecord {
  best: number;
  stars: number;
}

export interface SaveData {
  version: 1;
  lang: Lang | null;
  sound: boolean;
  levels: Record<number, LevelRecord>;
  seenTips: string[];
  lastLevel: number;
  /** Cheat codes: `unlocked` is permanent, `on` is the player's toggle. */
  cheats: { hints: { unlocked: boolean; on: boolean }; solutions: { unlocked: boolean; on: boolean } };
}

const KEY = 'push-the-link/save/v5';

function fresh(): SaveData {
  return {
    version: 1,
    lang: null,
    sound: true,
    levels: {},
    seenTips: [],
    lastLevel: 1,
    cheats: { hints: { unlocked: false, on: false }, solutions: { unlocked: false, on: false } },
  };
}

let data: SaveData = load();

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1) return fresh();
    const base = fresh();
    return { ...base, ...parsed, cheats: { ...base.cheats, ...parsed.cheats } };
  } catch {
    return fresh();
  }
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage may be unavailable (private mode); progress stays in memory for this session.
  }
}

export function save(): Readonly<SaveData> {
  return data;
}

export function updateSave(fn: (d: SaveData) => void): void {
  fn(data);
  persist();
}

export function clearProgress(): void {
  // Settings and unlocked cheats survive a progress wipe.
  const { lang, sound, cheats } = data;
  data = { ...fresh(), lang, sound, cheats };
  persist();
}

/** 3 stars at optimal, 2 within 50% over, otherwise 1. */
export function starsFor(steps: number, optimal: number): number {
  if (steps <= optimal) return 3;
  if (steps <= Math.ceil(optimal * 1.5)) return 2;
  return 1;
}

/** Records a clear; returns whether it beat the previous best. */
export function recordClear(levelId: number, steps: number, optimal: number): boolean {
  let improved = false;
  updateSave((d) => {
    const table = d.levels;
    const prev = table[levelId];
    if (!prev || steps < prev.best) {
      table[levelId] = { best: steps, stars: starsFor(steps, optimal) };
      improved = true;
    }
  });
  return improved;
}

export function totalStars(): number {
  return Object.values(data.levels).reduce((s, r) => s + r.stars, 0);
}
