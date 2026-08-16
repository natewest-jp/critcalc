# L5 — the gauge replaces the coarse aura

**Status:** planning · opened 2026-08-16
**Reads:** [`gauge-round.md`](gauge-round.md) (the contract) · [`gauge-round-L3.md`](gauge-round-L3.md)
(the machine) · [`gauge-round-L4.md`](gauge-round-L4.md) (the data)

> The payoff landing. `AuraState` — a set of flags with no units, no decay and no
> consumption for Anemo/Geo — is deleted, and `simulateGauge` takes the field.
> ⚓ **L5 merges on a MEASURED improvement, not on being finished** (contract §5).

---

## 1. What is actually wrong today, in one line each

| symptom                                                                   | cause                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------ |
| a melt at t=120 s off a Cryo aura applied at t=0                          | `AuraState.applied` is a `Set` that never decays |
| 14 pyroSwirls from one Xiangling E                                        | Anemo neither consumes nor taxes                 |
| a VV RES-shred bar that never ends                                        | both of the above, on the buff surface           |
| every Geo cast crystallizes                                               | no crystallize GCD                               |
| 57 applications where gcsim emits 201                                     | summon ticks apply nothing                       |
| no hyperbloom timing, no burning re-application, no frozen/quicken gauges | there are no gauges at all, only flags           |

⚠️⚠️ **The first four and the fifth pull in OPPOSITE directions, and that is the
whole trap of this landing.** The contract says it plainly (§1): _"the two errors
partially cancel by luck … that cancellation breaks the moment summon ticks land."_
Landing the gauge WITHOUT summon application would make every aura decay honestly
while the things that actually sustain it in game — Guoba, Oz, the rain swords —
still contribute nothing, so vaporize/melt buff bars would **vanish** and the tool
would look worse while being more correct in isolation.

⚓ **So L5 lands both halves or neither: precision (the gauge) and the recall we can
reach (summon ticks feeding it).** The recall we cannot reach is DATA (summons the
corpus does not author at all) and is enumerated, not fixed, here.

---

## 2. The shape — one model, two shapes (the `icd.ts` precedent)

`simulateGauge` is a BATCH function: hand it every application, it frame-steps 0 →
end. The planner is a clock that JUMPS and learns its applications one at a time.
⛔ A second gauge implementation for the planner is the one outcome this round must
not produce.

So `gauge.ts` gets the same treatment `icd.ts` already has:

```
createGauge(opts)  →  a live gauge: advanceTo(frame) · apply(element, units, source) · takeEvents()
simulateGauge(...)  =  createGauge + a loop over sorted applications   ← the batch, WRITTEN IN TERMS OF THE STREAM
```

⚓ **The batch form is rewritten on top of the streaming one, never beside it** —
that is what makes drift impossible, and `gauge.test.ts`'s 26 tests are the gate
that it still produces byte-identical output for the instrument.

**Frame ordering inside one frame F is a contract lifted from the current loop:**
applications land BEFORE internal tasks, decay runs when the frame is LEFT. So
`advanceTo(F)` runs tasks and decay for every frame `< F` and stops at the top of F;
`apply()` lands at the top of F; the tasks at F fire when the clock next leaves it.

⚠️ **The idle skip is a correctness requirement, not an optimisation** (C6, amended
at L3a). With every gauge at zero and no internal task pending, `advanceTo` JUMPS —
it does not walk. 14 KB of legal `~3600s` tokens is 432,000,000 frames; a gauge that
frame-walks idle time freezes the tab. Continuous work stays bounded by **aura
lifetime** (`2.5·U + 7` s), never by rotation length.

---

## 3. The bridge — gauge `ReactionKind` → our `Reaction`

The gauge speaks gcsim's ontology; the corpus speaks ours. One module,
`$lib/sim/reactionBridge.ts`, and nothing else may know both vocabularies.

| gauge emits                             | we emit                                                        |
| --------------------------------------- | -------------------------------------------------------------- |
| `swirl` + `of: pyro/hydro/cryo/electro` | `pyroSwirl` / `hydroSwirl` / `cryoSwirl` / `electroSwirl`      |
| `swirl` + `of: frozen`                  | `cryoSwirl` (a frozen aura swirls as Cryo)                     |
| `crystallize` + `of`                    | `pyroCrystallize` / … / `electroCrystallize` (+ see below)     |
| `crystallizeBlocked`                    | **nothing** — the 1 s GCD ate it, and that is the fix          |
| `vaporize` / `reverseVaporize`          | `vaporize`                                                     |
| `melt` / `reverseMelt`                  | `melt`                                                         |
| `overload`                              | `overloaded`                                                   |
| `superconduct`                          | `superConduct`, or `stellarConduct` when an enabler is on team |
| `freeze`                                | `frozen`                                                       |
| `electroCharged` / `burning`            | same names                                                     |
| `bloom` / `quickenBloom`                | `bloom`                                                        |
| `quicken` / `aggravate` / `spread`      | same names                                                     |
| `hyperbloom` / `burgeon`                | same names — ⚠️ **new to the gauge, see §4**                   |

Two reactions are OURS and have no gauge equivalent, so they are applied at the
bridge exactly as `computeReactionsForApplication` applies them today:

- **`lunarCrystallize`** — pushed alongside a crystallize when the team carries 2+
  Moonsign.
- **`stellarConduct`** — REPLACES `superConduct` when `teamEnabledReactions` has it
  (⛔ replacement, not addition — one enabler converts all of it).

⛔ `shatter`, `lunarBloom`, `lunarCharged`, `stellarSwirl` stay unemitted, exactly as
today. This landing changes the ENGINE, not the reaction vocabulary.

---

## 4. What must not regress

### 4.1 hyperbloom + burgeon — the gauge does not have them yet

The coarse model counts `bloomCores` and emits `hyperbloom`/`burgeon` when Electro or
Pyro lands on one. `gauge.ts` emits a `core` event and then **forgets it** — L1
recorded dendro cores as knowingly absent. Swapping engines as-is would silently
delete two reactions that four characters author against.

⚓ **So L5 gives `gauge.ts` cores**, minimally and in gcsim's shape: a core is a thing
in the world with a lifetime (6 s), a field cap (gcsim: 5 in play), and it is consumed
by an Electro trigger (hyperbloom) or a Pyro trigger (burgeon); unconsumed, it expires
on its own. ⛔ No damage, no projectile seeking, no core-vs-core targeting — the
mechanics we model are "does this reaction happen, and when."

### 4.2 Buff-window emission order (C2)

`deriveBuffWindows` stays a finalize projection over identical inputs
(L3 §4.1) — ⛔ still not clocked. But L5 **does** change its inputs: new reactions at
new times, and (§5.3) summon ticks that now feed the aura. Rows WILL move, and that is
the landing, not a defect. ⚠️ The gate is Nate's eyes on the timeline plus the oracle,
⛔ never IR equality — L5 is explicitly a behaviour change, like L4.

### 4.3 ↻ Attribution — CORRECTED at L5a, and the correction deleted a field

The plan said: an IR `reaction` event needs a `characterId`, a Burning tick's Pyro has
no caster, so the gauge should carry an opaque "who ignited this" token through its
internal chains for the bridge to resolve. It was written, and then the case it exists
for turned out **not to exist**:

⚓ **An internal application can never react.** The Burning chain is the only thing
that applies an element nobody cast, and every element that would REACT with its Pyro
— Hydro, Cryo, Electro — reacts on contact and therefore can never be sitting there as
an aura when the tick lands. A 400-case sweep produces zero reactions with a null
`appIndex`, and `gauge.test.ts` now pins that as a property rather than a hope.

⛔ So the token is gone: it was a field with no reachable case, which is exactly what
this repo's `orphanedSchema` discipline exists to prevent — and it does not become
right by being about TypeScript instead of JSON. The consumer states the dependency
instead of guessing a fallback.

#### The original reasoning

An IR `reaction` event needs a `characterId`; a Burning tick's Pyro has no caster. ⚓
**The gauge carries an opaque source token through its internal chains** — a Burning
chain remembers the application that ignited it — and the bridge resolves that token
back to (characterId, castKind). ⛔ An unattributed reaction cannot be dispatched at
all (`dispatchOnReactionExtensions` is keyed by holder), so dropping the token would
silently discard every tick-borne reaction.

---

## 5. The sub-landings

Each is one commit, gates green (`vitest` · `check` · `lint` · `build`) before the next.

### L5a — the streaming gauge

`createGauge()` in `gauge.ts`; `simulateGauge` rewritten on top of it. Zero consumer
changes. **Gate:** the 26 existing gauge tests, plus streaming/batch equivalence over
the instrument's presets.

### L5b — cores, and the bridge

`gauge.ts` gains dendro cores (§4.1). `$lib/sim/reactionBridge.ts` maps the two
vocabularies (§3) with its own unit tests. Still no consumer: the coarse model is
untouched. ⚠️ The instrument gains `hyperbloom`/`burgeon` rows — check its
`REACTION_NAME` map is total.

### L5c — the swap ⚓ THE LANDING

`ctx.aura` changes type. `emitReactionsForApplication` feeds the gauge and emits what
the bridge returns; `AuraState`, `createAuraState`, `computeReactionsForApplication`
and `updateAuraStateAfterApplication` are DELETED. The gauge's next internal instant is
scheduled as a `Band.TICK` task so a Burning tick's reaction dispatches in true clock
order rather than being noticed late.

⚓ **`units` is read here** — `application[]`'s third field, whose only consumer was
always going to be this (C3's split table). Absent → 1U, which is 688 of 835 measured
durabilities anyway.

**Measured by:** the L0 oracle, tiers 1 and 3, and tier 2 for the first time.

### L5d — `units` authored (data)

The gcsim dumper already measures durability and the report already prints `(1U)` /
`(2U)`. One migration pass over the 233 abilities with applications. ⛔ Review-candidate
generator → `migrate-application-schema.mjs` writes; the audit never does.

### L5e — summon ticks apply their element ⚓ THE RECALL HALF

Summon damage ticks become `Band.TICK` tasks that offer their element to the gauge,
behind a per-summon ICD clock.

⚠️⚠️ **The finalize-time hit synthesis (step 6c) STAYS WHERE IT IS.** It exists because
a summon's final end is only known after recast/swap truncation, and it feeds
`deriveBuffWindows`. Moving it would move `hits` order — the one thing L3 refused to
spend. The tick APPLICATION is a separate consumer of the same
`computeSummonDamageTicks` rule, so there is one rule with two readers, ⛔ never two
copies of the walk.

Live truncation is handled the way the contract's table says (§2): the tick task
re-checks the summon's liveness when it FIRES, so a recast or a `terminatesOnSwap` that
lands earlier in clock time simply stops the chain.

### L5f — measure, record, merge

Oracle re-run, the residue enumerated, `gauge-round.md` §5 updated, memory written,
`test:e2e` before the merge.

---

## 6. The measurement

⚓ **Quote the recorded baseline, never recompute it** (memory `project_gauge_round`).

| metric                       | L0 baseline | post-L4 | L5 target                 |
| ---------------------------- | ----------- | ------- | ------------------------- |
| applications — ours          | 63          | 57      | up, toward gcsim's 201    |
| **we apply, gcsim does not** | 1           | 0       | stays 0                   |
| **gcsim applies, we do not** | 138         | 144     | down                      |
| element mismatch             | 0           | 0       | stays 0                   |
| aura trajectory (tier 2)     | —           | —       | **first comparison ever** |

⚓ **Tier 2 is L5's real scoreboard.** gcsim logs the aura gauge before and after every
application; the oracle already records it and says _"REFERENCE ONLY until L5."_ L5
makes it a diff: for each PAIRED application, our gauge vs theirs. A reaction count can
be right by luck; a trajectory cannot.

⚠️ **Reaction counts are still not a comparable pair** — ours is one event per
application, gcsim's is one damage instance, and burning and EC tick. Compare presence
and magnitude, never equality.

---

## 7. Risks

| risk                                                                                                                                          | handling                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Buffs shrink and it reads as a bug.** Honest decay ends bars that used to run forever.                                                      | Expected and stated. §1's cancellation is why L5e is not optional.                                          |
| **The recall ceiling is DATA, not engine.** Many summons gcsim ticks are not authored in our corpus at all (Kaeya's Glacial Waltz ticks 13×). | Enumerate from the frames-diff report §5; it is L4-family follow-up work, ⛔ not a reason to hold L5.       |
| **A self-rescheduling gauge task and `clock.drain()`.**                                                                                       | Chains are bounded by fuel/aura lifetime. Pinned by a test that a burning chain at rotation end terminates. |
| **Perf** — the editor re-parses per keystroke and the gauge frame-walks live auras.                                                           | Bounded by aura lifetime with the idle skip; measure a 120 s rotation and record it here.                   |
| **Per-ability ICD tag + group is still the top schema gap** (L4).                                                                             | Unchanged by L5: casts stay gated within a cast, not across. ⛔ Do not widen the gate here on a guess.      |
