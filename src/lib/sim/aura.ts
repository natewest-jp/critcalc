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

import type { Element, ElementalApplication, Reaction } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import { createIcdClock, icdApplies, icdTagFor, resolveActionIcd } from '$lib/utils/icd';
import type { NormalActionKind } from '$lib/utils/actionElement';
import type { ReactionEvent } from '$lib/utils/rotationEvents';
import { createGauge, type ElementId, type Gauge } from '$lib/utils/gauge';
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
	/** The units figure is a default rather than measured data (L6 marks a bar
	 *  drawn from one `--ui-provisional`). */
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
	// ⛔ No series sampling either — nothing draws an aura lane until L6.
	return { gauge: createGauge(), offers: [] };
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
 *  ⚠️ A swing's gauge is the 1U default: no per-swing units are authored, and
 *  gcsim's own normals are overwhelmingly 25 durability. */
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
		provisionalUnits: true,
		castKind: kind,
		preStates,
		constellation,
		chainIdx: getChainIndexMap(ctx, char.id, time),
		stacks: stackState.size > 0 ? new Map(stackState) : undefined
	});
}

/** The applications this parse put on the target, in time order — the public
 *  projection of `AuraState.offers`, authored onto `ParsedRotation` at finalize. */
export function collectApplications(ctx: SimContext): AuraApplication[] {
	return ctx.aura.offers.map((o) => ({
		time: o.time,
		characterId: o.characterId,
		element: o.element,
		units: o.units,
		provisionalUnits: o.provisionalUnits,
		castKind: o.castKind
	}));
}
