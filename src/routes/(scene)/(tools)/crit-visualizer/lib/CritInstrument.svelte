<script lang="ts">
	import CritHeatmap from './CritHeatmap.svelte';
	import {
		CR_MIN,
		CR_MAX,
		CD_MIN,
		CD_MAX,
		clamp,
		averageDamageMultiplier,
		zeroCritProbability,
		nearestIsoline,
		critValue,
		riskRampGradient
	} from './crit';

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

	// ── Editable stat fields (two-way with the sliders) ────────────────────────
	// The number inputs display percent units, one-way bound from state so slider
	// drags update them live. While typing, any parseable value commits (clamped)
	// without rewriting the field; onchange (blur/Enter) normalizes the display —
	// covering emptied fields and out-of-range entries that clamp to an unchanged
	// state value (no rerender to fix the text).
	const crPct = $derived(Number((myCR * 100).toFixed(1)));
	const cdPct = $derived(Number((myCD * 100).toFixed(1)));

	function commitStat(raw: string, min: number, max: number, apply: (v: number) => void) {
		const value = Number(raw);
		if (!Number.isFinite(value) || raw.trim() === '') return;
		apply(clamp(value / 100, min, max));
	}
</script>

<div class="cv-instrument">
	<!-- Heatmap floating on the dark field left, stacked panels right (wide
	     containers); single column when the tile is narrow. -->
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
				<div class="cv-slider-control">
					<div class="cv-slider-header">
						<span class="cv-slider-label">Crit Rate</span>
						<span class="cv-value-field">
							<input
								class="cv-value-input"
								type="number"
								min={CR_MIN * 100}
								max={CR_MAX * 100}
								step="0.5"
								value={crPct}
								oninput={(e) =>
									commitStat(e.currentTarget.value, CR_MIN, CR_MAX, (v) => (myCR = v))}
								onchange={(e) => (e.currentTarget.value = String(crPct))}
								aria-label="Crit rate percent"
							/><span class="cv-value-unit">%</span>
						</span>
					</div>
					<input
						type="range"
						min={CR_MIN}
						max={CR_MAX}
						step="0.005"
						bind:value={myCR}
						class="cv-slider-input"
						aria-label="Crit rate"
					/>
				</div>
				<div class="cv-slider-control">
					<div class="cv-slider-header">
						<span class="cv-slider-label">Crit Damage</span>
						<span class="cv-value-field">
							<input
								class="cv-value-input"
								type="number"
								min={CD_MIN * 100}
								max={CD_MAX * 100}
								step="1"
								value={cdPct}
								oninput={(e) =>
									commitStat(e.currentTarget.value, CD_MIN, CD_MAX, (v) => (myCD = v))}
								onchange={(e) => (e.currentTarget.value = String(cdPct))}
								aria-label="Crit damage percent"
							/><span class="cv-value-unit">%</span>
						</span>
					</div>
					<input
						type="range"
						min={CD_MIN}
						max={CD_MAX}
						step="0.01"
						bind:value={myCD}
						class="cv-slider-input"
						aria-label="Crit damage"
					/>
				</div>

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
		</div>
	</div>
</div>

<style>
	/* The instrument adapts to its TILE via container queries (not the viewport
	   — a half-width tile on a wide monitor gets the narrow layout). inline-size
	   containment only: size containment would collapse indefinite heights. */
	.cv-instrument {
		height: 100%;
		min-height: 0;
		overflow-y: auto;
		container-type: inline-size;
		container-name: instrument;
	}

	/* ── Layout ────────────────────────────────────────────────────────────── */

	.cv-layout {
		display: grid;
		gap: 1rem;
	}

	/* Stacked side panels (sliders, build readout) */
	.cv-panel-stack {
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	/* ── Panels ────────────────────────────────────────────────────────────── */

	/* Solid shapes: confident fill, tight radius, inset top hairline — no
	   hollow outlines */
	.cv-panel {
		display: grid;
		gap: 0.75rem;
		padding: 1.1rem 1.2rem;
		border-radius: 6px;
		background: var(--surface-raised);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
	}

	/* The chart floats directly on the tool's dark field — no panel box */
	.cv-heatmap-panel {
		padding: 0;
		border-radius: 0;
		background: none;
		box-shadow: none;
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
		font-family: var(--font-mono);
		font-weight: 600;
	}

	/* Editable stat value: styled as a quiet solid chip, spinners hidden
	   (arrow keys still step it) */
	.cv-value-field {
		display: inline-flex;
		align-items: baseline;
		gap: 0.2rem;
	}

	.cv-value-input {
		width: 3.9rem;
		padding: 0.14rem 0.4rem;
		border: none;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.07);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-weight: 600;
		text-align: right;
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.cv-value-input::-webkit-outer-spin-button,
	.cv-value-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.cv-value-input:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 1px;
	}

	.cv-value-unit {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--muted);
	}

	/* Custom flat sliders: solid 4px track, solid circular thumb (the variance
	   slider's risk-ramp gradient paints its track via inline style) */
	.cv-slider-input {
		appearance: none;
		width: 100%;
		height: 4px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--text) 16%, transparent);
		outline-offset: 4px;
	}

	.cv-slider-input::-webkit-slider-thumb {
		appearance: none;
		width: 15px;
		height: 15px;
		border: none;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 3px rgba(4, 8, 18, 0.6);
		cursor: pointer;
		transition: box-shadow 150ms ease;
	}

	.cv-slider-input::-webkit-slider-thumb:hover {
		box-shadow:
			0 0 0 3px rgba(4, 8, 18, 0.6),
			0 0 10px rgba(108, 181, 255, 0.5);
	}

	.cv-slider-input::-moz-range-thumb {
		width: 15px;
		height: 15px;
		border: none;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 3px rgba(4, 8, 18, 0.6);
		cursor: pointer;
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

	/* Kicker with a decorative hairline fading out to the right */
	.cv-panel-kicker {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.cv-panel-kicker::after {
		content: '';
		flex: 1;
		height: 1px;
		background: linear-gradient(
			to right,
			color-mix(in srgb, var(--accent) 45%, transparent),
			transparent
		);
	}

	.cv-build-value {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 2rem;
		font-weight: 700;
	}

	.cv-build-meta {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5rem;
		color: var(--muted);
	}

	.cv-strong {
		font-family: var(--font-mono);
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
		padding: 0.42rem 0.95rem;
		border: none;
		border-radius: 3px;
		background: color-mix(in srgb, var(--accent) 22%, var(--surface));
		color: var(--text);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}

	.cv-pin-button:hover {
		background: color-mix(in srgb, var(--accent) 32%, var(--surface));
	}

	/* ── Container-responsive layout ───────────────────────────────────────── */

	@container instrument (min-width: 48rem) {
		.cv-panel {
			padding: 1.25rem 1.35rem;
		}

		.cv-heatmap-panel {
			padding: 0;
		}
	}

	@container instrument (min-width: 60rem) {
		.cv-layout {
			height: 100%;
			grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
			/* Cap the single row at the layout's own height — without this the row
			   auto-sizes to the panel stack's content and overflows the tile */
			grid-template-rows: minmax(0, 1fr);
			align-items: stretch;
			min-height: 0;
		}

		.cv-heatmap-panel {
			min-height: 0;
		}

		/* If the stack outgrows the tile-capped row, scroll it internally */
		.cv-panel-stack {
			min-height: 0;
			overflow-y: auto;
		}
	}
</style>
