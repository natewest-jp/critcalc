<script lang="ts">
	/**
	 * critcalc.app — Style Reference (dev-only, /styleguide)
	 *
	 * THE STYLE AUTHORITY. The pages themselves can't be it: the same idiom once
	 * had eleven parallel implementations, so "copy the nearest neighbour" is
	 * exactly how the drift happened.
	 *
	 * TWO STATES on this page, and the labels are load-bearing:
	 *
	 *   LIVE    — parsed from src/app.css at build time (?raw). Cannot drift.
	 *   SHIPPED — a real global class in app.css. Every specimen below is that
	 *             class, not a copy; nothing in this file styles a control.
	 *
	 * Do not "fix" a pattern by editing a component — edit app.css, once, and
	 * every caller follows.
	 *
	 * ⚓ A third label, ON TRIAL, marks a value Nate is testing rather than a
	 * decision that has landed. It is shipped and real, and it may still move.
	 */
	import appCss from '../../app.css?raw';
	import Mark from '$lib/components/Mark.svelte';
	import { MARK_NODES, type MarkName } from '$lib/marks.generated';
	import { BAND_A_H, BAND_B_H, BAND_GAP, BAND_STACK_GAP, BAND_RADIUS } from '$lib/toolBands';
	import { TOOL_DIM } from '$lib/landing/transition';

	type Token = { name: string; value: string; resolved: string };

	const DECL = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g;
	/** Every `--x: value;` in a rule body, comments stripped. Built as entries
	 *  and handed to the Map constructor rather than `.set()` in a loop — this
	 *  is a build-time parse of a static string, and `prefer-svelte-reactivity`
	 *  (correctly) flags any Map that gets mutated after construction. */
	const declsIn = (body: string): Map<string, string> => {
		const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
		const entries: [string, string][] = [...clean.matchAll(new RegExp(DECL.source, 'g'))].map(
			(m) => [m[1], m[2].trim()]
		);
		return new Map(entries);
	};

	/**
	 * Follow an alias chain to something paintable.
	 *
	 * ↻ 2026-08-09 (Genshin Night): this used to be a SINGLE hop, and a single
	 * hop used to be enough — every role held a literal, so `var(--x)` always
	 * landed on a hex in one step. The primitive layer broke both halves of that
	 * assumption at once: roles now point at rungs (`--text` is
	 * `var(--parchment-100)`), and some chains are two deep (`--sel-ink` →
	 * `--bright-ink` → `--ink-950`). The context parser had it worse — it did no
	 * resolution AT ALL, which was invisible while every context value was a
	 * literal and blanked every swatch in Families the moment they weren't.
	 *
	 * `local` is consulted before `root`: a context re-declares its own ground,
	 * so `.ctx-light`'s `--border` must resolve against ITS `--line-edge`.
	 * Depth-capped rather than cycle-tracked — a cycle in app.css is a bug we
	 * want to see as an unresolved value, not paper over.
	 */
	function resolveToken(
		value: string,
		local: Map<string, string>,
		root: Map<string, string>,
		depth = 0
	): string {
		const alias = /^var\((--[a-z0-9-]+)\)$/.exec(value.trim());
		if (!alias || depth > 8) return value;
		const next = local.get(alias[1]) ?? root.get(alias[1]);
		return next === undefined ? value : resolveToken(next, local, root, depth + 1);
	}

	/** Parse the :root block of app.css. The block ends at the first column-0
	 *  `}` — every line inside it is tab-indented. */
	function parseRootTokens(css: string): Token[] {
		const start = css.indexOf(':root {');
		const end = css.indexOf('\n}', start);
		const decls = declsIn(css.slice(start + ':root {'.length, end));
		return [...decls].map(([name, value]) => ({
			name,
			value,
			resolved: resolveToken(value, decls, decls)
		}));
	}

	/** The same trick for a context block (`.ctx-dark` / `.ctx-light` /
	 *  `.ctx-glass`). The contexts are the palette's PRIMARY axis, so they have
	 *  to be live on this page too — reading them from :root would show the
	 *  safety net rather than the thing components actually resolve.
	 *  ^-anchored: the rule starts at column 0, and unanchored matching hits
	 *  prose mentions in comments. */
	function parseContextTokens(css: string, selector: string): Token[] {
		const block = new RegExp(`^${selector.replace(/\./g, '\\.')}[^{]*\\{([^}]*)\\}`, 'm').exec(css);
		if (!block) return [];
		const local = declsIn(block[1]);
		const root = declsIn(css.slice(css.indexOf(':root {') + 7, css.indexOf('\n}')));
		return [...local].map(([name, value]) => ({
			name,
			value,
			resolved: resolveToken(value, local, root)
		}));
	}

	const tokens = parseRootTokens(appCss);
	const pre = (...ps: string[]) => tokens.filter((t) => ps.some((p) => t.name.startsWith(p)));
	const exact = (...ns: string[]) =>
		ns.map((n) => tokens.find((t) => t.name === n)).filter((t): t is Token => !!t);

	/** The ground roles + the two text rungs, in each context's own words.
	 *  Order is deliberate: it reads as the ladder, deepest ground first. */
	const CTX_ORDER = [
		'--frame-bg',
		'--surface',
		'--surface-raised',
		'--surface-well',
		'--border',
		'--text',
		'--muted'
	];
	const ctxRow = (sel: string) => {
		const found = parseContextTokens(appCss, sel);
		return CTX_ORDER.map((n) => found.find((t) => t.name === n)).filter((t): t is Token => !!t);
	};
	const ctxDark = ctxRow('.ctx-dark');
	const ctxLight = ctxRow('.ctx-light');
	const ctxGlass = ctxRow('.ctx-glass');

	/** L0 — the primitive ramps (Genshin Night, 2026-08-09). A NUMBER means a
	 *  primitive and no component may name one; these exist to be pointed AT. */
	const ramps = ['night', 'slate', 'parchment', 'gold', 'ink', 'red'].map((name) => ({
		name,
		rungs: tokens.filter((t) => new RegExp(`^--${name}-\\d+$`).test(t.name))
	}));
	const rampNames = new Set(ramps.flatMap((r) => r.rungs.map((t) => t.name)));
	/** L1 — the compositing stops. Glass stays translucent; lines resolve
	 *  opaque per context (so they live in the .ctx-* blocks, not here). */
	const glass = pre('--glass-');

	const structure = exact('--bg', '--text', '--muted', '--bright-ink', '--chrome', '--neutral');
	const roleNet = exact(
		'--surface',
		'--surface-raised',
		'--surface-well',
		'--border',
		'--frame-bg',
		'--frame-line',
		'--frame-line-quiet',
		'--line-faint',
		'--line-soft',
		'--line-strong',
		'--line-edge',
		'--scene-dim'
	);
	const chartInk = pre('--chart-');
	const metrics = exact('--chrome-h', '--site-footer-h');
	const famAnnotation = exact('--buff-fill', '--debuff-fill');
	const uiStates = pre('--ui-');
	const geometry = [...pre('--r-'), ...exact('--frame-inset')];
	const motion = exact('--t-quick');
	const interaction = exact(
		'--fill-rest',
		'--fill-hover',
		'--sel-fill',
		'--sel-ring',
		'--accent-hover-fill',
		'--btn-face',
		'--btn-face-hover',
		'--control-face',
		'--control-face-hover',
		'--control-ink',
		'--ink-active',
		'--sel-surface',
		'--sel-ink',
		'--knob',
		'--accent'
	);
	const elements = pre('--el-');
	const reactions = pre('--rx-');
	const fonts = pre('--font-');
	const sizes = pre('--fs-');
	const weights = pre('--fw-');
	const tracking = pre('--ls-');
	const leading = pre('--lh-');

	/** Anything in :root no group above claimed — so a new token can never be
	 *  added without surfacing here. */
	const claimed = new Set(
		[
			[...rampNames].map((name) => ({ name })) as Token[],
			glass,
			structure,
			metrics,
			famAnnotation,
			roleNet,
			chartInk,
			uiStates,
			geometry,
			motion,
			interaction,
			elements,
			reactions,
			fonts,
			sizes,
			weights,
			tracking,
			leading
		].flatMap((g) => g.map((t) => t.name))
	);
	const unclaimed = tokens.filter((t) => !claimed.has(t.name));

	const isColor = (v: string) => /^(#|rgb|hsl|color-mix)/.test(v);

	const ELEMENTS = ['pyro', 'hydro', 'anemo', 'electro', 'cryo', 'geo', 'dendro', 'none'];

	/** Every mark the generator produced — so this page cannot fall behind the
	 *  set, and an unused glyph is visible rather than quietly accumulating. */
	const MARKS = Object.keys(MARK_NODES) as MarkName[];

	/** The inset border family — CLOSED at two (⚓ Nate, 2026-08-09). */
	const INSETS: { mod: string; blurb: string; glassOk: boolean }[] = [
		{
			mod: 'plain',
			blurb:
				'One stroke, set in. The undecorated baseline, and safe everywhere — a single stroke composites exactly once, so it works on glass too.',
			glassOk: true
		},
		{
			mod: 'double',
			blurb:
				'⚓ Nate’s mockup — two strokes on ONE box, differing only in corner radius, so the wide arc cuts across the tight corner. Already shipped on the bench ribbon, which keeps its own copy (its radii are tuned to its geometry: RIBBON_FRAME_R_WIDE is 30, not 22). ⚠ OPAQUE GROUNDS ONLY.',
			glassOk: false
		}
	];

	// ═══════════════════════════════════════════════════════════════════════════
	// THE PALETTE CENSUS (⚓ NATE 2026-08-10) — "we have this great palette that
	// we worked to define, but we don't have any settled decisions about how we
	// use them."
	//
	// This is not another swatch chart; #tokens already lists every rung. It
	// answers the question a swatch chart can't: FOR EACH RUNG, WHO IS ALREADY
	// SPEAKING FOR IT — and therefore which rungs are free, which are doing
	// several jobs at once, and which exist only because a ramp is a ramp.
	//
	// Everything here is COMPUTED from app.css, never listed by hand. A census
	// maintained by hand is wrong within a week and worse than none, because it
	// reads as authoritative; this one cannot drift for the same reason the rest
	// of the page cannot.
	//
	// ⚠ WHY app.css IS THE WHOLE SEARCH SPACE. The layer law — a NUMBER means a
	// primitive and no component may name one — is grep-enforced in
	// timelineExport.mirror.test.ts. So every consumer of a rung is in this one
	// file by construction. If that test is ever relaxed, this census silently
	// stops being complete.
	// ═══════════════════════════════════════════════════════════════════════════

	/** Where a declaration lives. The contexts matter as much as the value: the
	 *  same rung can be a ground in one and an ink in another, which is exactly
	 *  the double duty the parchment family was chosen for. */
	const CTX_SELECTORS = ['.ctx-dark', '.ctx-light', '.ctx-glass'];

	type Claim = { role: string; where: string };

	const allDecls = [
		...tokens.map((t) => ({ ...t, where: ':root' })),
		...CTX_SELECTORS.flatMap((sel) =>
			parseContextTokens(appCss, sel).map((t) => ({ ...t, where: sel }))
		)
	].filter((d) => !rampNames.has(d.name) && !d.name.startsWith('--glass-'));

	const sameColor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

	/**
	 * Two kinds of claim, and the difference is the point.
	 *
	 *   IS   — a role that resolves TO this rung. `--surface: var(--slate-800)`.
	 *          The rung is painted as itself; move it and the role moves with it.
	 *   MIX  — a role that names the rung inside an expression and comes out
	 *          somewhere else. `--btn-face: color-mix(… var(--slate-800))`. The
	 *          rung is an INGREDIENT, and a role like that is the reason a rung
	 *          can look unused while being load-bearing.
	 */
	function claimsFor(rung: Token): { is: Claim[]; mix: Claim[]; loose: number } {
		const mention = `var(${rung.name})`;
		const is: Claim[] = [];
		const mix: Claim[] = [];
		for (const d of allDecls) {
			if (sameColor(d.resolved, rung.resolved)) is.push({ role: d.name, where: d.where });
			else if (d.value.includes(mention)) mix.push({ role: d.name, where: d.where });
		}
		// Everything else in app.css that names the rung directly — the rule-level
		// overrides (`.tb-nav-item.active { --frame-line: … }` and friends). Not
		// attributed to a role, but counted, so a rung is never reported free
		// while a rule somewhere is leaning on it.
		const total = appCss.split(mention).length - 1;
		return { is, mix, loose: Math.max(0, total - is.length - mix.length) };
	}

	const census = (name: string) =>
		tokens
			.filter((t) => new RegExp(`^--${name}-\\d+$`).test(t.name))
			.map((rung) => ({ rung, ...claimsFor(rung) }));

	const isFree = (r: { is: Claim[]; mix: Claim[]; loose: number }) =>
		r.is.length === 0 && r.mix.length === 0 && r.loose === 0;

	const slateCensus = census('slate');
	const parchmentCensus = census('parchment');
	const freeRungs = [...slateCensus, ...parchmentCensus].filter(isFree);

	/** The ramps this section does NOT lay out row by row — Nate asked for the
	 *  two grounds and the glass, which is where the open questions are. Counted
	 *  anyway, so "we censused the palette" cannot quietly mean "we censused most
	 *  of it", and so a ramp that has gone slack shows up without being expanded. */
	const otherRamps = ['night', 'gold', 'ink', 'red'].map((name) => {
		const rows = census(name);
		return { name, total: rows.length, free: rows.filter(isFree).map((r) => r.rung.name) };
	});

	// ── GLASS: what is available, and what a star does to it ───────────────────
	// Glass is the one material whose viability is a MEASUREMENT rather than a
	// preference, so the grid carries the measurement. See --glass-panel in
	// app.css for the law: text on glass is limited by the WORST pixel behind it,
	// and the worst pixel is always a star.

	const rgb = (hex: string): [number, number, number] => {
		const h = hex.trim().replace('#', '');
		const full =
			h.length === 3
				? h
						.split('')
						.map((c) => c + c)
						.join('')
				: h;
		return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
	};
	const lin = (c: number) => {
		const s = c / 255;
		return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	const luminance = (c: [number, number, number]) =>
		0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
	const contrast = (a: [number, number, number], b: [number, number, number]) => {
		const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
		return (hi + 0.05) / (lo + 0.05);
	};
	const composite = (
		fg: [number, number, number],
		alpha: number,
		bg: [number, number, number]
	): [number, number, number] =>
		[0, 1, 2].map((i) => alpha * fg[i] + (1 - alpha) * bg[i]) as [number, number, number];

	/**
	 * The worst pixel: a blank-white star with the tool scrim laid OVER it.
	 * Every glass stop in the system is judged against this and nothing else —
	 * an average backdrop has never been the binding case.
	 *
	 * ⚠⚠ THE SCRIM IS A COLOUR, NOT A MULTIPLIER, and getting that wrong is what
	 * this line exists to prevent recurring. Every star figure in the system was
	 * once computed as `white × (1 − TOOL_DIM)` — the answer you get if the wash
	 * is pure black. --scene-dim is a near-black colour composited over the
	 * scene, so the real worst pixel is `dim·wash + (1 − dim)·white`, which is
	 * lighter, which means LESS contrast. Every published figure was ~0.3–0.4
	 * optimistic in the one direction that matters, and on 2026-08-10 that was
	 * hiding a shipped glass stop sitting at 4.22:1 under a published 4.53.
	 */
	const SCRIM = rgb(tokens.find((t) => t.name === '--scene-dim')?.resolved ?? '#101013');
	const STAR: [number, number, number] = composite([255, 255, 255], 1 - TOOL_DIM, SCRIM);
	/** The dimmer of the two voices a band speaks in — see .band-b's --text
	 *  re-point. If --muted clears the floor, --text has already cleared it. */
	const GLASS_INK = rgb(
		parseContextTokens(appCss, '.ctx-glass').find((t) => t.name === '--muted')?.resolved ??
			'#b7b4ae'
	);

	/**
	 * ⚠ PARSED, NEVER TYPED. These were literals for one day and were stale
	 * within it — the alphas moved .68/.55 → .58/.45 and the grid went on
	 * computing ratios for stops we no longer shipped, which is precisely the
	 * drift this whole section exists to catch. A census that can lie about its
	 * own subject is worse than none.
	 */
	const alphaOf = (name: string) =>
		Number(/\/\s*([\d.]+)\s*\)/.exec(tokens.find((t) => t.name === name)?.resolved ?? '')?.[1]);
	const GLASS_ALPHAS = [
		{ a: alphaOf('--glass-panel'), label: 'panel' },
		{ a: alphaOf('--glass-well'), label: 'well' }
	];
	/** Which rung each shipped stop currently stands on — also parsed, so the
	 *  "shipped" badge can't point at the wrong row. */
	const shippedRung = (name: string) => {
		const v = tokens.find((t) => t.name === name)?.resolved ?? '';
		const m = /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)/.exec(v);
		if (!m) return null;
		const hit = tokens.find(
			(t) => /^--slate-\d+$/.test(t.name) && rgb(t.resolved).every((c, i) => c === Number(m[i + 1]))
		);
		return hit?.name ?? null;
	};
	const SHIPPED_PANEL = shippedRung('--glass-panel');
	const SHIPPED_WELL = shippedRung('--glass-well');

	/** Every slate rung as a candidate glass stop, at both shipped alphas. This
	 *  is the answer to "which glass shades are available to us": glass is a rung
	 *  plus an alpha, so the available set is the ramp times the two alphas — and
	 *  the ratio column is what decides which of them we are allowed to want. */
	const glassGrid = tokens
		.filter((t) => /^--slate-\d+$/.test(t.name))
		.map((rung) => ({
			rung,
			stops: GLASS_ALPHAS.map(({ a, label }) => ({
				alpha: a,
				label,
				css: `rgb(${rgb(rung.resolved).join(' ')} / ${a})`,
				ratio: contrast(GLASS_INK, composite(rgb(rung.resolved), a, STAR)),
				shipped:
					(label === 'panel' && rung.name === SHIPPED_PANEL) ||
					(label === 'well' && rung.name === SHIPPED_WELL)
			}))
		}));

	const sections = [
		['families', 'Families'],
		['palette', 'Palette census'],
		['tokens', 'Tokens'],
		['type', 'Typography'],
		['buttons', 'Buttons'],
		['chips', 'Chips & tabs'],
		['booleans', 'Toggles'],
		['surfaces', 'Surfaces'],
		['insets', 'Inset borders'],
		['marks', 'Marks'],
		['bands', 'Tool bands'],
		['migration', 'Exceptions'],
		['laws', 'Laws']
	];
</script>

<svelte:head>
	<title>Style Reference — critcalc.app</title>
</svelte:head>

{#snippet swatch(t: Token)}
	<div class="sg-swatch">
		{#if isColor(t.resolved)}
			<div class="sg-swatch-chip" style:background={t.resolved}></div>
		{/if}
		<div class="sg-swatch-meta">
			<code class="sg-name">{t.name}</code>
			<span class="sg-val">{t.value}{t.value !== t.resolved ? ` → ${t.resolved}` : ''}</span>
		</div>
	</div>
{/snippet}

{#snippet censusTable(rows: { rung: Token; is: Claim[]; mix: Claim[]; loose: number }[])}
	<div class="sg-census">
		{#each rows as row (row.rung.name)}
			{@const free = row.is.length === 0 && row.mix.length === 0 && row.loose === 0}
			<div class="sg-census-row" class:is-free={free}>
				<div class="sg-census-chip" style:background={row.rung.resolved}></div>
				<div class="sg-census-id">
					<code class="sg-name">{row.rung.name}</code>
					<span class="sg-val">{row.rung.resolved}</span>
				</div>
				<div class="sg-census-claims">
					{#if free}
						<span class="sg-claim sg-claim--free">free</span>
					{/if}
					{#each row.is as c (c.role + c.where)}
						<span class="sg-claim sg-claim--is"
							>{c.role}{#if c.where !== ':root'}<em>{c.where}</em>{/if}</span
						>
					{/each}
					{#each row.mix as c (c.role + c.where)}
						<span class="sg-claim sg-claim--mix"
							>{c.role}{#if c.where !== ':root'}<em>{c.where}</em>{/if}</span
						>
					{/each}
					{#if row.loose > 0}
						<span class="sg-claim sg-claim--loose">{row.loose} in rules</span>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet spec(name: string, notes: string)}
	<div class="sg-spec">
		<code class="sg-name">{name}</code>
		<span class="sg-notes">{notes}</span>
	</div>
{/snippet}

<div class="sg">
	<header class="sg-masthead">
		<h1>Style Reference</h1>
		<p class="sg-lede">
			The central authority for color, type and patterns. Dev-only — this route never ships.
		</p>
		<p class="sg-meta">
			<strong>The labels are load-bearing.</strong>
			<span class="sg-badge sg-badge--live">live</span> is parsed from <code>src/app.css</code> at
			build time and cannot drift ·
			<span class="sg-badge sg-badge--ship">shipped</span> is a real global class in
			<code>app.css</code>, and every per-tool family reads it — so this page cannot show you
			something the code doesn't have, and the code has nowhere else to get its styling from ·
			<span class="sg-badge sg-badge--trial">on trial</span> is shipped and real, but it is a value Nate
			is testing, not a decision that has landed. Expect it to move.
		</p>
		<nav class="sg-nav">
			{#each sections as [id, label] (id)}
				<a href="#{id}">{label}</a>
			{/each}
		</nav>
	</header>

	<!-- ════════════════════════════════════════════════════════════ FAMILIES ══ -->
	<section id="families">
		<h2>The color architecture <span class="sg-badge sg-badge--live">live</span></h2>
		<p class="sg-note">
			<strong>The palette's primary axis is CONTEXT</strong> (Genshin-UI archetype, Nate's values
			2026-08-05) — not a hue family. A context is
			<em>a ground plus its own text and border rules</em>. Components never name a color; they name
			a ROLE (<code>--frame-bg</code> /
			<code>--surface</code> / <code>--surface-raised</code> / <code>--text</code> /
			<code>--muted</code> / <code>--border</code>), a context class re-declares the whole set, and
			everything inside follows. Contexts <strong>nest</strong>: a dark chart well inside a light
			panel re-declares on the inner element and wins by inheritance.
		</p>

		<div class="sg-ctx-pair">
			<div class="sg-fam">
				<h3><code>.ctx-dark</code></h3>
				<p class="sg-note">
					Chart-like panels — timelines, plots, gauge wells — and the bench ribbon. Parchment on
					navy. Also the <strong>root safety net</strong>: a surface that forgets to declare a
					context lands here rather than on an orphan hue.
				</p>
				<div class="sg-swatches">
					{#each ctxDark as t (t.name)}{@render swatch(t)}{/each}
				</div>
			</div>
			<div class="sg-fam">
				<h3><code>.ctx-light</code></h3>
				<p class="sg-note">
					Most other panels, and character cards <em>always</em> (Genshin renders theirs light).
					<strong>The navy ink ramp on parchment</strong> since 2026-08-09 — ⚓ Nate took the
					reference's ink over the warm brown, and his inversion survived the swap intact:
					<code>--muted</code>
					(ink-900) is still <strong>darker</strong> than <code>--text</code> (ink-700), so labels
					still anchor and prose still recedes. The rule was never about hue, only about which rung
					carries which voice. What the swap removes is the <em>second hue</em> — brown and navy were
					fighting each other on one surface. Both rungs measure better than what they replaced (6.18
					/ 8.00 vs 5.32 / 6.9).
				</p>
				<div class="sg-swatches">
					{#each ctxLight as t (t.name)}{@render swatch(t)}{/each}
				</div>
			</div>
			<div class="sg-fam">
				<h3><code>.ctx-glass</code> <span class="sg-badge sg-badge--trial">on trial</span></h3>
				<p class="sg-note">
					<strong>The third material</strong> (2026-08-09) — a dark context that is translucent. Not
					a third palette: ink, accent and every rung come straight from
					<code>.ctx-dark</code>; only the GROUNDS and the LINES differ, because those are the two
					things that have to know whether there is a world behind them. Worn by the
					<strong>furniture</strong> — bands, bench ribbon, band menus. ⚓ Nate: bare-on-the-scene stays
					the default for CONTENT; a tool's content does not go back into a box because glass exists.
				</p>
				<div class="sg-swatches">
					{#each ctxGlass as t (t.name)}{@render swatch(t)}{/each}
				</div>
			</div>
		</div>

		<p class="sg-note">
			<strong>⚠ Three rules the glass material added, each paid for while building it.</strong>
			<strong>Paint <code>--surface</code>, mix against <code>--frame-bg</code></strong> — in the
			opaque contexts those are the same value and the distinction had no teeth; here they diverge
			on purpose, because every <code>color-mix</code>, canvas fill and PNG export still needs a
			real opaque colour to resolve against. (The bench ribbon painted <code>--frame-bg</code> and
			would have come out opaque while everything derived from it behaved otherwise.)
			<strong>There is no light glass</strong> — translucent paper over a near-black world is the
			muddy middle by another route, the one finding that survived the reverted toolbar-translucency
			trial; band B had to stop being <code>ctx-light</code> to wear it.
			<strong>And it is not <code>sheer</code></strong>: that experiment let 2–3% of scene light
			through, which reads as a duller colour. ⚠ The alpha alone does not decide it: glass and the
			wash <strong>multiply</strong>, so what reaches the eye is
			<code>(1 − glass)(1 − TOOL_DIM)</code> — <strong>10.5%</strong> for the panel stop at
			<code>TOOL_DIM</code>
			{TOOL_DIM}. <strong>Move one, check the other</strong>, and this round is the worked example:
			deepening the wash alone took it to 8.0% — the closest we have been to sheer, and glass
			started reading as opaque slate — so the ALPHAS came down after it. If glass ever stops
			reading as glass, this is the number that did it, and a lower glass alpha (never a lower dim)
			is the fix.
		</p>
		<p class="sg-note">
			⚠️ <strong>What sets the floor on a glass stop is a STAR.</strong> Text on glass is limited by
			the worst pixel behind it, never the average, and the worst pixel is always a star — a tiny,
			very bright point. Both stops clear 4.5:1 for <code>--muted</code> (the dimmer of the two band
			voices) against a star <strong>unblurred</strong>: panel 4.74:1, well 5.22:1.
		</p>
		<p class="sg-note sg-note--flag">
			⚠️⚠️ <strong
				>Those figures moved for two reasons on 2026-08-10, and only one is a design change.</strong
			>
			<strong>The measurement was wrong.</strong> Every star figure in the system modelled the worst
			pixel as <code>white × (1 − TOOL_DIM)</code> — the answer you get if the wash is pure black.
			It is a near-black <em>colour</em> laid over the scene, so the real composite is lighter and
			every published figure was ~0.3–0.4 optimistic, in the one direction that matters. Corrected,
			the panel stop as shipped that morning was <strong>4.22:1 — under the floor</strong>,
			published as 4.53. ⚓ Nate's dim change (.65 → .75, <code>#15161a</code> →
			<code>#101013</code>) is what put it back over the floor, so it is a correction as much as a
			preference. The general lesson:
			<strong>an alpha over an unknown ground is only as good as the model of the ground.</strong> The
			grid below now composites the scrim properly.
		</p>
		<p class="sg-note">
			↻ ⚓ Nate 2026-08-10: <strong>both stops also went one rung lighter</strong> — slate-800 →
			slate-700 and slate-950 → slate-900, at the same alphas. The tint moved, not the transparency:
			glass this dark over a dimmed world read as a hole cut in the scene rather than a pane laid on
			it. ⚠️ <strong>There is still no third rung of lift</strong> — slate-600 at the panel alpha is
			4.27:1 even after the dim correction. <a href="#palette">The census</a> computes the whole grid.
		</p>
		<p class="sg-note">
			⛔ <code>--glass-blur</code> is <strong>RETIRED</strong> (⚓ Nate, 2026-08-11 — tuned 6 → 2 →
			1 and then struck). It cost real WebKit frames on Atlas hover-lifts and cross-tool pans and
			bought almost nothing at 1px, and his durable argument is the one to keep:
			<em>we already had translucent elements over the backdrop that never got a blur</em>, so glass
			that blurred only in the bands was not one material. ⚠️
			<strong>The declarations were struck, not zeroed</strong> — <code>backdrop-filter</code> at
			<em>any</em> value still promotes a composited layer that re-reads its backdrop every frame
			the world moves, so <code>blur(0px)</code> would have kept the whole cost. ✅
			<strong>Not one stop had to move</strong>, because the alphas below were always measured
			unblurred. The finding below survives its token, since it decides the answer if anyone
			proposes bringing it back bigger. ⚠️ <strong>A bigger blur BANDS</strong>, and that is a
			mechanism rather than a preference: blurring a backdrop is precisely how you
			<em>manufacture</em> a smooth gradient, and a smooth gradient across a near-black ground in
			8-bit sRGB is the textbook banding case — output levels are far enough apart down here that
			the eye reads the steps as contours. Small radii escape it for the same reason the scene does:
			the starfield and the GL dither leave enough per-pixel variation to act as noise, and noise is
			what breaks a band. So the blur is caught between two floors — big enough to soften a star,
			small enough not to smooth the backdrop into a ramp.
			<em
				>Same family as the hero-card gradient veto, and the reason <code>--scene-dither</code>
				exists.</em
			>
		</p>
		<p class="sg-note">
			⚠️ <strong>Its role changed on the way down, and nothing is allowed to depend on it.</strong>
			At 4–8px a blur <em>solves</em> the star problem above — it spreads the point over its radius,
			the peak collapses, and the effective backdrop becomes the local average, which would let the
			stops go far thinner (even .40 holds 5.37:1 at 4px). At 1–2px a star is barely softened, so
			the alphas carry legibility on their own and are chosen so they do,
			<strong>measured unblurred</strong>. That is what makes probation cheap: removing the blur is
			one line with no knock-on.
			<strong
				>If it goes back up the stops may follow it down; if it goes to 0, they must not.</strong
			>
			Applied by <code>.ctx-glass</code> itself, because it is part of what the material
			<em>is</em>.
		</p>

		<h3>The annotation register <span class="sg-badge sg-badge--ship">shipped</span></h3>
		<p class="sg-note">
			A context owns <em>structure</em>; identity chroma belongs to CONTENT. But not everything on a
			chart is content. An E/Q bar is <strong>the game</strong> — a real ability, element-coloured,
			saturated. A buff window is <strong>our reading of the game</strong>: derived, computed,
			explanatory. This pair is that second thing, and it lives far below the element floor so it
			can never be mistaken for a bar.
		</p>
		<p class="sg-note">
			↻ <strong>Recut 2026-08-11</strong>, replacing <code>--calm</code> / <code>--calm-fill</code>
			(blue) and <code>--debuff</code> (red). The diagnosis was already written down one section
			over: the <code>--ui-value</code> rejection says
			<em
				>“we have no free blue —
				<code>--calm</code> sits ΔH 2.2° from <code>--el-hydro-main</code>”</em
			>, and that measurement was used to veto a <em>proposed</em> blue while the shipped one kept
			its place. A buff bar was a dark hydro bar on a chart made of element hues. Red was better
			separated (ΔH 4.6° off pyro) but still inside element territory — and red/blue encoded a
			valence that isn't there, since a res-shred window is <em>beneficial</em>, just aimed
			elsewhere.
		</p>
		<p class="sg-note">
			⚠️ <strong>The pair is one colour reflected.</strong> Both stops share a lightness and a
			saturation — they are channel-reversals of each other (107 98 75 ↔ 75 98 107) — so only
			TEMPERATURE separates them: warm for ours, cool for theirs. Nothing says better or worse, and
			the two tune as one decision. Elements run s70–s90 against this pair's s20, so
			<strong>chroma, not hue,</strong> is what holds them apart — the only axis the element palette
			leaves free. ⛔ Not gold: <code>--accent</code> already means “a gap you can click” on the
			Team Builder's coverage chips, and one hue cannot mean both “you're missing something” and
			“you have something”. ⚠️ Both must stay LITERALS — the planner's time-scaling envelope mixes
			<code>--buff-fill</code> inside a <code>color-mix</code>, and a mix fed by a mix crashes
			WebKit.
		</p>
		<div class="sg-swatches">
			{#each famAnnotation as t (t.name)}{@render swatch(t)}{/each}
		</div>

		<h3>The accent <span class="sg-badge sg-badge--ship">shipped</span></h3>
		<p class="sg-note">
			✅ <strong>Closed 2026-08-09</strong>, and it had been open since the archetype landed: every
			context BORROWED one of its own inks and the world borrowed <code>--chrome</code> white, with
			the note "a placeholder, not a decision — the system has no accent of its own". It has one
			now, and it is <strong>gold</strong> — Genshin's ornament and selection colour, the one family
			in their palette that exists to do nothing but emphasise. Because every consumer already read
			this one alias, picking it was a <em>value change and not a refactor</em>, which is exactly
			why the alias was worth keeping through three rounds of not knowing the answer.
		</p>
		<p class="sg-note">
			⚠ <strong>The accent is one hue at TWO RUNGS, not one value.</strong>
			<code>--gold-400</code> measures 1.48:1 on parchment — invisible as ink, illegible as a link —
			so <code>.ctx-light</code> takes <code>--gold-700</code> at 4.82:1. Same hue, same family,
			different rung: the accent changes <em>weight</em> when a surface flips, never identity. That is
			the general shape for anything chromatic that has to live in both contexts.
		</p>
		<p class="sg-note">
			⚠ <strong>What stays white:</strong> branding and top-level chrome — the site nav, the
			<code>?</code>/<code>i</code>/gear. ⚓ Nate. Those are the site speaking as itself rather than
			the tool speaking, and <code>--chrome</code> is that voice. <code>.site-chrome</code>
			re-declares the accent
			<em>and its four derived tokens</em> — it sits inside <code>.tool-shell</code> on tool routes,
			so without them the chrome bar would inherit the shell's gold. ⚠ Gold sits ΔH 0.5° from
			<code>--el-geo-main</code>, which is fine and deliberate: geo is identity chroma at C.150, the
			accent is ornament at C.066, so <em>chroma</em> is what separates them. Don't "fix" it by rotating
			off geo — that rotates it off parchment.
		</p>
		<p class="sg-note">
			The two zones are named for the ascend: <strong>in the world</strong> (landing, static pages,
			chrome, meta modals) and <strong>at the crest</strong> (inside a tool). Both panels below are the
			same markup — only the zone differs.
		</p>
		<div class="sg-zones">
			<div class="sg-zone">
				<span class="sg-zone-tag">in the world — landing, static pages, chrome, meta modals</span>
				<div class="sg-stage">
					<button class="chip active">Selected</button>
					<button class="chip">Resting</button>
					<button class="btn btn--primary">PRIMARY</button>
					<a class="sg-demo-link" href="#families">a link</a>
				</div>
			</div>
			<div class="sg-zone" data-zone="tool">
				<span class="sg-zone-tag">at the crest — inside a tool</span>
				<div class="sg-stage">
					<button class="chip active">Selected</button>
					<button class="chip">Resting</button>
					<button class="btn btn--primary">PRIMARY</button>
					<a class="sg-demo-link" href="#families">a link</a>
				</div>
			</div>
		</div>
		<p class="sg-note">
			Portalled popovers (<code>$lib/actions/portal</code>) are appended to
			<code>&lt;body&gt;</code>, which severs <code>.tool-shell</code> ancestry — the action stamps
			<code>data-zone="tool"</code> on the way out so a tool popover keeps its tool accent.
			<code>ChromeModals</code> is mounted outside <code>.tool-shell</code> deliberately, so
			Help/About/Settings read the world's voice in <em>both</em> zones. That is intended: they are meta
			surfaces, not tool surfaces.
		</p>
	</section>

	<!-- ═════════════════════════════════════════════════════════════ PALETTE ══ -->
	<section id="palette">
		<h2>
			Palette census <span class="sg-badge sg-badge--live">live</span>
			<span class="sg-badge sg-badge--trial">deciding</span>
		</h2>
		<p class="sg-note">
			⚓ <strong>Nate 2026-08-10, and this section exists to be argued with.</strong> "We have this
			great palette that we worked to define, but we don't have any settled decisions about how we
			use them." <a href="#tokens">Tokens</a> below lists every rung; this asks the question a
			swatch chart can't — <strong>for each rung, who is already speaking for it.</strong> Which are free,
			which are doing several jobs at once, and which exist only because a ramp is a ramp.
		</p>
		<p class="sg-note">
			Everything here is <strong>computed from <code>app.css</code></strong>, never listed by hand —
			a census maintained by hand is wrong within a week and worse than none, because it still reads
			as authoritative. ⚠️ <code>app.css</code> is the whole search space
			<em>by construction</em>: the layer law (a number means a primitive; no component may name
			one) is grep-enforced in <code>timelineExport.mirror.test.ts</code>, so every consumer of a
			rung is in that one file. Relax that test and this census quietly stops being complete.
		</p>
		<div class="sg-legend">
			<span><b class="sg-claim sg-claim--is">is</b> — a role that resolves TO this rung</span>
			<span
				><b class="sg-claim sg-claim--mix">mix</b> — names it inside an expression and comes out elsewhere;
				the rung is an ingredient</span
			>
			<span
				><b class="sg-claim sg-claim--loose">rule</b> — a direct mention in a rule body, not a role</span
			>
			<span><b class="sg-claim sg-claim--free">free</b> — nothing in the system points here</span>
		</div>

		<h3>Slate — the dark half</h3>
		<p class="sg-note">
			The ground family for both dark contexts and the source of every glass stop. ⚓
			<code>--slate-500</code> is one of Nate's two sampled anchors (the slate element on parchment,
			menu tiles); <code>--slate-800</code> is the other (the dark context's ground).
		</p>
		{@render censusTable(slateCensus)}

		<h3>Parchment — the light half, and the ink on the dark one</h3>
		<p class="sg-note">
			<strong>Parchment doing double duty is the point, not an accident.</strong> It is the light context's
			SURFACE, the dark context's INK, and the source of every hairline on dark — which is why its rungs
			carry more claims each than slate's, and why a change here travels further than it looks like it
			should.
		</p>
		{@render censusTable(parchmentCensus)}

		{#if freeRungs.length > 0}
			<p class="sg-note sg-note--flag">
				<strong>{freeRungs.length} rung{freeRungs.length === 1 ? '' : 's'} unclaimed:</strong>
				{#each freeRungs as f, i (f.rung.name)}<code>{f.rung.name}</code>{i < freeRungs.length - 1
						? ', '
						: ''}{/each}. Unclaimed is <em>not</em> a defect — a ramp is a continuum and a system should
				have somewhere to go when a surface needs one rung lighter. It is a fact to decide against: either
				a rung is being kept as headroom on purpose, or it is a gap nobody noticed.
			</p>
		{/if}

		<p class="sg-note">
			<strong>The other four ramps, counted but not laid out</strong> — the open questions are in
			the two grounds and the glass, and a row-by-row census of a ramp nobody is arguing about is
			noise. They are computed the same way, so a ramp that goes slack surfaces here without being
			expanded:
			{#each otherRamps as r, i (r.name)}<code>--{r.name}-*</code>
				{r.total - r.free.length}/{r.total} claimed{#if r.free.length > 0}<span class="sg-val">
						(free: {r.free.join(', ')})</span
					>{/if}{i < otherRamps.length - 1 ? ' · ' : '.'}{/each}
		</p>

		<h3>Glass — a rung times an alpha</h3>
		<p class="sg-note">
			There is no separate glass ramp and there should not be one: <strong>
				a glass stop IS a slate rung plus an alpha</strong
			>, so the available set is the ramp × the two shipped alphas. Every cell below is a stop we
			could ship today. The two marked <b class="sg-claim sg-claim--is">shipped</b> are what
			<code>--glass-panel</code> and <code>--glass-well</code> currently hold.
		</p>
		<p class="sg-note">
			⚠️ <strong>The ratio column is what decides which of these we are allowed to want.</strong>
			Text on glass is limited by the WORST pixel behind it, never the average, and the worst pixel is
			always a star — a tiny, very bright point. Each figure is
			<code>--muted</code>
			(the dimmer of the two band voices) against that stop composited over a blank-white star dimmed
			by
			<code>TOOL_DIM</code> ({TOOL_DIM}), <strong>unblurred</strong> — which was the rule when the blur
			was on probation (nothing may depend on a probationary property) and is simply the truth now that
			it is retired. That rule is what let the blur be struck on 2026-08-11 without a single stop moving.
			Under 4.5:1 is not a stop we can use at the band voices, whatever it looks like.
		</p>
		<div class="sg-glassgrid sg-stage--world">
			<div class="sg-glassgrid-head">
				<span></span>
				{#each GLASS_ALPHAS as g (g.a)}<span class="sg-val">{g.label} · α {g.a}</span>{/each}
			</div>
			{#each glassGrid as row (row.rung.name)}
				<div class="sg-glassgrid-row">
					<code class="sg-name">{row.rung.name}</code>
					{#each row.stops as s (s.label)}
						<div class="sg-glasscell" style:background={s.css} class:is-shipped={s.shipped}>
							<span class="sg-glasscell-ink">Aa muted</span>
							<span class="sg-glasscell-ratio" class:is-under={s.ratio < 4.5}
								>{s.ratio.toFixed(2)}:1</span
							>
							{#if s.shipped}<span class="sg-claim sg-claim--is">shipped</span>{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>
		<p class="sg-note">
			⚠️ The backdrop here is a <em>stand-in</em> — this page renders on the bare root layout, with
			no scene and no scrim behind it. It is enough to see THROUGH the material, which is all this
			grid has to prove; it is not a preview of the real one.
			<strong>The verdict on any glass stop is Nate's eyes on a tool page, in Safari.</strong>
		</p>
		<p class="sg-note sg-note--flag">
			⛔ <strong>There is no light glass, and this is a law rather than a gap in the grid.</strong>
			Translucent paper over a near-black world is the muddy middle by another route — it was the surviving
			finding of the reverted toolbar-translucency trial ("band B being paper is the constraint"). Anything
			that wants to be glass has to stop being light first, which is why parchment has no row here. ⛔
			And it is not <code>sheer</code>: that experiment was built, measured, shipped and reverted.
			<strong>Don't re-propose either.</strong>
		</p>
	</section>

	<!-- ══════════════════════════════════════════════════════════════ TOKENS ══ -->
	<section id="tokens">
		<h2>Tokens <span class="sg-badge sg-badge--live">live</span></h2>

		<h3>L0 — the ramps</h3>
		<p class="sg-note">
			<strong
				>The law: a <em>number</em> means a primitive, and no component may name one. No number means
				a role, and a role is the only thing a component may name.</strong
			>
			(Enforced — <code>timelineExport.mirror.test.ts</code> fails the build if a
			<code>.svelte</code> reaches past the layer.) Everything below exists to be pointed
			<em>at</em>, by a role or by a context.
		</p>
		<p class="sg-note">
			Genshin Night, 2026-08-09. Fable read a large set of Genshin UI screenshots and found the
			thing this system never had: their shades are not hand-picked hexes, they are
			<strong>a small palette layered with transparency</strong>. Until this round every role here
			was its own hand-picked hex — which is why there was never anywhere to go when a surface
			needed "one rung lighter", why <code>--control-face</code> had to be sampled off a screenshot
			twice, and why two values ended up doing double duty purely to bind the two contexts into one
			system. <code>assets-src/genshin-night.css</code> is the sourced reference.
		</p>
		<p class="sg-note">
			Parchment doing double duty is <em>the point</em>, not an accident: it is the light context's
			SURFACE, the dark context's INK, and the source of every hairline on dark. One family binding
			both halves is what makes the axis a system rather than two palettes. ⚠
			<code>--gold-700</code> is ours, not Fable's — the reference ramp stops at 600, and 600 measures
			3.31:1 on parchment, which cannot carry ink.
		</p>
		{#each ramps as r (r.name)}
			<div class="sg-swatches">
				{#each r.rungs as t (t.name)}{@render swatch(t)}{/each}
			</div>
		{/each}

		<h3>L1 — the glass stops</h3>
		<p class="sg-note">
			The alphas Fable recovered, and the only translucent tokens in the system. Two fates, and the
			split is a law: <strong>glass stays genuinely translucent</strong> (resolving it against a
			ground would produce an opaque colour, which is not glass), while
			<strong>lines resolve opaque</strong>, because a 1px alpha line renders display-dependently —
			so the line stops live in the <code>.ctx-*</code> blocks, mixed against each context's own
			ground, and appear under the surface roles below. ⚠ On <code>.ctx-glass</code> the ground is
			unknown, so <em>there</em> the lines carry alpha too. See
			<a href="#families">the third material</a>.
		</p>
		<div class="sg-swatches">
			{#each glass as t (t.name)}{@render swatch(t)}{/each}
		</div>

		<h3>The world's ramp</h3>
		<p class="sg-note">
			What the site wears <em>outside</em> a panel. <code>--bg</code> is the anchor and is
			deliberately unchanged — it grounds the landing scene, which stays cosmic blue while
			everything else moved onto the archetype. <code>--text</code>/<code>--muted</code> are the
			over-the-scene voice and are <strong>neutral</strong> (C.004): a blue-tinted near-white was
			the last surviving member of the pre-archetype navy family and it fought the warm parchment
			the moment a panel sat beside it. <code>--chrome</code> white is the promoted register above
			them (branding, site chrome, the biggest headers — never body copy or data);
			<code>--bright-ink</code>
			is the dark ink for text sitting ON a bright fill (renamed from <code>--ink</code> in the
			Genshin Night round — ⚓ Nate, it collided with the new ink ramp, and the name states the job
			now, matching <code>--control-ink</code> / <code>--sel-ink</code>);
			<code>--neutral</code> is the universal "inactive / unknown" gray, promoted from the planner's
			local
			<code>--rp-active</code>.
		</p>
		<div class="sg-swatches">
			{#each structure as t (t.name)}{@render swatch(t)}{/each}
		</div>

		<h3>The surface roles — and their safety net</h3>
		<p class="sg-note">
			These four have <strong>no values of their own</strong>; a
			<a href="#families">context</a> supplies them. What you see here is the net — identical to
			<code>.ctx-dark</code>, so a surface that never declared a context still lands inside the
			archetype. <code>--surface</code> is the MODAL role (overlay panes, popovers, tooltips,
			dropdown menus); <code>--surface-raised</code> is an IN-PAGE panel lifting off a ground;
			<code>--frame-bg</code> is a tool frame's own ground; <code>--frame-line</code> is interior
			structure inside a frame, derived from <code>--border</code> toward the ground it sits on (opaque
			mix, never alpha — the compositing law below).
		</p>
		<div class="sg-swatches">
			{#each roleNet as t (t.name)}{@render swatch(t)}{/each}
		</div>

		<h3>Chart ink</h3>
		<p class="sg-note">
			The inside of an instrument: axis labels, tick text, gridlines, rules. Derived from the
			context, so an instrument dropped onto a light panel inverts for free instead of vanishing.
			Not a new idea — the planner has had this pair privately since 2026-08-01 (<code
				>--rp-grid</code
			>/<code>--rp-line</code>); the eight Visualizer instruments hand-rolled the same three jobs as
			literal <code>rgba(255,255,255,α)</code> about seventy times, which is why the charts still
			read cool white inside frames whose every other surface had gone parchment.
			<strong>White is not a member of either context.</strong>
		</p>
		<div class="sg-swatches">
			{#each chartInk as t (t.name)}{@render swatch(t)}{/each}
		</div>

		<h3>UI state colors</h3>
		<p class="sg-note">
			Generic, deliberately boring, <strong>interface-only</strong>. The test:
			<em>is this color describing the game, or describing a consequence to the user's data?</em>
			Game → a domain family. Consequence → here. A UI state color must never appear inside a visualization;
			a domain color must never appear on a control's destructive state. So: debuff bars are
			<code>--debuff-fill</code>, but
			<em>Reset all</em>
			is <code>--ui-danger</code>.
			<br />⚠ These are the loudest values in the system by a wide margin (C.15+ against a structure
			that whispers at C.04), which is the point — and the reason <code>--ui-warning</code> stays on small
			markers and underlines rather than large fills.
		</p>
		<div class="sg-swatches">
			{#each uiStates as t (t.name)}{@render swatch(t)}{/each}
		</div>

		<h3>Geometry <span class="sg-badge sg-badge--trial">on trial</span></h3>
		<p class="sg-note">
			↻ 2026-08-07. The scale was 3/6/9 — a rung for controls, one for panels, one for "large cards"
			— and it spent a decision on every surface for a distinction nobody could name. It collapses
			to <strong>one near-universal radius</strong>, with the other two rungs answering a question
			about the surface's JOB rather than its size:
		</p>
		<ul class="sg-list">
			<li>
				<code>--r-xs</code> — <strong>the tool bands, and nothing else yet.</strong> A corner just
				broken enough not to be sharp; the "slightly dulled box". On trial there because the bands
				are the site's most machined-looking object and the least like a card, so they are the
				honest test of whether 1px reads as anything at all. Knob:
				<code>BAND_RADIUS</code> in <code>src/lib/toolBands.ts</code>.
			</li>
			<li>
				<code>--r-sm</code> — <strong>everything else.</strong> Controls, chips, tabs, panels, cards,
				both tool frames.
			</li>
			<li>
				<code>--r-md</code> — <strong>modals only.</strong> Help / About / Settings and the pages panel.
				A modal is the one surface with no ground to belong to, so it keeps the softer corner that says
				"lifted off" — the same reason it is also the one surface that keeps an edge border.
			</li>
			<li><code>--r-round</code> — genuinely round things: thumbs, dots, capsules.</li>
		</ul>
		<p class="sg-note">
			Still the only legal radii — no <code>0.3rem / 4px / 5px / 7px / 8px / 9px / 11px</code>. (
			<code>--r-lg</code> 9px retired with the re-cut; its three real callers turned out to be two modals
			and one tool surface, which is exactly the split above.)
		</p>
		<div class="sg-radii">
			{#each geometry as t (t.name)}
				<div class="sg-radius">
					<div class="sg-radius-box" style:border-radius={t.resolved}></div>
					<code class="sg-name">{t.name}</code><span class="sg-val">{t.value}</span>
				</div>
			{/each}
		</div>

		<h3>The inset border — ⚓ the bench ribbon's alone, for now</h3>
		<p class="sg-note">
			↻ 2026-08-07. <strong>Genshin puts almost no line on the OUTSIDE of a panel.</strong> The line
			lives inside, set in from the edge, and reads as ornament rather than as the box's own
			outline. The bench ribbon is the site's one example, and it stays the only one:
			<strong>the direction is real, but which surfaces earn it is undecided</strong> — and it may
			not turn out to be the same two-stroke frame the ribbon carries. It was briefly promoted to a
			global and put on both tool frames; that was premature, and it has been taken back out. Every
			other edge border retires to <strong>nothing</strong>.
		</p>
		<p class="sg-note">
			So there are deliberately no tokens for it here. The geometry lives with the object that uses
			it — <code>RIBBON_EDGE</code> · <code>RIBBON_FRAME_BORDER</code> ·
			<code>RIBBON_FRAME_R_TIGHT</code> · <code>RIBBON_FRAME_R_WIDE</code> in
			<code>src/lib/benchBand.svelte.ts</code>, drawn by <code>BenchBand.svelte</code>. When a
			second surface actually wants an inset border, promote the technique then and let that
			surface's needs shape it.
		</p>

		<h3>Motion & interaction surfaces</h3>
		<p class="sg-note">
			Both ladders were <em>already</em> converged in practice — <code>150ms ease</code> appeared 123
			times, and accent 20%/55% were the two spikes across the whole codebase. Naming them is what stops
			the next control inventing a 25th alpha.
		</p>
		<div class="sg-swatches">
			{#each motion as t (t.name)}{@render swatch(t)}{/each}
			{#each interaction as t (t.name)}{@render swatch(t)}{/each}
		</div>

		<h3>Elements</h3>
		<p class="sg-note">
			Three slots each: <strong>main</strong> · <strong>border</strong> (main at 0.5α) ·
			<strong>hi</strong> (main mixed 50/50 white). <code>none</code> deliberately has only
			<code>main</code>. Runtime mirror: <code>src/lib/utils/elementColors.ts</code> — keep in lockstep.
		</p>
		<div class="sg-el-grid">
			{#each ELEMENTS as el (el)}
				{@const slots = elements.filter((t) => t.name.startsWith(`--el-${el}-`))}
				<div class="sg-el-row">
					<span class="sg-el-name">{el}</span>
					<div class="sg-el-slots">
						{#each slots as t (t.name)}
							<div class="sg-el-slot">
								<div class="sg-el-chip" style:background={t.resolved}></div>
								<span class="sg-val">{t.name.replace(`--el-${el}-`, '')}</span>
								<span class="sg-val sg-val--dim">{t.resolved}</span>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<h3>Reaction & aura states</h3>
		<div class="sg-swatches">
			{#each reactions as t (t.name)}{@render swatch(t)}{/each}
		</div>

		<h3>Metrics</h3>
		<div class="sg-swatches">
			{#each metrics as t (t.name)}{@render swatch(t)}{/each}
		</div>

		{#if unclaimed.length}
			<h3>Ungrouped <span class="sg-badge sg-badge--warn">unclassified</span></h3>
			<p class="sg-note">In <code>:root</code> but claimed by no group on this page.</p>
			<div class="sg-swatches">
				{#each unclaimed as t (t.name)}{@render swatch(t)}{/each}
			</div>
		{/if}
	</section>

	<!-- ════════════════════════════════════════════════════════════════ TYPE ══ -->
	<section id="type">
		<h2>Typography <span class="sg-badge sg-badge--live">live</span></h2>

		<h3>Families</h3>
		<div class="sg-stack">
			{#each fonts as t (t.name)}
				<div class="sg-type-row">
					<div class="sg-type-meta">
						<code class="sg-name">{t.name}</code><span class="sg-val">{t.value}</span>
					</div>
					<div class="sg-type-sample" style:font-family={t.resolved}>
						Nahida · Rotation 4.2s · 46.6% CRIT — 0123456789
					</div>
				</div>
			{/each}
		</div>
		<p class="sg-note">
			<strong>Plex Sans is the default.</strong>
			<strong>Bitter = branding, chrome, and every MAIN HEADER</strong> — ↻ ⚓ Nate 2026-08-09,
			reversing the 2026-07-22 sans-everywhere call. The split is no longer branding-vs-content but
			what KIND of heading: a header that names a whole surface is Bitter; a SECTION heading — the
			small tracked uppercase kind with a rule running out of its side, i.e. <code>.kicker</code> —
			stays on the sans. A rule out of the side is the tell.
			<strong>Mono = KQM notation and input fields only</strong>
			(Nate 2026-07-24); readouts stay in the body voice. Never re-declare a font stack locally.
		</p>

		<h3>The three voices</h3>
		<p class="sg-note">
			The old chrome/data split survives the archetype — it just gained a rung and lost its hue
			names. <code>--chrome</code> white sits <em>over the world</em>; inside a panel the context
			supplies the other two, so the same markup speaks parchment-on-navy or brown-on-paper without
			knowing which.
		</p>
		<div class="sg-voices">
			<div class="sg-voice">
				<span class="sg-zone-tag">chrome — over the world</span>
				<p class="sg-voice-sample sg-voice-sample--chrome">
					critcalc.app · Teams · Planner · Visualizers
				</p>
				<span class="sg-val">brand · site nav · the biggest headers — never body copy or data</span>
			</div>
			<div class="sg-voice">
				<span class="sg-zone-tag">label — <code>--muted</code></span>
				<p class="sg-voice-sample sg-voice-sample--label">
					ROSTER · CAN PROVIDE · ELEMENT · Search characters…
				</p>
				<span class="sg-val">kickers · field labels · section heads · resting control text</span>
			</div>
			<div class="sg-voice">
				<span class="sg-zone-tag">prose — <code>--text</code></span>
				<p class="sg-voice-sample sg-voice-sample--cool">
					Nahida · E 5.0s CD · 46.6% CRIT Rate · 12 hits · 4.2s
				</p>
				<span class="sg-val">values · table cells · timeline text · character names · numbers</span>
			</div>
		</div>

		<h3>Size scale</h3>
		<div class="sg-stack">
			{#each sizes as t (t.name)}
				<div class="sg-type-row">
					<div class="sg-type-meta">
						<code class="sg-name">{t.name}</code><span class="sg-val">{t.value}</span>
					</div>
					<div class="sg-type-sample" style:font-size={t.resolved}>
						Crit rate scales the tail, not the mean
					</div>
				</div>
			{/each}
		</div>

		<h3>Weights · tracking · leading</h3>
		<div class="sg-stack">
			{#each weights as t (t.name)}
				<div class="sg-type-row">
					<div class="sg-type-meta">
						<code class="sg-name">{t.name}</code><span class="sg-val">{t.value}</span>
					</div>
					<div class="sg-type-sample" style:font-weight={t.resolved}>
						Crit rate scales the tail, not the mean
					</div>
				</div>
			{/each}
			{#each tracking as t (t.name)}
				<div class="sg-type-row">
					<div class="sg-type-meta">
						<code class="sg-name">{t.name}</code><span class="sg-val">{t.value}</span>
					</div>
					<div class="sg-type-sample sg-type-sample--caps" style:letter-spacing={t.resolved}>
						ROTATION PLANNER
					</div>
				</div>
			{/each}
			{#each leading as t (t.name)}
				<div class="sg-type-row">
					<div class="sg-type-meta">
						<code class="sg-name">{t.name}</code><span class="sg-val">{t.value}</span>
					</div>
					<div class="sg-type-sample sg-type-sample--para" style:line-height={t.resolved}>
						Off-field damage continues while you play someone else. The timeline shows when the
						summon is actually ticking, not just when it exists.
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- ═════════════════════════════════════════════════════════════ BUTTONS ══ -->
	<section id="buttons">
		<h2>
			Buttons <span class="sg-badge sg-badge--ship">shipped</span>
			<span class="sg-badge sg-badge--trial">on trial</span>
		</h2>
		<p class="sg-note">
			One base, two variants, two sizes. <strong>Buttons are verbs, so they shout:</strong> uppercase
			+ wide tracking throughout.
		</p>
		<p class="sg-note">
			↻ 2026-08-07 — <strong>the base button is OPAQUE.</strong> It used to be a transparent ghost
			that only grew a fill on hover, which meant a resting toolbar read as a row of words. The old
			rule "a quiet ghost needs a CLUSTER to read as a control" was a symptom of that, and
			<code>--primary</code> was being reached for as the cure; a plate at rest removes the problem
			rather than routing around it. The base face is
			<strong>per-context</strong> (<code>--btn-face</code>, mixed against that context's own
			ground);
			<code>--primary</code> keeps the ground-agnostic slate above it, so the two rungs stay legible
			as base and promoted. <strong>Prefer opaque going forward</strong> — the two survivors below are
			the whole list, and each is on the page because it earns it.
		</p>

		<div class="sg-specimens">
			<div class="sg-cell">
				<div class="sg-stage">
					<button class="btn">Save</button>
					<button class="btn btn--primary">Load</button>
					<button class="btn is-active">Notes</button>
					<button class="btn" disabled>Undo</button>
				</div>
				{@render spec(
					'.btn · --primary · .is-active · :disabled',
					'3px · 0.32/0.65rem · fs-sm · UPPER · ls-wide · opaque --btn-face at rest, --btn-face-hover on hover. .is-active mixes --sel-fill INTO the face rather than replacing it — a selected button that swapped its plate for a translucent accent came out quieter than its neighbours'
				)}
			</div>

			<div class="sg-cell">
				<div class="sg-stage">
					<button class="btn btn--danger"><Mark name="delete" /> Delete</button>
					<button class="btn btn--danger is-confirming"><Mark name="warn" /> Sure?</button>
					<div class="segment">
						<button class="btn is-active">My roster</button>
						<button class="btn">All C0</button>
					</div>
				</div>
				{@render spec(
					'the two surviving ghosts',
					'--danger stays text-only until hover: a destructive action must not sit on screen looking pressable. ↻ 2026-08-07: the ARMED half wears the warning mark — the one place a mark buys safety rather than decoration. .segment > .btn stays transparent because the recessed track behind it IS the affordance — opaque plates would fill the track in and leave three buttons in a row with no group'
				)}
			</div>

			<div class="sg-cell">
				<div class="sg-stage">
					<button class="btn btn--sm"><Mark name="image" />Copy PNG</button>
					<button class="btn btn--sm btn--primary"><Mark name="share" />Export</button>
					<button class="btn btn--sm btn--icon"><Mark name="minus" /></button>
					<button class="btn btn--sm btn--icon"><Mark name="plus" /></button>
					<button class="btn btn--sm btn--icon"><Mark name="close" /></button>
				</div>
				{@render spec(
					'.btn--sm · .btn--icon',
					'dense toolbars — fs-xs, tighter padding. --icon is square, for glyph-only targets; it still needs an aria-label, since a mark is always decorative'
				)}
			</div>

			<div class="sg-cell">
				<div class="sg-stage">
					<button class="btn sg-focus-demo">Focus ring</button>
					<span class="sg-val sg-val--dim">one ring for every control, no exceptions</span>
				</div>
				{@render spec(
					':focus-visible',
					'2px accent outline at 2px offset, on .btn / .chip / .tab / .toggle / .check alike'
				)}
			</div>
		</div>
	</section>

	<!-- ═══════════════════════════════════════════════════════ CHIPS & TABS ══ -->
	<section id="chips">
		<h2>Chips & tabs <span class="sg-badge sg-badge--ship">shipped</span></h2>
		<p class="sg-note">
			The selected state was already converged across four independent files — accent 20% fill + 55%
			inset ring — so it becomes <code>--sel-fill</code> / <code>--sel-ring</code> and every control
			shares it. What varies is <strong>voice</strong>: a chip that names a game concept or a
			character is sentence case; a chip that is an instrument setting shouts like a button.
		</p>

		<div class="sg-specimens">
			<div class="sg-cell">
				<div class="sg-stage">
					<button class="chip">Healer</button>
					<button class="chip active">Shielder</button>
					<button class="chip chip--element active" style:--chip-color="var(--el-pyro-main)"
						>Pyro</button
					>
					<button class="chip chip--element" style:--chip-color="var(--el-hydro-main)">Hydro</button
					>
					<button class="chip">Off-field DMG</button>
				</div>
				{@render spec(
					'.chip · .active · .chip--element',
					'CONTENT voice — sentence case, ls-mid, fs-sm. Names, roles, capabilities, elements'
				)}
			</div>

			<div class="sg-cell">
				<div class="sg-stage">
					<button class="chip chip--control">Melt</button>
					<button class="chip chip--control active">Vaporize</button>
					<button class="chip chip--control">Crit <span class="chip-sub">rate</span></button>
				</div>
				{@render spec(
					'.chip--control · .chip-sub',
					'INSTRUMENT voice — uppercase, ls-wide, fs-md. Instrument settings and modes'
				)}
			</div>

			<div class="sg-cell">
				<div class="sg-stage">
					{#each ['pyro', 'hydro', 'cryo', 'electro'] as el, i (el)}
						<button
							class="chip chip--icon"
							class:active={i === 1}
							style:--chip-color="var(--el-{el}-main)"
							aria-label={el}
						>
							<span class="sg-el-dot" style:background="var(--el-{el}-main)"></span>
						</button>
					{/each}
				</div>
				{@render spec(
					'.chip--icon',
					'6px · square · glyph-only. Rests at 0.35 opacity, active lifts to 1 + element ring'
				)}
			</div>

			<div class="sg-cell">
				<div class="sg-stage">
					<div class="tab tab--lg active">Roster</div>
					<div class="tab tab--lg">Atlas</div>
					<div class="tab tab--lg">Compare</div>
				</div>
				<div class="sg-stage">
					<div class="tab tab--closeable active">
						Vape Hu Tao <button class="tab-close" aria-label="close"
							><Mark name="close" size={11} /></button
						>
					</div>
					<div class="tab tab--closeable">
						Aggravate <button class="tab-close" aria-label="close"
							><Mark name="close" size={11} /></button
						>
					</div>
					<button class="btn btn--sm btn--icon"><Mark name="plus" /></button>
				</div>
				{@render spec(
					'.tab · .active · .tab--lg · .tab--closeable',
					'ONE tab system, body face — drops Bitter and the 5px radius. Document tabs (band A) are the base size and the whole live population; --lg is a promoted rung with NO consumer since the Team Builder’s Atlas/Roster/Compare row became a parchment nav plate (2026-08-09)'
				)}
			</div>
		</div>
	</section>

	<!-- ═════════════════════════════════════════════════════════════ TOGGLES ══ -->
	<section id="booleans">
		<h2>Toggles <span class="sg-badge sg-badge--ship">shipped</span></h2>
		<p class="sg-note">
			Split by meaning. A <strong>switch</strong> means <em>persistent preference</em> — it stays on
			after you leave. A <strong>checkbox</strong> means <em>view option</em> — scoped to what
			you're looking at. Both are drawn to match: same 3px radius, same geometry, same focus ring.
			The checkbox is a native <code>input</code> with <code>appearance: none</code>, so keyboard
			and screen-reader behavior stay free.
		</p>
		<p class="sg-note">
			Their "on" colors differ on purpose: <strong>selection is accent everywhere</strong> (chips,
			tabs, buttons, checkboxes), while a switch reports a <em>state of the world</em> and so speaks
			<code>--ui-positive</code>.
		</p>

		<div class="sg-specimens">
			<div class="sg-cell">
				<div class="sg-stage sg-stage--column">
					<label class="toggle">
						<input type="checkbox" />
						<span class="toggle-track"><span class="toggle-thumb"></span></span>
						<span class="toggle-label">New outfits</span>
					</label>
					<label class="toggle">
						<input type="checkbox" checked />
						<span class="toggle-track"><span class="toggle-thumb"></span></span>
						<span class="toggle-label">Aether portraits</span>
					</label>
				</div>
				{@render spec(
					'.toggle',
					'persistent preference · 3px track + 3px thumb · on = --ui-positive · cream thumb, not white'
				)}
			</div>

			<div class="sg-cell">
				<div class="sg-stage sg-stage--column">
					<label class="check">
						<input type="checkbox" checked />
						<span class="check-box"></span>
						<span>Show variance band</span>
					</label>
					<label class="check">
						<input type="checkbox" />
						<span class="check-box"></span>
						<span>Include 4★ pity</span>
					</label>
					<p class="note">Drawn to match the switch — same radius, same box, same ring.</p>
				</div>
				{@render spec(
					'.check',
					'view option · native input, appearance:none · on = --sel-fill + --sel-ring, accent mark'
				)}
			</div>
		</div>
	</section>

	<!-- ═══════════════════════════════════════════════════ SURFACES & TEXT ══ -->
	<section id="surfaces">
		<h2>
			Surfaces <span class="sg-badge sg-badge--ship">shipped</span>
			<span class="sg-badge sg-badge--trial">on trial</span>
		</h2>
		<p class="sg-note">
			↻ 2026-08-07 — <strong>edge borders are retiring, and nothing replaces them.</strong> A
			surface is separated by being a different GROUND. Two things drove it: Genshin draws almost
			nothing on the outside of a panel, and a surface that disappears without its outline was never
			lifting off anything to begin with. <strong>The one deliberate survivor is the modal</strong>,
			which floats with no ground to belong to and so needs its own outline — and keeps the softer
			<code>--r-md</code> corner for the same reason.
		</p>
		<p class="sg-note">
			⚓ The <a href="#tokens">inset border</a> is <strong>not</strong> the replacement, and is not a
			pattern here yet — it belongs to the bench ribbon alone until a surface earns it.
		</p>

		<div class="sg-specimens">
			<div class="sg-cell sg-cell--wide">
				<div class="sg-stage sg-stage--block">
					<div class="panel">
						<h3 class="kicker">Reaction</h3>
						<div class="chips">
							<button class="chip chip--control active">Melt</button>
							<button class="chip chip--control">Vaporize</button>
						</div>
						<p class="note">
							Gauge units decay on their own clock — the instrument shows when, not whether.
						</p>
					</div>
				</div>
				{@render spec(
					'.panel · .kicker · .chips · .note',
					'3px · --surface-raised · NO border (2026-08-07). The kicker is --muted (context label voice), trailing rule --muted @22%. A .panel is also a .ctx-light — declaring one paints the other'
				)}
			</div>

			<div class="sg-cell">
				<div class="sg-stage sg-stage--column sg-stage--block">
					<h3 class="kicker">Section kicker</h3>
					<h2 class="title">Panel or card title</h2>
					<p class="subtitle">a subtitle, capitalized</p>
					<p class="note">
						A note: one class, fs-md, relaxed leading, muted, NO margin — the container spaces it.
						Replaces seven per-instrument copies plus the Team Builder captions.
					</p>
				</div>
				{@render spec(
					'.kicker · .title · .subtitle · .note',
					'kicker = --muted UPPER ls-widest + rule, and BODY FACE — a section heading, not a main header · title = --text, Bitter (⚓ Nate 2026-08-09) · note = --muted, it is data-adjacent'
				)}
			</div>

			<div class="sg-cell">
				<div class="sg-stage sg-stage--column sg-stage--block">
					<span class="field-label">Search roster</span>
					<input
						class="field"
						type="text"
						placeholder="Type a name or capability…"
						value="Nahida"
					/>
					<p class="note">
						Input text is chrome, not data — the label above it is the anchored voice, the value
						inside it is prose.
					</p>
				</div>
				{@render spec(
					'.field · .field-label',
					'input text = --text · placeholder = --muted · label = --muted UPPER (contexts, 2026-08-05)'
				)}
			</div>

			<div class="sg-cell sg-cell--wide">
				<div class="sg-stage sg-stage--block">
					<div class="frame sg-frame-demo">chart interior</div>
				</div>
				{@render spec(
					'.frame',
					'--frame-bg, no border (2026-08-07). ⚠️ This class covers TWO scales: a chart interior (here) is a well cut into a lighter frame, and a tool frame is the surface everything else sits on — neither had anything to be outlined against. NEVER animate a paint property on either (retired 2026-07-10, perf)'
				)}
			</div>
		</div>
	</section>

	<!-- ══════════════════════════════════════════════════════ INSET BORDERS ══ -->
	<section id="insets">
		<h2>Inset borders <span class="sg-badge sg-badge--trial">on trial</span></h2>
		<p class="sg-note">
			Genshin puts almost no line on the <em>outside</em> of a panel — the line lives inside, set in
			from the edge, reading as ornament rather than as the box's own outline. That is why our
			<a href="#laws">edge borders could retire to nothing</a> without the surfaces falling apart.
		</p>
		<p class="sg-note">
			⚓ <strong>Two, and this is a closed set.</strong> Nate picked <code>--plain</code> and
			<code>--double</code> and discarded three others (corners, notched, capped) in the 2026-08-09
			feedback round — "we'll stick with these two for now, and if I feel the need for more I'll
			come up with a concept and propose it". <strong>Don't propose additions.</strong> Strokes are
			<strong>2px</strong> (⚓ Nate), which also puts the family on the rule rung the system already
			had: <em>rules are 2px, section dividers 1px</em>. ⚠️ A host may override that with
			<code>--inset-stroke</code> — a per-box knob, <em>not</em> a second rung: 2px reads as a rule round
			a panel and as a border round a 40px plate. One caller so far, the Team Builder's selected navigation
			item at 1.5px (⚓ Nate 2026-08-10).
		</p>
		<p class="sg-note">
			⚠️ <strong
				><code>--double</code> is for OPAQUE surfaces only — never on
				<code>.ctx-glass</code>.</strong
			>
			⚓ Nate observed it: the two strokes CROSS, and on glass the line colour carries alpha (that context's
			lines have to — the ground behind them is unknown). Alpha composites twice at each crossing, so
			the frame reads as four dark smudges instead of two arcs. Nothing warns you; it is correct CSS doing
			exactly what it was asked. The glass sample below is kept deliberately, as the evidence.
		</p>

		<div class="sg-grid sg-grid--insets">
			{#each INSETS as { mod, blurb, glassOk } (mod)}
				<div class="sg-cell">
					<div class="sg-stage sg-stage--block">
						<div class="sg-inset-demo ctx-dark inset inset--{mod}">
							<span>ctx-dark — opaque</span>
						</div>
					</div>
					<div class="sg-stage sg-stage--block sg-stage--world">
						<div class="sg-inset-demo ctx-glass inset inset--{mod}">
							<span>{glassOk ? 'ctx-glass — fine' : 'ctx-glass — ⚠ overlaps'}</span>
						</div>
					</div>
					{@render spec(`.inset.inset--${mod}`, blurb)}
				</div>
			{/each}
		</div>
	</section>

	<!-- ═══════════════════════════════════════════════════════════════ MARKS ══ -->
	<section id="marks">
		<h2>Marks <span class="sg-badge sg-badge--ship">shipped</span></h2>
		<p class="sg-note">
			Control glyphs come from <strong>Lucide</strong> (ISC) — but nothing from Lucide ships. It is
			a
			<strong>devDependency feeding a generator</strong>:
			<code>scripts/generate-marks.mjs</code> → <code>src/lib/marks.generated.ts</code> →
			<code>$lib/components/Mark.svelte</code>, wired into <code>predev</code>/<code>prebuild</code
			>. The site's standing pattern (same shape as the element icons and the character index).
			<strong>The only API is <code>&lt;Mark name="…" /&gt;</code></strong>; the
			<code>MarkName</code> union is generated, so a typo is a type error rather than an empty box.
		</p>
		<div class="sg-mark-grid">
			{#each MARKS as m (m)}
				<div class="sg-mark"><Mark name={m} /><span class="sg-val">{m}</span></div>
			{/each}
		</div>
		<div class="sg-laws sg-laws--tight">
			<div class="sg-law">
				<h3>Rules</h3>
				<ul>
					<li>
						<strong>Marks are geometry, never a unicode character.</strong> Engines pick different
						fallback faces at different sizes, so <code>↑ ⤴ ⧉ ✓ ×</code> in a control is a cross-engine
						rendering bug waiting to happen. This is the reason the set exists.
					</li>
					<li>
						<strong>Add a mark by naming the JOB, not the picture.</strong> One line in the
						generator's <code>MARKS</code> map — our semantic name → Lucide's export (<code
							>uncurated: 'CircleSlash2'</code
						>). The indirection is the point: call sites say what the control DOES, so re-picking a
						glyph is a one-line change — and <code>forward</code>/<code>back</code> beat
						<code>arrowRight</code>/<code>arrowLeft</code> for exactly that reason.
					</li>
					<li>
						<strong>Keep the set small.</strong> 2,021 icons is an invitation to over-icon a restrained
						design language. Add on demand, never speculatively.
					</li>
					<li>
						<strong>Marks are decorative WITHOUT EXCEPTION</strong> — <code>aria-hidden</code>, ink
						from <code>currentColor</code>, so disabled and active states come free. A glyph-only
						control needs its own label; the mark can never be it.
					</li>
					<li>
						⛔ <strong>Do not install <code>@lucide/svelte</code></strong>, and do not hand-copy
						SVGs off the site. Both were considered and rejected — a component per icon is hundreds
						of instances at roster scale, and a downloaded file has no provenance, no version and no
						licence trail. <code>src/lib/marks.test.ts</code> guards the generated artifact against all
						of it.
					</li>
					<li>
						⛔ <strong>Not for the element icons or the brand mark.</strong> Those are build
						artifacts of the <code>--el-*</code> tokens and of <code>build-logo</code>.
					</li>
					<li>
						<code>MARK_SIZE</code> (14) and <code>MARK_STROKE</code> (1.9) are the two knobs, in
						Lucide's 24-unit grid — landed ink is <code>stroke × size / 24</code>. ⚠ Tune against
						<strong>Chrome</strong> (the sub-pixel law).
					</li>
					<li>
						<strong>The sweep is DONE</strong> (↻ 2026-08-07). The ~40 control glyphs that were
						still typeset — the saved bank's <code>&amp;#xD7;</code>/<code>&amp;#x270E;</code>
						entities, the instrument picker's <code>▾ ⇄ ●</code>, the Team Builder's
						<code>✓ ✗ ✕ → ★ ●</code>, the not-yet-curated <code>∅</code>, and a
						<strong>color-emoji 🔒</strong> that ignored <code>currentColor</code> outright — all
						render through <code>&lt;Mark&gt;</code> now.
					</li>
					<li>
						⚠ <strong>A mark has to survive its own SIZE, and its NEIGHBOURS.</strong> Two failure
						modes that cost three rounds on one glyph (⚓ NATE, the constellation gate).
						<em>Size:</em>
						at the 10–11px these chips run, anything with a small enclosed counter closes up — a padlock's
						shackle lands at ~2px and no padlock can resolve. Prefer ONE path, no counters.
						<em>Neighbours:</em>
						the mark shares a card with <code>uncurated</code>,
						<code>star</code> and <code>check</code>, so a base-shape-plus-modifier (<code
							>StarX</code
						>, <code>Ban</code>) collapses into the base shape it borrowed. Test in a real row, not
						in isolation.
					</li>
					<li>
						<strong>Prefer the game's vocabulary to software's.</strong> <code>gated</code> is
						<code>Astroid</code> — a four-cusped star, i.e. a constellation node — and it is named
						<code>gated</code>, not <code>locked</code>, on purpose. A constellation gate involves
						no permission and no secrecy; you are simply not at C6 yet. The padlock was a borrowed
						metaphor that was also unreadable, and <code>LockOpen</code> reads more clearly while
						saying the opposite of the truth.
						<strong>Legibility bought with a lie is not a trade.</strong>
					</li>
					<li>
						⚠ <strong>Three things stay typeset ON PURPOSE.</strong> Rarity stars (<code>5★</code>
						is Genshin's own notation, and it sits inline with a numeral); the <code>?</code> on a
						maybe-coverage chip (a hedge, and <code>?</code> is a real glyph in the body face); and
						every <code>× · → ⁄</code> in prose and formulas. The law is about code points the text
						font doesn't cover — <strong>not about punctuation</strong>. A blind find-and-replace
						mangles copy.
					</li>
					<li>
						<strong>Two marks are deliberately NOT in the set.</strong>
						<code>CloseMark</code> is Nate's filled disc-with-a-hole artwork for the heavy overlay
						dismiss — a different role from the inline stroke <code>close</code>, not a duplicate of
						it. The planner's notes badge is two-fill artwork rather than a
						<code>currentColor</code> stroke.
					</li>
					<li>
						<code>scripts/probe-marks.mjs</code> is the guard.
						<code>marks.test.ts</code> proves the SET is coherent; it cannot prove the site stopped typesetting,
						and a static grep can't tell a control glyph from prose. The probe walks the RENDERED text
						of every tool surface — it caught one the grep missed.
					</li>
				</ul>
			</div>
		</div>
	</section>

	<!-- ═══════════════════════════════════════════════════════════════ BANDS ══ -->
	<section id="bands">
		<h2>Tool bands <span class="sg-badge sg-badge--ship">shipped</span></h2>
		<p class="sg-note">
			Every tool renders a <code>ToolStack</code>: <strong>two rows</strong> over its surface, free
			of the tool frame, with the bench ribbon proud of the whole stack. ↻ ⚓ Nate, over three days
			— first they stopped abutting, then
			<strong>band A stopped being a band at all</strong>, and then band B stopped being one
			wherever a tool splits it. What is left of "a band" is a height and a gap: both rows are runs
			of glass PLATES standing on the scene, on <em>one</em> glass stop — band B's darker well
			retired with the tier it was marking. ⚠️ <code>BAND_CTRL_H</code> (36px, icon-only controls
			excepted) is a <strong>band B</strong> number: its plates fill their row, band A's take their
			natural height and its ROW IS THAT HEIGHT — <code>BAND_A_H</code> is 27px because a
			<code>.tab</code> measures 26.72 (⚓ Nate 2026-08-10, undoing the one-evening match: band A
			filling a 36px row made the DOCUMENT row read as the heavier of the two, which is backwards,
			and with no ground under them there was nothing for the extra 9px to be air <em>inside</em>).
			⚠️ Re-measure it if a band A control's type or padding moves — the row has no slack left. The
			only rail left is the one a tool asks for by filling
			<code>bandBCenter</code>, and that rail is a plate like the others. Geometry knobs:
			<code>src/lib/toolBands.ts</code>. Document flows:
			<code>src/lib/documentBar.svelte.ts</code>.
		</p>
		<div class="sg-band-demo">
			<div class="sg-band sg-band--a" style:height="{BAND_A_H}px">
				<span class="sg-zone-tag">band A — NO GROUND, {BAND_A_H}px = its tallest control</span>
				<span class="sg-val">the DOCUMENT · controls are the glass</span>
			</div>
			<div class="sg-band-gap" style:height="{BAND_GAP}px">
				<span class="sg-val">{BAND_GAP}px — BAND_GAP, the gap BETWEEN BUTTONS (⚓ Nate)</span>
			</div>
			<div
				class="sg-band sg-band--b"
				style:height="{BAND_B_H}px"
				style:border-radius="{BAND_RADIUS}px"
			>
				<span class="sg-zone-tag">band B — {BAND_B_H}px, rail only when split</span>
				<span class="sg-val">the VIEW</span>
			</div>
			<div class="sg-band-gap" style:height="{BAND_STACK_GAP}px">
				<span class="sg-val">{BAND_STACK_GAP}px of bare scene, then the tool surface</span>
			</div>
		</div>
		<div class="sg-laws sg-laws--tight">
			<div class="sg-law">
				<h3>Rules</h3>
				<ul>
					<li>
						<strong>THE TAXONOMY IS THE POINT.</strong> Which band a control goes in is a rule, not
						a preference. <strong>Band A = the DOCUMENT</strong> — which working team am I editing,
						and what can I do to it whole (tabs · save · load · share · reset). It is
						<em>identical</em> in the planner and the Team Builder, because they edit ONE document.
						<strong>Band B = the VIEW</strong> — what am I looking at inside this tool, and how (planner
						zoom/notes, TB Atlas/Roster/Compare + con lens, Viz per-tile pickers).
					</li>
					<li>
						<strong>The bands travel with their tool</strong> — but the reason changed. It used to
						be structural: A and B abutted, so they were one object, and a screen-locked A over a
						world-locked B would tear at their shared seam on every tool→tool leg. ↻ 2026-08-09
						<strong>there is no shared seam any more</strong>, so that constraint is GONE — if band
						A is ever to become the screen-locked HUD beside the ribbon, the split is what unblocks
						it. They still travel together today; nothing has asked them not to. Continuity across
						the fade stays the ribbon's job.
					</li>
					<li>
						<strong>Both bands are <code>ctx-glass</code></strong> (↻ 2026-08-09). Band B's ground
						has now been three things: the beige <code>--ribbon</code> (a misreading — that token is
						a darker band laid ON a light fill, not a whole toolbar), then the light context's
						paper, now glass. It had no choice on the last one:
						<strong>there is no light glass.</strong> The A/B distinction never depended on the grounds
						anyway, and depends on them even less now that the two are separate objects with air between
						them.
					</li>
					<li>
						<strong>Band B re-points <code>--text</code> at <code>--muted</code>.</strong> It is a CONTROL
						band — labels and buttons, never prose — so everything in it speaks the label voice by default.
						Prose belongs in the surface below.
					</li>
					<li>
						<strong
							>The beige selected-plate pilot lives on <code>.band-a .tab.active</code>.</strong
						>
						That is exactly Genshin's idiom: the bright plate marks the selected row on the DARK strip.
						Band B selects with the ordinary ring.
					</li>
					<li>
						<strong>Each band rounds its own four corners</strong> (↻ 2026-08-09). When they
						abutted, the stack clipped its children and only the four <em>outer</em> corners
						rounded, with the seam square. Split, there is nothing to clip and both boxes round
						fully — which gives
						<code>--r-xs</code> twice the evidence while it is on trial.
					</li>
					<li>
						<code>BandMenu</code> is <strong>portalled</strong>, and the reason has now changed
						twice. It was the stack's clip; then it was <code>backdrop-filter</code>, which mints a
						<em>containing block</em> as well as a stacking context, so an absolutely-positioned
						menu inside a glass band resolved against the band instead of the page. ⛔ That second
						reason expired on 2026-08-11 with the blur, and
						<strong>the constraint went with it</strong> — glass no longer contains anything. The
						menu still portals because it has to clear the band's bounds regardless, which was
						always the first reason. ⚠ Worth knowing as a general shape:
						<em>a hazard can outlive the property that caused it in the comments alone</em>.
					</li>
				</ul>
			</div>
		</div>
	</section>

	<!-- ═══════════════════════════════════════════════════════════ MIGRATION ══ -->
	<section id="migration">
		<h2>The exceptions</h2>
		<p class="sg-note">
			<code>app.css</code> is the only place a button, chip, tab, toggle, note or field is defined,
			and components keep locals only for geometry or semantics a global cannot know. These are the
			things that deliberately <strong>did not</strong> join it — kept on the page so the line stays visible,
			and so nobody re-opens the argument every six months:
		</p>
		<ul class="sg-list">
			<li>
				<strong>Whole-card click targets</strong> (<code>.cc-main</code>, <code>.rolecard</code>,
				<code>.ar-slot</code>), <strong>chrome hit targets</strong> (bare by design),
				<strong>dropdown menu items</strong>, the <strong>value wheel</strong>, the
				<strong>row-edge delete zone</strong>, <strong>element-tinted pills</strong> and the meta
				overlay's <strong>filled close disc</strong>. These are their own idioms, not text buttons
				wearing a different skin — forcing them onto <code>.btn</code> would lose meaning, not gain consistency.
			</li>
			<li>
				<strong
					>The bench ribbon's inset border is not a global, and its numbers are not tokens.</strong
				>
				They live in <code>benchBand.svelte.ts</code> because the ribbon's chrome participates in
				LAYOUT arithmetic — <code>RIBBON_CHROME</code> feeds <code>RIBBON_W</code>, which the tool
				docks and the Team Builder's zone widths are measured against, and a CSS variable cannot be
				read by that math. It also has exactly one consumer, and ⚓ Nate has not decided which other
				surfaces earn an inset border or what form theirs takes.
			</li>
			<li>
				<code>RIBBON_FRAME_R_WIDE</code> (30) is deliberately NOT in the <code>--r-*</code> scale. That
				scale is the BOX vocabulary — "what shape is this container's corner". 30 answers a different
				question: it is an ornamental arc that only means anything inside the two-stroke technique, and
				dropping it into the scale would invite it onto a card.
			</li>
		</ul>
		<p class="sg-note">
			<strong>The lesson that produced most of this list:</strong> a CSS-selector scan under-counts.
			The original migration table was built that way and missed every button that had no named
			family — ~25 genuine one-off text buttons appeared in no plan at all. Audit the
			<code>&lt;button&gt;</code> elements directly, and beware two false-positive traps:
			<code>&lt;button&gt;</code> inside HTML comments, and regexes that stop at the
			<code>&gt;</code> in an <code>=&gt;</code> arrow.
		</p>
	</section>

	<!-- ══════════════════════════════════════════════════════════════ LAWS ══ -->
	<section id="laws">
		<h2>Laws</h2>
		<p class="sg-note">
			Rules no swatch can show. These are the ones most often lost between sessions — they were paid
			for in real bugs and real rejections.
		</p>

		<div class="sg-laws">
			<div class="sg-law">
				<h3>Color</h3>
				<ul>
					<li>
						<strong>A context class comes with its ground.</strong> Declaring
						<code>.ctx-light</code> re-points <em>every</em> role token, including
						<code>--text</code> — so a component that declares a context and then paints no
						background renders that context's ink straight onto whatever it happens to be sitting
						on. The bench slot card did exactly this and put warm-brown text on the ribbon's navy at
						<strong>2.33:1</strong>, the worst contrast in the app, while
						<code>--frame-bg</code> resolved to paper and blew its inset pills out to near-white. If you
						cannot paint the ground, inherit the context — don't claim one.
					</li>
					<li>
						<strong>Re-declaring <code>--accent</code> is never enough.</strong> A custom property
						whose value contains <code>var()</code> is substituted at computed-value time
						<em>on the element where it is declared</em>, and the RESULT inherits. So
						<code>--sel-fill</code> declared at <code>:root</code> bakes in root's accent and keeps
						it inside every context no matter what that context says. Every accent-derived token has
						to be re-declared alongside it — in <code>.tool-shell</code> AND both
						<code>.ctx-*</code> blocks. This was a live bug (chips silently turned gold).
					</li>
					<li>
						<strong>The promoted control ink is per-context.</strong> Chips, tabs and buttons rest
						on
						<code>--muted</code> and promote on hover/selection to <code>--ink-active</code>, NOT to
						<code>--text</code>. The light context deliberately inverts its two inks (labels anchor,
						prose recedes), so <code>--text</code> is the <em>lighter</em> of them there and every
						selected chip came out weaker than the unselected ones beside it. Each context points
						<code>--ink-active</code> at whichever of its inks is most emphatic.
					</li>
					<li>
						<strong>White is not a member of either context.</strong> An
						<code>rgba(255,255,255,α)</code> is the tell that a surface was authored before the
						archetype. Chart interiors take the <a href="#tokens"><code>--chart-*</code></a> rungs;
						control fills take <code>--fill-rest</code>/<code>--fill-hover</code>, which tint with
						the GROUND. The exceptions are legitimate and narrow: ink sitting ON a saturated element
						bar, and <code>rgba(0,0,0,α)</code> drop shadows.
					</li>
					<li>
						<strong
							>debuff-fill = enemy-facing · buff-fill = ally-facing · chrome = the over-world white.</strong
						>
						Don't cross them. <code>--accent</code> is zoned and never leaves its zone — don't hard-code
						a context's accent in the world (landing scene, static pages).
					</li>
					<li>
						<strong>Structure whispers; content carries the chroma.</strong> A ground is a near-neutral
						LIT by the scene (C .010–.040) — real chroma on it white-balances every element bar sitting
						on it by simultaneous contrast, and fights the border. Identity chroma belongs to CONTENT
						— the element bars. ↻ 2026-08-11 the buff/debuff fills left that sentence: they are ANNOTATION,
						not content, and now sit at s20 precisely so they cannot be mistaken for an element. Nothing
						structural gets more saturated than Genshin's own UI would allow, and nothing annotative gets
						as saturated as content.
					</li>
					<li>
						UI state colors never appear inside a visualization; domain colors never appear on a
						control's destructive/positive state.
					</li>
					<li>
						<strong>Three grays, three questions — keep them apart.</strong>
						<code>--neutral</code> <code>#768093</code> answers "this UI is inactive" (structure).
						<code>--el-none-main</code> <code>#6a7080</code> answers "this thing has no element"
						(domain, reached through <code>elementPalette()</code>) and is deliberately
						<em>flatter</em> — RotationTimeline's <code>BLANK_PAL</code> comment records that
						choice. <code>physical</code> <code>#9ea4b3</code> answers "real damage, not elemental". They
						look alike because absence looks like absence; they are not interchangeable.
					</li>
					<li>
						Translucent element variants are <em>not</em> new hues: use the <code>border</code>
						slot, or <code>color-mix</code> main toward the surface.
					</li>
					<li>
						<code>app.css</code> and <code>src/lib/utils/elementColors.ts</code> are a mirrored pair.
					</li>
					<li>
						<strong>Hierarchy must survive grayscale.</strong> Lightness is the skeleton, hue is the
						clothing — if a surface reads as mud with hue removed, its structure is riding on hue.
						<kbd>Cmd/Ctrl+Shift+G</kbd> in dev toggles a grayscale overlay on every route (root layout;
						ships nothing to prod). Run it before approving any color work.
					</li>
					<li>
						<strong>Bright fill carries dark ink and no halo.</strong> A full-strength element fill
						(the castFill pills, summon bars, gauge badges) takes <code>--ink</code>, flat — the
						label halo is the crutch for white-on-mid, not a universal. Dim continuations and ghost
						tracks keep white + halo. Genshin's Lv-chip idiom; GaugeInstrument was the precedent.
					</li>
					<li>
						<strong
							>The lightness contract: content-bearing fills earn ΔL over their ground; recessive
							fills drop chroma.</strong
						>
						A fill the eye should find (buff strips, dim continuations) sits measurably lighter than
						<code>--frame-bg</code>; a fill that is structure (ghost CD tracks) recedes by
						desaturating, so grayscale never mistakes it for content. The ratios are knobs in
						<code>src/lib/timeline/barMix.ts</code>, shared by the DOM and the PNG exporter;
						<code>timelineExport.mirror.test.ts</code> makes mirror drift a test failure.
					</li>
					<li>
						<strong>Selection is accent — except at the very top of the ladder.</strong> A top-level
						NAVIGATION selects with <code>--sel-surface</code> (beige) +
						<code>--sel-ink</code>: the selected thing is the screen's one bright plate, Genshin's
						Stygian selected-row idiom. Two consumers — the Team Builder's Atlas/Roster/Compare
						plate and the Help chapter nav. Everywhere else selection remains
						<code>--sel-fill</code>/<code>--sel-ring</code>. NO beige panels — the pilot's extent is
						a deliberate knob. ↻ ⚓ Nate 2026-08-10: it left the DOCUMENT TABS, where every
						neighbour had become glass and the one lit plate pulled the eye off the tool; those
						select by DENSITY now — an opaque slate among panes. (Amends 2026-08-01: gray AND beige
						are both freely available to this site; the old "beige belongs to the sister site" split
						is retired.)
					</li>
				</ul>
			</div>

			<div class="sg-law">
				<h3>Type</h3>
				<ul>
					<li>Plex Sans is the default for everything unless a rule below says otherwise.</li>
					<li>
						<strong>Bitter = branding, chrome-level nav, and MAIN HEADERS</strong> (⚓ Nate
						2026-08-09). A SECTION heading — small, tracked, uppercase, with a rule running out of
						its side (<code>.kicker</code>) — stays on the sans. The rule is the tell.
					</li>
					<li>
						<strong>Mono = KQM notation and input fields only</strong> (Nate 2026-07-24).
					</li>
					<li>
						<strong>Three voices, and they don't swap.</strong> <code>--chrome</code> white is
						branding, site chrome and the biggest headers — never body copy or data. Inside a panel,
						<code>--text</code> is prose and <code>--muted</code> is the label voice (kickers, field labels,
						section heads). Both come from the context, never from a literal.
					</li>
					<li>
						<strong>Verbs shout, nouns don't.</strong> Buttons and instrument controls are uppercase +
						ls-wide; content chips are sentence case.
					</li>
					<li>Never re-declare a font stack locally.</li>
					<li>
						<strong>Centering a label centers its BOX; what you see is its INK.</strong> The two
						differ by the glyphs' side bearings, and by any
						<code>letter-spacing</code>, which lands after the <em>last</em> glyph too and shifts a
						short label off-center. So: no tracking on a value in a round control, and a lone digit
						is already perfect (tabular figures are drawn centered in a uniform advance — which is
						why the picker pips never needed a nudge, while <code>C0</code> did). A letter beside a
						digit needs a measured optical nudge; the bench card's is
						<code>text-indent: -0.07em</code>.
					</li>
					<li>
						⛔ <strong><code>text-box-trim</code> is not the answer to that</strong> — checked 2026-08-06.
						Both engines support it and it really does shrink a text box (10px → 6.98 at our size), but
						Plex Sans already seats cap-height ink on center under ordinary centering (ascent − cap ≈
						descent), so it moves the box and not the ink; measured ON vs OFF, byte-identical. It also
						can't reach a grid or flex control's text at all — it isn't inherited, and the text there
						lives in an anonymous item.
					</li>
				</ul>
			</div>

			<div class="sg-law">
				<h3>Chrome &amp; controls</h3>
				<ul>
					<li>
						<strong>No hover glows anywhere.</strong> Hover reads as <code>fill-opacity</code> on a
						glyph, a fill, or a tinted edge — never a bloom. (The one surviving
						<code>0 0 7px</code> is <code>.cv-roll-crit</code>, which marks crit rolls: data
						emphasis, not chrome.)
					</li>
					<li>
						<strong>Button marks are 28px</strong> and built as a disc with the glyph as an evenodd
						HOLE, so one path takes <code>currentColor</code>. The notification mark is 12px.
					</li>
					<li>
						<strong>Slider knobs are flat.</strong> Their analogue is the toggle thumb — also a
						marker in a track — which is flat and shares <code>--knob</code>, the context's dim
						voice.
					</li>
					<li>
						<strong>Rules are 2px, section dividers 1px.</strong> The kicker rule and the ornamental HRule
						share a weight.
					</li>
					<li>
						<strong>Buttons are opaque</strong> (↻ 2026-08-07). Two rungs, both solid:
						<code>--btn-face</code> for the base, the ground-agnostic <code>--control-face</code>
						slate for <code>--primary</code>. The old rule this replaces — "a quiet ghost needs a
						CLUSTER to read as a control, so a lone action takes --primary" — was a workaround for
						the ghost, and it went with it. <code>--primary</code> now means
						<em>promoted</em>, not <em>lonely</em>. The only ghosts left are
						<code>.btn--danger</code> and <code>.segment > .btn</code>, and each is documented at
						its rule.
					</li>
				</ul>
			</div>

			<div class="sg-law">
				<h3>Safari / WebKit</h3>
				<ul>
					<li>
						<strong>No filters.</strong> Dimming is <code>fill-opacity</code> on the glyph, never
						<code>opacity</code> on the element — element opacity creates a WebKit transparency layer,
						which shows as 1px jitter under parallax.
					</li>
					<li>
						<strong>Alpha lives in the PAINT.</strong> The rule above is not about glyphs, it is
						about element <code>opacity</code> — the trigger, <em>wherever it sits</em>. The bench
						cards dimmed their loadout icons with it and the icons danced on hover; moving the dim
						to an overlay that carried <code>opacity</code> danced identically. What fixed it was a
						translucent <em>background-color</em> (a
						<code>color-mix(… , transparent)</code> gradient, transitioned as color). Any subtree at opacity
						&lt; 1 rasterizes at rounded device coordinates, and anything transform-placed from a measured
						rect sits at fractional ones.
					</li>
					<li>
						<strong>Text sits on whole pixels here, boxes don't.</strong> WebKit snaps glyphs to
						integer positions on both axes while boxes keep sub-pixel ones, so a label's offset
						<em>inside</em> its own control varies with wherever that control lands — measured as a
						full pixel of range across one pixel of container offset, where Chrome held constant.
						Tune optical nudges against <strong>Chrome</strong> (its offset is a property of the
						font and the CSS); treat a Safari reading as true only for the position it was taken at.
						Method and numbers: <code>scripts/probe-ink-centering.mjs</code>.
					</li>
					<li><strong>No tiled backgrounds on timeline bars</strong> (2026-07-18 veto).</li>
					<li>
						<strong>No gradient inside the hero card plate</strong> — it bands. Grain is not the fix.
						Hover raises the toplight, never the fill's opacity.
					</li>
					<li>
						No per-item <code>&lt;img&gt;</code> on roster-scale grids until ~Safari 27 — use
						<code>background-image</code>.
					</li>
				</ul>
			</div>

			<div class="sg-law">
				<h3>Motion & perf</h3>
				<ul>
					<li>
						One interaction duration: <code>--t-quick</code>. Scene and tool-slide transitions own
						their own timing.
					</li>
					<li>
						Never animate a paint property (border-color, gradient angle) on a persistent surface —
						it re-rasterizes the tool layer forever. Animate <code>opacity</code> on a stacked static
						ring instead.
					</li>
					<li>Everything interactive honours <code>prefers-reduced-motion</code>.</li>
					<li>New persistent scene animations must suspend on tool routes.</li>
				</ul>
			</div>

			<div class="sg-law">
				<h3>Structure</h3>
				<ul>
					<li>
						Modals are for <strong>meta</strong> only (settings, help, static pages). Every
						<strong>tool</strong> feature is a docked panel or an in-frame overlay.
					</li>
					<li>
						In-frame overlays can't paint above the fixed chrome strip (<code>.tool-main</code> is
						its own stacking context below it) — portal to <code>body</code>.
					</li>
					<li>
						<strong>An edge border retires to NOTHING</strong> (↻ 2026-08-07). Genshin puts almost
						no stroke on the outside of a panel, and the site follows: the ground does the
						separating. The one deliberate survivor is the <strong>modal</strong>, which floats with
						no ground to belong to. Test before reaching for a border:
						<em>would this surface disappear without it?</em> If yes, the ground is wrong — fix that
						instead. ⚓ The <strong>inset</strong> border (a line set in from the edge, Genshin's
						real idiom) is the likely eventual answer for select surfaces, but it is
						<strong>the bench ribbon's alone for now</strong>. Don't reach for it, and don't assume
						the ribbon's exact two-stroke frame is the form it will take.
					</li>
					<li>
						<strong>One <code>.frame</code> per tool, and one grammar site-wide:</strong>
						<strong>bench LEFT · work CENTER · filters RIGHT.</strong> The Team Builder and the
						Rotation Planner are each a single full-screen <code>.frame</code> below the band stack,
						holding zones rather than nested islands. Zones separate with a 1px interior hairline
						over the frame's own fill — never a gap, never a second box. Nothing inside a frame
						wears <code>.panel</code>; the kickers do the separating.
					</li>
					<li>
						<strong>The bench is not a zone either tool owns.</strong> It is the layout-level ribbon
						(<code>BenchBand</code>, rendered once by the tools layout outside the page layers),
						docked over a <code>[data-bench-anchor]</code> gutter each benched tool reserves. Both
						tools dock it at the <em>same</em> screen spot, so across a tool navigation it persists opaque
						and motionless — that persistence is the continuity. The Visualizers have no dock, and the
						ribbon fades in place.
					</li>
					<li>
						<strong>The bench ribbon is TALLER than the tool beside it</strong> (↻ 2026-08-06). Each
						dock stretches with its frame — top/bottom insets, never a height — and the strip stands
						<code>RIBBON_OVERHANG_Y</code> (12px) proud at <em>both</em> ends, so it always reads as
						the object in front. Consequences to respect: nothing may live in the column beneath it
						(the planner's lane names moved into their own lanes; the Team Builder's team readout
						moved to the work zone's top strip), the cards stay aligned to the planner's track
						groups via
						<code>RIBBON_HEAD</code>, and the tail below the fourth card is <em>deliberately</em> empty
						— a container slightly taller than its contents.
					</li>
					<li>
						<strong>The ribbon's frame is TWO strokes on one box</strong> — same inset, same color,
						differing only in corner radius (<code>RIBBON_FRAME_R_TIGHT</code> /
						<code>RIBBON_FRAME_R_WIDE</code>), so the straight runs coincide and the wide arc cuts
						across the tight corner. That "extra corner inside" is the Genshin frame idiom; the
						ground's own edge (<code>RIBBON_RADIUS</code>) is the third line and carries no stroke
						of its own.
					</li>
					<li>
						<strong
							>A tool surface is a MAIN box and an optional ASIDE box, never one box with a sidebar
							zone.</strong
						>
						<code>ToolColumns</code> owns the pair (<code>ASIDE_W</code> · <code>COLUMN_GAP</code>
						in
						<code>$lib/toolColumns</code>); the bands above span both. The aside is always the DARK
						column and holds ONE occupant at a time, which each tool decides in a single expression
						— the planner's notes, or its Source's filters covering them; the Team Builder's filters
						on the Roster only. The filter column itself is <code>CharacterFilterRail</code> and the
						tiles are <code>CharacterGrid</code>: two siblings that meet on the consumer's
						<code>filters</code> object, not one component with a private layout. Per-tool sizing
						rides the <code>--cg-*</code> knobs; don't fork either.
					</li>
					<li>
						<strong
							>Viewport-fit is the Team Builder and the Visualizers — the planner page-scrolls.</strong
						>
						For the fitted two, height is
						<code>calc(100svh − --chrome-h − --tool-pad-top − --tool-pad-bottom)</code>, less the
						band stack; their zones scroll internally, and a bounded scroll needs
						<code>min-height: 0</code> at every flex level below it — break one and the column grows
						instead of scrolling. ⚠ It must be that calc and not
						<code>height: 100%</code>: a percentage needs a DEFINITE parent height, and
						<code>.tool-main</code> is <code>min-height: 100%</code> so page-scrolling tools can
						grow — so a percentage silently falls back to <code>auto</code> and the tool renders at
						full content height while the SHELL scrolls, which looks nearly identical until you
						notice the filter column scrolling away with the tiles. <code>ToolStack</code>'s
						<code>fill</code> owns the calc; the Visualizers computes its own because it fits only above
						1024px. The planner is the deliberate exception: its frame is a flex column of rows that grows
						with the rotation. The benches are side-locked at every width; narrow viewports are the mobile
						pass's problem, not a breakpoint's.
					</li>
					<li>
						<strong>The Visualizers are an N-slot workspace, not a page of panels.</strong> Every
						instrument mounts once and hides with <code>display: none</code> when unslotted, so its
						state survives swaps; the lineup size is viewport capacity capped by the reader's
						preference. The <em>tile</em> owns <code>container-name: instrument</code> — instruments
						size to the slot they're in, never to the viewport — and their control panels flow in
						<code>.panels</code> multicolumn.
					</li>
					<li>
						⚠️ <strong><code>.frame</code> means two different things.</strong> In the Planner and
						Team Builder it is the tool's outer frame; in every Visualizers instrument it is a
						<em>chart interior</em> (the specimen above). Same class, same border-and-ground job, two
						scales — read the context before reusing it.
					</li>
					<li>
						Control glyphs are <strong>geometry</strong>, never a unicode character and never
						<code>&lt;text&gt;</code> — see <a href="#marks">Marks</a>.
					</li>
					<li>The brand string is <code>critcalc.app</code> — the full domain, everywhere.</li>
					<li>
						Only four radii exist: <code>--r-xs/sm/md/round</code>. No exceptions — see
						<a href="#tokens">Geometry</a> for which is which.
					</li>
				</ul>
			</div>

			<div class="sg-law">
				<h3>Writing</h3>
				<ul>
					<li>
						<strong>US English everywhere</strong> (Nate 2026-07-27) — color not colour, visualize
						not visualise, center not centre, gray not grey, behavior not behaviour. Applies to UI
						copy, comments, docs and commit messages alike. The repo was swept clean on the same
						day; the only survivor is <code>GGanalysis</code>, which is a library's actual name.
					</li>
					<li>Terminology follows KQM (Keqing Mains) standards throughout.</li>
					<li>
						The brand string is <code>critcalc.app</code> — the full domain, everywhere.
					</li>
				</ul>
			</div>

			<div class="sg-law sg-law--open">
				<h3>Open</h3>
				<ul>
					<li>
						<strong><code>--ui-positive</code> vs anemo.</strong> The gradient's own teal (<code
							>#4ecca3</code
						>) is within 5° of <code>--el-anemo-main</code> — effectively the same color — so
						positive was pushed to h157. Revert to <code>#4ecca3</code> if the adjacency turns out not
						to matter in practice.
					</li>
					<li>
						<strong>There is no <code>--el-physical-main</code>.</strong> The element palette
						declares <code>none</code> in CSS, but <code>physical</code> (<code>#9ea4b3</code>)
						exists only in the TS mirror — so a stylesheet can't reach it. Either add the variable
						or document that physical is runtime-only.
					</li>
					<li>
						<strong>Where does the accent actually get SPENT?</strong> (The accent story itself is
						<a href="#families">closed</a> — it is gold.) Picking the colour was a value change;
						deciding which affordances earn it is not. Right now every
						<code>--accent</code>-derived selection ring, hover wash and link in the app turned gold
						at once, which is more gold than Genshin spends on a screen. Ration is the open half.
					</li>
					<li>
						⛔ <strong>CLOSED: the shaped scrim.</strong> Built (ellipse, then a soft rounded box
						from two intersected 1-D falloffs) and scrapped by ⚓ Nate after driving it — "it
						doesn't really buy us anything meaningful compared to a plain dim".
						<strong>Don't rebuild it.</strong>
						The coupling it was solving — glass and bare text wanting opposite things from one wash —
						dissolves once the glass stops are chosen to clear their own contrast floor: two constraints,
						two knobs, no geometry. <code>TOOL_DIM</code> is one uniform number again (.65; the floor
						is .60, set by stars).
					</li>
					<li>
						⛔ <strong>CLOSED: <code>--glass-blur</code> is RETIRED.</strong> ⚓ Nate 2026-08-11,
						ending the probation it had been on since it was built — it cost WebKit frames on
						hover-lifts and pans, and at 1px changed almost nothing.
						<strong>Struck, not zeroed</strong>: <code>backdrop-filter</code> at any value keeps the composited
						layer and the backdrop read-back, so a 0 would have paid the whole bill for none of the effect.
						Not one stop moved, because nothing was allowed to depend on it — which is the case for building
						probationary properties that way.
					</li>
					<li>
						<strong>Do frozen stars read as texture, or as dirt?</strong> Still open, and now asked
						of a <em>sharp</em> starfield: with the blur retired the bands show the frozen stars as points,
						with nothing softening them. Nothing measurable decides this one.
					</li>
					<li>
						<strong>Modals are still opaque.</strong> They mount outside <code>.tool-shell</code>
						and float over the <em>undimmed</em> landing as well as the crest, where glass would be nearly
						transparent. Deliberately left out of the glass round; they may want a material of their own.
					</li>
					<li>
						<strong>The element icons are tuned for dark grounds.</strong> They are a build artifact
						of the
						<code>--el-*</code> tokens (never hand-recolored), and on <code>.ctx-light</code> panels
						they read pale. Same class of problem as the artifact piece glyphs, which were solved by
						giving them the ground-agnostic <code>--control-face</code> chip — the icons need their own
						answer.
					</li>
					<li>
						<strong>Meta overlays read the WORLD's voice, not a context.</strong> Help / About /
						Settings mount outside <code>.tool-shell</code> deliberately, so they inherit the root net
						— the dark context's grounds carrying the world's neutral ink. It coheres, but it is inherited
						rather than chosen. Genshin's own menus are light; flipping them is one class.
					</li>
					<li>
						<strong>The border sweep is unfinished.</strong> The pattern layer is done —
						<code>.panel</code>, <code>.frame</code> and the Atlas cards. Roughly
						<strong>70 bespoke edge borders</strong> remain in components, concentrated in
						<code>RotationTimeline</code> (28), <code>SavedNotationsOverlay</code> (8) and
						<code>CharacterCard</code> (6). Most should simply go; several are structural hairlines that
						are a different thing entirely and should stay.
					</li>
					<li>
						<strong>Which surfaces earn an inset border?</strong> There are
						<a href="#insets">five to choose from</a> now instead of one, which turns the question from
						"invent something" into "pick". Nothing wears one yet except the bench ribbon.
					</li>
					<li>
						<strong>Is 1px a rung, or is it 3px?</strong> <code>--r-xs</code> exists to answer that on
						the bands. If the dulled box doesn't read as anything, the token should go rather than drift
						onto a second surface.
					</li>
				</ul>
			</div>
		</div>
	</section>
</div>

<style>
	/* ══════════════════════════════════════════════════════════════════════════
	   PAGE CHROME — prefixed sg- so it can never collide with a product pattern.
	   Direct-child selectors only: a loose `.sg h2`/`.sg h3` out-specifies
	   specimen classes (0,1,1 vs 0,1,0) and silently restyles the very thing
	   being documented. Learned the hard way on the first build.
	   ══════════════════════════════════════════════════════════════════════ */

	.sg {
		max-width: 1180px;
		margin: 0 auto;
		padding: 2.5rem 2rem 6rem;
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-lg);
	}

	.sg-masthead h1 {
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}

	.sg-lede {
		margin: 0.4rem 0 0;
		font-size: var(--fs-xl);
		color: var(--muted);
	}

	.sg-meta {
		margin: 1rem 0 0;
		max-width: 82ch;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--muted);
	}

	.sg-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 1.6rem 0 0;
		position: sticky;
		top: 0;
		z-index: 5;
		padding: 0.6rem 0;
		background: var(--bg);
		border-bottom: 1px solid var(--border);
	}

	.sg-nav a {
		padding: 0.25rem 0.6rem;
		border-radius: var(--r-sm);
		background: var(--fill-rest);
		color: var(--muted);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
	}

	.sg-nav a:hover {
		background: var(--sel-fill);
		color: var(--text);
	}

	.sg section {
		margin: 3.5rem 0 0;
		scroll-margin-top: 4rem;
	}

	.sg > section > h2 {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		font-size: var(--fs-4xl);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-tight);
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
		color: var(--text);
	}

	.sg > section > h3,
	.sg-fam h3,
	.sg-law h3 {
		margin: 2rem 0 0.7rem;
		font-size: var(--fs-md);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text);
	}

	.sg-fam h3:first-child,
	.sg-law h3:first-child {
		margin-top: 0;
	}

	.sg-badge {
		padding: 0.15rem 0.45rem;
		border-radius: var(--r-sm);
		background: rgba(255, 255, 255, 0.08);
		color: var(--muted);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}

	.sg-badge--live {
		background: var(--ui-positive-soft);
		color: var(--ui-positive);
	}

	.sg-badge--ship {
		background: var(--sel-fill);
		color: var(--text);
	}

	.sg-badge--warn {
		background: var(--ui-danger-soft);
		color: var(--ui-danger);
	}

	.sg-badge--trial {
		background: var(--ui-warning-soft);
		color: var(--ui-warning);
	}

	/* Prose lists in the doc chrome. Same voice as .sg-note, which is what most
	   of these were before they earned bullets. */
	.sg-list {
		max-width: 82ch;
		margin: 0 0 1.1rem;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.5rem;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--muted);
	}

	.sg-note {
		max-width: 82ch;
		margin: 0 0 1.1rem;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--muted);
	}

	.sg code {
		font-family: var(--font-mono);
		font-size: 0.92em;
	}

	.sg-name {
		color: var(--text);
	}

	.sg-val {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
	}

	.sg-val--dim {
		opacity: 0.6;
	}

	/* ── contexts / zones ─────────────────────────────────────────────────── */

	/* The two contexts stand SIDE BY SIDE, always — the page's job here is to
	   let you read one against the other, so this deliberately does not collapse
	   to one column the way the old family grid did. */
	.sg-ctx-pair {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
		gap: 0.8rem;
	}

	.sg-fam {
		padding: 1rem 1.2rem;
		border-radius: var(--r-sm);
		background: var(--surface);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.sg-fam .sg-swatches {
		grid-template-columns: 1fr;
	}

	.sg-zones {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
		gap: 0.8rem;
		margin-bottom: 1.1rem;
	}

	.sg-zone {
		padding: 0.9rem 1rem;
		border-radius: var(--r-sm);
		background: var(--surface);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.sg-zone-tag {
		display: block;
		margin-bottom: 0.6rem;
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}

	.sg-demo-link {
		color: var(--accent);
		font-size: var(--fs-md);
		border-bottom: 1px solid var(--accent);
	}

	/* ── voices ───────────────────────────────────────────────────────────── */

	.sg-voices {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
		gap: 0.8rem;
	}

	.sg-voice {
		padding: 0.9rem 1rem;
		border-radius: var(--r-sm);
		background: var(--surface);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.sg-voice-sample {
		margin: 0 0 0.5rem;
		font-size: var(--fs-xl);
	}

	.sg-voice-sample--chrome {
		color: var(--chrome);
	}

	.sg-voice-sample--label {
		color: var(--muted);
	}

	.sg-voice-sample--cool {
		color: var(--text);
	}

	/* ── the palette census ───────────────────────────────────────────────── */

	/* A note that carries a verdict rather than an explanation — the unclaimed
	   list and the two ⛔ laws. Ruled on the left rather than filled: a second
	   filled box inside a section reads as a different KIND of content, and
	   these are the same kind said louder. */
	.sg-note--flag {
		padding-left: 0.9rem;
		border-left: 2px solid var(--frame-line);
	}

	.sg-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.2rem;
		margin-bottom: 1rem;
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	.sg-census {
		display: grid;
		gap: 2px;
		margin-bottom: 1.4rem;
	}

	/* One rung per row, and the rows are deliberately DENSE: the census is read
	   by scanning down a ramp for the sparse rows, not by reading any one entry.
	   Grid rather than flex so the three columns line up across every row and
	   the claim runs start on one edge. */
	.sg-census-row {
		display: grid;
		grid-template-columns: 40px 12.5rem 1fr;
		align-items: center;
		gap: 0.8rem;
		padding: 0.35rem 0.6rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}

	/* A free rung says so by going quiet, not by lighting up. It is a fact to
	   decide against, not a defect to fix — the ⛔ styling that would imply. */
	.sg-census-row.is-free {
		background: none;
		box-shadow: inset 0 0 0 1px var(--frame-line-quiet);
	}

	.sg-census-chip {
		width: 40px;
		height: 26px;
		border-radius: var(--r-sm);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
	}

	.sg-census-id {
		display: grid;
		gap: 0.05rem;
		min-width: 0;
	}

	.sg-census-claims {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		min-width: 0;
	}

	.sg-claim {
		padding: 0.1rem 0.4rem;
		border-radius: var(--r-round);
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		font-weight: var(--fw-normal);
		white-space: nowrap;
	}
	/* The context suffix rides the claim rather than sitting beside it — a role
	   and the context it was declared in are one fact. */
	.sg-claim em {
		opacity: 0.6;
		font-style: normal;
	}
	.sg-claim em::before {
		content: ' ';
	}
	.sg-claim--is {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		color: var(--ink-active);
	}
	.sg-claim--mix {
		background: var(--fill-rest);
		color: var(--muted);
	}
	/* ↻ 2026-08-11: was --calm, which is retired — and it was a DOMAIN token on a
	   piece of this page's own tooling chrome, i.e. the exact crossing the § Laws
	   list two screens up forbids. A loose census match is a soft flag about our
	   data, so it takes the UI-state family it always should have. */
	.sg-claim--loose {
		background: color-mix(in srgb, var(--ui-warning) 18%, transparent);
		color: var(--ui-warning);
	}
	.sg-claim--free {
		background: none;
		box-shadow: inset 0 0 0 1px var(--frame-line);
		color: var(--muted);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}

	/* ── the glass grid ───────────────────────────────────────────────────── */

	.sg-glassgrid {
		display: grid;
		gap: 4px;
		padding: 0.9rem;
		border-radius: var(--r-md);
		margin-bottom: 1.1rem;
	}

	.sg-glassgrid-head,
	.sg-glassgrid-row {
		display: grid;
		grid-template-columns: 8.5rem repeat(2, 1fr);
		align-items: center;
		gap: 4px;
	}

	.sg-glassgrid-head {
		padding-bottom: 0.2rem;
	}
	.sg-glassgrid-head .sg-val {
		padding-left: 0.6rem;
	}

	/* ⚠ NO backdrop-filter on these cells, and that is not an oversight: the
	   grid is showing the STOPS, and a blur would let a cell borrow legibility
	   the shipped rule is not allowed to depend on. That was written while
	   --glass-blur was on probation; it retired 2026-08-11 and the grid was
	   already showing the truth. */
	.sg-glasscell {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.6rem;
		border-radius: var(--r-sm);
	}

	.sg-glasscell.is-shipped {
		box-shadow: inset 0 0 0 1px var(--line-edge);
	}

	.sg-glasscell-ink {
		flex: 1;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		/* The literal is the point — this specimen must read the glass context's
		   --muted whatever surface it is dropped on, and the page around it is
		   .ctx-dark. It is the value under test, not a role reference. */
		color: #b7b4ae;
	}

	.sg-glasscell-ratio {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: #b7b4ae;
	}
	/* ↻ 2026-08-11: was --debuff. Same crossing as .sg-claim--loose — "this ratio
	   is under the floor" is a consequence to OUR data, not a game fact, so it is
	   --ui-danger and always was. */
	.sg-glasscell-ratio.is-under {
		color: var(--ui-danger);
		font-weight: var(--fw-semibold);
	}

	/* ── swatches ─────────────────────────────────────────────────────────── */

	.sg-swatches {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 0.6rem;
	}

	.sg-swatch {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem;
		border-radius: var(--r-md);
		background: var(--surface);
	}

	.sg-swatch-chip {
		width: 36px;
		height: 36px;
		flex: none;
		border-radius: var(--r-sm);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
	}

	.sg-swatch-meta {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}

	.sg-el-grid {
		display: grid;
		gap: 0.4rem;
	}

	.sg-el-row {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		align-items: center;
		gap: 0.8rem;
		padding: 0.4rem 0.6rem;
		border-radius: var(--r-md);
		background: var(--surface);
	}

	.sg-el-name {
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		font-size: var(--fs-sm);
	}

	.sg-el-slots {
		display: flex;
		gap: 1.2rem;
		flex-wrap: wrap;
	}

	.sg-el-slot {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.sg-el-chip {
		width: 26px;
		height: 26px;
		border-radius: var(--r-sm);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
	}

	.sg-el-dot {
		width: 13px;
		height: 13px;
		border-radius: var(--r-round);
	}

	/* ── type rows ────────────────────────────────────────────────────────── */

	.sg-stack {
		display: grid;
		gap: 0.35rem;
	}

	.sg-type-row {
		display: grid;
		grid-template-columns: 15rem 1fr;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 0.7rem;
		border-radius: var(--r-md);
		background: var(--surface);
	}

	.sg-type-meta {
		display: grid;
		gap: 0.1rem;
	}

	.sg-type-sample--caps {
		text-transform: uppercase;
		font-weight: var(--fw-semibold);
	}

	.sg-type-sample--para {
		max-width: 52ch;
		font-size: var(--fs-md);
	}

	/* ── radii ────────────────────────────────────────────────────────────── */

	.sg-radii {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 0.4rem;
	}

	.sg-radius {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 0.6rem;
		border-radius: var(--r-md);
		background: var(--surface);
	}

	.sg-radius-box {
		width: 40px;
		height: 40px;
		flex: none;
		background: var(--sel-fill);
		box-shadow: inset 0 0 0 1px var(--sel-ring);
	}

	/* ── specimen cells ───────────────────────────────────────────────────── */

	.sg-specimens {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(440px, 1fr));
		gap: 0.8rem;
	}

	.sg-cell {
		display: grid;
		grid-template-rows: 1fr auto;
		gap: 0.7rem;
		padding: 1rem;
		border-radius: var(--r-sm);
		background: var(--surface);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.sg-cell--wide {
		grid-column: 1 / -1;
	}

	.sg-stage {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: var(--r-md);
		background: var(--bg);
	}

	.sg-stage + .sg-stage {
		margin-top: 0.5rem;
	}

	.sg-stage--column {
		flex-direction: column;
		align-items: flex-start;
	}

	.sg-stage--block {
		display: block;
	}

	/* A stand-in for the world behind a glass surface. This page renders on the
	   bare root layout — no scene, no scrim — so the translucency would read as
	   "slightly wrong navy" with nothing behind it. The gradient plus a sparse
	   dot field is enough to see THROUGH the material, which is the only thing
	   this stage has to prove. It is not a preview of the real backdrop. */
	.sg-stage--world {
		background:
			radial-gradient(circle at 22% 34%, #fff 0 0.7px, transparent 1px),
			radial-gradient(circle at 63% 18%, #ffd8a8 0 0.9px, transparent 1.2px),
			radial-gradient(circle at 81% 72%, #c0d8ff 0 0.8px, transparent 1.1px),
			radial-gradient(circle at 41% 81%, #fff 0 0.6px, transparent 1px),
			linear-gradient(160deg, #1f2a48 0%, #0a0e1a 70%);
	}

	.sg-grid--insets {
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
	}

	.sg-inset-demo {
		display: grid;
		place-items: center;
		height: 104px;
		border-radius: var(--r-sm);
		background: var(--surface);
		color: var(--muted);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}

	.sg-spec {
		display: grid;
		gap: 0.2rem;
	}

	.sg-notes {
		font-size: var(--fs-sm);
		line-height: var(--lh-snug);
		color: var(--muted);
	}

	.sg-frame-demo {
		display: grid;
		place-items: center;
		height: 90px;
		font-size: var(--fs-md);
		color: var(--muted);
	}

	/* ── marks ────────────────────────────────────────────────────────────── */

	.sg-mark-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.4rem;
		margin-bottom: 1.1rem;
	}

	.sg-mark {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.7rem;
		border-radius: var(--r-sm);
		background: var(--surface);
		color: var(--text);
	}

	/* ── tool bands ───────────────────────────────────────────────────────── */

	/* The stack, at its real heights and its real radius — read straight off
	   toolBands.ts, so this diagram cannot fall out of step with the object. */
	.sg-band-demo {
		max-width: 46rem;
		margin-bottom: 1.1rem;
		overflow: hidden;
	}

	.sg-band {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0 14px;
	}

	/* Band A paints NOTHING (2026-08-09) — the diagram shows the row it still
	   reserves with a dashed outline, since an empty div would read as a bug. */
	.sg-band--a {
		background: none;
		outline: 1px dashed var(--line-soft);
		outline-offset: -1px;
	}

	/* The glass stop as itself. This page has no .ctx-* ancestor, so the demo
	   reaches for the L1 token directly rather than through --surface. */
	.sg-band--b {
		background: var(--glass-well);
	}

	.sg-band-gap {
		display: flex;
		align-items: center;
		padding: 0 14px;
	}

	.sg-focus-demo {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.sg-laws {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 0.8rem;
	}

	/* A single law card inside a section, rather than the Laws wall — it should
	   run the section's full width instead of leaving a 340px column of air. */
	.sg-laws--tight {
		grid-template-columns: 1fr;
	}

	.sg-law {
		padding: 1rem 1.2rem;
		border-radius: var(--r-sm);
		background: var(--surface);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.sg-law--open {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-warning) 35%, var(--border));
	}

	.sg-law ul {
		margin: 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.5rem;
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
		color: var(--muted);
	}
</style>
