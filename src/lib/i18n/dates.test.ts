import { describe, expect, it } from 'vitest';
import { formatDay } from './dates';

describe('formatDay', () => {
	it('writes a day, a month, and a full date in English as the pages did', () => {
		expect(formatDay('2026-11-11', { month: 'long', day: 'numeric' }, 'en')).toBe('November 11');
		expect(formatDay('2026-11-01', { month: 'long', year: 'numeric' }, 'en')).toBe('November 2026');
		expect(formatDay('2026-10-26', { dateStyle: 'long' }, 'en')).toBe('October 26, 2026');
	});

	it('writes them in Japanese', () => {
		expect(formatDay('2026-11-11', { month: 'long', day: 'numeric' }, 'ja')).toBe('11月11日');
		expect(formatDay('2026-11-01', { month: 'long', year: 'numeric' }, 'ja')).toBe('2026年11月');
		expect(formatDay('2026-10-26', { dateStyle: 'long' }, 'ja')).toBe('2026年10月26日');
	});

	it('keeps the first of the month on its own day', () => {
		expect(formatDay('2026-11-01', { month: 'long', day: 'numeric' }, 'en')).toBe('November 1');
	});
});
