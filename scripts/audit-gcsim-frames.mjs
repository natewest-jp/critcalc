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

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runDumper } from './lib/gcsim-dump.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHAR_DIR = join(REPO_ROOT, 'src/lib/data/characters');
const DRIVERS = join(REPO_ROOT, 'scripts/gcsim-dump/drivers.json');
const REPORT = join(REPO_ROOT, 'docs/curation/gcsim-frames-diff.md');

const FPS = 60;
const f = (seconds) => Math.round(seconds * FPS);

/** Our FrameMap keys, in the order the report prints them. */
const KEYS = ['N', 'C', 'E', 'Q', 'D', 'J', 'P', 'swap'];

/** ⚓ The keys `InitNormalCancelSlice` overrides with the HITMARK. Everything else in a
 *  normal's slice is the animation length — which is the whole C4b finding: `swap` was
 *  standing in for both, and it is only ever right about this half. */
const CANCEL_KEYS = new Set(['E', 'Q', 'D', 'J', 'swap']);

/** ⚠️ The six Travelers are NOT in the no-gcsim-source set — they map by name, not by
 *  the underscore rule. gcsim keys them by body (`aether…`); the corpus does not model
 *  the Aether/Lumine split for frames, and the two are frame-identical upstream. */
const KEY_OVERRIDES = {
	traveler_anemo: 'aetheranemo',
	traveler_dendro: 'aetherdendro',
	traveler_electro: 'aetherelectro',
	traveler_geo: 'aethergeo',
	traveler_hydro: 'aetherhydro',
	traveler_pyro: 'aetherpyro'
};

const gcsimKeyFor = (id) => KEY_OVERRIDES[id] ?? id.replace(/_/g, '');

// ---------------------------------------------------------------------------
// Corpus → dump-key mapping
// ---------------------------------------------------------------------------

/**
 * ⚓ The corpus already says what gates each ability, so the prerequisite is DERIVED
 * from the ability's own `conditions` rather than hand-listed:
 *
 *   `chainStage {ability, index: N}`  →  N repeats of that action  (Diluc E2/E3,
 *                                        Keqing's recast, Xianyun's Skyladder, Dehya)
 *   `state {state: S}`                →  one lookup in drivers.json's `states`
 *
 * That leaves the driver table answering exactly one question per row — "what puts this
 * character into that state" — which is the only part no rule derives.
 *
 * Returns `{ label, prereq }`, or `null` when the ability needs a prerequisite we
 * cannot build. ⚠️ `null` is UNCOVERED, never "compare it against the base": reading a
 * stance ability off a grounded capture is how you manufacture a mismatch.
 */
function prereqFor(conditions, drv) {
	if (!conditions) return { label: '', prereq: [] };
	if (conditions.type === 'chainStage') {
		const n = conditions.index ?? 0;
		if (n === 0) return { label: '', prereq: [] };
		const act = conditions.ability === 'burst' ? 'burst' : 'skill';
		return { label: `chain-${act}-${n}`, prereq: [{ action: act, params: {}, repeat: n }] };
	}
	if (conditions.type === 'state') {
		const steps = drv?.states?.[conditions.state];
		if (!steps) return null;
		// ⚓ An empty step list is a ROW that says "this state does not change the
		// frames"; it resolves to the BASE capture rather than to a redundant second one.
		if (!steps.length) return { label: '', prereq: [] };
		return { label: `state-${conditions.state}`, prereq: steps };
	}
	// Constellation, ascension and team-composition gates do not change the frames a
	// C0 capture reads, so they are not prerequisites at all.
	return { label: '', prereq: [] };
}

/**
 * Every authored FrameMap, paired with the dump key that should describe it.
 *
 * A map whose dump key is null is not a mismatch; it is uncovered, and the two must
 * never be reported as the same thing.
 */
function authoredMaps(char, drv, dumped) {
	const out = [];
	const isBow = char.weapon === 'bow';
	// Does this bow have a SECOND aim reading at all? (see the chargeHits note below)
	const aimFull = dumped?.get('A');
	const aimHold = dumped?.get('hA');
	const hasPartialAim =
		isBow &&
		aimFull?.frames &&
		aimHold?.frames &&
		JSON.stringify(aimFull.frames) !== JSON.stringify(aimHold.frames);
	const suffixed = (key, ctx) => (ctx === null ? null : ctx.label ? `${key}@${ctx.label}` : key);
	for (const a of char.abilities ?? []) {
		const ctx = prereqFor(a.conditions, drv);
		if (a.abilityType === 'normal') {
			(a.hits ?? []).forEach((h, i) =>
				out.push({
					path: `${a.id}.hits[${i}]`,
					frames: h.frames,
					dumpKey: suffixed(`N${i + 1}`, ctx)
				})
			);
			if (a.chargeFrames)
				out.push({
					path: `${a.id}.chargeFrames`,
					frames: a.chargeFrames,
					dumpKey: suffixed('C', ctx)
				});
			// ⚓⚓ A bow's charged attack is gcsim's `aim`, and its default reading is the
			// FULLY-charged shot — measured, not assumed (Amber `aim` = 96f = our
			// "Fully-Charged Aimed Shot"). ⛔ gcsim models ONE aimed shot per bow: for
			// 18 of 19 bows `aim[hold=1]` returns the identical slice, so the partial
			// draw has no gcsim reading at all and must be reported UNCOVERED rather
			// than diffed against the full shot. Ganyu is the single exception, where
			// hold=1 is a genuinely different (level-1) aim — and `hasPartialAim` is
			// how that is detected rather than special-cased by name.
			const partialKey = hasPartialAim ? 'hA' : null;
			(a.chargeHits ?? []).forEach((h, i) => {
				const isLast = i === a.chargeHits.length - 1;
				out.push({
					path: `${a.id}.chargeHits[${i}]`,
					frames: h.frames,
					dumpKey: isBow ? (isLast ? 'A' : partialKey) : suffixed('C', ctx),
					uncoveredReason:
						isBow && !isLast && !partialKey
							? 'gcsim models one aimed shot per bow (no partial draw)'
							: undefined
				});
			});
			if (a.plungeFrames)
				out.push({
					path: `${a.id}.plungeFrames`,
					frames: a.plungeFrames,
					dumpKey: suffixed('P', ctx),
					// ⚓ Our single `plungeFrames` does not say WHICH plunge it is, and
					// measured across the corpus it is overwhelmingly gcsim's LOW plunge
					// (35 of 41). Reporting it against `P` alone would invent 35
					// mismatches out of a naming ambiguity, so the audit picks whichever
					// gcsim variant matches and reports the split as a finding.
					alternatives: ['lP']
				});
			// ⛔ plungeVariants have no gcsim analogue — gcsim models one plunge per
			// character, launched by Xianyun. Left uncovered on purpose.
			for (const v of a.plungeVariants ?? [])
				out.push({ path: `${a.id}.plungeVariants[${v.label}]`, frames: v.frames, dumpKey: null });
			continue;
		}
		if (a.abilityType !== 'skill' && a.abilityType !== 'burst') continue;
		const base = a.abilityType === 'burst' ? 'Q' : 'E';
		if (a.frames)
			out.push({ path: `${a.id}.frames`, frames: a.frames, dumpKey: suffixed(base, ctx) });
		for (const v of a.variants ?? []) {
			if (!v.frames) continue;
			const vk = variantDumpKey(v.input ?? [], base);
			out.push({
				path: `${a.id}.variants[${v.input?.join('/') ?? '?'}]`,
				frames: v.frames,
				dumpKey: vk === null ? null : suffixed(vk, ctx)
			});
		}
	}
	return out;
}

/** `hE`/`h1E` are gcsim's `skill[hold=1]`; `h2E` is `hold=2`. ⚠️ `sQ` (KQM short burst)
 *  has no known gcsl spelling — L0 §9 left it open and it is still open. */
function variantDumpKey(input, base) {
	if (input.includes('h2E')) return 'h2E';
	if (input.includes('hE') || input.includes('h1E')) return 'hE';
	if (input.includes('E')) return 'E';
	if (input.includes('sQ')) return null;
	return base;
}

// ---------------------------------------------------------------------------
// Application attribution
// ---------------------------------------------------------------------------

/**
 * Split a dumped application stream into the cast's own hits and its summons' ticks.
 *
 * ⚓ Only one ability ever ran, so everything in the stream belongs to this cast — the
 * question is which BAR it belongs to. Our summons are already modelled with a label, a
 * spawn frame and a tick interval, so the split is a name match first (gcsim uses the
 * same in-game names) and a recurrence test second, for the summons we have not
 * authored yet.
 */
function splitApplications(apps, ability) {
	const summonLabels = new Set(
		(ability.summons ?? []).map((s) => String(s.label ?? '').toLowerCase()).filter(Boolean)
	);
	const byAbil = new Map();
	for (const a of apps) {
		if (!byAbil.has(a.abil)) byAbil.set(a.abil, []);
		byAbil.get(a.abil).push(a);
	}
	const cast = [];
	const ticks = [];
	const tickStreams = [];
	for (const [abil, group] of byAbil) {
		const name = abil.toLowerCase();
		const named = [...summonLabels].some((l) => name.includes(l));
		// ⚓ A stream is a SUMMON TICK only when the ability declares a summon. Regularity
		// alone is not enough: Keqing's eight consecutive slashes, Ayaka's nineteen
		// Soumetsu cuts and Wanderer's five Kyougen hits are all evenly spaced and all
		// belong to the CAST — `summons[]` means a thing left in the world, and only the
		// corpus can say that. Classifying by cadence put them in the wrong column and
		// made four bursts read as applying nothing.
		const gaps = group.slice(1).map((x, i) => x.frame - group[i].frame);
		const even = gaps.length >= 2 && new Set(gaps).size === 1 && gaps[0] > 0;
		const isTick = named || (even && summonLabels.size > 0);
		(isTick ? ticks : cast).push(...group);
		if (even && !isTick) tickStreams.push(`${abil} ×${group.length}/${gaps[0]}f`);
	}
	cast.sort((a, b) => a.frame - b.frame);
	ticks.sort((a, b) => a.frame - b.frame);
	// ⚠️ A recurring stream on an ability that declares NO summon is a finding, not
	// plumbing: something in the game leaves a thing in the world that our corpus does
	// not model (Amber's Fiery Rain, Dori's connector, Collei's Kitty). ⛔ It must not
	// be read as "this cast applies nothing" — the emptiness of the cast column here is
	// an artifact of the split, not a statement about the cast.
	return { cast, ticks, regular: tickStreams };
}

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
			out.push({
				label: s.label,
				kind: e.type,
				spawnsAt: s.spawnsAt ?? 0,
				firstTick: (s.spawnsAt ?? 0) + f(t.firstTickDelay ?? 0),
				interval: f(t.interval ?? 0)
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

	const drivers = JSON.parse(readFileSync(DRIVERS, 'utf8'));
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
		const drv = drivers[gk];
		const sets = new Map();
		for (const a of char.abilities ?? []) {
			const ctx = prereqFor(a.conditions, drv);
			if (!ctx || !ctx.label) continue;
			if (!sets.has(ctx.label))
				sets.set(ctx.label, { label: ctx.label, prereq: ctx.prereq, captures: [] });
		}
		if (sets.size) driverTable[gk] = { sets: [...sets.values()] };
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

	const variantPicks = {};

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
			// PICK_BEST: where our schema is ambiguous about WHICH gcsim variant a map
			// describes (a plunge, a bow's partial draw), try each and keep the one that
			// agrees — then report the choice, so an ambiguity never masquerades as a
			// clean match.
			const candidates = [m.dumpKey, ...(m.alternatives ?? [])].filter(Boolean);
			let g = null;
			let picked = null;
			let bad = null;
			for (const key of candidates) {
				const cand = byKey.get(key);
				if (!cand || cand.error || !cand.frames) continue;
				const wrong = KEYS.filter(
					(k) => m.frames[k] !== undefined && m.frames[k] !== cand.frames[k]
				);
				if (g === null || wrong.length < bad.length) {
					g = cand;
					picked = key;
					bad = wrong;
				}
			}
			if (!g) {
				uncovered.push({
					id: char.id,
					path: m.path,
					reason:
						m.uncoveredReason ??
						(!m.dumpKey
							? 'no gcsim analogue'
							: (byKey.get(m.dumpKey)?.error ?? `not captured (${m.dumpKey})`))
				});
				continue;
			}
			if (m.alternatives?.length) {
				const bucket = (variantPicks[picked] ??= { ok: 0, off: 0 });
				if (bad.length) bucket.off++;
				else bucket.ok++;
			}
			if (bad.length) {
				mismatches.push({
					id: char.id,
					path: m.path,
					picked: m.alternatives?.length ? picked : null,
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
		variantPicks,
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
	p('| character | map | read as | keys (ours → gcsim) |');
	p('| --- | --- | --- | --- |');
	for (const [id, rows] of byChar) {
		for (const r of rows) p(`| ${id} | \`${r.path}\` | ${r.picked ?? ''} | ${r.keys.join(', ')} |`);
	}
	p();

	if (Object.keys(d.variantPicks).length) {
		p('### Which gcsim variant our ambiguous maps actually describe');
		p();
		p('⚓ A finding, not plumbing. Our schema has ONE `plungeFrames` and does not say');
		p('whether it means the low or the high plunge, and one `chargeHits` array that');
		p("does not say which draw level gcsim's `aim` default corresponds to. Resolved by");
		p('matching rather than by assumption:');
		p();
		p('| gcsim variant | maps that match it | maps that do not |');
		p('| --- | --- | --- |');
		for (const [k, v] of Object.entries(d.variantPicks)) p(`| \`${k}\` | ${v.ok} | ${v.off} |`);
		p();
	}

	// --- unresolved drivers -------------------------------------------------
	if (Object.keys(d.unresolved).length) {
		p('### Known-unresolved drivers');
		p();
		p('These characters have a condition-gated ability the driver table cannot yet');
		p('reach. ⛔ Their maps must be excluded from the migration until adjudicated.');
		p();
		for (const [id, why] of Object.entries(d.unresolved)) p(`- **${id}** — ${why}`);
		p();
	}

	// --- uncovered ----------------------------------------------------------
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
	p('| character | ability | authored (first / interval) | observed (first / interval × n) |');
	p('| --- | --- | --- | --- |');
	for (const t of d.tickRows) {
		const a = t.authored.length
			? t.authored.map((x) => `${x.label} ${x.firstTick}f / ${x.interval}f`).join('<br>')
			: '—';
		const o = t.observed.length
			? t.observed
					.map(
						(x) =>
							`${x.abil} ${x.first}f / ${x.interval ?? '—'}f × ${x.n}${x.spread > 2 ? ' ⚠️ irregular' : ''}`
					)
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
