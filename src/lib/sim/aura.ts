/**
 * src/lib/sim/aura.ts
 *
 * ⚓⚓ THE SEAM, CROSSED (gauge round L5c, 2026-08-16). This module used to hold
 * the COARSE aura model — `AuraState` was a `Set` of flags, applications never
 * decayed, Anemo and Geo never consumed, and a reaction was decided by a lookup
 * table. It is gone. `ctx.aura` is now a live `Gauge` (`$lib/utils/gauge.ts`)
 * running the real KQM/gcsim gauge model, and this file is the WIRING: it offers
 * applications to the gauge and turns what comes back into IR reaction events
 * and effect dispatch.
 *
 * What the coarse model cost, measured (L0 baseline / gauge-round.md §1):
 *
 *   melt at t=120.95 s off a Cryo aura that was gone by t≈13
 *   14 pyroSwirls from one Xiangling E where the game gives ~2
 *   a VV RES-shred bar that never ended
 *   every Geo cast crystallizing (there was no 1 s GCD)
 *
 * ⚓ N/C/P SWINGS APPLY TOO (ICD round, 2026-08-15), AND ONLY THEY ARE GATED
 * ACROSS CASTS. A cast's own hits are gated within the cast (L4d), because
 * `application[]` retired the "one application per skill" premise; ⛔ across
 * casts they are not, because 112 of 166 gcsim skills are `ICDTagNone`. See
 * `resolveActionIcd` for the census and docs/library/game/icd.md for the model.
 *
 * ⚠️ Reaction emission FEEDS BACK into scheduling (gauge-round.md §2, F2): each
 * emitted reaction dispatches duration extensions, which move a stance's end,
 * which ability resolution then reads. ⛔ This is not a pure output and never was
 * — which is why the gauge is driven LIVE from the parse rather than run over a
 * finished application list at finalize.
 */

import type {
	Effect,
	Element,
	ElementalApplication,
	IcdWindow,
	Reaction,
	Summon
} from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import type { IcdClock, IcdParams } from '$lib/utils/icd';
import {
	createIcdClock,
	icdApplies,
	icdParamsFor,
	icdTagFor,
	resolveActionIcd,
	STANDARD_ICD_FRAMES
} from '$lib/utils/icd';
import {
	findSummonsForBar,
	summonEndAt,
	summonOwnerIsStance,
	summonSpawnAt,
	summonTickSeries,
	tickCapOf,
	type SummonTickSeries
} from './summons';
import type { NormalActionKind } from '$lib/utils/actionElement';
import type { ReactionEvent } from '$lib/utils/rotationEvents';
import { createGauge, type ElementId, type Gauge, type SeriesInterval } from '$lib/utils/gauge';
import { framesOf } from '$lib/utils/frames';
import type { SimContext } from './context';
import type { StanceRecord } from './charState';
import { nightsoulSpend } from './nightsoul';
import { Band, type Clock } from './clock';
import {
	DEFAULT_ASCENSION,
	evalCondition,
	matchVariant,
	mentionsPolestarField,
	resolveElementRef,
	type ChainIndex,
	type ConditionContext
} from './conditions';
import { polestarFieldOpenAt } from './fields';
import { moondriftStandsAt } from './gadgets';
import { lockedAt, lockOf, schedulePolls } from './absorb';
import { dispatchOnReactionExtensions } from './extensions';
import {
	applyRotationLifetimeExpiry,
	dispatchConsumeStacksOnHit,
	dispatchGainStacksOnHit,
	dispatchGainStacksOnReaction,
	dispatchStacksOnSummonTick,
	rotationStackSnapshot
} from './stacks';
import { dispatchCooldownReduceOnReaction } from './cooldownReduce';
import { closeStateWindows, holderStatesAt, openSummonState } from './states';
import { checkStackThresholds, scheduleAccrualFires } from './thresholds';
import type { HitEvent } from './hits';
import { getChainIndexMap } from './cooldowns';
import { convertReaction, toReactions } from './reactionBridge';
import {
	armSummonProcs,
	takeHitProcs,
	takeReactionProcs,
	takeWaveFires,
	type DamageEvent,
	type ProcListener
} from './procs';

/**
 * One elemental application the rotation put on the target.
 *
 * ⚓ THE THING THE IR COULD NEVER SAY. An application that reacts with nothing
 * leaves no `reaction` event, so it was invisible — and the L0 oracle had to
 * REPLAY the parser's own rules over the IR to reconstruct the stream it was
 * diffing. That is how the oracle came to describe a model we no longer had for
 * one commit (L4d). The sim knows; it says so.
 */
export type AuraApplication = {
	/** Frames. */
	time: number;
	characterId: string;
	element: Element;
	/** Gauge units, pre-tax. `1` when the ability does not author one. */
	units: number;
	castKind: ReactionEvent['castKind'];
	/**
	 * This application's gauge strength is a stand-in for data an author could
	 * supply — the aura lane marks it `--ui-provisional`.
	 *
	 * (See `viaEntity` on `Offer` for the other axis the sim tracks — WHO
	 * delivered the hit. It is deliberately not published here: it exists for one
	 * source filter, not for a consumer of the IR.)
	 *
	 * ↻ NARROWED 2026-08-17 (⚓ Nate). It used to be true for every defaulted
	 * value, which meant it fired on swings and summon ticks too — and those are
	 * ~75% of a typical rotation's applications, so the strip read as almost
	 * entirely uncertain and the mark pointed at no work anybody could do.
	 *
	 * ⚓ THE LINE IS "COULD SOMEONE MEASURE THIS?", not "did we default it":
	 *   · a cast with no `application[]` at all, or an entry with no `units` →
	 *     TRUE. The corpus could carry the number and does not.
	 *   · a normal/charged/plunge swing, or a summon tick → FALSE. No per-swing
	 *     or per-tick units exist anywhere, in our data or gcsim's, and gcsim's
	 *     own hits are overwhelmingly 25 durability. 1U is the RULE there, and an
	 *     exception would be recorded in the wikis and in gcsim (⚓ Nate).
	 */
	provisionalUnits: boolean;
};

/** An application plus the dispatch context captured where it was decided.
 *
 *  ⚠️ For a cast that context is captured at the CAST and the aura it meets is
 *  live at the LAND — deliberate, and what L4d's note already described.
 *
 *  ↻ The STACK snapshot moved to match (L5c). It used to be taken inside the
 *  scheduled closure, i.e. at the land instant, while states/constellation/chain
 *  index were all cast-time — so one of the four disagreed with the other three
 *  and with the sentence describing them. ⚓ A context is a moment, not a
 *  per-field choice. */
type Offer = AuraApplication & {
	preStates: ReadonlySet<string>;
	constellation: number;
	chainIdx: ChainIndex;
	stacks?: Map<string, number>;
	/**
	 * ⚓ WHO DELIVERED THE HIT (mark-triggered round, 2026-08-17). `true` when the
	 * application came from something the character LEFT or TRIGGERED — a summon
	 * tick or a reaction proc — rather than from their own cast or swing.
	 *
	 * ⚠️⚠️ Its one reader is `onReaction`'s `source: 'active'`, and without it
	 * that filter is unimplementable: a summon tick carries its OWNER's
	 * `characterId`, so "the active character triggered this reaction" would be
	 * true of Oz's ticks whenever Fischl is on field. That is exactly gcsim's
	 * `ActorIndex` defect — every Thundering Retribution in the oracle fires 4
	 * frames after an Oz application — and the game does not work that way.
	 */
	viaEntity?: true;
};

export type AuraState = {
	gauge: Gauge;
	/**
	 * Every application offered, in offer order. ⚓ The index IS the gauge's
	 * `appIndex`, and that is the whole attribution mechanism: a reaction comes
	 * back carrying the index of the application that caused it, which names the
	 * character whose `onReaction` effects fire.
	 */
	offers: Offer[];
};

/** `lunar`: which Lunar conversions the TEAM arms (`teamEnabledReactions`).
 *  ⚓ They change the gauge, not only the reaction's name — Lunar-Charged
 *  drains on its own clock and Lunar-Crystallize skips the cooldown — so the
 *  gauge must know before the first application, not learn it at dispatch. */
export function createAuraState(
	lunar: { charged: boolean; crystallize: boolean } = { charged: false, crystallize: false }
): AuraState {
	// ⚠️ No `maxFrames`: a cap belongs to an instrument charting hand-placed
	// applications, and a rotation must never be silently truncated mid-parse.
	//
	// ⚓⚓ SAMPLING IS ON SINCE L6, AND THE LANE MUST READ THIS GAUGE — ⛔ never a
	// re-run of `simulateGauge` over `ParsedRotation.applications`. ⚠️ The reason
	// is NOT that the list is mis-ordered — the feed is in true time order since
	// 2026-08-17 and `collectApplications` no longer sorts. It is that a re-run is
	// a SECOND COPY of the truth, and this round has already paid for one (L4d,
	// where the oracle replayed the parser's rules and reported a baseline for an
	// engine we no longer had). A replay also cannot see the gauge's internal
	// chain (Burning fuel, EC ticks, core spawns), so it would chart a model the
	// parse did not run. The series the lane draws is the one the gauge produced.
	//
	// ⚠️ Cost, measured: sampling roughly doubles the gauge's per-frame work
	// (0.081 → 0.182 ms over a 1U aura's whole lifetime). It cannot reach the
	// idle time C6 exists to bound — `advanceTo`'s idle skip runs BEFORE
	// `stepFrame`, so no sample is taken for a frame nothing happens in, and
	// continuous work stays bounded by aura lifetime rather than rotation
	// length. Heavy fixture (311 s, 230 applications) parses in 4.8 ms.
	return {
		gauge: createGauge({
			sampling: true,
			lunarCharged: lunar.charged,
			lunarCrystallize: lunar.crystallize
		}),
		offers: []
	};
}

/**
 * ⚓ A DENDRO CORE'S LIFE, TAKEN FROM THE GAUGE RATHER THAN DERIVED FROM IT
 * (Polestar-Field round, 2026-09-01).
 *
 * The gauge has spawned and expired cores since L5b and the parse discarded
 * every one of them — `offerApplication` drained the event queue looking for
 * reactions and dropped the rest. Half of a core's life IS derivable (a Bloom
 * marker plus `CORE_SPAWN_DELAY` plus `CORE_LIFETIME`), which is exactly why
 * deriving it would be a trap: the other half — a Hyperbloom eating the core at
 * 2s, a sixth Bloom popping the oldest — is not, and a strip that kept drawing a
 * core the rotation already spent would lie in the one place the reader is
 * looking.
 *
 * ⚠️ Frames on the way in: `SimEvent.time` is SECONDS, like everything the
 * gauge says.
 */
function recordGadgetEvent(
	ctx: SimContext,
	e:
		| { kind: 'coreSpawn'; time: number; id: number; expiry: number }
		| { kind: 'coreEnd'; time: number; id: number; reason: 'consumed' | 'popped' }
): void {
	if (e.kind === 'coreSpawn') {
		ctx.gadgetRecs.push({
			kind: 'core',
			id: e.id,
			start: framesOf(e.time),
			nominalEnd: framesOf(e.expiry)
		});
		return;
	}
	// ⚠️ A linear scan, deliberately: cores are capped at 5 live and a rotation
	// makes a handful, so an index would be bookkeeping nobody reads.
	const rec = ctx.gadgetRecs.find((g) => g.kind === 'core' && g.id === e.id && g.end === undefined);
	if (!rec) return;
	rec.end = framesOf(e.time);
	rec.endReason = e.reason;
}

/**
 * Offer one application to the gauge at its own instant, then dispatch whatever
 * came back.
 *
 * ⚓⚓ THE GAUGE IS CAUGHT UP LAZILY AND HAS NO WAKE-UP TASK, WHICH IS A RULING
 * RATHER THAN AN OVERSIGHT. `Band.TICK` was reserved at L3 for "gauge decay
 * (L5)", and the obvious move is to schedule a clock task at the gauge's next
 * internal instant. It buys nothing: the gauge's only internal applicator is the
 * Burning chain, and a Burning tick's Pyro provably cannot react (see
 * `SimEvent.appIndex`) — so no internal instant has a consequence to DISPATCH,
 * and advancing to the next application's frame produces exactly the same state.
 * ⛔ A task whose only job is to check back later is the one way to reintroduce
 * the cost the jumping clock exists to avoid (L3 §4.2).
 *
 * ⚠️ If the gauge ever grows an internal event that emits a reaction, this rule
 * inverts and the wake-up becomes REQUIRED — the reaction would otherwise be
 * noticed at the next application and dispatched late.
 */
function offerApplication(ctx: SimContext, clock: Clock, offer: Offer): void {
	const { gauge, offers } = ctx.aura;
	gauge.advanceTo(offer.time);
	const index = offers.length;
	offers.push(offer);
	gauge.apply(offer.element as ElementId, offer.units, index);

	for (const e of gauge.takeEvents()) {
		if (e.kind === 'coreSpawn' || e.kind === 'coreEnd') {
			recordGadgetEvent(ctx, e);
			continue;
		}
		// ⚓ A LUNAR-CHARGED TICK REFRESHES AN ACCRUAL (exact-model round,
		// 2026-09-18): gcsim's Gravity hook is on any Lunar-tagged damage, and an
		// EC tick under a Lunar-Charged enabler is one. The gauge emits the tick
		// at its own instant and surfaces it here, at the next application —
		// retroactively, which `accrual.ts`'s monotone settle is built to take.
		// Only accrual grants hear it (a plain count would gain per tick).
		if (e.kind === 'ecTick') {
			if (ctx.team.stackThresholds.size === 0) continue;
			const at = framesOf(e.time);
			for (const r of convertReaction('electroCharged', ctx.team)) {
				dispatchGainStacksOnReaction(
					ctx.team.teamChars,
					'',
					r,
					at,
					(holder) => holderStatesAt(ctx, holder, at),
					ctx.team.constellationByHolder,
					ctx.getCharState,
					true
				);
			}
			scheduleAccrualFires(ctx, clock, at);
			continue;
		}
		if (e.kind !== 'reaction') continue;
		// ⚓ Unreachable by construction — the only internal applicator is the
		// Burning chain, and nothing that reacts with Pyro can coexist with a
		// Burning aura (pinned in gauge.test.ts). Stated rather than assumed:
		// such a reaction has no character to dispatch against, so guessing one
		// would be worse than skipping it.
		if (e.appIndex === null) continue;
		const src = offers[e.appIndex];
		if (!src) continue;
		const time = framesOf(e.time);
		for (const r of toReactions(e, ctx.team)) emitReaction(ctx, clock, src, r, time);
	}
}

/** One reaction: the three dispatch paths, then the IR event. ⚠️ Order matters —
 *  the dispatches are what feed F2 (a reaction moves a stance's end). */
function emitReaction(
	ctx: SimContext,
	clock: Clock,
	src: Offer,
	reaction: Reaction,
	time: number
): void {
	if (reaction === 'stellarConduct' || reaction === 'lunarCrystallize') {
		// Ascending by construction (feed order is time order); the guard keeps
		// `polestarFieldOpenAt`'s binary search honest if that ever slips, and
		// `moondriftStandsAt` reads its list as ascending too.
		const times =
			reaction === 'stellarConduct' ? ctx.stellarConductTimes : ctx.lunarCrystallizeTimes;
		if (times.length === 0 || times[times.length - 1] <= time) times.push(time);
		else
			times.splice(
				times.findIndex((t) => t > time),
				0,
				time
			);
	}
	dispatchOnReactionExtensions(
		ctx,
		src.characterId,
		reaction,
		time,
		src.preStates,
		src.constellation,
		src.chainIdx,
		src.stacks
	);
	dispatchGainStacksOnReaction(
		ctx.team.teamChars,
		src.characterId,
		reaction,
		time,
		(holder) => holderStatesAt(ctx, holder, time),
		new Map(ctx.team.teamChars.map((c) => [c.id, ctx.constellationLevels?.[c.id] ?? 0])),
		ctx.getCharState
	);
	// An `onReaction` cooldownReduce (Dori A1) — beside the stack dispatcher,
	// with the same source scoping.
	dispatchCooldownReduceOnReaction(ctx, src.characterId, reaction, time, src.stacks);
	scheduleReactionProcs(ctx, clock, src, reaction, time);
	ctx.events.push({
		kind: 'reaction',
		id: ctx.nextId(),
		characterId: src.characterId,
		reaction,
		time,
		castKind: src.castKind,
		...(src.viaEntity === true ? { viaEntity: true as const } : {})
	});
	// A reaction is one of the four places a stack count moves, so a threshold
	// is asked here — AFTER the reaction event, so the fire's record follows its
	// cause in the stream. No segment pool is in hand mid-apply (a segment-home
	// key is read at the cast and hit sites; see `thresholds.ts`). An accruing
	// key's fire is then (re)predicted from the status this reaction opened.
	checkStackThresholds(ctx, clock, time, null);
	scheduleAccrualFires(ctx, clock, time);
}

/**
 * ⚓⚓ THE FOURTH APPLICATION SOURCE, dispatched. A `damage` effect carrying an
 * `application[]` lands its hits on the clock at `time + frame`.
 *
 * ⚓ ONE FIRING HALF FOR ALL THREE PROC TRIGGERS (coordinated-attack round,
 * 2026-08-18) — a reaction proc (Nahida's Tri-Karma, Fischl's A4), a damage proc
 * (Raiden's Eye, Albedo's blossom) and a wave (Xingqiu's rain swords) differ only
 * in what SELECTED them; what they then do is identical. `procs.ts` owns the
 * three selections, this owns the one dispatch.
 *
 * ⚓ SCHEDULED, never offered here. A reaction is dispatched from inside
 * `offerApplication`'s own `takeEvents` loop, i.e. mid-`apply`, and offering a
 * second application from there would advance the gauge while it is reporting on
 * the first. A `Band.LAND` task at `time + frame` puts it exactly where a cast's
 * own hit goes, ordered against every other application by the one clock.
 * ⚠️ `time` IS `clock.now` for every caller, so a zero-frame delay queues at this
 * instant and runs after the current task rather than clamping.
 *
 * ⚠️ The listener's cooldown is spent in the `take*` call, at the TRIGGER instant
 * — not when the hit lands. That is the same split a cast uses, and it is what
 * makes the trigger interval mean what gcsim's status timer means.
 *
 * ⚓ THE PROC'S OWN DAMAGE RE-ENTERS THE DAMAGE STREAM, once, at its earliest
 * landing frame — a Transient Blossom procs a Raiden Eye, and gcsim agrees. It
 * carries the listener's key so that listener refuses to hear itself
 * (`takeHitProcs`), which is Raiden's own stated exclusion and the thing that
 * bounds the loop.
 */
function fireProc(ctx: SimContext, clock: Clock, l: ProcListener, time: number): void {
	// ⚓ THE PROC'S OWN ICD, and it is NOT `procCooldown`: the cooldown says how
	// often this proc FIRES, the gate says how often a fire APPLIES. Raiden's Eye
	// fires every 0.9 s and applies every third strike; Dehya's Sanctum fires every
	// 2.5 s and applies every time.
	//
	// ⚠️ The counter is per LISTENER (`l.key`), i.e. per entity, exactly like a
	// summon tick series' — so Fischl's two authored Ozes share one, and two procs
	// on one host keep their own. ⚠️ `null` is not "no ICD" for the reason
	// `resolveActionIcd` gives: an untracked stream must not reset a counter, so the
	// clock is only created inside the gated branch.
	const gate = l.effect.trigger.icdGate;
	const params: IcdParams | null =
		gate === 'none' ? null : gate ? icdParamsFor(gate) : STANDARD_ICD_FRAMES;

	let earliest = Infinity;
	for (const app of l.effect.application) {
		const at = time + app.frame;
		if (at < earliest) earliest = at;
		// ⛔ A physical (element-less) entry applies nothing — the same rule a
		// physical swing follows. ⚠️ It still DEALT damage, which is why the
		// stream notification below is outside this loop, and it spends no counter
		// slot for the same reason a physical swing does not.
		// ⚓ An `ElementRef` resolves here too (2026-09-16), with NO team context —
		// a `ProcListener` captures a moment and does not carry one. No proc
		// authors a ref today (a proc's element is its own, not the party's), and
		// one that did would fall to its `fallback` or to nothing, taking the
		// physical branch above. ⏭ Give the listener a context before authoring
		// the first one, rather than discovering it as silence.
		const element = resolveElementRef(app.element);
		if (!element) continue;
		if (params) {
			let icd = ctx.icdClocks.get(l.key);
			if (!icd) {
				icd = createIcdClock();
				ctx.icdClocks.set(l.key, icd);
			}
			// ⚠️ Gated at the DECISION instant, not at the landing frame — the same
			// split `takeCooldown` uses, and what keeps a multi-entry proc's own
			// hits counting in authored order rather than in scheduling order.
			if (!icdApplies(icd, at, params).applies) continue;
		}
		clock.schedule(at, Band.LAND, () => {
			offerApplication(ctx, clock, {
				time: at,
				characterId: l.holderId,
				element,
				units: app.units ?? DEFAULT_UNITS,
				// ⚓ "Could someone MEASURE this?" — yes: a proc's gauge is one
				// number in gcsim's ICD group table, so an unauthored one is real
				// missing work and says so.
				provisionalUnits: app.units === undefined,
				castKind: l.castKind,
				preStates: l.preStates,
				constellation: l.constellation,
				chainIdx: l.chainIdx,
				stacks: l.stacks,
				// ⚓ A proc is delivered by the MARK or the ENTITY, not by the
				// character — so it can never itself count as "the active character
				// triggered this".
				viaEntity: true
			});
		});
	}
	if (!Number.isFinite(earliest)) return;
	const landing = earliest;
	// ⚓ A marker on the host summon's lane, for the procs that ARE the summon
	// hitting. See `ProcListener.tickKey` for why the reaction procs are not.
	if (l.tickKey !== undefined) {
		const list = ctx.stateGatedTicks.get(l.tickKey);
		if (list) list.push(landing);
		else ctx.stateGatedTicks.set(l.tickKey, [landing]);
	}
	clock.schedule(landing, Band.LAND, () => {
		notifyDamage(ctx, clock, {
			characterId: l.holderId,
			time: landing,
			abilityType: l.castKind,
			element: l.effect.element,
			damageTag: l.castKind,
			abilityName: l.effect.attribution,
			sourceEventId: -1,
			procKey: l.key
		});
	});
}

/** The `onReaction` half — selection, then the shared dispatch. */
function scheduleReactionProcs(
	ctx: SimContext,
	clock: Clock,
	src: Offer,
	reaction: Reaction,
	time: number
): void {
	if (ctx.procs.size === 0) return;
	const fired = takeReactionProcs(
		ctx,
		{ characterId: src.characterId, viaEntity: src.viaEntity === true },
		reaction,
		time
	);
	for (const l of fired) fireProc(ctx, clock, l, time);
}

/**
 * ⚓⚓ ONE HIT THE OPPONENT TOOK, offered to every armed `onHit` damage proc
 * (coordinated-attack round, 2026-08-18).
 *
 * ⚓ Nate settled the stream: Raiden's Eye of Stormy Judgment fires on ANY damage
 * the opponent takes, summon damage included — the condition is that the enemy
 * took DMG, and a shielded enemy (which we do not model) is the only thing that
 * refuses it. So every damage-dealing hit this parse knows about is notified
 * here: a cast's hit, an N/C/P swing, a summon damage tick, a reaction proc's
 * landing and another damage proc's landing.
 *
 * ⛔ THIS IS NOT `dispatchHit`, on purpose. That one mutates live stack state in
 * PARSE order, which is why the finalize-time summon hits feeding `buffWindows`
 * are deliberately kept out of it (L5e). A proc listener holds no stack state, so
 * it can be — and must be — notified at the hit's own clock instant.
 *
 * ↻ For an E/Q cast the record's `time` is the cast's FIRST LANDING since the
 * cast hit-record round (2026-09-21) — it was the cast start, up to a second
 * early on a slow burst, which put a proc's landing AHEAD of the hit that fired
 * it. One answer to "when did this cast hit", and it is the gauge's.
 */
export function notifyDamage(ctx: SimContext, clock: Clock, dmg: DamageEvent): void {
	if (ctx.procs.size === 0) return;
	for (const l of takeHitProcs(ctx, dmg, dmg.time)) fireProc(ctx, clock, l, dmg.time);
}

/**
 * ⚓⚓ ONE NORMAL-ATTACK SWING'S SPAN, offered to every armed wave listener — the
 * coordinated-attack WAVE (Xingqiu Q, Yelan Q, Thoma Q, Fischl C6).
 *
 * ⚠️ CALL IT BEFORE THE CLOCK ADVANCES OVER THE SWING. The fires it schedules land
 * INSIDE `[start, end)`, so they have to be queued while the clock still stands at
 * the swing's start; queued after the advance they would be latecomers, clamped
 * forward and reported. ⚓ That also puts a wave BEFORE the swing's own
 * application, which is right — the swing applies at its END.
 *
 * See `takeWaveFires` for why a span rather than a chain of tasks.
 */
export function notifyNormalAttack(
	ctx: SimContext,
	clock: Clock,
	spanStart: number,
	spanEnd: number
): void {
	if (ctx.procs.size === 0) return;
	for (const { listener, times } of takeWaveFires(ctx, spanStart, spanEnd)) {
		for (const t of times) fireProc(ctx, clock, listener, t);
	}
}

/**
 * ⚓ Default gauge units for an application that does not author them.
 *
 * 688 of the 835 explicit durabilities gcsim carries are 25 — one unit — so a
 * missing value is right far more often than not, and being wrong costs aura
 * DEPTH rather than the reaction happening at all. ⚠️ It is still a stand-in,
 * flagged as `provisionalUnits` so L6 can draw the bar `--ui-provisional`.
 */
const DEFAULT_UNITS = 1;

/** The ctx key of a NAMED counter (`icdCounter`) — ⚓ one namespace, so a cast
 *  and a swing naming the same counter meet on one clock. */
const namedIcdKey = (charId: string, name: string): string => `${charId}:counter:${name}`;

/** A NAMED counter's clock, created on first use. */
function namedIcdClock(ctx: SimContext, charId: string, name: string): IcdClock {
	const key = namedIcdKey(charId, name);
	let icd = ctx.icdClocks.get(key);
	if (!icd) {
		icd = createIcdClock();
		ctx.icdClocks.set(key, icd);
	}
	return icd;
}

/**
 * A cast's applications: the absent-list rule, then its own ICD counter.
 *
 * ⚓⚓ THE ONE PLACE BOTH RULES LIVE. `scripts/audit-gcsim-reactions.mjs` calls this
 * rather than restating it, because the L0 oracle exists to describe our model and a
 * second copy lets it describe a model we no longer have. It did exactly that for one
 * commit: L4d changed the engine and the oracle reported the baseline UNCHANGED,
 * because it was still replaying "every cast applies the caster's element at cast
 * time". ⛔ Never inline either rule again.
 *
 * ⚓ Gating is PURE here only because the counter is scoped to a single cast — see the
 * census in `resolveActionIcd`. If it ever spans casts it must move back to a
 * scheduled task, where the clock can see the rotation's hits in true time order.
 *
 * ⛔ A physical entry is dropped, not defaulted: absent `element` means the hit applies
 * nothing, and a physical hit spends no aura budget — so it must not consume a counter
 * slot either, which is why the filter runs BEFORE the clock.
 */
export function resolveCastApplications(
	char: CharacterData,
	application: ElementalApplication[] | undefined,
	castKind: 'skill' | 'burst',
	abilityNoICD: boolean | undefined,
	/** The cast's measured non-standard window (`CastAbility.icdGate`), if any —
	 *  translated by `icdParamsFor`, the same as the charged and tick shapes. */
	abilityIcdGate: IcdWindow | undefined,
	/** Team scope for an `ElementRef` entry — Varka's right-hand claymore
	 *  (2026-09-16). ⚠️ Absent resolves a ref to NOTHING, and an entry with no
	 *  element is dropped by the same filter a physical hit takes, which is the
	 *  right silence: an element nobody can name applies nothing. A literal
	 *  entry never reads this. */
	context?: ConditionContext,
	/** A NAMED counter shared across abilities (`icdCounter`): the clock to
	 *  spend and the cast's start, so its entries land on it at their real
	 *  instants. Absent = a fresh per-cast counter, as every cast but Nilou's.
	 *  ⚠️ The entries are fed at CAST time, in order — sound while a sharing
	 *  ability's hits land before the next sharer's (Nilou's do: each step's hit
	 *  precedes the next press). */
	shared?: { clock: IcdClock; castTime: number }
): {
	frame: number;
	element: Element;
	units: number;
	provisionalUnits: boolean;
	whileStance?: { travel: number };
}[] {
	if (!application) {
		// Absent → the pre-L4d model, provisionally. See the amendment note below.
		return char.element
			? [{ frame: 0, element: char.element, units: DEFAULT_UNITS, provisionalUnits: true }]
			: [];
	}
	const elemental = [];
	for (const a of application) {
		const element = resolveElementRef(a.element, context);
		if (element)
			elemental.push({
				frame: a.frame,
				element,
				units: a.units ?? DEFAULT_UNITS,
				provisionalUnits: a.units === undefined,
				noICD: a.noICD === true,
				...(a.whileStance ? { whileStance: a.whileStance } : {})
			});
	}
	const params = resolveActionIcd(castKind, char.weapon, abilityNoICD, abilityIcdGate);
	if (!params) return elemental;
	const clock = shared?.clock ?? createIcdClock();
	const t0 = shared?.castTime ?? 0;
	// ⚓ An entry on NO counter (`ElementalApplication.noICD`) applies and spends
	// no slot — it never reaches the clock, so the cast's other hits count as if
	// it were not there, which is what gcsim's `ICDTagNone` on one hit means.
	return elemental.filter((a) => a.noICD || icdApplies(clock, t0 + a.frame, params).applies);
}

/**
 * A cast's own hits, SCHEDULED at the frames they land (gauge round L4d).
 *
 * ⚓⚓ THIS IS THE FIRST REAL CUSTOMER OF L3's TASK QUEUE. Until L4d the parser
 * applied `char.element` at every E/Q cast, unconditionally, because the corpus
 * recorded when a cast could be CANCELLED and never when it landed — so
 * Xiangling's E applied Pyro at frame zero when in game it applies none at all,
 * and Albedo's burst applied Geo 75 frames before its hitmark. `application[]`
 * says both, and each entry becomes one `Band.LAND` task.
 *
 * ⚓⚓ EMPTY AND ABSENT ARE DIFFERENT, AND THIS IS A DELIBERATE AMENDMENT TO
 * CONTRACT C3 (gauge round L4d).
 *
 *   `[]`        MEASURED to apply nothing — 39 abilities, and the whole point of
 *               the field. Xiangling's E, Xiao's Q, every stance opener.
 *   absent      UNMEASURED. Falls back to the old model — the character's own
 *               element at the cast instant — and is counted as provisional.
 *
 * C3 ruled that an absent list applies nothing, reasoning from gcsim, "where
 * `Durability` is not defaulted anywhere". ⚠️ That conflates two things our corpus
 * can now tell apart: in gcsim an omitted durability means the AUTHOR intended no
 * application; in our corpus an absent list means WE DID NOT MEASURE IT. Treating
 * the second as the first deletes the element from the 12 characters with no gcsim
 * source (Ifa, Iansan, Jahoda, Linnea, Nefer and seven frameless stubs) plus 6 with
 * partial coverage — Linnea's Geo would simply never crystallize.
 *
 * ⚓ Of the two errors, a cast-instant stand-in is much the smaller: the reaction
 * happens, timed a few frames early. Silence is a whole missing mechanic. And C3's
 * real target — "a cast that applies nothing cannot say so" — is fully served,
 * because `[]` now says it. The list is enumerated in
 * `docs/curation/gcsim-frames-diff.md`; L6 marks it `--ui-provisional`.
 *
 * ⚠️ The authored list stays NOMINAL — gcsim emits a damage event for a hit its
 * own ICD suppressed, and we author from that stream (contract C4). The gate is
 * applied HERE, once, at the land instant. ⛔ Never pre-filter the data.
 */
export function emitReactionsAtCast(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	castKind: 'skill' | 'burst',
	castTime: number,
	application: ElementalApplication[] | undefined,
	abilityNoICD: boolean | undefined,
	abilityIcdGate: IcdWindow | undefined,
	preStates: ReadonlySet<string>,
	constellation: number,
	chainIdx: ChainIndex,
	stackState: Map<string, number>,
	/** Team scope, for an `ElementRef` in `application[]`. */
	context?: ConditionContext,
	/** `CastAbility.icdCounter` — the named counter this cast shares. */
	icdCounter?: string,
	/** The stance this cast opened, read LIVE at each `whileStance` hit's launch
	 *  (its `end` moves with extensions, a swap and `endsStance`). */
	stance?: StanceRecord
): void {
	const stacks = stackState.size > 0 ? new Map(stackState) : undefined;
	for (const app of resolveCastApplications(
		char,
		application,
		castKind,
		abilityNoICD,
		abilityIcdGate,
		context,
		icdCounter ? { clock: namedIcdClock(ctx, char.id, icdCounter), castTime } : undefined
	)) {
		const at = castTime + app.frame;
		clock.schedule(at, Band.LAND, () => {
			// ⚓ A stance-bound hit lands only if its stance was still up when it
			// LAUNCHED (Mizuki round, 2026-10-16) — checked here, at the landing,
			// because by now every extension, swap and exit before the launch has
			// settled. Strict: a stance that ended AT the launch frame launched
			// nothing (gcsim's status is inactive at its own expiry frame).
			if (app.whileStance && stance && stance.end <= at - app.whileStance.travel) return;
			offerApplication(ctx, clock, {
				time: at,
				characterId: char.id,
				element: app.element,
				units: app.units,
				provisionalUnits: app.provisionalUnits,
				castKind,
				preStates,
				constellation,
				chainIdx,
				stacks
			});
		});
	}
	// The cast's parser-private hit is built + dispatched by handleCast
	// immediately after this call (onHit wiring 2026-07-17 — the hit needs
	// the resolved ability/variant context this closure doesn't see).
}

/**
 * ⚓ A cast's ABSORBED entries (`application[].element: {type: 'absorbed'}`,
 * absorption round 2026-10-17) — each decided at ITS landing: the cast's lock
 * by then gives its element, and nothing locked means it applies nothing.
 * `resolveCastApplications` drops them as element-less (static readers — the
 * frames audit — see no element), so this is their one landing path.
 *
 * ⚓ ONE per-cast counter of their own, standard unless `noICD`: gcsim gives
 * the twins per-ELEMENT tags (Sayu's `ICDTagElementalArt<El>`), separate from
 * the Anemo hits' counter, and one cast locks one element.
 */
export function emitAbsorbedAtCast(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	castKind: 'skill' | 'burst',
	castTime: number,
	application: ElementalApplication[] | undefined,
	lockKey: string,
	preStates: ReadonlySet<string>,
	constellation: number,
	chainIdx: ChainIndex,
	stackState: Map<string, number>
): void {
	const stacks = stackState.size > 0 ? new Map(stackState) : undefined;
	const icd = createIcdClock();
	for (const a of application ?? []) {
		if (!(typeof a.element === 'object' && a.element.type === 'absorbed')) continue;
		const at = castTime + a.frame;
		const units = a.units ?? DEFAULT_UNITS;
		const noICD = a.noICD === true;
		clock.schedule(at, Band.LAND, () => {
			const element = lockedAt(ctx, lockKey, at);
			if (element === undefined) return;
			if (!noICD && !icdApplies(icd, at, STANDARD_ICD_FRAMES).applies) return;
			offerApplication(ctx, clock, {
				time: at,
				characterId: char.id,
				element,
				units,
				provisionalUnits: false,
				castKind,
				preStates,
				constellation,
				chainIdx,
				stacks
			});
		});
	}
}

/** One N/C/P swing offered to the aura, behind its ICD clock (ICD round,
 *  2026-08-15). Called at the swing's LANDING — its hitmark, fired from a
 *  `Band.LAND` task (§1.K, 2026-09-20), or the post-advance cursor when the map
 *  states none — the same instant `dispatchHit` uses, because that is when the
 *  element lands. ⚠️ `time` is handed in; ⛔ never read `clock.now` for it.
 *
 *  ⚠️ A PHYSICAL swing never reaches a clock. `resolveActionElement`
 *  returning `undefined` means the swing applies nothing, and a hit that
 *  applies nothing does not spend an ICD budget — so a physical string
 *  followed by an infusion starts the infused counter fresh, which is the
 *  KQM model. The clock is keyed by (character, tag) and lives at parse
 *  scope beside the aura: a swap-out neither resets nor freezes it.
 *
 *  `null` params are gcsim's `ICDTagNone` — applies always AND touches no
 *  counter, so an untracked source can't reset a counter it shares a tag
 *  with (`resolveActionIcd` carries the case list).
 *
 *  ⚠️ A swing's gauge is 1U, and ⛔ it is NOT flagged provisional (2026-08-17).
 *  No per-swing units are authored anywhere in the corpus and gcsim's own
 *  normals are overwhelmingly 25 durability, so this is the RULE for a swing
 *  rather than a stand-in for a value someone could go and measure. See
 *  `provisionalUnits` for the line the flag now draws. */
export function emitReactionsAtSwing(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	kind: NormalActionKind,
	element: Element | undefined,
	abilityNoICD: boolean | undefined,
	time: number,
	preStates: ReadonlySet<string>,
	constellation: number,
	stackState: Map<string, number>,
	chargedIcdWindow?: IcdWindow,
	/**
	 * ⚓ The SECOND claymore (Varka's two claymores round, 2026-09-16) — a swing
	 * that lands two elements calls this twice, and the second call passes
	 * `'co'` so the two halves count on SEPARATE counters, as gcsim's
	 * `ICDTagVarkaNormalAttackElem` / `…Wind` pair does.
	 *
	 * ⚠️⚠️ The caller must offer the PRIMARY first. Measured against the gauge,
	 * conversion-then-Anemo at one instant swirls and Anemo-then-conversion
	 * produces nothing, because the Anemo hits an empty target and dissipates.
	 * Varka self-enables his own Swirl, so the order is the mechanic.
	 */
	hand?: 'co',
	/** `NormalAbility.icdCounter` — a stance's normals on a NAMED counter shared
	 *  with its casts (Nilou's Sword Dance). Normal swings only; ⛔ never the
	 *  second claymore, which has its own pair. */
	icdCounter?: string
): void {
	if (!element) return;
	const params = resolveActionIcd(kind, char.weapon, abilityNoICD, chargedIcdWindow);
	if (params) {
		// ⚠️ Named `icd`, not `clock` — the rotation `Clock` is a parameter now
		// (the reaction-proc dispatch needs it), and the two must not shadow.
		const key =
			icdCounter && !hand
				? namedIcdKey(char.id, icdCounter)
				: `${char.id}:${icdTagFor(kind)}${hand ? `:${hand}` : ''}`;
		let icd = ctx.icdClocks.get(key);
		if (!icd) {
			icd = createIcdClock();
			ctx.icdClocks.set(key, icd);
		}
		if (!icdApplies(icd, time, params).applies) return;
	}
	offerApplication(ctx, clock, {
		time,
		characterId: char.id,
		element,
		units: DEFAULT_UNITS,
		provisionalUnits: false,
		castKind: kind,
		preStates,
		constellation,
		chainIdx: getChainIndexMap(ctx, char.id, time),
		stacks: stackState.size > 0 ? new Map(stackState) : undefined
	});
}

/**
 * ⚓⚓ SUMMON TICKS APPLY THEIR ELEMENT (gauge round L5e-b) — the RECALL half.
 *
 * Until now a summon ticked on the timeline and applied nothing to the aura, so
 * the things that actually sustain an element in game — Guoba, Oz, Bake-Kurage,
 * the rain swords — contributed no gauge at all. Measured, that was **84 of the
 * 144 applications gcsim makes and we did not**.
 *
 * ⚓⚓ THE CHAIN IS ONE TICK AT A TIME, AND THAT IS THE WHOLE DESIGN. A summon's
 * END is computed at FINALIZE and nowhere else — it needs the post-extension
 * uptime, the owner's next swap-out, and truncation from a recast that has not
 * happened yet. So rather than COPY that geometry into a live registry (the
 * `findCastSummons`/`findSummonsForBar` trap this round already paid for once),
 * each fired tick schedules only the NEXT one and re-asks "am I still alive?" at
 * its own instant.
 *
 * ⚓ Why that is answerable: THE CLOCK IS MONOTONIC. A tick at T fires with
 * everything before T already parsed, and nothing after T can shorten a window
 * that already contains T. So the question is never about the future:
 *
 *   uptime      read LIVE off the extension record (⛔ never a cast-time copy)
 *   swap-out    `ctx.lastSwapOutAt`, written as a segment opens
 *   recast      a generation stamp; a superseded chain simply stops
 *
 * ⚠️ Known cost, documented not silent (L5e §2): an extension that lands AFTER a
 * chain has stopped cannot revive its tail. Corpus extensions arrive while the
 * summon is still up, so this is a simplification we are choosing.
 *
 * ⚠️⚠️ The finalize-time hit synthesis (finalize step 6c) STAYS WHERE IT IS. It
 * feeds `deriveBuffWindows`, and moving it would move `hits` order — the one
 * thing L3 refused to spend. This is a SECOND READER of `summonTickSeries`,
 * ⛔ never a second copy of the walk.
 */
/** The team facts a `summonTick` condition can be gated on — ⚓ the ONE shape,
 *  shared with `finalize`'s marker walk so the two cannot answer differently.
 *  Aino's burst ticks at 0.7s instead of 1.5s under `teamFaction: moonsign >= 2`. */
function tickConditionCtx(
	ctx: SimContext,
	holderId: string
): {
	teamFactionCounts: ReadonlyMap<string, number>;
	teamEnabledReactions: ReadonlySet<string>;
	teamElementCounts: ReadonlyMap<Element, number> | undefined;
} {
	// ⚓ The HOLDER's element counts too (T1 tranche, 2026-09-17). Without them a
	// `teamElementCount` gate on a tick series was unresolvable, and a series
	// abstains only on a definitive false — Xilonen's burst heal (≥ 2 Pyro/Hydro/
	// Cryo/Electro members) drew all 8 ticks in a Geo/Anemo team. Per holder,
	// the same map the parse's cast-time resolution and the buff passes read.
	return {
		teamFactionCounts: ctx.team.teamFactionCounts,
		teamEnabledReactions: ctx.team.teamEnabledReactions,
		teamElementCounts: ctx.team.teamElementCountsByHolder.get(holderId)
	};
}

/**
 * ⚓⚓ A SUMMON TICK REACHES THE STACK MACHINERY (Half A, 2026-08-31) — the fifth
 * and last consumer of the damage a summon deals, after the gauge, the damage
 * procs, the artifact `onHit` branch and (since Half B) the character `onHit`
 * buff pools.
 *
 * ⚓ IT RUNS HERE, ON THE LIVE CHAIN, AND NOT AT FINALIZE. The stack dispatchers
 * mutate state in PARSE order and a later hit reads what an earlier one wrote —
 * so a finalize-time hit cannot be interleaved into a stream that has already
 * been consumed. The live chain has a real parse-order instant (the clock is
 * monotonic: a tick at T fires with everything before T already parsed), which
 * is exactly what `notifyDamage` beside it already exploits.
 *
 * ⚓⚓ THE SEGMENT POOL IS NULL, ON PURPOSE. A tick fires while its owner may be
 * off field, i.e. inside another character's segment, where the owner has no
 * segment stack map at all. Passing null makes a segment-scoped grant a
 * structural no-op instead of a rule someone has to remember — only a
 * `scope: 'rotation'` key, which has a home of its own, can be written from
 * here. ⛔ Never hand this the on-field character's pool.
 *
 * Returns the post-gain, pre-consume snapshot of the OWNER's rotation-scoped
 * stacks — the same convention `dispatchHit` uses, for the same reader.
 */
function dispatchEntityHitStacks(
	ctx: SimContext,
	clock: Clock,
	owner: CharacterData,
	hit: HitEvent
): ReadonlyMap<string, number> | undefined {
	// ⚠️ Expire FIRST. This is the one dispatch site with no settle in front of
	// it, so a mark that timed out mid-burst would otherwise be activated by the
	// next maul.
	for (const holder of ctx.team.teamChars)
		applyRotationLifetimeExpiry(holder, hit.time, ctx.getCharState);
	const getHolderStates = (holder: CharacterData): ReadonlySet<string> =>
		holderStatesAt(ctx, holder, hit.time);
	dispatchGainStacksOnHit(
		ctx.team.teamChars,
		hit,
		getHolderStates,
		ctx.team.constellationByHolder,
		ctx.getCharState,
		null
	);
	const snapshot = rotationStackSnapshot(owner, ctx.getCharState(hit.characterId));
	dispatchConsumeStacksOnHit(
		ctx.team.teamChars,
		hit,
		getHolderStates,
		ctx.team.constellationByHolder,
		ctx.getCharState,
		null,
		(holder, state, at) => closeStateWindows(ctx, ctx.getCharState(holder.id), holder.id, state, at)
	);
	// The tick is the fourth place a count moves (stack-threshold round). Null
	// pool, same rule as the dispatchers above.
	checkStackThresholds(ctx, clock, hit.time, null);
	return snapshot;
}

/**
 * ⚓ A CAST THAT ENDS ITS OWNER'S OTHER SUMMON (summon-ends-on-cast round,
 * 2026-09-19) — `Summon.terminatesOn: 'skill' | 'burst'`. Mavuika's Ring dies
 * the instant she casts her burst; we kept its whole schedule and applied Pyro
 * at 4 / 8 / 12s from an entity the game deleted at 0.3s.
 *
 * Retired by the SAME generation bump a recast uses, so nothing has to cancel a
 * scheduled task and the proc listeners hosted on the summon go with it.
 * ⚠️ Superseded AT THE CAST, where finalize cuts the window — unlike a recast
 * there is no new spawn to wait for. ⛔ Call it BEFORE the cast schedules its
 * own summons, or a burst that re-summons under the same label would retire
 * the chain it is about to start.
 */
export function retireSummonsOnCast(
	ctx: SimContext,
	charId: string,
	kind: 'skill' | 'burst',
	castTime: number
): void {
	const keys = ctx.castTerminatedSummons.get(`${charId}::${kind}`);
	if (!keys || keys.size === 0) return;
	for (const [key, state] of keys) {
		const prior = ctx.summonChainGen.get(key) ?? 0;
		ctx.summonChainGen.set(key, prior + 1);
		ctx.summonChainSupersededAt.set(`${key}#${prior}`, castTime);
		// The summon's own state ends with it — the clamp a stance's early end
		// uses, so it can only shorten (Mavuika's `searingRing`, 2026-10-06).
		if (state !== undefined)
			closeStateWindows(ctx, ctx.getCharState(charId), charId, state, castTime);
	}
	keys.clear();
}

export function scheduleSummonTicks(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	kind: 'skill' | 'burst',
	label: string,
	abilityId: string | undefined,
	/** `CastEvent.variantLabel` — see `findSummonsForBar`. The live chain and
	 *  finalize MUST resolve the same variant or the ticks that fire and the
	 *  markers a reader sees describe two different lineups.
	 *
	 *  ⚓ `undefined` COERCES TO `null` below, which it may not do at
	 *  `findSummonsForBar` in general — it is right here because both callers are
	 *  cast-driven (a cast, or a lineup hand-off), so an absent label always means
	 *  "resolved no variant" and never "I have no cast in hand". */
	variantLabel: string | null | undefined,
	castTime: number,
	summonActivatesAt: number | undefined,
	castEvent: { uptime: number; id?: number },
	extRec: { ownerUptime: number } | undefined,
	preStates: ReadonlySet<string>,
	constellation: number,
	chainIdx: ChainIndex,
	stackState: Map<string, number>,
	/** The cast's own `application[]` (variant's replacing the base's), for a
	 *  series that `sharesCastCounter`. ⚠️ Absent at the lineup hand-off: a
	 *  hand-off lands no cast hit. */
	castApplication?: readonly ElementalApplication[],
	/** ⚓ The SWAP-OUT spawn (`Summon.spawnsAtSwapOutFrom`, Nightsoul round): set,
	 *  this call schedules ONLY such summons, spawned here; absent, the cast's
	 *  own call skips them — the pool calls back at the swap. */
	deferredSpawnAt?: number
): void {
	const cLevel = ctx.constellationLevels?.[char.id] ?? 0;
	const stacks = stackState.size > 0 ? new Map(stackState) : undefined;
	// Resolved once per cast, the same way finalize resolves it for the window.
	const ownerIsStance = summonOwnerIsStance(char, kind, abilityId);
	/** The instants this cast's COUNTED hits land — the ones that spend a slot of
	 *  a counter (an element, and not `noICD`), in time order. */
	const castHitTimes = (castApplication ?? [])
		.filter((e) => e.element !== undefined && !e.noICD)
		.map((e) => castTime + e.frame)
		.sort((a, b) => a - b);

	findSummonsForBar(char, kind, label, abilityId, variantLabel ?? null).forEach((summon, index) => {
		if ((summon.spawnsAtSwapOutFrom !== undefined) !== (deferredSpawnAt !== undefined)) return;
		const spawnAt = deferredSpawnAt ?? summonSpawnAt(castTime, summonActivatesAt, summon, index);
		const key = `${char.id}::${summon.label}`;
		// ⚠️ Bumped ONLY for a recast-terminating summon, mirroring finalize's
		// truncation exactly: one without the flag spawning twice leaves both
		// windows — and therefore both chains — alive.
		if (summon.terminatesOn === 'recast') {
			const prior = ctx.summonChainGen.get(key) ?? 0;
			ctx.summonChainGen.set(key, prior + 1);
			// ⚓ The prior chain lives until THIS spawn, where finalize cuts its window.
			ctx.summonChainSupersededAt.set(`${key}#${prior}`, spawnAt);
		}
		const generation = ctx.summonChainGen.get(key) ?? 0;
		// A summon another cast of its owner ENDS is registered for that cast to
		// find — see `retireSummonsOnCast`.
		if (summon.terminatesOn === 'skill' || summon.terminatesOn === 'burst') {
			const tk = `${char.id}::${summon.terminatesOn}`;
			const set = ctx.castTerminatedSummons.get(tk);
			if (set) set.set(key, summon.opensState);
			else ctx.castTerminatedSummons.set(tk, new Map([[key, summon.opensState]]));
		}

		/** The summon's end AS OF NOW — recomputed at every fire, never cached. */
		const holderCs = ctx.getCharState(char.id);
		const endNow = (): number => Math.min(ownEndNow(), stateEndNow());
		/** ⚓ `endsWithState`: the holder's window of that name, LIVE — the
		 *  Nightsoul pool rewrites its end at every change. A window that has not
		 *  opened by the spawn ends the summon there. */
		const stateEndNow = (): number => {
			if (summon.endsWithState === undefined) return Infinity;
			const end = holderCs.states.get(summon.endsWithState);
			return end !== undefined && end > spawnAt ? end : spawnAt;
		};
		const ownEndNow = (): number =>
			summonEndAt({
				spawnAt,
				// ⚓ LIVE. `durationExtensions` accumulate into the extension
				// record and finalize stamps the cast event only at the end, so
				// `castEvent.uptime` is the PRE-extension value mid-parse and
				// Collei's Cuilein-Anbar would tick short. ⛔ Never snapshot this.
				barUptime: extRec ? extRec.ownerUptime : castEvent.uptime,
				summon,
				index,
				cLevel,
				context: tickConditionCtx(ctx, char.id),
				ownerIsStance,
				// ⚠️ Only a swap-out AFTER this spawn can end this summon; an
				// earlier one belongs to a previous life of the same character.
				swapOutAt: (() => {
					const s = ctx.lastSwapOutAt.get(char.id);
					return s !== undefined && s > spawnAt ? s : Infinity;
				})()
			});

		// ⚓ A summon's OWN STATE (`Summon.opensState`) spans this life exactly.
		// Opened here because this is where the spawn and the end already are —
		// lint guarantees the end is knowable now (no swap end, no extensions);
		// a cast that ends the summon (`terminatesOn: 'skill' | 'burst'`) closes
		// it early through `retireSummonsOnCast`.
		if (summon.opensState !== undefined) {
			openSummonState(
				ctx,
				ctx.getCharState(char.id),
				char.id,
				summon.opensState,
				spawnAt,
				endNow(),
				castEvent.id
			);
		}

		/** Superseded by a recast? ⚓ Shared with the proc listener below so the
		 *  two cannot disagree about which spawn is live. */
		const isCurrent = (): boolean => (ctx.summonChainGen.get(key) ?? 0) === generation;
		/** Still live at `at`? A superseded chain keeps firing until the
		 *  superseding spawn — see `summonChainSupersededAt`. */
		const liveAt = (at: number): boolean =>
			isCurrent() || at < (ctx.summonChainSupersededAt.get(`${key}#${generation}`) ?? -Infinity);

		// ⚓ The summon's own REACTION PROCS (mark-triggered round, 2026-08-17) —
		// Fischl's A4 rides Oz. Armed here, beside the ticks, because this is where
		// the geometry already is: the listener borrows this exact `endNow`/
		// `isCurrent` pair, so a swap-out, a duration extension or a recast reaches
		// it through the one `summonEndAt` instead of a second copy.
		armSummonProcs({
			ctx,
			holderId: char.id,
			summon,
			spawnAt,
			endNow,
			isCurrent,
			preStates,
			constellation,
			chainIdx,
			stacks,
			castKind: kind,
			// ⚠️ THE KEY IS `computeSummonSubrows`'s, character for character —
			// `characterId::label::source::spawnAt`, with `spawnAt` the same integer
			// finalize stamps on the window. Integer frames (C1) are what make that
			// safe; before them this would have been a float-equality join.
			tickKey: `${char.id}::${summon.label}::${kind}::${spawnAt}`
		});

		// ⚓ The summon's absorption lock (`absorbs`) — polled while it lives,
		// keyed like its published marks.
		const absorbKey = `${char.id}::${summon.label}::${kind}::${spawnAt}`;
		if (summon.absorbs)
			schedulePolls(
				ctx,
				clock,
				absorbKey,
				summon.absorbs,
				castTime,
				(at) => liveAt(at) && at < endNow()
			);

		// ⚓⚓ THE SAME CONDITION CONTEXT `finalize` WALKS WITH. A team-gated series
		// (Aino's Ascendant Gleam cadence) resolves to `null` without it, and ⚠️
		// `summonTickSeries` drops only a DEFINITIVE false — so an unresolvable
		// pair does not abstain, it fires BOTH. Measured while writing this: Aino
		// drew 10 markers and applied 12 from two series running at once.
		// ⛔ The markers a reader sees and the hits that fire read one answer.
		for (const series of summonTickSeries(
			summon,
			cLevel,
			(e) => e.type === 'damage',
			tickConditionCtx(ctx, char.id)
		)) {
			const staticElement = (series.effect as Extract<Effect, { type: 'damage' }>).element;
			/** `summonTick.absorbed` — the tick lands in the summon's LOCKED element. */
			const absorbedMode =
				series.effect.trigger.type === 'summonTick' ? series.effect.trigger.absorbed : undefined;
			const tickUnits =
				(series.effect.trigger.type === 'summonTick' ? series.effect.trigger.units : undefined) ??
				DEFAULT_UNITS;
			// ⛔ A physical (element-less) tick applies nothing and must not reach an
			// ICD clock — the same rule a physical swing follows. ↻ It DOES still
			// reach the clock, since the coordinated-attack round: a physical tick
			// deals damage, and damage is what an `onHit` proc listens for. The
			// corpus has none of these today (0 of 50 series) and the branch exists
			// so the damage stream is complete by construction rather than by census.
			// ⚓ Per SERIES, not per summon: Furina's Salon Solitaire carries three
			// and they measure as three different gates.
			// ⚓ THREE CASES, and they are not a scale (ICD-group round b): `'none'`
			// is gcsim's `ICDTagNone` — every tick applies and NO clock is touched;
			// an `IcdWindow` is a MEASURED (timer, period) pair replacing the
			// standard; absent is the standard, which is the measured majority.
			// ⚠️ `null` is not `NO_ICD` here for the same reason it is not in
			// `resolveActionIcd`: an untracked series must not reset a counter, and
			// the clock is only created inside the gated branch.
			const gate =
				series.effect.trigger.type === 'summonTick' ? series.effect.trigger.icdGate : undefined;
			const params: IcdParams | null =
				gate === 'none' ? null : gate ? icdParamsFor(gate) : STANDARD_ICD_FRAMES;
			// ⚓ ONE CLOCK NEVER RUNS TWO WINDOWS (2026-09-19). The key is the summon's
			// LABEL, which is what lets a recast carry its counter over (Fischl's E-Oz
			// and Q-Oz are one gcsim counter) — but a label is also what recast
			// truncation keys on, so two DIFFERENT attacks can come to share one:
			// Emilie's Level 3 Case wears the E Case's label so that it stows it, and
			// the two then alternated a 120f window and the standard one on a single
			// counter. Measured on `Emilie E Q`, the volley's first hit applied
			// nothing because the E Case had ticked 39f earlier; gcsim has them on
			// `ICDTagEmilieLumidouce` and `ICDTagElementalBurst`. The window is the
			// only thing our data knows about a series' gcsim group, so it joins the
			// key: same label AND same window is one counter, anything else is two.
			// ⚓ …unless the series NAMES a counter (`summonTick.icdCounter`), which
			// is two summons on one gcsim tag and group: Alyosha's Field opens the
			// window Tugarin's maul lands in 39f later. Lint D.27i holds the
			// sharers to one window, so the label/window key is not needed there.
			const named =
				series.effect.trigger.type === 'summonTick' ? series.effect.trigger.icdCounter : undefined;
			const icdKey = named
				? namedIcdKey(char.id, named)
				: `${char.id}:summon:${summon.label}:${series.index}:${params ? `${params.timer}/${params.hits}` : 'none'}`;

			// ⚓ THE SECOND READER of the tick cap, and it MUST agree with
			// `collectSummonTicks` — that walk draws the markers a reader counts on
			// the summon lane and this chain feeds the gauge, so a divergence shows
			// a marker that applies nothing or applies off a marker nobody drew.
			// ⛔ Read the rule from `tickCapOf`; never re-derive it here.
			// ⚠️ `fired` is per SERIES per SPAWN, which is what the closure already
			// scopes — a recast builds a new chain and starts its own count, exactly
			// as a recast restarts the walk.
			const cap = tickCapOf(series.effect, cLevel, tickConditionCtx(ctx, char.id));
			let fired = 0;
			// ⚠️ A cap lets the BOUNDARY tick through and no further: the window
			// widens by one interval only when a cap is authored, mirroring
			// `collectSummonTicks`. See the `tickCap` schema note for why gcsim
			// lands that tick and our half-open walk does not.
			// ⚓ Recomputed per call, never cached — `endNow()` is live, because a
			// duration extension or a swap-out can move the end mid-chain.
			// ⚓ A CUT WINDOW HAS NO BOUNDARY TICK (small-fix bundle, 2026-09-17):
			// the widening is for a NATURAL expiry, which gcsim's status-gated chain
			// lands; a swap-out that ended this summon early (`endNow()` below the
			// untruncated end) leaves nothing to land. A recast never reaches here
			// — `liveAt` stops a superseded chain at the superseding spawn. Mirrors
			// `collectSummonTicks`'s `naturalEnd` test; ⛔ the two must agree.
			const untruncatedEnd = (): number =>
				summonEndAt({
					spawnAt,
					barUptime: extRec ? extRec.ownerUptime : castEvent.uptime,
					summon,
					index,
					cLevel,
					context: tickConditionCtx(ctx, char.id),
					ownerIsStance
				});
			const liveUntil = (): number => {
				const end = endNow();
				if (cap === null || end < untruncatedEnd()) return end;
				return end + series.interval;
			};
			const capReached = (): boolean => cap !== null && fired >= cap;
			// ⚓ A tick with TRAVEL (`summonTick.travel`, frames) is bounded by when
			// it was FIRED, not when it lands (⚓ Nate 2026-10-18, gcsim's
			// behaviour): Lynette's box fires a Vivid Shot while `t <= Duration`
			// and the shot lands 15f later, so the last one may land after the box
			// is gone — inclusive, as gcsim's `<=` is. ⛔ A series without it keeps
			// the half-open landing bound: Venti's stream is CUT at the Stormeye's
			// end (ruled, unverified — a Venti log would settle it).
			const travel =
				(series.effect.trigger.type === 'summonTick' ? series.effect.trigger.travel : undefined) ??
				0;
			const inLife = (at: number): boolean =>
				travel > 0 ? at - travel <= liveUntil() : at < liveUntil();
			// ⚓ A series on its cast's own counter (`sharesCastCounter`) is fed the
			// cast's counted hits LAZILY — each one at or before a tick goes through
			// the clock first, so the window the cast hit opens blocks the ticks
			// inside it, in time order whatever the two schedules look like.
			const pendingCastHits =
				params &&
				series.effect.trigger.type === 'summonTick' &&
				series.effect.trigger.sharesCastCounter
					? [...castHitTimes]
					: [];
			const asksField = mentionsPolestarField(series.effect.conditions);
			/** `summonTick.appliesOnly` — offered to the gauge, never a hit. */
			const appliesOnlyTick =
				series.effect.trigger.type === 'summonTick' && series.effect.trigger.appliesOnly === true;

			const fire = (at: number): void => {
				// Superseded by a recast, or the summon is gone. Either way the
				// chain simply ends — ⛔ nothing has to cancel a scheduled task.
				if (!liveAt(at - travel)) return;
				if (!inLife(at)) return;
				if (capReached()) return;
				// ⚓ A series gated on the Polestar Field is asked PER TICK, at the
				// tick's own instant (Radiance-window round) — and a refused tick
				// keeps the chain: gcsim's `skillTicker` skips the ATTACK and
				// re-queues, so the next crystal lands on the ORIGINAL cadence, not 3s
				// after the field closes. ⚠️ `collectSummonTicks` asks the same
				// question of the finished stream — ⛔ the two must agree.
				if (
					asksField &&
					evalCondition(
						series.effect.conditions,
						DEFAULT_ASCENSION,
						new Set(),
						cLevel,
						undefined,
						undefined,
						{
							...tickConditionCtx(ctx, char.id),
							inPolestarField: polestarFieldOpenAt(ctx.stellarConductTimes, at)
						}
					) === false
				) {
					const skipTo = at + series.interval;
					if (inLife(skipTo)) clock.schedule(skipTo, Band.TICK, () => fire(skipTo));
					return;
				}
				// ⚓ An ABSORBED tick lands in the lock's element; a twin before the
				// lock is refused and keeps its cadence, as a field-gated one does.
				const element = absorbedMode ? lockedAt(ctx, absorbKey, at) : staticElement;
				if (absorbedMode && element === undefined) {
					const skipTo = at + series.interval;
					if (inLife(skipTo)) clock.schedule(skipTo, Band.TICK, () => fire(skipTo));
					return;
				}
				fired += 1;

				let applies = element !== undefined;
				if (element !== undefined && params) {
					let icd = ctx.icdClocks.get(icdKey);
					if (!icd) {
						icd = createIcdClock();
						ctx.icdClocks.set(icdKey, icd);
					}
					while (pendingCastHits.length > 0 && pendingCastHits[0] <= at)
						icdApplies(icd, pendingCastHits.shift()!, params);
					applies = icdApplies(icd, at, params).applies;
				}
				if (applies && element !== undefined) {
					offerApplication(ctx, clock, {
						time: at,
						characterId: char.id,
						element,
						// ⚠️ No per-tick units are authored anywhere in the corpus and
						// gcsim's summon hits are overwhelmingly 25 durability — so 1U is
						// the RULE for a tick, ⛔ not a stand-in, and it is not flagged.
						// ⚓ Nate 2026-08-17: an exception would be recorded in the wikis
						// and in gcsim, and none is.
						// ↻ …and the one exception IS recorded in gcsim: the Anemo
						// Traveler's absorbed burst twin is Durability 50 (`units`).
						units: tickUnits,
						provisionalUnits: false,
						castKind: kind,
						preStates,
						constellation,
						chainIdx,
						stacks,
						// ⚓ Delivered by the SUMMON, not by the character — so a tick
						// can never satisfy `onReaction`'s `source: 'active'`, even
						// while its owner is the one on field. That is the whole
						// difference between Fischl's A4 in game and in gcsim.
						viaEntity: true
					});
				}
				// ⚓ …unless it only APPLIES (Nilou's aura): no hit record, no `onHit`
				// stream, no stack dispatch — and the chain runs on regardless.
				if (appliesOnlyTick) {
					const next = at + series.interval;
					if (!capReached() && inLife(next)) clock.schedule(next, Band.TICK, () => fire(next));
					return;
				}
				// ⚓ THE TICK IS DAMAGE, whether or not it applied. An ICD-suppressed
				// tick still HIT, and a damage proc listens for the hit — this is the
				// stream that lets Raiden's Eye fire off Oz (⚓ Nate's ruling, and the
				// survey's named "must be settled before authoring").
				const tickHit: HitEvent = {
					characterId: char.id,
					time: at,
					abilityType: kind,
					element,
					damageTag: kind,
					abilityName: summon.label,
					// ⚓ Delivered by the SUMMON — the same flag, word for word, that
					// finalize stamps on the hit it synthesizes for this same tick.
					viaEntity: true,
					sourceEventId: -1
				};
				// ⚠️ BEFORE `notifyDamage`, so a damage proc can never observe
				// half-applied stacks — the ordering `dispatchHit` already documents.
				// Guarded by the same team flag every other onHit stack dispatch is:
				// without an onHit stack consumer on the team there is nothing to
				// dispatch to.
				if (ctx.team.teamHasOnHitStackEffects) {
					const snapshot = dispatchEntityHitStacks(ctx, clock, char, tickHit);
					if (snapshot) ctx.tickStacks.set(`${char.id}::${summon.label}::${at}`, snapshot);
				}
				notifyDamage(ctx, clock, tickHit);
				// ⚓ An absorbed tick's mark and hit are PUBLISHED — no walk can know
				// the lock (the Lumi ruling). Marks keep their element: a twin draws
				// its own stub beside the Anemo one (⚓ Nate, 2026-10-17).
				// A travelling tick carries its FIRE so finalize bounds it the same way.
				if (absorbedMode && element !== undefined) {
					const landed =
						travel > 0 ? { time: at, element, firedAt: at - travel } : { time: at, element };
					const marks = ctx.absorbedMarks.get(absorbKey);
					if (marks) marks.push(landed);
					else ctx.absorbedMarks.set(absorbKey, [landed]);
					const landings = ctx.strikeLandings.get(absorbKey);
					if (landings) landings.push(landed);
					else ctx.strikeLandings.set(absorbKey, [landed]);
				}
				// ⚓ The tick's cost to its owner's Nightsoul pool, AFTER the hit
				// (gcsim `QueueAttack` then `reduceNightsoulPoints(3)`). It may end
				// the Blessing — and with it this summon, whose `endNow` reads it.
				if (summon.nightsoulCostPerTick)
					nightsoulSpend(ctx, clock, char, at, summon.nightsoulCostPerTick);
				// ⚠️ Scheduled whether or not the tick APPLIED: an ICD-suppressed
				// hit still happened, still spent its counter slot, and the series
				// must not stop because of it.
				const next = at + series.interval;
				// ⚠️ Stop SCHEDULING at the cap too, not only firing: a capped series
				// whose summon outlives its ticks would otherwise queue a task per
				// interval for the rest of the window, each one an immediate no-op.
				if (!capReached() && inLife(next)) clock.schedule(next, Band.TICK, () => fire(next));
			};

			// ⚓ A STREAM starts at the lock, phased from it; everything else at the
			// spawn.
			if (absorbedMode === 'stream') {
				lockOf(ctx, absorbKey).onLock.push((_el, lockAt) => {
					const first = lockAt + series.firstDelay;
					if (inLife(first)) clock.schedule(first, Band.TICK, () => fire(first));
				});
			} else {
				const first = spawnAt + series.firstDelay;
				if (inLife(first)) clock.schedule(first, Band.TICK, () => fire(first));
			}
		}

		if (summon.strikeSequence) {
			scheduleStrikeSequence(ctx, clock, char, kind, summon, spawnAt, liveAt, endNow, {
				preStates,
				constellation,
				chainIdx,
				stacks
			});
		}

		// ⚓ STACK-MOVING TICKS (stepped stacks round, 2026-09-27) — a summon whose
		// tick moves a count rather than dealing damage (Odette's Dance Double
		// hands Marvelous Splendor to the party once a second). One chain per
		// CADENCE, so a gain and the consume it pairs with fire as one tick in
		// authored order. ⚠️ No marker, no hit and no application: the lane's
		// markers mean hits and heals (`isMarkedTickEffect`).
		const cadences = new Map<string, SummonTickSeries[]>();
		for (const series of summonTickSeries(
			summon,
			cLevel,
			(e) => e.type === 'gainStacks' || e.type === 'consumeStacks',
			tickConditionCtx(ctx, char.id)
		)) {
			const k = `${series.firstDelay}/${series.interval}`;
			const group = cadences.get(k);
			if (group) group.push(series);
			else cadences.set(k, [series]);
		}
		for (const group of cadences.values()) {
			const { interval, firstDelay } = group[0];
			const effects = group.map((g) => g.effect);
			const fire = (at: number): void => {
				if (!liveAt(at) || at >= endNow()) return;
				// ⚓ Whether the OWNER is on field at this instant is a live fact the
				// tick can answer and a buff pass cannot — `ctx.activeCharId` is the
				// segment the clock is inside.
				const states = new Set(holderStatesAt(ctx, char, at));
				states.add(ctx.activeCharId === char.id ? 'onField' : 'offField');
				dispatchStacksOnSummonTick(
					char,
					ctx.getCharState(char.id),
					effects,
					at,
					states,
					cLevel,
					tickConditionCtx(ctx, char.id)
				);
				const next = at + interval;
				if (next < endNow()) clock.schedule(next, Band.TICK, () => fire(next));
			};
			const first = spawnAt + firstDelay;
			if (first < endNow()) clock.schedule(first, Band.TICK, () => fire(first));
		}
	});
}

type StrikeStep = Extract<Effect, { type: 'damage' }> & {
	trigger: Extract<Effect['trigger'], { type: 'summonStrike' }>;
};

/**
 * ⚓⚓ A SEQUENCED SUMMON'S STRIKES, decided one at a time on the live clock and
 * PUBLISHED (Lumi round, 2026-10-17; `docs/summon-tick-gaps-round.md` §1.5, §6.6).
 *
 * Each strike lands, THEN picks the next step and its gap — so the decision sees
 * the strike's own first landing (a Geo-first Pound's Moondrifts summon the Heavy
 * after it). The step after is refused when it needs a Moondrift and none
 * stands; the fallback strikes instead, on `fallbackGap`. The ENTRY is decided at
 * the spawn under the same rule, the way gcsim's summon task does.
 *
 * ⚓ It shares the fixed series' liveness pair (`liveAt` / `endNow`), so a
 * recast, a Q re-summon or a swap-out ends it through the one `summonEndAt` and
 * the generation stamp — ⛔ nothing cancels a task.
 *
 * ⚓ ONE standard-ICD counter per summon LABEL across every landing of every
 * step (the live combat log: both hits of every Pound, 8 of 11 pairs applying
 * at the bare 144f gap), so a Q-summoned Lumi carries the E one's counter.
 * ⚠️ The Pound's second hit is its own landing and its own hit record — the one
 * thing `summonTick`'s one-hit-per-tick could not say.
 */
function scheduleStrikeSequence(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	kind: 'skill' | 'burst',
	summon: Summon,
	spawnAt: number,
	liveAt: (at: number) => boolean,
	endNow: () => number,
	offerCtx: Pick<Offer, 'preStates' | 'constellation' | 'chainIdx' | 'stacks'>
): void {
	const seq = summon.strikeSequence;
	const steps = (summon.effects ?? []).filter(
		(e): e is StrikeStep => e.type === 'damage' && e.trigger.type === 'summonStrike'
	);
	if (!seq || steps.length === 0) return;
	const tickKey = `${char.id}::${summon.label}::${kind}::${spawnAt}`;
	const icdKey = `${char.id}:summon:${summon.label}:strikes`;
	const refused = (step: number, at: number): boolean =>
		steps[step].trigger.onlyWithMoondrift === true &&
		!moondriftStandsAt(ctx.lunarCrystallizeTimes, at);

	/** One landing: the gauge (when it applies and the counter lets it), then the
	 *  hit — stacks, procs — exactly as a fixed series' tick does. */
	const land = (at: number, element: Element | undefined, applies: boolean): void => {
		if (applies && element !== undefined) {
			let icd = ctx.icdClocks.get(icdKey);
			if (!icd) {
				icd = createIcdClock();
				ctx.icdClocks.set(icdKey, icd);
			}
			if (icdApplies(icd, at, STANDARD_ICD_FRAMES).applies) {
				offerApplication(ctx, clock, {
					time: at,
					characterId: char.id,
					element,
					units: DEFAULT_UNITS,
					provisionalUnits: false,
					castKind: kind,
					...offerCtx,
					viaEntity: true
				});
			}
		}
		const hit: HitEvent = {
			characterId: char.id,
			time: at,
			abilityType: kind,
			element,
			damageTag: kind,
			abilityName: summon.label,
			viaEntity: true,
			sourceEventId: -1
		};
		if (ctx.team.teamHasOnHitStackEffects) {
			const snapshot = dispatchEntityHitStacks(ctx, clock, char, hit);
			if (snapshot) ctx.tickStacks.set(`${char.id}::${summon.label}::${at}`, snapshot);
		}
		notifyDamage(ctx, clock, hit);
		const list = ctx.strikeLandings.get(tickKey);
		if (list) list.push({ time: at, element });
		else ctx.strikeLandings.set(tickKey, [{ time: at, element }]);
	};

	const strike = (at: number, step: number): void => {
		if (!liveAt(at) || at >= endNow()) return;
		const marks = ctx.stateGatedTicks.get(tickKey);
		if (marks) marks.push(at);
		else ctx.stateGatedTicks.set(tickKey, [at]);

		const eff = steps[step];
		// Absent `application` = one landing in the effect's element, the way a
		// fixed tick lands; `[]` = one hit that applies nothing.
		const landings =
			eff.application === undefined
				? [{ frame: 0, element: eff.element, applies: true }]
				: eff.application.length === 0
					? [{ frame: 0, element: eff.element, applies: false }]
					: eff.application.map((a) => ({
							frame: a.frame,
							element: resolveElementRef(a.element, tickConditionCtx(ctx, char.id)),
							applies: true
						}));
		for (const l of landings) {
			if (l.frame === 0) land(at, l.element, l.applies);
			else {
				const t = at + l.frame;
				clock.schedule(t, Band.LAND, () => {
					// gcsim's second Pound hit checks the summon is still the same one.
					if (liveAt(t) && t < endNow()) land(t, l.element, l.applies);
				});
			}
		}

		// ⚓⚓ THE NEXT STEP IS PICKED AFTER THE STRIKE'S LAST LANDING, its gap still
		// counted from the strike. The live log decides it: the Pound at 17.353s
		// (E run) is followed by a Heavy, and the only Moondrifts standing then are
		// the ones its SECOND hit's Lunar-Crystallize dropped at 17.684 — the field
		// refreshed at 7.363 had lapsed at 16.363. Queued after the landings at the
		// same frame and band, so it sees what they caused.
		const decideAt = at + Math.max(...landings.map((l) => l.frame));
		const decide = (): void => {
			const following = (step + 1) % steps.length;
			const [nextStep, gap] = refused(following, decideAt)
				? [seq.fallbackStep, seq.fallbackGap]
				: [following, eff.trigger.framesToNext];
			const next = at + gap;
			if (liveAt(next) && next < endNow())
				clock.schedule(next, Band.TICK, () => strike(next, nextStep));
		};
		if (decideAt === at) decide();
		else clock.schedule(decideAt, Band.LAND, decide);
	};

	// ⚓ The entry is decided AT THE SPAWN, not at the cast that queued it — a
	// teammate's Lunar-Crystallize in between counts.
	clock.schedule(spawnAt, Band.TICK, () => {
		const entry = refused(0, spawnAt) ? seq.fallbackStep : 0;
		const first = spawnAt + seq.firstStrikeAt;
		if (first < endNow()) clock.schedule(first, Band.TICK, () => strike(first, entry));
	});
}

/**
 * ⚓⚓ HAND ONE LINEUP OFF TO THE NEXT, mid-window (Arkhe round, landing c).
 *
 * Called at a state EDGE, with the states as they are AFTER it. If the character
 * is holding a `summonsFollowState` cast whose window still has time left, and
 * the variant that state now resolves is not the one occupying it, the occupant
 * changes: the running chain is retired and a fresh one is scheduled from this
 * instant with the remaining duration.
 *
 * ⚓ IT REUSES THE RECAST MACHINERY RATHER THAN INVENTING A SECOND KIND OF END.
 * Retiring the old chain is a `summonChainGen` bump on its key — the exact
 * mechanism a recast already uses, whose `isCurrent()` check every scheduled
 * tick and every armed summon proc already consults. ⛔ Nothing has to cancel a
 * queued task, and no new liveness predicate enters the chain.
 *
 * ⚠️ The replacement spawns with `summonActivatesAt: 0` — gcsim passes 0, not
 * the summon's own `spawnsAt`, because the spawn delay belongs to the cast
 * animation and there is no second cast. Its cadence restarts from here, which
 * is `summonSinger(0)` scheduling `singerInitialTick` afresh.
 *
 * ⚠️ The remaining duration is handed over as the new chain's `uptime`, so
 * `summonEndAt`'s index-0 branch lands it exactly on the shared window's end.
 * Read LIVE off the extension record for the same reason `endNow()` is.
 */
export function handOffLineup(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	statesAfterEdge: ReadonlySet<string>,
	/** ⚓ HANDED IN, not rebuilt. It is the caller's `variantCtx` — the same object
	 *  the cast resolved against — so the re-resolution cannot answer differently
	 *  because a second construction of the context drifted. */
	variantCtx: ConditionContext
): void {
	const held = ctx.followStateCasts.get(char.id);
	if (!held) return;
	const uptime = held.extRec ? held.extRec.ownerUptime : held.castEvent.uptime;
	const sharedEnd = held.spawnAt + uptime;
	// ⚠️ A stale entry is rejected HERE rather than cleared at the window's end —
	// nothing fires at an expiry, so there is no moment to clear it in.
	if (clock.now <= held.spawnAt || clock.now >= sharedEnd) return;

	const next = matchVariant(
		held.ability,
		held.label,
		statesAfterEdge,
		held.constellation,
		held.chainIdx,
		held.stackState,
		variantCtx
	);
	const nextLabel = next?.label ?? null;
	if (nextLabel === held.variantLabel) return;

	// Retire the outgoing lineup's chain(s) — the recast bump, on each summon the
	// OLD occupant owned.
	for (const summon of findSummonsForBar(
		char,
		held.kind,
		held.label,
		held.abilityId,
		held.variantLabel
	)) {
		const key = `${char.id}::${summon.label}`;
		const prior = ctx.summonChainGen.get(key) ?? 0;
		ctx.summonChainGen.set(key, prior + 1);
		// The replacement spawns HERE, so the outgoing chain is live until now.
		ctx.summonChainSupersededAt.set(`${key}#${prior}`, clock.now);
	}

	held.variantLabel = nextLabel;
	const changes = ctx.lineupChanges.get(held.castId) ?? [];
	changes.push({ at: clock.now, variantLabel: nextLabel });
	ctx.lineupChanges.set(held.castId, changes);

	scheduleSummonTicks(
		ctx,
		clock,
		char,
		held.kind,
		held.label,
		held.abilityId,
		nextLabel,
		clock.now,
		0,
		{ uptime: sharedEnd - clock.now },
		undefined,
		held.preStates,
		held.constellation,
		held.chainIdx,
		held.stackState
	);
}

/**
 * ⚓ How far past the end the gauge is walked so the aura's TAIL is drawn.
 *
 * The live gauge is caught up lazily — it only ever advances to the next
 * application — so at the last token it is parked at the last application's
 * frame and the aura it is still carrying has no samples after that. The lane's
 * whole second half ("here is where you lost it") is that decay, so finalize
 * settles the gauge before closing the series.
 *
 * ⚓ The bound is DERIVED, and over-shooting is free: `advanceTo` walks only
 * while the gauge is non-idle and JUMPS the moment every aura is spent, so a
 * generous constant costs nothing and a tight one risks a clipped tail. The
 * longest an aura can outlive its last application is a top-up onto the slowest
 * decay rate — a 1U fresh aura decays at 0.8 / (2.5 + 7) ≈ 0.0842 U/s and keeps
 * that rate when topped up, so at the 3.2U ceiling it runs 38 s. Frozen, EC and
 * Burning all drain faster or are bounded by their fuel. 60 s is that with
 * margin.
 */
const AURA_SETTLE_F = 60 * 60;

/**
 * The aura trajectory this parse produced, closed off after the tail has
 * decayed — the aura lane's substrate (gauge round L6).
 *
 * ⚠️ Advancing here runs the gauge's own internal tasks (Burning and EC ticks)
 * past the end of the rotation, and their events are deliberately DROPPED: we
 * never call `takeEvents`, so nothing dispatches and no IR event is added. That
 * is sound for exactly the reason the wake-up task is unnecessary (see
 * `offerApplication`) — the only internal applicator is the Burning chain and
 * its Pyro provably cannot react. ⚠️ If that ever changes, a reaction after the
 * last cast becomes real and this settle has to emit it.
 */
export function collectAuraSeries(ctx: SimContext, totalDuration: number): SeriesInterval[] {
	const lastOffer = ctx.aura.offers.length
		? ctx.aura.offers[ctx.aura.offers.length - 1].time
		: totalDuration;
	ctx.aura.gauge.advanceTo(Math.max(totalDuration, lastOffer) + AURA_SETTLE_F);
	// ⚓ THE GADGET EVENTS ARE TAKEN HERE AND THE REACTIONS ARE STILL DROPPED,
	// and the difference is DISPATCH, not tidiness. The paragraph above refuses
	// the settle's reactions because a reaction has consequences — buff windows,
	// stack grants, procs — that would fire after the parse believed itself
	// finished. A core SPAWN has none: it is drawn and nothing else reads it. A
	// Bloom on the last frame of a rotation really does leave a core on the
	// field 30 frames later, and dropping it would draw a Bloom marker with
	// nothing under it.
	for (const e of ctx.aura.gauge.takeEvents()) {
		if (e.kind === 'coreSpawn' || e.kind === 'coreEnd') recordGadgetEvent(ctx, e);
	}
	return ctx.aura.gauge.closeSeries();
}

/** The applications this parse put on the target, in time order — the public
 *  projection of `AuraState.offers`, authored onto `ParsedRotation` at finalize. */
export function collectApplications(ctx: SimContext): AuraApplication[] {
	// ⚓⚓ OFFER ORDER IS TIME ORDER, AND THIS IS THE PLACE THAT USED TO PRETEND SO.
	//
	// L5e-b shipped a `.sort()` here with a note saying the sort was NOT the fix:
	// the cast pipeline advanced the clock through the cast animation before its
	// emitters ran, so a hit at frame 18 of a 79-frame animation was scheduled at
	// a `clock.now` of 79 and CLAMPED there (what `Clock.latecomers` counts), and
	// with L5e-b's summon ticks queued at `Band.TICK` (10) against the cast's
	// `Band.LAND` (20) at that same clamped frame, a summon could reach the gauge
	// before the cast that spawned it. The sort made this projection honest and
	// left the GAUGE — which is fed in offer order and whose `advanceTo` no-ops
	// backwards — reading a rotation that never happened.
	//
	// The pipeline schedules before it advances since 2026-08-17 (`run.ts`,
	// `castEnd`), so the clock orders every application by its own frame and the
	// sort has nothing left to do. ⛔ It is deliberately NOT kept "for safety":
	// a sort here would silently absorb the defect's return, and the invariant is
	// pinned over the whole corpus instead (`notationParser.ir.test.ts`).
	return ctx.aura.offers.map((o) => ({
		time: o.time,
		characterId: o.characterId,
		element: o.element,
		units: o.units,
		provisionalUnits: o.provisionalUnits,
		castKind: o.castKind
	}));
}
