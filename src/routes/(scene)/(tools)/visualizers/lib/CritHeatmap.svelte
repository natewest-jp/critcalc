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
		countAtRate,
		countLabels,
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
		 *  handle: its left edge and width. Its rows grow leftward from its right.
		 *  Width 0 where it lives under the chart instead (the instrument draws it). */
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
	/** 🎛️ A strip row's thickness: most of the space a row has, within these.
	 *  ↻ ROW_MAX 22, was 10 (Nate 2026-11-03: at 8 hits the rows stood 95px
	 *  apart as hairlines). Not the whole gap: a solid block of bars would
	 *  read as one shape, not a count. */
	const ROW_SHARE = 0.72;
	const ROW_MIN = 1.5;
	const ROW_MAX = 22;
	/** 🎛️ The strip's crit counts: a column at its outer edge, numbers
	 *  right-aligned COUNT_W in, the bars growing to COUNT_GAP short of them.
	 *  COUNT_MIN_GAP is the least room between two labels before they thin
	 *  (crit.ts, countLabels). */
	const COUNT_W = 14;
	const COUNT_GAP = 5;
	const COUNT_MIN_GAP = 12;
	/** 🎛️ The contours' white, width and dash. Dotted (round dots, CONTOUR_GAP
	 *  apart), after dashed (5 4) and solid were both tried (Nate 2026-11-03):
	 *  dots read as a guide drawn over the colour, not a line on it, and stay
	 *  clear of the one solid line, the CV's. Solid: CONTOUR_DASH 'none'. */
	const CONTOUR_INK = 0.6;
	const CONTOUR_W = 2;
	const CONTOUR_GAP = 5;
	const CONTOUR_DASH = `0 ${CONTOUR_GAP}`;
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

	// Your average, marked on its axis: the headline's figure on the scale
	// the contours are read by. ⛔ Not as a contour of its own: two more lines
	// through the marker were too many (Nate 2026-11-03).
	const yourM = $derived(averageDamageMultiplier(shownCR, shownCD));
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
	const stripRight = $derived(strip.x0 + strip.w);
	const barRoom = $derived(Math.max(0, strip.w - COUNT_W - COUNT_GAP));
	const countLabelKs = $derived(
		countLabels(n, rect.h / n / (CR_MAX - CR_AXIS_MIN), COUNT_MIN_GAP, readCount)
	);
	const rows = $derived(
		distribution.map((chance, k) => {
			const len = peak > 0 ? (chance / peak) * barRoom : 0;
			return {
				k,
				y: y(k / n),
				len,
				x: stripRight - len
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

	/** 🎛️ On the best split, the ring is drawn around your dot instead, which
	 *  would hide it (Nate 2026-11-04: at the defaults nobody saw the ring the
	 *  fine print names). */
	const BEST_RING_R = 13;
	/** 🎛️ The ring's press target: wider than its 5px, for a finger. */
	const RING_HIT_R = 12;
	function toBest() {
		// ⚠ Both read before either is written: setting CRIT Rate moves the CV,
		// and `best` with it.
		const { critRate: cr, critDamage: cd } = best;
		critRate = Number(cr.toFixed(3));
		critDamage = Number(cd.toFixed(3));
		hoverCount = null;
	}

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
		     meets the average's axis on the right (CONTOUR_* above). -->
		{#each isolines as iso (iso.m)}
			<path
				d={iso.d}
				fill="none"
				stroke={ink(CONTOUR_INK)}
				stroke-width={CONTOUR_W}
				stroke-dasharray={CONTOUR_DASH}
				stroke-linecap="round"
			/>
		{/each}

		<!-- The equal-CV line through your build, and its best split: the
		     one solid line on the field -->
		<path d={cvPath} fill="none" stroke="var(--text)" stroke-width="1.5" stroke-opacity="0.85" />
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
		{#if !atBest}
			<circle
				cx={x(best.critDamage)}
				cy={y(best.critRate)}
				r="5"
				fill="none"
				stroke="var(--text)"
				stroke-width="1.5"
			/>
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
		<!-- Yours: a notch where your build's contour would meet the axis -->
		<path d="M{right + 1},{yourY} l5,-4 v8 z" fill="var(--text)" />
		<text x={right + 9} y={yourY + 4} fill="var(--text)" font-size="12" font-weight="700">
			{formatMultiplier(yourM)}
		</text>

		<!-- The companion: how many of the hits crit, on the CRIT Rate axis,
		     each row labelled with its count in a column at the outer edge,
		     outside the CRIT Rate handle; each row grows away from the field -->
		{#if strip.w > 0}
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
			{/each}
			{#each countLabelKs as k (k)}
				<text
					x={strip.x0 + COUNT_W}
					y={y(k / n) + 3.5}
					fill={readCount === k ? 'var(--text)' : 'var(--chart-ink)'}
					font-size="10"
					font-weight={readCount === k ? 700 : null}
					text-anchor="end">{k}</text
				>
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
		{/if}

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
		{#if atBest}
			<circle
				cx={dotX}
				cy={dotY}
				r={BEST_RING_R}
				fill="none"
				stroke="var(--text)"
				stroke-width="1.5"
			/>
		{/if}
		<!-- THE RING IS A BUTTON: one press moves your build to the best split
		     of its budget. Last, so it sits over the marker and the lines. -->
		{#if !atBest}
			<circle
				class="cv-ring-hit"
				cx={x(best.critDamage)}
				cy={y(best.critRate)}
				r={RING_HIT_R}
				fill="transparent"
				role="button"
				tabindex="0"
				aria-label="Move to the best split of this budget"
				onpointerdown={(e) => e.stopPropagation()}
				onclick={toBest}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						toBest();
					}
				}}
			>
				<title>Move to the best split of this budget</title>
			</circle>
		{/if}
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

	.cv-ring-hit {
		cursor: pointer;
		outline: none;
	}
	/* Focus draws its own ring: Safari's outline on SVG is unreliable. */
	.cv-ring-hit:focus-visible {
		stroke: var(--accent);
		stroke-width: 2;
	}

	.cv-shade {
		pointer-events: none;
		mix-blend-mode: multiply;
	}
</style>
