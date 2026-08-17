/**
 * src/lib/plannerView.svelte.ts
 *
 * THE PLANNER'S VIEW STATE — band B's half of the planner (toolbar round,
 * 2026-08-07).
 *
 * Zoom and the notes panel are VIEW controls: they change how the rotation is
 * drawn, never what it is. Under the band taxonomy that puts them in band B,
 * which the planner PAGE renders — but the state they drive belongs to
 * RotationTimeline, which is a component two levels down. Rather than thread
 * four `bind:`s through the page (and give the timeline a second, prop-shaped
 * source of truth for its own geometry), the pair meets in a rune module, the
 * same way rotationTabs and benchBand already broker between the layout, the
 * bench and both tools.
 *
 * Direction of flow, so it stays legible:
 *   scale / aside            — WRITTEN by band B, READ by the timeline + page
 *   hasCaveats / hasAuraLog
 *     / total / auraLog      — WRITTEN by the timeline, READ by band B + page
 *
 * This is view state, deliberately NOT persisted and NOT part of the document:
 * a zoom level is not something you save or share, and nothing here belongs in
 * a saved-team entry.
 *
 * ⚠ ONE EXCEPTION, AND IT IS DELIBERATE (2026-08-17): the two LAYER toggles
 * (auras / buffs) are band-B controls like these, but they live in
 * `siteSettings` and DO persist. The line is per-look vs per-taste — see the
 * note on `showAuraLane` there. They are not mirrored into this class at all: a
 * second copy of a stored value is how the two drift, so band B and the timeline
 * both read the store directly and nothing here touches them.
 */

import type { EventLogRow } from '$lib/components/EventLog.svelte';

export const ZOOM_MIN = 20;
export const ZOOM_MAX = 120;
export const ZOOM_STEP = 5;
/** px per second — the timeline's resting zoom. */
export const ZOOM_DEFAULT = 60;

/**
 * What the aside column is showing. ⚓ ONE COLUMN, ONE OCCUPANT (2026-08-17) —
 * `ToolColumns` has always said the aside takes a single occupant and the tool
 * decides in one expression; with a second panel wanting the same space, this
 * IS that expression.
 *
 * ⚠ The exclusivity lives here rather than in the two buttons' handlers. Two
 * booleans that must never both be true is a state a caller can get wrong, and
 * the caller here is markup in a different file.
 */
export type AsidePanel = 'notes' | 'log' | null;

class PlannerViewState {
	/** px per second. */
	scale = $state(ZOOM_DEFAULT);
	/** ⛔ Not two booleans — see AsidePanel. */
	aside = $state<AsidePanel>(null);

	get showNotes() {
		return this.aside === 'notes';
	}
	get showLog() {
		return this.aside === 'log';
	}

	/** Open a panel, or close it if it is already the one showing. */
	togglePanel(panel: Exclude<AsidePanel, null>) {
		this.aside = this.aside === panel ? null : panel;
	}
	/** Close a panel because its CONTENT went away — ⚠ only if it is the one
	 *  showing, or an empty rotation would shut the other one too. */
	closeIfShowing(panel: Exclude<AsidePanel, null>) {
		if (this.aside === panel) this.aside = null;
	}

	/** Published by the timeline for band B's readout + the notes gate. */
	hasCaveats = $state(false);
	/** The rotation put something on the target, so there is a transcript to
	 *  read. ⚠ Independent of the aura LAYER: the log is a second reading of the
	 *  same events, and wanting the words without the chart is a real want. */
	hasAuraLog = $state(false);
	totalDuration = $state(0);
	/**
	 * The aura lane is ON SCREEN — the rotation put something on the target AND
	 * the layer is switched on — so the notes panel has its standing "how the
	 * aura is modelled" block to show (gauge round L6).
	 *
	 * ⚠ A SECOND REASON THE NOTES PANEL CAN OPEN. It used to be gated on slot
	 * caveats alone, which would have made the modelling limits unreachable for
	 * exactly the rotations most likely to need them: a fully-curated team has
	 * no caveats and still gets a gauge.
	 *
	 * ⚠ "DRAWN", NOT "EXISTS" (2026-08-17). The flag folds in the layer toggle,
	 * because the block it gates states the limits OF THE LANE — with the lane
	 * hidden there is nothing on screen for those limits to qualify, and a
	 * caveat-free team would open the Notes panel to explain a chart that is not
	 * there.
	 */
	hasAura = $state(false);

	/**
	 * The aura transcript for the side column, built by the timeline from the
	 * lane it already draws (see `$lib/timeline/auraLog`).
	 *
	 * ⚠ IT CROSSES THROUGH HERE FOR THE SAME REASON `hasCaveats` DOES: the aside
	 * is rendered by the PAGE and the lane lives in the timeline, which is the
	 * page's `main` column — so there is no prop path between them that is not a
	 * bind threaded two levels.
	 * ⚠ The timeline leaves it EMPTY unless the log panel is open. Projecting a
	 * few hundred rows on every keystroke for a column nobody has opened is the
	 * same cost the aura lane is already gated against.
	 */
	auraLog = $state<EventLogRow[]>([]);

	zoomBy(delta: number) {
		this.scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.scale + delta));
	}

	/**
	 * Back to the resting ZOOM, and nothing else.
	 *
	 * ↻ ⚓ NATE 2026-08-17: THE BUTTON NARROWED. It briefly meant "the whole of
	 * band B's state" — zoom, the notes panel and the two layer toggles — which
	 * is a defensible reading of "Reset view" and the wrong control to build. A
	 * scale is a thing you fiddle with and want back; a panel and a layer are
	 * things you deliberately opened, and sweeping them away as a side effect of
	 * fixing your zoom is a control that does more than you asked. One button,
	 * one job, and the label says which.
	 *
	 * ⛔ Do not re-add the panel or the layers here. The timeline still closes
	 * the notes panel itself when a rebuild leaves nothing to annotate — that is
	 * content disappearing, not a reset.
	 */
	reset() {
		this.scale = ZOOM_DEFAULT;
	}
}

export const plannerView = new PlannerViewState();
