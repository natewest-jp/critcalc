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

	<!-- The band header: TWO SEPARATE bands, no stroke on either — the tool
	     surface below carries the family's structure and the bands read as
	     glass rails floating over it. ↻ ⚓ NATE 2026-08-09: they used to abut
	     inside one clipped box (Genshin's banded section header, a navy run
	     with a cream tier); they are split by --band-gap now, so each is its
	     own object and rounds its own four corners. -->
	<div class="bands">
		<div class="band band-a ctx-glass">
			<div class="band-zone">{@render bandALeft?.()}</div>
			<div class="band-zone band-zone--end">{@render bandARight?.()}</div>
		</div>
		<div class="band band-b ctx-glass">
			{#if bandBFull}
				<!-- The full-width variant is one flex child that must actually FILL
				     the band: the Visualizers lays a grid in here whose columns have
				     to line up with the tile grid below, and a content-sized child
				     would collapse them to their labels' widths. -->
				<div class="band-full">{@render bandBFull()}</div>
			{:else}
				<div class="band-zone">{@render bandBLeft?.()}</div>
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

	.band-a {
		height: var(--band-a-h);
		background: var(--surface);
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

	.band-full {
		flex: 1;
		min-width: 0;
	}

	.tool-surface {
		min-width: 0;
	}
</style>
