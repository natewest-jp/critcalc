<script lang="ts">
	import CritHeatmap from './lib/CritHeatmap.svelte';

	const CR_MIN = 0.05;
	const CR_MAX = 1.0;
	const CD_MIN = 0.5;
	const CD_MAX = 3.0;
	const ISOLINES = [1.3, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5];
	const averageDamageMultiplier = (critRate: number, critDamage: number) =>
		1 + critRate * critDamage;

	let myCR = $state(0.7);
	let myCD = $state(1.4);
	let showVariance = $state(false);
	let hitsPerRotation = $state(8);

	const myMultiplier = $derived(averageDamageMultiplier(myCR, myCD));
	const zeroCritProbability = $derived(
		Math.pow(1 - Math.min(myCR, 1), Math.max(1, Math.round(hitsPerRotation)))
	);
	const ratioText = $derived(myCR > 0 ? `${(myCD / myCR).toFixed(2)} : 1` : 'n/a');
	const nearestContour = $derived.by(() => {
		let best = ISOLINES[0];
		let distance = Math.abs(myMultiplier - best);

		for (const isoline of ISOLINES) {
			const nextDistance = Math.abs(myMultiplier - isoline);
			if (nextDistance < distance) {
				best = isoline;
				distance = nextDistance;
			}
		}

		return { value: best, delta: distance };
	});

	const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
</script>

<svelte:head>
	<title>Crit ratio visualizer | critcalc.app</title>
</svelte:head>

<section class="crit-page">
	<div class="intro">
		<p class="intro-kicker">Tool</p>
		<h1 class="intro-title">Crit Rate vs Crit Damage</h1>
		<p class="intro-copy">
			This heatmap visualizes average damage multiplier using <code
				>1 + (Crit Rate × Crit Damage)</code
			>. Drag the marker on the chart or use sliders to evaluate your build and nearby tradeoff
			points.
		</p>
	</div>

	<div class="viz-layout">
		<div class="panel heatmap-panel">
			<CritHeatmap bind:critRate={myCR} bind:critDamage={myCD} {showVariance} {hitsPerRotation} />
		</div>

		<div class="tile-stack">
			<div class="panel slider-panel">
				<label class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Crit Rate</span>
						<span class="slider-value">{pct(myCR)}</span>
					</div>
					<input
						type="range"
						min={CR_MIN}
						max={CR_MAX}
						step="0.005"
						bind:value={myCR}
						class="slider-input"
					/>
				</label>
				<label class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Crit Damage</span>
						<span class="slider-value">{pct(myCD)}</span>
					</div>
					<input
						type="range"
						min={CD_MIN}
						max={CD_MAX}
						step="0.01"
						bind:value={myCD}
						class="slider-input"
					/>
				</label>

				<div class="variance-controls">
					<label class="variance-toggle">
						<input type="checkbox" bind:checked={showVariance} />
						Show no-crit risk overlay
					</label>

					{#if showVariance}
						<label class="slider-control">
							<div class="slider-header">
								<span class="slider-label">Hits / Rotation</span>
								<span class="slider-value">{hitsPerRotation}</span>
							</div>
							<input
								type="range"
								min="1"
								max="40"
								step="1"
								bind:value={hitsPerRotation}
								class="slider-input variance-slider"
							/>
						</label>
					{/if}
				</div>
			</div>

			<div class="panel build-panel">
				<p class="panel-kicker">Current Build</p>
				<p class="build-value">{myMultiplier.toFixed(3)}x</p>
				<p class="build-meta">Crit Rate: <span class="strong">{pct(myCR)}</span></p>
				<p class="build-meta">Crit Damage: <span class="strong">{pct(myCD)}</span></p>
				<p class="build-meta">Ratio (CD:CR): <span class="strong">{ratioText}</span></p>
				{#if showVariance}
					<p class="build-meta">
						No-crit risk ({hitsPerRotation} hits):
						<span class="strong">{(zeroCritProbability * 100).toFixed(1)}%</span>
					</p>
				{/if}
				<p class="build-meta">
					Nearest contour: <span class="strong">{nearestContour.value.toFixed(2)}x</span>
					(Delta {nearestContour.delta.toFixed(3)}x)
				</p>
			</div>

			<div class="panel notes-panel">
				<p class="panel-kicker">Read Guide</p>
				<p class="note-copy">
					Cool blue is lower average output; yellow/orange/red-purple indicates higher output.
				</p>
				<p class="note-copy">
					Dashed isolines mark equal multiplier bands, making optimization tradeoffs easier to see.
				</p>
				{#if showVariance}
					<p class="note-copy">
						Darker overlay areas indicate higher chance of zero crits across a rotation.
					</p>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.crit-page {
		display: grid;
		gap: 1.25rem;
	}

	.intro {
		display: grid;
		gap: 0.75rem;
	}

	.intro-kicker {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.intro-title {
		margin: 0;
		font-size: 1.875rem;
		font-weight: 600;
		letter-spacing: -0.025em;
	}

	.intro-copy {
		margin: 0;
		max-width: 56rem;
		font-size: 1rem;
		line-height: 1.75rem;
	}

	.viz-layout {
		display: grid;
		gap: 1rem;
	}

	.tile-stack {
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	.panel {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 0.8rem;
		background: var(--surface-raised);
	}

	.heatmap-panel {
		padding: 0.9rem;
	}

	.slider-panel {
		gap: 0.75rem;
	}

	.slider-control {
		display: grid;
		gap: 0.5rem;
	}

	.slider-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.875rem;
	}

	.slider-label {
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.slider-value {
		font-weight: 600;
	}

	.slider-input {
		width: 100%;
		accent-color: var(--accent);
	}

	.variance-controls {
		display: grid;
		gap: 0.6rem;
		padding-top: 0.35rem;
		border-top: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
	}

	.variance-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.78rem;
		color: var(--muted);
	}

	.variance-toggle input {
		accent-color: var(--accent);
	}

	.variance-slider {
		background: linear-gradient(to right, #e63946, #f4a261, #f6d365, #4ecca3);
	}

	.build-panel {
		gap: 0.35rem;
	}

	.panel-kicker {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.build-value {
		margin: 0;
		font-size: 1.875rem;
		font-weight: 600;
	}

	.build-meta {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5rem;
		color: var(--muted);
	}

	.strong {
		font-weight: 600;
		color: var(--text);
	}

	.notes-panel {
		align-content: start;
	}

	.note-copy {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--muted);
	}

	@media (min-width: 768px) {
		.intro-title {
			font-size: 2.25rem;
		}

		.panel {
			padding: 1.25rem;
		}
	}

	@media (min-width: 1024px) {
		.crit-page {
			height: calc(100svh - 4rem);
			grid-template-rows: auto minmax(0, 1fr);
		}

		.viz-layout {
			grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
			align-items: stretch;
			min-height: 0;
		}

		.heatmap-panel {
			min-height: 0;
		}
	}
</style>
