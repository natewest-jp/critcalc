/**
 * src/lib/sim/cooldownReduce.ts
 *
 * ⚓ THE `cooldownReduce` READER (cooldown-reduction round, 2026-09-18). The
 * effect was declared 2026-07 with no consumer anywhere in `src` — its only
 * occurrences were its own type declaration and one doc cross-reference — and
 * `orphanedSchema.test.ts` could not see the class, because it matches property
 * ACCESS and `cooldownReduce` is a `type` VALUE. Raiden's and Beidou's curator
 * notes called it "schema-only / parser-deferred" for two months.
 *
 * Three triggers, one registry, one mover:
 *
 *   `onHit`        the holder (or a teammate) landed a hit    Varka's Secret
 *                                                              Rite, Raiden C6,
 *                                                              Kujou Sara C1
 *   `onCast`       the holder cast its own skill or burst     Itto C2
 *   `onReaction`   somebody caused a reaction                 Dori A1
 *
 * ⚓⚓ WHAT A REDUCTION MOVES, AND WHY BOTH. A cast's cooldown lives in TWO
 * places: the charge queue (`ctx.eChargeQueues` for a skill, `cs.qReadyAt` for
 * a burst) decides where the next cast can be PLACED, and the cast event's
 * `readyAt` is the ghost tail the reader looks at to answer "when can I recast".
 * The stance-end site (Xilonen/Ifa) already moves both, and says why: move one
 * and the chart and the parser disagree. `reduceCooldown` below is that pair as
 * ONE function, and the Kazuha-C1 refund now goes through it too — measured
 * before: `Kazuha E Q E` at C1 placed the second E at 169f while the first E's
 * tail still ran to 332f.
 *
 * ⚓ Charges recharge ONE AT A TIME, so every charge still recharging behind the
 * earliest is one chain and moves by the same amount — gcsim reduces
 * `cdQueue[a][0]` and restarts the worker, which shifts everything queued behind
 * it. A reduction larger than what remains is a reset (`ResetActionCooldown`);
 * a cooldown that is not running is left alone (gcsim's early return).
 *
 * ⚓ THE SKILL IT MOVES IS THE ONE ACTIVE AT THE FIRE — `resolveActiveAbility`
 * at the trigger's instant, with the receiver's own states and team scope — for
 * an effect hosted on a passive, a constellation or a burst (Sara C1 reaches
 * Tengu Stormcall; a Cyno-shaped reduction in his burst would reach the in-stance
 * E). That is the redirection gcsim writes as a `ReduceActionCooldown` override
 * on Varka, Odette and Cyno, and here it costs no field. ⚠️ An effect hosted ON
 * a skill reduces that skill and nothing else (`hostSkillId`): Varka's Secret
 * Rite is authored on Four Winds, and in a party where Four Winds never
 * resolves the reduction must land on its (unreachable) queue rather than on
 * Windbound Execution's — which is what gcsim does too.
 *
 * ⚠️ The ordering hazard the round doc worried about is real but already safe:
 * the charge-queue wait scan (`run.ts`, the `scanGuard` loop) is PURE and reads
 * the queue; a reduction mutates it. They cannot race, because a reduction
 * fires on a hit, a cast or a reaction, and you cannot swing during a cooldown
 * wait — so every reduction a wait should see has dispatched in parse order
 * before the scan reads the queue. The one reduction that fires INSIDE the cast
 * pipeline (an `onCast` on the caster's own cast) runs after the CD write, so it
 * sees the clock it is meant to shorten.
 */

import type { CharacterData } from '$lib/types/character';
import type { Effect, Reaction } from '$lib/types/ability';
import { framesOf } from '$lib/utils/frames';
import { effectSourcesAtConstellation } from '$lib/utils/effectCollection';
import type { SimContext } from './context';
import type { CharState } from './charState';
import {
	DEFAULT_ASCENSION,
	evalCondition,
	reactionMatchesTrigger,
	type ConditionContext
} from './conditions';
import { getChainIndexMap } from './cooldowns';
import { onHitTriggerMatches, type HitEvent } from './hits';
import { resolveActiveAbility } from './resolve';
import { holderStatesAt } from './states';
import { stackReadView } from './stacks';

export type CooldownReduceEffect = Extract<Effect, { type: 'cooldownReduce' }>;

/** One authored `cooldownReduce`, resolved once per parse to its holder. */
export type CooldownReduceListener = {
	holder: CharacterData;
	holderCons: number;
	effect: CooldownReduceEffect;
	/** `${nodeId}#${effectIndex}` — the proc-cooldown and proc-cap key. */
	key: string;
	/** The skill ability this effect is hosted ON, when it is one. ⚓ Such an
	 *  effect reduces ITS HOST and nothing else: Varka's Secret Rite lives on
	 *  Four Winds' Ascension, and in a party with no Pyro/Hydro/Electro/Cryo
	 *  member — where Four Winds never resolves — gcsim still reduces
	 *  `ActionSpecialSkill` (a queue nobody reads) and leaves Windbound
	 *  Execution alone. Resolving "the active skill" there would have moved
	 *  the base skill's clock instead; measured, `Lauma E > Varka E N5 N5 N5`
	 *  took 6s off Windbound Execution before this field existed. */
	hostSkillId?: string;
};

/**
 * Every `cooldownReduce` the team authors at its constellations, grouped per
 * holder. Computed once per parse into `TeamContext.cooldownReduces`; empty for
 * most teams, which is what keeps every dispatch site below free of cost.
 */
export function collectCooldownReduces(
	teamChars: CharacterData[],
	constellationByHolder: ReadonlyMap<string, number>
): Map<string, CooldownReduceListener[]> {
	const out = new Map<string, CooldownReduceListener[]>();
	for (const holder of teamChars) {
		const holderCons = constellationByHolder.get(holder.id) ?? 0;
		const list: CooldownReduceListener[] = [];
		for (const src of effectSourcesAtConstellation(holder, holderCons)) {
			const effects = src.effects ?? [];
			for (let i = 0; i < effects.length; i++) {
				const fx = effects[i];
				if (fx.type !== 'cooldownReduce') continue;
				list.push({
					holder,
					holderCons,
					effect: fx,
					key: `${src.id}#${i}`,
					hostSkillId: src.abilityType === 'skill' ? src.id : undefined
				});
			}
		}
		if (list.length > 0) out.set(holder.id, list);
	}
	return out;
}

// ---------------------------------------------------------------------------
// The mover
// ---------------------------------------------------------------------------

/**
 * Shorten a running cooldown by `amountF` frames as of `at`. Returns the frames
 * actually removed (0 when nothing was running).
 *
 * `kind: 'burst'` moves `cs.qReadyAt` and the latest burst cast's tail.
 * `kind: 'skill'` moves the earliest recharging charge of `abilityId`'s queue,
 * every charge chained behind it, and each one's cast tail. A cast is matched to
 * its slot by VALUE — the same identification the stance-end site uses, because
 * a multi-charge sort may have moved a slot off the front — and chained slots
 * never share a value.
 */
export function reduceCooldown(
	ctx: SimContext,
	receiverId: string,
	kind: 'skill' | 'burst',
	abilityId: string | undefined,
	amountF: number,
	at: number
): number {
	if (amountF <= 0) return 0;
	const casts = ctx.castsByChar.get(receiverId) ?? [];
	if (kind === 'burst') {
		const hcs = ctx.getCharState(receiverId);
		if (!isFinite(hcs.qReadyAt) || hcs.qReadyAt <= at) return 0;
		const removed = Math.min(amountF, hcs.qReadyAt - at);
		const stale = hcs.qReadyAt;
		hcs.qReadyAt -= removed;
		for (let i = casts.length - 1; i >= 0; i--) {
			const ev = casts[i];
			if (ev.ability !== 'burst') continue;
			if (ev.readyAt === stale) {
				ev.readyAt -= removed;
				ev.cdReduced = (ev.cdReduced ?? 0) + removed;
			}
			break;
		}
		return removed;
	}
	if (abilityId === undefined) return 0;
	const queue = ctx.eChargeQueues.get(abilityId);
	if (!queue) return 0;
	// queue is sorted ascending; the first slot still in the future is the
	// charge recharging NOW, and everything after it is chained behind it.
	const head = queue.findIndex((r) => r > at);
	if (head === -1) return 0;
	const removed = Math.min(amountF, queue[head] - at);
	for (let i = head; i < queue.length; i++) {
		const stale = queue[i];
		queue[i] = stale - removed;
		for (const ev of casts) {
			if (ev.abilityId === abilityId && ev.readyAt === stale) {
				ev.readyAt -= removed;
				ev.cdReduced = (ev.cdReduced ?? 0) + removed;
			}
		}
	}
	queue.sort((a, b) => a - b);
	return removed;
}

// ---------------------------------------------------------------------------
// The gates shared by the three dispatchers
// ---------------------------------------------------------------------------

/** `procCooldown` then `procCap`, in that order — a capped fire that the
 *  cooldown refuses must not spend a count. Both are RESERVED here (the fire is
 *  committed) because a `cooldownReduce` has no further reason to abstain once
 *  its trigger, conditions and gates all agree. */
function gatesAllow(hcs: CharState, l: CooldownReduceListener, at: number): boolean {
	const pc = l.effect.procCooldown;
	const pcF = typeof pc === 'number' ? framesOf(pc) : 0;
	if (pcF > 0) {
		const last = hcs.cooldownReduceLastFire.get(l.key) ?? -Infinity;
		if (at - last < pcF) return false;
	}
	const cap = l.effect.procCap;
	if (cap !== undefined) {
		// `per: 'stance'` — the count lives on the holder's LIVE stance record,
		// so a fresh stance is a fresh count. No live stance means no window
		// to count in: refuse rather than count against nothing (lint keeps
		// this shape under an `inStance` condition, so it should not arise).
		const st = hcs.stance;
		if (st === undefined || st.start > at || st.end <= at) return false;
		const used = st.procCounts.get(l.key) ?? 0;
		if (used >= cap.count) return false;
		st.procCounts.set(l.key, used + 1);
	}
	if (pcF > 0) hcs.cooldownReduceLastFire.set(l.key, at);
	return true;
}

function holderContext(ctx: SimContext, holderId: string): ConditionContext {
	return {
		teamFactionCounts: ctx.team.teamFactionCounts,
		teamEnabledReactions: ctx.team.teamEnabledReactions,
		teamElementCounts: ctx.team.teamElementCountsByHolder.get(holderId)
	};
}

function receiversOf(ctx: SimContext, l: CooldownReduceListener): CharacterData[] {
	const targets = Array.isArray(l.effect.target) ? l.effect.target : [l.effect.target];
	const out: CharacterData[] = [];
	for (const c of ctx.team.teamChars) {
		const isSelf = c.id === l.holder.id;
		if (targets.includes('self') && isSelf) out.push(c);
		else if (targets.includes('team')) out.push(c);
		else if (targets.includes('teamExcludingSelf') && !isSelf) out.push(c);
	}
	return out;
}

/** Fire one listener at `at`: resolve each receiver's reduced ability and move
 *  it. The skill is whichever skill ability is ACTIVE for the receiver at `at`
 *  (see the header). */
function fire(ctx: SimContext, l: CooldownReduceListener, at: number): void {
	const amountF = framesOf(l.effect.amount);
	const kind =
		l.effect.reduces ?? (l.effect.trigger.type === 'onCast' ? l.effect.trigger.ability : undefined);
	if (kind === undefined) return;
	for (const receiver of receiversOf(ctx, l)) {
		if (kind === 'burst') {
			reduceCooldown(ctx, receiver.id, 'burst', undefined, amountF, at);
			continue;
		}
		// Hosted on a skill: that skill, never another (see the listener type).
		if (l.hostSkillId !== undefined && receiver.id === l.holder.id) {
			reduceCooldown(ctx, receiver.id, 'skill', l.hostSkillId, amountF, at);
			continue;
		}
		const rcs = ctx.getCharState(receiver.id);
		const active = resolveActiveAbility(
			receiver,
			'skill',
			holderStatesAt(ctx, receiver, at),
			ctx.team.constellationByHolder.get(receiver.id) ?? 0,
			getChainIndexMap(ctx, receiver.id, at),
			stackReadView(rcs, null),
			holderContext(ctx, receiver.id)
		);
		if (!active) continue;
		reduceCooldown(ctx, receiver.id, 'skill', active.id, amountF, at);
	}
}

/** Conditions, with the holder's live states and its stacks — the segment pool
 *  when the holder is the one on field and the caller has it in hand, the
 *  rotation-scoped keys always. */
function conditionsHold(
	ctx: SimContext,
	l: CooldownReduceListener,
	at: number,
	segStacks: ReadonlyMap<string, number> | undefined
): boolean {
	const hcs = ctx.getCharState(l.holder.id);
	const stacks = stackReadView(hcs, segStacks ? new Map(segStacks) : null);
	return (
		evalCondition(
			l.effect.conditions,
			DEFAULT_ASCENSION,
			holderStatesAt(ctx, l.holder, at),
			l.holderCons,
			getChainIndexMap(ctx, l.holder.id, at),
			stacks,
			holderContext(ctx, l.holder.id)
		) === true
	);
}

// ---------------------------------------------------------------------------
// The three dispatchers
// ---------------------------------------------------------------------------

/** A hit the opponent took — every character-delivered hit (`run.ts`
 *  `dispatchHit`). ⚠️ Not the summon-tick stream: a tick-triggered reduction
 *  (Alhaitham C1's mirrors) has no author yet, and the tick pass hands no
 *  segment pool. Wire it there when one does. */
export function dispatchCooldownReduceOnHit(ctx: SimContext, hit: HitEvent): void {
	if (ctx.team.cooldownReduces.size === 0) return;
	for (const listeners of ctx.team.cooldownReduces.values()) {
		for (const l of listeners) {
			if (l.effect.trigger.type !== 'onHit') continue;
			if (!onHitTriggerMatches(l.effect.trigger, hit, l.holder.id)) continue;
			const isSelf = l.holder.id === hit.characterId;
			if (!conditionsHold(ctx, l, hit.time, isSelf ? hit.stacks : undefined)) continue;
			if (!gatesAllow(ctx.getCharState(l.holder.id), l, hit.time)) continue;
			fire(ctx, l, hit.time);
		}
	}
}

/** The holder's own cast, after its cooldown was written (`run.ts`
 *  `handleCast`). Only the caster's listeners: an `onCast` trigger has no
 *  `source` and names the holder's own ability. */
export function dispatchCooldownReduceOnCast(
	ctx: SimContext,
	casterId: string,
	kind: 'skill' | 'burst',
	input: string,
	at: number,
	segStacks: ReadonlyMap<string, number> | undefined
): void {
	const listeners = ctx.team.cooldownReduces.get(casterId);
	if (!listeners) return;
	for (const l of listeners) {
		const trig = l.effect.trigger;
		if (trig.type !== 'onCast') continue;
		if (trig.ability !== undefined && trig.ability !== kind) continue;
		if (trig.input !== undefined && !trig.input.includes(input)) continue;
		if (!conditionsHold(ctx, l, at, segStacks)) continue;
		if (!gatesAllow(ctx.getCharState(casterId), l, at)) continue;
		fire(ctx, l, at);
	}
}

/** A reaction somebody caused (`aura.ts` `emitReaction`). `trigger.source`
 *  scopes it the way the stack dispatcher does: `self` hears only the holder's
 *  own reactions, `team` everyone's, `others` everyone's but the holder's. */
export function dispatchCooldownReduceOnReaction(
	ctx: SimContext,
	triggerCharId: string,
	reaction: Reaction,
	at: number,
	triggerStacks: ReadonlyMap<string, number> | undefined
): void {
	if (ctx.team.cooldownReduces.size === 0) return;
	for (const listeners of ctx.team.cooldownReduces.values()) {
		for (const l of listeners) {
			const trig = l.effect.trigger;
			if (trig.type !== 'onReaction') continue;
			const srcMode = trig.source ?? 'self';
			const isSelf = l.holder.id === triggerCharId;
			if (srcMode === 'self' && !isSelf) continue;
			if (!reactionMatchesTrigger(reaction, trig.reaction)) continue;
			if (!conditionsHold(ctx, l, at, isSelf ? triggerStacks : undefined)) continue;
			if (!gatesAllow(ctx.getCharState(l.holder.id), l, at)) continue;
			fire(ctx, l, at);
		}
	}
}
