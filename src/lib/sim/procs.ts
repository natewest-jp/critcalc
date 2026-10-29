/**
 * src/lib/sim/procs.ts
 *
 * ⚓⚓ OFF-FIELD DAMAGE PROCS — every source of elemental application that is
 * neither a cast's own hit, nor a swing, nor a fixed-cadence summon tick.
 *
 * Three triggers land here, and they are one shape seen from three sides: a
 * `damage` effect carrying its own `application[]`, armed for a window, fired by
 * something OTHER than its holder's own action.
 *
 *   `onReaction`             somebody caused a reaction    (mark-triggered round,
 *                                                           2026-08-17)
 *   `onHit`                  the opponent took damage      (coordinated-attack
 *                                                           round, 2026-08-18)
 *   `whileNormalAttacking`   the ACTIVE character is       (coordinated-attack
 *                            inside a normal-attack string  round, 2026-08-18)
 *
 * ⚓ ONE REGISTRY, ONE ARMING PATH, ON PURPOSE. This module was `reactionProcs.ts`
 * and held only the first. The arming key, the entity-not-object rule, the
 * carried-forward cooldown and the cooldown floor are IDENTICAL for all three —
 * only the SELECTION predicate differs — and a second copy of that bookkeeping is
 * exactly how the `findCastSummons`/`findSummonsForBar` pair drifted. The three
 * `take*` functions below are the only thing that knows one trigger from another.
 *
 * ⚓ SCHEDULED ON THE CLOCK, NOT EMITTED INSIDE THE GAUGE'S STEP, and that is a
 * ruling rather than the cheap option. L5 states that the gauge needs no wake-up
 * task BECAUSE its only internal applicator is the Burning chain, whose Pyro
 * provably cannot react — and warns that an internal applicator which CAN react
 * makes the wake-up required. That warning does not fire here: a proc is not
 * internal to the gauge. Every `kind: 'reaction'` event comes out of
 * `applyElement`, reached from `apply()` (an EXTERNAL application, at
 * `offer.time`); EC ticks emit `ecTick`, not `reaction`. So a dispatched
 * reaction's time is the offering task's own instant, and scheduling at
 * `time + frame` is an ordinary future task on a clock standing exactly at
 * `time`. ⛔ Never clamp. ↻ 2026-10-20, the one exception: a Burning tick's
 * BURGEON (`hitCore`, `internal`), which reaches us through the core wake-up in
 * `aura.ts` one frame after its tick (a gauge task at F fires as the gauge
 * LEAVES F) — so a zero-frame proc off it is clamped by that one frame.
 *
 * ⚠️ The feedback IS real, and it now runs through two loops rather than one: a
 * proc's own application can cause a reaction that re-fires the proc, and a
 * proc's own DAMAGE is itself damage the opponent took. `procCooldown` is the
 * brake; `MIN_REPROC_F` is the backstop for an author who writes none; and
 * ⚓⚓ A LISTENER NEVER FIRES OFF ITS OWN OUTPUT (`DamageEvent.procKey`), which is
 * both Raiden's stated rule and what bounds the chain at one fire per cooldown.
 */

import type {
	Effect,
	ElementalApplication,
	Reaction,
	ScaledValue,
	Summon,
	Trigger
} from '$lib/types/ability';
import { framesOf } from '$lib/utils/frames';
import {
	DEFAULT_ASCENSION,
	evalCondition,
	mentionsPolestarField,
	reactionMatchesTrigger,
	type ChainIndex
} from './conditions';
import { polestarFieldOpenAt } from './fields';
import type { SimContext } from './context';
import { onHitTriggerMatches, type HitEvent } from './hits';

/** The three trigger kinds this module arms. ⚓ ONE list, read by the acceptance
 *  rule below AND by characterLint, so a curator can never author an effect the
 *  lint accepts and the sim ignores. */
export const PROC_TRIGGERS = ['onReaction', 'onHit', 'whileNormalAttacking'] as const;
export type ProcTriggerType = (typeof PROC_TRIGGERS)[number];

/** A `damage` effect that reaches the aura on one of the three proc triggers. */
export type ProcEffect = Extract<Effect, { type: 'damage' }> & {
	trigger: Extract<Trigger, { type: ProcTriggerType }>;
	application: ElementalApplication[];
};

/** Narrowed view of a listener whose trigger is known. */
export type ReactionProcEffect = ProcEffect & {
	trigger: Extract<Trigger, { type: 'onReaction' }>;
};

/**
 * ⚓ A FLOOR, NOT A COOLDOWN. Two procs of one listener can never share a frame,
 * so a listener whose author wrote no `procCooldown` cannot drive an unbounded
 * same-instant chain through a reaction its own application caused. ⛔ It is not
 * a stand-in for a real ICD and must never be tuned to approximate one — every
 * authored proc states its own.
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
export type ProcListener = {
	/** `holder::host::index` — the listener's identity. ⚓ Also what a proc's own
	 *  damage carries, so a listener can refuse to hear itself. */
	key: string;
	holderId: string;
	effect: ProcEffect;
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
	/**
	 * The summon-window key this proc's landings are drawn on, when it IS the
	 * summon's own attack — `characterId::label::source::spawnAt`, the key
	 * `computeSummonSubrows` builds.
	 *
	 * ⚓ Set for `onHit` and `whileNormalAttacking` only, and that asymmetry is a
	 * judgement rather than an oversight: Albedo's Transient Blossom, Dehya's
	 * Fiery Sanctum strike, Raiden's Eye strike and Xingqiu's sword wave ARE the
	 * summon hitting, so a marker on its lane says something true. Fischl's A4
	 * and Nahida's Tri-Karma are the holder's own passive, armed by an entity
	 * because that is where the window lives — drawing those on Oz's lane would
	 * claim Oz hit. ⛔ Don't unify by adding markers to the reaction procs.
	 */
	tickKey?: string;
};

/**
 * ⚓ THE ONE ACCEPTANCE RULE — which authored effects are procs. Every arming
 * site and characterLint go through it, so a curator can never author an effect
 * the lint accepts and the sim ignores.
 *
 * ⚠️ A definitively-false condition drops the effect; an UNRESOLVABLE one arms
 * it, matching every other optimistic gate in the parser.
 */
export function procEffects(
	effects: Effect[] | undefined,
	constellation: number,
	preStates: ReadonlySet<string>
): { effect: ProcEffect; index: number }[] {
	const out: { effect: ProcEffect; index: number }[] = [];
	(effects ?? []).forEach((eff, index) => {
		if (eff.type !== 'damage') return;
		if (!(PROC_TRIGGERS as readonly string[]).includes(eff.trigger.type)) return;
		if (!eff.application || eff.application.length === 0) return;
		if (evalCondition(eff.conditions, DEFAULT_ASCENSION, preStates, constellation) === false)
			return;
		out.push({ effect: eff as ProcEffect, index });
	});
	return out;
}

/** ⚓ Kept under its old name because characterLint and the round docs both
 *  reference it. Reaction procs are the subset whose trigger is `onReaction`. */
export function reactionProcEffects(
	effects: Effect[] | undefined,
	constellation: number,
	preStates: ReadonlySet<string>
): { effect: ReactionProcEffect; index: number }[] {
	return procEffects(effects, constellation, preStates).filter(
		(e): e is { effect: ReactionProcEffect; index: number } =>
			e.effect.trigger.type === 'onReaction'
	);
}

/**
 * Arm ONE listener.
 *
 * ⚓⚓ KEYED BY THE ENTITY, NOT BY THE AUTHORED OBJECT, and that is the whole
 * correctness of the cooldown. Fischl's A4 is authored TWICE — once on the
 * skill's Oz and once on the burst's Oz — because either cast can be the one
 * that put Oz on the field. In game there is only ever ONE Oz and ONE 0.5 s ICD,
 * so two records would hand the burst's Oz a fresh clock the instant it replaced
 * the skill's: measured, that fired A4 twice **0.38 s apart**. The key is
 * `holder::host::index` — the identity `ctx.summonChainGen` already uses — so the
 * two authored copies ARE one listener, while two different procs on one host
 * stay separate (the Furina lesson L5e's `icdKey` records).
 *
 * ⚠️ A re-arm therefore REPLACES the record and CARRIES `lastFire` FORWARD: the
 * burst's Oz inherits the skill's Oz's cooldown, and re-casting Nahida's E
 * refreshes the Seed's 25 s without refunding the 2.5 s interval.
 */
function armOne(ctx: SimContext, key: string, listener: Omit<ProcListener, 'lastFire'>): void {
	ctx.procs.set(key, {
		...listener,
		lastFire: ctx.procs.get(key)?.lastFire ?? -Infinity
	});
}

/**
 * Arm the ability-hosted listeners of one cast — armed for `trigger.armedFor`
 * seconds from the cast. ⚓ The MARK's lifetime, not the ability's: Nahida's Seed
 * of Skandha runs 25 s on the enemy while her E is an instant cast, and Beidou's
 * Stormbreaker listens for 15 s after a burst that is over in half a second.
 *
 * ⚠️ An effect with no `armedFor` would listen for the rest of the rotation, so
 * it is skipped here and reported by characterLint (B.12c / B.13b) rather than
 * silently armed forever. ⛔ `whileNormalAttacking` has no ability-hosted form at
 * all (B.13c) — all four authors are summon-hosted, and a wave with no host is a
 * lane with nothing to draw on.
 */
export function armCastProcs(args: {
	ctx: SimContext;
	holderId: string;
	/** The resolved ability's id — the host half of the listener key. */
	abilityId: string;
	effects: Effect[] | undefined;
	castTime: number;
	preStates: ReadonlySet<string>;
	constellation: number;
	chainIdx: ChainIndex;
	stacks?: Map<string, number>;
	castKind: 'skill' | 'burst';
}): void {
	for (const { effect, index } of procEffects(args.effects, args.constellation, args.preStates)) {
		if (effect.trigger.type === 'whileNormalAttacking') continue;
		const armedFor = effect.trigger.armedFor;
		if (armedFor === undefined || !(armedFor > 0)) continue;
		const end = args.castTime + framesOf(armedFor);
		armOne(args.ctx, `${args.holderId}::cast:${args.abilityId}::${index}`, {
			key: `${args.holderId}::cast:${args.abilityId}::${index}`,
			holderId: args.holderId,
			effect,
			start: args.castTime,
			endNow: () => end,
			isCurrent: () => true,
			preStates: args.preStates,
			constellation: args.constellation,
			chainIdx: args.chainIdx,
			stacks: args.stacks,
			castKind: args.castKind
		});
	}
}

/** Arm a summon's listeners. ⚓ Each borrows the tick chain's own `endNow` and
 *  generation check, so a swap-out, a duration extension or a recast reaches it
 *  through the one answer the ticks already use — and the host key is the
 *  summon's LABEL, so Fischl's two authored Ozes are one entity. */
export function armSummonProcs(args: {
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
	/** `characterId::label::source::spawnAt` — where a summon-attack proc draws
	 *  its markers. See `ProcListener.tickKey`. */
	tickKey: string;
}): void {
	for (const { effect, index } of procEffects(
		args.summon.effects,
		args.constellation,
		args.preStates
	)) {
		const key = `${args.holderId}::summon:${args.summon.label}::${index}`;
		armOne(args.ctx, key, {
			key,
			holderId: args.holderId,
			effect,
			start: args.spawnAt,
			endNow: args.endNow,
			isCurrent: args.isCurrent,
			preStates: args.preStates,
			constellation: args.constellation,
			chainIdx: args.chainIdx,
			stacks: args.stacks,
			castKind: args.castKind,
			tickKey: effect.trigger.type === 'onReaction' ? undefined : args.tickKey
		});
	}
}

/** Who caused the reaction — as much of it as the source filter needs. */
export type ReactionSource = {
	characterId: string;
	/** The application was delivered by something the character LEFT or TRIGGERED
	 *  (a summon tick, a reaction proc) rather than by their own cast or swing. */
	viaEntity: boolean;
};

/**
 * One hit the opponent took — the stream `onHit` procs listen to.
 *
 * ⚓ IT IS THE SAME RECORD `dispatchHit` ALREADY BUILDS, deliberately: `onHit`'s
 * `abilityType` / `damageType` / `filter` / `source` vocabulary is the one a
 * curator already writes and `onHitTriggerMatches` already answers, and a second
 * hit shape would need its own copy of that gate. ⛔ It does NOT go through
 * `dispatchHit`, which mutates live stack state in PARSE order — a summon tick or
 * a proc landing cannot be interleaved there (the L5e finalize-time rule).
 */
export type DamageEvent = HitEvent & {
	/** The listener that produced this damage, when a proc did. ⚓ The one field
	 *  that makes "never off its own output" expressible. */
	procKey?: string;
};

/** ⚠️ A `ScaledValue` `procCooldown` is the weapon-refinement form and has no
 *  meaning on a character effect; the corpus has none, and reading a non-numeric
 *  one as "no cooldown" leaves `MIN_REPROC_F` in charge rather than throwing. */
const procCooldownFrames = (v: number | ScaledValue | undefined): number =>
	typeof v === 'number' ? framesOf(v) : 0;

/** Armed, current, and inside its window at `time`. */
function isLive(l: ProcListener, time: number): boolean {
	return l.isCurrent() && time >= l.start && time < l.endNow();
}

/** Spend the cooldown at `time`, or refuse. ⚠️ MUTATES `lastFire`, and that is
 *  the point: the cooldown is spent at the TRIGGER instant, not at the (later)
 *  landing frame — the same "decided here, offered later" split
 *  `emitReactionsAtCast` uses. */
function takeCooldown(l: ProcListener, time: number): boolean {
	const cd = Math.max(procCooldownFrames(l.effect.procCooldown), MIN_REPROC_F);
	if (time - l.lastFire < cd) return false;
	l.lastFire = time;
	return true;
}

/**
 * Every `onReaction` listener that fires for this reaction, in arming order —
 * the SELECTION half, so the scheduling half stays three lines.
 */
export function takeReactionProcs(
	ctx: SimContext,
	src: ReactionSource,
	reaction: Reaction,
	time: number
): ProcListener[] {
	const fired: ProcListener[] = [];
	for (const l of ctx.procs.values()) {
		const trig = l.effect.trigger;
		if (trig.type !== 'onReaction') continue;
		if (!isLive(l, time)) continue;
		if (!reactionMatchesTrigger(reaction, trig.reaction)) continue;
		const source = trig.source ?? 'self';
		if (source === 'self' && src.characterId !== l.holderId) continue;
		// ⚓ 'active' is NOT "'team' narrowed by id". An entity-delivered
		// application carries its OWNER's id, so an id test alone would count Oz's
		// reactions as Fischl's whenever Fischl is on field — which is gcsim's
		// defect, not the game's rule.
		if (source === 'active' && (src.viaEntity || src.characterId !== ctx.activeCharId)) continue;
		if (!takeCooldown(l, time)) continue;
		fired.push(l);
	}
	return fired;
}

/**
 * Every `onHit` damage proc that fires for one hit the opponent took.
 *
 * ⚓⚓ THE STREAM IS EVERY DAMAGE-DEALING HIT, NOT THE ACTIVE CHARACTER'S SWINGS
 * (⚓ Nate, 2026-08-18). Raiden's Eye of Stormy Judgment fires on any damage the
 * opponent takes, summon damage included — its real condition is that the
 * opponent TOOK DMG, so a fully-shielded enemy does not proc it, and we do not
 * model a shielded enemy. Beidou is the narrow case and says so in her own
 * trigger (`abilityType: ['normal','charged']`), not in this rule.
 *
 * ⚓ A LISTENER NEVER FIRES OFF ITS OWN OUTPUT. gcsim states it for Raiden —
 * `raiden/skill.go` skips an `ElementalArt`+`Slash` hit from her own index, which
 * is precisely the Eye's own strike — and it is also what bounds the feedback
 * loop at one fire per cooldown. ⚠️ gcsim lets Albedo's and Dehya's fields hear
 * THEMSELVES and therefore self-sustain with no player input; we do not. See
 * docs/rounds/coordinated-attacks-round.md §5.
 */
export function takeHitProcs(ctx: SimContext, dmg: DamageEvent, time: number): ProcListener[] {
	const fired: ProcListener[] = [];
	for (const l of ctx.procs.values()) {
		const trig = l.effect.trigger;
		if (trig.type !== 'onHit') continue;
		if (!isLive(l, time)) continue;
		if (dmg.procKey === l.key) continue;
		// ⚓ A SUMMON SPAWNED AT THE HIT'S OWN INSTANT WAS SPAWNED BY IT (cast
		// hit-record round, 2026-09-21). Albedo's E lands at 25f and the Isotoma
		// spawns at 25f — gcsim queues the attack BEFORE it creates the construct,
		// and gives Dehya's field a one-frame ICD "so field cannot proc from
		// initial attack". Unreachable while a cast's hit fired at the press; the
		// tie only exists now that the hit lands where the summon appears.
		if (l.tickKey !== undefined && time <= l.start) continue;
		if (!onHitTriggerMatches(trig, dmg, l.holderId)) continue;
		// ⚓ A proc gated on the Polestar Field is asked at the OFFER instant
		// (Radiance-window round, 2026-09-19) — arming is optimistic about the
		// leaf (no instant exists at arm time), so this is where it is decided.
		// ⚠️ BEFORE the cooldown: a hit the field refuses must not spend it.
		if (
			mentionsPolestarField(l.effect.conditions) &&
			evalCondition(
				l.effect.conditions,
				DEFAULT_ASCENSION,
				l.preStates,
				l.constellation,
				undefined,
				undefined,
				{
					inPolestarField: polestarFieldOpenAt(ctx.stellarConductTimes, time)
				}
			) === false
		)
			continue;
		if (!takeCooldown(l, time)) continue;
		fired.push(l);
	}
	return fired;
}

/**
 * ⚓⚓ THE WAVE. Every `whileNormalAttacking` listener's fire instants inside one
 * normal-attack span `[start, end)`, in arming order.
 *
 * ⚓ A SPAN, NOT A CHAIN OF TASKS, and that is what makes it match gcsim's watcher
 * without a second liveness mechanism. `internal/template/minazuki` hooks the
 * ANIMATION STATE: entering `NormalAttackState` fires a wave if the holder's ICD
 * has elapsed, and a ticker then re-fires every `tickerFreq` frames for as long as
 * the state holds. Because `interval` and that ICD are the same 60 frames for all
 * four authors, the two rules collapse into ONE: fire every `interval` from the
 * last fire, whenever that instant falls inside a span.
 *
 * ⚓ Our normal-attack span is the swing: `[swing start, swing end)`, handed in by
 * `run.ts` one swing at a time. Consecutive swings abut, so an `N5` is one
 * continuous state exactly as it is in game, and `lastFire` carries across the
 * whole string — ⛔ there is nothing to reset at a token boundary.
 *
 * ⚠️ ONE MEASURED DIVERGENCE, and ours is the one the kit text states. In gcsim a
 * state ENTRY that lands on the ICD returns without starting the ticker at all, so
 * a normal string begun 0.5 s after the last wave produces NO waves for its whole
 * length; ours fires at `lastFire + interval` inside that string. Xingqiu's own
 * source comment calls the cadence "approximately 1 second between waves", which
 * is what this does.
 *
 * ⚠️ Charged attacks and plunges are NOT this state (gcsim's `ChargeAttackState`
 * is its own), so `run.ts` notifies from the normal-swing site only.
 */
export function takeWaveFires(
	ctx: SimContext,
	spanStart: number,
	spanEnd: number
): { listener: ProcListener; times: number[] }[] {
	const out: { listener: ProcListener; times: number[] }[] = [];
	if (!(spanEnd > spanStart)) return out;
	for (const l of ctx.procs.values()) {
		const trig = l.effect.trigger;
		if (trig.type !== 'whileNormalAttacking') continue;
		if (!l.isCurrent()) continue;
		const interval = framesOf(trig.interval);
		if (!(interval > 0)) continue;
		const times: number[] = [];
		// ⚠️ The first candidate is the span's own start on a fresh entry, and the
		// carried cooldown otherwise — never `spanStart + interval`, or a wave
		// would never fire on the first swing of a rotation.
		// ⚠️ `-Infinity + interval` is still `-Infinity`, so an un-fired listener
		// falls through to the span's own start — a wave DOES fire on the first
		// swing of a rotation, which is what a state entry means.
		let t = Math.max(spanStart, l.start, l.lastFire + interval);
		const end = Math.min(spanEnd, l.endNow());
		while (t < end) {
			l.lastFire = t;
			times.push(t);
			t += interval;
		}
		if (times.length > 0) out.push({ listener: l, times });
	}
	return out;
}
