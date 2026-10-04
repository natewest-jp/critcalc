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
	frameMapDisagreements,
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
// ⚓ Same law: the tick-CAP rule is imported, never restated. An audit that
// re-derives a rule comes to measure a model we no longer have (L4d).
const { tickCapOf, summonTickSeries } = await import('../src/lib/sim/summons.ts');
// ⚓ And the cast-side rule (ICD cap round, 2026-10-04): §4c replays each authored
// `application[]` through the planner's OWN per-cast resolution, so the comparison
// against gcsim's applied flags is the planner's answer, not a re-derivation of it.
const { resolveCastApplications } = await import('../src/lib/sim/aura.ts');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = join(REPO_ROOT, 'docs/curation/gcsim-frames-diff.md');

const FPS = 60;
const f = (seconds) => Math.round(seconds * FPS);

/**
 * ⚠️⚠️ HOW LONG THE DUMPER WATCHES AFTER EACH CAST, and it is load-bearing for the
 * tick-COUNT column. At the 900-frame default, every summon that outlives 15 s reads
 * SHORT — Zhongli's 31 s stele reported 7 ticks against our 14, Lisa 27 against 30 —
 * and those are the horizon stopping, not a divergence. 2400 clears the longest
 * authored summon (the stele's 1860 f plus its cast) with room to spare.
 *
 * ⚓ It is not enough on its own: `TICK_COUNT_MARGIN` below still suppresses the flag
 * for any stream that runs close to the edge, because a NEW long summon must not
 * silently become a finding the day it lands.
 */
const HORIZON = 2400;
/** A stream whose last tick lands within this of the horizon is not count-checked. */
const TICK_COUNT_MARGIN = 200;

/**
 * ⚓⚓ THE CONSTELLATION THE DUMP RUNS AT, and every constellation-aware read on OUR
 * side must use this same number. It is one constant rather than two literals because
 * the first cut was not: the dumper defaulted to C0 while the authored column resolved
 * `tickCapOf` at C6, so Sigewinne's C1 cap of 8 was reported as disagreeing with
 * gcsim's C0 measurement of 5 — three false findings, on exactly the three characters
 * the constellation field was built for.
 */
const DUMP_CONS = 0;

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
		// ⚓ Through `summonTickSeries` rather than a raw scan of `effects`, so a
		// CONSTELLATION-GATED series is resolved the way the sim resolves it — at
		// `DUMP_CONS`, the level gcsim was run at. ⚠️ Kaeya is why: her two series are
		// `not C6` / `C6` and mutually exclusive, so a raw scan reported "2 authored
		// vs 1 observed" and suppressed her count check as ambiguous when the pairing
		// is in fact exact.
		const live = new Set(
			summonTickSeries(s, DUMP_CONS, (x) => x.type === 'damage').map((x) => x.effect)
		);
		for (const e of s.effects ?? []) {
			const t = e.trigger;
			if (t?.type !== 'summonTick' || e.type !== 'damage') continue;
			if (!live.has(e)) continue;
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
			const firstDelay = t.firstTickDelay !== undefined ? f(t.firstTickDelay) : interval;
			// ⚓ The tick COUNT the sim will actually fire, read back the same way
			// the gate is (tick-cap round, 2026-08-18). ⛔ The derivation is NOT
			// restated here — `tickCapOf` is the rule and this mirrors the walk in
			// `collectSummonTicks`, including the one-interval widening a cap buys
			// for the boundary tick.
			const cap = tickCapOf(e, DUMP_CONS);
			const end = s.duration !== undefined ? f(s.duration) : null;
			const derived =
				end !== null && interval > 0 ? Math.max(0, Math.ceil((end - firstDelay) / interval)) : null;
			out.push({
				label: s.label,
				kind: e.type,
				spawnsAt: s.spawnsAt ?? 0,
				firstTick: (s.spawnsAt ?? 0) + firstDelay,
				interval,
				cap,
				// What the sim fires: the cap when one is authored, else the walk.
				ticks: cap ?? derived,
				// ⚓ Read back so the annotation is SELF-CHECKING (L5e-a¾). Authoring
				// a gate is a CLAIM about gcsim, and this is the report that
				// re-measures it against the dump's own post-ICD `applied` flag —
				// the same reason the frame rows are diffed rather than trusted.
				// ⛔ The audit never WRITES it.
				// ↻ It no longer carries the `orphanedSchema` guard: the sim reads the
				// key for real since the ICD-group round's b, so this access is a
				// cross-check and nothing more. ⚓ And the check got STRICTER there —
				// it compares the authored RULE against gcsim's own group numbers
				// rather than against an applied count, which is what caught two
				// series whose notes called a bespoke group standard.
				icdGate: t.icdGate ?? 'standard'
			});
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// The measured ICD cadence of one stream
// ---------------------------------------------------------------------------

/** Our model's standard, restated only as a COMPARISON target — the numbers come
 *  from `icd.ts`, never from a literal here. */
const STANDARD_PAIR = { timer: STANDARD_ICD_FRAMES.timer, period: STANDARD_ICD_FRAMES.hits };

/**
 * Collapse a stream's per-hit `icd` readings to one cadence.
 *
 * ⚓ gcsim keys ICD state by `(character, tag)` and the tag is a property of the
 * ability, so every hit of one `abil` reads the same group — `mixed` is therefore
 * a FINDING (two abilities sharing a log string), not a shape to average over.
 *
 * ⛔ Carries no group name. The four numbers ARE the group
 * (docs/icd-group-round.md §2 / §6a).
 */
function streamIcd(hits) {
	const seen = hits.map((h) => h.icd).filter(Boolean);
	if (!seen.length) return null;
	const sig = (x) => `${x.none}|${x.timer}|${x.period}|${x.applies}|${x.mult}|${x.regular}`;
	const first = seen[0];
	return { ...first, mixed: seen.some((x) => sig(x) !== sig(first)) };
}

/**
 * A CAST's hits as their per-COUNTER streams, each with its own cadence.
 *
 * ⚠️⚠️ Never `streamIcd` over the whole cast (ICD cap round, 2026-10-04): it read the
 * FIRST hit's cadence for all of them, so Chevreuse's Burst — an `ICDTagNone`
 * grenade, then eight shells on a 180f group that applies twice — read `none`, and
 * the cast was missing from §4b. A cast lands several abilities; each is a stream.
 */
function castStreams(hits) {
	// ⚓ Keyed by gcsim's COUNTER (tag + group), not the ability string: two
	// abilities can share one counter or sit on two with the same numbers (the
	// Pyro Traveler's hold). Every `ICDTagNone` hit is one stream — it spends nothing.
	const by = new Map();
	for (const h of hits) {
		const k = !h.icd ? `?${h.abil}` : h.icd.none ? 'none' : h.icd.counter;
		if (!by.has(k)) by.set(k, []);
		by.get(k).push(h);
	}
	return [...by.values()].map((xs) => {
		const abil = [...new Set(xs.map((x) => x.abil))].join(' + ');
		const icd = streamIcd(xs);
		return {
			abil,
			n: xs.length,
			applied: xs.filter((x) => x.applied).length,
			icd,
			gate: icdGateFor(icd)
		};
	});
}

/** What the schema would have to say to reproduce a measured cadence:
 *  `'none'` · `'standard'` (absent) · an `IcdWindow` · or `null` when the
 *  measurement is unavailable. */
function icdGateFor(icd) {
	if (!icd) return null;
	if (icd.none) return 'none';
	// ⚓ The CAP is the third number (ICD cap round, 2026-10-04): a list that ends in
	// a 0 stops applying after `applies` hits. Stated only beside `every` — with no
	// second application, "first only" already says it.
	const cap = icd.period && !icd.open ? icd.applies : undefined;
	if (
		icd.timer === STANDARD_PAIR.timer &&
		icd.period === STANDARD_PAIR.period &&
		cap === STANDARD_ICD_FRAMES.cap
	)
		return 'standard';
	return {
		timer: icd.timer,
		...(icd.period ? { every: icd.period } : {}),
		...(cap !== undefined ? { cap } : {})
	};
}

/** An AUTHORED gate in the same shorthand the measured column uses, so the two
 *  can be read against each other at a glance. ⚓ Since sub-landing b the field
 *  can hold a window, and printing an object here read `[object Object]`. */
function fmtGate(gate) {
	if (gate === 'standard' || gate === 'none') return `\`${gate}\``;
	return `${gate.timer}f / ${gate.every ? `every ${gate.every}` : 'first only'}${gate.cap ? ` · ${gate.cap} max` : ''}`;
}

/** Do an authored gate and a measured cadence say the same thing? ⚠️ Compared as
 *  the RULE, not as the applied count — which is the whole point of §6a. */
const gateAgrees = (authored, measured) =>
	authored === measured ||
	(typeof authored === 'object' &&
		typeof measured === 'object' &&
		measured !== null &&
		authored.timer === measured.timer &&
		(authored.every ?? null) === (measured.every ?? null) &&
		(authored.cap ?? null) === (measured.cap ?? null));

/** A measured cadence in the report's own shorthand. ⚓ `first only` is `every`
 *  absent — a counter the window can never reach. */
function fmtIcd(icd) {
	if (!icd) return '—';
	// ⚠️ `mixed` is printed on `none` too — the early return used to drop it.
	const mixed = icd.mixed ? ' ⚠️ **mixed**' : '';
	if (icd.none) return `\`none\`${mixed}`;
	const period = icd.period ? `every ${icd.period}` : 'first only';
	const mult = icd.mult !== 1 ? ` · ×${icd.mult}` : '';
	// ⚓ `N max` is the window's cap: every list but the reaction groups' ends in a
	// 0, so it applies N times at its period and then stops (ICD cap round).
	const cap = icd.period && !icd.open ? ` · ${icd.applies} max` : '';
	const irregular = icd.regular ? '' : ' ⚠️ **irregular list**';
	return `${icd.timer}f / ${period}${cap}${mult}${irregular}${mixed}`;
}

/** One cast's streams' cadences, labelled by stream once there is more than one. */
function fmtCastIcd(streams) {
	if (streams.length === 1) return fmtIcd(streams[0].icd);
	return streams.map((st) => `${st.abil}: ${fmtIcd(st.icd)}`).join('<br>');
}

/** A hit's application verdict for the §4 list. ⚓ `[icd]` only when gcsim's ICD
 *  check READ A 0 (`icdVal`) — a hit with no gauge to gate gets no check at all,
 *  and calling it suppressed mislabelled Chevreuse's Surging Blade. */
function hitMark(x) {
	if (x.element === 'physical' || x.applied) return '';
	return x.icdVal === 0 ? ' [icd]' : ' [0U]';
}

/** Frames two nominal lists may differ by and still be the same hits. */
const PAIR_TOLERANCE_F = 6;

/**
 * §4c: the cast's authored `application[]` replayed through the planner, against
 * the hits gcsim actually applied (ICD cap round, 2026-10-04).
 *
 * ⚓ TWO questions, kept apart, because they have different fixes:
 *   1. does the authored LIST name gcsim's gauge-carrying hits (count + frames)?
 *      — a data question, answered by re-reading the capture;
 *   2. when it does, does the planner's ICD verdict match gcsim's per hit?
 *      — a gate question, answered by `icdGate` / `noICD` / `cap`.
 * A "gauge-carrying" gcsim hit is one that applied or that its ICD check BLOCKED;
 * a hit with no gauge is not an entry (cast-icd-gate round §4).
 *
 * ⚠️ Isolated, one cast in an empty core — exactly what the planner's per-cast
 * counter models. ⛔ A shared counter across casts or characters is not seen here.
 */
function replayCast(char, ability, node, cast, all) {
	const app = node.application ?? ability.application;
	if (!app) return null;
	const refs = app.filter((e) => e.element && typeof e.element !== 'string').length;
	const nominal = app.filter((e) => typeof e.element === 'string');
	const ours = resolveCastApplications(
		char,
		app,
		ability.abilityType,
		ability.noICD,
		ability.icdGate
	).map((x) => x.frame);
	const gauge = cast.filter((x) => x.element !== 'physical' && (x.applied || x.icdVal === 0));
	const theirs = gauge.filter((x) => x.applied).map((x) => x.frame);
	const sorted = [...nominal].sort((x, y) => x.frame - y.frame);
	const pairs =
		sorted.length === gauge.length &&
		sorted.every((e, i) => Math.abs(e.frame - gauge[i].frame) <= PAIR_TOLERANCE_F);
	// Once the lists pair, which frames the planner and gcsim disagree on — as
	// MULTISETS: several hits can share a frame, and which of them applied is not
	// an order the two sides agree on (Klee's Burst lands pairs).
	// ⚓ The third question: an entry whose gcsim hit carries NO gauge (`[0U]`).
	// The old capture could not tell that from a blocked hit, so the migration
	// wrote both as an entry without `units` — and one the planner lets through
	// applies a provisional 1U gcsim never applies. Matched against every hit,
	// summon-named ones included, by frame (±2f) and element.
	const noGauge = sorted
		.filter((e) => e.units === undefined)
		.filter((e) => {
			const near = all.filter(
				(x) =>
					Math.abs(x.frame - e.frame) <= 2 && (x.element === e.element || x.element === 'physical')
			);
			return near.length > 0 && near.every((x) => !x.applied && x.icdVal !== 0);
		})
		.map((e) => ({ frame: e.frame, applies: ours.includes(e.frame) }));
	let gateDiff = null;
	if (pairs) {
		const tally = new Map();
		for (const fr of ours) tally.set(fr, (tally.get(fr) ?? 0) + 1);
		for (const fr of theirs) tally.set(fr, (tally.get(fr) ?? 0) - 1);
		gateDiff = [...tally]
			.filter(([, n]) => n !== 0)
			.sort((x, y) => x[0] - y[0])
			.flatMap(([frame, n]) => Array.from({ length: Math.abs(n) }, () => ({ frame, ours: n > 0 })));
	}
	return {
		refs,
		nominal: sorted.map((e) => e.frame),
		gauge: gauge.map((x) => x.frame),
		ours,
		theirs,
		pairs,
		gateDiff,
		noGauge
	};
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
	const dump = runDumper({
		cons: DUMP_CONS,
		drivers: driverTable,
		horizon: HORIZON,
		only: only ? gcsimKeyFor(only) : ''
	});

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
	// ⚓ Probe coverage, reported rather than assumed. `OnEnemyDamage` fires from a
	// zero-delay task, so whether `c.F` at callback time is still the hit's frame is
	// an empirical question — and a hole would show up as a hit with no cadence, not
	// as an error. ⛔ Don't drop this line; it is the only thing that says the join
	// held.
	const icdCoverage = { hits: 0, seen: 0 };
	for (const cd of Object.values(dump.characters))
		for (const a of cd.abilities ?? [])
			for (const x of a.applications ?? []) {
				icdCoverage.hits++;
				if (x.icd) icdCoverage.seen++;
			}

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
			// ⚓ The compared set includes `anim` and `hit` (2026-09-15) — see the rule's doc
			// in gcsim-map.mjs for the class of stand-in a KEYS-only comparison waved through.
			const bad = frameMapDisagreements(m.frames, g.frames, { normalStyle: m.normalStyle });
			if (bad.length) {
				mismatches.push({ id: char.id, path: m.path, keys: bad });
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
				const vk = variantDumpKey(v.input ?? [], baseKey, v.conditions);
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
				// ⚓ The cast stream's own cadence (cast-icd-gate round, 2026-09-17):
				// the same `streamIcd` / `icdGateFor` the summon cross-check uses, over
				// the CAST hits — read off gcsim's group tables, never inferred from the
				// applied count. `node` is the authored form, for §4b's `authored` column.
				const streams = castStreams(split.cast);
				applicationRows.push({
					id: char.id,
					path: t.path,
					key: t.key,
					node: t.node,
					ability: a,
					streams,
					replay: replayCast(char, a, t.node, split.cast, g.applications ?? []),
					...split
				});
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
				return {
					abil,
					first: frames[0],
					last: frames[frames.length - 1],
					interval: modal,
					n: frames.length,
					spread: tally.size
				};
			});
			// ⚓ The measured ICD verdict per stream (L5e-a¾). gcsim's `applied` flag
			// is the POST-ICD subset of the damage stream, so the gate is observable
			// rather than inferred: compare it against `icd.ts` at standard params.
			// ⚠️ `either` is a real answer, not a missing one — when the interval
			// exceeds the 2.5s timer, standard and none are indistinguishable and
			// ⛔ the series must NOT be annotated on the strength of it.
			for (const o of observed) {
				const frames = streams.get(o.abil);
				const mine = ticks.filter((x) => x.abil === o.abil);
				const applied = mine.filter((x) => x.applied).length;
				const clock = createIcdClock();
				let std = 0;
				for (const fr of frames) if (icdApplies(clock, fr, STANDARD_ICD_FRAMES).applies) std++;
				o.applied = applied;
				o.std = std;
				// ⚓ The CADENCE ITSELF, read off gcsim's exported group tables through
				// the shim's `OnEnemyDamage` probe (§6a). The verdict below measures its
				// EFFECT on this one stream; this is the rule that produced the effect,
				// and it is what a migration can be written from.
				o.icd = streamIcd(mine);
				o.gate = icdGateFor(o.icd);
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
		icdCoverage,
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
	p(
		`- hits carrying a measured gcsim ICD cadence: **${d.icdCoverage.seen}** of **${d.icdCoverage.hits}**`
	);
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
	p("`[icd]` marks a hit gcsim's ICD check blocked at the target; `[0U]` a hit that");
	p('carries no gauge at all (no check ran). ↻ Until the ICD cap round both read `[icd]`,');
	p('and two hits in one frame under one ability were married to ONE reading. A');
	p('blocked hit is still a NOMINAL');
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
	p("`gcsim cadence` is each cast stream's own ICD group (window / period / cap), read off");
	p("gcsim's tables the way §5 reads a tick series' — ⚠️ it is the RULE, not the applied");
	p('count; §4b lists the casts whose rule the schema default does not reproduce.');
	p();
	p('| character | ability | cast applications | recurring streams | gcsim cadence |');
	p('| --- | --- | --- | --- | --- |');
	for (const r of d.applicationRows) {
		const fmt = (xs) =>
			xs.length
				? xs
						.map(
							(x) =>
								`+${x.frame} ${x.element}${hitMark(x)}${x.durability ? ` (${x.durability / 25}U)` : ''}`
						)
						.join(' · ')
				: '**—**';
		const ticks = r.ticks.length
			? `${r.ticks.length}× ${[...new Set(r.ticks.map((x) => x.abil))].join(', ')}`
			: r.regular.length
				? `⚠️ regular, no authored summon: ${r.regular.join(', ')}`
				: '';
		p(
			`| ${r.id} | \`${r.path}\` | ${fmt(r.cast)} | ${ticks} | ${r.cast.length ? fmtCastIcd(r.streams) : ''} |`
		);
	}
	p();
	// --- 4b: casts on a non-default group ------------------------------------
	p('### 4b. Casts whose measured cadence is neither standard nor none');
	p();
	p('⚓ The cast-side twin of §5b (cast-icd-gate round, 2026-09-17). Each row is a');
	p('skill/burst whose cast hits run on a real gcsim group the schema default (2.5 s /');
	p('every 3rd hit) does not reproduce, and whose `application[]` has at least two');
	p('entries — with one entry there is nothing to gate. `authored` is what the data');
	p('says today (`noICD`, an `icdGate`, or the default); ⛔ this report never writes it.');
	p();
	p('⚠️ A row is a REVIEW CANDIDATE — pair the gate with the stream OUR `application[]`');
	p('MODELS (one entry may be several gcsim hits; a Durability-0 hit is not an entry).');
	p();
	const castWork = [];
	for (const r of d.applicationRows) {
		const authoredApp = r.node.application ?? r.ability.application;
		if (!authoredApp || authoredApp.length < 2) continue;
		const claim = r.ability.noICD ? 'none' : (r.ability.icdGate ?? 'standard');
		// ⚓ Per STREAM (ICD cap round): a cast whose grouped hits share it with an
		// `ICDTagNone` hit lists the grouped stream, and says the other is there —
		// that hit is what an entry-level `noICD` is for.
		const untagged = r.streams.filter((st) => st.gate === 'none');
		for (const st of r.streams) {
			if (!st.gate || st.gate === 'standard' || st.gate === 'none') continue;
			// ⚠️ A ONE-hit stream on a counter of its own applies once whatever its
			// group — nothing to gate. Its fix, when §4c disagrees, is an entry
			// `noICD` (the one-hit approximation), never a window.
			if (st.n < 2) continue;
			const others = r.streams.filter((o) => o !== st && o.gate !== 'none');
			castWork.push({
				id: r.id,
				path: r.path,
				stream: r.streams.length > 1 ? st.abil : '',
				n: st.n,
				applied: st.applied,
				icd: st.icd,
				beside: [
					untagged.length ? `${untagged.reduce((k, o) => k + o.n, 0)} \`none\`` : '',
					others.length ? `⚠️ ${others.length} other group${others.length > 1 ? 's' : ''}` : ''
				]
					.filter(Boolean)
					.join(' · '),
				state: gateAgrees(claim, st.gate) ? '✅ authored' : `⛔ ${fmtGate(claim)}`
			});
		}
	}
	if (!castWork.length) {
		p('_None — every measured cast stream with two or more authored entries is standard or none._');
		p();
	} else {
		p('| character | ability | stream | applied/total | gcsim cadence | beside it | authored |');
		p('| --- | --- | --- | --- | --- | --- | --- |');
		for (const w of castWork) {
			p(
				`| ${w.id} | \`${w.path}\` | ${w.stream} | ${w.applied}/${w.n} | ${fmtIcd(w.icd)} | ${w.beside} | ${w.state} |`
			);
		}
		p();
	}

	// --- 4c: the planner's verdict, hit for hit ------------------------------
	p('### 4c. Cast applications — the planner against gcsim, hit for hit');
	p();
	p('⚓ ICD cap round, 2026-10-04. Each authored `application[]` replayed through the');
	p("planner's own `resolveCastApplications` (one cast, its own counter), beside the hits");
	p('gcsim applied in the same isolated cast. Two kinds of disagreement, with different');
	p('fixes:');
	p();
	p(
		'- **⛔ gate** — the list names the same hits as gcsim (count, ±' +
			PAIR_TOLERANCE_F +
			'f), and the'
	);
	p('  planner applies a different subset: an `icdGate` / `noICD` / `cap` question.');
	p("- **⚠️ list** — the authored list is not gcsim's gauge-carrying hits (an extra or");
	p('  missing entry, or a timing shift): a data question. ⚠️ Some are deliberate —');
	p("  read the ability's notes before calling one wrong.");
	p();
	p('A gauge-carrying gcsim hit applied or was blocked by its ICD; a hit with no gauge');
	p('(`[0U]` in §4) is not an entry. ⛔ A counter shared across casts is not seen here.');
	p();
	const replays = d.applicationRows.filter((r) => r.replay);
	const gateRows = replays.filter((r) => r.replay.pairs && r.replay.gateDiff.length);
	const listRows = replays.filter((r) => !r.replay.pairs);
	const agree = replays.length - gateRows.length - listRows.length;
	p(
		`**${replays.length}** authored casts replayed · **${agree}** agree hit for hit · **${gateRows.length}** ⛔ gate · **${listRows.length}** ⚠️ list`
	);
	p();
	const f = (xs) => (xs.length ? xs.map((x) => `+${x}`).join(' ') : '—');
	if (gateRows.length) {
		p('| character | ability | planner applies | gcsim applies | disagrees at |');
		p('| --- | --- | --- | --- | --- |');
		for (const r of gateRows) {
			const at = r.replay.gateDiff
				.map((g) => `+${g.frame} ${g.ours ? 'extra' : 'missing'}`)
				.join(' · ');
			p(`| ${r.id} | \`${r.path}\` | ${f(r.replay.ours)} | ${f(r.replay.theirs)} | ${at} |`);
		}
		p();
	}
	const ngRows = replays.filter((r) => r.replay.noGauge.length);
	if (ngRows.length) {
		p(`#### Entries whose gcsim hit carries no gauge (${ngRows.length} casts)`);
		p();
		p('An authored entry without `units` whose gcsim hit (cast or summon-named, ±2f) applied');
		p('nothing and was not blocked — Durability 0 in gcsim. **applies** marks the ones the');
		p('planner lets through, as a provisional 1U.');
		p();
		p('| character | ability | entries |');
		p('| --- | --- | --- |');
		for (const r of ngRows)
			p(
				`| ${r.id} | \`${r.path}\` | ${r.replay.noGauge.map((e) => `+${e.frame}${e.applies ? ' **applies**' : ''}`).join(' · ')} |`
			);
		p();
	}
	if (listRows.length) {
		p('<details><summary>⚠️ list rows (' + listRows.length + ')</summary>');
		p();
		p(
			'| character | ability | authored entries | gcsim gauge hits | planner applies | gcsim applies |'
		);
		p('| --- | --- | --- | --- | --- | --- |');
		for (const r of listRows) {
			const ref = r.replay.refs ? ` (+${r.replay.refs} ref)` : '';
			p(
				`| ${r.id} | \`${r.path}\` | ${f(r.replay.nominal)}${ref} | ${f(r.replay.gauge)} | ${f(r.replay.ours)} | ${f(r.replay.theirs)} |`
			);
		}
		p();
		p('</details>');
		p();
	}
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
	p('↻ **And the CADENCE is measured too now** (icd-group-round §6a). The `gcsim` column');
	p("is gcsim's own group data — its reset window in frames, and how many hits apart an");
	p('application falls inside it — read off `ICDGroupResetTimer` /');
	p('`ICDGroupEleApplicationSequence` by a probe in the dumper, because the debug log does');
	p('not carry the tag or the group at all. ⛔ **Numbers, never group names**: gcsim has 58');
	p('and their entire content is this pair. `first only` means no second hit of the window');
	p('ever applies; `N max` means the group applies N times at that period and then stops,');
	p('which the pair alone cannot state.');
	p();
	p(
		'| character | ability | authored (first / interval · icd) | observed (first / interval × n · applied) | gcsim cadence |'
	);
	p('| --- | --- | --- | --- | --- |');
	for (const t of d.tickRows) {
		const a = t.authored.length
			? t.authored
					.map(
						(x) =>
							`${x.label} ${x.firstTick}f / ${x.interval}f × ${x.ticks ?? '—'}${x.cap !== null && x.cap !== undefined ? ' `cap`' : ''} · ${fmtGate(x.icdGate)}`
					)
					.join('<br>')
			: '—';
		const o = t.observed.length
			? t.observed
					.map((x) => {
						// ⚠️ Flagged only when the AUTHORED claim contradicts the
						// measurement. ↻ Since sub-landing b the comparison is against
						// the measured RULE (`gate`) rather than against the applied
						// COUNT — which is stricter, and is what caught two series whose
						// notes called a bespoke group standard because its effect on one
						// cadence happened to coincide.
						// ⚠️ And only when the pairing is ONE-to-ONE. Emilie's burst has
						// one authored series against two measured streams on different
						// groups, so an id-join flagged a deliberate choice; §5b marks
						// that shape "pair by eye" instead.
						const claim =
							t.authored.length === 1 && t.observed.length === 1 ? t.authored[0].icdGate : null;
						const bad = claim && x.gate ? !gateAgrees(claim, x.gate) : false;
						// ⚠️ The tick-COUNT check is separate from the ICD one and is
						// flagged separately: ours-vs-gcsim on `× n` says whether the
						// SERIES runs the right length, `applied/total` says whether the
						// gate is right. ⛔ A count mismatch is only meaningful on a
						// one-to-one pairing and when gcsim's last tick is comfortably
						// inside the dumper's horizon — Lisa reads 3 short purely
						// because the horizon stops watching.
						const mine =
							t.authored.length === 1 && t.observed.length === 1 ? t.authored[0].ticks : null;
						const nOff =
							mine !== null &&
							mine !== undefined &&
							mine !== x.n &&
							x.last <= HORIZON - TICK_COUNT_MARGIN;
						return `${x.abil} ${x.first}f / ${x.interval ?? '—'}f × ${x.n}${x.spread > 2 ? ' ⚠️ irregular' : ''} · ${x.applied}/${x.n} \`${x.verdict}\`${bad ? ' ⚠️ **authored disagrees**' : ''}${nOff ? ` ⚠️ **count ${mine}→${x.n}**` : ''}`;
					})
					.join('<br>')
			: '—';
		const cad = t.observed.length ? t.observed.map((x) => fmtIcd(x.icd)).join('<br>') : '—';
		p(`| ${t.id} | \`${t.path.split('__').pop()}\` | ${a} | ${o} | ${cad} |`);
	}
	p();

	// --- the window census --------------------------------------------------
	p('### 5b. Tick series whose measured cadence is neither standard nor none');
	p();
	p('⚓ **The census sub-landing b was written from**, and the standing check on it. Each');
	p("row is a summon tick series whose gcsim group is a real window our schema's default");
	p('(2.5 s / every 3rd hit) does not reproduce. `authored` is what the data currently');
	p('says; ⛔ this report never writes it.');
	p();
	p('⚠️ A row is a REVIEW CANDIDATE, not a correction, and **pairing is by eye** — the');
	p('stream named here must be the one our authored series MODELS. Emilie is the case:');
	p('gcsim runs her burst case at Level 3 on the default group and only the decayed');
	p('Level-1 stream carries her bespoke one, so her burst is deliberately left bare.');
	p();
	p('↻ `N max` is now authorable as `IcdWindow.cap` (ICD cap round, 2026-10-04), and the');
	p('`authored` column compares all three numbers.');
	p();
	const work = [];
	for (const t of d.tickRows) {
		for (const o of t.observed) {
			if (!o.gate || o.gate === 'standard' || o.gate === 'none') continue;
			// ⚠️ Only ONE-to-ONE rows get a verdict. With two observed streams under
			// one authored series the pairing is a judgement — Emilie's burst is
			// exactly that, and a naive id-join called her deliberately-bare series
			// a mismatch against a stream it does not model.
			const claim =
				t.authored.length === 1 && t.observed.length === 1 ? t.authored[0].icdGate : null;
			work.push({
				id: t.id,
				path: t.path.split('__').pop(),
				o,
				state: !claim
					? `⚠️ pair by eye (${t.authored.length} authored / ${t.observed.length} observed) — currently ${t.authored.length === 1 ? fmtGate(t.authored[0].icdGate) : '—'}`
					: gateAgrees(claim, o.gate)
						? '✅ authored'
						: `⛔ ${fmtGate(claim)}`
			});
		}
	}
	if (!work.length) {
		p('_None — every measured tick series is standard or none._');
		p();
	} else {
		p('| character | ability | stream | applied/total | gcsim cadence | authored |');
		p('| --- | --- | --- | --- | --- | --- |');
		for (const w of work) {
			p(
				`| ${w.id} | \`${w.path}\` | ${w.o.abil} | ${w.o.applied}/${w.o.n} \`${w.o.verdict}\` | ${fmtIcd(w.o.icd)} | ${w.state} |`
			);
		}
		p();
	}

	return L.join('\n');
}

main();
