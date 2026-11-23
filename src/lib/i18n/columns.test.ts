import { describe, expect, it } from 'vitest';
import { columns } from './columns';

describe('columns', () => {
	it('counts Latin text as its length', () => {
		expect(columns('New team')).toBe('New team'.length);
	});

	it('counts kana, kanji, and fullwidth forms as two each', () => {
		expect(columns('新しいチーム')).toBe(12);
		expect(columns('チーム（1）')).toBe(11);
	});

	it('mixes the two', () => {
		expect(columns('Ver.7.2 幽境')).toBe(12);
	});
});
