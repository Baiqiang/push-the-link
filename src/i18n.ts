import type { Dir, FailReason, Localized, Transform } from './engine';

export type Lang = 'zh' | 'en';

const STRINGS = {
  appTitle: { zh: 'Push the Link', en: 'Push the Link' },
  subtitle: { zh: '推一个，动一串。箱子们早就串通好了。', en: 'Push one, move a bunch. These boxes are in cahoots.' },
  start: { zh: '开始', en: 'Let’s push!' },
  continue: { zh: '继续 · 第 {n} 关', en: 'Keep going · Level {n}' },
  levelSelect: { zh: '选关', en: 'Pick a level' },
  howToPlay: { zh: '怎么玩', en: 'How to play' },
  back: { zh: '算了', en: 'Never mind' },
  levels: { zh: '关卡', en: 'Levels' },
  level: { zh: '第 {n} 关', en: 'Level {n}' },
  chapter: { zh: '第 {n} 章', en: 'Chapter {n}' },
  steps: { zh: '步数', en: 'Steps' },
  optimal: { zh: '最优', en: 'Par' },
  best: { zh: '纪录', en: 'Your best' },
  undo: { zh: '撤销', en: 'Undo' },
  reset: { zh: '重来', en: 'Restart' },
  hint: { zh: '提示', en: 'Hint' },
  demo: { zh: '看答案', en: 'Show me' },
  stopDemo: { zh: '停，我来', en: 'I got this' },
  sound: { zh: '音效', en: 'Sound' },
  language: { zh: 'EN', en: '中文' },
  network: { zh: '谁跟谁连着', en: 'Who’s linked' },
  noLinks: { zh: '（这会儿谁也没连着）', en: '(nobody’s talking)' },
  leverLeft: { zh: '左', en: 'left' },
  leverRight: { zh: '右', en: 'right' },
  plateOff: { zh: '压板松开', en: 'plate up' },
  plateOn: { zh: '压板踩下', en: 'plate down' },
  leverHint: { zh: '扳完要从下一步才算数', en: 'Throwing a switch kicks in from your next move' },
  plateHint: { zh: '每步开始时，压板上有人或有箱子，就算踩下', en: 'If anything is on a plate when a move starts, it counts as pressed' },
  otherMode: { zh: '要是换过去', en: 'If you switch' },
  levelNote: { zh: '这一关', en: 'This level' },
  legend: { zh: '符号说明', en: 'Link cheat sheet' },
  legendSame: { zh: '一起走', en: 'same way' },
  legendReverse: { zh: '反着走', en: 'opposite' },
  legendCw: { zh: '右转 90°', en: 'turn right' },
  legendCcw: { zh: '左转 90°', en: 'turn left' },
  legendH: { zh: '左右镜像', en: 'mirror ←→' },
  legendV: { zh: '上下镜像', en: 'mirror ↑↓' },
  legendOneWay: { zh: '单向：只能顺着箭头带', en: 'one-way: only along the arrow' },
  legendShadow: { zh: '@ 就是你，连着它的是你的影子', en: '@ is you — whatever it links to is your shadow' },
  ready: { zh: '方向键或 WASD 移动 · Z 撤销 · R 重来', en: 'Arrows / WASD to move · Z undo · R restart' },
  readyHint: { zh: ' · H 提示', en: ' · H hint' },
  readyTouch: { zh: '在棋盘上往哪边滑，就往哪边走', en: 'Swipe the board in the direction you want to go' },
  moved: { zh: '第 {n} 步', en: 'Step {n}' },
  chain: { zh: '第 {n} 步 · 一口气动了 {m} 下', en: 'Step {n} · {m} things moved at once' },
  pushedPlayer: { zh: '哎哟，被箱子顶了一下（还是只算一步）', en: 'Oof, a box shoved you (still one step)' },
  leverSwitched: { zh: '道岔 {id} 扳到{mode}边了，下一步起按新连线走', en: 'Switch {id} is now {mode} — new links from your next move' },
  ifFlipped: { zh: '要是扳一下 {id}', en: 'If you throw {id}' },
  plateSwitched: { zh: '{mode}了，下一步起换一套连线', en: '{mode}! The links change from your next move' },
  hintNext: { zh: '悄悄告诉你：下一步按 {dir}（还差 {n} 步）', en: 'Psst: try {dir} next ({n} to go)' },
  hintNextBare: { zh: '悄悄告诉你：下一步按 {dir}', en: 'Psst: try {dir} next' },
  hintThinking: { zh: '让我想想…', en: 'Thinking…' },
  hintWon: { zh: '已经过关啦', en: 'You already won' },
  unsolvable: { zh: '这局已经救不回来了，撤销几步或者重来吧', en: 'No way out from here — undo a few or restart' },
  tooHard: { zh: '这局面太复杂了，撤销几步再来问我', en: 'That’s a lot to think about — undo a bit and ask again' },
  demoRunning: { zh: '看好了！（按任意方向键打断）', en: 'Watch this! (any arrow key to stop)' },
  demoRunningTouch: { zh: '看好了！（在棋盘上滑一下就能打断）', en: 'Watch this! (swipe the board to stop)' },
  demoStopped: { zh: '好，交给你了', en: 'Okay, your turn' },
  cleared: { zh: '过关', en: 'Nailed it' },
  clearedTitle: { zh: '搞定！', en: 'Nailed it!' },
  clearedSteps: { zh: '用了 {n} 步 · 最优 {m} 步', en: '{n} steps · par {m}' },
  newBest: { zh: '刷新纪录', en: 'New best' },
  perfect: { zh: '一步没多走，完美', en: 'Not a step wasted' },
  closeOne: { zh: '离最优就差几步，再来一次？', en: 'So close to perfect — again?' },
  demoClear: { zh: '看答案过的关不算成绩哦', en: 'Watched runs don’t count' },
  retry: { zh: '再来一次', en: 'Again' },
  next: { zh: '下一关', en: 'Next' },
  allDone: { zh: '{n} 关，全部通关', en: 'All {n} levels, done' },
  allDoneBody: {
    zh: '一共拿到 {s} / {total} 颗星。还有没拿满三星的？回去再推得漂亮点。',
    en: 'You collected {s} / {total} stars. Any level short of three? Go back and push it prettier.',
  },
  allDonePerfect: {
    zh: '{total} 颗星全拿到了，每一关都是最优解。厉害！',
    en: 'All {total} stars, every level at par. Impressive.',
  },
  toTitle: { zh: '回到标题', en: 'Title screen' },
  cheatHints: {
    zh: '30 条命到手！提示已解锁，开着关着都行，标题页可以切换。',
    en: '30 lives! Hints unlocked — switch them on or off on the title screen.',
  },
  cheatSolutions: {
    zh: '反着念也灵！“看答案”已解锁，同样能在标题页关掉。',
    en: 'It works backwards too! “Show me” is unlocked; you can switch it off on the title screen.',
  },
  cheatAgain: { zh: '这个秘籍已经生效了', en: 'That code is already active' },
  cheatNeedBasic: { zh: '先把正着的那个秘籍输对吧', en: 'Get the forwards code first' },
  cheatHintsToggle: { zh: '提示', en: 'Hints' },
  cheatSolutionsToggle: { zh: '看答案', en: 'Show me' },
  on: { zh: '开', en: 'on' },
  off: { zh: '关', en: 'off' },
  installApp: { zh: '装到桌面', en: 'Install app' },
  installIos: {
    zh: '在 Safari 里点底部的“分享”按钮，再选“添加到主屏幕”。装好以后可以全屏玩，没网也能玩。',
    en: 'In Safari, tap the Share button, then “Add to Home Screen”. It runs full screen and works offline.',
  },
  links: { zh: '连线', en: 'Links' },
  updateReady: { zh: '有新版本，点这里刷新', en: 'New version ready — tap to reload' },
  offlineReady: { zh: '离线也能玩了', en: 'Ready to play offline' },
  gotIt: { zh: '明白！', en: 'Got it!' },
  nextTip: { zh: '接着看', en: 'And?' },
  skip: { zh: '跳过', en: 'Skip' },
  resetProgress: { zh: '清空存档', en: 'Wipe progress' },
  resetConfirm: { zh: '所有星星和纪录都会清空，确定吗？', en: 'Every star and record will vanish. Sure?' },
  dirU: { zh: '↑', en: '↑' },
  dirR: { zh: '→', en: '→' },
  dirD: { zh: '↓', en: '↓' },
  dirL: { zh: '←', en: '←' },
  player: { zh: '你', en: 'you' },
  // Failure reasons
  failWallRemote: { zh: '那边的 {e} 撞墙了，这步不算', en: '{e} over there hit a wall — move cancelled' },
  failWallLocal: { zh: '{e} 顶到墙了', en: '{e} is against a wall' },
  failWallPlayer: { zh: '这是墙，不是门', en: 'That’s a wall, not a door' },
  failWallPlayerRemote: { zh: '连线要把你拽进墙里，这步不算', en: 'A link tried to drag you into a wall — move cancelled' },
  failRail: { zh: '道岔 {e} 只能在导轨的两格之间来回', en: 'Switch {e} only slides along its two-cell rail' },
  failConflict: { zh: '{e} 被两边往不同方向拽，这步不算', en: '{e} is pulled two ways at once — move cancelled' },
  failBlocked: { zh: '{e} 被卡住了，这步不算', en: '{e} is stuck — move cancelled' },
  failCycle: { zh: '箱子互相推成了一个圈，谁也动不了', en: 'The push loops back on itself — no go' },
} satisfies Record<string, Localized>;

export type StringKey = keyof typeof STRINGS;

let lang: Lang = 'zh';
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang): void {
  lang = l;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  listeners.forEach((fn) => fn());
}

export function onLangChange(fn: () => void): void {
  listeners.add(fn);
}

export function detectLang(): Lang {
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  let s: string = STRINGS[key][lang];
  for (const k in vars) s = s.replaceAll(`{${k}}`, String(vars[k]));
  return s;
}

export function loc(text: Localized): string {
  return text[lang];
}

export function dirLabel(d: Dir): string {
  return t(`dir${d}` as StringKey);
}

function entityName(id: string): string {
  return id === '@' ? t('player') : id;
}

export function failMessage(r: FailReason): string {
  const e = entityName(r.entity);
  switch (r.type) {
    case 'wall':
      if (r.entity === '@') return t(r.remote ? 'failWallPlayerRemote' : 'failWallPlayer');
      return t(r.remote ? 'failWallRemote' : 'failWallLocal', { e });
    case 'rail':
      return t('failRail', { e });
    case 'conflict':
      return t('failConflict', { e });
    case 'blocked':
      return t('failBlocked', { e });
    case 'cycle':
      return t('failCycle');
  }
}

const GLYPHS: Record<string, string> = { 0: '↔', 1: '↻', 2: '⇄', 3: '↺', H: '⇋', V: '⇵' };
const LEGEND: Record<string, StringKey> = { 0: 'legendSame', 1: 'legendCw', 2: 'legendReverse', 3: 'legendCcw', H: 'legendH', V: 'legendV' };

/** Short glyph for a link's transform; one-way links get a trailing arrow. */
export function linkGlyph(t: Transform, oneWay = false): string {
  return GLYPHS[String(t)] + (oneWay ? '›' : '');
}

export function linkLegend(tr: Transform): string {
  return t(LEGEND[String(tr)]);
}

export { entityName };
