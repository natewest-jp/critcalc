/**
 * src/lib/sim/aura.ts
 *
 * ⚓⚓ THE L5 SEAM. This module is the COARSE aura model the gauge round exists to
 * replace: `AuraState` is a set of flags, applications never decay, and Anemo/Geo
 * never consume. `simulateGauge` (`$lib/utils/gauge.ts`) is what takes its place,
 * and the interface below — "an application LANDS at `time`, with `element`" — is
 * deliberately the same shape the gauge wants, so L5 swaps the body rather than
 * the call sites.
 *
 * Measured cost of the current model (gauge-round.md §1, L0 baseline): we emit
 * 63 applications where gcsim emits 200, and a permanent swirl draws a VV
 * RES-shred bar that never ends.
 *
 * ⚓ N/C/P SWINGS APPLY TOO (ICD round, 2026-08-15), AND ONLY THEY ARE GATED.
 * ⛔ E/Q casts stay ungated on purpose: **ICD counts HITS, and a cast event is
 * not a hit — it is an ABILITY**. We model a multi-hit skill as one application,
 * so a counter over cast events would suppress a second cast that in game lands
 * four more hits. Normals are genuinely one swing = one hit, which is exactly
 * where the counter belongs. See docs/library/game/icd.md.
 *
 * ⚠️ Reaction emission FEEDS BACK into scheduling (gauge-round.md §2, F2): each
 * emitted reaction dispatches duration extensions, which move a stance's end,
 * which ability resolution then reads. ⛔ This is not a pure output and never was.
 */

import type { AuraElement, Element, ElementalApplication, Reaction } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import { createIcdClock, icdApplies, icdTagFor, resolveActionIcd } from '$lib/utils/icd';
import type { NormalActionKind } from '$lib/utils/actionElement';
import type { ReactionEvent } from '$lib/utils/rotationEvents';
import type { SimContext } from './context';
import { Band, type Clock } from './clock';
import { type ChainIndex } from './conditions';
import { dispatchOnReactionExtensions } from './extensions';
import { dispatchGainStacksOnReaction } from './stacks';
import { getChainIndexMap } from './cooldowns';

// ---------------------------------------------------------------------------
// Synthetic reaction emission (E3 v1.5 — cast-only optimistic model)
// ---------------------------------------------------------------------------
//
// The planner does not simulate elemental gauge / aura state at gcsim fidelity
// (per "windows not gauges" constitution). Instead, v1.5 emits typed reactions
// at each E/Q cast based on the character's element + a coarse rotation-wide
// aura state. The emitted reactions feed the `onReaction` triggers on
// `gainStacks` effects and `durationExtensions[]` entries.
//
// Aura state simplifications vs. KQM Elemental Gauge Theory:
//   - No durability/decay: applied auras stick indefinitely.
//   - No reaction-specific GCDs (Crystallize 1s, Swirl 0.5s ICD, etc.).
//   - Anemo and Geo do NOT consume aura (KQM: anemo spreads/doesn't clear;
//     geo's partial reduce is approximated as no-consume).
//   - PHEC casts consume opposing PHEC and apply own element (default rule),
//     with explicit special cases for EC coexistence, Bloom (push core),
//     Burning (compound aura), Quicken (compound aura), and Hyperbloom/
//     Burgeon (consume core).
//   - No element-absorption tracking (Kazuha-shape characters use their own
//     element; absorbed elements are deferred to a future P4 expansion).
//
// ⚓ N/C/P SWINGS APPLY TOO (ICD round, 2026-08-15), AND ONLY THEY ARE GATED.
// A catalyst's normals, a catalyst or bow charged shot and an infused plunge
// all feed the aura — behind the elemental-application ICD clock, because a
// naive wiring would emit five swirls from a catalyst `N5` where the game
// gives two. ⛔ E/Q casts stay ungated on purpose: **ICD counts HITS, and a
// cast event is not a hit — it is an ABILITY**. We model a multi-hit skill as
// one application, so a counter over cast events would suppress a second cast
// that in game lands four more hits. Normals are genuinely one swing = one
// hit, which is exactly where the counter belongs. See docs/library/game/icd.md.
//
// Cold-start emerges naturally: the first cast sees an empty aura set and
// emits no reactions; only the LATER casts (after some applicator has fired)
// react. Anemo→Anemo→Anemo all emit zero reactions if no PHEC/dendro
// applicator preceded them.

export type AuraState = {
	/** Currently-applied 5-element auras. Anemo and Geo are not aura-applying. */
	applied: Set<AuraElement>;
	/** Burning compound aura — pyro+dendro coexisting. Acts as both. */
	burning: boolean;
	/** Quickened compound aura — dendro+electro coexisting. Acts as both. */
	quickened: boolean;
	/** Count of dendro cores on field (consumed by hyperbloom/burgeon). */
	bloomCores: number;
};

export function createAuraState(): AuraState {
	return { applied: new Set(), burning: false, quickened: false, bloomCores: 0 };
}

/** Returns the typed reactions an application of `element` plausibly triggers
 *  given the current aura state — an E/Q cast, or an N/C/P swing that cleared
 *  its ICD clock. Optimistic: any opposing aura makes the matching reaction
 *  eligible. The consumer's `trigger.reaction` filter narrows further at
 *  dispatch time. `hasMoonsignTeam` enables `lunarCrystallize` emission for
 *  geo casts (gating: 2+ Moonsign on team). `teamEnabledReactions` CONVERTS
 *  superConduct → stellarConduct when a Stellar-Conduct enabler is on the
 *  team (replacement, not addition — in game ALL Superconduct converts, and
 *  patched kit texts say "Superconduct or Stellar-Conduct", so consumers
 *  author OR-arrays; see docs/library/game/stellar-reactions.md).
 *
 *  Returns `Reaction` keys matching `src/lib/types/ability.ts`:
 *  swirl, crystallize, lunarCrystallize, vaporize, melt, overloaded, burning,
 *  bloom, electroCharged, frozen, superConduct|stellarConduct, quicken,
 *  aggravate, hyperbloom, burgeon, spread. Note: lunarBloom and lunarCharged
 *  are schema-supported but not yet emitted (no character authoring needs
 *  them via the synthetic emission path; deferred to manual triggers / future
 *  Moonsign reaction surface). stellarSwirl is likewise not emitted until its
 *  7.0 mechanics are confirmed. */
export function computeReactionsForApplication(
	element: Element,
	aura: AuraState,
	hasMoonsignTeam: boolean,
	teamEnabledReactions: ReadonlySet<string>
): Reaction[] {
	const reactions: Reaction[] = [];
	const has = (e: AuraElement) => aura.applied.has(e);

	switch (element) {
		case 'anemo':
			// Shape A (2026-05-14): emit element-specific swirl variants only.
			// The broad `'swirl'` key was retired so the schema matches in-game
			// React() ontology — pyroSwirl / hydroSwirl / cryoSwirl /
			// electroSwirl are distinct reactions. Existing consumers
			// (Mizuki A1, Kazuha A4, Sucrose A4, VV 4pc) author OR-arrays
			// matching all four variants when they need the "any swirl" effect.
			if (has('pyro')) reactions.push('pyroSwirl');
			if (has('hydro')) reactions.push('hydroSwirl');
			if (has('cryo')) reactions.push('cryoSwirl');
			if (has('electro')) reactions.push('electroSwirl');
			break;
		case 'geo':
			if (has('pyro')) reactions.push('pyroCrystallize');
			if (has('hydro')) reactions.push('hydroCrystallize');
			if (has('cryo')) reactions.push('cryoCrystallize');
			if (has('electro')) reactions.push('electroCrystallize');
			if (hasMoonsignTeam && (has('pyro') || has('hydro') || has('cryo') || has('electro')))
				reactions.push('lunarCrystallize');
			break;
		case 'pyro':
			if (has('hydro')) reactions.push('vaporize');
			if (has('cryo')) reactions.push('melt');
			if (has('electro')) reactions.push('overloaded');
			if (has('dendro')) reactions.push('burning');
			if (aura.bloomCores > 0) reactions.push('burgeon');
			break;
		case 'hydro':
			if (has('pyro')) reactions.push('vaporize');
			if (has('cryo')) reactions.push('frozen');
			if (has('electro')) reactions.push('electroCharged');
			if (has('dendro') || aura.quickened) reactions.push('bloom');
			break;
		case 'cryo':
			if (has('pyro')) reactions.push('melt');
			if (has('hydro')) reactions.push('frozen');
			if (has('electro'))
				reactions.push(
					teamEnabledReactions.has('stellarConduct') ? 'stellarConduct' : 'superConduct'
				);
			break;
		case 'electro':
			if (has('pyro')) reactions.push('overloaded');
			if (has('hydro')) reactions.push('electroCharged');
			if (has('cryo'))
				reactions.push(
					teamEnabledReactions.has('stellarConduct') ? 'stellarConduct' : 'superConduct'
				);
			if (has('dendro')) reactions.push('quicken');
			if (aura.quickened) reactions.push('aggravate');
			if (aura.bloomCores > 0) reactions.push('hyperbloom');
			break;
		case 'dendro':
			if (has('pyro')) reactions.push('burning');
			if (has('hydro')) reactions.push('bloom');
			if (has('electro')) reactions.push('quicken');
			if (aura.quickened) reactions.push('spread');
			break;
		case 'physical':
			// No reaction emission for physical casts (no character has
			// physical as element today; included for type completeness).
			break;
	}
	return reactions;
}

/** Mutates `aura` in place to reflect the post-application state. Anemo and Geo
 *  are no-ops (they don't apply or consume aura in our simplified model). PHEC
 *  and dendro applications run consumption rules in priority order: bloom-core ops →
 *  bloom formation → burning compound → quicken compound → EC coexistence →
 *  default opposing-PHEC consumption. */
export function updateAuraStateAfterApplication(element: Element, aura: AuraState): void {
	if (element === 'anemo' || element === 'geo' || element === 'physical') return;

	// Bloom-core consumption: electro → hyperbloom; pyro → burgeon. Consumes
	// one core; otherwise behaves like a normal aura application.
	if ((element === 'electro' || element === 'pyro') && aura.bloomCores > 0) {
		aura.bloomCores -= 1;
		// Fall through to default to also apply own element / clear opposing.
	}

	// Bloom: hydro + dendro → consume both, push core.
	if (element === 'hydro' && aura.applied.has('dendro')) {
		aura.applied.delete('dendro');
		aura.bloomCores += 1;
		// hydro is consumed in the reaction; do not add it to applied.
		return;
	}
	if (element === 'dendro' && aura.applied.has('hydro')) {
		aura.applied.delete('hydro');
		aura.bloomCores += 1;
		return;
	}

	// Burning: pyro + dendro → set compound flag; both elements remain present
	// (burning aura acts as pyro for future reactions, with underlying dendro).
	if (element === 'pyro' && aura.applied.has('dendro')) {
		aura.burning = true;
		aura.applied.add('pyro');
		return;
	}
	if (element === 'dendro' && aura.applied.has('pyro')) {
		aura.burning = true;
		aura.applied.add('dendro');
		return;
	}

	// Quicken: dendro + electro → set compound flag; both elements remain
	// (quicken aura coexists with dendro/electro/cryo per KQM).
	if (element === 'dendro' && aura.applied.has('electro')) {
		aura.quickened = true;
		aura.applied.add('dendro');
		return;
	}
	if (element === 'electro' && aura.applied.has('dendro')) {
		aura.quickened = true;
		aura.applied.add('electro');
		return;
	}

	// EC coexistence: hydro + electro → both auras stay.
	if (element === 'hydro' && aura.applied.has('electro')) {
		aura.applied.add('hydro');
		return;
	}
	if (element === 'electro' && aura.applied.has('hydro')) {
		aura.applied.add('electro');
		return;
	}

	// Default PHEC: cast clears opposing PHEC, applies own.
	const opposingMap: Partial<Record<Element, AuraElement[]>> = {
		pyro: ['hydro', 'cryo', 'electro'],
		hydro: ['pyro', 'cryo'],
		cryo: ['pyro', 'hydro', 'electro'],
		electro: ['pyro', 'cryo'],
		dendro: []
	};
	for (const opp of opposingMap[element] ?? []) {
		aura.applied.delete(opp);
	}
	aura.applied.add(element as AuraElement);
}

/** One elemental application: compute the synthetic reactions for `element` +
 *  the current aura state, dispatch each to the onReaction extension and
 *  gainStacks paths, push `reaction` IR events for renderer consumption
 *  (artifact onReaction effects), then update the aura state. Shared by the
 *  E/Q cast sites and the N/C/P swing sites; the caller has already decided
 *  that this application LANDS (the swing sites ask the ICD clock first). */
export function emitReactionsForApplication(
	ctx: SimContext,
	char: CharacterData,
	element: Element,
	source: ReactionEvent['castKind'],
	time: number,
	preStates: ReadonlySet<string>,
	constellation: number,
	chainIdx: ChainIndex,
	stackState: Map<string, number>
): void {
	const reactions = computeReactionsForApplication(
		element,
		ctx.aura,
		ctx.team.hasMoonsignTeam,
		ctx.team.teamEnabledReactions
	);
	const stacksSnapshot = stackState.size > 0 ? new Map(stackState) : undefined;
	for (const r of reactions) {
		dispatchOnReactionExtensions(
			ctx,
			char.id,
			r,
			time,
			preStates,
			constellation,
			chainIdx,
			stacksSnapshot
		);
		dispatchGainStacksOnReaction(
			ctx.team.teamChars,
			char.id,
			r,
			time,
			new Map([[char.id, preStates]]),
			new Map(ctx.team.teamChars.map((c) => [c.id, ctx.constellationLevels?.[c.id] ?? 0])),
			ctx.getCharState
		);
		ctx.events.push({
			kind: 'reaction',
			id: ctx.nextId(),
			characterId: char.id,
			reaction: r,
			time,
			castKind: source
		});
	}
	updateAuraStateAfterApplication(element, ctx.aura);
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
	abilityNoICD: boolean | undefined
): { frame: number; element: Element }[] {
	if (!application) {
		// Absent → the pre-L4d model, provisionally. See the amendment note below.
		return char.element ? [{ frame: 0, element: char.element }] : [];
	}
	const elemental: { frame: number; element: Element }[] = [];
	for (const a of application) {
		if (a.element) elemental.push({ frame: a.frame, element: a.element });
	}
	const params = resolveActionIcd(castKind, char.weapon, abilityNoICD);
	if (!params) return elemental;
	const clock = createIcdClock();
	return elemental.filter((a) => icdApplies(clock, a.frame, params).applies);
}

/**
 * A cast's own hits, SCHEDULED at the frames they land (gauge round L4d).
 *
 * ⚓⚓ THIS IS THE FIRST REAL CUSTOMER OF L3's TASK QUEUE. Until now the parser
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
 * ⚓⚓ A CAST'S OWN HITS ARE ICD-GATED NOW; ACROSS CASTS THEY ARE STILL NOT. The
 * standing ⛔ ("a cast is an ABILITY, not a hit") rested on *we model a multi-hit
 * skill as one application*, which `application[]` retired — left wholly ungated,
 * Barbara's Melody Loop landed twelve hydro applications against gcsim's six. But
 * gating across casts is wrong for a reason the census makes plain: most skills
 * are `ICDTagNone` upstream and the tagged ones sit in bespoke groups. So the
 * counter is scoped to one cast. `resolveActionIcd` carries the numbers.
 *
 * ⚠️ The authored list stays NOMINAL — gcsim emits a damage event for a hit its
 * own ICD suppressed, and we author from that stream (contract C4). The gate is
 * applied HERE, once, at the land instant. ⛔ Never pre-filter the data.
 *
 * ⚠️ The dispatch context — states, constellation, chain index, stacks — is
 * captured at the CAST, while the aura it reads is live at the LAND. That split
 * is deliberate for L4d: the aura is the thing whose timing was wrong, and
 * re-resolving a character's state set inside a scheduled closure is L5's
 * problem, when reactions stop being synthesized at all.
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
	for (const app of resolveCastApplications(char, application, castKind, abilityNoICD)) {
		const at = castTime + app.frame;
		clock.schedule(at, Band.LAND, () => {
			emitReactionsForApplication(
				ctx,
				char,
				app.element,
				castKind,
				at,
				preStates,
				constellation,
				chainIdx,
				stackState
			);
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
 *  with (`resolveActionIcd` carries the case list). */
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
	emitReactionsForApplication(
		ctx,
		char,
		element,
		kind,
		time,
		preStates,
		constellation,
		getChainIndexMap(ctx, char.id, time),
		stackState
	);
}
