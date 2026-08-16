/**
 * src/lib/utils/notationParser.ts
 *
 * KQM-aligned rotation notation parser. Produces timeline track data from a
 * notation string like:
 *   Bennett Q > Kazuha hE P > Xiangling Q E > Fischl E N1 N2 ~2s
 *
 * Time model:
 *   ⚓ THE CLOCK IS INTEGER FRAMES AT 60fps, and so is every time field on the
 *   IR (gauge-round.md contract C1). Authored SECONDS are converted at the read
 *   site by `framesOf`, which is the one rounding in the system; seconds come
 *   back only at presentation, where a bare `/ 60` is self-evidently a display.
 *   ⛔ Don't reintroduce a seconds value here to "make a site readable" — the
 *   whole benefit is that a number in this file needs no unit asked of it.
 *
 *   - All Q/E bars for a character start at a local cursor that begins at
 *     that character's active-start.
 *   - Q advances the local cursor by Q_CAST_F, E by E_CAST_F.
 *   - ~Xs advances the cursor by X seconds, rounded to frames on the way in.
 *   - ~?s is a placeholder meaning "duration unset" — advances by MIN_ACTIVE_F
 *     and flags the track so the renderer can show a visual warning.
 *   - Swapping costs swapFrames before the next character starts.
 *   - ( ) marks optional actions (KQM-compatible); contents are label tokens
 *     rendered with lower opacity.
 *   - [ ] bracket groups (e.g. [N2D]x3) are preserved as label tokens.
 */

import type { CharacterData } from '$lib/types/character';
import type {
	Ability,
	ActionKey,
	Element,
	NormalAbility,
	NormalHit,
	SkillAbility,
	Summon
} from '$lib/types/ability';
import {
	getDefaultDamageTag,
	getNormalHitDamageTag,
	getCooldownStartsAtStanceEnd
} from '$lib/types/ability';
import { tokenizeNotation, STACK_ASSERT_RE, type Token } from '$lib/utils/tokenizer';
import { resolveActionElement } from '$lib/utils/actionElement';
import { computeTeamEnabledReactions, computeTeamFactionCounts } from '$lib/utils/teamComposition';
import { FPS, framesOf } from '$lib/utils/frames';
import { GENERIC_NORMAL_HITS, GENERIC_SKILL, GENERIC_BURST } from '$lib/data/genericProfile';
import type { LoadoutEntry } from '$lib/stores';
import type {
	ActionEvent,
	CastEvent,
	ReactionEvent,
	TimelineEvent,
	TimelineWindow
} from '$lib/utils/rotationEvents';
import { deriveBuffWindows } from '$lib/utils/buffWindows';
import { createSimContext } from '$lib/sim/context';
import { matchVariant, resolveEffectiveCharges, type ConditionContext } from '$lib/sim/conditions';
import {
	resolveAbilityTiming,
	resolveActiveAbility,
	resolveChargeCastTime,
	resolveEQCastTime,
	resolveNormalCastTime,
	resolveStanceFields
} from '$lib/sim/resolve';
import { expandBrackets, peekActionKey } from '$lib/sim/tokens';
import type { HitEvent } from '$lib/sim/hits';
import {
	dispatchConsumeStacks,
	dispatchConsumeStacksOnHit,
	dispatchGainStacks,
	dispatchGainStacksOnHit,
	syncOnHitToStackState,
	syncOnReactionToStackState,
	syncSourceLifetimeToStackState
} from '$lib/sim/stacks';
import { dispatchOnCastExtensions } from '$lib/sim/extensions';
import { dispatchShieldEnds, registerShieldOnCast } from '$lib/sim/shields';
import { infusionAt, registerInfusionsOnCast } from '$lib/sim/infusions';
import {
	advanceChain,
	getChainIndexMap,
	getCharacterCdResetTargets,
	getWeaponCdResetCooldown
} from '$lib/sim/cooldowns';
import { emitReactionsAtCast, emitReactionsAtSwing } from '$lib/sim/aura';
import {
	castKinds,
	closeStateWindows,
	holderStatesAt,
	inferredStates,
	openTransientState
} from '$lib/sim/states';
import { computeSummonDamageTicks, findSummonsForBar, summonSpan } from '$lib/sim/summons';

// Re-export the IR surface so consumers can import event/window types straight
// from the parser module they already depend on.
export type {
	TimelineEvent,
	TimelineWindow,
	CastEvent,
	ReactionEvent,
	ShieldEndEvent,
	NightsoulBurstEvent
} from '$lib/utils/rotationEvents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-track E/Q bar. Post-P4 #3: a pure PROJECTION of a `cast` event —
 *  built at finalize from the event's geometric fields (1:1, field-equal).
 *  Kept as the renderer's per-track iteration surface; the cast event is
 *  the source of truth. */
export type TimelineBar = {
	start: number; // frames
	uptime: number; // frames (0 = instant)
	cooldown: number; // frames
	label: string; // notation token displayed on the bar (e.g. "Q", "hE")
	castTime: number; // frames — duration of the cast animation (used for active-bar overlay)
	/** Absolute time this cast's clock is mechanically ready again (mirrors
	 *  `CastEvent.readyAt`). The ghost-CD tail ENDS here.
	 *
	 *  ⚠️ CARRIED ON THE BAR BECAUSE THE PILL GEOMETRY NEEDS IT, and carried as
	 *  `readyAt` rather than the raw `cooldownStartDelay` deliberately: readyAt
	 *  is the authoritative "when can this be cast again", so a future dynamic
	 *  cooldown start (a stance whose exit is what starts the clock) moves the
	 *  tail for free instead of needing the geometry taught a second rule.
	 *
	 *  ↻ 2026-08-15: `barPhases` read `cooldown` alone before this and drew the
	 *  tail ending at `start + cooldown`. That divergence WAS documented as
	 *  intentional on `CastEvent.readyAt` ("the visual ghost tail"), and it is
	 *  invisible at the 1–35 frame delays 122 of the 124 delayed abilities
	 *  carry — but on the two that encode "the CD starts when the STANCE ends"
	 *  (Xilonen 540f, Ifa 600f) it is a 9–10 second lie that also flips the pill
	 *  into case B, whose meaning is the exact opposite: "cooldown finished,
	 *  stance still running". ⚓ Nate read it that way and asked why the recast
	 *  was so late — which is the whole argument against the old choice. */
	readyAt?: number;
	/** id of the RESOLVED ability actually cast (mirrors CastEvent.abilityId).
	 *  Disambiguates summon resolution when a state-gated sibling ability
	 *  shares the input token (Durin's dual-form bursts, post-P4 #2). */
	abilityId?: string;
	/** Frames (60fps) from cast start until the summon becomes active. 0 when absent.
	 *  Mirrors persistent-behavior summonActivatesAt; carried on the bar so the
	 *  renderer and duringSummon detection don't need to re-query the ability. */
	summonActivatesAt?: number;
	/** True when a Sacrificial-series proc fired on this cast, resetting the CD to 0.
	 *  The renderer uses this to draw the entire bar as a dim+bordered "available" style
	 *  instead of the usual opaque uptime + ghost CD split. */
	sacProcFired?: boolean;
	/** Snapshot of the per-character stack state at this cast's moment. Lets the
	 *  timeline filter stack-gated effects per-cast instead of unconditionally.
	 *  Absent when no stacks have been asserted in the current segment. */
	stackContext?: ReadonlyMap<string, number>;
};

export type InputBlockKind =
	| 'normal'
	| 'elemental-normal'
	| 'skill'
	| 'burst'
	| 'movement'
	| 'unset';

/** A discrete per-input building block in the active row. */
export type InputBlock = {
	start: number; // frames — absolute timeline position
	duration: number; // frames — block width
	parts: string[]; // display labels e.g. ["N5"], ["Q"], ["hE"]
	kind: InputBlockKind;
	/** The element this input LANDED with, when it landed with one — which is
	 *  not always the character's own. ⚠️ `kind: 'elemental-normal'` says only
	 *  THAT a swing was elemental; a renderer that tints from the track's
	 *  element paints a Bennett-infused Xingqiu N in hydro (2026-08-15). Absent
	 *  on physical inputs, on movement, and on E/Q blocks (a cast always carries
	 *  the caster's element, so the track answers for those). */
	element?: Element;
};

export type CharacterTrack = {
	characterId: string;
	displayName: string;
	element: string;
	activeStart: number; // frames
	activeEnd: number; // frames
	/** Per-input building blocks in the active row, chronological order. */
	inputBlocks: InputBlock[];
	hasUnsetDuration: boolean; // true when ~?s was encountered
	eBars: TimelineBar[];
	qBars: TimelineBar[];
};

export type WeaponProcBar = { start: number; end: number };

// ⚓ `HitEvent` and the shared onHit trigger gate MOVED to `$lib/sim/hits.ts`
// (L3c). Both are re-exported: `buffWindows.ts` imports them from here.
export { onHitTriggerMatches } from '$lib/sim/hits';
export type { HitEvent } from '$lib/sim/hits';

export type ParsedRotation = {
	tracks: CharacterTrack[];
	totalDuration: number;
	unknownTokens: string[]; // tokens not recognized as valid notation
	/** P4 IR — time-sorted point events (`cast` / `action` / `reaction` /
	 *  `shieldEnd` / `nightsoulBurst`). The sole event surface: cast markers
	 *  drive the timeline rows, `action` events carry the per-swing input
	 *  substrate (post-P4 #2), the reaction/shieldEnd kinds feed effect
	 *  dispatch, and NB events drive the Nightsoul-Burst lane + its
	 *  onTeamNightsoulBurst consumers (post-P4 #5 arc, phase 3). */
	events: TimelineEvent[];
	/** P4 IR — span records with FINAL end times (`stance` / `state` /
	 *  `summon` / `shield` / `weaponProc`). Extensions and swap/recast
	 *  truncations are already applied; consumers never re-derive window ends
	 *  from bar geometry (weapon-proc rows, summon subrows, stance/state
	 *  overlays all project these spans). */
	windows: TimelineWindow[];
};

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

/** Global dash/jump duration approximation (60fps). Character-specific values deferred. */
const DASH_FRAMES = 21;
/** Fallback cast time when no E/Q frame data is present on the ability (FRAMES).
 *  Sourced from the data-derived generic profile (genericProfile.ts) so a
 *  frameless skill/burst gets a realistic cast length, not a magic constant. */
const E_CAST_F = GENERIC_SKILL.castSwap;
const Q_CAST_F = GENERIC_BURST.castSwap;
/** Minimum on-field time when no ~Xs is specified — 0.5s at 60fps. */
const MIN_ACTIVE_F = 30;
/** Fallback cooldowns for an uncurated character with no ability data at all. */
const FALLBACK_SKILL_CD_F = framesOf(GENERIC_SKILL.cooldown);
const FALLBACK_BURST_CD_F = framesOf(GENERIC_BURST.cooldown);

/**
 * Ceiling on a single `~Xs` time advance, expressed in FRAMES.
 *
 * ⚠️ This guard was missing entirely: the site read `if (isFinite(delta))` and
 * nothing else, so `Ifa ~99999999s` — FOURTEEN typed characters — parsed happily
 * in 2.5 ms, reported no unknown tokens, and handed a 99,999,999-second duration
 * to a ruler that allocates one tick object per second. That OOM-ed the tab.
 * (docs/parser-hardening-2026-08-14.md §1.)
 *
 * One hour is far past any real rotation — the longest are minutes — while still
 * leaving room for someone deliberately modelling a long wait. ⚠️ It is a
 * per-token ceiling, so it does NOT bound total duration on its own: a document
 * full of small waits still sums. `rulerTicks` in RotationTimeline carries its
 * own independent cap for that, and both are needed.
 *
 * ⚠️ Written as `3600 * FPS` rather than 216000 so the hour it means stays
 * legible — and so C6's frame-loop cap derives from this one expression instead
 * of a second magic number that can drift away from it.
 */
const MAX_TIME_ADVANCE_F = 3600 * FPS;

// ---------------------------------------------------------------------------
// Condition + modifier helpers — MOVED to `$lib/sim/conditions.ts` (L3c).
// ---------------------------------------------------------------------------
//
// Re-exported here so no consumer's import statement changes: eight modules
// import `evalCondition` from this file, and `ChainIndex` / `ConditionContext`
// are part of its published type surface.
export {
	evalCondition,
	findChainStage,
	DEFAULT_ASCENSION,
	type ChainIndex,
	type ConditionContext
} from '$lib/sim/conditions';

// ---------------------------------------------------------------------------
// Named-state resolution — MOVED to `$lib/sim/states.ts` (L3c).
// ---------------------------------------------------------------------------

// ⚓ Resolution (`$lib/sim/resolve.ts`) and token shaping (`$lib/sim/tokens.ts`)
// moved out at L3c. Neither was ever imported from outside this file, so there
// is nothing to re-export.

// ---------------------------------------------------------------------------
// cdReset helpers — MOVED to `$lib/sim/cooldowns.ts` (L3c), beside the chain
// bookkeeping: both are the parser's cooldown-clock feedback edges (F4 / F1).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Summon resolution — MOVED to `$lib/sim/summons.ts` (L3c). `computeSummonTicks`
// is re-exported: `summonSubrows.ts` imports it from here (and, since this
// landing, `findSummonsForBar` too — the duplicated `findCastSummons` is gone).
// ---------------------------------------------------------------------------
export { computeSummonTicks } from '$lib/sim/summons';

// ---------------------------------------------------------------------------
// Stack machinery — MOVED to `$lib/sim/stacks.ts` (L3c). Parser-private; no
// consumer outside this file ever imported it.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The coarse aura model + synthetic reaction emission — MOVED to
// `$lib/sim/aura.ts` (L3c). ⚓ That module is the seam L5 replaces with the real
// gauge; the interface it exposes is already the shape `simulateGauge` wants.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseNotation(
	notation: string,
	lookupChar: (name: string) => CharacterData | null,
	swapFrames = 8,
	constellationLevels?: Record<string, number>,
	loadoutMap?: Record<string, LoadoutEntry>,
	teamCharacters?: (CharacterData | null)[]
): ParsedRotation {
	const swapF = swapFrames;
	const raw = notation.trim();
	if (!raw)
		return {
			tracks: [],
			totalDuration: 0,
			unknownTokens: [],
			events: [],
			windows: []
		};

	// Tokenize the full string, then group into segments by separator tokens.
	const allTokens = tokenizeNotation(raw);

	const segments: (typeof allTokens)[] = [];
	let current: typeof allTokens = [];
	for (const tok of allTokens) {
		if (tok.kind === 'separator') {
			if (current.length > 0) segments.push(current);
			current = [];
		} else {
			current.push(tok);
		}
	}
	if (current.length > 0) segments.push(current);

	const tracks: CharacterTrack[] = [];
	const unknownTokens: string[] = [];

	// ── Team facts, resolved once before the first token (L3c: hoisted above the
	//    context so `createSimContext` can take them; the computation itself is
	//    unchanged and depends only on `segments` and the caller's arguments).

	// Compute team Moonsign membership once: 2+ Moonsign chars enables
	// `lunarCrystallize` emission on geo casts (per Linnea/Lauma/Flins family
	// of effects). Walks all unique character IDs across segments.
	const seenChars = new Set<string>();
	const teamChars: CharacterData[] = [];
	let moonsignCount = 0;
	for (const seg of segments) {
		const charTok = seg[0];
		if (!charTok || charTok.kind !== 'character') continue;
		const c = lookupChar(charTok.text);
		if (!c) continue;
		if (seenChars.has(c.id)) continue;
		seenChars.add(c.id);
		teamChars.push(c);
		if ((c.factions ?? []).includes('moonsign')) moonsignCount++;
	}
	const hasMoonsignTeam = moonsignCount >= 2;

	// Reactions the party enables (Stellar model). Prefers the SLOT roster:
	// an enabler's mere presence in the party converts the base reaction
	// (Sandrone in slot 4 with zero casts still turns every Superconduct into
	// Stellar-Conduct), so the segment roster is only the no-slots fallback.
	const teamEnabledReactions = teamCharacters
		? computeTeamEnabledReactions(teamCharacters)
		: computeTeamEnabledReactions(teamChars);

	// Shared holder-constellation map for the onHit dispatchers (the reaction
	// dispatch sites build theirs inline per fire — left untouched).
	const constellationByHolder = new Map(
		teamChars.map((c) => [c.id, constellationLevels?.[c.id] ?? 0])
	);

	// Team-level pre-check: hit STACK dispatch (and the drain/lifetime settle
	// it requires at action sites) only runs when someone on the team actually
	// authors an onHit gainStacks/consumeStacks. Guards corpus-wide float
	// identity of drain settling — without an onHit consumer, drain anchors
	// advance ONLY at cast sites, exactly as before the wiring.
	const teamHasOnHitStackEffects = teamChars.some((c) =>
		[...c.abilities, ...(c.passives ?? []), ...(c.constellations ?? [])].some((src) =>
			(src.effects ?? []).some(
				(fx) =>
					(fx.type === 'gainStacks' || fx.type === 'consumeStacks') && fx.trigger.type === 'onHit'
			)
		)
	);

	// Team context for variant-condition resolution (sQ primitive): lets
	// `teamFaction` / `teamElementCount` conditions on ability VARIANTS resolve
	// definitively parser-side (Varka Four Winds' Ascension needs an elemental
	// teammate). Mirrors the renderer's per-holder maps: faction counts are
	// whole-team, element counts exclude the holder.
	const teamFactionCounts = computeTeamFactionCounts(teamChars);
	const teamElementCountsByHolder = new Map<string, Map<Element, number>>();
	for (const holder of teamChars) {
		const counts = new Map<Element, number>();
		for (const other of teamChars) {
			if (other.id === holder.id || !other.element) continue;
			counts.set(other.element, (counts.get(other.element) ?? 0) + 1);
		}
		teamElementCountsByHolder.set(holder.id, counts);
	}

	// ── The sim context: every container the dispatchers share (L3c). Held as
	//    one object so an extracted family can reach the state it mutates; the
	//    locals below are destructured aliases, so the body reads unchanged.
	//    ⚠️ Aliases, not copies — see the warning on SimContext.
	const ctx = createSimContext({
		swapF,
		constellationLevels,
		loadoutMap,
		team: {
			teamChars,
			hasMoonsignTeam,
			teamEnabledReactions,
			teamFactionCounts,
			teamElementCountsByHolder,
			constellationByHolder,
			teamHasOnHitStackEffects
		}
	});

	// P4 IR — the single event stream. `cast` events are pushed at each E/Q bar
	// push; `reaction`/`shieldEnd` events are emitted at their sites.
	// Sorted by time before return. Stable per-parse ids come from `ctx.nextId()`,
	// assigned in emission order (deterministic for a given notation); window
	// records capture the opening cast's id as their `sourceCastId` provenance.
	const events = ctx.events;

	// P4 IR — window-record collectors. Each grows a mutable record during
	// parsing (extensions move `end`, swap-close clamps it); the finalize pass
	// converts them to `TimelineWindow`s. Kept separate from the CharState maps
	// (which are replaced per cast) so EVERY opened window is retained.
	const { stanceWindowRecs, summonExtRecs, stateWindowRecs, shieldWindowRecs } = ctx;

	// Post-P4 #3: bars are PROJECTIONS of cast events, built at finalize. Each
	// cast records its owning track here (in emission order); the finalize pass
	// projects `track.eBars`/`track.qBars` from these records after the
	// extension uptime stamps land on the events.
	const castRecords: { ev: CastEvent; track: CharacterTrack }[] = [];
	// Post-P4 #2: action events (normal/charged/plunge/dash/jump/unset) with
	// their owning track, in emission order. The finalize pass projects
	// `track.inputBlocks` from these records (grouped by `blockId`) together
	// with the cast records.
	const actionRecords: { ev: ActionEvent; track: CharacterTrack }[] = [];
	// Parser-private hit stream (onHit wiring, 2026-07-17): one record per E/Q
	// cast + per normal swing / charged / plunge action, in emission order.
	// Consumed by the buff-window derivation pass at finalize; NOT public IR.
	const hitRecords: HitEvent[] = [];
	// Per-character cast events emitted so far — the mid-parse record that
	// `computeCurrentStates` reads for duringSummon detection (replaces the old
	// prevBars/track-bars walk).
	const castsByChar = ctx.castsByChar;
	// Provenance for the finalize summon-window pass: each projected bar's
	// opening `cast` event id (bars and casts are 1:1 by construction).
	const castIdByBar = new Map<TimelineBar, number>();
	// Per-character parser state, created lazily. Folds together the formerly-
	// parallel Map<charId, …>s (cooldown clocks, stance window, named states,
	// chains, shields, summon extensions, and the rotation-wide stack
	// accumulators) so a single lookup yields all of a character's mutable
	// parser state. Persists across segments (cross-segment cooldown / stance /
	// shield-end / drain tracking). See the CharState decl for per-field scope.
	const getCharState = ctx.getCharState;
	let cursor = 0; // rotation clock (FRAMES — see the time model in the header)

	// E-charge queues (keyed by ABILITY id — see the SimContext field) and the
	// weapon cdReset (Sacrificial series) output: accumulated proc-ICD windows
	// per character for timeline rendering, with the proccing cast's id for IR
	// provenance. The proc-ready clock lives on cs.sacProcReadyAt.
	const { eChargeQueues, weaponProcBars } = ctx;

	// ⚓ Chain-stage bookkeeping MOVED to `$lib/sim/cooldowns.ts` (L3c).

	// ⚓ durationExtensions dispatch (feedback edge F2) MOVED to
	// `$lib/sim/extensions.ts` (L3c).

	// ⚓ Shield registration + the shieldEnd drain MOVED to `$lib/sim/shields.ts`
	// (L3c).

	/** Apply continuous-rate stack drain (E3 v2) for every gainStacks key on
	 *  `char` that declares a `drain` spec. Called immediately before each cast
	 *  resolves abilities/effects so that reads of `stackState` see decayed
	 *  values. Two regimes:
	 *
	 *  - **State active at `cursor`**: decay = `ratePerSecond × (cursor - last)`,
	 *    clamped to 0; `last` advances to `cursor`. The first time a state-active
	 *    cast happens with `last` undefined, no decay is applied — the anchor is
	 *    seeded later by `dispatchGainStacks` (which sets `last = castTime` when
	 *    a drain-bearing grant fires) or here on the next cast (after seeding).
	 *  - **State inactive at `cursor`**: settle decay up to the state's recorded
	 *    end time (`stanceWindows` for `inStance`, `stateWindows` otherwise) so
	 *    post-state snapshots reflect the value the resource drained to before
	 *    the state expired. Then clear the anchor; future state-reopen casts
	 *    re-seed via the next dispatchGainStacks. */
	const applyDrain = (
		char: CharacterData,
		cursor: number,
		currentStates: ReadonlySet<string>,
		stackState: Map<string, number>
	): void => {
		const cs = getCharState(char.id);
		const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
		const seenKeys = new Set<string>();
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.type !== 'gainStacks') continue;
				if (!fx.drain) continue;
				if (seenKeys.has(fx.key)) continue; // first drain spec per key wins
				seenKeys.add(fx.key);
				const charAnchors = cs.drainAnchors;
				const last = charAnchors.get(fx.key);
				// ⚠️⚠️ `ratePerSecond` IS A RATE, NOT A DURATION — ⛔ do not run it
				// through `framesOf`. `elapsed` is frames (C1), so the seconds the
				// rate is quoted against have to come back out of the elapsed side.
				// Skirk's Serpent's Subtlety drains 7/sec; miss this and she drains
				// 420/sec and the resource is gone by the next token.
				const perFrame = fx.drain.ratePerSecond / FPS;
				if (currentStates.has(fx.drain.state)) {
					if (last !== undefined) {
						const elapsed = cursor - last;
						if (elapsed > 0) {
							const current = stackState.get(fx.key) ?? 0;
							const decayed = Math.max(0, current - perFrame * elapsed);
							stackState.set(fx.key, decayed);
						}
					}
					charAnchors.set(fx.key, cursor);
				} else if (last !== undefined) {
					const stateEnd =
						fx.drain.state === 'inStance' ? cs.stance?.end : cs.states.get(fx.drain.state);
					if (stateEnd !== undefined && stateEnd > last) {
						const elapsed = stateEnd - last;
						const current = stackState.get(fx.key) ?? 0;
						const decayed = Math.max(0, current - perFrame * elapsed);
						stackState.set(fx.key, decayed);
					}
					charAnchors.delete(fx.key);
				}
			}
		}
	};

	/** Apply per-stack lifetime expiry (E3 v2.x) for every gainStacks key on
	 *  `char` that declares a `lifetime` spec. Drops instances whose expiry
	 *  time has passed and updates `stackState[key]` to the remaining count.
	 *  Lazy: only runs at cast events (mirroring `applyDrain`). The first
	 *  lifetime spec per key wins (matches the drain convention).
	 *
	 *  Operates on the per-segment `stackInstances` map; called from cast
	 *  handlers BEFORE `dispatchGainStacks` so reads see expired counts and
	 *  fresh grants land cleanly on top. */
	const applyLifetimeExpiry = (
		char: CharacterData,
		cursor: number,
		stackState: Map<string, number>,
		stackInstances: Map<string, number[]>
	): void => {
		const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
		const seenKeys = new Set<string>();
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.type !== 'gainStacks') continue;
				if (fx.lifetime === undefined) continue;
				// onReaction lifetime is handled by `syncOnReactionToStackState`
				// against rotation-wide instance maps; skipping here avoids
				// touching the per-segment copy the sync just rewrote. Same for
				// team/others-sourced onHit lifetime keys (rotation-wide, owned
				// by `syncOnHitToStackState`); self-sourced onHit instances ARE
				// segment-scoped and expire here like the onCast shape.
				if (fx.trigger.type === 'onReaction') continue;
				if (
					fx.trigger.type === 'onHit' &&
					(fx.trigger.source === 'team' || fx.trigger.source === 'others')
				)
					continue;
				if (seenKeys.has(fx.key)) continue;
				seenKeys.add(fx.key);
				const instances = stackInstances.get(fx.key);
				if (!instances || instances.length === 0) continue;
				const remaining = instances.filter((expiry) => expiry > cursor);
				if (remaining.length !== instances.length) {
					stackInstances.set(fx.key, remaining);
					stackState.set(fx.key, remaining.length);
				}
			}
		}
	};

	// ⚓ `infuse`-Effect infusion windows MOVED to `$lib/sim/infusions.ts` (L3c).

	// ⚓ Elemental application + synthetic reaction emission MOVED to
	// `$lib/sim/aura.ts` (L3c) — the seam L5 replaces.

	for (let i = 0; i < segments.length; i++) {
		const tokens = segments[i];
		if (tokens.length === 0) continue;

		// First token is always the character-name slot.
		const charToken = tokens[0]; // kind === 'character'
		const char = lookupChar(charToken.text);
		if (!char) {
			unknownTokens.push(charToken.text);
			continue; // unknown character — skip segment
		}

		// This character's mutable parser state (cooldown clocks, stance window,
		// named states, chains, shields, summon extensions, stack accumulators).
		// Get-or-create; persists across segments.
		const cs = getCharState(char.id);

		const eAbility = char.abilities.find(
			(a): a is Extract<Ability, { abilityType: 'skill' }> => a.abilityType === 'skill'
		);
		const qAbility = char.abilities.find(
			(a): a is Extract<Ability, { abilityType: 'burst' }> => a.abilityType === 'burst'
		);

		const track: CharacterTrack = {
			characterId: char.id,
			displayName: char.displayName,
			element: char.element ?? 'pyro',
			activeStart: cursor,
			activeEnd: cursor,
			inputBlocks: [],
			hasUnsetDuration: false,
			eBars: [],
			qBars: []
		};

		let localCursor = cursor;

		// Post-P4 #2: emit one action event. `blockId` groups the per-swing
		// events of one input token (pass the anchor id returned by the first
		// emission); when omitted the event anchors its own group.
		const emitAction = (
			fields: Omit<ActionEvent, 'kind' | 'id' | 'characterId' | 'blockId'> & { blockId?: number }
		): ActionEvent => {
			const id = ctx.nextId();
			const ev: ActionEvent = {
				...fields,
				kind: 'action',
				id,
				characterId: char.id,
				blockId: fields.blockId ?? id
			};
			events.push(ev);
			actionRecords.push({ ev, track });
			return ev;
		};

		// This character's cast events across all segments so far (get-or-create;
		// handleCast appends). Used for cross-segment duringSummon detection.
		let charCasts = castsByChar.get(char.id);
		if (!charCasts) {
			charCasts = [];
			castsByChar.set(char.id, charCasts);
		}

		// Resolved once per segment so both Q and E handlers see the same value.
		const charConstellationLevel = constellationLevels?.[char.id] ?? 0;

		// Variant-condition context for this holder (sQ primitive).
		const variantCtx: ConditionContext = {
			teamFactionCounts,
			teamElementCounts: teamElementCountsByHolder.get(char.id)
		};

		const isBow = char.weapon === 'bow';
		// Tracks which hit in the combo sequence the next N token refers to.
		// Reset at segment start and when a stance opens (mid-segment Q cast).
		let normalCounter = 0;
		// Text of the most recent E token cast in this segment. Used by the P handler
		// to auto-select the correct plunge variant (e.g. "hE" → "After Hold E" frames).
		let lastEText: string | null = null;
		// Per-segment stack state (resource counts asserted by `{key:N}` tokens).
		// Resets at segment start so a swap-out clears the resource pool — matches
		// in-game behavior for Heizou Declension, Yanfei Scarlet Seals, etc.
		// Within the segment, assertions persist across actions until the next
		// assertion of the same key changes the value.
		const stackState = new Map<string, number>();
		// Per-segment per-stack-instance expiry list (E3 v2.x lifetime). For each
		// gainStacks key with a `lifetime` spec, this map tracks the absolute
		// expiry times of every individual stack instance. `applyLifetimeExpiry`
		// drops expired instances and updates `stackState[key]` to match the
		// remaining instance count. Per-segment scope (matching `stackState`).
		const stackInstances = new Map<string, number[]>();

		// Returns the full set of resolved runtime states at `cursor`: duringSummon
		// (from stationary persistent casts), inStance (from stanceWindows), and any
		// named states opened by stance abilities with `opensState` (e.g.
		// nightsoulBlessing on Natlan characters).
		const computeCurrentStates = (cursor: number): Set<string> => {
			const states = inferredStates(
				charCasts,
				eAbility,
				qAbility,
				cursor,
				castKinds(ctx, char.id, charCasts)
			);
			const stanceEnd = cs.stance?.end;
			if (stanceEnd !== undefined && stanceEnd > cursor) states.add('inStance');
			for (const [state, endTime] of cs.states) {
				if (endTime > cursor) states.add(state);
			}
			return states;
		};

		// Earliest own stance/named-state window end strictly after `t`, or null.
		// These are the runtime-state boundaries that can flip skill-variant
		// resolution during a cooldown wait (sweep 2026-07-05 #5). duringSummon
		// boundaries are not scanned — summon-gated variants keep their pre-wait
		// resolution.
		const nextOwnWindowEnd = (t: number): number | null => {
			let next: number | null = null;
			const consider = (end: number | undefined): void => {
				if (end !== undefined && end > t && (next === null || end < next)) next = end;
			};
			consider(cs.stance?.end);
			for (const end of cs.states.values()) consider(end);
			return next;
		};

		// Settle the segment character's stack machinery at an ACTION-site hit
		// instant: the cast pipeline's settle block minus `dispatchShieldEnds`
		// (shieldEnd events are public IR — firing them at action sites would
		// change event times; they stay cast-site + rotation-end only). Only
		// invoked when the team authors onHit stack effects (see
		// `teamHasOnHitStackEffects`), preserving cast-site-only drain anchoring
		// for the rest of the corpus.
		const settleStacksAt = (t: number): void => {
			const states = computeCurrentStates(t);
			applyDrain(char, t, states, stackState);
			applyLifetimeExpiry(char, t, stackState, stackInstances);
			syncSourceLifetimeToStackState(char, t, stackState, getCharState);
			syncOnReactionToStackState(char, t, stackState, stackInstances, getCharState);
			syncOnHitToStackState(char, t, stackState, stackInstances, getCharState);
		};

		// Dispatches a parser-private hit: gains → stacks snapshot → consumes →
		// record. `settle` is true at action sites (the cast pipeline already
		// settled at the cast instant). The hit's `stacks` snapshot is post-gain
		// pre-consume (the cast `stackContext` convention); cast-site hits carry
		// the cast's own snapshot instead (pre-set by the caller).
		const dispatchHit = (hit: HitEvent, settle: boolean): void => {
			if (teamHasOnHitStackEffects) {
				if (settle) settleStacksAt(hit.time);
				// One resolver for every holder (self included) — onHit condition
				// eval gets uniform state semantics regardless of who holds the
				// effect (holderStatesAt's summon check is broader than the
				// segment's `computeCurrentStates`; see its decl).
				const getHolderStates = (holder: CharacterData): ReadonlySet<string> =>
					holderStatesAt(ctx, holder, hit.time);
				dispatchGainStacksOnHit(
					teamChars,
					hit,
					getHolderStates,
					constellationByHolder,
					getCharState,
					stackState,
					stackInstances
				);
				if (hit.stacks === undefined && stackState.size > 0) hit.stacks = new Map(stackState);
				dispatchConsumeStacksOnHit(
					teamChars,
					hit,
					getHolderStates,
					constellationByHolder,
					getCharState,
					stackState,
					stackInstances
				);
			}
			hitRecords.push(hit);
		};

		// Expand bracket repeat groups (e.g. 2[N5C] → N5 C N5 C) before the main
		// loop so that lookahead and counter logic see a flat token sequence.
		const expandedTokens = expandBrackets(tokens.slice(1));

		// Unified E/Q cast pipeline. One sequence with small kind-branches; the
		// shared step order is the Q handler's (the reference the 2026-07-05 bug
		// sweep #5 copied to fix E). Order-of-operations is this parser's top bug
		// class — do NOT reorder shared steps. The complete kind asymmetry:
		// cursor settle, CD-write timing, weapon sac-proc (E-only), character
		// cdReset targets (Q-only), lastEText (E-only), and the no-ability
		// fallbacks. `tok`/`j` are passed (not closed over) so the pipeline reads
		// against its arguments, not the loop cursor.
		const handleCast = (kind: 'skill' | 'burst', tok: Token, j: number): void => {
			const isBurst = kind === 'burst';
			const ability = isBurst ? qAbility : eAbility;
			normalCounter = 0; // any non-normal action resets the NA string (gcsim semantics)

			// ── Cursor settle (kind-specific).
			// Q: burst cooldown gate; applies to the no-ability fallback too.
			// cs.qReadyAt defaults to -Infinity (never cast) — isFinite treats
			// that as "no gate", matching the old undefined-map-value behavior.
			// (E settles via the forward-scan wait loop below, inside the ability
			// branch — it re-resolves the active variant and needs `ability`.)
			if (isBurst && isFinite(cs.qReadyAt)) {
				// sQ primitive: a burst variant flagged `bypassesCooldown` ignores
				// the shared burst clock entirely (Flins Thunderous Symphony —
				// gcsim's ActionReady skips the CD check while the window is
				// active). Resolve the variant at the CURRENT cursor to decide;
				// guarded on the ability even declaring such a variant so the
				// common path stays untouched.
				const bypassesGate =
					ability?.variants?.some((v) => v.bypassesCooldown === true) === true &&
					matchVariant(
						ability,
						tok.text,
						computeCurrentStates(localCursor),
						charConstellationLevel,
						getChainIndexMap(ctx, char.id, localCursor),
						stackState,
						variantCtx
					)?.bypassesCooldown === true;
				if (!bypassesGate) localCursor = Math.max(localCursor, cs.qReadyAt);
			}

			if (ability) {
				const nextKey = peekActionKey(expandedTokens, j, isBow);

				// E: cooldown wait + variant re-resolution (sweep 2026-07-05 #5).
				// The active skill variant is time-dependent (stance/state windows)
				// and each distinct skill ability has its own charge queue keyed by
				// ability ID (Cyno's out-of-stance E at 7.5s CD shares no cooldown
				// with the in-stance E at 3s CD). A cooldown wait can therefore
				// cross a window boundary and change WHICH ability is cast. Scan
				// forward over queue-ready and own-window-end events until the
				// ability active at time t has a ready charge at t. The scan is
				// pure — time-advancing mutations run once afterwards, at the
				// actual cast time.
				if (!isBurst) {
					for (let scanGuard = 0; scanGuard < 8; scanGuard++) {
						const scanStates = computeCurrentStates(localCursor);
						const scanE =
							resolveActiveAbility(
								char,
								'skill',
								scanStates,
								charConstellationLevel,
								getChainIndexMap(ctx, char.id, localCursor),
								stackState
							) ?? (ability as SkillAbility); // !isBurst branch: `ability` is the skill
						// Initialize this ability's charge queue on first sight:
						// all charges ready at t=0.
						if (!eChargeQueues.has(scanE.id)) {
							const scanVariant = matchVariant(
								scanE,
								tok.text,
								scanStates,
								charConstellationLevel,
								getChainIndexMap(ctx, char.id, localCursor),
								stackState,
								variantCtx
							);
							eChargeQueues.set(
								scanE.id,
								new Array(resolveEffectiveCharges(scanE, scanVariant, charConstellationLevel)).fill(
									0
								)
							);
						}
						// queue[0] is the earliest-ready charge (kept sorted ascending).
						const readyAt = eChargeQueues.get(scanE.id)![0];
						if (readyAt <= localCursor) break; // castable now
						const boundary = nextOwnWindowEnd(localCursor);
						// Advance to the next event: either a charge returns, or a
						// window ends first (where resolution may flip — re-scan).
						localCursor = boundary !== null && boundary < readyAt ? boundary : readyAt;
					}
				}

				// The cast instant — captured before the cursor advances and passed
				// to every cast-time consumer for both kinds (Q's old `qStart` and
				// E's old `localCursor - eCast` are this same instant, computed
				// differently in the twin handlers).
				const castStart = localCursor;

				// ── Time-advancing evaluations at the cast instant (shared order).
				// Fire expired shield-ends first (so onShieldEnd-bound conditions
				// see post-event state), then decay/expire stacks BEFORE resolving
				// the active variant so any condition reading stackState sees
				// decayed/expired values.
				dispatchShieldEnds(ctx, castStart);
				const states = computeCurrentStates(castStart);
				applyDrain(char, castStart, states, stackState);
				applyLifetimeExpiry(char, castStart, stackState, stackInstances);
				syncSourceLifetimeToStackState(char, castStart, stackState, getCharState);
				syncOnReactionToStackState(char, castStart, stackState, stackInstances, getCharState);
				// Appended by the onHit wiring (2026-07-17) — an APPEND to the
				// frozen settle order, not a reorder: syncs team/others-sourced
				// onHit accrual into the segment before conditions read it.
				syncOnHitToStackState(char, castStart, stackState, stackInstances, getCharState);
				const chainIdx = getChainIndexMap(ctx, char.id, castStart);
				// Resolve the active variant (chain-stage + state + stack aware).
				const active =
					resolveActiveAbility(char, kind, states, charConstellationLevel, chainIdx, stackState) ??
					ability;
				// Both kinds resolve timing against the token text (hold/plunge E
				// variants; sQ burst variants) — the variant match additionally
				// honors variant `conditions` (sQ primitive), so an out-of-window
				// `sQ` falls back to the base ability's timing.
				const timingLabel = tok.text;
				const variant = matchVariant(
					active,
					timingLabel,
					states,
					charConstellationLevel,
					chainIdx,
					stackState,
					variantCtx
				);

				// E only: ensure the resolved variant's charge queue exists (the
				// scan may have re-resolved to a different variant).
				let queue: number[] | undefined;
				if (!isBurst) {
					// !isBurst branch: `active` resolved from a skill kind.
					const maxCharges = resolveEffectiveCharges(
						active as SkillAbility,
						variant,
						charConstellationLevel
					);
					if (!eChargeQueues.has(active.id)) {
						eChargeQueues.set(active.id, new Array(maxCharges).fill(0));
					}
					queue = eChargeQueues.get(active.id)!;
				}

				const castTime = resolveEQCastTime(active, variant, nextKey);
				const {
					cooldown: cd,
					duration: dur,
					summonActivatesAt: spawn
				} = resolveAbilityTiming(
					active,
					variant,
					states,
					charConstellationLevel,
					chainIdx,
					stackState
				);

				// Apply gainStacks matching this cast BEFORE the snapshot, so the
				// cast's stackContext reflects post-grant state (symmetric with
				// Path B's `{key:N}` assertion which precedes the cast in the token
				// stream and is read by the snapshot).
				dispatchGainStacks(
					char,
					kind,
					castStart,
					states,
					charConstellationLevel,
					chainIdx,
					stackState,
					cs.drainAnchors,
					tok.text,
					stackInstances
				);
				// Snapshot stack state at cast time (only when non-empty) so the
				// timeline can filter stack-gated effects per-cast.
				const stacks = stackState.size > 0 ? new Map(stackState) : undefined;
				// Resolved stance fields — read HERE (rather than at the window-open
				// site below) because `readyAt` needs them: a stance whose cooldown
				// CLOCK starts at the stance END is castable again at
				// `stanceEnd + cd`, not `cast + cd`.
				const stance = resolveStanceFields(active, variant);
				// ⚓ Xilonen / Ifa. `dur` is the resolved stance length, so this lands
				// on the same instant the old `cooldownStartDelay == duration` hack
				// computed — but as a STATEMENT of intent, which the swap-close site
				// can then move EARLIER when the stance is cut short. Guarded on the
				// RESOLVED behavior so a variant that overrides the stance away does
				// not pick up a stance-end clock it has no stance for.
				const cdStartsAtStanceEnd =
					stance.behavior === 'stance' && getCooldownStartsAtStanceEnd(active);
				// P4 IR — one `cast` event per resolved cast (the unified single
				// site). Post-P4 #3: this event IS the per-cast record — the E/Q
				// bar is projected from it at finalize, so every geometric field
				// (uptime/cooldown/readyAt/spawn offset) lives here. `readyAt` is
				// initialized to the delay-adjusted CD end; the E sac-proc branch
				// below may retarget it to the hitmark. The id is the provenance
				// anchor for every window this cast opens.
				const castId = ctx.nextId();
				const castEvent: CastEvent = {
					kind: 'cast',
					id: castId,
					characterId: char.id,
					ability: kind,
					abilityId: active.id,
					label: tok.text,
					time: castStart,
					castTime,
					uptime: dur,
					cooldown: cd,
					readyAt: cdStartsAtStanceEnd
						? castStart + dur + cd
						: castStart + (active.cooldownStartDelay ?? 0) + cd,
					summonActivatesAt: spawn,
					fieldStart: castStart + (spawn ?? 0),
					stackContext: stacks
				};
				events.push(castEvent);
				castRecords.push({ ev: castEvent, track });
				charCasts.push(castEvent);
				// Apply consumeStacks AFTER the snapshot so the bar reflects the
				// pre-consume value the perStack BuffValue consumer needs to read.
				dispatchConsumeStacks(
					char,
					kind,
					states,
					charConstellationLevel,
					chainIdx,
					stackState,
					tok.text,
					stackInstances
				);

				// ── CD write (kind-specific).
				if (isBurst) {
					// Same delay-adjusted instant the event was initialized with.
					// A bypassesCooldown variant (Flins Thunderous Symphony) leaves
					// the shared burst clock untouched — its own resolved cooldown
					// still renders on the bar, but neither gates nor writes the
					// clock (gcsim: Symphony sets no CD).
					if (variant?.bypassesCooldown !== true) cs.qReadyAt = castEvent.readyAt;
				} else {
					// Ready-at for the slot we just consumed. Sac Bow proc may
					// override this with hitmark time (skill instantly available
					// again). Defer the queue write until after the proc check —
					// writing first and sorting leaves queue[0] pointing at a
					// different charge, so the proc would reset the wrong slot.
					let consumedReadyAt = castEvent.readyAt;
					// Weapon cdReset (Sacrificial series): proc fires onHit (≈ end
					// of cast animation), not onCast. hitTime approximates hitmark.
					const sacCd = getWeaponCdResetCooldown(char.id, loadoutMap);
					if (sacCd !== null) {
						const hitTime = castStart + castTime;
						if (hitTime >= cs.sacProcReadyAt) {
							// Proc fires: the consumed charge is available again from hitmark.
							consumedReadyAt = hitTime;
							const procEnd = hitTime + sacCd;
							cs.sacProcReadyAt = procEnd;
							const bars = weaponProcBars.get(char.id) ?? [];
							bars.push({ start: hitTime, end: procEnd, sourceCastId: castId });
							weaponProcBars.set(char.id, bars);
							castEvent.sacProcFired = true;
							castEvent.readyAt = hitTime;
						}
					}
					// Write the consumed slot's final ready-at and re-sort so
					// queue[0] stays the earliest-ready charge.
					queue![0] = consumedReadyAt;
					queue!.sort((a, b) => a - b);
				}

				localCursor += castTime;
				if (!isBurst) lastEText = tok.text; // plunge-variant selection
				advanceChain(ctx, active, char.id, kind, localCursor);

				// Q only: character cdReset — refund a charge on each affected
				// ability whose CD the burst resets (Kazuha C1: Q resets E).
				if (isBurst) {
					const resets = getCharacterCdResetTargets(char, 'burst', charConstellationLevel);
					for (const target of resets) {
						if (target === 'skill') {
							// Only the caster's own skill queues — keys are
							// `{charId}__…` ability ids (or bare charId in the
							// uncurated fallback). A rotation-wide reset would erase
							// teammates' cooldowns.
							for (const [key, q] of eChargeQueues) {
								if (key !== char.id && !key.startsWith(`${char.id}__`)) continue;
								if (q.length === 0) continue;
								// Refund only charges still on CD; never push an
								// already-ready charge later.
								q[0] = Math.min(q[0], localCursor);
								q.sort((a, b) => a - b);
							}
						} else if (target === 'burst') {
							cs.qReadyAt = localCursor;
						}
					}
				}

				// Open a stance window when the resolved variant has stance
				// behavior. Fresh record replaces any prior stance (resets
				// per-window extension counts). Hu Tao / Xilonen open via base E;
				// Mavuika hE and Collei-shape Q open via variant. (`stance` is
				// resolved above, where readyAt needs it.)
				if (stance.behavior === 'stance') {
					const endTime = castStart + dur;
					cs.stance = {
						end: endTime,
						terminatesOnSwap: stance.terminatesOnSwap,
						ownerAbility: active,
						castRef: castEvent, // ref for the finalize uptime stamp
						characterId: char.id,
						start: castStart,
						source: kind,
						sourceCastId: castId,
						ownerUptime: dur,
						extCounts: new Map(),
						extLastFire: new Map()
					};
					// Retain every opened stance window for the IR (cs.stance is
					// replaced per cast; extensions/swap-close mutate this same
					// object in place, so the collected record stays current).
					stanceWindowRecs.push(cs.stance);
					// Open named state alongside inStance (e.g. nightsoulBlessing).
					// `opensState: "inStance"` is redundant (the stance IS the
					// inStance window — post-P4 #4 they are one record); skip it so
					// no source-less duplicate shadows the extension-adjusted one.
					if (stance.opensState && stance.opensState !== 'inStance') {
						cs.states.set(stance.opensState, endTime);
						stateWindowRecs.push({
							characterId: char.id,
							name: stance.opensState,
							start: castStart,
							end: endTime,
							sourceCastId: castId
						});
					}
				} else if (active.behavior === 'instant' && active.opensTransientState) {
					// Post-action transient state (sQ primitive): an instant cast
					// opens a short named gating window — Flins Northland Spearstorm
					// opens `symphonyWindow` (6s) during which `sQ` resolves to the
					// Thunderous Symphony burst variant. Re-cast before expiry
					// refreshes the window (new span record). Guarded on the RESOLVED
					// behavior staying instant so a variant that overrides to stance
					// doesn't double-open.
					if (stance.behavior === 'instant') {
						openTransientState(
							ctx,
							active.opensTransientState,
							cs,
							char.id,
							castStart,
							states,
							charConstellationLevel,
							{ sourceCastId: castId, source: kind },
							chainIdx,
							stackState
						);
					}
				}
				// Variant consumes a transient state (gcsim DeleteStatus on cast):
				// Thunderous Symphony closes `symphonyWindow`, Volcano Kablam closes
				// `apexDrive`. The cast itself resolved under the pre-close `states`
				// snapshot, so ordering within this cast is immaterial; the window
				// record is clamped to the cast start for rendering.
				if (variant?.consumesState !== undefined) {
					closeStateWindows(ctx, cs, char.id, variant.consumesState, castStart);
				}
				// Register summon-bound durationExtensions[] when the cast spawns a
				// summon with extensions (Collei A4 — Cuilein-Anbar zone). Replaces
				// any prior owner; counts/lastFires reset per cast.
				const primarySummon = active.summons?.[0];
				if (
					primarySummon &&
					primarySummon.durationExtensions &&
					primarySummon.durationExtensions.length > 0
				) {
					cs.summonExt = {
						endTime: castStart + dur,
						extensions: primarySummon.durationExtensions,
						castRef: castEvent,
						ownerUptime: dur,
						counts: new Map(),
						lastFires: new Map()
					};
					// Retain for the finalize owner uptime stamp (the summon
					// TimelineWindow itself is authored by the summon-window pass,
					// which reads the stamped uptime off the projected bar).
					summonExtRecs.push(cs.summonExt);
				}
				// Register shield window if the cast spawns a shield (tags
				// `['shield']` + summons[0] duration, or onCast Effect.type
				// `'shield'` + duration). Beidou Q and Noelle/Zhongli E are canonical.
				registerShieldOnCast(ctx, char, kind, castStart, active, variant, castId);
				// Open any infusion windows this cast grants (Bennett Q, Candace Q,
				// Kazuha C6, Dori C6, Lohen E). Registered BEFORE the reaction
				// emission below for the same reason the shield is: a window this
				// cast opens should be visible to everything the cast then does.
				registerInfusionsOnCast(
					ctx,
					char,
					kind,
					castStart,
					timingLabel,
					states,
					charConstellationLevel,
					chainIdx,
					stackState,
					variantCtx
				);
				// Emit synthetic reactions for this cast and dispatch to onReaction
				// consumers (gainStacks + durationExtensions). Fires after
				// stance/summon registration so the just-opened stance owner /
				// just-spawned summon can receive extensions from this cast. Aura
				// state updates after dispatch so this cast sees pre-cast aura.
				// The cast instant fed to the reaction/extension emitters is
				// `castStart` (the exact pre-advance cursor) for both kinds.
				emitReactionsAtCast(
					ctx,
					char,
					kind,
					castStart,
					states,
					charConstellationLevel,
					chainIdx,
					stackState
				);
				// Parser-private hit for this cast (onHit wiring): dispatched at
				// the same post-aura-update instant the legacy tail dispatch in
				// emitReactionsAtCast used, now carrying the resolved damageTag/
				// name + the cast's pre-consume stack snapshot. Skipped for
				// element-less characters — preserving the legacy behavior where
				// the reaction emitter's early-return also skipped the hit.
				if (char.element) {
					dispatchHit(
						{
							characterId: char.id,
							time: castStart,
							abilityType: kind,
							element: char.element,
							damageTag: getDefaultDamageTag(active, variant),
							abilityName: variant?.label ? `${active.name} ${variant.label}` : active.name,
							stacks,
							sourceEventId: castId
						},
						false
					);
				}
				// Dispatch onCast durationExtensions on the (possibly just-opened)
				// stance owner. Cyno's burst-stance + in-stance E recast fires here.
				dispatchOnCastExtensions(
					ctx,
					char.id,
					kind,
					castStart,
					states,
					charConstellationLevel,
					chainIdx,
					stacks
				);
			} else if (isBurst) {
				// No-ability fallback (Q): generic 15s CD.
				// No resolved variant — key the abilityId by the bare charId.
				const fallbackQ: CastEvent = {
					kind: 'cast',
					id: ctx.nextId(),
					characterId: char.id,
					ability: 'burst',
					abilityId: char.id,
					label: tok.text,
					time: localCursor,
					castTime: Q_CAST_F,
					uptime: 0,
					cooldown: FALLBACK_BURST_CD_F,
					readyAt: localCursor + FALLBACK_BURST_CD_F,
					summonActivatesAt: 0,
					fieldStart: localCursor
				};
				events.push(fallbackQ);
				castRecords.push({ ev: fallbackQ, track });
				charCasts.push(fallbackQ);
				cs.qReadyAt = localCursor + FALLBACK_BURST_CD_F;
				localCursor += Q_CAST_F;
			} else {
				// No-ability fallback (E): single charge keyed by bare charId, 12s CD.
				if (!eChargeQueues.has(char.id)) eChargeQueues.set(char.id, [0]);
				const queue = eChargeQueues.get(char.id)!;
				if (queue[0] > localCursor) localCursor = queue[0];
				const fallbackE: CastEvent = {
					kind: 'cast',
					id: ctx.nextId(),
					characterId: char.id,
					ability: 'skill',
					abilityId: char.id,
					label: tok.text,
					time: localCursor,
					castTime: E_CAST_F,
					uptime: 0,
					cooldown: FALLBACK_SKILL_CD_F,
					readyAt: localCursor + FALLBACK_SKILL_CD_F,
					summonActivatesAt: 0,
					fieldStart: localCursor
				};
				events.push(fallbackE);
				castRecords.push({ ev: fallbackE, track });
				charCasts.push(fallbackE);
				queue[0] = localCursor + FALLBACK_SKILL_CD_F;
				localCursor += E_CAST_F;
				lastEText = tok.text;
			}
		};

		for (let j = 0; j < expandedTokens.length; j++) {
			const tok = expandedTokens[j];

			if (tok.kind === 'Q') {
				handleCast('burst', tok, j);
			} else if (tok.kind === 'E') {
				handleCast('skill', tok, j);
			} else if (tok.kind === 'time') {
				const m = tok.text.match(/^~([\d.]+)s/);
				if (m) {
					const delta = parseFloat(m[1]);
					// isFinite alone let `~99999999s` through — see MAX_TIME_ADVANCE_F.
					// ⚠️ `~0.017s` is legal input and rounds to a single frame; that is the
					// honest answer, not a floor worth guarding.
					if (isFinite(delta)) localCursor += Math.min(framesOf(delta), MAX_TIME_ADVANCE_F);
				}
			} else if (tok.kind === 'unset-time') {
				emitAction({ action: 'unset', label: '~?', time: localCursor, duration: MIN_ACTIVE_F });
				track.hasUnsetDuration = true;
				localCursor += MIN_ACTIVE_F;
			} else if (tok.kind === 'optional') {
				// Optional actions in parentheses are omitted from the timeline entirely.
				// No label is emitted and no cursor advance occurs.
			} else if (tok.kind === 'or-alt') {
				// Slash alternative — only the first option goes on the timeline.
				continue;
			} else if (tok.kind === 'stack-assert') {
				// User-asserted stack count: `{key:N}` updates the per-segment
				// stackState for subsequent ability/effect resolution. No timeline
				// effect — the assertion itself doesn't emit a block or advance
				// the cursor. The next ability that gates on this stack key picks
				// up the new count via the threaded `stackState` parameter.
				const m = tok.text.match(STACK_ASSERT_RE);
				if (m) {
					stackState.set(m[1], parseInt(m[2], 10));
				}
			} else {
				// 'label' or 'unknown'
				if (tok.kind === 'unknown') unknownTokens.push(tok.text);

				const t = tok.text;
				const nextKey = peekActionKey(expandedTokens, j, isBow);

				if (/^N\d*$/.test(t)) {
					// Normal attack: N5 means "perform 5 normals in a row" starting from
					// the current normalCounter. Intermediate hits use 'N' as their
					// lookahead (next action is another normal); the final hit uses nextKey.
					// Each swing emits an action event; the finalize pass projects the
					// group into one block labeled "N5" (post-P4 #2).
					// Active normal ability is resolved per-token to handle mid-segment
					// stance transitions (e.g. Cyno Q → in-stance normals).
					const count = t.length > 1 ? parseInt(t.slice(1)) : 1;
					const nStates = computeCurrentStates(localCursor);
					const activeNormal = resolveActiveAbility(
						char,
						'normal',
						nStates,
						charConstellationLevel
					);
					// Frameless normals (uncurated stubs with hits:[], Blank) ride the
					// generic combo profile so swings get realistic per-position timing
					// instead of collapsing to zero duration. `swap`-presence on the
					// first hit is the same framed-vs-not sentinel isCurated uses.
					const rawHits = activeNormal?.hits;
					const hits = Number.isFinite(rawHits?.[0]?.frames?.swap) ? rawHits! : GENERIC_NORMAL_HITS;
					// Infusion rule shared with the notation highlighter (actionElement.ts).
					// ⚠️ TWO infusion mechanisms, and the stance one WINS: a stance's
					// own `infusion` is the character's self-infusion, which in game
					// overrides an external grant (Xiao's burst stays anemo through
					// a Bennett C6 pyro infusion). Resolved once per TOKEN, at the
					// token's start — the same altitude `activeNormal` is resolved at,
					// so a swing's drawn element and its reaction cannot disagree.
					const nElement = resolveActionElement(
						'normal',
						t,
						char.weapon,
						char.element,
						activeNormal?.infusion ?? infusionAt(ctx, char, localCursor)
					);
					// Per-swing action events sharing one blockId (the anchor = the
					// first swing's id). `time` is the swing's pre-advance start.
					let anchorId: number | undefined;
					for (let k = 0; k < count; k++) {
						const hitIndex = normalCounter % hits.length;
						const hitNextKey: ActionKey = k < count - 1 ? 'N' : nextKey;
						const castS = resolveNormalCastTime(hits, hitIndex, hitNextKey);
						const ev = emitAction({
							action: 'normal',
							label: t,
							blockId: anchorId,
							time: localCursor,
							duration: castS ?? 0,
							abilityId: activeNormal?.id,
							comboIndex: hitIndex,
							element: nElement
						});
						anchorId ??= ev.id;
						if (castS !== null) localCursor += castS;
						normalCounter++;
						// Normal-opened transient state (post-P4 #2): the FIRST swing's
						// recovery opens the window, once per N token — the analog of
						// the plunge-landing opener. Gated on the token-start state
						// snapshot (the same one that resolved this ability); the
						// activeNormal is NOT re-resolved for later swings, matching
						// the parser's per-token resolution altitude. Durin's dark
						// commit (N during `transmuting` → `darkForm`) rides this.
						const nSpec = activeNormal?.actionOpensState?.normal;
						if (k === 0 && nSpec) {
							openTransientState(
								ctx,
								nSpec,
								cs,
								char.id,
								localCursor,
								nStates,
								charConstellationLevel,
								{
									sourceActionId: ev.id
								}
							);
						}
						// Offer the swing to the aura, behind the normal-attack ICD
						// clock (ICD round). A catalyst `N5` applies on swings 1, 4
						// and 6 at the corpus cadence, not on all five.
						emitReactionsAtSwing(
							ctx,
							char,
							'normal',
							nElement,
							activeNormal?.noICD,
							localCursor,
							nStates,
							charConstellationLevel,
							stackState
						);
						// Parser-private per-swing hit (onHit wiring): swing-END time,
						// per-hit damageTag override honored, combo index feeding
						// filter.hitIndex. Dispatched AFTER the transient-state opener
						// so a state the swing itself opens is visible to hit-gated
						// conditions. Per-swing = one hit (multi-hit swings are not
						// curated — see the HitEvent decl).
						dispatchHit(
							{
								characterId: char.id,
								time: localCursor,
								abilityType: 'normal',
								element: nElement,
								damageTag: hits?.[hitIndex]
									? getNormalHitDamageTag(hits[hitIndex], 'normal')
									: 'normal',
								abilityName: activeNormal?.name,
								hitIndex,
								sourceEventId: ev.id
							},
							true
						);
					}
				} else if (/^C\d*$/.test(t) || (t === 'A' && isBow)) {
					// Charged attack: resolve active normal (in-stance if applicable) for
					// chargeFrames/chargeHits. Bow uses chargeHits, others use chargeFrames.
					//
					// ⚓ `A` IS AN ALIAS, NOT A NEW ACTION (2026-08-13). KQM writes a bow's
					// aimed shot as `A`; we have always modelled it as that bow's CHARGED
					// attack — `chargeHits` holds the aimed-shot frames, and
					// resolveActionElement already carries the rule that a bow's charged
					// shot is elemental except the C1 partial. So the only thing missing
					// was the token, and a KQM user typing `A` got SILENCE: no block, no
					// cursor advance, no message. Everything below reads `t` through the
					// same `t === 'C1' ? first : last` test, so `A` lands on the
					// fully-charged shot, which is what the token means.
					//
					// ⛔ BOW-GATED, and gcsim agrees literally: its base `Aimed` returns
					// "action aimed not implemented" for anyone else. A non-bow `A` falls
					// through to no branch at all and is flagged in the composer
					// (notationFlags) — an unsupported token rather than an approximated
					// one, because nothing is drawn for it.
					normalCounter = 0; // any non-normal action resets the NA string (gcsim semantics)
					// Explicit annotation: the chargeHits read in the hit block below
					// otherwise forms a TS7022 inference cycle through this initializer.
					const activeNormal: NormalAbility | undefined = resolveActiveAbility(
						char,
						'normal',
						computeCurrentStates(localCursor),
						charConstellationLevel
					);
					const castS = activeNormal
						? resolveChargeCastTime(activeNormal, t, nextKey, isBow)
						: null;
					const blockStart = localCursor;
					// Catalyst CAs, bow aimed shots (bar the C1 partial), and infused CAs
					// are elemental — the shared infusion rule (actionElement.ts).
					const cElement = resolveActionElement(
						'charged',
						t,
						char.weapon,
						char.element,
						activeNormal?.infusion ?? infusionAt(ctx, char, blockStart)
					);
					const chargedEv = emitAction({
						action: 'charged',
						label: t,
						time: blockStart,
						duration: castS ?? 0,
						abilityId: activeNormal?.id,
						element: cElement
					});
					if (castS !== null) localCursor += castS;
					// Offer the charged shot to the aura. A catalyst CA and a bow's
					// aimed shot both apply; only the bow's runs a counter (a
					// catalyst's is gcsim `ICDTagNone`) — resolveActionIcd holds it.
					emitReactionsAtSwing(
						ctx,
						char,
						'charged',
						cElement,
						activeNormal?.noICD,
						localCursor,
						computeCurrentStates(localCursor),
						charConstellationLevel,
						stackState
					);
					// Parser-private charged hit (onHit wiring): swing-END time. The
					// abilityName carries the bow chargeHit sub-name (C1 → first
					// entry, C → last) so `filter.abilityName: "Wreath Arrow"`
					// substring-matches — mirrors resolveBlockContext's rule.
					{
						let cAbilityName: string | undefined = activeNormal?.name;
						const chargeHits: NormalHit[] | undefined = activeNormal?.chargeHits;
						if (chargeHits?.length && cAbilityName) {
							const chIdx = t === 'C1' ? 0 : chargeHits.length - 1;
							const hitName = chargeHits[chIdx]?.name;
							if (hitName) cAbilityName = `${cAbilityName} ${hitName}`;
						}
						dispatchHit(
							{
								characterId: char.id,
								time: localCursor,
								abilityType: 'charged',
								element: cElement,
								damageTag: chargeHits?.length
									? getNormalHitDamageTag(
											chargeHits[t === 'C1' ? 0 : chargeHits.length - 1],
											'charged'
										)
									: 'charged',
								abilityName: cAbilityName,
								sourceEventId: chargedEv.id
							},
							true
						);
					}
				} else if (/^[hl]?P$/.test(t)) {
					// Plunge attack. Uses the active normal ability's plungeFrames, or a
					// plungeVariant whose input[] matches the preceding E token text
					// (e.g. Kazuha's Midare Ranzan has distinct "After Hold E" frames).
					const plungeStates = computeCurrentStates(localCursor);
					const activeNormal = resolveActiveAbility(
						char,
						'normal',
						plungeStates,
						charConstellationLevel
					);
					normalCounter = 0; // any non-normal action resets the NA string (gcsim semantics)
					const plungeVariant = lastEText
						? activeNormal?.plungeVariants?.find((v) =>
								v.input.includes(lastEText as (typeof v.input)[number])
							)
						: undefined;
					const plungeFrames = plungeVariant?.frames ?? activeNormal?.plungeFrames;
					if (plungeFrames) {
						const castS = plungeFrames[nextKey] ?? plungeFrames.swap;
						const blockStart = localCursor;
						// Catalyst / infused plunges (e.g. Xiao's Q-stance) are elemental —
						// the shared infusion rule (actionElement.ts). An unresolvable plunge
						// (no frames) emits NO action event, matching the no-block legacy
						// behavior.
						const pElement = resolveActionElement(
							'plunge',
							t,
							char.weapon,
							char.element,
							activeNormal?.infusion ?? infusionAt(ctx, char, blockStart)
						);
						const plungeEv = emitAction({
							action: 'plunge',
							label: t,
							time: blockStart,
							duration: castS,
							abilityId: activeNormal?.id,
							element: pElement
						});
						localCursor += castS;
						// Post-plunge transient state (sQ primitive): the plunge landing
						// opens a short gating window — Varesa's plunge opens `apexDrive`
						// (140f) during which `sQ` resolves to Volcano Kablam. Window
						// runs from the plunge's END (≈ landing, the post-advance
						// cursor); provenance is the plunge's action event (post-P4 #2).
						const pSpec = activeNormal?.actionOpensState?.plunge;
						if (pSpec) {
							openTransientState(
								ctx,
								pSpec,
								cs,
								char.id,
								localCursor,
								plungeStates,
								charConstellationLevel,
								{ sourceActionId: plungeEv.id }
							);
						}
						// Offer the plunge to the aura at the landing. Plunges carry no
						// ICD at all (gcsim census in resolveActionIcd), so an infused
						// plunge string applies on every landing.
						emitReactionsAtSwing(
							ctx,
							char,
							'plunge',
							pElement,
							activeNormal?.noICD,
							localCursor,
							plungeStates,
							charConstellationLevel,
							stackState
						);
						// Parser-private plunge hit (onHit wiring): landing ≈ swing
						// END. Dispatched after the transient-state opener (apexDrive
						// is open to hit-gated conditions at the landing instant). A
						// frameless plunge emits no action event and no hit.
						dispatchHit(
							{
								characterId: char.id,
								time: localCursor,
								abilityType: 'plunge',
								element: pElement,
								damageTag: 'plunge',
								abilityName: activeNormal?.name,
								sourceEventId: plungeEv.id
							},
							true
						);
					}
					lastEText = null;
				} else if (t === 'D' || t === 'J') {
					// Dash/jump: emit a block, then advance cursor.
					// The preceding token already selected frames.D/J via peekActionKey.
					normalCounter = 0; // any non-normal action resets the NA string (gcsim semantics)
					const blockStart = localCursor;
					emitAction({
						action: t === 'D' ? 'dash' : 'jump',
						label: t,
						time: blockStart,
						duration: DASH_FRAMES
					});
					localCursor += DASH_FRAMES;
				}
			}
		}

		// Ensure minimum on-field width
		if (localCursor <= cursor) localCursor = cursor + MIN_ACTIVE_F;

		track.activeEnd = localCursor;
		tracks.push(track);

		// When a character swaps off, close any stance window flagged terminatesOnSwap.
		// The flag was recorded at open time (resolveStanceFields applies variant
		// overrides), so this works correctly for variant-driven stances too
		// (e.g. Mavuika hE where the base behavior is "instant" but the variant
		// opens a real stance with terminatesOnSwap: true).
		//
		// E3 v2.x: instead of clearing cs.stance, record the actual swap-out time
		// (cs.stance.end). drain-bearing stack keys (Skirk SS, drain 7/sec while
		// inStance) rely on the stored end time when applyDrain settles in a
		// future segment; the original max-duration value is a stale upper bound
		// that would cause over-decay. computeCurrentStates already gates
		// `inStance` on `end > cursor`, so future-segment cursors (always >
		// localCursor) see the stance as inactive — no false-positive state
		// membership. Setting terminatesOnSwap false (mirrors the old
		// `stanceTerminatesOnSwap.delete`) stops a later swap in a segment that
		// never re-opened from re-clamping. Named state windows opened by this
		// stance (nightsoulBlessing, etc.) are clamped to the same swap-out time.
		// Transient states flagged terminatesOnSwap close at swap-out regardless
		// of any stance window (Flins symphonyWindow — gcsim's exit-field hook
		// deletes the status). Clamp the live end + the IR records, then clear
		// the flag set (mirrors the stance terminatesOnSwap=false reset).
		if (i < segments.length - 1 && cs.statesTerminatingOnSwap.size > 0) {
			for (const name of cs.statesTerminatingOnSwap) {
				const end = cs.states.get(name);
				if (end !== undefined && end > localCursor) {
					cs.states.set(name, localCursor);
					for (const rec of stateWindowRecs) {
						if (rec.characterId === char.id && rec.name === name && rec.end > localCursor) {
							rec.end = localCursor;
						}
					}
				}
			}
			cs.statesTerminatingOnSwap.clear();
		}

		if (i < segments.length - 1 && cs.stance) {
			if (cs.stance.terminatesOnSwap === true) {
				// ⚠️ CLAMP, never assign. `end` was set at open to `cast + duration`,
				// and a swap can only ever end a stance EARLY. An unconditional
				// assignment silently EXTENDED the window whenever the holder stayed
				// on field past the stance's own duration — the ordinary case, since
				// `Hu Tao E N1 N2 N3 …` outlasts a 9s Paramita. The window then ran
				// to the swap, and everything reading it inherited that: the drawn
				// state span, and `afterDurationStart`, which places a post-stance
				// buff at `cast + (end − start)` and so fired it seconds late for all
				// five existing authors (Raiden C4, Diona, Chongyun, Venti, Itto).
				// The `cs.states` loop below has always clamped; this line had not.
				const stanceEnd = Math.min(cs.stance.end, localCursor);
				cs.stance.end = stanceEnd;
				cs.stance.terminatesOnSwap = false;
				// ⚓ A stance whose cooldown CLOCK starts at the stance END was given
				// a `readyAt` of `cast + duration + cd` at open time, on the
				// assumption the window would run its full length. If the swap ended
				// it early the clock starts THEN: take `stanceEnd + cd` outright —
				// ⛔ not min/max against the stale value, which is a strictly later
				// upper bound we are correcting, not competing with. ⚠️ `stanceEnd`
				// rather than `localCursor` so a stance that already expired on its
				// own doesn't have its cooldown restarted by a later swap.
				// Both the ghost tail (castRef.readyAt) and the recast placement
				// (the charge queue) have to move, or the chart and the parser
				// disagree about when the ability is castable.
				if (getCooldownStartsAtStanceEnd(cs.stance.ownerAbility)) {
					const castRef = cs.stance.castRef;
					const staleReadyAt = castRef.readyAt;
					const readyAt = stanceEnd + castRef.cooldown;
					castRef.readyAt = readyAt;
					// The queue is keyed by exact ability id (see the cast site), so
					// this cannot reach a teammate's or a sibling variant's clock.
					// Replace the entry this cast wrote — identified by its stale
					// value — rather than q[0], which a multi-charge sort may have
					// moved off the front.
					const queue = eChargeQueues.get(cs.stance.ownerAbility.id);
					if (queue && staleReadyAt !== undefined) {
						const idx = queue.indexOf(staleReadyAt);
						if (idx !== -1) {
							queue[idx] = readyAt;
							queue.sort((a, b) => a - b);
						}
					}
				}
				// barRef is intentionally retained (P4): the finalize pass stamps
				// the owner bar's uptime from `ownerUptime`, which the swap does NOT
				// clamp — a swap-terminated stance keeps its full owner-bar width
				// while `end` clamps to the swap-out time.
				for (const [state, endTime] of cs.states) {
					if (endTime > localCursor) cs.states.set(state, localCursor);
				}
				// Mirror the clamp onto the IR state-window records for this char.
				for (const rec of stateWindowRecs) {
					if (rec.characterId === char.id && rec.end > localCursor) rec.end = localCursor;
				}
			}
		}

		// Swap time before the next character enters
		if (i < segments.length - 1) {
			cursor = localCursor + swapF;
		} else {
			cursor = localCursor;
		}
	}

	// Final pass: any shield windows still open at rotation end fire their
	// onShieldEnd dispatch at their scheduled expiry (clamped to the rotation's
	// observed totalDuration so events don't drift past the timeline ruler).
	dispatchShieldEnds(ctx, Infinity);

	// ── P4 finalize: author the IR windows, stamp owner uptimes, and project
	// the track bars from the cast events.

	// 1. Stamp owner uptimes from the window records onto their source cast
	//    events (replaces the old live `bar.uptime += delta` back-channel).
	//    Only stance + summonExt owner casts ever accumulate extension deltas;
	//    every other cast keeps its push-time uptime.
	//    LATENT TRAP (P4): this stamp lands ONLY at finalize, so any mid-parse
	//    reader of a cast's `uptime` on an extendable owner sees the un-extended
	//    push-time value. `inferredStates` (duringSummon detection) is exactly
	//    such a reader — inert today (no char pairs an extendable stationary
	//    summon with duringSummon-gated logic); see the trap note there.
	for (const rec of stanceWindowRecs) rec.castRef.uptime = rec.ownerUptime;
	for (const rec of summonExtRecs) rec.castRef.uptime = rec.ownerUptime;

	// 1b. Project the E/Q bars from the cast events (post-P4 #3). Bars are a
	//     pure per-track projection of the cast records — the bar ↔ cast
	//     bijection and field agreement hold by construction. Built AFTER the
	//     uptime stamps so extended owners project their final width.
	for (const { ev, track } of castRecords) {
		const bar: TimelineBar = {
			start: ev.time,
			uptime: ev.uptime,
			cooldown: ev.cooldown,
			readyAt: ev.readyAt,
			label: ev.label,
			castTime: ev.castTime,
			abilityId: ev.abilityId,
			summonActivatesAt: ev.summonActivatesAt,
			sacProcFired: ev.sacProcFired,
			stackContext: ev.stackContext
		};
		(ev.ability === 'burst' ? track.qBars : track.eBars).push(bar);
		castIdByBar.set(bar, ev.id);
	}

	// 1c. Project the inputBlocks from the event stream (post-P4 #2). Casts
	//     become skill/burst blocks (`castTime` is never touched by finalize,
	//     so this is order-independent of 1b); an action-event group (events
	//     sharing a `blockId`) becomes one block whose duration accumulates in
	//     record order — the same float additions, in the same order, as the
	//     legacy inline emission. Per-track order is ascending anchor/cast id
	//     (= token order; the record arrays are emission-ordered).
	{
		const trackItems = new Map<CharacterTrack, { id: number; block: InputBlock }[]>();
		const pushItem = (track: CharacterTrack, id: number, block: InputBlock) => {
			const items = trackItems.get(track);
			if (items) items.push({ id, block });
			else trackItems.set(track, [{ id, block }]);
		};
		for (const { ev, track } of castRecords) {
			pushItem(track, ev.id, {
				start: ev.time,
				duration: ev.castTime,
				parts: [ev.label],
				kind: ev.ability
			});
		}
		const blocksByAnchor = new Map<number, InputBlock>();
		for (const { ev, track } of actionRecords) {
			const open = blocksByAnchor.get(ev.blockId);
			if (open) {
				open.duration += ev.duration;
				continue;
			}
			const block: InputBlock = {
				start: ev.time,
				duration: ev.duration,
				parts: [ev.label],
				kind:
					ev.action === 'dash' || ev.action === 'jump'
						? 'movement'
						: ev.action === 'unset'
							? 'unset'
							: ev.element !== undefined
								? 'elemental-normal'
								: 'normal',
				// The ANCHOR swing's element speaks for the whole block, which is
				// exact today: infusion is resolved once per token, so every swing
				// an `N5` groups shares it. ⚠️ If infusion ever resolves per swing,
				// a block can no longer carry one element and this is the site that
				// has to say so.
				...(ev.element !== undefined ? { element: ev.element } : {})
			};
			blocksByAnchor.set(ev.blockId, block);
			pushItem(track, ev.blockId, block);
		}
		for (const [track, items] of trackItems) {
			items.sort((a, b) => a.id - b.id);
			track.inputBlocks = items.map((i) => i.block);
		}
	}

	const windows: TimelineWindow[] = [];

	// 2. Stance windows → `state` windows named "inStance" (post-P4 #4 merge:
	//    a stance is just a state with a source attached). Final ends —
	//    extension-adjusted, swap-clamped.
	for (const rec of stanceWindowRecs) {
		windows.push({
			kind: 'state',
			characterId: rec.characterId,
			name: 'inStance',
			start: rec.start,
			end: rec.end,
			source: rec.source,
			sourceCastId: rec.sourceCastId
		});
	}

	// 3. Named-state windows (swap-clamped ends). All transient-opened —
	//    stance windows project from stanceWindowRecs above.
	for (const rec of stateWindowRecs) {
		windows.push({
			kind: 'state',
			characterId: rec.characterId,
			name: rec.name,
			start: rec.start,
			end: rec.end,
			source: rec.source,
			transient: true,
			sourceCastId: rec.sourceCastId,
			sourceActionId: rec.sourceActionId
		});
	}

	// 4. Shield windows.
	for (const rec of shieldWindowRecs) {
		windows.push({
			kind: 'shield',
			characterId: rec.characterId,
			source: rec.source,
			start: rec.start,
			end: rec.end,
			sourceCastId: rec.sourceCastId,
			...(rec.label !== undefined ? { label: rec.label } : {}),
			...(rec.coveredBySummon ? { coveredBySummon: true as const } : {})
		});
	}

	// 5. Weapon-proc windows (mirror weaponProcBars).
	for (const [characterId, bars] of weaponProcBars) {
		for (const b of bars) {
			windows.push({
				kind: 'weaponProc',
				characterId,
				start: b.start,
				end: b.end,
				sourceCastId: b.sourceCastId
			});
		}
	}

	// 6. Summon windows — one per cast-spawned summon (INCLUDING summons without
	//    durationExtensions), spawn offset applied, with the same terminatesOn
	//    swap/recast truncation summonSubrows.ts applies today (ported here so
	//    consumers can drop the geometry reconstruction). Reads the now-stamped
	//    bar.uptime.
	const charById = new Map(teamChars.map((c) => [c.id, c]));
	const lastSummonWindowByKey = new Map<string, Extract<TimelineWindow, { kind: 'summon' }>>();
	// The resolved `Summon` behind each emitted window, kept parser-private for
	// the off-field hit synthesis in step 6c. Recorded HERE because this is the
	// only place the object is in hand — a window carries the summon's LABEL,
	// and re-resolving from the label alone cannot distinguish two summons that
	// share one (the reason `findSummonsForBar` takes a bar, not a name).
	const summonByWindow = new Map<Extract<TimelineWindow, { kind: 'summon' }>, Summon>();
	for (let ti = 0; ti < tracks.length; ti++) {
		const track = tracks[ti];
		const summonChar = charById.get(track.characterId);
		// Next swap-out for this character = activeStart of the next track owned
		// by a different character. summonSubrows.ts (the renderer) historically
		// used "next track with a different slotIdx"; the two agree as long as
		// characterId ↔ slotIdx is a bijection over summon-bearing tracks —
		// mapTracksToSlots (RotationTimeline.svelte) maps each slotIdx to exactly
		// one characterId, and the slots are distinct BY CONSTRUCTION.
		// ✅ 2026-08-13 (single truth): that last clause used to carry a caveat —
		// `?team=` (`importTeam`) and shared links passed their id array through
		// verbatim with no dedup, so a crafted `?team=fischl,fischl` was one
		// non-bijective input away from breaking this. Both routes now go through
		// the NOTATION, and `orderedCharacterIds` dedupes, so a duplicate cannot
		// be expressed at all (see the fuller note in computeSummonSubrows). For every real
		// team the two swap-out definitions coincide.
		let swapOutAt = Infinity;
		for (let k = ti + 1; k < tracks.length; k++) {
			if (tracks[k].characterId !== track.characterId) {
				swapOutAt = tracks[k].activeStart;
				break;
			}
		}
		const emitSummon = (bar: TimelineBar, kind: 'skill' | 'burst'): void => {
			if (bar.uptime <= 0) return;
			// One window PER SUMMON. Emitted in authored order so the primary
			// keeps the id it has always had and the extras land after it — the
			// lane ordering in summonSubrows follows the same walk.
			findSummonsForBar(summonChar, kind, bar.label, bar.abilityId).forEach((summon, i) => {
				const { start: spawnAt, end } = summonSpan(
					bar.start,
					bar.summonActivatesAt,
					bar.uptime,
					summon,
					i
				);
				// ⚠ terminatesOn is read off the SUMMON, so a stationary turret
				// can outlive the swap that ends the field it spawned beside.
				let endAt = end;
				if (summon.terminatesOn === 'swap' && swapOutAt < endAt) endAt = swapOutAt;
				if (endAt <= spawnAt) return;
				const key = `${track.characterId}::${summon.label}`;
				// Recast truncation: shorten the still-open prior window on this key.
				if (summon.terminatesOn === 'recast') {
					const prev = lastSummonWindowByKey.get(key);
					if (prev && prev.end > spawnAt) prev.end = spawnAt;
				}
				const win: Extract<TimelineWindow, { kind: 'summon' }> = {
					kind: 'summon',
					characterId: track.characterId,
					label: summon.label,
					start: spawnAt,
					end: endAt,
					source: kind,
					sourceCastId: castIdByBar.get(bar)
				};
				windows.push(win);
				summonByWindow.set(win, summon);
				lastSummonWindowByKey.set(key, win);
			});
		};
		for (const bar of track.eBars) emitSummon(bar, 'skill');
		for (const bar of track.qBars) emitSummon(bar, 'burst');
	}

	// 6b. Nightsoul-Burst fire events (post-P4 #5 arc, phase 3 — the greedy
	// cooldown-gated derivation moved here from nbRows.ts; computeNBBars is
	// now a pure projection of these events). Team context prefers the SLOT
	// roster (`teamCharacters` — slots can hold Natlan/catalyst members never
	// typed in the notation, and the NB clock is a team-wide mechanic) and
	// falls back to the notation-derived team for Node scripts and tests.
	{
		const nbTeam = teamCharacters
			? teamCharacters.filter((c): c is CharacterData => c != null)
			: teamChars;
		const natlanCount = nbTeam.filter((c) => c.region === 'Natlan').length;
		if (natlanCount > 0) {
			const nbCd = framesOf(natlanCount >= 3 ? 9 : natlanCount === 2 ? 12 : 18);
			const catalystIds = new Set(nbTeam.filter((c) => c.weapon === 'catalyst').map((c) => c.id));
			// Triggers: every E/Q cast; for catalyst characters, every input-token
			// ANCHOR action except movement/unset (per-block cadence, not
			// per-swing — the legacy nbRows rule, preserved verbatim).
			const nbTriggers: { time: number; characterId: string }[] = [];
			for (const ev of events) {
				if (ev.kind === 'cast') {
					nbTriggers.push({ time: ev.time, characterId: ev.characterId });
				} else if (
					ev.kind === 'action' &&
					ev.id === ev.blockId &&
					ev.action !== 'dash' &&
					ev.action !== 'jump' &&
					ev.action !== 'unset' &&
					catalystIds.has(ev.characterId)
				) {
					nbTriggers.push({ time: ev.time, characterId: ev.characterId });
				}
			}
			nbTriggers.sort((a, b) => a.time - b.time);
			let nbNextAllowed = -Infinity;
			for (const t of nbTriggers) {
				if (t.time >= nbNextAllowed) {
					events.push({
						kind: 'nightsoulBurst',
						id: ctx.nextId(),
						characterId: t.characterId,
						time: t.time,
						cooldown: nbCd
					});
					nbNextAllowed = t.time + nbCd;
				}
			}
		}
	}

	// 6c. Off-field hits from summon damage ticks (2026-08-15).
	//
	// ⚓ THE HIT STREAM USED TO STOP AT THE ACTIVE CHARACTER. Every record in
	// `hitRecords` came from an E/Q cast or a normal/charged/plunge swing, so an
	// `onHit` effect held by an off-field damage dealer — Oz ticking, Guoba
	// breathing, a Salon Member landing — never fired at all. That silently
	// disabled every hit-triggered artifact set (Deepwood Memories, Tenacity of
	// the Millelith, Silken Moon's Serenade — all three authored, none reachable).
	//
	// Corpus reach beyond the artifacts, measured 2026-08-15: FOUR characters
	// leave a damaging summon AND hold an `onHit` effect that summon can fire —
	// Emilie (C2), Escoffier (A-passive), Anemo Traveler (C6), Xiangling (C1),
	// every one of them a resShred. For those the effect already fired at the
	// CAST instant, so this is an uptime correction rather than a from-nothing
	// gain; the artifact sets are the from-nothing case.
	//
	// Runs HERE, at finalize, because a summon's FINAL end is only known once
	// step 6's recast/swap truncation has landed. Synthesizing during the parse
	// would emit ticks past an end a later recast pulls in.
	//
	// ⚠️⚠️ THESE HITS FEED `deriveBuffWindows` ONLY — they are deliberately NOT
	// put through `dispatchHit`, so `gainStacks`/`consumeStacks` never see them.
	// That machinery mutates live state in PARSE order, and a finalize-time hit
	// cannot be interleaved into a stream that has already been consumed without
	// a two-pass parse. Buff and resShred effects carry no stack state — which is
	// all three artifact sets and the bulk of the character cases — so those are
	// correct today; a summon tick feeding a STACK effect stays unmodelled.
	// ⛔ Do not "fix" that by calling `dispatchHit` here: the ordering IS the
	// problem, and a hit dispatched after the fact would apply its gain to a
	// stack state that later hits have already read.
	for (const win of windows) {
		if (win.kind !== 'summon') continue;
		const summon = summonByWindow.get(win);
		if (!summon) continue;
		const cLevel = constellationLevels?.[win.characterId] ?? 0;
		for (const tick of computeSummonDamageTicks(summon, win.start, win.end, cLevel)) {
			hitRecords.push({
				characterId: win.characterId,
				time: tick.time,
				abilityType: win.source,
				element: tick.element,
				// A summon tick's damage class is its spawning cast's — there is no
				// per-effect override on a `summonTick` damage effect to prefer.
				damageTag: win.source,
				abilityName: summon.label,
				// Provenance is the CAST that spawned the summon — what a reader
				// wants a summon-borne buff traced back to. `-1` is unreachable
				// (ids count from 0, bars↔casts are 1:1 by construction); it is
				// here so a missing link cannot fabricate a bogus event join.
				sourceEventId: win.sourceCastId ?? -1
			});
		}
	}
	// ⚠ Appended, NOT merged by time into the existing records. `hitsForTrack`
	// (buffWindows) only ever selects `normal`/`charged`/`plunge`, so a skill/
	// burst-tagged summon hit is invisible to the per-swing passes and cannot
	// perturb their order-sensitive refresh-merge. The one consumer that wants
	// these sorts its own selection.

	// 7. Sort the event stream by time (stable).
	events.sort((a, b) => a.time - b.time);

	// Deterministic window order (by start, then end).
	windows.sort((a, b) => a.start - b.start || a.end - b.end);

	// 8. Buff windows (post-P4 #5 — parser-side who-buffs-whom-when). Runs
	// AFTER the sorts so the derivation consumes the exact time-ordered
	// event/window streams the renderer-side modules consumed (the
	// afterDuration first-window-per-cast join is order-sensitive). Team
	// context prefers the slot roster (same rule as the NB pass); the
	// element-count/faction maps mirror the renderer's construction exactly.
	{
		const buffTeam = teamCharacters
			? teamCharacters.filter((c): c is CharacterData => c != null)
			: teamChars;
		const buffFactionCounts = teamCharacters
			? computeTeamFactionCounts(teamCharacters)
			: teamFactionCounts;
		let buffElementCounts: ReadonlyMap<
			string,
			ReadonlyMap<Element, number>
		> = teamElementCountsByHolder;
		if (teamCharacters) {
			const m = new Map<string, Map<Element, number>>();
			for (const holder of buffTeam) {
				const counts = new Map<Element, number>();
				for (const other of buffTeam) {
					if (other.id === holder.id) continue;
					if (!other.element) continue;
					counts.set(other.element, (counts.get(other.element) ?? 0) + 1);
				}
				m.set(holder.id, counts);
			}
			buffElementCounts = m;
		}
		const charById = new Map<string, CharacterData>();
		for (const c of [...teamChars, ...buffTeam]) charById.set(c.id, c);
		const buffWindows = deriveBuffWindows({
			tracks,
			hits: hitRecords,
			castEvents: events.filter((e): e is CastEvent => e.kind === 'cast'),
			reactionEvents: events.filter((e): e is ReactionEvent => e.kind === 'reaction'),
			nbBars: events
				.filter((e) => e.kind === 'nightsoulBurst')
				.map((e) => ({ start: e.time, cooldown: e.cooldown })),
			windows,
			constellationLevels: constellationLevels ?? {},
			loadoutMap: loadoutMap ?? {},
			teamFactionCounts: buffFactionCounts,
			teamEnabledReactions,
			teamElementCountsByHolder: buffElementCounts,
			getCharacter: (id) => charById.get(id) ?? null
		});
		if (buffWindows.length > 0) {
			// ⛔ NOT `windows.push(...buffWindows)` — spreading an array as arguments
			// throws RangeError past V8's argument limit (~125k), and buff windows
			// scale with cast count, so a large rotation reaches it. See the same
			// note in expandBrackets.
			for (const w of buffWindows) windows.push(w);
			// Restore the deterministic order; the stable sort keeps buff
			// emission order within (start, end) ties, and the buff-row
			// projections re-order their subset by window id regardless.
			windows.sort((a, b) => a.start - b.start || a.end - b.end);
		}
	}

	return {
		tracks,
		totalDuration: cursor,
		unknownTokens,
		events,
		windows
	};
}
