/**
 * src/lib/types/character.ts
 *
 * Character type definitions for the rotation planner schema and transformer output.
 */

import type { Ability, Effect, Element } from './ability';
import type { WeaponType } from './weapon';
import type { CapabilitySummary } from '../capabilities/deriveCapabilities';

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

/** Star rarity for playable characters. */
export type Rarity = 4 | 5;

// ---------------------------------------------------------------------------
// Editorial roles (Imaginarium Theater)
// ---------------------------------------------------------------------------

/** Field position — a set (Mavuika is both). */
export type RolePosition = 'onField' | 'offField';
/** Functional role — multi-valued (Furina is all three). */
export type RoleFunction = 'dps' | 'support' | 'survivability';

/** A character's editorial roles, imported from Genshin's Imaginarium Theater
 *  classification (docs/library/game/genshin-character-roles.csv). Presence
 *  tags, cited to Genshin, NEVER ranked or scored — "dps" means "Genshin
 *  classes this a DPS". Editorial (hand-sourced), so it lives OUTSIDE the
 *  derive-only capabilities layer; the Team Builder joins it by id. */
export type CharacterRoles = { position: RolePosition[]; function: RoleFunction[] };

// ---------------------------------------------------------------------------
// Transformer character schema
// ---------------------------------------------------------------------------

/** Metadata attached to generated character data. */
export type CharacterMeta = {
	source: 'genshin-db';
	generatedAt: string;
};

/** Canonical character data model — the shape of committed character JSONs. */
export type CharacterData = {
	id: string;
	name: string;
	displayName: string;
	element?: Element;
	weapon?: WeaponType;
	gender?: string;
	affiliation?: string;
	region?: string;
	rarity: Rarity;
	/** Gameplay-mechanic faction memberships. Known values: "moonsign", "hexerei". Distinct from lore affiliation. */
	factions?: string[];
	/** Extra contribution this character makes to a faction's *level*, beyond the
	 *  implicit +1 from membership (`factions`). Party faction level = members + Σ
	 *  contributions; `teamFaction {faction, min}` gates on that sum. Use for
	 *  benedictions that raise a party level by more than the holder's own
	 *  presence (e.g. a Moonsign benediction that adds an extra level, or a
	 *  non-member that still contributes). Most faction chars need only
	 *  `factions` — leave this unset. Forward-looking for 7.x faction mechanics. */
	factionContributions?: Record<string, number>;

	abilities: Ability[];
	passives: Ability[];
	constellations: Ability[];
	/** Per-character contributions to faction bonuses (e.g. Hexerei: Secret Rite).
	 *  Distinct from passives because the trigger is team-conditional, not character-intrinsic.
	 *  Empty/absent on characters with no faction membership or no contributing effects. */
	factionBonuses?: FactionBonus[];

	meta?: CharacterMeta;
};

/** Lightweight index entry for a character — the scalar identity fields plus
 *  derived capability summaries; no abilities/passives/constellations. Backs
 *  the eager, synchronous index (`src/lib/data/characterIndex.generated.ts`)
 *  used by the selector, autocomplete, slot resolution, and the Team Builder's
 *  capability facets; full payloads load lazily on demand via
 *  `src/lib/data/characterData.ts`. */
export type CharacterIndexEntry = Pick<
	CharacterData,
	| 'id'
	| 'name'
	| 'displayName'
	| 'element'
	| 'weapon'
	| 'gender'
	| 'affiliation'
	| 'region'
	| 'rarity'
	| 'factions'
> & {
	/** Frame-level curation (characterLint.isCurated). The Team Builder's trust
	 *  signal: when false, an absent capability means "not yet curated", NOT
	 *  "doesn't have it" — uncurated characters must never be silently filtered
	 *  out by capability facets. */
	curated: boolean;
	/** Derived capability summaries (deriveCapabilities.summarizeCapabilities),
	 *  computed at index-generation time from the character JSON. */
	caps: CapabilitySummary[];
};

/** A single character's contribution to a team-wide faction bonus.
 *  The buff fires when the faction-membership condition is met (e.g.
 *  ≥2 Hexerei in team) AND the per-effect trigger fires. Encoded as
 *  effects with a `teamFaction` condition; consumers walk these via
 *  the same effect helpers used for ability/passive/constellation effects. */
export type FactionBonus = {
	/** Faction key — must match a value in `CharacterData.factions`. */
	faction: string;
	/** Display name shown in the team bonuses panel (e.g. "Secret Rite"). */
	name: string;
	description?: string;
	effects: Effect[];
};
