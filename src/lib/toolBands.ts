/**
 * THE TOOL BANDS (⚓ NATE 2026-08-07) — the toolbar round.
 *
 * Every tool's controls used to be a bare row of chips floating on the scene,
 * 8px above the tool frame and unattached to anything: three competing top
 * edges (toolbar 72, ribbon 98, frame 109) within 38px of each other, and the
 * row jumped 192px sideways between the benched tools and the Visualizers.
 *
 * They are TWO SEPARATE BANDS standing clear of the tool surface, with the
 * bench ribbon proud of the whole stack:
 *
 *     ▓▓▓▓▓▓▓▓                          ← ribbon, RIBBON_OVERHANG_Y proud
 *     ▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    ← band A   (glass)  BAND_A_H
 *     ▓▓▓▓▓▓▓▓                          ← BAND_GAP of bare scene
 *     ▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    ← band B   (glass)  BAND_B_H
 *     ▓▓▓▓▓▓▓▓                          ← BAND_STACK_GAP of bare scene
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░    ← the tool surface
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░
 *     ▓▓▓▓▓▓▓▓
 *
 * ↻ ⚓ NATE 2026-08-09: THEY NO LONGER ABUT. "Band A and Band B of the toolbar
 * need to be split by the same gap as everywhere else" — he has a purpose in
 * mind for the two bands that he'll share later; this is the structural half of
 * it landing early. One consequence is already banked: the note below about the
 * bands having to travel together, because a screen-locked A abutting a
 * world-locked B would tear at their shared seam, no longer applies — THERE IS
 * NO SHARED SEAM. If band A is ever to become screen-locked HUD beside the
 * ribbon, this is the change that unblocks it.
 *
 * The split is a RULE about what a control is, not a place to put things:
 *
 *   BAND A — the DOCUMENT.  Which working team am I editing, and what can I do
 *            to it as a whole (save · load · share · reset). Identical content
 *            in the planner and the Team Builder, because since the bench-band
 *            round they edit ONE document (rotationTabs).
 *   BAND B — the VIEW.  What am I looking at inside this tool, and how (the
 *            planner's zoom/notes, the TB's Atlas/Roster/Compare + con lens,
 *            the Visualizers' per-tile instrument pickers).
 *
 * ⚠ THE BANDS TRAVEL WITH THEIR TOOL. Band A was going to be screen-locked HUD
 * beside the ribbon (it is document-scoped, and the ribbon is the site's
 * persistent document HUD) — but the moment A and B ABUT they are one object,
 * and a screen-locked A over a world-locked B tears at their shared seam on
 * every tool→tool leg. So both bands are part of the tool surface and drift
 * with it. Continuity across the fade is still the ribbon, exactly as before;
 * band A merely cross-dissolves into an identical band A, since the planner
 * and the Team Builder render the same components into it.
 *
 * All knobs — Nate tunes these in the inspector.
 */
// ⚠ The .ts extension is load-bearing — see toolGutter.ts's note on it.
import { TOOL_GUTTER } from './toolGutter.ts';

/**
 * The DOCUMENT band's height. Sized to seat a `.tab--lg` (29px) with a little
 * air, since the document tabs are the tallest thing it carries.
 */
export const BAND_A_H = 36;

/**
 * The VIEW band's height. Deliberately shorter than band A — the view controls
 * are `.btn`/`.segment` scale, and the step down reads as the second tier of a
 * header rather than a second bar of equal weight.
 */
export const BAND_B_H = 32;

/**
 * Bare scene between the band stack's bottom and the tool surface's top.
 *
 * ↻ 2026-08-08 (breathing-room round): derived from TOOL_GUTTER rather than
 * declared. This is the VERTICAL face of a tool's one interior rhythm; the
 * horizontal face is COLUMN_GAP, and both now move together.
 */
export const BAND_STACK_GAP = TOOL_GUTTER;

/**
 * Bare scene BETWEEN the two bands (⚓ NATE 2026-08-09).
 *
 * The same gutter as everything else, which is the point of it — "split by the
 * same gap as everywhere else". It is a separate constant from BAND_STACK_GAP
 * only so the two can be told apart when reading the stack; they are the same
 * rhythm and should move together unless there is a reason not to.
 */
export const BAND_GAP = TOOL_GUTTER;

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
 *
 * ↻ 2026-08-09: now applied per BAND rather than to a clipping wrapper. When
 * they abutted, only the four outer corners rounded and the seam stayed square;
 * split, each band rounds all four of its own. The trial gets twice the
 * evidence, which is a small bonus of the split.
 */
export const BAND_RADIUS = 1;

/** Full height of the two-tier object, INCLUDING the gap between the tiers. */
export const BAND_STACK_H = BAND_A_H + BAND_GAP + BAND_B_H;

/**
 * How far a tool's SURFACE starts below the top of its band stack — the number
 * every vertical alignment in the round derives from. The bench ribbon's head
 * adds it (see RIBBON_HEAD), and the Team Builder tunes its own tab-row gap
 * against it so both frame tops still land on the same y.
 */
export const BAND_STACK_TO_SURFACE = BAND_STACK_H + BAND_STACK_GAP;
