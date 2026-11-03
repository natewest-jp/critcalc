import { describe, expect, it } from 'vitest';
import { matchName, matchValue, type FieldOption } from './statEntry';

const values = (labels: string[]): FieldOption[] => labels.map((l) => ({ value: l, label: l }));
const CR = values(['2.7', '3.1', '3.5', '3.9', '5.4', '5.8', '6.2', '6.6', '7.0', '21.0', '21.4']);

describe('matchValue', () => {
	it('lists every value the text starts', () => {
		const m = matchValue('6', CR);
		expect(m.options.map((o) => o.label)).toEqual(['6.2', '6.6']);
		expect(m.exact).toBeNull();
	});

	it('is exact only for the same number', () => {
		expect(matchValue('6.6', CR).exact?.label).toBe('6.6');
		expect(matchValue('21', CR).exact?.label).toBe('21.0');
		expect(matchValue('7', CR).exact?.label).toBe('7.0');
		expect(matchValue('6,6', CR).exact?.label).toBe('6.6');
	});

	it('never takes a value the game cannot show', () => {
		const m = matchValue('6.5', CR);
		expect(m.exact).toBeNull();
		expect(m.nearest).toBe(true);
		expect(m.options.map((o) => o.label)).toEqual(['6.2', '6.6']);
	});

	it('past either end offers the one value on that side', () => {
		expect(matchValue('1', CR).options.map((o) => o.label)).toEqual(['2.7']);
		expect(matchValue('99', CR).options.map((o) => o.label)).toEqual(['21.4']);
	});

	it('matches nothing for text that is not a number', () => {
		expect(matchValue('abc', CR)).toEqual({ options: [], exact: null, nearest: false });
	});

	it('lists everything for empty text', () => {
		expect(matchValue('  ', CR).options).toHaveLength(CR.length);
	});
});

describe('matchName', () => {
	const NAMES: FieldOption[] = [
		{ value: '', label: 'None' },
		{ value: 'atk', label: 'ATK', terms: ['flat atk'] },
		{ value: 'atkPct', label: 'ATK%', terms: ['atk%'] },
		{ value: 'er', label: 'Energy Recharge', terms: ['er', 'recharge'] },
		{ value: 'cr', label: 'CRIT Rate', terms: ['cr'] },
		{ value: 'cd', label: 'CRIT DMG', terms: ['cd', 'crit damage'] }
	];

	it('takes the short names players type', () => {
		expect(matchName('cd', NAMES).exact?.value).toBe('cd');
		expect(matchName('ER', NAMES).exact?.value).toBe('er');
	});

	it('matches a word inside the name', () => {
		expect(matchName('dmg', NAMES).exact?.value).toBe('cd');
		expect(matchName('crit', NAMES).options.map((o) => o.value)).toEqual(['cr', 'cd']);
		expect(matchName('crit', NAMES).exact).toBeNull();
	});

	it('prefers the exact name over a longer one it starts', () => {
		const m = matchName('atk', NAMES);
		expect(m.options.map((o) => o.value)).toEqual(['atk', 'atkPct']);
		expect(m.exact?.value).toBe('atk');
	});

	it('is exact when only one name is left', () => {
		expect(matchName('ener', NAMES).exact?.value).toBe('er');
	});

	it('never matches the clearing row by typing', () => {
		expect(matchName('no', NAMES).options).toEqual([]);
	});
});
