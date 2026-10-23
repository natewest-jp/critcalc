/**
 * Whether the new storage can be used in this tab — the switch's second
 * condition (`nextLayout.ts`). Its own module, importing none of ours, because
 * `stores.ts` must ask the same question and `nextLayout` imports `stores`.
 */

import { browser } from '$app/environment';

/** Set for this tab when the new storage failed to OPEN (see `storageFailed`). */
const NO_STORE_KEY = 'critcalc:noStore';

/**
 * ⚓ No IndexedDB, no new layout (Nate 2026-10-23, until the localStorage
 * stand-in of step 5): the profiles and documents live there, so without it
 * the new layout shows an empty roster and an empty Library over data that is
 * still in localStorage. Most refusals are visible at once (`indexedDB`
 * missing, or throwing on access); a store that fails only when opened is
 * remembered for the tab by `storageFailed`. ⚠ This decides what the switch
 * DOES, never what was asked: the tester's `?next` stays stored.
 */
export function storageUsable(): boolean {
	if (!browser) return false;
	try {
		if (!globalThis.indexedDB) return false;
	} catch {
		return false;
	}
	try {
		return sessionStorage.getItem(NO_STORE_KEY) !== '1';
	} catch {
		return true;
	}
}

/** The new storage would not open on this page: drop to the old layout for
 *  this tab. A reload, because every layout read the switch at its own init. */
export function storageFailed(): void {
	if (!browser) return;
	try {
		if (sessionStorage.getItem(NO_STORE_KEY) === '1') return;
		sessionStorage.setItem(NO_STORE_KEY, '1');
	} catch {
		return; // nowhere to remember it: a reload would loop
	}
	location.reload();
}
