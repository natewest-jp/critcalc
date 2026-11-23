/**
 * A text's width in columns, for an input sized by `size` (which counts
 * average Latin characters): a wide character (CJK, kana, Hangul, fullwidth
 * forms) takes two, so a Japanese name isn't cut to half its length.
 */
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꥠ-꥿가-힣豈-﫿︰-﹏＀-｠￠-￦]/u;

export function columns(text: string): number {
	let n = 0;
	for (const ch of text) n += WIDE.test(ch) ? 2 : 1;
	return n;
}
