<script lang="ts">
	import { resolve } from '$app/paths';
	import { fade } from 'svelte/transition';
	import {
		TOOL_IN_DELAY_MS,
		TOOL_IN_DURATION_MS,
		TOOL_OUT_DURATION_MS
	} from '$lib/landing/transition';

	let { children } = $props();
</script>

<div
	class="tool-shell"
	in:fade|global={{ duration: TOOL_IN_DURATION_MS, delay: TOOL_IN_DELAY_MS }}
	out:fade|global={{ duration: TOOL_OUT_DURATION_MS }}
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
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: auto;
	}

	.brand-return {
		position: absolute;
		top: clamp(1.5rem, 3vh, 2.5rem);
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
