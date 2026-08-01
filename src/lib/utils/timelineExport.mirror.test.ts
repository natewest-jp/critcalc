/**
 * The palette-mirror drift guard (lightness-structure round 2026-08-01).
 *
 * timelineExport.ts hand-mirrors app.css tokens as literals (canvas can't
 * resolve var()), and elementColors.ts hand-mirrors the --el-* palette. Both
 * pairs were trust-based — "change one, change the other" comments. This test
 * makes the drift mechanical: it re-derives every mirrored value from the CSS
 * sources and fails if the literals disagree. Its first run caught a real one
 * (MUTED still carried the pre-recut #9baabf).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PALETTE_MIRROR } from './timelineExport';
import { elementColors } from './elementColors';

const appCss = readFileSync(fileURLToPath(new URL('../../app.css', import.meta.url)), 'utf8');
const timelineSvelte = readFileSync(
	fileURLToPath(new URL('../components/RotationTimeline.svelte', import.meta.url)),
	'utf8'
);

/** A :root-level declaration (tab-indented) — comments mentioning the token
 *  without a `:` don't match. */
function cssToken(name: string, src = appCss): string {
	const m = new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(src);
	if (!m) throw new Error(`token ${name} not found`);
	return m[1].trim();
}

function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.replace('#', ''), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** color-mix(in srgb, a pct%, b) with the exporter's per-channel rounding. */
function mix(a: string, b: string, pctA: number): string {
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	const t = pctA / 100;
	const to = (x: number, y: number) =>
		Math.round(x * t + y * (1 - t))
			.toString(16)
			.padStart(2, '0');
	return `#${to(ar, br)}${to(ag, bg)}${to(ab, bb)}`;
}

function hslToHex(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const hp = h / 60;
	const x = c * (1 - Math.abs((hp % 2) - 1));
	const m = l - c / 2;
	let rgb: [number, number, number];
	if (hp < 1) rgb = [c, x, 0];
	else if (hp < 2) rgb = [x, c, 0];
	else if (hp < 3) rgb = [0, c, x];
	else if (hp < 4) rgb = [0, x, c];
	else if (hp < 5) rgb = [x, 0, c];
	else rgb = [c, 0, x];
	const to = (v: number) =>
		Math.round((v + m) * 255)
			.toString(16)
			.padStart(2, '0');
	return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`;
}

describe('timelineExport palette mirror ↔ app.css', () => {
	it('plain hex tokens match', () => {
		// The chart ground is planner-local since 2026-08-01 (Nate's darker
		// well), declared in RotationTimeline rather than app.css.
		expect(PALETTE_MIRROR.CHART_BG).toBe(cssToken('--rp-chart-bg', timelineSvelte));
		expect(PALETTE_MIRROR.TEXT).toBe(cssToken('--text'));
		expect(PALETTE_MIRROR.MUTED).toBe(cssToken('--muted'));
		expect(PALETTE_MIRROR.INK).toBe(cssToken('--ink'));
		expect(PALETTE_MIRROR.PORTRAIT_BG).toBe(cssToken('--surface'));
		expect(PALETTE_MIRROR.CALM_TINT).toBe(cssToken('--calm-fill'));
		expect(PALETTE_MIRROR.CALM_EDGE).toBe(cssToken('--calm'));
	});

	it('--dire (hsl) resolves to DIRE_TINT', () => {
		const m = /^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/.exec(cssToken('--dire'));
		expect(m).not.toBeNull();
		expect(PALETTE_MIRROR.DIRE_TINT).toBe(hslToHex(+m![1], +m![2], +m![3]));
	});

	it('--dire-fill (relative color, hue from --dire) resolves to DIRE_FILL', () => {
		const dire = /^hsl\((\d+),/.exec(cssToken('--dire'));
		const fill = /^hsl\(from var\(--dire\) h (\d+)% (\d+)%\)$/.exec(cssToken('--dire-fill'));
		expect(dire).not.toBeNull();
		expect(fill).not.toBeNull();
		expect(PALETTE_MIRROR.DIRE_FILL).toBe(hslToHex(+dire![1], +fill![1], +fill![2]));
	});

	it('resolved color-mix lines match (GRID, LANE_LINE)', () => {
		const border = cssToken('--border');
		// Both planner lines derive from --border toward the planner-local
		// chart ground (2026-08-01).
		const chartBg = cssToken('--rp-chart-bg', timelineSvelte);
		const rpLine = /var\(--border\) (\d+)%, var\(--rp-chart-bg\)/.exec(
			cssToken('--rp-line', timelineSvelte)
		);
		expect(rpLine).not.toBeNull();
		expect(PALETTE_MIRROR.LANE_LINE).toBe(mix(border, chartBg, +rpLine![1]));
		const rpGrid = /var\(--border\) (\d+)%, var\(--rp-chart-bg\)/.exec(
			cssToken('--rp-grid', timelineSvelte)
		);
		expect(rpGrid).not.toBeNull();
		expect(PALETTE_MIRROR.GRID).toBe(mix(border, chartBg, +rpGrid![1]));
	});

	it('ACTIVE matches the planner-local --rp-active', () => {
		expect(PALETTE_MIRROR.ACTIVE).toBe(cssToken('--rp-active', timelineSvelte));
	});
});

describe('elementColors ↔ app.css --el-* tokens', () => {
	it('every declared --el-* slot matches the TS mirror', () => {
		const re = /^\s*--el-([a-z]+)-(main|border|hi):\s*([^;]+);/gm;
		let m: RegExpExecArray | null;
		let count = 0;
		while ((m = re.exec(appCss))) {
			const [, el, slot, value] = m;
			const entry = elementColors[el as keyof typeof elementColors] as Record<string, string>;
			expect(entry, `--el-${el}-${slot} has no TS mirror entry`).toBeDefined();
			expect(entry[slot], `--el-${el}-${slot}`).toBe(value.trim().replace(/\s+/g, ' '));
			count++;
		}
		// 7 elements × 3 slots + none-main — a floor so a regex regression
		// can't silently pass on zero matches.
		expect(count).toBeGreaterThanOrEqual(22);
	});
});
