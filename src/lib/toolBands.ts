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
 *     ▓▓▓▓▓▓▓▓▒▒▒▒  ▒▒▒▒      ▒▒▒ ▒▒    ← band A: NO BAND. Free glass controls
 *     ▓▓▓▓▓▓▓▓                            standing on the scene.  BAND_A_H
 *     ▓▓▓▓▓▓▓▓                          ← BAND_GAP of bare scene
 *     ▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    ← band B   (glass)  BAND_B_H
 *     ▓▓▓▓▓▓▓▓                          ← BAND_STACK_GAP of bare scene
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░    ← the tool surface
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░
 *     ▓▓▓▓▓▓▓▓
 *
 * ↻ ⚓ NATE 2026-08-09, THE SECOND MOVE: BAND A LOST ITS BAND. The split above
 * was the structural half of a purpose Nate had in mind; this is the purpose.
 * The DOCUMENT controls are not contents of a rail any more — each is its own
 * glass object on the scene, at the same 36px rhythm, with no container padding
 * insetting them from the tool below. Band B keeps its rail, and having become
 * the only banded row it grew (see BAND_B_H) to carry a tool's navigation.
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
 *
 * ↻ 2026-08-09: band A no longer PAINTS anything (see ToolStack) — this is now
 * just the row its free-standing glass controls are centred in. The number is
 * unchanged on purpose: the controls kept their size, so the row they need did
 * too, and every downstream offset stays where it was.
 */
export const BAND_A_H = 36;

/**
 * The VIEW band's height.
 *
 * ↻ ⚓ NATE, twice in two days: 32 → 38 (the Team Builder's navigation moved in,
 * and a band carrying a tool's primary navigation has to seat it) → 36, which
 * is BAND_A_H. The two rows are one rhythm now — "let's make all of the Band A
 * / Band B items 36px". The original reason B was shorter, so it would read as
 * a second tier under A, died when A stopped being a band at all.
 */
export const BAND_B_H = 36;

/**
 * The height of a BAND CONTROL — every glass plate standing in either row
 * (⚓ NATE 2026-08-10). Equal to both band heights on purpose: a control fills
 * its row exactly, so the two bands read as a run of objects at one height
 * rather than as rails with things floating inside them.
 *
 * ⚠ The icon-only controls are the stated exception — "except for their
 * slightly smaller + and ... buttons". Those are `.btn--icon`; see app.css.
 */
export const BAND_CTRL_H = 36;

/**
 * The gap BETWEEN CONTROLS inside a band row — tab to tab, button to button,
 * and (2026-08-10) the Team Builder's Clear-team · navigation rail · con-lens
 * split.
 *
 * ⚓ NATE: "make it the same as the gap between band A buttons." It was two
 * near-identical values before this — .25rem in the actions zone, .35rem in the
 * tab strip — which is the kind of drift a named constant exists to stop. Both
 * moved onto this.
 */
export const BAND_ITEM_GAP = 4;

/**
 * Bare scene between the band stack's bottom and the tool surface's top.
 *
 * ↻ 2026-08-08 (breathing-room round): derived from TOOL_GUTTER rather than
 * declared. This is the VERTICAL face of a tool's one interior rhythm; the
 * horizontal face is COLUMN_GAP, and both now move together.
 */
export const BAND_STACK_GAP = TOOL_GUTTER;

/**
 * Bare scene BETWEEN the two bands.
 *
 * ↻ ⚓ NATE 2026-08-10: HALF the gutter, and the reason it stopped being the
 * full one is that the two bands stopped being two tiers. It landed at
 * TOOL_GUTTER the day they were split, when the point being made was that they
 * are separate objects; now that band A is a run of loose plates and band B is
 * a run of loose plates, a full gutter between them read as two unrelated rows
 * rather than as one header with two lines in it. Half is enough to keep them
 * apart and not enough to divorce them.
 *
 * ⚠ It is a HALF of the rhythm, not a new number. BAND_STACK_GAP (band stack →
 * tool surface) stays the full gutter, so the header still separates from the
 * content more than it separates from itself.
 */
export const BAND_GAP = TOOL_GUTTER / 2;

/**
 * Interior padding at each end of a band. Matches the planner frame's own
 * horizontal padding (FRAME_PAD_X = 14) so a control at a band's left edge
 * lines up with the surface content below it.
 *
 * ⚠ BAND B ONLY since 2026-08-09. Band A has no ground for its controls to be
 * held off, so it zeroes this — its first control starts at the content margin,
 * flush with the tool surface below.
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
