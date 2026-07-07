<script lang="ts">
	import {
		CR_MIN,
		CR_MAX,
		CD_MIN,
		CD_MAX,
		SIZE,
		PAD,
		PLOT_WIDTH,
		PLOT_HEIGHT,
		ISOLINE_VALUES,
		clamp,
		averageDamageMultiplier,
		zeroCritProbability,
		zeroCritRiskColor,
		critValue,
		cvLineCR,
		cdToX,
		crToY,
		xToCD,
		yToCR
	} from './crit';

	// Axis tick positions
	const CD_TICKS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
	const CR_TICKS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

	type Anchor = 'start' | 'end';
	type IsolineData = {
		value: number;
		path: string;
		label: {
			x: number;
			y: number;
			anchor: Anchor;
		};
	};

	let {
		critRate = $bindable(0.7),
		critDamage = $bindable(1.4),
		showVariance = false,
		hitsPerRotation = 8,
		showCvLine = true,
		pinned = null
	}: {
		critRate?: number;
		critDamage?: number;
		showVariance?: boolean;
		hitsPerRotation?: number;
		showCvLine?: boolean;
		pinned?: { critRate: number; critDamage: number } | null;
	} = $props();

	// Three rendering layers stacked in .cv-map-frame:
	//   1. canvasEl         — static heatmap (drawn once on mount)
	//   2. overlayCanvasEl  — variance overlay (redrawn when showVariance / hitsPerRotation change)
	//   3. overlayEl        — SVG: isolines, axes, draggable marker, tooltip (reactive)
	let canvasEl: HTMLCanvasElement | null = null;
	let overlayCanvasEl: HTMLCanvasElement | null = null;
	let overlayEl: SVGSVGElement | null = null;
	let dragging = $state(false);

	// Cubehelix-inspired color ramp: deep blue → teal → green → yellow → orange → red-purple.
	// Mapped over the multiplier range [1.0, 4.0].
	const colorStops: Array<[number, number, number]> = [
		[12, 24, 74],
		[22, 78, 148],
		[20, 140, 150],
		[48, 182, 104],
		[188, 212, 46],
		[240, 152, 36],
		[208, 52, 72],
		[138, 30, 138]
	];

	// SVG chrome ink — white at varying alpha, single-sourced (chart data colors live in crit.ts / colorStops)
	const ink = (alpha: number) => `rgba(255, 255, 255, ${alpha})`;

	// ── Derived: marker position and stats ────────────────────────────────────
	// Values render clamped to axis bounds; the parent owns the raw bindables.
	const shownCR = $derived(clamp(critRate, CR_MIN, CR_MAX));
	const shownCD = $derived(clamp(critDamage, CD_MIN, CD_MAX));
	const dotX = $derived(cdToX(shownCD));
	const dotY = $derived(crToY(shownCR));
	const dotMultiplier = $derived(averageDamageMultiplier(shownCR, shownCD));
	const zeroCritRisk = $derived(zeroCritProbability(shownCR, hitsPerRotation));

	// Color for the no-crit risk line in the tooltip (green → yellow → orange → red)
	const riskColor = $derived(zeroCritRiskColor(zeroCritRisk));

	// ── Derived: crit-value budget line ────────────────────────────────────────
	// The equal-CV curve through the current marker. Because the line follows the
	// marker's CV, dragging *along* it keeps the line stationary — so the player can
	// slide along a fixed budget and watch the multiplier peak at the isoline tangency.
	const cv = $derived(critValue(shownCR, shownCD));
	const cvPath = $derived(buildCvLinePath(cv));
	const cvLabel = $derived(buildCvLineLabel(cv));

	// ── Derived: pinned build marker ───────────────────────────────────────────
	const pinnedX = $derived(pinned ? cdToX(clamp(pinned.critDamage, CD_MIN, CD_MAX)) : 0);
	const pinnedY = $derived(pinned ? crToY(clamp(pinned.critRate, CR_MIN, CR_MAX)) : 0);

	// ── Derived: tooltip layout ────────────────────────────────────────────────
	// Tooltip floats near the marker, flipping sides and clamping to stay inside the plot area.
	const tooltip = $derived.by(() => {
		const width = 132;
		const height = showVariance ? 78 : 62;
		const margin = 12;
		const prefersLeft = dotX > PAD.left + PLOT_WIDTH * 0.72;
		let x = prefersLeft ? dotX - width - margin : dotX + margin;
		let y = dotY - height - margin;

		// Flip below the marker if it would clip the top edge
		if (y < PAD.top + 4) {
			y = dotY + margin;
		}

		x = clamp(x, PAD.left + 4, PAD.left + PLOT_WIDTH - width - 4);
		y = clamp(y, PAD.top + 4, PAD.top + PLOT_HEIGHT - height - 4);

		return { x, y, width, height };
	});

	// ── Canvas rendering ───────────────────────────────────────────────────────

	// Maps a damage multiplier value to an RGB color via the cubehelix-inspired ramp
	function damageToColor(value: number): [number, number, number] {
		const normalized = clamp((value - 1.0) / (4.0 - 1.0), 0, 1);
		const segment = normalized * (colorStops.length - 1);
		const start = Math.floor(segment);
		const end = Math.min(start + 1, colorStops.length - 1);
		const fraction = segment - start;
		const [r1, g1, b1] = colorStops[start];
		const [r2, g2, b2] = colorStops[end];
		return [
			Math.round(r1 + (r2 - r1) * fraction),
			Math.round(g1 + (g2 - g1) * fraction),
			Math.round(b1 + (b2 - b1) * fraction)
		];
	}

	// Draws the static heatmap onto canvasEl. Called once on mount; the result never changes
	// because the heatmap encodes the full CR×CD space — the marker moves in the SVG layer instead.
	function drawHeatmap() {
		if (!canvasEl) return;

		const context = canvasEl.getContext('2d');
		if (!context) return;

		// Fill background, then write each plot pixel directly via ImageData
		context.fillStyle = '#081225';
		context.fillRect(0, 0, SIZE, SIZE);

		const image = context.createImageData(PLOT_WIDTH, PLOT_HEIGHT);
		const data = image.data;
		let index = 0;

		for (let py = 0; py < PLOT_HEIGHT; py += 1) {
			const chartY = PAD.top + py;
			const critRate = yToCR(chartY);

			for (let px = 0; px < PLOT_WIDTH; px += 1) {
				const chartX = PAD.left + px;
				const critDamage = xToCD(chartX);
				const multiplier = averageDamageMultiplier(critRate, critDamage);
				const [r, g, b] = damageToColor(multiplier);

				data[index] = r;
				data[index + 1] = g;
				data[index + 2] = b;
				data[index + 3] = 255;
				index += 4;
			}
		}

		context.putImageData(image, PAD.left, PAD.top);

		// Subtle plot-area border
		context.strokeStyle = ink(0.24);
		context.lineWidth = 1;
		context.strokeRect(PAD.left + 0.5, PAD.top + 0.5, PLOT_WIDTH - 1, PLOT_HEIGHT - 1);
	}

	// Draws the variance overlay onto overlayCanvasEl. Alpha per row is proportional to
	// zero-crit probability at that CR value, so low-CR regions darken more strongly.
	// Uses mix-blend-mode: multiply in CSS to darken the heatmap beneath it.
	function drawVarianceOverlay(enabled: boolean, hits: number) {
		if (!overlayCanvasEl) return;

		const context = overlayCanvasEl.getContext('2d');
		if (!context) return;

		context.clearRect(0, 0, SIZE, SIZE);
		if (!enabled) return;

		const image = context.createImageData(PLOT_WIDTH, PLOT_HEIGHT);
		const data = image.data;
		let index = 0;

		for (let py = 0; py < PLOT_HEIGHT; py += 1) {
			const chartY = PAD.top + py;
			const rowCritRate = yToCR(chartY);
			const alpha = Math.round(zeroCritProbability(rowCritRate, hits) * 210);

			for (let px = 0; px < PLOT_WIDTH; px += 1) {
				data[index] = 0;
				data[index + 1] = 0;
				data[index + 2] = 0;
				data[index + 3] = alpha;
				index += 4;
			}
		}

		context.putImageData(image, PAD.left, PAD.top);
	}

	// ── Isoline builders ───────────────────────────────────────────────────────
	// An isoline for multiplier M is the curve where 1 + CR × CD = M,
	// i.e. CR = (M - 1) / CD. We step along X and compute the Y coordinate.

	function buildIsolinePath(target: number) {
		let path = '';
		let firstPoint = true;

		for (let x = PAD.left; x <= PAD.left + PLOT_WIDTH; x += 2) {
			const critDamage = xToCD(x);
			const critRate = (target - 1) / critDamage;

			if (critRate < CR_MIN || critRate > CR_MAX) continue;

			const y = crToY(critRate);
			path += `${firstPoint ? 'M' : ' L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
			firstPoint = false;
		}

		return path;
	}

	// Labels sit just OUTSIDE the right plot edge (like the axis tick labels),
	// vertically centered on where their line exits; falls back to the top edge
	// if the line leaves the plot before reaching the right side.
	function buildIsolineLabel(target: number): IsolineData['label'] {
		const crAtRightEdge = (target - 1) / CD_MAX;

		if (crAtRightEdge >= CR_MIN && crAtRightEdge <= CR_MAX) {
			return { x: PAD.left + PLOT_WIDTH + 8, y: crToY(crAtRightEdge) + 3.5, anchor: 'start' };
		}

		const cdAtTopEdge = (target - 1) / CR_MAX;
		if (cdAtTopEdge >= CD_MIN && cdAtTopEdge <= CD_MAX) {
			return { x: cdToX(cdAtTopEdge) + 4, y: PAD.top + 14, anchor: 'start' };
		}

		return { x: PAD.left + 8, y: PAD.top + 12, anchor: 'start' };
	}

	// Traces the equal-CV budget line CR = (CV − CD) / 2 across the plot, same
	// stepping approach as the isoline paths.
	function buildCvLinePath(cvTarget: number) {
		let path = '';
		let firstPoint = true;

		for (let x = PAD.left; x <= PAD.left + PLOT_WIDTH; x += 2) {
			const cd = xToCD(x);
			const cr = cvLineCR(cvTarget, cd);

			if (cr < CR_MIN || cr > CR_MAX) continue;

			const y = crToY(cr);
			path += `${firstPoint ? 'M' : ' L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
			firstPoint = false;
		}

		return path;
	}

	// Places the CV label where the budget line enters the plot: at the left edge
	// when the line crosses it, otherwise where it descends from the top edge.
	function buildCvLineLabel(cvTarget: number) {
		const crAtLeftEdge = cvLineCR(cvTarget, CD_MIN);
		if (crAtLeftEdge >= CR_MIN && crAtLeftEdge <= CR_MAX) {
			return { x: PAD.left + 8, y: crToY(crAtLeftEdge) - 8 };
		}

		const cdAtTopEdge = cvTarget - 2 * CR_MAX;
		if (cdAtTopEdge >= CD_MIN && cdAtTopEdge <= CD_MAX) {
			return { x: cdToX(cdAtTopEdge) + 8, y: PAD.top + 16 };
		}

		return { x: PAD.left + 8, y: PAD.top + 16 };
	}

	// ── Pointer / drag handling ────────────────────────────────────────────────
	// Pointer capture on the SVG ensures dragging outside the element still tracks.

	function pointerToStats(event: PointerEvent) {
		if (!overlayEl) return null;

		const rect = overlayEl.getBoundingClientRect();
		const scaleX = SIZE / rect.width;
		const scaleY = SIZE / rect.height;
		const x = (event.clientX - rect.left) * scaleX;
		const y = (event.clientY - rect.top) * scaleY;

		return {
			critRate: clamp(yToCR(y), CR_MIN, CR_MAX),
			critDamage: clamp(xToCD(x), CD_MIN, CD_MAX)
		};
	}

	function updateFromPointer(event: PointerEvent) {
		const stats = pointerToStats(event);
		if (!stats) return;
		critRate = Number(stats.critRate.toFixed(3));
		critDamage = Number(stats.critDamage.toFixed(3));
	}

	function onPointerDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		dragging = true;
		updateFromPointer(event);
		overlayEl?.setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging) return;
		updateFromPointer(event);
	}

	function onPointerUp(event: PointerEvent) {
		dragging = false;
		if (overlayEl?.hasPointerCapture(event.pointerId)) {
			overlayEl.releasePointerCapture(event.pointerId);
		}
	}

	// ── Precompute isolines ────────────────────────────────────────────────────
	// Paths are static — they don't depend on the marker position — so we build them once.
	const isolines = ISOLINE_VALUES.map((value) => ({
		value,
		path: buildIsolinePath(value),
		label: buildIsolineLabel(value)
	}));

	// ── Effects ────────────────────────────────────────────────────────────────

	// Draw static heatmap once canvasEl is bound
	$effect(() => {
		if (!canvasEl) return;
		drawHeatmap();
	});

	// Redraw variance overlay when the toggle or hit count changes
	$effect(() => {
		if (!overlayCanvasEl) return;
		drawVarianceOverlay(showVariance, hitsPerRotation);
	});
</script>

<div class="cv-heatmap-shell">
	<div class="cv-map-frame">
		<!-- Layer 1: static heatmap (drawn once via canvas 2D API) -->
		<canvas bind:this={canvasEl} width={SIZE} height={SIZE} aria-hidden="true"></canvas>

		<!-- Layer 2: variance overlay (multiply blend darkens high-risk regions) -->
		<canvas
			bind:this={overlayCanvasEl}
			width={SIZE}
			height={SIZE}
			class="cv-overlay-canvas"
			aria-hidden="true"
		></canvas>

		<!-- Layer 3: SVG — isolines, axes, crosshairs, marker, tooltip (all reactive) -->
		<svg
			bind:this={overlayEl}
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			role="img"
			aria-label="Crit rate and crit damage heatmap"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onpointerleave={onPointerUp}
			style:cursor={dragging ? 'grabbing' : 'crosshair'}
		>
			<!-- Plot area border -->
			<rect
				x={PAD.left}
				y={PAD.top}
				width={PLOT_WIDTH}
				height={PLOT_HEIGHT}
				fill="none"
				stroke={ink(0.15)}
				stroke-width="1"
			/>

			<!-- Isolines -->
			{#each isolines as isoline (isoline.value)}
				{#if isoline.path}
					<path
						d={isoline.path}
						fill="none"
						stroke={ink(0.34)}
						stroke-width="1.1"
						stroke-dasharray="5 4"
					/>
					<text
						x={isoline.label.x}
						y={isoline.label.y}
						fill={ink(0.62)}
						font-size="10"
						text-anchor={isoline.label.anchor}
					>
						{isoline.value.toFixed(2)}x
					</text>
				{/if}
			{/each}

			<!-- Crit-value budget line: every build reachable at the marker's total CV -->
			{#if showCvLine && cvPath}
				<path d={cvPath} fill="none" stroke="#6cb5ff" stroke-width="1.6" opacity="0.85" />
				<text x={cvLabel.x} y={cvLabel.y} fill="#6cb5ff" font-size="10" font-weight="600">
					{Math.round(cv * 100)} CV
				</text>
			{/if}

			<!-- X-axis ticks and labels (Crit Damage) -->
			{#each CD_TICKS as tick (tick)}
				<line
					x1={cdToX(tick)}
					y1={PAD.top + PLOT_HEIGHT}
					x2={cdToX(tick)}
					y2={PAD.top + PLOT_HEIGHT + 6}
					stroke={ink(0.5)}
					stroke-width="1"
				/>
				<text
					x={cdToX(tick)}
					y={PAD.top + PLOT_HEIGHT + 22}
					fill={ink(0.68)}
					font-size="11"
					text-anchor="middle"
				>
					{Math.round(tick * 100)}%
				</text>
			{/each}

			<!-- Y-axis ticks and labels (Crit Rate) -->
			{#each CR_TICKS as tick (tick)}
				<line
					x1={PAD.left - 6}
					y1={crToY(tick)}
					x2={PAD.left}
					y2={crToY(tick)}
					stroke={ink(0.5)}
					stroke-width="1"
				/>
				<text
					x={PAD.left - 10}
					y={crToY(tick) + 4}
					fill={ink(0.68)}
					font-size="11"
					text-anchor="end"
				>
					{Math.round(tick * 100)}%
				</text>
			{/each}

			<!-- Axis labels -->
			<text
				x={PAD.left + PLOT_WIDTH / 2}
				y={SIZE - 8}
				fill={ink(0.56)}
				font-size="11"
				text-anchor="middle"
				letter-spacing="0.2em"
			>
				CRIT DMG
			</text>
			<text
				x={18}
				y={PAD.top + PLOT_HEIGHT / 2}
				fill={ink(0.56)}
				font-size="11"
				text-anchor="middle"
				letter-spacing="0.2em"
				transform={`rotate(-90, 18, ${PAD.top + PLOT_HEIGHT / 2})`}
			>
				CRIT RATE
			</text>

			<!-- Crosshair lines extending from the marker to the axes -->
			<line
				x1={PAD.left}
				y1={dotY}
				x2={PAD.left + PLOT_WIDTH}
				y2={dotY}
				stroke={ink(0.2)}
				stroke-width="1"
				stroke-dasharray="3 4"
			/>
			<line
				x1={dotX}
				y1={PAD.top}
				x2={dotX}
				y2={PAD.top + PLOT_HEIGHT}
				stroke={ink(0.2)}
				stroke-width="1"
				stroke-dasharray="3 4"
			/>

			<!-- Pinned build: dimmed dot + dashed connector showing the move from pin to marker -->
			{#if pinned}
				<line
					x1={pinnedX}
					y1={pinnedY}
					x2={dotX}
					y2={dotY}
					stroke={ink(0.28)}
					stroke-width="1"
					stroke-dasharray="2 5"
				/>
				<circle
					cx={pinnedX}
					cy={pinnedY}
					r="5.5"
					fill={ink(0.5)}
					stroke="rgba(0,0,0,0.4)"
					stroke-width="1.5"
				/>
			{/if}

			<!-- Marker: soft halo + solid dot -->
			<circle cx={dotX} cy={dotY} r="17" fill={ink(0.08)} />
			<circle cx={dotX} cy={dotY} r="8" fill="#f7fafc" stroke="rgba(0,0,0,0.35)" stroke-width="2" />

			<!-- Floating tooltip -->
			<rect
				x={tooltip.x}
				y={tooltip.y}
				width={tooltip.width}
				height={tooltip.height}
				rx="7"
				fill="rgba(5, 10, 24, 0.82)"
				stroke={ink(0.22)}
				stroke-width="1"
			/>
			<text x={tooltip.x + 10} y={tooltip.y + 17} fill={ink(0.72)} font-size="10">
				CR {(shownCR * 100).toFixed(1)}%
			</text>
			<text x={tooltip.x + 10} y={tooltip.y + 33} fill={ink(0.72)} font-size="10">
				CD {(shownCD * 100).toFixed(1)}%
			</text>
			<text x={tooltip.x + 10} y={tooltip.y + 51} fill="white" font-size="13" font-weight="700">
				{dotMultiplier.toFixed(3)}x
			</text>
			{#if showVariance}
				<text x={tooltip.x + 10} y={tooltip.y + 67} fill={riskColor} font-size="10">
					{(zeroCritRisk * 100).toFixed(1)}% no-crit risk
				</text>
			{/if}
		</svg>
	</div>
</div>

<style>
	.cv-heatmap-shell {
		width: 100%;
		display: grid;
		place-items: center;
	}

	/* Square frame that clips all three layers; sized to the smaller of width and viewport height */
	.cv-map-frame {
		position: relative;
		width: min(100%, 100svh);
		aspect-ratio: 1;
		border-radius: 8px;
		overflow: hidden;
		/* Frame border ties the chart to the Dire edge treatment */
		border: 1px solid color-mix(in srgb, var(--dire-tint, #c2185b) 38%, transparent);
		user-select: none;
		-webkit-user-select: none;
		background:
			radial-gradient(circle at 12% 0%, rgba(38, 102, 214, 0.2), transparent 45%),
			radial-gradient(circle at 100% 100%, rgba(188, 55, 119, 0.2), transparent 42%), #081225;
	}

	/* All three layers fill the frame exactly */
	canvas,
	svg {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
	}

	/* Variance overlay uses multiply blend so it darkens without replacing heatmap color */
	.cv-overlay-canvas {
		pointer-events: none;
		mix-blend-mode: multiply;
	}

	svg {
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	/* Chart labels are data: axis ticks, isoline values, tooltip readouts */
	svg text {
		font-family: var(--font-mono);
	}

	@media (min-width: 1024px) {
		/* Use container query height so the heatmap fills the panel rather than the viewport */
		.cv-heatmap-shell {
			height: 100%;
			container-type: size;
		}

		@supports (width: 1cqh) {
			.cv-map-frame {
				width: min(100%, 100cqh, 100svh);
			}
		}
	}
</style>
