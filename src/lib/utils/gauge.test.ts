import { describe, it, expect } from 'vitest';
import {
	createGauge,
	simulateGauge,
	gaugesAt,
	auraDecayRate,
	auraDuration,
	type Application,
	type SimEvent
} from './gauge';

const apps = (...list: [number, Application['element'], number][]): Application[] =>
	list.map(([time, element, gauge]) => ({ time, element, gauge }));

const reactions = (sim: ReturnType<typeof simulateGauge>) =>
	sim.events.filter((e): e is Extract<SimEvent, { kind: 'reaction' }> => e.kind === 'reaction');

const applies = (sim: ReturnType<typeof simulateGauge>) =>
	sim.events.filter((e): e is Extract<SimEvent, { kind: 'apply' }> => e.kind === 'apply');

const expires = (sim: ReturnType<typeof simulateGauge>) =>
	sim.events.filter((e): e is Extract<SimEvent, { kind: 'drained' }> => e.kind === 'drained');

const expireOf = (sim: ReturnType<typeof simulateGauge>, mod: string) =>
	expires(sim).find((e) => e.mod === mod);

describe('decay basics', () => {
	it('matches the KQM decay table (s per unit = 1 / rate ÷ tax… i.e. taxed aura lifetime)', () => {
		// 1U → 11.875 s/U, 2U → 7.5, 4U → 5.3125 (taxed aura ÷ rate = duration)
		expect((0.8 * 1) / auraDecayRate(1)).toBeCloseTo(9.5, 6); // 0.8U × 11.875
		expect((0.8 * 2) / auraDecayRate(2)).toBeCloseTo(12, 6);
		expect((0.8 * 4) / auraDecayRate(4)).toBeCloseTo(17, 6);
		expect(auraDuration(2)).toBe(12);
	});

	it('applies the 0.8× aura tax and decays out on schedule', () => {
		const sim = simulateGauge(apps([0, 'pyro', 2]));
		const [a] = applies(sim);
		expect(a.attach).toBe('new');
		expect(a.auraAfter).toBeCloseTo(1.6, 6);
		expect(expireOf(sim, 'pyro')!.time).toBeCloseTo(12, 1);
	});

	it('tops up on re-application but keeps the original decay rate (Fischl → Beidou)', () => {
		const sim = simulateGauge(apps([0, 'electro', 1], [3, 'electro', 4]));
		const second = applies(sim)[1];
		expect(second.attach).toBe('topUp');
		expect(second.auraAfter).toBeCloseTo(3.2, 6);
		// 3.2U at the 1U rate (11.875 s/U) → 38s after the top-up
		expect(expireOf(sim, 'electro')!.time).toBeCloseTo(41, 1);
	});

	it('pyro ignores a weaker re-application but refreshes rate on a stronger one', () => {
		const weak = simulateGauge(apps([0, 'pyro', 4], [1, 'pyro', 1]));
		const weakSecond = applies(weak)[1];
		expect(weakSecond.attach).toBe('tooWeak');
		expect(weakSecond.auraAfter).toBeCloseTo(3.2 - auraDecayRate(4), 3);
		expect(expireOf(weak, 'pyro')!.time).toBeCloseTo(17, 1);

		const strong = simulateGauge(apps([0, 'pyro', 1], [2, 'pyro', 2]));
		const strongSecond = applies(strong)[1];
		expect(strongSecond.attach).toBe('pyroRefresh');
		expect(strongSecond.auraAfter).toBeCloseTo(1.6, 6);
		expect(expireOf(strong, 'pyro')!.time).toBeCloseTo(14, 1);
	});

	it('anemo and geo never attach as an aura', () => {
		const sim = simulateGauge(apps([0, 'anemo', 2], [1, 'geo', 2]));
		expect(sim.series).toHaveLength(0);
		expect(reactions(sim)).toHaveLength(0);
	});
});

describe('amplifying consumption', () => {
	it('forward vaporize consumes 2× and spends the trigger for half the consumed', () => {
		const sim = simulateGauge(apps([0, 'pyro', 2], [2.5, 'hydro', 1]));
		const [vape] = reactions(sim);
		expect(vape.reaction).toBe('vaporize');
		// pyro at 2.5s: 1.6 − 2.5 × (1.6/12) = 1.2667, fully eaten by the ×2 trigger
		expect(vape.consumed[0].amount).toBeCloseTo(1.2667, 3);
		expect(vape.spent).toBeCloseTo(0.6333, 3);
		expect(applies(sim)[1].attach).toBe('none'); // trigger reacted → no hydro aura
		expect(sim.series.some((s) => s.key === 'hydro')).toBe(false);
	});

	it('reverse melt consumes 0.5× and (gcsim quirk) does not spend the cryo trigger', () => {
		const sim = simulateGauge(apps([0, 'pyro', 4], [2, 'cryo', 1]));
		const [melt] = reactions(sim);
		expect(melt.reaction).toBe('reverseMelt');
		expect(melt.consumed[0].amount).toBeCloseTo(0.5, 6);
		// pyro at 2s = 3.2 − 2 × (3.2/17) = 2.8235, minus 0.5
		const at2 = gaugesAt(sim.series, 2.01).pyro!;
		expect(at2).toBeCloseTo(2.3235 - 0.01 * auraDecayRate(4), 2);
	});
});

describe('transformative consumption', () => {
	it('superconduct consumes 1:1 (KQM Kaeya→Fischl example: 1.6U − 1U = 0.6U)', () => {
		const sim = simulateGauge(apps([0, 'cryo', 2], [0, 'electro', 1]));
		const [sc] = reactions(sim);
		expect(sc.reaction).toBe('superconduct');
		expect(sc.consumed[0]).toEqual({ mod: 'cryo', amount: 1 });
		expect(gaugesAt(sim.series, 0.01).cryo).toBeCloseTo(0.6, 2);
	});

	it('a trigger bigger than the aura wipes it without going negative', () => {
		const sim = simulateGauge(apps([0, 'electro', 1], [0, 'cryo', 2]));
		const [sc] = reactions(sim);
		expect(sc.consumed[0].amount).toBeCloseTo(0.8, 6);
		expect(applies(sim)[0].auraAfter).toBeCloseTo(0.8, 6);
		// leftover cryo trigger does not attach (it reacted)
		expect(sim.series.some((s) => s.key === 'cryo')).toBe(false);
	});

	it('swirl consumes 0.5× and cascades into a double swirl on Electro-Charged', () => {
		const sim = simulateGauge(apps([0, 'hydro', 2], [1, 'electro', 1], [2, 'anemo', 2]));
		const swirls = reactions(sim).filter((r) => r.reaction === 'swirl');
		expect(swirls).toHaveLength(2);
		expect(swirls[0].of).toBe('electro');
		expect(swirls[1].of).toBe('hydro');
	});

	it('crystallize honors its 1s cooldown (no consumption while blocked)', () => {
		const sim = simulateGauge(
			apps([0, 'electro', 2], [1, 'geo', 1], [1.5, 'geo', 1], [2.5, 'geo', 1])
		);
		const crys = reactions(sim).filter((r) => r.reaction === 'crystallize');
		const blocked = reactions(sim).filter((r) => r.reaction === 'crystallizeBlocked');
		expect(crys).toHaveLength(2);
		expect(blocked).toHaveLength(1);
		// 1.6 − 2.5s decay (×1.6/12) − two 0.5U crystallize bites
		expect(gaugesAt(sim.series, 2.51).electro).toBeCloseTo(0.2667, 2);
	});
});

describe('electro-charged', () => {
	it('coexists, ticks ~1s apart draining 0.4U from both, and stops when one side empties', () => {
		const sim = simulateGauge(apps([0, 'hydro', 2], [1, 'electro', 2]));
		expect(applies(sim)[1].attach).toBe('new');
		expect(applies(sim)[1].auraAfter).toBeCloseTo(1.6, 6);
		const ticks = sim.events.filter((e) => e.kind === 'ecTick');
		expect(ticks).toHaveLength(3);
		expect(expireOf(sim, 'hydro')!.time).toBeCloseTo(3.27, 1);
		// electro survives the last tick with ~0.1U and decays out shortly after
		expect(expireOf(sim, 'electro')!.time).toBeCloseTo(4.0, 1);
	});

	// 🐛 REGRESSION GUARD — `ecActive` was a boolean, so an EC that lapsed and
	// re-formed before a pending tick fired left BOTH chains alive, each draining
	// 0.4U. The effective rate doubled and compounded with every re-lapse. gcsim
	// stamps the chain (`ecTickSrc`) for exactly this reason.
	//
	// Reproduction from the L1 parity audit: this used to yield 7 ticks at
	// 0.267/1.267/2.067/2.267/3.067/3.267/4.067 — note the 0.2s pairs, which one
	// chain can never produce.
	it('an EC that lapses and re-forms does not leave two tick chains running', () => {
		const sim = simulateGauge(apps([0, 'hydro', 1], [0, 'electro', 4], [1.8, 'hydro', 4]));
		const ticks = sim.events.filter((e) => e.kind === 'ecTick');
		const gaps = ticks.slice(1).map((t, i) => t.time - ticks[i].time);
		// ⚠️ Not "every gap ≈ 1s": a legitimate re-form restarts the cadence, so
		// one gap is legitimately ~0.8s. The BUG's signature is a ~0.2s pair,
		// which a single chain can never produce.
		expect(Math.min(...gaps)).toBeGreaterThan(0.5);
	});
});

// ⚓ gcsim `pkg/reactable/lunarcharged.go` / `lunarcrystallize.go` (2026-10-19).
// A Lunar enabler changes the GAUGE, not just the reaction's name — before this
// the Planner drained a Lunar-Charged aura on EC's 1s clock and gave
// Lunar-Crystallize Crystallize's cooldown.
describe('lunar conversions (a team with an enabler)', () => {
	const tickFrames = (g: ReturnType<typeof createGauge>) =>
		g
			.allEvents()
			.filter((e) => e.kind === 'ecTick')
			.map((e) => Math.round(e.time * 60));
	const crystallizes = (g: ReturnType<typeof createGauge>) =>
		g
			.allEvents()
			.flatMap((e) =>
				e.kind === 'reaction' &&
				(e.reaction === 'crystallize' || e.reaction === 'crystallizeBlocked')
					? [`${e.reaction}:${e.of}`]
					: []
			);

	it('Lunar-Charged drains every 2s from 9 frames after the trigger, where EC drains every 1s', () => {
		const lc = createGauge({ lunarCharged: true });
		lc.apply('hydro', 8, 0);
		lc.apply('electro', 8, 1);
		lc.advanceTo(300);
		expect(tickFrames(lc)).toEqual([9, 129, 249]);

		const ec = createGauge();
		ec.apply('hydro', 8, 0);
		ec.apply('electro', 8, 1);
		ec.advanceTo(300);
		expect(tickFrames(ec)).toEqual([16, 76, 136, 196, 256]);
	});

	it('the cloud ends 5.5s after the last trigger, though both auras remain', () => {
		const g = createGauge({ lunarCharged: true });
		g.apply('hydro', 8, 0);
		g.apply('electro', 8, 1);
		g.advanceTo(400);
		expect(g.gauges().hydro).toBeGreaterThan(0);
		expect(g.gauges().electro).toBeGreaterThan(0);
		g.advanceTo(1200);
		expect(tickFrames(g)).toEqual([9, 129, 249]);
	});

	it('a new trigger extends the cloud, and the 2s gap carries on (it is the enemy’s)', () => {
		const g = createGauge({ lunarCharged: true });
		g.apply('hydro', 8, 0);
		g.apply('electro', 8, 1);
		g.advanceTo(300);
		g.apply('hydro', 1, 2); // Hydro on a live Electro aura: a trigger
		g.advanceTo(1200);
		expect(tickFrames(g)).toEqual([9, 129, 249, 369, 489, 609]);
	});

	it('Lunar-Crystallize ignores the 1s cooldown; a plain Crystallize is blocked by it', () => {
		const run = (lunarCrystallize: boolean) => {
			const g = createGauge({ lunarCrystallize });
			g.apply('hydro', 4, 0);
			g.advanceTo(10);
			g.apply('geo', 1, 1);
			g.advanceTo(30);
			g.apply('geo', 1, 2);
			return crystallizes(g);
		};
		expect(run(true)).toEqual(['crystallize:hydro', 'crystallize:hydro']);
		expect(run(false)).toEqual(['crystallize:hydro', 'crystallizeBlocked:hydro']);
	});

	it('on an EC aura one Geo hit crystallizes Electro AND lunar-crystallizes Hydro', () => {
		const run = (lunarCrystallize: boolean) => {
			const g = createGauge({ lunarCrystallize });
			g.apply('hydro', 4, 0);
			g.apply('electro', 4, 1);
			g.apply('geo', 8, 2);
			return crystallizes(g);
		};
		expect(run(true)).toEqual(['crystallize:electro', 'crystallize:hydro']);
		expect(run(false)).toEqual(['crystallize:electro']);
	});
});

describe('simulation bounds', () => {
	// ⚠️ Applications past the cap used to vanish with no trace, and a live aura
	// at the cap was truncated with no signal — both silent, which is how a
	// caller comes to trust a wrong answer.
	it('reports dropped applications rather than discarding them silently', () => {
		const sim = simulateGauge(apps([0, 'pyro', 1], [80, 'hydro', 2]), { maxSeconds: 75 });
		expect(sim.droppedApplications).toBe(1);
	});

	it('raising maxSeconds admits an application the default would drop', () => {
		const sim = simulateGauge(apps([0, 'pyro', 1], [80, 'hydro', 2]), { maxSeconds: 120 });
		expect(sim.droppedApplications).toBe(0);
		expect(applies(sim)).toHaveLength(2);
	});

	it('flags truncation when gauge is still alive at the cap', () => {
		const sim = simulateGauge(apps([0, 'electro', 4]), { maxSeconds: 2 });
		expect(sim.truncated).toBe(true);
	});

	it('does not flag truncation for a run that finishes naturally', () => {
		const sim = simulateGauge(apps([0, 'pyro', 1]));
		expect(sim.truncated).toBe(false);
		expect(sim.droppedApplications).toBe(0);
	});
});

describe('freeze', () => {
	it('forms 2×min(aura, trigger) frozen, leaves the hydro remainder coexisting', () => {
		const sim = simulateGauge(apps([0, 'hydro', 2], [1.5, 'cryo', 1]));
		const [freeze] = reactions(sim);
		expect(freeze.reaction).toBe('freeze');
		expect(freeze.consumed[0].amount).toBeCloseTo(1, 6);
		expect(gaugesAt(sim.series, 1.51).frozen).toBeCloseTo(2, 1);
		expect(gaugesAt(sim.series, 1.51).hydro).toBeCloseTo(0.4, 2);
		// KQM: freeze duration = 2√(5×2+4) − 4 ≈ 3.48s
		expect(expireOf(sim, 'frozen')!.time).toBeCloseTo(1.5 + 3.48, 1);
		// leftover 0.4U hydro decays at the 2U rate → gone at 1.5 + 3.0
		expect(expireOf(sim, 'hydro')!.time).toBeCloseTo(4.5, 1);
	});
});

describe('catalyze family', () => {
	it('quicken consumes 1:1, lives 5×gauge+6s, and a weaker re-quicken is a no-op', () => {
		const sim = simulateGauge(apps([0, 'dendro', 2], [1.5, 'electro', 1], [3, 'electro', 1]));
		const quickens = reactions(sim).filter((r) => r.reaction === 'quicken');
		const aggravates = reactions(sim).filter((r) => r.reaction === 'aggravate');
		expect(quickens).toHaveLength(2);
		expect(aggravates).toHaveLength(1); // second electro aggravates without consuming quicken
		expect(quickens[0].consumed[0].amount).toBeCloseTo(1, 6);
		// quicken 1U → 11s lifetime from 1.5s; the weaker 0.2U re-quicken at 3s is ignored
		expect(gaugesAt(sim.series, 3.01).quicken).toBeCloseTo(1 - 1.5 / 11, 2);
		expect(expireOf(sim, 'quicken')!.time).toBeCloseTo(12.5, 1);
		// second electro drained the last 0.2U of dendro
		expect(quickens[1].consumed[0].amount).toBeCloseTo(0.2, 2);
	});

	it('bloom consumes dendro at 0.5× the hydro trigger and spawns a core', () => {
		const sim = simulateGauge(apps([0, 'dendro', 2], [2, 'hydro', 2]));
		const [bloom] = reactions(sim);
		expect(bloom.reaction).toBe('bloom');
		expect(bloom.consumed[0].amount).toBeCloseTo(1, 6); // 2U hydro × 0.5
		expect(bloom.spent).toBeCloseTo(2, 6); // full trigger spent (hydro is weak, 2:1)
		expect(sim.events.some((e) => e.kind === 'core')).toBe(true);
		expect(gaugesAt(sim.series, 2.01).dendro).toBeCloseTo(0.333, 2);
		expect(sim.series.some((s) => s.key === 'hydro')).toBe(false);
	});
});

describe('dendro cores — hyperbloom + burgeon (L5b)', () => {
	// A core is a thing in the world, not an aura. Until L5b the module spawned a
	// `core` event and forgot it, so the two reactions it exists for could not
	// happen at all — recorded as a knowing gap at L1.
	const bloomThen = (trigger: 'electro' | 'pyro', at: number): ReturnType<typeof simulateGauge> =>
		simulateGauge(apps([0, 'dendro', 2], [2, 'hydro', 2], [at, trigger, 1]));

	it('an Electro trigger on a live core hyperblooms; a Pyro one burgeons', () => {
		expect(reactions(bloomThen('electro', 4)).map((r) => r.reaction)).toContain('hyperbloom');
		expect(reactions(bloomThen('pyro', 4)).map((r) => r.reaction)).toContain('burgeon');
	});

	it('costs the trigger nothing — the core is a gadget, not the enemy’s aura', () => {
		// the Electro still meets the surviving dendro afterwards and quickens it
		const rx = reactions(bloomThen('electro', 4)).map((r) => r.reaction);
		expect(rx).toEqual(['bloom', 'hyperbloom', 'quicken']);
	});

	it('is not there yet inside the spawn delay, and is gone after its lifetime', () => {
		// spawn delay is 30f: 2.4s is 24f after the bloom
		expect(reactions(bloomThen('electro', 2.4)).map((r) => r.reaction)).not.toContain('hyperbloom');
		// spawned at 2.5s, 6s lifetime → gone by 8.6s
		expect(reactions(bloomThen('electro', 8.6)).map((r) => r.reaction)).not.toContain('hyperbloom');
		expect(reactions(bloomThen('electro', 8.4)).map((r) => r.reaction)).toContain('hyperbloom');
	});

	it('consumes one core per trigger, oldest first', () => {
		const sim = simulateGauge(
			apps(
				[0, 'dendro', 2],
				[1, 'hydro', 1],
				[2, 'hydro', 1],
				[4, 'electro', 1],
				[5, 'electro', 1],
				[6, 'electro', 1]
			)
		);
		expect(reactions(sim).filter((r) => r.reaction === 'hyperbloom')).toHaveLength(2);
	});

	// ⚓ 2026-10-20 — a core is a target of its own, so the enemy's ICD never
	// reaches it (gcsim copies the attack per target; `dendrocore.go` reads only
	// the nominal Durability).
	it('takes a hit the enemy’s ICD refused, through contact(), and leaves the aura alone', () => {
		const g = createGauge();
		g.apply('dendro', 2, 0);
		g.advanceTo(120);
		g.apply('hydro', 1, 1); // Bloom at 2s → a core on the field at 2.5s
		g.advanceTo(240);
		const before = { ...g.gauges() };
		g.takeEvents();
		expect(g.contact('electro', 2)).toBe(true);
		const rx = g.takeEvents().filter((e) => e.kind === 'reaction');
		expect(rx).toMatchObject([{ reaction: 'hyperbloom', appIndex: 2 }]);
		expect(g.gauges()).toEqual(before);
		// spent; and only Pyro or Electro ever meets a core
		expect(g.contact('electro', 3)).toBe(false);
		expect(g.contact('hydro', 4)).toBe(false);
	});

	it('is burgeoned by a Burning tick, as the burn’s owner', () => {
		// Two Blooms (cores at 1.5s and 1.7s), dendro left over; the Pyro at 2s
		// burgeons the oldest itself and lights Burning, whose first tick takes
		// the other.
		const sim = simulateGauge(
			apps([0, 'dendro', 4], [1, 'hydro', 0.5], [1.2, 'hydro', 0.5], [2, 'pyro', 1])
		);
		const burgeons = reactions(sim).filter((r) => r.reaction === 'burgeon');
		expect(burgeons).toHaveLength(2);
		expect(burgeons[0]).toMatchObject({ appIndex: 3, time: 2 });
		expect(burgeons[0].internal).toBeUndefined();
		expect(burgeons[1]).toMatchObject({ appIndex: 3, internal: true, time: 2.25 });
	});

	it('names the next Burning tick only while it could meet a core', () => {
		const g = createGauge();
		g.apply('dendro', 4, 0);
		g.apply('hydro', 0.5, 1); // a Bloom; its core is still spawning…
		expect(g.nextCoreContactFrame()).toBeNull(); // …but nothing is burning
		g.apply('pyro', 1, 2); // Burning: its first tick is 15 frames out
		expect(g.nextCoreContactFrame()).toBe(15);
		g.advanceTo(46); // the core lands at 30 and the tick at 30 takes it
		expect(g.takeEvents().filter((e) => e.kind === 'reaction' && e.internal)).toMatchObject([
			{ reaction: 'burgeon', appIndex: 2, time: 0.5 }
		]);
		expect(g.nextCoreContactFrame()).toBeNull();
	});
});

describe('burning', () => {
	it('attaches a fixed 2U burning aura + fuel draining at 0.4 U/s', () => {
		const sim = simulateGauge(apps([0, 'dendro', 2], [2, 'pyro', 1]));
		expect(reactions(sim).some((r) => r.reaction === 'burning')).toBe(true);
		// dendro at 2s = 1.3333 becomes the fuel
		expect(gaugesAt(sim.series, 2.01).burningFuel).toBeCloseTo(1.333, 2);
		expect(gaugesAt(sim.series, 2.01).burning).toBeCloseTo(2, 6);
		// fuel dies at 2 + 1.3333/0.4 ≈ 5.33s and sweeps burning with it
		const end = sim.events.find((e) => e.kind === 'burningEnd')!;
		expect(end.time).toBeCloseTo(5.33, 1);
		expect(end.kind === 'burningEnd' && end.swept.includes('burning')).toBe(true);
		// The leftover pyro drains 9.5s after the LAST burning re-application
		// (t≈4.25), not after the last damage TICK — see the ICD test below.
		expect(expireOf(sim, 'pyro')!.time).toBeCloseTo(13.75, 1);
	});

	// 🐛 REGRESSION GUARD — burning used to re-apply 1U Pyro on EVERY 0.25s
	// damage tick instead of once per ~2s ICD window, eight times too often. The
	// symptom was a Pyro aura PINNED at 0.8U for the whole burn; each phantom
	// application also ran the full reaction chain, so a burning target carrying
	// Electro overloaded ~4×/s. See BURNING_ICD in gauge.ts.
	it('re-applies pyro on the burning ICD, not on every damage tick', () => {
		const sim = simulateGauge(apps([0, 'dendro', 4], [2, 'pyro', 1]));

		// Damage ticks still run at 4/s…
		const ticks = sim.events.filter((e) => e.kind === 'burningTick');
		const tickGaps = ticks.slice(1).map((t, i) => t.time - ticks[i].time);
		expect(Math.min(...tickGaps)).toBeCloseTo(0.25, 2);

		// …but the aura must visibly DECAY between applications. Under the bug it
		// never fell, because something topped it back to 0.8 four times a second.
		const atApply = gaugesAt(sim.series, 2.3).pyro!;
		const beforeNext = gaugesAt(sim.series, 4.2).pyro!;
		expect(beforeNext).toBeLessThan(atApply - 0.1);

		// …and then be topped back up on the next ICD window (~2s later).
		expect(gaugesAt(sim.series, 4.4).pyro!).toBeGreaterThan(beforeNext);
	});

	// 🐛 REGRESSION GUARD — a boolean `burningActive` let a re-ignition leave the
	// previous tick chain alive, so two chains ticked at once. Generation stamps
	// fix it (gcsim uses `burningTickSrc` for the same reason).
	it('a re-ignition does not leave a second tick chain running', () => {
		const sim = simulateGauge(
			apps([0, 'dendro', 1], [1, 'pyro', 1], [6, 'dendro', 2], [6.5, 'pyro', 2])
		);
		const ticks = sim.events.filter((e) => e.kind === 'burningTick');
		const gaps = ticks.slice(1).map((t, i) => t.time - ticks[i].time);
		// Two concurrent chains interleave and produce sub-tick gaps.
		expect(gaps.every((g) => g > 0.2)).toBe(true);
	});

	it('hydro extinguishes burning (consuming pyro AND the 2U burning aura) then blooms the leftover', () => {
		const sim = simulateGauge(apps([0, 'dendro', 2], [1, 'pyro', 1], [3, 'hydro', 2]));
		const rx = reactions(sim);
		const vape = rx.find((r) => r.reaction === 'vaporize')!;
		const burningBite = vape.consumed.find((c) => c.mod === 'burning')!;
		expect(burningBite.amount).toBeCloseTo(2, 6);
		expect(vape.spent).toBeCloseTo(1, 6);
		// leftover 1U hydro blooms off the surviving dendro (0.6667U at 3s)
		const bloom = rx.find((r) => r.reaction === 'bloom')!;
		expect(bloom.consumed[0].amount).toBeCloseTo(0.5, 3);
		expect(sim.events.some((e) => e.kind === 'core')).toBe(true);
		expect(gaugesAt(sim.series, 3.01).dendro).toBeCloseTo(0.167, 2);
		// fuel swept the moment burning was consumed
		const end = sim.events.find((e) => e.kind === 'burningEnd')!;
		expect(end.time).toBeCloseTo(3, 2);
	});
});

describe('multi-reaction trigger flow', () => {
	it('pyro on electro-charged overloads AND vaporizes with one hit', () => {
		const sim = simulateGauge(apps([0, 'hydro', 2], [0.5, 'electro', 2], [1.5, 'pyro', 2]));
		const rx = reactions(sim).filter((r) => r.appIndex === 2);
		const kinds = rx.map((r) => r.reaction);
		expect(kinds).toContain('overload');
		expect(kinds).toContain('reverseVaporize');
		const overload = rx.find((r) => r.reaction === 'overload')!;
		const vape = rx.find((r) => r.reaction === 'reverseVaporize')!;
		// overload eats all remaining electro 1:1, leftover reverse-vapes at 0.5×
		expect(overload.consumed[0].amount).toBeCloseTo(1.0667, 3);
		expect(vape.consumed[0].amount).toBeCloseTo(0.4667, 3);
		// electro line dies at the hit; hydro survives with ~0.53U
		expect(gaugesAt(sim.series, 1.51).electro).toBeUndefined();
		expect(gaugesAt(sim.series, 1.51).hydro).toBeCloseTo(0.533, 2);
	});
});

describe('the live gauge (streaming shape — L5a)', () => {
	/** Drive `createGauge` by hand the way the rotation sim does: jump the clock
	 *  to each application's frame, land it, and never walk a frame in between. */
	const stream = (list: Application[]) => {
		const g = createGauge({ sampling: true });
		[...list]
			.sort((a, b) => a.time - b.time)
			.forEach((a, i) => {
				g.advanceTo(Math.round(a.time * 60));
				g.apply(a.element, a.gauge, i);
			});
		g.advanceTo(Math.round(75 * 60));
		return g;
	};

	it('reproduces the batch event stream when driven one application at a time', () => {
		// ⚓ The batch IS this loop (`simulateGauge` calls `createGauge`), so what
		// this pins is the CALLER's half of the contract: advance-then-apply, with
		// arbitrarily large jumps, must not change the answer.
		const list = apps(
			[0, 'cryo', 2],
			[1.5, 'pyro', 1],
			[4, 'hydro', 2],
			[9, 'electro', 4],
			[30, 'dendro', 1],
			[31, 'pyro', 2],
			[60, 'anemo', 1]
		);
		const streamed = stream(list)
			.allEvents()
			.filter((e) => e.kind !== 'drained' || e.time <= 75);
		expect(streamed).toEqual(simulateGauge(list, { maxSeconds: 75 }).events);
	});

	it('🐛 closes a series interval on the frame that consumed the aura, then skips idle time', () => {
		// The idle skip jumped over the frame an application had just landed on
		// whenever that application consumed the LAST live aura — so the interval
		// never closed, and two lifetimes of one aura drew as a single line across
		// the gap. Caught by a 400-case sweep against the pre-split module.
		// the swirl at t=1 takes the whole hydro aura and Anemo attaches nothing,
		// so the gauge is left completely empty ON the frame it just worked on
		const list = apps([0, 'hydro', 1], [1, 'anemo', 4], [40, 'hydro', 1]);
		const g = stream(list);
		const hydro = g.closeSeries().filter((s) => s.key === 'hydro');
		expect(hydro).toHaveLength(2);
		expect(hydro[0].points.at(-1)).toEqual({ t: 1, u: 0 });
		expect(g.closeSeries()).toEqual(simulateGauge(list, { maxSeconds: 75 }).series);
	});

	it('skips idle time instead of walking it (C6 — the clock jumps)', () => {
		const g = createGauge();
		g.apply('pyro', 1, 0);
		g.advanceTo(432_000_000);
		expect(g.frame).toBe(432_000_000);
		expect(g.gauges().pyro).toBe(0);
		expect(g.idle).toBe(true);
	});

	it('reports its next internal task so a caller can schedule a wake-up', () => {
		const g = createGauge();
		expect(g.nextTaskFrame()).toBeNull();
		g.apply('dendro', 2, 0);
		g.apply('pyro', 1, 1);
		// burning ignited → its damage tick is 15 frames out
		expect(g.nextTaskFrame()).toBe(15);
	});

	it('gives every reaction an owner — so `appIndex` is never null', () => {
		// ⚓ The census behind the note on `SimEvent.appIndex`. The Burning chain is
		// the only thing that applies an element nobody cast, and every element that
		// would REACT with its Pyro (Hydro, Cryo, Electro) reacts on contact and so
		// cannot be sitting there as an aura when the tick lands. ↻ 2026-10-20: its
		// tick CAN Burgeon a core, and that reaction carries the burn's owner (see
		// the dendro-core cases). A consumer that must name a character for each
		// reaction depends on this.
		const g = createGauge();
		g.apply('cryo', 4, 0);
		g.advanceTo(30);
		g.apply('dendro', 2, 1);
		g.advanceTo(60);
		g.apply('pyro', 4, 2);
		g.apply('hydro', 4, 3);
		g.apply('electro', 4, 4);
		g.advanceTo(60 * 30);
		const orphans = g.allEvents().filter((e) => e.kind === 'reaction' && e.appIndex === null);
		expect(orphans).toEqual([]);
	});
});

describe('gaugesAt', () => {
	it('interpolates a decaying aura', () => {
		const sim = simulateGauge(apps([0, 'pyro', 2]));
		expect(gaugesAt(sim.series, 6).pyro).toBeCloseTo(0.8, 2);
		expect(gaugesAt(sim.series, 13).pyro).toBeUndefined();
	});
});
