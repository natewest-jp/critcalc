/**
 * orphanedSchema.test.ts — authored data must have a consumer.
 *
 * ⚓ Promoted 2026-08-15 after a single day produced seven bugs of one shape:
 * data authored correctly and read by no code path. `factionBonuses`, the five
 * `infuse` effects, `shield` windows, variant `effects`, `summons[1]`, Citlali's
 * `onState` and Hu Tao's `onStanceEnd` all typechecked, all linted clean, and
 * all silently did nothing. Nothing in the toolchain could see it: a field is
 * declared, so TypeScript is happy; a value is in the union, so the lint is
 * happy; the effect never renders, so no test notices.
 *
 * This asserts the relationship instead of a value, which is why it survives
 * refactors: for every key present in the shipped corpus, SOMETHING in `src/`
 * or `scripts/` must access it.
 *
 * ⚠️⚠️ WHAT THIS CANNOT SEE, and it matters: PARTIALLY-wired data. `infuse`
 * effects reached the capability layer, the Team Builder and `characterLint` —
 * they were missing only from the parser, and a "read anywhere" test says ✓.
 * A green run here is not proof the class is exhausted. See
 * `docs/curation/orphaned-schema-audit.md` for the per-consumer pass that
 * narrows it, and for the findings this file was extracted from.
 *
 * When this fails, the fix is one of exactly three things:
 *   1. wire the field to a consumer (the usual answer);
 *   2. retire it from the schema and the data;
 *   3. add it to INERT below **with the reason**, if it is deliberately
 *      forward-looking. ⛔ Never add a bare entry — an unexplained allow-list
 *      is the same silence this test exists to break.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/** Keys that are authored on purpose with no code consumer. Every entry states
 *  why, and stays only as long as the reason does. */
const INERT: Record<string, string> = {
	// Provenance / curation metadata — documentation, like `_curatorNotes`.
	curatedAt: 'curation provenance, documentation only',
	curatedBy: 'curation provenance, documentation only',
	draftedAt: 'curation provenance, documentation only',
	draftedBy: 'curation provenance, documentation only',
	generatedAt: 'ingest provenance, documentation only',
	framesSource: 'frame provenance, documentation only',
	// Forward-looking game truth, each with a stated reason at its declaration.
	snapshots:
		'KQM snapshotting; the tools model buff windows, not damage — see docs/library/game/snapshotting.md',
	twoPiece: 'no Stat key for a 2pc bonus until a consumer exists — see CLAUDE.md',
	// Known-inert, tracked in docs/curation/orphaned-schema-audit.md.
	durationModel: 'stacks shared/separate — audit finding #4, decision pending',
	shortName: 'declared on ability/artifact/weapon, rendered nowhere — audit finding #5'
};

const DATA_DIRS = ['src/lib/data/characters', 'src/lib/data/artifacts', 'src/lib/data/weapons'];
const CODE_ROOTS = ['src', 'scripts'];

/** Every object key present in the shipped data, with one authoring example. */
function authoredKeys(): Map<string, string> {
	const keys = new Map<string, string>();
	const walk = (v: unknown, file: string): void => {
		if (Array.isArray(v)) return v.forEach((x) => walk(x, file));
		if (!v || typeof v !== 'object') return;
		for (const [k, val] of Object.entries(v)) {
			if (!k.startsWith('_') && !keys.has(k)) keys.set(k, file);
			walk(val, file);
		}
	};
	for (const dir of DATA_DIRS) {
		if (!fs.existsSync(dir)) continue;
		for (const f of fs.readdirSync(dir)) {
			if (f.endsWith('.json')) walk(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), f);
		}
	}
	return keys;
}

/**
 * Application code — the data itself and the tests are not consumers.
 *
 * ⛔ NEITHER IS A `migrate-*` SCRIPT. Those exist to WRITE the corpus, so a field they
 * touch is authored data mentioning itself — morally identical to the JSON, which this
 * function already excludes. Caught in the act (gauge round L4c): the guard went green
 * on `application[]` because the migration that had just written it also read it back,
 * while the parser still knew nothing about the field. ⚠️ An `audit-*` script IS a
 * consumer — it reads the corpus and reports on it, which is a real use.
 */
const WRITERS = /(^|[/\\])migrate[-_]/;

function codeBlob(): string {
	const parts: string[] = [];
	const collect = (dir: string): void => {
		for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
			const p = path.join(dir, e.name);
			if (e.isDirectory()) {
				if (!p.includes(path.join('lib', 'data'))) collect(p);
			} else if (
				/\.(ts|svelte|mjs|js)$/.test(e.name) &&
				!/\.test\.ts$/.test(e.name) &&
				!WRITERS.test(e.name)
			) {
				parts.push(fs.readFileSync(p, 'utf8'));
			}
		}
	};
	for (const root of CODE_ROOTS) if (fs.existsSync(root)) collect(root);
	return parts.join('\n');
}

describe('orphaned schema — every authored key has a consumer', () => {
	it('no authored key is read by nothing', () => {
		const keys = authoredKeys();
		const blob = codeBlob();
		const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

		const orphans: string[] = [];
		for (const [key, sample] of keys) {
			if (key in INERT) continue;
			const k = esc(key);
			// ⚠️ Property ACCESS, not any mention: a type declaration (`key?: X`)
			// must not count, or declaring a field would mask the missing
			// consumer — which is the entire failure mode.
			const re = new RegExp(
				`\\.${k}\\b|\\[['"\`]${k}['"\`]\\]|['"\`]${k}['"\`]\\s*[:,)\\]}]|\\b${k}\\s*[,}]`
			);
			if (!re.test(blob)) orphans.push(`${key} (e.g. ${sample})`);
		}

		expect(
			orphans,
			`Authored in the corpus, accessed by no code in src/ or scripts/.\n` +
				`Wire it, retire it, or add it to INERT with a reason — see this file's header.\n` +
				orphans.map((o) => `  · ${o}`).join('\n')
		).toEqual([]);
	});

	it('the INERT allow-list has no stale entries', () => {
		// An entry that is no longer authored, or has since gained a consumer, is
		// a claim that has quietly stopped being true.
		const keys = authoredKeys();
		const blob = codeBlob();
		const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const stale = Object.keys(INERT).filter((key) => {
			if (!keys.has(key)) return true;
			const k = esc(key);
			return new RegExp(`\\.${k}\\b|\\[['"\`]${k}['"\`]\\]`).test(blob);
		});
		expect(stale, `INERT entries that are no longer authored, or now have a consumer`).toEqual([]);
	});
});
