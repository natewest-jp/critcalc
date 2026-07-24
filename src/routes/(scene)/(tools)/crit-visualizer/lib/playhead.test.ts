import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYHEAD_SPEED, PLAYHEAD_SPEEDS, advance } from './playhead';

describe('playhead advance', () => {
	it('scales the frame delta by speed', () => {
		expect(advance(0, 1000, 0.25, 60).t).toBeCloseTo(0.025, 9); // clamped to 100ms
		expect(advance(0, 16, 0.5, 60).t).toBeCloseTo(0.008, 9);
		expect(advance(2, 16, 1, 60).t).toBeCloseTo(2.016, 9);
	});

	it('clamps huge deltas (hidden-tab return) to 100ms of wall clock', () => {
		const afterAbsence = advance(5, 60_000, 1, 60);
		expect(afterAbsence.t).toBeCloseTo(5.1, 9);
		expect(afterAbsence.ended).toBe(false);
	});

	it('ignores negative deltas', () => {
		expect(advance(5, -50, 1, 60).t).toBe(5);
	});

	it('ends exactly at the duration', () => {
		const step = advance(59.99, 100, 1, 60);
		expect(step.ended).toBe(true);
		expect(step.t).toBe(60);
	});

	it('slow default is the shipped speed set', () => {
		expect(DEFAULT_PLAYHEAD_SPEED).toBe(0.25);
		expect(PLAYHEAD_SPEEDS).toContain(DEFAULT_PLAYHEAD_SPEED);
		expect(PLAYHEAD_SPEEDS).toContain(1);
	});
});
