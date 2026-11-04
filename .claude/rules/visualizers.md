---
paths:
  - 'src/routes/(scene)/(tools)/visualizers/**'
---

# Visualizers

Budget: about 5,000 characters. Records: `docs/rounds/instrument-layout-round-2026-10-06.md`, `docs/rounds/instrument-passes-2026-10-01.md`, and the per-instrument passes in `docs/rounds/`. The gauge model is in `.claude/rules/gauge.md`.

## The workspace

- Eight instruments, listed in `visualizers/lib/workspace.ts`: crit heatmap (`crit`), ICD timeline (`icd`), artifact odds (`artifact`), gauge explorer (`gauge`), reaction curves (`curves`), enemy RES & DEF (`defres`), wish odds (`wish`), damage breakdown (`breakdown`).
- One instrument at a time by default (`DEFAULT_SLOTS`), because an instrument is worked in, not glanced at. Layout offers up to three side by side (`MAX_SLOTS`), capped by what fits: two from 1360px, three from 2200px. Design one up; side by side only has to work.
- `/crit-visualizer` redirects here (`static/_redirects`).
- The toolbar is cut by the tile gap, one segment per tile, with plates for controls. The instrument is a picker at every width, its view tabs under it in the stage. Each tile's bar carries Defaults (dimmed at defaults, Undo in its toast), Copy link, and a ⋯ with How it works and Report a problem; the Layout plate sits on the last tile. The Visualizers have no inspector.
- An instrument's defaults are its share state as it mounts (`register` in `+page.svelte`), so anything applied to an instrument (a link, a saved state) must arrive after its handle binds.
- Each instrument's state is kept in the active profile (`ProfileRecord.instruments`, written by `storageSession.saveInstrument`), as its share state. So the share state is the instrument's whole remembered state: what it leaves out is forgotten on a reload, and a share-state version bump must still read the older versions profiles hold.

## The tile is the viewport

- `.ws-body` scrolls under a roll-off mask, and the tool never page-scrolls.
- A chart box that is measured and then drawn to fit carries `contain: size` with a natural-height floor, or its row ratchets taller on every redraw.
- ⚠️ The tile's grid row is `minmax(0, 1fr)`, never `1fr`: `1fr` means `minmax(auto, 1fr)`, and the `auto` minimum stops an instrument's own `overflow-y: auto` from ever running.

## The stage

- The stage replaces the rail one instrument at a time (design §6, §11); Wish odds, Artifact odds, Reaction curves, Enemy RES & DEF, Damage breakdown and the Crit heatmap wear it. It is one box, with the headline at the chart head and no answer card. Its CSS is `app.css` § THE STAGE.
- A typeable card field (`StatField.svelte`) only ever sets an option from its list: typing is a search (`statEntry.ts`, tested).
- An axis handle is an `InstrumentSlider` whose track runs the plot's x range plus `THUMB_R` each side, so the thumb sits on the marker line. ⚠️ Zero the range input's margin, or Chrome's 2px puts it off the line.
- A y-axis handle is the same slider with `vertical` (the Crit heatmap's CRIT Rate), its track placed by the instrument over the y range plus `THUMB_R` each end.

## The rail

- An instrument has four slots (`app.css` § THE RAIL): chart, live, settings, Readout. The Readout is last at every width, because it is the slot whose height follows the values. A control's dependents sit below it, so where settings decide what the live panel offers, use `.instrument--settings-first`.
- The chart's height is the tile's (sticky at the wide tier), never what the controls leave.

## The kit

- Every instrument slider is `kit/InstrumentSlider.svelte`, so its value is typeable; the level slider is `kit/level.ts`; a set-once setting folds into `kit/SettingLine.svelte`. A typed value lands at the field's own precision, so pass `decimals` when a slider should take finer values than its step implies.
- Control labels are sentence case; the kicker is the one caps voice. Sections and controls sit on the spacing ladder (`--inst-gap-*`, `.inst-section`), and a Readout leads with `.readout-head` (design: `docs/design/visualizers-design.md` §5).

## Materials

- Night looks, glass touches, paper answers (`.claude/rules/ui.md`): each instrument on the rail has exactly one `.panel--paper` readout card; on the stage there is none.

## The Gauge Explorer

- The toolbar adds and the pill edits: an element button appends a 1U application 1s after the latest, and only the editor a tap on a pill opens changes an existing one, so no control both adds and edits. Drag a pill to move it; a click on bare band adds the toolbar's last element there; ←/→ nudge 0.1s (Shift: 1s), Enter opens the editor, Delete or Backspace removes.
- It has no playback. A press on the plot pins a moment for the Readout, which is the only way to read one on touch.
- `appRows` is sorted by time with stable ids, so the log's numbering and the editor agree.
- ⚠️ The axis freezes during a drag (`dragDomain`), or the domain grows out from under the pill.
- It holds at most `MAX_GAUGE_APPS` (8) applications, so it can't take a real rotation, which makes about 230. That is settled.
- Its markers share the planner's application-marker grammar (`.claude/rules/timeline.md`).
