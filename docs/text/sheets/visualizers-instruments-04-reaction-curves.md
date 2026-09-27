# Worksheet — Reaction Curves

⚠️ **Read `visualizers-instruments-00-conventions.md` first** — §A casing, §C colons,
§I formulas.

**Strings:** 12 · `ReactionCurvesInstrument.svelte`

The smallest instrument sheet, and the one with the least wrong with it.

---

| key                  | Where           | Now                                          | New             |
| -------------------- | --------------- | -------------------------------------------- | --------------- |
| `vz.rc.chart.aria`   | The chart       | Reaction scaling curves vs Elemental Mastery |                 |
| `vz.rc.axis.em`      | X axis          | Elemental Mastery                            | 🔒              |
| `vz.rc.family`       | Section heading | Reaction Family                              | Reaction family |
| `vz.rc.build`        | Section heading | Build                                        |                 |
| `vz.rc.em`           | Slider label    | Elemental Mastery                            | 🔒              |
| `vz.rc.em.aria`      | Its field       | Elemental Mastery                            | 🔒              |
| `vz.rc.level`        | Slider label    | Level                                        |                 |
| `vz.rc.level.aria`   | Its field       | Character level                              |                 |
| `vz.rc.readout`      | Section heading | Readout                                      | ✅ §E           |
| `vz.rc.readout.gain` | Readout line    | next +{n} EM: {value}                        | next +{n} EM    |

✅ **Conventions applied:** §A (`Reaction family`), §C (the gain line's colon). The
`readout.gain` row was missing a column and is repaired.
⚠️ **"Elemental Mastery" appears three times** — axis, slider label, and the slider's
screen-reader name. ⚓ Same meaning → **one key** (style guide §3.2), which is also what
keeps the axis and the control from drifting apart in a locale.
⚠️ **"Reaction Family" is ours** and is doing precise work — it groups amplifying /
transformative / additive / crystallize, which is a theorycrafting taxonomy, not a game
one. 🏷 It needs a context note.

## The two notes

| key                | Now                                                                                                          | New |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | --- |
| `vz.rc.level.note` | Amplifying reactions ignore level — the multiplier rides the hit, which already scales with everything else. |     |
| `vz.rc.caveat`     | Before enemy RES; +% reaction bonuses (4pc Crimson Witch, Nahida A4, …) not included.                        |     |

⚓ **"the multiplier rides the hit" is the whole reason amplifying reactions behave
differently**, said in five words. ⛔ Keep it.
⚠️ **The caveat is a fragment, not a sentence** — it opens with a preposition ("Before
enemy RES;") and has no verb until the final clause. It reads fine as chart furniture and
is genuinely hard to translate as written.
⚠️ **"4pc Crimson Witch" and "Nahida A4" are 🔒 frozen** (artifact set name, character +
talent shorthand). ⚠️ `A4` is community shorthand for a fourth-ascension passive and is
🏷 — frozen as a token, but a translator needs to know it is not a typo.
⚠️ The `…` is the single character, correctly (style guide §2).

---

## Added 2026-09-27 — missed by the first extraction

☐ **Not yet read.** ⚠️ Until this box is ticked, a blank `New:` in this section is **not**
an approval. These rows come from a parser-based re-run; the first pass skipped strings
inside script object literals and some attributes. Keys are left to the extraction pass.

⚠️ **This sheet was the "least wrong" one because half of it was missing:** the four
families' chips, notes, y-axis labels and curve legends all live in one object literal
(`ReactionCurvesInstrument.svelte:25–130`).

### The four families

| Family (chip)  | Note                                                                                                                                            | Y axis         | New |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --- |
| Amplifying     | Vaporize and Melt multiply the whole hit — more EM pushes the multiplier higher with diminishing returns, and character level plays no part.    | hit multiplier |     |
| Transformative | Fixed damage from your level and EM only — crit, ATK, and DMG% do nothing. Every reaction rides the same curve with its own multiplier.         | damage         |     |
| Additive       | Spread and Aggravate ADD a flat chunk of damage to the triggering hit — the chunk then crits and scales with DMG% like the rest of the hit.     | flat DMG added |     |
| Crystallize 🔒 | Crystallize shards grant a shield that grows with the triggering character's level and EM — on its own level table, higher than the damage one. | shield HP      |     |

🐛 **"ADD" is capitals as emphasis** — R4, absolute. A fourth live site; the round record
counted three.
⚠️ **"Amplifying / Transformative / Additive" are the community's taxonomy** — 🏷 the same
ruling as "Reaction family" above.
⚠️ **The Amplifying note and `vz.rc.level.note` say the same thing twice** ("character
level plays no part" / "Amplifying reactions ignore level"), and both show when Amplifying
is picked. One can go.
⚠️ **"from your level and EM only"** — the reader's level, but it means the character's.

### The curve legends

| Curve           | Detail                               | New                         |
| --------------- | ------------------------------------ | --------------------------- |
| Forward ×2      | Hydro→Pyro Vaporize · Pyro→Cryo Melt |                             |
| Reverse ×1.5    | Pyro→Hydro Vaporize · Cryo→Pyro Melt |                             |
| ×3              | Hyperbloom · Burgeon · Shatter       | 🔒                          |
| ×2.75           | Overload                             | Overloaded — ⚓ glossary §2 |
| ×2              | Electro-Charged (per tick) · Bloom   |                             |
| ×1.5            | Superconduct                         | 🔒                          |
| ×0.6            | Swirl                                | 🔒                          |
| ×0.25           | Burning (per tick)                   |                             |
| Spread ×1.25    | Dendro hit on Quicken                |                             |
| Aggravate ×1.15 | Electro hit on Quicken               |                             |
| Shield          | before the 150% same-element bonus   |                             |

⚠️ **`Hydro→Pyro` typesets an arrow** — `→` is on the mark sweep's banned list
(`e2e/marks.spec.ts`), and the Gauge Explorer's log dropped it for that reason; the sweep
evidently never reaches this legend. "Hydro on Pyro" is how the Gauge Explorer's scenario
notes say it.
⚠️ **"Forward / Reverse"** is our wording; the Gauge Explorer says "strong / weak
direction" for the same pair. Worth one pair of words.
