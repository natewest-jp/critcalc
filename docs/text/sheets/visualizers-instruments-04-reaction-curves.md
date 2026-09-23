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
