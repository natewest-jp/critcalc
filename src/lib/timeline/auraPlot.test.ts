import { describe, it, expect } from 'vitest';
import {
	auraMarkerLabels,
	auraPathD,
	auraSpanLabels,
	auraSpanPoints,
	auraUMax,
	auraUnitLines,
	computeAuraLane,
	type AuraMarker,
	type AuraSeries,
	type AuraSpan
} from './auraPlot';
import type { SeriesInterval } from '$lib/utils/gauge';
import type { AuraApplication, TimelineEvent } from '$lib/utils/notationParser';

const interval = (key: SeriesInterval['key'], points: [number, number][]): SeriesInterval => ({
	key,
	points: points.map(([t, u]) => ({ t, u }))
});

const app = (
	time: number,
	element: AuraApplication['element'],
	extra: Partial<AuraApplication> = {}
): AuraApplication => ({
	time,
	characterId: 'xiangling',
	element,
	units: 1,
	castKind: 'skill',
	provisionalUnits: false,
	...extra
});

const reaction = (time: number, r: string, characterId = 'xingqiu'): TimelineEvent =>
	({
		kind: 'reaction',
		id: `r${time}${r}`,
		characterId,
		reaction: r,
		time,
		castKind: 'skill'
	}) as unknown as TimelineEvent;

const span = (start: number, end: number, points: [number, number][]): AuraSpan => ({
	start,
	end,
	peak: points.reduce((m, [, u]) => Math.max(m, u), 0),
	openingU: points[0][1],
	points: points.map(([t, u]) => ({ t, u }))
});

describe('computeAuraLane', () => {
	// The gauge speaks seconds; every other number the timeline handles is a
	// frame. This module is the only place that conversion happens, so it is the
	// only place it can silently stop happening.
	it('converts the gauge series from SECONDS to FRAMES', () => {
		const lane = computeAuraLane(
			[
				interval('pyro', [
					[1, 0.8],
					[3, 0.4],
					[5, 0]
				])
			],
			[],
			[]
		);
		expect(lane.series).toHaveLength(1);
		expect(lane.series[0].spans[0]).toMatchObject({
			start: 60,
			end: 300,
			peak: 0.8,
			openingU: 0.8
		});
		expect(lane.series[0].spans[0].points.map((p) => p.t)).toEqual([60, 180, 300]);
	});

	// A mod re-applied after it fully decayed is a SECOND lifetime, and the gap
	// between them is the lane's whole answer to "where you lost it". Two spans
	// in one series, never one bridging the gap.
	it('keeps each lifetime of a mod as its own span in one series', () => {
		const lane = computeAuraLane(
			[
				interval('pyro', [
					[0, 0.8],
					[4, 0]
				]),
				interval('pyro', [
					[20, 1.6],
					[32, 0]
				])
			],
			[],
			[]
		);
		expect(lane.series).toHaveLength(1);
		expect(lane.series[0].spans.map((s) => [s.start, s.end])).toEqual([
			[0, 240],
			[1200, 1920]
		]);
	});

	// Draw order groups a derived state under the aura it came from — Burning
	// after Pyro, Frozen after Cryo — rather than following the series' arrival
	// order, which is whatever the rotation happened to do first.
	it('orders series by the shared mod ladder, not by first appearance', () => {
		const lane = computeAuraLane(
			[
				interval('quicken', [
					[5, 0.8],
					[9, 0]
				]),
				interval('burning', [
					[1, 2],
					[3, 0]
				]),
				interval('cryo', [
					[0, 0.8],
					[2, 0]
				]),
				interval('pyro', [
					[1, 0.8],
					[4, 0]
				])
			],
			[],
			[]
		);
		expect(lane.series.map((s) => s.mod)).toEqual(['pyro', 'burning', 'cryo', 'quicken']);
	});

	it('drops a mod with no interval and an interval with no points', () => {
		const lane = computeAuraLane([interval('hydro', [])], [], []);
		expect(lane.series).toEqual([]);
	});

	// One hit onto Electro-Charged is Overload AND Vaporize. Two markers at one
	// x would overdraw; one marker naming both is the readable answer.
	it('groups reactions that land on the same frame into ONE marker', () => {
		const lane = computeAuraLane(
			[],
			[],
			[reaction(120, 'overloaded'), reaction(120, 'vaporize'), reaction(300, 'frozen')]
		);
		expect(lane.markers.map((m) => m.time)).toEqual([120, 300]);
		expect(lane.markers[0].entries).toHaveLength(2);
		expect(lane.markers[0].label).toBe('Overload · Vaporize');
	});

	// Two auras present means an Anemo hit swirls twice. The marker says "Swirl"
	// once — the pair is in its entries for the tooltip.
	it('dedupes one frame’s repeated reaction FAMILY in the label', () => {
		const lane = computeAuraLane([], [], [reaction(60, 'pyroSwirl'), reaction(60, 'cryoSwirl')]);
		expect(lane.markers[0].label).toBe('Swirl');
		expect(lane.markers[0].entries).toHaveLength(2);
	});

	// The squiggle rule's substrate: what the lane marks --ui-provisional.
	it('carries each application’s provisional flag', () => {
		const lane = computeAuraLane(
			[],
			[
				app(10, 'pyro'),
				app(20, 'pyro', { provisionalUnits: true }),
				app(30, 'hydro', { provisionalUnits: true })
			],
			[]
		);
		expect(lane.ticks.map((t) => t.provisional)).toEqual([false, true, true]);
	});
});

describe('auraUMax', () => {
	// Floored so a rotation of 0.8U auras does not draw them full-height and
	// imply a saturated target.
	it('floors at 2U however small the peak', () => {
		expect(auraUMax([interval('pyro', [[0, 0.8]])])).toBe(2);
		expect(auraUMax([])).toBe(2);
	});

	it('rounds a larger peak UP to the next half unit', () => {
		expect(auraUMax([interval('cryo', [[0, 2.6]])])).toBe(3);
		expect(auraUMax([interval('cryo', [[0, 3.2]])])).toBe(3.5);
	});
});

describe('auraSpanPoints', () => {
	// 60px per second, a 56px plot, uMax 2.
	const xOf = (f: number) => (f / 60) * 60;
	const yOf = (u: number) => 56 - (u / 2) * 56;

	it('maps frames and units into the caller’s pixel space', () => {
		const s = span(60, 180, [
			[60, 2],
			[120, 1],
			[180, 0]
		]);
		expect(auraSpanPoints(s, xOf, yOf, 0)).toEqual([
			[60, 0],
			[120, 28],
			[180, 56]
		]);
	});

	// A 0.02U tail is a fraction of a pixel: not drawn at all, which reads as
	// "the aura ended" when it has not.
	it('lifts a live-but-tiny gauge to the floor', () => {
		const s = span(0, 60, [
			[0, 0.02],
			[60, 0.02]
		]);
		expect(auraSpanPoints(s, xOf, yOf, 1.5).map(([, y]) => y)).toEqual([54.5, 54.5]);
	});

	// ⛔ The floor must NOT lift a zero. That sample is the instant the aura ran
	// out, and holding it a pixel off the baseline would draw every span ending
	// in a permanent sliver.
	it('leaves a spent gauge exactly on the baseline', () => {
		const s = span(0, 60, [
			[0, 1],
			[60, 0]
		]);
		expect(auraSpanPoints(s, xOf, yOf, 1.5)[1]).toEqual([60, 56]);
	});
});

describe('auraPathD', () => {
	it('walks the points as a bare line when no baseline is given', () => {
		expect(
			auraPathD([
				[0, 10],
				[20, 30]
			])
		).toBe('M0.0,10.0 L20.0,30.0');
	});

	it('closes down to the baseline for the area fill', () => {
		expect(
			auraPathD(
				[
					[0, 10],
					[20, 30]
				],
				56
			)
		).toBe('M0.0,10.0 L20.0,30.0 L20.0,56.0 L0.0,56.0 Z');
	});

	it('is empty rather than malformed for an empty point list', () => {
		expect(auraPathD([], 56)).toBe('');
	});
});

describe('auraSpanLabels', () => {
	const xOf = (f: number) => f; // 1px per frame, so the numbers read directly
	const yOf = (u: number) => 56 - (u / 2) * 56;
	const mk = (mod: string, label: string, spans: AuraSpan[]): AuraSeries =>
		({ mod, label, color: `var(--el-${mod}-main)`, spans }) as AuraSeries;

	it('labels a span wide enough to hold its own name', () => {
		const out = auraSpanLabels(
			[mk('pyro', 'Pyro', [span(0, 100, [[0, 1]])])],
			xOf,
			yOf,
			40,
			30,
			12
		);
		expect(out.map((o) => o.label)).toEqual(['Pyro']);
	});

	it('skips a span narrower than the minimum', () => {
		const out = auraSpanLabels([mk('pyro', 'Pyro', [span(0, 20, [[0, 1]])])], xOf, yOf, 40, 30, 12);
		expect(out).toEqual([]);
	});

	// ⚓ The reason this is one pass over ALL series rather than a per-series
	// decision: Frozen opens on top of Cryo, and neither series can see the other.
	it('drops a label that would land on the previous one, ACROSS series', () => {
		const out = auraSpanLabels(
			[
				mk('cryo', 'Cryo', [span(0, 200, [[0, 1]])]),
				mk('frozen', 'Frozen', [span(10, 200, [[10, 1]])])
			],
			xOf,
			yOf,
			40,
			30,
			12
		);
		expect(out.map((o) => o.label)).toEqual(['Cryo']);
	});

	// ⚠⚠ The half an x-only test got wrong, and it discarded the pair a reader
	// most needs: Burning opens on the SAME FRAME as the Pyro that lit it, at 2U
	// against Pyro's 0.8U. Same x, 30-odd pixels apart — no collision.
	it('keeps two labels at one instant when their GAUGES differ', () => {
		const out = auraSpanLabels(
			[
				mk('pyro', 'Pyro', [span(0, 200, [[0, 0.8]])]),
				mk('burning', 'Burning', [span(0, 200, [[0, 2]])])
			],
			xOf,
			yOf,
			40,
			30,
			12
		);
		expect(out.map((o) => o.label)).toEqual(['Pyro', 'Burning']);
	});

	it('keeps both once they are far enough apart in TIME', () => {
		const out = auraSpanLabels(
			[
				mk('cryo', 'Cryo', [span(0, 200, [[0, 1]])]),
				mk('frozen', 'Frozen', [span(100, 300, [[100, 1]])])
			],
			xOf,
			yOf,
			40,
			30,
			12
		);
		expect(out.map((o) => o.label)).toEqual(['Cryo', 'Frozen']);
	});

	// Sorted by start, not by mod order — the labels read left to right.
	it('returns labels in time order regardless of series order', () => {
		const out = auraSpanLabels(
			[
				mk('pyro', 'Pyro', [span(500, 900, [[500, 1]])]),
				mk('hydro', 'Hydro', [span(0, 400, [[0, 1]])])
			],
			xOf,
			yOf,
			40,
			30,
			12
		);
		expect(out.map((o) => o.label)).toEqual(['Hydro', 'Pyro']);
	});
});

describe('auraUnitLines', () => {
	// One faint datum at 1U is what makes a 2U ceiling inferable without hovering.
	it('rules every whole unit strictly below the ceiling', () => {
		expect(auraUnitLines(2)).toEqual([1]);
		expect(auraUnitLines(3.5)).toEqual([1, 2, 3]);
	});

	// ⛔ Never a line ON the ceiling: the plot's own top edge is that line, and a
	// second one drawn over it reads as a value the aura failed to reach.
	it('never rules the ceiling itself', () => {
		expect(auraUnitLines(1)).toEqual([]);
		expect(auraUnitLines(3)).toEqual([1, 2]);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Reaction RUNS, the label rule, and element-once naming (2026-08-17)
// ═══════════════════════════════════════════════════════════════════════════

/** Hydro and Electro both alive across [t0, t1] seconds — the state that keeps
 *  an Electro-Charged run one run. */
const ecAuras = (t0: number, t1: number): SeriesInterval[] => [
	interval('hydro', [
		[t0, 0.8],
		[t1, 0.4]
	]),
	interval('electro', [
		[t0, 0.8],
		[t1, 0.4]
	])
];

describe('collapseReactionRuns (via computeAuraLane)', () => {
	it('collapses consecutive Electro-Charged ticks into ONE marker with a span', () => {
		const lane = computeAuraLane(
			ecAuras(0, 10),
			[],
			[60, 120, 180, 240].map((t) => reaction(t, 'electroCharged'))
		);
		expect(lane.markers).toHaveLength(1);
		expect(lane.markers[0].time).toBe(60);
		expect(lane.markers[0].endTime).toBe(240);
		expect(lane.markers[0].count).toBe(4);
		// ⚓ The count rides the NAME — the marker draws no bracket (a run is
		// narrower than its own label at resting zoom).
		expect(lane.markers[0].label).toBe('Electro-Charged ×4');
	});

	// ⚠ The safety of the design: only reactions in REACTION_SUSTAINED_BY can
	// ever merge. Two Vaporizes are two events and must stay two markers.
	it('never collapses a DISCRETE reaction, however close together', () => {
		const lane = computeAuraLane(
			ecAuras(0, 10),
			[],
			[60, 62, 64].map((t) => reaction(t, 'vaporize'))
		);
		expect(lane.markers).toHaveLength(3);
		expect(lane.markers.every((m) => m.count === 1)).toBe(true);
		expect(lane.markers.every((m) => m.endTime === m.time)).toBe(true);
	});

	// Break condition 1: a different reaction between two ticks means something
	// else happened, so they are two episodes.
	it('splits a run when a different reaction lands between two ticks', () => {
		const lane = computeAuraLane(
			ecAuras(0, 10),
			[],
			[reaction(60, 'electroCharged'), reaction(90, 'overloaded'), reaction(120, 'electroCharged')]
		);
		expect(lane.markers.map((m) => m.label)).toEqual([
			'Electro-Charged',
			'Overload',
			'Electro-Charged'
		]);
		expect(lane.markers.map((m) => m.count)).toEqual([1, 1, 1]);
	});

	// Break condition 2, and the one that needs the gauge: if a participating
	// aura lapsed and came back, that is a second episode. Two DISJOINT hydro
	// intervals, with the ticks either side of the gap.
	it('splits a run when a sustaining aura lapsed in between', () => {
		const series: SeriesInterval[] = [
			interval('hydro', [
				[1, 0.8],
				[2, 0.1]
			]),
			interval('hydro', [
				[5, 0.8],
				[6, 0.1]
			]),
			interval('electro', [
				[0, 0.8],
				[10, 0.4]
			])
		];
		const lane = computeAuraLane(
			series,
			[],
			[reaction(60, 'electroCharged'), reaction(330, 'electroCharged')]
		);
		expect(lane.markers).toHaveLength(2);
		expect(lane.markers.map((m) => m.count)).toEqual([1, 1]);
	});

	// A frame carrying a ticking reaction AND a discrete one is a compound
	// event, not a tick — it must not swallow its neighbours.
	it('does not merge a marker whose frame also carries a discrete reaction', () => {
		const lane = computeAuraLane(
			ecAuras(0, 10),
			[],
			[
				reaction(60, 'electroCharged'),
				reaction(120, 'electroCharged'),
				reaction(120, 'overloaded'),
				reaction(180, 'electroCharged')
			]
		);
		expect(lane.markers).toHaveLength(3);
		expect(lane.markers[1].label).toBe('Electro-Charged · Overload');
		expect(lane.markers[1].count).toBe(1);
	});
});

describe('auraMarkerLabels', () => {
	const marker = (time: number, label: string): AuraMarker => ({
		time,
		endTime: time,
		count: 1,
		entries: [],
		label
	});
	// One px per frame keeps the arithmetic readable: room === frame distance.
	const xOf = (f: number) => f;
	// One px per character.
	const measure = (t: string) => t.length;

	it('shows a label that fits and DROPS one that does not — never truncating', () => {
		const markers = [marker(0, 'Vaporize'), marker(20, 'Electro-Charged'), marker(30, 'Swirl')];
		// room to the next pip: 20 − 4 = 16 for the first (8 fits), 10 − 4 = 6 for
		// the second (15 does not), Infinity for the last.
		const shown = auraMarkerLabels(markers, xOf, measure, 4);
		expect(shown.has(0)).toBe(true);
		expect(shown.has(20)).toBe(false);
		expect(shown.has(30)).toBe(true);
	});

	// The old rule was a flat 26px, which is what SLICED every longer name. A
	// label is measured against its own width or it is not measured at all.
	it("decides on the label's OWN width, not a constant", () => {
		const short = [marker(0, 'Melt'), marker(10, 'x')];
		const long = [marker(0, 'Electro-Charged'), marker(10, 'x')];
		expect(auraMarkerLabels(short, xOf, measure, 0).has(0)).toBe(true);
		expect(auraMarkerLabels(long, xOf, measure, 0).has(0)).toBe(false);
	});

	// Room belongs to the gap, not to the label — dropping one name must not
	// hand its space to the next marker.
	it('bounds room by the next pip whether or not that pip shows a label', () => {
		const markers = [marker(0, 'Electro-Charged'), marker(5, 'Electro-Charged'), marker(10, 'ok')];
		const shown = auraMarkerLabels(markers, xOf, measure, 0);
		expect(shown.has(0)).toBe(false);
		expect(shown.has(5)).toBe(false);
		expect(shown.has(10)).toBe(true);
	});

	it('always lets the LAST marker speak — nothing follows it to crowd it', () => {
		const shown = auraMarkerLabels([marker(0, 'A very long reaction name')], xOf, measure, 0);
		expect(shown.has(0)).toBe(true);
	});
});

describe('auraSpanLabels — an element names itself once', () => {
	const wide = (start: number) => span(start, start + 999, [[start, 1]]);
	const xOf = (f: number) => f;
	const yOf = () => 0;

	it('labels only the FIRST span of an element mod', () => {
		const series: AuraSeries[] = [
			{
				mod: 'hydro',
				label: 'Hydro',
				color: 'c',
				spans: [wide(0), wide(2000), wide(4000)]
			}
		];
		const out = auraSpanLabels(series, xOf, yOf, 10, 10, 10);
		expect(out).toHaveLength(1);
		expect(out[0].span.start).toBe(0);
	});

	// ⚠ The four compound mods are exempt on purpose: their hues are ours, for
	// states the game gives no colour to, so the word is news every time.
	it('labels EVERY span of a compound mod', () => {
		const series: AuraSeries[] = [
			{
				mod: 'frozen',
				label: 'Frozen',
				color: 'c',
				spans: [wide(0), wide(2000), wide(4000)]
			}
		];
		expect(auraSpanLabels(series, xOf, yOf, 10, 10, 10)).toHaveLength(3);
	});
});
