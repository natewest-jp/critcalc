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
 *
 * ⛔ REVIEW-CANDIDATE GENERATOR, NEVER A FIXER. A revised entry is a prompt to
 * re-read the kit and re-author deliberately; re-authoring is its own scoped
 * round, never a silent side effect of ingesting a new character.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
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
