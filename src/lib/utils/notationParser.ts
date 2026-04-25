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
	ActionKey,
	CastAbility,
	Condition,
	CooldownModifier,
	NormalAbility,
	NormalHit,
	ScaledValue,
	SkillAbility
} from '$lib/types/ability';
import {
	getDuration,
	getDurationModifiers,
	getPersistentBehavior,
	getStanceExtension,
	getSummonActivatesAt,
	getTerminatesOnSwap
} from '$lib/types/ability';
import { tokenizeNotation, type Token } from '$lib/utils/tokenizer';
import { getWeaponById } from '$lib/data/weaponLookup';
import type { LoadoutEntry } from '$lib/stores';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimelineBar = {
	start: number;    // seconds
	uptime: number;   // seconds (0 = instant)
	cooldown: number; // seconds
	label: string;    // notation token displayed on the bar (e.g. "Q", "hE")
	castTime: number; // seconds — duration of the cast animation (used for active-bar overlay)
	/** Frames (60fps) from cast start until the summon becomes active. 0 when absent.
	 *  Mirrors persistent-behavior summonActivatesAt; carried on the bar so the
	 *  renderer and duringSummon detection don't need to re-query the ability. */
	summonActivatesAt?: number;
	/** True when a Sacrificial-series proc fired on this cast, resetting the CD to 0.
	 *  The renderer uses this to draw the entire bar as a dim+bordered "available" style
	 *  instead of the usual opaque uptime + ghost CD split. */
	sacProcFired?: boolean;
};

export type InputBlockKind = 'normal' | 'elemental-normal' | 'skill' | 'burst' | 'movement' | 'unset';

/** A discrete per-input building block in the active row. */
export type InputBlock = {
	start:    number;         // seconds — absolute timeline position
	duration: number;         // seconds — block width
	parts:    string[];       // display labels e.g. ["N5"], ["Q"], ["hE"]
	kind:     InputBlockKind;
};

export type CharacterTrack = {
	characterId: string;
	displayName: string;
	element: string;
	activeStart: number;        // seconds
	activeEnd: number;          // seconds
	/** Per-input building blocks in the active row, chronological order. */
	inputBlocks: InputBlock[];
	hasUnsetDuration: boolean;  // true when ~?s was encountered
	eBars: TimelineBar[];
	qBars: TimelineBar[];
};

export type WeaponProcBar = { start: number; end: number };

export type ParsedRotation = {
	tracks: CharacterTrack[];
	totalDuration: number;
	unknownTokens: string[]; // tokens not recognised as valid notation
	/** Per-character windows during which a weapon proc (e.g. Sacrificial CD reset) is on cooldown. */
	weaponProcBars: Map<string, WeaponProcBar[]>;
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
 * Evaluates whether a condition is definitively met at the given ascension and
 * known runtime states. Returns true = applies, false = does not apply,
 * null = depends on unknown runtime state.
 *
 * `resolvedStates` carries state keys that have been inferred from the timeline
 * (e.g. 'duringSummon' when a stationary persistent summon is still active).
 * A state condition resolves to true if the key is in that set, null otherwise —
 * never false, because absence of evidence isn't evidence of absence at runtime.
 *
 * `constellationLevel` is the character's current C0–C6 level; when provided,
 * constellation conditions resolve definitively instead of returning null.
 */
export function evalCondition(
	cond: Condition | undefined,
	ascension: number,
	resolvedStates: ReadonlySet<string> = new Set(),
	constellationLevel = 0
): boolean | null {
	if (!cond) return true;
	switch (cond.type) {
		case 'ascension':     return ascension >= cond.min;
		case 'constellation': return constellationLevel >= cond.level;
		case 'state':         return resolvedStates.has(cond.state) ? true : null;
		case 'teamFaction':
		case 'weaponType':
		case 'custom':        return null;
		case 'not': {
			const r = evalCondition(cond.condition, ascension, resolvedStates, constellationLevel);
			return r === null ? null : !r;
		}
		case 'all': {
			let hasNull = false;
			for (const c of cond.conditions) {
				const r = evalCondition(c, ascension, resolvedStates, constellationLevel);
				if (r === false) return false;
				if (r === null) hasNull = true;
			}
			return hasNull ? null : true;
		}
		case 'any': {
			let hasNull = false;
			for (const c of cond.conditions) {
				const r = evalCondition(c, ascension, resolvedStates, constellationLevel);
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

/** Applies a list of modifiers to a base value, skipping any with unresolvable conditions. */
function applyModifiers(
	base: number,
	modifiers: CooldownModifier[] | undefined,
	ascension: number,
	resolvedStates: ReadonlySet<string> = new Set(),
	constellationLevel = 0
): number {
	if (!modifiers?.length) return base;
	let result = base;
	for (const mod of modifiers) {
		if (evalCondition(mod.conditions, ascension, resolvedStates, constellationLevel) !== true) continue;
		result = mod.type === 'percent' ? result * (1 + mod.value / 100) : result + mod.value;
	}
	return Math.max(0, result);
}

/**
 * Resolves the effective charge count for a skill ability, applying chargeModifiers
 * at the given constellation level. Returns at least 1.
 *
 * Variant-aware: if `tokenText` matches a variant's `input`, the variant's
 * `charges` and `chargeModifiers` **replace** the base (symmetric with
 * `resolveAbilityTiming`). Today no curated character uses variant-level
 * charge data; this keeps the contract consistent for future curation.
 */
function resolveEffectiveCharges(ability: SkillAbility, tokenText: string, constellationLevel = 0): number {
	const variant = ability.variants?.find((v) => (v.input as string[] | undefined)?.includes(tokenText));
	const base = variant?.charges ?? ability.charges ?? 1;
	const modifiers = variant?.chargeModifiers ?? ability.chargeModifiers;
	return Math.max(1, Math.round(applyModifiers(base, modifiers, DEFAULT_ASCENSION, new Set(), constellationLevel)));
}

/**
 * Infers which named states are active for this character at `cursor` based on
 * bars already emitted in the current segment.
 *
 * Currently detects `duringSummon`: any stationary persistent Q or E bar whose
 * active summon window covers `cursor`. The window starts at
 * bar.start + (summonActivatesAt ?? 0)/60 and ends uptime seconds later.
 * Works both within a segment and across segments — callers pass the union of
 * bars from all prior completed tracks for this character plus the current
 * track's bars.
 */
function inferredStates(
	emittedQBars: TimelineBar[],
	emittedEBars: TimelineBar[],
	eAbility: CastAbility | undefined,
	qAbility: CastAbility | undefined,
	cursor: number
): Set<string> {
	const states = new Set<string>();
	const activeDuringSummon = (b: TimelineBar) => {
		const activatesAt = (b.summonActivatesAt ?? 0) / 60;
		return b.start + activatesAt <= cursor && cursor < b.start + activatesAt + b.uptime;
	};
	if (qAbility && getPersistentBehavior(qAbility) === 'stationary' && emittedQBars.some(activeDuringSummon)) {
		states.add('duringSummon');
	}
	if (eAbility && getPersistentBehavior(eAbility) === 'stationary' && emittedEBars.some(activeDuringSummon)) {
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
 * for the given next-action key. Checks variants first (e.g. hE, h1E, h2E).
 * `frames` is required on E/Q so no fallback is needed.
 */
function resolveEQCastTime(
	ability: CastAbility,
	tokenText: string,
	nextKey: ActionKey
): number {
	const variant = ability.variants?.find((v) => (v.input as string[] | undefined)?.includes(tokenText));
	const frameMap = variant?.frames ?? ability.frames;
	return (frameMap[nextKey] ?? frameMap.swap) / 60;
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
 * Resolves cooldown and duration for an ability cast, merging variant overrides
 * and applying modifiers at DEFAULT_ASCENSION. Variant fields take precedence;
 * modifiers (from the base ability) are applied on top.
 * `resolvedStates` allows state-gated modifiers (e.g. duringSummon) to activate.
 */
function resolveAbilityTiming(
	ability: CastAbility,
	tokenText: string,
	resolvedStates: ReadonlySet<string> = new Set(),
	constellationLevel = 0
): { cooldown: number; duration: number } {
	// Variant modifier arrays **replace** (not compose with) the base ability's.
	// Matches the "variant overrides" mental model: a curator who lists modifiers
	// on a variant has opted that variant out of the base modifier set.
	const variant = ability.variants?.find((v) => (v.input as string[] | undefined)?.includes(tokenText));
	const cooldown = applyModifiers(
		variant?.cooldown ?? ability.cooldown,
		variant?.cooldownModifiers ?? ability.cooldownModifiers,
		DEFAULT_ASCENSION, resolvedStates, constellationLevel
	);
	const duration = applyModifiers(
		variant?.duration ?? getDuration(ability),
		variant?.durationModifiers ?? getDurationModifiers(ability),
		DEFAULT_ASCENSION, resolvedStates, constellationLevel
	);
	return { cooldown, duration };
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
	constellationLevel = 0
): Extract<Ability, { abilityType: K }> | undefined {
	const candidates = char.abilities.filter(
		(a): a is Extract<Ability, { abilityType: K }> => a.abilityType === abilityType
	);
	// Prefer a conditioned ability whose condition is definitively satisfied.
	const conditioned = candidates.find(
		(a) => a.conditions !== undefined &&
			evalCondition(a.conditions, DEFAULT_ASCENSION, resolvedStates, constellationLevel) === true
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
function expandBrackets(tokens: Token[]): Token[] {
	const result: Token[] = [];
	for (const tok of tokens) {
		if (tok.kind !== 'label') { result.push(tok); continue; }
		const m = tok.text.match(/^(\d+(?:-\d+)?)?\[([^\]]*)\](?:x(\d+))?$/);
		if (!m) { result.push(tok); continue; }
		const inner = m[2].trim();
		if (!inner) continue;
		let count = 1;
		if (m[1]) count = parseInt(m[1].split('-')[0]); // prefix, lower bound for ranges
		else if (m[3]) count = parseInt(m[3]);           // x-suffix
		if (count < 1) continue;
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
	if (!raw) return { tracks: [], totalDuration: 0, unknownTokens: [], weaponProcBars: new Map() };

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
	let cursor = 0; // rotation clock (seconds)

	// Per-character cooldown clocks (absolute time). Keyed by character id.
	// Persists across segments so that cross-segment cooldown enforcement works:
	//   Bennett E > Xiangling Q > Bennett E  →  second E waits for first E's cooldown.
	//
	// eChargeQueues: each value is a sorted array of "ready at" timestamps, one
	// entry per charge. Length = effective charge count. Picking queue[0] (the
	// earliest-ready charge) and re-sorting after each cast correctly models
	// independent per-charge cooldowns — a new cast never cancels an in-progress
	// cooldown from a previous cast.
	const eChargeQueues = new Map<string, number[]>();
	const qReadyAt = new Map<string, number>();

	// Weapon cdReset (Sacrificial series) tracking.
	// sacProcReadyAt: when the proc ICD expires and the proc can fire again.
	// weaponProcBars: accumulated ICD windows per character for timeline rendering.
	const sacProcReadyAt = new Map<string, number>();
	const weaponProcBars = new Map<string, WeaponProcBar[]>();

	// Active stance windows: maps charId → absolute end time (seconds).
	// Opened when a `behavior: "stance"` Q is cast; closed on swap if the Q has
	// `terminatesOnSwap: true`. Persists across segments (cross-segment stance
	// tracking for Cyno-style characters that cast Q then immediately swap back in).
	const stanceWindows = new Map<string, number>();
	// Tracks how many stanceExtension uses have been consumed per character in the
	// current stance window. Reset to 0 each time a new stance window opens.
	const stanceExtensionCounts = new Map<string, number>();
	// Direct references to the Q bar that opened each stance window. Mutated when
	// stanceExtension fires so the timeline bar's visual width stays in sync with the
	// actual window end time. Works across segments (Q in seg 1, E in seg 2).
	const stanceQBarRefs = new Map<string, TimelineBar>();

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

		const emitBlock = (b: InputBlock) => { track.inputBlocks.push(b); };

		// Bars from all completed prior segments for this character.
		// Computed once here (not per-token) and used for cross-segment duringSummon detection.
		const prevQBars = tracks.filter((t) => t.characterId === char.id).flatMap((t) => t.qBars);
		const prevEBars = tracks.filter((t) => t.characterId === char.id).flatMap((t) => t.eBars);

		// Resolved once per segment so both Q and E handlers see the same value.
		const charConstellationLevel = constellationLevels?.[char.id] ?? 0;

		const isBow = char.weapon === 'bow';
		// Tracks which hit in the combo sequence the next N token refers to.
		// Reset at segment start and when a stance opens (mid-segment Q cast).
		let normalCounter = 0;
		// Text of the most recent E token cast in this segment. Used by the P handler
		// to auto-select the correct plunge variant (e.g. "hE" → "After Hold E" frames).
		let lastEText: string | null = null;

		// Returns the full set of resolved runtime states at `cursor`: duringSummon
		// (from stationary persistent bars) plus inStance (from stanceWindows).
		const computeCurrentStates = (cursor: number): Set<string> => {
			const states = inferredStates(
				[...prevQBars, ...track.qBars],
				[...prevEBars, ...track.eBars],
				eAbility, qAbility, cursor
			);
			const stanceEnd = stanceWindows.get(char.id);
			if (stanceEnd !== undefined && stanceEnd > cursor) states.add('inStance');
			return states;
		};

		// Expand bracket repeat groups (e.g. 2[N5C] → N5 C N5 C) before the main
		// loop so that lookahead and counter logic see a flat token sequence.
		const expandedTokens = expandBrackets(tokens.slice(1));

		for (let j = 0; j < expandedTokens.length; j++) {
			const tok = expandedTokens[j];

			if (tok.kind === 'Q') {
				// Enforce cooldown: skip forward if Q isn't ready yet.
				const qReady = qReadyAt.get(char.id);
				if (qReady !== undefined && isFinite(qReady)) localCursor = Math.max(localCursor, qReady);
				if (qAbility) {
					const nextKey = peekActionKey(expandedTokens, j);
					const states = computeCurrentStates(localCursor);
					const qCast = resolveEQCastTime(qAbility, 'Q', nextKey);
					const { cooldown: qCd, duration: qDur } = resolveAbilityTiming(qAbility, 'Q', states, charConstellationLevel);
					const qStart = localCursor;
					track.qBars.push({ start: qStart, uptime: qDur, cooldown: qCd, label: 'Q', castTime: qCast, summonActivatesAt: getSummonActivatesAt(qAbility) });
					qReadyAt.set(char.id, localCursor + (qAbility.cooldownStartDelay ?? 0) / 60 + qCd);
					emitBlock({ start: localCursor, duration: qCast, parts: ['Q'], kind: 'burst' });
					localCursor += qCast;
					// Open a stance window when the Q ability has stance behavior.
					if (qAbility.behavior === 'stance') {
						stanceWindows.set(char.id, qStart + qDur);
						stanceExtensionCounts.set(char.id, 0); // reset per-window extension count
						stanceQBarRefs.set(char.id, track.qBars[track.qBars.length - 1]); // ref for uptime updates
						normalCounter = 0; // in-stance combo starts fresh
					}
				} else {
					track.qBars.push({ start: localCursor, uptime: 0, cooldown: 15, label: 'Q', castTime: Q_CAST_S });
					qReadyAt.set(char.id, localCursor + 15);
					emitBlock({ start: localCursor, duration: Q_CAST_S, parts: ['Q'], kind: 'burst' });
					localCursor += Q_CAST_S;
				}

			} else if (tok.kind === 'E') {
				if (eAbility) {
					const nextKey = peekActionKey(expandedTokens, j);
					const states = computeCurrentStates(localCursor);
					// Resolve the active skill variant (e.g. in-stance Mortuary Rite vs base skill).
					// Must happen before queue lookup: each distinct skill ability has its own
					// independent charge queue keyed by ability ID. This correctly models
					// characters like Cyno where the out-of-stance E (7.5s CD) and in-stance
					// E (3s CD) share no cooldown with each other.
					const activeE = resolveActiveAbility(char, 'skill', states, charConstellationLevel) ?? eAbility;
					const maxCharges = resolveEffectiveCharges(activeE, tok.text, charConstellationLevel);
					// Initialize charge queue on first cast of this specific ability: all charges ready at t=0.
					if (!eChargeQueues.has(activeE.id)) {
						eChargeQueues.set(activeE.id, new Array(maxCharges).fill(0));
					}
					const queue = eChargeQueues.get(activeE.id)!;
					// queue[0] is the earliest-ready charge (queue is kept sorted ascending).
					// If all charges are depleted, advance cursor to when the first returns.
					if (queue[0] > localCursor) localCursor = queue[0];
					const eCast = resolveEQCastTime(activeE, tok.text, nextKey);
					const { cooldown: eCd, duration: eDur } = resolveAbilityTiming(activeE, tok.text, states, charConstellationLevel);
					track.eBars.push({ start: localCursor, uptime: eDur, cooldown: eCd, label: tok.text, castTime: eCast, summonActivatesAt: getSummonActivatesAt(activeE) });
					// Compute the ready-at time for the slot we just consumed. Sac Bow proc
					// may override this with hitmark time (skill instantly available again).
					// Defer the queue write until after the proc check — writing first and
					// sorting leaves queue[0] pointing at a different charge, so the proc
					// would then reset the wrong slot.
					let consumedReadyAt = localCursor + (activeE.cooldownStartDelay ?? 0) / 60 + eCd;

					// Weapon cdReset (Sacrificial series): proc fires onHit (≈ end of cast
					// animation), not onCast. hitTime is our best approximation of hitmark.
					const sacCd = getWeaponCdResetCooldown(char.id, loadoutMap);
					if (sacCd !== null) {
						const hitTime = localCursor + eCast;
						const procReady = sacProcReadyAt.get(char.id) ?? 0;
						if (hitTime >= procReady) {
							// Proc fires: the consumed charge is available again from hitmark.
							consumedReadyAt = hitTime;
							const procEnd = hitTime + sacCd;
							sacProcReadyAt.set(char.id, procEnd);
							const bars = weaponProcBars.get(char.id) ?? [];
							bars.push({ start: hitTime, end: procEnd });
							weaponProcBars.set(char.id, bars);
							track.eBars[track.eBars.length - 1].sacProcFired = true;
						}
					}

					// Write the consumed slot's final ready-at and re-sort so queue[0]
					// stays the earliest-ready charge.
					queue[0] = consumedReadyAt;
					queue.sort((a, b) => a - b);

					emitBlock({ start: localCursor, duration: eCast, parts: [tok.text], kind: 'skill' });
					localCursor += eCast;
					lastEText = tok.text;
					// Extend the active stance window if this ability has stanceExtension.
					const ext = getStanceExtension(activeE);
					if (ext && stanceWindows.has(char.id)) {
						const used = stanceExtensionCounts.get(char.id) ?? 0;
						if (used < ext.maxExtensions) {
							const extensionS = ext.frames / 60;
							stanceWindows.set(char.id, stanceWindows.get(char.id)! + extensionS);
							stanceExtensionCounts.set(char.id, used + 1);
							// Keep the Q bar's visual width in sync with the extended window.
							const stanceBar = stanceQBarRefs.get(char.id);
							if (stanceBar) stanceBar.uptime += extensionS;
						}
					}
				} else {
					// Unknown ability fallback: single charge.
					if (!eChargeQueues.has(char.id)) eChargeQueues.set(char.id, [0]);
					const queue = eChargeQueues.get(char.id)!;
					if (queue[0] > localCursor) localCursor = queue[0];
					track.eBars.push({ start: localCursor, uptime: 0, cooldown: 12, label: tok.text, castTime: E_CAST_S });
					queue[0] = localCursor + 12;
					emitBlock({ start: localCursor, duration: E_CAST_S, parts: [tok.text], kind: 'skill' });
					localCursor += E_CAST_S;
					lastEText = tok.text;
				}

			} else if (tok.kind === 'time') {
				const m = tok.text.match(/^~([\d.]+)s/);
				if (m) {
					const delta = parseFloat(m[1]);
					if (isFinite(delta)) localCursor += delta;
				}

			} else if (tok.kind === 'unset-time') {
				emitBlock({ start: localCursor, duration: MIN_ACTIVE_S, parts: ['~?'], kind: 'unset' });
				track.hasUnsetDuration = true;
				localCursor += MIN_ACTIVE_S;

			} else if (tok.kind === 'optional') {
				// Optional actions in parentheses are omitted from the timeline entirely.
				// No label is emitted and no cursor advance occurs.

			} else if (tok.kind === 'or-alt') {
				// Slash alternative — only the first option goes on the timeline.
				continue;

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
					const activeNormal = resolveActiveAbility(char, 'normal', computeCurrentStates(localCursor), charConstellationLevel);
					const hits = activeNormal?.hits;
					for (let k = 0; k < count; k++) {
						const hitIndex = hits ? normalCounter % hits.length : normalCounter;
						const hitNextKey: ActionKey = k < count - 1 ? 'N' : nextKey;
						const castS = resolveNormalCastTime(hits, hitIndex, hitNextKey);
						if (castS !== null) {
							blockDuration += castS;
							localCursor += castS;
						}
						normalCounter++;
					}
					emitBlock({ start: blockStart, duration: blockDuration, parts: [t], kind: char.weapon === 'catalyst' || activeNormal?.infusion ? 'elemental-normal' : 'normal' });

				} else if (/^C\d*$/.test(t)) {
					// Charged attack: resolve active normal (in-stance if applicable) for
					// chargeFrames/chargeHits. Bow uses chargeHits, others use chargeFrames.
					const activeNormal = resolveActiveAbility(char, 'normal', computeCurrentStates(localCursor), charConstellationLevel);
					const castS = activeNormal
						? resolveChargeCastTime(activeNormal, t, nextKey, isBow)
						: null;
					const blockStart = localCursor;
					if (castS !== null) localCursor += castS;
					emitBlock({ start: blockStart, duration: castS ?? 0, parts: [t], kind: isBow && t !== 'C1' || activeNormal?.infusion ? 'elemental-normal' : 'normal' });

				} else if (/^[hl]?P$/.test(t)) {
					// Plunge attack. Uses the active normal ability's plungeFrames, or a
					// plungeVariant whose input[] matches the preceding E token text
					// (e.g. Kazuha's Midare Ranzan has distinct "After Hold E" frames).
					const activeNormal = resolveActiveAbility(char, 'normal', computeCurrentStates(localCursor), charConstellationLevel);
					const plungeVariant = lastEText
						? activeNormal?.plungeVariants?.find((v) => v.input.includes(lastEText as typeof v.input[number]))
						: undefined;
					const plungeFrames = plungeVariant?.frames ?? activeNormal?.plungeFrames;
					if (plungeFrames) {
						const castS = (plungeFrames[nextKey] ?? plungeFrames.swap) / 60;
						const blockStart = localCursor;
						localCursor += castS;
						emitBlock({ start: blockStart, duration: castS, parts: [t], kind: 'normal' });
					}
					lastEText = null;

				} else if (t === 'D' || t === 'J') {
					// Dash/jump: emit a block, then advance cursor.
					// The preceding token already selected frames.D/J via peekActionKey.
					const blockStart = localCursor;
					localCursor += DASH_FRAMES / 60;
					emitBlock({ start: blockStart, duration: DASH_FRAMES / 60, parts: [t], kind: 'movement' });
				}
			}
		}

		// Ensure minimum on-field width
		if (localCursor <= cursor) localCursor = cursor + MIN_ACTIVE_S;

		track.activeEnd = localCursor;
		tracks.push(track);

		// When a character swaps off, close any stance window flagged terminatesOnSwap.
		if (i < segments.length - 1 && qAbility && getTerminatesOnSwap(qAbility) && stanceWindows.has(char.id)) {
			stanceWindows.delete(char.id);
			stanceQBarRefs.delete(char.id);
		}

		// Swap time before the next character enters
		if (i < segments.length - 1) {
			cursor = localCursor + swapS;
		} else {
			cursor = localCursor;
		}
	}

	return { tracks, totalDuration: cursor, unknownTokens, weaponProcBars };
}
