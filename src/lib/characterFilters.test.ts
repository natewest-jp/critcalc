import { describe, it, expect } from 'vitest';
import type { CharacterIndexEntry } from '$lib/types/character';
import { matchesIdentity, regionChips, type IdentityFilters } from './characterFilters';

const entry = (partial: Partial<CharacterIndexEntry>): CharacterIndexEntry =>
	({
		id: 'x',
		name: 'X',
		displayName: 'X',
		rarity: 4,
		curated: true,
		caps: [],
		...partial
	}) as CharacterIndexEntry;

const IDENTITY: IdentityFilters = {
	elements: new Set<string>(),
	weapons: new Set<string>(),
	rarities: new Set<number>(),
	region: '',
	search: ''
};

describe('matchesIdentity', () => {
	const bennett = entry({
		id: 'bennett',
		displayName: 'Bennett',
		element: 'pyro',
		weapon: 'sword',
		rarity: 4,
		region: 'Mondstadt'
	});

	it('passes everyone when no filter is active', () => {
		expect(matchesIdentity(bennett, IDENTITY)).toBe(true);
	});

	it('matches the search substring case-insensitively', () => {
		expect(matchesIdentity(bennett, { ...IDENTITY, search: 'BENN' })).toBe(true);
		expect(matchesIdentity(bennett, { ...IDENTITY, search: 'diluc' })).toBe(false);
		// Leading/trailing whitespace is trimmed before matching.
		expect(matchesIdentity(bennett, { ...IDENTITY, search: '  ben ' })).toBe(true);
	});

	it('ORs within the element group', () => {
		expect(matchesIdentity(bennett, { ...IDENTITY, elements: new Set(['pyro']) })).toBe(true);
		expect(matchesIdentity(bennett, { ...IDENTITY, elements: new Set(['cryo']) })).toBe(false);
		expect(matchesIdentity(bennett, { ...IDENTITY, elements: new Set(['cryo', 'pyro']) })).toBe(
			true
		);
	});

	it('filters by weapon, rarity, and region', () => {
		expect(matchesIdentity(bennett, { ...IDENTITY, weapons: new Set(['claymore']) })).toBe(false);
		expect(matchesIdentity(bennett, { ...IDENTITY, rarities: new Set([5]) })).toBe(false);
		expect(matchesIdentity(bennett, { ...IDENTITY, rarities: new Set([4]) })).toBe(true);
		expect(matchesIdentity(bennett, { ...IDENTITY, region: 'Liyue' })).toBe(false);
		expect(matchesIdentity(bennett, { ...IDENTITY, region: 'Mondstadt' })).toBe(true);
	});

	it('ANDs across groups', () => {
		// Right element, wrong rarity → excluded.
		expect(
			matchesIdentity(bennett, { ...IDENTITY, elements: new Set(['pyro']), rarities: new Set([5]) })
		).toBe(false);
		// Both groups satisfied → included.
		expect(
			matchesIdentity(bennett, { ...IDENTITY, elements: new Set(['pyro']), rarities: new Set([4]) })
		).toBe(true);
	});

	it('treats a missing element/weapon/region as unmatched by an active filter', () => {
		const nameless = entry({ id: 'n', displayName: 'Nameless' });
		expect(matchesIdentity(nameless, { ...IDENTITY, elements: new Set(['pyro']) })).toBe(false);
		expect(matchesIdentity(nameless, { ...IDENTITY, weapons: new Set(['sword']) })).toBe(false);
		expect(matchesIdentity(nameless, { ...IDENTITY, region: 'Mondstadt' })).toBe(false);
	});

	describe('factionBuffs group', () => {
		const fischl = entry({ id: 'fischl', factions: ['hexerei'] });
		const ineffa = entry({ id: 'ineffa', factions: ['moonsign'] });
		const sandrone = entry({ id: 'sandrone', enablesReactions: ['stellarConduct'] });
		const diona = entry({ id: 'diona', gatedReactions: ['stellarConduct'] });
		const plain = entry({ id: 'plain' });

		it('is inert when absent or empty (planner selector compatibility)', () => {
			expect(matchesIdentity(plain, IDENTITY)).toBe(true);
			expect(matchesIdentity(plain, { ...IDENTITY, factionBuffs: new Set() })).toBe(true);
		});

		it('filters faction membership for moonsign/hexerei', () => {
			const hex = { ...IDENTITY, factionBuffs: new Set(['hexerei']) };
			expect(matchesIdentity(fischl, hex)).toBe(true);
			expect(matchesIdentity(ineffa, hex)).toBe(false);
			expect(matchesIdentity(plain, hex)).toBe(false);
		});

		it('stellar matches enablers AND gated-buff carriers, nobody else', () => {
			const st = { ...IDENTITY, factionBuffs: new Set(['stellar']) };
			expect(matchesIdentity(sandrone, st)).toBe(true);
			expect(matchesIdentity(diona, st)).toBe(true);
			expect(matchesIdentity(fischl, st)).toBe(false);
			expect(matchesIdentity(plain, st)).toBe(false);
		});

		it('ORs within the group', () => {
			const both = { ...IDENTITY, factionBuffs: new Set(['hexerei', 'stellar']) };
			expect(matchesIdentity(fischl, both)).toBe(true);
			expect(matchesIdentity(diona, both)).toBe(true);
			expect(matchesIdentity(ineffa, both)).toBe(false);
		});
	});
});

describe('regionChips', () => {
	it('lists each region once, the nations alphabetically and "Other" last', () => {
		const roster = ['Other', 'Snezhnaya', 'Liyue', 'Other', 'Mondstadt', 'Natlan'].map((region) =>
			entry({ region })
		);
		expect(regionChips([...roster, entry({})])).toEqual([
			'Liyue',
			'Mondstadt',
			'Natlan',
			'Snezhnaya',
			'Other'
		]);
	});
});
