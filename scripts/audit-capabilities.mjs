/**
 * scripts/audit-capabilities.mjs
 *
 * Capability coverage audit — keeps the Team Builder's capability facets
 * honest. Diffs what deriveCapabilities extracts from the character JSONs
 * against (a) the game-knowledge expectations fixture
 * (capability-expectations.mjs) and (b) internal consistency rules.
 * Every finding is a curation-backlog item, not a build failure.
 *
 *   node scripts/audit-capabilities.mjs            # stdout summary
 *   node scripts/audit-capabilities.mjs --write    # + docs/curation/capability-audit.md
 *
 * Imports TS modules via native type stripping (Node ≥22.18; .nvmrc pins 22).
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	buffFamilyOf,
	deriveCharacterCapabilities,
	summarizeCapabilities
} from '../src/lib/capabilities/deriveCapabilities.ts';
import { isCurated } from '../src/lib/utils/characterLint.ts';
import { EXPECTED } from './capability-expectations.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARACTERS_DIR = join(PROJECT_ROOT, 'src/lib/data/characters');
const OUT = join(PROJECT_ROOT, 'docs/curation/capability-audit.md');

// ---------------------------------------------------------------------------
// Load + derive
// ---------------------------------------------------------------------------

const characters = new Map();
for (const file of (await readdir(CHARACTERS_DIR)).filter((f) => f.endsWith('.json')).sort()) {
	const data = JSON.parse(await readFile(join(CHARACTERS_DIR, file), 'utf8'));
	if (!data.id || data.id === 'blank') continue;
	const derived = deriveCharacterCapabilities(data);
	characters.set(data.id, {
		data,
		curated: isCurated(data),
		capabilities: derived.capabilities,
		summary: summarizeCapabilities(derived.capabilities)
	});
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/** Findings grouped by section: [{ id, message, confidence? }] */
const findings = {
	fixtureMissing: [],
	fixtureGate: [],
	fixtureTarget: [],
	fixtureSource: [],
	fixtureUnknownId: [],
	derivedNotExpected: [],
	tagWithoutEffect: [],
	effectWithoutTag: [],
	todoCapabilities: [],
	curatedButEmpty: [],
	stubs: []
};

// --- fixture diff ---
for (const exp of EXPECTED) {
	const char = characters.get(exp.id);
	const flag = exp.confidence === 'check' ? ' ⚠️check' : '';
	if (!char) {
		findings.fixtureUnknownId.push({ id: exp.id, message: `fixture id not in roster` });
		continue;
	}
	// Buff expectations match by family (ally-facing only); others by kind.
	const matches = char.summary.filter((s) =>
		exp.kind === 'buff'
			? s.kind === 'buff' && s.target !== 'self' && s.detail && buffFamilyOf(s.detail) === exp.family
			: s.kind === exp.kind
	);
	const what = exp.kind === 'buff' ? `buff:${exp.family}` : exp.kind;
	if (matches.length === 0) {
		findings.fixtureMissing.push({
			id: exp.id,
			message: `expected ${what} (C${exp.minCon}) — nothing derives${flag}${exp.note ? ` — ${exp.note}` : ''}`
		});
		continue;
	}
	const best = Math.min(...matches.map((s) => s.minCon));
	const gateMismatch = best > exp.minCon;
	if (gateMismatch) {
		findings.fixtureGate.push({
			id: exp.id,
			message: `expected ${what} at C${exp.minCon}, derives only from C${best}${flag}${exp.note ? ` — ${exp.note}` : ''}`
		});
	}
	// Target check only when the gate matched — a gate mismatch already implies
	// the right source isn't curated, so a target diff adds noise, not signal.
	if (!gateMismatch && exp.target && !matches.some((s) => s.minCon <= exp.minCon && (s.target === exp.target || s.target === undefined))) {
		const seen = [...new Set(matches.map((s) => s.target ?? 'untargeted'))].join(', ');
		findings.fixtureTarget.push({
			id: exp.id,
			message: `expected ${exp.kind} target=${exp.target}, derived targets: ${seen}${flag}`
		});
	}
	if (exp.fromAbilityType) {
		const marker = `__${exp.fromAbilityType}__`;
		const fromSource = char.capabilities.some(
			(c) =>
				(exp.kind === 'buff'
					? c.kind === 'buff' && c.detail && buffFamilyOf(c.detail) === exp.family
					: c.kind === exp.kind) && c.source.abilityId.includes(marker)
		);
		if (!fromSource) {
			findings.fixtureSource.push({
				id: exp.id,
				message: `expected ${what} sourced from ${exp.fromAbilityType} — not derived from it${flag}${exp.note ? ` — ${exp.note}` : ''}`
			});
		}
	}
}

// --- derived headline capabilities the fixture doesn't know about ---
const expectedKeys = new Set(EXPECTED.map((e) => `${e.id}|${e.kind}`));
for (const [id, char] of characters) {
	for (const s of char.summary) {
		if (!['heal', 'shield', 'offFieldDamage'].includes(s.kind)) continue;
		if (s.target === 'self') continue; // fixture scope is team-facing
		if (!expectedKeys.has(`${id}|${s.kind}`)) {
			findings.derivedNotExpected.push({
				id,
				message: `derives ${s.kind}${s.detail ? `(${s.detail})` : ''} C${s.minCon}${s.target ? ` → ${s.target}` : ''} — absent from fixture (fixture blind spot, or data artifact?)`
			});
		}
	}
}

// --- tag/effect cross-checks (per ability with cast effects in scope) ---
for (const [id, char] of characters) {
	for (const ability of char.data.abilities ?? []) {
		const tags = ability.tags ?? [];
		const own = char.capabilities.filter((c) => c.source.abilityId === ability.id);
		for (const tagKind of ['heal', 'shield']) {
			const tagged = tags.includes(tagKind);
			const hasEffect = own.some((c) => c.kind === tagKind && c.via === 'effect');
			if (tagged && !hasEffect) {
				findings.tagWithoutEffect.push({
					id,
					message: `${ability.id} tagged '${tagKind}' but no ${tagKind} effect authored (target/scaling unknown to tools)`
				});
			} else if (!tagged && hasEffect) {
				findings.effectWithoutTag.push({
					id,
					message: `${ability.id} has a ${tagKind} effect but lacks the '${tagKind}' tag`
				});
			}
		}
	}
}

// --- capabilities hiding in _todo stubs ---
const TODO_CAPABILITY = /heal|shield|regenerat/i;
for (const [id, char] of characters) {
	const walk = (node, trail) => {
		if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${trail}[${i}]`));
		if (!node || typeof node !== 'object') return;
		if (typeof node._todo === 'string' && TODO_CAPABILITY.test(node._todo)) {
			findings.todoCapabilities.push({ id, message: `_todo mentions a capability: "${node._todo.slice(0, 100)}"` });
		}
		for (const v of Object.values(node)) if (typeof v === 'object') walk(v, trail);
	};
	walk(char.data.abilities, 'abilities');
	walk(char.data.passives, 'passives');
	walk(char.data.constellations, 'constellations');
}

// --- roster hygiene ---
for (const [id, char] of characters) {
	if (!char.curated) findings.stubs.push({ id, message: 'uncurated stub (no frame data) — Team Builder shows it under "not yet curated"' });
	else if (char.summary.length === 0) findings.curatedButEmpty.push({ id, message: 'frame-curated but zero capabilities derive — plausible for selfish DPS kits; verify' });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const SECTIONS = [
	['fixtureMissing', 'Expected capability missing entirely', 'Highest priority — the facet answers "no" where the game says "yes".'],
	['fixtureGate', 'Constellation gate later than in-game', 'The facet under-reports availability.'],
	['fixtureTarget', 'Target mismatch', 'Derived beneficiary differs from in-game behavior.'],
	['fixtureSource', 'Expected source ability not curated', 'Capability derives, but not from the ability that actually carries it in-game — provenance display will mislead.'],
	['derivedNotExpected', 'Derived but not in fixture', 'Either a fixture blind spot (fine — extend the fixture) or a data artifact worth a look.'],
	['tagWithoutEffect', 'Tag without effect', 'Informational: facet works, but no target/scaling data for the detail card.'],
	['effectWithoutTag', 'Effect without tag', 'Add the tag for consistency.'],
	['todoCapabilities', 'Capabilities hiding in _todo stubs', 'Underivable until curated.'],
	['curatedButEmpty', 'Frame-curated, zero capabilities', 'Verify these kits genuinely offer nothing team-facing.'],
	['stubs', 'Uncurated stubs', 'Excluded from capability trust; shown honestly in the UI.'],
	['fixtureUnknownId', 'Fixture ids not in roster', 'Fix the fixture.']
];

let total = 0;
const lines = [
	'# Capability Coverage Audit',
	'',
	'Generated by `node scripts/audit-capabilities.mjs --write`. Regenerate after curation work;',
	'do not edit by hand. Ground truth lives in `scripts/capability-expectations.mjs` —',
	'**review that fixture** (authored from game knowledge, flagged entries first).',
	'',
	'This is the Team Builder curation backlog: each finding is a place where the',
	'capability facets would answer differently from the game.',
	''
];
for (const [key, title, blurb] of SECTIONS) {
	const items = findings[key];
	lines.push(`## ${title} (${items.length})`, '', blurb, '');
	total += items.length;
	for (const f of items) lines.push(`- **${f.id}** — ${f.message}`);
	if (items.length === 0) lines.push('- _none_');
	lines.push('');
}

console.log(`capability audit: ${total} findings`);
for (const [key, title] of SECTIONS) console.log(`  ${String(findings[key].length).padStart(3)}  ${title}`);

if (process.argv.includes('--write')) {
	await writeFile(OUT, lines.join('\n'));
	console.log(`wrote ${OUT}`);
} else {
	console.log('(run with --write to emit docs/curation/capability-audit.md)');
}
