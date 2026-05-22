<script lang="ts">
	import CritHeatmap from './lib/CritHeatmap.svelte';

	// Axis bounds — must match the constants in CritHeatmap.svelte
	const CR_MIN = 0.05;
	const CR_MAX = 1.0;
	const CD_MIN = 0.5;
	const CD_MAX = 3.0;

	// Isoline values used for the "nearest contour" readout in the build panel.
	// The heatmap has its own copy of this list for rendering; they should stay in sync.
	const ISOLINES = [1.3, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5];

	// Average damage multiplier: 1 + CR × CD (no clamping — sliders already constrain range)
	const averageDamageMultiplier = (critRate: number, critDamage: number) =>
		1 + critRate * critDamage;

	// User's current build stats, bound to both the heatmap marker and the sliders
	let myCR = $state(0.7);
	let myCD = $state(1.4);

	// Variance overlay controls
	let showVariance = $state(false);
	let hitsPerRotation = $state(8);

	// Derived display values
	const myMultiplier = $derived(averageDamageMultiplier(myCR, myCD));

	// Probability that zero crits land across a full rotation — used in the variance overlay readout
	const zeroCritProbability = $derived(
		Math.pow(1 - Math.min(myCR, 1), Math.max(1, Math.round(hitsPerRotation)))
	);

	// CD:CR ratio string (KQM convention: 2:1 is roughly the optimization target)
	const ratioText = $derived(myCR > 0 ? `${(myCD / myCR).toFixed(2)} : 1` : 'n/a');

	// The isoline value closest to the current multiplier, plus how far off it is
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

<section class="cv-page">
	<!-- Page header -->
	<div class="cv-intro">
		<p class="cv-intro-kicker">Tool</p>
		<h1 class="cv-intro-title">Crit Rate vs Crit Damage</h1>
		<p class="cv-intro-copy">
			This heatmap visualizes average damage multiplier using <code
				>1 + (Crit Rate × Crit Damage)</code
			>. Drag the marker on the chart or use sliders to evaluate your build and nearby tradeoff
			points.
		</p>
	</div>

	<!-- Main layout: heatmap on the left, stacked panels on the right -->
	<div class="cv-layout">
		<div class="cv-panel cv-heatmap-panel">
			<CritHeatmap bind:critRate={myCR} bind:critDamage={myCD} {showVariance} {hitsPerRotation} />
		</div>

		<div class="cv-panel-stack">
			<!-- Sliders panel: crit rate, crit damage, and optional variance controls -->
			<div class="cv-panel cv-slider-panel">
				<label class="cv-slider-control">
					<div class="cv-slider-header">
						<span class="cv-slider-label">Crit Rate</span>
						<span class="cv-slider-value">{pct(myCR)}</span>
					</div>
					<input
						type="range"
						min={CR_MIN}
						max={CR_MAX}
						step="0.005"
						bind:value={myCR}
						class="cv-slider-input"
					/>
				</label>
				<label class="cv-slider-control">
					<div class="cv-slider-header">
						<span class="cv-slider-label">Crit Damage</span>
						<span class="cv-slider-value">{pct(myCD)}</span>
					</div>
					<input
						type="range"
						min={CD_MIN}
						max={CD_MAX}
						step="0.01"
						bind:value={myCD}
						class="cv-slider-input"
					/>
				</label>

				<!-- Variance section: gated behind the toggle to keep the panel tidy by default -->
				<div class="cv-variance-controls">
					<label class="cv-variance-toggle">
						<input type="checkbox" bind:checked={showVariance} />
						Show no-crit risk overlay
					</label>

					{#if showVariance}
						<label class="cv-slider-control">
							<div class="cv-slider-header">
								<span class="cv-slider-label">Hits / Rotation</span>
								<span class="cv-slider-value">{hitsPerRotation}</span>
							</div>
							<input
								type="range"
								min="1"
								max="40"
								step="1"
								bind:value={hitsPerRotation}
								class="cv-slider-input cv-variance-slider"
							/>
						</label>
					{/if}
				</div>
			</div>

			<!-- Build readout: key stats for the current marker position -->
			<div class="cv-panel cv-build-panel">
				<p class="cv-panel-kicker">Current Build</p>
				<p class="cv-build-value">{myMultiplier.toFixed(3)}x</p>
				<p class="cv-build-meta">Crit Rate: <span class="cv-strong">{pct(myCR)}</span></p>
				<p class="cv-build-meta">Crit Damage: <span class="cv-strong">{pct(myCD)}</span></p>
				<p class="cv-build-meta">Ratio (CD:CR): <span class="cv-strong">{ratioText}</span></p>
				{#if showVariance}
					<p class="cv-build-meta">
						No-crit risk ({hitsPerRotation} hits):
						<span class="cv-strong">{(zeroCritProbability * 100).toFixed(1)}%</span>
					</p>
				{/if}
				<p class="cv-build-meta">
					Nearest contour: <span class="cv-strong">{nearestContour.value.toFixed(2)}x</span>
					(Delta {nearestContour.delta.toFixed(3)}x)
				</p>
			</div>

			<!-- Legend / guide copy -->
			<div class="cv-panel cv-notes-panel">
				<p class="cv-panel-kicker">Read Guide</p>
				<p class="cv-note-copy">
					Cool blue is lower average output; yellow/orange/red-purple indicates higher output.
				</p>
				<p class="cv-note-copy">
					Dashed isolines mark equal multiplier bands, making optimization tradeoffs easier to see.
				</p>
				{#if showVariance}
					<p class="cv-note-copy">
						Darker overlay areas indicate higher chance of zero crits across a rotation.
					</p>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.cv-page {
		display: grid;
		gap: 1.25rem;
	}

	/* ── Intro ─────────────────────────────────────────────────────────────── */

	.cv-intro {
		display: grid;
		gap: 0.75rem;
	}

	.cv-intro-kicker {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.cv-intro-title {
		margin: 0;
		font-size: 1.875rem;
		font-weight: 600;
		letter-spacing: -0.025em;
	}

	.cv-intro-copy {
		margin: 0;
		max-width: 56rem;
		font-size: 1rem;
		line-height: 1.75rem;
	}

	/* ── Layout ────────────────────────────────────────────────────────────── */

	.cv-layout {
		display: grid;
		gap: 1rem;
	}

	/* Stacked side panels (sliders, build readout, notes) */
	.cv-panel-stack {
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	/* ── Panels ────────────────────────────────────────────────────────────── */

	.cv-panel {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 0.8rem;
		background: var(--surface-raised);
	}

	.cv-heatmap-panel {
		padding: 0.9rem;
	}

	.cv-slider-panel {
		gap: 0.75rem;
	}

	/* ── Sliders ───────────────────────────────────────────────────────────── */

	.cv-slider-control {
		display: grid;
		gap: 0.5rem;
	}

	.cv-slider-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.875rem;
	}

	.cv-slider-label {
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.cv-slider-value {
		font-weight: 600;
	}

	.cv-slider-input {
		width: 100%;
		accent-color: var(--accent);
	}

	/* ── Variance controls ─────────────────────────────────────────────────── */

	.cv-variance-controls {
		display: grid;
		gap: 0.6rem;
		padding-top: 0.35rem;
		border-top: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
	}

	.cv-variance-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.78rem;
		color: var(--muted);
	}

	.cv-variance-toggle input {
		accent-color: var(--accent);
	}

	/* Color ramp on the hits/rotation slider mirrors the overlay intensity scale */
	.cv-variance-slider {
		background: linear-gradient(to right, #e63946, #f4a261, #f6d365, #4ecca3);
	}

	/* ── Build panel ───────────────────────────────────────────────────────── */

	.cv-build-panel {
		gap: 0.35rem;
	}

	.cv-panel-kicker {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.cv-build-value {
		margin: 0;
		font-size: 1.875rem;
		font-weight: 600;
	}

	.cv-build-meta {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5rem;
		color: var(--muted);
	}

	.cv-strong {
		font-weight: 600;
		color: var(--text);
	}

	/* ── Notes panel ───────────────────────────────────────────────────────── */

	.cv-notes-panel {
		align-content: start;
	}

	.cv-note-copy {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--muted);
	}

	/* ── Responsive ────────────────────────────────────────────────────────── */

	@media (min-width: 768px) {
		.cv-intro-title {
			font-size: 2.25rem;
		}

		.cv-panel {
			padding: 1.25rem;
		}
	}

	@media (min-width: 1024px) {
		/* Constrain the page to viewport height so the heatmap never scrolls off */
		.cv-page {
			height: calc(100svh - 4rem);
			grid-template-rows: auto minmax(0, 1fr);
		}

		.cv-layout {
			grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
			align-items: stretch;
			min-height: 0;
		}

		.cv-heatmap-panel {
			min-height: 0;
		}
	}
</style>
