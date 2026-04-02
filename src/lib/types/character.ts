/**
 * src/lib/types/character.ts
 *
 * Character type definitions for the rotation planner schema and transformer output.
 */

import type { Ability, Element } from './ability';
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

	abilities: Ability[];
	/** Always-on combat bonuses (A1/A4 passives with no E/Q cast trigger). Populated during curation. */
	permanentBonuses?: Ability[];
	passives: Ability[];
	constellations: Ability[];

	meta?: CharacterMeta;
};
