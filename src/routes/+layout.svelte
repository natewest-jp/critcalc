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
			<a href="/">Home</a>
			<a href="/">Characters</a>
			<a href="/">Abyss Planner</a>
		</nav>
	</header>

	<main class="site-main">
		{@render children()}
	</main>

	<footer class="site-footer">
		<p>
			&#169; 2026 <strong>weaselthief</strong>, an unofficial fan project not affiliated with or
			endorsed by HoYoverse. Genshin Impact and all related trademarks and assets are &#169;
			HoYoverse.
		</p>
	</footer>
</div>
