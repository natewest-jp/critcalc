#!/usr/bin/env node
/**
 * caveat-apply.mjs — applies a caveat-pass proposal file to its character JSON.
 *
 * Edits are format-preserving: jsonc-parser CST edits touch only the mutated
 * spans (character JSONs are hand-formatted with inlined short objects, which
 * a stringify round-trip would destroy). Safety net: after editing, the file
 * is re-parsed and deep-compared against an independently mutated object; any
 * mismatch aborts before write. Staleness guard: originalText must exactly
 * match the live value.
 *
 * Usage:
 *   node scripts/caveat-apply.mjs docs/curation/caveat-pass/proposals/<char>.json [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { modify, applyEdits } from 'jsonc-parser';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHAR_DIR = path.join(ROOT, 'src/lib/data/characters');
const FORMAT = { formattingOptions: { insertSpaces: false, eol: '\n' } };

const [proposalPath, flag] = process.argv.slice(2);
if (!proposalPath) {
	console.error('usage: caveat-apply.mjs <proposal.json> [--dry-run]');
	process.exit(2);
}
const dryRun = flag === '--dry-run';

const proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
const charFile = path.join(CHAR_DIR, `${proposal.character}.json`);
let text = fs.readFileSync(charFile, 'utf8');
const expected = JSON.parse(text); // mutated in parallel as the verification oracle

const errors = [];
const applied = [];

function locate(abilityId) {
	for (const section of ['abilities', 'passives', 'constellations']) {
		const idx = (expected[section] ?? []).findIndex((a) => (a.id ?? a.name) === abilityId);
		if (idx !== -1) return { section, idx, ability: expected[section][idx] };
	}
	return null;
}

function edit(jsonPath, value, opts) {
	text = applyEdits(text, modify(text, jsonPath, value, { ...FORMAT, ...opts }));
}

for (const v of proposal.verdicts ?? []) {
	const label = `${proposal.character}/${v.abilityId}`;
	const found = locate(v.abilityId);
	if (!found) {
		errors.push(`${label}: ability not found`);
		continue;
	}
	const { section, idx, ability } = found;
	const basePath = [section, idx];

	if (v.kind === 'canonicalAssumption') {
		let effPath;
		let effect;
		if (v.variant != null) {
			const vIdx = (ability.variants ?? []).findIndex((x) => x.label === v.variant);
			effect = ability.variants?.[vIdx]?.effects?.[v.effectIndex];
			effPath = [...basePath, 'variants', vIdx, 'effects', v.effectIndex];
		} else {
			effect = ability.effects?.[v.effectIndex];
			effPath = [...basePath, 'effects', v.effectIndex];
		}
		if (!effect?.canonicalAssumption) {
			errors.push(`${label}: canonicalAssumption at effect[${v.effectIndex}] not found`);
			continue;
		}
		if (effect.canonicalAssumption.caveat !== v.originalText) {
			errors.push(`${label}: STALE — live canonicalAssumption.caveat differs from originalText`);
			continue;
		}
		if (v.verdict === 'keep') {
			applied.push(`${label}: keep (canonicalAssumption)`);
		} else if (v.verdict === 'rewrite') {
			if (!v.proposedText?.trim()) {
				errors.push(`${label}: rewrite with empty proposedText`);
				continue;
			}
			effect.canonicalAssumption.caveat = v.proposedText;
			edit([...effPath, 'canonicalAssumption', 'caveat'], v.proposedText);
			applied.push(
				`${label}: rewrite canonicalAssumption (${v.originalText.length} → ${v.proposedText.length}ch)`
			);
		} else {
			// delete/implementDelete would violate the canonicalAssumption shape lint
			errors.push(`${label}: verdict "${v.verdict}" not allowed on canonicalAssumption`);
			continue;
		}
	} else {
		if (ability.caveat !== v.originalText) {
			errors.push(`${label}: STALE — live caveat differs from originalText`);
			continue;
		}
		switch (v.verdict) {
			case 'keep':
				applied.push(`${label}: keep`);
				break;
			case 'rewrite':
				if (!v.proposedText?.trim()) {
					errors.push(`${label}: rewrite with empty proposedText`);
					continue;
				}
				ability.caveat = v.proposedText;
				edit([...basePath, 'caveat'], v.proposedText);
				applied.push(`${label}: rewrite (${v.originalText.length} → ${v.proposedText.length}ch)`);
				break;
			case 'delete':
				delete ability.caveat;
				edit([...basePath, 'caveat'], undefined);
				applied.push(`${label}: delete`);
				break;
			case 'implementDelete':
				// Conservative path: ship the fallback rewrite now; the implement
				// wave re-authors the data and removes the caveat separately.
				if (!v.fallbackRewrite?.trim()) {
					errors.push(`${label}: implementDelete without fallbackRewrite`);
					continue;
				}
				ability.caveat = v.fallbackRewrite;
				edit([...basePath, 'caveat'], v.fallbackRewrite);
				applied.push(
					`${label}: implementDelete → fallback rewrite (${v.fallbackRewrite.length}ch)`
				);
				break;
			default:
				errors.push(`${label}: unknown verdict "${v.verdict}"`);
				continue;
		}
	}

	if (v.demotedNotes?.length) {
		const notes = v.demotedNotes.map((n) => (n.startsWith('[A7]') ? n : `[A7] ${n}`));
		if (ability._curatorNotes) {
			for (const n of notes) {
				edit([...basePath, '_curatorNotes', ability._curatorNotes.length], n, {
					isArrayInsertion: true
				});
				ability._curatorNotes.push(n);
			}
		} else {
			ability._curatorNotes = notes;
			edit([...basePath, '_curatorNotes'], notes);
		}
		applied.push(`${label}: +${notes.length} _curatorNotes`);
	}
}

if (errors.length) {
	console.error(`REFUSING TO APPLY — ${errors.length} error(s):`);
	errors.forEach((e) => console.error('  ' + e));
	process.exit(1);
}

// Verification net: the edited text must parse to exactly the expected object.
function deepEqual(a, b) {
	if (a === b) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	if (ka.length !== kb.length) return false;
	return ka.every((k) => deepEqual(a[k], b[k]));
}
let reparsed;
try {
	reparsed = JSON.parse(text);
} catch (e) {
	console.error('ABORT — edited text is not valid JSON: ' + e.message);
	process.exit(1);
}
if (!deepEqual(reparsed, expected)) {
	console.error('ABORT — edited text does not deep-equal the expected mutation result');
	process.exit(1);
}

for (const a of applied) console.log(a);

if (dryRun) {
	console.log('\n(dry run — no files written)');
	process.exit(0);
}

fs.writeFileSync(charFile, text);
// Normalize any spacing drift in the edited spans only; untouched text is byte-identical.
execFileSync('npx', ['prettier', '--write', charFile], { cwd: ROOT, stdio: 'pipe' });
const after = JSON.parse(fs.readFileSync(charFile, 'utf8'));
if (!deepEqual(after, expected)) {
	console.error('WARNING — post-prettier content drifted; inspect the diff');
	process.exit(1);
}
console.log(`\napplied → ${path.relative(ROOT, charFile)}`);
