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
import type { Condition, Element } from '$lib/types/ability';
import type { LoadoutEntry } from '$lib/stores';
import type { CastEvent, TimelineEvent } from '$lib/utils/rotationEvents';
import type { IcdClock } from '$lib/utils/icd';
import { type AuraState, createAuraState } from './aura';
import type { CastKinds } from './states';
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
	/** ≥2 Moonsign members — enables `lunarCrystallize` emission on geo casts. */
	hasMoonsignTeam: boolean;
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
};

export type SimContext = {
	// ── inputs ────────────────────────────────────────────────────────────────
	swapF: number;
	constellationLevels?: Record<string, number>;
	loadoutMap?: Record<string, LoadoutEntry>;
	team: TeamContext;

	// ── IR collectors ─────────────────────────────────────────────────────────
	/** The single event stream, pushed in EMISSION order and sorted by time at
	 *  finalize. ⚠️ Emission order is what `id` records, and ids are visible in
	 *  the IR — see the differ's STRICT surface. */
	events: TimelineEvent[];
	/** Stable per-parse ids, assigned in emission order. */
	nextId(): number;

	stanceWindowRecs: StanceRecord[];
	summonExtRecs: SummonExtRecord[];
	stateWindowRecs: StateWindowRec[];
	shieldWindowRecs: ShieldWindowRec[];
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
	/** Elemental-application ICD clocks, keyed `${characterId}:${icdTag}`.
	 *  Rotation-wide like the aura: a swap-out neither resets nor freezes one. */
	icdClocks: Map<string, IcdClock>;
	/** Timed elemental infusions granted by `infuse` Effects. */
	infusionWindows: InfusionWindow[];
};

export type SimContextInput = {
	swapF: number;
	constellationLevels?: Record<string, number>;
	loadoutMap?: Record<string, LoadoutEntry>;
	team: TeamContext;
};

export function createSimContext(input: SimContextInput): SimContext {
	const charStates = new Map<string, CharState>();
	let nextEventId = 0;
	return {
		swapF: input.swapF,
		constellationLevels: input.constellationLevels,
		loadoutMap: input.loadoutMap,
		team: input.team,

		events: [],
		nextId: () => nextEventId++,

		stanceWindowRecs: [],
		summonExtRecs: [],
		stateWindowRecs: [],
		shieldWindowRecs: [],
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
		infusionWindows: []
	};
}
