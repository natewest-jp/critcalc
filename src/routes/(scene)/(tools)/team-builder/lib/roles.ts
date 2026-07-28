/**
 * team-builder/lib/roles.ts
 *
 * Editorial Imaginarium Theater role model for the Team Builder Atlas. Roles
 * (Position + Function) are the coarse, cited, icon'd layer that sits ON TOP of
 * the derived capability facets — presence tags, cited to Genshin, NEVER ranked
 * or scored. Sourced from src/lib/data/characterRoles.generated.ts and joined
 * into the roster by id (see +page.svelte `rolesOf`).
 *
 * The four headline Position×Function categories are the Atlas front door. DPS
 * drills by element (on-field carries provide no team-utility capability, so
 * there's no facet list for them); Support/Survivability drill by the capability
 * facets grouped under them (design-doc facet→function grouping).
 *
 * No imports from facets.ts (FUNCTION_FACETS now lives in
 * $lib/capabilities/deriveCapabilities and is re-exported here), so facets.ts
 * can depend on this module for role filtering without a cycle.
 */

import type { CharacterRoles, RoleFunction, RolePosition } from '$lib/types/character';

export { FUNCTION_FACETS } from '$lib/capabilities/deriveCapabilities';

export type RoleCategory = {
	/** Stable id for state + {#each} keys. */
	key: string;
	/** Absent = a function-only card that matches any position. */
	position?: RolePosition;
	function: RoleFunction;
	label: string;
};

/** The four headline cards, in display order. DPS splits by position (On-Field /
 *  Off-Field) because that distinction is load-bearing for carries; Support and
 *  Survivability are position-agnostic, which also covers every character (all
 *  have ≥1 function) — the on-field non-DPS case (Ifa) lands in Support +
 *  Survivability, so there is no "unclassified" bucket to surface. */
export const ROLE_CATEGORIES: RoleCategory[] = [
	{ key: 'onField-dps', position: 'onField', function: 'dps', label: 'On-Field DPS' },
	{ key: 'offField-dps', position: 'offField', function: 'dps', label: 'Off-Field DPS' },
	{ key: 'support', function: 'support', label: 'Support' },
	{ key: 'survivability', function: 'survivability', label: 'Survivability' }
];

// FUNCTION_FACETS (facets grouped under each function) moved to
// $lib/capabilities/deriveCapabilities — shared with the capability sweep
// audit so the role→facet grouping can't drift; re-exported above.

/** True when the character's roles satisfy this category — its function, plus
 *  the category's position when the card is position-scoped (DPS). */
export function inCategory(roles: CharacterRoles | undefined, cat: RoleCategory): boolean {
	if (!roles) return false;
	if (cat.position && !roles.position.includes(cat.position)) return false;
	return roles.function.includes(cat.function);
}

/** Role filter applied by splitRoster on the Roster tab. Position/Function are
 *  ORed within each group and ANDed across the two groups. */
export type RoleFilter = {
	position: ReadonlySet<RolePosition>;
	function: ReadonlySet<RoleFunction>;
	rolesOf: (id: string) => CharacterRoles | undefined;
};

/** Whether a role filter would actually narrow anything. */
export function roleFilterActive(f: RoleFilter | undefined): f is RoleFilter {
	return !!f && (f.position.size > 0 || f.function.size > 0);
}

/** Does a character's roles pass the role filter? */
export function matchesRoleFilter(roles: CharacterRoles | undefined, f: RoleFilter): boolean {
	if (f.position.size > 0) {
		if (!roles || ![...f.position].some((p) => roles.position.includes(p))) return false;
	}
	if (f.function.size > 0) {
		if (!roles || ![...f.function].some((fn) => roles.function.includes(fn))) return false;
	}
	return true;
}
