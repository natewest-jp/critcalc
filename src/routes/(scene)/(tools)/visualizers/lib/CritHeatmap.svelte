<script lang="ts">
	/**
	 * THE FIELD (design §7: the 1:2 ray and the CV isoline through your point),
	 * with its companion strip on the shared CRIT Rate axis. The instrument
	 * measures the chart and lays it out (`rect`, `strip`); this draws it and
	 * takes the presses. Two canvases under one SVG: the field's colours, the
	 * no-crit shading over them, then every line, word and mark.
	 */
	import {
		CR_MIN,
		CR_MAX,
		CD_MIN,
		CD_MAX,
		CR_AXIS_MIN,
		ISOLINE_VALUES,
		clamp,
		averageDamageMultiplier,
		zeroCritProbability,
		critValue,
		cvLineCR,
		bestSplit,
		formatMultiplier,
		formatChance,
		rotationMultiplier,
		formatRatio,
		countAtRate,
		cdToX,
		crToY,
		xToCD,
		yToCR,
		type FieldRect
	} from './crit';
	import { buildRampLut, RAMP_LUT_SIZE, type RGB } from './critRamp';

	let {
		critRate = $bindable(0.7),
		critDamage = $bindable(1.4),
		width,
		height,
		rect,
		strip,
		hits,
		distribution,
		shading,
		pinned,
		pinnedDelta,
		readCount,
		hoverCount = $bindable(null)
	}: {
		critRate?: number;
		critDamage?: number;
		/** The SVG's size: the chart box. */
		width: number;
		height: number;
		/** The field's plot. */
		rect: FieldRect;
		/** The companion strip, at the chart's left edge outside the CRIT Rate
		 *  handle: its left edge and width. Its rows grow leftward from its right. */
		strip: { x0: number; w: number };
		hits: number;
		/** The chance of each crit count, 0 … hits. */
		distribution: number[];
		/** Darken the field by its no-crit risk. */
		shading: boolean;
		pinned: { critRate: number; critDamage: number } | null;
		/** Your average over the pinned build's, less one. */
		pinnedDelta: number;
		/** The strip's row the fine print reads (hovered, tapped or rolled). */
		readCount: number | null;
		/** The row under the pointer; the instrument reads it. */
		hoverCount?: number | null;
	} = $props();

	const CD_TICKS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
	const CR_TICKS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
	/** The y axis's numbers end this far left of the plot. */
	const TICK_GAP = 6;
	/** 🎛️ A strip row's thickness: most of the space a row has, within these. */
	const ROW_SHARE = 0.72;
	const ROW_MIN = 1.5;
	const ROW_MAX = 10;
	/** 🎛️ How much the night veils the unreachable 0–5% band. */
	const VEIL = 0.62;

	// Cubehelix-inspired colour ramp: deep blue → teal → green → yellow →
	// orange → red-purple, over ×1 to ×4; the curve between the stops is
	// critRamp.ts's. ⚓ Kept (Nate 2026-11-03) over four ramps whose lightness
	// only rises, though its own peaks at ×2.8 (docs/rounds/
	// viz-stage-crit-2026-11-03.md §3).
	const colorStops: readonly RGB[] = [
		[12, 24, 74],
		[22, 78, 148],
		[20, 140, 150],
		[48, 182, 104],
		[188, 212, 46],
		[240, 152, 36],
		[208, 52, 72],
		[138, 30, 138]
	];
	const rampLut = buildRampLut(colorStops);

	// The two words on the field the marker owns sit in white at an alpha;
	// the rest of the chart's ink is the stage's (--chart-ink, --chart-dim).
	const ink = (alpha: number) => `rgba(255, 255, 255, ${alpha})`;

	// ── Positions ─────────────────────────────────────────────────────────
	const x = (cd: number) => cdToX(cd, rect);
	const y = (cr: number) => crToY(cr, rect);
	const right = $derived(rect.x0 + rect.w);
	const bottom = $derived(rect.y0 + rect.h);

	const shownCR = $derived(clamp(critRate, CR_MIN, CR_MAX));
	const shownCD = $derived(clamp(critDamage, CD_MIN, CD_MAX));
	const dotX = $derived(x(shownCD));
	const dotY = $derived(y(shownCR));

	// The equal-CV line through your build: sliding along it keeps it still,
	// so the multiplier's peak on it (the best split) is found by eye.
	const cv = $derived(critValue(shownCR, shownCD));
	const best = $derived(bestSplit(cv));
	const atBest = $derived(
		Math.abs(best.critRate - shownCR) < 0.004 && Math.abs(best.critDamage - shownCD) < 0.008
	);

	function linePath(crAt: (cd: number) => number, floor = CR_AXIS_MIN) {
		let d = '';
		for (let px = rect.x0; px <= right + 0.01; px += 2) {
			const cr = crAt(xToCD(px, rect));
			if (cr < floor || cr > CR_MAX) continue;
			d += `${d ? ' L' : 'M'}${px.toFixed(1)},${y(cr).toFixed(1)}`;
		}
		return d;
	}

	// ⚓ THE RIGHT EDGE IS THE AVERAGE'S AXIS. Along CRIT DMG 300% the average
	// is 1 + 3 × CRIT Rate, a straight line in CRIT Rate, so the edge is an
	// exact ×1 (at 0%) to ×4 (at 100%) scale, and every contour meets it at its
	// own value: the labels there are an axis, not a legend.
	const avgY = (m: number) => y((m - 1) / CD_MAX);
	const AVG_ENDS = [1, 4];
	/** 🎛️ A fixed contour's value hides when it is this close to yours. */
	const AVG_CLEAR = 12;

	// Your contour: every build with your average, the headline's figure drawn.
	const yourM = $derived(averageDamageMultiplier(shownCR, shownCD));
	const yourPath = $derived(linePath((cd) => (yourM - 1) / cd, CR_MIN));
	const yourY = $derived(avgY(yourM));

	const isolines = $derived(
		ISOLINE_VALUES.map((m) => ({
			m,
			d: linePath((cd) => (m - 1) / cd),
			y: avgY(m),
			shown: Math.abs(avgY(m) - yourY) >= AVG_CLEAR
		}))
	);
	// Builds only: the line stops at the base 5%.
	const cvPath = $derived(linePath((cd) => cvLineCR(cv, cd), CR_MIN));
	// The CV label where its line enters the field: the left edge, else the top.
	const cvLabel = $derived.by(() => {
		const crLeft = cvLineCR(cv, CD_MIN);
		if (crLeft <= CR_MAX) return { x: rect.x0 + 6, y: y(crLeft) - 6 };
		return { x: x(cv - 2 * CR_MAX) + 8, y: rect.y0 + 14 };
	});

	// The 1:2 ray, CD = 2 × CR, from the field's left edge to its top.
	const RAY_CD0 = CD_MIN;
	const RAY_CD1 = Math.min(CD_MAX, 2 * CR_MAX);

	// The marker's word: its CD:CR ratio, right of the dot unless that runs out.
	const ratioLeft = $derived(dotX > right - 92);

	const pinnedX = $derived(pinned ? x(clamp(pinned.critDamage, CD_MIN, CD_MAX)) : 0);
	const pinnedY = $derived(pinned ? y(clamp(pinned.critRate, CR_MIN, CR_MAX)) : 0);
	// ⏭ i18n: the locale moves here with the ledger; the sign is ICU's.
	const deltaFormat = new Intl.NumberFormat('en-US', {
		style: 'percent',
		signDisplay: 'exceptZero',
		maximumFractionDigits: 1
	});

	// ── The strip: one row per crit count, at its share of the hits ────────
	const n = $derived(Math.max(1, Math.round(hits)));
	const peak = $derived(Math.max(...distribution));
	const rowH = $derived(
		clamp(((rect.h * (1 / n)) / (CR_MAX - CR_AXIS_MIN)) * ROW_SHARE, ROW_MIN, ROW_MAX)
	);
	// 🎛️ Where the strip has the length and its rows the room, each row
	// carries its reading: the count, that rotation's average, and its chance.
	const ROW_LABEL_W = 118;
	const ROW_LABEL_MIN_GAP = 13;
	/** A row this unlikely keeps its bar but not its words. */
	const ROW_LABEL_MIN_CHANCE = 0.005;
	const rowGap = $derived(rect.h / n / (CR_MAX - CR_AXIS_MIN));
	const rowWords = $derived(strip.w >= ROW_LABEL_W + 60 && rowGap >= ROW_LABEL_MIN_GAP);
	const barRoom = $derived(rowWords ? strip.w - ROW_LABEL_W : strip.w);
	const stripRight = $derived(strip.x0 + strip.w);
	const rows = $derived(
		distribution.map((chance, k) => {
			const len = peak > 0 ? (chance / peak) * barRoom : 0;
			return {
				k,
				y: y(k / n),
				len,
				x: stripRight - len,
				words: rowWords && chance >= ROW_LABEL_MIN_CHANCE,
				chance
			};
		})
	);

	// ── The canvases ──────────────────────────────────────────────────────
	let fieldCanvas = $state<HTMLCanvasElement | null>(null);
	let shadeCanvas = $state<HTMLCanvasElement | null>(null);

	function size(canvas: HTMLCanvasElement) {
		const w = Math.max(1, Math.round(rect.w));
		const h = Math.max(1, Math.round(rect.h));
		// Setting a size clears the canvas, so it happens right before the paint.
		if (canvas.width !== w) canvas.width = w;
		if (canvas.height !== h) canvas.height = h;
		return [w, h] as const;
	}

	function paintField(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const [w, h] = size(canvas);
		const img = ctx.createImageData(w, h);
		let i = 0;
		for (let py = 0; py < h; py++) {
			const cr = yToCR(rect.y0 + py, rect);
			for (let px = 0; px < w; px++) {
				const m = averageDamageMultiplier(cr, xToCD(rect.x0 + px, rect));
				const k = Math.round(clamp((m - 1) / 3, 0, 1) * (RAMP_LUT_SIZE - 1)) * 3;
				img.data[i] = rampLut[k];
				img.data[i + 1] = rampLut[k + 1];
				img.data[i + 2] = rampLut[k + 2];
				img.data[i + 3] = 255;
				i += 4;
			}
		}
		ctx.putImageData(img, 0, 0);
	}

	// Each CRIT Rate's row darkened by its chance of a whole rotation without
	// a crit (multiplied over the field in CSS).
	function paintShade(canvas: HTMLCanvasElement, on: boolean, hitCount: number) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const [w, h] = size(canvas);
		ctx.clearRect(0, 0, w, h);
		if (!on) return;
		const img = ctx.createImageData(w, h);
		let i = 0;
		for (let py = 0; py < h; py++) {
			const alpha = Math.round(zeroCritProbability(yToCR(rect.y0 + py, rect), hitCount) * 210);
			for (let px = 0; px < w; px++) {
				img.data[i + 3] = alpha;
				i += 4;
			}
		}
		ctx.putImageData(img, 0, 0);
	}

	$effect(() => {
		if (fieldCanvas) paintField(fieldCanvas);
	});
	$effect(() => {
		if (shadeCanvas) paintShade(shadeCanvas, shading, hits);
	});

	// ── Presses ───────────────────────────────────────────────────────────
	// A press on the field moves your build there and drags it; a press on
	// the strip reads a row (a hover does too, where there is one).
	let svgEl: SVGSVGElement | null = null;
	let dragging = $state(false);
	const SLACK = 10;

	function local(e: PointerEvent) {
		const box = svgEl!.getBoundingClientRect();
		return { px: e.clientX - box.left, py: e.clientY - box.top };
	}
	const inField = (px: number, py: number) =>
		px >= rect.x0 - SLACK && px <= right + SLACK && py >= rect.y0 - SLACK && py <= bottom + SLACK;
	const inStrip = (px: number, py: number) =>
		px >= strip.x0 - 4 && px <= stripRight + 4 && py >= rect.y0 - SLACK && py <= bottom;

	function moveTo(px: number, py: number) {
		critRate = Number(clamp(yToCR(py, rect), CR_MIN, CR_MAX).toFixed(3));
		critDamage = Number(clamp(xToCD(px, rect), CD_MIN, CD_MAX).toFixed(3));
	}

	function onDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		const { px, py } = local(e);
		if (inStrip(px, py)) {
			hoverCount = countAtRate(yToCR(py, rect), n);
			return;
		}
		if (!inField(px, py)) return;
		hoverCount = null;
		dragging = true;
		svgEl?.setPointerCapture(e.pointerId);
		moveTo(px, py);
	}

	function onMove(e: PointerEvent) {
		const { px, py } = local(e);
		if (dragging) {
			moveTo(px, py);
			return;
		}
		if (e.pointerType !== 'mouse') return;
		hoverCount = inStrip(px, py) ? countAtRate(yToCR(py, rect), n) : null;
	}

	function onUp(e: PointerEvent) {
		dragging = false;
		if (svgEl?.hasPointerCapture(e.pointerId)) svgEl.releasePointerCapture(e.pointerId);
	}

	// A tap's reading stays until the next press; a mouse's goes with it.
	function onLeave(e: PointerEvent) {
		if (e.pointerType === 'mouse' && !dragging) hoverCount = null;
	}

	let cursorKind = $state('crosshair');
	function onHoverCursor(e: PointerEvent) {
		if (dragging) return;
		const { px, py } = local(e);
		cursorKind = inField(px, py) ? 'crosshair' : inStrip(px, py) ? 'pointer' : 'default';
	}
</script>

<div class="cv-chart">
	<canvas
		bind:this={fieldCanvas}
		class="cv-canvas"
		style:left="{rect.x0}px"
		style:top="{rect.y0}px"
		style:width="{rect.w}px"
		style:height="{rect.h}px"
		aria-hidden="true"
	></canvas>
	<canvas
		bind:this={shadeCanvas}
		class="cv-canvas cv-shade"
		style:left="{rect.x0}px"
		style:top="{rect.y0}px"
		style:width="{rect.w}px"
		style:height="{rect.h}px"
		aria-hidden="true"
	></canvas>

	<svg
		bind:this={svgEl}
		{width}
		{height}
		role="img"
		aria-label="Crit rate and crit damage heatmap"
		onpointerdown={onDown}
		onpointermove={(e) => {
			onMove(e);
			onHoverCursor(e);
		}}
		onpointerup={onUp}
		onpointercancel={onUp}
		onpointerleave={onLeave}
		style:cursor={dragging ? 'grabbing' : cursorKind}
	>
		<!-- The unreachable band: no build has less than the base 5% -->
		<rect
			x={rect.x0}
			y={y(CR_MIN)}
			width={rect.w}
			height={bottom - y(CR_MIN)}
			fill="var(--frame-bg)"
			fill-opacity={VEIL}
		/>
		{#if bottom - y(CR_MIN) >= 12}
			<text
				class="stage-word"
				x={rect.x0 + 6}
				y={(bottom + y(CR_MIN)) / 2 + 3.5}
				fill="var(--chart-ink)"
				font-size="10"
			>
				below the base 5% CRIT Rate
			</text>
		{/if}

		<rect
			x={rect.x0 + 0.5}
			y={rect.y0 + 0.5}
			width={rect.w - 1}
			height={rect.h - 1}
			fill="none"
			stroke={ink(0.18)}
		/>

		<!-- The contours: builds with the same average, each valued where it
		     meets the average's axis on the right -->
		{#each isolines as iso (iso.m)}
			<path d={iso.d} fill="none" stroke={ink(0.34)} stroke-width="1.1" stroke-dasharray="5 4" />
		{/each}

		<!-- The 1:2 ray: where any budget's average peaks (until CRIT Rate
		     would pass 100%) -->
		<line
			x1={x(RAY_CD0)}
			y1={y(RAY_CD0 / 2)}
			x2={x(RAY_CD1)}
			y2={y(RAY_CD1 / 2)}
			stroke={ink(0.45)}
			stroke-width="1"
			stroke-dasharray="7 5"
		/>
		<!-- Its name at its dark foot, clear of the bright corner -->
		<text
			class="stage-word"
			x={rect.x0 + 6}
			y={y(RAY_CD0 / 2) - 10}
			fill="var(--text)"
			font-size="10"
		>
			CD = 2×CR
		</text>

		<!-- The equal-CV line through your build, and its best split: the
		     lighter of your two lines, so your contour leads -->
		<path d={cvPath} fill="none" stroke="var(--text)" stroke-width="1.25" stroke-opacity="0.7" />
		<text
			class="stage-word"
			x={cvLabel.x}
			y={cvLabel.y}
			fill="var(--text)"
			font-size="10"
			font-weight="600"
		>
			{Math.round(cv * 100)} CV
		</text>
		<circle
			cx={x(best.critDamage)}
			cy={y(best.critRate)}
			r="5"
			fill="none"
			stroke="var(--text)"
			stroke-width="1.5"
		/>
		{#if !atBest}
			<text
				class="stage-word"
				x={x(best.critDamage) + 9}
				y={y(best.critRate) - 8}
				fill={ink(0.8)}
				font-size="10"
			>
				best split of this budget
			</text>
		{/if}

		<!-- YOUR CONTOUR: every build with your average, the headline's figure
		     as a line. The boldest line on the field, cased in the night so it
		     holds on the yellow too. -->
		<path
			d={yourPath}
			fill="none"
			stroke="var(--frame-bg)"
			stroke-opacity="0.45"
			stroke-width="5"
			stroke-linecap="round"
		/>
		<path d={yourPath} fill="none" stroke="var(--text)" stroke-width="2.5" stroke-linecap="round" />
		<text
			class="stage-word"
			x={right - 6}
			y={yourY - 7}
			fill="var(--text)"
			font-size="11"
			font-weight="600"
			text-anchor="end"
		>
			your average
		</text>

		<!-- The axes' numbers -->
		{#each CD_TICKS as t (t)}
			<line x1={x(t)} y1={bottom} x2={x(t)} y2={bottom + 4} stroke="var(--chart-rule)" />
			<text
				x={x(t)}
				y={bottom + 16}
				fill="var(--chart-ink)"
				font-size="10"
				text-anchor={t === CD_MIN ? 'start' : t === CD_MAX ? 'end' : 'middle'}
			>
				{Math.round(t * 100)}%
			</text>
		{/each}
		{#each CR_TICKS as t (t)}
			<text
				x={rect.x0 - TICK_GAP}
				y={y(t) + 3.5}
				fill="var(--chart-ink)"
				font-size="10"
				text-anchor="end"
			>
				{Math.round(t * 100)}%
			</text>
		{/each}

		<!-- THE AVERAGE'S AXIS, the field's right edge: the contours' values
		     where they meet it, the ends, and yours, in the headline's ink -->
		<text x={width - 2} y={rect.y0 - 8} fill="var(--chart-dim)" font-size="10" text-anchor="end">
			average damage
		</text>
		{#each AVG_ENDS as m (m)}
			{#if Math.abs(avgY(m) - yourY) >= AVG_CLEAR}
				<text x={right + 6} y={avgY(m) + 3.5} fill="var(--chart-ink)" font-size="10">
					{formatMultiplier(m)}
				</text>
			{/if}
		{/each}
		{#each isolines as iso (iso.m)}
			<line x1={right} y1={iso.y} x2={right + 4} y2={iso.y} stroke="var(--chart-rule)" />
			{#if iso.shown}
				<text x={right + 6} y={iso.y + 3.5} fill="var(--chart-ink)" font-size="10">
					{formatMultiplier(iso.m)}
				</text>
			{/if}
		{/each}
		<line x1={right} y1={yourY} x2={right + 5} y2={yourY} stroke="var(--text)" stroke-width="2" />
		<text x={right + 7} y={yourY + 4} fill="var(--text)" font-size="12" font-weight="700">
			{formatMultiplier(yourM)}
		</text>

		<!-- The companion: how many of the hits crit, on the CRIT Rate axis,
		     outside the CRIT Rate handle; each row grows away from the field -->
		<line x1={stripRight} y1={rect.y0} x2={stripRight} y2={bottom} stroke="var(--chart-rule)" />
		{#each rows as r (r.k)}
			<rect
				x={r.x}
				y={r.y - rowH / 2}
				width={Math.max(r.len, 0)}
				height={rowH}
				rx="1"
				fill={readCount === r.k ? 'var(--text)' : 'var(--chart-ink)'}
				fill-opacity={readCount === r.k ? 1 : 0.45}
			/>
			{#if r.words}
				<text
					x={r.x - 6}
					y={r.y + 3.5}
					fill={readCount === r.k ? 'var(--text)' : 'var(--chart-ink)'}
					font-size="10"
					text-anchor="end"
				>
					{r.k} crit{r.k === 1 ? '' : 's'} · {formatMultiplier(rotationMultiplier(r.k, n, shownCD))} ·
					{formatChance(r.chance)}
				</text>
			{/if}
		{/each}
		<text
			class="stage-word"
			x={stripRight}
			y={bottom + 16}
			fill="var(--chart-dim)"
			font-size="10"
			text-anchor="end"
		>
			crits in {n}
			{n === 1 ? 'hit' : 'hits'}
		</text>

		<!-- Your build's crosshair: the CRIT Rate line runs out through the
		     handle and the strip, where the rows' average falls -->
		<line x1={strip.x0} y1={dotY} x2={right} y2={dotY} stroke={ink(0.32)} stroke-dasharray="3 4" />
		<line x1={dotX} y1={rect.y0} x2={dotX} y2={bottom} stroke={ink(0.32)} stroke-dasharray="3 4" />

		<!-- The pinned build, and the move from it to yours -->
		{#if pinned}
			<line
				x1={pinnedX}
				y1={pinnedY}
				x2={dotX}
				y2={dotY}
				stroke={ink(0.55)}
				stroke-width="1"
				stroke-dasharray="2 4"
			/>
			<circle
				cx={pinnedX}
				cy={pinnedY}
				r="5.5"
				fill={ink(0.55)}
				stroke="rgba(0,0,0,0.4)"
				stroke-width="1.5"
			/>
			{#if Math.hypot(dotX - pinnedX, dotY - pinnedY) > 40}
				<text
					class="stage-word"
					x={(pinnedX + dotX) / 2 + 6}
					y={(pinnedY + dotY) / 2 - 6}
					fill="var(--text)"
					font-size="11"
					font-weight="600"
				>
					{deltaFormat.format(pinnedDelta)} vs pinned
				</text>
			{/if}
		{/if}

		<!-- Your build -->
		<circle cx={dotX} cy={dotY} r="17" fill={ink(0.08)} />
		<!-- ⏸ The black ring is deliberate: this dot rides a rainbow, and white
		     on pale yellow is where it would disappear. -->
		<circle cx={dotX} cy={dotY} r="8" fill={ink(1)} stroke="rgba(0,0,0,0.35)" stroke-width="2" />
		<text
			class="stage-word"
			x={ratioLeft ? dotX - 14 : dotX + 14}
			y={dotY + 18}
			fill="var(--text)"
			font-size="10"
			text-anchor={ratioLeft ? 'end' : 'start'}
		>
			CD:CR {formatRatio(shownCR, shownCD)}
		</text>
	</svg>
</div>

<style>
	.cv-chart {
		position: absolute;
		inset: 0;
		user-select: none;
		-webkit-user-select: none;
	}

	.cv-chart svg {
		position: absolute;
		inset: 0;
		/* A 2-D control: a drag on the field moves the build, never the page. */
		touch-action: none;
	}

	/* The field is a painted image with hard edges of its own, so it is an
	   object on the night rather than ink drawn on it: its corners are cut. */
	.cv-canvas {
		position: absolute;
		display: block;
		border-radius: var(--r-sm);
	}

	.cv-shade {
		pointer-events: none;
		mix-blend-mode: multiply;
	}
</style>
