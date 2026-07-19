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
	placeholder,
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
	// Container — a solid panel surface (the .vz-panel register: solid fill,
	// inset top hairline, no resting border); focus draws an accent inset ring.
	// Metrics are mirrored by .rp-notation-placeholder in RotationTimeline.svelte
	// (the pre-chunk-load stand-in) — keep the two in lockstep.
	'&': {
		background: 'var(--surface)',
		border: 'none',
		// A resting hairline ring — slightly more distinct than the fill — is
		// the field affordance: this surface is an input, not a readout. It
		// brightens on hover and hands off to the accent ring on focus.
		boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09), inset 0 1px 0 rgba(255,255,255,0.09)',
		borderRadius: '6px',
		fontSize: '13px',
		fontFamily: 'var(--font-mono)',
		lineHeight: '1.6',
		color: 'var(--text)',
		width: '100%',
		boxSizing: 'border-box',
		cursor: 'text',
		transition: 'box-shadow 150ms ease'
	},
	'&:hover': {
		boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.16), inset 0 1px 0 rgba(255,255,255,0.16)'
	},
	'&.cm-focused, &.cm-focused:hover': {
		outline: 'none',
		boxShadow:
			'inset 0 0 0 1px color-mix(in srgb, var(--accent) 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.09)'
	},
	'.cm-placeholder': {
		color: 'rgba(158,172,200,0.45)'
	},
	// Inner scroller / content
	'.cm-scroller': {
		fontFamily: 'inherit',
		lineHeight: 'inherit',
		overflow: 'auto'
	},
	'.cm-content': {
		padding: '10px 12px',
		minHeight: '2.5rem',
		caretColor: 'rgba(255,255,255,0.85)'
	},
	'.cm-line': { padding: '0' },
	'.cm-cursor, .cm-dropCursor': {
		borderLeftColor: 'rgba(255,255,255,0.7)',
		borderLeftWidth: '2px'
	},
	'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
		{
			background: 'color-mix(in srgb, var(--accent) 24%, transparent)'
		},

	// Autocomplete tooltip — raised surface with the shared hairline register
	'.cm-tooltip': {
		background: 'var(--surface-raised)',
		border: 'none',
		borderRadius: '6px',
		boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.5)',
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
		color: 'var(--text)'
	},
	'.cm-tooltip-autocomplete > ul > li[aria-selected="true"]': {
		background: 'color-mix(in srgb, var(--accent) 16%, transparent)',
		color: 'var(--text)'
	},

	// Token highlight classes.
	// paddingRight on action tokens gives visual breathing room between
	// concatenated tokens (e.g. QEN1N2) without inserting actual spaces.
	// character: no padding — always followed by a real space.
	// separator: symmetric padding — may appear with no spaces either side.
	'.rp-tok-char': { color: '#e8e8f0', fontWeight: '500' },
	'.rp-tok-sep': { color: 'rgba(255,255,255,0.22)', padding: '0 3px' },
	// Skill (E) = controller gold, Burst (Q) = coral — a warm pair that reads as
	// "your abilities", stepped so the burst is the hotter tone. Deliberately off
	// the moonsign wave's blue+lemon (Nate 2026-07-19; former E=blue/Q=gold).
	'.rp-tok-Q': { color: '#ec6761', paddingRight: '2px' },
	'.rp-tok-E': { color: '#f7cb56', paddingRight: '2px' },
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
		// Empty-state invitation: shows what to type and models the syntax.
		placeholder('Type a rotation — e.g.  Bennett E Q > Xiangling E Q N3 > …'),
		notationTheme,
		EditorView.updateListener.of((update) => {
			if (update.docChanged) onChange(update.state.doc.toString());
		})
	];
}
