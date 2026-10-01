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
	lunarTotal,
	marginalGain,
	scalingFactor,
	scalingTotal,
	transformativeTotal
} from './anatomy';
import {
	additiveDamage,
	levelMult,
	specialReactionDamage,
	transformativeDamage
} from './reactionCurves';
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
		const statPct = { key: 'statPct', label: '', step: 5, isPct: true } as const;
		expect(marginalGain('transformative', I, 3, statPct)).toBe(0);
	});
});

describe('familyTotal dispatch', () => {
	it('routes to the right formula per family', () => {
		expect(familyTotal('direct', I, 2)).toBeCloseTo(directTotal(I, 2), 10);
		expect(familyTotal('additive', I, 1.15)).toBeCloseTo(additiveEffective(I, 1.15), 10);
		expect(familyTotal('transformative', I, 3)).toBeCloseTo(transformativeTotal(I, 3), 10);
		expect(familyTotal('lunar', I, 3)).toBeCloseTo(lunarTotal(I, 3), 10);
	});
});

describe('Reaction Bonus', () => {
	it('adds inside the EM bracket of amp, additive and transformative alike', () => {
		const rb = { ...I, rbPct: 40 };
		expect(directTotal(rb, 2) / directTotal(I, 2)).toBeCloseTo(
			(1 + (2.78 * 200) / 1600 + 0.4) / (1 + (2.78 * 200) / 1600),
			8
		);
		expect(additiveChunk(rb, 1.25)).toBeCloseTo(additiveDamage(1.25, 90, 200, 0.4), 8);
		expect(transformativeTotal(rb, 2.75)).toBeCloseTo(
			transformativeDamage(2.75, 90, 200, 0.4) * resMultiplier(0.1),
			8
		);
	});

	it('changes nothing on a direct hit with no reaction', () => {
		expect(directTotal({ ...I, rbPct: 80 }, 1)).toBeCloseTo(directTotal(I, 1), 10);
	});
});

describe('Lunar / Stellar family', () => {
	it('is the top 60% share × Base DMG Bonus × Elevation × crit × RES, and no DEF', () => {
		const sheet = { ...I, baseDmgPct: 14, elevationPct: 20 };
		const expected =
			0.6 * specialReactionDamage(3, 90, 200) * 1.14 * 1.2 * (1 + 0.7 * 1.4) * resMultiplier(0.1);
		expect(lunarTotal(sheet, 3)).toBeCloseTo(expected, 6);
		// enemy level only reaches DEF, which these reactions ignore
		expect(lunarTotal({ ...sheet, enemyLevel: 10 }, 3)).toBeCloseTo(lunarTotal(sheet, 3), 10);
	});

	it('reaches level 100 on the gcsim table', () => {
		expect(lunarTotal({ ...I, charLevel: 100 }, 3) / lunarTotal(I, 3)).toBeCloseTo(
			levelMult(100) / levelMult(90),
			10
		);
	});

	it('rolls EM, CRIT Rate and CRIT DMG — never ATK, which the formula has no place for', () => {
		expect(labStats('lunar', 3).map((s) => s.key)).toEqual(['em', 'cr', 'cd']);
	});
});

describe('the scaling stat picks its own rolls', () => {
	it('an HP scaler rolls HP% and flat HP, a DEF scaler DEF% and flat DEF', () => {
		const hp = labStats('direct', 1, 'hp');
		expect(hp.map((s) => s.label)).toEqual(['HP%', 'Flat HP', 'CRIT Rate', 'CRIT DMG']);
		expect(hp[1].step).toBeCloseTo(averageRoll('hp'), 8);
		expect(labStats('direct', 1, 'def')[0].step).toBeCloseTo(averageRoll('defPct'), 8);
	});

	it('DMG Bonus is never a roll — no artifact substat carries it', () => {
		for (const f of ['direct', 'additive', 'transformative', 'lunar'] as const)
			expect(labStats(f, 2).some((s) => s.key === 'dmgPct')).toBe(false);
	});
});
