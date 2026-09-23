/**
 * scripts/ingest-character.mjs
 *
 * In-repo character generator — retires the external genshin-db generator.
 * Produces (a) a stub character JSON matching the corpus shape (identity,
 * sectioned kit text, ability skeletons with cooldown/duration/energy parsed
 * from talent attribute labels, passives, constellations with
 * constellationLevel, meta) and (b) a talent-scaling sidecar under
 * docs/curation/talents/{id}.json for curation-time reference (character
 * JSONs are client-shipped chunks; scaling tables stay out of them).
 *
 *   node scripts/ingest-character.mjs "Columbina"            # new character
 *   node scripts/ingest-character.mjs "Columbina" --force    # overwrite JSON
 *   node scripts/ingest-character.mjs "Bennett" --sidecar-only
 *   node scripts/ingest-character.mjs --all-sidecars         # whole roster
 *
 * After ingesting: npm run generate-character-index (or just predev/prebuild).
 * New game patch: npm update genshin-db, then ingest the new names.
 *
 * Frame data is a SEPARATE pass (gcsim lags releases) — stubs carry no frames
 * and are honestly reported as "not yet curated" by every tool.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('genshin-db');
const DB_VERSION = require('genshin-db/package.json').version;

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARACTERS_DIR = join(PROJECT_ROOT, 'src/lib/data/characters');
const SIDECAR_DIR = join(PROJECT_ROOT, 'docs/curation/talents');

// ---------------------------------------------------------------------------
// Naming conventions (must match the existing corpus exactly)
// ---------------------------------------------------------------------------

/** Character-id overrides for names whose default slug (spaces→underscores,
 *  lowercased) doesn't match the corpus id. None currently — Lan Yan (`lanyan`)
 *  was the last holdout, renamed to the standard `lan_yan` 2026-07-15. */
const ID_OVERRIDES = {};

/** "Hu Tao" → hu_tao; "Kamisato Ayaka" → kamisato_ayaka. */
function characterIdOf(name) {
	return ID_OVERRIDES[name] ?? name.toLowerCase().replace(/\s+/g, '_');
}

/** Ability-name slug: strip punctuation (hyphens join words: "Short-Range" →
 *  "shortrange"), spaces → underscores. Matches e.g.
 *  chevreuse__skill__shortrange_rapid_interdiction_fire. */
function slugOf(name) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '')
		.trim()
		.replace(/\s+/g, '_');
}

const abilityId = (charId, type, name) => `${charId}__${type}__${slugOf(name)}`;

// ---------------------------------------------------------------------------
// Attribute-label resolution
// genshin-db labels look like "CD|{param4:F1}s" / "Energy Cost|{param5:I}" /
// "1-Hit DMG|{param1:P}"; parameters.paramN is an array of per-level values.
// ---------------------------------------------------------------------------

function formatParam(value, fmt) {
	switch (fmt) {
		case 'P':
			return `${roundTo(value * 100, 2)}%`;
		case 'F1P':
			return `${(value * 100).toFixed(1)}%`;
		case 'F2P':
			return `${(value * 100).toFixed(2)}%`;
		case 'F1':
			return value.toFixed(1);
		case 'F2':
			return value.toFixed(2);
		case 'I':
			return String(Math.round(value));
		default:
			return String(roundTo(value, 4));
	}
}

function roundTo(v, places) {
	const f = 10 ** places;
	return Math.round(v * f) / f;
}

/** Resolves one label template at one talent-level index → display string. */
function resolveLabel(template, parameters, levelIndex) {
	return template.replace(/\{(param\d+):?([A-Z0-9]*)\}/g, (_, key, fmt) => {
		const arr = parameters?.[key];
		if (!arr || arr[levelIndex] === undefined) return '?';
		return formatParam(arr[levelIndex], fmt);
	});
}

/** Splits "Name|value-template" and resolves values across all levels. */
function tableRows(attributes) {
	if (!attributes?.labels) return [];
	const levels = Math.max(...Object.values(attributes.parameters ?? {}).map((a) => a.length), 1);
	return attributes.labels.map((label) => {
		const [name, template] = label.split('|');
		return {
			label: name,
			values: Array.from({ length: levels }, (_, i) =>
				resolveLabel(template ?? '', attributes.parameters, i)
			)
		};
	});
}

/** Numeric scalars (CD / Energy Cost / Duration) don't scale with talent
 *  level — resolve at level index 0 and parse the numbers out. */
function scalarFromLabels(attributes, matcher) {
	for (const label of attributes?.labels ?? []) {
		const [name, template] = label.split('|');
		if (!matcher(name)) continue;
		const resolved = resolveLabel(template ?? '', attributes.parameters, 0);
		const numbers = [...resolved.matchAll(/[\d.]+/g)].map((m) => Number(m[0]));
		if (numbers.length === 0) continue;
		return { name, value: numbers[0], all: numbers, display: resolved };
	}
	return null;
}

// ---------------------------------------------------------------------------
// Kit-text sectioning (normal attack description → normal/charged/plunging)
// ---------------------------------------------------------------------------

const SECTION_HEADERS = [
	{ type: 'normal', pattern: /^normal attack:?$/i, title: 'Normal Attack' },
	{ type: 'charged', pattern: /^charged attack:?$/i, title: 'Charged Attack' },
	{ type: 'plunging', pattern: /^plunging attack:?$/i, title: 'Plunging Attack' }
];

function sectionizeNormal(description) {
	const lines = description.split('\n');
	const sections = [];
	let current = null;
	for (const line of lines) {
		const header = SECTION_HEADERS.find((h) => h.pattern.test(line.trim()));
		if (header) {
			current = { type: header.type, title: header.title, description: '' };
			sections.push(current);
		} else if (current) {
			current.description += (current.description ? '\n' : '') + line;
		}
	}
	return sections.filter((s) => s.description.trim());
}

// ---------------------------------------------------------------------------
// Stub assembly
// ---------------------------------------------------------------------------

function buildCastAbility(charId, type, combat, notes) {
	const isSkill = type === 'skill';
	const ability = {
		id: abilityId(charId, type, combat.name),
		name: combat.name,
		input: [isSkill ? 'E' : 'Q'],
		abilityType: type
	};

	const cd = scalarFromLabels(combat.attributes, (n) => n === 'CD' || n.endsWith(' CD'));
	if (cd) {
		ability.cooldown = cd.value;
		if (cd.all.length > 1) {
			notes.push(
				`${combat.name}: CD label is multi-valued ("${cd.display}") — used first value ${cd.value}s; verify which variant it belongs to.`
			);
		}
	} else {
		notes.push(`${combat.name}: no CD label found — cooldown left unset, author it.`);
	}

	const duration = scalarFromLabels(combat.attributes, (n) => /duration/i.test(n));
	if (duration) ability.duration = duration.value;

	if (!isSkill) {
		const energy = scalarFromLabels(combat.attributes, (n) => /energy cost/i.test(n));
		if (energy) ability.energyCost = energy.value;
		else notes.push(`${combat.name}: no Energy Cost label — author energyCost.`);
	}

	ability.tags = [];
	ability.effects = [];
	ability.description = combat.description;
	ability.behavior = 'instant';
	return ability;
}

export function buildStub(name) {
	const char = db.characters(name);
	if (!char) throw new Error(`genshin-db has no character "${name}"`);
	if (/traveler|aether|lumine/i.test(char.name)) {
		throw new Error(
			'Traveler variants need element-split handling the corpus does by hand — not supported by this generator.'
		);
	}
	const talents = db.talents(name);
	const cons = db.constellations(name);
	if (!talents || !cons)
		throw new Error(`genshin-db is missing talents/constellations for "${name}"`);

	const charId = characterIdOf(char.name);
	const curatorNotes = [];

	const normal = {
		id: abilityId(charId, 'normal', talents.combat1.name),
		name: talents.combat1.name,
		input: ['N'],
		abilityType: 'normal',
		tags: [],
		sections: sectionizeNormal(talents.combat1.description),
		description: talents.combat1.description
	};

	const abilities = [
		normal,
		buildCastAbility(charId, 'skill', talents.combat2, curatorNotes),
		buildCastAbility(charId, 'burst', talents.combat3, curatorNotes)
	];

	// Corpus convention (current-era stubs): only the two ascension passives
	// live in the character JSON. Utility passives and special passives
	// (Moonsign benedictions, Natlan exploration) are excluded here but
	// preserved in the talent sidecar as extraPassives — curation reviews them
	// for combat relevance (benedictions inform Moonsign/faction modeling).
	const passives = [];
	for (const key of ['passive1', 'passive2']) {
		const p = talents[key];
		if (!p) continue;
		passives.push({
			id: abilityId(charId, 'passive', p.name),
			name: p.name,
			abilityType: 'passive',
			description: p.description
		});
	}

	const constellations = [];
	for (let level = 1; level <= 6; level++) {
		const c = cons[`c${level}`];
		if (!c) continue;
		constellations.push({
			id: abilityId(charId, 'constellation', c.name),
			name: c.name,
			abilityType: 'constellation',
			constellationLevel: level,
			effects: [],
			description: c.description
		});
	}

	const stub = {
		id: charId,
		name: char.name,
		displayName: char.name,
		element: char.elementText.toLowerCase(),
		weapon: char.weaponText.toLowerCase(),
		gender: char.gender,
		affiliation: char.affiliation,
		region: char.region,
		rarity: char.rarity,
		// The patch it released in (genshin-db `version`) — the coverage page's
		// "Newest first" sort (2026-09-23). ⚠️ Travelers are hand-built and carry
		// theirs by hand.
		release: char.version,
		abilities,
		passives,
		constellations,
		meta: { source: 'genshin-db', generatedAt: new Date().toISOString() }
	};
	if (curatorNotes.length > 0) stub._curatorNotes = curatorNotes;
	return stub;
}

export function buildSidecar(name) {
	const talents = db.talents(name);
	const char = db.characters(name);
	if (!talents || !char) throw new Error(`genshin-db is missing data for "${name}"`);
	const sidecar = {
		id: characterIdOf(char.name),
		source: `genshin-db@${DB_VERSION}`,
		generatedAt: new Date().toISOString(),
		note: 'Per-level talent scaling tables (levels 1..N left to right). Curation convention: cite the talent level you author values at.',
		talents: {}
	};
	for (const [key, label] of [
		['combat1', 'normal'],
		['combat2', 'skill'],
		['combat3', 'burst']
	]) {
		const t = talents[key];
		if (!t) continue;
		sidecar.talents[label] = { name: t.name, rows: tableRows(t.attributes) };
	}
	// Passives excluded from the character JSON (utility, Moonsign benedictions,
	// Natlan exploration) — review for combat relevance during curation.
	const extraPassives = [];
	for (const key of ['passive3', 'passive4']) {
		const p = talents[key];
		if (p) extraPassives.push({ name: p.name, description: p.description });
	}
	if (extraPassives.length > 0) sidecar.extraPassives = extraPassives;
	return sidecar;
}

// ---------------------------------------------------------------------------
// CLI (skipped when imported as a module — validation harnesses import
// buildStub/buildSidecar directly)
// ---------------------------------------------------------------------------

import { pathToFileURL } from 'node:url';
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (!isMain) {
	// imported for its exports — no CLI behavior
} else {
	await runCli();
}

async function runCli() {
	const args = process.argv.slice(2);
	const flags = new Set(args.filter((a) => a.startsWith('--')));
	const names = args.filter((a) => !a.startsWith('--'));

	async function writeSidecar(name) {
		const sidecar = buildSidecar(name);
		await mkdir(SIDECAR_DIR, { recursive: true });
		const path = join(SIDECAR_DIR, `${sidecar.id}.json`);
		await writeFile(path, JSON.stringify(sidecar, null, '\t') + '\n');
		console.log(`[ingest] sidecar → ${path.replace(PROJECT_ROOT + '/', '')}`);
	}

	if (flags.has('--all-sidecars')) {
		// Every roster character genshin-db knows (travelers/custom stubs skipped).
		const { readdir } = await import('node:fs/promises');
		const ids = (await readdir(CHARACTERS_DIR))
			.filter((f) => f.endsWith('.json'))
			.map((f) => f.replace('.json', ''));
		let done = 0;
		for (const id of ids) {
			const guess = id.replace(/_/g, ' ');
			try {
				await writeSidecar(guess);
				done++;
			} catch {
				console.warn(`[ingest] no genshin-db data for "${id}" — skipped`);
			}
		}
		console.log(`[ingest] ${done}/${ids.length} sidecars written`);
		process.exit(0);
	}

	if (names.length === 0) {
		console.error(
			'usage: node scripts/ingest-character.mjs <Name> [--force|--sidecar-only] | --all-sidecars'
		);
		process.exit(1);
	}

	for (const name of names) {
		if (flags.has('--sidecar-only')) {
			await writeSidecar(name);
			continue;
		}
		const stub = buildStub(name);
		const path = join(CHARACTERS_DIR, `${stub.id}.json`);
		if (existsSync(path) && !flags.has('--force')) {
			console.error(
				`[ingest] ${path.replace(PROJECT_ROOT + '/', '')} exists — refusing to overwrite curated data (use --force only for uncurated stubs).`
			);
			process.exit(1);
		}
		await writeFile(path, JSON.stringify(stub, null, '\t') + '\n');
		console.log(`[ingest] stub → ${path.replace(PROJECT_ROOT + '/', '')}`);
		await writeSidecar(name);
		console.log(
			`[ingest] next: curation pass (effects/tags per docs/curation/), then npm run generate-character-index; frames follow when gcsim ships them.`
		);
	}
}
