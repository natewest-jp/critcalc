import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearAll,
	get,
	getAll,
	getMeta,
	openDb,
	put,
	readAll,
	setMeta,
	tombstone,
	writeMigration,
	type Db
} from './db';
import { LocalDb, memoryStorage } from './localDb';
import { migrate } from './migrate';
import { THEORYCRAFT_ID, type TeamRecord } from './records';

const NOW = 1_800_000_000_000;
// ⚓ Both homes answer every call alike: the stand-in (`localDb.ts`) runs the
// same suite as IndexedDB.
const homes: [string, () => Promise<Db>][] = [
	['IndexedDB', () => openDb(new IDBFactory())],
	['the localStorage stand-in', async () => new LocalDb(memoryStorage(), 'local')]
];

function sample() {
	let n = 0;
	return migrate(
		{
			'critcalc:constellations': { bennett: 6 },
			'critcalc:savedNotations': [
				{ id: 's1', name: 'National', notation: 'Bennett E Q > Xiangling Q', savedAt: 5 },
				{ id: 's2', name: 'Vape', notation: 'Bennett > Xiangling', savedAt: 6 }
			]
		},
		{ now: NOW, newId: () => `id${++n}` }
	);
}

describe.each(homes)('storage in %s', (_, open) => {
	let db: Db;

	beforeEach(async () => {
		db = await open();
	});

	it('writes a migration once, atomically, and records where to open', async () => {
		const result = sample();
		expect(await writeMigration(db, result, NOW)).toBe(true);
		expect(await getAll(db, 'profiles')).toHaveLength(2);
		const account = result.profiles.find((p) => p.kind === 'real')!;
		expect(await getAll(db, 'documents', account.id)).toHaveLength(1);
		expect(await getAll(db, 'teams', account.id)).toHaveLength(1);
		expect(await getAll(db, 'documents', THEORYCRAFT_ID)).toHaveLength(0);
		// The player's data moved, so the first tool visit offers a backup.
		expect(await getMeta(db)).toEqual({
			migratedAt: NOW,
			activeProfileId: account.id,
			backupOffer: true
		});
	});

	it('records the returning-visitor dialog only when asked to', async () => {
		await writeMigration(db, sample(), NOW, { flipNotice: true });
		expect((await getMeta(db)).flipNotice).toBe(true);
		await setMeta(db, { flipNotice: false });
		expect((await getMeta(db)).flipNotice).toBe(false);
		const other = await open();
		await writeMigration(other, sample(), NOW);
		expect(await getMeta(other)).not.toHaveProperty('flipNotice');
	});

	it('a second migration writes NOTHING (two tabs opening at once)', async () => {
		await writeMigration(db, sample(), NOW);
		let n = 100;
		const again = migrate(
			{ 'critcalc:constellations': { bennett: 6 } },
			{ now: NOW + 1, newId: () => `id${++n}` }
		);
		expect(await writeMigration(db, again, NOW + 1)).toBe(false);
		expect(await getAll(db, 'profiles')).toHaveLength(2);
		expect((await getMeta(db)).migratedAt).toBe(NOW);
	});

	it('a deletion is a tombstone: hidden from lists, still readable by id', async () => {
		await writeMigration(db, sample(), NOW);
		const [team] = await getAll(db, 'teams');
		await tombstone(db, 'teams', team.id, NOW + 5);
		expect(await getAll(db, 'teams')).toHaveLength(0);
		expect(await get(db, 'teams', team.id)).toMatchObject({ deleted: true, updatedAt: NOW + 5 });
	});

	it('put replaces by id; setMeta merges', async () => {
		const team: TeamRecord = {
			id: 't',
			updatedAt: 1,
			profileId: THEORYCRAFT_ID,
			name: 'A',
			slots: [null, null, null, null],
			createdAt: 1
		};
		await put(db, 'teams', team);
		await put(db, 'teams', { ...team, name: 'B', updatedAt: 2 });
		expect((await getAll(db, 'teams')).map((t) => t.name)).toEqual(['B']);
		await setMeta(db, { migratedAt: 9 });
		await setMeta(db, { activeProfileId: 'x' });
		expect(await getMeta(db)).toEqual({ migratedAt: 9, activeProfileId: 'x' });
	});

	it('clearAll makes the migration re-runnable', async () => {
		await writeMigration(db, sample(), NOW);
		await clearAll(db);
		expect(await getMeta(db)).toEqual({});
		expect(await writeMigration(db, sample(), NOW + 1)).toBe(true);
	});
});

describe('the localStorage stand-in', () => {
	it('reads another tab’s write on the next call: nothing is cached', async () => {
		const shared = memoryStorage();
		const a = new LocalDb(shared, 'local');
		const b = new LocalDb(shared, 'local');
		await writeMigration(a, sample(), NOW);
		const [team] = await getAll(a, 'teams');
		await tombstone(b, 'teams', team.id, NOW + 1);
		expect(await getAll(a, 'teams')).toHaveLength(0);
		// And the second tab's migration still writes nothing.
		expect(await writeMigration(b, sample(), NOW + 2)).toBe(false);
	});

	it('a write past the quota throws and leaves the store as it was', async () => {
		const storage = memoryStorage();
		const db = new LocalDb(storage, 'local');
		await writeMigration(db, sample(), NOW);
		const before = await readAll(db);
		storage.setItem = () => {
			throw new DOMException('full', 'QuotaExceededError');
		};
		const [team] = await getAll(db, 'teams');
		await expect(put(db, 'teams', { ...team, name: 'Renamed' })).rejects.toThrow('full');
		expect(await readAll(db)).toEqual(before);
	});

	it('a record comes back as a copy, as from a database', async () => {
		const db = new LocalDb();
		await writeMigration(db, sample(), NOW);
		const [team] = await getAll(db, 'teams');
		team.name = 'changed in hand';
		expect((await get(db, 'teams', team.id))?.name).not.toBe('changed in hand');
	});
});
