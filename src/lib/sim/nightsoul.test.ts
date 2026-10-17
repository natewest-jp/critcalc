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

describe('Mavuika — the bike Charged Attack (gcsim, measured with its CLI)', () => {
	const acts = (notation: string) =>
		parseNotation(notation, lookup, 8).events.flatMap((e) =>
			(e.kind === 'action' || e.kind === 'cast') && e.characterId === MAV
				? [{ label: e.label, time: e.time, duration: 'duration' in e ? e.duration : undefined }]
				: []
		);

	it('after her burst a spin hit lands +20 (windup skipped), then every 42f; F lands its finisher 45f later and N follows at 74', () => {
		const a = acts('Mavuika Q C3F N1');
		const c = a.filter((x) => x.label === 'C3');
		expect(c.map((x) => x.time)).toEqual([116, 136, 178]);
		expect(c.map((x) => x.duration)).toEqual([20, 42, 42]);
		const f = a.find((x) => x.label === 'F')!;
		expect(f.time).toBe(220);
		expect(a.find((x) => x.label === 'N1')!.time).toBe(220 + 74);
	});

	it('a Normal Attack after the spin forces the finisher; a dash after it cancels the finisher', () => {
		const forced = acts('Mavuika Q C3 N1').filter((x) => x.label === 'C3');
		expect(forced).toHaveLength(4); // three spin hits + the finisher
		const cancelled = acts('Mavuika Q C3 D').filter((x) => x.label === 'C3');
		expect(cancelled).toHaveLength(3);
	});

	it('CDC: the dash lands at the spin hit, is cut at 6f, and the next spin skips its windup', () => {
		const a = acts('Mavuika E Q CDC');
		const [c1, d, c2] = a.filter((x) => x.label === 'C' || x.label === 'D');
		expect(d.time).toBe(c1.time + 20);
		expect(d.duration).toBe(6);
		expect(c2.time).toBe(d.time + 6);
		expect(c2.duration).toBe(20);
	});

	it('Prydwen’s CDCDCCF DCDCCF DCDCC FDC reproduces gcsim’s trace (less its finisher hitlag)', () => {
		const a = acts('Mavuika E Q CDCDCCF DCDCCF DCDCC FDC');
		// gcsim (frame 1 = our 0): C 135, D 155, C 161, D 181, C 187, C 207, F 249.
		expect(a.slice(2, 9).map((x) => x.time)).toEqual([134, 154, 160, 180, 186, 206, 248]);
	});
});

describe('The dash cooldown (universal; gcsim ApplyDashCD)', () => {
	it('a third dash inside the 0.8s window waits out the 1.5s lockout', () => {
		const dashes = parseNotation('Mavuika hE D D D D', lookup, 8).events.flatMap((e) =>
			e.kind === 'action' && e.label === 'D' ? [e.time] : []
		);
		expect(dashes[2] - dashes[1]).toBe(90);
		expect(dashes[1] - dashes[0]).toBe(21);
	});

	it('it applies to everyone, not just Mavuika', () => {
		const dashes = parseNotation('Bennett D D D', lookup, 8).events.flatMap((e) =>
			e.kind === 'action' && e.label === 'D' ? [e.time] : []
		);
		expect(dashes).toEqual([0, 21, 111]);
	});
});

describe('Human timing and the cancel dash (Nate, in game, 2026-10-16)', () => {
	it('the C after a cancel dash is HELD before the dash — it pays no pad; the dash itself does', () => {
		const run = (pad: number | null) =>
			parseNotation(
				'Mavuika E Q CDC',
				lookup,
				8,
				undefined,
				undefined,
				undefined,
				pad === null ? null : { padFrames: pad, fullAnimations: false }
			).events.flatMap((e) =>
				e.kind === 'action' && e.characterId === MAV ? [{ label: e.label, time: e.time }] : []
			);
		const human = run(10);
		const [c1, d, c2] = human.filter((x) => x.label === 'C' || x.label === 'D');
		expect(c2.time - d.time).toBe(6); // no pad between the dash and the held C
		expect(d.time - c1.time).toBe(20 + 10); // the tap is a timed press
	});
});

describe('Mavuika — Phase 3 (2026-10-17)', () => {
	const debuffs = (r: ReturnType<typeof run>['r']) =>
		r.windows
			.filter(
				(w) => w.kind === 'buff' && w.characterId === MAV && (w as { debuff?: boolean }).debuff
			)
			.map((w) => [w.start, w.end]);

	it('C2 shreds for every Ring — the one a swap spawns off the bike too', () => {
		const { r, states } = run('Mavuika Q N4 > Bennett E', 2);
		const ring = states('searingRing');
		expect(ring.length).toBeGreaterThan(0);
		expect(debuffs(r)).toEqual(ring.map((w) => [w.start, w.end]));
	});

	it('C6 shreds for the whole ride as well as the Ring', () => {
		const { r, states } = run('Mavuika hE N3 > Bennett E', 6);
		const spans = [...states('flamestrider'), ...states('searingRing')]
			.map((w) => [w.start, w.end])
			.sort((a, b) => a[0] - b[0]);
		expect(debuffs(r)).toEqual(spans);
	});

	it("the Tap's pill ends where a burst ends its Ring", () => {
		const { r } = run('Mavuika E ~4s Q');
		const [tap, burst] = r.events.filter((e) => e.kind === 'cast');
		expect((tap as { uptime: number }).uptime).toBe(burst.time - tap.time);
	});

	it('the burst stance ends with the Crucible: 105f + 420f', () => {
		const { states } = run('Mavuika Q ~10s');
		const [stance] = states('inStance');
		expect(stance.end - stance.start).toBe(105 + 420);
	});
});
