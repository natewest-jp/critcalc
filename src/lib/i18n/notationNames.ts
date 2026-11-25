/**
 * A character name typed in another language, turned into the name notation
 * uses. The composer offers it (`notationEditorExtension.ts`) and never
 * rewrites on its own: notation stays the English community standard, so a
 * shared rotation reads the same for everyone, in every locale.
 *
 * The names are the game's own, from the table `$lib/i18n/gameNames` shows on
 * `/ja`. Which languages are offered is `SUGGEST_FROM`; adding Chinese is a
 * line there and a test case, nothing else.
 */
import { GAME_NAMES } from '$lib/data/gameNames.generated';
import { getCharacterIndexEntry, travelerName } from '$lib/data/characterLookup';

/** The languages whose character names the composer turns into notation.
 *  ⚠️ Chinese is held back on purpose: many of its names share their kanji with
 *  the Japanese ones, so before adding `'zh'` check that no string names two
 *  different characters across the two tables (the test does). */
export const SUGGEST_FROM: readonly string[] = ['ja'];

/** A prefix shorter than this offers nothing unless it is a whole name: one
 *  kana (リ) starts a dozen names, while 魈 is one character long. */
export const MIN_PREFIX = 2;

export interface NameSuggestion {
	/** The character's id. */
	id: string;
	/** The name notation uses (`Hu Tao`, `Anemo Traveler`). */
	notation: string;
	/** The game's name the player typed toward (胡桃, 旅人（風）). */
	native: string;
	/** Whether the query was the whole name, not only its start. */
	exact: boolean;
}

/** Whether a word is outside notation's alphabet, and so might be a name in
 *  another language. Notation itself is printable ASCII. */
export const isForeignName = (text: string): boolean => /[^ -~]/.test(text);

/**
 * The form two names are compared in, so the ways a phone or an IME can write
 * the same name meet:
 * - NFKC folds full-width letters and brackets (（風） → (風)) and half-width
 *   katakana into their ordinary forms;
 * - hiragana becomes katakana, for a name committed before it was converted
 *   (ふりーな → フリーナ);
 * - brackets and spaces go, so 旅人(風) and 旅人風 both reach 旅人（風）.
 */
export function foldName(text: string): string {
	return text
		.normalize('NFKC')
		.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
		.replace(/[()\s]/g, '')
		.toLowerCase();
}

interface Entry {
	id: string;
	notation: string;
	native: string;
	folded: string;
}

/**
 * Every offered name, folded once, in the table's order (which is by id):
 * each character's game name, then the twins'. A twin with an element (空（風）)
 * names that Traveler and twin (`Anemo Aether`); the twin alone (空) names all
 * seven of that twin's elements, so it is a whole name with seven answers.
 */
let entries: Entry[] | null = null;
function allEntries(): Entry[] {
	if (entries) return entries;
	entries = [];
	for (const lang of SUGGEST_FROM) {
		const table = GAME_NAMES[lang];
		if (!table) continue;
		const add = (id: string, notation: string, native: string) =>
			entries!.push({ id, notation, native, folded: foldName(native) });
		for (const [id, native] of Object.entries(table.character)) {
			const notation = getCharacterIndexEntry(id)?.displayName;
			if (notation) add(id, notation, native);
		}
		for (const twin of ['aether', 'lumine'] as const) {
			const twinName = table.twin?.[twin];
			if (!twinName) continue;
			for (const id of Object.keys(table.character)) {
				const t = getCharacterIndexEntry(id);
				if (!t || !id.startsWith('traveler_')) continue;
				const notation = travelerName(t.displayName, twin);
				const el = t.element && table.element?.[t.element];
				if (el) add(id, notation, `${twinName}（${el}）`);
				add(id, notation, twinName);
			}
		}
	}
	return entries;
}

/**
 * The notation names a typed word could mean: the whole name first, then the
 * names it starts (at `MIN_PREFIX` letters or more), each notation name once.
 * A word inside a name but not at its start offers nothing (桃 is not 胡桃).
 *
 * Names that start other names are why the whole name comes first: リネ is
 * Lyney and starts リネット, Lynette, so both are offered with Lyney on top.
 * 旅人 starts every Traveler, so it offers all seven; 空 is a twin's whole
 * name, and offers that twin's seven.
 */
export function suggestNotationNames(query: string): NameSuggestion[] {
	const q = foldName(query);
	if (!q || !isForeignName(query)) return [];
	const exact: NameSuggestion[] = [];
	const prefix: NameSuggestion[] = [];
	const seen = new Set<string>();
	// Whole names first, over every entry, so a prefix entry can't claim a
	// notation name a whole one also gives (空 is whole for Anemo Aether, and
	// the start of 空（風）).
	for (const whole of [true, false])
		for (const e of allEntries()) {
			const hit = whole
				? e.folded === q
				: q.length >= MIN_PREFIX && e.folded.startsWith(q) && e.folded !== q;
			if (!hit || seen.has(e.notation)) continue;
			seen.add(e.notation);
			(whole ? exact : prefix).push({
				id: e.id,
				notation: e.notation,
				native: e.native,
				exact: whole
			});
		}
	return [...exact, ...prefix];
}

/**
 * The one notation name a whole word means, or null when it means none or
 * several (空 alone is seven Travelers). What a bulk replace may act on.
 */
export function wholeNotationName(word: string): NameSuggestion | null {
	const found = suggestNotationNames(word).filter((s) => s.exact);
	return found.length === 1 ? found[0] : null;
}

export interface HeadReplacement {
	from: number;
	to: number;
	native: string;
	notation: string;
}

/**
 * Every segment head in `doc` that is a whole game name with one notation
 * name, and what it becomes. A segment starts the text or follows `>`; its
 * head is its first word. Anything else (a prefix, an ambiguous twin, a word
 * that is not a name) is left for the squiggle to mark.
 */
export function foreignHeads(doc: string): HeadReplacement[] {
	const out: HeadReplacement[] = [];
	const re = /(^|>)(\s*)([^\s>]+)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(doc)) !== null) {
		const word = m[3];
		if (!isForeignName(word)) continue;
		const hit = wholeNotationName(word);
		if (!hit) continue;
		const from = m.index + m[1].length + m[2].length;
		out.push({ from, to: from + word.length, native: word, notation: hit.notation });
	}
	return out;
}

/**
 * The word the composer would complete at `pos`: the first word of the
 * segment the caret is in (a segment starts after `>`), when the caret is
 * still inside it. Null past the first word, where no name goes.
 */
export function segmentHeadAt(doc: string, pos: number): { from: number; text: string } | null {
	const before = doc.slice(0, pos);
	const afterSep = before.slice(before.lastIndexOf('>') + 1);
	const text = afterSep.trimStart();
	if (/\s/.test(text)) return null;
	return { from: pos - text.length, text };
}

/**
 * Whether a key belongs to an input method rather than to the composer. While
 * a Japanese player composes, Enter (and on some keyboards Tab) picks the
 * IME's conversion; it must never also accept a suggestion. Browsers mark
 * such a key with `isComposing`, or with keyCode 229 where they don't, and
 * Safari can send the confirming Enter just after `compositionend`, which is
 * what `msSinceCompositionEnd` catches.
 */
export function isImeKey(
	event: { isComposing?: boolean; keyCode?: number },
	composing: boolean,
	msSinceCompositionEnd: number
): boolean {
	return (
		composing ||
		!!event.isComposing ||
		event.keyCode === 229 ||
		msSinceCompositionEnd < IME_KEY_GRACE_MS
	);
}

/** How long after `compositionend` a confirming key still counts as the IME's
 *  (CodeMirror's own allowance for Safari is 100ms). */
export const IME_KEY_GRACE_MS = 100;
