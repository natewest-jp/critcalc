/**
 * src/lib/timeline/summonSubrows.ts
 *
 * Summon lane computation — Phase 2 (2026-05-01).
 *
 * One sub-row per (slotIdx, characterId, summon.label) so refreshes from
 * different casts sharing a label collapse onto a shared sub-row (e.g.
 * Fischl E Oz and Fischl Q Oz). Bars are derived from each E/Q cast event
 * — the bar's `uptime` already carries the resolved summon duration.
 *
 * Pure — extracted from RotationTimeline.svelte; lane geometry
 * (summonLaneTop and friends) stays component-side.
 */

import { evalCondition, type TimelineBar } from '$lib/utils/notationParser';
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

/** Resolve the summon owned by a given E/Q cast (variant-aware). Returns
 *  undefined for stance abilities or abilities without `summons[]`. */
export function findCastSummon(
	char: CharacterData | null | undefined,
	kind: 'skill' | 'burst',
	label: string
): Summon | undefined {
	if (!char) return undefined;
	const candidates = char.abilities.filter((a): a is CastAbility => a.abilityType === kind);
	// Use the unconditioned base ability — stance-conditioned variants
	// represent caster state and don't carry summons.
	const ability = candidates.find((a) => a.conditions === undefined) ?? candidates[0];
	if (!ability) return undefined;
	const variant = ability.variants?.find((v) => (v.input as string[] | undefined)?.includes(label));
	return variant?.summons?.[0] ?? ability.summons?.[0];
}

export function computeSummonSubrows(
	annotatedTracks: SlottedTrack[],
	constellationLevels: Record<string, number>,
	getCharacter: (id: string) => CharacterData | null
): SummonSubrow[] {
	const rowMap = new Map<string, SummonSubrow>();
	const subrowOrder: SummonSubrow[] = [];

	// Walk slot-annotated tracks chronologically so swap-out events resolve
	// in source order. annotatedTracks already preserves segment ordering.
	for (let i = 0; i < annotatedTracks.length; i++) {
		const track = annotatedTracks[i];
		const char = getCharacter(track.characterId);

		// Find the next swap-out time for this character (used for terminatesOn:"swap").
		let swapOutAt = Infinity;
		for (let j = i + 1; j < annotatedTracks.length; j++) {
			if (annotatedTracks[j].slotIdx !== track.slotIdx) {
				swapOutAt = annotatedTracks[j].activeStart;
				break;
			}
		}
		// If this is the character's last track, the bar runs to its natural end.

		const cLevel = constellationLevels[track.characterId] ?? 0;

		const emit = (bar: TimelineBar, kind: 'skill' | 'burst') => {
			if (bar.uptime <= 0) return;
			const summon = findCastSummon(char, kind, bar.label);
			if (!summon) return;
			const spawnAt = bar.start + (bar.summonActivatesAt ?? 0) / 60;
			let endAt = spawnAt + bar.uptime;
			if (summon.terminatesOn === 'swap' && swapOutAt < endAt) {
				endAt = swapOutAt;
			}
			if (endAt <= spawnAt) return;

			const key = `${track.slotIdx}::${track.characterId}::${summon.label}`;
			let row = rowMap.get(key);
			if (!row) {
				row = {
					slotIdx: track.slotIdx,
					characterId: track.characterId,
					label: summon.label,
					bars: []
				};
				rowMap.set(key, row);
				subrowOrder.push(row);
			}

			// Recast termination: if the previous bar on this sub-row is still
			// open at the new spawn time and the source ability's summon is
			// `terminatesOn:"recast"`, truncate the prior bar (and trim its
			// ticks past the new end time).
			if (summon.terminatesOn === 'recast' && row.bars.length > 0) {
				const prev = row.bars[row.bars.length - 1];
				if (prev.end > spawnAt) {
					prev.end = spawnAt;
					prev.ticks = prev.ticks.filter((t) => t < spawnAt);
				}
			}

			const ticks = computeSummonTicks(summon, spawnAt, endAt, cLevel);
			row.bars.push({ start: spawnAt, end: endAt, source: kind, ticks });
		};

		for (const bar of track.eBars) emit(bar, 'skill');
		for (const bar of track.qBars) emit(bar, 'burst');
	}

	return subrowOrder;
}
