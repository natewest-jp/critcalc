/**
 * Opening the store, and migrating into it the first time (§10, §13.1).
 * Browser-only; called while the switch is on.
 *
 * ⚓ The live `localStorage` goes through the backup module's own read and
 * sanitizers (`buildEnvelope` → `parseBackup`), so it meets exactly the rules
 * a backup file meets. Nothing in `localStorage` is written or removed.
 */

import { BACKUP_KEYS, buildEnvelope, parseBackup } from '$lib/utils/settingsBackup';
import { getMeta, openDb, writeMigration } from './db';
import { replayJournals } from './journal';
import { migrate } from './migrate';
import { newId } from './records';

/**
 * ⚓ The returning-visitor signal (flip-readiness §1 item 4): did this browser
 * use the site before the redesign? Any backup key present RAW counts —
 * ⛔ never `parseBackup(...).ok`, since a sanitizer dropping (say) one empty
 * tab would read a real visitor as new. Catches anyone who opened the Planner
 * or Builder (the old tools layout writes `rotationTabs` on any visit); misses
 * a visitor who only saw the landing, About, Help or Visualizers, accepted.
 */
export function hadLegacyData(storage: Pick<Storage, 'getItem'>): boolean {
	try {
		return BACKUP_KEYS.some((k) => storage.getItem(k) != null);
	} catch {
		// Blocked site data: nothing could have been stored either.
		return false;
	}
}

let opening: Promise<IDBDatabase | null> | undefined;

/** The open store, migrated. `null` where IndexedDB is unavailable (a
 *  private window in some engines, blocked site data): the site carries on
 *  on `localStorage`, as it does today. Opened once per page. */
export function ensureStorage(): Promise<IDBDatabase | null> {
	opening ??= open();
	return opening;
}

/** Open it again: the connection was lost (WebKit drops one under a tab
 *  left in the background) or closed for a newer version elsewhere. */
export function reopenStorage(): Promise<IDBDatabase | null> {
	opening = undefined;
	return ensureStorage();
}

/** One retry: an open can fail once and succeed a moment later, and a tab
 *  that gives up drops to the old layout for the rest of its life. */
async function openWithRetry(): Promise<IDBDatabase> {
	try {
		return await openDb();
	} catch {
		await new Promise((r) => setTimeout(r, 250));
		return openDb();
	}
}

async function open(): Promise<IDBDatabase | null> {
	try {
		const db = await openWithRetry();
		if ((await getMeta(db)).migratedAt === undefined) {
			const now = Date.now();
			const parsed = parseBackup(JSON.stringify(buildEnvelope(now)), now);
			// An empty browser is `ok: false` ("no recognizable data"): Theorycraft alone.
			const data = parsed.ok ? parsed.data : {};
			await writeMigration(db, migrate(data, { now, newId }), now, {
				flipNotice: hadLegacyData(localStorage)
			});
		}
		// What a page that unloaded mid-save had not written yet (journal.ts).
		await replayJournals(db);
		return db;
	} catch (err) {
		console.warn('[critcalc] new storage unavailable; staying on localStorage', err);
		return null;
	}
}
