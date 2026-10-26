/**
 * src/lib/utils/notationEditor.ts
 *
 * The only entry point that pulls CodeMirror into the bundle. RotationTimeline
 * loads this module with a dynamic import from its mountEditor action, which
 * keeps the ~287KB of @codemirror/@lezer code (two-thirds of the planner
 * chunk, and the dominant parse/compile share of its navigation mount block —
 * see docs/archive/perf-audit-2026-07-10.md F2) in its own lazy chunk, off the
 * planner's navigation and cold-load critical path.
 *
 * Do not import this module (or notationEditorExtension) statically from
 * anything the planner page reaches at mount — that would fold CodeMirror
 * straight back into the route chunk.
 */

import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { rotationTabs } from '$lib/rotationTabs.svelte';
import { undo, redo, undoDepth, redoDepth } from '@codemirror/commands';
import {
	buildNotationExtensions,
	setPickedRange,
	setResolvedTints
} from './notationEditorExtension';
import { sameSeats, seatsExtension, seatsField, setSeats } from './notationSeats';
import { emptySeating, makeSeating, type Seating } from './notationEdit';
import type { NotationTint } from '$lib/timeline/notationTints';

export interface NotationEditor {
	/** Replace the document — text, and the party's seats when given (no-op
	 *  when both already match). Lands as ONE minimal, UNDOABLE transaction —
	 *  see setValue's note. */
	setValue(value: string, seating?: Seating): void;
	getValue(): string;
	/** Show another DOCUMENT (a planner tab) — see showDocument's note. */
	showDocument(key: string, value: string, seating?: Seating): void;
	/** Run the editor's own history commands. Exposed so the composer can put
	 *  buttons beside the box for the same thing ⌘Z already does. */
	undo(): void;
	redo(): void;
	/** Whether there is anything to undo / redo right now. */
	canUndo(): boolean;
	canRedo(): boolean;
	/** Hand over what the parse resolved per token for the text `doc` — see
	 *  `setResolvedTints`. Refused when `doc` is no longer the editor's text. */
	setTints(doc: string, tints: NotationTint[]): void;
	/** Mark the source range of the inspector's pick (`null` clears it) —
	 *  see `setPickedRange`. */
	setPicked(doc: string, range: { from: number; to: number } | null): void;
	/** Type `text` at the caret, as a keystroke would (one undoable edit,
	 *  caret after it). The phone dock's key row. */
	insert(text: string): void;
	destroy(): void;
}

export function createNotationEditor(
	parent: HTMLElement,
	initialValue: string,
	/** The text, and the seats it now fills (§8.1), after a change the USER
	 *  made — typing, ⌘Z, Redo. Not called for setValue/showDocument. */
	onChange: (value: string, seating: Seating) => void,
	/** Which document `initialValue` is — the planner's active tab id. */
	initialKey: string,
	/** Where the caret is, on every move or edit — the dock's key row reads
	 *  the segment it sits in. */
	onCursor?: (pos: number) => void,
	/** The party's seating for `initialValue`. */
	initialSeats: Seating = emptySeating()
): NotationEditor {
	// Guard flag: true while an external value change is being dispatched into
	// CodeMirror so the updateListener's onChange doesn't fire re-entrantly
	// during Svelte's reactive flush (which can confuse the signal system and
	// leave the timeline frozen until the next unrelated state change).
	let externalUpdate = false;

	const extensions = [
		// The text reaches the caller through the listener below, WITH its seats.
		// The empty-state hint comes from the seats (notationSeats.seatHint).
		...buildNotationExtensions(() => {}, null),
		// ⚓ A document another tab holds is read-only (notices round): what the
		// PERSON does (typing, a paste, a drop, ⌘Z) is refused, and the store's
		// own writes (a load, a bench edit replayed) are not user events.
		EditorState.changeFilter.of(
			(tr) =>
				!tr.docChanged ||
				!['input', 'delete', 'undo', 'redo', 'move'].some((e) => tr.isUserEvent(e)) ||
				rotationTabs.canEdit()
		),
		EditorView.updateListener.of((u) => {
			if (onCursor && (u.selectionSet || u.docChanged)) onCursor(u.state.selection.main.head);
			const seats = u.state.field(seatsField);
			if (externalUpdate) return;
			if (u.docChanged || seats !== u.startState.field(seatsField))
				onChange(u.state.doc.toString(), seats);
		})
	];
	/** ⚓ One document's state: its text and ITS seats, both in its history. */
	const stateFor = (doc: string, seating: Seating) =>
		EditorState.create({ doc, extensions: [extensions, seatsExtension(seating)] });
	const view = new EditorView({ state: stateFor(initialValue, initialSeats), parent });

	// ⚓ ONE HISTORY PER DOCUMENT (2026-09-30). The editor is shared by every
	// planner tab, and an EditorState is what owns the undo stack — so each tab
	// parks its whole state here while another is shown. 🐛 Before this a tab
	// switch reached the editor through setValue, i.e. as an UNDOABLE edit, and
	// Undo on a tab with no history of its own undid the switch: the tab's text
	// became the last tab's. A closed tab's entry is never read again; six tabs'
	// worth of small states is not worth a pruning protocol.
	let currentKey = initialKey;
	const parked = new Map<string, EditorState>();

	return {
		/**
		 * ⚠ THIS IS THE UNDO PATH, not just a mirror. Since single truth every
		 * team edit is a notation rewrite (rotationTabs writes the string, Svelte
		 * hands it down, this replays it) — so a swap or a cleared slot becomes a
		 * CodeMirror TRANSACTION here, which is the only reason ⌘Z can reach it.
		 * A plain `dispatch` goes into the history by default; do NOT add
		 * `addToHistory.of(false)`.
		 *
		 * The change is MINIMAL (common prefix/suffix trimmed) rather than a
		 * whole-document replace. Deleting one segment out of four then reads as
		 * an edit to that segment: the caret maps through it instead of being
		 * dumped at the end of a brand-new document, and undo restores the text
		 * without also restoring a stale selection.
		 */
		setValue(value: string, seats?: Seating) {
			const current = view.state.doc.toString();
			// ⚓ Text and seats in ONE transaction, so one ⌘Z undoes a swap or a ✕
			// whole. Seats given = the caller decided them (the extender stands
			// aside); absent = the rule seats whatever the new text names.
			const nextSeats: Seating | null = seats ? makeSeating(seats.seats, seats.placed) : null;
			const seatsMove = !!nextSeats && !sameSeats(nextSeats, view.state.field(seatsField));
			if (value === current) {
				if (!seatsMove) return;
				externalUpdate = true;
				try {
					view.dispatch({ effects: setSeats.of(nextSeats!) });
				} finally {
					externalUpdate = false;
				}
				return;
			}
			let from = 0;
			while (from < current.length && from < value.length && current[from] === value[from]) from++;
			let end = current.length;
			let newEnd = value.length;
			while (end > from && newEnd > from && current[end - 1] === value[newEnd - 1]) {
				end--;
				newEnd--;
			}
			externalUpdate = true;
			try {
				view.dispatch({
					changes: { from, to: end, insert: value.slice(from, newEnd) },
					...(nextSeats ? { effects: setSeats.of(nextSeats) } : {})
				});
			} finally {
				externalUpdate = false;
			}
		},
		getValue() {
			return view.state.doc.toString();
		},
		/**
		 * Swap in `key`'s document: its parked state (history, selection) when
		 * it has one, else a fresh state with no history. `view.setState` is not
		 * a transaction, so the swap itself is never undoable. A parked text that
		 * no longer matches `value` (the tab was written while away) is
		 * reconciled through setValue — a real edit to that document, so it IS
		 * undoable there.
		 */
		showDocument(key: string, value: string, seats?: Seating) {
			if (key === currentKey) {
				this.setValue(value, seats);
				return;
			}
			parked.set(currentKey, view.state);
			currentKey = key;
			const next = parked.get(key);
			parked.delete(key);
			view.setState(next ?? stateFor(value, seats ?? emptySeating()));
			this.setValue(value, seats);
		},
		undo() {
			undo(view);
			view.focus();
		},
		redo() {
			redo(view);
			view.focus();
		},
		canUndo() {
			return undoDepth(view.state) > 0;
		},
		canRedo() {
			return redoDepth(view.state) > 0;
		},
		setTints(doc: string, tints: NotationTint[]) {
			// ⚠ Not a history event: a colour is not an edit.
			view.dispatch({ effects: setResolvedTints.of({ doc, tints }) });
		},
		setPicked(doc: string, range: { from: number; to: number } | null) {
			// ⚠ Not a history event either: a pick is not an edit.
			view.dispatch({ effects: setPickedRange.of({ doc, range }) });
		},
		insert(text: string) {
			view.dispatch({
				...view.state.replaceSelection(text),
				scrollIntoView: true,
				userEvent: 'input.type'
			});
		},
		destroy() {
			view.destroy();
		}
	};
}
