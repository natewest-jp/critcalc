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
 */

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

	zoomBy(delta: number) {
		this.scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.scale + delta));
	}

	/**
	 * Back to the resting view. The timeline closes the notes panel itself when
	 * a rebuild leaves no caveats to show, so this only has to handle the
	 * user-facing pair.
	 */
	reset() {
		this.scale = ZOOM_DEFAULT;
		this.showNotes = false;
	}
}

export const plannerView = new PlannerViewState();
