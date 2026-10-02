# Notes — `vz_crit` (Crit Heatmap)

Hand-written half of the ledger for `../inventory/vz_crit.md`. Written at the close of the
Crit Heatmap pass (2026-10-02, `docs/crit-heatmap-pass-2026-10-02.md`); the rulings come
from worksheet 01 + the conventions sheet (both superseded) and from that pass.

## The surface

One instrument tile, often one of two or three across: ⚠️ **every control label is tight**
(a 22rem side column at its widest, ~170px per column in the strip). Labels in
`.slider-label` / `.kicker` are uppercased by CSS — write them sentence case.

- **CRIT Rate / CRIT DMG** are the game's stat names (🎮 — take the game's own words).
  **CR / CD** are their 🏷 abbreviations and appear only where there is no room (the
  marker tooltip, the ratio, the formula line). ⚓ Two names per stat is deliberate.
- **Screen-reader names stay spelled out** — `Crit rate percent`, `Crit damage percent`
  (conventions §B's carve-out): an all-caps `CRIT` is spelled letter by letter by some
  readers. ⛔ Don't "correct" them to the game casing.
- **Multipliers are code-formatted**, `×1.98`: the × LEADS, two decimals
  (`formatMultiplier` in `crit.ts`). Percentages of chance come from `formatChance`,
  which writes `<0.1%` / `>99.9%` at the ends rather than a false `0.0%` / `100.0%`.
  ⏭ i18n: both become locale number formats; the `×` placement is a §G ruling and stays.
- ⚠️⚠️ **`hit` / `hits` (`hitsWord`) is an ASSEMBLED PLURAL** spliced into five
  sentences. A locale cannot inflect it from outside. ⏭ At i18n each host sentence
  becomes ONE ICU message with its own `{n, plural, …}` and `hitsWord` is deleted —
  ⛔ never translate `vz_crit_hit` / `vz_crit_hits` as words.

### `vz_crit_crit_rate_and_crit_damage_heatmap`

The chart's accessible name. Spelled out on purpose (see above).

### `vz_crit_cd_2_cr`

🔒 A formula drawn on the chart, beside the dashed diagonal. Keep it as written.

### `vz_crit_x_cv`

The equal-budget line's label: the build's total crit value, e.g. "280 CV". 🏷 CV stays.

### `vz_crit_best_split_of_this_budget`

Beside the circle on the budget line: the split of the same budget with the highest
average. Drawn on the chart, ~150px of room at 10px type.

### `vz_crit_average_dmg`

Axis title (right edge). ⚠️ **Written sentence case and SHOWN in capitals by CSS** — and
its placement is measured on capital-letter ink (`AXIS_INK` in `crit.ts`). A locale whose
capitals carry accents or descend, or a CJK title, will sit off the measured gaps. ⏭ i18n:
`AXIS_INK` becomes per-locale or is measured live.

### `vz_crit_crit_dmg`

Both the slider label and the bottom axis title — the axis note above applies.

### `vz_crit_crit_rate_d37f`

Both the slider label and the left axis title — the axis note above applies.

### `vz_crit_cr_x`

Marker tooltip, first line. 🏷 CR stays (no room). ~110px.

### `vz_crit_cd_x`

Marker tooltip, second line. 🏷 CD stays.

### `vz_crit_no_crit_risk_zerocritrisk`

Marker tooltip, last line (only with the overlay on): the chance that a whole rotation
lands no crit at all. Same label as the readout's row; label first, like its neighbours.

### `vz_crit_equal_budget_line_cv`

A toggle. "Equal-budget" = every build with the same crit value, i.e. the same number of
crit rolls. 🏷 CV stays.

### `vz_crit_no_crit_risk_overlay_chance_a_whole`

A toggle and its second line. The overlay darkens the heatmap where a whole rotation is
likely to land zero crits. ⚠️ Two messages in one run — the hint is a separate line under
the label.

### `vz_crit_hits_per_rotation`

Slider label. ⚓ "per", never a slash: a slash that means _per_ is a rate (team-builder
§3's rule). Its track is coloured by the no-crit risk at each hit count for the build's
own CRIT Rate.

### `vz_crit_current_build`

The readout card's kicker. Sentence case (CSS uppercases it).

### `vz_crit_average_dmg_per_hit_a_hit_that_doesn_t`

⚓ Ruled (Nate, 2026-09-23). Glosses the headline `×1.98`: the same quantity the heatmap
colours by. It states the comparison point (a hit that doesn't crit = ×1), so ×1.72 reads
as "72% more". Two whole sentences — keep them two.

### `vz_crit_ratio_cd_cr`

🔒 `CD:CR` is a ratio separator, not a label colon. The value is `2.00 : 1`, or `—` when
undefined (a dash is the site's "no value" mark).

### `vz_crit_total_crit_value_cv`

⚓ **TOTAL, on purpose** (Nate, 2026-10-02): computed from the build's total stats, base
included. Community "CV" usually means _artifact_ crit value, where 280 is near
impossible, so the word "Total" carries the difference. Glossary: **crit value (CV)** on
first use.

### `vz_crit_2_crit_rate_crit_dmg_base_crit_stats`

The formula under Total crit value. ⚓ "base crit stats included" (Nate, 2026-10-02) —
not "5% and 50%", because an ascension stat raises the base for many characters. ⛔ Don't
add base as a term in the formula: it is already inside the totals.

### `vz_crit_no_crit_risk_hitsperrotation`

Readout row: the chance a rotation of N hits lands zero crits. ⚠️ Assembled plural (see
the surface notes).

### `vz_crit_pinned`

Readout row label; the value is `70.0% / 140.0% · ×1.98` (CRIT Rate / CRIT DMG · its
average).

### `vz_crit_pinneddelta_average_dmg_vs_pinned`

⚓ ONE message (Nate, 2026-09-23): the RELATIVE difference, `my / pinned − 1`, e.g.
"+7% average DMG vs pinned"; a worse build reads "−4%". The signed percentage comes from
`Intl.NumberFormat` — ⛔ never a hand-built `+`.

### `vz_crit_clear_pin`

Button.

### `vz_crit_pin_this_build`

Button: freezes a second marker on the chart to compare a trade against.

### `vz_crit_crits_in_one_rotation_of_hitsperrotation`

Title of the one-rotation chart: one bar per number of crits (0 … N), its height the
chance of exactly that many. A line marks the average.

### `vz_crit_hoveredcount_of_hitsperrotation`

The sentence under the chart while a bar is hovered or tapped, e.g. "6 of 8 hits crit —
×2.05, in 29.6% of rotations". ×2.05 is that rotation's average multiplier.

### `vz_crit_rollcrits_of_length_length_crit`

The same sentence after a Roll, e.g. "4 of 8 hits crit — ×1.70 this time". ⚓ Nate
2026-10-02: no "(average …)" — the headline above already says it.

### `vz_crit_on_average_x_of_hitsperrotation`

The sentence's resting state, e.g. "On average 5.6 of 8 hits crit — ×1.98". The decimal
count is correct and intended — the average falls between two bars.

### `vz_crit_roll_hitsperrotation_hitsperrotation`

Button: plays one rotation of N independent crit rolls. ⚠️ Assembled plural.
