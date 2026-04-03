/**
 * src/lib/utils/tokenizer.ts
 *
 * Position-aware tokenizer for KQM rotation notation.
 *
 * Consumes a full notation string and yields typed tokens with source offsets.
 * This is the shared contract between the rotation parser and the CodeMirror
 * syntax highlighting extension — both must agree on token boundaries and kinds.
 *
 * Token kind taxonomy:
 *   character   — syntactically first token in a segment; may or may not be a
 *                 valid character name (semantic validation is the parser's job)
 *   separator   — '>' segment divider
 *   Q           — Q burst cast
 *   E           — E skill cast (any variant: E, hE, tE, hEP, EP, h1E, h2E)
 *   time        — ~Xs pure time advance
 *   unset-time  — ~?s duration placeholder
 *   optional    — (...) optional action group
 *   label       — known KQM label tokens: N1–N9, C, C1–C9, A, P, hP, lP, D, J, W,
 *                 and bracket repeat groups [...]xN
 *   unknown     — does not match any known notation pattern (not character tokens —
 *                 those are always 'character' kind regardless of validity)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TokenKind =
	| 'character'
	| 'separator'
	| 'Q'
	| 'E'
	| 'time'
	| 'unset-time'
	| 'optional'
	| 'label'
	| 'unknown';

export type Token = {
	/** Start offset in the source string (inclusive). */
	from: number;
	/** End offset in the source string (exclusive). */
	to: number;
	kind: TokenKind;
	text: string;
};

// ---------------------------------------------------------------------------
// Internal classification (non-character tokens only)
// ---------------------------------------------------------------------------

/**
 * Classify a token that is NOT in the character-name slot.
 * Called after 'separator', 'unset-time', 'time', and bracket/optional
 * patterns are already handled by the regex priority.
 */
function classifyWord(text: string): TokenKind {
	if (text === 'Q') return 'Q';
	// E variants: optional prefix (t|h|h1|h2), optional suffix P
	if (/^(?:t|h|h1|h2)?E(?:P)?$/.test(text)) return 'E';
	// Known KQM label tokens
	if (
		/^N[1-9]?$/.test(text) || // normal attacks
		/^C[1-9]?$/.test(text) || // charged attacks
		text === 'A'             || // aim
		/^[lh]?P$/.test(text)   || // plunge
		text === 'D'             || // dash
		text === 'J'             || // jump
		text === 'W'                // walk
	) return 'label';
	return 'unknown';
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize a full KQM notation string into an array of position-aware tokens.
 *
 * Token priority in the regex (order matters):
 *   ~?s          — must precede ~[\d.]+s (both start with ~)
 *   ~[\d.]+s     — time advance
 *   \[[^\]]*\]   — bracket repeat group (with optional xN suffix)
 *   \([^)]*\)    — optional action group
 *   >            — segment separator
 *   \S+          — any other non-whitespace word
 *
 * Whitespace between tokens is skipped implicitly (not emitted as tokens).
 */
export function tokenizeNotation(notation: string): Token[] {
	const tokens: Token[] = [];

	// Matches one token (no leading whitespace captured — regex is anchored to \S)
	const re = /~\?s|~[\d.]+s|\[[^\]]*\](?:x\d+)?|\([^)]*\)|>|\S+/g;

	let atSegmentStart = true; // next non-separator match is a character name

	let m: RegExpExecArray | null;
	while ((m = re.exec(notation)) !== null) {
		const text = m[0];
		const from = m.index;
		const to = from + text.length;

		let kind: TokenKind;

		if (text === '>') {
			kind = 'separator';
			atSegmentStart = true;
		} else if (atSegmentStart) {
			// First non-separator token in a segment is always the character name slot,
			// regardless of whether it resolves to a known character.
			kind = 'character';
			atSegmentStart = false;
		} else if (text === '~?s') {
			kind = 'unset-time';
		} else if (/^~[\d.]+s$/.test(text)) {
			kind = 'time';
		} else if (/^\([^)]*\)$/.test(text)) {
			kind = 'optional';
		} else if (/^\[[^\]]*\](?:x\d+)?$/.test(text)) {
			kind = 'label';
		} else {
			kind = classifyWord(text);
		}

		tokens.push({ from, to, kind, text });
	}

	return tokens;
}
