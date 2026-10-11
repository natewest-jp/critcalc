/**
 * team-builder/lib/atlas.ts
 *
 * The role Atlas — the Imaginarium Theater categories that open the Roster.
 * Computed purely over the EAGER character index (no full payload loads).
 *
 * ↻ 2026-10-07 (Team Builder round, phase 3): the Atlas is no longer a tab of
 * its own. Its four cards are the Roster's starting screen, picking one is the
 * Roster's role filter, and the drill-down it used to open is now the
 * Roster grid's SECTIONS. The per-slot "alternatives" view retired into the
 * audition, which asks the same question with the slot's own facets.
 */

import type {
	CharacterIndexEntry,
	CharacterRoles,
	RoleFunction,
	RolePosition
} from '$lib/types/character';
import { providesFacet } from '$lib/capabilities/deriveCapabilities';
import { FACETS, type FacetKey } from './facets';
import {
	FUNCTION_FACETS,
	inCategory,
	ROLE_CATEGORIES,
	type RoleCategory
} from '$lib/capabilities/roles';

type RolesOf = (id: string) => CharacterRoles | undefined;

/** Pip order for the per-card element row — the standard elemental wheel. */
export const ATLAS_ELEMENT_ORDER = [
	'pyro',
	'hydro',
	'electro',
	'cryo',
	'dendro',
	'anemo',
	'geo'
] as const;

// ---------------------------------------------------------------------------
// Role Atlas — the editorial Imaginarium Theater front door (roles.ts model).
// Role membership is editorial (not constellation-gated); capability drill-down
// rows still honor curation + the con cap, exactly like the capability cards.
// ---------------------------------------------------------------------------

const FACET_META = new Map(FACETS.map((f) => [f.key, f]));

/** Provider count per element for a set of members, nonzero only, wheel order. */
function elementBreakdown(
	members: CharacterIndexEntry[],
	ownedOf: (id: string) => boolean
): { byElement: { element: string; count: number }[]; ownedCount: number } {
	const perElement = new Map<string, number>();
	let ownedCount = 0;
	for (const e of members) {
		if (ownedOf(e.id)) ownedCount++;
		const el = e.element ?? 'none';
		perElement.set(el, (perElement.get(el) ?? 0) + 1);
	}
	const byElement = ATLAS_ELEMENT_ORDER.filter((el) => perElement.has(el)).map((el) => ({
		element: el,
		count: perElement.get(el)!
	}));
	return { byElement, ownedCount };
}

export type RoleCard = {
	category: RoleCategory;
	/** Characters Genshin classes in this Position×Function (editorial membership). */
	providerCount: number;
	ownedCount: number;
	byElement: { element: string; count: number }[];
};

/** One card per headline category, always all four (fixed front-door layout). */
export function buildRoleCards(
	roster: CharacterIndexEntry[],
	rolesOf: RolesOf,
	ownedOf: (id: string) => boolean
): RoleCard[] {
	return ROLE_CATEGORIES.map((category) => {
		const members = roster.filter((e) => inCategory(rolesOf(e.id), category));
		const { byElement, ownedCount } = elementBreakdown(members, ownedOf);
		return { category, providerCount: members.length, ownedCount, byElement };
	});
}

/** A drill-down row: a capability facet (Support/Survivability) or an element
 *  (DPS). Each carries the role-scoped characters it covers, shown as tiles
 *  inline (the RP-alternatives row pattern) — the Atlas is self-contained. */
export type DrillRow =
	| {
			kind: 'facet';
			key: string;
			facet: FacetKey;
			label: string;
			hint: string;
			entries: CharacterIndexEntry[];
	  }
	| { kind: 'element'; key: string; element: string; entries: CharacterIndexEntry[] };

/**
 * Role-scoped drill rows for a card. Support/Survivability → capability facet
 * rows (curated providers within the role, honoring the con cap); DPS → element
 * rows (all role members by element — on-field carries carry no facet). Roster
 * order is preserved, so entries stay sorted by displayName.
 */
export function buildDrillRows(
	category: RoleCategory,
	roster: CharacterIndexEntry[],
	rolesOf: RolesOf,
	conCapOf: (id: string) => number
): DrillRow[] {
	const members = roster.filter((e) => inCategory(rolesOf(e.id), category));

	if (category.function === 'dps') {
		const byElement = new Map<string, CharacterIndexEntry[]>();
		for (const e of members) {
			const el = e.element ?? 'none';
			const bucket = byElement.get(el);
			if (bucket) bucket.push(e);
			else byElement.set(el, [e]);
		}
		return ATLAS_ELEMENT_ORDER.filter((el) => byElement.has(el)).map((el) => ({
			kind: 'element',
			key: el,
			element: el,
			entries: byElement.get(el)!
		}));
	}

	const rows: DrillRow[] = [];
	for (const facet of FUNCTION_FACETS[category.function]) {
		const providers = members.filter((e) => providesFacet(e.caps, facet, conCapOf(e.id)));
		if (providers.length === 0) continue;
		const meta = FACET_META.get(facet);
		rows.push({
			kind: 'facet',
			key: facet,
			facet,
			label: meta?.label ?? facet,
			hint: meta?.hint ?? '',
			entries: providers
		});
	}
	return rows;
}

/**
 * The role a pair of role-filter sets IS, when it is exactly one of the four
 * cards — the Roster draws that card as selected and groups its grid into the
 * card's sections. Any other combination (two functions, a position on a
 * function-only card) is just a filter, and draws flat.
 */
export function categoryOf(
	position: ReadonlySet<RolePosition>,
	fn: ReadonlySet<RoleFunction>
): RoleCategory | null {
	if (fn.size !== 1) return null;
	const [only] = fn;
	return (
		ROLE_CATEGORIES.find(
			(c) =>
				c.function === only &&
				(c.position ? position.size === 1 && position.has(c.position) : position.size === 0)
		) ?? null
	);
}

/** One heading's worth of the Roster grid under an active role. */
export type RoleSection = {
	key: string;
	label: string;
	/** An element icon heads a DPS section; a facet section has none. */
	element?: string;
	entries: CharacterIndexEntry[];
};

/**
 * The Roster's sections under a role card — the old drill-down, over whatever
 * the Roster's OTHER filters let through (so search, element and "Owned" still
 * narrow inside each section). Support/Survivability group by the facets under
 * the function; DPS by element.
 *
 * ⚠ A facet section only holds PROVIDERS of that facet, so a role member who
 * provides none of the listed facets would vanish from a grid that claims to
 * show the role. They get a last section of their own rather than silently
 * dropping out — the drill had the same hole, unseen because it never had a
 * count to disagree with.
 */
export function buildRoleSections(
	category: RoleCategory,
	entries: CharacterIndexEntry[],
	rolesOf: RolesOf,
	conCapOf: (id: string) => number
): RoleSection[] {
	const rows = buildDrillRows(category, entries, rolesOf, conCapOf);
	const sections: RoleSection[] = rows.map((r) =>
		r.kind === 'element'
			? { key: r.key, label: r.element, element: r.element, entries: r.entries }
			: { key: r.key, label: r.label, entries: r.entries }
	);
	if (category.function === 'dps') return sections;
	const placed = new Set(sections.flatMap((s) => s.entries.map((e) => e.id)));
	const rest = entries.filter((e) => inCategory(rolesOf(e.id), category) && !placed.has(e.id));
	if (rest.length > 0) sections.push({ key: 'rest', label: 'Also in this role', entries: rest });
	return sections;
}

export { FUNCTION_FACETS };
export type { FacetKey };
