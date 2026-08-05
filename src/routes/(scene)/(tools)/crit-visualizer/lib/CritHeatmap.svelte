<script lang="ts">
	import {
		CR_MIN,
		CR_MAX,
		CD_MIN,
		CD_MAX,
		SIZE,
		PAD,
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
		yToCR,
		plotWidth,
		plotHeight,
		type PlotGeometry
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
	//   1. canvasEl         — heatmap field (redrawn when the box resizes)
	//   2. overlayCanvasEl  — variance overlay (redrawn on showVariance / hitsPerRotation / resize)
	//   3. overlayEl        — SVG: isolines, axes, draggable marker, tooltip (reactive)
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let overlayCanvasEl = $state<HTMLCanvasElement | null>(null);
	let overlayEl: SVGSVGElement | null = null;
	let dragging = $state(false);

	// ── Responsive geometry (Option 2: bounded-aspect fill) ─────────────────────
	// The chart fills the box its shell gives it, but the width:height ratio is
	// clamped so it never stretches into an unreadable sliver. JS measures the
	// shell (a ResizeObserver) and derives the drawn box (boxW × boxH); the SVG
	// viewBox, canvas buffers, and every coordinate mapping track that box.
	const MIN_ASPECT = 0.82; // narrowest w:h (tallest the plot may get)
	const MAX_ASPECT = 1.25; // widest w:h (widest the plot may get)
	let shellEl = $state<HTMLDivElement | null>(null);
	let boxW = $state(SIZE);
	let boxH = $state(SIZE);

	const geom = $derived<PlotGeometry>({ width: boxW, height: boxH, pad: PAD });
	const plotW = $derived(plotWidth(geom));
	const plotH = $derived(plotHeight(geom));

	// Largest rectangle inside (availW × availH) whose aspect sits in the clamp
	// band; equal to the container when its own aspect is already in range.
	function fitBox(availW: number, availH: number) {
		if (availW < 1 || availH < 1) return;
		const aspect = availW / availH;
		let w = availW;
		let h = availH;
		if (aspect > MAX_ASPECT) w = availH * MAX_ASPECT;
		else if (aspect < MIN_ASPECT) h = availW / MIN_ASPECT;
		boxW = Math.round(w);
		boxH = Math.round(h);
	}

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
	const dotX = $derived(cdToX(shownCD, geom));
	const dotY = $derived(crToY(shownCR, geom));
	const dotMultiplier = $derived(averageDamageMultiplier(shownCR, shownCD));
	const zeroCritRisk = $derived(zeroCritProbability(shownCR, hitsPerRotation));

	// Color for the no-crit risk line in the tooltip (green → yellow → orange → red)
	const riskColor = $derived(zeroCritRiskColor(zeroCritRisk));

	// ── Derived: crit-value budget line ────────────────────────────────────────
	// The equal-CV curve through the current marker. Because the line follows the
	// marker's CV, dragging *along* it keeps the line stationary — so the player can
	// slide along a fixed budget and watch the multiplier peak at the isoline tangency.
	const cv = $derived(critValue(shownCR, shownCD));
	const cvPath = $derived(buildCvLinePath(cv, geom));
	const cvLabel = $derived(buildCvLineLabel(cv, geom));

	// The CD = 2×CR "balanced ratio" diagonal, clipped to the plot bounds.
	// Shown with the CV line: a fixed budget's multiplier peaks exactly where
	// the budget line crosses this diagonal (CD = CV/2, CR = CV/4).
	const RATIO_CD0 = Math.max(CD_MIN, 2 * CR_MIN);
	const RATIO_CD1 = Math.min(CD_MAX, 2 * CR_MAX);
	const tangentInPlot = $derived(
		cv / 2 >= CD_MIN && cv / 2 <= CD_MAX && cv / 4 >= CR_MIN && cv / 4 <= CR_MAX
	);

	// ── Derived: pinned build marker ───────────────────────────────────────────
	const pinnedX = $derived(pinned ? cdToX(clamp(pinned.critDamage, CD_MIN, CD_MAX), geom) : 0);
	const pinnedY = $derived(pinned ? crToY(clamp(pinned.critRate, CR_MIN, CR_MAX), geom) : 0);

	// ── Derived: tooltip layout ────────────────────────────────────────────────
	// Tooltip floats near the marker, flipping sides and clamping to stay inside the plot area.
	const tooltip = $derived.by(() => {
		const width = 132;
		const height = showVariance ? 78 : 62;
		const margin = 12;
		const prefersLeft = dotX > PAD.left + plotW * 0.72;
		let x = prefersLeft ? dotX - width - margin : dotX + margin;
		let y = dotY - height - margin;

		// Flip below the marker if it would clip the top edge
		if (y < PAD.top + 4) {
			y = dotY + margin;
		}

		x = clamp(x, PAD.left + 4, PAD.left + plotW - width - 4);
		y = clamp(y, PAD.top + 4, PAD.top + plotH - height - 4);

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

	// Draws the heatmap field onto canvasEl at the current box size. The marker/CV
	// line move in the SVG layer; this only re-runs when the drawn box resizes.
	function drawHeatmap() {
		if (!canvasEl) return;

		const context = canvasEl.getContext('2d');
		if (!context) return;

		// Size the buffer here — setting width/height clears the canvas, so doing it
		// right before painting keeps resize + repaint atomic (a reactive width=
		// binding would clear it a beat out of step with this draw and blank it out).
		if (canvasEl.width !== boxW) canvasEl.width = boxW;
		if (canvasEl.height !== boxH) canvasEl.height = boxH;

		const pw = Math.max(1, Math.round(plotW));
		const ph = Math.max(1, Math.round(plotH));

		// Fill background, then write each plot pixel directly via ImageData.
		// The ground is READ FROM THE CASCADE, not hardcoded — this canvas
		// paints opaquely over .frame, and a literal here silently detaches
		// the heatmap from --frame-bg tuning (it was the one frame that
		// didn't follow devtools edits — Nate 2026-07-31). Re-read per draw;
		// a live var edit lands on the next redraw (resize or remount).
		const frameBg = getComputedStyle(canvasEl).getPropertyValue('--frame-bg').trim() || '#121b2f';
		context.fillStyle = frameBg;
		context.fillRect(0, 0, boxW, boxH);

		const image = context.createImageData(pw, ph);
		const data = image.data;
		let index = 0;

		for (let py = 0; py < ph; py += 1) {
			const critRate = yToCR(PAD.top + py, geom);

			for (let px = 0; px < pw; px += 1) {
				const critDamage = xToCD(PAD.left + px, geom);
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
		context.strokeRect(PAD.left + 0.5, PAD.top + 0.5, pw - 1, ph - 1);
	}

	// Draws the variance overlay onto overlayCanvasEl. Alpha per row is proportional to
	// zero-crit probability at that CR value, so low-CR regions darken more strongly.
	// Uses mix-blend-mode: multiply in CSS to darken the heatmap beneath it.
	function drawVarianceOverlay(enabled: boolean, hits: number) {
		if (!overlayCanvasEl) return;

		const context = overlayCanvasEl.getContext('2d');
		if (!context) return;

		if (overlayCanvasEl.width !== boxW) overlayCanvasEl.width = boxW;
		if (overlayCanvasEl.height !== boxH) overlayCanvasEl.height = boxH;

		context.clearRect(0, 0, boxW, boxH);
		if (!enabled) return;

		const pw = Math.max(1, Math.round(plotW));
		const ph = Math.max(1, Math.round(plotH));
		const image = context.createImageData(pw, ph);
		const data = image.data;
		let index = 0;

		for (let py = 0; py < ph; py += 1) {
			const rowCritRate = yToCR(PAD.top + py, geom);
			const alpha = Math.round(zeroCritProbability(rowCritRate, hits) * 210);

			for (let px = 0; px < pw; px += 1) {
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

	function buildIsolinePath(target: number, g: PlotGeometry) {
		let path = '';
		let firstPoint = true;
		const right = g.pad.left + plotWidth(g);

		for (let x = g.pad.left; x <= right; x += 2) {
			const critDamage = xToCD(x, g);
			const critRate = (target - 1) / critDamage;

			if (critRate < CR_MIN || critRate > CR_MAX) continue;

			const y = crToY(critRate, g);
			path += `${firstPoint ? 'M' : ' L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
			firstPoint = false;
		}

		return path;
	}

	// Labels sit just OUTSIDE the right plot edge (like the axis tick labels),
	// vertically centered on where their line exits; falls back to the top edge
	// if the line leaves the plot before reaching the right side.
	function buildIsolineLabel(target: number, g: PlotGeometry): IsolineData['label'] {
		const crAtRightEdge = (target - 1) / CD_MAX;

		if (crAtRightEdge >= CR_MIN && crAtRightEdge <= CR_MAX) {
			return {
				x: g.pad.left + plotWidth(g) + 8,
				y: crToY(crAtRightEdge, g) + 3.5,
				anchor: 'start'
			};
		}

		const cdAtTopEdge = (target - 1) / CR_MAX;
		if (cdAtTopEdge >= CD_MIN && cdAtTopEdge <= CD_MAX) {
			return { x: cdToX(cdAtTopEdge, g) + 4, y: g.pad.top + 14, anchor: 'start' };
		}

		return { x: g.pad.left + 8, y: g.pad.top + 12, anchor: 'start' };
	}

	// Traces the equal-CV budget line CR = (CV − CD) / 2 across the plot, same
	// stepping approach as the isoline paths.
	function buildCvLinePath(cvTarget: number, g: PlotGeometry) {
		let path = '';
		let firstPoint = true;
		const right = g.pad.left + plotWidth(g);

		for (let x = g.pad.left; x <= right; x += 2) {
			const cd = xToCD(x, g);
			const cr = cvLineCR(cvTarget, cd);

			if (cr < CR_MIN || cr > CR_MAX) continue;

			const y = crToY(cr, g);
			path += `${firstPoint ? 'M' : ' L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
			firstPoint = false;
		}

		return path;
	}

	// Places the CV label where the budget line enters the plot: at the left edge
	// when the line crosses it, otherwise where it descends from the top edge.
	function buildCvLineLabel(cvTarget: number, g: PlotGeometry) {
		const crAtLeftEdge = cvLineCR(cvTarget, CD_MIN);
		if (crAtLeftEdge >= CR_MIN && crAtLeftEdge <= CR_MAX) {
			return { x: g.pad.left + 8, y: crToY(crAtLeftEdge, g) - 8 };
		}

		const cdAtTopEdge = cvTarget - 2 * CR_MAX;
		if (cdAtTopEdge >= CD_MIN && cdAtTopEdge <= CD_MAX) {
			return { x: cdToX(cdAtTopEdge, g) + 8, y: g.pad.top + 16 };
		}

		return { x: g.pad.left + 8, y: g.pad.top + 16 };
	}

	// ── Pointer / drag handling ────────────────────────────────────────────────
	// Pointer capture on the SVG ensures dragging outside the element still tracks.

	function pointerToStats(event: PointerEvent) {
		if (!overlayEl) return null;

		const rect = overlayEl.getBoundingClientRect();
		const scaleX = boxW / rect.width;
		const scaleY = boxH / rect.height;
		const x = (event.clientX - rect.left) * scaleX;
		const y = (event.clientY - rect.top) * scaleY;

		return {
			critRate: clamp(yToCR(y, geom), CR_MIN, CR_MAX),
			critDamage: clamp(xToCD(x, geom), CD_MIN, CD_MAX)
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

	// ── Isolines ────────────────────────────────────────────────────────────────
	// Independent of the marker, but they DO depend on the box geometry, so they
	// rebuild when the chart is resized (cheap — a handful of short paths).
	const isolines = $derived(
		ISOLINE_VALUES.map((value) => ({
			value,
			path: buildIsolinePath(value, geom),
			label: buildIsolineLabel(value, geom)
		}))
	);

	// ── Effects ────────────────────────────────────────────────────────────────

	// Keep the drawn box in sync with the shell's measured size.
	$effect(() => {
		if (!shellEl) return;
		fitBox(shellEl.clientWidth, shellEl.clientHeight);
		const ro = new ResizeObserver((entries) => {
			const box = entries[0]?.contentRect;
			if (box) fitBox(box.width, box.height);
		});
		ro.observe(shellEl);
		return () => ro.disconnect();
	});

	// Redraw the heatmap when the box changes (drawHeatmap reads boxW/boxH/geom).
	$effect(() => {
		if (!canvasEl) return;
		drawHeatmap();
	});

	// Redraw variance overlay when the toggle, hit count, or box changes
	$effect(() => {
		if (!overlayCanvasEl) return;
		drawVarianceOverlay(showVariance, hitsPerRotation);
	});
</script>

<div class="cv-heatmap-shell" bind:this={shellEl}>
	<div class="cv-map-frame frame ctx-dark" style:width={`${boxW}px`} style:height={`${boxH}px`}>
		<!-- Layer 1: heatmap field (redrawn on resize via canvas 2D API). The buffer
		     size is set imperatively inside drawHeatmap, not via a reactive width=. -->
		<canvas bind:this={canvasEl} aria-hidden="true"></canvas>

		<!-- Layer 2: variance overlay (multiply blend darkens high-risk regions) -->
		<canvas bind:this={overlayCanvasEl} class="cv-overlay-canvas" aria-hidden="true"></canvas>

		<!-- Layer 3: SVG — isolines, axes, crosshairs, marker, tooltip (all reactive) -->
		<svg
			bind:this={overlayEl}
			viewBox={`0 0 ${boxW} ${boxH}`}
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
				width={plotW}
				height={plotH}
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
				<!-- Balanced-ratio diagonal + tangency: where this budget pays out best -->
				<line
					x1={cdToX(RATIO_CD0, geom)}
					y1={crToY(RATIO_CD0 / 2, geom)}
					x2={cdToX(RATIO_CD1, geom)}
					y2={crToY(RATIO_CD1 / 2, geom)}
					stroke={ink(0.3)}
					stroke-width="1"
					stroke-dasharray="7 5"
				/>
				<text
					x={cdToX(RATIO_CD1, geom) + 4}
					y={crToY(RATIO_CD1 / 2, geom) + 12}
					fill={ink(0.5)}
					font-size="10"
				>
					CD = 2×CR
				</text>
				<path d={cvPath} fill="none" stroke="var(--text)" stroke-width="1.6" opacity="0.85" />
				<text x={cvLabel.x} y={cvLabel.y} fill="var(--text)" font-size="10" font-weight="600">
					{Math.round(cv * 100)} CV
				</text>
				{#if tangentInPlot}
					<circle
						cx={cdToX(cv / 2, geom)}
						cy={crToY(cv / 4, geom)}
						r="5"
						fill="none"
						stroke="var(--text)"
						stroke-width="1.5"
					/>
					<text
						x={cdToX(cv / 2, geom) + 9}
						y={crToY(cv / 4, geom) - 8}
						fill={ink(0.75)}
						font-size="10"
					>
						best split of this budget
					</text>
				{/if}
			{/if}

			<!-- X-axis ticks and labels (Crit Damage) -->
			{#each CD_TICKS as tick (tick)}
				<line
					x1={cdToX(tick, geom)}
					y1={PAD.top + plotH}
					x2={cdToX(tick, geom)}
					y2={PAD.top + plotH + 6}
					stroke={ink(0.5)}
					stroke-width="1"
				/>
				<text
					x={cdToX(tick, geom)}
					y={PAD.top + plotH + 22}
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
					y1={crToY(tick, geom)}
					x2={PAD.left}
					y2={crToY(tick, geom)}
					stroke={ink(0.5)}
					stroke-width="1"
				/>
				<text
					x={PAD.left - 10}
					y={crToY(tick, geom) + 4}
					fill={ink(0.68)}
					font-size="11"
					text-anchor="end"
				>
					{Math.round(tick * 100)}%
				</text>
			{/each}

			<!-- Right-edge identity for the isoline column: the corner max plus a
			     rotated axis-style label (mirrors CRIT RATE on the left) -->
			<text x={PAD.left + plotW + 8} y={PAD.top + 10} fill={ink(0.62)} font-size="10"> 4.00x </text>
			<text
				x={boxW - 12}
				y={PAD.top + plotH / 2}
				fill={ink(0.56)}
				font-size="11"
				text-anchor="middle"
				letter-spacing="0.2em"
				transform={`rotate(90, ${boxW - 12}, ${PAD.top + plotH / 2})`}
			>
				AVERAGE DMG
			</text>

			<!-- Axis labels -->
			<text
				x={PAD.left + plotW / 2}
				y={boxH - 8}
				fill={ink(0.56)}
				font-size="11"
				text-anchor="middle"
				letter-spacing="0.2em"
			>
				CRIT DMG
			</text>
			<text
				x={18}
				y={PAD.top + plotH / 2}
				fill={ink(0.56)}
				font-size="11"
				text-anchor="middle"
				letter-spacing="0.2em"
				transform={`rotate(-90, 18, ${PAD.top + plotH / 2})`}
			>
				CRIT RATE
			</text>

			<!-- Crosshair lines extending from the marker to the axes -->
			<line
				x1={PAD.left}
				y1={dotY}
				x2={PAD.left + plotW}
				y2={dotY}
				stroke={ink(0.2)}
				stroke-width="1"
				stroke-dasharray="3 4"
			/>
			<line
				x1={dotX}
				y1={PAD.top}
				x2={dotX}
				y2={PAD.top + plotH}
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
	/* The shell is the box the chart measures itself against. Narrow/stacked tiles:
	   full-width with a width-derived square-ish height, capped so the chart doesn't
	   bury the controls below it. Wide tiles override it (below) to fill the tile's
	   own height. JS then fits the drawn frame inside whatever box this resolves to. */
	.cv-heatmap-shell {
		width: 100%;
		aspect-ratio: 1;
		max-height: 70svh;
		display: grid;
		place-items: center;
		/* The shell is sized BY the layout, never by the box it contains — on
		   BOTH axes. JS sets the drawn frame's width AND height inline in px, so
		   the shell's automatic minimums (min-width/min-height: auto = the
		   content's min-content) resolve to whatever the box measured LAST time.
		   Coming back from a wide lineup that stale box then wins: horizontally
		   the shell refuses to shrink and spills over the next instrument, and
		   vertically the stale height beats `aspect-ratio` — 765 and 875 are
		   both self-consistent, so the chart silently keeps the wide aspect.
		   Zeroing both lets width flow from the tile and height from the ratio;
		   the ResizeObserver below then refits the box into the result. */
		min-width: 0;
		min-height: 0;
	}

	/* The drawn rectangle. Its pixel size (boxW × boxH) is set inline by JS to fill
	   the shell at a clamped aspect; grid-centered so any letterbox is symmetric.
	   Interior fill + the animated Dire conic border both come from .frame;
	   the heatmap canvas fills the padding box opaquely, so no interior bg is needed. */
	.cv-map-frame {
		position: relative;
		border-radius: 9px;
		overflow: hidden;
		user-select: none;
		-webkit-user-select: none;
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
		font-family: var(--font-body);
	}

	/* Wide instrument container (the workspace tile, not the viewport): the shell
	   fills the tile's definite height instead of the narrow width-derived square,
	   giving JS a full rectangle to fit the chart into. */
	@container instrument (min-width: 60rem) {
		.cv-heatmap-shell {
			height: 100%;
			aspect-ratio: auto;
			max-height: none;
		}
	}
</style>
