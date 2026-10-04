#!/usr/bin/env node
/**
 * scripts/migrate-application-schema.mjs
 *
 * Authors `application[]` — when each skill/burst cast's own hits LAND, and what they
 * apply — from gcsim's damage stream. Gauge round L4c; contract C3.
 *
 * ⚓ THE POINT IS THE EMPTY ARRAY. Until now an ability recorded when it could be
 * CANCELLED and never when it landed, so the parser applied `char.element` at every
 * E/Q cast — including Xiangling's E, which applies zero Pyro because it only puts
 * Guoba on the field. 19 abilities in the corpus are like that and none of them could
 * say so.
 *
 * ⚠️ The NOMINAL schedule, not the applied one (C4). gcsim emits a `damage` event for
 * every hit, ICD-suppressed or not, and `icd.ts` stays the only thing that decides
 * whether one lands. ⛔ Never pre-apply ICD here.
 *
 * ↻ `units` IS authored since L5d — the gauge that reads it landed at L5c, which is
 * the order contract C3's split table asked for (⛔ it was deliberately withheld
 * before that, because a number in front of its only consumer is the orphaned-data
 * class `orphanedSchema.test.ts` exists to catch).
 *
 * ⚓ AUTHORED ON EVERY MEASURED ENTRY, 1U INCLUDED. The default is 1U, so writing it
 * out looks redundant — it is not, for the same reason `[]` and absent differ on the
 * list itself: absent must keep meaning WE DID NOT MEASURE THIS. Collapsing a measured
 * 1U into silence is the exact conflation L4d had to undo one landing earlier. The
 * entries that legitimately carry no units are the ones gcsim's own ICD suppressed,
 * which log no durability at all.
 *
 * Usage:  node scripts/migrate-application-schema.mjs [--write] [--char <id>]
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { format, resolveConfig } from 'prettier';

import { runDumper } from './lib/gcsim-dump.mjs';
import { surgicalRewrite } from './lib/json-edit.mjs';
import { DURABILITY_PER_UNIT } from './lib/gcsim.mjs';
import {
	CHAR_DIR,
	dumperDriverEntry,
	gcsimKeyFor,
	loadDrivers,
	prereqFor,
	splitApplications,
	variantDumpKey
} from './lib/gcsim-map.mjs';

async function main() {
	const args = process.argv.slice(2);
	const write = args.includes('--write');
	const onlyIdx = args.indexOf('--char');
	const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

	const drivers = loadDrivers();
	const chars = readdirSync(CHAR_DIR)
		.filter((n) => n.endsWith('.json'))
		.sort()
		.map((n) => {
			const file = join(CHAR_DIR, n);
			const raw = readFileSync(file, 'utf8');
			return { file, raw, data: JSON.parse(raw) };
		});

	const driverTable = {};
	for (const c of chars) {
		const entry = dumperDriverEntry(c.data, drivers[gcsimKeyFor(c.data.id)]);
		if (entry) driverTable[gcsimKeyFor(c.data.id)] = entry;
	}

	process.stderr.write('building + running the gcsim dumper…\n');
	const dump = runDumper({ drivers: driverTable });

	const prettierOptions = { ...(await resolveConfig(chars[0].file)), parser: 'json' };
	const stats = { authored: 0, empty: 0, uncovered: 0, files: 0, hits: 0 };
	/** Distribution of the measured gauge units, printed so an unexpected value
	 *  (a 0.5U, a 3U) is SEEN rather than quietly written into 123 files. */
	const unitTally = new Map();
	const uncovered = [];
	const applyNothing = [];

	for (const c of chars) {
		if (only && c.data.id !== only) continue;
		const gk = gcsimKeyFor(c.data.id);
		const byKey = new Map((dump.characters[gk]?.abilities ?? []).map((a) => [a.key, a]));

		for (const a of c.data.abilities ?? []) {
			if (a.abilityType !== 'skill' && a.abilityType !== 'burst') continue;
			const ctx = prereqFor(a.conditions, drivers[gk]);
			const suffix = ctx === null ? null : ctx.label ? `@${ctx.label}` : '';
			const baseKey = a.abilityType === 'burst' ? 'Q' : 'E';
			const targets = [{ node: a, key: suffix === null ? null : `${baseKey}${suffix}` }];
			for (const v of a.variants ?? []) {
				const vk = variantDumpKey(v.input ?? [], baseKey, v.conditions);
				targets.push({
					node: v,
					key: vk === null || suffix === null ? null : `${vk}${suffix}`,
					label: v.label
				});
			}
			for (const t of targets) {
				const g = t.key ? byKey.get(t.key) : null;
				if (!g || g.error) {
					// ⛔ Leave the field ABSENT. Absent and empty mean different things and
					// the difference is the whole point: empty is "this cast applies
					// nothing", absent is "we never drove it".
					delete t.node.application;
					uncovered.push(`${c.data.id} ${a.id}${t.label ? ` · ${t.label}` : ''}`);
					stats.uncovered++;
					continue;
				}
				const hits = splitApplications(g.applications ?? [], a).cast;
				t.node.application = hits.map((h) => {
					const e = { frame: h.frame };
					// ⛔ "physical" is written as an ABSENT element, not as a value: the
					// schema says absent means the hit applies nothing, and spelling it out
					// would invite a reader to treat physical as an aura.
					// ⚓ So is a hit with NO GAUGE (gcsim `Durability: 0` — not applied, and no
					// ICD check ran): it keeps its entry, because it is still a landing, and
					// drops `element` (ICD cap round, 2026-10-04 — the schema's rule, which the
					// writer did not yet know; Zibai's burst was the first to need it).
					const noGauge = !h.applied && (h.icdVal === undefined || h.icdVal === null);
					if (h.element && h.element !== 'physical' && !noGauge) e.element = h.element;
					// gcsim reports DURABILITY, 25 per gauge unit. ⚠️ Absent on a hit its
					// own ICD suppressed — there was no application to measure.
					if (typeof h.durability === 'number') {
						e.units = Math.round((h.durability / DURABILITY_PER_UNIT) * 100) / 100;
						unitTally.set(e.units, (unitTally.get(e.units) ?? 0) + 1);
					}
					return e;
				});
				stats.hits += hits.length;
				if (!hits.length) {
					stats.empty++;
					applyNothing.push(`${c.data.id} ${a.id}${t.label ? ` · ${t.label}` : ''}`);
				} else stats.authored++;
			}
		}

		// ⚓ Surgical: only what this run changed is rewritten (`lib/json-edit.mjs`).
		// ⛔ Never `format(JSON.stringify(c.data))` — it reflows the whole hand-formatted file.
		const next = await format(surgicalRewrite(c.raw, JSON.parse(c.raw), c.data), prettierOptions);
		if (next !== c.raw) {
			stats.files++;
			if (write) writeFileSync(c.file, next);
		}
	}

	process.stderr.write(
		`${stats.authored} abilities with hits (${stats.hits} applications) · ` +
			`${stats.empty} APPLY NOTHING · ${stats.uncovered} with no reading · ` +
			`${stats.files} files ${write ? 'written' : 'would change'}\n`
	);
	process.stderr.write(
		`gauge units measured: ${[...unitTally.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([u, n]) => `${u}U ×${n}`)
			.join(' · ')}\n`
	);
	process.stderr.write(`\n⚓ APPLY NOTHING (${applyNothing.length}):\n`);
	for (const x of applyNothing) process.stderr.write(`  ${x}\n`);
	process.stderr.write(`\nNO READING — the provisional register (${uncovered.length}):\n`);
	for (const x of uncovered) process.stderr.write(`  ${x}\n`);
}

await main();
