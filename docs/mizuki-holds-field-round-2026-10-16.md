# Mizuki holds the field — and a swap ends the pill (2026-10-16)

Branch `feat/mizuki-dreamdrifter`. Asked by Nate: Yumemizuki Mizuki is top meta, and
the planner could not draw her.

## 1. The problem

Dreamdrifter attacks on its own and takes no Normal Attack (gcsim `ActionReady`
refuses everything but swap, dash, burst and the cancelling E). So a rotation has
nothing to write between `E` and the swap, and the swap cut a 5–10s stance at 30f.
Players wrote `Mizuki E ~9.5s` as a workaround.

Reading the sim turned up two more defects:

- **Her cloud landed through a swap.** All eight `application[]` entries were
  scheduled at the cast, so `Mizuki E > Xingqiu E` still landed clouds at 123–393f
  after she had left.
- **An extended stance went silent.** The list stopped at 318f, so the last five
  seconds of an A1-extended 10s Dreamdrifter attacked nothing. The extensions are
  themselves fed by those clouds.

## 2. The shape (⚓ Nate approved the design and both early-end forms)

- **`holdsField`** (skill stance, beside `terminatesOnSwap`, lint D.48). The swap
  that ends her turn waits for the stance's LIVE end. It is a loop, because A1's
  Swirls land during the wait and push the end further.
- **Ending it early:**
  - **A trailing `~Xs`** means "swap here". Only the last token counts, so
    `E ~1s Q` still holds. ⚠️ Like every wait, it counts from the E's 30f swap
    cancel, so `E ~2s` keeps Dreamdrifter up for about 2.5s from the press.
  - **E again.** `End Dreamdrifter` is a sibling skill on `E`, gated on `inStance`,
    with `endsStance {at: 0}`, gcsim's cancel frames, no cooldown and no hits (the
    Odette Coda / Zibai shape). `E Q E` now ends the stance at the second press.
- **`ElementalApplication.whileStance { travel }`** (lint D.48). The cloud is
  authored to the stance's longest life: 13 launches at 48 + 45k, up to 588f. An
  entry lands only if its stance was up at LAUNCH. gcsim re-queues `cloudTask` on a
  live-status check and lands each cloud 30f later. The frames audit's §4c replays
  the gate at the base 5s, which is all its empty-core capture can see.
- **Her seven stance-length buffs** are 10s + `whileState: inStance`: both Swirl
  bonuses, the A4 team EM and C2 ×4.
- **The ICD needed nothing.** `icdGate {timer: 72}` already gave gcsim's
  48/138/228/318; the curator note claiming otherwise was stale.
- **Help/guides** will tell players about `~Xs` and E (⚓ Nate). ⛔ It is not a
  caveat: nothing on screen is wrong.

## 3. A swap ends the pill — for every stance (⚓ Nate, "go general")

Before, a swap ended the stance's gating window but left its E/Q pill at full
width. At `Mizuki E ~2s` the pill claimed 10s. The history shows nobody chose
this:

- The pre-P4 swap path simply detached the bar, and P4 preserved that
  byte-for-byte (`75a42baa`).
- On 2026-08-15 it was parked as "its own round, wants Nate's eyes" (rubric P16,
  `docs/stance-cooldown-round.md`).

**The audit.** For each of the 31 `terminatesOnSwap` stances: gcsim's swap handler
or exit path, plus the kit text.

- **29 TERMINAL.** The swap ends the state for good, and only a recast gets back
  in. Chasca, Wanderer, Jahoda and Lan Yan cannot even be swapped mid-stance, so
  the question never arises for them.
- **Mavuika's two:** the swap ends her bike (Hold E) and the Crucible (Q), so cutting
  those pills is right too. What outlives the swap is her **Nightsoul's Blessing**
  (gcsim `mavuika.go` `onExitField`: `exitBike()` only, and the drain keeps
  running). That is follow-up F1.
- **Post-stance effects already agreed.** `afterDuration` anchors on the clamped
  window end (`buffWindows.ts` `afterDurationStart`), so Raiden C4, Itto C4 and
  Hu Tao A1 already fire at the swap.

**The change.** `clampStance` now clamps `ownerUptime` with `end`. It is the one
stance off-edge, shared by the swap and `endsStance`. The IR stance-geometry
invariant (pill end === window end) is now strict for cross-character rotations
too, and the corpus passed it unchanged.

## 4. Follow-ups (recorded, not done)

- **F1 — Mavuika's Blessing ends at the swap here; in game it does not.** Both
  stances carry `opensState: nightsoulBlessing` + `terminatesOnSwap`, so the swap
  closes the Blessing companion. In game the Blessing keeps draining off-field at
  the Ring's rate (0.5 per 0.1s, against 0.9 on the bike), the Ring keeps attacking,
  and a Tap after swapping back re-mounts the bike on a 1s recast CD. A fix needs
  the Blessing's off-field length, i.e. a drain model, which is not built.
  ⚓ Nate 2026-10-16: **simulate her Nightsoul points and Fighting Spirit for real**
  (option A — she is one of the most important characters meta-wise), ⛔ not the
  stopgap of letting the Blessing run its authored length.
- ✅ **F2 — DONE same day (`fix/stance-exits`)**, with §5. Chasca's cooldown starts at the cast; gcsim starts it at Nightsoul exit
  (`chasca/skill.go:105`, `SetCD` inside `exitNightsoul()`).
  `cooldownStartsAtStanceEnd` is the existing field for it, and her curator note
  ("modelled via duration + cooldown") predates that field.
- **F3 — Tartaglia's cooldown is a flat 6s; in game it depends on time in melee**
  (7s up to 45s, ×0.8 at C1, reset if Q was used in melee; gcsim
  `onExitMeleeStance`). It is already documented as a gap in his notes. A cut
  stance now makes the error visible sooner.
- **F4 — Dehya's Fiery Sanctum returns after Leonine Bite ends**, a swap included
  (gcsim `dehya.go:81-83`). We do not model the return.
- **F5 — the exit press is uncovered by the frames audit** ("no gcsim analogue").
  Its frames are the base skill's slice, which gcsim also returns for the cancel.
  A `drivers.json` row for the in-state press would cover it.

## 5. Stance exits (2026-10-16, `fix/stance-exits`)

The first follow-up branch found two more Mizuki-shaped defects while doing F2.

- **Tartaglia's E recast did not leave Melee Stance.** He already had an
  `Exit Melee` sibling, but it carried no `endsStance`. So the stance ran its
  full 30s, and every Normal after the recast stayed a Hydro melee swing. It now
  has `endsStance {at: 0}` (gcsim's `onExitMeleeStance` runs inside the press).
  His cooldown is still F3.
- **Chasca (F2 and more):**
  - `cooldownStartsAtStanceEnd` on her skill.
  - A new sibling, `End Nightsoul`, on `E`, with gcsim's `skillCancelFrames` and
    `endsStance {at: 0}`.
  - `holdsField`: she is airborne in Nightsoul and cannot be swapped out (gcsim's
    E→Swap is 586 + 37f, "wait for nightsoul to run out"). Our `swap: 37` let
    `Chasca E … > Bennett` cut her at 37f. A trailing `~Xs` and an E exit cost the
    same 37f to the swap.

Found and recorded, not done:

- **F6 — Chasca's `C` in Nightsoul takes no time.** Her Multitarget Fire has no
  charge frames, and its hold form, the core of her damage, is unmodelled. Her
  curator notes record it as an accepted gap (A7: team-element-resolved bullets).
  For a meta character it deserves its own round.
- **F7 — Wanderer and Jahoda may want `holdsField` too.** gcsim refuses
  Wanderer's swap during Windfavored (`SwapCD = MaxInt16`; he is airborne), and
  Jahoda's frames block everything but E during Shadow Pursuit. ⚠️ Not applied:
  Wanderer's Windfavored also ends when Kuugoryoku runs out, which our fixed 10s
  does not model, so holding to 10s could overshoot. Check against the game first.
