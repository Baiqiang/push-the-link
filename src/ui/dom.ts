import { t, type StringKey } from '../i18n';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') el.className = attrs[k];
    else el.setAttribute(k, attrs[k]);
  }
  el.append(...children);
  return el;
}

export function starsHtml(n: number, total = 3): HTMLElement {
  const wrap = h('span', { class: 'stars', 'aria-label': `${n} / ${total} ★` });
  for (let i = 0; i < total; i++) wrap.append(h('span', i < n ? { class: 'on' } : {}, '★'));
  return wrap;
}

/** Fill every [data-i18n] / [data-i18n-aria] element with the current language. */
export function applyI18n(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as StringKey);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria as StringKey));
  });
}

let toastTimer = 0;
export function toast(text: string, opts: { ms?: number; onClick?: () => void } = {}): void {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  el.classList.toggle('clickable', !!opts.onClick);
  el.onclick = opts.onClick
    ? () => {
        el.hidden = true;
        opts.onClick!();
      }
    : null;
  // Restart the entry animation.
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), opts.ms ?? 2600);
}

export type StatusKind = 'normal' | 'fail' | 'good' | 'info';
export function setStatus(text: string, kind: StatusKind = 'normal'): void {
  const el = $('status');
  el.textContent = text;
  el.className = `status${kind === 'normal' ? '' : ` ${kind}`}`;
}

// ---------------------------------------------------------------- modal

export interface ModalButton {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

let modalClose: (() => void) | null = null;
let lastFocus: HTMLElement | null = null;

export function openModal(content: Node[], buttons: ModalButton[], onDismiss?: () => void): void {
  const modal = $('modal');
  const body = $('modal-body');
  lastFocus = document.activeElement as HTMLElement | null;
  body.replaceChildren(...content);
  const actions = h('div', { class: 'modal-actions' });
  let primary: HTMLButtonElement | null = null;
  for (const b of buttons) {
    const btn = h('button', { class: `btn${b.primary ? ' primary' : ''}` }, b.label);
    btn.addEventListener('click', () => {
      closeModal(false);
      b.onClick();
    });
    if (b.primary) primary = btn;
    actions.append(btn);
  }
  body.append(actions);
  modal.hidden = false;
  modalClose = onDismiss ?? null;
  (primary ?? actions.querySelector('button'))?.focus({ preventScroll: true });
}

export function closeModal(dismissed = true): void {
  const modal = $('modal');
  if (modal.hidden) return;
  modal.hidden = true;
  const cb = modalClose;
  modalClose = null;
  if (dismissed) cb?.();
  lastFocus?.focus?.({ preventScroll: true });
}

export function modalOpen(): boolean {
  return !$('modal').hidden;
}

/** Keyboard inside the modal: Esc dismisses, Tab stays inside. */
export function handleModalKey(e: KeyboardEvent): boolean {
  if (!modalOpen()) return false;
  if (e.key === 'Escape') {
    closeModal(true);
    e.preventDefault();
  } else if (e.key === 'Tab') {
    const btns = [...$('modal').querySelectorAll<HTMLButtonElement>('button')];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const n = btns.length;
    if (n) {
      btns[(i + (e.shiftKey ? n - 1 : 1) + n) % n].focus();
      e.preventDefault();
    }
  }
  return true;
}
