/**
 * parserDiffer.test.ts — the L3 corpus differ (`docs/gauge-round-L3.md` §5).
 *
 * Runs the LIVE parser and the FROZEN `notationParser.legacy.ts` over the same
 * corpus and asserts three surfaces agree: STRICT (the IR, ids and array order
 * included), CANONICAL (a diagnostic that fires only when STRICT is red), and
 * the seven ROW PROJECTIONS (what actually moves on screen — ⚓ gauge-round.md
 * C2's real question).
 *
 * ⚠️ THIS TEST IS GREEN ON DAY ONE, BY CONSTRUCTION — both engines are the same
 * code until the first extraction lands. That is the point: a differ that starts
 * red proves nothing about what comes after it. What day one buys is the
 * HARNESS, verified against a real corpus, plus the two seeded-difference cases
 * below that prove it can actually see a change.
 *
 * ⛔ Deleted at L3e together with the frozen copy — except the seeded-difference
 * cases and `projectAll`, which are worth keeping as an ordinary guard.
 */

import { describe, it, expect } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import { parseNotation as parseNotationLegacy } from '$lib/utils/notationParser.legacy';
import type { CharacterData } from '$lib/types/character';
import type { LoadoutEntry } from '$lib/stores';
import { getArtifactSetById } from '$lib/data/artifactLookup';
import { getWeaponById } from '$lib/data/weaponLookup';
import { compare, describe as describeVerdict, type ProjectionInput } from './parserDiffer';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byId = new Map(all.map((c) => [c.id, c]));
const byName = new Map(all.map((c) => [c.displayName, c]));
const lookup = (name: string): CharacterData | null => byName.get(name) ?? null;
const getCharacter = (id: string): CharacterData | null => byId.get(id) ?? null;

// ── the corpus ────────────────────────────────────────────────────────────────

/** Per-character notation, mirroring `notationParser.ir.test.ts` — it drives
 *  every DECLARED input token, which is how hold/press variants get reached. */
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
	return [
		c.displayName,
		...(skills.length ? skills : ['E']),
		'N1',
		'N2',
		'N3',
		'C',
		'D',
		'P',
		'J',
		'Q',
		(skills.length ? skills : ['E'])[0],
		...[...extraBursts].sort()
	].join(' ');
}

/** Multi-character rotations: swaps, cross-element reactions, shields, summons,
 *  long waits, brackets. ⚓ The twelve L0 oracle fixtures are included verbatim
 *  — they are the rotations the round's baseline numbers are measured on, so a
 *  divergence in one of them is a divergence in the thing L5 gets graded by. */
const SCENARIOS: { name: string; notation: string }[] = [
	// L0 oracle fixtures (scripts/audit-gcsim-reactions.mjs)
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

	// Shapes the oracle set does not reach.
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

// ── the run ───────────────────────────────────────────────────────────────────

type Case = {
	label: string;
	notation: string;
	constellationLevels: Record<string, number>;
	loadoutMap: Record<string, LoadoutEntry>;
};

function runCase(c: Case): string | null {
	const args = [lookup, 8, c.constellationLevels, c.loadoutMap, undefined] as const;
	const live = parseNotation(c.notation, ...args);
	const legacy = parseNotationLegacy(c.notation, ...args);
	const input: ProjectionInput = {
		getCharacter,
		constellationLevels: c.constellationLevels,
		loadoutMap: c.loadoutMap
	};
	const verdict = compare(live, legacy, input);
	if (!verdict.strict && !verdict.projections) return null;
	return describeVerdict(verdict, c.label);
}

/** Collects every failing case rather than dying on the first, because "which
 *  characters broke" is the diagnosis — one character is a data edge, all 123 is
 *  a driver bug. Capped so a total break prints a page, not a book. */
function runAll(cases: Case[]): string[] {
	const out: string[] = [];
	for (const c of cases) {
		const failure = runCase(c);
		if (failure) out.push(failure);
		if (out.length >= 12) {
			out.push(`… and more (stopped after 12 of ${cases.length} cases)`);
			break;
		}
	}
	return out;
}

describe('L3 corpus differ — live parser vs frozen legacy', () => {
	it('is actually running over the corpus', () => {
		// ⚠️ The floor that stops the four tests below passing VACUOUSLY. A glob
		// that resolves to nothing makes `runAll([])` return `[]`, which is
		// indistinguishable from "everything agreed" — and this file is the only
		// gate the rest of L3 has.
		expect(all.length).toBeGreaterThanOrEqual(120);
		expect(SCENARIOS.length).toBeGreaterThanOrEqual(30);
	});

	it('every id in the loadout resolves', () => {
		// ⚠️ Same silent-skip class as the floor above, and it has already bitten:
		// an unresolvable `artifactSetId` makes `getArtifactSetById` return null
		// and `deriveBuffWindows` skips the whole artifact branch without a word,
		// so the case that was meant to cover Deepwood covers nothing. Both data
		// sets are small and curated (6 artifact sets, 6 weapons) — a plausible
		// id is not a present one.
		for (const [charId, entry] of Object.entries(LOADOUT)) {
			expect(getCharacter(charId), `loadout character ${charId}`).not.toBeNull();
			if (entry.artifactSetId) {
				expect(getArtifactSetById(entry.artifactSetId), entry.artifactSetId).toBeTruthy();
			}
			if (entry.weaponId) expect(getWeaponById(entry.weaponId), entry.weaponId).toBeTruthy();
		}
	});

	it('agrees on every character at C0', () => {
		const cases = all.map((c) => ({
			label: `roster/${c.id}`,
			notation: rosterNotation(c),
			constellationLevels: {},
			loadoutMap: {}
		}));
		expect(runAll(cases).join('\n')).toBe('');
	});

	it('agrees on every character at C6', () => {
		// ⚠️ C6 is not a formality here: 47 of the corpus's 104 `damage` effects
		// are constellation-gated, and whole dispatch branches (cdReset targets,
		// constellationScaling, gated infusions) are unreachable below it.
		const cases = all.map((c) => ({
			label: `roster-c6/${c.id}`,
			notation: rosterNotation(c),
			constellationLevels: { [c.id]: 6 },
			loadoutMap: {}
		}));
		expect(runAll(cases).join('\n')).toBe('');
	});

	it('agrees on the multi-character scenarios', () => {
		const cases = SCENARIOS.map((s) => ({
			label: s.name,
			notation: s.notation,
			constellationLevels: {},
			loadoutMap: {}
		}));
		expect(runAll(cases).join('\n')).toBe('');
	});

	it('the corpus reaches every buff-window SOURCE family', () => {
		// ⚠️ The third silent-skip guard, and the one with teeth: a differ can be
		// green because both engines agree, or green because neither engine ever
		// ran the branch. These four families are each reached by exactly a
		// couple of scenarios, so a fixture edit can quietly drop one.
		const seen = new Set<string>();
		for (const s of SCENARIOS) {
			const probe = parseNotation(s.notation, lookup, 8, {}, {}, undefined);
			const r = parseNotation(s.notation, lookup, 8, c6Of(probe), LOADOUT, undefined);
			for (const w of r.windows) if (w.kind === 'buff') seen.add(w.source.type);
		}
		expect([...seen].sort()).toEqual(['artifact', 'character', 'faction', 'weapon']);
	});

	it('agrees on the scenarios at C6 with a populated loadout', () => {
		const cases = SCENARIOS.map((s) => {
			const probe = parseNotation(s.notation, lookup, 8, {}, {}, undefined);
			return {
				label: `${s.name}/c6+loadout`,
				notation: s.notation,
				constellationLevels: c6Of(probe),
				loadoutMap: LOADOUT
			};
		});
		expect(runAll(cases).join('\n')).toBe('');
	});
});

describe('L3 corpus differ — the harness can see a change', () => {
	// ⚠️ Without these, a comparator that returned `null` unconditionally would
	// pass every test above and the whole landing would be ungated.
	const NOTATION = 'Bennett Q E > Xiangling E Q > Xingqiu E Q > Hu Tao E N5 C';
	const base = () => parseNotation(NOTATION, lookup, 8, {}, {}, undefined);
	const input: ProjectionInput = { getCharacter, constellationLevels: {}, loadoutMap: {} };

	it('catches a VALUE change, on all three surfaces', () => {
		const a = base();
		const b = base();
		const cast = b.events.find((e) => e.kind === 'cast')!;
		cast.time += 1;
		const v = compare(a, b, input);
		expect(v.strict).toMatch(/events\[\d+\]\.time/);
		expect(v.canonical).not.toBeNull();
	});

	it('catches an ORDER change in STRICT while CANONICAL stays clean', () => {
		// ⚓ This is the C2 scenario in miniature: same content, different
		// emission order. STRICT must go red and CANONICAL must stay green — that
		// contrast is the diagnostic's entire reason to exist.
		const a = base();
		const b = base();
		expect(b.events.length).toBeGreaterThan(2);
		// A permutation of the stream — the strongest form of the case, since
		// CANONICAL sorts and must therefore be blind to ANY reordering while
		// STRICT sees this one immediately.
		b.events.reverse();
		const v = compare(a, b, input);
		expect(v.strict).not.toBeNull();
		expect(v.canonical).toBeNull();
	});

	it('catches a row moving on screen', () => {
		const a = base();
		const b = base();
		const buffIdx = b.windows.findIndex((w) => w.kind === 'buff');
		expect(buffIdx).toBeGreaterThanOrEqual(0);
		const w = b.windows[buffIdx] as Extract<(typeof b.windows)[number], { kind: 'buff' }>;
		w.end += 60;
		expect(compare(a, b, input).projections).not.toBeNull();
	});
});
