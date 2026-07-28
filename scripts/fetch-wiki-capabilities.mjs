/**
 * scripts/fetch-wiki-capabilities.mjs
 *
 * Network side of the wiki capability sweep — the ONLY script that talks to
 * the Genshin Impact Fandom wiki. Fetches capability-category membership via
 * the MediaWiki API and resolves each member title to a corpus character +
 * ability, writing a committed snapshot so the diff itself
 * (audit-capability-sweep.mjs) runs offline and reproducibly.
 *
 *   node scripts/fetch-wiki-capabilities.mjs           # refresh membership,
 *                                                      #   resolve new titles
 *   node scripts/fetch-wiki-capabilities.mjs --full    # discard the resolution
 *                                                      #   cache, re-resolve all
 *
 * Resolution ladder per title:
 *   1. TITLE_OVERRIDES (manual triage in wiki-capability-config.mjs)
 *   2. unique normalized ability-name match against the corpus index
 *   3. talent-page infobox fetch (|character = …), then name→id
 *   4. unresolved — surfaced in the sweep report's Mapping Health section
 *
 * Polite client: single-threaded, ≥400ms between requests, descriptive UA.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	ALL_CATEGORIES,
	TITLE_OVERRIDES,
	USER_AGENT,
	WIKI_API
} from './wiki-capability-config.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARACTERS_DIR = join(PROJECT_ROOT, 'src/lib/data/characters');
const SNAPSHOT = join(PROJECT_ROOT, 'docs/library/wiki/capability-categories.json');

const FULL = process.argv.includes('--full');

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

let lastRequest = 0;
async function api(params) {
	const wait = lastRequest + 400 - Date.now();
	if (wait > 0) await new Promise((r) => setTimeout(r, wait));
	lastRequest = Date.now();
	const url = `${WIKI_API}?${new URLSearchParams({
		format: 'json',
		formatversion: '2',
		...params
	})}`;
	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
	const body = await res.json();
	if (body.error) throw new Error(`API error: ${body.error.code} — ${body.error.info}`);
	return body;
}

/** All page-type members of a category, paginated. Returns null if the
 *  category doesn't exist (vs an empty existing category). */
async function categoryMembers(name, type = 'page') {
	const members = [];
	let cont;
	do {
		const body = await api({
			action: 'query',
			list: 'categorymembers',
			cmtitle: `Category:${name}`,
			cmtype: type,
			cmlimit: '500',
			...(cont ? { cmcontinue: cont } : {})
		});
		members.push(...body.query.categorymembers.map((m) => m.title));
		cont = body.continue?.cmcontinue;
	} while (cont);
	if (members.length === 0) {
		const info = await api({ action: 'query', titles: `Category:${name}` });
		if (info.query.pages[0]?.missing) return null;
	}
	return members;
}

/** The `|character = …` (and `|element = …`, for Traveler scoping) fields
 *  from a talent/constellation page's infobox. */
async function pageInfobox(title) {
	const body = await api({
		action: 'query',
		titles: title,
		prop: 'revisions',
		rvslots: 'main',
		rvprop: 'content'
	});
	const text = body.query.pages[0]?.revisions?.[0]?.slots?.main?.content ?? '';
	const field = (name) => {
		const m = text.match(new RegExp(`^\\s*\\|\\s*${name}\\s*=\\s*(.+?)\\s*$`, 'm'));
		return m
			? m[1]
					.replace(/\[\[|\]\]/g, '')
					.split('|')[0]
					.trim()
			: null;
	};
	return { character: field('character'), element: field('element') };
}

// ---------------------------------------------------------------------------
// Corpus index
// ---------------------------------------------------------------------------

/** Wiki titles use typographic punctuation; genshin-db-sourced names vary.
 *  Meet in the middle: NFKC, lowercase, ASCII quotes/dashes, no punctuation. */
export function normalizeTitle(s) {
	return s
		.normalize('NFKC')
		.toLowerCase()
		.replace(/[‘’ʼ]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/[–—―]/g, '-')
		.replace(/[!?,.:;"'·…()·]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

const characters = new Map(); // id → parsed JSON
const abilityIndex = new Map(); // normalized name → [{charId, abilityId, section, constellationLevel}]
const charNameToId = new Map(); // normalized character name → id

for (const file of (await readdir(CHARACTERS_DIR)).filter((f) => f.endsWith('.json')).sort()) {
	const data = JSON.parse(await readFile(join(CHARACTERS_DIR, file), 'utf8'));
	if (!data.id || data.id === 'blank') continue;
	characters.set(data.id, data);
	for (const name of [data.name, data.displayName]) {
		if (name) charNameToId.set(normalizeTitle(name), data.id);
	}
	for (const [section, list] of [
		['ability', data.abilities],
		['passive', data.passives],
		['constellation', data.constellations]
	]) {
		(list ?? []).forEach((a, i) => {
			if (!a.name) return;
			const entry = {
				charId: data.id,
				abilityId: a.id,
				section,
				...(section === 'constellation' && {
					constellationLevel: a.constellationLevel ?? i + 1
				})
			};
			const key = normalizeTitle(a.name);
			if (!abilityIndex.has(key)) abilityIndex.set(key, []);
			abilityIndex.get(key).push(entry);
		});
	}
}

// Traveler: the wiki names the character "Traveler"; our roster splits by
// element. An ability name owned by exactly one traveler_* JSON disambiguates
// itself through the index; the bare character name maps to all variants.
const TRAVELER_IDS = [...characters.keys()].filter((id) => id.startsWith('traveler_'));

// ---------------------------------------------------------------------------
// Fetch membership
// ---------------------------------------------------------------------------

let previous = { categories: {}, resolutions: {} };
try {
	previous = JSON.parse(await readFile(SNAPSHOT, 'utf8'));
} catch {
	/* first run */
}

const categories = {}; // category name → sorted member titles
const subcats = {}; // parent → [leaf names]
const missingCategories = [];

for (const cat of ALL_CATEGORIES) {
	const leaves = [cat.name];
	if (cat.recurse) {
		const subs = await categoryMembers(cat.name, 'subcat');
		if (subs === null) {
			missingCategories.push(cat.name);
			continue;
		}
		const names = subs.map((t) => t.replace(/^Category:/, ''));
		subcats[cat.name] = names.sort();
		leaves.push(...names);
	}
	for (const leaf of leaves) {
		if (leaf in categories) continue;
		const members = await categoryMembers(leaf);
		if (members === null) {
			missingCategories.push(leaf);
			continue;
		}
		// Category/redirect artifacts are not talent pages.
		categories[leaf] = members.filter((t) => !/^(Category|Template|File):/.test(t)).sort();
		console.log(`  ${leaf}: ${categories[leaf].length}`);
	}
}

if (missingCategories.length) {
	console.warn(`\n⚠ categories missing on the wiki (renamed?): ${missingCategories.join(', ')}`);
}

// ---------------------------------------------------------------------------
// Resolve titles → corpus
// ---------------------------------------------------------------------------

const CHARACTER_CATEGORIES = new Set(['Off-Field Characters']);
const characterCategoryLeaves = new Set(
	Object.keys(categories).filter((c) => CHARACTER_CATEGORIES.has(c))
);

const allTitles = new Map(); // title → isCharacterPage
for (const [leaf, members] of Object.entries(categories)) {
	const isChar = characterCategoryLeaves.has(leaf);
	for (const t of members) allTitles.set(t, isChar || allTitles.get(t) === true);
}

const resolutions = {}; // title → [{charId, abilityId?, section?, constellationLevel?, via}] | []
let cacheHits = 0;
let infoboxFetches = 0;

/** Resolve a character page title (or infobox character value) to roster ids.
 *  "Traveler (Dendro)" → traveler_dendro; bare "Traveler" (optionally scoped
 *  by the talent page's element field) → the matching variant(s). */
function resolveCharacterName(raw, element) {
	const travelerVariant = raw.match(/^Traveler \((\w+)\)$/i);
	if (travelerVariant) {
		const id = `traveler_${travelerVariant[1].toLowerCase()}`;
		return characters.has(id) ? [id] : [];
	}
	const norm = normalizeTitle(raw.replace(/\s*\(.+\)$/, ''));
	if (norm === 'traveler') {
		const id = element && `traveler_${element.toLowerCase()}`;
		return id && characters.has(id) ? [id] : TRAVELER_IDS;
	}
	const id = charNameToId.get(norm);
	return id ? [id] : [];
}

for (const [title, isCharacterPage] of allTitles) {
	if (!FULL && previous.resolutions?.[title]?.length) {
		resolutions[title] = previous.resolutions[title];
		cacheHits++;
		continue;
	}

	const override = TITLE_OVERRIDES.get(title);
	if (override === 'ignore') {
		resolutions[title] = [{ charId: null, via: 'manual-ignore' }];
		continue;
	}
	if (override) {
		resolutions[title] = [{ ...override, via: 'manual' }];
		continue;
	}

	if (isCharacterPage) {
		resolutions[title] = resolveCharacterName(title).map((charId) => ({
			charId,
			via: 'characterName'
		}));
		continue;
	}

	const normTitle = normalizeTitle(title.replace(/\s*\(.+\)$/, ''));
	let hits = abilityIndex.get(normTitle) ?? [];
	// Colon-prefix rung: the wiki titles a whole skill; curation splits it into
	// sub-abilities ("Molten Inferno" → "Molten Inferno: Indomitable Flame").
	if (hits.length === 0) {
		for (const [name, entries] of abilityIndex) {
			if (name.startsWith(`${normTitle} `) || name.startsWith(`${normTitle}:`))
				hits.push(...entries);
		}
	}
	if (hits.length > 0 && new Set(hits.map((h) => h.charId)).size === 1) {
		resolutions[title] = hits.map((h) => ({ ...h, via: 'abilityName' }));
		continue;
	}

	// Ambiguous across characters, or no name match — ask the talent page.
	infoboxFetches++;
	const box = await pageInfobox(title);
	if (box.character) {
		const ids = resolveCharacterName(box.character, box.element);
		const scoped = hits.filter((h) => ids.includes(h.charId));
		resolutions[title] =
			scoped.length > 0
				? scoped.map((h) => ({ ...h, via: 'infobox' }))
				: ids.map((charId) => ({ charId, via: 'infobox-noAbility' }));
	} else {
		resolutions[title] = []; // unresolved — Mapping Health
	}
}

// ---------------------------------------------------------------------------
// Write snapshot
// ---------------------------------------------------------------------------

const snapshot = {
	endpoint: WIKI_API,
	fetchedAt: new Date().toISOString(),
	subcats,
	categories: Object.fromEntries(Object.entries(categories).sort(([a], [b]) => a.localeCompare(b))),
	resolutions: Object.fromEntries(
		Object.entries(resolutions).sort(([a], [b]) => a.localeCompare(b))
	)
};

await mkdir(dirname(SNAPSHOT), { recursive: true });
await writeFile(SNAPSHOT, JSON.stringify(snapshot, null, '\t') + '\n');

const unresolved = Object.values(resolutions).filter((r) => r.length === 0).length;
console.log(
	`\nwrote ${SNAPSHOT.replace(PROJECT_ROOT + '/', '')}: ` +
		`${Object.keys(categories).length} categories, ${allTitles.size} titles ` +
		`(${cacheHits} cached, ${infoboxFetches} infobox fetches, ${unresolved} unresolved)`
);
