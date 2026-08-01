/**
 * The permutation-group argument, computed rather than asserted.
 *
 * The cut is the cyclic group Z5 acting on the ten legal five-card rows. That action
 * splits the ten rows into orbits, and an orbit is precisely a *necklace*: a
 * bracelet of five cards where only the cyclic order matters, not where you cut it.
 *
 * The five-card trick works because that partition has exactly two blocks:
 *
 *   orbit "adjacent"   — the two spades touch      (5 rows)   → output 1
 *   orbit "separated"  — one heart between them    (5 rows)   → output 0
 *
 * Everything else follows. A cut moves a row *within* its orbit and can never move
 * it between orbits, so the output survives the cut; and a uniform cut lands
 * uniformly on the five rows of the orbit, so the row you see says nothing about
 * where you started. That is the whole proof, and `orbits()` below is a machine
 * check of the only step that could have been wrong: that there really are just two
 * blocks, of five rows each.
 */

import { ALL_SHIFTS, type Sequence } from './types.js';
import { allLegalRows, cut, spadesAdjacent, toKey } from './protocol.js';

export interface Orbit {
  /** Stable name — also the output bit this orbit produces. */
  readonly name: 'adjacent' | 'separated';
  /** The orbit's rows, in cut order starting from `rows[0]`. */
  readonly rows: readonly Sequence[];
  /** The output every row in this orbit reads off as. Constant by construction. */
  readonly output: 0 | 1;
}

/** The orbit of one row under the cut: the five rotations, in cut order. */
export function orbitOf(seq: Sequence): readonly Sequence[] {
  return ALL_SHIFTS.map((s) => cut(seq, s));
}

/**
 * Partition all ten legal rows into orbits under Z5.
 *
 * Computed by walking the rows and closing each under the group action — not by
 * hard-coding "there are two". If a future deck size broke that, this would return
 * three orbits and the tests would say so.
 */
export function orbits(): readonly Orbit[] {
  const seen = new Set<string>();
  const found: Orbit[] = [];
  for (const row of allLegalRows()) {
    if (seen.has(toKey(row))) continue;
    const rows = orbitOf(row);
    for (const r of rows) seen.add(toKey(r));
    const adjacent = spadesAdjacent(row);
    found.push({
      name: adjacent ? 'adjacent' : 'separated',
      rows,
      output: adjacent ? 1 : 0,
    });
  }
  return found;
}

/** Which orbit a row belongs to. This is exactly the protocol's read-off. */
export function orbitName(seq: Sequence): Orbit['name'] {
  return spadesAdjacent(seq) ? 'adjacent' : 'separated';
}

/**
 * How far apart the two spades are around the ring: 1 (touching) or 2.
 *
 * With five positions and two spades there is no third possibility — distance 3 is
 * distance 2 measured the other way round, and distance 4 is distance 1. That
 * collapse is why five cards suffice and why a different deck size needs a
 * different argument.
 */
export function spadeGap(seq: Sequence): number {
  const at: number[] = [];
  for (let i = 0; i < 5; i++) if (seq[i] === 'spade') at.push(i);
  if (at.length !== 2) return 0;
  const d = at[1] - at[0];
  return Math.min(d, 5 - d);
}
