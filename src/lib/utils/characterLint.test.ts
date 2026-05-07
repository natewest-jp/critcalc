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
