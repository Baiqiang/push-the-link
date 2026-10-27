import { LEVELS, solve, type GameState } from './engine';

export interface SolveRequest {
  id: number;
  levelId: number;
  state: GameState;
}

self.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, levelId, state } = e.data;
  const level = LEVELS.find((l) => l.id === levelId)!;
  self.postMessage({ id, result: solve(level, state) });
};
