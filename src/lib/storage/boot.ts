/**
 * Opening the store, and migrating into it the first time (§10, §13.1).
 * Browser-only; called while the switch is on.
 *
 * ⚓ Where the store lives, in order:
 * 1. IndexedDB, the real home.
 * 2. No `indexedDB` at all: the localStorage stand-in (`localDb.ts`), for good.
 * 3. IndexedDB present but it would not open, or localStorage blocked too:
 *    a store in memory, for this tab only. ⚠ Never the localStorage
 *    stand-in here: the database may already hold newer work, and a stand-in
 *    made from the old keys would hide it from every later page.
 *
 * ⚓ The live `localStorage` goes through the backup module's own read and
 * sanitizers (`buildEnvelope` → `parseBackup`), so it meets exactly the rules
 * a backup file meets. Nothing in `localStorage` is written or removed.
 */

import { BACKUP_KEYS, buildEnvelope, parseBackup } from '$lib/utils/settingsBackup';
import { getMeta, openDb, writeMigration, type Db } from './db';
import { replayJournals } from './journal';
import { LocalDb } from './localDb';
import { migrate } from './migrate';
import { newId } from './records';

/**
 * ⚓ The returning-visitor signal (flip-readiness §1 item 4): did this browser
 * use the site before the redesign? Any backup key present RAW counts —
 * ⛔ never `parseBackup(...).ok`, since a sanitizer dropping (say) one empty
 * tab would read a real visitor as new. Catches anyone who opened the Planner
 * or Builder (the old tools layout writes `rotationTabs` on any visit); misses
 * a visitor who only saw the landing, About, Help or Visualizers, accepted.
 * ⛔ `vizWorkspace` never counts: the Visualizers page saves its layout on
 * LOAD, outside the switch, and its onMount runs before the root layout's
 * boot — so a brand-new visitor landing there would read as returning.
 */
const NOT_A_SIGNAL: ReadonlySet<string> = new Set(['critcalc:vizWorkspace']);

export function hadLegacyData(storage: Pick<Storage, 'getItem'>): boolean {
	try {
		return BACKUP_KEYS.some((k) => !NOT_A_SIGNAL.has(k) && storage.getItem(k) != null);
	} catch {
		// Blocked site data: nothing could have been stored either.
		return false;
	}
}

let opening: Promise<Db | null> | undefined;

/** The open store, migrated. Opened once per page. `null` only if even a
 *  store in memory failed, which leaves the tools on their defaults. */
export function ensureStorage(): Promise<Db | null> {
	opening ??= open();
	return opening;
}

/** Open it again: the connection was lost (WebKit drops one under a tab
 *  left in the background) or closed for a newer version elsewhere. */
export function reopenStorage(): Promise<Db | null> {
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

function localStorageOrNull(): Storage | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null; // blocked site data throws on the very access
	}
}

function hasIndexedDb(): boolean {
	try {
		return !!globalThis.indexedDB;
	} catch {
		return false;
	}
}

async function open(): Promise<Db | null> {
	const local = localStorageOrNull();
	// Blocked site data is a setting the person can change; anything else is
	// a store this tab could not open, which a reload may fix.
	const cause = local ? 'unopened' : 'blocked';
	if (hasIndexedDb()) {
		try {
			return await ready(await openWithRetry(), local);
		} catch (err) {
			console.warn('[critcalc] IndexedDB would not open; this tab keeps its work in memory', err);
			return ready(LocalDb.inMemory(cause), null).catch(() => null);
		}
	}
	if (local) {
		try {
			return await ready(new LocalDb(local, 'local'), local);
		} catch (err) {
			console.warn(
				'[critcalc] the localStorage store failed; this tab keeps its work in memory',
				err
			);
		}
	}
	return ready(LocalDb.inMemory(cause), local).catch(() => null);
}

/** Migrate a store opened for the first time, from `legacy`'s old keys
 *  (`null`: copy nothing, Theorycraft alone), then replay the journals. */
async function ready(db: Db, legacy: Storage | null): Promise<Db> {
	if ((await getMeta(db)).migratedAt === undefined) {
		const now = Date.now();
		let data = {};
		try {
			if (legacy) {
				const parsed = parseBackup(JSON.stringify(buildEnvelope(now)), now);
				// An empty browser is `ok: false` ("no recognizable data"): Theorycraft alone.
				if (parsed.ok) data = parsed.data;
			}
		} catch {
			/* the old keys would not read: Theorycraft alone */
		}
		await writeMigration(db, migrate(data, { now, newId }), now, {
			flipNotice: !!legacy && hadLegacyData(legacy)
		});
	}
	// What a page that unloaded mid-save had not written yet (journal.ts).
	// ⚠ Never into a store in memory: replaying takes the journals, and they
	// belong to the store a later page opens.
	if (!(db instanceof LocalDb && db.kind === 'memory')) await replayJournals(db);
	return db;
}
