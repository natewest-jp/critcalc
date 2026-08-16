/**
 * scripts/audit-gcsim-reactions.mjs
 *
 * Diffs the planner's elemental model against gcsim, per the gauge round's L0
 * (docs/gauge-round-L0.md). Writes docs/curation/gcsim-reaction-diff.md.
 *
 * ⛔ A REVIEW-CANDIDATE GENERATOR, NEVER AN AUTO-FIXER — the same contract as
 * audit-genshin-db-diff.mjs. gcsim is an implementation-level second source
 * with a different method, not the game; where it and KQM disagree, evaluate
 * both. (The gauge round already found places where gcsim itself is buggy.)
 *
 * Three tiers, in this order, because a trajectory tells you WHERE you
 * diverged and a reaction list only tells you THAT you did:
 *
 *   1. Applications — (ordinal, element, units, frame). Ground truth for the
 *      whole data class the round is about: hitmarks, gauge units, and whether
 *      a cast applies at all.
 *   2. Aura trajectory — gcsim's gauge before/after each application.
 *      ⚠️ REFERENCE ONLY until L5: the planner has no gauge to compare yet.
 *      This tier exists now so the target is on record before we build to it.
 *   3. Reactions — the derived list, which is what actually drives buff
 *      windows and is therefore what a user can currently see going wrong.
 *
 * Usage:
 *   node scripts/audit-gcsim-reactions.mjs [--write]
 */

// ⚓ MUST be first, and MUST stay a static import: it registers the `$lib`
// resolver + `import.meta.glob` shim that let the dynamic `import()`s below
// load the real parser. Static imports are evaluated before the module body,
// so the hooks are in place by the time those awaits run — which is the whole
// reason the parser imports are dynamic rather than static.
import './lib/alias-hook.mjs';

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	buildConfig,
	extractFacts,
	gcsimCommit,
	runGcsimStable,
	translateNotation,
	ensureBinary
} from './lib/gcsim.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(REPO_ROOT, 'docs/curation/gcsim-reaction-diff.md');

const { parseNotation } = await import('../src/lib/utils/notationParser.ts');
const { tokenizeNotation } = await import('../src/lib/utils/tokenizer.ts');
const { FPS } = await import('../src/lib/utils/frames.ts');
const { createIcdClock, icdApplies, icdTagFor, resolveActionIcd } =
	await import('../src/lib/utils/icd.ts');
const { resolveCastApplications } = await import('../src/lib/sim/aura.ts');

// ---------------------------------------------------------------------------
// Corpus
// ---------------------------------------------------------------------------

const CHAR_DIR = join(REPO_ROOT, 'src/lib/data/characters');
const characters = readdirSync(CHAR_DIR)
	.filter((f) => f.endsWith('.json'))
	.map((f) => JSON.parse(readFileSync(join(CHAR_DIR, f), 'utf8')));
const byName = new Map(characters.map((c) => [c.displayName, c]));
const byId = new Map(characters.map((c) => [c.id, c]));
const lookupChar = (name) => byName.get(name) ?? null;

/**
 * Hand-picked to span the reaction families, plus one long rotation to
 * exercise decay and one plunge-heavy rotation (plunges are never ICD-gated,
 * which makes them the worst case for the current no-consumption model).
 *
 * ⛔ No bracket groups, optionals or `~?s` — the translator reports those
 * rather than guessing, and a fixture should state one definite path.
 */
const FIXTURES = [
	{ name: 'melt — cryo aura then pyro', notation: 'Kaeya E > Xiangling E Q' },
	{ name: 'vaporize — hydro then pyro', notation: 'Xingqiu E Q > Bennett E Q > Xiangling E Q' },
	{ name: 'electro-charged', notation: 'Barbara E > Fischl E Q > Barbara N3' },
	{ name: 'freeze', notation: 'Kaeya E Q > Mona E Q > Kaeya N3 N3' },
	{ name: 'quicken / aggravate', notation: 'Nahida E Q > Fischl E Q > Fischl N3' },
	{ name: 'bloom', notation: 'Nahida E Q > Xingqiu E Q' },
	{ name: 'burning', notation: 'Collei E Q > Xiangling E Q' },
	{ name: 'swirl-heavy — the VV case', notation: 'Xiangling E Q > Sucrose N4 E Q N4' },
	{ name: 'crystallize — geo on aura', notation: 'Fischl E Q > Ningguang E N3 > Zhongli E' },
	{ name: 'plunge spam — never ICD-gated', notation: 'Kaeya E > Xiao E Q P P P P' },
	{
		name: 'long rotation — exercises decay',
		notation: 'Kaeya E Q ~20s > Xiangling E Q ~20s > Fischl E Q ~20s > Kaeya E'
	},
	{ name: 'catalyst normals — ICD cadence', notation: 'Kaeya E > Klee N5 C N5 C' }
];

// ---------------------------------------------------------------------------
// Our side: applications derived from the IR + the SHARED ICD model
// ---------------------------------------------------------------------------

/**
 * The planner emits `reaction` events but never an "application" event — an
 * application that reacts with nothing is invisible in the IR. So we replay
 * the model's own rule over the IR:
 *
 *   - every E/Q cast applies on its authored `application[]` schedule, at
 *     `cast.time + entry.frame`, behind the cast's OWN ICD counter (⛔ not one
 *     shared across casts — see the census in `resolveActionIcd`)
 *   - every N/C/P swing with a resolved element applies at its swing END
 *     (`action.time + action.duration`), behind the ICD clock
 *
 * ⚓⚓ BOTH RULES ARE IMPORTED, NOT RESTATED. The ICD gating calls
 * `$lib/utils/icd.ts` and the cast schedule calls `resolveCastApplications` from
 * `$lib/sim/aura.ts` — the same functions the parser calls.
 *
 * 🐛 This mattered within one landing. Until L4d the cast rule was written out
 * here as "every cast applies the caster's element at cast.time", and when the
 * engine stopped doing that, the oracle went on measuring the old model and
 * reported the baseline UNCHANGED. An oracle that silently describes a model you
 * no longer have is worse than no oracle. ⛔ Never inline either rule again.
 */
function ourApplications(parsed) {
	const clocks = new Map();
	const out = [];

	const timed = parsed.events
		.filter((e) => e.kind === 'cast' || e.kind === 'action')
		.map((e) =>
			e.kind === 'cast' ? { at: e.time, ev: e } : { at: e.time + (e.duration ?? 0), ev: e }
		)
		.sort((a, b) => a.at - b.at || a.ev.id - b.ev.id);

	for (const { at, ev } of timed) {
		const char = byId.get(ev.characterId);
		if (!char) continue;

		if (ev.kind === 'cast') {
			// The resolved ability the cast actually used, and the variant its token
			// selected — the same pair `emitReactionsAtCast` is handed.
			const ability = char.abilities?.find((a) => a.id === ev.abilityId);
			const variant = ability?.variants?.find((v) => (v.input ?? []).includes(ev.label));
			const list = variant?.application ?? ability?.application;
			for (const app of resolveCastApplications(char, list, ev.ability, ability?.noICD)) {
				out.push({
					time: at + app.frame,
					characterId: ev.characterId,
					element: app.element,
					kind: ev.ability,
					label: ev.label
				});
			}
			continue;
		}

		if (ev.action !== 'normal' && ev.action !== 'charged' && ev.action !== 'plunge') continue;
		if (!ev.element) continue; // physical swings reach no clock

		const normalAbility = char.abilities?.find((a) => a.abilityType === 'normal');
		const params = resolveActionIcd(ev.action, char.weapon, normalAbility?.noICD);
		if (params) {
			const key = `${ev.characterId}:${icdTagFor(ev.action)}`;
			let clock = clocks.get(key);
			if (!clock) {
				clock = createIcdClock();
				clocks.set(key, clock);
			}
			if (!icdApplies(clock, at, params).applies) continue;
		}
		out.push({
			time: at,
			characterId: ev.characterId,
			element: ev.element,
			kind: ev.action,
			label: ev.label
		});
	}

	return out;
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

const f2s = (frames) => (frames / 60).toFixed(2);

function diffFixture(fixture) {
	const parsed = parseNotation(fixture.notation, lookupChar, 8);
	const { lines, warnings, team } = translateNotation(fixture.notation, {
		tokenize: tokenizeNotation,
		lookupChar
	});

	const problems = [...warnings];
	if (parsed.unknownTokens.length) {
		problems.push(`planner could not resolve: ${parsed.unknownTokens.join(', ')}`);
	}
	const unmapped = team.filter((c) => !c.weapon);
	for (const c of unmapped) problems.push(`${c.id} has no weapon type; cannot build a config`);
	if (!team.length) return { fixture, skipped: 'no resolvable team', problems };

	// ⚠️⚠️ gcsim's `duration` option is SECONDS; `parsed.totalDuration` is FRAMES
	// (gauge-round.md C1). Missing this division told gcsim to simulate ~30×
	// longer than the rotation, and the extra summon ticks it accumulated read as
	// perfectly plausible RNG drift on its side of the diff — 200 applications
	// became 215. ⚓ The only thing that caught it was checking the oracle's
	// counts against the recorded baseline instead of trusting the reasoning.
	const duration = Math.ceil(parsed.totalDuration / FPS + 10);
	let config;
	try {
		config = buildConfig({ team, lines, swapFrames: 8, duration });
	} catch (err) {
		return { fixture, skipped: err.message, problems };
	}

	const run = runGcsimStable(config);
	if (!run.ok) return { fixture, skipped: `gcsim: ${run.error}`, problems, config };
	if (run.varied) {
		problems.push(
			`gcsim is non-deterministic on this fixture (application counts across runs: ` +
				`${run.counts.join(', ')}) — the modal run is reported. Some kits roll dice ` +
				`(random normal-attack variants, proc chances) and no CLI flag pins the seed.`
		);
	}

	const facts = extractFacts(run.sample);
	const indexToId = new Map(team.map((c, i) => [i, c.id]));

	const theirs = facts.applications.map((a) => ({
		...a,
		characterId: indexToId.get(a.charIndex) ?? `#${a.charIndex}`
	}));
	const ours = ourApplications(parsed);

	// Per-character ordinal pairing: the two engines run the same action
	// SEQUENCE, so the nth application by a character is comparable even when
	// the frames differ — and the frame delta is itself the finding.
	const byChar = new Map();
	for (const a of ours) {
		if (!byChar.has(a.characterId)) byChar.set(a.characterId, { ours: [], theirs: [] });
		byChar.get(a.characterId).ours.push(a);
	}
	for (const a of theirs) {
		if (!byChar.has(a.characterId)) byChar.set(a.characterId, { ours: [], theirs: [] });
		byChar.get(a.characterId).theirs.push(a);
	}

	const rows = [];
	let extraOurs = 0;
	let missingOurs = 0;
	let elementMismatch = 0;
	for (const [characterId, pair] of byChar) {
		const n = Math.max(pair.ours.length, pair.theirs.length);
		for (let i = 0; i < n; i++) {
			const o = pair.ours[i];
			const t = pair.theirs[i];
			if (o && !t) extraOurs++;
			if (!o && t) missingOurs++;
			if (o && t && o.element !== t.element) elementMismatch++;
			rows.push({ characterId, i, ours: o ?? null, theirs: t ?? null });
		}
	}

	const ourReactions = parsed.events
		.filter((e) => e.kind === 'reaction')
		.map((e) => ({ time: e.time, reaction: e.reaction, characterId: e.characterId }));

	return {
		fixture,
		problems,
		config,
		team,
		counts: {
			ours: ours.length,
			theirs: theirs.length,
			extraOurs,
			missingOurs,
			elementMismatch,
			ourReactions: ourReactions.length,
			theirReactions: facts.reactions.length
		},
		rows,
		ourReactions,
		theirReactions: facts.reactions.map((r) => ({
			...r,
			characterId: indexToId.get(r.charIndex) ?? `#${r.charIndex}`
		})),
		trajectory: theirs
	};
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function render(results, commit) {
	const L = [];
	const totals = {
		ours: 0,
		theirs: 0,
		extraOurs: 0,
		missingOurs: 0,
		elementMismatch: 0,
		ourReactions: 0,
		theirReactions: 0
	};
	let ran = 0;
	for (const r of results) {
		if (r.skipped) continue;
		ran++;
		for (const k of Object.keys(totals)) totals[k] += r.counts[k];
	}

	L.push('# gcsim reaction diff');
	L.push('');
	L.push('> Generated by `scripts/audit-gcsim-reactions.mjs`. ⛔ **A review-candidate');
	L.push('> generator, never an auto-fixer** — gcsim is an implementation-level second');
	L.push('> source, not the game. Where it and KQM disagree, evaluate both.');
	L.push('');
	L.push(`**gcsim commit:** \`${commit}\` · **fixtures:** ${ran}/${results.length} ran`);
	L.push('');
	L.push('Config: `hitlag=false` (we do not model hitlag), single target, 1★ weapons,');
	L.push('no artifacts, no substats — none of which affect elemental application.');
	L.push('');
	L.push('## Baseline');
	L.push('');
	L.push('| metric | count |');
	L.push('| --- | --- |');
	L.push(`| applications — ours | ${totals.ours} |`);
	L.push(`| applications — gcsim | ${totals.theirs} |`);
	L.push(`| **we apply, gcsim does not** | **${totals.extraOurs}** |`);
	L.push(`| **gcsim applies, we do not** | **${totals.missingOurs}** |`);
	L.push(`| element mismatch on a paired application | ${totals.elementMismatch} |`);
	L.push(`| reaction events — ours | ${totals.ourReactions} |`);
	L.push(`| reaction damage instances — gcsim | ${totals.theirReactions} |`);
	L.push('');
	L.push('⚠️ The two reaction rows count different things — ours is one event per');
	L.push("triggering application, gcsim's is one damage instance, and burning and");
	L.push('electro-charged tick. **The application rows are the comparable ones.**');
	L.push('');
	L.push('⚠️ **Tier 2 (aura trajectory) is REFERENCE ONLY** — the planner has no gauge');
	L.push("to compare against until L5. gcsim's figures are recorded so the target is on");
	L.push('the record before we build to it.');
	L.push('');

	for (const r of results) {
		L.push(`## ${r.fixture.name}`);
		L.push('');
		L.push('```');
		L.push(r.fixture.notation);
		L.push('```');
		L.push('');
		if (r.problems?.length) {
			L.push('**Translation notes**');
			L.push('');
			for (const p of r.problems) L.push(`- ⚠️ ${p}`);
			L.push('');
		}
		if (r.skipped) {
			L.push(`⛔ **Skipped:** ${r.skipped}`);
			L.push('');
			continue;
		}

		const c = r.counts;
		L.push(
			`applications ours **${c.ours}** / gcsim **${c.theirs}** · ` +
				`extra ${c.extraOurs} · missing ${c.missingOurs} · element mismatch ${c.elementMismatch} · ` +
				`reactions ours **${c.ourReactions}** / gcsim **${c.theirReactions}**`
		);
		L.push('');

		L.push('### 1. Applications');
		L.push('');
		L.push('| char | # | ours | gcsim | Δ frames | units | ability |');
		L.push('| --- | --- | --- | --- | --- | --- | --- |');
		for (const row of r.rows) {
			const o = row.ours;
			const t = row.theirs;
			const oursCell = o ? `${o.element} @ ${f2s(o.time)}s (${o.kind})` : '—';
			const theirsCell = t ? `${t.element} @ ${f2s(t.frame)}s (${t.attackTag})` : '—';
			// ⚓ Both sides are FRAMES now (gauge-round.md C1) — gcsim always was, and
			// since 2026-08-16 so is our IR. This used to convert ours up to meet it.
			const delta = o && t ? `${t.frame - o.time}` : '';
			const units = t ? `${t.units}U` : '';
			const abil = t ? t.ability : '';
			const flag = !o ? ' 🔴' : !t ? ' 🟠' : o.element !== t.element ? ' 🟡' : '';
			L.push(
				`| ${row.characterId}${flag} | ${row.i} | ${oursCell} | ${theirsCell} | ${delta} | ${units} | ${abil} |`
			);
		}
		L.push('');
		L.push(
			'🔴 gcsim applies and we do not · 🟠 we apply and gcsim does not · 🟡 different element'
		);
		L.push('');

		L.push('### 2. Aura trajectory (gcsim — reference)');
		L.push('');
		L.push('| t | char | applied | before | after |');
		L.push('| --- | --- | --- | --- | --- |');
		for (const a of r.trajectory) {
			const fmt = (m) =>
				Object.keys(m).length
					? Object.entries(m)
							.map(([k, v]) => `${k} ${v.toFixed(2)}`)
							.join(', ')
					: '—';
			L.push(
				`| ${f2s(a.frame)}s | ${a.characterId} | ${a.element} ${a.units}U | ${fmt(a.auraBefore)} | ${fmt(a.auraAfter)} |`
			);
		}
		L.push('');

		L.push('### 3. Reactions');
		L.push('');
		L.push('⚠️ **These two columns do not count the same thing.** Ours is one event per');
		L.push("triggering application; gcsim's is one damage INSTANCE, and burning and");
		L.push('electro-charged TICK — so a single reaction there produces many rows.');
		L.push('Compare presence and rough magnitude, never equality.');
		L.push('');
		const tally = (list, key) => {
			const m = new Map();
			for (const x of list) m.set(x[key], (m.get(x[key]) ?? 0) + 1);
			return m;
		};
		const oursT = tally(r.ourReactions, 'reaction');
		const theirsT = tally(r.theirReactions, 'reaction');
		const keys = [...new Set([...oursT.keys(), ...theirsT.keys()])].sort();
		if (keys.length) {
			L.push('| reaction | ours | gcsim |');
			L.push('| --- | --- | --- |');
			for (const k of keys) L.push(`| ${k} | ${oursT.get(k) ?? '—'} | ${theirsT.get(k) ?? '—'} |`);
		} else {
			L.push('_neither side reported a reaction._');
		}
		L.push('');
		L.push(
			`- **ours:** ${r.ourReactions.length ? r.ourReactions.map((x) => `${x.reaction}@${f2s(x.time)}s`).join(', ') : '_none_'}`
		);
		L.push(
			`- **gcsim:** ${r.theirReactions.length ? r.theirReactions.map((x) => `${x.reaction}@${f2s(x.frame)}s`).join(', ') : '_none_'}`
		);
		L.push('');
	}

	return L.join('\n');
}

// ---------------------------------------------------------------------------

const write = process.argv.includes('--write');
ensureBinary();
const commit = gcsimCommit();

const results = [];
for (const fixture of FIXTURES) {
	process.stderr.write(`  ${fixture.name}… `);
	try {
		const r = diffFixture(fixture);
		results.push(r);
		process.stderr.write(r.skipped ? `skipped (${r.skipped.slice(0, 60)})\n` : 'ok\n');
	} catch (err) {
		results.push({ fixture, skipped: err.message, problems: [] });
		process.stderr.write(`error: ${err.message}\n`);
	}
}

const report = render(results, commit);
if (write) {
	mkdirSync(dirname(OUT_PATH), { recursive: true });
	writeFileSync(OUT_PATH, report);
	process.stderr.write(`\nWrote ${OUT_PATH}\n`);
} else {
	process.stdout.write(report);
	process.stderr.write('\n(dry run — pass --write to update the report)\n');
}
