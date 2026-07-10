<script lang="ts">
	import '@fontsource-variable/bitter';
	import '@fontsource/commit-mono/400.css';
	import '@fontsource/commit-mono/600.css';
	// Preload the three latin font files every page actually uses (Bitter
	// display + Commit Mono 400/600 body). Without these the browser only
	// discovers the fonts after downloading and parsing the bundled CSS —
	// on 3G-class connections that pushed the font swap far into the load
	// (font-display: swap keeps text visible either way). ?url resolves to the
	// same hashed asset the @fontsource CSS references, so nothing is fetched
	// twice. crossorigin is required for font preloads even same-origin.
	import bitterLatinUrl from '@fontsource-variable/bitter/files/bitter-latin-wght-normal.woff2?url';
	import monoRegularUrl from '@fontsource/commit-mono/files/commit-mono-latin-400-normal.woff2?url';
	import monoSemiboldUrl from '@fontsource/commit-mono/files/commit-mono-latin-600-normal.woff2?url';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={bitterLatinUrl} />
	<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={monoRegularUrl} />
	<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={monoSemiboldUrl} />
	<title>critcalc.app</title>
	<meta name="description" content="Genshin Impact tools for planning and theorycrafting." />
</svelte:head>

{@render children()}
