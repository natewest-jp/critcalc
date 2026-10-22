/**
 * The IndexedDB store (profiles and surfaces design §4.4). A thin promise
 * wrapper and nothing more: one database, four object stores, and the reads
 * and writes the records need.
 *
 * ⚓ Why IndexedDB: autosaving every document across several profiles into
 * `localStorage` would meet its ~5 MB quota (a notation may be 16 KiB), and
 * IndexedDB never blocks the page while it reads or writes. It is just as
 * local: "clear site data" erases it, and `navigator.storage.persist()`
 * covers it the same way.
 *
 * The factory is injectable so vitest can hand in `fake-indexeddb`.
 */

import type { MigrationResult } from './migrate';
import type { DocumentRecord, ProfileRecord, SyncFields, TeamRecord } from './records';

export const DB_NAME = 'critcalc';
/** ⚠ Bump only with an `onupgradeneeded` step for the old version. */
export const DB_VERSION = 1;

type Stores = {
	profiles: ProfileRecord;
	documents: DocumentRecord;
	teams: TeamRecord;
};
export type StoreName = keyof Stores;

/** Facts about the store itself, not about anyone's work. */
export type Meta = {
	/** When the copy-only migration ran (ms). Present = it has run. */
	migratedAt?: number;
	/** The profile the site opens in. */
	activeProfileId?: string;
};

const META = 'meta';
const META_KEY = 'store';

function request<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function done(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
	});
}

export function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = factory.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			db.createObjectStore('profiles', { keyPath: 'id' });
			db.createObjectStore('documents', { keyPath: 'id' }).createIndex('profileId', 'profileId');
			db.createObjectStore('teams', { keyPath: 'id' }).createIndex('profileId', 'profileId');
			db.createObjectStore(META);
		};
		req.onsuccess = () => {
			const db = req.result;
			// A newer version opening in another tab waits on this connection
			// (`blocked`) until it closes, so step aside rather than hold it up.
			db.onversionchange = () => db.close();
			resolve(db);
		};
		req.onerror = () => reject(req.error);
	});
}

/** Every live record in a store, or a profile's. Tombstones are left out. */
export async function getAll<S extends StoreName>(
	db: IDBDatabase,
	store: S,
	profileId?: string
): Promise<Stores[S][]> {
	const os = db.transaction(store).objectStore(store);
	const rows = (await request(
		profileId === undefined ? os.getAll() : os.index('profileId').getAll(profileId)
	)) as Stores[S][];
	return rows.filter((r) => !r.deleted);
}

/** One record, tombstoned or not — a caller asking by id wants to know. */
export async function get<S extends StoreName>(
	db: IDBDatabase,
	store: S,
	id: string
): Promise<Stores[S] | undefined> {
	return (await request(db.transaction(store).objectStore(store).get(id))) as Stores[S] | undefined;
}

export async function put<S extends StoreName>(
	db: IDBDatabase,
	store: S,
	record: Stores[S]
): Promise<void> {
	const tx = db.transaction(store, 'readwrite');
	tx.objectStore(store).put(record);
	await done(tx);
}

/** ⚓ A deletion is a TOMBSTONE, never a removal (records.ts). */
export async function tombstone(
	db: IDBDatabase,
	store: StoreName,
	id: string,
	now: number
): Promise<void> {
	const tx = db.transaction(store, 'readwrite');
	const os = tx.objectStore(store);
	const rec = (await request(os.get(id))) as SyncFields | undefined;
	if (rec) os.put({ ...rec, deleted: true, updatedAt: now });
	await done(tx);
}

export async function getMeta(db: IDBDatabase): Promise<Meta> {
	return ((await request(db.transaction(META).objectStore(META).get(META_KEY))) as Meta) ?? {};
}

export async function setMeta(db: IDBDatabase, patch: Meta): Promise<void> {
	const tx = db.transaction(META, 'readwrite');
	const os = tx.objectStore(META);
	const cur = ((await request(os.get(META_KEY))) as Meta | undefined) ?? {};
	os.put({ ...cur, ...patch }, META_KEY);
	await done(tx);
}

/**
 * Write a migration's records, ONCE, in one transaction — so a tab closed
 * mid-write leaves either everything or nothing, never half an account.
 * Resolves `false` (writing nothing) if a migration already ran: two tabs
 * opening at once both try, and the second must not duplicate the first.
 */
export async function writeMigration(
	db: IDBDatabase,
	result: MigrationResult,
	now: number
): Promise<boolean> {
	const tx = db.transaction(['profiles', 'documents', 'teams', META], 'readwrite');
	const meta = tx.objectStore(META);
	const cur = ((await request(meta.get(META_KEY))) as Meta | undefined) ?? {};
	if (cur.migratedAt !== undefined) {
		await done(tx);
		return false;
	}
	for (const p of result.profiles) tx.objectStore('profiles').put(p);
	for (const d of result.documents) tx.objectStore('documents').put(d);
	for (const t of result.teams) tx.objectStore('teams').put(t);
	meta.put({ ...cur, migratedAt: now, activeProfileId: result.activeProfileId }, META_KEY);
	await done(tx);
	return true;
}

/** Empty every store, so the migration can be run again from the untouched
 *  `localStorage` (§13.1: a bad migration must be re-runnable). */
export async function clearAll(db: IDBDatabase): Promise<void> {
	const tx = db.transaction(['profiles', 'documents', 'teams', META], 'readwrite');
	for (const s of ['profiles', 'documents', 'teams', META]) tx.objectStore(s).clear();
	await done(tx);
}
