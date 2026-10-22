import { describe, expect, it } from 'vitest';
import { migrate, isMintedLabel, MIGRATED_PROFILE_NAME } from './migrate';
import { THEORYCRAFT_ID, type LineupDocument, type RotationDocument } from './records';
import { sampleById } from '$lib/data/plannerSamples';
import type { BackupData } from '$lib/utils/settingsBackup';

const NOW = 1_800_000_000_000;

function run(data: BackupData) {
	let n = 0;
	return migrate(data, { now: NOW, newId: () => `id${++n}` });
}

const rotations = (r: ReturnType<typeof run>) =>
	r.documents.filter((d): d is RotationDocument => d.type === 'rotation');
const lineups = (r: ReturnType<typeof run>) =>
	r.documents.filter((d): d is LineupDocument => d.type === 'lineup');

const ROT = 'Bennett E Q > Xiangling Q E';

describe('migrate', () => {
	it('an empty browser starts in Theorycraft alone', () => {
		const r = run({});
		expect(r.profiles.map((p) => p.id)).toEqual([THEORYCRAFT_ID]);
		expect(r.activeProfileId).toBe(THEORYCRAFT_ID);
		expect(r.documents).toEqual([]);
	});

	it('a roster alone makes My account, in the player’s twin and the Anemo ring', () => {
		const r = run({
			'critcalc:constellations': { bennett: 6 },
			'critcalc:siteSettings': { travelerVariant: 'lumine' }
		});
		const account = r.profiles.find((p) => p.kind === 'real')!;
		expect(account.name).toBe(MIGRATED_PROFILE_NAME);
		expect(account.colour).toBe('anemo');
		expect(account.twin).toBe('lumine');
		expect(account.roster.constellations).toEqual({ bennett: 6 });
		expect(r.activeProfileId).toBe(account.id);
		// Theorycraft never holds a roster (§2.2).
		const tc = r.profiles.find((p) => p.id === THEORYCRAFT_ID)!;
		expect(tc.roster.constellations).toEqual({});
	});

	it('names-only entries become Teams; rotations become Rotations', () => {
		const r = run({
			'critcalc:savedNotations': [
				{ id: 's1', name: 'Vape', notation: 'Bennett > Xiangling > Xingqiu > Sucrose', savedAt: 5 },
				{ id: 's2', name: 'National', notation: ROT, savedAt: 6 }
			]
		});
		expect(r.teams).toHaveLength(1);
		expect(r.teams[0]).toMatchObject({
			name: 'Vape',
			slots: ['bennett', 'xiangling', 'xingqiu', 'sucrose']
		});
		expect(rotations(r).map((d) => d.name)).toEqual(['National']);
		expect(rotations(r)[0].body.slots).toEqual(['bennett', 'xiangling', null, null]);
	});

	it('a tab linked to a saved entry is ONE document: the tab’s content, the saved name', () => {
		const r = run({
			'critcalc:savedNotations': [{ id: 's1', name: 'National', notation: ROT, savedAt: 5 }],
			'critcalc:rotationTabs': {
				tabs: [{ id: 't1', label: 'National', notation: `${ROT} > Bennett E`, savedId: 's1' }],
				activeTabId: 't1'
			}
		});
		const docs = rotations(r);
		expect(docs).toHaveLength(1);
		expect(docs[0].name).toBe('National');
		expect(docs[0].body.notation).toBe(`${ROT} > Bennett E`);
		const account = r.profiles.find((p) => p.kind === 'real')!;
		expect(account.current.planner).toBe(docs[0].id);
	});

	it('a minted label stores no name; a chosen one is kept', () => {
		const r = run({
			'critcalc:rotationTabs': {
				tabs: [
					{ id: 't1', label: 'Tab 1', notation: ROT },
					{ id: 't2', label: 'Morning test', notation: ROT }
				],
				activeTabId: 't2'
			}
		});
		expect(rotations(r).map((d) => d.name)).toEqual([null, 'Morning test']);
	});

	it('blank tabs are dropped; an untouched sample goes to Theorycraft as its current', () => {
		const sample = sampleById('mavuika-melt')!;
		const r = run({
			'critcalc:rotationTabs': {
				tabs: [
					{ id: 't1', label: 'Tab 2', notation: '' },
					{
						id: 't2',
						label: `Sample: ${sample.name}`,
						notation: sample.notation,
						sample: sample.id
					}
				],
				activeTabId: 't2'
			}
		});
		expect(r.profiles.map((p) => p.id)).toEqual([THEORYCRAFT_ID]);
		const docs = rotations(r);
		expect(docs).toHaveLength(1);
		expect(docs[0].profileId).toBe(THEORYCRAFT_ID);
		expect(docs[0].body.sample).toBe(sample.id);
		expect(r.profiles[0].current.planner).toBe(docs[0].id);
	});

	it('an EDITED sample is the player’s work', () => {
		const sample = sampleById('mavuika-melt')!;
		const r = run({
			'critcalc:rotationTabs': {
				tabs: [
					{
						id: 't1',
						label: `Sample: ${sample.name}`,
						notation: `${sample.notation} > Bennett E`,
						sample: sample.id
					}
				],
				activeTabId: 't1'
			}
		});
		const account = r.profiles.find((p) => p.kind === 'real');
		expect(account).toBeDefined();
		expect(rotations(r)[0].profileId).toBe(account!.id);
	});

	it('Recently closed becomes ordinary documents', () => {
		const r = run({
			'critcalc:recentlyClosedRotations': [
				{ tab: { id: 't9', label: 'Old idea', notation: ROT }, closedAt: 3 }
			]
		});
		expect(rotations(r).map((d) => d.name)).toEqual(['Old idea']);
		expect(rotations(r)[0].updatedAt).toBe(3);
	});

	it('a legacy manualSlots becomes placed slots, in its own order', () => {
		const r = run({
			'critcalc:rotationTabs': {
				tabs: [
					{
						id: 't1',
						label: 'Tab 1',
						notation: ROT,
						manualSlots: ['xiangling', 'blank', 'bennett']
					}
				],
				activeTabId: 't1'
			}
		});
		const body = rotations(r)[0].body;
		expect(body.slots).toEqual(['xiangling', null, 'bennett', null]);
		expect(body.placed).toEqual([true, false, true, false]);
	});

	it('stored levels are KEPT on the rotation (phase 4 pairs them)', () => {
		const r = run({
			'critcalc:constellations': { bennett: 1 },
			'critcalc:rotationTabs': {
				tabs: [{ id: 't1', label: 'Tab 1', notation: ROT, tabCon: { bennett: 6 } }],
				activeTabId: 't1'
			}
		});
		expect(rotations(r)[0].body.con).toEqual({ bennett: 6 });
	});

	it('lineups: saved + open merge by savedId; a pin is remapped to the document', () => {
		const team = (pin?: string) => ({
			id: 'team1',
			slots: ['bennett', 'blank', null, null],
			...(pin ? { pinnedRotationId: pin } : {})
		});
		const r = run({
			'critcalc:savedNotations': [{ id: 's1', name: 'National', notation: ROT, savedAt: 5 }],
			'critcalc:savedBoards': [
				{ id: 'b1', name: 'Abyss plan', preset: 'abyss', teams: [team('s1')], noRepeats: true }
			],
			'critcalc:boards': {
				boards: [
					{
						id: 'ob1',
						label: 'Abyss plan',
						preset: 'abyss',
						teams: [team('s1')],
						noRepeats: true,
						savedId: 'b1'
					},
					{ id: 'ob2', label: 'Lineup 2', preset: 'custom', teams: [team()], noRepeats: false },
					{
						id: 'ob3',
						label: 'Lineup 3',
						preset: 'custom',
						teams: [{ id: 'e', slots: [null, null, null, null] }],
						noRepeats: false
					}
				],
				activeBoardId: 'ob1'
			}
		});
		const ls = lineups(r);
		// ob1 merged into b1; ob2 kept unnamed; ob3 (empty, minted) dropped.
		expect(ls.map((d) => d.name)).toEqual(['Abyss plan', null]);
		const national = rotations(r)[0];
		expect(ls[0].body.teams[0].pinnedRotationId).toBe(national.id);
		// A legacy 'blank' in a team row meant an empty slot.
		expect(ls[0].body.teams[0].slots).toEqual(['bennett', null, null, null]);
		expect(r.profiles.find((p) => p.kind === 'real')!.current.builder).toBe(ls[0].id);
	});

	it('every record is sync-shaped: an id and an updatedAt, no tombstone', () => {
		const r = run({
			'critcalc:constellations': { bennett: 6 },
			'critcalc:savedNotations': [{ id: 's1', name: 'N', notation: ROT, savedAt: 5 }]
		});
		for (const rec of [...r.profiles, ...r.documents, ...r.teams]) {
			expect(typeof rec.id).toBe('string');
			expect(Number.isFinite(rec.updatedAt)).toBe(true);
			expect(rec.deleted).toBeUndefined();
		}
	});
});

describe('isMintedLabel', () => {
	it('recognises the labels the tools minted', () => {
		expect(isMintedLabel('Tab 12')).toBe(true);
		expect(isMintedLabel('Lineup 3')).toBe(true);
		expect(isMintedLabel('Sample: Mavuika Melt')).toBe(true);
		expect(isMintedLabel('Tab twelve')).toBe(false);
		expect(isMintedLabel('My Tab 1')).toBe(false);
	});
});
