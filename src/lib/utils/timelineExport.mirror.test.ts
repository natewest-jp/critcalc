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
import { readFileSync, readdirSync } from 'node:fs';
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

/** A declaration inside a specific context block (`.ctx-dark` / `.ctx-light`,
 *  2026-08-05 Genshin-UI archetype): the timeline runs dark and the portrait
 *  cards light, so their mirrored tokens must be sourced from the context
 *  re-declarations, not :root. */
function ctxToken(selector: string, name: string): string {
	// ^-anchored: the selector's rule starts at column 0; unanchored matching
	// would hit prose mentions of the class in comments first.
	const block = new RegExp(`^${selector.replace(/\./g, '\\.')}[^{]*\\{([^}]*)\\}`, 'm').exec(
		appCss
	);
	if (!block) throw new Error(`context block ${selector} not found`);
	const m = new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(block[1]);
	if (!m) throw new Error(`token ${name} not found in ${selector}`);
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

/**
 * Resolve a token VALUE down to a literal hex.
 *
 * ↻ 2026-08-09 (Genshin Night): app.css grew a primitive layer, so a role no
 * longer holds a hex — `--text` is `var(--parchment-100)` and `--border` is
 * `var(--line-edge)`, itself a color-mix of two more vars. The guard's job is
 * unchanged (catch drift between the CSS and the canvas mirror); its INPUT
 * changed, so it has to follow the aliases the browser follows.
 *
 * `scope` is the context selector a reference should be looked up in FIRST —
 * the substituted-at-declaration law means `.ctx-dark`'s `--border` resolves
 * against `.ctx-dark`'s own `--line-edge` and ground, not :root's.
 */
function resolve(value: string, scope?: string, depth = 0): string {
	if (depth > 12) throw new Error(`token resolution did not terminate: ${value}`);
	const v = value.trim();

	if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();

	const varRef = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(v);
	if (varRef) {
		const name = varRef[1];
		const lookup = scope ? tryCtxToken(scope, name) : null;
		return resolve(lookup ?? cssToken(name), scope, depth + 1);
	}

	const cm = /^color-mix\(\s*in srgb,\s*(.+?)\s+(\d+)%\s*,\s*(.+?)\s*\)$/i.exec(v);
	if (cm) {
		return mix(resolve(cm[1], scope, depth + 1), resolve(cm[3], scope, depth + 1), +cm[2]);
	}

	throw new Error(`cannot resolve token value: ${value}`);
}

/** ctxToken, but null instead of throwing — the scope-then-root lookup order. */
function tryCtxToken(selector: string, name: string): string | null {
	try {
		return ctxToken(selector, name);
	} catch {
		return null;
	}
}

describe('timelineExport palette mirror ↔ app.css', () => {
	it('plain hex tokens match', () => {
		// The chart ground is planner-local since 2026-08-01 (Nate's darker
		// well), declared in RotationTimeline rather than app.css.
		expect(PALETTE_MIRROR.CHART_BG).toBe(resolve(cssToken('--rp-chart-bg', timelineSvelte)));
		// The timeline root is .ctx-dark; its text tokens mirror that block.
		expect(PALETTE_MIRROR.TEXT).toBe(resolve(ctxToken('.ctx-dark', '--text'), '.ctx-dark'));
		expect(PALETTE_MIRROR.MUTED).toBe(resolve(ctxToken('.ctx-dark', '--muted'), '.ctx-dark'));
		expect(PALETTE_MIRROR.INK).toBe(resolve(cssToken('--bright-ink')));
		// ↻ 2026-08-05: the bench card renders in the ribbon's DARK context (the
		// `ctx-light` class it used to carry painted no ground of its own — see
		// SlotPortrait), so the avatar disc mirrors that block's surface.
		expect(PALETTE_MIRROR.PORTRAIT_BG).toBe(resolve(ctxToken('.ctx-dark', '--surface')));
		expect(PALETTE_MIRROR.CALM_TINT).toBe(resolve(cssToken('--calm-fill')));
		expect(PALETTE_MIRROR.CALM_EDGE).toBe(resolve(cssToken('--calm')));
	});

	it('--debuff / --debuff-fill match (dire successors, 2026-08-05)', () => {
		expect(PALETTE_MIRROR.DEBUFF_EDGE).toBe(resolve(cssToken('--debuff')));
		expect(PALETTE_MIRROR.DEBUFF_FILL).toBe(resolve(cssToken('--debuff-fill')));
	});

	it('resolved color-mix lines match (GRID, LANE_LINE)', () => {
		// The lines derive from the DARK context's border — the timeline root
		// is .ctx-dark, so that re-declaration is what var(--border) resolves
		// to at the .rp-root declarations. Since 2026-08-09 --border is itself
		// an alias of that context's --line-edge, hence the scoped resolve.
		const border = resolve(ctxToken('.ctx-dark', '--border'), '.ctx-dark');
		// Both planner lines derive from --border toward the planner-local
		// chart ground (2026-08-01).
		const chartBg = resolve(cssToken('--rp-chart-bg', timelineSvelte));
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
		expect(PALETTE_MIRROR.ACTIVE).toBe(resolve(cssToken('--rp-active', timelineSvelte)));
	});

	// ↻ 2026-08-09 (Genshin Night): the primitive layer is only worth having if
	// nothing reaches past it, so the guard also polices the LAW — a NUMBER
	// means a primitive, and only app.css (which defines the roles) may name
	// one. The failure this prevents is the quiet one: a component grabs
	// --slate-700 because it happens to look right, and then a context flip
	// leaves it painting a dark rung on a paper panel with no way to notice.
	it('no component names a primitive rung directly (the L0 law)', () => {
		const RAMPS = 'night|slate|parchment|gold|ink|red';
		const re = new RegExp(`var\\(\\s*--(?:${RAMPS})-\\d+`, 'g');
		const root = fileURLToPath(new URL('../..', import.meta.url));
		const offenders: string[] = [];
		for (const rel of readdirSync(root, { recursive: true }) as string[]) {
			if (!/\.(svelte|css|ts)$/.test(rel)) continue;
			// app.css DEFINES the ramps and the roles that point at them; the
			// styleguide RENDERS the ramps, which means naming them.
			if (rel === 'app.css' || rel.includes('styleguide')) continue;
			if (rel.endsWith('.test.ts')) continue;
			for (const m of readFileSync(root + rel, 'utf8').matchAll(re)) {
				offenders.push(`${rel}: ${m[0]})`);
			}
		}
		expect(offenders, 'reach for a ROLE, or add one — see the L0 law in app.css').toEqual([]);
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
