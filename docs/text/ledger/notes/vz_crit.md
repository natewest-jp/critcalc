# Notes — `vz_crit` (Crit heatmap)

Hand-written half of the ledger for `../inventory/vz_crit.md`. Rewritten for the stage at the
close of `docs/rounds/viz-stage-crit-2026-11-03.md` (its §5 is the copy's record); the rulings
that survive come from the Crit Heatmap pass (2026-10-02,
`docs/rounds/crit-heatmap-pass-2026-10-02.md`).

## The surface

One stage: the headline (your average per hit), the heatmap with a control on each axis and
its toolbar on its top edge, the crit-count strip beside it (under it on a phone), and the fine
print. Where the tile is wide, the headline and the fine print are a column of about 17rem at
the left edge. ⚠️ **The words drawn on the chart are 10px type** with no room to grow:
"best split of this budget", "below the base 5% CRIT Rate", "average damage", "{n} CV",
"crits in {n} hits", "{+3.3%} vs pinned". `.slider-label` is uppercased by CSS, so write
labels in sentence case.

- **CRIT Rate / CRIT DMG** are the game's stat names (🎮, take the game's own words).
- **Screen-reader names stay spelled out**: `Crit rate`, `Crit damage` (conventions §B's
  carve-out): an all-caps `CRIT` is spelled letter by letter by some readers. ⛔ Don't
  "correct" them to the game casing.
- **Multipliers** are `×1.98`: the × leads, two decimals (`formatMultiplier` in `crit.ts`).
  Chances come from `formatChance`, which writes `<0.1%` / `>99.9%` at the ends rather than
  a false `0.0%` / `100.0%`. ⏭ i18n: both become locale number formats; the `×` placement
  is a §G ruling and stays.
- ⚠️⚠️ **`hit` / `hits` (`hitsWord`) is an assembled plural** spliced into six messages. A
  locale cannot inflect it from outside. ⏭ At i18n each host message becomes one ICU
  message with its own `{n, plural, …}` and `hitsWord` is deleted. ⛔ Never translate
  `vz_crit_hit` / `vz_crit_hits` as words.
- **A rotation** (📖) is the player's sense: one run of a team's actions, here counted in
  hits that can crit.

### `vz_crit_crit_rate_and_crit_damage_heatmap`

The chart's accessible name. Spelled out on purpose (see above).

### `vz_crit_mymultiplier_average_damage_per_hit`

The headline: your build's average damage per hit as a multiplier of a hit that doesn't crit
(1 + CRIT Rate × CRIT DMG), e.g. "×1.98 average damage per hit". It is the quantity the
heatmap's colour encodes.

### `vz_crit_crit_rate_d37f` · `vz_crit_crit_dmg`

The two handles' labels, and the axes' only names: CRIT Rate's stands over the chart's left
edge, CRIT DMG's under the chart.

### `vz_crit_crit_rate_9bbd` · `vz_crit_crit_damage`

The same handles' screen-reader names (see above).

### `vz_crit_hits_per_rotation`

Slider label in the toolbar. ⚓ "per", never a slash: a slash that means _per_ is a rate
(team-builder §3's rule). Its track is coloured by the chance of a rotation without a crit
at each hit count, for your CRIT Rate.

### `vz_crit_no_crit_shading` · `vz_crit_darkens_each_crit_rate_by_its_chance_of`

A toggle and its tooltip. On, each CRIT Rate's row of the heatmap is darkened by its chance
of a whole rotation without a single crit, so the darker a build, the likelier a rotation
that never crits. Help names it by the button's label.

### `vz_crit_pin_this_build` · `vz_crit_clear_pin`

One button, two states: Pin freezes a second marker at your build to compare a trade
against; Clear removes it. Its word drops where the toolbar is narrow, and these stay as its
screen-reader name.

### `vz_crit_pinneddelta_vs_pinned`

⚓ One message (Nate, 2026-09-23): the relative difference, `mine / pinned − 1`, drawn on the
line between the two markers, e.g. "+3.3% vs pinned"; a worse build reads "−4%". The signed
percentage comes from `Intl.NumberFormat`. ⛔ Never a hand-built `+`.

### `vz_crit_x_cv`

The solid line's label: the build's total crit value, e.g. "280 CV". 🏷 CV stays.

### `vz_crit_best_split_of_this_budget`

Beside the ring on the solid line: the split of the same crit value with the highest
average. Hidden when you sit on it.

### `vz_crit_move_to_the_best_split_of_this_budget`

The ring is a button: its tooltip and screen-reader name. A press moves your build to that
split.

### `vz_crit_average_damage`

The right edge's name: that edge is an axis of average damage, ×1 to ×4, where each curve
meets it at its own value.

### `vz_crit_below_the_base_5_crit_rate`

Words in the veiled band at the bottom of the heatmap: no build has less than the base 5%
CRIT Rate, so the band from 0% to 5% holds none.

### `vz_crit_crits_in_n_x` · `vz_crit_crits_in_hitsperrotation_hitsperrotation`

The strip's name, under its column of crit counts (beside the heatmap) or under its columns
(on a phone): "crits in 8 hits". Assembled plural (see above).

### `vz_crit_a_hit_that_doesn_t_crit_is_1`

The fine print's first line: states the comparison point, so ×1.72 reads as "72% more".

### `vz_crit_the_curving_bands_show_how_much_your`

⚓ Nate's wording (2026-11-04). The dotted curves are contours of equal average, and the
colour between them is a band; "increase" is over a hit that doesn't crit, averaged over
many rotations.

### `vz_crit_the_solid_line_is_every_build_with_your`

⚓ **Total, on purpose** (Nate, 2026-10-02): computed from the build's total stats, base
included. Community "CV" usually means _artifact_ crit value, where 280 is near impossible,
so "total" carries the difference. Glossary: **crit value (CV)** on first use. ⚓ "base crit
stats included" (Nate, 2026-10-02), not "5% and 50%", because an ascension stat raises the
base for many characters. ⛔ Don't add base as a term in the formula: it is already inside
the totals.

### `vz_crit_each_bar_is_a_number_of_crits_in_one`

The strip's guide. ⚓ Nate cut "as long as its chance" (2026-11-04); a bar's length is its
chance, and Help says so.

### `vz_crit_roll_hitsperrotation_hitsperrotation`

Button: plays one rotation of N independent crit rolls. It sits in the fine print, its dots
and sentence under it. Assembled plural.

### `vz_crit_on_average_x_of_hitsperrotation`

The slot under Roll at rest, e.g. "On average 5.6 of 8 hits crit, and <0.1% of rotations
never crit." ⚓ "never crit" is Nate's (2026-11-04). The decimal count is correct and
intended: the average falls between two bars.

### `vz_crit_on_average_59_4_of_60_hits_crit_and_0_1`

Not read by anyone: hidden text that reserves the slot's height, so a hover or a roll never
moves the stage. Translate it as the longest form of the message above (60 hits).

### `vz_crit_k_of_hitsperrotation_hitsperrotation`

The slot while a bar is hovered or tapped, e.g. "6 of 8 hits crit: ×2.05, in 29.6% of
rotations." ×2.05 is that rotation's average multiplier.

### `vz_crit_rollcrits_of_length_length_crit_mycd`

The slot after a roll, e.g. "4 of 8 hits crit: ×1.70 this time." ⚓ Nate 2026-10-02: no
"(average …)", since the headline already says it.

### `vz_crit_hit` · `vz_crit_hits`

⛔ Not words to translate: see the assembled plural above.
