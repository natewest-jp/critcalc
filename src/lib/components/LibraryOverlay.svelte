<script lang="ts">
	/**
	 * LibraryOverlay — the Library over a TOOL (lineups design §10.1a), opened
	 * by band A's Library button and the chrome's Roster button, and rendered
	 * by the (tools) layout so it outlives a tool pan. It is a scrim and a
	 * window; everything inside is `LibraryView`, which the standalone
	 * `/library` page renders too.
	 */
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import LibraryView from './LibraryView.svelte';
	import { library } from '$lib/library.svelte';
</script>

<!-- The library fades on --t-quick — a SURFACE (a scrim over the whole
     viewport). The layout's `{#if library.open}` is this component's block, so
     the local transitions run on open and close. `outroInert` is the
     outro-eats-your-click fix ($lib/motion); ⛔ don't drop it. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="lib-scrim"
	onclick={() => library.close()}
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
></div>
<div
	class="lib-window"
	role="dialog"
	aria-modal="true"
	aria-label="Library"
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
>
	<LibraryView onclose={() => library.close()} />
</div>

<style>
	.lib-scrim {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgb(0 0 0 / 0.35);
	}
	.lib-window {
		position: fixed;
		z-index: 61;
		inset: 4.25rem 1.5rem 1.5rem;
		border-radius: var(--r-lg, 6px);
		/* The modals' light edge (ChromeOverlay's .overlay-panel), set at the
		   same level — outside the body's .ctx-dark — so --border resolves as
		   theirs does (⚓ Nate, 2026-10-18: it was the one window without it). */
		border: 1px solid var(--border);
		overflow: hidden;
	}
	/* ── Narrow: the window takes the screen (roomy, 47.5rem — $lib/breakpoints.ts) ── */
	@media (max-width: 47.5rem) {
		.lib-window {
			inset: 3.5rem 0 0;
			border-radius: 0;
			/* Edge to edge, a border would only outline the screen. */
			border: 0;
		}
	}
</style>
