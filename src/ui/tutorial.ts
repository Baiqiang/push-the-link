import type { Level, Localized, Vec } from '../engine';
import type { BoardView } from './board';
import type { CoachStep } from './coach';
import { TOUCH_QUERY } from './controls';

function union(rects: DOMRect[]): DOMRect | null {
  if (!rects.length) return null;
  const l = Math.min(...rects.map((r) => r.left));
  const tp = Math.min(...rects.map((r) => r.top));
  const r = Math.max(...rects.map((r) => r.right));
  const b = Math.max(...rects.map((r) => r.bottom));
  return new DOMRect(l, tp, r - l, b - tp);
}

/** Spotlight helpers bound to a board. */
function at(board: BoardView, ...ids: string[]): () => DOMRect | null {
  return () => union(ids.map((id) => board.entityCell(id)).filter((c): c is Vec => !!c).map((c) => board.cellRect(c)));
}

function cells(board: BoardView, list: Vec[]): () => DOMRect | null {
  return () => union(list.map((c) => board.cellRect(c)));
}

/** Spotlight an element; falls back to `alt` when it's hidden (e.g. inside a closed sheet). */
function el(selector: string, alt?: string): () => DOMRect | null {
  const visible = (sel: string) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r && r.width > 0 && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight ? r : null;
  };
  return () => visible(selector) ?? (alt ? visible(alt) : null);
}

const step = (zh: string, en: string, target: () => DOMRect | null): CoachStep => ({ text: { zh, en } as Localized, target });

function plates(level: Level, board: BoardView): () => DOMRect | null {
  return cells(board, level.data.plates ?? []);
}

/** First-visit walkthrough for each level that introduces something new. */
export function introFor(level: Level, board: BoardView): CoachStep[] | null {
  const touch = window.matchMedia(TOUCH_QUERY).matches;
  switch (level.id) {
    case 1:
      return [
        touch
          ? step('嗨，这个圆圆的就是你。在棋盘上往哪边滑，你就往哪边走。', 'Hi, the round one is you. Swipe the board and you walk that way.', at(board, '@'))
          : step('嗨，这个圆圆的就是你。用方向键或 WASD 走路。', 'Hi, the round one is you. Use the arrow keys or WASD to walk.', at(board, '@')),
        step('走过去撞一下就能推箱子。不过这里的箱子，从来不单独行动……', 'Walk into a box to push it. But boxes here never act alone…', at(board, 'A')),
        step('A 和 B 之间连着一根线。⇄ 是“反着走”：A 往右，B 就往左。墙挡不住连线。', 'A and B are linked. ⇄ means “opposite”: A goes right, B goes left. Walls don’t block links.', at(board, 'A', 'B')),
        step('把箱子都送进金色圆圈就过关，哪个进哪个都行。', 'Get every box into a gold ring to win. Any box, any ring.', cells(board, level.goals)),
        touch
          ? step('推错了别慌：点“撤销”退一步，点“重来”从头开始。', 'Messed up? “Undo” steps back, “Restart” starts over.', el('#actions'))
          : step('推错了别慌：Z 撤销，R 重来。', 'Messed up? Z to undo, R to restart.', el('#actions')),
      ];
    case 2:
      return [step('连线上只要有一个箱子挪不动，这一步就当没走过。先按 → 试试。', 'If any box in the chain can’t move, the whole step never happened. Try → first.', at(board, 'A', 'B'))];
    case 3:
      return [step('↻ 是右转，↺ 是左转。这里 A 往右，B 就往上——小心被它顶开。', '↻ turns right, ↺ turns left: the direction bends 90°. Here A going right sends B up — watch out, it may shove you.', at(board, 'A', 'B'))];
    case 4:
      return [step('被连线带着走的箱子撞上谁，就会推谁，还会顺带触发对方的连线。', 'A box dragged by a link pushes whatever it hits — and lights up that box’s link too.', at(board, 'A', 'B', 'C', 'D'))];
    case 7:
      return [step('新连线：上下镜像（标签里是一条横着的镜面）。上下反着走，左右还是一起走。', 'New link: an up-down mirror (its label shows a horizontal mirror line). Vertical moves flip, horizontal moves stay in sync.', at(board, 'A', 'B'))];
    case 10:
      return [step('带箭头的连线只管一头：推 A 会带上 B，推 B 就只有 B 动。', 'A link with an arrow is one-way: pushing A drags B along, pushing B moves only B.', at(board, 'A', 'B'))];
    case 13:
      return [
        step('紫色的 K 是道岔，只能在导轨的两格之间推。扳到左边和扳到右边，各是一套连线。', 'Purple K is a track switch that slides along a two-cell rail. Left and right are two different link setups.', at(board, 'K')),
        step('连线面板会显示现在怎么连，扳过去之后又会怎么连。屏幕小的时候，点右上角的 i 打开它。', 'The links panel shows the current links and what you’d get after switching. On small screens, tap the i at the top right.', el('#network-card', '#btn-info')),
      ];
    case 14:
      return [step('这回道岔不改方向，改的是谁跟谁一组。', 'This time the switch doesn’t change directions — it changes who’s paired with whom.', at(board, 'K'))];
    case 16:
      return [
        step('这关有两个道岔：紫色的 K 和粉色的 J，各有各的导轨。', 'Two track switches here: purple K and pink J, each on its own rail.', at(board, 'K', 'J')),
        step('它们各管一根线：K 管 A—B，J 管 A—C。连线面板里能分别看到扳一下 K 或 J 会怎样。', 'Each runs one link: K for A—B, J for A—C. The links panel shows what throwing K or J would do.', el('#network-card', '#btn-info')),
      ];
    case 20:
      return [step('这回两个道岔要一起看：它们的位置组合成四种，每种都是一整套不同的连线。', 'Now read both switches together: their positions make four combinations, each a whole different set of links.', at(board, 'K', 'J'))];
    case 17:
      return [step('这根单向连线归道岔管：在左边时 A 带 B，扳到右边箭头调头，变成 B 带 A。', 'This one-way link belongs to the switch: on the left A drags B; on the right the arrow flips and B drags A.', at(board, 'K', 'A', 'B'))];
    case 21:
      return [
        step('看到连着你的那根线了吗？A 是你的影子，你每走一步，它都会跟着动。', 'See the line attached to you? A is your shadow: every step you take, it moves too.', at(board, '@', 'A')),
        step('C 是没连线的木箱，只能靠推。你够不着它，你的影子够得着。', 'C is a plain, unlinked crate — it only moves when pushed. You can’t reach it, but your shadow can.', at(board, 'C')),
      ];
    case 22:
      return [step('这个影子跟你在同一个屋里，而且总往你右手边拐。', 'This shadow shares your room and always veers to your right.', at(board, '@', 'A'))];
    case 23:
      return [step('现在由道岔决定谁当你的影子。', 'Now the switch decides who gets to be your shadow.', at(board, 'K', 'A', 'B'))];
    case 27:
      return [
        step('青色方块是压板。每一步开始时，只要上面压着东西，就会换一套连线。', 'The teal tile is a pressure plate. If something is on it when a move starts, the links switch.', plates(level, board)),
        step('所以站在压板上推，和离开压板再推，是两码事。', 'So pushing while standing on the plate is not the same as pushing after stepping off.', at(board, 'A', 'B')),
      ];
    case 29:
      return [step('木箱 C 也能压住压板。让它替你站一会儿，你就能去忙别的了。', 'Crate C can hold the plate down too. Let it stand in for you while you get busy elsewhere.', at(board, 'C'))];
    default:
      return null;
  }
}

/** One-off contextual tips triggered by gameplay events. */
export const EVENT_TIPS = {
  remoteFail: {
    zh: '那边堵住了，这步就不算。先给那边的箱子腾个地方吧。',
    en: 'Blocked over there, so the step doesn’t count. Make some room on that side first.',
  },
  pushedPlayer: {
    zh: '被箱子顶了一下？别急，说不定这一下正好用得上。',
    en: 'Got shoved by a box? Don’t be mad — that shove might be part of the solution.',
  },
  lever: {
    zh: '道岔扳过去了！这一步还是按原来的连线算，下一步才换新的。',
    en: 'Switch thrown! This move still used the old links — the new ones start next move.',
  },
  plate: {
    zh: '压板动了！下一步起换一套连线。',
    en: 'The plate moved! The links switch from your next move.',
  },
} satisfies Record<string, Localized>;
