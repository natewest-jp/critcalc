<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { dev } from '$app/environment';
	import VeilGround from '$lib/components/VeilGround.svelte';
	import HRule from '$lib/components/HRule.svelte';
	import { TOOLS } from '$lib/tools';
	import ReportLink from '$lib/components/ReportLink.svelte';
	import { feedbackToolForPath } from '$lib/feedback';

	// ⚠️ THIS PAGE RENDERS OUTSIDE THE SCENE, AND THAT IS DELIBERATE.
	//
	// SvelteKit resolves an unmatched URL against no route, so no route group
	// applies: only the ROOT layout wraps this, which means no GL canvas, no
	// SiteChrome, no footer. Rather than fight that, lean on it — an error page
	// should not boot a WebGL scene to tell you a link was mistyped.
	//
	// ↻ ⚓ Nate 2026-09-26, the design pass (the COPY is the text round's —
	// docs/text/sheets/errors-and-frame.md — and is carried here verbatim):
	// - The ground is VeilGround, the loading veil's night gradient + grain.
	// - The identity is the CHROME'S OWN LOCKUP (mark + critcalc.app), centred,
	//   as the home link — ⛔ not the favicon, which is an app-icon tile cropped
	//   for 16px, and ⛔ not the full SiteChrome: its About / Help / Settings
	//   open overlays hosted by the scene layout this page is outside of, and
	//   its tool switcher would duplicate the tool links below.
	// - Everything sits INSIDE two of Nate's capped rules (the veil's own
	//   device), headed by the lockup, which is the home link. No "Back to
	//   critcalc" button, no "Looking for a tool?" label and no visible status
	//   number: the server already sends the 404, SeoHead titles the tab
	//   "Page not found" (noindex), and the heading says it in words. The
	//   three tools sit under the lede — four ways out, the page's whole job. Only a non-404 keeps a
	//   button, "Report a problem", the one action that is not a way out.
	// - The tool links are the site's plain .link; the type follows the content
	//   pages (16px prose, 24px heading).
	//
	// Root roles only (--text / --muted / --accent / --chrome / .btn). No
	// context claim, matching /styleguide, the only other off-scene route.

	const isNotFound = $derived(page.status === 404);
</script>

<main class="error-page">
	<VeilGround fixed />

	<div class="error-inner">
		<div class="rule"><HRule /></div>

		<!-- The chrome's lockup heads the block and IS the home link (same
		     proportions as SiteChrome .chrome-brand — the mark 1.5714× the
		     wordmark, lifted −0.18em). -->
		<a class="brand" href={resolve('/')} aria-label="critcalc.app home">
			<img src="/critcalc-logo-white.svg" alt="" />
			<span class="wordmark">critcalc.app</span>
		</a>

		{#if isNotFound}
			<h1>That page couldn’t be found.</h1>
			<p class="flavor">It might very well belong to the Abyss.</p>
			<p class="lede">
				The address may be mistyped, or if you followed a shared link, it may have been cut short on
				its way here. Share links are long, and chat apps sometimes trim them.
			</p>
		{:else}
			<h1>Something went wrong.</h1>
			<p class="flavor">
				A star slipped its course tonight. Sumeru’s star-readers logged the deviation, reset their
				instruments, and looked again.
			</p>
			<p class="lede">
				This was a site error, not something you did wrong. Reloading often clears it. If it keeps
				happening, please report it and say what you were doing when it broke.
			</p>
			<!-- The one action that is not a way OUT, so it keeps its button. -->
			<!-- ↻ 2026-10-15: a server-side failure (≥ 500) reports straight to
			     the feedback form, carrying the status and the build; any other
			     status keeps Contribute, which links the form too. -->
			<div class="actions">
				{#if page.status >= 500}
					<ReportLink
						class="btn btn--glass ctx-glass"
						prefill={{
							category: 'broken',
							tool: feedbackToolForPath(page.url.pathname),
							error: `${page.status} ${page.error?.message ?? ''}`
						}}>Report a problem</ReportLink
					>
				{:else}
					<a class="btn btn--glass ctx-glass" href={resolve('/contribute')}>Report a problem</a>
				{/if}
			</div>
		{/if}

		<!-- The three tools, read from the one tool registry — someone who
		     mistyped a URL or followed a broken link is usually trying to reach
		     one of them. With the lockup above, four ways out. -->
		<nav class="tools-nav" aria-label="Tools">
			<ul class="tools">
				{#each TOOLS as tool (tool.path)}
					<li><a class="link" href={resolve(tool.path)}>{tool.title}</a></li>
				{/each}
			</ul>
		</nav>

		<div class="rule"><HRule /></div>

		<!-- Dev only: the real message. In production SvelteKit collapses every
		     non-404 to "Internal Error", so there is nothing here worth showing a
		     reader — and a raw stack would be noise at best. -->
		{#if dev && page.error?.message}
			<pre class="dev-detail">{page.error.message}</pre>
		{/if}
	</div>
</main>

<style>
	/* Min-height rather than fixed inset so a long message can scroll on a
	   short window. The ground is VeilGround, fixed to the viewport. */
	.error-page {
		min-height: 100svh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: clamp(1.5rem, 6vw, 4rem) 1rem;
	}

	.error-inner {
		/* Positioned so it paints above VeilGround. */
		position: relative;
		width: min(40rem, 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	/* Nate's capped rule, top and bottom, at the footer's quiet strength:
	   muted ink, faded as a group. A measured column, so the caps read as a
	   frame around the block rather than a page-wide divider. */
	.rule {
		width: min(30rem, 100%);
		--rule-tint: var(--muted);
		--rule-opacity: 0.35;
	}

	/* The content pages' heading size (--fs-4xl, as AreaTabs), in Bitter. */
	h1 {
		margin: 0 0 0.9rem;
		font-family: var(--font-display);
		font-size: var(--fs-4xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		line-height: var(--lh-tight);
		color: var(--text);
		text-wrap: balance;
	}

	/* The flavor line (2026-10-16): the content pages' .prose .flavor, which
	   this page sits outside of — italic, quiet, between heading and lede. */
	.flavor {
		margin: 0 auto 0.9rem;
		max-width: 34rem;
		font-size: var(--fs-xl);
		font-style: italic;
		line-height: var(--lh-relaxed);
		color: var(--muted);
		text-wrap: pretty;
	}

	.lede {
		margin: 0 auto;
		max-width: 34rem;
		/* The content pages' prose size. */
		font-size: var(--fs-xl);
		line-height: var(--lh-relaxed);
		color: var(--muted);
		text-wrap: pretty;
	}

	/* Non-404 only: a glass pane on the night (.btn.btn--glass + .ctx-glass on
	   itself — see app.css), a size up from the toolbar default. */
	.actions {
		margin-top: clamp(1.5rem, 4vh, 2rem);
	}

	.actions .btn {
		padding: 0.5rem 1rem;
		font-size: var(--fs-lg);
	}

	/* ── The lockup: SiteChrome's .chrome-brand, heading the block ──────── */
	/* At the chrome's own size, and it is the home link. Same knobs and the
	   same chrome state contract (rest at .85, hover to opaque, --t-quick).
	   ⚠ If the chrome's proportions move, move these. */
	.brand {
		--brand-size: var(--fs-4xl);
		--brand-mark: 1.5714;
		--brand-lift: -0.18;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: clamp(1.75rem, 4.5vh, 2.5rem) 0 clamp(1.25rem, 3.5vh, 1.75rem);
		font-size: var(--brand-size);
		text-decoration: none;
	}

	.brand img {
		height: calc(var(--brand-size) * var(--brand-mark));
		width: auto;
		margin-top: calc(var(--brand-size) * var(--brand-lift));
		opacity: 0.85;
		transition: opacity var(--t-quick);
	}

	.wordmark {
		font-family: var(--font-display);
		font-size: var(--brand-size);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-tight);
		color: var(--chrome);
		opacity: 0.85;
		transition: opacity var(--t-quick);
	}

	.brand:hover img,
	.brand:focus-visible img,
	.brand:hover .wordmark,
	.brand:focus-visible .wordmark {
		opacity: 1;
	}

	.tools-nav {
		margin: clamp(1.75rem, 4.5vh, 2.25rem) 0 clamp(1.75rem, 4.5vh, 2.5rem);
	}

	/* The tools: the site's plain .link at prose size. Spacing, not separator
	   dots — a dot orphans at the head of a wrapped line on a phone, and the
	   underlined links already read as three. */
	.tools {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem 1.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--fs-xl);
	}

	.dev-detail {
		width: 100%;
		margin: 2rem 0 0;
		padding: 0.75rem 1rem;
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		text-align: left;
		color: var(--muted);
		background: var(--surface);
		border-radius: var(--r-sm);
	}
</style>
