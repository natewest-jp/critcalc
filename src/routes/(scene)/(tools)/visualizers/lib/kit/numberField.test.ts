import { describe, expect, it } from 'vitest';
import { decimalsOf, fieldChars, formatField, parseField } from './numberField';

describe('decimalsOf', () => {
	it('reads the decimals a step implies', () => {
		expect(decimalsOf(1)).toBe(0);
		expect(decimalsOf(5)).toBe(0);
		expect(decimalsOf(0.5)).toBe(1);
		expect(decimalsOf(0.1)).toBe(1);
		expect(decimalsOf(0.05)).toBe(2);
		expect(decimalsOf(0.005)).toBe(3);
		expect(decimalsOf(1e-7)).toBe(7);
	});

	it('treats a nonsense step as whole numbers', () => {
		expect(decimalsOf(0)).toBe(0);
		expect(decimalsOf(-1)).toBe(0);
		expect(decimalsOf(NaN)).toBe(0);
	});
});

describe('formatField', () => {
	it('drops trailing zeros but keeps a real fraction', () => {
		expect(formatField(55, 1)).toBe('55');
		expect(formatField(55.5, 1)).toBe('55.5');
		expect(formatField(70.00000001, 1)).toBe('70');
		expect(formatField(0.5, 2)).toBe('0.5');
	});

	it('rounds to the decimals it is given', () => {
		expect(formatField(61.66, 1)).toBe('61.7');
		expect(formatField(187.4, 0)).toBe('187');
	});

	it('never groups thousands, so a shown value can be typed back', () => {
		expect(formatField(1260, 0)).toBe('1260');
	});

	it('has no negative zero', () => {
		expect(formatField(-0.04, 1)).toBe('0');
	});

	it('shows nothing for a non-number', () => {
		expect(formatField(NaN, 0)).toBe('');
	});
});

describe('parseField', () => {
	it('reads plain numbers, signs and fractions', () => {
		expect(parseField('70')).toBe(70);
		expect(parseField('-20')).toBe(-20);
		expect(parseField('+5')).toBe(5);
		expect(parseField('.5')).toBe(0.5);
		expect(parseField('12.')).toBe(12);
	});

	it('forgives spaces, thousands commas and a trailing unit', () => {
		expect(parseField(' 70 % ')).toBe(70);
		expect(parseField('1,260')).toBe(1260);
		expect(parseField('0.5s')).toBe(0.5);
		expect(parseField('×1.5')).toBeNull(); // a leading sign that isn't one
	});

	it('reads the words a slider names, in any case', () => {
		const words = { off: 0, none: 0 };
		expect(parseField('Off', words)).toBe(0);
		expect(parseField('NONE', words)).toBe(0);
	});

	it('is null for what is not a number yet', () => {
		expect(parseField('')).toBeNull();
		expect(parseField('-')).toBeNull();
		expect(parseField('abc')).toBeNull();
		expect(parseField('1.2.3')).toBeNull();
	});
});

describe('fieldChars', () => {
	it('fits the longest end of the range', () => {
		expect(fieldChars(0, 1200, 0)).toBe(4);
		expect(fieldChars(-50, 200, 0)).toBe(3);
		expect(fieldChars(-100, 5, 0)).toBe(4);
	});

	it('makes room for the decimals', () => {
		expect(fieldChars(0, 300, 1)).toBe(5);
		expect(fieldChars(0.05, 3, 2)).toBe(4);
	});

	it('makes room for a word the field can show', () => {
		expect(fieldChars(-50, 200, 0, ['Immune'])).toBe(6);
	});
});
