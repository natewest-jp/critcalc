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
	Reaction
} from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import type { IcdParams } from '$lib/utils/icd';
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
	summonSpawnAt,
	summonTickSeries,
	tickCapOf
} from './summons';
import type { NormalActionKind } from '$lib/utils/actionElement';
import type { ReactionEvent } from '$lib/utils/rotationEvents';
import { createGauge, type ElementId, type Gauge, type SeriesInterval } from '$lib/utils/gauge';
import { framesOf } from '$lib/utils/frames';
import type { SimContext } from './context';
import { Band, type Clock } from './clock';
import { type ChainIndex } from './conditions';
import { dispatchOnReactionExtensions } from './extensions';
import {
	applyRotationLifetimeExpiry,
	dispatchConsumeStacksOnHit,
	dispatchGainStacksOnHit,
	dispatchGainStacksOnReaction,
	rotationStackSnapshot
} from './stacks';
import { holderStatesAt } from './states';
import type { HitEvent } from './hits';
import { getChainIndexMap } from './cooldowns';
import { toReactions } from './reactionBridge';
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

export function createAuraState(): AuraState {
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
	return { gauge: createGauge({ sampling: true }), offers: [] };
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
		new Map([[src.characterId, src.preStates]]),
		new Map(ctx.team.teamChars.map((c) => [c.id, ctx.constellationLevels?.[c.id] ?? 0])),
		ctx.getCharState
	);
	scheduleReactionProcs(ctx, clock, src, reaction, time);
	ctx.events.push({
		kind: 'reaction',
		id: ctx.nextId(),
		characterId: src.characterId,
		reaction,
		time,
		castKind: src.castKind
	});
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
		if (!app.element) continue;
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
		const element = app.element;
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
 * ⚠️ For an E/Q cast the record's `time` is the CAST START, the `HitEvent`
 * convention every `onHit` consumer already reads. It is up to a second early on
 * a slow burst; splitting it would give the corpus two answers to "when did this
 * cast hit". See docs/coordinated-attacks-round.md §5.
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
	abilityNoICD: boolean | undefined
): { frame: number; element: Element; units: number; provisionalUnits: boolean }[] {
	if (!application) {
		// Absent → the pre-L4d model, provisionally. See the amendment note below.
		return char.element
			? [{ frame: 0, element: char.element, units: DEFAULT_UNITS, provisionalUnits: true }]
			: [];
	}
	const elemental = [];
	for (const a of application) {
		if (a.element)
			elemental.push({
				frame: a.frame,
				element: a.element,
				units: a.units ?? DEFAULT_UNITS,
				provisionalUnits: a.units === undefined
			});
	}
	const params = resolveActionIcd(castKind, char.weapon, abilityNoICD);
	if (!params) return elemental;
	const clock = createIcdClock();
	return elemental.filter((a) => icdApplies(clock, a.frame, params).applies);
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
	preStates: ReadonlySet<string>,
	constellation: number,
	chainIdx: ChainIndex,
	stackState: Map<string, number>
): void {
	const stacks = stackState.size > 0 ? new Map(stackState) : undefined;
	for (const app of resolveCastApplications(char, application, castKind, abilityNoICD)) {
		const at = castTime + app.frame;
		clock.schedule(at, Band.LAND, () => {
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

/** One N/C/P swing offered to the aura, behind its ICD clock (ICD round,
 *  2026-08-15). Called at the swing's HIT instant — the post-advance cursor,
 *  the same instant `dispatchHit` uses — because that is when the element
 *  lands.
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
	chargedIcdWindow?: IcdWindow
): void {
	if (!element) return;
	const params = resolveActionIcd(kind, char.weapon, abilityNoICD, chargedIcdWindow);
	if (params) {
		// ⚠️ Named `icd`, not `clock` — the rotation `Clock` is a parameter now
		// (the reaction-proc dispatch needs it), and the two must not shadow.
		const key = `${char.id}:${icdTagFor(kind)}`;
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
function tickConditionCtx(ctx: SimContext): {
	teamFactionCounts: ReadonlyMap<string, number>;
	teamEnabledReactions: ReadonlySet<string>;
} {
	return {
		teamFactionCounts: ctx.team.teamFactionCounts,
		teamEnabledReactions: ctx.team.teamEnabledReactions
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
		null
	);
	return snapshot;
}

export function scheduleSummonTicks(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	kind: 'skill' | 'burst',
	label: string,
	abilityId: string | undefined,
	castTime: number,
	summonActivatesAt: number | undefined,
	castEvent: { uptime: number },
	extRec: { ownerUptime: number } | undefined,
	preStates: ReadonlySet<string>,
	constellation: number,
	chainIdx: ChainIndex,
	stackState: Map<string, number>
): void {
	const cLevel = ctx.constellationLevels?.[char.id] ?? 0;
	const stacks = stackState.size > 0 ? new Map(stackState) : undefined;

	findSummonsForBar(char, kind, label, abilityId).forEach((summon, index) => {
		const spawnAt = summonSpawnAt(castTime, summonActivatesAt, summon, index);
		const key = `${char.id}::${summon.label}`;
		// ⚠️ Bumped ONLY for a recast-terminating summon, mirroring finalize's
		// truncation exactly: one without the flag spawning twice leaves both
		// windows — and therefore both chains — alive.
		if (summon.terminatesOn === 'recast')
			ctx.summonChainGen.set(key, (ctx.summonChainGen.get(key) ?? 0) + 1);
		const generation = ctx.summonChainGen.get(key) ?? 0;

		/** The summon's end AS OF NOW — recomputed at every fire, never cached. */
		const endNow = (): number =>
			summonEndAt({
				spawnAt,
				// ⚓ LIVE. `durationExtensions` accumulate into the extension
				// record and finalize stamps the cast event only at the end, so
				// `castEvent.uptime` is the PRE-extension value mid-parse and
				// Collei's Cuilein-Anbar would tick short. ⛔ Never snapshot this.
				barUptime: extRec ? extRec.ownerUptime : castEvent.uptime,
				summon,
				index,
				// ⚠️ Only a swap-out AFTER this spawn can end this summon; an
				// earlier one belongs to a previous life of the same character.
				swapOutAt: (() => {
					const s = ctx.lastSwapOutAt.get(char.id);
					return s !== undefined && s > spawnAt ? s : Infinity;
				})()
			});

		/** Superseded by a recast? ⚓ Shared with the proc listener below so the
		 *  two cannot disagree about which spawn is live. */
		const isCurrent = (): boolean => (ctx.summonChainGen.get(key) ?? 0) === generation;

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
			tickConditionCtx(ctx)
		)) {
			const element = (series.effect as Extract<Effect, { type: 'damage' }>).element;
			// ⛔ A physical (element-less) tick applies nothing and must not reach an
			// ICD clock — the same rule a physical swing follows. ↻ It DOES still
			// reach the clock, since the coordinated-attack round: a physical tick
			// deals damage, and damage is what an `onHit` proc listens for. The
			// corpus has none of these today (0 of 50 series) and the branch exists
			// so the damage stream is complete by construction rather than by census.
			// ⚓ Per SERIES, not per summon: Furina's Salon Solitaire carries three
			// and they measure as three different gates.
			const icdKey = `${char.id}:summon:${summon.label}:${series.index}`;
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

			// ⚓ THE SECOND READER of the tick cap, and it MUST agree with
			// `collectSummonTicks` — that walk draws the markers a reader counts on
			// the summon lane and this chain feeds the gauge, so a divergence shows
			// a marker that applies nothing or applies off a marker nobody drew.
			// ⛔ Read the rule from `tickCapOf`; never re-derive it here.
			// ⚠️ `fired` is per SERIES per SPAWN, which is what the closure already
			// scopes — a recast builds a new chain and starts its own count, exactly
			// as a recast restarts the walk.
			const cap = tickCapOf(series.effect, cLevel, tickConditionCtx(ctx));
			let fired = 0;
			// ⚠️ A cap lets the BOUNDARY tick through and no further: the window
			// widens by one interval only when a cap is authored, mirroring
			// `collectSummonTicks`. See the `tickCap` schema note for why gcsim
			// lands that tick and our half-open walk does not.
			// ⚓ Recomputed per call, never cached — `endNow()` is live, because a
			// duration extension or a swap-out can move the end mid-chain.
			const liveUntil = (): number => (cap === null ? endNow() : endNow() + series.interval);
			const capReached = (): boolean => cap !== null && fired >= cap;

			const fire = (at: number): void => {
				// Superseded by a recast, or the summon is gone. Either way the
				// chain simply ends — ⛔ nothing has to cancel a scheduled task.
				if (!isCurrent()) return;
				if (at >= liveUntil()) return;
				if (capReached()) return;
				fired += 1;

				let applies = element !== undefined;
				if (element !== undefined && params) {
					let icd = ctx.icdClocks.get(icdKey);
					if (!icd) {
						icd = createIcdClock();
						ctx.icdClocks.set(icdKey, icd);
					}
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
						units: DEFAULT_UNITS,
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
					const snapshot = dispatchEntityHitStacks(ctx, char, tickHit);
					if (snapshot) ctx.tickStacks.set(`${char.id}::${summon.label}::${at}`, snapshot);
				}
				notifyDamage(ctx, clock, tickHit);
				// ⚠️ Scheduled whether or not the tick APPLIED: an ICD-suppressed
				// hit still happened, still spent its counter slot, and the series
				// must not stop because of it.
				const next = at + series.interval;
				// ⚠️ Stop SCHEDULING at the cap too, not only firing: a capped series
				// whose summon outlives its ticks would otherwise queue a task per
				// interval for the rest of the window, each one an immediate no-op.
				if (!capReached() && next < liveUntil()) clock.schedule(next, Band.TICK, () => fire(next));
			};

			const first = spawnAt + series.firstDelay;
			if (first < liveUntil()) clock.schedule(first, Band.TICK, () => fire(first));
		}
	});
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
