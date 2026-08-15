/**
 * mergeRefreshedBars.test.ts — the row-level refresh merge (2026-08-15).
 *
 * Behavioral coverage of the merge itself lives in buffWindows.test.ts (end to
 * end through the real parser). This file covers the GUARDS, which are the part
 * that can silently paint something false: a merged ramp envelope, or two bars
 * with different values fused into one.
 */

import { describe, it, expect } from 'vitest';
import { mergeRefreshedBars } from './mergeRefreshedBars';
import type { MergedEffectDisplay } from './types';

const fx = (stat: string, displayValue = '+20%'): MergedEffectDisplay[] =>
	[{ stat, displayValue }] as unknown as MergedEffectDisplay[];

const bar = (start: number, end: number, effects = fx('atk')) => ({ start, end, effects });

describe('mergeRefreshedBars', () => {
	it('merges overlapping bars that print the same thing', () => {
		expect(mergeRefreshedBars([bar(0, 12), bar(8, 20)])).toEqual([bar(0, 20)]);
	});

	it('leaves a gap alone', () => {
		expect(mergeRefreshedBars([bar(0, 8), bar(10, 18)])).toHaveLength(2);
	});

	it('treats exactly-touching bars as continuous', () => {
		expect(mergeRefreshedBars([bar(0, 8), bar(8, 16)])).toEqual([bar(0, 16)]);
	});

	// ⚓ The whole point of comparing FORMATTED values: a stack-scaled buff that
	// ramped between triggers says something different and must stay two bars.
	it('⛔ does NOT merge bars whose displayed value differs', () => {
		const merged = mergeRefreshedBars([
			bar(0, 12, fx('atk', '+20%')),
			bar(6, 18, fx('atk', '+30%'))
		]);
		expect(merged).toHaveLength(2);
	});

	it('⛔ does NOT merge bars carrying different stats', () => {
		expect(mergeRefreshedBars([bar(0, 12, fx('atk')), bar(6, 18, fx('em'))])).toHaveLength(2);
	});

	it('sorts by start, so emission order cannot hide an overlap', () => {
		expect(mergeRefreshedBars([bar(8, 20), bar(0, 12)])).toEqual([bar(0, 20)]);
	});

	// A short re-trigger inside a long open window must not pull its end back.
	it('takes the max end, never the latest end', () => {
		expect(mergeRefreshedBars([bar(0, 20), bar(2, 6)])).toEqual([bar(0, 20)]);
	});

	it('honours the caller gate — a ramp envelope restarts and must not fuse', () => {
		type RampBar = ReturnType<typeof bar> & { rampParams?: object };
		const a: RampBar = { ...bar(0, 12), rampParams: { duration: 12 } };
		const b: RampBar = { ...bar(6, 18), rampParams: { duration: 12 } };
		const gate = (x: RampBar, y: RampBar) =>
			x.rampParams === undefined && y.rampParams === undefined;
		expect(mergeRefreshedBars([a, b], gate)).toHaveLength(2);
		// Same two bars without envelopes DO merge — proving the gate is what
		// separated them, not the geometry.
		expect(mergeRefreshedBars([bar(0, 12), bar(6, 18)], () => true)).toHaveLength(1);
	});

	it('does not mutate the caller’s bars', () => {
		const input = [bar(0, 12), bar(8, 20)];
		mergeRefreshedBars(input);
		expect(input[0].end).toBe(12);
	});
});
