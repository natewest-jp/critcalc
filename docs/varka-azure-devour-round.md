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

- **The pixel for a spent charge.** An `sC` that paid draws nothing but its own
  block; the E lane has no pill for it, so the cost shows only as where the next
  `sE` can land. `ActionEvent.spentCharge` carries what a ghost tail from the
  block or a tooltip would need. The last round's ruling for the reduction (no
  bar, no printed amount) argues for leaving it; the ghost tail's own ruling
  ("its END is where a reader looks to answer when can I recast") argues for
  drawing one. ⏭ Nate.
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
  it. ⚠️ The notation EDITOR still highlights `sE`/`Q` in Varka's own Anemo —
  the highlighter reads the eager index and has no party to resolve a ref
  against, the same limit that leaves timed infusions neutral there.
