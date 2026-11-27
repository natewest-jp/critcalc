# Buffs chosen by the absorbed element (2026-11-27)

**Status: ✅ built** (`feat/absorbed-condition`). Nate: continue absorption from the Prune record's § What's left, Wanderer's A1 and Sucrose's C6 first, as one shared condition on the locked element. What's new stays held until the batch is done.

## What gcsim does (at 41bfe4915)

- **Wanderer, Jade-Claimed Flower.** `skill.go` calls `absorbCheckA1` at the press, before the 2f hit. `asc.go` runs `AbsorbCheck` twice over Pyro > Hydro > Electro > Cryo, deleting the first match between, so one press can take two elements. Pyro is +30% ATK and Cryo +20% CRIT Rate, each 1200f; Hydro raises the Kuugoryoku cap by 20; Electro restores 0.8 Energy per N/CA hit (12f ICD). `skillEndRoutine` deletes all of them when Windfavored ends. C4 adds one random further branch.
- **Sucrose, Chaotic Entropy.** `burst.go`'s `absorbCheck` polls from 136f every 18f; at the poll that locks it calls `c6()` once, and `cons.go` gives every party member 20% DMG Bonus of that element for 600f (Hexerei members +8.57% more).

## What we built

- **The `absorbed` Condition** (`{type: 'absorbed', element}`): true when the triggering cast's lock took that element. Finalize stamps `CastEvent.absorbed` (the cast's own `cast#id` lock, or the lock of a summon it spawned), and the buff pass's `statesAt` hands the set to the gate as `ConditionContext.absorbed` at every cast site. Away from a cast it stays null. In the Team Builder it is an element ingredient (`teamNeed`), with the caveat label `absorbs:<element>`.
- **`AbsorbSpec.picks`**: one draw takes up to N held elements in order (`AbsorbLock.also`). Wanderer's is 2.
- **`BuffEffect.opensAtLock`**: the window opens at the lock instant, not the cast (Sucrose).
- **Lint.** C.21: an `absorbed` leaf only on an `onCast` effect whose cast kind locks. B.14c: `opensAtLock` only beside one. D.54: `picks` only on a one-draw lock. And the condition-shape lint now refuses an unknown condition `type` (`CONDITION_TYPES`, a `Record` over the union).
- **Data.** Wanderer's skill carries `absorbs {P > H > E > C, from 0, picks 2}`; the two A1 buffs read `absorbed` and carry `whileState: inStance`. Sucrose's C6 is four `team` buffs, one per element, `opensAtLock`, 10s.
- Test: `src/lib/sim/absorbedCondition.test.ts` (six cases), written first and failing on all but one.

## Found on the way: Wanderer's A1 drew on every press

The 2026-09-21 re-trigger round restored both A1 buffs with a placeholder condition type, `<absorbedElement — DOES NOT EXIST>`. `evalCondition`'s default case answers an unknown leaf with an optimistic null, so since then every Wanderer E has drawn +30% ATK and +20% CRIT Rate, whatever the aura, under a caveat saying they never appear. Fixed by this round, and the new lint check stops the class.

## Not done

- **Sucrose C6's length** is gcsim's 10s from the lock. The kit text says "during its duration" (the burst's 6s, 8s at C2). It is still the in-game bounty from the survey (§6.4, §8.4).
- **Wanderer's Hydro branch** would lengthen Windfavored by 2s (20 points × 6f); the stance is a fixed 10s, so the caveat says so. The Electro branch's Energy draws nothing (an under-claim, no caveat). C4's random branch stays `notModeled`.
- gcsim reads Wanderer's draw in a circle on the player, whose own aura counts; ours reads the one target.
- The oracle cannot reach either: the dumper runs one character in an empty core.

## Copy held for Nate

1. Team Builder phrase, new (en "after absorbing {element}", ja "{element}を元素変化した後", zh "转化{element}元素后").
2. Wanderer, Jade-Claimed Flower caveat. Now: "Not modeled: the absorption buffs — Cryo’s +20% CRIT Rate and Pyro’s +30% ATK never appear." → "With Hydro absorbed, Windfavored is drawn 2s short: the 20 extra Kuugoryoku Points aren’t tracked."
3. Sucrose, Chaotic Entropy caveat. Now: "Not modeled: the party-wide 20% DMG bonus for the absorbed element, or the further 8.6% Hexerei party members get." → "Hexerei party members get a further 8.6% that isn’t shown."

The old lines were wrong once the buffs draw, so the new ones are landed (with ja and zh) and held for a ruling.
