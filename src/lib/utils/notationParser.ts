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
	DamageTag,
	DurationExtension,
	DurationModifier,
	Effect,
	Element,
	NormalAbility,
	NormalHit,
	Reaction,
	ScaledValue,
	SkillAbility,
	Summon,
	TransientStateSpec,
	Trigger
} from '$lib/types/ability';
import {
	getActiveDuration,
	getActiveDurationModifiers,
	getPersistentBehavior,
	getDurationExtensions,
	getSummonActivatesAt,
	getDefaultDamageTag,
	getNormalHitDamageTag,
	getCooldownStartsAtStanceEnd,
	evalTriggerFilter
} from '$lib/types/ability';
import { tokenizeNotation, STACK_ASSERT_RE, type Token } from '$lib/utils/tokenizer';
import { resolveActionElement } from '$lib/utils/actionElement';
import { computeTeamEnabledReactions, computeTeamFactionCounts } from '$lib/utils/teamComposition';
import { getWeaponById } from '$lib/data/weaponLookup';
import {
	GENERIC_NORMAL_HITS,
	GENERIC_CHARGE_FRAMES,
	GENERIC_SKILL,
	GENERIC_BURST
} from '$lib/data/genericProfile';
import type { LoadoutEntry } from '$lib/stores';
import type {
	ActionEvent,
	CastEvent,
	ReactionEvent,
	TimelineEvent,
	TimelineWindow
} from '$lib/utils/rotationEvents';
import { deriveBuffWindows } from '$lib/utils/buffWindows';

// Re-export the IR surface so consumers can import event/window types straight
// from the parser module they already depend on.
export type {
	TimelineEvent,
	TimelineWindow,
	CastEvent,
	ReactionEvent,
	ShieldEndEvent,
	NightsoulBurstEvent
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
	/** Absolute time this cast's clock is mechanically ready again (mirrors
	 *  `CastEvent.readyAt`). The ghost-CD tail ENDS here.
	 *
	 *  ⚠️ CARRIED ON THE BAR BECAUSE THE PILL GEOMETRY NEEDS IT, and carried as
	 *  `readyAt` rather than the raw `cooldownStartDelay` deliberately: readyAt
	 *  is the authoritative "when can this be cast again", so a future dynamic
	 *  cooldown start (a stance whose exit is what starts the clock) moves the
	 *  tail for free instead of needing the geometry taught a second rule.
	 *
	 *  ↻ 2026-08-15: `barPhases` read `cooldown` alone before this and drew the
	 *  tail ending at `start + cooldown`. That divergence WAS documented as
	 *  intentional on `CastEvent.readyAt` ("the visual ghost tail"), and it is
	 *  invisible at the 1–35 frame delays 122 of the 124 delayed abilities
	 *  carry — but on the two that encode "the CD starts when the STANCE ends"
	 *  (Xilonen 540f, Ifa 600f) it is a 9–10 second lie that also flips the pill
	 *  into case B, whose meaning is the exact opposite: "cooldown finished,
	 *  stance still running". ⚓ Nate read it that way and asked why the recast
	 *  was so late — which is the whole argument against the old choice. */
	readyAt?: number;
	/** id of the RESOLVED ability actually cast (mirrors CastEvent.abilityId).
	 *  Disambiguates summon resolution when a state-gated sibling ability
	 *  shares the input token (Durin's dual-form bursts, post-P4 #2). */
	abilityId?: string;
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

/** Raw hit record. PARSER-PRIVATE (post-P4 #1 decision): consumed by the
 *  onHit dispatchers (gainStacks / consumeStacks) and — via the retained
 *  per-parse list — the buff-window derivation pass. NOT part of the public
 *  IR event stream; action events are the public per-action surface and
 *  carry no hit-level records.
 *
 *  Emission sites: one hit per E/Q cast (post-`emitReactionsAtCast`, in
 *  `handleCast`) and one hit per NORMAL SWING / charged / plunge action.
 *  Dash/jump/unset emit no hits; a frameless plunge emits none (matching
 *  its no-event behavior).
 *
 *  Conventions (ratified with the onHit wiring, 2026-07-17):
 *  - **Per-swing = one hit.** Multi-hit swings are not curated (`NormalHit`
 *    carries no hit count; FrameMaps collapse to the last hitmark), so a
 *    swing produces exactly one hit. Effects that count hits without a
 *    procCooldown will undercount on multi-hit swings — a documented
 *    approximation until a `NormalHit.hitCount` consumer appears.
 *  - **`time`** — E/Q casts: the cast start (legacy convention). Actions:
 *    the swing END (`actionEvent.time + duration`; equals the start for
 *    frameless kits) — cancel-window frames are the closest recorded proxy
 *    for the hitmark, and legacy block-driven onHit buffs open at block end.
 *  - **`element` ABSENT ⇒ physical** (the ActionEvent convention). Cast
 *    hits always carry the caster's element.
 *  - `damageTag`/`abilityName`/`isCrit` mirror the renderer's
 *    `resolveCastContext`/`resolveBlockContext` conventions so
 *    `evalTriggerFilter` gating agrees across both surfaces.
 *  - `hitIndex` — the swing's combo index (normals only).
 *  - `stacks` — post-gain, pre-consume snapshot of the hitter's segment
 *    stack state at hit time (the cast-site `stackContext` analog).
 *  - `sourceEventId` — the public cast/action event id that produced the
 *    hit (window provenance for the buff derivation). */
export type HitEvent = {
	characterId: string;
	time: number;
	abilityType: 'skill' | 'burst' | 'normal' | 'charged' | 'plunge';
	element?: Element;
	damageTag: DamageTag;
	abilityName?: string;
	hitIndex?: number;
	stacks?: ReadonlyMap<string, number>;
	sourceEventId: number;
};
// NB: the type export above is for the parser-side buff-window derivation
// (`buffWindows.ts`) ONLY — hit records remain OUTSIDE the public IR event
// stream (post-P4 #1 decision stands; `ParsedRotation` does not expose them).

export type ParsedRotation = {
	tracks: CharacterTrack[];
	totalDuration: number;
	unknownTokens: string[]; // tokens not recognized as valid notation
	/** P4 IR — time-sorted point events (`cast` / `action` / `reaction` /
	 *  `shieldEnd` / `nightsoulBurst`). The sole event surface: cast markers
	 *  drive the timeline rows, `action` events carry the per-swing input
	 *  substrate (post-P4 #2), the reaction/shieldEnd kinds feed effect
	 *  dispatch, and NB events drive the Nightsoul-Burst lane + its
	 *  onTeamNightsoulBurst consumers (post-P4 #5 arc, phase 3). */
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
/** Fallback cast time when no E/Q frame data is present on the ability (seconds).
 *  Sourced from the data-derived generic profile (genericProfile.ts) so a
 *  frameless skill/burst gets a realistic cast length, not a magic constant. */
const E_CAST_S = GENERIC_SKILL.castSwap / 60;
const Q_CAST_S = GENERIC_BURST.castSwap / 60;
const MIN_ACTIVE_S = 0.5; // minimum on-field time when no ~Xs is specified

/**
 * Ceiling on a single `~Xs` time advance, in seconds.
 *
 * ⚠️ This guard was missing entirely: the site read `if (isFinite(delta))` and
 * nothing else, so `Ifa ~99999999s` — FOURTEEN typed characters — parsed happily
 * in 2.5 ms, reported no unknown tokens, and handed a 99,999,999-second duration
 * to a ruler that allocates one tick object per second. That OOM-ed the tab.
 * (docs/parser-hardening-2026-08-14.md §1.)
 *
 * One hour is far past any real rotation — the longest are minutes — while still
 * leaving room for someone deliberately modelling a long wait. ⚠️ It is a
 * per-token ceiling, so it does NOT bound total duration on its own: a document
 * full of small waits still sums. `rulerTicks` in RotationTimeline carries its
 * own independent cap for that, and both are needed.
 */
const MAX_TIME_ADVANCE_S = 3600;

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
 * preserve the prior null-return behavior.
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
	cursor: number,
	/** Which kinds are present at all — see `castKindsByChar`. Skipping a scan
	 *  for an absent kind is where nearly all of this function's cost went. */
	kinds: { hasSkill: boolean; hasBurst: boolean }
): Set<string> {
	const states = new Set<string>();
	const activeDuringSummon = (c: CastEvent) => {
		const activatesAt = c.summonActivatesAt / 60;
		return c.time + activatesAt <= cursor && cursor < c.time + activatesAt + c.uptime;
	};

	/**
	 * ⚠️ NEWEST-FIRST, and that is the whole optimization.
	 *
	 * This is an existence check, so scan ORDER cannot change the answer — but it
	 * changes the cost enormously. `computeCurrentStates` calls this on every
	 * action AND every cast, so a forward scan is O(casts-per-character²): the
	 * 2026-08-14 sweep measured 16,000 bursts on Bennett at 663 ms against 50 ms
	 * for the same input on Keqing, whose abilities are not `stationary` so the
	 * branch never runs at all (docs/parser-hardening-2026-08-14.md §3).
	 *
	 * The cast whose summon window covers `cursor` is overwhelmingly the most
	 * recent one — windows are seconds long and casts arrive in time order — so
	 * from the back the answer is typically the first element tested.
	 *
	 * ⛔ The sweep suggested memoizing with "a boolean that flips once a
	 * qualifying cast is emitted". Do NOT do that: summon windows CLOSE
	 * (`cursor < start + uptime`), so a latching flag would report `duringSummon`
	 * forever after the first cast — a correctness bug traded for speed.
	 */
	const anySummonActive = (kind: CastEvent['ability']) => {
		for (let i = emittedCasts.length - 1; i >= 0; i--) {
			const c = emittedCasts[i];
			if (c.ability === kind && activeDuringSummon(c)) return true;
		}
		return false;
	};

	// ⚠️ `kinds.hasX` FIRST — it is the guard that actually matters. Without it
	// the scan below runs in full on every call for a kind the character has
	// never cast, which was the whole quadratic.
	if (
		kinds.hasBurst &&
		qAbility &&
		getPersistentBehavior(qAbility) === 'stationary' &&
		anySummonActive('burst')
	) {
		states.add('duringSummon');
	}
	if (
		kinds.hasSkill &&
		eAbility &&
		getPersistentBehavior(eAbility) === 'stationary' &&
		anySummonActive('skill')
	) {
		states.add('duringSummon');
	}
	return states;
}

/**
 * Maps the next token after position j to the ActionKey used for cancel-window
 * selection. Returns 'swap' (full animation fallback) for end-of-segment,
 * time advances, optional groups, or anything else that isn't a direct action.
 *
 * `isBow` is threaded for ONE token: KQM's `A` is an aimed shot, which only a
 * bow can take, and which our data models as that bow's fully-charged attack
 * (see the charged branch). So a following `A` selects the 'C' cancel window
 * for a bow and stays 'swap' for anyone else — where the token performs no
 * action at all, and the conservative full animation is the honest reading.
 */
function peekActionKey(tokens: Token[], j: number, isBow: boolean): ActionKey {
	// ⚓ `W` IS SKIPPED, NOT READ (2026-08-13). We do not simulate walk-cancels
	// (⚓ Nate; gcsim does not either — its `walk` has no intrinsic duration, only
	// the frame count you hand it), and the composer says so. But an unread `W`
	// was not free: it is not a key in any FrameMap, so it resolved to 'swap' —
	// the full-animation fallback — and `N1 W N2` silently timed its N1
	// differently from `N1 N2`. A token we tell the user does nothing has to
	// actually do nothing.
	//
	// Skipping is also the closer approximation of the technique: a walk-cancel
	// does not reset the normal-attack string in game — that is exactly what
	// makes it worth doing — so `N1 W N2` really is an N1 followed by an N2, just
	// without the frames the cancel would have saved.
	let k = j + 1;
	while (tokens[k]?.kind === 'label' && tokens[k].text === 'W') k++;
	const next = tokens[k];
	if (!next) return 'swap';
	if (next.kind === 'Q') return 'Q';
	if (next.kind === 'E') return 'E';
	if (next.kind === 'label' || next.kind === 'unknown') {
		const t = next.text;
		if (/^N\d*$/.test(t)) return 'N';
		if (t === 'D') return 'D';
		if (t === 'J') return 'J';
		if (/^C\d*$/.test(t)) return 'C';
		if (t === 'A' && isBow) return 'C';
		if (/^[hl]?P$/.test(t)) return 'P';
	}
	return 'swap';
}

/**
 * Resolves E/Q cast time (seconds) from frame data, selecting the cancel window
 * for the given next-action key. The caller passes the `matchVariant`-resolved
 * variant (e.g. hE, h1E, h2E, sQ) whose frames replace the base's.
 * Characters authored without FrameMaps (pre-release stubs with no gcsim
 * source) fall back to the generic cast constants instead of killing the parse.
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
		// Frameless (uncurated / Blank) → generic charge profile, so a charged
		// attack advances the cursor realistically instead of by zero.
		const frameMap = ability.chargeFrames ?? GENERIC_CHARGE_FRAMES;
		return (frameMap[nextKey] ?? frameMap.swap) / 60;
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
	if (variant?.activeDuration !== undefined) {
		return { duration: variant.activeDuration, modifiers: variant.durationModifiers };
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

/**
 * Hard cap on the TOTAL tokens expansion may produce.
 *
 * ⚠️ `MAX_BRACKET_REPEATS` bounds one multiplicand and this bounds the other.
 * Capping only the count was the 2026-08-14 sweep's second finding: nothing
 * bounded the bracket BODY, so `99[` + 2,000 × `N9` — 4 KB of input — expanded
 * to 1.78 million IR events and ~1 GB of heap, and 24 KB of it OOM-ed the tab
 * outright. Measured ceiling was ~445 IR events per input character.
 * (docs/parser-hardening-2026-08-14.md §2.)
 *
 * 20k is far past legitimate use and still cheap: the heaviest plausible bracket
 * — `99[` around fifty tokens `]` — expands to ~5k, and a realistic twenty-cycle
 * rotation is ~300 tokens parsing in 13 ms. Measured at the cap, the worst case
 * lands near 180k events / ~90 ms: a hitch on a pathological paste, not a freeze.
 * (A first cut used 50k and measured 450k events / 222 ms — correct, but there
 * was no reason to buy headroom nobody can legitimately spend.)
 *
 * ⚠️ Hitting it truncates SILENTLY, which is a deliberate and slightly
 * uncomfortable choice: `unknownTokens` is the only warning channel on
 * `ParsedRotation` and nothing renders it (the editor lint in `notationFlags.ts`
 * took that job), so a flag here would go nowhere. Building a display path for a
 * condition no legitimate input can reach is the speculative abstraction the
 * conventions warn against. ⏭ If a warning channel ever exists, this is a
 * candidate — and the better home is the LINT, which already owns the "we cannot
 * take this" vocabulary and could flag an over-budget group from the text alone.
 */
const MAX_EXPANDED_TOKENS = 20_000;

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
			// Budget check BEFORE appending, so the cap is a ceiling rather than a
			// threshold we overshoot by one body's worth.
			if (result.length + innerTokens.length > MAX_EXPANDED_TOKENS) return result;
			// ⛔ NOT `result.push(...innerTokens)`. Spreading an array as arguments
			// hits V8's argument limit and throws `RangeError: Maximum call stack
			// size exceeded` somewhere north of ~125k elements — and a throw here is
			// worse than the freeze it replaced, because it unwinds through the
			// synchronous $derived that drives the timeline. A plain loop has no
			// such limit. (Same reason the buff-window merge below is a loop.)
			for (const innerTok of innerTokens) result.push(innerTok);
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
 * Resolves ALL summons owned by a given E/Q cast bar (variant-aware). Mirrors
 * `findCastSummons` in `summonSubrows.ts` exactly — the parser now authors the
 * summon `TimelineWindow`s the renderer used to reconstruct, so the spawn/end
 * resolution must agree. Prefers the exact RESOLVED ability (`abilityId` from
 * the cast/bar — a state-gated sibling can carry its own summon, e.g. Durin's
 * Dark burst); falls back to the unconditioned base ability (stance-conditioned
 * variants represent caster state and don't carry summons). Kept parser-side
 * (not imported from summonSubrows) to preserve the parser's runtime-import-free
 * purity — summonSubrows imports back from here.
 *
 * ↻ 2026-08-14 — RETURNS THE WHOLE ARRAY, not `summons[0]`. Three abilities own
 * two summons and the second was silently unreachable: Ineffa's E (a shield
 * barrier with no effects held the lane while BIRGITTA, the thing that ticks
 * every 2s, was never drawn — ⚓ Nate's report), Citlali's E (Opal Shield) and
 * Furina's E (Singer of Many Waters). ⚠ A variant's `summons` OVERRIDES the
 * base wholesale rather than merging, and since 2026-08-14 an EMPTY variant
 * array means NONE rather than falling through — see the note at the return.
 */
function findSummonsForBar(
	char: CharacterData | undefined,
	kind: 'skill' | 'burst',
	label: string,
	abilityId?: string
): Summon[] {
	if (!char) return [];
	const candidates = char.abilities.filter((a): a is CastAbility => a.abilityType === kind);
	const ability =
		(abilityId !== undefined ? candidates.find((a) => a.id === abilityId) : undefined) ??
		candidates.find((a) => a.conditions === undefined) ??
		candidates[0];
	if (!ability) return [];
	const variant = ability.variants?.find((v) => (v.input as string[] | undefined)?.includes(label));
	// ⚠ AN EMPTY `summons: []` ON A VARIANT MEANS "NONE", not "fall through".
	// The `?.[0] ?? ability.summons?.[0]` chain this replaced could not express
	// that — an empty array read as undefined and inherited the base's list —
	// but the schema has always called this field an OVERRIDE, and a curator who
	// writes `[]` is overriding to nothing. Zhongli's hold-E is the case that
	// needs it: it raises a Jade Shield (now an Effect) while the base press-E
	// leaves a 30s Stone Stele, and without an explicit "none" the hold would
	// inherit the stele and draw it at the hold's own 20s window — a stele that
	// lasts 30s, rendered 20s, on a cast that the curation notes have always
	// said does not model the co-spawned stele.
	return variant?.summons ?? ability.summons ?? [];
}

/**
 * The span of one summon within its cast. ⚠ THE PRIMARY IS NOT COMPUTED THE
 * SAME WAY AS THE REST, and that asymmetry is load-bearing: `summons[0]` is
 * what the ability's geometry accessors already resolved into the cast, so its
 * spawn comes from `summonActivatesAt` (which a persistent-summon override or a
 * variant may have retargeted) and its lifetime from the bar's `uptime` (which
 * `durationExtensions` may have grown mid-parse — Collei's Cuilein-Anbar). A
 * secondary summon went through neither, so it reads its OWN authored fields.
 * Today all three multi-summon abilities pair equal durations at different
 * spawn frames, so this only shifts starts — but a secondary with its own
 * duration will be right rather than inheriting the primary's.
 */
function summonSpan(
	barStart: number,
	barSummonActivatesAt: number | undefined,
	barUptime: number,
	summon: Summon,
	index: number
): { start: number; end: number } {
	const start =
		barStart + (index === 0 ? (barSummonActivatesAt ?? 0) : (summon.spawnsAt ?? 0)) / 60;
	return { start, end: start + (index === 0 ? barUptime : summon.duration) };
}

/**
 * Walks a summon's `summonTick` effects over `[spawnAt, endAt)` and emits one
 * entry per interval, paired with the effect that produced it. An effect whose
 * conditions evaluate definitively false is skipped; unresolvable runtime
 * conditions abstain (no ticks), matching the summon lane's behaviour.
 *
 * ⚠ THIS LIVES PARSER-SIDE ON PURPOSE. The renderer had the only copy until
 * 2026-08-15, when the finalize pass started needing tick times to synthesize
 * off-field hits — and the parser stays runtime-import-free, so `summonSubrows`
 * imports back from here (the same direction as `evalCondition`) rather than
 * the parser reaching into `$lib/timeline`. ⛔ Do not fork a second copy the
 * way `findSummonsForBar`/`findCastSummons` were forked; that pair needs a
 * "MUST STAY IDENTICAL" warning precisely because it is duplicated.
 *
 * ⚓ The ascension/state arguments to `evalCondition` are the renderer's
 * (`4`, no states) rather than the parse's live state, and that is load-bearing:
 * it makes the ticks a viewer SEES on the summon bar exactly the hits that fire.
 * A divergence here would show a marker that buffs nothing, or buff off a marker
 * that isn't drawn.
 */
function collectSummonTicks(
	summon: Summon,
	spawnAt: number,
	endAt: number,
	cLevel: number,
	accept: (effect: Effect) => boolean
): { time: number; effect: Effect }[] {
	const ticks: { time: number; effect: Effect }[] = [];
	for (const eff of summon.effects ?? []) {
		if (eff.trigger.type !== 'summonTick') continue;
		if (!accept(eff)) continue;
		if (evalCondition(eff.conditions, 4, new Set(), cLevel) === false) continue;
		const interval = eff.trigger.interval;
		if (!(interval > 0)) continue;
		const firstDelay = eff.trigger.firstTickDelay ?? interval;
		for (let t = spawnAt + firstDelay; t < endAt; t += interval) {
			ticks.push({ time: t, effect: eff });
		}
	}
	ticks.sort((a, b) => a.time - b.time);
	return ticks;
}

/** Tick timestamps for EVERY `summonTick` effect — the summon lane's markers.
 *  Re-exported by `summonSubrows.ts`, which is where it used to live. */
export function computeSummonTicks(
	summon: Summon,
	spawnAt: number,
	endAt: number,
	cLevel: number
): number[] {
	return collectSummonTicks(summon, spawnAt, endAt, cLevel, () => true).map((t) => t.time);
}

/**
 * Tick timestamps for a summon's DAMAGE effects only, with each tick's element.
 *
 * ⚓ A heal tick is not a hit. Four summons pair a heal and a damage effect on
 * the identical interval and first-delay (Diona's Drunken Mist, Kuki's Grass
 * Ring, Kokomi's Bake-Kurage, Mizuki's Mini Baku), so taking every tick would
 * fire each of those summons' onHit consumers TWICE per instant. Filtering to
 * damage is what makes the count right — no dedup pass is needed on top of it,
 * because the only summon carrying multiple damage series is Furina's Salon
 * Solitaire, whose three series are three distinct Salon Members landing three
 * distinct hits (and whose intervals — 3.369/1.626/5.231 — essentially never
 * coincide anyway).
 */
function computeSummonDamageTicks(
	summon: Summon,
	spawnAt: number,
	endAt: number,
	cLevel: number
): { time: number; element?: Element }[] {
	return collectSummonTicks(summon, spawnAt, endAt, cLevel, (eff) => eff.type === 'damage').map(
		(t) => ({ time: t.time, element: (t.effect as Extract<Effect, { type: 'damage' }>).element })
	);
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
 * This dispatcher covers onCast triggers only; onReaction and onHit triggers
 * have their own dispatchers (`dispatchGainStacksOnReaction`,
 * `dispatchGainStacksOnHit` — the latter fires per cast AND per action swing
 * since the onHit wiring, 2026-07-17).
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
 *  geo casts (gating: 2+ Moonsign on team). `teamEnabledReactions` CONVERTS
 *  superConduct → stellarConduct when a Stellar-Conduct enabler is on the
 *  team (replacement, not addition — in game ALL Superconduct converts, and
 *  patched kit texts say "Superconduct or Stellar-Conduct", so consumers
 *  author OR-arrays; see docs/library/game/stellar-reactions.md).
 *
 *  Returns `Reaction` keys matching `src/lib/types/ability.ts`:
 *  swirl, crystallize, lunarCrystallize, vaporize, melt, overloaded, burning,
 *  bloom, electroCharged, frozen, superConduct|stellarConduct, quicken,
 *  aggravate, hyperbloom, burgeon, spread. Note: lunarBloom and lunarCharged
 *  are schema-supported but not yet emitted (no character authoring needs
 *  them via the synthetic emission path; deferred to manual triggers / future
 *  Moonsign reaction surface). stellarSwirl is likewise not emitted until its
 *  7.0 mechanics are confirmed. */
function computeReactionsForCast(
	element: Element,
	aura: AuraState,
	hasMoonsignTeam: boolean,
	teamEnabledReactions: ReadonlySet<string>
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
			if (has('electro'))
				reactions.push(
					teamEnabledReactions.has('stellarConduct') ? 'stellarConduct' : 'superConduct'
				);
			break;
		case 'electro':
			if (has('pyro')) reactions.push('overloaded');
			if (has('hydro')) reactions.push('electroCharged');
			if (has('cryo'))
				reactions.push(
					teamEnabledReactions.has('stellarConduct') ? 'stellarConduct' : 'superConduct'
				);
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
	/** onHit gainStacks accrual for `source: 'team' | 'others'` grants
	 *  (rotation-wide, off-field-inclusive — the onHit analog of
	 *  `onReactionStacks`). `source: 'self'` grants write the hitter's
	 *  per-segment `stackState` instead (per-segment scope — a swap clears
	 *  the pool, matching in-game Yanfei-seal semantics). key → count. */
	onHitStacks: Map<string, number>;
	/** Per-instance expiry stamps for lifetime-bearing team/others onHit
	 *  grants: key → expiry times. */
	onHitStackInstances: Map<string, number[]>;
	/** Per-onHit-effect proc cooldown (`Effect.procCooldown`):
	 *  `${nodeId}#${effectIndex}` → last fire time. Escoffier C6's 0.5s ICD
	 *  is the canonical consumer; mirrors `shieldEndProcCooldown`. */
	onHitProcLastFire: Map<string, number>;
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

/** Shared onHit trigger gate: source scoping + coarse abilityType/damageType
 *  filters + the fine-grained `filter` (G primitive) via `evalTriggerFilter`.
 *  A hit with no `element` is physical (ActionEvent convention).
 *  ⚓ Exported since 2026-08-15 for the artifact onHit branch in
 *  `buffWindows.ts` — that module already imports `evalCondition` from here,
 *  so this crosses the same documented-benign cycle. Reused rather than forked:
 *  a second copy of a trigger gate is how the two ends drift. */
export function onHitTriggerMatches(
	trigger: Extract<Trigger, { type: 'onHit' }>,
	hit: HitEvent,
	holderId: string
): boolean {
	const srcMode = trigger.source ?? 'self';
	if (srcMode === 'self' && holderId !== hit.characterId) return false;
	if (srcMode === 'others' && holderId === hit.characterId) return false;
	if (trigger.abilityType !== undefined) {
		// Array form matches any listed class under one effect (one shared
		// procCooldown clock — Escoffier C6's NA/CA/PL 0.5s ICD).
		const classes = Array.isArray(trigger.abilityType)
			? trigger.abilityType
			: [trigger.abilityType];
		if (!classes.includes(hit.abilityType)) return false;
	}
	const isPhysical = hit.element === undefined || hit.element === 'physical';
	if (trigger.damageType === 'elemental' && isPhysical) return false;
	if (trigger.damageType === 'physical' && !isPhysical) return false;
	return evalTriggerFilter(trigger.filter, {
		damageTag: hit.damageTag,
		element: hit.element ?? 'physical',
		abilityName: hit.abilityName,
		hitIndex: hit.hitIndex,
		// Optimistic-fire: the planner doesn't simulate crit outcomes (mirrors
		// resolveCastContext / resolveBlockContext).
		isCrit: true
	});
}

/** Dispatches a single `HitEvent` to all team characters' `gainStacks` effects
 *  with onHit triggers. Full symmetric dispatch (onHit wiring, 2026-07-17) —
 *  every decay shape is supported, scoped by `trigger.source`:
 *
 *    - `sourceLifetime` — per-source slot expiry map on the holder's
 *      CharState (Skirk A4 shape). Rotation-wide; saturation drops the
 *      earliest-expiry slot.
 *    - `source: 'self'` grants (plain / `lifetime` / `drain`) — write the
 *      hitter's per-SEGMENT `stackState`/`stackInstances`, exactly like the
 *      onCast path (a swap clears the pool — Yanfei's Scarlet Seals). The
 *      hitter is always the segment character, so holder === segment char.
 *    - `source: 'team' | 'others'` grants — rotation-wide `onHitStacks`
 *      accrual (the holder may be off-field). Lint requires a `lifetime`
 *      decay shape here (`gainstacks-onhit-unbounded`); the plain branch is
 *      a defensive saturating fallback for unlinted fixtures.
 *
 *  Effect-level `procCooldown` gates each fire per `${nodeId}#${effIdx}`
 *  (mirrors the onShieldEnd dispatcher's ICD map). Holder runtime states come
 *  from the caller's resolver so state conditions (duringSummon — Escoffier
 *  C6's gate) evaluate against the holder's actual windows at hit time. */
function dispatchGainStacksOnHit(
	allChars: CharacterData[],
	hit: HitEvent,
	getHolderStates: (holder: CharacterData) => ReadonlySet<string>,
	constellationByHolder: Map<string, number>,
	getCharState: (charId: string) => CharState,
	segStackState: Map<string, number>,
	segStackInstances: Map<string, number[]>
): void {
	for (const holder of allChars) {
		const sources = [
			...holder.abilities,
			...(holder.passives ?? []),
			...(holder.constellations ?? [])
		];
		for (const src of sources) {
			const effects = src.effects ?? [];
			for (let effIdx = 0; effIdx < effects.length; effIdx++) {
				const fx = effects[effIdx];
				if (fx.type !== 'gainStacks') continue;
				if (fx.trigger.type !== 'onHit') continue;
				if (!onHitTriggerMatches(fx.trigger, hit, holder.id)) continue;
				const isSelf = holder.id === hit.characterId;
				const holderStates = getHolderStates(holder);
				const holderCons = constellationByHolder.get(holder.id) ?? 0;
				// Self-holder conditions read the hitter's live segment stack
				// state; off-field holders have no segment state (their stack
				// conditions resolve against an empty map — pre-existing gap).
				const condStacks = isSelf ? segStackState : new Map<string, number>();
				const condResult = evalCondition(
					fx.conditions,
					DEFAULT_ASCENSION,
					holderStates,
					holderCons,
					new Map(),
					condStacks
				);
				if (condResult !== true) continue;
				const hcs = getCharState(holder.id);
				// Effect-level ICD (Escoffier C6: 0.5s). ScaledValue procCooldowns
				// are weapon-shaped and don't occur on character effects.
				const pc = fx.procCooldown;
				const pcNum = typeof pc === 'number' ? pc : undefined;
				if (pcNum !== undefined && pcNum > 0) {
					const fxKey = `${src.id}#${effIdx}`;
					const last = hcs.onHitProcLastFire.get(fxKey) ?? -Infinity;
					if (hit.time - last < pcNum) continue;
					hcs.onHitProcLastFire.set(fxKey, hit.time);
				}
				let effAmount = fx.amount;
				if (fx.constellationScaling) {
					const csResult = evalCondition(
						fx.constellationScaling.conditions,
						DEFAULT_ASCENSION,
						holderStates,
						holderCons,
						new Map(),
						condStacks
					);
					if (csResult === true) effAmount = fx.constellationScaling.amount;
				}
				if (fx.sourceLifetime !== undefined) {
					// update per-source slot
					const charMap = hcs.sourceLifetime;
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
				} else if (isSelf) {
					// Segment-scoped grant — mirrors the onCast dispatch branches.
					if (fx.lifetime !== undefined) {
						const expiry = hit.time + fx.lifetime;
						const instances = segStackInstances.get(fx.key) ?? [];
						for (let i = 0; i < effAmount; i++) instances.push(expiry);
						if (fx.max !== undefined && instances.length > fx.max) {
							instances.splice(0, instances.length - fx.max);
						}
						segStackInstances.set(fx.key, instances);
						segStackState.set(fx.key, instances.length);
					} else {
						const current = segStackState.get(fx.key) ?? 0;
						const next = current + effAmount;
						segStackState.set(fx.key, fx.max !== undefined ? Math.min(next, fx.max) : next);
					}
					if (fx.drain) hcs.drainAnchors.set(fx.key, hit.time);
				} else if (fx.lifetime !== undefined) {
					// team/others — rotation-wide instance accrual (onReaction shape).
					const expiry = hit.time + fx.lifetime;
					const instances = hcs.onHitStackInstances.get(fx.key) ?? [];
					for (let i = 0; i < effAmount; i++) instances.push(expiry);
					if (fx.max !== undefined && instances.length > fx.max) {
						instances.splice(0, instances.length - fx.max);
					}
					hcs.onHitStackInstances.set(fx.key, instances);
					hcs.onHitStacks.set(fx.key, instances.length);
				} else {
					// team/others without a decay shape — lint-rejected; saturate
					// defensively so unlinted fixtures stay bounded at `max`.
					const current = hcs.onHitStacks.get(fx.key) ?? 0;
					const next = current + effAmount;
					hcs.onHitStacks.set(fx.key, fx.max !== undefined ? Math.min(next, fx.max) : next);
				}
			}
		}
	}
}

/** Dispatches a single `HitEvent` to all team characters' `consumeStacks`
 *  effects with onHit triggers — the consume mirror of
 *  `dispatchGainStacksOnHit` (Yanfei: charged-attack hit consumes all Scarlet
 *  Seals). `source: 'self'` consumes from the hitter's segment
 *  `stackState`/`stackInstances`; `'team'`/`'others'` consume from the
 *  holder's rotation-wide onHit accrual maps. Called AFTER the hit's `stacks`
 *  snapshot so hit-anchored consumers read the pre-consume value (the cast
 *  pipeline's snapshot-then-consume order). No procCooldown gating — consume
 *  ICD semantics have no corpus consumer and are deliberately unspecified. */
function dispatchConsumeStacksOnHit(
	allChars: CharacterData[],
	hit: HitEvent,
	getHolderStates: (holder: CharacterData) => ReadonlySet<string>,
	constellationByHolder: Map<string, number>,
	getCharState: (charId: string) => CharState,
	segStackState: Map<string, number>,
	segStackInstances: Map<string, number[]>
): void {
	for (const holder of allChars) {
		const sources = [
			...holder.abilities,
			...(holder.passives ?? []),
			...(holder.constellations ?? [])
		];
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.type !== 'consumeStacks') continue;
				if (fx.trigger.type !== 'onHit') continue;
				if (!onHitTriggerMatches(fx.trigger, hit, holder.id)) continue;
				const isSelf = holder.id === hit.characterId;
				const holderStates = getHolderStates(holder);
				const holderCons = constellationByHolder.get(holder.id) ?? 0;
				const condStacks = isSelf ? segStackState : new Map<string, number>();
				const condResult = evalCondition(
					fx.conditions,
					DEFAULT_ASCENSION,
					holderStates,
					holderCons,
					new Map(),
					condStacks
				);
				if (condResult !== true) continue;
				const hcs = getCharState(holder.id);
				const state = isSelf ? segStackState : hcs.onHitStacks;
				const instances = isSelf ? segStackInstances : hcs.onHitStackInstances;
				if (fx.amount === 'all') {
					state.set(fx.key, 0);
					instances.delete(fx.key);
				} else {
					const current = state.get(fx.key) ?? 0;
					state.set(fx.key, Math.max(0, current - fx.amount));
					const inst = instances.get(fx.key);
					if (inst && inst.length > 0) {
						inst.splice(0, Math.min(fx.amount, inst.length));
					}
				}
			}
		}
	}
}

/** Syncs the holder's per-segment `stackState`/`stackInstances` from the
 *  rotation-wide onHit accrual maps (`onHitStacks`/`onHitStackInstances`) —
 *  the onHit analog of `syncOnReactionToStackState`, covering ONLY
 *  `source: 'team' | 'others'` grants. `source: 'self'` grants live directly
 *  in the segment state (never synced from rotation-wide maps — syncing them
 *  here would zero a fresh segment's own accrual), and `sourceLifetime` keys
 *  are owned by `syncSourceLifetimeToStackState`. */
function syncOnHitToStackState(
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
	const keysOnHit = new Map<string, { lifetime: boolean }>();
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.type !== 'gainStacks') continue;
			if (fx.trigger.type !== 'onHit') continue;
			const srcMode = fx.trigger.source ?? 'self';
			if (srcMode === 'self') continue;
			if (fx.sourceLifetime !== undefined) continue;
			if (keysOnHit.has(fx.key)) continue;
			keysOnHit.set(fx.key, { lifetime: fx.lifetime !== undefined });
		}
	}
	if (keysOnHit.size === 0) return;
	const hcs = getCharState(holder.id);
	const holderInstances = hcs.onHitStackInstances;
	const holderState = hcs.onHitStacks;
	for (const [key, meta] of keysOnHit) {
		if (meta.lifetime) {
			const instances = holderInstances.get(key);
			if (!instances || instances.length === 0) {
				stackState.set(key, 0);
				stackInstances.set(key, []);
				holderState.set(key, 0);
				continue;
			}
			const remaining = instances.filter((exp) => exp > currentTime);
			if (remaining.length !== instances.length) {
				holderInstances.set(key, remaining);
				holderState.set(key, remaining.length);
			}
			stackState.set(key, remaining.length);
			stackInstances.set(key, [...remaining]);
		} else if (holderState.has(key)) {
			stackState.set(key, holderState.get(key)!);
		} else {
			stackState.set(key, 0);
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
	loadoutMap?: Record<string, LoadoutEntry>,
	teamCharacters?: (CharacterData | null)[]
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
		/** id of the opening `cast` event — absent on action-opened windows. */
		sourceCastId?: number;
		/** id of the opening `action` event (post-P4 #2 — plunge/normal-opened
		 *  transient states: Varesa Apex Drive, Durin's dark commit). At most
		 *  one of the two provenance ids is set. */
		sourceActionId?: number;
		/** Opening cast kind, for cast-opened transients. Required when the
		 *  transient's state is `inStance` (the IR invariant: every inStance
		 *  window knows its opener — Cyno's skill-opened 6s Pathclearer). */
		source?: 'skill' | 'burst';
	}[] = [];
	const shieldWindowRecs: {
		characterId: string;
		source: 'skill' | 'burst';
		start: number;
		end: number;
		sourceCastId: number;
		label?: string;
		coveredBySummon?: true;
	}[] = [];

	// Close an open named state at `at` (gcsim DeleteStatus): clamp the live
	// CharState entry and every open window record. Shared by the variant
	// `consumesState` clamp and TransientStateSpec `consumes` (post-P4 #2).
	// No-op when the state isn't currently open past `at` — a record clamped
	// by an earlier close stays clamped.
	const closeStateWindows = (cs: CharState, characterId: string, name: string, at: number) => {
		const openEnd = cs.states.get(name);
		if (openEnd === undefined || openEnd <= at) return;
		cs.states.set(name, at);
		for (const rec of stateWindowRecs) {
			if (rec.characterId === characterId && rec.name === name && rec.end > at) {
				rec.end = at;
			}
		}
	};

	// Open a post-action transient state (sQ primitive, generalized post-P4
	// #2): shared by the instant-cast `opensTransientState` site and the
	// per-action `actionOpensState` sites (plunge landing, normal first-swing
	// recovery). Evaluates the spec's conditions against the caller's state
	// snapshot, closes any `consumes` targets at the open instant, and pushes
	// the window record with the caller's provenance (cast XOR action id).
	const openTransientState = (
		spec: TransientStateSpec,
		cs: CharState,
		characterId: string,
		openAt: number,
		states: ReadonlySet<string>,
		constellationLevel: number,
		provenance: { sourceCastId?: number; sourceActionId?: number; source?: 'skill' | 'burst' },
		chainIdx?: ChainIndex,
		stackState?: ReadonlyMap<string, number>
	): void => {
		if (
			spec.conditions !== undefined &&
			evalCondition(
				spec.conditions,
				DEFAULT_ASCENSION,
				states,
				constellationLevel,
				chainIdx,
				stackState
			) !== true
		) {
			return;
		}
		if (spec.consumes) {
			for (const name of spec.consumes) closeStateWindows(cs, characterId, name, openAt);
		}
		const stateEnd = openAt + spec.duration;
		cs.states.set(spec.state, stateEnd);
		stateWindowRecs.push({
			characterId,
			name: spec.state,
			start: openAt,
			end: stateEnd,
			sourceCastId: provenance.sourceCastId,
			sourceActionId: provenance.sourceActionId,
			// Only inStance windows carry `source` (IR invariant) — a transient
			// that OPENS inStance (Cyno's skill-opened Pathclearer) must name
			// its opener like a stance window; other transients stay bare.
			source: spec.state === 'inStance' ? provenance.source : undefined
		});
		if (spec.terminatesOnSwap) cs.statesTerminatingOnSwap.add(spec.state);
	};
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
	// Parser-private hit stream (onHit wiring, 2026-07-17): one record per E/Q
	// cast + per normal swing / charged / plunge action, in emission order.
	// Consumed by the buff-window derivation pass at finalize; NOT public IR.
	const hitRecords: HitEvent[] = [];
	// Per-character cast events emitted so far — the mid-parse record that
	// `computeCurrentStates` reads for duringSummon detection (replaces the old
	// prevBars/track-bars walk).
	const castsByChar = new Map<string, CastEvent[]>();
	/**
	 * Which cast KINDS a character has emitted so far — an incremental index over
	 * `castsByChar`, scanned in `castKinds()` below.
	 *
	 * ⚠️ This exists purely to stop `inferredStates` scanning for a kind that is
	 * not there. Measured 2026-08-14: `inferredStates` was 76% of parse time on a
	 * cast-heavy rotation (396 ms → 94 ms with it stubbed out), and the reason is
	 * counter-intuitive — it is NOT the matching scan that costs, it is the
	 * MISSING one. A run of pure bursts makes the skill branch walk every cast,
	 * every call, and never match; a run of pure skills does the same to the burst
	 * branch. Interleaved E/Q was measurably FASTER than either pure run (180 ms
	 * vs ~400 ms) because both branches hit a match immediately.
	 *
	 * `scanned` is a high-water mark, so each cast is visited exactly once across
	 * the whole parse — and the flags only ever go true, which is sound because a
	 * cast is never removed. Parse-scope rather than segment-scope on purpose:
	 * per-segment state would re-walk the array once per segment, restoring the
	 * quadratic for a rotation with many segments.
	 */
	const castKindsByChar = new Map<
		string,
		{ scanned: number; hasSkill: boolean; hasBurst: boolean }
	>();
	const castKinds = (charId: string, casts: readonly CastEvent[]) => {
		let k = castKindsByChar.get(charId);
		if (!k) {
			k = { scanned: 0, hasSkill: false, hasBurst: false };
			castKindsByChar.set(charId, k);
		}
		for (; k.scanned < casts.length; k.scanned++) {
			const ability = casts[k.scanned].ability;
			if (ability === 'skill') k.hasSkill = true;
			else if (ability === 'burst') k.hasBurst = true;
		}
		return k;
	};
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
				drainAnchors: new Map(),
				onHitStacks: new Map(),
				onHitStackInstances: new Map(),
				onHitProcLastFire: new Map()
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

	// Reactions the party enables (Stellar model). Prefers the SLOT roster:
	// an enabler's mere presence in the party converts the base reaction
	// (Sandrone in slot 4 with zero casts still turns every Superconduct into
	// Stellar-Conduct), so the segment roster is only the no-slots fallback.
	const teamEnabledReactions = teamCharacters
		? computeTeamEnabledReactions(teamCharacters)
		: computeTeamEnabledReactions(teamChars);

	// Shared holder-constellation map for the onHit dispatchers (the reaction
	// dispatch sites build theirs inline per fire — left untouched).
	const constellationByHolder = new Map(
		teamChars.map((c) => [c.id, constellationLevels?.[c.id] ?? 0])
	);

	// Team-level pre-check: hit STACK dispatch (and the drain/lifetime settle
	// it requires at action sites) only runs when someone on the team actually
	// authors an onHit gainStacks/consumeStacks. Guards corpus-wide float
	// identity of drain settling — without an onHit consumer, drain anchors
	// advance ONLY at cast sites, exactly as before the wiring.
	const teamHasOnHitStackEffects = teamChars.some((c) =>
		[...c.abilities, ...(c.passives ?? []), ...(c.constellations ?? [])].some((src) =>
			(src.effects ?? []).some(
				(fx) =>
					(fx.type === 'gainStacks' || fx.type === 'consumeStacks') && fx.trigger.type === 'onHit'
			)
		)
	);

	// Resolved runtime states for ANY holder at time `t` — the onHit-dispatch
	// analog of the per-segment `computeCurrentStates`, usable for OFF-FIELD
	// holders (Escoffier C6 gates on HER `duringSummon` while a teammate's
	// hit fires the trigger). The summon-activity check is deliberately
	// BROADER than `inferredStates` (stationary-only): a following summon
	// (Cooking Mek) counts. Scoped to onHit dispatch condition eval — variant
	// resolution and the legacy duringSummon inference are untouched.
	// Mid-parse approximation: an extendable summon owner's `uptime` is the
	// pre-extension value until finalize (the `inferredStates` latent trap,
	// documented there).
	const holderStatesAt = (holder: CharacterData, t: number): ReadonlySet<string> => {
		const states = new Set<string>();
		const hcs = charStates.get(holder.id);
		if (hcs) {
			if (hcs.stance !== undefined && hcs.stance.start <= t && hcs.stance.end > t)
				states.add('inStance');
			for (const [name, end] of hcs.states) if (end > t) states.add(name);
		}
		const casts = castsByChar.get(holder.id);
		if (casts) {
			for (const c of casts) {
				if (c.uptime <= 0) continue;
				// ⚠ PRIMARY ONLY, deliberately. `duringSummon` gates effects on
				// "is this character's summon out" (Escoffier C6), and the
				// ability's own geometry — the accessors that produced
				// `summonActivatesAt` and `uptime` — is that answer. Widening it
				// to every summon in `summons[]` would silently extend those
				// gates by whatever a secondary's spawn/lifetime happen to be,
				// which is a semantic change nobody asked for; the lane-emission
				// site below is where the extra summons became visible.
				const summon = findSummonsForBar(holder, c.ability, c.label, c.abilityId)[0];
				if (!summon) continue;
				const start = c.time + c.summonActivatesAt / 60;
				if (t >= start && t < start + c.uptime) {
					states.add('duringSummon');
					break;
				}
			}
		}
		return states;
	};

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
	 *  🐛 THE TWO ARE A PRECEDENCE, NOT A UNION (fixed 2026-08-14). They used to
	 *  both run, so an ability satisfying both registered TWO identical windows
	 *  and fired TWO `shieldEnd` events per cast — seven abilities did (Baizhu Q,
	 *  Citlali E, Ineffa E, Kirara E, Layla E, Thoma E, Xinyan E). Noelle's
	 *  curator notes document the trap from the far side: her skill's shield
	 *  Effect is authored deliberately WITHOUT a `duration` so the summon stays
	 *  "the single onShieldEnd source", or her C4 Geo explosion would double-fire.
	 *  The data should not have to be shaped around this. Case 2 wins because it
	 *  is the EXPLICIT statement — a shield Effect with its own duration says the
	 *  shield's length outright, where case 1 infers it from a summon's lifetime
	 *  that merely coincides. All seven pairs carry equal durations today, so
	 *  this removes duplicates and changes no span.
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
		variant: AbilityVariant | undefined,
		sourceCastId: number
	): void => {
		// ⚠ VARIANT FIRST, for both halves. A variant's `effects` and `summons`
		// each REPLACE the base ability's (see AbilityVariant in types/ability),
		// so a hold-E shield reads its own duration rather than the tap's —
		// Diona 12s not 4.8s, Candace 1.52s not 0.27s — and Zhongli, whose Jade
		// Shield lives only on his hE variant, gets a shield window at all.
		const abilityEffects = variant?.effects ?? activeAbility.effects ?? [];
		const abilitySummons =
			(variant?.summons?.length ? variant.summons : activeAbility.summons) ?? [];
		const abilityTags = variant?.tags ?? activeAbility.tags;
		const windows: {
			ability: 'skill' | 'burst';
			endTime: number;
			label?: string;
			coveredBySummon?: boolean;
		}[] = [];
		// Case 2 FIRST — it is the one that wins (see the precedence note above).
		// `Effect.type === 'shield'` on the cast ability itself, with onCast
		// trigger + explicit duration. Triggers gated on the cast type via
		// `trigger.ability` (if set) must match the current cast.
		for (const eff of abilityEffects) {
			if (eff.type !== 'shield') continue;
			if (eff.trigger.type !== 'onCast') continue;
			if (eff.trigger.ability !== undefined && eff.trigger.ability !== castKind) continue;
			if (eff.duration === undefined || eff.duration <= 0) continue;
			windows.push({
				ability: castKind,
				endTime: castTime + eff.duration,
				...(eff.label !== undefined ? { label: eff.label } : {})
			});
		}
		// Case 1: summon-tagged shield ability — the FALLBACK, for kits whose
		// shield has no Effect of its own AT ALL.
		// ⚠ THE GUARD IS "no shield Effect", not "case 2 produced nothing".
		// Thoma's burst is why: it authors its shield as an onHit effect (8s,
		// refreshing on team normal hits), which this onCast site cannot fire —
		// so case 2 came back empty and the fallback happily inferred a shield
		// from "Scorching Ooyoroi", his 15s FIELD. An 8s shield rendered as a
		// 15s one, from a summon that isn't a shield. An ability that states a
		// shield Effect has spoken; if this site can't fire it, the answer is
		// nothing, not a guess off the nearest summon.
		const authorsShieldEffect = abilityEffects.some((e) => e.type === 'shield');
		// ⏸️ DORMANT SINCE 2026-08-14 and kept deliberately: every corpus shield
		// now authors an Effect, so nothing reaches this branch. It survives
		// because a kit CAN still legitimately be authored the old way, and
		// silently dropping its shield would be worse than a fallback nobody
		// currently needs. If it ever fires again, `coveredBySummon` below is
		// what stops the shield lane drawing what the summon lane already has.
		if (windows.length === 0 && !authorsShieldEffect && abilityTags?.includes('shield')) {
			const primary = abilitySummons[0];
			if (primary?.duration !== undefined && primary.duration > 0) {
				// The stand-in summon's label IS the shield's name in this
				// convention, so it rides along rather than being lost.
				windows.push({
					ability: castKind,
					endTime: castTime + primary.duration,
					label: primary.label
				});
			}
		}
		if (windows.length === 0) return;
		// ── Is this shield ALREADY DRAWN, as a summon? ────────────────────────
		// ⚓ 2026-08-14, and it is a reconciliation of two authoring conventions
		// for one fact, not a heuristic about art. Before shield windows existed,
		// the only way to get a shield onto the chart was to author it as a
		// `summons[]` entry with no effects — nine abilities still do (Layla's
		// "Curtain of Slumber", Zhongli's "Jade Shield", Noelle's "Stone Armor"…).
		// Those entries ARE the shield: same span, drawn in the summon lane. Now
		// that the shield lane draws shield windows, they would be drawn twice.
		//
		// The test is EXACT, and both halves matter: a summon with NO effects of
		// its own (a real summon does something — Itzpapa ticks, Birgitta ticks)
		// AND whose duration is this shield's duration. ⚠ That second half is
		// what saves Thoma's burst: "Scorching Ooyoroi" is a genuine 15s field
		// that carries no effects yet, and his burst shield is 8s — it is not the
		// same thing, so his field keeps its lane.
		//
		// ⛔ THE FIX IS NOT TO DELETE THOSE SUMMON ENTRIES, tempting as it looks.
		// For five of them (Kirara, Layla, Thoma E, Xinyan, Noelle) the shield is
		// the ability's ONLY summon, so `summons[0]` is also what gives the E BAR
		// its active duration — deleting it would collapse a 12s bar to an instant
		// pill. Retiring the convention properly means authoring `activeDuration`
		// alongside, which is a data round with a visual verdict attached.
		const shieldSummons = abilitySummons;
		for (const w of windows) {
			const dur = w.endTime - castTime;
			w.coveredBySummon = shieldSummons.some(
				(s) => (s.effects?.length ?? 0) === 0 && Math.abs(s.duration - dur) < 1e-9
			);
		}
		const existing = getCharState(char.id).shields;
		for (const w of windows) {
			existing.push(w);
			// IR shield window (append-only; not drained like the dispatch queue).
			shieldWindowRecs.push({
				characterId: char.id,
				source: w.ability,
				start: castTime,
				end: w.endTime,
				sourceCastId,
				...(w.label !== undefined ? { label: w.label } : {}),
				...(w.coveredBySummon ? { coveredBySummon: true as const } : {})
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
				// touching the per-segment copy the sync just rewrote. Same for
				// team/others-sourced onHit lifetime keys (rotation-wide, owned
				// by `syncOnHitToStackState`); self-sourced onHit instances ARE
				// segment-scoped and expire here like the onCast shape.
				if (fx.trigger.type === 'onReaction') continue;
				if (
					fx.trigger.type === 'onHit' &&
					(fx.trigger.source === 'team' || fx.trigger.source === 'others')
				)
					continue;
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
		const reactions = computeReactionsForCast(
			element,
			auraState,
			hasMoonsignTeam,
			teamEnabledReactions
		);
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
		// The cast's parser-private hit is built + dispatched by handleCast
		// immediately after this call (onHit wiring 2026-07-17 — the hit needs
		// the resolved ability/variant context this closure doesn't see). Same
		// dispatch instant and ordering as the legacy tail dispatch here.
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
			const states = inferredStates(
				charCasts,
				eAbility,
				qAbility,
				cursor,
				castKinds(char.id, charCasts)
			);
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

		// Settle the segment character's stack machinery at an ACTION-site hit
		// instant: the cast pipeline's settle block minus `dispatchShieldEnds`
		// (shieldEnd events are public IR — firing them at action sites would
		// change event times; they stay cast-site + rotation-end only). Only
		// invoked when the team authors onHit stack effects (see
		// `teamHasOnHitStackEffects`), preserving cast-site-only drain anchoring
		// for the rest of the corpus.
		const settleStacksAt = (t: number): void => {
			const states = computeCurrentStates(t);
			applyDrain(char, t, states, stackState);
			applyLifetimeExpiry(char, t, stackState, stackInstances);
			syncSourceLifetimeToStackState(char, t, stackState, getCharState);
			syncOnReactionToStackState(char, t, stackState, stackInstances, getCharState);
			syncOnHitToStackState(char, t, stackState, stackInstances, getCharState);
		};

		// Dispatches a parser-private hit: gains → stacks snapshot → consumes →
		// record. `settle` is true at action sites (the cast pipeline already
		// settled at the cast instant). The hit's `stacks` snapshot is post-gain
		// pre-consume (the cast `stackContext` convention); cast-site hits carry
		// the cast's own snapshot instead (pre-set by the caller).
		const dispatchHit = (hit: HitEvent, settle: boolean): void => {
			if (teamHasOnHitStackEffects) {
				if (settle) settleStacksAt(hit.time);
				// One resolver for every holder (self included) — onHit condition
				// eval gets uniform state semantics regardless of who holds the
				// effect (holderStatesAt's summon check is broader than the
				// segment's `computeCurrentStates`; see its decl).
				const getHolderStates = (holder: CharacterData): ReadonlySet<string> =>
					holderStatesAt(holder, hit.time);
				dispatchGainStacksOnHit(
					teamChars,
					hit,
					getHolderStates,
					constellationByHolder,
					getCharState,
					stackState,
					stackInstances
				);
				if (hit.stacks === undefined && stackState.size > 0) hit.stacks = new Map(stackState);
				dispatchConsumeStacksOnHit(
					teamChars,
					hit,
					getHolderStates,
					constellationByHolder,
					getCharState,
					stackState,
					stackInstances
				);
			}
			hitRecords.push(hit);
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
				const nextKey = peekActionKey(expandedTokens, j, isBow);

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
				// Appended by the onHit wiring (2026-07-17) — an APPEND to the
				// frozen settle order, not a reorder: syncs team/others-sourced
				// onHit accrual into the segment before conditions read it.
				syncOnHitToStackState(char, castStart, stackState, stackInstances, getCharState);
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
				// Resolved stance fields — read HERE (rather than at the window-open
				// site below) because `readyAt` needs them: a stance whose cooldown
				// CLOCK starts at the stance END is castable again at
				// `stanceEnd + cd`, not `cast + cd`.
				const stance = resolveStanceFields(active, variant);
				// ⚓ Xilonen / Ifa. `dur` is the resolved stance length, so this lands
				// on the same instant the old `cooldownStartDelay == duration` hack
				// computed — but as a STATEMENT of intent, which the swap-close site
				// can then move EARLIER when the stance is cut short. Guarded on the
				// RESOLVED behavior so a variant that overrides the stance away does
				// not pick up a stance-end clock it has no stance for.
				const cdStartsAtStanceEnd =
					stance.behavior === 'stance' && getCooldownStartsAtStanceEnd(active);
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
					readyAt: cdStartsAtStanceEnd
						? castStart + dur + cd
						: castStart + (active.cooldownStartDelay ?? 0) / 60 + cd,
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
				// Mavuika hE and Collei-shape Q open via variant. (`stance` is
				// resolved above, where readyAt needs it.)
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
					if (stance.behavior === 'instant') {
						openTransientState(
							active.opensTransientState,
							cs,
							char.id,
							castStart,
							states,
							charConstellationLevel,
							{ sourceCastId: castId, source: kind },
							chainIdx,
							stackState
						);
					}
				}
				// Variant consumes a transient state (gcsim DeleteStatus on cast):
				// Thunderous Symphony closes `symphonyWindow`, Volcano Kablam closes
				// `apexDrive`. The cast itself resolved under the pre-close `states`
				// snapshot, so ordering within this cast is immaterial; the window
				// record is clamped to the cast start for rendering.
				if (variant?.consumesState !== undefined) {
					closeStateWindows(cs, char.id, variant.consumesState, castStart);
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
				registerShieldOnCast(char, kind, castStart, active, variant, castId);
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
				// Parser-private hit for this cast (onHit wiring): dispatched at
				// the same post-aura-update instant the legacy tail dispatch in
				// emitReactionsAtCast used, now carrying the resolved damageTag/
				// name + the cast's pre-consume stack snapshot. Skipped for
				// element-less characters — preserving the legacy behavior where
				// the reaction emitter's early-return also skipped the hit.
				if (char.element) {
					dispatchHit(
						{
							characterId: char.id,
							time: castStart,
							abilityType: kind,
							element: char.element,
							damageTag: getDefaultDamageTag(active, variant),
							abilityName: variant?.label ? `${active.name} ${variant.label}` : active.name,
							stacks,
							sourceEventId: castId
						},
						false
					);
				}
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
					// isFinite alone let `~99999999s` through — see MAX_TIME_ADVANCE_S.
					if (isFinite(delta)) localCursor += Math.min(delta, MAX_TIME_ADVANCE_S);
				}
			} else if (tok.kind === 'unset-time') {
				emitAction({ action: 'unset', label: '~?', time: localCursor, duration: MIN_ACTIVE_S });
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
				const nextKey = peekActionKey(expandedTokens, j, isBow);

				if (/^N\d*$/.test(t)) {
					// Normal attack: N5 means "perform 5 normals in a row" starting from
					// the current normalCounter. Intermediate hits use 'N' as their
					// lookahead (next action is another normal); the final hit uses nextKey.
					// Each swing emits an action event; the finalize pass projects the
					// group into one block labeled "N5" (post-P4 #2).
					// Active normal ability is resolved per-token to handle mid-segment
					// stance transitions (e.g. Cyno Q → in-stance normals).
					const count = t.length > 1 ? parseInt(t.slice(1)) : 1;
					const nStates = computeCurrentStates(localCursor);
					const activeNormal = resolveActiveAbility(
						char,
						'normal',
						nStates,
						charConstellationLevel
					);
					// Frameless normals (uncurated stubs with hits:[], Blank) ride the
					// generic combo profile so swings get realistic per-position timing
					// instead of collapsing to zero duration. `swap`-presence on the
					// first hit is the same framed-vs-not sentinel isCurated uses.
					const rawHits = activeNormal?.hits;
					const hits = Number.isFinite(rawHits?.[0]?.frames?.swap) ? rawHits! : GENERIC_NORMAL_HITS;
					// Infusion rule shared with the notation highlighter (actionElement.ts).
					const nElement = resolveActionElement(
						'normal',
						t,
						char.weapon,
						char.element,
						activeNormal?.infusion
					);
					// Per-swing action events sharing one blockId (the anchor = the
					// first swing's id). `time` is the swing's pre-advance start.
					let anchorId: number | undefined;
					for (let k = 0; k < count; k++) {
						const hitIndex = normalCounter % hits.length;
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
						if (castS !== null) localCursor += castS;
						normalCounter++;
						// Normal-opened transient state (post-P4 #2): the FIRST swing's
						// recovery opens the window, once per N token — the analog of
						// the plunge-landing opener. Gated on the token-start state
						// snapshot (the same one that resolved this ability); the
						// activeNormal is NOT re-resolved for later swings, matching
						// the parser's per-token resolution altitude. Durin's dark
						// commit (N during `transmuting` → `darkForm`) rides this.
						const nSpec = activeNormal?.actionOpensState?.normal;
						if (k === 0 && nSpec) {
							openTransientState(nSpec, cs, char.id, localCursor, nStates, charConstellationLevel, {
								sourceActionId: ev.id
							});
						}
						// Parser-private per-swing hit (onHit wiring): swing-END time,
						// per-hit damageTag override honored, combo index feeding
						// filter.hitIndex. Dispatched AFTER the transient-state opener
						// so a state the swing itself opens is visible to hit-gated
						// conditions. Per-swing = one hit (multi-hit swings are not
						// curated — see the HitEvent decl).
						dispatchHit(
							{
								characterId: char.id,
								time: localCursor,
								abilityType: 'normal',
								element: nElement,
								damageTag: hits?.[hitIndex]
									? getNormalHitDamageTag(hits[hitIndex], 'normal')
									: 'normal',
								abilityName: activeNormal?.name,
								hitIndex,
								sourceEventId: ev.id
							},
							true
						);
					}
				} else if (/^C\d*$/.test(t) || (t === 'A' && isBow)) {
					// Charged attack: resolve active normal (in-stance if applicable) for
					// chargeFrames/chargeHits. Bow uses chargeHits, others use chargeFrames.
					//
					// ⚓ `A` IS AN ALIAS, NOT A NEW ACTION (2026-08-13). KQM writes a bow's
					// aimed shot as `A`; we have always modelled it as that bow's CHARGED
					// attack — `chargeHits` holds the aimed-shot frames, and
					// resolveActionElement already carries the rule that a bow's charged
					// shot is elemental except the C1 partial. So the only thing missing
					// was the token, and a KQM user typing `A` got SILENCE: no block, no
					// cursor advance, no message. Everything below reads `t` through the
					// same `t === 'C1' ? first : last` test, so `A` lands on the
					// fully-charged shot, which is what the token means.
					//
					// ⛔ BOW-GATED, and gcsim agrees literally: its base `Aimed` returns
					// "action aimed not implemented" for anyone else. A non-bow `A` falls
					// through to no branch at all and is flagged in the composer
					// (notationFlags) — an unsupported token rather than an approximated
					// one, because nothing is drawn for it.
					normalCounter = 0; // any non-normal action resets the NA string (gcsim semantics)
					// Explicit annotation: the chargeHits read in the hit block below
					// otherwise forms a TS7022 inference cycle through this initializer.
					const activeNormal: NormalAbility | undefined = resolveActiveAbility(
						char,
						'normal',
						computeCurrentStates(localCursor),
						charConstellationLevel
					);
					const castS = activeNormal
						? resolveChargeCastTime(activeNormal, t, nextKey, isBow)
						: null;
					const blockStart = localCursor;
					// Catalyst CAs, bow aimed shots (bar the C1 partial), and infused CAs
					// are elemental — the shared infusion rule (actionElement.ts).
					const cElement = resolveActionElement(
						'charged',
						t,
						char.weapon,
						char.element,
						activeNormal?.infusion
					);
					const chargedEv = emitAction({
						action: 'charged',
						label: t,
						time: blockStart,
						duration: castS ?? 0,
						abilityId: activeNormal?.id,
						element: cElement
					});
					if (castS !== null) localCursor += castS;
					// Parser-private charged hit (onHit wiring): swing-END time. The
					// abilityName carries the bow chargeHit sub-name (C1 → first
					// entry, C → last) so `filter.abilityName: "Wreath Arrow"`
					// substring-matches — mirrors resolveBlockContext's rule.
					{
						let cAbilityName: string | undefined = activeNormal?.name;
						const chargeHits: NormalHit[] | undefined = activeNormal?.chargeHits;
						if (chargeHits?.length && cAbilityName) {
							const chIdx = t === 'C1' ? 0 : chargeHits.length - 1;
							const hitName = chargeHits[chIdx]?.name;
							if (hitName) cAbilityName = `${cAbilityName} ${hitName}`;
						}
						dispatchHit(
							{
								characterId: char.id,
								time: localCursor,
								abilityType: 'charged',
								element: cElement,
								damageTag: chargeHits?.length
									? getNormalHitDamageTag(
											chargeHits[t === 'C1' ? 0 : chargeHits.length - 1],
											'charged'
										)
									: 'charged',
								abilityName: cAbilityName,
								sourceEventId: chargedEv.id
							},
							true
						);
					}
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
						// the shared infusion rule (actionElement.ts). An unresolvable plunge
						// (no frames) emits NO action event, matching the no-block legacy
						// behavior.
						const pElement = resolveActionElement(
							'plunge',
							t,
							char.weapon,
							char.element,
							activeNormal?.infusion
						);
						const plungeEv = emitAction({
							action: 'plunge',
							label: t,
							time: blockStart,
							duration: castS,
							abilityId: activeNormal?.id,
							element: pElement
						});
						localCursor += castS;
						// Post-plunge transient state (sQ primitive): the plunge landing
						// opens a short gating window — Varesa's plunge opens `apexDrive`
						// (140f) during which `sQ` resolves to Volcano Kablam. Window
						// runs from the plunge's END (≈ landing, the post-advance
						// cursor); provenance is the plunge's action event (post-P4 #2).
						const pSpec = activeNormal?.actionOpensState?.plunge;
						if (pSpec) {
							openTransientState(
								pSpec,
								cs,
								char.id,
								localCursor,
								plungeStates,
								charConstellationLevel,
								{ sourceActionId: plungeEv.id }
							);
						}
						// Parser-private plunge hit (onHit wiring): landing ≈ swing
						// END. Dispatched after the transient-state opener (apexDrive
						// is open to hit-gated conditions at the landing instant). A
						// frameless plunge emits no action event and no hit.
						dispatchHit(
							{
								characterId: char.id,
								time: localCursor,
								abilityType: 'plunge',
								element: pElement,
								damageTag: 'plunge',
								abilityName: activeNormal?.name,
								sourceEventId: plungeEv.id
							},
							true
						);
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
				// ⚓ A stance whose cooldown CLOCK starts at the stance END was given
				// a `readyAt` of `cast + duration + cd` at open time, on the
				// assumption the window would run its full length. The swap just
				// ended it early, so the clock starts NOW: take `localCursor + cd`
				// outright — ⛔ not min/max against the stale value, which is a
				// strictly later upper bound we are correcting, not competing with.
				// Both the ghost tail (castRef.readyAt) and the recast placement
				// (the charge queue) have to move, or the chart and the parser
				// disagree about when the ability is castable.
				if (getCooldownStartsAtStanceEnd(cs.stance.ownerAbility)) {
					const castRef = cs.stance.castRef;
					const staleReadyAt = castRef.readyAt;
					const readyAt = localCursor + castRef.cooldown;
					castRef.readyAt = readyAt;
					// The queue is keyed by exact ability id (see the cast site), so
					// this cannot reach a teammate's or a sibling variant's clock.
					// Replace the entry this cast wrote — identified by its stale
					// value — rather than q[0], which a multi-charge sort may have
					// moved off the front.
					const queue = eChargeQueues.get(cs.stance.ownerAbility.id);
					if (queue && staleReadyAt !== undefined) {
						const idx = queue.findIndex((t) => Math.abs(t - staleReadyAt) < 1e-9);
						if (idx !== -1) {
							queue[idx] = readyAt;
							queue.sort((a, b) => a - b);
						}
					}
				}
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
			readyAt: ev.readyAt,
			label: ev.label,
			castTime: ev.castTime,
			abilityId: ev.abilityId,
			summonActivatesAt: ev.summonActivatesAt,
			sacProcFired: ev.sacProcFired,
			stackContext: ev.stackContext
		};
		(ev.ability === 'burst' ? track.qBars : track.eBars).push(bar);
		castIdByBar.set(bar, ev.id);
	}

	// 1c. Project the inputBlocks from the event stream (post-P4 #2). Casts
	//     become skill/burst blocks (`castTime` is never touched by finalize,
	//     so this is order-independent of 1b); an action-event group (events
	//     sharing a `blockId`) becomes one block whose duration accumulates in
	//     record order — the same float additions, in the same order, as the
	//     legacy inline emission. Per-track order is ascending anchor/cast id
	//     (= token order; the record arrays are emission-ordered).
	{
		const trackItems = new Map<CharacterTrack, { id: number; block: InputBlock }[]>();
		const pushItem = (track: CharacterTrack, id: number, block: InputBlock) => {
			const items = trackItems.get(track);
			if (items) items.push({ id, block });
			else trackItems.set(track, [{ id, block }]);
		};
		for (const { ev, track } of castRecords) {
			pushItem(track, ev.id, {
				start: ev.time,
				duration: ev.castTime,
				parts: [ev.label],
				kind: ev.ability
			});
		}
		const blocksByAnchor = new Map<number, InputBlock>();
		for (const { ev, track } of actionRecords) {
			const open = blocksByAnchor.get(ev.blockId);
			if (open) {
				open.duration += ev.duration;
				continue;
			}
			const block: InputBlock = {
				start: ev.time,
				duration: ev.duration,
				parts: [ev.label],
				kind:
					ev.action === 'dash' || ev.action === 'jump'
						? 'movement'
						: ev.action === 'unset'
							? 'unset'
							: ev.element !== undefined
								? 'elemental-normal'
								: 'normal'
			};
			blocksByAnchor.set(ev.blockId, block);
			pushItem(track, ev.blockId, block);
		}
		for (const [track, items] of trackItems) {
			items.sort((a, b) => a.id - b.id);
			track.inputBlocks = items.map((i) => i.block);
		}
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

	// 3. Named-state windows (swap-clamped ends). All transient-opened —
	//    stance windows project from stanceWindowRecs above.
	for (const rec of stateWindowRecs) {
		windows.push({
			kind: 'state',
			characterId: rec.characterId,
			name: rec.name,
			start: rec.start,
			end: rec.end,
			source: rec.source,
			transient: true,
			sourceCastId: rec.sourceCastId,
			sourceActionId: rec.sourceActionId
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
			sourceCastId: rec.sourceCastId,
			...(rec.label !== undefined ? { label: rec.label } : {}),
			...(rec.coveredBySummon ? { coveredBySummon: true as const } : {})
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
	// The resolved `Summon` behind each emitted window, kept parser-private for
	// the off-field hit synthesis in step 6c. Recorded HERE because this is the
	// only place the object is in hand — a window carries the summon's LABEL,
	// and re-resolving from the label alone cannot distinguish two summons that
	// share one (the reason `findSummonsForBar` takes a bar, not a name).
	const summonByWindow = new Map<Extract<TimelineWindow, { kind: 'summon' }>, Summon>();
	for (let ti = 0; ti < tracks.length; ti++) {
		const track = tracks[ti];
		const summonChar = charById.get(track.characterId);
		// Next swap-out for this character = activeStart of the next track owned
		// by a different character. summonSubrows.ts (the renderer) historically
		// used "next track with a different slotIdx"; the two agree as long as
		// characterId ↔ slotIdx is a bijection over summon-bearing tracks —
		// mapTracksToSlots (RotationTimeline.svelte) maps each slotIdx to exactly
		// one characterId, and the slots are distinct BY CONSTRUCTION.
		// ✅ 2026-08-13 (single truth): that last clause used to carry a caveat —
		// `?team=` (`importTeam`) and shared links passed their id array through
		// verbatim with no dedup, so a crafted `?team=fischl,fischl` was one
		// non-bijective input away from breaking this. Both routes now go through
		// the NOTATION, and `orderedCharacterIds` dedupes, so a duplicate cannot
		// be expressed at all (see the fuller note in computeSummonSubrows). For every real
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
			// One window PER SUMMON. Emitted in authored order so the primary
			// keeps the id it has always had and the extras land after it — the
			// lane ordering in summonSubrows follows the same walk.
			findSummonsForBar(summonChar, kind, bar.label, bar.abilityId).forEach((summon, i) => {
				const { start: spawnAt, end } = summonSpan(
					bar.start,
					bar.summonActivatesAt,
					bar.uptime,
					summon,
					i
				);
				// ⚠ terminatesOn is read off the SUMMON, so a stationary turret
				// can outlive the swap that ends the field it spawned beside.
				let endAt = end;
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
				summonByWindow.set(win, summon);
				lastSummonWindowByKey.set(key, win);
			});
		};
		for (const bar of track.eBars) emitSummon(bar, 'skill');
		for (const bar of track.qBars) emitSummon(bar, 'burst');
	}

	// 6b. Nightsoul-Burst fire events (post-P4 #5 arc, phase 3 — the greedy
	// cooldown-gated derivation moved here from nbRows.ts; computeNBBars is
	// now a pure projection of these events). Team context prefers the SLOT
	// roster (`teamCharacters` — slots can hold Natlan/catalyst members never
	// typed in the notation, and the NB clock is a team-wide mechanic) and
	// falls back to the notation-derived team for Node scripts and tests.
	{
		const nbTeam = teamCharacters
			? teamCharacters.filter((c): c is CharacterData => c != null)
			: teamChars;
		const natlanCount = nbTeam.filter((c) => c.region === 'Natlan').length;
		if (natlanCount > 0) {
			const nbCd = natlanCount >= 3 ? 9 : natlanCount === 2 ? 12 : 18;
			const catalystIds = new Set(nbTeam.filter((c) => c.weapon === 'catalyst').map((c) => c.id));
			// Triggers: every E/Q cast; for catalyst characters, every input-token
			// ANCHOR action except movement/unset (per-block cadence, not
			// per-swing — the legacy nbRows rule, preserved verbatim).
			const nbTriggers: { time: number; characterId: string }[] = [];
			for (const ev of events) {
				if (ev.kind === 'cast') {
					nbTriggers.push({ time: ev.time, characterId: ev.characterId });
				} else if (
					ev.kind === 'action' &&
					ev.id === ev.blockId &&
					ev.action !== 'dash' &&
					ev.action !== 'jump' &&
					ev.action !== 'unset' &&
					catalystIds.has(ev.characterId)
				) {
					nbTriggers.push({ time: ev.time, characterId: ev.characterId });
				}
			}
			nbTriggers.sort((a, b) => a.time - b.time);
			let nbNextAllowed = -Infinity;
			for (const t of nbTriggers) {
				if (t.time >= nbNextAllowed) {
					events.push({
						kind: 'nightsoulBurst',
						id: nextEventId++,
						characterId: t.characterId,
						time: t.time,
						cooldown: nbCd
					});
					nbNextAllowed = t.time + nbCd;
				}
			}
		}
	}

	// 6c. Off-field hits from summon damage ticks (2026-08-15).
	//
	// ⚓ THE HIT STREAM USED TO STOP AT THE ACTIVE CHARACTER. Every record in
	// `hitRecords` came from an E/Q cast or a normal/charged/plunge swing, so an
	// `onHit` effect held by an off-field damage dealer — Oz ticking, Guoba
	// breathing, a Salon Member landing — never fired at all. That silently
	// disabled every hit-triggered artifact set (Deepwood Memories, Tenacity of
	// the Millelith, Silken Moon's Serenade — all three authored, none reachable).
	//
	// Corpus reach beyond the artifacts, measured 2026-08-15: FOUR characters
	// leave a damaging summon AND hold an `onHit` effect that summon can fire —
	// Emilie (C2), Escoffier (A-passive), Anemo Traveler (C6), Xiangling (C1),
	// every one of them a resShred. For those the effect already fired at the
	// CAST instant, so this is an uptime correction rather than a from-nothing
	// gain; the artifact sets are the from-nothing case.
	//
	// Runs HERE, at finalize, because a summon's FINAL end is only known once
	// step 6's recast/swap truncation has landed. Synthesizing during the parse
	// would emit ticks past an end a later recast pulls in.
	//
	// ⚠️⚠️ THESE HITS FEED `deriveBuffWindows` ONLY — they are deliberately NOT
	// put through `dispatchHit`, so `gainStacks`/`consumeStacks` never see them.
	// That machinery mutates live state in PARSE order, and a finalize-time hit
	// cannot be interleaved into a stream that has already been consumed without
	// a two-pass parse. Buff and resShred effects carry no stack state — which is
	// all three artifact sets and the bulk of the character cases — so those are
	// correct today; a summon tick feeding a STACK effect stays unmodelled.
	// ⛔ Do not "fix" that by calling `dispatchHit` here: the ordering IS the
	// problem, and a hit dispatched after the fact would apply its gain to a
	// stack state that later hits have already read.
	for (const win of windows) {
		if (win.kind !== 'summon') continue;
		const summon = summonByWindow.get(win);
		if (!summon) continue;
		const cLevel = constellationLevels?.[win.characterId] ?? 0;
		for (const tick of computeSummonDamageTicks(summon, win.start, win.end, cLevel)) {
			hitRecords.push({
				characterId: win.characterId,
				time: tick.time,
				abilityType: win.source,
				element: tick.element,
				// A summon tick's damage class is its spawning cast's — there is no
				// per-effect override on a `summonTick` damage effect to prefer.
				damageTag: win.source,
				abilityName: summon.label,
				// Provenance is the CAST that spawned the summon — what a reader
				// wants a summon-borne buff traced back to. `-1` is unreachable
				// (ids count from 0, bars↔casts are 1:1 by construction); it is
				// here so a missing link cannot fabricate a bogus event join.
				sourceEventId: win.sourceCastId ?? -1
			});
		}
	}
	// ⚠ Appended, NOT merged by time into the existing records. `hitsForTrack`
	// (buffWindows) only ever selects `normal`/`charged`/`plunge`, so a skill/
	// burst-tagged summon hit is invisible to the per-swing passes and cannot
	// perturb their order-sensitive refresh-merge. The one consumer that wants
	// these sorts its own selection.

	// 7. Sort the event stream by time (stable).
	events.sort((a, b) => a.time - b.time);

	// Deterministic window order (by start, then end).
	windows.sort((a, b) => a.start - b.start || a.end - b.end);

	// 8. Buff windows (post-P4 #5 — parser-side who-buffs-whom-when). Runs
	// AFTER the sorts so the derivation consumes the exact time-ordered
	// event/window streams the renderer-side modules consumed (the
	// afterDuration first-window-per-cast join is order-sensitive). Team
	// context prefers the slot roster (same rule as the NB pass); the
	// element-count/faction maps mirror the renderer's construction exactly.
	{
		const buffTeam = teamCharacters
			? teamCharacters.filter((c): c is CharacterData => c != null)
			: teamChars;
		const buffFactionCounts = teamCharacters
			? computeTeamFactionCounts(teamCharacters)
			: teamFactionCounts;
		let buffElementCounts: ReadonlyMap<
			string,
			ReadonlyMap<Element, number>
		> = teamElementCountsByHolder;
		if (teamCharacters) {
			const m = new Map<string, Map<Element, number>>();
			for (const holder of buffTeam) {
				const counts = new Map<Element, number>();
				for (const other of buffTeam) {
					if (other.id === holder.id) continue;
					if (!other.element) continue;
					counts.set(other.element, (counts.get(other.element) ?? 0) + 1);
				}
				m.set(holder.id, counts);
			}
			buffElementCounts = m;
		}
		const charById = new Map<string, CharacterData>();
		for (const c of [...teamChars, ...buffTeam]) charById.set(c.id, c);
		const buffWindows = deriveBuffWindows({
			tracks,
			hits: hitRecords,
			castEvents: events.filter((e): e is CastEvent => e.kind === 'cast'),
			reactionEvents: events.filter((e): e is ReactionEvent => e.kind === 'reaction'),
			nbBars: events
				.filter((e) => e.kind === 'nightsoulBurst')
				.map((e) => ({ start: e.time, cooldown: e.cooldown })),
			windows,
			constellationLevels: constellationLevels ?? {},
			loadoutMap: loadoutMap ?? {},
			teamFactionCounts: buffFactionCounts,
			teamEnabledReactions,
			teamElementCountsByHolder: buffElementCounts,
			getCharacter: (id) => charById.get(id) ?? null
		});
		if (buffWindows.length > 0) {
			// ⛔ NOT `windows.push(...buffWindows)` — spreading an array as arguments
			// throws RangeError past V8's argument limit (~125k), and buff windows
			// scale with cast count, so a large rotation reaches it. See the same
			// note in expandBrackets.
			for (const w of buffWindows) windows.push(w);
			// Restore the deterministic order; the stable sort keeps buff
			// emission order within (start, end) ties, and the buff-row
			// projections re-order their subset by window id regardless.
			windows.sort((a, b) => a.start - b.start || a.end - b.end);
		}
	}

	return {
		tracks,
		totalDuration: cursor,
		unknownTokens,
		events,
		windows
	};
}
