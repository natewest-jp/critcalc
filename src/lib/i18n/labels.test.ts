import { describe, expect, it } from 'vitest';
import { labels } from './labels';

describe('labels', () => {
	it('reads each message when the label is read, not when the table is built', () => {
		let word = 'before';
		const table = labels({ a: () => word });
		word = 'after';
		expect(table.a).toBe('after');
		expect(Object.keys(table)).toEqual(['a']);
	});
});
