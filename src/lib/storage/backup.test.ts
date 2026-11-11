import { describe, expect, it } from 'vitest';
import { parseAnyBackup } from './backup';

/** A v3 file with one real profile carrying `instruments`. */
function file(instruments: unknown): string {
	return JSON.stringify({
		app: 'critcalc',
		version: 3,
		exportedAt: 1,
		data: {},
		store: {
			profiles: [
				{
					id: 'p1',
					updatedAt: 1,
					kind: 'real',
					name: 'Main',
					color: 'anemo',
					twin: 'aether',
					roster: {},
					current: {},
					createdAt: 1,
					instruments
				}
			]
		}
	});
}

const profileOf = (text: string) => {
	const r = parseAnyBackup(text, { now: 1, newId: () => 'x' });
	if (!r.ok) throw new Error(r.error);
	return r.store.profiles.find((p) => p.id === 'p1');
};

describe('a backup keeps the Visualizers’ saved instruments (overhaul round 4)', () => {
	it('restores each instrument’s state with its profile', () => {
		const states = { wish: { v: 3, pulls: 120 }, crit: { v: 1, cr: 0.8 } };
		expect(profileOf(file(states))?.instruments).toEqual(states);
	});

	it('drops a state that is not an object, and the field when nothing is left', () => {
		expect(profileOf(file({ wish: 7, crit: { v: 1 } }))?.instruments).toEqual({ crit: { v: 1 } });
		expect(profileOf(file({ wish: 'x' }))).not.toHaveProperty('instruments');
		expect(profileOf(file(null))).not.toHaveProperty('instruments');
	});
});

describe('a backup’s profile color', () => {
	it('reads the current spelling', () => {
		expect(profileOf(file(undefined))?.color).toBe('anemo');
	});

	it('still reads a file saved with the old spelling, and keeps only the new key', () => {
		const old = file(undefined).replace('"color"', '"colour"');
		expect(old).toContain('"colour"');
		const restored = profileOf(old);
		expect(restored?.color).toBe('anemo');
		expect(restored).not.toHaveProperty('colour');
	});
});

describe('a backup keeps the Theater (2026-11-11)', () => {
	const withRoster = (roster: unknown, documents: unknown[] = []) => {
		const f = JSON.parse(file(undefined));
		f.store.profiles[0].roster = roster;
		f.store.documents = documents;
		return JSON.stringify(f);
	};

	it('keeps the roster\'s "can\'t enter Theater" marks, and only true ones', () => {
		const text = withRoster({ theaterOff: { furina: true, qiqi: 'yes', fischl: false } });
		expect(profileOf(text)?.roster.theaterOff).toEqual({ furina: true });
	});

	it("keeps a Theater lineup's plan, dropping what doesn't fit it", () => {
		const r = parseAnyBackup(
			withRoster({}, [
				{
					id: 'd1',
					profileId: 'p1',
					type: 'lineup',
					createdAt: 1,
					body: {
						preset: 'theater',
						noRepeats: false,
						teams: [],
						theater: {
							season: '2026-11-15',
							mode: 'impossible',
							cast: ['furina', 7, 'furina', 'qiqi'],
							invite: true
						}
					}
				}
			]),
			{ now: 1, newId: () => 'x' }
		);
		if (!r.ok) throw new Error(r.error);
		const doc = r.store.documents.find((d) => d.id === 'd1');
		expect(doc?.type === 'lineup' && doc.body.theater).toEqual({
			cast: ['furina', 'qiqi'],
			invite: true
		});
	});
});

describe("a backup keeps an Abyss lineup's cycle (2026-11-11)", () => {
	it('keeps the cycle by its start date, as a Stygian season by its version', () => {
		const f = JSON.parse(file(undefined));
		f.store.documents = [
			{
				id: 'd1',
				profileId: 'p1',
				type: 'lineup',
				createdAt: 1,
				body: { preset: 'abyss', season: '2026-10-16', noRepeats: true, teams: [] }
			}
		];
		const r = parseAnyBackup(JSON.stringify(f), { now: 1, newId: () => 'x' });
		if (!r.ok) throw new Error(r.error);
		const doc = r.store.documents.find((d) => d.id === 'd1');
		expect(doc?.type === 'lineup' && doc.body.season).toBe('2026-10-16');
	});
});
