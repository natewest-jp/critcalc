<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';
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

	// Chrome identity derives from the route; the nav lists every tool and marks
	// the current one (see the centered switcher in the chrome strip).
	const tool = $derived(TOOLS.find((t) => page.url.pathname.startsWith(t.path)));

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
		crossfadeReady = true; // first mount done — real tool→tool nav now cross-fades
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

	// Tool→tool cross-fade. Rather than the View Transitions API (which snapshots
	// the whole viewport — and WebKit chokes on snapshotting the heavy, animated
	// Dire border, freezing then hard-cutting), we key the routed page on its path
	// and cross-fade the two page layers with a plain opacity transition. The Dire
	// border lives OUTSIDE .tool-main, so it keeps animating live throughout —
	// nothing is snapshotted, so every engine behaves identically.
	const XFADE_MS = 500;
	// Gate the very first mount (cold load / portal entry is the portal's job, and
	// the shell is hidden until revealed anyway) so the fade only plays on real
	// tool→tool navigation.
	let crossfadeReady = $state(false);
	const xfade = (node: Element) =>
		fade(node, {
			duration: crossfadeReady && !prefersReducedMotion() ? XFADE_MS : 0,
			easing: cubicInOut
		});
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
			<span class="chrome-wordmark">critcalc</span>
		</a>

		<nav class="chrome-nav" aria-label="Tools">
			{#each TOOLS as t (t.path)}
				{#if t === tool}
					<span class="chrome-nav-link is-current" aria-current="page">{t.short}</span>
				{:else}
					<a class="chrome-nav-link" href={resolve(t.path)}>{t.short}</a>
				{/if}
			{/each}
		</nav>

		<nav class="chrome-actions" aria-label="Tool actions">
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
		{#key page.url.pathname}
			<div class="tool-page" in:xfade out:xfade>
				{@render children()}
			</div>
		{/key}
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
		/* Three tracks: brand left, tool switcher dead-centre, actions right. The
		   equal 1fr flanks keep the middle nav centred on the strip regardless of
		   how wide the brand or the action cluster get. */
		display: grid;
		grid-template-columns: 1fr auto 1fr;
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
		justify-self: start;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: none;
	}

	.chrome-brand img {
		width: 3.4rem;
		height: auto;
		margin-top: -0.085em;
		opacity: 0.85;
		transition:
			opacity 200ms ease,
			filter 200ms ease;
	}

	.chrome-wordmark {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 550;
		letter-spacing: 0.02em;
		color: var(--text);
		opacity: 0.9;
		transition: opacity 200ms ease;
	}

	.chrome-brand:hover img,
	.chrome-brand:focus-visible img {
		opacity: 1;
		filter: drop-shadow(0 0 8px rgba(108, 181, 255, 0.45));
	}

	.chrome-brand:hover .chrome-wordmark,
	.chrome-brand:focus-visible .chrome-wordmark {
		opacity: 1;
	}

	/* Centred tool switcher — every tool in Bitter. */
	.chrome-nav {
		justify-self: center;
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.chrome-nav-link {
		position: relative;
		font-family: var(--font-display);
		font-size: 0.98rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--muted);
		padding: 0.15rem 0;
		transition: color 150ms ease;
	}

	a.chrome-nav-link:hover,
	a.chrome-nav-link:focus-visible {
		color: var(--text);
	}

	/* The page you're on: brighter, non-interactive, and set apart from the
	   navigable tools by an accent underline — "you are here", not a link. */
	.chrome-nav-link.is-current {
		color: var(--text);
		cursor: default;
	}

	.chrome-nav-link.is-current::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -2px;
		height: 2px;
		border-radius: 1px;
		background: var(--accent);
	}

	.chrome-actions {
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	/* Circular action buttons: solid off-white with dark glyphs — the Genshin
	   top-right pattern. Glow on hover, never resize. */
	.chrome-btn {
		width: 32px;
		height: 32px;
		flex: none;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 50%;
		background: var(--text);
		color: #0b1020;
		font-family: var(--font-mono);
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
		/* Single-cell grid so the outgoing + incoming page layers stack in the same
		   spot during the cross-fade — grid stacking rather than absolute positioning,
		   so the cell grows with content and page-scrolling tools keep scrolling. */
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}

	.tool-page {
		grid-area: 1 / 1;
		min-width: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.chrome-brand img,
		.chrome-wordmark,
		.chrome-nav-link,
		.chrome-btn {
			transition: none;
		}
	}
</style>
