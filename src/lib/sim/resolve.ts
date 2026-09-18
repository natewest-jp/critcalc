/**
 * src/lib/sim/resolve.ts
 *
 * "Which ability is this token, and what are its numbers?" — the resolution
 * layer between a token and the cast it becomes (gauge-round L3c, lifted
 * verbatim out of `notationParser.ts`).
 *
 * ⚓ Resolution is STATE-DEPENDENT, which is the reason the gauge round could
 * not split the parse into "schedule then simulate" (gauge-round.md §2, F1):
 * `resolveActiveAbility` takes the live state set, so Cyno's `Q N1 N2` resolves
 * in-stance normals only because the Q already ran. Every function here takes
 * the state it needs as an argument for exactly that reason.
 */

import type {
	Ability,
	AbilityVariant,
	CastAbility,
	DurationModifier,
	NormalAbility,
	NormalHit,
	CooldownModifier
} from '$lib/types/ability';
import {
	getActiveDuration,
	getActiveDurationModifiers,
	getSummonActivatesAt
} from '$lib/types/ability';
import { FPS, frameAt, framesOf, type CancelKey } from '$lib/utils/frames';
import { GENERIC_CHARGE_FRAMES, GENERIC_SKILL, GENERIC_BURST } from '$lib/data/genericProfile';
import {
	applyModifiers,
	DEFAULT_ASCENSION,
	evalCondition,
	type ChainIndex,
	type ConditionContext
} from './conditions';

/** Fallback cast time when no E/Q frame data is present on the ability (FRAMES).
 *  Sourced from the data-derived generic profile (genericProfile.ts) so a
 *  frameless skill/burst gets a realistic cast length, not a magic constant. */
const E_CAST_F = GENERIC_SKILL.castAnim;
const Q_CAST_F = GENERIC_BURST.castAnim;

/**
 * Resolves E/Q cast time (FRAMES) from frame data, selecting the cancel window
 * for the given next-action key. The caller passes the `matchVariant`-resolved
 * variant (e.g. hE, h1E, h2E, sQ) whose frames replace the base's.
 * Characters authored without FrameMaps (pre-release stubs with no gcsim
 * source) fall back to the generic cast constants instead of killing the parse.
 *
 * ⚓ A FrameMap was always frames; this used to divide them into a seconds
 * clock. The clock is frames now (C1), so the value passes through untouched.
 */
export function resolveEQCastTime(
	ability: CastAbility,
	variant: AbilityVariant | undefined,
	nextKey: CancelKey
): number {
	const frameMap = variant?.frames ?? ability.frames;
	if (!frameMap) return ability.abilityType === 'burst' ? Q_CAST_F : E_CAST_F;
	// ⚓ The fallback is `anim`, not `swap` (L4b). The old code needed a
	// `Math.max(...Object.values())` guard here for the two curated maps that never
	// carried a `swap` key at all (qiqi skill, Mika hE); with an animation length
	// required on every map, that guard has nothing left to guard.
	return frameAt(frameMap, nextKey);
}

/**
 * Resolves cast time (FRAMES) for a single hit in a normal-attack combo.
 * `index` is the 0-based hit index (normalCounter or explicit N1→0, N2→1 …).
 * Returns null when hits data is absent (caller should skip the cursor advance).
 */
export function resolveNormalCastTime(
	hits: NormalHit[] | undefined,
	index: number,
	nextKey: CancelKey
): number | null {
	if (!hits?.length) return null;
	const hit = hits[Math.min(index, hits.length - 1)];
	return frameAt(hit.frames, nextKey);
}

/**
 * Resolves cast time (FRAMES) for a charged attack.
 * Bow characters use `chargeHits[]`; all others use `chargeFrames`.
 * Token 'C'/'C2' → last entry (full charge); 'C1' → first entry.
 * Returns null when the relevant frame data is absent.
 */
export function resolveChargeCastTime(
	ability: NormalAbility,
	charToken: string,
	nextKey: CancelKey,
	isBow: boolean,
	/** Whether the special form may be taken at all — false when the skill an
	 *  `sC` spends is not the active one (`specialChargeSpends`), so the attack
	 *  it names cannot be performed and the token is the ordinary charge. */
	allowSpecial = true
): number | null {
	if (isBow) {
		const hits = ability.chargeHits;
		if (!hits?.length) return null;
		const index = charToken === 'C1' ? 0 : hits.length - 1;
		return frameAt(hits[index].frames, nextKey);
	} else {
		// ⚓ KQM's `sC` is the SPECIAL charged attack a stance substitutes (Varka's
		// Azure Devour). ⚠️ It falls back to the ordinary `chargeFrames` when the
		// resolved ability authors none — the same rule an out-of-window `sQ`
		// follows, because a token the data cannot honour should take the ordinary
		// form rather than vanish.
		const special =
			charToken.startsWith('s') && allowSpecial ? ability.specialChargeFrames : undefined;
		// Frameless (uncurated / Blank) → generic charge profile, so a charged
		// attack advances the cursor realistically instead of by zero.
		const frameMap = special ?? ability.chargeFrames ?? GENERIC_CHARGE_FRAMES;
		return frameAt(frameMap, nextKey);
	}
}

/**
 * Resolves the active-window duration and modifiers for a cast, accounting for
 * variant overrides. Precedence (most specific wins):
 *   1. variant.summons[0]     — variant-level summon override
 *   2. variant.duration       — variant-level legacy override
 *   3. variant.activeDuration — variant-level instant window (2026-08-14)
 *   4. ability.summons[0]     — base summon (via getActiveDuration accessor)
 *   5. ability.duration       — base legacy (via getActiveDuration accessor)
 *   6. ability.activeDuration — base instant window (via the same accessor)
 *
 * ⚠ RUNGS 3 AND 4 ARE THE ORDER THAT MATTERS. A variant's own instant window
 * has to outrank the BASE ability's summon, or Zhongli's hold-E — a 20s Jade
 * Shield cast off a base whose Stone Stele runs 30s — would draw a 30s bar the
 * moment its stand-in summon was retired. Every other variant field already
 * behaves this way; this one just has a base-level rival that is easy to miss.
 *
 * Variant modifier arrays **replace** the base's array — a curator who lists
 * modifiers on a variant has opted that variant out of the base set.
 */
export function resolveActiveDuration(
	ability: CastAbility,
	variant: AbilityVariant | undefined
): { duration: number; modifiers: DurationModifier[] | undefined } {
	// ⚠️ Every rung reads AUTHORED SECONDS and returns FRAMES (C1). The accessors
	// (`getActiveDuration`) are shared with the Team Builder, which is
	// seconds-native — so the conversion belongs here, at the parser's edge, and
	// NOT inside them.
	const variantSummon = variant?.summons?.[0];
	if (variantSummon) {
		return {
			duration: framesOf(variantSummon.duration),
			modifiers: variantSummon.durationModifiers
		};
	}
	if (variant?.duration !== undefined) {
		return { duration: framesOf(variant.duration), modifiers: variant.durationModifiers };
	}
	if (variant?.activeDuration !== undefined) {
		return { duration: framesOf(variant.activeDuration), modifiers: variant.durationModifiers };
	}
	return {
		duration: framesOf(getActiveDuration(ability)),
		modifiers: getActiveDurationModifiers(ability)
	};
}

/**
 * Resolves cooldown, duration, and summon spawn frame for an ability cast,
 * merging variant overrides and applying modifiers at DEFAULT_ASCENSION.
 * Variant fields take precedence; modifiers (from the base ability) are
 * applied on top. `resolvedStates` allows state-gated modifiers (e.g.
 * duringSummon) to activate.
 *
 * Returns `summonActivatesAt` in 60fps frames; the renderer offsets the active
 * bar by this value. Variant summons override variant.summonActivatesAt
 * override the base ability's summons[0].spawnsAt / persistent summonActivatesAt.
 */
/**
 * Resolves stance-related fields for an ability + token combination, with
 * variant overrides applied. Used at cast-open time to decide whether to
 * open a stance window, what named state (if any) to attach, and whether
 * the window closes on character swap.
 *
 * Variant fields fully replace base values when explicitly present (per the
 * AbilityVariant convention); the `!== undefined` check distinguishes
 * "variant didn't set this field" from "variant set it to false/undefined."
 *
 * Reference: Mavuika Hold-E (variant input ["hE"]) overrides the base skill's
 * behavior: "instant" → "stance" + opensState: "nightsoulBlessing" so the
 * Flamestrider mode opens a real bike-NS window without splitting into two
 * skill abilities.
 */
export function resolveStanceFields(
	ability: CastAbility,
	variant: AbilityVariant | undefined
): {
	behavior: 'instant' | 'persistent' | 'stance';
	opensState?: import('$lib/types/ability').State;
	terminatesOnSwap: boolean;
} {
	const behavior = variant?.behavior !== undefined ? variant.behavior : ability.behavior;
	if (behavior !== 'stance') return { behavior, terminatesOnSwap: false };
	const baseStance = ability.behavior === 'stance';
	const opensState =
		variant?.opensState !== undefined
			? variant.opensState
			: baseStance
				? ability.opensState
				: undefined;
	const terminatesOnSwap =
		variant?.terminatesOnSwap !== undefined
			? variant.terminatesOnSwap
			: baseStance
				? ability.terminatesOnSwap === true
				: false;
	return { behavior, opensState, terminatesOnSwap };
}

export function resolveAbilityTiming(
	ability: CastAbility,
	variant: AbilityVariant | undefined,
	resolvedStates: ReadonlySet<string> = new Set(),
	constellationLevel = 0,
	chainIndex: ChainIndex = new Map(),
	stacks?: ReadonlyMap<string, number>,
	/** Team scope for a modifier's own gate — see `applyModifiers`. Absent means a
	 *  team-composition-gated modifier cannot resolve and is skipped. */
	context?: ConditionContext,
	/** Team-wide SKILL cooldown modifiers (`TeamContext.skillCooldownModifiers`
	 *  — Anemo Resonance), applied before the ability's own so a flat modifier
	 *  authored as "off the remaining cooldown" (Qiqi) subtracts from the
	 *  resonance-reduced value, as in game. Ignored for a burst. */
	teamSkillCooldownModifiers: readonly CooldownModifier[] = []
): { cooldown: number; duration: number; summonActivatesAt: number } {
	const ownCdMods = variant?.cooldownModifiers ?? ability.cooldownModifiers;
	const cdMods =
		ability.abilityType === 'skill' && teamSkillCooldownModifiers.length > 0
			? [...teamSkillCooldownModifiers, ...(ownCdMods ?? [])]
			: ownCdMods;
	const cooldown = applyModifiers(
		framesOf(variant?.cooldown ?? ability.cooldown),
		cdMods,
		DEFAULT_ASCENSION,
		resolvedStates,
		constellationLevel,
		chainIndex,
		stacks,
		FPS, // a `flat` cooldown modifier is authored in seconds
		context
	);
	const { duration: baseDur, modifiers: durMods } = resolveActiveDuration(ability, variant);
	const duration = applyModifiers(
		baseDur,
		durMods,
		DEFAULT_ASCENSION,
		resolvedStates,
		constellationLevel,
		chainIndex,
		stacks,
		FPS, // ditto for a `flat` duration modifier
		context
	);
	const variantSummon = variant?.summons?.[0];
	const summonActivatesAt = variantSummon
		? (variantSummon.spawnsAt ?? 0)
		: (variant?.summonActivatesAt ?? getSummonActivatesAt(ability));
	// Non-instant abilities authored without a duration (pre-release data gaps)
	// yield undefined here; sanitize to 0 so downstream window math
	// (stanceWindows end = start + duration, bar uptime) never sees NaN.
	return {
		cooldown,
		duration: Number.isFinite(duration) ? duration : 0,
		summonActivatesAt
	};
}

// ---------------------------------------------------------------------------
// Stance-aware ability resolution
// ---------------------------------------------------------------------------

/**
 * Finds the best-matching ability of the given type for the current resolved
 * states. Prefers conditioned abilities whose condition is definitively met
 * (e.g. an in-stance variant when `inStance` is in resolvedStates) over
 * unconditioned base abilities. Returns undefined if no match exists.
 */
export function resolveActiveAbility<K extends Ability['abilityType']>(
	char: import('$lib/types/character').CharacterData,
	abilityType: K,
	resolvedStates: ReadonlySet<string>,
	constellationLevel = 0,
	chainIndex: ChainIndex = new Map(),
	stacks?: ReadonlyMap<string, number>,
	/** Team scope for the sibling's own gate — the SAME context `matchVariant`
	 *  takes, and for the same reason.
	 *
	 *  ⚓ Without it a `teamElementCount` / `teamFaction` term is UNRESOLVABLE,
	 *  never definitively true, so an `all` containing one can never win and the
	 *  cast silently falls back to the unconditioned base. That made a sibling
	 *  ability strictly weaker than a variant at expressing the same gate —
	 *  which is backwards, since a sibling is what you reach for precisely when
	 *  a variant's shared charge queue is wrong (Odette's Coda, Varka's Four
	 *  Winds' Ascension). Absent still means "cannot resolve a team term", the
	 *  same fallback as before. */
	context?: ConditionContext
): Extract<Ability, { abilityType: K }> | undefined {
	const candidates = char.abilities.filter(
		(a): a is Extract<Ability, { abilityType: K }> => a.abilityType === abilityType
	);
	// Prefer a conditioned ability whose condition is definitively satisfied.
	const conditioned = candidates.find(
		(a) =>
			a.conditions !== undefined &&
			evalCondition(
				a.conditions,
				DEFAULT_ASCENSION,
				resolvedStates,
				constellationLevel,
				chainIndex,
				stacks,
				context
			) === true
	);
	if (conditioned) return conditioned;
	// Fall back to the unconditioned base ability.
	return candidates.find((a) => a.conditions === undefined);
}
