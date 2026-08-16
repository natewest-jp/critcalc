/**
 * scripts/lib/gcsim.mjs
 *
 * Talking to gcsim: name mapping, config generation, invocation, log parsing.
 *
 * gcsim's debug log is a far better oracle than a reaction list. Every
 * elemental application is recorded with the applied DURABILITY and the aura
 * gauge before AND after, at an exact frame:
 *
 *   { "abil": "Frostgnaw", "applied_ele": "cryo", "dur": 50, "attack_tag": 4,
 *     "existing": null, "after": ["cryo: 40.000"], "target": 1 }
 *
 * So hitmarks (`element.frame - action.frame`), gauge units (`dur / 25`) and
 * "does this cast apply at all" (absence of the event) are all OBSERVABLE.
 * See docs/gauge-round-L0.md for the full spike record.
 *
 * ⚠️ Stats are irrelevant to elemental application — EM scales reaction DAMAGE,
 * not gauge — so the generated config carries no artifacts and no substats.
 * Constellations DO matter (they add hits) and are passed through.
 *
 * ⛔ This module is a review-candidate generator against an external source,
 * never an auto-fixer — the same contract as audit-genshin-db-diff.mjs.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** gcsim checkout. The project's verification policy already assumes one at
 *  ~/Code/gcsim (CLAUDE.md); GCSIM_REPO overrides for CI or a second clone. */
export const GCSIM_REPO = process.env.GCSIM_REPO ?? join(homedir(), 'Code', 'gcsim');

/** Built on demand into gitignored scratch/ — ⛔ never committed. A stale
 *  binary silently answering for a newer checkout is the failure this avoids,
 *  which is why every report records the commit hash it was built from. */
const BIN_DIR = join(REPO_ROOT, 'scratch', 'gcsim-bin');
const BIN_PATH = join(BIN_DIR, 'gcsim');

/**
 * 1★ weapons: zero passives, so nothing in the weapon slot can apply an
 * element, trigger a reaction, reset a cooldown or infuse an attack.
 * ⛔ Never substitute a Favonius (particle generation perturbs energy) or a
 * Sacrificial (a CD reset changes the rotation out from under the diff).
 */
export const INERT_WEAPONS = {
	sword: 'dullblade',
	claymore: 'wastergreatsword',
	polearm: 'beginnersprotector',
	catalyst: 'apprenticesnotes',
	bow: 'huntersbow'
};

/** Our character ids differ from gcsim's keys only by underscores — verified
 *  across the corpus: 111 of 123 map exactly this way, and the 12 that don't
 *  have no gcsim source at all (blank, iansan, ifa, illuga, jahoda, kachina,
 *  linnea, lohen, nefer, prune, sandrone, zibai). */
export const gcsimKey = (characterId) => characterId.replace(/_/g, '');

export function gcsimCommit() {
	try {
		return execFileSync('git', ['-C', GCSIM_REPO, 'rev-parse', '--short', 'HEAD'], {
			encoding: 'utf8'
		}).trim();
	} catch {
		return 'unknown';
	}
}

/** Returns the binary path, building it if absent. Fails with something a
 *  human can act on rather than a spawn ENOENT. */
export function ensureBinary({ rebuild = false } = {}) {
	if (!existsSync(GCSIM_REPO)) {
		throw new Error(
			`gcsim checkout not found at ${GCSIM_REPO}.\n` + `Clone it, or set GCSIM_REPO=/path/to/gcsim.`
		);
	}
	if (!rebuild && existsSync(BIN_PATH)) return BIN_PATH;
	mkdirSync(BIN_DIR, { recursive: true });
	try {
		execFileSync('go', ['build', '-o', BIN_PATH, './cmd/gcsim'], {
			cwd: GCSIM_REPO,
			stdio: 'pipe'
		});
	} catch (err) {
		const detail = err.stderr ? String(err.stderr).trim() : err.message;
		throw new Error(
			`Failed to build gcsim.\n` +
				`  cd ${GCSIM_REPO} && go build -o ${BIN_PATH} ./cmd/gcsim\n` +
				`Is Go installed? (brew install go)\n\n${detail}`
		);
	}
	return BIN_PATH;
}

// ---------------------------------------------------------------------------
// Notation → gcsl
// ---------------------------------------------------------------------------

/**
 * Translate one of OUR notations into gcsim's action list.
 *
 * ⚓ Driving both sides from the same notation is the point: the two engines
 * must run the identical action SEQUENCE, so that any difference in the
 * resulting applications is a difference of MODEL, not of input. (Frames will
 * differ — that divergence is a finding, not noise, and the differ pairs
 * actions ordinally for exactly that reason.)
 *
 * ⛔ Constructs that cannot be translated are REPORTED, never dropped
 * silently. A quietly-skipped token would make the oracle disagree with the
 * planner for a reason the report does not show.
 */
export function translateNotation(notation, { tokenize, lookupChar }) {
	const tokens = tokenize(notation);
	const lines = [];
	const warnings = [];
	const team = [];
	let current = null;

	const warn = (msg) => {
		if (!warnings.includes(msg)) warnings.push(msg);
	};

	for (const tok of tokens) {
		if (tok.kind === 'separator') {
			current = null;
			continue;
		}
		if (tok.kind === 'character') {
			const char = lookupChar(tok.text);
			if (!char) {
				warn(`unknown character "${tok.text}"`);
				current = null;
				continue;
			}
			current = char;
			if (!team.some((c) => c.id === char.id)) team.push(char);
			continue;
		}
		if (!current) {
			warn(`action "${tok.text}" outside any character segment`);
			continue;
		}

		const key = gcsimKey(current.id);
		const emit = (action) => lines.push(`${key} ${action};`);
		const t = tok.text;

		switch (tok.kind) {
			case 'E':
				// ⚠️ h1E/h2E are per-character hold levels with no general mapping;
				// L0's fixtures avoid them rather than guess a value.
				if (t === 'E' || t === 'tE' || t === 'pE') emit('skill');
				else if (t === 'hE') emit('skill[hold=1]');
				else
					warn(
						`skill variant "${t}" has no confirmed gcsl mapping (needs a per-character hold level)`
					);
				break;
			case 'Q':
				if (t === 'Q') emit('burst');
				else warn(`burst variant "${t}" has no confirmed gcsl mapping`);
				break;
			case 'time': {
				// ⚠️ `wait` is a SYSTEM function, not a character action — it takes
				// no character prefix. `<char> wait(n);` is a parse error.
				const seconds = Number.parseFloat(t.slice(1, -1));
				if (Number.isFinite(seconds) && seconds > 0) {
					lines.push(`wait(${Math.round(seconds * 60)});`);
				}
				break;
			}
			case 'unset-time':
				warn('"~?s" has no duration and cannot be translated; it was dropped');
				break;
			case 'label':
			case 'unknown': {
				if (/^N\d*$/.test(t)) {
					const n = t.length > 1 ? Number.parseInt(t.slice(1), 10) : 1;
					emit(n > 1 ? `attack:${n}` : 'attack');
				} else if (/^C\d*$/.test(t)) {
					const n = t.length > 1 ? Number.parseInt(t.slice(1), 10) : 1;
					emit(n > 1 ? `charge:${n}` : 'charge');
				} else if (t === 'A') {
					// ⚠️ gcsim's aimed-shot timing folds in `travel`, a SIMULATION
					// POLICY (default 10f), not measured frame data.
					warn(
						'"A" (aimed shot) timing includes gcsim\'s `travel` assumption — treat as provisional'
					);
					emit('aim');
				} else if (/^[h]?P$/.test(t)) {
					// ⚠️ gcsim hard-errors on a plunge with no preceding jump.
					emit('jump');
					emit('high_plunge');
				} else if (t === 'lP') {
					emit('jump');
					emit('low_plunge');
				} else if (t === 'D') {
					emit('dash');
				} else if (t === 'J') {
					emit('jump');
				} else if (t === 'W') {
					// ⛔ Matches peekActionKey: we do not simulate walk-cancels and
					// neither does gcsim, so the token really does nothing.
				} else if (/^(?:\d+(?:-\d+)?)?\[[^\]]*\](?:x\d+)?$/.test(t)) {
					warn(
						`bracket group "${t}" is not expanded by this translator — write the fixture out in full`
					);
				} else {
					warn(`unmapped token "${t}"`);
				}
				break;
			}
			case 'optional':
				warn(`optional group "${t}" skipped — fixtures should state one definite path`);
				break;
			case 'stack-assert':
				// A parser-side assertion with no gcsim analogue; not a translation gap.
				break;
			case 'or-alt':
				warn(`alternative "${t}" skipped — fixtures should state one definite path`);
				break;
			default:
				warn(`unmapped token kind "${tok.kind}" (${t})`);
		}
	}

	return { lines, warnings, team };
}

/** Assemble a runnable gcsl config. */
export function buildConfig({ team, lines, swapFrames = 8, duration = 90, constellations = {} }) {
	const head = [
		`options iteration=1 duration=${duration} swap_delay=${swapFrames} hitlag=false;`,
		'target lvl=100 resist=0 pos=0,0 radius=1;',
		''
	];
	for (const char of team) {
		const key = gcsimKey(char.id);
		const weapon = INERT_WEAPONS[char.weapon];
		if (!weapon) throw new Error(`no inert weapon for weapon type "${char.weapon}" (${char.id})`);
		const cons = constellations[char.id] ?? 0;
		head.push(`${key} char lvl=90/90 cons=${cons} talent=9,9,9;`);
		head.push(`${key} add weapon="${weapon}" refine=1 lvl=90/90;`);
	}
	head.push('');
	head.push(`active ${gcsimKey(team[0].id)};`);
	head.push('');
	return [...head, ...lines, ''].join('\n');
}

// ---------------------------------------------------------------------------
// Invocation
// ---------------------------------------------------------------------------

export function runGcsim(configText, { bin = null } = {}) {
	const exe = bin ?? ensureBinary();
	const dir = mkdtempSync(join(tmpdir(), 'critcalc-gcsim-'));
	const cfgPath = join(dir, 'config.txt');
	const outPath = join(dir, 'sample.json');
	try {
		writeFileSync(cfgPath, configText);
		try {
			execFileSync(exe, ['-c', cfgPath, '-sample', outPath, '-nr=false'], { stdio: 'pipe' });
		} catch (err) {
			const detail = [err.stdout, err.stderr].filter(Boolean).map(String).join('\n').trim();
			return { ok: false, error: detail || err.message, sample: null };
		}
		if (!existsSync(outPath)) {
			return { ok: false, error: 'gcsim produced no sample file', sample: null };
		}
		return { ok: true, error: null, sample: JSON.parse(readFileSync(outPath, 'utf8')) };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/**
 * ⚠️⚠️ **gcsim is NOT deterministic, and no CLI flag makes it so.** The sample
 * seed comes from `CryptoRandSeed()` (`cmd/gcsim/main.go:201`), and some kits
 * genuinely roll dice — Ningguang's catalyst normals pick a random animation
 * variant per swing (`Normal (Left)` / `(Right)` / `(Twirl)`), and Fischl's A4
 * fired 5 or 6 times across otherwise identical runs.
 *
 * So the oracle is STATISTICAL, not exact. Rather than pretend otherwise, run
 * the config `runs` times and return the run whose application count is the
 * MODE, plus an honest `varied` flag when the runs disagreed. A fixture that
 * wobbles is a property of that fixture and belongs in the report.
 */
export function runGcsimStable(configText, { bin = null, runs = 3 } = {}) {
	const exe = bin ?? ensureBinary();
	const samples = [];
	for (let i = 0; i < runs; i++) {
		const r = runGcsim(configText, { bin: exe });
		if (!r.ok) return { ...r, varied: false, counts: [] };
		samples.push(r.sample);
	}
	const counts = samples.map(
		(s) => (s.logs ?? []).filter((e) => e.event === 'element' && e.msg === 'application').length
	);
	const tally = new Map();
	for (const c of counts) tally.set(c, (tally.get(c) ?? 0) + 1);
	let modal = counts[0];
	let best = -1;
	for (const [value, n] of tally) {
		if (n > best) {
			best = n;
			modal = value;
		}
	}
	return {
		ok: true,
		error: null,
		sample: samples[counts.indexOf(modal)],
		varied: tally.size > 1,
		counts
	};
}

// ---------------------------------------------------------------------------
// Log → facts
// ---------------------------------------------------------------------------

/** 25 durability = 1 gauge unit. */
export const DURABILITY_PER_UNIT = 25;

/** gcsim attack tags seen on element events. */
const ATTACK_TAG = { 1: 'normal', 2: 'charged', 3: 'plunge', 4: 'skill', 6: 'burst' };

/**
 * ⚠️⚠️ Reactions leave FOUR different kinds of trace, and three of them are
 * easy to miss. Each was found by enumerating every `(event, msg)` pair across
 * the fixture corpus rather than by guessing:
 *
 *   1. Amplifying (melt/vaporize) → `damage.logs.amp`.
 *   2. Additive (aggravate/spread) → `damage.logs.cata`.
 *   3. DAMAGING transformative → a `damage` event whose `abil` IS the reaction.
 *   4. NON-damaging reactions leave no `damage` event at all:
 *      - **crystallize** emits `element :: "<ele> crystallize shard spawned"`
 *      - **freeze** emits nothing; it is only visible as a `frozen` entry
 *        appearing in an application's after-state, so we DERIVE it.
 *
 * ⛔ There is NO log line whose message says "melt". A naive message grep finds
 * zero reactions in a config that definitely melted — the first pass of this
 * harness did exactly that.
 *
 * ⚠️ `(self damage)` variants are the SAME reaction logged twice (bloom and
 * burning both self-harm), and counting them doubles those families.
 */
const TRANSFORMATIVE = [
	'overload',
	'superconduct',
	'electrocharged',
	'shatter',
	'swirl',
	'crystallize',
	'burning',
	'bloom',
	'hyperbloom',
	'burgeon',
	'lunarcharged',
	'lunarbloom',
	'lunarcrystallize'
];

/** `["cryo: 29.889"]` → `{ cryo: 29.889 }`. */
function parseAura(list) {
	const out = {};
	if (!Array.isArray(list)) return out;
	for (const entry of list) {
		const m = /^([a-z]+):\s*([\d.]+)$/.exec(String(entry).trim());
		if (m) out[m[1]] = Number.parseFloat(m[2]);
	}
	return out;
}

/**
 * Reduce a sample's log to the three things the differ compares.
 *
 * ⚠️ Attribution is the fiddly part: a cast hit and a summon tick both arrive
 * as `element` events. We attach each application to the most recent action by
 * the SAME character and carry the raw `abil` string through, so an ambiguous
 * pairing is visible in the report rather than silently resolved. gcsim often
 * self-labels the distinction ("… (Initial)" vs "… (Tick)").
 */
export function extractFacts(sample) {
	const logs = sample?.logs ?? [];
	const actions = [];
	const applications = [];
	const reactions = [];
	const lastActionByChar = new Map();

	for (const ev of logs) {
		const frame = ev.frame;
		const ci = ev.char_index;
		const L = ev.logs ?? {};

		if (ev.event === 'action' && typeof L.action === 'string') {
			if (L.action === 'swap') continue;
			const record = { frame, charIndex: ci, action: L.action, index: actions.length };
			actions.push(record);
			lastActionByChar.set(ci, record);
			continue;
		}

		// Crystallize deals no damage — a shard spawn is its only trace.
		if (ev.event === 'element' && / crystallize shard spawned$/.test(ev.msg)) {
			const ele = ev.msg.split(' ')[0];
			reactions.push({
				frame,
				charIndex: ci,
				reaction: `crystallize-${ele}`,
				family: 'transformative'
			});
			continue;
		}

		if (ev.event === 'element' && ev.msg === 'application') {
			const origin = lastActionByChar.get(ci) ?? null;
			const auraBefore = parseAura(L.existing);
			const auraAfter = parseAura(L.after);
			// Freeze is logged nowhere; `frozen` appearing in the after-state IS
			// the formation. ⚠️ DERIVED, not read — flagged as such in the report.
			if (auraAfter.frozen && !auraBefore.frozen) {
				reactions.push({ frame, charIndex: ci, reaction: 'freeze', family: 'derived' });
			}
			applications.push({
				frame,
				charIndex: ci,
				element: L.applied_ele,
				durability: L.dur,
				units: typeof L.dur === 'number' ? L.dur / DURABILITY_PER_UNIT : null,
				ability: L.abil,
				attackTag: ATTACK_TAG[L.attack_tag] ?? String(L.attack_tag ?? '?'),
				auraBefore,
				auraAfter,
				originActionIndex: origin?.index ?? null,
				framesSinceAction: origin ? frame - origin.frame : null
			});
			continue;
		}

		if (ev.event === 'damage') {
			const abil = String(L.abil ?? '').toLowerCase();
			// ⚠️ bloom and burning each log a second `… (self damage)` event for
			// the SAME reaction; counting both doubles those families.
			if (abil.includes('(self damage)')) continue;
			if (L.amp) {
				reactions.push({ frame, charIndex: ci, reaction: String(L.amp), family: 'amplifying' });
			} else if (L.cata) {
				reactions.push({ frame, charIndex: ci, reaction: String(L.cata), family: 'additive' });
			} else {
				const hit = TRANSFORMATIVE.find((r) => abil === r || abil.startsWith(`${r}-`));
				if (hit) {
					reactions.push({ frame, charIndex: ci, reaction: abil, family: 'transformative' });
				}
			}
		}
	}

	return { actions, applications, reactions };
}

/** Sim-order character index → our character id, from the generated team. */
export function charIndexMap(team) {
	return new Map(team.map((c, i) => [i, c.id]));
}
