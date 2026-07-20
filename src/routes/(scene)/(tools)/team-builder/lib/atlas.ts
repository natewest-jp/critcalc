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

import type { CharacterIndexEntry } from '$lib/types/character';
import { FACETS, capMatchesFacet, type FacetKey } from './facets';

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
