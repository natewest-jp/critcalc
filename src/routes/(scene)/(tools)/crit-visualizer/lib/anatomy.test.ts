import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SHEET,
	additiveChunk,
	additiveEffective,
	averageRoll,
	critFactor,
	directTotal,
	familyTotal,
	labStats,
	marginalGain,
	scalingFactor,
	scalingTotal,
	transformativeTotal
} from './anatomy';
import { additiveDamage, transformativeDamage } from './reactionCurves';
import { defMultiplier, resMultiplier } from './defres';

const I = DEFAULT_SHEET;

describe('direct-hit factors', () => {
	it('scaling factor composes % and flat over the base', () => {
		// 1 + 0.55 + 1200/800 = 3.05; total = 800×1.55 + 1200 = 2440
		expect(scalingFactor(I)).toBeCloseTo(3.05, 10);
		expect(scalingTotal(I)).toBeCloseTo(2440, 10);
	});

	it('crit factor is the KQM average and clamps CR', () => {
		expect(critFactor(I)).toBeCloseTo(1 + 0.7 * 1.4, 10);
		expect(critFactor({ ...I, cr: 150 })).toBeCloseTo(1 + 1.4, 10);
	});

	it('total is the product of all six buckets', () => {
		const expected =
			3.05 *
			1.616 *
			(1 + 0.7 * 1.4) *
			2 *
			(1 + (2.78 * 200) / 1600) *
			defMultiplier(90, 100) *
			resMultiplier(0.1);
		expect(directTotal(I, 2)).toBeCloseTo(expected, 8);
	});

	it('no reaction means the amp bucket is exactly 1', () => {
		expect(directTotal(I, 1) * 2 * (1 + (2.78 * 200) / 1600)).toBeCloseTo(directTotal(I, 2), 8);
	});
});

describe('additive family', () => {
	it('chunk matches the reactionCurves formula exactly', () => {
		expect(additiveChunk(I, 1.15)).toBeCloseTo(additiveDamage(1.15, 90, 200), 10);
	});

	it('effective chunk rides DMG%, crit, DEF and RES', () => {
		const ride = 1.616 * (1 + 0.7 * 1.4) * defMultiplier(90, 100) * resMultiplier(0.1);
		expect(additiveEffective(I, 1.25)).toBeCloseTo(additiveChunk(I, 1.25) * ride, 8);
	});
});

describe('transformative family', () => {
	it('is the reactionCurves damage after RES only', () => {
		expect(transformativeTotal(I, 3)).toBeCloseTo(
			transformativeDamage(3, 90, 200) * resMultiplier(0.1),
			8
		);
	});
});

describe('stat lab', () => {
	it('roll steps come from the real substat tier averages', () => {
		expect(averageRoll('cr')).toBeCloseTo(3.305, 3);
		expect(averageRoll('cd')).toBeCloseTo(6.605, 2);
		expect(averageRoll('em')).toBeCloseTo(19.815, 2);
	});

	it('EM only feeds direct hits when a reaction is on', () => {
		expect(labStats('direct', 1).some((s) => s.key === 'em')).toBe(false);
		expect(labStats('direct', 2).some((s) => s.key === 'em')).toBe(true);
	});

	it('transformative exposes only EM', () => {
		expect(labStats('transformative', 3).map((s) => s.key)).toEqual(['em']);
	});

	it('marginal gains shrink as a bucket is fed (dilution)', () => {
		const cd = labStats('direct', 1).find((s) => s.key === 'cd')!;
		const lean = marginalGain('direct', { ...I, cd: 60 }, 1, cd);
		const fat = marginalGain('direct', { ...I, cd: 260 }, 1, cd);
		expect(lean).toBeGreaterThan(fat);
		expect(fat).toBeGreaterThan(0);
	});

	it('stats outside a family contribute nothing', () => {
		const statPct = { key: 'statPct', label: '', stepLabel: '', step: 5 } as const;
		expect(marginalGain('transformative', I, 3, statPct)).toBe(0);
	});
});

describe('familyTotal dispatch', () => {
	it('routes to the right formula per family', () => {
		expect(familyTotal('direct', I, 2)).toBeCloseTo(directTotal(I, 2), 10);
		expect(familyTotal('additive', I, 1.15)).toBeCloseTo(additiveEffective(I, 1.15), 10);
		expect(familyTotal('transformative', I, 3)).toBeCloseTo(transformativeTotal(I, 3), 10);
	});
});
