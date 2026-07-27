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
		startPortalTransition,
		setHeroOrigin
	} from '$lib/landing/transition';
	import { parallaxLayer, PARALLAX_CONTENT_FACTOR } from '$lib/landing/parallax';

	// Card order = the task narrative (build team → plan rotation → reference
	// shelf), matching the chrome switcher in toolChrome.ts left to right.
	//
	// Two names per card. `title` is the poetic one the card wears; `tool` is
	// what the thing is actually called everywhere else on the site, set small
	// above it so the card never costs anyone a guess about where it goes. The
	// plain name comes FIRST in the DOM, so that is also what a screen reader
	// announces for the link.
	//
	// The three titles are instruments of observation, one per job: an
	// astrolabe identifies which body you are looking at (the capability-
	// faceted roster), an orrery plays cyclical motion out over time (the
	// rotation), an observatory is the house of instruments (the eight
	// visualizers).
	const tools = [
		{ id: 'team-builder', title: 'Ephemeris', tool: 'Team Builder', path: '/team-builder' },
		{
			id: 'rotation-planner',
			title: 'Astrolabe',
			tool: 'Rotation Planner',
			path: '/rotation-planner'
		},
		{ id: 'crit-visualizer', title: 'Observatory', tool: 'Visualizers', path: '/crit-visualizer' }
	] as const;

	// Nate's hero-card silhouette, from assets-src/landing/hero-card.svg: a tall
	// hexagonal plate — vertical flanks, a shallow point at top and bottom, the
	// four shoulders eased rather than mitred. Path coordinates are the export's
	// own, with the export's transform kept on the element instead of baked in,
	// so a redraw from Nate only ever replaces these two strings.
	//
	// The card's aspect-ratio is set to the viewBox's, so the default
	// preserveAspectRatio fits the plate EXACTLY to the element — no distortion,
	// and the apexes land on the card's own corners at every size.
	const PLATE_VIEWBOX = '0 0 481 1240';
	const PLATE_TRANSFORM = 'matrix(1.06667 0 0 1.10345 -508.8 -200.41)';
	const PLATE_PATH =
		'M477 382.22V381c0-41.28 22.22-79.58 58.65-101.1L702 181.62l166.35 98.26C904.78 301.42 927 339.72 927 381l-.01 1.22V1106c0 41.28-22.22 79.58-58.65 101.1L702 1305.39l-166.35-98.27C499.22 1185.58 477 1147.28 477 1106l.01-1.22z';

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

		// The portal spirals open from the clicked card's center, so capture its
		// viewport-space center as the origin point. Also stash it keyed by the
		// destination path so the reverse transition can collapse back to this exact
		// card later, when the landing is no longer mounted to be measured.
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		setHeroOrigin(resolve(path), origin);

		startSceneTransition(resolve(path)); // no-op while PORTAL is on
		startPortalTransition(resolve(path), origin);
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
	<!-- Counter-parallax layer: shifts opposite the world (and less) so the
		foreground reads as nearer than the scene. Transform written directly by
		the parallax controller; identity when parallax is off. -->
	<div
		class="composition-inner"
		use:parallaxLayer={{ x: PARALLAX_CONTENT_FACTOR, y: PARALLAX_CONTENT_FACTOR }}
	>
		<!-- Gradients live once, here, and every card's plate references them by
			 id. Three cards × two paths would otherwise mean three identical
			 <defs> blocks and three sets of colliding ids.

			 ⚠️ The plate's INTERIOR is deliberately not among them. It was a
			 three-stop vertical ramp, and in WebKit a 580px ramp over ~30
			 luminance levels bands into visible steps (Blink dithers; Safari does
			 not). The fix that suggests itself is grain — feTurbulence over the
			 plate, exactly what the loading veil does for the same reason. It was
			 tried and Nate rejected it on sight: at this scale, on a card, grain
			 reads as paper stock rather than as sky. So the body is a FLAT fill
			 instead, which has no ramp to band, and the toplight is the only
			 gradient left in the interior. Keep it that way — a gradient
			 reintroduced here brings the banding back with it. -->
		<svg class="hero-defs" aria-hidden="true" focusable="false">
			<defs>
				<!-- Edge: brightest at the top point and fading down the flanks —
					 the same direction the scene's own light comes from. -->
				<linearGradient id="heroPlateEdge" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="#b9d4f5" />
					<stop offset="55%" stop-color="#6d8cba" />
					<stop offset="100%" stop-color="#3d5079" />
				</linearGradient>
				<!-- Toplight: the light the plate CATCHES, pooled at the top point
					 and gone by its waist. The one gradient in the interior, and what
					 hover raises. An early pass raised the interior's own opacity
					 instead and it read exactly backwards — the body is dark, so
					 "more of it" made the hovered card the heaviest thing on screen.
					 Light has to be added, not un-hidden.
					 Short by design: it fades out around 62%, which is both where it
					 stops looking like light and short enough a run to keep WebKit's
					 8-bit stepping under the threshold of notice. -->
				<linearGradient id="heroPlateSheen" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="#9cc3f0" stop-opacity=".5" />
					<stop offset="30%" stop-color="#7ba4d8" stop-opacity=".16" />
					<stop offset="62%" stop-color="#5f86b8" stop-opacity="0" />
				</linearGradient>
			</defs>
		</svg>

		<nav class="heroes" aria-label="critcalc tools">
			{#each tools as tool (tool.id)}
				<a
					class="hero"
					href={resolve(tool.path)}
					onpointerdown={() => warmTool(tool.path)}
					onkeydown={(e) => e.key === 'Enter' && warmTool(tool.path)}
					onclick={(e) => navigateToTool(e, tool.path)}
				>
					<!-- Four passes of one silhouette: flat interior, toplight, outer
						 edge, and an inset hairline. The inset is a NON-uniform scale
						 about the plate center because the card is 2.6× taller than it
						 is wide — a uniform scale would sit 12 units off the flanks and
						 31 off the points. Solving each axis separately keeps the gap
						 the same all the way round.
						 vector-effect keeps both lines a true hairline: the plate is
						 scaled to fit the card, and without it the stroke would scale
						 with it (and unevenly, the two axes differing). -->
					<svg class="hero__plate" viewBox={PLATE_VIEWBOX} aria-hidden="true" focusable="false">
						<g transform={PLATE_TRANSFORM}>
							<path class="plate-fill" d={PLATE_PATH} />
							<path class="plate-sheen" d={PLATE_PATH} />
							<path class="plate-edge" d={PLATE_PATH} vector-effect="non-scaling-stroke" />
						</g>
						<g transform="translate(240.5 620)scale(.9501 .9806)translate(-240.5 -620)">
							<g transform={PLATE_TRANSFORM}>
								<path class="plate-inlay" d={PLATE_PATH} vector-effect="non-scaling-stroke" />
							</g>
						</g>
					</svg>

					<!-- Label sits in the plate's straight-sided middle band (18%–82%
						 of the height); anything higher or lower would crowd a taper. -->
					<span class="hero__label">
						<span class="hero__kicker">{tool.tool}</span>
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

		   The aspect is the artwork's own (481 × 1240 — a tall, narrow plate),
		   so the card must be driven by HEIGHT: at the old 42vh these would be
		   16vh wide, barely wider than a bookmark. 58vh puts them at ~22.5vh,
		   and lands the bottom point just past the horizon (63% down the frame)
		   so the cards stand ON the ground rather than floating over it.
		   Clamped at both ends because a short laptop window would otherwise
		   make them unreadable and an ultratall one absurd. */
		--card-h: clamp(19rem, 58vh, 40rem);
		--card-w: calc(var(--card-h) * 481 / 1240);
		--gap: clamp(1rem, 2.6vw, 2.5rem);
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

	/* Gradient carrier only — never painted, never in the layout. */
	.hero-defs {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
	}

	.heroes {
		position: absolute;
		/* Vertically: the group's own center sits a little above the frame's, so
		   the taller cards clear the chrome and still plant their bottom points
		   below the horizon. */
		top: 47%;
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
	   to make these glow on hover, and it is exactly the cost we just took out
	   of the chrome — a filter on a hovered element promotes it and
	   re-rasterizes the whole card each frame. Everything below is paint on
	   shapes that were going to be painted anyway. */
	.hero {
		--edge-opacity: 0.55;
		--inlay-opacity: 0.16;
		--sheen-opacity: 0.35;
		--label-opacity: 0.72;

		position: relative;
		height: 100%;
		aspect-ratio: 481 / 1240;
		min-width: 0;
		display: block;
		text-decoration: none;
		color: var(--text);
		/* Hover lifts the card by exactly 1px — barely there, and that is the
		   point. On a 580px-tall plate the lighting change is what reads; the
		   travel is only there so the card feels answerable to the cursor.
		   Transform + opacity only, so the whole hover is compositor work. */
		transform: none;
		/* Only the transform animates HERE. The four --*-opacity knobs are plain
		   unregistered custom properties, so they switch instantly — what eases
		   is each child's own `opacity`, which sees a new computed value and
		   runs its own transition. Declaring them here would do nothing. */
		transition: transform 220ms cubic-bezier(0.33, 0, 0.18, 1);
	}

	.hero:hover,
	.hero:focus-visible {
		--edge-opacity: 1;
		--inlay-opacity: 0.4;
		--sheen-opacity: 1;
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

	/* Flat, not a ramp — see the ⚠️ on the defs block. The color is roughly
	   where the old gradient sat at the card's waist, so the body reads at the
	   weight it always did; the toplight supplies the top and nothing darkens
	   the foot.
	   Held just under fully opaque so a little of the sky, and the odd star,
	   carries through the plate — enough to place it in the scene rather than
	   on top of it. Fixed: hover changes the TOPLIGHT, never this. */
	.plate-fill {
		fill: #131c36;
		opacity: 0.88;
	}

	.plate-sheen {
		fill: url(#heroPlateSheen);
		opacity: var(--sheen-opacity);
		transition: opacity 220ms ease;
	}

	.plate-edge {
		fill: none;
		stroke: url(#heroPlateEdge);
		stroke-width: 1;
		opacity: var(--edge-opacity);
		transition: opacity 220ms ease;
	}

	.plate-inlay {
		fill: none;
		stroke: #9dc0e8;
		stroke-width: 1;
		opacity: var(--inlay-opacity);
		transition: opacity 220ms ease;
	}

	.hero__label {
		position: absolute;
		/* Dead center of the plate while the card's composition is still being
		   worked out — no bias in any direction to design around. */
		top: 50%;
		left: 0;
		right: 0;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.55em;
		padding: 0 8%;
		text-align: center;
		opacity: var(--label-opacity);
		transition: opacity 220ms ease;
	}

	/* Small, wide-tracked and quiet — the tool's real name, read on the way to
	   the poetic one. Allowed to wrap: "ROTATION PLANNER" at this tracking runs
	   out of card somewhere below a ~150px plate. */
	.hero__kicker {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		font-weight: var(--fw-normal);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		color: var(--muted);
	}

	.hero__name {
		font-family: var(--font-display);
		font-size: clamp(0.95rem, 1.35vw, 1.35rem);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		line-height: var(--lh-tight);
		/* All three names are single words, so nothing wraps; the label's own
		   padding is the only constraint they need. */
		max-width: 100%;
	}

	@media (prefers-reduced-motion: reduce) {
		.hero,
		.hero__label,
		.plate-sheen,
		.plate-edge,
		.plate-inlay {
			transition: none;
		}

		.hero,
		.hero:hover,
		.hero:focus-visible {
			transform: none;
		}
	}
</style>
