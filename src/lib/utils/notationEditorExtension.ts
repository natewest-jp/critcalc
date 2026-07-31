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
	keymap,
	tooltips
} from '@codemirror/view';
import { RangeSetBuilder, type Extension } from '@codemirror/state';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import {
	autocompletion,
	completionKeymap,
	type CompletionContext,
	type CompletionResult
} from '@codemirror/autocomplete';
import { tokenizeNotation, type Token, type TokenKind } from './tokenizer';
import { searchCharacterIndex, getIndexEntryByDisplayName } from '$lib/data/characterLookup';
import { elementPalette } from './elementColors';
import { resolveActionElement, type NormalActionKind } from './actionElement';
import type { Element } from '$lib/types/ability';
import type { WeaponType } from '$lib/types/weapon';

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
// Element-tint resolution (character-aware highlighting)
// ---------------------------------------------------------------------------

/**
 * Element color to tint an action token with, or null when the token is not an
 * *elemental* attack for the segment's character (a physical normal, a character
 * whose name doesn't resolve, a non-elemental action). E/Q always carry the
 * character's element; N/C/P go through `resolveActionElement` — the same
 * infusion rule the parser stamps onto action events and hits.
 *
 * Uses the palette's saturated `main` tone (the element's identity color, same
 * as the timeline bars) — the pale `hi` slot read too faint on the dark
 * composer.
 *
 * The character is resolved from the eager identity index (element + weapon),
 * which the editor can read synchronously per keystroke; it passes no infusion
 * to the shared rule (it does not run the parser's stance state machine), so a
 * mid-rotation infusion opened by a stance (e.g. Cyno after Q) stays neutral
 * here while the active row tints it. Permanent weapon-class infusions — the
 * common case — are exact.
 */
function elementTintForToken(
	tok: Token,
	element: Element | null,
	weapon: WeaponType | null
): string | null {
	if (!element) return null;
	if (tok.kind === 'Q' || tok.kind === 'E') return elementPalette(element).main;
	// N/C/P are 'label' kind (bracket groups like `3[C]` are also 'label' but
	// carry a numeric/bracket prefix, so the exact patterns below skip them).
	if (tok.kind !== 'label') return null;
	const t = tok.text;
	const kind: NormalActionKind | null = /^N\d*$/.test(t)
		? 'normal'
		: /^C\d*$/.test(t)
			? 'charged'
			: /^[lh]?P$/.test(t)
				? 'plunge'
				: null;
	if (!kind) return null;
	const el = resolveActionElement(kind, t, weapon ?? undefined, element, undefined);
	return el ? elementPalette(el).main : null;
}

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
			// Segment's caster element/weapon — reset at each character token, which
			// always opens a segment, and carried across its action tokens.
			let curElement: Element | null = null;
			let curWeapon: WeaponType | null = null;
			for (const tok of tokens) {
				if (tok.kind === 'character') {
					const entry = getIndexEntryByDisplayName(tok.text);
					curElement = entry?.element ?? null;
					curWeapon = entry?.weapon ?? null;
				}
				const cls = TOKEN_CLASS[tok.kind];
				if (!cls) continue;
				const tint = elementTintForToken(tok, curElement, curWeapon);
				// Element-bearing tokens keep their structural class (padding/weight)
				// and override just the color inline with the caster's bright tint.
				builder.add(
					tok.from,
					tok.to,
					tint
						? Decoration.mark({ class: cls, attributes: { style: `color:${tint}` } })
						: Decoration.mark({ class: cls })
				);
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
	// Container — the notation COMPOSER on the planner frame's bottom edge:
	// its own inset box (radius 6 per the 3/6/9 scale) sunk darker than the
	// chart ground — together with the hairline ring, the "this is a
	// textfield" signal (the old pencil glyph is retired). The border is
	// ALWAYS 1px, in three states (Nate 2026-07-19): resting = the graph line
	// color, hover = dire at 50% ("this responds to you" — full-strength dire
	// was too loud; this matches the old focus ring's softened mix), focused
	// = back to the resting line color (the caret is the active signal).
	// Metrics are mirrored by .rp-notation-placeholder in
	// RotationTimeline.svelte (the pre-chunk-load stand-in) — keep in
	// lockstep.
	'&': {
		background: 'color-mix(in srgb, #000 40%, var(--rp-chart-bg, #05183a))',
		border: '1px solid var(--rp-line, #1c2a4a)',
		borderRadius: '6px',
		fontSize: '13px',
		fontFamily: 'var(--font-mono)',
		lineHeight: '1.6',
		color: 'var(--text)',
		width: '100%',
		boxSizing: 'border-box',
		cursor: 'text',
		transition: 'border-color 150ms ease'
	},
	'&:hover': {
		borderColor: 'color-mix(in srgb, var(--dire, #d91254) 50%, transparent)'
	},
	'&.cm-focused, &.cm-focused:hover': {
		outline: 'none',
		borderColor: 'var(--rp-line, #1c2a4a)'
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
	// E/Q — and any elemental/infused N/C/P — are tinted the CASTER'S element
	// (bright shade), applied inline per token by the highlight plugin
	// (elementTintForToken). These class colors are only the fallback for a
	// segment whose character name doesn't resolve. That fallback used to be the
	// controller-gold (E) / coral (Q) pair; those two tokens are retired (Nate
	// 2026-07-27) and the fallback now speaks --el-none-main, the palette's
	// "element unknown" gray. That is the honest reading: we don't know the
	// element, so we imply none. E and Q stay distinguishable by their glyph.
	'.rp-tok-Q': { color: 'var(--el-none-main)', paddingRight: '2px' },
	'.rp-tok-E': { color: 'var(--el-none-main)', paddingRight: '2px' },
	'.rp-tok-time': { color: 'rgba(255,255,255,0.62)', paddingRight: '2px' },
	// ~?s is a time token with unknown value — an honest data gap, not an error.
	// Same family as .rp-tok-time, subordinated (dimmed), so it never borrows
	// the warning register.
	'.rp-tok-unset': { color: 'rgba(255,255,255,0.4)', paddingRight: '2px' },
	'.rp-tok-optional': { color: 'rgba(255,255,255,0.38)', paddingRight: '2px' },
	'.rp-tok-label': { color: 'rgba(255,255,255,0.62)', paddingRight: '2px' },
	// stack-assert: neutral gray, italic — visually subordinate to action tokens
	// since the assertion itself is metadata (no timeline event). Time (~Xs) and
	// stacks are held to the same non-infused gray so element tint stays the sole
	// signal of "this hits with an element" (Nate 2026-07-22).
	'.rp-tok-stack': {
		color: 'rgba(255,255,255,0.55)',
		paddingRight: '2px',
		fontStyle: 'italic',
		fontSize: '0.92em'
	},
	'.rp-tok-or-alt': { color: 'rgba(255,255,255,0.38)', paddingRight: '2px' },
	// Unknown tokens speak --ui-warning (Nate 2026-07-27). They used to speak
	// dire, but only because a separate error red sat too close to the Q coral
	// — that constraint died with the coral's retirement, and an unrecognized
	// token is a UI STATE (your input didn't parse), not a game-model fact, so
	// dire was always the wrong register for it. Pure tint, not a white-lift:
	// mixing toward white desaturates it (Nate veto on the dire version); the
	// squiggle doubles the signal. This squiggle is the ONLY unrecognized-token
	// surface (the old "Unrecognized:" chip row below the editor was deleted as
	// redundant).
	'.rp-tok-unknown': {
		color: 'var(--ui-warning)',
		paddingRight: '2px',
		textDecorationLine: 'underline',
		textDecorationStyle: 'wavy',
		textDecorationColor: 'var(--ui-warning)',
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
		// Tooltips (the autocomplete popup) portal to <body>: inside the editor
		// they'd be trapped in .tool-main's stacking context, underneath the
		// dire border's raised edge treatment (z2) — the popup opens downward
		// from the composer straight into the ember field and drowns there.
		// Body-level, .cm-tooltip's own z-index wins. (This module is lazy,
		// client-only — document is safe here.)
		tooltips({ position: 'fixed', parent: document.body }),
		// Empty-state invitation: shows what to type and models the syntax.
		placeholder('Type a rotation — e.g.  Bennett E Q > Xiangling E Q N3 > …'),
		notationTheme,
		EditorView.updateListener.of((update) => {
			if (update.docChanged) onChange(update.state.doc.toString());
		})
	];
}
