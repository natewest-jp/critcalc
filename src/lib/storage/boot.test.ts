import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBackup } from '$lib/utils/settingsBackup';
import { hadLegacyData } from './boot';
import { LOCAL_DB_KEY } from './localDb';

// The open path reads the old keys only in a browser.
vi.mock('$app/environment', () => ({ browser: true, dev: false, building: false, version: '' }));

/** A `localStorage` stand-in holding exactly these raw values. */
function storage(raw: Record<string, string>): Pick<Storage, 'getItem'> {
	return { getItem: (k) => raw[k] ?? null };
}

/** What `open()` parses: the live keys through the backup sanitizers. */
function parsed(raw: Record<string, string>) {
	const data = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, JSON.parse(v)]));
	return parseBackup(JSON.stringify({ app: 'critcalc', version: 2, exportedAt: 0, data }), 0);
}

describe('the returning-visitor signal (flip-readiness §1 item 4)', () => {
	it('an empty browser is a first visit', () => {
		expect(hadLegacyData(storage({}))).toBe(false);
	});

	it('any backup key present raw is a returning visitor', () => {
		expect(hadLegacyData(storage({ 'critcalc:constellations': '{"bennett":6}' }))).toBe(true);
	});

	it('a key the sanitizers DROP still counts (⛔ not `parsed.ok`)', () => {
		// The old tools layout writes its tabs on any visit; an empty list is
		// dropped by the sanitizer, so the parse alone would read a new visitor.
		const raw = { 'critcalc:rotationTabs': '{"tabs":[],"activeTabId":null}' };
		expect(parsed(raw).ok).toBe(false);
		expect(hadLegacyData(storage(raw))).toBe(true);
	});

	it('a key outside the backup set does not count', () => {
		expect(hadLegacyData(storage({ 'critcalc:persistAsked': '1' }))).toBe(false);
	});

	it('the Visualizers layout alone does not count (it is saved on load)', () => {
		const viz = { 'critcalc:vizWorkspace': '{"v":1,"assignment":[],"slots":"auto"}' };
		expect(hadLegacyData(storage(viz))).toBe(false);
	});

	it('blocked site data reads as a first visit', () => {
		const blocked = {
			getItem: () => {
				throw new Error('SecurityError');
			}
		};
		expect(hadLegacyData(blocked)).toBe(false);
	});
});

describe('where the store lives (boot.ts)', () => {
	const legacy = {
		'critcalc:constellations': '{"bennett":6}',
		'critcalc:savedNotations':
			'[{"id":"s1","name":"National","notation":"Bennett E Q > Xiangling Q","savedAt":5}]'
	};

	/** A whole Storage: the journals are found by walking its keys. */
	function withLocalStorage(raw: Record<string, string>): Storage {
		const m = new Map(Object.entries(raw));
		const ls: Storage = {
			get length() {
				return m.size;
			},
			key: (i) => [...m.keys()][i] ?? null,
			getItem: (k) => m.get(k) ?? null,
			setItem: (k, v) => void m.set(k, String(v)),
			removeItem: (k) => void m.delete(k),
			clear: () => m.clear()
		};
		vi.stubGlobal('localStorage', ls);
		return ls;
	}

	/** A fresh page: boot's open-once promise is module state. Asked through
	 *  the same module graph, or `instanceof LocalDb` compares two classes. */
	async function openPage() {
		vi.resetModules();
		const db = (await (await import('./boot')).ensureStorage())!;
		const { getAll, getMeta } = await import('./db');
		const { LocalDb } = await import('./localDb');
		return {
			kind: db instanceof LocalDb ? db.kind : 'indexeddb',
			cause: db instanceof LocalDb ? db.cause : undefined,
			profiles: () => getAll(db, 'profiles'),
			meta: () => getMeta(db)
		};
	}

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('IndexedDB, where it opens, and nothing written to localStorage', async () => {
		const ls = withLocalStorage(legacy);
		vi.stubGlobal('indexedDB', new IDBFactory());
		const page = await openPage();
		expect(page.kind).toBe('indexeddb');
		expect(await page.profiles()).toHaveLength(2);
		expect(ls.getItem(LOCAL_DB_KEY)).toBeNull();
	});

	it('no IndexedDB: the stand-in in localStorage, migrated once and kept', async () => {
		const ls = withLocalStorage(legacy);
		vi.stubGlobal('indexedDB', undefined);
		const page = await openPage();
		expect(page.kind).toBe('local');
		expect(await page.profiles()).toHaveLength(2);
		const { migratedAt } = await page.meta();
		// Copy-only: the old keys stay as they were.
		expect(ls.getItem('critcalc:constellations')).toBe(legacy['critcalc:constellations']);
		// The next page opens the same store, with no second migration.
		const again = await openPage();
		expect((await again.meta()).migratedAt).toBe(migratedAt);
		expect(await again.profiles()).toHaveLength(2);
	});

	it('IndexedDB that will not open: this tab in memory, copying nothing and taking no journal', async () => {
		const journal = { 'critcalc:journal:page1': '{"at":1,"docs":[]}' };
		const ls = withLocalStorage({ ...legacy, ...journal });
		vi.stubGlobal('indexedDB', {
			open: () => {
				throw new Error('InvalidStateError');
			}
		});
		const page = await openPage();
		expect(page.kind).toBe('memory');
		expect(page.cause).toBe('unopened'); // the notice offers a reload
		// The database may hold newer work than the old keys: Theorycraft alone.
		expect((await page.profiles()).map((p) => p.kind)).toEqual(['theorycraft']);
		expect(ls.getItem(LOCAL_DB_KEY)).toBeNull();
		expect(ls.getItem('critcalc:journal:page1')).not.toBeNull();
	});

	it('no IndexedDB and site data blocked: a store in memory', async () => {
		vi.stubGlobal('indexedDB', undefined);
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			get() {
				throw new DOMException('blocked', 'SecurityError');
			}
		});
		const page = await openPage();
		expect(page.kind).toBe('memory');
		expect(page.cause).toBe('blocked'); // the notice names the browser's setting
		expect(await page.profiles()).toHaveLength(1);
		// Its action is Download a backup, which reads the settings keys too.
		const { buildEnvelope } = await import('$lib/utils/settingsBackup');
		expect(buildEnvelope(0).data).toEqual({});
		Reflect.deleteProperty(globalThis, 'localStorage');
	});

	it('IndexedDB refusing and localStorage blocked (blocked site data in Chrome) reads as blocked', async () => {
		vi.stubGlobal('indexedDB', {
			open: () => {
				throw new DOMException('denied', 'SecurityError');
			}
		});
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			get() {
				throw new DOMException('blocked', 'SecurityError');
			}
		});
		const page = await openPage();
		expect(page.cause).toBe('blocked');
		Reflect.deleteProperty(globalThis, 'localStorage');
	});
});
