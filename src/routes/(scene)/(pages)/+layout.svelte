<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { FADE_DURATION_MS, FADE_OUT_MS, revealDelayMs } from '$lib/landing/transition';
	import { motion, T_QUICK } from '$lib/motion';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import { get } from 'svelte/store';
	import { nextLayout } from '$lib/nextLayout';
	import { menu, sectionForPath } from '$lib/menuState.svelte';

	let { children } = $props();
	const pathname = $derived(page.url.pathname);

	// ⚓ Under the switch (build plan §13, 2c) every page here is a SECTION of
	// the menu state, which the scene layout renders: the address names it,
	// and the floating panel is not drawn (nor the page's component mounted —
	// the old /library page would restore and persist the old tab models).
	const nextOn = get(nextLayout);
	$effect(() => {
		if (!nextOn) return;
		menu.routed = sectionForPath(pathname, page.url.search) ?? 'index';
		return () => (menu.routed = null);
	});

	// Content pages behave like a modal on the live scene: a fixed panel between
	// the chrome and footer (its content scrolls INSIDE it, so the frame stays
	// put), parallaxed like a giant hero card; clicking the backdrop or pressing
	// Escape returns to the landing. The parallax controller itself is owned by
	// the scene layout, so it doesn't reset when you arrive here.
	function toLanding() {
		goto(resolve('/'));
	}
	function onBackdropClick(event: MouseEvent) {
		// Only a click on the backdrop itself (the scene around the panel), never
		// one that bubbled up from the panel.
		if (event.target === event.currentTarget) toLanding();
	}
	function onKeydown(event: KeyboardEvent) {
		// A page that spent the Escape on something of its own (the Library
		// dismissing a menu or a search) marks it defaultPrevented.
		if (event.key === 'Escape' && !event.defaultPrevented && !nextOn) toLanding();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if !nextOn}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="pages-shell"
		onclick={onBackdropClick}
		in:fade|global={{ duration: FADE_DURATION_MS, delay: revealDelayMs() }}
		out:fade|global={{ duration: FADE_OUT_MS }}
	>
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
				<div class="pages-page" in:fade={{ duration: motion(T_QUICK) }}>
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
	/* Full-viewport backdrop: catches "click outside the panel" → landing. */
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
