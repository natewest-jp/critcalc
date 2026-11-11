import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
	THEATER_SEASONS,
	blessingStats,
	castStats,
	currentTheater,
	eligibleCast,
	highestOpen,
	modeVerdicts,
	theaterElement,
	type TheaterSeason
} from './theater';
import { monsterImage } from './endgame';
import { characterRoles } from './data/characterRoles.generated';

/**
 * Imaginarium Theater (`docs/library/game/imaginarium-theater.md`). The data
 * is GENERATED from lunaris.moe, so the first block holds what a re-fetch must
 * keep; the rest checks the model against the game's own numbers.
 */

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const november = THEATER_SEASONS.find((s) => s.start === '2026-11-01') as TheaterSeason;

describe('the Theater data', () => {
	it('has seasons, each a month from the 1st', () => {
		expect(THEATER_SEASONS.length).toBeGreaterThan(0);
		for (const s of THEATER_SEASONS) {
			expect(s.start.slice(8), s.start).toBe('01');
			expect(s.end.slice(8), s.start).toBe('01');
		}
	});

	it('names six Opening Characters, two of each element, and four guests from outside them', () => {
		for (const s of THEATER_SEASONS) {
			expect(s.elements, s.start).toHaveLength(3);
			expect(s.opening, s.start).toHaveLength(6);
			for (const e of s.elements)
				expect(
					s.opening.filter((id) => theaterElement(id) === e),
					`${s.start} ${e}`
				).toHaveLength(2);
			expect(s.guests, s.start).toHaveLength(4);
			for (const id of s.guests) {
				expect(theaterElement(id), id).toBeDefined();
				expect(s.elements, `${s.start} ${id}`).not.toContain(theaterElement(id));
			}
		}
	});

	// The game's requirement lines count the WHOLE cast (Fandom, read 2026-11-11):
	// Opening Characters + Alternate Cast. The data counts the Alternate Cast.
	it("matches the game's whole-cast requirements once the six Opening Characters are added", () => {
		const game = {
			easy: { start: 8, most: 10, level: 60 },
			normal: { start: 12, most: 14, level: 60 },
			hard: { start: 16, most: 20, level: 70 },
			visionary: { start: 22, most: 26, level: 70 },
			lunar: { start: 28, most: 32, level: 70 }
		};
		for (const s of THEATER_SEASONS) {
			expect(s.modes.map((m) => m.mode)).toEqual(Object.keys(game));
			for (const m of s.modes) {
				const g = game[m.mode];
				expect(6 + m.alternate, `${s.start} ${m.mode}`).toBe(g.start);
				expect(6 + m.alternate + m.extra, `${s.start} ${m.mode}`).toBe(g.most);
				expect(m.level, `${s.start} ${m.mode}`).toBe(g.level);
			}
		}
	});

	it('gives Lunar Mode its two Arcanum Challenges and every mode its boss acts', () => {
		for (const s of THEATER_SEASONS)
			for (const m of s.modes) {
				expect(m.bosses.length, `${s.start} ${m.mode}`).toBeGreaterThan(0);
				expect(m.bosses.at(-1)?.act, `${s.start} ${m.mode}`).toBe(m.acts);
				expect(m.arcana, `${s.start} ${m.mode}`).toHaveLength(m.mode === 'lunar' ? 2 : 0);
			}
	});

	it('has every monster icon it names', () => {
		const STATIC = join(process.cwd(), 'static');
		for (const s of THEATER_SEASONS)
			for (const m of s.modes)
				for (const f of [...m.bosses, ...m.arcana])
					for (const icon of f.icons)
						expect(existsSync(join(STATIC, monsterImage(icon))), icon).toBe(true);
	});
});

describe('the running season', () => {
	it('is the month the day falls in', () => {
		expect(currentTheater(day('2026-11-11'))?.start).toBe('2026-11-01');
		expect(currentTheater(day('2026-10-31'))?.start).toBe('2026-10-01');
	});

	it('is nothing once the month has passed with no successor named', () => {
		const only = [november];
		expect(currentTheater(day('2026-12-01'), only)).toBeUndefined();
		expect(currentTheater(day('2026-10-31'), only)).toBeUndefined();
	});
});

describe('the eligible cast', () => {
	const owns = (ids: string[] | 'all', excluded: string[] = []) => ({
		owned: (id: string) => ids === 'all' || ids.includes(id),
		excluded: (id: string) => excluded.includes(id)
	});

	it("is the season's elements and guests, without the Opening Characters", () => {
		const cast = eligibleCast(november, owns('all'));
		for (const id of november.opening) expect(cast).not.toContain(id);
		for (const id of november.guests) expect(cast).toContain(id);
		for (const id of cast)
			expect(
				november.elements.includes(theaterElement(id)!) || november.guests.includes(id),
				id
			).toBe(true);
	});

	it('leaves out what the player doesn\'t own or has marked "can\'t enter Theater"', () => {
		const cast = eligibleCast(
			november,
			owns(['furina', 'neuvillette', 'qiqi', 'bennett'], ['qiqi'])
		);
		expect(cast).toEqual(['furina', 'neuvillette']);
	});

	it('counts one Traveler, however many elements the roster records', () => {
		const cast = eligibleCast(
			november,
			owns(['traveler_hydro', 'traveler_electro', 'traveler_geo', 'traveler_pyro'])
		);
		expect(cast).toHaveLength(1);
	});
});

describe('the mode verdicts', () => {
	const at = (cast: number, invite = false) =>
		Object.fromEntries(modeVerdicts(november, cast, { invite }).map((v) => [v.mode, v]));

	it('opens Visionary at 16 brought, 22 in the whole cast', () => {
		const v = at(16);
		expect(v.visionary).toMatchObject({ open: true, extras: 0, wholeCast: 22 });
		expect(v.lunar).toMatchObject({ open: false, short: 6 });
		expect(highestOpen(modeVerdicts(november, 16))?.mode).toBe('visionary');
	});

	// Nate's Lunar Mode screenshot (2026-11-11): 23 Alternate Cast, "1/4 extra",
	// 29 counted in its Stats row, and "Gain 2 Blessing Level(s)".
	it("reads Nate's Lunar Mode screen: one extra member, two Blessing Levels", () => {
		expect(at(23).lunar).toMatchObject({
			open: true,
			extras: 1,
			blessingLevels: 2,
			wholeCast: 29
		});
	});

	it('caps the cast at the most a mode takes', () => {
		expect(at(40).lunar).toMatchObject({ have: 26, extras: 4, blessingLevels: 8, wholeCast: 32 });
		expect(at(40).easy).toMatchObject({ have: 4, extras: 2, wholeCast: 10 });
	});

	it("counts a friend's character when asked to", () => {
		expect(at(21).lunar.open).toBe(false);
		expect(at(21, true).lunar).toMatchObject({ open: true, have: 22 });
	});

	it('opens nothing for an empty roster', () => {
		expect(highestOpen(modeVerdicts(november, 0))).toBeUndefined();
	});
});

describe('Blessing Level', () => {
	// The same screenshot: "Increases Max HP by 1600, ATK by 100, DEF by 100,
	// and Elemental Mastery by 40" at 2 levels.
	it("gives what Nate's screen shows at two levels", () => {
		expect(blessingStats(2)).toEqual({ hp: 1600, atk: 100, def: 100, em: 40 });
	});

	it('doubles for a Special Guest Star', () => {
		expect(blessingStats(2, { guest: true })).toEqual({ hp: 3200, atk: 200, def: 200, em: 80 });
	});
});

describe('the Stats row', () => {
	it('counts elements and roles, as the game classifies them', () => {
		const ids = ['furina', 'neuvillette', 'fischl'];
		const s = castStats(ids);
		expect(s.elements).toEqual({ hydro: 2, electro: 1 });
		const count = (pred: (id: string) => boolean) => ids.filter(pred).length;
		expect(s.onField).toBe(count((id) => characterRoles[id].position.includes('onField')));
		expect(s.offField).toBe(count((id) => characterRoles[id].position.includes('offField')));
		expect(s.support).toBe(count((id) => characterRoles[id].function.includes('support')));
	});
});
