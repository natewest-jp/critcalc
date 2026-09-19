# §1.G — resolved states in the buff projections — SCOPE (2026-09-19)

_Status: SCOPE, not started. ⚓ Nate approved §1.G as the next engine round
2026-09-19. This file is the static half of the scope — what the data says and
what the code is handed. ⏭ The MEASURED half (which bars are wrong today, in
which rotations) is §4 and is still to be run; ⛔ don't start the change before
it, the last three rounds each overturned their spec at that step._

## 0. The defect, in one paragraph

`deriveBuffWindows` (`src/lib/utils/buffWindows.ts`) evaluates every effect's
`conditions` with an EMPTY state set — about fifty `evalCondition(…, 4, new
Set(), cLevel, …)` call sites. `evalCondition`'s `state` arm answers `true` only
for a state in `resolvedStates`, `false` only for one in
`context.negatedStates`, and `null` otherwise — and in a buff pool `null` means
**keep, optimistically**. So a buff gated on `inStance`, `duringSummon` or
`nightsoulBlessing` draws whether or not the state is up. The backlog's named
casualties: Durin's form-gated shreds, Lohen A4, Varesa A1's tiers (the stat
dedupe keeps the first-authored tier because neither resolves), Qiqi A1, Fischl's
Secret Rite (authored and inert), and the two it BLOCKS — Columbina C6 (seven
+80% bars in a rotation with no summon of hers) and Odette's Coda exclusion.

## 1. The static census (2026-09-19, over all 123 characters)

105 `state` conditions across 41 characters — but **where they sit decides
whether they are this round's**:

| host                          | n   | resolved today?                                     |
| ----------------------------- | --- | --------------------------------------------------- |
| an ABILITY's own `conditions` | 43  | ✅ live, by `resolveActiveAbility` — not this round |
| a VARIANT's `conditions`      | 5   | ✅ live, by `matchVariant` — not this round         |
| a MODIFIER's `conditions`     | 1   | ✅ live, `applyModifiers` takes `resolvedStates`    |
| an EFFECT's `conditions`      | 56  | ⚠️ depends on the trigger — below                   |

The 56 effect-hosted gates, by what they gate:

| effect / trigger                                                                     | n   | evaluated by                                                 |
| ------------------------------------------------------------------------------------ | --- | ------------------------------------------------------------ |
| `buff` / onCast                                                                      | 16  | ⛔ `buffWindows`, no states                                  |
| `resShred` / onReaction                                                              | 9   | ⛔ `buffWindows`, no states                                  |
| `buff` / passive                                                                     | 5   | ⛔ `buffWindows` + the always-on chip, no states             |
| `buff` / onReaction                                                                  | 3   | ⛔ `buffWindows`, no states                                  |
| `buff` / onHit                                                                       | 2   | ⛔ `buffWindows`, no states                                  |
| `resShred` / onCast                                                                  | 1   | ⛔ `buffWindows`, no states                                  |
| `shield` / passive                                                                   | 1   | to check                                                     |
| gainStacks · consumeStacks · damage procs · cooldownReduce · energy · heal · cdReset | 19  | ✅ the LIVE dispatchers, which already call `holderStatesAt` |

So the round's real target is **~37 effects across ≤19 characters**, not 88, and
they gate on exactly **three** states: `duringSummon` ×20 · `inStance` ×19 ·
`nightsoulBlessing` ×15 (+ `offField` ×2, which the per-segment `negatedStates`
already resolves).

## 2. Why this is tractable: the answer is already in the IR

`deriveBuffWindows` runs at FINALIZE and is already handed `windows` — the
parse's state / summon / shield windows with FINAL ends (extensions and
truncations applied). All three states are windows there:

- `inStance` — a `state` window named `inStance` (stances are emitted that way).
- `nightsoulBlessing` and every other opened / transient state — `state` windows
  by name.
- `duringSummon` — the holder's `summon` windows.

So the round needs no new parse output. It needs ONE index,
`statesAt(holderId, t) → { active, negated }`, built once from `windows`, and
the fifty call sites handed the right `(holder, t)`.

⚠️⚠️ **Closed world only for TRACKED states.** `negated` may contain a state
only if the IR would have recorded it had it been up. `afterNormalAttack`,
`afterSkill`, `afterBurst`, `afterDurationEnds` have no window and must stay
`null` (optimistic) — a blanket "not in the active set ⇒ false" would silently
delete every effect gated on one. `shielded` has shield windows but is
unsurveyed here; leave it `null` unless §4 shows a wrong bar.

⚠️ **`duringSummon` has two meanings in the sim already** (`states.ts` header):
`inferredStates` counts only STATIONARY summons, `holderStatesAt` counts
following ones too (Escoffier C6's Cooking Mek). The buff passes are the
`holderStatesAt` question — any holder, any instant, off field included — so
the index must use the BROAD reading, ⛔ not the stationary one.

## 3. The design questions §4 must answer before any code

1. **Which `t`?** An onCast pool evaluates at the cast; an onHit / onReaction
   pool at the trigger event. But a buff whose gate is `inStance` and whose
   window outlives the stance — does the bar end with the state, or is the gate
   only an entry test? The data decides per effect (a `duration` beside the gate
   says entry test; none says co-extensive), and the census of which is which
   belongs in §4.
2. **Whose state?** The HOLDER's, for every case surveyed so far — but
   `target: 'active'` effects already carry a second subject (the receiver's
   `weaponType`), so check no state gate means the receiver's.
3. **Dedupe order.** The pool rule is conditions → dedupe by stat (buff-pool
   round). Varesa A1's tiers collapse to the first-authored one ONLY because
   neither resolves; with states supplied the existing order should pick the
   right tier with no further change. Verify, don't assume.
4. **The always-on chip** (`TeamBonusesBlock`) lists `passive` effects and
   evaluates party-composition gates since 2026-09-19. A state-gated passive
   there has no instant to evaluate at — it should keep listing optimistically,
   which is what it does. Confirm it is untouched.
5. **The summon-tick projection.** `summonTickSeries` also evaluates with no
   states (its header calls that load-bearing: the markers a viewer SEES must
   be the ticks that FIRE, and the live chain uses the same empty set). The
   census above found **no** state-gated tick series, so this round should
   leave both readers alone — re-check at §4 and say so in the record.

## 4. ⏭ The measurement still to run

- A **state-gate digest**: for each of the ≤19 characters, a rotation that casts
  the gated ability both INSIDE and OUTSIDE its state (e.g. `Q` cold, then
  `E … Q` in stance), at C0 and C6, recording every buff window with its
  effects. The "outside" run is where today's optimistic bars show.
- The **before** list from that digest is the round's definition of done; the
  **after** must remove exactly those bars and move nothing else (the corpus
  buff digest, `scratch/probe/digest.test.ts`, is the differential — ⚠️ it
  casts E and Q once each, so most of these never appear in it and a green run
  there proves little).
- Then re-try the two blocked items in memory: Columbina C6 as four
  element-keyed `onReaction` CRIT DMG buffs gated `duringSummon`, and Odette's
  Coda exclusion.

## 5. Out of scope, stated so nobody reaches for them

- `teamElementCount` / `teamFaction` in the buff and tick passes — already
  carried (T1's two prerequisites, `d71bca2a` / `64d22ae1`).
- A `stacks` gate in the buff passes — a different missing context, with its own
  snapshot-time question.
- `manual` retirement — runs after this, because Columbina C6 and Odette leave
  the `manual` pile only once this lands.
