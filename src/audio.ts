/** Small WebAudio synth: every sound is generated, so there are no asset files to cache. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

/** Must be called from a user gesture at least once (autoplay policy). */
export function unlockAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }
  if (ctx?.state === 'suspended') void ctx.resume();
}

interface Tone {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone({ freq, to, dur, type = 'sine', gain = 0.5, delay = 0 }: Tone): void {
  if (!enabled || !ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain: number, delay = 0, cutoff = 900): void {
  if (!enabled || !ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  step() {
    tone({ freq: 520, to: 420, dur: 0.06, type: 'triangle', gain: 0.18 });
  },
  push(delay = 0) {
    noise(0.09, 0.5, delay, 700);
    tone({ freq: 140, to: 90, dur: 0.1, type: 'sine', gain: 0.35, delay });
  },
  /** A link firing; `depth` raises the pitch along the chain. */
  link(depth: number, delay = 0) {
    const f = 600 * Math.pow(1.19, depth);
    tone({ freq: f, to: f * 1.5, dur: 0.12, type: 'sine', gain: 0.22, delay });
    tone({ freq: f * 2, dur: 0.08, type: 'triangle', gain: 0.06, delay: delay + 0.02 });
  },
  lever() {
    tone({ freq: 300, to: 900, dur: 0.12, type: 'square', gain: 0.08 });
    tone({ freq: 1200, dur: 0.05, type: 'triangle', gain: 0.15, delay: 0.1 });
  },
  fail() {
    tone({ freq: 180, to: 120, dur: 0.16, type: 'sawtooth', gain: 0.12 });
    noise(0.05, 0.2, 0, 400);
  },
  goal(delay = 0) {
    tone({ freq: 880, dur: 0.18, type: 'triangle', gain: 0.18, delay });
    tone({ freq: 1320, dur: 0.22, type: 'sine', gain: 0.1, delay: delay + 0.05 });
  },
  undo() {
    tone({ freq: 500, to: 340, dur: 0.08, type: 'triangle', gain: 0.14 });
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.35, type: 'triangle', gain: 0.2, delay: i * 0.09 }));
    tone({ freq: 1568, dur: 0.6, type: 'sine', gain: 0.08, delay: 0.36 });
  },
  click() {
    tone({ freq: 900, dur: 0.03, type: 'square', gain: 0.05 });
  },
  /** 8-bit power-up arpeggio for a cheat code. */
  cheat() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone({ freq: f, dur: 0.09, type: 'square', gain: 0.07, delay: i * 0.055 }));
    tone({ freq: 2093, dur: 0.25, type: 'square', gain: 0.05, delay: 0.34 });
  },
};
