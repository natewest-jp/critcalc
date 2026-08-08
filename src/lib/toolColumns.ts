/**
 * THE TOOL COLUMNS (⚓ NATE 2026-08-08) — the aside-column round.
 *
 * The horizontal counterpart to $lib/toolBands: where the bands split a tool's
 * chrome into two stacked tiers, this splits its SURFACE into two side-by-side
 * boxes with bare scene between them.
 *
 *     ▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    ← band A — spans BOTH columns
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    ← band B — spans BOTH columns
 *     ▓▓▓▓▓▓▓▓
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░ ▒▒▒▒▒▒▒▒▒▒     ← main box · GAP · aside box
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░ ▒▒▒▒▒▒▒▒▒▒
 *     ▓▓▓▓▓▓▓▓
 *       ribbon         MAIN          ASIDE
 *
 * WHY A SHELL RATHER THAN THREE ARRANGEMENTS. The shape already existed three
 * times over, at three different depths, and no two of them agreed:
 *
 *   - the planner's NOTES panel — an absolute panel inside the timeline's
 *     track area, with a matching `margin-right` on its sibling faking the
 *     push. Two declarations that had to agree on one number, and because it
 *     lived BELOW the ruler strip, the ruler kept its full width and drew
 *     ticks for time the narrowed track viewport could no longer show.
 *   - the planner's PICKER — grid and filter rail packed inside CharacterGrid,
 *     the pair layered over the frame as one overlay.
 *   - the Team Builder's ROSTER — the same CharacterGrid pair, separated from
 *     the tiles by nothing but the scroll gutter.
 *
 * One shell means one geometry, one set of knobs, and — when the mobile round
 * comes — ONE place that decides what a narrow viewport does with the aside,
 * instead of three ad-hoc breakpoints.
 *
 * THE ASIDE IS ALWAYS THE DARK COLUMN. Every occupant so far is a secondary
 * reading beside the work — the planner's notes, either tool's filter column
 * (⚓ NATE 2026-08-08: both switched to the dark context in this round) — so
 * the context is structural here rather than per-tool. It wears the RAISED
 * rung, not the frame fill: it is a sibling FRAME of the main box, not a well
 * cut into one, and on the planner it has to read as a peer of .rp-frame
 * (which makes the same override for the same reason).
 *
 * ONE OCCUPANT AT A TIME. The aside is a slot, and the tool decides what fills
 * it — the planner's picker filters cover its notes exactly the way the
 * picker's cards cover the timeline. Before this round that collision was
 * three unrelated booleans in three files and the outcome was an accident of
 * z-index; now it is a single expression each tool writes down.
 *
 * All knobs — Nate tunes these in the inspector.
 */

/**
 * The aside column's width, in px. 262 is what both existing filter rails
 * already measured (--cg-rail-w 250 + the grid's 2×6 scroll gutter), so the
 * two tools' columns keep the width they were tuned at and the planner's notes
 * — previously 240 — gain the difference.
 */
export const ASIDE_W = 262;

/**
 * Bare scene between the two boxes. Matches BAND_STACK_GAP so a tool's
 * interior rhythm is one number horizontally and vertically; they are separate
 * knobs on purpose, in case that stops being true.
 */
export const COLUMN_GAP = 8;
