import { describe, it, expect } from 'vitest';
import { halfWidthChanges, halfWidthNotation } from './notationWidth';
import { tokenizeNotation } from './tokenizer';

describe('halfWidthNotation', () => {
	it('makes a line typed in Japanese input plain notation', () => {
		expect(halfWidthNotation('Ｂｅｎｎｅｔｔ　Ｅ　Ｑ　＞　Ｘｉａｎｇｌｉｎｇ　Ｑ')).toBe(
			'Bennett E Q > Xiangling Q'
		);
		expect(halfWidthNotation('Ｎ１～２ｓ')).toBe('N1~2s');
		expect(halfWidthNotation('Ｎ１〜２ｓ')).toBe('N1~2s');
		expect(halfWidthNotation('｛ｓｔａｃｋｓ：３｝')).toBe('{stacks:3}');
		expect(halfWidthNotation('３「Ｃ」')).toBe('3[C]');
		expect(halfWidthNotation('（Ｎ１）')).toBe('(N1)');
		expect(halfWidthNotation('～？ｓ')).toBe('~?s');
	});

	it('reads 。 ー ・ as notation only between letters or digits', () => {
		expect(halfWidthNotation('~1。5s')).toBe('~1.5s');
		expect(halfWidthNotation('1ー3[N]')).toBe('1-3[N]');
		expect(halfWidthNotation('E・Q')).toBe('E/Q');
		expect(halfWidthNotation('フリーナ')).toBe('フリーナ');
		expect(halfWidthNotation('終わり。')).toBe('終わり。');
	});

	it('leaves Japanese names alone, brackets included', () => {
		for (const name of ['胡桃', '雷電将軍', 'フリーナ', '旅人（風）', '空（雷）', 'ヨォーヨ'])
			expect(halfWidthNotation(name)).toBe(name);
		expect(halfWidthNotation('旅人（風）　Ｅ')).toBe('旅人（風） E');
		// So the tokenizer still reads the whole name as one head.
		expect(tokenizeNotation(halfWidthNotation('旅人（風）　Ｅ'))[0].text).toBe('旅人（風）');
	});

	it('folds a bracket pair only once it is closed', () => {
		expect(halfWidthNotation('E（N1')).toBe('E（N1');
		expect(halfWidthNotation('E（N1）')).toBe('E(N1)');
		expect(halfWidthNotation('旅人（')).toBe('旅人（');
		expect(halfWidthNotation('旅人（風')).toBe('旅人（風');
	});

	it('keeps the length, so a caret never moves', () => {
		const s = 'Ｈｕ　Ｔａｏ　Ｅ　＞　旅人（風）　Ｑ　～１。５ｓ';
		expect(halfWidthNotation(s)).toHaveLength(s.length);
	});

	it('does not touch 、 or →', () => {
		expect(halfWidthNotation('E、Q→N1')).toBe('E、Q→N1');
	});

	it('is a no-op on notation', () => {
		const s = 'Hu Tao E N2C ~1.5s > Zhongli hE';
		expect(halfWidthNotation(s)).toBe(s);
		expect(halfWidthChanges(s)).toEqual([]);
	});
});

describe('halfWidthChanges', () => {
	it('names only the characters that change', () => {
		expect(halfWidthChanges('胡桃　Ｅ')).toEqual([
			{ from: 2, to: 3, insert: ' ' },
			{ from: 3, to: 4, insert: 'E' }
		]);
	});
});
