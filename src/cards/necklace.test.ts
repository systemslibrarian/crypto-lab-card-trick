import { describe, expect, it } from 'vitest';
import { orbitName, orbitOf, orbits, spadeGap } from './necklace.js';
import { allLegalRows, cut, layout, spadesAdjacent, toKey } from './protocol.js';
import { ALL_INPUTS, ALL_SHIFTS } from './types.js';

describe('the orbits of the cut', () => {
  it('splits the ten legal rows into exactly two blocks', () => {
    expect(orbits()).toHaveLength(2);
  });

  it('gives both blocks five rows', () => {
    for (const o of orbits()) expect(o.rows).toHaveLength(5);
  });

  it('covers every legal row exactly once', () => {
    const covered = orbits().flatMap((o) => o.rows.map(toKey));
    expect(covered).toHaveLength(10);
    expect(new Set(covered).size).toBe(10);
    expect(new Set(covered)).toEqual(new Set(allLegalRows().map(toKey)));
  });

  it('holds the output constant within a block — the cut cannot change the answer', () => {
    for (const o of orbits()) {
      for (const row of o.rows) expect(spadesAdjacent(row) ? 1 : 0).toBe(o.output);
    }
  });

  it('gives the two blocks different outputs', () => {
    expect(new Set(orbits().map((o) => o.output))).toEqual(new Set([0, 1]));
  });

  it('is closed under the cut: rotating a row keeps it in its own block', () => {
    for (const o of orbits()) {
      const keys = new Set(o.rows.map(toKey));
      for (const row of o.rows) {
        for (const s of ALL_SHIFTS) expect(keys.has(toKey(cut(row, s)))).toBe(true);
      }
    }
  });

  it('reaches every row of a block from any member of it', () => {
    for (const o of orbits()) {
      for (const row of o.rows) {
        expect(new Set(orbitOf(row).map(toKey))).toEqual(new Set(o.rows.map(toKey)));
      }
    }
  });
});

describe('the spade gap', () => {
  it('is only ever 1 or 2 — five positions leave no third option', () => {
    for (const row of allLegalRows()) expect([1, 2]).toContain(spadeGap(row));
  });

  it('is unchanged by the cut', () => {
    for (const row of allLegalRows()) {
      const gaps = ALL_SHIFTS.map((s) => spadeGap(cut(row, s)));
      expect(new Set(gaps).size).toBe(1);
    }
  });

  it('is exactly the read-off: gap 1 means the spades touch', () => {
    for (const row of allLegalRows()) {
      expect(spadeGap(row) === 1).toBe(spadesAdjacent(row));
    }
  });

  it('returns 0 for a row that is not a legal five-card-trick row', () => {
    expect(spadeGap(['spade', 'spade', 'spade', 'heart', 'heart'])).toBe(0);
  });
});

describe('the protocol lands in the orbit the truth table demands', () => {
  it.each(ALL_INPUTS)('a=$a b=$b', (inputs) => {
    const want = inputs.a === 1 && inputs.b === 1 ? 'adjacent' : 'separated';
    expect(orbitName(layout(inputs))).toBe(want);
  });
});
