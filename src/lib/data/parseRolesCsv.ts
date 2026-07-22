/**
 * src/lib/data/parseRolesCsv.ts
 *
 * Pure parser for the Imaginarium Theater roles table
 * (docs/library/game/genshin-character-roles.csv) → CharacterRoles keyed by
 * internal character id.
 *
 * Shared by the generator (scripts/generate-character-roles.mjs) and the drift
 * test (characterRoles.test.ts) so the CSV→roles mapping lives in exactly one
 * place. Runtime-import-free (only `import type`) so the Node generator can
 * type-strip it directly.
 *
 * CSV columns (by position — the header's "Survivability" carries a stray
 * soft-hyphen, so we never key off header text):
 *   0 Name  1 Element  2 On-Field  3 Off-Field  4 DPS  5 Support  6 Survivability
 * A cell counts as set when it contains the check glyph (✔); anything else
 * (✘, blank) is unset.
 */

import type { CharacterRoles, RoleFunction, RolePosition } from '$lib/types/character';

const CHECK = '✔';

/** Trim + collapse internal whitespace so " Kamisato  Ayaka " === "Kamisato Ayaka". */
export function normalizeName(raw: string): string {
	return raw.replace(/\s+/g, ' ').trim();
}

export type ParseRolesResult = {
	/** Editorial roles keyed by internal character id. */
	roles: Record<string, CharacterRoles>;
	/** CSV names (normalized) that did not resolve to a roster id — the
	 *  reconciliation report's "review these" list. */
	unmapped: string[];
};

/**
 * @param csvText   raw CSV contents (header row + one row per character)
 * @param nameToId  character `name`/`displayName` (normalized) → internal id;
 *                  seed extra alias→id entries here for any name quirk.
 */
export function parseRolesCsv(
	csvText: string,
	nameToId: Map<string, string> | Record<string, string>
): ParseRolesResult {
	const lookup = new Map<string, string>();
	const source = nameToId instanceof Map ? nameToId.entries() : Object.entries(nameToId);
	for (const [name, id] of source) lookup.set(normalizeName(name), id);

	const roles: Record<string, CharacterRoles> = {};
	const unmapped: string[] = [];
	const isSet = (cell: string | undefined) => !!cell && cell.includes(CHECK);

	const lines = csvText.split(/\r?\n/);
	for (let i = 1; i < lines.length; i++) {
		// row 0 is the header
		const line = lines[i];
		if (!line.trim()) continue;
		const cells = line.split(',');
		if (cells.length < 7) continue; // malformed / short row

		const name = normalizeName(cells[0]);
		if (!name) continue;
		const id = lookup.get(name);
		if (!id) {
			unmapped.push(name);
			continue;
		}

		const position: RolePosition[] = [];
		if (isSet(cells[2])) position.push('onField');
		if (isSet(cells[3])) position.push('offField');

		const fn: RoleFunction[] = [];
		if (isSet(cells[4])) fn.push('dps');
		if (isSet(cells[5])) fn.push('support');
		if (isSet(cells[6])) fn.push('survivability');

		roles[id] = { position, function: fn };
	}

	return { roles, unmapped };
}
