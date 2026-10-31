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
 * Below this CELL width the character cell's band B folds the constellation
 * lens into More (measured on the cell, not the viewport: the cell is the
 * roster column beside the dock and the whole band below it). Measured with
 * the lens on its WIDEST label ("My constellations", 172px): 463px, + 8px
 * slack for font differences across engines. Re-measure if a band B control
 * or a lens label grows.
 */
export const FOLD_LENS_W = 472;
