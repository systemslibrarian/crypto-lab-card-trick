/**
 * The cut — the one thing the five-card trick actually assumes.
 *
 * The protocol has no key and no hardness assumption. Its entire security rests on
 * the deck being cut by a *uniform* amount that neither player learns. Not "random":
 * uniform. `analysis.ts` shows that a cut which is random but lopsided leaks, and
 * that the leak vanishes only at exact uniformity — so this module keeps the
 * distribution as a first-class, editable object rather than burying it in a call to
 * `Math.random()`.
 *
 * HONEST SCOPING: nothing here is a physical shuffle. A browser cannot cut a deck.
 * `uniformShift` draws from the platform CSPRNG, which is a stand-in for a dealer
 * whose cut nobody can follow — and, unlike a real dealer, this page knows the
 * answer it drew. The exhibit says so on screen and offers to keep it hidden.
 */

import { type Shift } from './types.js';

/** A distribution over the five possible cuts. Index = cut depth. */
export type CutWeights = readonly [number, number, number, number, number];

/** Bytes from somewhere. Injectable so the sampler's edge cases are actually testable. */
export type ByteSource = (n: number) => Uint8Array;

export const UNIFORM_CUT: CutWeights = [0.2, 0.2, 0.2, 0.2, 0.2];

export interface CutPreset {
  readonly id: string;
  readonly label: string;
  /** What a learner should picture a dealer doing. */
  readonly story: string;
  readonly weights: CutWeights;
}

/**
 * The presets are ordered from "correct" to "worst", and every one of them is a
 * plausible mistake rather than a strawman: a dealer who forgets to cut, a dealer
 * who only ever takes a card or two off the top, a dealer who covers four of the
 * five depths, and a human asked to "be random" — who never is.
 */
export const CUT_PRESETS: readonly CutPreset[] = [
  {
    id: 'uniform',
    label: 'Uniform cut (correct)',
    story: 'Every one of the five cut depths is equally likely, and nobody sees which.',
    weights: UNIFORM_CUT,
  },
  {
    id: 'almost',
    label: 'Almost uniform — four depths',
    story: 'A dealer who never cuts all the way round: depths 0–3 only, evenly.',
    weights: [0.25, 0.25, 0.25, 0.25, 0],
  },
  {
    id: 'human',
    label: 'A human trying to be random',
    story: 'People asked to pick "randomly" favour small numbers. This is what that looks like.',
    weights: [0.4, 0.25, 0.15, 0.12, 0.08],
  },
  {
    id: 'lazy',
    label: 'Lazy dealer — cuts 0 or 1',
    story: 'The cut is real, and it is random, and it is nowhere near uniform.',
    weights: [0.5, 0.5, 0, 0, 0],
  },
  {
    id: 'none',
    label: 'No cut at all',
    story: 'The cards are simply turned over where they lie.',
    weights: [1, 0, 0, 0, 0],
  },
];

export function presetById(id: string): CutPreset {
  return CUT_PRESETS.find((p) => p.id === id) ?? CUT_PRESETS[0];
}

/**
 * Scale five non-negative numbers to a distribution.
 *
 * The UI hands over slider positions, which are integers that can all be zero while
 * the learner is dragging. An all-zero vector is not a distribution, and quietly
 * returning uniform there would show a "no leak" result for a state the learner
 * never chose — so it is rejected and the caller keeps the previous distribution.
 */
export function normalise(raw: readonly number[]): CutWeights | null {
  if (raw.length !== 5 || raw.some((x) => !Number.isFinite(x) || x < 0)) return null;
  const total = raw.reduce((s, x) => s + x, 0);
  if (total <= 0) return null;
  return [raw[0] / total, raw[1] / total, raw[2] / total, raw[3] / total, raw[4] / total];
}

/** Exact uniformity, to within floating-point slop. The leak vanishes only here. */
export function isUniform(w: CutWeights, tol = 1e-12): boolean {
  return w.every((x) => Math.abs(x - 0.2) <= tol);
}

/** Real randomness from the platform CSPRNG. */
export const cryptoBytes: ByteSource = (n) => crypto.getRandomValues(new Uint8Array(n));

/**
 * A uniform cut in Z5, by rejection sampling.
 *
 * `byte % 5` would be biased: 256 is not a multiple of 5, so depths 0 and 1 would
 * come up 52 times per 256 draws and depths 2–4 only 51. The bias is tiny and it is
 * still a bias — and this lab's entire point is that a cut which is *almost* uniform
 * leaks. Discarding the 6 values at or above 250 makes the remaining range an exact
 * multiple of 5, so the result is uniform rather than nearly so.
 */
export function uniformShift(bytes: ByteSource = cryptoBytes): Shift {
  // Each attempt draws a fresh batch; the probability of needing more than a few is
  // (6/256)^k, so the loop bound is generosity rather than a real limit.
  for (let attempt = 0; attempt < 64; attempt++) {
    for (const b of bytes(8)) {
      if (b < 250) return (b % 5) as Shift;
    }
  }
  // 512 consecutive bytes >= 250 means the byte source is broken, not unlucky.
  throw new Error('uniformShift: byte source is not producing usable values');
}

/**
 * A cut drawn from an arbitrary distribution — the deliberately-broken dealers.
 *
 * Four bytes give a uniform value in [0, 1), which then indexes the cumulative
 * weights. Kept separate from `uniformShift` so the correct path stays the simple,
 * obviously-unbiased one and never inherits this function's rounding.
 */
export function weightedShift(w: CutWeights, bytes: ByteSource = cryptoBytes): Shift {
  const b = bytes(4);
  const u = ((b[0] << 24) >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3];
  const x = u / 2 ** 32;
  let acc = 0;
  for (let s = 0; s < 5; s++) {
    acc += w[s];
    if (x < acc) return s as Shift;
  }
  // Only reachable if the weights sum to slightly under 1 through rounding; fall
  // back to the last depth that carries any weight rather than to depth 0, which
  // would silently bias every distribution toward "no cut".
  for (let s = 4; s >= 0; s--) if (w[s] > 0) return s as Shift;
  throw new Error('weightedShift: weights carry no probability');
}

/** Draw from whichever sampler the distribution deserves. */
export function drawShift(w: CutWeights, bytes: ByteSource = cryptoBytes): Shift {
  return isUniform(w) ? uniformShift(bytes) : weightedShift(w, bytes);
}
