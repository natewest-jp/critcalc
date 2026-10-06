# Notes — `vz_artifact` (Artifact Odds)

Hand-written half of the ledger for `../inventory/vz_artifact.md`. Written at the close of the
Artifact Odds pass (2026-10-06, `docs/artifact-odds-pass-2026-10-06.md`); the rulings come from
worksheet 08 + the conventions sheet (both superseded) and from that pass, where Nate rewrote
every explainer with Claude.

## The surface

Three views of a piece's life — **Drop** (a chance-by-days curve, domain vs. an Outbreak),
**Level up** (a histogram of your stats at +20) and **Your piece** (a card that mirrors the
game's reshape screen, plus a histogram) — ONE controls panel and a Readout card. `.kicker`,
`.slider-label` and every chip are uppercased by CSS — write them sentence case.

- ⚓⚓ **The vantage point is the PLAYER's** (style guide §1.10): "players would have this piece
  after 7 days", "chance it would end above 29.6 CV" — what happens to _you_, ⛔ never the
  item pool's view. "Would" for every hypothetical (§1.8).
- ⚓ **"Your stats"** is the player's own choice of up to four substats — what counts as good.
  ⛔ Not "target pair" (retired). Translate as the player's stats, not "the target".
- ⚓ **"Useful rolls"** (⚓ Nate) is the unit for any stats that aren't only CRIT: each roll
  into your stats counted by its size (a max roll 1, the smallest 0.7). It is OURS — a plain
  phrase, ⛔ not the community's "RV" — so translate the meaning, as plainly as English does.
- 🔒 **Frozen (game vocabulary — genshin-db / the game's own text per locale):** every stat
  name (HP · ATK · DEF · HP% · ATK% · DEF% · Energy Recharge · Elemental Mastery · CRIT Rate ·
  CRIT DMG · Elemental DMG · Physical DMG · Healing Bonus) · the slots (Flower · Plume · Sands
  · Goblet · Circlet) · **Sanctifying Elixir** · **Dust of Enlightenment** · **Stygian
  Onslaught** · **Disturbance Outbreak** · the reshape tiers **Standard / Advanced / Decreed**
  · resin.
- 🏷 **Community vocabulary, kept:** CV (crit value), the short stat forms CR / CD / ER / EM,
  "+20", "5★". ⚠️ "**five-star**" is SPELLED OUT in one line (`about_1_in_every…`) on
  purpose — a digit beside "1 in 109" read as part of the odds (⚓ Nate, against §H).
- ⚠️ **"Reshape" and "upgrade" are the game's words** (Reshaping; the badge counts
  enhancements). "Defined"/"made with Elixir": the game says _Define_; Nate chose "Made with
  Elixir" for the chip because players say "Elixir piece".
- ⚠️ **Assembled strings** — the level-up caption (`where_levelsubject_…`) is built from
  `levelSubject` ("your CR and CD" / "your stats") and `levelHasWord` ("both" / "it" / "all
  3" / "2 of them"); `vz_artifact_x_and_x` joins stat names with "and". A locale needs the whole
  sentence, ⛔ not the pieces.
- ⚠️ **Plurals:** "day/days", "upgrade/upgrades", the slot plural — `slotPlural` special-cases
  "sands" (its own plural). Every count wants ICU plurals.
- ⚠️ **Slot names are lowercased in code** (`slotWord = slot.name.toLowerCase()`) for "a
  flower". ⛔ That cannot survive translation (German nouns keep their capital) — a locale
  needs the slot names as their own messages in sentence position.

### `vz_artifact_drag_the_chart_or_use_the_slider_to_pick`

The Drop note. "180 a day" is Original Resin's natural regeneration (one per 8 minutes). The
Outbreak clause is the in-game Dire Prestige rule (20 per 20 resin; a bonus 5★ per 120).

### `vz_artifact_domain_in_100_players_would_have_this`

The Drop headline, "46 in 100 / players would have this piece after 7 days of farming the
domain". ⚓ A FREQUENCY, not a percentage — "N in 100" is the format readers parse best.

### `vz_artifact_about_1_in_every_perpiece_five_star`

⚠️ "five-star" spelled out on purpose (see the surface note). "the piece you want" includes
set, slot and main stat — ⛔ not just "the stats you want".

### `vz_artifact_x_day_x_is_x_resin_unlucky_tenth_1_in_10`

⚓ No run count (Nate): players spend 40 or Condensed (60) per claim, so "N runs" would have
to say which.

### `vz_artifact_half_by` · `vz_artifact_unlucky_tenth`

Shared with Wish Odds' level table — ⚓ keep the two instruments' translations identical.

### `vz_artifact_the_number_beside_each_substat_is_how`

The upgrade badge mirrors the number the game prints beside each line on its reshape
screen. Use the game's own term for that number in the locale if it has one.

### `vz_artifact_these_values_fit_two_possible_upgrade`

Tooltip on an AMBIGUOUS pip (a red-disc "!" on its corner): the displayed values fit two
upgrade counts, and tapping cycles them. "Tap" — it is a touch target too.

### `vz_artifact_these_values_add_up_to_x_upgrade_x_but_a`

"…but a +8–11 piece has only 1–2. Recheck your values, or pick +16–19 or +20." The level
ranges (+0–3 … +20) are chip labels; the second sentence drops to "Recheck your values." when
no level fits.

### `vz_artifact_your_two_selected_substats_are`

Dust costs are the game's: 1 for a flower or plume, 2 otherwise; 6 Dust = 1 Advanced; the
third Advanced in a row is Decreed.

### `vz_artifact_gold_shows_your_piece_after_a_label` · `vz_artifact_grey_shows_every_20_slotword_with_these`

⚓ The two colours explained (Nate asked what "every piece like it" meant): grey = every +20
piece of this slot with these four substats, levelled with fresh luck — the crowd the "Better
than N%" headline ranks against; gold = YOUR piece reshaped. Keep both halves.

### `vz_artifact_useful_rolls_count_every_roll_in_your`

The unit's definition — see the surface note on "useful rolls".
