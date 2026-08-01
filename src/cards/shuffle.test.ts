import { describe, expect, it } from 'vitest';
import {
  CUT_PRESETS,
  type ByteSource,
  type CutWeights,
  UNIFORM_CUT,
  drawShift,
  isUniform,
  normalise,
  presetById,
  uniformShift,
  weightedShift,
} from './shuffle.js';

/** A byte source that hands out a fixed script, so the samplers are deterministic. */
const scripted = (values: number[]): ByteSource => {
  let i = 0;
  return (n) => {
    const out = new Uint8Array(n);
    for (let k = 0; k < n; k++) out[k] = values[i++ % values.length];
    return out;
  };
};

describe('normalise', () => {
  it('scales any non-negative vector to a distribution', () => {
    const w = normalise([1, 1, 1, 1, 1]);
    expect(w).not.toBeNull();
    expect(w!.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12);
    expect(w).toEqual(UNIFORM_CUT);
  });

  it('keeps the shape of a lopsided vector', () => {
    expect(normalise([3, 1, 0, 0, 0])).toEqual([0.75, 0.25, 0, 0, 0]);
  });

  it('refuses an all-zero vector rather than quietly returning uniform', () => {
    expect(normalise([0, 0, 0, 0, 0])).toBeNull();
  });

  it('refuses negatives, NaN and the wrong length', () => {
    expect(normalise([-1, 1, 1, 1, 1])).toBeNull();
    expect(normalise([Number.NaN, 1, 1, 1, 1])).toBeNull();
    expect(normalise([1, 1, 1, 1])).toBeNull();
    expect(normalise([1, 1, 1, 1, 1, 1])).toBeNull();
  });
});

describe('isUniform', () => {
  it('accepts the uniform cut and nothing else among the presets', () => {
    const uniform = CUT_PRESETS.filter((p) => isUniform(p.weights));
    expect(uniform.map((p) => p.id)).toEqual(['uniform']);
  });

  it('rejects a distribution that is only nearly uniform', () => {
    expect(isUniform([0.21, 0.19, 0.2, 0.2, 0.2])).toBe(false);
  });
});

describe('uniformShift — rejection sampling', () => {
  it('maps a usable byte to its residue mod 5', () => {
    for (let b = 0; b < 250; b += 7) {
      expect(uniformShift(scripted([b]))).toBe(b % 5);
    }
  });

  it('discards the six bytes that would bias the result', () => {
    // 250..255 are the values that make 256 not a multiple of 5. Each must be
    // skipped, not folded in: 250 % 5 === 0 would over-weight depth 0.
    for (const bad of [250, 251, 252, 253, 254, 255]) {
      expect(uniformShift(scripted([bad, bad, bad, bad, bad, bad, bad, bad, 7]))).toBe(2);
    }
  });

  it('gives every depth over a long draw, and no depth outside Z5', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(uniformShift());
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('throws rather than returning a biased value when the source is broken', () => {
    expect(() => uniformShift(scripted([255]))).toThrow(/byte source/);
  });
});

describe('weightedShift', () => {
  const quarterBytes = (fraction: number): number[] => {
    const u = Math.floor(fraction * 2 ** 32);
    return [(u >>> 24) & 0xff, (u >>> 16) & 0xff, (u >>> 8) & 0xff, u & 0xff];
  };

  it('indexes the cumulative weights', () => {
    const w: CutWeights = [0.5, 0.5, 0, 0, 0];
    expect(weightedShift(w, scripted(quarterBytes(0.1)))).toBe(0);
    expect(weightedShift(w, scripted(quarterBytes(0.49)))).toBe(0);
    expect(weightedShift(w, scripted(quarterBytes(0.51)))).toBe(1);
    expect(weightedShift(w, scripted(quarterBytes(0.99)))).toBe(1);
  });

  it('never returns a depth the distribution gave no weight to', () => {
    const w: CutWeights = [0, 0, 1, 0, 0];
    for (const f of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(weightedShift(w, scripted(quarterBytes(f)))).toBe(2);
    }
  });

  it('falls back to the last weighted depth, not depth 0, on rounding overrun', () => {
    // Weights summing to slightly under 1 leave a sliver at the top of [0,1).
    // Landing there must not silently become "no cut".
    const w = [0, 0, 0, 0, 0.999999] as unknown as CutWeights;
    expect(weightedShift(w, scripted(quarterBytes(0.9999999)))).toBe(4);
  });

  it('throws on weights that carry no probability at all', () => {
    expect(() => weightedShift([0, 0, 0, 0, 0], scripted(quarterBytes(0.5)))).toThrow(
      /no probability/,
    );
  });

  it('reproduces a lopsided distribution over many draws', () => {
    const w: CutWeights = [0.6, 0.4, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) counts[weightedShift(w)]++;
    expect(counts[2] + counts[3] + counts[4]).toBe(0);
    expect(counts[0] / 4000).toBeGreaterThan(0.55);
    expect(counts[0] / 4000).toBeLessThan(0.65);
  });
});

describe('drawShift', () => {
  it('routes the uniform cut to the unbiased sampler', () => {
    // The rejection sampler consumes one byte; the weighted one would consume four
    // and read this script as a completely different number.
    expect(drawShift(UNIFORM_CUT, scripted([13]))).toBe(3);
  });

  it('routes a lopsided cut to the weighted sampler', () => {
    expect(drawShift([0, 0, 0, 0, 1], scripted([0, 0, 0, 0]))).toBe(4);
  });
});

describe('the presets', () => {
  it('are all genuine distributions', () => {
    for (const p of CUT_PRESETS) {
      expect(p.weights.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12);
      expect(p.weights.every((x) => x >= 0)).toBe(true);
    }
  });

  it('lead with the correct one', () => {
    expect(CUT_PRESETS[0].id).toBe('uniform');
  });

  it('resolve by id, and fall back to the correct cut for an unknown id', () => {
    expect(presetById('lazy').weights).toEqual([0.5, 0.5, 0, 0, 0]);
    expect(presetById('nope').id).toBe('uniform');
  });
});
