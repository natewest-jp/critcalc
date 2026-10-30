/**
 * The stand-in store, for a browser where IndexedDB is missing or will not
 * open (a private window in some engines, a locked-down webview, a damaged
 * profile). It holds the same records as `db.ts` and answers the same calls,
 * so the new layout runs everywhere and the old layout has nothing left to
 * catch.
 *
 * ⚓ All four stores live in ONE localStorage value, so every write replaces
 * the whole of it and lands entirely or not at all, the guarantee a
 * transaction gives in IndexedDB. Nothing is cached between calls: another
 * tab's write is read on the next call, as it would be from the database.
 * ⚠ The cost is the reason IndexedDB is the real home: localStorage holds
 * about 5 MB per site, and a write past it throws, which the session reports
 * as a failed save (`session.svelte.ts` `#writeFailed`).
 *
 * Where localStorage is blocked as well, it runs on `memoryStorage()`, and
 * the work lasts as long as the tab.
 */

import type { Meta, StoreName, Stores } from './db';
import type { MigrationResult } from './migrate';

/** The one key the stand-in writes. ⚠ Its presence is what keeps a browser on
 *  the stand-in (`boot.ts`), so a store never splits in two. */
export const LOCAL_DB_KEY = 'critcalc:store';

type Rows = { [S in StoreName]: Record<string, Stores[S]> };
type Tables = Rows & { meta: Meta };
type Row<S extends StoreName> = Stores[S];

export type LocalKind = 'local' | 'memory';

const empty = (): Tables => ({ profiles: {}, documents: {}, teams: {}, meta: {} });

/** A Storage that forgets at unload: the last resort. */
export function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
	const m = new Map<string, string>();
	return {
		getItem: (k) => m.get(k) ?? null,
		setItem: (k, v) => void m.set(k, String(v)),
		removeItem: (k) => void m.delete(k)
	};
}

export class LocalDb {
	readonly kind: LocalKind;
	#storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

	constructor(
		storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = memoryStorage(),
		kind: LocalKind = 'memory'
	) {
		this.#storage = storage;
		this.kind = kind;
	}

	/** Whether this storage has ever held a stand-in store. */
	static exists(storage: Pick<Storage, 'getItem'>): boolean {
		try {
			return storage.getItem(LOCAL_DB_KEY) != null;
		} catch {
			return false;
		}
	}

	#read(): Tables {
		const raw = this.#storage.getItem(LOCAL_DB_KEY);
		return raw ? { ...empty(), ...(JSON.parse(raw) as Partial<Tables>) } : empty();
	}

	/** Read, change and write back in one synchronous step: no other code,
	 *  in this tab or another, runs between the read and the write. */
	#change<R>(fn: (t: Tables) => R): R {
		const t = this.#read();
		const r = fn(t);
		this.#storage.setItem(LOCAL_DB_KEY, JSON.stringify(t));
		return r;
	}

	getAll<S extends StoreName>(store: S, profileId?: string): Row<S>[] {
		return Object.values(rowsOf(this.#read(), store)).filter(
			(r) =>
				!r.deleted && (profileId === undefined || ('profileId' in r && r.profileId === profileId))
		);
	}

	get<S extends StoreName>(store: S, id: string): Row<S> | undefined {
		return rowsOf(this.#read(), store)[id];
	}

	putMany<S extends StoreName>(store: S, records: Row<S>[]): void {
		this.#change((t) => {
			const rows = rowsOf(t, store);
			for (const r of records) rows[r.id] = r;
		});
	}

	modify<S extends StoreName>(
		store: S,
		id: string,
		change: (stored: Row<S> | undefined) => Row<S> | null
	): Row<S> | null {
		const t = this.#read();
		const rows = rowsOf(t, store);
		const next = change(rows[id]);
		if (!next) return null;
		rows[id] = next;
		this.#storage.setItem(LOCAL_DB_KEY, JSON.stringify(t));
		return next;
	}

	getMeta(): Meta {
		return this.#read().meta;
	}

	setMeta(patch: Meta): void {
		this.#change((t) => void (t.meta = { ...t.meta, ...patch }));
	}

	/** `meta` is the store's meta as it stands; resolves what to write, or
	 *  `null` to write nothing (`db.ts` `writeMigration` decides). */
	writeMigration(result: MigrationResult, meta: (cur: Meta) => Meta | null): boolean {
		const t = this.#read();
		const next = meta(t.meta);
		if (!next) return false;
		this.#storage.setItem(LOCAL_DB_KEY, JSON.stringify(fill(t, result, next)));
		return true;
	}

	clearAll(): void {
		this.#storage.setItem(LOCAL_DB_KEY, JSON.stringify(empty()));
	}

	replaceAll(result: MigrationResult, meta: Meta): void {
		this.#storage.setItem(LOCAL_DB_KEY, JSON.stringify(fill(empty(), result, meta)));
	}

	/** Every record of every store, tombstones included. */
	readAll(): Omit<MigrationResult, 'activeProfileId'> & { meta: Meta } {
		const t = this.#read();
		return {
			profiles: Object.values(t.profiles),
			documents: Object.values(t.documents),
			teams: Object.values(t.teams),
			meta: t.meta
		};
	}

	/** Nothing to close; here so a session can treat both stores alike. */
	close(): void {}
}

/** One store's rows, writable. (TypeScript will not write through `t[store]`
 *  for a generic `S`.) */
function rowsOf<S extends StoreName>(t: Tables, store: S): Record<string, Stores[S]> {
	return t[store] as Record<string, Stores[S]>;
}

function fill(t: Tables, result: MigrationResult, meta: Meta): Tables {
	for (const p of result.profiles) t.profiles[p.id] = p;
	for (const d of result.documents) t.documents[d.id] = d;
	for (const r of result.teams) t.teams[r.id] = r;
	t.meta = meta;
	return t;
}
