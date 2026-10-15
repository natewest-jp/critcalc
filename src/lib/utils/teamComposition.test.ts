import { describe, it, expect } from 'vitest';
import {
	computeTeamFactionCounts,
	deriveTeamComposition,
	type CompositionFields
} from './teamComposition';
import { getCharacterIndexEntry } from '$lib/data/characterLookup';

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

// The Ascendant Gleam lane draws a row per `nonMoonsignSlots` entry, gated on
// `hasAscendantGleam`. The planner hands composition its four slots as they
// are, and an empty one is the id 'blank' (which loads a payload), not null.
describe('deriveTeamComposition — who receives Ascendant Gleam', () => {
	const comp = (...ids: string[]) =>
		deriveTeamComposition(ids.map((id) => getCharacterIndexEntry(id)));

	it('a Moonsign pair beside two empty slots has Gleam and nobody to receive it', () => {
		const t = comp('columbina', 'ineffa', 'blank', 'blank');
		expect(t.hasAscendantGleam).toBe(true);
		expect(t.nonMoonsignSlots).toEqual([]);
	});

	it('an all-Moonsign team has nobody to receive it', () => {
		expect(comp('columbina', 'ineffa', 'flins', 'lauma').nonMoonsignSlots).toEqual([]);
	});

	it('names the real non-Moonsign members, and skips the empty slot', () => {
		const t = comp('columbina', 'bennett', 'ineffa', 'blank');
		expect(t.hasAscendantGleam).toBe(true);
		expect(t.nonMoonsignSlots).toEqual([1]);
	});
});
