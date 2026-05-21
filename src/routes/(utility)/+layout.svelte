<script lang="ts">
	import { page } from '$app/state';
	import { fade } from 'svelte/transition';

	let { children } = $props();
	const pathname = $derived(page.url.pathname);
</script>

<div class="site-shell">
	<header class="site-header">
		<a class="brand" href="/" aria-label="critcalc home">
			<img class="brand__logo" src="/critcalc-logo.svg" alt="" />
			<span class="brand__name">critcalc.app</span>
		</a>

		<nav class="site-nav" aria-label="Primary navigation">
			<a href="/about">about</a>
			<a href="/">games</a>
		</nav>
	</header>

	<main class="site-main">
		{#key pathname}
			<div class="page-transition" in:fade={{ duration: 240 }} out:fade={{ duration: 160 }}>
				{@render children()}
			</div>
		{/key}
	</main>

	<footer class="site-footer">
		<p>
			&copy; 2026 <strong>critcalc.app</strong>, an unofficial fan project not affiliated with or
			endorsed by HoYoverse. Genshin Impact and all related trademarks and assets are &copy;
			HoYoverse.
		</p>
	</footer>
</div>

<style>
	.site-shell {
		max-width: 1080px;
		margin: 0 auto;
		padding: 1rem;
	}

	.site-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem 0 1.5rem;
	}

	.brand {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
	}

	.brand__logo {
		width: clamp(3.5rem, 7vw, 5rem);
		height: auto;
	}

	.brand__name {
		font-family: 'Bitter Variable', Bitter, serif;
		font-size: clamp(2rem, 4.5vw, 3rem);
		line-height: 1;
		letter-spacing: 0.02em;
	}

	.site-nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
	}

	.site-nav a {
		padding: 0.55rem 0.9rem;
		font-weight: 500;
		color: var(--muted);
		transition: color 200ms ease;
	}

	.site-nav a:hover,
	.site-nav a:focus-visible {
		color: var(--text);
	}

	.site-main {
		padding-block: 1.5rem 2rem;
	}

	@media (min-width: 760px) {
		.site-header {
			flex-direction: row;
			justify-content: space-between;
		}
	}

	.site-footer {
		margin-top: clamp(0.5rem, 1.2vw, 0.9rem);
		padding-top: 0.2rem;
		padding-inline: clamp(0.3rem, 1vw, 0.8rem);
		color: var(--muted);
		font-size: 0.74rem;
		text-align: center;
	}

	.site-footer p {
		margin: 0;
	}
</style>
