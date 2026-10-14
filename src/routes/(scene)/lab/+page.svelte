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
	/*
	 * ↻ CLEARED 2026-10-14 (⚓ Nate: "almost everything in the lab is quite old").
	 * The board had grown into an archive of finished rounds — the side
	 * portrait knobs, the size-up, the night paints, the gold inset, the pane
	 * states, the parchments, gold in text, the Atlas card proposals, the bench
	 * on the scene, the element palette and its bar rung, the UI state colours.
	 * Every one shipped or was settled, and its values live in app.css / their
	 * modules as tune(nate) numbers. The full board, with its measuring code
	 * (contrast, OKLCH ladders, BAR_BALANCE/BAR_DENSITY), is in git at
	 * 40bcb5b1 — `git show 40bcb5b1:"src/routes/(scene)/lab/+page.svelte"`.
	 * What stays is the board's standing job: every ground, same content.
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
	 * ⚠ THE TAGS ARE MAINTAINED BY HAND, and the CSS below is pinned by hand to
	 * match them — /lab is excluded from the mechanical size sweep on purpose.
	 * A board that rode the scale would always agree with itself and could never
	 * show you a rung that had gone missing.
	 */
	const TYPE_ROWS = [
		{ cls: 'ty-h1', tag: '4xl · 24', text: 'Section heading' },
		{ cls: 'ty-h2', tag: '3xl · 20', text: 'Subheading · .title' },
		{ cls: 'ty-h3', tag: '2xl · 18', text: 'Emphasized body' },
		{ cls: 'ty-body', tag: 'xl · 16', text: 'Body — prose.' },
		{ cls: 'ty-dense', tag: 'lg · 14', text: 'Dense body — tables, data rows.' },
		{ cls: 'ty-label', tag: 'md · 12', text: 'Controls · tabs · chips' },
		{ cls: 'ty-caption', tag: 'sm · 11', text: 'Labels / meta' }
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
	.lab-head p {
		margin: 0;
		max-width: 90ch;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--text);
	}

	.lab-h {
		margin: 0 0 0.5rem;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		color: var(--chrome);
	}

	.lab-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		align-items: start;
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
	/* ↻ 2026-08-11: the glass specimen has no rule of its own any more. It held
	   exactly the blur, and with that retired the panel is just .spec — whose
	   `background: var(--surface)` resolves to --glass-panel under .ctx-glass,
	   which is the whole of what the material now is. */

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
	/* ⚠ THESE RUNGS ARE PINNED BY HAND, and /lab is excluded from the mechanical
	   size-shift for exactly that reason: the ladder here has to SHOW the scale,
	   not ride it. If a sweep moved these too, the board would always agree with
	   itself and never reveal a rung that had gone missing. Keep the tags and
	   the tokens in step by hand — that is the job. */
	.ty-h1 {
		font-family: var(--font-display);
		font-size: var(--fs-4xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
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
		font-size: var(--fs-xl);
		color: var(--text);
	}
	.ty-dense {
		font-size: var(--fs-lg);
		color: var(--text);
	}
	/* ⚠ THE LABEL VOICE IS WHERE THE CONTEXTS DISAGREE. --muted is the DIM rung
	   on dark and the ANCHORING rung on paper, so this one row inverts while
	   every other row holds — which is the clearest single demonstration of the
	   ink ladder flipping, and the reason the ladder is rendered per ground
	   rather than once. */
	.ty-label {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	.ty-caption {
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.spec--bare .ty-label,
	.spec--bare .ty-caption {
		color: var(--text);
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
</style>
