# Every hit a swing lands — the multi-hit round (PLAN, 2026-09-20)

_Status: **PLANNED, not started.** ⚓ Nate's decision (2026-09-20): the FULL
implementation — "we need to account for all hits, and infusions do matter."
The small option (author `lands` = first hit on the maps that state only `hit`)
was considered and declined: it is a subset of this. Start in a fresh context,
at §3's MEASUREMENT. Parent: `docs/swing-hitmark-round.md` (§1.K)._

## 1. The defect

**One swing is one hit** in our model. In the game, and in gcsim, a swing can
land two, three or four. Everything that counts hits is therefore wrong on those
swings, and it is wrong in the same direction every time:

- **ICD counts HITS.** The standard rule is "every third hit, or 2.5s". A two-hit
  swing spends TWO slots of that budget, so an infused string containing one
  applies on different swings than ours does. This is the reason the round
  exists: Bennett C6, Candace, Chongyun's field and every stance infusion turn a
  physical multi-hit string elemental.
- **Every `onHit` counts hits.** A stack grant with no `procCooldown` gains once
  per hit; a coordinated attack, a cooldown reduction (Varka's Secret Rite, 15 per
  stance) and an artifact `onHit` each see one event where the game fires two.
- **The landing instant.** `FrameMap.hit` is gcsim's LAST hitmark on these maps
  (73 of 82), so their one hit also lands a median 12f late (max 27).

`hits.ts` has documented this as an approximation since the onHit wiring
("until a `NormalHit.hitCount` consumer appears"). This round is that consumer.

## 2. Measured (2026-09-20, gcsim `e82383e4e`, dumper with `travel: 0`)

- **82 normals that state `hit` land more than one hit**, across **55
  characters**: 77 two-hit, 4 three-hit, 1 four-hit. By weapon: polearm 28,
  sword 25, bow 13, claymore 11, catalyst 5. `hit` is the last hit on 73, the
  first on 3 (Cyno's Pactsworn N4, Ayato's Shunsuiken N1, Furina's N1 — a cancel
  that opens before the second hit, by design).
- **17 are elemental in an UNINFUSED capture** — Raiden's Musou Isshin N4,
  Skirk's Seven-Phase Flash N3/N4, Wriothesley N4 (both forms), Heizou N4 (three
  hits), Hu Tao's Paramita N5, Tartaglia's melee N6, Flins's Manifest Flame
  N1/N4, Baizhu N3, Ningguang N1, the Anemo and Geo Traveler N5. The other 65 are
  physical until something infuses them.
- **Plus 43 of the 233 maps stage 2 gave a `lands`** are multi-hit (charged
  attacks mostly — a sword's is two hits; Kirara's and Skirk's stance charge are
  three). Their `lands` is already the first hit; the rest is unstated.
- ⚠️ **"~116"** appeared in the first write-up of §1.K. It predated the travel pin
  and counted in-flight arrows as extra hits. 82 is the number.
- ⚠️ The dumper runs ONE character at C0 in an empty core: a capture's hit count
  is the uninfused, no-constellation count. A constellation that adds a hit to a
  swing is invisible to it.

## 3. Where to start — the measurement

Before any schema: **count what moves.** Build the per-swing hit list in a probe
(no data change — read it from the dumper at parse time in `scratch/probe/`) and
digest the corpus with it, against `out/k-data.json` (= main after §1.K). The
questions the design depends on:

1. How many digests move, and how many by an application GAINED or LOST rather
   than shifted? §1.K's lesson: every such row is an ICD or proc-cooldown EDGE
   until traced, and ⛔ classify none of them unread.
2. Which `gainStacks … onHit` keys have no `procCooldown` and no `max` that a
   doubled count would blow through? (Lint already requires boundedness; list the
   holders whose steady-state count changes.)
3. Which effects filter on `hitIndex`? It is the COMBO index and must stay one —
   a second hit of N4 is still `hitIndex: 3`.
4. Does the summon-aware digest rotation (`N1 N2 N3`, six swings) reach a
   multi-hit swing at all for most characters? Most multi-hit swings are N3–N5.
   ⚠️ If not, the digest is BLIND to this round and needs an `N5` leg first.

## 4. The design, as currently understood

⚠️ A sketch to be corrected by §3, not a spec.

- **Schema.** `FrameMap.lands` becomes `number | number[]` — the frames the
  swing's hits land, first to last. `landsAt(fm)` keeps returning the FIRST (its
  one caller that wants "when does this swing connect" is unchanged); a new
  `landingsOf(fm): number[]` returns them all, and falls back to `[landsAt(fm)]`.
  ⛔ Not a separate `hitCount`: a count without frames cannot place the second
  application, and the frames imply the count.
  - For the 82 maps that state `hit`, `lands` is authored as the full list and
    `hit` stays what it is — the cancel tier. ⚠️ Lint A.5c's "restates `hit`" rule
    must then mean "a ONE-element `lands` equal to `hit`".
- **Writer.** `migrate-swing-landings.mjs` already isolates a swing's OWN hits
  (the earlier-capture-names rule, §4.2 of the parent) and already reports the
  multi-hit ones under `--verbose`. It stops taking `own[0]` and writes `own`.
  ⚠️ It must start writing maps that state `hit`, which it refuses today — the
  guard becomes "never touch `hit`", not "never touch the map".
  ⚠️ Two hits on ONE frame are real (Albedo's, Kazuha's, Kaeya's charged attack:
  `20, 20`) and are two hits, ⛔ not a duplicate to dedupe.
- **Engine.** `landSwing` schedules one `Band.LAND` task PER landing; each runs
  the same closure (application → co-application → hit record). The ICD clock
  needs nothing: it already counts what it is offered, in time order. Landings at
  or past the swing's end collapse onto the synchronous path together.
  - A swing's hits share its `sourceEventId`, `hitIndex` and element. ⚠️ A
    GRANTED infusion resolves per SWING (Radiance-window round), so a field that
    opens between two hits of one swing does not split it. Accept that.
  - ⚠️ `notifyNormalAttack`'s span is the swing and does not change.
- **What must NOT multiply.** The action event (one per swing — the chart draws
  swings), the input block, and any effect keyed on the CAST or the ACTION rather
  than the hit. Audit every reader of `hitRecords` for "one per swing"
  assumptions — `hitsForTrack` in `buffWindows.ts` is the first.
- **Display.** Nothing new is drawn for a second hit: the aura lane already shows
  an application pill per application, and the block stays one block. ⏭ Nate, if
  the lane gets busy.

## 5. Known traps, carried from §1.K

- A data writer NEVER ends with `format(JSON.stringify(data))` — it reflows the
  hand-formatted corpus (14,190 lines for 233 numbers). Mutate the parsed object
  and hand it to `surgicalRewrite` (`scripts/lib/json-edit.mjs`), or `modify`.
- Ship the writer with a dry-run REPORT and read its multi-name section — the
  own-hit rule was wrong twice and the report is what caught it.
- `lands` is in no gcsim slice: `preserveFrameMap` / `withLands` carry it, and
  both must learn the array form.
- ⚠️ `surgicalRewrite` does not apply a pure key REORDER, and it diffs arrays
  element-wise only at equal length — a `lands` that becomes an array replaces
  the scalar whole, which is what you want.
- The oracle cannot adjudicate an INFUSED string — no fixture spams one. Measure
  with a probe and say so.
