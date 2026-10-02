# Instrument pass — Crit Heatmap (2026-10-02)

**Status:** branch `polish/crit-heatmap-pass`. The third hands-on instrument pass
(`docs/instrument-passes-2026-10-01.md` §0 has the shape: mechanics + layout + copy, Nate
live). Worksheet 01 is CLOSED and its notes moved to `docs/text/ledger/notes/vz_crit.md`
(the ledger's first notes file). ✅ Real Safari checked by Nate.

## 1. The stage — controls above the fold (⚓ Nate's ask)

The scroll only happened with two tiles side by side: the stacked layout sized the chart
as a square of the TILE'S WIDTH (capped at 70svh), blind to the tile's height, so the
sliders started at y=803 on a 900px window.

- **The chart and its control strip share ONE height budget** (`.cv-stage`, a flex
  column, `max-height: 100%`). The chart panel starts at `min(100cqi, 70svh)` and is the
  only thing that shrinks (floor `--cv-chart-min` 18rem 🎛️); the strip never does.
  Where the tile is tall enough, or has no definite height (below 1024px the page
  scrolls), nothing shrinks and it is the old layout.
- ⚠️ **No percentage has to find a definite parent:** the heatmap's shell is ABSOLUTELY
  placed inside the panel, whose size is set in one place. `.cv-layout` is a BLOCK in the
  narrow layout because a grid item's percentage resolves against its AREA, whose auto
  row is sized by the item — circular.
- **Wide tiles (≥ 60rem)**: the stage is `display: contents`, so the strip moves to the
  side column (grid areas `chart controls / chart stack`).
- **The strip**: CRIT Rate | CRIT DMG, then the overlays | Hits per rotation; one
  column on phones (≤ 30rem).
- Measured: 1440×900 2-up — chart 675×630 → 669×536, controls on screen ·
  1366×768 — 504×404, controls on screen · 1920 / 2560 — unchanged · 320/390 — no
  overflow.

## 2. The readout card

- **Paper answers**, one card. When it sits under the chart and the tile is
  40–60rem, it splits in TWO COLUMNS (numbers + Pin left, the one-rotation chart right,
  bottom-aligned so Roll lines up with Pin — ⚓ Nate). One rule in the card: above the
  chart, and only when stacked.
- Label | value as a `<dl>` — no colons in messages (conventions §C).
- ⚓ **Total crit value (CV)**, from total stats, "base crit stats included" (Nate): a
  bare "280 CV" reads as artifact CV. ⛔ no "+ base" term in the formula — the totals
  already hold it.
- Pin delta is RELATIVE (`my / pinned − 1`, `Intl` sign). CRIT Rate / CRIT DMG left the
  readout (the fields above say them, §1.9).

## 3. Added — the one-rotation chart (⚓ Nate: "build it")

`critCountDistribution` (binomial, by neighbour ratio; tested: sums to 1, bar 0 = the
no-crit risk, averages back to `1 + CR × CD`). One bar per crit count, scaled to the
tallest bar; the sentence under it reads the hovered bar, else the rolled one, else the
average. Roll lights up the bar it lands on.

- ⚓ **The dark bar is the bar the sentence describes** — paper's navy (`--muted`).
  ⛔ **No gold on the paper card** (Nate: gold fill reads brown; gold + glow on the pips
  went muddy). Pips: a crit is a filled dot, a miss an empty ring (inset shadow — ⚠️
  Chrome floors a 1.5px border to 1px).
- ⚓ **The average line**: 2px, navy, and PARCHMENT where it crosses the dark bar.
  ⛔ A paper edge around a navy line was rejected — "too many lines".
- Hits per rotation and Roll are now ALWAYS shown (the chart needs the count); the
  no-crit toggle only darkens the heatmap.

## 4. Mechanics

Checked against `docs/library/game/damage-formula.md` (CRIT multiplier) — the instrument
was right. Changes:

- **Best split under the game's bounds** (`bestSplit`): the CV/4 · CV/2 point clamped
  along the budget line (CR ≤ 100%, CD ≥ 50%); the circle leaves the diagonal when the
  2:1 split is out of reach rather than vanishing.
- **The hits slider is coloured by the build's own risk** (`riskGradient`): each hit
  count wears the no-crit risk colour at that count for the current CRIT Rate. It was the
  four stops spread over 1–40, which painted 8 hits orange at any CRIT Rate (⚓ Nate:
  "not honest"). The blend is continuous (`riskColorSmooth`, OKLab between anchors at
  2 / 12 / 35 / 60%); at 100% it is green end to end. The tooltip keeps the discrete
  bands. `HITS_MAX` stays 40 (a burst window or coordinated attacks reach 30+, and the
  chart is where high counts earn their place).
- `formatChance` never prints a false `0.0%`. `nearestIsoline` (dead) removed.

## 5. Copy (worksheet 01, applied)

CRIT Rate / CRIT DMG · Hits per rotation · Current build · `×1.98` everywhere (incl.
isolines + the `×4.00` corner) · the ruled tagline · the roll sentence (no "(average …)",
⚓ Nate) · axis titles sentence case + `text-transform: uppercase` ⚠️ (`AXIS_INK` is
measured on capitals; `isoTickInk` re-measured for `×2.50`: 25.6 → 26.12, PAD.right +1px).
Help's Crit Heatmap section updated (it named a "Roll it" button).

## 6. Rider — the Visualizers' band A (⚓ Nate)

Band A (Workspace · Auto/1/2/3 · Reset layout) is **hidden below 1360px**, where
`viewportCapacity` fits one instrument and every control in it is a no-op; on phones it
also collided with itself. CSS, not `capacity` (vw is 0 until hydration). `ToolStack`
gained `bandAClass`; `.ws` reserves the band through `--ws-band-a`; 1360px is a NAMED
content stop in `breakpoints.test.ts`. The asymmetry with the benched tools is accepted.

## 7. Open

- ⏭ `hitsWord` is an assembled plural in five sentences — ICU at i18n (ledger notes).
- ⏭ The other six instruments still carry the `.instrument` auto-column phone overflow
  (2026-10-01 §4); this one has its own root and was checked at 320/390.
