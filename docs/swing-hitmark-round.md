# A swing lands at its hitmark — §1.K (2026-09-20)

_Status: **both stages BUILT** on `feat/swing-hitmark` — stage 1 the engine
(`1d9d2652`), stage 2 the landing frame for the maps that state no hitmark (§4).
Source item: `docs/curation/essential-characters-2026-09-15.md` §1.K. §5 is what
is still open._

## 1. The defect

A swing's elemental application, its second hand's (Varka), its hit record, and
so every `onHit` stack, proc, cooldown reduction and buff window, all sat at the
swing's **cancel-resolved end** — the instant the NEXT input starts. That has
nothing to do with when the blade connects. Harmless on a jab; on a heavy
finisher it is over a second (Razor's N4 lands at 38f and ends at 116f).
Measured over the corpus: **563** normal-style maps state a hitmark, and in
**84** of them the earliest cancel is ≥ 30f after it.

## 2. What shipped (stage 1)

- **`landsAt(fm)`** in `$lib/utils/frames.ts` — the ONE place that says when a
  swing lands. `fm.hit`, or `null` for "unmeasured".
- **`landSwing`** in `sim/run.ts` — each of the three swing sites (N, C, P) hands
  its landing over as ONE closure (application → co-application → hit record, in
  that order; ⚓ Nate: everything stays synced). Where the landing frame is known
  and EARLIER than the swing's end it becomes a `Band.LAND` task ⚠️⚠️ queued
  BEFORE the advance, so the advance fires it in order with the summon ticks
  inside the swing. Feed order = time order still holds corpus-wide
  (`notationParser.ir.test.ts`, untouched and green).
- **The fallback is the old path, verbatim**: no landing frame, a landing at or
  past the end (a swing cancelled before it connects lands at the cancel — the
  change only ever moves a hit EARLIER), or no cast time → the closure runs
  synchronously after the advance, after the state opener that shares its
  instant. ⛔ Not routed through the queue: a task at the swing's end would fire
  AHEAD of that opener.
- **`resolveChargeFrameMap`** in `sim/resolve.ts` — one owner for "which map does
  this charged token read", so the cast time and the landing come off the same
  map (`sC`, a bow's `C1`/`C`/`A`, the generic profile).
- A charged landing reads its states AT the landing; the normal and plunge
  landings keep their token-start snapshot, as before.

↻ Plunges were wired and inert at stage 1 (no plunge map stated a hitmark);
stage 2 gave 91 of them a landing frame and moved the state opener — §4.3.

## 3. Measured

Summon-aware digest (`scratch/probe/sumdigest.test.ts`, 126 characters × C0/1/2/4/6,
baseline `out/k-base.json` = main `0b1696c1`, byte-identical to `si-sum`):

- **245 of 630 digests moved.** 769 applications moved earlier, max **53f**;
  ⛔ zero bar, total-duration or window-SET changes — no action's timing moved,
  only what lands inside it.
- **8 characters gain or lose an application outright**, each a genuine
  consequence, read individually: Albedo (Transient Blossom is an `onHit` proc
  on a 2s cooldown — it finds its trigger sooner and fits a fifth blossom);
  Itto, Candace (on Kaeya's infused swings), Raiden, Beidou, Wriothesley,
  Xianyun, Lauma — ICD outcomes, because per-swing hit-to-end offsets differ so
  the spacing BETWEEN landings changed, not just their phase. Traced on
  Wriothesley: his first landing moved 152 → 150 while the sixth swing, cancelled
  by the swap AT its hitmark, stayed at 301 — the gap crossed the 2.5s timer
  (149f → 151f) and the counter reset, so that swing applies.
- ⚠️ **What the digest cannot see**: hit records are parser-private (visible only
  through the buff windows they anchor), Human timing is off, and the rotation
  has no `P` and one `C`. 95 of 98 charged maps state no hitmark, so the charged
  site is exercised by three characters.
- Five tests pinned the old instant and were re-derived, none a regression:
  two ICD tests now take their expectation from the DATA (`swingLandings`), the
  `DecayStub` lifetime fixture 0.4 → 0.6s, and Barbara's N1 moves one Fischl A4
  proc 2.58 → 2.43. New guard: both arms of the rule in one test; seeded
  negative (force `landSwing` false) fails three.

## 4. Stage 2 — the maps that state no hitmark

### 4.1 Why they state none

**267 normal-style maps stated no `hit`**: 95 `chargeFrames`, 36 normals, 45 bow
`chargeHits`, and every one of the 96 plunge maps. ⚓ **The reason is structural,
not missing research** — and ⚓ Nate's offer to check KQM's sheet turned out not
to be needed, because the oracle already had them:

- Our `hit` is gcsim's `InitNormalCancelSlice(hitmark, anim)` tier — the hitmark
  AND the fill for E/Q/D/J/swap. gcsim builds every charged attack, every plunge
  and most catalyst normals with `InitAbilSlice` + explicit cancels and keeps
  the hitmark in a separate constant (`chargeHitmark`) the frame migration never
  read.
- ⛔ So the number **cannot go in `hit`**: Itto's charged map states `anim: 130`
  and only `D`/`J`/`swap`, so a `hit: 50` there would make his E and Q cancels 50.

### 4.2 `FrameMap.lands`

⚓ Nate's three calls (2026-09-20): a new field beside `hit` · the **FIRST** hit
of a multi-hit swing · ⛔ no hardcoded projectile travel.

- **`lands`** — the frame the swing's first hit lands. `landsAt` reads
  `fm.lands ?? fm.hit`. Lint **A.5c**: never past `anim`, never restating `hit`
  (absent must keep meaning "`hit` says it"), never beside a `nonHitting` claim
  for that class, never on a skill/burst map (a cast states `application[]`).
- **`scripts/migrate-swing-landings.mjs`** authors it from the dumper's damage
  stream: **233 landings across 108 files** (85 charged, 32 normals, 25 bow
  charged shots, 47 high + 44 low plunges). Idempotent. ⛔ Never writes a map that
  states `hit`.
- ⚓ **Which hits are the swing's OWN** took three cuts, and the dry run caught
  the first two before a byte was written: "the hits sharing the LAST hit's
  name" (a multi-hit charged attack is `Charge 0`, `Charge 1`, and a capture's
  last hit is as often a PROC — Alhaitham's mirror, Hu Tao's Blood Blossom) and
  "the hits named for this combo index" (gcsim writes `Sharky's Bite (0
momentum)`, `Normal 1 (Windfavored)`). The rule that holds: only an N(k)
  capture has anything in flight, so a hit is an artefact exactly when its name
  already appeared in an EARLIER swing's capture of the same form.
- ⚠️⚠️ **The edit is SURGICAL** (`jsonc-parser` `modify`). The first cut copied the
  older writers' `format(JSON.stringify(data))` and produced a **14,190-line**
  diff to author 233 numbers; the corpus is hand-formatted and that reflows every
  object prettier can fit on a line. ⛔ The two older writers still do it.
- ⚠️ `lands` is in no gcsim SLICE, so a writer that rebuilds a map from one would
  erase it: `preserveFrameMap` carries it and `migrate-frames-shape` goes through
  `withLands`.
- **Not written, each reported by the writer**: 34 uncovered (bow partial draws,
  Iansan's/Varesa's/Varka's stance forms, Illuga, Kachina, Nefer, Linnea, Kazuha's
  two plunge variants, Venti's/Wanderer's/Xiao's-mask plunges) · 2 where gcsim
  lands NO damage (Barbara's and Yae's charged attacks — ⏭ worth a look) · 4
  refused as not a swing's hit (Neuvillette's Equitable Judgment at 232f past an
  87f `anim`; Chasca's N2–N4 at frame 0).

The headline cases: **Mualani's Sharky's Bite lands at 7f** (it sat at its
39–215f cancel), her charged attack at 84; **Varesa's charged attack at 69f**
(139+); Hu Tao's Paramita charge at **3f**, which looked wrong and is gcsim's own
`ppChargeHitmark = 3`.

### 4.3 The plunge opener moves with the landing

A plunge's `actionOpensState` lives INSIDE the landing closure now: opener →
offers → hit record at one instant, so the hit always finds the state its own
plunge opened. With no landing frame all three fall back to the swing's end
together. One holder (Varesa's `apexDrive`): it opens at 38f instead of 40f.
⚠️ gcsim adds that status at the plunge's **START** for the same 140f
(`getApexDrive`, no delay), so our window still ends late by the length of the
fall — by less than before. Not changed: it is her authored anchor, not §1.K's.

### 4.4 Projectile travel

⚓ The ruling was already in the dumper for aimed shots — gcsim's `travel`
default (10f) is "a SIMULATION POLICY, not game data" — but the pin had never
been extended to normals and charged attacks, which is the whole reason bow
normals read `hit + 10`. It is now (`travel: 0` on every swing capture and on
the combo prefix). **Measured after the pin: all 94 bow normals and 73 catalyst
normals land at Δ0 from `hit`**, so `hit` was right all along.

↻ **Corrected the same day, by an A/B of the dumper — "uniformly travel-free"
was too strong.** gcsim exposes `travel` as a parameter on 20 of 21 bows (10f)
and only **9 of 28 catalysts** (Citlali, Klee, Ningguang, Kokomi, Xianyun, Yae,
Yanfei, Mizuki at 10f; Wanderer 5f). The other catalysts' flight is folded into
gcsim's hitmark constant and cannot be separated, so their `hit`/`lands` already
include it. ⚠️⚠️ **And the CAST side carries travel throughout**: E/Q captures
are unpinned, and pinning them moves 39 captures across 13 characters — not by
a flat 10 but by gcsim's per-ability estimate (Itto E 4 · Aloy, Tighnari,
Emilie, Escoffier 5 · Cryo Traveler 9/6 · Diona, Dori, Ororon 10 · Layla Q 22 ·
Mizuki E 30 · **Mualani Q 70**, a homing missile whose flight is real). So today
a ranged CAST lands with travel and a bow SWING without — the inconsistency is
the argument for modelling it on swings, ⛔ not for stripping it from casts.

Whether to model travel at all (⏭ Nate, recommendation): **not in data, and not
by default.** It is distance, so any number is a claim about where the player
stands; 10f rarely reorders anything; and the data being uniformly travel-free
makes it a ONE-SITE change later (`landSwing`). If it is wanted, the precedent
is Human timing — a player-dependent assumption held in `siteSettings`, ⛔ never
in a character JSON and ⛔ never in `?r=` — and it needs one new fact the corpus
lacks: which CATALYST normals are projectiles (Heizou and Wriothesley punch).
⚠️ The inconsistency this leaves: a ranged skill's `application[]` was authored
from captures that do NOT pin travel, so those frames may still carry gcsim's
10f. Unmeasured — a follow-up with its own census.

### 4.5 Measured

Against stage 1 (`out/k-eng.json`): **207 of 630 digests moved**, zero bar or
total-duration changes. Set changes, each read: Flins' Thundercloud gadget is
spawned by a Lunar-Charged reaction that moved 15f earlier · Raiden's charged
attack lands at 1273 instead of 1305, inside the Eye's 0.9s cooldown from its
1245 tick, so that coordinated attack no longer fires · Lan Yan and Klee are the
2.5s ICD timer's edge. ⚠️ The digest rotation has no `P`, so 91 plunge landings
are measured only by the Varesa test and the roster gate.

Gates: vitest 1943 · check · lint · build. Two tests re-derived (Varesa's window
start, from the data; the guard's "states no landing" arm now uses a Klee copy
with the field removed). Lint A.5c has five seeded tests on Keqing.

⚠️ The pin costs the audit's ICD-cadence join three hits (3032 of 3035): Chasca's
N2–N4, whose in-flight shots now resolve on the cast frame. The same three the
writer refuses; no authored data reads them.

## 5. Still open

↻ Closed the same day (2026-09-20, `curation/swing-followups`): **Varesa's
`apexDrive`** opens at the plunge's START now (`d66a2f79`, ⚓ Nate — gcsim's
(start, 140f) is one measurement) · **Iansan** re-read from the merged source
(`ecab3e65`) · the **Cryo Traveler** got Stage 4 and left `FRAMELESS_EXEMPT`
(`09bd75ab`); the Star's "8 crystals" audit row is our 4 two-crystal volleys and
stays.

- ⏭ **Every hit a swing lands** — PLANNED, `docs/multi-hit-swings-round.md`
  (⚓ Nate: the full implementation). 82 normals + 43 `lands` maps.
- ⏭ **Projectile travel on swings** — PLANNED, `docs/projectile-travel-round.md`
  (⚓ Nate: a constant, not a setting; a `projectile` flag on nine catalysts).
  ⚠️ Both rounds rewrite `landSwing` — one at a time.
- ⏭ **The 34 uncovered maps** — where KQM's frame sheet could actually help.
- ⏭ **Barbara's and Yae's charged attacks** land no damage in gcsim's capture.
- ⚠️ `migrate-frames-shape`'s PRESERVE path adds an explicit `swap: <anim>` to a
  map that states `hit`, moving its swap cancel from the hitmark to the full
  animation (found on Iansan, not fixed); and it and `migrate-application-schema`
  still reflow the whole file. Take their VALUES, apply them surgically.
- ⚠️ Observed, not changed: on the synchronous path the charged and plunge sites
  run `humanPad` BEFORE the landing, so with Human timing on, a swing that states
  no landing lands after its pad.
