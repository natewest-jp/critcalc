import { describe, it, expect } from 'vitest';
import {
	CR_MIN,
	CR_MAX,
	CD_MIN,
	CD_MAX,
	averageDamageMultiplier,
	zeroCritProbability,
	critValue,
	cvLineCR,
	nearestIsoline,
	ISOLINE_VALUES,
	zeroCritRiskColor,
	riskRampGradient,
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

describe('nearestIsoline', () => {
	it('picks the closest contour value', () => {
		expect(nearestIsoline(1.98)).toEqual({ value: 2.0, delta: expect.closeTo(0.02) });
		expect(nearestIsoline(1.0).value).toBe(ISOLINE_VALUES[0]);
		expect(nearestIsoline(10).value).toBe(ISOLINE_VALUES[ISOLINE_VALUES.length - 1]);
	});
});

describe('zeroCritRiskColor', () => {
	it('maps probability bands to the fixed ramp', () => {
		expect(zeroCritRiskColor(0.01)).toBe('#4ecca3');
		expect(zeroCritRiskColor(0.1)).toBe('#f6d365');
		expect(zeroCritRiskColor(0.3)).toBe('#f4a261');
		expect(zeroCritRiskColor(0.9)).toBe('#e63946');
	});

	it('gradient runs high risk → low risk', () => {
		expect(riskRampGradient).toBe('linear-gradient(to right, #e63946, #f4a261, #f6d365, #4ecca3)');
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
