import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GAME_NAMES } from '$lib/data/gameNames.generated';
import { overwriteGetLocale, type Locale } from '$lib/paraglide/runtime';
import {
	characterName,
	characterMatches,
	characterShortName,
	factionBonusName,
	regionName,
	weaponName,
	weaponTypeName
} from './gameNames';

/**
 * The game's names in other languages (`scripts/generate-game-names.mjs`).
 * A new character, weapon, or set fails here until genshin-db names it, so no
 * locale quietly shows one English name among its own.
 */
const as = (locale: Locale) => overwriteGetLocale(() => locale);

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

const WEAPON_TYPES = ['sword', 'claymore', 'polearm', 'bow', 'catalyst'];
const regions = () =>
	[
		...new Set(
			readdirSync('src/lib/data/characters')
				.filter((f) => f.endsWith('.json'))
				.map((f) => JSON.parse(readFileSync(join('src/lib/data/characters', f), 'utf8')).region)
		)
	].filter((r) => r && r !== 'Other');

describe('the game names table', () => {
	for (const [lang, table] of Object.entries(GAME_NAMES)) {
		it(`${lang}: names every weapon type`, () => {
			expect(Object.keys(table.weaponType).sort()).toEqual([...WEAPON_TYPES].sort());
		});
		// English holds weapon types only: the corpus stores the rest in English.
		if (lang === 'en') continue;

		it(`${lang}: names every region`, () => {
			expect(Object.keys(table.region).sort()).toEqual(regions().sort());
		});

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
		as('en');
	});

	it('shows the English display name in English', () => {
		expect(characterName('kaedehara_kazuha')).toBe('Kazuha');
		expect(characterShortName('hu_tao')).toBe('Hu');
		expect(weaponName('the_widsith', 'The Widsith')).toBe('The Widsith');
	});

	it("shows the game's Japanese in Japanese", () => {
		as('ja');
		expect(characterName('kaedehara_kazuha')).toBe('楓原万葉');
		expect(characterName('traveler_anemo')).toBe('旅人（風）');
		expect(characterShortName('hu_tao')).toBe('胡桃');
		expect(weaponName('the_widsith', 'The Widsith')).toBe('流浪楽章');
	});

	it('names weapon types and regions in either language', () => {
		expect(weaponTypeName('polearm')).toBe('Polearm');
		expect(regionName('Liyue')).toBe('Liyue');
		expect(regionName('Other')).toBe('Other');
		as('ja');
		expect(weaponTypeName('polearm')).toBe('長柄武器');
		expect(regionName('Nod-Krai')).toBe('ナド・クライ');
		expect(regionName('Other')).toBe('その他');
	});

	it("names a faction bonus in the game's Japanese", () => {
		expect(factionBonusName('Moonsign: Ascendant Gleam')).toBe('Moonsign: Ascendant Gleam');
		as('ja');
		expect(factionBonusName('Moonsign: Ascendant Gleam')).toBe('月兆・満照');
		expect(factionBonusName('Hexerei: Secret Rite')).toBe('魔導秘儀');
	});

	it('falls back to English where a locale has no name', () => {
		as('zh');
		expect(characterName('traveler_anemo')).toBe('Anemo Traveler');
		as('ja');
		expect(characterName('blank')).toBe('Blank');
	});

	it('finds a character by its English or its Japanese name', () => {
		as('ja');
		expect(characterMatches(kazuha, 'kazuha')).toBe(true);
		expect(characterMatches(kazuha, '万葉')).toBe(true);
		expect(characterMatches(kazuha, 'bennett')).toBe(false);
	});
});
