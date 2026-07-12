/**
 * scripts/normalize-talent-levels.mjs
 *
 * Corpus convention: talent-scaled values are authored at TALENT LEVEL 10
 * (decided 2026-07-12; sidecar rows' 10th column). This sweep finds values
 * that instead match a sidecar row at some OTHER level — the old-era
 * stragglers — and proposes the level-10 replacement.
 *
 *   node scripts/normalize-talent-levels.mjs           # report
 *   node scripts/normalize-talent-levels.mjs --fix     # apply UNAMBIGUOUS fixes
 *
 * Only unambiguous cases auto-fix: the value matches exactly one sidecar row,
 * that row's match levels exclude 10, and the row has a distinct level-10
 * value. Multi-row matches and no-matches are report-only (no-matches are
 * usually composites, gcsim-precision flats, or fixed kit constants — fine).
 *
 * Scoping (v2, after the first run drowned in coincidences): proposals only
 * for effects hosted on ABILITIES, matched against the SAME talent's rows
 * (skill effects vs skill rows, burst vs burst, normal vs normal) — talent
 * scaling only exists there. Passive/constellation values are fixed kit
 * constants; cross-talent matches are numerology.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';

const CHARS = 'src/lib/data/characters';
const SIDE = 'docs/curation/talents';
const FIX = process.argv.includes('--fix');

const PCT_TOL = 0.11;
const FLAT_TOL = 1.1;

function tokensOf(valueString) {
	const pct = [...String(valueString).matchAll(/([\d.]+)%/g)].map((m) => parseFloat(m[1]));
	const flat = [...String(valueString).matchAll(/\+([\d.]+)/g)].map((m) => parseFloat(m[1]));
	return { pct, flat };
}

function matchesOf(rows, value, kind /* 'pct' | 'flat' */) {
	const tol = kind === 'pct' ? PCT_TOL : FLAT_TOL;
	const out = [];
	for (const row of rows) {
		const levels = [];
		row.values.forEach((v, i) => {
			if (tokensOf(v)[kind].some((t) => Math.abs(t - value) < tol)) levels.push(i + 1);
		});
		if (levels.length > 0) out.push({ row, levels });
	}
	return out;
}

function lv10Token(row, kind) {
	const t = tokensOf(row.values[9] ?? '')[kind];
	return t.length > 0 ? t[0] : null;
}

const report = { ok: 0, propose: [], ambiguous: [], unmatched: 0 };

for (const f of readdirSync(CHARS).filter((f) => f.endsWith('.json'))) {
	const path = `${CHARS}/${f}`;
	const d = JSON.parse(readFileSync(path, 'utf8'));
	const sp = `${SIDE}/${d.id}.json`;
	if (!existsSync(sp)) continue;
	const talents = JSON.parse(readFileSync(sp, 'utf8')).talents;
	const rowsFor = (abilityType) => talents[abilityType]?.rows ?? [];
	let dirty = false;
	let rows = []; // set per-ability before each walk

	const inspect = (holder, key, kind, where) => {
		const value = holder[key];
		if (typeof value !== 'number') return;
		if (kind === 'pct' && value <= 5) return;
		if (kind === 'flat' && value <= 50) return;
		const matches = matchesOf(rows, value, kind);
		if (matches.length === 0) {
			report.unmatched++;
			return;
		}
		if (matches.some((m) => m.levels.includes(10))) {
			report.ok++;
			return;
		}
		if (matches.length === 1) {
			const { row, levels } = matches[0];
			const fix = lv10Token(row, kind);
			if (fix !== null && Math.abs(fix - value) > (kind === 'pct' ? PCT_TOL : FLAT_TOL)) {
				report.propose.push({ id: d.id, where, key, value, row: row.label, levels, fix });
				if (FIX) {
					holder[key] = fix;
					dirty = true;
				}
				return;
			}
		}
		report.ambiguous.push({
			id: d.id,
			where,
			key,
			value,
			rows: matches.map((m) => `${m.row.label}@lv${m.levels.join('/')}`)
		});
	};

	const walkEffects = (effects, where) => {
		for (const e of effects ?? []) {
			if (['heal', 'shield', 'damage'].includes(e.type)) {
				inspect(e, 'scaling', 'pct', `${where} ${e.type}`);
				inspect(e, 'flat', 'flat', `${where} ${e.type}`);
			}
			if (e.type === 'buff') {
				if (typeof e.value === 'number') inspect(e, 'value', 'pct', `${where} buff:${e.stat}`);
				else if (e.value?.type === 'scaling')
					inspect(e.value, 'ratio', 'pct', `${where} buff:${e.stat} ratio`);
			}
		}
	};
	const walkAbility = (a) => {
		// Same-talent scoping: skill effects check skill rows, burst vs burst,
		// normal vs normal. Passives/constellations are fixed constants — skipped.
		rows = rowsFor(a.abilityType);
		if (rows.length === 0) return;
		const where = `ab:${a.id.split('__').pop()}`;
		walkEffects(a.effects, where);
		for (const v of a.variants ?? []) walkEffects(v.effects, `${where}[${v.label}]`);
		for (const s of a.summons ?? []) walkEffects(s.effects, `${where}(summon)`);
	};
	d.abilities?.forEach((a) => walkAbility(a));

	if (dirty) writeFileSync(path, JSON.stringify(d, null, '\t') + '\n');
}

console.log(
	`talent-level sweep: ${report.ok} already lv10 | ${report.propose.length} proposed fixes | ${report.ambiguous.length} ambiguous | ${report.unmatched} unmatched (composites/constants — fine)`
);
console.log('\n— PROPOSED (single-row, non-10 → lv10) —');
for (const p of report.propose)
	console.log(
		`${FIX ? '✎ FIXED' : '→'} ${p.id} ${p.where}.${p.key}: ${p.value} (matches "${p.row}" lv${p.levels.join('/')}) → ${p.fix}`
	);
console.log('\n— AMBIGUOUS (judgment needed, not auto-fixed) —');
for (const a of report.ambiguous)
	console.log(`? ${a.id} ${a.where}.${a.key}: ${a.value} matches ${a.rows.join(' ; ')}`);
