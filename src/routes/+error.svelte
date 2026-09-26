<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { dev } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';
	import VeilGround from '$lib/components/VeilGround.svelte';

	// ⚠️ THIS PAGE RENDERS OUTSIDE THE SCENE, AND THAT IS DELIBERATE.
	//
	// SvelteKit resolves an unmatched URL against no route, so no route group
	// applies: only the ROOT layout wraps this, which means no GL canvas, no
	// SiteChrome, no footer. Rather than fight that, lean on it — an error page
	// should not boot a WebGL scene to tell you a link was mistyped. The body
	// already paints --bg (app.css), so the night ground arrives for free and
	// this component paints no background of its own.
	//
	// Root roles only (--text / --muted / --accent / --border / .btn). No context
	// claim, matching /styleguide, the only other off-scene route.

	const status = $derived(page.status);
	const isNotFound = $derived(status === 404);

	// The three tools, offered on a 404 — someone who mistyped a URL or followed
	// a broken link is usually trying to reach one of them, and a dead end that
	// only says "go home" makes them do the navigating twice.
	const tools = [
		{ label: 'Team Builder', path: '/team-builder' },
		{ label: 'Rotation Planner', path: '/rotation-planner' },
		{ label: 'Visualizers', path: '/visualizers' }
	] as const;
</script>

<main class="error-page">
	<!-- ⚓ Nate 2026-09-26: the loading veil's ground (gradient + grain),
	     shared through VeilGround. Fixed, so it holds the viewport while a long
	     message scrolls. -->
	<VeilGround fixed />
	<div class="error-inner">
		<img class="mark" src={favicon} alt="" width="44" height="44" />

		<p class="status">{status}</p>

		{#if isNotFound}
			<h1>We couldn't find that page.</h1>
			<p class="lede">
				The address may be mistyped — or, if you followed a shared link, it may have been cut short
				on its way here. Share links are long, and chat apps sometimes trim them.
			</p>
		{:else}
			<h1>Something went wrong.</h1>
			<p class="lede">
				That's on us, not on you. Reloading often clears it. If it keeps happening, telling us what
				you were doing is genuinely useful — critcalc is one person's project and reports are how
				problems get found.
			</p>
		{/if}

		<div class="actions">
			<a class="btn btn--primary" href={resolve('/')}>Back to critcalc</a>
			{#if !isNotFound}
				<a class="btn" href={resolve('/contribute')}>Report a problem</a>
			{/if}
		</div>

		{#if isNotFound}
			<nav class="tools" aria-label="Tools">
				<span class="tools-label">Looking for a tool?</span>
				<ul>
					{#each tools as tool (tool.path)}
						<li><a href={resolve(tool.path)}>{tool.label}</a></li>
					{/each}
				</ul>
			</nav>
		{/if}

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
		padding: clamp(1.5rem, 6vw, 4rem);
	}

	.error-inner {
		/* Positioned so it paints above VeilGround. */
		position: relative;
		width: min(34rem, 100%);
		text-align: center;
	}

	.mark {
		display: block;
		margin: 0 auto clamp(1.25rem, 3vh, 2rem);
		opacity: 0.9;
	}

	/* The status number is the one gold block on the page. Gold names a BLOCK,
	   never a word (⚓ palette-definition round), and a bare numeral standing
	   alone is a block — it is not emphasis inside a sentence. */
	.status {
		margin: 0 0 0.5rem;
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-widest);
		color: var(--accent);
	}

	h1 {
		margin: 0 0 0.75rem;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		line-height: var(--lh-tight);
		color: var(--text);
	}

	.lede {
		margin: 0 auto;
		max-width: 30rem;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--muted);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
		margin-top: clamp(1.5rem, 4vh, 2.25rem);
	}

	.tools {
		margin-top: clamp(1.75rem, 4vh, 2.5rem);
		padding-top: clamp(1.25rem, 3vh, 1.75rem);
		border-top: 1px solid var(--border);
	}

	.tools-label {
		display: block;
		margin-bottom: 0.6rem;
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}

	.tools ul {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.4rem 1.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tools a {
		font-size: var(--fs-sm);
		color: var(--text);
	}

	.dev-detail {
		margin: 2rem 0 0;
		padding: 0.75rem 1rem;
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		text-align: left;
		color: var(--muted);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
	}
</style>
