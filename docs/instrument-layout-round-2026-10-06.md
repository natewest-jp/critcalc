# Instrument layout — one form for the Visualizers (2026-10-06)

**Status:** branch `polish/viz-instrument-layout`, awaiting Nate's look at every tier. Started
from Nate's read of the Enemy RES & DEF pass: its wide layout fills the screen top to bottom,
and the other instruments' did not (only their Readout reached the bottom).

## 1. Every chart takes the tile's height (`3f810bb9`)

- A chart's row is `minmax(min-content, 1fr)`; its box is `.instrument-graph` (app.css),
  measured with `bind:clientHeight`, and the plot is drawn to fit.
- ⚓ **The floor is the chart's NATURAL height** (`--graph-min`), so a tile with nothing to
  spare scrolls exactly as before — no chart is ever smaller than it shipped.
- ⚠️⚠️ **`contain: size` on the box is load-bearing.** Without it the box's min-content is the
  SVG drawn at its last height: the row could grow but never shrink back (the `1fr` =
  `minmax(auto, 1fr)` trap one layer down). Verified: shrink the tile → the chart drops to its
  floor and the tile scrolls; grow it → the chart grows back.
- Gauge Explorer: only the PLOT band grows; the marker band and the modifier strips keep
  their size.
- ⚓ **ICD Timeline: the stalks grow, and only a little** (Nate) — `STALK_GROW` 🎛️ 2×; past
  that the strip and its key centre with bare scene above and below. A one-row strip has no
  vertical scale to fill.
- Damage Breakdown's waterfall does NOT stretch: its rows are its height, and taller rows
  would be padding. The slot's spare height sits under its caption.

## 2. The shared form (app.css `.instrument`)

Three slots — `.instrument-chart`, `.instrument-controls` (one `.panel`, or a `.panels` row),
`.instrument-readout` (the ONE paper card) — at three tiers of the TILE's width:

| tier    | layout                                                                              |
| ------- | ----------------------------------------------------------------------------------- |
| narrow  | one column: chart · controls · Readout — ⚓ **the Readout LAST** (Nate)             |
| ≥ 38rem | chart across the top; controls \| Readout at an even split (⚓ the Wish Odds form)  |
| ≥ 60rem | the Readout a column down the right at full height; chart over controls on the left |

- ⚓ **One side-column width for all eight, `--instrument-side` 🎛️ = `minmax(18rem, 25rem)`**
  (on `:root`, so the Crit Heatmap's bespoke grid reads it too). Nate asked why they
  differed (22 / 23 / 25rem). Measured: every Readout and list fits 22rem — RES & DEF's shred
  rows fit even 18rem, and its 23rem came in with a WIP commit and no reason — EXCEPT the
  Gauge's widest aura-log line, "Pyro (0.8U after tax, refreshed, new rate)", which wraps at
  24rem and holds at 25rem. The widest need sets the one width.
- ⚓ **At 38–60rem the controls and the Readout keep their NATURAL heights** (Nate, after
  seeing them stretched: a short Build panel became a tall box of empty glass).
- **`.instrument` is `min-height: 100%`, not `height: 100%`.** A grid sizes its `fr` rows
  against a definite min-height too, so the fill still works; and the box now grows with its
  content, which is what lets anything inside it be `sticky` past the first screen.
- **`.panels` is an even-column grid now** (`auto-fit, minmax(min(17.5rem, 100%), 1fr)`),
  not CSS multicolumn — the wide ICD Timeline was two panels and an empty third column.
- Reaction Curves and Damage Breakdown moved their family tabs INTO the chart slot (they
  choose what it draws), so every instrument is three slots, not four.
- Reaction Curves' table is column-shaped at every width: a family's name holds one line and
  its reactions go beneath it; heads and "doesn't apply" may wrap.
- Both sliders boxes (Curves, Breakdown) take one slider per line in the half-width controls
  slot (38–60rem).

### Enemy RES & DEF — the one extra area

- Its two charts share ONE chart slot (`.dr-charts`, RES 3 : DEF 2). ⚓ `minPlotH` is
  RETIRED: the floor is each chart's natural height, like every other instrument, so on a
  short wide tile the tile scrolls rather than the charts shrinking below it.
- The shred list is a CONTROL, so below the wide tier it sits after Your hit / Enemy and
  before the Readout; at the wide tier it fills the column under the Readout, as Nate liked.
- At 38–60rem the Readout is `sticky` beside the list (stretched, it was a column of empty
  paper the length of the list).

## 3. Crit Heatmap — the outlier, kept on purpose

- Below the wide tier it keeps **the stage**: the heatmap and its strip share one height
  budget and the chart gives way first. The shared mid form would shrink a 2-up heatmap from
  ~650px to ~320px tall.
- ⚓ **At the wide tier the shared form was TRIED and rejected (measured):** the strip under
  the chart took ~170px of height, and since the heatmap caps its width by its height the
  whole chart shrank by a fifth with bare night either side. The strip and the card stay in
  the side column; what it shares now is that **the paper card runs to the column's bottom**.
- Its ≥48rem panel padding override (1.25rem 1.35rem, from July, before the shared panels)
  is gone — its panels match every other instrument's.

## 4. Open for Nate

- ⚓ Damage Breakdown keeps the bare scene under its waterfall at the wide tier (Nate) — no
  row stretch.
- Safari: unchecked by eye (the `min-height` + `fr` rows, `contain: size`, the sticky
  Readout).
