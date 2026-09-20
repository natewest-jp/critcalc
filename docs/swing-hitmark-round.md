# A swing lands at its hitmark — §1.K (2026-09-20)

_Status: **stage 1 (the engine) BUILT** on `feat/swing-hitmark`. Stage 2 (the
landing frame for the maps that state none) is SCOPED in §4 and waits on three
calls from Nate. Source item: `docs/curation/essential-characters-2026-09-15.md`
§1.K._

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

⚠️ **Plunges are wired and inert** — no plunge map states a hitmark. When one
does, the plunge's state OPENER must move with it (a plunge's state opens at the
LANDING — Varesa's `apexDrive` — not at the swing's end). Noted at the site.

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

## 4. Stage 2 — the maps that state no hitmark (SCOPED, not built)

**176 non-plunge maps state none** (95 `chargeFrames`, 36 normals, 45 bow
`chargeHits`), and ⚓ **the reason is structural, not missing research**:

- Our `hit` is gcsim's `InitNormalCancelSlice(hitmark, anim)` tier — it is the
  hitmark AND the fill for E/Q/D/J/swap. gcsim builds charged attacks and most
  catalyst normals with `InitAbilSlice` + explicit cancels and keeps the hitmark
  in a separate constant (`chargeHitmark`), which the frame migration never read.
- ⛔ So the number **cannot go in `hit`**: on Itto's `{anim:130, D:89, J:89,
swap:130}` a `hit: 50` would make his E and Q cancels 50. A new field is
  needed — proposed **`lands`**, read first by `landsAt` (`fm.lands ?? fm.hit`),
  lint: redundant when equal to `hit`, never past `anim`.
- **The oracle already has them**: the dumper's isolated-core damage events give
  one hit for 99, several for 45, none for 3 (Barbara's and Yae's CA, Lauma's
  deer — the last is CORRECT, it is `nonHitting`), and 29 are uncovered (bow
  `chargeHits[0]` partial draws, Iansan/Nefer/Illuga/Kachina, stance-gated
  forms). The headline cases: **Mualani's Sharky's Bite lands at 7f** (cancels
  39–215), her CA at 84; **Varesa's CA at 69f** (cancels 139+).

Open calls (⏭ Nate):

1. **The field** — `lands` beside `hit`, as above?
2. **A multi-hit swing: first or last hit?** One swing is one hit here. `hit` is
   gcsim's LAST hitmark (146 of 150 melee multi-hit maps). The FIRST is what
   applies the element and fires an `onHit`, so `lands` would be the first —
   and then 116 normals that already state `hit` are 8–23f late by the same
   argument. Recommended: first hit for the new field; leave the 116 for a
   follow-up with its own measurement.
3. **Projectile travel.** For bows and most catalysts `hit` is the RELEASE;
   gcsim's damage lands `+10f` (87 bow maps, 10 catalyst), and that 10 is gcsim's
   `travel` PARAMETER default, not a measurement — in game it is distance.
   Cast `application[]` frames already include it (they are authored from the
   damage stream). Recommended: a blanket `+10` for a bow's swings is NOT
   authored (⛔ mass-annotating a default); catalyst landings take gcsim's frame
   since there is no other number.

⚠️ The gcsim checkout is **98 commits behind** `origin/main`; the oracle audits
whatever is checked out. Fast-forward before authoring from it.

⚠️ Observed, not changed: on the synchronous path the charged and plunge sites
run `humanPad` BEFORE the landing, so with Human timing on, a hitmark-less CA
lands after its pad. A map that states its landing is immune.
