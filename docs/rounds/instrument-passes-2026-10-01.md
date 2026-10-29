# Instrument passes — Reaction Curves + Damage Anatomy (2026-10-01)

**Status:** ✅ both MERGED and PUSHED — Reaction Curves `40666156`, Damage Anatomy
`942dfc61` (e2e 78 + 78 at `7ab16870`). On `main` after them: `425842a0` (shared
`RB_MAX` = 250) and `85c6b01c` (Ifa's A1 bucket fix). `origin/main` = `85c6b01c`.

## 0. The working shape this round established (⚓ Nate)

The text round stopped being worksheet review and became **hands-on passes, one
surface at a time**: Claude reworks a surface — mechanics, layout AND copy together —
Nate reviews it live in the preview and asks for changes, and every ruling that
generalizes goes into `docs/text/style-guide.md` **the same day**. A pass found two
factual errors and two layout problems a worksheet row could never have shown, which is
the argument for the shape. The worksheets retire as review documents and become
Claude's translation ledger (`docs/text/ledger-plan.md`).

⚓ **Each pass is mechanics + layout + copy, checked against gcsim and `docs/library/`.**
The copy-only framing is what let "crit does nothing" survive.

Style-guide rulings born here: **§1.8** a reading of the reader's own settings says
"would" · **§1.9** say only what the screen doesn't (cut a clause the chart, row or table
already shows).

## 1. Reaction Curves

- **All families** is the DEFAULT view: the five EM-bonus curves on one chart as **+%**
  (absolute damage can't be compared across families; "what EM adds" can).
- **Lunar & Stellar** family — gcsim `CalcSpecialReactionDmg`, `6·EM/(2000+EM)`, plotted as
  the **top contributor's 60% share** (⚓ Nate): LC ×1.8 · LCrys ×0.96 · Stellar Swirl
  ×0.45 · Vortex blast ×1.2 / ×1.8. ⚠️ Stellar Swirl numbers are gcsim-only →
  `docs/library/game/stellar-reactions.md` § "Stellar Swirl damage" (NEEDS-CONFIRM, and
  it logs a possible gcsim Vortex gadget-type bug).
- **Reaction Bonus** slider (adds inside the EM bracket) with an EM-equivalent: at 600 EM
  +40% ≈ 87 EM Transformative vs 517 EM Amplifying. Ceiling `RB_MAX` = 250, shared.
- **Levels 1–90, 95, 100 only** (Masterless Stellar Fortuna). 91–100 values from gcsim
  (its 1–90 match the wiki). ⚠️ `snapLevel` is POSITION-based (nearest stop) and the arrow
  keys use `stepLevel` — a direction-based snap made a drag flicker.
- Layout: families are **tabs** on the chart; the readout is a full-width **table** (column
  heads explain) with the hovered row read in plain sentences ("4.7 times their base
  damage"); Build is one box, EM + RB on a line, **Level always on its own line**.
- Readings are stacked in one grid cell (only the chosen visible) so hovering never moves
  the Build box. ⛔ a fixed min-height left a blank line on wide tiles.

## 2. Damage Anatomy

- **The chart is a waterfall on a log₂ axis** (gridlines double) — one row per multiplier
  in **formula order** (⚓ fixed, never sorted), formula column in words, each bar starting
  where the last ended, cuts running backward. It replaced a box equation whose box widths
  were set by their TEXT (min-content beat the weight) and which drew a ×0.49 cut like a
  gain. Damage families run from the level base; Additive's chunk is a subtotal row.
- **Colour: the house rule** (⚓ Nate, the 2026-08-11 bar rework) — stat brackets wear the
  planner's `--glass-bar`, the reaction row its trigger element, sums/result ink. ⛔ A
  validator-passing categorical palette was built and RETIRED ("doesn't read as our
  colours").
- **Direction: faint chevron STRIPES** after Nate's mockup — stroke = half the pitch, tiling
  the bar, 12% at the head → 0 at the tail (glass at ×0.6). Each stripe is its own element
  (⛔ no tiled background — real-Safari 1px gaps; ⛔ no element opacity). Retired the same
  day, in order: tapered arrow-head bars + tail fade (too faint) → one overlaid arrow (not
  obvious enough, vanished on short bars).
- **Leading line** (⚓ Nate): ONE 1px stroke per step from the TOP of a bar's leading end
  to the BOTTOM of the next bar's start — it caps both bars. ⛔ No separate inset edge (it
  sat 0.5px off the connector and read as two lines); bar ends square.
- Mechanics added: Lunar & Stellar family (Base DMG Bonus 0–150, Elevation 0–100 as
  inputs), Reaction Bonus on every reaction family, ATK / HP / DEF scaling stat (correct
  roll sizes), DEF shred + ignore behind a switch (off zeroes them), levels 95/100. DMG
  Bonus LEFT "What the next roll buys" (no substat carries it; its +10% step was invented).
- Range evidence (corpus + gcsim, 7.1): weapon/artifact "Reaction DMG +X%" is bucket 5
  (Reaction Bonus); only Moonsign benedictions + Stellar Jubilee write Base DMG Bonus
  (≤14% each, gcsim stacks two). ⚠️ Ascendant Gleam's 36% is worded bucket 5, unverified.

## 3. Ifa's A1 (data fix, `85c6b01c`)

Authored as a 7-reaction `elevate` 90 (renders nothing) + `lunarChargedDmgBonus` 12 —
both wrong buckets; gcsim `ifa/asc.go` uses `AddReactBonusMod` (bucket 5). Now four
bucket-5 buffs at the documented 60-point basis: Swirl + EC 90, LC + **Stellar Swirl 12**
(gcsim gives SSw the Lunar rate). Measured at the consumer: `parseNotation("Ifa E")` →
one 600f window with all four.

## 4. Hazards worth not rediscovering

- ⚠️⚠️ **`.instrument`'s implicit grid column is AUTO** and grows to its widest
  unbreakable child — both instruments overflowed a 320px phone by ~40px. Fixed LOCALLY
  (`grid-template-columns: minmax(0, 1fr)`); ⏭ **the other six instruments still carry it**
  — check each on its pass (sweep every tab at 320 / 390 / 768 / 1440 / 1920).
- ⚠️ A start-aligned `.segment` tab row sizes to content and never wraps → `max-width: 100%`.
- ⚠️ Screenshots taken right after a click are MID-TRANSITION (bars glide 240ms) — wait
  ~800ms before judging geometry.
- ⚠️ A shared `--fill` mixed again inside a gradient is a nested `color-mix` (crashes
  WebKit) — each class names its colours outright.
- ⚠️ A gridline layer spanning `2 / span N` in a subgrid waterfall pushes auto-placed rows
  BELOW it — pin every row's `grid-row`.

## 5. Open

- ⏭ Real-Safari look at both instruments (Nate) — many small drawn elements now.
- ⏭ The new strings of both passes go into the translation ledger when it is built.
- ⏭ Next instrument pass: Nate's pick (Crit 01 / ICD 02 / Gauge 03 have ruled sheets).

## Notes carried over from Claude's working memory (2026-10-29)

From `docs/rounds/instrument-passes-2026-10-01.md`, Reaction Curves details the record above does not carry:

- The Transformative note says "for most characters". ⛔ Don't enumerate the crit exceptions (Nahida C2, Mizuki).
- Copy rule as applied: the readings carry no "At X EM" prefix and no "Another 50 EM" sentence. The readout's intro spans the box (it overrides `.note`'s 56ch).
- ⚠️ Crystallize same-element absorption is 2.5× (+150%), per gcsim `shield/template.go:51`; an earlier reading said "150% of that".
- Measured: 1080p fits with no scroll; 1440×900 needs a short scroll to reach the sliders.
- Three abreast (EM, RB, Level) was too short to land a level, which is why Level always takes its own full-width line.

From `docs/rounds/instrument-passes-2026-10-01.md`, one Damage Anatomy value the record above does not carry:

- The glass bar's edge settled at **1px** (⚓ Nate); no edge and a 2px edge were both tried first.
