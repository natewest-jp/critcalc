import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get, openDb, put, setMeta, tombstone } from './db';
import {
	applyRosterChanges,
	replayJournals,
	rosterChange,
	writeJournal,
	type Journal
} from './journal';
import {
	makeTheorycraft,
	type ProfileRecord,
	type Roster,
	type RotationBody,
	type RotationDocument
} from './records';

/** Node has no localStorage: a Map behind the Storage methods the journal uses. */
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

const T = 1_800_000_000_000;
let db: IDBDatabase;

const profile = (over: Partial<ProfileRecord> = {}): ProfileRecord => ({
	id: 'p1',
	updatedAt: T,
	kind: 'real',
	name: 'Main',
	colour: 'anemo',
	twin: 'aether',
	roster: { constellations: { bennett: 6 }, ownership: {}, loadout: {} },
	current: {},
	createdAt: T,
	...over
});

/** A stored rotation's notation. */
const notationOf = async (id: string) =>
	((await get(db, 'documents', id))?.body as RotationBody | undefined)?.notation;

const doc = (over: Partial<RotationDocument> = {}): RotationDocument => ({
	id: 'd1',
	updatedAt: T,
	profileId: 'p1',
	type: 'rotation',
	name: null,
	createdAt: T,
	body: { notation: 'Bennett E Q', slots: ['bennett', null, null, null], placed: [] },
	...over
});

const journal = (over: Partial<Journal>): Journal => ({ at: T + 100, docs: [], ...over });

beforeEach(async () => {
	vi.stubGlobal('localStorage', memoryStorage());
	db = await openDb(new IDBFactory());
	await put(db, 'profiles', makeTheorycraft(T, 'aether'));
	await put(db, 'profiles', profile());
	await setMeta(db, { migratedAt: T });
});

afterEach(() => vi.unstubAllGlobals());

const edited = {
	id: 'd1',
	type: 'rotation' as const,
	name: null,
	body: { notation: 'Bennett E Q > Xiangling Q', slots: ['bennett', null, null, null], placed: [] },
	profileId: 'p1'
};

describe('the unload journal', () => {
	it('a reload inside the save delay keeps the last edit', async () => {
		await put(db, 'documents', doc());
		writeJournal('page1', journal({ docs: [edited] }));
		await replayJournals(db);
		const d = await get(db, 'documents', 'd1');
		expect(d?.body).toEqual(edited.body);
		expect(d?.updatedAt).toBe(T + 100);
		// Replayed once: the journal is gone.
		expect(localStorage.length).toBe(0);
	});

	it('a document saved after the journal was written wins', async () => {
		await put(db, 'documents', doc({ updatedAt: T + 200 }));
		writeJournal('page1', journal({ docs: [edited] }));
		await replayJournals(db);
		expect(await notationOf('d1')).toBe('Bennett E Q');
	});

	it('a deletion wins', async () => {
		await put(db, 'documents', doc());
		await tombstone(db, 'documents', 'd1', T + 50);
		writeJournal('page1', journal({ docs: [edited] }));
		await replayJournals(db);
		const d = await get(db, 'documents', 'd1');
		expect(d?.deleted).toBe(true);
		expect((d?.body as RotationBody).notation).toBe('Bennett E Q');
	});

	it('a restore since replaces everything, the journal included', async () => {
		await put(db, 'documents', doc());
		writeJournal('page1', journal({ docs: [edited] }));
		await setMeta(db, { migratedAt: T + 500 });
		await replayJournals(db);
		expect(await notationOf('d1')).toBe('Bennett E Q');
	});

	it('a document never saved arrives whole, and becomes the current one', async () => {
		writeJournal(
			'page1',
			journal({
				docs: [{ ...edited, id: 'new', fresh: { createdAt: T + 90, fromLink: true } }],
				current: { profileId: 'p1', planner: 'new' }
			})
		);
		await replayJournals(db);
		const d = await get(db, 'documents', 'new');
		expect(d?.profileId).toBe('p1');
		expect(d?.fromLink).toBe(true);
		expect(d?.createdAt).toBe(T + 90);
		expect((await get(db, 'profiles', 'p1'))?.current.planner).toBe('new');
	});

	it('a new document of a profile deleted since is not brought back', async () => {
		await tombstone(db, 'profiles', 'p1', T + 50);
		writeJournal('page1', journal({ docs: [{ ...edited, id: 'new', fresh: { createdAt: T } }] }));
		await replayJournals(db);
		expect(await get(db, 'documents', 'new')).toBeUndefined();
	});

	it('roster changes land key by key', async () => {
		writeJournal(
			'page1',
			journal({
				roster: {
					profileId: 'p1',
					changes: { constellations: { set: { xiangling: 4 }, del: [] } }
				}
			})
		);
		await replayJournals(db);
		const p = await get(db, 'profiles', 'p1');
		expect(p?.roster.constellations).toEqual({ bennett: 6, xiangling: 4 });
	});

	it('a profile written since keeps its roster', async () => {
		await put(db, 'profiles', profile({ updatedAt: T + 300 }));
		writeJournal(
			'page1',
			journal({
				roster: { profileId: 'p1', changes: { constellations: { set: { bennett: 0 }, del: [] } } }
			})
		);
		await replayJournals(db);
		expect((await get(db, 'profiles', 'p1'))?.roster.constellations).toEqual({ bennett: 6 });
	});

	it('a torn journal is dropped without stopping the rest', async () => {
		await put(db, 'documents', doc());
		localStorage.setItem('critcalc:journal:torn', '{"at":');
		writeJournal('page1', journal({ docs: [edited] }));
		await replayJournals(db);
		expect((await get(db, 'documents', 'd1'))?.body).toEqual(edited.body);
		expect(localStorage.length).toBe(0);
	});
});

describe('roster changes', () => {
	it('two tabs editing one roster each keep their own character', () => {
		const base = { bennett: 6, xiangling: 4 };
		// Tab A raised Bennett; tab B, from the same base, removed Xiangling.
		const a = rosterChange(base, { bennett: 6, xiangling: 6 })!;
		const b = rosterChange(base, { bennett: 6 })!;
		let roster: Roster = { constellations: base, ownership: {}, loadout: {} };
		roster = applyRosterChanges(roster, { constellations: a });
		roster = applyRosterChanges(roster, { constellations: b });
		expect(roster.constellations).toEqual({ bennett: 6 });
		const c = rosterChange(base, { bennett: 5, xiangling: 4 })!;
		roster = applyRosterChanges(
			{ constellations: { bennett: 6, xiangling: 6 }, ownership: {}, loadout: {} },
			{ constellations: c }
		);
		expect(roster.constellations).toEqual({ bennett: 5, xiangling: 6 });
	});

	it('nothing changed is no change', () => {
		expect(rosterChange({ bennett: 6 }, { bennett: 6 })).toBeNull();
	});
});
