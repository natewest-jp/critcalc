/**
 * src/lib/types/character.ts
 *
 * Character type definitions for the rotation planner schema and transformer output.
 */

import type { Ability, Effect, Element } from './ability';
import type { WeaponType } from './weapon';

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

/** Star rarity for playable characters. */
export type Rarity = 4 | 5;

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

	abilities: Ability[];
	passives: Ability[];
	constellations: Ability[];
	/** Per-character contributions to faction bonuses (e.g. Hexerei: Secret Rite).
	 *  Distinct from passives because the trigger is team-conditional, not character-intrinsic.
	 *  Empty/absent on characters with no faction membership or no contributing effects. */
	factionBonuses?: FactionBonus[];

	meta?: CharacterMeta;
};

/** Lightweight index entry for a character — the scalar identity fields only,
 *  no abilities/passives/constellations. Backs the eager, synchronous index
 *  (`src/lib/data/characterIndex.generated.ts`) used by the selector,
 *  autocomplete, and slot resolution; full payloads load lazily on demand
 *  via `src/lib/data/characterData.ts`. */
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
>;

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
