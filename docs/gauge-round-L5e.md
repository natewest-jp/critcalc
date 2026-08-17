# L5e — summon ticks apply their element (the recall half)

**Status:** ✅ **SHIPPED + verified 2026-08-16** — `637a175` · `7d63949` · `ab2701d` · `d5764a6` · `87f3b09`
✅ **Feed order fixed 2026-08-17** (`d0a87e5`) · ✅ **The curation residue closed 2026-08-17**
(branch `curation/l5e-summon-ticks`, §4's last block)
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
- **L5e-a¾** ✅ **SHIPPED 2026-08-16 (`ab2701d`)** — the gate is authored on **six effects
  across five summons** (Pyronado, Guoba, Gravity Ripple, Bake-Kurage, and Birgitta twice
  — she is spawned by both the skill and the burst). Corpus IR byte-identical over 257
  parses, so it is provably inert until L5e-b.
  ↻ **ON THE TRIGGER, NOT THE SUMMON** — §3.3 said per-summon and Furina disproved it:
  Salon Solitaire is ONE summon with THREE tick series measuring differently
  (Chevalmarin standard, Gentilhomme neither, Crabaletta indistinguishable).
  ↻ **Annotated only where standard is PROVABLY wrong.** The first census called any
  all-applied series `none` without checking whether standard also predicted all of them;
  where the interval exceeds the 2.5 s timer the two are indistinguishable, so ⛔ Yae's
  Sesshou Sakura and Furina's Crabaletta are deliberately left bare. Four-way:
  **NEEDS-none 5 · STANDARD 15 · EITHER 2 · OTHER 13**.
  ⚓ **The audit reads it back**, reporting applied/total and the measured verdict beside
  the authored claim (currently zero contradictions) — so ⛔ no `INERT` entry was needed:
  the consumer that keeps it honest is the one that re-measures it.
  ⚠️⚠️ **The key is NOT named after `icd.ts`, and that is load-bearing** —
  `orphanedSchema.test.ts` matches ACCESS by key name and the Visualizers' ICD instrument
  already fills the codebase with matching text, so that name would be permanently
  unverifiable. Found by deleting every access and watching the guard stay GREEN; renamed
  and watched it go RED. ⚓ **A guard is only as strong as its key name is unique.**
- **L5e-b** ✅ **SHIPPED (`d5764a6`)** — the live chain. Applications **57 → 145**, tier-2
  agreement **72 → 121** of 263, extra **0**, mismatch **0**. ✅ Verified by Nate in the
  browser: _"everything looking right, no buffs moved that I could see"._
  🐛 **The oracle was sizing its run too short** — the 3 "we apply and gcsim does not" were
  all Zhongli stele ticks past gcsim's horizon, i.e. ours being RIGHT. Sized off the
  longest window end now (which is why gcsim's own total moved 201 → 216).
  ⛔ **Never accept an `extra` without checking it against the horizon first.**
- **L5e-c** ✅ **SHIPPED (`87f3b09`)** — six tests on `applications`, each verified by
  BREAKING it. ⚠️ Two paths stay untested because the corpus cannot reach them (no ticking
  summon declares `terminatesOn: 'swap'` or carries `durationExtensions`) — ⛔ don't cover
  them with a fixture summon. Gates green incl. **e2e 73 + 73**.

### ✅ CLOSED — the `applications` feed order (2026-08-17, `d0a87e5`)

`collectApplications` used to SORT, so the projection was time-ordered while the order the
gauge was FED was not. The cast pipeline advanced the clock through the cast animation
before its emitters ran, so a cast's own application was scheduled into the past and
clamped to `now` (what `Clock.latecomers` counts) — and with L5e-b's summon ticks queued
at `Band.TICK` (10) against the cast's `Band.LAND` (20) at that clamped frame, a summon
could reach the gauge before the cast that spawned it. `gauge.advanceTo` is
`while (frame < target)`, so the earlier application landed at the later frame.

#### ⚠️⚠️ The census is what hid the size of it

Re-run verbatim as this document specified — `<name> E Q` over all 123 characters — it
still reports **4 inversions, ZERO cross-element**, reproducing the recorded number
exactly. That is a property of the CENSUS, not of the engine: a summon and its caster
share an element, so **one character can never exhibit the case that matters**, and the
whole point of a rotation is more than one character. Widened to the projections corpus
(123 characters × C0/C6 plus the 33 multi-character scenarios × with/without a loadout),
the same measurement reports **130 inversions, 37 of them CROSS-ELEMENT** — led by a
Xiangling Pyronado tick reaching the gauge 30 frames before the Xingqiu hydro it should
have followed, which decides which way that cycle's vaporize runs and who gets credited
with it.

⚓ **The documented flip condition — "a cross-element inversion becoming reachable" — had
already flipped, and the census as written could not see it.** ⛔ Never re-scope a
multi-character measurement to a single character.

#### The fix

Exactly the move planned: `castEnd` is named at the top of the cast pipeline, the two
consumers that read the post-advance cursor (`advanceChain`, the burst `cdReset`) read it
directly, and `clock.advance(castEnd)` runs LAST. The whole pipeline therefore schedules
at `clock.now === castStart`, nothing clamps, and the clock orders every application by
its own frame.

⛔ **The sort is GONE rather than kept for safety** — it would silently absorb the
defect's return. The invariant is pinned over the corpus in `notationParser.ir.test.ts`
instead, and was verified the only way a guard can be: by reverting `run.ts` and watching
**12 tests go red**, one of them naming a cross-element pair
(`fischl electro@107` → `bennett pyro@91`).

#### What moved — 55 of 314 corpus cases

| surface                                                      | cases | what                                                                                                                                     |
| ------------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `tracks` (eBars/qBars/inputBlocks)                           | **0** | ⚓ no bar on the timeline moves                                                                                                          |
| summon / shield / nb / moonsign / weaponProc / received rows | **0** |                                                                                                                                          |
| `teamBuff` rows                                              | 7     | onReaction bars start earlier with their reaction; ⚓ no row added, removed or REORDERED — the `BuffWindow.id`-order hazard did not bite |
| `events`                                                     | 34    | 17 id-only; 17 real (below)                                                                                                              |
| `windows`                                                    | 26    | 19 provenance-id only; 7 geometry                                                                                                        |
| `applications`                                               | 2     | one stale Oz tick per Fischl case                                                                                                        |
| `auraSeries`                                                 | 41    | the trajectory                                                                                                                           |

- **Reaction ids now precede the next cast's**, so id order agrees with time order — a
  strengthening of the invariant the round called its most dangerous hidden coupling.
- **Every reaction time that moved, moved EARLIER** — median −30 frames, max −58. Net
  **+1 frozen and +1 electroCharged** (a Citlali/Furina pair the mis-ordering was
  destroying outright) and **−2 vaporize** across 20 cycles, with Xiangling taking the
  vaporize credit Xingqiu was wrongly collecting each cycle — which is why the 20-cycle
  fixture grows ten more Instructor windows on her.
- **Fischl lost one application per case**, and it was a bug: an Oz tick firing 55 frames
  after its summon window had been truncated by the burst recast. The generation stamp
  now lands at the cast rather than at the animation's end, so a tick inside the burst
  animation is superseded, matching finalize's own truncation.
- ⚓⚓ **19 of the 41 moved trajectories have IDENTICAL applications and events.** That is
  the visible half: the aura lane drew its application pip at the true frame while the
  line stepped later — Columbina's hydro pip at 8.05 s against a step at 8.15 s. ⚓ **The
  pip and the line it points into now agree**, and the trajectory gains the samples it was
  missing (50 → 52 points in that case).

Gates green: vitest **1570**, `check`, `lint`, `build`, and **e2e 73 + 73** (the
worker-teardown errors are the documented upstream Chrome bug, exit 0). ✅ **Verified by
Nate on the live tool AND in real Safari** — merged as `d0a87e5`.

#### The oracle is byte-identical

145 applications ours · **0** extra · **0** mismatch · tier-2 **122 of 264** agreeing at a
mean |Δ| of **0.173U** — the same numbers before and after, and all 145 paired rows match
on OUR column. ⚠️ Nine rows differ between two runs of the audit; every one of them moved
on GCSIM's side, which is the documented ±1 flicker. ⚓ The twelve oracle fixtures simply
do not reach the case — which is the argument for the corpus differ living beside them,
not instead of them.

⏭ The 30-application curation half is **separate work, not a sub-landing here** — it has
its own visible-change gate (§1) and does not block any of the above.

### ✅ CLOSED — the curation half (2026-08-17, branch `curation/l5e-summon-ticks`)

Twenty-three characters, twenty-five sites, one commit each. Each site was researched by
its own agent against `~/Code/gcsim` and its talent sidecar and then re-derived from
scratch by an adversarial verifier; the evidence for every number lives in the summon's
`_curatorNotes`, naming the Go function and the sidecar row.

| metric                          | post-feed-order | **after**       |
| ------------------------------- | --------------- | --------------- |
| applications — ours             | 145             | **169**         |
| **gcsim applies, we do not**    | 70              | **50**          |
| we apply, gcsim does not        | 0               | **3**           |
| element mismatch                | 0               | **0**           |
| tier-2 agreeing                 | 121 of 263      | **134 of 277**  |
| 🔴 aura gcsim has and we do not | 45              | **27**          |

⚓⚓ **The result worth reading is not the count — it is that the residue is now ENTIRELY
the two named schema gaps.** Of the 50 remaining: **16** application-only ticks · **13**
Nahida's Tri-Karma and Fischl's A4 · **17** ICD-group residue on Oz, the Stone Stele and
Pyronado · 4 stray cast applications. ⚓ **Not one is a summon we author that ticks in
game and says nothing here.** §1's "there are ZERO summons we fail to author" now has its
counterpart: there are zero authored summons whose measured damage cadence we withhold.

#### 🆕 The schema gap this round FOUND: an application-only tick

⚓ **A tick can apply an element and deal no damage, and we cannot say so.** gcsim's
`AttackInfo` for Xingqiu's Orbital and Barbara's Melody Loop carries **no `Mult` at all**
— Barbara's is explicit, `ai.Mult = 0` with a `// 0 DMG attack` comment. Our gauge is
reachable only through `(e) => e.type === 'damage'` (`aura.ts`), so authoring one needs a
`scaling: 0` placeholder that the outlier audit flags and that draws a damage marker
which lies. ⛔ Both sites were REFUSED for that reason, and they are **16 of the 50** —
the single largest remaining bucket. ⚠️ Xingqiu is worse than one refusal: `applyOrbital`
EXTENDS one entity keyed `orbitalKey` rather than spawning a second, so authoring the
same series on both the skill's Rain Swords and the burst's Rainbow Bladework would
double-apply through every normal rotation.

⚠️ This also retires a line of §1's: "24 abilities own a summon with no damage tick" was
right about the count and wrong to call all of it curation. Five of the twenty-five sites
were not tick series at all — Amber's Baron Bunny, Ganyu's Ice Lotus, Ningguang's Jade
Screen, Qiqi's Talisman and the Geo Traveler's Wake of Earth are **single cast hits**,
authored into `application[]` where they belong. ⚓ **A `× 1` row in §5 is not a cadence**:
the report groups a stream by its gcsim ability STRING and files it under the summon
whenever the ability declares one, so a cast's own hits appear in the summon column
whenever gcsim names them after the ability. Three of the five were `application: []` —
the positive claim that the cast applies nothing — and were simply wrong.

#### ⚠️ The over-application the round has to own

The three new "we apply, gcsim does not" are understood, and ⛔ neither is a horizon
artifact (L5e-b's rule): two are Collei's leaps and one is Sucrose's fourth tick.

- **`other`-group series over-apply, and by more than "±1–2".** §3.3 justified the bare
  default on Oz, where standard predicts 4 against a measured 3. It does not hold at
  speed: `ICDGroupColleiBurst` is a 180f reset, so at a 0.5 s cadence **exactly one leap
  applies in game** where our standard default lets four through. Venti measures 7 of 20,
  Navia 6 of 17. ⚓ The ranking in §3.3 is still right — standard is nearer than ungated
  in every case — but the residual is a factor, not an offset, on a fast series.
- **Tick count is derived from `duration`, and there is no cap.** Sucrose's `duration`
  counts from the SPAWN while gcsim's status counts from the CAST; Mona's 4 s window
  spans a fifth tick where gcsim's loop caps at `i < 300`; Kuki's 2 s spans 120f against
  gcsim's 119. ⚠️ It is a **pre-existing corpus class**, not something this wave
  introduced — the same off-by-one already sits on Aino's Ducky, Kuki's Grass Ring, Kaeya
  and Durin — but a tick that applies an element is the first consumer that makes it
  visible. ⛔ Do not fix it by nudging a `duration` that the kit text states: the honest
  shape is a tick CAP in the schema.

#### What else was found and deliberately not authored

Each is recorded in its character's `_curatorNotes`. **Elemental Absorption** on Venti,
Sucrose, Kazuha and Lynette rides the same cadence with a real multiplier, but its
element is chosen once at runtime and a tick series cannot say "whichever element this
field touches". **Lauma's tick is ATK + EM** and a damage effect carries one stat, so the
EM addend is dropped. **Sayu's Daruma** chooses between attacking and healing on the
active character's HP; **Kuki's rite** runs twelve ticks below 50% HP — HP is not a
condition subject. And **Lisa's existing frame-56 application** describes a hit gcsim
gives `Durability: 0`, so it claims 1U provisional where the game applies nothing.

⚓ **Kaeya is the one that needed the constellation gate.** C6 adds a fourth icicle, which
is a CADENCE change (`offset := 120 / count`, 40f → 30f) rather than a damage bonus, so it
is two mutually-exclusive series — `summonTickSeries` evaluates `conditions` against the
live level, and one C0 number with a prose note would have been wrong for every C6 Kaeya
on a timeline.

⚠️ **The verifier stage earned the round.** Three of the eighteen authored series were
written onto the ABILITY's `effects[]` instead of the summon's — a strict `characterLint`
D.28 error AND completely inert data, the exact bug class `orphanedSchema.test.ts` exists
for — and were caught and moved. ⛔ Never run an authoring fan-out on this schema without
an independent re-derivation pass behind it.

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
