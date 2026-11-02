# The Visualizers: design

The current design of the Visualizers surface and the shape every instrument follows. Agreed
with Nate on 2026-11-02 from a review of all eight (screenshots one up and two up, and an
inventory of every control); the rounds that build it are listed at the end. The per-area rules
are in `.claude/rules/visualizers.md`.

## 1. What an instrument is for

An instrument is worked in: you move something and watch the mechanic answer. So the
Visualizers are designed for the direct-manipulation loop (move a control, see the chart, read
the answer), and the rest of the design serves that loop.

## 2. The workspace

- **One up by default.** Side by side is a choice under Layout, and an instrument only has to
  work there (scrolling inside a tile is fine). Interactive chart tools give the one chart you
  work in the screen (Grafana's Explore view, Lightroom, Desmos); multi-up is for monitoring.
- **Tabs** name all eight where the row fits, so the tool shows what it holds.
- **The bar:** the instrument tabs (or picker), then Defaults, Copy link, ⋯ (How it works,
  Report a problem), and Layout on the last tile. Defaults is dimmed at defaults and has Undo.

## 3. The order of an instrument

Top to bottom, and in reading order on a phone:

1. **The question:** the chart's tabs (what it draws).
2. **The chart**, as large as the tile allows.
3. **The live controls**: the ones you scrub. Fixed positions, next to the answer.
4. **The answer**: the Readout's headline.
5. **Per-session settings**: your build, your pity. Visible and compact.
6. **Set-once settings**: folded into summary lines that open popovers (Wish odds' Goal and
   Radiance counter are the pattern).
7. **Explanations**: fine print in the Readout, or Help through How it works.

### Three kinds of control

- **Live:** the thing you scrub (pulls saved, days of resin, CRIT Rate, EM). Full-size slider
  with a typeable value.
- **Per-session:** set when you sit down (pity, the enemy, your stats). Inline, compact.
- **Set-once:** rarely changed (your level, the scaling stat, model choices). A summary line
  and a popover.

## 4. Stability

The control under your hand must not move while you use it. The rules, from Lightroom, Figma's
properties panel, Desmos and the explorable-explanation tradition:

- **Anything that changes height goes below everything you touch.** Never insert content
  above a control. A swapping sentence gets reserved space or sits last.
- **Numbers don't jitter:** values in tabular figures, fixed-width value fields.
- **Axes freeze during a drag** (the Gauge's `dragDomain` is the model).
- **The chart's height doesn't depend on the controls.** Today the chart takes what the
  controls leave, so a control that grows its panel shrinks the chart and lifts the panel. The
  rail (§6) separates them.

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
`app.css` (round 2).

## 6. The rail

At the wide tier, the chart takes the left at full height, and a right column holds, top to
bottom: the live controls, the Readout, then the per-session and folded settings. The Crit
heatmap already has this shape. It keeps the slider beside its answer, gives the chart a
height of its own, and ends the full-height slab of mostly empty paper the Readout is today.
Narrow, it stacks chart, live controls, Readout, settings. An instrument whose chart wants
width rather than height (the Damage breakdown's waterfall) may keep its controls below.

## 7. The kit

The instruments share small components where three or more had copies: the slider (label,
typeable value, ticks and snapping), the Readout head, the summary-line popover, and the chart
frame's constants. Not a charting library: the charts are bespoke on purpose.

## 8. Saved per profile

An instrument remembers its state per profile, so set-once settings stay set. Defaults, with
Undo, is how you start over; Copy link is how you share.

## 9. Rounds

1. The workspace and the bars: `docs/rounds/viz-workspace-bars-2026-11-02.md`.
2. Type, spacing, the kit and typeable values.
3. The rail and each instrument's controls sorted into the three kinds, Wish odds first.
4. Saved per profile.
