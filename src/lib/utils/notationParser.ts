/**
 * src/lib/utils/notationParser.ts
 *
 * KQM-aligned rotation notation parser. Produces timeline track data from a
 * notation string like:
 *   Bennett Q > Kazuha hE P > Xiangling Q E > Fischl E N1 N2 ~2s
 *
 * Time model:
 *   - All Q/E bars for a character start at a local cursor that begins at
 *     that character's active-start.
 *   - Q advances the local cursor by Q_CAST_S, E by E_CAST_S.
 *   - ~Xs advances the cursor by X seconds (pure time advance, no label).
 *   - ~?s is a placeholder meaning "duration unset" — advances by MIN_ACTIVE_S
 *     and flags the track so the renderer can show a visual warning.
 *   - Swapping costs swapFrames/60 seconds before the next character starts.
 *   - ( ) marks optional actions (KQM-compatible); contents are label tokens
 *     rendered with lower opacity.
 *   - [ ] bracket groups (e.g. [N2D]x3) are preserved as label tokens.
 */

import type { CharacterData } from '$lib/types/character';
import type {
	Ability,
	AbilityVariant,
	ActionKey,
	AuraElement,
	CastAbility,
	ChainStageCondition,
	Condition,
	CooldownModifier,
	DurationExtension,
	DurationModifier,
	Element,
	NormalAbility,
	NormalHit,
	Reaction,
	ScaledValue,
	SkillAbility,
	Summon
} from '$lib/types/ability';
import {
	getActiveDuration,
	getActiveDurationModifiers,
	getPersistentBehavior,
	getDurationExtensions,
	getSummonActivatesAt
} from '$lib/types/ability';
import { tokenizeNotation, STACK_ASSERT_RE, type Token } from '$lib/utils/tokenizer';
import { computeTeamFactionCounts } from '$lib/utils/teamComposition';
import { getWeaponById } from '$lib/data/weaponLookup';
import type { LoadoutEntry } from '$lib/stores';
import type {
	ActionEvent,
	CastEvent,
	TimelineEvent,
	TimelineWindow
} from '$lib/utils/rotationEvents';

// Re-export the IR surface so consumers can import event/window types straight
// from the parser module they already depend on.
export type {
	TimelineEvent,
	TimelineWindow,
	CastEvent,
	ReactionEvent,
	ShieldEndEvent
} from '$lib/utils/rotationEvents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-track E/Q bar. Post-P4 #3: a pure PROJECTION of a `cast` event —
 *  built at finalize from the event's geometric fields (1:1, field-equal).
 *  Kept as the renderer's per-track iteration surface; the cast event is
 *  the source of truth. */
export type TimelineBar = {
	start: number; // seconds
	uptime: number; // seconds (0 = instant)
	cooldown: number; // seconds
	label: string; // notation token displayed on the bar (e.g. "Q", "hE")
	castTime: number; // seconds — duration of the cast animation (used for active-bar overlay)
	/** Frames (60fps) from cast start until the summon becomes active. 0 when absent.
	 *  Mirrors persistent-behavior summonActivatesAt; carried on the bar so the
	 *  renderer and duringSummon detection don't need to re-query the ability. */
	summonActivatesAt?: number;
	/** True when a Sacrificial-series proc fired on this cast, resetting the CD to 0.
	 *  The renderer uses this to draw the entire bar as a dim+bordered "available" style
	 *  instead of the usual opaque uptime + ghost CD split. */
	sacProcFired?: boolean;
	/** Snapshot of the per-character stack state at this cast's moment. Lets the
	 *  timeline filter stack-gated effects per-cast instead of unconditionally.
	 *  Absent when no stacks have been asserted in the current segment. */
	stackContext?: ReadonlyMap<string, number>;
};

export type InputBlockKind =
	| 'normal'
	| 'elemental-normal'
	| 'skill'
	| 'burst'
	| 'movement'
	| 'unset';

/** A discrete per-input building block in the active row. */
export type InputBlock = {
	start: number; // seconds — absolute timeline position
	duration: number; // seconds — block width
	parts: string[]; // display labels e.g. ["N5"], ["Q"], ["hE"]
	kind: InputBlockKind;
};

export type CharacterTrack = {
	characterId: string;
	displayName: string;
	element: string;
	activeStart: number; // seconds
	activeEnd: number; // seconds
	/** Per-input building blocks in the active row, chronological order. */
	inputBlocks: InputBlock[];
	hasUnsetDuration: boolean; // true when ~?s was encountered
	eBars: TimelineBar[];
	qBars: TimelineBar[];
};

export type WeaponProcBar = { start: number; end: number };

/** Raw hit record surfaced at each E/Q cast site (E3 v2.x). PARSER-PRIVATE
 *  (post-P4 #1 decision): consumed solely by the rotation-wide onHit
 *  gainStacks dispatcher (Skirk A4 Death's Crossing) — it is per-cast
 *  granularity only and is NOT part of the public IR event stream. The
 *  action-level event work (post-P4 backlog #2) owns the future public
 *  per-action surface. Per-hit fidelity (NA / CA / plunge with
 *  infusion-specific elements) is deferred until a corpus need surfaces.
 *
 *  - `characterId` — the character whose cast dealt the hit.
 *  - `element` — element tag of the hit (defaults to character element).
 *  - `time` — absolute rotation seconds of the cast that emitted it.
 *  - `castKind` — which cast type (skill or burst) emitted the event. */
type HitEvent = {
	characterId: string;
	element: Element;
	time: number;
	castKind: 'skill' | 'burst';
};

export type ParsedRotation = {
	tracks: CharacterTrack[];
	totalDuration: number;
	unknownTokens: string[]; // tokens not recognised as valid notation
	/** P4 IR — time-sorted point events (`cast` / `action` / `reaction` /
	 *  `shieldEnd`). The sole event surface: cast markers drive the timeline
	 *  rows, `action` events carry the per-swing input substrate (post-P4 #2),
	 *  and the reaction/shieldEnd kinds feed effect dispatch. */
	events: TimelineEvent[];
	/** P4 IR — span records with FINAL end times (`stance` / `state` /
	 *  `summon` / `shield` / `weaponProc`). Extensions and swap/recast
	 *  truncations are already applied; consumers never re-derive window ends
	 *  from bar geometry (weapon-proc rows, summon subrows, stance/state
	 *  overlays all project these spans). */
	windows: TimelineWindow[];
};

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

/** Global dash/jump duration approximation (60fps). Character-specific values deferred. */
const DASH_FRAMES = 21;
/** Fallback cast time when no E frame data is present on the ability (seconds). */
const E_CAST_S = 0.5;
/** Fallback cast time when no Q frame data is present on the ability (seconds). */
const Q_CAST_S = 1.0;
const MIN_ACTIVE_S = 0.5; // minimum on-field time when no ~Xs is specified

// Assumed ascension level for all characters (affects modifier eligibility).
const DEFAULT_ASCENSION = 4;

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
};

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
 * preserve the prior null-return behaviour.
 */
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
		case 'activeCharFaction': {
			// Resolves at per-segment scope where the receiver's factions are
			// known. Absent → null so non-segment contexts don't drop the effect.
			if (!context?.activeCharFactions) return null;
			return context.activeCharFactions.has(cond.faction);
		}
		case 'weaponType':
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

/** Applies a list of modifiers to a base value, skipping any with unresolvable conditions. */
function applyModifiers(
	base: number,
	modifiers: CooldownModifier[] | undefined,
	ascension: number,
	resolvedStates: ReadonlySet<string> = new Set(),
	constellationLevel = 0,
	chainIndex: ChainIndex = new Map(),
	stacks?: ReadonlyMap<string, number>
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
				stacks
			) !== true
		)
			continue;
		result = mod.type === 'percent' ? result * (1 + mod.value / 100) : result + mod.value;
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
function matchVariant(
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
function resolveEffectiveCharges(
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

/**
 * Infers which named states are active for this character at `cursor` based on
 * the character's cast events emitted so far (post-P4 #3: casts, not bars, are
 * the mid-parse record — bars are projected from them at finalize).
 *
 * Currently detects `duringSummon`: any stationary persistent Q or E cast whose
 * active summon window covers `cursor`. The window starts at
 * cast.time + summonActivatesAt/60 and ends uptime seconds later. Works both
 * within a segment and across segments — callers pass all of this character's
 * casts emitted so far.
 *
 * LATENT TRAP (P4): `activeDuringSummon` reads the cast's `uptime` MID-PARSE.
 * Stance / summonExt owner casts carry their un-extended push-time uptime
 * until the finalize pass stamps the extension-accumulated `ownerUptime` onto
 * them (see "P4 finalize" §1). So for an EXTENDABLE stationary summon whose
 * window is later grown by a duringSummon-gated extension, the check here
 * would see the SHORTER pre-extension span and could report `duringSummon` as
 * inactive too early. Currently inert: no character has both an extendable
 * stationary summon AND duringSummon-gated logic. If one ships, this must read
 * the live window record's `end` (or the accumulating `ownerUptime`) rather
 * than the cast's `uptime`.
 */
function inferredStates(
	emittedCasts: readonly CastEvent[],
	eAbility: CastAbility | undefined,
	qAbility: CastAbility | undefined,
	cursor: number
): Set<string> {
	const states = new Set<string>();
	const activeDuringSummon = (c: CastEvent) => {
		const activatesAt = c.summonActivatesAt / 60;
		return c.time + activatesAt <= cursor && cursor < c.time + activatesAt + c.uptime;
	};
	if (
		qAbility &&
		getPersistentBehavior(qAbility) === 'stationary' &&
		emittedCasts.some((c) => c.ability === 'burst' && activeDuringSummon(c))
	) {
		states.add('duringSummon');
	}
	if (
		eAbility &&
		getPersistentBehavior(eAbility) === 'stationary' &&
		emittedCasts.some((c) => c.ability === 'skill' && activeDuringSummon(c))
	) {
		states.add('duringSummon');
	}
	return states;
}

/**
 * Maps the next token after position j to the ActionKey used for cancel-window
 * selection. Returns 'swap' (full animation fallback) for end-of-segment,
 * time advances, optional groups, or anything else that isn't a direct action.
 */
function peekActionKey(tokens: Token[], j: number): ActionKey {
	const next = tokens[j + 1];
	if (!next) return 'swap';
	if (next.kind === 'Q') return 'Q';
	if (next.kind === 'E') return 'E';
	if (next.kind === 'label' || next.kind === 'unknown') {
		const t = next.text;
		if (/^N\d*$/.test(t)) return 'N';
		if (t === 'D') return 'D';
		if (t === 'J') return 'J';
		if (/^C\d*$/.test(t)) return 'C';
		if (/^[hl]?P$/.test(t)) return 'P';
	}
	return 'swap';
}

/**
 * Resolves E/Q cast time (seconds) from frame data, selecting the cancel window
 * for the given next-action key. The caller passes the `matchVariant`-resolved
 * variant (e.g. hE, h1E, h2E, sQ) whose frames replace the base's.
 * Characters authored without FrameMaps (pre-release, no gcsim source — e.g.
 * Durin) fall back to the generic cast constants instead of killing the parse.
 */
function resolveEQCastTime(
	ability: CastAbility,
	variant: AbilityVariant | undefined,
	nextKey: ActionKey
): number {
	const frameMap = variant?.frames ?? ability.frames;
	if (!frameMap) return ability.abilityType === 'burst' ? Q_CAST_S : E_CAST_S;
	// A few curated FrameMaps lack the canonical `swap` key (qiqi skill, Mika
	// hE variant); fall back to the longest defined cancel window rather than
	// letting undefined poison the cursor with NaN.
	const swapFallback = frameMap.swap ?? Math.max(0, ...Object.values(frameMap));
	return (frameMap[nextKey] ?? swapFallback) / 60;
}

/**
 * Resolves cast time (seconds) for a single hit in a normal-attack combo.
 * `index` is the 0-based hit index (normalCounter or explicit N1→0, N2→1 …).
 * Returns null when hits data is absent (caller should skip the cursor advance).
 */
function resolveNormalCastTime(
	hits: NormalHit[] | undefined,
	index: number,
	nextKey: ActionKey
): number | null {
	if (!hits?.length) return null;
	const hit = hits[Math.min(index, hits.length - 1)];
	return (hit.frames[nextKey] ?? hit.frames.swap) / 60;
}

/**
 * Resolves cast time (seconds) for a charged attack.
 * Bow characters use `chargeHits[]`; all others use `chargeFrames`.
 * Token 'C'/'C2' → last entry (full charge); 'C1' → first entry.
 * Returns null when the relevant frame data is absent.
 */
function resolveChargeCastTime(
	ability: NormalAbility,
	charToken: string,
	nextKey: ActionKey,
	isBow: boolean
): number | null {
	if (isBow) {
		const hits = ability.chargeHits;
		if (!hits?.length) return null;
		const index = charToken === 'C1' ? 0 : hits.length - 1;
		return (hits[index].frames[nextKey] ?? hits[index].frames.swap) / 60;
	} else {
		const frameMap = ability.chargeFrames;
		if (!frameMap) return null;
		return (frameMap[nextKey] ?? frameMap.swap) / 60;
	}
}

/**
 * Resolves the active-window duration and modifiers for a cast, accounting for
 * variant overrides. Precedence (most specific wins):
 *   1. variant.summons[0]   — variant-level summon override
 *   2. variant.duration     — variant-level legacy override
 *   3. ability.summons[0]   — base summon (via getActiveDuration accessor)
 *   4. ability.duration     — base legacy (via getActiveDuration accessor)
 *
 * Variant modifier arrays **replace** the base's array — a curator who lists
 * modifiers on a variant has opted that variant out of the base set.
 */
function resolveActiveDuration(
	ability: CastAbility,
	variant: AbilityVariant | undefined
): { duration: number; modifiers: DurationModifier[] | undefined } {
	const variantSummon = variant?.summons?.[0];
	if (variantSummon) {
		return { duration: variantSummon.duration, modifiers: variantSummon.durationModifiers };
	}
	if (variant?.duration !== undefined) {
		return { duration: variant.duration, modifiers: variant.durationModifiers };
	}
	return { duration: getActiveDuration(ability), modifiers: getActiveDurationModifiers(ability) };
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
function resolveStanceFields(
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

function resolveAbilityTiming(
	ability: CastAbility,
	variant: AbilityVariant | undefined,
	resolvedStates: ReadonlySet<string> = new Set(),
	constellationLevel = 0,
	chainIndex: ChainIndex = new Map(),
	stacks?: ReadonlyMap<string, number>
): { cooldown: number; duration: number; summonActivatesAt: number } {
	const cooldown = applyModifiers(
		variant?.cooldown ?? ability.cooldown,
		variant?.cooldownModifiers ?? ability.cooldownModifiers,
		DEFAULT_ASCENSION,
		resolvedStates,
		constellationLevel,
		chainIndex,
		stacks
	);
	const { duration: baseDur, modifiers: durMods } = resolveActiveDuration(ability, variant);
	const duration = applyModifiers(
		baseDur,
		durMods,
		DEFAULT_ASCENSION,
		resolvedStates,
		constellationLevel,
		chainIndex,
		stacks
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
function resolveActiveAbility<K extends Ability['abilityType']>(
	char: import('$lib/types/character').CharacterData,
	abilityType: K,
	resolvedStates: ReadonlySet<string>,
	constellationLevel = 0,
	chainIndex: ChainIndex = new Map(),
	stacks?: ReadonlyMap<string, number>
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
				stacks
			) === true
	);
	if (conditioned) return conditioned;
	// Fall back to the unconditioned base ability.
	return candidates.find((a) => a.conditions === undefined);
}

// ---------------------------------------------------------------------------
// Bracket expansion
// ---------------------------------------------------------------------------

/**
 * Expands bracket repeat groups (e.g. '2[N5C]', '[N5C]x3') in an action-token
 * list into their constituent sub-tokens, repeated the specified number of
 * times. Range prefixes (e.g. '2-4[N5C]') use the lower bound.
 *
 * The character-name token must NOT be included in the input — pass
 * tokens.slice(1) from the segment. The returned array is a flat list of
 * action tokens ready for the main parser loop.
 *
 * Inner content is re-tokenized via a synthetic segment prefix ('_ ') so the
 * tokenizer does not treat the first action token as a character name.
 */
/** Hard cap on bracket repeat counts; real rotations stay in single digits. */
const MAX_BRACKET_REPEATS = 99;

function expandBrackets(tokens: Token[]): Token[] {
	const result: Token[] = [];
	for (const tok of tokens) {
		if (tok.kind !== 'label') {
			result.push(tok);
			continue;
		}
		const m = tok.text.match(/^(\d+(?:-\d+)?)?\[([^\]]*)\](?:x(\d+))?$/);
		if (!m) {
			result.push(tok);
			continue;
		}
		const inner = m[2].trim();
		if (!inner) continue;
		let count = 1;
		if (m[1])
			count = parseInt(m[1].split('-')[0]); // prefix, lower bound for ranges
		else if (m[3]) count = parseInt(m[3]); // x-suffix
		if (count < 1) continue;
		// Parsing runs synchronously per keystroke — an unbounded repeat count
		// (e.g. 999999999[N1C]) would freeze or OOM the tab.
		count = Math.min(count, MAX_BRACKET_REPEATS);
		// Re-tokenize inner content; skip the synthetic character-name token.
		const innerTokens = tokenizeNotation('_ ' + inner).slice(1);
		for (let rep = 0; rep < count; rep++) {
			result.push(...innerTokens);
		}
	}
	return result;
}

// ---------------------------------------------------------------------------
// Weapon cdReset helper
// ---------------------------------------------------------------------------

/**
 * Returns the effective proc cooldown (seconds) for the cdReset effect on the
 * character's equipped weapon, or null if none. Resolves ScaledValue using the
 * stored weaponRefinement (defaults to R1 when absent).
 */
function resolveScaledValue(v: number | ScaledValue, refinementIndex: number): number {
	if (typeof v === 'number') return v;
	return v.refinementValues[refinementIndex];
}

function getWeaponCdResetCooldown(
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
	return resolveScaledValue(effect.procCooldown, refinementIndex);
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
function getCharacterCdResetTargets(
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

// ---------------------------------------------------------------------------
// Summon resolution (for the P4 summon-window pass)
// ---------------------------------------------------------------------------

/**
 * Resolves the summon owned by a given E/Q cast bar (variant-aware). Mirrors
 * `findCastSummon` in `summonSubrows.ts` exactly — the parser now authors the
 * summon `TimelineWindow`s the renderer used to reconstruct, so the spawn/end
 * resolution must agree. Uses the UNCONDITIONED base ability (stance-conditioned
 * variants represent caster state and don't carry summons). Kept parser-side
 * (not imported from summonSubrows) to preserve the parser's runtime-import-free
 * purity — summonSubrows imports back from here.
 */
function findSummonForBar(
	char: CharacterData | undefined,
	kind: 'skill' | 'burst',
	label: string
): Summon | undefined {
	if (!char) return undefined;
	const candidates = char.abilities.filter((a): a is CastAbility => a.abilityType === kind);
	const ability = candidates.find((a) => a.conditions === undefined) ?? candidates[0];
	if (!ability) return undefined;
	const variant = ability.variants?.find((v) => (v.input as string[] | undefined)?.includes(label));
	return variant?.summons?.[0] ?? ability.summons?.[0];
}

// ---------------------------------------------------------------------------
// gainStacks dispatch (E3 v1)
// ---------------------------------------------------------------------------

/**
 * Walks the character's `gainStacks` effects (on abilities + passives +
 * constellations) and applies stack grants matching the given cast event.
 * Mutates `stackState` in place; cap is saturating per `effect.max`. When the
 * fired effect carries a `drain` field (E3 v2), `drainLastUpdate` is anchored
 * to the cast time so subsequent applyDrain calls measure decay from this
 * grant onward — covers the "cast both opens the state and seeds the resource"
 * shape (Iansan E grants 54 NS and opens NS Blessing in the same cast).
 *
 * Trigger matching mirrors `getCharacterEffectsForCast` in the renderer:
 *   - `trigger.type` must be `'onCast'`.
 *   - If `trigger.ability` is set, it must equal `castType`.
 *   - If absent and the source is skill/burst, the source's own abilityType
 *     is the implicit binding.
 *   - If absent on a passive/constellation, the effect fires on either cast.
 *
 * Effect-level `conditions` are honored via `evalCondition` (so constellation
 * gating, faction conditions, etc. all flow through the same path). Stack
 * conditions on a `gainStacks` effect read pre-grant state — accrual that
 * gates on its own resource counter would be circular and is not a v1 case.
 *
 * v1 supports onCast triggers only. onReaction / onHit triggers are
 * schema-accepted but skipped here (curator notes flag the gap on affected
 * characters until E3 v1.5 / v2 lands).
 */
function dispatchGainStacks(
	char: CharacterData,
	castType: 'skill' | 'burst',
	castTime: number,
	resolvedStates: ReadonlySet<string>,
	constellationLevel: number,
	chainIdx: ChainIndex,
	stackState: Map<string, number>,
	drainLastUpdate: Map<string, number> | undefined,
	castInput?: string,
	stackInstances?: Map<string, number[]>
): void {
	const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.type !== 'gainStacks') continue;
			if (fx.trigger.type !== 'onCast') continue;
			const explicit = fx.trigger.ability;
			if (explicit !== undefined) {
				if (explicit !== castType) continue;
			} else if (src.abilityType === 'skill' || src.abilityType === 'burst') {
				if (src.abilityType !== castType) continue;
			}
			// E3 v2.x cast-input filter: when the trigger lists `input` tokens,
			// the cast's text must match one of them. Skirk uses this to grant
			// 45 SS on Tap-E and 18 SS on Hold-E from two effects on the same
			// skill. When `input` is absent, the trigger fires on every cast of
			// the matching ability type (the existing default behavior).
			if (fx.trigger.input && fx.trigger.input.length > 0) {
				if (castInput === undefined || !fx.trigger.input.includes(castInput)) continue;
			}
			// passive/constellation with no explicit ability → fire on both casts
			const condResult = evalCondition(
				fx.conditions,
				DEFAULT_ASCENSION,
				resolvedStates,
				constellationLevel,
				chainIdx,
				stackState
			);
			if (condResult !== true) continue;
			// E3 v2.x constellationScaling: when the override condition holds
			// definitively, replace the base amount for this dispatch. Mirrors
			// BuffEffect.constellationScaling — see Linnea C6 (6 → 18 per E).
			let effAmount = fx.amount;
			if (fx.constellationScaling) {
				const csResult = evalCondition(
					fx.constellationScaling.conditions,
					DEFAULT_ASCENSION,
					resolvedStates,
					constellationLevel,
					chainIdx,
					stackState
				);
				if (csResult === true) effAmount = fx.constellationScaling.amount;
			}
			if (fx.lifetime !== undefined && stackInstances) {
				// E3 v2.x lifetime: each granted instance lives independently
				// for `lifetime` seconds. Append `amount` instances all at the
				// same expiry-time (cast time + lifetime). Saturation drops
				// oldest first when total would exceed `max`.
				const expiry = castTime + fx.lifetime;
				const instances = stackInstances.get(fx.key) ?? [];
				for (let i = 0; i < effAmount; i++) instances.push(expiry);
				if (fx.max !== undefined && instances.length > fx.max) {
					instances.splice(0, instances.length - fx.max);
				}
				stackInstances.set(fx.key, instances);
				stackState.set(fx.key, instances.length);
			} else {
				const current = stackState.get(fx.key) ?? 0;
				const next = current + effAmount;
				const capped = fx.max !== undefined ? Math.min(next, fx.max) : next;
				stackState.set(fx.key, capped);
			}
			if (fx.drain && drainLastUpdate) drainLastUpdate.set(fx.key, castTime);
		}
	}
}

/**
 * Walks the character's `consumeStacks` effects and decrements stack counts at
 * matching cast events. Mirrors `dispatchGainStacks` (gate by `trigger.type`,
 * `trigger.ability`, `trigger.input`, and effect `conditions`) but subtracts
 * instead of adds. Saturates at 0; `amount: 'all'` zeroes the key regardless of
 * the current count.
 *
 * Called AFTER the cast's `stackContext` snapshot is taken — the bar's
 * stackContext reflects the pre-consume value (which is what the `perStack`
 * BuffValue consumer needs to compute its bonus); subsequent cursor advances
 * see the post-consume `stackState`. Drain anchors are NOT cleared on consume:
 * when the resource immediately re-grows via gainStacks the prior anchor is
 * still meaningful, and when it stays at 0 the saturation clause in `applyDrain`
 * keeps the value pinned.
 */
function dispatchConsumeStacks(
	char: CharacterData,
	castType: 'skill' | 'burst',
	resolvedStates: ReadonlySet<string>,
	constellationLevel: number,
	chainIdx: ChainIndex,
	stackState: Map<string, number>,
	castInput?: string,
	stackInstances?: Map<string, number[]>
): void {
	const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.type !== 'consumeStacks') continue;
			if (fx.trigger.type !== 'onCast') continue;
			const explicit = fx.trigger.ability;
			if (explicit !== undefined) {
				if (explicit !== castType) continue;
			} else if (src.abilityType === 'skill' || src.abilityType === 'burst') {
				if (src.abilityType !== castType) continue;
			}
			if (fx.trigger.input && fx.trigger.input.length > 0) {
				if (castInput === undefined || !fx.trigger.input.includes(castInput)) continue;
			}
			const condResult = evalCondition(
				fx.conditions,
				DEFAULT_ASCENSION,
				resolvedStates,
				constellationLevel,
				chainIdx,
				stackState
			);
			if (condResult !== true) continue;
			if (fx.amount === 'all') {
				stackState.set(fx.key, 0);
				stackInstances?.delete(fx.key);
			} else {
				const current = stackState.get(fx.key) ?? 0;
				stackState.set(fx.key, Math.max(0, current - fx.amount));
				const instances = stackInstances?.get(fx.key);
				if (instances && instances.length > 0) {
					instances.splice(0, Math.min(fx.amount, instances.length));
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Synthetic reaction emission (E3 v1.5 — cast-only optimistic model)
// ---------------------------------------------------------------------------
//
// The planner does not simulate elemental gauge / aura state at gcsim fidelity
// (per "windows not gauges" constitution). Instead, v1.5 emits typed reactions
// at each E/Q cast based on the character's element + a coarse rotation-wide
// aura state. The emitted reactions feed the `onReaction` triggers on
// `gainStacks` effects and `durationExtensions[]` entries.
//
// Aura state simplifications vs. KQM Elemental Gauge Theory:
//   - No durability/decay: applied auras stick indefinitely.
//   - No reaction-specific GCDs (Crystallize 1s, Swirl 0.5s ICD, etc.).
//   - Anemo and Geo do NOT consume aura (KQM: anemo spreads/doesn't clear;
//     geo's partial reduce is approximated as no-consume).
//   - PHEC casts consume opposing PHEC and apply own element (default rule),
//     with explicit special cases for EC coexistence, Bloom (push core),
//     Burning (compound aura), Quicken (compound aura), and Hyperbloom/
//     Burgeon (consume core).
//   - No element-absorption tracking (Kazuha-shape characters use their own
//     element; absorbed elements are deferred to a future P4 expansion).
//   - No infusion / per-N-hit emission. Cast-only.
//
// Cold-start emerges naturally: the first cast sees an empty aura set and
// emits no reactions; only the LATER casts (after some applicator has fired)
// react. Anemo→Anemo→Anemo all emit zero reactions if no PHEC/dendro
// applicator preceded them.

type AuraState = {
	/** Currently-applied 5-element auras. Anemo and Geo are not aura-applying. */
	applied: Set<AuraElement>;
	/** Burning compound aura — pyro+dendro coexisting. Acts as both. */
	burning: boolean;
	/** Quickened compound aura — dendro+electro coexisting. Acts as both. */
	quickened: boolean;
	/** Count of dendro cores on field (consumed by hyperbloom/burgeon). */
	bloomCores: number;
};

function createAuraState(): AuraState {
	return { applied: new Set(), burning: false, quickened: false, bloomCores: 0 };
}

/** Returns the typed reactions a cast of `element` plausibly triggers given the
 *  current aura state. Optimistic: any opposing aura makes the matching reaction
 *  eligible. The consumer's `trigger.reaction` filter narrows further at
 *  dispatch time. `hasMoonsignTeam` enables `lunarCrystallize` emission for
 *  geo casts (gating: 2+ Moonsign on team).
 *
 *  Returns `Reaction` keys matching `src/lib/types/ability.ts`:
 *  swirl, crystallize, lunarCrystallize, vaporize, melt, overloaded, burning,
 *  bloom, electroCharged, frozen, superConduct, quicken, aggravate,
 *  hyperbloom, burgeon, spread. Note: lunarBloom and lunarCharged are
 *  schema-supported but not yet emitted (no character authoring needs them
 *  via the synthetic emission path; deferred to manual triggers / future
 *  Moonsign reaction surface). */
function computeReactionsForCast(
	element: Element,
	aura: AuraState,
	hasMoonsignTeam: boolean
): Reaction[] {
	const reactions: Reaction[] = [];
	const has = (e: AuraElement) => aura.applied.has(e);

	switch (element) {
		case 'anemo':
			// Shape A (2026-05-14): emit element-specific swirl variants only.
			// The broad `'swirl'` key was retired so the schema matches in-game
			// React() ontology — pyroSwirl / hydroSwirl / cryoSwirl /
			// electroSwirl are distinct reactions. Existing consumers
			// (Mizuki A1, Kazuha A4, Sucrose A4, VV 4pc) author OR-arrays
			// matching all four variants when they need the "any swirl" effect.
			if (has('pyro')) reactions.push('pyroSwirl');
			if (has('hydro')) reactions.push('hydroSwirl');
			if (has('cryo')) reactions.push('cryoSwirl');
			if (has('electro')) reactions.push('electroSwirl');
			break;
		case 'geo':
			if (has('pyro')) reactions.push('pyroCrystallize');
			if (has('hydro')) reactions.push('hydroCrystallize');
			if (has('cryo')) reactions.push('cryoCrystallize');
			if (has('electro')) reactions.push('electroCrystallize');
			if (hasMoonsignTeam && (has('pyro') || has('hydro') || has('cryo') || has('electro')))
				reactions.push('lunarCrystallize');
			break;
		case 'pyro':
			if (has('hydro')) reactions.push('vaporize');
			if (has('cryo')) reactions.push('melt');
			if (has('electro')) reactions.push('overloaded');
			if (has('dendro')) reactions.push('burning');
			if (aura.bloomCores > 0) reactions.push('burgeon');
			break;
		case 'hydro':
			if (has('pyro')) reactions.push('vaporize');
			if (has('cryo')) reactions.push('frozen');
			if (has('electro')) reactions.push('electroCharged');
			if (has('dendro') || aura.quickened) reactions.push('bloom');
			break;
		case 'cryo':
			if (has('pyro')) reactions.push('melt');
			if (has('hydro')) reactions.push('frozen');
			if (has('electro')) reactions.push('superConduct');
			break;
		case 'electro':
			if (has('pyro')) reactions.push('overloaded');
			if (has('hydro')) reactions.push('electroCharged');
			if (has('cryo')) reactions.push('superConduct');
			if (has('dendro')) reactions.push('quicken');
			if (aura.quickened) reactions.push('aggravate');
			if (aura.bloomCores > 0) reactions.push('hyperbloom');
			break;
		case 'dendro':
			if (has('pyro')) reactions.push('burning');
			if (has('hydro')) reactions.push('bloom');
			if (has('electro')) reactions.push('quicken');
			if (aura.quickened) reactions.push('spread');
			break;
		case 'physical':
			// No reaction emission for physical casts (no character has
			// physical as element today; included for type completeness).
			break;
	}
	return reactions;
}

/** Mutates `aura` in place to reflect the post-cast state. Anemo and Geo are
 *  no-ops (they don't apply or consume aura in our simplified model). PHEC and
 *  dendro casts apply consumption rules in priority order: bloom-core ops →
 *  bloom formation → burning compound → quicken compound → EC coexistence →
 *  default opposing-PHEC consumption. */
function updateAuraStateAfterCast(element: Element, aura: AuraState): void {
	if (element === 'anemo' || element === 'geo' || element === 'physical') return;

	// Bloom-core consumption: electro → hyperbloom; pyro → burgeon. Consumes
	// one core; otherwise behaves like a normal aura application.
	if ((element === 'electro' || element === 'pyro') && aura.bloomCores > 0) {
		aura.bloomCores -= 1;
		// Fall through to default to also apply own element / clear opposing.
	}

	// Bloom: hydro + dendro → consume both, push core.
	if (element === 'hydro' && aura.applied.has('dendro')) {
		aura.applied.delete('dendro');
		aura.bloomCores += 1;
		// hydro is consumed in the reaction; do not add it to applied.
		return;
	}
	if (element === 'dendro' && aura.applied.has('hydro')) {
		aura.applied.delete('hydro');
		aura.bloomCores += 1;
		return;
	}

	// Burning: pyro + dendro → set compound flag; both elements remain present
	// (burning aura acts as pyro for future reactions, with underlying dendro).
	if (element === 'pyro' && aura.applied.has('dendro')) {
		aura.burning = true;
		aura.applied.add('pyro');
		return;
	}
	if (element === 'dendro' && aura.applied.has('pyro')) {
		aura.burning = true;
		aura.applied.add('dendro');
		return;
	}

	// Quicken: dendro + electro → set compound flag; both elements remain
	// (quicken aura coexists with dendro/electro/cryo per KQM).
	if (element === 'dendro' && aura.applied.has('electro')) {
		aura.quickened = true;
		aura.applied.add('dendro');
		return;
	}
	if (element === 'electro' && aura.applied.has('dendro')) {
		aura.quickened = true;
		aura.applied.add('electro');
		return;
	}

	// EC coexistence: hydro + electro → both auras stay.
	if (element === 'hydro' && aura.applied.has('electro')) {
		aura.applied.add('hydro');
		return;
	}
	if (element === 'electro' && aura.applied.has('hydro')) {
		aura.applied.add('electro');
		return;
	}

	// Default PHEC: cast clears opposing PHEC, applies own.
	const opposingMap: Partial<Record<Element, AuraElement[]>> = {
		pyro: ['hydro', 'cryo', 'electro'],
		hydro: ['pyro', 'cryo'],
		cryo: ['pyro', 'hydro', 'electro'],
		electro: ['pyro', 'cryo'],
		dendro: []
	};
	for (const opp of opposingMap[element] ?? []) {
		aura.applied.delete(opp);
	}
	aura.applied.add(element as AuraElement);
}

/** Fires `onReaction`-trigger duration extensions on the currently-active
 *  stance window for the given character, against the synthetic reaction
 *  event. Mirrors `dispatchOnCastExtensions` for onCast. Trigger matching:
 *  `trigger.reaction` may be a single Reaction, an array, or "any". */
function reactionMatchesTrigger(
	emitted: Reaction,
	trigReaction: Reaction | Reaction[] | 'any'
): boolean {
	if (trigReaction === 'any') return true;
	if (Array.isArray(trigReaction)) return trigReaction.includes(emitted);
	return trigReaction === emitted;
}

// ---------------------------------------------------------------------------
// Per-character parser state
// ---------------------------------------------------------------------------
//
// `parseNotation` formerly threaded ~18 parallel `Map<charId, …>`s; the
// 2026-07-05 bug sweep showed order-of-operations across them was the parser's
// top bug class. `CharState` groups all of a character's mutable parser state
// behind one lookup (`getCharState`). Everything here persists across segments
// (cross-segment cooldown / stance / drain tracking). NB: E-charge queues stay
// keyed by ABILITY id — not folded in here — because stance characters keep
// independent charge queues per skill variant (see the eChargeQueues decl).

/** Active stance window for a character. Present iff a stance E/Q has ever been
 *  cast (never cleared — swap-close only clamps `end`, mirroring the old
 *  never-deleted `stanceWindows` entry). */
type StanceRecord = {
	/** Absolute window end (seconds). Extended by durationExtensions, clamped to
	 *  the swap-out time when the owner terminatesOnSwap. */
	end: number;
	/** Whether the window terminates on swap-out. Recorded at open time so
	 *  variant-driven stances close correctly. Set false after swap-close so a
	 *  later swap in a segment that never re-opened doesn't re-clamp (mirrors the
	 *  old `stanceTerminatesOnSwap.delete`). */
	terminatesOnSwap: boolean;
	/** Ability that opened the window; read for its durationExtensions[]. */
	ownerAbility: CastAbility;
	/** The cast event that opened the window (post-P4 #3: bars are projections
	 *  of cast events, so the finalize uptime stamp lands on the EVENT — the
	 *  projected bar inherits it). Not mutated during parsing: extension
	 *  dispatchers accumulate `ownerUptime`; the finalize pass stamps it back. */
	castRef: CastEvent;
	/** Character that owns the stance (for the `stance` TimelineWindow). */
	characterId: string;
	/** Absolute window start = cast start (for the `stance` TimelineWindow). */
	start: number;
	/** Which cast opened the window (skill/burst) — the window's `source`. */
	source: 'skill' | 'burst';
	/** Event id of the `cast` that opened the window (IR provenance). */
	sourceCastId: number;
	/** Accumulated owner-bar uptime: initial duration + fired extension deltas.
	 *  The finalize pass stamps `barRef.uptime = ownerUptime`. Distinct from
	 *  `end`, which is the (swap-clamped) gating end — a swap-terminated stance
	 *  keeps its full owner-bar width while `end` clamps to the swap-out time. */
	ownerUptime: number;
	/** Per-durationExtensions[]-index fire counts (reset each window open). */
	extCounts: Map<number, number>;
	/** Per-durationExtensions[]-index last-fire cursor (reset each window open). */
	extLastFire: Map<number, number>;
};

/** Active summon-bound durationExtensions[] owner (E3 v1.5). Registered when a
 *  cast spawns a summon carrying extensions (Collei A4). Replaced per matching
 *  cast; skipped once `endTime` is in the past. */
type SummonExtRecord = {
	endTime: number;
	extensions: DurationExtension[];
	/** The cast event that spawned the extension-bearing summon; the finalize
	 *  pass stamps `castRef.uptime = ownerUptime` before bars are projected. */
	castRef: CastEvent;
	/** Accumulated owner uptime (initial duration + fired extension deltas);
	 *  stamped onto the cast event at finalize (P4 — replaces the old live
	 *  `bar.uptime += delta` back-channel). */
	ownerUptime: number;
	counts: Map<number, number>;
	lastFires: Map<number, number>;
};

type CharState = {
	/** Per-character burst cooldown clock (absolute time). `-Infinity` = never
	 *  cast (treated as "no gate" via the isFinite check at the Q handler top). */
	qReadyAt: number;
	/** Weapon cdReset (Sacrificial series) proc-ready clock: when the proc ICD
	 *  expires and it can fire again. 0 = ready. */
	sacProcReadyAt: number;
	/** Open stance window, or undefined if none has ever opened. */
	stance?: StanceRecord;
	/** Named state windows opened by stance abilities with `opensState`
	 *  (e.g. nightsoulBlessing) or by the transient-state primitive
	 *  (symphonyWindow, apexDrive). state key → absolute end time. */
	states: Map<string, number>;
	/** Transient states flagged `terminatesOnSwap` — clamped to the swap-out
	 *  time at segment end, independently of any stance window (a stance's own
	 *  terminatesOnSwap clamp covers its opensState companion separately). */
	statesTerminatingOnSwap: Set<string>;
	/** Skill/burst chain-stage positions (Diluc E1→E2→E3). */
	chains: Map<'skill' | 'burst', { index: number; expiresAt: number }>;
	/** Active summon-extension owner, or undefined. */
	summonExt?: SummonExtRecord;
	/** Pending shield-end records, sorted by `endTime` ascending; drained at each
	 *  cast and at rotation end. */
	shields: { ability: 'skill' | 'burst'; endTime: number }[];
	/** Per-onShieldEnd-effect proc cooldown: `${nodeId}#${effectIndex}` → last
	 *  fire time (Kachina C6 "once every 5s"). */
	shieldEndProcCooldown: Map<string, number>;
	/** onReaction gainStacks accrual (rotation-wide, off-field-inclusive):
	 *  key → stack count. */
	onReactionStacks: Map<string, number>;
	/** Per-instance expiry stamps for lifetime-bearing onReaction grants:
	 *  key → expiry times. */
	onReactionStackInstances: Map<string, number[]>;
	/** onHit gainStacks per-source slot expiry (Skirk A4): key → sourceCharId →
	 *  expiry time. */
	sourceLifetime: Map<string, Map<string, number>>;
	/** Drain-anchor timestamps (E3 v2): drain-bearing gainStacks key → time decay
	 *  was last applied. */
	drainAnchors: Map<string, number>;
};

/** Dispatches a single emitted Reaction to all team characters' `gainStacks`
 *  effects with onReaction triggers, mutating rotation-wide accumulator maps.
 *
 *  Rotation-wide state (vs. per-segment) is required because Neuvillette A1
 *  Past Draconic Glories accrues stacks while the holder is off-field — a
 *  teammate's reaction in the holder's absent segment must persist to the
 *  holder's next on-field segment. Mirrors the `sourceLifetimeState` shape
 *  used by `dispatchGainStacksOnHit`, but with a simpler stack-count map
 *  (no per-source slot tracking — onReaction accrual doesn't refresh by
 *  contributor identity).
 *
 *  Source semantics:
 *    - `'self'` (default) — fires only when the reaction's emitter IS the
 *      effect holder (Kazuha A4: only Kazuha's own swirls).
 *    - `'team'` — fires for any team member's matching reaction including
 *      the holder (Neuvillette A1: "When a party member triggers...").
 *
 *  Lifetime branch: when `fx.lifetime` is set, each granted instance lives
 *  independently for `lifetime` seconds. Appends `amount` expiry stamps to
 *  the holder's per-key instance list; saturation at `max` drops oldest
 *  first. Stack count is synced to the unexpired instance count.
 *
 *  Non-lifetime branch: simple saturating increment on the holder's stack
 *  count (matches the onCast variant's bare path).
 *
 *  Drain anchoring: parallel to the onCast variant. No onReaction-drain
 *  combination is authored as of 2026-05-14, but the hook stays here so
 *  future authors get consistent decay semantics regardless of trigger. */
function dispatchGainStacksOnReaction(
	allChars: CharacterData[],
	triggerCharId: string,
	emittedReaction: Reaction,
	castTime: number,
	resolvedStatesByHolder: Map<string, ReadonlySet<string>>,
	constellationByHolder: Map<string, number>,
	getCharState: (charId: string) => CharState
): void {
	for (const holder of allChars) {
		const sources = [
			...holder.abilities,
			...(holder.passives ?? []),
			...(holder.constellations ?? [])
		];
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.type !== 'gainStacks') continue;
				if (fx.trigger.type !== 'onReaction') continue;
				const srcMode = fx.trigger.source ?? 'self';
				if (srcMode === 'self' && holder.id !== triggerCharId) continue;
				if (!reactionMatchesTrigger(emittedReaction, fx.trigger.reaction)) continue;
				const holderStates = resolvedStatesByHolder.get(holder.id) ?? new Set<string>();
				const holderCons = constellationByHolder.get(holder.id) ?? 0;
				const condResult = evalCondition(
					fx.conditions,
					DEFAULT_ASCENSION,
					holderStates,
					holderCons,
					new Map(),
					undefined
				);
				if (condResult !== true) continue;
				let effAmount = fx.amount;
				if (fx.constellationScaling) {
					const csResult = evalCondition(
						fx.constellationScaling.conditions,
						DEFAULT_ASCENSION,
						holderStates,
						holderCons,
						new Map(),
						undefined
					);
					if (csResult === true) effAmount = fx.constellationScaling.amount;
				}
				const hcs = getCharState(holder.id);
				const holderState = hcs.onReactionStacks;
				if (fx.lifetime !== undefined) {
					const expiry = castTime + fx.lifetime;
					const holderInstances = hcs.onReactionStackInstances;
					const instances = holderInstances.get(fx.key) ?? [];
					for (let i = 0; i < effAmount; i++) instances.push(expiry);
					if (fx.max !== undefined && instances.length > fx.max) {
						instances.splice(0, instances.length - fx.max);
					}
					holderInstances.set(fx.key, instances);
					holderState.set(fx.key, instances.length);
				} else {
					const current = holderState.get(fx.key) ?? 0;
					const next = current + effAmount;
					const capped = fx.max !== undefined ? Math.min(next, fx.max) : next;
					holderState.set(fx.key, capped);
				}
				if (fx.drain) {
					hcs.drainAnchors.set(fx.key, castTime);
				}
			}
		}
	}
}

/** Syncs the holder's per-segment `stackState` (and `stackInstances` for
 *  lifetime-bearing keys) from the rotation-wide onReaction accumulator
 *  maps. Drops expired instances lazily, then writes the unexpired count
 *  to `stackState[key]`. Called at the start of each cast handler so
 *  downstream `stacks` Conditions evaluate uniformly against pre-cast
 *  state — mirrors `syncSourceLifetimeToStackState` for the onReaction
 *  variant. */
function syncOnReactionToStackState(
	holder: CharacterData,
	currentTime: number,
	stackState: Map<string, number>,
	stackInstances: Map<string, number[]>,
	getCharState: (charId: string) => CharState
): void {
	const sources = [
		...holder.abilities,
		...(holder.passives ?? []),
		...(holder.constellations ?? [])
	];
	const keysOnReaction = new Map<string, { lifetime: boolean }>();
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.type !== 'gainStacks') continue;
			if (fx.trigger.type !== 'onReaction') continue;
			if (keysOnReaction.has(fx.key)) continue;
			keysOnReaction.set(fx.key, { lifetime: fx.lifetime !== undefined });
		}
	}
	if (keysOnReaction.size === 0) return;
	const hcs = getCharState(holder.id);
	const holderInstances = hcs.onReactionStackInstances;
	const holderState = hcs.onReactionStacks;
	for (const [key, meta] of keysOnReaction) {
		if (meta.lifetime && holderInstances) {
			const instances = holderInstances.get(key);
			if (!instances || instances.length === 0) {
				stackState.set(key, 0);
				stackInstances.set(key, []);
				if (holderState) holderState.set(key, 0);
				continue;
			}
			const remaining = instances.filter((exp) => exp > currentTime);
			if (remaining.length !== instances.length) {
				holderInstances.set(key, remaining);
				if (holderState) holderState.set(key, remaining.length);
			}
			stackState.set(key, remaining.length);
			stackInstances.set(key, [...remaining]);
		} else if (holderState && holderState.has(key)) {
			stackState.set(key, holderState.get(key)!);
		} else {
			stackState.set(key, 0);
		}
	}
}

/** Dispatches a single `HitEvent` to all team characters' `gainStacks` effects
 *  with onHit triggers, updating per-source slot expiry maps when the trigger's
 *  source / element / abilityType filters all match. Mutates `sourceLifetimeState`
 *  in place; saturation drops the entry with the earliest expiry when the new
 *  slot count exceeds `max`.
 *
 *  Source semantics:
 *    - `'self'` (default) — fires only when the hit caster IS the effect holder
 *    - `'team'` — fires for any caster including the holder
 *    - `'others'` — fires for any caster EXCEPT the holder (Skirk A4 excludes
 *      her own Cryo hits from Death's Crossing)
 *
 *  Currently only handles `sourceLifetime`-bearing grants — bare onHit
 *  gainStacks (no decay shape) is rejected at lint time since the rotation-
 *  wide accumulation without expiry is unbounded.
 */
function dispatchGainStacksOnHit(
	allChars: CharacterData[],
	hit: HitEvent,
	resolvedStatesByHolder: Map<string, ReadonlySet<string>>,
	constellationByHolder: Map<string, number>,
	getCharState: (charId: string) => CharState
): void {
	for (const holder of allChars) {
		const sources = [
			...holder.abilities,
			...(holder.passives ?? []),
			...(holder.constellations ?? [])
		];
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.type !== 'gainStacks') continue;
				if (fx.trigger.type !== 'onHit') continue;
				// source filter
				const srcMode = fx.trigger.source ?? 'self';
				if (srcMode === 'self' && holder.id !== hit.characterId) continue;
				if (srcMode === 'others' && holder.id === hit.characterId) continue;
				// element / abilityType / damageType filters
				if (
					fx.trigger.abilityType !== undefined &&
					fx.trigger.abilityType !== hit.castKind &&
					// castKind is skill | burst; abilityType filter accepting normal/charged/plunge
					// is a no-op for v1 (per-cast hits are skill/burst only)
					!(fx.trigger.abilityType === 'skill' && hit.castKind === 'skill') &&
					!(fx.trigger.abilityType === 'burst' && hit.castKind === 'burst')
				)
					continue;
				if (fx.trigger.filter?.element !== undefined && fx.trigger.filter.element !== hit.element)
					continue;
				// effect-level conditions (ascension, constellation, etc.)
				const holderStates = resolvedStatesByHolder.get(holder.id) ?? new Set<string>();
				const holderCons = constellationByHolder.get(holder.id) ?? 0;
				const condResult = evalCondition(
					fx.conditions,
					DEFAULT_ASCENSION,
					holderStates,
					holderCons,
					new Map(),
					undefined
				);
				if (condResult !== true) continue;
				if (fx.sourceLifetime === undefined) continue; // v1: only sourceLifetime-bearing
				// update per-source slot
				const charMap = getCharState(holder.id).sourceLifetime;
				const keyMap = charMap.get(fx.key) ?? new Map<string, number>();
				if (!charMap.has(fx.key)) charMap.set(fx.key, keyMap);
				const expiry = hit.time + fx.sourceLifetime;
				keyMap.set(hit.characterId, expiry);
				// saturate at max: drop earliest-expiry entries until size <= max
				if (fx.max !== undefined && keyMap.size > fx.max) {
					const sorted = [...keyMap.entries()].sort((a, b) => a[1] - b[1]);
					while (sorted.length > fx.max) {
						const [oldestSrc] = sorted.shift()!;
						keyMap.delete(oldestSrc);
					}
				}
			}
		}
	}
}

/** Syncs the holder's per-segment `stackState` from `sourceLifetimeState` for
 *  any of the holder's `gainStacks` effects that declare `sourceLifetime`.
 *  Drops expired entries lazily, then writes the unexpired slot count to
 *  `stackState[key]`. Called at the start of each cast handler so downstream
 *  `stacks` Conditions evaluate uniformly against pre-cast state. */
function syncSourceLifetimeToStackState(
	holder: CharacterData,
	currentTime: number,
	stackState: Map<string, number>,
	getCharState: (charId: string) => CharState
): void {
	// getCharState always yields a (possibly empty) sourceLifetime map; an empty
	// one means this holder never received an onHit grant — the old `!charMap`
	// early-return. Guard on `.size === 0` to preserve it: charMap is only ever
	// populated (never emptied back to 0) once a grant fires, so size 0 ⟺ absent.
	const charMap = getCharState(holder.id).sourceLifetime;
	if (charMap.size === 0) return;
	const sources = [
		...holder.abilities,
		...(holder.passives ?? []),
		...(holder.constellations ?? [])
	];
	const keysWithSourceLifetime = new Set<string>();
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.type !== 'gainStacks') continue;
			if (fx.sourceLifetime === undefined) continue;
			keysWithSourceLifetime.add(fx.key);
		}
	}
	for (const key of keysWithSourceLifetime) {
		const keyMap = charMap.get(key);
		if (!keyMap) {
			stackState.set(key, 0);
			continue;
		}
		// drop expired
		for (const [src, expiry] of [...keyMap.entries()]) {
			if (expiry <= currentTime) keyMap.delete(src);
		}
		stackState.set(key, keyMap.size);
	}
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseNotation(
	notation: string,
	lookupChar: (name: string) => CharacterData | null,
	swapFrames = 8,
	constellationLevels?: Record<string, number>,
	loadoutMap?: Record<string, LoadoutEntry>
): ParsedRotation {
	const swapS = swapFrames / 60;
	const raw = notation.trim();
	if (!raw)
		return {
			tracks: [],
			totalDuration: 0,
			unknownTokens: [],
			events: [],
			windows: []
		};

	// Tokenize the full string, then group into segments by separator tokens.
	const allTokens = tokenizeNotation(raw);

	const segments: (typeof allTokens)[] = [];
	let current: typeof allTokens = [];
	for (const tok of allTokens) {
		if (tok.kind === 'separator') {
			if (current.length > 0) segments.push(current);
			current = [];
		} else {
			current.push(tok);
		}
	}
	if (current.length > 0) segments.push(current);

	const tracks: CharacterTrack[] = [];
	const unknownTokens: string[] = [];

	// P4 IR — the single event stream. `cast` events are pushed at each E/Q bar
	// push; `reaction`/`shieldEnd` events are emitted at their sites.
	// Sorted by time before return.
	const events: TimelineEvent[] = [];
	// Stable per-parse event ids, assigned in emission order (deterministic for
	// a given notation). Window records capture the opening cast's id as their
	// `sourceCastId` provenance.
	let nextEventId = 0;

	// P4 IR — window-record collectors. Each grows a mutable record during
	// parsing (extensions move `end`, swap-close clamps it); the finalize pass
	// converts them to `TimelineWindow`s. Kept separate from the CharState maps
	// (which are replaced per cast) so EVERY opened window is retained.
	const stanceWindowRecs: StanceRecord[] = [];
	const summonExtRecs: SummonExtRecord[] = [];
	const stateWindowRecs: {
		characterId: string;
		name: string;
		start: number;
		end: number;
		/** Absent only for windows not opened by an E/Q cast (plunge-opened
		 *  transient states — Varesa Apex Drive). */
		sourceCastId?: number;
	}[] = [];
	const shieldWindowRecs: {
		characterId: string;
		source: 'skill' | 'burst';
		start: number;
		end: number;
		sourceCastId: number;
	}[] = [];
	// Post-P4 #3: bars are PROJECTIONS of cast events, built at finalize. Each
	// cast records its owning track here (in emission order); the finalize pass
	// projects `track.eBars`/`track.qBars` from these records after the
	// extension uptime stamps land on the events.
	const castRecords: { ev: CastEvent; track: CharacterTrack }[] = [];
	// Post-P4 #2: action events (normal/charged/plunge/dash/jump/unset) with
	// their owning track, in emission order. The finalize pass projects
	// `track.inputBlocks` from these records (grouped by `blockId`) together
	// with the cast records.
	const actionRecords: { ev: ActionEvent; track: CharacterTrack }[] = [];
	// Per-character cast events emitted so far — the mid-parse record that
	// `computeCurrentStates` reads for duringSummon detection (replaces the old
	// prevBars/track-bars walk).
	const castsByChar = new Map<string, CastEvent[]>();
	// Provenance for the finalize summon-window pass: each projected bar's
	// opening `cast` event id (bars and casts are 1:1 by construction).
	const castIdByBar = new Map<TimelineBar, number>();
	// Per-character parser state, created lazily. Folds together the formerly-
	// parallel Map<charId, …>s (cooldown clocks, stance window, named states,
	// chains, shields, summon extensions, and the rotation-wide stack
	// accumulators) so a single lookup yields all of a character's mutable
	// parser state. Persists across segments (cross-segment cooldown / stance /
	// shield-end / drain tracking). See the CharState decl for per-field scope.
	const charStates = new Map<string, CharState>();
	const getCharState = (charId: string): CharState => {
		let cs = charStates.get(charId);
		if (!cs) {
			cs = {
				qReadyAt: -Infinity,
				sacProcReadyAt: 0,
				states: new Map(),
				statesTerminatingOnSwap: new Set(),
				chains: new Map(),
				shields: [],
				shieldEndProcCooldown: new Map(),
				onReactionStacks: new Map(),
				onReactionStackInstances: new Map(),
				sourceLifetime: new Map(),
				drainAnchors: new Map()
			};
			charStates.set(charId, cs);
		}
		return cs;
	};
	let cursor = 0; // rotation clock (seconds)

	// E3 v1.5 — rotation-wide aura state for synthetic reaction emission.
	// Persists across segments: once applied, auras stick (no decay) until
	// consumed by a reaction. Anemo/Geo casts never modify this state.
	const auraState = createAuraState();

	// Compute team Moonsign membership once: 2+ Moonsign chars enables
	// `lunarCrystallize` emission on geo casts (per Linnea/Lauma/Flins family
	// of effects). Walks all unique character IDs across segments.
	const seenChars = new Set<string>();
	const teamChars: CharacterData[] = [];
	let moonsignCount = 0;
	for (const seg of segments) {
		const charTok = seg[0];
		if (!charTok || charTok.kind !== 'character') continue;
		const c = lookupChar(charTok.text);
		if (!c) continue;
		if (seenChars.has(c.id)) continue;
		seenChars.add(c.id);
		teamChars.push(c);
		if ((c.factions ?? []).includes('moonsign')) moonsignCount++;
	}
	const hasMoonsignTeam = moonsignCount >= 2;

	// Team context for variant-condition resolution (sQ primitive): lets
	// `teamFaction` / `teamElementCount` conditions on ability VARIANTS resolve
	// definitively parser-side (Varka Four Winds' Ascension needs an elemental
	// teammate). Mirrors the renderer's per-holder maps: faction counts are
	// whole-team, element counts exclude the holder.
	const teamFactionCounts = computeTeamFactionCounts(teamChars);
	const teamElementCountsByHolder = new Map<string, Map<Element, number>>();
	for (const holder of teamChars) {
		const counts = new Map<Element, number>();
		for (const other of teamChars) {
			if (other.id === holder.id || !other.element) continue;
			counts.set(other.element, (counts.get(other.element) ?? 0) + 1);
		}
		teamElementCountsByHolder.set(holder.id, counts);
	}

	// E-charge queues. Keyed by ABILITY id (not character id): stance characters
	// keep independent charge queues per skill variant — Cyno's out-of-stance E
	// (7.5s CD) shares no cooldown with his in-stance Mortuary Rite (3s CD), so
	// folding this into the per-character CharState would wrongly merge them. The
	// uncurated fallback keys by bare charId. Each value is a sorted array of
	// "ready at" timestamps, one entry per charge (length = effective charge
	// count); picking queue[0] (earliest-ready) and re-sorting after each cast
	// models independent per-charge cooldowns — a new cast never cancels an
	// in-progress cooldown. Persists across segments (cross-segment CD enforcement:
	//   Bennett E > Xiangling Q > Bennett E → second E waits for the first's CD).
	// The per-character burst cooldown clock now lives on cs.qReadyAt.
	const eChargeQueues = new Map<string, number[]>();

	// Weapon cdReset (Sacrificial series) output: accumulated proc-ICD windows per
	// character for timeline rendering (with the proccing cast's id for IR
	// provenance). The proc-ready clock lives on cs.sacProcReadyAt.
	const weaponProcBars = new Map<string, (WeaponProcBar & { sourceCastId: number })[]>();

	// Per-character chain-stage lookup (skill/burst chains, e.g. Diluc E1→E2→E3),
	// backed by cs.chains. Each entry holds the *next* expected stage index plus
	// the absolute time after which the chain resets to 0. After firing a
	// non-terminal chainStage ability, advanceChain advances index and sets
	// expiresAt = now + window; firing the terminal stage deletes the entry.
	// (Stance windows, named states, and extension bookkeeping now live on
	// cs.stance / cs.states — see CharState.)
	const getChainIndexMap = (charId: string, cursor: number): Map<'skill' | 'burst', number> => {
		const result = new Map<'skill' | 'burst', number>();
		for (const [kind, pos] of getCharState(charId).chains) {
			if (pos.expiresAt > cursor) result.set(kind, pos.index);
		}
		return result;
	};
	const advanceChain = (
		ability: CastAbility,
		charId: string,
		kind: 'skill' | 'burst',
		cursor: number
	) => {
		const stage = findChainStage(ability.conditions);
		if (!stage) return;
		const charChain = getCharState(charId).chains;
		if (stage.window === undefined) {
			// Terminal stage: reset chain to index 0.
			charChain.delete(kind);
		} else {
			charChain.set(kind, { index: stage.index + 1, expiresAt: cursor + stage.window });
		}
	};

	/** Fires `onCast`-trigger duration extensions on the currently-active stance
	 *  window for the given character, against the cast event described by
	 *  `castType` at time `castTime`. Caller passes the pre-cast state snapshot
	 *  + per-character resolution context for evalCondition. Other trigger types
	 *  (onReaction, onHit, ...) are accepted in schema but not dispatched yet. */
	const dispatchOnCastExtensions = (
		charId: string,
		castType: 'skill' | 'burst',
		castTime: number,
		preStates: ReadonlySet<string>,
		constellation: number,
		chainIdx: ChainIndex,
		stacks: ReadonlyMap<string, number> | undefined
	): void => {
		// Gate on the window still being OPEN at cast time — cs.stance is
		// deliberately never cleared (swap-close only clamps `end`, for drain
		// settling), so presence alone would let a cast long after the stance
		// died retroactively extend the dead window. Mirrors the summon path's
		// `endTime > castTime` check.
		const st = getCharState(charId).stance;
		if (!st || st.end <= castTime) return;
		const exts = getDurationExtensions(st.ownerAbility);
		if (!exts || exts.length === 0) return;
		const counts = st.extCounts;
		const lastFires = st.extLastFire;
		for (let idx = 0; idx < exts.length; idx++) {
			const ext = exts[idx];
			if (ext.trigger.type !== 'onCast') continue;
			if (ext.trigger.ability !== undefined && ext.trigger.ability !== castType) continue;
			const condResult = evalCondition(
				ext.conditions,
				DEFAULT_ASCENSION,
				preStates,
				constellation,
				chainIdx,
				stacks
			);
			if (condResult !== true) continue;
			const used = counts.get(idx) ?? 0;
			if (ext.maxExtensions !== undefined && used >= ext.maxExtensions) continue;
			const lastFire = lastFires.get(idx) ?? -Infinity;
			if (ext.procCooldown !== undefined && castTime - lastFire < ext.procCooldown) continue;
			st.end += ext.delta;
			st.ownerUptime += ext.delta;
			counts.set(idx, used + 1);
			lastFires.set(idx, castTime);
		}
	};

	/** Fires `onReaction`-trigger duration extensions on the character's
	 *  currently-active stance window AND any active summon-bound
	 *  `durationExtensions[]`, against the synthetic reaction event. The
	 *  summon-extension path is needed for Collei A4 (Cuilein-Anbar zone) where
	 *  the extensions live on the burst's `summons[0].durationExtensions`
	 *  rather than a stance owner. */
	const dispatchOnReactionExtensions = (
		charId: string,
		emittedReaction: Reaction,
		castTime: number,
		preStates: ReadonlySet<string>,
		constellation: number,
		chainIdx: ChainIndex,
		stacks: ReadonlyMap<string, number> | undefined
	): void => {
		const dispatch = (
			extensions: DurationExtension[] | undefined,
			counts: Map<number, number> | undefined,
			lastFires: Map<number, number> | undefined,
			extendWindow: (delta: number) => void
		): void => {
			if (!extensions || extensions.length === 0 || !counts || !lastFires) return;
			for (let idx = 0; idx < extensions.length; idx++) {
				const ext = extensions[idx];
				if (ext.trigger.type !== 'onReaction') continue;
				if (!reactionMatchesTrigger(emittedReaction, ext.trigger.reaction)) continue;
				const condResult = evalCondition(
					ext.conditions,
					DEFAULT_ASCENSION,
					preStates,
					constellation,
					chainIdx,
					stacks
				);
				if (condResult !== true) continue;
				const used = counts.get(idx) ?? 0;
				if (ext.maxExtensions !== undefined && used >= ext.maxExtensions) continue;
				const lastFire = lastFires.get(idx) ?? -Infinity;
				if (ext.procCooldown !== undefined && castTime - lastFire < ext.procCooldown) continue;
				// extendWindow bumps both the gating end and the owner-bar uptime
				// accumulator (P4 — the owner bar is stamped at finalize, not here).
				extendWindow(ext.delta);
				counts.set(idx, used + 1);
				lastFires.set(idx, castTime);
			}
		};

		const cs = getCharState(charId);

		// Stance window: walk owner ability's durationExtensions[] (Mizuki A1
		// shape — extensions on the stance ability itself). Only while the
		// window is still open at cast time (never cleared), same gate as the
		// summon path below.
		const st = cs.stance;
		if (st && st.end > castTime) {
			dispatch(getDurationExtensions(st.ownerAbility), st.extCounts, st.extLastFire, (delta) => {
				st.end += delta;
				st.ownerUptime += delta;
			});
		}

		// Summon window: walk summons[0].durationExtensions[] when active
		// (Collei A4 shape — extensions on the burst's spawned summon).
		const summonOwner = cs.summonExt;
		if (summonOwner && summonOwner.endTime > castTime) {
			dispatch(summonOwner.extensions, summonOwner.counts, summonOwner.lastFires, (delta) => {
				summonOwner.endTime += delta;
				summonOwner.ownerUptime += delta;
			});
		}
	};

	/** Register a shield window when the active cast spawns a shield. Two
	 *  authoring conventions covered:
	 *    1. Ability has `tags: ['shield']` AND `summons[0]` — the primary
	 *       summon's duration IS the shield duration (Noelle Breastplate,
	 *       Zhongli Jade Shield, Xinyan, Layla pattern).
	 *    2. Ability has an `Effect.type: 'shield'` with onCast trigger and
	 *       an explicit `duration` — the effect's duration IS the shield
	 *       duration (Beidou Q pattern; bound to the cast site since onCast
	 *       triggers fire at cast time).
	 *
	 *  Shatter-by-damage is NOT modelled — the planner has no enemy/HP state.
	 *  Shield windows always fire `onShieldEnd` at scheduled expiry, with the
	 *  same null-resolving "assumed to hold" convention as the rest of the
	 *  planner's optimistic-render treatment. */
	const registerShieldOnCast = (
		char: CharacterData,
		castKind: 'skill' | 'burst',
		castTime: number,
		activeAbility: CastAbility,
		sourceCastId: number
	): void => {
		const windows: { ability: 'skill' | 'burst'; endTime: number }[] = [];
		// Case 1: summon-tagged shield ability
		if (activeAbility.tags?.includes('shield')) {
			const primary = activeAbility.summons?.[0];
			if (primary?.duration !== undefined && primary.duration > 0) {
				windows.push({ ability: castKind, endTime: castTime + primary.duration });
			}
		}
		// Case 2: Effect.type === 'shield' on the cast ability itself, with
		// onCast trigger + explicit duration. Triggers gated on the cast type
		// via `trigger.ability` (if set) must match the current cast.
		for (const eff of activeAbility.effects ?? []) {
			if (eff.type !== 'shield') continue;
			if (eff.trigger.type !== 'onCast') continue;
			if (eff.trigger.ability !== undefined && eff.trigger.ability !== castKind) continue;
			if (eff.duration === undefined || eff.duration <= 0) continue;
			windows.push({ ability: castKind, endTime: castTime + eff.duration });
		}
		if (windows.length === 0) return;
		const existing = getCharState(char.id).shields;
		for (const w of windows) {
			existing.push(w);
			// IR shield window (append-only; not drained like the dispatch queue).
			shieldWindowRecs.push({
				characterId: char.id,
				source: w.ability,
				start: castTime,
				end: w.endTime,
				sourceCastId
			});
		}
		existing.sort((a, b) => a.endTime - b.endTime);
	};

	/** Drain all shield windows whose `endTime <= currentTime` in chronological
	 *  order. For each expired window, push a `shieldEnd` IR event and dispatch
	 *  `onShieldEnd`-trigger effects from every team character's passives /
	 *  constellations. Source filter ('self' / 'team') and procCooldown gating
	 *  are evaluated per (holder, effect) at dispatch time.
	 *
	 *  Called at the top of each E/Q handler (after `localCursor` is set to the
	 *  cast time) and once at rotation end (with `Infinity` so any remaining
	 *  windows drain). v1 emits `shieldEnd` events only — per-effect damage/buff
	 *  rendering at shield-end time is a future renderer pass (mirrors the v0.8
	 *  HitEvent pattern: emission shipped before per-event rendering). */
	const dispatchShieldEnds = (currentTime: number): void => {
		type Expired = { holderId: string; ability: 'skill' | 'burst'; endTime: number };
		const expired: Expired[] = [];
		// Snapshot the entries: the listener loop below calls getCharState (which
		// may create new empty CharStates), and those never carry shields, so a
		// live iteration would only visit no-op empties anyway. `expired` is
		// sorted below on (endTime, holderId) — a total order — so dispatch order
		// is deterministic regardless of charStates insertion order.
		for (const [holderId, cs] of [...charStates]) {
			const windows = cs.shields;
			while (windows.length > 0 && windows[0].endTime <= currentTime) {
				const w = windows.shift()!;
				expired.push({ holderId, ability: w.ability, endTime: w.endTime });
			}
		}
		if (expired.length === 0) return;
		expired.sort((a, b) => a.endTime - b.endTime || a.holderId.localeCompare(b.holderId));
		for (const ev of expired) {
			events.push({
				kind: 'shieldEnd',
				id: nextEventId++,
				characterId: ev.holderId,
				ability: ev.ability,
				time: ev.endTime
			});
			// Walk every team char's onShieldEnd-trigger effects and apply
			// source/ability/procCooldown gating. v1 records the dispatch via
			// the event stream above; no renderer-visible side effect yet.
			for (const listener of teamChars) {
				const sources = [
					...listener.abilities,
					...(listener.passives ?? []),
					...(listener.constellations ?? [])
				];
				const listenerCons = constellationLevels?.[listener.id] ?? 0;
				for (let nodeIdx = 0; nodeIdx < sources.length; nodeIdx++) {
					const node = sources[nodeIdx];
					const effects = node.effects ?? [];
					for (let effIdx = 0; effIdx < effects.length; effIdx++) {
						const fx = effects[effIdx];
						if (fx.trigger.type !== 'onShieldEnd') continue;
						const srcMode = fx.trigger.source ?? 'self';
						if (srcMode === 'self' && listener.id !== ev.holderId) continue;
						if (fx.trigger.ability !== undefined && fx.trigger.ability !== ev.ability) continue;
						const condResult = evalCondition(
							fx.conditions,
							DEFAULT_ASCENSION,
							new Set<string>(),
							listenerCons,
							new Map(),
							undefined
						);
						if (condResult !== true) continue;
						const pc = fx.procCooldown;
						const pcNum = typeof pc === 'number' ? pc : undefined;
						if (pcNum !== undefined && pcNum > 0) {
							const charMap = getCharState(listener.id).shieldEndProcCooldown;
							const fxKey = `${node.id}#${effIdx}`;
							const last = charMap.get(fxKey) ?? -Infinity;
							if (ev.endTime - last < pcNum) continue;
							charMap.set(fxKey, ev.endTime);
						}
					}
				}
			}
		}
	};

	/** Apply continuous-rate stack drain (E3 v2) for every gainStacks key on
	 *  `char` that declares a `drain` spec. Called immediately before each cast
	 *  resolves abilities/effects so that reads of `stackState` see decayed
	 *  values. Two regimes:
	 *
	 *  - **State active at `cursor`**: decay = `ratePerSecond × (cursor - last)`,
	 *    clamped to 0; `last` advances to `cursor`. The first time a state-active
	 *    cast happens with `last` undefined, no decay is applied — the anchor is
	 *    seeded later by `dispatchGainStacks` (which sets `last = castTime` when
	 *    a drain-bearing grant fires) or here on the next cast (after seeding).
	 *  - **State inactive at `cursor`**: settle decay up to the state's recorded
	 *    end time (`stanceWindows` for `inStance`, `stateWindows` otherwise) so
	 *    post-state snapshots reflect the value the resource drained to before
	 *    the state expired. Then clear the anchor; future state-reopen casts
	 *    re-seed via the next dispatchGainStacks. */
	const applyDrain = (
		char: CharacterData,
		cursor: number,
		currentStates: ReadonlySet<string>,
		stackState: Map<string, number>
	): void => {
		const cs = getCharState(char.id);
		const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
		const seenKeys = new Set<string>();
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.type !== 'gainStacks') continue;
				if (!fx.drain) continue;
				if (seenKeys.has(fx.key)) continue; // first drain spec per key wins
				seenKeys.add(fx.key);
				const charAnchors = cs.drainAnchors;
				const last = charAnchors.get(fx.key);
				if (currentStates.has(fx.drain.state)) {
					if (last !== undefined) {
						const elapsed = cursor - last;
						if (elapsed > 0) {
							const current = stackState.get(fx.key) ?? 0;
							const decayed = Math.max(0, current - fx.drain.ratePerSecond * elapsed);
							stackState.set(fx.key, decayed);
						}
					}
					charAnchors.set(fx.key, cursor);
				} else if (last !== undefined) {
					const stateEnd =
						fx.drain.state === 'inStance' ? cs.stance?.end : cs.states.get(fx.drain.state);
					if (stateEnd !== undefined && stateEnd > last) {
						const elapsed = stateEnd - last;
						const current = stackState.get(fx.key) ?? 0;
						const decayed = Math.max(0, current - fx.drain.ratePerSecond * elapsed);
						stackState.set(fx.key, decayed);
					}
					charAnchors.delete(fx.key);
				}
			}
		}
	};

	/** Apply per-stack lifetime expiry (E3 v2.x) for every gainStacks key on
	 *  `char` that declares a `lifetime` spec. Drops instances whose expiry
	 *  time has passed and updates `stackState[key]` to the remaining count.
	 *  Lazy: only runs at cast events (mirroring `applyDrain`). The first
	 *  lifetime spec per key wins (matches the drain convention).
	 *
	 *  Operates on the per-segment `stackInstances` map; called from cast
	 *  handlers BEFORE `dispatchGainStacks` so reads see expired counts and
	 *  fresh grants land cleanly on top. */
	const applyLifetimeExpiry = (
		char: CharacterData,
		cursor: number,
		stackState: Map<string, number>,
		stackInstances: Map<string, number[]>
	): void => {
		const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
		const seenKeys = new Set<string>();
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.type !== 'gainStacks') continue;
				if (fx.lifetime === undefined) continue;
				// onReaction lifetime is handled by `syncOnReactionToStackState`
				// against rotation-wide instance maps; skipping here avoids
				// touching the per-segment copy the sync just rewrote.
				if (fx.trigger.type === 'onReaction') continue;
				if (seenKeys.has(fx.key)) continue;
				seenKeys.add(fx.key);
				const instances = stackInstances.get(fx.key);
				if (!instances || instances.length === 0) continue;
				const remaining = instances.filter((expiry) => expiry > cursor);
				if (remaining.length !== instances.length) {
					stackInstances.set(fx.key, remaining);
					stackState.set(fx.key, remaining.length);
				}
			}
		}
	};

	/** Convenience wrapper: at a cast site, compute synthetic reactions for the
	 *  cast's element + current aura state, dispatch each emitted reaction to
	 *  the onReaction extension and gainStacks paths, push `reaction` IR events
	 *  for renderer consumption (artifact onReaction effects), then update the
	 *  aura state. Caller passes the cast event context. */
	const emitReactionsAtCast = (
		char: CharacterData,
		castKind: 'skill' | 'burst',
		castTime: number,
		preStates: ReadonlySet<string>,
		constellation: number,
		chainIdx: ChainIndex,
		stackState: Map<string, number>
	): void => {
		const element = char.element;
		if (!element) return;
		const reactions = computeReactionsForCast(element, auraState, hasMoonsignTeam);
		const stacksSnapshot = stackState.size > 0 ? new Map(stackState) : undefined;
		for (const r of reactions) {
			dispatchOnReactionExtensions(
				char.id,
				r,
				castTime,
				preStates,
				constellation,
				chainIdx,
				stacksSnapshot
			);
			dispatchGainStacksOnReaction(
				teamChars,
				char.id,
				r,
				castTime,
				new Map([[char.id, preStates]]),
				new Map(teamChars.map((c) => [c.id, constellationLevels?.[c.id] ?? 0])),
				getCharState
			);
			events.push({
				kind: 'reaction',
				id: nextEventId++,
				characterId: char.id,
				reaction: r,
				time: castTime,
				castKind
			});
		}
		updateAuraStateAfterCast(element, auraState);
		// E3 v2.x — build the parser-private HitEvent for the cast (per-cast
		// granularity) and dispatch it to all team characters' onHit
		// `gainStacks` effects. Element = casting character's element. Per-hit
		// fidelity (NA/CA/plunge element overrides via infusion) is deferred;
		// hits are NOT part of the public IR (post-P4 #1 — see the HitEvent decl).
		const hit: HitEvent = {
			characterId: char.id,
			element,
			time: castTime,
			castKind
		};
		dispatchGainStacksOnHit(
			teamChars,
			hit,
			new Map(),
			new Map(teamChars.map((c) => [c.id, constellationLevels?.[c.id] ?? 0])),
			getCharState
		);
	};

	for (let i = 0; i < segments.length; i++) {
		const tokens = segments[i];
		if (tokens.length === 0) continue;

		// First token is always the character-name slot.
		const charToken = tokens[0]; // kind === 'character'
		const char = lookupChar(charToken.text);
		if (!char) {
			unknownTokens.push(charToken.text);
			continue; // unknown character — skip segment
		}

		// This character's mutable parser state (cooldown clocks, stance window,
		// named states, chains, shields, summon extensions, stack accumulators).
		// Get-or-create; persists across segments.
		const cs = getCharState(char.id);

		const eAbility = char.abilities.find(
			(a): a is Extract<Ability, { abilityType: 'skill' }> => a.abilityType === 'skill'
		);
		const qAbility = char.abilities.find(
			(a): a is Extract<Ability, { abilityType: 'burst' }> => a.abilityType === 'burst'
		);

		const track: CharacterTrack = {
			characterId: char.id,
			displayName: char.displayName,
			element: char.element ?? 'pyro',
			activeStart: cursor,
			activeEnd: cursor,
			inputBlocks: [],
			hasUnsetDuration: false,
			eBars: [],
			qBars: []
		};

		let localCursor = cursor;

		const emitBlock = (b: InputBlock) => {
			track.inputBlocks.push(b);
		};

		// Post-P4 #2: emit one action event. `blockId` groups the per-swing
		// events of one input token (pass the anchor id returned by the first
		// emission); when omitted the event anchors its own group.
		const emitAction = (
			fields: Omit<ActionEvent, 'kind' | 'id' | 'characterId' | 'blockId'> & { blockId?: number }
		): ActionEvent => {
			const id = nextEventId++;
			const ev: ActionEvent = {
				...fields,
				kind: 'action',
				id,
				characterId: char.id,
				blockId: fields.blockId ?? id
			};
			events.push(ev);
			actionRecords.push({ ev, track });
			return ev;
		};

		// This character's cast events across all segments so far (get-or-create;
		// handleCast appends). Used for cross-segment duringSummon detection.
		let charCasts = castsByChar.get(char.id);
		if (!charCasts) {
			charCasts = [];
			castsByChar.set(char.id, charCasts);
		}

		// Resolved once per segment so both Q and E handlers see the same value.
		const charConstellationLevel = constellationLevels?.[char.id] ?? 0;

		// Variant-condition context for this holder (sQ primitive).
		const variantCtx: ConditionContext = {
			teamFactionCounts,
			teamElementCounts: teamElementCountsByHolder.get(char.id)
		};

		const isBow = char.weapon === 'bow';
		// Tracks which hit in the combo sequence the next N token refers to.
		// Reset at segment start and when a stance opens (mid-segment Q cast).
		let normalCounter = 0;
		// Text of the most recent E token cast in this segment. Used by the P handler
		// to auto-select the correct plunge variant (e.g. "hE" → "After Hold E" frames).
		let lastEText: string | null = null;
		// Per-segment stack state (resource counts asserted by `{key:N}` tokens).
		// Resets at segment start so a swap-out clears the resource pool — matches
		// in-game behavior for Heizou Declension, Yanfei Scarlet Seals, etc.
		// Within the segment, assertions persist across actions until the next
		// assertion of the same key changes the value.
		const stackState = new Map<string, number>();
		// Per-segment per-stack-instance expiry list (E3 v2.x lifetime). For each
		// gainStacks key with a `lifetime` spec, this map tracks the absolute
		// expiry times of every individual stack instance. `applyLifetimeExpiry`
		// drops expired instances and updates `stackState[key]` to match the
		// remaining instance count. Per-segment scope (matching `stackState`).
		const stackInstances = new Map<string, number[]>();

		// Returns the full set of resolved runtime states at `cursor`: duringSummon
		// (from stationary persistent casts), inStance (from stanceWindows), and any
		// named states opened by stance abilities with `opensState` (e.g.
		// nightsoulBlessing on Natlan characters).
		const computeCurrentStates = (cursor: number): Set<string> => {
			const states = inferredStates(charCasts, eAbility, qAbility, cursor);
			const stanceEnd = cs.stance?.end;
			if (stanceEnd !== undefined && stanceEnd > cursor) states.add('inStance');
			for (const [state, endTime] of cs.states) {
				if (endTime > cursor) states.add(state);
			}
			return states;
		};

		// Earliest own stance/named-state window end strictly after `t`, or null.
		// These are the runtime-state boundaries that can flip skill-variant
		// resolution during a cooldown wait (sweep 2026-07-05 #5). duringSummon
		// boundaries are not scanned — summon-gated variants keep their pre-wait
		// resolution.
		const nextOwnWindowEnd = (t: number): number | null => {
			let next: number | null = null;
			const consider = (end: number | undefined): void => {
				if (end !== undefined && end > t && (next === null || end < next)) next = end;
			};
			consider(cs.stance?.end);
			for (const end of cs.states.values()) consider(end);
			return next;
		};

		// Expand bracket repeat groups (e.g. 2[N5C] → N5 C N5 C) before the main
		// loop so that lookahead and counter logic see a flat token sequence.
		const expandedTokens = expandBrackets(tokens.slice(1));

		// Unified E/Q cast pipeline. One sequence with small kind-branches; the
		// shared step order is the Q handler's (the reference the 2026-07-05 bug
		// sweep #5 copied to fix E). Order-of-operations is this parser's top bug
		// class — do NOT reorder shared steps. The complete kind asymmetry:
		// cursor settle, CD-write timing, weapon sac-proc (E-only), character
		// cdReset targets (Q-only), lastEText (E-only), and the no-ability
		// fallbacks. `tok`/`j` are passed (not closed over) so the pipeline reads
		// against its arguments, not the loop cursor.
		const handleCast = (kind: 'skill' | 'burst', tok: Token, j: number): void => {
			const isBurst = kind === 'burst';
			const ability = isBurst ? qAbility : eAbility;
			normalCounter = 0; // any non-normal action resets the NA string (gcsim semantics)

			// ── Cursor settle (kind-specific).
			// Q: burst cooldown gate; applies to the no-ability fallback too.
			// cs.qReadyAt defaults to -Infinity (never cast) — isFinite treats
			// that as "no gate", matching the old undefined-map-value behavior.
			// (E settles via the forward-scan wait loop below, inside the ability
			// branch — it re-resolves the active variant and needs `ability`.)
			if (isBurst && isFinite(cs.qReadyAt)) {
				// sQ primitive: a burst variant flagged `bypassesCooldown` ignores
				// the shared burst clock entirely (Flins Thunderous Symphony —
				// gcsim's ActionReady skips the CD check while the window is
				// active). Resolve the variant at the CURRENT cursor to decide;
				// guarded on the ability even declaring such a variant so the
				// common path stays untouched.
				const bypassesGate =
					ability?.variants?.some((v) => v.bypassesCooldown === true) === true &&
					matchVariant(
						ability,
						tok.text,
						computeCurrentStates(localCursor),
						charConstellationLevel,
						getChainIndexMap(char.id, localCursor),
						stackState,
						variantCtx
					)?.bypassesCooldown === true;
				if (!bypassesGate) localCursor = Math.max(localCursor, cs.qReadyAt);
			}

			if (ability) {
				const nextKey = peekActionKey(expandedTokens, j);

				// E: cooldown wait + variant re-resolution (sweep 2026-07-05 #5).
				// The active skill variant is time-dependent (stance/state windows)
				// and each distinct skill ability has its own charge queue keyed by
				// ability ID (Cyno's out-of-stance E at 7.5s CD shares no cooldown
				// with the in-stance E at 3s CD). A cooldown wait can therefore
				// cross a window boundary and change WHICH ability is cast. Scan
				// forward over queue-ready and own-window-end events until the
				// ability active at time t has a ready charge at t. The scan is
				// pure — time-advancing mutations run once afterwards, at the
				// actual cast time.
				if (!isBurst) {
					for (let scanGuard = 0; scanGuard < 8; scanGuard++) {
						const scanStates = computeCurrentStates(localCursor);
						const scanE =
							resolveActiveAbility(
								char,
								'skill',
								scanStates,
								charConstellationLevel,
								getChainIndexMap(char.id, localCursor),
								stackState
							) ?? (ability as SkillAbility); // !isBurst branch: `ability` is the skill
						// Initialize this ability's charge queue on first sight:
						// all charges ready at t=0.
						if (!eChargeQueues.has(scanE.id)) {
							const scanVariant = matchVariant(
								scanE,
								tok.text,
								scanStates,
								charConstellationLevel,
								getChainIndexMap(char.id, localCursor),
								stackState,
								variantCtx
							);
							eChargeQueues.set(
								scanE.id,
								new Array(resolveEffectiveCharges(scanE, scanVariant, charConstellationLevel)).fill(
									0
								)
							);
						}
						// queue[0] is the earliest-ready charge (kept sorted ascending).
						const readyAt = eChargeQueues.get(scanE.id)![0];
						if (readyAt <= localCursor) break; // castable now
						const boundary = nextOwnWindowEnd(localCursor);
						// Advance to the next event: either a charge returns, or a
						// window ends first (where resolution may flip — re-scan).
						localCursor = boundary !== null && boundary < readyAt ? boundary : readyAt;
					}
				}

				// The cast instant — captured before the cursor advances and passed
				// to every cast-time consumer for both kinds (Q's old `qStart` and
				// E's old `localCursor - eCast` are this same instant, computed
				// differently in the twin handlers).
				const castStart = localCursor;

				// ── Time-advancing evaluations at the cast instant (shared order).
				// Fire expired shield-ends first (so onShieldEnd-bound conditions
				// see post-event state), then decay/expire stacks BEFORE resolving
				// the active variant so any condition reading stackState sees
				// decayed/expired values.
				dispatchShieldEnds(castStart);
				const states = computeCurrentStates(castStart);
				applyDrain(char, castStart, states, stackState);
				applyLifetimeExpiry(char, castStart, stackState, stackInstances);
				syncSourceLifetimeToStackState(char, castStart, stackState, getCharState);
				syncOnReactionToStackState(char, castStart, stackState, stackInstances, getCharState);
				const chainIdx = getChainIndexMap(char.id, castStart);
				// Resolve the active variant (chain-stage + state + stack aware).
				const active =
					resolveActiveAbility(char, kind, states, charConstellationLevel, chainIdx, stackState) ??
					ability;
				// Both kinds resolve timing against the token text (hold/plunge E
				// variants; sQ burst variants) — the variant match additionally
				// honors variant `conditions` (sQ primitive), so an out-of-window
				// `sQ` falls back to the base ability's timing.
				const timingLabel = tok.text;
				const variant = matchVariant(
					active,
					timingLabel,
					states,
					charConstellationLevel,
					chainIdx,
					stackState,
					variantCtx
				);

				// E only: ensure the resolved variant's charge queue exists (the
				// scan may have re-resolved to a different variant).
				let queue: number[] | undefined;
				if (!isBurst) {
					// !isBurst branch: `active` resolved from a skill kind.
					const maxCharges = resolveEffectiveCharges(
						active as SkillAbility,
						variant,
						charConstellationLevel
					);
					if (!eChargeQueues.has(active.id)) {
						eChargeQueues.set(active.id, new Array(maxCharges).fill(0));
					}
					queue = eChargeQueues.get(active.id)!;
				}

				const castTime = resolveEQCastTime(active, variant, nextKey);
				const {
					cooldown: cd,
					duration: dur,
					summonActivatesAt: spawn
				} = resolveAbilityTiming(
					active,
					variant,
					states,
					charConstellationLevel,
					chainIdx,
					stackState
				);

				// Apply gainStacks matching this cast BEFORE the snapshot, so the
				// cast's stackContext reflects post-grant state (symmetric with
				// Path B's `{key:N}` assertion which precedes the cast in the token
				// stream and is read by the snapshot).
				dispatchGainStacks(
					char,
					kind,
					castStart,
					states,
					charConstellationLevel,
					chainIdx,
					stackState,
					cs.drainAnchors,
					tok.text,
					stackInstances
				);
				// Snapshot stack state at cast time (only when non-empty) so the
				// timeline can filter stack-gated effects per-cast.
				const stacks = stackState.size > 0 ? new Map(stackState) : undefined;
				// P4 IR — one `cast` event per resolved cast (the unified single
				// site). Post-P4 #3: this event IS the per-cast record — the E/Q
				// bar is projected from it at finalize, so every geometric field
				// (uptime/cooldown/readyAt/spawn offset) lives here. `readyAt` is
				// initialized to the delay-adjusted CD end; the E sac-proc branch
				// below may retarget it to the hitmark. The id is the provenance
				// anchor for every window this cast opens.
				const castId = nextEventId++;
				const castEvent: CastEvent = {
					kind: 'cast',
					id: castId,
					characterId: char.id,
					ability: kind,
					abilityId: active.id,
					label: tok.text,
					time: castStart,
					castTime,
					uptime: dur,
					cooldown: cd,
					readyAt: castStart + (active.cooldownStartDelay ?? 0) / 60 + cd,
					summonActivatesAt: spawn,
					fieldStart: castStart + (spawn ?? 0) / 60,
					stackContext: stacks
				};
				events.push(castEvent);
				castRecords.push({ ev: castEvent, track });
				charCasts.push(castEvent);
				// Apply consumeStacks AFTER the snapshot so the bar reflects the
				// pre-consume value the perStack BuffValue consumer needs to read.
				dispatchConsumeStacks(
					char,
					kind,
					states,
					charConstellationLevel,
					chainIdx,
					stackState,
					tok.text,
					stackInstances
				);

				// ── CD write (kind-specific).
				if (isBurst) {
					// Same delay-adjusted instant the event was initialized with.
					// A bypassesCooldown variant (Flins Thunderous Symphony) leaves
					// the shared burst clock untouched — its own resolved cooldown
					// still renders on the bar, but neither gates nor writes the
					// clock (gcsim: Symphony sets no CD).
					if (variant?.bypassesCooldown !== true) cs.qReadyAt = castEvent.readyAt;
				} else {
					// Ready-at for the slot we just consumed. Sac Bow proc may
					// override this with hitmark time (skill instantly available
					// again). Defer the queue write until after the proc check —
					// writing first and sorting leaves queue[0] pointing at a
					// different charge, so the proc would reset the wrong slot.
					let consumedReadyAt = castEvent.readyAt;
					// Weapon cdReset (Sacrificial series): proc fires onHit (≈ end
					// of cast animation), not onCast. hitTime approximates hitmark.
					const sacCd = getWeaponCdResetCooldown(char.id, loadoutMap);
					if (sacCd !== null) {
						const hitTime = castStart + castTime;
						if (hitTime >= cs.sacProcReadyAt) {
							// Proc fires: the consumed charge is available again from hitmark.
							consumedReadyAt = hitTime;
							const procEnd = hitTime + sacCd;
							cs.sacProcReadyAt = procEnd;
							const bars = weaponProcBars.get(char.id) ?? [];
							bars.push({ start: hitTime, end: procEnd, sourceCastId: castId });
							weaponProcBars.set(char.id, bars);
							castEvent.sacProcFired = true;
							castEvent.readyAt = hitTime;
						}
					}
					// Write the consumed slot's final ready-at and re-sort so
					// queue[0] stays the earliest-ready charge.
					queue![0] = consumedReadyAt;
					queue!.sort((a, b) => a - b);
				}

				emitBlock({ start: castStart, duration: castTime, parts: [timingLabel], kind });
				localCursor += castTime;
				if (!isBurst) lastEText = tok.text; // plunge-variant selection
				advanceChain(active, char.id, kind, localCursor);

				// Q only: character cdReset — refund a charge on each affected
				// ability whose CD the burst resets (Kazuha C1: Q resets E).
				if (isBurst) {
					const resets = getCharacterCdResetTargets(char, 'burst', charConstellationLevel);
					for (const target of resets) {
						if (target === 'skill') {
							// Only the caster's own skill queues — keys are
							// `{charId}__…` ability ids (or bare charId in the
							// uncurated fallback). A rotation-wide reset would erase
							// teammates' cooldowns.
							for (const [key, q] of eChargeQueues) {
								if (key !== char.id && !key.startsWith(`${char.id}__`)) continue;
								if (q.length === 0) continue;
								// Refund only charges still on CD; never push an
								// already-ready charge later.
								q[0] = Math.min(q[0], localCursor);
								q.sort((a, b) => a - b);
							}
						} else if (target === 'burst') {
							cs.qReadyAt = localCursor;
						}
					}
				}

				// Open a stance window when the resolved variant has stance
				// behavior. Fresh record replaces any prior stance (resets
				// per-window extension counts). Hu Tao / Xilonen open via base E;
				// Mavuika hE and Collei-shape Q open via variant.
				const stance = resolveStanceFields(active, variant);
				if (stance.behavior === 'stance') {
					const endTime = castStart + dur;
					cs.stance = {
						end: endTime,
						terminatesOnSwap: stance.terminatesOnSwap,
						ownerAbility: active,
						castRef: castEvent, // ref for the finalize uptime stamp
						characterId: char.id,
						start: castStart,
						source: kind,
						sourceCastId: castId,
						ownerUptime: dur,
						extCounts: new Map(),
						extLastFire: new Map()
					};
					// Retain every opened stance window for the IR (cs.stance is
					// replaced per cast; extensions/swap-close mutate this same
					// object in place, so the collected record stays current).
					stanceWindowRecs.push(cs.stance);
					// Open named state alongside inStance (e.g. nightsoulBlessing).
					// `opensState: "inStance"` is redundant (the stance IS the
					// inStance window — post-P4 #4 they are one record); skip it so
					// no source-less duplicate shadows the extension-adjusted one.
					if (stance.opensState && stance.opensState !== 'inStance') {
						cs.states.set(stance.opensState, endTime);
						stateWindowRecs.push({
							characterId: char.id,
							name: stance.opensState,
							start: castStart,
							end: endTime,
							sourceCastId: castId
						});
					}
				} else if (active.behavior === 'instant' && active.opensTransientState) {
					// Post-action transient state (sQ primitive): an instant cast
					// opens a short named gating window — Flins Northland Spearstorm
					// opens `symphonyWindow` (6s) during which `sQ` resolves to the
					// Thunderous Symphony burst variant. Re-cast before expiry
					// refreshes the window (new span record). Guarded on the RESOLVED
					// behavior staying instant so a variant that overrides to stance
					// doesn't double-open.
					const spec = active.opensTransientState;
					if (
						stance.behavior === 'instant' &&
						(spec.conditions === undefined ||
							evalCondition(
								spec.conditions,
								DEFAULT_ASCENSION,
								states,
								charConstellationLevel,
								chainIdx,
								stackState
							) === true)
					) {
						const stateEnd = castStart + spec.duration;
						cs.states.set(spec.state, stateEnd);
						stateWindowRecs.push({
							characterId: char.id,
							name: spec.state,
							start: castStart,
							end: stateEnd,
							sourceCastId: castId
						});
						if (spec.terminatesOnSwap) cs.statesTerminatingOnSwap.add(spec.state);
					}
				}
				// Variant consumes a transient state (gcsim DeleteStatus on cast):
				// Thunderous Symphony closes `symphonyWindow`, Volcano Kablam closes
				// `apexDrive`. The cast itself resolved under the pre-close `states`
				// snapshot, so ordering within this cast is immaterial; the window
				// record is clamped to the cast start for rendering.
				if (variant?.consumesState !== undefined) {
					const consumed = variant.consumesState;
					const openEnd = cs.states.get(consumed);
					if (openEnd !== undefined && openEnd > castStart) {
						cs.states.set(consumed, castStart);
						for (const rec of stateWindowRecs) {
							if (rec.characterId === char.id && rec.name === consumed && rec.end > castStart) {
								rec.end = castStart;
							}
						}
					}
				}
				// Register summon-bound durationExtensions[] when the cast spawns a
				// summon with extensions (Collei A4 — Cuilein-Anbar zone). Replaces
				// any prior owner; counts/lastFires reset per cast.
				const primarySummon = active.summons?.[0];
				if (
					primarySummon &&
					primarySummon.durationExtensions &&
					primarySummon.durationExtensions.length > 0
				) {
					cs.summonExt = {
						endTime: castStart + dur,
						extensions: primarySummon.durationExtensions,
						castRef: castEvent,
						ownerUptime: dur,
						counts: new Map(),
						lastFires: new Map()
					};
					// Retain for the finalize owner uptime stamp (the summon
					// TimelineWindow itself is authored by the summon-window pass,
					// which reads the stamped uptime off the projected bar).
					summonExtRecs.push(cs.summonExt);
				}
				// Register shield window if the cast spawns a shield (tags
				// `['shield']` + summons[0] duration, or onCast Effect.type
				// `'shield'` + duration). Beidou Q and Noelle/Zhongli E are canonical.
				registerShieldOnCast(char, kind, castStart, active, castId);
				// Emit synthetic reactions for this cast and dispatch to onReaction
				// consumers (gainStacks + durationExtensions). Fires after
				// stance/summon registration so the just-opened stance owner /
				// just-spawned summon can receive extensions from this cast. Aura
				// state updates after dispatch so this cast sees pre-cast aura.
				// The cast instant fed to the reaction/extension emitters is
				// `castStart` (the exact pre-advance cursor) for both kinds.
				emitReactionsAtCast(
					char,
					kind,
					castStart,
					states,
					charConstellationLevel,
					chainIdx,
					stackState
				);
				// Dispatch onCast durationExtensions on the (possibly just-opened)
				// stance owner. Cyno's burst-stance + in-stance E recast fires here.
				dispatchOnCastExtensions(
					char.id,
					kind,
					castStart,
					states,
					charConstellationLevel,
					chainIdx,
					stacks
				);
			} else if (isBurst) {
				// No-ability fallback (Q): generic 15s CD.
				// No resolved variant — key the abilityId by the bare charId.
				const fallbackQ: CastEvent = {
					kind: 'cast',
					id: nextEventId++,
					characterId: char.id,
					ability: 'burst',
					abilityId: char.id,
					label: tok.text,
					time: localCursor,
					castTime: Q_CAST_S,
					uptime: 0,
					cooldown: 15,
					readyAt: localCursor + 15,
					summonActivatesAt: 0,
					fieldStart: localCursor
				};
				events.push(fallbackQ);
				castRecords.push({ ev: fallbackQ, track });
				charCasts.push(fallbackQ);
				cs.qReadyAt = localCursor + 15;
				// parts uses tok.text (not a hardcoded 'Q') so the block agrees with
				// the fallback cast event's label — the projection key (post-P4 #2).
				emitBlock({ start: localCursor, duration: Q_CAST_S, parts: [tok.text], kind: 'burst' });
				localCursor += Q_CAST_S;
			} else {
				// No-ability fallback (E): single charge keyed by bare charId, 12s CD.
				if (!eChargeQueues.has(char.id)) eChargeQueues.set(char.id, [0]);
				const queue = eChargeQueues.get(char.id)!;
				if (queue[0] > localCursor) localCursor = queue[0];
				const fallbackE: CastEvent = {
					kind: 'cast',
					id: nextEventId++,
					characterId: char.id,
					ability: 'skill',
					abilityId: char.id,
					label: tok.text,
					time: localCursor,
					castTime: E_CAST_S,
					uptime: 0,
					cooldown: 12,
					readyAt: localCursor + 12,
					summonActivatesAt: 0,
					fieldStart: localCursor
				};
				events.push(fallbackE);
				castRecords.push({ ev: fallbackE, track });
				charCasts.push(fallbackE);
				queue[0] = localCursor + 12;
				emitBlock({ start: localCursor, duration: E_CAST_S, parts: [tok.text], kind: 'skill' });
				localCursor += E_CAST_S;
				lastEText = tok.text;
			}
		};

		for (let j = 0; j < expandedTokens.length; j++) {
			const tok = expandedTokens[j];

			if (tok.kind === 'Q') {
				handleCast('burst', tok, j);
			} else if (tok.kind === 'E') {
				handleCast('skill', tok, j);
			} else if (tok.kind === 'time') {
				const m = tok.text.match(/^~([\d.]+)s/);
				if (m) {
					const delta = parseFloat(m[1]);
					if (isFinite(delta)) localCursor += delta;
				}
			} else if (tok.kind === 'unset-time') {
				emitAction({ action: 'unset', label: '~?', time: localCursor, duration: MIN_ACTIVE_S });
				emitBlock({ start: localCursor, duration: MIN_ACTIVE_S, parts: ['~?'], kind: 'unset' });
				track.hasUnsetDuration = true;
				localCursor += MIN_ACTIVE_S;
			} else if (tok.kind === 'optional') {
				// Optional actions in parentheses are omitted from the timeline entirely.
				// No label is emitted and no cursor advance occurs.
			} else if (tok.kind === 'or-alt') {
				// Slash alternative — only the first option goes on the timeline.
				continue;
			} else if (tok.kind === 'stack-assert') {
				// User-asserted stack count: `{key:N}` updates the per-segment
				// stackState for subsequent ability/effect resolution. No timeline
				// effect — the assertion itself doesn't emit a block or advance
				// the cursor. The next ability that gates on this stack key picks
				// up the new count via the threaded `stackState` parameter.
				const m = tok.text.match(STACK_ASSERT_RE);
				if (m) {
					stackState.set(m[1], parseInt(m[2], 10));
				}
			} else {
				// 'label' or 'unknown'
				if (tok.kind === 'unknown') unknownTokens.push(tok.text);

				const t = tok.text;
				const nextKey = peekActionKey(expandedTokens, j);

				if (/^N\d*$/.test(t)) {
					// Normal attack: N5 means "perform 5 normals in a row" starting from
					// the current normalCounter. Intermediate hits use 'N' as their
					// lookahead (next action is another normal); the final hit uses nextKey.
					// All hits are summed into one block labeled "N5".
					// Active normal ability is resolved per-token to handle mid-segment
					// stance transitions (e.g. Cyno Q → in-stance normals).
					const count = t.length > 1 ? parseInt(t.slice(1)) : 1;
					const blockStart = localCursor;
					let blockDuration = 0;
					const activeNormal = resolveActiveAbility(
						char,
						'normal',
						computeCurrentStates(localCursor),
						charConstellationLevel
					);
					const hits = activeNormal?.hits;
					const nElemental = char.weapon === 'catalyst' || activeNormal?.infusion;
					const nElement = nElemental
						? (activeNormal?.infusion ?? char.element ?? 'pyro')
						: undefined;
					// Per-swing action events sharing one blockId (the anchor = the
					// first swing's id). `time` is the swing's pre-advance start.
					let anchorId: number | undefined;
					for (let k = 0; k < count; k++) {
						const hitIndex = hits ? normalCounter % hits.length : normalCounter;
						const hitNextKey: ActionKey = k < count - 1 ? 'N' : nextKey;
						const castS = resolveNormalCastTime(hits, hitIndex, hitNextKey);
						const ev = emitAction({
							action: 'normal',
							label: t,
							blockId: anchorId,
							time: localCursor,
							duration: castS ?? 0,
							abilityId: activeNormal?.id,
							comboIndex: hitIndex,
							element: nElement
						});
						anchorId ??= ev.id;
						if (castS !== null) {
							blockDuration += castS;
							localCursor += castS;
						}
						normalCounter++;
					}
					emitBlock({
						start: blockStart,
						duration: blockDuration,
						parts: [t],
						kind:
							char.weapon === 'catalyst' || activeNormal?.infusion ? 'elemental-normal' : 'normal'
					});
				} else if (/^C\d*$/.test(t)) {
					// Charged attack: resolve active normal (in-stance if applicable) for
					// chargeFrames/chargeHits. Bow uses chargeHits, others use chargeFrames.
					normalCounter = 0; // any non-normal action resets the NA string (gcsim semantics)
					const activeNormal = resolveActiveAbility(
						char,
						'normal',
						computeCurrentStates(localCursor),
						charConstellationLevel
					);
					const castS = activeNormal
						? resolveChargeCastTime(activeNormal, t, nextKey, isBow)
						: null;
					const blockStart = localCursor;
					// Catalyst charged attacks are always elemental (same rule as the
					// N branch); aimed shots (bow, non-C1) and infused CAs likewise.
					const cElemental =
						char.weapon === 'catalyst' || (isBow && t !== 'C1') || activeNormal?.infusion;
					emitAction({
						action: 'charged',
						label: t,
						time: blockStart,
						duration: castS ?? 0,
						abilityId: activeNormal?.id,
						element: cElemental ? (activeNormal?.infusion ?? char.element ?? 'pyro') : undefined
					});
					if (castS !== null) localCursor += castS;
					emitBlock({
						start: blockStart,
						duration: castS ?? 0,
						parts: [t],
						kind: cElemental ? 'elemental-normal' : 'normal'
					});
				} else if (/^[hl]?P$/.test(t)) {
					// Plunge attack. Uses the active normal ability's plungeFrames, or a
					// plungeVariant whose input[] matches the preceding E token text
					// (e.g. Kazuha's Midare Ranzan has distinct "After Hold E" frames).
					const plungeStates = computeCurrentStates(localCursor);
					const activeNormal = resolveActiveAbility(
						char,
						'normal',
						plungeStates,
						charConstellationLevel
					);
					normalCounter = 0; // any non-normal action resets the NA string (gcsim semantics)
					const plungeVariant = lastEText
						? activeNormal?.plungeVariants?.find((v) =>
								v.input.includes(lastEText as (typeof v.input)[number])
							)
						: undefined;
					const plungeFrames = plungeVariant?.frames ?? activeNormal?.plungeFrames;
					if (plungeFrames) {
						const castS = (plungeFrames[nextKey] ?? plungeFrames.swap) / 60;
						const blockStart = localCursor;
						// Catalyst / infused plunges (e.g. Xiao's Q-stance) are elemental —
						// same rule as the N branch. An unresolvable plunge (no frames)
						// emits NO action event, matching the no-block legacy behavior.
						const pElemental = char.weapon === 'catalyst' || activeNormal?.infusion;
						emitAction({
							action: 'plunge',
							label: t,
							time: blockStart,
							duration: castS,
							abilityId: activeNormal?.id,
							element: pElemental ? (activeNormal?.infusion ?? char.element ?? 'pyro') : undefined
						});
						localCursor += castS;
						emitBlock({
							start: blockStart,
							duration: castS,
							parts: [t],
							kind: pElemental ? 'elemental-normal' : 'normal'
						});
						// Post-plunge transient state (sQ primitive): the plunge landing
						// opens a short gating window — Varesa's plunge opens `apexDrive`
						// (140f) during which `sQ` resolves to Volcano Kablam. Window
						// runs from the plunge's END (≈ landing); no cast event exists
						// for a plunge yet (backlog #2), so the window carries no
						// sourceCastId.
						const pSpec = activeNormal?.plungeOpensState;
						if (
							pSpec &&
							(pSpec.conditions === undefined ||
								evalCondition(
									pSpec.conditions,
									DEFAULT_ASCENSION,
									plungeStates,
									charConstellationLevel
								) === true)
						) {
							const pEnd = localCursor + pSpec.duration;
							cs.states.set(pSpec.state, pEnd);
							stateWindowRecs.push({
								characterId: char.id,
								name: pSpec.state,
								start: localCursor,
								end: pEnd
							});
							if (pSpec.terminatesOnSwap) cs.statesTerminatingOnSwap.add(pSpec.state);
						}
					}
					lastEText = null;
				} else if (t === 'D' || t === 'J') {
					// Dash/jump: emit a block, then advance cursor.
					// The preceding token already selected frames.D/J via peekActionKey.
					normalCounter = 0; // any non-normal action resets the NA string (gcsim semantics)
					const blockStart = localCursor;
					emitAction({
						action: t === 'D' ? 'dash' : 'jump',
						label: t,
						time: blockStart,
						duration: DASH_FRAMES / 60
					});
					localCursor += DASH_FRAMES / 60;
					emitBlock({
						start: blockStart,
						duration: DASH_FRAMES / 60,
						parts: [t],
						kind: 'movement'
					});
				}
			}
		}

		// Ensure minimum on-field width
		if (localCursor <= cursor) localCursor = cursor + MIN_ACTIVE_S;

		track.activeEnd = localCursor;
		tracks.push(track);

		// When a character swaps off, close any stance window flagged terminatesOnSwap.
		// The flag was recorded at open time (resolveStanceFields applies variant
		// overrides), so this works correctly for variant-driven stances too
		// (e.g. Mavuika hE where the base behavior is "instant" but the variant
		// opens a real stance with terminatesOnSwap: true).
		//
		// E3 v2.x: instead of clearing cs.stance, record the actual swap-out time
		// (cs.stance.end). drain-bearing stack keys (Skirk SS, drain 7/sec while
		// inStance) rely on the stored end time when applyDrain settles in a
		// future segment; the original max-duration value is a stale upper bound
		// that would cause over-decay. computeCurrentStates already gates
		// `inStance` on `end > cursor`, so future-segment cursors (always >
		// localCursor) see the stance as inactive — no false-positive state
		// membership. Setting terminatesOnSwap false (mirrors the old
		// `stanceTerminatesOnSwap.delete`) stops a later swap in a segment that
		// never re-opened from re-clamping. Named state windows opened by this
		// stance (nightsoulBlessing, etc.) are clamped to the same swap-out time.
		// Transient states flagged terminatesOnSwap close at swap-out regardless
		// of any stance window (Flins symphonyWindow — gcsim's exit-field hook
		// deletes the status). Clamp the live end + the IR records, then clear
		// the flag set (mirrors the stance terminatesOnSwap=false reset).
		if (i < segments.length - 1 && cs.statesTerminatingOnSwap.size > 0) {
			for (const name of cs.statesTerminatingOnSwap) {
				const end = cs.states.get(name);
				if (end !== undefined && end > localCursor) {
					cs.states.set(name, localCursor);
					for (const rec of stateWindowRecs) {
						if (rec.characterId === char.id && rec.name === name && rec.end > localCursor) {
							rec.end = localCursor;
						}
					}
				}
			}
			cs.statesTerminatingOnSwap.clear();
		}

		if (i < segments.length - 1 && cs.stance) {
			if (cs.stance.terminatesOnSwap === true) {
				cs.stance.end = localCursor;
				cs.stance.terminatesOnSwap = false;
				// barRef is intentionally retained (P4): the finalize pass stamps
				// the owner bar's uptime from `ownerUptime`, which the swap does NOT
				// clamp — a swap-terminated stance keeps its full owner-bar width
				// while `end` clamps to the swap-out time.
				for (const [state, endTime] of cs.states) {
					if (endTime > localCursor) cs.states.set(state, localCursor);
				}
				// Mirror the clamp onto the IR state-window records for this char.
				for (const rec of stateWindowRecs) {
					if (rec.characterId === char.id && rec.end > localCursor) rec.end = localCursor;
				}
			}
		}

		// Swap time before the next character enters
		if (i < segments.length - 1) {
			cursor = localCursor + swapS;
		} else {
			cursor = localCursor;
		}
	}

	// Final pass: any shield windows still open at rotation end fire their
	// onShieldEnd dispatch at their scheduled expiry (clamped to the rotation's
	// observed totalDuration so events don't drift past the timeline ruler).
	dispatchShieldEnds(Infinity);

	// ── P4 finalize: author the IR windows, stamp owner uptimes, and project
	// the track bars from the cast events.

	// 1. Stamp owner uptimes from the window records onto their source cast
	//    events (replaces the old live `bar.uptime += delta` back-channel).
	//    Only stance + summonExt owner casts ever accumulate extension deltas;
	//    every other cast keeps its push-time uptime.
	//    LATENT TRAP (P4): this stamp lands ONLY at finalize, so any mid-parse
	//    reader of a cast's `uptime` on an extendable owner sees the un-extended
	//    push-time value. `inferredStates` (duringSummon detection) is exactly
	//    such a reader — inert today (no char pairs an extendable stationary
	//    summon with duringSummon-gated logic); see the trap note there.
	for (const rec of stanceWindowRecs) rec.castRef.uptime = rec.ownerUptime;
	for (const rec of summonExtRecs) rec.castRef.uptime = rec.ownerUptime;

	// 1b. Project the E/Q bars from the cast events (post-P4 #3). Bars are a
	//     pure per-track projection of the cast records — the bar ↔ cast
	//     bijection and field agreement hold by construction. Built AFTER the
	//     uptime stamps so extended owners project their final width.
	for (const { ev, track } of castRecords) {
		const bar: TimelineBar = {
			start: ev.time,
			uptime: ev.uptime,
			cooldown: ev.cooldown,
			label: ev.label,
			castTime: ev.castTime,
			summonActivatesAt: ev.summonActivatesAt,
			sacProcFired: ev.sacProcFired,
			stackContext: ev.stackContext
		};
		(ev.ability === 'burst' ? track.qBars : track.eBars).push(bar);
		castIdByBar.set(bar, ev.id);
	}

	const windows: TimelineWindow[] = [];

	// 2. Stance windows → `state` windows named "inStance" (post-P4 #4 merge:
	//    a stance is just a state with a source attached). Final ends —
	//    extension-adjusted, swap-clamped.
	for (const rec of stanceWindowRecs) {
		windows.push({
			kind: 'state',
			characterId: rec.characterId,
			name: 'inStance',
			start: rec.start,
			end: rec.end,
			source: rec.source,
			sourceCastId: rec.sourceCastId
		});
	}

	// 3. Named-state windows (swap-clamped ends).
	for (const rec of stateWindowRecs) {
		windows.push({
			kind: 'state',
			characterId: rec.characterId,
			name: rec.name,
			start: rec.start,
			end: rec.end,
			sourceCastId: rec.sourceCastId
		});
	}

	// 4. Shield windows.
	for (const rec of shieldWindowRecs) {
		windows.push({
			kind: 'shield',
			characterId: rec.characterId,
			source: rec.source,
			start: rec.start,
			end: rec.end,
			sourceCastId: rec.sourceCastId
		});
	}

	// 5. Weapon-proc windows (mirror weaponProcBars).
	for (const [characterId, bars] of weaponProcBars) {
		for (const b of bars) {
			windows.push({
				kind: 'weaponProc',
				characterId,
				start: b.start,
				end: b.end,
				sourceCastId: b.sourceCastId
			});
		}
	}

	// 6. Summon windows — one per cast-spawned summon (INCLUDING summons without
	//    durationExtensions), spawn offset applied, with the same terminatesOn
	//    swap/recast truncation summonSubrows.ts applies today (ported here so
	//    consumers can drop the geometry reconstruction). Reads the now-stamped
	//    bar.uptime.
	const charById = new Map(teamChars.map((c) => [c.id, c]));
	const lastSummonWindowByKey = new Map<string, Extract<TimelineWindow, { kind: 'summon' }>>();
	for (let ti = 0; ti < tracks.length; ti++) {
		const track = tracks[ti];
		const summonChar = charById.get(track.characterId);
		// Next swap-out for this character = activeStart of the next track owned
		// by a different character. summonSubrows.ts (the renderer) historically
		// used "next track with a different slotIdx"; the two agree as long as
		// characterId ↔ slotIdx is a bijection over summon-bearing tracks —
		// mapTracksToSlots (RotationTimeline.svelte) maps each slotIdx to exactly
		// one characterId, and the default slot producer `autoSlots` dedupes real
		// characters. The only producers that DON'T dedupe are the `?team=`
		// hand-off (`importTeam`) and shared links (`applyShared`), which pass
		// their id array verbatim; a crafted duplicate-character `?team=` is the
		// sole non-bijective input, but it's an invalid Genshin comp outside the
		// corpus (see the fuller note in computeSummonSubrows). For every real
		// team the two swap-out definitions coincide.
		let swapOutAt = Infinity;
		for (let k = ti + 1; k < tracks.length; k++) {
			if (tracks[k].characterId !== track.characterId) {
				swapOutAt = tracks[k].activeStart;
				break;
			}
		}
		const emitSummon = (bar: TimelineBar, kind: 'skill' | 'burst'): void => {
			if (bar.uptime <= 0) return;
			const summon = findSummonForBar(summonChar, kind, bar.label);
			if (!summon) return;
			const spawnAt = bar.start + (bar.summonActivatesAt ?? 0) / 60;
			let endAt = spawnAt + bar.uptime;
			if (summon.terminatesOn === 'swap' && swapOutAt < endAt) endAt = swapOutAt;
			if (endAt <= spawnAt) return;
			const key = `${track.characterId}::${summon.label}`;
			// Recast truncation: shorten the still-open prior window on this key.
			if (summon.terminatesOn === 'recast') {
				const prev = lastSummonWindowByKey.get(key);
				if (prev && prev.end > spawnAt) prev.end = spawnAt;
			}
			const win: Extract<TimelineWindow, { kind: 'summon' }> = {
				kind: 'summon',
				characterId: track.characterId,
				label: summon.label,
				start: spawnAt,
				end: endAt,
				source: kind,
				sourceCastId: castIdByBar.get(bar)
			};
			windows.push(win);
			lastSummonWindowByKey.set(key, win);
		};
		for (const bar of track.eBars) emitSummon(bar, 'skill');
		for (const bar of track.qBars) emitSummon(bar, 'burst');
	}

	// 7. Sort the event stream by time (stable).
	events.sort((a, b) => a.time - b.time);

	// Deterministic window order (by start, then end).
	windows.sort((a, b) => a.start - b.start || a.end - b.end);

	return {
		tracks,
		totalDuration: cursor,
		unknownTokens,
		events,
		windows
	};
}
