# Gauge Explorer: the toolbar adds, the pill edits (2026-11-01)

**Status:** branch `polish/gauge-edit-flow`. The first instrument from the streamer list
(`docs/todo.md` item 1); Artifact Odds and Wish Odds are next. Nate signed off on the flow,
the copy and the height fix in the dev server. ⏭ Real Safari and an iPhone (tap versus drag,
the editor at phone width, a tap to pin).

## 1. What the streamer ran into

To demo Vaporize he placed a Pyro pill, then pressed Hydro meaning "the next one is Hydro",
and re-coloured the Pyro pill instead. The toolbar was two things at once: the inspector of
an always-selected pill, and (through "a new application copies the selected one") the brush
for the next. He worked out the click order, and it felt clumsy. He also asked what the
speed chips were.

## 2. The ruling (⚓ Nate)

- **The toolbar adds.** One button per element, then Clear. A button appends a 1U application
  1s after the latest, or at 0s on an empty chart. ⚓ 1U and 1s fixed, never "remember the
  last size". A click on bare band adds the toolbar's last element at that instant; the ghost
  shows which.
- **The pill edits.** A tap opens a small editor under it: element, size, the 0.1s stepper,
  Remove. Esc, a press outside, or a second tap closes it. It is the only control that changes
  an existing application.
- **Retired:** "a new application is a copy of the selected one" and "something is always
  selected" (both from the 2026-10-02 pass). The chart may be empty.
- **No playback.** Play, the three speeds and the time counter are gone, and with them
  `playhead.ts`, `playhead.svelte.ts` and its test (nothing else used them; the planner's
  transport is separate). ⚓ **The pin stays:** a press or drag on the plot leaves a cursor the
  Readout reads. It is the only way to read a moment on touch, and on a desk it holds the
  reading while the pointer travels to the Readout. The Readout has an Unpin button.
- Alternative weighed and not taken: everything on the chart (a picker at the click point, no
  toolbar). Every add takes two clicks and the picker covers the chart being read.

## 3. Interaction details

- A press on a pill is a tap until it moves past `TAP_SLOP_PX` 🎛️ (4px mouse, 10px touch:
  a fingertip jitters, and a jittery tap would nudge the time by a tenth). Past it, a drag,
  which closes the editor so it does not cover the curve being changed.
- With an editor open, the first press on bare band only closes it. A dismissal never adds.
- Keyboard: arrows nudge, Enter or Space opens the editor and focuses its checked element, Esc
  returns focus to the pill, Delete removes and hands focus to the neighbour.
- The add buttons drop `.chip--icon`'s .35 resting dim (the site's on/off idiom, which made
  them read as disabled). They dim only at the cap.
- The editor is a popover surface (`--surface`, the band menu's edge and shadow), not glass,
  so the curves do not read through it.

## 4. The chart's height (⚓ Nate: it changed height with every application)

Measured at a two-up 1600px tile, a one-up 1280px tile and a 375px phone. Not the time axis
(a longer domain only compresses x). These causes predate the redesign:

1. **Two-up, the Readout set the chart's height.** The chart's row is what the row under it
   leaves, and the Readout was the tallest thing there. The aura log grows with every
   application, so the chart went 443 → 324px and then hit its floor; the Readout's top half
   also changes between a reading and the summary, which was the jump on hover and pin.
   ↻ At 38–60rem the Readout is `contain: size`, stretched to the scenarios panel's height,
   with its log scrolling inside, as in the wide column. ⚠️ This overrides app.css's
   natural-heights rule for this instrument: a short log leaves paper below it (Nate saw it
   and accepted it).
2. **Each aura took 18px from the plot.** `STRIP_RESERVE_ROWS` 🎛️ 3: the plot is sized as if
   three strip rows were always there. 3 covers every scenario but Burning (4); each reserved
   row costs 18px of plot permanently. The floor (`--graph-min`) keeps the real count, so a
   phone gains no empty rows.
3. **Scenario notes run one to four lines.** Tried stacking every note in one cell so the panel
   always reserves the longest: it took ~90px from a two-up chart for good, leaving it near its
   floor. Reverted. A note changes only when a scenario replaces the whole chart, where
   nothing is being followed across the resize.

Result: through Clear, five additions, a pin and hover, the box and the plot hold still at
both tile sizes; the plot moves only when a fourth aura kind appears.

## 5. Copy (approved by Nate)

Add (per-button "Add Pyro" …), Clear ("Remove every application"), the empty-band hint "Pick an
element above to add an application", Remove, Unpin, the Readout prompt ("… or click to pin
it."), the custom-sequence note ("Your own sequence. Tap a pill to change it, or pick a
scenario to load an example."), and the Help chapter's two Gauge paragraphs. The handoff spec
(`e2e/viz-workspace.spec.ts`) matches the new custom note.

## 6. Gates

Vitest 2659 passed, svelte-check clean, lint clean, build. Chrome e2e 71 passed. The flow was
driven in headless Chrome at desk and phone widths (add, edit, drag, band add, dismissals,
pin, keyboard, cap, scenarios) with no page errors.
