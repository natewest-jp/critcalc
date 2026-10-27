/**
 * Two browser tabs on one store (redesign bug sweep 2026-10-23, §1): two
 * storage sessions, each its own module graph (`vi.resetModules`), over ONE
 * fake IndexedDB, one lock manager and Node's BroadcastChannel. Every case
 * here failed on the code before the storage-hardening round.
 */
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get, getAll, getMeta, openDb, put, setMeta, tombstone } from './db';
import {
	THEORYCRAFT_ID,
	makeTheorycraft,
	type ProfileRecord,
	type RotationBody,
	type RotationDocument
} from './records';

function memoryStorage(): Storage {
	const m = new Map<string, string>();
	return {
		get length() {
			return m.size;
		},
		key: (i: number) => [...m.keys()][i] ?? null,
		getItem: (k: string) => m.get(k) ?? null,
		setItem: (k: string, v: string) => void m.set(k, String(v)),
		removeItem: (k: string) => void m.delete(k),
		clear: () => m.clear()
	};
}

function fakeLocks(): LockManager {
	type Held = { abort: (e: Error) => void };
	const held = new Map<string, Held>();
	const queue = new Map<string, (() => void)[]>();
	const abortError = (msg: string) => Object.assign(new Error(msg), { name: 'AbortError' });
	const grant = (
		name: string,
		cb: (l: Lock | null) => unknown,
		res: (v: unknown) => void,
		rej: (e: unknown) => void
	) => {
		const entry: Held = { abort: rej };
		held.set(name, entry);
		Promise.resolve(cb({ name, mode: 'exclusive' } as Lock)).then(
			(v) => {
				if (held.get(name) === entry) {
					held.delete(name);
					queue.get(name)?.shift()?.();
				}
				res(v);
			},
			(e) => rej(e)
		);
	};
	return {
		request(
			name: string,
			a: LockOptions | ((l: Lock | null) => unknown),
			b?: (l: Lock | null) => unknown
		) {
			const options = typeof a === 'function' ? {} : a;
			const cb = (typeof a === 'function' ? a : b)!;
			return new Promise((res, rej) => {
				const cur = held.get(name);
				if (cur && options.ifAvailable) return res(cb(null));
				if (cur && options.steal) {
					cur.abort(abortError('stolen'));
					return grant(name, cb, res, rej);
				}
				if (!cur) return grant(name, cb, res, rej);
				const turn = () => grant(name, cb, res, rej);
				const q = queue.get(name) ?? [];
				q.push(turn);
				queue.set(name, q);
				options.signal?.addEventListener('abort', () => {
					const i = q.indexOf(turn);
					if (i < 0) return;
					q.splice(i, 1);
					rej(abortError('aborted'));
				});
			});
		},
		async query() {
			return { held: [...held.keys()].map((name) => ({ name })), pending: [] };
		}
	} as unknown as LockManager;
}

const T = Date.now() - 10_000;
let factory: IDBFactory;
let listeners: { type: string; fn: (e: unknown) => void }[];
const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));

function stubBrowser(locks: LockManager | undefined) {
	vi.stubGlobal('indexedDB', factory);
	vi.stubGlobal('navigator', { locks });
	vi.stubGlobal('addEventListener', (type: string, fn: (e: unknown) => void) =>
		listeners.push({ type, fn })
	);
	vi.stubGlobal('document', {
		addEventListener: () => {},
		querySelector: () => null,
		visibilityState: 'visible'
	});
	const url = new URL('http://localhost/planner?next');
	vi.stubGlobal('location', {
		reload: vi.fn(),
		href: url.href,
		pathname: url.pathname,
		search: url.search,
		origin: url.origin,
		host: url.host,
		protocol: url.protocol,
		hash: ''
	});
}

async function seed() {
	const db = await openDb(factory);
	await put(db, 'profiles', makeTheorycraft(T, 'aether'));
	const p: ProfileRecord = {
		id: 'p1',
		updatedAt: T,
		kind: 'real',
		name: 'Main',
		colour: 'anemo',
		twin: 'aether',
		roster: { constellations: { bennett: 6 }, ownership: { bennett: 'owned' }, loadout: {} },
		current: { planner: 'd1' },
		createdAt: T
	};
	await put(db, 'profiles', p);
	const d: RotationDocument = {
		id: 'd1',
		updatedAt: T,
		profileId: 'p1',
		type: 'rotation',
		name: null,
		createdAt: T,
		body: {
			notation: 'Bennett E Q',
			slots: ['bennett', null, null, null],
			placed: [true, false, false, false]
		}
	};
	await put(db, 'documents', d);
	await put(db, 'documents', {
		...d,
		id: 'd2',
		body: { ...d.body, notation: 'Bennett Q' },
		updatedAt: T - 5
	});
	await setMeta(db, { migratedAt: T, activeProfileId: 'p1', guestsMadeAt: T });
	return db;
}

async function tab() {
	vi.resetModules();
	vi.doMock('$app/environment', () => ({
		browser: true,
		dev: false,
		building: false,
		version: 't'
	}));
	const from = listeners.length;
	const { storageSession: s } = await import('./session.svelte');
	const { rotationTabs: rt } = await import('$lib/rotationTabs.svelte');
	const stores = await import('$lib/stores');
	await s.start();
	const mine = listeners.slice(from);
	const fire = (type: string, e: unknown = {}) =>
		mine.filter((l) => l.type === type).forEach((l) => l.fn(e));
	const edit = async (text: string) => {
		rt.notation = text;
		rt.persist();
	};
	return { s, rt, stores, fire, edit };
}

let db: IDBDatabase;
/** A stored rotation's notation. */
const notationOf = async (id: string) =>
	((await get(db, 'documents', id))?.body as RotationBody | undefined)?.notation;

beforeEach(async () => {
	vi.unstubAllGlobals();
	factory = new IDBFactory();
	listeners = [];
	vi.stubGlobal('localStorage', memoryStorage());
	stubBrowser(fakeLocks());
	db = await seed();
});

describe('two tabs, one store', () => {
	it('a delete in tab B is not undone by tab A; A moves off it', async () => {
		const A = await tab();
		const B = await tab();
		expect(A.rt.activeTabId).toBe('d1');
		expect(B.s.readOnly).toContain('d1');
		await B.s.remove('d1');
		await wait();
		await A.edit('Bennett E Q > Xiangling Q');
		await A.s.flush();
		expect((await get(db, 'documents', 'd1'))?.deleted).toBe(true);
		expect(A.rt.activeTabId).toBe('d2');
	});

	it('rename + pin in tab B survive tab A autosaving (even before the message lands)', async () => {
		const A = await tab();
		const B = await tab();
		await B.s.rename('d1', 'National');
		await B.s.setPinned('d1', true);
		// No wait: A saves before the broadcast reaches it.
		await A.edit('Bennett E Q > Xiangling Q');
		await A.s.flush();
		let d = await get(db, 'documents', 'd1');
		expect(d?.name).toBe('National');
		expect(d?.pinned).toBe(true);
		expect((d?.body as RotationBody).notation).toBe('Bennett E Q > Xiangling Q');
		await wait();
		expect(A.rt.tabs[0].label).toBe('National');
		// And A's later saves keep them.
		await A.edit('Bennett E Q > Xiangling Q E');
		await A.s.flush();
		d = await get(db, 'documents', 'd1');
		expect([d?.name, d?.pinned]).toEqual(['National', true]);
	});

	it('a Library rename in a tab showing it read-only reaches the store', async () => {
		await tab();
		const B = await tab();
		await B.s.rename('d1', 'Renamed in B');
		expect((await get(db, 'documents', 'd1'))?.name).toBe('Renamed in B');
		expect(B.rt.tabs[0].label).toBe('Renamed in B');
	});

	it('one failed write does not end autosave', async () => {
		const A = await tab();
		const proto = Object.getPrototypeOf(db.transaction('documents').objectStore('documents'));
		const real = proto.put;
		let fail = 1;
		const spy = vi.spyOn(proto, 'put').mockImplementation(function (
			this: unknown,
			...args: unknown[]
		) {
			if (fail-- > 0) throw new DOMException('full', 'QuotaExceededError');
			return real.apply(this, args);
		});
		await A.edit('Bennett E Q > FAILS ONCE');
		await A.s.flush();
		expect(A.s.saveFailed).toBe(true);
		expect(await notationOf('d1')).toBe('Bennett E Q');
		// The work stayed pending: the next flush (the retry) writes it.
		await A.s.flush();
		expect(await notationOf('d1')).toBe('Bennett E Q > FAILS ONCE');
		expect(A.s.saveFailed).toBe(false);
		await A.edit('Bennett E Q > LATER');
		await A.s.flush();
		expect(await notationOf('d1')).toBe('Bennett E Q > LATER');
		spy.mockRestore();
	});

	it('a failed restore leaves the page saving', async () => {
		const A = await tab();
		const proto = Object.getPrototypeOf(db.transaction('documents').objectStore('documents'));
		const spy = vi.spyOn(proto, 'clear').mockImplementation(() => {
			throw new DOMException('nope', 'UnknownError');
		});
		await expect(
			A.s.restore({
				ok: true,
				store: { profiles: [], documents: [], teams: [], activeProfileId: 'theorycraft' },
				data: {},
				legacy: false
			} as never)
		).rejects.toThrow();
		spy.mockRestore();
		await A.edit('Bennett E Q > AFTER RESTORE FAILED');
		await A.s.flush();
		expect(await notationOf('d1')).toBe('Bennett E Q > AFTER RESTORE FAILED');
	});

	it('a restore in another tab: nothing pending here writes over it', async () => {
		const A = await tab();
		await A.edit('Bennett E Q > STALE PENDING');
		const B = await tab();
		await B.s.restore({
			ok: true,
			store: {
				profiles: [makeTheorycraft(T, 'aether')],
				documents: [],
				teams: [],
				activeProfileId: 'theorycraft'
			},
			data: {},
			legacy: false
		} as never);
		await wait();
		A.fire('pagehide');
		await A.s.flush();
		await wait();
		expect(await get(db, 'documents', 'd1')).toBeUndefined();
		const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
		expect(keys.filter((k) => k?.startsWith('critcalc:journal'))).toEqual([]);
	});

	it('a deleted active profile opens Theorycraft, not the old layout', async () => {
		await tombstone(db, 'profiles', 'p1', T + 1);
		const A = await tab();
		expect(A.s.active).toBe(true);
		expect(A.s.profile?.id).toBe('theorycraft');
	});

	it('a read-only tab takes the document back when the holder lets go', async () => {
		const A = await tab();
		const B = await tab();
		expect(B.s.readOnly).toContain('d1');
		await A.s.switchTo('theorycraft');
		await wait(50);
		expect(B.s.readOnly).not.toContain('d1');
		await B.edit('Bennett E Q > FROM B');
		await B.s.flush();
		expect(await notationOf('d1')).toBe('Bennett E Q > FROM B');
	});

	it('without Web Locks the tools still load and save', async () => {
		stubBrowser(undefined);
		const A = await tab();
		expect(A.s.active).toBe(true);
		await A.edit('Bennett E Q > NO LOCKS');
		await A.s.flush();
		expect(await notationOf('d1')).toBe('Bennett E Q > NO LOCKS');
	});

	it('two tabs on the first load make ONE what-if copy, and the rotation keeps its place', async () => {
		await put(db, 'documents', {
			...((await get(db, 'documents', 'd1')) as RotationDocument),
			body: {
				notation: 'Bennett E Q',
				slots: ['bennett', null, null, null],
				placed: [true, false, false, false],
				con: { bennett: 2 }
			}
		});
		await setMeta(db, { guestsMadeAt: undefined });
		await Promise.all([tab(), tab()]);
		const copies = (await getAll(db, 'documents', 'theorycraft')).filter((d) => d.pairId);
		expect(copies).toHaveLength(1);
		expect((await get(db, 'documents', 'd1'))?.updatedAt).toBe(T);
	});

	it('two tabs editing one roster each keep their change', async () => {
		const A = await tab();
		const B = await tab();
		A.stores.constellations.setLevel('xiangling', 4);
		B.stores.constellations.setLevel('bennett', 2);
		await wait(500);
		const p = await get(db, 'profiles', 'p1');
		expect(p?.roster.constellations).toMatchObject({ bennett: 2, xiangling: 4 });
	});

	it('a reload inside the save delay keeps the edit (journal)', async () => {
		const A = await tab();
		await A.edit('Bennett E Q > LAST KEYSTROKE');
		A.stores.constellations.setLevel('xiangling', 3);
		await wait(0);
		A.fire('pagehide');
		// The page dies before its IndexedDB writes land: simulate by never awaiting them,
		// and checking the journal holds the work.
		const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
		expect(keys.some((k) => k?.startsWith('critcalc:journal:'))).toBe(true);
	});

	it('the next page replays a journal the dying page left', async () => {
		localStorage.setItem(
			'critcalc:journal:dead',
			JSON.stringify({
				at: Date.now(),
				docs: [
					{
						id: 'd1',
						type: 'rotation',
						name: null,
						body: {
							notation: 'Bennett E Q > REPLAYED',
							slots: ['bennett', null, null, null],
							placed: [true, false, false, false]
						},
						profileId: 'p1'
					}
				],
				roster: { profileId: 'p1', changes: { constellations: { set: { xiangling: 3 }, del: [] } } }
			})
		);
		const C = await tab();
		expect(C.rt.notation).toBe('Bennett E Q > REPLAYED');
		expect((await get(db, 'profiles', 'p1'))?.roster.constellations).toMatchObject({
			xiangling: 3,
			bennett: 6
		});
	});

	it('deleting a profile tells a tab holding one of its documents', async () => {
		const A = await tab();
		const B = await tab();
		await B.s.switchTo('theorycraft');
		await B.s.deleteProfile('p1');
		await wait(50);
		await A.edit('Bennett E Q > WRITE BACK?');
		await A.s.flush();
		expect((await get(db, 'documents', 'd1'))?.deleted).toBe(true);
		expect(A.s.profile?.id).toBe('theorycraft');
	});
});

/**
 * ⚓ Loadouts belong to teams (teamLoadout.ts, Nate 2026-10-24): the roster's
 * default retires into the teams and the teamless rotations, and a team's
 * rotation inherits the team's loadout through the `loadout` store.
 */
describe('team loadouts', () => {
	const FOUR = ['bennett', 'xiangling', 'xingqiu', 'sucrose'];
	async function seedTeam(rosterLoadout: ProfileRecord['roster']['loadout']) {
		const p = (await get(db, 'profiles', 'p1'))!;
		await put(db, 'profiles', { ...p, roster: { ...p.roster, loadout: rosterLoadout } });
		await put(db, 'teams', {
			id: 't1',
			updatedAt: T,
			profileId: 'p1',
			name: 'National',
			slots: [...FOUR],
			loadout: { xingqiu: { weaponId: 'sacrificial_sword', weaponRefinement: 5 } },
			createdAt: T
		});
		const d1 = (await get(db, 'documents', 'd1')) as RotationDocument;
		await put(db, 'documents', {
			...d1,
			id: 'd3',
			body: {
				...d1.body,
				notation: 'Bennett Q',
				slots: [...FOUR],
				placed: [true, true, true, true]
			}
		});
	}

	it('the roster default retires into the team and the teamless rotations', async () => {
		await seedTeam({
			bennett: { artifactSetId: 'noblesse_oblige' },
			xingqiu: { weaponId: 'favonius_sword', weaponRefinement: 1, artifactSetId: 'emblem' }
		});
		await tab();
		const team = await get(db, 'teams', 't1');
		// The team's own choice stands; the default fills only what it left unset.
		expect(team?.loadout).toEqual({
			bennett: { artifactSetId: 'noblesse_oblige' },
			xingqiu: { weaponId: 'sacrificial_sword', weaponRefinement: 5, artifactSetId: 'emblem' }
		});
		const d1 = (await get(db, 'documents', 'd1')) as RotationDocument;
		expect(d1.body.loadout).toEqual({ bennett: { artifactSetId: 'noblesse_oblige' } });
		expect(d1.updatedAt).toBe(T);
		// The team's rotation inherits instead of holding a copy.
		expect(((await get(db, 'documents', 'd3')) as RotationDocument).body.loadout).toBeUndefined();
		expect((await get(db, 'profiles', 'p1'))?.roster.loadout).toEqual({});
	});

	it("a team's rotation reads the team's loadout, live", async () => {
		await seedTeam({});
		const A = await tab();
		await A.s.open('d3');
		await wait(50);
		const inherited = () => A.rt.inheritedLoadout({ bennett: { artifactSetId: 'ROSTER' } });
		expect(inherited().xingqiu?.weaponId).toBe('sacrificial_sword');
		expect(A.rt.team?.id).toBe('t1');
		await A.s.setTeamLoadout('t1', 'bennett', { artifactSetId: 'noblesse_oblige' });
		await wait(50);
		expect(inherited().bennett?.artifactSetId).toBe('noblesse_oblige');
		// A rotation with no team inherits nothing, never the roster.
		await A.s.open('d1');
		await wait(50);
		expect(inherited()).toEqual({});
		expect(A.rt.team).toBeNull();
	});

	it("a what-if copy takes the team's loadout into Theorycraft", async () => {
		await seedTeam({});
		const A = await tab();
		await A.s.open('d3');
		await wait(50);
		await A.s.whatIf('bennett', 1);
		const copy = (await getAll(db, 'documents', 'theorycraft')).find((d) => !d.deleted);
		expect((copy as RotationDocument).body.loadout?.xingqiu).toEqual({
			weaponId: 'sacrificial_sword',
			weaponRefinement: 5
		});
	});
});

describe('a shared link leaves Theorycraft for its own tab (flip-readiness §3)', () => {
	/** A browser tab is its own sessionStorage; a reload keeps it. */
	const inTab = async (session: Storage) => {
		vi.stubGlobal('sessionStorage', session);
		return tab();
	};

	it('the next new tab opens back in the profile the link left', async () => {
		const A = await inTab(memoryStorage());
		expect(await A.s.toTheorycraft()).toBe(true);
		expect(A.s.profile?.id).toBe(THEORYCRAFT_ID);
		expect((await getMeta(db)).returnToProfileId).toBe('p1');

		const B = await inTab(memoryStorage());
		expect(B.s.profile?.id).toBe('p1');
		const meta = await getMeta(db);
		expect(meta.activeProfileId).toBe('p1');
		expect(meta.returnToProfileId).toBeUndefined();
	});

	it('a reload of the link tab stays in Theorycraft', async () => {
		const linkTabStorage = memoryStorage();
		const A = await inTab(linkTabStorage);
		await A.s.toTheorycraft();
		const reloaded = await inTab(linkTabStorage);
		expect(reloaded.s.profile?.id).toBe(THEORYCRAFT_ID);
		expect((await getMeta(db)).returnToProfileId).toBe('p1');
	});

	it('a switch the visitor makes themselves cancels the return', async () => {
		const A = await inTab(memoryStorage());
		await A.s.toTheorycraft();
		await A.s.switchTo('p1', null);
		await A.s.switchTo(THEORYCRAFT_ID, null);
		expect((await getMeta(db)).returnToProfileId).toBeUndefined();
		const B = await inTab(memoryStorage());
		expect(B.s.profile?.id).toBe(THEORYCRAFT_ID);
	});
});
