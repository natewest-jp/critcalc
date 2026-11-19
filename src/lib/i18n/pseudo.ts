/**
 * The pseudo-locale (`en-XA`): English made longer and accented, to find
 * layout breaks before any real translation (docs/design/i18n-plan.md §5,
 * step 4). ⚓ Nate 2026-11-19: it ships as one more hidden, `noindex` locale,
 * so he can check it on his own phone and in real Safari.
 *
 * Each message is accented letter for letter, padded about 35% with filler
 * words, and bracketed, so a clipped end shows as a missing `⟧`:
 * "Saved" → "⟦Šåṽéð ōñé⟧". Placeholders (`{name}`) and markup (`{#strong}`)
 * pass through untouched, so every message still takes its inputs.
 *
 * `messages/en-XA.json` is generated from `messages/en.json` by
 * `scripts/generate-pseudo-locale.mjs`; `pseudo.test.ts` fails when it is stale.
 */

/** 🎛️ How much longer than English a pseudo message runs (the plan's ~35%,
 *  the growth of the longest European languages). */
export const PSEUDO_GROWTH = 0.35;

const ACCENTS: Record<string, string> = {
	a: 'å',
	b: 'ƀ',
	c: 'ç',
	d: 'ð',
	e: 'é',
	f: 'ƒ',
	g: 'ĝ',
	h: 'ĥ',
	i: 'î',
	j: 'ĵ',
	k: 'ķ',
	l: 'ļ',
	m: 'ɱ',
	n: 'ñ',
	o: 'ö',
	p: 'þ',
	q: 'ǫ',
	r: 'ŕ',
	s: 'š',
	t: 'ţ',
	u: 'û',
	v: 'ṽ',
	w: 'ŵ',
	x: 'ẋ',
	y: 'ý',
	z: 'ž',
	A: 'Å',
	B: 'Ɓ',
	C: 'Ç',
	D: 'Ð',
	E: 'É',
	F: 'Ƒ',
	G: 'Ĝ',
	H: 'Ĥ',
	I: 'Î',
	J: 'Ĵ',
	K: 'Ķ',
	L: 'Ļ',
	M: 'Ṁ',
	N: 'Ñ',
	O: 'Ö',
	P: 'Þ',
	Q: 'Ǫ',
	R: 'Ŕ',
	S: 'Š',
	T: 'Ţ',
	U: 'Û',
	V: 'Ṽ',
	W: 'Ŵ',
	X: 'Ẋ',
	Y: 'Ý',
	Z: 'Ž'
};
const FILLER = ['ōñé', 'ţŵö', 'ţĥŕéé', 'ƒöûŕ', 'ƒîṽé', 'šîẋ', 'šéṽéñ', 'éîĝĥţ', 'ñîñé', 'ţéñ'];

const accent = (text: string) => text.replace(/[A-Za-z]/g, (c) => ACCENTS[c]);

/** A message's text: accented outside its `{…}` pieces, padded, bracketed. */
export function pseudo(text: string): string {
	const pieces = text.split(/(\{[^{}]*\})/);
	const body = pieces.map((p, i) => (i % 2 ? p : accent(p))).join('');
	const visible = pieces.filter((_, i) => i % 2 === 0).join('').length;
	const want = Math.max(1, Math.round(visible * PSEUDO_GROWTH));
	const pad: string[] = [];
	for (let n = 0, i = 0; n < want; i++) {
		const word = FILLER[i % FILLER.length];
		pad.push(word);
		n += word.length + 1;
	}
	return `⟦${body} ${pad.join(' ')}⟧`;
}

type Variants = { match: Record<string, string> } & Record<string, unknown>;
export type Message = string | Variants[];

/** The pseudo form of a whole message, variants and all. */
export const pseudoMessage = (msg: Message): Message =>
	typeof msg === 'string'
		? pseudo(msg)
		: msg.map((v) => ({
				...v,
				match: Object.fromEntries(Object.entries(v.match).map(([k, t]) => [k, pseudo(t)]))
			}));

/** The pseudo locale's file from English's, `$schema` kept. */
export function pseudoFile(en: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(en).map(([k, v]) => [k, k.startsWith('$') ? v : pseudoMessage(v as Message)])
	);
}
