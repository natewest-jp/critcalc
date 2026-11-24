/**
 * The message files and what Paraglide compiled from them.
 *
 * A message is a string, or a list holding one variant set (inlang message
 * format) when it chooses by a plural or another selector:
 * `[{ declarations: ['input count', 'local n = count: plural'], selectors: ['n'],
 * match: { 'n=one': '…', 'n=other': '…' } }]`.
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

type Variants = { declarations?: string[]; selectors?: string[]; match: Record<string, string> };
type Message = string | Variants[];

const DIR = join(__dirname, '..', '..', '..', 'messages');
const load = (locale: string): Record<string, Message> => {
	const { $schema: _, ...messages } = JSON.parse(readFileSync(join(DIR, `${locale}.json`), 'utf8'));
	return messages;
};
const en = load(baseLocale);

/** Every text a message can render. */
const texts = (msg: Message): string[] =>
	typeof msg === 'string' ? [msg] : msg.flatMap((v) => Object.values(v.match));
/** The inputs a caller passes: placeholders in the text, and declared inputs. */
const inputs = (msg: Message): string => {
	const names = new Set(
		texts(msg).flatMap((t) => [...t.matchAll(/(?<!\\)\{(\w+)\}/g)].map((p) => p[1]))
	);
	if (typeof msg !== 'string') {
		const locals = new Set<string>();
		for (const v of msg)
			for (const d of v.declarations ?? []) {
				const [kind, name] = d.split(/\s+/);
				if (kind === 'input') names.add(name);
				if (kind === 'local') locals.add(name);
			}
		for (const l of locals) names.delete(l);
	}
	return [...names].sort().join();
};
/** The markup a message opens (`{#value}…{/value}`, rendered by `Msg.svelte`):
 *  a translation moves the tags, and keeps every one. */
const markup = (msg: Message): string =>
	[...new Set(texts(msg).flatMap((t) => [...t.matchAll(/\{#(\w+)\}/g)].map((p) => p[1])))]
		.sort()
		.join();

/**
 * The locales whose draft is whole, so a new English message lands with its
 * line there too: otherwise a page in that language shows it in English (a new
 * What's new entry, a new button). Chinese joins once its draft is whole.
 */
const COMPLETE: string[] = ['ja'];

/**
 * Forms a locale's term list rules out (`docs/text/terms-<locale>.md`), the
 * way the English termbase's `avoid` lists do for English. A form is matched in
 * every text a message can render.
 */
const AVOID: Record<string, { form: RegExp; why: string }[]> = {
	ja: [
		{ form: /凸/, why: 'entry 88: constellations are C0–C6, never 凸' },
		{
			form: /(?<![A-Za-z])CD(?![A-Za-z])/,
			why: 'entry 28: cooldown is クールタイム (CT in dense labels), never CD'
		}
	]
};

/** A literal brace or backslash is escaped in the text: `\{8s\}` renders `{8s}`. */
const unescape = (text: string): string => text.replace(/\\([{}\\])/g, '$1');

describe('messages', () => {
	it('compiles every English message', () => {
		const call = m as unknown as Record<string, (p?: object) => string>;
		const missing = Object.keys(en).filter((k) => typeof call[k] !== 'function');
		expect(missing).toEqual([]);
		for (const [k, msg] of Object.entries(en))
			if (typeof msg === 'string' && !inputs(msg))
				expect(call[k](), k).toBe(unescape(msg.replace(/\{[#/]\w+\}/g, '')));
	});

	it('has a file for every locale and no file for any other', () => {
		const files = readdirSync(DIR)
			.filter((f) => f.endsWith('.json'))
			.map((f) => f.replace(/\.json$/, ''))
			.sort();
		expect(files).toEqual([...locales].sort());
	});

	for (const locale of locales.filter((l) => l !== baseLocale)) {
		it(`${locale}: translates only English keys, with the same inputs and markup`, () => {
			const messages = load(locale);
			expect(Object.keys(messages).filter((k) => !(k in en))).toEqual([]);
			const drift = Object.entries(messages).filter(([k, msg]) => inputs(msg) !== inputs(en[k]));
			expect(drift.map(([k]) => k)).toEqual([]);
			const tags = Object.entries(messages).filter(([k, msg]) => markup(msg) !== markup(en[k]));
			expect(tags.map(([k]) => k)).toEqual([]);
		});
	}

	for (const locale of COMPLETE)
		it(`${locale}: has a line for every English message`, () => {
			const messages = load(locale);
			expect(Object.keys(en).filter((k) => !(k in messages))).toEqual([]);
		});

	for (const [locale, rules] of Object.entries(AVOID))
		it(`${locale}: uses none of the forms its term list rules out`, () => {
			const hits = Object.entries(load(locale)).flatMap(([k, msg]) =>
				rules.filter((r) => texts(msg).some((t) => r.form.test(t))).map((r) => `${k}: ${r.why}`)
			);
			expect(hits).toEqual([]);
		});
});
