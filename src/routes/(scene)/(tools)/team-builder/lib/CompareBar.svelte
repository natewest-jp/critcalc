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
	 * ⚠ ONE WEAKENING, NOT TWO. A LOCKED lane is weaker because it is UNREACHED
	 * (its constellation gate is above your cap). ⛔ A REPEATED cycle is NOT
	 * weakened — that fade is retired; see the note in barCycles.ts for why it
	 * failed. The weakening is spent in the PAINT, never as element `opacity`,
	 * per the sub-pixel laws.
	 *
	 * ⛔ EVERY FILL IS A SINGLE-LEVEL `color-mix`, and the percentage arithmetic
	 * happens in JS on purpose: a `color-mix` fed by a `color-mix` CRASHES WEBKIT.
	 * Weakening a fill by nesting one mix in another is the obvious way to write
	 * this and it is the one way that cannot ship.
	 *
	 * ⚓ THE BARS DRAW STRAIGHT ON THE NIGHT — the track has no ground of its own.
	 * A faint recessed field used to sit under them, and it read as a halo along
	 * the cooldown ghost's top and bottom edges, softening exactly the boundary
	 * the chart is for. With it gone, the ghost is the only thing in the "off"
	 * beats and uptime-versus-cooldown separates on its own.
	 *
	 * Bars are divs, never SVG — same Safari fractional-offset reason as the
	 * planner (see RotationTimeline.svelte). Geometry comes from the shared pure
	 * projection in $lib/timeline/barGeometry so the two renderers never drift.
	 */
	import { barGeom } from '$lib/timeline/barGeometry';
	import { castFill, desaturate } from '$lib/utils/elementColors';
	import { GHOST_CHROMA_KEEP, GHOST_FILL_MIX, UPTIME_DIM_MIX } from '$lib/timeline/barMix';
	import { COMPARE_LOCKED_MIX } from '$lib/timeline/barCycles';
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

	/** ⚓ The seam between two abutting solid blocks: a bite off the leading edge,
	 *  so the NIGHT shows through and you can see where one cast ends and the
	 *  next begins. It is a seam, not a gap — on a 30s axis it is worth well
	 *  under a tenth of a second, far below anything this chart resolves.
	 *
	 *  🎛️ Tuning knob, and deliberately NOT a hairline. The retired repeat-fade
	 *  failed by being subtle enough to confuse with its neighbour; a marker
	 *  whose entire job is "these two lanes are not the same thing" has to win at
	 *  a glance or it repeats that mistake. Two pixels of night is unambiguous in
	 *  KIND (nothing else in a lane is a hole) and in SIZE. */
	const SEAM_PX = 2;

	function strength(base: number): number {
		return locked ? (base * COMPARE_LOCKED_MIX) / 100 : base;
	}

	function mix(color: string, pct: number): string {
		if (pct >= 100) return color;
		return `color-mix(in srgb, ${color} ${pct.toFixed(1)}%, transparent)`;
	}

	/** A repeated solid block gets the seam; the first cast has nothing to its
	 *  left to be separated from. Applied here rather than in the geometry so
	 *  `barGeom`'s telescoping endpoints stay exact. */
	function seamed(g: { left: number; width: number }, seg: BarPhaseSegment) {
		if (seg.role !== 'uptimeFlush' || (seg.cycle ?? 0) === 0 || g.width <= SEAM_PX * 2) return g;
		return { left: g.left + SEAM_PX, width: g.width - SEAM_PX };
	}

	/** The solid window — the cast-fill finish shared with the planner's pills. */
	const uptimeFill = () => mix(castFill(bar), strength(100));

	/** Continuation of the window past its cooldown. ⚓ The planner keeps this
	 *  OPAQUE because swap connectors pass behind its bars; Compare has no
	 *  connectors, so the same tone is honest as alpha — which is what retired
	 *  the hardcoded `#10131c` this file used to mix against. */
	const dimFill = () => mix(castFill(bar), strength(UPTIME_DIM_MIX));

	/** Ghost cooldown track — desaturated, the planner's exact recipe. */
	const ghostFill = () => mix(desaturate(bar, GHOST_CHROMA_KEEP), strength(GHOST_FILL_MIX));

	/** ⛔ Deliberately plain white at alpha, NOT the element tinted toward white:
	 *  tinting first and weakening second is two mixes, and a `color-mix` fed by
	 *  a `color-mix` crashes WebKit. A 1px stub sitting on an element-coloured
	 *  bar reads the same either way. */
	const tickFill = $derived(mix('#ffffff', locked ? 40 : 82));
</script>

<div class="cb-track" style:width="{trackWidthPx}px">
	{#each segments as seg, i (i)}
		{@const g = seamed(barGeom(seg.start, seg.span, pxPerSec), seg)}
		{#if seg.role === 'uptime' || seg.role === 'uptimeFlush'}
			<span
				class="cb-seg cb-uptime"
				class:cb-flush={seg.role === 'uptimeFlush'}
				style:left="{g.left}px"
				style:width="{g.width}px"
				style:background={uptimeFill()}
			></span>
		{:else if seg.role === 'uptimeDim' || seg.role === 'overflow'}
			<span
				class="cb-seg cb-dim"
				class:cb-flush={seg.role === 'overflow'}
				style:left="{g.left}px"
				style:width="{g.width}px"
				style:background={dimFill()}
			></span>
		{:else if seg.role === 'ghost'}
			<span
				class="cb-seg cb-ghost"
				style:left="{g.left}px"
				style:width="{g.width}px"
				style:background={ghostFill()}
			></span>
		{/if}
	{/each}

	{#each ticks as t, i (i)}
		<span class="cb-tick" style:left="{Math.round(t * pxPerSec)}px" style:background={tickFill}
		></span>
	{/each}
</div>

<style>
	/* ⛔ NO GROUND (⚓ Nate 2026-08-13). A --chart-grid field used to sit under
	   the lane, on the reasoning that a track wants a field to be a track in.
	   What it actually produced was a faint halo along the cooldown ghost's top
	   and bottom edges — the ghost is inset vertically, so the field showed
	   above and below it and softened the one boundary this chart draws. The
	   bars go straight on the night, like the planner's timeline. */
	.cb-track {
		position: relative;
		height: 14px;
		flex-shrink: 0;
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
