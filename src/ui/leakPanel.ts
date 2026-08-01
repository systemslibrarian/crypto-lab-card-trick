/**
 * Exhibit 3 — what the revealed row actually gives away.
 *
 * The claim "the cards leak nothing" is easy to say and easy to say falsely, so this
 * exhibit never says it. It prints the probability of every revealed row for every
 * input pair, compares the rows of that table cell by cell, and reports the
 * difference. Under a uniform cut the difference is 0 — not "small", not "negligible
 * for 128-bit security", 0 — and that is what information-theoretic means.
 *
 * The second half is the distinction the protocol lives or dies by: what the OUTPUT
 * implies is not a leak. Bob holding a 1 learns Alice's bit from the answer alone,
 * and no protocol computing an AND can prevent that. What is on trial here is
 * whether the CARDS say anything the answer did not.
 */

import { ALL_INPUTS, type Bit, type Inputs } from '../cards/types.js';
import {
  ROW_KEYS,
  aliceLeak,
  bobLeak,
  distributionTable,
  excessLeakageBits,
  observerSuccess,
  posterior,
  revealDist,
  shiftFor,
  totalVariation,
} from '../cards/analysis.js';
import { UNIFORM_CUT } from '../cards/shuffle.js';
import { fromKey, layout, toKey } from '../cards/protocol.js';
import { rowEl } from './cards.js';
import {
  TERMS,
  bridge,
  clear,
  code,
  disclosure,
  h,
  learnerCheck,
  note,
  panelIntro,
  prediction,
  predictionDebrief,
  scrollRegion,
  statTile,
  termAside,
  verdict,
} from './dom.js';

const label = (x: Inputs): string => `a=${x.a}, b=${x.b}`;

export function renderLeakPanel(root: HTMLElement): void {
  root.replaceChildren(
    panelIntro(
      'What the revealed row gives away',
      'Everyone at the table sees the same five faces. The question is whether those faces say anything about Alice’s bit and Bob’s bit beyond the answer they were dealt to compute.',
      'Below is the exact probability of every possible revealed row, for every possible pair of secrets, under a proper uniform cut. Nothing here is sampled — there are ten rows and five cuts, so every number is a finished sum.',
    ),
    termAside(TERMS.itSecure),
    prediction(
      'leak-table',
      'Alice holds 0 and Bob holds 0. Alice holds 1 and Bob holds 0. Do those two situations produce the same revealed rows, with the same frequencies?',
      [
        { label: 'Yes — identical, cell for cell', correct: true },
        { label: 'Same rows, but different frequencies', correct: false },
        { label: 'Different rows entirely', correct: false },
      ],
    ),
    readingSection(),
    tableSection(),
    predictionDebrief(
      'leak-table',
      'The three input pairs whose answer is 0 all start from rows that are rotations of one another, so a uniform cut spreads all three over the same five rows at the same 1-in-5 rate. There is no statistic to compute, no test to run: the distributions are the same object.',
    ),
    comparisonSection(),
    bobSection(),
    posteriorSection(),
    learnerCheck(
      'Bob holds 1, the cards are turned over, and the answer is 0. Has the protocol leaked Alice’s bit?',
      [
        { label: 'Yes — Bob now knows Alice held 0', correct: false },
        { label: 'No — Bob deduced it from the answer, not the cards', correct: true },
        { label: 'Only if the cut was not uniform', correct: false },
      ],
      'Bob does now know Alice held 0 — but he could have worked that out from a phone call announcing “the answer is 0”, without ever seeing a card. Anything implied by the output and your own input is not something a protocol can hide; it is what computing an AND means. The measure that matters is what the cards add on top, and under a uniform cut that is exactly nothing.',
    ),
    note(
      'caveat',
      'What this does NOT prove: that the shuffle in your hands is uniform, that neither player peeked while the cards were face down, that nobody marked a back, and that both players actually placed the cards their bits called for. Those are physical assumptions, and the protocol offers no defence against any of them — it assumes them. The next exhibit takes the first one away and shows what happens.',
    ),
    bridge(
      'Under a uniform cut the cards add zero bits to what the answer already told you — and “zero” here is an enumerated zero, not a bound.',
      'Everything rested on that one word, uniform. What happens if the dealer is sloppy?',
      {
        label: 'Break the shuffle yourself →',
        onClick: () => document.getElementById('tab-break')?.click(),
      },
    ),
  );
}

// ------------------------------------------------- one reveal at a time, first
//
// A probability matrix is the right evidence and the wrong on-ramp. Before asking a
// newcomer to parse forty cells, give them the reading rule and one column: here is a
// revealed row, here is how often each of the three secrets that could explain it
// produces it, and here they are side by side. Scrub through all five and the numbers
// never move. THEN show the matrix.

const ZERO_PAIRS: readonly Inputs[] = ALL_INPUTS.filter((x) => !(x.a === 1 && x.b === 1));

function readingSection(): HTMLElement {
  const out = h('div', { class: 'reading-out', role: 'status', 'aria-live': 'polite' });
  // The five rows an answer of 0 can produce — the only ones where three different
  // secrets are in play and there is therefore anything to compare.
  const keys = ROW_KEYS.slice(0, 5);
  let selected = 0;

  const buttons = keys.map((key, i) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn seg-btn',
        'aria-pressed': String(i === 0),
        onclick: () => {
          selected = i;
          for (const [j, b] of buttons.entries()) b.setAttribute('aria-pressed', String(j === selected));
          paint();
        },
      },
      key,
    ),
  );

  const paint = (): void => {
    const key = keys[selected];
    const idx = ROW_KEYS.indexOf(key);
    const seq = fromKey(key);
    const values = ZERO_PAIRS.map((x) => revealDist(x, UNIFORM_CUT)[idx]);
    const allEqual = values.every((v) => Math.abs(v - values[0]) < 1e-12);

    clear(out);
    out.append(
      h(
        'div',
        { class: 'reading-row' },
        seq ? rowEl(seq, { markSpades: true, ariaLabel: `The revealed row ${key}` }) : null,
        h('p', { class: 'help' }, 'How often does each pair of secrets produce exactly this row?'),
      ),
      h(
        'div',
        { class: 'reading-cols' },
        ...ZERO_PAIRS.map((x, i) =>
          h(
            'div',
            { class: 'reading-col' },
            h('span', { class: 'reading-col-label' }, label(x)),
            h('span', { class: 'reading-col-value' }, `${(values[i] * 100).toFixed(0)}%`),
            h('span', { class: 'reading-col-frac' }, '1 time in 5'),
          ),
        ),
      ),
      allEqual
        ? verdict('pass', 'all three are the same number — this row is no evidence about anybody’s bit', 'Aligned')
        : verdict('alarm', 'the three differ, so this row is evidence', 'Separated'),
    );
  };

  paint();

  return h(
    'section',
    { class: 'aha' },
    h('h3', {}, 'The reading rule, one row at a time'),
    h(
      'p',
      { class: 'panel-sub' },
      'For every revealed row, compare the three pairs of secrets whose answer is 0. If the three numbers ever differ, the row is a clue. If they always match, there is nothing in the cards to read.',
    ),
    h(
      'div',
      { class: 'seg-wrap', role: 'group', 'aria-label': 'Choose a revealed row to compare' },
      ...buttons,
    ),
    out,
    h(
      'p',
      { class: 'help' },
      'Scrub through all five. The three numbers stay locked together every time — which is the whole privacy claim, before a single probability table.',
    ),
  );
}

// ------------------------------------------------------------- the big table

function tableSection(): HTMLElement {
  const table = distributionTable(UNIFORM_CUT);

  const header = h(
    'tr',
    {},
    h('th', { scope: 'col' }, 'Secrets'),
    h('th', { scope: 'col' }, 'Answer'),
    ...ROW_KEYS.map((k) =>
      h('th', { scope: 'col', class: 'kat-col-row' }, h('code', {}, k)),
    ),
  );

  const body = table.map((r) =>
    h(
      'tr',
      { class: r.output === 1 ? 'kat-row-one' : undefined },
      h('th', { scope: 'row' }, label(r.inputs)),
      h('td', {}, String(r.output)),
      ...r.dist.map((p) =>
        h(
          'td',
          { class: p > 0 ? 'prob-cell prob-on' : 'prob-cell prob-off' },
          p > 0 ? '1/5' : h('span', {}, h('span', { 'aria-hidden': 'true' }, '·'), sr('never')),
        ),
      ),
    ),
  );

  return h(
    'section',
    { class: 'kat-group' },
    h('h3', {}, 'Every revealed row, every pair of secrets'),
    h(
      'p',
      { class: 'panel-sub' },
      'Read a row across: that is the complete list of what those two secrets can produce, and how often. The first three rows are the ones to compare — they are the three ways to get an answer of 0.',
    ),
    scrollRegion(
      'Probability of each revealed row given each pair of secrets, under a uniform cut',
      h(
        'table',
        { class: 'kat-table prob-table' },
        h('thead', {}, header),
        h('tbody', {}, ...body),
      ),
    ),
    h(
      'p',
      { class: 'help' },
      'Columns are the ten legal rows, S = spade and H = heart. The five on the left are the rows where the spades end up apart; the five on the right are where they touch.',
    ),
  );
}

const sr = (text: string): HTMLElement => h('span', { class: 'sr-only' }, text);

// -------------------------------------------------- compute both sides and compare

function comparisonSection(): HTMLElement {
  const pairs: [Inputs, Inputs][] = [
    [
      { a: 0, b: 0 },
      { a: 1, b: 0 },
    ],
    [
      { a: 0, b: 0 },
      { a: 0, b: 1 },
    ],
    [
      { a: 0, b: 1 },
      { a: 1, b: 0 },
    ],
    [
      { a: 0, b: 0 },
      { a: 1, b: 1 },
    ],
  ];

  const rows = pairs.map(([x, y]) => {
    const tv = totalVariation(revealDist(x, UNIFORM_CUT), revealDist(y, UNIFORM_CUT));
    const sameAnswer = (x.a & x.b) === (y.a & y.b);
    return h(
      'div',
      { class: 'compare-row' },
      h('span', { class: 'compare-pair' }, `${label(x)}  vs  ${label(y)}`),
      h(
        'span',
        { class: `pill pill-${tv === 0 ? 'ok' : sameAnswer ? 'bad' : 'neutral'}` },
        h('span', { 'aria-hidden': 'true' }, tv === 0 ? '✓ ' : '— '),
        `distance ${tv.toFixed(3)}`,
      ),
      h(
        'span',
        { class: 'compare-note' },
        tv === 0
          ? 'indistinguishable — no test can separate them'
          : 'separable, because the two cases have different answers',
      ),
    );
  });

  const allZeroWhereItMatters = pairs.every(([x, y]) => {
    const same = (x.a & x.b) === (y.a & y.b);
    return !same || totalVariation(revealDist(x, UNIFORM_CUT), revealDist(y, UNIFORM_CUT)) === 0;
  });

  return h(
    'section',
    { class: 'aha' },
    h('h3', {}, 'Compare the rows of the table, pair by pair'),
    h(
      'p',
      { class: 'panel-sub' },
      'Total variation distance measures how far apart two random outcomes are. 0 means no observer, however clever and however well funded, does better than a coin flip at telling them apart. 1 means one glance settles it.',
    ),
    termAside(TERMS.tv),
    h('div', { class: 'compare-list' }, ...rows),
    allZeroWhereItMatters
      ? verdict(
          'pass',
          'every pair of secrets with the same answer is at distance exactly 0; the only separable pairs are the ones the answer itself separates',
          'Indistinguishable',
        )
      : verdict('alarm', 'two secrets with the same answer produced different-looking rows', 'Leaking'),
    h(
      'p',
      { class: 'help' },
      'The last line is the one worth pausing on: a=0,b=0 and a=1,b=1 ARE distinguishable, at distance 1. That is not a flaw — those two cases have different answers, and the whole point of running the protocol was to learn the answer.',
    ),
  );
}

// ---------------------------------------------------------------- Bob's view

function bobSection(): HTMLElement {
  const leaks = bobLeak(UNIFORM_CUT);
  const atB0 = leaks.find((l) => l.known === 0)!;
  const atB1 = leaks.find((l) => l.known === 1)!;
  const obs = observerSuccess(UNIFORM_CUT);

  const card = (known: Bit, l: (typeof leaks)[number]): HTMLElement =>
    h(
      'div',
      { class: `sig-card ${l.forcedByOutput ? 'sig-card-forced' : 'sig-card-live'}` },
      h('h4', {}, `Bob is holding ${known}`),
      h(
        'p',
        { class: 'help' },
        known === 1
          ? 'The answer equals Alice’s bit, so Bob learns it — by arithmetic, before he looks at a single card.'
          : 'The answer is 0 whatever Alice did, so anything Bob works out has to come from the cards.',
      ),
      statTile(
        'Bob guesses Alice’s bit correctly',
        `${(l.success * 100).toFixed(1)}%`,
        l.forcedByOutput ? 'implied by the answer, not by the cards' : 'the best any strategy can do',
        l.forcedByOutput ? 'neutral' : l.tv === 0 ? 'ok' : 'alarm',
      ),
      l.forcedByOutput
        ? h('span', { class: 'pill pill-neutral' }, 'forced by the AND itself')
        : l.tv === 0
          ? verdict('pass', 'the cards told Bob nothing', 'No leak')
          : verdict('alarm', `the cards moved Bob from 50% to ${(l.success * 100).toFixed(1)}%`, 'Leaking'),
    );

  return h(
    'section',
    { class: 'compare-block' },
    h('h3', {}, 'What Bob can work out about Alice'),
    h(
      'p',
      { class: 'panel-sub' },
      'Bob is the adversary who matters: he is at the table, he knows his own bit, and he wants Alice’s. His two situations are completely different in kind, and running them together is the usual way this protocol gets explained badly.',
    ),
    h('div', { class: 'sig-pair' }, card(0, atB0), card(1, atB1)),
    h(
      'p',
      { class: 'help' },
      `And a bystander who knows neither bit: naming the pair of secrets after seeing the row succeeds ${(obs.fromRow * 100).toFixed(0)}% of the time — exactly the ${(obs.fromOutput * 100).toFixed(0)}% they would manage from hearing the answer announced and never seeing the table at all.`,
    ),
    disclosure('Why Alice is in the same position', aliceMirror()),
  );
}

/**
 * The mirror case, computed rather than asserted.
 *
 * This block used to be two paragraphs of prose claiming Alice is in the same
 * position as Bob, and naming a rotation offset — the wrong one, as it happens: it is
 * Alice's own two layouts that sit three cut positions apart, and Bob's that sit two
 * apart. Both offsets are now read out of `shiftFor`, and Alice's advantage out of
 * `aliceLeak`, so neither number can drift away from the protocol again.
 */
function aliceMirror(): HTMLElement {
  const aliceGap = shiftFor({ a: 0, b: 0 }, toKey(layout({ a: 1, b: 0 })));
  const bobGap = shiftFor({ a: 0, b: 0 }, toKey(layout({ a: 0, b: 1 })));
  const atA0 = aliceLeak(UNIFORM_CUT).find((l) => l.known === 0)!;

  return h(
    'div',
    {},
    h(
      'p',
      {},
      'Nothing above is special to Bob. Alice holding 0 learns nothing about Bob’s bit either, by the same argument with the roles swapped — and it is the same code: ',
      code('aliceLeak'),
      ' is ',
      code('bobLeak'),
      ' with the two inputs exchanged.',
    ),
    statTile(
      'Alice guesses Bob’s bit correctly',
      `${(atA0.success * 100).toFixed(1)}%`,
      'Alice holds 0, so the answer tells her nothing either',
      atA0.tv === 0 ? 'ok' : 'alarm',
    ),
    atA0.tv === 0
      ? verdict('pass', 'the cards told Alice nothing about Bob’s bit', 'No leak')
      : verdict(
          'alarm',
          `the cards moved Alice from 50% to ${(atA0.success * 100).toFixed(1)}%`,
          'Leaking',
        ),
    h(
      'p',
      {},
      `The two directions are not literally identical, and the difference is worth knowing: with Bob holding 0, Alice’s two possible layouts are the same ring rotated by ${aliceGap}; with Alice holding 0, Bob’s two are the same ring rotated by ${bobGap}. Both ${aliceGap} and ${bobGap} generate Z5, so in both directions the leak vanishes exactly at the uniform cut and nowhere else.`,
    ),
    h(
      'p',
      {},
      'The asymmetry in the layout — Alice commits to a, Bob commits to ¬b — buys neither player an advantage. It is bookkeeping about where the ring wraps.',
    ),
  );
}

// ------------------------------------------------------------ the posterior

function posteriorSection(): HTMLElement {
  const out = h('div', { class: 'posterior-out', role: 'status', 'aria-live': 'polite' });
  let selected = ROW_KEYS[0];

  const buttons = ROW_KEYS.map((key) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn seg-btn',
        'aria-pressed': String(key === selected),
        onclick: () => {
          selected = key;
          for (const b of buttons) b.setAttribute('aria-pressed', String(b.textContent === key));
          paint();
        },
      },
      key,
    ),
  );

  const paint = (): void => {
    const post = posterior(selected, UNIFORM_CUT);
    clear(out);
    const seq = fromKey(selected);
    if (!post || !seq) {
      out.append(note('info', 'That row cannot occur at all under this cut.'));
      return;
    }
    out.append(
      rowEl(seq, { markSpades: true, ariaLabel: `The revealed row ${selected}` }),
      h(
        'div',
        { class: 'bar-list', role: 'list', 'aria-label': 'Probability of each pair of secrets' },
        ...ALL_INPUTS.map((x, i) =>
          h(
            'div',
            { class: 'bar-row', role: 'listitem' },
            h('span', { class: 'bar-label' }, label(x)),
            h(
              'span',
              { class: 'bar-track' },
              h('span', {
                class: 'bar-fill',
                style: `width:${(post[i] * 100).toFixed(1)}%`,
                'aria-hidden': 'true',
              }),
            ),
            h('span', { class: 'bar-value' }, `${(post[i] * 100).toFixed(1)}%`),
          ),
        ),
      ),
      h(
        'p',
        { class: 'help' },
        post[3] > 0.99
          ? 'Only one pair of secrets can produce a row where the spades touch — which is exactly the statement that the answer is 1.'
          : 'Three pairs of secrets, each a third as likely as the other two. Before the cards were turned over they were a quarter each; afterwards they are a third each, and the only thing that changed is that a=1,b=1 was ruled out. That is the answer arriving — nothing more.',
      ),
    );
  };

  paint();

  return h(
    'section',
    { class: 'break-it' },
    h('h3', {}, 'Pick a revealed row and ask what it implies'),
    h(
      'p',
      { class: 'panel-sub' },
      'Given only this row on the table, how likely is each pair of secrets? Start from “all four equally likely” and let the row update it.',
    ),
    h(
      'div',
      { class: 'seg-wrap', role: 'group', 'aria-label': 'Choose a revealed row' },
      ...buttons,
    ),
    out,
    h(
      'p',
      { class: 'help' },
      'Excess leakage across the whole table: ',
      code(`${excessLeakageBits(UNIFORM_CUT).toFixed(4)} bits`),
      ' — the information the row carries about the secrets, minus the information the answer already carried. Not rounded to zero; computed as zero.',
    ),
  );
}
