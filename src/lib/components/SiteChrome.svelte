<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	// The site-frame chrome (landing + static pages): the tool chrome's branding
	// and centred nav, with the three tool links cleanly swapped for the site
	// pages. No ?/gear actions — those belong to the tools. Position is owned by
	// the host (fixed on the landing, in-flow atop the pages' scroll column).
	const pathname = $derived(page.url.pathname);
	const nav = [
		{ href: '/about', label: 'About' },
		{ href: '/faq', label: 'Help' },
		{ href: '/privacy', label: 'Privacy' }
	] as const;
</script>

<header class="site-chrome">
	<a class="sc-brand" href={resolve('/')} aria-label="critcalc.app home">
		<img src="/critcalc-logo-white.svg" alt="" />
		<span class="sc-wordmark">critcalc.app</span>
	</a>

	<nav class="sc-nav" aria-label="Site">
		{#each nav as item (item.href)}
			{#if pathname === resolve(item.href)}
				<span class="sc-nav-link is-current" aria-current="page">{item.label}</span>
			{:else}
				<a class="sc-nav-link" href={resolve(item.href)}>{item.label}</a>
			{/if}
		{/each}
	</nav>
</header>

<style>
	/* Mirrors the tool chrome: brand left, nav dead-centre via 1fr/auto/1fr. */
	.site-chrome {
		position: relative;
		z-index: 10;
		height: var(--site-chrome-h);
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.9rem;
		padding: 0 clamp(1rem, 2vw, 2rem);
		pointer-events: none;
	}

	.site-chrome > * {
		pointer-events: auto;
	}

	.sc-brand {
		justify-self: start;
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.sc-brand img {
		width: 4.25rem;
		height: auto;
		margin-top: -0.085em;
		opacity: 0.85;
		transition: opacity 200ms ease;
	}

	.sc-wordmark {
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-tight);
		color: var(--text);
		opacity: 0.9;
		transition: opacity 200ms ease;
	}

	.sc-brand:hover img,
	.sc-brand:focus-visible img {
		opacity: 1;
	}

	.sc-brand:hover .sc-wordmark,
	.sc-brand:focus-visible .sc-wordmark {
		opacity: 1;
	}

	.sc-nav {
		justify-self: center;
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.sc-nav-link {
		position: relative;
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--muted);
		padding: 0.15rem 0;
		transition: color 150ms ease;
	}

	a.sc-nav-link:hover,
	a.sc-nav-link:focus-visible {
		color: var(--text);
	}

	/* Current page: brighter, non-interactive, accent underline — "you are here". */
	.sc-nav-link.is-current {
		color: var(--text);
		cursor: default;
	}

	.sc-nav-link.is-current::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -2px;
		height: 2px;
		border-radius: 1px;
		background: var(--accent);
	}

	@media (prefers-reduced-motion: reduce) {
		.sc-brand img,
		.sc-wordmark,
		.sc-nav-link {
			transition: none;
		}
	}
</style>
