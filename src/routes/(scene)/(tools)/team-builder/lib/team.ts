/**
 * team-builder/lib/team.ts
 *
 * Pure model for Layer 3 (Assemble): the four team slots, the `?team=` URL
 * param, and the derived team-level FACTS — elemental resonance, coverage
 * checklist. Constitution line: a checklist of present/absent capabilities
 * exposes facts; a synergy score would be a verdict. Stay on the checklist
 * side — no aggregation, no rating.
 */

import type { CharacterIndexEntry } from '$lib/types/character';
import { FACETS, isCapabilityUnknown, type FacetKey } from './facets';
import { providesFacet } from '$lib/capabilities/deriveCapabilities';
import type { Board } from '$lib/boards.svelte';
import { SEASONS, liveSeasons } from '$lib/endgame';

export const TEAM_SIZE = 4;

export type TeamSlot = string | null;

// ---------------------------------------------------------------------------
// ?team= param
// ---------------------------------------------------------------------------

/** Parses `?team=a,b,c,d` into four slots — unknown ids and duplicates are
 *  dropped, extras beyond four ignored. Order is preserved (slot order is
 *  meaningful when this URL round-trips with the planner later). */
export function parseTeamParam(
	param: string | null,
	isValidId: (id: string) => boolean
): TeamSlot[] {
	const slots: TeamSlot[] = Array.from({ length: TEAM_SIZE }, () => null);
	if (!param) return slots;
	const seen = new Set<string>();
	let i = 0;
	for (const raw of param.split(',')) {
		if (i >= TEAM_SIZE) break;
		const id = raw.trim();
		if (!id || seen.has(id) || !isValidId(id)) continue;
		seen.add(id);
		slots[i++] = id;
	}
	return slots;
}

/** Compact form for the URL — filled slots only, comma-joined. */
export function serializeTeamParam(slots: readonly TeamSlot[]): string {
	return slots.filter((s): s is string => s !== null).join(',');
}

// ---------------------------------------------------------------------------
// Elemental resonance — game facts, active only with a full party of four.
// The model moved to $lib/utils/resonance.ts (shared with the rotation
// planner's always-on strip); re-exported here for this tool's consumers.
// ---------------------------------------------------------------------------

import { deriveResonances } from '$lib/utils/resonance';
export { deriveResonances };
export type { Resonance, ResonanceFacts } from '$lib/utils/resonance';

// ---------------------------------------------------------------------------
// Coverage checklist — present/absent capability facts across the slots
// ---------------------------------------------------------------------------

export type CoverageState = 'yes' | 'no' | 'unknown';

export type CoverageEntry = {
	facet: FacetKey;
	label: string;
	state: CoverageState;
	/** Display names of slot members providing the capability (gate-cleared). */
	providers: string[];
};

/** Capability facets a character provides within a constellation cap — a
 *  "find someone who does what this character does" pre-seed. (Phase 6's
 *  in-Team-Builder Audition mode seeds the Source filters with this.) */
export function facetsProvidedBy(entry: CharacterIndexEntry, conCap: number): FacetKey[] {
	return FACETS.filter(({ key }) => providesFacet(entry.caps, key, conCap)).map(({ key }) => key);
}

/**
 * One entry per capability facet: 'yes' when some slotted character provides
 * it within their constellation cap, 'unknown' when it doesn't derive but a
 * capability-unknown kit is in the team (a genuine stub whose absence of data
 * ≠ absence of capability — see isCapabilityUnknown; the frameless stubs with
 * complete caps give definitive answers), 'no' otherwise. Empty array when no
 * slot is filled.
 */
export function deriveCoverage(
	members: readonly (CharacterIndexEntry | null)[],
	conCapOf: (id: string) => number
): CoverageEntry[] {
	const filled = members.filter((m): m is CharacterIndexEntry => m !== null);
	if (filled.length === 0) return [];
	const anyUnknown = filled.some(isCapabilityUnknown);

	return FACETS.map(({ key, label }) => {
		const providers = filled
			.filter((m) => providesFacet(m.caps, key, conCapOf(m.id)))
			.map((m) => m.displayName);
		const state: CoverageState = providers.length > 0 ? 'yes' : anyUnknown ? 'unknown' : 'no';
		return { facet: key, label, state, providers };
	});
}

// ---------------------------------------------------------------------------
// Audition delta — what a swap changes about the TEAM
// ---------------------------------------------------------------------------

export type TeamDelta = {
	/** Capabilities the team has after the swap and not before (labels). */
	gained: string[];
	/** Capabilities the team loses. */
	lost: string[];
	/** Resonance labels before and after — present only when the party is
	 *  full (resonance needs four) and the swap changes it. */
	resonance?: { before: string[]; after: string[] };
};

/**
 * ⚓ The question an audition actually asks (Team Builder round, 2026-10-07):
 * not "how does this kit compare to that one" but "what happens to my TEAM if
 * I make this swap". Facts only — gained and lost, never a net score, and an
 * 'unknown' coverage state (an uncurated kit) counts as neither, so a stub
 * never reads as a loss.
 */
export function teamDelta(
	before: readonly (CharacterIndexEntry | null)[],
	after: readonly (CharacterIndexEntry | null)[],
	conCapOf: (id: string) => number
): TeamDelta {
	const was = new Map(deriveCoverage(before, conCapOf).map((c) => [c.facet, c]));
	const gained: string[] = [];
	const lost: string[] = [];
	for (const c of deriveCoverage(after, conCapOf)) {
		const prior = was.get(c.facet)?.state;
		if (c.state === 'yes' && prior === 'no') gained.push(c.label);
		if (c.state === 'no' && prior === 'yes') lost.push(c.label);
	}
	const res = (team: readonly (CharacterIndexEntry | null)[]) =>
		deriveResonances(team.map((m) => m?.element ?? null));
	const a = res(before);
	const b = res(after);
	const labels = (r: typeof a) => r.active.map((x) => x.label);
	const changed =
		!a.needsFullTeam && !b.needsFullTeam && labels(a).join('|') !== labels(b).join('|');
	return {
		gained,
		lost,
		...(changed && { resonance: { before: labels(a), after: labels(b) } })
	};
}

// ---------------------------------------------------------------------------
// A board team's name and hue
// ---------------------------------------------------------------------------

/** A team's name as its board says it: a Stygian battlefield, an Abyss half,
 *  else "Team N" (lineups design §11.6; the destination strip and the
 *  cards' screen-reader names read it). */
export function teamLabel(board: Pick<Board, 'preset' | 'season'>, index: number): string {
	if (board.preset === 'stygian') {
		const season = SEASONS.find((s) => s.version === board.season) ?? liveSeasons()[0];
		if (season?.battlefields[index]) return `Battlefield ${index + 1}`;
	}
	if (board.preset === 'abyss' && index < 2) return index === 0 ? 'First Half' : 'Second Half';
	return `Team ${index + 1}`;
}

const TEAM_HUES = ['first', 'second', 'third', 'fourth'] as const;

/** A team's hue (app.css `--team-hue-*`): four, cycling past the fourth. */
export const teamHue = (index: number): string =>
	`var(--team-hue-${TEAM_HUES[index % TEAM_HUES.length]})`;
