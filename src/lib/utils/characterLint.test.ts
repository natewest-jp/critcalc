/**
 * src/lib/utils/characterLint.test.ts
 *
 * Curation lint test. Loads every committed character JSON via the same
 * import.meta.glob path the app uses, scopes to curated characters via the
 * isCurated heuristic, and asserts no strict issues.
 *
 * Warn issues are printed to console.warn but pass the test. They become
 * strict over time as the schema and curation conventions tighten.
 */

import { describe, it, expect } from 'vitest';
import { getAllCharacters } from '$lib/data/characterLookup';
import { isCurated, lintCharacter, type LintIssue } from './characterLint';
import type { CharacterData } from '$lib/types/character';
import { evalTriggerFilter, getDefaultDamageTag } from '$lib/types/ability';

const all = getAllCharacters();
const curated = all.filter(isCurated);

function formatIssues(issues: LintIssue[]): string {
	return issues
		.map((i) => `  [${i.check}]${i.abilityId ? ` ${i.abilityId}:` : ''} ${i.message}`)
		.join('\n');
}

describe('character lint', () => {
	it('finds curated characters in the corpus', () => {
		expect(curated.length).toBeGreaterThan(0);
	});

	const allIssues: LintIssue[] = [];
	for (const c of curated) {
		allIssues.push(...lintCharacter(c));
	}

	const byChar = new Map<string, LintIssue[]>();
	for (const issue of allIssues) {
		const list = byChar.get(issue.charId) ?? [];
		list.push(issue);
		byChar.set(issue.charId, list);
	}

	for (const c of curated) {
		const issues = byChar.get(c.id) ?? [];
		const strict = issues.filter((i) => i.severity === 'strict');
		const warn = issues.filter((i) => i.severity === 'warn');

		describe(c.id, () => {
			it('has no strict lint issues', () => {
				if (strict.length > 0) {
					throw new Error(`${c.id}: ${strict.length} strict issue(s):\n${formatIssues(strict)}`);
				}
				if (warn.length > 0) {
					console.warn(`[lint:warn] ${c.id} (${warn.length} warning(s)):\n${formatIssues(warn)}`);
				}
				expect(strict.length).toBe(0);
			});
		});
	}
});

// ---------------------------------------------------------------------------
// Synthetic lint coverage — verify new rules actually fire when violated.
// These cases would never appear in real JSONs (they'd be caught by review),
// but the synthetic shapes keep the lint rules honest under refactors.
// ---------------------------------------------------------------------------

/** Minimal curated-character shape: normal hits + skill frames so isCurated
 *  passes. Tests inject violating effects on top. */
function makeStubCharacter(extra: Partial<CharacterData> = {}): CharacterData {
	return {
		id: 'lintstub',
		name: 'Stub',
		displayName: 'Stub',
		element: 'pyro',
		weapon: 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'lintstub__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			},
			{
				id: 'lintstub__skill__cast',
				name: 'Cast',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 20 },
				cooldown: 10
			}
		],
		passives: [],
		constellations: [],
		...extra
	} as CharacterData;
}

describe('summonTick lint rules (P3)', () => {
	it('flags summonTick with non-positive interval', () => {
		const c = makeStubCharacter({
			abilities: [
				{
					id: 'lintstub__normal__attack',
					name: 'Attack',
					input: ['N'],
					abilityType: 'normal',
					hits: [{ frames: { swap: 10 } }]
				},
				{
					id: 'lintstub__skill__cast',
					name: 'Cast',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 20 },
					cooldown: 10,
					summons: [
						{
							label: 'Doll',
							duration: 10,
							effects: [
								{
									type: 'damage',
									target: 'enemy',
									trigger: { type: 'summonTick', interval: 0 },
									scaling: 100,
									stat: 'atk'
								}
							]
						}
					]
				}
			]
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'summon-tick-interval-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags summonTick used on a regular ability effect (must live in summons[])', () => {
		const c = makeStubCharacter({
			abilities: [
				{
					id: 'lintstub__normal__attack',
					name: 'Attack',
					input: ['N'],
					abilityType: 'normal',
					hits: [{ frames: { swap: 10 } }]
				},
				{
					id: 'lintstub__skill__cast',
					name: 'Cast',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 20 },
					cooldown: 10,
					effects: [
						{
							type: 'damage',
							target: 'enemy',
							trigger: { type: 'summonTick', interval: 1 },
							scaling: 100,
							stat: 'atk'
						}
					]
				}
			]
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'summon-tick-misplaced');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts a valid summonTick effect on summons[]', () => {
		const c = makeStubCharacter({
			abilities: [
				{
					id: 'lintstub__normal__attack',
					name: 'Attack',
					input: ['N'],
					abilityType: 'normal',
					hits: [{ frames: { swap: 10 } }]
				},
				{
					id: 'lintstub__skill__cast',
					name: 'Cast',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 20 },
					cooldown: 10,
					summons: [
						{
							label: 'Doll',
							duration: 10,
							effects: [
								{
									type: 'damage',
									target: 'enemy',
									trigger: { type: 'summonTick', interval: 1.5, firstTickDelay: 1 },
									scaling: 100,
									stat: 'atk'
								}
							]
						}
					]
				}
			]
		});
		const issues = lintCharacter(c);
		const tickIssues = issues.filter((i) => i.check.startsWith('summon-tick'));
		expect(tickIssues).toEqual([]);
	});
});

describe('stacks condition lint rules', () => {
	it('flags stacks condition with empty key', () => {
		const c = makeStubCharacter({
			abilities: [
				{
					id: 'lintstub__normal__attack',
					name: 'Attack',
					input: ['N'],
					abilityType: 'normal',
					hits: [{ frames: { swap: 10 } }]
				},
				{
					id: 'lintstub__skill__cast',
					name: 'Cast',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 20 },
					cooldown: 10,
					conditions: { type: 'stacks', key: '', min: 1 }
				}
			]
		} as unknown as Partial<CharacterData>);
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'stacks-key-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags stacks condition with negative min', () => {
		const c = makeStubCharacter({
			abilities: [
				{
					id: 'lintstub__normal__attack',
					name: 'Attack',
					input: ['N'],
					abilityType: 'normal',
					hits: [{ frames: { swap: 10 } }]
				},
				{
					id: 'lintstub__skill__cast',
					name: 'Cast',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 20 },
					cooldown: 10,
					conditions: { type: 'stacks', key: 'seal', min: -1 }
				}
			]
		} as unknown as Partial<CharacterData>);
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'stacks-min-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags stacks condition with max < min', () => {
		const c = makeStubCharacter({
			abilities: [
				{
					id: 'lintstub__normal__attack',
					name: 'Attack',
					input: ['N'],
					abilityType: 'normal',
					hits: [{ frames: { swap: 10 } }]
				},
				{
					id: 'lintstub__skill__cast',
					name: 'Cast',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 20 },
					cooldown: 10,
					conditions: { type: 'stacks', key: 'seal', min: 4, max: 2 }
				}
			]
		} as unknown as Partial<CharacterData>);
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'stacks-max-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts a valid stacks condition on an ability', () => {
		const c = makeStubCharacter({
			abilities: [
				{
					id: 'lintstub__normal__attack',
					name: 'Attack',
					input: ['N'],
					abilityType: 'normal',
					hits: [{ frames: { swap: 10 } }]
				},
				{
					id: 'lintstub__skill__cast',
					name: 'Cast',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 20 },
					cooldown: 10,
					conditions: { type: 'stacks', key: 'declension', min: 4, max: 4 }
				}
			]
		} as unknown as Partial<CharacterData>);
		const issues = lintCharacter(c);
		const stackIssues = issues.filter((i) => i.check.startsWith('stacks-'));
		expect(stackIssues).toEqual([]);
	});
});

describe('perStack BuffValue lint rules', () => {
	function makeStubWithPassiveBuff(value: unknown): CharacterData {
		return makeStubCharacter({
			passives: [
				{
					id: 'lintstub__passive__perstack',
					name: 'PerStack Passive',
					abilityType: 'passive',
					effects: [
						{
							type: 'buff',
							target: 'self',
							trigger: { type: 'onCast', ability: 'skill' },
							duration: 1,
							source: 'character',
							stat: 'critRate',
							value,
							snapshottable: false
						}
					]
				}
			]
		} as unknown as Partial<CharacterData>);
	}

	it('flags perStack with empty key', () => {
		const c = makeStubWithPassiveBuff({ type: 'perStack', key: '', per: 4 });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'perstack-key-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags perStack with non-numeric per', () => {
		const c = makeStubWithPassiveBuff({ type: 'perStack', key: 'declension', per: '4' });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'perstack-per-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags perStack with non-positive maxStacks', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'declension',
			per: 4,
			maxStacks: 0
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'perstack-maxstacks-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts a valid perStack value', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'declension',
			per: 4,
			maxStacks: 4
		});
		const issues = lintCharacter(c);
		const perStackIssues = issues.filter((i) => i.check.startsWith('perstack-'));
		expect(perStackIssues).toEqual([]);
	});

	it('accepts perStack with scaling per (number-or-object form)', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'huntersExperience',
			per: { stat: 'atk', ratio: 320 },
			maxStacks: 2
		});
		const issues = lintCharacter(c);
		const perStackIssues = issues.filter((i) => i.check.startsWith('perstack-'));
		expect(perStackIssues).toEqual([]);
	});

	it('flags perStack with scaling per missing stat', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'huntersExperience',
			per: { ratio: 320 }
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'perstack-per-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags perStack with scaling per having invalid stat', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'huntersExperience',
			per: { stat: 'critRate', ratio: 320 }
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'perstack-per-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags perStack with scaling per non-numeric ratio', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'huntersExperience',
			per: { stat: 'atk', ratio: '320' }
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'perstack-per-invalid');
		expect(hit?.severity).toBe('strict');
	});
});

describe('decaying BuffValue lint rules', () => {
	function makeStubWithPassiveBuff(value: unknown): CharacterData {
		return makeStubCharacter({
			passives: [
				{
					id: 'lintstub__passive__decaying',
					name: 'Decaying Passive',
					abilityType: 'passive',
					effects: [
						{
							type: 'buff',
							target: 'active',
							trigger: { type: 'onCast', ability: 'burst' },
							duration: 20,
							source: 'character',
							stat: 'allDmgBonus',
							value,
							snapshottable: false
						}
					]
				}
			]
		} as unknown as Partial<CharacterData>);
	}

	it('flags decaying with non-numeric startValue', () => {
		const c = makeStubWithPassiveBuff({ type: 'decaying', startValue: '40' });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'decaying-startvalue-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags decaying with non-numeric endValue', () => {
		const c = makeStubWithPassiveBuff({ type: 'decaying', startValue: 40, endValue: 'zero' });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'decaying-endvalue-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts a valid decaying value (default endValue)', () => {
		const c = makeStubWithPassiveBuff({ type: 'decaying', startValue: 40 });
		const issues = lintCharacter(c);
		const decayIssues = issues.filter((i) => i.check.startsWith('decaying-'));
		expect(decayIssues).toEqual([]);
	});

	it('accepts a valid decaying value with explicit endValue', () => {
		const c = makeStubWithPassiveBuff({ type: 'decaying', startValue: 40, endValue: 5 });
		const issues = lintCharacter(c);
		const decayIssues = issues.filter((i) => i.check.startsWith('decaying-'));
		expect(decayIssues).toEqual([]);
	});
});

describe('TriggerFilter / damageTag (G primitive)', () => {
	function makeStubWithFilter(filter: unknown): CharacterData {
		return makeStubCharacter({
			passives: [
				{
					id: 'lintstub__passive__filter_test',
					name: 'Filter Test',
					abilityType: 'passive',
					effects: [
						{
							type: 'buff',
							target: 'self',
							trigger: { type: 'onHit', abilityType: 'skill', filter },
							duration: 5,
							source: 'character',
							stat: 'critRate',
							value: 10,
							snapshottable: false
						}
					]
				}
			]
		} as unknown as Partial<CharacterData>);
	}

	it('accepts a well-formed filter (damageTag + element + abilityName + hitIndex + isCrit)', () => {
		const c = makeStubWithFilter({
			damageTag: 'skillHold',
			element: 'pyro',
			abilityName: 'Wreath Arrow',
			hitIndex: 0,
			isCrit: true
		});
		const issues = lintCharacter(c);
		const filterIssues = issues.filter((i) => i.check.startsWith('filter-'));
		expect(filterIssues).toEqual([]);
	});

	it('rejects an invalid damageTag', () => {
		const c = makeStubWithFilter({ damageTag: 'plungeExtra' });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'filter-damageTag-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts physical as a filter element', () => {
		const c = makeStubWithFilter({ element: 'physical' });
		const issues = lintCharacter(c);
		const filterIssues = issues.filter((i) => i.check.startsWith('filter-'));
		expect(filterIssues).toEqual([]);
	});

	it('rejects an invalid filter element', () => {
		const c = makeStubWithFilter({ element: 'shadow' });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'filter-element-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('rejects an empty abilityName', () => {
		const c = makeStubWithFilter({ abilityName: '' });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'filter-abilityName-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('rejects a negative hitIndex', () => {
		const c = makeStubWithFilter({ hitIndex: -1 });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'filter-hitIndex-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('rejects a non-boolean isCrit', () => {
		const c = makeStubWithFilter({ isCrit: 'true' });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'filter-isCrit-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('rejects an invalid damageTag on a NormalHit', () => {
		const c = makeStubCharacter({
			abilities: [
				{
					id: 'lintstub__normal__attack',
					name: 'Attack',
					input: ['N'],
					abilityType: 'normal',
					hits: [{ frames: { swap: 10 }, damageTag: 'spaghetti' }]
				},
				{
					id: 'lintstub__skill__cast',
					name: 'Cast',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 20 },
					cooldown: 10
				}
			]
		} as unknown as Partial<CharacterData>);
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'damageTag-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('rejects an invalid damageTag on an AbilityVariant', () => {
		const c = makeStubCharacter({
			abilities: [
				{
					id: 'lintstub__normal__attack',
					name: 'Attack',
					input: ['N'],
					abilityType: 'normal',
					hits: [{ frames: { swap: 10 } }]
				},
				{
					id: 'lintstub__skill__cast',
					name: 'Cast',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 20 },
					cooldown: 10,
					variants: [{ label: 'Hold', input: ['hE'], damageTag: 'cosmic' }]
				}
			]
		} as unknown as Partial<CharacterData>);
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'damageTag-invalid');
		expect(hit?.severity).toBe('strict');
	});
});

describe('evalTriggerFilter logic', () => {
	it('returns true for absent filter', () => {
		expect(evalTriggerFilter(undefined, { damageTag: 'skill' })).toBe(true);
	});

	it('matches damageTag + element together', () => {
		const filter = { damageTag: 'skill' as const, element: 'pyro' as const };
		expect(evalTriggerFilter(filter, { damageTag: 'skill', element: 'pyro' })).toBe(true);
		expect(evalTriggerFilter(filter, { damageTag: 'skill', element: 'hydro' })).toBe(false);
		expect(evalTriggerFilter(filter, { damageTag: 'burst', element: 'pyro' })).toBe(false);
	});

	it('substring-matches abilityName', () => {
		const filter = { abilityName: 'Wreath Arrow' };
		expect(
			evalTriggerFilter(filter, { damageTag: 'charged', abilityName: 'Wreath Arrow Hit' })
		).toBe(true);
		expect(evalTriggerFilter(filter, { damageTag: 'charged', abilityName: 'Aimed Shot' })).toBe(
			false
		);
		expect(evalTriggerFilter(filter, { damageTag: 'charged' })).toBe(false);
	});

	it('matches hitIndex strictly', () => {
		const filter = { hitIndex: 3 };
		expect(evalTriggerFilter(filter, { damageTag: 'normal', hitIndex: 3 })).toBe(true);
		expect(evalTriggerFilter(filter, { damageTag: 'normal', hitIndex: 0 })).toBe(false);
		expect(evalTriggerFilter(filter, { damageTag: 'normal' })).toBe(false);
	});

	it('isCrit:true requires ctx.isCrit:true', () => {
		expect(evalTriggerFilter({ isCrit: true }, { damageTag: 'skill', isCrit: true })).toBe(true);
		expect(evalTriggerFilter({ isCrit: true }, { damageTag: 'skill', isCrit: false })).toBe(false);
		expect(evalTriggerFilter({ isCrit: true }, { damageTag: 'skill' })).toBe(false);
	});

	it('getDefaultDamageTag infers skillHold from variant input/label', () => {
		const ability = { abilityType: 'skill' } as never;
		expect(getDefaultDamageTag(ability)).toBe('skill');
		expect(getDefaultDamageTag(ability, { label: 'Tap', input: ['E'] } as never)).toBe('skill');
		expect(getDefaultDamageTag(ability, { label: 'Hold', input: ['hE'] } as never)).toBe(
			'skillHold'
		);
		expect(getDefaultDamageTag(ability, { label: 'Press 2', input: ['pE'] } as never)).toBe(
			'skillHold'
		);
		expect(
			getDefaultDamageTag(ability, { label: 'Tap', input: ['E'], damageTag: 'skillHold' } as never)
		).toBe('skillHold');
	});
});

describe('Physical Element coverage', () => {
	function makeStubWithResShred(element: string): CharacterData {
		return makeStubCharacter({
			constellations: [
				{
					id: 'lintstub__constellation__test',
					name: 'Test',
					abilityType: 'constellation',
					constellationLevel: 6,
					effects: [
						{
							type: 'resShred',
							target: 'enemy',
							trigger: { type: 'onHit', abilityType: 'burst' },
							duration: 10,
							element,
							value: -20
						}
					]
				}
			]
		} as unknown as Partial<CharacterData>);
	}

	it('accepts element:"physical" on resShred', () => {
		const c = makeStubWithResShred('physical');
		const issues = lintCharacter(c);
		const elemIssues = issues.filter((i) => i.check === 'invalid-element');
		expect(elemIssues).toEqual([]);
	});

	it('rejects an unknown damage element key', () => {
		const c = makeStubWithResShred('quantum');
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'invalid-element');
		expect(hit?.severity).toBe('strict');
	});

	it('rejects element:"physical" on infuse Effect (Physical is not a valid character infusion)', () => {
		const c = makeStubCharacter({
			passives: [
				{
					id: 'lintstub__passive__bad',
					name: 'Bad',
					abilityType: 'passive',
					effects: [
						{
							type: 'infuse',
							target: 'self',
							trigger: { type: 'onCast', ability: 'burst' },
							element: 'physical'
						}
					]
				}
			]
		} as unknown as Partial<CharacterData>);
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'invalid-element');
		expect(hit?.severity).toBe('strict');
	});
});

describe('extended Stat union (reaction-DMG / element-RES / element-CRIT-DMG)', () => {
	function makeStubWithBuffStat(stat: string): CharacterData {
		return makeStubCharacter({
			passives: [
				{
					id: 'lintstub__passive__test',
					name: 'Stat Test Passive',
					abilityType: 'passive',
					effects: [
						{
							type: 'buff',
							target: 'self',
							trigger: { type: 'onCast', ability: 'burst' },
							duration: 10,
							source: 'character',
							stat,
							value: 15,
							snapshottable: false
						}
					]
				}
			]
		} as unknown as Partial<CharacterData>);
	}

	const NEW_STATS = [
		'lunarChargedDmgBonus',
		'lunarBloomDmgBonus',
		'lunarCrystallizeDmgBonus',
		'pyroRes',
		'hydroRes',
		'cryoRes',
		'electroRes',
		'anemoRes',
		'geoRes',
		'dendroRes',
		'physicalRes',
		'allElementalRes',
		'pyroCritDmg',
		'hydroCritDmg',
		'cryoCritDmg',
		'electroCritDmg',
		'anemoCritDmg',
		'geoCritDmg',
		'dendroCritDmg'
	];

	for (const stat of NEW_STATS) {
		it(`accepts buff stat "${stat}"`, () => {
			const c = makeStubWithBuffStat(stat);
			const issues = lintCharacter(c);
			const statIssues = issues.filter((i) => i.check === 'invalid-stat');
			expect(statIssues).toEqual([]);
		});
	}

	it('still rejects an unknown stat key', () => {
		const c = makeStubWithBuffStat('quantumFlux');
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'invalid-stat');
		expect(hit?.severity).toBe('strict');
	});
});
