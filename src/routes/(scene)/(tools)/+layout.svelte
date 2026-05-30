<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		FADE_DURATION_MS,
		FADE_OUT_MS,
		FADE_OVERLAP_MS,
		TILT_EASING_CSS,
		toolShellWorldFrom,
		getActiveReveal,
		timeUntilSettle,
		hasActiveSceneTransition,
		prefersReducedMotion
	} from '$lib/landing/transition';

	let { children } = $props();
	let shellEl: HTMLDivElement;
	let entryAnim: Animation | undefined;

	// Reveal state. On a transition arrival this starts false (suppressed during
	// the pan); on a cold load / SSR it's true (the tool just renders at rest —
	// there's no pan to protect). See the reveal notes in transition.ts.
	let revealed = $state(!hasActiveSceneTransition());

	onMount(() => {
		if (revealed) return; // cold load
		if (prefersReducedMotion()) {
			revealed = true;
			return;
		}
		const active = getActiveReveal();
		if (!active) {
			revealed = true;
			return;
		}

		// Lock the shell's TRANSFORM to the scene's pan — same startTime, duration
		// and easing — so its motion delta is identical to the background and it
		// reads as pinned in the world, descending + craning into centre. It runs
		// while visibility:hidden (unpainted, so no raster cost) and only becomes
		// visible at the fade below.
		entryAnim = shellEl.animate(
			[{ transform: toolShellWorldFrom(active.toolPath) }, { transform: 'translate(0, 0)' }],
			{ duration: active.duration, easing: TILT_EASING_CSS, fill: 'both' }
		);
		entryAnim.startTime = active.startTime; // pin to the scene's clock → lockstep

		// Fade in on the SAME schedule as the landing composition: over
		// FADE_DURATION_MS, ending FADE_OVERLAP_MS past settle (so it begins
		// FADE_OFFSET_MS + FADE_OVERLAP_MS into the pan, lingering past the camera
		// end). The transform stays locked to the scene the entire time.
		const wait = Math.max(0, timeUntilSettle() - FADE_DURATION_MS + FADE_OVERLAP_MS);
		const revealTimer = setTimeout(() => (revealed = true), wait);

		return () => {
			clearTimeout(revealTimer);
			entryAnim?.cancel();
		};
	});

	// Outro: ride the reverse pan locked (same clock, easing and duration) so the
	// shell stays pinned to the scene — receding up + sideways with it — instead
	// of fading in place while the background drifts out from behind it. Svelte
	// drives the opacity; a WAAPI transform animation synced to the reverse pan
	// drives the motion. Runs at unmount, by which point the scene layout's
	// beforeNavigate has already started the reverse pan (so getActiveReveal is
	// populated). Falls back to a plain fade with no active pan / reduced motion.
	function lockedExit(node: HTMLElement) {
		const active = getActiveReveal();
		if (active && !prefersReducedMotion()) {
			entryAnim?.cancel(); // hand transform control to the outro
			const exitAnim = node.animate(
				[{ transform: 'translate(0, 0)' }, { transform: toolShellWorldFrom(active.toolPath) }],
				{ duration: active.duration, easing: TILT_EASING_CSS, fill: 'both' }
			);
			exitAnim.startTime = active.startTime;
		}
		return { duration: FADE_OUT_MS, css: (t: number) => `opacity: ${t}` };
	}
</script>

<div
	bind:this={shellEl}
	class="tool-shell"
	class:revealed
	style:--reveal-fade-ms="{FADE_DURATION_MS}ms"
	out:lockedExit|global
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
		/* Suppressed during the pan: laid out (editors measure correctly) but
		   visibility:hidden → UNPAINTED, so it stays off the raster pipeline. The
		   transform is owned by the lockstep WAAPI animation in the script (do not
		   set it here). .revealed flips it visible + fades it in over the tail. */
		visibility: hidden;
		opacity: 0;
		will-change: transform, opacity;
	}

	.tool-shell.revealed {
		visibility: visible;
		opacity: 1;
		/* Keyframe (not transition) so the steady state carries no opacity
		   transition for the Svelte out:fade to fight; `backwards` applies the
		   from-frame on the first painted frame so there's no opacity:1 flash, and
		   the absence of a forwards fill lets the outro's inline opacity take over. */
		animation: tool-fade-in var(--reveal-fade-ms, 500ms) linear backwards;
	}

	@keyframes tool-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
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
		.tool-shell.revealed {
			animation: none;
		}
		.brand-return {
			transition: none;
		}
	}
</style>
