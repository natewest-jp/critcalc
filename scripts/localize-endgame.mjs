/**
 * scripts/localize-endgame.mjs
 *
 * Adds the languages lunaris.moe doesn't serve (Japanese today) to the
 * committed endgame files, from the game's own text maps.
 *
 *   node scripts/localize-endgame.mjs            # uses the cached text maps
 *   node scripts/localize-endgame.mjs --refresh  # downloads them again first
 *
 * `fetch-endgame.mjs` runs it after every fetch, since a fetch rewrites the
 * files with lunaris's languages only.
 *
 * How: every localized line lunaris gives us carries the game's Chinese. That
 * Chinese is looked up in the Chinese text map, and the same hash in the
 * Japanese text map is the game's Japanese line, so nothing is translated by
 * us. A line whose Chinese matches no text-map entry keeps English in that
 * language (`inLang` falls back), and the run lists it.
 *
 * Source: the text maps of Dimbreath's AnimeGameData, cached in the gitignored
 * `assets-src/textmap/` (about 160 MB). ⚠️ The old repository stopped at 6.x;
 * its successor is `animegamedata2`, whose branch is `main`, not `master`.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'assets-src/textmap');
const FILES = ['stygian.json', 'stygian-bosses.json', 'abyss.json', 'theater.json'].map((f) =>
	join(ROOT, 'src/lib/data/endgame', f)
);
const TEXTMAP_URL = (name) =>
	`https://gitlab.com/Dimbreath/animegamedata2/-/raw/main/TextMap/${name}.json`;
const USER_AGENT = 'critcalc.app endgame presets (https://critcalc.app)';

/** Our locale key → the text maps' language code. The source of truth for a
 *  line is always its Chinese, which lunaris serves for every entry. */
const LOCALES = { ja: 'JP' };
const SOURCE = 'CHS';
/** The game splits each language's text map in two. */
const PARTS = (code) => [`TextMap${code}`, `TextMap_Medium${code}`];

/** The same normalization `fetch-endgame.mjs` applies to lunaris's text. */
export function clean(s) {
	return s
		.replace(/\\n/g, '\n')
		.replace(/<color=#[0-9A-Fa-f]{6,8}>\s*\|\s*<\/color>/gi, ' | ')
		.replace(/<color=#[0-9A-Fa-f]{6,8}>(.*?)<\/color>/gis, '**$1**')
		.replace(/\{SPRITE_PRESET#(\d+)\}/g, '{sprite:$1}')
		.replace(/\s*\|\s*/g, ' | ')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
}

/** A looser key for the second pass: lunaris and the text map can differ in
 *  spacing and in where a highlight starts, never in the words. */
const loose = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, '');

async function textMap(name, refresh) {
	const path = join(CACHE, `${name}.json`);
	if (refresh || !existsSync(path)) {
		console.log(`  downloading ${name}…`);
		const res = await fetch(TEXTMAP_URL(name), { headers: { 'User-Agent': USER_AGENT } });
		if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
		const body = await res.text();
		// An unknown path answers 200 with GitLab's HTML page.
		if (!body.trimStart().startsWith('{')) throw new Error(`${name}: not a text map`);
		await mkdir(CACHE, { recursive: true });
		await writeFile(path, body);
	}
	return JSON.parse(await readFile(path, 'utf8'));
}

/** Every `{ en, zh, … }` object in a file, wherever it sits. */
function localizedIn(node, out = []) {
	if (Array.isArray(node)) node.forEach((n) => localizedIn(n, out));
	else if (node && typeof node === 'object') {
		if (typeof node.en === 'string' && typeof node.zh === 'string') out.push(node);
		else Object.values(node).forEach((n) => localizedIn(n, out));
	}
	return out;
}

export async function localizeEndgame({ refresh = false } = {}) {
	const docs = await Promise.all(FILES.map(async (f) => JSON.parse(await readFile(f, 'utf8'))));
	const lines = docs.flatMap((d) => localizedIn(d));
	const exact = new Set(lines.map((l) => l.zh));
	const looseWanted = new Set(lines.map((l) => loose(l.zh)));

	// Chinese line → its hash, exact first, then loose.
	const hashExact = new Map();
	const hashLoose = new Map();
	for (const part of PARTS(SOURCE))
		for (const [hash, raw] of Object.entries(await textMap(part, refresh))) {
			const c = clean(raw);
			if (exact.has(c) && !hashExact.has(c)) hashExact.set(c, hash);
			const l = loose(c);
			if (looseWanted.has(l) && !hashLoose.has(l)) hashLoose.set(l, hash);
		}

	for (const [ours, code] of Object.entries(LOCALES)) {
		const target = {};
		for (const part of PARTS(code)) Object.assign(target, await textMap(part, refresh));
		const missing = new Set();
		for (const line of lines) {
			const hash = hashExact.get(line.zh) ?? hashLoose.get(loose(line.zh));
			const text = hash && target[hash] ? clean(target[hash]) : '';
			if (text) line[ours] = text;
			else {
				delete line[ours];
				missing.add(line.en.split('\n')[0].slice(0, 80));
			}
		}
		console.log(`  ${ours}: ${lines.length - missing.size} of ${lines.length} lines`);
		for (const m of missing) console.warn(`  ! no ${ours} for "${m}"`);
	}

	await Promise.all(FILES.map((f, i) => writeFile(f, JSON.stringify(docs[i], null, '\t') + '\n')));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	localizeEndgame({ refresh: process.argv.includes('--refresh') }).catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
