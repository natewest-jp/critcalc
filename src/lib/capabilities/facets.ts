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
 * `builder/lib/facets.ts` re-exports everything here, so the Team
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
import { labels } from '$lib/i18n/labels';
import { m } from '$lib/paraglide/messages';

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

/** A facet whose label and hint are read at each use, so they follow the locale. */
function facet(key: FacetKey, label: () => string, hint: () => string) {
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

// The `key`s are facet ids (filter state, URL params); only the label and hint are shown.
export const FACETS: { readonly key: FacetKey; readonly label: string; readonly hint: string }[] = [
	facet('heal', m.tb_healing, m.tb_restores_teammates_hp),
	facet('shield', m.tb_shield, m.tb_shields_the_active_character),
	facet('interruptionRes', m.tb_interruption_res, m.tb_makes_teammates_harder_to_interrupt),
	facet('offFieldDamage', m.tb_off_field_dmg, m.tb_coordinated_attacks_or_damaging_summons),
	facet('resShred', m.tb_res_shred, m.tb_lowers_enemy_elemental_physical_res),
	facet('cleanse', m.tb_cleanse, m.tb_removes_elemental_auras_from_party),
	facet('grouping', m.tb_grouping, m.tb_pulls_or_gathers_enemies),
	facet('buff:atk', m.tb_atk_buff, m.tb_buffs_allies_atk),
	facet('buff:em', m.tb_em_buff, m.tb_buffs_allies_elemental_mastery),
	facet('buff:crit', m.tb_crit_buff, m.tb_buffs_allies_crit_rate_crit_dmg),
	facet('buff:dmg', m.tb_dmg_buff, m.tb_buffs_allies_damage_bonuses),
	facet('buff:hpdef', m.tb_hp_def_buff, m.tb_buffs_allies_hp_or_def),
	facet('infuse', m.tb_infusion, m.tb_infuses_the_active_character_s_attacks),
	facet('energy', m.tb_energy, m.tb_gives_teammates_flat_energy_particles),
	facet('taunt', m.tb_taunt, m.tb_draws_opponents_attacks_away_from_you)
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

const BADGE_LABELS: Record<FacetKey, string> = labels({
	heal: m.tb_heal,
	shield: m.tb_shield,
	offFieldDamage: m.tb_off_field_cc62,
	resShred: m.tb_shred,
	cleanse: m.tb_cleanse,
	grouping: m.tb_group,
	taunt: m.tb_taunt,
	energy: m.tb_energy,
	infuse: m.tb_infuse,
	interruptionRes: m.tb_int_res,
	'buff:atk': m.tb_atk,
	'buff:em': m.tb_em,
	'buff:crit': m.tb_crit,
	'buff:dmg': m.tb_dmg,
	'buff:hpdef': m.tb_hp_def
});

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
