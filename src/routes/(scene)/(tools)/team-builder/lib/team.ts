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
import { FACETS, capMatchesFacet, type FacetKey } from './facets';

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
// Elemental resonance — game facts, active only with a full party of four
// ---------------------------------------------------------------------------

export type Resonance = {
	key: string;
	label: string;
	/** Short mechanical effect text (game fact, not advice). */
	effect: string;
	/** Element behind the resonance; absent for Protective Canopy. */
	element?: string;
};

const ELEMENT_RESONANCE: Record<string, { label: string; effect: string }> = {
	pyro: { label: 'Fervent Flames', effect: 'ATK +25%, cryo aura duration −40%' },
	hydro: { label: 'Soothing Water', effect: 'Max HP +25%, pyro aura duration −40%' },
	anemo: { label: 'Impetuous Winds', effect: 'Stamina cost −15%, move speed +10%, skill CD −5%' },
	electro: {
		label: 'High Voltage',
		effect: 'Electro-related reactions generate an elemental particle (5s CD)'
	},
	cryo: { label: 'Shattering Ice', effect: 'CRIT rate +15% vs frozen or cryo-affected enemies' },
	geo: {
		label: 'Enduring Rock',
		effect: 'Shield strength +15%; shielded hits +15% DMG, −20% enemy geo RES (15s)'
	},
	dendro: {
		label: 'Sprawling Greenery',
		effect: 'EM +50; reaction-triggered EM boosts (+30/+20, 6s)'
	}
};

export type ResonanceFacts = {
	/** Resonances active for the assembled four. Empty while the team is partial. */
	active: Resonance[];
	/** True when fewer than four slots are filled — resonance needs a full party. */
	needsFullTeam: boolean;
};

export function deriveResonances(elements: (string | null | undefined)[]): ResonanceFacts {
	const filled = elements.filter((e): e is string => !!e);
	if (filled.length < TEAM_SIZE) return { active: [], needsFullTeam: true };

	const counts = new Map<string, number>();
	for (const el of filled) counts.set(el, (counts.get(el) ?? 0) + 1);

	const active: Resonance[] = [];
	for (const [el, n] of counts) {
		if (n < 2) continue;
		const res = ELEMENT_RESONANCE[el];
		if (res) active.push({ key: el, element: el, ...res });
	}
	if (active.length === 0 && counts.size === TEAM_SIZE) {
		active.push({
			key: 'canopy',
			label: 'Protective Canopy',
			effect: 'All elemental and physical RES +15%'
		});
	}
	return { active, needsFullTeam: false };
}

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

/** Capability facets a character provides within a constellation cap — the
 *  pre-seed for the planner's "replace this slot" hand-off (`?replace=`):
 *  arriving at the grid already filtered to can-do-what-the-outgoing-one-did. */
export function facetsProvidedBy(entry: CharacterIndexEntry, conCap: number): FacetKey[] {
	return FACETS.filter(({ key }) =>
		entry.caps.some((c) => capMatchesFacet(c, key) && c.minCon <= conCap)
	).map(({ key }) => key);
}

/**
 * One entry per capability facet: 'yes' when some slotted character provides
 * it within their constellation cap, 'unknown' when it doesn't derive but an
 * uncurated kit is in the team (absence of data ≠ absence of capability),
 * 'no' otherwise. Empty array when no slot is filled.
 */
export function deriveCoverage(
	members: readonly (CharacterIndexEntry | null)[],
	conCapOf: (id: string) => number
): CoverageEntry[] {
	const filled = members.filter((m): m is CharacterIndexEntry => m !== null);
	if (filled.length === 0) return [];
	const anyUncurated = filled.some((m) => !m.curated);

	return FACETS.map(({ key, label }) => {
		const providers = filled
			.filter((m) => m.caps.some((c) => capMatchesFacet(c, key) && c.minCon <= conCapOf(m.id)))
			.map((m) => m.displayName);
		const state: CoverageState = providers.length > 0 ? 'yes' : anyUncurated ? 'unknown' : 'no';
		return { facet: key, label, state, providers };
	});
}
