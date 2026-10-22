<script lang="ts">
	import '@fontsource-variable/bitter';
	// ══ THE BODY FACE IS VARIABLE (⚓ NATE 2026-08-11) ═════════════════════════
	// This was `ibm-plex-sans/400.css` + `/600.css`, and those two static faces
	// were the WHOLE of the body ladder: --fw-medium (500) resolved onto 400 and
	// --fw-bold (700) onto 600, so four tokens rendered as two weights and any
	// hierarchy written across them was decorative. Nate spotted the 400/500
	// half of it by eye.
	//
	// ⚠ THE FIX IS CHEAPER THAN THE BUG. The weight-axis latin file is 44.6 KB
	// and carries 100–700 continuously; the two statics it replaces were 22.1 +
	// 23.7 = 45.8 KB. So the whole ladder costs 1.2 KB LESS than the two rungs
	// did, in one request instead of two. Adding statics for 500 and 700 would
	// have been the obvious move and the wrong one — 91.7 KB for four fixed
	// rungs and four round trips.
	//
	// ⚠ `/wght.css` SPECIFICALLY, not the bare package. The default entry pulls
	// the `standard` axis file (64.0 KB — it carries width as well), and there
	// are italic twins beside it we never set. Weight is the only axis this
	// design uses.
	// ⚠ The family it registers is 'IBM Plex Sans Variable', NOT 'IBM Plex Sans'
	// — the same split Bitter already has. Every consumer names it through
	// --font-body except the PNG exporter, which needs a literal for canvas.
	import '@fontsource-variable/ibm-plex-sans/wght.css';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/600.css';
	// Condensed is an opt-in layout tool (--font-condensed). Registering its
	// @font-face here makes the family available on demand; the woff2 isn't
	// fetched until something actually renders in it, so there's no first-paint
	// cost from loading it.
	import '@fontsource/ibm-plex-sans-condensed/400.css';
	import '@fontsource/ibm-plex-sans-condensed/600.css';
	// Preload the latin font files used above the fold on every page: Bitter
	// (display), Plex Sans variable (body — ONE file for every weight now, where
	// this used to preload a 400 and a 600), and Plex Mono 400 (the dense data
	// columns every tool renders). Without these the browser only discovers the
	// fonts after downloading and parsing the bundled CSS — on 3G-class
	// connections that pushed the swap far into the load (font-display: swap
	// keeps text visible either way). ?url resolves to the same hashed asset the
	// @fontsource CSS references, so nothing is fetched twice. crossorigin is
	// required for font preloads even same-origin.
	import bitterLatinUrl from '@fontsource-variable/bitter/files/bitter-latin-wght-normal.woff2?url';
	import bodyVariableUrl from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url';
	import monoRegularUrl from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url';
	import favicon from '$lib/assets/favicon.svg';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import '../app.css';
	import { dev } from '$app/environment';
	import { onMount } from 'svelte';
	import { nextLayout } from '$lib/nextLayout';

	let { children } = $props();

	// The switch (build plan §13.1; `?next` / `?next=0`, read by the module).
	// While it is on, the new storage opens and migrates (copy-only). Loaded on
	// demand, so a visitor with the switch off downloads none of it.
	onMount(() => {
		return nextLayout.subscribe((on) => {
			if (on) void import('$lib/storage/boot').then((m) => m.ensureStorage());
		});
	});

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
	     a raster of the same opaque plate. Built by build-app-icons.mjs from the favicon's mark and plate. -->
	<link rel="apple-touch-icon" href="/apple-touch-icon-v2.png" />
	<!-- ⚓ THE WEB APP (2026-10-14): added to a home screen, the site opens
	     full-screen with no browser bars — the one way to give a phone back the
	     strip Safari and Chrome spend above the keyboard. Icons and manifest
	     from scripts/build-app-icons.mjs + static/manifest.webmanifest.
	     theme-color is the page ground, so a browser tinting its bars to the
	     page lands where it already lands; the iOS tags cover a home-screen
	     launch on Safari versions that read them rather than the manifest. -->
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#050b19" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="critcalc" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black" />
	<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={bitterLatinUrl} />
	<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={bodyVariableUrl} />
	<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={monoRegularUrl} />
</svelte:head>

<!-- Title, description, canonical and every og:/twitter: tag, for EVERY route,
     from the one map in $lib/seo.ts. ⚠️ Rendered here and NOWHERE else: pages
     must not add their own <svelte:head> title, because head content is not
     deduped and two titles leave the choice to each scraper. -->
<SeoHead />

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
