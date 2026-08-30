# The summon-`conditions` round — SPEC for a fresh session

**Status:** ⏭ NOT STARTED. Scoped 2026-08-31; ⚓ approach approved by Nate (option **a**).
**Why it exists:** a constellation that changes a summon's DURATION cannot be
modelled today, and **32 constellations across the corpus want to.**

---

## 1. The gap, precisely

`Summon` has **no `conditions` field**, and **zero** summons author one
(measured). So a constellation that lengthens a summon has nowhere to say so, and
every one of them is description-only. Alyosha C2 ("Hunter's Advance duration
extended by 6s") is simply the newest instance.

⛔ **`durationExtensions` is NOT the answer and must not be overloaded.** It means
a _per-trigger_ extension (`{trigger, delta, maxExtensions}`) — Collei's +1s per
dendro reaction. A constellation-flat extension has no trigger. Conflating the
two would wreck a working concept.

## 2. The approach — ⚓ option (a), approved

Give `Summon` a **`conditions`** field, then author the summon **twice** with
mutually exclusive conditions — the same shape the tick-cap round already uses
for a **conditional cadence** (Aino under Ascendant Gleam, Ororon at C4).

⚓ **That precedent is the whole argument**: the corpus already says "the same
series, twice, gated" when a constellation or team state changes a summon's
numbers. Duration is one more number.

⚠️⚠️ **Inherit the round's hazard verbatim:** `summonTickSeries` drops only a
**definitive false**, so a gated pair whose condition is UNRESOLVABLE fires
**BOTH**. Aino drew 10 markers while applying 12 for exactly this reason. Every
reader of a gated summon must take the same `ConditionContext`.

## 3. ⚠️ Triage FIRST — the 32 are not one class

⛔ **Do not sweep.** A blind pass would author `durationExtensions` cases as flat
durations and vice versa. Read all 32, sort, then author. First cut (regex, so
verify each):

**FLAT — a constant extension. The round's actual target (~12):**
`alyosha C2` · `candace C1` · `emilie C4` · `faruzan C2` · `kuki_shinobu C2` ·
`lohen C6` · `nilou C1` · `rosaria C2` · `sigewinne C4` · `sucrose C2` ·
`thoma C2` · `traveler_hydro C2`

**CONDITIONAL — belongs to `durationExtensions`, ⛔ NOT this round (~14):**
`gorou C2` (+1s per particle) · `kaeya C2` (+2.5s per kill, max 15s) ·
`dehya C2` · `iansan C6` · `nefer C2` · `yoimiya C1` · `mona C1` ·
`clorinde C2/C4` · `cyno C1` · `lauma C1` · `alhaitham C6` ·
`wriothesley C1` · `traveler_dendro C4`

**UNCLEAR — read before filing (~6):** `xiangling C4` (⚠️ **"+40%" — a
PERCENTAGE extension, a third shape neither branch covers**) · `dehya C6` ·
`furina C2` · `ifa C4` · `shikanoin_heizou C2` · `xingqiu C4`

## 4. Definition of done

- `Summon.conditions?: Condition` on the type, with JSDoc naming the gated-pair
  pattern and the definitive-false hazard.
- The FLAT set authored as gated pairs, **each verified at C0 AND at the gating
  constellation** — the tick-cap round caught three near-bugs precisely because
  it measured at both.
- A corpus differential: at C0 the parse must be **byte-identical** to today.
  ⚓ That is the proof, not a snapshot (see `constellationGating.test.ts`).
- Every reader of a summon takes the same `ConditionContext`; ⛔ no reader may
  resolve conditions differently from `collectSummonTicks`.
- Gates: vitest / check / lint / build, plus `test:e2e` before merge.

## 5. ⛔ Delegation note

Nate offered a workflow. **Use one only for the READING pass** — fan out to
report what each of the 32 says, barrier, then author once. ⛔ Never fan out the
authoring: parallel agents each interpreting a duration produce exactly the
inconsistency the roadmap's delegation rule warns about ("never fan out work
whose spec is 'does this feel right'").
