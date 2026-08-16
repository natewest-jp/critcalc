#!/usr/bin/env node
/**
 * scripts/migrate-frames-shape.mjs
 *
 * The one-shot rewrite of every FrameMap into gcsim's slice shape — an explicit
 * animation default (`anim`) plus overrides, with `hit` carrying a normal's hitmark —
 * and the plunge split (`plungeFrames` = HIGH, `lowPlungeFrames` = `lP`).
 * Gauge round L4b; the shape is settled in `docs/gauge-round-L4.md` §3.
 *
 * ⚓ A MIGRATION, not an audit, and the two are deliberately separate programs.
 * `audit-gcsim-frames.mjs` may never write data — that rule is what keeps a wrong
 * upstream value from landing silently — but 1,042 maps cannot be rewritten by hand,
 * so the mechanical rewrite gets its own name (the `migrate-curator-notes.mjs` family)
 * and its output is reviewed as a git diff.
 *
 * ⚠️ Run once, review the diff, commit. It is idempotent — re-running against an
 * already-migrated corpus produces the same bytes — but it is not a maintenance tool:
 * the ongoing check is the audit.
 *
 * Usage:  node scripts/migrate-frames-shape.mjs [--write] [--char <id>]
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { format, resolveConfig } from 'prettier';

import { runDumper } from './lib/gcsim-dump.mjs';
import {
	CHAR_DIR,
	KEYS,
	authoredMaps,
	resolvedKeys,
	driverSetsFor,
	gcsimKeyFor,
	loadDrivers,
	preserveFrameMap,
	toFrameMap
} from './lib/gcsim-map.mjs';

/**
 * ⛔ HOLDBACKS — maps where ours and gcsim's are describing DIFFERENT ACTIONS, not the
 * same action with different numbers. C4b rules that gcsim is the source for frame
 * data, and these are not a disagreement about data; they are a disagreement about
 * what is being measured. Each keeps today's values (`anim = swap`, behaviour
 * unchanged) and is listed in the report for a human.
 *
 * ⚓ Nate 2026-08-16: "apply the C4b rule, flag the odd ones."
 */
const HOLDBACK_CHARACTERS = {
	chasca:
		'unresolved driver — no prereq reproduces her Nightsoul normals, and gcsim reads her skill as one 623f action against our 37f cast.',
	kinich: 'unresolved driver — gcsim errors on his Nightsoul skill under every prereq tried.',
	lan_yan: 'unresolved driver — Feathermoon Ring scores 0/2 under every candidate.',
	varesa:
		'unresolved driver — her skill leaves her airborne, so a post-skill attack reads a plunge animation.'
};

const HOLDBACK_PATHS = {
	'albedo__normal__favonius_bladework_weiss.hits[4]':
		"⚓ OUR DATA IS RIGHT. The curator note says so and says why: gcsim passes `attackHitmarks[3]` into N5's slice — 17f, which cancels BEFORE the hit lands — and calls it a likely typo for `attackHitmarks[4]`. Our 27 is the real N5 hitmark. ⛔ Do not let C4b overwrite a documented upstream bug.",
	'tartaglia__burst__havoc_obliteration_ranged.frames':
		'TRANSPOSED with the melee burst — ours reads 54/53 against gcsim 102/101 and the melee map reads exactly the reverse. A corpus fix, not a migration.',
	'tartaglia__burst__havoc_obliteration_melee.frames':
		'TRANSPOSED with the ranged burst — see above.'
};

/** Any single key moving by a second or more is not drift; the two records are of
 *  different actions. Catches Sigewinne's channelled burst (245→103), the hydro
 *  Traveler's hold (90→405), Furina's charge (47→253), Itto's charge chain (130→51)
 *  and Bennett's level-2 hold (240→340) without naming any of them. */
const HOLDBACK_DELTA_F = 60;

async function main() {
	const args = process.argv.slice(2);
	const write = args.includes('--write');
	const onlyIdx = args.indexOf('--char');
	const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

	const drivers = loadDrivers();
	const files = readdirSync(CHAR_DIR)
		.filter((n) => n.endsWith('.json'))
		.sort();

	const chars = files.map((n) => ({
		file: join(CHAR_DIR, n),
		raw: readFileSync(join(CHAR_DIR, n), 'utf8')
	}));
	for (const c of chars) c.data = JSON.parse(c.raw);

	const driverTable = {};
	for (const c of chars) {
		const sets = driverSetsFor(c.data, drivers[gcsimKeyFor(c.data.id)]);
		if (sets.length) driverTable[gcsimKeyFor(c.data.id)] = { sets };
	}

	process.stderr.write('building + running the gcsim dumper…\n');
	const dump = runDumper({ drivers: driverTable, framesOnly: true });

	// ⚠️ Format with prettier, not with `JSON.stringify(…, '\t')` alone. The corpus is
	// prettier-formatted and it collapses short arrays onto one line; a bare stringify
	// re-expands every `"input": ["N"]` in the file and turns a 5,000-line data diff
	// into a 12,000-line one. Formatting here also makes the script idempotent, which
	// is what lets it be re-run safely against an already-migrated corpus.
	const prettierOptions = { ...(await resolveConfig(chars[0].file)), parser: 'json' };
	const stats = { migrated: 0, preserved: 0, heldBack: 0, lowPlungeAdded: 0, files: 0 };
	const held = [];

	for (const c of chars) {
		if (only && c.data.id !== only) continue;
		const gk = gcsimKeyFor(c.data.id);
		const cd = dump.characters[gk];
		const byKey = new Map((cd?.abilities ?? []).map((a) => [a.key, a]));
		const charHeld = HOLDBACK_CHARACTERS[c.data.id];

		// The plunge split has to happen BEFORE the maps are enumerated, so the new
		// `lowPlungeFrames` is migrated in the same pass as everything else.
		if (!charHeld) {
			for (const a of c.data.abilities ?? []) {
				if (a.abilityType !== 'normal' || !a.plungeFrames || a.lowPlungeFrames) continue;
				const lp = byKey.get('lP');
				if (!lp || lp.error || !lp.frames) continue;
				// ⚓ Seeded from the CURRENT plungeFrames, which before L4b held the low
				// plunge for 36 of 41 authors — so the field starts life holding roughly
				// the right numbers and is then rewritten from gcsim's `lP` below, in the
				// same pass and by the same rule as every other map.
				a.lowPlungeFrames = { ...a.plungeFrames };
				stats.lowPlungeAdded++;
			}
		}

		// Pass 1 — propose. ⚓ Nothing is written until the whole character has been
		// considered, because the collapse check below is a property of the SET.
		const proposals = [];
		for (const m of authoredMaps(c.data, drivers[gk], byKey)) {
			const pathHeld = HOLDBACK_PATHS[m.path];
			const g = m.dumpKey ? byKey.get(m.dumpKey) : null;
			const covered = !!(g && !g.error && g.frames);

			if (charHeld || pathHeld) {
				proposals.push({ m, next: preserveFrameMap(m.frames), why: pathHeld ?? charHeld });
				continue;
			}
			if (!covered) {
				proposals.push({ m, next: preserveFrameMap(m.frames), preserved: true });
				continue;
			}
			// ⚠️ Over the keys the corpus ASSERTS, not over the resolved reading. An
			// absent key is not a claim, and gcsim disagreeing with our old `swap`
			// fallback about it is the entire bug being fixed — measuring that as a
			// conflict held back 452 maps, which is the migration refusing to run.
			const maxDelta = Math.max(
				0,
				...KEYS.filter((k) => m.frames[k] !== undefined).map((k) =>
					Math.abs(m.frames[k] - g.frames[k])
				)
			);
			if (maxDelta >= HOLDBACK_DELTA_F) {
				proposals.push({
					m,
					next: preserveFrameMap(m.frames),
					why: `a key moves ${maxDelta}f — a second or more is a different action, not drift`
				});
				continue;
			}
			proposals.push({
				m,
				next: toFrameMap(g.frames, { normalStyle: m.normalStyle }),
				migrated: true
			});
		}

		// ⚓⚓ THE MIGRATION MUST NOT COLLAPSE A DISTINCTION THE CORPUS DRAWS. If two
		// authored maps in the same group differ today and would be identical after,
		// the capture is describing ONE of them and being written to both — gcsim is
		// declining to model the split, not telling us the split is imaginary.
		//
		// Caught three real regressions the delta rule sailed past: Keqing's blink
		// recast (gcsim re-reads the base skill slice), Flins' `sQ` (gcsim models the
		// SHORT burst as the base, so the migration overwrote our long one with it and
		// made both the short one) and the geo Traveler's hold. ⛔ Reverting the whole
		// GROUP, not just the loser, is deliberate: which of the pair the capture
		// describes is exactly what we do not know.
		const groups = new Map();
		for (const p of proposals) {
			if (!p.m.group) continue;
			if (!groups.has(p.m.group)) groups.set(p.m.group, []);
			groups.get(p.m.group).push(p);
		}
		for (const [group, members] of groups) {
			if (members.length < 2) continue;
			const key = (fm) => JSON.stringify(resolvedKeys(fm));
			const wasDistinct = new Set(members.map((p) => key(p.m.frames))).size;
			const nowDistinct = new Set(members.map((p) => key(p.next))).size;
			if (nowDistinct >= wasDistinct) continue;
			for (const p of members) {
				p.next = preserveFrameMap(p.m.frames);
				p.migrated = false;
				p.preserved = false;
				p.why = `migrating would COLLAPSE the ${group} distinction (${wasDistinct} authored maps → ${nowDistinct}) — gcsim is not modelling this split`;
			}
		}

		for (const p of proposals) {
			p.m.set(p.next);
			if (p.why) {
				held.push({ id: c.data.id, path: p.m.path, why: p.why });
				stats.heldBack++;
			} else if (p.preserved) stats.preserved++;
			else stats.migrated++;
		}

		const next = await format(JSON.stringify(c.data), prettierOptions);
		if (next !== c.raw) {
			stats.files++;
			if (write) writeFileSync(c.file, next);
		}
	}

	process.stderr.write(
		`${stats.migrated} migrated · ${stats.preserved} preserved (no gcsim reading) · ` +
			`${stats.heldBack} held back · ${stats.lowPlungeAdded} lowPlungeFrames added · ` +
			`${stats.files} files ${write ? 'written' : 'would change'}\n`
	);
	const byChar = new Map();
	for (const h of held) {
		if (!byChar.has(h.id)) byChar.set(h.id, []);
		byChar.get(h.id).push(h);
	}
	process.stderr.write('\nHELD BACK:\n');
	for (const [id, rows] of byChar) {
		process.stderr.write(`  ${id} (${rows.length})\n`);
		const seen = new Set();
		for (const r of rows) {
			if (seen.has(r.why)) continue;
			seen.add(r.why);
			process.stderr.write(`    ${r.why}\n`);
		}
	}
}

await main();
