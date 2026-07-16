/**
 * scripts/audit-data-outliers.mjs
 *
 * Method #2 — corpus self-consistency / outlier sweep.
 *
 * Needs NO external oracle: it flags values that contradict our own
 * conventions or sit far from their peers. Catches the classes that pass the
 * schema lint but are almost certainly wrong:
 *
 *   - decimal-form leak: a percentage-stat buff stored as 0.225 instead of
 *     22.5 (CLAUDE.md's "store 22.5 not 0.225" convention). NEAR-CERTAIN bug.
 *   - placeholder zeros: a damage/heal/shield with 0% scaling and no flat.
 *   - out-of-range: resShred outside (0,100], negative buffs, duration <= 0.
 *   - magnitude outliers: a value many MADs from its (type, stat) peers —
 *     e.g. a CRIT DMG buff of 200 among peers of 20-60. Soft "review" tier.
 *   - structural: duplicate ability ids, cooldown <= 0 on a real skill/burst.
 *
 * Read-only. `--write` saves docs/curation/data-outliers.md.
 *
 *   node scripts/audit-data-outliers.mjs
 *   node scripts/audit-data-outliers.mjs --write
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARACTERS_DIR = join(PROJECT_ROOT, 'src/lib/data/characters');
const OUT = join(PROJECT_ROOT, 'docs/curation/data-outliers.md');

// Stats stored as WHOLE percentage points (22.5 = "+22.5%"). A plain-number
// value in (0,1) on one of these is almost always a decimal-form leak.
const FLAT_STATS = new Set([
	'atk',
	'baseAtk',
	'em',
	'hp',
	'def',
	'normalFlatDmg',
	'chargeFlatDmg',
	'plungeFlatDmg',
	'skillFlatDmg',
	'burstFlatDmg',
	'lunarCrystallizeFlatDmg',
	'interruptionRes'
]);
const isPercentStat = (stat) => stat !== undefined && !FLAT_STATS.has(stat);

const findings = []; // {char, severity, kind, detail}
const add = (char, severity, kind, detail) => findings.push({ char, severity, kind, detail });

// (type|stat) -> [{char, path, value}]  for magnitude-outlier stats pass
const buckets = new Map();
const bucket = (key, entry) => {
	if (!buckets.has(key)) buckets.set(key, []);
	buckets.get(key).push(entry);
};

/** Deep-walk any nested `effects: [...]` array, yielding each effect + a path. */
function* walkEffects(node, path) {
	if (Array.isArray(node)) {
		for (let i = 0; i < node.length; i++) yield* walkEffects(node[i], `${path}[${i}]`);
		return;
	}
	if (!node || typeof node !== 'object') return;
	if (Array.isArray(node.effects)) {
		for (let i = 0; i < node.effects.length; i++) {
			const eff = node.effects[i];
			yield { eff, path: `${path}.effects[${i}]` };
			// effects can themselves host nested structures (none today, but be safe)
			yield* walkEffects(eff, `${path}.effects[${i}]`);
		}
	}
	for (const [k, v] of Object.entries(node)) {
		if (k === 'effects') continue;
		if (v && typeof v === 'object') yield* walkEffects(v, `${path}.${k}`);
	}
}

/** Extract a representative plain number from a BuffValue, or null if the
 *  value is a shape (scaling/perStack/ramping/unknown) where a small number is
 *  legitimate and the decimal-leak heuristic must NOT apply. */
function plainBuffNumber(value) {
	if (typeof value === 'number') return value;
	return null; // scaling.ratio, perStack.per, decaying, ramping, unknown, ScaledValue
}

const files = (await readdir(CHARACTERS_DIR)).filter((f) => f.endsWith('.json'));

for (const file of files) {
	const c = JSON.parse(await readFile(join(CHARACTERS_DIR, file), 'utf8'));
	const cid = c.id;

	// --- structural: duplicate ability ids -------------------------------
	const seenIds = new Map();
	for (const a of c.abilities ?? []) {
		if (seenIds.has(a.id)) add(cid, 'HIGH', 'dup-ability-id', `duplicate ability id "${a.id}"`);
		seenIds.set(a.id, true);
	}

	// --- structural: cooldown sanity ------------------------------------
	// Zero-CD skills/bursts are usually chain-stage or stance sub-abilities
	// (Diluc E2/E3, Nilou steps, Keqing recast) where cd=0 is CORRECT — the
	// PRIMARY cast of that type carries the CD. So only flag when NO ability
	// of a given type has a cooldown>0 anywhere (a genuine "the whole skill
	// has no CD" gap). Negative cooldowns are always wrong.
	const byType = { skill: [], burst: [] };
	for (const a of c.abilities ?? []) {
		if (a.abilityType === 'skill' || a.abilityType === 'burst') byType[a.abilityType].push(a);
		if (typeof a.cooldown === 'number' && a.cooldown < 0) {
			add(cid, 'HIGH', 'neg-cooldown', `${a.id}: cooldown=${a.cooldown}`);
		}
		if (typeof a.energyCost === 'number' && (a.energyCost < 0 || a.energyCost > 120)) {
			add(cid, 'MEDIUM', 'energy-range', `${a.id}: energyCost=${a.energyCost} out of [0,120]`);
		}
	}
	for (const [type, list] of Object.entries(byType)) {
		if (list.length === 0) continue;
		const cds = list.flatMap((a) => [a.cooldown, ...(a.variants ?? []).map((v) => v.cooldown)]);
		const maxCd = Math.max(0, ...cds.filter((x) => typeof x === 'number'));
		if (maxCd === 0) {
			const primary =
				list.find((a) => (a.input ?? []).includes(type === 'skill' ? 'E' : 'Q')) ?? list[0];
			add(
				cid,
				'MEDIUM',
				'no-cooldown',
				`${primary.id}: no ${type} ability has cooldown>0 (all ${list.length} cd=0/unset) — likely a data gap`
			);
		}
	}

	// --- effect-level value checks ---------------------------------------
	for (const { eff, path } of walkEffects(c, cid)) {
		if (!eff || typeof eff !== 'object' || !eff.type) continue;
		const where = `${eff.type} @ ${path}`;

		// duration / procCooldown sanity
		if (typeof eff.duration === 'number' && eff.duration <= 0) {
			add(cid, 'MEDIUM', 'bad-duration', `${where}: duration=${eff.duration}`);
		}
		if (typeof eff.procCooldown === 'number' && eff.procCooldown < 0) {
			add(cid, 'MEDIUM', 'bad-proccd', `${where}: procCooldown=${eff.procCooldown}`);
		}

		if (eff.type === 'buff') {
			const n = plainBuffNumber(eff.value);
			if (n !== null) {
				if (isPercentStat(eff.stat) && Math.abs(n) > 0 && Math.abs(n) < 1) {
					add(
						cid,
						'HIGH',
						'decimal-leak',
						`${where}: ${eff.stat}=${n} looks like a /100 decimal leak (expected whole %, e.g. ${n * 100})`
					);
				}
				if (n === 0) add(cid, 'LOW', 'zero-buff', `${where}: ${eff.stat}=0 (placeholder?)`);
				if (n < 0)
					add(
						cid,
						'MEDIUM',
						'neg-buff',
						`${where}: ${eff.stat}=${n} (buffs positive; debuffs use resShred)`
					);
				bucket(`buff|${eff.stat}`, { char: cid, path, value: n });
			}
		} else if (eff.type === 'damage' || eff.type === 'heal' || eff.type === 'shield') {
			const s = typeof eff.scaling === 'number' ? eff.scaling : null;
			if (s !== null) {
				const hasFlat = typeof eff.flat === 'number' || eff.flatScaling;
				if (s === 0 && !hasFlat)
					add(
						cid,
						'MEDIUM',
						'zero-scaling',
						`${where}: scaling=0 with no flat addend (placeholder?)`
					);
				if (s < 0) add(cid, 'HIGH', 'neg-scaling', `${where}: scaling=${s}`);
				bucket(`${eff.type}|${eff.stat}`, { char: cid, path, value: s });
			}
		} else if (eff.type === 'resShred') {
			// Convention: shred is stored NEGATIVE (a −40 = "−40% RES"); the
			// renderer displays the signed value. So the anomalies are: a
			// sub-1 magnitude (decimal leak), a POSITIVE value (sign flip —
			// would read as raising enemy RES), or an implausible magnitude.
			const v = eff.value;
			if (typeof v === 'number') {
				if (Math.abs(v) > 0 && Math.abs(v) < 1) {
					add(
						cid,
						'HIGH',
						'resshred-decimal',
						`${where}: value=${v} looks like a /100 decimal leak (expected whole %, e.g. ${v * 100})`
					);
				} else if (v > 0) {
					add(
						cid,
						'HIGH',
						'resshred-sign',
						`${where}: value=${v} is POSITIVE — shred convention is negative across the corpus (${-v}?)`
					);
				} else if (v < -100) {
					add(
						cid,
						'MEDIUM',
						'resshred-range',
						`${where}: value=${v} below −100% RES (implausible)`
					);
				}
				// deliberately NOT bucketed — the sign check covers the outlier
			}
		} else if (eff.type === 'energy') {
			if (eff.amount === 0) add(cid, 'LOW', 'zero-energy', `${where}: amount=0 (placeholder?)`);
			if (typeof eff.amount === 'number')
				bucket('energy|amount', { char: cid, path, value: eff.amount });
		}
	}
}

// ---------------------------------------------------------------------------
// Magnitude-outlier pass (robust: median + MAD) — soft "review" tier.
// Flag values >8 MAD from the bucket median (or >12x / <1/12x the median for
// positive sets), capped per bucket so a wide bucket can't flood the report.
// ---------------------------------------------------------------------------

function median(arr) {
	const s = [...arr].sort((a, b) => a - b);
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

for (const [key, entries] of buckets) {
	if (entries.length < 6) continue; // too few peers to judge
	const vals = entries.map((e) => e.value);
	const med = median(vals);
	const mad = median(vals.map((v) => Math.abs(v - med))) || 0;
	const flagged = [];
	for (const e of entries) {
		const madDev = mad > 0 ? Math.abs(e.value - med) / mad : 0;
		const ratioHi = med > 0 && e.value > med * 12;
		const ratioLo = med > 0 && e.value > 0 && e.value < med / 12;
		if ((mad > 0 && madDev > 8) || ratioHi || ratioLo) {
			flagged.push({ ...e, madDev, med });
		}
	}
	flagged.sort((a, b) => b.madDev - a.madDev);
	for (const e of flagged.slice(0, 6)) {
		add(
			e.char,
			'LOW',
			'magnitude-outlier',
			`${key} = ${e.value} @ ${e.path} (bucket median ${e.med}${e.madDev ? `, ${e.madDev.toFixed(1)} MAD` : ''})`
		);
	}
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
findings.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.char.localeCompare(b.char));
const bySev = (s) => findings.filter((f) => f.severity === s);

const lines = [];
lines.push('# Corpus Self-Consistency / Outlier Sweep');
lines.push('');
lines.push('Generated by `node scripts/audit-data-outliers.mjs`. No external oracle —');
lines.push('every finding is a value that contradicts our own conventions or its peers.');
lines.push('');
lines.push(
	`Scanned ${files.length} characters — ${findings.length} findings ` +
		`(${bySev('HIGH').length} HIGH / ${bySev('MEDIUM').length} MEDIUM / ${bySev('LOW').length} LOW).`
);
lines.push('');
for (const sev of ['HIGH', 'MEDIUM', 'LOW']) {
	const group = bySev(sev);
	lines.push(`## ${sev} (${group.length})`);
	if (sev === 'HIGH') lines.push('_Convention violation — almost certainly a bug._');
	if (sev === 'MEDIUM') lines.push('_Placeholder / out-of-range — verify against kit._');
	if (sev === 'LOW') lines.push('_Magnitude outlier or zero — review, often legitimate._');
	lines.push('');
	if (group.length === 0) lines.push('- _none_');
	for (const f of group) lines.push(`- **${f.char}** — [${f.kind}] ${f.detail}`);
	lines.push('');
}

const report = lines.join('\n');
console.log(report);

if (process.argv.includes('--write')) {
	await mkdir(dirname(OUT), { recursive: true });
	await writeFile(OUT, report + '\n');
	console.error(`\n[audit] wrote ${OUT.replace(PROJECT_ROOT + '/', '')}`);
}
