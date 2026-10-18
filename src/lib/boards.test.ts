import { describe, it, expect, beforeEach } from 'vitest';
import {
	boards,
	makeBoard,
	makeTeam,
	PRESET_TEAMS,
	rotationsForTeam,
	pinnedRotation,
	teamCon,
	effectiveCon,
	heldElsewhere,
	withoutRepeats,
	toSharedBoard,
	fromSharedBoard,
	toSavedTeams,
	fromSavedTeams,
	type Board
} from './boards.svelte';
import { teamKey } from './utils/notationEdit';
import type { SavedNotation } from './stores';

/**
 * The board model (lineups design §2.2, §9.4–§9.5, §10). The rules pinned
 * here are the ones a refactor must keep: a team's rotations are DERIVED from
 * the library by its character set, a pin counts only while it still holds,
 * and ⚓ the Builder never rewrites a saved rotation.
 *
 * ⚠️ These drive the real singleton, so each test seeds it.
 */
const vape: SavedNotation = {
	id: 'vape',
	name: 'Vape',
	notation: 'Bennett E Q > Xiangling E Q > Xingqiu E Q > Sucrose E',
	tabCon: { bennett: 6, xiangling: 4, xingqiu: 6, sucrose: 0 },
	savedAt: 1
};
const vapeAlt: SavedNotation = {
	id: 'vape-alt',
	name: 'Vape (double swirl)',
	notation: 'Sucrose E > Xingqiu Q > Bennett Q > Xiangling Q E',
	savedAt: 2
};
const team2: SavedNotation = {
	id: 't2',
	name: 'Two',
	notation: 'Bennett Q > Xiangling E',
	savedAt: 3
};
/** A names-only entry is the TEAM (the library's heading), never a rotation. */
const vapeTeam: SavedNotation = {
	id: 'vape-team',
	name: '',
	notation: 'Bennett > Xiangling > Xingqiu > Sucrose',
	savedAt: 4
};
const library = [vape, vapeAlt, team2, vapeTeam];

let board: Board;
beforeEach(() => {
	board = makeBoard('Lineup', 'abyss');
	board.teams[0] = {
		...makeTeam(['xingqiu', 'sucrose', 'xiangling', 'bennett']),
		pinnedRotationId: 'vape'
	};
	board.teams[1] = makeTeam(['furina', null, 'kaedehara_kazuha', null]);
	boards.boards = [board];
	boards.activeBoardId = board.id;
});
const team = (i: number) => boards.activeBoard.teams[i];

describe('presets (§10.5)', () => {
	it('Stygian ×3, Abyss ×2, Custom ×1', () => {
		expect(PRESET_TEAMS).toEqual({ stygian: 3, abyss: 2, custom: 1 });
		expect(makeBoard('S', 'stygian').teams).toHaveLength(3);
		expect(makeBoard('C').teams).toHaveLength(1);
	});
});

describe('a team’s rotations are DERIVED from the library (§10.1–§10.2)', () => {
	it('a team is its SET — order ignored, blanks ignored', () => {
		expect(teamKey(['bennett', 'xiangling'])).toBe(
			teamKey([null, 'xiangling', 'bennett', 'blank'])
		);
		expect(teamKey(['bennett', 'xiangling'])).not.toBe(
			teamKey(['bennett', 'xiangling', 'xingqiu'])
		);
	});

	it('finds every saved rotation for the set, whatever order it names them in', () => {
		expect(rotationsForTeam(team(0), library).map((e) => e.id)).toEqual(['vape', 'vape-alt']);
		// A short team is its own heading, not filed under a bigger one.
		expect(rotationsForTeam(makeTeam(['xiangling', 'bennett']), library).map((e) => e.id)).toEqual([
			't2'
		]);
	});

	it('a pin counts while it holds, and the pinned rotation’s levels win', () => {
		expect(pinnedRotation(team(0), library)?.id).toBe('vape');
		expect(teamCon(team(0), library)).toEqual(vape.tabCon);
	});

	it('a pin whose rotation was deleted stops counting', () => {
		expect(pinnedRotation(team(0), [vapeAlt])).toBeUndefined();
	});
});

describe('⚓ the Builder never rewrites a saved rotation', () => {
	it('a swap changes the board’s team — and drops the pin to the old team’s rotation', () => {
		boards.setSlot(board.id, team(0).id, 0, 'yelan');
		expect(team(0).slots).toEqual(['yelan', 'sucrose', 'xiangling', 'bennett']);
		expect(team(0).pinnedRotationId).toBeUndefined();
		expect(vape.notation).toBe('Bennett E Q > Xiangling E Q > Xingqiu E Q > Sucrose E');
	});

	it('an edit that leaves the SET unchanged keeps the pin', () => {
		boards.pin(board.id, team(1).id, 'x');
		boards.setSlot(board.id, team(1).id, 1, null); // already empty
		expect(team(1).pinnedRotationId).toBe('x');
	});

	it('a free-standing team edits any position, gaps allowed', () => {
		boards.setSlot(board.id, team(1).id, 1, 'zhongli');
		expect(team(1).slots).toEqual(['furina', 'zhongli', 'kaedehara_kazuha', null]);
	});

	it('choosing a team from the library fills every slot', () => {
		boards.setTeam(board.id, team(1).id, ['nahida', 'raiden_shogun']);
		expect(team(1).slots).toEqual(['nahida', 'raiden_shogun', null, null]);
	});
});

describe('constellations — one model with the Planner (§9.5)', () => {
	it('own value, else the roster, else C0', () => {
		expect(effectiveCon({ furina: 0 }, { furina: 6, zhongli: 2 }, 'furina')).toBe(0);
		expect(effectiveCon({}, { zhongli: 2 }, 'zhongli')).toBe(2);
		expect(effectiveCon({}, {}, 'nahida')).toBe(0);
	});

	it('a share pins every member’s level and carries no pin', () => {
		const shared = toSharedBoard(boards.activeBoard, library, { furina: 2 });
		expect(shared.teams[1].constellations).toEqual({ furina: 2, kaedehara_kazuha: 0 });
		expect(shared.teams[0].constellations.xiangling).toBe(4); // the pinned rotation's
		const opened = fromSharedBoard(shared, (id) => id !== 'kaedehara_kazuha');
		expect(opened.teams[1].slots).toEqual(['furina', null, null, null]);
		expect(opened.teams[1].con).toEqual({ furina: 2 });
		expect(opened.teams.every((t) => !t.pinnedRotationId)).toBe(true);
	});

	it('a saved board pins levels and keeps the pin', () => {
		const saved = toSavedTeams(boards.activeBoard, library, {});
		expect(saved[0].pinnedRotationId).toBe('vape');
		expect(saved[1].con).toEqual({ furina: 0, kaedehara_kazuha: 0 });
		expect(fromSavedTeams(saved)[0].pinnedRotationId).toBe('vape');
	});
});

describe('No repeats — one team per character', () => {
	const teams = [
		['bennett', 'xiangling', null, null],
		['bennett', 'furina', null, null],
		['furina', 'bennett', null, null]
	];
	it('keeps each character on the first team in board order, slots in place', () => {
		expect(withoutRepeats(teams)).toEqual([
			['bennett', 'xiangling', null, null],
			[null, 'furina', null, null],
			[null, null, null, null]
		]);
	});
	it('prefers the teams named first (the last-selected order)', () => {
		expect(withoutRepeats(teams, [2])).toEqual([
			[null, 'xiangling', null, null],
			[null, null, null, null],
			['furina', 'bennett', null, null]
		]);
	});
	it('names the OTHER team a pick takes them off first (the game’s two clicks)', () => {
		const board = {
			...makeBoard('Two clicks'),
			noRepeats: true,
			teams: [makeTeam(['bennett', null, null, null]), makeTeam()]
		};
		const [one, two] = board.teams;
		expect(heldElsewhere(board, two.id, 'bennett')?.id).toBe(one.id);
		expect(heldElsewhere(board, one.id, 'bennett'), 'their own team is not elsewhere').toBe(
			undefined
		);
		expect(heldElsewhere(board, two.id, 'jean'), 'on no team').toBe(undefined);
		expect(
			heldElsewhere({ ...board, noRepeats: false }, two.id, 'bennett'),
			'repeats allowed: an ordinary pick'
		).toBe(undefined);
	});
});
