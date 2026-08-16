import { describe, it, expect } from 'vitest';
import { auraSpanPath, auraUMax, computeAuraLane } from './auraRows';
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
		expect(lane.rows).toHaveLength(1);
		expect(lane.rows[0].spans[0]).toMatchObject({ start: 60, end: 300, peak: 0.8 });
		expect(lane.rows[0].spans[0].points.map((p) => p.t)).toEqual([60, 180, 300]);
	});

	// A mod re-applied after it fully decayed is a SECOND lifetime, and the gap
	// between them is the lane's whole answer to "where you lost it". Two spans
	// in one row, never one span bridging the gap.
	it('keeps each lifetime of a mod as its own span in one row', () => {
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
		expect(lane.rows).toHaveLength(1);
		expect(lane.rows[0].spans.map((s) => [s.start, s.end])).toEqual([
			[0, 240],
			[1200, 1920]
		]);
	});

	// Row order groups a derived state under the aura it came from — Burning
	// beneath Pyro, Frozen beneath Cryo — rather than following the series'
	// arrival order, which is whatever the rotation happened to do first.
	it('orders rows by the shared mod ladder, not by first appearance', () => {
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
		expect(lane.rows.map((r) => r.mod)).toEqual(['pyro', 'burning', 'cryo', 'quicken']);
	});

	it('drops a mod with no interval and an interval with no points', () => {
		const lane = computeAuraLane([interval('hydro', [])], [], []);
		expect(lane.rows).toEqual([]);
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

describe('auraSpanPath', () => {
	// Normalized so the bar can be sized by the timeline's existing frames→px
	// seam and stretched with preserveAspectRatio="none".
	it('normalizes x to 0..100 across the span and y to the shared uMax', () => {
		const span = {
			start: 60,
			end: 260,
			peak: 2,
			points: [
				{ t: 60, u: 2 },
				{ t: 160, u: 1 },
				{ t: 260, u: 0 }
			]
		};
		expect(auraSpanPath(span, 2, 0)).toBe(
			'M0.00,0.00 L50.00,50.00 L100.00,100.00 L100,100 L0,100 Z'
		);
	});

	// A 0.05U reading in a 12px row is half a pixel: not drawn at all, which
	// reads as "the aura ended" when it has not.
	it('lifts a live-but-tiny gauge to the floor, and leaves a spent one at zero', () => {
		const span = {
			start: 0,
			end: 100,
			peak: 0.05,
			points: [
				{ t: 0, u: 0.05 },
				{ t: 100, u: 0 }
			]
		};
		// 0.05 / 2 = 2.5% of the row, lifted to the 12.5% floor → y = 87.5
		expect(auraSpanPath(span, 2, 0.125)).toBe('M0.00,87.50 L100.00,100.00 L100,100 L0,100 Z');
	});

	it('does not divide by zero on a single-frame span', () => {
		const span = { start: 40, end: 40, peak: 1, points: [{ t: 40, u: 1 }] };
		expect(auraSpanPath(span, 2, 0)).toBe('M0.00,50.00 L100,100 L0,100 Z');
	});
});
