/**
 * Exhibit 1 — the protocol itself.
 *
 * The one mechanism this lab exists to show is that a *cut* can hide which of three
 * arrangements you started from while leaving a fourth one recognisable. So the first
 * thing on the page is the trick, not a description of it: two bit controls, five
 * cards, one button. The learner performs it before reading anything about it.
 *
 * Everything the earlier version said is still here — the six-step walkthrough, the
 * jargon scaffolding, the honesty caveats — but it sits *below* the interaction as
 * material you reach for once you have a question, rather than a wall you climb
 * before you can play.
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
  /** Face down until the learner asks for the reveal. */
  revealed: boolean;
  /** Steps revealed so far in the long-form walkthrough, 1..STEP_COUNT. */
  shown: number;
  /** Play it like a real game: the page stops printing the cut depth. */
  hideCut: boolean;
}

const STEP_COUNT = 6;

const state: State = {
  inputs: { a: 1, b: 1 },
  shift: 2,
  cutSource: 'manual',
  revealed: false,
  shown: 1,
  hideCut: false,
};

/** Focus target for the guided tour: the one action the first screen wants. */
export const STAGE_ACTION_ID = 'stage-reveal';

export function renderProtocolPanel(root: HTMLElement): void {
  const stageHost = h('div', { class: 'stage-host' });
  const invariantHost = h('div', { class: 'invariant-host' });
  const stepHost = h('div', { class: 'steps' });

  const repaint = (): void => {
    paintStage(stageHost, repaint);
    paintInvariant(invariantHost);
    paintSteps(stepHost);
  };

  root.replaceChildren(
    stageHost,
    invariantHost,
    disclosure(
      'Explain each step — the six stages, in full',
      h(
        'p',
        {},
        'The same run you just performed, taken apart. Every card is placed one at a time, the cut is shown before and after, and the read-off is checked against a plain AND gate.',
      ),
      stepHost,
    ),
    aboutSection(),
    learnerCheck(
      'The row is turned over and you see ♠ ♥ ♥ ♠ ♥. What do you now know about Alice’s bit?',
      [
        { label: 'It was 0', correct: false },
        { label: 'It was 1', correct: false },
        { label: 'Nothing — 0 and 1 are still equally likely', correct: true },
      ],
      'The two spades have hearts between them, so the answer is 0 — and all three input pairs that produce 0 can produce exactly this row, each just as often. Both of Alice’s bits remain exactly as likely as before you looked. The “Privacy” exhibit shows that as a table you can check cell by cell.',
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

// ------------------------------------------------------------------- the stage
//
// The whole exhibit in one screen: pick two bits, cut, reveal, read the answer.
// Kept deliberately unframed — the cards are the subject, and a border around them
// would make them look like one more panel among the eight below.

function paintStage(host: HTMLElement, repaint: () => void): void {
  const { inputs } = state;
  const r = run(inputs, state.shift);
  const expected = andGate(inputs.a, inputs.b);

  const reveal = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-primary stage-btn',
      id: STAGE_ACTION_ID,
      onclick: () => {
        if (!state.revealed && state.cutSource === 'random') state.shift = uniformShift();
        state.revealed = !state.revealed;
        repaint();
      },
    },
    state.revealed ? 'Turn them back over' : 'Cut and reveal',
  );

  clear(host);
  host.append(
    h(
      'section',
      { class: 'stage', 'aria-label': 'The five-card trick' },
      h('h2', { class: 'stage-lead' }, 'Choose two secret bits. Cut the five cards. The row changes; the answer does not.'),
      h(
        'div',
        { class: 'stage-bits' },
        bitControl('Alice', () => state.inputs.a, (v) => {
          state.inputs = { ...state.inputs, a: v };
        }, repaint),
        bitControl('Bob', () => state.inputs.b, (v) => {
          state.inputs = { ...state.inputs, b: v };
        }, repaint),
      ),
      h(
        'div',
        { class: 'stage-table' },
        rowEl(state.revealed ? r.revealed : r.beforeCut, {
          faceUp: state.revealed ? undefined : [false, false, false, false, false],
          markSpades: state.revealed,
          animate: state.revealed ? 'flip' : 'deal',
          ariaLabel: state.revealed
            ? `The revealed row: ${toKey(r.revealed)}.`
            : 'Five cards face down on the table.',
        }),
      ),
      h('div', { class: 'stage-action' }, reveal, cutControl(repaint)),
      h(
        'div',
        { class: 'stage-result', role: 'status', 'aria-live': 'polite' },
        state.revealed
          ? h(
              'div',
              { class: 'stage-result-live' },
              h(
                'p',
                { class: 'readoff-line' },
                h('span', { class: 'readoff-shape' }, r.adjacent ? '♠♠' : '♠♥♠'),
                r.adjacent ? ' the two spades are neighbours → ' : ' a heart sits between them → ',
                h('span', { class: 'output-bit' }, String(r.output)),
              ),
              h(
                'p',
                { class: 'readoff-check' },
                `Independently: ${inputs.a} AND ${inputs.b} = ${expected}.`,
              ),
              r.output === expected
                ? verdict('pass', 'the cards and the truth table agree', 'Match')
                : verdict('fail', 'the cards disagree with the truth table', 'Mismatch'),
            )
          : h(
              'p',
              { class: 'help stage-hint' },
              'Alice’s two cards, the dealer’s heart, then Bob’s two — all face down, all identical from the back. Cut and turn them over.',
            ),
      ),
      state.revealed
        ? h(
            'p',
            { class: 'help stage-nudge' },
            'Now change the cut. The five cards move; the answer does not.',
          )
        : null,
    ),
  );
}

function bitControl(
  who: 'Alice' | 'Bob',
  get: () => Bit,
  set: (b: Bit) => void,
  repaint: () => void,
): HTMLElement {
  const id = `bit-${who.toLowerCase()}-label`;
  const buttons = ([0, 1] as const).map((v) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn seg-btn',
        'aria-pressed': String(get() === v),
        onclick: () => {
          set(v);
          repaint();
        },
      },
      String(v),
    ),
  );
  return h(
    'div',
    { class: 'stage-bit' },
    // Visibly just the name, so both controls fit on one line of a phone; the group's
    // accessible name still reads "Alice's secret bit" rather than "Alice".
    h('span', { class: 'stage-bit-label', id }, who, srOnly('’s secret bit')),
    h('div', { class: 'seg', role: 'group', 'aria-labelledby': id }, ...buttons),
  );
}

/**
 * The cut, as a control the learner drives.
 *
 * Six choices rather than five: the five depths are the manual "what if", and the
 * die is the honest one. Changing a depth while the cards are face up re-cuts them in
 * place, which is the whole point — the row visibly moves under an answer that does
 * not, and the answer stays in the same spot on screen so there is nothing to hunt for.
 */
function cutControl(repaint: () => void): HTMLElement {
  const buttons: HTMLButtonElement[] = ALL_SHIFTS.map(
    (s) =>
      h(
        'button',
        {
          type: 'button',
          class: 'btn seg-btn',
          'data-depth': String(s),
          'aria-pressed': String(state.cutSource === 'manual' && state.shift === s),
          onclick: () => {
            state.shift = s;
            state.cutSource = 'manual';
            repaint();
          },
        },
        String(s),
      ) as HTMLButtonElement,
  );
  buttons.push(
    h(
      'button',
      {
        type: 'button',
        class: 'btn seg-btn',
        'data-depth': 'random',
        'aria-pressed': String(state.cutSource === 'random'),
        onclick: () => {
          state.shift = uniformShift();
          state.cutSource = 'random';
          repaint();
        },
      },
      'random',
    ) as HTMLButtonElement,
  );

  return h(
    'div',
    { class: 'stage-cut' },
    h('span', { class: 'stage-cut-label', id: 'stage-cut-label' }, 'Cut by'),
    h('div', { class: 'seg', role: 'group', 'aria-labelledby': 'stage-cut-label' }, ...buttons),
  );
}

// ------------------------------------------------------- the invariant, up front

function paintInvariant(host: HTMLElement): void {
  const { inputs } = state;
  const expected = andGate(inputs.a, inputs.b);
  const rows = ALL_SHIFTS.map((s) => run(inputs, s));
  const agree = rows.every((r) => r.output === expected);

  clear(host);
  host.append(
    h(
      'section',
      { class: 'invariant' },
      h('h3', {}, 'Every cut at once'),
      h(
        'p',
        { class: 'panel-sub' },
        `Alice is holding ${inputs.a}, Bob is holding ${inputs.b}. Five cuts, five different rows on the table — and the same answer read off every one of them.`,
      ),
      h(
        'div',
        { class: 'cut-grid' },
        ...rows.map((r) =>
          h(
            'div',
            { class: `cut-cell ${r.shift === state.shift ? 'cut-cell-now' : ''}` },
            h(
              'span',
              { class: 'cut-cell-label' },
              `Cut ${r.shift}`,
              r.shift === state.shift ? h('span', { class: 'cut-cell-now-tag' }, ' on the table') : null,
            ),
            rowEl(r.revealed, {
              markSpades: true,
              ariaLabel: `Cut ${r.shift} reveals ${toKey(r.revealed)}, which reads ${r.output}.`,
            }),
            h(
              'span',
              { class: `pill pill-${r.output === expected ? 'ok' : 'bad'}` },
              h('span', { 'aria-hidden': 'true' }, r.output === expected ? '✓' : '✕'),
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
      prediction(
        'cut-invariance',
        'Change one of the bits above. Before you look — will all five cuts still agree with each other?',
        [
          { label: 'Yes — always, whatever the bits', correct: true },
          { label: 'No — some cuts will disagree', correct: false },
          { label: 'Only when the answer is 0', correct: false },
        ],
      ),
      predictionDebrief(
        'cut-invariance',
        'The cut rearranges which card is in which position, but it cannot change which cards are next to each other around the ring — and “next to each other” is the entire read-off. That holds for every pair of bits, which is why the row above never breaks.',
      ),
      disclosure(
        'The same five rows as text',
        h(
          'p',
          {},
          'Read each one as a ring: the last character’s neighbour is the first. That wrap-around is the only reason the read-off survives a cut.',
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

// ------------------------------------------------------ what is actually going on

/**
 * The prose that used to open the panel, now placed where a learner reaches it
 * *after* the trick has raised a question rather than before they have one.
 */
function aboutSection(): HTMLElement {
  return h(
    'section',
    { class: 'about' },
    h('h3', {}, 'What just happened'),
    h(
      'p',
      {},
      'Alice knows one secret bit. Bob knows another. They want to know whether BOTH bits are 1 — and nothing else. No computers, no keys, no maths problem anybody hopes is hard: five playing cards, laid out in a particular order, cut once, and turned over.',
    ),
    h(
      'p',
      {},
      'A pair of face-down cards is a ',
      h('strong', {}, 'commitment'),
      ': ♠♥ means 1, ♥♠ means 0. Both use the same two cards, so a pair face down looks identical whichever bit it holds — only the order carries the secret. Alice commits to her bit, the dealer adds a heart in the middle, and Bob commits to the ',
      h('em', {}, 'negation'),
      ' of his. Then somebody cuts the ring and everyone looks.',
    ),
    h(
      'div',
      { class: 'encoding' },
      encodingCard(1),
      encodingCard(0),
    ),
    termAside(TERMS.cut),
    note(
      'caveat',
      'The cut is simulated. A browser cannot shuffle a physical deck, so “random” draws from your platform’s cryptographic random source, and — unlike a real dealer — this page knows the number it drew. That is a limitation of the demo, not of the protocol. The switch below hides it if you would rather play it straight.',
    ),
    honestPlayControl(),
    glossary(Object.values(TERMS)),
  );
}

function honestPlayControl(): HTMLElement {
  const hide = h('input', { type: 'checkbox', id: 'hide-cut' }) as HTMLInputElement;
  hide.checked = state.hideCut;
  hide.addEventListener('change', () => {
    state.hideCut = hide.checked;
    const host = document.querySelector<HTMLElement>('.steps');
    if (host) paintSteps(host);
  });
  return h(
    'div',
    { class: 'control control-inline-row' },
    hide,
    h('label', { for: 'hide-cut' }, 'Play it honestly — don’t show me the cut depth'),
  );
}

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
        h('div', { class: 'encoding' }, encodingCard(1), encodingCard(0)),
        h(
          'p',
          { class: 'step-note' },
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
          'From Bob’s side of the table this is the same picture whichever bit she chose.',
        ),
        state.hideCut ? null : peek(`Alice played ${toPair(aliceCards)} — the encoding of ${inputs.a}.`),
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
          'Both rings show the cards face up only so you can watch the rotation — the players still see backs. Look at which cards are next to which: the ring turned, and every neighbour stayed a neighbour.',
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
              { class: 'readoff-check' },
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
        h('h4', {}, spec.title),
        h('p', { class: 'step-lead' }, spec.lead),
        spec.term ? termAside(TERMS[spec.term]) : null,
        h('div', { class: 'step-body' }, ...spec.body()),
      ),
    ),
  );
}

// ------------------------------------------------------------------- bits & bobs

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
