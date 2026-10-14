import { describe, it, expect } from 'vitest';
import type { CharacterIndexEntry, CharacterRoles } from '$lib/types/character';
import type { CapabilitySummary } from '$lib/capabilities/deriveCapabilities';
import { buildRoleSections, categoryOf } from './atlas';
import { ROLE_CATEGORIES } from '$lib/capabilities/roles';

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

const support = ROLE_CATEGORIES.find((c) => c.key === 'support')!;
const onFieldDps = ROLE_CATEGORIES.find((c) => c.key === 'onField-dps')!;

describe('categoryOf — is the role filter exactly one card?', () => {
	it('names the card a function-only filter is', () => {
		expect(categoryOf(new Set(), new Set(['support']))?.key).toBe('support');
	});
	it('names a position-scoped DPS card only with its position', () => {
		expect(categoryOf(new Set(['onField']), new Set(['dps']))?.key).toBe('onField-dps');
		expect(categoryOf(new Set(), new Set(['dps']))).toBeNull();
	});
	it('is no card for a mixed filter', () => {
		expect(categoryOf(new Set(), new Set(['support', 'survivability']))).toBeNull();
		expect(categoryOf(new Set(['onField']), new Set(['support']))).toBeNull();
	});
});

describe('buildRoleSections', () => {
	const roles: Record<string, CharacterRoles> = {
		bennett: { position: ['offField'], function: ['support', 'survivability'] },
		gorou: { position: ['offField'], function: ['support'] },
		oddity: { position: ['offField'], function: ['support'] },
		diluc: { position: ['onField'], function: ['dps'] },
		klee: { position: ['onField'], function: ['dps'] }
	};
	const rolesOf = (id: string) => roles[id];
	const bennett = entry({
		id: 'bennett',
		element: 'pyro',
		caps: [cap({ kind: 'buff', detail: 'atk', target: 'team' })]
	});
	const gorou = entry({
		id: 'gorou',
		element: 'geo',
		caps: [cap({ kind: 'buff', detail: 'def', target: 'team', minCon: 0 })]
	});
	// A Support by Genshin's table whose kit derives no Support facet.
	const oddity = entry({ id: 'oddity', element: 'cryo', caps: [] });

	it('groups a support role by the facets under it', () => {
		const sections = buildRoleSections(support, [bennett, gorou, oddity], rolesOf, () => 6);
		expect(sections.find((s) => s.key === 'buff:atk')?.entries.map((e) => e.id)).toEqual([
			'bennett'
		]);
		expect(sections.find((s) => s.key === 'buff:hpdef')?.entries.map((e) => e.id)).toEqual([
			'gorou'
		]);
	});

	it('keeps a member who provides none of the facets, in a section of their own', () => {
		const sections = buildRoleSections(support, [bennett, gorou, oddity], rolesOf, () => 6);
		expect(sections.at(-1)).toMatchObject({ key: 'rest', label: 'Also in this role' });
		expect(sections.at(-1)!.entries.map((e) => e.id)).toEqual(['oddity']);
	});

	it('groups a DPS role by element, in wheel order', () => {
		const diluc = entry({ id: 'diluc', element: 'pyro' });
		const klee = entry({ id: 'klee', element: 'pyro' });
		const sections = buildRoleSections(onFieldDps, [diluc, klee], rolesOf, () => 6);
		expect(sections).toHaveLength(1);
		expect(sections[0]).toMatchObject({ key: 'pyro', element: 'pyro' });
		expect(sections[0].entries).toHaveLength(2);
	});
});
