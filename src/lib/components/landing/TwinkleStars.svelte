<script lang="ts">
	import { stars } from '$lib/stars';
</script>

<div class="twinkle" aria-hidden="true">
	{#each stars as star, i (i)}
		<span
			class="star t-{star.animation} c-{star.color}"
			class:halo={star.halo}
			class:v-a={star.variant === 'a'}
			class:v-b={star.variant === 'b'}
			class:v-c={star.variant === 'c'}
			style:left="{star.x}%"
			style:top="{star.y}%"
			style:width="{star.size}px"
			style:height="{star.size}px"
			style:animation-duration="{star.duration}s"
			style:animation-delay="-{star.delay}s"
			style:--base={star.base}
		></span>
	{/each}
</div>

<style>
	/* The twinkle layer matches the plate's geometry exactly — bottom-anchored,
	   sized to the full 1:1 source, so stars share the plate's coordinate space
	   and tilt with it in Phase C. Star positions are plate-relative %.
	   --pan-y (inherited from .landing) drives the tilt-up transform alongside
	   the plate; defaults to 0. */
	.twinkle {
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translate(-50%, var(--pan-y, 0));
		width: calc(100dvh * 16 / 9);
		aspect-ratio: 1 / 1;
		pointer-events: none;
		z-index: 0;
		contain: layout paint;
	}

	.star {
		position: absolute;
		display: block;
		border-radius: 50%;
		background: var(--c);
		opacity: var(--base);
		animation-iteration-count: infinite;
		animation-timing-function: ease-in-out;
		will-change: opacity;
	}

	/* Color tints. White-biased per Nate; chromas kept low so tints read as
	   subtle hue suggestions rather than colored dots. */
	.c-white {
		--c: #ffffff;
	}
	.c-warm {
		--c: color-mix(in srgb, white 92%, #ffd8a8);
	}
	.c-cool {
		--c: color-mix(in srgb, white 92%, #c0d8ff);
	}
	.c-yellow {
		--c: color-mix(in srgb, white 85%, #ffd070);
	}
	.c-amber {
		--c: color-mix(in srgb, white 82%, #ffaa50);
	}

	/* Static halo — opacity of the star span scales the shadow naturally,
	   so the halo pulses with the body during gentle/dramatic animations.
	   Jitter stars animate their box-shadow directly (overrides this). */
	.halo {
		box-shadow: 0 0 2.5px 0.3px var(--c);
	}

	/* ---- Animation types ---- */

	/* Gentle — smooth opacity pulse. The bulk of the field. Trough is a
	   fraction of the star's base so the pulse amplitude is large enough
	   to read as motion, while preserving per-star character (dim stars
	   dim further, bright stars stay relatively bright). */
	.t-gentle {
		animation-name: t-gentle;
	}
	@keyframes t-gentle {
		0%,
		100% {
			opacity: calc(var(--base) * 0.35);
		}
		50% {
			opacity: 1;
		}
	}

	/* Dramatic — a deeper, broader sibling of gentle. Smooth pulse over the
	   full cycle with a subtle scale at peak. Previously a brief flash with
	   long rest, which read as "blinking light" rather than a star. */
	.t-dramatic {
		animation-name: t-dramatic;
		will-change: opacity, transform;
	}
	@keyframes t-dramatic {
		0%,
		100% {
			opacity: calc(var(--base) * 0.3);
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.15);
		}
	}

	/* Jitter — three desync variants, each a jagged 12-stop sequence over
	   <1.5s. Box-shadow animates alongside opacity so the halo "dances" the
	   way the canvas demo's per-frame randomized glow does. Linear timing
	   between stops keeps the flicker feel snappy rather than smoothed.
	   Jitter stars are always halo'd (generator enforces). */
	.t-jitter {
		animation-timing-function: linear;
		will-change: opacity, box-shadow;
	}
	.t-jitter.v-a {
		animation-name: t-jitter-a;
	}
	.t-jitter.v-b {
		animation-name: t-jitter-b;
	}
	.t-jitter.v-c {
		animation-name: t-jitter-c;
	}

	/* Opacity excursion narrow (~0.92-1.0, delta 0.08) — jitter stars sit
	   near peak brightness with subtle twinkle. Box-shadow blur radii kept
	   from v2 so the dancing halo continues to carry the jitter character.
	   Boundary uses a fixed value (not --base) so cycle restarts are smooth. */
	@keyframes t-jitter-a {
		0% {
			opacity: 0.95;
			box-shadow: 0 0 0.6px 0 var(--c);
		}
		8% {
			opacity: 0.98;
			box-shadow: 0 0 2.5px 0.6px var(--c);
		}
		17% {
			opacity: 0.93;
			box-shadow: 0 0 1.2px 0 var(--c);
		}
		25% {
			opacity: 1;
			box-shadow: 0 0 3.5px 0.9px var(--c);
		}
		33% {
			opacity: 0.94;
			box-shadow: 0 0 1.8px 0.3px var(--c);
		}
		42% {
			opacity: 0.99;
			box-shadow: 0 0 3px 0.6px var(--c);
		}
		50% {
			opacity: 0.92;
			box-shadow: 0 0 0.6px 0 var(--c);
		}
		58% {
			opacity: 0.99;
			box-shadow: 0 0 3px 0.6px var(--c);
		}
		67% {
			opacity: 0.94;
			box-shadow: 0 0 1.2px 0 var(--c);
		}
		75% {
			opacity: 0.98;
			box-shadow: 0 0 2.5px 0.6px var(--c);
		}
		83% {
			opacity: 0.93;
			box-shadow: 0 0 0.6px 0 var(--c);
		}
		92% {
			opacity: 0.97;
			box-shadow: 0 0 2.5px 0.3px var(--c);
		}
		100% {
			opacity: 0.95;
			box-shadow: 0 0 0.6px 0 var(--c);
		}
	}

	@keyframes t-jitter-b {
		0% {
			opacity: 0.95;
			box-shadow: 0 0 0.6px 0 var(--c);
		}
		11% {
			opacity: 0.99;
			box-shadow: 0 0 3px 0.6px var(--c);
		}
		18% {
			opacity: 0.94;
			box-shadow: 0 0 1.2px 0 var(--c);
		}
		28% {
			opacity: 0.96;
			box-shadow: 0 0 1.8px 0.3px var(--c);
		}
		36% {
			opacity: 1;
			box-shadow: 0 0 3.5px 0.9px var(--c);
		}
		44% {
			opacity: 0.93;
			box-shadow: 0 0 0.6px 0 var(--c);
		}
		53% {
			opacity: 0.99;
			box-shadow: 0 0 3px 0.6px var(--c);
		}
		61% {
			opacity: 0.92;
			box-shadow: 0 0 1.2px 0 var(--c);
		}
		70% {
			opacity: 0.98;
			box-shadow: 0 0 2.5px 0.6px var(--c);
		}
		78% {
			opacity: 0.94;
			box-shadow: 0 0 1.2px 0 var(--c);
		}
		86% {
			opacity: 1;
			box-shadow: 0 0 3px 0.6px var(--c);
		}
		94% {
			opacity: 0.94;
			box-shadow: 0 0 1.2px 0 var(--c);
		}
		100% {
			opacity: 0.95;
			box-shadow: 0 0 0.6px 0 var(--c);
		}
	}

	@keyframes t-jitter-c {
		0% {
			opacity: 0.95;
			box-shadow: 0 0 0.6px 0 var(--c);
		}
		7% {
			opacity: 0.94;
			box-shadow: 0 0 1.2px 0 var(--c);
		}
		14% {
			opacity: 1;
			box-shadow: 0 0 3.5px 0.9px var(--c);
		}
		22% {
			opacity: 0.93;
			box-shadow: 0 0 0.6px 0 var(--c);
		}
		29% {
			opacity: 0.98;
			box-shadow: 0 0 2.5px 0.6px var(--c);
		}
		37% {
			opacity: 0.94;
			box-shadow: 0 0 1.2px 0 var(--c);
		}
		46% {
			opacity: 0.99;
			box-shadow: 0 0 3px 0.6px var(--c);
		}
		54% {
			opacity: 0.92;
			box-shadow: 0 0 0.6px 0 var(--c);
		}
		63% {
			opacity: 0.98;
			box-shadow: 0 0 2.5px 0.3px var(--c);
		}
		71% {
			opacity: 0.94;
			box-shadow: 0 0 1.2px 0 var(--c);
		}
		80% {
			opacity: 0.99;
			box-shadow: 0 0 3px 0.6px var(--c);
		}
		89% {
			opacity: 0.93;
			box-shadow: 0 0 0.6px 0 var(--c);
		}
		100% {
			opacity: 0.95;
			box-shadow: 0 0 0.6px 0 var(--c);
		}
	}

	/* Reduced motion — freeze stars as static dots at a uniformly visible
	   opacity so the scene still reads as a starfield without animation. */
	@media (prefers-reduced-motion: reduce) {
		.star {
			animation: none;
			opacity: 0.8;
		}
	}
</style>
