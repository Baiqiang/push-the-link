// Cheat codes, entered on the title screen (gameplay keys would move the player).
//
//   Basic (unlocks hints):         ↑ ↑ ↓ ↓ ← → ← → B A      — the Contra 30-lives code
//   Advanced (unlocks solutions):  ↓ ↓ ↑ ↑ → ← → ← A B      — the same code done backwards
//
// The advanced code is the basic one "singing the opposite tune" (reverse link, level 1):
// every direction flipped and B/A swapped. On touch screens swipes are the arrows and a
// double tap stands in for the B A pair (or A B).

export type CheatToken = 'U' | 'D' | 'L' | 'R' | 'B' | 'A' | 'TAP2';
export type CheatId = 'hints' | 'solutions';

const BASIC: CheatToken[] = ['U', 'U', 'D', 'D', 'L', 'R', 'L', 'R'];
const ADVANCED: CheatToken[] = ['D', 'D', 'U', 'U', 'R', 'L', 'R', 'L'];

const PATTERNS: Array<{ id: CheatId; seqs: CheatToken[][] }> = [
  { id: 'hints', seqs: [[...BASIC, 'B', 'A'], [...BASIC, 'TAP2']] },
  { id: 'solutions', seqs: [[...ADVANCED, 'A', 'B'], [...ADVANCED, 'TAP2']] },
];

const MAX = Math.max(...PATTERNS.flatMap((p) => p.seqs.map((s) => s.length)));

/** Rolling buffer of recent inputs; reports a cheat when the tail matches one. */
export class CheatListener {
  private buf: CheatToken[] = [];

  push(token: CheatToken): CheatId | null {
    this.buf.push(token);
    if (this.buf.length > MAX) this.buf.shift();
    for (const { id, seqs } of PATTERNS) {
      for (const seq of seqs) {
        if (this.buf.length >= seq.length && seq.every((t, i) => this.buf[this.buf.length - seq.length + i] === t)) {
          this.buf = [];
          return id;
        }
      }
    }
    return null;
  }

  reset(): void {
    this.buf = [];
  }
}

export function keyToCheatToken(key: string): CheatToken | null {
  const map: Record<string, CheatToken> = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', b: 'B', B: 'B', a: 'A', A: 'A' };
  return map[key] ?? null;
}
