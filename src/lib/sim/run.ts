/**
 * src/lib/sim/run.ts
 *
 * The DRIVER: it walks the segments, and it is the only thing that moves time
 * (gauge-round L3d).
 *
 * ⚓ A segment is a TURN — one character's on-field window. `clock.now` is the
 * rotation clock, and the turn advances it: a cast pushes it by the resolved
 * cancel-window frames, a `~Xs` pushes it by the requested wait, a cooldown gate
 * pulls it forward to when the ability is actually castable. At the turn's end
 * the swap cost is added and the next character enters.
 *
 * ⚠️⚠️ ONE CLOCK, NOT TWO. This used to be a `cursor` (rotation) / `localCursor`
 * (segment) pair, assigned to each other at every boundary. Collapsing them is
 * the point of this landing: nothing can be SCHEDULED against a time that two
 * variables disagree about.
 *
 * ↻ THE TASK QUEUE IS NO LONGER EMPTY. It was at L3, deliberately, and the
 * prediction made there held exactly: every `clock.advance` below was already
 * the hook, so scheduling needed no new plumbing at any of these sites. Two
 * things ride it now — a cast's own applications at `Band.LAND` (L4d), and a
 * summon's tick chain at `Band.TICK` (L5e-b), each tick rescheduling only the
 * next one and re-checking liveness when it fires.
 *
 * ⚠️ What stayed OFF the queue is still deliberate: the shieldEnd drain and the
 * Nightsoul derivation are order-VISIBLE — moving them moves event ids — so
 * they remain end-of-parse sweeps, and ⛔ `buffWindows` remains a finalize
 * projection (L3 plan §4.2). ⚠️⚠️ The summon-tick HIT synthesis at finalize
 * step 6c is NOT the same thing as the tick chain here: the hits feed
 * `deriveBuffWindows` and must keep their order; the chain feeds the gauge.
 * ⛔ Do not "unify" them — one rule (`summonTickSeries`), two readers.
 *
 * ⚠️ Order-of-operations is this parser's top bug class. The cast pipeline's
 * shared step order is frozen (see `handleCast`), and so is the settle order
 * inside it. ⛔ Do not reorder a shared step to make a diff smaller.
 */

import type { CharacterData } from '$lib/types/character';
import type {
	Ability,
	ActionKey,
	Element,
	FrameMap,
	NormalAbility,
	NormalHit,
	SkillAbility
} from '$lib/types/ability';
import {
	getCooldownStartsAtStanceEnd,
	getCooldownByStanceTime,
	castIsNonHitting,
	getDefaultDamageTag,
	getNormalHitDamageTag
} from '$lib/types/ability';
import { STACK_ASSERT_RE, type Token } from '$lib/utils/tokenizer';
import { resolveActionElement } from '$lib/utils/actionElement';
import { createIcdClock, icdApplies, STANDARD_ICD_FRAMES } from '$lib/utils/icd';
import { schedulePolls } from './absorb';
import {
	hasFreeSkill,
	takeFreeSkill,
	timedBlessingOnAction,
	timedBlessingOnCast,
	timedBlessingOnPlunge
} from './timedBlessing';
import { FPS, frameAt, framesOf, landingsOf, projectileTravelOf } from '$lib/utils/frames';
import {
	GENERIC_NORMAL_HITS,
	GENERIC_SKILL,
	GENERIC_BURST,
	GENERIC_PLUNGE_FRAMES
} from '$lib/data/genericProfile';
import type { ActionEvent, CastEvent, SourceRange } from '$lib/utils/rotationEvents';
import { Band, createClock } from './clock';
import type { SimContext } from './context';
import type { CharacterTrack } from './types';
import type { HitEvent } from './hits';
import {
	DEFAULT_ASCENSION,
	evalCondition,
	matchVariant,
	resolveEffectiveCharges,
	resolveElementRef,
	type ConditionContext
} from './conditions';
import {
	resolveAbilityTiming,
	applyCooldownModifiers,
	resolveActiveAbility,
	resolveChargeCastTime,
	resolveChargeFrameMap,
	resolveEQCastTime,
	resolveNormalCastTime,
	resolveStanceFields
} from './resolve';
import { expandBrackets, isInert, peekActionKey, peekHumanPadTarget } from './tokens';
import { cancelKeyFor, padFramesAfter, type HumanPadAfter } from './humanTiming';
import {
	castKinds,
	clampStance,
	restampStanceCooldown,
	stanceTimeCooldownFrames,
	closeStateWindows,
	holderStatesAt,
	inferredStates,
	applyTransientState,
	materialiseStateChains,
	settleOwnerStates
} from './states';
import {
	nightsoulCharging,
	nightsoulOnCast,
	nightsoulOnSwapOut,
	nightsoulSpend,
	ownsState
} from './nightsoul';
import { findSummonsForBar } from './summons';
import {
	applyDrain,
	applyLifetimeExpiry,
	applyRotationLifetimeExpiry,
	dispatchConsumeStacks,
	dispatchConsumeStacksOnHit,
	dispatchGainStacks,
	dispatchGainStacksOnHit,
	syncOnHitToStackState,
	dispatchGainStacksOnSwapIn,
	syncRotationStacksToStackState,
	syncOnReactionToStackState,
	syncSourceLifetimeToStackState
} from './stacks';
import { dispatchOnCastExtensions } from './extensions';
import { polestarFieldOpenAt } from './fields';
import { dispatchShieldEnds, registerShieldOnCast } from './shields';
import { checkStackThresholds } from './thresholds';
import { infusionAt, registerInfusionsOnCast } from './infusions';
import {
	advanceChain,
	getChainIndexMap,
	getCharacterCdResetTargets,
	type CdResetTarget,
	getWeaponCdResetCooldown
} from './cooldowns';
import {
	dispatchCooldownReduceOnCast,
	dispatchCooldownReduceOnHit,
	reduceCooldown
} from './cooldownReduce';
import {
	emitReactionsAtCast,
	emitAbsorbedAtCast,
	emitReactionsAtSwing,
	handOffLineup,
	notifyDamage,
	notifyNormalAttack,
	retireSummonsOnCast,
	scheduleSummonTicks
} from './aura';
import { armCastProcs } from './procs';

/** Global dash/jump duration approximation (60fps). Character-specific values deferred. */
const DASH_FRAMES = 21;
/** The dash cooldown (gcsim `ApplyDashCD`): a dash inside this window of the
 *  last one starts a lockout of `DASH_LOCKOUT_F`, in which a dash waits. */
const DASH_WINDOW_F = 48;
const DASH_LOCKOUT_F = 90;
/** Fallback cast time when no E/Q frame data is present on the ability (FRAMES).
 *  Sourced from the data-derived generic profile (genericProfile.ts) so a
 *  frameless skill/burst gets a realistic cast length, not a magic constant. */
const E_CAST_F = GENERIC_SKILL.castAnim;
const Q_CAST_F = GENERIC_BURST.castAnim;
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
 * ⚠️⚠️ ⛔ And it is NOT the bound on the sim's work. 2,000 of these tokens is
 * legal input reaching 432 MILLION frames — which is exactly why the clock jumps
 * to the next scheduled instant instead of walking frames (gauge-round.md C6,
 * amended 2026-08-16).
 */
const MAX_TIME_ADVANCE_F = 3600 * FPS;

/**
 * Runs the rotation and returns its total duration in FRAMES. Every mutation
 * lands on `ctx`; the caller finalizes from there.
 */
export function runRotation(
	ctx: SimContext,
	segments: Token[][],
	lookupChar: (name: string) => CharacterData | null
): number {
	const clock = createClock();
	ctx.stackClock = () => clock.now;
	// ⚓ WHICH TURN IS ON FIELD, observed live (cast hit-record round, 2026-09-21).
	// A cast's hit can land after its caster's turn is over — a closure queued in
	// turn `i` asks `liveSegment === i` before it touches that turn's stack pool.
	// ⚠️ The turn, not the character — but a TURN is a stay on field, so a
	// same-character `>` continues it (`carry` below) and the number is the index
	// of the segment that OPENED the stay. The swap frames at a turn's tail still
	// belong to it, which is the same instant `lastSwapOutAt` stamps.
	let liveSegment = -1;

	// ⚓ A SAME-CHARACTER `>` JOINS TWO SEGMENTS INTO ONE TURN (join round,
	// 2026-10-15). `Xilonen E N2 > Xilonen N2` is one stay on field written in two
	// segments, and it must time exactly as `Xilonen E N2 N2`: playback round B
	// dropped the swap delay, a8af205d kept the stance and the swap-ended states,
	// and this carries the rest of what a segment boundary used to reset as if it
	// were a swap — the normal-attack string, the plunge's `lastEText`, the stack
	// pool and the stay's identity (`liveSegment`), plus a cancel lookahead that
	// reads ON into the next segment instead of taking the end-of-segment slice.
	// Measured before: 93f against 129f. Laps reaches it without anybody typing it,
	// since `repeatNotation` joins laps by ' > ' and a rotation that ends on its
	// opener crosses the join every lap.
	// ⚠️ Each segment keeps its own TRACK: the lap marks count tracks per lap
	// (RotationTimeline `lapStarts`), so merging the segments upstream is ⛔ not
	// the fix — it would merge the last track of one lap into the next.
	type TurnCarry = {
		turn: number;
		start: number;
		normalCounter: number;
		lastEText: string | null;
		stackState: Map<string, number>;
		stackInstances: Map<string, number[]>;
	};
	let carry: TurnCarry | null = null;
	// Does segment `k`'s turn continue into `k + 1`? The same test as `swapFollows`
	// (an unknown next name is a swap), asked of any segment.
	const continuesInto = (k: number, charId: string): boolean => {
		const head = segments[k + 1]?.[0];
		return head !== undefined && lookupChar(head.text)?.id === charId;
	};
	// Each segment's bracket expansion, computed once: the lookahead reads the next
	// segment's before its own turn runs.
	const expansions = new Map<number, Token[]>();
	const expansionOf = (k: number): Token[] => {
		let exp = expansions.get(k);
		if (!exp) {
			exp = expandBrackets(segments[k].slice(1));
			expansions.set(k, exp);
		}
		return exp;
	};

	for (let i = 0; i < segments.length; i++) {
		const tokens = segments[i];
		if (tokens.length === 0) continue;

		// First token is always the character-name slot.
		const charToken = tokens[0]; // kind === 'character'
		const char = lookupChar(charToken.text);
		if (!char) {
			ctx.unknownTokens.push(charToken.text);
			continue; // unknown character — skip segment
		}

		// This character's mutable parser state (cooldown clocks, stance window,
		// named states, chains, shields, summon extensions, stack accumulators).
		// Get-or-create; persists across segments.
		const cs = ctx.getCharState(char.id);

		const eAbility = char.abilities.find(
			(a): a is Extract<Ability, { abilityType: 'skill' }> => a.abilityType === 'skill'
		);
		const qAbility = char.abilities.find(
			(a): a is Extract<Ability, { abilityType: 'burst' }> => a.abilityType === 'burst'
		);

		// ⚓ A SWAP-OUT, OBSERVED LIVE (gauge round L5e-b). Finalize answers "when
		// did this character next go off-field" by scanning FORWARD through the
		// finished tracks; a summon tick firing mid-parse cannot. So record it as
		// it happens: everyone who was on field before this segment and is not on
		// it now has just swapped out, at this instant.
		// ⚠️ Only the IMMEDIATELY PRECEDING track's character, never every prior
		// one: walking them all would stamp a later swap-out over a character who
		// has been off-field for ages, and consecutive segments owned by the same
		// character are not a swap-out at all. Both halves are precisely
		// finalize's "the next track with a DIFFERENT characterId".
		const prevTrack = ctx.tracks[ctx.tracks.length - 1];
		if (prevTrack && prevTrack.characterId !== char.id)
			ctx.lastSwapOutAt.set(prevTrack.characterId, clock.now);

		// ⚓ A `>` BETWEEN TWO SEGMENTS OF ONE CHARACTER IS NOT A SWAP (playback
		// round B, 2026-09-29). `Bennett E > Bennett Q` is one stay on field
		// written in two segments: nobody presses the swap key, so no swap delay
		// is charged after this turn and no swap-in pad opens the next. The
		// swap-in stack grant and the swap-out record above already read it this
		// way; the two timing sites below did not, and the Repeat stream — which
		// joins a rotation to itself by a `>` — made the charge visible when a
		// rotation ends on its opener. The swap-out CLOSES at the bottom of the
		// loop (`terminatesOnSwap` states, their chains, the stance clamp) follow
		// the same rule: a turn the same character continues ends nothing, and
		// neither does anything else a boundary resets (see `carry`). An UNKNOWN
		// next name still counts as a swap, as it always has: the segment is
		// skipped, the turn is not.
		const swappedIn = !prevTrack || prevTrack.characterId !== char.id;
		const swapFollows = i < segments.length - 1 && !continuesInto(i, char.id);
		// What the previous segment handed on, when this one continues its turn.
		// Taken here and cleared, so it can only ever reach the segment it was
		// written for.
		const carried = carry as TurnCarry | null;
		carry = null;

		// ⚓ WHO IS ON FIELD, observed live (mark-triggered round, 2026-08-17) —
		// read by `onReaction`'s `source: 'active'`. Set HERE, where the segment
		// opens, because that is where the clock already stands: the swap advance
		// at the bottom of the previous iteration has drained everything before
		// this instant, so no pending task can fire under the wrong owner.
		ctx.activeCharId = char.id;
		// The stay this segment belongs to — its opener's index (see `liveSegment`).
		const turn: number = carried?.turn ?? i;
		liveSegment = turn;

		const track: CharacterTrack = {
			characterId: char.id,
			displayName: char.displayName,
			element: char.element ?? 'pyro',
			activeStart: clock.now,
			activeEnd: clock.now,
			inputBlocks: [],
			hasUnsetDuration: false,
			eBars: [],
			qBars: []
		};

		// Human timing: the incoming character's FIRST input is never buffered —
		// "you have to wait until the new character appears" (KQM) — so the pad
		// lands at the head of every turn but the first, INSIDE the track (the
		// strip starts at the swap's end; the sliver is the wait before the first
		// press). Ahead of `turnStart` on purpose: the pad is not the turn moving.
		if (i > 0 && swappedIn && ctx.humanTiming && ctx.humanTiming.padFrames > 0) {
			const pad = ctx.humanTiming.padFrames;
			ctx.humanPads.push({
				id: ctx.nextId(),
				track,
				start: clock.now,
				duration: pad,
				after: 'swap'
			});
			clock.advance(clock.now + pad);
		}

		// ⚓ The turn starts where the clock is. There is no second cursor:
		// `clock.now` IS the rotation clock, and every advance below moves it.
		// ⚠️ `turnStart` is a WITNESS, not a clock — the min-active clamp below
		// needs to know whether this turn moved time at all.
		const turnStart = clock.now;

		// The source range of the token the main loop is on — stamped onto every
		// event it emits (`src`), which is how the editor learns what the chart
		// resolved for each token. Set at the loop's top; ⚠ every action and cast
		// event is emitted synchronously inside its token's iteration (landings
		// are HIT records, not events), so the loop's token IS the producer.
		let curSrc: SourceRange | undefined;

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
				blockId: fields.blockId ?? id,
				// Every action is emitted while its own token is the loop's — see `curSrc`.
				...(curSrc ? { src: curSrc } : {})
			};
			ctx.events.push(ev);
			ctx.actionRecords.push({ ev, track });
			return ev;
		};

		// This character's cast events across all segments so far (get-or-create;
		// handleCast appends). Used for cross-segment duringSummon detection.
		let charCasts = ctx.castsByChar.get(char.id);
		if (!charCasts) {
			charCasts = [];
			ctx.castsByChar.set(char.id, charCasts);
		}

		// Resolved once per segment so both Q and E handlers see the same value.
		const charConstellationLevel = ctx.constellationLevels?.[char.id] ?? 0;

		// Variant-condition context for this holder (sQ primitive).
		const variantCtx: ConditionContext = {
			teamFactionCounts: ctx.team.teamFactionCounts,
			teamElementCounts: ctx.team.teamElementCountsByHolder.get(char.id)
		};

		const isBow = char.weapon === 'bow';
		// Human timing: a character whose kit stores no input after a Charged
		// Attack (`NormalAbility.noBufferAfterCharged`, Lohen) pads the next swing.
		const chargedBuffers = !char.abilities.some(
			(a) => a.abilityType === 'normal' && a.noBufferAfterCharged === true
		);
		// Tracks which hit in the combo sequence the next N token refers to.
		// Reset at a swap-in and when a stance opens (mid-segment Q cast); a
		// same-character `>` carries it, so `N2 > Xilonen N2` swings N3 and N4.
		let normalCounter: number = carried?.normalCounter ?? 0;
		// Text of the most recent E token cast in this turn. Used by the P handler
		// to auto-select the correct plunge variant (e.g. "hE" → "After Hold E" frames).
		let lastEText: string | null = carried?.lastEText ?? null;
		// Per-turn stack state (resource counts asserted by `{key:N}` tokens).
		// Resets at a swap-in so a swap-out clears the resource pool — matches
		// in-game behavior for Heizou Declension, Yanfei Scarlet Seals, etc.
		// Within the turn, assertions persist across actions until the next
		// assertion of the same key changes the value. ⚠️ A same-character `>` is
		// not a swap-out, so the pool is CARRIED — the same Map, which is what keeps
		// a landing queued in the first segment writing to the live pool.
		const stackState: Map<string, number> = carried?.stackState ?? new Map();
		// Per-turn per-stack-instance expiry list (E3 v2.x lifetime). For each
		// gainStacks key with a `lifetime` spec, this map tracks the absolute
		// expiry times of every individual stack instance. `applyLifetimeExpiry`
		// drops expired instances and updates `stackState[key]` to match the
		// remaining instance count. Per-turn scope (matching `stackState`).
		const stackInstances: Map<string, number[]> = carried?.stackInstances ?? new Map();

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

		// ⚓ TAKING THE FIELD grants stacks too (swap-in stacks round, 2026-09-19 —
		// Neuvillette C1). Fired where the segment opens, for a real swap-in AND for
		// the rotation's first character: a rotation begins with somebody taking the
		// field, and gcsim goes further still (his C1 is a standing base stack).
		// ⚠️ NOT for a second consecutive segment of the same character — that is
		// the same stay on field.
		if (!prevTrack || prevTrack.characterId !== char.id) {
			dispatchGainStacksOnSwapIn(
				char,
				cs,
				clock.now,
				computeCurrentStates(clock.now),
				charConstellationLevel,
				{ state: stackState, instances: stackInstances }
			);
		}

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

		// Character cdResets a cast fires (Kazuha C1: Q resets E; Varka C1: the
		// stance-entering E hands back a Four Winds use). Only the caster's own
		// queues — keys are `{charId}__…` ability ids (or bare charId in the
		// uncurated fallback). A rotation-wide reset would erase teammates'
		// cooldowns. Through the one mover (cooldown-reduction round), so the
		// refunded cast's ghost tail moves with its slot — measured before,
		// `Kazuha E Q E` at C1 placed the second E at 169f under a first-E tail
		// that still ran to 332f. An infinite reduction is a reset; a ready
		// charge is left alone. ⚓ A target that NAMES an ability (`resetsAbility`)
		// reaches that queue alone — Varka's C1 must refund Four Winds and not
		// the Windbound Execution clock the same cast just wrote.
		const fireCharacterCdResets = (targets: CdResetTarget[], at: number): void => {
			for (const target of targets) {
				if (target.kind === 'burst') {
					reduceCooldown(ctx, char.id, 'burst', undefined, Infinity, at);
				} else if (target.abilityId !== undefined) {
					reduceCooldown(ctx, char.id, 'skill', target.abilityId, Infinity, at);
				} else {
					for (const key of ctx.eChargeQueues.keys()) {
						if (key !== char.id && !key.startsWith(`${char.id}__`)) continue;
						reduceCooldown(ctx, char.id, 'skill', key, Infinity, at);
					}
				}
			}
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
			applyDrain(ctx, char, t, states, stackState);
			applyLifetimeExpiry(char, t, stackState, stackInstances);
			syncSourceLifetimeToStackState(char, t, stackState, ctx.getCharState);
			syncOnReactionToStackState(char, t, stackState, stackInstances, ctx.getCharState);
			syncOnHitToStackState(char, t, stackState, stackInstances, ctx.getCharState);
			// ↻ And the rotation-scoped keys, which is what makes a mark applied in
			// a PREVIOUS segment readable in this one (summon-tick stacks round).
			syncRotationStacksToStackState(char, t, stackState, stackInstances, ctx.getCharState);
		};

		// Dispatches a parser-private hit: gains → stacks snapshot → consumes →
		// record. `settle` is true at action sites (the cast pipeline already
		// settled at the cast instant). The hit's `stacks` snapshot is post-gain
		// pre-consume (the cast `stackContext` convention); cast-site hits carry
		// the cast's own snapshot instead (pre-set by the caller).
		//
		// ⚓ `live` is false for ONE caller: a cast whose hit lands after its caster
		// left the field (cast hit-record round, 2026-09-21 — Amber's Bunny, Klee's
		// mines). This segment's pool is dead by then, and the on-field character's
		// is somebody else's, so the stack dispatchers get the NULL pool a summon
		// tick gets — same ruling, same reason (`stacks.ts`' header), and the same
		// expiry-first step `dispatchEntityHitStacks` takes in place of a settle.
		const dispatchHit = (hit: HitEvent, settle: boolean, live = true): void => {
			if (ctx.team.teamHasOnHitStackEffects) {
				if (!live) {
					for (const holder of ctx.team.teamChars)
						applyRotationLifetimeExpiry(holder, hit.time, ctx.getCharState);
				} else if (settle) settleStacksAt(hit.time);
				// One resolver for every holder (self included) — onHit condition
				// eval gets uniform state semantics regardless of who holds the
				// effect (holderStatesAt's summon check is broader than the
				// segment's `computeCurrentStates`; see its decl).
				const getHolderStates = (holder: CharacterData): ReadonlySet<string> =>
					holderStatesAt(ctx, holder, hit.time);
				// ⚠️ A live segment pool HERE and null on the summon-tick chain — the
				// hitter is the on-field character by construction at every one of
				// this function's four call sites.
				const segPools = live ? { state: stackState, instances: stackInstances } : null;
				dispatchGainStacksOnHit(
					ctx.team.teamChars,
					hit,
					getHolderStates,
					ctx.team.constellationByHolder,
					ctx.getCharState,
					segPools,
					(t) => polestarFieldOpenAt(ctx.stellarConductTimes, t)
				);
				if (live && hit.stacks === undefined && stackState.size > 0)
					hit.stacks = new Map(stackState);
				dispatchConsumeStacksOnHit(
					ctx.team.teamChars,
					hit,
					getHolderStates,
					ctx.team.constellationByHolder,
					ctx.getCharState,
					segPools,
					(holder, state, at) =>
						closeStateWindows(ctx, ctx.getCharState(holder.id), holder.id, state, at)
				);
				// A hit is one of the four places a count moves (stack-threshold
				// round, 2026-09-18). Inside the guard on purpose: with no onHit
				// stack effect on the team, a hit cannot move a count.
				checkStackThresholds(
					ctx,
					clock,
					hit.time,
					segPools ? { charId: char.id, pools: segPools } : null
				);
			}
			// A hit is where a `cooldownReduce` most often fires (Varka's Secret
			// Rite, Raiden C6, Sara C1). Outside the stack guard — it has its own
			// per-team precompute and is free when nobody authors one.
			dispatchCooldownReduceOnHit(ctx, hit);
			ctx.hitRecords.push(hit);
			// ⚓ THE DAMAGE STREAM IS THIS STREAM (coordinated-attack round,
			// 2026-08-18) — one hit the opponent took, offered to every armed
			// `onHit` damage proc. Notified from inside `dispatchHit` rather than at
			// its four call sites so a future hit site cannot forget it, and AFTER
			// the stack dispatch so a proc can never observe half-applied stacks.
			//
			// ⚠️ It fires for a cast that deals no damage at all (a stance opener,
			// Xiao's burst), because nothing in the corpus says a cast is damageless
			// — `application: []` says it APPLIES nothing, which is a different
			// claim. gcsim's `OnEnemyDamage` would not fire there. The same
			// approximation every `onHit` buff already makes; §5 of the round doc
			// carries it.
			notifyDamage(ctx, clock, hit);
		};

		// ⚓⚓ A SWING LANDS AT ITS HITMARK, NOT AT ITS END (§1.K, 2026-09-20).
		// A swing's application, its second hand's and its hit record are ONE
		// instant (⚓ Nate: everything stays synced), so each site hands them over
		// as a single `land(at)` and this decides when it runs. Where the map
		// states a landing frame earlier than the swing's end, it is a `Band.LAND`
		// task — ⚠️⚠️ queued BEFORE the advance, which is the whole contract: the
		// advance then fires it in order with every summon tick inside the swing,
		// where an offer made after the advance but stamped earlier would land
		// BEHIND ticks it precedes (feed order = time order is pinned corpus-wide).
		//
		// ⚠️ Returns false for an unmeasured map, a landing at or past the end (a
		// swing cancelled before it connects still lands at the cancel — it only
		// ever moves EARLIER than this model always placed it), and a swing with
		// no cast time; the caller then lands it synchronously after the advance,
		// exactly as before. ⛔ Don't route that case through the queue "for
		// uniformity": at the swing's end the hit must follow the state opener
		// that shares its instant, and a task would fire ahead of it.
		//
		// ⚠️ The closure runs mid-advance with the SEGMENT's live stack pool, which
		// is sound only because the landing is inside the swing — the on-field
		// character cannot have changed.
		//
		// ↻⚓ ONE TASK PER LANDING (every-landing round, 2026-09-21). A swing can
		// land two, three or four hits and each is a hit: ICD counts them, and so
		// does every `onHit`. `landingsOf` lists them; each one inside the swing is
		// its own `Band.LAND` task running the SAME closure (application →
		// co-application → hit record). Landings at or past the swing's end — a
		// cancel cut them off — are returned as a COUNT and landed by the caller,
		// synchronously after the advance, together. An unmeasured map is one such
		// landing, which is the old `false`.
		// ⚠️ What does NOT multiply: the action event, the input block, the wave's
		// span, `hitIndex` (the COMBO index — N4's second hit is still 3) and the
		// swing's resolved element (a granted infusion resolves per swing).
		//
		// ↻⚓ A PROJECTILE LANDS AFTER ITS RELEASE (projectile-travel round,
		// 2026-09-21). `travel > 0` is a bow's arrow or a flagged catalyst's orb:
		// the map's frame is when it LEAVES, and it lands `travel` later — very
		// often past the swing's end (a bow N1 cancelled at release), sometimes
		// after a swap. So a projectile landing is ALWAYS a task, never the
		// synchronous path: its release clamps to the swing's end (a cancel cannot
		// un-fire an arrow, only hurry it), and an unmeasured map releases there.
		// ⚠️ No tie with the state opener at the swing's end — it lands after it.
		// ⚓ `live` is the cast hit-record round's answer to "whose stack pool":
		// false once this TURN is over, and the closure then takes the NULL pool
		// and marks the hit `offField`. ⛔ Never the new on-field character's.
		const landSwing = (
			start: number,
			swingF: number | null,
			fm: FrameMap | null | undefined,
			land: (at: number, live: boolean) => void,
			travel = 0,
			landsAfterCancel = false
		): number => {
			const frames = fm ? landingsOf(fm) : [];
			const queue = (at: number): void =>
				clock.schedule(at, Band.LAND, () => land(at, liveSegment === turn));
			// ⚓ Landings queued at the PRESS (`chargeLandsAfterCancel`): each lands
			// on its own frame whatever cancels the swing, a projectile's rule
			// without the release clamp or the travel.
			if (landsAfterCancel && swingF !== null && frames.length > 0) {
				for (const f of frames) queue(start + f + travel);
				return 0;
			}
			if (travel > 0 && swingF !== null) {
				for (const f of frames.length > 0 ? frames : [swingF])
					queue(start + Math.min(f, swingF) + travel);
				return 0;
			}
			if (frames.length === 0 || swingF === null) return 1;
			let late = 0;
			for (const f of frames) {
				if (f >= swingF) late++;
				else queue(start + f);
			}
			return late;
		};

		// Expand bracket repeat groups (e.g. 2[N5C] → N5 C N5 C) before the main
		// loop so that lookahead and counter logic see a flat token sequence.
		const expandedTokens = expansionOf(i);

		// ⚓ The CANCEL LOOKAHEAD reads past a same-character `>` (see `carry`):
		// the last action before the join takes the slice for the next segment's
		// first action, as it would written in one segment, instead of the
		// end-of-segment 'swap' slice. Appends segment after segment while the
		// turn continues and nothing it appended could stop a peek (a segment of
		// only `(Q)` or `{key:N}`). `lookaheadSwapFollows` is `swapFollows` asked
		// of the last segment appended — what the human pad needs at the very end.
		// The loop below still walks `expandedTokens` alone; indices agree because
		// the lookahead only ever appends.
		let lookahead = expandedTokens;
		let lookaheadEnd = i;
		while (continuesInto(lookaheadEnd, char.id)) {
			const next = expansionOf(++lookaheadEnd);
			lookahead = lookahead.concat(next);
			if (next.some((t) => !isInert(t))) break;
		}
		const lookaheadSwapFollows =
			lookaheadEnd < segments.length - 1 && !continuesInto(lookaheadEnd, char.id);

		// Unified E/Q cast pipeline. One sequence with small kind-branches; the
		// shared step order is the Q handler's (the reference the 2026-07-05 bug
		// sweep #5 copied to fix E). Order-of-operations is this parser's top bug
		// class — do NOT reorder shared steps. The complete kind asymmetry:
		// cursor settle, CD-write timing, weapon sac-proc (E-only), character
		// cdReset targets (Q-only), lastEText (E-only), and the no-ability
		// fallbacks. `tok`/`j` are passed (not closed over) so the pipeline reads
		// against its arguments, not the loop cursor.
		// Human timing (`./humanTiming.ts`): the pad AFTER the action at token `j`,
		// when the next input is one the game does not buffer. Called once per
		// action, after its own advance, so the pad sits between the action's end
		// and the next input's start and the id minted here sorts it there.
		// ⚠️ `lookaheadSwapFollows` is the ONLY way a turn's last action learns
		// whether a swap is real: `peekActionKey` says 'swap' at the end of EVERY
		// lookahead, including the rotation's last, where nothing follows to be
		// late for. A same-character `>` never gets here — the lookahead reads on.
		const humanPad = (prev: HumanPadAfter, j: number): void => {
			const ht = ctx.humanTiming;
			if (!ht) return;
			const next = peekHumanPadTarget(lookahead, j, isBow, lookaheadSwapFollows);
			if (next === null) return;
			const pad = padFramesAfter(ht, prev, next, isBow, chargedBuffers);
			if (pad <= 0) return;
			ctx.humanPads.push({ id: ctx.nextId(), track, start: clock.now, duration: pad, after: prev });
			clock.advance(clock.now + pad);
		};

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
						computeCurrentStates(clock.now),
						charConstellationLevel,
						getChainIndexMap(ctx, char.id, clock.now),
						stackState,
						variantCtx
					)?.bypassesCooldown === true;
				if (!bypassesGate) clock.advance(Math.max(clock.now, cs.qReadyAt));
			}

			if (ability) {
				const nextKey = peekActionKey(lookahead, j, isBow);

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
						const scanStates = computeCurrentStates(clock.now);
						const scanE =
							resolveActiveAbility(
								char,
								'skill',
								scanStates,
								charConstellationLevel,
								getChainIndexMap(ctx, char.id, clock.now),
								stackState,
								variantCtx
							) ?? (ability as SkillAbility); // !isBurst branch: `ability` is the skill
						// Initialize this ability's charge queue on first sight:
						// all charges ready at t=0.
						// ⚓ A skill that SHARES its sibling's charges reads that pool
						// (`sharesChargesWith`, Varesa's two Rushes: gcsim has one skill).
						const scanKey = scanE.sharesChargesWith ?? scanE.id;
						if (!ctx.eChargeQueues.has(scanKey)) {
							const scanVariant = matchVariant(
								scanE,
								tok.text,
								scanStates,
								charConstellationLevel,
								getChainIndexMap(ctx, char.id, clock.now),
								stackState,
								variantCtx
							);
							ctx.eChargeQueues.set(
								scanKey,
								new Array(resolveEffectiveCharges(scanE, scanVariant, charConstellationLevel)).fill(
									0
								)
							);
						}
						// A free skill (a timed Blessing's entry) needs no charge.
						if (hasFreeSkill(ctx, char, clock.now)) break;
						// queue[0] is the earliest-ready charge (kept sorted ascending).
						const readyAt = ctx.eChargeQueues.get(scanKey)![0];
						if (readyAt <= clock.now) break; // castable now
						const boundary = nextOwnWindowEnd(clock.now);
						// Advance to the next event: either a charge returns, or a
						// window ends first (where resolution may flip — re-scan).
						clock.advance(boundary !== null && boundary < readyAt ? boundary : readyAt);
					}
				}

				// The cast instant — captured before the cursor advances and passed
				// to every cast-time consumer for both kinds (Q's old `qStart` and
				// E's old `localCursor - eCast` are this same instant, computed
				// differently in the twin handlers).
				const castStart = clock.now;

				// ── Time-advancing evaluations at the cast instant (shared order).
				// Fire expired shield-ends first (so onShieldEnd-bound conditions
				// see post-event state), then decay/expire stacks BEFORE resolving
				// the active variant so any condition reading stackState sees
				// decayed/expired values.
				dispatchShieldEnds(ctx, castStart);
				// The cast is an input: close what ends on one and write what chains
				// from it, BEFORE the snapshot this cast resolves against (Lauma's
				// deer ends at the E that follows it). ⚠️ At `castStart`, the
				// post-wait instant — a deer waited through an E cooldown ends when
				// the E fires, not when the player pressed it.
				settleOwnerStates(ctx, cs, char.id, castStart);
				const states = computeCurrentStates(castStart);
				applyDrain(ctx, char, castStart, states, stackState);
				applyLifetimeExpiry(char, castStart, stackState, stackInstances);
				syncSourceLifetimeToStackState(char, castStart, stackState, ctx.getCharState);
				syncOnReactionToStackState(char, castStart, stackState, stackInstances, ctx.getCharState);
				// Appended by the onHit wiring (2026-07-17) — an APPEND to the
				// frozen settle order, not a reorder: syncs team/others-sourced
				// onHit accrual into the segment before conditions read it.
				syncOnHitToStackState(char, castStart, stackState, stackInstances, ctx.getCharState);
				syncRotationStacksToStackState(
					char,
					castStart,
					stackState,
					stackInstances,
					ctx.getCharState
				);
				const chainIdx = getChainIndexMap(ctx, char.id, castStart);
				// Resolve the active variant (chain-stage + state + stack aware).
				const active =
					resolveActiveAbility(
						char,
						kind,
						states,
						charConstellationLevel,
						chainIdx,
						stackState,
						variantCtx
					) ?? ability;
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
					const chargeKey = (active as SkillAbility).sharesChargesWith ?? active.id;
					if (!ctx.eChargeQueues.has(chargeKey)) {
						ctx.eChargeQueues.set(chargeKey, new Array(maxCharges).fill(0));
					}
					queue = ctx.eChargeQueues.get(chargeKey)!;
				}

				const castTime = resolveEQCastTime(
					active,
					variant,
					cancelKeyFor(ctx.humanTiming, kind, nextKey, isBow)
				);
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
					stackState,
					// ⚓ Team scope so a `teamElementCount`-gated cooldown modifier can
					// RESOLVE rather than evaluate null and be skipped (Itto C2).
					{ teamElementCounts: ctx.team.teamElementCountsByHolder.get(char.id) },
					ctx.team.skillCooldownModifiers
				);

				// Apply gainStacks matching this cast BEFORE the snapshot, so the
				// cast's stackContext reflects post-grant state (symmetric with
				// Path B's `{key:N}` assertion which precedes the cast in the token
				// stream and is read by the snapshot).
				dispatchGainStacks(
					char,
					cs,
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
				// Frames from the cast to the cooldown clock's start — the variant's
				// own when it states one (Alyosha's Hold), else the base's. ONE value
				// for all three readers below (readyAt, the startsOnCooldown chain,
				// the cd-reset instant), so they cannot disagree on a hold.
				const cdStartDelay = variant?.cooldownStartDelay ?? active.cooldownStartDelay ?? 0;
				// ⚓ A cooldown whose LENGTH is the stance's (`cooldownByStanceTime`,
				// Tartaglia, 2026-10-16): resolved here, against this cast's modifiers
				// and states, and handed to the stance record for `clampStance`. The
				// cast's own `cooldown` / `readyAt` are the natural-expiry answer — the
				// stance running its full length — which is what nothing else moving
				// means.
				const cdSpec = cdStartsAtStanceEnd ? getCooldownByStanceTime(active) : undefined;
				const teamCtx = { teamElementCounts: ctx.team.teamElementCountsByHolder.get(char.id) };
				const cdTable = cdSpec
					? {
							lengthFor: (ranF: number) =>
								applyCooldownModifiers(
									stanceTimeCooldownFrames(cdSpec, ranF),
									active,
									variant,
									states,
									charConstellationLevel,
									chainIdx,
									stackState,
									teamCtx,
									ctx.team.skillCooldownModifiers
								),
							resets:
								cdSpec.resetIfBurstInStance !== undefined &&
								evalCondition(
									cdSpec.resetIfBurstInStance,
									DEFAULT_ASCENSION,
									states,
									charConstellationLevel,
									chainIdx,
									stackState,
									teamCtx
								) === true
						}
					: undefined;
				const castCd = cdTable ? cdTable.lengthFor(dur) : cd;
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
					variantLabel: variant?.label,
					label: tok.text,
					src: { from: tok.from, to: tok.to },
					time: castStart,
					castTime,
					uptime: dur,
					cooldown: castCd,
					readyAt: cdStartsAtStanceEnd ? castStart + dur + castCd : castStart + cdStartDelay + cd,
					summonActivatesAt: spawn,
					fieldStart: castStart + (spawn ?? 0),
					stackContext: stacks
				};
				// The element the cast's first hit LANDS, when it is not the caster's
				// own (`CastEvent.element`): Varka's Four Winds and burst open with the
				// right-hand claymore. Resolved from the same `application[]` the
				// gauge is fed (variant's replaces the base's, the array rule), so the
				// pill and the aura lane's first pip cannot disagree.
				const castApps = variant?.application ?? active.application;
				{
					const first = resolveElementRef(castApps?.[0]?.element, variantCtx);
					if (first !== undefined && first !== char.element) castEvent.element = first;
				}
				// ⚓ The cast's LANDINGS (cast hit-record round, 2026-09-21): every entry
				// of the NOMINAL list, first to last — ⛔ not of the ICD-gated one, a
				// hit its counter suppressed still landed (contract C4), and ⛔ not
				// only the elemental ones, a physical opener (Xinyan's burst) is the
				// cast's first hit. ↻ EVERY one is a hit since the every-landing round
				// (same day): `application[]` IS the per-landing list a swing's `lands`
				// has to author. Stable sort — entries on one frame keep list order.
				// ⚠️ An ABSORBED entry is left out: whether it lands at all is known
				// only at its frame (the lock), so counting it would claim a hit that
				// may not exist — a small under-count when it does.
				const landings =
					castApps && castApps.length > 0 && !castIsNonHitting(active, variant)
						? [...castApps]
								.filter((a) => !(typeof a.element === 'object' && a.element.type === 'absorbed'))
								.sort((a, b) => a.frame - b.frame)
						: [];
				if (landings.length > 0) {
					castEvent.firstHitAt = castStart + landings[0].frame;
					castEvent.hitsAt = landings.map((l) => castStart + l.frame);
				}
				ctx.events.push(castEvent);
				ctx.castRecords.push({ ev: castEvent, track });
				charCasts.push(castEvent);
				// Apply consumeStacks AFTER the snapshot so the bar reflects the
				// pre-consume value the perStack BuffValue consumer needs to read.
				dispatchConsumeStacks(
					char,
					cs,
					kind,
					states,
					charConstellationLevel,
					chainIdx,
					stackState,
					tok.text,
					stackInstances
				);
				// A cast is one of the four places a count moves (stack-threshold
				// round, 2026-09-18). After the snapshot and beside the consume,
				// because a threshold fire IS a consume: the cast's `stackContext`
				// reads the post-gain, pre-spend value, the convention above.
				checkStackThresholds(ctx, clock, castStart, {
					charId: char.id,
					pools: { state: stackState, instances: stackInstances }
				});

				// ── CD write (kind-specific).
				if (isBurst) {
					// Same delay-adjusted instant the event was initialized with.
					// A bypassesCooldown variant (Flins Thunderous Symphony) leaves
					// the shared burst clock untouched — its own resolved cooldown
					// still renders on the bar, but neither gates nor writes the
					// clock (gcsim: Symphony sets no CD).
					if (variant?.bypassesCooldown !== true) cs.qReadyAt = castEvent.readyAt;
				} else if (takeFreeSkill(ctx, char, castStart)) {
					// ⚓ A FREE SKILL (`TimedBlessingSpec.freeSkillOnEntry`, Varesa): no
					// charge spent, no cooldown started — the next E is as ready as the
					// earliest charge already was (gcsim `freeSkill` skips SetCD).
					castEvent.cooldown = 0;
					castEvent.readyAt = Math.max(castStart, queue![0]);
				} else {
					// Ready-at for the slot we just consumed. Sac Bow proc may
					// override this with hitmark time (skill instantly available
					// again). Defer the queue write until after the proc check —
					// writing first and sorting leaves queue[0] pointing at a
					// different charge, so the proc would reset the wrong slot.
					let consumedReadyAt = castEvent.readyAt;
					// ⚓⚓ CHARGES RECHARGE ONE AT A TIME (cooldown-reduction round,
					// 2026-09-18). A charge spent while another is still recharging
					// does not start its own clock until that one finishes — gcsim's
					// `cdQueue` is a sequential worker, and it is the in-game rule.
					// Measured before: `Klee E E E` returned both charges at 20s, so
					// the third E landed at 1233f where in game it waits until
					// 2433f. ⚠️ `queue[0]` is the slot being spent (ready, ≤ now);
					// the last slot is the END of the chain, and the new clock is
					// appended to it rather than started at its own delay. The
					// ghost tail follows, so the bar still ends where a recast can
					// be placed — the barPhases ruling. The sac-proc branch below
					// may still reset it to the hitmark; a reset beats a queue.
					if (queue!.length > 1) {
						const chainEnd = queue![queue!.length - 1];
						const ownClockStart = castEvent.readyAt - cd;
						if (chainEnd > ownClockStart) {
							const shift = chainEnd - ownClockStart;
							consumedReadyAt += shift;
							castEvent.readyAt += shift;
						}
					}
					// Weapon cdReset (Sacrificial series): proc fires onHit (≈ end
					// of cast animation), not onCast. hitTime approximates hitmark.
					const sacCd = getWeaponCdResetCooldown(char.id, ctx.loadoutMap);
					if (sacCd !== null) {
						const hitTime = castStart + castTime;
						if (hitTime >= cs.sacProcReadyAt) {
							// Proc fires: the consumed charge is available again from hitmark.
							consumedReadyAt = hitTime;
							const procEnd = hitTime + sacCd;
							cs.sacProcReadyAt = procEnd;
							const bars = ctx.weaponProcBars.get(char.id) ?? [];
							bars.push({ start: hitTime, end: procEnd, sourceCastId: castId });
							ctx.weaponProcBars.set(char.id, bars);
							castEvent.sacProcFired = true;
							castEvent.readyAt = hitTime;
						}
					}
					// Write the consumed slot's final ready-at and re-sort so
					// queue[0] stays the earliest-ready charge.
					queue![0] = consumedReadyAt;
					queue!.sort((a, b) => a - b);
				}
				// An `onCast` cooldownReduce on the caster's own cast (Itto C2),
				// AFTER the CD write so it sees the clock it shortens.
				dispatchCooldownReduceOnCast(ctx, char.id, kind, tok.text, castStart, stackState);

				// ⚓⚓ THE CAST PIPELINE SCHEDULES BEFORE IT ADVANCES (2026-08-17).
				// The clock does NOT move here — it moves at the very BOTTOM of this
				// branch, once every emitter below has queued its work. The pipeline
				// therefore runs with `clock.now === castStart`, so a task landing
				// INSIDE the cast animation is queued at its own frame instead of
				// being clamped forward to the animation's end.
				//
				// ⚠️ Why the clamp was not harmless: `gauge.advanceTo` is
				// `while (frame < target)`, so a backwards advance is a NO-OP and an
				// application offered out of order lands at the LATER offer's frame.
				// Measured over the projections corpus, the clamp produced 130
				// out-of-order offers, **37 of them CROSS-ELEMENT** — a Xiangling
				// Pyronado tick reaching the gauge 30 frames before the Xingqiu hydro
				// it should have followed, which decides which way the vaporize runs.
				// ⛔ The sort in `collectApplications` was never the fix: it made the
				// projection honest and left the feed wrong.
				//
				// ⚠️⚠️ The `<name> E Q` census this defect was first measured with
				// reports 4 inversions and ZERO cross-element, and that is a property
				// of the CENSUS rather than of the engine — a summon and its caster
				// share an element, so ONE character can never exhibit the case.
				// ⛔ Never re-scope this measurement to a single character again.
				//
				// `castEnd` is the instant the clock will reach; it is named so the two
				// consumers below read exactly what they read when the advance was here.
				const castEnd = castStart + castTime;
				if (!isBurst) lastEText = tok.text; // plunge-variant selection
				advanceChain(ctx, active, char.id, kind, castEnd);

				// Q only: character cdReset — refund a charge on each affected
				// ability whose CD the burst resets (Kazuha C1: Q resets E).
				if (isBurst) {
					fireCharacterCdResets(
						getCharacterCdResetTargets(
							char,
							'burst',
							charConstellationLevel,
							states,
							chainIdx,
							stackState,
							variantCtx
						),
						castEnd
					);
				}

				// ⚓ The cast's effect on a Nightsoul pool (Mavuika): enter or refill,
				// change form, pause. BEFORE this cast opens its own stance (a Hold-E
				// bike stance it supersedes is clamped there) and before it schedules
				// its summons (a Tap's Ring reads the Ring form this opens). A summon
				// that spawns at the swap-out off this cast's form is handed over as a
				// closure — the cast's own arguments, called back at the swap.
				// ⚓ Sourcewater Droplets (`ChargeChannel`): recorded with their FUTURE
				// spawn instant, which a channel's absorb reads — the clock is
				// monotonic, so nothing earlier can count one that has not landed.
				// A timed Blessing's points — the RESOLVED form's own: a variant
				// speaks for itself (Volcano Kablam adds none).
				if (char.timedBlessing)
					timedBlessingOnCast(
						ctx,
						clock,
						char,
						variant ? variant.blessingPoints : active.blessingPoints,
						castStart,
						castId
					);
				for (const d of active.spawnsDroplets ?? []) {
					const life = char.abilities.find(
						(a): a is NormalAbility => a.abilityType === 'normal' && a.chargeChannel !== undefined
					)?.chargeChannel?.dropletLife;
					if (life === undefined) continue;
					const list = ctx.droplets.get(char.id) ?? [];
					for (let n = 0; n < d.count; n++)
						list.push({ spawn: castStart + d.at, end: castStart + d.at + life });
					ctx.droplets.set(char.id, list);
				}
				if (char.nightsoulPool) {
					const deferred = findSummonsForBar(
						char,
						kind,
						tok.text,
						active.id,
						variant?.label ?? null
					).some((sm) => sm.spawnsAtSwapOutFrom !== undefined);
					const castStates = states;
					const castStacks = new Map(stackState);
					nightsoulOnCast(
						ctx,
						clock,
						char,
						cs,
						variant?.nightsoul ?? active.nightsoul,
						castStart,
						castId,
						deferred
							? (at: number) =>
									scheduleSummonTicks(
										ctx,
										clock,
										char,
										kind,
										tok.text,
										active.id,
										variant?.label,
										castStart,
										spawn,
										castEvent,
										undefined,
										castStates,
										charConstellationLevel,
										chainIdx,
										castStacks,
										castApps,
										at
									)
							: undefined
					);
				}

				// A burst inside a still-open stance (Tartaglia's C6: the exit then
				// RESETS his skill instead). Marked before any stance this cast opens
				// replaces the record; a natural expiry is never clamped, so a reset
				// re-stamps the clock here as well as at an early end.
				if (isBurst && cs.stance && cs.stance.end > castStart) {
					cs.stance.burstInStance = true;
					if (cs.stance.cdTable?.resets) restampStanceCooldown(ctx, cs.stance);
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
						holdsField:
							active.behavior === 'stance' && 'holdsField' in active && active.holdsField === true,
						...(cdTable ? { cdTable } : {}),
						ownerAbility: active,
						castRef: castEvent, // ref for the finalize uptime stamp
						characterId: char.id,
						start: castStart,
						source: kind,
						sourceCastId: castId,
						ownerUptime: dur,
						extCounts: new Map(),
						extLastFire: new Map(),
						procCounts: new Map()
					};
					// Retain every opened stance window for the IR (cs.stance is
					// replaced per cast; extensions/swap-close mutate this same
					// object in place, so the collected record stays current).
					ctx.stanceWindowRecs.push(cs.stance);
					// The stance's landed element for the PILL (`CastEvent.stanceElement`):
					// the in-stance normal's resolved infusion, when not the caster's own.
					{
						const inStanceStates = new Set([...states, 'inStance']);
						if (stance.opensState) inStanceStates.add(stance.opensState);
						const stanceNormal = resolveActiveAbility(
							char,
							'normal',
							inStanceStates,
							charConstellationLevel,
							undefined,
							undefined,
							variantCtx
						);
						const landed = resolveElementRef(stanceNormal?.infusion, variantCtx);
						if (landed !== undefined && landed !== char.element) castEvent.stanceElement = landed;
					}
					// ⚓ A sibling skill that `startsOnCooldown` begins recharging
					// HERE (cooldown-reduction round, 2026-09-18): Varka's Four Winds'
					// Ascension "starts on cooldown and has 2 maximum uses", so its
					// queue is written as one chain from the base skill's cooldown
					// clock — `start + cd`, `start + 2cd` — and re-written on every
					// re-entry (gcsim discards the in-progress queue and starts a
					// fresh one, `skill.go:105-118`). The clock's start is the base
					// skill's own `cooldownStartDelay`, which is where gcsim's
					// stance-entry block runs (the status is added at the hitmark).
					// ⚠️ Only reachable with the reduction that closes the loop —
					// see the field's doc and the round's §0.
					if (kind === 'skill') {
						const clockStart = castStart + cdStartDelay;
						for (const sib of char.abilities) {
							if (sib.abilityType !== 'skill' || sib.startsOnCooldown !== true) continue;
							if (sib.id === active.id) continue;
							const n = resolveEffectiveCharges(sib, undefined, charConstellationLevel);
							const sibCd = resolveAbilityTiming(
								sib,
								undefined,
								new Set([...states, 'inStance']),
								charConstellationLevel,
								chainIdx,
								stackState,
								variantCtx,
								ctx.team.skillCooldownModifiers
							).cooldown;
							const chain: number[] = [];
							for (let i = 1; i <= n; i++) chain.push(clockStart + i * sibCd);
							ctx.eChargeQueues.set(sib.id, chain);
						}
					}
					// Open named state alongside inStance (e.g. nightsoulBlessing).
					// `opensState: "inStance"` is redundant (the stance IS the
					// inStance window — post-P4 #4 they are one record); skip it so
					// no source-less duplicate shadows the extension-adjusted one.
					if (stance.opensState && stance.opensState !== 'inStance') {
						cs.states.set(stance.opensState, endTime);
						const companionRec = {
							characterId: char.id,
							name: stance.opensState,
							start: castStart,
							end: endTime,
							sourceCastId: castId
						};
						ctx.stateWindowRecs.push(companionRec);
						// ⚓ Kept on the stance so a duration extension moves BOTH ends —
						// see `StanceRecord.companion`. The swap-close clamp below already
						// walks `cs.states` and the recs, so only the extension needed this.
						cs.stance.companion = { name: stance.opensState, rec: companionRec };
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
						applyTransientState(
							ctx,
							active.opensTransientState,
							cs,
							char.id,
							active.opensTransientState.atFirstHit === true
								? (castEvent.firstHitAt ?? castStart)
								: castStart,
							states,
							charConstellationLevel,
							{ sourceCastId: castId, source: kind },
							chainIdx,
							stackState
						);
					}
				}
				// A SKILL-fired character cdReset (2026-09-18) — after the stance
				// opening above, because the queue it refunds may be the chain that
				// opening just wrote: Varka's C1 "obtain an additional use of Four
				// Winds' Ascension" is gcsim's `ResetActionCooldown(ActionSpecialSkill)`
				// run right after the stance-entry block puts every charge on
				// cooldown (`skill.go:105-118`, `c1OnSkill`). ⚠️ At the cast's
				// COOLDOWN CLOCK start, not its end: that is the instant the chain
				// was written from, so the head lands exactly on it. The burst-fired
				// site above keeps its cast-end instant (Kazuha C1 is unchanged).
				if (!isBurst) {
					fireCharacterCdResets(
						getCharacterCdResetTargets(
							char,
							'skill',
							charConstellationLevel,
							states,
							chainIdx,
							stackState,
							variantCtx
						),
						castStart + cdStartDelay
					);
				}
				// Variant consumes a transient state (gcsim DeleteStatus on cast):
				// Thunderous Symphony closes `symphonyWindow`, Volcano Kablam closes
				// `apexDrive`. The cast itself resolved under the pre-close `states`
				// snapshot, so ordering within this cast is immaterial; the window
				// record is clamped to the cast start for rendering.
				if (variant?.consumesState !== undefined) {
					closeStateWindows(ctx, cs, char.id, variant.consumesState, castStart);
				}
				// ⚓ This cast ENDS the caster's stance (`EndsStance`): Zibai's last
				// Stride, Nilou's third step, Wanderer's Windfavored burst. Read off
				// the variant first, then the ability. Only a stance OPEN at the cast
				// can be closed — the guard keeps a stance opened by this very cast
				// (none today) and a long-expired one out of it.
				{
					const ends = variant?.endsStance ?? active.endsStance;
					if (
						ends &&
						cs.stance &&
						cs.stance.start < castStart &&
						cs.stance.end > castStart &&
						(ends.conditions === undefined ||
							evalCondition(
								ends.conditions,
								DEFAULT_ASCENSION,
								states,
								charConstellationLevel,
								chainIdx,
								stacks,
								variantCtx
							) === true)
					) {
						// The OWNER BAR ends with it, inside `clampStance`: the bar is the
						// stance, and the IR's strict stance geometry (bar end === window
						// end) holds — for a swap too since 2026-10-16.
						clampStance(
							ctx,
							cs,
							char.id,
							ends.at === 'castEnd' ? castEnd : castStart + ends.at,
							// gcsim starts Tartaglia's clock 11f after the recast (`exitDelay`).
							getCooldownByStanceTime(cs.stance.ownerAbility)?.exitDelay ?? 0
						);
					}
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
					ctx.summonExtRecs.push(cs.summonExt);
				}
				// Register shield window if the cast spawns a shield (tags
				// `['shield']` + summons[0] duration, or onCast Effect.type
				// `'shield'` + duration). Beidou Q and Noelle/Zhongli E are canonical.
				registerShieldOnCast(
					ctx,
					char,
					kind,
					castStart,
					active,
					variant,
					castId,
					charConstellationLevel,
					states,
					chainIdx,
					stackState,
					variantCtx
				);
				// Open any infusion windows this cast grants (Bennett Q, Candace Q,
				// Kazuha C6, Dori C6, Lohen E). Registered BEFORE the reaction
				// emission below for the same reason the shield is: a window this
				// cast opens should be visible to everything the cast then does.
				registerInfusionsOnCast(
					ctx,
					char,
					kind,
					castStart,
					active,
					variant,
					states,
					charConstellationLevel,
					chainIdx,
					stackState,
					variantCtx
				);
				// Queue this cast's own applications, each at the frame `application[]`
				// says it lands. Registered after stance/summon registration so the
				// just-opened stance owner / just-spawned summon can receive the
				// extensions a resulting reaction dispatches.
				// ⚠️ SCHEDULING, not emitting: the offers reach the gauge when the
				// advance at the bottom of this branch passes their frames, so a hit at
				// frame 18 of a 79-frame animation is dispatched at 18 — ahead of a
				// teammate's summon tick at 30, which is the whole point of the 2026-08-17
				// reordering. A hit that lands PAST the animation simply waits for a
				// later advance, which is equally what should happen.
				emitReactionsAtCast(
					ctx,
					clock,
					char,
					kind,
					castStart,
					// ⚠️ A variant's `application[]` REPLACES the base's, like every other
					// variant array — a hold that lands different hits states all of them.
					variant?.application ?? active.application,
					// ⚠️ `noICD` on a skill/burst was declared and inert until L4d; this is
					// its first reader (Mualani's Sharky's Bite is the normal-side holder).
					// ⛔ Not variant-overridable — `AbilityVariant` has no `noICD`, and
					// adding one would author a field with no data behind it.
					active.noICD,
					// The cast's measured window (cast-icd-gate round, 2026-09-17) — same
					// resolution as `noICD` beside it, for the same reason.
					active.icdGate,
					states,
					charConstellationLevel,
					chainIdx,
					stackState,
					// ⚓ Team scope, for an `ElementRef` entry in `application[]` —
					// Varka's right-hand claymore names its element through the party
					// (2026-09-16). A literal entry never reads it.
					variantCtx,
					// A NAMED counter shared with the character's other abilities
					// (Nilou; ICD cap round follow-up, 2026-10-04).
					active.icdCounter,
					// The stance THIS cast opened, for its `whileStance` hits (Mizuki
					// round, 2026-10-16) — identified by its cast id, so a cast that
					// opens none never gates against an older stance.
					cs.stance?.sourceCastId === castId ? cs.stance : undefined
				);
				// ⚓ A cast that ABSORBS (absorption round, 2026-10-17): its lock is
				// polled from the cast, and its `{type: 'absorbed'}` entries land in
				// the locked element — or not at all (Heizou's Iris, Ifa's Mark).
				{
					const absorbs = variant?.absorbs ?? active.absorbs;
					if (absorbs) {
						const key = `cast#${castId}`;
						schedulePolls(ctx, clock, key, absorbs, castStart, () => true);
						emitAbsorbedAtCast(
							ctx,
							clock,
							char,
							kind,
							castStart,
							variant?.application ?? active.application,
							key,
							states,
							charConstellationLevel,
							chainIdx,
							stackState
						);
					}
				}
				// ⚓ Summon ticks apply their element too (gauge round L5e-b). Queued
				// after the summonExt registration above so the chain reads the
				// extension record LIVE rather than a copy.
				// ⚠️ Insertion order no longer decides anything between these two
				// emitters — both queue at TRUE frames now, and the clock orders them.
				// At an EQUAL frame `Band.TICK` still precedes `Band.LAND`, which is the
				// band contract (a consequence of what is already running, before the
				// thing that is starting) and costs nothing: the two carry the same time.
				// ⚠️ First, the summons THIS cast ends (`terminatesOn: 'skill' |
				// 'burst'`) — before it schedules its own.
				retireSummonsOnCast(ctx, char.id, kind, castStart);
				scheduleSummonTicks(
					ctx,
					clock,
					char,
					kind,
					tok.text,
					active.id,
					variant?.label,
					castStart,
					spawn,
					castEvent,
					cs.summonExt?.castRef === castEvent ? cs.summonExt : undefined,
					states,
					charConstellationLevel,
					chainIdx,
					stackState,
					castApps
				);
				// ⚓ A CAST WHOSE SUMMONS FOLLOW A STATE holds its window open for
				// whichever lineup the state names (Arkhe round, 2026-09-04). Recorded
				// here, acted on at the state's next edge — see the charged branch.
				// ⚠️ Recorded even when the cast spawned nothing resolvable: the window
				// is the ability's, not the occupant's, and a flip into a lineup that
				// DOES have summons must still find it.
				if (active.summonsFollowState) {
					ctx.followStateCasts.set(char.id, {
						castId,
						kind,
						label: tok.text,
						abilityId: active.id,
						ability: active,
						spawnAt: castStart + (spawn ?? 0),
						variantLabel: variant?.label ?? null,
						preStates: states,
						constellation: charConstellationLevel,
						chainIdx,
						stackState,
						castEvent,
						extRec: cs.summonExt?.castRef === castEvent ? cs.summonExt : undefined
					});
				}
				// ⚓ Arm this cast's REACTION PROCS (mark-triggered round, 2026-08-17)
				// — Nahida's Tri-Karma, whose window is the Seed of Skandha's 25 s on
				// the enemy rather than any ability's active bar. Armed BEFORE the
				// applications above are allowed to land (the advance at the bottom of
				// this branch), so a reaction the cast's own hit causes can fire it.
				armCastProcs({
					ctx,
					holderId: char.id,
					abilityId: active.id,
					// ⚠️ A variant's `effects` REPLACE the base's, like every other
					// variant array — the same rule `application[]` follows above.
					effects: variant?.effects ?? active.effects,
					castTime: castStart,
					preStates: states,
					constellation: charConstellationLevel,
					chainIdx,
					stacks,
					castKind: kind
				});
				// Parser-private hit for this cast (onHit wiring): dispatched at
				// the same post-aura-update instant the legacy tail dispatch in
				// emitReactionsAtCast used, now carrying the resolved damageTag/
				// name + the cast's pre-consume stack snapshot. Skipped for
				// element-less characters — preserving the legacy behavior where
				// the reaction emitter's early-return also skipped the hit.
				// ⚓ And skipped for a NON-HITTING cast (non-hitting casts round,
				// 2026-09-16): a stance opener, a heal, a gadget spawn whose ticks
				// carry their own hits. The one gate for the stack dispatchers, the
				// artifact `onHit` branch and the damage-proc stream at once.
				//
				// ⚓⚓ AT THE CAST'S FIRST LANDING, NOT AT THE PRESS (cast hit-record
				// round, 2026-09-21) — §1.K's twin. The record used to fire here,
				// synchronously, while the same cast's `application[]` was queued at
				// its hitmark: one cast's damage in two places, and an ORDER INVERSION
				// for every damage proc listening (C6 Faruzan's Collapse landed at
				// cast + 33f, the burst hit that fired it at cast + 54f). Queued at
				// `Band.LAND` AFTER `emitReactionsAtCast` queued the application at the
				// same (frame, band), so FIFO lands application → hit record — the
				// order a swing's one closure has.
				// ⚠️ The record carries the CAST's stack snapshot, ⛔ never a re-read
				// at the landing: a context is a moment (§1.K).
				// ⚠️ No landing stated (unmeasured, or a hit at Durability 0) keeps
				// the synchronous path verbatim — no frame to move to, no mark.
				if (char.element && !castIsNonHitting(active, variant)) {
					const hit: HitEvent = {
						characterId: char.id,
						time: castStart,
						abilityType: kind,
						element: char.element,
						damageTag: getDefaultDamageTag(active, variant),
						abilityName: variant?.label ? `${active.name} ${variant.label}` : active.name,
						stacks,
						sourceEventId: castId
					};
					if (landings.length > 0 && landings[0].frame > 0) {
						// ↻ ONE RECORD PER LANDING (every-landing round): same cast, same
						// snapshot, same name — its own instant and its own element.
						for (const landing of landings) {
							const at = castStart + landing.frame;
							const landed: HitEvent = {
								...hit,
								time: at,
								// The landed hit's OWN element (⛔ not the caster's): absent is
								// a physical hit, and Varka's opener names the party's.
								element: resolveElementRef(landing.element, variantCtx)
							};
							clock.schedule(at, Band.LAND, () => {
								// ⚓ A landing after the caster's turn ended is OFF FIELD: null
								// pool, refused by `source: 'active'` (see `HitEvent.offField`).
								const live = liveSegment === turn;
								if (!live) landed.offField = true;
								dispatchHit(landed, true, live);
							});
						}
					} else {
						dispatchHit(hit, false);
					}
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
				// ⚓ The cast's animation, run LAST — see `castEnd` above. Every task
				// this cast queued at a frame inside the animation fires HERE, in true
				// (frame, band) order, alongside anything an earlier cast left pending:
				// a summon tick from a previous cast and this cast's own hit now reach
				// the gauge in the order they happen. ⛔ Nothing that reads the cast's
				// own decisions may be added below this line.
				clock.advance(castEnd);
				humanPad(kind, j);
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
					src: { from: tok.from, to: tok.to },
					time: clock.now,
					castTime: Q_CAST_F,
					uptime: 0,
					cooldown: FALLBACK_BURST_CD_F,
					readyAt: clock.now + FALLBACK_BURST_CD_F,
					summonActivatesAt: 0,
					fieldStart: clock.now
				};
				ctx.events.push(fallbackQ);
				ctx.castRecords.push({ ev: fallbackQ, track });
				charCasts.push(fallbackQ);
				cs.qReadyAt = clock.now + FALLBACK_BURST_CD_F;
				clock.advance(clock.now + Q_CAST_F);
				humanPad('burst', j);
			} else {
				// No-ability fallback (E): single charge keyed by bare charId, 12s CD.
				if (!ctx.eChargeQueues.has(char.id)) ctx.eChargeQueues.set(char.id, [0]);
				const queue = ctx.eChargeQueues.get(char.id)!;
				if (queue[0] > clock.now) clock.advance(queue[0]);
				const fallbackE: CastEvent = {
					kind: 'cast',
					id: ctx.nextId(),
					characterId: char.id,
					ability: 'skill',
					abilityId: char.id,
					label: tok.text,
					src: { from: tok.from, to: tok.to },
					time: clock.now,
					castTime: E_CAST_F,
					uptime: 0,
					cooldown: FALLBACK_SKILL_CD_F,
					readyAt: clock.now + FALLBACK_SKILL_CD_F,
					summonActivatesAt: 0,
					fieldStart: clock.now
				};
				ctx.events.push(fallbackE);
				ctx.castRecords.push({ ev: fallbackE, track });
				charCasts.push(fallbackE);
				queue[0] = clock.now + FALLBACK_SKILL_CD_F;
				clock.advance(clock.now + E_CAST_F);
				humanPad('skill', j);
				lastEText = tok.text;
			}
		};

		// ⚓ A SPINNING CHARGED ATTACK under way (`NormalAbility.chargeSpin`,
		// Mavuika's Flamestrider; bike Charged Attack round, 2026-10-16). It lives
		// only across consecutive spin tokens — a `C` after anything but a `C`
		// starts a new spin — and is read by the dash that cancels it.
		let spin: { start: number; skip: number; lastHit: number | null } | null = null;
		/** The action token before / after `j`, skipping what draws nothing. */
		const actionTextAt = (from: number, step: 1 | -1): string | null => {
			let k = from + step;
			while (k >= 0 && k < lookahead.length && isInert(lookahead[k])) k += step;
			const tk = lookahead[k];
			if (!tk) return null;
			return tk.kind === 'Q' || tk.kind === 'E' ? tk.kind : tk.text;
		};
		/** The active normal ability, if its Charged Attack channels. */
		const channelAbility = (): NormalAbility | undefined => {
			if (!char.abilities.some((a) => a.abilityType === 'normal' && a.chargeChannel))
				return undefined;
			const ab = resolveActiveAbility(
				char,
				'normal',
				computeCurrentStates(clock.now),
				charConstellationLevel,
				undefined,
				undefined,
				variantCtx
			);
			return ab?.chargeChannel ? ab : undefined;
		};
		/** The active normal ability, if its Charged Attack spins. */
		const spinAbility = (): NormalAbility | undefined => {
			if (!char.abilities.some((a) => a.abilityType === 'normal' && a.chargeSpin)) return undefined;
			const ab = resolveActiveAbility(
				char,
				'normal',
				computeCurrentStates(clock.now),
				charConstellationLevel,
				undefined,
				undefined,
				variantCtx
			);
			return ab?.chargeSpin ? ab : undefined;
		};

		for (let j = 0; j < expandedTokens.length; j++) {
			const tok = expandedTokens[j];
			curSrc = { from: tok.from, to: tok.to };
			// ⚓ A timed Blessing armed to end by an in-Blessing plunge ends HERE, at
			// her next action — unless it is a burst (Varesa; `timedBlessing.ts`).
			if (
				char.timedBlessing &&
				(tok.kind === 'E' || tok.kind === 'Q' || (tok.kind === 'label' && tok.text !== 'W'))
			)
				timedBlessingOnAction(ctx, char, clock.now, tok.kind === 'Q');

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
					if (isFinite(delta))
						clock.advance(clock.now + Math.min(framesOf(delta), MAX_TIME_ADVANCE_F));
				}
			} else if (tok.kind === 'unset-time') {
				emitAction({ action: 'unset', label: '~?', time: clock.now, duration: MIN_ACTIVE_F });
				track.hasUnsetDuration = true;
				clock.advance(clock.now + MIN_ACTIVE_F);
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
				// the cursor, and the cancel lookahead (`peekActionKey`) steps over
				// it, so it doesn't move the previous action's window either. The next ability that gates on this stack key picks
				// up the new count via the threaded `stackState` parameter.
				const m = tok.text.match(STACK_ASSERT_RE);
				if (m) {
					stackState.set(m[1], parseInt(m[2], 10));
				}
			} else {
				// 'label' or 'unknown'
				if (tok.kind === 'unknown') ctx.unknownTokens.push(tok.text);

				const t = tok.text;
				const nextKey = peekActionKey(lookahead, j, isBow);

				if (/^N\d*$/.test(t)) {
					// Normal attack: N5 means "perform 5 normals in a row" starting from
					// the current normalCounter. Intermediate hits use 'N' as their
					// lookahead (next action is another normal); the final hit uses nextKey.
					// Each swing emits an action event; the finalize pass projects the
					// group into one block labeled "N5" (post-P4 #2).
					// Active normal ability is resolved per-token to handle mid-segment
					// stance transitions (e.g. Cyno Q → in-stance normals).
					const count = t.length > 1 ? parseInt(t.slice(1)) : 1;
					// An attack is an input: settle action-ended states and their
					// chains before the snapshot (charged-forms round, 2026-09-16).
					settleOwnerStates(ctx, cs, char.id, clock.now);
					const nStates = computeCurrentStates(clock.now);
					// Explicit annotation: the landing closure below reads `hits`, which
					// otherwise forms a TS7022 inference cycle through this initializer.
					const activeNormal: NormalAbility | undefined = resolveActiveAbility(
						char,
						'normal',
						nStates,
						charConstellationLevel,
						undefined,
						undefined,
						variantCtx
					);
					// Frameless normals (uncurated stubs with hits:[], Blank) ride the
					// generic combo profile so swings get realistic per-position timing
					// instead of collapsing to zero duration. ⚠️ The framed-vs-not sentinel
					// is `anim` since L4b — it is what `isCurated` and characterLint now
					// require, and `swap` is an ordinary optional override.
					const rawHits: NormalHit[] | undefined = activeNormal?.hits;
					const hits: NormalHit[] = Number.isFinite(rawHits?.[0]?.frames?.anim)
						? rawHits!
						: GENERIC_NORMAL_HITS;
					// Infusion rule shared with the notation highlighter (actionElement.ts).
					// ⚠️ TWO infusion mechanisms, and the stance one WINS: a stance's
					// own `infusion` is the character's self-infusion, which in game
					// overrides an external grant (Xiao's burst stays anemo through
					// a Bennett C6 pyro infusion).
					// ↻ Resolved PER SWING, at the swing's start (Radiance-window round,
					// 2026-09-19) — it was once per token, which was exact while every
					// granted infusion was a window fixed at its cast. An infusion gated
					// on the Polestar Field opens and closes with the reaction stream, so
					// a field opening mid-`N5` makes a string whose first swings are
					// physical and whose last are Cryo; a timed grant lapsing mid-string
					// is the same case and was simply wrong before. The element rides
					// each swing's own action event, so a swing's drawn element and its
					// reaction still cannot disagree; finalize splits the block where it
					// changes. ⚠️ `activeNormal` (and so a STANCE infusion) stays
					// per-token — a stance does not change under a string.
					// ⚓ A non-hitting normal string lands nothing (charged-forms round,
					// 2026-09-16): no element, and no hit record below.
					const nNonHitting = activeNormal?.nonHitting?.normal === true;
					const stanceInfusion = resolveElementRef(activeNormal?.infusion, variantCtx);
					const swingElement = (): Element | undefined =>
						nNonHitting
							? undefined
							: resolveActionElement(
									'normal',
									t,
									char.weapon,
									char.element,
									stanceInfusion ?? infusionAt(ctx, char, clock.now)
								);
					// Per-swing action events sharing one blockId (the anchor = the
					// first swing's id). `time` is the swing's pre-advance start.
					let anchorId: number | undefined;
					for (let k = 0; k < count; k++) {
						const nElement = swingElement();
						const hitIndex = normalCounter % hits.length;
						const hitNextKey: ActionKey = k < count - 1 ? 'N' : nextKey;
						const castS = resolveNormalCastTime(
							hits,
							hitIndex,
							cancelKeyFor(ctx.humanTiming, 'normal', hitNextKey, isBow)
						);
						const ev = emitAction({
							action: 'normal',
							label: t,
							blockId: anchorId,
							time: clock.now,
							duration: castS ?? 0,
							abilityId: activeNormal?.id,
							comboIndex: hitIndex,
							element: nElement
						});
						anchorId ??= ev.id;
						// ⚓⚓ THE WAVE'S SPAN (coordinated-attack round). One swing IS
						// one stretch of gcsim's `NormalAttackState`, and consecutive
						// swings abut — so an `N5` reads as one continuous state and a
						// listener's cadence carries straight across it.
						// ⚠️ BEFORE the advance: the fires land inside the span, so they
						// have to be queued while the clock still stands at its start.
						notifyNormalAttack(ctx, clock, clock.now, clock.now + (castS ?? 0));
						// The swing's landing — see `landSwing`. Offer the swing to the
						// aura, behind the normal-attack ICD clock (ICD round): a catalyst
						// `N5` applies on swings 1, 4 and 6 at the corpus cadence, not on
						// all five.
						const coN = resolveElementRef(activeNormal?.coInfusion, variantCtx);
						const landNormal = (at: number, live = true): void => {
							// ⚓ A form's swing spends Nightsoul at its landing (Mavuika's
							// Flamestrider, 1 — gcsim `attack.go`, after `QueueAttack`).
							if (activeNormal?.nightsoulCost?.perSwing)
								nightsoulSpend(ctx, clock, char, at, activeNormal.nightsoulCost.perSwing);
							emitReactionsAtSwing(
								ctx,
								clock,
								char,
								'normal',
								nElement,
								activeNormal?.noICD,
								at,
								nStates,
								charConstellationLevel,
								stackState,
								undefined,
								undefined,
								activeNormal?.icdCounter
							);
							// ⚓⚓ THE SECOND CLAYMORE (Varka's two claymores round,
							// 2026-09-16). A swing with a `coInfusion` lands a second
							// element on its own counter — offered AFTER the primary and at
							// the same instant, which is the contract: measured, the
							// conversion element then Anemo swirls and the reverse order
							// produces nothing. ⛔ It lands no second hit record and no
							// second action event; one swing is one hit.
							if (coN && !nNonHitting) {
								emitReactionsAtSwing(
									ctx,
									clock,
									char,
									'normal',
									coN,
									activeNormal?.noICD,
									at,
									nStates,
									charConstellationLevel,
									stackState,
									undefined,
									'co'
								);
							}
							// Parser-private per-swing hit (onHit wiring), at the landing.
							// Per-hit damageTag override honored, combo index feeding
							// filter.hitIndex. Per-swing = one hit (multi-hit swings are not
							// curated — see the HitEvent decl). ⛔ None at all for a
							// non-hitting string: a physical swing is a hit with no element,
							// a non-hitting one is not a hit.
							if (!nNonHitting) {
								dispatchHit(
									{
										characterId: char.id,
										time: at,
										abilityType: 'normal',
										element: nElement,
										damageTag: hits?.[hitIndex]
											? getNormalHitDamageTag(hits[hitIndex], 'normal')
											: 'normal',
										abilityName: activeNormal?.name,
										hitIndex,
										...(live ? {} : { offField: true as const }),
										sourceEventId: ev.id
									},
									true,
									live
								);
							}
						};
						const nLate = landSwing(
							clock.now,
							castS,
							hits[hitIndex]?.frames,
							landNormal,
							projectileTravelOf(char.weapon, activeNormal, 'normal')
						);
						if (castS !== null) clock.advance(clock.now + castS);
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
							applyTransientState(
								ctx,
								nSpec,
								cs,
								char.id,
								clock.now,
								nStates,
								charConstellationLevel,
								{
									sourceActionId: ev.id
								}
							);
						}
						// A swing with no stated landing (or one at its end) lands HERE, after
						// the opener that shares its instant — so a state the swing itself
						// opens is visible to hit-gated conditions, as it always was.
						for (let n = 0; n < nLate; n++) landNormal(clock.now);
					}
					humanPad('normal', j);
				} else if ((/^C\d*$/.test(t) || t === 'F') && spinAbility()) {
					// ⚓⚓ THE SPIN (`chargeSpin`): each `C` is ONE spin hit, `F` the
					// finisher; gcsim `charge.go`, timings measured with its CLI
					// (docs/mavuika-nightsoul-round-2026-10-16.md §7). The finisher is
					// automatic only where the game forces it — a Normal Attack next,
					// or the spin's maximum; before a dash, jump, skill, burst or swap
					// a missing `F` means none (⚓ Nate, gcsim-faithful).
					normalCounter = 0;
					settleOwnerStates(ctx, cs, char.id, clock.now);
					const ab = spinAbility()!;
					const sp = ab.chargeSpin!;
					const spinStates = computeCurrentStates(clock.now);
					const element = resolveElementRef(ab.infusion, variantCtx) ?? char.element;
					const prev = actionTextAt(j, -1);
					const next = actionTextAt(j, 1);
					if (!prev || !/^C\d*$/.test(prev)) spin = null;
					const nextKey = peekActionKey(lookahead, j, isBow);
					let blockId: number | undefined;
					const land = (at: number, ev: ActionEvent): void =>
						clock.schedule(at, Band.LAND, () => {
							const live = liveSegment === turn;
							emitReactionsAtSwing(
								ctx,
								clock,
								char,
								'charged',
								element,
								ab.noICD,
								at,
								spinStates,
								charConstellationLevel,
								stackState,
								undefined,
								undefined,
								ab.icdCounter
							);
							dispatchHit(
								{
									characterId: char.id,
									time: at,
									abilityType: 'charged',
									element,
									damageTag: 'charged',
									abilityName: ab.name,
									...(live ? {} : { offField: true as const }),
									sourceEventId: ev.id
								},
								true,
								live
							);
						});
					const startSpin = (): NonNullable<typeof spin> => {
						// A press straight out of a dash, a Normal Attack or a burst
						// skips the windup (gcsim `GetSkippedWindupFrames`).
						const buffered = prev !== null && (prev === 'D' || prev === 'Q' || /^N\d*$/.test(prev));
						const s0 = { start: clock.now, skip: buffered ? sp.bufferedSkip : 0, lastHit: null };
						nightsoulCharging(ctx, clock, char, clock.now, true);
						return s0;
					};
					const finisher = (key: ActionKey): void => {
						let delay: number;
						if (spin) {
							const f = (clock.now - spin.start + spin.skip) % sp.spinFrames;
							const { from, to } = sp.releaseWindow;
							delay =
								f >= from && f < to
									? 0
									: (((from - f) % sp.spinFrames) + sp.spinFrames) % sp.spinFrames;
						} else {
							spin = startSpin();
							delay = sp.finisher.minSpin;
						}
						const hitAt = clock.now + delay + sp.finisher.hit;
						const duration = delay + frameAt(sp.finisher.frames, key);
						const ev = emitAction({
							action: 'charged',
							label: t,
							time: clock.now,
							duration,
							element,
							...(blockId !== undefined ? { blockId } : {})
						});
						land(hitAt, ev);
						nightsoulCharging(ctx, clock, char, hitAt, false);
						clock.advance(clock.now + duration);
						spin = null;
					};
					if (t === 'F') {
						finisher(nextKey);
					} else {
						const count = t.length > 1 ? parseInt(t.slice(1)) : 1;
						for (let k = 0; k < count; k++) {
							if (!spin) spin = startSpin();
							const hitAt =
								spin.lastHit === null
									? spin.start + sp.firstHit - spin.skip
									: spin.lastHit + sp.hitInterval;
							// The spin's maximum forces the finisher.
							if (hitAt - spin.start + spin.skip > sp.maxFrames) {
								finisher(nextKey);
								break;
							}
							const ev = emitAction({
								action: 'charged',
								label: t,
								time: clock.now,
								duration: hitAt - clock.now,
								element,
								...(blockId !== undefined ? { blockId } : {})
							});
							blockId ??= ev.id;
							land(hitAt, ev);
							clock.advance(hitAt);
							spin.lastHit = hitAt;
						}
						// What follows decides the finisher: a Normal Attack forces it; a
						// `C` or `F` continues the spin; anything else cancels it.
						if (spin && next !== null && /^N\d*$/.test(next)) finisher('N');
						else if (spin && next !== 'F' && !(next !== null && /^C\d*$/.test(next)))
							nightsoulCharging(ctx, clock, char, clock.now, false);
					}
					humanPad('charged', j);
				} else if (/^C\d*$/.test(t) && channelAbility()) {
					// ⚓⚓ THE CHANNEL (`chargeChannel`, Neuvillette's Equitable Judgment,
					// 2026-10-17; gcsim `charge.go`): windup, absorb up to three droplets,
					// a charge-up their count shortens, the beam's hits, the end lag.
					normalCounter = 0;
					settleOwnerStates(ctx, cs, char.id, clock.now);
					const ab = channelAbility()!;
					const ch = ab.chargeChannel!;
					const start = clock.now;
					const element = resolveActionElement(
						'charged',
						t,
						char.weapon,
						char.element,
						resolveElementRef(ab.infusion, variantCtx) ?? infusionAt(ctx, char, start)
					);
					// gcsim rolls the windup into a preceding cast, Normal, Charged or
					// plunge; out of a dash, a jump, a swap or a wait it is paid.
					const prev = actionTextAt(j, -1);
					const rolled = prev !== null && /^(E|Q|N\d*|s?C\d*|[hl]?P|A)$/.test(prev);
					const absorbAt = start + (rolled ? 0 : ch.windup) + ch.absorbAt;
					// Oldest first; one that expired before the absorb never counts.
					const pool = (ctx.droplets.get(char.id) ?? []).filter((d) => d.end > absorbAt);
					const taken = pool
						.filter((d) => d.spawn <= absorbAt)
						.sort((a, b) => a.spawn - b.spawn)
						.slice(0, 3);
					ctx.droplets.set(
						char.id,
						pool.filter((d) => !taken.includes(d))
					);
					const beamStart = absorbAt + ch.chargeUp[taken.length];
					const beamEnd = beamStart + ch.hits[ch.hits.length - 1];
					const lag = frameAt(
						ch.endLag,
						cancelKeyFor(
							ctx.humanTiming,
							'charged',
							peekActionKey(lookahead, j, isBow),
							isBow,
							chargedBuffers
						)
					);
					const ev = emitAction({
						action: 'charged',
						label: t,
						time: start,
						duration: beamEnd + lag - start,
						abilityId: ab.id,
						element
					});
					for (const h of ch.hits) {
						const at = beamStart + h;
						clock.schedule(at, Band.LAND, () => {
							const live = liveSegment === turn;
							// ⚠️ The beam is gcsim's `ICDTagExtraAttack` on the standard
							// group, NOT the catalyst Charged Attack rule (that is the short
							// attack's `ICDTagNone`) — so it is gated HERE on a counter of
							// its own and offered ungated.
							let icd = ctx.icdClocks.get(`${char.id}:channel`);
							if (!icd) {
								icd = createIcdClock();
								ctx.icdClocks.set(`${char.id}:channel`, icd);
							}
							if (icdApplies(icd, at, STANDARD_ICD_FRAMES).applies)
								emitReactionsAtSwing(
									ctx,
									clock,
									char,
									'charged',
									element,
									true,
									at,
									computeCurrentStates(at),
									charConstellationLevel,
									stackState
								);
							dispatchHit(
								{
									characterId: char.id,
									time: at,
									abilityType: 'charged',
									element,
									damageTag: 'charged',
									abilityName: ab.name,
									...(live ? {} : { offField: true as const }),
									sourceEventId: ev.id
								},
								true,
								live
							);
						});
					}
					clock.advance(beamEnd + lag);
					humanPad('charged', j);
				} else if (/^s?C\d*$/.test(t) || (t === 'A' && isBow)) {
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
					// ⚓ ONE snapshot, taken BEFORE the action: it resolves the ability
					// AND gates the charged opener below, so the two cannot disagree
					// about the state the swing started in (Arkhe round).
					// ⚓ And the settle runs BEFORE the snapshot (charged-forms round,
					// 2026-09-16): a `C` that ends Lauma's deer opens her cooldown and
					// then resolves against it — `C C` is deer, then Prayer.
					settleOwnerStates(ctx, cs, char.id, clock.now);
					let chargedStates = computeCurrentStates(clock.now);
					// Explicit annotation: the chargeHits read in the hit block below
					// otherwise forms a TS7022 inference cycle through this initializer.
					let activeNormal: NormalAbility | undefined = resolveActiveAbility(
						char,
						'normal',
						chargedStates,
						charConstellationLevel,
						undefined,
						undefined,
						variantCtx
					);
					// ⚓⚓ A SPECIAL CHARGE THAT SPENDS A SKILL CHARGE (2026-09-18): Varka's
					// Azure Devour "expends uses of the special Elemental Skill Four
					// Winds' Ascension" (`NormalAbility.specialChargeSpends`). Two gates,
					// both gcsim's (`charge.go` `skillCharge`): the named skill must be
					// the one ACTIVE now (`useSpecialSkill()` — no Pyro/Hydro/Electro/
					// Cryo teammate, no Four Winds, no Azure Devour) and a charge must be
					// READY. The first failing makes the token the ORDINARY charge, on
					// `chargeFrames`, because the attack it names cannot be performed.
					// The second WAITS, as an `E` on cooldown does — the same scan
					// (charge ready, or an own window ends and resolution may flip),
					// because the notation named the special and a visible gap is
					// honest where a same-tinted ordinary charge would be a quiet
					// substitution. ⚠️ A wait moves the clock, so the state snapshot and
					// the resolved normal are taken AGAIN after it.
					let spendsId =
						t.startsWith('s') && activeNormal?.specialChargeSpends !== undefined
							? activeNormal.specialChargeSpends
							: undefined;
					let spendQueue: number[] | undefined;
					let spendSkill: SkillAbility | undefined;
					if (spendsId !== undefined) {
						const waitFrom = clock.now;
						for (let scanGuard = 0; scanGuard < 8; scanGuard++) {
							const scanStates = computeCurrentStates(clock.now);
							const scanSkill = resolveActiveAbility(
								char,
								'skill',
								scanStates,
								charConstellationLevel,
								getChainIndexMap(ctx, char.id, clock.now),
								stackState,
								variantCtx
							);
							if (scanSkill?.id !== spendsId) {
								// Not performable here (out of the stance, or the stance
								// ended during the wait): the ordinary charge.
								spendsId = undefined;
								spendQueue = undefined;
								spendSkill = undefined;
								break;
							}
							if (!ctx.eChargeQueues.has(spendsId)) {
								ctx.eChargeQueues.set(
									spendsId,
									new Array(
										resolveEffectiveCharges(scanSkill, undefined, charConstellationLevel)
									).fill(0)
								);
							}
							spendQueue = ctx.eChargeQueues.get(spendsId)!;
							spendSkill = scanSkill;
							const readyAt = spendQueue[0];
							if (readyAt <= clock.now) break;
							const boundary = nextOwnWindowEnd(clock.now);
							if (boundary !== null && boundary < readyAt) {
								// ⚓ A wait is only worth taking when it can END in the special:
								// peek at the resolution once that window closes, and if the
								// skill no longer resolves there (the stance ends first), no
								// use can be reached in this stance — take the ORDINARY
								// in-stance charge NOW, gcsim's own fallback, rather than carry
								// the rest of the rotation to the stance's end for a base
								// charged attack nobody asked for. Measured before this peek:
								// `Xiangling E > Varka E N5 N5 sE N2 sC` at C0 put the `sC` at
								// 766f, out of stance and Physical, in place of 673f in it.
								const atBoundary = resolveActiveAbility(
									char,
									'skill',
									computeCurrentStates(boundary),
									charConstellationLevel,
									getChainIndexMap(ctx, char.id, boundary),
									stackState,
									variantCtx
								);
								if (atBoundary?.id !== spendsId) {
									spendsId = undefined;
									spendQueue = undefined;
									spendSkill = undefined;
									break;
								}
								clock.advance(boundary);
								continue;
							}
							clock.advance(readyAt);
						}
						if (clock.now !== waitFrom) {
							settleOwnerStates(ctx, cs, char.id, clock.now);
							chargedStates = computeCurrentStates(clock.now);
							activeNormal = resolveActiveAbility(
								char,
								'normal',
								chargedStates,
								charConstellationLevel,
								undefined,
								undefined,
								variantCtx
							);
						}
					}
					const castS = activeNormal
						? resolveChargeCastTime(
								activeNormal,
								t,
								cancelKeyFor(ctx.humanTiming, 'charged', nextKey, isBow, chargedBuffers),
								isBow,
								// The special form only when it spends what it must spend —
								// an `sC` whose skill is not active is the ordinary charge.
								activeNormal.specialChargeSpends === undefined || spendsId !== undefined
							)
						: null;
					const blockStart = clock.now;
					// Catalyst CAs, bow aimed shots (bar the C1 partial), and infused CAs
					// are elemental — the shared infusion rule (actionElement.ts).
					// ⚓ A NON-HITTING charged attack (charged-forms round, 2026-09-16):
					// Lauma's deer takes its 63 frames, opens her form, and lands
					// nothing — no element (the block projects untinted, no pill in
					// the aura lane), no gauge offer (`emitReactionsAtSwing` returns
					// on a missing element), and no hit record below. Read off the
					// RESOLVED ability, so the Prayer sibling's `C` hits as it should.
					const cNonHitting = activeNormal?.nonHitting?.charged === true;
					// ⚓ A form that states its charged attack's element (Moondew
					// Cleanse) overrides the weapon rule; `applies: false` keeps the
					// element on the block and the hit records and gives the gauge
					// nothing (`cGaugeElement`).
					const cOwnElement = activeNormal?.chargeElement;
					const cElement = cNonHitting
						? undefined
						: cOwnElement
							? cOwnElement.element
							: resolveActionElement(
									'charged',
									t,
									char.weapon,
									char.element,
									resolveElementRef(activeNormal?.infusion, variantCtx) ??
										infusionAt(ctx, char, blockStart)
								);
					const cGaugeElement = cOwnElement?.applies === false ? undefined : cElement;
					const chargedEv = emitAction({
						action: 'charged',
						label: t,
						time: blockStart,
						duration: castS ?? 0,
						abilityId: activeNormal?.id,
						element: cElement
					});
					// The spend (see the gate above): the ready slot takes a fresh
					// clock appended to the END of the chain — charges recharge one at
					// a time (cooldown-reduction round) — from the attack's START, which
					// is where gcsim's `SetCD(ActionSpecialSkill, 11*60)` runs (no
					// delay, unlike Four Winds' own 39f). Recorded on the event; ⚠️
					// nothing is drawn for it — see `ActionEvent.spentCharge`.
					if (spendsId !== undefined && spendQueue !== undefined && spendSkill !== undefined) {
						const spendCd = resolveAbilityTiming(
							spendSkill,
							undefined,
							chargedStates,
							charConstellationLevel,
							getChainIndexMap(ctx, char.id, blockStart),
							stackState,
							variantCtx,
							ctx.team.skillCooldownModifiers
						).cooldown;
						const chainEnd = spendQueue[spendQueue.length - 1];
						const spentReadyAt = Math.max(blockStart, chainEnd) + spendCd;
						spendQueue[0] = spentReadyAt;
						spendQueue.sort((a, b) => a - b);
						chargedEv.spentCharge = { abilityId: spendsId, readyAt: spentReadyAt };
					}
					// The charged attack's landing — see `landSwing`. ⚠️ The states are
					// read AT the landing: a hitmark sits before the opener's edge (Furina's
					// toggle), the end-of-swing fallback after it, as it always did.
					const landCharged = (at: number, live = true): void => {
						// Offer the charged shot to the aura. A catalyst CA and a bow's
						// aimed shot both apply; only the bow's runs a counter (a
						// catalyst's is gcsim `ICDTagNone`) — resolveActionIcd holds it.
						// ⚓ `chargedIcdWindow` comes off the RESOLVED normal ability, so a
						// stance's charged attack answers with its own measurement rather
						// than the base ability's — the same resolution `noICD` beside it
						// already relies on.
						emitReactionsAtSwing(
							ctx,
							clock,
							char,
							'charged',
							cGaugeElement,
							activeNormal?.noICD,
							at,
							computeCurrentStates(at),
							charConstellationLevel,
							stackState,
							activeNormal?.chargedIcdWindow
						);
						// ⚓⚓ The second claymore on the charged attack — see the normal
						// path for the ordering contract. gcsim gives the CA its own
						// dedicated pair of counters (`ICDTagVarkaExtraAttack*`), which is
						// what the separate `'co'` key reproduces.
						const coC = resolveElementRef(activeNormal?.coInfusion, variantCtx);
						if (coC && !cNonHitting) {
							emitReactionsAtSwing(
								ctx,
								clock,
								char,
								'charged',
								coC,
								activeNormal?.noICD,
								at,
								computeCurrentStates(at),
								charConstellationLevel,
								stackState,
								activeNormal?.chargedIcdWindow,
								'co'
							);
						}
						// Parser-private charged hit (onHit wiring), at the landing. The
						// abilityName carries the bow chargeHit sub-name (C1 → first
						// entry, C → last) so `filter.abilityName: "Wreath Arrow"`
						// substring-matches — mirrors resolveBlockContext's rule.
						// ⛔ No record at all for a non-hitting charged attack.
						if (!cNonHitting) {
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
									time: at,
									abilityType: 'charged',
									element: cElement,
									damageTag: chargeHits?.length
										? getNormalHitDamageTag(
												chargeHits[t === 'C1' ? 0 : chargeHits.length - 1],
												'charged'
											)
										: 'charged',
									abilityName: cAbilityName,
									...(live ? {} : { offField: true as const }),
									sourceEventId: chargedEv.id
								},
								true,
								live
							);
						}
					};
					const cLate = landSwing(
						blockStart,
						castS,
						activeNormal
							? resolveChargeFrameMap(
									activeNormal,
									t,
									isBow,
									activeNormal.specialChargeSpends === undefined || spendsId !== undefined
								)
							: null,
						landCharged,
						projectileTravelOf(char.weapon, activeNormal, 'charged'),
						activeNormal?.chargeLandsAfterCancel === true
					);
					if (castS !== null) clock.advance(clock.now + castS);
					humanPad('charged', j);
					// Charged-opened transient state (Arkhe round, 2026-09-04): the
					// action's END, the same instant the `normal` and `plunge` openers
					// beside it use. Furina's Charged Attack TOGGLES `pneuma`, which is
					// what decides the lineup her next Salon Solitaire summons.
					//
					// ⚠️ Gated on `blockStart`'s state snapshot — the one that resolved
					// `activeNormal` — not on a fresh read after the advance. A toggle
					// that re-read here would see its own edge on the very next token.
					const cSpec = activeNormal?.actionOpensState?.charged;
					if (cSpec) {
						applyTransientState(
							ctx,
							cSpec,
							cs,
							char.id,
							clock.now,
							chargedStates,
							charConstellationLevel,
							{ sourceActionId: chargedEv.id }
						);
						// ⚓⚓ THE LINEUP HAND-OFF (Arkhe round, landing c). The state has
						// just moved, so a cast whose summons FOLLOW it may now be holding
						// the wrong occupant. Re-resolve against the state AFTER the edge
						// and, if the answer changed, end the running summon here and spawn
						// the new one with the remaining duration — gcsim's
						// `if c.StatusIsActive(skillKey) { c.summonSinger(0) }`.
						//
						// ⚠️ AFTER `applyTransientState`, and that ordering is the whole
						// thing: `computeCurrentStates` re-read before the edge returns the
						// alignment we are leaving.
						handOffLineup(ctx, clock, char, computeCurrentStates(clock.now), variantCtx);
					}
					// No stated landing (or one at the end): it lands HERE, after the
					// opener that shares its instant, reading the post-edge states.
					for (let n = 0; n < cLate; n++) landCharged(clock.now);
				} else if (/^[hl]?P$/.test(t)) {
					// Plunge attack. Uses the active normal ability's plunge frames, or a
					// plungeVariant whose input[] matches the preceding E token text
					// (e.g. Kazuha's Midare Ranzan has distinct "After Hold E" frames).
					//
					// ⚓ `lP` reads `lowPlungeFrames`; `P` and `hP` read `plungeFrames`,
					// which is the HIGH plunge (L4b — Nate: the high plunge is what players
					// actually perform, so it keeps the plain name and the bare token).
					// The low map falls back to the high one, because gcsim models only one
					// plunge for three of our authors and none at all for Venti and Wanderer.
					settleOwnerStates(ctx, cs, char.id, clock.now);
					const plungeStates = computeCurrentStates(clock.now);
					const activeNormal = resolveActiveAbility(
						char,
						'normal',
						plungeStates,
						charConstellationLevel,
						undefined,
						undefined,
						variantCtx
					);
					normalCounter = 0; // any non-normal action resets the NA string (gcsim semantics)
					const plungeVariant = lastEText
						? activeNormal?.plungeVariants?.find((v) =>
								v.input.includes(lastEText as (typeof v.input)[number])
							)
						: undefined;
					const isLowPlunge = t === 'lP';
					const plungeFramesOf = (n: typeof activeNormal): FrameMap | undefined =>
						isLowPlunge ? (n?.lowPlungeFrames ?? n?.plungeFrames) : n?.plungeFrames;
					// ⚠️ A STANCE FORM RARELY AUTHORS ITS OWN PLUNGE (Ayato's Shunsuiken,
					// Wanderer's Kuugo, Wriothesley's Chilling Penalty carry none while
					// their base normals do), and the plunge is the base kit's move, so
					// the base normal's frames come before the generic profile.
					const baseNormal = char.abilities.find(
						(a): a is NormalAbility => a.abilityType === 'normal' && a.conditions === undefined
					);
					const basePlunge =
						plungeFramesOf(activeNormal) ??
						(baseNormal !== activeNormal ? plungeFramesOf(baseNormal) : undefined);
					// ⚓ A PLUNGE WITH NO MEASURED FRAMES IS A STAND-IN, NOT A NO-OP
					// (small-fix bundle, 2026-09-17; ⚓ Nate: provisional). 80 of 126
					// characters have no `plungeFrames`, and a `P` on them used to emit
					// nothing at all — zero time, no block, no application — so every
					// later action shifted earlier and the text and the chart disagreed
					// in silence. The generic profile stands in, the same way a
					// frameless E or Q already draws with generic timing, and the editor
					// squiggles the token (`notationFlags`, off the index's `plunge`).
					const plungeFrames = plungeVariant?.frames ?? basePlunge ?? GENERIC_PLUNGE_FRAMES;
					{
						const castS = frameAt(
							plungeFrames,
							cancelKeyFor(ctx.humanTiming, 'plunge', nextKey, isBow)
						);
						const blockStart = clock.now;
						// Catalyst / infused plunges (e.g. Xiao's Q-stance) are elemental —
						// the shared infusion rule (actionElement.ts). An unresolvable plunge
						// (no frames) emits NO action event, matching the no-block legacy
						// behavior.
						// ⚓ A non-hitting plunge lands nothing (charged-forms round,
						// 2026-09-16) — declared for completeness of the class, no
						// holder yet.
						const pNonHitting = activeNormal?.nonHitting?.plunge === true;
						const pElement = pNonHitting
							? undefined
							: resolveActionElement(
									'plunge',
									t,
									char.weapon,
									char.element,
									resolveElementRef(activeNormal?.infusion, variantCtx) ??
										infusionAt(ctx, char, blockStart)
								);
						const plungeEv = emitAction({
							action: 'plunge',
							label: t,
							time: blockStart,
							duration: castS,
							abilityId: activeNormal?.id,
							element: pElement
						});
						// Plunge-opened transient state (sQ primitive): Varesa's plunge opens
						// `apexDrive` (140f), during which `sQ` resolves to Volcano Kablam;
						// provenance is the plunge's action event (post-P4 #2).
						// ⚓⚓ AT THE PLUNGE'S START (⚓ Nate, 2026-09-20) — the one opener that
						// does not wait for its action's end. The 140f IS gcsim's
						// `apexDuration`, and gcsim adds the status in the plunge action itself
						// (`getApexDrive`, no delay): (start, 140f) is ONE measurement, and we
						// had taken its length and moved its anchor — first to the swing's end,
						// then to the landing — so the window ran 38–40f past gcsim's and a long
						// `P … sQ` chain resolved Kablam where gcsim gives the ordinary burst.
						// The kit says only "after using a Plunging Attack". ⚠️ gcsim's status
						// is hitlag-extended; we model no hitlag anywhere.
						// ⚠️ It also makes the landing's hit find the state by construction —
						// the guarantee the old end-of-swing ordering existed to give.
						const pSpec = activeNormal?.actionOpensState?.plunge;
						if (pSpec) {
							applyTransientState(
								ctx,
								pSpec,
								cs,
								char.id,
								blockStart,
								plungeStates,
								charConstellationLevel,
								{ sourceActionId: plungeEv.id }
							);
						}
						if (char.timedBlessing)
							timedBlessingOnPlunge(
								ctx,
								clock,
								char,
								activeNormal?.plungeBlessing,
								blockStart,
								blockStart + (landingsOf(plungeFrames)[0] ?? castS)
							);
						// The plunge's landing — see `landSwing`: the offers and the hit
						// record at one instant.
						const landPlunge = (at: number, live = true): void => {
							// Offer the plunge to the aura at the landing. Plunges carry no
							// ICD at all (gcsim census in resolveActionIcd), so an infused
							// plunge string applies on every landing.
							emitReactionsAtSwing(
								ctx,
								clock,
								char,
								'plunge',
								pElement,
								activeNormal?.noICD,
								at,
								plungeStates,
								charConstellationLevel,
								stackState
							);
							// ⚓ The second claymore on a plunge, for completeness of the
							// class. ⛔ NO HOLDER and there cannot be one today: the only
							// `coInfusion` author is Varka, who is refused plunges in the
							// very stance that gives him two hands. Authored so the rule is
							// one rule rather than two-thirds of one.
							const coP = resolveElementRef(activeNormal?.coInfusion, variantCtx);
							if (coP && !pNonHitting) {
								emitReactionsAtSwing(
									ctx,
									clock,
									char,
									'plunge',
									coP,
									activeNormal?.noICD,
									at,
									plungeStates,
									charConstellationLevel,
									stackState,
									undefined,
									'co'
								);
							}
							// Parser-private plunge hit (onHit wiring): landing ≈ swing
							// END. Dispatched after the transient-state opener (apexDrive
							// is open to hit-gated conditions at the landing instant). A
							// frameless plunge emits no action event and no hit; a
							// non-hitting one emits the event and no hit.
							if (!pNonHitting)
								dispatchHit(
									{
										characterId: char.id,
										time: at,
										abilityType: 'plunge',
										element: pElement,
										damageTag: 'plunge',
										abilityName: activeNormal?.name,
										...(live ? {} : { offField: true as const }),
										sourceEventId: plungeEv.id
									},
									true,
									live
								);
						};
						const pLate = landSwing(blockStart, castS, plungeFrames, landPlunge);
						clock.advance(clock.now + castS);
						humanPad('plunge', j);
						for (let n = 0; n < pLate; n++) landPlunge(clock.now);
					}
					lastEText = null;
				} else if (t === 'D' || t === 'J') {
					// Dash/jump: emit a block, then advance cursor.
					// The preceding token already selected frames.D/J via peekActionKey.
					normalCounter = 0; // any non-normal action resets the NA string (gcsim semantics)
					// ⚓ THE DASH COOLDOWN (universal, ⚓ Nate 2026-10-16; gcsim
					// `ApplyDashCD`): a dash inside 0.8s of the previous one starts a
					// 1.5s lockout, and a dash in the lockout WAITS — the way a skill
					// waits for its cooldown. Per character (gcsim keeps it across a
					// swap). ⛔ A jump is not a dash.
					if (t === 'D') {
						if (cs.dashLockout && clock.now < cs.dashCdUntil) clock.advance(cs.dashCdUntil);
						if (clock.now < cs.dashCdUntil) {
							cs.dashLockout = true;
							cs.dashCdUntil = clock.now + DASH_LOCKOUT_F;
						} else {
							cs.dashLockout = false;
							cs.dashCdUntil = clock.now + DASH_WINDOW_F;
						}
					}
					const blockStart = clock.now;
					// ⚓ A dash between two spin `C`s, or after a finisher into one, is
					// the CANCEL (`CDC` / `FDC`; gcsim `charge_cancel`): cut at its travel
					// frame, and the next spin skips its windup. Any spin ends here.
					const prevAct = actionTextAt(j, -1);
					const nextAct = actionTextAt(j, 1);
					const dashForm =
						t === 'D' && char.nightsoulPool
							? resolveActiveAbility(
									char,
									'normal',
									computeCurrentStates(clock.now),
									charConstellationLevel,
									undefined,
									undefined,
									variantCtx
								)
							: undefined;
					const cancel =
						dashForm?.chargeSpin !== undefined &&
						prevAct !== null &&
						(/^C\d*$/.test(prevAct) || prevAct === 'F') &&
						nextAct !== null &&
						/^C\d*$/.test(nextAct);
					if (spin) nightsoulCharging(ctx, clock, char, blockStart, false);
					spin = null;
					// ⚓ A form's dash spends Nightsoul at its start (Mavuika's
					// Flamestrider Sprint, 10 — gcsim `dash.go`). Only a pool holder asks.
					const dashCost = dashForm?.nightsoulCost?.perDash;
					if (dashCost) nightsoulSpend(ctx, clock, char, blockStart, dashCost);
					const duration = cancel ? dashForm!.chargeSpin!.cancelDashTravel : DASH_FRAMES;
					emitAction({
						action: t === 'D' ? 'dash' : 'jump',
						label: t,
						time: blockStart,
						duration
					});
					// The form's dash HIT (Flamestrider Sprint: Pyro 1U at its travel
					// frame, on the form's counter). gcsim tags it no attack class, so
					// it lands an application and no hit record.
					if (dashForm?.dashHit) {
						const at = blockStart + dashForm.dashHit.frame;
						const dElement = resolveElementRef(dashForm.infusion, variantCtx) ?? char.element;
						const dStates = computeCurrentStates(blockStart);
						clock.schedule(at, Band.LAND, () =>
							emitReactionsAtSwing(
								ctx,
								clock,
								char,
								'normal',
								dElement,
								dashForm.noICD,
								at,
								dStates,
								charConstellationLevel,
								stackState,
								undefined,
								undefined,
								dashForm.icdCounter
							)
						);
					}
					clock.advance(clock.now + duration);
					// ⚓ A cancel dash pays NO human pad: the player pressed and held
					// the next `C` BEFORE tapping the dash, so the game executes it the
					// moment the dash allows — a buffered input, like N → N. Verified by
					// Nate in game for CDC (one held C, D tapped mid-hold) and frame by
					// frame on Prydwen's FDC demo (C held, then D), 2026-10-16. gcsim's
					// own name for the resume's windup skip is `buffered`.
					if (!cancel) humanPad(t === 'D' ? 'dash' : 'jump', j);
				}
			}
		}

		// Ensure minimum on-field width — of the STAY, so it is asked once, where the
		// turn ends, against where it began. A segment a same-character `>`
		// continues adds nothing here: `Xilonen > Xilonen E` is `Xilonen E`, and a
		// lap that ends on its bare opener walks straight into the next lap's
		// first action. ⚠️ Its track can then be zero-width; it is still pushed,
		// since a lap is a fixed stride of tracks (RotationTimeline `lapStarts`).
		const continues = i < segments.length - 1 && !swapFollows;

		// ⚓ A STANCE THAT HOLDS THE FIELD (`holdsField`, Mizuki round, 2026-10-16):
		// the turn does not end until the stance does. Dreamdrifter attacks on its
		// own, so `Mizuki E > Xingqiu …` has nothing between the cast and the swap
		// and used to cut a 5–10s stance at 30f. A LOOP, not one advance: A1's
		// Swirls land DURING the wait and push the end further, so each advance
		// re-reads it (bounded — every extension has a `maxExtensions`).
		// ⚓ The player's two ways out: a TRAILING `~Xs` is "swap here" (the
		// Sacrificial double-E opens her stance for ~2s), and her E re-press ends
		// the stance at the press (`endsStance`), after which there is nothing to
		// wait for. ⚠️ Only the LAST token counts — `E ~1s Q` still holds.
		if (!continues && cs.stance?.holdsField) {
			const SKIP = new Set(['optional', 'or-alt', 'stack-assert', 'separator']);
			let last = expandedTokens.length - 1;
			while (last >= 0 && SKIP.has(expandedTokens[last].kind)) last--;
			const endsOnWait = last >= 0 && expandedTokens[last].kind === 'time';
			if (!endsOnWait) {
				const stance = cs.stance;
				while (stance.end > clock.now) clock.advance(stance.end);
			}
		}

		const stayStart: number = carried?.start ?? turnStart;
		if (!continues && clock.now <= stayStart) clock.advance(stayStart + MIN_ACTIVE_F);

		track.activeEnd = clock.now;
		ctx.tracks.push(track);

		if (continues)
			carry = {
				turn,
				start: stayStart,
				normalCounter,
				lastEText,
				stackState,
				stackInstances
			};

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
		// ⚓ Through `closeStateWindows`, the ONE off edge (charged-forms round,
		// 2026-09-16): the inline clamp it replaced made the same two writes.
		if (swapFollows && cs.statesTerminatingOnSwap.size > 0) {
			for (const name of cs.statesTerminatingOnSwap) {
				closeStateWindows(ctx, cs, char.id, name, clock.now);
			}
			cs.statesTerminatingOnSwap.clear();
		}
		// A window this swap just closed may chain into another (Lauma's deer →
		// its cooldown, which keeps running off-field). Step 2 of the settle
		// only: a swap is not an action, so nothing flagged `terminatesOnAction`
		// closes here on its own account.
		if (swapFollows) materialiseStateChains(ctx, cs, char.id, clock.now);

		if (swapFollows && cs.stance) {
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
				// ⚓ The shared off edge (`clampStance`): window, companion, and a
				// stance-end cooldown clock moved to the swap — see its doc. A stance
				// that already expired on its own is untouched (the clamp keeps the
				// earlier end), so a later swap never restarts its cooldown.
				clampStance(ctx, cs, char.id, clock.now);
				cs.stance.terminatesOnSwap = false;
				// ↻ 2026-10-16: the owner bar is clamped too (`ownerUptime`, inside
				// `clampStance`) — a swap-ended stance used to keep its full width.
				// ⚠️ Except the states a Nightsoul pool OWNS: its Blessing outlives a
				// swap (Mavuika's Ring keeps drawing on it off-field) and the pool
				// re-writes those ends itself, just below.
				for (const [state, endTime] of cs.states) {
					if (ownsState(ctx, char.id, state)) continue;
					if (endTime > clock.now) cs.states.set(state, clock.now);
				}
				// Mirror the clamp onto the IR state-window records for this char.
				for (const rec of ctx.stateWindowRecs) {
					if (ownsState(ctx, char.id, rec.name)) continue;
					if (rec.characterId === char.id && rec.end > clock.now) rec.end = clock.now;
				}
			}
		}

		// The Nightsoul pool's swap-out: the Crucible ends, the Flamestrider turns
		// into the Ring and the Blessing carries on (Mavuika; `sim/nightsoul.ts`).
		if (swapFollows && char.nightsoulPool) nightsoulOnSwapOut(ctx, clock, char, clock.now);
		// A swap ends a timed Blessing armed to end (gcsim's `OnRemoved` fires on it).
		if (swapFollows && char.timedBlessing) timedBlessingOnAction(ctx, char, clock.now, false);

		// Swap time before the next character enters. ⚠️ The last turn adds
		// nothing: the rotation ends when its final action does, not a swap later.
		// Nor does a turn the same character continues (see `swapFollows`).
		if (swapFollows) clock.advance(clock.now + ctx.swapF);
	}

	// ⚓ Drain the queue, then report the PRE-DRAIN frame. An application that lands
	// after the rotation's last action is real and must fire — Klee's mines land 240
	// frames after her E — but it is not more rotation, and letting the drain move
	// `clock.now` would stretch the timeline ruler by however long the last summon
	// took to detonate. Same rule `dispatchShieldEnds` already follows for a shield
	// still open at the end.
	const endFrame = clock.now;
	clock.drain();

	// Final pass: any shield windows still open at rotation end fire their
	// onShieldEnd dispatch at their scheduled expiry (clamped to the rotation's
	// observed totalDuration so events don't drift past the timeline ruler).
	dispatchShieldEnds(ctx, Infinity);

	return endFrame;
}
