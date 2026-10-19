import { describe, expect, it } from 'vitest';
import { getAllCharacterIndex } from '$lib/data/characterLookup';
import {
	checkNamedElsewhere,
	checkShift,
	deriveResonances,
	parseTeamParam,
	swapDelta,
	swapSections
} from './team';

const VALID = new Set(['bennett', 'jean', 'diona', 'gorou', 'xingqiu']);
const isValid = (id: string) => VALID.has(id);

describe('parseTeamParam', () => {
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

describe('swapDelta — what a swap does to the TEAM', () => {
	const c0 = () => 0;
	const check = (tag: 'favoured' | 'disfavoured', en: string) => ({ tag, text: { en } });

	it('counts a TEAMMATE going dark as a loss (the ripple)', () => {
		// Chevreuse's ATK buff and RES shred need a Pyro + Electro party; Furina
		// for Bennett brings Hydro, so they go out though Chevreuse never moved.
		const d = swapDelta(
			['chevreuse', 'fischl', 'xiangling', 'bennett'],
			['chevreuse', 'fischl', 'xiangling', 'furina'],
			c0
		);
		const lost = d.items.flatMap((i) => (i.kind === 'facet' && i.sign < 0 ? [i.facet] : []));
		expect(lost).toEqual(expect.arrayContaining(['buff:atk', 'resShred']));
		expect(d.tier).toBe('reactions');
	});

	it('resonance is part of the delta (⚓ Nate 2026-10-13)', () => {
		// Two Pyro become one: Fervent Flames goes, and Overloaded arrives.
		const d = swapDelta(
			['bennett', 'xiangling', 'xingqiu', 'sucrose'],
			['bennett', 'fischl', 'xingqiu', 'sucrose'],
			c0
		);
		expect(d.items).toContainEqual(
			expect.objectContaining({ kind: 'resonance', sign: -1, key: 'pyro' })
		);
		expect(d.tier).toBe('reactions');
	});

	it('the same element in and out is a trade, not an archetype change', () => {
		const d = swapDelta(
			['xingqiu', 'xiangling', 'bennett', 'sucrose'],
			['xingqiu', 'xiangling', 'bennett', 'kaedehara_kazuha'],
			c0
		);
		expect(d.items.some((i) => i.kind === 'reaction' || i.kind === 'resonance')).toBe(false);
		expect(d.items).toContainEqual({ kind: 'facet', sign: -1, facet: 'buff:em' });
		expect(d.tier).toBe('trades');
	});

	it('a check enters the delta only when no capability or reaction names it', () => {
		expect(checkNamedElsewhere(check('favoured', 'Shields'))).toBe(true);
		expect(checkNamedElsewhere(check('favoured', '{sprite:11034} reactions | Shields'))).toBe(true);
		expect(checkNamedElsewhere(check('favoured', "Nightsoul's Blessing Characters"))).toBe(false);
		expect(checkNamedElsewhere(check('favoured', '{sprite:11003} characters | Shields'))).toBe(
			false
		);
	});

	it('a check shift is the team standing better or worse with the boss', () => {
		expect(checkShift(check('favoured', 'x'), 'unmet', 'met')).toBe(1);
		expect(checkShift(check('disfavoured', 'x'), 'unmet', 'met')).toBe(-1);
		expect(checkShift(check('disfavoured', 'x'), 'met', 'unmet')).toBe(1);
		expect(checkShift(check('favoured', 'x'), 'unknown', 'met')).toBe(0);
	});

	it('sections skip the team, and run keeps → trades → reactions', () => {
		const team = ['xingqiu', 'xiangling', 'bennett', 'sucrose'];
		const roster = getAllCharacterIndex();
		const sections = swapSections(roster, team, 3, c0);
		const ids = sections.flatMap((s) => s.entries.map((e) => e.id));
		for (const id of team) expect(ids).not.toContain(id);
		const order = ['keeps', 'trades', 'reactions', 'uncurated'];
		const tiers = sections.map((s) => order.indexOf(s.tier));
		expect(tiers).toEqual([...tiers].sort((x, y) => x - y));
	});

	it('⚓ one Traveler: a variant is offered only for the Traveler’s own slot', () => {
		const team = ['traveler_anemo', 'xiangling', 'bennett', 'sucrose'];
		const roster = getAllCharacterIndex();
		const offered = (slot: number) =>
			swapSections(roster, team, slot, c0).flatMap((s) => s.entries.map((e) => e.id));
		expect(offered(3)).not.toContain('traveler_cryo');
		expect(offered(0)).toContain('traveler_cryo');
		expect(offered(0)).not.toContain('traveler_anemo');
	});
});
