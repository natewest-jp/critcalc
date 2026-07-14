/**
 * src/lib/utils/kqmExport.ts
 *
 * Exports a rotation-planner notation string as canonical KQM (Keqing Mains)
 * combat notation — the shareable, community-standard form.
 *
 * Our notation is already KQM-aligned but carries tool-only extensions a KQM
 * reader wouldn't understand. This normalizes to the standard:
 *
 *   - each character's actions become a block headed by the character name;
 *     blocks are joined with ` > ` (KQM's swap separator);
 *   - action tokens keep the user's original grouping — words written together
 *     stay fused (`N2C`), words written apart stay spaced (`N2C N2C`);
 *   - tool-only tokens are DROPPED: `~Xs` / `~?s` on-field-time advances,
 *     `{key:N}` stack assertions, and the `/alt` side of an `E/Q` or-pair (the
 *     tool only ever places the first option on the timeline);
 *   - standard tokens pass through verbatim: N/C/A/P/plunge/E-family/Q/D/J/W,
 *     `[...]xN` repeat groups, and `( )` optional-action groups (KQM-compatible);
 *   - unrecognized tokens are preserved verbatim rather than silently dropped —
 *     a token our parser doesn't model may still be valid KQM (`CA`, `CS`, …),
 *     and a dropped token would be invisible data loss.
 *
 * Pure string → string. Reuses {@link tokenizeNotation} so it agrees with the
 * parser on token boundaries (concatenated runs, multi-word names, `>` splits).
 *
 * The opposite direction (KQM → our notation) needs no codec: the tokenizer
 * already accepts concatenated tokens and `>` separators, so KQM text pasted
 * into the editor parses directly.
 */

import { tokenizeNotation, type Token, type TokenKind } from '$lib/utils/tokenizer';

/** Tool-only token kinds with no KQM equivalent — omitted from the export. */
const DROPPED_KINDS: ReadonlySet<TokenKind> = new Set<TokenKind>([
	'time', // ~Xs on-field-time advance
	'unset-time', // ~?s duration placeholder
	'stack-assert', // {key:N} resource assertion
	'or-alt' // the /alt side of an E/Q or-pair (only the first option is real)
]);

/**
 * Convert rotation-planner notation into canonical KQM combat notation.
 *
 * @param notation  the planner notation string (as typed / stored)
 * @returns a single-line KQM string: `Name actions > Name actions > …`.
 *          Returns `''` for empty / whitespace-only input.
 */
export function toKqmNotation(notation: string): string {
	const tokens = tokenizeNotation(notation);

	type Segment = { name: string; actions: Token[] };
	const segments: Segment[] = [];
	let current: Segment | null = null;

	for (const tok of tokens) {
		if (tok.kind === 'character') {
			current = { name: tok.text.trim(), actions: [] };
			segments.push(current);
		} else if (tok.kind === 'separator' || DROPPED_KINDS.has(tok.kind)) {
			// Separators only delimit segments (rebuilt as ` > `); dropped kinds
			// are tool-only and have no KQM equivalent.
			continue;
		} else if (current) {
			// Q / E / labels (N,C,A,P,plunge,D,J,W,[...]xN) / ( ) optional groups /
			// unrecognized tokens — all pass through to the action block.
			current.actions.push(tok);
		}
	}

	return segments
		.map((seg) => renderBlock(seg.name, seg.actions, notation))
		.filter((block) => block.length > 0)
		.join(' > ');
}

/**
 * Render one character block: `Name a1 a2 …`. Two action tokens are concatenated
 * when they were adjacent in the source (no whitespace between them, e.g. `N2C`)
 * and space-separated otherwise — preserving the user's original grouping while
 * any dropped tokens collapse out.
 */
function renderBlock(name: string, actions: Token[], source: string): string {
	let block = name;
	for (let i = 0; i < actions.length; i++) {
		const tok = actions[i];
		const prev = i === 0 ? null : actions[i - 1];
		// First action: always a space after the name. Between actions: a space
		// only if the source gap between them held whitespace (else keep fused).
		const fused = prev !== null && !/\s/.test(source.slice(prev.to, tok.from));
		block += (fused ? '' : ' ') + tok.text;
	}
	return block;
}
