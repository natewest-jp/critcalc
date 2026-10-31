<script lang="ts">
	import type { Snippet } from 'svelte';
	import NoticeBanners from './NoticeBanners.svelte';
	import { BAND_GAP, BAND_ITEM_GAP, BAND_PAD_X, BAND_RADIUS, BAND_STACK_GAP } from '$lib/toolBands';
	import {
		BENCH_ROW_H,
		RIBBON_GAP,
		RIBBON_OVERHANG_Y,
		RIBBON_W,
		TOOL_INSET,
		benchBand
	} from '$lib/benchBand.svelte';

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
	// TOO, which is the whole point of the round: the ribbon stands beside the
	// entire tool object, not just its surface.
	//
	// ↻ 2026-08-17: RIBBON_OVERHANG_Y is 0 — the strip's top edge is band A's
	// top edge (⚓ Nate). The insets are still written through the constant
	// rather than dropped, because "the dock spans the stack, offset by the
	// overhang" is the relationship; the overhang merely happens to be nothing.
	//
	// One dock definition instead of two also closes the drift the abutting round
	// found the hard way (the TB's bench zone was pinned at 189 while
	// RIBBON_CHROME moved 15 → 16): there is now no second copy to fall behind.
	// ---------------------------------------------------------------------------

	let {
		benched = false,
		benchHidden = false,
		benchCollapsed = false,
		benchRail,
		fill = false,
		floor = false,
		bandBLeft,
		bandBCenter,
		bandBRight,
		bandBFull,
		surface
	}: {
		/**
		 * Does the bench ribbon dock against this tool? True for the planner
		 * only (↻ the Team Builder left the bench, 2026-10-08); a tool without it
		 * starts its stack at the content margin instead of after the ribbon's
		 * column.
		 */
		benched?: boolean;
		/**
		 * The bench ROW is hidden (band B's Bench plate, 2026-10-15). Honoured
		 * only in the row form — the CSS rule lives inside its media query, so
		 * the column form is untouched whatever this says — and it takes the
		 * RESERVE with it: the dock, its flex gap and --stack-to-surface, so a
		 * hidden row costs the layout nothing. The caller passes
		 * `benchRowHidden()` ($lib/media.svelte), the same condition the
		 * ribbon's visibility reads.
		 */
		benchHidden?: boolean;
		/**
		 * The bench row is COLLAPSED (toolbar refinement, 2026-10-24): under the
		 * switch the row folds away and only its RAIL stays. Row form only, like
		 * `benchHidden`, and the caller passes one or the other.
		 */
		benchCollapsed?: boolean;
		/**
		 * THE BENCH'S RAIL (row form only, ⚓ Nate 2026-10-24): one control-high
		 * strip ABOVE the bench row, there whether the row is open or folded, so
		 * its toggle never moves. The phone's form of the desktop bench foot: the
		 * comparison and the team's status. Its height joins --stack-to-surface.
		 */
		benchRail?: Snippet;
		/** The surface flexes to fill the stack's height (viewport-fit tools). */
		fill?: boolean;
		/**
		 * The stack is at LEAST the viewport's height and the surface flexes to
		 * fill it, but grows with its content and page-scrolls past it (the
		 * planner, so its composer can stand at the screen's foot however short
		 * the rotation). Above `toolMin` only.
		 */
		floor?: boolean;
		bandBLeft?: Snippet;
		/**
		 * A middle RAIL for band B. Opting in splits the band into three separate
		 * plates — control · rail · control — and moves the ground off the band
		 * onto this zone. The planner's band B is its one caller.
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

	// ⚓ ONE CONTROL SIZE FOR BOTH BARS (phase 2e, §12 Q21; ⚓ Nate 2026-10-22):
	// the toolbar's row and controls are the interface size's (`--ui-ctl-h`, app.css), so the bench ribbon,
	// whose head counts the stack, reads the height as rendered.
	let bandBH = $state(0);
	$effect(() => {
		if (bandBH > 0) benchBand.bandBH = bandBH;
	});
</script>

<div
	class="tool-stack"
	class:tool-stack--fill={fill}
	class:tool-stack--floor={floor}
	class:tool-stack--benched={benched}
	class:tool-stack--bench-hidden={benched && benchHidden}
	class:tool-stack--bench-collapsed={benched && benchCollapsed}
	class:tool-stack--railed={benched && !!benchRail}
	style:--band-b-h="var(--ui-ctl-h)"
	style:--band-ctrl-h="var(--ui-ctl-h)"
	style:--band-item-gap="{BAND_ITEM_GAP}px"
	style:--band-pad-x="{BAND_PAD_X}px"
	style:--band-radius="{BAND_RADIUS}px"
	style:--band-gap="{BAND_GAP}px"
	style:--band-stack-gap="{BAND_STACK_GAP}px"
	style:--stack-inset="{benched ? TOOL_INSET : 0}px"
	style:--bench-row-h="{BENCH_ROW_H}px"
	style:--dock-overhang="{RIBBON_OVERHANG_Y}px"
	style:--ribbon-w="{RIBBON_W}px"
	style:--ribbon-gap="{RIBBON_GAP}px"
>
	{#if benched}
		<!-- The RIBBON's dock: an invisible, ribbon-sized anchor the (tools)
		     layout measures to place the bench strip. It spans the stack — bands
		     AND surface — offset by RIBBON_OVERHANG_Y, which is 0 since
		     2026-08-17: the strip's top edge and band A's are the same line.
		     Absolute insets resolve against .tool-stack's PADDING box, which
		     begins at the content margin (the padding-left is what holds the tool
		     off the ribbon's column), so left: 0 IS the content margin. -->
		<!-- ↻ 2026-09-05: the geometry moved from inline styles to the custom
		     properties declared on the stack, because the dock has TWO shapes
		     now — a column beside the stack, or a row above it below BP.toolMin
		     — and an inline style cannot be overridden by the media query that
		     picks the second one. -->
		<!-- The rail comes first in source so it stands ABOVE the row it heads;
		     both share the row form's `order`. -->
		{#if benchRail}<div class="tool-stack-rail">{@render benchRail()}</div>{/if}
		<div class="tool-stack-dock" data-bench-anchor></div>
	{/if}

	<!-- The band header. ↻ ⚓ NATE 2026-08-09/10, over two rounds: band A LOSES
	     ITS BAND, and band B loses it too WHEREVER A TOOL SPLITS IT. Both rows
	     are runs of glass plates on the scene; the only rail left is the one a
	     tool asks for by filling bandBCenter, and that rail is a plate like the
	     others. See the CSS for why the ctx-glass class stays on rows that no
	     longer paint. -->
	<div class="bands">
		<div
			class="band band-b ctx-glass"
			bind:clientHeight={bandBH}
			class:band--3up={!!bandBCenter}
			class:band--full={!!bandBFull}
		>
			{#if bandBFull}
				<!-- The full-width variant is one flex child that must actually FILL
				     the band: the Visualizers lays a grid in here whose columns have
				     to line up with the tile grid below, and a content-sized child
				     would collapse them to their labels' widths. -->
				<div class="band-full">{@render bandBFull()}</div>
			{:else}
				<!-- 🐛 RENDERED ONLY WHEN FILLED. An empty flex item is still a flex
				     item, so it takes no width and its GAP anyway — which put the
				     planner's rail 4px right of the tab above it once band B became a
				     3-up with nothing in its left zone (⚓ Nate: "the left of the band
				     B bar looks a little off, from the tabs above it… I think it's
				     different from the TB's band because the TB has a button on the
				     far left"; measured 270 against band A's 266, where the TB sits
				     at 266/266). The invariant this restores is PLATE EDGES align
				     down the stack — their inks do not, and cannot, since each plate
				     insets its own label by its own padding. -->
				{#if bandBLeft}<div class="band-zone">{@render bandBLeft()}</div>{/if}
				{#if bandBCenter}
					<!-- THE RAIL. In the 3-up split this zone is the only thing in either
					     band that still paints a ground: the two flanking controls became
					     their own plates (⚓ Nate 2026-08-10 — "separate them from their
					     parent band"), so what is left of the band is the strip its
					     navigation sits on, and that strip is now a plate too. -->
					<div class="band-zone band-zone--center">{@render bandBCenter()}</div>
				{/if}
				<!-- Same guard, same reason: a band whose right zone is empty would
				     hold a trailing gap its rail should have had. -->
				{#if bandBRight}<div class="band-zone band-zone--end">{@render bandBRight()}</div>{/if}
			{/if}
		</div>
		<!-- Conditions (notices §3.3) float just under the toolbar, over the
		     surface: in flow they would move the tools' measured geometry. -->
		<NoticeBanners class="tool-banners" />
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
		/* A property, not just a `gap`, so the surface can publish it as its
		   --room-top (see .tool-surface); the narrow forms move THIS. */
		--stack-gap: var(--band-stack-gap);
		gap: var(--stack-gap);
		min-width: 0;
		/* How far the SURFACE starts below the stack's top: BAND_STACK_TO_SURFACE
		   in this form, and the row form below adds the bench row and a second
		   band gap. Published for a surface that has to know where it begins on
		   screen — the planner's sticky aside (ToolColumns `asideSticky`, sweep
		   2026-10-15 §3 item 11). Here rather than inline because the row form
		   overrides it from a media query. ⚠ It counts band A: a tool that hides
		   band A (the Visualizers, via bandAClass) must not read it. */
		--stack-to-surface: calc(var(--band-b-h) + var(--band-stack-gap));
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
			100svh - var(--chrome-h, 64px) - var(--tool-pad-top, 0.5rem) - var(--tool-pad-bottom, 1.5rem)
		);
	}
	.tool-stack--fill .tool-surface {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	/* The FLOOR form (the planner, 2026-10-27, ⚓ Nate): `fill`'s height as a
	   MINIMUM, so a short surface still reaches the screen's foot and a long one
	   page-scrolls as before. The surface is a flex column so the tool inside
	   can push its last row (the composer) to the bottom. Above BP.toolMin only:
	   below it the composer rides in the page, and below `compact` it docks. */
	@media (min-width: 54rem) {
		.tool-stack--floor {
			min-height: calc(
				100svh - var(--chrome-h, 64px) - var(--tool-pad-top, 0.5rem) -
					var(--tool-pad-bottom, 1.5rem)
			);
		}
		.tool-stack--floor .tool-surface {
			flex: 1 0 auto;
			display: flex;
			flex-direction: column;
		}
	}

	/* THE ROOM AROUND THE SURFACE (⚓ Nate 2026-10-25, the edges round): how
	   much bare scene lies between each edge of the surface and its neighbour —
	   the bands above, the bench beside, the screen's edge. A scroller inside
	   reaches into it so its roll-off ENDS at the neighbour rather than inside
	   its own column (app.css § THE FADE ENDS AT THE NEIGHBOUR). ToolColumns
	   narrows the side facing an aside; a consumer only ever reads these. */
	.tool-surface {
		min-width: 0;
		--room-top: var(--stack-gap);
		--room-bottom: var(--tool-pad-bottom, 1.5rem);
		--room-left: var(--tool-pad-x, 1rem);
		--room-right: var(--tool-pad-x, 1rem);
	}
	.tool-stack--benched .tool-surface {
		--room-left: var(--ribbon-gap);
	}

	/* Measured by the layout, never painted. The COLUMN form: the ribbon's
	   width, spanning the stack's height offset by the overhang. */
	/* Row form only (the media query below). */
	.tool-stack-rail {
		display: none;
	}
	.tool-stack-dock {
		position: absolute;
		left: 0;
		top: calc(-1 * var(--dock-overhang));
		bottom: calc(-1 * var(--dock-overhang));
		width: var(--ribbon-w);
		pointer-events: none;
		visibility: hidden;
	}

	/* ══ THE ROW FORM (responsive round, 2026-09-05) ══════════════════════════
	   Below BP.toolMin ($lib/breakpoints.ts — 54rem, the planner's measured
	   minimum WITH the column beside it) the bench ribbon turns horizontal, so
	   the stack hands back the column it was holding off the ribbon and the
	   dock becomes a full-width ROW in the stack's own flow, which is exactly
	   what the ribbon then measures itself against.

	   ↻ ⚓ NATE 2026-10-13 (the portrait round): the row sits BETWEEN BAND B
	   AND THE SURFACE — beside the timeline it labels, under the controls —
	   where it used to sit above band A. The upright card made it compact
	   enough to belong there. `order` moves the dock (first in source, for the
	   column form) after the bands; the stack's flex gap spaces it on both
	   sides.

	   ⚠ THE LITERAL IS THE TABLE'S, BY HAND: custom properties do not work in
	   media queries, so 54rem is written here and cited there. The ribbon's own
	   orientation flag is set by the layout from matchMedia on the SAME string
	   (belowQuery('toolMin')), which is what keeps the two halves on one number.
	   ⚠ Reserved in pure CSS from a CONSTANT — BENCH_ROW_H — rather than a
	   measured height, because the upright card is one height at every width
	   (see benchBand.svelte.ts § THE UPRIGHT CARD); nothing here has to wait
	   for the ribbon to mount to lay the tool out correctly.

	   ↻ 2026-10-15 (responsive sweep §3 item 4): OR a SHORT screen —
	   (max-height: 30rem), breakpoints.ts § THE HEIGHT AXIS. A landscape phone
	   wider than toolMin (932×430) has the width for the column and not the
	   height; the ribbon reads `narrowForm()`, the same list. */
	@media (max-width: 54rem), (max-height: 30rem) {
		/* ⚓ Nate 2026-10-14 (the mobile round): band B → bench → surface take
		   the BAND gap, the one band A and B already keep, so the narrow stack
		   reads as one tight instrument head rather than three spaced rows. */
		.tool-stack--benched {
			padding-left: 0;
			--stack-gap: var(--band-gap);
			/* bands (A · gap · B), gap, the bench row, gap. */
			--stack-to-surface: calc(var(--band-b-h) + 2 * var(--band-gap) + var(--bench-row-h));
		}
		.tool-stack--benched .bands {
			order: 0;
		}
		.tool-stack--benched .tool-stack-dock {
			position: static;
			order: 1;
			flex-shrink: 0;
			width: auto;
			height: var(--bench-row-h);
		}
		.tool-stack--benched .tool-surface {
			order: 2;
			/* The bench is a ROW up here, so nothing stands beside the surface. */
			--room-left: var(--tool-pad-x, 1rem);
		}
		/* The rail, one control high, JOINED to the row under it (⚓ Nate
		   2026-10-24: one object, the bench's frame keeping the cards apart) —
		   the negative margin takes back the flex gap between them, and then
		   TUCKS the row up under the rail's own slack: its small controls sit
		   ~2.7px off its bottom edge, the ribbon's ground (above the page) covers
		   that, and what is left between the controls and the frame is the
		   ribbon's own edge (RIBBON_EDGE) — "just a sliver" (⚓ Nate). */
		.tool-stack--railed {
			--rail-tuck: 2px;
			--stack-to-surface: calc(
				var(--band-b-h) + 2 * var(--band-gap) + var(--ui-ctl-h) + var(--bench-row-h) -
					var(--rail-tuck)
			);
		}
		.tool-stack--railed .tool-stack-rail {
			display: block;
			order: 1;
			flex-shrink: 0;
			height: var(--ui-ctl-h);
			margin-bottom: calc(-1 * var(--band-gap) - var(--rail-tuck));
		}
		.tool-stack--bench-collapsed .tool-stack-rail {
			margin-bottom: 0;
		}
		/* ↻ 2026-10-15: the row HIDDEN (band B's Bench plate). ⚠ The RESERVE
		   goes, not only the paint: display:none drops the dock and its flex
		   gap, and --stack-to-surface loses the row and one gap, so the
		   surface snugs up to band B at the band gap. The ribbon measures a
		   0×0 dock and the layout hides it on the same condition. */
		.tool-stack--bench-hidden {
			--stack-to-surface: calc(var(--band-b-h) + var(--band-gap));
		}
		.tool-stack--bench-hidden .tool-stack-dock {
			display: none;
		}
		/* ↻ 2026-10-24: COLLAPSED, the row goes the way a hidden one does —
		   reserve and all — and the rail above it stays. */
		.tool-stack--bench-collapsed {
			--stack-to-surface: calc(var(--band-b-h) + 2 * var(--band-gap) + var(--ui-ctl-h));
		}
		.tool-stack--bench-collapsed .tool-stack-dock {
			display: none;
		}
		/* ⚓ Nate 2026-10-20: the Team Builder (the one `fill` tool) snugs its
		   surface — the battlefield banners, the character grid's filters — up
		   to band B at the same band gap, as the planner's bench row does. */
		.tool-stack--fill {
			--stack-gap: var(--band-gap);
			--stack-to-surface: calc(var(--band-b-h) + var(--band-gap));
		}
	}

	/* ↻ ⚓ NATE 2026-08-09: THE BANDS NO LONGER ABUT — they are split by
	   --band-gap, the same gutter as everything else. So this is a flex column
	   of two independent boxes rather than one clipped object: no shared
	   border-radius, no overflow:hidden, each band rounding its own four
	   corners. (The clip had a second job — keeping the two tiers inside one
	   outer radius — which simply stops existing.) */
	.bands :global(.tool-banners) {
		position: absolute;
		top: calc(100% + var(--band-gap));
		left: 0;
		right: 0;
		max-width: 52rem;
		margin: 0 auto;
	}
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
	   Save/Load/Share), B is the VIEW — and it needs no ground trick to carry it
	   at all: two rows with air between them are already two things.

	   ↻ 2026-08-10: there is ONE glass stop across both rows now, and most of
	   what is left of "a band" is this box's height and gap. Band A paints
	   nothing; band B paints only when a tool has not split it. */
	.band {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0 var(--band-pad-x);
		min-width: 0;
		border-radius: var(--band-radius);
	}

	/* ↻ ⚓ NATE 2026-08-10: the SAME glass as band A — "the lighter of the two".
	   It was --surface-well, one rung down, on the reasoning that the VIEW band
	   should read as recessed relative to the DOCUMENT band. There is no
	   DOCUMENT band any more to be recessed from, and two different glass stops
	   in one header only read as one of them being dirty. */
	.band-b {
		height: var(--band-b-h);
		background: var(--surface);
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
		gap: var(--band-item-gap, 4px);
		min-width: 0;
	}

	.band-zone--end {
		justify-content: flex-end;
		flex-shrink: 0;
	}

	/* ── THE 3-UP SPLIT (⚓ NATE 2026-08-10) ────────────────────────────────
	       ████ ███████████████████████████████████ ████
	   Three objects on one row: a control, the navigation RAIL, a control —
	   "separate them from their parent band", split by --band-item-gap, the same
	   gap band A puts between its buttons.

	   So the BAND stops painting and the CENTRE zone starts. What used to be one
	   rail with things sitting in it is now three plates of the same glass, and
	   the row itself is only a layout.

	   ⚠ THE RAIL IS NOT CENTRED ON THE BAND, and it cannot be while the two
	   flanking controls have their own widths (Clear team ≈ 110px, a con lens
	   that reads "C0" or "My roster"). What IS centred is the navigation inside
	   the rail, and the rail is the object the eye measures — the few pixels
	   between the rail's centre and the band's do not read. Forcing them equal
	   would mean pinning both flanks to a hand-tuned width that the con lens's
	   own label would then break. */
	.band--3up {
		background: none;
		padding: 0;
		gap: var(--band-item-gap, 4px);
	}
	.band--3up > .band-zone {
		flex: 0 0 auto;
	}
	/* The rail takes everything the two controls leave. */
	.band--3up > .band-zone--center {
		flex: 1 1 auto;
		justify-content: center;
		min-width: 0;
		/* stretch, not height:100% — the band centres its children, and a
		   percentage height on a flex item is the shape that has silently failed
		   in this stack before (see .tool-stack--fill). */
		align-self: stretch;
		padding: 0 var(--band-pad-x);
		border-radius: var(--band-radius);
		background: var(--surface);
		/* The selected plate stands PROUD of the rail (Genshin's own tab strip
		   does this — see the Team Builder's nav), so nothing here may clip. */
		overflow: visible;
	}
	/* ↻ 2026-10-24 (toolbar refinement, ⚓ Nate): the rail
	   RETIRES — a readout stands on the night, only a control gets glass (the
	   bars demo's centre). The zone stays as layout: it still takes the width
	   the flanks leave and centres what it holds. Its padding went with the
	   ground: it held controls off a rail's ends, and there are none.
	   `:where` adds no weight, so this outranks the rule above by order alone. */
	:global(:where(:root[data-next])) .band--3up > .band-zone--center {
		padding: 0;
		background: none;
	}

	/* ── BAND B GETS CUT BY THE TOOL'S OWN GAP (⚓ NATE 2026-08-13) ─────────
	   The third and last way a band can lose its ground, and the reason is the
	   same one that took band A's and split band B three ways: a rail is only
	   honest when it holds ONE run of controls.

	     band A     spans the screen, paints nothing            (2026-08-09)
	     band B     paints, unless a tool subdivides it
	       · 3-up   control · RAIL · control                    (2026-08-10)
	       · full   N runs, one per instrument, cut by the
	                tile gap — the ground goes with them        (2026-08-13)

	   ⚓ Nate: "band A spans the whole screen, while band B responds to how many
	   instrument surfaces there are." One continuous rail across three
	   instruments said the opposite — that the pickers were one row of peers —
	   when each of them belongs to the tile underneath it. Cutting the ground at
	   the tile boundary is the only thing in the header that can say so.

	   AND ITS PADDING GOES WITH IT, exactly as band A's did: --band-pad-x exists
	   to hold controls off a rail's ends, and with no rail an inset is just the
	   first plate failing to line up with the surface below. (The Visualizers'
	   workspace grid drops its matching padding in the same breath — the two
	   were a pair, and they still are.)

	   ⚠ WHAT THE TOOL OWES IN RETURN: its controls must now be PLATES. A control
	   that kept --btn-face here would be an opaque button standing on nothing.
	   See .ws-band-cell in the Visualizers page. */
	.band--full {
		background: none;
		padding: 0;
	}

	.band-full {
		flex: 1;
		min-width: 0;
	}
</style>
