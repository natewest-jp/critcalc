/**
 * scripts/audit-genshin-db-diff.mjs
 *
 * Method #1 — genshin-db numeric differential.
 *
 * We INGEST character data from the `genshin-db` devDependency (see
 * scripts/ingest-character.mjs), but nothing re-checks the stored numbers
 * against it after hand-curation. This script regenerates the genshin-db
 * "authoritative" stub for every corpus character and diffs the reliable
 * scalars — energyCost, cooldown — plus identity (element/weapon/rarity)
 * against our shipped JSON. Every diff is a REVIEW CANDIDATE, not an
 * auto-fix: curated data legitimately diverges (Hold-E CDs, modeled
 * effective cooldowns), but a mismatch is exactly where to look for
 * transcription drift, fat-fingers, and values gone stale after a patch.
 *
 *   node scripts/audit-genshin-db-diff.mjs           # report to stdout
 *   node scripts/audit-genshin-db-diff.mjs --write    # + docs/curation/genshin-db-diff.md
 *
 * NOT checked here (deliberately):
 *   - duration: genshin-db's talent "duration" label is unreliable (burst
 *     durations come back as 1s); curators author durations from summons/kit.
 *   - talent scaling values: no clean label→effect mapping (see the outlier
 *     sweep, audit-data-outliers.mjs, for the self-consistency angle).
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStub } from './ingest-character.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARACTERS_DIR = join(PROJECT_ROOT, 'src/lib/data/characters');
const OUT = join(PROJECT_ROOT, 'docs/curation/genshin-db-diff.md');

const EPS = 1e-6;
const near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < EPS;

/** Find the corpus ability that corresponds to a genshin-db stub ability:
 *  exact id first (curators rarely rename). On a slug miss (punctuation
 *  differences) fall back within the same abilityType — but PREFER the
 *  primary cast (base E/Q input with a real cooldown) over stance/chain
 *  sub-abilities, so we don't diff genshin-db's skill CD against a cd=0
 *  Feathermoon-Ring stub. Returns null if the character has none. */
function matchAbility(ours, gdbAbility) {
	const byId = ours.find((a) => a.id === gdbAbility.id);
	if (byId) return byId;
	const sameType = ours.filter((a) => a.abilityType === gdbAbility.abilityType);
	if (sameType.length <= 1) return sameType[0] ?? null;
	const base = gdbAbility.abilityType === 'skill' ? 'E' : 'Q';
	const primary = sameType.find(
		(a) => (a.input ?? []).includes(base) && typeof a.cooldown === 'number' && a.cooldown > 0
	);
	if (primary) return primary;
	return sameType.find((a) => typeof a.cooldown === 'number' && a.cooldown > 0) ?? sameType[0];
}

/** genshin-db's scalarFromLabels grabs the FIRST number from a CD label; when
 *  the label is multi-valued (tap/hold, or a mechanic with two timers), the
 *  extracted CD is unreliable. buildStub records this in _curatorNotes — detect
 *  it so we can downgrade the resulting mismatch. */
function gdbCdIsUnreliable(gdb, abilityName) {
	return (gdb._curatorNotes ?? []).some(
		(n) => n.startsWith(`${abilityName}:`) && /multi-valued/.test(n)
	);
}

/** Ability IDs where OUR cooldown is verified against gcsim and genshin-db is
 *  the one that's wrong (genshin-db CD data lags/errs for newer characters).
 *  Annotated + downgraded so they don't re-surface as open items. RE-VERIFY
 *  against ~/Code/gcsim if genshin-db is bumped (`npm update genshin-db`). */
const GDB_CD_KNOWN_WRONG = new Map([
	[
		'flins__skill__ancient_rite_arcane_light',
		'gcsim skill.go SetCDWithDelay 16*60=16s (verified 2026-07-16)'
	],
	[
		'flins__burst__ancient_ritual_cometh_the_night',
		'gcsim burst.go SetCD 15*60=15s (verified 2026-07-16)'
	],
	[
		'jahoda__skill__savvy_strategy_splitting_the_spoils',
		'gcsim skill.go cancelPursuit SetCD(skillCD+skillWindup) = 15*60+30 = 15.5s, started at stance end (verified 2026-09-17)'
	]
]);

const findings = []; // {char, severity, kind, detail}
const skipped = [];

const files = (await readdir(CHARACTERS_DIR)).filter((f) => f.endsWith('.json'));

for (const file of files) {
	const c = JSON.parse(await readFile(join(CHARACTERS_DIR, file), 'utf8'));
	let gdb;
	try {
		gdb = buildStub(c.name);
	} catch (e) {
		skipped.push({ id: c.id, reason: e.message.split('\n')[0] });
		continue;
	}

	// --- identity (should never differ; a diff means ingest-time drift) ---
	for (const field of ['element', 'weapon', 'rarity']) {
		const mine = c[field];
		const theirs = gdb[field];
		if (mine !== undefined && theirs !== undefined && String(mine) !== String(theirs)) {
			findings.push({
				char: c.id,
				severity: 'HIGH',
				kind: 'identity',
				detail: `${field}: ours="${mine}" vs genshin-db="${theirs}"`
			});
		}
	}

	// --- scalar combat fields on skill/burst abilities ---
	for (const g of gdb.abilities) {
		const mine = matchAbility(c.abilities ?? [], g);
		if (!mine) continue;

		// energyCost — genshin-db is very reliable here (burst energy)
		if (g.energyCost !== undefined) {
			if (mine.energyCost === undefined) {
				findings.push({
					char: c.id,
					severity: 'LOW',
					kind: 'energy-missing',
					detail: `${mine.id}: genshin-db has energyCost=${g.energyCost}, ours unset`
				});
			} else if (!near(mine.energyCost, g.energyCost)) {
				findings.push({
					char: c.id,
					severity: 'HIGH',
					kind: 'energy-mismatch',
					detail: `${mine.id}: energyCost ours=${mine.energyCost} vs genshin-db=${g.energyCost}`
				});
			}
		}

		// cooldown — reliable, but curated data may model an effective CD or
		// push the base CD onto a variant, so treat as MEDIUM review candidate
		if (g.cooldown !== undefined) {
			const variantCds = (mine.variants ?? [])
				.map((v) => v.cooldown)
				.filter((v) => v !== undefined);
			if (mine.cooldown === undefined) {
				// only interesting if no variant carries a CD either
				if (variantCds.length === 0) {
					findings.push({
						char: c.id,
						severity: 'LOW',
						kind: 'cd-missing',
						detail: `${mine.id}: genshin-db has cooldown=${g.cooldown}, ours unset (no variant CD)`
					});
				}
			} else if (!near(mine.cooldown, g.cooldown)) {
				// suppress if a variant matches genshin-db exactly (Tap/Hold split)
				const variantMatches = variantCds.some((v) => near(v, g.cooldown));
				const unreliable = gdbCdIsUnreliable(gdb, g.name);
				const knownWrong = GDB_CD_KNOWN_WRONG.get(mine.id);
				findings.push({
					char: c.id,
					severity: variantMatches || unreliable || knownWrong ? 'LOW' : 'MEDIUM',
					kind: 'cd-mismatch',
					detail:
						`${mine.id}: cooldown ours=${mine.cooldown} vs genshin-db=${g.cooldown}` +
						(variantMatches ? ` (a variant CD matches genshin-db)` : '') +
						(unreliable ? ` (genshin-db CD label multi-valued — extraction unreliable)` : '') +
						(knownWrong ? ` (OURS VERIFIED — genshin-db wrong: ${knownWrong})` : '')
				});
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
findings.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.char.localeCompare(b.char));

const bySev = (s) => findings.filter((f) => f.severity === s);
const lines = [];
lines.push('# genshin-db Numeric Differential');
lines.push('');
lines.push('Generated by `node scripts/audit-genshin-db-diff.mjs`. Diffs shipped character JSON');
lines.push('against a freshly-regenerated genshin-db stub. Each row is a REVIEW CANDIDATE —');
lines.push('curated data legitimately diverges; a mismatch is where to look.');
lines.push('');
lines.push(
	`Scanned ${files.length} characters — ${skipped.length} skipped (traveler/custom), ` +
		`${findings.length} findings (${bySev('HIGH').length} HIGH / ${bySev('MEDIUM').length} MEDIUM / ${bySev('LOW').length} LOW).`
);
lines.push('');

for (const sev of ['HIGH', 'MEDIUM', 'LOW']) {
	const group = bySev(sev);
	lines.push(`## ${sev} (${group.length})`);
	if (sev === 'HIGH')
		lines.push('_Identity or burst-energy mismatch — genshin-db is authoritative here._');
	if (sev === 'MEDIUM')
		lines.push(
			'_Cooldown mismatch — verify which value the game uses (may be a curator correction)._'
		);
	if (sev === 'LOW')
		lines.push('_Field present in genshin-db, unset or variant-explained in ours — usually fine._');
	lines.push('');
	if (group.length === 0) lines.push('- _none_');
	for (const f of group) lines.push(`- **${f.char}** — [${f.kind}] ${f.detail}`);
	lines.push('');
}

if (skipped.length) {
	lines.push(`## Skipped (${skipped.length})`);
	for (const s of skipped) lines.push(`- ${s.id} — ${s.reason}`);
	lines.push('');
}

const report = lines.join('\n');
console.log(report);

if (process.argv.includes('--write')) {
	await mkdir(dirname(OUT), { recursive: true });
	await writeFile(OUT, report + '\n');
	console.error(`\n[audit] wrote ${OUT.replace(PROJECT_ROOT + '/', '')}`);
}
