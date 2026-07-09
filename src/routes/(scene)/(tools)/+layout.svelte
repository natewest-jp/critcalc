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
	import ChromeOverlay from './lib/ChromeOverlay.svelte';
	import { TOOLS } from './lib/toolChrome';

	let { children } = $props();

	// Chrome identity + switcher derive from the route
	const tool = $derived(TOOLS.find((t) => page.url.pathname.startsWith(t.path)));
	const otherTools = $derived(TOOLS.filter((t) => t !== tool));

	let helpOpen = $state(false);
	let settingsOpen = $state(false);

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

	<!-- Tool chrome strip: identity left, actions right, riding the border's
	     quiet top zone. Identical across all tools. -->
	<header class="tool-chrome">
		<a
			class="chrome-brand"
			href={resolve('/')}
			onclick={returnToLanding}
			aria-label="Return to critcalc.app home"
		>
			<img src="/critcalc-logo-white.svg" alt="" />
		</a>
		{#if tool}
			<span class="chrome-title">{tool.title}</span>
		{/if}

		<nav class="chrome-actions" aria-label="Tool actions">
			{#each otherTools as other (other.path)}
				<a class="chrome-switch" href={resolve(other.path)}>{other.short}</a>
			{/each}
			<button class="chrome-btn" aria-label="Guide" onclick={() => (helpOpen = true)}>?</button>
			<button class="chrome-btn" aria-label="Settings" onclick={() => (settingsOpen = true)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3.2" />
					<path
						d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"
					/>
				</svg>
			</button>
		</nav>
	</header>

	<div class="tool-main">
		{@render children()}
	</div>
</div>

{#if tool}
	<ChromeOverlay title="{tool.title} — Guide" bind:open={helpOpen}>
		<p>{tool.help.intro}</p>
		{#each tool.help.notes as note (note)}
			<p>{note}</p>
		{/each}
	</ChromeOverlay>
{/if}

<ChromeOverlay title="Settings" bind:open={settingsOpen}>
	<p>
		Site settings are on the way — display preferences, motion toggles, and planner ping calibration
		will live here.
	</p>
</ChromeOverlay>

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

		/* Dire border knobs. These size the edge treatment ONLY — the content
		   paddings below are independent of them now (see the note there).
		   --dire-tint (the edge hue) now lives in app.css :root so it can double as
		   the shared --accent; it cascades in here, so the border still reads it. */
		--dire-top-h: 100px;
		--dire-top-grad-h: 200px;
		--dire-bottom-h: 200px;
		--dire-bottom-grad-h: 300px;
		--dire-halftone-h: 200px;
		--dire-wave-alpha: 0.35;
		/* Wave tile width: smaller = smaller waves but MUCH lighter compositor
		   textures (memory ∝ tile-w²), which is what curbs the eviction-flash +
		   scroll judder. Dial to taste (down from the 220vw default). */
		--dire-tile-w: 130vw;
		/* Wave speed: 1 = the tuned feel (the ×10 tuning is baked into the base
		   durations). Noise pace is its own knob — they never tune well together. */
		--dire-speed: 0.5;
		--dire-noise-dur: 9s;
		/* Tool real estate is sized to the screen + chrome, NOT the border — the
		   old wave-clearance coupling is retired (content now overlaps the animated
		   wave zones; re-probed on WebKit for scroll stalls). Top clears the 56px
		   chrome strip; sides match the chrome's inset; the bottom leaves a little
		   extra so some of the bottom border shows through beneath the content. */
		--tool-pad-top: calc(56px + 0.5rem);
		--tool-pad-bottom: 3rem;
		--tool-pad-x: clamp(1rem, 2vw, 2rem);
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

	/* ── Chrome strip ──────────────────────────────────────────────────────── */

	.tool-chrome {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		height: 56px;
		padding: 0 clamp(1rem, 2vw, 2rem);
		/* The strip itself passes clicks through; its children catch their own */
		pointer-events: none;
	}

	.tool-chrome > * {
		pointer-events: auto;
	}

	.chrome-brand {
		display: block;
		width: 3rem;
		flex: none;
	}

	.chrome-brand img {
		width: 100%;
		height: auto;
		opacity: 0.85;
		transition:
			opacity 200ms ease,
			filter 200ms ease;
	}

	.chrome-brand:hover img,
	.chrome-brand:focus-visible img {
		opacity: 1;
		filter: drop-shadow(0 0 8px rgba(108, 181, 255, 0.45));
	}

	.chrome-title {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.chrome-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.chrome-switch {
		padding: 0.35rem 0.55rem;
		border-radius: 4px;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
		transition:
			color 150ms ease,
			background 150ms ease;
	}

	.chrome-switch:hover,
	.chrome-switch:focus-visible {
		color: var(--text);
		background: rgba(255, 255, 255, 0.08);
	}

	/* Circular action buttons: solid off-white with dark glyphs — the Genshin
	   top-right pattern. Glow on hover, never resize. */
	.chrome-btn {
		width: 34px;
		height: 34px;
		flex: none;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 50%;
		background: var(--text);
		color: #0b1020;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background 150ms ease,
			box-shadow 150ms ease;
	}

	.chrome-btn:hover,
	.chrome-btn:focus-visible {
		background: #fff;
		box-shadow: 0 0 10px rgba(230, 237, 248, 0.4);
	}

	.chrome-btn svg {
		width: 18px;
		height: 18px;
	}

	.tool-main {
		position: relative;
		z-index: 1;
		width: 100%;
		min-height: 100%;
		padding: var(--tool-pad-top) var(--tool-pad-x) var(--tool-pad-bottom);
	}

	@media (prefers-reduced-motion: reduce) {
		.chrome-brand img,
		.chrome-switch,
		.chrome-btn {
			transition: none;
		}
	}
</style>
