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

export function splitRoster(
	roster: CharacterIndexEntry[],
	identity: IdentityFilters,
	facets: ReadonlySet<FacetKey>,
	conCapOf: (id: string) => number,
	ownershipView: OwnershipView = 'all',
	ownershipOf: (id: string) => 'owned' | 'wishlist' | undefined = () => undefined,
	roleFilter?: RoleFilter
): RosterSplit {
	const matches: CharacterIndexEntry[] = [];
	const uncurated: CharacterIndexEntry[] = [];
	for (const entry of roster) {
		if (!matchesIdentity(entry, identity)) continue;
		if (ownershipView !== 'all' && ownershipOf(entry.id) !== ownershipView) continue;
		if (
			roleFilterActive(roleFilter) &&
			!matchesRoleFilter(roleFilter.rolesOf(entry.id), roleFilter)
		)
			continue;
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
