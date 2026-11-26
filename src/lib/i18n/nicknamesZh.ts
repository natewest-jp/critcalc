/**
 * The short names Chinese guides write for characters instead of the game's
 * names (雷神 for 雷电将军). Hand-written, because no game data carries them,
 * and each entry names where it was seen. The research, and the questions
 * still open for a Chinese player, are in
 * `docs/rounds/zh-shorthand-research-2026-11-26.md`.
 *
 * A nickname with two owners lists both. It is then offered as either and
 * never converted on its own (`$lib/i18n/notationNames`).
 *
 * Only nicknames a guide was seen to use go here. A community answer adds
 * or splits an entry.
 */

export interface Nickname {
	/** As guides write it. */
	name: string;
	/** The characters it can mean, by id. One id, unless guides disagree. */
	ids: readonly string[];
	/** Where it was seen. */
	source: string;
}

/** Where the Traveler nicknames were seen (`travelerNicknames`). */
const TRAVELER_SOURCE = '草主 (18183, 2024) and 雷主 (7723, 2024); the others by the same pattern';

export const ZH_NICKNAMES: readonly Nickname[] = [
	{ name: '雷神', ids: ['raiden_shogun'], source: '18183 (2024), 18183 team terms (2022)' },
	{ name: '仆人', ids: ['arlecchino'], source: '17173 Arlecchino guide (2025)' },
	{ name: '万叶', ids: ['kaedehara_kazuha'], source: 'most guides read, 2021 to 2025' },
	{ name: '那维', ids: ['neuvillette'], source: 'Gamersky Mavuika guide (2025)' },
	{ name: '龙王', ids: ['neuvillette'], source: '7723 Neuvillette guide (2024), stated' },
	{ name: '九条', ids: ['kujou_sara'], source: 'Gamersky Raiden and Sara (2021), 17173 (2025)' },
	{ name: '神子', ids: ['yae_miko'], source: '18183 Yae Miko teams (2024)' },
	{ name: '公子', ids: ['tartaglia'], source: '7723 (2024), stated; ali213 nicknames (2024)' },
	{ name: '草神', ids: ['nahida'], source: 'ali213 nicknames (2024)' },
	{ name: '风神', ids: ['venti'], source: 'ali213 nicknames (2024)' },
	{ name: '皇女', ids: ['fischl'], source: 'ali213 nicknames (2024)' },
	{ name: '心海', ids: ['sangonomiya_kokomi'], source: '18183 team terms (2022)' },
	{ name: '绫人', ids: ['kamisato_ayato'], source: 'Gamersky team list (2023)' },
	// Two owners: guides and the nickname lists disagree.
	{
		name: '火神',
		ids: ['mavuika', 'bennett'],
		source: 'Mavuika in 17173 (2025); Bennett in ali213 nicknames (2024)'
	},
	{
		name: '水神',
		ids: ['furina', 'xingqiu'],
		source: 'Furina in 7723 (2024); Xingqiu in ali213 nicknames (2024)'
	},
	{
		name: '神里',
		ids: ['kamisato_ayaka', 'kamisato_ayato'],
		source: 'Ayaka in ali213 nicknames (2024); the two share the family name'
	}
];

/** The Travelers, as guides write them: the element's one-character name and
 *  主 (草主 is the Dendro Traveler), built from the game's element names so
 *  风主 uses the same 风 as 旅行者（风）. */
export function travelerNicknames(element: Record<string, string>): Nickname[] {
	return Object.entries(element).map(([el, name]) => ({
		name: `${name}主`,
		ids: [`traveler_${el}`],
		source: TRAVELER_SOURCE
	}));
}
