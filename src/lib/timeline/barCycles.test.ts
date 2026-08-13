import { describe, expect, it } from 'vitest';
import { laneSegments, repeatCycles } from './barCycles';
import type { BarPhaseSegment } from './barPhases';

const seg = (role: BarPhaseSegment['role'], start: number, span: number): BarPhaseSegment => ({
	role,
	start,
	span
});

describe('repeatCycles', () => {
	it('tiles a cycle across the axis, tagging each repetition', () => {
		const out = repeatCycles([seg('uptime', 0, 4), seg('ghost', 4, 6)], 10, 30);
		expect(out).toHaveLength(6);
		expect(out.map((s) => s.start)).toEqual([0, 4, 10, 14, 20, 24]);
		expect(out.map((s) => s.cycle)).toEqual([0, 0, 1, 1, 2, 2]);
	});

	it('clips the final partial cycle at the axis rather than dropping it', () => {
		const out = repeatCycles([seg('uptime', 0, 8), seg('ghost', 8, 2)], 10, 25);
		const last = out.at(-1)!;
		expect(last.cycle).toBe(2);
		expect(last.start).toBe(20);
		// The window is still open when the axis runs out — draw it running off
		// the edge, don't pretend it ended early or that it never started.
		expect(last.start + last.span).toBe(25);
	});

	it('preserves the ghost cooldown label through the tiling', () => {
		const out = repeatCycles([{ role: 'ghost', start: 0, span: 15, cooldown: 15 }], 15, 30);
		expect(out.every((s) => s.cooldown === 15)).toBe(true);
	});

	it('emits nothing for a degenerate cycle or axis', () => {
		expect(repeatCycles([seg('uptime', 0, 4)], 0, 30)).toEqual([]);
		expect(repeatCycles([seg('uptime', 0, 4)], 10, 0)).toEqual([]);
		expect(repeatCycles([], 10, 30)).toEqual([]);
	});

	it('caps a runaway cadence instead of emitting thousands of segments', () => {
		const out = repeatCycles([seg('uptime', 0, 0.05)], 0.1, 60);
		expect(out.length).toBeLessThanOrEqual(200);
	});
});

describe('laneSegments', () => {
	it('tiles permanent uptime into abutting blocks, one per recast', () => {
		// ⚓ It returned ONE unbroken segment until 2026-08-13, and that lost real
		// information: on a 30s axis a 30s window and a 15s window on a 15s
		// cooldown drew the identical solid bar, when the second one needs you
		// back on that character at 15s to refresh it. Permanent uptime is a
		// RESULT, not a property, and the seams are what it costs.
		const out = laneSegments(20, 15, 60);
		expect(out.every((s) => s.role === 'uptimeFlush')).toBe(true);
		expect(out.map((s) => s.start)).toEqual([0, 15, 30, 45]);
		expect(out.map((s) => s.cycle)).toEqual([0, 1, 2, 3]);
	});

	it('blocks abut exactly — permanent uptime must not read as gapped', () => {
		const out = laneSegments(20, 15, 45);
		for (let i = 1; i < out.length; i++) {
			expect(out[i].start).toBe(out[i - 1].start + out[i - 1].span);
		}
	});

	it('treats duration exactly equal to cooldown as permanent', () => {
		const out = laneSegments(15, 15, 45);
		expect(out).toHaveLength(3);
		expect(out.every((s) => s.role === 'uptimeFlush')).toBe(true);
	});

	it('tiles window-then-gap when the cooldown outlasts the window', () => {
		const out = laneSegments(4, 10, 30);
		const uptimes = out.filter((s) => s.role === 'uptime');
		expect(uptimes.map((s) => s.start)).toEqual([0, 10, 20]);
		expect(uptimes.every((s) => s.span === 4)).toBe(true);
		expect(out.some((s) => s.role === 'ghost')).toBe(true);
	});

	// The index no longer weakens a repeat (that fade is retired — it collided
	// with the cooldown ghost's value). It is what the renderer reads to seam
	// abutting solid blocks, so cycle 0 still has to be distinguishable.
	it('indexes the cycles it emits', () => {
		const out = laneSegments(4, 10, 30);
		expect(out.filter((s) => s.cycle === 0)).toHaveLength(2);
		expect(out.some((s) => (s.cycle ?? 0) > 0)).toBe(true);
	});

	it('emits nothing without both halves of a real cycle', () => {
		expect(laneSegments(0, 10, 30)).toEqual([]);
		expect(laneSegments(10, 0, 30)).toEqual([]);
	});
});
