import { describe, it, expect } from 'vitest';
import {
	SUBSTATS,
	substatPool,
	presenceProbability,
	pairRollDist,
	reshapeDist,
	cvDistribution,
	distStats,
	rollEvents
} from './artifactRolls';

describe('presenceProbability — cross-checked against wiki Artifact/Occurrence', () => {
	it('flower: CR & CD both among the 4 lines = 9.2%', () => {
		const pool = substatPool('hp');
		expect(presenceProbability(pool, ['cr', 'cd'], 4)).toBeCloseTo(0.092, 3);
	});

	it('flower: CR among the 4 lines = 34.2%', () => {
		const pool = substatPool('hp');
		expect(presenceProbability(pool, ['cr'], 4)).toBeCloseTo(0.342, 3);
	});

	it('flower: flat ATK among the 4 lines = 57.8%', () => {
		const pool = substatPool('hp');
		expect(presenceProbability(pool, ['atk'], 4)).toBeCloseTo(0.578, 3);
	});

	it('ATK% sands: CR & CD pair = 8.3%', () => {
		const pool = substatPool('atkPct');
		expect(presenceProbability(pool, ['cr', 'cd'], 4)).toBeCloseTo(0.083, 3);
	});

	it('main stat is excluded from the pool', () => {
		expect(presenceProbability(substatPool('cr'), ['cr'], 4)).toBe(0);
		expect(substatPool('hp')).toHaveLength(9);
		expect(substatPool('elemDmg')).toHaveLength(10);
	});

	it('needing more stats than draws is impossible', () => {
		expect(presenceProbability(substatPool('hp'), ['cr', 'cd', 'atkPct', 'er'], 3)).toBe(0);
	});
});

describe('pairRollDist — cross-checked against wiki Artifact/Distribution upgrade table', () => {
	it('single-line upgrade counts over 5 events match the wiki table', () => {
		// Wiki: 0×=23.73%, 1×=39.55%, 2×=26.37%, 3×=8.79%, 4×=1.46%, 5×=0.10%
		const single = [0, 1, 2, 3, 4, 5].map(
			(k) =>
				pairRollDist(5).length && // structure guard
				// Binomial(5, 1/4) for a single line:
				(([n, p]) => {
					const c = (n_: number, k_: number) => {
						let r = 1;
						for (let i = 0; i < k_; i++) r = (r * (n_ - i)) / (i + 1);
						return r;
					};
					return c(n, k) * p ** k * (1 - p) ** (n - k);
				})([5, 0.25])
		);
		expect(single[0]).toBeCloseTo(0.2373, 4);
		expect(single[1]).toBeCloseTo(0.3955, 4);
		expect(single[2]).toBeCloseTo(0.2637, 4);
		expect(single[5]).toBeCloseTo(0.001, 3);
	});

	it('pair rolls are Binomial(events, ½) and sum to 1', () => {
		const dist = pairRollDist(5);
		expect(dist).toHaveLength(6);
		expect(dist.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
		expect(dist[0]).toBeCloseTo(0.03125, 5);
		expect(dist[2]).toBeCloseTo(0.3125, 5);
	});

	it('3-line start yields 4 value rolls, 4-line start yields 5', () => {
		expect(rollEvents(false)).toBe(4);
		expect(rollEvents(true)).toBe(5);
	});
});

describe('reshapeDist — conditional guarantee model', () => {
	it('zeroes below the guarantee and renormalizes the tail', () => {
		const dist = reshapeDist(5, 2);
		expect(dist[0]).toBe(0);
		expect(dist[1]).toBe(0);
		expect(dist.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
		// Conditional mass keeps base proportions: P(2)/P(3) = 10/10 = 1
		expect(dist[2] / dist[3]).toBeCloseTo(1, 10);
	});

	it('guarantee equal to all events is a point mass', () => {
		const dist = reshapeDist(4, 4);
		expect(dist[4]).toBeCloseTo(1, 10);
	});
});

describe('cvDistribution', () => {
	it('sums to 1 and spans the exact support', () => {
		const dist = cvDistribution(5);
		expect(dist.reduce((acc, d) => acc + d.p, 0)).toBeCloseTo(1, 9);
		// Floor: both initial lines at tier 1, no crit rolls → 5.44 + 5.44
		expect(dist[0].cv).toBeCloseTo(10.88, 2);
		// Ceiling: max-tier CR line + CD line + 5 max-tier CR rolls
		// = 7.78 + 7.77 + 5 × 7.78 = 54.45
		expect(dist[dist.length - 1].cv).toBeCloseTo(54.45, 2);
	});

	it('mean matches the analytic expectation', () => {
		// E[CV] = initial CR + CD lines (avg tier CV 6.61 and 6.605) plus
		// events × ¼ × (avgCRcv + avgCDcv)
		const { mean } = distStats(cvDistribution(5));
		expect(mean).toBeCloseTo(6.61 + 6.605 + 5 * 0.25 * (6.61 + 6.605), 6);
	});

	it('weights are datamined: CR/CD tier ratios hold', () => {
		const cr = SUBSTATS.find((s) => s.id === 'cr')!;
		expect(cr.tiers[3]).toBeCloseTo(0.0389, 4);
		expect(cr.tiers[0] / cr.tiers[3]).toBeCloseTo(0.7, 2);
	});
});
