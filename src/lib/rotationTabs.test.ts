import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { rotationTabs as rt, TAB_LIMIT, type RotationTab } from './rotationTabs.svelte';
import { documentBar as db, recentlyClosedRotations, worthKeeping } from './documentBar.svelte';
import { closeCandidate } from './tabSet';
import { savedNotations } from './stores';
import { notices } from './notices.svelte';

/**
 * `adopt` — where an INCOMING document goes (a shared `?r=` link, a `?team=`
 * hand-off).
 *
 * ⚓ PROMOTED TO A PERMANENT CHECK (Nate, 2026-08-17) because the rule it pins
 * is a DATA-LOSS rule, and the bug it replaced was live: both link paths reused
 * the ACTIVE tab once six were open, silently overwriting its notation, label,
 * loadout and constellations, with no tab-level undo to get them back. That is
 * the class of defect worth a test that outlives the fix — the assertion
 * ("never overwrite a tab with content") is about behaviour a refactor must
 * keep, not about how the function is written.
 *
 * ⚠️ These drive the real singleton, so each test seeds `tabs` itself rather
 * than trusting whatever the previous one left.
 */
const busy = (n: number): RotationTab[] =>
	Array.from({ length: n }, (_, i) => ({
		id: `t${i + 1}`,
		label: `Work ${i + 1}`,
		notation: `Bennett E Q > Xiangling E Q N${i + 1}`
	}));

const doc = { label: 'Shared rotation', notation: 'Nahida E Q > Raiden E Q' };

function seed(tabs: RotationTab[], activeId = tabs[0].id) {
	rt.tabs = tabs;
	rt.activeTabId = activeId;
	rt.notation = tabs.find((t) => t.id === activeId)?.notation ?? '';
}

describe('rotationTabs.adopt', () => {
	beforeEach(() => seed(busy(1)));

	it('opens a NEW tab when there is room and nothing is empty', () => {
		seed(busy(3));
		expect(rt.adopt({ ...doc })).toBe(true);
		expect(rt.tabs).toHaveLength(4);
		expect(rt.tabs[3].label).toBe('Shared rotation');
		// The three that held work still hold it.
		expect(rt.tabs.slice(0, 3).map((t) => t.notation)).toEqual(busy(3).map((t) => t.notation));
	});

	it('fills an EMPTY tab rather than opening another, at any tab count', () => {
		const tabs = busy(3);
		tabs[1] = { id: 't2', label: 'Tab 2', notation: '' };
		seed(tabs, 't1');
		expect(rt.adopt({ ...doc })).toBe(true);
		expect(rt.tabs).toHaveLength(3); // no new tab
		expect(rt.tabs[1].label).toBe('Shared rotation');
		expect(rt.activeTabId).toBe('t2'); // and it becomes the one you are looking at
	});

	// 🐛 THE REGRESSION THIS EXISTS FOR. At the limit the old code overwrote the
	// ACTIVE tab — the worst possible victim, since it is by definition the one
	// being worked in.
	it('DECLINES rather than overwriting, when every tab holds work', () => {
		seed(busy(TAB_LIMIT), 't3');
		const before = rt.tabs.map((t) => ({ ...t }));
		expect(rt.adopt({ ...doc })).toBe(false);
		expect(rt.tabs).toEqual(before);
		expect(rt.activeTabId).toBe('t3');
	});

	// ⚠️ A blank tab that is LINKED to a bank entry is not spare: the link is a
	// thing the user made, and filling it would silently unlink their entry.
	it('does not treat a blank but SAVED tab as empty', () => {
		const tabs = busy(TAB_LIMIT);
		tabs[4] = { id: 't5', label: 'My rotation', notation: '', savedId: 'bank-1' };
		seed(tabs, 't1');
		expect(rt.adopt({ ...doc })).toBe(false);
		expect(rt.tabs[4].savedId).toBe('bank-1');
		expect(rt.tabs[4].label).toBe('My rotation');
	});

	// 🐛 planner-1 (pre-launch sweep, 2026-10-14). The active tab's typed text
	// lives in `rt.notation` until a flush, so a tab opened empty and typed into
	// still read '' in `tabs` and was taken as spare: a Library open or an in-app
	// link replaced it, and the rotation was not even kept in Recently closed.
	it('does not treat a FRESH tab that has been typed into as empty', () => {
		seed(busy(1));
		expect(rt.addTab()).toBe(true);
		const typed = rt.activeTabId;
		rt.notation = 'Furina E Q > Neuvillette C';
		expect(rt.adopt({ ...doc })).toBe(true);
		expect(rt.tabs).toHaveLength(3); // a new tab, not the typed one
		rt.flush();
		expect(rt.tabs.find((t) => t.id === typed)?.notation).toBe('Furina E Q > Neuvillette C');
	});

	it('never exceeds TAB_LIMIT', () => {
		seed(busy(TAB_LIMIT - 1));
		expect(rt.adopt({ ...doc })).toBe(true);
		expect(rt.tabs).toHaveLength(TAB_LIMIT);
		expect(rt.adopt({ ...doc, notation: 'Furina E Q' })).toBe(false);
		expect(rt.tabs).toHaveLength(TAB_LIMIT);
	});
});

/**
 * ⚓ A CONFIRM EVERY TIME (Nate 2026-10-08): an arriving document at the limit
 * opens the make-room confirm instead of landing or being parked, and either
 * answer keeps everything — confirming moves the chosen tab to Recently
 * closed, cancelling keeps the ARRIVING document there. Same data-loss class
 * as `adopt` above, which is why it is pinned beside it.
 */
describe('documentBar.receive — the make-room confirm', () => {
	const closed = () => get(recentlyClosedRotations).map((e) => e.tab);
	beforeEach(() => {
		recentlyClosedRotations.clear();
		db.room = null;
	});

	it('lands directly when there is room', () => {
		seed(busy(2));
		db.receive(rt.teamDocument(['bennett', 'xiangling']), 'Team loaded');
		expect(db.room).toBeNull();
		expect(rt.tabs).toHaveLength(3);
		// ⚓ §8.1: a team arrives SEATED, resting, in an empty notation — ⛔ the
		// old run of bare names the streamer cleared and lost the team with.
		expect(rt.tabs[2].notation).toBe('');
		expect(rt.seats).toEqual(['bennett', 'xiangling', null, null]);
	});

	it('at the limit, ASKS — and changes nothing until answered', () => {
		seed(busy(TAB_LIMIT), 't2');
		const shape = () => rt.tabs.map((t) => [t.id, t.label, t.notation]);
		const before = shape();
		db.receive({ ...doc }, 'Loaded shared rotation');
		expect(db.room).not.toBeNull();
		expect(shape()).toEqual(before);
		expect(rt.activeTabId).toBe('t2');
	});

	it('confirming closes the chosen tab INTO Recently closed, then lands', () => {
		seed(busy(TAB_LIMIT), 't2');
		db.receive({ ...doc }, 'Loaded shared rotation');
		db.confirmRoom('t5');
		expect(rt.tabs).toHaveLength(TAB_LIMIT);
		expect(rt.tabs.some((t) => t.id === 't5')).toBe(false);
		expect(rt.activeTab.notation).toBe(doc.notation);
		expect(closed().map((t) => t.id)).toEqual(['t5']);
	});

	it('cancelling keeps the ARRIVING document in Recently closed', () => {
		seed(busy(TAB_LIMIT), 't2');
		db.receive({ ...doc }, 'Loaded shared rotation');
		db.cancelRoom();
		expect(rt.tabs).toHaveLength(TAB_LIMIT);
		expect(closed().map((t) => t.notation)).toEqual([doc.notation]);
	});
});

describe('closeCandidate', () => {
	const tabs = [
		{ id: 'a', viewedAt: 300 },
		{ id: 'b', viewedAt: 100 },
		{ id: 'c', viewedAt: 200 },
		{ id: 'd' } // predates the field — counts as oldest
	];
	it('picks the tab VIEWED longest ago', () => {
		expect(closeCandidate(tabs, 'a')?.id).toBe('d');
		expect(closeCandidate(tabs.slice(0, 3), 'a')?.id).toBe('b');
	});
	it('never the active tab; null when there is no other', () => {
		expect(closeCandidate(tabs, 'd')?.id).toBe('b');
		expect(closeCandidate([{ id: 'a' }], 'a')).toBeNull();
	});
});

describe('worthKeeping', () => {
	const saved = [
		{ id: 's1', name: 'X', notation: 'Bennett E Q', tabCon: { bennett: 6 }, savedAt: 0 }
	];
	it('drops an empty tab, and a saved tab with nothing unsaved', () => {
		expect(worthKeeping({ id: 't', label: 'T', notation: '  ' }, saved)).toBe(false);
		expect(
			worthKeeping({ id: 't', label: 'X', notation: 'Bennett E Q', savedId: 's1' }, saved)
		).toBe(false);
	});
	it('keeps unsaved text OR an unsaved constellation', () => {
		expect(
			worthKeeping({ id: 't', label: 'X', notation: 'Bennett E Q N1', savedId: 's1' }, saved)
		).toBe(true);
		expect(
			worthKeeping(
				{ id: 't', label: 'X', notation: 'Bennett E Q', savedId: 's1', tabCon: { bennett: 2 } },
				saved
			)
		).toBe(true);
	});
});

describe('documentBar.closeAll — closing is never loss', () => {
	const closed = () => get(recentlyClosedRotations).map((e) => e.tab.id);
	beforeEach(() => recentlyClosedRotations.clear());

	it('sends every tab worth keeping to Recently closed, in strip order, and leaves one empty tab', () => {
		seed([...busy(2), { id: 'empty', label: 'Empty', notation: '' }]);
		db.closeAll();
		expect(closed()).toEqual(['t1', 't2']);
		expect(rt.tabs).toHaveLength(1);
		expect(rt.notation).toBe('');
	});
});

describe('documentBar.loadNewTab / linked', () => {
	const entry = { id: 'saved-x', name: 'X', notation: 'Bennett E Q', savedAt: 0 };
	beforeEach(() => savedNotations.clear());

	it('switches to a tab already linked to the entry instead of opening a second', () => {
		seed([...busy(2), { id: 'linked', label: 'X', notation: 'Bennett E Q', savedId: entry.id }]);
		db.loadNewTab(entry);
		expect(rt.tabs).toHaveLength(3);
		expect(rt.activeTabId).toBe('linked');
	});

	it('is linked only while the entry still exists', () => {
		const id = savedNotations.save({ name: 'X', notation: 'Bennett E Q' });
		seed([{ id: 't', label: 'X', notation: 'Bennett E Q', savedId: id }]);
		expect(db.linked).toBe(true);
		savedNotations.delete(id);
		expect(db.linked).toBe(false);
	});
});

/**
 * An Undo toast outlives the tab it was made for (flip-readiness §1.2): the
 * take-back writes the ACTIVE tab, so pressed after a switch it put one
 * rotation's text and seats over another and left the cleared one cleared.
 */
describe('rotationTabs — Undo belongs to the tab it was made in', () => {
	const lastUndo = () => {
		const t = notices.toasts.at(-1)!;
		return () => notices.act(t.id, t.actions.find((a) => a.label === 'Undo')!);
	};
	const textOf = (id: string) => rt.tabs.find((t) => t.id === id)?.notation;

	it('does nothing once another tab is in front, and works again back on its own', () => {
		seed(busy(2));
		rt.clearWithUndo();
		const undo = lastUndo();
		rt.switchTab('t2');
		undo();
		expect(rt.notation).toBe(busy(2)[1].notation); // B is untouched
		rt.switchTab('t1');
		expect(rt.notation).toBe(''); // A is still cleared, not half-restored
	});

	it('takeOff: Undo pressed in another tab leaves both tabs as they are', () => {
		seed(busy(2));
		const before = rt.seats.filter(Boolean).length;
		expect(before).toBeGreaterThan(0);
		rt.takeOff(0);
		const undo = lastUndo();
		rt.switchTab('t2');
		undo();
		expect(rt.notation).toBe(busy(2)[1].notation);
		rt.switchTab('t1');
		expect(rt.seats.filter(Boolean).length).toBe(before - 1);
		expect(textOf('t2')).toBe(busy(2)[1].notation);
	});

	it('still puts the tab back when it is pressed where it was made', () => {
		seed(busy(2));
		rt.clearWithUndo();
		lastUndo()();
		expect(rt.notation).toBe(busy(2)[0].notation);
	});
});
