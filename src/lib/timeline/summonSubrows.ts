/**
 * src/lib/timeline/summonSubrows.ts
 *
 * Summon lane computation — P4 step 3c (2026-07-17).
 *
 * One sub-row per (slotIdx, characterId, summon.label) so refreshes from
 * different casts sharing a label collapse onto a shared sub-row (e.g.
 * Fischl E Oz and Fischl Q Oz).
 *
 * Spawn/end/truncation are now PARSER-AUTHORITATIVE: this module consumes the
 * `summon` `TimelineWindow`s the parser emits (spawn offset applied,
 * terminatesOn swap/recast truncation already resolved) instead of
 * reconstructing spans from bar geometry. The track walk survives to (a) fix
 * sub-row (lane) ordering identically to the pre-3c output, (b) fix each lane's
 * BAR ordering identically, and (c) resolve each cast's `Summon` object so
 * `computeSummonTicks` can walk its effects. Tick computation + condition
 * gating are unchanged, now fed by window spans.
 *
 * BAR-ORDER fidelity (P4 3c, 2026-07-17): the parser pushes summon windows in
 * track-walk order (track order; eBars then qBars within a track) but then
 * sorts ALL windows by `start` for a deterministic IR (notationParser.ts
 * `windows.sort`). The pre-3c walk instead ordered a lane's bars by that same
 * track-then-kind walk, which differs from start-order whenever a lane holds a
 * later-starting skill and an earlier-starting burst (corpus case: Fischl
 * `E … Q … E` → walk `[E@0.3, E@25.6, Q@5.15]`, not start `[E, Q, E]`). To keep
 * the derived bar array value-identical for every corpus case, Pass 1 records
 * the walk index of each summon-spawning cast and Pass 2 re-sorts each lane's
 * bars into that walk order rather than trusting the windows' start-order.
 *
 * Pure — extracted from RotationTimeline.svelte; lane geometry
 * (summonLaneTop and friends) stays component-side.
 */

import { evalCondition, type TimelineBar, type TimelineWindow } from '$lib/utils/notationParser';
import type { CastAbility, Summon } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import type { SlottedTrack, SummonSubrow } from './types';

/** Compute tick timestamps for a summon's `effects[]` over [spawnAt, endAt].
 *  Walks each effect with `trigger.type === "summonTick"` and emits one
 *  marker per interval. Conditions on the effect must definitively-true
 *  (or undefined); unresolvable runtime conditions abstain (no markers). */
export function computeSummonTicks(
	summon: Summon,
	spawnAt: number,
	endAt: number,
	cLevel: number
): number[] {
	const ticks: number[] = [];
	for (const eff of summon.effects ?? []) {
		if (eff.trigger.type !== 'summonTick') continue;
		if (evalCondition(eff.conditions, 4, new Set(), cLevel) === false) continue;
		const interval = eff.trigger.interval;
		if (!(interval > 0)) continue;
		const firstDelay = eff.trigger.firstTickDelay ?? interval;
		for (let t = spawnAt + firstDelay; t < endAt; t += interval) {
			ticks.push(t);
		}
	}
	ticks.sort((a, b) => a - b);
	return ticks;
}

/** Resolve ALL summons owned by a given E/Q cast (variant-aware). Empty for
 *  stance abilities or abilities without `summons[]`.
 *  ⚠ MUST STAY IDENTICAL to `findSummonsForBar` in notationParser.ts — that one
 *  authors the windows this walk assigns to lanes, so a disagreement drops a
 *  window on the floor (`rowMap.get` misses and Pass 2 skips it silently).
 *  ↻ 2026-08-14: both went from `summons[0]` to the whole array — see the
 *  parser's note for which three abilities were hiding a second summon. */
export function findCastSummons(
	char: CharacterData | null | undefined,
	kind: 'skill' | 'burst',
	label: string,
	abilityId?: string
): Summon[] {
	if (!char) return [];
	const candidates = char.abilities.filter((a): a is CastAbility => a.abilityType === kind);
	// Prefer the exact resolved ability (bar.abilityId — a state-gated sibling
	// can carry its own summon, e.g. Durin's Dark burst); else the
	// unconditioned base ability — stance-conditioned variants represent
	// caster state and don't carry summons.
	const ability =
		(abilityId !== undefined ? candidates.find((a) => a.id === abilityId) : undefined) ??
		candidates.find((a) => a.conditions === undefined) ??
		candidates[0];
	if (!ability) return [];
	const variant = ability.variants?.find((v) => (v.input as string[] | undefined)?.includes(label));
	return (variant?.summons?.length ? variant.summons : ability.summons) ?? [];
}

export function computeSummonSubrows(
	annotatedTracks: SlottedTrack[],
	summonWindows: readonly TimelineWindow[],
	constellationLevels: Record<string, number>,
	getCharacter: (id: string) => CharacterData | null
): SummonSubrow[] {
	// ── Pass 1: walk the slot-annotated tracks to fix sub-row order and resolve
	//    each (characterId, summon.label, source) cast's Summon object for tick
	//    computation. This walk NO LONGER computes spawn/end/truncation — those
	//    come from the parser windows below — but reproducing the pre-3c walk
	//    order keeps sub-row stacking (the visible ordering within a slot)
	//    byte-identical. Guards mirror the old emit(): skip zero-uptime bars and
	//    bars whose ability spawns no summon, so no phantom rows are registered.
	//
	//    TRAP invariant (P4 3c): the parser keys its summon windows by
	//    characterId and computes swap-out truncation as "next track with a
	//    different characterId". This module assigns each window a slotIdx via
	//    the character it belongs to. Those two agree AS LONG AS a character
	//    never occupies two slots at once — i.e. characterId ↔ slotIdx is a
	//    bijection over summon-bearing tracks.
	//
	//    ✅ 2026-08-13 (single truth): IT NOW HOLDS UNCONDITIONALLY, and the
	//    caveat this note used to carry is retired. There was exactly one way to
	//    violate it: the `?team=` hand-off (`importTeam`) and shared links passed
	//    their id array through VERBATIM with no dedup, so a crafted
	//    `?team=fischl,fischl,…` made `mapTracksToSlots` hand one characterId two
	//    slotIdx via `matching[usage % matching.length]`. Both routes now write
	//    the NOTATION instead, and the slots are read back through
	//    `orderedCharacterIds`, which dedupes — so a duplicate-character team can
	//    no longer be expressed, by any input, rather than merely being an
	//    invalid comp nobody was expected to try. The matching note lives on the
	//    parser finalize pass.
	const rowMap = new Map<string, SummonSubrow>();
	const subrowOrder: SummonSubrow[] = [];
	const summonByKey = new Map<string, Summon>();
	// Walk index per summon-spawning cast, keyed characterId::label::source::start
	// (start = the exact spawn time the parser stamps on the window, same float
	// ops). Restores pre-3c per-lane bar order — see BAR-ORDER fidelity in the
	// module header. A (characterId, ability-kind) pair can't cast twice at one
	// frame, so the key is unique per cast; zero-truncated casts get an index but
	// no window, harmlessly leaving gaps in the surviving-bar ordering.
	const walkIndex = new Map<string, number>();
	let walkSeq = 0;

	const registerBar = (track: SlottedTrack, bar: TimelineBar, kind: 'skill' | 'burst'): void => {
		if (bar.uptime <= 0) return;
		const char = getCharacter(track.characterId);
		// One lane per summon, registered in authored order — the primary keeps
		// the sub-row position it has always had and a secondary stacks under it.
		findCastSummons(char, kind, bar.label, bar.abilityId).forEach((summon, i) => {
			summonByKey.set(`${track.characterId}::${summon.label}::${kind}`, summon);
			// ⚠ The spawn instant here is a LOOKUP KEY, not geometry — it has to
			// reproduce the parser's window `start` exactly (same float ops, same
			// primary/secondary split) or the re-sort below silently falls back
			// to index 0 for every bar. See summonSpan() in notationParser.ts.
			const spawnAt =
				bar.start + (i === 0 ? (bar.summonActivatesAt ?? 0) : (summon.spawnsAt ?? 0)) / 60;
			walkIndex.set(`${track.characterId}::${summon.label}::${kind}::${spawnAt}`, walkSeq++);
			const key = `${track.characterId}::${summon.label}`;
			if (!rowMap.has(key)) {
				const row: SummonSubrow = {
					slotIdx: track.slotIdx,
					characterId: track.characterId,
					label: summon.label,
					bars: []
				};
				rowMap.set(key, row);
				subrowOrder.push(row);
			}
		});
	};

	for (const track of annotatedTracks) {
		for (const bar of track.eBars) registerBar(track, bar, 'skill');
		for (const bar of track.qBars) registerBar(track, bar, 'burst');
	}

	// ── Pass 2: project the parser's summon windows onto the sub-rows. The
	//    window carries the final span (spawn offset + swap/recast truncation
	//    already applied); we only add slot assignment (via the bijection above)
	//    and the tick markers.
	for (const w of summonWindows) {
		if (w.kind !== 'summon') continue;
		const row = rowMap.get(`${w.characterId}::${w.label}`);
		if (!row) continue; // character not slotted (dropped from annotatedTracks)
		const summon = summonByKey.get(`${w.characterId}::${w.label}::${w.source}`);
		const cLevel = constellationLevels[w.characterId] ?? 0;
		const ticks = summon ? computeSummonTicks(summon, w.start, w.end, cLevel) : [];
		row.bars.push({ start: w.start, end: w.end, source: w.source, ticks });
	}

	// The parser emits windows in start order (its final `windows.sort`), but the
	// pre-3c walk ordered each lane's bars by track-then-kind. Re-sort each lane's
	// bars into that walk order so the derived array is value-identical (see
	// BAR-ORDER fidelity in the module header). walkIndex is unique per cast, so
	// this is a total order over a lane's surviving bars.
	for (const row of subrowOrder) {
		row.bars.sort((a, b) => {
			const ia = walkIndex.get(`${row.characterId}::${row.label}::${a.source}::${a.start}`) ?? 0;
			const ib = walkIndex.get(`${row.characterId}::${row.label}::${b.source}::${b.start}`) ?? 0;
			return ia - ib;
		});
	}

	// Sub-rows registered by the walk but with no surviving window (every cast
	// truncated to zero length) carry no bars — drop them so the pre-3c "only
	// rows with ≥1 bar" output shape holds.
	return subrowOrder.filter((row) => row.bars.length > 0);
}
