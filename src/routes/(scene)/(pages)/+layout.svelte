<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import {
		FADE_DURATION_MS,
		FADE_OUT_MS,
		FADE_OVERLAP_MS,
		timeUntilSettle
	} from '$lib/landing/transition';

	let { children } = $props();
	const pathname = $derived(page.url.pathname);

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
		if (event.key === 'Escape') toLanding();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="pages-shell"
	onclick={onBackdropClick}
	in:fade|global={{
		duration: FADE_DURATION_MS,
		delay: Math.max(0, timeUntilSettle() - FADE_DURATION_MS + FADE_OVERLAP_MS)
	}}
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
			<div in:fade={{ duration: 150 }}>
				{@render children()}
			</div>
		{/key}
	</main>
</div>

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
		width: min(860px, calc(100% - 2.5rem));
		margin: 0 auto;
		overflow-y: auto;
		background: var(--surface); /* modal role (Nate 2026-07-31) */
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		padding: clamp(1.4rem, 3vw, 2.4rem);
		box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
		will-change: transform;
	}

	/* Typography for the content itself is the shared `.prose` class in app.css
	   — the panel wears it. It has to live there rather than here because every
	   chapter also renders inside the chrome overlay, which is not under this
	   layout at all. */
</style>
