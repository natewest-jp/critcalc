import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { rotationTabs as rt, TAB_LIMIT, type RotationTab } from './rotationTabs.svelte';
import { documentBar as db, recentlyClosedRotations, worthKeeping } from './documentBar.svelte';
import { closeCandidate } from './tabSet';

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
		// The team IS the notation since single truth — names in segment order.
		expect(rt.tabs[2].notation).toContain('Bennett');
		expect(rt.tabs[2].notation).toContain('Xiangling');
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
