import { describe, expect, it } from 'vitest';
import { shredSources } from '$lib/data/shredSources.generated';
import { defMultiplier, groupSources, resMultiplier, sumPicks } from './defres';

describe('defMultiplier', () => {
	it('equal levels with no modifiers is exactly one half', () => {
		expect(defMultiplier(90, 90)).toBeCloseTo(0.5, 12);
		expect(defMultiplier(1, 1)).toBeCloseTo(0.5, 12);
	});

	it('level 90 vs a level 100 enemy', () => {
		expect(defMultiplier(90, 100)).toBeCloseTo(190 / 390, 12);
	});

	it('shred and ignore multiply on the enemy side', () => {
		// 90 vs 90: 60% reduction alone → 190 / (190 + 190×0.4)
		expect(defMultiplier(90, 90, 0.6)).toBeCloseTo(190 / (190 + 190 * 0.4), 12);
		// plus 50% ignore → enemy side halves again
		expect(defMultiplier(90, 90, 0.6, 0.5)).toBeCloseTo(190 / (190 + 190 * 0.4 * 0.5), 12);
	});

	it('clamps modifier inputs to [0, 1]', () => {
		expect(defMultiplier(90, 90, 2)).toBe(1); // enemy side zeroed
		expect(defMultiplier(90, 90, -1)).toBeCloseTo(0.5, 12);
	});
});

describe('resMultiplier', () => {
	it('standard 10% enemy takes 90%', () => {
		expect(resMultiplier(0.1)).toBeCloseTo(0.9, 12);
	});

	it('below zero, each point counts half — the VV over-delivery', () => {
		// 10% base − 40% VV = −30% → ×1.15 (not ×1.30)
		expect(resMultiplier(-0.3)).toBeCloseTo(1.15, 12);
		expect(resMultiplier(-1)).toBeCloseTo(1.5, 12);
	});

	it('is continuous at the 75% regime boundary', () => {
		expect(resMultiplier(0.75)).toBeCloseTo(0.25, 12);
		expect(resMultiplier(0.7499999)).toBeCloseTo(0.25, 5);
		expect(resMultiplier(0.7500001)).toBeCloseTo(0.25, 5);
	});

	it('diminishing regime above 75%', () => {
		expect(resMultiplier(1)).toBeCloseTo(0.2, 12);
		expect(resMultiplier(2)).toBeCloseTo(1 / 9, 12);
	});

	it('zero resistance is a clean ×1', () => {
		expect(resMultiplier(0)).toBe(1);
	});

	it('an immune enemy takes nothing', () => {
		expect(resMultiplier(Infinity)).toBe(0);
	});

	// The same 40-point shred from five starting points (⚓ the 2026-10-06
	// pass's argument for the 30/60/90/200 rungs): worth most where it drags
	// RES back across 75%, least deep in the diminishing tail.
	it.each([
		[0.1, 1.15 / 0.9],
		[0.3, 1.05 / 0.7],
		[0.6, 0.8 / 0.4],
		[0.9, 0.5 / (1 / 4.6)],
		[2, 1 / 7.4 / (1 / 9)]
	])('40 points of shred from %f RES gains ×%f', (base, gain) => {
		expect(resMultiplier(base - 0.4) / resMultiplier(base)).toBeCloseTo(gain, 10);
	});
});

describe('defMultiplier — no reduction cap', () => {
	it('a 95% reduction reaches the formula whole (gcsim caps only DEF increases)', () => {
		expect(defMultiplier(90, 90, 0.95)).toBeCloseTo(190 / (190 + 190 * 0.05), 12);
	});
});

describe('sources', () => {
	const groups = groupSources(shredSources);
	const of = (owner: string) => groups.filter((g) => g.owner === owner);

	it('one debuff reached two ways is one chip (a shared mod)', () => {
		expect(of('zhongli')).toHaveLength(1);
		expect(of('faruzan')).toHaveLength(1);
		expect(of('zhongli')[0].elements).toContain('physical');
	});

	it('strengths gated apart are OPTIONS on one chip, never a sum', () => {
		const [esc] = of('escoffier');
		expect(of('escoffier')).toHaveLength(1);
		expect(esc.options.map((o) => o.amount)).toEqual([5, 10, 15, 55]);
		const durinRes = of('durin').filter((g) => g.stat === 'res');
		expect(durinRes).toHaveLength(1);
		expect(durinRes[0].options.map((o) => o.amount)).toEqual([20, 35]);
	});

	it('debuffs the kit stacks stay separate chips that sum', () => {
		expect(of('citlali')).toHaveLength(2);
		expect(of('linnea')).toHaveLength(2);
	});

	it('Raiden C2 and Yae C6 are DEF ignores; Yae only on Skill DMG', () => {
		const [raiden] = of('raiden_shogun');
		expect(raiden).toMatchObject({ stat: 'ignore', target: 'self' });
		expect(raiden.options).toEqual([{ amount: 60, ability: 'Steelbreaker', minCon: 2 }]);
		expect(of('yae_miko')[0]).toMatchObject({ stat: 'ignore', scope: 'skill' });
	});

	it('sums only the picks that act on the hit’s element', () => {
		const key = (owner: string) => of(owner)[0].key;
		const picks = new Map([
			[key('viridescent_venerer'), 40],
			[key('zhongli'), 20],
			[key('lisa'), 15],
			[key('nahida'), 30]
		]);
		expect(sumPicks(groups, picks, 'pyro')).toEqual({ res: 60, def: 45, ignore: 0 });
		// VV shreds only the swirled element; Zhongli's shield reaches Physical
		expect(sumPicks(groups, picks, 'physical')).toEqual({ res: 20, def: 45, ignore: 0 });
	});
});
