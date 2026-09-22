# Worksheet — Wish Odds

⚠️ **Read `visualizers-instruments-00-conventions.md` first** — §A casing, §C colons,
§H `5★` vs `five-star`, §J (withdrawn — `modeled` is correct).

**Strings:** 24 · `WishInstrument.svelte`

⚓ **This is the instrument closest to the constitution's edge.** It is about spending
money and it refuses to advise — "Odds only — no verdicts on whether to pull." Every
wording change here should be checked against that line.

---

## Controls

| key                     | Where           | Now                             | New   |
| ----------------------- | --------------- | ------------------------------- | ----- |
| `vz.wish.banner`        | Section heading | Banner                          | 🔒    |
| `vz.wish.banner.char`   | Option          | Character Event                 | 🔒    |
| `vz.wish.banner.weapon` | Option          | Weapon Event                    | 🔒    |
| `vz.wish.state`         | Section heading | Your State                      |       |
| `vz.wish.pity`          | Slider label    | Current Pity                    | 🏷    |
| `vz.wish.pity.aria`     | Its field       | Pulls since your last five-star | 🐛 §H |
| `vz.wish.saved`         | Slider label    | Pulls Saved                     |       |
| `vz.wish.saved.aria`    | Its field       | Pulls you have saved            |       |

⚠️ **"Character Event" / "Weapon Event"** are the game's banner names (abbreviated —
the game says "Character Event Wish"). 🔒 genshin-db ships them.
⚠️ **"Pity" is 🏷** — it is community vocabulary the game does not use, but every player
knows it and no locale translates it the same way. Label frozen, explanation translates.
⚠️ **"soft pity"** (chart annotation) likewise.

## The banner explanations

| key                   | Now                                                                                                                                                                     | New |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `vz.wish.char.desc`   | A non-guaranteed 5★ is the featured character 55% of the time (the official consolidated rate, Capturing Radiance included) — losing makes the next one certain.        |     |
| `vz.wish.radiance`    | The Radiance streak counter isn't fully datamined, so it isn't modeled — but officially you can never lose the "50/50" four times in a row.                             | ✅  |
| `vz.wish.weapon.desc` | A non-guaranteed 5★ is YOUR charted weapon 37.5% of the time (75% featured pair, split two ways). One fate point: miss once and the next 5★ is it — worst case two 5★s. |     |

- ✅ **`modeled` is CORRECT and stays** — ↻ US English is the house style (glossary §4),
  so the earlier "fix it to `modelled`" was backwards and is withdrawn.
- 🐛 **`YOUR` in caps** — ✅ §F is ruled: caps are never emphasis, site-wide.
- ⚓ **"isn't fully datamined, so it isn't modeled" is the site's honesty rule applied to
  a number people care about a lot** — ⚓ the _job_ is worth keeping (README); the words
  are yours.
- ⚠️ **"Capturing Radiance", "fate point", "50/50" are 🔒 frozen** — the first is official,
  the last two are community terms the game does not name. ⚠️ `"50/50"` carries its own
  quotes inside the string.
- ⚠️ **`5★s`** — a pluralized glyph. ⚓ It works in English and is meaningless elsewhere;
  worth a rephrase that does not pluralize a symbol.

## Readout

| key                       | Now                                                                                     | New   |
| ------------------------- | --------------------------------------------------------------------------------------- | ----- |
| `vz.wish.readout`         | Readout                                                                                 | §E    |
| `vz.wish.readout.chance`  | {n}% chance within your {n} pulls                                                       |       |
| `vz.wish.readout.half`    | Half of players land it by {n} pulls                                                    |       |
| `vz.wish.readout.unlucky` | The unlucky tenth needs {n} pulls                                                       |       |
| `vz.wish.readout.avg`     | Average cost:                                                                           | §C    |
| `vz.wish.chart.aria`      | Distribution of which pull lands the featured five-star                                 | 🐛 §H |
| `vz.wish.chart.from`      | pulls from now                                                                          |       |
| `vz.wish.chart.by`        | chance by then                                                                          |       |
| `vz.wish.caveat`          | Odds only — no verdicts on whether to pull. Drag on the chart to move your pull budget. |       |

⚓ **"The unlucky tenth" is a lovely way to say the 90th percentile** and it avoids a
statistics term without losing the meaning. ⛔ Keep it. ⚠️ It will need a context note —
a translator cannot recover "10th percentile of luck" from those three words.
⚠️⚠️ **ASSEMBLED** — all four readout lines are stems around numbers, and three need
plurals ("1 pulls").
↻🐛 **REVERSED.** This used to read: _"'Odds only — no verdicts on whether to pull' is the
constitution stated on the surface where it matters most. ⛔ Never soften it."_ ⛔
**Withdrawn — it is a creed instance** (style guide §1.3), and one of the ten.
⚓ **What is real here is the restraint, not the sentence announcing it.** This instrument
is about spending money and it declines to advise — ⚓ that shows in the fact that no
recommendation appears anywhere on it, which the reader can see. ⛔ Saying so out loud
also trips §1.3c.
⚓ **"Drag on the chart to move your pull budget" is the half worth keeping** — it is
instruction, which is explicitly welcome.
