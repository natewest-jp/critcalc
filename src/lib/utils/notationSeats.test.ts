/**
 * notationSeats.test.ts — the seats ride the editor's history (design §8.1).
 *
 * The case that made the field necessary is the first test: a newcomer takes
 * a RESTING character's seat, and ⌘Z must give the seat back. Re-running the
 * seat rule over the undone text cannot (it leaves the newcomer resting), so
 * a green run here is the claim that the history, not the rule, restores it.
 */

import { describe, it, expect } from 'vitest';
import { EditorState, type Transaction } from '@codemirror/state';
import { history, isolateHistory, undo, redo } from '@codemirror/commands';
import { seatsExtension, seatsField, setSeats } from './notationSeats';
import { makeSeating, placedSeating } from './notationEdit';

const TEAM = ['xiangling', 'bennett', 'chevreuse', 'kaedehara_kazuha'];

function editor(doc: string, seats: (string | null)[]) {
	let state = EditorState.create({
		doc,
		extensions: [history(), seatsExtension(placedSeating(seats))]
	});
	const dispatch = (tr: Transaction) => (state = tr.state);
	return {
		get state() {
			return state;
		},
		type(at: number, text: string) {
			// Separate history events, as distinct edits would be.
			state = state.update({ changes: { from: at, insert: text }, userEvent: 'input.type' }).state;
		},
		write(text: string, seats: (string | null)[]) {
			state = state.update({
				changes: { from: 0, to: state.doc.length, insert: text },
				effects: setSeats.of(makeSeating(seats, [true, true, true, true]))
			}).state;
		},
		erase() {
			state = state.update({
				changes: { from: 0, to: state.doc.length },
				annotations: isolateHistory.of('full')
			}).state;
		},
		undo: () => undo({ state, dispatch }),
		redo: () => redo({ state, dispatch }),
		seats: () => state.field(seatsField).seats
	};
}

describe('seats in the editor history', () => {
	it('⌘Z gives a resting character their seat back', () => {
		// Xiangling and Bennett awake; Chevreuse (3) and Kazuha (4) rest.
		const ed = editor('Xiangling E > Bennett Q', TEAM);
		ed.type(ed.state.doc.length, ' > Furina E');
		expect(ed.seats()).toEqual(['xiangling', 'bennett', 'furina', 'kaedehara_kazuha']);
		ed.undo();
		expect(ed.state.doc.toString()).toBe('Xiangling E > Bennett Q');
		expect(ed.seats()).toEqual(TEAM);
		ed.redo();
		expect(ed.seats()).toEqual(['xiangling', 'bennett', 'furina', 'kaedehara_kazuha']);
	});

	it('typing a team member wakes them without moving anyone', () => {
		const ed = editor('', TEAM);
		ed.type(0, 'Kazuha E');
		expect(ed.seats()).toEqual(TEAM);
	});

	it('an outside write (a swap) is ONE undo step for text and seats', () => {
		const ed = editor('Bennett E Q', TEAM);
		ed.write('Furina E Q', ['xiangling', 'furina', 'chevreuse', 'kaedehara_kazuha']);
		expect(ed.seats()[1]).toBe('furina');
		ed.undo();
		expect(ed.state.doc.toString()).toBe('Bennett E Q');
		expect(ed.seats()).toEqual(TEAM);
	});

	it('⌘Z restores a TYPED seat that emptied, and redo empties it again', () => {
		const ed = editor('', [null, null, null, null]);
		ed.type(0, 'Xiangling E');
		expect(ed.seats()[0]).toBe('xiangling');
		// Deleted as its OWN history step (adjacent edits would join one event),
		// and through the rule — no explicit seats — so the typed seat empties.
		ed.erase();
		expect(ed.seats()[0]).toBeNull();
		ed.undo();
		expect(ed.seats()[0]).toBe('xiangling');
		ed.redo();
		expect(ed.seats()[0]).toBeNull();
	});

	it('a seats-only write (✕ on a resting character) is undoable too', () => {
		const ed = editor('Bennett E', TEAM);
		ed.write('Bennett E', ['xiangling', 'bennett', null, 'kaedehara_kazuha']);
		ed.undo();
		expect(ed.seats()).toEqual(TEAM);
	});
});
