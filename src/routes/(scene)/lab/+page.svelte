<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';

	/**
	 * THE SPECIMEN BOARD (/lab) — ⚓ NATE 2026-08-10.
	 *
	 * "I want to see the actual panels and text we'll be using on the scene with
	 * dim so that I can judge things clearly." Neither existing surface could:
	 * the Team Builder shows whatever that tool happens to use, never the whole
	 * set side by side; /styleguide shows the whole set but on the bare root
	 * layout, in chips, against a hand-drawn stand-in sky.
	 *
	 * SO THIS PAGE HAS EXACTLY ONE JOB: every ground we own, at real size, with
	 * the same content in each, AT THE CREST UNDER THE REAL WASH. It is a board
	 * to judge from, not a reference to look things up in — /styleguide stays the
	 * authority and stays exhaustive. Two surfaces, opposite virtues: reference
	 * wants completeness, judging wants one screenful at true scale.
	 *
	 * ⚠ WHAT MAY BE STYLED HERE. Shipped patterns are rendered with their REAL
	 * global classes and are not restyled — same law as /styleguide, and for the
	 * same reason (a board that paints its own copy of a button is showing you a
	 * button that does not exist). The exception is the CANDIDATES section: those
	 * are proposals with no home in app.css yet, so they are drawn locally and
	 * labelled as proposals. When one is adopted it moves to app.css and this
	 * page renders the real thing instead.
	 */

	/** The same content in every ground, so the only variable is the ground. */
	const SPECIMEN_GROUNDS = [
		{
			key: 'night',
			cls: '',
			label: 'ctx-night — the world itself',
			note: 'no paint · one ground, no rungs · lines must carry alpha'
		},
		{
			key: 'glass',
			cls: 'ctx-glass',
			label: 'ctx-glass — the material',
			note: 'slate at an alpha · 8% of the world survives it'
		},
		{ key: 'dark', cls: 'ctx-dark', label: 'ctx-dark — slate', note: 'ground · raised · well' },
		{
			key: 'light',
			cls: 'ctx-light',
			label: 'ctx-light — parchment',
			note: 'the inversion · navy ink'
		}
	];

	const LINE_STOPS = ['--line-faint', '--line-soft', '--line-strong', '--line-edge'];

	/**
	 * THE INK LADDER, rendered identically in every ground — ⚓ Nate 2026-08-10:
	 * "what are the exact text body sizes, headings, section breaks etc we're
	 * using right now?"
	 *
	 * Every row carries its own size tag, so each panel doubles as a legend for
	 * the type system ON THAT GROUND. That pairing is the point: the size and the
	 * ink role are one decision, not two, and the light context INVERTS the ink
	 * half of it (prose recedes, labels anchor) while keeping the sizes.
	 *
	 * ⚠ `role` is what the token's comment in app.css claims the rung is FOR.
	 * Where the product disagrees with that claim it is noted — the base UI rung
	 * says 14px and the controls all ship at 11.
	 */
	const TYPE_ROWS = [
		{ cls: 'ty-h2', tag: '3xl · 20', text: 'Section heading' },
		{ cls: 'ty-h3', tag: '2xl · 18', text: 'Subheading' },
		{ cls: 'ty-body', tag: 'lg · 14', text: 'Body — the base UI rung.' },
		{ cls: 'ty-dense', tag: 'md · 12', text: 'Dense body — what prose actually ships at.' },
		{ cls: 'ty-label', tag: 'sm · 11', text: 'Label · controls' },
		{ cls: 'ty-caption', tag: 'xs · 10', text: 'Caption / meta' }
	];

	/**
	 * THE SIZE-UP, as a ROLE SHIFT rather than a new scale — ⚓ Nate is
	 * "considering a slight size-up".
	 *
	 * The rungs are fine; what is questionable is which rung each role sits on.
	 * Shifting roles up the existing ladder keeps the ladder a ladder (and keeps
	 * every rung a number that already exists), where re-cutting the scale would
	 * mean re-deriving everything that measures against it.
	 *
	 * ⚠ IT IS NOT A UNIFORM +1. The bottom of the scale is where the pressure is
	 * — controls at 11px and prose at 12px against Genshin's much larger UI —
	 * and the top is already right. So the small end lifts a rung and the
	 * headings hold, which also closes the gap the product had opened by itself:
	 * --fs-lg is commented "base UI / body" and almost nothing uses it.
	 */
	const SIZE_UP = [
		{ role: 'section heading', now: '3xl · 20', next: '3xl · 20', moved: false },
		{ role: 'subheading', now: '2xl · 18', next: '2xl · 18', moved: false },
		{ role: 'body / prose', now: 'md · 12', next: 'lg · 14', moved: true },
		{ role: 'controls · tabs · chips', now: 'sm · 11', next: 'md · 12', moved: true },
		{ role: 'labels · meta', now: 'xs · 10', next: 'sm · 11', moved: true },
		{ role: 'micro / badges', now: '2xs · 9', next: 'xs · 10', moved: true }
	];

	/**
	 * BORDERS IN GOLD — ⚓ Nate 2026-08-10: "I think Genshin uses gold for BOTH
	 * contexts. I'm not sure which brightness stop."
	 *
	 * Every candidate rung against both grounds, at the two alphas that survived
	 * the cut. Mixed OPAQUELY against each ground (the compositing law) and one
	 * level deep — both inputs are primitives, never aliases of each other, so
	 * no color-mix is ever fed a color-mix.
	 *
	 * The control row is the shipped ink line, so the question being asked is
	 * "gold instead of THIS", not "gold in the abstract".
	 */
	const BORDER_CANDIDATES = [
		{ key: 'ink', label: 'ink — shipped', src: null },
		{ key: 'gold-300', label: '--gold-300', src: 'var(--gold-300)' },
		{ key: 'gold-400', label: '--gold-400 · the accent', src: 'var(--gold-400)' },
		{ key: 'gold-500', label: '--gold-500', src: 'var(--gold-500)' },
		{ key: 'gold-600', label: '--gold-600', src: 'var(--gold-600)' },
		{ key: 'gold-700', label: '--gold-700', src: 'var(--gold-700)' }
	];

	/** The open question the ring cannot answer on its own — see --glass-ring. */
	const RING_CANDIDATES = [
		{ key: 'ink', label: 'parchment ink — shipped', ring: 'var(--line-edge)' },
		{
			key: 'gold',
			label: 'gold-400 @ .45',
			ring: 'color-mix(in srgb, var(--gold-400) 45%, transparent)'
		},
		{
			key: 'slate',
			label: 'brighter slate — slate-300',
			ring: 'color-mix(in srgb, var(--slate-300) 75%, transparent)'
		}
	];
</script>

<svelte:head><title>Specimen Board — critcalc.app</title></svelte:head>

<div class="lab">
	<header class="lab-head">
		<h1>Specimen board</h1>
		<p>
			Every ground at real size, same content in each, at the crest under the real wash. Dev-only —
			<code>/styleguide</code> stays the exhaustive reference; this is the thing to judge from.
		</p>
	</header>

	<!-- ══════════════════════════════════════════════════ 1 · THE GROUNDS ══ -->
	<section>
		<h2 class="lab-h">The grounds</h2>
		<div class="lab-grid">
			{#each SPECIMEN_GROUNDS as g (g.key)}
				<div class="spec {g.cls}" class:spec--bare={g.key === 'night'}>
					<div class="spec-tag">{g.label}</div>

					<!-- THE TYPE LADDER. Each row is sample + size tag, so the panel is
					     both a specimen and a legend. -->
					{#each TYPE_ROWS as t (t.cls)}
						<div class="ty-row">
							<span class={t.cls}>{t.text}</span>
							<span class="ty-tag">{t.tag}</span>
						</div>
					{/each}

					<!-- SECTION BREAK — the shipped .kicker: a label whose rule runs out
					     of its right-hand side. ⚠ It must DECLARE the body face; a
					     heading face here is the bug that keeps coming back. -->
					<p class="kicker">Section break</p>

					<p class="spec-prose">
						Prose with an <b>accent</b> in it, and a
						<a href="#top">link</a> to see the two apart.
					</p>
					<div class="spec-row">
						<span class="spec-label">Constellation</span>
						<span class="spec-value">C2</span>
					</div>
					<hr class="spec-rule" />
					<div class="spec-controls">
						<button class="btn" type="button"><Mark name="save" />Save</button>
						<button class="btn btn--primary" type="button">Apply</button>
						<button class="btn" type="button" disabled>Off</button>
					</div>
					<div class="spec-controls">
						<button class="tab active" type="button">Selected</button>
						<button class="tab" type="button">Resting</button>
					</div>
					<div class="spec-inset inset inset--plain">inset · gold</div>
					<div class="spec-lines">
						{#each LINE_STOPS as stop (stop)}
							<span class="spec-line" style:background="var({stop})"></span>
						{/each}
					</div>
					<div class="spec-note">{g.note}</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- ══════════════════════════════════════════════ 2 · THE SIZE-UP ══ -->
	<section>
		<h2 class="lab-h">
			A size-up, as a role shift <span class="lab-badge">deciding</span>
		</h2>
		<p class="lab-note">
			⚓ Nate is considering "a slight size-up". The proposal is to move ROLES up the existing
			ladder rather than re-cut the scale — the rungs are fine, what is questionable is which rung
			each role sits on, and re-cutting would mean re-deriving everything that measures against it.
			⚠ <strong>Not a uniform +1.</strong> The pressure is all at the bottom (controls at 11px,
			prose at 12) and the headings are already right, so the small end lifts and the top holds. It
			also closes a gap the product opened by itself: <code>--fs-lg</code> is commented "base UI / body"
			and almost nothing uses it.
		</p>
		<div class="lab-row">
			<div class="cand">
				<span class="cand-tag">today</span>
				<div class="ctx-dark sizeup">
					<h3 class="su-h3">Off-field DMG</h3>
					<p class="su-body su-body--now">
						Coordinated attacks or damaging summons. Provided by <b>35</b> characters in the roster,
						of which you own <b>0</b>.
					</p>
					<div class="su-row su-row--now"><span>Constellation</span><span>C2</span></div>
					<div class="spec-controls">
						<button class="btn" type="button">Filter</button>
						<button class="tab active" type="button">Atlas</button>
					</div>
				</div>
			</div>
			<div class="cand">
				<span class="cand-tag">roles up one rung</span>
				<div class="ctx-dark sizeup sizeup--next">
					<h3 class="su-h3">Off-field DMG</h3>
					<p class="su-body su-body--next">
						Coordinated attacks or damaging summons. Provided by <b>35</b> characters in the roster,
						of which you own <b>0</b>.
					</p>
					<div class="su-row su-row--next"><span>Constellation</span><span>C2</span></div>
					<div class="spec-controls">
						<button class="btn su-ctrl" type="button">Filter</button>
						<button class="tab active su-ctrl" type="button">Atlas</button>
					</div>
				</div>
			</div>
			<div class="su-table">
				{#each SIZE_UP as s (s.role)}
					<div class="su-trow" class:is-moved={s.moved}>
						<span class="su-role">{s.role}</span>
						<span class="ty-tag">{s.now}</span>
						<span class="su-arrow">{s.moved ? '→' : '·'}</span>
						<span class="ty-tag su-next">{s.next}</span>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ═════════════════════════════════════════ 3 · THE NIGHT PAINTS ══ -->
	<section>
		<h2 class="lab-h">
			What may paint on the night <span class="lab-badge">proposal</span>
		</h2>
		<p class="lab-note">
			⚓ Nate: three, and all very transparent — a dark ribbon, a red ribbon, a gradient fade. The
			rule that keeps <em>night has no rungs</em> intact:
			<strong>these condition the world, they do not become grounds.</strong>
			None of them carries an ink ladder of its own; text on a scrim ribbon is still night text. The red
			one is the exception worth watching — it carries STATE (blocked / unavailable), so it is the one
			that must never be reached for as decoration.
		</p>
		<div class="lab-stack">
			<div class="night-ribbon">
				<h3 class="spec-title">Special Rules</h3>
			</div>
			<p class="spec-prose spec-prose--wide">
				A header needs a ribbon because it has to hold across whatever the sky is doing behind it.
				The prose under it does not — at <b>6.87:1</b> against the worst pixel it survives on its own,
				which is what the deeper wash bought.
			</p>
			<div class="night-ribbon night-ribbon--danger">
				<Mark name="gated" /> Challenge criteria not met
			</div>
			<div class="night-fade">
				<span>gradient fade — the landing footer's idiom, named</span>
			</div>
		</div>
	</section>

	<!-- ═══════════════════════════════════════════ 3 · BORDERS IN GOLD ══ -->
	<section>
		<h2 class="lab-h">
			Borders — ink or gold <span class="lab-badge">deciding</span>
		</h2>
		<p class="lab-note">
			⚓ Nate: Genshin appears to use gold on <em>both</em> grounds, and the open question is which
			rung. Every candidate against both, at the two alphas that survived the cut — mixed opaquely
			against each ground, so what you see is the line as it would actually resolve. The top row is
			the shipped ink line, so the question is "gold instead of <em>that</em>".
			<strong>The inset frame is the load-bearing case</strong>: it is the one place a line is
			ornament rather than structure, and ornament is where gold has a claim.
		</p>
		<div class="border-grid">
			<div class="border-head">
				<span></span>
				<span class="cand-tag">on slate</span>
				<span class="cand-tag">on parchment</span>
			</div>
			{#each BORDER_CANDIDATES as c (c.key)}
				<div class="border-row">
					<span class="cand-tag border-name">{c.label}</span>
					{#each ['ctx-dark', 'ctx-light'] as ground (ground)}
						<div
							class="border-cell {ground}"
							style:--frame-line={c.src
								? `color-mix(in srgb, ${c.src} 18%, var(--frame-bg))`
								: null}
							style:--frame-line-quiet={c.src
								? `color-mix(in srgb, ${c.src} 10%, var(--frame-bg))`
								: null}
						>
							<div class="border-inset inset inset--plain">inset · α .18</div>
							<hr class="border-rule" />
							<hr class="border-rule border-rule--quiet" />
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</section>

	<!-- ══════════════════════════════════════ 4 · GLASS HOVER + THE RING ══ -->
	<section>
		<h2 class="lab-h">
			Glass hover <span class="lab-badge">shipped</span> · the ring colour
			<span class="lab-badge">deciding</span>
		</h2>
		<p class="lab-note">
			Ring + density is in (⚓ approved), at the new alphas — rest <b>.58</b>, hover <b>.80</b>.
			Rendered side by side and forced, because
			<strong>you cannot judge a hover by hovering</strong>: you never see rest and hover at once.
			What is still open is the ring's colour, and ⚠
			<strong>it cannot be settled before the row above</strong> — if lines go gold globally, a gold ring
			stops distinguishing HOVER from SELECTED, which is the one thing it has to do.
		</p>
		<div class="lab-row">
			{#each RING_CANDIDATES as r (r.key)}
				<div class="cand">
					<span class="cand-tag">{r.label}</span>
					<div class="ctx-glass glasspane">rest · .58</div>
					<div class="ctx-glass glasspane is-dense" style:box-shadow="inset 0 0 0 1px {r.ring}">
						hover · .80
					</div>
				</div>
			{/each}
			<div class="cand">
				<span class="cand-tag">wash — retired</span>
				<div class="ctx-glass glasspane">rest</div>
				<div class="ctx-glass glasspane is-wash">hover</div>
			</div>
		</div>
	</section>

	<!-- ══════════════════════════════════════════ 4 · THE SPLIT CARD ══ -->
	<section>
		<h2 class="lab-h">
			The Atlas card, split <span class="lab-badge">proposal</span>
		</h2>
		<p class="lab-note">
			Identity on the dark half, content on the light half — Genshin's own split, turned side-on for
			our aspect. Today's all-glass card sits beside it at the same size.
			<strong>The inversion is the information</strong>: the seam says "this side is what it is,
			that side is what it holds".
		</p>
		<div class="lab-row">
			<div class="atlas atlas--glass ctx-glass">
				<div class="atlas-id"><span class="atlas-glyph">◈</span></div>
				<div class="atlas-body">
					<h3 class="spec-title">On-field DPS</h3>
					<p class="spec-prose"><b>48</b> provides · <b>0</b> owned</p>
				</div>
			</div>
			<div class="atlas atlas--split">
				<div class="atlas-id ctx-dark"><span class="atlas-glyph">◈</span></div>
				<div class="atlas-body ctx-light">
					<h3 class="spec-title">On-field DPS</h3>
					<p class="spec-prose"><b>48</b> provides · <b>0</b> owned</p>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	/* The board sits in the (scene) group with the site chrome suppressed (/lab
	   is in TOOL_PATHS), so it owns the whole viewport. Generous padding: the
	   specimens have to be judged with sky around them, not edge to edge. */
	/* ⚠ THE PAGE OWNS ITS OWN SCROLLER. (scene)'s .content is `position: fixed;
	   inset: 0` — the scene has to stay pinned behind whatever is on top of it —
	   so a page inside it that does not scroll itself simply loses everything
	   below the fold with no scrollbar to tell you. (The tools get this from
	   .tool-shell; this page is not in that group.) */
	.lab {
		position: relative;
		z-index: 1;
		height: 100%;
		overflow-y: auto;
		padding: 2rem max(2rem, calc((100% - 1560px) / 2)) 6rem;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	.lab-head h1 {
		margin: 0 0 0.3rem;
		font-family: var(--font-display);
		font-size: var(--fs-4xl);
		color: var(--chrome);
	}
	/* On the world, prose takes the BRIGHT ink — there is no panel here to set a
	   dim rung, and --muted does not clear 4.5:1 against a star even at the
	   deeper wash. See TOOL_DIM. */
	.lab-head p,
	.lab-note {
		margin: 0;
		max-width: 90ch;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--text);
	}
	.lab-note {
		margin-bottom: 1rem;
	}

	.lab-h {
		margin: 0 0 0.5rem;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		color: var(--chrome);
	}

	.lab-badge {
		padding: 0.1rem 0.45rem;
		border-radius: var(--r-round);
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
		color: var(--accent);
		font-family: var(--font-body);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		vertical-align: middle;
	}

	.lab-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		align-items: start;
	}
	.lab-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.2rem;
		align-items: flex-start;
	}
	.lab-stack {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		max-width: 780px;
	}

	/* ── the ground specimens ──────────────────────────────────────────────
	   Identical box in all four; only the context class differs. The bare one
	   paints nothing at all, which is the whole claim of ctx-night. */
	.spec {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1.1rem 1.2rem;
		border-radius: var(--r-sm);
		background: var(--surface);
		color: var(--text);
	}
	.spec--bare {
		background: none;
	}
	.spec.ctx-glass {
		-webkit-backdrop-filter: blur(var(--glass-blur));
		backdrop-filter: blur(var(--glass-blur));
	}

	.spec-tag {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	/* ⚠ Bare night uses --text for the tag too: --muted is 4.16:1 out here. */
	.spec--bare .spec-tag,
	.spec--bare .spec-label,
	.spec--bare .spec-note {
		color: var(--text);
	}

	.spec-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}

	/* ── the ink ladder ───────────────────────────────────────────────────
	   Sample on the left, size tag right-aligned. The tag is deliberately the
	   quietest thing in the panel — it is an annotation on the specimen, not a
	   member of it, and it must not compete with the rung it is labelling. */
	.ty-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.8rem;
		min-width: 0;
	}
	.ty-tag {
		flex: none;
		font-family: var(--font-mono);
		font-size: var(--fs-2xs);
		color: var(--muted);
		opacity: 0.65;
	}
	.spec--bare .ty-tag {
		color: var(--text);
	}
	.ty-h2 {
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}
	.ty-h3 {
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	.ty-body {
		font-size: var(--fs-lg);
		color: var(--text);
	}
	.ty-dense {
		font-size: var(--fs-md);
		color: var(--text);
	}
	/* ⚠ THE LABEL VOICE IS WHERE THE CONTEXTS DISAGREE. --muted is the DIM rung
	   on dark and the ANCHORING rung on paper, so this one row inverts while
	   every other row holds — which is the clearest single demonstration of the
	   ink ladder flipping, and the reason the ladder is rendered per ground
	   rather than once. */
	.ty-label {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	.ty-caption {
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.spec--bare .ty-label,
	.spec--bare .ty-caption {
		color: var(--text);
	}

	/* ── the size-up comparison ───────────────────────────────────────────── */
	.sizeup {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 330px;
		padding: 1rem 1.1rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.su-h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}
	.su-body {
		margin: 0;
		line-height: var(--lh-relaxed);
		color: var(--text);
	}
	.su-body--now {
		font-size: var(--fs-md);
	}
	.su-body--next {
		font-size: var(--fs-lg);
	}
	.su-body b {
		color: var(--accent);
	}
	.su-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	.su-row--now {
		font-size: var(--fs-xs);
	}
	.su-row--next {
		font-size: var(--fs-sm);
	}
	/* The control rung is the one that has to be overridden rather than swapped:
	   .btn and .tab hard-code --fs-sm, so the proposal is shown by re-declaring
	   it here. If the shift is adopted the override moves into app.css and this
	   class disappears. */
	.su-ctrl {
		font-size: var(--fs-md);
	}

	.su-table {
		display: grid;
		gap: 3px;
		align-content: start;
		font-family: var(--font-mono);
	}
	.su-trow {
		display: grid;
		grid-template-columns: 12rem 5rem 1.4rem 5rem;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--r-sm);
	}
	.su-trow.is-moved {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}
	.su-role {
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.su-arrow,
	.su-next {
		color: var(--accent);
		opacity: 1;
	}
	.spec-prose {
		margin: 0;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--text);
	}
	.spec-prose--wide {
		max-width: none;
	}
	.spec-prose a {
		color: var(--accent);
	}
	.spec-prose b {
		color: var(--accent);
		font-weight: var(--fw-semibold);
	}
	.spec-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: var(--fs-sm);
	}
	.spec-label {
		color: var(--muted);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	.spec-value {
		color: var(--text);
		font-weight: var(--fw-semibold);
	}
	.spec-rule {
		height: 2px;
		margin: 0;
		border: none;
		background: var(--frame-line);
	}
	.spec-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.spec-inset {
		display: grid;
		place-items: center;
		height: 54px;
		border-radius: var(--r-sm);
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		--frame-inset: 5px;
	}
	.spec--bare .spec-inset {
		color: var(--text);
	}
	/* The four line stops as a run, so the STEP between them is judgeable —
	   a single line tells you nothing about whether the ladder is spaced. */
	.spec-lines {
		display: grid;
		gap: 3px;
	}
	.spec-line {
		height: 2px;
	}
	.spec-note {
		font-size: var(--fs-xs);
		line-height: var(--lh-normal);
		color: var(--muted);
	}

	/* ── candidates: the night paints ─────────────────────────────────────
	   Local styling, deliberately — these have no home in app.css yet. When one
	   is adopted it moves there and this block shrinks. */
	.night-ribbon {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: var(--r-sm);
		background: rgb(20 22 28 / 0.55);
		color: var(--text);
		font-weight: var(--fw-semibold);
	}
	.night-ribbon--danger {
		background: color-mix(in srgb, var(--ui-danger) 38%, transparent);
	}
	.night-fade {
		display: grid;
		place-items: end center;
		height: 110px;
		padding-bottom: 0.6rem;
		border-radius: var(--r-sm);
		background: linear-gradient(to bottom, transparent, rgb(16 16 19 / 0.85));
		color: var(--text);
		font-size: var(--fs-sm);
	}

	/* ── candidates: glass hover ──────────────────────────────────────────── */
	.cand {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.cand-tag {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text);
	}
	.glasspane {
		display: grid;
		place-items: center;
		width: 190px;
		height: 62px;
		border-radius: var(--r-sm);
		background: var(--surface);
		-webkit-backdrop-filter: blur(var(--glass-blur));
		backdrop-filter: blur(var(--glass-blur));
		color: var(--muted);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	/* The retired wash, kept as the control — a layer over the pane, never a
	   color-mix fed by a color-mix. */
	.glasspane.is-wash {
		background: linear-gradient(var(--fill-hover), var(--fill-hover)), var(--surface);
	}
	/* The shipped hover: the MATERIAL thickens. Reads --surface-hover so this
	   specimen tracks the real token rather than restating its value. */
	.glasspane.is-dense {
		background: var(--surface-hover);
	}

	/* ── candidate: borders in gold ───────────────────────────────────────
	   Each cell re-declares --frame-line / --frame-line-quiet inline and then
	   renders the SHIPPED .inset--plain and a plain rule, so the specimen is the
	   real idiom wearing a candidate value — not a drawing of one. */
	.border-grid {
		display: grid;
		gap: 6px;
		max-width: 1000px;
	}
	.border-head,
	.border-row {
		display: grid;
		grid-template-columns: 12rem 1fr 1fr;
		align-items: center;
		gap: 10px;
	}
	.border-name {
		color: var(--text);
	}
	.border-cell {
		display: grid;
		gap: 7px;
		padding: 0.7rem 0.8rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.border-inset {
		display: grid;
		place-items: center;
		height: 46px;
		border-radius: var(--r-sm);
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		--frame-inset: 4px;
	}
	.border-rule {
		height: 2px;
		margin: 0;
		border: none;
		background: var(--frame-line);
	}
	.border-rule--quiet {
		background: var(--frame-line-quiet);
	}

	/* ── candidate: the split Atlas card ──────────────────────────────────── */
	.atlas {
		display: grid;
		grid-template-columns: 150px 1fr;
		width: 480px;
		min-height: 132px;
		border-radius: var(--r-sm);
		overflow: hidden;
	}
	.atlas--glass {
		background: var(--surface);
		-webkit-backdrop-filter: blur(var(--glass-blur));
		backdrop-filter: blur(var(--glass-blur));
	}
	.atlas-id {
		display: grid;
		place-items: center;
		background: var(--surface);
	}
	.atlas--glass .atlas-id {
		background: none;
	}
	/* ⚠ THE GLYPH IS CLIPPED TO THE DARK HALF, and that is not a detail: the real
	   role artwork is near-black, drawn to read as a deeper pool IN dark slate.
	   Cross it onto parchment and it inverts wrongly. A stand-in glyph here. */
	.atlas-glyph {
		font-size: 64px;
		line-height: 1;
		color: rgb(0 0 0 / 0.35);
	}
	.atlas-body {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.3rem;
		padding: 1rem 1.2rem;
		background: var(--surface);
	}
	.atlas--glass .atlas-body {
		background: none;
	}
</style>
