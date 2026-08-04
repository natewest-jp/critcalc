import { describe, it, expect } from 'vitest';
import { stars } from './stars';

// The packed star field decodes at module init. These pin the decoded shape to
// the generator's committed composition (the banner comment in stars.ts) so a
// packing/decoding drift between scripts/generate-stars.js and the decoder
// can't ship silently.
describe('packed star field', () => {
	it('decodes the full committed composition', () => {
		expect(stars.length).toBe(4774);
		const count = (pred: (s: (typeof stars)[number]) => boolean) => stars.filter(pred).length;
		expect(count((s) => s.animation === 'gentle')).toBe(3548);
		expect(count((s) => s.animation === 'jitter')).toBe(1226);
		expect(count((s) => s.animation === 'dramatic')).toBe(0);
		expect(count((s) => s.color === 'white')).toBe(3288);
		expect(count((s) => s.color === 'warm')).toBe(707);
		expect(count((s) => s.color === 'cool')).toBe(516);
		expect(count((s) => s.color === 'yellow')).toBe(217);
		expect(count((s) => s.color === 'amber')).toBe(46);
		expect(count((s) => s.halo)).toBe(1080);
		// Hero stars: the ✦ sparks — a scattered handful, all flickering, all
		// glowing (their fragment path draws the glow beneath the spark).
		expect(count((s) => s.hero === true)).toBe(24);
		expect(stars.filter((s) => s.hero).every((s) => s.animation === 'jitter' && s.halo)).toBe(true);
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
