/**
 * The simulated Nightsoul pool (`sim/nightsoul.ts`) — Mavuika.
 *
 * ⚓ The first five cases are Nate's in-game runs (C0, combat log, 2026-10-16;
 * `docs/mavuika-nightsoul-round-2026-10-16.md`): their numbers are the GAME's,
 * and gcsim's model reproduces them once each Ring hit's 3-point cost counts.
 * The sim swaps at the earliest frame where Nate swapped by hand, so the swap
 * instants differ; what is pinned is everything measured FROM them.
 */

import { describe, expect, it } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import mavuikaJson from '$lib/data/characters/mavuika.json';
import bennettJson from '$lib/data/characters/bennett.json';

const lookup = (n: string): CharacterData | null =>
	n === 'Mavuika'
		? (mavuikaJson as unknown as CharacterData)
		: n === 'Bennett'
			? (bennettJson as unknown as CharacterData)
			: null;
const MAV = 'mavuika';
const RING = 'Rings of Searing Radiance';

function run(notation: string, con = 0) {
	const r = parseNotation(notation, lookup, 8, { [MAV]: con });
	const states = (name: string) =>
		r.windows.filter((w) => w.kind === 'state' && w.characterId === MAV && w.name === name);
	type SummonWin = Extract<(typeof r.windows)[number], { kind: 'summon' }>;
	const rings = r.windows.filter((w): w is SummonWin => w.kind === 'summon' && w.label === RING);
	const swapOut = r.tracks.find((t) => t.characterId === MAV)!.activeEnd;
	return { r, states, rings, swapOut };
}

describe('Mavuika — the Nightsoul pool against the game (Nate, C0, 2026-10-16)', () => {
	it('bike only: 80 points at 9/s run out at 8.9s, and no Ring follows', () => {
		const { states, rings } = run('Mavuika hE ~10s');
		const [b] = states('nightsoulBlessing');
		expect(b.end - b.start).toBe(534); // 89 ticks of 0.9
		expect(rings).toHaveLength(0);
	});

	it('Ring only: 12.4s and six hits, one every 2s', () => {
		const { states, rings } = run('Mavuika E ~13s');
		const [b] = states('nightsoulBlessing');
		expect(b.end - b.start).toBe(744);
		expect(rings).toHaveLength(1);
		expect(rings[0].ticks?.length).toBe(6);
	});

	it('bike ~3s then swap: the Ring spawns AT the swap, lands four hits off-field, and the Blessing outlives the swap', () => {
		const { states, rings, swapOut } = run('Mavuika hE ~2.5s > Bennett E ~12s');
		expect(rings).toHaveLength(1);
		expect(rings[0].start).toBe(swapOut);
		expect(rings[0].ticks?.length).toBe(4); // the game: 4, and no 5th
		const [b] = states('nightsoulBlessing');
		expect(b.end).toBeGreaterThan(swapOut);
		expect(rings[0].end).toBe(b.end);
		// The bike ends at the swap; the Ring form takes over there.
		expect(states('flamestrider')[0].end).toBe(swapOut);
		expect(states('searingRing')[0].start).toBe(swapOut);
	});

	it('E → Q → swap: the burst adds 10 and pauses the drain until the swap — five Ring hits', () => {
		const { rings, swapOut } = run('Mavuika hE Q > Bennett E ~14s');
		expect(rings).toHaveLength(1);
		expect(rings[0].start).toBe(swapOut);
		expect(rings[0].ticks?.length).toBe(5); // the game: 5, and no 6th
	});

	it('the first Ring hit lands 2s after the swap', () => {
		const { rings, swapOut } = run('Mavuika hE ~2.5s > Bennett E ~12s');
		expect(rings[0].ticks![0]).toBe(swapOut + 120);
	});
});

describe('Mavuika — the pool’s rules (gcsim)', () => {
	it('a burst outside the Blessing enters it with 10 points at 87f, on the bike', () => {
		const { states, r } = run('Mavuika Q > Bennett E ~5s');
		const q = r.events.find((e) => e.kind === 'cast' && e.characterId === MAV)!;
		const [b] = states('nightsoulBlessing');
		expect(b.start).toBe(q.time + 87);
		expect(states('flamestrider')[0].start).toBe(q.time + 87);
	});

	it('her burst ends the Ring at its press', () => {
		const { rings, r } = run('Mavuika E Q > Bennett E ~14s');
		const q = r.events.find((e) => e.kind === 'cast' && e.label === 'Q')!;
		expect(rings[0].end).toBe(q.time);
	});

	it('a bike swing spends a point: swinging shortens the Blessing', () => {
		const idle = run('Mavuika hE ~10s').states('nightsoulBlessing')[0];
		const swung = run('Mavuika hE N5 N5 ~10s').states('nightsoulBlessing')[0];
		expect(swung.end - swung.start).toBeLessThan(idle.end - idle.start);
	});

	it('C1 raises the pool to 120: the bike lasts 13.4s', () => {
		const [b] = run('Mavuika hE ~15s', 1).states('nightsoulBlessing');
		expect(b.end - b.start).toBe(804); // 134 ticks of 0.9
	});

	it('Hold E outside the Blessing starts a fresh one on the bike', () => {
		const { states } = run('Mavuika E ~3s hE ~1s > Bennett E ~12s');
		const blessings = states('nightsoulBlessing');
		expect(blessings).toHaveLength(2);
		expect(states('flamestrider')[0].start).toBe(blessings[1].start);
	});
});
