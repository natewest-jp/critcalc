/**
 * THE DOCK's geometry (design doc §11.2): the board docked on the right at a
 * fixed width, the roster column taking the rest. Band B lays its two cells on
 * the SAME columns (§11.6, the Visualizers' per-tile band), so the numbers
 * live here once and both rows read them — two literals would drift.
 */

/** 🎛️ The board column. Measured 2026-10-10: every English boss heading fits
 *  one line at 13px, and a full Stygian row fits without wrapping. */
export const BOARD_W = 580;

/** 🎛️ The scene between the roster column and the board. */
export const DOCK_GAP = 16;

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
