/**
 * THE DOCK's knobs (design doc §11.2).
 *
 * ⚠ The board's WIDTH is not here: it steps at `broad` and `vast`, and a
 * custom property cannot reach a media query, so the widths are CSS — one
 * rule in the Team Builder page that both the dock and band B's cells read
 * (`--tb-board-w`), so the two rows cannot drift.
 */

/**
 * The slide between Characters and Lineup below the dock.
 *
 * 🎛️ It moves a whole pane, so it is its OWN clock — ⛔ not one of the three
 * `--t-*` bands (motion round: the bands are sized for controls, surfaces and
 * the toggle thumb). Nate tunes this number; the value here is a placeholder.
 * `prefers-reduced-motion` zeroes it at the use site.
 */
export const TB_WIPE_MS = 320;

/**
 * Below these CELL widths the character cell's band B folds its controls into
 * More, in this order (measured on the cell, not the viewport: the cell is
 * the roster column beside the dock and the whole band below it).
 * 🎛️ ⏳ First values, from the controls' rendered widths.
 */
export const FOLD_SHOW_W = 560;
export const FOLD_LENS_W = 420;
