<script lang="ts">
	const CR_MIN = 0.05;
	const CR_MAX = 1.0;
	const CD_MIN = 0.5;
	const CD_MAX = 3.0;

	const SIZE = 720;
	const PAD = { top: 24, right: 24, bottom: 64, left: 72 };
	const PLOT_WIDTH = SIZE - PAD.left - PAD.right;
	const PLOT_HEIGHT = SIZE - PAD.top - PAD.bottom;

	const ISOLINE_VALUES = [1.3, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5];
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
		critDamage = $bindable(1.4)
	}: { critRate?: number; critDamage?: number } = $props();

	let canvasEl: HTMLCanvasElement | null = null;
	let overlayEl: SVGSVGElement | null = null;
	let dragging = $state(false);

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

	const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

	const averageDamageMultiplier = (critRate: number, critDamage: number) =>
		1 + clamp(critRate, 0, 1) * Math.max(0, critDamage);

	const cdToX = (critDamage: number) =>
		PAD.left + ((critDamage - CD_MIN) / (CD_MAX - CD_MIN)) * PLOT_WIDTH;
	const crToY = (critRate: number) =>
		PAD.top + (1 - (critRate - CR_MIN) / (CR_MAX - CR_MIN)) * PLOT_HEIGHT;

	const xToCD = (x: number) => CD_MIN + ((x - PAD.left) / PLOT_WIDTH) * (CD_MAX - CD_MIN);
	const yToCR = (y: number) => CR_MIN + (1 - (y - PAD.top) / PLOT_HEIGHT) * (CR_MAX - CR_MIN);

	const dotX = $derived(cdToX(critDamage));
	const dotY = $derived(crToY(critRate));
	const dotMultiplier = $derived(averageDamageMultiplier(critRate, critDamage));

	const tooltip = $derived.by(() => {
		const width = 132;
		const height = 62;
		const margin = 12;
		const prefersLeft = dotX > PAD.left + PLOT_WIDTH * 0.72;
		let x = prefersLeft ? dotX - width - margin : dotX + margin;
		let y = dotY - height - margin;

		if (y < PAD.top + 4) {
			y = dotY + margin;
		}

		x = clamp(x, PAD.left + 4, PAD.left + PLOT_WIDTH - width - 4);
		y = clamp(y, PAD.top + 4, PAD.top + PLOT_HEIGHT - height - 4);

		return { x, y, width, height };
	});

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

	function drawHeatmap() {
		if (!canvasEl) {
			return;
		}

		const context = canvasEl.getContext('2d');
		if (!context) {
			return;
		}

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
		context.strokeStyle = 'rgba(255, 255, 255, 0.24)';
		context.lineWidth = 1;
		context.strokeRect(PAD.left + 0.5, PAD.top + 0.5, PLOT_WIDTH - 1, PLOT_HEIGHT - 1);
	}

	function buildIsolinePath(target: number) {
		let path = '';
		let firstPoint = true;

		for (let x = PAD.left; x <= PAD.left + PLOT_WIDTH; x += 2) {
			const critDamage = xToCD(x);
			const critRate = (target - 1) / critDamage;

			if (critRate < CR_MIN || critRate > CR_MAX) {
				continue;
			}

			const y = crToY(critRate);
			path += `${firstPoint ? 'M' : ' L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
			firstPoint = false;
		}

		return path;
	}

	function buildIsolineLabel(target: number): IsolineData['label'] {
		const rightBiasX = PAD.left + PLOT_WIDTH * 0.78;
		const critDamage = xToCD(rightBiasX);
		const critRate = (target - 1) / critDamage;

		if (critRate >= CR_MIN && critRate <= CR_MAX) {
			return { x: rightBiasX + 4, y: crToY(critRate) - 6, anchor: 'start' };
		}

		const maxRateDamage = (target - 1) / CR_MAX;
		if (maxRateDamage >= CD_MIN && maxRateDamage <= CD_MAX) {
			return { x: cdToX(maxRateDamage) + 4, y: PAD.top + 14, anchor: 'start' };
		}

		return { x: PAD.left + 8, y: PAD.top + 12, anchor: 'start' };
	}

	function pointerToStats(event: PointerEvent) {
		if (!overlayEl) {
			return null;
		}

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
		if (!stats) {
			return;
		}

		critRate = Number(stats.critRate.toFixed(3));
		critDamage = Number(stats.critDamage.toFixed(3));
	}

	function onPointerDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) {
			return;
		}
		dragging = true;
		updateFromPointer(event);
		overlayEl?.setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging) {
			return;
		}
		updateFromPointer(event);
	}

	function onPointerUp(event: PointerEvent) {
		dragging = false;
		if (overlayEl?.hasPointerCapture(event.pointerId)) {
			overlayEl.releasePointerCapture(event.pointerId);
		}
	}

	const isolines = ISOLINE_VALUES.map((value) => ({
		value,
		path: buildIsolinePath(value),
		label: buildIsolineLabel(value)
	}));

	$effect(() => {
		const nextCR = clamp(critRate, CR_MIN, CR_MAX);
		if (nextCR !== critRate) {
			critRate = nextCR;
		}

		const nextCD = clamp(critDamage, CD_MIN, CD_MAX);
		if (nextCD !== critDamage) {
			critDamage = nextCD;
		}
	});

	$effect(() => {
		if (!canvasEl) {
			return;
		}
		drawHeatmap();
	});
</script>

<div class="heatmap-shell">
	<div class="map-frame">
		<canvas bind:this={canvasEl} width={SIZE} height={SIZE} aria-hidden="true"></canvas>
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
			<rect
				x={PAD.left}
				y={PAD.top}
				width={PLOT_WIDTH}
				height={PLOT_HEIGHT}
				fill="none"
				stroke="rgba(255,255,255,0.15)"
				stroke-width="1"
			/>

			{#each isolines as isoline}
				{#if isoline.path}
					<path
						d={isoline.path}
						fill="none"
						stroke="rgba(255,255,255,0.34)"
						stroke-width="1.1"
						stroke-dasharray="5 4"
					/>
					<text
						x={isoline.label.x}
						y={isoline.label.y}
						fill="rgba(255,255,255,0.62)"
						font-size="10"
						font-family="'Noto Sans Variable', 'Noto Sans', sans-serif"
						text-anchor={isoline.label.anchor}
					>
						{isoline.value.toFixed(2)}x
					</text>
				{/if}
			{/each}

			{#each CD_TICKS as tick}
				<line
					x1={cdToX(tick)}
					y1={PAD.top + PLOT_HEIGHT}
					x2={cdToX(tick)}
					y2={PAD.top + PLOT_HEIGHT + 6}
					stroke="rgba(255,255,255,0.5)"
					stroke-width="1"
				/>
				<text
					x={cdToX(tick)}
					y={PAD.top + PLOT_HEIGHT + 22}
					fill="rgba(255,255,255,0.68)"
					font-size="11"
					font-family="'Noto Sans Variable', 'Noto Sans', sans-serif"
					text-anchor="middle"
				>
					{Math.round(tick * 100)}%
				</text>
			{/each}

			{#each CR_TICKS as tick}
				<line
					x1={PAD.left - 6}
					y1={crToY(tick)}
					x2={PAD.left}
					y2={crToY(tick)}
					stroke="rgba(255,255,255,0.5)"
					stroke-width="1"
				/>
				<text
					x={PAD.left - 10}
					y={crToY(tick) + 4}
					fill="rgba(255,255,255,0.68)"
					font-size="11"
					font-family="'Noto Sans Variable', 'Noto Sans', sans-serif"
					text-anchor="end"
				>
					{Math.round(tick * 100)}%
				</text>
			{/each}

			<text
				x={PAD.left + PLOT_WIDTH / 2}
				y={SIZE - 8}
				fill="rgba(255,255,255,0.56)"
				font-size="11"
				font-family="'Noto Sans Variable', 'Noto Sans', sans-serif"
				text-anchor="middle"
				letter-spacing="0.2em"
			>
				CRIT DMG
			</text>
			<text
				x={18}
				y={PAD.top + PLOT_HEIGHT / 2}
				fill="rgba(255,255,255,0.56)"
				font-size="11"
				font-family="'Noto Sans Variable', 'Noto Sans', sans-serif"
				text-anchor="middle"
				letter-spacing="0.2em"
				transform={`rotate(-90, 18, ${PAD.top + PLOT_HEIGHT / 2})`}
			>
				CRIT RATE
			</text>

			<line
				x1={PAD.left}
				y1={dotY}
				x2={PAD.left + PLOT_WIDTH}
				y2={dotY}
				stroke="rgba(255,255,255,0.2)"
				stroke-width="1"
				stroke-dasharray="3 4"
			/>
			<line
				x1={dotX}
				y1={PAD.top}
				x2={dotX}
				y2={PAD.top + PLOT_HEIGHT}
				stroke="rgba(255,255,255,0.2)"
				stroke-width="1"
				stroke-dasharray="3 4"
			/>

			<circle cx={dotX} cy={dotY} r="17" fill="rgba(255,255,255,0.08)" />
			<circle cx={dotX} cy={dotY} r="8" fill="#f7fafc" stroke="rgba(0,0,0,0.35)" stroke-width="2" />

			<rect
				x={tooltip.x}
				y={tooltip.y}
				width={tooltip.width}
				height={tooltip.height}
				rx="7"
				fill="rgba(5, 10, 24, 0.82)"
				stroke="rgba(255,255,255,0.22)"
				stroke-width="1"
			/>
			<text
				x={tooltip.x + 10}
				y={tooltip.y + 17}
				fill="rgba(255,255,255,0.72)"
				font-size="10"
				font-family="'Noto Sans Variable', 'Noto Sans', sans-serif"
			>
				CR {(critRate * 100).toFixed(1)}%
			</text>
			<text
				x={tooltip.x + 10}
				y={tooltip.y + 33}
				fill="rgba(255,255,255,0.72)"
				font-size="10"
				font-family="'Noto Sans Variable', 'Noto Sans', sans-serif"
			>
				CD {(critDamage * 100).toFixed(1)}%
			</text>
			<text
				x={tooltip.x + 10}
				y={tooltip.y + 51}
				fill="white"
				font-size="13"
				font-weight="700"
				font-family="'Noto Sans Variable', 'Noto Sans', sans-serif"
			>
				{dotMultiplier.toFixed(3)}x
			</text>
		</svg>
	</div>
</div>

<style>
	.heatmap-shell {
		width: 100%;
		display: grid;
		place-items: center;
	}

	.map-frame {
		position: relative;
		width: min(100%, 100svh);
		aspect-ratio: 1;
		border-radius: 1rem;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--text) 18%, transparent);
		background:
			radial-gradient(circle at 12% 0%, rgba(38, 102, 214, 0.2), transparent 45%),
			radial-gradient(circle at 100% 100%, rgba(188, 55, 119, 0.2), transparent 42%), #081225;
	}

	canvas,
	svg {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
	}

	svg {
		touch-action: none;
		user-select: none;
	}

	@media (min-width: 1024px) {
		.heatmap-shell {
			height: 100%;
			container-type: size;
		}

		@supports (width: 1cqh) {
			.map-frame {
				width: min(100%, 100cqh, 100svh);
			}
		}
	}
</style>
