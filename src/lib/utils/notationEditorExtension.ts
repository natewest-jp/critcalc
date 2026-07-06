/**
 * src/lib/utils/notationEditorExtension.ts
 *
 * CodeMirror extension bundle for the KQM rotation notation editor.
 *
 * Provides:
 *   - Syntax highlighting via a ViewPlugin that runs tokenizeNotation over the
 *     document and maps each TokenKind to a CSS mark class
 *   - Paste interception: normalizes line endings, superscripts, and separator spacing
 *   - Character name autocomplete
 *   - Editor theme: structural styles + token colors, injected by CodeMirror
 *   - History (undo/redo) and standard keybindings
 *
 * Usage:
 *   const extensions = buildNotationExtensions(onChange);
 */

import {
	EditorView,
	ViewPlugin,
	Decoration,
	type DecorationSet,
	type ViewUpdate,
	keymap
} from '@codemirror/view';
import { RangeSetBuilder, type Extension } from '@codemirror/state';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import {
	autocompletion,
	completionKeymap,
	type CompletionContext,
	type CompletionResult
} from '@codemirror/autocomplete';
import { tokenizeNotation, type TokenKind } from './tokenizer';
import { searchCharacterIndex } from '$lib/data/characterLookup';

// ---------------------------------------------------------------------------
// Token → CSS class map
// ---------------------------------------------------------------------------

const TOKEN_CLASS: Partial<Record<TokenKind, string>> = {
	character: 'rp-tok-char',
	separator: 'rp-tok-sep',
	Q: 'rp-tok-Q',
	E: 'rp-tok-E',
	time: 'rp-tok-time',
	'unset-time': 'rp-tok-unset',
	optional: 'rp-tok-optional',
	label: 'rp-tok-label',
	'stack-assert': 'rp-tok-stack',
	'or-alt': 'rp-tok-or-alt',
	unknown: 'rp-tok-unknown'
};

// ---------------------------------------------------------------------------
// Syntax highlight plugin
// ---------------------------------------------------------------------------

const notationHighlight = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = this.build(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged) this.decorations = this.build(update.view);
		}

		build(view: EditorView): DecorationSet {
			const builder = new RangeSetBuilder<Decoration>();
			const tokens = tokenizeNotation(view.state.doc.toString());
			for (const tok of tokens) {
				const cls = TOKEN_CLASS[tok.kind];
				if (cls) builder.add(tok.from, tok.to, Decoration.mark({ class: cls }));
			}
			return builder.finish();
		}
	},
	{ decorations: (v) => v.decorations }
);

// ---------------------------------------------------------------------------
// Paste handler
// ---------------------------------------------------------------------------

// Superscript digit characters used as KQM footnote markers (⁰¹²³⁴⁵⁶⁷⁸⁹)
const SUPERSCRIPT_RE = /[\u00B2\u00B3\u00B9\u2070\u2074-\u2079]+/g;

/**
 * Minimal paste normalization:
 *   1. Strip superscript footnote markers (¹²³…) common in KQM documents
 *   2. Collapse line breaks to spaces (pasting multi-line from a guide)
 *   3. Ensure spaces around '>' so segments split cleanly
 */
function normalizePaste(raw: string): string {
	return raw
		.replace(SUPERSCRIPT_RE, '')
		.replace(/[\r\n]+/g, ' ')
		.replace(/\s*>\s*/g, ' > ')
		.trim();
}

const pasteHandler = EditorView.domEventHandlers({
	paste(event, view) {
		event.preventDefault();
		const raw = event.clipboardData?.getData('text') ?? '';
		const normalized = normalizePaste(raw);
		const sel = view.state.selection.main;
		view.dispatch({
			changes: { from: sel.from, to: sel.to, insert: normalized },
			selection: { anchor: sel.from + normalized.length }
		});
		return true;
	}
});

// ---------------------------------------------------------------------------
// Character name autocomplete
// Mirrors the old textarea logic: only completes the first token in a segment
// (before any whitespace), requires ≥2 characters typed.
// ---------------------------------------------------------------------------

function characterCompletionSource(context: CompletionContext): CompletionResult | null {
	const doc = context.state.doc.toString();
	const pos = context.pos;
	const before = doc.slice(0, pos);

	// Find start of the current segment (after last '>' or beginning of doc)
	const lastSep = before.lastIndexOf('>');
	const afterSep = before.slice(lastSep + 1);
	const trimmed = afterSep.trimStart();

	// Abort if: we're past the first token (whitespace in segment), or query too short
	if (/\s/.test(trimmed)) return null;
	if (trimmed.length < 2) return null;

	const matches = searchCharacterIndex(trimmed);
	if (matches.length === 0) return null;

	const from = pos - trimmed.length;
	return {
		from,
		options: matches.map((char) => ({
			label: char.displayName,
			// Append a space so the user can immediately type the first action token
			apply: char.displayName + ' '
		})),
		// Keep the completion open while typing non-whitespace
		validFor: /^\S*$/
	};
}

// ---------------------------------------------------------------------------
// Editor theme
// All styles injected directly by CodeMirror so they bypass Svelte scoping.
// Structural styles mirror the old .rp-notation textarea exactly.
// ---------------------------------------------------------------------------

const notationTheme = EditorView.theme({
	// Container
	'&': {
		background: '#060914',
		border: '1px solid #253252',
		borderRadius: '6px',
		fontSize: '12px',
		fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
		lineHeight: '1.6',
		color: '#e6edf8',
		width: '100%',
		boxSizing: 'border-box'
	},
	'&.cm-focused': {
		outline: 'none',
		borderColor: '#6cb5ff'
	},
	// Inner scroller / content
	'.cm-scroller': {
		fontFamily: 'inherit',
		lineHeight: 'inherit',
		overflow: 'auto'
	},
	'.cm-content': {
		padding: '10px 12px',
		minHeight: '4.5rem',
		caretColor: 'rgba(255,255,255,0.85)'
	},
	'.cm-line': { padding: '0' },
	'.cm-cursor, .cm-dropCursor': {
		borderLeftColor: 'rgba(255,255,255,0.7)',
		borderLeftWidth: '2px'
	},
	'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
		{
			background: 'rgba(108,181,255,0.2)'
		},

	// Autocomplete tooltip — matches the old .rp-suggestions dropdown
	'.cm-tooltip': {
		background: '#0e1628',
		border: '1px solid #253252',
		borderRadius: '6px',
		boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
		padding: '2px 0',
		marginTop: '2px',
		minWidth: '200px'
	},
	'.cm-tooltip-autocomplete > ul': {
		fontFamily: 'inherit',
		fontSize: '0.8rem',
		maxHeight: '200px'
	},
	'.cm-tooltip-autocomplete > ul > li': {
		padding: '5px 10px',
		color: '#e6edf8'
	},
	'.cm-tooltip-autocomplete > ul > li[aria-selected="true"]': {
		background: 'rgba(108,181,255,0.12)',
		color: '#e6edf8'
	},

	// Token highlight classes.
	// paddingRight on action tokens gives visual breathing room between
	// concatenated tokens (e.g. QEN1N2) without inserting actual spaces.
	// character: no padding — always followed by a real space.
	// separator: symmetric padding — may appear with no spaces either side.
	'.rp-tok-char': { color: '#e8e8f0', fontWeight: '500' },
	'.rp-tok-sep': { color: 'rgba(255,255,255,0.22)', padding: '0 3px' },
	'.rp-tok-Q': { color: '#f0c060', paddingRight: '2px' },
	'.rp-tok-E': { color: '#6ab0e8', paddingRight: '2px' },
	'.rp-tok-time': { color: '#78c878', paddingRight: '2px' },
	'.rp-tok-unset': { color: '#e07840', paddingRight: '2px' },
	'.rp-tok-optional': { color: 'rgba(255,255,255,0.38)', paddingRight: '2px' },
	'.rp-tok-label': { color: 'rgba(255,255,255,0.62)', paddingRight: '2px' },
	// stack-assert: dimmed muted-violet, italic — visually subordinate to action
	// tokens since the assertion itself is metadata (no timeline event).
	'.rp-tok-stack': {
		color: '#b090d8',
		paddingRight: '2px',
		fontStyle: 'italic',
		fontSize: '0.92em'
	},
	'.rp-tok-or-alt': { color: 'rgba(255,255,255,0.38)', paddingRight: '2px' },
	'.rp-tok-unknown': {
		color: '#e05060',
		paddingRight: '2px',
		textDecorationLine: 'underline',
		textDecorationStyle: 'wavy',
		textDecorationColor: '#e05060',
		textUnderlineOffset: '3px'
	}
});

// ---------------------------------------------------------------------------
// Public: assemble the full extension list
// ---------------------------------------------------------------------------

/**
 * Returns the complete CodeMirror extension array for the notation editor.
 *
 * @param onChange  Called with the new doc string on every content change.
 */
export function buildNotationExtensions(onChange: (value: string) => void): Extension[] {
	return [
		history(),
		keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
		EditorView.lineWrapping,
		notationHighlight,
		pasteHandler,
		autocompletion({ override: [characterCompletionSource] }),
		notationTheme,
		EditorView.updateListener.of((update) => {
			if (update.docChanged) onChange(update.state.doc.toString());
		})
	];
}
