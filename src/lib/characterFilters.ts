/**
 * characterFilters.ts
 *
 * Identity filtering over the eager character index — the vocabulary shared by
 * every roster surface (the Team Builder's Roster tab, the Rotation Planner's
 * character Source overlay, and the shared `CharacterGrid` component).
 *
 * "Identity" = the character's own fixed traits (element / weapon / rarity /
 * region / name), as opposed to the Team Builder's derived *capability* facets
 * (heal / shield / buff:atk / …), which stay in builder/lib/facets.ts.
 * The split keeps this module reusable by both tools; facets.ts re-exports these symbols so its existing consumers are unaffected.
 *
 * Group semantics: OR within a group, AND across groups — the same convention
 * the planner's selector and the Team Builder both already use.
 */

import type { CharacterIndexEntry } from '$lib/types/character';
import { m } from '$lib/paraglide/messages';
import { characterMatches, REGION_OTHER } from '$lib/i18n/gameNames';
import type { SvelteSet } from 'svelte/reactivity';

export type IdentityFilters = {
	elements: ReadonlySet<string>;
	weapons: ReadonlySet<string>;
	rarities: ReadonlySet<number>;
	region: string;
	search: string;
	/** Factions/Buffs group: 'moonsign' | 'hexerei' | 'stellar'. OR within the
	 *  group (like elements) — a character matching ANY selected key passes.
	 *  'stellar' means Stellar-linked: an enabler (`enablesReactions`) or a
	 *  carrier of Stellar-gated buffs (`gatedReactions`). Optional so
	 *  callers without the group (planner selector) are untouched. */
	factionBuffs?: ReadonlySet<string>;
};

/**
 * The MUTABLE form of the above: what a tool holds as $state, the filter strip
 * (<CharacterFilterStrip>) edits in place, and <CharacterGrid> reads through
 * `matchesIdentity`. The sets are SvelteSets so a toggle is reactive without
 * reassigning the object.
 *
 * It lives here rather than on either component because since the aside-column
 * round (2026-08-08) the two are SIBLINGS in a ToolColumns surface — the object
 * is the only thing they share, so it belongs to neither.
 */
/** Roster-ledger view: everyone, only owned, or only wishlisted. */
export type OwnershipView = 'all' | 'owned' | 'wishlist';

/** The Show segment's choices — the Builder's band B character cell, or
 *  More when the cell folds it. */
export const OWNERSHIP_VIEWS: { key: OwnershipView; label: string; hint: string }[] = [
	view('all', m.tb_all, m.tb_every_character),
	view('owned', m.tb_owned_b62f, m.tb_only_characters_you_ve_marked_as_owned),
	view('wishlist', m.tb_wishlist, m.tb_only_characters_you_ve_wishlisted)
];

/** A Show choice whose words are read at each use, so they follow the locale. */
function view(key: OwnershipView, label: () => string, hint: () => string) {
	return {
		key,
		get label() {
			return label();
		},
		get hint() {
			return hint();
		}
	};
}

export type GridFilters = {
	elements: SvelteSet<string>;
	weapons: SvelteSet<string>;
	rarities: SvelteSet<number>;
	region: string;
	search: string;
	/** The Team Builder's Factions/Buffs group. The shared identity chips don't
	 *  render it (the TB supplies those chips via railStart); it rides along so
	 *  `matchesIdentity` sees the same object both halves bind to. */
	factionBuffs?: SvelteSet<string>;
};

/** The region of a character from outside Teyvat (`$lib/i18n/gameNames`). */
export { REGION_OTHER };

/** The roster's region chips: the nations alphabetically, then "Other". */
export function regionChips(roster: readonly CharacterIndexEntry[]): string[] {
	const regions = [...new Set(roster.map((c) => c.region).filter(Boolean) as string[])];
	return regions.sort((a, b) =>
		a === REGION_OTHER ? 1 : b === REGION_OTHER ? -1 : a.localeCompare(b)
	);
}

/** True when the entry is Stellar-linked — enables a Stellar reaction or
 *  carries buffs gated on one being enabled. */
export function isStellarLinked(entry: CharacterIndexEntry): boolean {
	return (
		(entry.enablesReactions ?? []).some((r) => r.startsWith('stellar')) ||
		(entry.gatedReactions ?? []).some((r) => r.startsWith('stellar'))
	);
}

/** True when the entry passes every active identity filter (empty groups pass). */
export function matchesIdentity(entry: CharacterIndexEntry, f: IdentityFilters): boolean {
	const q = f.search.trim().toLowerCase();
	if (q && !characterMatches(entry, q)) return false;
	if (f.elements.size > 0 && !f.elements.has(entry.element ?? '')) return false;
	if (f.weapons.size > 0 && !f.weapons.has(entry.weapon ?? '')) return false;
	if (f.rarities.size > 0 && !f.rarities.has(entry.rarity)) return false;
	if (f.region && entry.region !== f.region) return false;
	if (f.factionBuffs && f.factionBuffs.size > 0) {
		const factions = entry.factions ?? [];
		const ok =
			(f.factionBuffs.has('moonsign') && factions.includes('moonsign')) ||
			(f.factionBuffs.has('hexerei') && factions.includes('hexerei')) ||
			(f.factionBuffs.has('stellar') && isStellarLinked(entry));
		if (!ok) return false;
	}
	return true;
}
