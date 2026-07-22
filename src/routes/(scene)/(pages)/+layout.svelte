<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { parallaxLayer, PARALLAX_CONTENT_FACTOR } from '$lib/landing/parallax';
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
	<main
		class="pages-panel"
		use:parallaxLayer={{ x: PARALLAX_CONTENT_FACTOR, y: PARALLAX_CONTENT_FACTOR }}
	>
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
	   scrolls internally so the frame — and the scene behind it — stay put. The
	   parallax transform (written by parallaxLayer) rides on top of the margin
	   centring. Above the footer gradient (z:1), below the chrome/footer. */
	.pages-panel {
		position: fixed;
		top: calc(var(--site-chrome-h) + clamp(0.75rem, 2vh, 1.5rem));
		bottom: calc(var(--site-footer-h) + clamp(0.5rem, 1.5vh, 1rem));
		left: 0;
		right: 0;
		width: min(860px, calc(100% - 2.5rem));
		margin: 0 auto;
		overflow-y: auto;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: clamp(1.4rem, 3vw, 2.4rem);
		box-shadow:
			0 18px 50px rgba(0, 0, 0, 0.45),
			inset 0 1px 0 rgba(255, 255, 255, 0.05);
		will-change: transform;
	}

	/* ── Shared prose typography for every content page ─────────────────────
	   Pages emit plain semantic HTML; the panel styles it so About / FAQ /
	   Privacy read as one system. Headings inherit the global body face (IBM
	   Plex Sans). Components with their own scoped classes (e.g. SettingsPanel)
	   out-specify these and are unaffected. */
	.pages-panel :global(h1) {
		margin: 0 0 1.2rem;
		font-size: var(--fs-4xl);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-tight);
	}

	.pages-panel :global(h2) {
		margin: 2rem 0 0.8rem;
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
	}

	.pages-panel :global(h3) {
		margin: 1.4rem 0 0.5rem;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}

	.pages-panel :global(p) {
		margin: 0 0 0.9rem;
		line-height: var(--lh-relaxed);
		color: var(--text);
	}

	.pages-panel :global(ul) {
		margin: 0 0 0.9rem;
		padding-left: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.pages-panel :global(li) {
		padding-left: 0.2rem;
		line-height: var(--lh-normal);
	}

	.pages-panel :global(a) {
		color: var(--accent);
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color 150ms ease;
	}

	.pages-panel :global(a:hover),
	.pages-panel :global(a:focus-visible) {
		border-bottom-color: var(--accent);
	}

	.pages-panel :global(section[id]) {
		scroll-margin-top: 1rem;
	}

	.pages-panel :global(.lede) {
		font-size: var(--fs-lg);
		color: var(--muted);
	}
</style>
