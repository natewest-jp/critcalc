import { describe, expect, it } from 'vitest';
import {
	BANNERS,
	cdfAt,
	cdfStats,
	copiesCdfs,
	dropPmf,
	featuredPmf,
	rateAt,
	sumCdf,
	toCdf
} from './wish';

const CHAR = BANNERS.character;
const WEAP = BANNERS.weapon;

describe('rateAt — pinned to the community pity tables', () => {
	it('character: 0.6% flat, 6.6% at 74, 96.6% at 89, certain at 90', () => {
		expect(rateAt(CHAR, 1)).toBeCloseTo(0.006, 12);
		expect(rateAt(CHAR, 73)).toBeCloseTo(0.006, 12);
		expect(rateAt(CHAR, 74)).toBeCloseTo(0.066, 12);
		expect(rateAt(CHAR, 89)).toBeCloseTo(0.966, 12);
		expect(rateAt(CHAR, 90)).toBe(1);
	});

	it('weapon: 0.7% flat, 7.7% at 63, 98.7% at 76, certain at 77', () => {
		expect(rateAt(WEAP, 62)).toBeCloseTo(0.007, 12);
		expect(rateAt(WEAP, 63)).toBeCloseTo(0.077, 12);
		expect(rateAt(WEAP, 76)).toBeCloseTo(0.987, 12);
		expect(rateAt(WEAP, 77)).toBe(1);
	});
});

describe('dropPmf', () => {
	it('sums to 1 and never exceeds the hard-pity horizon', () => {
		for (const pity of [0, 30, 73, 89]) {
			const pmf = dropPmf(CHAR, pity);
			expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
			expect(pmf.length - 1).toBe(CHAR.hard - pity);
		}
	});

	it('at pity 89 the next pull is certain', () => {
		expect(dropPmf(CHAR, 89)).toEqual([0, 1]);
	});

	it('mean from zero pity matches the consolidated-rate ballpark (~62.3)', () => {
		// 1 / 1.6% consolidated ≈ 62.5; the exact model mean is ≈ 62.3
		const { mean } = cdfStats(toCdf(dropPmf(CHAR, 0)));
		expect(mean).toBeGreaterThan(62);
		expect(mean).toBeLessThan(63);
	});

	it('soft pity makes pull 76 the modal outcome from zero pity', () => {
		const pmf = dropPmf(CHAR, 0);
		const mode = pmf.indexOf(Math.max(...pmf));
		expect(mode).toBeGreaterThanOrEqual(74);
		expect(mode).toBeLessThanOrEqual(78);
	});
});

describe('featuredPmf', () => {
	it('guaranteed collapses to the first-5★ pmf', () => {
		expect(featuredPmf(CHAR, 40, true)).toEqual(dropPmf(CHAR, 40));
	});

	it('sums to 1 and spans two pity cycles worst-case', () => {
		const pmf = featuredPmf(CHAR, 0);
		expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
		expect(pmf.length - 1).toBe(180);
	});

	it('character mean = 1.45 five-stars (official 55% consolidated)', () => {
		const { mean } = cdfStats(toCdf(featuredPmf(CHAR, 0)));
		const fiveStarMean = cdfStats(toCdf(dropPmf(CHAR, 0))).mean;
		expect(mean).toBeCloseTo(fiveStarMean * (1 + (1 - CHAR.featured)), 6);
	});

	it('weapon mean = 1.625 five-stars (37.5% charted, 1 fate point)', () => {
		const { mean } = cdfStats(toCdf(featuredPmf(WEAP, 0)));
		const fiveStarMean = cdfStats(toCdf(dropPmf(WEAP, 0))).mean;
		expect(mean).toBeCloseTo(fiveStarMean * (1 + (1 - WEAP.featured)), 6);
	});

	it('cdf at the full horizon is certainty', () => {
		const cdf = toCdf(featuredPmf(CHAR, 50));
		expect(cdf[cdf.length - 1]).toBeCloseTo(1, 10);
		// within 90 pulls from pity 50: must beat the single-cycle chance
		expect(cdf[40]).toBeGreaterThan(0.5);
	});
});

describe('rateAt — the 4★ table', () => {
	it('5.1% through 8, 56.1% on the 9th, certain on the 10th', () => {
		const FOUR = BANNERS.fourStar;
		expect(rateAt(FOUR, 1)).toBeCloseTo(0.051, 12);
		expect(rateAt(FOUR, 8)).toBeCloseTo(0.051, 12);
		expect(rateAt(FOUR, 9)).toBeCloseTo(0.561, 12);
		expect(rateAt(FOUR, 10)).toBe(1);
	});
});

// Oracle: GGanalysis (github.com/OneBST/GGanalysis), regenerated 2026-10-04 —
// `up_4star_specific_character`, `DualPityModel(PITY_5STAR, [0, 0.55, 1])` (the
// 55% consolidated rate, independent per 5★) and `up_5star_ep_weapon`. Each row is
// [copies, pity, guaranteed, mean, median, p90]. Record:
// docs/rounds/wish-odds-pass-2026-10-04.md §1.
const ORACLE: Record<
	'character' | 'fourStar' | 'weapon',
	[number, number, boolean, number, number, number][]
> = {
	fourStar: [
		[1, 0, false, 34.449, 26, 73],
		[7, 0, false, 241.145, 231, 345],
		[7, 5, true, 233.741, 224, 338]
	],
	character: [
		[1, 0, false, 90.331, 79, 155],
		[2, 0, false, 180.662, 174, 253],
		[7, 0, false, 632.318, 631, 778],
		[1, 40, true, 33.891, 37, 41]
	],
	weapon: [
		[1, 0, false, 86.532, 79, 133],
		[5, 0, false, 432.659, 434, 538]
	]
};

describe('copiesCdfs — agrees with GGanalysis', () => {
	for (const [id, rows] of Object.entries(ORACLE)) {
		for (const [need, pity, guaranteed, mean, median, p90] of rows) {
			it(`${id}: ${need} cop${need === 1 ? 'y' : 'ies'} from pity ${pity}${guaranteed ? ', guaranteed' : ''}`, () => {
				const cdfs = copiesCdfs(BANNERS[id as keyof typeof ORACLE], need, pity, guaranteed);
				const s = cdfStats(cdfs[need]);
				expect(s.mean).toBeCloseTo(mean, 2);
				expect(s.median).toBe(median);
				expect(s.p90).toBe(p90);
			});
		}
	}

	it('one copy of a 5★ is exactly the closed form', () => {
		for (const g of [false, true]) {
			const walked = copiesCdfs(CHAR, 1, 30, g)[1];
			const closed = toCdf(featuredPmf(CHAR, 30, g));
			for (let n = 1; n < closed.length; n++) expect(cdfAt(walked, n)).toBeCloseTo(closed[n], 5);
		}
	});

	it('every level is a cdf, and a lower level is never behind a higher one', () => {
		const cdfs = copiesCdfs(BANNERS.fourStar, 7);
		for (let j = 1; j <= 7; j++) {
			for (let n = 1; n < cdfs[j].length; n++) {
				expect(cdfs[j][n]).toBeGreaterThanOrEqual(cdfs[j][n - 1]);
				if (j > 1) expect(cdfs[j - 1][n]).toBeGreaterThanOrEqual(cdfs[j][n]);
			}
		}
		expect(cdfAt(cdfs[7], 1e6)).toBeGreaterThan(1 - 1e-5);
	});
});

describe('sumCdf — a character and its weapon', () => {
	it('the means add, and the total is never ahead of either goal alone', () => {
		const c = copiesCdfs(CHAR, 1)[1];
		const w = copiesCdfs(WEAP, 1)[1];
		const both = sumCdf(c, w);
		expect(cdfStats(both).mean).toBeCloseTo(90.331 + 86.532, 2);
		for (let n = 1; n < both.length; n++) {
			expect(both[n]).toBeLessThanOrEqual(cdfAt(c, n) + 1e-12);
			expect(both[n]).toBeLessThanOrEqual(cdfAt(w, n) + 1e-12);
		}
	});
});
