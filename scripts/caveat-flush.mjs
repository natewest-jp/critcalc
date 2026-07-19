#!/usr/bin/env node
/**
 * caveat-flush.mjs — writes audit-agent proposals from a workflow journal to
 * docs/curation/caveat-pass/proposals/ and advances the ledger.
 *
 * Validates every verdict's originalText against the live character JSON
 * (early staleness check) so a bad audit is caught before verification.
 *
 * Usage:
 *   node scripts/caveat-flush.mjs <wave-number> <journal.jsonl>
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PASS_DIR = path.join(ROOT, 'docs/curation/caveat-pass');

const [waveArg, journalPath] = process.argv.slice(2);
if (!waveArg || !journalPath) {
	console.error('usage: caveat-flush.mjs <wave-number> <journal.jsonl>');
	process.exit(2);
}

const results = fs
	.readFileSync(journalPath, 'utf8')
	.trim()
	.split('\n')
	.map((l) => JSON.parse(l))
	.filter((l) => l.type === 'result')
	.map((r) => r.result)
	.filter((p) => p && p.character && Array.isArray(p.verdicts));

let problems = 0;
for (const p of results) {
	p.wave = Number(waveArg);
	const charPath = path.join(ROOT, `src/lib/data/characters/${p.character}.json`);
	const char = JSON.parse(fs.readFileSync(charPath, 'utf8'));
	const all = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
	for (const v of p.verdicts) {
		const a = all.find((x) => (x.id ?? x.name) === v.abilityId);
		if (!a) {
			console.log(`MISSING ability: ${p.character}/${v.abilityId}`);
			problems++;
			continue;
		}
		const live =
			v.kind === 'canonicalAssumption'
				? (v.variant ? a.variants?.find((x) => x.label === v.variant)?.effects : a.effects)?.[
						v.effectIndex
					]?.canonicalAssumption?.caveat
				: a.caveat;
		if (live !== v.originalText) {
			console.log(`STALE originalText: ${p.character}/${v.abilityId} (${v.kind})`);
			problems++;
		}
	}
	fs.writeFileSync(
		path.join(PASS_DIR, `proposals/${p.character}.json`),
		JSON.stringify(p, null, '\t') + '\n'
	);
}

const ledgerPath = path.join(PASS_DIR, 'ledger.json');
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const wave = ledger.waves[waveArg];
for (const p of results) {
	if (wave.characters[p.character]) wave.characters[p.character].stage = 'proposed';
	else console.log(`WARNING: ${p.character} not in wave ${waveArg} roster`);
}
wave.status = 'in_progress';
fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, '\t') + '\n');

const expected = Object.keys(wave.characters).length;
console.log(
	`flushed ${results.length}/${expected} proposals for wave ${waveArg}; ${problems} staleness problems`
);
for (const p of results)
	console.log(`  ${p.character}: ${p.verdicts.map((v) => v.verdict).join(', ')}`);
process.exit(problems ? 1 : 0);
