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
	import {
		HERO_ART,
		PLATE_BACK,
		PLATE_BACK_TALL,
		PLATE_H,
		PLATE_H_TALL,
		PLATE_LINE,
		PLATE_LINE_TALL,
		PLATE_VIEWBOX,
		PLATE_VIEWBOX_TALL,
		TALL_ART_DROP,
		TALL_EXTRA
	} from '$lib/landing/heroArt';

	// The tall card's geometry, handed to CSS once so the media query below has
	// no number of its own: the plate's height, and the label band (533–772 of
	// 919 on the base plate) moved down with the points.
	const LABEL_TOP = 533;
	const LABEL_H = 239;
	const tallVars = [
		`--plate-h-tall: ${PLATE_H_TALL}`,
		`--label-top-tall: ${(((LABEL_TOP + TALL_EXTRA) / PLATE_H_TALL) * 100).toFixed(3)}%`,
		`--label-h-tall: ${((LABEL_H / PLATE_H_TALL) * 100).toFixed(3)}%`,
		`--label-top: ${((LABEL_TOP / PLATE_H) * 100).toFixed(3)}%`,
		`--label-h: ${((LABEL_H / PLATE_H) * 100).toFixed(3)}%`
	].join('; ');
	import { currentAnnouncements } from '$lib/landing/announcements';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { onMount } from 'svelte';
	import HRule from '$lib/components/HRule.svelte';

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
	// `art` names the card's drawing in HERO_ART. ⚓ It carries no geometry:
	// each art is drawn on the plate's OWN artboard, so where a figure sits and
	// how big it reads are decided in Affinity. ⛔ The per-card x/y/w/h panels
	// that used to live here are gone with the placeholder plate — never bring
	// them back to nudge a figure; that edit belongs in the artwork.
	const tools = [
		{
			id: 'builder',
			title: 'Astrolabe',
			tool: 'Team Builder',
			path: '/builder',
			art: 'astrolabe'
		},
		{
			id: 'planner',
			title: 'Ephemeris',
			tool: 'Rotation Planner',
			path: '/planner',
			art: 'ephemeris'
		},
		{
			id: 'visualizers',
			title: 'Observatory',
			tool: 'Visualizers',
			path: '/visualizers',
			art: 'observatory'
		}
	] as const;

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
	style={tallVars}
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
						{#each a.lines as line (line.parts.join())}
							{#snippet parts()}
								{#each line.parts as part, i (part)}
									{#if i > 0}<span class="notice__sep" aria-hidden="true"> · </span>{/if}<span
										class="notice__part">{part}</span
									>
								{/each}
							{/snippet}
							{#if line.href === '/coverage'}
								<a
									class="notice__detail link link--quiet"
									href={resolve('/coverage')}
									onclick={(e) => openCoverage(e)}>{@render parts()}</a
								>
							{:else if line.href === '/builder'}
								<a
									class="notice__detail link link--quiet"
									href={resolve('/builder')}
									onclick={(e) => navigateToTool(e, '/builder')}>{@render parts()}</a
								>
							{:else}
								<span class="notice__detail">{@render parts()}</span>
							{/if}
						{/each}
					</li>
				{/each}
			</ul>
		{/if}

		<nav class="heroes" aria-label="critcalc tools">
			{#each tools as tool (tool.id)}
				{@const art = HERO_ART[tool.art]}
				<a
					class="hero"
					href={resolve(tool.path)}
					onpointerdown={() => warmTool(tool.path)}
					onkeydown={(e) => e.key === 'Enter' && warmTool(tool.path)}
					onclick={(e) => navigateToTool(e, tool.path)}
				>
					<!-- One artboard, painted back to front: a dark GLASS interior
						 (⚓ Nate 2026-09-16 — the toplight is gone; the fill is denser
						 than the site's other glass because the landing scene is bright
						 and carries no dim), then the figure's decorative rings, the
						 figure itself in full gold, and the card's inner line LAST so
						 the border sits over everything. No outer edge: the near-opaque
						 glass seats itself against the sky. Every gold thing on the
						 card is ONE colour at different alphas, so the drawing reads
						 as one set — heroArt.ts says why none of that paint is in the
						 data.

						 The art needs no placement: each figure is drawn on a copy of
						 this same 511 × 919 plate, so its own coordinates say where it
						 sits. ⚠️ fill-rule is evenodd for the whole tree — the rings
						 and the inner line are two-contour bands. -->
					<svg class="hero__plate" viewBox={PLATE_VIEWBOX} aria-hidden="true" focusable="false">
						<path class="plate-fill" d={PLATE_BACK} />
						{#each art as layer (layer.role)}
							<path class="art art--{layer.role}" d={layer.d} />
						{/each}
						<path class="plate-line" d={PLATE_LINE} />
					</svg>
					<!-- The tall plate (heroArt.ts § THE TALL CARD), shown instead on a
						 tall phone by CSS alone, so the first paint is right on any
						 screen. Same art, same coordinates: only the body is longer. -->
					<svg
						class="hero__plate hero__plate--tall"
						viewBox={PLATE_VIEWBOX_TALL}
						aria-hidden="true"
						focusable="false"
					>
						<path class="plate-fill" d={PLATE_BACK_TALL} />
						<g transform="translate(0 {TALL_ART_DROP})">
							{#each art as layer (layer.role)}
								<path class="art art--{layer.role}" d={layer.d} />
							{/each}
						</g>
						<path class="plate-line" d={PLATE_LINE_TALL} />
					</svg>

					<!-- Label block: the plate's 108–152 band (60%–84%), under the art.
						 Kicker (the tool's real name) → the site's centre-mark rule → the
						 poetic name. The kicker is gold, the name is not — the site's own
						 rule that gold names a BLOCK, never a word. The rule belongs to
						 the ARTWORK (the outer ring's colour), not to the label. -->
					<span class="hero__label">
						<span class="hero__kicker">{tool.tool}</span>
						<span class="hero__rule"><HRule variant="center" /></span>
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

		   The proportion is now the ARTWORK'S — 511 × 919 (1:1.7984), straight
		   off heroArt.ts's PLATE_VIEWBOX. It lands within a pixel of the 1:1.8
		   that was DERIVED from the phone (memory `project_landing_card_round`:
		   three cards across a 360px viewport with 16px gutters and 10px gaps
		   leaves 102px per card, and the art + two-line label block need 172px
		   of height — 1:1.69 with zero slack, plus ~7% air), so every size that
		   derivation quotes still holds. Height-driven so the clamp is in the
		   axis that decides legibility: a 900px-tall laptop gets a 414 × 230
		   card, the max clamp 480 × 267, and the group settles ~880px wide on a
		   1440 screen.
		   ⚠ Written as literals because they have to reach calc() and
		   aspect-ratio, which the TS constants cannot — re-copy PLATE_W/PLATE_H
		   here if a redraw ever changes the artboard. */
		--plate-w: 511;
		--plate-h: 919;
		--card-h-tall: clamp(17rem, 46vh, 30rem);
		/* …but THREE ACROSS AT EVERY WIDTH (⚓ Nate — never rotate-and-stack),
		   so on a phone the WIDTH binds: whatever three cards and two gaps can
		   have of the viewport inside a 16px gutter each side. 108px at 390,
		   102px at 360 — the numbers the aspect was derived from. */
		--card-w: min(
			calc(var(--card-h-tall) * var(--plate-w) / var(--plate-h)),
			calc((100vw - 2rem - 2 * var(--gap)) / 3)
		);
		--card-h: calc(var(--card-w) * var(--plate-h) / var(--plate-w));
		--gap: clamp(1rem, 2.6vw, 2.5rem);
		--group-w: calc(3 * var(--card-w) + 2 * var(--gap));
		/* The air between the doors and the band that captions them. */
		--caption-gap: 1.5rem;
		/* 🎛️ Where the card group's CENTRE sits, top to bottom — the cards and
		   the band under them both read it (see .heroes for the 46%). */
		--group-y: 46%;

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
		top: var(--group-y);
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
		/* ⚓ HOVER LIGHTS THE CARD'S GOLD (⚓ Nate 2026-09-21). Everything gold
		   that is the card's own CONTENT — the silhouette, the kicker and its
		   rule — steps a rung UP the ramp to --hero-lit. The two things that
		   are not content rise in DENSITY instead: the chrome name from .85 to
		   full, and the inner line --inset-line-quiet → --inset-line, staying
		   on the accent rung so the frame never competes with what it frames.
		   ⚓ The figure rests at FULL strength — it is the card's subject, so
		   it is LIT rather than faded, and its whole answer is the hue.
		   ↻ 2026-09-30 (⚓ Nate): the label's rule left this set — it is the
		   HRule centre mark in the outer ring's colour now, and like the rings
		   it does not answer hover.
		   ⚓ THE RINGS DO NOT MOVE (⚓ Nate). They are the artwork's fixed
		   decorative ladder — they exist to balance a sparse drawing by filling
		   its empty middle, so they belong to the figure's WEIGHT, not to the
		   card's state. Lighting them too would read as the whole card
		   brightening, which is the placeholder's gesture from when there were
		   only two gold things on it.
		   ⚠ The line's two ends are ROLES, not numbers, and both carry alpha at
		   :root on purpose — the card is glass over an unknown ground (app.css,
		   § the night stop). */
		--ink-figure: var(--accent);
		/* The label block's .85 as PAINT, one stop per colour in it, because
		   there is no single fill a text block can carry an alpha on.
		   ⛔ No colour here may wear a second mix — a color-mix fed by a
		   color-mix crashes WebKit. ⚠ EVERY end mixes
		   a var that resolves to a LITERAL, which is what keeps that true:
		   --accent is gold-400, --hero-lit is gold-300, --chrome is #ffffff. */
		--ink-kicker: color-mix(in srgb, var(--accent) 85%, transparent);
		--ink-name: color-mix(in srgb, var(--chrome) 85%, transparent);

		position: relative;
		height: 100%;
		aspect-ratio: var(--plate-w) / var(--plate-h);
		min-width: 0;
		display: block;
		text-decoration: none;
		color: var(--chrome);
		/* Hover lifts the card by exactly 1px — barely there, and that is the
		   point. The lighting change is what reads; the travel is only there so
		   the card feels answerable to the cursor. Transform + paint alpha only,
		   so the whole hover is compositor work plus a repaint of the plate. */
		transform: none;
		/* ⚠⚠ PROMOTED ON PURPOSE — this is a SAFARI fix (⚓ Nate saw it live,
		   2026-09-21). The card is a great deal of fine vector detail now, and
		   through the 1px lift WebKit was re-rasterizing all of it at each new
		   sub-pixel offset: every gold stroke crawls on its own, which reads as
		   the whole card dancing. Promoting it hands the translate to the
		   compositor, so the artwork rasterizes ONCE and is then just moved.
		   ⛔ Never promote .hero__plate instead. A promoted CHILD of a
		   transform-animated parent gets positioned at ROUNDED coordinates —
		   that is the same snapping this exists to cure, and it would move the
		   artwork relative to the label besides.
		   ⚠ Translate only, never scale, so nothing ever resamples; and three
		   cards is three textures, which is why this is affordable here and
		   would not be on a roster grid. */
		will-change: transform;
		/* Only the transform animates HERE. The alpha knobs are plain
		   unregistered custom properties, so they switch instantly — what eases
		   is each child's own paint property, which sees a new computed value
		   and runs its own transition. Declaring them here would do nothing. */
		transition: transform var(--t-snap);
	}

	.hero:hover,
	.hero:focus-visible {
		--ink-figure: var(--hero-lit);
		--ink-kicker: var(--hero-lit);
		--ink-name: var(--chrome);
		transform: translateY(-1px);
		outline: none;
	}

	.hero:hover .plate-line,
	.hero:focus-visible .plate-line {
		fill: var(--inset-line);
	}

	.hero__plate {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
		/* ⚠ LOAD-BEARING, and inherited by every path below. The rings and the
		   inner line are two-contour bands; under nonzero, contours wound the
		   same way fill solid and the band becomes a disc. The exports declare
		   it at their own root, so this matches the drawing. (The older, much
		   simpler silhouettes measured identical either way — that note does
		   not transfer to this artwork.) */
		fill-rule: evenodd;
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
	   carried further because on the card it IS the border. ⚓ A drawn BAND
	   now, not a stroke, which is what retired the old INSET_TRANSFORM: the
	   hairline gap is even because Nate drew it even, not because a per-axis
	   scale was solved for one proportion. */
	.plate-line {
		fill: var(--inset-line-quiet);
		transition: fill var(--t-snap);
	}

	/* The figure and its rings, all one gold at four alphas. ⚓ The rings are a
	   fixed decorative ladder — they balance a sparse drawing by filling the
	   empty middle, so they belong to the ARTWORK's weight, not to the card's
	   state, and nothing about hover or focus touches them. */
	.art {
		fill: var(--accent);
	}

	.art--outer-ring {
		fill-opacity: 0.09;
	}

	.art--middle-ring {
		fill-opacity: 0.06;
	}

	.art--inner-ring {
		fill-opacity: 0.03;
	}

	/* The figure is the one part of the drawing that answers the cursor, and
	   it answers in HUE rather than alpha — it carries no fill-opacity at all,
	   resting at full --accent and stepping a rung up on hover.
	   ⚠ Compound selector: a lone modifier TIES with .art on specificity and
	   would be left to source order, the same trap as .panel--paper. */
	.art.art--figure {
		fill: var(--ink-figure);
		transition: fill var(--t-snap);
	}

	.hero__label {
		position: absolute;
		/* The 104–151 band of the plate's 180: under the art, above the bottom
		   point, centred on the straight-sided flank. */
		top: var(--label-top);
		height: var(--label-h);
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.45em;
		padding: 0 8%;
		text-align: center;
		/* ⛔ NO OPACITY HERE, AND NONE ON ITS CHILDREN — each colour carries
		   its own alpha in the paint (--ink-* on .hero) and rises with the
		   figure on hover. This block was element opacity .85 with the rule's
		   .6 nested inside it: two stacked rasterization units inside a card
		   the parallax controller re-places every frame the pointer moves.
		   ⚠ That is the sub-pixel law's case, and it is NOT only a hover-time
		   one, as the note that used to sit here claimed. */
	}

	/* Small, wide-tracked and gold — the tool's real name, read on the way to
	   the poetic one. Both label sizes follow the CARD, not the viewport: the
	   card is what the text has to fit, and it is 102px wide on a phone and
	   267 at the max clamp. The kicker is allowed to wrap ("ROTATION PLANNER"
	   runs out of card below a ~150px plate) — and when space runs out it
	   drops DECORATION, never meaning: below `compact` it loses its wide
	   tracking first (⚓ memory `project_landing_card_round`). */
	.hero__kicker {
		/* Set like the BETA tag — same face, weight and tracking, so the
		   site's two small caps labels read as one voice. ⚓ BODY, not mono
		   (⚓ Nate 2026-09-21).
		   ⚠ The body face is VARIABLE, so --fw-semibold is a REAL 600 here.
		   The pair was mono at --fw-bold, where 700 quietly FOLDED to the
		   static cut's 600 — moving to Plex Sans is what makes the weight the
		   one that was asked for. (app.css § the weight ladder.) */
		font-family: var(--font-body);
		font-size: clamp(0.5rem, calc(var(--card-w) * 0.048), var(--fs-sm));
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		line-height: var(--lh-tight);
		text-transform: uppercase;
		color: var(--ink-kicker);
		transition: color var(--t-snap);
	}

	/* `compact` — 40rem, $lib/breakpoints.ts (custom properties do not work
	   in media queries, so the literal is written here and cites the table). */
	@media (max-width: 40rem) {
		.hero__kicker {
			letter-spacing: var(--ls-wide);
		}
		/* ⚓ Nate 2026-10-18: three-quarter size on a phone (HRule §
		   --rule-size) — see SiteFooter for why 7.5px is safe there. */
		.hero__rule {
			--rule-size: 7.5px;
		}
	}

	/* `compact` — 40rem. ⚓ Nate 2026-10-18: on a phone the cards are bound by
	   WIDTH, so give them all of it — the 10px gaps the card's aspect was
	   derived from (see --plate-w above), not the 16px floor of --gap. */
	@media (max-width: 40rem) {
		.composition {
			--gap: 0.625rem;
		}
	}
	/* 🎛️ A TALL phone (taller than 5:3 portrait — iPhone 16 is ~2.2:1) has more
	   sky and floor than the group uses, and at 46% the group sat low with the
	   floor empty under its band. Lifted to centre the group between the chrome
	   and the footer — a starting value for Nate's eye (2026-10-18). */
	/* The tall plate is off unless the tall-phone query below turns it on. */
	.hero__plate--tall {
		display: none;
	}
	@media (max-width: 40rem) and (max-aspect-ratio: 3/5) {
		.composition {
			--group-y: 42%;
			/* The TALL card (demo): the plate's proportion and its label band
			   switch to the stretched plate's, and the base SVG gives way. */
			--plate-h: var(--plate-h-tall);
			--label-top: var(--label-top-tall);
			--label-h: var(--label-h-tall);
		}
		.hero__plate:not(.hero__plate--tall) {
			display: none;
		}
		.hero__plate--tall {
			display: block;
		}
	}

	/* The label's rule: the site's centre-mark HRule (⚓ Nate 2026-09-30) —
	   decorative ink like the rings, so like them it never answers hover.
	   ⚠ OPAQUE — `--hero-rule` (app.css) says why.
	   Width: the mark is 28px, so the rule needs room for a line either side
	   on the 102px phone card. */
	.hero__rule {
		display: block;
		width: 52%;
		--rule-tint: var(--hero-rule);
	}

	.hero__name {
		font-family: var(--font-display);
		font-size: clamp(0.8rem, calc(var(--card-w) * 0.095), 1.5rem);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		line-height: var(--lh-tight);
		color: var(--ink-name);
		transition: color var(--t-snap);
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
		top: calc(var(--group-y) + var(--card-h) / 2 + var(--caption-gap));
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
		/* A line's parts stack instead of wrapping mid-name ("Spiral Abyss:
		   Stardread / Moon" at 390, ⚓ Nate 2026-10-18). */
		/* 🎛️ The fine print a step under the headline (⚓ Nate 2026-10-18: the
		   band's text outweighed the card names, ~13px on a phone). */
		.notice__detail {
			font-size: var(--fs-md);
		}
		.notice__sep {
			display: none;
		}
		.notice__part {
			display: block;
		}
	}
	/* Wide: a part never breaks inside itself; the line wraps between parts. */
	.notice__part {
		white-space: nowrap;
	}

	@media (prefers-reduced-motion: reduce) {
		.hero,
		.hero:hover,
		.hero:focus-visible {
			transform: none;
		}
	}
</style>
