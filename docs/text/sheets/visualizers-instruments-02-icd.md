# Worksheet — ICD Timeline

> ✅ **CLOSED + APPLIED 2026-10-04** (the ICD Timeline pass, `docs/icd-timeline-pass-2026-10-04.md`).
> ⛔ SUPERSEDED — the rulings a translator needs now live in
> `docs/text/ledger/notes/vz_icd.md`, keyed to the generated inventory. Kept for history;
> ⚠️ the Element panel, the legend in the SVG and the three Readout lines it describes are
> gone (the swatches moved into the chart's key; the rate became a per-window count).

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

| key                     | Now                                                                                 | New                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `vz.icd.rule.desc`      | Internal Cooldown — the hidden rule that stops every hit from applying its element. | Internal Cooldown — the hidden rule that stops some hits from applying their element. |
| `vz.icd.rule.std.desc`  | 2.5s timer · every 3rd hit                                                          | 🔒 formula                                                                            |
| `vz.icd.rule.none.desc` | Every hit applies its element                                                       |                                                                                       |
| `vz.icd.element.note`   | Presentation only — ICD rules are element-agnostic                                  | Display only — ICD works the same for every element                                   |

⚓ **"the hidden rule that stops every hit from applying its element" is the single best
one-line definition on the site.** It expands the acronym _and_ says why anyone should
care, in fourteen words. ⛔ Protect it. → N: Except maybe change it to "some hits" and "their" element?
⚠️ **"ICD" is 🔒 frozen; "Internal Cooldown" is its expansion and translates** — this is
the 🏷 pattern working exactly as intended, and it is worth copying elsewhere.
⚠️ "element-agnostic" is engineering register in an otherwise plain sentence. → N: What do you think about my new wording?
→ C: Better — but "Presentation only" is the same register and is half the note's job (the
picker changes the color of the pips, nothing else). And "affects all elements equally"
can be read as being about gauge size. Suggest: **"Color only — ICD works the same for
every element."** Your "some hits… their element" is a real fix, not a taste call: "stops
every hit" was false, and this sheet praised it anyway. → N: Good suggestion. I'll take it, and just change Color to Display. Good?

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

---

## Added 2026-09-27 — missed by the first extraction

☑ **Read by Nate 2026-09-27** — blank `New:` rows below are approvals. ~~Until this box
is ticked, a blank `New:` in this section is not an approval.~~ These rows come from a parser-based re-run; the first pass skipped strings
inside script object literals and some attributes. Keys are left to the extraction pass.

| Where                      | Context                                   | Now                                                           | New                                                                                                     |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `IcdInstrument.svelte:21`  | Preset chip under the Hit interval slider | ~0.45s typical string                                         | ~0.45s normal attacks                                                                                   |
| `IcdInstrument.svelte:22`  | Preset chip                               | ~1s off-field ticks                                           |                                                                                                         |
| `IcdInstrument.svelte:23`  | Preset chip                               | ~2s burst ticks                                               | ~2s off-field ticks                                                                                     |
| `IcdInstrument.svelte:354` | Tooltip on "Send to Gauge Explorer"       | Each application arrives as 1U — ICD doesn't know gauge sizes | Sends the hits that apply an element — each as 1U, since this ICD Timeline doesn't specify gauge sizes. |

⚓ **What the corpus says about the three presets** (measured 2026-09-27, `src/lib/data/characters/`):

- **~0.45s:** the median swing-to-swing gap across 119 normal-attack strings is **0.475s**
  (middle half 0.43–0.53s), so the value is fair but ~0.5s is the honest round number. The
  instrument's **default is 0.5s**, so a 0.5s chip would be lit on load. ⚠️ Changing the
  value is a code change, not a text one. "Typical string" could simply be "normal attacks".
- **~1s:** well founded, with a famous example: Fischl's **Oz** ticks every 0.983s. Mona,
  Lynette, Citlali, Jean, Bennett's field, Yaoyao and Xingqiu's Rain Swords are all ~1s.
- **~2s:** the interval is real, the **label is not** — Zhongli's stele and Kokomi's
  jellyfish tick at 2s and are **Skills**; Diona, Rosaria and Mavuika's are Bursts.
  "~2s summon ticks" would be accurate. ⚠️ **1.5s is actually the most common interval**
  (9 characters: Gorou, Kuki, Layla, Sayu, Xilonen, Mizuki…).
- ⚓ **Whatever the labels become, keep the spread.** Under standard ICD the three chips
  show the rule's three cases: at 0.45s the **hit counter** decides (every 3rd applies), at
  1s the counter and the 2.5s timer **agree** (1 in 3), at 2s the **timer** decides (1 in
  2). (Worked by hand, not through the simulator.)
- ⚠️ The chips are **tight** — a row of three under a slider.
