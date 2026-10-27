import { activeLinks, applyTransform, currentMode, flipSwitch, LEVELS, linksForMode, otherMode, switchPositions, type GameSession, type Link, type Mode } from '../engine';
import { dirLabel, entityName, linkGlyph, linkLegend, loc, t } from '../i18n';
import { save, totalStars } from '../save';
import { $, h, starsHtml } from './dom';
import { isMirror, mirrorSvg } from './icons';

/** Chapters: first level id and a name. */
export const CHAPTERS = [
  { first: 1, name: { zh: '牵个手', en: 'Holding hands' } },
  { first: 7, name: { zh: '照镜子', en: 'Mirror, mirror' } },
  { first: 13, name: { zh: '扳道岔', en: 'Throw the switch' } },
  { first: 21, name: { zh: '如影随形', en: 'Your shadow' } },
  { first: 27, name: { zh: '踩一踩', en: 'Hold it down' } },
];

export function renderLevelList(currentId: number, onPick: (id: number) => void): void {
  const list = $('level-list');
  const s = save();
  const items: HTMLElement[] = [];
  LEVELS.forEach((lv) => {
    const ch = CHAPTERS.find((c) => c.first === lv.id);
    if (ch) items.push(h('li', { class: 'chapter' }, h('span', {}, t('chapter', { n: CHAPTERS.indexOf(ch) + 1 })), ' ', loc(ch.name)));
    items.push(levelItem(lv.id));
  });
  list.replaceChildren(...items);
  function levelItem(id: number): HTMLElement {
    const lv = LEVELS.find((l) => l.id === id)!;
    {
      const rec = s.levels[lv.id];
      const btn = h(
        'button',
        { class: `level-item${rec ? ' done' : ''}`, 'aria-current': String(lv.id === currentId) },
        h('span', { class: 'num' }, String(lv.id)),
        h('span', { class: 'meta' }, h('span', { class: 'name' }, loc(lv.data.title)), h('span', { class: 'tag' }, loc(lv.data.tag))),
        starsHtml(rec?.stars ?? 0),
      );
      btn.addEventListener('click', () => onPick(lv.id));
      return h('li', {}, btn);
    }
  }
  $('star-total').textContent = `★ ${totalStars()} / ${LEVELS.length * 3}`;
}

/** A single position: 左/右 for a track switch, 压板踩下/松开 for plates. */
export function modeName(m: Mode): string {
  const key = ({ LEFT: 'leverLeft', RIGHT: 'leverRight', OFF: 'plateOff', ON: 'plateOn' } as const)[m as 'LEFT'];
  return key ? t(key) : m;
}

/** Badge text: 'K · 左' per track switch (joined), or the plate state. */
function modeLabel(session: GameSession): string {
  const lv = session.level;
  if (lv.switchKind !== 'lever') return modeName(currentMode(lv, session.state)!);
  return Object.entries(switchPositions(lv, session.state))
    .map(([id, p]) => `${id} · ${modeName(p)}`)
    .join('  ');
}

function chip(id: string): HTMLElement {
  return h('span', { class: `chip chip-${id === '@' ? 'P' : id}` }, id === '@' ? '@' : id);
}

function linkRow([a, b, tr, oneWay]: Link, index: number): HTMLElement {
  // Example uses → unless the transform would leave it unchanged (vertical mirror), then ↑.
  const probe = tr === 'V' ? 'U' : 'R';
  const ex = `${entityName(a)}${dirLabel(probe)} ${entityName(b)}${dirLabel(applyTransform(probe, tr))}`;
  return h(
    'li',
    { 'data-link': String(index) },
    chip(a),
    h('span', { class: 'glyph', 'aria-hidden': 'true' }, ...(isMirror(tr) ? [mirrorSvg(tr, 14), oneWay ? '›' : ''] : [linkGlyph(tr, !!oneWay)])),
    chip(b),
    h('span', { class: 'net-desc' }, `${linkLegend(tr)}${oneWay ? ` · ${t('legendOneWay').split(/[:：]/)[0]}` : ''} · ${ex}`),
  );
}

function fillLinks(ul: HTMLElement, links: Link[]): void {
  ul.replaceChildren(...(links.length ? links.map(linkRow) : [h('li', { class: 'empty' }, t('noLinks'))]));
}

export function renderHud(session: GameSession): void {
  const lv = session.level;
  const rec = save().levels[lv.id];
  $('lvl-num').textContent = t('level', { n: lv.id });
  $('lvl-name').textContent = loc(lv.data.title);
  $('hud-steps').textContent = String(session.steps);
  // The optimum is a spoiler: only show it once the level has been cleared.
  $('hud-optimal-stat').hidden = !rec && !session.won;
  $('hud-optimal').textContent = String(session.optimal);
  $('hud-best').textContent = rec ? String(rec.best) : '–';
  $<HTMLButtonElement>('btn-undo').disabled = !session.canUndo;
  $<HTMLButtonElement>('btn-reset').disabled = !session.canUndo;
  $<HTMLButtonElement>('btn-hint').disabled = session.won;
  // Hint and "show me" stay hidden until unlocked with a cheat code (and switched on).
  const c = save().cheats;
  $('btn-hint').hidden = !(c.hints.unlocked && c.hints.on);
  $('btn-demo').hidden = !(c.solutions.unlocked && c.solutions.on);

  const mode = currentMode(lv, session.state);
  for (const id of ['hud-mode', 'net-mode']) {
    const badge = $(id);
    badge.hidden = !mode;
    if (mode) {
      const text = modeLabel(session);
      if (badge.textContent !== text && badge.textContent) {
        badge.classList.remove('flash');
        void badge.offsetWidth;
        badge.classList.add('flash');
      }
      badge.textContent = text;
    }
  }

  fillLinks($('net-active'), activeLinks(lv, session.state));
  const otherWrap = $('net-other-wrap');
  otherWrap.hidden = !mode;
  if (mode) {
    // One "what if" list per track switch (or one for the plates).
    const options: Array<[string, Mode]> =
      lv.switchKind === 'lever'
        ? lv.switches.map((sw) => [lv.switches.length > 1 ? t('ifFlipped', { id: sw.id }) : `${t('otherMode')} · ${sw.id} · ${modeName(otherMode(switchPositions(lv, session.state)[sw.id]))}`, flipSwitch(lv, mode, sw.id)])
        : [[`${t('otherMode')} · ${modeName(otherMode(mode))}`, otherMode(mode)]];
    $('net-other').replaceChildren(
      ...options.flatMap(([title, m]) => {
        const ul = h('ul', { class: 'net-list dim' });
        fillLinks(ul, linksForMode(lv, m));
        return [h('h4', {}, title), ul];
      }),
    );
    $('net-switch-hint').textContent = t(lv.switchKind === 'plate' ? 'plateHint' : 'leverHint');
  }
}

export function renderLevelInfo(session: GameSession): void {
  const d = session.level.data;
  $('lvl-note').textContent = loc(d.note);
  $('lvl-tip').textContent = `💡 ${loc(d.tip)}`;
  document.documentElement.style.setProperty('--board-aspect', `${session.level.width} / ${session.level.height}`);
}

/** Briefly highlight network rows that fired this move. */
export function flashLinks(indices: number[]): void {
  const rows = $('net-active').querySelectorAll<HTMLElement>('[data-link]');
  rows.forEach((r) => {
    if (indices.includes(Number(r.dataset.link))) {
      r.classList.add('fired');
      window.setTimeout(() => r.classList.remove('fired'), 650);
    }
  });
}
