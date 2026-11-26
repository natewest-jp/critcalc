import { describe, expect, it } from 'vitest';
import { nonAsciiText } from './exportFonts';

describe('nonAsciiText', () => {
	it('collects each non-ASCII character once, from strings at any depth', () => {
		const snap = {
			tabLabel: '雷神国家队',
			slots: [{ bench: { name: '雷电将军' } }, { bench: { name: '班尼特' } }],
			notation: 'Raiden E > Bennett Q'
		};
		const text = nonAsciiText(snap);
		expect([...text].sort()).toEqual([...new Set('雷神国家队电将军班尼特')].sort());
	});

	it('reads Map values and skips functions and cycles', () => {
		const snap: Record<string, unknown> = {
			labels: new Map([['a', 'ガード']]),
			iconFor: () => '無視'
		};
		snap.self = snap;
		expect([...nonAsciiText(snap)].sort()).toEqual([...'ガード'].sort());
	});

	it('returns nothing for an all-English snapshot', () => {
		expect(nonAsciiText({ a: 'Nicole E > Durin EQE', b: [1, 2, 'x'] })).toBe('');
	});
});
