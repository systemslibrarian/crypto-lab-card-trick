/**
 * The whole state space of the five-card trick.
 *
 * There is no field, no group of large order, no key. The objects below are the
 * entire protocol: two card faces, five positions, and the cyclic group Z5 acting on
 * them. That is deliberately the point — everything the security argument talks
 * about is small enough to enumerate, and this lab does enumerate it rather than
 * asserting the result.
 */

/**
 * A card face. The backs are assumed identical and indistinguishable; that
 * assumption is the protocol's *only* one, and it is physical rather than
 * computational.
 */
export type Card = 'spade' | 'heart';

/** A private input bit, or the output of the AND. */
export type Bit = 0 | 1;

/** How far the deck was cut. The five-card trick lives in Z5. */
export type Shift = 0 | 1 | 2 | 3 | 4;

/** The five positions, in table order, left to right. */
export type Sequence = readonly [Card, Card, Card, Card, Card];

/** Both players' private inputs. */
export interface Inputs {
  readonly a: Bit;
  readonly b: Bit;
}

/** Everything a run of the protocol produced, including what stayed private. */
export interface Run {
  readonly inputs: Inputs;
  /** Alice's two face-down cards: the commitment to `a`. */
  readonly alice: readonly [Card, Card];
  /** The dealer's single face-down heart, sitting between the two commitments. */
  readonly middle: Card;
  /** Bob's two face-down cards: the commitment to NOT `b`. */
  readonly bob: readonly [Card, Card];
  /** The row before the cut — nobody is ever allowed to see this one. */
  readonly beforeCut: Sequence;
  /** How far the deck was cut. In a real game nobody knows this number. */
  readonly shift: Shift;
  /** The row everyone turns over. This is the *only* thing that becomes public. */
  readonly revealed: Sequence;
  /** The two spades ended up cyclically adjacent. */
  readonly adjacent: boolean;
  /** The protocol's answer, read off the revealed row. */
  readonly output: Bit;
}

export const ALL_SHIFTS: readonly Shift[] = [0, 1, 2, 3, 4];

export const ALL_INPUTS: readonly Inputs[] = [
  { a: 0, b: 0 },
  { a: 0, b: 1 },
  { a: 1, b: 0 },
  { a: 1, b: 1 },
];
