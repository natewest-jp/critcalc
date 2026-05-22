<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { resolve } from '$app/paths';
	import TwinkleStars from '$lib/components/landing/TwinkleStars.svelte';

	const tools = [
		{ id: 'crit-visualizer', name: 'Crit Visualizer', href: resolve('/crit-visualizer') },
		{ id: 'rotation-planner', name: 'Rotation Planner', href: resolve('/rotation-planner') },
		{ id: 'team-builder', name: 'Team Builder', href: resolve('/team-builder') }
	];

	const PLATE = '/assets/landing/plate-frame16x9';
</script>

<div class="landing" in:fade|global={{ duration: 600 }}>
	<picture class="plate">
		<source
			type="image/avif"
			srcset="
				{PLATE}-1920w.avif 1920w,
				{PLATE}-2560w.avif 2560w,
				{PLATE}-3840w.avif 3840w"
			sizes="calc(100dvh * 16 / 9)"
		/>
		<source
			type="image/webp"
			srcset="
				{PLATE}-1920w.webp 1920w,
				{PLATE}-2560w.webp 2560w,
				{PLATE}-3840w.webp 3840w"
			sizes="calc(100dvh * 16 / 9)"
		/>
		<img
			class="plate__img"
			src="{PLATE}-1920w.webp"
			srcset="
				{PLATE}-1920w.webp 1920w,
				{PLATE}-2560w.webp 2560w,
				{PLATE}-3840w.webp 3840w"
			sizes="calc(100dvh * 16 / 9)"
			alt=""
			fetchpriority="high"
		/>
	</picture>

	<TwinkleStars />

	<div class="composition">
		<a class="brand-mark" href={resolve('/')} aria-label="critcalc.app home">
			<img class="brand-mark__logo" src="/critcalc-logo.svg" alt="" />
			<span class="brand-mark__name">critcalc.app</span>
		</a>

		<nav class="heroes" aria-label="critcalc tools">
			{#each tools as tool, i (tool.id)}
				<a
					class="hero"
					href={tool.href}
					in:fly|global={{ y: 24, duration: 700, delay: 500 + i * 220, easing: cubicOut }}
				>
					<span class="hero__name">{tool.name}</span>
				</a>
			{/each}
		</nav>
	</div>
</div>

<style>
	.landing {
		position: fixed;
		inset: 0;
		width: 100dvw;
		height: 100dvh;
		overflow: hidden;
		background: var(--bg);
	}

	.plate {
		/* Lock the visible plate region to the bottom 16:9 frame of the 1:1 source,
		   always filling viewport height. The remaining top 7/16 of the source
		   overflows above the viewport — preserved for Phase C tilt-up across all
		   viewport widths. Wider-than-16:9 viewports get --bg gutters until a
		   wider plate variant ships.
		   --pan-y (set on .landing) drives the tilt-up transform; defaults to 0. */
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translate(-50%, var(--pan-y, 0));
		width: calc(100dvh * 16 / 9);
		display: block;
	}

	.plate__img {
		width: 100%;
		height: auto;
		display: block;
		max-width: none;
	}

	.composition {
		/* Single source of truth for hero card geometry.
		   Brand mark and heroes derive their horizontal extent from these,
		   so any change to height/aspect/gap ripples through automatically. */
		--card-h: 42vh;
		--card-w: calc(var(--card-h) * 4 / 5);
		--gap: clamp(1.25rem, 3.2vw, 3rem);
		--group-w: calc(3 * var(--card-w) + 2 * var(--gap));

		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: var(--group-w);
		z-index: 1;
	}

	.brand-mark {
		position: absolute;
		top: clamp(3rem, 8vh, 7rem);
		left: 0;
		display: flex;
		align-items: center;
		color: var(--text);
		cursor: pointer;
		user-select: none;
	}

	.brand-mark__logo {
		width: clamp(9.75rem, 17.8vw, 14.5rem);
		height: auto;
		pointer-events: none;
	}

	.brand-mark__name {
		position: relative;
		top: 0.2vh;
		font-family: 'Bitter Variable', Bitter, serif;
		font-weight: 500;
		font-size: clamp(2.5rem, 4.5vw, 3.75rem);
		letter-spacing: 0.01em;
		line-height: 1;
	}

	.heroes {
		position: absolute;
		top: 30%;
		left: 0;
		right: 0;
		height: var(--card-h);
		display: flex;
		align-items: stretch;
		justify-content: space-between;
	}

	.hero {
		position: relative;
		height: 100%;
		aspect-ratio: 4 / 5;
		min-width: 0;
		border-radius: 0.5rem;
		background:
			radial-gradient(120% 90% at 50% 0%, #2a3a60 0%, transparent 70%),
			linear-gradient(180deg, #1a2440 0%, #0d1428 100%);
		box-shadow:
			0 12px 36px rgba(0, 0, 0, 0.55),
			0 2px 6px rgba(0, 0, 0, 0.45);
		display: grid;
		place-items: center;
		text-align: center;
		text-decoration: none;
		color: var(--text);
		padding: 1.25rem;
		filter: brightness(0.92) saturate(0.95);
		transition:
			transform 320ms cubic-bezier(0.2, 0.7, 0.2, 1),
			box-shadow 320ms ease,
			filter 320ms ease;
		will-change: transform, filter;
	}

	.hero:hover,
	.hero:focus-visible {
		transform: translateY(-6px);
		filter: brightness(1.18) saturate(1.1);
		box-shadow:
			0 22px 48px rgba(0, 0, 0, 0.6),
			0 4px 10px rgba(0, 0, 0, 0.5),
			inset 0 0 0 1px rgba(140, 180, 230, 0.18);
		outline: none;
	}

	.hero__name {
		font-family: 'Bitter Variable', Bitter, serif;
		font-size: clamp(0.95rem, 1.4vw, 1.4rem);
		font-weight: 600;
		letter-spacing: 0.01em;
		line-height: 1.2;
	}

	@media (prefers-reduced-motion: reduce) {
		.hero {
			transition: none;
		}
	}
</style>
