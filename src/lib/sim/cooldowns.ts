/**
 * src/lib/sim/cooldowns.ts
 *
 * Cooldown resets and skill/burst chain stages (gauge-round L3c, lifted out of
 * `notationParser.ts`).
 *
 * ⚓ Both are feedback edges. A cdReset refunds a charge, which the charge-queue
 * wait scan then reads when deciding WHEN the next E lands (F4); a chain stage
 * decides WHICH ability a token resolves to (F1). Neither can be computed ahead
 * of the parse — see gauge-round.md §2.
 *
 * ⚠️ The character cdReset walk is deliberately scoped to the CASTER's own
 * ability queues at its call site. A rotation-wide reset would erase teammates'
 * cooldowns.
 */

import type { CastAbility, Condition, ScaledValue } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import type { LoadoutEntry } from '$lib/stores';
import { framesOf } from '$lib/utils/frames';
import { getWeaponById } from '$lib/data/weaponLookup';
import type { SimContext } from './context';
import { findChainStage } from './conditions';

// ---------------------------------------------------------------------------
// Weapon cdReset helper
// ---------------------------------------------------------------------------

/**
 * Returns the effective proc cooldown (FRAMES) for the cdReset effect on the
 * character's equipped weapon, or null if none. Resolves ScaledValue using the
 * stored weaponRefinement (defaults to R1 when absent).
 */
function resolveScaledValue(v: number | ScaledValue, refinementIndex: number): number {
	if (typeof v === 'number') return v;
	return v.refinementValues[refinementIndex];
}

export function getWeaponCdResetCooldown(
	charId: string,
	loadoutMap: Record<string, LoadoutEntry> | undefined
): number | null {
	const entry = loadoutMap?.[charId];
	if (!entry?.weaponId) return null;
	const weapon = getWeaponById(entry.weaponId);
	if (!weapon) return null;
	const effect = weapon.passive.effects.find(
		(e) => e.type === 'cdReset' && e.trigger.type === 'onCast' && e.trigger.ability === 'skill'
	);
	if (!effect?.procCooldown) return null;
	const refinementIndex = (entry.weaponRefinement ?? 1) - 1;
	return framesOf(resolveScaledValue(effect.procCooldown, refinementIndex));
}

// ---------------------------------------------------------------------------
// Character cdReset helper
// ---------------------------------------------------------------------------

/**
 * Returns the abilities (skill/burst) whose cooldowns should be reset when the
 * given character casts the named ability. Walks the character's burst,
 * passives, and constellations for `cdReset` effects with `source: "character"`
 * whose `trigger.ability` matches the cast that just fired. Constellation-gated
 * effects are filtered against the character's constellation level.
 *
 * Use case (v1): Kazuha C1 — burst reset of skill CD on Q-cast.
 */
export function getCharacterCdResetTargets(
	char: CharacterData,
	firingAbility: 'skill' | 'burst',
	constellationLevel: number
): Array<'skill' | 'burst'> {
	const targets: Array<'skill' | 'burst'> = [];
	const sources: Array<{
		effects?: {
			type: string;
			source?: string;
			trigger: { type: string; ability?: string };
			resets?: string;
			conditions?: Condition;
		}[];
	}> = [...(char.passives ?? []), ...(char.constellations ?? [])];
	for (const node of sources) {
		const effects = node.effects ?? [];
		for (const eff of effects) {
			if (eff.type !== 'cdReset') continue;
			if (eff.source !== 'character') continue;
			if (eff.trigger.type !== 'onCast') continue;
			if (eff.trigger.ability !== firingAbility) continue;
			// Constellation gating: skip when the effect is gated above the player's level.
			const cond = eff.conditions;
			if (
				cond &&
				cond.type === 'constellation' &&
				cond.level !== undefined &&
				constellationLevel < cond.level
			) {
				continue;
			}
			const resetTarget = (eff.resets ?? eff.trigger.ability) as 'skill' | 'burst';
			targets.push(resetTarget);
		}
	}
	return targets;
}

// Per-character chain-stage lookup (skill/burst chains, e.g. Diluc E1→E2→E3),
// backed by cs.chains. Each entry holds the *next* expected stage index plus
// the absolute time after which the chain resets to 0. After firing a
// non-terminal chainStage ability, advanceChain advances index and sets
// expiresAt = now + window; firing the terminal stage deletes the entry.
// (Stance windows, named states, and extension bookkeeping now live on
// cs.stance / cs.states — see CharState.)
export function getChainIndexMap(
	ctx: SimContext,
	charId: string,
	cursor: number
): Map<'skill' | 'burst', number> {
	const result = new Map<'skill' | 'burst', number>();
	for (const [kind, pos] of ctx.getCharState(charId).chains) {
		if (pos.expiresAt > cursor) result.set(kind, pos.index);
	}
	return result;
}
export function advanceChain(
	ctx: SimContext,
	ability: CastAbility,
	charId: string,
	kind: 'skill' | 'burst',
	cursor: number
): void {
	const stage = findChainStage(ability.conditions);
	if (!stage) return;
	const charChain = ctx.getCharState(charId).chains;
	if (stage.window === undefined) {
		// Terminal stage: reset chain to index 0.
		charChain.delete(kind);
	} else {
		charChain.set(kind, { index: stage.index + 1, expiresAt: cursor + framesOf(stage.window) });
	}
}
