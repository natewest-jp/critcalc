import { describe, it, expect } from 'vitest';
import { splitEmphasis } from './Emphasis.svelte';

/**
 * The `**bold**` splitter behind user-facing copy.
 *
 * ⚠️ It exists INSTEAD of `{@html}`, so its job is to be the boring option: it
 * must never produce anything but plain text segments, and a malformed marker
 * must degrade to literal text rather than eating the rest of the string.
 */
describe('splitEmphasis', () => {
	it('splits a marked run out of its surroundings', () => {
		expect(splitEmphasis('drains from **both** gauges')).toEqual([
			{ text: 'drains from ', strong: false },
			{ text: 'both', strong: true },
			{ text: ' gauges', strong: false }
		]);
	});

	it('handles a string with no markers at all', () => {
		expect(splitEmphasis('plain copy')).toEqual([{ text: 'plain copy', strong: false }]);
	});

	it('handles several marked runs', () => {
		const out = splitEmphasis('**one** and **two**');
		expect(out.filter((s) => s.strong).map((s) => s.text)).toEqual(['one', 'two']);
	});

	// ⚠ A typo should LOOK like a typo, not silently bold everything after it.
	it('leaves an unclosed marker as literal text', () => {
		expect(splitEmphasis('an **unclosed run')).toEqual([
			{ text: 'an **unclosed run', strong: false }
		]);
	});

	// ⛔ Not a markdown renderer: anything else passes through untouched, which
	// is what keeps this safe to point at copy without escaping it.
	it('does not interpret any other markup', () => {
		const source = '<b>html</b> _under_ *single* [link](x)';
		expect(splitEmphasis(source)).toEqual([{ text: source, strong: false }]);
	});

	it('never emits an empty segment', () => {
		expect(splitEmphasis('**lead** trail').every((s) => s.text.length > 0)).toBe(true);
		expect(splitEmphasis('lead **trail**').every((s) => s.text.length > 0)).toBe(true);
	});
});
