/**
 * scripts/audit-character-roles.mjs
 *
 * Diffs the roles CSV (docs/library/game/genshin-character-roles.csv) against
 * the Fandom wiki's Character Role table, which mirrors Genshin's Imaginarium
 * Theater roles. Read-only: it prints review candidates and writes nothing.
 * The CSV stays hand-edited; run `npm run generate-character-roles` after.
 *
 *   node scripts/audit-character-roles.mjs
 *
 * Reports, in order:
 *   new        on the wiki, not in the CSV (printed as CSV lines to paste)
 *   differs    in both, with different roles
 *   amended    differs, but the CSV row is a documented editorial amendment
 *   unrated    on the wiki with no role at all (a character the wiki has
 *              listed before Genshin rated it; wait for the roles)
 *   gone       in the CSV, not on the wiki
 *
 * One request to the MediaWiki API (`action=parse`): the table is a template
 * (`{{Character Roles Table}}`), so the rendered HTML is read, not wikitext.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeName } from '../src/lib/data/parseRolesCsv.ts';
import { USER_AGENT, WIKI_API } from './wiki-capability-config.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = join(PROJECT_ROOT, 'docs/library/game/genshin-character-roles.csv');

// The CSV rows that diverge from Genshin's table on purpose. Their reasons are
// in the generator's header (scripts/generate-character-roles.mjs) and
// docs/curation/capability-sweep.md.
const AMENDED = new Set(['Fischl', 'Rosaria']);

const url = `${WIKI_API}?${new URLSearchParams({
	action: 'parse',
	page: 'Character_Role',
	prop: 'text',
	format: 'json',
	formatversion: '2'
})}`;
const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
const body = await res.json();
if (body.error) throw new Error(`API error: ${body.error.code} — ${body.error.info}`);
const html = body.parse.text;

// The roles table is the one whose header row starts Name, Element.
const head = html.indexOf('<th>Name</th><th>Element</th>');
if (head < 0)
	throw new Error('Character Role: the roles table was not found (page layout changed?)');
const table = html.slice(html.lastIndexOf('<table', head), html.indexOf('</table>', head));

const decode = (s) =>
	s
		.replace(/&#0?39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&');

/** name → "Name,Element,✔,✘,…" in the CSV's own column order. */
const wiki = new Map();
for (const row of table.split('<tr>').slice(2)) {
	const cells = row.split('<td>').slice(1);
	if (cells.length < 7) continue;
	// The name cell is an icon link then a text link; the text link is last.
	const names = [...cells[0].matchAll(/<a [^>]*>([^<]+)<\/a>/g)];
	const elements = [...cells[1].matchAll(/<a [^>]*>([^<]+)<\/a>/g)];
	if (!names.length) continue;
	const name = normalizeName(decode(names.at(-1)[1]));
	const element = elements.length ? decode(elements.at(-1)[1]).trim() : '';
	const flags = cells.slice(2, 7).map((c) => (c.includes('check-yes') ? '✔' : '✘'));
	wiki.set(name, [name, element, ...flags].join(','));
}
if (wiki.size < 100)
	throw new Error(`Character Role: only ${wiki.size} rows parsed (page layout changed?)`);

const csv = new Map();
for (const line of (await readFile(CSV, 'utf8')).split('\n').slice(1)) {
	if (!line.trim()) continue;
	const cells = line.split(',').map((c) => normalizeName(c));
	csv.set(cells[0], cells.join(','));
}

const report = { new: [], differs: [], amended: [], unrated: [], gone: [] };
for (const [name, line] of wiki) {
	const unrated = !line.includes('✔');
	if (!csv.has(name)) report[unrated ? 'unrated' : 'new'].push(line);
	else if (csv.get(name) !== line)
		report[AMENDED.has(name) ? 'amended' : 'differs'].push(`${csv.get(name)}  →  wiki ${line}`);
}
for (const name of csv.keys()) if (!wiki.has(name)) report.gone.push(name);

console.log(`[audit-character-roles] wiki ${wiki.size} rows · CSV ${csv.size} rows`);
for (const [kind, lines] of Object.entries(report)) {
	if (!lines.length) continue;
	console.log(`\n${kind} (${lines.length})`);
	for (const l of lines) console.log(`  ${l}`);
}
if (!report.new.length && !report.differs.length && !report.gone.length)
	console.log('\nNothing to review.');
