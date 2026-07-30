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
import type { CapabilitySummary, FacetKey } from '$lib/capabilities/deriveCapabilities';
import { buffFamilyOf, capMatchesFacet } from '$lib/capabilities/deriveCapabilities';
import { matchesIdentity, type IdentityFilters } from '$lib/characterFilters';
import { matchesRoleFilter, roleFilterActive, type RoleFilter } from './roles';

export { buffFamilyOf, capMatchesFacet };
export type { BuffFamily, FacetKey } from '$lib/capabilities/deriveCapabilities';

// Identity filtering now lives in the shared `$lib/characterFilters` module
// (reused by the planner's character Source overlay + the CharacterGrid
// component). Re-exported here so existing team-builder imports keep working.
export { matchesIdentity };
export type { IdentityFilters };

// ---------------------------------------------------------------------------
// Constellation mode
// ---------------------------------------------------------------------------

/** Every fixed constellation step, plus the user's own roster levels — a
 *  fixed subset (C1/C2/C4) would encode a guess about which gates matter;
 *  the full stepper mirrors the DetailCard's C0–C6 stepper grammar. */
export type ConMode = 'mine' | 'c0' | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6';

/** The constellation cap a capability's gate must clear under the mode. */
export function conCapFor(mode: ConMode, myConstellation: number | undefined): number {
	if (mode === 'mine') return myConstellation ?? 0;
	return Number(mode.slice(1));
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

export const FACETS: { key: FacetKey; label: string; hint: string }[] = [
	{ key: 'heal', label: 'Heals', hint: 'Restores HP to someone' },
	{ key: 'shield', label: 'Shields', hint: 'Creates a damage-absorbing shield' },
	{
		key: 'interruptionRes',
		label: 'Interruption Res',
		hint: 'Grants resistance to interruption / knockback'
	},
	{
		key: 'offFieldDamage',
		label: 'Off-field DMG',
		hint: 'Coordinated attacks or damaging summons'
	},
	{ key: 'resShred', label: 'RES shred', hint: 'Lowers enemy elemental/physical RES' },
	{ key: 'cleanse', label: 'Cleanse', hint: 'Removes elemental auras from party members' },
	{ key: 'grouping', label: 'Grouping', hint: 'Pulls or gathers enemies' },
	{ key: 'buff:atk', label: 'ATK buff', hint: 'Buffs allies’ ATK' },
	{ key: 'buff:em', label: 'EM buff', hint: 'Buffs allies’ Elemental Mastery' },
	{ key: 'buff:crit', label: 'Crit buff', hint: 'Buffs allies’ Crit Rate / Crit DMG' },
	{ key: 'buff:dmg', label: 'DMG% buff', hint: 'Buffs allies’ damage bonuses' },
	{ key: 'buff:hpdef', label: 'HP/DEF buff', hint: 'Buffs allies’ HP or DEF' },
	{ key: 'infuse', label: 'Infusion', hint: 'Applies an elemental infusion to on-field attacks' },
	{ key: 'energy', label: 'Energy', hint: 'Grants flat energy' },
	{ key: 'taunt', label: 'Taunt', hint: 'Summons draw enemy aggro' }
];

// capMatchesFacet moved to $lib/capabilities/deriveCapabilities (shared with
// the capability sweep audit); re-exported above.

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
	cleanse: 'Cleanse',
	grouping: 'Group',
	taunt: 'Taunt',
	energy: 'Energy',
	infuse: 'Infuse',
	interruptionRes: 'Int-Res',
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

/** Roster-ledger view: everyone, only owned, or only wishlisted. */
export type OwnershipView = 'all' | 'owned' | 'wishlist';

/**
 * A character's capabilities are "unknown" only when NOTHING derives AND the
 * kit isn't frame-curated — a genuine stub where the absence of a capability
 * can't be trusted as real absence. This, NOT `curated`, is what the Team
 * Builder gates on: `curated` is purely a frame-timing marker, orthogonal to
 * capability derivation. The frameless stubs (illuga/kachina/… ) have complete
 * Stages-1-3 capability data, so they filter like anyone; a fully-curated
 * character with no caps is a definitive "no", not unknown.
 */
export function isCapabilityUnknown(e: CharacterIndexEntry): boolean {
	return e.caps.length === 0 && !e.curated;
}

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
