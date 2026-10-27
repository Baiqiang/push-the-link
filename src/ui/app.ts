import { activeLinks, GameSession, isSwitch, LEVELS, PLAYER, type Dir, type Mode, type MoveEvent } from '../engine';
import { sfx, setSoundEnabled, unlockAudio } from '../audio';
import { detectLang, dirLabel, failMessage, getLang, loc, onLangChange, setLang, t } from '../i18n';
import { clearProgress, recordClear, save, starsFor, totalStars, updateSave } from '../save';
import { SolverClient } from '../solverClient';
import { BoardView } from './board';
import { Coach } from './coach';
import { CheatListener, keyToCheatToken, type CheatId, type CheatToken } from '../cheats';
import { bindSwipe, keyToDir, TOUCH_QUERY } from './controls';
import { Soldier } from './soldier';
import { $, applyI18n, closeModal, h, handleModalKey, modalOpen, openModal, setStatus, starsHtml, toast } from './dom';
import { flashLinks, modeName, renderHud, renderLevelInfo, renderLevelList } from './panels';
import { EVENT_TIPS, introFor } from './tutorial';
import { mirrorSvg } from './icons';

const DEMO_GAP_MS = 110;
const ATTRACT_LEVELS = [14, 3, 15, 28];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isTouch = () => window.matchMedia(TOUCH_QUERY).matches;
/** Must match the compact breakpoint in style.css: side panels become slide-in sheets. */
export const COMPACT_QUERY = '(max-width: 1100px), (max-height: 560px)';
const isCompact = () => window.matchMedia(COMPACT_QUERY).matches;
const isStandalone = () => window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
type Sheet = 'levels' | 'info';

export class App {
  private board = new BoardView();
  private titleBoard = new BoardView();
  private coach = new Coach();
  private solver = new SolverClient();
  private session = new GameSession(LEVELS[0]);
  private screen: 'title' | 'game' = 'title';
  /** Bumped by every state change so stale async work (hints, demo) can bail out. */
  private stateToken = 0;
  private demo: { cancelled: boolean } | null = null;
  /** True once the solver drove a move in this attempt; such clears aren't recorded. */
  private assisted = false;
  private attractToken = 0;
  private cheats = new CheatListener();
  private soldier!: Soldier;
  private installPrompt: (Event & { prompt: () => Promise<void> }) | null = null;

  async start(): Promise<void> {
    const s = save();
    this.soldier = new Soldier($('soldier-strip'));
    setLang(s.lang ?? detectLang());
    setSoundEnabled(s.sound);
    await Promise.all([this.board.init($('board-host')), this.titleBoard.init($('title-board'))]);
    this.board.setRunning(false);
    this.bindUi();
    document.querySelectorAll<HTMLElement>('[data-mirror]').forEach((el) => el.replaceChildren(mirrorSvg(el.dataset.mirror as 'H' | 'V', 15)));
    onLangChange(() => this.onLangChanged());
    this.onLangChanged();
    this.loadLevel(s.lastLevel || 1, { silent: true });
    this.showTitle();
  }

  // ---------------------------------------------------------------- wiring

  private bindUi(): void {
    window.addEventListener('keydown', (e) => this.onKey(e));
    // Any first interaction unlocks WebAudio.
    window.addEventListener('pointerdown', () => unlockAudio(), { capture: true });

    bindSwipe($('board-host'), (d) => this.input(d));
    // Title screen: swipes and a double tap feed the cheat listener (see cheats.ts).
    let lastTap = { t: 0, x: 0, y: 0 };
    bindSwipe(
      $('title-screen'),
      (d) => this.cheatInput(d),
      (e) => {
        // Use the event's own timestamp: handling can lag behind a busy frame, the input doesn't.
        const now = e.timeStamp;
        if (now - lastTap.t < 400 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
          lastTap.t = 0;
          this.cheatInput('TAP2');
        } else lastTap = { t: now, x: e.clientX, y: e.clientY };
      },
    );
    $('btn-cheat-hints').addEventListener('click', () => this.toggleCheat('hints'));
    $('btn-cheat-solutions').addEventListener('click', () => this.toggleCheat('solutions'));

    $('btn-undo').addEventListener('click', () => this.undo());
    $('btn-reset').addEventListener('click', () => this.reset());
    $('btn-hint').addEventListener('click', () => void this.hint());
    $('btn-demo').addEventListener('click', () => void this.toggleDemo());
    $('btn-home').addEventListener('click', () => this.showTitle());
    $('btn-levels').addEventListener('click', () => this.toggleSheet('levels'));
    $('btn-info').addEventListener('click', () => this.toggleSheet('info'));
    $('btn-info-close').addEventListener('click', () => this.closeSheets());
    $('scrim').addEventListener('click', () => this.closeSheets());
    // Leaving compact layout (e.g. rotating a tablet) must not leave a sheet stuck open.
    window.matchMedia(COMPACT_QUERY).addEventListener('change', () => this.closeSheets());
    $('btn-clear').addEventListener('click', () => this.confirmClear());

    for (const id of ['btn-lang', 'btn-lang-title']) $(id).addEventListener('click', () => this.toggleLang());
    for (const id of ['btn-sound', 'btn-sound-title']) $(id).addEventListener('click', () => this.toggleSound());

    $('btn-start').addEventListener('click', () => this.enterGame(this.continueLevel()));
    $('btn-title-levels').addEventListener('click', () => {
      this.enterGame(this.session.level.id);
      if (isCompact()) this.toggleSheet('levels', true);
    });
    $('btn-how').addEventListener('click', () => this.showHowTo());
    $('btn-install').addEventListener('click', () => void this.install());

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as App['installPrompt'];
      $('btn-install').hidden = isStandalone();
    });
    window.addEventListener('appinstalled', () => ($('btn-install').hidden = true));
    // iOS Safari has no install prompt; offer instructions instead.
    if (isIos() && !isStandalone()) $('btn-install').hidden = false;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (this.coach.handleKey(e)) {
      e.preventDefault();
      return;
    }
    if (handleModalKey(e)) return;
    if (this.screen === 'title') {
      const tok = keyToCheatToken(e.key);
      if (tok) {
        e.preventDefault();
        this.cheatInput(tok);
        return;
      }
      if (e.key === 'Enter' && document.activeElement === document.body) this.enterGame(this.continueLevel());
      return;
    }
    const dir = keyToDir(e.key);
    if (dir) {
      e.preventDefault();
      // Held keys auto-repeat at animation pace instead of queueing up.
      if (e.repeat && this.board.animating) return;
      this.input(dir);
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'z' || e.key === 'Backspace') {
      e.preventDefault();
      this.undo();
    } else if (k === 'r' && !e.repeat) this.reset();
    else if (k === 'h' && !e.repeat) void this.hint();
    else if (k === 'escape') this.closeSheets();
    else if (/^[1-9]$/.test(e.key)) this.loadLevel(Number(e.key));
  }

  // ---------------------------------------------------------------- screens

  private continueLevel(): number {
    // Resume the last level unless it is already cleared; then jump to the first uncleared one.
    const s = save();
    const last = s.lastLevel || 1;
    if (!s.levels[last]) return last;
    return LEVELS.find((l) => !s.levels[l.id])?.id ?? last;
  }

  private showTitle(): void {
    this.stopDemo();
    closeModal(false);
    this.coach.close();
    this.screen = 'title';
    $('title-screen').hidden = false;
    this.board.setRunning(false);
    this.titleBoard.setRunning(true);
    this.renderTitle();
    this.soldier.start();
    void this.runAttract();
    $('btn-start').focus({ preventScroll: true });
  }

  private renderTitle(): void {
    const s = save();
    const started = Object.keys(s.levels).length > 0;
    $('btn-start').textContent = started ? t('continue', { n: this.continueLevel() }) : t('start');
    $('title-stars').textContent = started ? `★ ${totalStars()} / ${LEVELS.length * 3}` : '';
    const c = s.cheats;
    for (const id of ['hints', 'solutions'] as const) {
      const btn = $(id === 'hints' ? 'btn-cheat-hints' : 'btn-cheat-solutions');
      btn.hidden = !c[id].unlocked;
      btn.textContent = `${t(id === 'hints' ? 'cheatHintsToggle' : 'cheatSolutionsToggle')} · ${t(c[id].on ? 'on' : 'off')}`;
      btn.setAttribute('aria-pressed', String(c[id].on));
    }
    this.soldier.setStage(c.solutions.unlocked ? 'done' : c.hints.unlocked ? 'advanced' : 'basic');
  }

  // ---------------------------------------------------------------- cheats

  private cheatOn(id: CheatId): boolean {
    const c = save().cheats[id];
    return c.unlocked && c.on;
  }

  private cheatInput(tok: CheatToken): void {
    const id = this.cheats.push(tok);
    if (id) this.onCheat(id);
  }

  private onCheat(id: CheatId): void {
    unlockAudio();
    if (id === 'solutions' && !save().cheats.hints.unlocked) {
      toast(t('cheatNeedBasic'));
      return;
    }
    if (this.cheatOn(id)) {
      toast(t('cheatAgain'));
      return;
    }
    updateSave((d) => {
      d.cheats[id].unlocked = true;
      d.cheats[id].on = true;
    });
    sfx.cheat();
    toast(t(id === 'hints' ? 'cheatHints' : 'cheatSolutions'), { ms: 5200 });
    this.renderTitle();
    this.soldier.celebrate();
    this.refresh();
  }

  /** Title-screen pills switch an unlocked cheat on and off. */
  private toggleCheat(id: CheatId): void {
    updateSave((d) => (d.cheats[id].on = !d.cheats[id].on));
    sfx.click();
    this.renderTitle();
    this.refresh();
  }

  private readyText(): string {
    if (isTouch()) return t('readyTouch');
    return t('ready') + (this.cheatOn('hints') ? t('readyHint') : '');
  }

  private enterGame(levelId: number): void {
    unlockAudio();
    sfx.click();
    this.attractToken++;
    this.soldier.stop();
    this.cheats.reset();
    this.screen = 'game';
    $('title-screen').hidden = true;
    this.titleBoard.setRunning(false);
    this.board.setRunning(true);
    this.loadLevel(levelId);
  }

  /** Title-screen background: loops reference solutions of a few levels. */
  private async runAttract(): Promise<void> {
    const token = ++this.attractToken;
    for (let round = 0; ; round++) {
      const lv = LEVELS[ATTRACT_LEVELS[round % ATTRACT_LEVELS.length]];
      const demo = new GameSession(lv);
      this.titleBoard.load(lv, demo.state, activeLinks(lv, demo.state));
      await sleep(900);
      for (const d of lv.data.solution as unknown as Dir[]) {
        if (token !== this.attractToken) return;
        const r = demo.move(d);
        if (!r.ok) break;
        await this.titleBoard.animate(r.events, r.phases, r.state);
        this.titleBoard.setLinks(activeLinks(lv, r.state));
        await sleep(260);
      }
      if (token !== this.attractToken) return;
      this.titleBoard.celebrate();
      await sleep(1600);
      if (token !== this.attractToken) return;
    }
  }

  /** Compact layouts show the level list (left) and level info (right) as slide-in sheets. */
  private toggleSheet(which: Sheet, open?: boolean): void {
    const panel = $(which === 'levels' ? 'levels-panel' : 'info-panel');
    const next = open ?? !panel.classList.contains('open');
    this.closeSheets();
    if (!next) return;
    panel.classList.add('open');
    $('scrim').hidden = false;
    if (which === 'info') $('btn-info').setAttribute('aria-expanded', 'true');
    else this.revealCurrentLevel();
  }

  /** The level list has no visible scrollbar, so keep the current level in view (scrolling only the list). */
  private revealCurrentLevel(): void {
    const panel = $('levels-panel');
    const item = panel.querySelector<HTMLElement>('.level-item[aria-current="true"]');
    if (!item) return;
    const p = panel.getBoundingClientRect();
    const r = item.getBoundingClientRect();
    if (r.top < p.top + 40) panel.scrollTop -= p.top + 40 - r.top;
    else if (r.bottom > p.bottom - 8) panel.scrollTop += r.bottom - p.bottom + 8;
  }

  private closeSheets(): void {
    $('levels-panel').classList.remove('open');
    $('info-panel').classList.remove('open');
    $('scrim').hidden = true;
    $('btn-info').setAttribute('aria-expanded', 'false');
  }

  // ---------------------------------------------------------------- level lifecycle

  loadLevel(id: number, opts: { silent?: boolean } = {}): void {
    const level = LEVELS.find((l) => l.id === id);
    if (!level) return;
    this.stopDemo();
    closeModal(false);
    this.closeSheets();
    this.session = new GameSession(level);
    this.assisted = false;
    this.stateToken++;
    updateSave((d) => (d.lastLevel = id));
    this.board.load(level, this.session.state, this.links());
    renderLevelInfo(this.session);
    this.refresh();
    setStatus(this.readyText());
    if (!opts.silent) {
      sfx.click();
      void this.maybeIntro();
    }
  }

  private async maybeIntro(): Promise<void> {
    const key = `intro-${this.session.level.id}`;
    if (this.screen !== 'game' || save().seenTips.includes(key)) return;
    const steps = introFor(this.session.level, this.board);
    if (!steps) return;
    // Let the board lay out at the new size before measuring cells.
    await sleep(60);
    updateSave((d) => d.seenTips.push(key));
    await this.coach.run(steps);
  }

  private eventTip(key: keyof typeof EVENT_TIPS): void {
    const id = `event-${key}`;
    if (save().seenTips.includes(id)) return;
    updateSave((d) => d.seenTips.push(id));
    toast(loc(EVENT_TIPS[key]), { ms: 5200 });
  }

  private links() {
    return activeLinks(this.session.level, this.session.state);
  }

  private refresh(): void {
    renderHud(this.session);
    renderLevelList(this.session.level.id, (id) => this.loadLevel(id));
    this.revealCurrentLevel();
  }

  // ---------------------------------------------------------------- moves

  /** Player-originated direction (keyboard, swipe, D-pad). */
  private input(dir: Dir): void {
    if (this.screen !== 'game' || this.coach.active || modalOpen()) return;
    unlockAudio();
    if (this.demo) {
      this.stopDemo();
      setStatus(t('demoStopped'), 'info');
      return;
    }
    void this.move(dir);
  }

  private async move(dir: Dir): Promise<boolean> {
    if (this.session.won) return false;
    // Finish any running animation first so inputs never overlap.
    this.board.finish();
    const level = this.session.level;
    const r = this.session.move(dir);
    if (!r.ok) {
      this.board.setPlayerFacing(dir);
      this.board.bump(r.reason.entity, r.reason.dir, r.reason.entity !== PLAYER);
      sfx.fail();
      setStatus(failMessage(r.reason), 'fail');
      if (r.reason.remote && r.reason.type === 'wall') this.eventTip('remoteFail');
      return false;
    }
    const token = ++this.stateToken;
    this.refresh();
    if (r.modeBefore === r.modeAfter) flashLinks(r.firedLinks);
    this.reportMove(r.events, r.modeBefore, r.modeAfter);

    const landed = await this.board.animate(r.events, r.phases, r.state, (phase, evs) => this.phaseSound(phase, evs));
    if (token !== this.stateToken) return true;
    this.board.setLinks(activeLinks(level, r.state));
    landed.forEach((_, i) => sfx.goal(i * 0.06));
    if (this.session.won) this.onWin();
    return true;
  }

  private reportMove(events: MoveEvent[], oldMode: Mode | null, newMode: Mode | null): void {
    const n = this.session.steps;
    const lv = this.session.level;
    if (newMode && oldMode !== newMode) {
      if (lv.switchKind === 'plate') setStatus(t('plateSwitched', { mode: modeName(newMode) }), 'info');
      else {
        // Name the switch that moved: compare positions one by one.
        const before = oldMode!.split('|');
        const after = newMode.split('|');
        const i = after.findIndex((p, k) => p !== before[k]);
        setStatus(t('leverSwitched', { id: lv.switches[i].id, mode: modeName(after[i]) }), 'info');
      }
      sfx.lever();
      this.eventTip(this.session.level.switchKind === 'plate' ? 'plate' : 'lever');
    } else if (events.some((e) => e.entity === PLAYER && e.cause === 'push')) {
      setStatus(t('pushedPlayer'), 'info');
      this.eventTip('pushedPlayer');
    } else if (events.length > 2) setStatus(t('chain', { n, m: events.length }), 'good');
    else setStatus(t('moved', { n }));
  }

  private phaseSound(phase: number, events: MoveEvent[]): void {
    const boxes = events.filter((e) => e.entity !== PLAYER && !isSwitch(this.session.level, e.entity));
    if (phase === 0) {
      if (boxes.length) sfx.push();
      else sfx.step();
      return;
    }
    if (events.some((e) => e.cause === 'link')) sfx.link(phase);
    else if (boxes.length) sfx.push();
  }

  private undo(): void {
    if (this.screen !== 'game' || this.coach.active || modalOpen()) return;
    this.stopDemo();
    if (!this.session.undo()) return;
    this.stateToken++;
    this.board.setLinks(this.links());
    this.board.setState(this.session.state);
    this.refresh();
    sfx.undo();
    setStatus(t('moved', { n: this.session.steps }));
  }

  private reset(): void {
    if (this.screen !== 'game' || this.coach.active) return;
    closeModal(false);
    this.stopDemo();
    if (!this.session.canUndo && !this.session.won) return;
    this.session.reset();
    this.assisted = false;
    this.stateToken++;
    this.board.setLinks(this.links());
    this.board.setState(this.session.state);
    this.refresh();
    sfx.undo();
    setStatus(this.readyText());
  }

  // ---------------------------------------------------------------- solver

  private async hint(): Promise<void> {
    if (this.screen !== 'game' || this.coach.active || modalOpen() || !this.cheatOn('hints')) return;
    if (this.session.won) {
      setStatus(t('hintWon'), 'info');
      return;
    }
    this.stopDemo();
    const token = this.stateToken;
    setStatus(t('hintThinking'));
    const res = await this.solver.solve(this.session.level, this.session.state);
    if (token !== this.stateToken) return;
    if (res.status === 'solved') {
      const d = res.path[0];
      this.board.showHint(d);
      // Remaining steps would reveal the optimum, so only show them after a first clear.
      const cleared = !!save().levels[this.session.level.id];
      setStatus(t(cleared ? 'hintNext' : 'hintNextBare', { dir: dirLabel(d), n: res.path.length }), 'info');
    } else setStatus(t(res.status === 'unsolvable' ? 'unsolvable' : 'tooHard'), 'fail');
  }

  private async toggleDemo(): Promise<void> {
    if (!this.demo && !this.cheatOn('solutions')) return;
    if (this.demo) {
      this.stopDemo();
      setStatus(t('demoStopped'), 'info');
      return;
    }
    if (this.screen !== 'game' || this.session.won) return;
    const run = { cancelled: false };
    this.demo = run;
    this.updateDemoButton();
    setStatus(t('hintThinking'));
    const res = await this.solver.solve(this.session.level, this.session.state);
    if (run.cancelled) return;
    if (res.status !== 'solved') {
      this.stopDemo();
      setStatus(t(res.status === 'unsolvable' ? 'unsolvable' : 'tooHard'), 'fail');
      return;
    }
    setStatus(t(isTouch() ? 'demoRunningTouch' : 'demoRunning'), 'info');
    for (const d of res.path) {
      if (run.cancelled) return;
      this.assisted = true;
      const ok = await this.move(d);
      if (!ok || run.cancelled) break;
      await sleep(DEMO_GAP_MS);
    }
    if (this.demo === run) {
      this.demo = null;
      this.updateDemoButton();
    }
  }

  private stopDemo(): void {
    if (!this.demo) return;
    this.demo.cancelled = true;
    this.demo = null;
    this.board.finish();
    this.updateDemoButton();
  }

  private updateDemoButton(): void {
    const btn = $('btn-demo');
    btn.classList.toggle('running', !!this.demo);
    $('demo-label').textContent = t(this.demo ? 'stopDemo' : 'demo');
  }

  // ---------------------------------------------------------------- win

  private onWin(): void {
    const s = this.session;
    const steps = s.steps;
    const stars = starsFor(steps, s.optimal);
    const hadAll = LEVELS.every((l) => save().levels[l.id]);
    const improved = this.assisted ? false : recordClear(s.level.id, steps, s.optimal);
    const allNow = LEVELS.every((l) => save().levels[l.id]);
    this.refresh();
    sfx.win();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.board.celebrate();
    setStatus(`${t('cleared')} · ${t('clearedSteps', { n: steps, m: s.optimal })}`, 'good');

    const levelId = s.level.id;
    const next = LEVELS.find((l) => l.id === levelId + 1);
    const token = this.stateToken;
    window.setTimeout(() => {
      if (token !== this.stateToken || this.screen !== 'game') return;
      const content: Node[] = [
        h('h2', { id: 'modal-title' }, t('clearedTitle')),
        h('div', { class: 'modal-stars' }, ...starsHtml(this.assisted ? 0 : stars).childNodes),
        h('p', {}, t('clearedSteps', { n: steps, m: s.optimal })),
      ];
      if (this.assisted) content.push(h('span', { class: 'badge' }, t('demoClear')));
      else if (steps <= s.optimal) content.push(h('span', { class: 'badge' }, t('perfect')));
      else if (improved) content.push(h('span', { class: 'badge' }, t('newBest')));
      else if (steps <= s.optimal + 2) content.push(h('span', { class: 'badge' }, t('closeOne')));

      const showFinale = !hadAll && allNow;
      const goNext = () => (showFinale ? this.showFinale() : next ? this.loadLevel(next.id) : this.showTitle());
      openModal(
        content,
        [
          { label: t('retry'), onClick: () => this.reset() },
          { label: next || showFinale ? t('next') : t('toTitle'), primary: true, onClick: goNext },
        ],
        // Dismissing the last first-time clear still shows the finale.
        () => showFinale && this.showFinale(),
      );
    }, 700);
  }

  private showFinale(): void {
    openModal(
      [h('h2', { id: 'modal-title' }, t('allDone', { n: LEVELS.length })), h('div', { class: 'modal-stars' }, '★'), h('p', {}, t(totalStars() === LEVELS.length * 3 ? 'allDonePerfect' : 'allDoneBody', { s: totalStars(), total: LEVELS.length * 3 }))],
      [
        { label: t('toTitle'), onClick: () => this.showTitle() },
        { label: t('levelSelect'), primary: true, onClick: () => (isCompact() ? this.toggleSheet('levels', true) : undefined) },
      ],
    );
  }

  // ---------------------------------------------------------------- misc UI

  private showHowTo(): void {
    const zh = getLang() === 'zh';
    const rows: [string, string, string][] = [
      isTouch()
        ? ['@', '在棋盘上往哪边滑，就往哪边走。撞上箱子就是推。', 'Swipe the board in the direction you want to go. Bump into a box to push it.']
        : ['@', '方向键 / WASD 走路，撞上箱子就是推。触屏上直接在棋盘上滑。', 'Arrows / WASD to walk. Bump into a box to push it. On touch screens, just swipe the board.'],
      ['⇄', '箱子之间连着线：一个动，另一个就照着线上的标记跟着动，隔着墙也一样。', 'Boxes are linked: when one moves, its partner follows the link’s rule — walls or not.'],
      ['✕', '连锁里只要有一个走不动，这一步就不算，也不计步数。', 'If anyone in the chain is stuck, the whole step is off and doesn’t count.'],
      ['›', '带箭头的是单向连线，只能顺着箭头带。', 'Arrowed links are one-way: they only drive along the arrow.'],
      ['K', '扳道岔、踩压板都会把整套连线换掉，从下一步开始算。', 'Track switches and plates swap the whole link network, starting from your next move.'],
      ['◎', '所有箱子都进了金色圆圈就过关。步数越少，星越多。', 'Win when every box sits in a gold ring. Fewer steps, more stars.'],
    ];
    openModal(
      [
        h('h2', { id: 'modal-title' }, t('howToPlay')),
        h('ul', { class: 'how-list' }, ...rows.map(([ico, z, e]) => h('li', {}, h('span', { class: 'ico' }, ico), h('span', {}, zh ? z : e)))),
      ],
      [{ label: t('gotIt'), primary: true, onClick: () => undefined }],
    );
  }

  private confirmClear(): void {
    openModal(
      [h('h2', { id: 'modal-title' }, t('resetProgress')), h('p', {}, t('resetConfirm'))],
      [
        { label: t('back'), onClick: () => undefined },
        {
          label: t('resetProgress'),
          primary: true,
          onClick: () => {
            clearProgress();
            this.refresh();
            this.renderTitle();
          },
        },
      ],
    );
  }

  private toggleLang(): void {
    const next = getLang() === 'zh' ? 'en' : 'zh';
    updateSave((d) => (d.lang = next));
    setLang(next);
    sfx.click();
  }

  private toggleSound(): void {
    const on = !save().sound;
    updateSave((d) => (d.sound = on));
    setSoundEnabled(on);
    unlockAudio();
    if (on) sfx.click();
    this.renderSoundButtons();
  }

  private renderSoundButtons(): void {
    const on = save().sound;
    $('btn-sound').textContent = on ? '🔊' : '🔇';
    $('btn-sound').setAttribute('aria-pressed', String(on));
    $('btn-sound').setAttribute('aria-label', t('sound'));
    $('btn-sound-title').textContent = `${on ? '🔊' : '🔇'} ${t('sound')}`;
  }

  private onLangChanged(): void {
    applyI18n();
    $('btn-lang').textContent = t('language');
    $('btn-lang-title').textContent = t('language');
    this.renderSoundButtons();
    this.updateDemoButton();
    renderLevelInfo(this.session);
    this.refresh();
    this.renderTitle();
  }

  private async install(): Promise<void> {
    if (!this.installPrompt) {
      openModal([h('h2', { id: 'modal-title' }, t('installApp')), h('p', {}, t('installIos'))], [{ label: t('gotIt'), primary: true, onClick: () => undefined }]);
      return;
    }
    await this.installPrompt.prompt();
    this.installPrompt = null;
    $('btn-install').hidden = true;
  }
}

