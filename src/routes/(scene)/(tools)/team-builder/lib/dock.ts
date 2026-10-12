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
 * ↻ 2026-10-12, re-measured with the lens on its WIDEST label ("My
 * constellations", 172px): Show + lens need a 671px cell, the lens alone
 * 463px, each + 8px slack for font differences across engines. ⚠ The old
 * 560 / 420 were already short with "My roster" (the band ran 40px over at
 * 600–640px viewports). Re-measure if a band B control or a lens label grows.
 */
export const FOLD_SHOW_W = 680;
export const FOLD_LENS_W = 472;
