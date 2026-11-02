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
fixed-height dock; the rail made into a proper inspector), Nate chose the first. It replaces
the rail (§6a) one instrument at a time. Its first build (Wish odds) showed two new problems,
and the stage is now **one box** (⚓ Nate: "if we can simplify down to one box, this solves so
many layout issues"):

```
[ Wish odds ▾ ]                                     [ Defaults ] [ Copy link ] [ ⋯ ]
[ view tabs ]                                        63.5% chance of C0 within 90 pulls
              [ setup bar: Pity 0 · Guarantee None · Goal C0 · … ]
┌──────────────────────────────────────────────────────────────────┐
│ the chart, full width: drag it, it is the control                 │
│ companion strip, on the same x axis                               │
└──────────────────────────── axis handle ─────────────────────────┘
fine print
```

- **The head row** (⚓ Nate): the view tabs under the instrument's picker, at every width,
  and the headline at the row's far end, right aligned, on one line (the figure and its
  sentence on one baseline, each at its own size) from a 38rem tile. Where the tile is under
  60rem the headline goes under the tabs, still at the right. Decided by the tile's width,
  never by whether the content fits, because the headline's length changes as you drag and a
  rewrap would move the chart under the hand. (Tried and set aside the same day: the view
  tabs in the workspace bar beside the picker, and the setup bar beside the headline.)
- **The setup bar's row**, right over the chart and centred on it (⚓ Nate).
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
  ⏭ This changes the materials rule "one paper Readout card per instrument" (Nate's): on the
  stage, paper is the full working on request.
- **The layout.** One column at every width. From 1024px the stage is the tile's height,
  capped at 🎛️ `--wi-stage-aspect` (1.9) × the tile's height and centred, so an ultrawide
  doesn't flatten every slope.

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

### 6a. The rail (the form being replaced)

Until an instrument moves to the stage, it keeps the rail: the chart on the left at the
tile's height, and a right column of live controls, settings, then the Readout, last because
its height follows the values. The Damage breakdown keeps its controls under its waterfall and
Enemy RES & DEF keeps a bespoke right column. The CSS is `app.css` § THE RAIL.

## 7. Chart families

The eight charts are five kinds, and each kind shares its marks, which is what makes them read
as one set of instruments:

- **Chance curves** (Wish odds, all three Artifact views): chance from 0 to 100% up the side;
  the 50% and 90% crossings marked, with drop lines to the x axis.
- **Response curves** (Reaction curves, RES, DEF): the current dot with its value; a short
  tangent for what the next step adds.
- **Timelines** (Gauge explorer, ICD timeline): time across; events marked where they happen.
- **The field** (Crit heatmap): the 1:2 ray and the CV isoline through your point.
- **The bridge** (Damage breakdown): one column per factor.

**Orientation:** what you spend runs to the right (pulls, days, EM, RES, time). The Damage
breakdown is the one exception (§8).

**Companion strips.** An instrument may give part of its chart's height to one second view
that shares the main chart's x axis: Wish odds' chance per pull (the soft-pity spike that
explains the main curve's jump), Reaction curves' gain per 100 EM, Artifact odds' histogram,
the Crit heatmap's hit histogram. Enemy RES & DEF's pair of charts is already this shape. At
most one per instrument.

## 8. The chart changes

- **Enemy RES & DEF:** the DEF chart's x axis becomes DEF removed (shred and ignore
  combined), where the curve climbs steeply toward ×1; against enemy level it was nearly flat.
  Enemy level becomes a setup chip. Shred sources draw as segments of an arrow along the RES
  axis. To try in a demo: the answer as a unit square whose width is the RES multiplier and
  height the DEF multiplier, so its area is the damage kept.
- **Artifact odds:** Level up and Your piece become a survival curve (the chance to end above
  each value), with the histogram as the companion. All three views are then chance curves,
  and the to-beat drag reads its answer at the point. Other sites already show the histogram;
  the curve as the main view is ours.
- **Damage breakdown:** upright at the wide tier, a column per factor, so it fills the stage
  like the rest and up means more damage. Drag a column's top to change that stat; the next
  roll's gain draws as a ghost cap on its column. Horizontal rows below the wide tier, where
  seven columns don't fit. To judge in a demo.
- **ICD timeline:** three lanes on one time axis (the timer's windows, the hit counter, the
  result), so why a hit is blocked is visible without pointing at it.
- **Gauge explorer:** the overlaid areas stay. ⚓ Nate: few auras coexist (Electro-Charged,
  Frozen, Burning, Quicken), because most reactions clear one or both elements, so lanes per
  element would gain little; the overlay also matches the Planner's aura lane. The aura log's
  reactions become marks on the timeline.
- **Unchanged charts:** Wish odds, Artifact odds' Drop view, Reaction curves and the Crit
  heatmap gain annotations, not a different chart. For Nate's eye: the Crit heatmap's rainbow
  map draws bands where the data is smooth (the yellow ridge reads as a boundary).

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

1. Wish odds: the frame and the chance-curve family.
2. Artifact odds: the survival curve and the histogram companion.
3. Reaction curves.
4. Enemy RES & DEF.
5. Damage breakdown.
6. Crit heatmap.
7. ICD timeline.
8. Gauge explorer.
