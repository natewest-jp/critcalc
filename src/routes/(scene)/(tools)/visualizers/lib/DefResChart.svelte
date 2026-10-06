<!--
	One of the DEF & RES instrument's two stacked charts: a multiplier curve
	against one enemy quantity. Point to read (a crosshair and its value,
	changing nothing); press and drag to set the quantity the marker stands on.
-->
<script lang="ts">
	export type ChartCurve = {
		value: (x: number) => number;
		/** live = the curve you are on · ghost = the same without your modifiers
		 *  · span = the stretch your shred moves you along (from → to). */
		kind: 'live' | 'ghost' | 'span';
		from?: number;
		to?: number;
	};
	export type ChartGuide = { x: number; label?: string; side?: 'left' | 'right' };
	export type ChartPoint = { x: number; y: number; hollow?: boolean };

	let {
		label,
		xMin,
		xMax,
		xTicks,
		xTick,
		xLabel,
		yMax,
		yTicks,
		yLabel,
		curves,
		guides = [],
		points = [],
		marker,
		read,
		onset,
		snap = (x: number) => x,
		dim = false,
		message,
		plotH: ownPlotH = 150,
		minPlotH = 90
	}: {
		label: string;
		xMin: number;
		xMax: number;
		xTicks: number[];
		xTick: (x: number) => string;
		xLabel: string;
		yMax: number;
		yTicks: number[];
		yLabel: string;
		curves: ChartCurve[];
		guides?: ChartGuide[];
		points?: ChartPoint[];
		/** Where the marker's drop line stands, or null for none. */
		marker: number | null;
		/** The crosshair's reading at x. */
		read: (x: number) => string;
		/** Press-and-drag sets this. */
		onset: (x: number) => void;
		snap?: (x: number) => number;
		/** Draw the chart faded — it does not apply to this hit. */
		dim?: boolean;
		message?: string;
		/** The plot's height when the chart sizes itself; a chart whose box is
		 *  given a height (a wide tile's grid track) fills it instead. */
		plotH?: number;
		/** The least plot height a filled chart shrinks to. */
		minPlotH?: number;
	} = $props();

	let graphW = $state(720);
	let boxH = $state(0);
	const PADL = 50;
	const PADR = 16;
	const TOP = 18;
	const CHROME_H = TOP + 30; // above the plot + the axis below it
	// A box with no height of its own measures as the SVG it holds, which this
	// returns unchanged — so measuring is safe at every tile width.
	const plotH = $derived(boxH > 0 ? Math.max(minPlotH, boxH - CHROME_H) : ownPlotH);
	const plotY1 = $derived(TOP + plotH);
	const H = $derived(plotY1 + 30);

	const xOf = (x: number) => PADL + ((x - xMin) / (xMax - xMin)) * (graphW - PADL - PADR);
	const yOf = (m: number) => plotY1 - (Math.min(m, yMax) / yMax) * (plotH - 6);

	const SAMPLES = 120;
	function trace(c: ChartCurve): string {
		const a = Math.max(xMin, Math.min(xMax, c.from ?? xMin));
		const b = Math.max(xMin, Math.min(xMax, c.to ?? xMax));
		const lo = Math.min(a, b);
		const hi = Math.max(a, b);
		if (hi - lo < 1e-9) return '';
		const n = Math.max(2, Math.ceil((SAMPLES * (hi - lo)) / (xMax - xMin)));
		return Array.from({ length: n + 1 }, (_, i) => {
			const x = lo + (i / n) * (hi - lo);
			return `${i ? 'L' : 'M'}${xOf(x).toFixed(1)},${yOf(c.value(x)).toFixed(1)}`;
		}).join(' ');
	}

	// ── Point to read; press to set ──────────────────────────────────────
	let hoverX = $state<number | null>(null);
	let dragging = false;
	function xAt(e: PointerEvent): number {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const frac = (e.clientX - rect.left - PADL) / (graphW - PADL - PADR);
		return snap(xMin + Math.min(1, Math.max(0, frac)) * (xMax - xMin));
	}
	function onDown(e: PointerEvent) {
		if (e.button !== 0) return;
		dragging = true;
		(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
		onset(xAt(e));
	}
	function onMove(e: PointerEvent) {
		const x = xAt(e);
		hoverX = x;
		if (dragging) onset(x);
	}
	function onUp() {
		dragging = false;
	}
	function onLeave() {
		if (!dragging) hoverX = null;
	}

	// The reading sits beside the crosshair, flipping sides near the right edge.
	const readX = $derived(hoverX === null ? 0 : xOf(hoverX));
	const readRight = $derived(readX > graphW - 150);
</script>

<div class="dc-graph" class:is-dim={dim} bind:clientWidth={graphW} bind:clientHeight={boxH}>
	<svg
		width={graphW}
		height={H}
		role="img"
		aria-label={label}
		onpointerdown={onDown}
		onpointermove={onMove}
		onpointerup={onUp}
		onpointercancel={onUp}
		onpointerleave={onLeave}
	>
		{#each xTicks as t (t)}
			<line x1={xOf(t)} y1={TOP} x2={xOf(t)} y2={plotY1} stroke="var(--chart-grid)" />
			<text x={xOf(t)} y={plotY1 + 15} fill="var(--chart-ink)" font-size="10" text-anchor="middle">
				{xTick(t)}
			</text>
		{/each}
		<text
			x={graphW - PADR}
			y={plotY1 + 27}
			fill="var(--chart-dim)"
			font-size="10"
			text-anchor="end"
		>
			{xLabel}
		</text>

		{#each yTicks as m (m)}
			<line
				x1={PADL}
				y1={yOf(m)}
				x2={graphW - PADR}
				y2={yOf(m)}
				stroke={m === 1 ? 'var(--chart-rule)' : 'var(--chart-grid)'}
			/>
			<text x={PADL - 7} y={yOf(m) + 3.5} fill="var(--chart-ink)" font-size="10" text-anchor="end">
				×{m}
			</text>
		{/each}
		<text x="0" y={TOP - 6} fill="var(--chart-dim)" font-size="10">{yLabel}</text>

		{#each guides as g (g.x)}
			<line
				x1={xOf(g.x)}
				y1={TOP}
				x2={xOf(g.x)}
				y2={plotY1}
				stroke="var(--chart-rule)"
				stroke-dasharray="4 4"
			/>
			{#if g.label}
				<text
					x={xOf(g.x) + (g.side === 'left' ? -5 : 5)}
					y={TOP + 10}
					fill="var(--chart-dim)"
					font-size="10"
					text-anchor={g.side === 'left' ? 'end' : 'start'}
				>
					{g.label}
				</text>
			{/if}
		{/each}

		{#each curves as c, i (i)}
			{#if c.kind === 'ghost'}
				<path
					d={trace(c)}
					fill="none"
					stroke="var(--chart-rule)"
					stroke-width="1.5"
					stroke-dasharray="5 4"
				/>
			{:else if c.kind === 'span'}
				<path
					d={trace(c)}
					fill="none"
					stroke="var(--dc-span)"
					stroke-width="7"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{:else}
				<path
					d={trace(c)}
					fill="none"
					stroke="var(--accent)"
					stroke-width="2"
					stroke-linejoin="round"
				/>
			{/if}
		{/each}

		{#if marker !== null}
			<line
				x1={xOf(marker)}
				y1={TOP}
				x2={xOf(marker)}
				y2={plotY1}
				stroke="var(--chart-dim)"
				stroke-dasharray="2 3"
			/>
		{/if}
		{#each points as p (p.x + ':' + p.hollow)}
			<circle
				cx={xOf(p.x)}
				cy={yOf(p.y)}
				r="4"
				fill={p.hollow ? 'var(--frame-bg)' : 'var(--accent)'}
				stroke={p.hollow ? 'var(--accent)' : 'var(--frame-bg)'}
				stroke-width="1.5"
			/>
		{/each}

		{#if message}
			<text
				x={(PADL + graphW - PADR) / 2}
				y={TOP + 26}
				fill="var(--chart-ink)"
				font-size="11"
				text-anchor="middle"
			>
				{message}
			</text>
		{/if}

		{#if hoverX !== null}
			<line
				x1={readX}
				y1={TOP}
				x2={readX}
				y2={plotY1}
				stroke="var(--chart-ink)"
				stroke-width="1"
				stroke-opacity="0.5"
			/>
		{/if}
	</svg>
	{#if hoverX !== null}
		<!-- The reading is a TAG, not outlined text: a tight glass plate beside
		     the crosshair, the same material as the panels it reads beside. -->
		<span
			class="dc-read ctx-glass"
			style:left={readRight ? null : `${readX + 6}px`}
			style:right={readRight ? `${graphW - readX + 6}px` : null}
			style:bottom={`${H - plotY1 + 6}px`}
		>
			{read(hoverX)}
		</span>
	{/if}
</div>

<style>
	/* ⚠ An SVG's own width props its box open — without these a narrower tile
	   clips the chart's right end (Artifact Odds pass, 2026-10-06). */
	.dc-graph {
		position: relative;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		/* the stretch your shred buys: the accent, softened */
		--dc-span: color-mix(in srgb, var(--accent) 32%, transparent);
	}

	.dc-graph svg {
		display: block;
		max-width: 100%;
		/* a horizontal drag sets the value; a vertical one still scrolls the
		   tile, and neither selects the tick labels */
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
		cursor: crosshair;
	}

	.dc-graph text {
		font-family: var(--font-body);
	}

	.dc-read {
		position: absolute;
		padding: 2px 6px;
		border-radius: 3px;
		/* the engaged density of glass, so the reading holds over the curves */
		background: var(--surface-hover);
		color: var(--text);
		font-family: var(--font-body);
		font-size: 11px;
		line-height: 1.3;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		pointer-events: none;
	}

	.dc-graph.is-dim path,
	.dc-graph.is-dim circle {
		opacity: 0.3;
	}
</style>
