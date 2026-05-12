/**
 * src/lib/utils/constellationFilter.ts
 *
 * Helpers for filtering effects and ability variants by the active character's
 * constellation level. Used by the rotation planner's ability reference panel
 * (and any future consumer that needs "show only what's currently unlocked").
 *
 * Design call (settled 2026-05-12): Option A — hide everything gated above the
 * current constellation level. The Team Builder tool will use a different
 * convention (show-all-with-locked-badge); that's handled there, not here.
 *
 * Non-constellation conditions (state, enemy HP, etc.) resolve at runtime, not
 * at panel display time — `evalCondition` returns `null` for them, and we
 * treat that as "show" so the chip/variant remains visible. Only `false`
 * (definitive block) hides.
 */

import type { Condition, Effect, AbilityVariant } from '$lib/types/ability';
import { evalCondition } from './notationParser';

// Mirrors `notationParser.ts` — kept in sync.
const DEFAULT_ASCENSION = 4;

/**
 * Returns true unless `conditions` evaluates definitively false at the given
 * constellation level. Unresolvable conditions (runtime state, enemy HP, etc.)
 * pass through as "allowed" so the consumer still displays them.
 */
export function conditionsAllowConstellation(
	conditions: Condition | undefined,
	conLevel: number
): boolean {
	const result = evalCondition(conditions, DEFAULT_ASCENSION, new Set(), conLevel);
	return result !== false;
}

/** True when the effect's `conditions` don't block at the given constellation level. */
export function isEffectUnlocked(effect: Effect, conLevel: number): boolean {
	return conditionsAllowConstellation(effect.conditions, conLevel);
}

/** True when the variant's `conditions` don't block at the given constellation level. */
export function isVariantUnlocked(variant: AbilityVariant, conLevel: number): boolean {
	return conditionsAllowConstellation(variant.conditions, conLevel);
}
