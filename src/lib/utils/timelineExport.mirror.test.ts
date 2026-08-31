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
import { AURA_MOD_META } from './auraDisplay';

const appCss = readFileSync(fileURLToPath(new URL('../../app.css', import.meta.url)), 'utf8');
const timelineSvelte = readFileSync(
	fileURLToPath(new URL('../components/RotationTimeline.svelte', import.meta.url)),
	'utf8'
);

/**
 * A :root-level declaration (tab-indented).
 *
 * 🐛 ⚠ THE VALUE MAY NOT CROSS A NEWLINE, and that is the whole guard against
 * a COMMENT shadowing the real declaration. `[^;]` matches newlines, so
 * `--rx-quicken: when an element closes on a UI colour, spend LIGHTNESS. Hue`
 * — prose in the block comment above the token — matched, ran on across lines
 * to the next `;` anywhere in the file, and handed back a paragraph. The old
 * note here claimed comments were safe because they lack a `:`; that is true of
 * most of them and false of every one written as `--token: explanation`, which
 * is how this file explains its tokens. Found by adding the first token whose
 * comment is written that way (gauge round L6).
 */
function cssToken(name: string, src = appCss): string {
	const m = new RegExp(`^\\s*${name}:\\s*([^;\\n]+);`, 'm').exec(src);
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

/** cssToken, but null instead of throwing (walking an alias chain that may
 *  dead-end on a primitive or on a token declared only in a context). */
function tryCssToken(name: string): string | null {
	try {
		return cssToken(name);
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
		// ↻ 2026-08-11: and that surface is the WELL rung now — --sp-avatar-fill
		// is one ground with the element travelling down it, and this is its top.
		expect(PALETTE_MIRROR.PORTRAIT_BG).toBe(resolve(ctxToken('.ctx-dark', '--surface-well')));
		// The aura lane's four non-elemental mods (gauge round L6). The five
		// elemental ones need no entry — they go through `elementPalette`, which
		// this file already guards below.
		expect(PALETTE_MIRROR.RX_FROZEN).toBe(resolve(cssToken('--rx-frozen')));
		expect(PALETTE_MIRROR.RX_QUICKEN).toBe(resolve(cssToken('--rx-quicken')));
		expect(PALETTE_MIRROR.RX_BURNING).toBe(resolve(cssToken('--rx-burning')));
		expect(PALETTE_MIRROR.RX_BURNING_FUEL).toBe(resolve(cssToken('--rx-burning-fuel')));
		// The gadget strip's two entities (Polestar-Field round).
		expect(PALETTE_MIRROR.RX_DENDRO_CORE).toBe(resolve(cssToken('--rx-dendro-core')));
		expect(PALETTE_MIRROR.RX_THUNDERCLOUD).toBe(resolve(cssToken('--rx-thundercloud')));
	});

	// ⚠ The colours are only half the mirror — the SCREEN reads its --rx-*
	// through `auraDisplay.ts` as `var()` references, so a mod pointing at the
	// wrong token would keep both this test and the CSS honest while still
	// drawing the wrong hue in one of the two surfaces. This pins the mapping.
	it('every aura mod names the same token on screen as in the export', () => {
		const expected: Record<string, string> = {
			frozen: '--rx-frozen',
			quicken: '--rx-quicken',
			burning: '--rx-burning',
			burningFuel: '--rx-burning-fuel',
			pyro: '--el-pyro-main',
			hydro: '--el-hydro-main',
			cryo: '--el-cryo-main',
			electro: '--el-electro-main',
			dendro: '--el-dendro-main'
		};
		for (const [mod, token] of Object.entries(expected)) {
			expect(AURA_MOD_META[mod as keyof typeof AURA_MOD_META].color).toBe(`var(${token})`);
		}
	});

	// ↻ 2026-08-11: the bar fill became a MATERIAL (--glass-bar), and one for
	// buffs, debuffs and procs alike. A PNG has no scene to lay glass on, so the
	// export paints the material COMPOSITED against the only ground it has.
	//
	// This is a stronger check than the literal comparison it replaces: it does
	// the compositing arithmetic here, so the export cannot drift if EITHER the
	// glass alpha, the glass rung, or the chart ground moves. Two of those three
	// have moved unannounced before — see the GRID/LANE_LINE notes.
	it('the bar material composites to the export literal (--glass-bar over the chart ground)', () => {
		const m = /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)/.exec(cssToken('--glass-bar'));
		expect(m, '--glass-bar must stay an rgb() literal — see the nesting law').not.toBeNull();
		const [r, g, b] = [+m![1], +m![2], +m![3]];
		const a = +m![4];
		const ground = hexToRgb(resolve(cssToken('--rp-chart-bg', timelineSvelte)));
		const over = (c: number, i: number) =>
			Math.round(c * a + ground[i] * (1 - a))
				.toString(16)
				.padStart(2, '0');
		expect(PALETTE_MIRROR.BAR_FILL).toBe(`#${over(r, 0)}${over(g, 1)}${over(b, 2)}`);
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

	// ↻ 2026-08-09 (Genshin Night): the line stops and --muted are DERIVED
	// values that ship as resolved literals, because writing them as color-mix
	// crashed WebKit — a color-mix result feeding another color-mix drops the
	// renderer once it is inherited by a large tree (THE NESTING LAW, app.css).
	//
	// So the derivation lives HERE instead of in the browser. This is not a
	// consolation prize: a checked recipe is stronger than a runtime one,
	// because it cannot silently re-resolve to something nobody looked at.
	it('the derived stops match their recipes (THE NESTING LAW)', () => {
		const RECIPES: [string, string, number[]][] = [
			// [context, ink, stops] — each mixed against that context's --frame-bg
			['.ctx-dark', '--parchment-100', [10, 18, 30, 42]],
			['.ctx-light', '--ink-700', [10, 18, 30, 42]]
		];
		const NAMES = ['--line-faint', '--line-soft', '--line-strong', '--line-edge'];
		for (const [ctx, ink, pcts] of RECIPES) {
			const ground = resolve(ctxToken(ctx, '--frame-bg'), ctx);
			const inkHex = resolve(cssToken(ink));
			pcts.forEach((pct, i) => {
				expect(resolve(ctxToken(ctx, NAMES[i]), ctx), `${ctx} ${NAMES[i]}`).toBe(
					mix(inkHex, ground, pct)
				);
			});
		}
		// --muted is the ink at .72 wherever the ground is slate-800.
		const slate800 = resolve(cssToken('--slate-800'));
		const parch = resolve(cssToken('--parchment-100'));
		for (const ctx of ['.ctx-dark', '.ctx-glass']) {
			expect(resolve(ctxToken(ctx, '--muted'), ctx), `${ctx} --muted`).toBe(
				mix(parch, slate800, 72)
			);
		}
	});

	// The law itself: nothing may put a color-mix inside a color-mix. Written
	// as a grep rather than an evaluation because the failure is a CRASH, not a
	// wrong colour — by the time you can measure it the page is gone.
	it('no color-mix takes a derived value as an input (THE NESTING LAW)', () => {
		const derived = new Set<string>();
		for (const m of appCss.matchAll(/^\s*(--[a-z0-9-]+):\s*(color-mix\([^;]+);/gm)) {
			derived.add(m[1]);
		}
		const offenders: string[] = [];
		for (const m of appCss.matchAll(/^\s*(--[a-z0-9-]+):\s*color-mix\(([^;]+)\);/gm)) {
			for (const ref of m[2].matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
				// An alias OF a color-mix counts too: --border is var(--line-edge).
				let name: string | null = ref[1];
				for (let i = 0; name && i < 8; i++) {
					if (derived.has(name)) {
						offenders.push(`${m[1]} mixes ${ref[1]} (derived via ${name})`);
						break;
					}
					const v: string | null = tryCtxToken('.ctx-dark', name) ?? tryCssToken(name);
					const alias: RegExpExecArray | null = v
						? /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(v.trim())
						: null;
					name = alias ? alias[1] : null;
				}
			}
		}
		expect(offenders, 'a mix of a mix crashes WebKit — resolve it to a literal').toEqual([]);
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
			// styleguide RENDERS the ramps, which means naming them. /lab is the
			// specimen board and is exempt for exactly the same reason — a page
			// whose job is "show me every candidate rung side by side" cannot ask
			// for them through roles, because the whole question is which role
			// each rung should get. ⚠ BOTH EXEMPTIONS ARE DEV-ONLY ROUTES
			// (prerender false + a dev guard), which is what keeps this from being
			// a hole in the law: neither page ships.
			if (rel === 'app.css' || rel.includes('styleguide') || rel.includes('/lab/')) continue;
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
		const re = /^\s*--el-([a-z]+)-(main|bar|border|hi):\s*([^;]+);/gm;
		let m: RegExpExecArray | null;
		let count = 0;
		while ((m = re.exec(appCss))) {
			const [, el, slot, value] = m;
			const entry = elementColors[el as keyof typeof elementColors] as Record<string, string>;
			expect(entry, `--el-${el}-${slot} has no TS mirror entry`).toBeDefined();
			expect(entry[slot], `--el-${el}-${slot}`).toBe(value.trim().replace(/\s+/g, ' '));
			count++;
		}
		// 7 elements × 4 slots + none-main — a floor so a regex regression
		// can't silently pass on zero matches. ⚠ physical has no CSS token at
		// all (it is TS-only), and none/physical have no bar/border/hi by
		// design, so this counts DECLARATIONS in app.css, not slots in the TS.
		expect(count).toBeGreaterThanOrEqual(29);
	});
});
