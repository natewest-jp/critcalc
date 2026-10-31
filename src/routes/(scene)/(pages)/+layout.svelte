<script lang="ts">
	import { page } from '$app/state';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import { browser } from '$app/environment';
	import { menu, sectionForPath } from '$lib/menuState.svelte';

	let { children } = $props();
	const pathname = $derived(page.url.pathname);

	// ⚓ Every page here is a SECTION of the menu state (build plan §13, 2c),
	// which the scene layout renders in the browser: the address names it, and
	// the floating panel below is not drawn there. ⚠ The SERVER still draws the
	// panel with the page inside it, so the prerendered HTML carries each
	// page's text for search engines and readers without JavaScript; the
	// browser drops it at hydration.
	$effect(() => {
		menu.routed = sectionForPath(pathname, page.url.search) ?? 'index';
		return () => (menu.routed = null);
	});
</script>

{#if !browser}
	<div class="pages-shell">
		<!-- NOT .prose. Every route in this group renders either HelpAreaShell —
	     which wraps its chapter in its own <article class="prose"> — or
	     SettingsPanel, which is not prose at all. The outer class was redundant
	     in both cases and leaked prose typography onto the chapter NAV and the
	     settings rows; it only became visible when links gained a resting
	     underline and the nav sprouted full-width rules. -->
		<main class="pages-panel">
			{#key pathname}
				<!-- Full height, so an area page can fill the panel and scroll inside
			     (HelpAreaShell's `.area-page`). Taller content (the Library) just
			     overflows it, and the panel scrolls as before. -->
				<div class="pages-page">
					{@render children()}
				</div>
			{/key}
			<!-- The legal footer's SHORT-screen place: the end of the reading (see
		     the style). Shown only there, where the fixed one steps aside. -->
			<div class="pages-legal"><SiteFooter inPanel /></div>
		</main>
	</div>
{/if}

<style>
	/* Full-viewport backdrop. */
	.pages-shell {
		position: absolute;
		inset: 0;
		z-index: 2;
	}

	/* Fixed panel between the chrome (top) and footer (bottom); its own content
	   scrolls internally so the frame — and the scene behind it — stay put.
	   Above the footer gradient (z:1), below the chrome/footer. */
	.pages-panel {
		position: fixed;
		top: calc(var(--chrome-h) + clamp(0.75rem, 2vh, 1.5rem));
		bottom: calc(var(--site-footer-h) + clamp(0.5rem, 1.5vh, 1rem));
		left: 0;
		right: 0;
		/* ⚓ ONE width for every static page, the About/Help overlay's 72rem (⚓ Nate
		   2026-09-23): the coverage table fits it, and prose keeps its own 56ch
		   measure, so the extra width is margin, never longer lines. */
		width: min(72rem, calc(100% - 2.5rem));
		margin: 0 auto;
		overflow-y: auto;
		background: var(--surface); /* modal role (Nate 2026-07-31) */
		border: 1px solid var(--border);
		border-radius: var(--r-md); /* modals keep the softer corner — see the geometry block */
		padding: clamp(1.4rem, 3vw, 2.4rem);
		box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
		will-change: transform;
	}

	/* ── A SHORT SCREEN (responsive sweep §3 item 7, ⚓ Nate 2026-10-15) ──
	   (max-height: 30rem) — breakpoints.ts § THE HEIGHT AXIS; the literal,
	   because custom properties do not work in media queries. On a landscape
	   phone the fixed chrome and footer took 148px and left the panel 170–280px
	   to read in. So the panel runs to the screen's foot, and the legal footer
	   is the last thing IN it, met at the end of the scroll; the fixed one
	   steps aside (the scene layout). The landing keeps its fixed footer. */
	.pages-page {
		height: 100%;
	}
	.pages-legal {
		display: none;
	}
	@media (max-height: 30rem) {
		.pages-panel {
			bottom: clamp(0.5rem, 1.5vh, 1rem);
		}
		.pages-legal {
			display: block;
			margin-top: 2rem;
		}
	}

	/* Typography for the content itself is the shared `.prose` class in app.css
	   — the panel wears it. It has to live there rather than here because every
	   chapter also renders inside the chrome overlay, which is not under this
	   layout at all. */
</style>
