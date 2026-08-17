<script lang="ts">
	import CritHeatmap from './CritHeatmap.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import {
		CR_MIN,
		CR_MAX,
		CD_MIN,
		CD_MAX,
		clamp,
		averageDamageMultiplier,
		zeroCritProbability,
		critValue,
		riskRampGradient,
		sampleRotation
	} from './crit';

	// User's current build stats, bound to both the heatmap marker and the sliders
	let myCR = $state(0.7);
	let myCD = $state(1.4);

	// Variance overlay controls
	let showVariance = $state(true);
	let hitsPerRotation = $state(8);

	// "Roll it": one sampled rotation — variance as an experience, not a number
	let rollResult = $state<boolean[] | null>(null);
	let rollNonce = $state(0); // remounts the dot row so the stagger replays
	function rollIt() {
		rollResult = sampleRotation(myCR, hitsPerRotation);
		rollNonce++;
	}
	// A sample is only honest for the stats it was drawn at
	$effect(() => {
		void myCR;
		void hitsPerRotation;
		rollResult = null;
	});
	const rollCrits = $derived(rollResult ? rollResult.filter(Boolean).length : 0);
	const rollMultiplier = $derived(
		rollResult ? 1 + (rollCrits / Math.max(1, rollResult.length)) * myCD : 0
	);

	// Crit-value budget line overlay (off by default — opt-in via the toggle)
	let showCvLine = $state(false);

	// A second, pinned build for eyeballing a trade (e.g. circlet swap) — no verdict, just two markers
	let pinned = $state<{ critRate: number; critDamage: number } | null>(null);

	// Derived display values
	const myMultiplier = $derived(averageDamageMultiplier(myCR, myCD));

	// Probability that zero crits land across a full rotation — used in the variance overlay readout
	const zeroCritRisk = $derived(zeroCritProbability(myCR, hitsPerRotation));

	// CD:CR ratio string (KQM convention: 2:1 is roughly the optimization target)
	const ratioText = $derived(myCR > 0 ? `${(myCD / myCR).toFixed(2)} : 1` : 'n/a');

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

	// ── Workspace handle (share + reset) ───────────────────────────────────────

	export function reset() {
		myCR = 0.7;
		myCD = 1.4;
		showVariance = true;
		hitsPerRotation = 8;
		showCvLine = false;
		pinned = null;
		rollResult = null;
	}

	export function getShareState() {
		return {
			v: 1,
			cr: myCR,
			cd: myCD,
			cvLine: showCvLine,
			variance: showVariance,
			hits: hitsPerRotation,
			pin: pinned ? [pinned.critRate, pinned.critDamage] : null
		};
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
		if (num(s.cr)) myCR = clamp(s.cr, CR_MIN, CR_MAX);
		if (num(s.cd)) myCD = clamp(s.cd, CD_MIN, CD_MAX);
		if (typeof s.cvLine === 'boolean') showCvLine = s.cvLine;
		if (typeof s.variance === 'boolean') showVariance = s.variance;
		if (num(s.hits)) hitsPerRotation = Math.min(40, Math.max(1, Math.round(s.hits)));
		pinned =
			Array.isArray(s.pin) && num(s.pin[0]) && num(s.pin[1])
				? {
						critRate: clamp(s.pin[0], CR_MIN, CR_MAX),
						critDamage: clamp(s.pin[1], CD_MIN, CD_MAX)
					}
				: null;
	}
</script>

<div class="cv-instrument">
	<!-- Heatmap floating on the dark field left, stacked panels right (wide
	     containers); single column when the tile is narrow. -->
	<div class="cv-layout">
		<div class="panel cv-heatmap-panel">
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
			<div class="panel cv-slider-panel">
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Crit Rate</span>
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
						class="slider"
						aria-label="Crit rate"
					/>
				</div>
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Crit Damage</span>
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
						class="slider"
						aria-label="Crit damage"
					/>
				</div>

				<!-- Overlay toggles: CV budget line + variance section -->
				<div class="cv-variance-controls">
					<label class="check">
						<input type="checkbox" bind:checked={showCvLine} />
						<span class="check-box"></span>
						Equal-budget line (CV)
					</label>
					<label class="check">
						<input type="checkbox" bind:checked={showVariance} />
						<span class="check-box"></span>
						<span>
							No-crit risk overlay
							<span class="note cv-toggle-sub">chance a whole rotation lands zero crits</span>
						</span>
					</label>

					{#if showVariance}
						<label class="slider-control">
							<div class="slider-header">
								<span class="slider-label">Hits / Rotation</span>
								<span class="readout">{hitsPerRotation}</span>
							</div>
							<input
								type="range"
								min="1"
								max="40"
								step="1"
								bind:value={hitsPerRotation}
								class="slider cv-variance-slider"
								style:background={riskRampGradient}
							/>
						</label>

						<!-- Roll it: sample the rotation and watch the coin flips land -->
						<div class="cv-roll">
							<button class="btn btn--primary cv-pin-button" onclick={rollIt}>
								<Mark name="dice" size={12} />
								Roll {hitsPerRotation} hits
							</button>
							{#if rollResult}
								{#key rollNonce}
									<div class="cv-roll-dots" aria-hidden="true">
										{#each rollResult as crit, i (i)}
											<span
												class="cv-roll-dot"
												class:cv-roll-crit={crit}
												style:animation-delay="{i * 45}ms"
											></span>
										{/each}
									</div>
								{/key}
								<p class="cv-roll-meta">
									{rollCrits} of {rollResult.length} crit →
									<span class="cv-strong">{rollMultiplier.toFixed(3)}x</span>
									this time (average {myMultiplier.toFixed(3)}x)
								</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Build readout: key stats for the current marker position -->
			<div class="panel panel--paper cv-build-panel">
				<p class="kicker">Current Build</p>
				<p class="cv-build-value">{myMultiplier.toFixed(3)}x</p>
				<p class="cv-build-sub">your average hit, vs never critting</p>
				<p class="cv-build-meta">Crit Rate: <span class="cv-strong">{pct(myCR)}</span></p>
				<p class="cv-build-meta">Crit Damage: <span class="cv-strong">{pct(myCD)}</span></p>
				<p class="cv-build-meta">Ratio (CD:CR): <span class="cv-strong">{ratioText}</span></p>
				<p class="cv-build-meta">Crit Value: <span class="cv-strong">{myCV} CV</span></p>
				<p class="cv-build-sub">CV = 2×Rate + DMG — your total crit budget</p>
				{#if showVariance}
					<p class="cv-build-meta">
						No-crit risk ({hitsPerRotation} hits):
						<span class="cv-strong">{(zeroCritRisk * 100).toFixed(1)}%</span>
					</p>
				{/if}

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
						<button class="btn btn--primary cv-pin-button" onclick={() => (pinned = null)}
							>Clear pin</button
						>
					</div>
				{:else}
					<button
						class="btn btn--primary cv-pin-button"
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
	   — a half-width tile on a wide monitor gets the narrow layout). The tile
	   itself is that container now (.ws-tile in the workspace page), so the
	   @container rules below resolve one level up; declaring it here as well
	   would shadow the tile with this element's own width.
	   A bespoke root rather than the shared .instrument: this is the one
	   instrument with its own two-column layout, and .instrument's stacking grid
	   would fight .cv-layout for the height.
	   ⛔ Its `overflow-y: auto` went with .instrument's, and for the same reason:
	   it never engaged, and the TILE is the viewport now (.ws-body). */
	.cv-instrument {
		height: 100%;
		min-height: 0;
	}

	/* ── Layout ────────────────────────────────────────────────────────────── */

	.cv-layout {
		display: grid;
		gap: 1rem;
	}

	/* Side panels: in the narrow (stacked-under-chart) layout they flow
	   side-by-side and wrap like the other instruments' control panels */
	.cv-panel-stack {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: flex-start;
	}

	.cv-panel-stack > :global(.panel) {
		flex: 1 1 20rem;
	}

	/* ── Panels ────────────────────────────────────────────────────────────── */
	/* Panel box, kicker, and sliders all come from the shared pattern layer in
	   app.css (one source for every instrument). Only crit-specific panels and
	   the editable stat field / variance / build-readout styling live here. */

	/* The chart floats directly on the tool's dark field — no panel box. Reset
	   the shared .panel's align-content so the square chart stays vertically
	   centered when its panel stretches (wide layout), rather than top-packed. */
	.cv-heatmap-panel {
		padding: 0;
		border-radius: 0;
		background: none;
		border: none; /* the chart's OWN .frame carries the dire border — a
		   panel border here double-framed it (the heatmap is the one
		   instrument whose frame sits inside a .panel wrapper, kept only
		   for its grid behavior) */
		box-shadow: none;
		align-content: stretch;
		/* Carries the shell's shrinkability up to .cv-layout — the chart sets its
		   drawn box's width inline in px, and any grid item between that box and
		   the tile that keeps min-width: auto re-imposes the stale wide box as a
		   floor when the lineup narrows. */
		min-width: 0;
	}

	.cv-slider-panel {
		gap: 0.75rem;
	}

	/* ── Slider-adjacent (crit-specific) ───────────────────────────────────── */

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
		background: var(--fill-rest);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
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
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	/* The two build sliders + the variance slider use the shared .slider (track
	   + thumb + hover glow). The variance slider adds its risk-ramp gradient track
	   via inline style, which overrides the shared track background. */

	/* ── Variance controls ─────────────────────────────────────────────────── */

	.cv-variance-controls {
		display: grid;
		gap: 0.6rem;
		padding-top: 0.35rem;
		border-top: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
	}

	/* Plain-language second line under a toggle label. */
	.cv-toggle-sub {
		display: block;
		font-size: var(--fs-md);
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	/* ── Roll it ───────────────────────────────────────────────────────────── */

	.cv-roll {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem 0.7rem;
	}

	.cv-roll-dots {
		display: flex;
		flex: 1 1 8rem;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.cv-roll-meta {
		flex-basis: 100%;
		margin: 0;
		font-size: var(--fs-lg);
		color: var(--muted);
	}

	.cv-roll-dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: var(--fill-hover);
		animation: cv-dot-in 260ms ease-out backwards;
	}

	.cv-roll-crit {
		background: var(--accent);
		box-shadow: 0 0 7px color-mix(in srgb, var(--accent) 65%, transparent);
	}

	@keyframes cv-dot-in {
		from {
			transform: scale(0.2);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	/* ── Build panel ───────────────────────────────────────────────────────── */

	.cv-build-panel {
		gap: 0.35rem;
	}

	.cv-build-value {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
	}

	.cv-build-meta {
		margin: 0;
		font-size: var(--fs-xl);
		line-height: 1.5rem;
		color: var(--muted);
	}

	/* Plain-language gloss line under a readout value */
	.cv-build-sub {
		margin: -0.2rem 0 0;
		font-size: var(--fs-md);
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	.cv-strong {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
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
	}

	/* ── Container-responsive layout ───────────────────────────────────────── */

	@container instrument (min-width: 48rem) {
		.panel {
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

		/* Side column: vertical stack again; scroll internally if it outgrows
		   the tile-capped row */
		.cv-panel-stack {
			display: grid;
			align-content: start;
			min-height: 0;
			overflow-y: auto;
		}

		.cv-panel-stack > :global(.panel) {
			flex: none;
		}
	}
</style>
