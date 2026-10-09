import { describe, it, expect } from 'vitest';
import { isTeamEntry, libraryTeams, suggestTags, tagMatches, teamNotation } from './library';
import type { SavedBoard, SavedNotation } from './stores';

/**
 * The library's grouping (lineups design §10.1, §10.1a). The rules pinned here
 * are the ones a refactor must keep: a names-only entry is the TEAM (its name
 * is the nickname) and is never a rotation; rotations file under their set,
 * order ignored; portraits follow the newest rotation; a team outlives its
 * last rotation.
 */
const entry = (id: string, notation: string, at: number, name = id): SavedNotation => ({
	id,
	name,
	notation,
	savedAt: at
});

const mav1 = entry('m1', 'Mavuika E > Ororon EQ > Chevreuse hE > Iansan ENQ > Mavuika Q', 300);
const mav2 = entry('m2', 'Ororon EQ > Chevreuse QhEhE > Iansan ENQ > Mavuika Q', 200);
const mavTeam = entry('mt', 'Mavuika > Ororon > Chevreuse > Iansan', 100, 'Natlan Overloaded');
const furina = entry('ft', 'Furina > Neuvillette > Kazuha > Zhongli', 50, '');

describe('libraryTeams', () => {
	it('tells a team entry from a rotation by whether it has actions', () => {
		expect(isTeamEntry(mavTeam)).toBe(true);
		expect(isTeamEntry(mav1)).toBe(false);
	});

	it('files rotations under their set, order ignored, newest first', () => {
		const [t] = libraryTeams([mav2, mavTeam, mav1]);
		expect(t.rotations.map((r) => r.id)).toEqual(['m1', 'm2']);
		expect(t.entry?.id).toBe('mt');
		expect(t.nickname).toBe('Natlan Overloaded');
	});

	it('orders the portraits as the newest rotation does', () => {
		const [t] = libraryTeams([mav2, mavTeam, mav1]);
		expect(t.slots).toEqual(['mavuika', 'ororon', 'chevreuse', 'iansan']);
		const [t2] = libraryTeams([mav2, mavTeam]);
		expect(t2.slots[0]).toBe('ororon');
	});

	it('keeps a team with no rotation, and an empty name is no nickname', () => {
		const teams = libraryTeams([furina, mav1]);
		const f = teams.find((t) => t.entry?.id === 'ft')!;
		expect(f.rotations).toEqual([]);
		expect(f.nickname).toBeUndefined();
	});

	it('shows a heading for a rotation saved before team entries existed', () => {
		const [t] = libraryTeams([mav1]);
		expect(t.entry).toBeUndefined();
		expect(t.rotations).toHaveLength(1);
	});

	it('names the saved boards that hold a team', () => {
		const board: SavedBoard = {
			id: 'b',
			name: 'Stygian',
			preset: 'stygian',
			noRepeats: true,
			savedAt: 1,
			teams: [{ id: 't', slots: ['iansan', 'mavuika', 'ororon', 'chevreuse'] }]
		};
		const [t] = libraryTeams([mav1], [board]);
		expect(t.boards).toEqual(['Stygian']);
	});

	it('writes a names-only notation that reads back as a team entry', () => {
		const n = teamNotation(['mavuika', 'ororon']);
		expect(n).toBe('Mavuika > Ororon');
		expect(isTeamEntry({ notation: n })).toBe(true);
	});
});

describe('search tags', () => {
	it('suggests characters, elements and reactions, prefix matches first', () => {
		const s = suggestTags('mav', ['mavuika', 'ororon'], [], []);
		expect(s[0]).toMatchObject({ kind: 'char', id: 'mavuika' });
		expect(suggestTags('hyd', [], [], [])[0]).toMatchObject({ kind: 'element', id: 'hydro' });
		expect(suggestTags('over', [], ['Overloaded'], [])[0]).toMatchObject({
			kind: 'reaction',
			id: 'Overloaded'
		});
	});

	it('offers one Traveler tag that matches every element', () => {
		const s = suggestTags('trav', ['traveler_cryo'], [], []);
		expect(s.map((t) => t.id)).toContain('traveler');
		const tag = s.find((t) => t.id === 'traveler')!;
		expect(tagMatches(tag, ['odette', 'traveler_cryo'])).toBe(true);
		expect(tagMatches(tag, ['odette'])).toBe(false);
	});

	it('matches a reaction tag on what the team can make', () => {
		const tag = { kind: 'reaction' as const, id: 'Overloaded', label: 'Overloaded' };
		expect(tagMatches(tag, ['mavuika', 'ororon', 'chevreuse', 'iansan'])).toBe(true);
		expect(tagMatches(tag, ['furina', 'neuvillette'])).toBe(false);
	});
});
