<script lang="ts">
	/**
	 * critcalc.app — Style Reference (dev-only, /styleguide)
	 *
	 * The unified system — 2026-07-27, decisions by Nate. Migration chunks 1-2
	 * have landed; the per-tool families are what remain.
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

	const tokens = parseRootTokens(appCss);
	const pre = (...ps: string[]) => tokens.filter((t) => ps.some((p) => t.name.startsWith(p)));
	const exact = (...ns: string[]) =>
		ns.map((n) => tokens.find((t) => t.name === n)).filter((t): t is Token => !!t);

	const structure = exact('--bg', '--text', '--muted', '--neutral');
	const calmSurfaces = exact('--surface', '--surface-raised', '--border');
	const metrics = exact('--chrome-h', '--site-footer-h');
	const famDire = exact('--dire', '--dire-fill');
	const famCalm = exact('--calm', '--calm-fill');
	const famGilt = exact('--gilt-soft', '--gilt-hi', '--gilt', '--gilt-dim', '--gilt-fill');
	const aliases = exact('--dire-tint', '--calm-tint', '--calm-edge');
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
			famDire,
			famCalm,
			calmSurfaces,
			famGilt,
			aliases,
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
		['migration', 'Migration'],
		['laws', 'Laws']
	];

	/** Old class → new class. This IS the migration work list. */
	const migration: [string, string, string][] = [
		['.sp-btn / .sp-reset', '.btn / .btn--danger / .is-confirming', '✅ chunk 3'],
		['.tb-btn + 3 modifiers', '.btn, .btn--danger, .rp-btn-linked', '✅ chunk 3'],
		['.action-btn + 4 modifiers', '.btn--sm + --primary/--danger', '✅ chunk 3'],
		['.rp-composer-btn', '.btn--sm (+ local geometry)', '✅ chunk 3'],
		['.rp-notes-btn, --active', '.btn--sm, .is-active', '✅ chunk 3'],
		['.rp-zoom-btn', '.btn--sm .btn--icon', '✅ chunk 3'],
		['.cv-pin-button', '.btn--primary', '✅ chunk 3'],
		['.tb-edit-toggle', '.btn, .is-active', '✅ chunk 3'],
		['.tb-conmode-btn ×2 groups', '.segment > .btn', '✅ chunk 3'],
		['.close-btn, .icon-btn, .rp-tab-add', '.btn--icon', '✅ chunk 3'],
		['.vz-chip / -sm / -sub', '.chip--control, .chip--sm, .chip-sub', '✅ chunk 2'],
		['.tb-chip / --element / --role', '.chip, .chip--element', '✅ chunk 4'],
		['.cg-chip / --active / --element', '.chip, .active, .chip--element', '✅ chunk 4'],
		['.gx-el / .icd-el', '.chip--icon', '✅ chunk 4'],
		['.rp-tab (+ close)', '.tab, .tab--closeable, .tab-close', '✅ chunk 4'],
		['.tb-tab', '.tab — DROPPED Bitter + 5px', '✅ chunk 4'],
		['.sp-toggle (button[role=switch])', '.toggle — now a native input', '✅ chunk 5'],
		['.cv-variance-toggle / .wi-toggle', '.check', '✅ chunk 5'],
		['.vz-panel / .vz-panels', '.panel / .panels', '✅ chunk 2'],
		['.vz-kicker', '.kicker — now gilt', '✅ chunk 2'],
		['.vz-anim-frame / .vz-slider* / .vz-value', '.frame / .slider* / .readout', '✅ chunk 2'],
		['.sn-panel-title / .dc-title h2', '.title', '✅ chunk 5'],
		['.dc-subtitle', '.subtitle', '✅ chunk 5'],
		['.ar/dr/rx/an/gx/wi/icd-note', '.note — SEVEN copies of one rule', '✅ chunk 5'],
		['.tb-note .dc-note .cv-toggle-sub', '.note + local offset', '✅ chunk 5'],
		['.sp-section-title', '.kicker + local framing', '✅ chunk 5'],
		['.tb-search ≡ .cg-search', '.field — byte-identical pair', '✅ chunk 5']
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
			<strong>The unified system — 2026-07-27, migration chunks 1–2 landed.</strong> Two states on
			this page: <span class="sg-badge sg-badge--live">live</span> is parsed from
			<code>src/app.css</code> at build time and cannot drift ·
			<span class="sg-badge sg-badge--ship">shipped</span> is a real global class in
			<code>app.css</code> — every specimen renders the actual class, so this page cannot show you something
			the code doesn't have. § Migration is what remains: the per-tool button, chip, tab and note families
			still carry their own CSS and move onto these classes chunk by chunk.
		</p>
		<nav class="sg-nav">
			{#each sections as [id, label] (id)}
				<a href="#{id}">{label}</a>
			{/each}
		</nav>
	</header>

	<!-- ════════════════════════════════════════════════════════════ FAMILIES ══ -->
	<section id="families">
		<h2>The three families <span class="sg-badge sg-badge--live">live</span></h2>
		<p class="sg-note">
			The site's color identity is a triad. Each family <em>means</em> something — they are not interchangeable
			palettes, and the rule for which one to reach for is semantic, not aesthetic.
		</p>

		<div class="sg-fams">
			<div class="sg-fam">
				<h3>dire</h3>
				<p class="sg-note">
					Magenta. <strong>Enemy-facing</strong> — debuffs, res shred, the adversarial side of the
					game model. <strong>Lives past the portal:</strong> dire must never appear on the landing
					scene or the static pages. <code>--dire-fill</code> is the debuff bar body — the exact
					counterpart of <code>--calm-fill</code>, inheriting dire's hue via relative color while
					pinning saturation and lightness to the buff bar's weight.
				</p>
				<div class="sg-swatches">
					{#each famDire as t (t.name)}{@render swatch(t)}{/each}
				</div>
			</div>
			<div class="sg-fam">
				<h3>calm</h3>
				<p class="sg-note">
					Blue/navy. <strong>Ally-facing</strong> — team buffs, the ambient world, the scene.
					Site-wide, allowed on both sides of the portal.
					<strong>The surface stack is part of this family</strong>
					— the panels, the raised panels and the dividers are all calm, tuned as one ramp. They keep
					role names because <code>var(--surface)</code> reads better at a call site than
					<code>var(--calm-surface)</code>.
				</p>
				<span class="sg-zone-tag"
					>structure register — saturation steps DOWN as lightness rises</span
				>
				<div class="sg-swatches">
					{#each calmSurfaces as t (t.name)}{@render swatch(t)}{/each}
				</div>
				<span class="sg-zone-tag"
					>content register — saturation steps UP: content, not structure</span
				>
				<div class="sg-swatches">
					{#each famCalm as t (t.name)}{@render swatch(t)}{/each}
				</div>
				<p class="sg-note">
					That split is what finally separates <code>--calm-fill</code> from
					<code>--border</code>: they used to sit at l22 and l23 with similar chroma and were
					effectively one color. A buff bar is <em>content</em> and a divider is
					<em>structure</em>, so the bar is now both lighter and far more chromatic — it can never
					read as a structural line.
				</p>
			</div>
			<div class="sg-fam">
				<h3>gilt <span class="sg-badge sg-badge--new">new</span></h3>
				<p class="sg-note">
					Gold/beige. <strong>Light, structure, guidance</strong> — chrome, headings, kickers, links,
					input text. Site-wide. Follows the type law's chrome axis: gilt dresses chrome, the cool ramp
					dresses data.
				</p>
				<div class="sg-swatches">
					{#each famGilt as t (t.name)}{@render swatch(t)}{/each}
				</div>
			</div>
		</div>

		<h3>Accent zoning — dire stays past the portal</h3>
		<p class="sg-note">
			<code>--accent</code> is a single alias read <strong>148× across 26 files</strong>, so scoping
			it re-themes the entire control layer on both sides of the portal at no further cost. Outside
			the portal it resolves to gilt; inside <code>.tool-shell</code> it resolves to dire. Both panels
			below are the same markup — only the zone differs.
		</p>
		<div class="sg-zones">
			<div class="sg-zone">
				<span class="sg-zone-tag"
					>outside the portal — landing, static pages, chrome, meta modals</span
				>
				<div class="sg-stage">
					<button class="chip active">Selected</button>
					<button class="chip">Resting</button>
					<button class="btn btn--primary">PRIMARY</button>
					<a class="sg-demo-link" href="#families">a link</a>
				</div>
			</div>
			<div class="sg-zone" data-zone="tool">
				<span class="sg-zone-tag">inside a tool — past the portal</span>
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
			<code>data-zone="tool"</code> on the way out so a tool popover keeps its dire accent.
			<code>ChromeModals</code> is mounted outside <code>.tool-shell</code> deliberately, so
			Help/About/Settings inherit gilt in <em>both</em> zones. That is intended: they are meta surfaces,
			not tool surfaces.
		</p>

		{#if aliases.length}
			<h3>Legacy aliases <span class="sg-badge sg-badge--warn">remove on migration</span></h3>
			<p class="sg-note">
				Kept only so the token pass stayed purely additive. New code must use the canonical names.
			</p>
			<div class="sg-swatches">
				{#each aliases as t (t.name)}{@render swatch(t)}{/each}
			</div>
		{/if}
	</section>

	<!-- ══════════════════════════════════════════════════════════════ TOKENS ══ -->
	<section id="tokens">
		<h2>Tokens <span class="sg-badge sg-badge--live">live</span></h2>

		<h3>Structure</h3>
		<p class="sg-note">
			The page ground and the text ramp — the pieces that aren't a color family. The surfaces that
			used to live here moved into <a href="#families">calm</a>. <code>--bg</code> is the anchor and
			is deliberately unchanged; the rest were re-cut so saturation <em>falls</em> as lightness
			rises — a near-white carrying s60 (which <code>--text</code> did) tints the whole UI blue and
			fights the gilt voice. <code>--neutral</code> is the universal "inactive / unknown" gray,
			promoted from the planner's local <code>--rp-active</code>.
		</p>
		<div class="sg-swatches">
			{#each structure as t (t.name)}{@render swatch(t)}{/each}
		</div>

		<h3>UI state colors</h3>
		<p class="sg-note">
			Generic, deliberately boring, <strong>interface-only</strong>. The test:
			<em>is this color describing the game, or describing a consequence to the user's data?</em>
			Game → a domain family. Consequence → here. A UI state color must never appear inside a visualization;
			a domain color must never appear on a control's destructive state. So: debuff bars are dire, but
			<em>Reset all</em>
			is <code>--ui-danger</code>.
			<br />⚠ <code>--ui-warning</code> sits between <code>--ui-danger</code> (h8) and
			<code>--gilt</code> (h38) with ~30° of room, so it takes the center at h25 — restrict it to small
			markers and underlines, never a large fill.
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

		<h3>The two voices</h3>
		<p class="sg-note">
			Gilt maps onto a distinction that already exists, so there is no new rule to memorise —
			<strong>the chrome axis wears gilt, the data axis stays cool.</strong>
		</p>
		<div class="sg-voices">
			<div class="sg-voice">
				<span class="sg-zone-tag">gilt voice — chrome</span>
				<p class="sg-voice-sample sg-voice-sample--gilt">
					Team Builder · Roster · Filter by capability · Search characters…
				</p>
				<span class="sg-val">brand · nav · headings · kickers · titles · links · input text</span>
			</div>
			<div class="sg-voice">
				<span class="sg-zone-tag">cool voice — data</span>
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
					<div class="tab active">Roster</div>
					<div class="tab">Atlas</div>
					<div class="tab">Compare</div>
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
					'.tab · .active · .tab--closeable',
					'ONE tab system, body face — the Team Builder view switch and the planner document tabs. Drops Bitter and the 5px radius'
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
			the gilt kicker. The note family collapses six rules into one.
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
					'6px · --surface-raised · inset top edge. The kicker is now GILT, and its trailing rule is --gilt-dim'
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
					'kicker = gilt UPPER ls-widest + rule · title = gilt, body face (NOT Bitter) · note = cool, it is data-adjacent'
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
						Input text is chrome, not data — this is where the gilt voice was first noticed.
					</p>
				</div>
				{@render spec(
					'.field · .field-label',
					'input text = --gilt-soft · placeholder = --gilt-dim · label = --gilt UPPER. The origin story of the third family'
				)}
			</div>

			<div class="sg-cell sg-cell--wide">
				<div class="sg-stage sg-stage--block">
					<div class="frame sg-frame-demo">chart interior</div>
				</div>
				{@render spec(
					'.frame',
					'1px dire @40% over #081225 — static. NEVER animate a paint property here (retired 2026-07-10, perf). Stays dire: it is a tool-interior surface'
				)}
			</div>
		</div>
	</section>

	<!-- ═══════════════════════════════════════════════════════════ MIGRATION ══ -->
	<section id="migration">
		<h2>Migration <span class="sg-badge sg-badge--warn">work list</span></h2>
		<p class="sg-note">
			Every old class and where it goes. Two name collisions to resolve in the same pass:
			<code>.tab</code> (planner) and <code>.panel</code> (SavedNotationsOverlay) already exist as
			scoped classes — both are the patterns being replaced, so they migrate rather than conflict.
			The <code>vz-*</code> prefix retires with this pass: it reads as "visualizer" but is already used
			by the planner, Team Builder, CharacterGrid and RotationTimeline (~310 occurrences).
		</p>
		<div class="sg-table">
			<div class="sg-tr sg-tr--head"><span>Today</span><span>Becomes</span><span>Source</span></div>
			{#each migration as [from, to, src] (from)}
				<div class="sg-tr">
					<span><code>{from}</code></span>
					<span><code class="sg-name">{to}</code></span>
					<span class="sg-src">{src}</span>
				</div>
			{/each}
		</div>
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
						<strong>dire = enemy-facing · calm = ally-facing · gilt = chrome.</strong> Don't cross them.
					</li>
					<li>
						<strong>Dire never leaves the tools.</strong> No magenta on the landing scene or the
						static pages. <code>--accent</code> is zoned; don't hard-code dire outside a tool.
					</li>
					<li>
						<strong>Nothing in gilt goes above <code>#d2bd90</code></strong> — the most saturated gold
						in Genshin's own UI. Above that it stops reading as chrome and starts competing with the elements.
					</li>
					<li>
						<strong>Gilt fills only at the ends of its ramp</strong> —
						<code>--gilt-fill</code> (deep bronze) or <code>--gilt-soft</code>/<code>-hi</code>
						(bright). The mid-tones stay text and hairlines. At s41 against geo's s68 there is no real
						risk of reading as an element.
					</li>
					<li>
						<strong>Within a family, saturation encodes role.</strong> Structure members are low
						saturation, content members are high. That is what keeps <code>--calm-fill</code> from
						reading as <code>--border</code>.
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
						<strong>Chrome axis wears gilt, data axis stays cool.</strong> Headings, kickers, titles,
						links, input text → gilt. Values, cells, timeline text, character names → cool.
					</li>
					<li>
						<strong>Verbs shout, nouns don't.</strong> Buttons and instrument controls are uppercase +
						ls-wide; content chips are sentence case.
					</li>
					<li>Never re-declare a font stack locally.</li>
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
					<li>In-frame overlays can't paint above the top border — portal to <code>body</code>.</li>
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
						<strong>The PNG export palette is a hand-maintained mirror.</strong> Canvas can't
						resolve <code>var()</code>, so <code>timelineExport.ts</code> duplicates every token it paints
						as a literal. It was re-cut with this pass, but nothing enforces it — a token change that
						forgets it desyncs exported images silently.
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
		color: var(--gilt);
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
		color: var(--gilt);
	}

	.sg > section > h3,
	.sg-fam h3,
	.sg-law h3 {
		margin: 2rem 0 0.7rem;
		font-size: var(--fs-md);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--gilt);
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
		color: var(--gilt);
	}

	.sg-badge--warn {
		background: var(--ui-danger-soft);
		color: var(--ui-danger);
	}

	.sg-badge--new {
		background: var(--ui-positive-soft);
		color: var(--ui-positive);
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

	.sg-src {
		font-family: var(--font-mono);
		font-size: var(--fs-2xs);
		color: color-mix(in srgb, var(--muted) 70%, transparent);
	}

	/* ── families / zones ─────────────────────────────────────────────────── */

	.sg-fams {
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

	.sg-voice-sample--gilt {
		color: var(--gilt-soft);
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

	/* ── tables / radii ───────────────────────────────────────────────────── */

	.sg-table {
		display: grid;
		gap: 1px;
		border-radius: var(--r-md);
		overflow: hidden;
		background: var(--border);
	}

	.sg-tr {
		display: grid;
		grid-template-columns: 1.2fr 1fr 0.9fr;
		gap: 1rem;
		align-items: center;
		padding: 0.45rem 0.7rem;
		background: var(--surface);
		font-size: var(--fs-md);
	}

	.sg-tr--head {
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		font-size: var(--fs-xs);
		color: var(--muted);
		background: var(--surface-raised);
	}

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
