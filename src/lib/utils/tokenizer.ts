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
 *   E           — E skill cast (any variant: E, hE, tE, h1E, h2E)
 *   time        — ~Xs pure time advance
 *   unset-time  — ~?s duration placeholder
 *   optional    — (...) optional action group
 *   label       — known KQM label tokens: N1–N9, C, C1–C9, A, P, hP, lP, D, J, W,
 *                 and bracket repeat groups (with optional numeric prefix: 3[C], [N2D]x3)
 *   stack-assert — {key:N} assertion of a named-resource stack count
 *                  (Heizou Declension, Yanfei Scarlet Seals, etc.). Updates
 *                  per-character stack state for subsequent ability/effect
 *                  resolution. Key must be lowercase identifier.
 *   or-alt      — the alternative side of a slash pair (E/Q → E active, /Q or-alt).
 *                 Dimmed in the editor; ignored by the parser. Only the first option
 *                 before the slash is placed on the timeline.
 *   unknown     — does not match any known notation pattern (not character tokens —
 *                 those are always 'character' kind regardless of validity)
 *
 * Concatenated notation:
 *   Action tokens may be written without spaces between them, e.g. "Bennett QEN1N2~2s".
 *   The outer regex captures such a run as a single \S+ match, then splitConcatenated
 *   greedily re-tokenizes it into individual action tokens using longest-match rules.
 *   Words that don't start with a known action-token prefix (see ACTION_FIRST_CHARS)
 *   are kept as a single 'unknown' token to avoid noisily splitting character names
 *   that happen to appear in the wrong position.
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
	| 'stack-assert'
	| 'or-alt'
	| 'unknown';

export type Token = {
	/** Start offset in the source string (inclusive). */
	from: number;
	/** End offset in the source string (exclusive). */
	to: number;
	kind: TokenKind;
	text: string;
};

/** Pattern matching the `{key:N}` stack-assert form. Anchored, no flags.
 *  - key: lowercase letter followed by lowercase letters/digits/underscore/hyphen
 *  - count: non-negative integer
 *  Captures: [1] = key, [2] = count (as string). */
export const STACK_ASSERT_RE = /^\{([a-z][a-z0-9_-]*):(\d+)\}$/;

// ---------------------------------------------------------------------------
// Internal classification helpers
// ---------------------------------------------------------------------------

/**
 * Classify a single, already-isolated action word.
 * Called for space-separated tokens and for each sub-token produced by
 * splitConcatenated. Structural token types (~Xs, ~?s, [...], (...)) are
 * handled before this function is reached.
 */
function classifyWord(text: string): TokenKind {
	if (text === 'Q') return 'Q';
	// E variants: optional prefix (t|p|h|h1|h2), optional suffix P
	if (/^(?:t|p|h|h1|h2)?E$/.test(text)) return 'E';
	// Known KQM label tokens
	if (
		/^N[1-9]?$/.test(text) || // normal attacks: N, N1–N9
		/^C[1-9]?$/.test(text) || // charged attacks: C, C1–C9
		text === 'A'             || // aim
		/^[lh]?P$/.test(text)   || // plunge: P, hP, lP
		text === 'D'             || // dash
		text === 'J'             || // jump
		text === 'W'                // walk
	) return 'label';
	return 'unknown';
}

/**
 * Classify a sub-token produced by CONCAT_SPLIT_RE.
 * Extends classifyWord to also handle structural token types that the outer
 * regex normally catches separately but may appear inside a concatenated run
 * (e.g. the '~2s' in 'N2~2s' when no space precedes the tilde).
 */
function classifySubToken(text: string): TokenKind {
	if (text === '~?s') return 'unset-time';
	if (/^~(?:\d+\.?\d*|\.\d+)s$/.test(text)) return 'time';
	if (/^\([^)]*\)$/.test(text)) return 'optional';
	// Bracket repeat groups: [N2D]x3, 3[C], [C]
	if (/^(?:\d+(?:-\d+)?)?\[[^\]]*\](?:x\d+)?$/.test(text)) return 'label';
	// Stack assertions: {seal:4}, {declension:0}
	if (STACK_ASSERT_RE.test(text)) return 'stack-assert';
	// Slash alternatives: /Q, /E, /N1 etc. — the or-alt side of a slash pair
	if (text.startsWith('/')) return 'or-alt';
	return classifyWord(text);
}

// ---------------------------------------------------------------------------
// Concatenated token splitting
// ---------------------------------------------------------------------------

/**
 * First characters of known action tokens.
 * A \S+ word starting with one of these is greedily split into sub-tokens.
 * Words starting with any other character (e.g. character names mis-placed
 * inside a segment) are kept as a single 'unknown' to reduce noise.
 */
const ACTION_FIRST_CHARS = new Set('~[/{(QEhtlpNCADJWP');

/**
 * Greedy longest-match regex for splitting a concatenated action-token run.
 * Alternatives are ordered longest/most-specific first so that e.g. 'h1E'
 * matches before 'hE', and 'N2' matches before bare 'N'.
 *
 * Note: this regex is used as a module-level constant with a `g` flag.
 * Always reset `lastIndex` to 0 before using `.exec()` in a loop.
 */
const CONCAT_SPLIT_RE =
	/~\?s|~(?:\d+\.?\d*|\.\d+)s|(?:\d+(?:-\d+)?)?\[[^\]]*\](?:x\d+)?|\([^)]*\)|\{[a-z][a-z0-9_-]*:\d+\}|h1E|h2E|hE|tE|pE|hP|lP|N[1-9]?|C[1-9]?|[QEADJWP]|\/\S*|[^\s]/g;

/**
 * Greedily split a concatenated action-token word into individual tokens.
 *
 * @param text        The raw \S+ match text.
 * @param startOffset Position of `text` in the original notation string.
 * @returns One token per recognized sub-token, each with correct source offsets.
 */
function splitConcatenated(text: string, startOffset: number): Token[] {
	// Words that don't open with a known action prefix are kept as-is.
	// This prevents character names (e.g. 'Fischl' mis-placed mid-segment)
	// from being noisily split into individual unknown characters.
	if (text.length === 0 || !ACTION_FIRST_CHARS.has(text[0])) {
		return [{ from: startOffset, to: startOffset + text.length, kind: 'unknown', text }];
	}

	const tokens: Token[] = [];
	CONCAT_SPLIT_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = CONCAT_SPLIT_RE.exec(text)) !== null) {
		const subText = m[0];
		const from = startOffset + m.index;
		const to = from + subText.length;
		tokens.push({ from, to, kind: classifySubToken(subText), text: subText });
	}
	return tokens;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize a full KQM notation string into an array of position-aware tokens.
 *
 * The outer regex captures one structural unit per match. Priority order:
 *   ~?s                       — unset-duration placeholder (must precede ~[\d.]+s)
 *   ~[\d.]+s                  — time advance
 *   (?:\d+(?:-\d+)?)?\[[^\]]*\](?:x\d+)?   — bracket repeat group, with optional numeric prefix
 *   \([^)]*\)                 — optional action group
 *   >                         — segment separator
 *   \S+                       — everything else: character name (first in segment) or a
 *                               run of concatenated action tokens (greedily re-split below)
 *
 * Whitespace is skipped implicitly (not emitted as tokens).
 * Supports both space-separated and concatenated action-token notation.
 */
export function tokenizeNotation(notation: string): Token[] {
	const tokens: Token[] = [];

	const re = /~\?s|~(?:\d+\.?\d*|\.\d+)s|(?:\d+(?:-\d+)?)?\[[^\]]*\](?:x\d+)?|\([^)]*\)|\{[a-z][a-z0-9_-]*:\d+\}|>|\S+/g;

	let atSegmentStart = true; // next non-separator match is a character name

	let m: RegExpExecArray | null;
	while ((m = re.exec(notation)) !== null) {
		const text = m[0];
		const from = m.index;
		const to = from + text.length;

		if (text === '>') {
			tokens.push({ from, to, kind: 'separator', text });
			atSegmentStart = true;
		} else if (atSegmentStart) {
			// Character name token — may span multiple words for multi-word names like
			// "Hu Tao" or "Yun Jin". Greedily absorb subsequent words that classify as
			// 'unknown' (not a recognised action token) into the name.
			let nameText = text;
			let nameTo = to;
			while (true) {
				const peekIndex = re.lastIndex;
				const nextM = re.exec(notation);
				if (!nextM) {
					// When exec returns null, JS resets re.lastIndex to 0. If we
					// don't restore it, the outer while loop will re-match from
					// the start of the string — emitting duplicate tokens and,
					// for inputs with '>', looping forever.
					re.lastIndex = peekIndex;
					break;
				}
				const nextText = nextM[0];
				// Stop at separator, structural tokens, or any recognised action token.
				if (nextText === '>' ||
					nextText === '~?s' ||
					/^~[\d.]+s$/.test(nextText) ||
					/^\([^)]*\)$/.test(nextText) ||
					/^(?:\d+(?:-\d+)?)?\[[^\]]*\](?:x\d+)?$/.test(nextText) ||
					STACK_ASSERT_RE.test(nextText) ||
					classifySubToken(nextText) !== 'unknown') {
					re.lastIndex = peekIndex;
					break;
				}
				nameText += ' ' + nextText;
				nameTo = nextM.index + nextText.length;
			}
			tokens.push({ from, to: nameTo, kind: 'character', text: nameText });
			atSegmentStart = false;
		} else if (text === '~?s') {
			tokens.push({ from, to, kind: 'unset-time', text });
		} else if (/^~[\d.]+s$/.test(text)) {
			tokens.push({ from, to, kind: 'time', text });
		} else if (/^\([^)]*\)$/.test(text)) {
			tokens.push({ from, to, kind: 'optional', text });
		} else if (/^(?:\d+(?:-\d+)?)?\[[^\]]*\](?:x\d+)?$/.test(text)) {
			tokens.push({ from, to, kind: 'label', text });
		} else if (STACK_ASSERT_RE.test(text)) {
			tokens.push({ from, to, kind: 'stack-assert', text });
		} else {
			// \S+ non-character word: greedily split into action tokens.
			// splitConcatenated handles both single-token words and concatenated runs.
			for (const tok of splitConcatenated(text, from)) {
				tokens.push(tok);
			}
		}
	}

	return tokens;
}
