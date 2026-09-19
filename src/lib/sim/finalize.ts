/**
 * src/lib/sim/finalize.ts
 *
 * The parse's last pass: author the IR windows, stamp the owner uptimes, and
 * project the per-track bars and input blocks out of the event stream
 * (gauge-round L3c, lifted out of `notationParser.ts`).
 *
 * ⚠️⚠️ THE ORDER OF THE NUMBERED STEPS IS THE CONTRACT, not a narrative:
 *   1 → 1b  the uptime stamps must land before the bars are projected, or an
 *           extended owner projects its pre-extension width;
 *   → 6     the summon windows read the stamped bars;
 *   → 6c    the off-field hits need the TRUNCATED summon ends, which is why
 *           they are synthesized here and not during the parse;
 *   7 → 8   the buff derivation must see the SORTED streams, because its
 *           afterDuration first-window-per-cast join is order-sensitive.
 *
 * ⏭ Steps 6b (Nightsoul Bursts) and 6c (summon-tick hits) are the two that most
 * obviously want to be TASKS on the clock rather than a finalize sweep. They stay
 * here through L3 on purpose (L3 plan §4.2): both change `hits` order, which is
 * order-VISIBLE, and neither buys anything until the gauge lands at L5.
 */

import type { Element, Summon } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import { framesOf } from '$lib/utils/frames';
import { deriveBuffWindows } from '$lib/utils/buffWindows';
import type {
	CastEvent,
	ReactionEvent,
	StackThresholdEvent,
	TimelineWindow
} from '$lib/utils/rotationEvents';
import type { SimContext } from './context';
import type { ConditionContext } from './conditions';
import type { CharacterTrack, InputBlock, ParsedRotation, TimelineBar } from './types';
import {
	collectSummonTicks,
	computeSummonDamageTicks,
	findSummonsForBar,
	summonEndAt,
	summonSpawnAt
} from './summons';
import { collectApplications, collectAuraSeries } from './aura';
import { materialiseStateChains } from './states';
import { deriveFieldWindows } from './fields';
import { deriveGadgetWindows } from './gadgets';

/**
 * Authors the IR windows, stamps the owner uptimes, and projects the per-track
 * bars and input blocks. Runs once, after the last token.
 */
export function finalizeParse(ctx: SimContext, totalDuration: number): ParsedRotation {
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
	for (const rec of ctx.stanceWindowRecs) rec.castRef.uptime = rec.ownerUptime;
	for (const rec of ctx.summonExtRecs) rec.castRef.uptime = rec.ownerUptime;

	// 1b. Project the E/Q bars from the cast events (post-P4 #3). Bars are a
	//     pure per-track projection of the cast records — the bar ↔ cast
	//     bijection and field agreement hold by construction. Built AFTER the
	//     uptime stamps so extended owners project their final width.
	for (const { ev, track } of ctx.castRecords) {
		const bar: TimelineBar = {
			start: ev.time,
			uptime: ev.uptime,
			cooldown: ev.cooldown,
			readyAt: ev.readyAt,
			label: ev.label,
			castTime: ev.castTime,
			abilityId: ev.abilityId,
			variantLabel: ev.variantLabel,
			summonActivatesAt: ev.summonActivatesAt,
			sacProcFired: ev.sacProcFired,
			stackContext: ev.stackContext,
			// The pill's element: a stance opener's stance, else the first hit.
			...(ev.stanceElement !== undefined
				? { element: ev.stanceElement }
				: ev.element !== undefined
					? { element: ev.element }
					: {})
		};
		(ev.ability === 'burst' ? track.qBars : track.eBars).push(bar);
		ctx.castIdByBar.set(bar, ev.id);
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
		for (const { ev, track } of ctx.castRecords) {
			pushItem(track, ev.id, {
				start: ev.time,
				duration: ev.castTime,
				parts: [ev.label],
				kind: ev.ability,
				// The block tints what the cast LANDS first, like an infused swing's.
				...(ev.element !== undefined ? { element: ev.element } : {})
			});
		}
		const blocksByAnchor = new Map<number, InputBlock>();
		for (const { ev, track } of ctx.actionRecords) {
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
		// Human pads (2026-09-14): one label-less block each, sorted into place by
		// the id minted when the pad was inserted — after the action it follows,
		// before the one it delays.
		for (const pad of ctx.humanPads) {
			pushItem(pad.track, pad.id, {
				start: pad.start,
				duration: pad.duration,
				parts: [],
				kind: 'pad',
				padAfter: pad.after
			});
		}
		for (const [track, items] of trackItems) {
			items.sort((a, b) => a.id - b.id);
			track.inputBlocks = items.map((i) => i.block);
		}
	}

	const windows: TimelineWindow[] = [];

	// 1d. Chained state windows still pending (charged-forms round, 2026-09-16):
	//     a window with `onEnd` whose owner never acted again after it closed
	//     has had no settle point to write its chain at. Write it now — but only
	//     if the end has actually come. A deer still standing when the rotation
	//     stops has no cooldown yet, and a window that starts after the ruler
	//     ends would be a claim about time the chart does not show.
	for (const [charId, cs] of ctx.charStates) {
		materialiseStateChains(ctx, cs, charId, totalDuration);
	}

	// 2. Stance windows → `state` windows named "inStance" (post-P4 #4 merge:
	//    a stance is just a state with a source attached). Final ends —
	//    extension-adjusted, swap-clamped.
	for (const rec of ctx.stanceWindowRecs) {
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
	//
	// ⚓ A TOGGLE THAT WAS NEVER FLIPPED BACK ENDS WHERE THE ROTATION DOES
	// (Arkhe round, 2026-09-04). Its live end is `Infinity` — Furina stays in
	// Pneuma until a Charged Attack says otherwise — but a window is a drawable
	// span and every one of them is asserted finite corpus-wide.
	//
	// ⚠️⚠️ IT IS AN `isFinite` TEST, ⛔ NEVER `Math.min(rec.end, totalDuration)`.
	// A state window is ALLOWED to outlive the rotation — the rotation ends when
	// its last action does, not when the last thing it started finishes — and the
	// corpus differential measured exactly that on four characters the moment the
	// min was written: Varesa's nightsoulBlessing 1484→2384 against a 2112-frame
	// rotation, plus Durin, Ifa and Pyro Traveler. A toggle already clamped by a
	// swap or a `consumes` is finite and passes through untouched.
	for (const rec of ctx.stateWindowRecs) {
		windows.push({
			kind: 'state',
			characterId: rec.characterId,
			name: rec.name,
			start: rec.start,
			end: Number.isFinite(rec.end) ? rec.end : totalDuration,
			source: rec.source,
			transient: true,
			sourceCastId: rec.sourceCastId,
			sourceActionId: rec.sourceActionId
		});
	}

	// 4. Shield windows.
	for (const rec of ctx.shieldWindowRecs) {
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
	for (const [characterId, bars] of ctx.weaponProcBars) {
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
	const charById = new Map(ctx.team.teamChars.map((c) => [c.id, c]));
	// ⚓⚓ THE TEAM FACTS A TICK SERIES CAN BE GATED ON (2026-08-18). Aino's burst
	// ticks twice as fast under Ascendant Gleam, which is `teamFaction: moonsign
	// >= 2` — a condition that returns NULL without this context, and a series
	// whose condition is unresolvable ABSTAINS. Built once, and handed to every
	// summon-tick walk below so the markers a reader sees and the hits that fire
	// are computed from the identical answer.
	// ⚓ Per HOLDER since 2026-09-17: the element counts a `teamElementCount`
	// gate reads are the summon owner's (`tickConditionCtx` in aura.ts builds
	// the identical shape for the live chain).
	const tickCtxCache = new Map<string, ConditionContext>();
	const tickCtx = (holderId: string): ConditionContext => {
		let c = tickCtxCache.get(holderId);
		if (!c) {
			c = {
				teamFactionCounts: ctx.team.teamFactionCounts,
				teamEnabledReactions: ctx.team.teamEnabledReactions,
				teamElementCounts: ctx.team.teamElementCountsByHolder.get(holderId)
			};
			tickCtxCache.set(holderId, c);
		}
		return c;
	};
	const lastSummonWindowByKey = new Map<string, Extract<TimelineWindow, { kind: 'summon' }>>();
	// The resolved `Summon` behind each emitted window, kept parser-private for
	// the off-field hit synthesis in step 6c. Recorded HERE because this is the
	// only place the object is in hand — a window carries the summon's LABEL,
	// and re-resolving from the label alone cannot distinguish two summons that
	// share one (the reason `findSummonsForBar` takes a bar, not a name).
	const summonByWindow = new Map<Extract<TimelineWindow, { kind: 'summon' }>, Summon>();
	// The windows that are their cast's PRIMARY summon — what `duringSummon`
	// means (`holderStatesAt`'s own rule), handed to the buff pass's state index
	// so the finalize-time reading cannot widen it (state-gates round, §1.G).
	const primarySummonWindows = new Set<TimelineWindow>();
	for (let ti = 0; ti < ctx.tracks.length; ti++) {
		const track = ctx.tracks[ti];
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
		for (let k = ti + 1; k < ctx.tracks.length; k++) {
			if (ctx.tracks[k].characterId !== track.characterId) {
				swapOutAt = ctx.tracks[k].activeStart;
				break;
			}
		}
		const emitSummon = (bar: TimelineBar, kind: 'skill' | 'burst'): void => {
			if (bar.uptime <= 0) return;
			// ⚓⚓ ONE WINDOW, POSSIBLY SEVERAL OCCUPANTS (Arkhe round, landing c).
			// A `summonsFollowState` cast hands its window from one lineup to the
			// next when the gating state flips, and the parse RECORDED where — see
			// `ctx.lineupChanges`. Each span becomes its own summon window, so the
			// tick pass below measures each lineup's cadence from its own start,
			// which is what gcsim's `summonSalonMembers(0)` does on the flip.
			//
			// ⚠️ A cast with NO changes yields exactly one span carrying the bar's
			// own label, so the whole corpus goes down the identical path it always
			// did — ⛔ don't special-case that into a fast path and give the common
			// shape a second implementation.
			const changes = ctx.lineupChanges.get(ctx.castIdByBar.get(bar) ?? -1) ?? [];
			const spans: { variantLabel: string | null; from: number | null }[] = [
				{ variantLabel: bar.variantLabel ?? null, from: null },
				...changes.map((c) => ({ variantLabel: c.variantLabel, from: c.at }))
			];
			// The shared window's end, taken ONCE from the first occupant's geometry.
			let sharedEnd = Infinity;
			let sharedUntruncated = Infinity;
			spans.forEach((span, si) => {
				// One window PER SUMMON. Emitted in authored order so the primary
				// keeps the id it has always had and the extras land after it — the
				// lane ordering in summonSubrows follows the same walk.
				findSummonsForBar(summonChar, kind, bar.label, bar.abilityId, span.variantLabel).forEach(
					(summon, i) => {
						// ⚓ Both geometry answers come from `summons.ts` (L5e-a) so the
						// live tick path L5e-b adds cannot end up holding a second copy.
						// The swap clamp lives inside `summonEndAt`; recast truncation
						// stays here, below, because it shortens the PRIOR window rather
						// than this one — see that function's ⛔ note.
						// ⚠️ A REPLACEMENT SPAWNS WHERE THE FLIP WAS, with no delay of its own
						// — gcsim passes 0 rather than the summon's `spawnsAt`, because the
						// spawn delay belongs to a cast animation and there is no second cast.
						const spawnAt = span.from ?? summonSpawnAt(bar.start, bar.summonActivatesAt, summon, i);
						// The ONE gate a secondary's `durationModifiers` resolve under — the
						// tick walk's own (see `summonEndAt`).
						const endArgs = {
							spawnAt,
							barUptime: bar.uptime,
							summon,
							index: i,
							cLevel: ctx.constellationLevels?.[track.characterId] ?? 0,
							context: tickCtx(track.characterId)
						};
						const naturalEnd = summonEndAt({ ...endArgs, swapOutAt });
						if (si === 0 && i === 0) sharedEnd = naturalEnd;
						if (si === 0 && i === 0) sharedUntruncated = summonEndAt(endArgs);
						// ⚓ A LATER OCCUPANT INHERITS THE REMAINING DURATION, it does not start a
						// fresh lifetime — so its end is the SHARED end, not its own `duration`.
						// And every occupant is cut short by the flip that replaced it.
						const nextFlip = spans[si + 1]?.from ?? Infinity;
						const endAt = Math.min(span.from === null ? naturalEnd : sharedEnd, nextFlip);
						if (endAt <= spawnAt) return;
						const key = `${track.characterId}::${summon.label}`;
						// Recast truncation: shorten the still-open prior window on this key.
						if (summon.terminatesOn === 'recast') {
							const prev = lastSummonWindowByKey.get(key);
							if (prev && prev.end > spawnAt) prev.end = spawnAt;
						}
						// ⚓ MARKERS THE PARSE MEASURED, for the series the projection cannot
						// walk (coordinated-attack round, 2026-08-18): a `whileNormalAttacking`
						// wave and an `onHit` damage proc fire when somebody swings or when
						// the opponent is hit, which is a fact of the parse. ⚠️ Sorted here —
						// a wave schedules its whole run at the swing that started it, so the
						// pushes can interleave out of order with a summon tick's.
						// ⚠️ Bounded by `[spawnAt, endAt)` so a landing whose travel carried it
						// past the summon's end is not drawn outside the bar.
						// ⚓ The UNTRUNCATED end — no swap (`swapOutAt` omitted), and the
						// recast/flip cuts below never touch it. `naturalEnd` above is
						// misnamed for this purpose: it already carries the swap.
						const untruncatedEnd = span.from === null ? summonEndAt(endArgs) : sharedUntruncated;
						const win: Extract<TimelineWindow, { kind: 'summon' }> = {
							kind: 'summon',
							characterId: track.characterId,
							label: summon.label,
							start: spawnAt,
							end: endAt,
							naturalEnd: untruncatedEnd,
							source: kind,
							sourceCastId: ctx.castIdByBar.get(bar)
						};
						windows.push(win);
						summonByWindow.set(win, summon);
						if (i === 0) primarySummonWindows.add(win);
						lastSummonWindowByKey.set(key, win);
					}
				);
			});
		};
		// ⚓⚓ CAST ORDER, NOT ABILITY-FAMILY ORDER (gauge round L5e-a½). This
		// walked every eBar and then every qBar, which made
		// `lastSummonWindowByKey` mean "last EMITTED" rather than "last CAST" —
		// so recast truncation could shorten a window whose cast had not
		// happened yet. It was unreachable only by luck: skills are emitted
		// first and the one summon a burst and a skill share (Fischl's Oz)
		// carried `terminatesOn` on the skill alone, so the branch never saw a
		// cross-family predecessor. Authoring the burst's missing flag reached
		// it immediately, and `Fischl Q E` produced an Oz window ending 2.75s
		// BEFORE it started.
		// ⚓ Cast order is also what L5e-b's live chain necessarily sees, so
		// this is the two paths agreeing rather than a local patch.
		const summonBars: [TimelineBar, 'skill' | 'burst'][] = [
			...track.eBars.map((b): [TimelineBar, 'skill' | 'burst'] => [b, 'skill']),
			...track.qBars.map((b): [TimelineBar, 'skill' | 'burst'] => [b, 'burst'])
		];
		// ⚠ Stable, and ties keep skill-before-burst — the order the two loops
		// gave for bars at the same frame, so a simultaneous pair is unmoved.
		summonBars.sort((a, b) => a[0].start - b[0].start);
		for (const [bar, kind] of summonBars) emitSummon(bar, kind);
	}

	// 6b. Nightsoul-Burst fire events (post-P4 #5 arc, phase 3 — the greedy
	// cooldown-gated derivation moved here from nbRows.ts; computeNBBars is
	// now a pure projection of these events). Team context prefers the SLOT
	// roster (`teamCharacters` — slots can hold Natlan/catalyst members never
	// typed in the notation, and the NB clock is a team-wide mechanic) and
	// falls back to the notation-derived team for Node scripts and tests.
	{
		const nbTeam = ctx.team.rosterChars;
		const natlanCount = nbTeam.filter((c) => c.region === 'Natlan').length;
		if (natlanCount > 0) {
			const nbCd = framesOf(natlanCount >= 3 ? 9 : natlanCount === 2 ? 12 : 18);
			const catalystIds = new Set(nbTeam.filter((c) => c.weapon === 'catalyst').map((c) => c.id));
			// Triggers: every E/Q cast; for catalyst characters, every input-token
			// ANCHOR action except movement/unset (per-block cadence, not
			// per-swing — the legacy nbRows rule, preserved verbatim).
			const nbTriggers: { time: number; characterId: string }[] = [];
			for (const ev of ctx.events) {
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
					ctx.events.push({
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
	// ↻⚠️⚠️ THIS PARAGRAPH USED TO CLAIM AN UPTIME CORRECTION IT DID NOT MAKE, and
	// the claim stood from 2026-08-15 to 2026-08-31. It read: "FOUR characters
	// leave a damaging summon AND hold an `onHit` effect that summon can fire —
	// Emilie (C2), Escoffier (A-passive), Anemo Traveler (C6), Xiangling (C1) …
	// For those the effect already fired at the CAST instant, so this is an
	// uptime correction rather than a from-nothing gain."
	//
	// ⛔ It was not. Synthesizing the hits was necessary and not sufficient: the
	// CHARACTER buff pools read `hitsForTrack`, which selects
	// `normal | charged | plunge`, and these hits are `skill | burst` — so until
	// the summon-tick pass landed (2026-08-31) they reached the ARTIFACT branch
	// and nothing else. Measured at the time: `Xiangling E` at C1 drew one pyro
	// shred window 0.22 → 6.22s while Guoba ticked at 2.10 / 3.77 / 5.43 / 7.10.
	// The capability rubric had it right and this comment had it wrong.
	//
	// ⚓ The lesson worth keeping: a hit reaching `hitRecords` is not a hit
	// reaching a CONSUMER, and this file cannot see which consumers select it.
	// Eleven characters were under-claiming by up to 21s behind that sentence.
	//
	// Runs HERE, at finalize, because a summon's FINAL end is only known once
	// step 6's recast/swap truncation has landed. Synthesizing during the parse
	// would emit ticks past an end a later recast pulls in.
	//
	// ⚠️⚠️ THESE HITS FEED `deriveBuffWindows` ONLY — they are deliberately NOT
	// put through `dispatchHit`, so `gainStacks`/`consumeStacks` never see them.
	// That machinery mutates live state in PARSE order, and a finalize-time hit
	// cannot be interleaved into a stream that has already been consumed without
	// a two-pass parse. ⛔ Do not "fix" that by calling `dispatchHit` here: the
	// ordering IS the problem, and a hit dispatched after the fact would apply
	// its gain to a stack state that later hits have already read.
	//
	// ✅ AND THE STACK MACHINERY IS REACHED ANYWAY, from the other end
	// (Half A, 2026-08-31). The LIVE tick chain in `sim/aura.ts` fires at a real
	// parse-order instant and already calls `notifyDamage` from there, so the
	// two-pass objection never applied to it: `dispatchEntityHitStacks` runs the
	// gains → snapshot → consumes there, and THIS hit carries the snapshot it
	// took (`stacks`, joined through `ctx.tickStacks`). ⚓ The two are one tick
	// seen twice — the one that FIRED and the one that is RECORDED — so ⛔ never
	// dispatch from both ends. See `docs/summon-tick-stacks-round.md` §10.

	// ⚓ FLAGGED `viaEntity`, and it is what makes `onHit.source: 'active'`
	// answerable. A tick carries its OWNER's id while its owner may be off field,
	// so an id comparison cannot tell a tick from a swing — the same distinction,
	// under the same name, that `offerApplication` draws for reaction procs.
	// ⚓⚓ ONE PRODUCER FOR A SUMMON'S MARKERS (2026-08-18). The fixed-cadence walk
	// used to live in `computeSummonSubrows`, which meant the ticks a reader SEES
	// and the ticks that FIRE were two computations required to agree — the law
	// `collectSummonTicks` and the live chain both carry, and the "MUST STAY
	// IDENTICAL" shape this codebase has already paid for once. They are one
	// computation now, and the projection reads the result off the window.
	//
	// ⚓ It is also the only way a TEAM-GATED cadence can work at all: Aino's burst
	// ticks twice as fast under Ascendant Gleam, which is a `teamFaction`
	// condition, and the renderer has no team-faction context — it would have had
	// to duplicate the parser's.
	//
	// ⚠️⚠️ IT RUNS HERE, NOT INSIDE `emitSummon`, AND THAT IS LOAD-BEARING. Recast
	// truncation shortens the PRIOR window after it has already been pushed
	// (`prev.end = spawnAt`), so a walk done at emission time uses an end that is
	// about to change. Measured while writing this: Fischl's first Oz kept ten
	// markers out at 82–613 frames on a window the burst had already cut to 44.
	// ⛔ Never move this back up.
	for (const win of windows) {
		if (win.kind !== 'summon') continue;
		const summon = summonByWindow.get(win);
		if (!summon) continue;
		const cLevel = ctx.constellationLevels?.[win.characterId] ?? 0;
		const measured =
			ctx.stateGatedTicks.get(`${win.characterId}::${win.label}::${win.source}::${win.start}`) ??
			[];
		const ticks = [
			...collectSummonTicks(
				summon,
				win.start,
				win.end,
				cLevel,
				() => true,
				tickCtx(win.characterId),
				win.naturalEnd
			).map((t) => t.time),
			// ⚠️ Bounded by the FINAL span so a wave landing past the summon's end —
			// or before a truncated window's start — is not drawn outside the bar.
			...measured.filter((t) => t >= win.start && t < win.end)
		].sort((a, b) => a - b);
		// ⚓ ONE MARK PER FRAME (⚓ Nate, 2026-09-19). A summon that heals and hits
		// on one cadence (Kuki's ring, Diona's mist, Kokomi's jellyfish — nine in
		// the corpus, Alyosha's Tugarin three deep) walked one marker per SERIES,
		// so every instant drew two or three stubs on the same pixel. Measured
		// before deciding: every duplicate is an EXACT same-frame pair, never a
		// near miss, so this is an equality test and not a tolerance. ⚠️ MARKERS
		// ONLY — the hit stream below walks damage series on its own and is
		// untouched; a marker says "the summon acted here", not how many effects.
		const marks = ticks.filter((t, i) => i === 0 || t !== ticks[i - 1]);
		if (marks.length > 0) win.ticks = marks;
	}
	// ⚓ THE FIRES, the same way (stack-threshold round, 2026-09-18): a
	// threshold's `damage` effect recorded its mark at the settle point that
	// fired it, naming the lane — the primary summon of the E/Q hosting the
	// accrual — and finalize stamps it on the window that was OUT at that
	// instant. Marks are in parse order, which is time order (feed order = time
	// order, pinned corpus-wide). A fire with no window under it draws no mark;
	// its buffs and shield still draw off the event.
	for (const mark of ctx.stackFireMarks) {
		for (const win of windows) {
			if (win.kind !== 'summon') continue;
			if (win.characterId !== mark.characterId || win.label !== mark.summonLabel) continue;
			if (mark.time < win.start || mark.time >= win.end) continue;
			(win.fires ??= []).push({ time: mark.time, element: mark.element });
			break;
		}
	}

	for (const win of windows) {
		if (win.kind !== 'summon') continue;
		const summon = summonByWindow.get(win);
		if (!summon) continue;
		const cLevel = ctx.constellationLevels?.[win.characterId] ?? 0;
		for (const tick of computeSummonDamageTicks(
			summon,
			win.start,
			win.end,
			cLevel,
			tickCtx(win.characterId)
		)) {
			ctx.hitRecords.push({
				characterId: win.characterId,
				time: tick.time,
				abilityType: win.source,
				element: tick.element,
				// A summon tick's damage class is its spawning cast's — there is no
				// per-effect override on a `summonTick` damage effect to prefer.
				damageTag: win.source,
				abilityName: summon.label,
				// ⚓ Delivered by the SUMMON. See the note above.
				viaEntity: true,
				// Provenance is the CAST that spawned the summon — what a reader
				// wants a summon-borne buff traced back to. `-1` is unreachable
				// (ids count from 0, bars↔casts are 1:1 by construction); it is
				// here so a missing link cannot fabricate a bogus event join.
				sourceEventId: win.sourceCastId ?? -1,
				// ⚓⚓ THE STACKS THE LIVE CHAIN DISPATCHED AGAINST (Half A,
				// 2026-08-31). The tick that FIRED is in `sim/aura.ts`, on the clock,
				// where the stack machinery can be mutated in parse order; this hit
				// is its record for `deriveBuffWindows`, which needs the same
				// post-gain pre-consume snapshot every other hit carries.
				// ⚠️⚠️ Absent is not "no stacks" — it is UNRESOLVABLE, and a `stacks`
				// Condition that cannot resolve is not dropped. Without this stamp a
				// stack-gated buff draws on EVERY tick.
				stacks: ctx.tickStacks.get(`${win.characterId}::${summon.label}::${tick.time}`)
			});
		}
	}
	// ⚠ Appended, NOT merged by time into the existing records. `hitsForTrack`
	// (buffWindows) only ever selects `normal`/`charged`/`plunge`, so a skill/
	// burst-tagged summon hit is invisible to the per-swing passes and cannot
	// perturb their order-sensitive refresh-merge. ⚠️ The two consumers that DO
	// want these — the artifact onHit branch and, since 2026-08-31, the
	// summon-tick onHit pass — each sort their own selection.

	// 7. Sort the event stream by time (stable).
	ctx.events.sort((a, b) => a.time - b.time);

	// Deterministic window order (by start, then end).
	windows.sort((a, b) => a.start - b.start || a.end - b.end);

	// 8. Buff windows (post-P4 #5 — parser-side who-buffs-whom-when). Runs
	// AFTER the sorts so the derivation consumes the exact time-ordered
	// event/window streams the renderer-side modules consumed (the
	// afterDuration first-window-per-cast join is order-sensitive). Team
	// context prefers the slot roster (same rule as the NB pass); the
	// element-count/faction maps mirror the renderer's construction exactly.
	{
		// ⚓ ONE ROSTER (small-fix bundle, 2026-09-17): the parser counts every
		// team fact over `ctx.team.rosterChars`, so the maps are read straight
		// off the context. This block used to rebuild them from the slot roster —
		// a second construction of the same facts, keyed only by slot holders, so
		// a fifth name had no entry here and one on the parse side.
		const buffTeam = ctx.team.rosterChars;
		const buffFactionCounts = ctx.team.teamFactionCounts;
		const buffElementCounts: ReadonlyMap<string, ReadonlyMap<Element, number>> = ctx.team
			.teamElementCountsByHolder;
		const charById = new Map<string, CharacterData>();
		for (const c of [...ctx.team.teamChars, ...buffTeam]) charById.set(c.id, c);
		const buffWindows = deriveBuffWindows({
			tracks: ctx.tracks,
			hits: ctx.hitRecords,
			castEvents: ctx.events.filter((e): e is CastEvent => e.kind === 'cast'),
			reactionEvents: ctx.events.filter((e): e is ReactionEvent => e.kind === 'reaction'),
			nbBars: ctx.events
				.filter((e) => e.kind === 'nightsoulBurst')
				.map((e) => ({ start: e.time, cooldown: e.cooldown })),
			stackFires: ctx.events.filter((e): e is StackThresholdEvent => e.kind === 'stackThreshold'),
			windows,
			primarySummonWindows,
			constellationLevels: ctx.constellationLevels ?? {},
			loadoutMap: ctx.loadoutMap ?? {},
			teamFactionCounts: buffFactionCounts,
			teamEnabledReactions: ctx.team.teamEnabledReactions,
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

	// 9. The gauge's own two projections, HOISTED out of the return literal
	// (Polestar-Field round, 2026-09-01) because step 10 needs both: the field's
	// ledger reads `applications`, and the settle inside `collectAuraSeries` is
	// what records a core spawned after the last cast.
	// ⚠️ The order between these two is NOT free and has not changed: the settle
	// advances the gauge past the last application to sample the decay tail, so
	// reading the applications first keeps the two projections describing the
	// same instant of the gauge's life.
	const applications = collectApplications(ctx);
	const auraSeries = collectAuraSeries(ctx, totalDuration);

	// 10. Gadgets — things a reaction left in the world, belonging to no
	// character (see the `gadget` arm of TimelineWindow).
	{
		for (const rec of ctx.gadgetRecs) {
			windows.push({
				kind: 'gadget',
				gadget: rec.kind,
				label: 'Dendro Core',
				start: rec.start,
				// ⛔ NOT the nominal end when something took it: a core eaten by a
				// Hyperbloom at 2s is not on the field for the remaining 4.
				end: rec.end ?? rec.nominalEnd,
				...(rec.endReason !== undefined ? { endReason: rec.endReason } : {})
			});
		}

		// ⚓ The Prism and its grant cycles. The buff ids continue the derivation
		// above — `projectTeamBuffRows` orders rows by first-window id, so two
		// windows sharing an id would make the row order depend on sort stability.
		const buffCount = windows.reduce((n, w) => n + (w.kind === 'buff' ? 1 : 0), 0);
		const fields = deriveFieldWindows({
			reactionEvents: ctx.events.filter((e): e is ReactionEvent => e.kind === 'reaction'),
			applications,
			nextBuffId: buffCount
		});
		for (const w of fields.gadgets) windows.push(w);
		for (const w of fields.buffs) windows.push(w);
		// The other reaction-spawned entities — a Thundercloud, a field of
		// Moondrifts. ⚓ Same stream, no gauge state: both are walks over reaction
		// events the IR already carries.
		const otherGadgets = deriveGadgetWindows(
			ctx.events.filter((e): e is ReactionEvent => e.kind === 'reaction')
		);
		for (const w of otherGadgets) windows.push(w);
		if (fields.gadgets.length > 0 || otherGadgets.length > 0 || ctx.gadgetRecs.length > 0) {
			windows.sort((a, b) => a.start - b.start || a.end - b.end);
		}
	}

	return {
		tracks: ctx.tracks,
		totalDuration,
		unknownTokens: ctx.unknownTokens,
		events: ctx.events,
		windows,
		applications,
		auraSeries
	};
}
