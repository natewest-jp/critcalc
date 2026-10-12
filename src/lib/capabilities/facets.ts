/**
 * capabilities/facets.ts
 *
 * The capability-facet vocabulary, shared by every roster surface: the Team
 * Builder's filter rail and the Rotation Planner's character picker both ask
 * "who can heal / shield / buff ATK, at which constellation?" — so the facet
 * list, the constellation-mode model and the matching rules live here rather
 * than inside either tool.
 *
 * This is the capability counterpart to `$lib/characterFilters` (identity:
 * element / weapon / rarity / region / name). Same split, same reason: keep the
 * module runtime-import-free so Node scripts and both tools can read it.
 * `team-builder/lib/facets.ts` re-exports everything here, so the Team
 * Builder's own imports are unaffected.
 *
 * Semantics:
 * - Capability facets AND with each other: "heal + buff:atk" means Bennett, not
 *   "anyone who does either". Team-building questions compose that way.
 * - A capability satisfies a facet only when its constellation gate clears the
 *   active cap (see ConMode / conCapFor).
 */

import type { CapabilitySummary, FacetKey } from '$lib/capabilities/deriveCapabilities';
import { capMatchesFacet, providesFacet } from '$lib/capabilities/deriveCapabilities';
import type { CharacterIndexEntry } from '$lib/types/character';

// ---------------------------------------------------------------------------
// Constellation mode
// ---------------------------------------------------------------------------

/** Every fixed constellation step, plus the user's own roster levels — a fixed
 *  subset (C1/C2/C4) would encode a guess about which gates matter; the full
 *  stepper mirrors the DetailCard's C0–C6 stepper grammar. */
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
	{ key: 'heal', label: 'Healing', hint: 'Restores teammates’ HP.' },
	{ key: 'shield', label: 'Shield', hint: 'Shields the active character.' },
	{
		key: 'interruptionRes',
		label: 'Interruption Res',
		hint: 'Makes teammates harder to interrupt.'
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
	{ key: 'buff:crit', label: 'CRIT buff', hint: 'Buffs allies’ Crit Rate / Crit DMG' },
	{ key: 'buff:dmg', label: 'DMG% buff', hint: 'Buffs allies’ damage bonuses' },
	{ key: 'buff:hpdef', label: 'HP/DEF buff', hint: 'Buffs allies’ HP or DEF' },
	{
		key: 'infuse',
		label: 'Infusion',
		hint: 'Infuses the active character’s attacks with an element.'
	},
	{
		key: 'energy',
		label: 'Energy',
		hint: 'Gives teammates flat Energy (particles aren’t counted).'
	},
	{ key: 'taunt', label: 'Taunt', hint: 'Draws opponents’ attacks away from you.' }
];

/**
 * A character's capabilities are "unknown" only when NOTHING derives AND the
 * kit isn't frame-curated — a genuine stub where the absence of a capability
 * can't be trusted as real absence. This, NOT `curated`, is what a capability
 * filter must gate on: `curated` is purely a frame-timing marker, orthogonal to
 * capability derivation. The frameless stubs (illuga/kachina/…) have complete
 * Stages-1-3 capability data, so they filter like anyone; a fully-curated
 * character with no caps is a definitive "no", not unknown.
 *
 * Neither tool may silently drop these: the Team Builder buckets them under
 * "not yet curated", the planner's picker simply lets them through.
 */
export function isCapabilityUnknown(e: CharacterIndexEntry): boolean {
	return e.caps.length === 0 && !e.curated;
}

/** True when every selected facet is satisfied by some capability whose
 *  constellation gate clears `conCap`. */
export function matchesFacets(
	caps: CapabilitySummary[],
	facets: ReadonlySet<FacetKey>,
	conCap: number
): boolean {
	for (const facet of facets) {
		if (!providesFacet(caps, facet, conCap)) return false;
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
