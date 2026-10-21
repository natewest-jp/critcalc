/**
 * storageDurability.ts — keeping local data from being cleared by the browser.
 *
 * critcalc has no server, so localStorage is the only copy of what someone
 * saves. Browsers may evict "best-effort" storage on their own (Safari after
 * days without a visit, any engine under storage pressure); `persist()` asks
 * for the stronger mode. Each engine answers differently: Chrome decides
 * silently from engagement, Firefox PROMPTS the user, Safari decides silently.
 * ⚓ Nate 2026-10-21: ask on the first SAVE — a click that means "keep this",
 * so Firefox's prompt has a reason the user can see, and early enough that a
 * Firefox user does not lose work without knowing the browser could clear it.
 * Every save asks, and that costs nothing once granted (`persisted()` answers
 * first); Chrome may grant later as engagement grows. Someone who only edits
 * the roster never saves, so Settings carries the same ask as a button.
 *
 * The last-backup stamp lives in its OWN key, outside BACKUP_KEYS, so
 * restoring an old file never rewinds it.
 */

import { browser } from '$app/environment';

/** Ask the browser to keep this site's storage. No-op when it already does,
 *  or when the API is missing. Never throws; safe to fire and forget. */
export async function requestPersistentStorage(): Promise<boolean> {
	if (!browser) return false;
	try {
		const storage = navigator.storage;
		if (!storage?.persist || !storage.persisted) return false;
		if (await storage.persisted()) return true;
		return await storage.persist();
	} catch {
		return false;
	}
}

/** Whether storage is persistent: `null` when the browser can't say. */
export async function storagePersisted(): Promise<boolean | null> {
	if (!browser) return null;
	try {
		if (!navigator.storage?.persisted) return null;
		return await navigator.storage.persisted();
	} catch {
		return null;
	}
}

export const LAST_BACKUP_KEY = 'critcalc:lastBackup';

/** When a backup was last downloaded (ms), or null if never. */
export function readLastBackup(): number | null {
	if (!browser) return null;
	try {
		const n = Number(localStorage.getItem(LAST_BACKUP_KEY));
		return Number.isFinite(n) && n > 0 ? n : null;
	} catch {
		return null;
	}
}

export function recordBackup(at: number): void {
	try {
		localStorage.setItem(LAST_BACKUP_KEY, String(at));
	} catch {
		/* storage blocked — the reminder just won't know */
	}
}
