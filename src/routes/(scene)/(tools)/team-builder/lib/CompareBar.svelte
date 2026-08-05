<script lang="ts">
	/**
	 * One character's timing bar on the Compare view's SHARED time axis.
	 *
	 * A presentational leaf: it takes pre-computed phase `segments` (from the
	 * planner's `barPhases`) and paints them with the planner's own bar language
	 * — solid cast-fill window, dim continuation past cooldown, a 3-edge ghost
	 * cooldown track, and summon/heal tick markers. Every bar in a comparison is
	 * handed the SAME `scaleSeconds` + `trackWidthPx`, so lengths compare
	 * truthfully when the lanes stack.
	 *
	 * Bars are divs, never SVG — same Safari fractional-offset reason as the
	 * planner (see RotationTimeline.svelte). Geometry comes from the shared pure
	 * projection in $lib/timeline/barGeometry so the two renderers never drift.
	 */
	import { barGeom } from '$lib/timeline/barGeometry';
	import { castFill } from '$lib/utils/elementColors';
	import type { BarPhaseSegment } from '$lib/timeline/barPhases';

	let {
		segments,
		ticks = [],
		color,
		scaleSeconds,
		trackWidthPx,
		locked = false
	}: {
		segments: BarPhaseSegment[];
		/** Tick offsets in seconds (summon/heal cadence), drawn over the bar. */
		ticks?: number[];
		color: string;
		/** Shared across the whole comparison — the widest cycle in the model. */
		scaleSeconds: number;
		trackWidthPx: number;
		locked?: boolean;
	} = $props();

	const pxPerSec = $derived(scaleSeconds > 0 ? trackWidthPx / scaleSeconds : 0);
</script>

<div
	class="cb-track"
	class:cb-locked={locked}
	style:width="{trackWidthPx}px"
	style:--cb-color={color}
>
	{#each segments as seg, i (i)}
		{@const g = barGeom(seg.start, seg.span, pxPerSec)}
		{#if seg.role === 'uptime' || seg.role === 'uptimeFlush'}
			<span
				class="cb-seg cb-uptime"
				class:cb-flush={seg.role === 'uptimeFlush'}
				style:left="{g.left}px"
				style:width="{g.width}px"
				style:background={castFill(color)}
			></span>
		{:else if seg.role === 'uptimeDim' || seg.role === 'overflow'}
			<span
				class="cb-seg cb-dim"
				class:cb-flush={seg.role === 'overflow'}
				style:left="{g.left}px"
				style:width="{g.width}px"
			></span>
		{:else if seg.role === 'ghost'}
			<span class="cb-seg cb-ghost" style:left="{g.left}px" style:width="{g.width}px">
				{#if seg.cooldown !== undefined}<span class="cb-cd-label">{seg.cooldown}s</span>{/if}
			</span>
		{/if}
	{/each}

	{#each ticks as t, i (i)}
		<span class="cb-tick" style:left="{Math.round(t * pxPerSec)}px"></span>
	{/each}
</div>

<style>
	.cb-track {
		position: relative;
		height: 16px;
		flex-shrink: 0;
		/* Recessed ground the bars sit in — the shared time field. */
		background: var(--fill-rest);
		border-radius: 2px;
	}
	.cb-locked {
		opacity: 0.45;
	}

	.cb-seg {
		position: absolute;
		min-width: 2px;
		box-sizing: border-box;
	}

	/* Solid effect window — the cast-fill finish shared with the planner pills. */
	.cb-uptime {
		top: 0;
		height: 100%;
		border-radius: 2px 0 0 2px;
		z-index: 2;
	}
	.cb-flush {
		border-radius: 0;
	}

	/* Continuation of the window past the cooldown (Case B): a dim tone of the
	   element — opaque mix toward the ground so it reads as subordinate. */
	.cb-dim {
		top: 0;
		height: 100%;
		border-radius: 0 2px 2px 0;
		z-index: 2;
		background: color-mix(in srgb, var(--cb-color) 60%, #10131c);
	}

	/* Ghost cooldown remainder: a recessed slim track outlined on top/right/
	   bottom — the left edge stays open so it reads as flowing out of the solid
	   pill — with the right edge landing on the moment the ability is back up. */
	.cb-ghost {
		top: 3px;
		height: calc(100% - 6px);
		border-top: 1px solid color-mix(in srgb, var(--cb-color) 50%, transparent);
		border-right: 1px solid color-mix(in srgb, var(--cb-color) 50%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--cb-color) 50%, transparent);
		border-radius: 0 2px 2px 0;
		background: color-mix(in srgb, var(--cb-color) 12%, transparent);
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding-right: 3px;
		z-index: 0;
	}
	.cb-cd-label {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		color: color-mix(in srgb, var(--cb-color) 70%, var(--muted));
		white-space: nowrap;
		pointer-events: none;
	}

	/* Summon/heal tick markers — short bottom-anchored stubs at the cadence,
	   flush with their time (no centering shift). */
	.cb-tick {
		position: absolute;
		bottom: 0;
		height: 6px;
		width: 1px;
		background: color-mix(in srgb, var(--cb-color) 85%, white);
		opacity: 0.9;
		z-index: 3;
		pointer-events: none;
	}
</style>
