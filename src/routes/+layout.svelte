<script lang="ts">
	import '@fontsource-variable/bitter';
	import '@fontsource-variable/noto-sans';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>critcalc.app</title>
	<meta
		name="description"
		content="Genshin Impact tools for planning and theorycrafting."
	/>
</svelte:head>

<div class="site-shell">
	<header class="site-header">
		<a class="brand" href="/" aria-label="critcalc home">
			<img class="brand__logo" src="/logo.webp" alt="critcalc logo" />
			<span class="brand__name">critcalc.app</span>
		</a>

		<nav class="site-nav" aria-label="Primary navigation">
			<a href="/about">about</a>
			<a href="/">games &#8652;</a>
		</nav>
	</header>

	<main class="site-main">
		{@render children()}
	</main>

	<footer class="site-footer">
		<p>
			&#169; 2026 <strong>critcalc.app</strong>, an unofficial fan project not affiliated with or
			endorsed by HoYoverse. Genshin Impact and all related trademarks and assets are &#169;
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
		width: 100%;
	}

	.brand__logo {
		width: clamp(6rem, 12vw, 7.5rem);
		height: clamp(6rem, 12vw, 7.5rem);
		object-fit: contain;
	}

	.brand__name {
		font-family: 'Bitter Variable', Bitter, serif;
		font-size: clamp(3rem, 6vw, 3.75rem);
		line-height: 1;
		letter-spacing: 0.02em;
	}

	.site-nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
	}

	.site-nav a {
		padding: 0.55rem 0.9rem;
		font-weight: 500;
		color: var(--muted);
		transition: color 150ms ease, border-color 150ms ease;
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
			align-items: center;
			justify-content: space-between;
		}

		.brand {
			width: auto;
			justify-content: flex-start;
		}

		.site-nav {
			width: auto;
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