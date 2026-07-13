import { describe, expect, it } from 'vitest';
import type { CharacterIndexEntry } from '$lib/types/character';
import type { CapabilitySummary } from '$lib/capabilities/deriveCapabilities';
import { deriveCoverage, deriveResonances, parseTeamParam, serializeTeamParam } from './team';

const VALID = new Set(['bennett', 'jean', 'diona', 'gorou', 'xingqiu']);
const isValid = (id: string) => VALID.has(id);

describe('parseTeamParam / serializeTeamParam', () => {
	it('parses up to four known ids in order', () => {
		expect(parseTeamParam('bennett,jean,diona,gorou', isValid)).toEqual([
			'bennett',
			'jean',
			'diona',
			'gorou'
		]);
	});

	it('drops unknown ids, duplicates, blanks; ignores extras past four', () => {
		expect(parseTeamParam('bennett,,nobody,bennett,jean,diona,gorou,xingqiu', isValid)).toEqual([
			'bennett',
			'jean',
			'diona',
			'gorou'
		]);
	});

	it('null/empty param → four empty slots', () => {
		expect(parseTeamParam(null, isValid)).toEqual([null, null, null, null]);
		expect(parseTeamParam('', isValid)).toEqual([null, null, null, null]);
	});

	it('round-trips through serialize (filled slots only)', () => {
		const slots = parseTeamParam('bennett,jean', isValid);
		expect(serializeTeamParam(slots)).toBe('bennett,jean');
		expect(serializeTeamParam([null, null, null, null])).toBe('');
	});
});

describe('deriveResonances', () => {
	it('partial team → no resonance, needsFullTeam', () => {
		expect(deriveResonances(['pyro', 'pyro', null, null])).toEqual({
			active: [],
			needsFullTeam: true
		});
	});

	it('double pyro in a full team → Fervent Flames', () => {
		const { active, needsFullTeam } = deriveResonances(['pyro', 'pyro', 'hydro', 'cryo']);
		expect(needsFullTeam).toBe(false);
		expect(active.map((r) => r.label)).toEqual(['Fervent Flames']);
	});

	it('two pairs → both resonances', () => {
		const { active } = deriveResonances(['geo', 'geo', 'dendro', 'dendro']);
		expect(active.map((r) => r.label).sort()).toEqual(['Enduring Rock', 'Sprawling Greenery']);
	});

	it('four distinct elements → Protective Canopy', () => {
		const { active } = deriveResonances(['pyro', 'hydro', 'anemo', 'geo']);
		expect(active.map((r) => r.key)).toEqual(['canopy']);
	});
});

describe('deriveCoverage', () => {
	const entry = (
		id: string,
		caps: Partial<CapabilitySummary>[],
		curated = true
	): CharacterIndexEntry =>
		({
			id,
			displayName: id.toUpperCase(),
			curated,
			caps: caps.map((c) => ({ minCon: 0, conditional: false, ...c }))
		}) as CharacterIndexEntry;

	it('empty team → empty checklist', () => {
		expect(deriveCoverage([null, null, null, null], () => 6)).toEqual([]);
	});

	it('marks facets yes with providers, no otherwise (all-curated team)', () => {
		const cov = deriveCoverage(
			[entry('bennett', [{ kind: 'heal', target: 'active' }]), null, null, null],
			() => 0
		);
		const heal = cov.find((c) => c.facet === 'heal')!;
		const shield = cov.find((c) => c.facet === 'shield')!;
		expect(heal.state).toBe('yes');
		expect(heal.providers).toEqual(['BENNETT']);
		expect(shield.state).toBe('no');
	});

	it('respects per-member constellation caps', () => {
		const gorou = entry('gorou', [{ kind: 'heal', target: 'team', minCon: 4 }]);
		const capAt = (n: number) => deriveCoverage([gorou, null, null, null], () => n);
		expect(capAt(0).find((c) => c.facet === 'heal')!.state).toBe('no');
		expect(capAt(4).find((c) => c.facet === 'heal')!.state).toBe('yes');
	});

	it('an uncurated member turns absences into unknown, not no', () => {
		const cov = deriveCoverage(
			[
				entry('bennett', [{ kind: 'heal', target: 'active' }]),
				entry('stub', [], false),
				null,
				null
			],
			() => 0
		);
		expect(cov.find((c) => c.facet === 'heal')!.state).toBe('yes');
		expect(cov.find((c) => c.facet === 'shield')!.state).toBe('unknown');
	});
});
