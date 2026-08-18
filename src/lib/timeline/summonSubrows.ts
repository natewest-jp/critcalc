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

import {
	computeSummonTicks,
	type TimelineBar,
	type TimelineWindow
} from '$lib/utils/notationParser';
import { findSummonsForBar } from '$lib/sim/summons';
import type { CharacterData } from '$lib/types/character';
import type { SlottedTrack, SummonSubrow } from './types';

/** Tick timestamps for a summon's `effects[]` over [spawnAt, endAt].
 *  ↻ 2026-08-15: MOVED to `notationParser.ts` and re-exported here. The
 *  finalize pass needs the same walk to synthesize off-field hits, and the
 *  parser is runtime-import-free, so it cannot import from `$lib/timeline`.
 *  Re-exported rather than forked — see the ⛔ note at its new home. */
export { computeSummonTicks };

/** Resolve ALL summons owned by a given E/Q cast (variant-aware). Empty for
 *  stance abilities or abilities without `summons[]`.
 *
 *  ⚓ ONE RESOLVER SINCE 2026-08-16 (gauge round L3c). This used to be a
 *  character-for-character COPY of the parser's `findSummonsForBar`, and both
 *  wore a "MUST STAY IDENTICAL" warning — the parser authors the windows this
 *  walk assigns to lanes, so a disagreement drops a window on the floor
 *  (`rowMap.get` misses and Pass 2 skips it silently). It is now the same
 *  function, re-exported under its old name so this module's consumers and
 *  `notationParser.ir.test.ts` do not move. ⛔ Do not fork it again. */
const findCastSummons = findSummonsForBar;
export { findCastSummons };

export function computeSummonSubrows(
	annotatedTracks: SlottedTrack[],
	summonWindows: readonly TimelineWindow[],
	/** ⚠️ RETAINED, UNREAD (2026-08-18). The tick walk this fed moved to
	 *  `finalize`, which resolves the constellation itself — but the parameter
	 *  stays so the two call sites (the timeline component and the projection
	 *  bundle) do not move, and so a future per-slot projection has it in hand.
	 *  ⛔ Do not reach for it to derive anything: this pass no longer computes. */
	_constellationLevels: Record<string, number>,
	getCharacter: (id: string) => CharacterData | null
): SummonSubrow[] {
	// ── Pass 1: walk the slot-annotated tracks to fix sub-row order and resolve
	//    each (characterId, summon.label, source) cast's summon for lane
	//    registration. ↻ It no longer resolves the Summon OBJECT — the tick walk
	//    that needed it moved to `finalize` (2026-08-18). This walk NO LONGER computes spawn/end/truncation — those
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
			// ⚠ The spawn instant here is a LOOKUP KEY, not geometry — it has to
			// reproduce the parser's window `start` exactly, or the re-sort below
			// silently falls back to index 0 for every bar. It still has to match
			// summonSpan()'s primary/secondary split in notationParser.ts.
			//
			// ↻ 2026-08-16: it used to have to match the parser's FLOAT ARITHMETIC
			// bit-for-bit as well — two independent expressions in two modules
			// required to agree exactly on a `seconds + frames/60` sum. That was a
			// live latent bug with no test on it; integer frames (gauge-round.md
			// C1) removed the whole hazard, and this key is now an integer.
			const spawnAt = bar.start + (i === 0 ? (bar.summonActivatesAt ?? 0) : (summon.spawnsAt ?? 0));
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
		// ⚓⚓ THE PARSE PUBLISHES A SUMMON'S TICKS; THIS DOES NOT DERIVE THEM
		// (2026-08-18). Until now the fixed-cadence walk lived here and the
		// state-gated instants came off the window, which made the ticks a reader
		// SEES and the ticks that FIRE two computations required to agree — the
		// "MUST STAY IDENTICAL" shape this file has already paid for once with
		// `findCastSummons`/`findSummonsForBar`. `finalize` is the one producer now.
		//
		// ⚠️ It is also the only way a TEAM-GATED cadence can work: Aino's burst
		// ticks twice as fast under Ascendant Gleam, which is a `teamFaction`
		// condition, and this pass has no team-faction context — it would have had
		// to duplicate the parser's, which is exactly the drift this removes.
		//
		// ⛔ Do not reintroduce a local walk for "just one case".
		row.bars.push({ start: w.start, end: w.end, source: w.source, ticks: w.ticks ?? [] });
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
