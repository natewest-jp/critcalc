/**
 * src/lib/timeline/weaponProcRows.ts
 *
 * Weapon proc ICD rows (Sacrificial-series E resets): maps the parser's
 * per-character proc bars to labeled sub-rows using the holder's equipped
 * weapon. Pure — extracted from RotationTimeline.svelte.
 */

import type { LoadoutEntry } from '$lib/stores';
import type { TimelineWindow } from '$lib/utils/rotationEvents';
import { getWeaponById } from '$lib/data/weaponLookup';
import type { WeaponProcSubrow } from './types';

/**
 * Groups the parser's `weaponProc` IR windows into per-character labeled
 * sub-rows using the holder's equipped weapon. Preserves per-character window
 * order (windows arrive sorted by start); characters with no proc window are
 * skipped.
 */
export function computeWeaponProcRows(
	windows: ReadonlyArray<TimelineWindow>,
	loadoutMap: Record<string, LoadoutEntry>
): WeaponProcSubrow[] {
	const barsByChar = new Map<string, Array<{ start: number; end: number }>>();
	for (const w of windows) {
		if (w.kind !== 'weaponProc') continue;
		let bars = barsByChar.get(w.characterId);
		if (!bars) {
			bars = [];
			barsByChar.set(w.characterId, bars);
		}
		bars.push({ start: w.start, end: w.end });
	}

	const rows: WeaponProcSubrow[] = [];
	for (const [charId, bars] of barsByChar) {
		const weaponId = loadoutMap[charId]?.weaponId;
		const weapon = weaponId ? getWeaponById(weaponId) : null;
		// Full weapon name (shortName retired for display 2026-07-31 — the JSONs
		// keep the field for future use; truncating bars fade instead of slicing).
		const label = weapon ? weapon.name : 'E reset';
		rows.push({ characterId: charId, label, bars });
	}
	return rows;
}
