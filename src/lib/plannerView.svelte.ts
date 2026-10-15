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

import type { EventLogHover, EventLogRow } from '$lib/components/EventLog.svelte';
import type { Cue } from '$lib/playback/cues';
import { narrowFormQuery } from '$lib/breakpoints';

export const ZOOM_MIN = 20;
export const ZOOM_MAX = 120;
export const ZOOM_STEP = 5;
/** px per second — the timeline's resting zoom. */
export const ZOOM_DEFAULT = 60;
/**
 * 🎛️ The resting zoom below `toolMin` (⚓ Nate 2026-10-14: a narrow screen
 * opens further out, so more of the rotation shows). A 390px phone's track is
 * 330px — 5.5s at 60, 11s at 30 — and 30 still leaves two steps out. A first
 * value, to be tuned by eye.
 */
export const ZOOM_DEFAULT_NARROW = 30;

/** The resting zoom for this screen, decided ONCE at load like the layer
 *  defaults (`stores.ts`): rotating a tablet does not re-zoom the chart.
 *  ↻ Below `toolMin` OR short (`narrowFormQuery`, responsive sweep §3 item 4). */
export const restingZoom: number =
	typeof window !== 'undefined' && window.matchMedia(narrowFormQuery).matches
		? ZOOM_DEFAULT_NARROW
		: ZOOM_DEFAULT;

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
	scale = $state(restingZoom);
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
	/**
	 * An instant the log should bring into view once it has rows — set by a
	 * click on an aura pip or reaction marker, cleared by the log when it has
	 * scrolled there (⚓ Nate 2026-09-24).
	 * ⚠ STATE, unlike `scrollToSeconds` below, because the log may not exist
	 * yet: the click OPENS it, and its rows are only projected once it is open,
	 * so the request has to wait for a reader. The reader clears it, so a stale
	 * value cannot re-fire.
	 */
	logRevealAt = $state<number | null>(null);

	/** Open the log (never toggle it shut) and ask it to show `seconds`. */
	revealInLog(seconds: number) {
		this.aside = 'log';
		this.logRevealAt = seconds;
	}

	/** Close a panel because its CONTENT went away — ⚠ only if it is the one
	 *  showing, or an empty rotation would shut the other one too. */
	closeIfShowing(panel: Exclude<AsidePanel, null>) {
		if (this.aside === panel) this.aside = null;
	}

	/** Published by the planner page for band B's readout + the notes gate. */
	hasCaveats = $state(false);
	/** The rotation put something on the target, so there is a transcript to
	 *  read. ⚠ Independent of the aura LAYER: the log is a second reading of the
	 *  same events, and wanting the words without the chart is a real want. */
	hasAuraLog = $state(false);
	totalDuration = $state(0);
	/** The rotation's presses, in seconds — what playback sounds and what the
	 *  cursor is keeping time with (playback round, 2026-09-29). Published by
	 *  the chart beside `totalDuration` for the same reason: the parse is the
	 *  chart's, and the transport (`$lib/playback/playback.svelte.ts`) is a
	 *  sibling that must not reach into it. */
	playbackCues = $state<Cue[]>([]);
	/** Where playback ENDS, in seconds: the document's end, or the stream's
	 *  horizon while Repeat is on. `totalDuration` stays the document's — band
	 *  B's Total says how long ONE lap runs whatever the chart is drawing. */
	playbackEnd = $state(0);
	/** Repeat (playback round B): draw the rotation joined to itself by a swap,
	 *  `REPEAT_LAPS` laps, so the laps that follow are simulated rather than
	 *  assumed. Per LOOK like zoom — you arm it to check the rotation in front
	 *  of you — so it is not stored; ⛔ never in the `?r=` codec. */
	repeat = $state(false);
	// ⛔ `hasAura` RETIRED (2026-08-17). It existed for ONE expression — the notes
	// panel's second gate, so gauge round L6's standing "how the aura is modelled"
	// block could reach a fully-curated team with no caveats. That block moved to
	// the head of the aura LOG, so the gate went with it and the flag had no other
	// reader. ⚠ ⛔ `hasAuraLog` above is not a rename: it answers "is there a
	// transcript", which is layer-independent, where this answered "is the lane
	// drawn".

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

	// ══ THE TWO HOVER CHANNELS (2026-08-17) ═══════════════════════════════════
	//
	// ⚓ TWO SCALARS, AND THAT IS THE WHOLE COUPLING. The chart and the log are
	// siblings — the timeline is the surface's `main` box, the log its `aside` —
	// and neither may reach into the other's DOM. Each publishes WHERE IT IS
	// POINTING, in seconds, and the other decides what to do about it. Anything
	// richer (a row index, an element ref, a scroll offset) would make the two
	// components know each other's geometry, which is the coupling that is hard
	// to undo later.
	// ⚠ SECONDS both ways: the log's rows already print seconds, and the chart
	// converts to px in one place anyway.

	/** Where the pointer is ON THE CHART, with the reach one pixel covers at the
	 *  current zoom — the log lights the rows under it. ⚠ The reach travels
	 *  because only the chart knows its zoom. */
	auraHover = $state<EventLogHover | null>(null);

	/** Where the pointer is IN THE LOG — the chart draws its own cursor there.
	 *  ⚓ It drives the crosshair the chart already had, so there is ONE highlight
	 *  mechanism with two drivers rather than a second vocabulary. */
	logHover = $state<number | null>(null);

	/**
	 * "Take me there" — set by the timeline, called by the log's rows.
	 *
	 * ⚠ A REGISTERED HANDLER, not a `seekTo: number` the timeline watches. A
	 * one-shot command expressed as reactive state has to be CLEARED after it is
	 * consumed, and a stale value re-firing on an unrelated re-render is exactly
	 * the bug that shape produces. A function is called once, by name.
	 * ⚠ Registered from an `$effect` with a cleanup rather than `onMount`, so it
	 * survives the tool-page revival that has caught this project before
	 * (project_tool_page_revival): A→B→A reuses the component and onMount never
	 * runs again.
	 *
	 * 🐛 DELIBERATELY NOT `$state`, and it cost an hour to learn why. As reactive
	 * state, the timeline's registering effect SELF-INVALIDATED: writing a `$state`
	 * class field reads the old value to compare it, that read is tracked inside
	 * the effect doing the writing, and the effect therefore depends on what it
	 * sets. Measured: 4,004 console lines of register → cleanup → register on a
	 * single page load, settling on a cleanup — so the handler was null and
	 * clicking a log row did nothing at all, silently, because the call site is an
	 * optional-call. ⚠ Wrapping the CLEANUP in `untrack` was not enough; the write
	 * is the tracked read.
	 * ⚓ And nothing needs to react to it: the log reads it at CLICK TIME. A plain
	 * field is both the fix and the honest description. ⛔ Don't make it `$state`
	 * to "be consistent" with its neighbours here — they are read during render
	 * and this one is not.
	 */
	scrollToSeconds: ((seconds: number) => void) | null = null;

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
		this.scale = restingZoom;
	}
}

export const plannerView = new PlannerViewState();
