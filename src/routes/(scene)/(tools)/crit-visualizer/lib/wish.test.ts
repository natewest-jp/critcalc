import { describe, expect, it } from 'vitest';
import { BANNERS, featuredPmf, fiveStarChance, fiveStarPmf, pmfStats, toCdf } from './wish';

const CHAR = BANNERS.character;
const WEAP = BANNERS.weapon;

describe('fiveStarChance — pinned to the community pity tables', () => {
	it('character: 0.6% flat, 6.6% at 74, 96.6% at 89, certain at 90', () => {
		expect(fiveStarChance(CHAR, 1)).toBeCloseTo(0.006, 12);
		expect(fiveStarChance(CHAR, 73)).toBeCloseTo(0.006, 12);
		expect(fiveStarChance(CHAR, 74)).toBeCloseTo(0.066, 12);
		expect(fiveStarChance(CHAR, 89)).toBeCloseTo(0.966, 12);
		expect(fiveStarChance(CHAR, 90)).toBe(1);
	});

	it('weapon: 0.7% flat, 7.7% at 63, 98.7% at 76, certain at 77', () => {
		expect(fiveStarChance(WEAP, 62)).toBeCloseTo(0.007, 12);
		expect(fiveStarChance(WEAP, 63)).toBeCloseTo(0.077, 12);
		expect(fiveStarChance(WEAP, 76)).toBeCloseTo(0.987, 12);
		expect(fiveStarChance(WEAP, 77)).toBe(1);
	});
});

describe('fiveStarPmf', () => {
	it('sums to 1 and never exceeds the hard-pity horizon', () => {
		for (const pity of [0, 30, 73, 89]) {
			const pmf = fiveStarPmf(CHAR, pity);
			expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
			expect(pmf.length - 1).toBe(CHAR.hard - pity);
		}
	});

	it('at pity 89 the next pull is certain', () => {
		expect(fiveStarPmf(CHAR, 89)).toEqual([0, 1]);
	});

	it('mean from zero pity matches the consolidated-rate ballpark (~62.3)', () => {
		// 1 / 1.6% consolidated ≈ 62.5; the exact model mean is ≈ 62.3
		const { mean } = pmfStats(fiveStarPmf(CHAR, 0));
		expect(mean).toBeGreaterThan(62);
		expect(mean).toBeLessThan(63);
	});

	it('soft pity makes pull 76 the modal outcome from zero pity', () => {
		const pmf = fiveStarPmf(CHAR, 0);
		const mode = pmf.indexOf(Math.max(...pmf));
		expect(mode).toBeGreaterThanOrEqual(74);
		expect(mode).toBeLessThanOrEqual(78);
	});
});

describe('featuredPmf', () => {
	it('guaranteed collapses to the first-5★ pmf', () => {
		expect(featuredPmf(CHAR, 40, true)).toEqual(fiveStarPmf(CHAR, 40));
	});

	it('sums to 1 and spans two pity cycles worst-case', () => {
		const pmf = featuredPmf(CHAR, 0);
		expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
		expect(pmf.length - 1).toBe(180);
	});

	it('character mean = 1.45 five-stars (official 55% consolidated)', () => {
		const { mean } = pmfStats(featuredPmf(CHAR, 0));
		const fiveStarMean = pmfStats(fiveStarPmf(CHAR, 0)).mean;
		expect(mean).toBeCloseTo(fiveStarMean * (1 + (1 - CHAR.featured)), 6);
	});

	it('weapon mean = 1.625 five-stars (37.5% charted, 1 fate point)', () => {
		const { mean } = pmfStats(featuredPmf(WEAP, 0));
		const fiveStarMean = pmfStats(fiveStarPmf(WEAP, 0)).mean;
		expect(mean).toBeCloseTo(fiveStarMean * (1 + (1 - WEAP.featured)), 6);
	});

	it('cdf at the full horizon is certainty', () => {
		const cdf = toCdf(featuredPmf(CHAR, 50));
		expect(cdf[cdf.length - 1]).toBeCloseTo(1, 10);
		// within 90 pulls from pity 50: must beat the single-cycle chance
		expect(cdf[40]).toBeGreaterThan(0.5);
	});
});
