<script lang="ts">
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

	// Ghost comparison: the same string with no ICD at all — what looser
	// application rules would actually buy
	let compareNone = $state(false);

	// Purely presentational — which element colors the applications
	let element = $state<ElementId>('electro');

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

	// Ghost lane only means something while a real ICD is limiting the string
	const showGhost = $derived(compareNone && preset !== 'none');
	const ghostExtra = $derived(showGhost ? hitCount - apps : 0);

	// ── Graph geometry — pixel-true (width measured, not viewBox-scaled) ──────
	let graphW = $state(720);
	const GHOST_H = 34; // extra lane when the no-ICD ghost is shown
	const H = $derived(showGhost ? 210 + GHOST_H : 210);
	const M = { left: 16, right: 16, top: 24 };
	const ROW = $derived({
		hitTop: 52,
		hitBottom: 104,
		counterY: 124,
		ghostTop: 140,
		bandTop: showGhost ? 138 + GHOST_H : 138,
		bandH: 10,
		legendY: showGhost ? 188 + GHOST_H : 188
	});

	const domain = $derived(Math.max(duration + interval, params.timer + 0.5, 3));
	const xOf = $derived((t: number) => M.left + (t / domain) * (graphW - M.left - M.right));
	const seconds = $derived(Array.from({ length: Math.floor(domain) + 1 }, (_, i) => i));

	const el = $derived(`var(--el-${element}-main)`);
</script>

<div class="icd-instrument">
	<!-- Hit timeline: which hits actually apply their element -->
	<div class="icd-frame vz-anim-frame">
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
							href="/assets/elements/flat-color/{element}.png"
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

				<!-- Ghost lane: the same string with no ICD — bright ticks are the
				     applications the rule is currently blocking -->
				{#if showGhost}
					<text x={M.left} y={ROW.ghostTop - 4} fill="rgba(255,255,255,0.45)" font-size="10">
						if no ICD — bright ticks are the extra applications
					</text>
					{#each sim as h (h.time)}
						<line
							x1={xOf(h.time)}
							y1={ROW.ghostTop + 2}
							x2={xOf(h.time)}
							y2={ROW.ghostTop + 16}
							stroke={el}
							stroke-width="2"
							opacity={h.applies ? 0.28 : 0.85}
						/>
					{/each}
				{/if}

				<!-- Legend -->
				<image
					href="/assets/elements/flat-color/{element}.png"
					x={M.left}
					y={ROW.legendY - 6}
					width="12"
					height="12"
				/>
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

	<div class="icd-panels">
		<div class="vz-panel">
			<p class="vz-kicker">Attack String</p>
			<div class="vz-slider-control">
				<div class="vz-slider-header">
					<span class="vz-slider-label">Hit Interval</span>
					<span class="vz-value">{interval.toFixed(2)}s</span>
				</div>
				<input
					type="range"
					min="0.1"
					max="3"
					step="0.05"
					bind:value={interval}
					class="vz-slider"
					aria-label="Hit interval in seconds"
				/>
			</div>
			<div class="vz-slider-control">
				<div class="vz-slider-header">
					<span class="vz-slider-label">Hits</span>
					<span class="vz-value">{hitCount}</span>
				</div>
				<input
					type="range"
					min="5"
					max="30"
					step="1"
					bind:value={hitCount}
					class="vz-slider"
					aria-label="Number of hits"
				/>
			</div>
			<div class="vz-chips icd-anchors">
				{#each ANCHORS as a (a.v)}
					<button class="vz-chip" class:active={interval === a.v} onclick={() => (interval = a.v)}>
						{a.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="vz-panel">
			<p class="vz-kicker">ICD Rule</p>
			<p class="icd-note">
				Internal Cooldown — the hidden rule that stops every hit from applying its element.
			</p>
			<div class="vz-chips">
				<button
					class="vz-chip"
					class:active={preset === 'standard'}
					onclick={() => (preset = 'standard')}
				>
					Standard
				</button>
				<button class="vz-chip" class:active={preset === 'none'} onclick={() => (preset = 'none')}>
					No ICD
				</button>
				<button
					class="vz-chip"
					class:active={preset === 'custom'}
					onclick={() => (preset = 'custom')}
				>
					Custom
				</button>
			</div>
			{#if preset !== 'none'}
				<label class="icd-ghost-toggle">
					<input type="checkbox" bind:checked={compareNone} />
					Compare against no ICD
				</label>
			{/if}
			{#if preset === 'standard'}
				<p class="icd-note">2.5s timer · every 3rd hit</p>
			{:else if preset === 'none'}
				<p class="icd-note">Every hit applies its element</p>
			{:else}
				<div class="vz-slider-control">
					<div class="vz-slider-header">
						<span class="vz-slider-label">Timer</span>
						<span class="vz-value">{customTimer.toFixed(1)}s</span>
					</div>
					<input
						type="range"
						min="0.5"
						max="5"
						step="0.1"
						bind:value={customTimer}
						class="vz-slider"
						aria-label="ICD timer in seconds"
					/>
				</div>
				<div class="vz-slider-control">
					<div class="vz-slider-header">
						<span class="vz-slider-label">Hit Counter</span>
						<span class="vz-value">{customHits}</span>
					</div>
					<input
						type="range"
						min="1"
						max="5"
						step="1"
						bind:value={customHits}
						class="vz-slider"
						aria-label="ICD hit counter"
					/>
				</div>
			{/if}
		</div>

		<div class="vz-panel">
			<p class="vz-kicker">Element</p>
			<div class="icd-elements">
				{#each ELEMENTS as e (e)}
					<button
						class="icd-el"
						class:active={element === e}
						style:--el="var(--el-{e}-main)"
						onclick={() => (element = e)}
						aria-label={e}
						title={e}
					>
						<img src="/assets/elements/flat-color/{e}.png" alt="" width="20" height="20" />
					</button>
				{/each}
			</div>
			<p class="icd-note">Presentation only — ICD rules are element-agnostic</p>
		</div>

		<div class="vz-panel">
			<p class="vz-kicker">Readout</p>
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
			{#if showGhost}
				<p class="icd-meta">
					No ICD would add <span class="icd-strong">{ghostExtra}</span> more application{ghostExtra ===
					1
						? ''
						: 's'}
				</p>
			{/if}
			{#if onHandoff}
				<button
					class="icd-send"
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
		font-family: var(--font-mono);
	}

	/* ── Panels (workspace form language) ──────────────────────────────────── */

	.icd-panels {
		display: grid;
		gap: 1rem;
		align-items: start;
	}

	@container icd (min-width: 44rem) {
		.icd-panels {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@container icd (min-width: 72rem) {
		.icd-panels {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	/* ── Sliders ───────────────────────────────────────────────────────────── */

	/* ── Preset chips ──────────────────────────────────────────────────────── */

	/* ── Element picker ────────────────────────────────────────────────────── */

	.icd-elements {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.icd-el {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: none;
		border-radius: 7px;
		background: none;
		opacity: 0.45;
		cursor: pointer;
		transition:
			opacity 150ms ease,
			box-shadow 150ms ease,
			background 150ms ease;
	}

	.icd-el img {
		width: 20px;
		height: 20px;
	}

	.icd-el:hover {
		opacity: 0.8;
	}

	.icd-el.active {
		opacity: 1;
		background: color-mix(in srgb, var(--el) 15%, transparent);
		box-shadow: inset 0 0 0 1.5px var(--el);
	}

	/* ── Readout ───────────────────────────────────────────────────────────── */

	.icd-big {
		margin: 0;
		font-family: var(--font-mono);
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
		font-family: var(--font-mono);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.icd-note {
		margin: 0;
		font-size: var(--fs-md);
		color: var(--muted);
	}

	.icd-anchors {
		margin-top: 0.1rem;
	}

	.icd-anchors :global(.vz-chip) {
		font-family: var(--font-condensed);
		text-transform: none;
		letter-spacing: var(--ls-mid);
	}

	.icd-ghost-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--fs-md);
		color: var(--muted);
	}

	.icd-ghost-toggle input {
		accent-color: var(--accent);
	}

	.icd-send {
		justify-self: start;
		margin-top: 0.35rem;
		padding: 0.42rem 0.95rem;
		border: none;
		border-radius: 3px;
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 50%, transparent);
		color: var(--text);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			background 150ms ease,
			box-shadow 150ms ease;
	}

	.icd-send:hover:not(:disabled) {
		background: color-mix(in srgb, var(--accent) 30%, transparent);
	}

	.icd-send:disabled {
		opacity: 0.45;
		cursor: default;
	}
</style>
