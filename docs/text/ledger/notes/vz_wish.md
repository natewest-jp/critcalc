# Notes — `vz_wish` (Wish Odds)

Hand-written half of the ledger for `../inventory/vz_wish.md`. Written at the close of the
Wish Odds pass (2026-10-04, `docs/rounds/wish-odds-pass-2026-10-04.md`); the rulings come from
worksheet 06 + the conventions sheet (both superseded) and from that pass, where Nate
rewrote the explainers with Claude.

## The surface

A chart of cumulative chance against pulls (one line per level on the way to the goal, the
goal's bold, a draggable pulls marker), ONE controls panel (Pulling for · Character Event
and/or Weapon Event) and a Readout card with a level table. `.kicker`, `.slider-label` and
the target chips are uppercased by CSS — write them sentence case.

- ⚓⚓ **The vantage point is the PLAYER's** (Nate, 2026-10-04). An explainer says what
  happens to _you_ when you pull — "you'll win the 50/50 about 55% of the time" — ⛔ never
  the item pool's view ("a 5★ is the featured character 55% of the time"), which reads as
  nonsense to someone thinking "I want to win my 50/50." Translate it the way a player in
  that locale talks about wishing, ⛔ not word for word.
- ⛔ **Don't explain what every player knows** — that losing the 50/50 guarantees the next
  one is cut everywhere (style guide §1.3c).
- 🔒 **Frozen:** `50/50`, `pity`, `soft pity`, `fate point` (community/game vocabulary;
  the glossary's 🏷 list) · **Character Event**, **Weapon Event** (the game's banner
  names, abbreviated) · **Capturing Radiance** (official) · `C0`–`C6`, `R1`–`R5` as level
  names · `5★`/`4★` visible, `five-star`/`four-star` in aria (conventions §H).
- ⚠️ **Level names are built in code** — `C{copies − 1}` and `R{copies}` — and a pair goal
  joins them with no space (`C0R1`, the community's own notation). 🔒 Never translate.
- ⚠️ **The chips are TIGHT.** "Not owned" … C5 holds one row in half a two-tile workspace
  with 5px to spare (272px at 1360). A longer "Not owned" wraps C5; the fallback Nate has
  been told about is "None".

### `vz_wish_5_and_weapon`

A 5★ character AND their signature weapon, pulled on two banners. ⚠️ Short on purpose — a
target chip.

### `vz_wish_not_owned`

"You have" row, first chip: zero copies. ⚠️ Length-capped (see the surface note).

### `vz_wish_1_pull`

⚠️⚠️ **ASSEMBLED**: `pullsPhrase()` returns `1 pull` / `{n} pulls`, spliced into
`vz_wish_chance_chance_of_label_within_pulls`. ⏭ At i18n: ONE ICU message for the host
sentence with `{n, plural, …}`, and both fragments are deleted.

### `vz_wish_n_pulls`

See `vz_wish_1_pull`.

### `vz_wish_guarantee_held_lost_the_last_50_50`

Checkbox, Character Event (5★). ⚓ Nate kept "held" for all three labels.

### `vz_wish_guarantee_held_last_4_wasn_t_featured`

Checkbox, Featured 4★. ⚓ Nate's wording: for a 4★ the guarantee means your last 4★ wasn't
one of the three featured characters.

### `vz_wish_fate_point_held`

Checkbox, Weapon Event. Epitomized Path; one point since 5.0.

### `vz_wish_or_drag_across_the_chart`

Under the **Pulls saved** slider: the chart's marker sets the same value. "Or" continues
the slider above it — instruction, welcome (§1.3c).

### `vz_wish_aiming_for`

The goal level: C0–C6 or R1–R5. Chips at or below **You have** are disabled.

### `vz_wish_without_a_guarantee_you_ll_win_the_50_50`

⚓ Nate's wording. "About 55%" is the official CONSOLIDATED rate; "about" carries what "on
average" would. The fine print is the modelling decision: Capturing Radiance's counter is
not datamined, so each 50/50 is an independent 55% (measured <1% from GGanalysis's
conservative counter model at C6). ⚓ Keep the limit stated (§1.2).

### `vz_wish_without_a_guarantee_each_4_you_pull_has`

⚓ Nate's wording, numbers checked: 50% × ⅓ = 16.7% · guaranteed ⅓ = 33.3% · long run
⅔ × 16.7% + ⅓ × 33.3% = **22.2%** (⛔ not 25%, the plain average of the two — you are
unguaranteed twice as often). ⚠️ "each 4★ you pull" is load-bearing: the chance is PER 4★,
⛔ never per wish. The fine print is non-obvious and true: the banner's off-rate 4★ pool
excludes its featured three, even ones already on the standard banner.

### `vz_wish_without_a_fate_point_each_5_you_pull_has`

⚓ Nate's wording. 37.5% = 75% featured pair × ½. "standard" is lowercase — a description,
not the banner's name.

### `vz_wish_chance_chance_of_label_within_pulls`

Readout headline: the big percentage, then the phrase on its own line. ⚠️ ASSEMBLED
(`pullsPhrase`), see `vz_wish_1_pull`; `{label}` is a level name (🔒).

### `vz_wish_half_by`

Column head: the median, in pulls. Explained by
`vz_wish_half_by_half_of_players_get_there_within`. ⚠️ Short — a table head in a ~15rem
column.

### `vz_wish_unlucky_tenth`

Column head: the 90th percentile, in pulls. ⚓ Worksheet 06: "a lovely way to say the
90th percentile" — keep the image; a translator needs this note to recover it.

### `vz_wish_on_average_label_would_take_mean_pulls`

§1.8: a reading of the reader's own settings says "would". `{label}` is a level name.
⚠️ "pulls" is plural-blind (the mean is never near 1, but use ICU anyway).

### `vz_wish_half_by_half_of_players_get_there_within`

⚓ Nate's wording. Glosses the two column heads, so it must repeat their translated text
exactly (§3.3 — a reference, not a copy).

### `vz_wish_your_character_and_weapon_banners_keep`

Only on the 5★ and weapon target: the combined figure is the SUM of two independent pull
counts.
