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
import {
	DEFAULT_ASCENSION,
	evalCondition,
	findChainStage,
	type ConditionContext
} from './conditions';
import { effectSourcesAtConstellation } from '$lib/utils/effectCollection';

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

/** One reset a cast fires: the KIND of queue, and — since 2026-09-18 — an
 *  optional single ability whose queue it reaches instead of every queue of
 *  that kind (`cdReset.resetsAbility`). */
export type CdResetTarget = { kind: 'skill' | 'burst'; abilityId?: string };

/**
 * Returns the resets the given character's cast of `firingAbility` fires.
 * Walks the character's effect surface for `cdReset` effects with
 * `source: "character"` whose `trigger.ability` matches, and evaluates each
 * one's `conditions` at the cast (a definitive `false` drops it; `null` — a
 * condition the parse cannot answer — keeps it, the Conditions' optimistic
 * rule). Constellation ENTRIES above the character's level are dropped before
 * their effects are read.
 *
 * Use cases: Kazuha C1 — burst reset of skill CD on Q-cast. Varka C1 — the
 * stance-entering skill hands back one Four Winds' Ascension use
 * (`resetsAbility`, under `not inStance` so the in-stance Four Winds cast,
 * which is also a skill, does not refund itself).
 */
export function getCharacterCdResetTargets(
	char: CharacterData,
	firingAbility: 'skill' | 'burst',
	constellationLevel: number,
	states: ReadonlySet<string>,
	chainIndex: ReadonlyMap<'skill' | 'burst', number>,
	stacks: ReadonlyMap<string, number> | undefined,
	context: ConditionContext | undefined
): CdResetTarget[] {
	const targets: CdResetTarget[] = [];
	// ⚓ The ENTRY's level is the gate (2026-08-18) — `effectSourcesAtConstellation`
	// drops a locked constellation before its effects are ever seen. The
	// effect-level `conditions` are evaluated in full below: on a constellation
	// entry the `constellation` condition is pure duplication of the field (0 of
	// 133 name a different level), and a `state` or team gate is what a
	// skill-fired reset needs to tell the stance opener from its in-stance
	// sibling. See docs/rounds/constellation-gating-plan.md.
	// ⚓ THE ONE WALK (small-fix bundle, 2026-09-17). This used to be
	// `[...passives, ...unlockedConstellations]` — a bespoke surface walk the
	// constellation-gating ruling forbids, and one that SKIPPED `char.abilities`,
	// so a cdReset hosted on the burst itself never fired: Freminet's
	// Shadowhunter's Ambush authored `resets: skill` since the effect existed and
	// reset nothing, and Arlecchino's Balemoon Rising ("clearing the CD of All
	// Is Ash") could not be authored at all.
	const sources: Array<{
		effects?: {
			type: string;
			source?: string;
			trigger: { type: string; ability?: string };
			resets?: string;
			resetsAbility?: string;
			conditions?: Condition;
		}[];
	}> = effectSourcesAtConstellation(char, constellationLevel);
	for (const node of sources) {
		const effects = node.effects ?? [];
		for (const eff of effects) {
			if (eff.type !== 'cdReset') continue;
			if (eff.source !== 'character') continue;
			if (eff.trigger.type !== 'onCast') continue;
			if (eff.trigger.ability !== firingAbility) continue;
			if (
				eff.conditions !== undefined &&
				evalCondition(
					eff.conditions,
					DEFAULT_ASCENSION,
					states,
					constellationLevel,
					chainIndex,
					stacks,
					context
				) === false
			) {
				continue;
			}
			const kind = (eff.resets ?? eff.trigger.ability) as 'skill' | 'burst';
			targets.push(
				eff.resetsAbility !== undefined ? { kind, abilityId: eff.resetsAbility } : { kind }
			);
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
