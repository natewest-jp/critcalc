/**
 * src/lib/sim/jahodaRobots.test.ts
 *
 * ⚓ Jahoda's robots (Jahoda round, 2026-11-27): under Ascendant Gleam each robot
 * polls the aura on its own clock and starts its own stream at its lock
 * (`summonTick.ownLock`); A1 and C2 pick the team's most common elements
 * (`teamElementRank`). Every number is gcsim's (41bfe4915 jahoda/burst.go,
 * asc.go, cons.go), cited in the character's curator notes: robot r first polls
 * at 6 + 41r, fires 41f after its lock, then every 140f (126f under A1 Cryo)
 * while the burst's 790f last, on ICDGroupJahodaBurst (900f, every 4th, cap 5).
 */
import { describe, expect, it } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import { evalCondition } from './conditions';
import type { CharacterData } from '$lib/types/character';
import type { Condition, Element } from '$lib/types/ability';

const all = Object.values(import.meta.glob('../data/characters/*.json', { eager: true })).map(
	(m) => (m as { default: CharacterData }).default
);
const byName = new Map(all.map((c) => [c.displayName, c]));

type Robots = { start: number; end: number; marks: [number, string][]; applied: number[] };

function robots(
	notation: string,
	team: string[],
	cons: Record<string, number> = {},
	swap: Record<string, CharacterData> = {}
): Robots | undefined {
	const lookup = (n: string) => swap[n] ?? byName.get(n) ?? null;
	const r = parseNotation(notation, lookup, 8, cons, {}, team.map(lookup));
	const w = r.windows.find((x) => x.kind === 'summon' && x.characterId === 'jahoda') as
		| { start: number; end: number; absorbedTicks?: { time: number; element: string }[] }
		| undefined;
	if (!w) return undefined;
	return {
		start: w.start,
		end: w.end,
		marks: (w.absorbedTicks ?? []).map((m) => [m.time - w.start, m.element]),
		applied: r.applications
			.filter((a) => a.characterId === 'jahoda' && a.element !== 'anemo')
			.map((a) => a.time - w.start)
	};
}

/** One robot's landings from its lock at `lock` (cast-relative), every `gap`. */
const stream = (lock: number, gap: number): number[] => {
	const out: number[] = [];
	for (let t = lock + 41; t < 790; t += gap) out.push(t);
	return out;
};
const merged = (...s: number[][]) => s.flat().sort((a, b) => a - b);

describe("Jahoda's robots", () => {
	it('deal nothing without Ascendant Gleam', () => {
		const r = robots('Bennett E > Jahoda Q ~13s', ['Bennett', 'Jahoda', 'Kaeya', 'Xingqiu']);
		expect(r?.marks).toEqual([]);
	});

	it('two robots lock on their own clocks; every 4th hit applies, five at most', () => {
		// Aino and Columbina make Gleam and add Hydro; Bennett's Pyro ties it and
		// wins on priority, so A1 is Pyro: two robots, 140f.
		const r = robots('Bennett E > Jahoda Q ~13s', ['Bennett', 'Jahoda', 'Aino', 'Columbina'])!;
		expect(r.end - r.start).toBe(790);
		const times = merged(stream(6, 140), stream(47, 140));
		expect(r.marks).toEqual(times.map((t) => [t, 'pyro']));
		expect(r.applied).toEqual([times[0], times[4], times[8]]);
	});

	it('A1 Electro adds a third robot, and the shared window caps at five', () => {
		const r = robots('Bennett E > Jahoda Q ~13s', ['Bennett', 'Jahoda', 'Flins', 'Ineffa'])!;
		const times = merged(stream(6, 140), stream(47, 140), stream(88, 140));
		expect(r.marks.map(([t]) => t)).toEqual(times);
		expect(r.applied).toEqual([0, 4, 8, 12, 16].map((i) => times[i]));
	});

	it('A1 Cryo shortens the interval to 126f', () => {
		const r = robots('Kaeya E > Jahoda Q ~13s', ['Jahoda', 'Kaeya', 'Rosaria', 'Lauma'])!;
		expect(r.marks).toEqual(merged(stream(6, 126), stream(47, 126)).map((t) => [t, 'cryo']));
	});

	it("C2 adds the runner-up's branch: Electro first, Cryo second", () => {
		const team = ['Jahoda', 'Kaeya', 'Fischl', 'Flins'];
		const c0 = robots('Kaeya E > Jahoda Q ~13s', team)!;
		expect(c0.marks.map(([t]) => t)).toEqual(
			merged(stream(6, 140), stream(47, 140), stream(88, 140))
		);
		const c2 = robots('Kaeya E > Jahoda Q ~13s', team, { jahoda: 2 })!;
		expect(c2.marks.map(([t]) => t)).toEqual(
			merged(stream(6, 126), stream(47, 126), stream(88, 126))
		);
	});

	it('robots on two elements keep two ICD windows (`icdPerElement`)', () => {
		// Synthetic: robot 2 is narrowed to Electro, so on an Electro-Charged
		// target robot 1 takes Hydro and robot 2 Electro, as two robots do in game
		// when the aura changes between their locks. Each one's first hit applies.
		const real = byName.get('Jahoda')!;
		const twin = structuredClone(real);
		const q = twin.abilities.find((a) => a.abilityType === 'burst')!;
		for (const e of q.summons![0].effects!) {
			if (e.trigger.type === 'summonTick' && e.trigger.ownLock?.from === 47)
				e.trigger.ownLock.order = ['electro'];
		}
		const r = robots(
			'Fischl E > Xingqiu E > Jahoda Q ~13s',
			['Fischl', 'Xingqiu', 'Jahoda', 'Lauma'],
			{},
			{ Jahoda: twin }
		)!;
		const first = (el: string) => r.marks.find(([, e]) => e === el)![0];
		expect(r.applied).toContain(first('hydro'));
		expect(r.applied).toContain(first('electro'));
	});
});

describe('teamElementRank', () => {
	const ORDER: Element[] = ['pyro', 'hydro', 'electro', 'cryo'];
	const ask = (element: Element, rank: 1 | 2, counts: [Element, number][]) =>
		evalCondition(
			{ type: 'teamElementRank', order: ORDER, element, rank } as Condition,
			4,
			new Set(),
			0,
			undefined,
			undefined,
			{ teamElementCounts: new Map(counts) }
		);

	it('picks the most common, ties going to the earlier in order', () => {
		expect(
			ask('pyro', 1, [
				['pyro', 1],
				['cryo', 1]
			])
		).toBe(true);
		expect(
			ask('cryo', 1, [
				['pyro', 1],
				['cryo', 2]
			])
		).toBe(true);
		expect(
			ask('cryo', 2, [
				['pyro', 1],
				['cryo', 1]
			])
		).toBe(true);
	});

	it('an element nobody carries ranks nowhere; no team scope is unknown', () => {
		expect(ask('hydro', 2, [['pyro', 3]])).toBe(false);
		expect(ask('pyro', 1, [['dendro', 3]])).toBe(false);
		expect(
			evalCondition(
				{ type: 'teamElementRank', order: ORDER, element: 'pyro', rank: 1 },
				4,
				new Set(),
				0
			)
		).toBeNull();
	});
});
