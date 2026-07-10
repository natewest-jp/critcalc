import { describe, it, expect } from 'vitest';
import { stars } from './stars';

// The packed star field decodes at module init. These pin the decoded shape to
// the generator's committed composition (the banner comment in stars.ts) so a
// packing/decoding drift between scripts/generate-stars.js and the decoder
// can't ship silently.
describe('packed star field', () => {
	it('decodes the full committed composition', () => {
		expect(stars.length).toBe(1400);
		const count = (pred: (s: (typeof stars)[number]) => boolean) => stars.filter(pred).length;
		expect(count((s) => s.animation === 'gentle')).toBe(1226);
		expect(count((s) => s.animation === 'jitter')).toBe(99);
		expect(count((s) => s.animation === 'dramatic')).toBe(75);
		expect(count((s) => s.color === 'white')).toBe(986);
		expect(count((s) => s.color === 'warm')).toBe(205);
		expect(count((s) => s.color === 'cool')).toBe(145);
		expect(count((s) => s.color === 'yellow')).toBe(49);
		expect(count((s) => s.color === 'amber')).toBe(15);
		expect(count((s) => s.halo)).toBe(390);
	});

	it('decodes every field into its documented range', () => {
		for (const s of stars) {
			expect(s.x).toBeGreaterThanOrEqual(0);
			expect(s.x).toBeLessThanOrEqual(100);
			expect(s.y).toBeGreaterThanOrEqual(0);
			expect(s.y).toBeLessThanOrEqual(100);
			expect(s.size).toBeGreaterThan(0);
			expect(s.duration).toBeGreaterThan(0);
			expect(s.delay).toBeGreaterThanOrEqual(0);
			expect(s.base).toBeGreaterThanOrEqual(0);
			expect(s.base).toBeLessThanOrEqual(1);
			// variant is a jitter-only concept
			if (s.variant !== undefined) expect(s.animation).toBe('jitter');
			if (s.animation === 'jitter') expect(['a', 'b', 'c']).toContain(s.variant);
		}
	});

	it('decodes 2-decimal values exactly (no float drift in string form)', () => {
		for (const s of stars) {
			for (const v of [s.x, s.y, s.size, s.duration, s.delay, s.base]) {
				const dp = (String(v).split('.')[1] ?? '').length;
				expect(dp).toBeLessThanOrEqual(2);
			}
		}
	});
});
