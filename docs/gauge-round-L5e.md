# L5e — summon ticks apply their element (the recall half)

**Status:** 🔄 in progress — L5e-a shipped 2026-08-16 (`637a175`); L5e-b next
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

⚠️ **Count and interval agree; PHASE is unverified.** gcsim's first Pyronado tick lands
0.63 s after the cast's own application, and our offset is composed from
`summonActivatesAt` + `firstTickDelay` — check the composition at implementation rather
than assuming it lines up.

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

### 3.3 ⛔ No ICD gate on a summon tick — MEASURED, not assumed

§5 of L5's plan prescribed a per-summon ICD clock keyed `${characterId}:summon:${label}`.
**The measurement says do not add one.** gcsim applies on EVERY damage tick: Pyronado's
9 ticks produce 9 applications at 1.217 s spacing, Guoba's 4 produce 4. Under standard
ICD (3 hits / 2.5 s) a 1.217 s interval would apply roughly every third tick — so these
summons are `ICDTagNone`-equivalent, exactly consistent with L4d's census that **112 of
166 gcsim skills are `ICDTagNone`**.

⚓ **Default ungated; add a clock only for a summon MEASURED to need one.** That follows
`icd.md`'s standing rule that the default must not be mass-annotated, and it keeps this
landing from inventing a gate the oracle would then have to argue back down.

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
- **L5e-b** — the live chain: spawn hook, chained ticks, liveness at fire. Applications
  reach the gauge. ⚠️ **This is the behaviour change** — measured by the oracle, gated by
  Nate's eyes, ⛔ never by IR equality.
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
