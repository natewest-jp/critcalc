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
 *   scale / showNotes   — WRITTEN by band B, READ by the timeline
 *   hasCaveats / total  — WRITTEN by the timeline, READ by band B
 *
 * This is view state, deliberately NOT persisted and NOT part of the document:
 * a zoom level is not something you save or share, and nothing here belongs in
 * a saved-team entry.
 *
 * ⚠ ONE EXCEPTION, AND IT IS DELIBERATE (2026-08-17): the two LAYER toggles
 * (auras / buffs) are band-B controls like these, but they live in
 * `siteSettings` and DO persist. The line is per-look vs per-taste — see the
 * note on `showAuraLane` there. They are not mirrored into this class: a second
 * copy of a stored value is how the two drift, so band B and the timeline both
 * read the store directly and only `reset()` below reaches across.
 */

import { siteSettings, TIMELINE_LAYER_DEFAULTS } from '$lib/stores';

export const ZOOM_MIN = 20;
export const ZOOM_MAX = 120;
export const ZOOM_STEP = 5;
/** px per second — the timeline's resting zoom. */
export const ZOOM_DEFAULT = 60;

class PlannerViewState {
	/** px per second. */
	scale = $state(ZOOM_DEFAULT);
	showNotes = $state(false);

	/** Published by the timeline for band B's readout + the notes gate. */
	hasCaveats = $state(false);
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

	zoomBy(delta: number) {
		this.scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.scale + delta));
	}

	/**
	 * Back to the resting view. The timeline closes the notes panel itself when
	 * a rebuild leaves no caveats to show, so this only has to handle the
	 * user-facing controls.
	 *
	 * ⚠ THE LAYERS ARE PART OF "THE VIEW" and are restored here too (2026-08-17)
	 * — the button says "Reset view" rather than "Reset zoom" precisely because
	 * it means the whole of band B's state, and a reset that left the buff rows
	 * hidden would make the label a lie in the one situation someone reaches for
	 * it: the timeline does not look how they expect and they want it back.
	 * Reaching into another store from here is the cost of not keeping a second
	 * copy of the flags; it is one call, at the one site that needs it.
	 */
	reset() {
		this.scale = ZOOM_DEFAULT;
		this.showNotes = false;
		siteSettings.setTimelineLayers({ ...TIMELINE_LAYER_DEFAULTS });
	}
}

export const plannerView = new PlannerViewState();
