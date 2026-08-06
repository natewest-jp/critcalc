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
 * The band's resting rhythm: one card at the planner's BASELINE slot height,
 * so the "even default rhythm" the band relaxes to on the Team Builder is the
 * exact height a no-extra-rows planner slot occupies — the RP↔TB height
 * animation is a no-op for typical rotations and only moves in the extreme
 * many-bars cases, which is Nate's spec. Derivation (RotationTimeline's
 * constants): padTop 10 + E 20 + gap 4 + Q 20 + gap 4 + active 40 + gap 4 +
 * 3 buff rows (3×16−2 = 46) + padBottom 10 = 158.
 */
export const BENCH_SLOT_H = 158;

/** Full resting column height (borders live INSIDE the border-box heights). */
export const BENCH_COLUMN_H = 4 * BENCH_SLOT_H;

// ---------------------------------------------------------------------------
// The RIBBON (Nate's mockup, 2026-08-05): the band is a SELF-CONTAINED box —
// its own ground, frame and radius, ONE identity in both tools (always the
// dark context; the per-tool ctx flip is retired). The tool frames are loose
// siblings that tuck UNDERNEATH its edges: the planner's timeline extends out
// from under its right edge, the TB's atlas/roster from under its left.
//
// ↻ TALL-BENCH ROUND (Nate's mockup #2, 2026-08-06): the ribbon is now a full
// STRIP — it spans its tool frame's whole height and stands RIBBON_OVERHANG_Y
// proud at BOTH ends, so it always reads as slightly taller than the surface
// beside it. Its height is therefore MEASURED from the dock (which stretches
// with the frame), not summed from the cards; the cards keep their track-group
// alignment at the top and the tail below them is deliberately empty.
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
 * same left edge as the logo, the tab row and the tool frame. It stands proud
 * of its tool VERTICALLY (see RIBBON_OVERHANG_Y) and nowhere else; horizontally
 * everything on the page starts on one line.
 *
 * So the frame tucks under the strip for its whole width bar its own 1px
 * border, and each tool spends the difference on its gutter rather than on an
 * overhang: the planner's frame padding + label column, and the Team Builder's
 * bench zone, both measure RIBBON_UNDER from their frame's padding box.
 */
export const FRAME_BORDER = 1;
export const RIBBON_UNDER = RIBBON_W - FRAME_BORDER;

/**
 * How far the ribbon's outer edge stands past its tool frame's outer edge —
 * now exactly the frame's border, i.e. flush. Kept as the named derivation
 * because both docks position through it, and because a future re-tune of the
 * left edge is this one number.
 */
export const RIBBON_OVERHANG = RIBBON_W - RIBBON_UNDER;

/**
 * ⚓ NATE 2026-08-06 — how far the strip stands proud of its tool frame at the
 * TOP and the BOTTOM. The whole point of the tall bench: whatever height the
 * planner or the Team Builder happens to have, the ribbon extends that far and
 * a little further, so it always reads as the taller object. Both docks stretch
 * with their frame, so this is the only vertical number to tune.
 */
export const RIBBON_OVERHANG_Y = 12;

/**
 * The planner's track rows, measured from its frame's BORDER-box top:
 * border 1 + .rp-frame padding-top 10 + RULER_H 28. The card column must land
 * exactly there (each card labels its track group), which fixes everything
 * below.
 */
export const RIBBON_FRAME_TOP_INSET = 1 + 10 + 28;

/**
 * Dead space between the ribbon's interior top and the FIRST card — the strip
 * now opens above the timeline's ruler, so the cards sit this far down inside
 * it. Shared by both tools (the TB has no ruler, but its cards must land on
 * the same screen y or they'd jump across the tool fade), and the frame tops
 * already align across the seam (probe-bench-align).
 */
export const RIBBON_HEAD = RIBBON_FRAME_TOP_INSET + RIBBON_OVERHANG_Y - RIBBON_CHROME;

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
