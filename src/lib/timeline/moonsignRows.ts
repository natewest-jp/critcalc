/**
 * src/lib/timeline/moonsignRows.ts
 *
 * Moonsign lane computation: rolling Ascendant-Gleam buff windows granted to
 * non-Moonsign characters. Pure — extracted from RotationTimeline.svelte.
 */

import type { TimelineEvent } from '$lib/utils/notationParser';
import type { MergedEffectDisplay } from './types';
import type { MoonsignRow } from './types';
import { mergeRefreshedBars } from './mergeRefreshedBars';

/** Ascendant Gleam's grant, in seconds, per qualifying cast. */
const GLEAM_WINDOW_S = 20;

/**
 * For each non-Moonsign slot, collects all E/Q cast times for that character
 * from the parser IR (`cast` events) and emits a 20s buff window per cast.
 *
 * ↻ 2026-08-15: OVERLAPPING WINDOWS MERGE. This used to read "windows are not
 * deduplicated — stacking (DOM order) handles visual overlap", which is exactly
 * the behaviour the buff rows just retired: a character casting E and Q inside
 * 20s drew two bars and, the part that hurt, two identical labels. This lane
 * sat outside `projectTeamBuffRows` so it never picked the merge up (⚓ Nate
 * spotted it as the one bar still stacking).
 *
 * ⚓ Every Ascendant Gleam window is the SAME buff — one duration, one value,
 * one label — so unlike the buff rows there is no shape that could differ.
 * The empty `effects` array below says precisely that: the merge reduces to
 * "do these overlap", which is the whole question here.
 */
export function computeMoonsignRows(
	events: TimelineEvent[],
	nonMoonsignSlots: number[],
	slots: string[]
): MoonsignRow[] {
	const NO_SHAPE: MergedEffectDisplay[] = [];
	return nonMoonsignSlots.map((slotIdx) => {
		const charId = slots[slotIdx];
		const times: number[] = [];
		for (const ev of events) {
			if (ev.kind !== 'cast' || ev.characterId !== charId) continue;
			times.push(ev.time);
		}
		times.sort((a, b) => a - b);
		const merged = mergeRefreshedBars(
			times.map((start) => ({ start, end: start + GLEAM_WINDOW_S, effects: NO_SHAPE }))
		);
		return {
			slotIdx,
			// Back to {start, duration} — every consumer (renderer geometry, the
			// lane-extent max at RotationTimeline.svelte, the PNG export) reads
			// that shape, so the merge stays invisible to all of them.
			windows: merged.map((w) => ({ start: w.start, duration: w.end - w.start }))
		};
	});
}
