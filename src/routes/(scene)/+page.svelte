<script lang="ts">
	import { fade } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import { goto, preloadData } from '$app/navigation';
	import {
		FADE_DURATION_MS,
		FADE_OUT_MS,
		FADE_OVERLAP_MS,
		timeUntilSettle,
		sceneLayer,
		startSceneTransition,
		armTwinkleFreeze
	} from '$lib/landing/transition';

	const tools = [
		{ id: 'crit-visualizer', name: 'Crit Visualizer', path: '/crit-visualizer' },
		{ id: 'rotation-planner', name: 'Rotation Planner', path: '/rotation-planner' },
		{ id: 'team-builder', name: 'Team Builder', path: '/team-builder' }
	] as const;

	// Start the tilt-up pan immediately on click, then defer the actual
	// navigation by two animation frames. The pan runs on the compositor via
	// WAAPI, but its *first* frame can't commit until the main thread yields —
	// and a normal click commits the navigation in the same task, so the
	// destination tool's mount/hydration floods the main thread on frame 0 and
	// the pan visibly jerks before it gets going. Letting the compositor commit
	// a frame first means the heavy mount work lands after the animation is
	// already running on its own thread, where it can no longer stall it.
	function navigateToTool(event: MouseEvent, path: (typeof tools)[number]['path']) {
		// Leave modified clicks (open-in-new-tab/window, middle-click) to the
		// browser — only intercept a plain primary-button click.
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		startSceneTransition(resolve(path));
		requestAnimationFrame(() => requestAnimationFrame(() => goto(resolve(path))));
	}

	// Warm the tool on press intent: arm the twinkle freeze AND preload the
	// route's code + data so the heavy module fetch/parse is out of the pan
	// window by the time the click commits (the trace showed the mount flood is
	// the front-half judder source). preloadData dedupes and no-ops if already
	// warm, so firing on every pointerdown is safe.
	function warmTool(path: (typeof tools)[number]['path']) {
		armTwinkleFreeze();
		preloadData(resolve(path)).catch(() => {});
	}
</script>

<!-- in: has a delay so the composition only fades in once the outgoing tool
	 has cleared the screen; out: starts immediately so the composition is
	 gone before the descending pan finishes (more pure-sky time, less UI
	 contributing to judder). -->
<div
	class="composition"
	use:sceneLayer={'composition'}
	in:fade|global={{
		duration: FADE_DURATION_MS,
		delay: Math.max(0, timeUntilSettle() - FADE_DURATION_MS + FADE_OVERLAP_MS)
	}}
	out:fade|global={{ duration: FADE_OUT_MS }}
>
	<a class="brand-mark" href={resolve('/')} aria-label="critcalc.app home">
		<img class="brand-mark__logo" src="/critcalc-logo.svg" alt="" />
		<span class="brand-mark__name">critcalc.app</span>
	</a>

	<nav class="heroes" aria-label="critcalc tools">
		{#each tools as tool (tool.id)}
			<a
				class="hero"
				href={resolve(tool.path)}
				onpointerdown={() => warmTool(tool.path)}
				onkeydown={(e) => e.key === 'Enter' && warmTool(tool.path)}
				onclick={(e) => navigateToTool(e, tool.path)}
			>
				<span class="hero__name">{tool.name}</span>
			</a>
		{/each}
	</nav>
</div>

<style>
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
		/* Composition only mounts at the landing route (panY = 0), so its rest
		   state is always translateX(-50%) — set here as a static default so
		   the first paint after SSR is already centered. The sceneLayer action
		   overrides this with `translate(-50%, 0dvh)` (equivalent) at mount,
		   and WAAPI drives the transform from there during pans. */
		transform: translateX(-50%);
		width: var(--group-w);
		will-change: transform, opacity;
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
		/* Transparent by default so the hover border doesn't shift layout. */
		border: 1px solid transparent;
		background:
			radial-gradient(120% 90% at 50% 0%, #2a3a60 0%, transparent 70%),
			linear-gradient(180deg, #1a2440 0%, #0d1428 100%);
		display: grid;
		place-items: center;
		text-align: center;
		text-decoration: none;
		color: var(--text);
		padding: 1.25rem;
		filter: brightness(0.92) saturate(0.95);
		transition: border-color 180ms ease;
	}

	/* Placeholder hover: just a border, pending the real hero-card design. */
	.hero:hover,
	.hero:focus-visible {
		border-color: rgba(150, 190, 235, 0.7);
		outline: none;
	}

	.hero__name {
		font-family: 'Bitter Variable', Bitter, serif;
		font-size: clamp(0.95rem, 1.4vw, 1.4rem);
		font-weight: 600;
		letter-spacing: 0.01em;
		line-height: 1.2;
	}
</style>
