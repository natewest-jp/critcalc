---
paths:
  - 'src/lib/sim/**'
  - 'src/lib/utils/notationParser*.ts'
  - 'src/lib/utils/effectCollection.ts'
  - 'src/lib/utils/tokenizer.ts'
  - 'src/lib/utils/buffWindows.ts'
  - 'src/lib/utils/rotationEvents.ts'
---

# Parser and sim

Budget: about 10,000 characters. Rules in the present tense; the reasoning is in the round records under `docs/` (start with `docs/gauge-round-L3.md` for the sim's shape). The gauge, ICD and reactions are in `.claude/rules/gauge.md`; field meanings in `.claude/rules/schema.md`.

## Shape

- `src/lib/utils/notationParser.ts` is a façade: resolve the team's static facts, build a `SimContext`, run, finalize. ⚠️ Every name a consumer ever imported from it is still exported from it.
- Inside `src/lib/sim/`: `run.ts` is the driver, `clock.ts` the frame clock and task queue, `context.ts` the shared state, `aura.ts` the live gauge's wiring, `finalize.ts` the late pass, and `procs.ts` the one registry for every proc trigger.
- One clock, `clock.now`. It jumps to the next scheduled instant, never walks frames: `MAX_TIME_ADVANCE_F` bounds a single token, and a document full of waits adds up to hundreds of millions of frames.
- `buffWindows.ts` is deliberately not clocked: it is a finalize projection fed identical inputs.
- Variant matching is condition-aware (a variant's `conditions` must evaluate true; the parser builds team context for `teamElementCount`/`teamFaction`). `DEFAULT_ASCENSION = 4`.
- Short-lived states after an action (KQM `sQ`, plunge landings, first-swing recovery) ride the post-action transient-state primitive: `opensTransientState` on instant casts, `actionOpensState {normal?, plunge?}` on normals. A spec's `consumes: State[]` closes named windows when it opens; a variant's `consumesState` closes them at the cast; `bypassesCooldown` skips the burst clock.

## The IR

- `parseNotation` emits `events: TimelineEvent[]` (time-sorted `cast`/`action`/`reaction`/`shieldEnd`/`nightsoulBurst` points, each with a stable `id`) and `windows: TimelineWindow[]` (spans with final ends, every extension and truncation applied, with `sourceCastId`/`sourceActionId` provenance). Types are in `src/lib/utils/rotationEvents.ts`.
- Action events are per swing for normals (`N5` makes five events sharing a `blockId`, each with `comboIndex` and `element`).
- Bars, input blocks, NB rows and buff rows are projections of the IR. Invariants are guarded corpus-wide by `notationParser.ir.test.ts`; behaviour by `buffWindows.test.ts`.

## Hits, buffs and stacks

- Per-swing hit records (at the swing's end; no element means physical; a multi-hit swing is one hit, a documented approximation) drive `gainStacks`/`consumeStacks` dispatch, `Effect.procCooldown`, and `holderStatesAt`.
- `deriveBuffWindows` (`buffWindows.ts`, at finalize) computes all of who buffs whom and when, as `buff` windows with their effects and trigger-time context. `parseNotation` takes `teamCharacters` (the slot roster) for team context.
- Off-field summon damage ticks become synthesized hits at finalize. They feed `deriveBuffWindows` only, never `dispatchHit`, which mutates live state in parse order.
- The live tick chain in `sim/aura.ts` dispatches gains, then a snapshot, then consumes at the tick's own instant, and the hit carries that snapshot (`ctx.tickStacks`). ⚠️ Never dispatch from both ends: they are one tick seen twice. A heal tick is not a hit.
- `computeSummonTicks` is parser-side; don't fork it (`summonSubrows` re-exports it).
- Artifact `onHit` is the fourth artifact branch beside onCast and onReaction. It is rotation-wide (a summon ticks while its owner is off field), canonicalises effects to one representative shape, and pools within a (debuff, duration) partition so a multi-stat set draws one bar.
- `finalize` stamps a summon's tick markers onto `TimelineWindow.ticks` once, in the late pass over `windows`, and the projection reads them. ⚠️ Never walk them inside `emitSummon`: recast truncation shortens the prior window after it is pushed.

## Infusion

- An `infuse` Effect is a timed grant from a cast that can land on someone else; `NormalAbility.infusion` belongs to a stance, and the stance is its window.
- An `active`-target infusion needs no per-receiver window: only the active character swings, so the swinger is the receiver.
- One condition tree carries two subjects: `constellation` is the holder's and known at the cast, `weaponType` is the receiver's and known only at the swing. The cast site drops a window only on a definitive false; the swing re-evaluates with the receiver's weapon.
- A granted infusion resolves per swing, and the input block splits where the element changes. A stance infusion wins over a granted one; the newest grant wins. ⚠️ A window is never truncated on swap (Bennett's is still there when you swap back).

## Constellation gating

- `effectSourcesAtConstellation` (`src/lib/utils/effectCollection.ts`) is the one walk of a character's effect surface. Never reintroduce `[...abilities, ...passives, ...constellations]` at a site that decides something.
- Gate the walk that asks "does this fire", never the walk that asks "what keys exist". The four key-space walks in `stacks.ts` stay ungated. Don't double-gate `deriveCapabilities`.
- Guarded by `constellationGating.test.ts`. Record: `docs/constellation-gating-plan.md` §7.

## Off-field damage and proc listeners

- `source: 'active'` refuses a hit delivered by an entity (`Offer.viaEntity` / `HitEvent.viaEntity`). Never use an id comparison: a tick carries its owner's id.
- A listener belongs to the entity (`holder::host::index`), not to the authored object, and never fires off its own output.
- 1.5U is an ICD-group multiplier, not a durability.
- The coordinated-attack stream is any damage the opponent takes, summons included.
- The tick onHit pass is rotation-wide per character and hands the tick dispatchers a null segment pool. An empty stacks map and `undefined` are different answers.
- Records: `docs/mark-triggered-damage-round.md`, `docs/coordinated-attacks-round.md`.

## Human timing

- `sim/humanTiming.ts` models input buffering, not a slowdown. N→N (and N→C off a non-bow) is free; every other transition takes the player's pad. A swap takes ping + 90 ms (`swapFramesForPing`). A pad is not an IR event (`InputBlock` kind `'pad'`).
- State lives in `siteSettings`, never in `?r=`. The 2-frame input lag is already in every cancel number. gcsim's `human` preset applies only `swap_delay`, so there is no oracle.
- Buffering after a charged attack is per character (`noBufferAfterCharged`). Don't flip the default without a source.

## Notation length

- `MAX_NOTATION_CHARS` (`tokenizer.ts`) is enforced by both `decodeRotation` and the editor, so the two entry points cannot drift. It is a safety guard against a hostile `?r=` link, not a product limit.
- Never bound cost with semantic caps ("nobody writes ten Qs"). Fix the algorithm. Record: `docs/parser-hardening-2026-08-14.md`.
