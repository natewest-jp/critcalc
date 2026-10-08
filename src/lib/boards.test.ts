import { describe, it, expect, beforeEach } from 'vitest';
import {
	boards,
	makeBoard,
	makeTeam,
	teamSlots,
	teamCon,
	effectiveCon,
	repeatedCharacters,
	snapshotBoard,
	toSharedBoard,
	fromSharedBoard,
	toSavedTeams,
	fromSavedTeams,
	type Board
} from './boards.svelte';
import { rotationTabs as rt, type RotationTab } from './rotationTabs.svelte';
import { documentBar as db } from './documentBar.svelte';

/**
 * The board model (lineups design §2.2–§2.3, §9.4–§9.6a). The rules pinned
 * here are the ones a refactor must keep: a linked team is a VIEW of its tab
 * (no second copy), every write to it is a notation edit, and a team is never
 * emptied or deleted because its tab went away.
 *
 * ⚠️ These drive the real singletons, so each test seeds both stores.
 */
const rotation: RotationTab = {
	id: 'rot',
	label: 'Vape',
	notation: 'Bennett E Q > Xiangling E Q > Xingqiu E Q',
	tabCon: { bennett: 6 }
};
const other: RotationTab = { id: 'other', label: 'Other', notation: 'Nahida E Q' };

function seedTabs(active = 'other') {
	rt.tabs = [{ ...rotation }, { ...other }];
	rt.activeTabId = active;
	const a = rt.tabs.find((t) => t.id === active)!;
	rt.notation = a.notation;
	rt.tabCon = a.tabCon ?? {};
}

let board: Board;
function seedBoard() {
	board = makeBoard('Lineup', 2);
	board.teams[0] = { ...board.teams[0], linkedTabId: 'rot' };
	board.teams[1] = makeTeam(['furina', null, 'kaedehara_kazuha', null]);
	boards.boards = [board];
	boards.activeBoardId = board.id;
}
const team = (i: number) => boards.activeBoard.teams[i];

beforeEach(() => {
	seedTabs();
	seedBoard();
});

describe('a linked team is a LIVE VIEW of its tab', () => {
	it('reads its slots and levels from the tab, not from itself', () => {
		expect(teamSlots(team(0))).toEqual(['bennett', 'xiangling', 'xingqiu', null]);
		expect(teamCon(team(0))).toEqual({ bennett: 6 });
	});

	it('follows the notation as it changes — including the ACTIVE tab’s live copy', () => {
		seedTabs('rot');
		rt.notation = 'Bennett E Q > Xiangling E Q > Sucrose E';
		expect(teamSlots(team(0))).toEqual(['bennett', 'xiangling', 'sucrose', null]);
	});

	it('a swap RENAMES in the notation — the rotation survives', () => {
		boards.setSlot(board.id, team(0).id, 2, 'yelan');
		expect(rt.notationOf('rot')).toBe('Bennett E Q > Xiangling E Q > Yelan E Q');
	});

	it('filling a gap APPENDS (slot order is notation order)', () => {
		boards.setSlot(board.id, team(0).id, 3, 'kaedehara_kazuha');
		expect(teamSlots(team(0))[3]).toBe('kaedehara_kazuha');
	});

	it('an active-tab write goes through the working copy (so ⌘Z reaches it)', () => {
		seedTabs('rot');
		boards.setSlot(board.id, team(0).id, 0, 'chevreuse');
		expect(rt.notation.startsWith('Chevreuse E Q')).toBe(true);
	});
});

describe('a free-standing team edits its own slots', () => {
	it('any position, gaps allowed', () => {
		boards.setSlot(board.id, team(1).id, 1, 'zhongli');
		expect(teamSlots(team(1))).toEqual(['furina', 'zhongli', 'kaedehara_kazuha', null]);
	});
});

describe('a team is never lost because its tab was', () => {
	it('closing the tab leaves the team its four characters, unlinked', () => {
		db.closeTab('rot');
		expect(team(0).linkedTabId).toBeUndefined();
		expect(teamSlots(team(0))).toEqual(['bennett', 'xiangling', 'xingqiu', null]);
		expect(teamCon(team(0))).toEqual({ bennett: 6 });
	});

	it('unlink keeps exactly what it showed', () => {
		boards.unlink(board.id, team(0).id);
		expect(team(0).linkedTabId).toBeUndefined();
		expect(teamSlots(team(0))).toEqual(['bennett', 'xiangling', 'xingqiu', null]);
	});

	it('"Unlink and remove" leaves the rotation alone', () => {
		boards.unlinkAndRemove(board.id, team(0).id, 1);
		expect(teamSlots(team(0))).toEqual(['bennett', null, 'xingqiu', null]);
		expect(rt.notationOf('rot')).toBe(rotation.notation);
	});

	it('the persisted copy carries the view, so a vanished tab still shows the team', () => {
		const snap = snapshotBoard(boards.activeBoard);
		expect(snap.teams[0].slots).toEqual(['bennett', 'xiangling', 'xingqiu', null]);
		rt.tabs = [{ ...other }];
		expect(teamSlots(snap.teams[0])).toEqual(['bennett', 'xiangling', 'xingqiu', null]);
	});

	it('a linked tab may not close to make room', () => {
		expect(db.lockedTab(rt.tabs[0])).toBe(true);
		expect(db.lockedTab(rt.tabs[1])).toBe(false);
	});
});

describe('constellations — one model with the Planner (§9.5)', () => {
	it('own value, else the roster, else C0', () => {
		expect(effectiveCon({ furina: 0 }, { furina: 6, zhongli: 2 }, 'furina')).toBe(0);
		expect(effectiveCon({}, { zhongli: 2 }, 'zhongli')).toBe(2);
		expect(effectiveCon({}, {}, 'nahida')).toBe(0);
	});

	it('a share pins every member’s level, so the recipient never sees their own', () => {
		const shared = toSharedBoard(boards.activeBoard, { furina: 2 });
		expect(shared.teams[1].constellations).toEqual({ furina: 2, kaedehara_kazuha: 0 });
		expect(shared.teams[0].constellations.bennett).toBe(6); // the tab's own value
		const opened = fromSharedBoard(shared, (id) => id !== 'kaedehara_kazuha');
		expect(opened.teams[1].slots).toEqual(['furina', null, null, null]);
		expect(opened.teams[1].con).toEqual({ furina: 2 });
		expect(opened.teams.every((t) => !t.linkedTabId)).toBe(true); // links never travel
	});

	it('a saved board keeps a live link and drops a dead one', () => {
		const saved = toSavedTeams(boards.activeBoard, {});
		expect(saved[0].linkedTabId).toBe('rot');
		expect(fromSavedTeams(saved)[0].linkedTabId).toBe('rot');
		rt.tabs = [{ ...other }];
		const reopened = fromSavedTeams(saved);
		expect(reopened[0].linkedTabId).toBeUndefined();
		expect(reopened[0].slots).toEqual(['bennett', 'xiangling', 'xingqiu', null]);
	});
});

describe('No repeats — allow and mark', () => {
	it('names every character on more than one team, with the teams holding them', () => {
		const marks = repeatedCharacters([
			['bennett', 'xiangling', null, null],
			['bennett', 'furina', null, null],
			['furina', 'bennett', null, null]
		]);
		expect(marks).toEqual({ bennett: [0, 1, 2], furina: [1, 2] });
	});
});
