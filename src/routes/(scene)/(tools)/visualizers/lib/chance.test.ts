import { describe, expect, it } from 'vitest';
import { formatChance } from './chance';

describe('formatChance', () => {
	it('one decimal in the middle', () => {
		expect(formatChance(0.634712)).toBe('63.5%');
		expect(formatChance(0.5)).toBe('50.0%');
		expect(formatChance(0.01)).toBe('1.0%');
	});

	it('three significant figures under 1%', () => {
		expect(formatChance(0.00423)).toBe('0.423%');
		expect(formatChance(0.0000423)).toBe('0.00423%');
		expect(formatChance(0.000001234)).toBe('0.000123%');
	});

	it('over 99%, enough decimals to show what is left', () => {
		expect(formatChance(0.99)).toBe('99.0%');
		expect(formatChance(0.995)).toBe('99.5%');
		expect(formatChance(0.99958)).toBe('99.958%');
		expect(formatChance(0.9999577)).toBe('99.9958%');
	});

	it('never prints a certainty or a zero the model doesn’t have', () => {
		expect(formatChance(1 - 1e-12)).toBe('>99.9999%');
		expect(formatChance(0.99999996)).toBe('>99.9999%');
		expect(formatChance(1e-12)).toBe('<0.0001%');
	});

	it('exact ends print as they are', () => {
		expect(formatChance(0)).toBe('0%');
		expect(formatChance(1)).toBe('100%');
		expect(formatChance(Number.NaN)).toBe('0%');
	});
});
