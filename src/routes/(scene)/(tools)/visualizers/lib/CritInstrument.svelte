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
		riskGradient,
		HITS_MIN,
		HITS_MAX,
		sampleRotation,
		formatMultiplier,
		formatChance,
		critCountDistribution,
		rotationMultiplier
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
		rollResult ? rotationMultiplier(rollCrits, rollResult.length, myCD) : 0
	);

	// Every result a roll could give, with its chance: bar k is "exactly k of
	// the hits crit". The roll lights up the bar it landed on.
	const distribution = $derived(critCountDistribution(myCR, hitsPerRotation));
	const distributionPeak = $derived(Math.max(...distribution));
	const averageCrits = $derived(Math.min(1, Math.max(0, myCR)) * hitsPerRotation);
	let hoveredCount = $state<number | null>(null);
	// The bar the sentence under the chart is about — the hovered one, else the
	// rolled one — and the only bar drawn dark.
	const readCount = $derived(hoveredCount ?? (rollResult ? rollCrits : null));
	// The bar the average line runs through (bar k spans k … k+1 of the axis,
	// and the line sits at average + ½).
	const averageBar = $derived(Math.min(hitsPerRotation, Math.floor(averageCrits + 0.5)));

	function pickBar(event: PointerEvent) {
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const k = Math.floor(((event.clientX - box.left) / box.width) * distribution.length);
		hoveredCount = Math.min(distribution.length - 1, Math.max(0, k));
	}

	const hitsWord = (n: number) => (n === 1 ? 'hit' : 'hits');

	// Crit-value budget line overlay (off by default — opt-in via the toggle)
	let showCvLine = $state(false);

	// A second, pinned build for eyeballing a trade (e.g. circlet swap) — no verdict, just two markers
	let pinned = $state<{ critRate: number; critDamage: number } | null>(null);

	// Derived display values
	const myMultiplier = $derived(averageDamageMultiplier(myCR, myCD));

	// Probability that zero crits land across a full rotation — used in the variance overlay readout
	const zeroCritRisk = $derived(zeroCritProbability(myCR, hitsPerRotation));

	// CD:CR ratio string (KQM convention: 2:1 is roughly the optimization target)
	const ratioText = $derived(myCR > 0 ? `${(myCD / myCR).toFixed(2)} : 1` : '—');

	// Total crit value of the current build, in display units (e.g. 280). TOTAL
	// on purpose, base 5% / 50% included (⚓ Nate 2026-10-02): players think of
	// a build in totals, and the label says so — a KQM reader seeing a bare
	// "280 CV" would take it for artifact CV, where 280 is near impossible.
	const myCV = $derived(Math.round(critValue(myCR, myCD) * 100));

	const pinnedMultiplier = $derived(
		pinned ? averageDamageMultiplier(pinned.critRate, pinned.critDamage) : 0
	);
	// Relative, not a difference of multipliers (⚓ Nate 2026-09-23): "+7%
	// average DMG" is a sentence a player can use; "+0.123x" made them divide.
	const pinnedDelta = $derived(pinned ? myMultiplier / pinnedMultiplier - 1 : 0);
	// ⏭ i18n: the locale moves here with the ledger; the sign is ICU's, not ours.
	const deltaFormat = new Intl.NumberFormat('en-US', {
		style: 'percent',
		signDisplay: 'exceptZero',
		maximumFractionDigits: 1
	});

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
		if (num(s.hits)) hitsPerRotation = Math.min(HITS_MAX, Math.max(HITS_MIN, Math.round(s.hits)));
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
	<div class="cv-layout">
		<!-- THE STAGE: the chart and the controls that drive it, sized together
		     to the tile so both are on screen (see .cv-stage). Wide tiles dissolve
		     it and the strip moves to the side column. -->
		<div class="cv-stage">
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

			<!-- The control strip: the build, then the overlays -->
			<div class="panel cv-controls">
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">CRIT Rate</span>
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
						<span class="slider-label">CRIT DMG</span>
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

				<div class="cv-overlays">
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
				</div>

				<label class="slider-control cv-hits">
					<div class="slider-header">
						<span class="slider-label">Hits per rotation</span>
						<span class="readout">{hitsPerRotation}</span>
					</div>
					<input
						type="range"
						min={HITS_MIN}
						max={HITS_MAX}
						step="1"
						bind:value={hitsPerRotation}
						class="slider cv-variance-slider"
						style:background={riskGradient(myCR)}
					/>
				</label>
			</div>
		</div>

		<div class="cv-panel-stack">
			<!-- THE ANSWER: the one paper card -->
			<div class="panel panel--paper cv-build-panel">
				<p class="kicker">Current build</p>
				<p class="cv-build-value">{formatMultiplier(myMultiplier)}</p>
				<p class="cv-build-sub">Average DMG per hit. A hit that doesn't crit is ×1.</p>

				<dl class="cv-build-list">
					<dt>Ratio (CD:CR)</dt>
					<dd>{ratioText}</dd>
					<dt>Total crit value (CV)</dt>
					<dd>{myCV}</dd>
					<dd class="cv-build-gloss">2 × CRIT Rate + CRIT DMG, base crit stats included</dd>
					<dt>No-crit risk ({hitsPerRotation} {hitsWord(hitsPerRotation)})</dt>
					<dd>{formatChance(zeroCritRisk)}</dd>
				</dl>

				<!-- Pin: freeze a second marker to eyeball a trade against -->
				<div class="cv-pin-section">
					{#if pinned}
						<dl class="cv-build-list">
							<dt>Pinned</dt>
							<dd>
								{pct(pinned.critRate)} / {pct(pinned.critDamage)} · {formatMultiplier(
									pinnedMultiplier
								)}
							</dd>
						</dl>
						<p class="cv-build-delta">
							<span class="cv-strong">{deltaFormat.format(pinnedDelta)}</span> average DMG vs pinned
						</p>
						<button class="btn btn--primary cv-button" onclick={() => (pinned = null)}>
							Clear pin
						</button>
					{:else}
						<button
							class="btn btn--primary cv-button"
							onclick={() => (pinned = { critRate: myCR, critDamage: myCD })}
						>
							Pin this build
						</button>
					{/if}
				</div>
				<!-- One rotation: every crit count with its chance, and a roll that
				     draws one of them. -->
				<div class="cv-section cv-dist-section">
					<p class="cv-dist-title">
						Crits in one rotation of {hitsPerRotation}
						{hitsWord(hitsPerRotation)}
					</p>
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="cv-dist"
						onpointermove={pickBar}
						onpointerdown={pickBar}
						onpointerleave={() => (hoveredCount = null)}
					>
						{#each distribution as chance, k (k)}
							<span
								class="cv-dist-bar"
								class:cv-dist-read={readCount === k}
								style:height="{(chance / distributionPeak) * 100}%"
							></span>
						{/each}
						<span
							class="cv-dist-mean"
							class:cv-dist-mean-cut={readCount === averageBar}
							style:left="{((averageCrits + 0.5) / distribution.length) * 100}%"
						></span>
					</div>
					<div class="cv-dist-axis" aria-hidden="true">
						<span>0</span><span>{hitsPerRotation}</span>
					</div>
					<p class="cv-roll-meta" aria-live="polite">
						{#if hoveredCount !== null}
							{hoveredCount} of {hitsPerRotation}
							{hitsWord(hitsPerRotation)} crit —
							<span class="cv-strong"
								>{formatMultiplier(rotationMultiplier(hoveredCount, hitsPerRotation, myCD))}</span
							>, in {formatChance(distribution[hoveredCount])} of rotations
						{:else if rollResult}
							{rollCrits} of {rollResult.length}
							{hitsWord(rollResult.length)} crit —
							<span class="cv-strong">{formatMultiplier(rollMultiplier)}</span>
							this time
						{:else}
							On average {averageCrits.toFixed(1)} of {hitsPerRotation}
							{hitsWord(hitsPerRotation)} crit —
							<span class="cv-strong">{formatMultiplier(myMultiplier)}</span>
						{/if}
					</p>
					<div class="cv-roll">
						<button class="btn btn--primary cv-button" onclick={rollIt}>
							<Mark name="dice" size={12} />
							Roll {hitsPerRotation}
							{hitsWord(hitsPerRotation)}
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
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* The instrument adapts to its TILE via container queries (not the viewport
	   — a half-width tile on a wide monitor gets the narrow layout). The tile
	   itself is that container (.ws-tile in the workspace page), so the
	   @container rules below resolve one level up; declaring it here as well
	   would shadow the tile with this element's own width.
	   A bespoke root rather than the shared .instrument: below the wide tier
	   the chart and its strip share one height budget (the stage), which
	   .instrument's grid would fight. At the wide tier it is the shared form,
	   restated by hand. */
	.cv-instrument {
		height: 100%;
		min-height: 0;
	}

	/* ── Layout ────────────────────────────────────────────────────────────── */

	/* Narrow: a BLOCK, not a grid, and that is load-bearing. The stage's
	   max-height is a percentage, and a percentage resolves against a grid
	   item's AREA, whose auto row is sized by the item — circular. Against a
	   block parent of definite height it is just the tile. */
	.cv-layout {
		height: 100%;
	}

	/* ══ THE STAGE (⚓ 2026-10-02) ════════════════════════════════════════════
	   The chart and its control strip share ONE height budget: the tile's.
	   The chart starts as a square of the tile's width (100cqi — the tile is
	   the inline-size container) capped at 70svh as before, and it is the only
	   thing that SHRINKS, so when the tile is too short for both, the chart
	   gives up height and the strip stays on screen. The readout card and the
	   roll sit below the fold; the marker's own tooltip carries the answer.
	   Where the tile is tall enough (or has no definite height — below 1024px
	   the page scrolls), nothing shrinks and this is exactly the old layout.
	   🎛️ CHART_MIN: below it the chart stops giving way and the strip goes
	   below the fold instead — a chart too short to drag on is no trade. */
	.cv-stage {
		--cv-chart-min: 18rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-height: 100%;
	}

	/* The chart floats directly on the tool's dark field — no panel box. Its
	   shell is absolutely placed inside (CritHeatmap), so this panel's size is
	   set here and only here: no percentage has to find a definite parent. */
	.cv-heatmap-panel {
		position: relative;
		height: min(100cqi, 70svh);
		min-height: var(--cv-chart-min);
		flex: 0 1 auto;
		padding: 0;
		border-radius: 0;
		background: none;
		box-shadow: none;
		/* Carries the shell's shrinkability up to the layout — the chart sets
		   its drawn box's width inline in px, and any box between that and the
		   tile that keeps min-width: auto re-imposes a stale wide box as a
		   floor when the lineup narrows. */
		min-width: 0;
	}

	.cv-heatmap-panel > :global(.cv-heatmap-shell) {
		position: absolute;
		inset: 0;
	}

	/* The strip: CRIT Rate | CRIT DMG, then the overlays | hits per rotation. */
	.cv-controls {
		flex: none;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem 1.5rem;
	}

	.cv-overlays {
		display: grid;
		gap: 0.5rem;
		align-content: start;
	}

	.cv-panel-stack {
		margin-top: 1rem;
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	/* Phones: the strip's columns stack. */
	@container instrument (max-width: 30rem) {
		.cv-controls {
			grid-template-columns: minmax(0, 1fr);
		}
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

	/* The build sliders + the hits slider use the shared .slider (track + thumb
	   + hover glow). The hits slider adds its risk-ramp gradient track via
	   inline style, which overrides the shared track background. */

	/* Plain-language second line under a toggle label. */
	.cv-toggle-sub {
		display: block;
		font-size: var(--fs-md);
		color: color-mix(in srgb, var(--muted) 80%, transparent);
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

	/* Plain-language gloss line under a readout value */
	.cv-build-sub,
	.cv-build-gloss {
		margin: -0.2rem 0 0;
		font-size: var(--fs-md);
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	/* Label | value, no colon (conventions §C): the column is the separator. */
	.cv-build-list {
		display: grid;
		grid-template-columns: auto auto;
		justify-content: start;
		gap: 0 1rem;
		margin: 0.35rem 0 0;
		font-size: var(--fs-xl);
		line-height: 1.5rem;
	}

	.cv-build-list dt {
		color: var(--muted);
	}

	.cv-build-list dd {
		margin: 0;
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.cv-build-list .cv-build-gloss {
		grid-column: 1 / -1;
		margin: 0 0 0.2rem;
		font-weight: var(--fw-normal);
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	.cv-build-delta {
		margin: 0;
		font-size: var(--fs-xl);
		line-height: 1.5rem;
		color: var(--muted);
	}

	.cv-strong {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.cv-section {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.35rem;
		padding-top: 0.6rem;
		border-top: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
	}

	/* Pin sits under the numbers it would freeze, in both layouts — so the one
	   rule in the card is the one above the chart (⚓ Nate 2026-10-02) */
	.cv-pin-section {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.35rem;
	}

	.cv-button {
		justify-self: start;
	}

	/* ── One rotation: the crit-count distribution ─────────────────────────── */

	.cv-dist-title {
		margin: 0;
		font-size: var(--fs-md);
		color: var(--muted);
	}

	/* One bar per crit count, 0 at the left. Bars are scaled to the TALLEST
	   bar, not to 100%: the shape is the reading, and at 40 hits no single
	   count clears 15%. ⚠ Alpha in the paint, never element opacity (§ Laws). */
	.cv-dist {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 1px;
		height: 4.5rem;
		cursor: crosshair;
		touch-action: none;
	}

	.cv-dist-bar {
		flex: 1 1 0;
		min-width: 0;
		border-radius: 1px 1px 0 0;
		background: color-mix(in srgb, var(--muted) 38%, transparent);
	}

	/* The bar the sentence below is about (hovered, else rolled). Paper's
	   anchor ink, ⛔ not gold: on parchment gold is the kicker's, and as a fill
	   it reads as brown (⚓ Nate 2026-10-02). */
	.cv-dist-read {
		background: var(--muted);
	}

	/* The average, which usually falls BETWEEN two counts: no rotation scores
	   exactly the headline multiplier, and this line is where it sits.
	   Navy, and PAPER where it crosses the dark bar — neither navy nor gold
	   reads on navy. ⛔ Not a paper edge around a navy line: that was three
	   lines where there is one (⚓ Nate 2026-10-02). */
	.cv-dist-mean {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		margin-left: -1px;
		background: var(--text);
		pointer-events: none;
	}

	.cv-dist-mean-cut {
		background: var(--surface-broad);
	}

	.cv-dist-axis {
		display: flex;
		justify-content: space-between;
		margin-top: -0.2rem;
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	/* ── Roll ──────────────────────────────────────────────────────────────── */

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

	/* A hit that didn't crit is a ring, a crit the same ink filled — the same
	   ink as the bar the roll lit, and ⛔ no glow (gold + glow on parchment went
	   muddy).
	   ⚠ The ring is an inset shadow, not a border: Chrome floors a 1.5px
	   border-width to 1px. */
	.cv-roll-dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--muted) 45%, transparent);
		animation: cv-dot-in 260ms ease-out backwards;
	}

	.cv-roll-crit {
		background: var(--muted);
		box-shadow: none;
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

	/* ── Container-responsive layout ───────────────────────────────────────── */

	/* The card spread out under the chart: a stacked tile wide enough for
	   two columns puts the numbers (and Pin) on the left and the one-rotation
	   chart beside them, instead of leaving half the card empty. Beside the
	   chart (≥ 60rem) the card is a 22rem column again and stacks.
	   The chart section sits at the BOTTOM of the rows it spans (⚓ Nate): Roll
	   lines up with Pin, and the chart keeps clear of the headline.
	   ⚠ It is the shorter side. Were it ever the taller, its extra height would
	   be shared out over the left column's rows and pull them apart. */
	@container instrument (40rem <= width < 60rem) {
		.cv-build-panel {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-template-areas:
				'kicker kicker'
				'value dist'
				'sub dist'
				'list dist'
				'pin dist';
			column-gap: 2.5rem;
		}

		.cv-build-panel > :global(.kicker) {
			grid-area: kicker;
		}
		.cv-build-value {
			grid-area: value;
		}
		.cv-build-sub {
			grid-area: sub;
		}
		.cv-build-panel > .cv-build-list {
			grid-area: list;
		}
		.cv-pin-section {
			grid-area: pin;
		}

		/* Beside the numbers it needs no rule above it */
		.cv-dist-section {
			grid-area: dist;
			align-self: end;
			margin-top: 0;
			padding-top: 0;
			border-top: none;
		}
	}

	/* Wide: the chart takes the tile's full height on the left, and the strip
	   and the readout stack in a side column. The stage dissolves so its two
	   children can sit in different columns.
	   ⚓ NOT the shared instrument form (app.css .instrument), and measured, not
	   assumed (2026-10-06): with the strip under the chart the heatmap gave up
	   ~170px of height, and since it caps its width by its height it shrank by
	   a fifth with bare night either side — a 2-D field wants the height. What
	   it does share: the paper card runs to the bottom of the column, as every
	   Readout does at this width. */
	@container instrument (min-width: 60rem) {
		.cv-layout {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
			grid-template-rows: auto minmax(0, 1fr);
			grid-template-areas:
				'chart controls'
				'chart stack';
			gap: 1rem;
			min-height: 0;
		}

		.cv-stage {
			display: contents;
		}

		.cv-heatmap-panel {
			grid-area: chart;
			height: auto;
			min-height: 0;
		}

		.cv-controls {
			grid-area: controls;
			grid-template-columns: minmax(0, 1fr);
		}

		/* Side column: the card fills it, and scrolls inside it if it outgrows
		   the tile */
		.cv-panel-stack {
			grid-area: stack;
			margin-top: 0;
			min-height: 0;
			overflow-y: auto;
			align-content: stretch;
		}
	}
</style>
