<script lang="ts">
	import CritHeatmap from './lib/CritHeatmap.svelte';
	import {
		CR_MIN,
		CR_MAX,
		CD_MIN,
		CD_MAX,
		averageDamageMultiplier,
		zeroCritProbability,
		nearestIsoline,
		critValue,
		riskRampGradient
	} from './lib/crit';

	// User's current build stats, bound to both the heatmap marker and the sliders
	let myCR = $state(0.7);
	let myCD = $state(1.4);

	// Variance overlay controls
	let showVariance = $state(false);
	let hitsPerRotation = $state(8);

	// Crit-value budget line overlay (on by default — it's the tool's core pedagogy)
	let showCvLine = $state(true);

	// A second, pinned build for eyeballing a trade (e.g. circlet swap) — no verdict, just two markers
	let pinned = $state<{ critRate: number; critDamage: number } | null>(null);

	// Derived display values
	const myMultiplier = $derived(averageDamageMultiplier(myCR, myCD));

	// Probability that zero crits land across a full rotation — used in the variance overlay readout
	const zeroCritRisk = $derived(zeroCritProbability(myCR, hitsPerRotation));

	// CD:CR ratio string (KQM convention: 2:1 is roughly the optimization target)
	const ratioText = $derived(myCR > 0 ? `${(myCD / myCR).toFixed(2)} : 1` : 'n/a');

	// The isoline value closest to the current multiplier, plus how far off it is
	const nearestContour = $derived(nearestIsoline(myMultiplier));

	// Total crit value of the current build, in display units (e.g. 280)
	const myCV = $derived(Math.round(critValue(myCR, myCD) * 100));

	const pinnedMultiplier = $derived(
		pinned ? averageDamageMultiplier(pinned.critRate, pinned.critDamage) : 0
	);
	const pinnedDelta = $derived(myMultiplier - pinnedMultiplier);

	const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
</script>

<svelte:head>
	<title>Crit ratio visualizer | critcalc.app</title>
</svelte:head>

<section class="cv-page">
	<!-- Page header -->
	<div class="cv-intro">
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
			<CritHeatmap
				bind:critRate={myCR}
				bind:critDamage={myCD}
				{showVariance}
				{hitsPerRotation}
				{showCvLine}
				{pinned}
			/>
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

				<!-- Overlay toggles: CV budget line + variance section -->
				<div class="cv-variance-controls">
					<label class="cv-variance-toggle">
						<input type="checkbox" bind:checked={showCvLine} />
						Show crit value line
					</label>
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
								style:background={riskRampGradient}
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
				<p class="cv-build-meta">Crit Value: <span class="cv-strong">{myCV} CV</span></p>
				{#if showVariance}
					<p class="cv-build-meta">
						No-crit risk ({hitsPerRotation} hits):
						<span class="cv-strong">{(zeroCritRisk * 100).toFixed(1)}%</span>
					</p>
				{/if}
				<p class="cv-build-meta">
					Nearest contour: <span class="cv-strong">{nearestContour.value.toFixed(2)}x</span>
					(Delta {nearestContour.delta.toFixed(3)}x)
				</p>

				<!-- Pin: freeze a second marker to eyeball a trade against -->
				{#if pinned}
					<div class="cv-pin-readout">
						<p class="cv-build-meta">
							Pinned: <span class="cv-strong"
								>{pct(pinned.critRate)} / {pct(pinned.critDamage)}</span
							>
							— <span class="cv-strong">{pinnedMultiplier.toFixed(3)}x</span>
						</p>
						<p class="cv-build-meta">
							Vs pinned:
							<span class="cv-strong">{pinnedDelta >= 0 ? '+' : ''}{pinnedDelta.toFixed(3)}x</span>
						</p>
						<button class="cv-pin-button" onclick={() => (pinned = null)}>Clear pin</button>
					</div>
				{:else}
					<button
						class="cv-pin-button"
						onclick={() => (pinned = { critRate: myCR, critDamage: myCD })}
					>
						Pin this build
					</button>
				{/if}
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
				{#if showCvLine}
					<p class="cv-note-copy">
						The solid blue line traces every build sharing your total crit value — drag along it to
						see where a fixed stat budget pays out best.
					</p>
				{/if}
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

	/* ── Pin ───────────────────────────────────────────────────────────────── */

	.cv-pin-readout {
		display: grid;
		gap: 0.35rem;
		padding-top: 0.35rem;
		border-top: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
	}

	.cv-pin-button {
		justify-self: start;
		margin-top: 0.25rem;
		padding: 0.4rem 0.9rem;
		border: none;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--accent) 22%, var(--surface));
		color: var(--text);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}

	.cv-pin-button:hover {
		background: color-mix(in srgb, var(--accent) 32%, var(--surface));
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
		/* Constrain the page to viewport height so the heatmap never scrolls off.
		   Padding vars come from the (tools) shell (Dire border edge zones). */
		.cv-page {
			height: calc(100svh - var(--tool-pad-top, 2rem) - var(--tool-pad-bottom, 2rem));
			grid-template-rows: auto minmax(0, 1fr);
		}

		.cv-layout {
			grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
			/* Cap the single row at the layout's own height — without this the row
			   auto-sizes to the panel stack's content and overflows the viewport */
			grid-template-rows: minmax(0, 1fr);
			align-items: stretch;
			min-height: 0;
		}

		.cv-heatmap-panel {
			min-height: 0;
		}

		/* If the stack outgrows the viewport-capped row, scroll it internally
		   rather than pushing the page taller */
		.cv-panel-stack {
			min-height: 0;
			overflow-y: auto;
		}
	}
</style>
