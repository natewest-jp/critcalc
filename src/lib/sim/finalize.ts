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
import { computeTeamFactionCounts } from '$lib/utils/teamComposition';
import { deriveBuffWindows } from '$lib/utils/buffWindows';
import type { CastEvent, ReactionEvent, TimelineWindow } from '$lib/utils/rotationEvents';
import type { SimContext } from './context';
import type { CharacterTrack, InputBlock, ParsedRotation, TimelineBar } from './types';
import { computeSummonDamageTicks, findSummonsForBar, summonSpan } from './summons';
import { collectApplications } from './aura';

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
			summonActivatesAt: ev.summonActivatesAt,
			sacProcFired: ev.sacProcFired,
			stackContext: ev.stackContext
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
				kind: ev.ability
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
		for (const [track, items] of trackItems) {
			items.sort((a, b) => a.id - b.id);
			track.inputBlocks = items.map((i) => i.block);
		}
	}

	const windows: TimelineWindow[] = [];

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
	for (const rec of ctx.stateWindowRecs) {
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
	const lastSummonWindowByKey = new Map<string, Extract<TimelineWindow, { kind: 'summon' }>>();
	// The resolved `Summon` behind each emitted window, kept parser-private for
	// the off-field hit synthesis in step 6c. Recorded HERE because this is the
	// only place the object is in hand — a window carries the summon's LABEL,
	// and re-resolving from the label alone cannot distinguish two summons that
	// share one (the reason `findSummonsForBar` takes a bar, not a name).
	const summonByWindow = new Map<Extract<TimelineWindow, { kind: 'summon' }>, Summon>();
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
					sourceCastId: ctx.castIdByBar.get(bar)
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
		const nbTeam = ctx.team.slotRoster
			? ctx.team.slotRoster.filter((c): c is CharacterData => c != null)
			: ctx.team.teamChars;
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
		const cLevel = ctx.constellationLevels?.[win.characterId] ?? 0;
		for (const tick of computeSummonDamageTicks(summon, win.start, win.end, cLevel)) {
			ctx.hitRecords.push({
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
		const buffTeam = ctx.team.slotRoster
			? ctx.team.slotRoster.filter((c): c is CharacterData => c != null)
			: ctx.team.teamChars;
		const buffFactionCounts = ctx.team.slotRoster
			? computeTeamFactionCounts(ctx.team.slotRoster)
			: ctx.team.teamFactionCounts;
		let buffElementCounts: ReadonlyMap<string, ReadonlyMap<Element, number>> = ctx.team
			.teamElementCountsByHolder;
		if (ctx.team.slotRoster) {
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
		for (const c of [...ctx.team.teamChars, ...buffTeam]) charById.set(c.id, c);
		const buffWindows = deriveBuffWindows({
			tracks: ctx.tracks,
			hits: ctx.hitRecords,
			castEvents: ctx.events.filter((e): e is CastEvent => e.kind === 'cast'),
			reactionEvents: ctx.events.filter((e): e is ReactionEvent => e.kind === 'reaction'),
			nbBars: ctx.events
				.filter((e) => e.kind === 'nightsoulBurst')
				.map((e) => ({ start: e.time, cooldown: e.cooldown })),
			windows,
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

	return {
		tracks: ctx.tracks,
		totalDuration,
		unknownTokens: ctx.unknownTokens,
		events: ctx.events,
		windows,
		applications: collectApplications(ctx)
	};
}
