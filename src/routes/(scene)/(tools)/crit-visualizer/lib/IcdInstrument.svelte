<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { simulateIcd, uniformHitTimes, STANDARD_ICD, type IcdParams } from './icd';
	import { icdHitsToGaugeApps, type HandoffMessage } from './workspace';

	const ELEMENTS = ['pyro', 'hydro', 'anemo', 'electro', 'cryo', 'geo', 'dendro'] as const;
	type ElementId = (typeof ELEMENTS)[number];
	type Preset = 'standard' | 'none' | 'custom';

	// Workspace handoff outlet — present only when a workspace hosts us
	let { onHandoff }: { onHandoff?: (msg: HandoffMessage) => void } = $props();

	// Attack string
	let interval = $state(0.5);
	let hitCount = $state(12);

	// Rough real-world anchors so "hit interval" means something before a
	// player knows their frame data — deliberately approximate (~).
	const ANCHORS = [
		{ label: '~0.45s typical string', v: 0.45 },
		{ label: '~1s off-field ticks', v: 1 },
		{ label: '~2s burst ticks', v: 2 }
	];

	// ICD rule
	let preset = $state<Preset>('standard');
	let customTimer = $state(2.5);
	let customHits = $state(3);

	// Purely presentational — which element colors the applications
	let element = $state<ElementId>('electro');

	export function reset() {
		interval = 0.5;
		hitCount = 12;
		preset = 'standard';
		customTimer = 2.5;
		customHits = 3;
		element = 'electro';
	}

	const params = $derived<IcdParams>(
		preset === 'standard'
			? STANDARD_ICD
			: preset === 'none'
				? { timer: 0, hits: 1 }
				: { timer: customTimer, hits: customHits }
	);

	const sim = $derived(simulateIcd(uniformHitTimes(hitCount, interval), params));
	const apps = $derived(sim.filter((h) => h.applies).length);
	const duration = $derived(interval * Math.max(1, hitCount - 1));
	const appsPerSecond = $derived(apps / Math.max(duration, interval));

	// ── Graph geometry — pixel-true (width measured, not viewBox-scaled) ──────
	let graphW = $state(720);
	const H = 210;
	const M = { left: 16, right: 16, top: 24 };
	const ROW = { hitTop: 52, hitBottom: 104, counterY: 124, bandTop: 138, bandH: 10, legendY: 188 };

	const domain = $derived(Math.max(duration + interval, params.timer + 0.5, 3));
	const xOf = $derived((t: number) => M.left + (t / domain) * (graphW - M.left - M.right));
	const seconds = $derived(Array.from({ length: Math.floor(domain) + 1 }, (_, i) => i));

	const el = $derived(`var(--el-${element}-main)`);
</script>

<div class="icd-instrument">
	<!-- Hit timeline: which hits actually apply their element -->
	<div class="icd-frame frame ctx-dark">
		<div class="icd-graph" bind:clientWidth={graphW}>
			<svg width={graphW} height={H} role="img" aria-label="ICD hit timeline">
				<!-- Second grid -->
				{#each seconds as s (s)}
					<line
						x1={xOf(s)}
						y1={M.top}
						x2={xOf(s)}
						y2={ROW.bandTop + ROW.bandH + 6}
						stroke="rgba(255,255,255,0.07)"
					/>
					<text
						x={xOf(s)}
						y={M.top - 8}
						fill="rgba(255,255,255,0.5)"
						font-size="10"
						text-anchor="middle"
					>
						{s}s
					</text>
				{/each}

				<!-- ICD timer windows (each starts on a timer-driven application) -->
				{#if params.timer > 0}
					{#each sim.filter((h) => h.viaTimer) as h (h.time)}
						<!-- 2px end gap + bright start notch keep contiguous windows readable -->
						<rect
							x={xOf(h.time)}
							y={ROW.bandTop}
							width={Math.max(2, xOf(Math.min(h.time + params.timer, domain)) - xOf(h.time) - 2)}
							height={ROW.bandH}
							rx="2"
							fill={el}
							opacity="0.22"
						/>
						<line
							x1={xOf(h.time)}
							y1={ROW.bandTop - 1}
							x2={xOf(h.time)}
							y2={ROW.bandTop + ROW.bandH + 1}
							stroke={el}
							stroke-width="2"
							opacity="0.75"
						/>
					{/each}
				{/if}

				<!-- Baseline -->
				<line
					x1={M.left}
					y1={ROW.hitBottom}
					x2={graphW - M.right}
					y2={ROW.hitBottom}
					stroke="rgba(255,255,255,0.16)"
				/>

				<!-- Hits: applying hits get the element color + a dot; blocked hits are
				     short dim ticks. Below each hit, its hit-counter value. -->
				{#each sim as h (h.time)}
					{#if h.applies}
						<line
							x1={xOf(h.time)}
							y1={ROW.hitTop}
							x2={xOf(h.time)}
							y2={ROW.hitBottom}
							stroke={el}
							stroke-width="2.5"
						/>
						<image
							href={elementIcon(element)}
							x={xOf(h.time) - 8}
							y={ROW.hitTop - 20}
							width="16"
							height="16"
						/>
					{:else}
						<line
							x1={xOf(h.time)}
							y1={ROW.hitTop + 18}
							x2={xOf(h.time)}
							y2={ROW.hitBottom}
							stroke="rgba(255,255,255,0.3)"
							stroke-width="1.5"
						/>
					{/if}
					<text
						x={xOf(h.time)}
						y={ROW.counterY}
						fill={h.applies ? el : 'rgba(255,255,255,0.42)'}
						font-size="10"
						font-weight={h.applies ? 700 : 400}
						text-anchor="middle"
					>
						{h.count}
					</text>
				{/each}

				<!-- Legend -->
				<image href={elementIcon(element)} x={M.left} y={ROW.legendY - 6} width="12" height="12" />
				<text x={M.left + 16} y={ROW.legendY + 3.5} fill="rgba(255,255,255,0.55)" font-size="10">
					applies element
				</text>
				<line
					x1={M.left + 122}
					y1={ROW.legendY - 5}
					x2={M.left + 122}
					y2={ROW.legendY + 5}
					stroke="rgba(255,255,255,0.3)"
					stroke-width="1.5"
				/>
				<text x={M.left + 131} y={ROW.legendY + 3.5} fill="rgba(255,255,255,0.55)" font-size="10">
					blocked hit
				</text>
				<text x={M.left + 214} y={ROW.legendY + 3.5} fill="rgba(255,255,255,0.55)" font-size="10">
					1 2 3 = hit counter
				</text>
				{#if params.timer > 0}
					<rect
						x={M.left + 352}
						y={ROW.legendY - 5}
						width="18"
						height="10"
						rx="2"
						fill={el}
						opacity="0.22"
					/>
					<text x={M.left + 378} y={ROW.legendY + 3.5} fill="rgba(255,255,255,0.55)" font-size="10">
						ICD timer window
					</text>
				{/if}
			</svg>
		</div>
	</div>

	<div class="icd-panels panels">
		<div class="panel">
			<p class="kicker">Attack String</p>
			<div class="slider-control">
				<div class="slider-header">
					<span class="slider-label">Hit Interval</span>
					<span class="readout">{interval.toFixed(2)}s</span>
				</div>
				<input
					type="range"
					min="0.1"
					max="3"
					step="0.05"
					bind:value={interval}
					class="slider"
					aria-label="Hit interval in seconds"
				/>
			</div>
			<div class="slider-control">
				<div class="slider-header">
					<span class="slider-label">Hits</span>
					<span class="readout">{hitCount}</span>
				</div>
				<input
					type="range"
					min="5"
					max="30"
					step="1"
					bind:value={hitCount}
					class="slider"
					aria-label="Number of hits"
				/>
			</div>
			<div class="chips icd-anchors">
				{#each ANCHORS as a (a.v)}
					<button
						class="chip chip--control"
						class:active={interval === a.v}
						onclick={() => (interval = a.v)}
					>
						{a.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="panel">
			<p class="kicker">ICD Rule</p>
			<p class="note">
				Internal Cooldown — the hidden rule that stops every hit from applying its element.
			</p>
			<div class="chips">
				<button
					class="chip chip--control"
					class:active={preset === 'standard'}
					onclick={() => (preset = 'standard')}
				>
					Standard
				</button>
				<button
					class="chip chip--control"
					class:active={preset === 'none'}
					onclick={() => (preset = 'none')}
				>
					No ICD
				</button>
				<button
					class="chip chip--control"
					class:active={preset === 'custom'}
					onclick={() => (preset = 'custom')}
				>
					Custom
				</button>
			</div>
			{#if preset === 'standard'}
				<p class="note">2.5s timer · every 3rd hit</p>
			{:else if preset === 'none'}
				<p class="note">Every hit applies its element</p>
			{:else}
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Timer</span>
						<span class="readout">{customTimer.toFixed(1)}s</span>
					</div>
					<input
						type="range"
						min="0.5"
						max="5"
						step="0.1"
						bind:value={customTimer}
						class="slider"
						aria-label="ICD timer in seconds"
					/>
				</div>
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Hit Counter</span>
						<span class="readout">{customHits}</span>
					</div>
					<input
						type="range"
						min="1"
						max="5"
						step="1"
						bind:value={customHits}
						class="slider"
						aria-label="ICD hit counter"
					/>
				</div>
			{/if}
		</div>

		<div class="panel">
			<p class="kicker">Element</p>
			<div class="icd-elements">
				{#each ELEMENTS as e (e)}
					<button
						class="chip chip--icon icd-el"
						class:active={element === e}
						style:--chip-color="var(--el-{e}-main)"
						onclick={() => (element = e)}
						aria-label={e}
						title={e}
					>
						<img src={elementIcon(e)} alt="" width="20" height="20" />
					</button>
				{/each}
			</div>
			<p class="note">Presentation only — ICD rules are element-agnostic</p>
		</div>

		<div class="panel">
			<p class="kicker">Readout</p>
			<p class="icd-big">
				{apps}<span class="icd-big-unit"> of {hitCount} hits apply</span>
			</p>
			<p class="icd-meta">
				Application rate: <span class="icd-strong">{appsPerSecond.toFixed(2)} /s</span>
			</p>
			<p class="icd-meta">
				One application per <span class="icd-strong"
					>{(hitCount / Math.max(apps, 1)).toFixed(1)}</span
				> hits
			</p>
			{#if onHandoff}
				<button
					class="btn btn--primary icd-send"
					disabled={apps === 0}
					title="Each application arrives as 1U — ICD doesn't know gauge sizes"
					onclick={() =>
						onHandoff({
							target: 'gauge',
							kind: 'applications',
							payload: icdHitsToGaugeApps(sim, element)
						})}
				>
					Send to Gauge Explorer →
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.icd-instrument {
		height: 100%;
		min-height: 0;
		overflow-y: auto;
		container-type: inline-size;
		container-name: icd;
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	/* Chart frame: same treatment as the heatmap — dark chart field, Dire-tinted
	   border, tight radius */
	.icd-frame {
		padding: 0.4rem 0.6rem 0.2rem;
		border-radius: 9px;
	}

	.icd-graph svg {
		display: block;
	}

	.icd-graph text {
		font-family: var(--font-body);
	}

	/* ── Panels (workspace form language) ──────────────────────────────────── */

	/* ── Sliders ───────────────────────────────────────────────────────────── */

	/* ── Preset chips ──────────────────────────────────────────────────────── */

	/* ── Element picker ────────────────────────────────────────────────────── */

	/* .chip--icon at 28px — a touch larger than the 23px default because this
	   picker is the instrument's primary control, not a dense row. */
	.icd-el {
		width: 28px;
		height: 28px;
	}

	.icd-elements {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	/* ── Readout ───────────────────────────────────────────────────────────── */

	.icd-big {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	.icd-big-unit {
		margin-left: 0.4rem;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.icd-meta {
		margin: 0;
		font-size: var(--fs-lg);
		line-height: 1.5rem;
		color: var(--muted);
	}

	.icd-strong {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	/* .btn--primary; only its placement in the grid is local. */
	.icd-send {
		justify-self: start;
		margin-top: 0.35rem;
	}

	.icd-anchors {
		margin-top: 0.1rem;
	}

	.icd-anchors :global(.chip) {
		font-family: var(--font-condensed);
		text-transform: none;
		letter-spacing: var(--ls-mid);
	}
</style>
