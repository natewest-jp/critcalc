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

export type BenchHostRegistration =
	| {
			tool: 'rp';
			/** Any portrait click (filled or empty) opens the character Source. */
			onPortraitClick: () => void;
	  }
	| {
			tool: 'tb';
			/** Filled-slot portrait click opens the Detail card. */
			onOpenDetail: (id: string) => void;
			/** ⇄ — audition replacements for a filled slot. */
			onAudition: (index: number, incumbentId: string) => void;
	  };

/** The converged slot-card width (RotationTimeline's LABEL_W — move together). */
export const BENCH_CARD_W = 160;

/**
 * ══ WHAT ONE CARD NEEDS, AND WHY IT IS NOW THE BINDING CONSTRAINT ═══════════
 * The card is three stacked bands with fixed outer two:
 *
 *     padding 8+10  +  identity row 26  +  gap 8  +  PORTRAIT  +  gap 8
 *                   +  loadout pill 26                        =  86 + portrait
 *
 * At the portrait's full 68px that is 154, which is where BENCH_SLOT_H's old
 * value of 158 came from — it was the planner's slot height, and the card was
 * designed to exactly fill it.
 *
 * ⚠ THE TIMELINE OUTGREW THAT, DOWNWARD. Two condensing rounds took the
 * planner's slot to 124 at full aux reserve and 84 with none, and the card
 * cannot follow: it needs 86px before the portrait gets a single pixel. So the
 * CARD is what sets the minimum slot height now, not the rows. That is a real
 * inversion and it is worth stating plainly rather than letting a floor
 * constant look arbitrary.
 *
 * 🎛️ THE FLOOR IS THE SMALLEST PORTRAIT WE ARE WILLING TO SHOW. 40px still
 * reads as a character — below that the disc stops being a portrait and starts
 * being a dot — so the floor is 86 + 40. Lower this only together with a
 * decision about what the card looks like when it can no longer stack three
 * bands; the honest alternative is restructuring the card (portrait INLINE with
 * the identity row), which buys ~48px and is a design change, not a number.
 * ⚠ The disc itself is capped, not floored (--sp-avatar-max in SlotPortrait):
 * it shrinks to fit whatever it is given. This constant is what stops it being
 * given too little.
 */
export const BENCH_SLOT_MIN_H = 86 + 40;

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
 * The shelf line between two cards. Lives here with the rest of the strip's
 * geometry rather than buried in BenchBand's style block — every number that
 * shapes the strip should be findable in one file. ⚓ NATE 2026-08-06 (1 → 1.5,
 * matching the card controls' own 1.5px borders).
 */
export const RIBBON_DIVIDER_H = 1.5;
/** Interior padding between the inner frame and the card column. */
export const RIBBON_PAD = 9;
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
 * ⚓ NATE 2026-08-06 — how far the strip stands proud of its tool frame at the
 * TOP and the BOTTOM. The whole point of the tall bench: whatever height the
 * planner or the Team Builder happens to have, the ribbon extends that far and
 * a little further, so it always reads as the taller object. Both docks stretch
 * with their frame, so this is the only vertical number to tune.
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

/** Resting ribbon interior above/below the card column — the TB's dock height
 *  is measured, so this only seeds the pre-measure paint. */
export const RIBBON_RESTING_H = BENCH_COLUMN_H + RIBBON_HEAD + 2 * RIBBON_CHROME;

class BenchBandState {
	host = $state<BenchHostRegistration | null>(null);

	/** Per-slot block heights published by the planner's timeline (px), or
	 *  null when no timeline is mounted. The band couples to these only while
	 *  the planner is the active tool. */
	slotHeights = $state<number[] | null>(null);

	/** Per-slot: a 'blank' slot whose generic kit is actually cast. */
	blankUsed = $state<boolean[]>([false, false, false, false]);

	/** Register a tool page's bench affordances. Returns an unregister that
	 *  only clears its own registration (pan-retention safe). */
	registerHost(reg: BenchHostRegistration): () => void {
		this.host = reg;
		return () => {
			if (this.host === reg) this.host = null;
		};
	}

	/** Claim the metrics channel. The returned publisher applies only while it
	 *  is the latest claimant — a retention-delayed unmount of the previous
	 *  timeline can't stomp the live one's metrics. Publish null on destroy. */
	claimMetrics(): (heights: number[] | null, blankUsed?: boolean[]) => void {
		const token = {};
		this.#metricsOwner = token;
		return (heights, blankUsed) => {
			if (this.#metricsOwner !== token) return;
			this.slotHeights = heights;
			this.blankUsed = blankUsed ?? [false, false, false, false];
		};
	}

	#metricsOwner: object | null = null;
}

export const benchBand = new BenchBandState();
