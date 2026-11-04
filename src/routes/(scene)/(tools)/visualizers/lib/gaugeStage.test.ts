import { describe, expect, it } from 'vitest';
import { simulateGauge, type Application } from '$lib/utils/gauge';
import { aurasAt, bareFrom, dropMarks, gaugeHead, widestHead } from './gaugeStage';

const run = (apps: [number, Application['element'], number][]) =>
	simulateGauge(apps.map(([time, element, gauge]) => ({ time, element, gauge })));

describe('the headline at rest: when the target goes bare', () => {
	it('a 1U aura lasts 2.5 × 1 + 7 = 9.5s', () => {
		const { series } = run([[0, 'pyro', 1]]);
		expect(bareFrom(series)).toBeCloseTo(9.5, 1);
		expect(gaugeHead(series, null)).toEqual({ figure: 'No aura', sentence: 'from 9.5s' });
	});

	it('Vaporize clears a 2U Pyro aura at the hit', () => {
		const { series } = run([
			[0, 'pyro', 2],
			[2.5, 'hydro', 1]
		]);
		expect(bareFrom(series)).toBeCloseTo(2.5, 1);
	});

	it('no aura ever forms on an empty chart or from Anemo alone', () => {
		expect(gaugeHead(run([]).series, null)).toEqual({
			figure: 'No aura',
			sentence: 'on the target'
		});
		expect(bareFrom(run([[0, 'anemo', 1]]).series)).toBeNull();
	});
});

describe('the headline at a moment', () => {
	it('reads the aura with units at two places', () => {
		const { series } = run([[0, 'pyro', 1]]);
		// 0.8U taxed, draining 0.8U over 9.5s.
		expect(gaugeHead(series, 0)).toEqual({ figure: '0.80U Pyro', sentence: 'at 0.0s' });
		expect(gaugeHead(series, 4.75).figure).toBe('0.40U Pyro');
	});

	it('lists coexisting auras in the display order', () => {
		const { series } = run([
			[0, 'hydro', 2],
			[1, 'electro', 1]
		]);
		const auras = aurasAt(series, 1.2).map((a) => a.mod);
		expect(auras).toEqual(['hydro', 'electro']);
		expect(gaugeHead(series, 1.2).figure).toMatch(/^\d\.\d\dU Hydro · \d\.\d\dU Electro$/);
	});

	it('leaves Burning’s fuel out: it is bookkeeping, not an aura', () => {
		const { series } = run([
			[0, 'dendro', 1],
			[1, 'pyro', 1]
		]);
		const mods = aurasAt(series, 1.5).map((a) => a.mod);
		expect(mods).toContain('burning');
		expect(mods).not.toContain('burningFuel');
	});

	it('says so where the target is bare', () => {
		const { series } = run([[2, 'pyro', 1]]);
		expect(gaugeHead(series, 1)).toEqual({ figure: 'No aura', sentence: 'at 1.0s' });
	});
});

describe('the room the headline keeps', () => {
	it('is the reading that names the most auras', () => {
		const sim = run([
			[0, 'dendro', 1],
			[1, 'pyro', 1],
			[2, 'dendro', 1]
		]);
		const widest = widestHead(sim.series, sim.duration).figure;
		for (let t = 0; t <= sim.duration; t += 0.25)
			expect(gaugeHead(sim.series, t).figure.length).toBeLessThanOrEqual(widest.length);
		expect(widest.split(' · ').length).toBeGreaterThanOrEqual(2);
	});

	it('is "No aura" where no aura forms', () => {
		expect(widestHead(run([]).series, 0).figure).toBe('No aura');
	});
});

describe('the drops a reaction takes off the curves', () => {
	it('Reverse Melt chips 0.5U off a 2U Pyro aura at each Cryo hit', () => {
		const { series, events } = run([
			[0, 'pyro', 2],
			[2, 'cryo', 1],
			[4, 'cryo', 1]
		]);
		const drops = dropMarks(series, events);
		expect(drops.map((d) => [d.mod, d.time, d.amount])).toEqual([
			['pyro', 2, 0.5],
			['pyro', 4, 0.5]
		]);
		expect(drops[0].after).toBeGreaterThan(0);
	});

	it('Vaporize leaves nothing behind', () => {
		const { series, events } = run([
			[0, 'pyro', 2],
			[2.5, 'hydro', 1]
		]);
		const [drop] = dropMarks(series, events);
		expect(drop.mod).toBe('pyro');
		expect(drop.after).toBe(0);
	});

	it('Aggravate spends no gauge, so it draws no drop', () => {
		const { series, events } = run([
			[0, 'dendro', 1.5],
			[1, 'electro', 1],
			[2, 'electro', 1]
		]);
		const drops = dropMarks(series, events);
		expect(drops.every((d) => d.time < 2)).toBe(true);
	});
});
