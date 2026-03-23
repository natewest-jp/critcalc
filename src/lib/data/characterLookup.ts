type CharacterAbility = {
	name?: string;
	cooldown?: number;
	duration?: number;
	energyCost?: number;
	buffs?: Array<{ stat?: string }>;
	noICD?: boolean;
	snapshots?: boolean;
};

type RawCharacter = {
	id: string;
	name: string;
	element?: string;
	weapon?: string;
	abilities?: CharacterAbility[];
};

type JsonModule = { default?: RawCharacter } | RawCharacter;

const modules = import.meta.glob('./characters/*.json', { eager: true });

const characterMap: Record<string, RawCharacter> = {};

for (const path in modules) {
	const mod = modules[path] as JsonModule;
	const data = 'default' in mod ? mod.default : mod;
	if (data && typeof data.id === 'string') {
		characterMap[data.id] = data;
	}
}

export function getCharacterById(id: string): RawCharacter | null {
	return characterMap[id] ?? null;
}

export type { RawCharacter, CharacterAbility };
