/**
 * scripts/audit-genshin-db-text.mjs
 *
 * Method #1b — genshin-db TEXT differential (the sibling of
 * audit-genshin-db-diff.mjs, which covers scalars only).
 *
 * ⚠️⚠️ THE GAP THIS EXISTS FOR: a genshin-db bump is NOT additive-only. A game
 * patch REVISES EXISTING characters' kit text, and nothing in the gate suite
 * notices — the scalar diff passes because a reworked passive's numbers often
 * don't move, characterLint checks shape not prose, and every test stays green
 * while our authored effects quietly go stale.
 *
 * Measured on 5.2.12 → 5.2.13 (game 7.0): 2 characters ADDED, 11 existing
 * characters' talent text REVISED — Stellar Swirl rolling out across the Anemo
 * roster, plus a substantial Sandrone rework. None of it was visible to any
 * existing check.
 *
 * Baseline resolution needs no committed snapshot: the previously-pinned
 * version is recoverable from git history of package.json, and the tarball
 * comes from the registry.
 *
 *   node scripts/audit-genshin-db-text.mjs                 # vs the previous pin in git
 *   node scripts/audit-genshin-db-text.mjs --since 5.2.12  # vs an explicit version
 *   node scripts/audit-genshin-db-text.mjs --write         # + docs/curation/genshin-db-text-diff.md
 *   node scripts/audit-genshin-db-text.mjs --names         # ONLY the corpus-names check (no network)
 *
 * ⚠️⚠️ THE SECOND GAP (2026-09-15): the differential above compares genshin-db with
 * ITSELF, so prose that was never generated from genshin-db is invisible to it. Four
 * of the seven element Travelers were hand-written in 2026-05 before the ingest
 * existed and carried INVENTED passive and constellation names for four months —
 * the generator refuses Travelers, so no scalar or text diff ever covered them, and
 * the frames audit reads only frames. The names section below compares OUR corpus's
 * passive and constellation NAMES against the installed genshin-db for every
 * character, Travelers included, straight from the installed package (no network).
 * A name that is not genshin-db's is prose that came from somewhere else.
 *
 * ⛔ REVIEW-CANDIDATE GENERATOR, NEVER A FIXER. A revised entry is a prompt to
 * re-read the kit and re-author deliberately; re-authoring is its own scoped
 * round, never a silent side effect of ingesting a new character.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(PROJECT_ROOT, 'docs/curation/genshin-db-text-diff.md');
const DATA_REL = 'src/min/data.min.json';

/** Vocabulary worth counting per entry — a delta here names the MECHANIC that
 *  moved, which is what turns "text changed" into "here is what to go read".
 *  ⛔ Not a completeness claim: a change with no keyword hit still reports. */
const KEYWORDS = [
	'Stellar Glimmer',
	'Stellar Swirl',
	'Stellar-Conduct',
	'Polestar',
	'Radiance',
	'Moonsign',
	'Nightsoul',
	'Hexerei',
	'Secret Rite',
	'Lunar'
];

const argv = process.argv.slice(2);
const flag = (name) => {
	const i = argv.indexOf(name);
	return i === -1 ? null : argv[i + 1];
};

function installedVersion() {
	const p = join(PROJECT_ROOT, 'node_modules/genshin-db/package.json');
	if (!existsSync(p)) throw new Error('genshin-db is not installed — run npm install first.');
	return JSON.parse(readFileSync(p, 'utf8')).version;
}

/** The pin BEFORE the current one, read out of git history rather than a
 *  committed snapshot. Returns null when history has no earlier distinct pin
 *  (a fresh clone, or the bump is not committed yet — then pass --since). */
function previousPinFromGit(current) {
	let log;
	try {
		log = execFileSync('git', ['log', '-p', '--follow', '--', 'package.json'], {
			cwd: PROJECT_ROOT,
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024
		});
	} catch {
		return null;
	}
	// Newest-first; the first pin that differs from the installed one is the
	// baseline. Matches both `^5.2.12` and a pinned `5.2.12`.
	for (const line of log.split('\n')) {
		const m = /^[+-]\s*"genshin-db":\s*"[~^]?([0-9]+\.[0-9]+\.[0-9]+)"/.exec(line);
		if (m && m[1] !== current) return m[1];
	}
	return null;
}

function loadVersion(version, scratch) {
	const dir = join(scratch, version);
	mkdirSync(dir, { recursive: true }); // --pack-destination does not create it
	execFileSync('npm', ['pack', `genshin-db@${version}`, '--pack-destination', dir], {
		stdio: 'pipe',
		cwd: PROJECT_ROOT
	});
	const tgz = execFileSync('ls', [dir], { encoding: 'utf8' }).trim().split('\n')[0];
	execFileSync('tar', ['xzf', join(dir, tgz), '-C', dir]);
	return JSON.parse(readFileSync(join(dir, 'package', DATA_REL), 'utf8')).data.English;
}

// ── Corpus names vs the installed genshin-db ───────────────────────────────
const CHAR_DIR = join(PROJECT_ROOT, 'src/lib/data/characters');
/** Corpus id → genshin-db key: drop the underscores (`hu_tao` → `hutao`,
 *  `traveler_geo` → `travelergeo`) — the same rule `gcsimKeyFor` uses for gcsim,
 *  and genshin-db keys the seven Travelers `traveler<element>` too. */
const gdbKeyFor = (id) => id.replace(/_/g, '');

function namesReport(en) {
	const rows = [];
	const files = readdirSync(CHAR_DIR).filter((f) => f.endsWith('.json'));
	let covered = 0;
	for (const f of files) {
		const c = JSON.parse(readFileSync(join(CHAR_DIR, f), 'utf8'));
		const key = gdbKeyFor(c.id);
		const t = en.talents[key];
		const k = en.constellations[key];
		if (!t || !k) {
			rows.push({ id: c.id, what: '—', note: `no genshin-db entry under \`${key}\`` });
			continue;
		}
		covered++;
		const gdbPassives = ['passive1', 'passive2', 'passive3', 'passive4']
			.map((p) => t[p]?.name)
			.filter(Boolean);
		for (const p of c.passives ?? []) {
			if (!gdbPassives.includes(p.name))
				rows.push({
					id: c.id,
					what: `passive \`${p.name}\``,
					note: `genshin-db: ${gdbPassives.join(' · ')}`
				});
		}
		for (const con of c.constellations ?? []) {
			const want = k[`c${con.constellationLevel}`]?.name;
			if (want && con.name !== want)
				rows.push({
					id: c.id,
					what: `C${con.constellationLevel} \`${con.name}\``,
					note: `genshin-db: \`${want}\``
				});
		}
	}
	return { rows, covered, total: files.length };
}

function renderNames(n) {
	const L = [];
	L.push(
		`## 🔎 Corpus passive/constellation names vs installed genshin-db (${n.rows.length} divergent)`
	);
	L.push('');
	L.push(
		`**${n.covered}** of **${n.total}** corpus characters resolve to a genshin-db entry by id. ` +
			'A name genshin-db does not know is prose that was not generated from it — the class that let four ' +
			'Travelers carry invented talents from 2026-05-08 to 2026-09-15. ⚠️ Not every row is a defect: a ' +
			'deliberate curator rename is one too, so read before you re-ingest.'
	);
	L.push('');
	if (!n.rows.length)
		L.push("✅ Every passive and constellation name in the corpus is genshin-db's.");
	else {
		L.push('| Character | Ours | genshin-db |');
		L.push('| --- | --- | --- |');
		for (const r of n.rows) L.push(`| \`${r.id}\` | ${r.what} | ${r.note} |`);
	}
	L.push('');
	return L;
}

function installedData() {
	return JSON.parse(readFileSync(join(PROJECT_ROOT, 'node_modules/genshin-db', DATA_REL), 'utf8'))
		.data.English;
}

const count = (haystack, needle) =>
	(haystack.match(new RegExp(needle.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&'), 'gi')) || []).length;

function compareFolder(oldF = {}, newF = {}) {
	const added = [];
	const changed = [];
	for (const key of Object.keys(newF)) {
		const before = JSON.stringify(oldF[key] ?? null);
		const after = JSON.stringify(newF[key]);
		if (!(key in oldF)) {
			added.push(key);
			continue;
		}
		if (before === after) continue;
		const fields = [...new Set([...Object.keys(oldF[key] ?? {}), ...Object.keys(newF[key])])]
			.filter((f) => JSON.stringify((oldF[key] ?? {})[f]) !== JSON.stringify(newF[key][f]))
			.map((f) => {
				const nm = newF[key][f]?.name;
				const om = (oldF[key] ?? {})[f]?.name;
				return om && nm && om !== nm ? `${f} [${om} → ${nm}]` : nm ? `${f} (${nm})` : f;
			});
		const kw = KEYWORDS.map((w) => [w, count(before, w), count(after, w)])
			.filter(([, a, b]) => a !== b)
			.map(([w, a, b]) => `${w} ${a}→${b}`);
		changed.push({ key, fields, kw });
	}
	const removed = Object.keys(oldF).filter((k) => !(k in newF));
	return { added, changed, removed };
}

if (argv.includes('--names')) {
	const names = namesReport(installedData());
	console.log(
		[`# Corpus names vs genshin-db ${installedVersion()}`, '', ...renderNames(names)].join('\n')
	);
	// ⛔ Review candidates, never a gate: six of the first run's rows are the 7.0
	// Witch's Revelation passives genshin-db 5.2.13 does not carry at all.
	process.exit(0);
}

const scratch = mkdtempSync(join(tmpdir(), 'gdb-text-'));
try {
	const current = installedVersion();
	const baseline = flag('--since') ?? previousPinFromGit(current);
	if (!baseline) {
		console.error(
			`No baseline found. genshin-db ${current} is installed; pass --since <version> explicitly.`
		);
		process.exit(1);
	}

	const oldEn = loadVersion(baseline, scratch);
	const newEn = loadVersion(current, scratch);

	const talents = compareFolder(oldEn.talents, newEn.talents);
	const cons = compareFolder(oldEn.constellations, newEn.constellations);

	const L = [];
	L.push('# genshin-db text differential');
	L.push('');
	L.push(`**${baseline} → ${current}** · generated by \`scripts/audit-genshin-db-text.mjs\``);
	L.push('');
	L.push(
		'⛔ **Review candidates, not fixes.** A revised entry means go re-read the kit; ' +
			're-authoring is its own scoped round.'
	);
	L.push('');
	L.push(
		`**${talents.added.length} added · ${talents.changed.length} talent entries revised · ` +
			`${cons.changed.length} constellation entries revised**`
	);
	L.push('');

	if (talents.added.length) {
		L.push('## 🆕 New characters — full ingest pipeline (Stages 0–4)');
		L.push('');
		for (const k of talents.added) L.push(`- \`${k}\``);
		L.push('');
	}
	if (talents.removed.length) {
		L.push('## ⚠️ Removed from genshin-db');
		L.push('');
		for (const k of talents.removed) L.push(`- \`${k}\``);
		L.push('');
	}
	if (talents.changed.length) {
		L.push('## ↻ Revised talents — re-read the kit, re-author deliberately');
		L.push('');
		L.push('| Character | Changed fields | Mechanic delta |');
		L.push('| --- | --- | --- |');
		for (const c of talents.changed) {
			L.push(`| \`${c.key}\` | ${c.fields.join(', ') || '—'} | ${c.kw.join(' · ') || '—'} |`);
		}
		L.push('');
	}
	if (cons.changed.length) {
		L.push('## ↻ Revised constellations');
		L.push('');
		L.push('| Character | Changed fields | Mechanic delta |');
		L.push('| --- | --- | --- |');
		for (const c of cons.changed) {
			L.push(`| \`${c.key}\` | ${c.fields.join(', ') || '—'} | ${c.kw.join(' · ') || '—'} |`);
		}
		L.push('');
	}
	if (!talents.added.length && !talents.changed.length && !cons.changed.length) {
		L.push('✅ No text changes between these versions.');
		L.push('');
	}
	// ⚓ The names check rides every full report too, so a Traveler (which the
	// differential above cannot see) is covered whenever the report is regenerated.
	L.push(...renderNames(namesReport(newEn)));

	const report = L.join('\n');
	if (argv.includes('--write')) {
		await mkdir(dirname(OUT), { recursive: true });
		await writeFile(OUT, report + '\n');
		console.log(`Wrote ${OUT}`);
	}
	console.log(report);
} finally {
	rmSync(scratch, { recursive: true, force: true });
}
