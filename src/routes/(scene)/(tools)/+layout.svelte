<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		FADE_OUT_MS,
		hasActivePortal,
		portalTimeUntilBlackout,
		registerToolReveal,
		startPortalTransition,
		getHeroOrigin,
		prefersReducedMotion
	} from '$lib/landing/transition';
	import DireBorder from './lib/DireBorder.svelte';

	let { children } = $props();

	// Reveal state. While the portal spins, the shell stays visibility:hidden —
	// laid out (so editors still measure) but UNPAINTED — so it never shows at the
	// portal's growing edges and its own entry animations play unseen under the
	// black. The portal DRIVES the reveal: at full black it calls our registered
	// callback, waits until we're painted opaque, then fades its backing off us —
	// that backing fade is the single tool fade-in (dark-to-dark). Cold load /
	// reduced motion / no portal → visible immediately.
	let revealed = $state(!hasActivePortal());

	onMount(() => {
		if (revealed) return; // cold load — already visible
		if (prefersReducedMotion()) {
			revealed = true;
			return;
		}
		// Mounted after the portal already blacked out (very slow mount) → just show.
		if (portalTimeUntilBlackout() <= 0) {
			revealed = true;
			return;
		}
		// Otherwise let the portal un-suppress us at full black (handshake).
		return registerToolReveal(() => (revealed = true));
	});

	// Return to the landing via the reverse portal: the spiral collapses back down
	// to THIS tool's hero card (wherever the click happened), then the navigation
	// runs at full black so the landing swaps in unseen. The card centre was
	// captured on the forward click; a cold load straight into the tool has none,
	// so the portal falls back to screen-centre.
	function returnToLanding(event: MouseEvent) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		const origin = getHeroOrigin(page.url.pathname);
		startPortalTransition('/', origin, () => goto(resolve('/')));
	}

	// Exit fallback: a plain opacity fade for any non-portal departure (the portal
	// owns the reverse and covers the swap, so this is effectively invisible then).
	function plainExit(_node: HTMLElement) {
		return { duration: FADE_OUT_MS, css: (t: number) => `opacity: ${t}` };
	}
</script>

<div class="tool-shell" class:revealed out:plainExit|global>
	<DireBorder />

	<a
		class="brand-return"
		href={resolve('/')}
		onclick={returnToLanding}
		aria-label="Return to critcalc.app home"
	>
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
		/* Tool background: plain black base under the Dire border edge treatment.
		   Opaque, so it covers the cosmic scene behind — the portal's black fades
		   out onto this (dark-to-dark) and the tool reads as fading in from black. */
		background: #000;

		/* Dire border knobs + the content paddings derived from them. Content must
		   clear the animated WAVE zones (animated layers behind occluding content
		   are the Safari scroll-stall pathology) — pads derive from the wave marks.
		   The ember field (200px, animated noise) intentionally extends under the
		   content zone like the Dire reference; WebKit-probed for stalls. Static
		   gradients may extend anywhere. */
		--dire-tint: hsl(343 85% 46%);
		--dire-top-h: 75px;
		--dire-top-grad-h: 150px;
		--dire-bottom-h: 100px;
		--dire-bottom-grad-h: 200px;
		--dire-halftone-h: 200px;
		--dire-wave-alpha: 0.25;
		/* Wave speed: 1 = the tuned feel (the ×10 tuning is baked into the base
		   durations). Noise pace is its own knob — they never tune well together. */
		--dire-speed: 1;
		--dire-noise-dur: 8s;
		--tool-pad-top: calc(var(--dire-top-h) + 0.5rem);
		--tool-pad-bottom: calc(var(--dire-bottom-h) + 0.5rem);
		--tool-pad-x: 3rem;
		/* Suppressed during the portal spin: laid out (editors measure correctly)
		   but visibility:hidden → UNPAINTED, off the raster pipeline and invisible
		   at the portal's edges. .revealed flips it visible at full black. */
		visibility: hidden;
		opacity: 0;
	}

	.tool-shell.revealed {
		visibility: visible;
		opacity: 1;
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
		position: relative;
		z-index: 1;
		width: 100%;
		min-height: 100%;
		padding: var(--tool-pad-top) var(--tool-pad-x) var(--tool-pad-bottom);
	}

	@media (prefers-reduced-motion: reduce) {
		.brand-return {
			transition: none;
		}
	}
</style>
