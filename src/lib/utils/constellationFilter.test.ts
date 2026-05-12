/**
 * src/lib/utils/constellationFilter.test.ts
 *
 * Verifies constellation-level filtering helpers used by RotationCharacterPanel.
 * Synthetic effect/variant fixtures keep the tests independent of curated data.
 */

import { describe, it, expect } from 'vitest';
import type { Condition, Effect, AbilityVariant } from '$lib/types/ability';
import {
	conditionsAllowConstellation,
	isEffectUnlocked,
	isVariantUnlocked
} from './constellationFilter';

function buffEffect(conditions?: Condition): Effect {
	return {
		type: 'buff',
		trigger: { type: 'onCast' },
		target: 'self',
		conditions,
		source: 'character',
		stat: 'atk%',
		value: 20,
		snapshottable: true
	};
}

function variant(conditions?: AbilityVariant['conditions']): AbilityVariant {
	return {
		label: 'Hold',
		conditions
	};
}

describe('conditionsAllowConstellation', () => {
	it('returns true when conditions are absent', () => {
		expect(conditionsAllowConstellation(undefined, 0)).toBe(true);
		expect(conditionsAllowConstellation(undefined, 6)).toBe(true);
	});

	it('blocks constellation: N when conLevel < N', () => {
		const cond: Condition = { type: 'constellation', level: 4 };
		expect(conditionsAllowConstellation(cond, 0)).toBe(false);
		expect(conditionsAllowConstellation(cond, 3)).toBe(false);
		expect(conditionsAllowConstellation(cond, 4)).toBe(true);
		expect(conditionsAllowConstellation(cond, 6)).toBe(true);
	});

	it('permits runtime-resolvable conditions even when unresolvable', () => {
		// state condition with no resolved state set → evalCondition returns null;
		// helper treats null as "show".
		expect(
			conditionsAllowConstellation({ type: 'state', state: 'inStance' }, 0)
		).toBe(true);
		// enemyHpBelow is always null at this scope.
		expect(
			conditionsAllowConstellation({ type: 'enemyHpBelow', threshold: 50 }, 0)
		).toBe(true);
	});

	it('handles `all` with mixed constellation + runtime: blocks on the constellation half', () => {
		const cond: Condition = {
			type: 'all',
			conditions: [
				{ type: 'constellation', level: 6 },
				{ type: 'enemyHpAbove', threshold: 50 }
			]
		};
		expect(conditionsAllowConstellation(cond, 5)).toBe(false);
		expect(conditionsAllowConstellation(cond, 6)).toBe(true);
	});

	it('handles `any` with mixed constellation + runtime: opens at the unlocked branch', () => {
		const cond: Condition = {
			type: 'any',
			conditions: [
				{ type: 'constellation', level: 6 },
				{ type: 'state', state: 'inStance' }
			]
		};
		// state is unresolvable (null), constellation 6 is false at c5 → any() = null → allow
		expect(conditionsAllowConstellation(cond, 5)).toBe(true);
		// constellation 6 satisfied → any() = true → allow
		expect(conditionsAllowConstellation(cond, 6)).toBe(true);
	});

	it('handles `not constellation`: inverts the gate', () => {
		const cond: Condition = {
			type: 'not',
			condition: { type: 'constellation', level: 4 }
		};
		expect(conditionsAllowConstellation(cond, 0)).toBe(true);
		expect(conditionsAllowConstellation(cond, 4)).toBe(false);
	});
});

describe('isEffectUnlocked', () => {
	it('shows effects with no conditions at any constellation level', () => {
		const fx = buffEffect();
		expect(isEffectUnlocked(fx, 0)).toBe(true);
		expect(isEffectUnlocked(fx, 6)).toBe(true);
	});

	it('hides an effect gated to a higher constellation', () => {
		const fx = buffEffect({ type: 'constellation', level: 6 });
		expect(isEffectUnlocked(fx, 5)).toBe(false);
		expect(isEffectUnlocked(fx, 6)).toBe(true);
	});

	it('keeps an effect gated on runtime state visible', () => {
		const fx = buffEffect({ type: 'state', state: 'inStance' });
		expect(isEffectUnlocked(fx, 0)).toBe(true);
	});
});

describe('isVariantUnlocked', () => {
	it('shows variants with no conditions', () => {
		expect(isVariantUnlocked(variant(), 0)).toBe(true);
	});

	it('hides a variant gated on a higher constellation', () => {
		const v = variant({ type: 'constellation', level: 2 });
		expect(isVariantUnlocked(v, 1)).toBe(false);
		expect(isVariantUnlocked(v, 2)).toBe(true);
	});
});
