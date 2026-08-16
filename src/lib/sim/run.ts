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
	NormalAbility,
	NormalHit,
	SkillAbility
} from '$lib/types/ability';
import {
	getCooldownStartsAtStanceEnd,
	getDefaultDamageTag,
	getNormalHitDamageTag
} from '$lib/types/ability';
import { STACK_ASSERT_RE, type Token } from '$lib/utils/tokenizer';
import { resolveActionElement } from '$lib/utils/actionElement';
import { FPS, frameAt, framesOf } from '$lib/utils/frames';
import { GENERIC_NORMAL_HITS, GENERIC_SKILL, GENERIC_BURST } from '$lib/data/genericProfile';
import type { ActionEvent, CastEvent } from '$lib/utils/rotationEvents';
import { createClock } from './clock';
import type { SimContext } from './context';
import type { CharacterTrack } from './types';
import type { HitEvent } from './hits';
import { matchVariant, resolveEffectiveCharges, type ConditionContext } from './conditions';
import {
	resolveAbilityTiming,
	resolveActiveAbility,
	resolveChargeCastTime,
	resolveEQCastTime,
	resolveNormalCastTime,
	resolveStanceFields
} from './resolve';
import { expandBrackets, peekActionKey } from './tokens';
import {
	castKinds,
	closeStateWindows,
	holderStatesAt,
	inferredStates,
	openTransientState
} from './states';
import {
	applyDrain,
	applyLifetimeExpiry,
	dispatchConsumeStacks,
	dispatchConsumeStacksOnHit,
	dispatchGainStacks,
	dispatchGainStacksOnHit,
	syncOnHitToStackState,
	syncOnReactionToStackState,
	syncSourceLifetimeToStackState
} from './stacks';
import { dispatchOnCastExtensions } from './extensions';
import { dispatchShieldEnds, registerShieldOnCast } from './shields';
import { infusionAt, registerInfusionsOnCast } from './infusions';
import {
	advanceChain,
	getChainIndexMap,
	getCharacterCdResetTargets,
	getWeaponCdResetCooldown
} from './cooldowns';
import { emitReactionsAtCast, emitReactionsAtSwing, scheduleSummonTicks } from './aura';

/** Global dash/jump duration approximation (60fps). Character-specific values deferred. */
const DASH_FRAMES = 21;
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

		// ⚓ The turn starts where the clock is. There is no second cursor:
		// `clock.now` IS the rotation clock, and every advance below moves it.
		// ⚠️ `turnStart` is a WITNESS, not a clock — the min-active clamp below
		// needs to know whether this turn moved time at all.
		const turnStart = clock.now;

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
			applyDrain(ctx, char, t, states, stackState);
			applyLifetimeExpiry(char, t, stackState, stackInstances);
			syncSourceLifetimeToStackState(char, t, stackState, ctx.getCharState);
			syncOnReactionToStackState(char, t, stackState, stackInstances, ctx.getCharState);
			syncOnHitToStackState(char, t, stackState, stackInstances, ctx.getCharState);
		};

		// Dispatches a parser-private hit: gains → stacks snapshot → consumes →
		// record. `settle` is true at action sites (the cast pipeline already
		// settled at the cast instant). The hit's `stacks` snapshot is post-gain
		// pre-consume (the cast `stackContext` convention); cast-site hits carry
		// the cast's own snapshot instead (pre-set by the caller).
		const dispatchHit = (hit: HitEvent, settle: boolean): void => {
			if (ctx.team.teamHasOnHitStackEffects) {
				if (settle) settleStacksAt(hit.time);
				// One resolver for every holder (self included) — onHit condition
				// eval gets uniform state semantics regardless of who holds the
				// effect (holderStatesAt's summon check is broader than the
				// segment's `computeCurrentStates`; see its decl).
				const getHolderStates = (holder: CharacterData): ReadonlySet<string> =>
					holderStatesAt(ctx, holder, hit.time);
				dispatchGainStacksOnHit(
					ctx.team.teamChars,
					hit,
					getHolderStates,
					ctx.team.constellationByHolder,
					ctx.getCharState,
					stackState,
					stackInstances
				);
				if (hit.stacks === undefined && stackState.size > 0) hit.stacks = new Map(stackState);
				dispatchConsumeStacksOnHit(
					ctx.team.teamChars,
					hit,
					getHolderStates,
					ctx.team.constellationByHolder,
					ctx.getCharState,
					stackState,
					stackInstances
				);
			}
			ctx.hitRecords.push(hit);
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
						computeCurrentStates(clock.now),
						charConstellationLevel,
						getChainIndexMap(ctx, char.id, clock.now),
						stackState,
						variantCtx
					)?.bypassesCooldown === true;
				if (!bypassesGate) clock.advance(Math.max(clock.now, cs.qReadyAt));
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
						const scanStates = computeCurrentStates(clock.now);
						const scanE =
							resolveActiveAbility(
								char,
								'skill',
								scanStates,
								charConstellationLevel,
								getChainIndexMap(ctx, char.id, clock.now),
								stackState
							) ?? (ability as SkillAbility); // !isBurst branch: `ability` is the skill
						// Initialize this ability's charge queue on first sight:
						// all charges ready at t=0.
						if (!ctx.eChargeQueues.has(scanE.id)) {
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
								scanE.id,
								new Array(resolveEffectiveCharges(scanE, scanVariant, charConstellationLevel)).fill(
									0
								)
							);
						}
						// queue[0] is the earliest-ready charge (kept sorted ascending).
						const readyAt = ctx.eChargeQueues.get(scanE.id)![0];
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
				const states = computeCurrentStates(castStart);
				applyDrain(ctx, char, castStart, states, stackState);
				applyLifetimeExpiry(char, castStart, stackState, stackInstances);
				syncSourceLifetimeToStackState(char, castStart, stackState, ctx.getCharState);
				syncOnReactionToStackState(char, castStart, stackState, stackInstances, ctx.getCharState);
				// Appended by the onHit wiring (2026-07-17) — an APPEND to the
				// frozen settle order, not a reorder: syncs team/others-sourced
				// onHit accrual into the segment before conditions read it.
				syncOnHitToStackState(char, castStart, stackState, stackInstances, ctx.getCharState);
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
					if (!ctx.eChargeQueues.has(active.id)) {
						ctx.eChargeQueues.set(active.id, new Array(maxCharges).fill(0));
					}
					queue = ctx.eChargeQueues.get(active.id)!;
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
				ctx.events.push(castEvent);
				ctx.castRecords.push({ ev: castEvent, track });
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

				clock.advance(clock.now + castTime);
				if (!isBurst) lastEText = tok.text; // plunge-variant selection
				advanceChain(ctx, active, char.id, kind, clock.now);

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
							for (const [key, q] of ctx.eChargeQueues) {
								if (key !== char.id && !key.startsWith(`${char.id}__`)) continue;
								if (q.length === 0) continue;
								// Refund only charges still on CD; never push an
								// already-ready charge later.
								q[0] = Math.min(q[0], clock.now);
								q.sort((a, b) => a - b);
							}
						} else if (target === 'burst') {
							cs.qReadyAt = clock.now;
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
					ctx.stanceWindowRecs.push(cs.stance);
					// Open named state alongside inStance (e.g. nightsoulBlessing).
					// `opensState: "inStance"` is redundant (the stance IS the
					// inStance window — post-P4 #4 they are one record); skip it so
					// no source-less duplicate shadows the extension-adjusted one.
					if (stance.opensState && stance.opensState !== 'inStance') {
						cs.states.set(stance.opensState, endTime);
						ctx.stateWindowRecs.push({
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
					ctx.summonExtRecs.push(cs.summonExt);
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
					states,
					charConstellationLevel,
					chainIdx,
					stackState
				);
				// ⚓ Summon ticks now apply their element too (gauge round L5e-b).
				// Scheduled AFTER the cast's own applications so a cast and the
				// summon it spawns land in cast-then-tick order at the same frame,
				// and after the summonExt registration above so the chain can read
				// the extension record LIVE rather than a copy.
				scheduleSummonTicks(
					ctx,
					clock,
					char,
					kind,
					tok.text,
					active.id,
					castStart,
					spawn,
					castEvent,
					cs.summonExt?.castRef === castEvent ? cs.summonExt : undefined,
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
				// the cursor. The next ability that gates on this stack key picks
				// up the new count via the threaded `stackState` parameter.
				const m = tok.text.match(STACK_ASSERT_RE);
				if (m) {
					stackState.set(m[1], parseInt(m[2], 10));
				}
			} else {
				// 'label' or 'unknown'
				if (tok.kind === 'unknown') ctx.unknownTokens.push(tok.text);

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
					const nStates = computeCurrentStates(clock.now);
					const activeNormal = resolveActiveAbility(
						char,
						'normal',
						nStates,
						charConstellationLevel
					);
					// Frameless normals (uncurated stubs with hits:[], Blank) ride the
					// generic combo profile so swings get realistic per-position timing
					// instead of collapsing to zero duration. ⚠️ The framed-vs-not sentinel
					// is `anim` since L4b — it is what `isCurated` and characterLint now
					// require, and `swap` is an ordinary optional override.
					const rawHits = activeNormal?.hits;
					const hits = Number.isFinite(rawHits?.[0]?.frames?.anim) ? rawHits! : GENERIC_NORMAL_HITS;
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
						activeNormal?.infusion ?? infusionAt(ctx, char, clock.now)
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
							time: clock.now,
							duration: castS ?? 0,
							abilityId: activeNormal?.id,
							comboIndex: hitIndex,
							element: nElement
						});
						anchorId ??= ev.id;
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
							openTransientState(
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
						// Offer the swing to the aura, behind the normal-attack ICD
						// clock (ICD round). A catalyst `N5` applies on swings 1, 4
						// and 6 at the corpus cadence, not on all five.
						emitReactionsAtSwing(
							ctx,
							char,
							'normal',
							nElement,
							activeNormal?.noICD,
							clock.now,
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
								time: clock.now,
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
						computeCurrentStates(clock.now),
						charConstellationLevel
					);
					const castS = activeNormal
						? resolveChargeCastTime(activeNormal, t, nextKey, isBow)
						: null;
					const blockStart = clock.now;
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
					if (castS !== null) clock.advance(clock.now + castS);
					// Offer the charged shot to the aura. A catalyst CA and a bow's
					// aimed shot both apply; only the bow's runs a counter (a
					// catalyst's is gcsim `ICDTagNone`) — resolveActionIcd holds it.
					emitReactionsAtSwing(
						ctx,
						char,
						'charged',
						cElement,
						activeNormal?.noICD,
						clock.now,
						computeCurrentStates(clock.now),
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
								time: clock.now,
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
					// Plunge attack. Uses the active normal ability's plunge frames, or a
					// plungeVariant whose input[] matches the preceding E token text
					// (e.g. Kazuha's Midare Ranzan has distinct "After Hold E" frames).
					//
					// ⚓ `lP` reads `lowPlungeFrames`; `P` and `hP` read `plungeFrames`,
					// which is the HIGH plunge (L4b — Nate: the high plunge is what players
					// actually perform, so it keeps the plain name and the bare token).
					// The low map falls back to the high one, because gcsim models only one
					// plunge for three of our authors and none at all for Venti and Wanderer.
					const plungeStates = computeCurrentStates(clock.now);
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
					const isLowPlunge = t === 'lP';
					const basePlunge = isLowPlunge
						? (activeNormal?.lowPlungeFrames ?? activeNormal?.plungeFrames)
						: activeNormal?.plungeFrames;
					const plungeFrames = plungeVariant?.frames ?? basePlunge;
					if (plungeFrames) {
						const castS = frameAt(plungeFrames, nextKey);
						const blockStart = clock.now;
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
						clock.advance(clock.now + castS);
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
								clock.now,
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
							clock.now,
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
								time: clock.now,
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
					const blockStart = clock.now;
					emitAction({
						action: t === 'D' ? 'dash' : 'jump',
						label: t,
						time: blockStart,
						duration: DASH_FRAMES
					});
					clock.advance(clock.now + DASH_FRAMES);
				}
			}
		}

		// Ensure minimum on-field width
		if (clock.now <= turnStart) clock.advance(turnStart + MIN_ACTIVE_F);

		track.activeEnd = clock.now;
		ctx.tracks.push(track);

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
				if (end !== undefined && end > clock.now) {
					cs.states.set(name, clock.now);
					for (const rec of ctx.stateWindowRecs) {
						if (rec.characterId === char.id && rec.name === name && rec.end > clock.now) {
							rec.end = clock.now;
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
				const stanceEnd = Math.min(cs.stance.end, clock.now);
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
					const queue = ctx.eChargeQueues.get(cs.stance.ownerAbility.id);
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
					if (endTime > clock.now) cs.states.set(state, clock.now);
				}
				// Mirror the clamp onto the IR state-window records for this char.
				for (const rec of ctx.stateWindowRecs) {
					if (rec.characterId === char.id && rec.end > clock.now) rec.end = clock.now;
				}
			}
		}

		// Swap time before the next character enters. ⚠️ The last turn adds
		// nothing: the rotation ends when its final action does, not a swap later.
		if (i < segments.length - 1) clock.advance(clock.now + ctx.swapF);
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
