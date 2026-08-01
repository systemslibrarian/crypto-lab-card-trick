import { describe, expect, it } from 'vitest';
import {
  ROW_KEYS,
  aliceLeak,
  bobLeak,
  distributionTable,
  entropy,
  evidenceRows,
  excessLeakageBits,
  guessSuccess,
  leakReport,
  marginalRowDist,
  mutualInformationOutput,
  mutualInformationRow,
  observerSuccess,
  posterior,
  revealDist,
  shiftFor,
  totalVariation,
} from './analysis.js';
import { type CutWeights, UNIFORM_CUT, normalise } from './shuffle.js';
import { ALL_INPUTS, ALL_SHIFTS } from './types.js';
import { layout, toKey } from './protocol.js';

const NO_CUT: CutWeights = [1, 0, 0, 0, 0];
const LAZY: CutWeights = [0.5, 0.5, 0, 0, 0];
const ALMOST: CutWeights = [0.25, 0.25, 0.25, 0.25, 0];

describe('the row space', () => {
  it('has all ten legal rows, no duplicates', () => {
    expect(ROW_KEYS).toHaveLength(10);
    expect(new Set(ROW_KEYS).size).toBe(10);
  });

  it('lists the five output-0 rows first, then the five output-1 rows', () => {
    expect(ROW_KEYS.slice(0, 5).every((k) => !hasTouchingSpades(k))).toBe(true);
    expect(ROW_KEYS.slice(5).every((k) => hasTouchingSpades(k))).toBe(true);
  });
});

const hasTouchingSpades = (key: string): boolean => {
  const at = [...key].flatMap((c, i) => (c === 'S' ? [i] : []));
  const gap = at[1] - at[0];
  return gap === 1 || gap === 4;
};

describe('reveal distributions', () => {
  it('are distributions', () => {
    for (const w of [UNIFORM_CUT, NO_CUT, LAZY, ALMOST]) {
      for (const x of ALL_INPUTS) {
        const d = revealDist(x, w);
        expect(d.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
        expect(d.every((v) => v >= 0)).toBe(true);
      }
    }
  });

  it('spread one cut’s weight over five distinct rows, never piling up', () => {
    for (const x of ALL_INPUTS) {
      const d = revealDist(x, UNIFORM_CUT);
      expect(d.filter((v) => v > 0)).toHaveLength(5);
      expect(d.every((v) => v === 0 || Math.abs(v - 0.2) < 1e-12)).toBe(true);
    }
  });

  it('stay inside the orbit the output demands', () => {
    for (const x of ALL_INPUTS) {
      const support = revealDist(x, UNIFORM_CUT).flatMap((v, i) => (v > 0 ? [i] : []));
      const inAdjacentBlock = support.every((i) => i >= 5);
      expect(inAdjacentBlock).toBe(x.a === 1 && x.b === 1);
    }
  });

  it('are IDENTICAL for the three input pairs whose answer is 0', () => {
    const zeros = ALL_INPUTS.filter((x) => !(x.a === 1 && x.b === 1));
    const first = revealDist(zeros[0], UNIFORM_CUT);
    for (const x of zeros) expect(revealDist(x, UNIFORM_CUT)).toEqual(first);
  });

  it('separate the moment the cut stops being uniform', () => {
    const zeros = ALL_INPUTS.filter((x) => !(x.a === 1 && x.b === 1));
    const first = revealDist(zeros[0], ALMOST);
    expect(revealDist(zeros[1], ALMOST)).not.toEqual(first);
  });
});

describe('total variation', () => {
  it('is 0 between a distribution and itself', () => {
    expect(totalVariation(revealDist(ALL_INPUTS[0], LAZY), revealDist(ALL_INPUTS[0], LAZY))).toBe(0);
  });

  it('is 1 between distributions with disjoint support', () => {
    expect(totalVariation([1, 0, 0], [0, 1, 0])).toBe(1);
  });

  it('is symmetric', () => {
    const p = revealDist({ a: 0, b: 0 }, ALMOST);
    const q = revealDist({ a: 1, b: 0 }, ALMOST);
    expect(totalVariation(p, q)).toBeCloseTo(totalVariation(q, p), 12);
  });

  it('turns into the optimal-distinguisher success rate', () => {
    expect(guessSuccess(0)).toBe(0.5);
    expect(guessSuccess(1)).toBe(1);
    expect(guessSuccess(0.25)).toBe(0.625);
  });
});

describe('what Bob can work out about Alice', () => {
  it('is nothing at all under a uniform cut, when his own bit is 0', () => {
    const atB0 = bobLeak(UNIFORM_CUT).find((r) => r.known === 0)!;
    expect(atB0.tv).toBe(0);
    expect(atB0.success).toBe(0.5);
    expect(atB0.forcedByOutput).toBe(false);
  });

  it('is everything when his own bit is 1 — but that is the AND, not a leak', () => {
    const atB1 = bobLeak(UNIFORM_CUT).find((r) => r.known === 1)!;
    expect(atB1.tv).toBeCloseTo(1, 12);
    expect(atB1.forcedByOutput).toBe(true);
  });

  it('grows as the cut gets more lopsided', () => {
    const at = (w: CutWeights): number => bobLeak(w).find((r) => r.known === 0)!.tv;
    expect(at(UNIFORM_CUT)).toBe(0);
    expect(at(ALMOST)).toBeCloseTo(0.25, 12);
    expect(at(LAZY)).toBeCloseTo(1, 12);
    expect(at(NO_CUT)).toBeCloseTo(1, 12);
    expect(at(ALMOST)).toBeGreaterThan(at(UNIFORM_CUT));
    expect(at(LAZY)).toBeGreaterThan(at(ALMOST));
  });

  it('matches the closed form TV(w, w rotated by three)', () => {
    // Alice's two layouts differ by exactly three cut positions, so her secret is
    // invisible precisely when the cut distribution is invariant under a rotation
    // by 3 — and 3 generates Z5, so only the uniform cut qualifies.
    const closedForm = (w: CutWeights): number => {
      let s = 0;
      for (let k = 0; k < 5; k++) s += Math.abs(w[k] - w[(k + 5 - 3) % 5]);
      return s / 2;
    };
    for (const w of [UNIFORM_CUT, NO_CUT, LAZY, ALMOST, [0.4, 0.25, 0.15, 0.12, 0.08] as CutWeights]) {
      expect(bobLeak(w).find((r) => r.known === 0)!.tv).toBeCloseTo(closedForm(w), 12);
    }
  });

  it('is zero for the uniform cut and no other distribution we can find', () => {
    const at = (w: CutWeights): number => bobLeak(w).find((r) => r.known === 0)!.tv;
    for (let i = 0; i < 200; i++) {
      const raw = [0, 0, 0, 0, 0].map(() => Math.floor(Math.random() * 9));
      const w = normalise(raw);
      if (!w) continue;
      const uniform = w.every((x) => Math.abs(x - 0.2) < 1e-12);
      expect(at(w) === 0).toBe(uniform);
    }
  });
});

describe('what Alice can work out about Bob', () => {
  it('mirrors Bob’s position exactly under a uniform cut', () => {
    const a = aliceLeak(UNIFORM_CUT).find((r) => r.known === 0)!;
    expect(a.tv).toBe(0);
    expect(a.success).toBe(0.5);
  });

  it('also leaks once the cut is lopsided — the flaw is not one-sided', () => {
    expect(aliceLeak(LAZY).find((r) => r.known === 0)!.tv).toBeGreaterThan(0);
  });
});

describe('leakage in bits', () => {
  it('sets the output’s own information content at H(1/4) ≈ 0.811 bits', () => {
    expect(mutualInformationOutput()).toBeCloseTo(0.8112781244591328, 12);
  });

  it('is exactly zero under a uniform cut', () => {
    expect(excessLeakageBits(UNIFORM_CUT)).toBe(0);
    expect(mutualInformationRow(UNIFORM_CUT)).toBeCloseTo(mutualInformationOutput(), 12);
  });

  it('reaches the full input entropy when there is no cut at all', () => {
    expect(mutualInformationRow(NO_CUT)).toBeCloseTo(2, 12);
    expect(excessLeakageBits(NO_CUT)).toBeCloseTo(1.1887218755408672, 12);
  });

  it('is never negative — the row can only ever add to the answer', () => {
    for (let i = 0; i < 200; i++) {
      const w = normalise([0, 0, 0, 0, 0].map(() => Math.random()));
      if (!w) continue;
      expect(excessLeakageBits(w)).toBeGreaterThanOrEqual(0);
    }
  });

  it('never exceeds what is left of the inputs after the answer is announced', () => {
    const ceiling = 2 - mutualInformationOutput();
    for (const w of [UNIFORM_CUT, NO_CUT, LAZY, ALMOST]) {
      expect(excessLeakageBits(w)).toBeLessThanOrEqual(ceiling + 1e-12);
    }
  });

  it('rises monotonically as cut depths are taken away', () => {
    const bits = [
      excessLeakageBits(UNIFORM_CUT),
      excessLeakageBits(ALMOST),
      excessLeakageBits([1 / 3, 1 / 3, 1 / 3, 0, 0]),
      excessLeakageBits(LAZY),
      excessLeakageBits(NO_CUT),
    ];
    for (let i = 1; i < bits.length; i++) expect(bits[i]).toBeGreaterThan(bits[i - 1]);
  });
});

describe('entropy', () => {
  it('is 0 for a certainty and 1 bit for a fair coin', () => {
    expect(entropy([1, 0])).toBe(0);
    expect(entropy([0.5, 0.5])).toBe(1);
  });

  it('is 2 bits for four equally likely outcomes', () => {
    expect(entropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(2, 12);
  });
});

describe('the onlooker', () => {
  it('gains nothing from the row over the announced answer, under a uniform cut', () => {
    const { fromRow, fromOutput } = observerSuccess(UNIFORM_CUT);
    expect(fromRow).toBeCloseTo(0.5, 12);
    expect(fromOutput).toBeCloseTo(0.5, 12);
  });

  it('names the input pair outright when nobody cut the deck', () => {
    expect(observerSuccess(NO_CUT).fromRow).toBeCloseTo(1, 12);
  });
});

describe('posteriors', () => {
  it('leave the three output-0 pairs equally likely under a uniform cut', () => {
    const post = posterior(ROW_KEYS[0], UNIFORM_CUT)!;
    expect(post[3]).toBeCloseTo(0, 12); // (1,1) cannot have produced this row
    for (const i of [0, 1, 2]) expect(post[i]).toBeCloseTo(1 / 3, 12);
  });

  it('point at a single input pair when nobody cut the deck', () => {
    const post = posterior(toKey(layout({ a: 1, b: 0 })), NO_CUT)!;
    expect(post[2]).toBeCloseTo(1, 12);
  });

  it('sum to 1 wherever they exist, and are null on an impossible row', () => {
    for (const key of ROW_KEYS) {
      const post = posterior(key, NO_CUT);
      if (post) expect(post.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
    }
    expect(posterior('HHHHH', UNIFORM_CUT)).toBeNull();
    expect(posterior(ROW_KEYS[1], NO_CUT)).toBeNull();
  });
});

describe('the marginal and the table', () => {
  it('is a distribution', () => {
    expect(marginalRowDist(UNIFORM_CUT).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
  });

  it('gives an output-0 row three times the weight of an output-1 row', () => {
    const m = marginalRowDist(UNIFORM_CUT);
    expect(m[0] / m[5]).toBeCloseTo(3, 12);
  });

  it('labels every table row with the answer the protocol would produce', () => {
    for (const row of distributionTable(UNIFORM_CUT)) {
      expect(row.output).toBe(row.inputs.a === 1 && row.inputs.b === 1 ? 1 : 0);
    }
  });
});

describe('shiftFor', () => {
  it('recovers the cut depth that produced each row', () => {
    for (const x of ALL_INPUTS) {
      for (const s of ALL_SHIFTS) {
        const key = ROW_KEYS[revealDist(x, indicator(s)).findIndex((v) => v > 0)];
        expect(shiftFor(x, key)).toBe(s);
      }
    }
  });

  it('returns null for a row those inputs could not have produced', () => {
    expect(shiftFor({ a: 1, b: 1 }, ROW_KEYS[0])).toBeNull();
    expect(shiftFor({ a: 0, b: 0 }, 'HHHHH')).toBeNull();
  });
});

const indicator = (s: number): CutWeights =>
  [0, 1, 2, 3, 4].map((i) => (i === s ? 1 : 0)) as unknown as CutWeights;

describe('evidenceRows — naming the attack row by row', () => {
  it('finds no evidence anywhere under a uniform cut', () => {
    const rows = evidenceRows(UNIFORM_CUT);
    expect(rows).toHaveLength(5); // the five rows an answer of 0 can produce
    expect(rows.every((r) => r.points === null)).toBe(true);
    expect(rows.every((r) => !r.exclusive)).toBe(true);
  });

  it('makes every reachable row conclusive when nobody cuts the deck', () => {
    const rows = evidenceRows(NO_CUT);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.exclusive)).toBe(true);
    expect(new Set(rows.map((r) => r.points))).toEqual(new Set([0, 1]));
  });

  it('points at the bit that actually produces the row more often', () => {
    for (const r of evidenceRows(ALMOST)) {
      if (r.points === 0) expect(r.ifZero).toBeGreaterThan(r.ifOne);
      if (r.points === 1) expect(r.ifOne).toBeGreaterThan(r.ifZero);
      if (r.points === null) expect(r.ifZero).toBeCloseTo(r.ifOne, 12);
    }
  });

  it('calls a row exclusive only when one of Alice’s bits cannot produce it', () => {
    for (const w of [UNIFORM_CUT, NO_CUT, LAZY, ALMOST]) {
      for (const r of evidenceRows(w)) {
        expect(r.exclusive).toBe(r.points !== null && (r.ifZero === 0 || r.ifOne === 0));
      }
    }
  });

  it('never lists a row neither secret can produce', () => {
    for (const w of [UNIFORM_CUT, NO_CUT, LAZY, ALMOST]) {
      for (const r of evidenceRows(w)) expect(r.ifZero + r.ifOne).toBeGreaterThan(0);
    }
  });

  it('agrees with the total-variation figure it is explaining', () => {
    // Half the L1 gap across the listed rows IS Bob's advantage — the row-by-row
    // story and the headline number are the same quantity, not two estimates.
    for (const w of [UNIFORM_CUT, NO_CUT, LAZY, ALMOST]) {
      const gap =
        evidenceRows(w).reduce((s, r) => s + Math.abs(r.ifZero - r.ifOne), 0) / 2;
      expect(gap).toBeCloseTo(bobLeak(w).find((l) => l.known === 0)!.tv, 12);
    }
  });
});

describe('leakReport', () => {
  it('calls the uniform cut secure', () => {
    const r = leakReport(UNIFORM_CUT);
    expect(r.secure).toBe(true);
    expect(r.excessBits).toBe(0);
  });

  it('calls every other preset insecure', () => {
    for (const w of [NO_CUT, LAZY, ALMOST, [0.4, 0.25, 0.15, 0.12, 0.08] as CutWeights]) {
      expect(leakReport(w).secure).toBe(false);
    }
  });

  it('does not let the output’s own implication count as insecurity', () => {
    // Bob's b=1 row has TV 1 under every cut, uniform included. If that counted,
    // nothing would ever be reported secure.
    expect(bobLeak(UNIFORM_CUT).find((r) => r.known === 1)!.tv).toBeCloseTo(1, 12);
    expect(leakReport(UNIFORM_CUT).secure).toBe(true);
  });
});
