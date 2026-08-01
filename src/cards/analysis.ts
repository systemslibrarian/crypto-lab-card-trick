/**
 * What the revealed row tells an adversary — computed exactly, never sampled.
 *
 * The state space is ten rows and five cuts, so every probability on this page is a
 * finite sum rather than a Monte Carlo estimate. That matters for honesty: the claim
 * "this leaks nothing" is only worth making if the zero is a real zero, and here it
 * is an enumerated one.
 *
 * Three quantities carry the whole story:
 *
 *   1. TOTAL VARIATION between the reveals that two different secrets produce. If it
 *      is 0 the two secrets are literally indistinguishable — no amount of computing
 *      power separates distributions that are equal.
 *   2. BEST-GUESS SUCCESS, which is 1/2 + TV/2 for two equally likely hypotheses.
 *      The standard restatement of (1) in a unit a learner can feel.
 *   3. EXCESS LEAKAGE in bits: I(inputs ; revealed row) − I(inputs ; output). The
 *      output itself is not a leak — it is what the players asked for — so the
 *      honest measure is what the cards say *beyond* it. Because the output is a
 *      deterministic function of the revealed row, this difference is exactly the
 *      conditional mutual information I(inputs ; row | output).
 *
 * Under a uniform cut all three are 0. They stop being 0 the moment the cut is not
 * uniform, which is the lesson `breakPanel` is built around.
 */

import { ALL_INPUTS, ALL_SHIFTS, type Bit, type Inputs, type Sequence } from './types.js';
import { cut, fromKey, layout, readOutput, toKey } from './protocol.js';
import { type CutWeights } from './shuffle.js';

/**
 * The ten legal rows, ordered by orbit: the five "separated" rows first (output 0),
 * then the five "adjacent" ones (output 1), each in cut order.
 *
 * The ordering is for the learner, not the maths — laid out this way, the
 * indistinguishability table shows three identical rows filling the same left block
 * and nothing at all on the right, which is the claim made visible.
 */
export const ROW_KEYS: readonly string[] = (() => {
  const separated = ALL_SHIFTS.map((s) => toKey(cut(fromKey('HSHSH') as Sequence, s)));
  const adjacent = ALL_SHIFTS.map((s) => toKey(cut(fromKey('SSHHH') as Sequence, s)));
  return [...separated, ...adjacent];
})();

export const ROW_INDEX: ReadonlyMap<string, number> = new Map(ROW_KEYS.map((k, i) => [k, i]));

/** A distribution over `ROW_KEYS`, index-aligned. */
export type RowDist = readonly number[];

/**
 * P[revealed row | these inputs], over the cut distribution.
 *
 * The five cuts of one layout land on five *distinct* rows (5 is prime and the row
 * is not constant, so no rotation fixes it), which is why each cut depth contributes
 * its whole weight to its own cell and nothing ever piles up.
 */
export function revealDist(inputs: Inputs, w: CutWeights): RowDist {
  const p = new Array(ROW_KEYS.length).fill(0);
  const base = layout(inputs);
  for (const s of ALL_SHIFTS) {
    const idx = ROW_INDEX.get(toKey(cut(base, s)));
    if (idx !== undefined) p[idx] += w[s];
  }
  return p;
}

/** Marginal over rows, for a uniform prior on the four input pairs. */
export function marginalRowDist(w: CutWeights): RowDist {
  const p = new Array(ROW_KEYS.length).fill(0);
  for (const x of ALL_INPUTS) {
    const d = revealDist(x, w);
    for (let i = 0; i < p.length; i++) p[i] += d[i] / ALL_INPUTS.length;
  }
  return p;
}

/**
 * Total variation distance: half the L1 gap, in [0, 1].
 *
 * 0 means the two distributions are the same object as far as any observer is
 * concerned; 1 means one look tells them apart with certainty.
 */
export function totalVariation(p: RowDist, q: RowDist): number {
  let sum = 0;
  for (let i = 0; i < p.length; i++) sum += Math.abs(p[i] - q[i]);
  return sum / 2;
}

/**
 * The best any strategy can do at telling two equally likely hypotheses apart.
 *
 * 1/2 + TV/2 — the optimal-distinguisher identity. Not an approximation and not a
 * measured win rate: it is the ceiling, so a demo that reports 50% here is reporting
 * that no strategy whatsoever beats a coin flip.
 */
export function guessSuccess(tv: number): number {
  return 0.5 + tv / 2;
}

/** Shannon entropy in bits. */
export function entropy(p: readonly number[]): number {
  let h = 0;
  for (const x of p) if (x > 0) h -= x * Math.log2(x);
  return h;
}

/**
 * I(inputs ; revealed row), in bits, under a uniform prior over the four input pairs.
 */
export function mutualInformationRow(w: CutWeights): number {
  const marginal = marginalRowDist(w);
  let mi = 0;
  for (const x of ALL_INPUTS) {
    const d = revealDist(x, w);
    for (let i = 0; i < d.length; i++) {
      if (d[i] > 0 && marginal[i] > 0) {
        mi += (d[i] / ALL_INPUTS.length) * Math.log2(d[i] / marginal[i]);
      }
    }
  }
  return mi;
}

/**
 * I(inputs ; output), in bits. Independent of the cut: the output survives every
 * cut, so this is just the entropy of AND on a uniform pair — H(1/4) ≈ 0.811 bits.
 */
export function mutualInformationOutput(): number {
  let ones = 0;
  for (const x of ALL_INPUTS) if (x.a === 1 && x.b === 1) ones++;
  const p1 = ones / ALL_INPUTS.length;
  return entropy([p1, 1 - p1]);
}

/**
 * The headline number: bits the cards give away *beyond* the answer they were dealt
 * to compute. Zero under a uniform cut; strictly positive otherwise.
 */
export function excessLeakageBits(w: CutWeights): number {
  const excess = mutualInformationRow(w) - mutualInformationOutput();
  // Clamp float dust: the identity guarantees this is non-negative, and printing
  // "-0.0000 bits" would look like a bug rather than a rounding artefact.
  return Math.abs(excess) < 1e-12 ? 0 : excess;
}

export interface PlayerLeak {
  /** The bit this player already holds. */
  readonly known: Bit;
  /** TV between the reveals produced by the opponent's two possible bits. */
  readonly tv: number;
  /** Best-case success at guessing the opponent's bit: 1/2 + TV/2. */
  readonly success: number;
  /** True when the output itself already determines the opponent's bit. */
  readonly forcedByOutput: boolean;
}

/**
 * What Bob can work out about Alice's bit, for each value of his own.
 *
 * The two cases are completely different in kind, and conflating them is the usual
 * way this protocol gets explained badly:
 *
 *   b = 1 — the output *is* a, so Bob learns Alice's bit. That is arithmetic, not a
 *           leak: anyone who computes an AND and holds a 1 learns the other input.
 *   b = 0 — the output is 0 whatever Alice did, so anything Bob works out here comes
 *           from the cards. Under a uniform cut it is nothing, exactly.
 *
 * Only the second row is a statement about the protocol, and it is the one the
 * break-it exhibit moves.
 */
export function bobLeak(w: CutWeights): readonly PlayerLeak[] {
  return ([0, 1] as const).map((b) => {
    const tv = totalVariation(revealDist({ a: 0, b }, w), revealDist({ a: 1, b }, w));
    return { known: b, tv, success: guessSuccess(tv), forcedByOutput: b === 1 };
  });
}

/** The mirror image: what Alice can work out about Bob's bit. */
export function aliceLeak(w: CutWeights): readonly PlayerLeak[] {
  return ([0, 1] as const).map((a) => {
    const tv = totalVariation(revealDist({ a, b: 0 }, w), revealDist({ a, b: 1 }, w));
    return { known: a, tv, success: guessSuccess(tv), forcedByOutput: a === 1 };
  });
}

/**
 * An onlooker who knows neither bit: how often can they name the input pair after
 * seeing the row, versus after hearing only the answer?
 *
 * Both are 1/2 under a uniform cut — the row buys the onlooker nothing over the
 * announcement. The gap between the two is the leak, in the same units a card player
 * would use.
 */
export function observerSuccess(w: CutWeights): { fromRow: number; fromOutput: number } {
  const prior = 1 / ALL_INPUTS.length;
  let fromRow = 0;
  for (let i = 0; i < ROW_KEYS.length; i++) {
    let best = 0;
    for (const x of ALL_INPUTS) best = Math.max(best, prior * revealDist(x, w)[i]);
    fromRow += best;
  }
  // Knowing only the output: name (1,1) when it is 1; when it is 0, any one of the
  // three pairs that produce 0 is as good as another.
  const groups = new Map<Bit, number>();
  for (const x of ALL_INPUTS) {
    const o: Bit = x.a === 1 && x.b === 1 ? 1 : 0;
    groups.set(o, (groups.get(o) ?? 0) + 1);
  }
  let fromOutput = 0;
  for (const [, count] of groups) fromOutput += prior * count * (1 / count);
  return { fromRow, fromOutput };
}

/** P[inputs | this revealed row], uniform prior. Returns null for an impossible row. */
export function posterior(rowKey: string, w: CutWeights): readonly number[] | null {
  const i = ROW_INDEX.get(rowKey);
  if (i === undefined) return null;
  const joint = ALL_INPUTS.map((x) => revealDist(x, w)[i] / ALL_INPUTS.length);
  const total = joint.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;
  return joint.map((v) => v / total);
}

export interface LeakReport {
  readonly weights: CutWeights;
  readonly excessBits: number;
  readonly bob: readonly PlayerLeak[];
  readonly alice: readonly PlayerLeak[];
  readonly observer: { fromRow: number; fromOutput: number };
  /** True when the cards say nothing at all beyond the answer. */
  readonly secure: boolean;
}

export function leakReport(w: CutWeights): LeakReport {
  const bob = bobLeak(w);
  const alice = aliceLeak(w);
  const excessBits = excessLeakageBits(w);
  return {
    weights: w,
    excessBits,
    bob,
    alice,
    observer: observerSuccess(w),
    // Every honest measure has to agree before this page prints "secure". The bits
    // and the guessing advantage are the same fact in two units, but they round
    // differently, and a demo that called something secure on the strength of one
    // rounded number would be teaching the wrong habit.
    secure:
      excessBits < 1e-12 &&
      bob.every((r) => r.forcedByOutput || r.tv < 1e-12) &&
      alice.every((r) => r.forcedByOutput || r.tv < 1e-12),
  };
}

/**
 * The four input pairs' reveal distributions, ready for the indistinguishability
 * table. Rows that produce the same output should be identical vectors — under a
 * uniform cut they are, and the table shows it cell by cell rather than claiming it.
 */
export function distributionTable(w: CutWeights): readonly {
  inputs: Inputs;
  output: Bit;
  dist: RowDist;
}[] {
  return ALL_INPUTS.map((inputs) => ({
    inputs,
    output: readOutput(layout(inputs)),
    dist: revealDist(inputs, w),
  }));
}

/**
 * Which cut depth would have produced this row from these inputs.
 *
 * The map is one-to-one, which is the fact the "your cut does not change the answer"
 * control depends on: the learner moves the cut and lands on a different row every
 * time, yet the read-off is unmoved.
 */
export function shiftFor(inputs: Inputs, rowKey: string): number | null {
  const base = layout(inputs);
  for (const s of ALL_SHIFTS) if (toKey(cut(base, s)) === rowKey) return s;
  return null;
}
