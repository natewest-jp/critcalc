/**
 * summonTicks.test.ts — the summon half of the elemental-application stream
 * (gauge round L5e-b).
 *
 * ⚓ WHY THIS EXISTS. L5e-b added 88 applications to the corpus — summon ticks
 * finally reaching the gauge — and the entire 1,509-test suite passed before and
 * after, because nothing asserted on summon-borne applications at all. A change
 * that large should not be able to land invisibly, and the oracle
 * (`audit-gcsim-reactions.mjs`) is not a gate: it needs a gcsim checkout and it
 * reports rather than fails.
 *
 * ⚠️ These assert on `ParsedRotation.applications` — a public field — rather
 * than on anything inside `$lib/sim`, so a refactor of the chain that preserves
 * behaviour keeps them green. Exact counts are used where the count IS the
 * mechanism (a gate that halves a series is only observable as a count), and the
 * derivation is written beside each one so a future reader can tell a real
 * regression from a data edit.
 *
 * ⚠️⚠️ TWO PATHS ARE DELIBERATELY UNTESTED because the corpus cannot reach them:
 * NO ticking summon declares `terminatesOn: 'swap'`, and NO ticking summon
 * carries `durationExtensions`. So the swap clamp and the live-uptime read in
 * `scheduleSummonTicks` have no observable case today. ⛔ Do not "cover" them
 * with a hand-built fixture summon — that would test the test's fixture, not the
 * corpus — but ⚠️ do add a case here the moment a character authors one.
 */

import { describe, it, expect } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byName = new Map(all.map((c) => [c.displayName, c]));
const lookup = (name: string): CharacterData | null => byName.get(name) ?? null;

const parse = (notation: string) => parseNotation(notation, lookup, 8, {}, {}, undefined);

/** Applications a given character put on the target, in seconds. */
const appsOf = (notation: string, characterId: string): number[] =>
	(parse(notation).applications ?? [])
		.filter((a) => a.characterId === characterId)
		.map((a) => +(a.time / 60).toFixed(2));

/** The summon windows a rotation opens, in seconds. */
const summonWindows = (notation: string) =>
	parse(notation)
		.windows.filter((w) => w.kind === 'summon')
		.map((w) => ({ label: w.label, start: w.start / 60, end: w.end / 60 }));

describe('summon ticks feed the gauge', () => {
	it("applies Guoba's ticks even though Xiangling's E applies nothing itself", () => {
		// ⚓ The cleanest case in the corpus: Xiangling's E authors `application: []`
		// — MEASURED to apply no Pyro at the cast — so every application here comes
		// from the summon and nothing else can account for it. Guoba spawns at
		// +13f and ticks every 1.667s after a 1.883s first delay, `icdGate: 'none'`.
		const apps = appsOf('Xiangling E', 'xiangling');
		expect(apps).toEqual([2.1, 3.77, 5.43, 7.1]);

		// …and they all land inside the summon's own window.
		const [guoba] = summonWindows('Xiangling E');
		expect(guoba.label).toBe('Guoba');
		for (const t of apps) {
			expect(t).toBeGreaterThanOrEqual(guoba.start);
			expect(t).toBeLessThan(guoba.end);
		}
	});

	it('stops ticking when the summon ends, not when the rotation does', () => {
		// A 600s wait after a 10s summon must not produce 600s of ticks — the chain
		// is bounded by the summon, and `clock.drain()` runs the tail without
		// stretching the ruler. ⚓ This is the runaway-chain guard: a self-
		// rescheduling task that failed to check liveness would hang the parse
		// rather than fail an assertion, so a HANG here IS the signal.
		//
		// ⚠️ What this actually covers, measured by breaking it: the chain is
		// bounded TWICE — once before scheduling the next tick and once when that
		// tick fires — and either bound alone still terminates it. So removing
		// just one is NOT caught here, and that is redundancy rather than a
		// coverage gap; removing BOTH hangs this test, which is the state worth
		// catching. ⛔ Don't "simplify" by deleting one on the strength of the
		// suite staying green: the fire-time check is what a shrinking window
		// needs, and the corpus simply cannot express one yet (see the header).
		const apps = appsOf('Xiangling Q ~600s', 'xiangling');
		const [pyronado] = summonWindows('Xiangling Q ~600s');
		expect(pyronado.label).toBe('Pyronado');
		expect(apps.length).toBeLessThan(12);
		expect(Math.max(...apps)).toBeLessThan(pyronado.end);
	});

	it('is time-ordered', () => {
		// ⚠️ `applications` is documented as being in time order and OFFER order is
		// not: the cast pipeline advances the clock before the emitters run, so a
		// cast's own application is scheduled into the past and clamped, and
		// `Band.TICK` sorts ahead of `Band.LAND` at the clamped frame. The
		// projection sorts; this pins that it keeps doing so.
		const apps = (parse('Bennett Q E > Xiangling E Q > Fischl E Q').applications ?? []).map(
			(a) => a.time
		);
		expect(apps.length).toBeGreaterThan(10);
		for (let i = 1; i < apps.length; i++) expect(apps[i]).toBeGreaterThanOrEqual(apps[i - 1]);
	});
});

describe('the authored ICD gate decides how much of a series applies', () => {
	it("applies EVERY tick when the series declares icdGate: 'none'", () => {
		// Pyronado: spawns +56f, `firstTickDelay: 0`, interval 1.217s over a 10s
		// life = 9 ticks, all of which apply because the series is authored
		// `icdGate: 'none'` — matching gcsim, which applies on all 9.
		// ⚠️ The 10th application is the burst's own hit (`application[]` frame 18);
		// its two later entries are eaten by the cast's own ICD counter.
		const apps = appsOf('Xiangling Q', 'xiangling');
		expect(apps.length).toBe(10);
		// The nine tick applications are evenly spaced at the authored interval.
		const ticks = apps.filter((t) => t >= 0.93);
		expect(ticks.length).toBe(9);
		for (let i = 1; i < ticks.length; i++) expect(ticks[i] - ticks[i - 1]).toBeCloseTo(1.22, 1);
	});

	it('applies only part of a series when the gate is absent (standard ICD)', () => {
		// Kuki's Grass Ring authors no gate, so it takes standard ICD. Eight ticks
		// at 1.5s fit its 12s life; standard ICD (3 hits / 2.5s) lets four through.
		// ⚓ THE CONTRAST IS THE POINT — same shape as Pyronado above, different
		// outcome, and the only difference is the authored gate.
		const apps = appsOf('Kuki Shinobu E', 'kuki_shinobu');
		const [ring] = summonWindows('Kuki Shinobu E');
		expect(ring.label).toBe('Grass Ring of Sanctification');
		// One cast application plus a THINNED tick series: fewer than the eight
		// ticks the lane draws, and more than none.
		const ticks = apps.filter((t) => t > ring.start);
		expect(ticks.length).toBeGreaterThan(0);
		expect(ticks.length).toBeLessThan(8);
		expect(ticks.length).toBe(4);
	});
});

describe('a recast truncates the running chain', () => {
	it('does not double Oz when the burst replaces the skill-spawned one', () => {
		// Fischl's E and Q both leave an Oz, and both declare
		// `terminatesOn: 'recast'` — so the burst REPLACES the skill's rather than
		// running beside it. ⚓ The chain stops via a generation stamp; nothing
		// cancels the scheduled task.
		const eOnly = appsOf('Fischl E', 'fischl');
		const eThenQ = appsOf('Fischl E Q', 'fischl');

		// Two windows, but the first is truncated to the second's spawn.
		const wins = summonWindows('Fischl E Q');
		expect(wins.length).toBe(2);
		expect(wins[0].end).toBeCloseTo(wins[1].start, 5);

		// ⚓ The load-bearing assertion: adding the burst adds its own cast
		// application, and NOT a second Oz's worth of ticks.
		const tickCount = (apps: number[], from: number) => apps.filter((t) => t > from).length;
		expect(tickCount(eThenQ, wins[1].start)).toBe(tickCount(eOnly, wins[0].start));
	});
});

// ── A tick series whose CADENCE is conditional (2026-08-18) ──────────────────
//
// ⚓ Two authors, two gate kinds. Aino's burst ticks at 0.7s instead of 1.5s
// under Moonsign: Ascendant Gleam (`teamFaction`, a TEAM fact); Ororon's ticks
// at 0.75s instead of 1s at C4 (`constellation`, a per-character fact). Both are
// authored as TWO series with mutually exclusive conditions, which is what makes
// the ICD group and the tick cap able to change with the rate.
describe('a conditional cadence — the faster-tick class', () => {
	const parseAt = (notation: string, cons: Record<string, number> = {}) =>
		parseNotation(notation, lookup, 8, cons, {}, undefined);
	const ticksOf = (notation: string, label: string, cons: Record<string, number> = {}) =>
		parseAt(notation, cons)
			.windows.filter((w) => w.kind === 'summon' && w.label === label)
			.flatMap((w) => (w as { ticks?: number[] }).ticks ?? []);
	const appsAt = (notation: string, characterId: string, cons: Record<string, number> = {}) =>
		parseAt(notation, cons)
			.applications.filter((a) => a.characterId === characterId)
			.map((a) => +(a.time / 60).toFixed(2));

	it('⚓ Aino ticks 10 times without a Moonsign partner and 21 times with one', () => {
		// The TEAM decides the cadence, and nothing else about the rotation changes.
		// ⚠️ Kaeya is not Moonsign; Nefer is. gcsim's `GetMoonsignLevel() >= 2` is
		// two members, and Aino counts as one of them.
		expect(ticksOf('Aino Q > Kaeya N5 N5 N5', 'Cool Your Jets Ducky')).toHaveLength(10);
		expect(ticksOf('Aino Q > Nefer N5 N5 N5', 'Cool Your Jets Ducky')).toHaveLength(21);
	});

	it('⚓⚓ the markers and the applications read ONE answer', () => {
		// ⚠️⚠️ THE BUG THIS EXISTS FOR. `summonTickSeries` drops only a DEFINITIVE
		// false, so a pair of gated series whose condition is UNRESOLVABLE does not
		// abstain — it fires BOTH. Measured before the fix: Aino drew 10 markers and
		// applied 12, from two cadences running at once. The counts below are only
		// consistent while both readers get the same condition context.
		const slow = appsAt('Aino Q > Kaeya N5 N5 N5', 'aino');
		const fast = appsAt('Aino Q > Nefer N5 N5 N5', 'aino');
		// 10 ticks on the standard window apply every third; 21 ticks at 42f apply
		// whenever the 108f timer has lapsed, i.e. every 126f.
		expect(slow).toEqual([2.22, 5.22, 8.22, 11.22, 14.22]);
		expect(fast).toEqual([2.22, 4.32, 6.42, 8.52, 10.62, 12.72, 14.82]);
	});

	it('⚓ the ICD GROUP travels with the rate, not just the interval', () => {
		// Ascendant Gleam swaps `ICDGroupDefault` (150f / every 3) for
		// `ICDGroupAinoBurstMoonHit` (108f / every 4). At 21 ticks under the OLD
		// group the applications would fall every 150f; they fall every 126f.
		const fast = appsAt('Aino Q > Nefer N5 N5 N5', 'aino');
		const gaps = fast.slice(1).map((t, i) => +(t - fast[i]).toFixed(2));
		expect(new Set(gaps)).toEqual(new Set([2.1]));
	});

	it('⚓ Ororon takes his faster cadence from a CONSTELLATION, not the team', () => {
		expect(ticksOf('Ororon Q > Kaeya N5 N5', 'Supersonic Oculus')).toHaveLength(9);
		expect(ticksOf('Ororon Q > Kaeya N5 N5', 'Supersonic Oculus', { ororon: 4 })).toHaveLength(12);
		// ⚠️ And his gate does NOT travel with it — the group is a property of the
		// attack rather than of the rate, so applications stay 3s apart either way.
		expect(appsAt('Ororon Q > Kaeya N5 N5', 'ororon', { ororon: 4 })).toEqual([
			0.6, 0.75, 3.75, 6.75
		]);
	});

	it('⚓ Aino’s C2 fires off a TEAMMATE’s hit, on the duck’s own lane', () => {
		// The coordinated attack: hosted on the burst's summon, so the summon's
		// liveness is the window and its markers land where the kit says the water
		// ball comes from. ⚠️ `source: 'others'` is the off-field half — her own
		// swings must not fire it.
		const base = ticksOf('Aino Q > Kaeya N5 N5 N5', 'Cool Your Jets Ducky').length;
		const withC2 = ticksOf('Aino Q > Kaeya N5 N5 N5', 'Cool Your Jets Ducky', { aino: 2 }).length;
		expect(withC2).toBeGreaterThan(base);
		// Aino alone, swinging herself: her own hits are excluded, so nothing extra.
		expect(ticksOf('Aino Q N5 N5 N5', 'Cool Your Jets Ducky', { aino: 2 })).toHaveLength(
			ticksOf('Aino Q N5 N5 N5', 'Cool Your Jets Ducky').length
		);
	});
});
