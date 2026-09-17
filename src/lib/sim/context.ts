/**
 * src/lib/sim/context.ts
 *
 * `SimContext` — the parse-scope state that `parseNotation`'s seventeen closures
 * used to share by closing over it (gauge-round L3c, plan §3.1).
 *
 * ⚓ This is the thing that makes the rest of L3 possible. Nothing can move onto
 * the clock, or into a module, while it can only be reached from inside one
 * 2,675-line function body. The shape below is deliberately a FLAT MIRROR of
 * those locals — same names, same types — because the extraction's whole claim
 * is that it moved code without changing it, and a re-grouping at the same time
 * would make every call site a judgement call instead of a rename.
 *
 * ⚠️⚠️ EVERY CONTAINER HERE IS MUTATED IN PLACE AND SEVERAL ARE ALIASED
 * ELSEWHERE (L3 plan §1). `stanceWindowRecs` holds the very `cs.stance` objects
 * that extension dispatch and the swap clamp mutate; `castRecords[].ev` is the
 * live `CastEvent` the finalize pass stamps; `castIdByBar` and `summonByWindow`
 * are keyed by OBJECT IDENTITY. ⛔ Never hand a consumer a copy of one of these
 * to "keep it honest" — the aliasing IS the mechanism, and a copy typechecks.
 *
 * ⏭ `cursor` is NOT here. The rotation clock stays a local until L3d, where it
 * becomes the `Clock` — putting a bare number on the context first would mean
 * migrating the same field twice.
 */

import type { CharacterData } from '$lib/types/character';
import type { CastAbility, Condition, Element } from '$lib/types/ability';
import type { LoadoutEntry } from '$lib/stores';
import type { ActionEvent, CastEvent, TimelineEvent } from '$lib/utils/rotationEvents';
import type { IcdClock } from '$lib/utils/icd';
import type { HitEvent } from './hits';
import { type AuraState, createAuraState } from './aura';
import type { ProcListener } from './procs';
import type { CastKinds } from './states';
import type { ChainIndex } from './conditions';
import type { CharacterTrack, TimelineBar } from './types';
import type { HumanPadAfter, HumanTiming } from './humanTiming';
import {
	type CharState,
	createCharState,
	type StanceRecord,
	type SummonExtRecord
} from './charState';

/** A named-state window record, retained for the IR. `sourceCastId` XOR
 *  `sourceActionId` names its opener; `source` is set only when the state is
 *  `inStance` (the IR invariant — every inStance window knows its opener). */
export type StateWindowRec = {
	characterId: string;
	name: string;
	start: number;
	end: number;
	/** id of the opening `cast` event — absent on action-opened windows. */
	sourceCastId?: number;
	/** id of the opening `action` event (post-P4 #2 — plunge/normal-opened
	 *  transient states: Varesa Apex Drive, Durin's dark commit). At most
	 *  one of the two provenance ids is set. */
	sourceActionId?: number;
	/** Opening cast kind, for cast-opened transients. Required when the
	 *  transient's state is `inStance` (the IR invariant: every inStance
	 *  window knows its opener — Cyno's skill-opened 6s Pathclearer). */
	source?: 'skill' | 'burst';
	/** The spec's `onEnd`, carried on the record so the chain can be
	 *  materialised whenever the end becomes known (Lauma charged-forms round,
	 *  2026-09-16). Consumed once: the record leaves `CharState.pendingChains`
	 *  when its chained window is written. */
	onEnd?: { state: string; duration: number };
};

export type ShieldWindowRec = {
	characterId: string;
	source: 'skill' | 'burst';
	start: number;
	end: number;
	sourceCastId: number;
	label?: string;
	coveredBySummon?: true;
};

export type WeaponProcRec = { start: number; end: number; sourceCastId: number };

/**
 * ⚓ A GADGET: A THING A REACTION LEFT IN THE WORLD (Polestar-Field round,
 * 2026-09-01). A dendro core, a Starlight Prism — an entity with a lifetime
 * that belongs to NO character, which is why it cannot ride the summon lane
 * (`computeSummonSubrows` groups under the caster, and any party member's
 * reaction can make one of these).
 *
 * `end` is written when the world takes it back: a core eaten by a Hyperbloom
 * ends at the Hyperbloom. ⚠️ A record whose `end` is still absent at finalize
 * ran its nominal life — see `nominalEnd`.
 */
/**
 * A live `summonsFollowState` cast — the state the flip site needs to hand one
 * lineup off to the next. Everything here is fixed at the cast except
 * `variantLabel`, which is the CURRENT occupant and is rewritten on each flip.
 */
export type FollowStateCast = {
	castId: number;
	kind: 'skill' | 'burst';
	/** Token text as typed — `findSummonsForBar`'s input-match fallback wants it. */
	label: string;
	abilityId: string;
	ability: CastAbility;
	/** Where the FIRST occupant spawned; the shared window's start.
	 *  ⛔ The window's END is deliberately NOT stored — it is computed at the flip
	 *  from `extRec ?? castEvent`, the same "⚓ LIVE, never snapshot" rule the tick
	 *  chain's `endNow()` follows, so a duration extension moves the hand-off. */
	spawnAt: number;
	/** The occupant right now — `null` when the base ability's summons are out. */
	variantLabel: string | null;
	/** The cast's own condition inputs, replayed at the flip so a variant gated
	 *  on more than the toggled state still resolves the way the cast did. */
	preStates: ReadonlySet<string>;
	constellation: number;
	chainIdx: ChainIndex;
	stackState: Map<string, number>;
	castEvent: CastEvent;
	extRec: SummonExtRecord | undefined;
};

export type GadgetRec = {
	kind: 'core';
	/** Identity from the gauge, so a spawn and its end can be paired. */
	id: number;
	start: number;
	/** The end the gadget reaches untouched (FRAMES). */
	nominalEnd: number;
	/** Set when something took it early. */
	end?: number;
	endReason?: 'consumed' | 'popped';
};

/** An infusion granted by an `infuse` Effect (⚠️ a DIFFERENT mechanism from
 *  `NormalAbility.infusion`, which is a field on a stance's normal ability and
 *  needs no tracking — the stance IS the window). Windows are never truncated:
 *  in game an infusion runs its own clock on the receiver, and swapping away
 *  does not cancel it (⚓ Bennett's C6 infusion is famously still there when you
 *  swap back inside the 12s). */
export type InfusionWindow = {
	holderId: string;
	holderConstellation: number;
	/** `self` = the holder only; `active` = whoever is swinging. */
	receiver: 'self' | 'active';
	element: Element;
	start: number;
	end: number;
	conditions?: Condition;
};

/**
 * Team facts resolved ONCE per parse, before the first token.
 *
 * ⚠️ Two different rosters live here and they are not interchangeable. The SLOT
 * roster (`teamCharacters`, when the caller supplies one) is the truth for
 * team-wide mechanics — an enabler in slot 4 with zero casts still converts
 * every Superconduct, and the NB clock counts Natlan members who never appear in
 * the notation. `teamChars` (the characters actually named in the notation) is
 * the fallback for Node scripts and tests, and it is what per-holder condition
 * context is built from.
 */
export type TeamContext = {
	/** Distinct characters named in the notation, in first-appearance order. */
	teamChars: CharacterData[];
	/** ⚓ THE ROSTER every team fact is counted over (small-fix bundle,
	 *  2026-09-17): the slot roster when the caller supplied a non-empty one,
	 *  else `teamChars`. `teamEnabledReactions`, `teamFactionCounts` and the
	 *  per-holder element counts are all derived from THIS list — ⛔ never
	 *  rebuild one of them from `slotRoster` or `teamChars` downstream; finalize
	 *  used to, and a fifth name in the notation counted toward Nahida's Dendro
	 *  tally on one surface and not another. */
	rosterChars: CharacterData[];
	teamEnabledReactions: ReadonlySet<string>;
	teamFactionCounts: ReadonlyMap<string, number>;
	/** Per-holder element counts, holder excluded (mirrors the renderer). */
	teamElementCountsByHolder: Map<string, Map<Element, number>>;
	constellationByHolder: Map<string, number>;
	/**
	 * Does ANYONE on the team author an onHit gainStacks/consumeStacks effect?
	 *
	 * ⚠️ A guard, not a cache. Without an onHit consumer, drain anchors advance
	 * ONLY at cast sites — exactly as they did before the onHit wiring — so the
	 * flag keeps the settle at action sites from perturbing every other
	 * character's stack arithmetic.
	 */
	teamHasOnHitStackEffects: boolean;
	/** The caller's SLOT roster, when it supplied one. ⚠️ Preferred over
	 *  `teamChars` for TEAM-WIDE mechanics: a Stellar enabler in slot 4 with
	 *  zero casts still converts every Superconduct, and the NB clock counts
	 *  Natlan members who never appear in the notation. */
	slotRoster?: (CharacterData | null)[];
};

export type SimContext = {
	// ── inputs ────────────────────────────────────────────────────────────────
	swapF: number;
	/** Human timing (`$lib/sim/humanTiming.ts`); `null` = frame-perfect, the default. */
	humanTiming: HumanTiming | null;
	constellationLevels?: Record<string, number>;
	loadoutMap?: Record<string, LoadoutEntry>;
	team: TeamContext;

	// ── IR collectors ─────────────────────────────────────────────────────────
	/** Per-segment character tracks, in segment order. */
	tracks: CharacterTrack[];
	/** Tokens the parse could not recognise (the only warning channel on
	 *  `ParsedRotation`). */
	unknownTokens: string[];
	/** The single event stream, pushed in EMISSION order and sorted by time at
	 *  finalize. ⚠️ Emission order is what `id` records, and ids are visible in
	 *  the IR — see the differ's STRICT surface. */
	events: TimelineEvent[];
	/** Stable per-parse ids, assigned in emission order. */
	nextId(): number;

	/** Cast events with their owning track, in EMISSION order — the finalize
	 *  pass projects `track.eBars`/`track.qBars` from these (post-P4 #3, bars
	 *  are projections of casts). ⚠️ `ev` is the LIVE event: finalize stamps
	 *  extension uptimes onto it before the bars are built. */
	castRecords: { ev: CastEvent; track: CharacterTrack }[];
	/** Every human pad the run inserted, in emission order — projected by
	 *  finalize into `pad` input blocks on the track it landed in. ⚓ NOT an IR
	 *  event: a pad is not something that happened, it is time nobody used. The
	 *  `id` is minted from the event counter so a pad sorts between the action
	 *  it follows and the one it delays. */
	humanPads: {
		id: number;
		track: CharacterTrack;
		start: number;
		duration: number;
		after: HumanPadAfter;
	}[];
	/** Action events with their owning track, in emission order; the finalize
	 *  pass projects `track.inputBlocks` from these, grouped by `blockId`. */
	actionRecords: { ev: ActionEvent; track: CharacterTrack }[];
	/** Parser-private hit stream — one per E/Q cast and per N/CA/P swing, plus
	 *  the summon damage ticks synthesized at finalize. ⛔ NOT public IR. */
	hitRecords: HitEvent[];
	/** Projected bar → its opening cast's event id. ⚠️ Keyed by BAR OBJECT
	 *  IDENTITY (bars and casts are 1:1 by construction). */
	castIdByBar: Map<TimelineBar, number>;

	stanceWindowRecs: StanceRecord[];
	summonExtRecs: SummonExtRecord[];
	stateWindowRecs: StateWindowRec[];
	shieldWindowRecs: ShieldWindowRec[];
	/** Gadgets the gauge left in the world (dendro cores). ⚓ Written from the
	 *  gauge's own events rather than derived — a core's spawn is computable
	 *  from its Bloom but the instant a Hyperbloom EATS it is not. */
	gadgetRecs: GadgetRec[];
	weaponProcBars: Map<string, WeaponProcRec[]>;

	// ── per-character state ───────────────────────────────────────────────────
	charStates: Map<string, CharState>;
	getCharState(charId: string): CharState;
	/** Per-character cast events emitted so far — the mid-parse record
	 *  `computeCurrentStates` reads for duringSummon detection. */
	castsByChar: Map<string, CastEvent[]>;
	/** Incremental "has this character ever cast a skill / a burst" index over
	 *  `castsByChar`. ⚠️ Not a convenience — it is the guard that stops
	 *  `inferredStates` walking every cast for a kind the character has never
	 *  used, which was 76% of parse time before it existed (see states.ts). */
	castKindsByChar: Map<string, CastKinds>;
	/**
	 * E-charge queues, keyed by ABILITY id (not character id): stance characters
	 * keep independent charge queues per skill variant — Cyno's out-of-stance E
	 * (7.5s CD) shares no cooldown with his in-stance Mortuary Rite (3s CD), so
	 * folding this into `CharState` would wrongly merge them. The uncurated
	 * fallback keys by bare charId. Each value is a sorted array of "ready at"
	 * timestamps, one per charge.
	 */
	eChargeQueues: Map<string, number[]>;

	// ── world state ───────────────────────────────────────────────────────────
	/**
	 * The rotation-wide aura. ⚓ THE FIELD L5 REPLACES: today it is a set of
	 * flags with no decay and no units (`$lib/sim/aura.ts`); the gauge engine
	 * takes its place, and this is the one field that changes type when it does.
	 * Persists across segments — once applied, an aura sticks until a reaction
	 * consumes it.
	 */
	aura: AuraState;
	/** Elemental-application ICD clocks, keyed `${characterId}:${icdTag}`, and —
	 *  since L5e-b — `${characterId}:summon:${label}` for a summon's tick series.
	 *  Rotation-wide like the aura: a swap-out neither resets nor freezes one.
	 *  ⚓ A summon's counter is ITS OWN and is shared with nothing, which is what
	 *  the isolated gcsim capture measures. ⛔ Never fold a summon onto its
	 *  caster's normal-attack clock. */
	icdClocks: Map<string, IcdClock>;
	/** When each character most recently went off-field, FRAMES (gauge round
	 *  L5e-b). Written as a segment OPENS, so it is the live answer to the
	 *  question finalize answers by scanning forward through `tracks`.
	 *
	 *  ⚓ "Most recently" and finalize's "FIRST swap-out after the spawn" agree
	 *  wherever it matters, because a tick chain checks liveness at every fire
	 *  and therefore DIES at the first violation — it can never survive to see a
	 *  later swap-out and mistake it for the first. ⚠️ That equivalence is a
	 *  property of the chaining (L5e §2), not of this map; ⛔ don't reuse it
	 *  somewhere that reads the value once. */
	lastSwapOutAt: Map<string, number>;
	/** Generation per `${characterId}::${summonLabel}` — bumped when a summon
	 *  that declares `terminatesOn: 'recast'` respawns (gauge round L5e-b). A
	 *  running tick chain compares its captured generation on every fire and
	 *  stops when it no longer matches, which is how a recast truncates the
	 *  chain without anything having to CANCEL a scheduled task.
	 *
	 *  ⚓ The generation-stamp pattern `gauge.ts` already uses for its EC and
	 *  Burning chains, for the identical reason: a superseded chain must not be
	 *  able to act after the thing that superseded it.
	 *  ⚠️ Bumped ONLY for a recast-terminating summon, mirroring finalize —
	 *  a summon without the flag spawning twice leaves both windows alive. */
	summonChainGen: Map<string, number>;
	/**
	 * `${characterId}::${summonLabel}#${generation}` → the instant the NEXT
	 * generation SPAWNS, i.e. where finalize cuts this generation's window.
	 *
	 * ⚓ The generation is bumped when the superseding cast is SCHEDULED, which is
	 * its cast start — but finalize truncates the prior window at the new spawn
	 * (`prev.end = spawnAt`), and a summon with a spawn delay leaves a gap between
	 * the two. A tick of the old chain inside that gap drew a marker (the window
	 * still covered it) and applied nothing (the chain was already retired):
	 * Ineffa's `E Q` put a Birgitta tick at 1.83s on screen with no Electro behind
	 * it, because her burst re-summons Birgitta 111f after the cast (essential-
	 * characters T0, 2026-09-15). A fire therefore stays live until this instant.
	 * ⛔ Don't move the bump itself to the spawn — the proc listener and the
	 * lineup hand-off read the generation at the cast, and the new chain has to
	 * know its own number when it is scheduled.
	 */
	summonChainSupersededAt: Map<string, number>;
	/**
	 * ⚓⚓ THE PARSE RECORDS WHERE A CAST'S LINEUP CHANGED; FINALIZE CUTS THE
	 * WINDOW ON IT (Arkhe round, 2026-09-04). Keyed by the opening cast's event
	 * id. An entry says "from `at`, this cast's summon is the one its `variantLabel`
	 * resolves to" — Furina's Charged Attack flipping her Arkhe mid-Salon.
	 *
	 * ⚓ It is a RECORD, not a derivation, for the reason the tick markers are:
	 * the choice needs the character's state at an instant inside the window, and
	 * finalize has no state left to ask. The same law as `TimelineWindow.ticks`
	 * and the coordinated-attack round's fire times — the parse publishes, the
	 * projection does not guess.
	 */
	lineupChanges: Map<number, { at: number; variantLabel: string | null }[]>;
	/**
	 * The live `summonsFollowState` cast each character is currently holding open,
	 * carrying everything the flip site needs to end one chain and start another.
	 * ⚠️ At most ONE per character: a second cast of the same ability re-opens the
	 * window rather than running two, and no character has two such abilities.
	 * Cleared by nothing — a stale entry is rejected by its own `sharedEnd`.
	 */
	followStateCasts: Map<string, FollowStateCast>;
	/** Timed elemental infusions granted by `infuse` Effects. */
	infusionWindows: InfusionWindow[];
	/** When each `infuse` Effect last opened a window, for its `procCooldown`
	 *  (Emilie C6: 5s after E or Q, once per 12s). Keyed by the authored effect
	 *  OBJECT — a character is in the team at most once, so identity is enough. */
	infusionProcAt: Map<object, number>;
	/**
	 * Armed off-field damage-proc listeners — the FOURTH application source
	 * (mark-triggered round, 2026-08-17; joined by `onHit` and
	 * `whileNormalAttacking` in the coordinated-attack round, 2026-08-18).
	 * ⚓ Keyed by the ENTITY that hosts the listener (`holder::host::index`), never
	 * by the authored effect object: Fischl's A4 is authored on BOTH Ozes and
	 * there is only ever one Oz, so the two copies must share one record and one
	 * proc cooldown. Iteration order is arming order, which is what makes dispatch
	 * deterministic. ⚓ ONE map for all three trigger kinds — the bookkeeping is
	 * identical and only the selection predicate differs. See `procs.ts`.
	 */
	procs: Map<string, ProcListener>;
	/**
	 * Wave/proc landings measured by the parse, keyed
	 * `characterId::label::source::spawnAt` — the summon-window markers the
	 * PROJECTION cannot derive (coordinated-attack round).
	 *
	 * ⚓ `collectSummonTicks` walks a fixed cadence, which is what makes a drawn
	 * marker and a fired hit the same thing. A state-gated wave has no cadence to
	 * walk, so the one producer records here and finalize stamps
	 * `TimelineWindow.ticks`. ⛔ Never teach the projection to guess.
	 */
	stateGatedTicks: Map<string, number[]>;
	/**
	 * The stack snapshot a summon tick dispatched against, keyed
	 * `characterId::label::time` (summon-tick stacks round, 2026-08-31).
	 *
	 * ⚓⚓ THE LIVE CHAIN DISPATCHES THE TICK; FINALIZE STAMPS ITS SNAPSHOT ONTO THE
	 * SYNTHESIZED HIT. The two walks are required to agree already (`tickCapOf` is
	 * read by both), and the join is the one this file's `stateGatedTicks` already
	 * uses — an integer-frame time under a character and a summon label.
	 *
	 * ⚠️⚠️ WITHOUT IT A STACK-GATED BUFF DRAWS ON EVERY TICK. `deriveBuffWindows`
	 * drops an effect only on a DEFINITIVE false, and a `stacks` Condition with no
	 * map to read is unresolvable, not false — so an un-stamped tick hit would
	 * hand Alyosha a permanent Hunter's Precision bar rather than the one
	 * activation the mark pays for.
	 *
	 * Post-gain, pre-consume, exactly like `HitEvent.stacks` everywhere else.
	 */
	tickStacks: Map<string, ReadonlyMap<string, number>>;
	/**
	 * Whose segment the clock is currently inside, or `undefined` before the
	 * first. ⚓ Written where a segment OPENS, which is exactly where the clock
	 * already stands at the boundary — so a task firing mid-segment reads the
	 * character who is actually on field, not the one who cast it.
	 *
	 * ⚠️ Its ONE reader is `onReaction`'s `source: 'active'`, and it answers only
	 * half of that question: an application delivered by a summon or a proc
	 * carries its owner's id and must be refused even when the owner IS active
	 * (`ReactionSource.viaEntity`).
	 */
	activeCharId?: string;
};

export type SimContextInput = {
	swapF: number;
	humanTiming?: HumanTiming | null;
	constellationLevels?: Record<string, number>;
	loadoutMap?: Record<string, LoadoutEntry>;
	team: TeamContext;
};

export function createSimContext(input: SimContextInput): SimContext {
	const charStates = new Map<string, CharState>();
	let nextEventId = 0;
	return {
		swapF: input.swapF,
		humanTiming: input.humanTiming ?? null,
		constellationLevels: input.constellationLevels,
		loadoutMap: input.loadoutMap,
		team: input.team,

		tracks: [],
		unknownTokens: [],
		events: [],
		castRecords: [],
		humanPads: [],
		actionRecords: [],
		hitRecords: [],
		castIdByBar: new Map(),
		nextId: () => nextEventId++,

		stanceWindowRecs: [],
		summonExtRecs: [],
		stateWindowRecs: [],
		shieldWindowRecs: [],
		gadgetRecs: [],
		weaponProcBars: new Map(),

		charStates,
		getCharState(charId) {
			let cs = charStates.get(charId);
			if (!cs) {
				cs = createCharState();
				charStates.set(charId, cs);
			}
			return cs;
		},
		castsByChar: new Map(),
		castKindsByChar: new Map(),
		eChargeQueues: new Map(),

		aura: createAuraState(),
		icdClocks: new Map(),
		lastSwapOutAt: new Map(),
		summonChainGen: new Map(),
		summonChainSupersededAt: new Map(),
		lineupChanges: new Map(),
		followStateCasts: new Map(),
		infusionWindows: [],
		infusionProcAt: new Map(),
		procs: new Map(),
		stateGatedTicks: new Map(),
		tickStacks: new Map()
	};
}
