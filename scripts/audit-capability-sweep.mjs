/**
 * scripts/audit-capability-sweep.mjs
 *
 * The external-axes capability sweep — the launch-closing data check. Diffs
 * what deriveCapabilities extracts from the character JSONs against two
 * external truths:
 *
 *   Axis A — Genshin Fandom wiki capability categories (committed snapshot,
 *            docs/library/wiki/capability-categories.json; refresh via
 *            fetch-wiki-capabilities.mjs). Direction semantics per category
 *            group live in wiki-capability-config.mjs.
 *   Axis B — Genshin's own Imaginarium Theater roles (characterRoles
 *            .generated.ts): a `survivability`/`support` function must be
 *            backed by at least one capability in its FUNCTION_FACETS group.
 *
 * Runs fully OFFLINE from the snapshot. Every finding is a REVIEW CANDIDATE,
 * never an auto-fix (the audit-genshin-db-diff law): curated data legitimately
 * diverges, and the wiki is sometimes wrong — verified-wrong rows are
 * suppressed via WIKI_KNOWN_WRONG with evidence notes.
 *
 *   node scripts/audit-capability-sweep.mjs            # stdout summary
 *   node scripts/audit-capability-sweep.mjs --write    # + docs/curation/capability-sweep.md
 *   node scripts/audit-capability-sweep.mjs --mutate qiqi:heal
 *       # seeded-negative self-test: drop a kind in-memory (no file edits) and
 *       # confirm the sweep catches it. Validated 2026-07-28: baizhu:heal →
 *       # +1 wiki-missing; qiqi:heal → +1 role-unbacked; diona:heal → no role
 *       # finding (her shield still backs survivability — correct).
 *
 * Imports TS modules via native type stripping (Node ≥22.18; .nvmrc pins 22).
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	FUNCTION_FACETS,
	capMatchesFacet,
	deriveCharacterCapabilities,
	summarizeCapabilities
} from '../src/lib/capabilities/deriveCapabilities.ts';
import { isCurated } from '../src/lib/utils/characterLint.ts';
import { characterRoles } from '../src/lib/data/characterRoles.generated.ts';
import { CATEGORY_GROUPS, WIKI_KNOWN_WRONG } from './wiki-capability-config.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARACTERS_DIR = join(PROJECT_ROOT, 'src/lib/data/characters');
const SNAPSHOT = join(PROJECT_ROOT, 'docs/library/wiki/capability-categories.json');
const OUT = join(PROJECT_ROOT, 'docs/curation/capability-sweep.md');

const mutateArg = process.argv.indexOf('--mutate');
const MUTATE =
	mutateArg > -1 && process.argv[mutateArg + 1] ? process.argv[mutateArg + 1].split(':') : null;

// ---------------------------------------------------------------------------
// Load: corpus + derivation, snapshot, roles
// ---------------------------------------------------------------------------

const snapshot = JSON.parse(await readFile(SNAPSHOT, 'utf8'));

const characters = new Map();
for (const file of (await readdir(CHARACTERS_DIR)).filter((f) => f.endsWith('.json')).sort()) {
	const data = JSON.parse(await readFile(join(CHARACTERS_DIR, file), 'utf8'));
	if (!data.id || data.id === 'blank') continue;
	let caps = deriveCharacterCapabilities(data).capabilities;
	if (MUTATE && data.id === MUTATE[0]) caps = caps.filter((c) => c.kind !== MUTATE[1]);
	characters.set(data.id, {
		data,
		curated: isCurated(data),
		capabilities: caps,
		summary: summarizeCapabilities(caps)
	});
}

/** Capability-unknown = nothing derives AND frameless — genuine stubs whose
 *  absence-of-capability can't be trusted (same rule the Team Builder gates
 *  on, facets.ts isCapabilityUnknown). Frameless chars WITH authored effects
 *  (illuga, kachina, …) have checkable data and stay in scope. */
const excluded = [...characters.entries()]
	.filter(([, c]) => c.summary.length === 0 && !c.curated)
	.map(([id]) => id);
const inScope = new Set([...characters.keys()].filter((id) => !excluded.includes(id)));

// ---------------------------------------------------------------------------
// Wiki presence per character per group
// ---------------------------------------------------------------------------

/** charId → kind → [{title, leaf, sourceClass, constellationLevel?, noAbility}] */
const wikiPresence = new Map();
const mappingProblems = [];

function leavesOf(group) {
	return group.categories.flatMap((c) => [c.name, ...(snapshot.subcats?.[c.name] ?? [])]);
}

for (const group of CATEGORY_GROUPS) {
	for (const leaf of leavesOf(group)) {
		const members = snapshot.categories[leaf];
		if (members === undefined) {
			mappingProblems.push(`category "${leaf}" absent from snapshot — refetch?`);
			continue;
		}
		const sourceClass = /Constellations$/.test(leaf) ? 'constellation' : 'base';
		for (const title of members) {
			const entries = snapshot.resolutions[title];
			if (!entries || entries.length === 0) {
				mappingProblems.push(`"${title}" (${leaf}) unresolved — add a TITLE_OVERRIDE`);
				continue;
			}
			for (const r of entries) {
				if (r.via === 'manual-ignore' || !r.charId) continue;
				if (!wikiPresence.has(r.charId)) wikiPresence.set(r.charId, new Map());
				const byKind = wikiPresence.get(r.charId);
				if (!byKind.has(group.kind)) byKind.set(group.kind, []);
				byKind.get(group.kind).push({
					title,
					leaf,
					sourceClass: r.section === 'constellation' ? 'constellation' : sourceClass,
					constellationLevel: r.constellationLevel,
					noAbility: r.via === 'infobox-noAbility'
				});
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Our-side presence per kind
// ---------------------------------------------------------------------------

/** Summaries matching a config kind. Wiki categories don't distinguish
 *  targets (self-heals are Healing Talents too), so no target filter here —
 *  targets are printed on the finding line for the reviewer. */
function oursFor(char, kind) {
	if (kind === 'interruptionRes')
		return char.summary.filter((s) => s.kind === 'buff' && s.detail === 'interruptionRes');
	return char.summary.filter((s) => s.kind === kind);
}

const fmtCap = (s) =>
	`${s.kind}${s.detail ? `(${s.detail})` : ''}${s.target ? `→${s.target}` : ''} C${s.minCon}`;
const fmtWiki = (w) =>
	`"${w.title}"${w.leaf.match(/Constellations$/) || w.sourceClass === 'constellation' ? ` [C${w.constellationLevel ?? '?'}]` : ''}${w.noAbility ? ' (talent absent from our JSON)' : ''}`;

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

const findings = {
	wikiMissing: [], // wiki-has / we-don't (finding-grade groups)
	gate: [], // both have it; constellation gate disagrees
	wikiExtra: [], // we-have / wiki-doesn't
	roleUnbacked: [], // survivability/support function with no backing facet
	roleConGated: [], // role backed only at C>0 (informational)
	offFieldDiff: [], // Off-Field Characters vs roles CSV (informational)
	revival: [], // revival talents without heal cap or revival note (informational)
	candidates: [], // candidate-grade wiki-has / we-don't (appendix)
	suppressed: []
};

function report(bucket, key, id, message) {
	const known = key && WIKI_KNOWN_WRONG.get(key);
	if (known) findings.suppressed.push({ id, message: `${message} — VERIFIED: ${known}` });
	else findings[bucket].push({ id, message });
}

// --- Axis A: wiki category diff -------------------------------------------

for (const group of CATEGORY_GROUPS) {
	if (group.special) continue;
	for (const id of inScope) {
		const char = characters.get(id);
		const wiki = wikiPresence.get(id)?.get(group.kind) ?? [];
		const ours = oursFor(char, group.kind);

		if (wiki.length > 0 && ours.length === 0) {
			const bucket = group.missing === 'finding' ? 'wikiMissing' : 'candidates';
			report(
				bucket,
				`${id}|${group.kind}|missing`,
				id,
				`wiki attributes ${group.kind} (${wiki.map(fmtWiki).join(', ')}) — nothing derives`
			);
		} else if (wiki.length === 0 && ours.length > 0 && group.extra === 'finding') {
			report(
				'wikiExtra',
				`${id}|${group.kind}|extra`,
				id,
				`derives ${ours.map(fmtCap).join(', ')} — absent from the wiki's ${group.kind} categories (over-derivation, or a wiki gap)`
			);
		} else if (wiki.length > 0 && ours.length > 0) {
			// Gate cross-check — the first external validation of minConstellation.
			const ourMin = Math.min(...ours.map((s) => s.minCon));
			const wikiBase = wiki.some((w) => w.sourceClass === 'base');
			const wikiConLevels = wiki
				.filter((w) => w.sourceClass === 'constellation' && w.constellationLevel !== undefined)
				.map((w) => w.constellationLevel);
			if (wikiBase && ourMin > 0) {
				report(
					'gate',
					`${id}|${group.kind}|gate`,
					id,
					`wiki has base-kit ${group.kind} (${wiki
						.filter((w) => w.sourceClass === 'base')
						.map(fmtWiki)
						.join(', ')}) but ours gates at C${ourMin} — facet under-reports`
				);
			} else if (!wikiBase && wikiConLevels.length > 0) {
				const wikiMin = Math.min(...wikiConLevels);
				if (ourMin < wikiMin) {
					report(
						'gate',
						`${id}|${group.kind}|gate`,
						id,
						`ours derives ${group.kind} at C${ourMin} but the wiki's only sources are C${wikiMin}+ (${wiki.map(fmtWiki).join(', ')}) — over-derivation, or a base-kit source the wiki missed`
					);
				}
			}
		}
	}
}

// --- Axis A specials -------------------------------------------------------

for (const group of CATEGORY_GROUPS) {
	if (group.special === 'revival') {
		for (const [id, byKind] of wikiPresence) {
			const wiki = byKind.get(group.kind) ?? [];
			if (wiki.length === 0 || !inScope.has(id)) continue;
			const char = characters.get(id);
			const hasHeal = char.summary.some((s) => s.kind === 'heal');
			const mentionsRevival = JSON.stringify(char.data).match(/reviv/i) !== null;
			if (!hasHeal && !mentionsRevival) {
				report(
					'revival',
					`${id}|revival|missing`,
					id,
					`wiki lists a revival talent (${wiki.map(fmtWiki).join(', ')}) — no heal capability and no revival caveat/note (no revive primitive: expected outcome is a caveat)`
				);
			}
		}
	}
	if (group.special === 'characters') {
		const wikiOffField = new Set(
			[...wikiPresence.entries()].filter(([, byKind]) => byKind.has(group.kind)).map(([id]) => id)
		);
		for (const id of characters.keys()) {
			const csvOffField = characterRoles[id]?.position.includes('offField') ?? false;
			if (wikiOffField.has(id) && !csvOffField) {
				findings.offFieldDiff.push({
					id,
					message: `wiki classes it Off-Field; the roles CSV says onField-only (editorial call — informational, the CSV is not corrected from the wiki)`
				});
			} else if (csvOffField && !wikiOffField.has(id) && inScope.has(id)) {
				findings.offFieldDiff.push({
					id,
					message: `roles CSV says offField; absent from the wiki's Off-Field Characters category (informational)`
				});
			}
		}
	}
}

// --- Axis B: roles → capability backing ------------------------------------

for (const id of inScope) {
	const char = characters.get(id);
	const roles = characterRoles[id];
	if (!roles) continue;
	for (const fn of ['support', 'survivability']) {
		if (!roles.function.includes(fn)) continue;
		const facets = FUNCTION_FACETS[fn];
		const backedAt = (conCap) =>
			facets.some((f) => char.summary.some((s) => capMatchesFacet(s, f) && s.minCon <= conCap));
		if (!backedAt(6)) {
			report(
				'roleUnbacked',
				`${id}|role|${fn}`,
				id,
				`Genshin classes it ${fn} — no ${fn} facet (${facets.join(', ')}) derives at any constellation`
			);
		} else if (!backedAt(0)) {
			const backing = char.summary.filter((s) => facets.some((f) => capMatchesFacet(s, f)));
			findings.roleConGated.push({
				id,
				message: `${fn} role backed only from C${Math.min(...backing.map((s) => s.minCon))} (${backing.map(fmtCap).join(', ')}) — roles are per-character, worth one eyeball`
			});
		}
	}
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const SECTIONS = [
	[
		'wikiMissing',
		'Wiki-attributed capability we don’t derive',
		'Highest priority — the wiki says this kit does something our facets deny. Triage: (a) real gap → effect/tag fix; (b) unmodelable under the schema freeze → caveat; (c) wiki wrong → WIKI_KNOWN_WRONG with evidence.'
	],
	[
		'gate',
		'Constellation gate disagrees with the wiki',
		'First external check of minConstellation provenance.'
	],
	[
		'wikiExtra',
		'We derive it; the wiki doesn’t list it',
		'Over-derivation candidate OR a wiki gap — verify against gcsim/kit text before touching data.'
	],
	[
		'roleUnbacked',
		'Genshin role with no backing capability',
		'Genshin’s own role classification implies a capability our derivation can’t see.'
	],
	[
		'roleConGated',
		'Role backed only at C>0',
		'Informational — Imaginarium roles are per-character; a constellation-gated backing deserves one look, not an alarm.'
	],
	[
		'offFieldDiff',
		'Off-Field classification differences',
		'Informational — wiki Off-Field Characters vs the editorial roles CSV. The CSV is never corrected from the wiki.'
	],
	[
		'revival',
		'Revival talents without a trace',
		'No revive primitive exists (Tier-2 freeze) — each of these should carry a caveat or curator note.'
	],
	[
		'candidates',
		'Candidates (wiki category broader than our kind)',
		'Appendix — wiki-has/we-don’t for superset categories (energy incl. particles, self-infusions, self interruption res). Judgment required; most are fine.'
	],
	[
		'suppressed',
		'Suppressed (verified)',
		'Findings verified wrong on the wiki side (or verified fine on ours) — evidence in WIKI_KNOWN_WRONG.'
	]
];

for (const key of Object.keys(findings))
	findings[key].sort((a, b) => a.id.localeCompare(b.id) || a.message.localeCompare(b.message));

const lines = [
	'# Capability Sweep — external axes',
	'',
	'Generated by `node scripts/audit-capability-sweep.mjs --write`; wiki data from the committed',
	'snapshot `docs/library/wiki/capability-categories.json` (refresh: `node scripts/fetch-wiki-capabilities.mjs`).',
	'Do not edit by hand. Companion to `capability-audit.md` (the internal fixture audit).',
	'',
	`Snapshot fetched ${snapshot.fetchedAt?.slice(0, 10)}. Scanned ${inScope.size} characters ` +
		`(${excluded.length} capability-unknown stubs excluded: ${excluded.join(', ')}).`,
	'',
	'Out of scope v1 (recorded decision, Nate 2026-07-28): wiki buff-increase categories',
	'(ATK/DMG/EM/CRIT/Party buffs — covered by the expectations fixture + the A6 rigor pass),',
	'Shield Strength / Healing Bonus improvement categories, and `cleanse` (no wiki category exists;',
	'fixture-only). Sanity counts per category group:',
	''
];

for (const group of CATEGORY_GROUPS) {
	const wikiChars = new Set(
		[...wikiPresence.entries()].filter(([, k]) => k.has(group.kind)).map(([id]) => id)
	);
	const ourChars = group.special
		? null
		: [...inScope].filter((id) => oursFor(characters.get(id), group.kind).length > 0);
	lines.push(
		`- ${group.kind}: wiki ${wikiChars.size} characters${ourChars ? ` / ours ${ourChars.length}` : ''}`
	);
}
lines.push('');

if (mappingProblems.length) {
	lines.push(`## ⚠ Mapping health (${mappingProblems.length})`, '');
	lines.push('Findings below are untrustworthy until this section is empty.', '');
	for (const p of mappingProblems) lines.push(`- ${p}`);
	lines.push('');
}

let total = 0;
for (const [key, title, blurb] of SECTIONS) {
	const items = findings[key];
	lines.push(`## ${title} (${items.length})`, '', blurb, '');
	if (!['roleConGated', 'offFieldDiff', 'candidates', 'suppressed'].includes(key))
		total += items.length;
	for (const f of items) lines.push(`- **${f.id}** — ${f.message}`);
	if (items.length === 0) lines.push('- _none_');
	lines.push('');
}

console.log(
	`capability sweep: ${total} actionable findings` +
		(mappingProblems.length ? ` (⚠ ${mappingProblems.length} mapping problems)` : '')
);
for (const [key, title] of SECTIONS)
	console.log(`  ${String(findings[key].length).padStart(3)}  ${title}`);

if (process.argv.includes('--write')) {
	await writeFile(OUT, lines.join('\n'));
	console.log(`wrote ${OUT.replace(PROJECT_ROOT + '/', '')}`);
} else {
	console.log('(run with --write to emit docs/curation/capability-sweep.md)');
}
