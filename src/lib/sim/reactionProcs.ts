/**
 * src/lib/sim/reactionProcs.ts
 *
 * ⚓⚓ THE FOURTH SOURCE OF ELEMENTAL APPLICATIONS (mark-triggered round,
 * 2026-08-17) — damage emitted by an OFF-FIELD character because somebody else
 * caused a reaction, gated by a proc cooldown.
 *
 * The gauge is fed from a cast's own `application[]`, an N/C/P swing and a
 * summon tick series. Nahida's Tri-Karma Purification and Fischl's A4 are NONE
 * of those: not a summon (Nahida's Seed of Skandha is a state on the ENEMY), not
 * a cast's own hit, not a swing — which is why no field fitted them, and why
 * they were the largest attributed bucket of applications gcsim makes and we did
 * not.
 *
 * ⚓ SCHEDULED ON THE CLOCK, NOT EMITTED INSIDE THE GAUGE'S STEP, and that is a
 * ruling rather than the cheap option. L5 states that the gauge needs no wake-up
 * task BECAUSE its only internal applicator is the Burning chain, whose Pyro
 * provably cannot react — and warns that an internal applicator which CAN react
 * makes the wake-up required. That warning does not fire here: a proc is not
 * internal to the gauge. Every `kind: 'reaction'` event comes out of
 * `applyElement`, reached either from `apply()` (an EXTERNAL application, at
 * `offer.time`) or from `burningTick` (whose `appIndex` is null and is skipped);
 * EC ticks emit `ecTick`, not `reaction`. So a dispatched reaction's time is
 * always the offering task's own instant, and scheduling at `time + frame` is an
 * ordinary future task on a clock standing exactly at `time`. ⛔ Never clamp, and
 * never reach for a wake-up.
 *
 * ⚠️ The feedback IS real: a proc's own application can cause a reaction that
 * re-fires the proc. `procCooldown` is the brake (2.5 s for Tri-Karma, 0.5 s for
 * A4); `MIN_REPROC_F` is the backstop for an author who writes none.
 */

import type {
	Effect,
	ElementalApplication,
	Reaction,
	ScaledValue,
	Summon
} from '$lib/types/ability';
import { framesOf } from '$lib/utils/frames';
import {
	DEFAULT_ASCENSION,
	evalCondition,
	reactionMatchesTrigger,
	type ChainIndex
} from './conditions';
import type { SimContext } from './context';

/** A `damage` effect that reaches the aura on an `onReaction` trigger. */
export type ReactionProcEffect = Extract<Effect, { type: 'damage' }> & {
	trigger: Extract<Effect['trigger'], { type: 'onReaction' }>;
	application: ElementalApplication[];
};

/**
 * ⚓ A FLOOR, NOT A COOLDOWN. Two procs of one listener can never share a frame,
 * so a listener whose author wrote no `procCooldown` cannot drive an unbounded
 * same-instant chain through a reaction its own application caused. ⛔ It is not
 * a stand-in for a real ICD and must never be tuned to approximate one — both
 * authored procs state their own.
 */
const MIN_REPROC_F = 1;

/**
 * One armed listener.
 *
 * ⚠️ `endNow` is a CLOSURE and is recomputed at every query — the L5e law. A
 * summon-hosted listener is handed the tick chain's own end computation, so
 * there is still exactly one summon geometry (`summonEndAt`) with a second
 * reader, rather than the parallel live registry L5e §2 refused.
 */
export type ReactionProcListener = {
	holderId: string;
	effect: ReactionProcEffect;
	/** Frames. The arming instant — a cast, or a summon's spawn. */
	start: number;
	/** The arming window's end AS OF NOW. ⛔ Never cache the result. */
	endNow: () => number;
	/** `false` once a recast has superseded the host summon. Always true for an
	 *  ability-hosted listener, whose re-arm REPLACES the record instead. */
	isCurrent: () => boolean;
	/** Frames; `-Infinity` until the first proc. ⚠️ Carried across a re-arm — a
	 *  recast does not refund the trigger interval, in game or in gcsim (the ICD
	 *  status lives on the CHARACTER, not on the mark). */
	lastFire: number;
	/** The dispatch context, captured at the arming instant (L5c: a context is a
	 *  moment, not a per-field choice). */
	preStates: ReadonlySet<string>;
	constellation: number;
	chainIdx: ChainIndex;
	stacks?: Map<string, number>;
	/** The host's cast kind — what this proc's applications and reaction events
	 *  are attributed to. */
	castKind: 'skill' | 'burst';
};

/**
 * ⚓ THE ONE ACCEPTANCE RULE — which authored effects are reaction procs. Both
 * arming sites and characterLint go through it, so a curator can never author an
 * effect the lint accepts and the sim ignores.
 *
 * ⚠️ A definitively-false condition drops the effect; an UNRESOLVABLE one arms
 * it, matching every other optimistic gate in the parser.
 */
export function reactionProcEffects(
	effects: Effect[] | undefined,
	constellation: number,
	preStates: ReadonlySet<string>
): ReactionProcEffect[] {
	const out: ReactionProcEffect[] = [];
	for (const eff of effects ?? []) {
		if (eff.type !== 'damage') continue;
		if (eff.trigger.type !== 'onReaction') continue;
		if (!eff.application || eff.application.length === 0) continue;
		if (evalCondition(eff.conditions, DEFAULT_ASCENSION, preStates, constellation) === false)
			continue;
		out.push(eff as ReactionProcEffect);
	}
	return out;
}

type ArmArgs = {
	ctx: SimContext;
	holderId: string;
	effects: Effect[] | undefined;
	start: number;
	endNow: () => number;
	isCurrent?: () => boolean;
	preStates: ReadonlySet<string>;
	constellation: number;
	chainIdx: ChainIndex;
	stacks?: Map<string, number>;
	castKind: 'skill' | 'burst';
};

/**
 * Arm every reaction-proc effect in `effects` for this holder.
 *
 * ⚓ KEYED BY THE AUTHORED EFFECT OBJECT. Effects are stable references off the
 * loaded character JSON, so identity is exact and free — the same reason
 * `effectCollection`'s faction provenance is a `WeakMap`. It also gets Fischl
 * right for nothing: his skill's Oz and his burst's Oz are two authored objects,
 * so each keeps its own record and the generation stamp decides which one is
 * live. ⛔ A synthesised string key would have collapsed them into one.
 *
 * ⚠️ A re-arm REPLACES the record and carries `lastFire` forward: re-casting
 * Nahida's E refreshes the Seed's 25 s but does not refund the 2.5 s interval.
 */
function armReactionProcs(args: ArmArgs): void {
	const { ctx, holderId, effects, preStates, constellation } = args;
	for (const eff of reactionProcEffects(effects, constellation, preStates)) {
		ctx.reactionProcs.set(eff, {
			holderId,
			effect: eff,
			start: args.start,
			endNow: args.endNow,
			isCurrent: args.isCurrent ?? (() => true),
			lastFire: ctx.reactionProcs.get(eff)?.lastFire ?? -Infinity,
			preStates,
			constellation,
			chainIdx: args.chainIdx,
			stacks: args.stacks,
			castKind: args.castKind
		});
	}
}

/**
 * Arm the ability-hosted listeners of one cast — armed for `trigger.armedFor`
 * seconds from the cast. ⚓ The MARK's lifetime, not the ability's: Nahida's Seed
 * of Skandha runs 25 s on the enemy while her E is an instant cast.
 *
 * ⚠️ An effect with no `armedFor` would listen for the rest of the rotation, so
 * it is skipped here and reported by characterLint (B.12c) rather than silently
 * armed forever.
 */
export function armCastReactionProcs(args: {
	ctx: SimContext;
	holderId: string;
	effects: Effect[] | undefined;
	castTime: number;
	preStates: ReadonlySet<string>;
	constellation: number;
	chainIdx: ChainIndex;
	stacks?: Map<string, number>;
	castKind: 'skill' | 'burst';
}): void {
	for (const eff of reactionProcEffects(args.effects, args.constellation, args.preStates)) {
		const armedFor = eff.trigger.armedFor;
		if (armedFor === undefined || !(armedFor > 0)) continue;
		const end = args.castTime + framesOf(armedFor);
		armReactionProcs({
			ctx: args.ctx,
			holderId: args.holderId,
			effects: [eff],
			start: args.castTime,
			endNow: () => end,
			preStates: args.preStates,
			constellation: args.constellation,
			chainIdx: args.chainIdx,
			stacks: args.stacks,
			castKind: args.castKind
		});
	}
}

/** Arm a summon's listeners. ⚓ It borrows the tick chain's own `endNow` and
 *  generation check, so a swap-out, a duration extension or a recast reaches it
 *  through the one answer the ticks already use. */
export function armSummonReactionProcs(args: {
	ctx: SimContext;
	holderId: string;
	summon: Summon;
	spawnAt: number;
	endNow: () => number;
	isCurrent: () => boolean;
	preStates: ReadonlySet<string>;
	constellation: number;
	chainIdx: ChainIndex;
	stacks?: Map<string, number>;
	castKind: 'skill' | 'burst';
}): void {
	armReactionProcs({
		ctx: args.ctx,
		holderId: args.holderId,
		effects: args.summon.effects,
		start: args.spawnAt,
		endNow: args.endNow,
		isCurrent: args.isCurrent,
		preStates: args.preStates,
		constellation: args.constellation,
		chainIdx: args.chainIdx,
		stacks: args.stacks,
		castKind: args.castKind
	});
}

/** Who caused the reaction — as much of it as the source filter needs. */
export type ReactionSource = {
	characterId: string;
	/** The application was delivered by something the character LEFT or TRIGGERED
	 *  (a summon tick, a reaction proc) rather than by their own cast or swing. */
	viaEntity: boolean;
};

/** ⚠️ A `ScaledValue` `procCooldown` is the weapon-refinement form and has no
 *  meaning on a character effect; the corpus has none, and reading a non-numeric
 *  one as "no cooldown" leaves `MIN_REPROC_F` in charge rather than throwing. */
const procCooldownFrames = (v: number | ScaledValue | undefined): number =>
	typeof v === 'number' ? framesOf(v) : 0;

/**
 * Every listener that fires for this reaction, in arming order — the SELECTION
 * half, so the scheduling half stays three lines.
 *
 * ⚠️ It MUTATES `lastFire` on what it returns, and that is the point: the
 * cooldown is spent at the TRIGGER instant, not at the (later) landing frame —
 * the same "decided here, offered later" split `emitReactionsAtCast` uses.
 */
export function takeReactionProcs(
	ctx: SimContext,
	src: ReactionSource,
	reaction: Reaction,
	time: number
): ReactionProcListener[] {
	const fired: ReactionProcListener[] = [];
	for (const l of ctx.reactionProcs.values()) {
		if (!l.isCurrent()) continue;
		if (time < l.start || time >= l.endNow()) continue;
		const trig = l.effect.trigger;
		if (!reactionMatchesTrigger(reaction, trig.reaction)) continue;
		const source = trig.source ?? 'self';
		if (source === 'self' && src.characterId !== l.holderId) continue;
		// ⚓ 'active' is NOT "'team' narrowed by id". An entity-delivered
		// application carries its OWNER's id, so an id test alone would count Oz's
		// reactions as Fischl's whenever Fischl is on field — which is gcsim's
		// defect, not the game's rule.
		if (source === 'active' && (src.viaEntity || src.characterId !== ctx.activeCharId)) continue;
		const cd = Math.max(procCooldownFrames(l.effect.procCooldown), MIN_REPROC_F);
		if (time - l.lastFire < cd) continue;
		l.lastFire = time;
		fired.push(l);
	}
	return fired;
}
