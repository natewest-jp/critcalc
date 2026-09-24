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
import { undo, redo, undoDepth, redoDepth } from '@codemirror/commands';
import { buildNotationExtensions, setResolvedTints } from './notationEditorExtension';
import type { NotationTint } from '$lib/timeline/notationTints';

export interface NotationEditor {
	/** Replace the document (no-op when the value already matches). Lands as a
	 *  minimal, UNDOABLE transaction — see setValue's note. */
	setValue(value: string): void;
	getValue(): string;
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
	destroy(): void;
}

export function createNotationEditor(
	parent: HTMLElement,
	initialValue: string,
	onChange: (value: string) => void
): NotationEditor {
	// Guard flag: true while an external value change is being dispatched into
	// CodeMirror so the updateListener's onChange doesn't fire re-entrantly
	// during Svelte's reactive flush (which can confuse the signal system and
	// leave the timeline frozen until the next unrelated state change).
	let externalUpdate = false;

	const view = new EditorView({
		state: EditorState.create({
			doc: initialValue,
			extensions: buildNotationExtensions((v) => {
				if (!externalUpdate) onChange(v);
			})
		}),
		parent
	});

	return {
		/**
		 * ⚠ THIS IS THE UNDO PATH, not just a mirror. Since single truth every
		 * team edit is a notation rewrite (rotationTabs writes the string, Svelte
		 * hands it down, this replays it) — so a swap or a bench ✕ becomes a
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
		setValue(value: string) {
			const current = view.state.doc.toString();
			if (value === current) return;
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
				view.dispatch({ changes: { from, to: end, insert: value.slice(from, newEnd) } });
			} finally {
				externalUpdate = false;
			}
		},
		getValue() {
			return view.state.doc.toString();
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
		destroy() {
			view.destroy();
		}
	};
}
