import { describe, it, expect, beforeAll } from 'vitest';
import { rotationTabs as rt, type RotationTab } from './rotationTabs.svelte';
import { documentBar as db } from './documentBar.svelte';
import { notices } from './notices.svelte';
import { documentsReady, settleDocuments } from './storage/arrivals';

/**
 * ⚠️ These drive the real singleton, so each test puts its own document in
 * front (`show`) rather than trusting whatever the previous one left. The
 * storage session hands the Planner one document at a time the same way.
 */
const work = (n: number): RotationTab => ({
	id: `t${n}`,
	label: `Work ${n}`,
	notation: `Bennett E Q > Xiangling E Q N${n}`
});

function show(tab: RotationTab) {
	rt.restoreFrom(tab, false);
}

/**
 * With no store at all (neither the browser's nor the stand-in in memory
 * would start), the Planner is on its defaults, persisted nowhere, and an
 * arriving document takes their place rather than being dropped.
 */
describe('documentBar.receive — with no store', () => {
	beforeAll(() => settleDocuments(false));
	const receive = async (...args: Parameters<typeof db.receive>) => {
		db.receive(...args);
		await documentsReady;
		await Promise.resolve();
	};

	it('puts the arriving document in front', async () => {
		show(work(1));
		await receive({ label: 'Shared rotation', notation: 'Nahida E Q > Raiden E Q' }, 'Loaded');
		expect(rt.tab.label).toBe('Shared rotation');
		expect(rt.notation).toBe('Nahida E Q > Raiden E Q');
	});

	it('seats an arriving team, resting, in an empty notation', async () => {
		show(work(1));
		await receive(rt.teamDocument(['bennett', 'xiangling']), 'Team loaded');
		// ⚓ §8.1: ⛔ not the old run of bare names the streamer cleared and lost
		// the team with.
		expect(rt.notation).toBe('');
		expect(rt.seats).toEqual(['bennett', 'xiangling', null, null]);
	});
});

/**
 * An Undo toast outlives the document it was made for (flip-readiness §1.2):
 * the take-back writes the document in front, so pressed after the session
 * put another one there it would write one rotation's text and seats over
 * another.
 */
describe('rotationTabs — Undo belongs to the document it was made in', () => {
	const lastUndo = () => {
		const t = notices.toasts.at(-1)!;
		return () => notices.act(t.id, t.actions.find((a) => a.label === 'Undo')!);
	};

	it('clear: does nothing once another document is in front', () => {
		show(work(1));
		rt.clearWithUndo();
		const undo = lastUndo();
		show(work(2));
		undo();
		expect(rt.notation).toBe(work(2).notation);
	});

	it('takeOff: does nothing once another document is in front', () => {
		show(work(1));
		rt.takeOff(0);
		const undo = lastUndo();
		show(work(2));
		const seats = [...rt.seats];
		undo();
		expect(rt.notation).toBe(work(2).notation);
		expect(rt.seats).toEqual(seats);
	});

	it('puts the document back when pressed where it was made', () => {
		show(work(1));
		rt.clearWithUndo();
		lastUndo()();
		expect(rt.notation).toBe(work(1).notation);
	});
});

describe('a rotation’s link to its team (⚓ Nate 2026-11-10)', () => {
	const four = ['bennett', 'xiangling', 'xingqiu', 'sucrose'];
	const linkedTab = (id: string): RotationTab => ({
		id,
		label: 'Linked',
		notation: '',
		slots: [...four],
		placed: [true, true, true, true],
		teamId: 'team-a'
	});
	const teamA = {
		id: 'team-a',
		updatedAt: 0,
		profileId: 'p',
		name: 'A',
		slots: [...four],
		createdAt: 0,
		label: 'A'
	};
	const seat = (seats: string[]) => (rt.seating = { ...rt.seating, seats });

	it('stays through a new slot order and ends when a member is replaced', () => {
		rt.teams = [teamA];
		show(linkedTab('link-1'));
		expect(rt.team?.id).toBe('team-a');
		seat([...four].reverse());
		expect(rt.tab.teamId).toBe('team-a');
		seat(['bennett', 'xiangling', 'xingqiu', 'kaedehara_kazuha']);
		expect(rt.tab.teamId).toBeUndefined();
		rt.teams = [];
	});
});
