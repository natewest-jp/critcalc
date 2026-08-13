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
import { type Extension } from '@codemirror/state';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import {
	autocompletion,
	completionKeymap,
	type CompletionContext,
	type CompletionResult
} from '@codemirror/autocomplete';
import { tokenizeNotation, type Token, type TokenKind } from './tokenizer';
import { flagNotation, flagSeverity, type NotationFlag } from './notationFlags';
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

/** Squiggle class per flag register — see notationFlags for what separates them.
 *  The warning one is the tokenizer's existing unrecognized-token treatment,
 *  reused rather than twinned: an unresolvable NAME and an unrecognized TOKEN
 *  are the same sentence to the reader ("this didn't parse"), so they must not
 *  arrive in two different colours. */
const FLAG_CLASS = {
	warning: 'rp-tok-unknown',
	provisional: 'rp-flag-approx'
} as const;

/**
 * True when the caret sits inside (or immediately after) a range — WE DO NOT
 * LINT THE WORD YOU ARE TYPING.
 *
 * Only the unresolvable-name flag needs this, and it needs it badly: a name is
 * typed one letter at a time and every prefix of it resolves to nobody, so
 * without the suppression the squiggle fires under the cursor for the whole
 * time the autocomplete popup is offering to finish the word. The approximation
 * flags ride short, complete tokens (`hE`, `sQ`) and are steady enough to show
 * as you type.
 */
function caretInside(view: EditorView, from: number, to: number): boolean {
	for (const range of view.state.selection.ranges) {
		if (range.head >= from && range.head <= to) return true;
	}
	return false;
}

const notationHighlight = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = this.build(view);
		}

		update(update: ViewUpdate) {
			// ⚠ selectionSet MATTERS, not just docChanged: the name-flag suppression
			// above reads the caret, so moving off a half-typed name has to be able
			// to bring its squiggle back (and moving onto one, take it away).
			if (update.docChanged || update.selectionSet) this.decorations = this.build(update.view);
		}

		build(view: EditorView): DecorationSet {
			const doc = view.state.doc.toString();
			const tokens = tokenizeNotation(doc);
			// Flags keyed by their exact source range, so a token can pick up its
			// own without a scan. A bracket-inner flag (`2[hE]`) has no top-level
			// token to attach to and is emitted as its own nested mark below.
			const flags = new Map<string, NotationFlag>();
			for (const flag of flagNotation(doc)) {
				if (flag.reason === 'unknown-character' && caretInside(view, flag.from, flag.to)) continue;
				flags.set(`${flag.from}:${flag.to}`, flag);
			}

			// ⛔ NOT a RangeSetBuilder any more. It requires ranges added in source
			// order and cannot take a mark NESTED inside one already added — which
			// is exactly what a flag inside a bracket repeat group is. Decoration.set
			// with sort:true accepts both.
			const ranges: ReturnType<Decoration['range']>[] = [];
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
				const key = `${tok.from}:${tok.to}`;
				const flag = flags.get(key);
				flags.delete(key);
				const tint = elementTintForToken(tok, curElement, curWeapon);
				const attributes: Record<string, string> = {};
				// Element-bearing tokens keep their structural class (padding/weight)
				// and override just the color inline with the caster's bright tint.
				if (tint) attributes.style = `color:${tint}`;
				if (flag) attributes.title = flag.message;
				const className = flag ? `${cls} ${FLAG_CLASS[flagSeverity(flag.reason)]}` : cls;
				ranges.push(
					Decoration.mark(
						Object.keys(attributes).length ? { class: className, attributes } : { class: className }
					).range(tok.from, tok.to)
				);
			}
			// Whatever is left never matched a top-level token: a cast inside a
			// bracket group. It nests inside that group's own mark.
			for (const flag of flags.values()) {
				ranges.push(
					Decoration.mark({
						class: FLAG_CLASS[flagSeverity(flag.reason)],
						attributes: { title: flag.message }
					}).range(flag.from, flag.to)
				);
			}
			return Decoration.set(ranges, true);
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

/** The NOTIONAL ground the editor's dimmed tokens mix against.
 *
 *  ↻ 2026-08-11: the composer stopped painting a ground of its own. It used to
 *  be `mix(#000 40%, --rp-chart-bg)` — the chart well sunk a step darker — back
 *  when it sat inside an opaque panel; it is a translucent .field on the bare
 *  scene now (⚓ Nate). So this is a REFERENCE rather than a paint, the same
 *  role --rp-chart-bg plays for the bars: the dimmed tokens still need a known
 *  ground because an alpha TEXT colour renders display-dependently on P3 (the
 *  alpha-compositing law, brightness round 2026-07-31), and a field of
 *  --fill-rest over the dimmed scene composites to within ~15 levels of this.
 *  ⚠ If the field's fill ever moves far from the chart ground, re-ground these
 *  — the tokens will go muddy long before anything errors. */
const COMPOSER_BG = 'var(--rp-chart-bg, #15151c)';
/** A dimmed rung of the context's secondary voice, on the composer ground.
 *  ↻ 2026-08-05 (archetype consistency pass): these were `rgba(255,255,255,α)`
 *  and a literal cool near-white (#e8e8f0) — the last of the pre-archetype
 *  palette inside the planner. The composer sat in a parchment-on-navy frame
 *  rendering its text in cool white, which read as a different application.
 *  The alphas map 1:1 onto mixes of --muted so the token hierarchy is
 *  unchanged; only the hue allegiance moved. */
const dim = (pct: number) => `color-mix(in srgb, var(--muted) ${pct}%, ${COMPOSER_BG})`;

const notationTheme = EditorView.theme({
	// Container — the notation field, ⚓ styled as the filter rail's search box
	// (2026-08-11): --fill-rest over an inset 1px ring, full width, sitting
	// directly on the scene with no panel around it. That is `.field` in
	// app.css, transcribed rather than imported because CodeMirror's theme has
	// to inject its own CSS.
	// ⛔ It is NOT a bordered box any more: `border` → `box-shadow` inset, which
	// is what .field uses so the ring traces the input rather than adding a
	// layout edge. The three-state border (Nate 2026-07-19: resting line, hover
	// accent 50%, focused back to resting) survives as the ring's colour.
	// ⚠ Metrics are mirrored by .rp-notation-placeholder in
	// RotationTimeline.svelte (the pre-chunk-load stand-in) — keep in lockstep,
	// or the editor visibly jumps when the lazy chunk lands.
	'&': {
		background: 'var(--fill-rest)',
		border: 'none',
		boxShadow: 'inset 0 0 0 1px var(--border)',
		borderRadius: 'var(--r-sm)',
		fontSize: '13px',
		fontFamily: 'var(--font-mono)',
		lineHeight: '1.6',
		color: 'var(--text)',
		width: '100%',
		boxSizing: 'border-box',
		cursor: 'text',
		transition: 'box-shadow var(--t-snap), background var(--t-snap)'
	},
	'&:hover': {
		boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 50%, transparent)'
	},
	'&.cm-focused, &.cm-focused:hover': {
		outline: 'none',
		boxShadow: 'inset 0 0 0 1px var(--border)'
	},
	'.cm-placeholder': {
		color: dim(55)
	},
	// Inner scroller / content
	'.cm-scroller': {
		fontFamily: 'inherit',
		lineHeight: 'inherit',
		overflow: 'auto'
	},
	'.cm-content': {
		padding: '10px 12px',
		caretColor: 'var(--text)'
	},
	'.cm-line': { padding: '0' },
	'.cm-cursor, .cm-dropCursor': {
		borderLeftColor: 'var(--text)',
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
	'.rp-tok-char': { color: 'var(--text)', fontWeight: '500' },
	'.rp-tok-sep': { color: dim(30), padding: '0 3px' },
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
	'.rp-tok-time': { color: 'var(--muted)', paddingRight: '2px' },
	// ~?s is a time token with unknown value — an honest data gap, not an error.
	// Same family as .rp-tok-time, subordinated (dimmed), so it never borrows
	// the warning register.
	'.rp-tok-unset': { color: dim(52), paddingRight: '2px' },
	'.rp-tok-optional': { color: dim(50), paddingRight: '2px' },
	'.rp-tok-label': { color: 'var(--muted)', paddingRight: '2px' },
	// stack-assert: neutral gray, italic — visually subordinate to action tokens
	// since the assertion itself is metadata (no timeline event). Time (~Xs) and
	// stacks are held to the same non-infused gray so element tint stays the sole
	// signal of "this hits with an element" (Nate 2026-07-22).
	'.rp-tok-stack': {
		color: dim(70),
		paddingRight: '2px',
		fontStyle: 'italic',
		fontSize: '0.92em'
	},
	'.rp-tok-or-alt': { color: dim(50), paddingRight: '2px' },
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
	},
	// ── THE SECOND SQUIGGLE: an APPROXIMATED cast (notationFlags) ────────────
	// The token parsed perfectly; the character simply cannot perform it, so the
	// bar is drawn from a stand-in — an `hE` on a character with no hold variant,
	// an `sQ` with no short burst, a fifth character with nowhere to sit.
	//
	// ⚠ IT DOES NOT TAKE THE INK, and that is the whole difference from the
	// warning above. --ui-provisional is "this is approximate", not "you did
	// something" — and the token's colour is already carrying real information
	// (the caster's element tint), which recolouring would destroy to say
	// something quieter. So: the underline alone. The two registers are a
	// measured pair (ΔE .122; see the UI-state block in app.css), which is what
	// lets one amber squiggle be told from the other at this size.
	'.rp-flag-approx': {
		textDecorationLine: 'underline',
		textDecorationStyle: 'wavy',
		textDecorationColor: 'var(--ui-provisional)',
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
