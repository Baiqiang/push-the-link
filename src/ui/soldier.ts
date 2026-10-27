// Easter egg: a shirtless commando with a red headband now and then runs across the title
// screen and acts out the cheat code with his moves alone (no key caps, no letters):
//   ↑ ↑  aims straight up twice     ↓ ↓  goes prone twice
//   ← → ← →  turns around four times
//   B  fires a 5-way spread shot    A  does a curled somersault, then a ×30 medal pops up.
// Once hints are unlocked he runs in from the right and does it all backwards, which is
// the hint for the advanced code. After both are unlocked he just runs past and flips.
// A tribute to Contra, drawn with vector shapes here, no original assets.

export type SoldierStage = 'basic' | 'advanced' | 'done';

type Kind = 'stand' | 'run' | 'aim' | 'prone' | 'tuck';
interface Pose {
  kind: Kind;
  x: number;
  lift: number;
  flip: boolean;
  rot: number;
  phase: number;
  fire: boolean;
}
interface Step {
  dur: number;
  at(t: number): Pose;
  mark?: 'fire' | 'medal';
}
interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const C = {
  skin: '#f2b48a',
  skinDark: '#c98a62',
  hair: '#2b1a10',
  band: '#ff3d5a',
  pants: '#3d6bff',
  belt: '#5a3b20',
  boot: '#3a2618',
  gun: '#c9d4ff',
  gold: '#ffd23f',
  white: '#ffffff',
  glow: 'rgba(94, 242, 214, 0.45)',
};
/** World height; leaves room for the somersault and the medal. */
const H = 200;
const GROUND = H - 10;
const SPEED = 0.34; // world px per ms
type Ctx = CanvasRenderingContext2D;

function limb(g: Ctx, pts: number[], color: string, width: number): void {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
}

function dot(g: Ctx, x: number, y: number, r: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function star(g: Ctx, x: number, y: number, R: number, r: number): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r : R;
    g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.closePath();
  g.fill();
}

/** Head with the red headband; its two tails flap with time. */
function head(g: Ctx, x: number, y: number, time: number): void {
  const w = Math.sin(time / 85);
  g.strokeStyle = C.band;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x - 6, y - 3);
  g.quadraticCurveTo(x - 15, y - 2 + w * 3, x - 24, y + 1 + w * 6);
  g.moveTo(x - 6, y - 2);
  g.quadraticCurveTo(x - 14, y + 3 - w * 2, x - 20, y + 8 - w * 5);
  g.stroke();
  dot(g, x, y, 7, C.skin);
  g.fillStyle = C.hair;
  g.beginPath();
  g.arc(x - 1, y - 2, 7.2, Math.PI * 0.95, Math.PI * 2.02);
  g.fill();
  g.fillStyle = C.band;
  g.fillRect(x - 7.5, y - 4.5, 15, 3.5);
}

/**
 * Standing / running / aiming body, origin on the ground between the feet, facing right.
 * `legs`: 'stand', 'together' (for lying prone) or a running phase. Returns the muzzle point.
 */
function body(g: Ctx, legs: number | 'stand' | 'together', up: boolean, time: number, flash: boolean): [number, number] {
  const hip = -30;
  for (const side of [-1, 1]) {
    let th: number;
    let sh: number;
    if (legs === 'stand') {
      th = side * 0.2;
      sh = side * 0.12;
    } else if (legs === 'together') {
      th = sh = side * 0.04;
    } else {
      const s = Math.sin(legs) * side;
      th = s * 0.75;
      sh = th - 0.25 - 0.5 * Math.max(0, Math.cos(legs) * side);
    }
    const kx = Math.sin(th) * 14;
    const ky = hip + Math.cos(th) * 14;
    const fx = kx + Math.sin(sh) * 14;
    const fy = ky + Math.cos(sh) * 14;
    limb(g, [side * 3, hip, kx + side, ky, fx, fy], C.pants, 8);
    g.fillStyle = C.boot;
    g.beginPath();
    g.ellipse(fx + 2.5, fy, 5.5, 3.2, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Bare torso.
  g.fillStyle = C.skin;
  g.beginPath();
  g.moveTo(-6, hip);
  g.lineTo(6, hip);
  g.lineTo(9.5, -50);
  g.lineTo(-8.5, -50);
  g.closePath();
  g.fill();
  g.strokeStyle = C.skinDark;
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-4, -44);
  g.quadraticCurveTo(1, -41.5, 6, -44);
  g.moveTo(1, -40);
  g.lineTo(1, -33);
  g.stroke();
  g.fillStyle = C.belt;
  g.fillRect(-7, hip - 2, 14, 4);
  head(g, 1, -58, time);
  // Rifle, held level or pointed straight up.
  const [dx, dy] = up ? [0, -1] : [1, 0];
  const px = -dy;
  const py = dx;
  const at = (k: number, o = 0): [number, number] => [2 + dx * k + px * o, -46 + dy * k + py * o];
  limb(g, [-4, -48, ...at(7, 3)], C.skin, 5);
  limb(g, [...at(-2), ...at(31)], C.gun, 4.5);
  limb(g, [...at(12, 1), ...at(13, 7)], C.gun, 3);
  limb(g, [6, -48, ...at(17, 2)], C.skin, 5);
  const muzzle = at(33);
  if (flash) {
    g.fillStyle = C.gold;
    star(g, muzzle[0] + dx * 3, muzzle[1] + dy * 3, 7, 3);
  }
  return muzzle;
}

/** Curled up mid-somersault: legs, arms, head and headband rolled into a ball. */
function ball(g: Ctx, time: number): void {
  dot(g, 0, 0, 15, C.pants);
  g.fillStyle = C.skin;
  g.beginPath();
  g.moveTo(0, 0);
  g.arc(0, 0, 15, Math.PI * 1.05, Math.PI * 1.75);
  g.closePath();
  g.fill();
  dot(g, -9, -10, 6.5, C.skin);
  g.fillStyle = C.band;
  g.fillRect(-15, -14, 12, 3);
  g.strokeStyle = C.band;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-15, -13);
  g.quadraticCurveTo(-22, -6 + Math.sin(time / 60) * 3, -26, 2);
  g.stroke();
  dot(g, 12, 8, 4, C.boot);
  dot(g, 6, 13, 4, C.boot);
}

/** The life medal with "×30". */
function medal(g: Ctx, x: number, y: number, alpha: number): void {
  g.globalAlpha = alpha;
  g.fillStyle = C.band;
  g.beginPath();
  g.moveTo(x - 7, y - 16);
  g.lineTo(x + 7, y - 16);
  g.lineTo(x + 3, y - 6);
  g.lineTo(x - 3, y - 6);
  g.closePath();
  g.fill();
  dot(g, x, y + 2, 9, C.gold);
  g.fillStyle = C.white;
  star(g, x, y + 2, 6, 2.6);
  g.fillStyle = C.gold;
  g.font = 'bold 18px ui-monospace, Menlo, Consolas, monospace';
  g.textAlign = 'left';
  g.fillText('×30', x + 14, y + 8);
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------- choreography

const pose = (kind: Kind, x: number, o: Partial<Pose> = {}): Pose => ({ kind, x, lift: 0, flip: false, rot: 0, phase: 0, fire: false, ...o });
const run = (from: number, to: number): Step => {
  const dur = Math.abs(to - from) / SPEED;
  return { dur, at: (t) => pose('run', from + (to - from) * t, { flip: to < from, phase: (t * dur) / 70 }) };
};
const hold = (kind: Kind, x: number, ms: number, o: Partial<Pose> = {}, mark?: Step['mark']): Step => ({ dur: ms, at: () => pose(kind, x, o), mark });
/** Contra-style somersault: curl into a ball and spin twice. */
const somersault = (x: number, flip: boolean): Step => ({
  dur: 640,
  at: (t) => (t < 0.06 || t > 0.94 ? pose('stand', x, { flip }) : pose('tuck', x, { flip, lift: Math.sin(t * Math.PI) * 80, rot: t * Math.PI * 4 })),
});

/** ↑↑ ↓↓ ←→←→ B A, facing right. */
function forward(W: number, mid: number): Step[] {
  const s: Step[] = [run(-60, mid), hold('stand', mid, 420)];
  s.push(hold('aim', mid, 360), hold('stand', mid, 160), hold('aim', mid, 360), hold('stand', mid, 240));
  s.push(hold('prone', mid, 380), hold('stand', mid, 160), hold('prone', mid, 380), hold('stand', mid, 260));
  for (const flip of [true, false, true, false]) s.push(hold('stand', mid, 300, { flip }));
  s.push(hold('stand', mid, 160));
  s.push(hold('stand', mid, 520, { fire: true }, 'fire'), hold('stand', mid, 200));
  s.push(somersault(mid, false), hold('stand', mid, 1800, {}, 'medal'), run(mid, W + 60));
  return s;
}

/** ↓↓ ↑↑ →←→← A B: the mirror image, entering from the right. */
function backward(W: number, mid: number): Step[] {
  const L = { flip: true };
  const s: Step[] = [run(W + 60, mid), hold('stand', mid, 420, L)];
  s.push(hold('prone', mid, 380, L), hold('stand', mid, 160, L), hold('prone', mid, 380, L), hold('stand', mid, 240, L));
  s.push(hold('aim', mid, 360, L), hold('stand', mid, 160, L), hold('aim', mid, 360, L), hold('stand', mid, 260, L));
  for (const flip of [false, true, false, true]) s.push(hold('stand', mid, 300, { flip }));
  s.push(hold('stand', mid, 160, L));
  s.push(somersault(mid, true), hold('stand', mid, 200, L));
  s.push(hold('stand', mid, 520, { flip: true, fire: true }, 'fire'), hold('stand', mid, 1800, L, 'medal'), run(mid, -60));
  return s;
}

export class Soldier {
  private canvas = document.createElement('canvas');
  private g = this.canvas.getContext('2d')!;
  private stage: SoldierStage = 'basic';
  private steps: Step[] = [];
  private ends: number[] = [];
  private t0 = 0;
  private last = 0;
  private raf = 0;
  private timer = 0;
  private bullets: Bullet[] = [];
  private volleys = 0;
  private medalT = -1;
  private scale = 1;
  private dpr = 1;
  private W = 0;

  constructor(host: HTMLElement) {
    this.canvas.className = 'soldier';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(this.canvas);
  }

  setStage(stage: SoldierStage): void {
    this.stage = stage;
  }

  /** Called when the title screen shows: the first run comes after a short pause. */
  start(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (this.raf || this.timer) return;
    this.schedule(2500);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.raf = 0;
    this.timer = 0;
    this.clear();
  }

  /** Right after a code works: run in, flip, show the medal. */
  celebrate(): void {
    this.stop();
    this.layout();
    const mid = this.mid();
    this.play([run(-60, mid), somersault(mid, false), hold('stand', mid, 1600, {}, 'medal'), run(mid, this.W + 60)]);
  }

  private schedule(ms: number): void {
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      if (document.hidden) return this.schedule(3000);
      this.layout();
      const mid = this.mid();
      if (this.stage === 'basic') this.play(forward(this.W, mid));
      else if (this.stage === 'advanced') this.play(backward(this.W, mid));
      else this.play([run(-60, mid), somersault(mid, false), hold('stand', mid, 260), run(mid, this.W + 60)]);
    }, ms);
  }

  private layout(): void {
    const cssW = this.canvas.parentElement!.clientWidth;
    const h = window.innerHeight;
    this.scale = h < 480 ? 0.55 : cssW < 600 ? 0.75 : 1;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = cssW / this.scale;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${H * this.scale}px`;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(H * this.scale * this.dpr);
  }

  /** Where he performs. On short landscape screens the buttons are on the right: go under them. */
  private mid(): number {
    const short = window.innerHeight < 480 && window.innerWidth > window.innerHeight;
    return Math.round(this.W * (short ? 0.72 : 0.42));
  }

  private play(steps: Step[]): void {
    this.steps = steps;
    this.ends = [];
    steps.reduce((acc, s) => (this.ends.push(acc + s.dur), acc + s.dur), 0);
    this.bullets = [];
    this.volleys = 0;
    this.medalT = -1;
    this.t0 = this.last = performance.now();
    const frame = (now: number) => {
      const el = now - this.t0;
      if (el >= this.ends[this.ends.length - 1]) {
        this.raf = 0;
        this.clear();
        this.schedule(9000 + Math.random() * 6000);
        return;
      }
      this.frame(el, Math.min(50, now - this.last) / 1000);
      this.last = now;
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private clear(): void {
    this.g.setTransform(1, 0, 0, 1, 0, 0);
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private frame(el: number, dt: number): void {
    const g = this.g;
    let i = 0;
    while (this.ends[i] <= el) i++;
    const step = this.steps[i];
    const start = i > 0 ? this.ends[i - 1] : 0;
    const p = step.at((el - start) / step.dur);
    if (step.mark === 'medal' && this.medalT < 0) this.medalT = el;

    const k = this.dpr * this.scale;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, this.W, H);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.shadowColor = C.glow;
    g.shadowBlur = 10;

    g.save();
    g.translate(p.x, GROUND - p.lift);
    g.scale(p.flip ? -1 : 1, 1);
    let muzzle: [number, number] | null = null;
    if (p.kind === 'tuck') {
      g.translate(0, -24);
      g.rotate(p.rot);
      ball(g, el);
    } else if (p.kind === 'prone') {
      // Lying flat, rifle along the ground pointing forward.
      g.translate(-30, -10);
      g.rotate(Math.PI / 2);
      body(g, 'together', true, el, false);
    } else {
      muzzle = body(g, p.kind === 'run' ? p.phase : 'stand', p.kind === 'aim', el, p.fire && Math.floor(el / 70) % 2 === 0);
    }
    const m = muzzle ? g.getTransform().transformPoint(new DOMPoint(muzzle[0], muzzle[1])) : null;
    g.restore();

    // Spread gun: a volley of five every 170 ms while firing.
    if (step.mark === 'fire' && m) {
      const n = Math.floor((el - start) / 170);
      const dir = p.flip ? -1 : 1;
      while (this.volleys <= n) {
        for (const a of [-0.32, -0.16, 0, 0.16, 0.32]) this.bullets.push({ x: m.x / k, y: m.y / k, vx: Math.cos(a) * 620 * dir, vy: Math.sin(a) * 620 });
        this.volleys++;
      }
    }
    g.shadowColor = 'rgba(255, 61, 90, 0.9)';
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      dot(g, b.x, b.y, 4, C.band);
      dot(g, b.x, b.y, 2, C.white);
    }
    this.bullets = this.bullets.filter((b) => b.x > -10 && b.x < this.W + 10 && b.y > -10 && b.y < H + 10);

    if (this.medalT >= 0) {
      const mt = (el - this.medalT) / 1000;
      const a = Math.min(1, mt * 4) * Math.max(0, 1 - Math.max(0, mt - 1.4) * 2.5);
      g.shadowColor = 'rgba(255, 210, 63, 0.8)';
      medal(g, p.x - 6, GROUND - 100 - Math.min(mt, 0.4) * 30, a);
    }
  }
}
