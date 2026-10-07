/**
 * team-builder/lib/facets.ts
 *
 * The Team Builder's roster split — the part of capability filtering that is
 * genuinely this tool's: the ownership ledger view, the "capability unknown"
 * rule, and the split that keeps uncurated kits visible instead of silently
 * dropping them.
 *
 * The facet VOCABULARY itself (FACETS, ConMode, conCapFor, matchesFacets,
 * facetBadges) moved to `$lib/capabilities/facets` when the Rotation Planner's
 * character picker adopted the same filters — same move identity filtering made
 * to `$lib/characterFilters` earlier. Both are re-exported here, so every
 * existing team-builder import keeps working unchanged.
 */

import type { CharacterIndexEntry } from '$lib/types/character';
import type { FacetKey } from '$lib/capabilities/deriveCapabilities';
import { buffFamilyOf, capMatchesFacet } from '$lib/capabilities/deriveCapabilities';
import { isCapabilityUnknown, matchesFacets } from '$lib/capabilities/facets';
import { matchesIdentity, type IdentityFilters } from '$lib/characterFilters';
import { matchesRoleFilter, roleFilterActive, type RoleFilter } from './roles';

export { buffFamilyOf, capMatchesFacet };
export type { BuffFamily, FacetKey } from '$lib/capabilities/deriveCapabilities';

// The shared capability-facet vocabulary (see the module note above).
export {
	FACETS,
	conCapFor,
	matchesFacets,
	facetBadges,
	isCapabilityUnknown
} from '$lib/capabilities/facets';
export type { ConMode, Badge } from '$lib/capabilities/facets';

// Identity filtering lives in the shared `$lib/characterFilters` module (reused
// by the planner's character Source overlay + the CharacterGrid component).
// Re-exported here so existing team-builder imports keep working.
export { matchesIdentity };
export type { IdentityFilters };

// ---------------------------------------------------------------------------
// Roster filtering
// ---------------------------------------------------------------------------

/** Roster-ledger view: everyone, only owned, or only wishlisted. */
export type OwnershipView = 'all' | 'owned' | 'wishlist';

export type RosterSplit = {
	/** Characters passing every active filter (judged on their capability data). */
	matches: CharacterIndexEntry[];
	/** Capability-unknown characters (see isCapabilityUnknown) passing identity
	 *  filters while capability facets are active — shown separately, never
	 *  silently dropped. Empty when no capability facet is selected (they then
	 *  sit in `matches` like anyone). */
	uncurated: CharacterIndexEntry[];
};

/**
 * What the ONE finder is asked. ⚓ 2026-10-07: the Roster grid and the
 * audition's candidates are the same question now — four pipelines used to
 * answer "who could do this?" and disagreed (the audition ignored ownership,
 * the slot alternatives ignored the constellation lens).
 */
export type FinderQuery = {
	identity: IdentityFilters;
	facets: ReadonlySet<FacetKey>;
	ownershipView?: OwnershipView;
	roles?: RoleFilter;
	/** Never offered — an audition's own team. */
	exclude?: ReadonlySet<string>;
	/** Owned characters first, keeping the roster's order within each half. */
	rank?: 'ownedFirst';
};

export function splitRoster(
	roster: CharacterIndexEntry[],
	query: FinderQuery,
	conCapOf: (id: string) => number,
	ownershipOf: (id: string) => 'owned' | 'wishlist' | undefined = () => undefined
): RosterSplit {
	const { identity, facets, ownershipView = 'all', roles, exclude, rank } = query;
	const matches: CharacterIndexEntry[] = [];
	const uncurated: CharacterIndexEntry[] = [];
	for (const entry of roster) {
		if (exclude?.has(entry.id)) continue;
		if (!matchesIdentity(entry, identity)) continue;
		if (ownershipView !== 'all' && ownershipOf(entry.id) !== ownershipView) continue;
		if (roleFilterActive(roles) && !matchesRoleFilter(roles.rolesOf(entry.id), roles)) continue;
		if (facets.size === 0) {
			matches.push(entry);
		} else if (isCapabilityUnknown(entry)) {
			uncurated.push(entry);
		} else if (matchesFacets(entry.caps, facets, conCapOf(entry.id))) {
			matches.push(entry);
		}
	}
	if (rank === 'ownedFirst') {
		const owned = (e: CharacterIndexEntry) => (ownershipOf(e.id) === 'owned' ? 0 : 1);
		// Array.prototype.sort is stable, so roster order holds within each half.
		matches.sort((x, y) => owned(x) - owned(y));
	}
	return { matches, uncurated };
}
