#!/usr/bin/env node
/**
 * caveat-lint.mjs — mechanical style checks for user-facing caveat strings.
 *
 * Config lives in docs/curation/caveat-style-guide.md (fenced block
 * tagged `json caveat-lint-config`) so the doc and the checks cannot drift.
 *
 * Usage:
 *   node scripts/caveat-lint.mjs --live [charId...]     lint caveats in character JSONs (all if none given)
 *   node scripts/caveat-lint.mjs --proposals <file...>  lint proposedText/fallbackRewrite in proposal files
 *
 * Exit code 1 on any FAIL; WARNs are printed but do not fail.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STYLE_GUIDE = path.join(ROOT, 'docs/curation/caveat-style-guide.md');
const CHAR_DIR = path.join(ROOT, 'src/lib/data/characters');

function loadConfig() {
	const md = fs.readFileSync(STYLE_GUIDE, 'utf8');
	const m = md.match(/```json caveat-lint-config\n([\s\S]*?)```/);
	if (!m) throw new Error('caveat-lint-config block not found in style-guide.md');
	return JSON.parse(m[1]);
}

const cfg = loadConfig();
const findings = [];
const add = (level, where, msg) => findings.push({ level, where, msg });

function countSentences(text) {
	// Naive: terminal punctuation followed by space+capital or end of string.
	// Abbreviations (e.g., i.e.) excluded by requiring a following capital.
	const matches = text.match(/[.!?](\s+(?=[A-Z"“])|\s*$)/g);
	return matches ? matches.length : 1;
}

function lintText(text, where) {
	if (!text || !text.trim()) {
		add('FAIL', where, 'empty or whitespace-only caveat');
		return;
	}
	const len = text.length;
	if (len > cfg.failLength) add('FAIL', where, `length ${len} > hard cap ${cfg.failLength}`);
	else if (len > cfg.warnLength) add('WARN', where, `length ${len} > soft cap ${cfg.warnLength}`);

	const lower = text.toLowerCase();
	for (const banned of cfg.bannedSubstrings) {
		if (lower.includes(banned.toLowerCase())) add('FAIL', where, `banned substring "${banned}"`);
	}

	// Banned-pattern checks skip backticked spans: user-typed notation tokens
	// (e.g. `{coldDish:5}`) are legitimate camelCase; the separate backtick
	// check below polices whether the span is genuinely instructional.
	const noBackticks = text.replace(/`[^`]*`/g, '');
	for (const { pattern, reason, allow = [] } of cfg.bannedPatterns) {
		const re = new RegExp(pattern, 'g');
		for (const m of noBackticks.matchAll(re)) {
			const word = m[0];
			if (allow.includes(word)) continue;
			if (/^[A-Z0-9]+$/.test(word)) continue; // ALL-CAPS acronyms are fine
			add('FAIL', where, `banned pattern (${reason}): "${word}"`);
		}
	}

	if (text.includes('`')) {
		const sentences = text.split(/(?<=[.!?])\s+/);
		for (const s of sentences) {
			if (!s.includes('`')) continue;
			const sLower = s.toLowerCase();
			const instructional = cfg.backtickAllowedOnlyWithVerbs.some((v) => sLower.includes(v));
			if (!instructional)
				add(
					'FAIL',
					where,
					`backticked token outside an instruction sentence: "${s.slice(0, 60)}…"`
				);
		}
	}

	const sc = countSentences(text);
	if (sc > cfg.maxSentences) add('WARN', where, `${sc} sentences (max ${cfg.maxSentences})`);
}

function lintCharacterFile(file) {
	const id = path.basename(file, '.json');
	const c = JSON.parse(fs.readFileSync(file, 'utf8'));
	const scan = (list, section) =>
		(list ?? []).forEach((a) => {
			const aid = a.id ?? a.name;
			if (a.caveat != null) lintText(a.caveat, `${id} ${section}/${aid}`);
			// canonicalAssumption retired 2026-07-20 (cA-fold) — characterLint
			// flags any lingering field; nothing to scan here anymore.
		});
	scan(c.abilities, 'abilities');
	scan(c.passives, 'passives');
	scan(c.constellations, 'constellations');
}

function lintProposalFile(file) {
	const p = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const v of p.verdicts ?? []) {
		const where = `${p.character} ${v.abilityId} [${v.verdict}]`;
		if (v.verdict === 'rewrite' || v.verdict === 'add') lintText(v.proposedText, where);
		if (v.verdict === 'implementDelete') {
			if (!v.fallbackRewrite) add('FAIL', where, 'implementDelete without fallbackRewrite');
			else lintText(v.fallbackRewrite, `${where} (fallback)`);
		}
		if (v.verdict === 'delete' && !v.demotedNotes?.length && !v.claimsLost?.length)
			add(
				'WARN',
				where,
				'delete with no demotedNotes and no claimsLost — content vanishes untracked'
			);
	}
}

const [mode, ...args] = process.argv.slice(2);
if (mode === '--live') {
	const files = args.length
		? args.map((id) => path.join(CHAR_DIR, `${id}.json`))
		: fs
				.readdirSync(CHAR_DIR)
				.filter((f) => f.endsWith('.json') && f !== 'blank.json')
				.map((f) => path.join(CHAR_DIR, f));
	files.forEach(lintCharacterFile);
} else if (mode === '--proposals') {
	if (!args.length) {
		console.error('usage: caveat-lint.mjs --proposals <file...>');
		process.exit(2);
	}
	args.forEach(lintProposalFile);
} else {
	console.error('usage: caveat-lint.mjs --live [charId...] | --proposals <file...>');
	process.exit(2);
}

for (const f of findings) console.log(`${f.level}  ${f.where}: ${f.msg}`);
const fails = findings.filter((f) => f.level === 'FAIL').length;
const warns = findings.length - fails;
console.log(`\n${fails} FAIL, ${warns} WARN`);
process.exit(fails ? 1 : 0);
