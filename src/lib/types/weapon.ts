/**
 * src/lib/types/weapon.ts
 *
 * Weapon schema types derived from the gold-standard transformer model.
 */

import type { Effect } from './ability';

// ---------------------------------------------------------------------------
// Weapon enums
// ---------------------------------------------------------------------------

/** Weapon type keys used by the transformer output (lowercase). */
export type WeaponType = 'sword' | 'bow' | 'polearm' | 'claymore' | 'catalyst';

/** Rarity values for weapons. */
export type WeaponRarity = 3 | 4 | 5;

// ---------------------------------------------------------------------------
// Weapon data
// ---------------------------------------------------------------------------

/** Weapon passive data container. */
export type WeaponPassive = {
	name: string;
	shortName?: string;
	description?: string;
	effects: Effect[];
};

/** Full weapon definition with passive effects. */
export type Weapon = {
	id: string;
	name: string;
	shortName?: string;
	type: WeaponType;
	rarity: WeaponRarity;
	passive: WeaponPassive;
};
