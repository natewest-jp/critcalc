/**
 * src/lib/sim/states.ts
 *
 * Named runtime states — what is true about a character at an instant, and the
 * windows that make it true (gauge-round L3c, lifted out of `notationParser.ts`).
 *
 * ⚠️ THERE ARE TWO STATE RESOLVERS AND THEY ARE NOT THE SAME QUESTION.
 * `inferredStates` answers it for the ACTIVE character during resolution and
 * counts only STATIONARY persistent summons. `holderStatesAt` answers it for ANY
 * holder at an arbitrary instant — including off-field ones, because Escoffier
 * C6 gates on HER `duringSummon` while a TEAMMATE's hit fires the trigger — and
 * its summon check is deliberately BROADER (a following summon counts). ⛔ Do not
 * unify them without deciding which semantics every caller wanted.
 *
 * ⚠️⚠️ `inferredStates` scans NEWEST-FIRST and takes a `kinds` guard, and both are
 * PERFORMANCE, not style. The 2026-08-14 sweep measured this function at 76% of
 * parse time on a cast-heavy rotation (396 ms → 94 ms with it stubbed), and the
 * cost is counter-intuitive: it is the MISSING scan that hurts, because a run of
 * pure bursts walks every cast in the skill branch and never matches. ⛔ Do not
 * rewrite the backwards loop as `.some()`, and ⛔ do not drop the high-water mark.
 */

import type { TransientStateSpec } from '$lib/types/ability';
import type { CastAbility } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import { getPersistentBehavior } from '$lib/types/ability';
import { framesOf } from '$lib/utils/frames';
import type { CastEvent } from '$lib/utils/rotationEvents';
import type { CharState } from './charState';
import type { SimContext } from './context';
import { DEFAULT_ASCENSION, evalCondition, type ChainIndex } from './conditions';
import { findSummonsForBar } from './summons';

/**
 * Infers which named states are active for this character at `cursor` based on
 * the character's cast events emitted so far (post-P4 #3: casts, not bars, are
 * the mid-parse record — bars are projected from them at finalize).
 *
 * Currently detects `duringSummon`: any stationary persistent Q or E cast whose
 * active summon window covers `cursor`. The window starts at
 * cast.time + summonActivatesAt and ends `uptime` frames later. Works both
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
export function inferredStates(
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
		const activatesAt = c.summonActivatesAt;
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

// Close an open named state at `at` (gcsim DeleteStatus): clamp the live
// CharState entry and every open window record. Shared by the variant
// `consumesState` clamp and TransientStateSpec `consumes` (post-P4 #2).
// No-op when the state isn't currently open past `at` — a record clamped
// by an earlier close stays clamped.
export function closeStateWindows(
	ctx: SimContext,
	cs: CharState,
	characterId: string,
	name: string,
	at: number
): void {
	const openEnd = cs.states.get(name);
	if (openEnd === undefined || openEnd <= at) return;
	cs.states.set(name, at);
	for (const rec of ctx.stateWindowRecs) {
		if (rec.characterId === characterId && rec.name === name && rec.end > at) {
			rec.end = at;
		}
	}
}

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
// Open a post-action transient state (sQ primitive, generalized post-P4
// #2): shared by the instant-cast `opensTransientState` site and the
// per-action `actionOpensState` sites (plunge landing, normal first-swing
// recovery). Evaluates the spec's conditions against the caller's state
// snapshot, closes any `consumes` targets at the open instant, and pushes
// the window record with the caller's provenance (cast XOR action id).
export function openTransientState(
	ctx: SimContext,
	spec: TransientStateSpec,
	cs: CharState,
	characterId: string,
	openAt: number,
	states: ReadonlySet<string>,
	constellationLevel: number,
	provenance: { sourceCastId?: number; sourceActionId?: number; source?: 'skill' | 'burst' },
	chainIdx?: ChainIndex,
	stackState?: ReadonlyMap<string, number>
): void {
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
		for (const name of spec.consumes) closeStateWindows(ctx, cs, characterId, name, openAt);
	}
	const stateEnd = openAt + framesOf(spec.duration);
	cs.states.set(spec.state, stateEnd);
	ctx.stateWindowRecs.push({
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
}

export type CastKinds = { scanned: number; hasSkill: boolean; hasBurst: boolean };

export function castKinds(ctx: SimContext, charId: string, casts: readonly CastEvent[]): CastKinds {
	let k = ctx.castKindsByChar.get(charId);
	if (!k) {
		k = { scanned: 0, hasSkill: false, hasBurst: false };
		ctx.castKindsByChar.set(charId, k);
	}
	for (; k.scanned < casts.length; k.scanned++) {
		const ability = casts[k.scanned].ability;
		if (ability === 'skill') k.hasSkill = true;
		else if (ability === 'burst') k.hasBurst = true;
	}
	return k;
}

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
export function holderStatesAt(
	ctx: SimContext,
	holder: CharacterData,
	t: number
): ReadonlySet<string> {
	const states = new Set<string>();
	const hcs = ctx.charStates.get(holder.id);
	if (hcs) {
		if (hcs.stance !== undefined && hcs.stance.start <= t && hcs.stance.end > t)
			states.add('inStance');
		for (const [name, end] of hcs.states) if (end > t) states.add(name);
	}
	const casts = ctx.castsByChar.get(holder.id);
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
			const start = c.time + c.summonActivatesAt;
			if (t >= start && t < start + c.uptime) {
				states.add('duringSummon');
				break;
			}
		}
	}
	return states;
}
