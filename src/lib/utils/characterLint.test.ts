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
