/**
 * den Boer's five-card trick (EUROCRYPT '89) — the protocol itself.
 *
 * Two players hold one secret bit each. Using five playing cards — three hearts and
 * two spades — they learn `a AND b` and nothing else. There is no encryption here to
 * implement: the protocol is a layout, a cut, and a predicate on what the cut
 * revealed, and all three are written out below rather than delegated anywhere.
 *
 *   encoding      ♠♥ = 1        ♥♠ = 0
 *   layout        [ E(a) ] [ ♥ ] [ E(¬b) ]
 *   cut           rotate the five-card cycle by a secret, uniform s ∈ Z5
 *   read-off      the two ♠ are cyclically adjacent  ⟺  a AND b = 1
 *
 * Why Bob commits to the NEGATION of his bit: the read-off predicate pairs the last
 * position with the first, so wrapping around the table reverses Bob's pair relative
 * to Alice's. Reversing a commitment negates it — `reverse(E(x)) === E(¬x)` — so Bob
 * laying E(¬b) and Bob laying E(b) backwards are literally the same two cards. The
 * asymmetry is geometry, not a special rule.
 */

import { type Bit, type Card, type Inputs, type Run, type Sequence, type Shift } from './types.js';

/**
 * Commit to one bit as two face-down cards.
 *
 * A commitment is exactly one spade and one heart, so the *multiset* of cards a
 * player puts down is public and identical for both bit values. Only the order
 * carries the secret, and order is what the face-down backs hide.
 */
export function commit(bit: Bit): readonly [Card, Card] {
  return bit === 1 ? ['spade', 'heart'] : ['heart', 'spade'];
}

/** Read a commitment back. Inverse of `commit` — used only to prove the encoding is one-to-one. */
export function openCommitment(pair: readonly [Card, Card]): Bit | null {
  if (pair[0] === 'spade' && pair[1] === 'heart') return 1;
  if (pair[0] === 'heart' && pair[1] === 'spade') return 0;
  return null; // not a legal commitment: two spades or two hearts
}

/** Turning a commitment around negates it. This is why Bob's pair encodes ¬b. */
export function reverseCommitment(pair: readonly [Card, Card]): readonly [Card, Card] {
  return [pair[1], pair[0]];
}

/**
 * Lay the five cards out, face down, before any cut.
 *
 * Nobody in a real game ever sees this row — Alice sees only her own two cards, Bob
 * only his. It exists here because a teaching demo has to be able to show the thing
 * the players are not allowed to see.
 */
export function layout(inputs: Inputs): Sequence {
  const alice = commit(inputs.a);
  const bob = commit(inputs.b === 1 ? 0 : 1); // E(¬b)
  return [alice[0], alice[1], 'heart', bob[0], bob[1]];
}

/**
 * The cut: rotate the five-card cycle left by `s`.
 *
 * In the physical protocol this is a random cut (or a Hindu shuffle) applied by
 * someone who then cannot recover how far they cut. Position `i` of the result is
 * position `i + s` of the input, indices mod 5, because the row is treated as a ring
 * — the fifth card's right-hand neighbour is the first card.
 */
export function cut(seq: Sequence, s: Shift): Sequence {
  return [seq[s % 5], seq[(s + 1) % 5], seq[(s + 2) % 5], seq[(s + 3) % 5], seq[(s + 4) % 5]];
}

/** Where the spades sit in a revealed row. Always exactly two of them. */
export function spadePositions(seq: Sequence): readonly number[] {
  const at: number[] = [];
  for (let i = 0; i < 5; i++) if (seq[i] === 'spade') at.push(i);
  return at;
}

/**
 * The read-off predicate: are the two spades neighbours *around the ring*?
 *
 * Cyclic distance, not the difference of indices — positions 0 and 4 are neighbours
 * because the row wraps. That wrap is exactly what makes the predicate survive the
 * cut, and it is the entire security argument in one line: a rotation cannot change
 * who is next to whom.
 */
export function spadesAdjacent(seq: Sequence): boolean {
  const at = spadePositions(seq);
  if (at.length !== 2) return false; // not a legal five-card-trick row
  const gap = at[1] - at[0];
  return gap === 1 || gap === 4;
}

/** The protocol's answer, read from the revealed row alone. */
export function readOutput(seq: Sequence): Bit {
  return spadesAdjacent(seq) ? 1 : 0;
}

/** Run the whole protocol for one pair of inputs and one cut. */
export function run(inputs: Inputs, shift: Shift): Run {
  const alice = commit(inputs.a);
  const bob = commit(inputs.b === 1 ? 0 : 1);
  const beforeCut = layout(inputs);
  const revealed = cut(beforeCut, shift);
  const adjacent = spadesAdjacent(revealed);
  return {
    inputs,
    alice,
    middle: 'heart',
    bob,
    beforeCut,
    shift,
    revealed,
    adjacent,
    output: adjacent ? 1 : 0,
  };
}

/** The function the protocol is supposed to compute, stated independently of it. */
export function andGate(a: Bit, b: Bit): Bit {
  return a === 1 && b === 1 ? 1 : 0;
}

/** Compact wire form used by the KAT table and by the analysis keys: e.g. "SHHSH". */
export function toKey(seq: Sequence): string {
  return seq.map((c) => (c === 'spade' ? 'S' : 'H')).join('');
}

/** Parse the compact form back. Returns null for anything that is not five S/H characters. */
export function fromKey(key: string): Sequence | null {
  if (!/^[SH]{5}$/.test(key)) return null;
  const cards = [...key].map((ch) => (ch === 'S' ? 'spade' : 'heart') as Card);
  return [cards[0], cards[1], cards[2], cards[3], cards[4]];
}

/**
 * Every five-card row that could legally appear: three hearts, two spades.
 *
 * C(5,2) = 10 rows. Small enough that the lab never has to sample anything — every
 * probability on the page is a count over this set, not a Monte Carlo estimate.
 *
 * [extension] point — the four-card AND of Mizuki–Kumamoto–Sone (ASIACRYPT 2012) is not a
 * smaller version of this: it shuffles twice (a random bisection cut of the four-card
 * row, then a random cut of the middle two cards) and reads its answer off two turned
 * cards rather than off a ring, so it needs its own state machine rather than a
 * re-parameterised `cut`. A second deck size for a *cut*-based protocol would enter
 * here and in `necklace.ts`.
 */
export function allLegalRows(): readonly Sequence[] {
  const rows: Sequence[] = [];
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      const cards: Card[] = ['heart', 'heart', 'heart', 'heart', 'heart'];
      cards[i] = 'spade';
      cards[j] = 'spade';
      rows.push([cards[0], cards[1], cards[2], cards[3], cards[4]]);
    }
  }
  return rows;
}
