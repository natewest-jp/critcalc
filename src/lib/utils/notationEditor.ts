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
import { buildNotationExtensions } from './notationEditorExtension';

export interface NotationEditor {
	/** Replace the whole document (no-op when the value already matches). */
	setValue(value: string): void;
	getValue(): string;
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
		setValue(value: string) {
			const current = view.state.doc.toString();
			if (value === current) return;
			externalUpdate = true;
			try {
				view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
			} finally {
				externalUpdate = false;
			}
		},
		getValue() {
			return view.state.doc.toString();
		},
		destroy() {
			view.destroy();
		}
	};
}
