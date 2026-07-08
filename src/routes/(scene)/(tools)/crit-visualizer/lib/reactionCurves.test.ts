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
	MAX_LEVEL
} from './reactionCurves';

describe('level multiplier table', () => {
	it('carries 90 character levels with the wiki anchor values', () => {
		expect(CHAR_LEVEL_MULT).toHaveLength(90);
		expect(CRYSTALLIZE_LEVEL_MULT).toHaveLength(90);
		expect(levelMult(1)).toBeCloseTo(17.165605, 6);
		// the TCL quotes 1446.85 at Lv.90
		expect(levelMult(90)).toBeCloseTo(1446.853458, 6);
		expect(crystallizeLevelMult(90)).toBeCloseTo(1851.060358, 6);
	});

	it('clamps out-of-range levels', () => {
		expect(levelMult(0)).toBe(levelMult(1));
		expect(levelMult(120)).toBe(levelMult(MAX_LEVEL));
	});

	it('is strictly increasing', () => {
		for (let i = 1; i < 90; i++) {
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
