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
 *   sE          — KQM's SPECIAL Elemental Skill: the one a stance substitutes
 *                 for the ordinary E (Varka's Four Winds' Ascension). Classifies
 *                 as an E; which ability it lands on is state resolution.
 *   sC          — KQM's SPECIAL Charged Attack (Varka's Azure Devour). Reads
 *                 `NormalAbility.specialChargeFrames`, falling back to the
 *                 ordinary charge when the resolved ability authors none.
 *   Q           — Q burst cast (Q, or the KQM short-burst sQ — Flins
 *                 Thunderous Symphony / Varesa Volcano Kablam)
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
 *  - key: lowercase letter followed by camelCase / digits / underscore / hyphen
 *    (camelCase accepted to match the codebase's `coldDish` / `huntersExperience`
 *    JSON-key convention; first char must still be lowercase to keep the
 *    pattern unambiguous against character names that begin uppercase).
 *  - count: non-negative integer
 *  Captures: [1] = key, [2] = count (as string). */
/**
 * Upper bound on a notation we are willing to tokenize or parse, in characters.
 *
 * ⚠️ A SAFETY guard, not a product limit. Parsing runs synchronously per
 * keystroke, and the 2026-08-14 hardening sweep showed that a few hundred bytes
 * of hostile-but-legal notation can expand into millions of IR events — freezing
 * or OOM-ing the tab with no exception to catch. The `?r=` share link makes that
 * remote: a ~90-character URL can kill the *recipient's* tab, and the planner
 * persists what it imports, so it re-kills on every reload.
 *
 * Full defect list and measurements: `docs/parser-hardening-2026-08-14.md`.
 *
 * 16 KiB is ~3× the largest rotation anyone would plausibly write — a realistic
 * four-character rotation cycled out to 5,319 characters parses in 19 ms. Both
 * the share-link decoder (`rotationUrl.ts`) and the editor enforce it, so the
 * two entry points cannot drift apart.
 */
export const MAX_NOTATION_CHARS = 16_384;

/**
 * ⚠️ THE TIME-TOKEN PATTERN IS `~(?:\d+(?:\.\d+)?|\.\d+)s` AT ALL THREE SITES —
 * `classifySubToken`, `CONCAT_SPLIT_RE`, and the outer `tokenizeNotation` regex.
 * Keep them identical, and do NOT "simplify" the first alternative back to
 * `\d+\.?\d*`.
 *
 * That earlier form put two digit quantifiers side by side with an optional dot
 * between them, so on a digit run NOT terminated by `s` — where the match must
 * fail — the engine retried every possible (i,j) split of `\d+`/`\d*`. Classic
 * catastrophic backtracking: 40k digits after a bare `~` took 2.35 s per pass,
 * 80k took 9.4 s, and the cost lands THREE times per keystroke (parser, linter,
 * and the CodeMirror highlight plugin, which also re-runs on caret moves).
 * 200k digits deflate to a 362-character share link. (§4 of the hardening doc.)
 *
 * `(?:\.\d+)?` removes the ambiguity: the dot must be followed by digits, so
 * there is exactly one way to match and nothing to backtrack through. Measured
 * after: 80k digits went from 9,439 ms to 0 ms.
 *
 * ⚓ AND IT CHANGES NOTHING ABOUT WHAT TOKENIZES. That is worth stating because
 * it is not obvious: these three are the SCANNING patterns, but the kinds are
 * actually assigned by `/^~[\d.]+s$/` further down (the `nextText` peek and the
 * `text` dispatch). That pattern is one quantifier over a character class, so it
 * has no ambiguous split and never backtracked. A form the scanner's time
 * alternative now rejects — `~12.s`, `~12.5.7s` — is simply picked up by the
 * `[^\s>]+` catch-all and classified `time` exactly as before. Verified across
 * `~5s`, `~12.5s`, `~.5s`, `~0.25s`, `~12.s`, `~12.5.7s`: all still `time`.
 *
 * ⚠️ So do NOT "align" the permissive classifier with the strict scanner as a
 * tidy-up. That would be a real behaviour change wearing the costume of a
 * consistency fix, and it is not what bought the speed here.
 */

export const STACK_ASSERT_RE = /^\{([a-z][a-zA-Z0-9_-]*):(\d+)\}$/;

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
	// Q variants: sQ is the KQM "short-Q" token (Flins Thunderous Symphony,
	// Varesa Volcano Kablam) — same cast kind, variant-resolved by the parser.
	if (text === 'Q' || text === 'sQ') return 'Q';
	// E variants: optional prefix (t|p|h|h1|h2), optional suffix P.
	// ⚓ `sE` is KQM's token for a SPECIAL Elemental Skill — the one that
	// replaces the ordinary E inside a stance (Varka's Four Winds' Ascension),
	// the sibling of `sQ` above. It classifies as an ordinary E: which ability
	// it lands on is the parser's state resolution, not the token's.
	if (/^(?:t|p|h|h1|h2|s)?E$/.test(text)) return 'E';
	// Known KQM label tokens
	if (
		/^N[1-9]?$/.test(text) || // normal attacks: N, N1–N9
		/^s?C[1-9]?$/.test(text) || // charged attacks: C, C1–C9, and KQM's sC
		text === 'A' || // aim
		/^[lh]?P$/.test(text) || // plunge: P, hP, lP
		text === 'D' || // dash
		text === 'J' || // jump
		text === 'W' // walk
	)
		return 'label';
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
	if (/^~(?:\d+(?:\.\d+)?|\.\d+)s$/.test(text)) return 'time';
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
const ACTION_FIRST_CHARS = new Set('~[/{(QEhtlpsNCADJWP');

/**
 * Greedy longest-match regex for splitting a concatenated action-token run.
 * Alternatives are ordered longest/most-specific first so that e.g. 'h1E'
 * matches before 'hE', and 'N2' matches before bare 'N'.
 *
 * Note: this regex is used as a module-level constant with a `g` flag.
 * Always reset `lastIndex` to 0 before using `.exec()` in a loop.
 */
const CONCAT_SPLIT_RE =
	/~\?s|~(?:\d+(?:\.\d+)?|\.\d+)s|(?:\d+(?:-\d+)?)?\[[^\]]*\](?:x\d+)?|\([^)]*\)|\{[a-z][a-zA-Z0-9_-]*:\d+\}|h1E|h2E|hE|tE|pE|sE|hP|lP|sQ|sC[1-9]?|N[1-9]?|C[1-9]?|[QEADJWP]|\/\S*|[^\s]/g;

/**
 * Greedily split a concatenated action-token word into individual tokens.
 *
 * @param text        The raw \S+ match text.
 * @param startOffset Position of `text` in the original notation string.
 * @returns One token per recognized sub-token, each with correct source offsets.
 */
/**
 * True when a word would split ENTIRELY into recognized action tokens — i.e.
 * it is a concatenated action run like 'QEN1N2~2s' or 'EN1C', not a name word.
 * Used by the character-name absorb loop: name words like 'Jin' or 'Ayato'
 * start with an action char but contain unrecognized residue, so they are
 * still absorbed; a pure action run terminates the name.
 */
function isActionRun(text: string): boolean {
	if (text.length === 0 || !ACTION_FIRST_CHARS.has(text[0])) return false;
	CONCAT_SPLIT_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = CONCAT_SPLIT_RE.exec(text)) !== null) {
		if (classifySubToken(m[0]) === 'unknown') {
			CONCAT_SPLIT_RE.lastIndex = 0;
			return false;
		}
	}
	return true;
}

function splitConcatenated(text: string, startOffset: number): Token[] {
	// Words that don't open with a known action prefix are kept as-is.
	// This prevents character names (e.g. 'Fischl' mis-placed mid-segment)
	// from being noisily split into individual unknown characters.
	if (text.length === 0 || !ACTION_FIRST_CHARS.has(text[0])) {
		return [{ from: startOffset, to: startOffset + text.length, kind: 'unknown', text }];
	}
	return tokenizeActionRun(text, startOffset);
}

/**
 * Split a run of action tokens with no character-name context — the greedy
 * longest-match pass, minus the "does this look like a name?" guard that
 * {@link splitConcatenated} applies first.
 *
 * Exported for the notation LINTER (notationFlags.ts), which has to see inside
 * a bracket repeat group: `2[hE C]` reaches the tokenizer as ONE `label` token,
 * so a linter that only walked top-level tokens would have a silent hole
 * exactly where a rotation repeats itself. Offsets are absolute — pass the
 * position of `text` in the source string.
 *
 * Whitespace inside `text` is skipped (it matches no alternative, and a global
 * `exec` walks past it), so both `[hEC]` and `[hE C]` split the same way.
 */
export function tokenizeActionRun(text: string, startOffset = 0): Token[] {
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
 *   >                         — segment separator (also splits unspaced words: 'Q>Raiden')
 *   [^\s>]+                   — everything else: character name (first in segment) or a
 *                               run of concatenated action tokens (greedily re-split below)
 *
 * Whitespace is skipped implicitly (not emitted as tokens).
 * Supports both space-separated and concatenated action-token notation.
 */
export function tokenizeNotation(notation: string): Token[] {
	const tokens: Token[] = [];

	// Note the final word alternative is [^\s>]+, not \S+: an unspaced '>'
	// ('Q>Raiden') must still terminate the word so the separator is emitted.
	const re =
		/~\?s|~(?:\d+(?:\.\d+)?|\.\d+)s|(?:\d+(?:-\d+)?)?\[[^\]]*\](?:x\d+)?|\([^)]*\)|\{[a-z][a-zA-Z0-9_-]*:\d+\}|>|[^\s>]+/g;

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
			// 'unknown' (not a recognized action token) into the name.
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
				// Stop at separator, structural tokens, or any recognized action token.
				if (
					nextText === '>' ||
					nextText === '~?s' ||
					/^~[\d.]+s$/.test(nextText) ||
					/^\([^)]*\)$/.test(nextText) ||
					/^(?:\d+(?:-\d+)?)?\[[^\]]*\](?:x\d+)?$/.test(nextText) ||
					STACK_ASSERT_RE.test(nextText) ||
					classifySubToken(nextText) !== 'unknown' ||
					isActionRun(nextText)
				) {
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
