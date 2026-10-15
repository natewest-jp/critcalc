/**
 * builder/lib/facets.ts
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
 * existing builder import keeps working unchanged.
 */

import type { CharacterIndexEntry } from '$lib/types/character';
import type { FacetKey } from '$lib/capabilities/deriveCapabilities';
import { buffFamilyOf, capMatchesFacet } from '$lib/capabilities/deriveCapabilities';
import { isCapabilityUnknown, matchesFacets } from '$lib/capabilities/facets';
import { matchesIdentity, type IdentityFilters } from '$lib/characterFilters';
import { matchesRoleFilter, roleFilterActive, type RoleFilter } from '$lib/capabilities/roles';

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
// by the CharacterGrid component).
// Re-exported here so existing builder imports keep working.
export { matchesIdentity };
export type { IdentityFilters };

// ---------------------------------------------------------------------------
// Roster filtering
// ---------------------------------------------------------------------------

/** Roster-ledger view: everyone, only owned, or only wishlisted. */
export type OwnershipView = 'all' | 'owned' | 'wishlist';

/** The Show segment's choices — band B's character cell, or More when the
 *  cell folds it. */
export const OWNERSHIP_VIEWS: { key: OwnershipView; label: string; hint: string }[] = [
	{ key: 'all', label: 'All', hint: 'Every character' },
	{ key: 'owned', label: 'Owned', hint: 'Only characters you’ve marked as owned' },
	{ key: 'wishlist', label: 'Wishlist', hint: 'Only characters you’ve wishlisted' }
];

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
 * What the ONE finder is asked. ⚓ 2026-10-07: four pipelines used to answer
 * "who could do this?" and disagreed (the audition ignored ownership, the
 * slot alternatives ignored the constellation lens). ↻ 2026-10-13: swap mode
 * asks this same finder and groups what it returns, so `exclude` and `rank`
 * — the audition's half — retired with it (a swap leaves out the team and
 * sorts owned first per section, in `swapSections`).
 */
export type FinderQuery = {
	identity: IdentityFilters;
	facets: ReadonlySet<FacetKey>;
	ownershipView?: OwnershipView;
	roles?: RoleFilter;
};

export function splitRoster(
	roster: CharacterIndexEntry[],
	query: FinderQuery,
	conCapOf: (id: string) => number,
	ownershipOf: (id: string) => 'owned' | 'wishlist' | undefined = () => undefined
): RosterSplit {
	const { identity, facets, ownershipView = 'all', roles } = query;
	const matches: CharacterIndexEntry[] = [];
	const uncurated: CharacterIndexEntry[] = [];
	for (const entry of roster) {
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
	return { matches, uncurated };
}
