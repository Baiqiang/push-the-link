import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Dir, GameState, Level, Link, MoveEvent, Transform, Vec } from '../engine';
import { currentMode, DELTA, isSwitch, PLAYER, sameVec, switchPos } from '../engine';
import { linkGlyph } from '../i18n';
import { isMirror, mirrorShape } from './icons';
import { apexOffset, exitParam, makeCurve, pointAt, tangentAt, type Curve } from './linkPath';

export const PHASE_MS = 145;

const C = {
  floorA: 0x1b2340,
  floorB: 0x1e2747,
  wall: 0x0d1226,
  wallTop: 0x2a3359,
  goal: 0xf5c451,
  rail: 0x5b3f9e,
  railLit: 0xa47cff,
  plate: 0x1f6f68,
  crate: 0xc9a77c,
  plateOn: 0x3fd9c4,
  lever: 0x9b6bff,
  player: 0xf4f7ff,
  link: 0xc6cdf5,
  linkFire: 0x5ef2d6,
  linkFail: 0xff6b6b,
  ink: 0x101425,
};

export const BOX_COLORS: Record<string, number> = {
  A: 0xff7a6b,
  B: 0x58b8ff,
  C: 0x63d98a,
  D: 0xffb547,
  E: 0xf27bd0,
  F: 0xb7e36b,
  K: C.lever,
  J: 0xff6fb5,
};

const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
const SYMBOL_FONT = 'system-ui, "Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols 2", sans-serif';

interface EntityView {
  id: string;
  root: Container;
  body: Graphics;
  extra: Graphics;
  eyes?: Graphics;
  label?: Text;
  /** Position in tile coordinates (fractional while animating). */
  pos: Vec;
  facing: Dir;
  onGoal: boolean;
  bumpStart: number;
  bumpDir: Dir;
  pulseStart: number;
  tintUntil: number;
}

/** Link label: a pill with either a font glyph or a drawn mirror icon, plus › when one-way. */
interface LinkLabel {
  root: Container;
  pill: Graphics;
  text?: Text;
  icon?: Graphics;
  arrow?: Text;
  t: Transform;
}

interface Flash {
  linkIndex: number;
  start: number;
  dur: number;
  color: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
  size: number;
}

interface RunningAnim {
  start: number;
  phases: number;
  tracks: Map<string, MoveEvent[]>;
  byPhase: MoveEvent[][];
  final: GameState;
  firedPhase: number;
  onPhase?: (phase: number, events: MoveEvent[]) => void;
  resolve: () => void;
}

const ease = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

/** Pixi renderer for one board. Pure view: never decides rules, only plays confirmed results. */
export class BoardView {
  readonly app = new Application();
  private host!: HTMLElement;
  private level: Level | null = null;
  private state: GameState | null = null;
  private links: Link[] = [];
  private linksKey = '';
  private tile = 48;
  private ox = 0;
  private oy = 0;
  private time = 0;

  private world = new Container();
  private bg = new Graphics();
  private goalsG = new Graphics();
  private railG = new Graphics();
  private linkG = new Graphics();
  private labelLayer = new Container();
  private entityLayer = new Container();
  private hintG = new Graphics();
  private fxG = new Graphics();

  private entities = new Map<string, EntityView>();
  private labels: LinkLabel[] = [];
  /** Which side of the chord each link arches to; kept stable while things animate. */
  private linkSide: Array<1 | -1 | 0> = [];
  private flashes: Flash[] = [];
  private particles: Particle[] = [];
  private anim: RunningAnim | null = null;
  private hintDir: Dir | null = null;
  private shakeUntil = 0;
  private resizeObs: ResizeObserver | null = null;

  async init(host: HTMLElement): Promise<void> {
    this.host = host;
    await this.app.init({
      // Canvas 2D first, as chosen for this project; WebGL only as a fallback.
      preference: ['canvas', 'webgl'],
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
    });
    this.app.canvas.classList.add('board-canvas');
    host.appendChild(this.app.canvas);
    // Labels sit above entities so a box never hides which link it is.
    this.world.addChild(this.bg, this.goalsG, this.railG, this.linkG, this.entityLayer, this.labelLayer, this.hintG, this.fxG);
    this.app.stage.addChild(this.world);
    this.app.ticker.add((tk) => this.tick(tk.deltaMS));
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  setRunning(on: boolean): void {
    if (on) this.app.ticker.start();
    else this.app.ticker.stop();
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    if (w !== this.app.screen.width || h !== this.app.screen.height) this.app.renderer.resize(w, h);
    this.layout();
  }

  /** Load a level and snap to a state (no animation). */
  load(level: Level, state: GameState, links: Link[]): void {
    this.finish();
    this.level = level;
    this.particles = [];
    this.flashes = [];
    this.hintDir = null;
    for (const e of this.entities.values()) e.root.destroy({ children: true });
    this.entities.clear();
    this.linksKey = '';
    const ids = [...level.boxIds, PLAYER];
    for (const id of ids) {
      const root = new Container();
      const extra = new Graphics();
      const body = new Graphics();
      root.addChild(extra, body);
      let label: Text | undefined;
      let eyes: Graphics | undefined;
      if (id === PLAYER) {
        eyes = new Graphics();
        root.addChild(eyes);
      } else {
        label = new Text({ text: id, style: { fontFamily: FONT, fontWeight: '900', fill: isSwitch(level, id) ? 0xffffff : C.ink } });
        label.anchor.set(0.5);
        root.addChild(label);
      }
      this.entityLayer.addChild(root);
      this.entities.set(id, { id, root, body, extra, eyes, label, pos: [0, 0], facing: 'D', onGoal: false, bumpStart: -1e9, bumpDir: 'R', pulseStart: -1e9, tintUntil: 0 });
    }
    this.setLinks(links);
    this.setState(state);
    this.layout();
  }

  setLinks(links: Link[]): void {
    const key = JSON.stringify(links);
    if (key === this.linksKey) return;
    this.linksKey = key;
    this.links = links;
    this.linkSide = links.map(() => 0);
    for (const l of this.labels) l.root.destroy({ children: true });
    this.labels = links.map(([, , k, oneWay]) => {
      const root = new Container();
      const pill = new Graphics();
      root.addChild(pill);
      const label: LinkLabel = { root, pill, t: k };
      if (isMirror(k)) {
        label.icon = new Graphics();
        root.addChild(label.icon);
        if (oneWay) {
          label.arrow = new Text({ text: '›', style: { fontFamily: SYMBOL_FONT, fontWeight: '900', fill: C.ink } });
          label.arrow.anchor.set(0.5);
          root.addChild(label.arrow);
        }
      } else {
        label.text = new Text({ text: linkGlyph(k, !!oneWay), style: { fontFamily: SYMBOL_FONT, fontWeight: '700', fill: C.ink } });
        label.text.anchor.set(0.5);
        root.addChild(label.text);
      }
      this.labelLayer.addChild(root);
      return label;
    });
    this.styleLabels();
  }

  /** Snap every entity to a state. Returns ids of boxes that just landed on a goal. */
  setState(state: GameState): string[] {
    this.finish();
    return this.applyFinal(state);
  }

  private applyFinal(state: GameState): string[] {
    if (!this.level) return [];
    this.state = state;
    const landed: string[] = [];
    for (const [id, ev] of this.entities) {
      const p = id === PLAYER ? state.player : state.boxes[id];
      ev.pos = [p[0], p[1]];
      if (id !== PLAYER && !isSwitch(this.level, id)) {
        const on = this.level.goals.some((g) => sameVec(g, p));
        if (on && !ev.onGoal) {
          landed.push(id);
          ev.pulseStart = this.time;
        }
        ev.onGoal = on;
        this.drawEntity(ev);
      }
    }
    this.drawRail();
    this.placeEntities();
    return landed;
  }

  /** Play a confirmed move; resolves when finished (or skipped). */
  animate(events: MoveEvent[], phases: number, final: GameState, onPhase?: (phase: number, events: MoveEvent[]) => void): Promise<string[]> {
    this.finish();
    this.hintDir = null;
    const tracks = new Map<string, MoveEvent[]>();
    const byPhase: MoveEvent[][] = Array.from({ length: phases }, () => []);
    for (const ev of events) {
      const list = tracks.get(ev.entity) ?? [];
      list.push(ev);
      tracks.set(ev.entity, list);
      byPhase[ev.phase].push(ev);
    }
    for (const list of tracks.values()) list.sort((a, b) => a.phase - b.phase);
    const player = this.entities.get(PLAYER);
    const input = events.find((e) => e.cause === 'input');
    if (player && input) player.facing = input.dir;
    return new Promise((resolve) => {
      let landed: string[] = [];
      this.anim = {
        start: this.time,
        phases,
        tracks,
        byPhase,
        final,
        firedPhase: -1,
        onPhase,
        resolve: () => resolve(landed),
      };
      // Capture the landed boxes when the animation completes.
      const orig = this.anim.resolve;
      this.anim.resolve = () => {
        landed = this.applyFinal(final);
        orig();
      };
    });
  }

  /** Jump any running animation to its end state. */
  finish(): void {
    const a = this.anim;
    if (!a) return;
    // Skipped phases are dropped silently; only the final positions matter.
    this.anim = null;
    a.resolve();
  }

  get animating(): boolean {
    return this.anim !== null;
  }

  /** Visual feedback for a rejected move. */
  bump(entity: string, dir: Dir, alsoPlayer: boolean): void {
    const ev = this.entities.get(entity);
    if (ev) {
      ev.bumpStart = this.time;
      ev.bumpDir = dir;
      ev.tintUntil = this.time + 260;
    }
    if (alsoPlayer && entity !== PLAYER) {
      const p = this.entities.get(PLAYER);
      if (p) {
        p.bumpStart = this.time;
      }
    }
    this.links.forEach(([a, b], i) => {
      if (a === entity || b === entity) this.flashes.push({ linkIndex: i, start: this.time, dur: 420, color: C.linkFail });
    });
    this.shakeUntil = this.time + 160;
  }

  setPlayerFacing(dir: Dir): void {
    const p = this.entities.get(PLAYER);
    if (p) {
      p.facing = dir;
      p.bumpDir = dir;
    }
  }

  showHint(dir: Dir | null): void {
    this.hintDir = dir;
  }

  celebrate(): void {
    if (!this.level || !this.state) return;
    const colors = [C.goal, 0xffffff, C.linkFire, 0xff7a6b, 0x58b8ff];
    for (const g of this.level.goals) {
      const [cx, cy] = this.px(g);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.08 + Math.random() * 0.22) * this.tile;
        this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - this.tile * 0.12, life: 0, max: 900 + Math.random() * 600, color: colors[i % colors.length], size: this.tile * (0.04 + Math.random() * 0.05) });
      }
    }
    for (const ev of this.entities.values()) ev.pulseStart = this.time + Math.random() * 200;
  }

  /** Screen rect (CSS px) of a board cell, for tutorial spotlights. */
  cellRect(cell: Vec): DOMRect {
    const r = this.app.canvas.getBoundingClientRect();
    return new DOMRect(r.left + this.ox + cell[0] * this.tile, r.top + this.oy + cell[1] * this.tile, this.tile, this.tile);
  }

  entityCell(id: string): Vec | null {
    if (!this.state) return null;
    return id === PLAYER ? this.state.player : this.state.boxes[id] ?? null;
  }

  // ---------------------------------------------------------------- layout & drawing

  private px(p: Vec): Vec {
    return [this.ox + (p[0] + 0.5) * this.tile, this.oy + (p[1] + 0.5) * this.tile];
  }

  private layout(): void {
    if (!this.level) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const pad = 8;
    this.tile = Math.max(12, Math.floor(Math.min((w - pad * 2) / this.level.width, (h - pad * 2) / this.level.height, 84)));
    this.ox = Math.round((w - this.tile * this.level.width) / 2);
    this.oy = Math.round((h - this.tile * this.level.height) / 2);
    this.drawBackground();
    this.drawGoals();
    this.drawRail();
    for (const ev of this.entities.values()) this.drawEntity(ev);
    this.styleLabels();
    this.placeEntities();
  }

  private drawBackground(): void {
    const g = this.bg.clear();
    const lv = this.level!;
    const t = this.tile;
    const isWall = (x: number, y: number) => x < 0 || y < 0 || x >= lv.width || y >= lv.height || lv.walls[y][x];
    for (let y = 0; y < lv.height; y++) {
      for (let x = 0; x < lv.width; x++) {
        const X = this.ox + x * t;
        const Y = this.oy + y * t;
        if (!lv.walls[y][x]) {
          g.rect(X, Y, t, t).fill((x + y) % 2 ? C.floorA : C.floorB);
        }
      }
    }
    // Walls: a raised top face plus a darker front edge where the wall faces floor below.
    for (let y = 0; y < lv.height; y++) {
      for (let x = 0; x < lv.width; x++) {
        if (!lv.walls[y][x]) continue;
        const X = this.ox + x * t;
        const Y = this.oy + y * t;
        g.roundRect(X + 1, Y + 1, t - 2, t - 2, t * 0.14).fill(C.wallTop);
        g.roundRect(X + t * 0.1, Y + t * 0.1, t * 0.8, t * 0.8, t * 0.1).fill({ color: 0x343e6b, alpha: 0.45 });
        if (!isWall(x, y + 1)) g.rect(X + 1, Y + t - t * 0.16, t - 2, t * 0.16).fill(C.wall);
      }
    }
  }

  private drawGoals(): void {
    const g = this.goalsG.clear();
    for (const goal of this.level!.goals) {
      const [cx, cy] = this.px(goal);
      g.circle(cx, cy, this.tile * 0.3).stroke({ width: Math.max(2, this.tile * 0.07), color: C.goal });
      g.circle(cx, cy, this.tile * 0.12).fill({ color: C.goal, alpha: 0.25 });
    }
  }

  /** Switch rails and pressure plates; lit parts show the active positions. */
  private drawRail(): void {
    const g = this.railG.clear();
    const lv = this.level;
    if (!lv || !this.state) return;
    const t = this.tile;
    const mode = currentMode(lv, this.state);
    for (const p of lv.data.plates ?? []) {
      const on = mode === 'ON';
      const X = this.ox + p[0] * t;
      const Y = this.oy + p[1] * t;
      g.roundRect(X + t * 0.12, Y + t * 0.12, t * 0.76, t * 0.76, t * 0.14).fill({ color: on ? C.plateOn : C.plate, alpha: on ? 0.9 : 0.55 });
      g.roundRect(X + t * 0.22, Y + t * 0.22, t * 0.56, t * 0.56, t * 0.1).stroke({ width: Math.max(1.5, t * 0.04), color: on ? 0xe9fffb : C.plateOn, alpha: on ? 0.9 : 0.6 });
    }
    // One rail per track switch, tinted in that switch's colour; the occupied side is lit.
    for (const sw of lv.switches) {
      const color = BOX_COLORS[sw.id] ?? C.lever;
      const pos = switchPos(sw, this.state);
      const pts = sw.rail.map((r) => this.px(r));
      const xs = pts.map((p) => p[0]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const y = pts[0][1];
      g.roundRect(minX - t * 0.4, y - t * 0.13, maxX - minX + t * 0.8, t * 0.26, t * 0.13).fill({ color, alpha: 0.35 });
      sw.rail.forEach((r, i) => {
        const lit = (r[0] <= sw.mode_by_x) === (pos === 'LEFT');
        g.circle(pts[i][0], pts[i][1], t * 0.09).fill({ color: lit ? color : C.rail, alpha: lit ? 1 : 0.6 });
        g.rect(this.ox + r[0] * t + 2, this.oy + r[1] * t + 2, t - 4, t - 4).stroke({ width: 1.5, color, alpha: 0.5 });
      });
    }
  }

  private drawEntity(ev: EntityView): void {
    const t = this.tile;
    const g = ev.body.clear();
    const x = ev.extra.clear();
    if (ev.id === PLAYER) {
      const r = t * 0.32;
      x.ellipse(0, r * 0.95, r * 0.9, r * 0.28).fill({ color: 0x000000, alpha: 0.28 });
      g.circle(0, 0, r).fill(C.player);
      g.circle(0, 0, r).stroke({ width: Math.max(1.5, t * 0.04), color: 0x9aa6d9 });
      return;
    }
    const free = this.level?.data.free?.includes(ev.id) ?? false;
    const color = free ? C.crate : BOX_COLORS[ev.id] ?? 0xcccccc;
    if (this.level && isSwitch(this.level, ev.id)) {
      const s = t * 0.4;
      x.ellipse(0, s * 0.9, s * 0.8, s * 0.25).fill({ color: 0x000000, alpha: 0.28 });
      g.poly([0, -s, s, 0, 0, s, -s, 0]).fill(color);
      g.poly([0, -s, s, 0, 0, s, -s, 0]).stroke({ width: Math.max(1.5, t * 0.045), color: 0xe1d3ff, join: 'round' });
    } else {
      const s = t * 0.78;
      if (ev.onGoal) {
        x.roundRect(-s / 2 - t * 0.07, -s / 2 - t * 0.07, s + t * 0.14, s + t * 0.14, s * 0.26).fill({ color: C.goal, alpha: 0.35 });
        x.roundRect(-s / 2 - t * 0.04, -s / 2 - t * 0.04, s + t * 0.08, s + t * 0.08, s * 0.24).stroke({ width: Math.max(2, t * 0.05), color: C.goal });
      } else {
        x.roundRect(-s / 2, -s / 2 + t * 0.06, s, s, s * 0.2).fill({ color: 0x000000, alpha: 0.3 });
      }
      g.roundRect(-s / 2, -s / 2, s, s, s * (free ? 0.12 : 0.2)).fill(color);
      if (free) {
        // Plain crate: plank border and a cross brace, so it reads as "not linked".
        const w = Math.max(1.5, t * 0.045);
        g.roundRect(-s / 2 + w, -s / 2 + w, s - w * 2, s - w * 2, s * 0.08).stroke({ width: w, color: 0x7a5c3e, alpha: 0.8 });
        g.moveTo(-s * 0.32, -s * 0.32).lineTo(s * 0.32, s * 0.32).stroke({ width: w, color: 0x7a5c3e, alpha: 0.5 });
      } else g.roundRect(-s / 2 + s * 0.08, -s / 2 + s * 0.06, s * 0.84, s * 0.22, s * 0.1).fill({ color: 0xffffff, alpha: 0.22 });
    }
    if (ev.label) {
      ev.label.style.fontSize = Math.round(t * (this.level && isSwitch(this.level, ev.id) ? 0.36 : 0.46));
    }
  }

  private styleLabels(): void {
    const t = this.tile;
    for (const l of this.labels) {
      const h = t * 0.36;
      const w = l.arrow ? t * 0.56 : t * 0.5;
      l.pill.clear().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(C.link);
      if (l.text) l.text.style.fontSize = Math.round(t * 0.26);
      if (l.icon && isMirror(l.t)) {
        // Same icon for both mirrors, turned 90° for the vertical one.
        const s = t * 0.12;
        const ox = l.arrow ? -t * 0.06 : 0;
        const { axis, triangles } = mirrorShape(l.t);
        const g = l.icon.clear();
        g.rect(ox + axis[0] * s, axis[1] * s, axis[2] * s, axis[3] * s).fill(C.ink);
        for (const p of triangles) g.poly(p.map((v, i) => v * s + (i % 2 === 0 ? ox : 0))).fill(C.ink);
        if (l.arrow) {
          l.arrow.style.fontSize = Math.round(t * 0.24);
          l.arrow.position.set(t * 0.16, -t * 0.01);
        }
      }
    }
  }

  private placeEntities(): void {
    for (const ev of this.entities.values()) {
      const [x, y] = this.px(ev.pos);
      ev.root.position.set(x, y);
    }
  }

  // ---------------------------------------------------------------- per-frame

  private tick(dt: number): void {
    this.time += dt;
    const now = this.time;
    const a = this.anim;
    if (a) {
      const elapsed = now - a.start;
      const phase = Math.min(a.phases - 1, Math.floor(elapsed / PHASE_MS));
      for (let p = a.firedPhase + 1; p <= phase; p++) {
        a.firedPhase = p;
        for (const ev of a.byPhase[p]) {
          if (ev.cause === 'link' && ev.linkIndex !== undefined) this.flashes.push({ linkIndex: ev.linkIndex, start: now, dur: 520, color: C.linkFire });
        }
        a.onPhase?.(p, a.byPhase[p]);
      }
      for (const [id, track] of a.tracks) {
        const ev = this.entities.get(id)!;
        const cur = elapsed / PHASE_MS;
        let pos: Vec = track[0].from;
        for (const m of track) {
          if (cur >= m.phase + 1) pos = m.to;
          else if (cur >= m.phase) {
            const k = ease(cur - m.phase);
            pos = [m.from[0] + (m.to[0] - m.from[0]) * k, m.from[1] + (m.to[1] - m.from[1]) * k];
            break;
          } else break;
        }
        ev.pos = pos;
      }
      if (elapsed >= a.phases * PHASE_MS) this.finish();
    }

    // Entity transforms: position, bump, pulse, tint.
    for (const ev of this.entities.values()) {
      let [x, y] = this.px(ev.pos);
      const bu = (now - ev.bumpStart) / 200;
      if (bu >= 0 && bu < 1) {
        const [dx, dy] = DELTA[ev.bumpDir];
        const o = Math.sin(bu * Math.PI) * this.tile * 0.14;
        x += dx * o;
        y += dy * o;
      }
      ev.root.position.set(x, y);
      const pu = (now - ev.pulseStart) / 420;
      ev.root.scale.set(pu >= 0 && pu < 1 ? 1 + Math.sin(pu * Math.PI) * 0.16 : 1);
      ev.body.tint = now < ev.tintUntil ? 0xff8a8a : 0xffffff;
      if (ev.id === PLAYER) this.drawEyes(ev);
    }

    this.drawLinks(now);
    this.drawHint(now);
    this.drawFx(dt);

    if (now < this.shakeUntil) {
      const m = this.tile * 0.05;
      this.world.position.set((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    } else this.world.position.set(0, 0);
  }

  private drawEyes(ev: EntityView): void {
    const g = ev.eyes;
    if (!g) return;
    const r = this.tile * 0.32;
    const [dx, dy] = DELTA[ev.facing];
    const blink = this.time % 3600 < 110;
    const ex = dx * r * 0.32;
    const ey = dy * r * 0.32;
    g.clear();
    for (const s of [-1, 1]) {
      const cx = ex - dy * s * r * 0.36;
      const cy = ey + dx * s * r * 0.36 - r * 0.05;
      if (blink) g.rect(cx - r * 0.12, cy - r * 0.025, r * 0.24, r * 0.05).fill(C.ink);
      else g.circle(cx, cy, r * 0.12).fill(C.ink);
    }
  }

  private endpointPx(id: string): Vec | null {
    const ev = this.entities.get(id);
    return ev ? this.px(ev.pos) : null;
  }

  /** Half-size of an entity's body in px, used to start the line at its edge. */
  private halfSize(id: string): number {
    return this.tile * (id === PLAYER ? 0.32 : this.level && isSwitch(this.level, id) ? 0.4 : 0.39);
  }

  /** How badly a candidate arch collides with walls, other pieces and earlier labels. */
  private archCost(c: Curve, a: string, b: string, labels: Vec[]): number {
    const lv = this.level!;
    const t = this.tile;
    let cost = 0;
    for (const u of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      const [x, y] = pointAt(c, u);
      const gx = Math.floor((x - this.ox) / t);
      const gy = Math.floor((y - this.oy) / t);
      const w = u === 0.5 ? 3 : 1; // the label sits at the midpoint
      if (gx < 0 || gy < 0 || gx >= lv.width || gy >= lv.height) cost += 4 * w;
      // Links cross walls by design, so a wall under the arch is only a mild preference.
      else if (lv.walls[gy][gx]) cost += 0.3 * w;
      // A label on a goal ring or a plate hides it; the line itself crossing one is fine.
      else if (u === 0.5 && [...lv.goals, ...(lv.data.plates ?? [])].some(([px, py]) => px === gx && py === gy)) cost += 3;
      for (const [id, ev] of this.entities) {
        if (id === a || id === b) continue;
        const [ex, ey] = this.px(ev.pos);
        if (Math.abs(ex - x) < t * 0.5 && Math.abs(ey - y) < t * 0.5) cost += 2 * w;
      }
    }
    const [mx, my] = pointAt(c, 0.5);
    for (const l of labels) if (this.labelsClash(l, [mx, my])) cost += 6;
    return cost;
  }

  /** Two link labels too close to read apart (pills are ~0.5 × 0.36 tiles). */
  private labelsClash(a: Vec, b: Vec): boolean {
    return Math.abs(a[0] - b[0]) < this.tile * 0.8 && Math.abs(a[1] - b[1]) < this.tile * 0.7;
  }

  private drawLinks(now: number): void {
    const g = this.linkG.clear();
    const t = this.tile;
    this.flashes = this.flashes.filter((f) => now - f.start < f.dur);
    // Count how many links share an endpoint pair so parallel arches fan out.
    const pairSeen = new Map<string, number>();
    const placed: Vec[] = [];
    this.links.forEach(([a, b], i) => {
      const pa = this.endpointPx(a);
      const pb = this.endpointPx(b);
      const label = this.labels[i];
      if (!pa || !pb) return;
      const pairKey = [a, b].sort().join('');
      const n = pairSeen.get(pairKey) ?? 0;
      pairSeen.set(pairKey, n + 1);
      const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      const base = apexOffset(len, t, n);

      // Try both sides, at the normal height and a taller one, and keep the arch that
      // collides least (walls, other pieces, goal rings, other labels). The side is sticky:
      // it never flips mid-animation and only flips at rest for a clear improvement.
      const kept = this.linkSide[i];
      const prefer: 1 | -1 = kept || (i % 2 === 0 ? 1 : -1);
      let best: { curve: Curve; side: 1 | -1; apex: number; score: number } | null = null;
      for (const side of [prefer, -prefer as 1 | -1]) {
        if (kept && side !== kept && this.anim) continue;
        for (const apex of [base, base + t * 0.45]) {
          const curve = makeCurve(pa, pb, apex, side);
          const score = this.archCost(curve, a, b, placed) + (apex > base ? 1.5 : 0) + (kept && side !== kept ? 2 : 0);
          if (!best || score < best.score) best = { curve, side, apex, score };
        }
      }
      const { curve, side, apex } = best!;
      this.linkSide[i] = side;
      // Crossing links can still put two labels in one spot: slide this one along its own
      // line to the nearest free place (never onto another piece).
      const onPiece = (q: Vec) => [...this.entities.values()].some((ev) => {
        const [ex, ey] = this.px(ev.pos);
        return Math.abs(ex - q[0]) < t * 0.6 && Math.abs(ey - q[1]) < t * 0.55;
      });
      let labelAt = pointAt(curve, 0.5);
      if (placed.some((l) => this.labelsClash(l, labelAt))) {
        for (const u of [0.38, 0.62, 0.3, 0.7, 0.24, 0.76]) {
          const q = pointAt(curve, u);
          if (!placed.some((l) => this.labelsClash(l, q)) && !onPiece(q)) {
            labelAt = q;
            break;
          }
        }
      }
      placed.push(labelAt);

      const flash = this.flashes.filter((f) => f.linkIndex === i).pop();
      const fk = flash ? 1 - (now - flash.start) / flash.dur : 0;
      const color = flash ? flash.color : C.link;
      const width = Math.max(2, t * (0.055 + fk * 0.05));
      const alpha = 0.75 + fk * 0.25;

      // Only the part between the two boxes' edges is drawn, so short links stay visible.
      const u0 = exitParam(curve, pa, this.halfSize(a), true);
      const u1 = exitParam(curve, pb, this.halfSize(b), false);
      const arcLen = len + apex * 2;
      const steps = Math.max(16, Math.ceil(arcLen / 5));
      const pts: Vec[] = [];
      for (let s = 0; s <= steps; s++) pts.push(pointAt(curve, u0 + ((u1 - u0) * s) / steps));
      const dash = t * 0.2;
      const gap = t * 0.13;
      const period = dash + gap;
      let dist = (now * (flash ? 0.12 : 0.012)) % period;
      let drawing = false;
      for (let s = 1; s < pts.length; s++) {
        const [x0, y0] = pts[s - 1];
        const [x1, y1] = pts[s];
        const segLen = Math.hypot(x1 - x0, y1 - y0);
        const on = dist % period < dash;
        if (on) {
          if (!drawing) g.moveTo(x0, y0);
          g.lineTo(x1, y1);
        }
        drawing = on;
        dist += segLen;
      }
      g.stroke({ width, color, alpha, cap: 'round' });
      // Small dots where the line meets each box.
      for (const p of [pts[0], pts[pts.length - 1]]) g.circle(p[0], p[1], t * 0.065).fill({ color, alpha });
      if (this.links[i][3] === '>') {
        // One-way: arrowhead right at the driven box's edge, pointing into it.
        const [ax, ay] = pts[pts.length - 1];
        const [tx, ty] = tangentAt(curve, u1);
        const L = t * 0.24;
        const W = t * 0.15;
        const bx = ax - tx * L;
        const by = ay - ty * L;
        g.poly([ax, ay, bx - ty * W, by + tx * W, bx + ty * W, by - tx * W]).fill({ color, alpha });
      }

      if (label) {
        const [lx, ly] = labelAt;
        label.root.position.set(lx, ly);
        label.root.scale.set(1 + fk * 0.25);
        label.pill.tint = flash ? color : 0xffffff;
      }
    });
  }

  private drawHint(now: number): void {
    const g = this.hintG.clear();
    if (!this.hintDir || this.anim) return;
    const p = this.entities.get(PLAYER);
    if (!p) return;
    const t = this.tile;
    const [dx, dy] = DELTA[this.hintDir];
    const wave = (Math.sin(now / 180) + 1) / 2;
    const [cx, cy] = this.px([p.pos[0] + dx * (0.62 + wave * 0.12), p.pos[1] + dy * (0.62 + wave * 0.12)]);
    const px = -dy;
    const py = dx;
    const L = t * 0.26;
    const W = t * 0.22;
    g.poly([cx + dx * L, cy + dy * L, cx - dx * L * 0.4 + px * W, cy - dy * L * 0.4 + py * W, cx - dx * L * 0.4 - px * W, cy - dy * L * 0.4 - py * W]).fill({
      color: C.linkFire,
      alpha: 0.65 + wave * 0.35,
    });
  }

  private drawFx(dt: number): void {
    const g = this.fxG.clear();
    if (!this.particles.length) return;
    const grav = this.tile * 0.0006;
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      if (p.life > p.max) return false;
      p.vy += grav * dt;
      p.x += (p.vx * dt) / 16;
      p.y += (p.vy * dt) / 16;
      p.vx *= 0.985;
      const a = 1 - p.life / p.max;
      g.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size).fill({ color: p.color, alpha: a });
      return true;
    });
  }

  destroy(): void {
    this.resizeObs?.disconnect();
    this.app.destroy(true, { children: true });
  }
}
