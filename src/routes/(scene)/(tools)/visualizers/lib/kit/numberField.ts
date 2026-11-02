/**
 * The typeable value beside an instrument's slider: how a number is shown and
 * how what you type is read (the Visualizers overhaul, round 2:
 * `docs/rounds/viz-type-kit-2026-11-02.md`). Pure, so the rules are tested
 * here and `InstrumentSlider.svelte` only wires them to an input.
 *
 * Everything here is in DISPLAY units: what the field shows. A slider whose
 * model holds a fraction (CRIT Rate 0.7) shows 70; the component scales.
 */

/** How many decimals a step implies: 1 → 0, 0.5 → 1, 0.005 → 3. */
export function decimalsOf(step: number): number {
	if (!Number.isFinite(step) || step <= 0) return 0;
	const s = String(step);
	if (s.includes('e-')) return Number(s.split('e-')[1]);
	const dot = s.indexOf('.');
	return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * A number as the field shows it: rounded to `decimals`, trailing zeros
 * dropped (55, not 55.0; 55.5 stays), and no grouping, so what is shown can
 * be typed back.
 */
export function formatField(n: number, decimals: number): string {
	if (!Number.isFinite(n)) return '';
	const fixed = n.toFixed(Math.max(0, decimals));
	const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
	return trimmed === '-0' ? '0' : trimmed;
}

/**
 * Read what was typed: spaces, thousands commas and a trailing unit are
 * forgiven ("1,260", "70 %", "0.5s"), and a word the slider names (Off,
 * None) reads as its number. Anything else is null: not a number yet.
 */
export function parseField(raw: string, words: Record<string, number> = {}): number | null {
	const s = raw.trim().toLowerCase();
	if (s === '') return null;
	if (s in words) return words[s];
	const cleaned = s
		.replace(/,/g, '')
		.replace(/\s+/g, '')
		.replace(/[%a-z×]+$/, '');
	if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
	const n = Number(cleaned);
	return Number.isFinite(n) ? n : null;
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * The field's width in characters: the longest thing it will show (either
 * end of its range, or a word), so the box never changes size as the value
 * does and nothing beside it moves.
 */
export function fieldChars(
	min: number,
	max: number,
	decimals: number,
	texts: string[] = []
): number {
	const ends = [min, max].map((n) => {
		const whole = formatField(Math.trunc(n), 0).length;
		return decimals > 0 ? whole + 1 + decimals : whole;
	});
	return Math.max(1, ...ends, ...texts.map((t) => t.length));
}
