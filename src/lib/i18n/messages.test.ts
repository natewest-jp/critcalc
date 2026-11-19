/**
 * The message files and what Paraglide compiled from them.
 *
 * ⚠️ `paraglide-js compile` reports success even when the message-format
 * plugin fails to load, and then compiles no messages at all. The first test
 * here is what notices.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { m } from '$lib/paraglide/messages';
import { baseLocale, locales } from '$lib/paraglide/runtime';

const DIR = join(__dirname, '..', '..', '..', 'messages');
const load = (locale: string): Record<string, string> => {
	const { $schema: _, ...messages } = JSON.parse(readFileSync(join(DIR, `${locale}.json`), 'utf8'));
	return messages;
};
const en = load(baseLocale);
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((p) => p[1]).sort();

describe('messages', () => {
	it('compiles every English message', () => {
		const call = m as unknown as Record<string, (p?: object) => string>;
		const missing = Object.keys(en).filter((k) => typeof call[k] !== 'function');
		expect(missing).toEqual([]);
		for (const [k, text] of Object.entries(en))
			if (!placeholders(text).length) expect(call[k](), k).toBe(text);
	});

	it('has a file for every locale and no file for any other', () => {
		const files = readdirSync(DIR)
			.filter((f) => f.endsWith('.json'))
			.map((f) => f.replace(/\.json$/, ''))
			.sort();
		expect(files).toEqual([...locales].sort());
	});

	for (const locale of locales.filter((l) => l !== baseLocale)) {
		it(`${locale}: translates only English keys, with the same placeholders`, () => {
			const messages = load(locale);
			expect(Object.keys(messages).filter((k) => !(k in en))).toEqual([]);
			const drift = Object.entries(messages).filter(
				([k, text]) => placeholders(text).join() !== placeholders(en[k]).join()
			);
			expect(drift.map(([k]) => k)).toEqual([]);
		});
	}
});
