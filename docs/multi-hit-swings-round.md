# Every hit a swing lands — the multi-hit round (PLAN, 2026-09-20)

_↻ Status: **SHIPPED 2026-09-21 — §7 is the record and wins over §1–§6**, which
are the plan as it stood. Originally: PLANNED, not started. ⚓ Nate's decision (2026-09-20): the FULL
implementation — "we need to account for all hits, and infusions do matter."
The small option (author `lands` = first hit on the maps that state only `hit`)
was considered and declined: it is a subset of this. Start in a fresh context,
at §3's MEASUREMENT. Parent: `docs/swing-hitmark-round.md` (§1.K)._

_↻ **2026-09-20, later the same day: the CAST side has the same defect and a worse
one — read §6 before starting.** ⚓ Nate: "very important"; both are the next
session's work._

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

## 6. The cast side — found 2026-09-20, and it changes where this round starts

_↻ **2026-09-21: §6.4's order is CONFIRMED (⚓ Nate) and Phase A SHIPPED** —
`docs/cast-hit-record-round.md` is its record. What is left of this section is
Phase B. ⚠️ One correction to §6.3 below: `application[]` CAN hold an entry that
applies nothing (an element-less entry), but it means PHYSICAL — see that record's
§5._

Found while measuring Faruzan's C6 proc (`docs/summon-tick-gaps-round.md` §8 is
the discovery record). §1.K synced a SWING's application and hit record into one
closure at `landsAt`. **A cast was never synced**: `run.ts`'s cast branch
dispatches the hit record with `time: castStart`, synchronously, just before
`clock.advance(castEnd)`, while the same cast's `application[]` is scheduled at
`castStart + frame`. One cast's damage is in two places — the gauge sees it at the
hitmark, every `onHit` consumer sees it at the button press.

So a cast is wrong TWICE where a swing is wrong once: its one hit record is at the
wrong instant (§1.K's defect, unfixed), AND it is one record for N landings (this
round's defect).

**gcsim is right, and so is our own data** — `application[]` IS gcsim's damage
stream, and contract C4 says it is the NOMINAL schedule (a hit its ICD suppressed
is still listed). That is exactly what a hit stream wants: ⚓ **for a cast the
per-landing list this round has to AUTHOR for swings already exists.**

### 6.1 Measured (2026-09-20, corpus census over every skill/burst + variant)

- **266 hitting casts state a measured landing; all 266 are offset** (none lands
  on frame 0). Median **35f**, p25 21f, p75 71f, p90 106f. The tail is delayed
  detonations: Amber's Bunny 530f, Jahoda 368f, Mona 344f / 329f, Heizou 200f,
  Klee 186f, Mualani 178f, Kinich 161f, Ayato 139f, Sigewinne 130f.
- **88 are multi-hit and ONE hit record**; 45 of those span more than 60f.
- **16 state no `application[]`** (unmeasured) and **3 hit at Durability 0**
  (`application: []`, hitting — Emilie's E is the known one). Neither has a frame
  to move to. 39 are `nonHitting` and already dispatch nothing.
- Listeners that can hear a cast's hit (an `onHit` with no `abilityType`, or one
  naming skill/burst): damage procs 6 characters · buff 12 · resShred 17 ·
  damage 5 · heal 4 · energy 3 · gainStacks 2 · consumeStacks 2 ·
  cooldownReduce 1 — plus the artifact `onHit` sets and weapon procs, uncounted.

### 6.2 What it does on screen

- ⚠️ **ORDER INVERSION, not just an offset.** A damage proc fired by a cast's hit
  lands its own application BEFORE the cast's. Measured on `Bennett E > Fischl E >
Faruzan Q > Xiao …` at C6: the Collapse lands at cast + 33f, the burst's hit at
  cast + 54f; gcsim has 54 then 87. Raiden's Eye, Beidou's Stormbreaker, Albedo's
  Blossom and Dehya's Sanctum do the same off any teammate's cast — and an
  inverted pair can be a different REACTION.
- An `onHit skill|burst` buff / shred window opens at the press, not the hit —
  right length, shifted early by the offset above.
- Stack grants, `cooldownReduce` and the hit-triggered artifact sets fire early.

### 6.3 The shape of the fix, and what §1.K did not face

The hit record joins the application in one `Band.LAND` closure at the landing,
queued before the advance — the cast pipeline already schedules before it
advances (the 2026-08-17 feed-order fix), so the seam exists. New ground:

- **The stack snapshot.** The record carries the cast's PRE-consume `stacks`,
  taken at the cast. A record that lands later must still carry the cast's
  snapshot, ⛔ not re-read the pool at the landing (§1.K's "a context is a moment").
- **Four finalize-side sites anchor `onHit skill|burst` on the CAST EVENT**
  (`castLandsNoHit`'s four callers in `buffWindows.ts`, non-hitting casts round). They must anchor on the
  landing — which means the landing has to be recoverable at finalize, so publish
  it on the `CastEvent` rather than re-deriving it from `application[]`.
- **No frame to move to** (16 unmeasured + 3 Durability-0): keep the synchronous
  path verbatim, as §1.K does for a map that states no landing. ⛔ No provisional
  mark (⚓ Nate's §1.K ruling carries). ⏭ The 3 Durability-0 casts want a hitmark
  with nowhere to live — `application[]` cannot hold an entry that applies
  nothing. Name it, don't solve it here.
- ⚠️ **`application[]` sometimes carries SUMMON damage** (Charlotte, Qiqi — the
  Furina round's ruling that this is sometimes correct). Under "every entry is a
  hit" those become cast-tagged hits. Probably right (it is damage, tagged
  skill/burst) — but CHECK those two before the corpus run, not after.
- ⚠️ A cast's entries can differ in ELEMENT (Varka's refs, absorbers later) and
  carry `noICD`; a swing's hits share one element. The hit record's `element`
  must come from its own entry, ⛔ not from `char.element` as the cast site does
  today.

### 6.4 Recommended order (⏭ Nate to confirm)

1. **§3's measurement, widened to casts** — same probe, same questions, plus:
   which `onHit skill|burst` stack grants have no `procCooldown` and would
   multiply under per-landing records.
2. **Phase A — a cast's hit record lands at its FIRST landing.** §1.K's twin:
   small, no schema, no data, and it removes the order inversions across 266
   casts on its own. Measure, merge.
3. **Phase B — every landing is a hit, swings AND casts in one pass.** The
   "what must NOT multiply" audit in §4 is ONE audit over `hitRecords`' readers
   whichever side feeds them; doing it twice is how the two sides would drift.
   Swings need the `lands` array authored; casts need nothing authored.

⛔ Still one at a time against `docs/projectile-travel-round.md`, which rewrites
`landSwing` too.

## 7. What shipped (2026-09-21) — every landing is a hit, swings AND casts

Phase A is `docs/cast-hit-record-round.md`. This is Phase B, on
`feat/every-landing-is-a-hit`.

### 7.1 The model

- **`FrameMap.lands` is `number | number[]`.** The list is the frames a swing's
  hits land, first to last. `landsAt()` still answers "when does this swing
  connect" (the first); 🆕 `landingsOf()` returns them all. A map that states `hit`
  states the list BESIDE it — `hit` stays the cancel tier, untouched. Lint A.5c:
  a list is two or more positive integers, non-decreasing (equal neighbours are
  two hits), checked against `anim` at its LAST frame; "restates `hit`" is a claim
  about the scalar only.
- **`landSwing` schedules one `Band.LAND` task per landing**, each running the same
  closure (application → co-application → hit record). Landings at or past the
  swing's end are returned as a COUNT and landed by the caller synchronously,
  together; an unmeasured map is one such landing (the old `false`).
- **A cast dispatches one record per nominal `application[]` entry** — each its
  own instant and its own element, all carrying the cast's stack snapshot, each
  asking `liveSegment` for itself. 🆕 `CastEvent.hitsAt` beside `firstHitAt`.
  Finalize's `partitionCastPool` opens an `onHit` part at the first landing and
  REFRESHES it to the last (`extend`); a landing the part's `procCooldown` refuses
  does not refresh, and a gap longer than the duration opens a second window.
- **What does not multiply:** the action event, the input block, the wave's span,
  `hitIndex` (the COMBO index), the swing's resolved element.

### 7.2 The data — 113 lists across 70 files

102 two-hit, 9 three-hit, 2 four-hit; 85 normals + 29 charged attacks (one write
was a scalar). `scripts/migrate-swing-landings.mjs` writes them; it still never
touches `hit`.

⚓⚓ **The own-hit rule needed a THIRD clause, and the dry-run report caught it
again.** The first-hit rule never had to ask which of a capture's own hits ARE
the swing — a proc the swing fires lands after it. A list does: Alhaitham's Mirror
projection, Clorinde's Surging Blade, Furina's Spiritbreath Thorn, Ayato's Kyouka
and the Traveler's A1 / A4 strikes all ride a swing's capture under their own
names, and several are authored as effects already. **A swing's hits share a NAME
STEM** (digits stripped: `Charge 0` / `Charge 1`), or one stem extends the other
(`Charge Attack` / `Charge Attack (Finisher)`); with two stems left, the one
naming the combo index as a whole word (`Normal 4`, ⛔ not `(A4)`), else the most
hits, else the first AND REPORTED. The shipped run reports zero ambiguous.
Measured: the naive list moved 8 digests the stem rule does not (Alhaitham, Ayato,
Traveler Geo).

⛔ Not written: a `coInfusion` ability (the two dumped hits ARE the two hands — no
holder reached it, Varka's stance is an oracle artefact) · a hit past `anim`
(dropped from the list and reported — Ganyu's Frostflake Bloom, two of Lan Yan's
three charged hits; that is the projectile-travel round's ground) · a hit at
frame 0 (Flins's 0-damage Arcane Light).

### 7.3 Measured

Probe: Phase A's three rotations plus R4 (`N5 C N5 C P`, so a multi-hit N3–N5 is
reached at all — §3's question 4: R1's `N1 N2 N3` reaches few) and R5 (the same
strings under C6 Bennett's infusion). 1504 digests.

- **Casts, against Phase A: 216 of 1002 moved.** No character's own applications
  move (the list was always fed to the gauge). Procs get MORE OFFERS — a long
  multi-hit burst keeps Raiden's Eye and Albedo's Blossom firing on their own
  cooldowns (Ganyu's E + Q in R2: +3 Eye strikes, +4 Blossoms) — and a hit-triggered
  window runs from the first landing to the last + its duration (Deepwood on
  Sara's burst: 51 → 100 + 8s). §6.1's stack question closed by census: every
  cast heard by an un-cooled stack grant has ONE landing.
- **Swings: 223 of 1504 moved**, and R5 is the round's reason: **56 of 250
  infused digests gain applications (28 characters), +1 to +5 over three strings**
  — Kazuha 7 → 10, because his N3 (two hits), N5 (three) and charged attack (two)
  now spend the every-third-hit budget they always spent in game. Uninfused, it
  is the 17 elemental multi-hit normals (Heizou R4 10 → 13, Ningguang +6).
- Cyno C6's per-hit stack buff draws a window per HIT now (15 → 18 in R4); the
  row's refresh-merge is what a reader sees.
- **Oracle, against Phase A:** gcsim-applies-we-do-not **50 → 46**,
  over-application unchanged at 1, aura drift 66 → 65. ⚠️ No fixture spams an
  INFUSED string, so the oracle cannot adjudicate the headline; the probe did.

Gates: vitest 1954 · check · lint · build green; e2e in the merge commit.

### 7.4 What the probe cannot see, and what is open

- Un-cooled swing listeners whose count now follows hits — Varka's Secret Rite
  (`procCap` 15 bounds it; his stance swings are `coInfusion` and unlisted anyway),
  Yanfei's seals (her normals are single-hit), the heal-on-hit set (undrawn).
  Alyosha's N4 gain + consume-all on `hitIndex: 3`: check his N4's hit count when
  gcsim covers him.
- A swing's later hits can land AFTER a cancel cut the swing: they collapse onto
  the swing's end, as the first always did.
- ⏭ The dumper runs C0 in an empty core — a constellation that adds a hit to a
  swing is invisible (§2's caveat stands).
- ⏭ Nate, on screen: the aura lane's pips on an infused string (more of them, per
  §4's "if the lane gets busy").
