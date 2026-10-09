/**
 * scripts/fetch-endgame.mjs
 *
 * Network side of the endgame presets (lineups design §2.6, §10.5) — fetches
 * every Stygian Onslaught season from lunaris.moe, which serves the game's own
 * data, and writes the committed, trimmed `src/lib/data/endgame/stygian.json`.
 * The site never talks to lunaris; it reads the committed file.
 *
 *   node scripts/fetch-endgame.mjs
 *   node scripts/build-endgame-art.mjs     # then: the images, from assets-src/
 *
 * ⚓ CREDIT (Nate 2026-10-09): lunaris.moe for the season data and the icons,
 * stygian.moe for cross-checking the dates — both named on the About page.
 *
 * ⚓ NO LEAKS. lunaris tracks BETA builds, so its newest seasons can be
 * unreleased, and their dates are beta dates (its 6.7 and 7.1 entries overlap
 * their neighbours). A season is written only when the hand-maintained
 * `season-dates.json` names its version — that table, not lunaris, says when a
 * season went live. The site then shows a season only once that date passes.
 *
 * What one battlefield keeps: the boss (by the slug of its English title), HP
 * at level 105 (Fearless) and 110 (Dire) — ⚠️ per SEASON, since a rerun can
 * change it (Frostnight Herra, 6.1 → 6.5) — and its checks. What a boss keeps:
 * its names, description, mechanics and elemental RES, in every language the
 * source carries. Downloads (to the gitignored assets-src/): each boss's circle
 * icon and every sprite a check names.
 *
 * Polite client: single-threaded, ≥400ms between requests, descriptive UA.
 */

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATES = join(ROOT, 'src/lib/data/endgame/season-dates.json');
const OUT = join(ROOT, 'src/lib/data/endgame/stygian.json');
const ABYSS_OUT = join(ROOT, 'src/lib/data/endgame/abyss.json');
const ABYSS_ICON_DIR = join(ROOT, 'assets-src/endgame/abyss');
const MONSTER_ICON_DIR = join(ROOT, 'assets-src/endgame/monsters');
const ICON_DIR = join(ROOT, 'assets-src/endgame/stygian-icons');
const SPRITE_DIR = join(ROOT, 'assets-src/endgame/sprites');

const SCHEDULE_URL = (id) => `https://lunaris.moe/data/leylinechallenge/${id}.json`;
const MONSTER_ICON_URL = (icon) => `https://api.lunaris.moe/data/assets/monstericon/${icon}.png`;
const SPRITE_URL = (id) => `https://api.lunaris.moe/data/assets/icons/${id}.png`;
const API_VERSION_URL = 'https://api.lunaris.moe/data/version.json';
const TOWER_LIST_URL = (v) => `https://api.lunaris.moe/data/${v}/towerlist.json`;
const TOWER_URL = (v, lang, id) => `https://api.lunaris.moe/data/${v}/${lang}/tower/${id}.json`;
const BLESSING_ICON_URL = (icon) => `https://api.lunaris.moe/data/assets/tower/${icon}.png`;
const FIRST_SCHEDULE = 5269001;
const USER_AGENT = 'critcalc.app endgame presets (https://critcalc.app)';

/** Our locale keys → the source's field prefixes. Empty strings are dropped. */
const LOCALES = { en: 'en', zh: 'chs', pt: 'pt', ru: 'ru', fr: 'fr' };
/** The two difficulties we model (Nate): 5 = Fearless, 6 = Dire. */
const FEARLESS = 105;
const DIRE = 110;
const SEASON_DAYS = 42;

let last = 0;
async function get(url, as = 'json') {
	const wait = last + 400 - Date.now();
	if (wait > 0) await new Promise((r) => setTimeout(r, wait));
	last = Date.now();
	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!res.ok) return null;
	if (as === 'json') {
		// An unknown schedule answers 200 with the site's HTML shell, not JSON.
		if (!(res.headers.get('content-type') ?? '').includes('json')) return null;
		return res.json();
	}
	return Buffer.from(await res.arrayBuffer());
}

/** "Battle-Hardened Domovoy Sculptor: Gale Hewing" → "battle-hardened-domovoy-sculptor-gale-hewing" */
export function bossSlug(title) {
	return title
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/** One field in every locale the source fills, keyed by ours. */
function localized(cfg, field, at) {
	const out = {};
	for (const [ours, theirs] of Object.entries(LOCALES)) {
		let v = cfg[`${theirs}${field}`];
		if (Array.isArray(v)) v = v[at];
		if (typeof v === 'string' && v.trim()) out[ours] = clean(v);
	}
	return out;
}

/**
 * The game's markup, normalised: a highlighted run (`<color=#…>x</color>`)
 * becomes `**x**` so the site can emphasise it; a check's separator colour
 * tags go; `{SPRITE_PRESET#11034}` becomes `{sprite:11034}`; the escaped
 * newline is a newline.
 */
function clean(s) {
	return s
		.replace(/\\n/g, '\n')
		.replace(/<color=#[0-9A-Fa-f]{6,8}>\s*\|\s*<\/color>/gi, ' | ')
		.replace(/<color=#[0-9A-Fa-f]{6,8}>(.*?)<\/color>/gis, '**$1**')
		.replace(/\{SPRITE_PRESET#(\d+)\}/g, '{sprite:$1}')
		.replace(/\s*\|\s*/g, ' | ')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
}

// ⛔ No elemental RES (Nate 2026-10-09). lunaris's `monsterStats` is the
// monster's BASE template — Gale Hewing read 10/30% where the fight opens at
// 90% and steps down per Stellar Glimmer stack (stygian.moe) — and most
// bosses' RES moves with their mechanics. A wrong number is worse than none.

const addDays = (iso, n) => {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
};

async function exists(p) {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

/**
 * ⚓ THE ABYSS (Nate 2026-10-09): only its blessing, and only cycles named in
 * `season-dates.json` (date → the blessing's English name, one line per
 * cycle). lunaris' cycle list carries beta records — one-day cycles, names in
 * Chinese only — so the NAME is ours and lunaris supplies the rest: the
 * newest record whose English name matches gives the blessing's text in every
 * language, and its icon.
 */
async function abyss(table) {
	const version = (await get(API_VERSION_URL))?.version ?? 'latest';
	const list = (await get(TOWER_LIST_URL(version))) ?? {};
	const cycles = [];
	const starts = Object.keys(table).sort();
	await mkdir(ABYSS_ICON_DIR, { recursive: true });
	for (const [i, start] of starts.entries()) {
		const name = table[start];
		const id = Object.entries(list)
			.filter(([, c]) => c.enBuffName === name)
			.map(([k]) => Number(k))
			.sort((a, b) => b - a)[0];
		if (!id) {
			console.warn(`  ! no Abyss blessing named "${name}" on lunaris yet`);
			continue;
		}
		const blessing = { name: {}, text: {} };
		// ⚓ Floor 12's two half blessings (Nate 2026-10-09: which team goes in
		// which half is the planning question) — team 1 = first half.
		const halves = [{}, {}];
		// ⚓ The opponents of each half, per chamber (Nate 2026-10-09 — the
		// game's "Opponent details", split by half). Names in every language;
		// icon, level and HP from the record.
		const chambers = [];
		let icon;
		for (const [ours, theirs] of Object.entries(LOCALES)) {
			const c = await get(TOWER_URL(version, theirs, id));
			if (!c?.buffName?.trim()) continue;
			blessing.name[ours] = clean(c.buffName);
			blessing.text[ours] = clean(c.monthlyBuff?.description ?? '');
			icon ??= c.icon;
			const floor = (c.floors ?? []).find((f) => f.floorIndex === 12);
			['firstHalfBuff', 'secondHalfBuff'].forEach((k, h) => {
				const t = floor?.[k]?.description;
				if (t?.trim()) halves[h][ours] = clean(t);
			});
			(floor?.chambers ?? []).forEach((ch, i) => {
				chambers[i] ??= { level: ch.monsterLevel, halves: [[], []] };
				['firstHalfMonsters', 'secondHalfMonsters'].forEach((k, h) => {
					(ch[k] ?? []).forEach((m, j) => {
						const row = (chambers[i].halves[h][j] ??= {
							icon: m.icon,
							hp: Math.round(m.hp ?? 0),
							name: {}
						});
						if (m.name?.trim()) row.name[ours] = clean(m.name);
					});
				});
			});
		}
		const end = starts[i + 1] ?? addMonths(start, 1);
		cycles.push({ start, end, icon, ...blessing, halves, chambers });
		await mkdir(MONSTER_ICON_DIR, { recursive: true });
		for (const ch of chambers)
			for (const m of ch.halves.flat()) {
				const to = join(MONSTER_ICON_DIR, `${m.icon}.png`);
				if (await exists(to)) continue;
				const buf = await get(MONSTER_ICON_URL(m.icon), 'buffer');
				if (buf) await writeFile(to, buf);
				else console.warn(`  ! no icon for ${m.name.en} (${m.icon})`);
			}
		const to = join(ABYSS_ICON_DIR, `${icon}.png`);
		if (icon && !(await exists(to))) {
			const buf = await get(BLESSING_ICON_URL(icon), 'buffer');
			if (buf) await writeFile(to, buf);
		}
		console.log(`  abyss ${start}: ${blessing.name.en} (${icon})`);
	}
	const out = {
		_generated: 'scripts/fetch-endgame.mjs — do not edit; edit season-dates.json and re-run',
		_sources: 'lunaris.moe',
		cycles
	};
	await writeFile(ABYSS_OUT, JSON.stringify(out, null, '\t') + '\n');
	console.log(`wrote ${ABYSS_OUT}: ${cycles.length} cycle(s)`);
}

const addMonths = (iso, n) => {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCMonth(d.getUTCMonth() + n);
	return d.toISOString().slice(0, 10);
};

async function main() {
	const table = JSON.parse(await readFile(DATES, 'utf8'));
	const dates = table.stygian;
	const bosses = {};
	const seasons = [];
	const sprites = new Set();
	const icons = {};

	for (let id = FIRST_SCHEDULE; ; id++) {
		const s = await get(SCHEDULE_URL(id));
		if (!s) break;
		const version = String(s.challengeName);
		if (!dates[version]) {
			console.log(`  skip ${id} (v${version}): no live date in season-dates.json — unreleased?`);
			continue;
		}
		const at = (lvl) => s.levels.find((l) => l.monsterLevel === lvl)?.levelConfigs ?? [];
		const fearless = at(FEARLESS);
		const dire = at(DIRE);
		const battlefields = dire.map((cfg, i) => {
			const slug = bossSlug(cfg.enLevelName);
			if (!bosses[slug]) {
				const mechanics = [];
				(cfg.enMonsterSpecialMechanicName ?? []).forEach((name, j) => {
					if (!name?.trim()) return;
					mechanics.push({
						name: localized(cfg, 'MonsterSpecialMechanicName', j),
						text: localized(cfg, 'LevelMaxDescription', j)
					});
				});
				bosses[slug] = {
					name: localized(cfg, 'LevelName'),
					description: localized(cfg, 'MonsterSpecialDesc'),
					mechanics
				};
				// The circle icon's name is not stored; it is FOUND. Candidates, in
				// order: the challenge image's suffix (UI_Img_LeyLineChallenge_X ↔
				// UI_MonsterIcon_X — lunaris' own helper swaps prefixes the same way),
				// then the model name with trailing segments stripped one at a time
				// ("Lloigor_Primo_01_Abyss" → … → "Lloigor_Primo").
				const model = String(cfg.monsterStats?.matchedName ?? '').replace(/^Monster_/, '');
				const parts = model.split('_');
				icons[slug] = [
					String(cfg.specialMonsterIcon).replace(/^UI_(Img_LeyLineChallenge|MonsterIcon)_/, ''),
					...parts.map((_, k) => parts.slice(0, parts.length - k).join('_'))
				].map((n) => `UI_MonsterIcon_${n}`);
			}
			const checks = [];
			(cfg.enRecommendedLevelMechanic ?? []).forEach((text, j) => {
				if (!text?.trim()) return;
				const tag = cfg.tagType?.[j] === 'Disadvantage' ? 'disfavoured' : 'favoured';
				const loc = localized(cfg, 'RecommendedLevelMechanic', j);
				for (const m of (loc.en ?? '').matchAll(/\{sprite:(\d+)\}/g)) sprites.add(m[1]);
				checks.push({ tag, text: loc });
			});
			return {
				boss: slug,
				hp: {
					fearless: Math.round(fearless[i]?.monsterStats?.hp ?? 0),
					dire: Math.round(cfg.monsterStats?.hp ?? 0)
				},
				checks
			};
		});
		seasons.push({ version, start: dates[version], battlefields });
		console.log(`  ${id} v${version}: ${battlefields.map((b) => b.boss).join(' · ')}`);
	}

	seasons.sort((a, b) => a.start.localeCompare(b.start));
	seasons.forEach((s, i) => (s.end = seasons[i + 1]?.start ?? addDays(s.start, SEASON_DAYS)));

	const out = {
		_generated: 'scripts/fetch-endgame.mjs — do not edit; edit season-dates.json and re-run',
		_sources: 'lunaris.moe (season data, icons) · stygian.moe (dates, cross-checked)',
		bosses: Object.fromEntries(Object.entries(bosses).sort(([a], [b]) => a.localeCompare(b))),
		seasons
	};
	await mkdir(dirname(OUT), { recursive: true });
	await writeFile(OUT, JSON.stringify(out, null, '\t') + '\n');
	console.log(`wrote ${OUT}: ${Object.keys(bosses).length} bosses, ${seasons.length} seasons`);

	await mkdir(ICON_DIR, { recursive: true });
	await mkdir(SPRITE_DIR, { recursive: true });
	for (const [slug, candidates] of Object.entries(icons)) {
		const to = join(ICON_DIR, `${slug}.png`);
		if (await exists(to)) continue;
		let buf = null;
		for (const name of candidates) if ((buf = await get(MONSTER_ICON_URL(name), 'buffer'))) break;
		if (buf) await writeFile(to, buf);
		else console.warn(`  ! no icon for ${slug} (tried ${candidates.join(', ')})`);
	}
	for (const id of [...sprites].sort()) {
		const to = join(SPRITE_DIR, `${id}.png`);
		if (await exists(to)) continue;
		const buf = await get(SPRITE_URL(id), 'buffer');
		if (buf) await writeFile(to, buf);
		else console.warn(`  ! no sprite ${id}`);
	}
	console.log(
		`icons: ${Object.keys(icons).length} · sprites: ${sprites.size} (in assets-src/endgame/)`
	);
	await abyss(table.abyss ?? {});
}

// Run only when invoked directly — build-endgame-art imports `bossSlug`.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
