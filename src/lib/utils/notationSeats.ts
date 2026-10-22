/**
 * src/lib/utils/notationSeats.ts
 *
 * THE PARTY'S SLOTS, INSIDE THE EDITOR'S HISTORY (design §8.1, 2026-10-22).
 *
 * While the team was DERIVED from the notation, undo was free: undoing the
 * text restored the team because the team was the text. Stored slots broke
 * that — the seat rule is history-dependent (who rests, who took whose seat),
 * so re-running it over undone text does not give the seats back. Measured on
 * paper: type Kazuha into a full party with Bennett resting, he takes
 * Bennett's slot; undo, and the rule over the old text leaves Kazuha resting
 * and Bennett gone.
 *
 * So the seats live in the EditorState beside the text, as a field:
 *  - a typed change gets its seat change attached by a TRANSACTION EXTENDER
 *    running the same `seatTeam` the store runs, so the two cannot disagree;
 *  - INVERTED EFFECTS hand the history the seats as they were, so ⌘Z and Redo
 *    restore them with the text, in ONE step;
 *  - a write from outside (a swap, ✕, Clear, a load) dispatches its text AND
 *    its seats together (`setSeats`), and the extender stands aside.
 *
 * ⚠ CodeMirror code: import only from the lazy editor chunk
 * (notationEditor / notationEditorExtension), never from planner-reachable
 * code — see notationEditor.ts's header.
 */

import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { invertedEffects } from '@codemirror/commands';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { emptySeating, makeSeating, seatTeam, type Seating } from './notationEdit';
import { getCharacterIndexEntry } from '$lib/data/characterLookup';

/** Same seats AND same placed flags — the `vacated` memory is not compared:
 *  it is an edit's scratch, and a difference there alone is no change. */
const sameSeats = (a: Seating, b: Seating) =>
	a.seats.every((id, i) => id === b.seats[i] && a.placed[i] === b.placed[i]);

/** Set the seating outright (a load, a swap, ✕, Clear, an undo's inverse). */
export const setSeats = StateEffect.define<Seating>();

export const seatsField = StateField.define<Seating>({
	create: () => emptySeating(),
	update(value, tr) {
		for (const e of tr.effects) if (e.is(setSeats)) value = e.value;
		return value;
	}
});

/** A typed change re-seats by the rule; one that already says its seats (an
 *  outside write, or the history replaying an inverse) is left alone. */
const seatOnType = EditorState.transactionExtender.of((tr) => {
	if (!tr.docChanged || tr.effects.some((e) => e.is(setSeats))) return null;
	const before = tr.startState.field(seatsField);
	const after = seatTeam(before, tr.newDoc.toString());
	return sameSeats(before, after) ? null : { effects: setSeats.of(after) };
});

/** What the history keeps: the seats from before any transaction that moved them. */
const seatHistory = invertedEffects.of((tr) =>
	tr.effects.some((e) => e.is(setSeats)) ? [setSeats.of(tr.startState.field(seatsField))] : []
);

/** The empty editor's hint, naming who to start with when a team is seated
 *  (§8.1: Plan a rotation opens an EMPTY notation with the team resting). */
export function hintFor(seating: Seating): string {
	const first = seating.seats.find((id): id is string => !!id);
	const name = first ? getCharacterIndexEntry(first)?.displayName : undefined;
	return name ? `Start with a name: ${name} E > …` : 'Type a rotation in KQM notation';
}

class HintWidget extends WidgetType {
	constructor(readonly text: string) {
		super();
	}
	eq(other: HintWidget) {
		return other.text === this.text;
	}
	toDOM() {
		const el = document.createElement('span');
		el.className = 'cm-placeholder';
		el.setAttribute('aria-hidden', 'true');
		el.textContent = this.text;
		return el;
	}
	ignoreEvent() {
		return false;
	}
}

/** ⚠ Not CodeMirror's `placeholder()`: that CLONES the element it is handed,
 *  so a hint updated in place never reached the screen (a new tab still named
 *  the last tab's team). This one is recomputed from the seats field. */
const seatHint = EditorView.decorations.compute(['doc', seatsField], (state) =>
	state.doc.length
		? Decoration.none
		: Decoration.set([
				Decoration.widget({
					widget: new HintWidget(hintFor(state.field(seatsField))),
					side: 1
				}).range(0)
			])
);

/** The seats machinery for one document, starting from `initial`. */
export function seatsExtension(initial: Seating): Extension {
	return [
		seatsField.init(() => makeSeating(initial.seats, initial.placed)),
		seatOnType,
		seatHistory,
		seatHint
	];
}

export { sameSeats };
