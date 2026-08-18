/**
 * src/lib/sim/stacks.ts
 *
 * The stack machinery: `gainStacks` / `consumeStacks` dispatch across all three
 * trigger families (onCast / onReaction / onHit), the per-segment syncs that
 * bring rotation-wide accrual into scope, continuous drain, and lifetime expiry
 * (gauge-round L3c — lifted verbatim out of `notationParser.ts`).
 *
 * ⚠️ TWO SCOPES LIVE HERE AND THEY ARE NOT INTERCHANGEABLE. A `source: 'self'`
 * grant writes the hitter's PER-SEGMENT pool, so a swap clears it (Yanfei's
 * Scarlet Seals); a `'team'`/`'others'` grant accrues ROTATION-WIDE on the
 * holder's `CharState`, because the holder may be off-field when it fires
 * (Neuvillette A1). The sync functions are the bridge, and each one owns
 * exactly one key class — ⛔ do not widen one to "also handle" another's keys:
 * syncing a self-sourced key here would zero a fresh segment's own accrual.
 */

import type { Reaction } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import { FPS, framesOf } from '$lib/utils/frames';
import type { CharState } from './charState';
import type { SimContext } from './context';
import {
	DEFAULT_ASCENSION,
	evalCondition,
	reactionMatchesTrigger,
	type ChainIndex
} from './conditions';
import { onHitTriggerMatches, type HitEvent } from './hits';
import { effectSourcesAtConstellation } from '$lib/utils/effectCollection';

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
				const expiry = castTime + framesOf(fx.lifetime);
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
export function dispatchConsumeStacks(
	char: CharacterData,
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
	resolvedStatesByHolder: Map<string, ReadonlySet<string>>,
	constellationByHolder: Map<string, number>,
	getCharState: (charId: string) => CharState
): void {
	for (const holder of allChars) {
		const holderCons = constellationByHolder.get(holder.id) ?? 0;
		const sources = effectSourcesAtConstellation(holder, holderCons);
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.type !== 'gainStacks') continue;
				if (fx.trigger.type !== 'onReaction') continue;
				const srcMode = fx.trigger.source ?? 'self';
				if (srcMode === 'self' && holder.id !== triggerCharId) continue;
				if (!reactionMatchesTrigger(emittedReaction, fx.trigger.reaction)) continue;
				const holderStates = resolvedStatesByHolder.get(holder.id) ?? new Set<string>();
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
					const expiry = castTime + framesOf(fx.lifetime);
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
	segStackState: Map<string, number>,
	segStackInstances: Map<string, number[]>
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
					// Segment-scoped grant — mirrors the onCast dispatch branches.
					if (fx.lifetime !== undefined) {
						const expiry = hit.time + framesOf(fx.lifetime);
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
					const expiry = hit.time + framesOf(fx.lifetime);
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
export function dispatchConsumeStacksOnHit(
	allChars: CharacterData[],
	hit: HitEvent,
	getHolderStates: (holder: CharacterData) => ReadonlySet<string>,
	constellationByHolder: Map<string, number>,
	getCharState: (charId: string) => CharState,
	segStackState: Map<string, number>,
	segStackInstances: Map<string, number[]>
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
