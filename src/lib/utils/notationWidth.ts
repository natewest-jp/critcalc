/**
 * Notation typed with a Japanese keyboard, made plain ASCII.
 *
 * A player who stays in Japanese input writes notation in full-width forms:
 * Ｅ, Ｑ, ＞, ～２ｓ, the ideographic space, 「」 for a repeat's brackets. The
 * composer folds them as they land (typing and paste,
 * `notationEditorExtension.ts`), so the text a player sees, copies, and
 * shares is always the notation everyone reads. The parser stays strict.
 *
 * Every rule maps one character to one character, so a caret or a range
 * never moves. Japanese names are left as they are; the composer offers
 * their notation names separately (`$lib/i18n/notationNames`).
 *
 * Left out on purpose:
 * - 、 (the IME's `,`): notation has no comma, so there is nothing to map to.
 * - → : Japanese and Chinese write it between actions as well as between
 *   characters (E→Q), so reading it as `>` would make Q a character.
 * - Kana for letters (え for E): a kana word may be the start of a name.
 */

/** Fullwidth forms of printable ASCII, U+FF01 to U+FF5E, are ASCII + 0xFEE0. */
const FULLWIDTH = new RegExp('[\\uFF01-\\uFF5E]');
const FULLWIDTH_OFFSET = 0xfee0;

/** Japanese punctuation an IME types for an ASCII key notation uses, where
 *  the meaning is the same wherever it stands. */
const ALWAYS: Record<string, string> = {
	[String.fromCharCode(0x3000)]: ' ', // the ideographic space
	[String.fromCharCode(0x301c)]: '~', // 〜, the wave dash (macOS's ~)
	'「': '[',
	'」': ']'
};

/** Characters that mean the ASCII one only between two ASCII letters or
 *  digits, since elsewhere they belong to Japanese words: 。 is a sentence's
 *  end but `.` in ~1.5s; ー lengthens a vowel (フリーナ) but is `-` in 1-3[N];
 *  ・ separates foreign words but is `/` in E/Q. */
const BETWEEN: Record<string, { ascii: string; around: RegExp }> = {
	'。': { ascii: '.', around: /[0-9]/ },
	ー: { ascii: '-', around: /[0-9]/ },
	'・': { ascii: '/', around: /[A-Za-z0-9]/ }
};

/** Whether `text` holds anything to fold at all. */
const ANY = new RegExp('[\\uFF01-\\uFF5E\\u3000\\u301C「」。ー・]');

const fold = (ch: string): string =>
	FULLWIDTH.test(ch) ? String.fromCharCode(ch.charCodeAt(0) - FULLWIDTH_OFFSET) : ch;

/**
 * `text` with its full-width notation made ASCII, the same length.
 *
 * A full-width bracket pair is kept when what it holds is not ASCII: that is
 * a name (旅人（風）), and ASCII brackets would make the tokenizer read its
 * element as an optional group. A bracket with no partner yet is kept too.
 */
export function halfWidthNotation(text: string): string {
	if (!ANY.test(text)) return text;
	// UTF-16 units, not code points, so indexes stay the text's own (a
	// surrogate half is never one of ours and passes through).
	const chars = text
		.split('')
		.map((ch) => (ch === '（' || ch === '）' ? ch : (ALWAYS[ch] ?? fold(ch))));
	// A （…） pair folds only once it is closed and holds ASCII: an open （
	// may be the start of 旅人（風） still being typed.
	for (let i = 0; i < chars.length; i++) {
		if (text[i] !== '（') continue;
		const close = text.indexOf('）', i + 1);
		if (close < 0) break;
		const inner = chars.slice(i + 1, close).join('');
		if (!/[^ -~]/.test(inner) && !inner.includes('（')) {
			chars[i] = '(';
			chars[close] = ')';
		}
		i = close;
	}
	for (let i = 0; i < chars.length; i++) {
		const rule = BETWEEN[chars[i]];
		if (rule && rule.around.test(chars[i - 1] ?? '') && rule.around.test(chars[i + 1] ?? ''))
			chars[i] = rule.ascii;
	}
	return chars.join('');
}

/** The ranges of `text` that `halfWidthNotation` would change, as one-char
 *  replacements, for a transaction that touches only those. */
export function halfWidthChanges(text: string): { from: number; to: number; insert: string }[] {
	const folded = halfWidthNotation(text);
	if (folded === text) return [];
	const out: { from: number; to: number; insert: string }[] = [];
	for (let i = 0; i < text.length; i++)
		if (folded[i] !== text[i]) out.push({ from: i, to: i + 1, insert: folded[i] });
	return out;
}
