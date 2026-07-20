/**
 * characterFilters.ts
 *
 * Identity filtering over the eager character index — the vocabulary shared by
 * every roster surface (the Team Builder's Roster tab, the Rotation Planner's
 * character Source overlay, and the shared `CharacterGrid` component).
 *
 * "Identity" = the character's own fixed traits (element / weapon / rarity /
 * region / name), as opposed to the Team Builder's derived *capability* facets
 * (heal / shield / buff:atk / …), which stay in team-builder/lib/facets.ts.
 * The split keeps this module runtime-import-free and reusable by both tools;
 * facets.ts re-exports these symbols so its existing consumers are unaffected.
 *
 * Group semantics: OR within a group, AND across groups — the same convention
 * the planner's selector and the Team Builder both already use.
 */

import type { CharacterIndexEntry } from '$lib/types/character';

export type IdentityFilters = {
	elements: ReadonlySet<string>;
	weapons: ReadonlySet<string>;
	rarities: ReadonlySet<number>;
	region: string;
	search: string;
};

/** True when the entry passes every active identity filter (empty groups pass). */
export function matchesIdentity(entry: CharacterIndexEntry, f: IdentityFilters): boolean {
	const q = f.search.trim().toLowerCase();
	if (q && !entry.displayName.toLowerCase().includes(q)) return false;
	if (f.elements.size > 0 && !f.elements.has(entry.element ?? '')) return false;
	if (f.weapons.size > 0 && !f.weapons.has(entry.weapon ?? '')) return false;
	if (f.rarities.size > 0 && !f.rarities.has(entry.rarity)) return false;
	if (f.region && entry.region !== f.region) return false;
	return true;
}
