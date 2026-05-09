/**
 * src/lib/utils/formatNotation.ts
 *
 * Paste auto-formatter: converts concatenated KQM notation into the
 * space-separated format used by the rotation planner, and injects ~?s
 * into segments that have label tokens but no explicit time extension.
 *
 * Example:
 *   "Bennett Q > Fischl EN1N2"
 *   → "Bennett Q > Fischl E N1 N2 ~?s"
 */

// ---------------------------------------------------------------------------
// Longest-match KQM tokeniser regex
// ---------------------------------------------------------------------------
//
// Alternatives are ordered longest/most-specific first so that e.g. "h1E"
// matches before "hE", and "N1" matches before bare "N".
//
const KQM_TOKEN_RE = new RegExp(
	[
		'~\\?s', // unset-duration placeholder
		'~[\\d.]+s', // time advance
		'\\[[^\\]]*\\](?:x\\d+)?', // bracket repeat group: [N2D]x3
		'\\([^)]*\\)', // optional group: (N1N2)
		'h1E',
		'h2E', // level hold skills (before hE)
		'hE', // hold E
		'tE', // tap E
		'hP', // high plunge (before bare P)
		'lP', // low plunge (before bare P)
		'N\\d+', // numbered normal: N1, N2, …
		'[QECAPhPJDW]', // single-char KQM action tokens
		'\\S+' // anything else (character names, etc.)
	].join('|'),
	'g'
);

// Tokens that indicate label activity (not timing or ability tokens)
const LABEL_TOKEN_RE = /^(?:N\d+|[CADJW]|hP|lP|P|\[[^\]]*\](?:x\d+)?|\([^)]*\))$/;

// Tokens that provide explicit timing
const TIME_TOKEN_RE = /^(?:~[\d.]+s|~\?s)$/;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Superscript digit characters used as KQM footnote markers (⁰¹²³⁴⁵⁶⁷⁸⁹)
const SUPERSCRIPT_RE = /[\u00B2\u00B3\u00B9\u2070\u2074-\u2079]+/g;

/**
 * Format a (possibly concatenated) KQM notation string into the
 * space-separated format expected by the rotation planner parser.
 *
 * Pre-processing steps applied before tokenising:
 *   - Superscript footnote markers (¹²³…) are stripped
 *   - Slashes are padded with spaces so they become standalone tokens
 *
 * Safe to call on already-formatted input — idempotent.
 */
export function formatKQMPaste(text: string): string {
	// Strip superscript footnote markers, then ensure slashes are standalone
	const cleaned = text.replace(SUPERSCRIPT_RE, '').replace(/\//g, ' / ');

	const segments = cleaned
		.split('>')
		.map((s) => s.trim())
		.filter(Boolean);

	const formatted = segments.map((segment) => {
		// Extract all tokens via longest-match
		const rawTokens = segment.match(KQM_TOKEN_RE) ?? [];

		// Determine whether a ~?s should be appended:
		// - segment has at least one label-kind token
		// - segment has no explicit time token
		const hasLabel = rawTokens.some((t) => LABEL_TOKEN_RE.test(t));
		const hasTime = rawTokens.some((t) => TIME_TOKEN_RE.test(t));

		const tokens = hasLabel && !hasTime ? [...rawTokens, '~?s'] : rawTokens;

		return tokens.join(' ');
	});

	return formatted.join(' > ');
}
