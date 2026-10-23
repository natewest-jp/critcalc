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
	 * opponents. They had two, with different scrims, z-orders and widths.
	 */
	let {
		label,
		width = '40rem',
		accent,
		onClose,
		children
	}: {
		/** The dialog's accessible name. */
		label: string;
		/** The panel's widest, as a CSS length. */
		width?: string;
		/** An identity edge (a character's element), else the plain border. */
		accent?: string;
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

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

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
	style:--im-accent={accent}
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
		border: 1px solid color-mix(in srgb, var(--im-accent, var(--border)) 35%, var(--border));
		border-radius: var(--r-lg, 6px);
		background: var(--surface);
		color: var(--text);
		overflow: hidden auto;
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
			width: 100vw;
			height: 100svh;
			max-height: none;
			border: none;
			border-radius: 0;
		}
	}
</style>
