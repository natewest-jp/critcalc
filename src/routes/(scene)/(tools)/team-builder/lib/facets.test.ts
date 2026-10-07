import { describe, it, expect } from 'vitest';
import type { CharacterIndexEntry } from '$lib/types/character';
import type { CapabilitySummary } from '$lib/capabilities/deriveCapabilities';
import {
	buffFamilyOf,
	capMatchesFacet,
	conCapFor,
	facetBadges,
	matchesFacets,
	splitRoster,
	type FacetKey
} from './facets';

const cap = (partial: Partial<CapabilitySummary>): CapabilitySummary => ({
	kind: 'heal',
	minCon: 0,
	conditional: false,
	...partial
});

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

const IDENTITY = {
	elements: new Set<string>(),
	weapons: new Set<string>(),
	rarities: new Set<number>(),
	region: '',
	search: ''
};

describe('conCapFor', () => {
	it('maps modes to caps', () => {
		expect(conCapFor('c0', 4)).toBe(0);
		expect(conCapFor('c2', 0)).toBe(2);
		expect(conCapFor('c6', 0)).toBe(6);
		expect(conCapFor('mine', 4)).toBe(4);
		expect(conCapFor('mine', undefined)).toBe(0);
	});
});

describe('buffFamilyOf', () => {
	it('groups the corpus stat vocabulary', () => {
		expect(buffFamilyOf('atk%')).toBe('atk');
		expect(buffFamilyOf('em')).toBe('em');
		expect(buffFamilyOf('cryoCritDmg')).toBe('crit');
		expect(buffFamilyOf('lunarBloomDmgBonus')).toBe('dmg');
		expect(buffFamilyOf('burstFlatDmg')).toBe('dmg');
		expect(buffFamilyOf('hp%')).toBe('hpdef');
		expect(buffFamilyOf('healingBonus')).toBe('other');
	});
});

describe('capMatchesFacet', () => {
	it('excludes self-only buffs from ally-buff facets', () => {
		const selfCrit = cap({ kind: 'buff', detail: 'critRate', target: 'self' });
		const teamCrit = cap({ kind: 'buff', detail: 'critRate', target: 'team' });
		expect(capMatchesFacet(selfCrit, 'buff:crit')).toBe(false);
		expect(capMatchesFacet(teamCrit, 'buff:crit')).toBe(true);
	});

	it('matches plain kinds directly', () => {
		expect(capMatchesFacet(cap({ kind: 'shield' }), 'shield')).toBe(true);
		expect(capMatchesFacet(cap({ kind: 'heal' }), 'shield')).toBe(false);
	});
});

describe('matchesFacets', () => {
	const caps = [
		cap({ kind: 'heal', minCon: 0 }),
		cap({ kind: 'buff', detail: 'atk%', target: 'active', minCon: 4 })
	];

	it('ANDs facets and honors the constellation cap', () => {
		const facets = new Set<FacetKey>(['heal', 'buff:atk']);
		expect(matchesFacets(caps, facets, 6)).toBe(true);
		expect(matchesFacets(caps, facets, 0)).toBe(false); // atk buff gated at C4
		expect(matchesFacets(caps, new Set<FacetKey>(['heal']), 0)).toBe(true);
	});
});

describe('facetBadges', () => {
	it('folds buff stats into family badges keeping the lowest gate', () => {
		const badges = facetBadges([
			cap({ kind: 'buff', detail: 'critRate', target: 'team', minCon: 2, conditional: true }),
			cap({ kind: 'buff', detail: 'critDmg', target: 'team', minCon: 0, conditional: false }),
			cap({ kind: 'heal', minCon: 0 })
		]);
		expect(badges.map((b) => `${b.facet}@${b.minCon}`)).toEqual(['heal@0', 'buff:crit@0']);
	});
});

describe('splitRoster', () => {
	const healer = entry({ id: 'healer', displayName: 'Healer', caps: [cap({ kind: 'heal' })] });
	const dps = entry({ id: 'dps', caps: [] });
	// Uncurated + capless → genuinely unknown, buckets.
	const stub = entry({ id: 'stub', curated: false, caps: [] });
	// Uncurated but caps-COMPLETE (a frameless Stages-1-3 stub) → filters like anyone.
	const capStub = entry({ id: 'capstub', curated: false, caps: [cap({ kind: 'heal' })] });
	const roster = [healer, dps, stub, capStub];
	const conCap = () => 0;

	it('returns everyone when no capability facet is active', () => {
		const { matches, uncurated } = splitRoster(
			roster,
			{ identity: IDENTITY, facets: new Set() },
			conCap
		);
		expect(matches.map((e) => e.id)).toEqual(['healer', 'dps', 'stub', 'capstub']);
		expect(uncurated).toEqual([]);
	});

	it('buckets only capability-UNKNOWN characters; caps-complete stubs filter normally', () => {
		const { matches, uncurated } = splitRoster(
			roster,
			{ identity: IDENTITY, facets: new Set<FacetKey>(['heal']) },
			conCap
		);
		// healer + capStub (uncurated but caps-complete) both match the heal facet;
		// only stub (capless + uncurated) is genuinely unknown → bucketed. dps has
		// caps but no heal → a definitive no, silently excluded.
		expect(matches.map((e) => e.id)).toEqual(['healer', 'capstub']);
		expect(uncurated.map((e) => e.id)).toEqual(['stub']);
	});

	it('applies identity filters before bucketing', () => {
		const identity = { ...IDENTITY, search: 'healer' };
		const { matches, uncurated } = splitRoster(
			roster,
			{ identity, facets: new Set<FacetKey>(['heal']) },
			conCap
		);
		expect(matches.map((e) => e.id)).toEqual(['healer']);
		expect(uncurated).toEqual([]);
	});
});

describe('splitRoster — ownership view', () => {
	const owned = entry({ id: 'owned', displayName: 'Owned', caps: [] });
	const wished = entry({ id: 'wished', displayName: 'Wished', caps: [] });
	const neither = entry({ id: 'neither', displayName: 'Neither', caps: [] });
	const roster = [owned, wished, neither];
	const conCap = () => 0;
	const ownerOf = (id: string): 'owned' | 'wishlist' | undefined =>
		id === 'owned' ? 'owned' : id === 'wished' ? 'wishlist' : undefined;

	it("'all' keeps everyone", () => {
		const { matches } = splitRoster(
			roster,
			{ identity: IDENTITY, facets: new Set(), ownershipView: 'all' },
			conCap,
			ownerOf
		);
		expect(matches.map((e) => e.id)).toEqual(['owned', 'wished', 'neither']);
	});

	it("'owned' keeps only owned-marked characters", () => {
		const { matches } = splitRoster(
			roster,
			{ identity: IDENTITY, facets: new Set(), ownershipView: 'owned' },
			conCap,
			ownerOf
		);
		expect(matches.map((e) => e.id)).toEqual(['owned']);
	});

	it("'wishlist' keeps only wishlisted characters", () => {
		const { matches } = splitRoster(
			roster,
			{ identity: IDENTITY, facets: new Set(), ownershipView: 'wishlist' },
			conCap,
			ownerOf
		);
		expect(matches.map((e) => e.id)).toEqual(['wished']);
	});

	it('defaults to showing everyone when ownership args are omitted', () => {
		const { matches } = splitRoster(roster, { identity: IDENTITY, facets: new Set() }, conCap);
		expect(matches.map((e) => e.id)).toEqual(['owned', 'wished', 'neither']);
	});
});

describe("splitRoster — the audition's half of the finder", () => {
	const a = entry({ id: 'a', caps: [] });
	const b = entry({ id: 'b', caps: [] });
	const c = entry({ id: 'c', caps: [] });
	const roster = [a, b, c];
	const ownerOf = (id: string): 'owned' | undefined => (id === 'c' ? 'owned' : undefined);

	it('never offers an excluded character (the team)', () => {
		const { matches } = splitRoster(
			roster,
			{ identity: IDENTITY, facets: new Set(), exclude: new Set(['b']) },
			() => 0
		);
		expect(matches.map((e) => e.id)).toEqual(['a', 'c']);
	});

	it('ranks owned characters first, keeping roster order within each half', () => {
		const { matches } = splitRoster(
			roster,
			{ identity: IDENTITY, facets: new Set(), rank: 'ownedFirst' },
			() => 0,
			ownerOf
		);
		expect(matches.map((e) => e.id)).toEqual(['c', 'a', 'b']);
	});
});
