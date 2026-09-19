/**
 * src/lib/sim/conditions.ts
 *
 * Condition evaluation and the modifier/variant resolution built on it
 * (gauge-round L3c — lifted verbatim out of `notationParser.ts`).
 *
 * ⚓ A LEAF. Nothing here imports the parser, which is the point: `evalCondition`
 * is what `buffWindows.ts` reaches back into the parser for, and that import is
 * the reason the two modules sit in a cycle both of them carry a comment
 * excusing. Once the last shared symbol lives out here, the cycle is simply
 * gone rather than documented.
 *
 * ⚠️ `notationParser.ts` re-exports `evalCondition`, `findChainStage`,
 * `ChainIndex` and `ConditionContext` so that no consumer's import statement
 * changes in this landing (22 files import from it).
 */

import type {
	AbilityVariant,
	CastAbility,
	ChainStageCondition,
	Condition,
	CooldownModifier,
	Element,
	ElementRef,
	Reaction,
	SkillAbility
} from '$lib/types/ability';
import type { WeaponType } from '$lib/types/weapon';

// Assumed ascension level for all characters (affects modifier eligibility).
export const DEFAULT_ASCENSION = 4;

// ---------------------------------------------------------------------------
// Modifier helpers
// ---------------------------------------------------------------------------

/**
 * Per-character chain-stage position for skill/burst chains.
 * Resets to index 0 when expiresAt is in the past (window expired) or when
 * the terminal stage fires (no window on its chainStage condition).
 */
export type ChainIndex = ReadonlyMap<'skill' | 'burst', number>;

/**
 * Optional context for runtime-team-state condition resolution.
 *
 * - `teamFactionCounts` — number of party members per faction key. Lets
 *   `teamFaction` conditions resolve definitively (e.g. moonsign:2 →
 *   true when ≥2 Moonsign characters are in the team). Absent → returns null
 *   for backward compat with parser-side calls that have no team context.
 * - `negatedStates` — state keys that are definitively NOT active at the
 *   evaluation point. Lets the renderer assert "off-field is currently false"
 *   per active-character segment so `state: "offField"` returns false (not
 *   null) inside the source character's own segment. Pair with `resolvedStates`
 *   on the affirmative side: per-segment, exactly one of `onField`/`offField`
 *   is in resolvedStates and the other is in negatedStates.
 * - `activeCharFactions` — factions of the currently-active character (the
 *   receiver, in per-segment evaluation). Lets `activeCharFaction` conditions
 *   resolve definitively at per-segment scope. Absent → returns null so the
 *   condition doesn't drop effects in non-segment contexts.
 */
export type ConditionContext = {
	teamFactionCounts?: ReadonlyMap<string, number>;
	/** Reactions the party's members enable (Stellar model — see
	 *  `computeTeamEnabledReactions`). Lets `teamEnablesReaction` conditions
	 *  resolve definitively. Absent → null, same rule as teamFactionCounts. */
	teamEnabledReactions?: ReadonlySet<string>;
	negatedStates?: ReadonlySet<string>;
	activeCharFactions?: ReadonlySet<string>;
	/** Per-element team-member count map for the CURRENT holder being
	 *  evaluated (i.e. the effect's owning character). Pre-computed at the
	 *  call site against the current team composition, with the holder
	 *  excluded by default. When the `teamElementCount` Condition's
	 *  `includeSelf: true` flag is set, the holder's own element is counted
	 *  back in via the parser-side accumulator.
	 *
	 *  Absent → `teamElementCount` Conditions return null (parser-side calls
	 *  without team context) so effects aren't dropped before the renderer
	 *  has team scope. */
	teamElementCounts?: ReadonlyMap<Element, number>;
	/** The weapon of the character an effect is being resolved FOR — the
	 *  receiver, not the holder.
	 *
	 *  ⚓ Census 2026-08-15: every `weaponType` condition in the corpus sits on
	 *  an `active`-target effect (Bennett C6's Pyro buff and its infusion,
	 *  Candace's burst infusion), so the weapon the condition asks about is
	 *  always the RECEIVER's. For a self-target effect the receiver IS the
	 *  holder, so one field serves both readings. ⚠️ If a holder-facing
	 *  `weaponType` is ever authored, this field is the thing to split.
	 *
	 *  Absent → `weaponType` returns null, the same optimistic rule
	 *  `teamFaction` and `activeCharFaction` use. */
	receiverWeapon?: WeaponType;
	/** Whether a Polestar Field stands at the instant being evaluated — the
	 *  caller resolves the instant (`polestarFieldOpenAt`) and hands over the
	 *  answer. Absent → `inPolestarField` returns null, the optimistic rule. */
	inPolestarField?: boolean;
};

/** Whether a condition tree asks about the Polestar Field anywhere — the gate
 *  that keeps the per-instant lookup off every tree that does not. */
export function mentionsPolestarField(cond: Condition | undefined): boolean {
	if (!cond) return false;
	switch (cond.type) {
		case 'inPolestarField':
			return true;
		case 'not':
			return mentionsPolestarField(cond.condition);
		case 'all':
		case 'any':
			return cond.conditions.some(mentionsPolestarField);
		default:
			return false;
	}
}

/**
 * Evaluates whether a condition is definitively met at the given ascension and
 * known runtime states. Returns true = applies, false = does not apply,
 * null = depends on unknown runtime state.
 *
 * `resolvedStates` carries state keys that have been inferred from the timeline
 * (e.g. 'duringSummon' when a stationary persistent summon is still active).
 * A state condition resolves to true if the key is in `resolvedStates`, false
 * if in `context.negatedStates` (a definitive "currently not this state"),
 * null otherwise.
 *
 * `constellationLevel` is the character's current C0–C6 level; when provided,
 * constellation conditions resolve definitively instead of returning null.
 *
 * `chainIndex` carries the current per-ability-kind chain-stage position for the
 * character being evaluated. Provided by the parser around resolveActiveAbility
 * calls; absent (default empty map) when chain awareness isn't relevant.
 *
 * `stacks` is the per-character stack snapshot for the cast being evaluated;
 * see the `stacks` Condition variant.
 *
 * `context` carries renderer-side runtime team-state info — teamFaction counts
 * and per-segment negated states. Both are optional; calls without them
 * preserve the prior null-return behavior.
 */
/**
 * The element an `ElementRef` names, or `undefined` when it names none
 * (Varka's two claymores round, 2026-09-16).
 *
 * ⚓ A literal answers itself. A `teamElementPriority` walks its `order` and
 * takes the FIRST element a non-holder party member carries — gcsim's
 * `getConversionElem(Pyro, Hydro, Electro, Cryo)` — then `fallback`, then
 * nothing.
 *
 * ⚠️ NO CONTEXT MEANS NO ELEMENT, deliberately, and that is NOT the optimistic
 * rule the Conditions use. A Condition with no team scope answers `null` so its
 * effect is not DROPPED; here there is nothing to drop — an unresolved element
 * is a hit that applies nothing, which is already exactly what an absent
 * `element` or `infusion` means at every reader. The editor's highlighter
 * passes no context and leaves the swing untinted, the same silence every timed
 * infusion already gets there.
 */
export function resolveElementRef(
	ref: ElementRef | undefined,
	context?: ConditionContext
): Element | undefined {
	if (ref === undefined) return undefined;
	if (typeof ref === 'string') return ref;
	const counts = context?.teamElementCounts;
	if (counts) {
		for (const e of ref.order) if ((counts.get(e) ?? 0) > 0) return e;
	}
	return ref.fallback;
}

export function evalCondition(
	cond: Condition | undefined,
	ascension: number,
	resolvedStates: ReadonlySet<string> = new Set(),
	constellationLevel = 0,
	chainIndex: ChainIndex = new Map(),
	stacks?: ReadonlyMap<string, number>,
	context?: ConditionContext
): boolean | null {
	if (!cond) return true;
	switch (cond.type) {
		case 'ascension':
			return ascension >= cond.min;
		case 'constellation':
			return constellationLevel >= cond.level;
		case 'state': {
			if (resolvedStates.has(cond.state)) return true;
			if (context?.negatedStates?.has(cond.state)) return false;
			return null;
		}
		case 'chainStage':
			return (chainIndex.get(cond.ability) ?? 0) === cond.index;
		case 'stacks': {
			// Without a stack context (e.g. timeline-side filtering with no
			// rotation cursor), treat as unresolvable so the effect isn't
			// definitively filtered. With context, count >= min (and optional
			// max) gates the effect deterministically.
			if (!stacks) return null;
			const count = stacks.get(cond.key) ?? 0;
			if (count < cond.min) return false;
			if (cond.max !== undefined && count > cond.max) return false;
			return true;
		}
		case 'teamFaction': {
			// Resolves when teamFactionCounts is provided (renderer-side calls);
			// returns null when absent (parser-side calls, no team in scope) so
			// effects aren't dropped on the parsing pass.
			if (!context?.teamFactionCounts) return null;
			const count = context.teamFactionCounts.get(cond.faction) ?? 0;
			return count >= cond.min;
		}
		case 'teamEnablesReaction': {
			// Same resolution rule as teamFaction: definitively true/false once
			// the team's enabled-reaction set is in scope, null before then.
			if (!context?.teamEnabledReactions) return null;
			return context.teamEnabledReactions.has(cond.reaction);
		}
		case 'teamElementCount': {
			// Resolves when teamElementCounts is provided (renderer-side per-
			// holder calls); returns null when absent so effects aren't dropped
			// before team scope is available. Sum across the requested element
			// set; holder is already excluded from the pre-computed map.
			if (!context?.teamElementCounts) return null;
			let total = 0;
			for (const el of cond.elements) {
				total += context.teamElementCounts.get(el) ?? 0;
			}
			switch (cond.comparison) {
				case '>=':
					return total >= cond.value;
				case '=':
					return total === cond.value;
				case '<=':
					return total <= cond.value;
			}
			return null;
		}
		case 'inPolestarField':
			return context?.inPolestarField ?? null;
		case 'activeCharFaction': {
			// Resolves at per-segment scope where the receiver's factions are
			// known. Absent → null so non-segment contexts don't drop the effect.
			if (!context?.activeCharFactions) return null;
			return context.activeCharFactions.has(cond.faction);
		}
		case 'weaponType':
			// Resolves once the receiver is concrete (the infusion path passes
			// the swinging character's weapon); null before then so the effect
			// isn't dropped. See `receiverWeapon` on ConditionContext for why
			// the subject is the receiver and not the holder.
			if (!context?.receiverWeapon) return null;
			return cond.weapons.includes(context.receiverWeapon);
		case 'enemyHpBelow':
		case 'enemyHpAbove':
		case 'enemyAffectedBy':
		case 'selfHpBelow':
		case 'selfHpAbove':
		case 'recipientHpBelow':
			// Planner cannot simulate self/enemy HP or aura state at action time;
			// return null so the effect renders optimistically with its standard
			// caveat treatment rather than getting filtered out.
			return null;
		case 'not': {
			const r = evalCondition(
				cond.condition,
				ascension,
				resolvedStates,
				constellationLevel,
				chainIndex,
				stacks,
				context
			);
			return r === null ? null : !r;
		}
		case 'all': {
			let hasNull = false;
			for (const c of cond.conditions) {
				const r = evalCondition(
					c,
					ascension,
					resolvedStates,
					constellationLevel,
					chainIndex,
					stacks,
					context
				);
				if (r === false) return false;
				if (r === null) hasNull = true;
			}
			return hasNull ? null : true;
		}
		case 'any': {
			let hasNull = false;
			for (const c of cond.conditions) {
				const r = evalCondition(
					c,
					ascension,
					resolvedStates,
					constellationLevel,
					chainIndex,
					stacks,
					context
				);
				if (r === true) return true;
				if (r === null) hasNull = true;
			}
			return hasNull ? null : false;
		}
		default: {
			// Exhaustiveness guard: adding a new Condition variant without
			// extending this switch becomes a compile error instead of a silent null.
			const _exhaustive: never = cond;
			void _exhaustive;
			return null;
		}
	}
}

/**
 * Walks a Condition tree and returns the first chainStage clause it finds.
 * Recurses into `all` (compound AND) but not into `not`/`any` — semantics
 * unclear and not yet needed by curation.
 */
export function findChainStage(cond: Condition | undefined): ChainStageCondition | undefined {
	if (!cond) return undefined;
	if (cond.type === 'chainStage') return cond;
	if (cond.type === 'all') {
		for (const c of cond.conditions) {
			const found = findChainStage(c);
			if (found) return found;
		}
	}
	return undefined;
}

/**
 * Applies a list of modifiers to a base value, skipping any with unresolvable
 * conditions.
 *
 * ⚠️⚠️ THIS FUNCTION IS POLYMORPHIC IN UNIT, which is why the frames migration
 * could not simply convert inside it. A `percent` modifier is a ratio and is
 * unit-free. A `flat` modifier ADDS ITS VALUE — and the three callers disagree
 * about what a value means: cooldown and duration are authored SECONDS against a
 * base that is now FRAMES (C1), while `resolveEffectiveCharges` passes a CHARGE
 * COUNT, which is not a time at all. Hence `flatScale`, set by the caller who
 * knows.
 */
export function applyModifiers(
	base: number,
	modifiers: CooldownModifier[] | undefined,
	ascension: number,
	resolvedStates: ReadonlySet<string> = new Set(),
	constellationLevel = 0,
	chainIndex: ChainIndex = new Map(),
	stacks?: ReadonlyMap<string, number>,
	/** Multiplier applied to a `flat` modifier's value before it is added.
	 *  `FPS` at the two time-valued call sites; 1 (the default) for charges. */
	flatScale = 1,
	/**
	 * ⚓ TEAM SCOPE FOR A MODIFIER'S GATE (2026-08-18). Without this, a
	 * `teamElementCount` / `teamFaction` condition on a modifier returns null and
	 * the `!== true` test below SKIPS the modifier — silently, for a modifier the
	 * game does apply.
	 *
	 * ⚠️⚠️ Note the asymmetry that made this a live bug: in a buff POOL a null
	 * means "keep optimistically" (the effect survives to be re-filtered with real
	 * scope later), but here there is no later — a cooldown is one number resolved
	 * once, so the same null DROPS. Measured: Arataki Itto's C2 gives −1.5s
	 * unconditionally plus −1.5s per Geo teammate; with two Geo allies the game
	 * reaches 13.5s and the timeline drew 16.5s.
	 *
	 * ⛔ The fix is to SUPPLY THE CONTEXT, never to relax `!== true` to `!== false`.
	 * Relaxing it would make every unresolvable modifier apply — an optimistic
	 * shift across the whole corpus to fix two authored modifiers.
	 */
	context?: ConditionContext
): number {
	if (!modifiers?.length) return base;
	let result = base;
	for (const mod of modifiers) {
		if (
			evalCondition(
				mod.conditions,
				ascension,
				resolvedStates,
				constellationLevel,
				chainIndex,
				stacks,
				context
			) !== true
		)
			continue;
		result =
			mod.type === 'percent' ? result * (1 + mod.value / 100) : result + mod.value * flatScale;
	}
	return Math.max(0, result);
}

/**
 * Resolves the ability variant matching a token, honoring variant-level
 * `conditions` (sQ primitive, 2026-07-17). A variant is eligible when its
 * `input` contains the token AND its conditions (if any) evaluate to a
 * DEFINITIVE true — parser-side state tracking is authoritative, and the
 * caller supplies team context so `teamElementCount`/`teamFaction`
 * conditions resolve instead of returning null (Varka Four Winds).
 *
 * An out-of-window `sQ` therefore matches no variant and falls back to the
 * base ability's timing/cooldown — exactly the "wrongly resolve" case the
 * pre-conditions matcher had (it matched on input alone).
 */
export function matchVariant(
	ability: CastAbility,
	tokenText: string,
	resolvedStates: ReadonlySet<string>,
	constellationLevel: number,
	chainIndex: ChainIndex,
	stacks: ReadonlyMap<string, number> | undefined,
	context: ConditionContext | undefined
): AbilityVariant | undefined {
	return ability.variants?.find((v) => {
		if (!(v.input as string[] | undefined)?.includes(tokenText)) return false;
		if (v.conditions === undefined) return true;
		return (
			evalCondition(
				v.conditions,
				DEFAULT_ASCENSION,
				resolvedStates,
				constellationLevel,
				chainIndex,
				stacks,
				context
			) === true
		);
	});
}

/**
 * Resolves the effective charge count for a skill ability, applying chargeModifiers
 * at the given constellation level. Returns at least 1.
 *
 * Variant-aware: the caller passes the `matchVariant`-resolved variant; its
 * `charges` and `chargeModifiers` **replace** the base (symmetric with
 * `resolveAbilityTiming`). Today no curated character uses variant-level
 * charge data; this keeps the contract consistent for future curation.
 */
export function resolveEffectiveCharges(
	ability: SkillAbility,
	variant: AbilityVariant | undefined,
	constellationLevel = 0
): number {
	const base = variant?.charges ?? ability.charges ?? 1;
	const modifiers = variant?.chargeModifiers ?? ability.chargeModifiers;
	return Math.max(
		1,
		Math.round(applyModifiers(base, modifiers, DEFAULT_ASCENSION, new Set(), constellationLevel))
	);
}

/** Does an emitted Reaction match an authored `trigger.reaction`, which may be a
 *  single Reaction, an array, or "any"?
 *
 *  ⚓ A leaf predicate over authored trigger data, and it lives here rather than
 *  beside either caller because BOTH the stacks dispatch and the duration-
 *  extension dispatch need it — the one shape a shared gate must not have is two
 *  copies (`onHitTriggerMatches` carries the same note at its own site). */
export function reactionMatchesTrigger(
	emitted: Reaction,
	trigReaction: Reaction | Reaction[] | 'any'
): boolean {
	if (trigReaction === 'any') return true;
	if (Array.isArray(trigReaction)) return trigReaction.includes(emitted);
	return trigReaction === emitted;
}
