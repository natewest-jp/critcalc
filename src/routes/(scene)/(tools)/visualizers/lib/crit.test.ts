import { describe, it, expect } from 'vitest';
import {
	sampleRotation,
	CR_MIN,
	CR_MAX,
	CD_MIN,
	CD_MAX,
	averageDamageMultiplier,
	zeroCritProbability,
	critValue,
	cvLineCR,
	bestSplit,
	formatChance,
	critCountDistribution,
	rotationMultiplier,
	formatMultiplier,
	zeroCritRiskColor,
	riskGradient,
	riskColorSmooth,
	cdToX,
	crToY,
	xToCD,
	yToCR,
	PAD,
	PLOT_WIDTH,
	PLOT_HEIGHT
} from './crit';

describe('averageDamageMultiplier', () => {
	it('computes 1 + CR × CD in range', () => {
		expect(averageDamageMultiplier(0.7, 1.4)).toBeCloseTo(1.98);
		expect(averageDamageMultiplier(0.05, 0.5)).toBeCloseTo(1.025);
		expect(averageDamageMultiplier(1.0, 3.0)).toBeCloseTo(4.0);
	});

	it('clamps CR to [0, 1] and floors CD at 0 for out-of-range inputs', () => {
		expect(averageDamageMultiplier(1.5, 2.0)).toBeCloseTo(3.0);
		expect(averageDamageMultiplier(-0.2, 2.0)).toBeCloseTo(1.0);
		expect(averageDamageMultiplier(0.5, -1.0)).toBeCloseTo(1.0);
	});
});

describe('zeroCritProbability', () => {
	it('is (1 - CR)^hits', () => {
		expect(zeroCritProbability(0.5, 2)).toBeCloseTo(0.25);
		expect(zeroCritProbability(0.7, 8)).toBeCloseTo(Math.pow(0.3, 8));
	});

	it('floors hits at 1 and rounds fractional hits', () => {
		expect(zeroCritProbability(0.5, 0)).toBeCloseTo(0.5);
		expect(zeroCritProbability(0.5, 2.6)).toBeCloseTo(0.125);
	});

	it('is 0 at CR ≥ 100%', () => {
		expect(zeroCritProbability(1.0, 5)).toBe(0);
		expect(zeroCritProbability(1.2, 5)).toBe(0);
	});
});

describe('crit value', () => {
	it('is 2·CR + CD', () => {
		expect(critValue(0.7, 1.4)).toBeCloseTo(2.8);
		expect(critValue(0.05, 0.5)).toBeCloseTo(0.6);
	});

	it('budget line inverts crit value at a given CD', () => {
		const cv = critValue(0.7, 1.4);
		expect(cvLineCR(cv, 1.4)).toBeCloseTo(0.7);
		// Sliding along the line keeps CV constant
		expect(critValue(cvLineCR(cv, 2.0), 2.0)).toBeCloseTo(cv);
	});
});

describe('bestSplit', () => {
	it('is CR = CV/4, CD = CV/2 when that split is reachable', () => {
		const best = bestSplit(2.8);
		expect(best.critRate).toBeCloseTo(0.7);
		expect(best.critDamage).toBeCloseTo(1.4);
	});

	it('caps CRIT Rate at 100% and puts the rest into CRIT DMG', () => {
		const best = bestSplit(4.6);
		expect(best.critRate).toBeCloseTo(1.0);
		expect(best.critDamage).toBeCloseTo(2.6);
	});

	it('keeps CRIT DMG at its base when the budget is too small for a 2:1 split', () => {
		const best = bestSplit(0.7);
		expect(best.critDamage).toBeCloseTo(0.5);
		expect(best.critRate).toBeCloseTo(0.1);
	});

	it('beats every other point on the same budget line', () => {
		for (const cv of [0.7, 1.6, 2.8, 4.2, 4.6]) {
			const best = bestSplit(cv);
			const peak = averageDamageMultiplier(best.critRate, best.critDamage);
			for (let cd = CD_MIN; cd <= CD_MAX; cd += 0.01) {
				const cr = cvLineCR(cv, cd);
				if (cr < CR_MIN || cr > CR_MAX) continue;
				expect(averageDamageMultiplier(cr, cd)).toBeLessThanOrEqual(peak + 1e-9);
			}
		}
	});
});

describe('zeroCritRiskColor', () => {
	it('maps probability bands to the fixed ramp', () => {
		expect(zeroCritRiskColor(0.01)).toBe('#5be0ac');
		expect(zeroCritRiskColor(0.1)).toBe('#f6d365');
		expect(zeroCritRiskColor(0.3)).toBe('#f4a261');
		expect(zeroCritRiskColor(0.9)).toBe('#e63946');
	});

	// A gradient's stops — an rgb() stop has commas of its own
	const stopsOf = (gradient: string) =>
		gradient.slice('linear-gradient(to right, '.length, -1).split(/, (?=#|rgb)/);

	it("the slider gradient colours each hit count by the build's own risk", () => {
		// 100% CR cannot miss: green end to end, no yellow anywhere
		const sure = stopsOf(riskGradient(1));
		expect(sure.every((stop) => stop.startsWith('#5be0ac'))).toBe(true);
		// 70% CR: 1 hit is a 30% risk (between yellow and orange), 4 hits (0.8%) is green
		const high = stopsOf(riskGradient(0.7, 1, 4));
		expect(high[0]).toMatch(/^rgb\(/);
		expect(high[3]).toBe('#5be0ac 100%');
		// 5% CR, 2 hits: a 90% risk is plain red
		expect(riskGradient(0.05, 1, 2)).toContain('#e63946 100%');
	});

	it('the continuous ramp lands on each risk colour at its anchor', () => {
		expect(riskColorSmooth(0)).toBe('#5be0ac');
		expect(riskColorSmooth(0.12)).toBe('rgb(246, 211, 101)'); // = #f6d365
		expect(riskColorSmooth(0.9)).toBe('#e63946');
	});
});

describe('coordinate transforms', () => {
	it('round-trips stat → pixel → stat', () => {
		expect(xToCD(cdToX(1.4))).toBeCloseTo(1.4);
		expect(yToCR(crToY(0.7))).toBeCloseTo(0.7);
	});

	it('maps axis bounds to plot edges', () => {
		expect(cdToX(CD_MIN)).toBeCloseTo(PAD.left);
		expect(cdToX(CD_MAX)).toBeCloseTo(PAD.left + PLOT_WIDTH);
		expect(crToY(CR_MAX)).toBeCloseTo(PAD.top);
		expect(crToY(CR_MIN)).toBeCloseTo(PAD.top + PLOT_HEIGHT);
	});
});

describe('sampleRotation', () => {
	it('flips one coin per hit at the crit rate', () => {
		const seq = [0.1, 0.6, 0.69, 0.71];
		let i = 0;
		const rng = () => seq[i++];
		expect(sampleRotation(0.7, 4, rng)).toEqual([true, true, true, false]);
	});

	it('degenerate rates are all-or-nothing', () => {
		expect(sampleRotation(1, 5, () => 0.999).every(Boolean)).toBe(true);
		expect(sampleRotation(0, 5, () => 0).some(Boolean)).toBe(false);
	});

	it('clamps hit count to a non-negative integer', () => {
		expect(sampleRotation(0.5, -3)).toEqual([]);
		expect(sampleRotation(0.5, 2.6, () => 0)).toHaveLength(3);
	});
});

describe('display formats', () => {
	it('writes a multiplier with a leading × and two decimals', () => {
		expect(formatMultiplier(1.98)).toBe('×1.98');
		expect(formatMultiplier(4)).toBe('×4.00');
	});

	it('never rounds a possible risk to 0% or a certain one to 100%', () => {
		expect(formatChance(Math.pow(0.3, 8))).toBe('<0.1%');
		expect(formatChance(0)).toBe('0.0%');
		expect(formatChance(0.1234)).toBe('12.3%');
		expect(formatChance(0.9999)).toBe('>99.9%');
		expect(formatChance(1)).toBe('100.0%');
	});
});

describe('critCountDistribution', () => {
	it('is the binomial distribution — 70% over 8 hits', () => {
		const d = critCountDistribution(0.7, 8);
		expect(d).toHaveLength(9);
		expect(d[0]).toBeCloseTo(Math.pow(0.3, 8), 12);
		expect(d[6]).toBeCloseTo(28 * Math.pow(0.7, 6) * Math.pow(0.3, 2), 12);
		expect(d[8]).toBeCloseTo(Math.pow(0.7, 8), 12);
	});

	it('sums to 1 and its first bar is the no-crit risk, up to 40 hits', () => {
		for (const cr of [0.05, 0.37, 0.7, 0.95]) {
			for (const hits of [1, 8, 40]) {
				const d = critCountDistribution(cr, hits);
				expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
				expect(d[0]).toBeCloseTo(zeroCritProbability(cr, hits), 12);
			}
		}
	});

	it('puts everything on one bar at 0% and 100%', () => {
		expect(critCountDistribution(0, 4)).toEqual([1, 0, 0, 0, 0]);
		expect(critCountDistribution(1, 4)).toEqual([0, 0, 0, 0, 1]);
	});

	it("averages, over its bars, to the build's average multiplier", () => {
		const d = critCountDistribution(0.7, 8);
		const mean = d.reduce((sum, p, k) => sum + p * rotationMultiplier(k, 8, 1.4), 0);
		expect(mean).toBeCloseTo(averageDamageMultiplier(0.7, 1.4), 12);
	});
});
