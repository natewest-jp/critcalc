# The Gauge Round

**Status:** planning · opened 2026-08-16
**Goal:** replace the coarse aura model with a real elemental-gauge simulation, and move the
rotation planner from a token-driven interpreter to a clock-driven state machine so that
simulation has somewhere honest to live.

> This is the **contract document**. It freezes the decisions every downstream landing is
> written against, and it orders the work. Per-landing implementation plans are written
> **just-in-time**, each immediately before its landing — see [§8](#8-how-each-landing-gets-planned).
> A landing that needs a contract changed **amends this file as a deliberate, recorded act**.

Survey basis: a measured probe of the live parser, plus a six-part census of the parser,
the data, the consumers, the time-unit surface, and a line-by-line fidelity audit of
`gauge.ts` against gcsim `pkg/reactable` (2026-08-16).

---

## 1. Why — the measured case

### The coarse model is wrong in both directions at once

Measured against `main`. These are observations, not estimates.

| rotation                                                      | emitted                               | in game                                  |
| ------------------------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| `Kaeya E ~40s ~40s ~40s > Xiangling E`                        | melt at **t=120.95**                  | the 1.6U Cryo aura is gone by ~t=13      |
| `Xiangling E > Sucrose N9 N9 N9 N9`                           | **14** pyroSwirls                     | ~2 (0.8U taxed, 0.5U consumed per swirl) |
| `Kaeya E > Xiao E Q P P P P P P`                              | **6** cryoSwirls, one per plunge      | ~3–4, then the aura is gone              |
| `Kaeya E > Hu Tao E N1..N6 N1..N6`                            | **1** melt                            | 1 melt ✅                                |
| `Xiangling E Q > Xingqiu E Q > Bennett E Q > Hu Tao E N1..N9` | **2** vaporizes, **neither Hu Tao's** | ~6–7 of her nine normals vaporize        |

⚓ **Infused normals are the best-behaved part of the model.** A PHEC infused string
self-limits — the first application consumes the opposing aura, then same-on-same is inert.
The round that landed them is not the problem.

⛔ **The saturation is Anemo/Geo, and it predates that round.** They never consume aura
(`notationParser.ts:1627`) and aura never decays, so every anemo application from t=0 to the
end of the rotation swirls. Plunges are correctly ungated (`ICDTagNone`), which makes
plunge-spam the worst case.

**The two errors partially cancel by luck** — a Kazuha/VV team looks roughly right because
permanent-swirl compensates for missing summon ticks. That cancellation breaks the moment
summon ticks land, which is exactly the block that opened this round.

### The blast radius is buffs, not a reaction display

Reactions have **no visual surface**. They feed `deriveBuffWindows`, `gainStacks`, and
`durationExtensions`. Census: **55 `onReaction` effects across 27 characters** (24 buff,
19 resShred, 6 damage, 4 energy, 1 heal, 1 gainStacks) plus 2 `durationExtension` triggers
(Collei, Mizuki), VV 4pc and Instructor. Today a permanent swirl draws a **VV 40% RES-shred
bar that never ends**.

### ⚓⚓ The corpus records when a cast can be CANCELLED, never when it LANDS

The load-bearing finding. The parser applies `char.element` at **every** E/Q cast
(`notationParser.ts:3355`, unconditional after an `if (!element) return`), and there is no
field in the schema that could gate it.

Baseline cast damage is **not authored as effects at all** — there are only **104 `damage`
effects in the whole corpus** (47 constellation, 31 summon-tick, 19 passive, 7 ability). An
E/Q's own hit lives as scaling in the talent sidecar and as _cancel windows_ in the
`FrameMap`. Nothing anywhere says when it lands or whether it applies.

Two independent oracles size the "applies nothing" class:

- **Talent sidecar has no DMG row** — decisive. All 118 sidecars have a skill DMG row;
  **4 bursts have none**: Itto, Barbara, Linnea, Mika.
- **All DMG rows belong to a summon** — the right candidate set, needs per-character
  verification. **14 skills**: Amber, Chiori, Citlali, Dehya, Fischl, Furina, Kachina,
  Linnea, Mona, Kokomi, Sigewinne, Xiangling, Yae Miko, Yaoyao. ⚠️ Contains known false
  positives (Fischl's "Summoning DMG" _is_ cast damage).

Xiangling is the clean proof: in gcsim her `Skill()` queues **no attack** — it only adds
Guoba as a gadget (`internal/characters/xiangling/skill.go:50`). Her cast applies **zero
Pyro**. We apply Pyro at the cast.

⚓ **`summonTick` is the precedent to copy.** It is the _only_ place in the corpus where an
ability already says when something lands rather than when you can cancel out of it —
`interval` (52 authors) + `firstTickDelay` (41). Model the hit schedule on it.

---

## 2. The architecture, and the correction to last session's framing

⚠️ **A two-phase "schedule then simulate" split was proposed and is wrong.** A pure pre-pass
cannot produce a schedule:

1. **Ability resolution is state-dependent** — `resolveActiveAbility(char, 'normal', nStates, …)`
   (`notationParser.ts:4172`) takes the live state set; Cyno's `Q N1 N2` resolves in-stance
   normals only because the Q already ran.
2. **Cursor advancement needs lookahead** — `peekActionKey` (`notationParser.ts:720`) reads
   the _next_ token to choose the cancel window.

The census then found the deeper reason: **five feedback edges run from consequence back
into decision**, so no seam exists anywhere in the current function.

| #      | edge                              | written (consequence)                                                                                | read (decision)                                                                                                          |
| ------ | --------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **F1** | **stacks → resolution**           | `dispatchGainStacks` :3776, `dispatchConsumeStacks` :3835, `dispatchHit` :3571, `applyDrain` :3109   | `resolveActiveAbility` :3724/:4172/:4288, `matchVariant` :3635/:3732, `resolveAbilityTiming` :3763 (cd **and** duration) |
| **F2** | **aura/reaction → stance length** | `emitReactionsForApplication` :3296 → `dispatchOnReactionExtensions` :3314 → `st.end += delta` :2858 | `computeCurrentStates` :3527 (`inStance`), E-charge wait boundary :3694                                                  |
| **F3** | **cast uptime → `duringSummon`**  | `dur` :3761 → `castEvent.uptime` :3821; extension stamps at finalize :4590                           | `inferredStates` :655–705 → ability/variant resolution                                                                   |
| **F4** | **cdReset → charge queue**        | sac proc :3863, `getCharacterCdResetTargets` :3891                                                   | charge-queue wait scan :3692, `cs.qReadyAt` :3626                                                                        |
| **F5** | **one shared id counter**         | `nextEventId++` at :3046, :4334, :4847                                                               | ids at :3465, :3811 are provenance keys                                                                                  |

**F2 is the one that matters most for this round: the aura already feeds back into
scheduling.** Any design that treats elemental application as a pure output is wrong today
and would stay wrong.

gcsim has the same constraint and solves it correctly: its queue holds **unresolved intents**
(`ActionSkill`, `ActionAttack`), and the character resolves what one means at execution time
against its own state.

⚓ **The target is ONE clock-driven loop with the token stream as an input queue.**

```
frame F:
  fire tasks due at F           (hits, summon ticks, window expiries, cooldown starts)
  advance continuous state      (gauge decay — one Tick, mirroring gcsim)
  if the active character is free at F:
      pop the next token
      resolve it against live state      ← what a pre-pass cannot do
      execute: schedule its hits/ticks/windows as future tasks
      mark the character busy until F + castFrames
```

Everything that is a retroactive patch today becomes a task that has not fired yet:

| today                                                                                                          | after                                              |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `:4880` — "a finalize-time hit cannot be interleaved … without a two-pass parse"                               | a summon tick is a task; it fires in order         |
| the stance-clamp bug (27 characters, 5 late `afterDuration` authors)                                           | expiry is a task that re-checks validity on fire   |
| `cooldownStartsAtStanceEnd` writing `readyAt` **and** the charge queue at cast, then moving both at swap-close | the stance-end task starts the cooldown; one write |
| `:4590` — uptime stamped only at finalize, with a documented LATENT TRAP for mid-parse readers                 | live state is live; there is no stamp              |

All one shape: _something later changes something already done._ A clock removes the category.

### ⛔ What we deliberately do NOT copy from gcsim

- **Stochastic search.** N iterations, RNG, a distribution as output. We are deterministic
  and single-shot, and determinism is a product requirement.
- **The action queue / AI.** gcsim must _decide_ what to do. We are told.
- **The damage model.** No snapshotting, stat table, crit or enemy stats. This is most of
  gcsim's mass, and dropping it is what makes the round tractable.

**We need the state machine, not the calculator.**

---

## 3. Contracts

### C1 — Time is integer frames (60fps)

⚓ **The simulation's native unit is an integer frame. Seconds exist only at presentation.**

The seconds form is the lossy re-expression. gcsim is frames-native: aura lifetime is
`6·durability + 420` **frames** (`pkg/reactable/reactable.go:207`) — our `2.5·U + 7` seconds
arrived at by division.

The census makes this cheap and safe:

- ✅ **No numeric time is serialized anywhere.** `SharedRotation` is `{notation,
constellations, loadout}`; `SavedNotation` has no sim time; the generated index carries no
  durations. The only time in any payload is the textual `~Xs` token.
- ✅ **All planner geometry funnels through `barGeometry.ts:12/26/51`** — the frames→px
  projection is one function.
- ✅ **3,746 authored frame values, all integers, zero lossy.** 947 authored seconds values,
  of which **47 are not whole frames** (mostly 2-dp roundings of a true frame count:
  `skirk 12.57` = 754f, `citlali 0.983` = 59f). `Math.round(s*60)` _recovers_ them.
- ✅ `DASH_FRAMES / 60 = 0.35` becomes **more** exact, not less.

What it kills, concretely:

- `:4544` — `queue.findIndex((t) => Math.abs(t - staleReadyAt) < 1e-9)`, a charge-queue
  lookup **using a float as an identity key**. Becomes `indexOf`.
- `:2995` — matching a summon to a shield by float-comparing durations.
- 🐛 `summonSubrows.ts:144` — the summon lane's walk index is keyed on a **float**
  `spawnAt` that must reproduce the parser's `summonSpan()` arithmetic bit-for-bit or every
  lane silently falls back to sort index 0. Two independent float expressions in two modules
  required to agree exactly. This is a latent bug that C1 deletes.
- Three inconsistent epsilon conventions (`icd.ts` `1e-9`, `gauge.ts` `1e-6`, `.toFixed(6)`
  test keys) — the smell that the unit was wrong.

⚠️ **Three suspicious authored values** are not near-whole and were probably not derived from
frames at all: Furina's `3.369` / `1.626` / `5.231` tick intervals. Re-derive from gcsim in L2
rather than rounding them.

⚠️ **`~Xs` accepts arbitrary decimals** (`~0.017s` is legal user text). Round at
tokenization; that is the one place user input enters the clock.

### C2 — The IR shape does not change

`TimelineEvent` / `TimelineWindow` keep their shape and semantics, time fields re-typed to
frames. `parseNotation`'s signature and output stay a **fixed door** while the room behind it
is rebuilt — that is what makes the refactor verifiable.

⚓ Windows stay **records, not open/close pairs** (`rotationEvents.ts:18`). Right call; the
clock model does not threaten it — the sim records a window when it closes instead of
patching one that was opened.

⚠️⚠️ **Buff-window emission order is a VISIBLE invariant, and it is undeclared.**
`teamBuffRows.ts:43` and `charReceivedBuffRows.ts:37` both sort by `BuffWindow.id`, and both
headers state that emission order _is_ the legacy row order. **A clock-driven sim will
naturally emit in a different order than a token-driven one.** This is the single most
dangerous hidden coupling in the refactor — the IR would be "identical" by shape and the
user would see rows move. The differ must compare `id` order, not just window contents.

### C3 — Elemental application is a new first-class structure

Modelled on `summonTick`, not on `damage` effects (there are almost none):

```
application: { frame: number; element?: Element; units?: number }[]
```

- `frame` — offset from cast/swing start to the **hitmark**, in frames.
- `element` — absent means physical, i.e. applies nothing.
- `units` — gauge units, **default 1U within an entry** (census: 688 of 835 explicit gcsim
  durabilities are `25`).
- ⛔ **An ABSENT list is not "1U at cast".** Absent = we do not know = **applies nothing**,
  marked provisional. gcsim's own engine default is a hard zero — `Durability` is not
  defaulted anywhere and every path early-returns below `ZeroDur`
  (`pkg/core/info/reaction.go:43`) — so "omitted means no application" is also the upstream
  semantics. An empty list is the _positive_ statement that a cast applies nothing
  (Xiangling's E).

⚠️⚠️ **The three fields land in different landings, split by who consumes them.**
`orphanedSchema.test.ts` fails on authored-but-unread data, and this round would otherwise
author `units` across 123 characters weeks before the gauge exists to read it.

| field              | lands in | first consumer                                                                                                                           |
| ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `frame`, `element` | **L4**   | the _existing coarse model_ — it can stop applying at cast-start and stop applying at all for summon-only skills, with no gauge involved |
| `units`            | **L5**   | the gauge engine                                                                                                                         |

⚠️ For normals the hitmark is already recoverable: `InitNormalCancelSlice(hitmark, animation)`
sets `ActionSwap = hitmark`, so our `frames.swap` **is** the hitmark (verified: Yoimiya
`{"swap": 24, "N": 35}` ↔ `InitNormalCancelSlice(attackHitmarks[0][1], 35)`). That is a
derived fact about gcsim's constructor, not a definition — author it explicitly rather than
reading it out of `swap` forever.

⚠️ Summon ticks keep their existing shape. That data is good; do not re-model it.

### C4 — The gauge engine is fed POST-ICD applications only

⚓⚓ **The #1 integration hazard.** `simulateGauge` applies every gauge it is handed. gcsim
applies ICD _at the target_ — `pkg/enemy/attack.go:114` does
`Durability *= WillApplyEle(ICDTag, ICDGroup)` **before** `React()`. So an authored `units`
value is the **nominal cap, not the applied rate**.

If the planner pipes raw swings in, every aura is several times too strong. `icd.ts` decides
_whether_ a swing applies; `gauge.ts` decides _what happens when it does_. State it in the
module header the way `icd.ts` already does.

### C4b — The character JSON's frame shape is OURS to redesign

⚓ **Nate 2026-08-16: gcsim is the source for all frame data, and the FrameMap may be reshaped
to whatever current needs require.** No prior shape is preserved; earlier hand-edits against
KQM are superseded (they were already re-derived from gcsim since).

That authority is immediately load-bearing, because **the current shape carries a systematic
bug**:

🐛 **`swap` is doing double duty as "the swap cancel window" AND "the fallback for every
absent key", and those are not the same number.** gcsim's `InitAbilSlice(animation)` sets
every slot to the **animation length**, then applies explicit overrides — and `ActionSwap` is
just one more override, frequently _below_ the default. Our schema kept the override and threw
away the default.

Measured: **189 of 292 E/Q FrameMaps (65%, across 101 characters) carry at least one key
above `swap`** — so `swap` is demonstrably not the maximum, and every absent key resolving to
it understates the cost. Absent keys are the common case: `C` is absent in 281/292 maps, `Q` in
170, `E` in 167.

```
Amber skill   ours { swap: 23, N: 32, E: 33, Q: 32, D: 8, J: 8 }
              → a charged attack after her E is timed at 23f; the true default is ~33f
Xiangling E   gcsim InitAbilSlice(39), ActionSwap = 38   → ours { swap: 38, … }, absent keys read 38, not 39
Xiangling Q   gcsim InitAbilSlice(80), ActionSwap = 79   → ours { swap: 79 },     absent keys read 79, not 80
```

**Direction (detail settled in the data landing):** store gcsim's slice shape — an explicit
animation default plus overrides — so the fallback is the default, not `swap`.

⚓⚓ **For normals this makes the record smaller AND yields the hitmark for free.**
`InitNormalCancelSlice(hitmark, animation)` sets everything to `animation`, then overrides
swap/E/Q/D/J to `hitmark`. So a normal swing is fully described by **two numbers**:

```
Yoimiya N1   now  { "swap": 24, "N": 35 }        (hitmark implicit, fallback wrong)
             next { "anim": 35, "hit": 24 }      (complete; N/C = anim, swap/E/Q/D/J = hit)
```

That is the whole reason this is a bug fix rather than a refactor: the reshape simultaneously
corrects the fallback, shrinks the record, and makes the hitmark explicit — which is exactly
what C3 needs. ⚠️ E/Q hitmarks are **not** in the frames slice at all (they are the
`QueueAttack` delay), so those still need C3's separate application list.

### C5 — Module boundaries

| module                         | role                                                                                                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$lib/utils/gauge.ts`          | the gauge/aura engine (moved from the Visualizers' lib — the `icd.ts` precedent)                                                                                                         |
| `$lib/utils/icd.ts`            | unchanged; already serves instrument + parser                                                                                                                                            |
| `$lib/sim/` (new)              | the frame clock, task queue, character state machines                                                                                                                                    |
| `$lib/utils/notationParser.ts` | shrinks to: tokenize → drive the sim → author the IR                                                                                                                                     |
| `$lib/utils/buffWindows.ts`    | ⚠️ **not a consumer — a lobe of the parser.** It imports the parser-private `HitEvent`, `evalCondition` and `ConditionContext`, and is called from finalize. It moves with the refactor. |
| `$lib/timeline/*`              | unchanged projections                                                                                                                                                                    |

⚓ **One model, two shapes** stays the law: the gauge engine serves the instrument and the
planner from one implementation.

⚠️ `gauge.ts`'s `ElementId` union will collide conceptually with `actionElement`'s element
types. Reconcile at the move; do not ship a second element union.

### C6 — Determinism and versioning

- Same-frame tasks resolve by **(priority band, insertion order)**. The band list is part of
  the sim's contract and gets written down in L3's plan.
- ⛔ **No `?r=` codec bump.** The payload is the notation, which is unchanged; the sim is
  derived. Confirmed by census: zero numeric time is serialized anywhere. (Nate confirmed no
  shared links exist, so nothing needs back-compat regardless.)
- Existing caps still bound the frame loop: `MAX_NOTATION_CHARS` 16 KiB,
  `MAX_EXPANDED_TOKENS` 20k, `MAX_TIME_ADVANCE_S` 3600 → 216k frames. ⚠️ The frame loop's own
  cap derives from that last one — not a fresh magic number.

---

## 4. The oracle — this comes first

⚓⚓ **Before any refactor, build the thing that tells us whether we are right.**

gcsim's debug log has a `LogElementEvent` category — _"tracks elemental application"_
(`pkg/core/glog/sources.go:10`), written throughout `pkg/reactable/`. Its CLI takes
`-c config.txt -out result.json`. **A true oracle for exactly the stream this round produces.**

`scripts/audit-gcsim-reactions.mjs` — same family as `audit-genshin-db-diff.mjs`, a
review-candidate generator against an external source, **never an auto-fixer**:

1. take a critcalc notation → emit an equivalent gcsim config
2. run gcsim at 1 iteration with element logging
3. parse the element log into an application/reaction stream
4. diff against our reaction events → `docs/curation/gcsim-reaction-diff.md`

Why first: it converts every downstream landing from "looks right" to **measured**; it is
independent of every architecture decision so nothing can invalidate it; if it reveals
`gauge.ts` diverges materially **that changes the plan**; and it gives a **baseline to beat**
so the round reports a delta rather than a claim.

✅ **Unblocked 2026-08-16** — `go1.26.6` installed, gcsim builds and runs.

⚡⚡ **The L0 spike found the oracle is far stronger than this section assumed, and it
supersedes the static-extraction plan in §L4.** The element log carries the applied
**durability**, the aura gauge **before and after**, and the exact frame — so hitmarks,
gauge units, and "does this cast apply at all" are all **observable** rather than parsed out
of Go. The ~9% of call sites that needed a human, the wrapper-flattening ambiguity, the
mode-indexed tables and the runtime-dependent hit counts all dissolve, because the simulator
resolves them. ⚠️ In exchange, **coverage** becomes the data track's central risk: running
sees one path where static reading sees all branches. Full plan and evidence:
[`gauge-round-L0.md`](gauge-round-L0.md).

---

## 5. The landings

Two tracks, running **concurrently**, meeting at L5.

```
  L0 oracle ──────────────────────────────────────────────┐
                                                          │
  architecture:  L1 gauge fixes → L2 frames → L3 clock ────┼──→ L5 gauge → L6 surface
                                                          │
  data:          L4 frame re-derivation + application ─────┘
```

### L0 — The oracle

**Blocks:** nothing. **Informs:** everything.
**Done when:** a diff report exists for ≥10 real rotations spanning the reaction families
(vape, melt, EC, freeze, quicken/bloom, swirl-heavy, geo/crystallize), with a baseline
divergence count recorded here — **and the coverage stated honestly.** A partial oracle is
worth having; a _believed-total_ partial oracle is not.

### L1 — Move and fix the gauge engine

Bigger than "move the file" — the parity audit found three real bugs. `gauge.ts` matches
gcsim on aura tax, decay derivation, topUp, the Pyro refresh rule, the frozen decay ramp,
quicken lifetime, the crystallize GCD, `reduce()`/spent accounting, bloom cores, and the
per-element `React()` priority on all six elements. What it gets wrong:

- 🐛 **EC tick chains use a boolean, not a generation stamp** (`gauge.ts:303` vs gcsim's
  `ecTickSrc`, `electrocharged.go:162`). If EC lapses and re-forms before a pending task
  fires, both chains survive — **drain doubles to 0.8 U/s and compounds.** Reproduced: 7
  ticks where gcsim gives 4. Three-line fix.
- 🐛 **Burning tick chains have the same bug** (`gauge.ts:331` vs `burningTickSrc`).
- 🐛🐛 **The burning tick ignores the burning ICD — ~10× over-application.** gauge.ts
  re-applies 1U Pyro every 15 frames; gcsim's burning tick is a normal attack under
  `ICDGroupBurning` (8-long sequence `{1,0,…}`, 120-frame reset), so it applies roughly once
  per 2–2.5 s. **Every phantom tick runs the full reaction chain**, so a burning target
  carrying Electro overloads 4×/s. For the planner this manufactures reactions that do not
  exist. This is the single largest fidelity gap in the module.
- ⚠️ **`MAX_FRAMES = 75 s` fails silently, twice**: applications past 75 s are dropped with
  no trace, and a live aura at the cap is truncated with no signal. Make it a parameter and
  return `truncated` / `droppedApplications`.
- ⚠️ **`expire` events are decay-only** — a reaction-consumed aura emits no `expire`. Either
  emit it on consumption or rename it.

✅ **All three bugs were re-verified against KQM, independently of gcsim** (⚓ Nate asked
whether gcsim itself might be the wrong one — a fair challenge, and the answer is no here):

- `docs/library/game/icd.md:100` already tabulates **`Burning | 2.0 s | 1,0,0,0,0,0,0,0
(every 8) | Burning aura application`**, and `elemental-reactions.md:373` states Burning
  _"[t]icks every 0.25 s and applies 1U Pyro between 0.25 s and 0.42 s after the 'Burning'
  text first appears, **then once every 2 s**"_. The two sources agree exactly (8 ticks ×
  0.25 s = the 2 s reset). ⚓ **The precise diagnosis is that `gauge.ts` conflated the DAMAGE
  cadence with the APPLICATION cadence** — 0.25 s is right for the DoT and wrong for the Pyro
  application, by a factor of 8.
- `elemental-reactions.md:161` — _"EC ticks **once per second**"_ — and `:266` — _"an enemy
  takes at most one EC instance every ~0.5 s."_ The duplicated chain produces ticks 0.2 s
  apart, violating both. One chain is the mechanic; two is a scheduling defect regardless of
  gcsim.
- `MAX_FRAMES` is not a mechanics question at all — a silently-dropped input is wrong under
  any model.

Known divergences to record, not fix: `FreezeResist`, hitlag (gcsim skips the reactable tick
during it), the Anemo cascade's cosmetic order, and gcsim's own variable-shadowing quirk in
`TryFreeze`.

Absent entirely and worth naming now: **shatter/poise on Frozen** (Geo or claymore teams will
read freeze uptime materially too long), **dendro core gadgets** (so no hyperbloom/burgeon
modelling), **Lunar-Charged** (⚠️ a live gap, not hypothetical — Ineffa, Columbina and Flins
are in the corpus), Lunar-Bloom/Lunar-Crystallize, and multi-target swirl spread.

✅ **Portability is clean**: zero imports, no browser APIs, no Svelte, runs under Node type
stripping today. Consumers to update: `GaugeInstrument.svelte:13`, `workspace.ts:9`, the test.

**Done when:** the three bugs are fixed with tests pinned to values lifted from
`pkg/reactable/*_test.go`, the cap is parameterised, and the eight uncovered branches the
audit listed have coverage.

### L2 — Integer frames (no behaviour change)

Flip the IR **and the parser's internal clock** to integer frames in one pass.

⛔ **Not a shim at the emission boundary.** Rounding only on the way out would bake
seconds-derived rounding into the L2 baseline, and then L3's genuinely frame-exact arithmetic
would differ by ±1 frame and the differ would flag _improvements as regressions_. Convert the
arithmetic, not the output. Cheap: FrameMap values are already integers and nearly all the
parser's time math is `frames / 60` additions.

⚓ **Exactly one rounding site:** JSON seconds → `Math.round(s * 60)` at the read site.

**Done when:** 1467 tests green with exact integer assertions replacing epsilon comparisons,
the 47 non-whole-frame values are enumerated and the three suspicious ones re-derived, and
the timeline renders identically.

### L3 — The clock-driven core (no behaviour change) — _the big one_

✅ **`parseNotation` has exactly ONE production call site** (`RotationTimeline.svelte:362`).
One door, and the strangler goes behind it.

- **L3a** — stand up `$lib/sim/`: frame clock, task queue, priority bands, character state
  machines. Nothing consumes it. **Measure the perf budget here and record it below.**
- **L3b** — drive the sim from the token stream alongside the live parser, behind a flag,
  with a **corpus differ** asserting IR deep-equality across all 123 characters —
  ⚠️ including `BuffWindow.id` **order** (C2).
- **L3c** — move the dispatchers one family at a time (states → cooldowns/charges → stacks →
  summons → shields → buff derivation), differ green after each. `buffWindows.ts` moves too.
- **L3d** — delete the old path.

⚠️ **The ten hard couplings the census found are the risk list**, and four need explicit
handling: the `findCastSummons` / `findSummonsForBar` duplicate pair that "must stay
identical"; `notationParser.ir.test.ts:28` importing its oracle _from the renderer_ so the
two copies can only drift together; `RotationTimeline.svelte:717–741` re-deriving bar
geometry from cast events (a second copy of a parser rule); and `moonsignRows.ts:14` owning
`GLEAM_WINDOW_S` outside `deriveBuffWindows`.

⚓ **The differ is the gate and it mostly exists.** Baseline: **51 files / 1467 tests / 2.7 s**
— fast enough to run on every edit, which is what makes a strangler this size sane.

### L4 — Frame re-derivation + application schema (data track — concurrent)

⚓ **One re-extraction pass, not two.** Under C4b this landing re-derives **all** frame data
from gcsim in the new shape _and_ authors the application lists, because both come out of the
same files in the same read. Splitting them would mean visiting 123 characters twice.

⚠️ **This landing changes behaviour** (timings shift by a few frames where the `swap` fallback
was understating), so it cannot ride the L3 differ. It is gated by the L0 oracle and by
`npm run build` + Nate's eyes, not by IR equality.

⛔⛔ **SUPERSEDED BY L0 (2026-08-16): do not extract statically.** The table below measured
reading gcsim's Go source; the L0 spike showed the same facts are **observable** by running
the simulator and reading its element log — hitmark = `element.frame − action.frame`, units =
`logs.dur / 25`, applies-at-all = presence of the event. Everything the static route flagged
as hard (loops, wrapper flattening, mode-indexed tables, runtime-dependent hit counts, the
25 sites needing a human) resolves because the simulator resolves it. The table is kept as
the record of _why_ we did not go that way — and as the fallback for the 12 characters with
no gcsim source. ⚠️ The new risk is **coverage**, not parseability: see
[`gauge-round-L0.md`](gauge-round-L0.md) §5.

Extractability of the **static** route, measured across 924 QueueAttack-family sites:

| surface                                          | verdict                                                                                                                                                                                                                 |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **plunges** (169 sites, 16 distinct expressions) | ~100% mechanical                                                                                                                                                                                                        |
| **normals**                                      | ~97% — ⛔ **read the `attackHitmarks` tables, not the call sites** (108/111 files declare one, and it is the same array the cancel frames are built from, so hitmark and cancel window stay consistent by construction) |
| **skill/burst** (388 sites)                      | ~64% fold to a plain integer with a two-rule folder; ~27% need loop interpretation over literal bounds; **~9% (25 sites) need a human**                                                                                 |
| **charged / aimed**                              | hardest; see the `travel` warning                                                                                                                                                                                       |

⚠️ **`travel` is a gcsim POLICY, not game data** — 76 `p["travel"]` sites, defaulting to 10.
⛔ Never ingest a hitmark expression containing it as measured frame data.

⚠️ **`skill.go`/`burst.go` is not the same set as "the skill and the burst."** 67 of 106
characters queue skill/burst-derived damage from `cons.go`/`asc.go`/a gadget file, and only
57% of sites sit lexically inside the entry function. Constellation-gated application is
real; the extraction must cover `cons.go`.

⚠️ **`QueueCharTask` and `Tasks.Add` are different clocks** (hitlag-stretched vs absolute).
We do not model hitlag; record that as a knowing simplification rather than flattening the
two silently.

⚠️ Two disjoint provisional sets, don't conflate them: **7 frameless characters** (blank,
illuga, kachina, lohen, prune, sandrone, zibai) and **~12 with no gcsim source** (blank,
iansan, ifa, illuga, jahoda, kachina, linnea, lohen, nefer, prune, sandrone, zibai).

⚓ **Update the `ingest-character` skill in the same landing.** A recipe that does not produce
application data means every future character ships without it and silently regresses the
sim. This is how the round decays if we skip it.

**Done when:** every curated ability has an application list, a lint rule requires one, and
the provisional set is enumerated and surfaced.

### L5 — The gauge replaces the coarse aura — _the payoff_

`AuraState` and `computeReactionsForApplication` are deleted. The sim feeds post-ICD
applications to the gauge; reaction events become gauge output. F2 stops being a hazard and
becomes ordinary scheduling, and the three order-dependent consumers work **by construction**
rather than by cap.

**Done when:** the oracle diff is materially better than the L0 baseline, with residual
divergences enumerated and explained. ⚓ **L5 merges on a measured improvement, not on being
finished.**

### L6 — Surface and honesty

- An aura lane on the timeline, and/or feeding the real rotation into the gauge instrument —
  _"here is your aura across your rotation, and here is where you lost it."_
- ⚓ A bar drawn from a **defaulted** unit value carries `--ui-provisional` — the existing
  squiggle rule ("we took it, it's a stand-in"), not a new vocabulary.
- The limits stated on the surface: **single target, no enemy-applied aura, no shatter, no
  hyperbloom/burgeon core modelling.**

---

## 6. Verification

| gate                                              | when                                                  |
| ------------------------------------------------- | ----------------------------------------------------- |
| `npx vitest run` (1467 tests, 2.7 s)              | every edit                                            |
| `npm run check` / `npm run lint`                  | every round                                           |
| `npm run build`                                   | every round — the production build is the real gate   |
| the L3 corpus differ (incl. buff-window id order) | every sub-step of L3                                  |
| the L0 oracle diff                                | after L4, L5, and before merge                        |
| `npm run test:e2e`                                | **pre-merge only** (~6 min, blocks the session)       |
| Nate's eyes                                       | anything visual; **Safari unverified until he looks** |

⚠️ Read the "N passed" line, not the exit code
([playwright#39753](https://github.com/microsoft/playwright/issues/39753)).

**Perf budget is a requirement, not an afterthought:** the editor re-parses on every
keystroke. A 120 s rotation is 7200 frames. Measure in L3a and record here — do not assume.

---

## 7. Two tracks, and how to parallelise

⚓ **Fan out the data. Never fan out the architecture.**

- **L4 is embarrassingly parallel** — 123 characters, each independently verifiable against
  gcsim, each a self-contained diff. This is what agent fan-out is for.
- **L3 is the opposite** — one coherent change with many seams. Splitting it produces
  inconsistent seams the differ will catch and nobody will enjoy fixing. One agent, one head,
  small verified steps.

---

## 8. How each landing gets planned

**Contracts up front; implementations just-in-time.**

- ✅ **Frozen now** (§3): time unit, IR shape, application schema, the post-ICD contract,
  module boundaries, determinism. These genuinely constrain everything downstream and are
  expensive to change late — 123 JSONs, four consumers, 51 test files.
- ⛔ **Not written now:** L5's and L6's implementation plans. L3 exists _to change what
  downstream code looks like_; a plan written against an architecture that does not exist yet
  gets rewritten. Worse, a stale plan **reads as authoritative and isn't** — this repo already
  carries `⚠️ SUPERSEDED` markers on notes that outlived their premises.

Each landing is planned in a fresh session immediately before it, reading this file plus the
previous landing's outcome. A landing that finds a contract wrong **amends §3 and says so in
the commit**.

---

## 9. Risks worth naming now

| risk                                                                                                                                                      | why it matters                                                                                   | how we find out early                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **The oracle may not be expressible.** gcsim's config language is its own; our `~5s` idles, swap model and notation may not translate for every rotation. | L0's value degrades if it covers only a subset.                                                  | L0 itself — report coverage honestly.                                           |
| **Buff-row order is an undeclared visible invariant** (C2).                                                                                               | A clock-driven sim emits in a different order; the IR looks "identical" and rows move on screen. | The L3b differ must compare id order.                                           |
| **Application data may be unextractable for enough abilities** that the sim runs mostly on defaults.                                                      | A simulator running on defaults is a confident-looking guess.                                    | L4's extraction census; ~9% of skill/burst sites already known to need a human. |
| **The burning-ICD bug manufactures reactions** (L1).                                                                                                      | It would land in the payoff landing and look like a modelling failure.                           | Fixed in L1, before anything depends on it.                                     |
| **The tool ships the wrong reactions until L5.** L2/L3 are explicitly behaviour-preserving.                                                               | If launch is gated on this round, **L5 is the gate — not L3**.                                   | Stated, not discovered.                                                         |

✅ **Disproven and removed:** the per-source-durability concern. gcsim's `Durability[mod][src]`
array is **provably equivalent to a single scalar** for aura arithmetic — `attachOverlap` can
only raise one slot to `amt`, `reduceMod` subtracts the same amount from every slot, `Tick`
decays all slots at one global rate, and no path reads an individual slot for gauge math (the
one per-slot read is damage attribution in `lunarcharged.go:96`). `gauge.ts`'s scalar is
correct. Not a blocker.

---

## 10. Open decisions

1. 🚧 **Install Go?** The oracle needs it (`brew install go`). Without it, L0 cannot happen and
   every downstream claim degrades from _measured_ to _argued_. **Recommendation: yes, first.**
2. **Does the aura lane ship in L6, or is the payoff purely correctness?** Affects nothing
   upstream; decide late.
3. **How honest is honest, on the surface?** Single-target is real, and gauge theory is where
   multi-target actually decides team value. Footnote, caveat chip, or a Help note — L6.

---

## 11. What this round is deliberately NOT

- ⛔ Not damage numbers. **Visualize mechanics, never calculate verdicts.** The sim makes the
  mechanics honest; it ranks nothing.
- ⛔ Not multi-target. One enemy, stated plainly.
- ⛔ Not a coarse-model refinement. There is no stable intermediate: decay without units has
  no principled rate, units without consumption still spams swirl. The simplifications hold
  each other up.
- ⛔ Not a rewrite. `parseNotation`'s door stays fixed; the room behind it is rebuilt in
  verified steps.

---

## Appendix — census artifacts

Six parallel inventories, 2026-08-16: parser anatomy (the five feedback edges), IR consumer
inventory (the ten hard couplings), the float-time surface, gcsim hitmark/durability
extractability, the data surface, and the `gauge.ts` ↔ `pkg/reactable` fidelity audit.
Findings are folded into the sections above; the raw reports are session artifacts, not
checked in.
