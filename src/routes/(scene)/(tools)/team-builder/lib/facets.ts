/**
 * team-builder/lib/facets.ts
 *
 * Capability facet model for the Team Builder's roster filter. Pure functions
 * over the eager character index (CharacterIndexEntry.caps — derived at
 * build time by deriveCapabilities).
 *
 * Facet semantics:
 * - Identity facets (element/weapon/rarity/region) OR within a group, AND
 *   across groups — same convention as the planner's character selector.
 * - Capability facets AND with each other: "heal + buff:atk" means Bennett,
 *   not "anyone who does either". Team-building questions compose that way.
 * - A capability satisfies a facet only when its constellation gate clears
 *   the active cap (ConMode: C0 / the user's roster constellations / C6).
 * - Uncurated characters are NEVER silently excluded by capability facets —
 *   the page collects them into a visible "not yet curated" bucket instead.
 *   Their partial capability scraps (e.g. Charlotte's C1 heal from an
 *   otherwise-stub kit) must not lend them false authority in the main grid.
 */

import type { CharacterIndexEntry } from '$lib/types/character';
import type { CapabilitySummary } from '$lib/capabilities/deriveCapabilities';
import { buffFamilyOf } from '$lib/capabilities/deriveCapabilities';

export { buffFamilyOf };
export type { BuffFamily } from '$lib/capabilities/deriveCapabilities';

// ---------------------------------------------------------------------------
// Constellation mode
// ---------------------------------------------------------------------------

export type ConMode = 'c0' | 'mine' | 'max';

/** The constellation cap a capability's gate must clear under the mode. */
export function conCapFor(mode: ConMode, myConstellation: number | undefined): number {
	if (mode === 'c0') return 0;
	if (mode === 'max') return 6;
	return myConstellation ?? 0;
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

export type FacetKey =
	| 'heal'
	| 'shield'
	| 'offFieldDamage'
	| 'resShred'
	| 'taunt'
	| 'energy'
	| 'buff:atk'
	| 'buff:em'
	| 'buff:crit'
	| 'buff:dmg'
	| 'buff:hpdef';

export const FACETS: { key: FacetKey; label: string; hint: string }[] = [
	{ key: 'heal', label: 'Heals', hint: 'Restores HP to someone' },
	{ key: 'shield', label: 'Shields', hint: 'Creates a damage-absorbing shield' },
	{ key: 'offFieldDamage', label: 'Off-field DMG', hint: 'Coordinated attacks or damaging summons' },
	{ key: 'resShred', label: 'RES shred', hint: 'Lowers enemy elemental/physical RES' },
	{ key: 'buff:atk', label: 'ATK buff', hint: 'Buffs allies’ ATK' },
	{ key: 'buff:em', label: 'EM buff', hint: 'Buffs allies’ Elemental Mastery' },
	{ key: 'buff:crit', label: 'Crit buff', hint: 'Buffs allies’ Crit Rate / Crit DMG' },
	{ key: 'buff:dmg', label: 'DMG% buff', hint: 'Buffs allies’ damage bonuses' },
	{ key: 'buff:hpdef', label: 'HP/DEF buff', hint: 'Buffs allies’ HP or DEF' },
	{ key: 'energy', label: 'Energy', hint: 'Grants flat energy' },
	{ key: 'taunt', label: 'Taunt', hint: 'Summons draw enemy aggro' }
];

/** Buff facets count only ally-facing buffs — a self-only Crit buff doesn't
 *  answer "who can buff my team's Crit". Tag-derived entries (no target) and
 *  non-buff kinds pass through; heals/shields are team-relevant even when
 *  self-targeted only in edge kits, and the badge shows the target anyway. */
export function capMatchesFacet(cap: CapabilitySummary, facet: FacetKey): boolean {
	if (facet.startsWith('buff:')) {
		if (cap.kind !== 'buff' || !cap.detail) return false;
		if (cap.target === 'self') return false;
		return `buff:${buffFamilyOf(cap.detail)}` === facet;
	}
	if (facet === 'energy') return cap.kind === 'energy' && cap.target !== 'self';
	return cap.kind === facet;
}

/** True when every selected facet is satisfied by some capability whose
 *  constellation gate clears `conCap`. */
export function matchesFacets(
	caps: CapabilitySummary[],
	facets: ReadonlySet<FacetKey>,
	conCap: number
): boolean {
	for (const facet of facets) {
		if (!caps.some((c) => capMatchesFacet(c, facet) && c.minCon <= conCap)) return false;
	}
	return true;
}

// ---------------------------------------------------------------------------
// Tile badges — caps folded into facet space for compact display
// ---------------------------------------------------------------------------

export type Badge = {
	facet: FacetKey;
	label: string;
	/** Lowest gate among the capabilities backing this badge. */
	minCon: number;
	/** True when every backing capability at minCon is runtime-conditional. */
	conditional: boolean;
};

const BADGE_LABELS: Record<FacetKey, string> = {
	heal: 'Heal',
	shield: 'Shield',
	offFieldDamage: 'Off-field',
	resShred: 'Shred',
	taunt: 'Taunt',
	energy: 'Energy',
	'buff:atk': 'ATK+',
	'buff:em': 'EM+',
	'buff:crit': 'CRIT+',
	'buff:dmg': 'DMG+',
	'buff:hpdef': 'HP/DEF+'
};

/** Folds capability summaries into per-facet badges, FACETS order. */
export function facetBadges(caps: CapabilitySummary[]): Badge[] {
	const badges = new Map<FacetKey, Badge>();
	for (const { key } of FACETS) {
		for (const cap of caps) {
			if (!capMatchesFacet(cap, key)) continue;
			const existing = badges.get(key);
			if (!existing) {
				badges.set(key, {
					facet: key,
					label: BADGE_LABELS[key],
					minCon: cap.minCon,
					conditional: cap.conditional
				});
			} else if (cap.minCon < existing.minCon) {
				existing.minCon = cap.minCon;
				existing.conditional = cap.conditional;
			} else if (cap.minCon === existing.minCon) {
				existing.conditional = existing.conditional && cap.conditional;
			}
		}
	}
	return [...badges.values()];
}

// ---------------------------------------------------------------------------
// Roster filtering
// ---------------------------------------------------------------------------

export type IdentityFilters = {
	elements: ReadonlySet<string>;
	weapons: ReadonlySet<string>;
	rarities: ReadonlySet<number>;
	region: string;
	search: string;
};

export function matchesIdentity(entry: CharacterIndexEntry, f: IdentityFilters): boolean {
	const q = f.search.trim().toLowerCase();
	if (q && !entry.displayName.toLowerCase().includes(q)) return false;
	if (f.elements.size > 0 && !f.elements.has(entry.element ?? '')) return false;
	if (f.weapons.size > 0 && !f.weapons.has(entry.weapon ?? '')) return false;
	if (f.rarities.size > 0 && !f.rarities.has(entry.rarity)) return false;
	if (f.region && entry.region !== f.region) return false;
	return true;
}

export type RosterSplit = {
	/** Curated characters passing every active filter. */
	matches: CharacterIndexEntry[];
	/** Uncurated characters passing identity filters while capability facets
	 *  are active — shown separately, never silently dropped. Empty when no
	 *  capability facet is selected (stubs then sit in `matches` like anyone). */
	uncurated: CharacterIndexEntry[];
};

export function splitRoster(
	roster: CharacterIndexEntry[],
	identity: IdentityFilters,
	facets: ReadonlySet<FacetKey>,
	conCapOf: (id: string) => number
): RosterSplit {
	const matches: CharacterIndexEntry[] = [];
	const uncurated: CharacterIndexEntry[] = [];
	for (const entry of roster) {
		if (!matchesIdentity(entry, identity)) continue;
		if (facets.size === 0) {
			matches.push(entry);
		} else if (!entry.curated) {
			uncurated.push(entry);
		} else if (matchesFacets(entry.caps, facets, conCapOf(entry.id))) {
			matches.push(entry);
		}
	}
	return { matches, uncurated };
}
