/**
 * src/lib/utils/characterLint.test.ts
 *
 * Curation lint test. Eager-globs every committed character JSON (the app
 * itself lazy-loads payloads via characterData.ts, but eager is fine in the
 * vitest/node context — this corpus never ships), scopes to curated
 * characters via the isCurated heuristic, and asserts no strict issues.
 *
 * Warn issues are printed to console.warn but pass the test. They become
 * strict over time as the schema and curation conventions tighten.
 */

import { describe, it, expect } from 'vitest';
import { isCurated, lintCharacter, type LintIssue } from './characterLint';
import type { CharacterData } from '$lib/types/character';
import { evalTriggerFilter, getDefaultDamageTag } from '$lib/types/ability';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all = Object.values(modules)
	.map((mod) => (mod as { default?: CharacterData }).default ?? (mod as CharacterData))
	.filter((c): c is CharacterData => !!c?.id);
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

	it('flags perStack with negative threshold', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'serpentsSubtlety',
			per: 1,
			threshold: -1,
			maxStacks: 12
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'perstack-threshold-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags perStack with non-integer threshold', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'serpentsSubtlety',
			per: 1,
			threshold: 50.5,
			maxStacks: 12
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'perstack-threshold-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts perStack with valid non-negative integer threshold', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'serpentsSubtlety',
			per: 1,
			threshold: 50,
			maxStacks: 12
		});
		const issues = lintCharacter(c);
		const perStackIssues = issues.filter((i) => i.check.startsWith('perstack-'));
		expect(perStackIssues).toEqual([]);
	});

	it('flags perStack with non-positive cap', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'nightsoul',
			per: { stat: 'atk', ratio: 0.5 },
			cap: 0
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'perstack-cap-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags perStack with non-numeric cap', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'nightsoul',
			per: { stat: 'atk', ratio: 0.5 },
			cap: '690'
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'perstack-cap-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts perStack with valid positive cap (Iansan-shape: scaling per + cap)', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'nightsoul',
			per: { stat: 'atk', ratio: 0.5 },
			cap: 690
		});
		const issues = lintCharacter(c);
		const perStackIssues = issues.filter((i) => i.check.startsWith('perstack-'));
		expect(perStackIssues).toEqual([]);
	});

	it('accepts perStack with plain-number per + cap (clamp-on-display shape)', () => {
		const c = makeStubWithPassiveBuff({
			type: 'perStack',
			key: 'declension',
			per: 4,
			maxStacks: 5,
			cap: 16
		});
		const issues = lintCharacter(c);
		const perStackIssues = issues.filter((i) => i.check.startsWith('perstack-'));
		expect(perStackIssues).toEqual([]);
	});
});

describe('consumeStacks lint rules (E3 v2.x)', () => {
	function makeStubWithBurstConsume(eff: unknown): CharacterData {
		return makeStubCharacter({
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
					name: 'Skill',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 30 },
					cooldown: 5
				},
				{
					id: 'lintstub__burst__cast',
					name: 'Burst',
					input: ['Q'],
					abilityType: 'burst',
					behavior: 'instant',
					frames: { swap: 60 },
					cooldown: 15,
					energyCost: 60,
					effects: [eff]
				}
			]
		} as unknown as Partial<CharacterData>);
	}

	it('flags consumeStacks with empty key', () => {
		const c = makeStubWithBurstConsume({
			type: 'consumeStacks',
			target: 'self',
			trigger: { type: 'onCast', ability: 'burst' },
			key: '',
			amount: 'all'
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'consumestacks-key-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags consumeStacks with non-positive numeric amount', () => {
		const c = makeStubWithBurstConsume({
			type: 'consumeStacks',
			target: 'self',
			trigger: { type: 'onCast', ability: 'burst' },
			key: 'resource',
			amount: 0
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'consumestacks-amount-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags consumeStacks with a trigger outside onCast/onHit', () => {
		const c = makeStubWithBurstConsume({
			type: 'consumeStacks',
			target: 'self',
			trigger: { type: 'onReaction', reaction: 'any' },
			key: 'resource',
			amount: 1
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'consumestacks-trigger-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts consumeStacks with an onHit trigger (onHit wiring, 2026-07-17)', () => {
		const c = makeStubWithBurstConsume({
			type: 'consumeStacks',
			target: 'self',
			trigger: { type: 'onHit', abilityType: 'charged', source: 'self' },
			key: 'resource',
			amount: 'all'
		});
		const issues = lintCharacter(c);
		const consumeIssues = issues.filter((i) => i.check.startsWith('consumestacks-'));
		expect(consumeIssues).toEqual([]);
	});

	it('flags consumeStacks with empty trigger.input array', () => {
		const c = makeStubWithBurstConsume({
			type: 'consumeStacks',
			target: 'self',
			trigger: { type: 'onCast', ability: 'burst', input: [] },
			key: 'resource',
			amount: 'all'
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'consumestacks-trigger-input-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts consumeStacks with amount: "all"', () => {
		const c = makeStubWithBurstConsume({
			type: 'consumeStacks',
			target: 'self',
			trigger: { type: 'onCast', ability: 'burst' },
			key: 'resource',
			amount: 'all'
		});
		const issues = lintCharacter(c);
		const consumeIssues = issues.filter((i) => i.check.startsWith('consumestacks-'));
		expect(consumeIssues).toEqual([]);
	});

	it('accepts consumeStacks with positive numeric amount', () => {
		const c = makeStubWithBurstConsume({
			type: 'consumeStacks',
			target: 'self',
			trigger: { type: 'onCast', ability: 'burst' },
			key: 'resource',
			amount: 5
		});
		const issues = lintCharacter(c);
		const consumeIssues = issues.filter((i) => i.check.startsWith('consumestacks-'));
		expect(consumeIssues).toEqual([]);
	});
});

describe('gainStacks trigger.input lint rules (E3 v2.x)', () => {
	function makeStubWithSkillGain(trigger: unknown): CharacterData {
		return makeStubCharacter({
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
					name: 'Skill',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 30 },
					cooldown: 5,
					effects: [
						{
							type: 'gainStacks',
							target: 'self',
							trigger,
							key: 'resource',
							amount: 5,
							max: 100
						}
					]
				}
			]
		} as unknown as Partial<CharacterData>);
	}

	it('flags gainStacks with empty trigger.input array', () => {
		const c = makeStubWithSkillGain({ type: 'onCast', ability: 'skill', input: [] });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'gainstacks-trigger-input-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags gainStacks with non-string element in trigger.input', () => {
		const c = makeStubWithSkillGain({ type: 'onCast', ability: 'skill', input: ['E', 0] });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'gainstacks-trigger-input-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts gainStacks with valid trigger.input filter', () => {
		const c = makeStubWithSkillGain({ type: 'onCast', ability: 'skill', input: ['E', 'hE'] });
		const issues = lintCharacter(c);
		const inputIssues = issues.filter((i) => i.check === 'gainstacks-trigger-input-invalid');
		expect(inputIssues).toEqual([]);
	});

	it('accepts gainStacks with no trigger.input filter (default behavior)', () => {
		const c = makeStubWithSkillGain({ type: 'onCast', ability: 'skill' });
		const issues = lintCharacter(c);
		const inputIssues = issues.filter((i) => i.check === 'gainstacks-trigger-input-invalid');
		expect(inputIssues).toEqual([]);
	});
});

describe('gainStacks lifetime lint rules (E3 v2.x)', () => {
	function makeStubWithLifetime(extraFx: Record<string, unknown>): CharacterData {
		return makeStubCharacter({
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
					name: 'Skill',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 30 },
					cooldown: 5,
					effects: [
						{
							type: 'gainStacks',
							target: 'self',
							trigger: { type: 'onCast', ability: 'skill' },
							key: 'fieldCatalog',
							amount: 6,
							max: 18,
							...extraFx
						}
					]
				}
			]
		} as unknown as Partial<CharacterData>);
	}

	it('flags non-positive lifetime', () => {
		const c = makeStubWithLifetime({ lifetime: 0 });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'gainstacks-lifetime-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags non-numeric lifetime', () => {
		const c = makeStubWithLifetime({ lifetime: '10' });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'gainstacks-lifetime-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags lifetime + drain conflict on the same effect', () => {
		const c = makeStubWithLifetime({
			lifetime: 10,
			drain: { ratePerSecond: 1, state: 'inStance' }
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'gainstacks-lifetime-drain-conflict');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts a valid positive lifetime (Linnea-shape)', () => {
		const c = makeStubWithLifetime({ lifetime: 10 });
		const issues = lintCharacter(c);
		const lifetimeIssues = issues.filter((i) => i.check.startsWith('gainstacks-lifetime-'));
		expect(lifetimeIssues).toEqual([]);
	});

	it('flags constellationScaling.amount non-positive', () => {
		const c = makeStubWithLifetime({
			constellationScaling: {
				conditions: { type: 'constellation', level: 6 },
				amount: 0
			}
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'gainstacks-constellation-scaling-amount-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags constellationScaling.amount non-numeric', () => {
		const c = makeStubWithLifetime({
			constellationScaling: {
				conditions: { type: 'constellation', level: 6 },
				amount: '18'
			}
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'gainstacks-constellation-scaling-amount-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags missing constellationScaling.conditions', () => {
		const c = makeStubWithLifetime({
			constellationScaling: { amount: 18 }
		});
		const issues = lintCharacter(c);
		const hit = issues.find(
			(i) => i.check === 'gainstacks-constellation-scaling-conditions-invalid'
		);
		expect(hit?.severity).toBe('strict');
	});

	it('accepts a valid constellationScaling override (Linnea C6-shape)', () => {
		const c = makeStubWithLifetime({
			constellationScaling: {
				conditions: { type: 'constellation', level: 6 },
				amount: 18
			}
		});
		const issues = lintCharacter(c);
		const csIssues = issues.filter((i) => i.check.startsWith('gainstacks-constellation-scaling-'));
		expect(csIssues).toEqual([]);
	});

	it('flags non-positive sourceLifetime', () => {
		const c = makeStubWithLifetime({ lifetime: undefined, sourceLifetime: 0 });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'gainstacks-source-lifetime-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags sourceLifetime + drain conflict', () => {
		const c = makeStubWithLifetime({
			lifetime: undefined,
			sourceLifetime: 20,
			drain: { ratePerSecond: 1, state: 'inStance' }
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'gainstacks-source-lifetime-drain-conflict');
		expect(hit?.severity).toBe('strict');
	});

	it('flags sourceLifetime + lifetime conflict', () => {
		const c = makeStubWithLifetime({
			lifetime: 10,
			sourceLifetime: 20
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'gainstacks-source-lifetime-lifetime-conflict');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts a valid sourceLifetime (Skirk A4-shape)', () => {
		const c = makeStubWithLifetime({
			lifetime: undefined,
			sourceLifetime: 20
		});
		const issues = lintCharacter(c);
		const slIssues = issues.filter((i) => i.check.startsWith('gainstacks-source-lifetime-'));
		expect(slIssues).toEqual([]);
	});
});

describe('onHit gainStacks boundedness lint (onHit wiring, 2026-07-17)', () => {
	function makeStubWithOnHitGain(trigger: unknown, extra: Record<string, unknown> = {}) {
		return makeStubCharacter({
			passives: [
				{
					id: 'lintstub__passive__onhit',
					name: 'OnHit Passive',
					abilityType: 'passive',
					effects: [
						{
							type: 'gainStacks',
							target: 'self',
							trigger,
							key: 'resource',
							amount: 1,
							max: 5,
							...extra
						}
					]
				}
			]
		} as unknown as Partial<CharacterData>);
	}

	it('flags team-sourced onHit gainStacks without a decay shape', () => {
		const c = makeStubWithOnHitGain({ type: 'onHit', abilityType: 'normal', source: 'team' });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'gainstacks-onhit-unbounded');
		expect(hit?.severity).toBe('strict');
	});

	it('flags others-sourced onHit gainStacks without a decay shape', () => {
		const c = makeStubWithOnHitGain({ type: 'onHit', source: 'others' });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'gainstacks-onhit-unbounded');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts self-sourced plain onHit gainStacks (per-segment scope)', () => {
		const c = makeStubWithOnHitGain({ type: 'onHit', abilityType: 'normal', source: 'self' });
		const issues = lintCharacter(c);
		expect(issues.find((i) => i.check === 'gainstacks-onhit-unbounded')).toBeUndefined();
	});

	it('accepts team-sourced onHit gainStacks with a lifetime decay shape', () => {
		const c = makeStubWithOnHitGain(
			{ type: 'onHit', abilityType: 'normal', source: 'team' },
			{ lifetime: 15 }
		);
		const issues = lintCharacter(c);
		expect(issues.find((i) => i.check === 'gainstacks-onhit-unbounded')).toBeUndefined();
	});

	it('accepts others-sourced onHit gainStacks with sourceLifetime (Skirk A4-shape)', () => {
		const c = makeStubWithOnHitGain(
			{ type: 'onHit', source: 'others', filter: { element: 'cryo' } },
			{ sourceLifetime: 20 }
		);
		const issues = lintCharacter(c);
		expect(issues.find((i) => i.check === 'gainstacks-onhit-unbounded')).toBeUndefined();
	});

	it('flags an onHit abilityType outside the hit-class vocabulary', () => {
		const c = makeStubWithOnHitGain({ type: 'onHit', abilityType: 'passive', source: 'self' });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'onhit-ability-type-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags an empty onHit abilityType array', () => {
		const c = makeStubWithOnHitGain({ type: 'onHit', abilityType: [], source: 'self' });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'onhit-ability-type-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags an onHit abilityType array with an invalid member', () => {
		const c = makeStubWithOnHitGain({
			type: 'onHit',
			abilityType: ['normal', 'sprint'],
			source: 'self'
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'onhit-ability-type-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts a valid onHit abilityType array (Escoffier C6-shape)', () => {
		const c = makeStubWithOnHitGain(
			{ type: 'onHit', abilityType: ['normal', 'charged', 'plunge'], source: 'others' },
			{ lifetime: 20 }
		);
		const issues = lintCharacter(c);
		expect(issues.find((i) => i.check === 'onhit-ability-type-invalid')).toBeUndefined();
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

describe('elevate effect lint rules', () => {
	function makeStubWithElevate(extra: Record<string, unknown>): CharacterData {
		return makeStubCharacter({
			constellations: [
				{
					id: 'lintstub__constellation__c6',
					name: 'C6',
					abilityType: 'constellation',
					constellationLevel: 6,
					effects: [
						{
							type: 'elevate',
							target: 'team',
							trigger: { type: 'passive' },
							source: 'character',
							reactions: ['lunarBloom'],
							value: 25,
							snapshottable: false,
							...extra
						}
					]
				}
			]
		} as unknown as Partial<CharacterData>);
	}

	it('accepts a well-formed elevate effect', () => {
		const c = makeStubWithElevate({});
		const issues = lintCharacter(c);
		const hit = issues.filter((i) => i.check.startsWith('elevate-'));
		expect(hit).toEqual([]);
	});

	it('flags an empty reactions array', () => {
		const c = makeStubWithElevate({ reactions: [] });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'elevate-reactions-empty');
		expect(hit?.severity).toBe('strict');
	});

	it('flags an unknown reaction', () => {
		const c = makeStubWithElevate({ reactions: ['lunarSpaghetti'] });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'elevate-reaction-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags missing snapshottable', () => {
		const c = makeStubWithElevate({ snapshottable: undefined });
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'elevate-snapshottable-missing');
		expect(hit?.severity).toBe('strict');
	});
});

describe('damage/heal flat addend lint rules', () => {
	function makeStubWithEffect(effect: Record<string, unknown>): CharacterData {
		return makeStubCharacter({
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
					effects: [effect as never]
				}
			]
		});
	}

	it('flags negative flat on damage', () => {
		const c = makeStubWithEffect({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onCast' },
			scaling: 100,
			stat: 'atk',
			flat: -5
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'damage-flat-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags non-finite flat on heal', () => {
		const c = makeStubWithEffect({
			type: 'heal',
			target: 'active',
			trigger: { type: 'onCast' },
			scaling: 100,
			stat: 'def',
			flat: Number.POSITIVE_INFINITY
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'heal-flat-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts a valid positive flat on heal', () => {
		const c = makeStubWithEffect({
			type: 'heal',
			target: 'active',
			trigger: { type: 'onCast' },
			scaling: 50,
			stat: 'def',
			flat: 1101.7
		});
		const issues = lintCharacter(c);
		const hit = issues.find(
			(i) => i.check === 'heal-flat-invalid' || i.check === 'damage-flat-invalid'
		);
		expect(hit).toBeUndefined();
	});

	it('accepts an absent flat field (optional)', () => {
		const c = makeStubWithEffect({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onCast' },
			scaling: 100,
			stat: 'atk'
		});
		const issues = lintCharacter(c);
		const hit = issues.find(
			(i) => i.check === 'heal-flat-invalid' || i.check === 'damage-flat-invalid'
		);
		expect(hit).toBeUndefined();
	});
});

describe('damage/heal flatScaling lint rules (2026-05-17)', () => {
	function makeStubWithEffect(effect: Record<string, unknown>): CharacterData {
		return makeStubCharacter({
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
					effects: [effect as never]
				}
			]
		});
	}

	it('accepts a valid flatScaling on damage (Aino A4 shape)', () => {
		const c = makeStubWithEffect({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onCast' },
			scaling: 36.2,
			stat: 'atk',
			element: 'hydro',
			flatScaling: { stat: 'em', ratio: 50 }
		});
		const issues = lintCharacter(c);
		const hit = issues.find(
			(i) =>
				i.check === 'damage-flat-scaling-shape-invalid' ||
				i.check === 'damage-flat-scaling-stat-invalid'
		);
		expect(hit).toBeUndefined();
	});

	it('accepts a valid flatScaling on heal', () => {
		const c = makeStubWithEffect({
			type: 'heal',
			target: 'active',
			trigger: { type: 'onCast' },
			scaling: 100,
			stat: 'def',
			flatScaling: { stat: 'em', ratio: 25 }
		});
		const issues = lintCharacter(c);
		const hit = issues.find(
			(i) =>
				i.check === 'heal-flat-scaling-shape-invalid' ||
				i.check === 'heal-flat-scaling-stat-invalid'
		);
		expect(hit).toBeUndefined();
	});

	it('flags missing ratio on damage flatScaling', () => {
		const c = makeStubWithEffect({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onCast' },
			scaling: 100,
			stat: 'atk',
			flatScaling: { stat: 'em' }
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'damage-flat-scaling-shape-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags missing stat on heal flatScaling', () => {
		const c = makeStubWithEffect({
			type: 'heal',
			target: 'active',
			trigger: { type: 'onCast' },
			scaling: 100,
			stat: 'def',
			flatScaling: { ratio: 10 }
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'heal-flat-scaling-shape-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags non-object flatScaling on damage', () => {
		const c = makeStubWithEffect({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onCast' },
			scaling: 100,
			stat: 'atk',
			flatScaling: 50
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'damage-flat-scaling-shape-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags non-positive ratio on damage flatScaling', () => {
		const c = makeStubWithEffect({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onCast' },
			scaling: 100,
			stat: 'atk',
			flatScaling: { stat: 'em', ratio: -5 }
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'damage-flat-scaling-shape-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags unknown stat on heal flatScaling', () => {
		const c = makeStubWithEffect({
			type: 'heal',
			target: 'active',
			trigger: { type: 'onCast' },
			scaling: 100,
			stat: 'def',
			flatScaling: { stat: 'critRate', ratio: 25 }
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'heal-flat-scaling-stat-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('accepts an absent flatScaling field (optional)', () => {
		const c = makeStubWithEffect({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onCast' },
			scaling: 100,
			stat: 'atk'
		});
		const issues = lintCharacter(c);
		const hit = issues.find(
			(i) =>
				i.check === 'damage-flat-scaling-shape-invalid' ||
				i.check === 'damage-flat-scaling-stat-invalid'
		);
		expect(hit).toBeUndefined();
	});

	it('accepts flat and flatScaling co-located on the same effect', () => {
		const c = makeStubWithEffect({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onCast' },
			scaling: 100,
			stat: 'atk',
			flat: 500,
			flatScaling: { stat: 'em', ratio: 50 }
		});
		const issues = lintCharacter(c);
		const hit = issues.find(
			(i) =>
				i.check === 'damage-flat-invalid' ||
				i.check === 'damage-flat-scaling-shape-invalid' ||
				i.check === 'damage-flat-scaling-stat-invalid'
		);
		expect(hit).toBeUndefined();
	});
});

describe('teamElementCount condition lint rules (2026-05-14)', () => {
	function makeStubWithCondition(cond: unknown): CharacterData {
		return makeStubCharacter({
			passives: [
				{
					id: 'lintstub__passive__a4',
					name: 'A4',
					abilityType: 'passive',
					effects: [
						{
							type: 'buff',
							target: 'self',
							trigger: { type: 'passive' },
							source: 'character',
							stat: 'atk%',
							value: 10,
							snapshottable: false,
							conditions: cond as never
						} as never
					]
				}
			]
		});
	}

	it('accepts a valid Skirk A4-shape teamElementCount condition', () => {
		const c = makeStubWithCondition({
			type: 'teamElementCount',
			elements: ['cryo', 'hydro'],
			comparison: '=',
			value: 3
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check.startsWith('condition-team-element-count-'));
		expect(hit).toBeUndefined();
	});

	it('flags empty elements array', () => {
		const c = makeStubWithCondition({
			type: 'teamElementCount',
			elements: [],
			comparison: '>=',
			value: 1
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'condition-team-element-count-elements-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags invalid element key (physical excluded)', () => {
		const c = makeStubWithCondition({
			type: 'teamElementCount',
			elements: ['cryo', 'physical'],
			comparison: '=',
			value: 2
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'condition-team-element-count-elements-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags negative value', () => {
		const c = makeStubWithCondition({
			type: 'teamElementCount',
			elements: ['cryo'],
			comparison: '>=',
			value: -1
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'condition-team-element-count-value-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags invalid comparison op', () => {
		const c = makeStubWithCondition({
			type: 'teamElementCount',
			elements: ['cryo'],
			comparison: '!=',
			value: 1
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'condition-team-element-count-comparison-invalid');
		expect(hit?.severity).toBe('strict');
	});
});

describe('canonicalAssumption retirement (cA-fold 2026-07-20)', () => {
	it('flags any lingering canonicalAssumption field as retired', () => {
		const c = makeStubCharacter({
			passives: [
				{
					id: 'lintstub__passive__a1',
					name: 'A1',
					abilityType: 'passive',
					effects: [
						{
							type: 'buff',
							target: 'self',
							trigger: { type: 'passive' },
							source: 'character',
							stat: 'critRate',
							value: 24,
							canonicalAssumption: { headlineValue: 24, caveat: 'stale' },
							snapshottable: false
						} as never
					]
				}
			]
		});
		const hit = lintCharacter(c).find((i) => i.check === 'buff-canonical-assumption-retired');
		expect(hit?.severity).toBe('strict');
	});
});

describe('onShieldEnd trigger lint rules (2026-05-14)', () => {
	function makeStubWithConstellation(effect: Record<string, unknown>): CharacterData {
		return makeStubCharacter({
			constellations: [
				{
					id: 'lintstub__constellation__c4',
					name: 'C4',
					abilityType: 'constellation',
					constellationLevel: 4,
					effects: [effect as never]
				}
			]
		});
	}

	it('accepts a valid onShieldEnd source:self ability:skill (Noelle C4 shape)', () => {
		const c = makeStubWithConstellation({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onShieldEnd', source: 'self', ability: 'skill' },
			scaling: 400,
			stat: 'atk',
			element: 'geo'
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check.startsWith('onshieldend-'));
		expect(hit).toBeUndefined();
	});

	it('accepts a valid onShieldEnd source:team with procCooldown (Kachina C6 shape)', () => {
		const c = makeStubWithConstellation({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onShieldEnd', source: 'team' },
			procCooldown: 5,
			scaling: 200,
			stat: 'def',
			element: 'geo'
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check.startsWith('onshieldend-'));
		expect(hit).toBeUndefined();
	});

	it('flags invalid source value', () => {
		const c = makeStubWithConstellation({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onShieldEnd', source: 'others' },
			scaling: 200,
			stat: 'def',
			element: 'geo'
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'onshieldend-source-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags invalid ability value', () => {
		const c = makeStubWithConstellation({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onShieldEnd', source: 'self', ability: 'normal' },
			scaling: 400,
			stat: 'atk',
			element: 'geo'
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'onshieldend-ability-invalid');
		expect(hit?.severity).toBe('strict');
	});

	it('flags negative procCooldown', () => {
		const c = makeStubWithConstellation({
			type: 'damage',
			target: 'enemy',
			trigger: { type: 'onShieldEnd', source: 'team' },
			procCooldown: -1,
			scaling: 200,
			stat: 'def',
			element: 'geo'
		});
		const issues = lintCharacter(c);
		const hit = issues.find((i) => i.check === 'onshieldend-proc-cooldown-invalid');
		expect(hit?.severity).toBe('strict');
	});
});

// ---------------------------------------------------------------------------
// Roster-wide parse smoke test (2026-07-06, after the Durin frameless crash)
// ---------------------------------------------------------------------------
//
// Every character in the corpus — curated or not — must survive being handed
// to the parser. A single throwing character empties the whole rotation
// (the rotation $derived catches and returns zero tracks), so this converts
// that bug class from runtime-discovered to CI-caught.

import { parseNotation } from './notationParser';

describe('roster-wide parse smoke test', () => {
	for (const c of all) {
		it(`${c.id} parses E Q N1 C without throwing or producing non-finite numbers`, () => {
			const lookup = (name: string): CharacterData | null => (name === c.displayName ? c : null);
			const result = parseNotation(`${c.displayName} E Q N1 C E`, lookup, 8);
			expect(result.tracks).toHaveLength(1);
			const track = result.tracks[0];
			for (const bar of [...track.eBars, ...track.qBars]) {
				expect(Number.isFinite(bar.start)).toBe(true);
				expect(Number.isFinite(bar.uptime)).toBe(true);
				expect(Number.isFinite(bar.cooldown)).toBe(true);
				expect(Number.isFinite(bar.castTime)).toBe(true);
			}
			for (const block of track.inputBlocks) {
				expect(Number.isFinite(block.start)).toBe(true);
				expect(Number.isFinite(block.duration)).toBe(true);
			}
			expect(Number.isFinite(result.totalDuration)).toBe(true);
		});
	}
});

// ---------------------------------------------------------------------------
// FrameMap coverage tracker
// ---------------------------------------------------------------------------
//
// Characters authored without E/Q FrameMaps render with generic cast-time
// fallbacks (resolveEQCastTime). This list tracks the gap explicitly:
// - a character NOT listed here must have frames on every E/Q (catches a
//   future frameless release slipping into the corpus);
// - a character listed here that GAINS frames fails the prune check, so the
//   list shrinks as authoring progresses.
// emilie + kamisato_ayaka are released (gcsim frame sources exist — Track O
// authoring targets); the rest are pre-release with no source yet.
// `blank` is the Rotation Planner's generic placeholder slot — permanently
// frameless by design (it rides the data-derived generic profile), never an
// authoring target, so it stays exempt forever.

const FRAMELESS_EXEMPT = new Set([
	'blank',
	'illuga',
	'kachina',
	'lohen',
	'prune',
	'sandrone',
	'zibai'
]);

describe('FrameMap coverage', () => {
	const hasEQFrames = (c: CharacterData): boolean =>
		c.abilities
			.filter((a) => a.abilityType === 'skill' || a.abilityType === 'burst')
			.every(
				(a) =>
					('frames' in a && a.frames != null) || (a.variants ?? []).some((v) => v.frames != null)
			);

	for (const c of all) {
		if (FRAMELESS_EXEMPT.has(c.id)) {
			it(`${c.id} is exempt — prune from FRAMELESS_EXEMPT once frames are authored`, () => {
				expect(hasEQFrames(c)).toBe(false);
			});
		} else {
			it(`${c.id} has FrameMaps on every E/Q`, () => {
				expect(hasEQFrames(c)).toBe(true);
			});
		}
	}
});

describe('caveat style (E.26)', () => {
	function makeStubWithCaveat(caveat: string): CharacterData {
		const c = makeStubCharacter();
		(c.abilities[1] as { caveat?: string }).caveat = caveat;
		return c;
	}

	it('accepts a clean, concise caveat', () => {
		const c = makeStubWithCaveat('Not modeled: the 30% current-HP drain on cast.');
		const issues = lintCharacter(c).filter((i) => i.check === 'caveat-style');
		expect(issues).toEqual([]);
	});

	it('flags banned curator-speak tokens as strict', () => {
		const c = makeStubWithCaveat('Frames sourced from gcsim; the schema lacks a field.');
		const issues = lintCharacter(c).filter((i) => i.check === 'caveat-style');
		expect(issues.length).toBe(2);
		expect(issues.every((i) => i.severity === 'strict')).toBe(true);
	});

	it('flags the double-L "modelled" spelling', () => {
		const c = makeStubWithCaveat('This mechanic is not modelled.');
		const hit = lintCharacter(c).find((i) => i.check === 'caveat-style');
		expect(hit?.severity).toBe('strict');
	});

	it('warns between 280 and 400 chars, fails above 400', () => {
		const warn = makeStubWithCaveat('a'.repeat(300));
		const warnHit = lintCharacter(warn).find((i) => i.check === 'caveat-style');
		expect(warnHit?.severity).toBe('warn');

		const fail = makeStubWithCaveat('a'.repeat(401));
		const failHit = lintCharacter(fail).find((i) => i.check === 'caveat-style');
		expect(failHit?.severity).toBe('strict');
	});
});
