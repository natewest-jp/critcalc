/**
 * src/lib/timeline/weaponProcRows.ts
 *
 * Weapon proc ICD rows (Sacrificial-series E resets): maps the parser's
 * per-character proc bars to labeled sub-rows using the holder's equipped
 * weapon. Pure — extracted from RotationTimeline.svelte.
 */

import type { LoadoutEntry } from '$lib/stores';
import { getWeaponById } from '$lib/data/weaponLookup';
import type { WeaponProcSubrow } from './types';

export function computeWeaponProcRows(
	weaponProcBars: ReadonlyMap<string, Array<{ start: number; end: number }>>,
	loadoutMap: Record<string, LoadoutEntry>
): WeaponProcSubrow[] {
	const rows: WeaponProcSubrow[] = [];
	for (const [charId, bars] of weaponProcBars) {
		if (!bars.length) continue;
		const weaponId = loadoutMap[charId]?.weaponId;
		const weapon = weaponId ? getWeaponById(weaponId) : null;
		const label = weapon ? (weapon.shortName ?? weapon.name) : 'E reset';
		rows.push({ characterId: charId, label, bars });
	}
	return rows;
}
