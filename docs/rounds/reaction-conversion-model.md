# The reaction-conversion model (2026-08-31)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

> ↻ Correction (2026-10-29): the slot-versus-segment roster asymmetry this record calls "not fixed" is fixed. Reactions, elements and factions all read one roster now (`rosterChars` in `src/lib/utils/notationParser.ts`).

Branch `curation/7.0-stellar-rollout`. ⚓ **Nate laid out the model in full; most
of this round is his mechanics written down correctly.**

## ⚓⚓ ONE TABLE, five rows — `src/lib/sim/reactionBridge.ts`

A newer-generation reaction is **not** an extra reaction layered on an old one.
Each REPLACES exactly one base, gated on a party enabler.

| base                 | converted        | mode    |
| -------------------- | ---------------- | ------- |
| superConduct         | stellarConduct   | replace |
| cryoSwirl            | stellarSwirl     | replace |
| electroCharged       | lunarCharged     | replace |
| **hydro**Crystallize | lunarCrystallize | replace |
| bloom                | lunarBloom       | **add** |

1. An **enabler** is required; ONE suffices; enablement is **per-reaction**.
2. ⚓ **Any party member can then trigger it** — the enabler need not be involved,
   and a character's kit text need not mention it.
3. Replacement is CLEAN but only for its OWN base — ⚠️ a Lunar-Crystallize enabler
   replaces **hydro** crystallize only; pyro/cryo/electro still occur alongside.

⛔⛔ **A BUFF ON THE BASE IS NOT A BUFF ON THE CONVERTED REACTION** (⚓ Nate).
Diona's C6 Superconduct bonus does NOT fire in a Sandrone party. Subsumption was
considered and **REJECTED**. ⛔ Don't pair OR-arrays whose kit text was not itself
rewritten — an effect going dark in an enabler team is CORRECT. ⚠️ For
_responding_, the kit text IS the authority; for _triggering_ it is not. ⛔ Never
collapse those two.

⚠️⚠️ **`mode: 'add'` has a hazard `replace` does not** — two events for one
reaction, so an effect listing BOTH sides fires twice. ⛔ For an add pair list ONE
side. 13 effects list a base + counterpart; 10 are safe purely because
replacement emits one. Fixed under add: Collei, Tighnari, Neuvillette.

⛔ **`enablesReactions` is the ARMING SWITCH.** A conversion is inert until a
character declares the reaction. Order: bridge → trigger pairings → enablers LAST.
Declared: lunarCharged Ineffa/Flins/Columbina · lunarCrystallize
Zibai/Columbina/Linnea · lunarBloom Lauma/Nefer/Columbina · stellarConduct +
stellarSwirl Sandrone + Odette + Cryo Traveler (all three curated).

🐛 Two were wrong since they shipped: **`lunarCharged` was NEVER emitted** (the
Ineffa EC→LC model the Stellar one was copied FROM was never wired — Ineffa's and
Flins's own lunarCharged-only effects were dead), and **`lunarCrystallize` was
ALONGSIDE on a 2+ Moonsign gate**, wrong twice over. `hasMoonsignTeam` is deleted.

## ⚓ Stellar Glimmer is the UMBRELLA, not a reaction

⛔ **No `Reaction` union member** — the union stays per-reaction. It gets
family-wide **Stat** keys (`stellarGlimmerDmgBonus` / `…ReactionBonus`) on the
`lunarDmgBonus` precedent, plus the previously-missing `stellarSwirl` pair.
`effectCollection` maps a whole family to its umbrella stat.

## ⚓ The RADIANCE idiom — no schema needed

Conduct = `all[teamEnablesReaction:stellarConduct, teamElementCount:[electro]>=1]`.
Swirl = the same for swirl + anemo, wrapped in `not(`the Conduct clause`)`.
⚓ **The `not` IS Nate's precedence rule** (Conduct wins when both are up).
⚠️ Enablement alone can't separate them (all enablers enable both) — the ELEMENT
test does the work. ⚠️ Conduct is field-presence (assume entered, no duration);
Swirl is a real **8s** window. Full write-up in `docs/library/game/stellar-reactions.md`.

## `BuffValue.scaling.offset` + `energyRecharge`

`offset` = the threshold a stat must EXCEED. ⚠️ **8 holders, 7 of them left
entirely UNAUTHORED** because the shape didn't exist. Lint **D.38**; ⛔ an
authored 0 is rejected. ⚓ **`ratio` is VALUE PER 100 STAT UNITS** — "0.4% per 1%
ER" is `ratio: 40`, not 0.4 (I got this wrong once; Mona's "20% of her ER" = 20 is
the cross-check). ⛔ Baizhu needs nothing — linear through the origin, so `cap`
already expresses him. ⚠️ A stat with no `SCALING_STAT_LABEL` row leaks its raw key.

## ✅ THE 5.2.13 WORK LIST IS CLOSED (2026-08-31, branch `curation/cryo-traveler`)

⚠️⚠️ **The rollout wired the TRIGGERS and left the PROSE behind** — 14 of the 15
revised entries still read "Swirl" where 7.0 says "Swirl or Stellar Swirl", on
the exact mechanic the tool now models. ⛔ Corpus description drift is NOT an
invariant (81 entries diverge and most are deliberate curator prose), so the
re-sync needed a TEST, not a rule: **is our stored text VERBATIM the previous
pin?** 14 were (un-edited generator output gone stale) → re-synced wholesale,
proven `description`-only by diffing the parsed JSON with that key stripped.
Skirk's diverged from BOTH versions → one sentence patched by hand.

🐛 **And one was a LIVE OVER-CLAIM, not a prose lag: Mizuki C1.** `stellarSwirl`
was appended to its trigger array without noticing that the same patch SPLIT the
value ("1,100% and 550% … respectively"), so a Stellar Swirl drew DOUBLE in any
enabler team. Now two mutually-exclusive effects — replacement is clean, so
exactly one fires per event.

⚓⚓ **WHEN A RENAME ADDS A CONVERTED REACTION TO A TRIGGER, RE-READ THE NUMBERS.**
Only 2 of the 15 split their values (Mizuki C1, Sandrone C4 — the latter
unmodelled by a standing ruling); the other 13 really were renames. ⚠️ Sayu,
Heizou and Skirk correctly got nothing at the effect level — their passives carry
no effects, so there is no trigger to extend.

⚠️ **A latent asymmetry found while verifying, NOT fixed** (`notationParser.ts`
~line 165 vs ~204): `teamEnabledReactions` prefers the **SLOT** roster — an
enabler in slot 4 with zero casts still converts — while `teamElementCounts` and
`teamFactionCounts` are built from the **SEGMENT** roster. So a slotted, silent
Electro teammate satisfies `teamEnablesReaction` but not `teamElementCount`, and
the Radiance idiom needs both. ⚓ Unreachable in the planner today (the team IS
the notation, and adding a character appends a bare name = a segment), so it
bites only a hand-built roster. ⛔ Not changed here — it moves every
`teamElementCount` in the corpus and wants its own measured round.

## ⏭ OPEN — handed to fresh sessions

- ✅ **Stage 2 for Odette + Alyosha is DONE (2026-08-31) — `docs/rounds/stage2-odette-alyosha.md`.**
  Every open call resolved: the Coda IS a transient state (`codaWindow`) but a
  state-conditioned SIBLING ABILITY, not a variant; Marvelous Splendor is four
  constellation-branched `gainStacks`; ⚠️ **her summon's cadence IS stated** —
  Fandom's Gameplay Notes give "one dance move every 2s", authored as two 4s
  series; Hunter's Precision is `active` and rides a `min: 2` stack gate.
  ⛔ gcsim still has NOTHING for either, so Stage 4 stays blocked and both keep
  `FRAMELESS_EXEMPT`. ⚠️⚠️ **`extraPassives` splits POSITIONALLY** (passive1/2 in,
  3/4 out) and 7.0 BROKE it — the "Stellar Jubilee" converter sits in `passive3`,
  so the generator filed out the passive that makes them enablers. Restored by
  hand; ⛔ always read `extraPassives`. ⚠️⚠️ And the text it DOES ship is
  incomplete — see the Stage-2 memory.
- ✅ **Cryo Traveler is INGESTED — `docs/rounds/cryo-traveler.md`** (the third enabler;
  ⛔ no Polestar mirror, and ⚠️⚠️ one unstated tick cadence blocks half the kit).
- **[[project_summon_conditions_round]]** — spec at
  `docs/curation/summon-conditions-round.md`. 32 constellations, ⚠️ NOT one class.
