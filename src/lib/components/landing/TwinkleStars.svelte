<script lang="ts">
	import { page } from '$app/state';
	import { stars } from '$lib/stars';
	import { sceneLayer, isLandingPath } from '$lib/landing/transition';

	// Cold-load rest transform from the scene layout (already includes the pan
	// and any side-tool horizontal crane). Used as an SSR-time inline transform
	// so the very first paint already shows the twinkle layer at its correct
	// rest state — without this it would render at left:50% with no centering
	// translate, and hydration would visibly snap it into place. WAAPI takes
	// over via the sceneLayer action after hydration.
	let { initialTransform = 'translate(-50%, 0)' }: { initialTransform?: string } = $props();

	// Tool routes fully occlude the scene, but live CSS animations still cost:
	// WebKit synchronizes every live animation on the MAIN THREAD at each
	// scroll-gesture start, and ~1400 star animations made that sync ~90–120ms
	// on retina — Safari coalesced the queued wheel deltas into one visible
	// jump (the 2026-07-06 momentum-jerk hunt). Suspend the animations
	// entirely while a tool is up: `animation-play-state: paused` and
	// `display: none` are NOT enough — paused/hidden animations stay live in
	// the timeline (measured). Resume is seamless — the negative
	// animation-delays re-phase each star exactly as before.
	const suspended = $derived(!isLandingPath(page.url.pathname));
</script>

<div
	class="twinkle"
	class:twinkle--suspended={suspended}
	style:transform={initialTransform}
	use:sceneLayer={'twinkle'}
	aria-hidden="true"
>
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
	/* The twinkle layer covers the sky region of the scene — bottom-anchored
	   at the horizon (top of floor), sized to the scene's full 21:9 width and
	   the sky image's source-px height. Star positions are sky-region-relative
	   %, i.e. y=0% is the top of the scene and y=100% is the horizon.
	   Transform is set inline by the sceneLayer action and animated via WAAPI
	   on the compositor thread, in lockstep with the sky and floor. */
	.twinkle {
		position: absolute;
		bottom: var(--horizon-y);
		left: 50%;
		width: var(--scene-w);
		height: var(--sky-h);
		pointer-events: none;
		z-index: 2;
		contain: layout paint;
		/* Promote to its own compositor layer so the pan transform doesn't
		   trigger paint on the ~800 nested star elements. */
		will-change: transform;
	}

	.star {
		position: absolute;
		display: block;
		border-radius: 50%;
		background: var(--c);
		opacity: var(--base);
		animation-iteration-count: infinite;
		animation-timing-function: ease-in-out;
		/* Frozen during a pan via --twinkle-play (set on the .twinkle layer by the
		   transition orchestrator) so the layer is a static texture the compositor
		   can translate without re-rastering ~1500 stars per frame. Defaults to
		   running. No per-star will-change — 1500 layer hints can't be honored and
		   only add overhead; the parent .twinkle owns the single promoted layer. */
		animation-play-state: var(--twinkle-play, running);
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

	/* Static halo — a soft glow drawn as a pseudo-element, replacing the old
	   box-shadow (a gaussian blur re-computed on every twinkle-layer raster,
	   ~400 of them; this masked fill is far cheaper). The star's own opacity
	   scales the ::after, so the halo still pulses with the body during
	   gentle/dramatic.

	   The colour is a solid var(--c) shaped by a radial ALPHA MASK. We mask
	   rather than use `background: radial-gradient(..., transparent)` because a
	   `transparent` stop is transparent *black* — fading near-white to it runs
	   the glow through grey. The mask only touches alpha, so the colour stays
	   clean and on-tint.

	   The falloff is EASED, not linear. A 2-stop ramp (#000 → transparent)
	   drops at a constant slope and reaches zero with slope still non-zero,
	   leaving a faint ring at the edge; box-shadow looks softer because a
	   gaussian tails off asymptotically. The stops below approximate
	   alpha = (1 − t)²: a quick initial drop, then a long faint tail that
	   meets zero with almost no slope — no visible edge.

	   --- Iteration knobs ---
	     inset       glow SIZE — more negative = larger (−100% ≈ 3× the core,
	                 −200% ≈ 5×).
	     opacity     glow INTENSITY — lower = fainter bloom (also reduces how
	                 much it appears to enlarge the star).
	     --halo-mask SOFTNESS / shape. Edit the one gradient (it feeds both the
	                 prefixed and unprefixed mask). Softer: push the mid-stop
	                 alphas DOWN (steeper power, longer faint tail). Harder/
	                 tighter: raise them toward a straight line. Or swap the
	                 whole thing for a single color hint — e.g.
	                 `radial-gradient(closest-side, #000, 30%, transparent)` —
	                 where the % biases the midpoint (one knob, less control).

	   Applies to all halos, including flicker (jitter) stars — their flicker is
	   opacity-only now, so the glow simply rides the star's opacity. */
	.halo::after {
		content: '';
		position: absolute;
		inset: -120%;
		border-radius: 50%;
		background: var(--c);
		--halo-mask: radial-gradient(
			closest-side,
			#000 0%,
			rgba(0, 0, 0, 0.72) 15%,
			rgba(0, 0, 0, 0.49) 30%,
			rgba(0, 0, 0, 0.3) 45%,
			rgba(0, 0, 0, 0.16) 60%,
			rgba(0, 0, 0, 0.06) 75%,
			rgba(0, 0, 0, 0.01) 90%,
			transparent 100%
		);
		-webkit-mask-image: var(--halo-mask);
		mask-image: var(--halo-mask);
		opacity: 0.5;
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
			opacity: calc(var(--base) * 0.2);
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
	}
	@keyframes t-dramatic {
		0%,
		100% {
			opacity: calc(var(--base) * 0.15);
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.15);
		}
	}

	/* Jitter (flicker) — three desync variants, each a jagged 13-stop opacity
	   sequence over <1.5s. Box-shadow is gone: the scintillation is now a tiny
	   opacity flicker only (far cheaper to paint, and more star-like). Linear
	   timing keeps the flicker snappy rather than smoothed. Drawn from the whole
	   field (not just halo'd stars), so most flicker stars are bare pinpoints;
	   the ~quarter that are halo'd get the gradient glow, which rides the flicker. */
	.t-jitter {
		animation-timing-function: linear;
		/* Flicker depth knob — the single dial for how visible the flicker is.
		   Each keyframe dips opacity by up to (--flicker × the star's brightness);
		   the deepest stop uses the full --flicker. 0 = no flicker; ~0.08 was the
		   old (sub-perceptible) range; higher = stronger scintillation. */
		--flicker: 0.4;
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

	/* Opacity-only flicker. Each stop dips the star's --base by a fraction of
	   --flicker (the deepest stop uses the full --flicker), so the shimmer is
	   proportional to the star's brightness — a dim pinpoint stays dim and just
	   flickers a little. 0% and 100% match so the loop is seamless. To make the
	   whole effect more or less visible, change --flicker on .t-jitter above —
	   don't touch these per-stop fractions. */
	@keyframes t-jitter-a {
		0% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.625));
		}
		8% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.25));
		}
		17% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.875));
		}
		25% {
			opacity: var(--base);
		}
		33% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.75));
		}
		42% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.125));
		}
		50% {
			opacity: calc(var(--base) * (1 - var(--flicker)));
		}
		58% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.125));
		}
		67% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.75));
		}
		75% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.25));
		}
		83% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.875));
		}
		92% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.375));
		}
		100% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.625));
		}
	}

	@keyframes t-jitter-b {
		0% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.625));
		}
		11% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.125));
		}
		18% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.75));
		}
		28% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.5));
		}
		36% {
			opacity: var(--base);
		}
		44% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.875));
		}
		53% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.125));
		}
		61% {
			opacity: calc(var(--base) * (1 - var(--flicker)));
		}
		70% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.25));
		}
		78% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.75));
		}
		86% {
			opacity: var(--base);
		}
		94% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.75));
		}
		100% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.625));
		}
	}

	@keyframes t-jitter-c {
		0% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.625));
		}
		7% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.75));
		}
		14% {
			opacity: var(--base);
		}
		22% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.875));
		}
		29% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.25));
		}
		37% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.75));
		}
		46% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.125));
		}
		54% {
			opacity: calc(var(--base) * (1 - var(--flicker)));
		}
		63% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.25));
		}
		71% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.75));
		}
		80% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.125));
		}
		89% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.875));
		}
		100% {
			opacity: calc(var(--base) * (1 - var(--flicker) * 0.625));
		}
	}

	/* Tool-route suspension — see the script-block comment. animation-name
	   (not play-state) so the CSSAnimation objects are actually destroyed. */
	.twinkle--suspended .star {
		animation-name: none;
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
