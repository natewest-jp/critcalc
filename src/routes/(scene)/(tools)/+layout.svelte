<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		FADE_OUT_MS,
		hasActivePortal,
		portalTimeUntilBlackout,
		registerToolReveal,
		startPortalTransition,
		getHeroOrigin,
		prefersReducedMotion,
		sceneOccluded
	} from '$lib/landing/transition';
	import DireBorder from './lib/DireBorder.svelte';
	import ChromeOverlay from './lib/ChromeOverlay.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import { TOOLS } from './lib/toolChrome';
	import { prewarmPlannerCharacters } from './lib/prewarmPlanner';

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

	// Scene occlusion report (perf audit F4): two rAFs after the shell is
	// revealed it is PAINTED opaque (#000, inset:0) over the scene — the same
	// double-frame guarantee the portal reveal handshake uses — so the scene
	// layout can unpaint its layers and release their textures. Re-asserted on
	// every completed navigation within the tools layout (the path dependency),
	// which re-hides the scene if a cancelled exit to the landing restored it;
	// a cancelled exit with no follow-up nav just leaves the scene rastered
	// behind the opaque shell — correct, merely not minimal. The scene layout
	// itself flips this false on the way back to the landing.
	$effect(() => {
		void page.url.pathname;
		if (!revealed) return;
		let raf = requestAnimationFrame(() => {
			raf = requestAnimationFrame(() => sceneOccluded.set(true));
		});
		return () => cancelAnimationFrame(raf);
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
	// and cross-fade the two page layers. The Dire border lives OUTSIDE .tool-main,
	// so it keeps animating live throughout — nothing is snapshotted, so every
	// engine behaves identically.
	//
	// The fade is PAINT-GATED, not wall-clock. Svelte's fade() starts its clock at
	// mount, so a heavy mount (the planner's ~200ms instantiation block on WebKit)
	// silently eats the first chunk of the fade and the content snaps in at partial
	// opacity. Instead the incoming page mounts at opacity 0, waits for its first
	// real paint (double rAF — the portal reveal handshake's trick), and only then
	// do both layers cross-fade via CSS transitions. The mount block plays out
	// behind the old page at full opacity (a brief hold that reads as "loading"),
	// and the fade always runs its full arc. Skipping fade() also skips its
	// getComputedStyle(node).opacity read, which forced a synchronous style recalc
	// of the freshly-mounted planner subtree (42ms of the Chrome nav block in the
	// 2026-07-10 profile).
	//
	// ⚠️ Orchestration lives in afterNavigate, NOT in per-element actions/module
	// state, because outroing keyed blocks can be REVIVED: navigate A→B→A within
	// the retention window and Svelte cancels A's outro and reinserts the SAME
	// element — still carrying whatever inline styles it faded out with, and
	// without re-running `use:` actions. A one-shot action scheme left revived
	// pages stuck at opacity 0 (the "navigates to an empty shell" bug).
	// afterNavigate runs on every navigation regardless of element freshness, so
	// every pass re-derives each layer's role (incoming = data-page matches the
	// new pathname; everything else outgoing) and restyles all of them.
	const XFADE_MS = 500;
	const XFADE_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'; // cubicInOut
	// Directional slide (simplification chunk 3): the tools sit left-to-right in
	// TOOLS order (TB / RP / Visualizers), so a tool→tool navigation PANS the
	// page-layer pair sideways instead of cross-fading — the outgoing page exits
	// toward its own side of the order and the incoming one sweeps in from the
	// other, edges passing at the seam (the TB bench and the RP portrait column
	// mirror each other there — the continuity the pan implies). Same paint/
	// settle gating as the fade; transform-only, so it stays compositor-side.
	// Both layers ride 100vw (the layer width), leaving a constant 2×pad gutter
	// between them mid-pan — reads as panels with a gap, by design.
	// Slow and deliberate (Nate 2026-07-25): a full-viewport pan wants to read
	// as a camera move, not a snap. The curve is Nate's, tuned by hand in the
	// inspector — a symmetric in-out sitting between sine and cubic (gentle
	// build, ~1.9× average peak). He iterated away from both quintInOut (too
	// much build-up) and sineInOut (a touch flat) to land here; treat the
	// numbers as design, not derivation.
	const SLIDE_MS = 1400;
	const SLIDE_EASE = 'cubic-bezier(0.54, 0, 0.46, 1)'; // Nate's hand-tuned in-out
	const toolIndex = (path: string | null | undefined) =>
		path == null ? -1 : TOOLS.findIndex((t) => path.startsWith(t.path));
	// Retention budget for the outgoing layer: worst-case mount-block hold
	// (settle cap 450ms) + the longest motion (the slide) + margin. Only delays
	// teardown of the (inert, off-screen) old subtree — not user-visible.
	const HOLD_MAX_MS = 2500;

	let toolMain: HTMLDivElement | undefined = $state();

	// out: keeps the outgoing page in the DOM (Svelte marks it inert) under the
	// incoming one, and revivable if the user navigates straight back. Opacity is
	// driven by the afterNavigate orchestration — this emits no styles of its own.
	function holdPage(_node: Element) {
		return { duration: prefersReducedMotion() ? 0 : HOLD_MAX_MS };
	}

	// use: stamps the page layer with the pathname it was created for. Actions run
	// once per element, so a revived layer keeps its original stamp — which is
	// exactly what lets afterNavigate recognise it as the incoming page again.
	function stampPage(node: HTMLElement) {
		node.dataset.page = page.url.pathname;
	}

	// Kick the planner's character-payload fetches at click time so they land
	// before the cross-fade instead of re-parsing the rotation mid-fade
	// (see prewarmPlanner.ts).
	beforeNavigate((nav) => {
		if (nav.to?.url.pathname.startsWith('/rotation-planner')) prewarmPlannerCharacters();
	});

	afterNavigate((nav) => {
		// 'enter' = initial load (cold load / portal reveal owns that path). A lone
		// page layer means nothing to cross-fade (e.g. landing→tool, where the old
		// DOM lives outside this layout).
		if (nav.type === 'enter' || prefersReducedMotion() || !toolMain) return;
		const pages = [...toolMain.querySelectorAll<HTMLElement>(':scope > .tool-page')];
		if (pages.length < 2) return;
		const path = page.url.pathname;
		const matches = pages.filter((p) => p.dataset.page === path);
		const incoming = matches[matches.length - 1] ?? pages[pages.length - 1];
		const outgoing = pages.filter((p) => p !== incoming);

		// Pan direction from the tool order: +1 = destination lies to the RIGHT
		// (content sweeps left), −1 mirrored, 0 = either side unknown → the
		// plain cross-fade handles it.
		const fromIdx = toolIndex(nav.from?.url.pathname);
		const toIdx = toolIndex(path);
		const dir = fromIdx >= 0 && toIdx >= 0 ? Math.sign(toIdx - fromIdx) : 0;

		// Freeze the incoming layer BEFORE the first paint of the new route: a
		// fresh mount starts hidden; a revived layer (caught mid-fade-out) holds
		// its current opacity so the fade-in resumes from there, not from a pop.
		// will-change promotes both layers NOW, so WebKit builds/rasters their
		// compositor layers during the mount paint (behind the held old page)
		// instead of at fade start — measured 2026-07-10: starting the opacity
		// transition on unpromoted layers cost WebKit 60–90ms of layerization
		// right as the fade opened, stuttering it. Cleared after the fade (the
		// full-viewport retina layers are ~25MB each — the Dire-border texture
		// lesson says don't keep those alive).
		// 0.001, not 0: WebKit skips rasterizing a fully-transparent layer until
		// its opacity goes nonzero, which would land the raster cost (~40ms) at
		// fade start anyway. An imperceptible epsilon forces the raster to happen
		// here, pre-paint, with the layerization.
		incoming.style.willChange = dir ? 'transform, opacity' : 'opacity';
		incoming.style.transition = 'none';
		if (dir) {
			// Slide mode: a fresh mount parks off-screen on its entry side; a
			// revived layer (caught mid-slide-out) resumes from wherever its
			// matrix is right now instead of teleporting to the edge.
			incoming.style.transform =
				incoming.style.transform === ''
					? `translateX(${dir * 100}vw)`
					: getComputedStyle(incoming).transform;
		}
		incoming.style.opacity =
			incoming.style.opacity === '' ? '0.001' : getComputedStyle(incoming).opacity;
		for (const o of outgoing) o.style.willChange = dir ? 'transform' : 'opacity';

		// Paint-gate + settle-gate. The first rAF ticks put us past the new
		// route's first paint; then keep watching frame gaps until the main
		// thread has produced two consecutive clean frames before starting the
		// fade. WebKit runs 60–90ms of post-mount work (CodeMirror measure, the
		// timeline's first full style pass) 1–3 frames AFTER first paint —
		// starting the fade on paint alone let those blocks stutter its opening.
		// Capped so a persistently-busy page still fades. Chrome/FF settle on
		// the first ticks, so this adds ~1 extra frame of hold there.
		const SETTLE_GAP_MS = 24;
		const SETTLE_CAP_MS = 450;
		const t0 = performance.now();
		let lastTs = 0;
		let quietFrames = 0;
		const startFade = () => {
			if (dir) {
				// The pan. Opacity JUMPS to 1 untransitioned — the layer is still
				// off-screen (or mid-slide) when it happens, so there's no pop;
				// only transform animates. The outgoing layers stay fully opaque
				// and exit toward their own side: panels passing, not fading.
				incoming.style.transition = `transform ${SLIDE_MS}ms ${SLIDE_EASE}`;
				incoming.style.opacity = '1';
				incoming.style.transform = 'translateX(0)';
				for (const o of outgoing) {
					if (!o.isConnected) continue;
					o.style.transition = `transform ${SLIDE_MS}ms ${SLIDE_EASE}`;
					o.style.transform = `translateX(${dir * -100}vw)`;
				}
			} else {
				incoming.style.transition = `opacity ${XFADE_MS}ms ${XFADE_EASE}`;
				incoming.style.opacity = '1';
				for (const o of outgoing) {
					if (!o.isConnected) continue;
					o.style.transition = `opacity ${XFADE_MS}ms ${XFADE_EASE}`;
					o.style.opacity = '0';
				}
			}
			// De-promote the settled layer once the motion is over — but only if
			// this navigation still owns it (a newer pass re-promotes and
			// re-times). The transform/transition also clear so the settled page
			// is a plain static layer again.
			setTimeout(
				() => {
					if (page.url.pathname === path && incoming.isConnected) {
						incoming.style.willChange = '';
						incoming.style.transform = '';
						incoming.style.transition = '';
					}
				},
				(dir ? SLIDE_MS : XFADE_MS) + 100
			);
		};
		const tick = (ts: number) => {
			// A newer navigation owns the layers now — its own pass restyled them.
			if (page.url.pathname !== path || !incoming.isConnected) return;
			quietFrames = lastTs !== 0 && ts - lastTs < SETTLE_GAP_MS ? quietFrames + 1 : 0;
			lastTs = ts;
			if (quietFrames >= 2 || ts - t0 > SETTLE_CAP_MS) {
				startFade();
				return;
			}
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
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
			<span class="chrome-wordmark">critcalc.app</span>
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

	<div class="tool-main" bind:this={toolMain}>
		{#key page.url.pathname}
			<div class="tool-page" use:stampPage out:holdPage>
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
		<p class="chrome-guide-more">
			<a href="{resolve('/faq')}#{tool.path.slice(1)}">Full guide &amp; FAQ →</a>
		</p>
	</ChromeOverlay>
{/if}

<ChromeOverlay title="Settings" bind:open={settingsOpen}>
	<SettingsPanel />
</ChromeOverlay>

<style>
	.tool-shell {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* x hidden, not auto: the directional tool→tool slide translates page
		   layers a full viewport sideways — overflow-x:auto would mint a
		   horizontal scrollbar for the off-screen layer mid-slide. Tools never
		   scroll the shell horizontally (wide content scrolls in its own
		   containers), so nothing is lost. */
		overflow-x: hidden;
		overflow-y: auto;
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
		/* Scroll-under: per-layer wave opacity — how firmly each wave body
		   occludes content passing beneath (three layers stack, so the deep
		   body is effectively opaque). 0.9 is Nate's editor-tuned value; the
		   fill gradients live in the GL module's layer defs. */
		--dire-wave-cover: 0.9;
		/* Wave tile width: smaller = smaller waves but MUCH lighter compositor
		   textures (memory ∝ tile-w²), which is what curbs the eviction-flash +
		   scroll judder. Dial to taste (down from the 220vw default). */
		--dire-tile-w: 130vw;
		/* Wave speed: 1 = the tuned feel (the ×10 tuning is baked into the base
		   durations). Noise pace is its own knob — they never tune well together. */
		--dire-speed: 0.5;
		--dire-noise-dur: 9.9s;
		/* Scroll-under geometry: the chrome is fixed again, backed by the TOP
		   waves painting over content (DireBorder's over-stratum, z2) — the top
		   pad parks rest content below the crest line; mid-scroll it passes
		   under the wave silhouettes. --tool-pad-top stays "breathing room below
		   the chrome" (.tool-main adds --chrome-h itself; viewport-height
		   workspaces subtract both, unchanged). The BOTTOM edge does not occlude
		   (content draws over it, as ever), so its pad is just breathing room
		   that lets some of the border show beneath content. */
		--chrome-h: 56px;
		--tool-pad-top: 0.5rem;
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
		/* Fixed strip, take two (scroll-under round): content now scrolls UNDER
		   the dire border's raised edge treatment and fades into the top scrim
		   before it reaches this strip, so the two obstruction complaints that
		   un-fixed it (Nate 2026-07-21) are both addressed — the scrim keeps the
		   strip legible, pointer-events pass-through keeps it click-transparent. */
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
		height: var(--chrome-h);
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
		font-size: var(--fs-2xl);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-tight);
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
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
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

	/* Circular action buttons: off-white with dark glyphs — the Genshin
	   top-right pattern. Resting state is slightly smaller + translucent so
	   the pair recedes into the chrome (they read too loud at full solid,
	   Nate 2026-07-19); hover snaps to the full solid white + glow, so the
	   original treatment survives as the hover payoff. Never resize on hover. */
	.chrome-btn {
		width: 29px;
		height: 29px;
		flex: none;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 50%;
		background: color-mix(in srgb, var(--text) 72%, transparent);
		color: #0b1020;
		font-family: var(--font-body);
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
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
		width: 16px;
		height: 16px;
	}

	.tool-main {
		position: relative;
		z-index: 1;
		width: 100%;
		min-height: 100%;
		padding: calc(var(--chrome-h) + var(--tool-pad-top)) var(--tool-pad-x) var(--tool-pad-bottom);
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

	.chrome-guide-more {
		margin-top: 0.4rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--border);
	}

	.chrome-guide-more a {
		color: var(--accent);
		font-weight: var(--fw-semibold);
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color 150ms ease;
	}

	.chrome-guide-more a:hover,
	.chrome-guide-more a:focus-visible {
		border-bottom-color: var(--accent);
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
