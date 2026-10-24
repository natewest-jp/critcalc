import { describe, expect, it } from 'vitest';
import {
	bakeLoadout,
	membersOnly,
	pruneInherited,
	retireRosterLoadout,
	teamOfSlots
} from './teamLoadout';
import type { RotationBody, TeamRecord } from './records';

const team = (slots: (string | null)[], loadout?: TeamRecord['loadout']): TeamRecord => ({
	id: 't',
	updatedAt: 0,
	profileId: 'p',
	name: '',
	slots,
	...(loadout ? { loadout } : {}),
	createdAt: 0
});
const FOUR = ['a', 'b', 'c', 'd'];

describe('pruneInherited', () => {
	it("drops a part that only repeats the team's, so the rotation follows it again", () => {
		expect(pruneInherited({ artifactSetId: 'x' }, { artifactSetId: 'x' })).toEqual({});
		expect(pruneInherited({ artifactSetId: 'y' }, { artifactSetId: 'x' })).toEqual({
			artifactSetId: 'y'
		});
	});
	it('treats the weapon and its refinement as one part', () => {
		const t = { weaponId: 'w', weaponRefinement: 1 as const };
		expect(pruneInherited({ weaponId: 'w', weaponRefinement: 1 }, t)).toEqual({});
		// An R5 of the team's weapon is a different choice, kept whole.
		expect(pruneInherited({ weaponId: 'w', weaponRefinement: 5 }, t)).toEqual({
			weaponId: 'w',
			weaponRefinement: 5
		});
	});
	it('never stores an unset part, which would hide the team’s', () => {
		expect(pruneInherited({ artifactSetId: undefined, weaponId: 'w' }, undefined)).toEqual({
			weaponId: 'w'
		});
	});
});

describe('teams and slots', () => {
	it('finds a team by its SET, in any order, never by a partial set', () => {
		const t = team(FOUR);
		expect(teamOfSlots([t], ['d', 'c', 'b', 'a'])).toBe(t);
		expect(teamOfSlots([t], ['a', 'b', 'c', null])).toBeUndefined();
		expect(teamOfSlots([{ ...t, deleted: true }], FOUR)).toBeUndefined();
	});
	it('keeps only the members’ entries when the set changes', () => {
		expect(membersOnly({ a: { weaponId: 'w' }, e: { weaponId: 'v' } }, ['a', 'b'])).toEqual({
			a: { weaponId: 'w' }
		});
	});
});

describe('bakeLoadout', () => {
	it("makes the team's values a copy's own, its own choices winning", () => {
		const body: RotationBody = {
			notation: '',
			slots: FOUR,
			placed: [true, true, true, true],
			loadout: { a: { artifactSetId: 'own' } }
		};
		const t = team(FOUR, { a: { artifactSetId: 'team', weaponId: 'w' }, b: { weaponId: 'v' } });
		expect(bakeLoadout(body, t).loadout).toEqual({
			a: { artifactSetId: 'own', weaponId: 'w' },
			b: { weaponId: 'v' }
		});
		expect(bakeLoadout(body, undefined)).toBe(body);
	});
});

describe('retireRosterLoadout', () => {
	const roster = { a: { artifactSetId: 'r' }, z: { weaponId: 'unused' } };
	it('fills teams and teamless rotations where they set nothing, and nothing else', () => {
		const teams = [team(FOUR, { a: { weaponId: 'w' } })];
		const rotations = [
			{ slots: FOUR }, // the team's: inherits, no copy
			{ slots: ['a', null, null, null] }, // teamless
			{ slots: ['a', null, null, null], loadout: { a: { artifactSetId: 'own' } } }
		];
		const out = retireRosterLoadout(roster, teams, rotations);
		expect(out.teams.get(0)).toEqual({ a: { artifactSetId: 'r', weaponId: 'w' } });
		expect([...out.rotations.keys()]).toEqual([1]);
		expect(out.rotations.get(1)).toEqual({ a: { artifactSetId: 'r' } });
	});
});
