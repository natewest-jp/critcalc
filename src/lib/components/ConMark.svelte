<script lang="ts">
	import {
		CON_MARK_ASPECT,
		CON_MARK_PATHS,
		CON_MARK_VIEWBOX
	} from '$lib/constellationMarks.generated';

	/**
	 * ConMark — the C0–C6 constellation value, drawn.
	 *
	 * ⚓ NATE 2026-08-12 cut these from IBM Plex Sans so the site could stop
	 * setting them as TEXT. What that bought, concretely: centering a C-value in
	 * a round chip used to need a no-letter-spacing rule (tracking lands after
	 * the last glyph too, widening the advance box the grid centers) plus a
	 * −0.07em optical nudge for the bearings residual — both measured at 8× in
	 * two engines, and the WebKit half of it only true at the ribbon's current
	 * dock x, because WebKit snaps text to whole pixels while boxes sit at
	 * sub-pixel precision. A path has none of that: it is a box in a box.
	 *
	 * It is the Mark.svelte arrangement, not a second one — one <svg> wrapper
	 * owning the contract, geometry from a generated module, nodes rendered as
	 * elements rather than injected as markup, currentColor so the glyph
	 * inherits its control's whole state ladder. It is a SEPARATE wrapper only
	 * because these are FILLED glyphs on a 26×16 box where marks are stroked on
	 * Lucide's 24-square, and folding two grids into one component would mean a
	 * per-mark branch in the thing whose entire job is to have no branches.
	 *
	 * Decorative without exception, like the marks: every control carrying one
	 * also carries a text label or an aria-label.
	 */
	let {
		level,
		/** The glyph's CAP HEIGHT in px — the ink spans its box, so this is the
		 *  rendered height exactly. Width follows from the shared aspect. */
		height = 8
	}: { level: number; height?: number } = $props();

	// Clamped rather than trusted: `level` arrives from stored roster data and a
	// C7 would otherwise render as an empty box with no clue why.
	const paths = $derived(CON_MARK_PATHS[Math.min(6, Math.max(0, Math.round(level)))]);
</script>

<svg
	class="con-mark"
	viewBox={CON_MARK_VIEWBOX}
	{height}
	width={height * CON_MARK_ASPECT}
	fill="currentColor"
	fill-rule="nonzero"
	aria-hidden="true"
	focusable="false"
>
	{#each paths as d (d)}
		<path {d} />
	{/each}
</svg>

<style>
	.con-mark {
		display: block;
		flex-shrink: 0;
	}
</style>
