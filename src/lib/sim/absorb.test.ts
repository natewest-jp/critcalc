/**
 * src/lib/sim/absorb.test.ts
 *
 * ⚓ Elemental absorption (2026-10-17; `docs/elemental-absorption-survey.md` §8)
 * end to end over the shipped data, read off the public IR: what each absorber
 * applies once its lock holds, and that nothing appears with no aura to absorb.
 * Numbers are gcsim's (4eda9fc5f), cited in each character's curator notes.
 */
import { describe, expect, it } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';

const all = Object.values(import.meta.glob('../data/characters/*.json', { eager: true })).map(
	(m) => (m as { default: CharacterData }).default
);
const byName = new Map(all.map((c) => [c.displayName, c]));
const lookup = (n: string) => byName.get(n) ?? null;

/** The absorber's non-Anemo applications: [element, units]. */
const absorbed = (notation: string, team: string[], who: string) =>
	parseNotation(notation, lookup, 8, {}, {}, team.map(lookup))
		.applications.filter((a) => a.characterId === who && a.element !== 'anemo')
		.map((a) => [a.element, a.units] as const);

describe('elemental absorption', () => {
	it('Kazuha twins all five field ticks in the aura it found (ICDTagNone)', () => {
		const apps = absorbed('Bennett E > Kazuha E Q ~9s', ['Bennett', 'Kazuha'], 'kaedehara_kazuha');
		expect(apps).toEqual(Array(5).fill(['pyro', 1]));
	});

	it('Venti starts his own stream at the lock: 15 hits, every third applies', () => {
		const r = parseNotation(
			'Bennett E > Venti Q ~9s',
			lookup,
			8,
			{},
			{},
			['Bennett', 'Venti'].map(lookup)
		);
		const stormeye = r.windows.find((w) => w.kind === 'summon' && w.label === 'Stormeye') as {
			absorbedTicks?: { time: number }[];
		};
		expect(stormeye.absorbedTicks).toHaveLength(15);
		const gaps = stormeye
			.absorbedTicks!.slice(1)
			.map((m, i) => m.time - stormeye.absorbedTicks![i].time);
		expect(new Set(gaps)).toEqual(new Set([24]));
		expect(
			r.applications.filter((a) => a.characterId === 'venti' && a.element === 'pyro')
		).toHaveLength(5);
	});

	it('nothing to absorb, nothing absorbed — and Heizou has no Iris at all', () => {
		expect(absorbed('Venti Q ~9s', ['Venti'], 'venti')).toEqual([]);
		expect(absorbed('Heizou Q ~2s', ['Heizou'], 'shikanoin_heizou')).toEqual([]);
		expect(absorbed('Bennett E > Heizou Q ~2s', ['Bennett', 'Heizou'], 'shikanoin_heizou')).toEqual(
			[['pyro', 1]]
		);
	});

	it("the Traveler's burst twin is 2U; her hold's twins share one counter", () => {
		expect(
			absorbed('Ganyu E > Anemo Traveler Q ~5s', ['Ganyu', 'Anemo Traveler'], 'traveler_anemo')
		).toEqual(Array(9).fill(['cryo', 2]));
		// Lock at 32f: of the six twins (46…116) only 46 and 96 apply.
		expect(
			absorbed('Ganyu E > Anemo Traveler hE ~3s', ['Ganyu', 'Anemo Traveler'], 'traveler_anemo')
		).toEqual([
			['cryo', 1],
			['cryo', 1]
		]);
	});

	it('a Frozen target counts as Cryo (Nate, combat logs 2026-10-14)', () => {
		const apps = absorbed(
			'Xingqiu E > Ganyu E > Sucrose Q ~7s',
			['Xingqiu', 'Ganyu', 'Sucrose'],
			'sucrose'
		);
		expect(apps.length).toBeGreaterThan(0);
		expect(apps.every(([el]) => el === 'cryo' || el === 'hydro')).toBe(true);
		expect(apps[0][0]).not.toBe('hydro');
	});
});
