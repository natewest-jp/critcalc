/**
 * src/lib/endgameCycle.ts
 *
 * Which cycle of its endgame a lineup was planned for, and which is running
 * now (⚓ Nate 2026-11-11). A cycle is a Stygian season (its version, "7.2"),
 * an Abyss cycle (its start, "2026-10-16"), or a Theater season (its start,
 * "2026-11-01"): the same strings the lineup stores.
 *
 * ⚓ A lineup is an ARCHIVE of what was planned for its cycle: an edited one
 * keeps its cycle when the game moves on, and only an untouched one follows
 * the game. The Library leads with the running cycles ("This cycle"), and a
 * new cycle is announced with the New tag (`NewTag.svelte`).
 *
 * Pure: a caller passes the dates, so a test can stand anywhere in time.
 */

import { currentAbyss, currentSeason } from '$lib/endgame';
import { currentTheater, liveTheaterSeasons } from '$lib/theater';
import type { LineupBody } from '$lib/storage/records';

export type Endgame = 'abyss' | 'stygian' | 'theater';

/** The endgames in the order the Library's This cycle shows them. */
export const ENDGAMES: readonly Endgame[] = ['abyss', 'stygian', 'theater'];

type Body = Pick<LineupBody, 'preset' | 'season' | 'teams' | 'theater'>;

/** The cycle of `kind` running at `at`, by each endgame's own rule: a
 *  Stygian or Theater lineup falls back to the newest season (their pickers
 *  print dates), while the Abyss has none between cycles (its end guard,
 *  `currentAbyss`). */
export function cycleAt(kind: Endgame, at: Date = new Date()): string | undefined {
	if (kind === 'stygian') return currentSeason(at)?.version;
	if (kind === 'abyss') return currentAbyss(at)?.start;
	return (currentTheater(at) ?? liveTheaterSeasons(at)[0])?.start;
}

/** Anyone placed: what pins a lineup's cycle. */
export function lineupHasAnyone(body: Body): boolean {
	if (body.preset === 'theater') return (body.theater?.cast.length ?? 0) > 0;
	return body.teams.some((t) => t.slots.some((s) => s !== null));
}

/**
 * The cycle a lineup belongs to: the one it stores; else, for a lineup with
 * anyone in it that never stored one (an Abyss lineup from before Abyss
 * lineups were pinned), the cycle running at its last edit; else the running
 * one, which an untouched lineup follows. Nothing for a Custom lineup.
 */
export function lineupCycle(body: Body, updatedAt: number, today: Date = new Date()) {
	if (body.preset === 'custom') return undefined;
	const stored = body.preset === 'theater' ? body.theater?.season : body.season;
	if (stored) return stored;
	if (lineupHasAnyone(body)) {
		const then = cycleAt(body.preset, new Date(updatedAt));
		if (then) return then;
	}
	return cycleAt(body.preset, today);
}

/** The lineup was planned for the cycle running `today`. */
export function inThisCycle(body: Body, updatedAt: number, today: Date = new Date()): boolean {
	if (body.preset === 'custom') return false;
	const now = cycleAt(body.preset, today);
	return !!now && lineupCycle(body, updatedAt, today) === now;
}
