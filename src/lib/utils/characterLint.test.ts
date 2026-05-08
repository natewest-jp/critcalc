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
					throw new Error(
						`${c.id}: ${strict.length} strict issue(s):\n${formatIssues(strict)}`
					);
				}
				if (warn.length > 0) {
					console.warn(
						`[lint:warn] ${c.id} (${warn.length} warning(s)):\n${formatIssues(warn)}`
					);
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
		const c = makeStubWithPassiveBuff({ type: 'perStack', key: 'declension', per: 4, maxStacks: 0 });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'perstack-maxstacks-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts a valid perStack value', () => {
		const c = makeStubWithPassiveBuff({ type: 'perStack', key: 'declension', per: 4, maxStacks: 4 });
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
