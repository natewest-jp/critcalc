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
/** The bosses' WORDS — description and mechanics, ~95% of the data — in a
 *  file of their own, so only the boss detail modal loads them (it imports
 *  this on open); the board reads names alone from OUT. */
const BOSS_TEXT_OUT = join(ROOT, 'src/lib/data/endgame/stygian-bosses.json');
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
 * becomes `**x**` so the site can emphasise it; a check's separator color
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
 *
 * ↻ 2026-10-16: lunaris can carry a live cycle with its English NAME still
 * blank (Stardread Moon: Chinese name filled, English text filled, English
 * name empty). A line may then be `{ "en": "...", "zh": "..." }` — matched on
 * the Chinese name, with OUR English name written where lunaris has none.
 */
async function abyss(table) {
	const { version, list } = await towerList();
	const cycles = [];
	const starts = Object.keys(table).sort();
	await mkdir(ABYSS_ICON_DIR, { recursive: true });
	for (const [i, start] of starts.entries()) {
		const line = table[start];
		const name = typeof line === 'string' ? line : line.en;
		const zh = typeof line === 'string' ? undefined : line.zh;
		const id = Object.entries(list)
			.filter(([, c]) => c.enBuffName === name || (zh && c.chsBuffName === zh))
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
			const own = c?.buffName?.trim() || (ours === 'en' ? name : '');
			if (!own) continue;
			blessing.name[ours] = clean(own);
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
	await keepsEveryEntry(ABYSS_OUT, 'cycles', 'start', cycles);
	await writeFile(ABYSS_OUT, JSON.stringify(out, null, '\t') + '\n');
	console.log(`wrote ${ABYSS_OUT}: ${cycles.length} cycle(s)`);
}

/**
 * The Abyss cycle list, from the newest data version that SERVES one. ⚠️ The
 * version lunaris names as current can lack the file (2026-10-16: 7.1.53
 * answered 404 while 7.1.52 served it), and an absent list used to read as an
 * empty one — every cycle "not on lunaris yet", and abyss.json rewritten
 * without them.
 */
async function towerList() {
	const versions = (await get(API_VERSION_URL))?.versions ?? [];
	for (const version of versions) {
		const list = await get(TOWER_LIST_URL(version));
		if (list && Object.keys(list).length) return { version, list };
		console.warn(`  ! no Abyss cycle list at lunaris v${version}`);
	}
	throw new Error('no lunaris data version serves an Abyss cycle list');
}

/**
 * ⚓ A fetch may ADD entries, never lose one. A dated entry already in the
 * committed file and absent from this run is the SOURCE failing (a 404, a
 * blip, an HTML shell), not the game retiring a season — so refuse to write,
 * rather than let a bad request delete a shipped season. To retire one on
 * purpose, delete its line from season-dates.json AND from the output file.
 */
async function keepsEveryEntry(path, field, key, fresh) {
	let before;
	try {
		before = JSON.parse(await readFile(path, 'utf8'))[field] ?? [];
	} catch {
		return; // no committed file yet
	}
	const now = new Set(fresh.map((e) => e[key]));
	const lost = before.map((e) => e[key]).filter((k) => !now.has(k));
	if (lost.length)
		throw new Error(
			`${path}: this run lost ${lost.join(', ')} — refusing to write (the source failed, not the season)`
		);
}

/**
 * ⚓ IMAGINARIUM THEATER (Nate 2026-11-11): the season's rules a roster is
 * measured against — its three elements, the six Opening Characters, the four
 * Special Guest Stars, and each mode's cast size, level and boss acts. The
 * rules themselves: `docs/library/game/imaginarium-theater.md`.
 *
 * ⚠️ LIVE BUILD ONLY. A beta folder (`7.2.51`) rewrites the upcoming seasons
 * as one-day test records, so the live month goes missing; the live build's
 * folder (`x.y.0`) lists every month. And ⚓ NO LEAKS, as for Stygian: a
 * season is written only when `season-dates.json` names its start.
 *
 * ⚠️ lunaris's names are not the game's: `bonusAvatars` are the Opening
 * Characters and `featuredAvatars` the Special Guest Stars (library §6).
 */
const ROLEPLAY_LIST_URL = (v) => `https://api.lunaris.moe/data/${v}/roleplaylist.json`;
const ROLEPLAY_URL = (v, lang, id) =>
	`https://api.lunaris.moe/data/${v}/${lang}/roleplay/${id}.json`;
const CHAR_LIST_URL = (v) => `https://api.lunaris.moe/data/${v}/charlist.json`;
const THEATER_OUT = join(ROOT, 'src/lib/data/endgame/theater.json');
/** lunaris's element codes, confirmed against twelve seasons' Opening Characters. */
const THEATER_ELEMENTS = {
	2: 'pyro',
	3: 'hydro',
	4: 'dendro',
	5: 'electro',
	6: 'cryo',
	7: 'anemo',
	8: 'geo'
};
/** lunaris's difficulty keys, in the game's order. */
const THEATER_MODES = { 1: 'easy', 2: 'normal', 3: 'hard', 4: 'visionary', 5: 'lunar' };

/** Our character id from an English name: "Kamisato Ayaka" → "kamisato_ayaka". */
export const characterId = (name) =>
	name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');

async function theater(starts) {
	const { characterIndex } = await import('../src/lib/data/characterIndex.generated.ts');
	const known = new Set(characterIndex.map((c) => c.id));
	const versions = ((await get(API_VERSION_URL))?.versions ?? []).filter((v) =>
		/^\d+\.\d+\.0$/.test(v)
	);
	let version, list;
	for (const v of versions) {
		list = await get(ROLEPLAY_LIST_URL(v));
		if (list && Object.keys(list).length) {
			version = v;
			break;
		}
		console.warn(`  ! no Theater season list at lunaris v${v}`);
	}
	if (!version) throw new Error('no live lunaris build serves a Theater season list');
	const chars = await get(CHAR_LIST_URL(version));
	if (!chars) throw new Error(`no character list at lunaris v${version}`);

	/** Characters a season names that the corpus doesn't have yet: the view
	 *  still needs a name and an element to count and show them. */
	const extra = {};
	const who = (avatarId) => {
		const c = chars[String(avatarId)];
		if (!c) throw new Error(`lunaris v${version}: no character ${avatarId}`);
		const id = characterId(c.enName);
		if (!known.has(id)) extra[id] = { name: c.enName, element: c.element.toLowerCase() };
		return { id, element: c.element.toLowerCase() };
	};

	const seasons = [];
	await mkdir(MONSTER_ICON_DIR, { recursive: true });
	const icons = new Set();
	for (const [i, start] of [...starts].sort().entries()) {
		const id = Object.entries(list).find(([, s]) => s.beginTime.slice(0, 10) === start)?.[0];
		if (!id) {
			console.warn(`  ! no Theater season starting ${start} at lunaris v${version}`);
			continue;
		}
		const modes = {};
		let elements, opening, guests;
		for (const [ours, theirs] of Object.entries(LOCALES)) {
			const s = await get(ROLEPLAY_URL(version, theirs, id));
			if (!s) continue;
			if (!elements) {
				const a = s.avatarConfig;
				elements = a.elementRestrictions.filter(Boolean).map((code) => {
					const e = THEATER_ELEMENTS[code];
					if (!e) throw new Error(`Theater ${start}: unknown element code ${code}`);
					return e;
				});
				opening = a.bonusAvatars.map((b) => who(b.avatarId));
				guests = a.featuredAvatars.map((g) => who(g).id);
				// The element map's self-check: the six Opening Characters are two of
				// each of the season's elements. A miss means the codes moved.
				const seen = [...new Set(opening.map((o) => o.element))].sort();
				if (opening.length !== 6 || seen.join() !== [...elements].sort().join())
					throw new Error(
						`Theater ${start}: Opening Characters (${seen}) don't match the elements (${elements})`
					);
				opening = opening.map((o) => o.id);
			}
			for (const [key, cfg] of Object.entries(s.difficultyConfig)) {
				const mode = THEATER_MODES[key];
				if (!mode) throw new Error(`Theater ${start}: unknown difficulty ${key}`);
				const m = (modes[mode] ??= {
					mode,
					acts: cfg.roomCount,
					alternate: cfg.invitePoolSize,
					extra: cfg.invitePoolBonus,
					level: cfg.minAvatarLevel,
					bosses: [],
					arcana: []
				});
				const fights = (rooms, into, withAct) =>
					Object.entries(rooms ?? {})
						.filter(([, r]) => r.bossName?.trim())
						.sort(([a], [b]) => Number(a) - Number(b))
						.forEach(([act, r], j) => {
							const row = (into[j] ??= {
								...(withAct ? { act: Number(act) } : {}),
								level: r.monsterLevel,
								name: {},
								icons: (r.monsters ?? []).map((x) => x.icon)
							});
							row.name[ours] = clean(r.bossName);
						});
				fights(cfg.rooms, m.bosses, true);
				fights(cfg.hardRooms, m.arcana, false);
			}
		}
		if (!elements) {
			console.warn(`  ! Theater ${start}: lunaris served no season detail`);
			continue;
		}
		const ordered = Object.values(THEATER_MODES)
			.filter((k) => modes[k])
			.map((k) => modes[k]);
		for (const m of ordered)
			for (const b of [...m.bosses, ...m.arcana]) b.icons.forEach((x) => icons.add(x));
		const end = [...starts].sort()[i + 1] ?? addMonths(start, 1);
		seasons.push({ start, end, elements, opening, guests, modes: ordered });
		console.log(`  theater ${start}: ${elements.join(' · ')} — ${ordered.length} modes`);
	}
	for (const icon of [...icons].sort()) {
		const to = join(MONSTER_ICON_DIR, `${icon}.png`);
		if (await exists(to)) continue;
		const buf = await get(MONSTER_ICON_URL(icon), 'buffer');
		if (buf) await writeFile(to, buf);
		else console.warn(`  ! no icon ${icon}`);
	}
	const out = {
		_generated: 'scripts/fetch-endgame.mjs — do not edit; edit season-dates.json and re-run',
		_sources: `lunaris.moe (live build ${version})`,
		characters: Object.fromEntries(Object.entries(extra).sort(([a], [b]) => a.localeCompare(b))),
		seasons
	};
	await keepsEveryEntry(THEATER_OUT, 'seasons', 'start', seasons);
	await writeFile(THEATER_OUT, JSON.stringify(out, null, '\t') + '\n');
	console.log(`wrote ${THEATER_OUT}: ${seasons.length} season(s)`);
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

	const sorted = Object.entries(bosses).sort(([a], [b]) => a.localeCompare(b));
	const header = {
		_generated: 'scripts/fetch-endgame.mjs — do not edit; edit season-dates.json and re-run',
		_sources: 'lunaris.moe (season data, icons) · stygian.moe (dates, cross-checked)'
	};
	const out = {
		...header,
		bosses: Object.fromEntries(sorted.map(([slug, b]) => [slug, { name: b.name }])),
		seasons
	};
	const text = {
		...header,
		bosses: Object.fromEntries(
			sorted.map(([slug, b]) => [slug, { description: b.description, mechanics: b.mechanics }])
		)
	};
	await keepsEveryEntry(OUT, 'seasons', 'version', seasons);
	await mkdir(dirname(OUT), { recursive: true });
	await writeFile(OUT, JSON.stringify(out, null, '\t') + '\n');
	await writeFile(BOSS_TEXT_OUT, JSON.stringify(text, null, '\t') + '\n');
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
	await theater(table.theater ?? []);
}

// Run only when invoked directly — build-endgame-art imports `bossSlug`.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
