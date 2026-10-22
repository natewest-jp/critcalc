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
 *    running the same `seatSlots` the store runs, so the two cannot disagree;
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
import { emptySeats, normalizeSeats, seatSlots, type Seats } from './notationEdit';

const sameSeats = (a: readonly (string | null)[], b: readonly (string | null)[]) =>
	a.length === b.length && a.every((id, i) => id === b[i]);

/** Set the seats outright (a load, a swap, ✕, Clear, an undo's inverse). */
export const setSeats = StateEffect.define<Seats>();

export const seatsField = StateField.define<Seats>({
	create: () => emptySeats(),
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
	const after = seatSlots(before, tr.newDoc.toString());
	return sameSeats(before, after) ? null : { effects: setSeats.of(after) };
});

/** What the history keeps: the seats from before any transaction that moved them. */
const seatHistory = invertedEffects.of((tr) =>
	tr.effects.some((e) => e.is(setSeats)) ? [setSeats.of(tr.startState.field(seatsField))] : []
);

/** The seats machinery for one document, starting from `initial`. */
export function seatsExtension(initial: readonly (string | null)[]): Extension {
	return [seatsField.init(() => normalizeSeats(initial)), seatOnType, seatHistory];
}

export { sameSeats };
