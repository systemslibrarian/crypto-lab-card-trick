/**
 * Exhibit 1 — the protocol itself, stepped.
 *
 * The one mechanism this lab exists to show is that a *cut* can hide which of three
 * arrangements you started from while leaving a fourth one recognisable. So the
 * stepper never asserts an outcome: it deals the cards, lets the learner choose the
 * cut by hand, turns them over, and reads the answer off the picture. The "try all
 * five cuts" block then does the same thing five times at once, which is the moment
 * the invariance stops being a claim.
 */

import { ALL_SHIFTS, type Bit, type Inputs, type Shift } from '../cards/types.js';
import { andGate, commit, layout, run, toKey } from '../cards/protocol.js';
import { uniformShift } from '../cards/shuffle.js';
import { ringEl, ringLegend, rowEl } from './cards.js';
import {
  TERMS,
  bridge,
  clear,
  code,
  disclosure,
  glossary,
  h,
  learnerCheck,
  note,
  panelIntro,
  prediction,
  predictionDebrief,
  scrollIntoCentre,
  srOnly,
  termAside,
  verdict,
} from './dom.js';

interface State {
  inputs: Inputs;
  shift: Shift;
  /** How the current cut was chosen — the honesty note depends on it. */
  cutSource: 'manual' | 'random';
  /** Steps revealed so far, 1..STEP_COUNT. */
  shown: number;
  /** Play it like a real game: the page stops printing the cut depth. */
  hideCut: boolean;
}

const STEP_COUNT = 6;

const state: State = {
  inputs: { a: 1, b: 1 },
  shift: 2,
  cutSource: 'manual',
  shown: 1,
  hideCut: false,
};

export function renderProtocolPanel(root: HTMLElement): void {
  const stepHost = h('div', { class: 'steps' });
  const allCutsHost = h('div', { class: 'all-cuts-host' });

  const repaint = (): void => {
    paintSteps(stepHost);
    paintAllCuts(allCutsHost);
  };

  root.replaceChildren(
    panelIntro(
      'Two people, one AND gate, five cards',
      'Alice knows one secret bit. Bob knows another. They want to know whether BOTH bits are 1 — and nothing else. No computers, no keys, no maths problem anybody hopes is hard: five playing cards, laid out in a particular order, cut once, and turned over.',
      'Set the two bits below, choose how far to cut, and step through it. Then change the cut and watch the answer refuse to move.',
    ),
    glossary(Object.values(TERMS)),
    controls(repaint),
    stepHost,
    allCutsHost,
    learnerCheck(
      'The row is turned over and you see ♠ ♥ ♥ ♠ ♥. What do you now know about Alice’s bit?',
      [
        { label: 'It was 0', correct: false },
        { label: 'It was 1', correct: false },
        { label: 'Nothing — 0 and 1 are still equally likely', correct: true },
      ],
      'The two spades have hearts between them, so the answer is 0 — and all three input pairs that produce 0 can produce exactly this row, each just as often. Both of Alice’s bits remain exactly as likely as before you looked. The next exhibit shows that as a table you can check cell by cell.',
    ),
    bridge(
      'The read-off gives the right answer for every one of the five cuts, and a different-looking row each time.',
      'The row changes but the answer does not — so what exactly is the cut moving, and what is it unable to touch?',
      {
        label: 'See why the cut cannot change the answer →',
        onClick: () => document.getElementById('tab-why')?.click(),
      },
    ),
  );

  repaint();
}

// ------------------------------------------------------------------ controls

function bitControl(
  who: 'Alice' | 'Bob',
  get: () => Bit,
  set: (b: Bit) => void,
  repaint: () => void,
): HTMLElement {
  const label = `${who}’s secret bit`;
  const buttons = ([0, 1] as const).map((v) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn seg-btn',
        'aria-pressed': String(get() === v),
        onclick: () => {
          set(v);
          for (const b of buttons) {
            b.setAttribute('aria-pressed', String(Number(b.textContent) === get()));
          }
          repaint();
        },
      },
      String(v),
    ),
  );
  return h(
    'div',
    { class: 'control' },
    h('span', { class: 'control-label', id: `bit-${who.toLowerCase()}-label` }, label),
    h(
      'div',
      { class: 'seg', role: 'group', 'aria-labelledby': `bit-${who.toLowerCase()}-label` },
      ...buttons,
    ),
    h(
      'p',
      { class: 'help' },
      `${who} is the only person who knows this. It never leaves ${who === 'Alice' ? 'her' : 'his'} two face-down cards.`,
    ),
  );
}

function controls(repaint: () => void): HTMLElement {
  const cutButtons: HTMLButtonElement[] = [];
  const paintCut = (): void => {
    for (const b of cutButtons) {
      const depth = b.dataset.depth;
      const on = depth === 'random' ? state.cutSource === 'random' : Number(depth) === state.shift;
      b.setAttribute('aria-pressed', String(on));
    }
  };

  for (const s of ALL_SHIFTS) {
    cutButtons.push(
      h(
        'button',
        {
          type: 'button',
          class: 'btn seg-btn',
          'data-depth': String(s),
          'aria-pressed': String(state.shift === s),
          onclick: () => {
            state.shift = s;
            state.cutSource = 'manual';
            paintCut();
            repaint();
          },
        },
        String(s),
      ) as HTMLButtonElement,
    );
  }
  const randomBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-primary',
      'data-depth': 'random',
      onclick: () => {
        state.shift = uniformShift();
        state.cutSource = 'random';
        paintCut();
        repaint();
      },
    },
    'Cut at random',
  ) as HTMLButtonElement;
  cutButtons.push(randomBtn);

  const hide = h('input', { type: 'checkbox', id: 'hide-cut' }) as HTMLInputElement;
  hide.checked = state.hideCut;
  hide.addEventListener('change', () => {
    state.hideCut = hide.checked;
    repaint();
  });

  return h(
    'div',
    { class: 'controls' },
    h(
      'div',
      { class: 'control-grid' },
      bitControl(
        'Alice',
        () => state.inputs.a,
        (v) => {
          state.inputs = { ...state.inputs, a: v };
        },
        repaint,
      ),
      bitControl(
        'Bob',
        () => state.inputs.b,
        (v) => {
          state.inputs = { ...state.inputs, b: v };
        },
        repaint,
      ),
    ),
    h(
      'div',
      { class: 'control' },
      h('span', { class: 'control-label', id: 'cut-label' }, 'How far to cut the deck'),
      h('div', { class: 'seg-wrap', role: 'group', 'aria-labelledby': 'cut-label' }, ...cutButtons),
      h(
        'p',
        { class: 'help' },
        'Lift this many cards off the left end and put them on the right. In a real game nobody chooses — and nobody knows.',
      ),
    ),
    h(
      'div',
      { class: 'control control-inline-row' },
      hide,
      h('label', { for: 'hide-cut' }, 'Play it honestly — don’t show me the cut depth'),
    ),
    note(
      'caveat',
      'The cut is simulated. A browser cannot shuffle a physical deck, so “Cut at random” draws from your platform’s cryptographic random source, and — unlike a real dealer — this page knows the answer it drew. That is a limitation of the demo, not of the protocol; the box above hides the number if you would rather play it straight.',
    ),
  );
}

// --------------------------------------------------------------------- steps

interface StepSpec {
  title: string;
  lead: string;
  body: () => (HTMLElement | null)[];
  term?: keyof typeof TERMS;
}

function steps(): StepSpec[] {
  const { inputs } = state;
  const r = run(inputs, state.shift);
  const aliceCards = commit(inputs.a);
  const bobCards = commit(inputs.b === 1 ? 0 : 1);

  return [
    {
      title: 'The deck: three hearts and two spades',
      lead: 'Five cards, and a rule for what a pair of them means. Everything else is placement.',
      term: 'commitment',
      body: () => [
        h(
          'div',
          { class: 'encoding' },
          encodingCard(1),
          encodingCard(0),
        ),
        h(
          'p',
          { class: 'help' },
          'Both encodings use one spade and one heart — the same two cards. Only the order differs, and once they are face down the order is exactly what nobody can see.',
        ),
      ],
    },
    {
      title: `Alice commits to her bit (a = ${inputs.a})`,
      lead: 'She lays her two cards face down. Bob sees two identical backs, which is all he will ever see of them.',
      body: () => [
        rowEl([aliceCards[0], aliceCards[1], 'heart', 'heart', 'heart'], {
          faceUp: [false, false, false, false, false],
          captions: ['Alice', 'Alice', '', '', ''],
          ariaLabel: 'Alice has placed two face-down cards; three positions are still empty.',
        }),
        h(
          'p',
          { class: 'step-note' },
          'From Bob’s side of the table this is the same picture whichever bit she chose. ',
          state.hideCut ? null : peek(`Alice played ${toPair(aliceCards)} — the encoding of ${inputs.a}.`),
        ),
      ],
    },
    {
      title: 'The dealer adds one heart in the middle',
      lead: 'A single card, face down, belonging to nobody. It is the spacer that makes the read-off work.',
      body: () => [
        rowEl([aliceCards[0], aliceCards[1], 'heart', 'heart', 'heart'], {
          faceUp: [false, false, false, false, false],
          captions: ['Alice', 'Alice', 'Dealer', '', ''],
          ariaLabel: 'Alice’s two cards and the dealer’s middle card are face down.',
        }),
        h(
          'p',
          { class: 'step-note' },
          'Its suit is public — everyone knows it is a heart. It carries no secret; it just makes the distance between the two spades come out right.',
        ),
      ],
    },
    {
      title: `Bob commits to the NEGATION of his bit (¬b = ${inputs.b === 1 ? 0 : 1})`,
      lead: 'Bob encodes the opposite of what he holds. That is not a trick clause — it is what putting his pair at the far end of the ring already does to it.',
      body: () => [
        rowEl(layout(inputs), {
          faceUp: [false, false, false, false, false],
          showOwners: true,
          animate: 'deal',
          ariaLabel: 'All five cards are now face down on the table.',
        }),
        h(
          'p',
          { class: 'step-note' },
          'Reversing a commitment negates it: ',
          code('reverse(E(x)) = E(¬x)'),
          '. So “Bob lays E(¬b)” and “Bob lays his own pair backwards” put down the same two cards. The read-off pairs the last position with the first, so the wrap-around has already turned his pair round for him.',
        ),
        state.hideCut
          ? null
          : peek(`Bob played ${toPair(bobCards)} — the encoding of ${inputs.b === 1 ? 0 : 1}, because his bit is ${inputs.b}.`),
      ],
    },
    {
      title: 'The cut',
      lead: 'Someone lifts a few cards off one end and puts them on the other. Nobody watches how many.',
      term: 'cut',
      body: () => [
        h(
          'div',
          { class: 'cut-figure' },
          h(
            'div',
            { class: 'cut-side' },
            h('h4', {}, 'Before the cut'),
            ringEl(r.beforeCut, { size: 200 }),
            h('p', { class: 'help' }, 'Nobody is ever allowed to see this one.'),
          ),
          h('div', { class: 'cut-arrow', 'aria-hidden': 'true' }, '→'),
          h(
            'div',
            { class: 'cut-side' },
            h('h4', {}, 'After the cut'),
            // No `rotation` override: drawing the revealed row from position 0 is
            // already the same ring turned by the cut, which is exactly the picture
            // that makes "every neighbour stayed a neighbour" legible.
            ringEl(r.revealed, { size: 200 }),
            h(
              'p',
              { class: 'help' },
              state.hideCut
                ? 'Cut by an amount you asked not to see.'
                : `Cut by ${state.shift}${state.cutSource === 'random' ? ', drawn uniformly at random' : ', chosen by you'}.`,
            ),
          ),
        ),
        note(
          'info',
          'Both rings show the cards still face down as far as the players are concerned — they are drawn face up here only so you can watch the rotation. Look at which cards are next to which: the ring turned, and every neighbour stayed a neighbour.',
        ),
      ],
    },
    {
      title: 'Turn them all over',
      lead: 'This is the only thing that ever becomes public. Read the answer straight off it.',
      body: () => [
        rowEl(r.revealed, {
          markSpades: true,
          animate: 'flip',
          ariaLabel: `The revealed row: ${toKey(r.revealed)}.`,
        }),
        h(
          'div',
          { class: 'readoff' },
          ringEl(r.revealed, { size: 200, showVerdict: true }),
          h(
            'div',
            { class: 'readoff-text' },
            ringLegend(r.adjacent),
            h(
              'p',
              { class: 'output-line' },
              'Answer read from the cards: ',
              h('span', { class: 'output-bit' }, String(r.output)),
            ),
            h(
              'p',
              { class: 'both-sides-eq' },
              `Independently: ${state.inputs.a} AND ${state.inputs.b} = ${andGate(state.inputs.a, state.inputs.b)}.`,
            ),
            r.output === andGate(state.inputs.a, state.inputs.b)
              ? verdict('pass', 'the cards and the truth table agree', 'Match')
              : verdict('fail', 'the cards disagree with the truth table', 'Mismatch'),
          ),
        ),
        r.output === 0 && state.inputs.a === 1
          ? note(
              'info',
              'Alice held a 1 and the answer came out 0, so Alice now knows Bob held 0. That is not a leak — it is what an AND gate means. Anyone who contributes a 1 and gets a 0 back has deduced the other input by arithmetic, and no protocol on earth can prevent it.',
            )
          : null,
      ],
    },
  ];
}

function paintSteps(host: HTMLElement): void {
  const specs = steps();
  const shown = Math.min(state.shown, specs.length);

  const next = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-primary',
      onclick: () => {
        state.shown = Math.min(state.shown + 1, STEP_COUNT);
        paintSteps(host);
        const cards = host.querySelectorAll('.step-card');
        const last = cards[cards.length - 1];
        if (last) scrollIntoCentre(last);
      },
    },
    'Next step',
  ) as HTMLButtonElement;
  next.disabled = shown >= STEP_COUNT;

  const all = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost',
      onclick: () => {
        state.shown = STEP_COUNT;
        paintSteps(host);
      },
    },
    'Show all steps',
  );
  const reset = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost',
      onclick: () => {
        state.shown = 1;
        paintSteps(host);
      },
    },
    'Back to the start',
  );

  clear(host);
  host.append(
    h(
      'div',
      { class: 'step-bar' },
      h('span', { class: 'trace-tag' }, 'WALKTHROUGH'),
      next,
      all,
      reset,
      h('span', { class: 'step-progress', role: 'status' }, `Step ${shown} of ${STEP_COUNT}`),
    ),
    ...specs.slice(0, shown).map((spec, i) =>
      h(
        'section',
        { class: 'step-card reveal' },
        h('span', { class: 'trace-tag' }, `STEP ${i + 1}`),
        h('h3', {}, spec.title),
        h('p', { class: 'step-lead' }, spec.lead),
        spec.term ? termAside(TERMS[spec.term]) : null,
        h('div', { class: 'step-body' }, ...spec.body()),
      ),
    ),
  );
}

// ------------------------------------------------------------- all five cuts

function paintAllCuts(host: HTMLElement): void {
  const { inputs } = state;
  const expected = andGate(inputs.a, inputs.b);
  const rows = ALL_SHIFTS.map((s) => run(inputs, s));
  const agree = rows.every((r) => r.output === expected);

  clear(host);
  host.append(
    h(
      'section',
      { class: 'aha' },
      h('h3', {}, 'Every cut, side by side'),
      h(
        'p',
        { class: 'panel-sub' },
        `Alice is holding ${inputs.a} and Bob is holding ${inputs.b}. Here is what the table looks like after each of the five possible cuts. Five different rows — read the answer off each one.`,
      ),
      prediction(
        'cut-invariance',
        'Before you look: do all five cuts give the same answer?',
        [
          { label: 'Yes — all five agree', correct: true },
          { label: 'No — some cuts give the wrong answer', correct: false },
          { label: 'It depends on the two bits', correct: false },
        ],
      ),
      h(
        'div',
        { class: 'cut-grid' },
        ...rows.map((r) =>
          h(
            'div',
            { class: 'cut-cell' },
            h('span', { class: 'cut-cell-label' }, `Cut ${r.shift}`),
            rowEl(r.revealed, {
              markSpades: true,
              ariaLabel: `Cut ${r.shift} reveals ${toKey(r.revealed)}, which reads ${r.output}.`,
            }),
            h(
              'span',
              { class: `pill pill-${r.output === expected ? 'ok' : 'bad'}` },
              h('span', { 'aria-hidden': 'true' }, r.output === expected ? '✓ ' : '✕ '),
              `reads ${r.output}`,
            ),
          ),
        ),
      ),
      agree
        ? verdict(
            'pass',
            `all five cuts read ${expected}, which is ${inputs.a} AND ${inputs.b}`,
            'Invariant',
          )
        : verdict('fail', 'the cuts disagree — the read-off is not cut-invariant', 'Broken'),
      predictionDebrief(
        'cut-invariance',
        'The cut rearranges which card is in which position, but it cannot change which cards are next to each other around the ring — and “next to each other” is the entire read-off. That is why the answer survives.',
      ),
      disclosure(
        'The same thing in one line of text',
        h(
          'p',
          {},
          'Each row below is the same five cards, rotated. Read them as rings — the last character’s neighbour is the first.',
        ),
        h(
          'ul',
          { class: 'facts' },
          ...rows.map((r) =>
            h(
              'li',
              {},
              code(`cut ${r.shift}: ${toKey(r.revealed)}`),
              ` → ${r.adjacent ? 'spades touch' : 'spades apart'} → ${r.output}`,
            ),
          ),
        ),
      ),
    ),
  );
}

// ------------------------------------------------------------------- bits & bobs

function encodingCard(bit: Bit): HTMLElement {
  const pair = commit(bit);
  return h(
    'div',
    { class: 'encoding-item' },
    rowEl([pair[0], pair[1], 'heart', 'heart', 'heart'], {
      faceUp: [true, true, false, false, false],
      ariaLabel: `The encoding of ${bit}`,
    }),
    h('span', { class: 'encoding-label' }, `means ${bit}`),
  );
}

/** A value only the narrator gets to see, marked as such rather than smuggled in. */
function peek(text: string): HTMLElement {
  return h(
    'p',
    { class: 'peek' },
    h('span', { class: 'peek-tag' }, 'YOU CAN SEE THIS; THE PLAYERS CANNOT'),
    srOnly('Narrator note: '),
    text,
  );
}

function toPair(pair: readonly ['spade' | 'heart', 'spade' | 'heart']): string {
  return pair.map((c) => (c === 'spade' ? '♠' : '♥')).join('');
}

// [extension] point — a four-card AND (Mizuki–Sone 2009) drops the dealer's heart and
// replaces the cut with a random bisection of two card pairs, reading the answer off a
// two-card block. It would enter here as a second `steps()` script; `layout`/`cut` in
// protocol.ts and the orbit enumeration in necklace.ts are the only other places that
// assume the deck is five cards and the group is Z5.
