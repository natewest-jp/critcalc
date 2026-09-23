<script lang="ts">
	/**
	 * ONE coverage strip — the /coverage list's rows and the planner's opt-in
	 * strips draw this, on the shared grid (COVERAGE_LAYOUT), so a column sits at
	 * the same x on both surfaces. The five state registers are `.cov-state` in
	 * app.css, shared with the legend's swatches.
	 */
	import {
		COVERAGE_SEGMENTS,
		type CoverageSegmentKey,
		type CoverageState
	} from '$lib/coverage/deriveCoverage';
	import { COVERAGE_LAYOUT } from '$lib/coverage/coverageLayout';
	import { SEGMENT_TITLE, STATE_LABEL } from '$lib/coverage/coverageText';

	let {
		states,
		dim,
		label,
		titles = false,
		onEnter,
		onLeave
	}: {
		/** One state per segment, in COVERAGE_SEGMENTS order. */
		states: CoverageState[];
		/** Segments to recede (out of reach: roster constellation, unused action). */
		dim?: ReadonlySet<CoverageSegmentKey>;
		/** The strip's accessible name. */
		label: string;
		/** A native title per segment — for surfaces with no tooltip of their own. */
		titles?: boolean;
		onEnter?: (event: PointerEvent, key: CoverageSegmentKey) => void;
		onLeave?: () => void;
	} = $props();
</script>

<span
	class="cov-strip"
	role="img"
	aria-label={label}
	style:--cov-template={COVERAGE_LAYOUT.template}
>
	{#each COVERAGE_SEGMENTS as seg, i (seg.key)}
		<!-- Hover is a convenience tier only: every surface that draws a strip
		     also says the same thing in words (the list's details, the page). -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="cov-seg cov-state cov-state--{states[i]}"
			class:is-dim={dim?.has(seg.key)}
			style:grid-column={COVERAGE_LAYOUT.segCol[seg.key]}
			title={titles ? `${SEGMENT_TITLE[seg.key]}: ${STATE_LABEL[states[i]]}` : undefined}
			onpointerenter={onEnter ? (e) => onEnter(e, seg.key) : undefined}
			onpointerleave={onLeave}
		></span>
	{/each}
</span>

<style>
	.cov-strip {
		display: grid;
		grid-template-columns: var(--cov-template);
		align-items: center;
		min-width: 0;
	}
	.cov-seg {
		height: var(--cov-strip-h, 14px);
		border-radius: 1px;
	}
	/* Out of reach recedes in the PAINT, never element opacity — the strip can
	   sit inside the planner's transformed surfaces (the sub-pixel laws). The
	   dim registers live beside the lit ones in app.css (.cov-state). */
</style>
