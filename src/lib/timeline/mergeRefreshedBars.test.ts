/**
 * mergeRefreshedBars.test.ts — the row-level refresh merge (2026-08-15).
 *
 * Behavioral coverage of the merge itself lives in buffWindows.test.ts (end to
 * end through the real parser). This file covers the GUARDS, which are the part
 * that can silently paint something false: a merged ramp envelope, or two bars
 * with different values fused into one.
 */

import { describe, it, expect } from 'vitest';
import { fuseNestedBars, mergeRefreshedBars } from './mergeRefreshedBars';
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

// ── fuseNestedBars — the pool round's seam (2026-09-17) ──────────────────────
//
// `deriveBuffWindows` emits one window per (provenance, duration); the parts of
// one cast share a START and must draw as ONE bar with a seam at each inner end.
describe('fuseNestedBars', () => {
	type SeamBar = ReturnType<typeof bar> & { seams?: number[] };
	const seamed = (start: number, parts: Array<[number, MergedEffectDisplay[]]>): SeamBar[] =>
		parts.map(([end, effects]) => ({ start, end, effects }));

	it('fuses same-start bars into one bar running to the longest end, seamed at the inner end', () => {
		const out = fuseNestedBars(
			seamed(0, [
				[720, fx('atk')],
				[900, fx('atk%', '+30%')]
			])
		);
		expect(out).toHaveLength(1);
		expect(out[0].start).toBe(0);
		expect(out[0].end).toBe(900);
		expect(out[0].seams).toEqual([720]);
	});

	it('annotates every effect of a seamed bar with its OWN length', () => {
		const out = fuseNestedBars(
			seamed(60, [
				[780, fx('atk')],
				[960, fx('atk%', '+30%')]
			])
		);
		expect(out[0].effects.map((e) => e.note)).toEqual(['12s', '15s']);
	});

	it('same start, same end — one bar, no seam, no notes', () => {
		const out = fuseNestedBars(
			seamed(0, [
				[720, fx('atk')],
				[720, fx('em', '+80')]
			])
		);
		expect(out).toHaveLength(1);
		expect(out[0].seams).toBeUndefined();
		expect(out[0].effects.map((e) => e.stat)).toEqual(['atk', 'em']);
		expect(out[0].effects.every((e) => e.note === undefined)).toBe(true);
	});

	it('leaves bars with different starts alone', () => {
		const bars = [bar(0, 720), bar(900, 1620)];
		expect(fuseNestedBars(bars)).toEqual(bars);
	});

	it('honours the caller gate over the WHOLE group — one refusal keeps every bar separate', () => {
		type EnvBar = ReturnType<typeof bar> & { rampParams?: object };
		const a: EnvBar = { ...bar(0, 720), rampParams: { duration: 720 } };
		const b: EnvBar = bar(0, 900, fx('atk%', '+30%'));
		expect(fuseNestedBars([a, b], (x) => x.rampParams === undefined)).toHaveLength(2);
	});

	// ⛔ A compound re-applied before it expires would need its seams re-placed;
	// two lit leading edges say it honestly instead.
	it('⛔ a seamed bar never refresh-merges', () => {
		const first = fuseNestedBars(
			seamed(0, [
				[720, fx('atk')],
				[900, fx('atk%', '+30%')]
			])
		);
		const second = fuseNestedBars(
			seamed(600, [
				[1320, fx('atk')],
				[1500, fx('atk%', '+30%')]
			])
		);
		expect(mergeRefreshedBars([...first, ...second])).toHaveLength(2);
	});
	// ⚓ Kazuha's C2: +200 EM to the active character AND to himself, "do not
	// stack" — on his own row the active slice (cut at his swap-out) and the
	// self half (the field's length) are one line, and the slice's end draws no
	// seam because nothing the bar still lists ends there.
	it('collapses an identical grant to one line, the longer instance, and keeps no seam for it', () => {
		type DurBar = ReturnType<typeof bar> & { duration?: number; seams?: number[] };
		const slice: DurBar = { ...bar(82, 200, fx('em', '+200')), duration: 569 };
		const self: DurBar = { ...bar(82, 651, fx('em', '+200')), duration: 569 };
		const out = fuseNestedBars([slice, self]);
		expect(out).toHaveLength(1);
		expect(out[0].end).toBe(651);
		expect(out[0].effects).toEqual([{ stat: 'em', displayValue: '+200' }]);
		expect(out[0].seams).toBeUndefined();
	});
});
