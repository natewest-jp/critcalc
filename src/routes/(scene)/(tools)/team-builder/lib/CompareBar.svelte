<script lang="ts">
	/**
	 * One lane's rhythm on the Compare chart's shared time axis.
	 *
	 * A presentational leaf: it takes pre-computed phase `segments` (from
	 * `laneSegments`, which tiles the planner's own `barPhases` across the axis)
	 * and paints them in the planner's bar language — solid cast-fill window,
	 * dim continuation, ghost cooldown track, summon tick markers. Every bar in
	 * a comparison is handed the SAME `scaleSeconds` + `trackWidthPx`, so lengths
	 * compare truthfully when the lanes stack.
	 *
	 * ⚠ TWO WEAKENINGS, AND THEY MEAN DIFFERENT THINGS. A repeated cycle is
	 * weaker because it is HYPOTHETICAL (we projected it from the cooldown); a
	 * locked lane is weaker because it is UNREACHED (its constellation gate is
	 * above your cap). They multiply, and they are both spent in the PAINT —
	 * never as element `opacity`, per the sub-pixel laws.
	 *
	 * ⛔ EVERY FILL IS A SINGLE-LEVEL `color-mix`, and the percentage arithmetic
	 * happens in JS on purpose: a `color-mix` fed by a `color-mix` CRASHES WEBKIT.
	 * Weakening a fill by nesting one mix in another is the obvious way to write
	 * this and it is the one way that cannot ship.
	 *
	 * Bars are divs, never SVG — same Safari fractional-offset reason as the
	 * planner (see RotationTimeline.svelte). Geometry comes from the shared pure
	 * projection in $lib/timeline/barGeometry so the two renderers never drift.
	 */
	import { barGeom } from '$lib/timeline/barGeometry';
	import { castFill, desaturate } from '$lib/utils/elementColors';
	import { GHOST_CHROMA_KEEP, GHOST_FILL_MIX, UPTIME_DIM_MIX } from '$lib/timeline/barMix';
	import { COMPARE_LOCKED_MIX, COMPARE_REPEAT_MIX } from '$lib/timeline/barCycles';
	import type { BarPhaseSegment } from '$lib/timeline/barPhases';

	let {
		segments,
		ticks = [],
		bar,
		scaleSeconds,
		trackWidthPx,
		locked = false
	}: {
		segments: BarPhaseSegment[];
		/** Tick offsets in seconds (summon cadence), drawn over the FIRST cycle
		 *  only — the cadence is a sample, and repeating it across every
		 *  projected cycle turns a legible rhythm into hatching. */
		ticks?: number[];
		/** ⚠ The element's `bar` RUNG, not `main` — every use of it in here is a
		 *  FILL (the solid window, the dim continuation, the ghost track), which
		 *  is the job that rung exists for. It was named `color` and fed `main`
		 *  until 2026-08-12; the rename is so a caller cannot pass the identity
		 *  colour again by accident, which is the same one-value-two-jobs slip
		 *  that put an element token on the wishlist star. */
		bar: string;
		/** Shared across the whole comparison — the chosen axis length. */
		scaleSeconds: number;
		trackWidthPx: number;
		locked?: boolean;
	} = $props();

	const pxPerSec = $derived(scaleSeconds > 0 ? trackWidthPx / scaleSeconds : 0);

	/** Compose the two weakenings into ONE percentage, then mix once. */
	function strength(cycle: number | undefined, base: number): number {
		let pct = base;
		if ((cycle ?? 0) > 0) pct = (pct * COMPARE_REPEAT_MIX) / 100;
		if (locked) pct = (pct * COMPARE_LOCKED_MIX) / 100;
		return pct;
	}

	function mix(color: string, pct: number): string {
		if (pct >= 100) return color;
		return `color-mix(in srgb, ${color} ${pct.toFixed(1)}%, transparent)`;
	}

	/** The solid window — the cast-fill finish shared with the planner's pills. */
	const uptimeFill = (seg: BarPhaseSegment) => mix(castFill(bar), strength(seg.cycle, 100));

	/** Continuation of the window past its cooldown. ⚓ The planner keeps this
	 *  OPAQUE because swap connectors pass behind its bars; Compare has no
	 *  connectors, so the same tone is honest as alpha — which is what retired
	 *  the hardcoded `#10131c` this file used to mix against. */
	const dimFill = (seg: BarPhaseSegment) => mix(castFill(bar), strength(seg.cycle, UPTIME_DIM_MIX));

	/** Ghost cooldown track — desaturated, the planner's exact recipe. */
	const ghostFill = (seg: BarPhaseSegment) =>
		mix(desaturate(bar, GHOST_CHROMA_KEEP), strength(seg.cycle, GHOST_FILL_MIX));

	/** ⛔ Deliberately plain white at alpha, NOT the element tinted toward white:
	 *  tinting first and weakening second is two mixes, and a `color-mix` fed by
	 *  a `color-mix` crashes WebKit. A 1px stub sitting on an element-coloured
	 *  bar reads the same either way. */
	const tickFill = $derived(mix('#ffffff', locked ? 40 : 82));
</script>

<div class="cb-track" style:width="{trackWidthPx}px">
	{#each segments as seg, i (i)}
		{@const g = barGeom(seg.start, seg.span, pxPerSec)}
		{#if seg.role === 'uptime' || seg.role === 'uptimeFlush'}
			<span
				class="cb-seg cb-uptime"
				class:cb-flush={seg.role === 'uptimeFlush'}
				style:left="{g.left}px"
				style:width="{g.width}px"
				style:background={uptimeFill(seg)}
			></span>
		{:else if seg.role === 'uptimeDim' || seg.role === 'overflow'}
			<span
				class="cb-seg cb-dim"
				class:cb-flush={seg.role === 'overflow'}
				style:left="{g.left}px"
				style:width="{g.width}px"
				style:background={dimFill(seg)}
			></span>
		{:else if seg.role === 'ghost'}
			<span
				class="cb-seg cb-ghost"
				style:left="{g.left}px"
				style:width="{g.width}px"
				style:background={ghostFill(seg)}
			></span>
		{/if}
	{/each}

	{#each ticks as t, i (i)}
		<span class="cb-tick" style:left="{Math.round(t * pxPerSec)}px" style:background={tickFill}
		></span>
	{/each}
</div>

<style>
	.cb-track {
		position: relative;
		height: 14px;
		flex-shrink: 0;
		/* The shared time field the lanes sit in. Barely there — with the cycle
		   tiled, the ghost track already occupies the "off" beats, so a strong
		   ground here would fight the rhythm it is supposed to hold.
		   ⚓ --chart-grid, because that is exactly what this is: a hairline
		   inside an instrument. It already carries ALPHA rather than mixing
		   toward a ground, which is what a lane sitting on the bare night needs. */
		background: var(--chart-grid);
		border-radius: 1px;
	}

	.cb-seg {
		position: absolute;
		min-width: 2px;
		box-sizing: border-box;
	}

	.cb-uptime {
		top: 0;
		height: 100%;
		border-radius: 1px 0 0 1px;
		z-index: 2;
	}
	.cb-flush {
		border-radius: 0;
	}

	.cb-dim {
		top: 0;
		height: 100%;
		border-radius: 0 1px 1px 0;
		z-index: 2;
	}

	/* Recessed cooldown remainder, sitting under the solid blocks.
	   ⚓ The 3-edge outline this used to wear is GONE. It existed to mark the
	   moment the ability came back up, which was worth a hairline when there was
	   exactly ONE of them; tiled across the axis it becomes three hairlines per
	   cycle, and the next solid block already marks that moment better than any
	   border can. Dropping it also lands Compare on the planner's exact ghost
	   (fill only, no border) — which is the drift this file was carrying. */
	.cb-ghost {
		top: 2px;
		height: calc(100% - 4px);
		border-radius: 0 1px 1px 0;
		z-index: 0;
	}

	/* Summon tick markers — short bottom-anchored stubs at the cadence, flush
	   with their time (no centering shift: a tick at the window's start must sit
	   on the window's left edge). */
	.cb-tick {
		position: absolute;
		bottom: 0;
		height: 5px;
		width: 1px;
		z-index: 3;
		pointer-events: none;
	}
</style>
