export type SkillVariant = {
	key: string;
	label: string;
	duration?: number | null;
	cooldown?: number | null;
};

export type SkillOverride = {
	variants?: SkillVariant[];
	duration?: number | null;
	cooldown?: number | null;
};

export type BurstOverride = {
	duration?: number | null;
	cooldown?: number | null;
	energyCost?: number | null;
};

export type CharacterCardOverride = {
	skill?: SkillOverride;
	burst?: BurstOverride;
};

export const characterCardOverrides: Record<string, CharacterCardOverride> = {
	bennett: {
		skill: {
			variants: [
				{ key: 'h1', label: 'hold 1', cooldown: 7.5 },
				{ key: 'h2', label: 'hold 2', cooldown: 10 }
			]
		},
		burst: {
			duration: 12
		}
	}
};

export function getCharacterCardOverride(id: string): CharacterCardOverride | null {
	return characterCardOverrides[id] ?? null;
}
