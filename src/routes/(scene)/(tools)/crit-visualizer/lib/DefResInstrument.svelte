<script lang="ts">
	import { defMultiplier, resMultiplier } from './defres';

	type ViewId = 'def' | 'res';
	let view = $state<ViewId>('res');

	// ── DEF controls ─────────────────────────────────────────────────────────
	let charLevel = $state(90);
	let enemyLevel = $state(100);
	let defShred = $state(0); // percent
	let defIgnore = $state(0); // percent

	const ENEMY_LEVEL_MAX = 110;
	const defNow = $derived(defMultiplier(charLevel, enemyLevel, defShred / 100, defIgnore / 100));
	const defBase = $derived(defMultiplier(charLevel, enemyLevel));

	// ── RES controls ─────────────────────────────────────────────────────────
	let baseRes = $state(10); // percent; 10 is the standard enemy
	let resShred = $state(0); // percent

	const finalRes = $derived((baseRes - resShred) / 100);
	const resNow = $derived(resMultiplier(finalRes));
	const resBase = $derived(resMultiplier(baseRes / 100));

	const RES_X0 = -1;
	const RES_X1 = 1;

	export function reset() {
		view = 'res';
		charLevel = 90;
		enemyLevel = 100;
		defShred = 0;
		defIgnore = 0;
		baseRes = 10;
		resShred = 0;
	}

	// ── Geometry (pixel-true; pattern shared with ReactionCurvesInstrument) ──
	let graphW = $state(720);
	const PADL = 58;
	const PADR = 16;
	const TOP = 16;
	const PLOT_H = 210;
	const plotY1 = TOP + PLOT_H;
	const H = plotY1 + 30;

	const xSpan = $derived(view === 'def' ? ENEMY_LEVEL_MAX - 1 : RES_X1 - RES_X0);
	const x0 = $derived(view === 'def' ? 1 : RES_X0);
	const xOf = $derived((v: number) => PADL + ((v - x0) / xSpan) * (graphW - PADL - PADR));

	// y: DEF plots 0..1; RES peaks at 1.5 (−100% halved)
	const yMax = $derived(view === 'def' ? 1 : 1.5);
	const yOf = $derived((m: number) => plotY1 - (m / yMax) * (PLOT_H - 8));
	const yTicks = $derived(view === 'def' ? [0.25, 0.5, 0.75, 1] : [0.25, 0.5, 0.75, 1, 1.25, 1.5]);
	const X_TICKS_DEF = [1, 20, 40, 60, 80, 100, 110];
	const X_TICKS_RES = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];

	const SAMPLES = 88;
	function tracePath(value: (x: number) => number): string {
		return Array.from({ length: SAMPLES + 1 }, (_, i) => {
			const x = x0 + (i / SAMPLES) * xSpan;
			return `${i ? 'L' : 'M'}${xOf(x).toFixed(1)},${yOf(value(x)).toFixed(1)}`;
		}).join(' ');
	}

	const mainPath = $derived(
		view === 'def'
			? tracePath((lv) => defMultiplier(charLevel, lv, defShred / 100, defIgnore / 100))
			: tracePath((r) => resMultiplier(r))
	);
	// DEF ghost: the same curve without shred/ignore — what the modifiers buy
	const ghostPath = $derived(
		view === 'def' && (defShred > 0 || defIgnore > 0)
			? tracePath((lv) => defMultiplier(charLevel, lv))
			: null
	);

	const markerX = $derived(view === 'def' ? xOf(enemyLevel) : xOf(clampRes(finalRes)));
	const markerY = $derived(view === 'def' ? yOf(defNow) : yOf(resMultiplier(clampRes(finalRes))));

	function clampRes(r: number): number {
		return Math.min(RES_X1, Math.max(RES_X0, r));
	}

	// Hover scrubs the x-axis quantity (enemy level / enemy base RES)
	function onMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (e.clientX - rect.left - PADL) / (graphW - PADL - PADR)));
		if (view === 'def') {
			enemyLevel = Math.round(x0 + frac * xSpan);
		} else {
			// the marker sits at FINAL res; hovering re-derives the base
			baseRes = Math.round(((x0 + frac * xSpan) * 100 + resShred) / 5) * 5;
			baseRes = Math.min(100, Math.max(-50, baseRes));
		}
	}

	const fmtPct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

	const regimeText = $derived(
		finalRes < 0
			? 'below 0% — each negative point only counts half'
			: finalRes >= 0.75
				? 'above 75% — deep diminishing returns'
				: 'linear regime — each point of shred is a full point'
	);
</script>

<div class="instrument">
	<div class="dr-chart ctx-dark">
		<div class="dr-graph" bind:clientWidth={graphW}>
			<svg
				width={graphW}
				height={H}
				role="img"
				aria-label={view === 'def'
					? 'Enemy DEF multiplier versus enemy level'
					: 'Damage multiplier versus enemy elemental RES'}
				onpointermove={onMove}
			>
				<!-- X grid -->
				{#each view === 'def' ? X_TICKS_DEF : X_TICKS_RES as t (t)}
					<line x1={xOf(t)} y1={TOP} x2={xOf(t)} y2={plotY1} stroke="var(--chart-grid)" />
					<text
						x={xOf(t)}
						y={plotY1 + 15}
						fill="var(--chart-ink)"
						font-size="10"
						text-anchor="middle"
					>
						{view === 'def' ? t : `${Math.round(Number(t) * 100)}%`}
					</text>
				{/each}
				<text
					x={graphW - PADR}
					y={plotY1 + 27}
					fill="var(--chart-dim)"
					font-size="10"
					text-anchor="end"
				>
					{view === 'def' ? 'Enemy level' : 'Enemy RES after shred'}
				</text>

				<!-- Y grid -->
				{#each yTicks as m (m)}
					<line
						x1={PADL}
						y1={yOf(m)}
						x2={graphW - PADR}
						y2={yOf(m)}
						stroke={m === 1 ? 'var(--chart-rule)' : 'var(--chart-grid)'}
					/>
					<text
						x={PADL - 7}
						y={yOf(m) + 3.5}
						fill="var(--chart-ink)"
						font-size="10"
						text-anchor="end"
					>
						×{m}
					</text>
				{/each}
				<text x="4" y={TOP - 4} fill="var(--chart-dim)" font-size="10" text-anchor="start">
					damage kept
				</text>

				{#if view === 'res'}
					<!-- Regime boundaries: 0% (halving starts left of here) and 75% -->
					<line
						x1={xOf(0)}
						y1={TOP}
						x2={xOf(0)}
						y2={plotY1}
						stroke="var(--chart-rule)"
						stroke-dasharray="4 4"
					/>
					<line
						x1={xOf(0.75)}
						y1={TOP}
						x2={xOf(0.75)}
						y2={plotY1}
						stroke="var(--chart-rule)"
						stroke-dasharray="4 4"
					/>
					<text
						x={xOf(0) - 5}
						y={TOP + 11}
						fill="var(--chart-dim)"
						font-size="10"
						text-anchor="end"
					>
						negative counts half
					</text>
					<text x={xOf(0.75) + 5} y={TOP + 11} fill="var(--chart-dim)" font-size="10">
						diminishing
					</text>
				{/if}

				<!-- Ghost (DEF without shred/ignore) then the live curve -->
				{#if ghostPath}
					<path
						d={ghostPath}
						fill="none"
						stroke="var(--chart-rule)"
						stroke-width="1.5"
						stroke-dasharray="5 4"
					/>
				{/if}
				<path
					d={mainPath}
					fill="none"
					stroke="var(--accent)"
					stroke-width="2"
					stroke-linejoin="round"
				/>

				<!-- Marker -->
				<line
					x1={markerX}
					y1={TOP}
					x2={markerX}
					y2={plotY1}
					stroke="var(--chart-dim)"
					stroke-dasharray="2 3"
				/>
				<circle
					cx={markerX}
					cy={markerY}
					r="4"
					fill="var(--accent)"
					style="stroke: var(--frame-bg)"
					stroke-width="1.5"
				/>
			</svg>
		</div>
	</div>

	<div class="dr-panels panels">
		<div class="panel">
			<p class="kicker">Hidden Multiplier</p>
			<div class="chips">
				<button
					class="chip chip--control"
					class:active={view === 'res'}
					onclick={() => (view = 'res')}
				>
					Enemy RES
				</button>
				<button
					class="chip chip--control"
					class:active={view === 'def'}
					onclick={() => (view = 'def')}
				>
					Enemy DEF
				</button>
			</div>
			{#if view === 'res'}
				<p class="note">
					Every hit is cut by the enemy's elemental resistance — most enemies resist 10%. Shred
					subtracts from it, and pushing BELOW zero still helps: each negative point counts half.
					<span class="dr-formula">res &lt; 0: 1−res/2 · 0–75%: 1−res · ≥75%: 1/(4·res+1)</span>
				</p>
			{:else}
				<p class="note">
					Your level against the enemy's sets a baseline cut — equal levels already cost you half.
					DEF shred and DEF ignore claw it back, and they multiply together.
					<span class="dr-formula"
						>(100+yours) / ((100+yours) + (100+enemy)·(1−shred)·(1−ignore))</span
					>
				</p>
			{/if}
		</div>

		<div class="panel">
			<p class="kicker">{view === 'res' ? 'Enemy & Shred' : 'Levels & Shred'}</p>
			{#if view === 'res'}
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Enemy RES</span>
						<span class="readout">{baseRes}%</span>
					</div>
					<input
						type="range"
						min="-50"
						max="100"
						step="5"
						bind:value={baseRes}
						class="slider"
						aria-label="Enemy base resistance percent"
					/>
				</div>
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">RES Shred</span>
						<span class="readout">{resShred}%</span>
					</div>
					<input
						type="range"
						min="0"
						max="100"
						step="5"
						bind:value={resShred}
						class="slider"
						aria-label="Resistance shred percent"
					/>
				</div>
				<p class="note">The classic 4pc Viridescent Venerer swirl is a 40% shred.</p>
			{:else}
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Your Level</span>
						<span class="readout">{charLevel}</span>
					</div>
					<input
						type="range"
						min="1"
						max="90"
						step="1"
						bind:value={charLevel}
						class="slider"
						aria-label="Character level"
					/>
				</div>
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Enemy Level</span>
						<span class="readout">{enemyLevel}</span>
					</div>
					<input
						type="range"
						min="1"
						max={ENEMY_LEVEL_MAX}
						step="1"
						bind:value={enemyLevel}
						class="slider"
						aria-label="Enemy level"
					/>
				</div>
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">DEF Shred</span>
						<span class="readout">{defShred}%</span>
					</div>
					<input
						type="range"
						min="0"
						max="90"
						step="5"
						bind:value={defShred}
						class="slider"
						aria-label="Defense shred percent"
					/>
				</div>
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">DEF Ignore</span>
						<span class="readout">{defIgnore}%</span>
					</div>
					<input
						type="range"
						min="0"
						max="100"
						step="5"
						bind:value={defIgnore}
						class="slider"
						aria-label="Defense ignore percent"
					/>
				</div>
			{/if}
		</div>

		<div class="panel panel--paper">
			<p class="kicker">Readout</p>
			{#if view === 'res'}
				<p class="dr-big">
					×{resNow.toFixed(3)}<span class="dr-big-unit">of your damage gets through</span>
				</p>
				<p class="dr-meta">
					Final RES: <span class="dr-strong">{fmtPct(finalRes, 0)}</span>
				</p>
				<p class="dr-meta">
					Your shred is worth
					<span class="dr-strong">+{((resNow / resBase - 1) * 100).toFixed(1)}%</span> damage here
				</p>
				<p class="note">{regimeText}</p>
			{:else}
				<p class="dr-big">
					×{defNow.toFixed(3)}<span class="dr-big-unit">of your damage gets through</span>
				</p>
				<p class="dr-meta">
					Without shred/ignore: <span class="dr-strong">×{defBase.toFixed(3)}</span>
				</p>
				<p class="dr-meta">
					Your modifiers are worth
					<span class="dr-strong">+{((defNow / defBase - 1) * 100).toFixed(1)}%</span> damage here
				</p>
				<p class="note">
					Both views are pure multipliers — combine them with everything else your hit carries.
				</p>
			{/if}
		</div>
	</div>
</div>

<style>
	/* No frame — the chart is on the night; .ctx-dark stays claimed for
	   --frame-bg. See .gx-chart / app.css's `.frame` retirement note. */
	.dr-chart {
		min-width: 0;
	}

	.dr-graph svg {
		display: block;
	}

	.dr-graph text {
		font-family: var(--font-body);
	}

	.dr-big {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	.dr-big-unit {
		margin-left: 0.4rem;
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.dr-meta {
		margin: 0;
		font-size: var(--fs-xl);
		line-height: 1.5rem;
		color: var(--muted);
	}

	.dr-strong {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	/* The receipt: exact formula, tucked after the plain-language line */
	.dr-formula {
		display: block;
		font-size: var(--fs-md);
		color: color-mix(in srgb, var(--muted) 70%, transparent);
	}
</style>
