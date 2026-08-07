import { describe, it, expect } from 'vitest';
import { copyName } from './documentBar.svelte';

// The fork-naming rule. Split out of saveAsNew() precisely because it was
// wrong: forking a fork produced "Vape Hu Tao copy copy" (the suffix stacked
// instead of numbering), which a browser probe caught and no unit test could
// have, because the logic wasn't reachable.
describe('copyName', () => {
	it('appends " copy" when the name is free', () => {
		expect(copyName('Vape Hu Tao', [])).toBe('Vape Hu Tao copy');
	});

	it('numbers from 2 when the plain copy is taken', () => {
		expect(copyName('Vape Hu Tao', ['Vape Hu Tao', 'Vape Hu Tao copy'])).toBe('Vape Hu Tao copy 2');
	});

	it('NUMBERS a fork of a fork rather than stacking the suffix', () => {
		const bank = ['Vape Hu Tao', 'Vape Hu Tao copy'];
		expect(copyName('Vape Hu Tao copy', bank)).toBe('Vape Hu Tao copy 2');
		expect(copyName('Vape Hu Tao copy 2', [...bank, 'Vape Hu Tao copy 2'])).toBe(
			'Vape Hu Tao copy 3'
		);
	});

	it('skips gaps rather than reusing a taken number', () => {
		expect(copyName('Aggravate', ['Aggravate copy', 'Aggravate copy 2', 'Aggravate copy 4'])).toBe(
			'Aggravate copy 3'
		);
	});

	it('leaves a name that merely CONTAINS "copy" alone', () => {
		expect(copyName('copy that rotation', [])).toBe('copy that rotation copy');
	});
});
