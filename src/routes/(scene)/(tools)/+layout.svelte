<script lang="ts">
	import { resolve } from '$app/paths';
	import { fade } from 'svelte/transition';
	import { FADE_DURATION_MS, FADE_OFFSET_MS, sceneLayer } from '$lib/landing/transition';

	let { children } = $props();
</script>

<!-- in: has a delay so the tool only fades in once the outgoing landing
	 composition has cleared the screen; out: starts immediately so the
	 tool clears before the descending pan brings the landing back. -->
<div
	class="tool-shell"
	use:sceneLayer={'tool-shell'}
	in:fade|global={{ duration: FADE_DURATION_MS, delay: FADE_OFFSET_MS }}
	out:fade|global={{ duration: FADE_DURATION_MS }}
>
	<a class="brand-return" href={resolve('/')} aria-label="Return to critcalc.app home">
		<img src="/critcalc-logo.svg" alt="" />
	</a>

	<div class="tool-main">
		{@render children()}
	</div>
</div>

<style>
	.tool-shell {
		/* Attached to the top of the plate: at landing state the tool sits one
		   pan-distance above the viewport, and at tool state slides into its
		   natural position. Transform is set inline by the sceneLayer action
		   and animated via WAAPI on the compositor thread, in lockstep with
		   the plate/twinkle. will-change keeps the layer promoted so the
		   combined transform + opacity stay on the compositor fast path. */
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: auto;
		will-change: transform, opacity;
	}

	.brand-return {
		/* Temporary placement bottom-left to avoid overlapping tool content
		   in the upper region. Final placement TBD. */
		position: absolute;
		bottom: clamp(1.5rem, 3vh, 2.5rem);
		left: clamp(1.5rem, 3vw, 2.5rem);
		z-index: 10;
		display: block;
		width: clamp(2.75rem, 4vw, 3.75rem);
		opacity: 0.78;
		transition:
			opacity 220ms ease,
			transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.brand-return img {
		width: 100%;
		height: auto;
		display: block;
		pointer-events: none;
	}

	.brand-return:hover,
	.brand-return:focus-visible {
		opacity: 1;
		transform: scale(1.06);
		outline: none;
	}

	.tool-main {
		width: 100%;
		min-height: 100%;
		padding: 2rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.brand-return {
			transition: none;
		}
	}
</style>
