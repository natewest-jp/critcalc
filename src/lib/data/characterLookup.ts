import type { CharacterData } from '$lib/types/character';

type JsonModule = { default?: CharacterData } | CharacterData;

const modules = import.meta.glob('./characters/*.json', { eager: true });

const characterMap: Record<string, CharacterData> = {};
const displayNameMap: Record<string, string> = {}; // lowercase displayName -> id

for (const path in modules) {
	const mod = modules[path] as JsonModule;
	const data = ('default' in mod ? mod.default : mod) as CharacterData | undefined;
	if (data?.id) {
		characterMap[data.id] = data;
		if (data.displayName) {
			displayNameMap[data.displayName.toLowerCase()] = data.id;
		}
	}
}

export function getCharacterById(id: string): CharacterData | null {
	return characterMap[id] ?? null;
}

export function getCharacterByDisplayName(name: string): CharacterData | null {
	const id = displayNameMap[name.toLowerCase()];
	return id ? (characterMap[id] ?? null) : null;
}

export function getAllCharacters(): CharacterData[] {
	return Object.values(characterMap);
}

/**
 * Search characters by prefix/word match against both name and displayName.
 * Searches each word in the name so "Kae" matches "Kaedehara Kazuha", and
 * inserts the displayName on selection.
 */
export function searchCharacters(query: string, limit = 6): CharacterData[] {
	const q = query.toLowerCase();
	const results: CharacterData[] = [];
	for (const char of Object.values(characterMap)) {
		const fields = [char.name.toLowerCase(), char.displayName.toLowerCase()];
		const matches = fields.some(
			(f) => f.startsWith(q) || f.split(/\s+/).some((word) => word.startsWith(q))
		);
		if (matches) {
			results.push(char);
			if (results.length >= limit) break;
		}
	}
	return results;
}
