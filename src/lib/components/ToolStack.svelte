<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		BAND_A_H,
		BAND_B_H,
		BAND_GAP,
		BAND_PAD_X,
		BAND_RADIUS,
		BAND_STACK_GAP
	} from '$lib/toolBands';
	import { RIBBON_OVERHANG_Y, RIBBON_W, TOOL_INSET } from '$lib/benchBand.svelte';

	// ---------------------------------------------------------------------------
	// THE TOOL STACK (toolbar round, ⚓ NATE 2026-08-07) — one component owning
	// the whole vertical arrangement every tool shares: the bench ribbon's dock,
	// the two-tier band header, and the tool's own surface below it. The geometry
	// lives in $lib/toolBands.ts; see its header for the diagram and the rule
	// that decides which band a control belongs in.
	//
	// Why the dock moved HERE from inside each tool's frame: it used to hang off
	// the frame's padding box, which is why it needed RIBBON_DOCK_LEFT to walk
	// back out past --tool-pad-x and the frame's own border. The stack's padding
	// box already starts at the content margin, so the anchor is simply left: 0,
	// top/bottom: -RIBBON_OVERHANG_Y — and, crucially, it now spans the BANDS
	// TOO, which is the whole point of the round: the ribbon stands proud of the
	// entire tool object, not just its surface.
	//
	// One dock definition instead of two also closes the drift the abutting round
	// found the hard way (the TB's bench zone was pinned at 189 while
	// RIBBON_CHROME moved 15 → 16): there is now no second copy to fall behind.
	// ---------------------------------------------------------------------------

	let {
		benched = false,
		fill = false,
		bandALeft,
		bandARight,
		bandBLeft,
		bandBCenter,
		bandBRight,
		bandBFull,
		surface
	}: {
		/**
		 * Does the bench ribbon dock against this tool? True for the planner and
		 * the Team Builder (they share one working team); false for the
		 * Visualizers, which has no team and whose stack therefore starts at the
		 * content margin instead of after the ribbon's column.
		 */
		benched?: boolean;
		/** The surface flexes to fill the stack's height (viewport-fit tools). */
		fill?: boolean;
		bandALeft?: Snippet;
		bandARight?: Snippet;
		bandBLeft?: Snippet;
		/**
		 * A middle zone for band B, centred against the BAND rather than between
		 * its neighbours. Opting in switches the band to a three-track grid; the
		 * Team Builder's Atlas/Roster/Compare navigation is its one caller.
		 */
		bandBCenter?: Snippet;
		bandBRight?: Snippet;
		/**
		 * Band B as ONE full-width run instead of the left/right pair — the
		 * Visualizers' case, where the band is subdivided by the tile grid rather
		 * than by zone. Wins over bandBLeft/bandBRight when present.
		 */
		bandBFull?: Snippet;
		surface: Snippet;
	} = $props();
</script>

<div
	class="tool-stack"
	class:tool-stack--fill={fill}
	style:--band-a-h="{BAND_A_H}px"
	style:--band-b-h="{BAND_B_H}px"
	style:--band-pad-x="{BAND_PAD_X}px"
	style:--band-radius="{BAND_RADIUS}px"
	style:--band-gap="{BAND_GAP}px"
	style:--band-stack-gap="{BAND_STACK_GAP}px"
	style:--stack-inset="{benched ? TOOL_INSET : 0}px"
>
	{#if benched}
		<!-- The RIBBON's dock: an invisible, ribbon-sized anchor the (tools)
		     layout measures to place the bench strip. It spans the stack — bands
		     AND surface — and stands RIBBON_OVERHANG_Y proud at both ends, so the
		     strip always reads as the taller object beside the whole tool.
		     Absolute insets resolve against .tool-stack's PADDING box, which
		     begins at the content margin (the padding-left is what holds the tool
		     off the ribbon's column), so left: 0 IS the content margin. -->
		<div
			class="tool-stack-dock"
			data-bench-anchor
			style:top="-{RIBBON_OVERHANG_Y}px"
			style:bottom="-{RIBBON_OVERHANG_Y}px"
			style:width="{RIBBON_W}px"
		></div>
	{/if}

	<!-- The band header. ↻ ⚓ NATE 2026-08-09 (second move of the day): band A
	     LOSES ITS BAND. The document controls stop being contents of a rail and
	     become free glass objects standing on the scene; band B keeps its rail
	     and becomes the tool's one banded row. See the CSS for why the class
	     stays even though the ground goes. -->
	<div class="bands">
		<div class="band band-a ctx-glass">
			<div class="band-zone">{@render bandALeft?.()}</div>
			<div class="band-zone band-zone--end">{@render bandARight?.()}</div>
		</div>
		<div class="band band-b ctx-glass" class:band--3up={!!bandBCenter}>
			{#if bandBFull}
				<!-- The full-width variant is one flex child that must actually FILL
				     the band: the Visualizers lays a grid in here whose columns have
				     to line up with the tile grid below, and a content-sized child
				     would collapse them to their labels' widths. -->
				<div class="band-full">{@render bandBFull()}</div>
			{:else}
				<div class="band-zone">{@render bandBLeft?.()}</div>
				{#if bandBCenter}
					<!-- ⚠ Centred against the BAND, not against its neighbours. This is
					     why the 3-up variant is a grid with equal outer tracks rather
					     than `justify-content: center` on a flex row: the Team Builder
					     puts one word on the left and a menu whose label changes width
					     ("C0" … "My roster") on the right, and with flex the nav would
					     slide sideways every time that reading changed. -->
					<div class="band-zone band-zone--center">{@render bandBCenter()}</div>
				{/if}
				<div class="band-zone band-zone--end">{@render bandBRight?.()}</div>
			{/if}
		</div>
	</div>

	<div class="tool-surface">{@render surface()}</div>
</div>

<style>
	/* The stack's padding box starts at the content margin; the padding-left is
	   what holds the BANDS AND THE SURFACE off the ribbon's column. Both tiers
	   and the frame therefore share one left edge by construction — the old
	   arrangement carried --rp-tool-inset / --tb-tool-inset on three separate
	   elements and relied on them not drifting apart. */
	.tool-stack {
		position: relative;
		padding-left: var(--stack-inset);
		display: flex;
		flex-direction: column;
		gap: var(--band-stack-gap);
		min-width: 0;
	}

	/* Viewport-fit tools (the Team Builder): the surface takes whatever the
	   bands leave. min-height:0 so its own internal scrollers can shrink.

	   ↻ 2026-08-08: this was `height: 100%`, which SILENTLY never resolved. A
	   percentage height needs a definite height on the parent, and the chain
	   above is `.tool-shell` (definite) → `.tool-main` (min-height: 100%, so
	   the tool can page-scroll — deliberately NOT definite) → `.tool-page` (a
	   grid item, auto row). So `fill` fell back to `auto` and the Team Builder
	   was never viewport-fit: its Roster rendered all ~122 cards at full height
	   (~5.8k px), the grid's own bounded scroller never engaged, and the SHELL
	   scrolled instead — which reads almost the same until you notice the
	   filter column scrolling away with the tiles. (probe-bench-align's
	   "page does not scroll" check missed it because the page genuinely does
	   not: the shell is what scrolls.)

	   Derived from the viewport instead — the formula the Visualizers already
	   computes for its own workspace, minus the band terms, since the stack
	   INCLUDES the bands and .tool-surface's flex:1 takes them off. The pads
	   are .tool-shell's, inherited; the fallbacks match its declarations. */
	.tool-stack--fill {
		height: calc(
			100svh - var(--chrome-h, 64px) - var(--tool-pad-top, 0.5rem) - var(--tool-pad-bottom, 3rem)
		);
	}
	.tool-stack--fill .tool-surface {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	/* Measured by the layout, never painted. */
	.tool-stack-dock {
		position: absolute;
		left: 0;
		pointer-events: none;
		visibility: hidden;
	}

	/* ↻ ⚓ NATE 2026-08-09: THE BANDS NO LONGER ABUT — they are split by
	   --band-gap, the same gutter as everything else. So this is a flex column
	   of two independent boxes rather than one clipped object: no shared
	   border-radius, no overflow:hidden, each band rounding its own four
	   corners. (The clip had a second job — keeping the two tiers inside one
	   outer radius — which simply stops existing.) */
	.bands {
		display: flex;
		flex-direction: column;
		gap: var(--band-gap);
		/* Its own stacking context. The bands sit ABOVE the surface in source
		   order and must not be overlapped by anything the surface raises (the
		   planner's Source overlay bounds to its frame, so this is
		   belt-and-braces). */
		position: relative;
		z-index: 1;
		flex-shrink: 0;
	}

	/* Each band is a plain two-zone rail; the context supplies the ground.

	   ↻ 2026-08-09 (Genshin Night): BOTH BANDS ARE GLASS — furniture sitting ON
	   the page rather than being it, which is exactly what the material is for.

	   ⚠ Band B stopped being ctx-light, and it had no choice: there is no light
	   glass. Translucent paper over a near-black world is the muddy middle by
	   another route, which is the one finding that survived the reverted
	   toolbar-translucency trial ("band B being paper is the constraint"). This
	   is the round where that constraint got paid.

	   The A/B distinction is unchanged — A is the DOCUMENT (the shared tabs,
	   Save/Load/Share), B is the VIEW — and now that they are separate objects
	   it needs no ground trick to carry it at all: two boxes with air between
	   them are already two things. B keeps the quieter ground anyway, so the
	   VIEW band reads as the second tier rather than a peer. */
	.band {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0 var(--band-pad-x);
		min-width: 0;
		border-radius: var(--band-radius);
	}

	/* ── BAND A HAS NO BAND (⚓ NATE 2026-08-09) ────────────────────────────
	   "It loses its backing band, and instead the buttons themselves become
	   glass over the scene."

	   So this is a bare 36px row that positions things and nothing else: no
	   ground, no radius that matters, and NO HORIZONTAL PADDING — the padding
	   existed to hold controls off a rail's ends, and with no rail an inset is
	   just the document tabs failing to line up with the tool surface below
	   them. Save/Load/Share now touch the same right edge the surface does.

	   ⚠ THE CLASS STAYS, THE FILTER DOESN'T. `ctx-glass` is still worn because
	   it is what re-points --surface/--fill-rest/the lines at the translucent
	   stops, and the CONTROLS need those values to paint themselves as glass
	   (see the .band-a rules in app.css). But the material's own
	   `backdrop-filter` has to come off: a filter on a box with no background
	   still blurs its whole rectangle, which would draw a ghost of the band we
	   just removed. The blur moves down to the controls, which is where the
	   glass now is. */
	.band-a {
		height: var(--band-a-h);
		padding: 0;
		background: none;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}

	.band-b {
		height: var(--band-b-h);
		/* One rung down from band A — the VIEW band reads as recessed relative to
		   the DOCUMENT band. */
		background: var(--surface-well);
		/* Band B is a CONTROL band — labels and buttons, never prose. --text is
		   re-pointed at --muted so everything in the band speaks the label voice
		   by default; prose belongs in the surface below, where the context's own
		   ladder applies. The rule is about VOICE, not contrast, and survives the
		   material change unchanged. */
		--text: var(--muted);
		color: var(--text);
	}

	/* Zones shrink before they overflow — a long document-tab run must ellipsize
	   inside its own strip rather than push the actions off the band's end. */
	.band-zone {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
	}

	.band-zone--end {
		justify-content: flex-end;
		flex-shrink: 0;
	}

	/* Three equal outer tracks, so the middle zone is centred on the BAND. The
	   outer two are `1fr` and may be wider than their content; `minmax(0, 1fr)`
	   lets them shrink past it rather than push the centre off true. */
	.band--3up {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		gap: 0.75rem;
	}
	.band-zone--center {
		justify-content: center;
		flex-shrink: 0;
		/* The selected plate stands PROUD of the band (Genshin's own tab strip
		   does this — see the Team Builder's nav). Nothing here clips, but the
		   zone must not be the thing that decides the band's height either. */
		overflow: visible;
	}

	.band-full {
		flex: 1;
		min-width: 0;
	}

	.tool-surface {
		min-width: 0;
	}
</style>
