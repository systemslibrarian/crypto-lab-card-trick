import { describe, expect, it } from 'vitest';
import { LEAKAGE_VECTORS, ORBIT_VECTORS, PROTOCOL_VECTORS } from './vectors.js';
import { andGate, run, toKey } from './protocol.js';
import { orbits } from './necklace.js';
import { bobLeak, excessLeakageBits } from './analysis.js';
import { type CutWeights } from './shuffle.js';

/**
 * The known-answer suite. `vectors.ts` is hand-written from den Boer's construction
 * and imports nothing from the implementation, so these tests compare two
 * independent accounts of the protocol rather than the code against itself.
 */
describe('protocol KATs — the complete 4 × 5 table', () => {
  it('has all twenty cases exactly once', () => {
    expect(PROTOCOL_VECTORS).toHaveLength(20);
    const keys = PROTOCOL_VECTORS.map((v) => `${v.a}${v.b}${v.shift}`);
    expect(new Set(keys).size).toBe(20);
  });

  it.each(PROTOCOL_VECTORS)(
    'a=$a b=$b cut=$shift reveals $revealed and reads $output',
    (v) => {
      const r = run({ a: v.a, b: v.b }, v.shift);
      expect(toKey(r.revealed)).toBe(v.revealed);
      expect(r.output).toBe(v.output);
    },
  );

  it('agrees with a plain AND gate on every row', () => {
    for (const v of PROTOCOL_VECTORS) expect(v.output).toBe(andGate(v.a, v.b));
  });

  it('gives the three output-0 blocks the same five rows in a different order', () => {
    const block = (a: number, b: number): string[] =>
      PROTOCOL_VECTORS.filter((v) => v.a === a && v.b === b)
        .map((v) => v.revealed)
        .sort();
    expect(block(0, 1)).toEqual(block(0, 0));
    expect(block(1, 0)).toEqual(block(0, 0));
    expect(block(1, 1)).not.toEqual(block(0, 0));
  });

  it('never repeats a row inside one block', () => {
    for (const a of [0, 1]) {
      for (const b of [0, 1]) {
        const rows = PROTOCOL_VECTORS.filter((v) => v.a === a && v.b === b).map((v) => v.revealed);
        expect(new Set(rows).size).toBe(5);
      }
    }
  });
});

describe('orbit KATs — the cut’s action on the ten legal rows', () => {
  it('matches the computed partition, block for block', () => {
    const computed = orbits();
    expect(computed).toHaveLength(ORBIT_VECTORS.length);
    for (const expected of ORBIT_VECTORS) {
      const got = computed.find((o) => o.name === expected.name);
      expect(got, `orbit ${expected.name}`).toBeDefined();
      expect(new Set(got!.rows.map(toKey))).toEqual(new Set(expected.rows));
    }
  });

  it('covers all ten rows with no row in two orbits', () => {
    const all = ORBIT_VECTORS.flatMap((o) => o.rows);
    expect(all).toHaveLength(10);
    expect(new Set(all).size).toBe(10);
  });

  it('assigns every revealed row in the protocol table to the right orbit', () => {
    const adjacent = new Set(ORBIT_VECTORS.find((o) => o.name === 'adjacent')!.rows);
    for (const v of PROTOCOL_VECTORS) {
      expect(adjacent.has(v.revealed)).toBe(v.output === 1);
    }
  });
});

describe('leakage KATs — figures derived on paper', () => {
  it.each(LEAKAGE_VECTORS)('$preset: Bob’s advantage and the excess bits', (v) => {
    const w = v.weights as CutWeights;
    const atB0 = bobLeak(w).find((r) => r.known === 0)!;
    expect(atB0.tv).toBeCloseTo(v.bobTvAtB0, 12);
    expect(atB0.success).toBeCloseTo(v.bobSuccessAtB0, 12);
    expect(excessLeakageBits(w)).toBeCloseTo(v.excessBits, 12);
  });

  it('puts the uniform cut alone at zero', () => {
    const zero = LEAKAGE_VECTORS.filter((v) => v.excessBits === 0);
    expect(zero.map((v) => v.preset)).toEqual(['uniform']);
  });
});
