import { describe, it, expect } from 'vitest';
import type { CharacterIndexEntry } from '$lib/types/character';
import type { CapabilitySummary } from '$lib/capabilities/deriveCapabilities';
import { buildAtlasCards } from './atlas';

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

describe('buildAtlasCards', () => {
	const bennett = entry({ id: 'bennett', element: 'pyro', caps: [cap({ kind: 'heal' })] });
	const jean = entry({ id: 'jean', element: 'anemo', caps: [cap({ kind: 'heal' })] });
	const gorou = entry({ id: 'gorou', element: 'geo', caps: [cap({ kind: 'heal', minCon: 4 })] });
	const stub = entry({
		id: 'stub',
		curated: false,
		element: 'pyro',
		caps: [cap({ kind: 'heal' })]
	});
	const roster = [bennett, jean, gorou, stub];

	it('counts curated providers per facet, ignoring uncurated stubs', () => {
		const cards = buildAtlasCards(
			roster,
			() => 6,
			() => false
		);
		const heal = cards.find((c) => c.facet === 'heal');
		expect(heal?.providerCount).toBe(3); // bennett, jean, gorou — not the stub
	});

	it('honors the constellation cap (Gorou heals only at C4)', () => {
		const atC0 = buildAtlasCards(
			roster,
			() => 0,
			() => false
		).find((c) => c.facet === 'heal');
		expect(atC0?.providerCount).toBe(2); // gorou gated out at C0
	});

	it('counts owned providers from the ownership predicate', () => {
		const owned = new Set(['bennett']);
		const heal = buildAtlasCards(
			roster,
			() => 6,
			(id) => owned.has(id)
		).find((c) => c.facet === 'heal');
		expect(heal?.ownedCount).toBe(1);
	});

	it('breaks providers down by element in wheel order', () => {
		const heal = buildAtlasCards(
			roster,
			() => 6,
			() => false
		).find((c) => c.facet === 'heal');
		expect(heal?.byElement).toEqual([
			{ element: 'pyro', count: 1 },
			{ element: 'anemo', count: 1 },
			{ element: 'geo', count: 1 }
		]);
	});

	it('omits facets with no providers', () => {
		const cards = buildAtlasCards(
			roster,
			() => 6,
			() => false
		);
		expect(cards.some((c) => c.facet === 'shield')).toBe(false);
	});
});
