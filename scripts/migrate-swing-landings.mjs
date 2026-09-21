#!/usr/bin/env node
/**
 * scripts/migrate-swing-landings.mjs
 *
 * Authors `FrameMap.lands` — the frame a swing's FIRST hit lands — on the normal-style
 * maps that state no `hit`. §1.K stage 2 (docs/swing-hitmark-round.md).
 *
 * ⚓⚓ WHY THESE MAPS STATE NONE. `hit` is gcsim's `InitNormalCancelSlice(hitmark,
 * anim)` tier: the hitmark AND the fill for E/Q/D/J/swap. gcsim builds every charged
 * attack, every plunge and most catalyst normals with explicit cancels instead and
 * keeps the hitmark in a separate constant the frame migration never read. So the
 * number cannot go in `hit` (it would become their E and Q cancel), and it is not in
 * the cancel slice at all — it is only in the DAMAGE stream, which is where this reads.
 *
 * ⚓ THE FIRST HIT, of the swing's OWN hits (⚓ Nate). A capture of N(k) runs N1…N(k-1)
 * back to back first, so an earlier swing's hit can still be in flight when the
 * capture starts and lands inside it. Those are dropped by NAME — see the rule at the
 * site, and ⚠️ read the report's multi-name section after any gcsim update: a capture
 * behind a PREREQUISITE can also see that prerequisite's summon ticking.
 *
 * ⚠️ A RELEASE frame for a projectile. The dumper pins gcsim's `travel` to 0 on every
 * swing capture (its 10f default is a simulation policy, not game data). A catalyst
 * whose travel gcsim HARDCODES still carries it — reported, never stripped by guess.
 *
 * ↻ EVERY HIT, not only the first (every-landing round, 2026-09-21): a swing that
 * lands more than one hit gets `lands` as the LIST of its own hits' frames, first to
 * last. ICD and every `onHit` count hits. ⚠️ Two hits on ONE frame are two hits
 * (Kaeya's charged attack: `20, 20`), ⛔ never deduped.
 * ⛔ Never TOUCHES `hit` — but a map that states `hit` and lands more than one hit is
 * written now, with the list BESIDE it (`hit` is gcsim's last hitmark on most of
 * them, and stays the cancel tier). A single-hit map that states `hit` is still left
 * alone: `hit` already says it. ⛔ Never writes a `nonHitting` class, an uncovered
 * map, a hit past `anim`, or a `coInfusion` ability — there the two dumped hits ARE
 * the two hands, which the engine already lands as one swing's primary + co offer.
 *
 * Usage:  node scripts/migrate-swing-landings.mjs [--write] [--char <id>] [--verbose]
 */

import './lib/alias-hook.mjs';

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { applyEdits, modify } from 'jsonc-parser';
import { format, resolveConfig } from 'prettier';

import { runDumper } from './lib/gcsim-dump.mjs';
import {
	CHAR_DIR,
	authoredMaps,
	driverSetsFor,
	gcsimKeyFor,
	loadDrivers
} from './lib/gcsim-map.mjs';

const HORIZON = 2400;

/** The `nonHitting` class a map's group belongs to. */
const classOf = (group) =>
	group.startsWith('hits[') ? 'normal' : /lunge/.test(group) ? 'plunge' : 'charged';

/**
 * The JSON path of an authored map's `lands`, from `authoredMaps`' display path.
 *
 * ⚓ The edit is SURGICAL (`jsonc-parser`'s `modify`), never a re-serialisation: the
 * corpus is hand-formatted, and `format(JSON.stringify(data))` reflows every object
 * prettier could fit on a line — the first cut of this writer produced a 14,000-line
 * diff to author 233 numbers.
 */
function landsPath(data, mapPath) {
	const ai = data.abilities.findIndex((a) => mapPath.startsWith(`${a.id}.`));
	if (ai < 0) return null;
	const a = data.abilities[ai];
	const rest = mapPath.slice(a.id.length + 1);
	const indexed = rest.match(/^(hits|chargeHits)\[(\d+)\]$/);
	if (indexed) return ['abilities', ai, indexed[1], Number(indexed[2]), 'frames', 'lands'];
	const variant = rest.match(/^plungeVariants\[(.*)\]$/);
	if (variant) {
		const vi = (a.plungeVariants ?? []).findIndex((v) => v.label === variant[1]);
		return vi < 0 ? null : ['abilities', ai, 'plungeVariants', vi, 'frames', 'lands'];
	}
	return rest in a ? ['abilities', ai, rest, 'lands'] : null;
}

async function main() {
	const args = process.argv.slice(2);
	const write = args.includes('--write');
	const verbose = args.includes('--verbose');
	const onlyIdx = args.indexOf('--char');
	const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

	const drivers = loadDrivers();
	const chars = readdirSync(CHAR_DIR)
		.filter((n) => n.endsWith('.json'))
		.map((n) => {
			const file = join(CHAR_DIR, n);
			const raw = readFileSync(file, 'utf8');
			return { file, raw, text: raw, data: JSON.parse(raw) };
		})
		.filter((c) => !only || c.data.id === only)
		.sort((a, b) => a.data.id.localeCompare(b.data.id));

	const driverTable = {};
	for (const { data } of chars) {
		const gk = gcsimKeyFor(data.id);
		const sets = driverSetsFor(data, drivers[gk]);
		if (sets.length) driverTable[gk] = { sets };
	}
	process.stderr.write('building + running the gcsim dumper…\n');
	const dump = runDumper({
		cons: 0,
		drivers: driverTable,
		horizon: HORIZON,
		only: only ? gcsimKeyFor(only) : ''
	});

	const prettierOptions = { ...(await resolveConfig(chars[0].file)), parser: 'json' };
	const stats = { authored: 0, unchanged: 0, hasHit: 0, uncovered: 0, noDamage: 0, files: 0 };
	const byGroup = {};
	const notes = {
		inFlight: [],
		multi: [],
		pastAnim: [],
		noDamage: [],
		uncovered: [],
		coInfusion: [],
		ambiguous: []
	};

	for (const c of chars) {
		const gk = gcsimKeyFor(c.data.id);
		const cd = dump.characters[gk];
		const dumped = cd ? new Map((cd.abilities ?? []).map((x) => [x.key, x])) : null;
		for (const m of authoredMaps(c.data, drivers[gk], dumped)) {
			if (!m.normalStyle) continue;
			const where = `${c.data.id} ${m.path.replace(`${c.data.id}__`, '')}`;
			const ability = (c.data.abilities ?? []).find((a) => m.path.startsWith(`${a.id}.`));
			if (ability?.nonHitting?.[classOf(m.group)]) continue;
			const d = m.dumpKey ? dumped?.get(m.dumpKey) : null;
			if (!d || d.error) {
				stats.uncovered++;
				notes.uncovered.push(where);
				continue;
			}
			const apps = d.applications ?? [];
			if (!apps.length) {
				stats.noDamage++;
				notes.noDamage.push(where);
				continue;
			}
			// ⚓ WHICH HITS ARE THE SWING'S OWN. Only an N(k) capture has anything in
			// flight — the dumper runs N1…N(k-1) back to back first — so a hit is an
			// artefact exactly when its name already appeared in an EARLIER swing's
			// capture of the same form. That also drops a proc every swing can fire
			// (Clorinde's Surging Blade), which is right: it is not the swing's hit.
			// ⛔ Two rules that were tried and are wrong: "the hits sharing the LAST
			// hit's name" (a multi-hit charged attack is `Charge 0`, `Charge 1`, and a
			// capture's last hit is as often a proc — Alhaitham's mirror, Hu Tao's
			// Blood Blossom), and "the hits named for this combo index" (gcsim writes
			// `Sharky's Bite (0 momentum)`, `Normal 1 (Windfavored)`, `Denial of
			// Darkness`). The dry run caught both. A charged attack or a plunge has no
			// combo prefix, so its first hit is its first hit.
			const nm = m.dumpKey.match(/^N(\d+)(@.*)?$/);
			const earlier = new Set();
			if (nm)
				for (let k = 1; k < Number(nm[1]); k++)
					for (const x of dumped.get(`N${k}${nm[2] ?? ''}`)?.applications ?? [])
						earlier.add(x.abil);
			const own = apps.filter((x) => !earlier.has(x.abil));
			const idx = nm?.[1];
			if (!own.length) {
				stats.uncovered++;
				notes.uncovered.push(
					`${where} — every hit of N${idx} is named for an earlier swing: ${apps.map((x) => `${x.abil}@${x.frame}`).join(', ')}`
				);
				continue;
			}
			if (own.length < apps.length || new Set(apps.map((x) => x.abil)).size > 1)
				notes.inFlight.push(`${where} — ${apps.map((x) => `${x.abil}@${x.frame}`).join(', ')}`);
			// ⛔ A landing at frame 0 or past the animation is not a swing's hit — a
			// delayed projectile, a lingering field, a 0-damage marker — and no swing
			// can land it. Dropped from the list and reported; a map with nothing left
			// is not written.
			const timely = own.filter((x) => x.frame >= 1 && x.frame <= m.frames.anim);
			if (timely.length < own.length)
				notes.pastAnim.push(
					`${where} — anim ${m.frames.anim}, dropped: ${own
						.filter((x) => !timely.includes(x))
						.map((x) => `${x.abil}@${x.frame}`)
						.join(', ')}${timely.length ? '' : ' — NOTHING LEFT'}`
				);
			if (!timely.length) continue;
			// ⚓⚓ WHICH OF ITS OWN HITS ARE THE SWING (every-landing round). The
			// first-hit rule never had to ask: a proc the swing fires lands AFTER it.
			// A list does — Alhaitham's Mirror projection, Clorinde's Surging Blade,
			// Furina's Spiritbreath Thorn and the Traveler's A1/A4 strikes all ride a
			// swing's capture under their own names, and several are authored as
			// effects already. A swing's hits share a NAME STEM (digits stripped:
			// `Charge 0`/`Charge 1`, `Musou Isshin (Charge Attack 0)`/`…1)`), or one
			// stem extends the other (`Charge Attack` / `Charge Attack (Finisher)`).
			// With more than one stem left: the one naming this combo index as a whole
			// word (`Normal 4`, ⛔ not `(A4)`), else the most hits, else the first —
			// and that last case is REPORTED, never silent.
			const stemOf = (x) => x.abil.replace(/\d+/g, '').trim();
			const groups = [];
			for (const x of timely) {
				const st = stemOf(x);
				const g = groups.find((g) => g.stem.startsWith(st) || st.startsWith(g.stem));
				if (g) {
					g.hits.push(x);
					if (st.length < g.stem.length) g.stem = st;
				} else groups.push({ stem: st, hits: [x] });
			}
			let swing = groups[0];
			if (groups.length > 1) {
				const k = nm ? new RegExp(`\\b${Number(nm[1]) - 1}\\b`) : null;
				const named = k ? groups.filter((g) => g.hits.some((x) => k.test(x.abil))) : [];
				const most = Math.max(...groups.map((g) => g.hits.length));
				const biggest = groups.filter((g) => g.hits.length === most);
				if (named.length === 1) swing = named[0];
				else if (biggest.length === 1) swing = biggest[0];
				else
					notes.ambiguous.push(
						`${where} — ${timely.map((x) => `${x.abil}@${x.frame}`).join(', ')} → took "${swing.stem}"`
					);
			}
			const inside = swing.hits;
			if (inside.length > 1 && ability?.coInfusion) {
				notes.coInfusion.push(`${where} — ${inside.map((x) => `${x.abil}@${x.frame}`).join(', ')}`);
				continue;
			}
			const hasHit = typeof m.frames.hit === 'number';
			if (hasHit && inside.length === 1) {
				stats.hasHit++;
				continue;
			}
			const lands = inside.length > 1 ? inside.map((x) => x.frame) : inside[0].frame;
			if (inside.length > 1)
				notes.multi.push(
					`${where} — ${inside.map((x) => x.frame).join(',')}${hasHit ? ` (hit ${m.frames.hit})` : ''}`
				);
			if (JSON.stringify(m.frames.lands) === JSON.stringify(lands)) {
				stats.unchanged++;
				continue;
			}
			const path = landsPath(c.data, m.path);
			if (!path) {
				stats.uncovered++;
				notes.uncovered.push(`${where} — no JSON path for this map`);
				continue;
			}
			// The corpus's key order is `anim`, `hit`, `lands`, then the cancels.
			c.text = applyEdits(
				c.text,
				modify(c.text, path, lands, {
					formattingOptions: { insertSpaces: false, tabSize: 1 },
					getInsertionIndex: (keys) => keys.indexOf(hasHit ? 'hit' : 'anim') + 1
				})
			);
			stats.authored++;
			const g = m.group.replace(/\[\d+\]/, '[]');
			byGroup[g] = (byGroup[g] ?? 0) + 1;
		}
		if (c.text === c.raw) continue;
		const next = await format(c.text, prettierOptions);
		if (next !== c.raw) {
			stats.files++;
			if (write) writeFileSync(c.file, next);
		}
	}

	const out = process.stdout;
	out.write(
		`${stats.authored} landings ${write ? 'written' : 'to write'} across ${stats.files} files · ` +
			`${stats.unchanged} already current · ${stats.hasHit} state \`hit\` (left alone) · ` +
			`${stats.uncovered} uncovered · ${stats.noDamage} land no damage\n`
	);
	out.write(`by group: ${JSON.stringify(byGroup)}\n`);
	const section = (title, rows) => {
		if (!rows.length) return;
		out.write(`\n## ${title} (${rows.length})\n`);
		if (verbose || rows.length <= 40) out.write(rows.map((r) => `  ${r}`).join('\n') + '\n');
	};
	section('past anim or at frame 0 — NOT written', notes.pastAnim);
	section('gcsim lands no damage — NOT written', notes.noDamage);
	section('more than one ability name in the capture — READ THESE', notes.inFlight);
	section('uncovered — NOT written', notes.uncovered);
	section('AMBIGUOUS — two name stems, neither decided; READ THESE', notes.ambiguous);
	section('coInfusion ability — the two hits are the two hands, NOT written', notes.coInfusion);
	if (verbose) section('multi-hit — the full list', notes.multi);
	else out.write(`\n${notes.multi.length} multi-hit swings state a list (--verbose lists them)\n`);
	if (!write) out.write('\n(dry run — pass --write)\n');
}

main();
