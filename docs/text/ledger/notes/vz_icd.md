# Notes — `vz_icd` (ICD Timeline)

Hand-written half of the ledger for `../inventory/vz_icd.md`. Written at the close of the
ICD Timeline pass (2026-10-04, `docs/rounds/icd-timeline-pass-2026-10-04.md`); the rulings come
from worksheet 02 + the conventions sheet (both superseded) and from that pass.

## The surface

A chart of an attack string (which hits apply their element, the hit counter under each,
the timer windows under that), a key that ends in the element swatches, two panels
(Attack string · ICD rule) and a Readout card. ⚠️ Chips are **tight** — the example row
wraps to four lines on a phone; `.kicker`, `.slider-label` and chips are uppercased by
CSS, so write them sentence case.

- **ICD** is 🔒 — it stays ICD. **Internal Cooldown** is its expansion and translates
  (the 🏷 pattern: freeze the acronym, translate the expansion once, where it is defined).
- **Times print as `2.5s`** (`fmtS`: up to two decimals, trailing zeros dropped). ⏭ At
  i18n a locale number format with its own unit spacing.
- **Example names are character and ability names** — 🎮 take the game's own words for
  Fischl's **Oz**, **Hu Tao**, **Chevreuse**, **Layla** and **Shooting Stars**; the
  possessive frame (`{name}'s {thing}`) is ours and should be one message per locale.
  ⚠️ They are DATA in `icdExamples.ts` (`label`, `note`), not template text — the
  extractor does not see them yet.
- ⚠️⚠️ **The rule line is ASSEMBLED** (`ruleText`): `{t} timer` · `every {nth} hit` ·
  `at most {n} per window`, joined by `·`. `ordinal()` is English (`2nd`, `3rd`, `4th`)
  and so is `every hit` for 1. ⏭ At i18n: one ICU message per shape, with
  `{n, selectordinal, …}`, and the joiner is the locale's list separator — ⛔ never
  translate the fragments one by one.
- ⚠️⚠️ **Plurals spliced from outside** (`hit applies` / `hits apply`, `application` /
  `applications`, `application is` / `applications are`): each host sentence becomes ONE
  ICU message with its own `{n, plural, …}` and the fragments are deleted.

### `vz_icd_internal_cooldown_the_hidden_rule_that`

⚓ The site's best one-line definition (worksheet 02): it expands the acronym AND says why
anyone cares. ↻ Nate's fix: "some hits … their element" — the old "stops every hit" was
false. ⛔ Keep it one sentence.

### `vz_icd_every_hit_applies_its_element`

The No ICD rule line. Also what a timer of 0 reads as under Custom — which cannot be
reached (the slider starts at 0.5s), so this line is No ICD's alone.

### `vz_icd_at_most_cap_per_window`

New with the pass. "Window" = one run of the ICD timer, the band under the chart. The
game stores each ICD group as a finite list of which hits apply; the number is how many
applications that list holds (Standard: 8, a limit only reached at ~10 hits per second).

### `vz_icd_its_own`

The rule chip shown only while an example is loaded: the example's OWN ICD group, as
opposed to Standard. "Its" = the example's — a locale may need the noun ("Its own rule").

### `vz_icd_even_spacing`

The first source chip: hits evenly spaced, set by the two sliders below — as opposed to
the four examples, whose hits are real game timings.

### `vz_icd_0_5s_normal_attacks`

Three anchors under the Hit interval slider. ⚓ **Keep the spread** — under Standard they
show the rule's three cases: at 0.5s the counter decides, at 1s the counter and timer
agree, at 2s the timer decides. Values are corpus- and gcsim-measured (0.475s median swing
gap; Oz 0.98s; 2s summon ticks such as Zhongli's stele). The `~` is a real "about".

### `vz_icd_1s_summon_ticks`

See `vz_icd_0_5s_normal_attacks`. "Summon" is 🏷 (off-field entities: Oz, Rain Swords,
Xiangling's Guoba…).

### `vz_icd_2s_slow_summon_ticks`

See `vz_icd_0_5s_normal_attacks`.

### `vz_icd_hit_counter`

Custom's counter slider: every Nth hit applies. Its readout says `Off` at the top stop,
meaning the counter never applies anything and only the timer does.

### `vz_icd_off`

`Hit counter` readout at its top stop — the counter is switched off.

### `vz_icd_limit_per_window`

Custom's cap slider. Its readout says `None` at the top stop (no limit).

### `vz_icd_none`

`Limit per window` readout at its top stop — no limit.

### `vz_icd_1_2_3_hit_counter`

🔒 The digits are a picture of the counter row, not words — they stay `1 2 3` in every
locale; only "hit counter" translates.

### `vz_icd_1_applied_by_the_counter`

🔒 The ringed `1` is a picture; only the phrase translates. The ring marks a hit that
applied because the counter came round, as opposed to the timer running out.

### `vz_icd_window_limit_reached`

🔒 The dash is a picture. Shown only when some hit is past its window's limit.

### `vz_icd_point_at_a_hit_to_read_why_it_applies_or`

The Readout's resting line (the Gauge Explorer has the same pattern). "Point" covers
both a mouse and a tap.

### `vz_icd_hit_x_x_s`

The reading's heading: `Hit 6 · 2.50s`, then `applies` / `blocked` in bold after it.

### `vz_icd_timer_have_passed_since_the_timer`

⚓ The asymmetry this instrument exists to show: the TIMER sets the counter back to 1, the
counter never restarts the timer. Keep both halves.

### `vz_icd_every_hits_hit_applies_the_timer_from`

The counter half of the same asymmetry — "keeps running" is the point: an application by
the counter does NOT restart the timer.

### `vz_icd_text_x_in_each_timer_window`

⚓ PER WINDOW, never per second (worksheet 02 → the pass): an average over the string on
screen moved with the Hits slider. `{text}` is a number or a range (`1–2`, en dash).

### `vz_icd_sends_the_first_8_hits_within_15s_that`

Nate's wording (worksheet 02; reworded in `8c7a9978` when the handoff began dropping hits
past the Gauge Explorer's 15s axis). Every hit goes over as 1U because the instrument draws
no gauge sizes. "8" and "15s" are the handoff's limits (`MAX_GAUGE_APPS`, `MAX_GAUGE_TIME` in
`workspace.ts`), typed into the string as literals. ⚠️ Names
another instrument — move with its translated name.

### `vz_icd_send_to_gauge_explorer`

⚠️ Names another instrument (style guide §3.3) — use the instrument's translated name.
