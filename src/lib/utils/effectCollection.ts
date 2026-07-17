/**
 * src/lib/timeline/effectCollection.ts
 *
 * Effect candidate-pool collection + trigger-context resolution for the
 * timeline pipelines. Walks a character's full effect surface (abilities +
 * passives + constellations) and gathers effects by trigger type; resolves
 * the (ability, variant/hit) context a cast or input block fires under so
 * the fine-grained `trigger.filter` (G primitive) can be evaluated per cast.
 * Pure — extracted from RotationTimeline.svelte for unit testing.
 */

import type { InputBlock } from '$lib/utils/notationParser';
import { getDefaultDamageTag, type DamageTag, type TriggerFilterContext } from '$lib/types/ability';
import type { Effect, EffectTarget, Stat } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';

export function targetsTeamOrActive(target: EffectTarget | EffectTarget[]): boolean {
	const ts = Array.isArray(target) ? target : [target];
	return ts.some((t) => t === 'team' || t === 'teamExcludingSelf' || t === 'active');
}

export function targetsEnemy(target: EffectTarget | EffectTarget[]): boolean {
	const ts = Array.isArray(target) ? target : [target];
	return ts.includes('enemy');
}

// Returns true only when the effect exclusively targets the active character.
// These effects are segmented per on-field window rather than shown in the team buff row.
export function isActiveTargetOnly(target: EffectTarget | EffectTarget[]): boolean {
	return !Array.isArray(target) && target === 'active';
}

/** Maps a single Lunar reaction to the matching `lunar*DmgBonus` stat key
 *  used by display formatting and de-dup. Returns null for reactions
 *  outside the rendered set (Columbina-style multi-reaction "all lunar"
 *  cases and any non-Lunar elevation are not yet rendered). */
function elevateReactionToDisplayStat(
	reaction: import('$lib/types/ability').Reaction
): Stat | null {
	if (reaction === 'lunarCharged') return 'lunarChargedDmgBonus';
	if (reaction === 'lunarBloom') return 'lunarBloomDmgBonus';
	if (reaction === 'lunarCrystallize') return 'lunarCrystallizeDmgBonus';
	return null;
}

/** Converts an `elevate` effect into a synthesized `buff` effect for renderer
 *  ingestion. Single-reaction elevations map to the matching `lunar*DmgBonus`
 *  stat; multi-reaction elevations return null (not yet rendered). All other
 *  effect types pass through unchanged. */
function normalizeBuffLikeEffect(effect: Effect): Effect | null {
	if (effect.type !== 'elevate') return effect;
	if (effect.reactions.length !== 1) return null;
	const stat = elevateReactionToDisplayStat(effect.reactions[0]);
	if (!stat) return null;
	return {
		type: 'buff',
		target: effect.target,
		trigger: effect.trigger,
		conditions: effect.conditions,
		duration: effect.duration,
		durationType: effect.durationType,
		procCooldown: effect.procCooldown,
		attribution: effect.attribution,
		source: effect.source,
		stat,
		value: effect.value,
		snapshottable: effect.snapshottable
	};
}

/** Flat-maps a list of effects through `normalizeBuffLikeEffect`, dropping
 *  unrenderable elevations. Applied at character-effect collection helpers
 *  so downstream filter sites can keep their `effect.type === 'buff'`
 *  shape unchanged. */
function normalizeBuffLikeEffects(effects: Effect[]): Effect[] {
	const out: Effect[] = [];
	for (const e of effects) {
		const n = normalizeBuffLikeEffect(e);
		if (n) out.push(n);
	}
	return out;
}

/**
 * Collects all effects from a character that fire on the given cast type.
 * Walks the character's abilities, passives, and constellations — effects
 * live on their source (the C1 buff lives on the C1 constellation, not on
 * the burst it triggers off).
 *
 * Trigger matching:
 *   - `trigger.type` must be `'onCast'`.
 *   - If `trigger.ability` is set, it must equal `castType`.
 *   - If absent and source is skill/burst, the source's own abilityType
 *     is the implicit binding.
 *   - If absent and source is passive/constellation, the effect fires on
 *     any cast (matches both skill and burst) — e.g. Kazuha C6 infusion
 *     triggers after either E or Q.
 */
export function getCharacterEffectsForCast(
	char: CharacterData,
	castType: 'skill' | 'burst'
): Effect[] {
	const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
	const result: Effect[] = [];
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.trigger.type !== 'onCast') continue;
			const explicit = fx.trigger.ability;
			if (explicit !== undefined) {
				if (explicit !== castType) continue;
			} else if (src.abilityType === 'skill' || src.abilityType === 'burst') {
				if (src.abilityType !== castType) continue;
			}
			// passive / constellation with no explicit ability → fire for both casts
			result.push(fx);
		}
	}
	return normalizeBuffLikeEffects(result);
}

/** Collects `onHit` effects whose abilityType matches the cast class. Accepts
 *  any of the five canonical classes — skill/burst (cast loops) and
 *  normal/charged/plunge (input-block loops, F2B). Mirrors
 *  `getCharacterEffectsForCast`'s passive/constellation fall-through, but
 *  ONLY for skill/burst — for N/CA/P, an effect must declare `abilityType`
 *  explicitly (otherwise a passive's onHit-without-abilityType would
 *  fire on every N hit too, almost always wrong).
 *
 *  The fine-grained `trigger.filter` (G primitive) is NOT applied here —
 *  filter eval is per-cast/per-block against the resolved context. This
 *  helper is purely the candidate-pool collector. */
export function getCharacterEffectsForOnHit(
	char: CharacterData,
	castType: 'skill' | 'burst' | 'normal' | 'charged' | 'plunge'
): Effect[] {
	const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
	const result: Effect[] = [];
	const isInputClass = castType === 'normal' || castType === 'charged' || castType === 'plunge';
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.trigger.type !== 'onHit') continue;
			const explicit = fx.trigger.abilityType;
			if (explicit !== undefined) {
				// Array form matches any listed class (Escoffier C6 NA/CA/PL).
				const classes = Array.isArray(explicit) ? explicit : [explicit];
				if (!classes.includes(castType)) continue;
			} else if (src.abilityType === 'skill' || src.abilityType === 'burst') {
				if (src.abilityType !== castType) continue;
			} else if (isInputClass) {
				// passive/constellation onHit with no abilityType → would over-fire
				// on every N/CA/P hit. Require explicit declaration.
				continue;
			}
			// passive / constellation, castType skill|burst → fire for both casts
			result.push(fx);
		}
	}
	return normalizeBuffLikeEffects(result);
}

/** Maps an input block to its damage-tag class (the `castType` slot used by
 *  `getCharacterEffectsForOnHit` and `resolveBlockContext`). Movement and
 *  unset blocks return null (no hit fires). */
export function getBlockDamageTag(block: InputBlock): 'normal' | 'charged' | 'plunge' | null {
	if (block.kind === 'movement' || block.kind === 'unset') return null;
	if (block.kind === 'skill' || block.kind === 'burst') return null;
	const part = block.parts[0] ?? '';
	if (/^[hl]?P$/.test(part)) return 'plunge';
	if (/^C/.test(part)) return 'charged';
	return 'normal';
}

/** Resolves the (ability, hit-name) pair backing an InputBlock so the G
 *  filter can evaluate against the block's actual damageTag/element/name.
 *  Mirrors `resolveCastContext` but for N/CA/P blocks.
 *
 *  - `damageTag` from `getBlockDamageTag(block)`.
 *  - `element` from `block.kind`: 'elemental-normal' → char element;
 *    'normal' → 'physical'. Approximation — doesn't track per-frame
 *    infusion state (Yoimiya burst infusing N hits, Cyno-stance, etc.);
 *    relies on the parser tagging infused N attacks with
 *    `kind: "elemental-normal"`.
 *  - `abilityName` includes the bow chargeHit-specific name when relevant
 *    (Wreath Arrow at C/C2 for Tighnari, Shadowpiercing Shot for Sethos)
 *    so `filter.abilityName: "Wreath Arrow"` matches via substring.
 *  - `isCrit: true` for optimistic-fire (filter v1 caveat).
 *  - `hitIndex` is left undefined (filter cases that need it — Chongyun C1
 *    N4-only, Kokomi A4 N3-final — require parser-side hitIndex tracking
 *    on the block, deferred). */
export function resolveBlockContext(
	char: CharacterData,
	block: InputBlock
): TriggerFilterContext | null {
	const tag = getBlockDamageTag(block);
	if (!tag) return null;
	const ability = char.abilities.find((a) => a.abilityType === 'normal');
	if (!ability) return null;
	const element: TriggerFilterContext['element'] =
		block.kind === 'elemental-normal'
			? (char.element as TriggerFilterContext['element'])
			: 'physical';
	const part = block.parts[0] ?? '';
	let abilityName = ability.name;
	const chargeHits = (ability as { chargeHits?: { name?: string }[] }).chargeHits;
	if (tag === 'charged' && chargeHits?.length) {
		const idx = part === 'C1' ? 0 : chargeHits.length - 1;
		const hitName = chargeHits[idx]?.name;
		if (hitName) abilityName = `${ability.name} ${hitName}`;
	}
	return {
		damageTag: tag,
		element,
		abilityName,
		isCrit: true
	};
}

/** Resolves the (ability, variant) pair backing a cast so the G filter can
 *  evaluate against the cast's actual damageTag/element/name. Mirrors the
 *  resolution in `findCastSummon` — uses the unconditioned base ability and
 *  looks up the variant by matching label against variant.input.
 *
 *  The `cast` argument is a P4 `CastEvent`, accepted structurally as
 *  `{ label }` — the token text is the only field read here. */
export function resolveCastContext(
	char: CharacterData | null | undefined,
	kind: 'skill' | 'burst',
	cast: { label: string }
): TriggerFilterContext | null {
	if (!char) return null;
	const candidates = char.abilities.filter((a) => a.abilityType === kind);
	const ability = candidates.find((a) => a.conditions === undefined) ?? candidates[0];
	if (!ability) return null;
	const variant = (
		ability as { variants?: { input?: string[]; label?: string; damageTag?: DamageTag }[] }
	).variants?.find((v) => (v.input as string[] | undefined)?.includes(cast.label));
	const damageTag = getDefaultDamageTag(ability, variant as never);
	const variantLabel = variant?.label ? ` ${variant.label}` : '';
	return {
		damageTag,
		element: char.element as TriggerFilterContext['element'],
		abilityName: `${ability.name}${variantLabel}`,
		// Skill/burst single-hit casts have no hit index; default isCrit
		// to true (treat skill/burst snapshot as "crits expected" for
		// optimistic-fire semantics on isCrit:true filters).
		isCrit: true
	};
}

/** Same shape as `getCharacterEffectsForCast` but matching `afterDuration` triggers.
 *  Trigger matching mirrors `getCharacterEffectsForCast`: if `trigger.ability`
 *  is set, it must equal `castType`; otherwise the source's `abilityType`
 *  determines which host ability's duration binds the trigger. */
export function getCharacterEffectsForAfterDuration(
	char: CharacterData,
	castType: 'skill' | 'burst'
): Effect[] {
	const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
	const result: Effect[] = [];
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.trigger.type !== 'afterDuration') continue;
			const explicit = fx.trigger.ability;
			if (explicit !== undefined) {
				if (explicit !== castType) continue;
			} else {
				if (src.abilityType !== castType) continue;
			}
			result.push(fx);
		}
	}
	return normalizeBuffLikeEffects(result);
}

/** Collects effects with `trigger.type === "onTeamNightsoulBurst"`. The trigger
 *  is global (fires on every team NB event in `nbBars`), so there's no per-cast
 *  filtering — just gather candidates. Source-agnostic; passives/constellations
 *  carry these triggers in practice (Mavuika A1, Varesa A4, Xilonen A2, Ifa A1). */
export function getCharacterEffectsForTeamNightsoulBurst(char: CharacterData): Effect[] {
	const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
	const result: Effect[] = [];
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.trigger.type !== 'onTeamNightsoulBurst') continue;
			result.push(fx);
		}
	}
	return normalizeBuffLikeEffects(result);
}

/** Collects effects with `trigger.type === "onReaction"`. Source-agnostic;
 *  walks the full effect surface (abilities + passives + constellations).
 *  Pairs with the parser's `reaction` IR events — the dispatcher matches
 *  each event against `trigger.reaction` and the effect's `conditions` per
 *  cast at fire time. */
export function getCharacterEffectsForOnReaction(char: CharacterData): Effect[] {
	const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
	const result: Effect[] = [];
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.trigger.type !== 'onReaction') continue;
			result.push(fx);
		}
	}
	return normalizeBuffLikeEffects(result);
}
