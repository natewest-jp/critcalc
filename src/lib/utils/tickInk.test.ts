/**
 * src/lib/utils/tickInk.test.ts
 *
 * ⚓ Every element's summon tick reads at one strength (⚓ Nate, 2026-10-17):
 * re-derives `TICK_INK` — each stub clears its element's `bar` by at least
 * Electro's OKLab lightness step, and the elements already there keep `hi`.
 */
import { describe, expect, it } from 'vitest';
import { elementColors, tickInk, TICK_INK } from './elementColors';

const lin = (c: number) =>
	c <= 0.04045 * 255 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4;
const okL = (hex: string) => {
	const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
};
const ELEMENTS = ['pyro', 'hydro', 'anemo', 'electro', 'cryo', 'geo', 'dendro'] as const;
const step = (el: (typeof ELEMENTS)[number]) => okL(tickInk(el)) - okL(elementColors[el].bar);
const FLOOR = okL(elementColors.electro.hi) - okL(elementColors.electro.bar);

describe('summon tick ink', () => {
	it('every element clears its bar by Electro’s step (hex rounding aside)', () => {
		for (const el of ELEMENTS) expect(step(el), el).toBeGreaterThan(FLOOR - 0.002);
	});

	it('only the elements below the floor are lifted', () => {
		for (const el of ELEMENTS) {
			const below = okL(elementColors[el].hi) - okL(elementColors[el].bar) < FLOOR - 1e-9;
			expect(el in TICK_INK, el).toBe(below);
		}
	});
});
