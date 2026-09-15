# The stack-threshold trigger — plan (2026-09-15)

_Status: SPEC. ⚓ Nate 2026-09-15: Columbina's Gravity goes this way (option 3),
with blank + restored caveats as the interim._

## 0. The mechanic that needs it

Columbina's Gravity Interference (gcsim `columbina/skill.go`): while the Lunar
Domain is up, each party Lunar reaction (Charged / Bloom / Crystallize) opens or
refreshes a 2s `gravityKey` status; while it is live, Gravity accrues at
**10/s** (×(1 + C2 rate)), tagged with the LAST reaction's kind; at **60** the
Interference fires — damage in that kind's element (three authored `manual`
damage effects with their own `application[]`), A1's CRIT stacks, all three C1
branches (shield, +6 energy, interruption res), C2's four buffs, C6's +80% team
CRIT DMG — and the pool resets. Twelve authored effects, all `manual`, all
drawing nothing. In play it is roughly "6s of Lunar reactions at ≤2s spacing".

A flat cadence (`onReaction` + `procCooldown: 6`) was proposed and refused:
it is an invented number. A stack resource is the mechanic's own shape.

## 1. The primitive

`{ type: 'onStack', count }` is already a `Trigger` member with **no reader**.
Give it one:

- **Grant.** `gainStacks` key `gravity`, `scope: 'rotation'`, `max: 60`, on
  `onReaction` (`source: 'team'`, the three Lunar reactions), **amount 20** —
  one 2s status at 10/s, the value a lone reaction is worth. ⚠️ Time-based
  accrual with refresh is not a count; 20-per-reaction is the stated
  approximation (three reactions ≥2s apart reach 60; closer reactions
  over-count slightly). Author it as such in the notes and the caveat.
- **Fire.** An effect with `trigger: { type: 'onStack', count: 60 }` fires at
  the instant the key's count reaches `count` (checked at the same settle
  points the stack dispatchers use: cast, hit, tick), and a `consumeStacks
'all'` on the same trigger resets the pool. The fire is an ordinary
  dispatch: `damage` effects with `application[]` reach the proc registry
  (element = the last reaction's kind → three mutually-exclusive effects gated
  on a `lastReaction` fact the grant records, or, simpler, one effect per kind
  gated on `stacks` of three sibling keys — decide in-round), buffs reach the
  buff pools, the shield reaches `pushShield`.
- **Where.** `sim/stacks.ts` (the threshold check beside `applyDrain`),
  `sim/procs.ts` (onStack as a proc trigger), `buffWindows.ts` (onStack as a
  cast-like anchor). Lint: `onStack.count ≤ max` of the key; the key must have
  a `gainStacks` author.

## 2. Who else it frees

Any "when N stacks are reached" mechanic authored as `manual` today — sweep
the 167 for the phrase. Known: Nahida's Seed count is a gate, not a threshold
(no); Iansan's Surging Force (C4) fires on restoration ticks (partly);
Escoffier's C2 reads a snapshot (no). The primitive is Columbina's first and
possibly only consumer at launch, which is fine: she is T0.

## 3. Measurement

- `Columbina E Q > Fischl E N3 > Barbara E` at C0/C6: expect a Gravity pool
  rising by 20 per Lunar-Charged, an Interference at the third, the C6 CRIT DMG
  bar and A1 CRIT bar drawing from that instant, applications in Electro.
- Corpus byte-identical elsewhere at C0 and C6.
- Interim (until the round): restore the C1/C2/C6 caveats deleted 2026-08-19.
