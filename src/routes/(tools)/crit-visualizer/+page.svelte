<script lang="ts">
	import CritTable from './lib/CritTable.svelte';
	import { averageDamageMultiplier, getTier } from './lib/crit-data';

	let myCR = $state(0.7);
	let myCD = $state(1.4);
	let showOnlyMyTierAndAbove = $state(false);
	let showCurveGuide = $state(true);

	const myMultiplier = $derived(averageDamageMultiplier(myCR, myCD));
	const myTier = $derived(getTier(myMultiplier));
	const minVisibleMultiplier = $derived(showOnlyMyTierAndAbove ? myTier.min : null);

	const pct = (value: number) => `${Math.round(value * 100)}%`;
</script>

<svelte:head>
	<title>Crit ratio visualizer | critcalc.app</title>
</svelte:head>

<section class="crit-page">
	<div class="intro">
		<p class="intro-kicker">Tool</p>
		<h1 class="intro-title">Crit Rate vs Crit Damage</h1>
		<p class="intro-copy">
			This chart compares average damage multipliers using
			<code>1 + (Crit Rate × Crit Damage)</code>. Use the sliders to match your build, then inspect nearby
			cells for stronger balance points.
		</p>
	</div>

	<div class="controls-grid">
		<div class="panel slider-panel">
			<label class="slider-control">
				<div class="slider-header">
					<span class="slider-label">Crit Rate</span>
					<span class="slider-value">{pct(myCR)}</span>
				</div>
				<input type="range" min="0.1" max="1" step="0.01" bind:value={myCR} class="slider-input" />
			</label>
			<label class="slider-control">
				<div class="slider-header">
					<span class="slider-label">Crit Damage</span>
					<span class="slider-value">{pct(myCD)}</span>
				</div>
				<input type="range" min="0.5" max="3" step="0.01" bind:value={myCD} class="slider-input" />
			</label>
		</div>

		<div class="panel build-panel">
			<p class="panel-kicker">Current Build</p>
			<p class="build-value">{myMultiplier.toFixed(2)}x</p>
			<p class="build-meta">Tier: <span class="strong">{myTier.label}</span></p>
			<p class="build-meta">Approx ratio: <span class="strong">{(myCD / myCR).toFixed(2)} : 1</span></p>
		</div>

		<div class="panel options-panel">
			<label class="toggle-option">
				<input type="checkbox" bind:checked={showCurveGuide} />
				Show 1:2 ratio guide
			</label>
			<label class="toggle-option">
				<input type="checkbox" bind:checked={showOnlyMyTierAndAbove} />
				Show only my tier and above
			</label>
		</div>
	</div>

	<div class="panel table-panel">
		<CritTable
			highlightCR={myCR}
			highlightCD={myCD}
			minVisibleMultiplier={minVisibleMultiplier}
			showCurve={showCurveGuide}
		/>
	</div>
</section>

<style>
	.crit-page {
		display: grid;
		gap: 2rem;
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

	.controls-grid {
		display: grid;
		gap: 1rem;
	}

	.panel {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--surface-raised);
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

	.build-panel {
		gap: 0.5rem;
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
	}

	.strong {
		font-weight: 600;
	}

	.options-panel {
		gap: 0.75rem;
	}

	.toggle-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.table-panel {
		gap: 1rem;
		padding: 1rem;
	}

	@media (min-width: 768px) {
		.intro-title {
			font-size: 2.25rem;
		}

		.panel {
			padding: 1.25rem;
		}

		.table-panel {
			padding: 1.5rem;
		}
	}

	@media (min-width: 1024px) {
		.controls-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.slider-panel {
			grid-column: span 2;
		}
	}
</style>
