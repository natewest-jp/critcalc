/**
 * src/lib/theater.ts
 *
 * Imaginarium Theater, measured against a roster (⚓ Nate 2026-11-11): which
 * modes the player's characters open this season, and how many Blessing
 * Levels each extra cast member past a mode's minimum brings. Not fights: the
 * Theater deals characters in by events and chance, so the cast is the plan.
 *
 * The rules, with sources: `docs/library/game/imaginarium-theater.md`. The
 * data: `data/endgame/theater.json`, written by `scripts/fetch-endgame.mjs`
 * from lunaris.moe's live build. Pure: a caller passes today's date and the
 * roster, so a test can stand anywhere.
 *
 * ⚠️ Two counts. lunaris (and so the data) counts the ALTERNATE Cast, the
 * characters the player brings; the game's own requirement lines count the
 * WHOLE cast, which adds the six Opening Characters (always available, as
 * trials when not owned). Every number below is Alternate Cast unless it says
 * "whole".
 */

import data from './data/endgame/theater.json';
import { characterIndex } from './data/characterIndex.generated';
import { characterRoles } from './data/characterRoles.generated';
import type { Element } from './types/ability';
import type { Localized } from './endgame';
import { newestFirst } from './utils/release';

export type TheaterMode = 'easy' | 'normal' | 'hard' | 'visionary' | 'lunar';

export type TheaterFight = {
	/** Monster level. */
	level: number;
	name: Localized;
	/** Monster icons (`monsterImage`), in the game's order. */
	icons: string[];
};

export type TheaterModeRules = {
	mode: TheaterMode;
	/** Acts, not counting Lunar Mode's Arcanum Challenges. */
	acts: number;
	/** The Alternate Cast a run must start with. */
	alternate: number;
	/** How many more may join past that, each raising the Blessing Level. */
	extra: number;
	/** The level every brought character must have reached. */
	level: number;
	/** The boss acts (the Climactic Showdowns), in order. */
	bosses: (TheaterFight & { act: number })[];
	/** Lunar Mode's optional Arcanum Challenges (empty elsewhere). */
	arcana: TheaterFight[];
};

export type TheaterSeason = {
	/** Live dates, ISO (start inclusive, end exclusive): the 1st to the 1st. */
	start: string;
	end: string;
	elements: Element[];
	/** The six Opening Characters: two of each element, offered as trials. */
	opening: string[];
	/** The four Special Guest Stars, from outside the season's elements. */
	guests: string[];
	/** Easy to Lunar, in the game's order. */
	modes: TheaterModeRules[];
};

export const THEATER_SEASONS = data.seasons as TheaterSeason[];

/** The Opening Characters every run starts with. */
export const OPENING_CAST = 6;
/** Each Alternate Cast member past a mode's minimum: +2 Blessing Levels. */
export const BLESSING_LEVELS_PER_EXTRA = 2;
/** What one Blessing Level gives every character in the performance. Special
 *  Guest Stars get double (`GUEST_BLESSING_MULTIPLIER`). */
export const BLESSING_LEVEL_STATS = { hp: 800, atk: 50, def: 50, em: 20 } as const;
export const GUEST_BLESSING_MULTIPLIER = 2;
/** Fantasia Flowers per extra member (Nate's two screenshots, 2026-11-11:
 *  one extra gave 30, two gave 60). */
export const FLOWERS_PER_EXTRA = 30;
/** Friends' characters a run may invite (one, at every mode). */
export const SUPPORTING_CAST = 1;

/** A character's element: the corpus's, else the season data's own record of
 *  a character the corpus doesn't have yet. */
const ELEMENTS: Record<string, Element> = {
	...Object.fromEntries(
		Object.entries(data.characters as Record<string, { element: Element }>).map(([id, c]) => [
			id,
			c.element
		])
	),
	...Object.fromEntries(
		characterIndex.flatMap((c) => (c.element ? [[c.id, c.element] as const] : []))
	)
};

export const theaterElement = (id: string): Element | undefined => ELEMENTS[id];

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** The season running on `today`, else nothing: a month's rules are no
 *  answer to "can I enter this month?" once the month has moved on. */
export function currentTheater(
	today: Date = new Date(),
	seasons: readonly TheaterSeason[] = THEATER_SEASONS
): TheaterSeason | undefined {
	const day = isoDay(today);
	return seasons.find((s) => s.start <= day && day < s.end);
}

/** The seasons that have opened by `today`, newest first. */
export function liveTheaterSeasons(
	today: Date = new Date(),
	seasons: readonly TheaterSeason[] = THEATER_SEASONS
): TheaterSeason[] {
	const day = isoDay(today);
	return seasons.filter((s) => s.start <= day).sort((a, b) => b.start.localeCompare(a.start));
}

/** The game's names for the modes. */
export const MODE_NAME: Record<TheaterMode, string> = {
	easy: 'Easy',
	normal: 'Normal',
	hard: 'Hard',
	visionary: 'Visionary',
	lunar: 'Lunar'
};

/** What the roster says about a character. */
export type TheaterRoster = {
	owned: (id: string) => boolean;
	/** The player's "can't enter Theater" mark (⚓ Nate 2026-11-11): not
	 *  leveled. One mark for every mode, so a character between 60 and 69
	 *  reads as out of Easy and Normal too; those modes need only 2 and 6. */
	excluded: (id: string) => boolean;
};

/**
 * The characters this roster can bring as Alternate Cast: owned, not marked,
 * of the season's elements or one of its Special Guest Stars, and not an
 * Opening Character (they start in the Principal Cast already). Newest
 * first, the grid's own order (⚓ Nate 2026-11-11), so Auto-select numbers
 * its picks in the order the grid shows them.
 *
 * ⚠️ One Traveler at most: the roster keeps one entry per element, but the
 * game has one Traveler. An owned Traveler of a season's element counts once.
 */
export function eligibleCast(season: TheaterSeason, roster: TheaterRoster): string[] {
	const out: string[] = [];
	let traveler = false;
	for (const id of Object.keys(ELEMENTS).sort(byNewest)) {
		if (!roster.owned(id) || roster.excluded(id) || !fitsSeason(season, id)) continue;
		if (id.startsWith('traveler_')) {
			if (traveler) continue;
			traveler = true;
		}
		out.push(id);
	}
	return out;
}

/** Whether a character can be in this season's Alternate Cast at all: of
 *  its elements or a Special Guest Star, and not an Opening Character. */
export function fitsSeason(season: TheaterSeason, id: string): boolean {
	if (season.opening.includes(id)) return false;
	return season.elements.includes(ELEMENTS[id]) || season.guests.includes(id);
}

const ENTRIES = new Map(characterIndex.map((c) => [c.id, c]));
/** Newest patch first, then by name; a character the corpus lacks goes last. */
function byNewest(a: string, b: string): number {
	const ea = ENTRIES.get(a);
	const eb = ENTRIES.get(b);
	if (!ea || !eb) return Number(!ea) - Number(!eb) || a.localeCompare(b);
	return newestFirst(ea, eb);
}

export type ModeVerdict = {
	mode: TheaterMode;
	/** The Alternate Cast the mode needs, and the most it takes. */
	need: number;
	most: number;
	/** The Alternate Cast this roster brings (with an invite, if counted),
	 *  capped at `most`. */
	have: number;
	open: boolean;
	/** How many short of `need` (0 when open). */
	short: number;
	/** Members past `need`, up to the mode's `extra`. */
	extras: number;
	blessingLevels: number;
	/** The whole cast the game's screen would count: Opening + `have`. */
	wholeCast: number;
};

/** Every mode's answer for a roster that can bring `cast` Alternate Cast
 *  members, plus a friend's character when `invite` is set. */
export function modeVerdicts(
	season: TheaterSeason,
	cast: number,
	{ invite = false }: { invite?: boolean } = {}
): ModeVerdict[] {
	const pool = cast + (invite ? SUPPORTING_CAST : 0);
	return season.modes.map((m) => {
		const most = m.alternate + m.extra;
		const have = Math.min(pool, most);
		const extras = Math.max(0, have - m.alternate);
		return {
			mode: m.mode,
			need: m.alternate,
			most,
			have,
			open: have >= m.alternate,
			short: Math.max(0, m.alternate - have),
			extras,
			blessingLevels: extras * BLESSING_LEVELS_PER_EXTRA,
			wholeCast: OPENING_CAST + have
		};
	});
}

/** The highest mode a verdict list opens, if any. */
export const highestOpen = (verdicts: readonly ModeVerdict[]) =>
	verdicts.filter((v) => v.open).at(-1);

/** The attributes `levels` Blessing Levels give (doubled for a Special Guest
 *  Star). */
export function blessingStats(levels: number, { guest = false }: { guest?: boolean } = {}) {
	const k = levels * (guest ? GUEST_BLESSING_MULTIPLIER : 1);
	return {
		hp: BLESSING_LEVEL_STATS.hp * k,
		atk: BLESSING_LEVEL_STATS.atk * k,
		def: BLESSING_LEVEL_STATS.def * k,
		em: BLESSING_LEVEL_STATS.em * k
	};
}

export type CastStats = {
	elements: Partial<Record<Element, number>>;
	onField: number;
	offField: number;
	dps: number;
	support: number;
	survivability: number;
};

/**
 * The Party Setup screen's Stats row for a cast: how many of each element,
 * and of each role (the game's own Theater classification). Pass the whole
 * cast, Opening Characters included, as the game counts it. A character with
 * two tags counts under both.
 */
export function castStats(ids: readonly string[]): CastStats {
	const out: CastStats = {
		elements: {},
		onField: 0,
		offField: 0,
		dps: 0,
		support: 0,
		survivability: 0
	};
	for (const id of ids) {
		const e = ELEMENTS[id];
		if (e) out.elements[e] = (out.elements[e] ?? 0) + 1;
		const r = characterRoles[id];
		if (!r) continue; // TODO: data gap — roles for a character not yet in the corpus
		if (r.position.includes('onField')) out.onField++;
		if (r.position.includes('offField')) out.offField++;
		for (const f of r.function) out[f]++;
	}
	return out;
}

// ---------------------------------------------------------------------------
// A lineup's cast (⚓ Nate 2026-11-11)
// ---------------------------------------------------------------------------

export const isTraveler = (id: string) => id.startsWith('traveler_');

/** How many of their own characters the player may pick at `mode`: the
 *  mode's most, less the friend's character when one is counted. */
export function castRoom(rules: TheaterModeRules, invite = false): number {
	return rules.alternate + rules.extra - (invite ? SUPPORTING_CAST : 0);
}

/**
 * A pick on the grid: in the cast it leaves; out, it joins at the end. One
 * Traveler at most (⚓ Nate): a second Traveler takes the first one's place
 * and number. `'full'` when there is no room, so the card can nudge.
 */
export function toggleCast(cast: readonly string[], id: string, room: number): string[] | 'full' {
	if (cast.includes(id)) return cast.filter((c) => c !== id);
	if (isTraveler(id)) {
		const at = cast.findIndex(isTraveler);
		if (at >= 0) return cast.map((c, i) => (i === at ? id : c));
	}
	return cast.length >= room ? 'full' : [...cast, id];
}

/** Auto-select (⚓ Nate 2026-11-11: only on its button, never on its own):
 *  the Special Guest Stars first, then the eligible cast in its order
 *  (newest first), up to `room`. ⚓ Guests first (Nate): they are the most
 *  valuable additions, since their Blessing Level buffs are doubled and they
 *  bring reactions from outside the season's three elements. */
export function autoCast(
	season: TheaterSeason,
	eligible: readonly string[],
	room: number
): string[] {
	const guest = (id: string) => season.guests.includes(id);
	return [...eligible.filter(guest), ...eligible.filter((id) => !guest(id))].slice(0, room);
}

/** The mode a lineup starts at: the highest the roster opens, else the
 *  lowest (so a new player still sees what each mode asks). */
export function defaultMode(season: TheaterSeason, eligible: number, invite = false): TheaterMode {
	return (highestOpen(modeVerdicts(season, eligible, { invite })) ?? season.modes[0]).mode;
}
