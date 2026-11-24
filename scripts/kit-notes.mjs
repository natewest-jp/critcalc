/**
 * scripts/kit-notes.mjs
 *
 * Keeps a locale's kit notes (src/lib/data/kitNotes/{locale}.json) in step
 * with the English in the character data. Each line carries a fingerprint of
 * the English it translates, so `kitNotes.test.ts` fails when the English
 * moves and the translation hasn't.
 *
 *   node scripts/kit-notes.mjs todo ja > draft.json
 *       every note with no line, or a stale one: { character: { entry:
 *       { caveat?, reason? } } } in English, to translate in place
 *   node scripts/kit-notes.mjs merge ja draft.json
 *       writes the translated draft into the locale's file, each line
 *       stamped with the fingerprint of the English as it is now
 *
 * Curation keeps writing English in the character data. A draft follows
 * `docs/text/terms-ja.md` for Japanese.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kitNoteHash, kitNotesOf } from '../src/lib/data/kitNoteHash.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARACTERS = join(ROOT, 'src/lib/data/characters');
const [command, locale, draftPath] = process.argv.slice(2);
if (!['todo', 'merge'].includes(command) || !locale) {
	console.error('usage: node scripts/kit-notes.mjs todo <locale> | merge <locale> <draft.json>');
	process.exit(1);
}
const FILE = join(ROOT, 'src/lib/data/kitNotes', `${locale}.json`);

const corpus = {};
for (const f of (await readdir(CHARACTERS)).filter((f) => f.endsWith('.json')).sort()) {
	const c = JSON.parse(await readFile(join(CHARACTERS, f), 'utf8'));
	const notes = kitNotesOf(c);
	if (Object.keys(notes).length) corpus[c.id] = notes;
}
const table = JSON.parse(await readFile(FILE, 'utf8'));

if (command === 'todo') {
	const todo = {};
	for (const [id, entries] of Object.entries(corpus))
		for (const [entry, fields] of Object.entries(entries))
			for (const [field, english] of Object.entries(fields)) {
				const line = table[id]?.[entry]?.[field];
				if (line?.en === kitNoteHash(english)) continue;
				((todo[id] ??= {})[entry] ??= {})[field] = english;
			}
	console.log(JSON.stringify(todo, null, '\t'));
} else {
	const draft = JSON.parse(await readFile(draftPath, 'utf8'));
	let n = 0;
	for (const [id, entries] of Object.entries(draft))
		for (const [entry, fields] of Object.entries(entries))
			for (const [field, text] of Object.entries(fields)) {
				const english = corpus[id]?.[entry]?.[field];
				if (!english) throw new Error(`${id} ${entry} ${field}: no such note in the data`);
				((table[id] ??= {})[entry] ??= {})[field] = { en: kitNoteHash(english), text };
				n++;
			}
	// Sorted, so a diff shows only what moved.
	const sorted = Object.fromEntries(
		Object.keys(table)
			.sort()
			.map((id) => [
				id,
				Object.fromEntries(
					Object.keys(table[id])
						.sort()
						.map((e) => [e, table[id][e]])
				)
			])
	);
	await writeFile(FILE, JSON.stringify(sorted, null, '\t') + '\n');
	console.log(`merged ${n} lines into ${FILE}`);
}
