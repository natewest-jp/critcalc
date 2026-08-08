<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ASIDE_W, COLUMN_GAP } from '$lib/toolColumns';

	// ---------------------------------------------------------------------------
	// THE TOOL COLUMNS — a tool surface split into a main box and an optional
	// aside box, with bare scene between them. See $lib/toolColumns.ts for the
	// diagram, the knobs, and why this is a shell rather than three arrangements.
	//
	// The shell owns GEOMETRY and the aside's ground; each tool supplies its own
	// main box (the planner's .rp-frame, the Team Builder's .tb-frame) and the
	// aside's contents.
	// ---------------------------------------------------------------------------

	let {
		main,
		aside,
		asideBare = false
	}: {
		main: Snippet;
		/**
		 * The aside column's occupant. Absent = no second column at all, and the
		 * main box takes the full width — this is a presence test, not a
		 * visibility toggle, so a tool must not pass an empty snippet to "hide" it.
		 */
		aside?: Snippet;
		/**
		 * The aside is a GROUNDLESS gutter rather than a box (breathing-room
		 * round, 2026-08-08). For occupants that are a LIST OF GROUPS rather than
		 * one continuous reading: the filter rails paint their own sections, so
		 * the column becomes objects-on-the-scene instead of sections-in-a-box.
		 *
		 * The planner's NOTES keep the box — they are one continuous reading and
		 * would look shredded chopped into rows. So this is the occupant's call,
		 * which is why it is a prop and not a rule.
		 */
		asideBare?: boolean;
	} = $props();
</script>

<div class="tool-columns" style:--aside-w="{ASIDE_W}px" style:--column-gap="{COLUMN_GAP}px">
	<div class="tc-main">{@render main()}</div>

	{#if aside}
		<!-- The wrapper reserves the width and stretches to the row's height; the
		     BOX inside it is absolutely positioned against that. Both halves are
		     load-bearing:
		     - the wrapper's own content height is 0, so on a content-height tool
		       (the planner) a long notes column can never grow the surface — the
		       main box alone sets the height, exactly as the old absolute panel
		       guaranteed inside the track area;
		     - the box then has a definite height to bound its own scroller
		       against, on a viewport-fit tool (the Team Builder) and a
		       content-height one alike.
		     A plain stretched flex child would do neither: its content height
		     joins the row's max() and the surface grows to fit the notes. -->
		<div class="tc-aside">
			<div class="tc-aside-box ctx-dark" class:tc-aside-box--bare={asideBare}>
				{@render aside()}
			</div>
		</div>
	{/if}
</div>

<style>
	.tool-columns {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		gap: var(--column-gap);
		/* Harmless on the planner (a block parent ignores flex:1) and required on
		   the Team Builder, whose ToolStack --fill surface is a flex column. */
		flex: 1;
		min-width: 0;
		min-height: 0;
	}

	/* A flex column so a viewport-fit main box (.tb-frame is flex:1) can fill the
	   row; a content-height one (.rp-root) just sits at its natural height. */
	.tc-main {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.tc-aside {
		flex: 0 0 var(--aside-w);
		position: relative;
	}

	.tc-aside-box {
		position: absolute;
		inset: 0;
		/* The RAISED rung, not .frame's --frame-bg: the aside is a peer of the
		   main box, and on the planner --frame-bg is the CHART WELL's color — an
		   aside painted in it would read as a second well floating beside the
		   frame rather than as a frame of its own. Mirrors .rp-frame's override. */
		background: var(--surface-raised);
		border-radius: var(--r-sm);
		/* Clips the occupant's square scroll box to the rounded corners. */
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	/* Groundless: the column stops being a box and becomes a gutter its occupant
	   fills with its own objects. Keeps the context (the sections inside still
	   read the dark palette) and keeps min-height/flex — it loses only the paint
	   and the corner, since there is no longer an edge for a radius to round. */
	.tc-aside-box--bare {
		background: none;
		border-radius: 0;
		/* The clip existed to round the occupant's square scroll box. With no
		   ground there is nothing to clip TO, and clipping here would eat the
		   focus rings the rail's own gutter is there to protect. */
		overflow: visible;
	}
</style>
