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
 * ONLY the first save asks (`askOnFirstSave`): Firefox prompts again every
 * time it is asked after a decline (Nate tested it, 2026-10-21), so asking on
 * every save would nag a decliner on every save. Someone who only edits the
 * roster never saves, and someone who declined may change their mind, so
 * Settings carries the same ask as a button, which always asks.
 * Safari declines in an ordinary tab (Nate tested it; WebKit names the
 * home-screen web app as its example of a grant), so Settings points Safari
 * at Add to Home Screen instead of a button that cannot succeed.
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

export const PERSIST_ASKED_KEY = 'critcalc:persistAsked';

/** The save-time ask: once per browser, never again after that. */
export function askOnFirstSave(): void {
	if (!browser) return;
	try {
		if (localStorage.getItem(PERSIST_ASKED_KEY)) return;
		localStorage.setItem(PERSIST_ASKED_KEY, '1');
	} catch {
		return; // storage blocked: there is nothing to keep
	}
	void requestPersistentStorage();
}

/** Safari proper (not Chrome, Edge or Firefox on iOS, which all say "Safari"
 *  in their user agent too). Only steers which advice Settings gives. */
export function isSafari(): boolean {
	if (!browser) return false;
	const ua = navigator.userAgent;
	return /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edgios|android/i.test(ua);
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

/** 🎛️ How old a backup may get, with work changed since, before Settings
 *  shows it in the warning ink and the site reminds once (⚓ Nate 2026-10-26). */
export const BACKUP_STALE_DAYS = 30;
const DAY_MS = 86_400_000;

/** Never backed up with saved work, or a backup older than the window with
 *  changes since: the case worth a warning. */
export function backupIsStale(lastBackup: number | null, changedSince: number, now = Date.now()) {
	if (changedSince <= 0) return false;
	return lastBackup === null || now - lastBackup > BACKUP_STALE_DAYS * DAY_MS;
}

export const BACKUP_REMINDED_KEY = 'critcalc:backupReminded';

/** When the backup reminder last showed (ms), or null. */
export function readBackupReminded(): number | null {
	if (!browser) return null;
	try {
		const n = Number(localStorage.getItem(BACKUP_REMINDED_KEY));
		return Number.isFinite(n) && n > 0 ? n : null;
	} catch {
		return null;
	}
}

export function recordBackupReminded(at: number): void {
	try {
		localStorage.setItem(BACKUP_REMINDED_KEY, String(at));
	} catch {
		/* storage blocked: it may remind again next visit */
	}
}

/** The reminder is due: a whole window has passed since the later of the last
 *  backup (else the first visit) and the last reminder. Whether anything
 *  changed is the caller's half — it needs the documents. */
export function backupReminderDue(firstVisit: number | undefined, now = Date.now()): boolean {
	const since = Math.max(readLastBackup() ?? firstVisit ?? now, readBackupReminded() ?? 0);
	return now - since > BACKUP_STALE_DAYS * DAY_MS;
}
