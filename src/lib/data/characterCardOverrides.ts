import type { CharacterCardOverride } from '$lib/types/ability';

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
