/**
 * src/lib/benchBand.svelte.ts
 *
 * Shared state for the BENCH BAND — the Planner's slot cards (bench-band
 * round, 2026-08-05; ↻ the Planner's alone since the lineups round,
 * 2026-10-08). The band itself is rendered by the (tools) layout, OUTSIDE the
 * keyed .tool-page layers, so it survives page revival and rides the pan
 * clock in and out. This module is what the band and its host agree through:
 *
 * - Host registration: the planner registers its bench affordances on mount
 *   (a filled portrait opens the Detail card; ⇄ and an empty portrait go to
 *   the Team Builder's swap mode). Keyed by tool — see `#hosts`.
 *
 * - Slot metrics: the planner's timeline publishes its per-slot block heights
 *   (they vary with buff/summon rows) so the band's cards align to their
 *   track groups DATA-driven, never DOM-coupled. Ownership-guarded.
 *   `blankUsed` marks slots where the generic Blank kit is actually cast
 *   in the notation — those render as a real "Blank" card; unused blanks stay
 *   empty add-slots.
 *
 * Card geometry constants live here too — the band uses them as its resting
 * rhythm, and ToolStack reserves its footprint with them.
 */

// ⚠ Extensions are load-bearing on these two — see toolGutter.ts. This file is
// a geometry module in the same family, and Node's native type stripping (what
// scripts/probe-*.mjs run under) does no extension inference.
import { BAND_STACK_TO_SURFACE } from './toolBands.ts';
import { RIBBON_GAP } from './toolGutter.ts';

/**
 * ⚓ NATE 2026-08-12: the portrait behaves as it does in the Team Builder —
 * "it pulls up the modal of the character's details… it teaches the user
 * that it's the exact same set of actions regardless of the tool they're on."
 *
 * - a FILLED portrait opens that character's Detail card;
 * - ⇄ on a filled slot, an EMPTY portrait, and a typed Blank's portrait ask
 *   the host to swap — which the planner answers by sending the slot to the
 *   Team Builder's swap mode (replacing, or ADDING on an empty slot, ⚓ Nate
 *   2026-10-13). There are no details for nobody, and "click the empty disc
 *   to fill it" is the one thing that must not stop working.
 *
 * ↻ 2026-10-08 the Team Builder left the bench (lineups design §2.1), and
 * 2026-10-13 its audition retired into swap mode: the planner is the only
 * host. The registry stays KEYED BY TOOL (see `#hosts`) — the hazard it
 * guards is page revival, not the number of tools.
 */
export type BenchHostRegistration = {
	tool: 'rp';
	/** Filled-slot portrait click — the character's Detail card. */
	onOpenDetail: (id: string) => void;
	/** ⇄, and an empty slot's portrait (`incumbentId` null on an empty
	 *  slot): the Team Builder's swap mode on that slot. */
	onSwap: (index: number, incumbentId: string | null) => void;
};

/**
 * ══ THE CARD IS A ROW, NOT A STACK (⚓ NATE's mockup, the bench-card round
 *    2026-08-12) ═══════════════════════════════════════════════════════════
 *
 *   ┌────────────────────────────────────────────────┐
 *   │ ┌──┐                                           │  ← name top-aligned to
 *   │ │⇄ │  ╭────────╮   ⬡ Neuvillette               │    the disc's top edge
 *   │ ├──┤ (  PORTRAIT )                             │
 *   │ │✕ │  ╰────────╯   ⓒ  ( ▣ ⚔¹ )                │  ← controls bottom-
 *   │ └──┘                                           │    aligned to its bottom
 *   └────────────────────────────────────────────────┘
 *     rail   68 disc      name + value controls
 *
 * WHY IT MOVED. The old card stacked three bands — identity / portrait /
 * loadout — and the outer two were FIXED at 86px between them, so the portrait
 * was the only thing that could absorb a change in slot height. After two
 * condensing rounds the timeline asked for 82–122px and the card floored every
 * slot at 126, which left the disc at 40px on a typical rotation: the smallest
 * object on the card, beside a 26 × 128px band of chrome. ⚓ Nate: the portrait
 * IS the read — "seeing that avatar with the elemental-colored border is the
 * immediate read", and it was the one thing losing.
 *
 * A name BESIDE a portrait is free — it lives in space the disc's height has
 * already paid for. A name BELOW one costs its own line box plus a gap, every
 * time. That single fact is why every centred variant lost by ~20px, and it is
 * the whole argument for the row.
 *
 * WHAT IT BOUGHT: the card is 86px tall with a FULL 68px disc, where it was
 * 126px tall with a 40px one. Both axes improved at once, and the card stopped
 * being the binding constraint — 86 sits under the timeline's own busy ask
 * (122) and 4px over its sparse one (82), so slots are rows-driven again.
 *
 * ⚗️ RETIRED HERE: `BENCH_PORTRAIT_SHOWN`, the flag that measured this. Its own
 * note said it "MUST NOT OUTLIVE THE LOOK IT WAS BUILT FOR", and the look is
 * built — with the row layout a portrait-less card is 68px of empty text column
 * plus padding, i.e. the same 86, so the flag could not measure anything any
 * more. What it found is recorded above instead.
 */

/** The converged slot-card width (RotationTimeline's LABEL_W imports this).
 *
 *  ⚓ NATE 2026-10-13: THE RIBBON IS AS WIDE AS THE BRAND above it — the
 *  critcalc.app mark + wordmark, ⛔ NOT the BETA tag (it will be dropped).
 *  MEASURED, not derived: the mark's ink starts at the tool gutter (32px, the
 *  ribbon's own left edge) and the wordmark's INK ends at 234.96 (its box at
 *  236.47 — trailing letter-spacing + the p's side bearing), so the ribbon
 *  measured 203. 🎛️ tune(nate): 210 by eye (205 → 207 → 208 → 210), so
 *  the card is 210 − 2 × RIBBON_CHROME = 186 — his value, ⛔ never re-derived. ⚠ RE-MEASURE if the
 *  wordmark's face, size or tracking moves (SiteChrome `.chrome-wordmark`),
 *  or if the mark is redrawn.
 *
 *  The portrait round first cut it 200 → 165: The side portrait
 *  carries the constellation, the rail and the element badge are gone, so the
 *  card is pad 6 + portrait 60 + inset 6 + an 87px column + pad 6 (the
 *  control row needs 54; "Kuki Shinobu" at --fs-lg is 87.8 and may wrap — the
 *  two-line clamp allows it). The 35px goes back to the chart.
 *
 *  The history below is the 200's.
 *
 *  🎛️ ⚓ NATE, bench-card round: 160 → 200. This is the width at which NOTHING
 *  in the card has to shrink — the text column lands at 84px, which is exactly
 *  a constellation chip (26) + gap (4) + the two-zone loadout pill (54), and a
 *  2-line name at --fs-lg. Below ~180 the value controls have to give something
 *  up; above it, the chart pays for space the card cannot use.
 *
 *  ⚠ THE PLANNER PAYS FOR THIS IN CHART WIDTH, and that is the good direction
 *  of the trade: horizontal is scrollable AND zoomable in a Gantt, vertical is
 *  neither. 40px of tracks (~3% at 1600) buys 40px × 4 slots of height. */
export const BENCH_CARD_W = 186;

/** 🎛️ The portrait disc, which is also THE CARD'S WHOLE HEIGHT — the band, the
 *  rail's two tiles, and the column's two rows all derive from it.
 *
 *  ⚓ NATE 2026-08-12, second pass: 68 → 60. "68px turned out to be the right
 *  size back when the RP's bars were bigger." It was set against a 158px slot
 *  and never re-judged against the condensed one.
 *
 *  Also the CAP, not a floor: the disc takes its host band's height and shrinks
 *  if given less (see .sp-avatar-chip), so the floor below is what stops it
 *  being given too little.
 *  ⚠ DON'T GROW IT. The side avatars are 128² and the card's framing transform
 *  scales 1.25×, so a 68px disc already asks for ~170 device px from a 128px
 *  source on a retina display. It is fine here and visibly soft past ~100. */
export const CARD_PORTRAIT = 60;

/** The card's own padding, top + bottom (`.sp-card` — 8 over, 10 under). */
export const CARD_PAD_Y = 18;

/**
 * ══ WHAT ONE CARD NEEDS ════════════════════════════════════════════════════
 * The card is ONE band the height of its portrait, plus padding:
 *
 *     padding 8 + 10  +  disc 60  =  78
 *
 * ⚠ THE DISC IS THE ONLY THING THAT SETS IT NOW. Everything beside it derives
 * FROM the band rather than competing with it: the rail splits the band into
 * two tiles, the column splits it into two rows on the same grid, and each row
 * centres its content on its tile (see .sp-col). So the column can never ask
 * for more height than the portrait — which is what makes 60 a free choice and
 * not a negotiation.
 *
 * 🎛️ Lower it only by shrinking CARD_PORTRAIT, which is what the floor is FOR:
 * the disc is capped rather than floored on its own side, so nothing else would
 * catch a slot too short to hold it (a fixed disc that cannot shrink SPILLS —
 * that bug shipped once already).
 */
export const BENCH_SLOT_MIN_H = CARD_PORTRAIT + CARD_PAD_Y;

/**
 * The band's resting rhythm: one card at the planner's BASELINE slot height —
 * what the cards show before the timeline has published any heights.
 *
 * ↻ 2026-08-11: was 158, a hand-copied sum of RotationTimeline's constants that
 * went stale the moment those constants moved — twice in one day. It is the
 * floor now, which is the same number for every typical rotation (the timeline
 * asks for less than the card does) and, more to the point, is a number that
 * cannot drift because it is DERIVED rather than transcribed.
 */
export const BENCH_SLOT_H = BENCH_SLOT_MIN_H;

/** Full resting column height (borders live INSIDE the border-box heights). */
export const BENCH_COLUMN_H = 4 * BENCH_SLOT_H;

// ---------------------------------------------------------------------------
// The RIBBON (Nate's mockup, 2026-08-05): the band is a SELF-CONTAINED box —
// its own ground, frame and radius, ONE identity in both tools (always the
// dark context; the per-tool ctx flip is retired).
//
// ↻ TALL-BENCH ROUND (Nate's mockup #2, 2026-08-06): the ribbon is a full
// STRIP — it spans its tool frame's whole height and stands RIBBON_OVERHANG_Y
// proud at BOTH ends, so it always reads as slightly taller than the surface
// beside it. Its height is therefore MEASURED from the dock (which stretches
// with the frame), not summed from the cards; the cards keep their track-group
// alignment at the top and the tail below them is deliberately empty.
// ⚠️ BOTH HALVES OF THAT ARE NOW RETIRED and the paragraph is kept as history:
// the TAIL round (2026-08-12) replaced the measured stretch with a pointed,
// content-sized box, and RIBBON_OVERHANG_Y went to 0 on 2026-08-17. What
// survives is the middle sentence — the cards' track-group alignment.
//
// ↻ ABUTTING ROUND (⚓ NATE 2026-08-07): the tools no longer TUCK UNDER the
// strip — each begins at its right edge, and the strip stands alone on the
// scene. The old arrangement (frame ground running the strip's full width
// beneath it) was invisible at rest but wrong in motion: on a Visualizers leg
// the ribbon is part of the tool surface and fades in exact lockstep with the
// frame, so across the overlap you saw the tool THROUGH the bench — two
// layers of tool ground compositing where there should be one
// (`0.42·ribbon + 0.24·frame + 0.34·scene` at mid-fade, measured). Two
// surfaces that fade together must not overlap. Now they tile: the ribbon
// owns the column at the content margin, the tool starts after it, and both
// fade over the bare scene.
//
// All knobs — Nate tunes these in the inspector.
// ---------------------------------------------------------------------------

/**
 * The ribbon's chrome, outside → in (Nate's mockup, measured off the 2× image):
 *
 *   ┌─ ground edge, radius RIBBON_RADIUS ─────────
 *   │  ← RIBBON_EDGE (bare ground, no stroke)
 *   │  ┌─ the double frame: TWO stacked strokes ──
 *   │  │  ← RIBBON_PAD
 *   │  │   card …
 *
 * The "double border" is two strokes on the SAME box at the same inset, so
 * their straight runs coincide exactly and only their CORNERS differ: one
 * tight (RIBBON_FRAME_R_TIGHT), one wide (RIBBON_FRAME_R_WIDE) sweeping
 * across it — that arc is the "extra rounded corner inside".
 */
export const RIBBON_EDGE = 5;
/** Each of the two stacked frame strokes. */
export const RIBBON_FRAME_BORDER = 2;
/**
 * Interior padding between the inner frame and the card column.
 * ⚓ NATE 2026-08-12: 9 → 5, "to match the gap on the other side of the inset
 * border" — i.e. RIBBON_EDGE. The strip's chrome is symmetric about its own
 * frame now: 5 of bare ground outside the stroke, 5 of it inside.
 * ⚠ This is the card's ONLY side inset — .sp-card's horizontal padding went to
 * 0 in the same pass, because two nested paddings is exactly the doubling this
 * was trimming.
 */
export const RIBBON_PAD = 5;
/** The ground's outer radius (3/6/9 scale — ⚓ NATE 2026-08-06). */
export const RIBBON_RADIUS = 3;
/** The double frame's tight corner. */
export const RIBBON_FRAME_R_TIGHT = 3;
/**
 * The double frame's WIDE corner — the arc that cuts across the tight one.
 * ⚓ NATE 2026-08-06: 27px, tuned by eye (9 was far too small to read as a
 * second corner; the mockup measured ≈13 and he went further still).
 *
 * Deliberately NOT promoted to app.css's --r-* scale. That scale is the BOX
 * vocabulary — "what shape is this container's corner" — and 3/6/9 answers it
 * for every panel, chip and card on the site. 27 answers a different question:
 * it is an ornamental arc that only means anything inside this two-stroke
 * technique, and dropping it into the scale would invite it onto a card. If the
 * double frame is ever reused, promote the TECHNIQUE (inset + two strokes +
 * this radius pair + --frame-line-quiet) as one unit, not the number alone.
 */
export const RIBBON_FRAME_R_WIDE = 30;

/** Total chrome per side: bare ground + stroke + interior pad. */
export const RIBBON_CHROME = RIBBON_EDGE + RIBBON_FRAME_BORDER + RIBBON_PAD;
/** Full ribbon width — the dock anchor reads this. */
export const RIBBON_W = BENCH_CARD_W + 2 * RIBBON_CHROME;

/**
 * ⚓ NATE 2026-08-06 — the strip's outer edge sits on the CONTENT MARGIN: the
 * same left edge as the logo and the site chrome. It stands proud of its tool
 * VERTICALLY (see RIBBON_OVERHANG_Y) and nowhere else.
 *
 * The tool frame's own edge stroke. Both docks position THROUGH it (absolute
 * insets resolve against the padding box, which the border insets from the
 * border box), so it is named rather than inlined — the edge-border retirement
 * that is coming for the frame family changes this one number to 0 and the
 * docks stay put.
 */
export const FRAME_BORDER = 1;

/**
 * Bare scene between the strip's right edge and the tool beside it.
 * ↻ 2026-08-08: the knob LIVES IN $lib/toolGutter now (a pure spacing number
 * had no business in a runes module, and probes cannot import one at all —
 * see the note there). Re-exported so existing callers are unaffected.
 */
export { RIBBON_GAP };

/**
 * How far a benched tool's own surfaces — its tab row and its frame — start
 * from the content margin. The strip's column plus the gap: the tool begins
 * exactly where the ribbon ends and never runs beneath it (see the abutting
 * round above).
 */
export const TOOL_INSET = RIBBON_W + RIBBON_GAP;

/**
 * The dock anchors' `left`: each sits inside its own frame, whose padding box
 * is TOOL_INSET + FRAME_BORDER right of the content margin — so this walks
 * back out to it. Negative by construction; the strip hangs entirely outside
 * the frame it measures.
 *
 * ↻ TOOLBAR ROUND 2026-08-07: no longer used by either tool. The dock moved
 * OUT of the frame and onto the tool STACK (bands + surface — see ToolStack),
 * whose padding box already starts at the content margin, so the anchor sits
 * at left: 0 and this walk-back has nothing to correct. Kept only because the
 * derivation is the record of why the anchor used to need it; delete once
 * nothing cites it.
 */
export const RIBBON_DOCK_LEFT = -(TOOL_INSET + FRAME_BORDER);

/**
 * ⚓ NATE 2026-08-06 — how far the strip stands proud of its tool frame.
 *
 * ↻ TAIL ROUND 2026-08-12: AT THE TOP ONLY. It used to mean both ends — the
 * tall-bench idea was that the ribbon extends past whatever height its tool
 * happens to have, so it always reads as the taller object. The bottom half of
 * that retired with the stretch: the strip ends in a POINT now, and a point
 * does not overhang anything, it just stops. Only RIBBON_HEAD reads this.
 *
 * ↻ 12 → 0 (⚓ NATE 2026-08-17): THE TOP EDGE MEETS BAND A'S. The last thing
 * the overhang was still doing was the tall-bench idea's other half — reading
 * as the taller object — and with a pointed bottom the strip already terminates
 * differently from everything beside it, so the 12px was buying a difference
 * that the silhouette states more clearly on its own. What it COST is an edge
 * that lines up with nothing: the topmost horizontal in the tool, 12px above
 * the row of document controls it stands beside.
 *
 * ⚠ THE CARDS DO NOT MOVE, and the algebra is why this is safe to change on
 * its own: the card column sits at `ribbon top + RIBBON_CHROME + RIBBON_HEAD`,
 * RIBBON_HEAD adds this value back, and the dock subtracts it from the stack
 * top — so it cancels exactly. Zero is not a special case of that; it is the
 * same sum with the term gone.
 *
 * ⛔ Kept as a named constant at 0 rather than deleted. It is the ONE knob for
 * this relationship, and inlining zero would leave the next person adding a
 * `top: -Npx` somewhere in ToolStack instead.
 */
export const RIBBON_OVERHANG_Y = 0;

/**
 * The planner's track rows, measured from its surface's top. The card column
 * must land exactly there (each card labels its track group), which fixes
 * everything below.
 *
 * ↻ 2026-08-11 (the timeline round): was `1 + 10 + 28` — a frame border, the
 * frame's top padding, and the ruler. The first two left with the frame itself
 * (the timeline renders straight onto the scene now; see .rp-frame in
 * RotationTimeline), so this is RULER_H alone and the whole chart, cards
 * included, rises 11px. That is the cheapest height this round recovers: it
 * costs nothing and removes two numbers from the sum.
 *
 * ↻ 2026-08-17: it is the RESTING value now, not the only one. The timeline
 * PUBLISHES its live distance through `benchBand.trackTop`, because that
 * distance stopped being a constant the moment a second band could sit above
 * the ruler. This constant is what the ribbon uses before any timeline has been
 * mounted — and it is still hand-mirrored from RULER_H, so ⚠ if the ruler's
 * height moves, this moves.
 */
export const RIBBON_FRAME_TOP_INSET = 28;

/**
 * Dead space between the ribbon's interior top and the FIRST card — the strip
 * now opens above the timeline's ruler, so the cards sit this far down inside
 * it.
 *
 * ↻ TOOLBAR ROUND 2026-08-07: the ribbon now stands proud of the BAND STACK,
 * not of the frame — its dock spans bands + surface — so the head grows by
 * exactly the distance from the stack's top to the surface's. The card column
 * has not moved relative to the timeline's track rows; there is simply more
 * ribbon above it. ⚓ NATE: that new emptiness is where the decorative motif
 * goes.
 *
 * ↻ 2026-08-17: A FUNCTION OF THE PUBLISHED TRACK TOP, not a constant. Called
 * with `benchBand.trackTop`, which the planner's timeline publishes.
 */
export function ribbonHead(trackTop: number): number {
	return BAND_STACK_TO_SURFACE + trackTop + RIBBON_OVERHANG_Y - RIBBON_CHROME;
}

/** The head at rest — no timeline mounted, so no published track top. */
export const RIBBON_HEAD = ribbonHead(RIBBON_FRAME_TOP_INSET);

/** Resting ribbon interior above/below the card column — retained as the
 *  content-height reference for a bench with four baseline slots. Since the
 *  tail round the box is content-sized, so nothing measures against a dock. */
export const RIBBON_RESTING_H = BENCH_COLUMN_H + RIBBON_HEAD + 2 * RIBBON_CHROME;

// ═══════════════════════════════════════════════════════════════════════════
// THE ROW (responsive round, 2026-09-05) — below BP.toolMin the ribbon turns
// HORIZONTAL: a strip of four cards ABOVE the band stack, spanning the tool's
// full width, instead of a column beside it.
//
// ⚓ WHY IT EXISTS: the survey (docs/responsive-survey-2026-09-01.md § 7)
// walked the planner's min-content chain and found its 852px minimum was
// never the Gantt — the timeline scrolls — but ~240px of reserved ribbon
// column plus a 564px control row. The column is this. Horizontal, the bench
// hands the 240px back and the planner fits from ~600px; the Team Builder
// from ~530px (and from 320 once its band B folds).
//
// ⚠⚠ WHY IT IS NOT HORIZONTAL EVERYWHERE: the trade is the planner's ABUNDANT
// axis for its SCARCE one. Horizontal is scrollable and zoomable in a Gantt;
// vertical is neither, and CLAUDE.md records the planner's vertical as already
// spent to the last 24px. So the orientation is RESPONSIVE — a column where
// width is cheap, a row where it is dear — and the seam is ToolStack's
// `--stack-inset`, which already switched on `benched`.
//
// ⚠ IN THE ROW THE CARDS STOP LABELLING TRACK GROUPS. The column's whole
// geometry (RIBBON_HEAD, the published slotHeights) exists to land card k on
// the planner's k-th track group; a row has no rows to land on, so every card
// takes the same height and the head is nothing. That is the one genuine loss
// of the narrow form, and it is bounded: the bench is still the team editor,
// only its alignment with the chart goes.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ══ THE UPRIGHT CARD (bench portrait round, ⚓ Nate 2026-10-13) ════════════
 * The row's ONE form: the side portrait with the loadout pill standing
 * UPRIGHT beside it (flower over weapon), no name and no Swap — swap mode
 * needs the lineup beside the grid, which a phone cannot show, and the
 * notation is the phone's control.
 *
 *       ⟨hair⟩
 *      (  d  )ⓒ▣        card = d + BENCH_ROW_PILL_GAP + BENCH_ROW_PILL_W
 *      (     ) ⚔
 *
 * The portrait takes whatever width four cards get, between a floor and a
 * cap, and the cap IS the card's height — so the strip is one CONSTANT height
 * (BENCH_ROW_H) that ToolStack reserves in pure CSS, nothing measuring the
 * bench to lay out the tool beneath it. It replaced a 78px compact STACK
 * (portrait over a control row), so the planner gets 22px of height back on a
 * phone. ⛔ The desk card no longer appears in the row at any width.
 */

/** 🎛️ The upright pill's width (its zones are 20, the desk's 24 — the width
 *  goes to the portrait). It is ONE button on the phone, so the touch target
 *  is the whole ~22 × 47 pill (WCAG 2.5.8). */
export const BENCH_ROW_PILL_W = 22;
/** 🎛️ Portrait → pill: snug. */
export const BENCH_ROW_PILL_GAP = 2;

/** 🎛️ The upright card's height, which is also its portrait's CAP (the pill is
 *  47 and fits under it). 56 is the portrait a 390px phone gets. */
export const BENCH_ROW_CARD_H = 56;

/** The strip's full height in the row form: chrome above and below one card. */
export const BENCH_ROW_H = BENCH_ROW_CARD_H + 2 * RIBBON_CHROME;

/** Gap between cards in the row. */
export const BENCH_ROW_CARD_GAP = 4;

/** 🎛️ The portrait's floor, solved for the narrowest phone: a 320px viewport
 *  leaves the strip 288 (two 16px gutters), and four cards at 38 need
 *  4 × (38 + 2 + 22) + 3 × 4 + 2 × RIBBON_CHROME = 284 — so all four fit
 *  without scrolling. Portraits by viewport: 38 at 320, 49 at 360, 56 (the
 *  cap) from ~390. */
export const BENCH_ROW_PORTRAIT_MIN = 38;

/** The upright card's width for a given portrait. */
export const rowCardWidth = (d: number) => d + BENCH_ROW_PILL_GAP + BENCH_ROW_PILL_W;

/** The portrait four cards get from a strip `stripW` wide (its frame chrome
 *  included), floored and capped — whole px, so the art lands on the grid. */
export function rowPortrait(stripW: number): number {
	const fit = (stripW - 2 * RIBBON_CHROME - 3 * BENCH_ROW_CARD_GAP) / 4;
	return Math.round(
		Math.max(BENCH_ROW_PORTRAIT_MIN, Math.min(BENCH_ROW_CARD_H, fit - rowCardWidth(0)))
	);
}

/**
 * The double frame as a plain rounded RECTANGLE ring — the row form's frame.
 * The column's frame follows the tail (ribbonFramePath); a row has no tail,
 * so its ring closes at the bottom the way it closes at the top. Same two
 * calls, same two radii, same crossing arcs.
 */
export function ribbonFramePathRect(w: number, h: number, r: number): string {
	const e = RIBBON_EDGE;
	const b = RIBBON_FRAME_BORDER;
	const ri = Math.max(0, r - b);
	const rect = (x0: number, y0: number, x1: number, y1: number, rr: number) =>
		`M ${x0 + rr},${y0} H ${x1 - rr} A ${rr},${rr} 0 0 1 ${x1},${y0 + rr}` +
		`V ${y1 - rr} A ${rr},${rr} 0 0 1 ${x1 - rr},${y1}` +
		`H ${x0 + rr} A ${rr},${rr} 0 0 1 ${x0},${y1 - rr}` +
		`V ${y0 + rr} A ${rr},${rr} 0 0 1 ${x0 + rr},${y0} Z`;
	return rect(e, e, w - e, h - e, r) + rect(e + b, e + b, w - e - b, h - e - b, ri);
}

// ═══════════════════════════════════════════════════════════════════════════
// THE TAIL (⚓ NATE 2026-08-12) — the strip ENDS IN A POINT, Genshin's own
// banner shape, and that single change retires a whole behaviour.
//
// ⚠ WHAT WENT, AND WHY IT COULD: the ribbon used to stretch to
// `max(measured dock height, content)`, padding itself out past its last card
// with empty strip so its bottom edge would meet the tool frame's. ⚓ Nate:
// "it animates to extend down to different heights with no content at all. Its
// only purpose has been to try to line up with edges of tools." A POINT HAS
// NOTHING TO LINE UP — it terminates rather than negotiates — so the box is
// simply head + cards + tail now, and the dock measurement, the `height` prop
// and the travel animation all went with the job they existed to do.
//
// ⚠ AND THE HEIGHT ANIMATION IS GONE ENTIRELY (⚓ Nate, same round). It was
// gated on `traveling`, so it only ever played during the 2s camera crane while
// both tool surfaces were cross-fading — exclusively inside a window designed
// to hide changes. Worth knowing it was near-invisible before you go looking
// for what you lost. It also could not have stayed: with the tail pinned below
// the last card, a banner that eased while the cards snapped (or vice versa)
// would drag the point around behind them.
//
// ⚠ THE BOX STILL SIZES TO CONTENT, and that is not the same as responding to
// the tool. For every typical rotation the timeline asks for less than a card
// needs, so each slot sits at its BENCH_SLOT_H floor and the height is a
// constant — fixed in practice. In the extreme many-bars case the slots grow,
// and they must: each card is exactly as tall as the timeline track group it
// labels, which is what makes the bench read as that group's label. Freezing
// the box would clip the bottom cards and break that alignment.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎛️ The tail's height — a CONSTANT, and deliberately not responsive
 * (⚓ Nate: "we can just make the tail a fixed safe size… it doesn't need to
 * respond"). Only the STRAIGHT RUN above it varies with content; the taper
 * itself never scales. That matters beyond simplicity: scaling the shape would
 * flatten the point and pull the 2px frame line off its declared weight.
 *
 * It doubles as the box's bottom padding, so the cards end exactly where the
 * tail begins — the first TAIL_LEAD px of it are straight, which is the
 * breathing room under the last card.
 */
export const RIBBON_TAIL_H = 100;

/**
 * How far the tail runs STRAIGHT before the taper starts. Read off Nate's
 * artwork (`assets-src/tools/bench-clip-path.svg`, 46.118 at 2×) rather than
 * chosen — and it is the number that makes the splice below exact: above this
 * point both the silhouette and the frame are plain vertical lines, so the
 * generated straight run and the drawn taper meet with nothing to align.
 */
const TAIL_LEAD = 23.059;

/**
 * ⚓ NATE'S ARTWORK, TRANSCRIBED — `assets-src/tools/bench-clip-path.svg` (the
 * silhouette) and `bench-inset-point.svg` (the frame line), both drawn at 2×
 * and halved here. ⛔ Do not re-tune these numbers by eye; redraw the assets
 * and re-transcribe, the same rule the element palette carries.
 *
 * VERIFIED against the ribbon's own knobs when they landed: the silhouette is
 * 448/2 = RIBBON_W, the frame ring 428/2 = RIBBON_W − 2·RIBBON_EDGE, the ring
 * 4/2 = RIBBON_FRAME_BORDER thick — and, the part that is easy to get wrong,
 * the perpendicular distance between silhouette and frame AT THE TIP measures
 * exactly RIBBON_EDGE. A naive "put the inner tip 5px higher" would converge:
 * at this edge's 20.96° the tip has to lift ~14px along the axis to stay 5px
 * away. The artwork is a true parallel offset.
 */
/** The ribbon width Nate's tail artwork was drawn at (2× = 448). */
const TAIL_ART_W = 224;

/**
 * ⚠ STOPGAP until the artwork is redrawn at the current RIBBON_W (bench
 * portrait round, 2026-10-13): each path's x is stretched LINEARLY so its own
 * end points land on its own sides — `inset` (0 silhouette, RIBBON_EDGE ring
 * outer, + RIBBON_FRAME_BORDER ring inner) stays put and `TAIL_ART_W − inset`
 * maps to `RIBBON_W − inset`. The tip still lands on the centre line, but the
 * frame is no longer an exact parallel offset of the silhouette along the
 * taper. ⛔ Delete this the moment the redrawn art is transcribed at
 * TAIL_ART_W === RIBBON_W.
 */
const X = (x: number, inset: number) =>
	+(inset + ((x - inset) * (RIBBON_W - 2 * inset)) / (TAIL_ART_W - 2 * inset)).toFixed(3);

const TAIL = {
	/** Silhouette, x 0…RIBBON_W, y measured from the tail's top. */
	outer: (t: number) =>
		`C ${X(224, 0)},${t + 43.772} ${X(211.229, 0)},${t + 62.34} ${X(191.887, 0)},${t + 69.75}` +
		`L ${X(113.7885, 0)},${t + 99.669}` +
		`C ${X(112.637, 0)},${t + 100.1105} ${X(111.363, 0)},${t + 100.1105} ${X(110.2115, 0)},${t + 99.669}` +
		`L ${X(32.113, 0)},${t + 69.75}` +
		`C ${X(12.771, 0)},${t + 62.34} ${X(0, 0)},${t + 43.772} ${X(0, 0)},${t + 23.059}`,
	/** Frame ring, OUTER edge — the silhouette inset by RIBBON_EDGE. */
	ringOuter: (t: number) =>
		`C ${X(219, 5)},${t + 41.7005} ${X(207.506, 5)},${t + 58.412} ${X(190.0985, 5)},${t + 65.081}` +
		`L ${X(112, 5)},${t + 95}` +
		`L ${X(33.9015, 5)},${t + 65.081}` +
		`C ${X(16.494, 5)},${t + 58.412} ${X(5, 5)},${t + 41.7005} ${X(5, 5)},${t + 23.059}`,
	/** Frame ring, INNER edge — a sharp point; only the silhouette's is capped. */
	ringInner: (t: number) =>
		`C ${X(217, 7)},${t + 40.872} ${X(206.017, 7)},${t + 56.841} ${X(189.383, 7)},${t + 63.2135}` +
		`L ${X(112, 7)},${t + 92.8585}` +
		`L ${X(34.617, 7)},${t + 63.2135}` +
		`C ${X(17.983, 7)},${t + 56.841} ${X(7, 7)},${t + 40.872} ${X(7, 7)},${t + 23.059}`
};

/**
 * The ribbon's SILHOUETTE for a box `h` tall — square top with RIBBON_RADIUS
 * corners, straight sides, Nate's taper. Spent as `clip-path: path(…)`.
 *
 * ⚠ `path()` takes USER UNITS — no percentages, no calc() — which is why this
 * is generated per height rather than written once in CSS. ⛔ And why the
 * obvious alternative is wrong: a `clipPathUnits="objectBoundingBox"` clipPath
 * normalises to 0–1 and would STRETCH the taper with the box, flattening the
 * point on a tall rotation.
 */
export function ribbonClipPath(h: number): string {
	const t = h - RIBBON_TAIL_H;
	const r = RIBBON_RADIUS;
	return (
		`M ${r},0 H ${RIBBON_W - r} A ${r},${r} 0 0 1 ${RIBBON_W},${r}` +
		`V ${t + TAIL_LEAD}` +
		TAIL.outer(t) +
		`V ${r} A ${r},${r} 0 0 1 ${r},0 Z`
	);
}

/**
 * One stroke of the double frame, as a filled RING (evenodd) rather than a
 * stroked centreline: SVG strokes straddle their path, so a stroked version
 * would need every coordinate shifted by half a width and would rasterise
 * differently again from the CSS borders this replaces. The artwork already
 * gives both edges of the band, so the ring is the honest transcription.
 *
 * `r` is the OUTER corner radius — the two calls are what makes the double
 * corner: RIBBON_FRAME_R_TIGHT crossed by RIBBON_FRAME_R_WIDE, exactly as the
 * two CSS boxes did. ⚠ They coincide along the sides and the whole taper, and
 * that is safe ONLY because --frame-line-quiet is opaque (#414752, already
 * composited). If it ever becomes translucent, two overlapping fills would
 * double its density along every straight run — the alpha-stacking law.
 */
export function ribbonFramePath(h: number, r: number): string {
	const t = h - RIBBON_TAIL_H;
	const e = RIBBON_EDGE;
	const b = RIBBON_FRAME_BORDER;
	const xo = RIBBON_W - e; // ring outer edge, right
	const xi = RIBBON_W - e - b; // ring inner edge, right
	const ri = Math.max(0, r - b);
	return (
		// outer edge of the band, clockwise from its top-left corner
		`M ${e + r},${e} H ${xo - r} A ${r},${r} 0 0 1 ${xo},${e + r}` +
		`V ${t + TAIL_LEAD}` +
		TAIL.ringOuter(t) +
		`V ${e + r} A ${r},${r} 0 0 1 ${e + r},${e} Z` +
		// inner edge — evenodd punches it out, leaving a band RIBBON_FRAME_BORDER wide
		`M ${e + b + ri},${e + b} H ${xi - ri} A ${ri},${ri} 0 0 1 ${xi},${e + b + ri}` +
		`V ${t + TAIL_LEAD}` +
		TAIL.ringInner(t) +
		`V ${e + b + ri} A ${ri},${ri} 0 0 1 ${e + b + ri},${e + b} Z`
	);
}

class BenchBandState {
	/**
	 * ⚠ ONE SLOT PER TOOL, NOT ONE SLOT (2026-08-13). This was a single `host`
	 * field, last writer wins, with an identity-guarded unregister to survive the
	 * pan's both-pages-alive window. The guard was not enough, and the hole is
	 * REVIVAL rather than ordering:
	 *
	 *   1. planner mounts          host = P
	 *   2. → another tool          that tool's host (at the time, the Team
	 *                              Builder's) = T; the planner OUTROES but is
	 *                              retained, so it never unregisters
	 *   3. → planner               Svelte cancels the outro and reinserts the SAME
	 *                              component — no second onMount, no re-register,
	 *                              host is still T
	 *   4. the other tool tears down; host === T, so it nulls the host
	 *
	 * …and the bench is left hostless on a planner that is on screen and looks
	 * fine. ⇄ and the portraits go dead until you reload. The (tools) layout
	 * documents this revival at TOOL_NAV_ANIM and answers it by re-deriving in
	 * afterNavigate; a keyed record answers it by never needing a re-derive at
	 * all — a tool's registration is removed only by that tool, and a stale one
	 * is simply the entry `mode` is not asking for.
	 *
	 * ⚠️ It is PRE-EXISTING (measured on 847acdb, where the same round trip kills
	 * the character Source). What changed is the stakes: ⇄ is the planner's
	 * only way to change a slot, and leaving the tool and coming back is the
	 * flow, not an edge case (cross-tool.spec's second ⇄ is the guard).
	 */
	#hosts = $state<Partial<Record<BenchHostRegistration['tool'], BenchHostRegistration>>>({});

	/** The affordances for one tool — null when that tool has none registered. */
	hostFor(tool: BenchHostRegistration['tool'] | null): BenchHostRegistration | null {
		return tool ? (this.#hosts[tool] ?? null) : null;
	}

	/**
	 * Per-slot block heights published by the planner's timeline (px), or null
	 * until one has ever been mounted this session.
	 *
	 * ⚓ NATE 2026-08-12: THEY ARE RETAINED WHEN THE TIMELINE GOES AWAY — the
	 * heights are a property of the TEAM, not of the timeline that happens to
	 * compute them. (The original reason was the RP↔TB crossing, when both
	 * tools showed the ribbon; it now saves the cards a re-flow on the way
	 * back INTO the planner, before its timeline republishes.)
	 *
	 * ⚠ SO A DESTROY PUBLISHES null AND IS IGNORED (see claimMetrics). What is
	 * left over is deliberately stale until the planner recomputes it — a card
	 * height is a rhythm, not a claim about anything.
	 */
	slotHeights = $state<number[] | null>(null);

	/** Per-slot: a 'blank' slot whose generic kit is actually cast. Retained on
	 *  destroy with the heights, and read only in planner mode. */
	blankUsed = $state<boolean[]>([false, false, false, false]);

	/**
	 * How far the planner's FIRST TRACK ROW sits below its surface's top (px) —
	 * the ruler, plus whatever else the timeline has put in its header.
	 *
	 * ⚓ IT IS PUBLISHED RATHER THAN MIRRORED because it stopped being a constant
	 * (2026-08-17): the aura lane can ride above the time axis, and when it does
	 * every track row moves down by its height. A hand-copied RULER_H would have
	 * gone quietly wrong the first time that happened, which is exactly how
	 * `RIBBON_FRAME_TOP_INSET`'s own note says the number behaves.
	 *
	 * (Until 2026-10-08 the Team Builder read it too, so its cards landed on
	 * the planner's screen y across the crossing; the planner is its only
	 * reader now.)
	 *
	 * ⚠ RETAINED ON UNMOUNT like `slotHeights`, and for the same reason: it is a
	 * property of how the plan is being READ, not of the component that happened
	 * to measure it.
	 */
	trackTop = $state<number>(RIBBON_FRAME_TOP_INSET);

	/**
	 * The dock's measured WIDTH (px) — meaningful only in the row form (the
	 * ribbon reads `below('toolMin')` for that), where the strip spans whatever
	 * the tool spans. The column form's width is the constant RIBBON_W and
	 * never reads this. Written by the (tools) layout at every dock measurement.
	 */
	dockW = $state(0);

	/** Register a tool page's bench affordances. Returns an unregister that
	 *  clears only its own tool's entry, and only while that entry is still
	 *  this registration — a re-mounted page must not be unregistered by its
	 *  own predecessor's late teardown. */
	registerHost(reg: BenchHostRegistration): () => void {
		this.#hosts[reg.tool] = reg;
		return () => {
			if (this.#hosts[reg.tool] === reg) delete this.#hosts[reg.tool];
		};
	}

	/** Claim the metrics channel. The returned publisher applies only while it
	 *  is the latest claimant — a retention-delayed unmount of the previous
	 *  timeline can't stomp the live one's metrics.
	 *
	 *  Callers still publish null on destroy; it is now a no-op, kept as the
	 *  signal it always was rather than removed from every call site. See
	 *  `slotHeights` for why the last real measurement outlives its timeline. */
	claimMetrics(): (heights: number[] | null, blankUsed?: boolean[], trackTop?: number) => void {
		const token = {};
		this.#metricsOwner = token;
		return (heights, blankUsed, trackTop) => {
			if (this.#metricsOwner !== token) return;
			if (!heights) return;
			this.slotHeights = heights;
			this.blankUsed = blankUsed ?? [false, false, false, false];
			// ⚠ Only when supplied — the `null` destroy signal carries nothing, and
			// an `undefined` here must not reset the head to its resting value.
			if (trackTop !== undefined) this.trackTop = trackTop;
		};
	}

	#metricsOwner: object | null = null;
}

export const benchBand = new BenchBandState();
