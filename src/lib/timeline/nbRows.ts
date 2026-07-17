/**
 * src/lib/timeline/nbRows.ts
 *
 * Nightsoul-Burst (NB) lane projection. The greedy cooldown-gated derivation
 * moved PARSER-SIDE in the post-P4 #5 arc (phase 3): `parseNotation` emits
 * `nightsoulBurst` events (any E/Q cast, or a catalyst character's
 * input-token anchor, fires when the team NB clock is ready; cooldown
 * 18/12/9s by Natlan count). This module is now a pure filter/map of that
 * event stream — team context (Natlan count, catalyst ids) lives with the
 * parser's `teamCharacters` input.
 */

import type { TimelineEvent } from '$lib/utils/notationParser';

export type NBBar = { start: number; cooldown: number };

/** Projects the parser's `nightsoulBurst` events into NB lane bars. */
export function computeNBBars(events: TimelineEvent[]): NBBar[] {
	const result: NBBar[] = [];
	for (const ev of events) {
		if (ev.kind === 'nightsoulBurst') result.push({ start: ev.time, cooldown: ev.cooldown });
	}
	return result;
}
