import { solve, type GameState, type Level, type SolveResult } from './engine';
import type { SolveRequest } from './solver.worker';

/** Runs BFS off the main thread; falls back to inline solving if workers are unavailable. */
export class SolverClient {
  private worker: Worker | null = null;
  private seq = 0;
  private waiting = new Map<number, (r: SolveResult) => void>();
  private cache = new Map<string, SolveResult>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ id: number; result: SolveResult }>) => {
        this.waiting.get(e.data.id)?.(e.data.result);
        this.waiting.delete(e.data.id);
      };
      this.worker.onerror = () => {
        this.worker = null;
      };
    } catch {
      this.worker = null;
    }
  }

  solve(level: Level, state: GameState): Promise<SolveResult> {
    const key = `${level.id}|${JSON.stringify(state)}`;
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    const done = (r: SolveResult) => {
      if (this.cache.size > 200) this.cache.clear();
      this.cache.set(key, r);
      return r;
    };
    if (!this.worker) return Promise.resolve(done(solve(level, state)));
    const id = ++this.seq;
    const req: SolveRequest = { id, levelId: level.id, state };
    return new Promise((resolve) => {
      this.waiting.set(id, (r) => resolve(done(r)));
      this.worker!.postMessage(req);
    });
  }
}
