# Notes — `vz_defres` (Enemy RES & DEF)

Hand-written half of the ledger for `../inventory/vz_defres.md`. Written at the close of the
DEF & RES pass (2026-10-06, `docs/rounds/defres-pass-2026-10-06.md`); the rulings come from worksheet
05 + the conventions sheet (both superseded) and from that pass, where Nate approved every
explainer line by line.

## The surface

Two charts STACKED — the RES multiplier against the enemy's RES, the DEF multiplier against
the enemy's level — each with a one-line caption beneath it; three glass panels (Your hit ·
Enemy · Shred) and one paper Readout. `.kicker`, `.slider-label` and every chip are uppercased
by CSS — write them sentence case. ⚓ The instrument was **Enemy DEF & RES** until 2026-10-06;
it was renamed so the name reads in the instrument's own order (RES first everywhere). The
internal id stays `defres`.

- ⚓⚓ **Shred is described by STRENGTH, never in "points"** (⚓ Nate 2026-10-06): "shred works
  at half strength" below 0% RES, "full strength" from 0% to 75%, "less than full strength"
  above 75%. The game only ever says "decreases RES by X%"; points are the arithmetic, not
  the player's view. A locale should keep the strength metaphor, ⛔ not "percentage points".
- ⚓ **Transformative, Lunar and Stellar reactions ignore DEF** — all three, always named
  together. Stellar was added in the pass (Fandom's Stellar-Conduct formula has no DEF term;
  gcsim sets `IgnoreDefPercent: 1` on every Stellar-Conduct and Stellar Swirl hit).
- 🔒 **Frozen (game vocabulary):** RES · DEF · the seven elements + Physical · Transformative ·
  Lunar · Stellar · Skill DMG · constellation badges `C1`–`C6` · character names and artifact
  set names (rendered from data — a LOOKUP, not a message).
- 🏷 **Community vocabulary, kept:** RES shred · DEF shred · DEF ignore (glossary; sentence
  case — the `RES`/`DEF` capitals are frozen, the rest is not).
- ⚓ **Screen-reader names EXPAND the abbreviations** while the visible labels keep them
  ("Other resistance shred percent", "Enemy base resistance percent"). That split is
  deliberate (worksheet 05) — the extractor's `off-glossary` flag on
  `vz_defres_other_resistance_shred_percent` is expected, ⛔ not a fix to make.
- ⚠️ **"Defense" is US English** (glossary §4) and stays.

### `vz_defres_most_enemies_resist_10_shred_subtracts`

The RES chart's caption. "Most enemies resist 10%" is the game's common base RES. "At half the
rate" = below 0%, the multiplier is `1 − res/2`.

### `vz_defres_equal_levels_already_cost_you_half_your`

The DEF chart's caption. ⚓ "Equal levels already cost you half" is the fact that surprises
people, and it LEADS (worksheet 05): at Lv 90 vs Lv 90 the multiplier is 190 / (190 + 190) =
×0.5. "Multiply together" — shred and ignore act as `(1 − shred)(1 − ignore)` on the enemy's
DEF term. "Win it back" is idiom; translate the meaning.

### `vz_defres_below_0_shred_counts_half`

The label at the chart's 0% line. ⚓ Nate kept "counts half" here (a chart label, short) while
the readout says "half strength"; both mean one point of shred moves the multiplier half a
point.

### `vz_defres_immune_this_element_deals_no_damage`

The RES chart's message when the enemy is immune. Immunity is ×0 — ⛔ no shred lowers it.

### `vz_defres_total_of_your_hit_s_damage_gets_through`

The Readout headline: a multiplier (`×0.450`) followed by the phrase. ⚠️ ASSEMBLED — the
number leads in English; a locale may need it elsewhere.

### `vz_defres_at_finalres_res_resshred_baseres_before`

The RES row: "×0.900 at 10% RES (50% before shred)". ⚠️ ASSEMBLED — the parenthesis appears
only when shred is picked; a locale needs both whole forms, ⛔ not a fragment.

### `vz_defres_lv_charlevel_vs_lv_enemylevel_defshred`

The DEF row: "Lv 90 vs Lv 100 · −30% DEF · 60% ignored". ⚠️ ASSEMBLED from up to three parts
joined by " · "; each optional part is its own message below it in the inventory.

### `vz_defres_your_shred_and_def_ignore_add_x_damage`

"Your shred and DEF ignore add 12.3% damage against this enemy" — the gain over the same hit
with nothing picked. ⚠️ The number sits mid-sentence. "Shred" here covers RES and DEF shred.

### `vz_defres_above_75_res_shred_works_at_less_than`

Above 75% RES the multiplier is `1/(4·res + 1)`, so each point of shred is worth less — until
RES drops back under 75%, where the full-strength line takes over.

### `vz_defres_own_skill_dmg_only`

Who a DEF ignore applies to, beside its source: "own hits" (Raiden C2 — every hit she makes in
Musou Isshin), "whole party", "own Skill DMG only" (Yae C6 — the Sesshou Sakura ticks).

### `vz_defres_no_character_or_set_in_the_data_shreds`

Only the RES list can be empty (DEF shred and ignore are element-free). "In the data" — the
sources are derived from the characters and sets the site models.

### `vz_defres_res_0_1_res_2_0_75_1_res_75_1_4_res_1`

🔒 A formula (conventions §I). ⚠️⚠️ It embeds English words (`res`) — ⛔ a translator must
not localize them; the surrounding prose defines them. Same for
`vz_defres_100_yours_100_yours_100_enemy_1_shred_1` (`yours`, `enemy`, `shred`, `ignore`).
