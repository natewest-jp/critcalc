<script lang="ts">
	import '@fontsource-variable/bitter';
	import '@fontsource/ibm-plex-sans/400.css';
	import '@fontsource/ibm-plex-sans/600.css';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/600.css';
	// Condensed is an opt-in layout tool (--font-condensed). Registering its
	// @font-face here makes the family available on demand; the woff2 isn't
	// fetched until something actually renders in it, so there's no first-paint
	// cost from loading it.
	import '@fontsource/ibm-plex-sans-condensed/400.css';
	import '@fontsource/ibm-plex-sans-condensed/600.css';
	// Preload the latin font files used above the fold on every page: Bitter
	// (display), Plex Sans 400/600 (body), and Plex Mono 400 (the dense data
	// columns every tool renders). Without these the browser only discovers the
	// fonts after downloading and parsing the bundled CSS — on 3G-class
	// connections that pushed the swap far into the load (font-display: swap
	// keeps text visible either way). ?url resolves to the same hashed asset the
	// @fontsource CSS references, so nothing is fetched twice. crossorigin is
	// required for font preloads even same-origin.
	import bitterLatinUrl from '@fontsource-variable/bitter/files/bitter-latin-wght-normal.woff2?url';
	import bodyRegularUrl from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url';
	import bodySemiboldUrl from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2?url';
	import monoRegularUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { dev } from '$app/environment';

	let { children } = $props();

	// Dev-only grayscale review toggle (Cmd/Ctrl+Shift+G): hierarchy must
	// survive grayscale — if a surface reads as mud with the toggle on, its
	// structure is riding on hue, not lightness. Documented in /styleguide
	// § Laws. `dev` is statically false in prod, so the whole branch
	// tree-shakes out of the build.
	let devGray = $state(false);
	function onDevGrayKey(e: KeyboardEvent) {
		if (!dev) return;
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
			e.preventDefault();
			devGray = !devGray;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- iOS ignores the SVG and composites its own tile onto white, so it needs
	     a raster of the same opaque plate. Both come out of build-logo.mjs. -->
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={bitterLatinUrl} />
	<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={bodyRegularUrl} />
	<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={bodySemiboldUrl} />
	<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={monoRegularUrl} />
	<title>critcalc.app</title>
	<meta name="description" content="Genshin Impact tools for planning and theorycrafting." />
</svelte:head>

<svelte:window onkeydown={onDevGrayKey} />

{@render children()}

{#if dev && devGray}
	<!-- backdrop-filter overlay, NOT filter on the root: a root filter creates
	     a containing block and re-anchors position:fixed chrome/portals. The
	     overlay touches zero layout and grays the WebGL canvases too. Inline
	     style so no scoped CSS can leak into the prod bundle. z-index above
	     everything (codebase max is 1000). -->
	<div
		aria-hidden="true"
		style="position:fixed;inset:0;z-index:2147483647;pointer-events:none;-webkit-backdrop-filter:grayscale(1);backdrop-filter:grayscale(1)"
	></div>
{/if}
