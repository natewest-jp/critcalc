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
import { m } from '$lib/paraglide/messages';
import { getLocale } from './locale';

const table = () => GAME_NAMES[getLocale()];

/** The region of a character from outside Teyvat — every Traveler, Skirk and
 *  Aloy (⚓ Nate, 2026-10-15). It is not a nation, so its chip goes LAST.
 *  Stays English: it is the data's own region value, matched against
 *  `entry.region`; `regionName` shows it. */
export const REGION_OTHER = 'Other';

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

/** A weapon type's name ("Polearm", 長柄武器) from our id ("polearm"). */
export function weaponTypeName(type: string): string {
	return table()?.weaponType[type] ?? GAME_NAMES.en.weaponType[type] ?? type;
}

/** A region's name in the page's language, from the corpus's English one.
 *  "Other" is ours, not the game's, so it is a message. */
export function regionName(region: string): string {
	if (region === REGION_OTHER) return m.tb_other();
	return table()?.region[region] ?? region;
}

/** A faction's name from its id ("moonsign" → Moonsign, 月兆), the words
 *  the Builder's faction filters use. An unknown id prints as it is. */
export function factionName(id: string): string {
	if (id === 'moonsign') return m.tb_moonsign();
	if (id === 'hexerei') return m.tb_hexerei();
	return id;
}

/** A faction bonus's name, from the English the data authors
 *  (`factionBonuses[].name`). A name with no message prints as it is. */
export function factionBonusName(english: string): string {
	if (english === 'Moonsign: Ascendant Gleam') return m.planner_moonsign_ascendant_gleam();
	if (english === 'Hexerei: Secret Rite') return m.planner_hexerei_secret_rite();
	return english;
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
