/**
 * Exhibit 5 — information-theoretic against computational.
 *
 * Every other lab in this fleet is computational: it is safe because somebody would
 * need more arithmetic than exists to break it. This one is not, and the difference
 * is worth drawing rather than asserting.
 *
 * The figure plots the best an attacker can do against how much work they are
 * willing to spend. The card trick's line is flat on the floor, and it is flat
 * because `analysis.ts` enumerated it — the distributions an attacker compares are
 * equal, so there is no quantity for work to buy. The garbled-circuit line is the
 * generic bound a κ-bit primitive promises, clearly labelled as a promise rather
 * than a measurement.
 */

import { UNIFORM_CUT } from '../cards/shuffle.js';
import { bobLeak, excessLeakageBits } from '../cards/analysis.js';
import {
  TERMS,
  clear,
  disclosure,
  exitQuestion,
  extLink,
  h,
  labLink,
  matchingTask,
  note,
  panelIntro,
  scrollRegion,
  statTile,
  svg,
  termAside,
  verdict,
} from './dom.js';

/** The security parameters a learner can dial the computational line to. */
const KAPPAS = [80, 128, 256] as const;

interface State {
  work: number; // log2 of the adversary's operation count
  kappa: number;
}

const state: State = { work: 60, kappa: 128 };

export function renderComparePanel(root: HTMLElement): void {
  const figureHost = h('div', { class: 'compare-figure-host' });
  const repaint = (): void => paintFigure(figureHost);

  root.replaceChildren(
    panelIntro(
      'Cards against circuits',
      'Computers do this job with garbled circuits: Alice encrypts a Boolean circuit gate by gate, Bob evaluates it without learning what he is evaluating, and the answer comes out the other end. It handles any function, over a network, at any scale. It is how real secure computation is done.',
      'And it is safe only because breaking the encryption underneath would take more work than anyone has. The card trick makes no such bet. Neither approach dominates — they are answers to different questions — but the difference in what they rest on is the sharpest thing this lab has to teach.',
    ),
    termAside(TERMS.garbled),
    figureControls(repaint),
    figureHost,
    tableSection(),
    note(
      'info',
      'The honest scoreboard: the card trick computes ONE AND gate, for TWO people, who have to be in the same room with a deck of cards and a dealer nobody suspects. A garbled circuit computes an arbitrary function, for parties on different continents, in milliseconds. What the cards buy is not practicality — it is a security argument that does not expire.',
    ),
    conclusionSection(),
    exitSection(),
    scopeSection(),
    museumSection(),
  );

  repaint();
}

// ------------------------------------------------------------------ the figure

function figureControls(repaint: () => void): HTMLElement {
  const workValue = h('span', { class: 'range-value' }, `2^${state.work}`);
  const work = h('input', {
    type: 'range',
    id: 'adversary-work',
    min: '0',
    max: '320',
    step: '4',
    value: String(state.work),
  }) as HTMLInputElement;
  work.addEventListener('input', () => {
    state.work = Number(work.value);
    workValue.textContent = `2^${state.work}`;
    repaint();
  });

  const kappaButtons = KAPPAS.map((k) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn seg-btn',
        'aria-pressed': String(state.kappa === k),
        onclick: () => {
          state.kappa = k;
          for (const b of kappaButtons) {
            b.setAttribute('aria-pressed', String(Number(b.dataset.kappa) === k));
          }
          repaint();
        },
        'data-kappa': String(k),
      },
      `${k}-bit`,
    ),
  );

  return h(
    'div',
    { class: 'controls' },
    h(
      'div',
      { class: 'control' },
      h('label', { for: 'adversary-work' }, 'How much work the attacker is willing to do'),
      h('div', { class: 'input-row' }, work, workValue),
      h(
        'p',
        { class: 'help' },
        'Operations, as a power of two. For scale: 2^60 is roughly what a large cluster gets through in a year; 2^92 is the most work ever spent on a public cryptanalysis.',
      ),
    ),
    h(
      'div',
      { class: 'control' },
      h('span', { class: 'control-label', id: 'kappa-label' }, 'Security parameter of the circuit’s cipher'),
      h('div', { class: 'seg', role: 'group', 'aria-labelledby': 'kappa-label' }, ...kappaButtons),
    ),
  );
}

/** min(1, 2^(work − κ)) — the generic bound, and nothing more than that. */
function circuitBound(work: number, kappa: number): number {
  return Math.min(1, 2 ** (work - kappa));
}

function paintFigure(host: HTMLElement): void {
  const cardAdvantage = bobLeak(UNIFORM_CUT).find((l) => l.known === 0)!.tv;
  const circuit = circuitBound(state.work, state.kappa);

  clear(host);
  host.append(
    h(
      'figure',
      { class: 'compare-figure' },
      chart(state.work, state.kappa),
      h(
        'div',
        { class: 'chart-legend' },
        h(
          'span',
          { class: 'legend-item' },
          h('span', { class: 'legend-swatch legend-cards', 'aria-hidden': 'true' }),
          'Five-card trick',
        ),
        h(
          'span',
          { class: 'legend-item' },
          h('span', { class: 'legend-swatch legend-circuit', 'aria-hidden': 'true' }),
          `Garbled circuit (${state.kappa}-bit), generic bound`,
        ),
      ),
      h(
        'figcaption',
        {},
        'How much better than a coin flip an attacker can do, against how much work they spend. The dashed line is what a security proof promises if its assumption holds; the solid line is an enumerated fact about ten card arrangements.',
      ),
    ),
    h(
      'div',
      { class: 'stat-row' },
      statTile(
        'Five-card trick',
        cardAdvantage.toFixed(3),
        `attacker advantage at 2^${state.work} operations`,
        'ok',
      ),
      statTile(
        `Garbled circuit (${state.kappa}-bit), illustrative bound`,
        circuit < 0.001 ? circuit.toExponential(1) : circuit.toFixed(3),
        `bound on the advantage at 2^${state.work} operations`,
        circuit > 0.5 ? 'alarm' : 'neutral',
      ),
    ),
    state.work >= state.kappa
      ? verdict(
          'alarm',
          `at 2^${state.work} operations the ${state.kappa}-bit bound is worthless, while the card trick's advantage is still exactly ${cardAdvantage.toFixed(3)}`,
          'Bound exhausted',
        )
      : verdict(
          'pass',
          `both are safe at 2^${state.work} operations — but only one of them is still safe at 2^${state.kappa + 40}`,
          'Both hold',
        ),
    note(
      'caveat',
      'Read the dashed line carefully. It is min(1, 2^(q−κ)) — a GENERIC, ILLUSTRATIVE bound on brute force against a κ-bit primitive. It is not a measured attack, and it is not a tight concrete-security analysis of any particular garbling scheme, whose real curve depends on its proof, its reduction loss and its assumption. It is also conditional: if the assumption underneath turns out to be false, the true curve is not this one and there is no floor at all. The solid line has no such clause, which is the entire point — it is a statement about ten arrangements of cardboard, and there is nothing in it for a future algorithm or a future computer to bite on.',
    ),
    disclosure(
      'The same figure as numbers',
      scrollRegion(
        'Attacker advantage at each amount of work',
        h(
          'table',
          { class: 'kat-table' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', { scope: 'col' }, 'Work'),
              h('th', { scope: 'col' }, 'Five-card trick'),
              h('th', { scope: 'col' }, `Garbled circuit (${state.kappa}-bit) bound`),
            ),
          ),
          h(
            'tbody',
            {},
            ...[0, 40, 80, 128, 160, 200, 256, 320].map((t) =>
              h(
                'tr',
                {},
                h('th', { scope: 'row' }, `2^${t}`),
                h('td', {}, cardAdvantage.toFixed(3)),
                h(
                  'td',
                  {},
                  circuitBound(t, state.kappa) < 0.001
                    ? circuitBound(t, state.kappa).toExponential(1)
                    : circuitBound(t, state.kappa).toFixed(3),
                ),
              ),
            ),
          ),
        ),
      ),
      h(
        'p',
        {},
        `The card-trick column is not a rounded 0.000: total variation between the two distributions Bob compares is exactly zero, and the excess leakage across the whole protocol is ${excessLeakageBits(UNIFORM_CUT).toFixed(4)} bits.`,
      ),
    ),
  );
}

const W = 560;
const HGT = 230;
const PAD = { l: 46, r: 92, t: 16, b: 34 };

function chart(work: number, kappa: number): SVGElement {
  const x = (t: number): number => PAD.l + (t / 320) * (W - PAD.l - PAD.r);
  const y = (v: number): number => HGT - PAD.b - v * (HGT - PAD.t - PAD.b);

  const gridlines: SVGElement[] = [];
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    gridlines.push(
      svg('line', { class: 'chart-grid', x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v) }),
      svg(
        'text',
        { class: 'chart-tick', x: PAD.l - 8, y: y(v) + 4, 'text-anchor': 'end' },
        v.toFixed(2),
      ),
    );
  }
  for (const t of [0, 80, 160, 240, 320]) {
    gridlines.push(
      svg(
        'text',
        { class: 'chart-tick', x: x(t), y: HGT - PAD.b + 16, 'text-anchor': 'middle' },
        `2^${t}`,
      ),
    );
  }

  const circuitPts: string[] = [];
  for (let t = 0; t <= 320; t += 2) circuitPts.push(`${x(t)},${y(circuitBound(t, kappa))}`);

  const marker = (cls: string, v: number): SVGElement =>
    svg('circle', { class: `chart-marker ${cls}`, cx: x(work), cy: y(v), r: 5 });

  return svg(
    'svg',
    {
      class: 'compare-chart',
      viewBox: `0 0 ${W} ${HGT}`,
      role: 'img',
      'aria-label': `Attacker advantage against work spent. The five-card trick stays at 0 across the whole range. The ${kappa}-bit garbled-circuit bound stays near 0 until about 2^${kappa} operations and then rises to 1.`,
    },
    ...gridlines,
    svg('line', { class: 'chart-axis', x1: PAD.l, x2: W - PAD.r, y1: y(0), y2: y(0) }),
    svg('line', { class: 'chart-axis', x1: PAD.l, x2: PAD.l, y1: y(0), y2: y(1) }),
    svg('polyline', { class: 'chart-line chart-line-circuit', points: circuitPts.join(' ') }),
    svg('polyline', {
      class: 'chart-line chart-line-cards',
      points: `${x(0)},${y(0)} ${x(320)},${y(0)}`,
    }),
    svg('line', {
      class: 'chart-cursor',
      x1: x(work),
      x2: x(work),
      y1: y(0),
      y2: y(1),
    }),
    marker('chart-marker-circuit', circuitBound(work, kappa)),
    marker('chart-marker-cards', 0),
    // Direct labels at the right edge: identity is never carried by colour alone.
    svg(
      'text',
      { class: 'chart-label chart-label-circuit', x: W - PAD.r + 8, y: y(1) + 4 },
      'circuit',
    ),
    svg('text', { class: 'chart-label chart-label-cards', x: W - PAD.r + 8, y: y(0) + 4 }, 'cards'),
    svg(
      'text',
      { class: 'chart-axis-title', x: (PAD.l + W - PAD.r) / 2, y: HGT - 2, 'text-anchor': 'middle' },
      'attacker operations',
    ),
  );
}

// ------------------------------------------------------------- the comparison

interface CompareRow {
  question: string;
  cards: string;
  circuit: string;
}

const ROWS: readonly CompareRow[] = [
  {
    question: 'What is the security based on?',
    cards: 'A shuffled deck of identical-backed cards is indistinguishable from any other shuffle. A physical fact.',
    circuit: 'A cipher nobody has managed to break. An unproven assumption.',
  },
  {
    question: 'What breaks it?',
    cards: 'A non-uniform cut, a marked deck, or a player who peeks. Nothing an attacker computes.',
    circuit: 'A break in the underlying cipher, or enough compute to brute-force the key.',
  },
  {
    question: 'Does more computing power help the attacker?',
    cards: 'No. Not more, not less, not ever — the distributions are equal.',
    circuit: 'Yes. Advantage grows with work, and the parameter has to be chosen with the future in mind.',
  },
  {
    question: 'Does a quantum computer change anything?',
    cards: 'No. There is no problem to solve faster.',
    circuit: 'Symmetric-key security roughly halves against Grover; the key sizes are chosen accordingly.',
  },
  {
    question: 'What can it compute?',
    cards: 'One AND gate, two parties.',
    circuit: 'Any Boolean circuit, any number of parties, composed at will.',
  },
  {
    question: 'What does it need in practice?',
    cards: 'Five cards, a table, and a dealer both players trust to cut fairly.',
    circuit: 'A network, a few megabytes per gate, and a working implementation.',
  },
  {
    question: 'Where is it actually used?',
    cards: 'Teaching, and research into card-based protocols. Nobody runs a payroll on it.',
    circuit: 'Private set intersection, ad conversion measurement, secure auctions, key-value queries at scale.',
  },
];

function tableSection(): HTMLElement {
  return h(
    'section',
    { class: 'kat-group' },
    h('h3', {}, 'The two approaches, question by question'),
    scrollRegion(
      'Five-card trick compared with garbled circuits',
      h(
        'table',
        { class: 'kat-table compare-table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', { scope: 'col' }, ''),
            h('th', { scope: 'col' }, 'Five-card trick'),
            h('th', { scope: 'col' }, 'Garbled circuit'),
          ),
        ),
        h(
          'tbody',
          {},
          ...ROWS.map((r) =>
            h(
              'tr',
              {},
              h('th', { scope: 'row' }, r.question),
              h('td', {}, r.cards),
              h('td', {}, r.circuit),
            ),
          ),
        ),
      ),
    ),
    h(
      'p',
      { class: 'help' },
      'The garbled-circuit side of this lab is a sibling demo: ',
      labLink('crypto-lab-garbled-gate', 'crypto-lab-garbled-gate'),
      ' builds the encrypted truth table gate by gate, and ',
      labLink('crypto-lab-ot-gate', 'crypto-lab-ot-gate'),
      ' covers the oblivious transfer it needs to hand over the right wire label.',
    ),
  );
}

// ------------------------------------------------------------ museum crossover

function museumSection(): HTMLElement {
  return h(
    'section',
    { class: 'compare-block' },
    h('h3', {}, 'Cards have been used for cryptography before — differently'),
    h(
      'p',
      { class: 'panel-sub' },
      'A deck of cards has served as a cipher machine as well as a computer. Bruce Schneier’s Solitaire (the “Pontifex” cipher in Neal Stephenson’s Cryptonomicon) turns a shuffled deck into a keystream generator you can run by hand in a prison cell.',
    ),
    h(
      'p',
      {},
      'It is worth seeing the contrast. Solitaire is a stream cipher: its security is computational, it depends on the keystream being hard to predict, and analysis has since found measurable biases in it. The five-card trick asks nothing of the cards except that their backs look alike — and gets, in exchange, a guarantee that no analysis can erode.',
    ),
    h(
      'p',
      {},
      'Solitaire, with its history and its known weaknesses, is in the ',
      extLink('https://ciphermuseum.com/ciphers/solitaire.html', 'Cipher Museum'),
      '. The museum’s ',
      extLink('https://ciphermuseum.com/halls/modern-crypto.html', 'modern cryptography hall'),
      ' sets both in the longer story.',
    ),
  );
}

// ------------------------------------------------------------- the conclusion

/**
 * Three lines, each one a thing the learner has already made happen on this page.
 *
 * An abstract summary at the end of a demo is the moment the argument evaporates; a
 * summary that points back at an interaction is the moment it lands.
 */
function conclusionSection(): HTMLElement {
  const line = (title: string, body: string, back: string): HTMLElement =>
    h(
      'li',
      {},
      h('strong', {}, title),
      ' ',
      body,
      h('span', { class: 'conclusion-back' }, back),
    );

  return h(
    'section',
    { class: 'compare-block conclusion' },
    h('h3', {}, 'What you actually saw'),
    h(
      'ul',
      { class: 'facts conclusion-list' },
      line(
        'The card protocol does not care how much work you do.',
        'Every pair of secrets consistent with the answer produces the same distribution of rows, so the attacker is comparing two things that are equal.',
        'You watched the three answer-0 columns hold at 20% each, and Bob’s ceiling sit at 50% however long you played.',
      ),
      line(
        'The circuit’s security is a parameter.',
        'It is safe until an attacker can afford about 2^κ operations, and the whole design problem is choosing κ far enough ahead of the future.',
        'You pushed the slider past 2^128 and watched the bound go to 1 while the card line did not move.',
      ),
      line(
        'The trade is real in both directions.',
        'The cards need a trusted physical procedure, compute a single gate, and cannot be composed into a second one — and their guarantee still costs nothing to maintain.',
        'You broke the whole thing by making one dealer lazy, without touching a single line of cryptography.',
      ),
    ),
  );
}

// ----------------------------------------------------------------- honest scope

/**
 * What this lab is not.
 *
 * Card-based cryptography is a real research area with a zoo of protocols, and a demo
 * that showed one gate without saying so would leave a learner thinking the field is
 * one gate. Naming the neighbours is also the honest way to state the non-goals: they
 * exist, they are interesting, and they are not here.
 */
function scopeSection(): HTMLElement {
  return h(
    'section',
    { class: 'compare-block' },
    h('h3', {}, 'Where this lab stops'),
    h(
      'p',
      { class: 'panel-sub' },
      'One AND gate, two players, five cards. Everything below is real work in the same field that this demo deliberately does not build.',
    ),
    h(
      'ul',
      { class: 'facts' },
      h(
        'li',
        {},
        h('strong', {}, 'Fewer cards. '),
        'Mizuki, Kumamoto and Sone (2012) compute AND with four cards by replacing the cut with a random bisection — a different shuffle, not a smaller version of this one. The lower bounds on how few cards a gate can need are their own literature.',
      ),
      h(
        'li',
        {},
        h('strong', {}, 'Other gates. '),
        'OR is this layout with both players negating and the read-off inverted, by De Morgan. XOR is not: it needs a different shuffle rather than a different layout.',
      ),
      h(
        'li',
        {},
        h('strong', {}, 'Composition. '),
        'There is no circuit compiler here and no multi-bit protocol. The reveal destroys both commitments, so the output of this gate cannot be fed into another one without a copy protocol — which exists, and costs more cards.',
      ),
      h(
        'li',
        {},
        h('strong', {}, 'Malicious players. '),
        'This is honest-but-curious throughout. A player who places the wrong cards, peeks, or palms one is outside the model, and no exhibit here defends against it.',
      ),
    ),
    disclosure(
      'Where the research went next',
      h(
        'ul',
        { class: 'facts timeline' },
        h(
          'li',
          {},
          h('strong', {}, '1989 — den Boer. '),
          'Five cards, one AND gate, a random cut. The protocol on this page, and the start of the field.',
        ),
        h(
          'li',
          {},
          h('strong', {}, '2012 — Mizuki, Kumamoto and Sone. '),
          'Four cards for the same gate, using a random bisection in place of the cut. Fewer cards, a different shuffle, a different proof.',
        ),
        h(
          'li',
          {},
          h('strong', {}, 'Since. '),
          'Committed-format protocols whose outputs can be fed into the next gate, formal shuffle models, and lower bounds on how few cards a gate can possibly need.',
        ),
      ),
      h(
        'p',
        {},
        'None of it is implemented here on purpose: a second runnable protocol would split attention before the five-card lesson has landed. Koch and Walzer’s 2022 survey is the map if you want to go further.',
      ),
    ),
  );
}

// ------------------------------------------------------------------ exit check

function exitSection(): HTMLElement {
  return h(
    'section',
    { class: 'transfer' },
    h('h2', {}, 'Before you go'),
    h(
      'p',
      { class: 'panel-sub' },
      'Three questions and a matching task. Nothing is scored and nothing is stored; they are here because answering is how you find out whether the idea actually landed.',
    ),
    exitQuestion(
      'Someone proposes running the five-card trick with a dealer who shuffles “really thoroughly” but always ends by cutting exactly three cards. Is that secure?',
      [
        { label: 'Yes — a thorough shuffle is what matters', correct: false },
        { label: 'No — the cut has to be uniform over all five depths', correct: true },
        { label: 'Only if the players do not know the dealer’s habit', correct: false },
      ],
      'The cut is the only randomness the protocol uses, and a fixed cut of three is no randomness at all — the revealed row is then a fixed function of the two secrets, and both players can invert it. “The players do not know the habit” is security by obscurity: the analysis assumes the attacker knows the distribution, because eventually they will.',
    ),
    exitQuestion(
      'A new computer is built that is a trillion times faster than anything today. What happens to the five-card trick?',
      [
        { label: 'It needs more cards', correct: false },
        { label: 'Nothing at all', correct: true },
        { label: 'It stays secure but with a smaller margin', correct: false },
      ],
      'Nothing. The attacker is comparing two distributions that are equal, and speed does not help with that — there is no margin to shrink because there was never a margin, just an equality. This is what “information-theoretic” buys, and it is the reason people still study protocols that can only compute one gate.',
    ),
    exitQuestion(
      'A dealer cuts at random, but only ever by 0 or by 1. Bob holds 0 and sees ♥♠♥♠♥ on the table. What can he conclude?',
      [
        { label: 'Nothing — the cut was random', correct: false },
        { label: 'Alice held 0, with certainty', correct: true },
        { label: 'Alice probably held 1, but he cannot be sure', correct: false },
      ],
      'Alice’s two layouts are three cut positions apart, so cutting by 0 or 1 puts her 0 on two rows and her 1 on two entirely different ones. ♥♠♥♠♥ is in the first pair and nowhere in the second, so it can only have come from Alice holding 0 — certainty, not a lean. This is why “random” is the wrong word for the requirement: the cut has to cover all five depths uniformly, and a random cut over half of them covers none of the gap.',
    ),
    h('h3', {}, 'Match each claim to what actually supports it'),
    matchingTask({
      idPrefix: 'transfer-match',
      rows: [
        {
          threat: 'The answer is right no matter how the deck was cut',
          correct: 'The cut cannot change which cards are neighbours',
        },
        {
          threat: 'Bob learns nothing about Alice’s bit when he holds 0',
          correct: 'Three input pairs produce the same distribution of rows',
        },
        {
          threat: 'A faster computer does not help the attacker',
          correct: 'The distributions being compared are equal, not merely hard to tell apart',
        },
        {
          threat: 'A player who peeks at a face-down card wins',
          correct: 'Nothing in the protocol defends against this',
        },
      ],
      choices: [
        'The cut cannot change which cards are neighbours',
        'Three input pairs produce the same distribution of rows',
        'The distributions being compared are equal, not merely hard to tell apart',
        'Nothing in the protocol defends against this',
      ],
    }),
    note(
      'caveat',
      'Not production cryptography. This is a teaching demo of a 1989 protocol that computes a single AND gate for two people sitting at the same table. It proves nothing about your browser, your random number generator, or any system you might be tempted to build on it.',
    ),
  );
}
