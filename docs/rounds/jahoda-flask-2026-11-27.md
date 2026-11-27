# Jahoda's flask — a stance that ends on the live gauge (2026-11-27)

**Status: ✅ built** on `feat/jahoda-flask`. Nate: build the flask from `jahoda-robots-2026-11-27.md` § What's left (⚓ Nate 2026-11-27: model the fill and gcsim's E re-press exit, no attack exit), then the Meowballs under Ascendant Gleam and C6 at the fill, then update the day's What's new entry in all three languages.

## What gcsim does (at 41bfe4915, `jahoda/skill.go`, `cons.go`)

- **The press** enters Shadow Pursuit at `skillWindup` = 30f for up to `shadowPursuitMaxDuration` = 334f, so the longest stance is 364f. `skillFrames` is `InitAbilSlice(42)`: a re-press 42f after the press.
- **The flask.** `fillFlask` polls from 30 + 7 = 37f every 30f, P > H > E > C with the locked element first. The first match locks; the locked element adds 20 and any other adds 10, capped at 100. At 100, `drainFlask` runs 4f later. A steady aura fills it at 157f, so the stance ends at 161f.
- **The ends.** `drainFlask` runs at the full flask's +4f, at the re-press (at once), or at 364f, whichever comes first, and reads the flask then. Full: Filled Treasure Flask 2f later. Otherwise: Unfilled Treasure Flask 4f later. Both Anemo, Durability 25, ICDTagElementalArt. `cancelPursuit` sets the cooldown to 930f from there.
- **The hold.** While the stance runs, the press's `Frames(next)` is `(F − src) + skillCancelFrames[next]`, which never comes due; after it, `pursuitDuration + skillCancelFrames[next]`. So nothing but the re-press starts during the stance, a swap included, and the next action starts `skillCancelFrames[next]` after the drain (N 43, Aim 42, Q 42, D 41, W 44, swap 41, else 48).
- **Meowballs**, under Gleam on a full flask: from 129f after the drain, every 116f, ten of them (10 points each), in the flask's locked element, ICDTagNone, landing `travel` = 13f after each. The next press deletes them.
- **C6**, at a full drain under Gleam: CRIT Rate +5% and CRIT DMG +40% for 20s to each party member with Moonsign.

## What we built

- **`StanceFill`** (`endsOnFill` on a skill stance; `sim/stanceFill.ts`). The flask polls the live aura on the clock in `Band.LAND`, so it sees every application before the poll, a teammate's summon included. A full flask clamps the stance through `clampStance`, which moves the stance-end cooldown, and `clampStance` calls the flask back (`StanceRecord.fill.onEarlyEnd`), so the re-press's `endsStance` clamp drains through the same path. One drain, at whichever end comes first, reading the flask's points at that instant (a re-press in the 4f between the fill and the drain drains full, as in gcsim).
- **The drain is the cast's one hit**, landed in `run.ts` at an instant known only then: the gauge offer (through `emitReactionsAtCast`, anchored at the end), the live hit record, and `CastEvent.hitsAt` for the buff pass. The press's synchronous hit is skipped. The press's `application[]` is now `[]`.
- **The hold.** At the token loop's head, any E, Q or label action but the in-stance re-press runs the clock to the stance's live end (task by task, `runToStanceEnd`: a poll during the wait can bring the end closer, and one advance to the old end overshot it in the first run), then to the end plus `afterEnd`'s slot. The turn's end does the same for the swap. It subsumes `holdsField` for Jahoda (the Mizuki round's F7).
- **`Summon.spawnsAtFill {conditions?}`**: spawns at the full flask's end, if its conditions hold then. The drain takes the flask's lock on the summon's absorb key, so an `absorbed: 'twin'` series lands in the flask's element; `ctx.fillSpawns` tells finalize where it spawned, beside the swap-out spawns' map. `terminatesOn: 'skill'` ends it at the next press (lint D.22b now allows the host's own kind for a fill spawn: a recast is keyed by the next spawn, a fill, and the press is what ends it).
- **`BuffEffect.opensAtFill`** anchors an `onCast` skill buff at `CastEvent.filledAt`, beside `opensAtLock`.
- **Lint D.58**: the flask's shape (integer frames and points, the four elements, both drain hits, a FrameMap after the end, `cooldownStartsAtStanceEnd` beside it); `spawnsAtFill` only beside `endsOnFill`; `opensAtFill` only on an `onCast` skill buff of such a character.
- **Data.** The press: `frames {anim: 42}`, `application: []`, `endsOnFill`, the Meowball summon (19.55s, the last fire at 129 + 9 × 116 = 1173f; 243.2% ATK; Gleam on both the spawn and the series). A new sibling, **End Shadow Pursuit**, the in-stance re-press (`endsStance {at: 0}`, `skillCancelFrames`), in the Mizuki form. C6: two `active`-target buffs gated on C6, Gleam and the receiver's Moonsign (`activeCharFaction`, the Linnea A4 form), `opensAtFill`, 20s. The skill's and C6's caveats are gone (both described what is now drawn), with their kit notes.
- **Names.** "Meowball" is the talent table's row ("Meowball DMG": ニャンコボール, 猫猫球). "Shadow Pursuit" is a `BY_HAND` part (her skill text: 影追撃, 掠影追袭).
- **Team Builder.** The Meowballs add a Gleam-gated off-field damage source; C6 adds CRIT Rate and CRIT DMG buffs at C6.

## Tests

`sim/jahodaFlask.test.ts`: a steady Pyro aura ends the stance at 161f, with the Filled hit at 163f, N1 at the end + 43f and the cooldown at the end + 930f; no aura runs 364f and drains unfilled at 368f; a swap waits for the end; the re-press ends it at 42f and drains at 46f; ten Pyro Meowballs under Gleam at the end + 142 + 116k, each applying; none without Gleam or without a full flask; C6 on Jahoda and Flins from the drain, not on Bennett, not at C5, not from an unfilled flask. `notationParser.ir.test.ts`'s summon oracle treats a fill spawn like a swap-out spawn (containment only).

## Not modelled, and one divergence

- The Smoke Bomb when the dash misses (gcsim has none), the Meowballs' Energy, C1's bounce (a coin flip, unchanged), the three-target spread, hitlag.
- ⚠️ **Flagged for Nate:** the kit text says that under Gleam a full flask is "not immediately" discharged, which reads as no Filled Treasure Flask hit. gcsim deals the Filled hit and then the Meowballs, with no comment saying it was tested. We follow gcsim.

## What to look at

On `Bennett E > Jahoda E N1` with Flins and Ineffa: Jahoda's stance pill ends 2.68s after her press, not 6.07s, with her N1 0.72s after that. Below it, a Meowball row starts where the pill ends, with ten Pyro stubs, the first 2.37s in and then every 1.93s. The aura lane shows those ten Pyro applications. Her skill's cooldown tail is 15.5s from the pill's end. Swap Flins and Ineffa for Xingqiu and Kaeya and the Meowball row is gone; the pill is unchanged. `Jahoda E N1` with no aura keeps the full 6.07s pill and lands its hit at 6.13s. At C6 with Flins, a CRIT buff row starts at the pill's end on Jahoda and continues on Flins after the swap. The robots are unchanged.

## What's new

Held as a proposal (the report lists it).
