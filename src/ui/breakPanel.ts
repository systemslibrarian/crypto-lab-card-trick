/**
 * Exhibit 4 — break it yourself, by breaking the shuffle.
 *
 * The five-card trick has exactly one assumption, so there is exactly one thing to
 * attack. The learner edits the cut distribution, and everything downstream — the
 * indistinguishability table, Bob's optimal guess, the leakage in bits — recomputes
 * against the same code the "secure" exhibit used. Nothing is special-cased for the
 * broken modes: the difference between a protocol that leaks and one that does not is
 * five numbers in a vector.
 *
 * The surprise this is built around: "random" is not the requirement. A dealer who
 * genuinely cuts at random, but only ever by 0 or 1, hands Alice's bit over in full.
 */

import { type Bit, type Inputs, type Shift } from '../cards/types.js';
import {
  ROW_KEYS,
  aliceLeak,
  bobLeak,
  distributionTable,
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

/** The guessing game's tally, kept out of `state` because "reset the cut" should not clear it. */
interface Tally {
  rounds: number;
  correct: number;
  /** The round in play: Alice's hidden bit and what the attacker sees. */
  pending: { alice: Bit; shift: Shift; rowKey: string } | null;
}

const tally: Tally = { rounds: 0, correct: 0, pending: null };

export function renderBreakPanel(root: HTMLElement): void {
  const readout = h('div', { class: 'break-out' });
  const table = h('div', { class: 'leak-table-host' });
  const game = h('div', { class: 'guess-host' });

  const repaint = (): void => {
    paintReadout(readout);
    paintTable(table);
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
      'Everything the previous exhibit established rested on one word — the cut has to be uniform. Not merely random. Uniform.',
      'Below you can set how often the dealer cuts by each amount. Every number on this page then recomputes from the same functions that produced the zeros next door. Find out how little it takes.',
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
    readout,
    predictionDebrief(
      'lazy-dealer',
      'Cutting by 0 or 1 is random, and it is useless. Alice’s two possible layouts sit three cut positions apart, so “cut by 0 or 1” puts her 0 on two rows and her 1 on two completely different rows. The supports do not overlap at all, and one look settles it. Randomness was never the requirement; covering the whole group uniformly was.',
    ),
    table,
    game,
    disclosure(
      'Why the answer is exactly “uniform, or else”',
      h(
        'p',
        {},
        'Alice’s layout for 0 and her layout for 1 are the same ring, rotated by three positions. So the rows Bob sees when she holds 1 are distributed as the cut distribution shifted by three, and the rows he sees when she holds 0 are distributed as the cut distribution itself.',
      ),
      h(
        'p',
        {},
        'They are indistinguishable exactly when those two are equal — that is, when the cut distribution is unchanged by a rotation of three. And 3 generates the whole group Z5, so a distribution invariant under rotation-by-three is invariant under every rotation, which forces all five weights to be equal.',
      ),
      h(
        'p',
        {},
        'That is the sharp statement: uniform works, and ',
        h('em', {}, 'nothing else does'),
        '. The slider experiment above cannot find a counterexample because there is none to find.',
      ),
    ),
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
    if (next) state.weights = next;
    // An all-zero vector keeps the previous distribution rather than silently
    // becoming uniform, so the page never shows a "secure" verdict for a state the
    // learner did not choose.
    state.raw.forEach((v, i) => {
      values[i].textContent = `${(state.weights[i] * 100).toFixed(0)}%`;
      sliders[i].value = String(v);
    });
    for (const b of presetButtons) {
      b.setAttribute('aria-pressed', String(b.dataset.preset === state.presetId));
    }
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
  for (const b of presetButtons) b.addEventListener('click', paintStory);
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

// ------------------------------------------------------------------ readout

function paintReadout(host: HTMLElement): void {
  const w = state.weights;
  const bits = excessLeakageBits(w);
  const bob = bobLeak(w).find((l) => l.known === 0)!;
  const alice = aliceLeak(w).find((l) => l.known === 0)!;
  const obs = observerSuccess(w);
  const clean = isUniform(w) && bits === 0 && bob.tv === 0;

  clear(host);
  host.append(
    h(
      'section',
      { class: `aha ${clean ? 'aha-clean' : 'aha-broken'}` },
      h('h3', {}, 'What this dealer costs you'),
      h(
        'div',
        { class: 'stat-row' },
        statTile(
          'Bob guesses Alice’s bit',
          `${(bob.success * 100).toFixed(1)}%`,
          'best possible strategy, when Bob holds 0',
          bob.tv === 0 ? 'ok' : 'alarm',
        ),
        statTile(
          'Alice guesses Bob’s bit',
          `${(alice.success * 100).toFixed(1)}%`,
          'best possible strategy, when Alice holds 0',
          alice.tv === 0 ? 'ok' : 'alarm',
        ),
        statTile(
          'Leaked beyond the answer',
          `${bits.toFixed(3)} bits`,
          `out of the ${(2 - 0.8112781244591328).toFixed(3)} bits the answer left unsaid`,
          bits === 0 ? 'ok' : 'alarm',
        ),
        statTile(
          'A bystander names both secrets',
          `${(obs.fromRow * 100).toFixed(0)}%`,
          `versus ${(obs.fromOutput * 100).toFixed(0)}% from hearing the answer alone`,
          obs.fromRow > obs.fromOutput + 1e-12 ? 'alarm' : 'ok',
        ),
      ),
      clean
        ? verdict(
            'pass',
            'the cards say nothing the answer did not already say — a coin flip is as good as any attack',
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

// ---------------------------------------------------- the table, recomputed live

function paintTable(host: HTMLElement): void {
  const table = distributionTable(state.weights);
  const zeros = table.filter((r) => r.output === 0);
  const identical = zeros.every((r) =>
    r.dist.every((p, i) => Math.abs(p - zeros[0].dist[i]) < 1e-12),
  );

  clear(host);
  host.append(
    h(
      'section',
      { class: 'kat-group' },
      h('h3', {}, 'The same table as next door, under your dealer'),
      h(
        'p',
        { class: 'panel-sub' },
        'The three rows with answer 0 are the ones to watch. While they stay identical, Bob has nothing to work with. The moment they differ anywhere, he has a test.',
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

// ------------------------------------------------------------- the guessing game

/**
 * Play Bob against the real thing.
 *
 * The numbers above are the *ceiling*; this is what the ceiling feels like. Alice's
 * bit is drawn fresh each round, the cut is drawn from the learner's own
 * distribution, and only the revealed row is shown. Under a uniform cut the running
 * score wanders around 50% no matter how carefully anyone plays — which is a far more
 * convincing demonstration of "there is nothing to learn" than the word "zero".
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
    tally.rounds++;
    if (truth === bit) tally.correct++;
    const wasRight = truth === bit;
    const shift = tally.pending.shift;
    tally.pending = null;
    paintRound(
      h(
        'div',
        { class: 'guess-verdict' },
        h(
          'span',
          { class: `pill pill-${wasRight ? 'ok' : 'bad'}` },
          h('span', { 'aria-hidden': 'true' }, wasRight ? '✓ ' : '✕ '),
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
        h('p', { class: 'help' }, 'The dealer has cut and turned the cards over. You hold 0. Alice’s bit is either 0 or 1, each equally likely. Call it.'),
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
