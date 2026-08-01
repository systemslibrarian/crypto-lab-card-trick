/**
 * Known-answer tests for a protocol that has no published test vectors.
 *
 * den Boer's paper describes a physical procedure, so there is no `.json` of bytes
 * to download and no reference implementation to diff against. What there is, is a
 * construction with a completely finite state space — so the honest equivalent of a
 * KAT file is the *entire* input/output table, written out by hand from the paper's
 * construction and committed here as data, independent of the code that computes it.
 *
 * 20 rows: four input pairs × five cut depths. If `protocol.ts` were rewritten from
 * scratch tomorrow, these are the answers it would still have to produce.
 *
 * Notation: S = spade, H = heart, read left to right along the table.
 *   layout           [ E(a) ] [ ♥ ] [ E(¬b) ],  with E(1) = SH and E(0) = HS
 *   cut depth s      the row rotated left by s
 *   output           1 exactly when the two S are cyclically adjacent
 */

import { type Bit } from './types.js';

export interface ProtocolVector {
  readonly a: Bit;
  readonly b: Bit;
  readonly shift: 0 | 1 | 2 | 3 | 4;
  /** The row everyone turns over. */
  readonly revealed: string;
  readonly output: Bit;
}

/**
 * Every case, in full. Note what the four blocks look like side by side: the three
 * blocks whose output is 0 are the same five rows in a different order, and the
 * output-1 block shares none of them. That is the security property, visible as a
 * table before any probability is computed.
 */
export const PROTOCOL_VECTORS: readonly ProtocolVector[] = [
  // a = 0, b = 0 — layout HS H HS = HSHSH
  { a: 0, b: 0, shift: 0, revealed: 'HSHSH', output: 0 },
  { a: 0, b: 0, shift: 1, revealed: 'SHSHH', output: 0 },
  { a: 0, b: 0, shift: 2, revealed: 'HSHHS', output: 0 },
  { a: 0, b: 0, shift: 3, revealed: 'SHHSH', output: 0 },
  { a: 0, b: 0, shift: 4, revealed: 'HHSHS', output: 0 },
  // a = 0, b = 1 — layout HS H HS with Bob negating: HSHHS
  { a: 0, b: 1, shift: 0, revealed: 'HSHHS', output: 0 },
  { a: 0, b: 1, shift: 1, revealed: 'SHHSH', output: 0 },
  { a: 0, b: 1, shift: 2, revealed: 'HHSHS', output: 0 },
  { a: 0, b: 1, shift: 3, revealed: 'HSHSH', output: 0 },
  { a: 0, b: 1, shift: 4, revealed: 'SHSHH', output: 0 },
  // a = 1, b = 0 — layout SH H SH = SHHSH
  { a: 1, b: 0, shift: 0, revealed: 'SHHSH', output: 0 },
  { a: 1, b: 0, shift: 1, revealed: 'HHSHS', output: 0 },
  { a: 1, b: 0, shift: 2, revealed: 'HSHSH', output: 0 },
  { a: 1, b: 0, shift: 3, revealed: 'SHSHH', output: 0 },
  { a: 1, b: 0, shift: 4, revealed: 'HSHHS', output: 0 },
  // a = 1, b = 1 — layout SH H HS = SHHHS, the only block where the spades touch
  { a: 1, b: 1, shift: 0, revealed: 'SHHHS', output: 1 },
  { a: 1, b: 1, shift: 1, revealed: 'HHHSS', output: 1 },
  { a: 1, b: 1, shift: 2, revealed: 'HHSSH', output: 1 },
  { a: 1, b: 1, shift: 3, revealed: 'HSSHH', output: 1 },
  { a: 1, b: 1, shift: 4, revealed: 'SSHHH', output: 1 },
];

/**
 * The two orbits of the cut action, written out independently of `necklace.ts`.
 * Ten rows, two blocks of five, and no row in both.
 */
export const ORBIT_VECTORS: readonly { name: 'separated' | 'adjacent'; rows: readonly string[] }[] =
  [
    { name: 'separated', rows: ['HSHSH', 'SHSHH', 'HSHHS', 'SHHSH', 'HHSHS'] },
    { name: 'adjacent', rows: ['SSHHH', 'SHHHS', 'HHHSS', 'HHSSH', 'HSSHH'] },
  ];

/**
 * Leakage figures derived on paper, so the analysis code has something to be wrong
 * against.
 *
 * `bobTvAtB0` is the total variation between the rows Bob sees when Alice holds 0
 * and when she holds 1, given that Bob holds 0 — the only case where anything Bob
 * works out is the protocol's fault rather than arithmetic's.
 *
 * The closed form is TV(w, w∘τ³) where τ is the cut by one: Alice's two layouts
 * differ by exactly three cut positions, so her secret is invisible precisely when
 * the cut distribution is invariant under rotation by 3 — and since 3 generates Z5,
 * that means uniform. Nothing else will do.
 */
export const LEAKAGE_VECTORS: readonly {
  readonly preset: string;
  readonly weights: readonly [number, number, number, number, number];
  readonly bobTvAtB0: number;
  readonly bobSuccessAtB0: number;
  readonly excessBits: number;
}[] = [
  {
    preset: 'uniform',
    weights: [0.2, 0.2, 0.2, 0.2, 0.2],
    bobTvAtB0: 0,
    bobSuccessAtB0: 0.5,
    excessBits: 0,
  },
  {
    preset: 'almost',
    weights: [0.25, 0.25, 0.25, 0.25, 0],
    // |w - w∘τ³| = (0, 0, .25, 0, .25) → TV = .25
    bobTvAtB0: 0.25,
    bobSuccessAtB0: 0.625,
    excessBits: 0.2193609377704336, // I(X;row) = 1.0306390622…, minus H(AND)
  },
  {
    preset: 'lazy',
    weights: [0.5, 0.5, 0, 0, 0],
    // Alice's two supports are {0,1} and {3,4}: disjoint, so one look settles it.
    bobTvAtB0: 1,
    bobSuccessAtB0: 1,
    excessBits: 0.9387218755408672, // 1.75 − H(AND)
  },
  {
    preset: 'none',
    weights: [1, 0, 0, 0, 0],
    bobTvAtB0: 1,
    bobSuccessAtB0: 1,
    // The row names the input pair outright: I(X;row) = H(X) = 2 bits.
    excessBits: 1.1887218755408672,
  },
];
