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
