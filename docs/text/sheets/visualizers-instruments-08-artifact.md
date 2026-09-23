# Worksheet — Artifact Rolls

⚠️ **Read `visualizers-instruments-00-conventions.md` first** — §A casing, §C colons,
§H `5★`.

**Strings:** 62 · `ArtifactInstrument.svelte` · `artifactRolls.ts`

⚓ **The largest instrument, and the one with the most frozen content.** Almost all of
`artifactRolls.ts` is game vocabulary that genshin-db ships per locale; the work here is
in the four modes' prose.

---

## 1. 🔒 Frozen — the whole game vocabulary

⛔ **Never hand-translate any of these.** They are listed so extraction marks them, not so
they get rewritten.

- **Stats:** HP · ATK · DEF · HP% · ATK% · DEF% · Energy Recharge · Elemental Mastery ·
  CRIT Rate · CRIT DMG · Elemental DMG · Physical DMG · Healing Bonus
- **Slots:** Flower · Plume · Sands · Goblet · Circlet
- **Sources:** Domain · Boss / Strongbox · Sanctifying Elixir
- **Items:** Dust of Enlightenment
- **Reshape tiers:** Standard ≥2 · Advanced ≥3 · Decreed ≥4

`artifactRolls.ts:56–236` · `ArtifactInstrument.svelte:828,835,842`

⚠️ **"Boss / Strongbox" uses a spaced slash** (fifth on the site) — but it is joining two
game nouns, so the separator is ours even though the nouns are not.
⚠️ **The reshape tiers pair a frozen name with a frozen operator** (`≥2`). The tier names
are the game's; the `≥` is mathematics. Neither translates.

## 2. The four modes

| key                       | Where                            | Now                                                           | New           |
| ------------------------- | -------------------------------- | ------------------------------------------------------------- | ------------- |
| `vz.ar.fresh`             | Tab                              | Fresh Drop                                                    | Fresh drop    |
| `vz.ar.upgrade`           | Tab                              | Upgrade Rolls                                                 | Upgrade rolls |
| `vz.ar.appraise`          | Tab                              | Appraise                                                      |               |
| `vz.ar.reshape`           | Tab                              | Reshape                                                       |               |
| `vz.ar.fresh.hint`        | Under the tab                    | Pick two target substats below.                               |               |
| `vz.ar.appraise.hint`     | Under the tab                    | Dial in your piece's four substat values below.               |               |
| `vz.ar.appraise.mismatch` | When the pair isn't on the piece | Neither target substat is on this piece — pick a pair it has. |               |

✅ **§A applied** to the tabs. ⚠️ Renaming a mode tab moves the two places the prose names
it (`vz.ar.elixir.desc`, `vz.ar.readout.guarantee`), both pre-filled with **Upgrade rolls**,
bold per style guide §3.3.
⚠️ **"Reshape" is ours** — the game calls it the **Sanctifying Elixir** / Dust of
Enlightenment process and has no single verb for it. 🏷 Label translates; it needs a
context note saying what in-game action it names.
⚠️ **"Dial in"** is idiom. ⚠️ **"Appraise"** is ours too and is a good word — it says
_measure what you already have_ rather than _simulate_.

## 3. Piece configuration

| key                 | Where           | Now                                                                                    | New         |
| ------------------- | --------------- | -------------------------------------------------------------------------------------- | ----------- |
| `vz.ar.piece`       | Section heading | Piece                                                                                  |             |
| `vz.ar.pair`        | Section heading | Target Pair                                                                            | Target pair |
| `vz.ar.pair.hint`   | Under it        | Two substats — reshaping selects exactly two, so the whole instrument thinks in pairs. |             |
| `vz.ar.substat`     | Per-row label   | Substat {i + 1}                                                                        |             |
| `vz.ar.rounding`    | Note            | Rounding makes two roll totals possible — pick the true start.                         |             |
| `vz.ar.start4`      | Option          | 4-line start                                                                           |             |
| `vz.ar.start3`      | Option          | 3-line start                                                                           |             |
| `vz.ar.farmed`      | Source option   | Farmed                                                                                 |             |
| `vz.ar.elixir`      | Source option   | Elixir-crafted                                                                         |             |
| `vz.ar.inpair`      | Slider label    | Current rolls in pair                                                                  |             |
| `vz.ar.inpair.aria` | Its field       | Current rolls into the target pair                                                     |             |

⚠️ **"the whole instrument thinks in pairs"** attributes thought to the tool. ⚓ It is
charming and it is clear; flagging it only because it is the one place the UI personifies
itself.
🐛 **"Current rolls in pair" (label) vs "Current rolls into the target pair" (its
screen-reader name)** — "in" vs "into the target". Same control, two prepositions.
⚠️ **"4-line start" / "3-line start"** — "line" is community vocabulary for a substat
row. 🏷.

## 4. Explanations

| key                      | Now                                                                                                                                                                                                          | New                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vz.ar.elixir.desc`      | Crafted pieces skip the draw — the main stat and both target substats are chosen at crafting. The Elixir's real story is in Upgrade Rolls: since 5.5, at least 2 rolls are guaranteed into your chosen pair. | Crafted pieces skip the draw — the main stat and both target substats are chosen at crafting. The Elixir's real story is in **Upgrade rolls**: since 5.5, at least 2 rolls are guaranteed into your chosen pair. |
| `vz.ar.elixir.guarantee` | Sanctifying Elixir (5.5+): your two crafted substats are guaranteed at least {n} of the {n} rolls.                                                                                                           |                                                                                                                                                                                                                  |
| `vz.ar.reshape.caveat`   | Compared by roll count only: reshaping also rerolls each roll's strength (the 70–100% tiers), which isn't part of this comparison.                                                                           |                                                                                                                                                                                                                  |
| `vz.ar.reshape.pity`     | Pity: Advanced at 6 Dust of Enlightenment; Decreed on the 3rd consecutive Advanced. You keep the better of original and reshaped.                                                                            |                                                                                                                                                                                                                  |

⚓ **The reshape caveat states what the instrument does _not_ compare**, which is the
honest half and easy to lose in a trim. ⛔ Keep it.
⚠️ **"The Elixir's real story is in Upgrade Rolls"** names another _mode_ of this same
instrument (style guide §3.3).
⚠️ **"5.5" and "5.5+" are patch versions** — 🔒 frozen, but they should be values rather
than copy, or every patch reference ages in six locales at once.
⚠️ **"the 70–100% tiers"** is 🏷 community vocabulary for roll strength.

## 5. Chart and readout

| key                         | Where                | Now                                               | New                                           |
| --------------------------- | -------------------- | ------------------------------------------------- | --------------------------------------------- |
| `vz.ar.chart.cv`            | Chart title          | Crit value distribution at +20                    |                                               |
| `vz.ar.chart.rolls`         | Chart title          | Distribution of rolls into the target pair        |                                               |
| `vz.ar.chart.percentile`    | Marker on your piece | your piece · p{n}                                 |                                               |
| `vz.ar.chart.appraise.aria` | The appraise chart   | Where this piece sits on its outcome distribution |                                               |
| `vz.ar.chart.current`       | Marker               | current                                           |                                               |
| `vz.ar.readout`             | Section heading      | Readout                                           | ✅ §E                                         |
| `vz.ar.readout.pick`        | Empty state          | Pick two target substats.                         |                                               |
| `vz.ar.readout.pct`         | Readout line         | {n}% of pieces with these lines                   |                                               |
| `vz.ar.readout.rolls`       | Readout line         | Rolls into {pair}:                                | Rolls into {pair}                             |
| `vz.ar.readout.lineset`     | Readout line         | This line set at drop:                            | This line set at drop                         |
| `vz.ar.readout.odds`        | Readout line         | 1 in {n}                                          |                                               |
| `vz.ar.readout.invalid`     | Readout line         | Enter a complete, valid piece to appraise it.     |                                               |
| `vz.ar.readout.craft`       | Readout line         | both chosen at craft                              |                                               |
| `vz.ar.readout.guarantee`   | Readout line         | The pair guarantee lives in Upgrade Rolls         | The pair guarantee lives in **Upgrade rolls** |
| `vz.ar.readout.atdrop`      | Readout line         | at drop                                           |                                               |
| `vz.ar.readout.once4`       | Readout line         | Once 4 lines exist:                               | Once 4 lines exist                            |
| `vz.ar.readout.withmain`    | Readout line         | With {main} main:                                 | With {main} main                              |
| `vz.ar.readout.median`      | Readout line         | median CV at +20                                  |                                               |
| `vz.ar.readout.mean`        | Readout line         | Mean:                                             | Mean                                          |
| `vz.ar.readout.expected`    | Readout line         | expected rolls into {pair}                        |                                               |
| `vz.ar.readout.p3`          | Readout line         | P(≥3 rolls):                                      | P(≥3 rolls)                                   |
| `vz.ar.readout.upgrade`     | Readout line         | upgrade rolls                                     |                                               |

✅ **§A / §C / §E applied.** The rows from `readout.pct` down were missing their `Where`
column (the string sat in it); they're repaired. ⚠️ Removing the colons doesn't touch the
assembly problem below.
⚠️⚠️ **This readout is the most heavily assembled block on the site** — more than twenty
fragments, most of them a label, a number and a unit assembled in three pieces, several
with parentheses opened in one fragment and closed in another (`(P(≥{n}):`). ⚓ It is also
the block where the _order_ of label and value is most likely to invert in translation.
⛔ This one genuinely needs restructuring before extraction, not just re-keying.
⚠️ **`p{n}` for a percentile and `1 in {n}` for odds** are two numeric idioms in one
panel. Both are English conventions — `1 in 8` is `8分の1` in Japanese, which inverts the
order entirely.
⚠️ **`P(≥3 rolls)`** embeds an English word inside mathematical notation (§I's case).
⚠️ **"lines" appears as "these lines" and "4 lines"** — the community term again (§3).
