/**
 * src/lib/timeline/auraRows.ts
 *
 * THE AURA LANE'S PROJECTION (gauge round L6) — the target's elemental state
 * across the rotation, as timeline rows.
 *
 * ⚓ THE FIRST SURFACE THE GAUGE HAS. Everything the round built since L5 has
 * been correctness with no picture: the gauge decides which reactions happen,
 * the reactions drive buff windows, and the player sees the buff bars move. This
 * module is where the cause becomes visible — "here is your aura across your
 * rotation, and here is where you lost it."
 *
 * ⚓ ONE ROW PER AURA MOD, WITH DEPTH. A row is a mod's whole life on the lane;
 * a SPAN is one continuous lifetime of it, drawn as a bar whose FILL HEIGHT is
 * the gauge in units. That is deliberately not the instrument's overlaid area
 * chart: the timeline's grammar is rows of bars, and four concurrent auras
 * stacked on one y axis go muddy exactly when a reader most needs to tell them
 * apart. It is also not a plain presence strip — the units are what the round
 * bought, and 0.2U of Pyro left is a different fact from 1.6U.
 *
 * ⚠️ Two things ride ON the rows rather than in them, because they are POINTS
 * and the rows are spans:
 *   applications — every gauge the rotation put on the target, `--ui-provisional`
 *                  when its unit value is our 1U default rather than measured
 *   reactions    — grouped by frame, because a single hit can trigger several
 *                  (Pyro onto Electro-Charged is Overload AND Vaporize)
 *
 * ⛔ NOT a second gauge. Everything here comes from `ParsedRotation` — the
 * series the live gauge produced, the applications it was fed, the reaction
 * events it emitted. This module reshapes; it decides nothing.
 */

import type { AuraKey, SeriesInterval } from '$lib/utils/gauge';
import type { AuraApplication } from '$lib/utils/notationParser';
import type { Element, Reaction } from '$lib/types/ability';
import type { TimelineEvent } from '$lib/utils/rotationEvents';
import { AURA_MOD_META, AURA_MOD_ORDER, REACTION_FAMILY } from '$lib/utils/auraDisplay';
import { FPS } from '$lib/utils/frames';

/** A sample of one aura. Frames + units — ⚓ the gauge speaks seconds, the
 *  timeline speaks frames, and this module is the conversion's only site. */
export type AuraPoint = { t: number; u: number };

/** One continuous lifetime of one aura mod. */
export type AuraSpan = {
	start: number; // frames
	end: number; // frames
	/** Highest gauge reached, units — the bar's tooltip headline. */
	peak: number;
	points: AuraPoint[];
};

export type AuraRow = {
	mod: AuraKey;
	label: string;
	color: string;
	dash?: string;
	spans: AuraSpan[];
};

/** One application, as the lane's tick. */
export type AuraTick = {
	time: number; // frames
	characterId: string;
	element: Element;
	units: number;
	/** The unit value is our default, not measured data — the squiggle rule. */
	provisional: boolean;
};

/** Every reaction that landed on one frame. ⚓ Grouped because one trigger can
 *  cause several and two markers at one x would overdraw each other. */
export type AuraMarker = {
	time: number; // frames
	entries: { reaction: Reaction; characterId: string }[];
	/** The marker's visible text: the families, deduped, joined. */
	label: string;
};

export type AuraLane = {
	rows: AuraRow[];
	/** The y ceiling every row shares, units. ⚓ ONE scale across the lane, so a
	 *  tall Pyro bar and a short Hydro one are comparable at a glance — a
	 *  per-row scale would make 0.2U and 2U the same height. */
	uMax: number;
	ticks: AuraTick[];
	markers: AuraMarker[];
	// ⛔ No `provisionalCount`. It was authored here and read nowhere — the ticks
	// say it on the chart and the notes panel says it in words, so a third
	// statement was a field waiting to go stale. This project's most productive
	// bug class is data with no consumer (`orphanedSchema.test.ts`), and the
	// cheapest time to not have one is before it exists.
};

/**
 * The y ceiling, rounded UP to a half unit and floored at 2.
 *
 * ⚓ Floored so a rotation that only ever lands 0.8U auras does not draw them
 * full-height and imply a saturated target: the floor is what makes the row's
 * fill mean something absolute rather than relative to the best moment. 2U is
 * a taxed 2.5U application, comfortably above the 1U default everything
 * unmeasured lands at.
 */
export function auraUMax(series: SeriesInterval[]): number {
	const peak = series.reduce((m, s) => s.points.reduce((n, p) => Math.max(n, p.u), m), 0);
	return Math.max(2, Math.ceil(peak * 2) / 2);
}

/** Project the parsed rotation's aura trajectory into lane rows. */
export function computeAuraLane(
	series: SeriesInterval[],
	applications: AuraApplication[],
	events: TimelineEvent[]
): AuraLane {
	const rows: AuraRow[] = [];
	for (const mod of AURA_MOD_ORDER) {
		const intervals = series.filter((s) => s.key === mod && s.points.length > 0);
		if (intervals.length === 0) continue;
		const meta = AURA_MOD_META[mod];
		rows.push({
			mod,
			label: meta.label,
			color: meta.color,
			dash: meta.dash,
			spans: intervals.map((interval) => {
				const points = interval.points.map((p) => ({ t: p.t * FPS, u: p.u }));
				return {
					start: points[0].t,
					end: points[points.length - 1].t,
					peak: points.reduce((m, p) => Math.max(m, p.u), 0),
					points
				};
			})
		});
	}

	const ticks: AuraTick[] = applications.map((a) => ({
		time: a.time,
		characterId: a.characterId,
		element: a.element,
		units: a.units,
		provisional: a.provisionalUnits
	}));

	// ⚠️ Grouped by exact frame rather than by pixel: the lane has no scale yet
	// (the renderer owns zoom), and two reactions from one hit share a frame by
	// construction. Sub-pixel crowding at low zoom is the renderer's problem.
	const byFrame = new Map<number, AuraMarker>();
	for (const ev of events) {
		if (ev.kind !== 'reaction') continue;
		let marker = byFrame.get(ev.time);
		if (!marker) {
			marker = { time: ev.time, entries: [], label: '' };
			byFrame.set(ev.time, marker);
		}
		marker.entries.push({ reaction: ev.reaction, characterId: ev.characterId });
	}
	const markers = [...byFrame.values()].sort((a, b) => a.time - b.time);
	for (const marker of markers) {
		// Deduped: two Swirls on one frame (two auras present) read "Swirl", not
		// "Swirl · Swirl" — the tooltip still lists both with their elements.
		marker.label = [...new Set(marker.entries.map((e) => REACTION_FAMILY[e.reaction]))].join(' · ');
	}

	return { rows, uMax: auraUMax(series), ticks, markers };
}

/**
 * A span's fill as an SVG path in a normalized `0 0 100 100` viewBox, ready to
 * stretch with `preserveAspectRatio="none"`.
 *
 * ⚓⚓ NORMALIZED, AND FILL-ONLY, FOR ONE REASON: the bar is positioned and
 * sized by the timeline's existing frames→px seam, so the SVG has to stretch to
 * whatever width that produces. A stretched STROKE gets non-uniform thickness
 * (the same trap `objectBoundingBox` set for the bench tail), so the area's own
 * top edge is the line. Nothing here needs to re-run on zoom.
 *
 * `minFrac` lifts a live-but-tiny aura off the floor — a 0.05U reading in a 12px
 * row is half a pixel and would simply not be drawn, which reads as "the aura
 * ended" when it has not.
 */
export function auraSpanPath(span: AuraSpan, uMax: number, minFrac: number): string {
	const width = span.end - span.start;
	const x = (t: number) => (width > 0 ? ((t - span.start) / width) * 100 : 0);
	const y = (u: number) =>
		100 - Math.min(100, Math.max(u > 0 ? minFrac * 100 : 0, (u / uMax) * 100));
	const top = span.points.map(
		(p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(2)},${y(p.u).toFixed(2)}`
	);
	return `${top.join(' ')} L100,100 L0,100 Z`;
}
