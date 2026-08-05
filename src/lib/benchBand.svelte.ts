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
