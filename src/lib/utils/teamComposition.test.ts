import { describe, it, expect } from 'vitest';
import { computeTeamFactionCounts, type CompositionFields } from './teamComposition';

const c = (over: Partial<CompositionFields>): CompositionFields => ({ ...over });

describe('computeTeamFactionCounts', () => {
	it('counts each faction membership as +1', () => {
		const counts = computeTeamFactionCounts([
			c({ factions: ['moonsign'] }),
			c({ factions: ['moonsign'] }),
			c({ factions: ['hexerei'] }),
			null
		]);
		expect(counts.get('moonsign')).toBe(2);
		expect(counts.get('hexerei')).toBe(1);
	});

	it('sums factionContributions on top of membership (benediction raises the level)', () => {
		// One moonsign member + a benediction char that adds an extra level →
		// party Moonsign level 2 (Ascendant Gleam) with only one "member".
		const counts = computeTeamFactionCounts([
			c({ factions: ['moonsign'] }),
			c({ factions: ['moonsign'], factionContributions: { moonsign: 1 } })
		]);
		expect(counts.get('moonsign')).toBe(3); // 2 members + 1 contribution
	});

	it('a non-member contribution still counts toward the level', () => {
		const counts = computeTeamFactionCounts([c({ factionContributions: { moonsign: 1 } })]);
		expect(counts.get('moonsign')).toBe(1);
	});

	it('returns an empty map for an empty / factionless team', () => {
		expect(computeTeamFactionCounts([null, undefined, c({})]).size).toBe(0);
	});
});
