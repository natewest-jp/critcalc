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

## 4. Read against gcsim, 2026-09-17 — ⏸️ HELD for another session (⚓ Nate)

Three decisions the plan above did not settle, found by reading
`~/Code/gcsim/internal/characters/columbina/{skill,asc,cons}.go`:

- **The Interference hit is Durability 0** (`ICDTagNone`, `Durability: 0`): it
  applies NOTHING to the gauge. The fire is a MARKER and its buffs, not an
  application — a marker in the aura lane, or a lane row?
- **C6 is not tick-fired.** gcsim subscribes to `OnSpecialReactionAttack` and
  adds +80% CRIT DMG to a Lunar reaction hit when the attacker holds a status
  the Lunar reaction hooks set; authoring it as an 8s team buff on the fire
  would over-claim. Caveat this round, or model the status?
- **The fire's element** is the kind with the most Gravity, with a
  team-composition tie-break; Gravity accrues 10/s (× C2's rate) while a 2s
  status is live, opened by any Lunar reaction or Lunar-tagged hit, only
  while the Lunar Domain is up. One key + "the last Lunar reaction's kind"
  is the simple, stated approximation; three keys + a max is exact but needs
  `onStack` to read several keys.

Settled by reading: A1 (10s CRIT mod), C1 (per kind: Lunar-Charged +6 energy
to the active character / Lunar-Crystallize a 12% Max HP Rainsea Shield for
8s / Lunar-Bloom interruption resistance) and C2 (8s mods) fire from the tick.
Implementation shape: the threshold check sits right after
`dispatchGainStacksOnReaction` in `sim/aura.ts` (the reaction settle point)
and at the cast/hit/tick settle points; the fire pushes a new IR event kind
(`stackThreshold`), consumes the pool, and `buffWindows` anchors `onStack`
buffs on those events the way NB buffs anchor on `nbBars`.

## 5. Record — SHIPPED 2026-09-18 (`engine/stack-threshold`)

_The three §4 decisions, ⚓ Nate 2026-09-18, in order: the fire is a **MARK ON
THE GRAVITY RIPPLE'S LANE** (full height, in the hit's element, nothing in the
aura lane — it applies nothing); **C6 keeps its caveat and waits for §1.G** (it
is not a Gravity mechanic — gcsim fires it on any Lunar reaction while the
burst's Domain is active, and the onReaction buff pass cannot read a
`duringSummon` gate yet); **THREE KEYS, threshold on the sum, the largest key
wins** (`dominant`, ties in key order = gcsim's strict `>` over its index
loop)._

⚠️ One correction to §4 above: Gravity accrues while the **Gravity Ripple** (the
E summon, `skillKey`) is out, not the Lunar Domain. gcsim gates every Gravity
hook on `skillKey`; the kit says "While Gravity Ripple is on the field". The
Domain gates only C6.

### 5.1 The primitive

- **`Trigger` `onStack`** reshaped: `{ keys: string[], count, dominant?,
label? }`. It had no reader and no author; the old `{ count }` form is gone.
  ⚓⚓ **The fire SPENDS the set** — every key to zero at the fire, implicitly.
  That is the only semantics under which "fires at N" fires twice, and an
  explicit `consumeStacks` beside it would be ceremony (gcsim `clearGravity()`).
  A GATE ("while ≥ N") is a `stacks` Condition, not this.
- **`sim/thresholds.ts`** is the ONE reader. `collectStackThresholds` runs once
  per parse into `TeamContext.stackThresholds` (constellation-gated, grouped by
  holder × keys × count — one group is one fire however many effects hang off
  it), so the per-settle check is a no-op for every team but one.
  `checkStackThresholds` runs at the **four settle points where a count can
  move**: the reaction dispatch (`aura.ts` `emitReaction`, after the reaction
  event so the record follows its cause), a cast (`run.ts`, beside the cast's
  own consume — a fire IS a consume, so `stackContext` reads post-gain
  pre-spend), a hit (`run.ts` `dispatchHit`, inside the `teamHasOnHitStackEffects`
  guard), a summon tick (`aura.ts` `dispatchEntityHitStacks`).
- **A key's count is read from its HOME, never summed across homes** —
  resolved from the grants that name it, constellation-ungated (`stackScopesOf`'s
  rule): `rotation` / `onReaction` (team) / `onHit` (team) / `sourceLifetime` /
  `segment`. ⚠️ A segment-home key is readable only where the on-field pool is
  in hand (cast, hit); at the reaction and tick sites it reads 0 — stated.
- **What a fire does, by effect type:** `damage` → a mark
  (`ctx.stackFireMarks`, stamped by `finalize` onto the summon window as
  `fires`, the way `stateGatedTicks` become `ticks`; the lane is the primary
  summon of the E/Q that authors a grant of `keys[0]`), ⛔ NO application;
  `shield` → `pushShieldAt` under the host cast's source, provenance = the
  latest host cast at or before the fire; `buff` → `buffWindows` anchors on the
  `stackThreshold` IR event at three sites (team / active-segmented / self),
  mirroring NB, with the `dominant` gate applied PER EVENT and the stat dedupe
  after it (the buff-pool round's §1.H order); `energy` → nothing, as
  everywhere. Optimistic on an unresolvable condition at all three surfaces, so
  a fire's mark, shield and bars cannot disagree about whether it drew.
- **`StackThresholdEvent`** (IR): `characterId, time, keys, count, dominant,
label?, abilityClass?`. Provenance arm `trigger: 'stackThreshold'` +
  `fireLabel` on `BuffWindowSource`; the rows are named after the FIRE
  ("Columbina Gravity Interference"), keyed apart from the cast pool row.
- **The rate is a `procCooldown` on the grant.** ⚓ A `procCooldown` on an
  onReaction `gainStacks` is honoured now (the onHit dispatcher's rule,
  mirrored; `CharState.onReactionProcLastFire`). Columbina's Gravity accrues
  10/s while a 2s status any Lunar reaction refreshes is live; "20 per reaction,
  at most one grant per 2s" reproduces that under a sparse stream (identical)
  and a dense one (the C0 probe below lands 0.5s from gcsim's instant), where
  the plan's uncapped 20-per-reaction would have fired 6s early on the third
  tick of one EC. ⚠️ Its weakness is a SHORT BURST: four Guoba ticks 1.67s apart
  are two grants (40) and no fire, where gcsim's continuous status reaches 60 —
  named in the caveat. A continuous accrual primitive ("10/s while a state is
  live") would close it and is not built: one holder.
- **The onReaction stack dispatcher takes a holder-state RESOLVER**
  (`holderStatesAt`), not the trigger character's `preStates` map — the holder
  of a `'team'` grant may be off field when the reaction fires, and a
  `duringSummon` gate on such a grant was unresolvable and skipped whenever a
  teammate made the reaction. Byte-identical for the three team grants that
  predate it (Chevreuse, Neuvillette, Varka: no `state` conditions; census
  2026-09-18).
- **Lint:** B.16 (keys non-empty strings, positive integer count, `dominant` ∈
  keys, label a string, effect type one the reader acts on, a `damage` must
  state `application: []`); D.40 (every key has a `gainStacks` author on the
  character, `count` ≤ the keys' summed `max`, effects on one (keys, count)
  agree on `label`); B.12d widened so an EMPTY `application[]` on `onStack` is
  the positive statement "this fire applies nothing" and a non-empty one is
  refused as unread.
- **Guarded by `sim/thresholds.test.ts`** (11 cases on a synthetic hydro
  catalyst with Xiangling and Kaeya as reaction sources; five seeded negatives
  verified by hand — see the file header).

### 5.2 Columbina

Skill: three `gainStacks` keys (`gravityLunarCharged` / `gravityLunarBloom` /
`gravityLunarCrystallize`), `onReaction source: team` per Lunar kind, +20,
`max: 60`, `procCooldown: 2`, gated `duringSummon`; three `onStack` damage
effects (`count: 60`, one `dominant` each, `application: []`, label "Gravity
Interference") replacing the three `manual` ones. A1: CRIT Rate on every fire
(⚠️ drawn at one stack — `BuffEffect.stacks` still has no consumer; the caveat
names it). C1: Rainsea Shield (label authored) on a Lunar-Crystallize fire, +6
Energy on Lunar-Charged (no surface), interruption res on Lunar-Bloom; caveat
REMOVED (the shield and the res bar draw; the energy and the 250% absorption
have no pixel). C2: +40% Max HP on every fire, ATK/EM/DEF on the active
character by dominant kind; caveat names the +34% rate as "marks land where a
C0 Columbina's would". C6: untouched (`manual`, caveat kept — §1.G). ⛔ NOT
modelled: the C1 first-cast tick (`c1OnSkill`, 15s ICD, fires with zero
Gravity and a team-composition branch — a second mechanism for one visual),
the C4 flat add (magnitude). `manual` on Columbina: **12 → 1**; corpus 130
across 63 characters.

### 5.3 Measured

- `Columbina E Q > Fischl E N3 > Barbara E N1 N2 N3 N4 ~4s N1 N2 N3` (one
  Moonsign member): C0 — Lunar-Charged reactions at 196 250 255 283 486 489 510
  604 606 643f; grants at 196, 486, 606 → **fire at 606f in Electro**, mark on
  the Ripple, A1 bar 606–1206. gcsim's status arithmetic over the same stream
  reaches 60 at ≈639f. C1/C2 branches correctly dark (`teamFaction moonsign
min 2` false).
- `Columbina E Q > Zhongli E > Aino E …` C6: fires at 542 and 1262f in Geo,
  Rainsea Shield 542–1022 (source skill, cast 0), DEF conversion on Aino,
  +40% HP and CRIT on Columbina. `… > Nahida E > Lauma E …` C6: Dendro fires,
  EM + interruption res on Lauma.
- **Corpus digest: 0 of 246 moved** (the digest team makes no Lunar reaction),
  engine-only diff byte-identical before the data landed.

### 5.4 Held

- C6 → §1.G (resolved states in the onReaction buff pass). Odette's Coda and
  Xilonen's heal gate wait on the same thing.
- A1's stacking (`BuffEffect.stacks` consumer) — the bar reads +5% at every fire.
- A continuous accrual primitive, if a second holder appears.
- The fire's mark is a first cut for Nate to judge on screen (full-height 2px
  in the hit's element, `.rp-summon-fire`, mirrored in the PNG export).

### 5.5 The exact model (same day — ⚓ Nate: "this approximation verges on the territory where it is no longer useful")

The count-shaped grant of §5.1 ("+20 per reaction, at most one grant per 2s")
is RETIRED with the `procCooldown` it needed. Gravity is now what gcsim runs:

- **`gainStacks.accrual: { group, window }`** (`sim/accrual.ts`). With it,
  `amount` is a RATE per second; a trigger fire adds nothing and instead opens
  or refreshes a `window`-second status shared per holder across every key of
  the `group`; while the status is live, the key the LAST fire named gains
  `amount` per second in 0.05 s polls on a grid anchored at the fire that
  opened it (gcsim `gravityAccum`: `QueueCharTask(…, 0.05*60)`, the task
  surviving refreshes on its own cadence). `constellationScaling` scales the
  rate (Columbina 10 → 13.4 at C2 = `10 × (1 + c2GravityRate)`). Lint B.13k:
  only an `onReaction` grant with `source: 'team'`, never beside
  `procCooldown` / `lifetime` / `drain` / `sourceLifetime`.
- **Settled lazily, monotone, idempotent.** A record says where its grid
  starts, how many polls have been counted, and when the status lapses;
  `settleAccruals(hcs, upTo)` counts the polls at or before a frame into the
  key. A lapsed record is KEPT, which is what makes a retroactive refresh legal.
- **A Lunar-Charged TICK refreshes it.** gcsim's hook is on any Lunar-tagged
  damage, and an EC tick under a Lunar-Charged enabler is one. The gauge emits
  `ecTick` at its own instant and surfaces it at the next application; the
  dispatch loop now feeds those (converted through `reactionBridge`) to
  accrual grants ONLY (`dispatchGainStacksOnReaction(…, accrualOnly)` — a plain
  count would gain per tick, which no kit says), with `holderStatesAt` at the
  tick's frame. The refresh is retroactive by up to the gap to the next
  application, and the monotone settle absorbs it.
- **The fire is PREDICTED, never polled.** With the grid fixed and the rate
  constant, the poll on which the threshold's sum crosses `count` is
  arithmetic (`predictFire`); `thresholds.ts` schedules it on the one clock
  (`Band.TICK`), generation-stamped on the record so a refresh, a spend or a
  lapse re-predicts and orphans the pending task. A prediction at or before
  `now` (a late-surfacing tick extended a status that had already crossed) is
  fired immediately AT ITS OWN INSTANT — the settle is monotone, the polls
  after it go to the emptied pool, and `finalize` sorts events by time. ⛔ Never
  a 3-frame wake-up task (L3 §4.2).
- **`checkStackThresholds` takes the clock** (all four sites) so a spend can
  re-predict: gcsim's task outlives `clearGravity`, so a status that stays
  refreshed fires again 6 s later with no new reaction needed.

**Measured (exact model).** The synthetic Vaporize case fires on poll 119,
5.95 s after the first of four Guoba ticks 1.67 s apart — the count model saw
two grants and no fire there. Three Frozens 6.5 s apart are three statuses of
20 and fire on the third's 40th poll, 117 frames after the reaction. At C2 the
fire is poll 90. Under a Lunar-Charged enabler with Oz (reactions every third
strike, ticks between), the fire lands earlier than reactions alone would give
and later than one continuous status, because the Electro-Charged aura itself
lapsed once — no aura, no tick, in gcsim too. Columbina's
`E Q > Fischl E N3 > Barbara E …`: **C0 fires at 585f** (count model: 606;
the plan's uncapped count: 255), **C6 at 473 and 743f**. Corpus digest: 0
moved.

**Still not matched, both named in caveats:** gcsim's `Skill` clears Gravity
when cast after the Ripple has EXPIRED (`if !StatusIsActive(skillKey)
clearGravity()`), so leftover Gravity carries into our next Ripple; and C1's
cast-time tick (`c1OnSkill`, 15 s ICD, zero Gravity, a team-composition
branch). The C2 caveat is GONE — the rate is modelled.

**Seeded negatives, verified by hand (exact model, 2026-09-18):** dropping the
`ecTick` branch fails exactly the Lunar-Charged case (the fire moves to the
reactions-only instant); dropping the settle before the read fails the
Vaporize, C2 and shield cases; dropping the reaction-site re-predict fails
the same three (a fire can then only land ON a reaction); dropping the spend
fails the Vaporize, C2 and Lunar-Charged cases (a second fire on the next
poll); dropping the `dominant` gate fails the mark and shield cases. Guarded
by `sim/thresholds.test.ts` (12).
