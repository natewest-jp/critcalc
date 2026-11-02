# The stage, round 1: Wish odds (2026-11-02)

**Status:** 🔨 built on `feat/viz-wish-stage` in six passes (§7–§11); §11 is the arrangement to judge next, for Nate to look at in the local build. Not merged.
⏭ The copy in §5 is written in for the demo and is proposed, not approved; the visual calls in
§4 are Nate's; real Safari and iPhone.

## 1. Why

The first instrument on the stage (design `docs/design/visualizers-design.md` §6–§8, agreed
the same day). Wish odds went first because it is the lightest instrument that uses every
shared piece: view tabs on the chart bar, a short setup line, a live value that is the x axis,
a headline, the chance-curve family's crossings, and a companion strip. Artifact odds, the
same family, comes next and inherits all of it.

**The headline** (⚓ Nate: the most important answer for the chart): the chance of your goal
within the pulls you've saved, as before. The runner-up, "pulls until it's likely", is now
the 50% crossing mark on the chart.

## 2. What changed (`WishInstrument.svelte`)

- **The layout.** One stage column (chart bar, setup line, chart head, chart, handle) and the
  paper card. Narrow: stacked at natural heights. Mid, from 1024px: the stage takes 🎛️
  `--wi-stage-mid` (0.82) of the tile, so the card's top shows beneath. Wide: the card beside
  the stage; the stage is the tile's height and sticky, capped at
  `--instrument-main-aspect` × the tile's height as the rail's chart was. The CSS is local
  until a second instrument wears it.
- **The setup line.** Pity (a chip that opens the pity slider), the guarantee (a toggle: a lit
  plate when held), Goal and the Radiance counter (chips that open the popovers they had as
  summary lines). "5★ and weapon" shows two groups, each led by its banner's name. Dropping a
  Paimon.moe export on the character banner's chips still reads it.
- **The chart head.** The headline left the paper card for the top of the stage, in the
  Readout head's type. It follows the handle and a drag on the chart.
- **The handle.** Pulls saved is the axis's own: its track spans the plot's x range plus half
  a thumb each side, so the thumb sits under the marker line at every value (measured: exact at
  0, 90 and 170 once Chrome's 2px range-input margin is zeroed). The label and the typed value
  sit under the track. Typing past the axis (to 2,000) still works; the marker waits at the
  end.
- **The answer as geometry.** The goal curve's 50% and 90% crossings are drawn: a dot, a
  dotted drop line to the axis, and "Half by 79" / "Unlucky tenth 155" beside it (below-right
  of the dot, or above-left near the plot's right edge, the two corners a rising curve leaves
  empty). The old "63%" label at the marker went, since the head says it.
- **The companion strip.** The chance the goal lands on each pull (the goal curve's slope),
  scaled to its own peak, on the main chart's x axis, with the soft-pity line running through
  it. It shows why the main curve jumps: the soft-pity spike, and for C0 a second hump where
  the 50/50 was lost. For a pair or a high constellation it shows each copy's hump.
- **The paper card** keeps the table of levels, the average, the Half by and Unlucky tenth
  definitions, and the banner notes that used to sit under the controls (the 55%, 4★ and
  weapon explainers). They change length with the settings, so they now sit where they move
  nothing you touch.

## 3. Considered and not taken

- **A hover preview in the head** (Apple Stocks shows the hovered point and returns on
  release). Here a drag sets Pulls saved, so a hover preview would give the chart a second
  meaning. Easy to add if Nate wants it.
- **A knob drawn in the SVG** with an ARIA slider on it. `InstrumentSlider` under the axis gives
  the same handle with a typeable value and a native, accessible track, and no new control
  code.
- **Small (`btn--sm`) chips.** Tried first; at 11px they read smaller than the axis labels.
  The chips are full-size glass plates.

## 4. For Nate's eye

1. The chips' size and grouping, and the guarantee as a lit toggle.
2. The chart head at the Readout head's size (`--fs-5xl`).
3. The companion: 🎛️ `COMP_H` 72px, `COMP_GAP` 24px, fill at 0.45.
4. The crossing marks' weight and their labels' placement.
5. The handle's label and value under the track.
6. 🎛️ `--wi-stage-mid` (0.82) two up.
7. The card now opens on its table, with the empty column under it at the wide tier.

## 5. Copy for Nate (written in for the demo, not final)

1. Chip names: "Pity", "Guarantee" ("Fate point" on the weapon banner), "Goal", "Radiance
   counter". The guarantee chip's tooltip and accessible name are the old checkbox's label
   ("Guarantee held (lost the last 50/50)").
2. Chart labels: "Half by 79", "Unlucky tenth 155" (the table's column names with the figure).
3. The companion's label: "chance on each pull".
4. The pair view's group names reuse the old kickers: "Character Event", "Weapon Event".
5. Removed: "Or drag across the chart." (the handle is the chart's own axis now).

## 6. Gates

Vitest 2733, svelte-check, lint and build clean; Chrome e2e 72 passed. Driven on the production
build: a drag on the chart, typing past the axis, pity, the guarantee, a reload (the state
persists) and Defaults, with no page errors. Looked at headless at 3000, 1600, 1440 two up,
1280, 900 and 390 wide.

## 7. Second pass: one box

Nate on the first pass: the chips with no panels are "the single biggest improvement", the
headline "has even more impact standing over night", and the companion and the handle merged
into the chart both work. Two new problems: too many rows of buttons (instrument tabs, view
tabs, then a row of setting chips, all the same glass plate), and two boxes, the chart and
the card, sitting diagonally from each other with gaps around both.

- **One controls row.** The view tabs and a single **setup bar** share a row where they fit.
  The bar is one glass plate whose segments are bare buttons, so the row reads as two objects
  (a recessed track you choose one of, a raised plate of values) instead of nine plates.
  Hairlines between segments were tried and dropped: on a phone the bar wraps and they
  dangled at the line ends; each segment's chevron already ends it.
- **The guarantee is a segment** with a value ("Held", "None") and a popover holding the
  checkbox and the banner's note, so the bar has one grammar and the note has a home.
- **No card.** Its contents moved:
  - the table: the goal's Half by and Unlucky tenth were already on the curve; with more
    than one level, each level's dot carries its chance ("R1 56.8%"), nudged apart and
    stepping above the goal's own dot;
  - the average and the worst case: marks on the companion strip ("average 90", "at most
    180"), and the axis now runs to the worst case where there is one, so "at most" is on it;
  - the definitions: tooltips on the crossing labels;
  - the 55%, 4★ and weapon notes: the Guarantee popover (and the character note in the
    Radiance counter's too);
  - the wish-history import report: the Radiance counter's popover, which now stays open
    after a file is read, so the report shows where the import was asked for;
  - the pair note: one line of fine print under the handle.
- **The layout** is one column. From 1024px the stage is the tile's height, capped at 🎛️
  `--wi-stage-aspect` (1.9) × the tile's height and centred: with no side column, the rail's
  1.65 would have capped a 1600×1000 one up and set the stage off from the tabs above it.
- **Chart labels** wear the site's soft halo (the Gauge's recipe, a touch denser), so a
  level's chance stays legible over a curve. A hard `paint-order` outline was tried and
  smeared the glyphs.

For Nate's eye, as well as §4: the bar's look; the chart at full width (flatter at 2000px:
about 2.6 wide to 1 tall); the dot labels and strip marks; the halo.

Copy, as well as §5 (written in, proposed):

1. The guarantee's values: "Held", "None".
2. The strip marks: "average 90", "at most 180".
3. A level's dot label: "R1 56.8%".
4. Tooltips: "Half of players get there within this many pulls." and "The unluckiest 10% of
   players need this many pulls or more." (from the card's definitions).
5. The pair's fine print: "Your character and weapon banners keep separate pity, so the chart
   adds the pulls for both." ("the chart" was "this").

⏭ The materials rule "one paper Readout card per instrument" (`ui.md`, Nate's) holds for the
rail only now; `ui.md` is unchanged until Nate rules on the stage.

## 8. Third pass: the bar and the head row

Nate: "this is very attractive", and the one-box stage is the target for all eight. Two asks:

- **The instrument tabs go; the picker stays at every width**, capped at 🎛️
  `--ws-picker-max` (16rem). Eight tabs, more to come, and once an instrument is open the
  others aren't what you reach for: the Planner's document tabs went behind the Library for
  the same reason. `InstrumentTabs.svelte` is deleted.
- **The instrument's view tabs sit right of the picker.** Every cell has a views slot
  (`viewSlots` in `+page.svelte`), passed to the instrument as `viewsTarget`. Wish odds
  renders its tabs twice, one copy moved into the slot, and shows one by width: the cell's
  `@container ws-cell (min-width: 64rem)` for the bar's, the tile's matching `instrument`
  query to hide the stage's (the cell and the tile are one column). 🎛️ 64rem: the picker,
  the four tabs and the four action plates measured about 1000px; at the switch (a 1080px
  window, one up) the row has 51px to spare and the cell never overflows. Two up, or on a
  phone, the tabs sit in the stage.
- **The setup bar sits beside the headline**, at the row's far end and bottom aligned;
  wrapped, it goes under the headline, nearer the chart (`space-between` leaves a lone item
  at its line's start).

`e2e/viz-workspace.spec.ts` drops its tab assertions for the picker: the first test now
checks one picker naming Crit heatmap, and the second switches through the picker's menu.
`e2e/marks.spec.ts` sweeps the picker one up instead of the tab row. Gates: Vitest 2733,
svelte-check, lint and build clean; Chrome e2e 72 passed.

Copy (proposed): none new. Help's Visualizers chapter still describes the workspace's tabs
(the "The workspace" section already on the to-do as stale).

## 9. Fourth pass: the tab track and a one-line headline

- **The bar's tab track is the plate.** It stood 4px taller than the picker and the actions
  (the segment's 2px padding around tabs at the plate's height). Now the track takes band
  B's control height and the tabs sit inside it: measured, picker, track and actions all
  56–88px, the lit tab 58–86px.
- **The headline on one line** from a 38rem tile, figure and sentence on one baseline at
  their own sizes; under 38rem the figure over its sentence (the longest, "0.0263% chance of
  C2R1 within 1,000 pulls", is about 505px). The head row is now laid out by the tile's width
  rather than by fit: side by side from 60rem, the headline never shrinking and a long setup
  bar wrapping inside itself; stacked below. Content-driven wrapping would rewrap mid-drag
  as the headline's digits change, moving the chart.

Gates: Vitest 2733, svelte-check, lint and build clean; Chrome e2e 72 passed.

## 10. Fifth pass: tabs under the picker, the headline at the right, the bar over the chart

Nate wanted to see a different arrangement:

- **The view tabs under the instrument's picker, at every width.** The bar's views slot
  (`viewSlots`, `viewsTarget`, the two copies and their container queries) is removed; the
  picker keeps its 16rem cap and the actions hold the cell's far end.
- **The headline right aligned, on the tabs' row** from a 60rem tile, under the tabs and
  still at the right below that; one line from 38rem, as in §9. By the tile's width, for the
  same reason as §9.
- **The setup bar on its own row, right over the chart, centred.** A pair's two bars sit
  side by side and centred where they fit.

Gates: Vitest 2733, svelte-check, lint and build clean; Chrome e2e 72 passed.

## 11. Sixth pass: one left edge, the headline as the focus, the toolbar on the chart's edge

Nate on §10: "this isn't it", and handed the layout over for one more attempt, with what he
was sure of (the controls belong on the chart's top edge, the bottom edge being the handle's;
snug to it) and what he wasn't (alignment: centred looked loose beside edge-aligned
neighbours; where the view tabs and the headline go; the headline must read as the focus,
not an afterthought; most instruments have no view tabs, so the layout mustn't depend on
them).

- **One left edge** for the picker, the headline, the toolbar and the chart. Nothing
  centred.
- **The headline on a row of its own** at the stage's top left, with open night to its
  right. From a 60rem tile it is 48px (🎛️ `--wi-head-scale`, 1.5 × the Readout head's 32px)
  with its sentence a step up (`--fs-3xl`); 32px below that; on a phone the figure over its
  sentence.
- **The chart's toolbar on its top edge**, snug (🎛️ `--wi-toolbar-gap`, 0.25rem above the
  SVG, whose top margin holds the y axis's name): the view tabs, then the setup bar, and chart
  tools at the far end where an instrument has them. An instrument without view tabs starts
  with its setup bar. It wraps: the pair's second bar goes to a second line, and on a phone
  the tabs and the bar each take a line.

Why this and not the alternatives: the toolbar gathers everything that changes the chart on
the chart itself, so the headline has the stage's head to itself; a single left edge keeps
the rows tidy at every width and with or without tabs. Headless screenshots at 2000, 1600
(the pair), 1440 two up and 390.

Next session: Nate's verdict on this arrangement, then the copy proposals (§5, §7), then
Artifact odds, whose round moves the stage's CSS to `app.css`.

Gates: Vitest 2733, svelte-check, lint and build clean; Chrome e2e 72 passed.
