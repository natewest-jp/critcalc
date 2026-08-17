# Internal Cooldown (ICD)

**Sources:** KQM — <https://library.keqingmains.com/combat-mechanics/internal-cooldown>
(fetched 2026-07-14); gcsim `pkg/core/attacks/icd.go`, `pkg/core/attacks/icd_groups_gen.go`,
`pkg/target/icd.go` (implementation ground truth — the concrete tag/group tables);
Genshin Fandom [`Internal_Cooldown/Data`](https://genshin-impact.fandom.com/wiki/Internal_Cooldown/Data)
(the per-ability lookup catalogue).
**Game version reflected:** 6.x (the mechanic is edition-stable; the per-ability
tables grow with each character).
**See also:** [`elemental-reactions.md`](elemental-reactions.md) (the gauge/aura
system that ICD gates application _into_), [`lunar-reactions.md`](lunar-reactions.md).

> KQM is the strongest player-side authority but not ground truth (see the library
> [README](../README.md)). Here gcsim is the second source and, for the exact
> per-ability cadences, the more _legible_ one — its `icd_groups_gen.go` is a
> machine-readable table. Where a specific ability's ICD matters, cross-check both.

## What ICD is

ICD limits **how often a repeating damage source applies its element** (and therefore
how often it can trigger elemental reactions). It does **not**, in general, limit how
often the source deals _damage_ — a hit blocked by ICD still lands, it just applies no
element that tick. The classic tell: Hu Tao's charged attacks hit Pyro four times but
only trigger two Overloads.

Three distinct things share the name "ICD"; keep them separate:

1. **Elemental-application ICD** — the subject of this doc. How often a hit applies its
   element. This is what "3 hits or 2.5s" refers to.
2. **Reaction-damage ICD** — how often a _transformative reaction_ (Swirl, Overload,
   Electro-Charged…) can deal its damage instance to a given target. A separate counter.
3. **Effect-proc "ICD"** — our schema's `Effect.procCooldown`: the minimum seconds
   between re-procs of a buff/energy/heal effect (TTDS, Sacrificial, Chongyun C4). A
   completely different mechanic that happens to be nicknamed "ICD." See → Schema mapping.

## The standard rule (the one to remember)

> "a hit can apply an Element once every 3 hits **or** a hit can apply an Element once
> every 2.5 seconds." — KQM

Whichever boundary is reached first lets the next hit apply. The **first hit of a
sequence always applies**. The two boundaries reset asymmetrically — this asymmetry is
the whole subtlety:

> "the 3-hit rule will **not** reset the 2.5-second timer" — KQM
> "the 2.5-second timer **will** reset the 3-hit count" — KQM

So: hitting the 3-hit boundary applies an element and clears the hit count, but leaves
the 2.5s timer running; the 2.5s timer expiring applies an element and clears **both**.

**Worked example — a fast string at 0.5s/hit** (our `icd.ts` test, and what gcsim
produces): applications land on hits **1, 4, 6**, then 9, 11, … Hit 4 applies by the
3-hit count (and does _not_ restart the timer), so the timer — started at hit 1 —
expires at hit 6 (t = 2.5s), which applies and resets the count. If the 3-hit rule had
restarted the timer at hit 4, hit 6 would wrongly be blocked.

Slower than one hit per 2.5s → every hit applies (the timer always wins).

## The precise model — sequence + counter + timer

The rigorous framing (KQM's "gauge sequences", exactly how gcsim implements it):

- Each hit's element application is a **gauge multiplier** read from an ordered
  **application sequence** `g = (g₀, g₁, g₂, …)`. Standard is `(1, 0, 0, 1, 0, 0, …)` —
  hits 1, 4, 7, … apply full gauge; the rest apply none. (Values are usually `0`/`1`,
  but _can exceed 1_ — Nahida's skill opens with `1.5`, applying 1.5 gauge units.)
- A per-hit **counter** indexes the sequence and increments each hit.
- A **reset timer** clears the counter back to the start after a fixed duration
  (2.5 s standard). This is the "or 2.5 seconds" — when hits are slow, the counter
  resets before it ever reaches the next `0`, so more hits land on a `1`.

Two independent axes decide who shares an ICD:

- **Tag** — _which hits share one counter._ Same tag ⇒ shared count. gcsim's tags:
  `NormalAttack`, `ExtraAttack` (charged), `ElementalArt` (+ per-element / hold variants),
  `ElementalBurst` (+ per-element variants), `Dash`, Traveler-specific tags, and the
  reaction tags (`Overload`, `Superconduct`, `ElectroCharged`, `Swirl*`, `Burning`,
  `Bloom`/`Burgeon`/`Hyperbloom`…). Tag assignment is **per-ability**.
- **Group** — _the sequence + the reset-timer length._ Same group ⇒ same cadence.

**Separate tags ⇒ independent counters.** An off-field summon has its own tag, so its
applications don't consume your on-field Normal-attack count and vice-versa — they
each keep a private 3-hit budget. This is why off-field appliers work at all.

## Standard ICD is the _default_, not the universal rule

gcsim ships a small set of shared groups plus **~50 bespoke per-ability groups**
(`icd_groups_gen.go`). Reset timers span **6 frames (Xiao dash, 0.1 s)** to **1800
frames (Furina's Salon Solitaire, 30 s)**; sequences range from every-other `(1,0)` to
every-eighth `(1,0,0,0,0,0,0,0)`. Frames are 60 fps → `frames ÷ 60 = seconds`.

Shared groups (from `icd.go`):

| Group             | Reset timer | Ele-application seq         | Where it's used                                                        |
| ----------------- | ----------- | --------------------------- | ---------------------------------------------------------------------- |
| Default           | 2.5 s       | `1,0,0,…` (every 3rd)       | most Normal/Charged/Skill/Burst hits                                   |
| Pole Extra Attack | 0.5 s       | `1,0,0,…`                   | polearm charged/plunge extra hits                                      |
| Reaction A        | 0.5 s       | `1,1`                       | **Swirl**, Superconduct, Freeze (damage seq `1,1,0,…` — 2 dmg / 0.5 s) |
| Reaction B        | 0.5 s       | `1,1`                       | Overload, Electro-Charged (damage seq `1,0,0,…` — 1 dmg / 0.5 s)       |
| Burning           | 2.0 s       | `1,0,0,0,0,0,0,0` (every 8) | Burning aura application                                               |
| Traveler Dewdrop  | 1.5 s       | `1,0,0,0,0,0,0,0`           | Traveler kit-specific                                                  |
| Traveler Burst    | 8.0 s       | `1,0,0,0,1,0,0,0,1,0,0,0`   | Traveler kit-specific                                                  |

Representative bespoke groups (there are many more — look the ability up, don't guess):
Amber 1 s `1,0,0`; Fischl (Oz) 5 s `1,0,0,0`; Alhaitham projection 12 s `1,0,1,0,…`
(every other); Nahida skill 1 s `1.5,0,0,…`; Yae charged 0.5 s; Furina Salon 30 s
`1,0,1,0,…`. Abilities with **no ICD** (`ICDTagNone`) apply their element on _every_ hit.

A per-group **damage sequence** (usually all-`1`) governs axis #2, reaction-damage
frequency, independently of element application — e.g. Swirl's `1,1,0,…` lets Swirl
damage a target only twice per 0.5 s.

## Reconciling the three models

- **gcsim's timer** is a fixed window scheduled `resetTimer − 1` frames from the hit that
  _starts_ the window (Default 150 → fires at frame 149); when it fires, the counter
  resets and the next hit opens a new window.
- **Our `icd.ts`** uses a rolling timer measured from the last timer-driven application,
  parameterised as `{ timer, hits }` (`STANDARD_ICD = { timer: 2.5, hits: 3 }`); `none`
  is `{ timer: 0, hits: 1 }`.
- **KQM's formal** description re-anchors `t₀` to the triggering hit when the window
  elapses.

All three reproduce the standard canonical case identically (the 1, 4, 6 example above).
They can diverge only under irregular hit timing at window edges; for the standard
sequences we model, treat them as equivalent. gcsim's per-ability sequence/timer table is
the authority when exact off-field application counts matter.

## → Schema mapping & current state

We model elemental-application ICD **binary**, not as full sequences:

- **`noICD?: boolean`** on `NormalAbility` / `AbilityVariant` / `SkillCommonFields` /
  `BurstCommonFields` (`ability.ts`). **`true` ⇒ the ability applies its element on every
  hit** (the `ICDTagNone` case); absent means standard ICD, which is the game default.
  Authored on 7 rapid/off-field appliers (Cyno, Fischl, Ganyu, Kinich, Lan Yan, Mualani,
  Xingqiu). Decision (2026-07-14, Nate): keep binary + document; do **not** extend to full
  sequences and do **not** rename — `noICD` matches gcsim's `ICDTagNone` and KQM vocabulary.
  **✅ Read since the ICD round (2026-08-15)** — but only on a `NormalAbility` (Mualani's
  Sharky's Bite is the sole holder there). See "What the planner models" below for why the
  skill/burst holders are still inert, which is now a stated consequence rather than an
  unwired field.
- ↻ **`IcdWindow` — a MEASURED bespoke cadence, on two keys** (ICD-group round, 2026-08-17).
  `{ timer, every? }` is gcsim's group reduced to the two numbers that carry all of it: the
  reset window in **FRAMES**, and how many hits apart an application falls inside it
  (`every` absent = only the first). ⚓ All 58 of gcsim's groups reduce to this pair, and it
  is the shape `IcdParams` in `icd.ts` always had, so consuming one needed **no new ICD
  mechanism** — only a resolver willing to return something other than the standard.
  - **`NormalAbility.chargedIcdWindow`** — a charged attack's window. 16 characters,
    19 abilities. ⛔ Never a `weapon === 'polearm'` branch: 16 of 19 with Xiao, Raiden and
    Emilie on the default and Ayato, a sword user, carrying the polearm group.
  - **`summonTick.icdGate`** — a tick series' window, alongside its `'none'`. 14 series
    across 11 characters, migrated from measured group data (Oz's 300f/every-4, Collei's
    180f/first-only, Venti's and Amber's 60f/every-3, Navia's 720f/every-3).
- ⚠️ **What is still not representable.** A CAST's own window (per-ability tag/group on
  skills and bursts, where 112 of 166 gcsim skills are `ICDTagNone` and our schema has no
  way to say which); gcsim's **counter SHARING** across everything one character emits
  under one tag, which is an engine question and not a data one
  (`docs/icd-group-round.md` §4, held); the four groups that apply two or three times at a
  regular period and then **STOP** for the rest of the window; the `1,1` reaction groups
  (axis #2, below); and Nahida's `1.5` gauge, which is deliberately **not** in the cadence
  model — a gauge STRENGTH lives beside the application that carries it, as `units`.
- **Reaction-damage ICD** (axis #2) is **not modeled** — the tools visualize element
  _application_, not reaction-damage-instance gating. (Aura/gauge decay and reaction
  _consumption_ are a separate concern handled in the crit-viz `gauge.ts`; see
  [`elemental-reactions.md`](elemental-reactions.md).)
- **Don't conflate with `Effect.procCooldown`.** The effect field is already well-named
  (it is _not_ called `icd`) — it's the minimum seconds between re-procs of a
  _buff/energy/heal effect_: TTDS (`procCooldown: 20`, `duration: 10`), the Sacrificial
  series (refinement-scaled `ScaledValue`), Chongyun C4 (`+1 energy`, 2 s). It has nothing
  to do with element application; the collision was only informal prose (its JSDoc used
  to nickname `0` as "no ICD" — since reworded to "no cooldown").

## What the planner models (ICD round, 2026-08-15)

The rotation parser applies elements from **N/C/P swings as well as E/Q casts**, and
gates the swings on this mechanic. One model serves both surfaces: `src/lib/utils/icd.ts`
holds `simulateIcd` (batch — the instrument feeds it a whole hit list) and
`createIcdClock`/`icdApplies` (streaming — the parser feeds it one swing at a time), with
the batch form written in terms of the streaming one so they cannot drift.

- **Clocks are keyed `(character, tag)`**, tag ∈ `normal` | `charged`, rotation-wide
  beside the aura state — a swap-out does not hand back a free application.
- ⛔ **E/Q casts are NOT gated, on purpose.** ICD counts _hits_; a cast event is an
  _ability_. We model a multi-hit skill as one application, so a counter over cast events
  would delete a second cast that in game lands several more hits. This is also why the
  `noICD` flags on skills and bursts stay inert: at cast granularity they have nothing to
  say.
- **Two blanket cases live in `resolveActionIcd`, not in the data** (icd.md's curator
  signal forbids mass-annotating the default): plunges apply every time (census of gcsim's
  per-character `plunge.go` — 165 of 166 are `ICDTagNone`), and catalyst charged attacks
  apply every time (same census over `charge.go` — every catalyst in the roster).
- ⚠️ **Knowingly divergent, both bounded:** a melee infused CA shares the _normal_ counter
  for 24 characters in gcsim and gets its own here (worst case one extra application per
  2.5 s); a CAST's bespoke group still collapses to standard, per the gap above.
- A **physical** swing reaches no clock at all — it applies nothing, and a hit that
  applies nothing spends no budget, so a physical string followed by an infusion starts
  the infused counter fresh.

**Tool surface:** the visualizers **`IcdInstrument.svelte`** (backed by
`$lib/utils/icd.ts`) visualizes this doc — `standard` / `none` / `custom {timer, hits}`
presets over a uniform attack string, showing which hits apply.

## Curator signal

- Ability's every hit applies its element (Fandom/gcsim tag = `None`) → set `noICD: true`,
  or `'none'` on a tick series' gate.
- A CHARGED attack or a SUMMON TICK SERIES on a bespoke group → author its measured
  `{ timer, every? }`. ⚓ **From the group's own numbers**, which
  `docs/curation/gcsim-frames-diff.md` §5b reports — ⛔ never inferred from an applied
  count, because a count says only THAT standard is wrong and never what is right. Two
  series were recorded as "standard" for exactly that reason and were wrong.
- Anything else → **leave the field off** (standard ICD is the assumed default), and ⛔
  never annotate a series whose group IS standard. Don't invent a cadence we can't store;
  note the real one in `_curatorNotes` if it's unusual.
- Looking up a specific ability: the Fandom [`Internal_Cooldown/Data`](https://genshin-impact.fandom.com/wiki/Internal_Cooldown/Data)
  table, or gcsim `internal/characters/{id}/` — search the `ICDTag`/`ICDGroup` on each
  `Attack`/`Snapshot`.
