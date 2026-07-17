/**
 * src/lib/timeline/moonsignRows.ts
 *
 * Moonsign lane computation: rolling Ascendant-Gleam buff windows granted to
 * non-Moonsign characters. Pure — extracted from RotationTimeline.svelte.
 */

import type { TimelineEvent } from '$lib/utils/notationParser';
import type { MoonsignRow } from './types';

/**
 * For each non-Moonsign slot, collects all E/Q cast times for that character
 * from the parser IR (`cast` events) and emits a 20s buff window per cast.
 * Windows are not deduplicated — stacking (DOM order) handles visual overlap.
 */
export function computeMoonsignRows(
	events: TimelineEvent[],
	nonMoonsignSlots: number[],
	slots: string[]
): MoonsignRow[] {
	return nonMoonsignSlots.map((slotIdx) => {
		const charId = slots[slotIdx];
		const times: number[] = [];
		for (const ev of events) {
			if (ev.kind !== 'cast' || ev.characterId !== charId) continue;
			times.push(ev.time);
		}
		times.sort((a, b) => a - b);
		return {
			slotIdx,
			windows: times.map((start) => ({ start, duration: 20 }))
		};
	});
}
