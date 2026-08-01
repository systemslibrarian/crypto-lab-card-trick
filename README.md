# Card Trick

**Five-card protocol · information-theoretic MPC · den Boer 1989**

Two players compute the AND of their secret bits using five physical playing cards — no
electronics, no computational assumptions, security from shuffle indistinguishability
alone.

---

## What It Is

An interactive implementation of **den Boer's five-card trick** (CRYPTO '89), a two-party
secure multi-party computation protocol for a single AND gate. Alice holds a secret bit
`a`, Bob holds a secret bit `b`, and between them they learn `a AND b` — and nothing else.

The whole protocol is a layout, a cut, and a predicate:

```
encoding      ♠♥ = 1        ♥♠ = 0
layout        [ E(a) ] [ ♥ ] [ E(¬b) ]
cut           rotate the five-card ring by a secret, uniform s ∈ Z5
read-off      the two ♠ are cyclically adjacent  ⟺  a AND b = 1
```

**The security model is what makes this worth building.** Nearly every other demo in the
Crypto Lab is *computationally* secure: safe because breaking it would take more
arithmetic than exists. This one is **information-theoretically** secure. The three input
pairs that produce an answer of 0 all start from rows that are rotations of one another,
so a uniform cut spreads all three over exactly the same five revealed rows at exactly the
same rate. The distributions an attacker would compare are **equal**, so no amount of
computing power, no future algorithm and no quantum computer helps — there is no quantity
for work to buy.

The state space is ten rows and five cuts, which is small enough to enumerate. Every
probability on the page is therefore a finished sum rather than a Monte Carlo estimate,
and the zeros are enumerated zeros rather than rounded ones.

**What is real:** the protocol logic, the read-off, the orbit partition, the
indistinguishability table, the posteriors, the total-variation distances, the mutual
information in bits, and the unbiased cut sampler (rejection sampling on the platform
CSPRNG, so `byte % 5` bias never enters).

**What is simulated:** the shuffle. A browser cannot cut a physical deck. "Cut at random"
draws from `crypto.getRandomValues`, and — unlike a real dealer — the page knows the answer
it drew. The exhibit says so on screen and offers a switch that stops printing it.

**What this does NOT prove:** that a shuffle in your hands is uniform; that neither player
peeked while the cards were face down; that nobody marked a back; that both players
actually encoded the bits they claimed. Those are physical assumptions the protocol
*makes* rather than defends. **Not production cryptography** — a teaching demo of a
protocol that computes one gate for two people at the same table.

---

## Exhibits

1. **The Protocol** — set both secret bits, choose the cut depth by hand (or draw one
   uniformly), and step through the six stages: the encoding, Alice's commitment, the
   dealer's heart, Bob's negated commitment, the cut, and the reveal. A "play it honestly"
   switch stops the page showing you the cut depth a real player would never know.
   Underneath, **all five cuts side by side** — five visibly different rows, one unmoved
   answer.
2. **Why It Works** — the permutation-group argument, drawn. All ten legal rows partitioned
   into the two orbits of the cut, five rows each, with a button that applies every cut to
   a row and fails to escape its orbit. Below it, the complete 4 × 5 protocol table
   recomputed live and compared against a hand-written transcription of the paper's
   construction that shares no code with the implementation.
3. **What Leaks** — the probability of every revealed row for every pair of secrets. The
   three answer-0 rows are identical cell for cell; the pairwise total-variation distances
   are printed; and Bob's two situations are separated carefully, because "Bob holding 1
   learns Alice's bit" is arithmetic, not a leak. A posterior explorer takes any revealed
   row and reports what it implies.
4. **Break the Shuffle** — the break-it-yourself exhibit. Edit the distribution over the
   five cut depths with sliders, or pick a plausibly sloppy dealer, and watch the same
   functions that printed the zeros next door print Bob's advantage, the excess leakage in
   bits, and a table whose three answer-0 rows have come apart. The punchline: a dealer who
   cuts *genuinely at random* but only ever by 0 or 1 gives Alice's bit away completely.
   Then **play Bob** — guess Alice's bit round after round and watch your score against the
   ceiling.
5. **Cards vs Circuits** — the same job done by a garbled circuit, and what each one rests
   on. A figure plots attacker advantage against work spent: the card line is flat on the
   floor because it was enumerated, the circuit line is the generic κ-bit bound, labelled
   as a promise rather than a measurement. Closes with a comparison table, the Cipher
   Museum's Solitaire cipher as a contrast (cards as a *computationally* secure cipher,
   with known biases), and an exit check.

---

## When to Use It

**Use the five-card trick when** you want to demonstrate what "information-theoretically
secure" means to somebody who has only ever met computational security — it is the
shortest path from "safe because it would take too long" to "safe because there is nothing
there". It is also a genuine research object: card-based cryptography is an active field,
and this protocol is its origin point.

**Do NOT use it** for anything real. It computes one AND gate, for exactly two people, who
must be in the same room, with a deck of cards and a dealer both of them trust to cut
uniformly. It composes into nothing: the reveal destroys the commitments, so you cannot
feed the output into another gate. If you need secure computation, you need a garbled
circuit or a secret-sharing protocol — see [Related Demos](#related-demos).

**Do NOT conclude** that information-theoretic security is strictly better than
computational security. It is strictly *stronger as an assumption* and, here, bought with
a protocol that computes one bit and needs a trusted human. The trade is real in both
directions.

---

## Live Demo

**https://systemslibrarian.github.io/crypto-lab-card-trick/**

You can:

- Set Alice's and Bob's secret bits and step through the deal, the cut and the reveal.
- Choose the cut yourself, or draw one uniformly, and confirm the answer never moves.
- Read the exact probability of every revealed row for every pair of secrets, and check
  that the three answer-0 rows are identical.
- Make the dealer sloppy and watch the guarantee collapse — including the case where the
  cut is random and useless.
- Play Bob: guess Alice's bit from the table, round after round, against a ceiling of 50%.
- Compare the whole thing with a garbled circuit as the attacker's budget grows.

---

## What Can Go Wrong

| Failure | What happens | Where you can see it |
| --- | --- | --- |
| **The cut is not uniform** | Alice's two layouts sit three cut positions apart, so the rows Bob sees are the cut distribution and the cut distribution rotated by three. They match only when the distribution is invariant under rotation by 3 — and 3 generates Z5, so only the uniform cut qualifies. | *Break the Shuffle*, every preset |
| **The cut is random but lopsided** | "Random" is not the requirement. A dealer who cuts by 0 or 1, each half the time, puts Alice's 0 on two rows and her 1 on two entirely different rows: disjoint supports, one look, 100%. | *Break the Shuffle*, "Lazy dealer" |
| **The cut is nearly uniform** | Not nearly secure. Covering four of the five depths evenly still lifts Bob to 62.5%. The failure is not gradual in the way a security parameter is. | *Break the Shuffle*, "Almost uniform" |
| **A player peeks at a face-down card** | Total break, and the protocol has no defence at all. Its only assumption is that identical backs are indistinguishable; a peek is that assumption failing, not an attack on the maths. | Stated in-page; deliberately not modelled |
| **A player miscommits** | Encoding the wrong bit changes the answer without changing anything an observer could detect. Correctness here assumes honest placement — this is an honest-but-curious protocol, not a malicious-secure one. | Stated in-page |
| **Confusing the output with a leak** | Bob holding 1 learns Alice's bit from the answer alone. Reporting that as a protocol leak is the standard way this gets explained badly, and it would make every AND protocol look broken. | *What Leaks*, the two Bob cards |

---

## Real-World Usage

Card-based cryptography is a small but live research area. den Boer's 1989 construction
started it; Mizuki and Sone's four-card AND (2009) reduced the deck; Koch and Walzer's 2022
survey collects the protocol zoo, the shuffle models, and the lower bounds on how few cards
a gate can need. The practical uses are education, unplugged-computing outreach, and
low-tech settings where a physical procedure is more trustworthy to its participants than a
computer they cannot inspect.

The idea it teaches is not niche at all. Information-theoretic security is the security
model of the one-time pad, of Shamir secret sharing below its threshold, and of the privacy
guarantees inside several MPC protocols. Those systems are secure for the same reason this
one is: an adversary is comparing distributions that are equal, so the question of how much
computation they have never arises.

---

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-card-trick.git
cd crypto-lab-card-trick
npm install
npm run dev        # http://localhost:5173/crypto-lab-card-trick/
```

```bash
npm test           # unit tests, incl. the protocol KATs
npm run build      # typecheck + production build
npm run test:a11y  # axe WCAG 2.1 A/AA gate + Chromium flows (needs a build first)
npm run test:e2e:all   # every flow across Chromium, Firefox and WebKit
```

---

## Related Demos

- [crypto-lab-garbled-gate](https://systemslibrarian.github.io/crypto-lab-garbled-gate/) —
  the same job done computationally: an encrypted truth table, gate by gate.
- [crypto-lab-ot-gate](https://systemslibrarian.github.io/crypto-lab-ot-gate/) — oblivious
  transfer, the piece a garbled circuit needs to hand over the right wire label.
- [crypto-lab-otp-vault](https://systemslibrarian.github.io/crypto-lab-otp-vault/) — the
  other information-theoretically secure primitive, and the other one with an awkward key.
- [crypto-lab-shamir-gate](https://systemslibrarian.github.io/crypto-lab-shamir-gate/) —
  secret sharing, where below the threshold the shares are again *equally* consistent with
  every secret.
- [Cipher Museum: Solitaire](https://ciphermuseum.com/ciphers/solitaire.html) — a deck of
  cards used the other way round, as a hand cipher. Computationally secure, and with
  measurable biases found since.

---

## Build & Verify

**132 unit tests** (Vitest), all passing:

| File | Tests | What it checks |
| --- | --- | --- |
| `src/cards/protocol.test.ts` | 26 | Encoding is one-to-one and uses the same two cards for both bits; the cut is a Z5 action; adjacency survives every cut; the protocol computes AND for all 4 × 5 cases; the three answer-0 pairs reach identical row sets. |
| `src/cards/vectors.test.ts` | 32 | The **KATs** — all 20 rows of the protocol table plus the orbit and leakage vectors. |
| `src/cards/analysis.test.ts` | 39 | Reveal distributions, total variation, the closed form TV(w, w∘τ³), leakage in bits, posteriors, and the observer's advantage — including 200 randomised distributions checking that only the uniform cut leaks nothing. |
| `src/cards/necklace.test.ts` | 15 | The orbit partition: two blocks of five, closed under the cut, constant output within a block. |
| `src/cards/shuffle.test.ts` | 20 | Rejection sampling discards the six biasing bytes; the weighted sampler never returns an unweighted depth and never silently falls back to "no cut". |

**Known-answer tests.** den Boer's protocol is physical, so no vector file exists to
download. `src/cards/vectors.ts` is the honest equivalent: the **entire** input/output
table — four input pairs × five cut depths = **20 known answers** — hand-written from the
paper's construction, importing nothing from the implementation, plus the two orbits and
four hand-derived leakage figures. The *Why It Works* exhibit re-runs that comparison in
the browser and shows the result.

**46 end-to-end flow tests** (Playwright, Chromium desktop + a mobile viewport in the
deploy gate; Firefox and WebKit in a separate workflow) assert that each exhibit renders
its result, that the leak/no-leak semantics reach the DOM, and that no exhibit scrolls the
page sideways at 320px.

**Accessibility gate.** `@axe-core/playwright` scans the production build for **zero** WCAG
2.1 A/AA violations in **both** themes, after a driver has walked every exhibit into its
post-interaction state. The GitHub Pages deploy is blocked if it fails. State is never
carried by colour alone — every verdict is icon + word + colour, every card shows its pip
glyph and an off-screen suit name, and the comparison chart's two series differ in dash
pattern and carry direct labels as well as hue.

**Performance.** Nothing here is expensive: the state space is 10 rows × 5 cuts, so every
table, posterior and leakage figure is an exact enumeration computed in well under a
millisecond. There is no sampling anywhere on the page except the guessing game's dealt
rounds, which are single draws from the CSPRNG.

---

*One of 120+ browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
