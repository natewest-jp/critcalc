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
		expect(conCapFor('max', 0)).toBe(6);
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
	const stub = entry({ id: 'stub', curated: false, caps: [] });
	const roster = [healer, dps, stub];
	const conCap = () => 0;

	it('returns everyone when no capability facet is active', () => {
		const { matches, uncurated } = splitRoster(roster, IDENTITY, new Set(), conCap);
		expect(matches.map((e) => e.id)).toEqual(['healer', 'dps', 'stub']);
		expect(uncurated).toEqual([]);
	});

	it('buckets uncurated characters instead of dropping them under capability facets', () => {
		const { matches, uncurated } = splitRoster(
			roster,
			IDENTITY,
			new Set<FacetKey>(['heal']),
			conCap
		);
		expect(matches.map((e) => e.id)).toEqual(['healer']);
		expect(uncurated.map((e) => e.id)).toEqual(['stub']);
	});

	it('applies identity filters before bucketing', () => {
		const identity = { ...IDENTITY, search: 'healer' };
		const { matches, uncurated } = splitRoster(
			roster,
			identity,
			new Set<FacetKey>(['heal']),
			conCap
		);
		expect(matches.map((e) => e.id)).toEqual(['healer']);
		expect(uncurated).toEqual([]);
	});
});
