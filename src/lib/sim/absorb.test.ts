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
import { summonMarks } from '$lib/timeline/summonMarks';

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

	// ⚓ Nate 2026-10-18: follow gcsim — the box bounds the VOLLEY (`t <= b.Duration`,
	// bogglecatbox.go:125), and a shot travels 15f (`vividTravel`) after it.
	it("Lynette's last Vivid Shot, fired inside the box, lands after it and is KEPT", () => {
		// Kaeya's Cryo lands after the 68f poll, so the lock is the 86f
		// poll and the fifth volley fires at 756f — 14f before the box ends at 770.
		const r = parseNotation(
			'Lynette Q > Kaeya E ~14s',
			lookup,
			8,
			{},
			{},
			['Lynette', 'Kaeya'].map(lookup)
		);
		const box = r.windows.find((w) => w.kind === 'summon' && w.label === 'Bogglecat Box') as {
			end: number;
			absorbedTicks?: { time: number }[];
		};
		expect(box.end).toBe(770);
		expect(box.absorbedTicks!.map((m) => m.time)).toEqual([235, 369, 503, 637, 771]);
		// …and it reaches the gauge: a fresh standard window opens at 771.
		expect(
			r.applications
				.filter((a) => a.characterId === 'lynette' && a.element === 'cryo')
				.map((a) => a.time)
		).toEqual([235, 503, 771]);
	});

	it("Venti's stream is still CUT at the Stormeye's end (ruled, unverified)", () => {
		// A late lock (304f): gcsim would land all 15; the Stormeye's end keeps 12.
		const r = parseNotation(
			'Venti Q ~3s > Bennett E ~9s',
			lookup,
			8,
			{},
			{},
			['Venti', 'Bennett'].map(lookup)
		);
		const eye = r.windows.find((w) => w.kind === 'summon' && w.label === 'Stormeye') as {
			end: number;
			absorbedTicks?: { time: number }[];
		};
		expect(eye.absorbedTicks).toHaveLength(12);
		expect(eye.absorbedTicks!.every((m) => m.time < eye.end)).toBe(true);
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

describe('absorbed marks — the bar becomes the element, one stub per frame', () => {
	const bar = (notation: string, team: string[], label: string) => {
		const r = parseNotation(notation, lookup, 8, {}, {}, team.map(lookup));
		const w = r.windows.find((x) => x.kind === 'summon' && x.label === label) as {
			ticks?: number[];
			absorbedTicks?: { time: number; element: string }[];
		};
		return summonMarks({ ticks: w.ticks ?? [], absorbedTicks: w.absorbedTicks });
	};

	it("Kazuha's twins collapse into his five Anemo ticks; the bar turns Pyro at the first", () => {
		const m = bar('Bennett E > Kazuha E Q ~9s', ['Bennett', 'Kazuha'], 'Autumn Whirlwind');
		expect(m.absorbed?.element).toBe('pyro');
		expect(m.ticks).toHaveLength(5);
		expect(m.ticks.every((t) => t.absorbed)).toBe(true);
	});

	it("Venti's stream keeps its own cadence when it locks off the Stormeye's rhythm", () => {
		// Whether the stream shares the ticks' frames depends on the lock's phase:
		// on Bennett's Pyro it lands on them and merges, on Ganyu's Cryo it falls
		// between them and adds its own stubs.
		const m = bar('Ganyu E > Venti Q ~9s', ['Ganyu', 'Venti'], 'Stormeye');
		const own = bar('Venti Q ~9s', ['Venti'], 'Stormeye');
		expect(own.absorbed).toBeUndefined();
		expect(m.ticks.length).toBeGreaterThan(own.ticks.length);
		expect(m.ticks.filter((t) => !t.absorbed).every((t) => t.time < m.absorbed!.time)).toBe(true);
	});
});
