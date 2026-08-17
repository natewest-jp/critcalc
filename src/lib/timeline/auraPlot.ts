/**
 * src/lib/timeline/auraPlot.ts
 *
 * THE AURA LANE'S PROJECTION (gauge round L6) — the target's elemental state
 * across the rotation, as ONE overlaid plot.
 *
 * ⚓ THE FIRST SURFACE THE GAUGE HAS. Everything the round built since L5 has
 * been correctness with no picture: the gauge decides which reactions happen,
 * the reactions drive buff windows, and the player sees the buff bars move. This
 * module is where the cause becomes visible — "here is your aura across your
 * rotation, and here is where you lost it."
 *
 * ↻⚓ **ROWS → ONE PLOT, and the reason is a MEASUREMENT rather than a taste
 * change.** This shipped first as one row per mod, each bar's fill height its
 * gauge, on the argument that four concurrent auras on one y axis would go muddy
 * exactly where a reader needs them apart. ⚓ Nate then read the live lane across
 * several reaction families and reported the premise false: **auras barely
 * coexist**, so the rows were paying a real cost — N thin lanes, each too short
 * to show depth — to solve a collision that mostly does not happen. Overlaid,
 * the whole lane's height goes to ONE plot, which is the clarity the units were
 * bought for. ⛔ Do not "restore" the rows without re-measuring the overlap.
 *
 * ⚠️ The compound mods are the case that DOES overlap (Burning sits on its Fuel
 * and on Pyro; Frozen on Cryo), which is why the fill fades to transparent at
 * the baseline and the LINE is what carries the colour — two lines cross
 * legibly, two solid areas do not.
 *
 * ⚠️ Two things ride ABOVE the plot, because they are POINTS and the plot is a
 * continuum:
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
import {
	AURA_MOD_META,
	AURA_MOD_ORDER,
	REACTION_FAMILY,
	REACTION_SUSTAINED_BY
} from '$lib/utils/auraDisplay';
import { FPS } from '$lib/utils/frames';

/** A sample of one aura. Frames + units — ⚓ the gauge speaks seconds, the
 *  timeline speaks frames, and this module is the conversion's only site. */
export type AuraPoint = { t: number; u: number };

/** One continuous lifetime of one aura mod. */
export type AuraSpan = {
	start: number; // frames
	end: number; // frames
	/** Highest gauge reached, units — the span's tooltip headline. */
	peak: number;
	/** Gauge at the span's first sample, units — where its label is pinned. */
	openingU: number;
	points: AuraPoint[];
};

/** One mod's whole life on the plot: every lifetime it had. ⚠️ A SERIES, not a
 *  row — they are drawn overlaid on one y axis. */
export type AuraSeries = {
	mod: AuraKey;
	label: string;
	color: string;
	/** Set only on the one mod that is not really an aura (the Burning fuel),
	 *  which draws as a dashed line with NO fill. */
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
	time: number; // frames — the run's START
	/**
	 * The run's LAST tick, in frames. Equal to `time` for a discrete reaction,
	 * which is every reaction outside `REACTION_SUSTAINED_BY` (2026-08-17).
	 */
	endTime: number;
	/** Ticks in the run. 1 for a discrete reaction. */
	count: number;
	entries: { reaction: Reaction; characterId: string }[];
	/** The marker's visible text: the families, deduped, joined. */
	label: string;
};

export type AuraLane = {
	series: AuraSeries[];
	/** The plot's y ceiling in units. ⚓ ONE scale for every series — that is what
	 *  overlaying them is FOR: a tall Pyro line and a short Hydro one are
	 *  directly comparable, which stacked rows could only imply. */
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
 * full-height and imply a saturated target: the floor is what makes the plot's
 * height mean something absolute rather than relative to the best moment. 2U is
 * a taxed 2.5U application, comfortably above the 1U default everything
 * unmeasured lands at.
 */
export function auraUMax(series: SeriesInterval[]): number {
	const peak = series.reduce((m, s) => s.points.reduce((n, p) => Math.max(n, p.u), m), 0);
	return Math.max(2, Math.ceil(peak * 2) / 2);
}

/**
 * The lane with nothing in it — what the planner substitutes when the AURA
 * LAYER is switched off (2026-08-17), so no consumer downstream has to learn a
 * null.
 *
 * ⚠ ONE frozen instance, deliberately. Consumers are `$derived`, and a fresh
 * object per evaluation would change identity on every unrelated re-run and
 * re-derive the paths, the labels and the unit rules for a lane that draws
 * nothing. `series: []` is the same "no lane" signal an all-physical rotation
 * produces, so the render gate stays one test rather than two.
 */
export const EMPTY_AURA_LANE: AuraLane = Object.freeze({
	series: [],
	uMax: auraUMax([]),
	ticks: [],
	markers: []
});

/** Project the parsed rotation's aura trajectory into the lane's plot. */
export function computeAuraLane(
	gaugeSeries: SeriesInterval[],
	applications: AuraApplication[],
	events: TimelineEvent[]
): AuraLane {
	const series: AuraSeries[] = [];
	for (const mod of AURA_MOD_ORDER) {
		const intervals = gaugeSeries.filter((s) => s.key === mod && s.points.length > 0);
		if (intervals.length === 0) continue;
		const meta = AURA_MOD_META[mod];
		series.push({
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
					openingU: points[0].u,
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
			// endTime/count are the DISCRETE defaults; `collapseReactionRuns` is the
			// only thing that ever moves them.
			marker = { time: ev.time, endTime: ev.time, count: 1, entries: [], label: '' };
			byFrame.set(ev.time, marker);
		}
		marker.entries.push({ reaction: ev.reaction, characterId: ev.characterId });
	}
	const perFrame = [...byFrame.values()].sort((a, b) => a.time - b.time);
	for (const marker of perFrame) {
		// Deduped: two Swirls on one frame (two auras present) read "Swirl", not
		// "Swirl · Swirl" — the tooltip still lists both with their elements.
		marker.label = [...new Set(marker.entries.map((e) => REACTION_FAMILY[e.reaction]))].join(' · ');
	}

	const markers = collapseReactionRuns(perFrame, gaugeSeries);
	// ⚓ THE RUN CARRIES ITS COUNT IN ITS NAME — "Electro-Charged ×4".
	//
	// ↻ This replaced a drawn BRACKET (a hairline from the pip to the run's last
	// tick) and the reversal was geometric, not aesthetic: measured on a real
	// rotation at resting zoom, the label is 82px and the run it names is 72px.
	// An extent drawn from the pip is therefore SHORTER than the word above it, so
	// it renders as an underline of the text rather than as a span — at every
	// colour tried. ⛔ Don't re-attempt the bracket without checking the ratio
	// first; a chart cannot draw a duration narrower than the duration's own name.
	//
	// ⚠ Set on `label` itself rather than a second `displayLabel`, so the string
	// that is MEASURED is the string that renders — on both the screen and the
	// canvas. Two fields is how those come to disagree.
	for (const marker of markers) {
		if (marker.count > 1) marker.label = `${marker.label} ×${marker.count}`;
	}

	return { series, uMax: auraUMax(gaugeSeries), ticks, markers };
}

/**
 * ⚓ A RUN OF ONE TICKING REACTION IS ONE MARKER (2026-08-17).
 *
 * Electro-Charged ticking twelve times over twelve seconds is one episode, and
 * drawing it as twelve named events both misreports it and paints twelve copies
 * of a long word across a row that has no space for one. See
 * `REACTION_SUSTAINED_BY` for the full argument and for the two places this
 * codebase had already reached the same conclusion.
 *
 * TWO CONDITIONS, NEITHER OF THEM A THRESHOLD:
 *
 * 1. **Same label, adjacent.** The walk is in time order, so a marker with a
 *    different label starts a new run by construction — a Vaporize between two
 *    Electro-Charged ticks splits them, because something else happened.
 * 2. **The auras behind it never lapsed.** `sustainedThroughout` asks the gauge
 *    whether ONE interval of every participating mod covers the whole span. If
 *    Hydro ran out and came back, that is a second episode and gets its own
 *    marker. ⛔ Never "within N seconds of each other" — the gauge knows the
 *    answer, so a number here would be a guess replacing a fact.
 *
 * ⚠️ A marker only merges when EVERY entry on it is a ticking reaction. A frame
 * carrying "Electro-Charged · Overload" is a compound event, not a tick, and
 * stays where it is.
 */
function collapseReactionRuns(markers: AuraMarker[], gaugeSeries: SeriesInterval[]): AuraMarker[] {
	const out: AuraMarker[] = [];
	for (const marker of markers) {
		const mods = runMods(marker);
		const prev = out[out.length - 1];
		if (
			prev &&
			mods &&
			prev.label === marker.label &&
			sustainedThroughout(gaugeSeries, mods, prev.time, marker.time)
		) {
			prev.endTime = marker.time;
			prev.count += 1;
			prev.entries.push(...marker.entries);
			continue;
		}
		out.push({ ...marker, endTime: marker.time, count: 1 });
	}
	return out;
}

/** The mods that must stay alive for this marker to be part of a run, or null
 *  when any entry on it is a discrete reaction (which never merges). */
function runMods(marker: AuraMarker): AuraKey[] | null {
	const mods = new Set<AuraKey>();
	for (const entry of marker.entries) {
		const sustaining = REACTION_SUSTAINED_BY[entry.reaction];
		if (!sustaining) return null;
		for (const mod of sustaining) mods.add(mod);
	}
	return mods.size > 0 ? [...mods] : null;
}

/** Did ONE unbroken interval of every mod cover `[t0, t1]`? Intervals of a
 *  single mod are disjoint by construction, so "one covers both ends" is the
 *  same question as "the mod never lapsed in between". Frames in, seconds on
 *  the series — the multiply is the seam. */
function sustainedThroughout(
	series: SeriesInterval[],
	mods: AuraKey[],
	t0: number,
	t1: number
): boolean {
	return mods.every((mod) =>
		series.some(
			(s) =>
				s.key === mod &&
				s.points.length > 0 &&
				s.points[0].t * FPS <= t0 &&
				s.points[s.points.length - 1].t * FPS >= t1
		)
	);
}

/**
 * Which markers get to show their name, left to right.
 *
 * ⚓ DROPPED, NEVER CLIPPED, AND MEASURED RATHER THAN GUESSED (2026-08-17). The
 * rule was already "drop it" — the renderer's note says a two-character stub
 * names nothing and still costs the pip its clearance — but it was enforced
 * against a fixed 26px, chosen as "roughly the shortest family name". Every
 * label between 26px and its own width therefore got SLICED, which is how one
 * rotation came to read `Electro-C · Electro-Ch · Electro-Cha · Electro-Charge`:
 * four truncations of one word, each looking like a different thing.
 *
 * ⚠️ `measure` is injected rather than computed here, exactly like `xOf`/`yOf`
 * in `auraSpanLabels` — this module stays pure and testable, and the screen and
 * the canvas each supply their own text metrics.
 *
 * ⚠️ Room is bounded by the NEXT marker's pip regardless of whether that marker
 * shows its own label: dropping a name frees no space, because the space was
 * never the label's to take.
 */
export function auraMarkerLabels(
	markers: AuraMarker[],
	xOf: (frames: number) => number,
	measure: (text: string) => number,
	padPx: number
): Set<number> {
	const shown = new Set<number>();
	markers.forEach((marker, i) => {
		const next = markers[i + 1];
		const room = next ? xOf(next.time) - xOf(marker.time) - padPx : Infinity;
		if (measure(marker.label) <= room) shown.add(marker.time);
	});
	return shown;
}

/**
 * A span's polyline in the caller's own pixel space.
 *
 * ⚓⚓ THE ONE WALK, SHARED BY BOTH RENDERERS. The screen joins these into an SVG
 * `d`; the canvas export runs the identical list through `moveTo`/`lineTo`. A
 * mirror that re-derives the shape is not a mirror.
 *
 * ↻ This replaced a NORMALIZED path (`0 0 100 100` + `preserveAspectRatio="none"`),
 * which the row form needed because each bar was sized by the timeline's
 * frames→px seam and the SVG had to stretch to it. ⚓ **That constraint is gone
 * with the rows, and it is what makes the line possible**: one plot spanning the
 * whole track draws at 1:1, so a stroke has uniform thickness and the
 * `objectBoundingBox` stretch trap (the bench tail's) does not apply.
 *
 * `minPx` lifts a live-but-tiny aura off the baseline — a 0.05U reading is a
 * fraction of a pixel, and not drawing it reads as "the aura ended" a second
 * before it did. ⛔ A gauge of exactly zero is NOT lifted: that point is the
 * moment the aura ran out, which is the thing the lane exists to show.
 */
export function auraSpanPoints(
	span: AuraSpan,
	xOf: (frames: number) => number,
	yOf: (units: number) => number,
	minPx: number
): Array<[number, number]> {
	const base = yOf(0);
	return span.points.map((p) => {
		const y = yOf(p.u);
		return [xOf(p.t), p.u > 0 ? Math.min(y, base - minPx) : y] as [number, number];
	});
}

/** An SVG `d` from a point list. `close` shuts the path down to `baseY` for the
 *  area fill; without it the path is the bare gauge line. */
export function auraPathD(points: Array<[number, number]>, baseY?: number): string {
	if (points.length === 0) return '';
	const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
	if (baseY === undefined) return d;
	const first = points[0];
	const last = points[points.length - 1];
	return `${d} L${last[0].toFixed(1)},${baseY.toFixed(1)} L${first[0].toFixed(1)},${baseY.toFixed(1)} Z`;
}

/**
 * Which spans get to show their mod's name, left to right.
 *
 * ⚓ THE LABEL IS ON THE SPAN, NOT THE LANE, because there are no lanes any
 * more — an overlaid plot has nowhere to put a permanent legend that is not on
 * top of the data. Naming the aura where it APPEARS also puts the word at the
 * one moment it is news.
 *
 * ⚠️ Two suppressions, and they are different: a span too narrow to hold its own
 * name is skipped, and a span whose name would COLLIDE with an already-placed
 * one is skipped. The second is why this is a single pass over ALL series in
 * start order rather than a per-series decision — Frozen opening on top of Cryo
 * is the standing case, and neither series can see the other.
 *
 * ⚠️⚠️ A collision is BOTH AXES, not just x. Burning opens on the same frame as
 * the Pyro that lit it, so an x-only test threw away one of the two labels a
 * reader most needs — and they were never going to overlap, because Burning
 * opens at 2U and Pyro at 0.8U, 30-odd pixels apart. ⛔ Don't simplify this back
 * to an x test.
 */
export function auraSpanLabels(
	series: AuraSeries[],
	xOf: (frames: number) => number,
	yOf: (units: number) => number,
	minSpanPx: number,
	minGapPx: number,
	minRowPx: number
): Array<{ mod: AuraKey; label: string; color: string; span: AuraSpan }> {
	const candidates = series
		.flatMap((s) =>
			// ⚓ AN ELEMENT NAMES ITSELF ONCE; A COMPOUND STATE NAMES ITSELF EVERY
			// TIME (2026-08-17). Under Electro-Charged the Hydro aura is consumed and
			// re-applied constantly, so it fragments into four or five spans and the
			// plot printed HYDRO four or five times — each correct alone, together
			// just noise. The word was justified as being "news where the aura
			// appears", and the SECOND appearance of Hydro is not news: this audience
			// reads the `--el-*` ramps as element names already.
			//
			// ⚠️ The four compound mods are exempt and must stay exempt. Frozen,
			// Quicken, Burning and the Fuel wear OUR `--rx-*` hues, for states the
			// game gives no colour to, so their name is news at every appearance —
			// and they are also the mods a reader is least able to infer from
			// context. See `AuraModMeta.compound`.
			(AURA_MOD_META[s.mod].compound ? s.spans : s.spans.slice(0, 1)).map((span) => ({
				mod: s.mod,
				label: s.label,
				color: s.color,
				span
			}))
		)
		.sort((a, b) => a.span.start - b.span.start);
	const out: typeof candidates = [];
	const placed: Array<[number, number]> = [];
	for (const c of candidates) {
		const x = xOf(c.span.start);
		const y = yOf(c.span.openingU);
		if (xOf(c.span.end) - x < minSpanPx) continue;
		if (placed.some(([px, py]) => x - px < minGapPx && Math.abs(y - py) < minRowPx)) continue;
		out.push(c);
		placed.push([x, y]);
	}
	return out;
}

/**
 * The whole-unit gridlines strictly below the ceiling — 1U on a 2U plot.
 *
 * ⚓ THE ONE PIECE OF CHART FURNITURE THIS LANE GETS, and it is here because the
 * plot's y axis is otherwise UNREADABLE without hovering: a shape that fills 40%
 * of its box says nothing until you know what the box is worth. One faint datum
 * makes the ceiling inferable at a glance and turns the headroom above a shallow
 * aura from empty space into a statement. ⛔ Not a full axis — no ticks, no
 * numbers on screen; the timeline sheds furniture on purpose and one line is the
 * whole budget.
 */
export function auraUnitLines(uMax: number): number[] {
	const out: number[] = [];
	for (let u = 1; u < uMax; u++) out.push(u);
	return out;
}
