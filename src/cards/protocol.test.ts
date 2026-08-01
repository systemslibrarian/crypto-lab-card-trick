import { describe, expect, it } from 'vitest';
import {
  allLegalRows,
  andGate,
  commit,
  cut,
  fromKey,
  layout,
  openCommitment,
  readOutput,
  reverseCommitment,
  run,
  spadePositions,
  spadesAdjacent,
  toKey,
} from './protocol.js';
import { ALL_INPUTS, ALL_SHIFTS, type Bit, type Sequence } from './types.js';

describe('the commitment encoding', () => {
  it('is one-to-one: every bit opens back to itself', () => {
    for (const bit of [0, 1] as const) {
      expect(openCommitment(commit(bit))).toBe(bit);
    }
  });

  it('uses the same two cards for both bit values — only the order differs', () => {
    const zero = [...commit(0)].sort();
    const one = [...commit(1)].sort();
    expect(zero).toEqual(one);
    expect(zero).toEqual(['heart', 'spade']);
    expect(commit(0)).not.toEqual(commit(1));
  });

  it('matches the brief encoding: SH = 1, HS = 0', () => {
    expect(commit(1)).toEqual(['spade', 'heart']);
    expect(commit(0)).toEqual(['heart', 'spade']);
  });

  it('negates when reversed — which is why Bob commits to NOT b', () => {
    for (const bit of [0, 1] as const) {
      expect(reverseCommitment(commit(bit))).toEqual(commit(bit === 1 ? 0 : 1));
    }
  });

  it('rejects a pair that is not a legal commitment', () => {
    expect(openCommitment(['spade', 'spade'])).toBeNull();
    expect(openCommitment(['heart', 'heart'])).toBeNull();
  });
});

describe('the layout', () => {
  it('always puts three hearts and two spades on the table', () => {
    for (const inputs of ALL_INPUTS) {
      const row = layout(inputs);
      expect(row.filter((c) => c === 'spade')).toHaveLength(2);
      expect(row.filter((c) => c === 'heart')).toHaveLength(3);
    }
  });

  it('puts a heart in the middle for every input pair', () => {
    for (const inputs of ALL_INPUTS) expect(layout(inputs)[2]).toBe('heart');
  });

  it('gives four distinct rows, one per input pair', () => {
    const keys = ALL_INPUTS.map((x) => toKey(layout(x)));
    expect(new Set(keys).size).toBe(4);
  });

  it('places Bob’s pair as the reverse of his own commitment', () => {
    for (const inputs of ALL_INPUTS) {
      const row = layout(inputs);
      expect([row[3], row[4]]).toEqual(reverseCommitment(commit(inputs.b)));
    }
  });
});

describe('the cut', () => {
  const base = fromKey('SHHSH') as Sequence;

  it('by zero changes nothing', () => {
    expect(cut(base, 0)).toEqual(base);
  });

  it('composes: cutting by i then j is cutting by i+j mod 5', () => {
    for (const i of ALL_SHIFTS) {
      for (const j of ALL_SHIFTS) {
        expect(cut(cut(base, i), j)).toEqual(cut(base, ((i + j) % 5) as 0 | 1 | 2 | 3 | 4));
      }
    }
  });

  it('sends a row to five distinct rows — no cut depth is a duplicate', () => {
    for (const inputs of ALL_INPUTS) {
      const seen = ALL_SHIFTS.map((s) => toKey(cut(layout(inputs), s)));
      expect(new Set(seen).size).toBe(5);
    }
  });

  it('preserves the cards on the table', () => {
    for (const s of ALL_SHIFTS) {
      expect([...cut(base, s)].sort()).toEqual([...base].sort());
    }
  });
});

describe('the read-off', () => {
  it('treats the row as a ring: first and last are neighbours', () => {
    expect(spadesAdjacent(fromKey('SHHHS') as Sequence)).toBe(true);
    expect(spadesAdjacent(fromKey('SHHSH') as Sequence)).toBe(false);
  });

  it('survives every cut — adjacency is what a rotation cannot change', () => {
    for (const row of allLegalRows()) {
      const answers = ALL_SHIFTS.map((s) => spadesAdjacent(cut(row, s)));
      expect(new Set(answers).size).toBe(1);
    }
  });

  it('finds exactly two spades in every legal row', () => {
    for (const row of allLegalRows()) expect(spadePositions(row)).toHaveLength(2);
  });

  it('refuses to answer on a row that is not a legal five-card-trick row', () => {
    expect(spadesAdjacent(['spade', 'spade', 'spade', 'heart', 'heart'])).toBe(false);
    expect(spadesAdjacent(['heart', 'heart', 'heart', 'heart', 'heart'])).toBe(false);
  });
});

describe('the protocol as a whole', () => {
  it('computes AND for all four input pairs and all five cuts', () => {
    for (const inputs of ALL_INPUTS) {
      for (const s of ALL_SHIFTS) {
        expect(run(inputs, s).output).toBe(andGate(inputs.a, inputs.b));
      }
    }
  });

  it('gives the same answer whichever cut the learner chooses', () => {
    for (const inputs of ALL_INPUTS) {
      const outputs = ALL_SHIFTS.map((s) => run(inputs, s).output);
      expect(new Set(outputs).size).toBe(1);
    }
  });

  it('shows a DIFFERENT row for each cut while the answer stays put', () => {
    for (const inputs of ALL_INPUTS) {
      const rows = ALL_SHIFTS.map((s) => toKey(run(inputs, s).revealed));
      expect(new Set(rows).size).toBe(5);
    }
  });

  it('reads the output off the revealed row alone', () => {
    for (const inputs of ALL_INPUTS) {
      for (const s of ALL_SHIFTS) {
        const r = run(inputs, s);
        expect(readOutput(r.revealed)).toBe(r.output);
      }
    }
  });

  it('never lets a 0 output and a 1 output share a revealed row', () => {
    const zero = new Set<string>();
    const one = new Set<string>();
    for (const inputs of ALL_INPUTS) {
      for (const s of ALL_SHIFTS) {
        const r = run(inputs, s);
        (r.output === 1 ? one : zero).add(toKey(r.revealed));
      }
    }
    for (const k of one) expect(zero.has(k)).toBe(false);
  });

  it('produces reveals that three different input pairs can equally explain', () => {
    // The heart of the security claim, stated as a set fact before any probability:
    // every row an output-0 run can produce is reachable from all three of them.
    const reach = (a: Bit, b: Bit): Set<string> =>
      new Set(ALL_SHIFTS.map((s) => toKey(run({ a, b }, s).revealed)));
    const s00 = reach(0, 0);
    expect(reach(0, 1)).toEqual(s00);
    expect(reach(1, 0)).toEqual(s00);
    expect(reach(1, 1)).not.toEqual(s00);
  });
});

describe('row encoding helpers', () => {
  it('round-trips every legal row through its compact form', () => {
    for (const row of allLegalRows()) expect(fromKey(toKey(row))).toEqual(row);
  });

  it('rejects malformed keys rather than guessing', () => {
    for (const bad of ['', 'SHHS', 'SHHSHH', 'SHXSH', 'shhsh']) {
      expect(fromKey(bad)).toBeNull();
    }
  });

  it('enumerates exactly the ten legal rows', () => {
    const rows = allLegalRows();
    expect(rows).toHaveLength(10);
    expect(new Set(rows.map(toKey)).size).toBe(10);
  });
});
