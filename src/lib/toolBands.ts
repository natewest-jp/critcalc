/**
 * THE TOOL BANDS (⚓ NATE 2026-08-07) — the toolbar round.
 *
 * Every tool's controls used to be a bare row of chips floating on the scene,
 * 8px above the tool frame and unattached to anything: three competing top
 * edges (toolbar 72, ribbon 98, frame 109) within 38px of each other, and the
 * row jumped 192px sideways between the benched tools and the Visualizers.
 *
 * They are now TWO ABUTTING BANDS — one object, its own ground, standing clear
 * of the tool surface, with the bench ribbon proud of the whole stack:
 *
 *     ▓▓▓▓▓▓▓▓                          ← ribbon, RIBBON_OVERHANG_Y proud
 *     ▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    ← band A   (ctx-dark)   BAND_A_H
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░    ← band B   (ctx-light)  BAND_B_H
 *     ▓▓▓▓▓▓▓▓                          ← BAND_STACK_GAP of bare scene
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░    ← the tool surface
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░
 *     ▓▓▓▓▓▓▓▓
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

/** Bare scene between the band stack's bottom and the tool surface's top. */
export const BAND_STACK_GAP = 8;

/**
 * Interior padding at each end of a band. Matches the planner frame's own
 * horizontal padding (FRAME_PAD_X = 14) so a control at a band's left edge
 * lines up with the surface content below it.
 */
export const BAND_PAD_X = 14;

/**
 * The stack's outer radius. One step tighter than the tool frame's 9 (the
 * 3/6/9 scale): the bands are a header over the surface, so they read as the
 * smaller-cornered object sitting on it. The A/B seam is SQUARE — they abut,
 * and the stack clips its children, so only the four outer corners round.
 */
export const BAND_RADIUS = 6;

/** Full height of the two-tier object. */
export const BAND_STACK_H = BAND_A_H + BAND_B_H;

/**
 * How far a tool's SURFACE starts below the top of its band stack — the number
 * every vertical alignment in the round derives from. The bench ribbon's head
 * adds it (see RIBBON_HEAD), and the Team Builder tunes its own tab-row gap
 * against it so both frame tops still land on the same y.
 */
export const BAND_STACK_TO_SURFACE = BAND_STACK_H + BAND_STACK_GAP;
