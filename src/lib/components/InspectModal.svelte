<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import Mark from '$lib/components/Mark.svelte';
	import { portal } from '$lib/actions/portal';
	import { closeOnLeave } from '$lib/closeOnLeave';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';

	/**
	 * THE INSPECTOR, AS A MODAL (inspector round, 2026-10-23; design §7).
	 *
	 * ⚓ Nate: the inspector is the CONTENT — reference about one thing, read,
	 * never edited — and each tool houses it in the shape its work wants. The
	 * Planner's sits beside the timeline, because you read a cast against the
	 * chart; the Builder's is this, because a character or a boss is read on
	 * its own, and a modal with room around it is the quickest thing on the
	 * site to leave: the dimmed edge is one large Back.
	 *
	 * So the shell keeps that edge. On a desk the panel never reaches the
	 * screen's sides (`--im-margin`); below `compact` it takes the screen and
	 * ✕ is the way out. Escape, the scrim and ✕ all close it, and so does
	 * leaving the tool (the page is paused, not destroyed, then).
	 *
	 * ONE shell for the Builder's three: the character, the boss, a half's
	 * opponents — and, since 2026-10-26, the Profile page's picture picker. They had two, with different scrims, z-orders and widths.
	 *
	 * ⚓ ONE FRAME (Nate 2026-10-23): a hairline in the plain border and the
	 * shell's corners, for all three. ⛔ No element tint on the frame — the
	 * character card's identity edge was the last of it. Inside, the three
	 * share a header grammar (a gold `.kicker` for the context, the title in
	 * the display face, a hairline under the header) and read their insets
	 * from `--im-pad-x` / `--im-pad-top`, so their text starts at one x.
	 */
	let {
		label,
		width = '40rem',
		onClose,
		children
	}: {
		/** The dialog's accessible name. */
		label: string;
		/** The panel's widest, as a CSS length. */
		width?: string;
		onClose: () => void;
		children: Snippet;
	} = $props();

	let closeBtn = $state<HTMLButtonElement>();
	onMount(() => closeBtn?.focus());

	closeOnLeave(
		() => true,
		() => onClose()
	);
</script>

<!-- CAPTURE, and the Escape is spent: over the menu state (the Profile
     page's picture picker) the menu's own Escape listener would otherwise
     run first and close the whole menu. It honours `defaultPrevented`. -->
<svelte:window
	onkeydowncapture={(e) => {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		onClose();
	}}
/>

<!-- Fades on --t-quick — a SURFACE over a scrim; `outroInert` is the
     outro-eats-your-click fix ($lib/motion). ⛔ don't drop it. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="im-scrim"
	use:portal
	onclick={onClose}
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
></div>
<div
	class="im ctx-dark"
	use:portal
	role="dialog"
	aria-modal="true"
	aria-label={label}
	style:--im-w={width}
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
>
	<button class="btn btn--icon im-close" bind:this={closeBtn} aria-label="Close" onclick={onClose}
		><Mark name="close" size={16} /></button
	>
	{@render children()}
</div>

<style>
	/* 🎛️ The room kept around the panel on a desk — the edge that closes it.
	   A first value, for Nate's eye. */
	.im {
		--im-margin: 2.5rem;
		/* 🎛️ The content's insets, shared by all three occupants. */
		--im-pad-x: 1.6rem;
		--im-pad-top: 1.5rem;
	}
	.im-scrim {
		position: fixed;
		inset: 0;
		z-index: 70;
		background: rgb(0 0 0 / 0.55);
	}
	/* Centred by margins, ⛔ not a translate: a transform at a fractional
	   offset rasterises its text soft (the sub-pixel law). */
	.im {
		position: fixed;
		z-index: 71;
		inset: 0;
		margin: auto;
		height: fit-content;
		width: min(var(--im-w), calc(100vw - 2 * var(--im-margin)));
		max-height: calc(100svh - 2 * var(--im-margin));
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: var(--r-lg, 6px);
		background: var(--surface);
		color: var(--text);
		overflow: hidden auto;
	}
	/* ⚠ The shell is the SCROLLER, so its occupant must never shrink to fit
	   it: a flex child may, and one with `overflow: hidden` (the boss hero)
	   shrinks below its content and clips it — on a phone the boss lost its
	   family name, checks and HP card. */
	.im > :global(*) {
		flex-shrink: 0;
	}
	.im-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 1;
	}
	/* A phone: the whole screen, ✕ the way out (compact — $lib/breakpoints.ts). */
	@media (max-width: 40rem) {
		.im {
			--im-margin: 0px;
			--im-pad-x: 1.1rem;
			--im-pad-top: 1.1rem;
			width: 100vw;
			height: 100svh;
			max-height: none;
			border: none;
			border-radius: 0;
		}
	}
</style>
