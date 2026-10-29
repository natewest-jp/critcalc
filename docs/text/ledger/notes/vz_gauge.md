# Notes — `vz_gauge` (Gauge Explorer)

Hand-written half of the ledger for `../inventory/vz_gauge.md`. Written at the close of
the Gauge Explorer pass (2026-10-02, `docs/rounds/gauge-explorer-pass-2026-10-02.md`); the
rulings come from worksheet 03 + the conventions sheet (both superseded) and from that
pass.

## The surface

A chart of the enemy's elemental gauges over time, a toolbar over it (playback, then the
selected application's element, size, time and remove, then Add), the example
scenarios, and a Readout card with the aura log. ⚠️ The toolbar is **tight** — its four
groups share one row from 55rem and wrap below.

- **Element and reaction names are 🎮 game terms** — the game's own word per locale.
  ⚓ **Frozen** and **Overloaded**, never the community "Freeze" / "Overload"
  (glossary §2, ⚓ Nate). Element names come from `ELEMENT_LABEL`
  (`$lib/utils/auraDisplay.ts`) — a lookup, not a message.
- **U** (gauge units) is 🏷: it stays U; the gauge-size buttons' tooltip defines it.
- **Multipliers lead with ×** (`×2`, `×0.5`, `×0.8`), conventions §G. ⚠️ `Vaporize ×2` /
  `Melt ×1.5` name the DAMAGE multiplier that tells the two directions apart; the gauge
  each reaction consumes is a different number, and the Reverse Melt note says so.
- **Formulas stay as written** (🔒): `2.5 × 1 + 7 = 9.5s`, `2 × min(aura, trigger)`,
  `5 × gauge + 6s`. A rate is written with "per" (`0.4U per second`), never a slash.
- ⚠️ **Bold in the scenario notes is Nate's, chosen line by line** (worksheet 03) — keep
  exactly what is there; he removed some on purpose.
- ⚠️⚠️ **The aura log is ASSEMBLED** from code: an element name, a number formatted by
  `fmtU`, and a qualifier in parentheses. ⚓ The qualifier always rides in
  PARENTHESES after the thing it qualifies (⚓ Nate, 2026-09-27), ⛔ never two in a row.
  ⏭ At i18n each line shape becomes one ICU message with its element and amount as
  arguments.

### `vz_gauge_vaporize_2`

Reaction name on the chart and in the log. The ×2 is the forward (strong) direction's
damage multiplier — the same family names the reverse `Vaporize ×1.5`.

### `vz_gauge_crystallize_blocked`

Chart label for a Crystallize attempt inside the 1s reaction cooldown. In the log the
same event reads `vz_gauge_crystallize_blocked_by_its_1s_cooldown`.

### `vz_gauge_bloom_via_quicken`

A Bloom triggered on Quicken (which carries Dendro), as opposed to on a Dendro aura.

### `vz_gauge_single_aura`

Scenario chip. ⚓ Sentence case (ours); reaction names in chips keep the game's caps
(`Reverse Melt` — Melt is the game's word).

### `vz_gauge_1u_application_the_size_of_most_hits_in`

The instrument's first teaching: the ×0.8 **aura tax** and the decay formula. "Most hits
in the game are 1U" is a corpus fact (1U ×327 of the applications we measured).

### `vz_gauge_re_applying_the_same_element_except_pyro`

⚓ "(except Pyro, as of version 3.0)" — enough for a curious reader to look it up (Nate,
2026-09-27). The Pyro refresh scenario shows the exception.

### `vz_gauge_pyro_refresh`

Scenario chip, added 2026-10-02. Shows the two log lines only Pyro produces.

### `vz_gauge_since_version_3_0_pyro_doesn_t_top_up_a`

Checked against gcsim `attachOverlapRefreshDuration`: weaker than the standing aura → no
effect; at least as strong → the gauge and the decay rate are both replaced.

### `vz_gauge_hydro_on_pyro_is_the_strong_direction`

⛔ Never "vape" (worksheet 03, ⚓ Nate) — the slang has another meaning.

### `vz_gauge_overvape`

🏷 A community name for the interaction (⚓ Nate) — label kept, explanation translates.

### `vz_gauge_melt_on_frozen`

Scenario chip, added 2026-10-02.

### `vz_gauge_pyro_melts_frozen_at_2_just_as_it_melts`

Checked against gcsim `TryMelt` (Pyro reduces Cryo and Frozen, each by up to 2 × its
gauge) and `TryVaporize` (refused while any Frozen remains).

### `vz_gauge_burning_a_fixed_2u_aura_plus_a_hidden`

⚠️ Corrected 2026-10-02: the damage ticks every 0.25s, but the Pyro re-application rides
the Burning ICD — about every 2s (KQM §3.9, gcsim). "or faster": the fuel drains at the
larger of its own decay and 0.4U per second.

### `vz_gauge_el_auraafter_after_tax`

Log line: an element became an aura. `{el}` is the element's name, the number its gauge
after the ×0.8 tax.

### `vz_gauge_el_topped_up_to_auraafter_rate_kept`

⚠️ "topped up TO", not "after tax": a top-up keeps the larger of the standing aura and
the new taxed gauge, so the number can be the old aura, untouched by this hit.

### `vz_gauge_spent_trigger_trigger_trigger`

The tail of a reaction line, e.g. "Vaporize ×2: −2U Pyro, −1U Hydro trigger": what the
aura lost, then what the TRIGGER spent. ⚓ Both numbers on purpose — they differ by the
reaction's modifier, which is the lesson of the Vaporize and Reverse Melt scenarios.
⚠️ ASSEMBLED with the reaction name and the consumed list.

### `vz_gauge_count_electro_charged_ticks_0_4u_from`

⚠️ Needs an ICU plural on the count. "from both each tick" — every tick drains 0.4U from
each of the two auras.

### `vz_gauge_burning_ends_swept`

`{swept}` is ` (Burning, Dendro gone)` or empty — ASSEMBLED.

### `vz_gauge_max_apps_applications_is_the_most`

Tooltip on the disabled Add at the cap. ⚠️ Plural on the count (always 8 today).

### `vz_gauge_add`

The Add button's word; hidden below 40rem, where the ＋ stands alone (`aria-label` keeps
`vz_gauge_add_application`).

### `vz_gauge_click_to_add`

Drawn over the faint marker that previews a click on the band — a hint, 10px, short.

### `vz_gauge_element_gauge_u_at_x_seconds`

A marker's accessible name, e.g. "Hydro 2U at 1.5 seconds". ⚠️ ASSEMBLED.

### `vz_gauge_point_at_the_chart_or_press_play_to_read`

The Readout's resting instruction. "Point at": hovering the plot reads that moment (a
touch taps or drags the playhead instead).

### `vz_gauge_no_aura_the_next_element_applies_fresh`

⚓ A teaching sentence, not an empty state (worksheet 03): the gap IS the information.
⛔ Don't reduce it to "No aura."

### `vz_gauge_aura_log`

⚓ The planner's name for the same component — one name in both tools (worksheet 03).
