<script lang="ts">
	/**
	 * critcalc.app — Style Reference (dev-only, /styleguide)
	 *
	 * The unified system — 2026-07-27, decisions by Nate. The six-chunk migration
	 * is complete: every per-tool button, chip, tab, toggle, note and field
	 * family now reads one definition in app.css.
	 *
	 * TWO STATES on this page, and the labels are load-bearing:
	 *
	 *   LIVE    — parsed from src/app.css at build time (?raw). Cannot drift.
	 *             Everything in Families / Tokens / Typography.
	 *
	 *   SHIPPED — a global class that lives in app.css. Chunk 1 of the migration
	 *             promoted the whole pattern layer there, so every specimen below
	 *             is the REAL class, not a copy. Nothing in this file styles a
	 *             control any more.
	 *
	 * Do not "fix" a pattern by editing a component — edit app.css, once, and
	 * every caller follows.
	 */
	import appCss from '../../app.css?raw';

	type Token = { name: string; value: string; resolved: string };

	/** Parse the :root block of app.css. The block ends at the first column-0
	 *  `}` — every line inside it is tab-indented. */
	function parseRootTokens(css: string): Token[] {
		const start = css.indexOf(':root {');
		const end = css.indexOf('\n}', start);
		const block = css.slice(start + ':root {'.length, end).replace(/\/\*[\s\S]*?\*\//g, '');
		const out: Token[] = [];
		const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(block))) out.push({ name: m[1], value: m[2].trim(), resolved: '' });
		const byName = new Map(out.map((t) => [t.name, t]));
		for (const t of out) {
			const alias = /^var\((--[a-z0-9-]+)\)$/.exec(t.value);
			t.resolved = alias ? (byName.get(alias[1])?.value ?? t.value) : t.value;
		}
		return out;
	}

	/** The same trick for a context block (`.ctx-dark` / `.ctx-light`). The
	 *  contexts are the palette's PRIMARY axis now, so they have to be live on
	 *  this page too — reading them from :root would show the safety net rather
	 *  than the thing components actually resolve. ^-anchored: the rule starts
	 *  at column 0, and unanchored matching hits prose mentions in comments. */
	function parseContextTokens(css: string, selector: string): Token[] {
		const block = new RegExp(`^${selector.replace(/\./g, '\\.')}[^{]*\\{([^}]*)\\}`, 'm').exec(css);
		if (!block) return [];
		const body = block[1].replace(/\/\*[\s\S]*?\*\//g, '');
		const out: Token[] = [];
		const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(body))) out.push({ name: m[1], value: m[2].trim(), resolved: m[2].trim() });
		return out;
	}

	const tokens = parseRootTokens(appCss);
	const pre = (...ps: string[]) => tokens.filter((t) => ps.some((p) => t.name.startsWith(p)));
	const exact = (...ns: string[]) =>
		ns.map((n) => tokens.find((t) => t.name === n)).filter((t): t is Token => !!t);

	/** The four ground roles + the two text rungs, in each context's own words.
	 *  Order is deliberate: it reads as the ladder, deepest ground first. */
	const CTX_ORDER = [
		'--frame-bg',
		'--surface',
		'--surface-raised',
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

	const structure = exact('--bg', '--text', '--muted', '--ink', '--chrome', '--neutral');
	const roleNet = exact('--surface', '--surface-raised', '--border', '--frame-bg', '--frame-line');
	const chartInk = pre('--chart-');
	const metrics = exact('--chrome-h', '--site-footer-h');
	const famDebuff = exact('--debuff', '--debuff-fill');
	const famCalm = exact('--calm', '--calm-fill');
	const uiStates = pre('--ui-');
	const geometry = pre('--r-');
	const motion = exact('--t-quick');
	const interaction = exact(
		'--fill-rest',
		'--fill-hover',
		'--sel-fill',
		'--sel-fill-hover',
		'--sel-ring',
		'--accent-hover-fill',
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
			structure,
			metrics,
			famDebuff,
			famCalm,
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

	const sections = [
		['families', 'Families'],
		['tokens', 'Tokens'],
		['type', 'Typography'],
		['buttons', 'Buttons'],
		['chips', 'Chips & tabs'],
		['booleans', 'Toggles'],
		['surfaces', 'Surfaces & text'],
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
			<strong>Two states on this page, and the labels are load-bearing:</strong>
			<span class="sg-badge sg-badge--live">live</span> is parsed from <code>src/app.css</code> at
			build time and cannot drift ·
			<span class="sg-badge sg-badge--ship">shipped</span> is a real global class in
			<code>app.css</code>, and every per-tool family now reads it — so this page cannot show you
			something the code doesn't have, and the code has nowhere else to get its styling from.
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
					Warm brown prose on paper, with the slate <code>--muted</code> as the anchored LABEL voice
					— note it is <strong>darker</strong> than <code>--text</code> here, a deliberate inversion of
					the dark context's order: labels anchor, prose recedes.
				</p>
				<div class="sg-swatches">
					{#each ctxLight as t (t.name)}{@render swatch(t)}{/each}
				</div>
			</div>
		</div>

		<p class="sg-note">
			<strong>Two values pull double duty, and that is what binds the axis into one system.</strong>
			<code>#E5D9C3</code> is dark-context TEXT and the light context's RIBBON surface + BORDER.
			<code>#857971</code> is the dark context's dim rung — its borders — and was its
			<code>--muted</code> until 2026-08-05, when that rung failed the body-text floor (3.29:1) and
			the text voice lifted to <code>mix(--text 30%, #857971)</code>, a blend of the two hinges
			rather than a new hue.
		</p>

		<h3>The content registers — what a context does NOT own</h3>
		<p class="sg-note">
			A context owns <em>structure</em>. Identity chroma belongs to CONTENT, which keeps its color
			on either ground: the element palette, and this pair. <code>--debuff</code> is
			<strong>enemy-facing</strong> (debuffs, res shred, sacrificial procs — dire's semantic
			successor); <code>--calm</code> is <strong>ally-facing</strong> (team buffs). Each is a bright EDGE
			plus a bar-BODY fill, pinned to the same weight so buff and debuff bars carry equal presence in
			the timeline. ⚠ The debuff values are interim — the destination color is still Nate's to choose.
		</p>
		<div class="sg-swatches">
			{#each famDebuff as t (t.name)}{@render swatch(t)}{/each}
			{#each famCalm as t (t.name)}{@render swatch(t)}{/each}
		</div>

		<h3>Accent zoning — the world and the crest</h3>
		<p class="sg-note">
			The site has two zones, named for the ascend: <strong>in the world</strong> (the landing
			scene, static pages, chrome, meta modals — at rest, choices ahead) and
			<strong>at the crest</strong> (inside a tool — picking a path is the moment you ascend, and a
			tool is where you land). <code>--accent</code> is a single alias read
			<strong>148× across 26 files</strong>, so scoping it re-themes the entire control layer in
			both zones at no further cost. ↻ 2026-08-05 (interim — the accent story is open): in the world
			it resolves to <code>--chrome</code> white; at the crest the CONTEXTS carry it —
			<code>.ctx-dark</code> parchment, <code>.ctx-light</code> slate — with the
			<code>.tool-shell</code> rung (also white) covering the over-scene strips. Both panels below are
			the same markup — only the zone differs.
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

	<!-- ══════════════════════════════════════════════════════════════ TOKENS ══ -->
	<section id="tokens">
		<h2>Tokens <span class="sg-badge sg-badge--live">live</span></h2>

		<h3>The world's ramp</h3>
		<p class="sg-note">
			What the site wears <em>outside</em> a panel. <code>--bg</code> is the anchor and is
			deliberately unchanged — it grounds the landing scene, which stays cosmic blue while
			everything else moved onto the archetype. <code>--text</code>/<code>--muted</code> are the
			over-the-scene voice and are <strong>neutral</strong> (C.004): a blue-tinted near-white was
			the last surviving member of the pre-archetype navy family and it fought the warm parchment
			the moment a panel sat beside it. <code>--chrome</code> white is the promoted register above
			them (branding, site chrome, the biggest headers — never body copy or data);
			<code>--ink</code>
			is the universal dark ink for text sitting ON a bright fill; <code>--neutral</code> is the
			universal "inactive / unknown" gray, promoted from the planner's local
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
			a domain color must never appear on a control's destructive state. So: debuff bars are --debuff,
			but
			<em>Reset all</em>
			is <code>--ui-danger</code>.
			<br />⚠ These are the loudest values in the system by a wide margin (C.15+ against a structure
			that whispers at C.04), which is the point — and the reason <code>--ui-warning</code> stays on small
			markers and underlines rather than large fills.
		</p>
		<div class="sg-swatches">
			{#each uiStates as t (t.name)}{@render swatch(t)}{/each}
		</div>

		<h3>Geometry</h3>
		<p class="sg-note">
			Odd radii 3/6/9 was long-standing house style with no token, which is how
			<code>0.3rem / 4px / 5px / 7px / 8px / 11px</code> crept in. These four are now the only legal radii.
		</p>
		<div class="sg-radii">
			{#each geometry as t (t.name)}
				<div class="sg-radius">
					<div class="sg-radius-box" style:border-radius={t.resolved}></div>
					<code class="sg-name">{t.name}</code><span class="sg-val">{t.value}</span>
				</div>
			{/each}
		</div>

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
			<strong>Plex Sans is the default.</strong> <strong>Bitter = branding + chrome only</strong> —
			headings use the body face (2026-07-22 reversal).
			<strong>Mono = KQM notation and input fields only</strong> (Nate 2026-07-24); readouts stay in the
			body voice. Never re-declare a font stack locally.
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
		<h2>Buttons <span class="sg-badge sg-badge--ship">shipped</span></h2>
		<p class="sg-note">
			One base, three variants, two sizes — replacing eleven families. The base is a quiet ghost;
			<code>--primary</code> and <code>--danger</code> are the only variants.
			<strong>Buttons are verbs, so they shout:</strong> uppercase + wide tracking throughout.
		</p>

		<div class="sg-specimens">
			<div class="sg-cell">
				<div class="sg-stage">
					<button class="btn">Save</button>
					<button class="btn btn--primary">Load</button>
					<button class="btn btn--danger">Delete</button>
					<button class="btn btn--danger is-confirming">Sure?</button>
					<button class="btn" disabled>Undo</button>
				</div>
				{@render spec(
					'.btn · --primary · --danger · :disabled · .is-confirming',
					'3px · 0.32/0.65rem · fs-sm · UPPER · ls-wide · ghost, fills on hover. A lone action with no controls around it takes --primary; there is no outline variant'
				)}
			</div>

			<div class="sg-cell">
				<div class="sg-stage">
					<button class="btn btn--sm">Copy PNG</button>
					<button class="btn btn--sm btn--primary">Export</button>
					<button class="btn btn--sm is-active">Notes</button>
					<button class="btn btn--sm btn--icon">−</button>
					<button class="btn btn--sm btn--icon">+</button>
					<button class="btn btn--sm btn--icon">×</button>
				</div>
				{@render spec(
					'.btn--sm · .btn--icon · .is-active',
					'dense toolbars — fs-xs, tighter padding. --icon is square, for glyph-only targets'
				)}
			</div>

			<div class="sg-cell">
				<div class="sg-stage">
					<div class="segment">
						<button class="btn is-active">My roster</button>
						<button class="btn">All C0</button>
						<button class="btn">All C6</button>
					</div>
				</div>
				{@render spec(
					'.segment > .btn',
					'segmented group — the wrapper owns the radius and the 1px dividers, the buttons stay plain'
				)}
			</div>

			<div class="sg-cell">
				<div class="sg-stage">
					<button class="btn sg-focus-demo">Focus ring</button>
					<span class="sg-val sg-val--dim"
						>every control gets a visible :focus-visible ring — most don't today</span
					>
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
						Vape Hu Tao <button class="tab-close" aria-label="close">×</button>
					</div>
					<div class="tab tab--closeable">
						Aggravate <button class="tab-close" aria-label="close">×</button>
					</div>
					<button class="btn btn--sm btn--icon">+</button>
				</div>
				{@render spec(
					'.tab · .active · .tab--lg · .tab--closeable',
					'ONE tab system, body face — drops Bitter and the 5px radius. --lg promotes a primary surface switcher (the TB Source row); document tabs stay base'
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
		<h2>Surfaces & text <span class="sg-badge sg-badge--ship">shipped</span></h2>
		<p class="sg-note">
			The panel shells were already global and already good — they only gain the radius token and
			the kicker. The note family collapses six rules into one.
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
					'6px · --surface-raised · inset top edge. The kicker is --muted (context label voice), trailing rule --muted @22%'
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
					'kicker = --muted UPPER ls-widest + rule · title = --text, body face (NOT Bitter) · note = --muted, it is data-adjacent'
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
					'1px var(--border) over --frame-bg — the context border (2026-08-05). NEVER animate a paint property here (retired 2026-07-10, perf)'
				)}
			</div>
		</div>
	</section>

	<!-- ═══════════════════════════════════════════════════════════ MIGRATION ══ -->
	<section id="migration">
		<h2>The exceptions <span class="sg-badge sg-badge--live">complete</span></h2>
		<p class="sg-note">
			The six-chunk pattern migration finished 2026-07-27: every per-tool button, chip, tab, toggle,
			note and field family — twenty-seven of them, including
			<em>seven</em> byte-similar copies of one <code>.note</code> rule — now reads a single
			definition in <code>app.css</code>. That table has served its purpose and is retired from this
			page; the git history holds it. What is still load-bearing is the other list — the things that
			deliberately did NOT migrate, so the line stays visible:
		</p>
		<p class="sg-note">
			<strong>What deliberately did NOT migrate</strong>, so the line stays visible: whole-card
			click targets (<code>.cc-main</code>, <code>.rolecard</code>, <code>.ar-slot</code>), the
			chrome hit targets (bare by design), dropdown menu items, the value wheel, the row-edge delete
			zone, element-tinted pills (<code>.tb-cand</code>, <code>.dc-team</code>) and the meta
			overlay's filled close disc. These are their own idioms, not text buttons wearing a different
			skin — forcing them onto <code>.btn</code> would lose meaning, not gain consistency.
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
							>debuff = enemy-facing · calm = ally-facing · chrome = the over-world white.</strong
						>
						Don't cross them. <code>--accent</code> is zoned and never leaves its zone — don't hard-code
						a context's accent in the world (landing scene, static pages).
					</li>
					<li>
						<strong>Structure whispers; content carries the chroma.</strong> A ground is a
						near-neutral LIT by the scene (C .010–.040) — real chroma on it white-balances every
						element bar sitting on it by simultaneous contrast, and fights the border. Identity
						chroma belongs to CONTENT (element bars, calm/debuff fills), which is exactly what keeps
						<code>--calm-fill</code> from reading as <code>--border</code>. Nothing structural gets
						more saturated than Genshin's own UI would allow.
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
						<strong>Selection is accent — except at the very top of the ladder.</strong> The
						top-level tool tab strips and the Help chapter nav select with
						<code>--sel-surface</code> (beige) + <code>--sel-ink</code>: the selected thing is the
						screen's one bright plate, Genshin's Stygian selected-row idiom. Everywhere else
						selection remains <code>--sel-fill</code>/<code>--sel-ring</code>. NO beige panels — the
						pilot's extent is a deliberate knob. (Amends 2026-08-01: gray AND beige are both freely
						available to this site; the old "beige belongs to the sister site" split is retired.)
					</li>
				</ul>
			</div>

			<div class="sg-law">
				<h3>Type</h3>
				<ul>
					<li>Plex Sans is the default for everything unless a rule below says otherwise.</li>
					<li>
						<strong>Bitter = branding + chrome-level nav only.</strong> Headings use the body face.
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
						A quiet ghost button needs a CLUSTER to read as a control. A lone action with nothing
						around it takes <code>--primary</code>; there is no middle tier.
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
						<strong>One <code>.frame</code> per tool, and one grammar site-wide:</strong>
						<strong>bench LEFT · work CENTER · filters RIGHT.</strong> The Team Builder and the
						Rotation Planner are each a single full-screen <code>.frame</code> below the tab strip,
						holding zones rather than nested islands. Zones separate with a 1px interior hairline
						over the frame's own fill — never a gap, never a second box. Nothing inside a frame
						wears <code>.panel</code>; the kickers do the separating. (↻ 2026-08-05: the old
						mirrored arrangement — planner LEFT, Team Builder RIGHT — existed for the tool-slide
						seam and retired with it.)
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
							>The filter column is <code>CharacterGrid</code>'s rail, not a frame zone.</strong
						>
						Both tools reach it through the shared grid (<code>railSide</code>, plus the
						<code>railStart</code>/<code>aboveGrid</code>/<code>belowGrid</code> snippets and the
						<code>--cg-*</code> knobs) — the planner via its Source overlay, the Team Builder in its roster
						view. Per-tool sizing rides the knobs; don't fork the component.
					</li>
					<li>
						<strong
							>Viewport-fit is the Team Builder and the Visualizers — the planner page-scrolls.</strong
						>
						For the fitted two, height is
						<code>calc(100svh − --chrome-h − --tool-pad-top − --tool-pad-bottom)</code> minus the
						tab strip, their zones scroll internally, and a bounded scroll needs
						<code>min-height: 0</code> at every flex level below it — break one and the column grows instead
						of scrolling. The planner is the deliberate exception: its frame is a flex column of rows
						that grows with the rotation. The benches are side-locked at every width; narrow viewports
						are the mobile pass's problem, not a breakpoint's.
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
					<li>Chrome marks must be geometry, never <code>&lt;text&gt;</code>.</li>
					<li>The brand string is <code>critcalc.app</code> — the full domain, everywhere.</li>
					<li>Only four radii exist: <code>--r-sm/md/lg/round</code>. No exceptions.</li>
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
						<strong>The accent story.</strong> Both contexts currently borrow one of their own inks
						as
						<code>--accent</code> (parchment in dark, slate in light), and the world borrows
						<code>--chrome</code> white. That is a placeholder, not a decision — the system has no accent
						of its own yet. Every consumer already reads the alias, so picking one is a value change,
						not a refactor.
					</li>
					<li>
						<strong><code>--debuff</code> / <code>--debuff-fill</code> are interim.</strong> Picked
						to sit in the archetype while staying clear of pyro and <code>--ui-danger</code>. They
						are the loudest chroma in the app (C.154) and the enemy-facing semantic has no settled
						color yet.
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
						<strong>✅ Closed 2026-08-06 — the bench's coverage block found its home.</strong> The
						facts and capability chips used to fall below the ribbon, housed by neither. They are
						the Team Builder's <code>TeamStrip</code> now: one horizontal readout across the top of the
						work zone, on the frame's own paper, directly above the roster its coverage gaps filter.
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
		border-radius: var(--r-lg);
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
		border-radius: var(--r-lg);
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
		border-radius: var(--r-lg);
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
		border-radius: var(--r-lg);
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

	.sg-focus-demo {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.sg-laws {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 0.8rem;
	}

	.sg-law {
		padding: 1rem 1.2rem;
		border-radius: var(--r-lg);
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
