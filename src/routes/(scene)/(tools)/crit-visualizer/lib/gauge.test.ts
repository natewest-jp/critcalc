import { describe, it, expect } from 'vitest';
import {
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
	sim.events.filter((e): e is Extract<SimEvent, { kind: 'expire' }> => e.kind === 'expire');

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

describe('burning', () => {
	it('attaches a fixed 2U burning aura + fuel draining at 0.4 U/s, self-refreshing pyro', () => {
		const sim = simulateGauge(apps([0, 'dendro', 2], [2, 'pyro', 1]));
		expect(reactions(sim).some((r) => r.reaction === 'burning')).toBe(true);
		// dendro at 2s = 1.3333 becomes the fuel
		expect(gaugesAt(sim.series, 2.01).burningFuel).toBeCloseTo(1.333, 2);
		expect(gaugesAt(sim.series, 2.01).burning).toBeCloseTo(2, 6);
		// pyro attached (ignition does not consume the trigger) and is kept topped up
		expect(gaugesAt(sim.series, 4.5).pyro).toBeCloseTo(0.8, 1);
		// fuel dies at 2 + 1.3333/0.4 ≈ 5.33s and sweeps burning with it
		const end = sim.events.find((e) => e.kind === 'burningEnd')!;
		expect(end.time).toBeCloseTo(5.33, 1);
		expect(end.kind === 'burningEnd' && end.swept.includes('burning')).toBe(true);
		// the leftover pyro aura outlives burning by its own 9.5s clock
		expect(expireOf(sim, 'pyro')!.time).toBeGreaterThan(14);
		expect(expireOf(sim, 'pyro')!.time).toBeLessThan(15.5);
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

describe('gaugesAt', () => {
	it('interpolates a decaying aura', () => {
		const sim = simulateGauge(apps([0, 'pyro', 2]));
		expect(gaugesAt(sim.series, 6).pyro).toBeCloseTo(0.8, 2);
		expect(gaugesAt(sim.series, 13).pyro).toBeUndefined();
	});
});
