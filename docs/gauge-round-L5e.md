# L5e — summon ticks apply their element (the recall half)

**Status:** 🔄 in progress — L5e-a (`637a175`) + L5e-a½ (`7d63949`) shipped 2026-08-16; §3.3 ICD decision MADE — L5e-a¾ (annotation) then L5e-b (the chain)
**Reads:** [`gauge-round.md`](gauge-round.md) (the contract) · [`gauge-round-L5.md`](gauge-round-L5.md)
(the gauge, and this landing's decomposition in its §5) · [`gauge-round-L3.md`](gauge-round-L3.md)
(the clock)

> L5 shipped PRECISION: auras decay, reactions stop being phantoms. L5e is RECALL —
> the summons that sustain an aura in game currently apply nothing at all.
> ⚓ **It is engine work, not curation.** The plan below is written against a measured
> decomposition, not the round's original guess.

---

## 1. The gap, and who closes it

⛔ **Do not re-derive this and do not repeat the retired framing.** L5's record claimed
the recall ceiling was mostly DATA — summons "not authored in our corpus at all". That
was measured and is backwards. There are **ZERO** summons we fail to author.

The oracle's 144 missing applications, attributed by ability from its own 🔴 rows (the
per-fixture counts sum to 144, and the aura column to 82):

| bucket                                | apps   | what closes it                         |
| ------------------------------------- | ------ | -------------------------------------- |
| summon authored **with** damage ticks | **84** | ⚓ **this landing, alone**             |
| summon authored, **no** damage tick   | **30** | curation; this landing then carries it |
| neither — other data/schema gaps      | **30** | case by case, mostly L4-family         |

**The 84 is what L5e is for:** Xiangling Pyronado 45 · Guoba 20 · Fischl Oz 15 ·
Zhongli Stone Stele 4. Every one already carries a damage `summonTick` with an interval,
a first-delay and an **element** — they tick correctly today and simply never reach the
gauge.

⚓ **The authored series already reproduces gcsim's, in count and interval.** Measured on
the melt fixture, which is the cheapest possible confidence that this landing is wiring
rather than modelling:

| summon   | ours (authored)                            | gcsim (observed)                   |
| -------- | ------------------------------------------ | ---------------------------------- |
| Pyronado | `int=1.217 first=0` over 10 s → **9**      | **9** applications, spaced 1.217 s |
| Guoba    | `int=1.667 first=1.883` over 7.3 s → **4** | **4** applications, spaced 1.665 s |

↻ **PHASE IS NOW CHECKED, across all twelve fixtures** (2026-08-16, before L5e-b). For
Xiangling it is **exact — 1 frame** on both summons in every fixture they appear in, so
the worry this line originally carried is closed for 65 of the 84.

⚠️⚠️ **But the check did not come back clean, and it retired a ruling.** It found that
summon ticks CAN be ICD-gated (Oz applies ~1 in 3), which §3.3 had ruled out on a
one-character sample; plus two data bugs — Fischl's two Ozes running concurrently (§3.4)
and Stone Stele's first tick 2.4 s late (§3.5). ⚓ **Read §3.3–3.5 before starting L5e-b**;
they change what it has to do.

### The 30 that are curation, and what they are NOT

24 abilities own a summon with no damage tick — 21 are geometry-only shells
(`effects: []`), 3 carry heal ticks only. ⛔ The job is **"add a tick series to an
existing summon"**, never "author a summon": spawn offset, duration, `terminatesOn` and
the lane are already done for all 24, and `gcsim-frames-diff.md` §5 supplies a measured
first-frame and interval for every row. Only the scaling is real curation.

⚠️⚠️ **That curation lands a VISIBLE change without this engine work.** `finalize.ts`
step 6c already synthesizes off-field hits from `computeSummonDamageTicks`, so a new tick
series moves buff windows the moment it is authored. ⛔ It is not a silent data top-up
and must not be batched as one — it needs Nate's eyes like any behaviour change.

---

## 2. Why it is not a bolt-on

⚓ **A summon's END is computed at FINALIZE and nowhere else.** `finalize.ts` step 6
needs three things the parse does not have in hand at the cast:

1. the post-extension `bar.uptime` (a `durationExtension` can grow it mid-parse —
   Collei's Cuilein-Anbar),
2. the owner's next swap-out (`activeStart` of the next track owned by someone else),
3. recast truncation from a cast that has not happened yet.

A tick task has to ask _"is this summon still alive at my instant"_, and today the only
answer lives in a pass that runs after every tick would have fired.

⛔ **Do NOT answer that with a second geometry.** A parallel live registry recomputing
spawn/end alongside finalize's is the `findCastSummons` / `findSummonsForBar` trap this
round already paid for once — two copies wearing a MUST STAY IDENTICAL warning, which
had silently drifted by the time they were merged.

### ⚓ The insight that makes it tractable: all three are LIVE-answerable at fire

**Clock monotonicity does the work.** A tick scheduled at T fires when the clock reaches
T, and by then the parse has processed everything strictly before T. So:

- an extension that landed before T is already in `bar.uptime` — read the bar **by
  reference**, never a snapshot taken at the cast;
- a swap-out before T has already happened and is in live track state; a swap-out after
  T cannot affect a tick at T;
- a recast before T has already happened and can stop the chain.

⚓ **So the question a tick asks is never about the future.** That is why chaining works
and why no registry is needed: move the authority, don't copy it.

⚠️ **The one known cost, documented not silent:** an extension landing AFTER a chain has
stopped cannot revive its tail. Extensions in the corpus arrive while the summon is still
up, so this is a simplification we are choosing, and it is stated here so a future reader
does not discover it as a bug.

---

## 3. The design

### 3.1 One `summonEndAt`, called by both sites

Extract the end computation so finalize and the live chain share it. Today finalize does:

```ts
const { start, end } = summonSpan(bar.start, bar.summonActivatesAt, bar.uptime, summon, i);
let endAt = end;
if (summon.terminatesOn === 'swap' && swapOutAt < endAt) endAt = swapOutAt;
```

⚠️ **Fold the swap clamp in; leave recast OUT.** Recast is not a property of one
summon's end — finalize expresses it by mutating the _prior_ window, and the live chain
expresses it by stopping. Pretending one function covers all three would be the same
over-unification the round is trying to avoid.

```ts
summonEndAt({ barStart, summonActivatesAt, uptime, summon, index, swapOutAt }): number
```

Each site supplies its own inputs and they agree because the inputs are the same facts
observed at different times — the owner's first swap-out after the spawn IS finalize's
`swapOutAt`; a recast at R IS finalize's truncation to the new spawn.

### 3.2 Ticks chained ONE AT A TIME

Each fired tick schedules the next and re-checks liveness against the current end when it
fires. Truncation then needs no cancellation — a recast or swap earlier in clock time
simply ends the chain, which is the contract's own _"expiry is a task that re-checks
validity on fire"_ (§2's table).

The spawn hook goes beside `emitReactionsAtCast` in `run.ts` (~:754), which is where the
cast already has `char`, `kind`, the bar and the resolved spawn offset.

### 3.3 ↻ ICD on a summon tick — the "no gate" ruling was WRONG, and is retired

⛔ **Do not restore it.** This section previously ruled that a summon tick needs no ICD
clock, and deleted the one L5's §5 had prescribed. That ruling was generalised from
Xiangling alone — the only summon in the fixture I checked — and the phase check ran it
into a counter-example immediately.

Measured across all twelve oracle fixtures, our would-be tick stream against gcsim's
observed applications:

| summon      | our damage ticks | gcsim applications | verdict                           |
| ----------- | ---------------- | ------------------ | --------------------------------- |
| Pyronado    | 9                | 9                  | ✅ ungated, phase exact (1 frame) |
| Guoba       | 4                | 4                  | ✅ ungated, phase exact (1 frame) |
| Oz          | ~10 per window   | **3–5**            | ⚠️ **ICD-GATED, roughly 1 in 3**  |
| Stone Stele | 14               | 4 (sim horizon)    | ⚠️ phase off by 2.34 s — see §3.5 |

⚓ **So it is PER-ABILITY, which is exactly what L4d's census already said** — 112 of 166
gcsim skills are `ICDTagNone` and **the rest are not**. Xiangling's two summons are in the
majority; Oz is in the minority. ⛔ A blanket rule in either direction is wrong, and
"measured" on one character is not measured.

⚠️⚠️ **This lands L5e-b straight on the schema gap L4 named as its top one** (per-ability
ICD tag + group). Un-gated, Oz over-applies electro roughly 3×; gated by default,
Xiangling's 65 applications — **the bulk of this landing's 84** — would be wrong instead.

#### ⚓ THE DECISION — default STANDARD, annotate `none`, enumerate the residue

⚓⚓ **The gcsim dump already answers this and no Go had to be read.** `main.go` records
`applied` per damage event — true only when the element stream carried an application at
that frame, i.e. the POST-ICD subset — so every summon's gate is measurable from the
capture the frames audit already runs. Measured on the 35 multi-hit series belonging to
characters whose summons we tick, against `icd.ts` at `STANDARD_ICD_FRAMES`
(`{timer: 150, hits: 3}`):

| verdict                             | series | meaning                                                                             |
| ----------------------------------- | -----: | ----------------------------------------------------------------------------------- |
| `NONE` — every tick applies         |  **7** | Pyronado, Guoba, Birgitta, Bake-Kurage, Columbina, Sesshou Sakura, one Salon Member |
| `STANDARD` — `icd.ts` reproduces it | **15** | Grass Ring, Lumidouce, Crystal Collapse, Gust Surge, Lea Lotus, …                   |
| `OTHER` — neither                   | **13** | Oz (3 vs 4), Stone Stele (3 vs 4), White Flame (7 vs 5), Gentilhomme (2 vs 4)       |

**So: absent ⇒ STANDARD ICD; author `none` on the seven.** The reasoning, in order of
weight:

1. **Gated is the majority.** 28 of 35 series are gated in some form and only 7 are not,
   so ⚓ the ANNOTATION is the minority — which is exactly what `icd.md`'s rule against
   mass-annotating a default asks for, rather than in tension with it.
2. **Standard is the closer wrong answer for `OTHER`.** Oz measures 3, standard predicts
   4, ungated would give 10. Every `OTHER` row is nearer standard than nothing.
3. **It is measured, not guessed** — no ICD group is invented, and the seven are read off
   the same oracle the corpus's frames and applications came from.
4. **Unmeasured summons fail conservatively.** The 12 characters with no gcsim source
   default to standard, which under-applies rather than manufacturing the phantom
   reactions this whole round exists to delete.
5. **It gets this landing's biggest contributors exactly right**: Pyronado and Guoba are
   two of the seven, and they are **65 of the 84**.

⚠️ **Residual, stated not hidden: the 13 `OTHER` series stay wrong**, by ±1–2 on a series
in almost every case (worst: Furina's Gentilhomme Usher, 2 measured vs 4 predicted). They
are real gcsim ICD GROUPS with their own timers — the L4 schema gap in full view — and
closing them is per-ability group data, ⛔ its own L4-family landing and not a blocker
here. The split cuts both ways (Oz and the stele tighter than standard, Durin's White
Flame and Escoffier's Parfait looser), so ⛔ there is no single fudge factor to reach for.

**Shape:** a per-summon annotation, because a summon's ticks are ONE gcsim attack with one
tag. Absent ⇒ standard; `'none'` ⇒ ungated. ⛔ Do not make it a free-form group name until
there is a consumer for one — that is `twoPiece`'s mistake (declared, read by nobody).
⚠️ The clock is keyed `${characterId}:summon:${label}` per L5 §5, which matches the
isolated dump's scope: a summon's counter is its own and is shared with nothing.

**Where it comes from:** ⚓ in-pattern with L4 — `audit-gcsim-frames.mjs` grows an
applied/total column in §5 and REPORTS the verdict; a migration writes it. ⛔ The audit
never authors.

⚓ Silver lining worth stating: **65 of the 84 are Xiangling's, and those are verified
exact** — count, interval and phase. So the majority of this landing's value does not
depend on resolving the ICD question at all.

### 3.4 🐛 Fischl's two Ozes overlap — a pre-existing bug this landing would amplify

Parsing `Barbara E > Fischl E Q > Barbara N3` emits **two concurrent Oz windows**:

```
fischl "Oz" source=skill  1.32s → 11.32s
fischl "Oz" source=burst  1.75s → 11.75s
```

In game the burst's Oz REPLACES the skill's; there is only ever one. The cause is data
plus an asymmetry: `terminatesOn: 'recast'` is authored on the **skill's** Oz and not the
**burst's**, and finalize reads that flag off the summon being emitted — so E→Q does not
truncate while Q→E does. ⚠️ It is visible on the timeline today as two Oz lanes, and it is
why our tick stream shows ~20 where one window gives ~10.

⛔ Fix the DATA (`terminatesOn` on the burst's Oz), not the truncation rule — the rule is
right that a summon declares its own termination. ⚠️ Verify no other multi-cast summon
has the same hole before L5e-b lands.

### 3.5 🐛 Stone Stele's first tick is 2.4 s late

Ours fires at spawn + 2 s, gcsim at cast + 4 s — a constant **−2.34 s** offset on every
tick, while the 2 s interval and the cast itself agree (our Zhongli E pairs at 5.23 s vs
gcsim's 5.17 s, 4 frames). The stele authors no `firstTickDelay`, so `collectSummonTicks`
defaults it to the interval. ⚓ `gcsim-frames-diff.md` §5 already carries the row —
authored `0f` against observed `144f` — so this is a known data gap the phase check simply
walked into. Author `firstTickDelay: 2.4`.

⚠️ Also seen and NOT chased: in the long-rotation fixture only, Xiangling's ticks run a
constant **+0.25 s** late while the same summons are exact in four other fixtures. That is
cast drift accumulating across the `~20s` waits, not a summon-phase issue — pre-existing,
small, and out of scope here.

### 3.4 ⚠️⚠️ Step 6c STAYS WHERE IT IS

The finalize-time hit synthesis feeds `deriveBuffWindows`, and moving it moves `hits`
order — the one thing L3 refused to spend. The tick APPLICATION is a **second reader of
the same `computeSummonDamageTicks` rule**, ⛔ never a second copy of the walk.
`collectSummonTicks` is already the shared primitive both existing readers go through;
this adds a third.

---

## 4. The sub-landings

Each is one commit, gates green (`vitest` · `check` · `lint` · `build`) before the next.

- **L5e-a** ✅ **SHIPPED 2026-08-16 (`637a175`)** — `summonSpan` replaced by the pair the
  two call sites need: `summonSpawnAt(...)` + `summonEndAt({ spawnAt, barUptime, summon,
index, swapOutAt })`, with the swap clamp folded INSIDE so an unclamped end can no
  longer be obtained. Recast stayed at the call site as planned.
  ⚠️ **The plan named the wrong gate: the L3 corpus differ does not exist** — it died with
  the frozen parser copy at L3e, and what survives (`projections.test.ts`) asserts
  coverage, no-throw and all-finite but **NOT values**, so a green vitest cannot gate a
  geometry refactor. Proven instead by dumping the full IR over that same corpus (314
  parses, 1,921 windows, 616 of them summons) before and after: **byte-identical**.
  ⚓ And the dump was verified against a seeded one-frame perturbation FIRST, so it is not
  green because nothing ran (L3's own lesson). Throwaway, deleted in the same turn.
- **L5e-a½** ✅ **SHIPPED 2026-08-16 (`7d63949`)** — the two data bugs, plus two more they
  uncovered. Burst Oz's `terminatesOn` (§3.4) and Stone Stele's `firstTickDelay: 2.4`
  (§3.5) landed; a corpus sweep confirmed **Oz is the only** summon label spawned by two
  abilities with inconsistent `terminatesOn`.
  🐛 **The audit was describing a model we do not have** — `audit-gcsim-frames.mjs`
  computed authored-first as `firstTickDelay ?? 0` while the walk uses `?? interval`, so
  on the **11** summons that author no delay it manufactured a phantom discrepancy exactly
  one interval wide. Columbina's Gravity Ripple (reported 117f wrong) and Durin's White
  Flame (59f) are **EXACT**; Gorou and Kuki are within 1–2 frames. ⚓ The same failure mode
  L4d recorded for the reaction oracle.
  🐛 **And the Oz fix exposed an ordering bug in finalize**: step 6 emitted every eBar then
  every qBar, so `lastSummonWindowByKey` meant "last EMITTED", and recast truncation could
  shorten a window whose cast had not happened yet (`Fischl Q E` gave an Oz ending 2.75 s
  before it started). Summon bars emit in **cast order** now — ⚓ which is what L5e-b's
  live chain necessarily sees, so it is the two paths agreeing rather than a patch.
  ⚠️ `notationParser.ir.test.ts`'s independent reconstruction held the identical defect and
  reproduced it faithfully; corrected there too, and ⛔ still re-derived rather than
  collapsed onto `summonEndAt`.
  ⏭ **Nate has not looked at this yet** — Fischl draws ONE Oz lane handing off at the
  recast, and Zhongli's stele markers shift 2.4 s later.
- ⏭ **L5e-a¾ — the ICD annotation** (§3.3's decision): the audit reports applied/total per
  summon series, a migration authors `'none'` on the seven, and the schema gains the
  field. ⚠️ **No behaviour change on its own** — nothing reads it until L5e-b, so it gates
  on the corpus IR being byte-identical, exactly like L5e-a.
- **L5e-b** — the live chain: spawn hook, chained ticks, liveness at fire, ticks gated
  through `icd.ts` on the per-summon clock. Applications reach the gauge. ⚠️ **This is the
  behaviour change** — measured by the oracle, gated by Nate's eyes, ⛔ never by IR
  equality.
- **L5e-c** — measure, record, merge. Oracle re-run, residue enumerated, `gauge-round.md`
  §5 updated, memory written, `test:e2e` before the merge.

⏭ The 30-application curation half is **separate work, not a sub-landing here** — it has
its own visible-change gate (§1) and does not block any of the above.

---

## 5. The measurement

⚓ **Quote the recorded baseline, never recompute it** (memory `project_gauge_round`).

| metric                       | L0 baseline | post-L4 | post-L5 | **L5e target** |
| ---------------------------- | ----------- | ------- | ------- | -------------- |
| applications — ours          | 63          | 57      | 57      | **~141**       |
| **gcsim applies, we do not** | 138         | 144     | 143     | **~60**        |
| we apply, gcsim does not     | 1           | 0       | 0       | **0**          |
| element mismatch             | 0           | 0       | 0       | **0**          |

Tier 2 (the aura trajectory, 252 samples) is the real scoreboard: **82 🔴 today**, and the
84 engine-closable applications are what should move it.

⚠️ **The targets are arithmetic from the decomposition, not predictions.** Closing 84 of
144 leaves 60; whether tier 2's 82 falls proportionally depends on which auras those
applications sustain, and a few will overshoot into 🟠 (ours-only) as decay tails lengthen.
⛔ Do not treat a miss against these numbers as a regression without reading which bucket
moved.

**Done when:** the 84 are applying, the oracle shows a materially better missing-application
count with the residue attributed by bucket, and ⚓ **the landing merges on a measured
improvement, not on being finished** (contract §5).

---

## 6. Risks

| risk                                                                                         | handling                                                                                                                     |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **A self-rescheduling tick chain and `clock.drain()`.**                                      | Chains are bounded by summon duration and stop on liveness failure. Pin with a test that a chain at rotation end terminates. |
| **Buff windows move.** New applications → new reactions → `deriveBuffWindows` inputs change. | Expected, and it IS the landing. ⛔ Never gate on IR equality. Nate's eyes plus the oracle, as at L4 and L5.                 |
| **`summonEndAt` extraction silently changes finalize.**                                      | L5e-a is behaviour-zero by construction and the L3 corpus differ proves it. ⛔ Don't fold the extraction into L5e-b.         |
| **Phase disagreement on tick offsets** (§1's ⚠️).                                            | Verify `summonActivatesAt` + `firstTickDelay` composition against the oracle's observed first-tick times before L5e-b lands. |
| **An extension after a chain stops cannot revive the tail.**                                 | Documented simplification (§2). Corpus extensions arrive while the summon is up.                                             |
| **Over-gating on ICD.**                                                                      | ⛔ Default ungated — §3.3 measured it. Add a clock per summon only on evidence.                                              |
