/**
 * projections.test.ts — the seven row surfaces the timeline draws off the IR.
 *
 * ⚓ WHAT SURVIVES THE L3 DIFFER. Through L3c/L3d this file was one side of a
 * two-engine comparison against a frozen copy of the parser (`parserDiffer.ts`,
 * deleted with the copy at L3e). The comparison is gone; the CORPUS and the
 * projection bundle are not, because they were the useful half:
 *
 *   - every character, at C0 and C6, plus 33 multi-character scenarios, run
 *     through all seven row projections;
 *   - the two COVERAGE FLOORS that caught real holes when the differ was built
 *     — that every id in the fixture loadout resolves, and that every
 *     buff-window source family is actually reached.
 *
 * ⚠️ A projection that throws takes the whole timeline down through the
 * synchronous `$derived` that drives it (`RotationTimeline.svelte`), and the
 * corpus is the only place a kit shaped unlike the others gets exercised.
 */

import { describe, it, expect } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { LoadoutEntry } from '$lib/stores';
import { getArtifactSetById } from '$lib/data/artifactLookup';
import { getWeaponById } from '$lib/data/weaponLookup';
import { projectAll, type ProjectionInput } from './projections';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byId = new Map(all.map((c) => [c.id, c]));
const byName = new Map(all.map((c) => [c.displayName, c]));
const lookup = (name: string): CharacterData | null => byName.get(name) ?? null;
const getCharacter = (id: string): CharacterData | null => byId.get(id) ?? null;

/** Per-character notation driving every DECLARED input token — the same
 *  generator `notationParser.ir.test.ts` uses, so hold/press variants and the
 *  movement tokens all get reached. */
const SKILL_TOKENS = ['E', 'tE', 'pE', 'hE', 'h1E', 'h2E'] as const;
function rosterNotation(c: CharacterData): string {
	const toks = new Set<string>();
	for (const a of c.abilities) {
		if (a.abilityType !== 'skill') continue;
		for (const t of a.input ?? []) toks.add(t);
		for (const v of a.variants ?? []) for (const t of v.input ?? []) toks.add(t);
	}
	const skills = SKILL_TOKENS.filter((t) => toks.has(t));
	const extraBursts = new Set<string>();
	for (const a of c.abilities) {
		if (a.abilityType !== 'burst') continue;
		for (const v of a.variants ?? []) for (const t of v.input ?? []) extraBursts.add(t);
	}
	extraBursts.delete('Q');
	const s = skills.length ? skills : ['E'];
	return [
		c.displayName,
		...s,
		'N1',
		'N2',
		'N3',
		'C',
		'D',
		'P',
		'J',
		'Q',
		s[0],
		...[...extraBursts].sort()
	].join(' ');
}

/** Multi-character rotations: swaps, cross-element reactions, shields, summons,
 *  long waits, brackets. ⚓ The twelve L0 oracle fixtures are included verbatim —
 *  they are the rotations the gauge round's baseline is measured on. */
const SCENARIOS: { name: string; notation: string }[] = [
	{ name: 'oracle/melt', notation: 'Kaeya E > Xiangling E Q' },
	{ name: 'oracle/vaporize', notation: 'Xingqiu E Q > Bennett E Q > Xiangling E Q' },
	{ name: 'oracle/electro-charged', notation: 'Barbara E > Fischl E Q > Barbara N3' },
	{ name: 'oracle/freeze', notation: 'Kaeya E Q > Mona E Q > Kaeya N3 N3' },
	{ name: 'oracle/quicken', notation: 'Nahida E Q > Fischl E Q > Fischl N3' },
	{ name: 'oracle/bloom', notation: 'Nahida E Q > Xingqiu E Q' },
	{ name: 'oracle/burning', notation: 'Collei E Q > Xiangling E Q' },
	{ name: 'oracle/swirl-heavy', notation: 'Xiangling E Q > Sucrose N4 E Q N4' },
	{ name: 'oracle/crystallize', notation: 'Fischl E Q > Ningguang E N3 > Zhongli E' },
	{ name: 'oracle/plunge-spam', notation: 'Kaeya E > Xiao E Q P P P P' },
	{
		name: 'oracle/long-rotation',
		notation: 'Kaeya E Q ~20s > Xiangling E Q ~20s > Fischl E Q ~20s > Kaeya E'
	},
	{ name: 'oracle/catalyst-normals', notation: 'Kaeya E > Klee N5 C N5 C' },

	{ name: 'shield/zhongli-hold', notation: 'Zhongli hE > Noelle E Q > Layla E > Xinyan E' },
	{ name: 'stance/hu-tao', notation: 'Xingqiu E Q > Hu Tao E N1 N2 N3 N4 N5 C > Xingqiu N1' },
	{ name: 'stance/cyno', notation: 'Cyno Q N1 N2 N3 E N1 N2 > Nahida E' },
	{ name: 'stance/xilonen-swap', notation: 'Xilonen E N1 N2 > Bennett Q E > Xilonen E' },
	{ name: 'transient/varesa', notation: 'Varesa E P sQ > Bennett Q' },
	{ name: 'transient/flins', notation: 'Flins E sQ > Fischl E Q' },
	{ name: 'summon/multi', notation: 'Ineffa E > Citlali E > Furina E Q > Fischl E' },
	{ name: 'summon/collei-extend', notation: 'Collei Q E > Xiangling E Q > Collei E' },
	{ name: 'charges/cyno-queue', notation: 'Cyno E E E ~3s E > Fischl E' },
	{ name: 'charges/mona-swap', notation: 'Mona E Q > Kaeya E Q > Mona E > Kaeya E' },
	{ name: 'stacks/skirk-drain', notation: 'Skirk E N3 N3 ~5s Q > Escoffier E Q' },
	{ name: 'stacks/yanfei-seals', notation: 'Yanfei E N1 N2 N3 C Q C > Bennett Q' },
	{ name: 'infusion/bennett-c6', notation: 'Bennett Q > Xingqiu E N1 N2 N3 > Klee N3 C' },
	{ name: 'infusion/candace', notation: 'Candace Q > Fischl N1 N2 N3 > Ningguang N3' },
	{ name: 'faction/moonsign', notation: 'Aino E Q > Ineffa E Q > Flins E Q > Columbina E Q' },
	{ name: 'nb/natlan', notation: 'Mavuika hE Q > Xilonen E > Kachina E > Citlali E' },
	{ name: 'brackets', notation: 'Hu Tao E 3[N5C] > Bennett Q E' },
	{ name: 'waits', notation: 'Bennett E ~30s Q > Xiangling E ~?s Q > Fischl E ~2.5s Q' },
	{ name: 'repeat-cycles', notation: 'Bennett Q E > Xiangling E Q > Xingqiu E Q > Hu Tao E N5 C' },
	{
		name: 'long/20-cycle',
		notation: Array.from(
			{ length: 20 },
			() => 'Bennett Q E > Xiangling E Q > Xingqiu E Q > Hu Tao E N5 C ~2s'
		).join(' > ')
	},
	{ name: 'unknown-tokens', notation: 'Bennett E W A Z9 Q > Fischl A E' },
	{ name: 'fifth-character', notation: 'Bennett E > Fischl E > Xiangling E > Sucrose E > Klee E' }
];

/** A loadout that reaches the weapon-proc and artifact branches — otherwise
 *  three whole dispatch families in `deriveBuffWindows` are never exercised. */
const LOADOUT: Record<string, LoadoutEntry> = {
	bennett: { weaponId: 'sacrificial_sword', weaponRefinement: 3, artifactSetId: 'noblesse_oblige' },
	xiangling: {
		weaponId: 'thrilling_tales_of_dragon_slayers',
		weaponRefinement: 5,
		artifactSetId: 'instructor'
	},
	fischl: { weaponId: 'sacrificial_bow', weaponRefinement: 1, artifactSetId: 'deepwood_memories' },
	sucrose: {
		weaponId: 'sacrificial_fragments',
		weaponRefinement: 5,
		artifactSetId: 'viridescent_venerer'
	},
	nahida: { weaponId: 'the_widsith', weaponRefinement: 5, artifactSetId: 'deepwood_memories' },
	zhongli: { artifactSetId: 'tenacity_of_the_millelith' },
	aino: { artifactSetId: 'silken_moons_serenade' },
	xingqiu: { weaponId: 'sacrificial_sword', weaponRefinement: 1, artifactSetId: 'noblesse_oblige' }
};

const c6Of = (r: { tracks: { characterId: string }[] }): Record<string, number> =>
	Object.fromEntries(r.tracks.map((t) => [t.characterId, 6]));

/** Every number a row surface hands the renderer must be finite: an `undefined`
 *  or `NaN` reaches an SVG attribute and the bar vanishes without an error. */
function assertFiniteGeometry(label: string, value: unknown, path = ''): void {
	if (typeof value === 'number') {
		expect(Number.isFinite(value), `${label} ${path}`).toBe(true);
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((v, i) => assertFiniteGeometry(label, v, `${path}[${i}]`));
		return;
	}
	if (value && typeof value === 'object') {
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			// Only walk geometry-ish keys; effect payloads carry authored data
			// that is checked by the character lint, not here.
			if (k === 'effects' || k === 'stackContext') continue;
			assertFiniteGeometry(label, v, `${path}.${k}`);
		}
	}
}

describe('row projections over the corpus', () => {
	it('is actually running over the corpus', () => {
		// ⚠️ The floor that stops the sweeps below passing VACUOUSLY — a glob that
		// resolves to nothing makes every loop body run zero times, which reads
		// exactly like success.
		expect(all.length).toBeGreaterThanOrEqual(120);
		expect(SCENARIOS.length).toBeGreaterThanOrEqual(30);
	});

	it('every id in the fixture loadout resolves', () => {
		// ⚠️ A silent-skip guard that has already earned its place: an
		// unresolvable `artifactSetId` makes `getArtifactSetById` return null and
		// `deriveBuffWindows` skips the whole artifact branch without a word, so a
		// case meant to cover Deepwood covers nothing. Both data sets are small
		// and curated — a plausible id is not a present one.
		for (const [charId, entry] of Object.entries(LOADOUT)) {
			expect(getCharacter(charId), `loadout character ${charId}`).not.toBeNull();
			if (entry.artifactSetId) {
				expect(getArtifactSetById(entry.artifactSetId), entry.artifactSetId).toBeTruthy();
			}
			if (entry.weaponId) expect(getWeaponById(entry.weaponId), entry.weaponId).toBeTruthy();
		}
	});

	it('reaches every buff-window SOURCE family', () => {
		// ⚠️ A sweep can be green because the code works, or green because the
		// branch never ran. These four families are each reached by only a couple
		// of scenarios, so a fixture edit can quietly drop one.
		const seen = new Set<string>();
		for (const s of SCENARIOS) {
			const probe = parseNotation(s.notation, lookup, 8, {}, {}, undefined);
			const r = parseNotation(s.notation, lookup, 8, c6Of(probe), LOADOUT, undefined);
			for (const w of r.windows) if (w.kind === 'buff') seen.add(w.source.type);
		}
		expect([...seen].sort()).toEqual(['artifact', 'character', 'faction', 'weapon']);
	});

	it('every one of the seven surfaces produces rows somewhere in the corpus', () => {
		// ⚠️ The third silent-skip floor. `assertFiniteGeometry` over an empty
		// bundle passes trivially, so without this the two sweeps below could be
		// green while a projection returned `[]` for every input in the corpus.
		const nonEmpty = new Set<string>();
		for (const s of SCENARIOS) {
			const probe = parseNotation(s.notation, lookup, 8, {}, {}, undefined);
			const constellationLevels = c6Of(probe);
			const r = parseNotation(s.notation, lookup, 8, constellationLevels, LOADOUT, undefined);
			const rows = projectAll(r, { getCharacter, constellationLevels, loadoutMap: LOADOUT });
			for (const [key, value] of Object.entries(rows)) {
				if (Array.isArray(value) && value.length > 0) nonEmpty.add(key);
			}
		}
		expect([...nonEmpty].sort()).toEqual([
			'moonsign',
			'nb',
			'received',
			'shield',
			'summon',
			'teamBuff',
			'weaponProc'
		]);
	});

	it('projects every character at C0 and C6', () => {
		for (const c of all) {
			const notation = rosterNotation(c);
			for (const cons of [{}, { [c.id]: 6 }]) {
				const r = parseNotation(notation, lookup, 8, cons, {}, undefined);
				const input: ProjectionInput = {
					getCharacter,
					constellationLevels: cons,
					loadoutMap: {}
				};
				const rows = projectAll(r, input);
				assertFiniteGeometry(`${c.id}`, rows);
			}
		}
	});

	it('projects every scenario, with and without a loadout', () => {
		for (const s of SCENARIOS) {
			const probe = parseNotation(s.notation, lookup, 8, {}, {}, undefined);
			const cases: [Record<string, number>, Record<string, LoadoutEntry>][] = [
				[{}, {}],
				[c6Of(probe), LOADOUT]
			];
			for (const [constellationLevels, loadoutMap] of cases) {
				const r = parseNotation(s.notation, lookup, 8, constellationLevels, loadoutMap, undefined);
				const rows = projectAll(r, { getCharacter, constellationLevels, loadoutMap });
				assertFiniteGeometry(s.name, rows);
			}
		}
	});
});
