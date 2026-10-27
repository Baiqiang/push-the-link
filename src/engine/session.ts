import type { Dir, GameState, Level, MoveResult } from './types';
import { cloneState, isWon } from './level';
import { attemptMove } from './step';

/** Playable session: current state, undo history and step count. UI-agnostic. */
export class GameSession {
  state: GameState;
  private history: GameState[] = [];

  constructor(public readonly level: Level) {
    this.state = cloneState(level.initial);
  }

  get steps(): number {
    return this.history.length;
  }

  get won(): boolean {
    return isWon(this.level, this.state);
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  get optimal(): number {
    return this.level.data.optimal;
  }

  move(dir: Dir): MoveResult {
    const r = attemptMove(this.level, this.state, dir);
    if (r.ok) {
      this.history.push(this.state);
      this.state = r.state;
    }
    return r;
  }

  undo(): GameState | null {
    const prev = this.history.pop();
    if (!prev) return null;
    this.state = prev;
    return prev;
  }

  reset(): void {
    this.history = [];
    this.state = cloneState(this.level.initial);
  }
}
