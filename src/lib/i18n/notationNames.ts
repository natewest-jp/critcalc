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
import { getCharacterIndexEntry } from '$lib/data/characterLookup';

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
	native: string;
	folded: string;
}

/** Every offered name, folded once, in the table's order (which is by id). */
let entries: Entry[] | null = null;
function allEntries(): Entry[] {
	if (entries) return entries;
	entries = [];
	for (const lang of SUGGEST_FROM)
		for (const [id, native] of Object.entries(GAME_NAMES[lang]?.character ?? {}))
			entries.push({ id, native, folded: foldName(native) });
	return entries;
}

/**
 * The notation names a typed word could mean: the whole name first, then the
 * names it starts (at `MIN_PREFIX` letters or more), each character once.
 * A word inside a name but not at its start offers nothing (桃 is not 胡桃).
 *
 * Names that start other names are why the whole name comes first: リネ is
 * Lyney and starts リネット, Lynette, so both are offered with Lyney on top.
 * 旅人 starts every Traveler, so it offers all seven.
 */
export function suggestNotationNames(query: string): NameSuggestion[] {
	const q = foldName(query);
	if (!q || !isForeignName(query)) return [];
	const exact: NameSuggestion[] = [];
	const prefix: NameSuggestion[] = [];
	const seen = new Set<string>();
	for (const e of allEntries()) {
		const whole = e.folded === q;
		if (!whole && !(q.length >= MIN_PREFIX && e.folded.startsWith(q))) continue;
		if (seen.has(e.id)) continue;
		const notation = getCharacterIndexEntry(e.id)?.displayName;
		if (!notation) continue;
		seen.add(e.id);
		(whole ? exact : prefix).push({ id: e.id, notation, native: e.native, exact: whole });
	}
	return [...exact, ...prefix];
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
