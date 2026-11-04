import { describe, expect, it } from 'vitest';
import { NO_ICD, STANDARD_ICD, simulateIcd } from '$lib/utils/icd';
import { evenHits, evenShare, evenSpan } from './icdTimeline';

describe('evenShare: the headline', () => {
	// Hand-read off the standard rule (2.5s timer, every 3rd hit): T timer,
	// C counter, · blocked.
	it.each([
		[0.5, 2, 5], // T··C·
		[0.7, 2, 4], // T··C
		[1, 1, 3], // T··
		[1.5, 1, 2], // T·
		[3, 1, 1] // every hit opens its own window
	])('at %ss under Standard ICD, %i of every %i hits apply', (interval, applies, of) => {
		expect(evenShare(interval, STANDARD_ICD)).toEqual({ applies, of });
	});

	it('is every hit with no ICD', () => {
		expect(evenShare(0.1, NO_ICD)).toEqual({ applies: 1, of: 1 });
	});

	it('honours the window limit', () => {
		// 25 hits in a 2.5s window at 0.1s: the timer's, then every 3rd, until 8.
		expect(evenShare(0.1, STANDARD_ICD)).toEqual({ applies: 8, of: 25 });
	});

	it('counts the first hit only when the counter is off', () => {
		expect(evenShare(0.5, { timer: 2, hits: Infinity })).toEqual({ applies: 1, of: 4 });
	});

	it('is the share of a long string, window after window', () => {
		for (const interval of [0.35, 0.5, 0.7, 1.2]) {
			const { applies, of } = evenShare(interval, STANDARD_ICD);
			const sim = simulateIcd(evenHits(interval, of * interval * 6), STANDARD_ICD);
			expect(sim.filter((h) => h.applies).length).toBe(applies * 6);
		}
	});
});

describe('evenSpan and evenHits: the fixed axis', () => {
	it('shows three standard windows', () => {
		expect(evenSpan(STANDARD_ICD)).toBe(7.5);
	});

	it('keeps a floor and a ceiling', () => {
		expect(evenSpan(NO_ICD)).toBe(6);
		expect(evenSpan({ timer: 10, hits: 3 })).toBe(20);
	});

	it('fills the axis with hits that land before its end', () => {
		expect(evenHits(0.5, 7.5)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7]);
		expect(evenHits(3, 7.5)).toEqual([0, 3, 6]);
	});
});
