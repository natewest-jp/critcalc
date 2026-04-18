/**
 * src/lib/data/weaponLookup.ts
 *
 * Eager-loaded weapon lookup from the curated JSONs.
 * Returns empty arrays / null until JSON files exist.
 */

import type { Weapon } from '$lib/types/weapon';
import type { WeaponType } from '$lib/types/weapon';

const modules = import.meta.glob('./weapons/*.json', { eager: true });

const _all: Weapon[] = (Object.values(modules) as { default: Weapon }[])
	.map((m) => m.default)
	.filter(Boolean)
	.sort((a, b) => a.name.localeCompare(b.name));

export function getAllWeapons(): Weapon[] {
	return _all;
}

export function getWeaponById(id: string): Weapon | null {
	return _all.find((w) => w.id === id) ?? null;
}

export function getWeaponsByType(type: WeaponType): Weapon[] {
	return _all.filter((w) => w.type === type);
}
