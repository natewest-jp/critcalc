---
paths:
  - 'src/routes/(scene)/(tools)/visualizers/**'
---

# Visualizers

Budget: about 5,000 characters. Records: `docs/rounds/instrument-layout-round-2026-10-06.md`, `docs/rounds/instrument-passes-2026-10-01.md`, and the per-instrument passes in `docs/rounds/`. The gauge model is in `.claude/rules/gauge.md`.

## The workspace

- Eight instruments, listed in `visualizers/lib/workspace.ts`: crit heatmap (`crit`), ICD timeline (`icd`), artifact odds (`artifact`), gauge explorer (`gauge`), reaction curves (`curves`), enemy RES & DEF (`defres`), wish odds (`wish`), damage breakdown (`breakdown`).
- One to three tiles (`MAX_SLOTS`): one below 1360px, two from 1360px, three from 2200px.
- `/crit-visualizer` redirects here (`static/_redirects`).
- The toolbar is cut by the tile gap, one segment per tile, with plates for controls. Each tile's defaults live in its ⋯; Share is "Copy link"; the Layout plate sits on the last tile. The Visualizers have no inspector.

## The tile is the viewport

- `.ws-body` scrolls under a roll-off mask, and the tool never page-scrolls.
- A chart box that is measured and then drawn to fit carries `contain: size` with a natural-height floor, or its row ratchets taller on every redraw.
- ⚠️ The tile's grid row is `minmax(0, 1fr)`, never `1fr`: `1fr` means `minmax(auto, 1fr)`, and the `auto` minimum stops an instrument's own `overflow-y: auto` from ever running.

## Materials

- Night looks, glass touches, paper answers (`.claude/rules/ui.md`): each instrument has exactly one `.panel--paper` readout card.

## The Gauge Explorer

- The toolbar adds and the pill edits: an element button appends a 1U application 1s after the latest, and only the editor a tap on a pill opens changes an existing one, so no control both adds and edits. Drag a pill to move it; a click on bare band adds the toolbar's last element there; ←/→ nudge 0.1s (Shift: 1s), Enter opens the editor, Delete or Backspace removes.
- It has no playback. A press on the plot pins a moment for the Readout, which is the only way to read one on touch.
- `appRows` is sorted by time with stable ids, so the log's numbering and the editor agree.
- ⚠️ The axis freezes during a drag (`dragDomain`), or the domain grows out from under the pill.
- It holds at most `MAX_GAUGE_APPS` (8) applications, so it can't take a real rotation, which makes about 230. That is settled.
- Its markers share the planner's application-marker grammar (`.claude/rules/timeline.md`).
