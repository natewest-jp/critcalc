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
 * ⛔ `units` is NOT authored — the gauge that reads it lands in L5, and putting a
 * number in front of its only consumer is the orphaned-data class
 * `orphanedSchema.test.ts` exists to catch. The audit reports it so L5 starts measured.
 *
 * Usage:  node scripts/migrate-application-schema.mjs [--write] [--char <id>]
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { format, resolveConfig } from 'prettier';

import { runDumper } from './lib/gcsim-dump.mjs';
import {
	CHAR_DIR,
	driverSetsFor,
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
		const sets = driverSetsFor(c.data, drivers[gcsimKeyFor(c.data.id)]);
		if (sets.length) driverTable[gcsimKeyFor(c.data.id)] = { sets };
	}

	process.stderr.write('building + running the gcsim dumper…\n');
	const dump = runDumper({ drivers: driverTable });

	const prettierOptions = { ...(await resolveConfig(chars[0].file)), parser: 'json' };
	const stats = { authored: 0, empty: 0, uncovered: 0, files: 0, hits: 0 };
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
				const vk = variantDumpKey(v.input ?? [], baseKey);
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
					if (h.element && h.element !== 'physical') e.element = h.element;
					return e;
				});
				stats.hits += hits.length;
				if (!hits.length) {
					stats.empty++;
					applyNothing.push(`${c.data.id} ${a.id}${t.label ? ` · ${t.label}` : ''}`);
				} else stats.authored++;
			}
		}

		const next = await format(JSON.stringify(c.data), prettierOptions);
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
	process.stderr.write(`\n⚓ APPLY NOTHING (${applyNothing.length}):\n`);
	for (const x of applyNothing) process.stderr.write(`  ${x}\n`);
	process.stderr.write(`\nNO READING — the provisional register (${uncovered.length}):\n`);
	for (const x of uncovered) process.stderr.write(`  ${x}\n`);
}

await main();
