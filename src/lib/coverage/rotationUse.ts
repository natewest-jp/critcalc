/**
 * src/lib/coverage/rotationUse.ts
 *
 * Which parts of a kit a ROTATION reaches — the planner's opt-in coverage
 * strips (⚓ Nate 2026-09-23) dim the rest, so the strip answers "can I trust
 * THIS rotation?" rather than "how complete is this character?". A C-column
 * above the slot's constellation is out of reach; an action the notation never
 * types (no `P`, no `Q`) is unused. The passives always apply (ascension 4).
 * Pure, read off the parse's own IR — never a second reading of the notation.
 */

import type { TimelineEvent } from '$lib/utils/rotationEvents';
import type { CoverageSegmentKey } from './deriveCoverage';

const ACTION_KEYS: Record<'normal' | 'charged' | 'plunge', CoverageSegmentKey[]> = {
	normal: ['N.timing', 'N.application'],
	charged: ['C.timing', 'C.application'],
	plunge: ['P.timing', 'P.application']
};
const CAST_KEYS: Record<'skill' | 'burst', CoverageSegmentKey[]> = {
	skill: ['E.timing', 'E.application', 'E.grants'],
	burst: ['Q.timing', 'Q.application', 'Q.grants']
};
const C_KEYS: [number, CoverageSegmentKey][] = [
	[1, 'C1'],
	[2, 'C2'],
	[4, 'C4'],
	[6, 'C6']
];

/** The segments `characterId`'s part of the rotation does NOT reach. */
export function unusedSegments(
	events: readonly TimelineEvent[],
	characterId: string,
	constellation: number
): Set<CoverageSegmentKey> {
	const used = new Set<CoverageSegmentKey>(['A1', 'A4', 'extra']);
	for (const ev of events) {
		if (!('characterId' in ev) || ev.characterId !== characterId) continue;
		if (ev.kind === 'cast') for (const k of CAST_KEYS[ev.ability]) used.add(k);
		else if (ev.kind === 'action' && ev.action in ACTION_KEYS)
			for (const k of ACTION_KEYS[ev.action as keyof typeof ACTION_KEYS]) used.add(k);
	}
	for (const [level, key] of C_KEYS) if (constellation >= level) used.add(key);
	const all: CoverageSegmentKey[] = [
		...Object.values(ACTION_KEYS).flat(),
		...Object.values(CAST_KEYS).flat(),
		'A1',
		'A4',
		'extra',
		...C_KEYS.map(([, k]) => k)
	];
	return new Set(all.filter((k) => !used.has(k)));
}
