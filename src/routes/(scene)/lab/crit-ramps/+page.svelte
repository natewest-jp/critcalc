<script lang="ts">
	/**
	 * THE CRIT HEATMAP'S RAMPS (the stage round, 2026-11-03). The design record
	 * flags the rainbow for Nate's eye: its lightness climbs to the yellow at
	 * ×2.8 and then falls toward the purple, so the lightest band reads as a
	 * ridge, a boundary in a field that has none. Each rival here climbs in
	 * lightness from ×1 to ×4 and never turns back. Same field, same marks,
	 * same B-spline (critRamp.ts), so only the colours differ. Local state only.
	 */
	import {
		buildRampLut,
		rampAt,
		toOklab,
		RAMP_LUT_SIZE,
		type RGB
	} from '../../(tools)/visualizers/lib/critRamp';

	const hex = (h: string): RGB => [
		parseInt(h.slice(1, 3), 16),
		parseInt(h.slice(3, 5), 16),
		parseInt(h.slice(5, 7), 16)
	];

	type Ramp = { id: string; name: string; note: string; stops: readonly RGB[] };
	const RAMPS: Ramp[] = [
		{
			id: 'current',
			name: 'Current rainbow',
			note: 'Lightness peaks at ×2.8 and falls after it.',
			stops: [
				[12, 24, 74],
				[22, 78, 148],
				[20, 140, 150],
				[48, 182, 104],
				[188, 212, 46],
				[240, 152, 36],
				[208, 52, 72],
				[138, 30, 138]
			]
		},
		{
			id: 'unfolded',
			name: 'A: the rainbow, unfolded',
			note: 'The same blues, teal, green and yellow; past the yellow it goes pale instead of orange, red and purple.',
			stops: [
				[12, 24, 74],
				[22, 78, 148],
				[20, 140, 150],
				[48, 182, 104],
				[188, 212, 46],
				[246, 232, 120],
				[252, 246, 206]
			]
		},
		{
			id: 'viridis',
			name: 'B: viridis',
			note: 'The standard even ramp of scientific plotting: violet, blue, green, yellow.',
			stops: [
				'#440154',
				'#482878',
				'#3e4989',
				'#31688e',
				'#26828e',
				'#1f9e89',
				'#35b779',
				'#6ece58',
				'#b5de2b',
				'#fde725'
			].map(hex)
		},
		{
			id: 'gold',
			name: 'C: night to gold',
			note: 'From the night’s navy through violet and rose to gold and cream, like magma or plasma.',
			stops: [
				'#0c184a',
				'#2b2f7e',
				'#59388f',
				'#8e3f86',
				'#c2506a',
				'#e57a45',
				'#f3ac3c',
				'#f8dc7a',
				'#fdf6d8'
			].map(hex)
		},
		{
			id: 'ice',
			name: 'D: ice',
			note: 'One family, navy to blue to pale cyan: the quietest, with the least hue to read by.',
			stops: ['#0c184a', '#173a7e', '#1f61a4', '#2a8bbd', '#4cb3c9', '#8ad4d6', '#d4f0ec'].map(hex)
		}
	];

	// The stage's field: CRIT Rate 0–100% up, CRIT DMG 50–300% across, ×1 to ×4.
	const W = 420;
	const H = 320;
	const CR0 = 0;
	const CR1 = 1;
	const CD0 = 0.5;
	const CD1 = 3;
	const x = (cd: number) => ((cd - CD0) / (CD1 - CD0)) * W;
	const y = (cr: number) => (1 - (cr - CR0) / (CR1 - CR0)) * H;
	const ISO = [1.3, 1.5, 1.75, 2, 2.5, 3, 3.5];

	let shading = $state(false);
	let hits = $state(8);
	let showMarks = $state(true);

	function isoPath(m: number) {
		let d = '';
		for (let px = 0; px <= W; px += 2) {
			const cd = CD0 + (px / W) * (CD1 - CD0);
			const cr = (m - 1) / cd;
			if (cr < CR0 || cr > CR1) continue;
			d += `${d ? ' L' : 'M'}${px},${y(cr).toFixed(1)}`;
		}
		return d;
	}

	function paint(
		canvas: HTMLCanvasElement,
		params: { stops: readonly RGB[]; shading: boolean; hits: number }
	) {
		const draw = ({ stops, shading, hits }: typeof params) => {
			canvas.width = W;
			canvas.height = H;
			const ctx = canvas.getContext('2d')!;
			const lut = buildRampLut(stops);
			const img = ctx.createImageData(W, H);
			let i = 0;
			for (let py = 0; py < H; py++) {
				const cr = CR1 - (py / H) * (CR1 - CR0);
				const dark = shading ? 1 - (Math.pow(1 - cr, hits) * 210) / 255 : 1;
				for (let px = 0; px < W; px++) {
					const cd = CD0 + (px / W) * (CD1 - CD0);
					const t = Math.min(1, Math.max(0, (cr * cd) / 3));
					const k = Math.round(t * (RAMP_LUT_SIZE - 1)) * 3;
					img.data[i++] = lut[k] * dark;
					img.data[i++] = lut[k + 1] * dark;
					img.data[i++] = lut[k + 2] * dark;
					img.data[i++] = 255;
				}
			}
			ctx.putImageData(img, 0, 0);
		};
		draw(params);
		return { update: draw };
	}

	/** The ramp's OKLab lightness from ×1 to ×4, as a path over the bar. */
	function lightnessPath(stops: readonly RGB[], w: number, h: number) {
		let d = '';
		for (let i = 0; i <= 60; i++) {
			const L = toOklab(rampAt(stops, i / 60) as RGB)[0];
			d += `${i ? ' L' : 'M'}${((i / 60) * w).toFixed(1)},${(h - L * h).toFixed(1)}`;
		}
		return d;
	}
	const barGradient = (stops: readonly RGB[]) =>
		`linear-gradient(to right, ${Array.from({ length: 25 }, (_, i) => {
			const [r, g, b] = rampAt(stops, i / 24);
			return `rgb(${r} ${g} ${b}) ${((i / 24) * 100).toFixed(1)}%`;
		}).join(', ')})`;
</script>

<div class="lab-ramps">
	<header>
		<h1>Crit heatmap: colour ramps</h1>
		<p>
			The same field five times: CRIT Rate 0–100% up, CRIT DMG 50–300% across, ×1 to ×4. The bar
			under each is the ramp from ×1 to ×4, with its lightness drawn over it. The current one rises
			and then falls, and its lightest band, at ×2.8, is the ridge. A to D only rise.
		</p>
		<div class="lab-controls">
			<label class="check">
				<input type="checkbox" bind:checked={showMarks} /><span class="check-box"></span>
				Contours, the 1:2 line and a build at 70% / 140%
			</label>
			<label class="check">
				<input type="checkbox" bind:checked={shading} /><span class="check-box"></span>
				No-crit shading at {hits} hits
			</label>
			<input
				class="slider lab-hits"
				type="range"
				min="1"
				max="40"
				bind:value={hits}
				aria-label="Hits"
			/>
		</div>
	</header>

	<div class="lab-grid">
		{#each RAMPS as r (r.id)}
			<figure class="ctx-dark">
				<figcaption><strong>{r.name}</strong><span>{r.note}</span></figcaption>
				<div class="lab-field" style:width="{W}px" style:height="{H}px">
					<canvas use:paint={{ stops: r.stops, shading, hits }}></canvas>
					{#if showMarks}
						<svg width={W} height={H} aria-hidden="true">
							{#each ISO as m (m)}
								<path
									d={isoPath(m)}
									fill="none"
									stroke="rgba(255,255,255,.34)"
									stroke-width="1.1"
									stroke-dasharray="5 4"
								/>
							{/each}
							<line
								x1={x(0.5)}
								y1={y(0.25)}
								x2={x(2)}
								y2={y(1)}
								stroke="rgba(255,255,255,.3)"
								stroke-dasharray="7 5"
							/>
							<path
								d={`M${x(0.8)},${y(1)} L${x(2.8)},${y(0)}`}
								fill="none"
								stroke="rgba(255,255,255,.85)"
								stroke-width="1.6"
							/>
							<circle
								cx={x(1.4)}
								cy={y(0.7)}
								r="8"
								fill="#fff"
								stroke="rgba(0,0,0,.35)"
								stroke-width="2"
							/>
						</svg>
					{/if}
				</div>
				<div class="lab-bar" style:background-image={barGradient(r.stops)}>
					<svg width={W} height="36" aria-hidden="true">
						<path
							d={lightnessPath(r.stops, W, 36)}
							fill="none"
							stroke="#000"
							stroke-width="3"
							stroke-opacity=".5"
						/>
						<path d={lightnessPath(r.stops, W, 36)} fill="none" stroke="#fff" stroke-width="1.5" />
					</svg>
				</div>
				<div class="lab-bar-axis"><span>×1</span><span>×2.5</span><span>×4</span></div>
			</figure>
		{/each}
	</div>
</div>

<style>
	.lab-ramps {
		padding: 5rem 2rem 4rem;
		max-width: 100rem;
		margin: 0 auto;
		color: var(--text);
	}
	h1 {
		margin: 0 0 0.5rem;
		font-size: var(--fs-3xl);
	}
	header p {
		max-width: 70ch;
		color: var(--chart-ink);
	}
	.lab-controls {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 2rem;
		margin: 1rem 0 2rem;
	}
	.lab-hits {
		width: 12rem;
	}
	.lab-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 2.5rem 2rem;
	}
	figure {
		margin: 0;
		background: none;
	}
	figcaption {
		display: grid;
		gap: 0.2rem;
		width: 420px;
		min-height: 3.6rem;
		margin-bottom: 0.6rem;
		font-size: var(--fs-md);
		color: var(--chart-ink);
	}
	figcaption strong {
		font-size: var(--fs-lg);
		color: var(--text);
	}
	.lab-field {
		position: relative;
		border-radius: var(--r-sm);
		overflow: hidden;
	}
	.lab-field canvas,
	.lab-field svg {
		position: absolute;
		inset: 0;
	}
	.lab-bar {
		margin-top: 0.75rem;
		width: 420px;
		height: 36px;
		border-radius: var(--r-xs);
	}
	.lab-bar svg {
		display: block;
	}
	.lab-bar-axis {
		display: flex;
		justify-content: space-between;
		width: 420px;
		margin-top: 0.2rem;
		font-size: var(--fs-sm);
		color: var(--chart-ink);
	}
</style>
