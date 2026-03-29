import type { Ability, AbilityTag, Element, Input, Stat } from '$lib/types/ability';
import type { RawCharacter } from '$lib/types/character';
import type { WeaponType } from '$lib/types/weapon';

type AbilityInput = Partial<Ability> & { name: string; type?: Ability["type"] };

type RawCharacterInput = Omit<
	RawCharacter,
	'abilities' | 'passives' | 'constellations' | 'element' | 'weapon'
> & {
	abilities?: AbilityInput[];
	passives?: AbilityInput[];
	constellations?: AbilityInput[];
	element?: string;
	weapon?: string;
};

type JsonModule = { default?: RawCharacterInput } | RawCharacterInput;

const modules = import.meta.glob('./characters/*.json', { eager: true });

const characterMap: Record<string, RawCharacter> = {};

function normalizeElement(value?: string): Element | undefined {
	if (!value) {
		return undefined;
	}
	return value.toLowerCase() as Element;
}

function normalizeWeapon(value?: string): WeaponType | undefined {
	if (!value) {
		return undefined;
	}
	return value.toLowerCase() as WeaponType;
}

function normalizeStat(value: string): Stat {
	const normalized = value === 'dmgBonus' ? 'allDmgBonus' : value;
	return normalized as Stat;
}

function normalizeTag(value: string): AbilityTag {
	const normalizedValue = value.toLowerCase();
	const normalized =
		normalizedValue === 'coordinatedattacks'
			? 'coordinatedAttack'
			: normalizedValue === 'heals'
				? 'heal'
				: normalizedValue === 'infuses'
					? 'infuse'
					: normalizedValue === 'shields'
						? 'shield'
						: normalizedValue === 'summons'
							? 'summon'
							: normalizedValue === 'taunts'
								? 'taunt'
								: normalizedValue;
	return normalized as AbilityTag;
}

function normalizeAbility(
	ability: AbilityInput,
	characterId: string,
	kind: 'abilities' | 'passives' | 'constellations',
	index: number
): Ability {
	const abilityType = ability.abilityType ?? resolveAbilityType(kind, index);
	const input = ability.input ?? resolveInput(abilityType);
	const id = ability.id ?? buildAbilityId(characterId, abilityType, index);
	const type = ability.type ?? 'instant';
	const tags = ability.tags?.map((tag) => normalizeTag(String(tag)));
	const buffs = ability.buffs?.map((buff) => ({
		...buff,
		stat: normalizeStat(String(buff.stat))
	}));

	return {
		...ability,
		id,
		input,
		abilityType,
		type,
		...(tags ? { tags } : {}),
		...(buffs ? { buffs } : {})
	} as Ability;
}

function resolveAbilityType(
	kind: 'abilities' | 'passives' | 'constellations',
	index: number
): Ability['abilityType'] {
	if (kind === 'passives') {
		return 'passive';
	}
	if (kind === 'constellations') {
		return 'constellation';
	}
	const mapping: Ability['abilityType'][] = ['normal', 'skill', 'burst'];
	return mapping[index] ?? 'skill';
}

function resolveInput(abilityType: Ability['abilityType']): Input {
	switch (abilityType) {
		case 'skill':
			return 'E';
		case 'burst':
			return 'Q';
		case 'charged':
			return 'C';
		case 'plunge':
			return 'P';
		default:
			return 'N';
	}
}

function buildAbilityId(characterId: string, abilityType: Ability['abilityType'], index: number): string {
	if (abilityType === 'normal' || abilityType === 'skill' || abilityType === 'burst') {
		return `${characterId}-${abilityType}`;
	}
	return `${characterId}-${abilityType}-${index + 1}`;
}

function normalizeCharacter(data: RawCharacterInput): RawCharacter {
	return {
		...data,
		element: normalizeElement(data.element),
		weapon: normalizeWeapon(data.weapon),
		abilities: data.abilities?.map((ability, index) =>
			normalizeAbility(ability, data.id, 'abilities', index)
		),
		passives: data.passives?.map((ability, index) =>
			normalizeAbility(ability, data.id, 'passives', index)
		),
		constellations: data.constellations?.map((ability, index) =>
			normalizeAbility(ability, data.id, 'constellations', index)
		)
	};
}

for (const path in modules) {
	const mod = modules[path] as JsonModule;
	const data = 'default' in mod ? mod.default : mod;
	if (data && typeof data.id === 'string') {
		characterMap[data.id] = normalizeCharacter(data);
	}
}

export function getCharacterById(id: string): RawCharacter | null {
	return characterMap[id] ?? null;
}
