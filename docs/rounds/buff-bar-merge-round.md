# Buff-bar merge and off-field hits round (2026-08-15)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Merged `1c52b96` (+ `4b5f1df` for the pill geometry). Read before any buff-row projection, artifact `onHit`, or parser hit-stream work.

## ⚓ The hit stream used to stop at the ACTIVE character

Every record came from an E/Q cast or an N/CA/P swing, so an `onHit` effect held by an off-field damage dealer never fired — which silently disabled **Deepwood Memories, Tenacity of the Millelith and Silken Moon's Serenade**, all three authored and none reachable. Summon DAMAGE ticks now synthesize hits at finalize (step 6c).

- ⚠️⚠️ **They feed `deriveBuffWindows` ONLY.** ⛔ Do NOT "fix" this by calling `dispatchHit` — that machinery mutates live state in PARSE order and a finalize-time hit cannot be interleaved without a two-pass parse. Buff/resShred carry no stack state so they are correct; a summon tick feeding a STACK effect stays unmodelled, deliberately.
- ⛔ **A heal tick is not a hit.** Four summons pair heal+damage on the IDENTICAL interval (Diona, Kuki, Kokomi, Mizuki), so taking every tick fires each twice per instant. Filtering to damage is also why no dedup pass is needed — only Furina's Salon Solitaire has multiple damage series, and those are three real Salon Members.
- ⚓ **The discriminating test, and the thing that proves the model:** Tenacity is skill-hit-only, so **Xingqiu = 3.0s** (his off-field damage is his BURST) while **Xiangling = 10.1s** (Guoba is a skill summon). If those ever report the same number, the synthesis stopped distinguishing skill from burst.
- Corpus reach beyond the artifacts is only FOUR characters (Emilie C2, Escoffier passive, Anemo Traveler C6, Xiangling C1, all resShred), and for them it is an uptime CORRECTION, not a from-nothing gain.

## ⚓ Buff bars refresh-MERGE, and the seam question is SETTLED

A buff re-applied before it expires is ONE covered span with ONE label. Merged at the **projection** (`mergeRefreshedBars.ts`), so windows stay one-per-trigger and the PNG export gets it free (it consumes the same `snap.teamBuffRows`).

- ⛔ **NO interior seams** (⚓ Nate's call). The seam earns its place in the TB's Compare because there the lane IS the ability — it is the only place "where does this cast end" can live. In the planner the cast markers and E/Q bars sit one row up, so a seam re-encodes what the chart already says: the same redundancy the labels were guilty of. ⚠️ Nate's pain was **the LABELS**, not the bars.
- The 2px lit left edge **STAYS** — it was doing two jobs and only the "separate stacked bars" one retires; marking a buff bar as a different kind of object survives. ⚓ **It now means something**: only same-shape overlaps merge, so a surviving edge says "the buff CHANGED", not "a bar starts here".
- ⚠️ The RECEIVED surface is gated harder, and each clause is load-bearing: ramp/decay envelopes draw from `buffStart` and **RESTART on refresh**, so fusing two would paint one smooth gradient over a buff that actually reset — a lie the team surface cannot tell because it has no envelopes. `duration`/`procCooldown`/`isMutuallyExclusive` feed the tooltip. Guards are tested directly because that failure is INVISIBLE on screen.
- ⛔ **NB is excluded ON PURPOSE.** Its bar width IS its cooldown (`barGeom(ev.start, ev.cooldown)` with the 18/12/9s label inside), so bars can only ABUT — and abutting is what the merge treats as continuous. Running it there would fuse discrete NB fires and delete the lane's content. ⚓ Eligibility is **"windows that mean the same buff re-applied"**, ⛔ never "bars that touch".
- The Ascendant Gleam lane needed a second pass (`bb2ab62`) — it is built from cast events directly and sat outside the buff-row projection.

## Artifact `onHit` — the fourth branch

Rotation-wide (`firstTrackOfChar`), because a summon ticks while its owner is OFF-FIELD; scoping it per-track would cut the window at every swap. Effects canonicalise to a shape REPRESENTATIVE (Deepwood authors its shred twice, keyed to skill and to burst — same debuff, one row) and pool within a **(debuff, duration)** partition, so a multi-stat set draws one bar. `onHitTriggerMatches` is exported from the parser and REUSED — ⛔ don't fork a trigger gate.

Related: `docs/rounds/stance-cooldown-round.md` (queued, from the same report) · `docs/rounds/tb-compare-round.md` (where the seam rule came from).
