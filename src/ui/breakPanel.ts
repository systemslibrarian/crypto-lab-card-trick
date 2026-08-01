/**
 * Exhibit 4 — break it yourself, by breaking the shuffle.
 *
 * The five-card trick has exactly one assumption, so there is exactly one thing to
 * attack. The learner edits the cut distribution and everything downstream recomputes
 * against the same code the "secure" exhibit used — nothing is special-cased for the
 * broken modes.
 *
 * The exhibit is staged rather than dumped: first *how often Bob wins*, then *which
 * rows became his evidence*, and only then the mutual information and the bystander,
 * behind a disclosure. Four summary statistics arriving at once tell a learner that
 * something got worse; a card row labelled "see this and Alice held 1" tells them why.
 *
 * The surprise it is built around: "random" is not the requirement. A dealer who
 * genuinely cuts at random, but only ever by 0 or 1, hands Alice's bit over in full.
 */

import { type Bit, type Inputs, type Shift } from '../cards/types.js';
import {
  ROW_KEYS,
  aliceLeak,
  bobLeak,
  distributionTable,
  evidenceRows,
  excessLeakageBits,
  observerSuccess,
} from '../cards/analysis.js';
import {
  CUT_PRESETS,
  type CutWeights,
  UNIFORM_CUT,
  drawShift,
  isUniform,
  normalise,
} from '../cards/shuffle.js';
import { fromKey, run, toKey } from '../cards/protocol.js';
import { rowEl } from './cards.js';
import {
  bridge,
  clear,
  code,
  disclosure,
  h,
  note,
  panelIntro,
  prediction,
  predictionDebrief,
  scrollRegion,
  statTile,
  verdict,
} from './dom.js';

interface State {
  /** Slider positions, 0–10 each. Normalised to a distribution on read. */
  raw: number[];
  weights: CutWeights;
  presetId: string;
}

const state: State = {
  raw: [2, 2, 2, 2, 2],
  weights: UNIFORM_CUT,
  presetId: 'uniform',
};

/** The guessing game's tally, kept out of `state` because changing the cut should not clear the score. */
interface Tally {
  rounds: number;
  correct: number;
  pending: { alice: Bit; shift: Shift; rowKey: string } | null;
}

const tally: Tally = { rounds: 0, correct: 0, pending: null };

export function renderBreakPanel(root: HTMLElement): void {
  const headline = h('div', { class: 'headline-host' });
  const evidence = h('div', { class: 'evidence-host' });
  const detail = h('div', { class: 'detail-host' });
  const game = h('div', { class: 'guess-host' });

  const repaint = (): void => {
    paintHeadline(headline);
    paintEvidence(evidence);
    paintDetail(detail);
    paintGame(game, repaint);
  };

  // Changing the dealer mid-round would leave a row on the table that was dealt under
  // a distribution the page no longer shows. Fold the round instead of explaining it.
  const onCutChanged = (): void => {
    tally.pending = null;
    repaint();
  };

  root.replaceChildren(
    panelIntro(
      'Break it yourself: make the dealer sloppy',
      'Everything the last exhibit established rested on one word — the cut has to be uniform. Not merely random. Uniform.',
    ),
    prediction(
      'lazy-dealer',
      'A dealer cuts by a genuinely random amount — but, being lazy, only ever by 0 or by 1, each half the time. How much does that give away about Alice’s bit?',
      [
        { label: 'Nothing — it is still random', correct: false },
        { label: 'A little — Bob gets a slight edge', correct: false },
        { label: 'Everything — Bob reads Alice’s bit off the table', correct: true },
      ],
    ),
    controls(onCutChanged),
    headline,
    evidence,
    predictionDebrief(
      'lazy-dealer',
      'Cutting by 0 or 1 is random, and it is useless. Alice’s two possible layouts sit three cut positions apart, so “cut by 0 or 1” puts her 0 on two rows and her 1 on two completely different rows. The supports do not overlap at all, and one look settles it. Randomness was never the requirement; covering the whole group uniformly was.',
    ),
    game,
    detail,
    derivation(),
    note(
      'caveat',
      'What this exhibit is and is not: it attacks the shuffle, which is the protocol’s stated assumption, and it does so with exact arithmetic over the whole state space. It does not model a player who peeks at a face-down card, a marked deck, a player who lies about which bit they encoded, or a shuffle whose depths are correlated between rounds. Those are all real attacks on a real card protocol and none of them is here.',
    ),
    bridge(
      'The protocol is secure exactly when the cut is uniform, and the failure is total rather than gradual — a “nearly right” dealer is not nearly secure.',
      'If the security is this brittle in the physical world, why does anyone care? What does it buy that a computer protocol cannot?',
      {
        label: 'Compare it with how computers do this →',
        onClick: () => document.getElementById('tab-compare')?.click(),
      },
    ),
  );

  repaint();
}

// ------------------------------------------------------------------ controls

function controls(repaint: () => void): HTMLElement {
  const sliders: HTMLInputElement[] = [];
  const values: HTMLElement[] = [];

  const sync = (): void => {
    const next = normalise(state.raw);
    // An all-zero vector keeps the previous distribution rather than silently becoming
    // uniform, so the page never shows a "secure" verdict for a state nobody chose.
    if (next) state.weights = next;
    state.raw.forEach((v, i) => {
      values[i].textContent = `${(state.weights[i] * 100).toFixed(0)}%`;
      sliders[i].value = String(v);
    });
    for (const b of presetButtons) {
      b.setAttribute('aria-pressed', String(b.dataset.preset === state.presetId));
    }
    paintStory();
    repaint();
  };

  for (let i = 0; i < 5; i++) {
    const id = `cut-weight-${i}`;
    const value = h('span', { class: 'range-value' }, '20%');
    const input = h('input', {
      type: 'range',
      id,
      min: '0',
      max: '10',
      step: '1',
      value: String(state.raw[i]),
    }) as HTMLInputElement;
    input.addEventListener('input', () => {
      state.raw[i] = Number(input.value);
      state.presetId = 'custom';
      sync();
    });
    sliders.push(input);
    values.push(value);
  }

  const presetButtons = CUT_PRESETS.map(
    (p) =>
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-ghost preset-btn',
          'data-preset': p.id,
          'aria-pressed': String(state.presetId === p.id),
          onclick: () => {
            state.presetId = p.id;
            // Slider positions are integers, so scale the preset onto the 0–10 range
            // and keep the exact weights for the maths rather than the rounded ones.
            state.raw = p.weights.map((x) => Math.round(x * 10));
            state.weights = p.weights;
            state.raw.forEach((v, i) => {
              sliders[i].value = String(v);
              values[i].textContent = `${(p.weights[i] * 100).toFixed(0)}%`;
            });
            for (const b of presetButtons) {
              b.setAttribute('aria-pressed', String(b.dataset.preset === p.id));
            }
            paintStory();
            repaint();
          },
        },
        p.label,
      ) as HTMLButtonElement,
  );

  const story = h('p', { class: 'help', role: 'status', 'aria-live': 'polite' });
  const paintStory = (): void => {
    const p = CUT_PRESETS.find((q) => q.id === state.presetId);
    story.textContent = p ? p.story : 'A distribution of your own. Every number below follows it.';
  };
  paintStory();

  return h(
    'div',
    { class: 'controls' },
    h(
      'div',
      { class: 'control' },
      h('span', { class: 'control-label', id: 'preset-label' }, 'Start from a dealer'),
      h(
        'div',
        { class: 'preset-row', role: 'group', 'aria-labelledby': 'preset-label' },
        ...presetButtons,
      ),
      story,
    ),
    h(
      'div',
      { class: 'control' },
      h('span', { class: 'control-label' }, 'How often the dealer cuts by each amount'),
      h(
        'div',
        { class: 'weight-grid' },
        ...sliders.map((input, i) =>
          h(
            'div',
            { class: 'weight-row' },
            h('label', { for: `cut-weight-${i}` }, `cut ${i}`),
            input,
            values[i],
          ),
        ),
      ),
      h(
        'p',
        { class: 'help' },
        'Drag any slider and the whole page follows. Setting every slider to the same value — whatever that value is — is the only configuration that comes out clean.',
      ),
    ),
  );
}

// ------------------------------------------------------- 1. does Bob win?

function paintHeadline(host: HTMLElement): void {
  const w = state.weights;
  const bob = bobLeak(w).find((l) => l.known === 0)!;
  const clean = isUniform(w) && bob.tv === 0;
  const uniformBob = bobLeak(UNIFORM_CUT).find((l) => l.known === 0)!;

  const column = (
    title: string,
    sub: string,
    success: number,
    identical: boolean,
    live: boolean,
  ): HTMLElement =>
    h(
      'div',
      { class: `dealer-col ${live ? 'dealer-col-live' : 'dealer-col-ref'}` },
      h('h4', {}, title),
      h('span', { class: 'dealer-sub' }, sub),
      h('span', { class: 'dealer-figure' }, `${(success * 100).toFixed(1)}%`),
      h('span', { class: 'dealer-figure-label' }, 'Bob guesses Alice’s bit'),
      h(
        'span',
        { class: `pill pill-${identical ? 'ok' : 'bad'}` },
        h('span', { 'aria-hidden': 'true' }, identical ? '✓' : '✕'),
        identical ? 'the three answer-0 rows match' : 'the three answer-0 rows differ',
      ),
    );

  clear(host);
  host.append(
    h(
      'section',
      { class: `aha ${clean ? 'readout-clean' : 'readout-broken'}` },
      h('h3', {}, 'Does Bob win?'),
      h(
        'p',
        { class: 'panel-sub' },
        'Bob holds 0, so the answer is 0 whatever Alice did and tells him nothing. Anything he works out comes from the row on the table. The left column is the protocol as designed; the right is your dealer.',
      ),
      h(
        'div',
        { class: 'dealer-compare' },
        column(
          'Uniform dealer',
          'the protocol as designed',
          uniformBob.success,
          true,
          false,
        ),
        h('div', { class: 'dealer-vs', 'aria-hidden': 'true' }, 'vs'),
        column(
          isUniform(w) ? 'Your dealer (also uniform)' : 'Your dealer',
          state.presetId === 'custom' ? 'the distribution you built' : 'the preset you chose',
          bob.success,
          bob.tv === 0,
          true,
        ),
      ),
      clean
        ? verdict(
            'pass',
            'a coin flip is as good as any attack — the cards say nothing the answer did not',
            'No leak',
          )
        : verdict(
            'alarm',
            `Bob does better than chance at reading Alice’s secret off the table: ${(bob.success * 100).toFixed(1)}% against 50%`,
            'Leaking',
          ),
      isUniform(w)
        ? null
        : h(
            'p',
            { class: 'help' },
            'Note that the protocol still computes the right answer. Correctness never depended on the cut — only privacy did, which is exactly why this failure is the kind that goes unnoticed.',
          ),
    ),
  );
}

// --------------------------------------------- 2. which rows became evidence?

function paintEvidence(host: HTMLElement): void {
  const rows = evidenceRows(state.weights);
  const tells = rows.filter((r) => r.points !== null);

  clear(host);
  host.append(
    h(
      'section',
      { class: 'break-it' },
      h('h3', {}, 'Which rows became the evidence'),
      h(
        'p',
        { class: 'panel-sub' },
        tells.length === 0
          ? 'None of them. Every row Bob can see happens exactly as often whether Alice held 0 or 1, so there is no row he can point at and no test he can run.'
          : `${tells.length} of the ${rows.length} rows Bob can see happen more often under one of Alice’s bits than the other. Those are the rows he watches for.`,
      ),
      h(
        'div',
        { class: 'evidence-grid' },
        ...rows.map((r) => {
          const seq = fromKey(r.key);
          const tone = r.points === null ? 'even' : r.exclusive ? 'proof' : 'hint';
          return h(
            'div',
            { class: `evidence-card evidence-${tone}` },
            seq
              ? rowEl(seq, { markSpades: true, ariaLabel: `The revealed row ${r.key}` })
              : null,
            h(
              'p',
              { class: 'evidence-verdict' },
              r.points === null
                ? h('span', {}, h('span', { 'aria-hidden': 'true' }, '= '), 'equally likely either way — no information')
                : r.exclusive
                  ? h(
                      'span',
                      {},
                      h('span', { 'aria-hidden': 'true' }, '! '),
                      h('strong', {}, `only Alice’s ${r.points} can produce this row`),
                    )
                  : h(
                      'span',
                      {},
                      h('span', { 'aria-hidden': 'true' }, '› '),
                      `leans towards Alice holding ${r.points}`,
                    ),
            ),
            h(
              'p',
              { class: 'evidence-nums' },
              `if a=0: ${(r.ifZero * 100).toFixed(0)}% · if a=1: ${(r.ifOne * 100).toFixed(0)}%`,
            ),
          );
        }),
      ),
      tells.length === 0
        ? verdict('pass', 'no row on the table distinguishes Alice’s two secrets', 'Nothing to read')
        : verdict(
            'alarm',
            `${rows.filter((r) => r.exclusive).length} of these rows settle Alice’s bit outright; the rest tilt the odds`,
            'Readable',
          ),
    ),
  );
}

// ----------------------------------- 3. the rest of the numbers, on request

function paintDetail(host: HTMLElement): void {
  const w = state.weights;
  const bits = excessLeakageBits(w);
  const alice = aliceLeak(w).find((l) => l.known === 0)!;
  const obs = observerSuccess(w);
  const table = distributionTable(w);
  const zeros = table.filter((r) => r.output === 0);
  const identical = zeros.every((r) => r.dist.every((p, i) => Math.abs(p - zeros[0].dist[i]) < 1e-12));

  clear(host);
  host.append(
    disclosure(
      'More detail — leakage in bits, the bystander, and the full table',
      h(
        'div',
        { class: 'stat-row' },
        statTile(
          'Leaked beyond the answer',
          `${bits.toFixed(3)} bits`,
          `out of the ${(2 - 0.8112781244591328).toFixed(3)} bits the answer left unsaid`,
          bits === 0 ? 'ok' : 'alarm',
        ),
        statTile(
          'Alice guesses Bob’s bit',
          `${(alice.success * 100).toFixed(1)}%`,
          'the flaw is not one-sided',
          alice.tv === 0 ? 'ok' : 'alarm',
        ),
        statTile(
          'A bystander names both secrets',
          `${(obs.fromRow * 100).toFixed(0)}%`,
          `versus ${(obs.fromOutput * 100).toFixed(0)}% from hearing the answer alone`,
          obs.fromRow > obs.fromOutput + 1e-12 ? 'alarm' : 'ok',
        ),
      ),
      scrollRegion(
        'Probability of each revealed row given each pair of secrets, under the chosen cut',
        h(
          'table',
          { class: 'kat-table prob-table' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', { scope: 'col' }, 'Secrets'),
              h('th', { scope: 'col' }, 'Answer'),
              ...ROW_KEYS.map((k) => h('th', { scope: 'col', class: 'kat-col-row' }, code(k))),
            ),
          ),
          h(
            'tbody',
            {},
            ...table.map((r) =>
              h(
                'tr',
                { class: r.output === 1 ? 'kat-row-one' : undefined },
                h('th', { scope: 'row' }, `a=${r.inputs.a}, b=${r.inputs.b}`),
                h('td', {}, String(r.output)),
                ...r.dist.map((p) =>
                  h(
                    'td',
                    { class: `prob-cell ${p > 0 ? 'prob-on' : 'prob-off'}` },
                    p > 0
                      ? `${(p * 100).toFixed(0)}%`
                      : h('span', {}, h('span', { 'aria-hidden': 'true' }, '·'), srSpan('never')),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      identical
        ? verdict('pass', 'the three answer-0 rows are identical cell for cell', 'Indistinguishable')
        : verdict(
            'alarm',
            'the three answer-0 rows differ — a row that one pair of secrets can produce and another cannot is a test Bob can run',
            'Separable',
          ),
    ),
  );
}

const srSpan = (text: string): HTMLElement => h('span', { class: 'sr-only' }, text);

// ------------------------------------------------------------ the derivation

function derivation(): HTMLElement {
  return disclosure(
    'Why the answer is exactly “uniform, or else” — the derivation',
    h(
      'p',
      {},
      'Alice’s layout for 0 and her layout for 1 are the same ring, rotated by three positions. So the rows Bob sees when she holds 1 are distributed as the cut-weight vector shifted by three, and the rows he sees when she holds 0 are distributed as the cut-weight vector itself. Writing ρ for "rotate by one":',
    ),
    h(
      'div',
      { class: 'formula', role: 'math', 'aria-label': 'T V of w and rho cubed w equals one half times the sum over i from 0 to 4 of the absolute value of w sub i minus w sub i minus 3' },
      h('span', { 'aria-hidden': 'true' }, 'TV(w, ρ³w)  =  ½ · Σ',
        h('sub', {}, 'i=0..4'),
        ' | w',
        h('sub', {}, 'i'),
        ' − w',
        h('sub', {}, 'i−3'),
        ' |'),
    ),
    h(
      'p',
      {},
      'That is zero exactly when w is unchanged by a rotation of three. And 3 generates the whole group Z5 — 3, 6≡1, 9≡4, 12≡2, 15≡0 — so a distribution invariant under rotation-by-three is invariant under every rotation, which forces all five weights to be equal.',
    ),
    h(
      'p',
      {},
      'So uniform works and ',
      h('em', {}, 'nothing else does'),
      '. The sliders cannot find a counterexample because there is none to find, and ',
      code('analysis.test.ts'),
      ' asserts exactly this closed form against the enumerated distributions, plus 200 randomised weight vectors that are zero only when uniform.',
    ),
    h(
      'p',
      {},
      h('strong', {}, 'On the numbers you are reading: '),
      'the protocol states, the ten rows and the twenty known answers are discrete and exact. The probabilities and the bits above are IEEE-754 floating point, and the page treats magnitudes below 1e-12 as zero so that display noise never reads as a leak. That tolerance is a presentation detail — it is not a security parameter, and the protocol has none.',
    ),
  );
}

// ------------------------------------------------------------- the guessing game

/**
 * Play Bob against the real thing.
 *
 * The numbers above are the *ceiling*; this is what the ceiling feels like. Alice's
 * bit is drawn fresh each round, the cut is drawn from the learner's own distribution,
 * and only the revealed row is shown. Under a uniform cut the running score wanders
 * around 50% no matter how carefully anyone plays — which is a far more convincing
 * demonstration of "there is nothing to learn" than the word "zero".
 */
function paintGame(host: HTMLElement, repaint: () => void): void {
  const out = h('div', { class: 'guess-out', role: 'status', 'aria-live': 'polite' });

  const deal = (): void => {
    const alice = (crypto.getRandomValues(new Uint8Array(1))[0] & 1) as Bit;
    const inputs: Inputs = { a: alice, b: 0 };
    const shift = drawShift(state.weights);
    tally.pending = { alice, shift, rowKey: toKey(run(inputs, shift).revealed) };
    paintRound();
  };

  const guess = (bit: Bit): void => {
    if (!tally.pending) return;
    const truth = tally.pending.alice;
    const shift = tally.pending.shift;
    tally.rounds++;
    if (truth === bit) tally.correct++;
    const wasRight = truth === bit;
    tally.pending = null;
    paintRound(
      h(
        'div',
        { class: 'guess-verdict' },
        h(
          'span',
          { class: `pill pill-${wasRight ? 'ok' : 'bad'}` },
          h('span', { 'aria-hidden': 'true' }, wasRight ? '✓' : '✕'),
          wasRight ? 'Right' : 'Wrong',
        ),
        h(
          'span',
          {},
          ` Alice was holding ${truth}; the dealer cut by ${shift}. Running score: ${tally.correct} of ${tally.rounds} — ${((tally.correct / tally.rounds) * 100).toFixed(0)}%.`,
        ),
      ),
    );
  };

  const paintRound = (verdictEl?: HTMLElement): void => {
    clear(out);
    if (verdictEl) out.append(verdictEl);
    if (tally.pending) {
      const seq = fromKey(tally.pending.rowKey);
      out.append(
        h(
          'p',
          { class: 'help' },
          'The dealer has cut and turned the cards over. You hold 0. Alice’s bit is either 0 or 1, each equally likely. Call it.',
        ),
        h(
          'div',
          {},
          seq
            ? rowEl(seq, { markSpades: true, ariaLabel: `The revealed row is ${tally.pending.rowKey}` })
            : null,
        ),
        h(
          'div',
          { class: 'action-row', role: 'group', 'aria-label': 'Guess Alice’s bit' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => guess(0) }, 'Alice held 0'),
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => guess(1) }, 'Alice held 1'),
        ),
      );
    } else {
      out.append(
        h(
          'div',
          { class: 'action-row' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: deal }, 'Deal a round'),
          tally.rounds > 0
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'btn btn-ghost',
                  onclick: () => {
                    tally.rounds = 0;
                    tally.correct = 0;
                    repaint();
                  },
                },
                'Reset the score',
              )
            : null,
        ),
      );
      if (tally.rounds > 0) {
        out.append(
          h(
            'p',
            { class: 'help' },
            `${tally.correct} correct out of ${tally.rounds} — ${((tally.correct / tally.rounds) * 100).toFixed(0)}%. The ceiling for this dealer is ${(bobLeak(state.weights).find((l) => l.known === 0)!.success * 100).toFixed(1)}%.`,
          ),
        );
      }
    }
  };

  clear(host);
  host.append(
    h(
      'section',
      { class: 'break-it' },
      h('h3', {}, 'Play Bob'),
      h(
        'p',
        { class: 'panel-sub' },
        'You are holding 0, so the answer will be 0 whatever Alice does and tells you nothing. All you get is the row on the table. Guess her bit, round after round, and watch your score against the ceiling.',
      ),
      out,
      h(
        'p',
        { class: 'help' },
        'Under a uniform cut you are playing a coin-flipping game with extra steps — no run of good guesses is skill, and no strategy exists that would make it skill. Switch the dealer to “no cut” and the same game becomes trivial.',
      ),
    ),
  );
  paintRound();
}

// [extension] point — an OR gate is this same layout with both players negating and
// the read-off inverted (De Morgan), and XOR needs a different shuffle rather than a
// different layout. Both would slot in as alternative `layout`/read-off pairs in
// protocol.ts; every number in this panel is computed from those two functions and
// would follow automatically.
