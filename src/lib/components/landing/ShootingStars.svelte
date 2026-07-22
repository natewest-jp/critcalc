<script lang="ts">
	import { page } from '$app/state';
	import { startShootingStars } from '$lib/landing/shootingStars';
	import { isToolPath } from '$lib/landing/transition';

	// Host for the meteor nodes. Sized to the sky region like TwinkleStars so
	// meteors live in the same coordinate space and ride the parallax with it.
	// Meteor elements are created/destroyed imperatively by the controller.
	let host: HTMLElement;

	// Tool routes fully occlude the scene; without this the scheduler kept
	// firing meteors behind the opaque tool shell every 5–30s — invisible DOM
	// churn plus one more live WAAPI animation in Safari's per-gesture
	// animation sync (the TwinkleStars suspension rationale; see memory
	// scene-occlusion-perf). Suspend by tearing the scheduler down entirely on
	// tool routes and restarting it on return — the route flips under the
	// portal's black cover, and the first meteor after a restart waits 4–12s,
	// so nothing visibly pops either way. Only TOOL routes suspend — the landing
	// AND the static pages keep the scene (and its meteors) live.
	const suspended = $derived(isToolPath(page.url.pathname));

	$effect(() => {
		if (suspended) return;
		return startShootingStars(host);
	});
</script>

<div class="meteors" bind:this={host} aria-hidden="true"></div>

<style>
	/* Covers the sky region, bottom-anchored at the horizon, matching .twinkle.
	   Clipped so a meteor never streaks below the horizon onto the floor. The
	   parallax-world wrapper translates this along with the rest of the sky. */
	.meteors {
		position: absolute;
		bottom: var(--horizon-y);
		left: 50%;
		width: var(--scene-w);
		height: var(--sky-h);
		transform: translateX(-50%);
		pointer-events: none;
		overflow: hidden;
		/* Above the baked sky + twinkle, below the floor (floor z:3) so a meteor
		   passes behind the foreground reflections at the horizon. */
		z-index: 2;
	}

	/* A single meteor: a hairline bar, brightest at its RIGHT (leading) end and
	   fading left to transparent along the tail. The controller rotates it so the
	   right end points along travel and translates it across the sky via WAAPI.
	   No head bloom, no box-shadow — the gradient's own bright tip is the whole
	   streak; the per-meteor opacity (PEAK_OPACITY) keeps it faint. */
	.meteors :global(.meteor) {
		position: absolute;
		height: 1px;
		/* width is set inline (per-meteor length). */
		transform-origin: right center;
		background: linear-gradient(
			90deg,
			transparent 0%,
			color-mix(in srgb, var(--c) 45%, transparent) 60%,
			var(--c) 100%
		);
		will-change: transform, opacity;
	}

	@media (prefers-reduced-motion: reduce) {
		/* Controller already no-ops under reduced motion; this is belt-and-braces
		   in case a meteor node ever exists. */
		.meteors {
			display: none;
		}
	}
</style>
