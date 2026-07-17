/**
 * src/lib/timeline/nbRows.ts
 *
 * Nightsoul-Burst (NB) lane computation: greedy cooldown-gated fire events
 * triggered by any E/Q cast or by a catalyst character acting on-field.
 * Pure — extracted from RotationTimeline.svelte (P4 step 3b). Consumes the
 * parser IR `cast` events for the E/Q trigger instants; still reads track
 * `inputBlocks` for the catalyst-normals case (movement/unset skipped).
 */

import type { CharacterTrack, TimelineEvent } from '$lib/utils/notationParser';

export type NBBar = { start: number; cooldown: number };

/**
 * Computes NB fire events from the rotation IR.
 * Triggered by any E/Q cast (`cast` events) or, for catalyst characters, by
 * any on-field input block except movement/unset.
 * Cooldown: 18s (1 Natlan unit), 12s (2), 9s (3–4).
 */
export function computeNBBars(
	events: TimelineEvent[],
	tracks: CharacterTrack[],
	catalystIds: Set<string>,
	natlanCount: number
): NBBar[] {
	if (natlanCount === 0) return [];
	const cd = natlanCount >= 3 ? 9 : natlanCount === 2 ? 12 : 18;

	const triggers: number[] = [];
	for (const ev of events) {
		if (ev.kind === 'cast') triggers.push(ev.time);
	}
	for (const track of tracks) {
		if (!catalystIds.has(track.characterId)) continue;
		for (const block of track.inputBlocks) {
			if (block.kind !== 'movement' && block.kind !== 'unset') triggers.push(block.start);
		}
	}
	triggers.sort((a, b) => a - b);

	const result: NBBar[] = [];
	let nextAllowed = -Infinity;
	for (const t of triggers) {
		if (t >= nextAllowed) {
			result.push({ start: t, cooldown: cd });
			nextAllowed = t + cd;
		}
	}
	return result;
}
