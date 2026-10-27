import type { Localized } from '../engine';
import { loc, t } from '../i18n';

export interface CoachStep {
  text: Localized;
  /** What to spotlight; null centres the bubble with no hole. */
  target: () => DOMRect | null;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Spotlight walkthrough. Resolves when the player finishes or skips. */
export class Coach {
  private root = $('coach');
  private hole = $('coach-hole');
  private bubble = $('coach-bubble');
  private text = $('coach-text');
  private count = $('coach-count');
  private nextBtn = $<HTMLButtonElement>('coach-next');
  private skipBtn = $<HTMLButtonElement>('coach-skip');
  private steps: CoachStep[] = [];
  private index = 0;
  private done: (() => void) | null = null;

  constructor() {
    this.nextBtn.addEventListener('click', () => this.next());
    this.skipBtn.addEventListener('click', () => this.close());
    window.addEventListener('resize', () => this.active && this.render());
  }

  get active(): boolean {
    return this.done !== null;
  }

  run(steps: CoachStep[]): Promise<void> {
    this.close();
    this.steps = steps;
    this.index = 0;
    this.root.hidden = false;
    return new Promise((resolve) => {
      this.done = resolve;
      // Wait a frame so the board has laid out before measuring.
      requestAnimationFrame(() => this.render());
    });
  }

  /** Keyboard handling while active; returns true if the key was consumed. */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.active) return false;
    if (e.key === 'Escape') this.close();
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') this.next();
    return true;
  }

  private next(): void {
    if (this.index < this.steps.length - 1) {
      this.index++;
      this.render();
    } else this.close();
  }

  close(): void {
    if (!this.done) return;
    this.root.hidden = true;
    const d = this.done;
    this.done = null;
    d();
  }

  private render(): void {
    const step = this.steps[this.index];
    const last = this.index === this.steps.length - 1;
    this.text.textContent = loc(step.text);
    this.count.textContent = this.steps.length > 1 ? `${this.index + 1} / ${this.steps.length}` : '';
    this.nextBtn.textContent = last ? t('gotIt') : t('nextTip');
    this.skipBtn.hidden = last;
    this.skipBtn.textContent = t('skip');

    const rect = step.target();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = this.bubble.offsetWidth || 320;
    const bh = this.bubble.offsetHeight || 120;
    if (!rect) {
      this.hole.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0;border-width:0`;
      this.bubble.style.left = `${(vw - bw) / 2}px`;
      this.bubble.style.top = `${(vh - bh) / 2}px`;
    } else {
      const pad = 8;
      this.hole.style.cssText = `left:${rect.left - pad}px;top:${rect.top - pad}px;width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px`;
      const below = rect.bottom + pad + 12;
      const top = below + bh < vh - 8 ? below : Math.max(8, rect.top - pad - 12 - bh);
      const left = Math.min(Math.max(16, rect.left + rect.width / 2 - bw / 2), vw - bw - 16);
      this.bubble.style.left = `${left}px`;
      this.bubble.style.top = `${top}px`;
    }
    this.nextBtn.focus({ preventScroll: true });
  }
}
