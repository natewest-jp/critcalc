/**
 * src/lib/utils/notationParser.ts
 *
 * KQM-aligned rotation notation parser. Produces timeline track data from a
 * notation string like:
 *   Bennett Q > Kazuha Q hEP > Xiangling Q E > Fischl E N1 N2 ~2s
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
import type { Ability, Condition, CooldownModifier } from '$lib/types/ability';
import { tokenizeNotation } from '$lib/utils/tokenizer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimelineBar = {
	start: number;    // seconds
	uptime: number;   // seconds (0 = instant)
	cooldown: number; // seconds
	label: string;    // notation token displayed on the bar (e.g. "Q", "hEP")
	castTime: number; // seconds — duration of the cast animation (used for active-bar overlay)
};

/** One run of label tokens at a specific position within the active bar. */
export type LabelSegment = {
	start: number; // seconds from rotation start — where this group renders
	parts: Array<{ text: string; optional: boolean }>;
};

export type CharacterTrack = {
	characterId: string;
	displayName: string;
	element: string;
	activeStart: number;        // seconds
	activeEnd: number;          // seconds
	/** Positioned label groups within the active bar. Each group renders at its
	 *  own x offset, so labels after a Q/E cast land at the correct time. */
	labelSegments: LabelSegment[];
	hasUnsetDuration: boolean;  // true when ~?s was encountered
	eBars: TimelineBar[];
	qBars: TimelineBar[];
};

export type ParsedRotation = {
	tracks: CharacterTrack[];
	totalDuration: number;
	unknownTokens: string[]; // tokens not recognised as valid notation
};

// ---------------------------------------------------------------------------
// Timing constants (seconds)
// ---------------------------------------------------------------------------

const Q_CAST_S = 1.0;
const E_CAST_S = 0.5;
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
 * (e.g. 'insideField' when a stationary persistent ability is still active).
 * A state condition resolves to true if the key is in that set, null otherwise —
 * never false, because absence of evidence isn't evidence of absence at runtime.
 *
 * `constellationLevel` is the character's current C0–C6 level; when provided,
 * constellation conditions resolve definitively instead of returning null.
 */
function evalCondition(
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
		default: return null;
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
 * Resolves the effective charge count for an ability, applying chargeModifiers
 * at the given constellation level. Returns at least 1.
 */
function resolveEffectiveCharges(ability: Ability, constellationLevel = 0): number {
	const base = ability.charges ?? 1;
	return Math.max(1, Math.round(applyModifiers(base, ability.chargeModifiers, DEFAULT_ASCENSION, new Set(), constellationLevel)));
}

/**
 * Infers which named states are active for this character at `cursor` based on
 * bars already emitted in the current segment.
 *
 * Currently detects `insideField`: any stationary persistent Q or E bar whose
 * uptime window (bar.start + bar.uptime) still covers `cursor`. Works both
 * within a segment and across segments — callers pass the union of bars from
 * all prior completed tracks for this character plus the current track's bars.
 */
function inferredStates(
	emittedQBars: TimelineBar[],
	emittedEBars: TimelineBar[],
	eAbility: Ability | undefined,
	qAbility: Ability | undefined,
	cursor: number
): Set<string> {
	const states = new Set<string>();
	if (qAbility?.persistentBehavior === 'stationary' && emittedQBars.some((b) => b.start + b.uptime > cursor)) {
		states.add('insideField');
	}
	if (eAbility?.persistentBehavior === 'stationary' && emittedEBars.some((b) => b.start + b.uptime > cursor)) {
		states.add('insideField');
	}
	return states;
}

/**
 * Resolves effective timing for an ability cast, merging variant overrides with
 * base ability values and applying cooldown/duration modifiers at DEFAULT_ASCENSION.
 * Variant fields take precedence over the base ability; modifiers (from the base
 * ability) are applied on top of whichever cooldown/duration was resolved.
 * `resolvedStates` allows state-gated modifiers (e.g. insideField) to activate.
 */
function resolveAbilityTiming(
	ability: Ability,
	tokenText: string,
	defaultCastTime: number,
	resolvedStates: ReadonlySet<string> = new Set(),
	constellationLevel = 0
): { castTime: number; cooldown: number; duration: number } {
	const variant = ability.variants?.find((v) => (v.input as string[] | undefined)?.includes(tokenText));
	const castTime = variant?.castTime ?? ability.castTime ?? defaultCastTime;
	const cooldown = applyModifiers(variant?.cooldown ?? ability.cooldown ?? 0,  ability.cooldownModifiers, DEFAULT_ASCENSION, resolvedStates, constellationLevel);
	const duration = applyModifiers(variant?.duration ?? ability.duration  ?? 0, ability.durationModifiers, DEFAULT_ASCENSION, resolvedStates, constellationLevel);
	return { castTime, cooldown, duration };
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseNotation(
	notation: string,
	lookupChar: (name: string) => CharacterData | null,
	swapFrames = 8,
	constellationLevels?: Record<string, number>
): ParsedRotation {
	const swapS = swapFrames / 60;
	const raw = notation.trim();
	if (!raw) return { tracks: [], totalDuration: 0, unknownTokens: [] };

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

		const eAbility = char.abilities.find((a) => a.abilityType === 'skill');
		const qAbility = char.abilities.find((a) => a.abilityType === 'burst');

		const track: CharacterTrack = {
			characterId: char.id,
			displayName: char.displayName,
			element: char.element ?? 'pyro',
			activeStart: cursor,
			activeEnd: cursor,
			labelSegments: [],
			hasUnsetDuration: false,
			eBars: [],
			qBars: []
		};

		let localCursor = cursor;

		// Current open label segment — flushed whenever the cursor advances.
		let segStart: number | null = null;
		let segParts: Array<{ text: string; optional: boolean }> = [];

		const flushSegment = () => {
			if (segParts.length > 0 && segStart !== null) {
				track.labelSegments.push({ start: segStart, parts: segParts });
			}
			segStart = null;
			segParts = [];
		};

		const addLabel = (text: string, optional: boolean) => {
			if (segStart === null) segStart = localCursor;
			segParts.push({ text, optional });
		};

		// Bars from all completed prior segments for this character.
		// Computed once here (not per-token) and used for cross-segment insideField detection.
		const prevQBars = tracks.filter((t) => t.characterId === char.id).flatMap((t) => t.qBars);
		const prevEBars = tracks.filter((t) => t.characterId === char.id).flatMap((t) => t.eBars);

		// Resolved once per segment so both Q and E handlers see the same value.
		const charConstellationLevel = constellationLevels?.[char.id] ?? 0;

		for (let j = 1; j < tokens.length; j++) {
			const tok = tokens[j];

			if (tok.kind === 'Q') {
				flushSegment();
				// Enforce cooldown: skip forward if Q isn't ready yet.
				const qReady = qReadyAt.get(char.id);
				if (qReady !== undefined && isFinite(qReady)) localCursor = Math.max(localCursor, qReady);
				if (qAbility) {
					const states = inferredStates([...prevQBars, ...track.qBars], [...prevEBars, ...track.eBars], eAbility, qAbility, localCursor);
					const { castTime: qCast, cooldown: qCd, duration: qDur } =
						resolveAbilityTiming(qAbility, 'Q', Q_CAST_S, states, charConstellationLevel);
					track.qBars.push({ start: localCursor, uptime: qDur, cooldown: qCd, label: 'Q', castTime: qCast });
					qReadyAt.set(char.id, localCursor + qCd);
					localCursor += qCast;
				} else {
					track.qBars.push({ start: localCursor, uptime: 0, cooldown: 15, label: 'Q', castTime: Q_CAST_S });
					qReadyAt.set(char.id, localCursor + 15);
					localCursor += Q_CAST_S;
				}

			} else if (tok.kind === 'E') {
				flushSegment();
				if (eAbility) {
					const maxCharges = resolveEffectiveCharges(eAbility, charConstellationLevel);
					// Initialize charge queue on first cast: all charges ready at t=0.
					if (!eChargeQueues.has(char.id)) {
						eChargeQueues.set(char.id, new Array(maxCharges).fill(0));
					}
					const queue = eChargeQueues.get(char.id)!;
					// queue[0] is the earliest-ready charge (queue is kept sorted ascending).
					// If all charges are depleted, advance cursor to when the first returns.
					if (queue[0] > localCursor) localCursor = queue[0];
					const states = inferredStates([...prevQBars, ...track.qBars], [...prevEBars, ...track.eBars], eAbility, qAbility, localCursor);
					const { castTime: eCast, cooldown: eCd, duration: eDur } =
						resolveAbilityTiming(eAbility, tok.text, E_CAST_S, states, charConstellationLevel);
					track.eBars.push({ start: localCursor, uptime: eDur, cooldown: eCd, label: tok.text, castTime: eCast });
					// Consume this charge slot and re-sort so queue[0] is always earliest.
					queue[0] = localCursor + eCd;
					queue.sort((a, b) => a - b);
					localCursor += eCast;
				} else {
					// Unknown ability fallback: single charge.
					if (!eChargeQueues.has(char.id)) eChargeQueues.set(char.id, [0]);
					const queue = eChargeQueues.get(char.id)!;
					if (queue[0] > localCursor) localCursor = queue[0];
					track.eBars.push({ start: localCursor, uptime: 0, cooldown: 12, label: tok.text, castTime: E_CAST_S });
					queue[0] = localCursor + 12;
					localCursor += E_CAST_S;
				}
				// E variants are shown only in the E bar — not in the active bar label.

			} else if (tok.kind === 'time') {
				flushSegment();
				const m = tok.text.match(/^~([\d.]+)s/);
				if (m) {
					const delta = parseFloat(m[1]);
					if (isFinite(delta)) localCursor += delta;
				}

			} else if (tok.kind === 'unset-time') {
				flushSegment();
				track.hasUnsetDuration = true;
				localCursor += MIN_ACTIVE_S;

			} else if (tok.kind === 'optional') {
				const inner = tok.text.slice(1, -1).trim();
				if (inner) addLabel(inner, true);

			} else if (tok.kind === 'or-alt') {
				// Slash alternative — only the first option goes on the timeline.
				continue;

			} else {
				// 'label' or 'unknown'
				if (tok.kind === 'unknown') unknownTokens.push(tok.text);
				addLabel(tok.text, false);
			}
		}

		flushSegment(); // close any trailing label run

		// Ensure minimum on-field width
		if (localCursor <= cursor) localCursor = cursor + MIN_ACTIVE_S;

		track.activeEnd = localCursor;
		tracks.push(track);

		// Swap time before the next character enters
		if (i < segments.length - 1) {
			cursor = localCursor + swapS;
		} else {
			cursor = localCursor;
		}
	}

	return { tracks, totalDuration: cursor, unknownTokens };
}
