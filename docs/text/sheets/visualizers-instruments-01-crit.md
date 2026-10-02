# Worksheet — Crit Heatmap

> ✅ **CLOSED + APPLIED 2026-10-02** (the Crit Heatmap pass, `docs/crit-heatmap-pass-2026-10-02.md`).
> ⛔ SUPERSEDED — every ruling below that a translator needs now lives in
> `docs/text/ledger/notes/vz_crit.md`, keyed to the generated inventory. Kept for history;
> ⚠️ its line numbers and several of its strings no longer exist (the pass rewrote the
> readout and added the one-rotation chart).

⚠️ **Read `visualizers-instruments-00-conventions.md` first** — casing (§A), crit stat
names (§B), colons (§C), axis labels (§D), `x` vs `×` (§G) are decided there and are not
repeated per row here.

**Strings:** 33 · `CritInstrument.svelte` · `CritHeatmap.svelte`

---

## Controls

| key                      | Where          | Now                                      | New               |
| ------------------------ | -------------- | ---------------------------------------- | ----------------- |
| `vz.crit.cr`             | Slider label   | Crit Rate                                | CRIT Rate         |
| `vz.crit.cr.aria`        | Its field      | Crit rate percent                        |                   |
| `vz.crit.cr.slider.aria` | Its slider     | Crit rate                                |                   |
| `vz.crit.cd`             | Slider label   | Crit Damage                              | CRIT DMG          |
| `vz.crit.cd.aria`        | Its field      | Crit damage percent                      |                   |
| `vz.crit.cd.slider.aria` | Its slider     | Crit damage                              |                   |
| `vz.crit.cv.toggle`      | Overlay toggle | Equal-budget line (CV)                   |                   |
| `vz.crit.risk.toggle`    | Overlay toggle | No-crit risk overlay                     |                   |
| `vz.crit.risk.hint`      | Under it       | chance a whole rotation lands zero crits |                   |
| `vz.crit.hits`           | Slider label   | Hits / Rotation                          | Hits per rotation |
| `vz.crit.roll`           | Button         | Roll {n} hits                            |                   |
| `vz.crit.pin`            | Button         | Pin this build                           |                   |
| `vz.crit.unpin`          | Button         | Clear pin                                |                   |

⚠️ **"Hits / Rotation" uses a spaced slash** as a per-unit separator — third slash
convention on the site (see `team-builder.md` §3). ⚓ "Hits per rotation" is the prose
form and translates cleanly. → N: Agreed - let's use per.
⚠️ **"Equal-budget line (CV)"** — `CV` is 🏷 (label frozen, explanation translates).
⚠️ **tight** — these sit in a tile that can be one of four across.
✅ **Conventions applied (2026-09-23):** §A casing, §B `CRIT Rate` / `CRIT DMG`. The
screen-reader names (`…aria` rows) deliberately keep `Crit rate` / `Crit damage` (§B's
carve-out). ✅ **`Hits per rotation`: ruled (⚓ Nate, 2026-09-23).** ⚓ A slash that
means _per_ is a RATE, not two nouns joined, so it's settled here and doesn't wait on
`team-builder.md` §3. That section now records the rule: a rate is written with _per_.

## Readout

| key                       | Now                                        | New                                                 |
| ------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `vz.crit.readout.title`   | Current Build                              | Current build                                       |
| `vz.crit.readout.value`   | {n}x (headline, 3 decimals)                | ×{n} (2 decimals)                                   |
| `vz.crit.readout.sub`     | your average hit, vs never critting        | Average DMG per hit. A hit that doesn't crit is ×1. |
| `vz.crit.readout.cr`      | Crit Rate:                                 | CRIT Rate                                           |
| `vz.crit.readout.cd`      | Crit Damage:                               | CRIT DMG                                            |
| `vz.crit.readout.ratio`   | Ratio (CD:CR):                             | Ratio (CD:CR)                                       |
| `vz.crit.readout.cv`      | Crit Value:                                | Crit value                                          |
| `vz.crit.readout.cv.hint` | CV = 2×Rate + DMG — your total crit budget | 🔒 formula                                          |
| `vz.crit.readout.risk`    | No-crit risk ({n} hits):                   | No-crit risk ({n} hits)                             |
| `vz.crit.readout.pinned`  | Pinned:                                    | Pinned                                              |
| `vz.crit.readout.delta`   | Vs pinned: +{n}x                           | {pct} average DMG vs pinned                         |
| `vz.crit.roll.result`     | this time (average {n}x)                   | this time (average ×{n})                            |

✅ **The headline, its tagline and "Vs pinned": ruled (⚓ Nate, 2026-09-23).**

- **What the number is:** `1 + CRIT Rate × CRIT DMG` (`averageDamageMultiplier`), your
  average DMG per hit counting crits, relative to a hit that doesn't crit. It's the same
  quantity the heatmap colours by and its right-edge `Average DMG` scale labels.
- **Why the old tagline failed** (Nate couldn't read it either): it never stated the
  comparison point (a non-crit hit = ×1), and it called the number "your average hit"
  while the chart beside it calls the same number "Average DMG".
- **The new tagline** reuses the chart's own label and gives the comparison point in the
  reader's terms. Once ×1 is a normal hit, ×1.72 reads as "72% more" without any maths.
  Two whole sentences, so it translates cleanly.
- **Headline:** `×1.72`. Prefix per §G, and two decimals because three looked like
  engineering. ⚠️ The same 2-decimal rule should reach the pin line and the roll result.
- **"Vs pinned" becomes one whole message with a relative percentage**,
  `{pct} average DMG vs pinned` (e.g. "+7% average DMG vs pinned"), no longer a
  `Label:` + value pair. ⚠️ **This changes the MATH, not just the words:** today
  `pinnedDelta` is `my − pinned`, an absolute difference of multipliers (`+0.123x`, and
  `+×0.12` with a prefix is unreadable). It becomes `my / pinned − 1`. Signed, since a
  worse build must read "−4%". ⚠️ Needs an ICU number format for the percentage, not a
  hand-built `+` like `CritInstrument.svelte:292` does now.
- The heatmap's isoline labels (`1.50x`, `CritHeatmap.svelte:504`) are already two
  decimals and only take the §G prefix (`×1.50`). The marker tooltip (`:744`) drops to two
  decimals, to match the headline it mirrors.
  ⚠️ **ASSEMBLED**: `Roll {n} hits`, `this time (average {n}x)`, and every `Label:` + value
  pair (§C).
  ✅ **Conventions applied:** §C colons out (the separator moves to one shared pattern),
  §G `×` as a prefix (see §G's note for the position call). ⚠️ The headline number and the
  pin lines (`{n}x` at `CritInstrument.svelte:255,267,288,292`) are bare numbers, not
  rows here. The same `×` fix reaches them in code, and so do two more sites the sheet
  missed: the isoline labels (`CritHeatmap.svelte:504`) and the marker tooltip (`:744`). ⚠️ `Crit value` follows the glossary's
  **crit value (CV)**, not §B, because it's community vocabulary.

## Chart furniture

| key                  | Now                               | New         |
| -------------------- | --------------------------------- | ----------- |
| `vz.crit.chart.aria` | Crit rate and crit damage heatmap |             |
| `vz.crit.axis.avg`   | AVERAGE DMG                       | Average DMG |
| `vz.crit.axis.cd`    | CRIT DMG                          | CRIT DMG    |
| `vz.crit.axis.cr`    | CRIT RATE                         | CRIT Rate   |
| `vz.crit.line.ratio` | CD = 2×CR                         | 🔒 formula  |
| `vz.crit.line.best`  | best split of this budget         |             |
| `vz.crit.marker.cr`  | CR {n}%                           | 🔒 abbrev   |
| `vz.crit.marker.cd`  | CD {n}%                           | 🔒 abbrev   |

✅ **§D applied:** sentence case in the source. 🐛 ⚠️ These are SVG `<text>` with **no**
`text-transform` today, so the code change must ADD `text-transform: uppercase` or the
axis visibly changes (§D's correction).
⚠️ **`CR` and `CD` appear as bare abbreviations on the markers** while the controls spell
them out. ⚓ Correct — the marker has no room — but it means the instrument teaches two
names for each stat, which is worth one deliberate look.

---

## Added 2026-09-27 — missed by the first extraction

☑ **Read by Nate 2026-09-27** ⚠️ Until this box is ticked, a blank `New:` in this section is **not**
an approval. These rows come from a parser-based re-run; the first pass skipped strings
inside script expressions and some attributes. Keys are left to the extraction pass.

⚠️ **This sheet is already ruled** — these two are the pieces the ruled rows didn't reach.

| Where                       | Context                                                | Now                    | New (→ C: suggested)             |
| --------------------------- | ------------------------------------------------------ | ---------------------- | -------------------------------- |
| `CritHeatmap.svelte:748`    | Marker tooltip, third line (risk overlay on)           | {n}% no-crit risk      | → C: No-crit risk {n}%           |
| `CritInstrument.svelte:254` | Roll result, first half (before `vz.crit.roll.result`) | {n} of {n} crit → {n}x | → C: {n} of {n} hits crit — ×{n} |
| `CritInstrument.svelte:56`  | Ratio (CD:CR) value when CRIT Rate is 0                | n/a                    | → C: —                           |
| `CritHeatmap.svelte:603`    | Corner label atop the right-edge Average DMG scale     | 4.00x                  | → C: ×4.00                       |

⚓ **Why these suggestions** (the last two were found by a strict per-sheet re-check,
2026-09-27 — every string in this instrument's files against THIS sheet, single words
included):

- **No-crit risk {n}%** — the tooltip's other lines put the label first (`CR {n}%`,
  `CD {n}%`), and the readout already names it "No-crit risk".
- **{n} of {n} hits crit — ×{n}** + the ruled `this time (average ×{n})` reads as one
  sentence: "7 of 12 hits crit — ×1.64 this time (average ×1.72)". The em dash replaces
  the typeset `→`, "hits" gives the plural a noun to agree with, and the multiplier takes
  the §G prefix.
- **—** for an undefined ratio: a dash is the site's "no value" mark and needs no
  translation, where "n/a" is an English abbreviation.
- **×4.00** is not a taste call — it is §G (prefix, two decimals) reaching a label the
  ruled isolines row (`:493`) didn't cover.

⚠️ **The roll line is ASSEMBLED across two rows** — `{n} of {n} crit →` here, `this time
(average ×{n})` in the ruled row. A translator needs the whole sentence. It also typesets
`→`, and its `x` suffix needs the §G prefix (`×1.72`) like the rest.
⚠️ Needs an ICU plural on the hit count.
