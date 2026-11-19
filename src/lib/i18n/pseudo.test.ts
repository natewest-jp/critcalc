import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pseudo, pseudoFile } from './pseudo';

const DIR = join(__dirname, '..', '..', '..', 'messages');
const read = (f: string) => JSON.parse(readFileSync(join(DIR, f), 'utf8'));

describe('the pseudo-locale', () => {
	it('is current with English (run `node scripts/generate-pseudo-locale.mjs`)', () => {
		expect(read('en-XA.json')).toEqual(pseudoFile(read('en.json')));
	});

	it('accents and pads the text but keeps placeholders and markup', () => {
		const out = pseudo('{#value}{count} saved items{/value} have changed.');
		expect(out).toMatch(/^⟦\{#value\}\{count\} šåṽéð îţéɱš\{\/value\} ĥåṽé çĥåñĝéð\. /);
		expect(out.endsWith('⟧')).toBe(true);
	});

	it('runs about a third longer than English', () => {
		const en = 'This browser may clear your data on its own, for example after a while.';
		const grown = pseudo(en).length - 2;
		expect(grown / en.length).toBeGreaterThanOrEqual(1.35);
		expect(grown / en.length).toBeLessThan(1.5);
	});
});
