/**
 * src/lib/utils/loadoutIcons.ts
 *
 * The icons an EMPTY loadout slot wears. A set artifact/weapon shows its own
 * art; an unset one shows generic art dimmed, so the slot still reads as a
 * thing you click rather than as a hole. Shared by the loadout pill on
 * SlotPortrait and the "none" tiles inside LoadoutPanel, which must match.
 */

/** The generic artifact flower — stands in for "no set equipped". */
export const GENERIC_ARTIFACT_ICON = '/assets/artifacts/generic-full-set/flower.webp';

/** The weapon types with a silhouette icon on disk (static/assets/weapon-types). */
const WEAPON_TYPES = new Set(['bow', 'catalyst', 'claymore', 'polearm', 'sword']);

/** Stand-in when there is no weapon type to draw: the generic `blank` character
 *  (which may equip anything) and empty slots. Sword is the generic silhouette
 *  — it reads as "a weapon" rather than as a claim about which one. */
const DEFAULT_WEAPON_TYPE = 'sword';

/**
 * The silhouette for a character's weapon type — what an unequipped weapon slot
 * shows. Falls back to the sword for anything without a type, so the slot always
 * renders a real icon and never a placeholder box.
 */
export function weaponTypeIcon(weaponType: string | undefined): string {
	const type = weaponType && WEAPON_TYPES.has(weaponType) ? weaponType : DEFAULT_WEAPON_TYPE;
	return `/assets/weapon-types/${type}.webp`;
}
