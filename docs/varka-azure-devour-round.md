# Varka — Azure Devour's cost, and C1's use in hand (2026-09-18)

_The item the cooldown-reduction round left open (`docs/cooldown-reduction-round.md`
§4.6) and one defect that round shipped. Branch `curation/varka-azure-devour`.
§1–§4 are the record; §5 is what is still open and why._

## 0. What the game and gcsim say

The kit: "Varka can also expend uses of the special Elemental Skill Four Winds'
Ascension to perform a special Charged Attack, Azure Devour, that does not
consume stamina". gcsim `charge.go`:

```go
func (c *char) skillCharge() (action.Info, error) {
	if c.useSpecialSkill() && (c.Charges(action.ActionSpecialSkill) > 0 || c.c6FreeCA()) {
		return c.skillAzureDevour(c.c6FreeCA())
	}
	// … the ordinary in-stance charged attack
}
// skillAzureDevour: four hits [conv, Anemo, conv, Anemo] at [40, 40, 60, 60],
// then, unless C6 made it free:
	c.SetCD(action.ActionSpecialSkill, 11*60)
```

Two gates and one write. `useSpecialSkill()` is "in Sturm und Drang with a
Pyro/Hydro/Electro/Cryo teammate" — the same predicate that turns Windbound
Execution into Four Winds. Without it there is no Azure Devour to perform and
the hold is the ordinary in-stance charge. With it and no charge, likewise. The
cost is `SetCD` at the attack's START (no delay — Four Winds' own is queued at
frame 39).

And C1 (`cons.go` `c1OnSkill`, called from the stance-entry block after every
charge has been put on cooldown):

```go
c.c1Extra = 1
c.ResetActionCooldown(action.ActionSpecialSkill)
```

`ResetActionCooldown` pops the head of the cooldown queue and returns one
charge. The pool stays at 2 (`SetNumCharges(ActionSpecialSkill, 2)` is never
changed): C1 is ONE use handed back at entry, not a third charge.

## 1. What shipped

**`NormalAbility.specialChargeSpends`** — the skill ability whose charge an `sC`
spends. Read in the charged branch of `run.ts`, beside the existing
`specialChargeFrames` read (`resolve.ts` gained an `allowSpecial` flag so the two
cannot disagree about whether the special form was taken). Lint A.4d: needs
the frames, and must name a skill of the same character.

**`cdReset.resetsAbility`** — ONE named ability's queue instead of every queue
of `resets`'s kind, and character `cdReset`s now fire from SKILL casts too
(after the stance opening writes its `startsOnCooldown` chain, at the cast's
cooldown-clock start). `getCharacterCdResetTargets` evaluates the effect's full
`conditions` now rather than the `constellation` leaf alone — a skill-fired
reset needs a `state` gate to tell the stance opener from its in-stance
sibling, which is also a skill. Lint B.10c: the name must be an ability of the
reset's kind, and a skill-fired `resets: "skill"` MUST name one (unnamed, it
would refund the very cast that fired it). Kazuha's C1 (burst-fired) is
byte-identical.

**`ActionEvent.spentCharge`** — `{ abilityId, readyAt }` on the `sC` that paid.
Recorded, not drawn (§5).

**Data.** Varka's in-stance normal names Four Winds; Four Winds loses the C1
`chargeModifiers +1`; the C1 entry carries the reset (`not inStance` + a
PHEC-teammate gate, the two gcsim conditions); Windbound Execution's caveat
("Not modeled: Azure Devour…") is retired; C6 gains one (§5).

## 2. The rules, and the one that was overturned by its own probe

1. **The special is taken only where the named skill RESOLVES** at the swing
   (`resolveActiveAbility(char, 'skill', …)?.id === specialChargeSpends`).
   Out of the stance, or in a party with no Pyro/Hydro/Electro/Cryo member,
   `sC` is the ordinary charged attack on `chargeFrames`. That is gcsim's
   `useSpecialSkill()` and it also fixed a small pre-existing wrong: `Lauma E >
Varka E N2 sC` drew Azure Devour's 60f where no Azure Devour exists.
2. **A charge must be READY, and the token WAITS for one** exactly as an `E` on
   cooldown does — the charge-queue scan, boundaries at a charge's return and
   at an own window's end. The notation named Azure Devour; a gap that says "no
   use yet" is honest where a same-tinted ordinary charge would be a quiet
   substitution.
3. ↻ **…unless the wait cannot END in the special.** First cut: the scan mirrored
   the E-scan exactly and advanced to the stance's end, where the special no
   longer resolved, and drew a BASE charged attack there — measured, `Xiangling
E > Varka E N5 N5 sE N2 sC` at C0 put the `sC` at 766f, out of stance and
   Physical, in place of 673f in it, and carried the rest of the rotation with
   it. The scan now PEEKS at the resolution once the nearer window closes
   (`computeCurrentStates(boundary)` is a pure reader); if the skill is gone
   there, no use can be reached in this stance and the token is the ordinary
   in-stance charge at its own instant — gcsim's own fallback. The E-scan keeps
   its rule: an `E` can always be cast once its clock returns, an Azure Devour
   cannot be performed in a stance that has ended.
4. **The spent clock is appended to the END of the chain** (charges recharge one
   at a time), from the attack's start. The next `sE` lands where the queue
   allows; the Four Winds pill's own tail is untouched because it names the
   other charge.

## 3. C1 — the defect, and its arithmetic

The cooldown-reduction round authored C1 as `chargeModifiers +1` on a
`startsOnCooldown` sibling, which wrote the chain [11s, 22s, 33s] at entry.
Measured before: `Xiangling E > Varka E sE` at C1 placed Four Winds at **745f,
identical to C0** — a third charge behind the other two is unreachable in any
stance, and the "additional use" the kit promises at entry was nowhere.

With the reset: chain [745, 1405] → head refunded at the clock start (85) →
[85, 745]. `E sE` at C1 now casts Four Winds at **90f** (the E→E cancel),
its spent clock chains behind the recharging one (readyAt 1405), and the second
use returns at 745 minus Secret Rite. Three uses per stance (entry, +11s, +22s,
each less the reduction), which is what gcsim's queue does once the reset has
popped its head.

## 4. Measured

| notation (Xiangling first unless noted) | cons | before                                  | after                                                  |
| --------------------------------------- | ---- | --------------------------------------- | ------------------------------------------------------ |
| `Varka E sE`                            | C1   | Four Winds 745f                         | **90f**, readyAt 1405                                  |
| `Varka E sE`                            | C0   | 745f                                    | 745f (unchanged)                                       |
| `Varka E N2 sC`                         | C0   | `sC` at 156f, no cost                   | **waits to 685f** (11s − 2 × 0.5s), spends             |
| `Varka E N2 sC`                         | C1   | 156f, no cost                           | 156f, spends the use in hand                           |
| `Varka E N2 sC sE`                      | C1   | `sE` readyAt 2665                       | `sE` readyAt **2005** (chained behind the spent clock) |
| `Varka E N5 N5 sC N2 sE`                | C0   | `sE` = Four Winds at 682f, a free 2nd   | `sE` = Windbound at 1045f — no 2nd use in a 12s stance |
| `Varka E N5 N5 sE N2 sC`                | C0   | `sC` at 673f as Azure Devour            | 673f as the ORDINARY in-stance charge (rule 3)         |
| `Varka E N5 N5 sE N2 sC`                | C1   | 673f, no cost                           | 673f, Azure Devour, spends                             |
| `Lauma E > Varka E N2 sC`               | C0   | Azure Devour's 60f, Physical right hand | the ordinary charge's 63f (rule 1)                     |

⚠️ The C0 `sC N2 sE` row is the honest picture, not a regression: a second use
inside one stance at C0 needs the burst's 2.3s extension or 2+ Hexerei, which
is what the kit's numbers add up to.

**Corpus differential** — 126 characters × C0/C1/C6, `<name> E N1 N2 sC Q E N1
C P sE > Kaeya E N1 N2 N3 > Xingqiu E Q N1 N2 N3`, digesting every cast's
`time`/`readyAt`/`cdReduced` and every action's time/duration/element/spend:
**378 digests, 3 moved, all Varka.** Kazuha C1, Freminet and Arlecchino (the
other character `cdReset` holders, whose walk now evaluates full conditions)
are byte-identical.

**Gates:** vitest 1910/1910 (8 new cases in `sim/cooldownReduce.test.ts`,
synthetic character), check, lint, build; e2e — see the merge commit.

## 5. Still open — three things, all Nate's

- 🗒️ **The pixel for a spent charge — PARKED (⚓ Nate, 2026-09-18: "I'm not
  feeling it"; discarded, kept as an open idea).** An `sC` that paid draws
  nothing but its own block; `ActionEvent.spentCharge` (ability id + chained
  `readyAt`) is still stamped, so the cost shows only as where the next `sE`
  can land, and any future surface has its data. **What was tried, three cuts
  on branch `polish/varka-spent-ghost` (unmerged, kept as the archive), each
  recorded because each taught something:**
  1. _A pill-less GHOST tail_ on the E row at ghost depth (z:0, the element at
     ghost alpha, from the `sC` block's start to `readyAt`). Invisible for
     exactly the span that matters: on Varka the E row IS his 12–14s stance
     pill, opaque, so the tail surfaced only after the stance ended, stacked
     with Windbound's own 16s ghost. ⚠️ Four Winds' own ghost tails already
     hide under the stance pill the same way — a standing limit of one E row
     carrying a stance and its sibling skill.
  2. _The same tail OPAQUE and ABOVE the pills_ (a 40% element-into-ground mix
     at z:3). Read as a recessed channel in the stance pill with the pill's
     1px rim above and below, a darker ghost past it — but it COVERED a later
     Four Winds pill on the row (`E N2 sC N5 sE` at C1: the `sE` vanished),
     and it made the stance pill look as if it ended at the `sC`. One row
     cannot LAYER a stance window, a sibling's pills and a third thing.
  3. _An EDGE LEDGER_ (Nate's shape): two summon-style ticks (1px × 7px, the
     bar's `hi` rung) joined by a 1px line along the row's BOTTOM edge for a
     cooldown, TOP edge for a limited-availability window, as a `ledger` role
     in `barPhases` so screen and PNG agreed. It hid nothing and both pills
     stayed legible, but at 1px in `hi`-over-pill it was faint on the pill,
     and it had no room for a label. Judged live and not taken.
     ⚓ The idea that survives: **one shape could mark both "when does this come
     off cooldown" and "when does this availability window close"**, and the
     census of who would use the window half is in the session's report — Varesa
     (Apex Drive after a plunge), Lauma (deer form → Prayer cooldown after a
     `C`), Durin (the Dark commit), and the cast-opened windows of Flins, Odette,
     Varesa and Durin. If it is picked up: draw a window on the row of the
     ability it makes AVAILABLE, not the row of the cast that opened it, and the
     E-row occlusion in (1) is the first thing to solve — probably the stance
     sibling on its own sub-row.
- **C6's free casts** — after a paid Four Winds, an `sC` inside 3s is free;
  after a paid Azure Devour, an `sE` inside 3s is free; a free cast does not
  re-arm the window. There is a pixel now (the C6 caveat names it) and the
  shape is three primitives: a SKILL variant that `bypassesCooldown` (the flag
  is read for bursts only), a variant-level `opensTransientState` override so
  the free cast does not open the window again, and a waiver state on
  `specialChargeSpends`. Two `State` members (`freeAzureDevour`,
  `freeFourWinds`) and lint. ⏭ Nate's call whether a C6 rotation loop is worth
  three schema additions.
- ✅ **Which element tints his E/Q pills — RULED AND SHIPPED the same day**
  (branch `polish/varka-cast-tint`). ⚓ Nate: Four Winds and the burst tint the
  PHEC hand; Windbound Execution stays Anemo, and that contrast is the point —
  "in a Pyro Varka team you build him with a Pyro Goblet, since his Pyro damage
  is greater than his Anemo damage, so people will consider his PHEC damage
  his main output … it will bring more attention to Windbound Execution being
  Anemo tinted, which should be interesting and helpful for players to know
  his kit better." The rule is general, not Varka's: **a cast pill tints the
  element its FIRST landed hit applies**, resolved at parse from
  `application[0].element` (`CastEvent.element`, stamped only when it is not
  the caster's own; a census of every literal `application[0].element` in the
  corpus finds ZERO that differ from the character's, so only Varka's two refs
  move). It rides the bar (`TimelineBar.element`) into the pill, its ghost
  tail, its badge halo and the cast's input block, and the PNG export mirrors
  it. ↻ **And the stance opener's PILL joins them** (⚓ Nate, later the same
  day): Windbound Execution's only hit is Anemo, but its pill body IS the
  stance in which he is a PHEC DPS, and an Anemo E pill beside a PHEC Q pill
  "looks a little off" — so `CastEvent.stanceElement` (the in-stance normal's
  resolved infusion, when not the caster's own; no other stance in the corpus
  infuses a foreign element) tints the PILL, and the input BLOCK keeps
  `element` alone, so it stays Anemo: the cast's own hit. ⚠️ The notation EDITOR still highlights `sE`/`Q` in Varka's own Anemo —
  the highlighter reads the eager index and has no party to resolve a ref
  against, the same limit that leaves timed infusions neutral there.

## 6. Addendum, 2026-09-19 — A1's multiplier, and a general defect it exposed

⚓ Nate: "sounds like a small thing to add on." It was, once the shape was
settled by precedent, and it exposed a walk that had been wrong since the
buff pool existed.

**The shape.** Skirk's Return to Oblivion and Neuvillette's A1 author "deals X%
of original DMG" as a `+(X − 100)` `*DmgBonus` buff, and Hu Tao's and Cyno's
in-stance self-buffs anchor on the stance's `onCast` with its fixed length. So:
`normalDmgBonus` + `chargeDmgBonus` + `skillDmgBonus` at **+40** under
`any[anemo ≥ 1, pyro ≥ 2, hydro ≥ 2, electro ≥ 2, cryo ≥ 2]` and at **+120**
under `all[anemo ≥ 1, any[PHEC ≥ 2]]`, the +40 rung wrapping the +120
condition in `not`; `trigger: onCast skill`, `duration: 12`, gated `inStance`
and `ascension ≥ 1`. ⚠️ `teamElementCount` is HOLDER-EXCLUDED, so the kit's
"at least 2 Anemo characters" is `anemo >= 1` — Varka is the other one.
⚠️ Additive stand-in for a multiplicative bucket, the precedents' own
approximation; the chip prints +40% / +120%. ⚠️ The fixed 12s does not follow
the burst's 2.3s extension (the precedents' limit too). Hosted on **Windbound
Execution**, not the A1 passive — which is what found the defect.

**The defect.** `collectOnCastEffects` walked EVERY skill-hosted effect for
ANY skill cast. No character could expose it until one had a sibling skill and
a skill-hosted `onCast` buff meant for that skill alone: measured, the
multiplier fired again on every in-stance Four Winds cast (`Xiangling E >
Bennett E > Varka E N5 N5 sE`: a second window at 606–1326 beside the stance's
95–815) and would have refresh-merged 10s past the stance's end. ⚓ **An effect
hosted on a cast ability fires only for casts of that ability** now
(`hostedElsewhere` in `effectCollection.ts`; the three cast pools in
`buffWindows.ts` are keyed by the resolved ability id as well as the label;
passives, constellations and faction bonuses are untouched). Two digests over
the corpus — the standard one and a sibling-reaching `E N1 N2 E N1 Q N1 E sE`
— moved **0 of 252** after one data correction: **Varesa's** Tag-Team Triple
Jump buff (A1) was authored on her base skill and reached Fiery Passion Rush,
the Nightsoul-form sibling, only through the old walk. It is hosted on the A1
passive now, where an `onCast skill` fires for both forms, and its provenance
chip names the passive.

**Measured.** `Xiangling E > Varka …` (one Pyro): no bar. `+ Bennett`: one
+40 bar, 95–815, through `N5 N5 sE N5 N5`. `Kazuha + Xiangling + Bennett`:
one +120 bar. `Kazuha + Varka`: +40 (two Anemo, no PHEC pair, no Four Winds).

**C2** is recorded on its entry as known and pixel-free (§5).

## 7. Addendum, 2026-09-19 — the always-on chip and a stale caveat

⚓ Nate, hovering Dawn Wind's March: the chip listed Anemo, Pyro, Hydro,
Electro AND Cryo DMG, and "it doesn't vary with any party changes". Not a
Varka defect: `TeamBonusesBlock.svelte` said in its own comment that a
passive's conditions "are NOT evaluated — they list optimistically", which was
tolerable while the only gates were runtime facts the chip cannot know (enemy
HP, an aura), and wrong the moment a passive's gates were PARTY COMPOSITION —
a static fact the chip holds in full, and exactly what A1's five-rung ladder
is. The chip now evaluates every passive effect's conditions against the
slotted party (faction counts over the whole party, element counts with the
HOLDER excluded — through `computeHolderElementCounts`, one loop shared with
the parser); a definitive `false` drops the effect and a chip left with
nothing, `null` still lists. Measured headless: with Xiangling the tooltip
reads Anemo + Pyro; with Lauma or Kazuha the chip is gone, which is the kit —
A1 grants nothing without a Pyro/Hydro/Electro/Cryo teammate (gcsim returns
early). ⚠️ Every other composition-gated passive in the corpus (the faction
tiers) now answers on this surface too; the runtime-gated ones are unchanged.

And a stale caveat, also Nate's catch: the base normal's "Shown as Physical;
in game, Normal and Charged Attacks in the Sturm und Drang stance deal
Elemental DMG…" described the tool before the two-claymores round. Retired,
with the note on the entry.
