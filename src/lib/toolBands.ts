/**
 * THE TOOL BANDS (⚓ NATE 2026-08-07) — the toolbar round.
 *
 * Every tool's controls used to be a bare row of chips floating on the scene,
 * 8px above the tool frame and unattached to anything: three competing top
 * edges (toolbar 72, ribbon 98, frame 109) within 38px of each other, and the
 * row jumped 192px sideways between the benched tools and the Visualizers.
 *
 * They are TWO SEPARATE BANDS standing clear of the tool surface, with the
 * bench ribbon running the whole stack's height beside them:
 *
 *     ▓▓▓▓▓▓▓▓▒▒▒▒  ▒▒▒▒      ▒▒▒ ▒▒    ← band A: NO BAND. Free glass controls
 *     ▓▓▓▓▓▓▓▓                            standing on the scene.  BAND_A_H
 *     ▓▓▓▓▓▓▓▓                          ← BAND_GAP of bare scene
 *     ▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    ← band B   (glass)  BAND_B_H
 *     ▓▓▓▓▓▓▓▓                          ← BAND_STACK_GAP of bare scene
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░    ← the tool surface
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░
 *     ▓▓▓▓▓▓▓▓
 *
 * ↻ ⚓ NATE 2026-08-17: THE RIBBON'S TOP EDGE IS BAND A'S TOP EDGE — the two
 * ▓ and ▒ runs start on the same line above, where the strip used to open
 * RIBBON_OVERHANG_Y (12px) earlier. See that constant for why the cards do not
 * move when it changes.
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
 *   BAND A — the DOCUMENT.  Which document am I editing, and what can I do
 *            to it as a whole (save · library · share). Each tool's own
 *            document: the planner's rotation tabs, the Team Builder's boards
 *            (↻ lineups round, 2026-10-08 — they no longer share one).
 *   BAND B — the VIEW.  What am I looking at inside this tool, and how (the
 *            planner's zoom/notes/layers, the TB's panes + con lens,
 *            the Visualizers' per-tile instrument pickers).
 *
 * ⚠ THE BANDS TRAVEL WITH THEIR TOOL. Band A was going to be screen-locked HUD
 * beside the ribbon (it is document-scoped, and the ribbon is the site's
 * persistent document HUD) — but the moment A and B ABUT they are one object,
 * and a screen-locked A over a world-locked B tears at their shared seam on
 * every tool→tool leg. So both bands are part of the tool surface and drift
 * with it.
 *
 * All knobs — Nate tunes these in the inspector.
 */
// ⚠ The .ts extension is load-bearing — see toolGutter.ts's note on it.
import { TOOL_GUTTER } from './toolGutter.ts';

/**
 * The DOCUMENT band's height — ⚓ NATE 2026-08-10: "only the height of its
 * tallest buttons". It is a MEASURED number, not a designed one: 28.22px is
 * what a `.tab` comes out at (0.32rem of padding top and bottom around a 12px
 * line at 1.5), and it is the tallest thing band A carries — the `.btn`s are
 * 25.22 and the icon-only ones 22. Rounded up to 29 so nothing is clipped by a
 * fraction of a pixel.
 *
 * ↻ 27 → 29 the same day, and this is the warning below doing its job: the
 * type size-up moved controls from 11px to 12px, the tab grew 26.72 → 28.22,
 * and it began overflowing a row with no slack in it. Re-measured, not guessed.
 *
 * ↻ It was 36 from the toolbar round until now, which was right while band A
 * was a RAIL that seated its controls with air around them. Band A stopped
 * being a rail on 2026-08-09 (see ToolStack) and the air went on being reserved
 * anyway — 9px of nothing that read as the document row hanging away from the
 * view row. With no ground there is nothing for a control to be inset from, so
 * the row is exactly its contents.
 *
 * ⚠ RE-MEASURE THIS IF A BAND A CONTROL'S TYPE OR PADDING MOVES. The row no
 * longer has slack to absorb a taller control: it would simply overflow, and
 * the first thing you would see is the bench ribbon's head landing 1–2px off
 * (RIBBON_HEAD derives from BAND_STACK_TO_SURFACE, below).
 */
export const BAND_A_H = 29;

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
 * The height of a BAND CONTROL — every glass plate standing in BAND B
 * (⚓ NATE 2026-08-10). Equal to BAND_B_H on purpose: a control fills its row
 * exactly, so band B reads as a run of objects at one height rather than as a
 * rail with things floating inside it.
 *
 * ⚠ BAND A IS NOT ON THIS, and was only briefly. It matched for one evening and
 * Nate undid it the next morning: band A's controls are ~27px of type and
 * padding, and stretching them to fill BAND_A_H made the DOCUMENT row read as
 * the heavier of the two, which is backwards — band B is the one carrying a
 * tool's navigation. Band A's controls take their natural height and centre in
 * their row. See app.css's `.band-b .tab, .band-b .btn` rule.
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
 * ↻ ⚓ NATE 2026-08-10, TWICE IN A DAY: TOOL_GUTTER → half of it → this, the gap
 * BETWEEN BUTTONS. The two bands are no longer two tiers with a rhythm between
 * them; they are one grid of plates that happens to be two rows deep, and the
 * distance between two plates in that grid should not depend on whether they
 * are side by side or stacked. So the header spaces itself the way its own
 * contents do.
 *
 * ⚠ It is BAND_ITEM_GAP, not a number of its own — move that and this moves.
 * BAND_STACK_GAP (band stack → tool surface) stays the full gutter, which is
 * what now carries the whole of the separation between the header and the
 * content: the header no longer separates from itself at all.
 */
export const BAND_GAP = BAND_ITEM_GAP;

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
