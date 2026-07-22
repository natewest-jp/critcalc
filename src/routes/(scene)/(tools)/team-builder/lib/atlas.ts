/**
 * team-builder/lib/atlas.ts
 *
 * The Atlas: the Team Builder's question-indexed front door. One card per
 * capability facet — "who can provide this, how many do I own, at which
 * elements" — computed purely over the EAGER character index (no full payload
 * loads; same cost profile as the roster split).
 *
 * A card exists only when at least one curated provider clears the active
 * constellation cap. Element pips let the browser scope a capability to an
 * element ("off-field PYRO DMG") without a separate card per element×facet.
 */

import type { CharacterIndexEntry, CharacterRoles } from '$lib/types/character';
import { FACETS, capMatchesFacet, type FacetKey } from './facets';
import { FUNCTION_FACETS, inCategory, ROLE_CATEGORIES, type RoleCategory } from './roles';

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

export type AtlasCard = {
	facet: FacetKey;
	label: string;
	hint: string;
	/** Curated characters providing this capability at the active con cap. */
	providerCount: number;
	/** Of the providers, how many the user owns (ownership ledger). */
	ownedCount: number;
	/** Provider count per element, nonzero only, in wheel order. */
	byElement: { element: string; count: number }[];
};

/**
 * @param roster    eager index entries (CharacterIndexEntry.caps drives this)
 * @param conCapOf  the constellation cap to clear for a character (mode-aware)
 * @param ownedOf   whether the user owns a character (ownership ledger)
 */
export function buildAtlasCards(
	roster: CharacterIndexEntry[],
	conCapOf: (id: string) => number,
	ownedOf: (id: string) => boolean
): AtlasCard[] {
	const cards: AtlasCard[] = [];
	for (const { key, label, hint } of FACETS) {
		const providers = roster.filter(
			(e) => e.curated && e.caps.some((c) => capMatchesFacet(c, key) && c.minCon <= conCapOf(e.id))
		);
		if (providers.length === 0) continue;

		const perElement = new Map<string, number>();
		let ownedCount = 0;
		for (const e of providers) {
			if (ownedOf(e.id)) ownedCount++;
			const el = e.element ?? 'none';
			perElement.set(el, (perElement.get(el) ?? 0) + 1);
		}
		const byElement = ATLAS_ELEMENT_ORDER.filter((el) => perElement.has(el)).map((el) => ({
			element: el,
			count: perElement.get(el)!
		}));

		cards.push({ facet: key, label, hint, providerCount: providers.length, ownedCount, byElement });
	}
	return cards;
}

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
		const providers = members.filter(
			(e) =>
				e.curated && e.caps.some((c) => capMatchesFacet(c, facet) && c.minCon <= conCapOf(e.id))
		);
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

export type SlotAltRow = {
	/** The imported team character this row offers alternatives to. */
	slotEntry: CharacterIndexEntry;
	slotRoles: CharacterRoles | undefined;
	/** Same-element characters sharing a Position and ≥1 Function, minus the slot. */
	alternatives: CharacterIndexEntry[];
};

/**
 * Rotation-Planner arrival (?team=): one "alternatives" row per filled slot —
 * characters matching the slot's Element + Position(overlap) + any-Function
 * (overlap), excluding the slot's own character. Duplicate/empty slots skipped.
 */
export function buildSlotAlternativeRows(
	teamSlots: (string | null)[],
	roster: CharacterIndexEntry[],
	rolesOf: RolesOf
): SlotAltRow[] {
	const byId = new Map(roster.map((e) => [e.id, e]));
	const seen = new Set<string>();
	const rows: SlotAltRow[] = [];
	for (const id of teamSlots) {
		if (!id || seen.has(id)) continue;
		seen.add(id);
		const slotEntry = byId.get(id);
		if (!slotEntry) continue;
		const slotRoles = rolesOf(id);
		const alternatives = roster.filter((e) => {
			if (e.id === id) return false;
			if ((e.element ?? null) !== (slotEntry.element ?? null)) return false;
			const r = rolesOf(e.id);
			if (!r || !slotRoles) return false;
			if (!r.position.some((p) => slotRoles.position.includes(p))) return false;
			if (!r.function.some((f) => slotRoles.function.includes(f))) return false;
			return true;
		});
		rows.push({ slotEntry, slotRoles, alternatives });
	}
	return rows;
}
