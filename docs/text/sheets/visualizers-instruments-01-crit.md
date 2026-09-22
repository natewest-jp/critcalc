# Worksheet — Crit Heatmap

⚠️ **Read `visualizers-instruments-00-conventions.md` first** — casing (§A), crit stat
names (§B), colons (§C), axis labels (§D), `x` vs `×` (§G) are decided there and are not
repeated per row here.

**Strings:** 33 · `CritInstrument.svelte` · `CritHeatmap.svelte`

---

## Controls

| key                      | Where          | Now                                      | New    |
| ------------------------ | -------------- | ---------------------------------------- | ------ |
| `vz.crit.cr`             | Slider label   | Crit Rate                                | see §B |
| `vz.crit.cr.aria`        | Its field      | Crit rate percent                        |        |
| `vz.crit.cr.slider.aria` | Its slider     | Crit rate                                |        |
| `vz.crit.cd`             | Slider label   | Crit Damage                              | see §B |
| `vz.crit.cd.aria`        | Its field      | Crit damage percent                      |        |
| `vz.crit.cd.slider.aria` | Its slider     | Crit damage                              |        |
| `vz.crit.cv.toggle`      | Overlay toggle | Equal-budget line (CV)                   |        |
| `vz.crit.risk.toggle`    | Overlay toggle | No-crit risk overlay                     |        |
| `vz.crit.risk.hint`      | Under it       | chance a whole rotation lands zero crits |        |
| `vz.crit.hits`           | Slider label   | Hits / Rotation                          |        |
| `vz.crit.roll`           | Button         | Roll {n} hits                            |        |
| `vz.crit.pin`            | Button         | Pin this build                           |        |
| `vz.crit.unpin`          | Button         | Clear pin                                |        |

⚠️ **"Hits / Rotation" uses a spaced slash** as a per-unit separator — third slash
convention on the site (see `team-builder.md` §3). ⚓ "Hits per rotation" is the prose
form and translates cleanly.
⚠️ **"Equal-budget line (CV)"** — `CV` is 🏷 (label frozen, explanation translates).
⚠️ **tight** — these sit in a tile that can be one of four across.

## Readout

| key                       | Now                                        | New        |
| ------------------------- | ------------------------------------------ | ---------- |
| `vz.crit.readout.title`   | Current Build                              |            |
| `vz.crit.readout.sub`     | your average hit, vs never critting        |            |
| `vz.crit.readout.cr`      | Crit Rate:                                 | §C         |
| `vz.crit.readout.cd`      | Crit Damage:                               | §C         |
| `vz.crit.readout.ratio`   | Ratio (CD:CR):                             | §C         |
| `vz.crit.readout.cv`      | Crit Value:                                | §C         |
| `vz.crit.readout.cv.hint` | CV = 2×Rate + DMG — your total crit budget | 🔒 formula |
| `vz.crit.readout.risk`    | No-crit risk ({n} hits):                   | §C         |
| `vz.crit.readout.pinned`  | Pinned:                                    | §C         |
| `vz.crit.readout.delta`   | Vs pinned:                                 | §C         |
| `vz.crit.roll.result`     | this time (average {n}x)                   | 🐛 §G      |

⚓ **"your average hit, vs never critting" is the sentence that makes the whole instrument
legible** — it names the baseline, which is the thing a reader otherwise has to guess.
⛔ Don't cut it.
⚠️ **ASSEMBLED**: `Roll {n} hits`, `this time (average {n}x)`, and every `Label:` + value
pair (§C).

## Chart furniture

| key                  | Now                               | New        |
| -------------------- | --------------------------------- | ---------- |
| `vz.crit.chart.aria` | Crit rate and crit damage heatmap |            |
| `vz.crit.axis.avg`   | AVERAGE DMG                       | §D         |
| `vz.crit.axis.cd`    | CRIT DMG                          | §D         |
| `vz.crit.axis.cr`    | CRIT RATE                         | §D         |
| `vz.crit.line.ratio` | CD = 2×CR                         | 🔒 formula |
| `vz.crit.line.best`  | best split of this budget         |            |
| `vz.crit.marker.cr`  | CR {n}%                           | 🔒 abbrev  |
| `vz.crit.marker.cd`  | CD {n}%                           | 🔒 abbrev  |

⚠️ **`CR` and `CD` appear as bare abbreviations on the markers** while the controls spell
them out. ⚓ Correct — the marker has no room — but it means the instrument teaches two
names for each stat, which is worth one deliberate look.
