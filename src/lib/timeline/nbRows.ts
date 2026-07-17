/**
 * src/lib/timeline/nbRows.ts
 *
 * Nightsoul-Burst (NB) lane computation: greedy cooldown-gated fire events
 * triggered by any E/Q cast or by a catalyst character acting on-field.
 * Pure — extracted from RotationTimeline.svelte (P4 step 3b). Fully
 * IR-driven since post-P4 #2: the catalyst-normals case reads `action`
 * events (anchor per input token; movement/unset excluded) instead of
 * walking track inputBlocks.
 */

import type { TimelineEvent } from '$lib/utils/notationParser';

export type NBBar = { start: number; cooldown: number };

/**
 * Computes NB fire events from the rotation IR.
 * Triggered by any E/Q cast (`cast` events) or, for catalyst characters, by
 * any on-field action except movement/unset — one trigger per input token
 * (the group ANCHOR event, `id === blockId`), preserving the legacy
 * per-block trigger cadence rather than firing per swing.
 * Cooldown: 18s (1 Natlan unit), 12s (2), 9s (3–4).
 */
export function computeNBBars(
	events: TimelineEvent[],
	catalystIds: Set<string>,
	natlanCount: number
): NBBar[] {
	if (natlanCount === 0) return [];
	const cd = natlanCount >= 3 ? 9 : natlanCount === 2 ? 12 : 18;

	const triggers: number[] = [];
	for (const ev of events) {
		if (ev.kind === 'cast') {
			triggers.push(ev.time);
		} else if (
			ev.kind === 'action' &&
			ev.id === ev.blockId &&
			ev.action !== 'dash' &&
			ev.action !== 'jump' &&
			ev.action !== 'unset' &&
			catalystIds.has(ev.characterId)
		) {
			triggers.push(ev.time);
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
