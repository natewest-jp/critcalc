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

import type { Effect, Element, ElementalApplication, Reaction } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import {
	createIcdClock,
	icdApplies,
	icdTagFor,
	resolveActionIcd,
	STANDARD_ICD_FRAMES
} from '$lib/utils/icd';
import { findSummonsForBar, summonEndAt, summonSpawnAt, summonTickSeries } from './summons';
import type { NormalActionKind } from '$lib/utils/actionElement';
import type { ReactionEvent } from '$lib/utils/rotationEvents';
import { createGauge, type ElementId, type Gauge, type SeriesInterval } from '$lib/utils/gauge';
import { framesOf } from '$lib/utils/frames';
import type { SimContext } from './context';
import { Band, type Clock } from './clock';
import { type ChainIndex } from './conditions';
import { dispatchOnReactionExtensions } from './extensions';
import { dispatchGainStacksOnReaction } from './stacks';
import { getChainIndexMap } from './cooldowns';
import { toReactions } from './reactionBridge';

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
function offerApplication(ctx: SimContext, offer: Offer): void {
	const { gauge, offers } = ctx.aura;
	gauge.advanceTo(offer.time);
	const index = offers.length;
	offers.push(offer);
	gauge.apply(offer.element as ElementId, offer.units, index);

	for (const e of gauge.takeEvents()) {
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
		for (const r of toReactions(e, ctx.team)) emitReaction(ctx, src, r, time);
	}
}

/** One reaction: the two dispatch paths, then the IR event. ⚠️ Order matters —
 *  the dispatches are what feed F2 (a reaction moves a stance's end). */
function emitReaction(ctx: SimContext, src: Offer, reaction: Reaction, time: number): void {
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
			offerApplication(ctx, {
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
	char: CharacterData,
	kind: NormalActionKind,
	element: Element | undefined,
	abilityNoICD: boolean | undefined,
	time: number,
	preStates: ReadonlySet<string>,
	constellation: number,
	stackState: Map<string, number>
): void {
	if (!element) return;
	const params = resolveActionIcd(kind, char.weapon, abilityNoICD);
	if (params) {
		const key = `${char.id}:${icdTagFor(kind)}`;
		let clock = ctx.icdClocks.get(key);
		if (!clock) {
			clock = createIcdClock();
			ctx.icdClocks.set(key, clock);
		}
		if (!icdApplies(clock, time, params).applies) return;
	}
	offerApplication(ctx, {
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

		for (const series of summonTickSeries(summon, cLevel, (e) => e.type === 'damage')) {
			const element = (series.effect as Extract<Effect, { type: 'damage' }>).element;
			// ⛔ A physical (element-less) tick applies nothing and must not reach
			// a clock — the same rule a physical swing follows.
			if (!element) continue;
			// ⚓ Per SERIES, not per summon: Furina's Salon Solitaire carries three
			// and they measure as three different gates.
			const icdKey = `${char.id}:summon:${summon.label}:${series.index}`;
			const ungated =
				series.effect.trigger.type === 'summonTick' && series.effect.trigger.icdGate === 'none';

			const fire = (at: number): void => {
				// Superseded by a recast, or the summon is gone. Either way the
				// chain simply ends — ⛔ nothing has to cancel a scheduled task.
				if ((ctx.summonChainGen.get(key) ?? 0) !== generation) return;
				if (at >= endNow()) return;

				let applies = true;
				if (!ungated) {
					let icd = ctx.icdClocks.get(icdKey);
					if (!icd) {
						icd = createIcdClock();
						ctx.icdClocks.set(icdKey, icd);
					}
					applies = icdApplies(icd, at, STANDARD_ICD_FRAMES).applies;
				}
				if (applies) {
					offerApplication(ctx, {
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
						stacks
					});
				}
				// ⚠️ Scheduled whether or not the tick APPLIED: an ICD-suppressed
				// hit still happened, still spent its counter slot, and the series
				// must not stop because of it.
				const next = at + series.interval;
				if (next < endNow()) clock.schedule(next, Band.TICK, () => fire(next));
			};

			const first = spawnAt + series.firstDelay;
			if (first < endNow()) clock.schedule(first, Band.TICK, () => fire(first));
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
