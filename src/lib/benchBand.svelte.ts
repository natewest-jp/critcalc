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
// its own ground, border and radius, ONE identity in both tools (always the
// dark context; the per-tool ctx flip is retired). The tool frames are loose
// siblings that tuck UNDERNEATH its edges: the planner's timeline extends out
// from under its right edge, the TB's atlas/roster from under its left.
// All knobs — Nate tunes these in the inspector.
// ---------------------------------------------------------------------------

/** Interior padding between the ribbon's border and the card column. */
export const RIBBON_PAD = 12;
/** The ribbon's own border width. */
export const RIBBON_BORDER = 1;
/** Full ribbon width — the dock anchors and the TB zone math read this. */
export const RIBBON_W = BENCH_CARD_W + 2 * (RIBBON_PAD + RIBBON_BORDER);
/** Ribbon chrome above/below the card column (pad + border, each side). */
export const RIBBON_CHROME_Y = RIBBON_PAD + RIBBON_BORDER;
/** Resting ribbon height (TB / even rhythm). On the planner the column part
 *  grows with the published slot metrics. */
export const RIBBON_RESTING_H = BENCH_COLUMN_H + 2 * RIBBON_CHROME_Y;

/**
 * How far the ribbon's outer edge overhangs its tool frame's outer edge
 * (planner: past the frame's LEFT; TB: past the frame's RIGHT). The tuck-under
 * read: the frame's edge region slides beneath the ribbon; the ribbon's far
 * edge stands proud of the frame by this much.
 */
export const RIBBON_OVERHANG = RIBBON_PAD;

/**
 * The ribbon's top, measured from its tool frame's PADDING-box top (both
 * frames wear a 1px border; absolute insets resolve against the padding box)
 * — THE no-vertical-travel contract: both tools place their dock at this same
 * offset, and the frame tops already align across the pan seam
 * (probe-bench-align), so the ribbon's y never changes between tools.
 * Derivation: the planner's track rows start frame-pad 10 + ruler 28 below
 * the frame's padding box; the card column must land exactly there, so the
 * ribbon box starts RIBBON_CHROME_Y higher. (10/28 mirror .rp-frame's
 * padding-top and RULER_H — the planner derives its dock from its own
 * constants, and probe-bench-band asserts the two docks' y-equality, so a
 * drift here is caught, not silent.)
 */
export const RIBBON_TOP_OFFSET = 10 + 28 - RIBBON_CHROME_Y;

/**
 * Clearance the planner inserts between the slot tracks and the
 * below-timeline lanes (team buffs / NB / moonsign) so the ribbon's bottom
 * chrome never shaves the lane labels: the ribbon ends RIBBON_CHROME_Y below
 * the 4th track group, and the lanes start after this gap.
 */
export const RIBBON_LANES_CLEAR = RIBBON_CHROME_Y + 1;

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
