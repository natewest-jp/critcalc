/**
 * The game's names for characters, weapons, and artifact sets, in the page's
 * language. English comes from the data itself; every other locale from the
 * table `scripts/generate-game-names.mjs` reads out of genshin-db, falling back
 * to English where genshin-db has no name.
 *
 * ⚠️ Display only. Notation, search terms the parser reads, saved data, and
 * anything compared against English keep the English name.
 */
import { GAME_NAMES } from '$lib/data/gameNames.generated';
import { getCharacterIndexEntry, shortName } from '$lib/data/characterLookup';
import { getLocale } from './locale';

const table = () => GAME_NAMES[getLocale()];

/** A character's name as the page shows it: the English display name
 *  ("Kazuha"), or the game's name in the page's language (楓原万葉).
 *  `english` is the caller's display name when it holds the character
 *  already; otherwise the index supplies it. */
export function characterName(id: string, english?: string): string {
	return table()?.character[id] ?? english ?? getCharacterIndexEntry(id)?.displayName ?? id;
}

/** The name a sentence uses: the game's name in the page's language, which
 *  has no first word to cut, else English's `shortName` ("Hu" of "Hu Tao"). */
export function characterShortName(id: string): string {
	return table()?.character[id] ?? shortName(id);
}

/** A weapon's name in the page's language; `english` is the data's name. */
export function weaponName(id: string, english: string): string {
	return table()?.weapon[id] ?? english;
}

/** An artifact set's name in the page's language; `english` is the data's name. */
export function artifactName(id: string, english: string): string {
	return table()?.artifact[id] ?? english;
}

/** Whether `query` (already lowercased) finds this character by any name the
 *  page might show or the player might type: its English display name or the
 *  page's own. */
export function characterMatches(
	entry: { id: string; displayName: string },
	query: string
): boolean {
	return [entry.displayName, table()?.character[entry.id]].some((n) =>
		n?.toLowerCase().includes(query)
	);
}
