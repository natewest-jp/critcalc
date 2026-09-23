# Worksheet — ICD Timeline

⚠️ **Read `visualizers-instruments-00-conventions.md` first** — §A casing, §C colons, §E
readout.

**Strings:** 28 · `IcdInstrument.svelte`

---

## Controls

| key                    | Where              | Now                     | New           |
| ---------------------- | ------------------ | ----------------------- | ------------- |
| `vz.icd.string`        | Section heading    | Attack String           | Attack string |
| `vz.icd.interval`      | Slider label       | Hit Interval            | Hit interval  |
| `vz.icd.interval.aria` | Its field          | Hit interval in seconds |               |
| `vz.icd.hits`          | Slider label       | Hits                    |               |
| `vz.icd.hits.aria`     | Its field          | Number of hits          |               |
| `vz.icd.rule`          | Section heading    | ICD Rule                | ICD rule      |
| `vz.icd.rule.std`      | Option             | Standard                |               |
| `vz.icd.rule.none`     | Option             | No ICD                  |               |
| `vz.icd.rule.custom`   | Option             | Custom                  |               |
| `vz.icd.timer`         | Custom field label | Timer                   |               |
| `vz.icd.timer.aria`    | Its field          | ICD timer in seconds    |               |
| `vz.icd.counter`       | Custom field label | Hit Counter             | Hit counter   |
| `vz.icd.counter.aria`  | Its field          | ICD hit counter         |               |
| `vz.icd.element`       | Section heading    | Element                 | 🔒            |
| `vz.icd.send`          | Hand-off button    | Send to Gauge Explorer  |               |

✅ **§A applied** to the four Title Case labels.
⚠️ **"Send to Gauge Explorer"** names another instrument (style guide §3.3) — when the
instrument names translate, this must move with it.

## The explanations — the best prose on the shelf

| key                     | Now                                                                                 | New        |
| ----------------------- | ----------------------------------------------------------------------------------- | ---------- |
| `vz.icd.rule.desc`      | Internal Cooldown — the hidden rule that stops every hit from applying its element. |            |
| `vz.icd.rule.std.desc`  | 2.5s timer · every 3rd hit                                                          | 🔒 formula |
| `vz.icd.rule.none.desc` | Every hit applies its element                                                       |            |
| `vz.icd.element.note`   | Presentation only — ICD rules are element-agnostic                                  |            |

⚓ **"the hidden rule that stops every hit from applying its element" is the single best
one-line definition on the site.** It expands the acronym _and_ says why anyone should
care, in fourteen words. ⛔ Protect it.
⚠️ **"ICD" is 🔒 frozen; "Internal Cooldown" is its expansion and translates** — this is
the 🏷 pattern working exactly as intended, and it is worth copying elsewhere.
⚠️ "element-agnostic" is engineering register in an otherwise plain sentence.

## Chart legend

| key                     | Now                 | New |
| ----------------------- | ------------------- | --- |
| `vz.icd.chart.aria`     | ICD hit timeline    |     |
| `vz.icd.legend.applies` | applies element     |     |
| `vz.icd.legend.blocked` | blocked hit         |     |
| `vz.icd.legend.counter` | 1 2 3 = hit counter |     |
| `vz.icd.legend.window`  | ICD timer window    |     |

⚠️ **The legend is lowercase and the section headings are Title Case** — the two casings
sit a few pixels apart in the same tile (§A).
↻ With §A applied the headings are sentence case, so the clash shrinks to the initial
capital. ⚓ Chart furniture across the shelf is lowercase (`damage kept`, `pulls from now`,
`best split of this budget`), so the legend is left as it is.
⚠️ **"1 2 3 = hit counter"** carries the digits as content. 🔒 The digits stay; the phrase
translates.

## Readout

| key                      | Now                          | New              |
| ------------------------ | ---------------------------- | ---------------- |
| `vz.icd.readout`         | Readout                      | ✅ §E            |
| `vz.icd.readout.applied` | {n} of {n} hits apply        |                  |
| `vz.icd.readout.rate`    | Application rate:            | Application rate |
| `vz.icd.readout.per`     | One application per {n} hits |                  |

⚠️⚠️ **ASSEMBLED, all three** — `of {n} hits apply` and `One application per` + `{n}` +
`hits` are sentence stems split around their numbers. ⚓ Both need ICU plurals: **"1
hits"** is reachable in each.
