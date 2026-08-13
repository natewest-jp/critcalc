/**
 * src/lib/benchBand.svelte.ts
 *
 * Shared state for the BENCH BAND — the one slot-card column both tools dock
 * (bench-band round, 2026-08-05). The band itself is rendered by the (tools)
 * layout, OUTSIDE the keyed .tool-page layers, so it survives tool navigation
 * and glides across the screen on the pan clock. This module is what the band
 * and its two hosts agree through:
 *
 * - Host registration: each tool page registers its bench affordances on
 *   mount (the planner: portrait click opens the character Source; the TB:
 *   portrait click opens the Detail card, plus audition). During a tool pan
 *   BOTH pages are briefly alive — registration is last-writer-wins and an
 *   unregister only clears its own registration, so the incoming page's
 *   callbacks survive the outgoing page's (retention-delayed) teardown.
 *
 * - Slot metrics: the planner's timeline publishes its per-slot block heights
 *   (they vary with buff/summon rows) so the band's cards align to their
 *   track groups DATA-driven, never DOM-coupled. Ownership-guarded the same
 *   way. `blankUsed` marks slots where the generic Blank kit is actually cast
 *   in the notation — those render as a real "Blank" card; unused blanks stay
 *   empty add-slots.
 *
 * Card geometry constants live here too — the TB bench zone reserves the
 * band's footprint with them, and the band uses them as its resting rhythm.
 */

// ⚠ Extensions are load-bearing on these two — see toolGutter.ts. This file is
// a geometry module in the same family, and Node's native type stripping (what
// scripts/probe-*.mjs run under) does no extension inference.
import { BAND_STACK_TO_SURFACE } from './toolBands.ts';
import { RIBBON_GAP } from './toolGutter.ts';

/**
 * ⚓ NATE 2026-08-12: ONE shape for both tools, where there used to be a
 * discriminated pair. "I'd like to make clicking on the portrait behave the
 * same as on the Team Builder — it pulls up the modal of the character's
 * details… it teaches the user that it's the exact same set of actions
 * regardless of the tool they're on."
 *
 * So the AFFORDANCES are now identical and only their destinations differ:
 * - a FILLED portrait opens that character's Detail card, in both tools;
 * - an EMPTY portrait, and ⇄ on any slot, asks the host to swap — which the
 *   planner answers with its character Source and the Team Builder with an
 *   audition. There are no details for nobody, and "click the empty disc to
 *   fill it" is the one thing that must not stop working.
 *
 * This also gives ⇄ a job of its own for the first time: on the planner it used
 * to call the very same handler the portrait did.
 */
export type BenchHostRegistration = {
	tool: 'rp' | 'tb';
	/** Filled-slot portrait click — the character's Detail card. */
	onOpenDetail: (id: string) => void;
	/** ⇄, and an empty slot's portrait. RP: open the character Source. TB:
	 *  audition replacements (`incumbentId` null on an empty slot). */
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
 *  🎛️ ⚓ NATE, bench-card round: 160 → 200. This is the width at which NOTHING
 *  in the card has to shrink — the text column lands at 84px, which is exactly
 *  a constellation chip (26) + gap (4) + the two-zone loadout pill (54), and a
 *  2-line name at --fs-lg. Below ~180 the value controls have to give something
 *  up; above it, the chart pays for space the card cannot use.
 *
 *  ⚠ THE PLANNER PAYS FOR THIS IN CHART WIDTH, and that is the good direction
 *  of the trade: horizontal is scrollable AND zoomable in a Gantt, vertical is
 *  neither. 40px of tracks (~3% at 1600) buys 40px × 4 slots of height. */
export const BENCH_CARD_W = 200;

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
 * The band's resting rhythm: one card at the planner's BASELINE slot height,
 * so the "even default rhythm" the band relaxes to on the Team Builder is the
 * exact height a typical planner slot occupies — the RP↔TB height animation is
 * a no-op for typical rotations and only moves in the extreme many-bars cases,
 * which is Nate's spec.
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
/** Full ribbon width — the dock anchors and the TB zone math read this. */
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
 */
export const RIBBON_OVERHANG_Y = 12;

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
 * ⚠ Still hand-mirrored from RULER_H. If the ruler's height moves, this moves.
 */
export const RIBBON_FRAME_TOP_INSET = 28;

/**
 * Dead space between the ribbon's interior top and the FIRST card — the strip
 * now opens above the timeline's ruler, so the cards sit this far down inside
 * it. Shared by both tools (the TB has no ruler, but its cards must land on
 * the same screen y or they'd jump across the tool fade), and the frame tops
 * already align across the seam (probe-bench-align).
 *
 * ↻ TOOLBAR ROUND 2026-08-07: the ribbon now stands proud of the BAND STACK,
 * not of the frame — its dock spans bands + surface — so the head grows by
 * exactly the distance from the stack's top to the surface's. The card column
 * has not moved relative to the timeline's track rows; there is simply more
 * ribbon above it. ⚓ NATE: that new emptiness is where the decorative motif
 * goes.
 */
export const RIBBON_HEAD =
	BAND_STACK_TO_SURFACE + RIBBON_FRAME_TOP_INSET + RIBBON_OVERHANG_Y - RIBBON_CHROME;

/** Resting ribbon interior above/below the card column — retained as the
 *  content-height reference for a bench with four baseline slots. Since the
 *  tail round the box is content-sized, so nothing measures against a dock. */
export const RIBBON_RESTING_H = BENCH_COLUMN_H + RIBBON_HEAD + 2 * RIBBON_CHROME;

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
const TAIL = {
	/** Silhouette, x 0…RIBBON_W, y measured from the tail's top. */
	outer: (t: number) =>
		`C 224,${t + 43.772} 211.229,${t + 62.34} 191.887,${t + 69.75}` +
		`L 113.7885,${t + 99.669}` +
		`C 112.637,${t + 100.1105} 111.363,${t + 100.1105} 110.2115,${t + 99.669}` +
		`L 32.113,${t + 69.75}` +
		`C 12.771,${t + 62.34} 0,${t + 43.772} 0,${t + 23.059}`,
	/** Frame ring, OUTER edge — the silhouette inset by RIBBON_EDGE. */
	ringOuter: (t: number) =>
		`C 219,${t + 41.7005} 207.506,${t + 58.412} 190.0985,${t + 65.081}` +
		`L 112,${t + 95}` +
		`L 33.9015,${t + 65.081}` +
		`C 16.494,${t + 58.412} 5,${t + 41.7005} 5,${t + 23.059}`,
	/** Frame ring, INNER edge — a sharp point; only the silhouette's is capped. */
	ringInner: (t: number) =>
		`C 217,${t + 40.872} 206.017,${t + 56.841} 189.383,${t + 63.2135}` +
		`L 112,${t + 92.8585}` +
		`L 34.617,${t + 63.2135}` +
		`C 17.983,${t + 56.841} 7,${t + 40.872} 7,${t + 23.059}`
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
	 *   2. → Team Builder          host = T; the planner OUTROES but is retained,
	 *                              so it is never destroyed and never unregisters
	 *   3. → planner               Svelte cancels the outro and reinserts the SAME
	 *                              component — no second onMount, no re-register,
	 *                              host is still T
	 *   4. the TB finally tears down; host === T, so it nulls the host
	 *
	 * …and the bench is left hostless on a planner that is on screen and looks
	 * fine. ⇄ and the portraits go dead until you reload. The (tools) layout
	 * documents this revival at TOOL_NAV_ANIM and answers it by re-deriving in
	 * afterNavigate; a keyed record answers it by never needing a re-derive at
	 * all — a tool's registration is removed only by that tool, and a stale one
	 * is simply the entry `mode` is not asking for.
	 *
	 * ⚠️ It is PRE-EXISTING (measured on 847acdb, where the same round trip kills
	 * the character Source). What changed is the stakes: ⇄ is now the planner's
	 * only way to change a slot, and leaving the tool and coming back is the
	 * flow, not an edge case.
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
	 * ⚓ NATE 2026-08-12: THEY ARE RETAINED WHEN THE TIMELINE GOES AWAY. The
	 * cards used to relax to an even resting rhythm on the Team Builder, which
	 * meant the four cards you were just looking at silently changed shape as
	 * you crossed — the one moment the ribbon exists to make continuous. The
	 * heights are a property of the TEAM, which both tools share, not of the
	 * timeline that happens to compute them.
	 *
	 * ⚠ SO A DESTROY PUBLISHES null AND IS IGNORED (see claimMetrics). What is
	 * left over is deliberately stale: edit the team on the Team Builder and the
	 * cards keep the departing rotation's rhythm until the planner recomputes
	 * it. That is the right trade — a card height is a rhythm, not a claim about
	 * anything, and holding it still beats re-flowing four cards on a surface
	 * that has no rows to justify the change.
	 */
	slotHeights = $state<number[] | null>(null);

	/** Per-slot: a 'blank' slot whose generic kit is actually cast. Retained on
	 *  destroy with the heights, and read only in planner mode. */
	blankUsed = $state<boolean[]>([false, false, false, false]);

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
	claimMetrics(): (heights: number[] | null, blankUsed?: boolean[]) => void {
		const token = {};
		this.#metricsOwner = token;
		return (heights, blankUsed) => {
			if (this.#metricsOwner !== token) return;
			if (!heights) return;
			this.slotHeights = heights;
			this.blankUsed = blankUsed ?? [false, false, false, false];
		};
	}

	#metricsOwner: object | null = null;
}

export const benchBand = new BenchBandState();
