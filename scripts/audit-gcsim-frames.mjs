#!/usr/bin/env node
/**
 * scripts/audit-gcsim-frames.mjs
 *
 * Diffs the shipped FrameMaps and summon cadences against gcsim's own numbers, and
 * proposes the elemental-application schedule the corpus has never been able to state.
 * Writes `docs/curation/gcsim-frames-diff.md`.
 *
 * ⛔ A REVIEW-CANDIDATE GENERATOR, NEVER AN AUTO-FIXER — the same contract as
 * `audit-genshin-db-diff.mjs`. The mechanical rewrite of the corpus is a separate
 * program with a separate name (`migrate-frames-shape.mjs`), because an audit that can
 * write data is an audit nobody reads.
 *
 * The oracle is `scripts/gcsim-dump/main.go`, which links gcsim as a library rather
 * than shelling out to its CLI: the cancel slice is not in the debug log at all, and
 * running one ability in an otherwise-empty core makes application attribution exact
 * instead of heuristic. See docs/gauge-round-L4.md §1–2.
 *
 * Usage:  node scripts/audit-gcsim-frames.mjs [--write] [--char <id>]
 *         (without --write, prints the summary and leaves the report alone)
 */

// ⚓ MUST be first, and MUST stay a static import — it registers the `$lib` resolver
// that lets `icd.ts` load below. Static imports evaluate before the module body, so the
// hook is in place by the time the dynamic import runs. ⛔ A `$lib` import above this
// line defeats it (the rule `audit-gcsim-reactions.mjs` already carries).
import './lib/alias-hook.mjs';

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runDumper } from './lib/gcsim-dump.mjs';
import {
	CANCEL_KEYS,
	CHAR_DIR,
	KEYS,
	authoredMaps,
	driverSetsFor,
	gcsimKeyFor,
	loadDrivers,
	prereqFor,
	splitApplications,
	variantDumpKey
} from './lib/gcsim-map.mjs';

// ⚓ THE REAL ICD MODEL, imported rather than restated — the same reason `gcsim-map.mjs`
// imports the real `frameAt`. A second copy of the standard-ICD rule here would let this
// report clear a series the parser then gates differently, which is the failure mode L4d
// recorded for the reaction oracle. ⚠️ Dynamic because `icd.ts` reaches `$lib` for `FPS`,
// so it needs the resolver registered at the top of this file.
const { createIcdClock, icdApplies, STANDARD_ICD_FRAMES } = await import('../src/lib/utils/icd.ts');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = join(REPO_ROOT, 'docs/curation/gcsim-frames-diff.md');

const FPS = 60;
const f = (seconds) => Math.round(seconds * FPS);

// ---------------------------------------------------------------------------
// Application attribution
// ---------------------------------------------------------------------------

/** Authored summon cadence, in frames, for the cross-check.
 *
 * ⛔ DAMAGE ticks only. A heal tick leaves no `damage` event, so comparing one against
 * an empty observation would report every healer's field as "not observed" — and ⚓ a
 * heal tick is not a hit is already a standing rule of this codebase (four summons pair
 * a heal and a damage effect on the identical interval). */
function authoredTicks(ability) {
	const out = [];
	for (const s of ability.summons ?? []) {
		for (const e of s.effects ?? []) {
			const t = e.trigger;
			if (t?.type !== 'summonTick' || e.type !== 'damage') continue;
			// ⚠️⚠️ AN ABSENT `firstTickDelay` DEFAULTS TO THE INTERVAL, NOT ZERO.
			// This read `?? 0` until 2026-08-16 (gauge round L5e-a½) and so
			// described a model we do not have — `collectSummonTicks` walks from
			// `spawnAt + (firstTickDelay ?? interval)`, which is the ONLY walk
			// there is. Eleven summons author no delay, and on them the old
			// default manufactured a phantom discrepancy exactly one interval
			// wide: Columbina's Gravity Ripple and Durin's White Flame were
			// reported 117f and 59f "wrong" and are in fact EXACT, and Gorou and
			// Kuki land within 1–2 frames. ⚓ The same failure mode L4d recorded
			// for the reaction oracle — an audit that restates a rule instead of
			// calling it comes to measure a model that no longer exists.
			// ⛔ Do not re-derive this default here; mirror the walk.
			const interval = f(t.interval ?? 0);
			out.push({
				label: s.label,
				kind: e.type,
				spawnsAt: s.spawnsAt ?? 0,
				firstTick:
					(s.spawnsAt ?? 0) + (t.firstTickDelay !== undefined ? f(t.firstTickDelay) : interval),
				interval,
				// ⚓ Read back so the annotation is SELF-CHECKING (L5e-a¾). Authoring
				// a gate is a CLAIM about gcsim, and this is the report that
				// re-measures it against the dump's own post-ICD `applied` flag —
				// the same reason the frame rows are diffed rather than trusted.
				// ⛔ The audit never WRITES it.
				// ⚠️ This access is also what keeps the key visible to
				// `orphanedSchema.test.ts` until the parser consumes it at L5e-b;
				// deleting it turns the guard red, which was verified deliberately.
				icdGate: t.icdGate ?? 'standard'
			});
		}
	}
	return out;
}

// ---------------------------------------------------------------------------

function main() {
	const args = process.argv.slice(2);
	const write = args.includes('--write');
	const onlyIdx = args.indexOf('--char');
	const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

	const drivers = loadDrivers();
	const unresolved = drivers._unresolved ?? {};

	const chars = readdirSync(CHAR_DIR)
		.filter((n) => n.endsWith('.json'))
		.map((n) => JSON.parse(readFileSync(join(CHAR_DIR, n), 'utf8')))
		.filter((c) => !only || c.id === only)
		.sort((a, b) => a.id.localeCompare(b.id));

	// ⚓ The capture sets are DERIVED from the corpus, not listed. Every gated ability
	// contributes the set it needs; the driver table only supplies the steps for a
	// `state` gate.
	const driverTable = {};
	for (const char of chars) {
		const gk = gcsimKeyFor(char.id);
		const sets = driverSetsFor(char, drivers[gk]);
		if (sets.length) driverTable[gk] = { sets };
	}

	process.stderr.write('building + running the gcsim dumper…\n');
	const dump = runDumper({ drivers: driverTable, only: only ? gcsimKeyFor(only) : '' });

	const noSource = [];
	const mismatches = [];
	const uncovered = [];
	const animGaps = { normal: [], eq: [] };
	const fallbackExposure = {};
	const applicationRows = [];
	const noApplication = [];
	const tickRows = [];
	let matched = 0;
	let authored = 0;

	for (const char of chars) {
		const gk = gcsimKeyFor(char.id);
		const cd = dump.characters[gk];
		const maps = authoredMaps(
			char,
			drivers[gk],
			cd ? new Map((cd.abilities ?? []).map((x) => [x.key, x])) : null
		);
		authored += maps.length;
		if (!cd) {
			noSource.push(char.id);
			for (const m of maps)
				uncovered.push({ id: char.id, path: m.path, reason: 'no gcsim source' });
			continue;
		}
		const byKey = new Map((cd.abilities ?? []).map((a) => [a.key, a]));

		for (const m of maps) {
			const g = m.dumpKey ? byKey.get(m.dumpKey) : null;
			if (!g || g.error || !g.frames) {
				uncovered.push({
					id: char.id,
					path: m.path,
					reason:
						m.uncoveredReason ??
						(!m.dumpKey ? 'no gcsim analogue' : (g?.error ?? `not captured (${m.dumpKey})`))
				});
				continue;
			}
			const bad = KEYS.filter((k) => m.frames[k] !== undefined && m.frames[k] !== g.frames[k]);
			if (bad.length) {
				mismatches.push({
					id: char.id,
					path: m.path,
					keys: bad.map((k) => `${k} ${m.frames[k]}→${g.frames[k]}`)
				});
			} else matched++;

			// The reshape's payoff: which fallbacks fire today, and by how much.
			const isNormal = /\.hits\[|chargeHits\[/.test(m.path);
			const gap = g.frames.anim - (m.frames.swap ?? g.frames.anim);
			if (gap > 0) animGaps[isNormal ? 'normal' : 'eq'].push(gap);
			for (const k of KEYS) {
				if (k === 'swap' || m.frames[k] !== undefined) continue;
				const shouldBe = CANCEL_KEYS.has(k)
					? isNormal
						? m.frames.swap
						: g.frames.anim
					: g.frames.anim;
				const readsAs = m.frames.swap;
				if (shouldBe === undefined || readsAs === undefined) continue;
				const bucket = (fallbackExposure[`${isNormal ? 'normal' : 'E/Q'} → ${k}`] ??= {
					count: 0,
					gaps: []
				});
				bucket.count++;
				if (shouldBe > readsAs) bucket.gaps.push(shouldBe - readsAs);
			}
		}

		// Applications — skill/burst and their variants only. ⛔ Normals get no list:
		// their hitmark is frames.hit and their element already has one owner
		// (resolveActionElement). See docs/gauge-round-L4.md §4.
		for (const a of char.abilities ?? []) {
			if (a.abilityType !== 'skill' && a.abilityType !== 'burst') continue;
			const ctx = prereqFor(a.conditions, drivers[gk]);
			const suffix = ctx === null ? null : ctx.label ? `@${ctx.label}` : '';
			const baseKey = a.abilityType === 'burst' ? 'Q' : 'E';
			const base = suffix === null ? null : `${baseKey}${suffix}`;
			const targets = [{ path: a.id, key: base, node: a }];
			for (const v of a.variants ?? []) {
				const vk = variantDumpKey(v.input ?? [], baseKey);
				targets.push({
					path: `${a.id} · ${v.input?.join('/') ?? '?'}`,
					key: vk === null || suffix === null ? null : `${vk}${suffix}`,
					node: v
				});
			}
			for (const t of targets) {
				const g = t.key ? byKey.get(t.key) : null;
				if (!g || g.error) {
					noApplication.push({
						id: char.id,
						path: t.path,
						reason: !t.key
							? 'no gcsl spelling for this variant / no driver row for its state'
							: (g?.error ?? 'not captured')
					});
					continue;
				}
				const split = splitApplications(g.applications ?? [], t.node.summons?.length ? t.node : a);
				applicationRows.push({ id: char.id, path: t.path, key: t.key, ...split });
			}
			// Summon cadence cross-check.
			//
			// ⚠️ Paired by CADENCE, never by NAME. gcsim's ability strings are its own —
			// our "Itzpapa" is its "Obsidian Tzitzimitl DMG", our "General's Glory" is
			// its "Juuga: Forward Unto Victory", and it spells Chiori's Tamoto "Tamato".
			// A name join reported 20-odd healthy summons as "not observed"; showing both
			// sides and letting a human pair them is the honest shape.
			const g = base ? byKey.get(base) : null;
			if (!g || g.error) continue;
			const authored = authoredTicks(a);
			const { ticks } = splitApplications(g.applications ?? [], a);
			const streams = new Map();
			for (const x of ticks) {
				if (!streams.has(x.abil)) streams.set(x.abil, []);
				streams.get(x.abil).push(x.frame);
			}
			const observed = [...streams].map(([abil, frames]) => {
				const gaps = frames
					.slice(1)
					.map((f2, i) => f2 - frames[i])
					.filter((gp) => gp > 0);
				const tally = new Map();
				for (const gp of gaps) tally.set(gp, (tally.get(gp) ?? 0) + 1);
				let modal = null;
				let best = 0;
				for (const [gp, n] of tally)
					if (n > best) {
						best = n;
						modal = gp;
					}
				return { abil, first: frames[0], interval: modal, n: frames.length, spread: tally.size };
			});
			// ⚓ The measured ICD verdict per stream (L5e-a¾). gcsim's `applied` flag
			// is the POST-ICD subset of the damage stream, so the gate is observable
			// rather than inferred: compare it against `icd.ts` at standard params.
			// ⚠️ `either` is a real answer, not a missing one — when the interval
			// exceeds the 2.5s timer, standard and none are indistinguishable and
			// ⛔ the series must NOT be annotated on the strength of it.
			for (const o of observed) {
				const frames = streams.get(o.abil);
				const applied = ticks.filter((x) => x.abil === o.abil && x.applied).length;
				const clock = createIcdClock();
				let std = 0;
				for (const fr of frames) if (icdApplies(clock, fr, STANDARD_ICD_FRAMES).applies) std++;
				o.applied = applied;
				o.std = std;
				o.verdict =
					applied === std
						? applied === frames.length
							? 'either'
							: 'standard'
						: applied === frames.length
							? 'none'
							: 'other';
			}
			if (!authored.length && !observed.length) continue;
			tickRows.push({ id: char.id, path: a.id, authored, observed });
		}
	}

	const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);

	const md = renderReport({
		commit: dump.commit,
		chars,
		authored,
		matched,
		mismatches,
		uncovered,
		noSource,
		unresolved,
		animGaps,
		fallbackExposure,
		applicationRows,
		noApplication,
		tickRows,
		median
	});

	if (write) {
		writeFileSync(REPORT, md);
		process.stderr.write(`wrote ${REPORT}\n`);
	} else {
		process.stdout.write(
			md.split('\n').slice(0, 70).join('\n') + '\n\n… (--write for the full report)\n'
		);
	}
}

function renderReport(d) {
	const L = [];
	const p = (s = '') => L.push(s);

	p('# gcsim frame + application diff');
	p();
	p(`_Generated by \`scripts/audit-gcsim-frames.mjs\` against gcsim \`${d.commit}\`._`);
	p();
	p('⛔ **Review candidates, not corrections.** This report proposes; a human disposes,');
	p('and `scripts/migrate-frames-shape.mjs` is what writes. See `docs/gauge-round-L4.md`.');
	p();

	// --- coverage -----------------------------------------------------------
	p('## Coverage');
	p();
	p(
		`- characters: **${d.chars.length}** authored · **${d.chars.length - d.noSource.length}** with a gcsim source`
	);
	p(
		`- FrameMaps: **${d.authored}** authored · **${d.matched}** matching gcsim exactly · **${d.mismatches.length}** disagreeing · **${d.uncovered.length}** uncovered`
	);
	p(
		`- skill/burst application schedules observed: **${d.applicationRows.length}** · unobserved: **${d.noApplication.length}**`
	);
	p(`- summon tick streams cross-checked: **${d.tickRows.length}**`);
	p();
	if (d.noSource.length) {
		p(
			`⛔ **No gcsim source (${d.noSource.length})** — cannot be oracled at all, and nothing here may be written to them:`
		);
		p();
		p(`> ${d.noSource.join(', ')}`);
		p();
	}

	// --- the reshape's payoff ----------------------------------------------
	p('## 1. What the `anim` fallback buys');
	p();
	p('Today every absent key resolves to `swap`. gcsim resolves it to the ANIMATION');
	p('length, and only overrides the cancel keys with the hitmark. This table is the');
	p('difference, per transition that currently falls back.');
	p();
	p('| transition | maps falling back | median understatement |');
	p('| --- | --- | --- |');
	for (const [k, v] of Object.entries(d.fallbackExposure).sort(
		(a, b) => b[1].gaps.length - a[1].gaps.length
	)) {
		if (!v.gaps.length) continue;
		p(`| ${k} | ${v.gaps.length} / ${v.count} | ${d.median(v.gaps)}f |`);
	}
	p();
	p(
		`Maps whose true \`anim\` exceeds the authored \`swap\`: **${d.animGaps.normal.length}** normal (median ${d.median(d.animGaps.normal)}f), **${d.animGaps.eq.length}** E/Q (median ${d.median(d.animGaps.eq)}f).`
	);
	p();

	// --- mismatches ---------------------------------------------------------
	p(`## 2. FrameMaps that disagree (${d.mismatches.length})`);
	p();
	p('⚠️ C4b rules that gcsim is the source for all frame data, so these resolve in');
	p("gcsim's favour — but each is listed so it is READ before it is written.");
	p();
	const byChar = new Map();
	for (const m of d.mismatches) {
		if (!byChar.has(m.id)) byChar.set(m.id, []);
		byChar.get(m.id).push(m);
	}
	p('| character | map | keys (ours → gcsim) |');
	p('| --- | --- | --- |');
	for (const [id, rows] of byChar) {
		for (const r of rows) p(`| ${id} | \`${r.path}\` | ${r.keys.join(', ')} |`);
	}
	p();

	p(`## 3. Uncovered maps (${d.uncovered.length})`);
	p();
	p('⚠️ Uncovered is **not** the same as matching. A map here has no gcsim reading at');
	p('all; the migration leaves it alone and it keeps `anim = swap`.');
	p();
	const reasons = new Map();
	for (const u of d.uncovered) {
		const k = u.reason;
		if (!reasons.has(k)) reasons.set(k, []);
		reasons.get(k).push(`${u.id} \`${u.path}\``);
	}
	for (const [reason, rows] of [...reasons].sort((a, b) => b[1].length - a[1].length)) {
		p(`**${reason}** (${rows.length})`);
		p();
		p(`> ${rows.join(' · ')}`);
		p();
	}

	// --- applications -------------------------------------------------------
	p('## 4. Proposed application schedules');
	p();
	p('`+f` is frames from cast start to the hitmark. ⚓ **An empty cast column with an');
	p('empty streams column is the finding** — it is the positive statement that the cast');
	p("applies nothing, which the corpus has never been able to make (Xiangling's E, Hu");
	p("Tao's E, Itto's Q). ⚠️ An empty cast column with a stream beside it means something");
	p('quite different: everything this cast applies, it applies on a cadence.');
	p();
	p('`[icd]` marks a hit gcsim suppressed at the target. It is still a NOMINAL');
	p('application and is still authored — C4: `icd.ts` decides whether one lands, this');
	p('list says what would.');
	p();
	p('Summon ticks are separated out because `interval` / `firstTickDelay` already model');
	p('them and ⛔ they are not re-authored here. ⚓ A stream counts as a tick only when');
	p('the ability DECLARES a summon: regularity alone is not enough, because a multi-hit');
	p('burst is evenly spaced too and belongs to the cast. **⚠️ regular, no authored');
	p('summon** flags the ambiguous ones for a human — either a multi-hit cast (author it');
	p('in the list) or a thing left in the world we have not modelled.');
	p();
	p('| character | ability | cast applications | recurring streams |');
	p('| --- | --- | --- | --- |');
	for (const r of d.applicationRows) {
		const fmt = (xs) =>
			xs.length
				? xs
						.map(
							(x) =>
								`+${x.frame} ${x.element}${x.element !== 'physical' && !x.applied ? ' [icd]' : ''}${x.durability ? ` (${x.durability / 25}U)` : ''}`
						)
						.join(' · ')
				: '**—**';
		const ticks = r.ticks.length
			? `${r.ticks.length}× ${[...new Set(r.ticks.map((x) => x.abil))].join(', ')}`
			: r.regular.length
				? `⚠️ regular, no authored summon: ${r.regular.join(', ')}`
				: '';
		p(`| ${r.id} | \`${r.path}\` | ${fmt(r.cast)} | ${ticks} |`);
	}
	p();
	if (d.noApplication.length) {
		p(`### No observed schedule (${d.noApplication.length})`);
		p();
		p('⚓ These land in the provisional register: absent is not empty, and a bar drawn');
		p('from an absent list carries `--ui-provisional` (L6).');
		p();
		for (const n of d.noApplication) p(`- ${n.id} \`${n.path}\` — ${n.reason}`);
		p();
	}

	// --- summon cadence -----------------------------------------------------
	p('## 5. Summon cadence cross-check');
	p();
	p('A free by-product: the same stream that yields hitmarks also states when every');
	p('summon actually ticks. ⚠️ Rows are shown side by side and **paired by eye, not by');
	p("name** — gcsim's ability strings are its own (our `Itzpapa` is its `Obsidian");
	p('Tzitzimitl DMG`; it spells Chiori\'s Tamoto "Tamato"). ⛔ Damage ticks only: a heal');
	p('tick leaves no `damage` event, and a heal tick is not a hit.');
	p();
	p('');
	p('⚓ **ICD is MEASURED, not inferred** — gcsim logs an `element` application only for');
	p('a hit its ICD let through, so the `applied/total` column is the gate itself. The');
	p('authored column shows what the data claims (absent ⇒ `standard`); ⚠️ `either` means');
	p('the interval exceeds the 2.5s timer so standard and none are indistinguishable, and');
	p('⛔ such a series must NOT be annotated. `other` is a real gcsim ICD group we cannot');
	p('yet express — see docs/gauge-round-L5e.md §3.3.');
	p();
	p(
		'| character | ability | authored (first / interval · icd) | observed (first / interval × n · applied) |'
	);
	p('| --- | --- | --- | --- |');
	for (const t of d.tickRows) {
		const a = t.authored.length
			? t.authored
					.map((x) => `${x.label} ${x.firstTick}f / ${x.interval}f · \`${x.icdGate}\``)
					.join('<br>')
			: '—';
		const o = t.observed.length
			? t.observed
					.map((x) => {
						// ⚠️ Flagged only when the AUTHORED claim contradicts the
						// measurement — a lone `other` is a known limit, not a defect.
						const claim = t.authored.length === 1 ? t.authored[0].icdGate : null;
						const bad =
							claim && (x.verdict === 'none' || x.verdict === 'standard')
								? claim !== x.verdict
								: false;
						return `${x.abil} ${x.first}f / ${x.interval ?? '—'}f × ${x.n}${x.spread > 2 ? ' ⚠️ irregular' : ''} · ${x.applied}/${x.n} \`${x.verdict}\`${bad ? ' ⚠️ **authored disagrees**' : ''}`;
					})
					.join('<br>')
			: '—';
		const agree =
			t.authored.length === t.observed.length &&
			t.authored.every((x) =>
				t.observed.some((y) => y.first === x.firstTick && y.interval === x.interval)
			);
		p(
			`| ${t.id} | \`${t.path.split('__').pop()}\` | ${a} | ${o} | ${agree ? '' : ''}`.concat(' |')
		);
	}
	p();

	return L.join('\n');
}

main();
