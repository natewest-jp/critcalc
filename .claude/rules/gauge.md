---
paths:
  - 'src/lib/sim/aura.ts'
  - 'src/lib/sim/reactionBridge.ts'
  - 'src/lib/sim/absorb.ts'
  - 'src/lib/utils/gauge.ts'
  - 'src/lib/utils/icd.ts'
  - 'src/lib/utils/auraDisplay.ts'
  - 'src/routes/(scene)/(tools)/visualizers/lib/**'
---

# The gauge, ICD and reactions

Budget: about 10,000 characters. Rules in the present tense; the reasoning is in the gauge round records (`docs/rounds/gauge-round*.md`) and `docs/rounds/icd-group-round.md` §9 (⚠️ its §3 and §8 describe the model before the change).

## One model, two shapes

- `src/lib/utils/icd.ts` holds `simulateIcd` for the ICD instrument and `createIcdClock`/`icdApplies` for the parser. The batch form is written in terms of the streaming one so they cannot drift.
- `createGauge()` is the live gauge the sim drives, and `simulateGauge` is a loop over it. Never add a rule to only one of them.

## ICD

- Clocks key on `(character, tag)` with tag `normal` or `charged`, and live at parse scope beside the aura, so a swap-out neither resets nor freezes one.
- A cast is not gated by the swing clock: ICD counts hits, and a cast event is an ability. A cast's own `application[]` runs a per-cast counter in `resolveCastApplications`; `CastAbility.noICD` turns it off. A cast's hits share one counter; counters are never shared across casts.
- `CastAbility.icdGate`, `NormalAbility.chargedIcdWindow` and `summonTick.icdGate` all translate through one `icdParamsFor`, so the shapes cannot drift. `ElementalApplication.noICD` puts one hit on no counter. `summonTick.icdGate` sits on the trigger, not the summon, because one summon can carry several series with different gates (lint D.27b).
- Read a cadence off the frames audit's §4b "gcsim cadence", never infer it from an applied count (lint D.27c holds the frames unit).
- ⚠️ `resolveActionIcd` returns `null`, not `NO_ICD`, for gcsim's `ICDTagNone`: an untracked source must not reset a counter it shares a tag with.
- Two blanket rules live in code rather than in every JSON (never mass-annotate the default): plunges always apply, and catalyst charged attacks always apply. A physical swing applies nothing, so it spends no budget.
- `chargedIcdWindow` is a measured `(timer in frames, every)` pair, authored on the characters gcsim gives `ICDGroupPoleExtraAttack`. ⚠️ It must never become a `weapon === 'polearm'` branch: not every polearm user has it, and a sword user does. The oracle cannot see it (no fixture spams a polearm charged attack), so measure it directly. ⚠️ Units: `summonTick.interval` is seconds, this is frames (lint A.4b).
- `IcdWindow.cap` is applications per window (lint D.27f). Every gcsim list but the reaction groups ends in 0, so a window applies on 1, 1+every, … and stops. ⚠️ A list is not a cycle: `{1,0}` means the first only.
- Pair a gate with the stream our series models, never with the character (Emilie's burst runs its level-3 phase on the default group and is deliberately bare).

## The gauge

- `ctx.aura` is a real elemental gauge. Frame order within frame F is a contract: `advanceTo(F)` runs tasks and decay for every frame before F, `apply()` lands at the top of F, and F's own tasks fire when the gauge leaves it. ⚠️ The idle skip must never skip a frame with an unflushed application: its post-sample closes a series interval.
- The gauge wakes the clock for one case only: a Burning tick pops any dendro core, so `armCoreWake` schedules a task at the next tick while a core is live or spawning (`nextCoreContactFrame`). Never add a wake-up for an instant with nothing to dispatch.
- A dendro core is a target of its own: a hit the enemy's ICD refused still pops one (`Gauge.contact` / `offerCoreContact`, kept out of `applications`). Cores live in `gauge.ts` (30f spawn delay, 6s life from KQM, cap 5). Taking one costs the trigger nothing.
- `ParsedRotation.applications` is what the gauge was fed. Never reconstruct the application stream from IR events.
- The feed order is time order: the cast pipeline schedules before it advances. `collectApplications` deliberately does not sort, so a regression can't be silently absorbed; the invariant is pinned in `notationParser.ir.test.ts`.
- Summon ticks apply their element through a chain that schedules one tick at a time and re-asks whether the summon is alive. This works because the clock is monotonic. Never a parallel live registry. Uptime is read live off the extension record, swap-out from `ctx.lastSwapOutAt`, and a recast stops a chain through a generation stamp.

## Reactions

- `sim/reactionBridge.ts` is the one table that knows both reaction vocabularies (gcsim's `swirl` + `of`, ours `pyroSwirl`). These conversions replace the base reaction: superconduct → Stellar Conduct, Cryo Swirl → Stellar Swirl, Electro-Charged → Lunar-Charged, Hydro Crystallize → Lunar-Crystallize. Bloom → Lunar-Bloom is the one that adds instead. ⚠️ An adding conversion fires twice if an effect lists both sides.
- The bridge can also answer nothing: `crystallizeBlocked` is crystallize's 1s cooldown.
- A buff on the base reaction is not a buff on the converted one. Venti, Lohen and Diona going dark in an enabler team is correct.
- `enablesReactions` is the arming switch. Stellar Glimmer is an umbrella term, never a `Reaction` member. Radiance needs no schema: `teamEnablesReaction` + `teamElementCount`, with `not(Conduct)` for precedence.
