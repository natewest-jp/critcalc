import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GAME_NAMES } from '$lib/data/gameNames.generated';

/**
 * The game's names in other languages (`scripts/generate-game-names.mjs`).
 * A new character, weapon, or set fails here until genshin-db names it, so no
 * locale quietly shows one English name among its own.
 */
const locale = vi.hoisted(() => ({ value: 'en' }));
vi.mock('./locale', () => ({ getLocale: () => locale.value }));

const { characterName, characterMatches, characterShortName, weaponName } =
	await import('./gameNames');

const ids = (dir: string) =>
	readdirSync(join('src/lib/data', dir))
		.filter((f) => f.endsWith('.json'))
		.map((f) => JSON.parse(readFileSync(join('src/lib/data', dir, f), 'utf8')).id as string);

/** Not a game character: the planner's placeholder kit. */
const NOT_IN_GAME = ['blank'];
/** genshin-db's elements carry no Chinese, so Chinese Travelers wait for the
 *  Chinese term list. */
const KNOWN_GAPS: Record<string, string[]> = {
	ja: [],
	zh: ids('characters').filter((id) => id.startsWith('traveler_'))
};

describe('the game names table', () => {
	for (const [lang, table] of Object.entries(GAME_NAMES)) {
		it(`${lang}: names every character, weapon, and set`, () => {
			const missing = [
				...ids('characters').filter((id) => !NOT_IN_GAME.includes(id) && !table.character[id]),
				...ids('weapons').filter((id) => !table.weapon[id]),
				...ids('artifacts').filter((id) => !table.artifact[id])
			];
			expect(missing.sort()).toEqual([...KNOWN_GAPS[lang]].sort());
		});

		// The planner's buff rows are keyed by a label that starts with the
		// character's name, so two characters must never share one.
		it(`${lang}: no two characters share a name`, () => {
			const names = Object.values(table.character);
			expect(new Set(names).size).toBe(names.length);
		});
	}
});

const kazuha = { id: 'kaedehara_kazuha', displayName: 'Kazuha' };

describe('names in the page language', () => {
	beforeEach(() => {
		locale.value = 'en';
	});

	it('shows the English display name in English', () => {
		expect(characterName('kaedehara_kazuha')).toBe('Kazuha');
		expect(characterShortName('hu_tao')).toBe('Hu');
		expect(weaponName('the_widsith', 'The Widsith')).toBe('The Widsith');
	});

	it("shows the game's Japanese in Japanese", () => {
		locale.value = 'ja';
		expect(characterName('kaedehara_kazuha')).toBe('楓原万葉');
		expect(characterName('traveler_anemo')).toBe('旅人（風）');
		expect(characterShortName('hu_tao')).toBe('胡桃');
		expect(weaponName('the_widsith', 'The Widsith')).toBe('流浪楽章');
	});

	it('falls back to English where a locale has no name', () => {
		locale.value = 'zh';
		expect(characterName('traveler_anemo')).toBe('Anemo Traveler');
		locale.value = 'ja';
		expect(characterName('blank')).toBe('Blank');
	});

	it('finds a character by its English or its Japanese name', () => {
		locale.value = 'ja';
		expect(characterMatches(kazuha, 'kazuha')).toBe(true);
		expect(characterMatches(kazuha, '万葉')).toBe(true);
		expect(characterMatches(kazuha, 'bennett')).toBe(false);
	});
});
