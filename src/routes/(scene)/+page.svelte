<script lang="ts">
	import { fade } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import { goto, preloadData } from '$app/navigation';
	import {
		FADE_DURATION_MS,
		FADE_OUT_MS,
		revealDelayMs,
		sceneLayer,
		startSceneTransition
	} from '$lib/landing/transition';
	import { SILHOUETTES } from '$lib/landing/silhouettes';
	import { currentAnnouncements } from '$lib/landing/announcements';
	import { onMount } from 'svelte';

	// The banner's entries are filtered by DATE, and the first paint must be
	// deterministic (SSR → hydrate): the prerender bakes the list as of build
	// time, and the client re-filters once mounted, so an entry that expired
	// between the build and the visit shows for one frame and then leaves —
	// the safe direction. ⛔ Never filter with `new Date()` inline in the
	// template; that is a hydration mismatch waiting for the first expiry.
	let announcements = $state(currentAnnouncements());
	onMount(() => {
		announcements = currentAnnouncements();
	});

	// Card order = the task narrative (build team → plan rotation → reference
	// shelf), matching the chrome switcher in toolChrome.ts left to right.
	//
	// Two names per card. `title` is the poetic one the card wears; `tool` is
	// what the thing is actually called everywhere else on the site, set small
	// above it so the card never costs anyone a guess about where it goes. The
	// plain name comes FIRST in the DOM, so that is also what a screen reader
	// announces for the link.
	//
	// The three titles are instruments of observation in increasing scope —
	// identify → predict → examine. An ASTROLABE is a handheld instrument for
	// identifying individual bodies (who is this character, what can they do:
	// the Team Builder); an EPHEMERIS is a table of predicted positions over
	// time, read as exact numbers off rows rather than off a model (the
	// Rotation Planner); an OBSERVATORY is the house of many instruments
	// (the eight Visualizers). ⚓ Settled with Nate 2026-08-14, reaffirmed
	// 2026-09-16.
	//
	// `art` is where the silhouette sits in the plate's 100×180 space. The
	// three are drawn to different extents AND different weights — the
	// astrolabe is the densest, the ephemeris the lightest line drawing, and
	// the observatory sits between them (it is a line drawing too since its
	// 2026-09-19 redraw — no longer the solid mass it was, which is why its
	// panel is no longer held small) — so they are not box-matched; each gets its own panel, the lighter the
	// drawing the wider, so the three read at one optical size. Judged by
	// eye; adjust here, never in the artwork.
	const tools = [
		{
			id: 'team-builder',
			title: 'Astrolabe',
			tool: 'Team Builder',
			path: '/team-builder',
			art: { id: 'astrolabe', x: 10, y: 22, w: 80, h: 76 }
		},
		{
			id: 'rotation-planner',
			title: 'Ephemeris',
			tool: 'Rotation Planner',
			path: '/rotation-planner',
			art: { id: 'ephemeris', x: 7, y: 24, w: 86, h: 72 }
		},
		{
			id: 'visualizers',
			title: 'Observatory',
			tool: 'Visualizers',
			path: '/visualizers',
			art: { id: 'observatory', x: 9, y: 20, w: 82, h: 78 }
		}
	] as const;

	// ⚠️ PLACEHOLDER PLATE — Nate is still drawing the final card shape and its
	// borders. Until it lands, the card is a plain plate at the DERIVED 1:1.8
	// aspect (see memory `project_landing_card_round`: 102px wide at a 360px
	// phone, three across, no rotate-and-stack), drawn in a 100 × 180 space so
	// the interior grid there (art 16–98, label 108–152, finials top and
	// bottom) reads straight off the coordinates. Shallow points top and
	// bottom, eased shoulders, straight flanks — the old plate's family,
	// shortened. Replacing it is a viewBox + path swap; the inset hairline is
	// the same path scaled about the centre, per axis, so its gap stays even
	// (2.5 units each side).
	const PLATE_VIEWBOX = '0 0 100 180';
	const PLATE_PATH =
		'M50 0L96.5 13Q100 14 100 17.5V162.5Q100 166 96.5 167L50 180L3.5 167Q0 166 0 162.5V17.5Q0 14 3.5 13Z';
	const INSET_TRANSFORM = 'translate(50 90)scale(.95 .9722)translate(-50 -90)';

	// Start the ascend immediately on click, then defer the actual navigation
	// by two animation frames. The camera runs its own rAF loop, and a normal
	// click would commit the navigation in the same task — the destination
	// tool's mount/hydration flooding the main thread on frame 0 before the
	// climb even starts. Deferring lets the first camera frames present before
	// the mount work lands. (Open question, Nate judges on real hardware: the
	// GL camera IS main-thread rAF now, so a heavy-enough mount block mid-pan
	// can still drop frames — the shell stays unpainted through the climb,
	// which removed the dominant cost; OffscreenCanvas-in-a-worker is the
	// escalation if the residual mount flood reads as stutter.)
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

	// Warm the tool on press intent: preload the route's code + data so the
	// heavy module fetch/parse is out of the transition window by the time the
	// click commits (the trace showed the mount flood is the front-half judder
	// source). preloadData dedupes and no-ops if already warm, so firing on
	// every pointerdown is safe.
	function warmTool(path: (typeof tools)[number]['path']) {
		preloadData(resolve(path)).catch(() => {});
	}
</script>

<!-- in: delayed to end just past camera settle on the descend (the shared
	 reveal timing — the returning world arrives, then its UI does); out:
	 starts immediately on the ascend so the cards clear during the gentle
	 first leg and only sky is on screen through the fast frames. Through
	 both, the sceneLayer WAAPI ride keeps the composition world-locked to
	 the camera, so the fade happens on a surface moving WITH the scene. -->
<div
	class="composition"
	use:sceneLayer={'composition'}
	in:fade|global={{ duration: FADE_DURATION_MS, delay: revealDelayMs() }}
	out:fade|global={{ duration: FADE_OUT_MS }}
>
	<div class="composition-inner">
		<!-- The status line — "is this current?" answered ABOVE the cards, ONE
			 centred stack on the page's own axis (everything on the landing is
			 symmetric about the card group; a left/right split was tried and
			 was the one thing off-axis). The version in gold on its own line,
			 its fine print in the chrome's voice beneath — two lines BY DESIGN,
			 because one line of ~100 characters is the group's whole width at a
			 laptop and wraps mid-phrase the moment it is short of it. Renders ONLY while an entry is live
			 ($lib/landing/announcements.ts carries the rule and the expiry); an
			 empty slot is worse than none, a stale one is worse than empty. -->
		{#if announcements.length}
			<ul class="notices" aria-label="Announcements">
				{#each announcements as a (a.id)}
					<li class="notice">
						<span class="notice__text">{a.text}</span>
						{#if a.detail}<span class="notice__detail">{a.detail}</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<nav class="heroes" aria-label="critcalc tools">
			{#each tools as tool (tool.id)}
				{@const art = SILHOUETTES[tool.art.id]}
				<a
					class="hero"
					href={resolve(tool.path)}
					onpointerdown={() => warmTool(tool.path)}
					onkeydown={(e) => e.key === 'Enter' && warmTool(tool.path)}
					onclick={(e) => navigateToTool(e, tool.path)}
				>
					<!-- One plate, three passes and the art: a dark GLASS interior
						 (⚓ Nate 2026-09-16 — the toplight is gone; the fill is denser
						 than the site's other glass because the landing scene is bright
						 and carries no dim), a GOLD inset hairline (the site's
						 inset-frame convention, here as the card's border), and the
						 silhouette in the same gold in the upper art panel. No outer
						 edge: the near-opaque glass seats itself against the sky. Every gold thing on the card is one
						 colour, so the artwork's slightly uneven stroke weights read as
						 one set.
						 vector-effect keeps the hairline a true 1px: the plate scales to
						 the card, and the inset is a non-uniform scale on top of that. -->
					<svg class="hero__plate" viewBox={PLATE_VIEWBOX} aria-hidden="true" focusable="false">
						<path class="plate-fill" d={PLATE_PATH} />
						<g transform={INSET_TRANSFORM}>
							<path class="plate-inset" d={PLATE_PATH} vector-effect="non-scaling-stroke" />
						</g>
						<svg
							class="hero__art"
							x={tool.art.x}
							y={tool.art.y}
							width={tool.art.w}
							height={tool.art.h}
							viewBox={art.viewBox}
							preserveAspectRatio="xMidYMid meet"
						>
							<path d={art.d} />
						</svg>
					</svg>

					<!-- Label block: the plate's 108–152 band (60%–84%), under the art.
						 Kicker (the tool's real name) → a short gold rule → the poetic
						 name. The kicker and its rule are gold, the name is not — the
						 site's own rule that gold names a BLOCK, never a word. -->
					<span class="hero__label">
						<span class="hero__kicker">{tool.tool}</span>
						<span class="hero__rule"></span>
						<span class="hero__name">{tool.title}</span>
					</span>
				</a>
			{/each}
		</nav>
	</div>
</div>

<style>
	.composition {
		/* Single source of truth for hero card geometry.
		   Brand mark and heroes derive their horizontal extent from these,
		   so any change to height/aspect/gap ripples through automatically.

		   1:1.8 is DERIVED from the phone (memory `project_landing_card_round`):
		   three cards across a 360px viewport with 16px gutters and 10px gaps
		   leaves 102px per card, and the art panel + two-line label block need
		   172px of height — 1:1.69 with zero slack, plus ~7% air. Height-driven
		   so the clamp is in the axis that decides legibility: a 900px-tall
		   laptop gets a 414 × 230 card (184px art panel), the max clamp 480 ×
		   267, and the group settles ~880px wide on a 1440 screen. */
		--card-h-tall: clamp(17rem, 46vh, 30rem);
		/* …but THREE ACROSS AT EVERY WIDTH (⚓ Nate — never rotate-and-stack),
		   so on a phone the WIDTH binds: whatever three cards and two gaps can
		   have of the viewport inside a 16px gutter each side. 108px at 390,
		   102px at 360 — the numbers the aspect was derived from. */
		--card-w: min(calc(var(--card-h-tall) / 1.8), calc((100vw - 2rem - 2 * var(--gap)) / 3));
		--card-h: calc(var(--card-w) * 1.8);
		--gap: clamp(1rem, 2.6vw, 2.5rem);
		--group-w: calc(3 * var(--card-w) + 2 * var(--gap));
		/* The air between the doors and the band that captions them. */
		--caption-gap: 1.5rem;

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

	/* Counter-parallax layer. Fills .composition (inset:0) so the brand mark and
	   heroes anchor exactly as before; the parallax controller writes a small
	   opposing translate here each frame. Identity transform when parallax is off
	   (touch / reduced-motion / mid-transition). */
	.composition-inner {
		position: absolute;
		inset: 0;
		transform: translate3d(0, 0, 0);
		will-change: transform;
	}

	.heroes {
		position: absolute;
		/* Vertically: the cards sit a little above centre so the GROUPING —
		   cards plus the status band under them (~86px: gap + two lines) — is
		   what centres. Between chrome and footer the frame's centre is 50%;
		   the composite's centre is the cards' + 43px, so 46% puts it at ~51%
		   on a 900px frame, and the bottom points land ~69% down, past the
		   horizon at ~63%, so the cards still stand on the ground. ↻ 50% was
		   right with the band ABOVE (⚓ Nate moved it below, 2026-09-16); the
		   portrait composition is a separate item. */
		top: 46%;
		transform: translateY(-50%);
		left: 0;
		right: 0;
		height: var(--card-h);
		display: flex;
		align-items: stretch;
		justify-content: space-between;
	}

	/* The card is a frame around a plate, not a box: no background, no border
	   and no radius of its own — the SVG silhouette IS the shape, and the
	   element is only the hit target and the label's positioning context.

	   Note what is NOT here: a filter. A drop-shadow bloom is the obvious way
	   to make these glow on hover, and it is exactly the cost we took out of
	   the chrome — a filter on a hovered element promotes it and re-rasterizes
	   the whole card each frame. Everything below is paint on shapes that were
	   going to be painted anyway. */
	.hero {
		/* Hover is DENSITY in the gold, never tint: the inset line and the art
		   go from their resting alpha to full, the label with them. Alpha lives
		   in the PAINT (fill-opacity / stroke-opacity), not element opacity —
		   the card is transform-placed and moves on hover, and WebKit
		   rasterizes an opacity subtree at rounded coordinates. */
		--inset-alpha: 0.55;
		--art-alpha: 0.9;
		--label-opacity: 0.85;

		position: relative;
		height: 100%;
		aspect-ratio: 1 / 1.8;
		min-width: 0;
		display: block;
		text-decoration: none;
		color: var(--chrome);
		/* Hover lifts the card by exactly 1px — barely there, and that is the
		   point. The lighting change is what reads; the travel is only there so
		   the card feels answerable to the cursor. Transform + paint alpha only,
		   so the whole hover is compositor work plus a repaint of the plate. */
		transform: none;
		/* Only the transform animates HERE. The alpha knobs are plain
		   unregistered custom properties, so they switch instantly — what eases
		   is each child's own paint property, which sees a new computed value
		   and runs its own transition. Declaring them here would do nothing. */
		transition: transform var(--t-snap);
	}

	.hero:hover,
	.hero:focus-visible {
		--inset-alpha: 1;
		--art-alpha: 1;
		--label-opacity: 1;
		transform: translateY(-1px);
		outline: none;
	}

	.hero__plate {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	/* Dark glass, denser than the site's panels (.58) and wells (.45): the
	   landing scene is bright and wears no dim, so the card needs to be nearly
	   opaque to hold gold text, while a tenth of the sky (and the odd star)
	   still carries through to place it IN the scene rather than on it.
	   Flat, not a ramp — WebKit renders a long gradient at 8 bit with no
	   dithering and bands it, and grain was tried and rejected on sight (reads
	   as paper stock at card scale). The toplight that used to sit over this
	   is gone by Nate's call, 2026-09-16. */
	.plate-fill {
		fill: var(--glass-plate);
	}

	/* The inset frame in gold — the same idea as `--inset-line` on a panel,
	   carried further because on the card it IS the border. */
	.plate-inset {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1;
		stroke-opacity: var(--inset-alpha);
		transition: stroke-opacity var(--t-snap);
	}

	.hero__art {
		overflow: visible;
		fill: var(--accent);
		fill-opacity: var(--art-alpha);
		transition: fill-opacity var(--t-snap);
	}

	.hero__label {
		position: absolute;
		/* The 104–151 band of the plate's 180: under the art, above the bottom
		   point, centred on the straight-sided flank. */
		top: 58%;
		height: 26%;
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.45em;
		padding: 0 8%;
		text-align: center;
		opacity: var(--label-opacity);
		transition: opacity var(--t-snap);
	}

	/* Small, wide-tracked and gold — the tool's real name, read on the way to
	   the poetic one. Both label sizes follow the CARD, not the viewport: the
	   card is what the text has to fit, and it is 102px wide on a phone and
	   267 at the max clamp. The kicker is allowed to wrap ("ROTATION PLANNER"
	   runs out of card below a ~150px plate) — and when space runs out it
	   drops DECORATION, never meaning: below `compact` it loses its wide
	   tracking first (⚓ memory `project_landing_card_round`). */
	.hero__kicker {
		font-family: var(--font-mono);
		font-size: clamp(0.5rem, calc(var(--card-w) * 0.048), var(--fs-sm));
		font-weight: var(--fw-normal);
		letter-spacing: var(--ls-widest);
		line-height: var(--lh-tight);
		text-transform: uppercase;
		color: var(--accent);
	}

	/* `compact` — 40rem, $lib/breakpoints.ts (custom properties do not work
	   in media queries, so the literal is written here and cites the table). */
	@media (max-width: 40rem) {
		.hero__kicker {
			letter-spacing: var(--ls-wide);
		}
	}

	/* The kicker's rule: a short gold hairline, the width of a few characters,
	   between the plain name and the poetic one. */
	.hero__rule {
		display: block;
		width: 22%;
		height: 1px;
		background: var(--accent);
		opacity: 0.6;
	}

	.hero__name {
		font-family: var(--font-display);
		font-size: clamp(0.8rem, calc(var(--card-w) * 0.095), 1.5rem);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		line-height: var(--lh-tight);
		/* All three names are single words, so nothing wraps; the label's own
		   padding is the only constraint they need. */
		max-width: 100%;
	}

	/* ── The status band under the doors ─────────────────────────────────────
	   Hangs off the card group's own bottom edge (its centre is at 46%, its
	   half-height is --card-h / 2), so it travels with the cards through every
	   clamp. ↻ It sat above them for a cut; below, on the ground, it reads as
	   the doors' footing rather than their lintel. Plex Sans in sentence case with NORMAL tracking — the wide
	   tracking belongs to the uppercase kickers, and on body text it read
	   loose. The ladder: names 22 Bitter semibold → status 16 sans → kickers
	   11 mono. ↻ A tagline under the doors was cut 2026-09-16 (⚓ Nate: it
	   fits the OG card, the landing does not need it — if a sentence is ever
	   needed here it should be a different one). */
	.notices {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(46% + var(--card-h) / 2 + var(--caption-gap));
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.5rem;
	}

	/* A BAND that fades to nothing at both ends (⚓ Nate: a boxed band walled
	   the cards in and took from the scene). Well glass (.45) — a step lighter
	   than the cards' plate, so the cards stay the densest thing on the page —
	   with NO edge at all: no hairline, no radius. It is exactly the group's
	   width (⚓ Nate) and MASKED over its outer 15% each side, so the glass
	   dissolves toward the first and third card's outer edges; the plateau is
	   ~70% of the group, about the width of the longer line, so the text sits
	   on solid glass. A mask rather than a gradient fill so the fade is one
	   ramp on one alpha (the scrollFade rule). */
	.notice {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15em;
		padding: 0.6rem 1rem;
		background: var(--glass-well);
		mask-image: linear-gradient(to right, transparent, #000 15%, #000 85%, transparent);
		font-family: var(--font-body);
		font-size: var(--fs-xl);
		line-height: var(--lh-snug);
		text-align: center;
		color: var(--chrome);
	}

	/* The fact is gold and a weight up; the fine print recedes. */
	.notice__text {
		font-weight: var(--fw-medium);
		color: var(--accent);
		white-space: nowrap;
	}

	.notice__detail {
		opacity: 0.75;
		text-wrap: balance;
	}

	/* `compact` — 40rem, $lib/breakpoints.ts. The card names are ~13px on a
	   phone, so the captions step down to stay subordinate to them. */
	@media (max-width: 40rem) {
		.notice {
			font-size: var(--fs-lg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero,
		.hero:hover,
		.hero:focus-visible {
			transform: none;
		}
	}
</style>
