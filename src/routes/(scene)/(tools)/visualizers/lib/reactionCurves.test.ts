import { describe, it, expect } from 'vitest';
import {
	CHAR_LEVEL_MULT,
	CRYSTALLIZE_LEVEL_MULT,
	levelMult,
	crystallizeLevelMult,
	ampEmBonus,
	ampMultiplier,
	transformativeDamage,
	additiveDamage,
	crystallizeShieldHp,
	specialReactionDamage,
	emBonus,
	emForBonus,
	emWorthOfBonus,
	snapLevel,
	isReachableLevel,
	AMP_CURVE,
	TRANSFORMATIVE_CURVE,
	SPECIAL_CURVE,
	TOP_CONTRIBUTOR_SHARE,
	MAX_LEVEL
} from './reactionCurves';

describe('level multiplier table', () => {
	it('carries 100 character levels with the wiki and gcsim anchor values', () => {
		expect(CHAR_LEVEL_MULT).toHaveLength(100);
		expect(CRYSTALLIZE_LEVEL_MULT).toHaveLength(100);
		expect(levelMult(1)).toBeCloseTo(17.165605, 6);
		// the TCL quotes 1446.85 at Lv.90
		expect(levelMult(90)).toBeCloseTo(1446.853458, 6);
		expect(crystallizeLevelMult(90)).toBeCloseTo(1851.060358, 6);
		// gcsim reaction.dm.go / crystallize shield.go; 95 and 100 also match
		// docs/library/game/lunar-reactions.md's level table
		expect(levelMult(95)).toBeCloseTo(1561.468, 3);
		expect(levelMult(100)).toBeCloseTo(1674.8092, 4);
		expect(crystallizeLevelMult(95)).toBeCloseTo(2041.569, 3);
		expect(crystallizeLevelMult(100)).toBeCloseTo(2198.814, 3);
	});

	it('clamps out-of-range levels', () => {
		expect(levelMult(0)).toBe(levelMult(1));
		expect(levelMult(120)).toBe(levelMult(MAX_LEVEL));
	});

	it('is strictly increasing', () => {
		for (let i = 1; i < 100; i++) {
			expect(CHAR_LEVEL_MULT[i]).toBeGreaterThan(CHAR_LEVEL_MULT[i - 1]);
			expect(CRYSTALLIZE_LEVEL_MULT[i]).toBeGreaterThan(CRYSTALLIZE_LEVEL_MULT[i - 1]);
		}
	});
});

describe('EM formulas', () => {
	it('amplifying: 2×(1 + 2.78·EM/(1400+EM))', () => {
		expect(ampMultiplier(2, 0)).toBe(2);
		expect(ampMultiplier(2, 1000)).toBeCloseTo(2 * (1 + 2.78 / 2.4), 6); // 4.3167
		expect(ampMultiplier(1.5, 200)).toBeCloseTo(1.5 * 1.3475, 4);
		expect(ampEmBonus(1400)).toBeCloseTo(1.39, 6); // half the 2.78 asymptote at EM = 1400
	});

	it('transformative: mult × levelMult × (1 + 16·EM/(2000+EM))', () => {
		// Lv.90 overload at 0 EM
		expect(transformativeDamage(2.75, 90, 0)).toBeCloseTo(2.75 * 1446.853458, 3);
		// EM 2000 doubles the denominator: bonus = 8
		expect(transformativeDamage(1, 90, 2000)).toBeCloseTo(1446.853458 * 9, 3);
	});

	it('additive: mult × levelMult × (1 + 5·EM/(1200+EM))', () => {
		expect(additiveDamage(1.25, 90, 1200)).toBeCloseTo(1.25 * 1446.853458 * 3.5, 3);
		expect(additiveDamage(1.15, 1, 0)).toBeCloseTo(1.15 * 17.165605, 5);
	});

	it('crystallize: shieldLevelMult × (1 + 4.44·EM/(1400+EM))', () => {
		expect(crystallizeShieldHp(90, 0)).toBeCloseTo(1851.060358, 5);
		expect(crystallizeShieldHp(90, 1400)).toBeCloseTo(1851.060358 * 3.22, 3);
	});
});

describe('Lunar / Stellar (gcsim CalcSpecialReactionDmg)', () => {
	it('mult × levelMult × (1 + 6·EM/(2000+EM) + RB)', () => {
		expect(specialReactionDamage(3, 90, 0)).toBeCloseTo(3 * 1446.853458, 3);
		// EM 2000 halves the ceiling: bonus = 3
		expect(specialReactionDamage(1.6, 90, 2000)).toBeCloseTo(1.6 * 1446.853458 * 4, 3);
		expect(specialReactionDamage(0.75, 90, 0, 0.4)).toBeCloseTo(0.75 * 1446.853458 * 1.4, 3);
	});

	it('the top contributor takes 60%, so a solo Lunar-Charged tick is ×1.8', () => {
		expect(TOP_CONTRIBUTOR_SHARE * specialReactionDamage(3, 90, 0)).toBeCloseTo(
			1.8 * 1446.853458,
			3
		);
	});
});

describe('Reaction Bonus', () => {
	it('adds inside the EM bracket of every damage family', () => {
		expect(ampMultiplier(2, 0, 0.15)).toBeCloseTo(2.3, 6);
		expect(transformativeDamage(1, 90, 0, 0.4)).toBeCloseTo(1446.853458 * 1.4, 3);
		expect(additiveDamage(1, 90, 0, 0.2)).toBeCloseTo(1446.853458 * 1.2, 3);
	});

	it('emForBonus inverts emBonus, and has no answer at the ceiling', () => {
		for (const curve of [AMP_CURVE, TRANSFORMATIVE_CURVE, SPECIAL_CURVE])
			for (const em of [0, 150, 600, 1200])
				expect(emForBonus(curve, emBonus(curve, em))).toBeCloseTo(em, 6);
		expect(emForBonus(AMP_CURVE, 2.78)).toBe(Infinity);
		expect(emForBonus(AMP_CURVE, 0)).toBe(0);
	});

	it('is worth less EM where the curve is steep: +40% at 600 EM', () => {
		expect(emWorthOfBonus(TRANSFORMATIVE_CURVE, 600, 0.4)).toBeCloseTo(87.34, 1);
		expect(emWorthOfBonus(AMP_CURVE, 600, 0.4)).toBeCloseTo(517.46, 1);
	});
});

describe('reachable levels', () => {
	it('is 1–90, then only 95 and 100', () => {
		expect([90, 91, 94, 95, 96, 99, 100].map(isReachableLevel)).toEqual([
			true,
			false,
			false,
			true,
			false,
			false,
			true
		]);
	});

	it('snapLevel jumps a gap in the direction of travel', () => {
		expect(snapLevel(91, 90)).toBe(95);
		expect(snapLevel(94, 95)).toBe(90);
		expect(snapLevel(96, 95)).toBe(100);
		expect(snapLevel(99, 100)).toBe(95);
		// a fast drag can land deep in a gap; direction still decides
		expect(snapLevel(93, 100)).toBe(90);
		expect(snapLevel(97, 80)).toBe(100);
		expect(snapLevel(60, 90)).toBe(60);
		expect(snapLevel(140, 90)).toBe(MAX_LEVEL);
	});
});
