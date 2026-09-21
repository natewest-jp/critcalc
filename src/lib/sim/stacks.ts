/**
 * src/lib/sim/stacks.ts
 *
 * The stack machinery: `gainStacks` / `consumeStacks` dispatch across all three
 * trigger families (onCast / onReaction / onHit), the per-segment syncs that
 * bring rotation-wide accrual into scope, continuous drain, and lifetime expiry
 * (gauge-round L3c — lifted verbatim out of `notationParser.ts`).
 *
 * ⚠️ THREE SCOPES LIVE HERE AND THEY ARE NOT INTERCHANGEABLE. A `source: 'self'`
 * grant writes the hitter's PER-SEGMENT pool, so a swap clears it (Yanfei's
 * Scarlet Seals); a `'team'`/`'others'` grant accrues ROTATION-WIDE on the
 * holder's `CharState`, because the holder may be off-field when it fires
 * (Neuvillette A1). The sync functions are the bridge, and each one owns
 * exactly one key class — ⛔ do not widen one to "also handle" another's keys:
 * syncing a self-sourced key here would zero a fresh segment's own accrual.
 *
 * ↻ THE THIRD IS `gainStacks.scope: 'rotation'` (summon-tick stacks round,
 * 2026-08-31), and ⚠️⚠️ IT IS A DIFFERENT AXIS FROM THE OTHER TWO. `source` says
 * who may FIRE the effect; `scope` says where the stacks LIVE. A rotation-scoped
 * key is `source: 'self'` and still survives a swap, because the resource is not
 * the holder's to carry — Alyosha's Hunter's Mark is a state on the OPPONENT.
 * Its home is `CharState.rotationStacks`, MIRRORED into the live segment pool at
 * every settle point so every existing reader keeps reading the segment map.
 *
 * ⚓⚓ AND IT IS THE ONE SCOPE A SUMMON TICK CAN WRITE. A tick fires while its
 * owner may be off field — inside another character's segment, where the owner
 * has no segment pool at all — so the tick dispatchers are handed a NULL segment
 * pool and a segment-scoped grant is skipped BY CONSTRUCTION rather than by a
 * rule someone has to remember. ⛔ Never hand them a live segment pool "so they
 * work": that pool belongs to whoever happens to be on field.
 */

import type { Effect, Reaction } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import { FPS, framesOf } from '$lib/utils/frames';
import type { CharState } from './charState';
import type { SimContext } from './context';
import {
	DEFAULT_ASCENSION,
	evalCondition,
	mentionsPolestarField,
	reactionMatchesTrigger,
	type ChainIndex,
	type ConditionContext
} from './conditions';
import { onHitTriggerMatches, type HitEvent } from './hits';
import { effectSourcesAtConstellation } from '$lib/utils/effectCollection';
import { liveNegatedStates } from '$lib/utils/stateIndex';
import { openOrRefreshAccrual } from './accrual';

// ---------------------------------------------------------------------------
// Stack SCOPE — where a key's stacks live (summon-tick stacks round, 2026-08-31)
// ---------------------------------------------------------------------------

/** A stack container: the counts and, for `lifetime` keys, the per-instance
 *  expiry lists that back them. The per-segment pair and the rotation-wide pair
 *  have the same shape on purpose — the dispatchers below pick one and are
 *  otherwise identical. */
export type StackPools = {
	state: Map<string, number>;
	instances: Map<string, number[]>;
};

export type StackScope = 'segment' | 'rotation';

const scopeCache = new WeakMap<CharacterData, Map<string, StackScope>>();

/** Every key this character declares a non-default `scope` for.
 *
 *  ⚓ UNGATED BY CONSTELLATION, and that is the constellation-gating round's own
 *  rule: gate the walk that asks "does this fire", never the walk that asks
 *  "what keys exist". A key's home cannot depend on the reader's C-level — if it
 *  did, the same resource would live in two containers at C0 and C6.
 *
 *  ⚠️ First declaration wins HERE, but the authoring rule is the opposite of
 *  `drain`'s: every grant of the key declares the scope and lint D.39 rejects a
 *  disagreement — so "first wins" can never pick between two answers, and a
 *  grant that quietly omitted it would be caught before it reverted the key to
 *  `'segment'`. */
export function stackScopesOf(char: CharacterData): Map<string, StackScope> {
	const cached = scopeCache.get(char);
	if (cached) return cached;
	const m = new Map<string, StackScope>();
	for (const src of [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])]) {
		for (const fx of src.effects ?? []) {
			if (fx.type !== 'gainStacks') continue;
			if (fx.scope === undefined) continue;
			if (m.has(fx.key)) continue;
			m.set(fx.key, fx.scope);
		}
	}
	scopeCache.set(char, m);
	return m;
}

/** Where `key` lives for this character. Absent declaration ⇒ `'segment'`, which
 *  is every corpus key but Alyosha's `huntersMark`. */
export function stackScopeOf(char: CharacterData, key: string): StackScope {
	return stackScopesOf(char).get(key) ?? 'segment';
}

/** The pools a `source: 'self'` grant/consume of `key` must write — or `null`
 *  when there is NOWHERE for it to land, which is a segment-scoped key reached
 *  by a summon tick. ⚓ Returning null is the container decision made explicit:
 *  the caller drops the fire rather than inventing a home for it.
 *
 *  A rotation-scoped key writes `CharState` and carries the segment pool along
 *  as a `mirror`, so the very next read of `stackState` — including the
 *  post-gain snapshot `dispatchHit` takes one line later — already sees it. */
function poolsFor(
	hcs: CharState,
	char: CharacterData,
	key: string,
	seg: StackPools | null
): { write: StackPools; mirror: StackPools | null } | null {
	if (stackScopeOf(char, key) === 'rotation')
		return {
			write: { state: hcs.rotationStacks, instances: hcs.rotationStackInstances },
			mirror: seg
		};
	return seg ? { write: seg, mirror: null } : null;
}

/** Copies one key from the authoritative pool into the mirror. ⚠️ The instance
 *  list is COPIED, not aliased: the segment copy is rewritten wholesale by the
 *  sync and an alias would let a segment-scoped mutation reach the rotation
 *  pool. */
function mirrorKey(target: { write: StackPools; mirror: StackPools | null }, key: string): void {
	if (!target.mirror) return;
	const count = target.write.state.get(key);
	if (count === undefined) target.mirror.state.delete(key);
	else target.mirror.state.set(key, count);
	const inst = target.write.instances.get(key);
	if (inst === undefined) target.mirror.instances.delete(key);
	else target.mirror.instances.set(key, [...inst]);
}

/**
 * Appends `amount` lifetime instances expiring at `expiry`, oldest dropped past
 * `max` — the ONE instance write every lifetime site shares.
 *
 * ⚓ `refresh` is the SHARED duration model (`gainStacks.lifetimeRefresh`): the
 * grant first moves every LIVE instance to the new expiry, so the stacks rise
 * one at a time and fall together. ⚠️ LIVE only — an instance that ran out
 * before `now` and has not been swept yet (a threshold fire has no settle point
 * in front of it) is dropped, never resurrected.
 */
function grantInstances(
	instances: number[],
	amount: number,
	now: number,
	expiry: number,
	max: number | undefined,
	refresh: boolean
): number[] {
	let list = instances;
	if (refresh) list = list.filter((e) => e > now).map(() => expiry);
	for (let i = 0; i < amount; i++) list.push(expiry);
	if (max !== undefined && list.length > max) list.splice(0, list.length - max);
	return list;
}

const NO_STACKS: ReadonlyMap<string, number> = new Map();

/** What a holder's `stacks` Conditions should read at a dispatch site: their
 *  live segment pool when they have one, with their rotation-scoped keys laid
 *  over the top.
 *
 *  ⚠️ The overlay is a no-op for a mirrored self-holder (the mirror already
 *  agrees) and is what makes a rotation-scoped key readable at a site that has
 *  no segment pool at all — a summon tick, or an off-field holder whose stack
 *  conditions previously resolved against an empty map. */
export function stackReadView(
	hcs: CharState,
	seg: Map<string, number> | null
): ReadonlyMap<string, number> {
	if (hcs.rotationStacks.size === 0) return seg ?? NO_STACKS;
	const m = new Map<string, number>(seg ?? []);
	for (const [k, v] of hcs.rotationStacks) m.set(k, v);
	return m;
}

/** The holder's rotation-scoped stacks as a snapshot a `stacks` Condition can
 *  RESOLVE against, or `undefined` when they declare no such key.
 *
 *  ⚠️⚠️ AN EMPTY MAP AND `undefined` ARE NOT THE SAME ANSWER, and the difference
 *  is a bar. A `stacks` Condition with no map is UNRESOLVABLE, and
 *  `deriveBuffWindows` drops an effect only on a definitive false — so a holder
 *  who declares the key and currently holds none of it must hand over an empty
 *  map (`count 0 < min` ⇒ false, no bar), while a holder with no such key hands
 *  over nothing and every other summon in the corpus keeps the `stackContext` it
 *  had. Measured: `Alyosha Q` at C0 drew Hunter's Precision off every maul with
 *  no mark to activate, until this returned the empty map. */
export function rotationStackSnapshot(
	char: CharacterData,
	hcs: CharState
): ReadonlyMap<string, number> | undefined {
	const scopes = stackScopesOf(char);
	let snapshot: Map<string, number> | undefined;
	for (const [key, scope] of scopes) {
		if (scope !== 'rotation') continue;
		snapshot ??= new Map<string, number>();
		snapshot.set(key, hcs.rotationStacks.get(key) ?? 0);
	}
	return snapshot;
}

/** Drops expired instances from a holder's ROTATION-scoped lifetime keys — the
 *  rotation twin of `applyLifetimeExpiry`, which deliberately skips them.
 *  ⚠️ Runs at every settle point AND at every summon tick: the tick is the one
 *  dispatch site with no settle in front of it, and a mark that timed out
 *  mid-burst must not be activated by the next maul. */
export function applyRotationLifetimeExpiry(
	char: CharacterData,
	cursor: number,
	getCharState: (charId: string) => CharState
): void {
	const scopes = stackScopesOf(char);
	if (scopes.size === 0) return;
	const hcs = getCharState(char.id);
	if (hcs.rotationStackInstances.size === 0) return;
	for (const [key, scope] of scopes) {
		if (scope !== 'rotation') continue;
		const instances = hcs.rotationStackInstances.get(key);
		if (!instances || instances.length === 0) continue;
		const remaining = instances.filter((expiry) => expiry > cursor);
		if (remaining.length === instances.length) continue;
		hcs.rotationStackInstances.set(key, remaining);
		hcs.rotationStacks.set(key, remaining.length);
	}
}

/** Expires, then mirrors, the holder's rotation-scoped keys into the live
 *  segment pool. The `scope: 'rotation'` analog of `syncOnHitToStackState`, and
 *  called from the same settle points — ⛔ it must not be folded into that one:
 *  it owns a different key class and reads a different container. */
export function syncRotationStacksToStackState(
	holder: CharacterData,
	currentTime: number,
	stackState: Map<string, number>,
	stackInstances: Map<string, number[]>,
	getCharState: (charId: string) => CharState
): void {
	const scopes = stackScopesOf(holder);
	if (scopes.size === 0) return;
	applyRotationLifetimeExpiry(holder, currentTime, getCharState);
	const hcs = getCharState(holder.id);
	for (const [key, scope] of scopes) {
		if (scope !== 'rotation') continue;
		stackState.set(key, hcs.rotationStacks.get(key) ?? 0);
		const inst = hcs.rotationStackInstances.get(key);
		if (inst === undefined) stackInstances.delete(key);
		else stackInstances.set(key, [...inst]);
	}
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
export function dispatchGainStacks(
	char: CharacterData,
	/** The holder's `CharState` — the home of any `scope: 'rotation'` key. */
	hcs: CharState,
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
	const sources = effectSourcesAtConstellation(char, constellationLevel);
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
				stackState,
				{ negatedStates: liveNegatedStates(char, resolvedStates) }
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
			// ⚓ THE SCOPE PICKS THE CONTAINER, and nothing below it changes: a
			// rotation-scoped key writes `CharState` and is mirrored straight back
			// into the segment pool, so the cast's own post-grant snapshot (taken
			// one line after this call returns) sees it either way.
			const seg: StackPools | null = stackInstances
				? { state: stackState, instances: stackInstances }
				: null;
			const target = poolsFor(hcs, char, fx.key, seg);
			if (fx.lifetime !== undefined && target) {
				// E3 v2.x lifetime: each granted instance lives independently
				// for `lifetime` seconds. Append `amount` instances all at the
				// same expiry-time (cast time + lifetime). Saturation drops
				// oldest first when total would exceed `max`.
				const expiry = castTime + framesOf(fx.lifetime);
				const instances = grantInstances(
					target.write.instances.get(fx.key) ?? [],
					effAmount,
					castTime,
					expiry,
					fx.max,
					fx.lifetimeRefresh === true
				);
				target.write.instances.set(fx.key, instances);
				target.write.state.set(fx.key, instances.length);
				mirrorKey(target, fx.key);
			} else if (stackScopeOf(char, fx.key) === 'rotation') {
				const current = hcs.rotationStacks.get(fx.key) ?? 0;
				const next = current + effAmount;
				hcs.rotationStacks.set(fx.key, fx.max !== undefined ? Math.min(next, fx.max) : next);
				stackState.set(fx.key, hcs.rotationStacks.get(fx.key)!);
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
export function dispatchConsumeStacks(
	char: CharacterData,
	/** The holder's `CharState` — the home of any `scope: 'rotation'` key. */
	hcs: CharState,
	castType: 'skill' | 'burst',
	resolvedStates: ReadonlySet<string>,
	constellationLevel: number,
	chainIdx: ChainIndex,
	stackState: Map<string, number>,
	castInput?: string,
	stackInstances?: Map<string, number[]>
): void {
	const sources = effectSourcesAtConstellation(char, constellationLevel);
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
				stackState,
				{ negatedStates: liveNegatedStates(char, resolvedStates) }
			);
			if (condResult !== true) continue;
			// ⚓ The consume side never declares a scope — a key has ONE home and
			// this resolves it from the grant that named it.
			const seg: StackPools = {
				state: stackState,
				instances: stackInstances ?? new Map<string, number[]>()
			};
			const target = poolsFor(hcs, char, fx.key, seg)!;
			if (fx.amount === 'all') {
				target.write.state.set(fx.key, 0);
				target.write.instances.delete(fx.key);
			} else {
				const current = target.write.state.get(fx.key) ?? 0;
				target.write.state.set(fx.key, Math.max(0, current - fx.amount));
				const instances = target.write.instances.get(fx.key);
				if (instances && instances.length > 0) {
					instances.splice(0, Math.min(fx.amount, instances.length));
				}
			}
			mirrorKey(target, fx.key);
		}
	}
}

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
export function dispatchGainStacksOnReaction(
	allChars: CharacterData[],
	triggerCharId: string,
	emittedReaction: Reaction,
	castTime: number,
	/** ⚓ A RESOLVER, not a map, since the stack-threshold round (2026-09-18):
	 *  the holder of a `'team'` grant may be OFF FIELD when the reaction fires,
	 *  and this used to hand every holder but the trigger character an empty
	 *  set — so a `state` gate on such a grant (Columbina's Gravity accrues only
	 *  `duringSummon`) was unresolvable and skipped whenever a teammate made
	 *  the reaction. `holderStatesAt` answers for any holder, as it does for
	 *  the onHit dispatcher. Byte-identical for the three team grants that
	 *  predate it (Chevreuse, Neuvillette, Varka — no `state` conditions). */
	getHolderStates: (holder: CharacterData) => ReadonlySet<string>,
	constellationByHolder: Map<string, number>,
	getCharState: (charId: string) => CharState,
	/** ⚓ A TICK, not a reaction (exact-model round): a Lunar-Charged tick
	 *  refreshes an ACCRUAL status and nothing else — a plain count would
	 *  otherwise gain once per tick, which no kit says. `triggerCharId` is ''
	 *  on this path: a tick has no trigger character, so only team grants hear it. */
	accrualOnly = false
): void {
	for (const holder of allChars) {
		const holderCons = constellationByHolder.get(holder.id) ?? 0;
		const sources = effectSourcesAtConstellation(holder, holderCons);
		for (const src of sources) {
			const effects = src.effects ?? [];
			for (let effIdx = 0; effIdx < effects.length; effIdx++) {
				const fx = effects[effIdx];
				if (fx.type !== 'gainStacks') continue;
				if (fx.trigger.type !== 'onReaction') continue;
				if (accrualOnly && fx.accrual === undefined) continue;
				const srcMode = fx.trigger.source ?? 'self';
				if (srcMode === 'self' && holder.id !== triggerCharId) continue;
				if (!reactionMatchesTrigger(emittedReaction, fx.trigger.reaction)) continue;
				const holderStates = getHolderStates(holder);
				const condResult = evalCondition(
					fx.conditions,
					DEFAULT_ASCENSION,
					holderStates,
					holderCons,
					new Map(),
					undefined,
					{ negatedStates: liveNegatedStates(holder, holderStates) }
				);
				if (condResult !== true) continue;
				const hcs = getCharState(holder.id);
				// Effect-level `procCooldown` — the onHit dispatcher's rule, mirrored
				// (stack-threshold round, 2026-09-18). ⚓ It is how a grant states a
				// RATE: Columbina's Gravity accrues 10/s while a 2s status any Lunar
				// reaction refreshes is live, which "20 per reaction, at most one
				// grant per 2s" reproduces under both a sparse and a dense reaction
				// stream (an uncapped count reached 60 in three ticks of one EC).
				const pc = fx.procCooldown;
				const pcNum = typeof pc === 'number' ? framesOf(pc) : undefined;
				if (pcNum !== undefined && pcNum > 0) {
					const fxKey = `${src.id}#${effIdx}`;
					const last = hcs.onReactionProcLastFire.get(fxKey) ?? -Infinity;
					if (castTime - last < pcNum) continue;
					hcs.onReactionProcLastFire.set(fxKey, castTime);
				}
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
				// ⚓ An accrual grant opens or refreshes its status and adds nothing
				// itself — `amount` is a rate there. See `accrual.ts`.
				if (fx.accrual !== undefined) {
					openOrRefreshAccrual(
						hcs,
						fx.accrual.group,
						fx.key,
						effAmount,
						fx.accrual.window,
						castTime,
						fx.max
					);
					continue;
				}
				const holderState = hcs.onReactionStacks;
				if (fx.lifetime !== undefined) {
					const expiry = castTime + framesOf(fx.lifetime);
					const holderInstances = hcs.onReactionStackInstances;
					const instances = grantInstances(
						holderInstances.get(fx.key) ?? [],
						effAmount,
						castTime,
						expiry,
						fx.max,
						fx.lifetimeRefresh === true
					);
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
/* ── ⚓ WHY THE FOUR HOUSEKEEPING WALKS BELOW ARE NOT CONSTELLATION-GATED ────
 *
 * `effectSourcesAtConstellation` gates every walk in this file that DECIDES
 * something — the five dispatchers and `applyDrain`. The four below
 * (`syncOnReactionToStackState`, `syncOnHitToStackState`,
 * `syncSourceLifetimeToStackState`, `applyLifetimeExpiry`) do not decide; they
 * collect a KEY SPACE and keep the per-segment copy of it in step. Gating them
 * would be a no-op in the good case and a bug in the bad one:
 *
 *  · a key only a LOCKED constellation introduces can never be granted (its
 *    dispatcher is gated), so syncing or expiring it writes 0 over 0;
 *  · a key SHARED between an ability and a constellation is the bad case —
 *    Skirk's `serpentsSubtlety` is granted by her skill and again by her C2,
 *    and Linnea's `fieldCatalog` is granted by her C1 and carries the only
 *    `lifetime` declaration for that key. Gate the expiry walk and a stack the
 *    ability granted would never expire, because the entry that says how long
 *    it lives is locked.
 *
 * ⚓ The rule: gate the walk that asks "does this fire", never the walk that
 * asks "what keys exist". */
export function syncOnReactionToStackState(
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
export function dispatchGainStacksOnHit(
	allChars: CharacterData[],
	hit: HitEvent,
	getHolderStates: (holder: CharacterData) => ReadonlySet<string>,
	constellationByHolder: Map<string, number>,
	getCharState: (charId: string) => CharState,
	/** ⚓ NULL AT A SUMMON TICK — the tick has no segment pool to write, so a
	 *  segment-scoped grant is skipped rather than landing on whoever is on
	 *  field. See the file header. */
	segPools: StackPools | null,
	/** Whether a Polestar Field stands at an instant — for a grant gated on
	 *  `inPolestarField` (the Cryo Traveler's per-hit crystals build Frostglow
	 *  only inside one). Absent → the leaf is unresolvable and, under this
	 *  dispatcher's demand for a definitive `true`, the grant never fires. */
	fieldOpenAt?: (time: number) => boolean
): void {
	for (const holder of allChars) {
		const holderCons = constellationByHolder.get(holder.id) ?? 0;
		const sources = effectSourcesAtConstellation(holder, holderCons);
		for (const src of sources) {
			const effects = src.effects ?? [];
			for (let effIdx = 0; effIdx < effects.length; effIdx++) {
				const fx = effects[effIdx];
				if (fx.type !== 'gainStacks') continue;
				if (fx.trigger.type !== 'onHit') continue;
				if (!onHitTriggerMatches(fx.trigger, hit, holder.id)) continue;
				const isSelf = holder.id === hit.characterId;
				const holderStates = getHolderStates(holder);
				// Self-holder conditions read the hitter's live segment stack
				// state; off-field holders have no segment state (their stack
				// conditions resolve against an empty map — pre-existing gap).
				// ↻ Plus the holder's own rotation-scoped keys, which is what lets
				// a mark be READ at a site with no segment pool at all.
				const condStacks = stackReadView(
					getCharState(holder.id),
					isSelf && segPools ? segPools.state : null
				);
				const condResult = evalCondition(
					fx.conditions,
					DEFAULT_ASCENSION,
					holderStates,
					holderCons,
					new Map(),
					condStacks,
					{
						negatedStates: liveNegatedStates(holder, holderStates),
						...(fieldOpenAt && mentionsPolestarField(fx.conditions)
							? { inPolestarField: fieldOpenAt(hit.time) }
							: {})
					}
				);
				if (condResult !== true) continue;
				const hcs = getCharState(holder.id);
				// Effect-level ICD (Escoffier C6: 0.5s). ScaledValue procCooldowns
				// are weapon-shaped and don't occur on character effects.
				const pc = fx.procCooldown;
				const pcNum = typeof pc === 'number' ? framesOf(pc) : undefined;
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
					const expiry = hit.time + framesOf(fx.sourceLifetime);
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
					// ⚓ `self` — the SCOPE picks the container (segment by default,
					// `CharState` for a rotation-scoped key), and a null target means
					// there is nowhere for this grant to land: a segment-scoped key
					// reached by a summon tick. ⛔ Don't "fix" that by falling back to
					// the on-field character's pool.
					const target = poolsFor(hcs, holder, fx.key, segPools);
					if (!target) continue;
					if (fx.lifetime !== undefined) {
						const expiry = hit.time + framesOf(fx.lifetime);
						const instances = grantInstances(
							target.write.instances.get(fx.key) ?? [],
							effAmount,
							hit.time,
							expiry,
							fx.max,
							fx.lifetimeRefresh === true
						);
						target.write.instances.set(fx.key, instances);
						target.write.state.set(fx.key, instances.length);
					} else {
						const current = target.write.state.get(fx.key) ?? 0;
						const next = current + effAmount;
						target.write.state.set(fx.key, fx.max !== undefined ? Math.min(next, fx.max) : next);
					}
					mirrorKey(target, fx.key);
					if (fx.drain) hcs.drainAnchors.set(fx.key, hit.time);
				} else if (fx.lifetime !== undefined) {
					// team/others — rotation-wide instance accrual (onReaction shape).
					const expiry = hit.time + framesOf(fx.lifetime);
					const instances = grantInstances(
						hcs.onHitStackInstances.get(fx.key) ?? [],
						effAmount,
						hit.time,
						expiry,
						fx.max,
						fx.lifetimeRefresh === true
					);
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
export function dispatchConsumeStacksOnHit(
	allChars: CharacterData[],
	hit: HitEvent,
	getHolderStates: (holder: CharacterData) => ReadonlySet<string>,
	constellationByHolder: Map<string, number>,
	getCharState: (charId: string) => CharState,
	/** ⚓ NULL AT A SUMMON TICK — see the gain dispatcher's note. */
	segPools: StackPools | null,
	/** Closes a named state of `holder`'s at `at` — what a spend that EMPTIES
	 *  its key does when it carries `closesStateWhenEmpty` (Illuga's Oriole-Song
	 *  ends with her Nightingale's Song). Handed in because the state records
	 *  live on the sim context, which this module does not import. */
	closeState?: (holder: CharacterData, state: string, at: number) => void
): void {
	for (const holder of allChars) {
		const holderCons = constellationByHolder.get(holder.id) ?? 0;
		const sources = effectSourcesAtConstellation(holder, holderCons);
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.type !== 'consumeStacks') continue;
				if (fx.trigger.type !== 'onHit') continue;
				if (!onHitTriggerMatches(fx.trigger, hit, holder.id)) continue;
				const isSelf = holder.id === hit.characterId;
				const holderStates = getHolderStates(holder);
				const condStacks = stackReadView(
					getCharState(holder.id),
					isSelf && segPools ? segPools.state : null
				);
				const condResult = evalCondition(
					fx.conditions,
					DEFAULT_ASCENSION,
					holderStates,
					holderCons,
					new Map(),
					condStacks,
					{ negatedStates: liveNegatedStates(holder, holderStates) }
				);
				if (condResult !== true) continue;
				const hcs = getCharState(holder.id);
				// ⚓ A TEAMMATE'S HIT SPENDS THE KEY WHERE IT LIVES (2026-09-21). This
				// arm wrote `onHitStacks` whatever the key, which is right only for a
				// key a team/others `onHit` grant accrues there. Illuga's Nightingale's
				// Song is seeded by her burst into the ROTATION pool and spent by "the
				// active character's Geo hits": measured with a Ningguang partner, seven
				// Geo hits and the pool untouched — the spend landed in a container
				// nothing reads. `homeOf` is the one answer to "which container", the
				// same one the swap-in grant and the threshold reader ask.
				//
				// ⚠️ No mirror, and no segment home: `segPools` here is the HITTER's
				// pool, never the holder's, so there is no live copy of the holder's to
				// keep in step — the next settle point carries a rotation-scoped key
				// into it, the summon ticks' rule.
				const target = isSelf
					? poolsFor(hcs, holder, fx.key, segPools)
					: (() => {
							const write = poolsAtHome(hcs, homeOf(holder, fx.key), null);
							return write ? { write, mirror: null } : null;
						})();
				if (!target) continue;
				const { state, instances } = target.write;
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
				mirrorKey(target, fx.key);
				if (fx.closesStateWhenEmpty !== undefined && (state.get(fx.key) ?? 0) <= 0)
					closeState?.(holder, fx.closesStateWhenEmpty, hit.time);
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
export function syncOnHitToStackState(
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
export function syncSourceLifetimeToStackState(
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
export function applyDrain(
	ctx: SimContext,
	char: CharacterData,
	cursor: number,
	currentStates: ReadonlySet<string>,
	stackState: Map<string, number>
): void {
	const cs = ctx.getCharState(char.id);
	const sources = effectSourcesAtConstellation(
		char,
		ctx.team.constellationByHolder.get(char.id) ?? 0
	);
	const seenKeys = new Set<string>();
	for (const src of sources) {
		for (const fx of src.effects ?? []) {
			if (fx.type !== 'gainStacks') continue;
			if (!fx.drain) continue;
			if (seenKeys.has(fx.key)) continue; // first drain spec per key wins
			seenKeys.add(fx.key);
			const charAnchors = cs.drainAnchors;
			const last = charAnchors.get(fx.key);
			// ⚠️⚠️ `ratePerSecond` IS A RATE, NOT A DURATION — ⛔ do not run it
			// through `framesOf`. `elapsed` is frames (C1), so the seconds the
			// rate is quoted against have to come back out of the elapsed side.
			// Skirk's Serpent's Subtlety drains 7/sec; miss this and she drains
			// 420/sec and the resource is gone by the next token.
			const perFrame = fx.drain.ratePerSecond / FPS;
			if (currentStates.has(fx.drain.state)) {
				if (last !== undefined) {
					const elapsed = cursor - last;
					if (elapsed > 0) {
						const current = stackState.get(fx.key) ?? 0;
						const decayed = Math.max(0, current - perFrame * elapsed);
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
					const decayed = Math.max(0, current - perFrame * elapsed);
					stackState.set(fx.key, decayed);
				}
				charAnchors.delete(fx.key);
			}
		}
	}
}

/** Apply per-stack lifetime expiry (E3 v2.x) for every gainStacks key on
 *  `char` that declares a `lifetime` spec. Drops instances whose expiry
 *  time has passed and updates `stackState[key]` to the remaining count.
 *  Lazy: only runs at cast events (mirroring `applyDrain`). The first
 *  lifetime spec per key wins (matches the drain convention).
 *
 *  Operates on the per-segment `stackInstances` map; called from cast
 *  handlers BEFORE `dispatchGainStacks` so reads see expired counts and
 *  fresh grants land cleanly on top. */
export function applyLifetimeExpiry(
	char: CharacterData,
	cursor: number,
	stackState: Map<string, number>,
	stackInstances: Map<string, number[]>
): void {
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
			// ↻ And rotation-scoped keys, owned by `applyRotationLifetimeExpiry`
			// via `syncRotationStacksToStackState` — same reason as the two above:
			// the segment copy here is a MIRROR the sync has just rewritten.
			if (stackScopeOf(char, fx.key) === 'rotation') continue;
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
}

// ---------------------------------------------------------------------------
// A key's HOME — which container its count lives in
// ---------------------------------------------------------------------------

// ↻ Lifted out of `thresholds.ts` (swap-in stacks round, 2026-09-19): the
// threshold reader was the only place that knew it, and the swap-in grant is a
// second thing that must WRITE a key where it already lives.

/** Where a key's count lives — `thresholds.ts`' header tells the five apart. */
export type Home = 'rotation' | 'onReaction' | 'onHit' | 'sourceLifetime' | 'segment';

/** The home of `key` on `holder`, resolved from every grant that names it —
 *  constellation-ungated on purpose (`stackScopesOf`'s own rule). First grant wins; every
 *  grant of a key agrees on scope by lint D.39, and on trigger family by the
 *  key naming one resource. */
export function homeOf(holder: CharacterData, key: string): Home {
	if (stackScopeOf(holder, key) === 'rotation') return 'rotation';
	for (const src of [
		...holder.abilities,
		...(holder.passives ?? []),
		...(holder.constellations ?? [])
	]) {
		for (const fx of src.effects ?? []) {
			if (fx.type !== 'gainStacks' || fx.key !== key) continue;
			const t = fx.trigger;
			if (t.type === 'onReaction' && t.source === 'team') return 'onReaction';
			if (t.type === 'onHit') {
				if (fx.sourceLifetime !== undefined) return 'sourceLifetime';
				if (t.source === 'team' || t.source === 'others') return 'onHit';
			}
			return 'segment';
		}
	}
	return 'segment';
}

/** The container a home names on `hcs` — `seg` for a segment home, which is
 *  null wherever the holder's own live pool is not in hand. A `sourceLifetime`
 *  home is a per-SOURCE slot map, not a count, and has no pools to hand back. */
function poolsAtHome(hcs: CharState, home: Home, seg: StackPools | null): StackPools | null {
	switch (home) {
		case 'rotation':
			return { state: hcs.rotationStacks, instances: hcs.rotationStackInstances };
		case 'onReaction':
			return { state: hcs.onReactionStacks, instances: hcs.onReactionStackInstances };
		case 'onHit':
			return { state: hcs.onHitStacks, instances: hcs.onHitStackInstances };
		case 'segment':
			return seg;
		default:
			return null;
	}
}

// ---------------------------------------------------------------------------
// gainStacks on a threshold fire (stack-count display round, 2026-09-19)
// ---------------------------------------------------------------------------

/**
 * Applies the `gainStacks` effects hanging off ONE threshold fire — a stack per
 * Gravity Interference is Columbina's Lunacy.
 *
 * ⚓ ROTATION-SCOPED KEYS ONLY, and lint says so: a fire lands at a reaction, a
 * tick or a scheduled poll, none of which has a segment pool in hand (the
 * summon-tick rule), so a segment-scoped grant has nowhere to live. When the
 * holder IS the on-field character at a cast or hit site, `segPools` is theirs
 * and the key is mirrored so the very next read sees it.
 *
 * ⚠️ Conditions demand a definitive `true`, the stack dispatchers' rule, under
 * the same closed world (`liveNegatedStates`).
 */
export function dispatchGainStacksOnStackFire(
	holder: CharacterData,
	hcs: CharState,
	effects: readonly Effect[],
	dominant: string,
	time: number,
	states: ReadonlySet<string>,
	constellationLevel: number,
	context: ConditionContext,
	segPools: StackPools | null
): void {
	let swept = false;
	for (const fx of effects) {
		if (fx.type !== 'gainStacks' || fx.trigger.type !== 'onStack') continue;
		if (fx.trigger.dominant !== undefined && fx.trigger.dominant !== dominant) continue;
		if (stackScopeOf(holder, fx.key) !== 'rotation') continue;
		const verdict = evalCondition(
			fx.conditions,
			DEFAULT_ASCENSION,
			states,
			constellationLevel,
			new Map(),
			stackReadView(hcs, segPools?.state ?? null),
			{ ...context, negatedStates: liveNegatedStates(holder, states) }
		);
		if (verdict !== true) continue;
		// No settle point stands in front of a fire — sweep before counting.
		if (!swept) {
			applyRotationLifetimeExpiry(holder, time, () => hcs);
			swept = true;
		}
		let amount = fx.amount;
		if (fx.constellationScaling) {
			const cs = evalCondition(
				fx.constellationScaling.conditions,
				DEFAULT_ASCENSION,
				states,
				constellationLevel,
				new Map(),
				undefined,
				context
			);
			if (cs === true) amount = fx.constellationScaling.amount;
		}
		const target = poolsFor(hcs, holder, fx.key, segPools);
		if (!target) continue;
		if (fx.lifetime !== undefined) {
			const instances = grantInstances(
				target.write.instances.get(fx.key) ?? [],
				amount,
				time,
				time + framesOf(fx.lifetime),
				fx.max,
				fx.lifetimeRefresh === true
			);
			target.write.instances.set(fx.key, instances);
			target.write.state.set(fx.key, instances.length);
		} else {
			const next = (target.write.state.get(fx.key) ?? 0) + amount;
			target.write.state.set(fx.key, fx.max !== undefined ? Math.min(next, fx.max) : next);
		}
		mirrorKey(target, fx.key);
	}
}

// ---------------------------------------------------------------------------
// gainStacks on taking the field (swap-in stacks round, 2026-09-19)
// ---------------------------------------------------------------------------

/**
 * Applies the entering character's `gainStacks … onSwapIn` effects — Neuvillette
 * C1: "When Neuvillette takes the field, he will obtain 1 stack of Past
 * Draconic Glories".
 *
 * ⚓⚓ THE GRANT WRITES THE KEY'S HOME, not the entering segment's pool. A key
 * names ONE resource with ONE container (`homeOf`), and his lives in the
 * rotation-wide `onReaction` accumulator because its first grant is a
 * team-sourced reaction — a stack written to the fresh segment pool would be
 * overwritten by the very next settle's sync. Every home but `sourceLifetime`
 * (a per-SOURCE slot map, where "a stack from taking the field" has no source)
 * is writable.
 *
 * ⚠️ Conditions demand a definitive `true` under the live closed world, the
 * stack dispatchers' rule.
 */
export function dispatchGainStacksOnSwapIn(
	char: CharacterData,
	hcs: CharState,
	time: number,
	states: ReadonlySet<string>,
	constellationLevel: number,
	segPools: StackPools
): void {
	for (const src of effectSourcesAtConstellation(char, constellationLevel)) {
		const effects = src.effects ?? [];
		for (let effIdx = 0; effIdx < effects.length; effIdx++) {
			const fx = effects[effIdx];
			if (fx.type !== 'gainStacks' || fx.trigger.type !== 'onSwapIn') continue;
			const verdict = evalCondition(
				fx.conditions,
				DEFAULT_ASCENSION,
				states,
				constellationLevel,
				new Map(),
				stackReadView(hcs, segPools.state),
				{ negatedStates: liveNegatedStates(char, states) }
			);
			if (verdict !== true) continue;
			const home = homeOf(char, fx.key);
			const pools = poolsAtHome(hcs, home, segPools);
			if (!pools) continue;
			if (fx.lifetime !== undefined) {
				const live = (pools.instances.get(fx.key) ?? []).filter((e) => e > time);
				// ⚓ TAKING THE FIELD AGAIN REFRESHES THE STACK IT GAVE, it does not add
				// a second. "He will obtain 1 stack" is one slot with one source — gcsim
				// models it as a base count of exactly 1 — so the instance this effect
				// last wrote is withdrawn before the new one goes in. ⚠️ Matched by its
				// EXPIRY, which is what an instance is; if a reaction's stack happens to
				// share the frame, withdrawing either is the same count.
				const fxKey = `${src.id}#${effIdx}`;
				const prior = hcs.swapInGrantExpiry.get(fxKey);
				if (prior !== undefined) {
					const at = live.indexOf(prior);
					if (at >= 0) live.splice(at, 1);
				}
				hcs.swapInGrantExpiry.set(fxKey, time + framesOf(fx.lifetime));
				const instances = grantInstances(
					live,
					fx.amount,
					time,
					time + framesOf(fx.lifetime),
					fx.max,
					fx.lifetimeRefresh === true
				);
				pools.instances.set(fx.key, instances);
				pools.state.set(fx.key, instances.length);
			} else {
				const next = (pools.state.get(fx.key) ?? 0) + fx.amount;
				pools.state.set(fx.key, fx.max !== undefined ? Math.min(next, fx.max) : next);
			}
			// A rotation-scoped key is mirrored into the live pool like every other
			// write of one; the two accumulators are pulled in by the next settle.
			if (home === 'rotation') {
				segPools.state.set(fx.key, pools.state.get(fx.key) ?? 0);
				const inst = pools.instances.get(fx.key);
				if (inst) segPools.instances.set(fx.key, [...inst]);
			}
		}
	}
}
