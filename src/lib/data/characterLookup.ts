/**
 * src/lib/data/characterLookup.ts
 *
 * Synchronous accessors over the eager character identity index
 * (characterIndex.generated.ts). These serve the consumers that need only
 * scalar fields across the whole roster — the character selector grid,
 * CodeMirror autocomplete, saved-rotation slot resolution, and per-keystroke
 * notation→slot resolution.
 *
 * Full CharacterData payloads (abilities/passives/constellations) are NOT
 * available here — they load lazily per character via characterData.ts
 * (loadCharacter / getLoadedCharacter).
 */

import type { CharacterIndexEntry } from '$lib/types/character';
import { characterIndex } from './characterIndex.generated';

const indexById = new Map<string, CharacterIndexEntry>();
const idByDisplayName = new Map<string, string>(); // lowercase displayName -> id

for (const entry of characterIndex) {
	indexById.set(entry.id, entry);
	if (entry.displayName) {
		idByDisplayName.set(entry.displayName.toLowerCase(), entry.id);
	}
}

export function getCharacterIndexEntry(id: string): CharacterIndexEntry | null {
	return indexById.get(id) ?? null;
}

export function getIndexEntryByDisplayName(name: string): CharacterIndexEntry | null {
	const id = idByDisplayName.get(name.toLowerCase());
	return id ? (indexById.get(id) ?? null) : null;
}

export function getAllCharacterIndex(): CharacterIndexEntry[] {
	return characterIndex;
}

/**
 * Search the index by prefix/word match against both name and displayName.
 * Searches each word in the name so "Kae" matches "Kaedehara Kazuha", and
 * inserts the displayName on selection.
 */
export function searchCharacterIndex(query: string, limit = 6): CharacterIndexEntry[] {
	const q = query.toLowerCase();
	const results: CharacterIndexEntry[] = [];
	for (const entry of characterIndex) {
		const fields = [entry.name.toLowerCase(), entry.displayName.toLowerCase()];
		const matches = fields.some(
			(f) => f.startsWith(q) || f.split(/\s+/).some((word) => word.startsWith(q))
		);
		if (matches) {
			results.push(entry);
			if (results.length >= limit) break;
		}
	}
	return results;
}
