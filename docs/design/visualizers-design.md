# The Visualizers: design

The current design of the Visualizers surface and the shape every instrument follows. The
workspace, type and kit were agreed with Nate on 2026-11-02 from a review of all eight
(screenshots one up and two up, and an inventory of every control). The stage (§6), the chart
families (§7) and the chart changes (§8) were agreed in a second session the same day, and
are built one instrument at a time (§11). The per-area rules are in
`.claude/rules/visualizers.md`.

## 1. What an instrument is for

An instrument is worked in: you move something and watch the mechanic answer. So the
Visualizers are designed for the direct-manipulation loop (move a control, see the chart, read
the answer), and the rest of the design serves that loop.

## 2. The workspace

- **One up by default.** Side by side is a choice under Layout, and an instrument only has to
  work there (scrolling inside a tile is fine). Interactive chart tools give the one chart you
  work in the screen (Grafana's Explore view, Lightroom, Desmos); multi-up is for monitoring.
- **A picker, not tabs.** The instrument is named on a dropdown at every width, capped at
  🎛️ `--ws-picker-max` (16rem). ⚓ Nate: eight tabs, and more instruments to come, is a long
  row, and once an instrument is open the others aren't what you reach for (the Planner's
  document tabs went behind the Library for the same reason).
- **The bar:** the picker, then Defaults, Copy link, ⋯ (How it works, Report a problem), and
  Layout on the last tile. Defaults is dimmed at defaults and has Undo. The instrument's own
  view tabs sit under the picker, in the stage (§6).

## 3. What is uniform and what varies

The eight differ in three ways that no single column fits: the chart's shape (a square field,
landscape curves, a thin timeline, a table of rows), the number of controls (two for
Reaction curves, twenty and more for Artifact odds and Enemy RES & DEF), and the kind of
answer (a number, a table, a log). The tools that serve very different content well (Figma's
and Blender's inspectors, PhET's simulations, Ableton's device chain) are uniform in
**positions and grammar** and let the **amounts** vary. So every instrument puts the same
things in the same places, says them with the same parts, and has as many of them as it needs.

### Three kinds of control

- **Live:** the thing you scrub (pulls saved, days of resin, CRIT Rate, EM). A handle on the
  chart, with a typeable twin.
- **Per-session:** set when you sit down (pity, the enemy, your stats). A chip on the setup
  line.
- **Set-once:** rarely changed (your level, the scaling stat, model choices). Also a chip on
  the setup line; the popover is where its detail lives.

## 4. Stability

The control under your hand must not move while you use it. The rules, from Lightroom, Figma's
properties panel, Desmos and the explorable-explanation tradition:

- **Anything that changes height goes below everything you touch.** Never insert content
  above a control. A swapping sentence gets reserved space or sits last.
- **Numbers don't jitter:** values in tabular figures, fixed-width value fields.
- **Axes freeze during a drag** (the Gauge's `dragDomain` is the model).
- **The chart's height doesn't depend on the controls.**

## 5. Type and spacing

The site's Settings page has the grammar the instruments adopt:

| role            | voice                                                            |
| --------------- | ---------------------------------------------------------------- |
| section heading | `.kicker`: gold, all caps, with its rule. The one caps voice.    |
| control label   | sentence case, `--fs-lg` semibold, `--text`                      |
| control value   | the label's size, tabular figures; typeable where it makes sense |
| hint            | `--fs-md`, muted, under its control                              |
| Readout head    | the answer at `--fs-5xl`, its sentence at `--fs-xl`; same in all |

Spacing groups by proximity, so each rung is about double the one inside it: label to track,
then control to control, then section to section. Exact values live as named properties in
`app.css`.

## 6. The stage

Of three concepts (a setup line over a stage with the answer beside it; a stage over a
fixed-height dock; the rail made into a proper inspector), Nate chose the first, and every
instrument now wears it. It replaced the rail (a right column of live controls, settings and a
paper Readout beside the chart, `docs/rounds/viz-rail-2026-11-02.md`). Its first build (Wish odds) showed two new problems,
and the stage is now **one box** (⚓ Nate: "if we can simplify down to one box, this solves so
many layout issues"):

```
[ Wish odds ▾ ]                                     [ Defaults ] [ Copy link ] [ ⋯ ]
63.5% chance of C0 within 90 pulls
[ view tabs ] [ setup bar: Pity 0 · Guarantee None · Goal C0 · … ]        [ chart tools ]
┌──────────────────────────────────────────────────────────────────┐
│ the chart, full width: drag it, it is the control                 │
│ companion strip, on the same x axis                               │
└──────────────────────────── axis handle ─────────────────────────┘
fine print
```

- **One left edge.** The picker, the headline, the toolbar and the chart all start on the
  stage's left edge. Nothing is centred: a centred bar between edge-aligned neighbours read
  as loose (⚓ Nate).
- **The chart head** is a row of its own at the stage's top left: the first thing read and
  the largest type on the screen, with open night to its right, so it reads as the focus and
  not as something squeezed beside a control (⚓ Nate: "not an afterthought"). One line (the
  figure and its sentence on one baseline, each at its own size) from a 38rem tile; from
  60rem the figure is 🎛️ `--stage-head-scale` (1.5) × the Readout head's 32px and the sentence
  a step up. By the tile's width, never by fit: the headline's length changes as you drag.
- **The chart's toolbar sits on its top edge**, snug (🎛️ `--stage-toolbar-gap`, 0.25rem), as
  the handle sits on its bottom edge (⚓ Nate): everything that changes what the chart draws.
  The instrument's view tabs lead it where it has them, then the setup bar, then chart tools
  at the far end. Most instruments have no view tabs; theirs starts with the setup bar and
  nothing else moves, so the layout doesn't depend on the tabs. It wraps where it must.
- **Tried and set aside the same day** (2026-11-02, in this order): the view tabs in the
  workspace bar beside the picker, with the setup bar beside the headline; then the tabs
  under the picker with the headline right aligned on their row and the setup bar centred
  over the chart.
- **Two materials.** The view tabs are a recessed track (one is chosen); the setup bar is a
  raised glass plate (each segment is a value you set). The first build gave every setting
  its own plate, and with the instrument tabs above that was three rows of identical
  buttons. Chart tools, where an instrument has them, follow the setup bar.
- **The setup bar.** Every per-session and set-once setting is a segment that shows its value
  and opens a popover: the guarantee too, as a value ("Held", "None"), not a toggle, so the
  bar has one grammar. A list is one segment that says what is on ("Shred: Chevreuse 40%,
  Zhongli 20%"). Segments are labeled, not written as prose sentences, because a sentence with
  controls inside it can't be reordered for another language. Values hold a reserved width
  and tabular figures. A setting's explanation lives in its popover, beside the choice.
- **The chart head.** The headline answer sits at the stage's top left, over night, as in
  Apple Stocks and Robinhood: you scrub the chart and the number follows. It has a fixed
  height, so nothing below it moves. ⚓ Nate: **each instrument's headline is chosen at the
  start of its round, and it must be the most important answer for that chart**, not
  whatever the old Readout led with.
- **The live control is a handle on the chart.** Where the live value is an axis (pulls,
  days, EM, RES, enemy level, CRIT DMG and CRIT Rate), it is a handle on that axis with a
  typeable value beside it.
- **No answer card.** The card's contents each have a better home: figures on the chart
  (§7's marks), a setting's explanation in its popover, definitions as tooltips on the
  chart's labels. Beside the stage it sat diagonally from the chart, and mostly repeated it.
  What no part of the chart can show is one line of **fine print** under the handle; where an
  instrument has a long working (a formula, caveats), the fine print opens it on paper.
  ⚓ Nate: the materials rule in `ui.md` follows, so an instrument has no paper card.
- **The layout.** One column at every width. From 1024px the stage is the tile's height,
  capped at 🎛️ `--stage-aspect` (2.4) × the tile's height and centred, so an ultrawide
  doesn't flatten every slope. The stage's CSS is `app.css` § THE STAGE, shared by every
  instrument on it; what one instrument adds stays in its own file.
  ⚓ The Crit heatmap is the exception (§8): a 2-D field wants the height, so from a 60rem tile
  its headline and fine print stand in a column at the left edge, beside the chart.
- **An input is a segment at a glance.** Where a view is about something the player enters
  (Artifact odds' piece), the setup bar's first segment shows it read-only ("+20 Pyro Goblet ·
  CR 6.6 · CD 21.0 · …") and opens the full input in its popover; with nothing entered, the
  chart's empty state opens it. ⚓ Nate (2026-11-03): one job per step (entering a piece is
  not reshaping it), and the stage stays one box. Set aside: the input beside the chart (two
  boxes) and a panel over an empty corner of the plot (the rule below).

### Using the chart's space

The charts are the most attractive part of the screen and the least used: a single curve at
1100×800 says no more than it would at 1100×500. The answer is to draw more of the answer and
more of the controls into them, without losing the chart's look.

1. **The answer as geometry, not more text.** Most Readout tables are points already on the
   curve: a "Half by" is where a chance curve crosses 50%. Draw the point and the table
   teaches itself.
2. **Three layers:** the data, a light annotation layer, and handles. Labels sit at the data;
   a legend is the last resort.
3. **No panel inside the plot.** Labels may use the empty corners a monotone curve leaves;
   cards may not, because the curve moves into them when a setting changes.
4. **A handle looks like a handle at rest**, not only on hover, which touch doesn't have. The
   streamer's first finding was that it was hard to see how the tools are controlled.
5. **Every handle has a twin:** a typeable field and a keyboard path (an ARIA slider on the
   handle), for precision, screen readers and touch.

## 7. Chart families

The eight charts are five kinds, and each kind shares its marks, which is what makes them read
as one set of instruments:

- **Chance curves** (Wish odds, all three Artifact views): chance from 0 to 100% up the side;
  the 50% and 90% crossings marked, with drop lines to the x axis.
- **Response curves** (Reaction curves, RES, DEF): the current dot with its value; a step
  for what the next step adds (across, then up by exactly the gain, where a tangent would
  overstate it on a flattening curve).
- **Timelines** (Gauge explorer, ICD timeline): time across; events marked where they happen.
- **The field** (Crit heatmap): the 1:2 ray and the CV isoline through your point.
- **The bridge** (Damage breakdown): one column per factor.

**Orientation:** what you spend runs to the right (pulls, days, EM, RES, time). The Damage
breakdown is the one exception (§8).

**Companion strips.** An instrument may give part of its chart to one second view that
shares one of the main chart's axes: Wish odds' chance per pull (the soft-pity spike that
explains the main curve's jump), Reaction curves' gain per 100 EM, Artifact odds' 100 dots,
all on the x axis; the Crit heatmap's crit counts left of the field, on its CRIT Rate axis
(⚓ Nate: a count sits at its share of the hits, so the axis reaches 0%). At most one per
instrument. Enemy RES & DEF has none: its two
plots share the y axis (how much of the hit is kept), not the x, so they sit side by side.

## 8. The chart changes

- **Enemy RES & DEF** (built: `docs/rounds/viz-stage-defres-2026-11-03.md`): two plots on one
  multiplier scale, RES the wider. The DEF plot's x axis is DEF removed (shred and ignore
  combined), where the curve climbs steeply toward ×1; against enemy level it was nearly flat,
  and enemy level is a setup segment. Shred draws as an arrow along each axis, a segment per
  source. ⚓ Nate (2026-11-03): the unit square (width the RES multiplier, height the DEF
  multiplier, so its area is the damage kept) waits; try it in a demo only if the two plots
  leave him wanting it.
- **Artifact odds** (built: `docs/rounds/viz-stage-artifact-2026-11-03.md`): Level up, Your
  piece and Reshape are survival curves (the chance to end above each value), drawn as the steps
  they are, with a 100-dot strip as the companion (one dot per hundredth of the outcomes, the
  ones past the marker lit: counted, not computed). Reshape draws all three kinds at once. The
  to-beat drag reads its answer at the point. Other sites show the histogram; the curve is
  ours.
- **Damage breakdown** (built: `docs/rounds/viz-stage-breakdown-2026-11-03.md`): upright where
  the stage is 900px or wider (the widest family's nine columns fit), a column per bracket, so
  it fills the stage like the rest and up means more damage. Drag a column set by one stat
  (Scaling, DMG Bonus, EM, Base DMG Bonus, Elevation) to change that stat. Each roll draws as a
  cap on the column it lifts, as tall as its gain on the log axis, the best gold. Horizontal rows
  below 900px, by the width alone, so a tab never turns the chart.
- **ICD timeline** (built: `docs/rounds/viz-stage-icd-2026-11-04.md`): three lanes on one
  time axis (the hits, the hit counter, the timer's windows), so why a hit is blocked is
  visible without pointing at it. The hit interval is a handle on that axis, its thumb on
  hit 2, so an even string's axis is set by the rule (three timer windows), never by the
  string, which would rescale under the thumb. ⚓ Nate: it has no setup bar, because its
  rule is the thing you play with (a live control, §3), so the strings are view tabs and the
  rule's three numbers are sliders on the surface; and the chart sizes up as a whole with
  the stage, every mark and word, not only its stems.
- **Gauge explorer** (built: `docs/rounds/viz-stage-gauge-2026-11-04.md`): the overlaid areas stay. ⚓ Nate: few auras coexist (Electro-Charged,
  Frozen, Burning, Quicken), because most reactions clear one or both elements, so lanes per
  element would gain little; the overlay also matches the Planner's aura lane. The aura log's
  reactions become marks on the timeline: what a reaction took off, beside its drop, and what an
  application did to its own aura, over its pill. ⚓ Nate: the headline is the aura at the moment
  pointed at or pinned (at rest, when the target goes bare), the strongest as the figure and any
  others in the sentence, and the scenarios are chips under
  the chart, never in a popover.
- **Crit heatmap** (built: `docs/rounds/viz-stage-crit-2026-11-03.md`): the field fills the
  stage at any aspect (its axes are normalised separately), with a handle on each axis, CRIT
  Rate's upright, the strip outside it on the left, and the right edge the average's axis (along
  CRIT DMG 300% the average is linear in CRIT Rate, so every contour meets it at its value).
  ⚓ Nate: stripped down to the contours, the CV line with its ring, and your average as a notch
  on that axis; the contours dotted, the ring a button to the best split. The field is 1.5 × its
  height at most. ⚓ Nate: from a 60rem tile the headline and the fine print are a column at the
  left edge and the chart stands beside them at the tile's height; every control sits on the
  chart's top edge, none behind a popover. On a phone the strip lies under the chart. ⚓ Nate kept the rainbow over four ramps whose lightness only rises, though its own
  peaks at ×2.8.
- **Unchanged charts:** Wish odds, Artifact odds' Drop view and Reaction curves gain
  annotations, not a different chart.

## 9. The kit

The instruments share small components where three or more had copies: the slider (label,
typeable value, ticks and snapping), the Readout head, the summary-line popover, and the chart
frame's constants. Not a charting library: the charts are bespoke on purpose. A piece of the
stage built for one instrument stays in that instrument until a second needs it.

## 10. Saved per profile

An instrument remembers its state per profile, so set-once settings stay set. Defaults, with
Undo, is how you start over; Copy link is how you share.

## 11. Rounds

The overhaul:

1. The workspace and the bars: `docs/rounds/viz-workspace-bars-2026-11-02.md`.
2. Type, spacing, the kit and typeable values: `docs/rounds/viz-type-kit-2026-11-02.md`.
3. The rail and each instrument's controls sorted into the three kinds: `docs/rounds/viz-rail-2026-11-02.md`.
4. Saved per profile: `docs/rounds/viz-saved-2026-11-02.md`.

The stage, one instrument per round, built together with Nate and judged in the local build.
Grouped by family, so each family's marks are built once and reused at once:

1. Wish odds: the frame and the chance-curve family (`docs/rounds/viz-stage-wish-2026-11-02.md`).
2. Artifact odds: the survival curve and the histogram companion (`docs/rounds/viz-stage-artifact-2026-11-03.md`).
3. Reaction curves: the response-curve family (`docs/rounds/viz-stage-reactions-2026-11-03.md`).
4. Enemy RES & DEF: the two-plot response pair (`docs/rounds/viz-stage-defres-2026-11-03.md`).
5. Damage breakdown: the bridge, upright (`docs/rounds/viz-stage-breakdown-2026-11-03.md`).
6. Crit heatmap: the field, its strip on the CRIT Rate axis (`docs/rounds/viz-stage-crit-2026-11-03.md`).
7. ICD timeline: the timeline family, its lanes and the interval on the time axis
   (`docs/rounds/viz-stage-icd-2026-11-04.md`).
8. Gauge explorer: the last off the rail (`docs/rounds/viz-stage-gauge-2026-11-04.md`).
