import { describe, it, expect, afterAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { kitNoteHash, kitNotesOf } from '$lib/data/kitNoteHash';
import { overwriteGetLocale, baseLocale, type Locale } from '$lib/paraglide/runtime';
import { kitNote, loadKitNotes, type KitNoteTable } from './kitNotes';
import ja from '$lib/data/kitNotes/ja.json';
import { AVOID } from './avoidedForms';

/**
 * Each locale's kit notes stay in step with the English in the character
 * data. A note with no line, or whose English has moved since its line was
 * drafted, fails here: `node scripts/kit-notes.mjs todo <locale>` lists them,
 * and `merge` stamps the redraft.
 */
const DIR = 'src/lib/data/characters';
const corpus = readdirSync(DIR)
	.filter((f) => f.endsWith('.json'))
	.map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));

const TABLES: Record<string, KitNoteTable> = { ja: ja as KitNoteTable };

const as = (locale: Locale) => overwriteGetLocale(() => locale);
afterAll(() => as(baseLocale));

for (const [locale, table] of Object.entries(TABLES)) {
	describe(`${locale}: kit notes`, () => {
		it('translate every note, from the English as it is now', () => {
			const todo: string[] = [];
			for (const c of corpus)
				for (const [entry, fields] of Object.entries(kitNotesOf(c)))
					for (const [field, english] of Object.entries(fields)) {
						const line = table[c.id]?.[entry]?.[field as 'caveat' | 'reason'];
						if (!line) todo.push(`${c.id} ${entry} ${field}: missing`);
						else if (line.en !== kitNoteHash(english))
							todo.push(`${c.id} ${entry} ${field}: the English moved`);
					}
			expect(todo).toEqual([]);
		});

		it('use none of the forms the term list rules out', () => {
			const hits: string[] = [];
			for (const [id, entries] of Object.entries(table))
				for (const [entry, fields] of Object.entries(entries))
					for (const [field, line] of Object.entries(fields))
						for (const r of AVOID[locale] ?? [])
							if (r.form.test(line.text)) hits.push(`${id} ${entry} ${field}: ${r.why}`);
			expect(hits).toEqual([]);
		});

		it('carry no line for a note the data no longer has', () => {
			const notes = Object.fromEntries(corpus.map((c) => [c.id, kitNotesOf(c)]));
			const orphans: string[] = [];
			for (const [id, entries] of Object.entries(table))
				for (const [entry, fields] of Object.entries(entries))
					for (const field of Object.keys(fields))
						if (!notes[id]?.[entry]?.[field as 'caveat' | 'reason'])
							orphans.push(`${id} ${entry} ${field}`);
			expect(orphans).toEqual([]);
		});
	});
}

describe('kitNote', () => {
	const c = corpus.find((x) => Object.keys(kitNotesOf(x)).length)!;
	const [entry, fields] = Object.entries(kitNotesOf(c))[0];
	const field = Object.keys(fields)[0] as 'caveat' | 'reason';
	const english = fields[field]!;

	it('keeps English in English', () => {
		as(baseLocale);
		expect(kitNote(c.id, entry, field, english)).toBe(english);
	});

	it("shows the locale's line in Japanese", async () => {
		as('ja');
		await loadKitNotes('ja');
		expect(kitNote(c.id, entry, field, english)).toBe(TABLES.ja[c.id]?.[entry]?.[field]?.text);
		as(baseLocale);
	});
});
