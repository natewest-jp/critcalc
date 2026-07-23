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
import { FACETS, capMatchesFacet, isCapabilityUnknown, type FacetKey } from './facets';

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

export { deriveResonances, type Resonance, type ResonanceFacts } from '$lib/utils/resonance';

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
	return FACETS.filter(({ key }) =>
		entry.caps.some((c) => capMatchesFacet(c, key) && c.minCon <= conCap)
	).map(({ key }) => key);
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
			.filter((m) => m.caps.some((c) => capMatchesFacet(c, key) && c.minCon <= conCapOf(m.id)))
			.map((m) => m.displayName);
		const state: CoverageState = providers.length > 0 ? 'yes' : anyUnknown ? 'unknown' : 'no';
		return { facet: key, label, state, providers };
	});
}
