<script lang="ts">
	import { BANNERS, featuredPmf, pmfStats, toCdf, type BannerId } from './wish';

	let bannerId = $state<BannerId>('character');
	let pity = $state(0);
	let guaranteed = $state(false);
	let pulls = $state(90); // pulls the player has saved

	const banner = $derived(BANNERS[bannerId]);
	const maxPity = $derived(banner.hard - 1);

	// Keep state legal when switching banners
	$effect(() => {
		if (pity > maxPity) pity = maxPity;
	});

	const pmf = $derived(featuredPmf(banner, Math.min(pity, maxPity), guaranteed));
	const cdf = $derived(toCdf(pmf));
	const stats = $derived(pmfStats(pmf));
	const horizon = $derived(pmf.length - 1);
	const clampedPulls = $derived(Math.min(pulls, horizon));
	const chanceWithin = $derived(cdf[clampedPulls] ?? 1);

	// First soft-pity onset, measured in MY next pulls
	const softAt = $derived(banner.softStart - Math.min(pity, maxPity));

	// ── Geometry ─────────────────────────────────────────────────────────────
	let graphW = $state(720);
	const PADL = 58;
	const PADR = 16;
	const TOP = 16;
	const PLOT_H = 210;
	const plotY1 = TOP + PLOT_H;
	const H = plotY1 + 30;

	const xOf = $derived((k: number) => PADL + (k / horizon) * (graphW - PADL - PADR));
	// cdf plots on the labeled 0–100% scale; the pmf silhouette is normalized
	// to its own peak (shape only — the spike at hard pity would flatten it)
	const yOfC = $derived((p: number) => plotY1 - p * (PLOT_H - 8));
	const pmfMax = $derived(Math.max(...pmf, 1e-9));
	const yOfP = $derived((p: number) => plotY1 - (p / pmfMax) * (PLOT_H - 8) * 0.82);

	const X_STEP = $derived(horizon > 120 ? 30 : 20);
	const xTicks = $derived(
		Array.from({ length: Math.floor(horizon / X_STEP) + 1 }, (_, i) => i * X_STEP)
	);

	const pmfPath = $derived.by(() => {
		let d = `M${xOf(0).toFixed(1)},${plotY1}`;
		for (let k = 1; k <= horizon; k++) d += ` L${xOf(k).toFixed(1)},${yOfP(pmf[k]).toFixed(1)}`;
		d += ` L${xOf(horizon).toFixed(1)},${plotY1} Z`;
		return d;
	});
	const cdfPath = $derived.by(() => {
		let d = `M${xOf(0).toFixed(1)},${plotY1}`;
		for (let k = 1; k <= horizon; k++) d += ` L${xOf(k).toFixed(1)},${yOfC(cdf[k]).toFixed(1)}`;
		return d;
	});

	// Hover / drag scrubs the pulls-saved marker
	let scrubbing = $state(false);
	function markerFrom(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (e.clientX - rect.left - PADL) / (graphW - PADL - PADR)));
		pulls = Math.round(frac * horizon);
	}
	function onDown(e: PointerEvent) {
		scrubbing = true;
		markerFrom(e);
		(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
	}
	function onMove(e: PointerEvent) {
		if (scrubbing) markerFrom(e);
	}
	function onUp(e: PointerEvent) {
		scrubbing = false;
		const el = e.currentTarget as SVGSVGElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}

	const fmtPct = (p: number, digits = 1) => `${(p * 100).toFixed(digits)}%`;

	// ── Workspace handle (share + reset) ─────────────────────────────────────
	export function reset() {
		bannerId = 'character';
		pity = 0;
		guaranteed = false;
		pulls = 90;
	}

	export function getShareState() {
		return { v: 1, banner: bannerId, pity, guaranteed, pulls };
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		if (s.banner === 'character' || s.banner === 'weapon') bannerId = s.banner;
		const cap = BANNERS[bannerId].hard - 1;
		if (typeof s.pity === 'number' && Number.isFinite(s.pity))
			pity = Math.min(cap, Math.max(0, Math.round(s.pity)));
		if (typeof s.guaranteed === 'boolean') guaranteed = s.guaranteed;
		if (typeof s.pulls === 'number' && Number.isFinite(s.pulls))
			pulls = Math.min(200, Math.max(0, Math.round(s.pulls)));
	}
</script>

<div class="wi-instrument">
	<div class="wi-frame vz-anim-frame">
		<div class="wi-graph" bind:clientWidth={graphW}>
			<svg
				width={graphW}
				height={H}
				role="img"
				aria-label="Distribution of which pull lands the featured five-star"
				onpointerdown={onDown}
				onpointermove={onMove}
				onpointerup={onUp}
				onpointercancel={onUp}
				style:cursor="ew-resize"
			>
				<!-- X grid (pulls from now) -->
				{#each xTicks as t (t)}
					<line x1={xOf(t)} y1={TOP} x2={xOf(t)} y2={plotY1} stroke="rgba(255,255,255,0.07)" />
					<text
						x={xOf(t)}
						y={plotY1 + 15}
						fill="rgba(255,255,255,0.5)"
						font-size="10"
						text-anchor="middle"
					>
						{t}
					</text>
				{/each}
				<text
					x={graphW - PADR}
					y={plotY1 + 27}
					fill="rgba(255,255,255,0.35)"
					font-size="10"
					text-anchor="end"
				>
					pulls from now
				</text>

				<!-- Y grid: cumulative chance -->
				{#each [0.25, 0.5, 0.75, 1] as p (p)}
					<line
						x1={PADL}
						y1={yOfC(p)}
						x2={graphW - PADR}
						y2={yOfC(p)}
						stroke="rgba(255,255,255,{p === 1 ? 0.14 : 0.07})"
					/>
					<text
						x={PADL - 7}
						y={yOfC(p) + 3.5}
						fill="rgba(255,255,255,0.5)"
						font-size="10"
						text-anchor="end"
					>
						{Math.round(p * 100)}%
					</text>
				{/each}
				<text
					x={PADL - 7}
					y={TOP - 4}
					fill="rgba(255,255,255,0.35)"
					font-size="10"
					text-anchor="end"
				>
					chance by then
				</text>

				<!-- Soft pity onset (first cycle) -->
				{#if softAt > 0 && softAt < horizon}
					<line
						x1={xOf(softAt)}
						y1={TOP}
						x2={xOf(softAt)}
						y2={plotY1}
						stroke="rgba(255,255,255,0.28)"
						stroke-dasharray="4 4"
					/>
					<text
						class="wi-word"
						x={xOf(softAt) + 5}
						y={TOP + 11}
						fill="rgba(255,255,255,0.45)"
						font-size="10"
					>
						soft pity
					</text>
				{/if}

				<!-- pmf silhouette (which pull lands it) + cumulative line -->
				<path d={pmfPath} fill="var(--accent)" opacity="0.3" />
				<path
					d={cdfPath}
					fill="none"
					stroke="var(--text)"
					stroke-width="2"
					stroke-linejoin="round"
				/>

				<!-- Pulls-saved marker -->
				<line
					x1={xOf(clampedPulls)}
					y1={TOP}
					x2={xOf(clampedPulls)}
					y2={plotY1}
					stroke="rgba(255,255,255,0.75)"
					stroke-width="1.5"
				/>
				<circle
					cx={xOf(clampedPulls)}
					cy={yOfC(chanceWithin)}
					r="4.5"
					fill="var(--accent)"
					stroke="#081225"
					stroke-width="1.5"
				/>
				<text
					class="wi-word"
					x={xOf(clampedPulls) + (clampedPulls > horizon * 0.7 ? -8 : 8)}
					y={Math.max(TOP + 12, yOfC(chanceWithin) - 10)}
					fill="rgba(255,255,255,0.85)"
					font-size="11"
					font-weight="600"
					text-anchor={clampedPulls > horizon * 0.7 ? 'end' : 'start'}
				>
					{pulls} pulls → {fmtPct(chanceWithin, 0)}
				</text>
			</svg>
		</div>
	</div>

	<div class="wi-panels vz-panels">
		<div class="vz-panel">
			<p class="vz-kicker">Banner</p>
			<div class="vz-chips">
				<button
					class="vz-chip"
					class:active={bannerId === 'character'}
					onclick={() => (bannerId = 'character')}
				>
					Character Event
				</button>
				<button
					class="vz-chip"
					class:active={bannerId === 'weapon'}
					onclick={() => (bannerId = 'weapon')}
				>
					Weapon Event
				</button>
			</div>
			{#if bannerId === 'character'}
				<p class="wi-note">
					A non-guaranteed 5★ is the featured character 55% of the time (the official consolidated
					rate, Capturing Radiance included) — losing makes the next one certain.
					<span class="wi-fine"
						>The Radiance streak counter isn't fully datamined, so it isn't modeled — but officially
						you can never lose the "50/50" four times in a row.</span
					>
				</p>
			{:else}
				<p class="wi-note">
					A non-guaranteed 5★ is YOUR charted weapon 37.5% of the time (75% featured pair, split two
					ways). One fate point: miss once and the next 5★ is it — worst case two 5★s.
				</p>
			{/if}
		</div>

		<div class="vz-panel">
			<p class="vz-kicker">Your State</p>
			<div class="vz-slider-control">
				<div class="vz-slider-header">
					<span class="vz-slider-label">Current Pity</span>
					<span class="vz-value">{Math.min(pity, maxPity)}</span>
				</div>
				<input
					type="range"
					min="0"
					max={maxPity}
					step="1"
					bind:value={pity}
					class="vz-slider"
					aria-label="Pulls since your last five-star"
				/>
			</div>
			<div class="vz-slider-control">
				<div class="vz-slider-header">
					<span class="vz-slider-label">Pulls Saved</span>
					<span class="vz-value">{pulls}</span>
				</div>
				<input
					type="range"
					min="0"
					max="200"
					step="1"
					bind:value={pulls}
					class="vz-slider"
					aria-label="Pulls you have saved"
				/>
			</div>
			<label class="wi-toggle">
				<input type="checkbox" bind:checked={guaranteed} />
				{bannerId === 'character' ? 'Guarantee held (lost the last 50/50)' : 'Fate point held'}
			</label>
		</div>

		<div class="vz-panel">
			<p class="vz-kicker">Readout</p>
			<p class="wi-big">
				{fmtPct(chanceWithin)}<span class="wi-big-unit">chance within your {pulls} pulls</span>
			</p>
			<p class="wi-meta">
				Half of players land it by <span class="wi-strong">{stats.median}</span> pulls
			</p>
			<p class="wi-meta">
				The unlucky tenth needs <span class="wi-strong">{stats.p90}+</span>
			</p>
			<p class="wi-meta">
				Average cost: <span class="wi-strong">{stats.mean.toFixed(1)}</span> pulls
			</p>
			<p class="wi-note">
				Odds only — no verdicts on whether to pull. Drag on the chart to move your pull budget.
			</p>
		</div>
	</div>
</div>

<style>
	.wi-instrument {
		height: 100%;
		min-height: 0;
		overflow-y: auto;
		container-type: inline-size;
		container-name: wish;
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	.wi-frame {
		padding: 0.4rem 0.6rem 0.2rem;
		border-radius: 9px;
	}

	.wi-graph svg {
		display: block;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.wi-graph text {
		font-family: var(--font-body);
	}

	.wi-graph text.wi-word {
		font-family: var(--font-condensed);
	}

	.wi-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--fs-md);
		color: var(--muted);
	}

	.wi-toggle input {
		accent-color: var(--accent);
	}

	.wi-big {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	.wi-big-unit {
		margin-left: 0.4rem;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.wi-meta {
		margin: 0;
		font-size: var(--fs-lg);
		line-height: 1.5rem;
		color: var(--muted);
	}

	.wi-strong {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.wi-note {
		margin: 0;
		font-size: var(--fs-md);
		line-height: 1.35rem;
		color: var(--muted);
	}

	.wi-fine {
		display: block;
		font-size: var(--fs-sm);
		color: color-mix(in srgb, var(--muted) 70%, transparent);
	}
</style>
