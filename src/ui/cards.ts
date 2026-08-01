/**
 * Drawing cards, rows and the ring.
 *
 * Two rules the rest of the lab depends on:
 *
 *  1. A face-down card is drawn identically whatever is on its face. The backs being
 *     indistinguishable is the protocol's only assumption, so a demo whose backs
 *     leaked the face — by a tooltip, by a class name, by a slightly different tint —
 *     would be teaching the opposite of the lesson. `cardEl` is not even given the
 *     face when it draws a back.
 *  2. The suit is never carried by colour alone. Every card shows its pip glyph and
 *     an off-screen word, so it survives greyscale, deuteranopia and a screen reader
 *     (WCAG 1.4.1).
 *
 * The ring is the one drawing that does real explanatory work: "cyclically adjacent"
 * is invisible in a straight row — position 5 looks nowhere near position 1 — and
 * obvious the moment the row is bent into the circle it always was.
 */

import { type Card, type Sequence } from '../cards/types.js';
import { spadePositions } from '../cards/protocol.js';
import { h, srOnly, svg } from './dom.js';

const PIP: Record<Card, string> = { spade: '♠', heart: '♥' };
const WORD: Record<Card, string> = { spade: 'spade', heart: 'heart' };

export interface CardOpts {
  /** When false the face is not even read — a back is a back. */
  faceUp?: boolean;
  /** Small caption under the card: whose it is, or which position. */
  caption?: string;
  /** Ring the card, for "these are the two spades that decide the answer". */
  marked?: boolean;
  /** One-shot deal/flip animation, tied to a learner action. */
  animate?: 'deal' | 'flip' | null;
}

export function cardEl(card: Card, opts: CardOpts = {}): HTMLElement {
  const faceUp = opts.faceUp !== false;
  const classes = ['card'];
  classes.push(faceUp ? `card-${card}` : 'card-back');
  if (opts.marked) classes.push('card-marked');
  if (opts.animate) classes.push(`card-${opts.animate}`);

  const inner = faceUp
    ? [
        h('span', { class: 'card-pip', 'aria-hidden': 'true' }, PIP[card]),
        srOnly(opts.marked ? `${WORD[card]} (one of the two spades)` : WORD[card]),
      ]
    : [h('span', { class: 'card-back-art', 'aria-hidden': 'true' }), srOnly('face down')];

  return h(
    'div',
    { class: 'card-slot' },
    h('div', { class: classes.join(' ') }, ...inner),
    opts.caption ? h('span', { class: 'card-caption' }, opts.caption) : null,
  );
}

export interface RowOpts {
  /** Per-position face-up flags. Defaults to all face up. */
  faceUp?: readonly boolean[];
  /** Per-position captions. */
  captions?: readonly string[];
  /** Ring the two spades, once the row is revealed. */
  markSpades?: boolean;
  /** Group the row into Alice | dealer | Bob, as it sits on the table. */
  showOwners?: boolean;
  animate?: 'deal' | 'flip' | null;
  /** Overall label for assistive technology. */
  ariaLabel?: string;
}

const OWNER_LABEL = ['Alice', '', 'Dealer', 'Bob', ''];

/** The five cards as they lie on the table, left to right. */
export function rowEl(seq: Sequence, opts: RowOpts = {}): HTMLElement {
  const spades = opts.markSpades ? new Set(spadePositions(seq)) : new Set<number>();
  const cards = seq.map((card, i) =>
    cardEl(card, {
      faceUp: opts.faceUp ? opts.faceUp[i] : true,
      caption: opts.captions?.[i],
      marked: spades.has(i),
      animate: opts.animate,
    }),
  );

  if (!opts.showOwners) {
    return h(
      'div',
      { class: 'card-row', role: 'img', 'aria-label': opts.ariaLabel ?? describeRow(seq, opts) },
      ...cards,
    );
  }

  // Grouped form: the two commitments and the dealer's card, visibly separate, so a
  // learner can see whose secret sits where before the cut jumbles the boundaries.
  //
  // Each label sits inside its own group rather than in a parallel row of headings —
  // a separate row has to be kept aligned by hand, and it drifts off its cards the
  // moment the card size changes for a narrow viewport.
  const group = (owner: string, ...members: HTMLElement[]): HTMLElement =>
    h(
      'div',
      { class: 'card-group' },
      h('span', { class: 'card-owner', 'aria-hidden': 'true' }, owner),
      h('div', { class: 'card-group-cards' }, ...members),
    );

  return h(
    'div',
    {
      class: 'card-row-owned',
      role: 'img',
      'aria-label': opts.ariaLabel ?? describeRow(seq, opts),
    },
    group(OWNER_LABEL[0], cards[0], cards[1]),
    group(OWNER_LABEL[2], cards[2]),
    group(OWNER_LABEL[3], cards[3], cards[4]),
  );
}

/** What a screen reader hears instead of the picture. */
export function describeRow(seq: Sequence, opts: RowOpts = {}): string {
  const parts = seq.map((c, i) => (opts.faceUp && !opts.faceUp[i] ? 'face down' : WORD[c]));
  return `Five cards, left to right: ${parts.join(', ')}.`;
}

export interface RingOpts {
  /** Draw the arc between the two spades and say what it means. */
  showVerdict?: boolean;
  /** Rotate the whole ring by this many positions — the cut, made visible. */
  rotation?: number;
  size?: number;
}

/**
 * The row bent into the ring it always was.
 *
 * Position 0 sits at the top and the rest run clockwise. The dashed chord joins the
 * two spades; whether it is a short hop between neighbours or a long one across the
 * circle *is* the output bit, and it is the one property a rotation cannot touch.
 */
export function ringEl(seq: Sequence, opts: RingOpts = {}): SVGElement {
  const size = opts.size ?? 220;
  const c = size / 2;
  const radius = size * 0.34;
  const rot = ((opts.rotation ?? 0) % 5) * ((2 * Math.PI) / 5);
  const at = (i: number): { x: number; y: number } => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5 + rot;
    return { x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle) };
  };

  const spades = spadePositions(seq);
  const adjacent =
    spades.length === 2 && (spades[1] - spades[0] === 1 || spades[1] - spades[0] === 4);

  const kids: SVGElement[] = [
    svg('circle', { class: 'ring-track', cx: c, cy: c, r: radius, fill: 'none' }),
  ];

  if (opts.showVerdict && spades.length === 2) {
    const p = at(spades[0]);
    const q = at(spades[1]);
    kids.push(
      svg('line', {
        class: `ring-chord ${adjacent ? 'ring-chord-adjacent' : 'ring-chord-separated'}`,
        x1: p.x,
        y1: p.y,
        x2: q.x,
        y2: q.y,
      }),
    );
  }

  seq.forEach((card, i) => {
    const p = at(i);
    const isSpade = card === 'spade';
    kids.push(
      svg(
        'g',
        { class: `ring-card ${isSpade ? 'ring-card-spade' : 'ring-card-heart'}` },
        svg('rect', {
          x: p.x - 13,
          y: p.y - 18,
          width: 26,
          height: 36,
          rx: 4,
          class: 'ring-card-face',
        }),
        svg(
          'text',
          { x: p.x, y: p.y + 6, 'text-anchor': 'middle', class: 'ring-pip' },
          PIP[card],
        ),
      ),
    );
  });

  const verdictText = adjacent
    ? 'the two spades are next to each other around the ring'
    : 'the two spades have a heart between them, both ways round';

  return svg(
    'svg',
    {
      class: 'ring',
      viewBox: `0 0 ${size} ${size}`,
      role: 'img',
      'aria-label': `${describeRow(seq)} Bent into a ring, ${verdictText}.`,
    },
    ...kids,
  );
}

/** The legend the ring needs so its dashed chord is never the only channel. */
export function ringLegend(adjacent: boolean): HTMLElement {
  return h(
    'p',
    { class: 'ring-legend' },
    h('span', { class: `pill pill-${adjacent ? 'ok' : 'neutral'}` }, adjacent ? 'touching' : 'apart'),
    adjacent
      ? ' The two spades are neighbours around the ring — the read-off says 1.'
      : ' A heart sits between the two spades whichever way you go round — the read-off says 0.',
  );
}
