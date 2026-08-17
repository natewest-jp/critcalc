import { describe, it, expect, beforeEach } from 'vitest';
import { rotationTabs as rt, TAB_LIMIT, type RotationTab } from './rotationTabs.svelte';

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

describe('rotationTabs.importTeam', () => {
	it('goes through adopt — declines instead of clobbering a full set', () => {
		seed(busy(TAB_LIMIT), 't2');
		const before = rt.tabs.map((t) => ({ ...t }));
		expect(rt.importTeam(['bennett', 'xiangling'])).toBe(false);
		expect(rt.tabs).toEqual(before);
	});

	it('lands the team as bare-name notation when there is room', () => {
		seed(busy(2));
		expect(rt.importTeam(['bennett', 'xiangling'])).toBe(true);
		expect(rt.tabs).toHaveLength(3);
		// The team IS the notation since single truth — names in segment order.
		expect(rt.tabs[2].notation).toContain('Bennett');
		expect(rt.tabs[2].notation).toContain('Xiangling');
	});
});
