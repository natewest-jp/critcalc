import { describe, it, expect } from 'vitest';
import { GAME_NAMES } from '$lib/data/gameNames.generated';
import { overwriteGetLocale } from '$lib/paraglide/runtime';
import {
	IME_KEY_GRACE_MS,
	SUGGEST_FROM,
	foldName,
	isImeKey,
	segmentHeadAt,
	suggestNotationNames
} from './notationNames';

const names = (q: string) => suggestNotationNames(q).map((s) => s.notation);

describe('suggestNotationNames', () => {
	it('turns a whole Japanese name into its notation name', () => {
		expect(names('胡桃')).toEqual(['Hu Tao']);
		expect(names('フリーナ')).toEqual(['Furina']);
		expect(names('雷電将軍')).toEqual(['Raiden']);
	});

	it('takes a one-letter name whole, but not as a prefix', () => {
		expect(names('魈')).toEqual(['Xiao']);
		expect(names('リ')).toEqual([]);
	});

	it('offers the names a prefix starts', () => {
		expect(names('フリ')).toEqual(expect.arrayContaining(['Furina', 'Flins']));
		expect(names('雷電')).toEqual(['Raiden']);
	});

	it('puts the whole name first when it starts a longer one', () => {
		// リネ is Lyney and the start of リネット, Lynette.
		expect(names('リネ')).toEqual(['Lyney', 'Lynette']);
		expect(names('リネット')).toEqual(['Lynette']);
	});

	it('does not match inside a name', () => {
		expect(names('桃')).toEqual([]);
		expect(names('将軍')).toEqual([]);
	});

	it('offers every Traveler for 旅人, and one for each element', () => {
		const all = names('旅人');
		expect(all).toHaveLength(7);
		expect(all.every((n) => n.endsWith(' Traveler'))).toBe(true);
		expect(names('旅人（風）')).toEqual(['Anemo Traveler']);
		// Half-width brackets, or none, from a keyboard without the full-width ones.
		expect(names('旅人(風)')).toEqual(['Anemo Traveler']);
		expect(names('旅人風')).toEqual(['Anemo Traveler']);
	});

	it('reads hiragana and half-width katakana as the katakana name', () => {
		expect(names('ふりーな')).toEqual(['Furina']);
		expect(names('ﾌﾘｰﾅ')).toEqual(['Furina']);
	});

	it('offers nothing for notation itself', () => {
		expect(names('Hu')).toEqual([]);
		expect(names('Furina')).toEqual([]);
		expect(names('')).toEqual([]);
	});

	it('is the same on every page, whatever its language', () => {
		overwriteGetLocale(() => 'en');
		expect(names('胡桃')).toEqual(['Hu Tao']);
		overwriteGetLocale(() => 'ja');
		expect(names('胡桃')).toEqual(['Hu Tao']);
	});

	it('names each character once in the offered languages, and every one has a notation name', () => {
		const owner = new Map<string, string>();
		for (const lang of SUGGEST_FROM)
			for (const [id, native] of Object.entries(GAME_NAMES[lang].character)) {
				const key = foldName(native);
				// One folded name, one character: otherwise a word would suggest two.
				expect(owner.get(key) ?? id, `${native} names two characters`).toBe(id);
				owner.set(key, id);
				expect(suggestNotationNames(native)[0]?.id).toBe(id);
			}
	});
});

describe('segmentHeadAt', () => {
	it('finds the first word of the caret segment', () => {
		expect(segmentHeadAt('胡桃', 2)).toEqual({ from: 0, text: '胡桃' });
		expect(segmentHeadAt('Hu Tao E > フリ', 13)).toEqual({ from: 11, text: 'フリ' });
	});

	it('is null past the first word', () => {
		expect(segmentHeadAt('胡桃 E', 4)).toBeNull();
		// An ideographic space ends the word too.
		expect(segmentHeadAt('胡桃　E', 4)).toBeNull();
	});
});

describe('isImeKey', () => {
	const long = IME_KEY_GRACE_MS * 10;

	it('belongs to the IME while it composes', () => {
		expect(isImeKey({}, true, long)).toBe(true);
		expect(isImeKey({ isComposing: true }, false, long)).toBe(true);
		expect(isImeKey({ keyCode: 229 }, false, long)).toBe(true);
	});

	it('belongs to the IME just after the composition ends (Safari sends Enter late)', () => {
		expect(isImeKey({ keyCode: 13 }, false, 10)).toBe(true);
	});

	it('is the composer’s once the composition is over', () => {
		expect(isImeKey({ isComposing: false, keyCode: 13 }, false, long)).toBe(false);
	});
});
