/**
 * THE TOOLBAR (⚓ NATE 2026-08-07, the toolbar round) — the geometry of every
 * tool's one toolbar row, which the code calls band B. It stands clear of the
 * tool surface, with the bench ribbon (the planner's) running the height of
 * the whole stack beside it:
 *
 *     ▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    ← band B, the toolbar (glass)
 *     ▓▓▓▓▓▓▓▓                          ← BAND_STACK_GAP of bare scene
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░    ← the tool surface
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░
 *
 * ⚓ NATE 2026-08-17: the ribbon's top edge is the toolbar's top edge
 * (RIBBON_OVERHANG_Y is 0; see that constant for why the cards do not move
 * when it changes).
 *
 * The toolbar holds the VIEW: what you are looking at inside this tool, and
 * how (the planner's zoom and layers, the Team Builder's panes and lens, the
 * Visualizers' per-tile pickers). The DOCUMENT (which one, its library, its
 * share) is the top bar's.
 *
 * ⚠ THE TOOLBAR TRAVELS WITH ITS TOOL: it is part of the tool surface and
 * drifts with it on a tool→tool leg, never screen-locked HUD.
 *
 * All knobs — Nate tunes these in the inspector.
 */
// ⚠ The .ts extension is load-bearing — see toolGutter.ts's note on it.
import { TOOL_GUTTER } from './toolGutter.ts';

/**
 * The toolbar's height before it is measured. The row is `--ui-ctl-h` (the
 * interface size, app.css), which ToolStack measures and publishes as
 * `benchBand.bandBH`; this is only the bench's starting value until then.
 *
 * ↻ ⚓ NATE, twice in two days: 32 → 38 (the Team Builder's navigation moved
 * in, and a band carrying a tool's primary navigation has to seat it) → 36:
 * "let's make all of the Band A / Band B items 36px".
 */
export const BAND_B_H = 36;

/**
 * The gap BETWEEN CONTROLS inside the toolbar — button to button, and
 * (2026-08-10) the Team Builder's Clear · navigation rail · lens split.
 *
 * ⚓ NATE: one gap between controls. It was two near-identical values before
 * this (.25rem and .35rem), which is the kind of drift a named constant exists
 * to stop.
 */
export const BAND_ITEM_GAP = 4;

/**
 * Bare scene between the toolbar's bottom and the tool surface's top.
 *
 * ↻ 2026-08-08 (breathing-room round): derived from TOOL_GUTTER rather than
 * declared. This is the VERTICAL face of a tool's one interior rhythm; the
 * horizontal face is COLUMN_GAP, and both now move together.
 */
export const BAND_STACK_GAP = TOOL_GUTTER;

/**
 * The tight gap of an instrument head: in the narrow form, between the toolbar,
 * the bench rail and row, and the surface (ToolStack's `--band-gap`; ⚓ Nate
 * 2026-10-14, the mobile round), and under the Team Builder's toolbar
 * (⚓ Nate 2026-10-20).
 *
 * ↻ ⚓ NATE 2026-08-10: it is the gap BETWEEN BUTTONS, so the distance between
 * two plates does not depend on whether they sit side by side or stacked.
 * ⚠ It is BAND_ITEM_GAP, not a number of its own — move that and this moves.
 * BAND_STACK_GAP (toolbar → surface on the desk) stays the full gutter.
 */
export const BAND_GAP = BAND_ITEM_GAP;

/**
 * Interior padding at each end of a band. Matches the planner frame's own
 * horizontal padding (FRAME_PAD_X = 14) so a control at a band's left edge
 * lines up with the surface content below it.
 */
export const BAND_PAD_X = 14;

/**
 * A band's radius — `--r-xs`.
 *
 * ⚓ NATE 2026-08-07, ON TRIAL: 6 → 1. The radius scale collapsed to a
 * near-universal 3 (see the GEOMETRY block in app.css) and the bands are where
 * the new 1px is being tried — "a slightly dulled box", a corner just broken
 * enough not to be sharp. The bands are the site's most machined-looking object
 * and the least like a card, so they are the honest test of whether that reads.
 * If it does, 1px is a real rung; if it doesn't, this goes back to 3.
 */
export const BAND_RADIUS = 1;
