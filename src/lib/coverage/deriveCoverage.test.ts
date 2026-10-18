import { describe, it, expect } from 'vitest';
import type { CharacterData } from '$lib/types/character';
import {
	COVERAGE_SEGMENTS,
	coverageCount,
	decodeCoverage,
	deriveCoverage,
	encodeCoverage
} from './deriveCoverage';
import { lintCharacter } from '$lib/utils/characterLint';

import bennett from '$lib/data/characters/bennett.json';
import linnea from '$lib/data/characters/linnea.json';

/** A small, fully framed kit; each test overrides one piece of it. */
function char(over: Partial<CharacterData> = {}): CharacterData {
	return {
		id: 'test',
		name: 'Test',
		displayName: 'Test',
		rarity: 4,
		element: 'pyro',
		weapon: 'sword',
		abilities: [
			{
				id: 'n',
				name: 'Normal',
				abilityType: 'normal',
				input: ['N'],
				hits: [{ frames: { anim: 30, hit: 12 } }],
				chargeFrames: { anim: 50, hit: 20 },
				plungeFrames: { anim: 60, hit: 40 }
			},
			{
				id: 'e',
				name: 'Skill',
				abilityType: 'skill',
				input: ['E'],
				frames: { anim: 40 },
				cooldown: 10,
				application: [{ frame: 20, units: 1 }]
			},
			{
				id: 'q',
				name: 'Burst',
				abilityType: 'burst',
				input: ['Q'],
				frames: { anim: 90 },
				cooldown: 15,
				energyCost: 60,
				application: [{ frame: 60, units: 2 }]
			}
		],
		passives: [
			{ id: 'a1', name: 'A1', abilityType: 'passive' },
			{ id: 'a4', name: 'A4', abilityType: 'passive' }
		],
		constellations: [1, 2, 3, 4, 5, 6].map((level) => ({
			id: `c${level}`,
			name: `C${level}`,
			abilityType: 'constellation',
			constellationLevel: level
		})),
		...over
	} as CharacterData;
}

function withAbility(c: CharacterData, id: string, patch: Record<string, unknown>): CharacterData {
	const all = [...c.abilities, ...c.passives, ...c.constellations];
	Object.assign(all.find((a) => a.id === id)!, patch);
	return c;
}

const BUFF = {
	type: 'buff',
	trigger: { type: 'onCast', ability: 'skill' },
	target: 'self',
	stat: 'atkPercent',
	value: 20,
	duration: 10
};

describe('deriveCoverage — timing', () => {
	it('framed maps from gcsim are lit', () => {
		const cov = deriveCoverage(char());
		for (const k of ['N.timing', 'C.timing', 'P.timing', 'E.timing', 'Q.timing'] as const)
			expect(cov[k].state, k).toBe('lit');
	});

	it('frames from an unmerged gcsim PR are provisional', () => {
		const cov = deriveCoverage(
			char({ meta: { source: 'genshin-db', generatedAt: '', framesSource: 'gcsim-pr' } })
		);
		expect(cov['E.timing']).toMatchObject({ state: 'provisional' });
		expect(cov['E.timing'].lines[0].code).toBe('frames.gcsimPr');
	});

	it('an absent charged attack or plunge is a stand-in, not a gap', () => {
		const c = withAbility(char(), 'n', { chargeFrames: undefined, plungeFrames: undefined });
		const cov = deriveCoverage(c);
		expect(cov['C.timing'].lines[0]).toMatchObject({
			code: 'charged.generic',
			state: 'provisional'
		});
		expect(cov['P.timing'].lines[0]).toMatchObject({
			code: 'plunge.generic',
			state: 'provisional'
		});
	});

	it('a frameless kit is missing everywhere it is timed', () => {
		const c = withAbility(char(), 'n', { hits: [{}] });
		withAbility(c, 'e', { frames: undefined });
		const cov = deriveCoverage(c);
		expect(cov['N.timing'].state).toBe('missing');
		expect(cov['E.timing'].state).toBe('missing');
	});
});

describe('deriveCoverage — application', () => {
	it('a physical swing applies nothing: n/a, never missing', () => {
		expect(deriveCoverage(char())['N.application'].state).toBe('na');
	});

	it('a catalyst swing with a stated landing is lit; without one it is provisional', () => {
		const lit = deriveCoverage(char({ weapon: 'catalyst' }));
		expect(lit['N.application'].state).toBe('lit');
		const soft = withAbility(char({ weapon: 'catalyst' }), 'n', {
			hits: [{ frames: { anim: 30 } }]
		});
		expect(deriveCoverage(soft)['N.application'].lines[0].code).toBe('app.atSwingEnd');
	});

	it('an empty application[] is a MEASURED "applies nothing" and is lit', () => {
		const c = withAbility(char(), 'e', { application: [] });
		expect(deriveCoverage(c)['E.application'].lines[0]).toMatchObject({
			code: 'app.appliesNothing',
			state: 'lit'
		});
	});

	it('an absent application[] is a stand-in; an entry without units is too', () => {
		expect(
			deriveCoverage(withAbility(char(), 'e', { application: undefined }))['E.application'].lines[0]
				.code
		).toBe('app.atCast');
		expect(
			deriveCoverage(withAbility(char(), 'e', { application: [{ frame: 10 }] }))['E.application']
				.lines[0].code
		).toBe('app.unitsUnmeasured');
	});

	it('a non-hitting cast is n/a', () => {
		const c = withAbility(char(), 'e', { nonHitting: true });
		expect(deriveCoverage(c)['E.application'].state).toBe('na');
	});
});

describe('deriveCoverage — grants', () => {
	it('an effect-less host with no statement is MISSING (the honest default)', () => {
		expect(deriveCoverage(char()).A1.state).toBe('missing');
	});

	it('authored effects are lit', () => {
		const c = withAbility(char(), 'a1', { effects: [BUFF] });
		expect(deriveCoverage(c).A1.state).toBe('lit');
	});

	it('nothingToModel is n/a and notModeled carries its reason', () => {
		const c = withAbility(char(), 'a1', { nothingToModel: true });
		withAbility(c, 'c2', { notModeled: { reason: 'We don’t model co-op.' } });
		const cov = deriveCoverage(c);
		expect(cov.A1.state).toBe('na');
		expect(cov.C2).toMatchObject({ state: 'notModeled', reason: 'We don’t model co-op.' });
	});

	it('a constellation authored as a gated effect on another host is lit', () => {
		const gated = { ...BUFF, conditions: { type: 'constellation', level: 4 } };
		const c = withAbility(char(), 'e', { effects: [gated] });
		const cov = deriveCoverage(c);
		expect(cov.C4.lines[0].code).toBe('grants.elsewhere');
		expect(cov.C4.hosts).toContain('e');
	});

	it('modeledBy lights a host the planner draws through another one', () => {
		const c = withAbility(char(), 'a4', { modeledBy: 'e' });
		expect(deriveCoverage(c).A4).toMatchObject({ state: 'lit', hosts: ['a4', 'e'] });
	});

	it('a ⛔ NOT-gated condition is not evidence the constellation is authored', () => {
		const pre = {
			...BUFF,
			conditions: { type: 'not', condition: { type: 'constellation', level: 4 } }
		};
		const c = withAbility(char(), 'e', { effects: [pre] });
		expect(deriveCoverage(c).C4.state).toBe('missing');
	});

	it('a modifier whose source names a passive lights it (Bennett’s Rekindle)', () => {
		const cov = deriveCoverage(bennett as unknown as CharacterData);
		expect(cov.A1.lines[0].code).toBe('grants.elsewhere');
	});

	it('an effect on a trigger with no reader is a stand-in', () => {
		const c = withAbility(char(), 'a4', {
			effects: [{ ...BUFF, trigger: { type: 'onHeal' } }]
		});
		expect(deriveCoverage(c).A4.lines[0]).toMatchObject({
			code: 'grants.noReader',
			state: 'provisional'
		});
	});

	it('a summon with no damage carried anywhere is a stand-in until it says it deals nothing', () => {
		const summon = { label: 'Field', duration: 10 };
		const silent = withAbility(char(), 'e', { summons: [{ ...summon }], application: [] });
		expect(deriveCoverage(silent)['E.grants'].lines[0].code).toBe('grants.summonSilent');
		const stated = withAbility(char(), 'e', {
			summons: [{ ...summon, dealsNothing: true }],
			application: []
		});
		expect(deriveCoverage(stated)['E.grants'].state).toBe('lit');
		// Linnea's Lumi WAS one of the known tick gaps (docs/summon-tick-gaps-round.md);
		// her strikes are a sequence since the Lumi round, 2026-10-17, and a strike
		// step is damage carried.
		expect(deriveCoverage(linnea as unknown as CharacterData)['E.grants'].state).toBe('lit');
	});

	it('a third passive rides the extra column; none is n/a', () => {
		expect(deriveCoverage(char()).extra.state).toBe('na');
		const c = char();
		c.passives.push({ id: 'x', name: 'Crafting', abilityType: 'passive', nothingToModel: true });
		expect(deriveCoverage(c).extra.state).toBe('na');
		c.passives[2] = { id: 'x', name: 'Radiance', abilityType: 'passive' };
		expect(deriveCoverage(c).extra.state).toBe('missing');
	});
});

describe('deriveCoverage — the compact form', () => {
	it('round-trips through the index string, one character per segment', () => {
		const cov = deriveCoverage(bennett as unknown as CharacterData);
		const code = encodeCoverage(cov);
		expect(code).toHaveLength(COVERAGE_SEGMENTS.length);
		expect(decodeCoverage(code)).toEqual(COVERAGE_SEGMENTS.map((s) => cov[s.key].state));
	});

	it('the count leaves n/a and rulings out of the denominator', () => {
		expect(coverageCount(['lit', 'na', 'notModeled', 'missing', 'provisional'])).toEqual({
			lit: 1,
			of: 3
		});
	});
});

describe('the coverage statements — seeded negatives (lint E.29–E.31)', () => {
	const checks = (c: CharacterData) =>
		lintCharacter(c)
			.filter((i) => i.severity === 'strict')
			.map((i) => i.check);

	it('refuses notModeled beside authored effects', () => {
		const c = withAbility(char(), 'a1', { effects: [BUFF], notModeled: { reason: 'Co-op only.' } });
		expect(checks(c)).toContain('not-modeled-with-effects');
	});

	it('refuses nothingToModel beside authored effects', () => {
		const c = withAbility(char(), 'a1', { effects: [BUFF], nothingToModel: true });
		expect(checks(c)).toContain('nothing-to-model-with-effects');
	});

	it('refuses a modeledBy that points at no other host', () => {
		expect(checks(withAbility(char(), 'a4', { modeledBy: 'nope' }))).toContain('modeled-by-target');
		expect(checks(withAbility(char(), 'a4', { modeledBy: 'a4' }))).toContain('modeled-by-target');
	});

	it('refuses a framesSource outside the vocabulary', () => {
		const c = char({
			meta: { source: 'genshin-db', generatedAt: '', framesSource: 'gcsim main' as never }
		});
		expect(checks(c)).toContain('frames-source-value');
	});

	it('refuses dealsNothing beside a damage effect', () => {
		const c = withAbility(char(), 'e', {
			summons: [
				{
					label: 'Field',
					duration: 10,
					dealsNothing: true,
					effects: [
						{ type: 'damage', trigger: { type: 'summonTick', interval: 1 }, target: 'enemy' }
					]
				}
			]
		});
		expect(checks(c)).toContain('deals-nothing-with-damage');
	});
});
