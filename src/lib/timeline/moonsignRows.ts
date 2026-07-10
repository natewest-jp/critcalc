/**
 * src/lib/timeline/moonsignRows.ts
 *
 * Moonsign lane computation: rolling Ascendant-Gleam buff windows granted to
 * non-Moonsign characters. Pure — extracted from RotationTimeline.svelte.
 */

import type { CharacterTrack } from '$lib/utils/notationParser';
import type { MoonsignRow } from './types';

/**
 * For each non-Moonsign slot, collects all E/Q cast times from that character's
 * tracks and emits a 20s buff window per cast. Windows are not deduplicated —
 * stacking (DOM order) handles visual overlap.
 */
export function computeMoonsignRows(
	tracks: CharacterTrack[],
	nonMoonsignSlots: number[],
	slots: string[]
): MoonsignRow[] {
	return nonMoonsignSlots.map((slotIdx) => {
		const charId = slots[slotIdx];
		const events: number[] = [];
		for (const track of tracks) {
			if (track.characterId !== charId) continue;
			for (const bar of track.eBars) events.push(bar.start);
			for (const bar of track.qBars) events.push(bar.start);
		}
		events.sort((a, b) => a - b);
		return {
			slotIdx,
			windows: events.map((start) => ({ start, duration: 20 }))
		};
	});
}
