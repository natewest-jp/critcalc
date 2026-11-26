import { describe, it, expect } from 'vitest';
import { GAME_NAMES } from '$lib/data/gameNames.generated';
import { overwriteGetLocale } from '$lib/paraglide/runtime';
import { getCharacterIndexEntry } from '$lib/data/characterLookup';
import { ZH_NICKNAMES } from './nicknamesZh';
import {
	IME_KEY_GRACE_MS,
	SUGGEST_FROM,
	foldName,
	headsLanguage,
	isImeKey,
	foreignHeads,
	languagesOf,
	segmentHeadAt,
	suggestNotationNames,
	wholeNotationName
} from './notationNames';

const names = (q: string) => suggestNotationNames(q).map((s) => s.notation);

describe('the twins, 空 and 蛍', () => {
	it('reads a twin with an element as that Traveler and twin', () => {
		expect(names('空（風）')).toEqual(['Anemo Aether']);
		expect(names('空(風)')).toEqual(['Anemo Aether']);
		expect(names('空風')).toEqual(['Anemo Aether']);
		expect(names('蛍（雷）')).toEqual(['Electro Lumine']);
	});

	it('lists a bare twin as that twin’s seven elements', () => {
		const aether = names('空');
		expect(aether).toHaveLength(7);
		expect(aether.every((n) => n.endsWith(' Aether'))).toBe(true);
		const lumine = names('蛍');
		expect(lumine).toHaveLength(7);
		expect(lumine.every((n) => n.endsWith(' Lumine'))).toBe(true);
	});

	it('takes the names from the game data', () => {
		expect(GAME_NAMES.ja.twin).toEqual({ aether: '空', lumine: '蛍' });
	});

	it('offers nothing from a twin inside another word', () => {
		expect(names('空気')).toEqual([]);
		expect(names('蛍光')).toEqual([]);
		expect(names('旅人')).not.toContain('Anemo Aether');
	});

	it('gives a bare twin no single answer, so a bulk replace leaves it', () => {
		expect(wholeNotationName('空')).toBeNull();
		expect(wholeNotationName('空（風）')?.notation).toBe('Anemo Aether');
	});
});

describe('foreignHeads', () => {
	it('finds each segment head that is one whole name', () => {
		const doc = '胡桃 E > 鍾離 hE > Furina E Q > 空（風） E';
		const heads = foreignHeads(doc);
		expect(heads.map((h) => [h.native, h.notation])).toEqual([
			['胡桃', 'Hu Tao'],
			['鍾離', 'Zhongli'],
			['空（風）', 'Anemo Aether']
		]);
		for (const h of heads) expect(doc.slice(h.from, h.to)).toBe(h.native);
	});

	it('leaves prefixes, bare twins, unknown words, and non-heads alone', () => {
		expect(foreignHeads('フリ E > 空 Q > 謎 E > Hu Tao 胡桃')).toEqual([]);
	});

	it('reads heads at the start, after a bare >, and after a line break', () => {
		expect(foreignHeads('胡桃 E>鍾離 E\n> 魈 Q').map((h) => h.notation)).toEqual([
			'Hu Tao',
			'Zhongli',
			'Xiao'
		]);
	});
});

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

describe('Chinese names', () => {
	it('turns a whole Chinese name into its notation name', () => {
		expect(names('那维莱特')).toEqual(['Neuvillette']);
		expect(names('钟离')).toEqual(['Zhongli']);
		expect(names('旅行者（风）')).toEqual(['Anemo Traveler']);
		expect(names('荧（雷）')).toEqual(['Electro Lumine']);
	});

	it('offers the nicknames guides write, after the game names', () => {
		expect(names('雷神')).toEqual(['Raiden']);
		expect(names('仆人')).toEqual(['Arlecchino']);
		expect(names('草主')).toEqual(['Dendro Traveler']);
		// 九条 is a nickname and the start of the game's 九条裟罗: both Kujou Sara.
		expect(names('九条')).toEqual(['Kujou Sara']);
	});

	it('offers both owners of a nickname two characters share, and replaces neither', () => {
		expect(names('火神')).toEqual(['Mavuika', 'Bennett']);
		expect(names('水神')).toEqual(['Furina', 'Xingqiu']);
		expect(foreignHeads('火神 E > 钟离 E').map((h) => h.notation)).toEqual(['Zhongli']);
	});

	it('gives every nickname a character, and lets no one-owner nickname name another', () => {
		for (const nick of ZH_NICKNAMES) {
			for (const id of nick.ids) expect(getCharacterIndexEntry(id), nick.name).not.toBeNull();
			if (nick.ids.length > 1) continue;
			const ids = suggestNotationNames(nick.name)
				.filter((s) => s.exact)
				.map((s) => s.id);
			expect(ids, nick.name).toEqual(nick.ids);
		}
	});

	it('knows which language writes a name', () => {
		expect(languagesOf('胡桃')).toEqual(['ja', 'zh']);
		expect(languagesOf('钟离')).toEqual(['zh']);
		expect(languagesOf('鍾離')).toEqual(['ja']);
	});

	it('words the offer in the language the names are in', () => {
		const heads = (doc: string) => foreignHeads(doc);
		expect(headsLanguage(heads('胡桃 E > 钟离 E'), 'en')).toBe('zh');
		expect(headsLanguage(heads('胡桃 E > 鍾離 E'), 'en')).toBe('ja');
		// Written the same in both: the page's language decides, else Japanese.
		expect(headsLanguage(heads('胡桃 E > 行秋 Q'), 'zh')).toBe('zh');
		expect(headsLanguage(heads('胡桃 E > 行秋 Q'), 'en')).toBe('ja');
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
