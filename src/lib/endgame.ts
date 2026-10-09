/**
 * src/lib/endgame.ts
 *
 * The endgame presets' model (lineups design §2.6, §10.5): Stygian Onslaught
 * seasons, their battlefields and bosses, read from the committed
 * `data/endgame/stygian.json` (written by `scripts/fetch-endgame.mjs` from
 * lunaris.moe; images by `build-endgame-art.mjs`). Pure: a caller passes
 * today's date, so a test can stand anywhere in time.
 *
 * ⚓ NO LEAKS: a season shows only once its live date (the hand-maintained
 * `season-dates.json`) has passed. The data file can already hold the next
 * one; `liveSeasons` is the gate.
 *
 * ⚓ Fearless and Dire only (Nate 2026-10-09) — difficulty 5 (level 105) and
 * 6 (level 110).
 */

import data from './data/endgame/stygian.json';
import abyssData from './data/endgame/abyss.json';

/** One string in every language the source carries ('' is dropped). */
export type Localized = { en: string; zh?: string; pt?: string; ru?: string; fr?: string };

export type Boss = {
	name: Localized;
	description: Localized;
	/** The boss's named abilities, with the game's text (`**x**` = the game's
	 *  highlight). */
	mechanics: { name: Localized; text: Localized }[];
	/** Elemental RES in percent. */
	res: Record<
		'pyro' | 'hydro' | 'dendro' | 'electro' | 'anemo' | 'cryo' | 'geo' | 'physical',
		number
	>;
};

export type BattlefieldCheck = {
	/** The game's thumbs-up or thumbs-down. */
	tag: 'favoured' | 'disfavoured';
	/** The game's wording: alternatives joined by ' | ', icons as `{sprite:N}`. */
	text: Localized;
};

export type Battlefield = {
	boss: string;
	/** ⚠️ Per SEASON: a rerun can change it (Frostnight Herra, 6.1 → 6.5). */
	hp: { fearless: number; dire: number };
	checks: BattlefieldCheck[];
};

export type Season = {
	version: string;
	/** Live dates, ISO (start inclusive, end exclusive). */
	start: string;
	end: string;
	battlefields: Battlefield[];
};

export const BOSSES = data.bosses as Record<string, Boss>;
export const SEASONS = data.seasons as Season[];

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** The seasons that have gone live by `today`, newest first. */
export function liveSeasons(
	today: Date = new Date(),
	seasons: readonly Season[] = SEASONS
): Season[] {
	const day = isoDay(today);
	return seasons.filter((s) => s.start <= day).sort((a, b) => b.start.localeCompare(a.start));
}

/** The season running on `today` — else the most recent one (between seasons,
 *  or when the date table has not been extended yet). */
export function currentSeason(
	today: Date = new Date(),
	seasons: readonly Season[] = SEASONS
): Season | undefined {
	return liveSeasons(today, seasons)[0];
}

/** Every live season a boss ran in, newest first — "previously in 6.1". */
export function bossRuns(
	boss: string,
	today: Date = new Date(),
	seasons: readonly Season[] = SEASONS
): Season[] {
	return liveSeasons(today, seasons).filter((s) => s.battlefields.some((b) => b.boss === boss));
}

// ---------------------------------------------------------------------------
// A check's text, as parts the view can draw
// ---------------------------------------------------------------------------

/** What a game sprite means — the seven elements, and the reaction icons as
 *  their element PAIR (identified 2026-10-09 against the sprites themselves). */
export const SPRITES: Record<number, { elements: string[] }> = {
	11001: { elements: ['cryo'] },
	11002: { elements: ['hydro'] },
	11003: { elements: ['pyro'] },
	11004: { elements: ['electro'] },
	11005: { elements: ['anemo'] },
	11006: { elements: ['geo'] },
	11007: { elements: ['dendro'] },
	11022: { elements: ['electro', 'cryo'] },
	11024: { elements: ['electro', 'anemo'] },
	11027: { elements: ['pyro', 'cryo'] },
	11028: { elements: ['pyro', 'anemo'] },
	11029: { elements: ['dendro', 'hydro'] },
	11034: { elements: ['hydro', 'electro'] },
	11035: { elements: ['hydro', 'pyro'] }
};

export type CheckPart = { text: string } | { sprite: number };

/** "{sprite:11034} reactions | {sprite:11004} characters" → two alternatives,
 *  each a run of text and sprite parts. */
export function checkAlternatives(text: string): CheckPart[][] {
	return text.split(' | ').map((alt) =>
		alt
			.split(/(\{sprite:\d+\})/)
			.filter((p) => p.trim())
			.map((p) => {
				const m = p.match(/^\{sprite:(\d+)\}$/);
				return m ? { sprite: Number(m[1]) } : { text: p.trim() };
			})
	);
}

/** The public path of a boss's image: its full art, or its circle avatar. */
export function bossImage(boss: string, kind: 'art' | 'icon'): string {
	return `/assets/endgame/stygian/${boss}${kind === 'icon' ? '-icon' : ''}.webp`;
}

export const spriteImage = (id: number) => `/assets/endgame/sprites/${id}.webp`;

/** A localized field in `lang`, falling back to English. */
export const inLang = (l: Localized, lang = 'en') =>
	(l as Record<string, string | undefined>)[lang] ?? l.en;

// ---------------------------------------------------------------------------
// The Abyss — its blessing only (Nate 2026-10-09)
// ---------------------------------------------------------------------------

export type AbyssCycle = {
	/** Live dates, ISO (start inclusive, end exclusive). */
	start: string;
	end: string;
	/** The blessing's banner art, 2:1 (`/assets/endgame/abyss/{icon}.webp`). */
	icon: string;
	name: Localized;
	/** The blessing's text (`**x**` = the game's highlight). */
	text: Localized;
	/** Floor 12's first- and second-half blessings — team 1 fights the first
	 *  half, team 2 the second. */
	halves: [Localized, Localized];
};

export const ABYSS_CYCLES = abyssData.cycles as AbyssCycle[];

/** The Abyss cycle running on `today`, else the most recent live one. */
export function currentAbyss(
	today: Date = new Date(),
	cycles: readonly AbyssCycle[] = ABYSS_CYCLES
): AbyssCycle | undefined {
	const day = isoDay(today);
	return cycles.filter((c) => c.start <= day).sort((a, b) => b.start.localeCompare(a.start))[0];
}

export const blessingImage = (icon: string) => `/assets/endgame/abyss/${icon}.webp`;
