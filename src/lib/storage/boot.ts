/**
 * Opening the store, and migrating into it the first time (§10, §13.1).
 * Browser-only; called while the switch is on.
 *
 * ⚓ The live `localStorage` goes through the backup module's own read and
 * sanitizers (`buildEnvelope` → `parseBackup`), so it meets exactly the rules
 * a backup file meets. Nothing in `localStorage` is written or removed.
 */

import { buildEnvelope, parseBackup } from '$lib/utils/settingsBackup';
import { getMeta, openDb, writeMigration } from './db';
import { migrate } from './migrate';
import { newId } from './records';

let opening: Promise<IDBDatabase | null> | undefined;

/** The open store, migrated. `null` where IndexedDB is unavailable (a
 *  private window in some engines, blocked site data): the site carries on
 *  on `localStorage`, as it does today. Opened once per page. */
export function ensureStorage(): Promise<IDBDatabase | null> {
	opening ??= open();
	return opening;
}

async function open(): Promise<IDBDatabase | null> {
	try {
		const db = await openDb();
		if ((await getMeta(db)).migratedAt === undefined) {
			const now = Date.now();
			const parsed = parseBackup(JSON.stringify(buildEnvelope(now)), now);
			// An empty browser is `ok: false` ("no recognizable data"): Theorycraft alone.
			const data = parsed.ok ? parsed.data : {};
			await writeMigration(db, migrate(data, { now, newId }), now);
		}
		return db;
	} catch (err) {
		console.warn('[critcalc] new storage unavailable; staying on localStorage', err);
		return null;
	}
}
