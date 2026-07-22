/**
 * src/lib/data/characterRoles.test.ts
 *
 * Guards the committed generated roles sidecar (characterRoles.generated.ts)
 * against drift from the CSV source. If this fails, re-run
 * `npm run generate-character-roles` and commit the result.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CharacterData } from '$lib/types/character';
import { characterRoles } from './characterRoles.generated';
import { parseRolesCsv, normalizeName } from './parseRolesCsv';

// Rebuild name→id from the character JSONs the same way the generator does
// (blank.json is a slot placeholder, never a real character).
const modules = import.meta.glob('./characters/*.json', { eager: true });
const sources = Object.values(modules)
	.map((mod) => (mod as { default?: CharacterData }).default ?? (mod as CharacterData))
	.filter((c): c is CharacterData => !!c?.id && c.id !== 'blank');

const nameToId = new Map<string, string>();
for (const c of sources) {
	if (c.displayName) nameToId.set(normalizeName(c.displayName), c.id);
	if (c.name) nameToId.set(normalizeName(c.name), c.id);
}

const csvText = readFileSync(
	fileURLToPath(new URL('../../../docs/library/game/genshin-character-roles.csv', import.meta.url)),
	'utf8'
);
const fresh = parseRolesCsv(csvText, nameToId);

describe('generated character roles', () => {
	it('matches a fresh parse of the CSV (no drift)', () => {
		expect(characterRoles).toEqual(fresh.roles);
	});

	it('maps every CSV row to a roster id', () => {
		expect(fresh.unmapped).toEqual([]);
	});

	it('assigns each role a position and at least one function', () => {
		for (const [id, roles] of Object.entries(characterRoles)) {
			expect(roles.position.length, `${id} position`).toBeGreaterThan(0);
			expect(roles.function.length, `${id} function`).toBeGreaterThan(0);
		}
	});
});
