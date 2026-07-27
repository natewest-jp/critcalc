/**
 * scripts/survey-generic-profile.mjs
 *
 * Surveys the curated corpus to derive a data-driven "generic character"
 * timing profile — the fallback timings that frameless / uncurated characters
 * and the Blank placeholder slot ride in the Rotation Planner. Today that
 * fallback is two hand-picked parser constants (E_CAST_S = 0.5, Q_CAST_S = 1.0
 * in notationParser.ts) plus an unmodeled normal-attack path; this replaces
 * them with medians/modes drawn from real frame data.
 *
 * METHOD
 *   Normal + charged attack timings are scoped to SWORD / POLEARM / CATALYST
 *   users — the on-field auto-attack archetypes. Claymore auto-attacks are
 *   rarely a main damage method, and bow charged is a different mechanic, so
 *   both are excluded (Nate's call, 2026-07-23). Charged attacks are then
 *   MAD-trimmed to discard channeled / unusual outliers (e.g. Neuvillette).
 *
 *     - per normal POSITION, per FrameMap KEY: MEDIAN (robust to multi-hit
 *       combos and stance outliers), rounded to the nearest frame.
 *     - normal-hit COUNT: MODAL (most-represented), not max.
 *     - skill / burst cast animation (frames.swap): MEDIAN.
 *     - skill / burst cooldown, energy: MODE (most-represented) — discrete
 *       values that cluster, so the mode is the right center.
 *
 *   Skill/burst timings are ALSO scoped to sword/polearm/catalyst — the
 *   "generic on-field DPS" archetype. For burst CD/energy this changes nothing
 *   (15s / 60 dominate every scope); for skill CD it converges mode+median on
 *   12s, where the all-curated mode (6s) was a short-CD-support artefact that
 *   disagreed with the 12s median (Nate's call, 2026-07-23). Durations are
 *   surveyed but NOT recommended — ~85% of skills/bursts are instant, so the
 *   generic E/Q carry none.
 *
 * Read-only survey — never writes character data. `--write` saves the report
 * to docs/curation/generic-profile-survey.md.
 *
 *   node scripts/survey-generic-profile.mjs
 *   node scripts/survey-generic-profile.mjs --write
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARACTERS_DIR = join(PROJECT_ROOT, 'src/lib/data/characters');
const OUT = join(PROJECT_ROOT, 'docs/curation/generic-profile-survey.md');

// On-field auto-attack archetypes (see METHOD).
const NORMAL_WEAPONS = new Set(['sword', 'polearm', 'catalyst']);
// FrameMap keys in the order we report them. `swap` is the required fallback.
const FRAME_KEYS = ['swap', 'N', 'C', 'E', 'Q', 'D', 'J', 'P'];
// Charged-attack outlier cutoff: discard entries this many MADs from the
// median full-charge length (catches channeled / unusual charges like
// Neuvillette's beam). Deliberately tighter than the 8-MAD "review" tier the
// data-outlier audit uses — here we actively want the unusual ones gone.
const CHARGE_MAD_CUTOFF = 3.5;

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function median(arr) {
	const s = [...arr].sort((a, b) => a - b);
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Histogram of discrete values → [{ value, count }] sorted by count desc,
 *  then value asc (so ties resolve to the smaller value = the more typical). */
function histogram(arr) {
	const counts = new Map();
	for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
	return [...counts.entries()]
		.map(([value, count]) => ({ value, count }))
		.sort((a, b) => b.count - a.count || a.value - b.value);
}

// histogram() is pre-sorted by count desc, so the mode is simply its head.
const modeOf = (hist) => (hist.length ? hist[0].value : undefined);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------------------
// Load corpus
// ---------------------------------------------------------------------------

/** Frame-level curation gate (mirrors characterLint.isCurated): frames on the
 *  primary normal's first hit AND on the primary skill. Keeps the survey to
 *  characters whose timing data is real. */
function isCurated(c) {
	const normal = c.abilities?.find((a) => a.abilityType === 'normal');
	const skill = c.abilities?.find((a) => a.abilityType === 'skill');
	if (!normal || !skill) return false;
	if (!normal.hits?.length) return false;
	if (!isNum(normal.hits[0]?.frames?.swap)) return false;
	if (!isNum(skill.frames?.swap)) return false;
	return true;
}

const files = (await readdir(CHARACTERS_DIR)).filter((f) => f.endsWith('.json'));
const chars = [];
for (const f of files) {
	const c = JSON.parse(await readFile(join(CHARACTERS_DIR, f), 'utf8'));
	chars.push(c);
}
const curated = chars.filter(isCurated);

// primary (first) ability of a type — ignores stance-form / second-press entries
const firstOf = (c, type) => c.abilities?.find((a) => a.abilityType === type);

// ---------------------------------------------------------------------------
// SECTION 1 — Normal-attack profile (sword / polearm / catalyst)
// ---------------------------------------------------------------------------

const normalScope = curated.filter((c) => NORMAL_WEAPONS.has(String(c.weapon).toLowerCase()));

// Modal hit-count.
const hitCounts = normalScope.map((c) => firstOf(c, 'normal').hits.length);
const hitCountHist = histogram(hitCounts);
const modalCount = hitCountHist[0].value;

// Per-position (1-indexed), per-key sample arrays.
const posKeyVals = new Map(); // `${pos}|${key}` -> number[]
const maxPos = Math.max(...hitCounts);
for (const c of normalScope) {
	const hits = firstOf(c, 'normal').hits;
	hits.forEach((h, i) => {
		const pos = i + 1;
		for (const key of FRAME_KEYS) {
			const v = h.frames?.[key];
			if (isNum(v)) {
				const k = `${pos}|${key}`;
				if (!posKeyVals.has(k)) posKeyVals.set(k, []);
				posKeyVals.get(k).push(v);
			}
		}
	});
}

/** Median per (pos,key), with sample size. A key is "recommended" for the
 *  generic FrameMap when it clears a support threshold; `swap` is always in. */
function frameRow(pos) {
	const swapN = (posKeyVals.get(`${pos}|swap`) ?? []).length;
	const threshold = Math.max(3, Math.round(swapN * 0.3));
	const cells = [];
	const recommended = {};
	for (const key of FRAME_KEYS) {
		const vals = posKeyVals.get(`${pos}|${key}`) ?? [];
		if (!vals.length) continue;
		const med = Math.round(median(vals));
		const keep = key === 'swap' || vals.length >= threshold;
		cells.push(`${key}=${med}(n${vals.length}${keep ? '' : ' ·below'})`);
		if (keep) recommended[key] = med;
	}
	return { cells, recommended };
}

// ---------------------------------------------------------------------------
// SECTION 2 — Charged-attack profile (same scope, MAD-trimmed)
// ---------------------------------------------------------------------------

const chargeRaw = [];
const chargeSkipped = [];
for (const c of normalScope) {
	const n = firstOf(c, 'normal');
	if (n.chargeFrames && isNum(n.chargeFrames.swap)) {
		chargeRaw.push({ id: c.id, frames: n.chargeFrames });
	} else if (n.chargeHits) {
		chargeSkipped.push(`${c.id} (chargeHits — bow-style, out of scope)`);
	}
}
// MAD-trim on full-charge length (swap).
const chargeSwaps = chargeRaw.map((e) => e.frames.swap);
const chargeMed = median(chargeSwaps);
const chargeMad = median(chargeSwaps.map((v) => Math.abs(v - chargeMed))) || 0;
const chargeTrimmed = [];
const chargeKept = [];
for (const e of chargeRaw) {
	const dev = chargeMad > 0 ? Math.abs(e.frames.swap - chargeMed) / chargeMad : 0;
	if (chargeMad > 0 && dev > CHARGE_MAD_CUTOFF) {
		chargeTrimmed.push({ id: e.id, swap: e.frames.swap, dev: dev.toFixed(1) });
	} else {
		chargeKept.push(e);
	}
}
// Per-key median over survivors.
const chargeRecommended = {};
const chargeCells = [];
const chargeThreshold = Math.max(3, Math.round(chargeKept.length * 0.3));
for (const key of FRAME_KEYS) {
	const vals = chargeKept.map((e) => e.frames[key]).filter(isNum);
	if (!vals.length) continue;
	const med = Math.round(median(vals));
	const keep = key === 'swap' || vals.length >= chargeThreshold;
	chargeCells.push(`${key}=${med}(n${vals.length}${keep ? '' : ' ·below'})`);
	if (keep) chargeRecommended[key] = med;
}

// ---------------------------------------------------------------------------
// SECTIONS 3 & 4 — Skill (E) and Burst (Q) profiles (ALL curated, no weapon scope)
// ---------------------------------------------------------------------------

function castProfile(type, pop) {
	const casts = [];
	const cooldowns = [];
	const durations = [];
	const energies = [];
	let total = 0;
	for (const c of pop) {
		const a = firstOf(c, type);
		if (!a) continue;
		total++;
		if (isNum(a.frames?.swap)) casts.push(a.frames.swap);
		if (isNum(a.cooldown) && a.cooldown > 0) cooldowns.push(a.cooldown);
		if (isNum(a.duration) && a.duration > 0) durations.push(a.duration);
		if (isNum(a.energyCost) && a.energyCost > 0) energies.push(a.energyCost);
	}
	return {
		total,
		castMedian: casts.length ? Math.round(median(casts)) : undefined,
		castN: casts.length,
		cooldownHist: histogram(cooldowns),
		durationHist: histogram(durations),
		durationCount: durations.length,
		energyHist: histogram(energies)
	};
}

// Skill/burst timings share the on-field-DPS archetype scope (sword/polearm/catalyst).
const skill = castProfile('skill', normalScope);
const burst = castProfile('burst', normalScope);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const L = [];
const p = (s = '') => L.push(s);
const f2s = (frames) => (frames / 60).toFixed(2);

p('# Generic-character profile survey');
p('');
p(`_Read-only survey. Corpus: ${chars.length} characters, ${curated.length} curated (framed)._`);
p(
	`_Scope: normals, charges, and skill/burst timings all drawn from the ${normalScope.length} sword/polearm/catalyst users (the on-field-DPS archetype)._`
);
p('');

p('## 1 · Normal attack profile');
p('');
p(
	'Hit-count histogram (sword/polearm/catalyst): ' +
		hitCountHist.map((h) => `${h.value}→${h.count}`).join('  ')
);
p(`**Modal hit count → ${modalCount}** (max observed ${maxPos})`);
p('');
p(
	'Per-position medians — `key=frames(n samples)`; `·below` = under the ~30% support threshold, so it falls back to `swap` rather than entering the generic map:'
);
p('');
const recNormalHits = [];
for (let pos = 1; pos <= maxPos; pos++) {
	const { cells, recommended } = frameRow(pos);
	if (!cells.length) continue;
	p(`- **N${pos}**  ${cells.join('  ')}`);
	if (pos <= modalCount) recNormalHits.push(recommended);
}
p('');

p('## 2 · Charged attack profile');
p('');
p(
	`Full-charge length median ${Math.round(chargeMed)}f, MAD ${chargeMad.toFixed(1)} across ${chargeRaw.length} in-scope chargeFrames.`
);
if (chargeTrimmed.length) {
	p(
		`Outliers trimmed (>${CHARGE_MAD_CUTOFF} MAD): ` +
			chargeTrimmed.map((t) => `${t.id}(swap=${t.swap}, ${t.dev}·MAD)`).join('  ')
	);
} else {
	p('_No outliers exceeded the MAD cutoff._');
}
if (chargeSkipped.length) p('Skipped (out of scope): ' + chargeSkipped.join('  '));
p(`Per-key medians over ${chargeKept.length} survivors:`);
p('- **CA**  ' + chargeCells.join('  '));
p('');

function castSection(title, letter, prof, currentConst) {
	p(`## ${title}`);
	p('');
	p(
		`Cast animation (\`frames.swap\`): **median ${prof.castMedian}f ≈ ${f2s(prof.castMedian)}s** (n${prof.castN}). Current parser constant: ${currentConst}f (${f2s(currentConst)}s).`
	);
	p('');
	p(
		`Cooldown — mode **${modeOf(prof.cooldownHist) ?? '—'}s**  ·  ` +
			prof.cooldownHist
				.slice(0, 8)
				.map((h) => `${h.value}s→${h.count}`)
				.join('  ')
	);
	p('');
	p(
		`Duration — ${prof.durationCount}/${prof.total} abilities carry one; mode **${modeOf(prof.durationHist) ?? '—'}s**  ·  ` +
			prof.durationHist
				.slice(0, 8)
				.map((h) => `${h.value}s→${h.count}`)
				.join('  ')
	);
	p('');
	if (prof.energyHist.length)
		p(
			`Energy — mode **${modeOf(prof.energyHist)}**  ·  ` +
				prof.energyHist
					.slice(0, 8)
					.map((h) => `${h.value}→${h.count}`)
					.join('  ')
		);
	else p('_No energy cost on this ability type._');
	p('');
}
// 30 frames = E_CAST_S 0.5s, 60 frames = Q_CAST_S 1.0s
castSection('3 · Skill (E) profile', 'E', skill, 30);
castSection('4 · Burst (Q) profile', 'Q', burst, 60);

p('## 5 · Recommended generic profile');
p('');
p('```json');
p(
	JSON.stringify(
		{
			normalHitCount: modalCount,
			normalHits: recNormalHits,
			chargeFrames: chargeRecommended,
			// Durations intentionally omitted — ~85% of skills/bursts are instant.
			skill: {
				castSwap: skill.castMedian,
				cooldown: modeOf(skill.cooldownHist)
			},
			burst: {
				castSwap: burst.castMedian,
				cooldown: modeOf(burst.cooldownHist),
				energy: modeOf(burst.energyHist)
			}
		},
		null,
		2
	)
);
p('```');
p('');
p(
	'_Values are frames unless suffixed; cast animation feeds the parser fallback (replacing E_CAST_S/Q_CAST_S), cooldown/duration/energy are for authoring Blank as a "typical" kit. Eyeball before baking in._'
);

const report = L.join('\n');
const write = process.argv.includes('--write');
if (write) {
	await mkdir(dirname(OUT), { recursive: true });
	await writeFile(OUT, report + '\n');
	console.log(`Wrote ${OUT}`);
} else {
	console.log(report);
}
