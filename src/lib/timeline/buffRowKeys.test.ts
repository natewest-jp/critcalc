/**
 * buffRowKeys.test.ts — the buff rows' render keys are unique, corpus-wide.
 *
 * ⚓ A keyed `{#each}` in RotationTimeline throws `each_key_duplicate` on two
 * rows with one key, and a throw there freezes the WHOLE planner until a
 * refresh. It has happened three times (archive_bug_lessons): Chevreuse's two
 * reaction shreds on the team lane (2026-06-23), and Odette at C2 on the
 * received rows (2026-09-27, `fc77bcb4`) — her A1 and C2 rows both read
 * "Odette Marvelous Splendor" once count-bound rows were keyed by stat, while
 * the template still keyed by `characterId::sourceLabel`.
 *
 * The rule both fixes landed on: each projection returns the key its row map
 * deduplicated by, and the template renders by THAT key. Two halves, each
 * seeded against when written:
 *
 *   - the SWEEP fails when a projection returns a key COARSER than its map
 *     key (seeded: received rows returning `characterId::sourceLabel` fail on
 *     Odette);
 *   - the GREP fails when the template re-derives a key instead of rendering
 *     by `.key` (seeded: the pre-`fc77bcb4` template key fails).
 *
 * ⚠️ Neither can see a coarser MAP key: that merges two rows into one before
 * any key is returned, which is a lost row, not a crash — a different defect.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import { projectCharReceivedBuffRows } from './charReceivedBuffRows';
import { projectTeamBuffRows } from './teamBuffRows';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byName = new Map(all.map((c) => [c.displayName.toLowerCase(), c]));
const byId = new Map(all.map((c) => [c.id, c]));
const lookup = (name: string) => byName.get(name.toLowerCase()) ?? null;
const getCharacter = (id: string) => byId.get(id) ?? null;

/** Constellations where effect surfaces change most: C1/C2 add rows, C6 all. */
const LEVELS = [0, 2, 6];

function duplicates(keys: string[]): string[] {
	return [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
}

describe('buff row keys are unique (each_key_duplicate guard)', () => {
	for (const c of all) {
		it(c.id, () => {
			// A team, so team-targeted and received buffs both have receivers, and
			// a second cast of the character so refreshes and recasts are exercised.
			const n = `${c.displayName} E Q N1 N2 N3 > Kaeya E N1 N2 N3 > Xingqiu E Q N1 N2 N3 > ${c.displayName} E N1 Q`;
			for (const level of LEVELS) {
				const { windows } = parseNotation(n, lookup, 8, { [c.id]: level });
				const received = projectCharReceivedBuffRows(windows, getCharacter).map((r) => r.key);
				const team = projectTeamBuffRows(windows, getCharacter).map((r) => r.key);
				expect(duplicates(received), `received rows @C${level}`).toEqual([]);
				expect(duplicates(team), `team rows @C${level}`).toEqual([]);
			}
		});
	}
});

describe('the planner renders buff rows by the projection key', () => {
	const src = readFileSync(
		new URL('../components/RotationTimeline.svelte', import.meta.url),
		'utf8'
	);
	it('received rows are keyed by recRow.key', () => {
		expect(src).toMatch(/\{#each charReceivedBuffRows[^}]*as recRow, ri \(recRow\.key\)\}/);
	});
	it('team rows are keyed by subrow.key', () => {
		expect(src).toMatch(/\{#each teamBuffRows as subrow \(subrow\.key\)\}/);
	});
});
