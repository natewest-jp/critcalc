<script lang="ts">
	import {
		simulateGauge,
		gaugesAt,
		GAUGE_OPTIONS,
		type Application,
		type AuraKey,
		type ElementId,
		type ReactionKind,
		type SimEvent
	} from './gauge';

	const ELEMENTS: ElementId[] = ['pyro', 'hydro', 'anemo', 'electro', 'cryo', 'geo', 'dendro'];

	type ModMeta = { label: string; icon: string; color: string; dash?: string };
	const MOD_META: Record<AuraKey, ModMeta> = {
		pyro: { label: 'Pyro', icon: 'pyro', color: 'var(--el-pyro-main)' },
		burning: {
			label: 'Burning',
			icon: 'pyro',
			color: 'var(--rx-burning)'
		},
		burningFuel: {
			label: 'Fuel',
			icon: 'dendro',
			color: 'var(--rx-burning-fuel)',
			dash: '5 4'
		},
		hydro: { label: 'Hydro', icon: 'hydro', color: 'var(--el-hydro-main)' },
		cryo: { label: 'Cryo', icon: 'cryo', color: 'var(--el-cryo-main)' },
		frozen: { label: 'Frozen', icon: 'cryo', color: 'var(--rx-frozen)' },
		electro: { label: 'Electro', icon: 'electro', color: 'var(--el-electro-main)' },
		dendro: { label: 'Dendro', icon: 'dendro', color: 'var(--el-dendro-main)' },
		quicken: {
			label: 'Quicken',
			icon: 'dendro',
			color: 'var(--rx-quicken)'
		}
	};
	const MOD_ORDER: AuraKey[] = [
		'pyro',
		'burning',
		'burningFuel',
		'hydro',
		'cryo',
		'frozen',
		'electro',
		'dendro',
		'quicken'
	];

	const REACTION_NAME: Record<ReactionKind, string> = {
		vaporize: 'Vaporize ×2',
		reverseVaporize: 'Vaporize ×1.5',
		melt: 'Melt ×2',
		reverseMelt: 'Melt ×1.5',
		overload: 'Overload',
		superconduct: 'Superconduct',
		electroCharged: 'Electro-Charged',
		freeze: 'Freeze',
		swirl: 'Swirl',
		crystallize: 'Crystallize',
		crystallizeBlocked: 'Crystallize (blocked)',
		quicken: 'Quicken',
		aggravate: 'Aggravate',
		spread: 'Spread',
		bloom: 'Bloom',
		quickenBloom: 'Bloom (via Quicken)',
		burning: 'Burning'
	};

	type PresetDef = {
		id: string;
		label: string;
		note: string;
		apps: [number, ElementId, number][];
	};
	const PRESETS: PresetDef[] = [
		{
			id: 'single',
			label: 'Single Aura',
			note: '2U Pyro lands as 1.6U after the ×0.8 aura tax, then decays out over 2.5 × 2 + 7 = 12s.',
			apps: [[0, 'pyro', 2]]
		},
		{
			id: 'topup',
			label: 'Top-Up',
			note: 'Re-applying the same element tops the gauge up but keeps the FIRST application’s decay rate — 4U onto a 1U aura drains at the slow 1U rate and lasts 38s.',
			apps: [
				[0, 'electro', 1],
				[3, 'electro', 4]
			]
		},
		{
			id: 'vape',
			label: 'Vaporize',
			note: 'Hydro on Pyro is the strong direction: the trigger consumes 2× its own gauge.',
			apps: [
				[0, 'pyro', 2],
				[2.5, 'hydro', 1]
			]
		},
		{
			id: 'melt',
			label: 'Reverse Melt',
			note: 'Cryo on Pyro is the weak direction (×0.5) — repeated 1U triggers only nibble at a 4U aura.',
			apps: [
				[0, 'pyro', 4],
				[2, 'cryo', 1],
				[4, 'cryo', 1]
			]
		},
		{
			id: 'swirl',
			label: 'Swirl',
			note: 'Anemo consumes at ×0.5 and can never attach as an aura.',
			apps: [
				[0, 'pyro', 2],
				[2, 'anemo', 2]
			]
		},
		{
			id: 'crystallize',
			label: 'Crystallize',
			note: 'Geo consumes at ×0.5 with a 1s reaction cooldown — an attempt inside the window is blocked and takes no gauge at all.',
			apps: [
				[0, 'electro', 2],
				[1, 'geo', 1],
				[1.5, 'geo', 1],
				[2.5, 'geo', 1]
			]
		},
		{
			id: 'ec',
			label: 'Electro-Charged',
			note: 'Hydro and Electro coexist; each tick drains 0.4U from BOTH gauges until one side empties.',
			apps: [
				[0, 'hydro', 2],
				[1, 'electro', 2]
			]
		},
		{
			id: 'freeze',
			label: 'Freeze',
			note: 'Frozen forms at 2 × min(aura, trigger) and decays on its own accelerating clock; leftover Hydro keeps ticking down underneath.',
			apps: [
				[0, 'hydro', 2],
				[1.5, 'cryo', 1]
			]
		},
		{
			id: 'quicken',
			label: 'Quicken',
			note: 'Quicken forms 1:1 and lives 5 × gauge + 6s. Aggravate hits on it consume nothing — but the same hit can re-Quicken off leftover Dendro.',
			apps: [
				[0, 'dendro', 2],
				[1.5, 'electro', 1],
				[3, 'electro', 1]
			]
		},
		{
			id: 'bloom',
			label: 'Bloom',
			note: 'Hydro is the weak side of Bloom (2:1) — a 2U Hydro trigger removes only 1U of Dendro and spawns a Dendro Core.',
			apps: [
				[0, 'dendro', 2],
				[2, 'hydro', 2]
			]
		},
		{
			id: 'burning',
			label: 'Burning',
			note: 'Burning = a fixed 2U aura plus a hidden fuel gauge draining at 0.4 U/s, re-applying 1U Pyro to the target every 0.25s until the fuel runs dry.',
			apps: [
				[0, 'dendro', 2],
				[2, 'pyro', 1]
			]
		},
		{
			id: 'pyroec',
			label: 'Pyro on EC',
			note: 'One Pyro hit on an Electro-Charged target triggers Overload AND Vaporize — leftover trigger gauge flows down the reaction priority list.',
			apps: [
				[0, 'hydro', 2],
				[0.5, 'electro', 2],
				[1.5, 'pyro', 2]
			]
		}
	];

	const MAX_APPS = 8;

	let preset = $state('single');
	let appRows = $state<Application[]>(
		PRESETS[0].apps.map(([time, element, gauge]) => ({ time, element, gauge }))
	);
	let hoverT = $state<number | null>(null);

	function loadPreset(p: PresetDef) {
		preset = p.id;
		appRows = p.apps.map(([time, element, gauge]) => ({ time, element, gauge }));
	}
	const markCustom = () => (preset = 'custom');

	function addRow() {
		if (appRows.length >= MAX_APPS) return;
		const last = appRows[appRows.length - 1];
		appRows.push({ time: Math.min(15, (last?.time ?? 0) + 2), element: 'pyro', gauge: 1 });
		markCustom();
	}
	function removeRow(i: number) {
		appRows.splice(i, 1);
		markCustom();
	}

	const presetNote = $derived(PRESETS.find((p) => p.id === preset)?.note ?? null);

	const sim = $derived(simulateGauge(appRows));
	const lastAppTime = $derived(appRows.reduce((m, a) => Math.max(m, a.time), 0));

	// ── Geometry (pixel-true; width measured) ────────────────────────────────
	let graphW = $state(720);
	const PADL = 58;
	const PADR = 14;
	const TOP = 54; // application marker band
	const PLOT_H = 176;
	const plotY1 = TOP + PLOT_H;
	const AXIS_H = 24;
	const stripY0 = plotY1 + AXIS_H;
	const ROW_H = 18;

	const domain = $derived(Math.max(Math.ceil(Math.max(sim.duration + 0.4, lastAppTime + 2)), 8));
	const uMax = $derived(
		Math.max(
			2,
			Math.ceil(
				sim.series.reduce((m, s) => s.points.reduce((n, p) => Math.max(n, p.u), m), 0) * 2
			) / 2
		)
	);
	const tickStep = $derived(domain <= 16 ? 1 : domain <= 32 ? 2 : 5);
	const ticks = $derived(
		Array.from({ length: Math.floor(domain / tickStep) + 1 }, (_, i) => i * tickStep)
	);
	const uTicks = $derived(Array.from({ length: Math.floor(uMax * 2) + 1 }, (_, i) => i / 2));

	const xOf = $derived((t: number) => PADL + (t / domain) * (graphW - PADL - PADR));
	const yOf = $derived((u: number) => plotY1 - (u / uMax) * (PLOT_H - 10));

	const stripRows = $derived(
		MOD_ORDER.filter((mod) => sim.series.some((s) => s.key === mod)).map((mod, i) => ({
			mod,
			meta: MOD_META[mod],
			y: stripY0 + i * ROW_H,
			intervals: sim.series
				.filter((s) => s.key === mod)
				.map(({ points }) => ({ t0: points[0].t, t1: points[points.length - 1].t }))
		}))
	);
	const svgH = $derived(stripY0 + stripRows.length * ROW_H + 6);

	const paths = $derived(
		sim.series.map(({ key, points }) => ({
			meta: MOD_META[key],
			d: points
				.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.t).toFixed(1)},${yOf(p.u).toFixed(1)}`)
				.join(' ')
		}))
	);

	const applyEvents = $derived(
		sim.events.filter((e): e is Extract<SimEvent, { kind: 'apply' }> => e.kind === 'apply')
	);
	const markers = $derived(
		applyEvents.map((e) => {
			const names = sim.events
				.filter(
					(r): r is Extract<SimEvent, { kind: 'reaction' }> =>
						r.kind === 'reaction' && r.appIndex === e.appIndex
				)
				.map((r) => REACTION_NAME[r.reaction]);
			return {
				x: xOf(e.time),
				n: e.appIndex + 1,
				color: `var(--el-${e.element}-main)`,
				gauge: `${e.gauge}U`,
				labels: names.length > 2 ? [...names.slice(0, 2), `+${names.length - 2} more`] : names
			};
		})
	);
	const cores = $derived(sim.events.filter((e) => e.kind === 'core'));

	// ── Event log (burning self-ticks hidden; EC drains collapsed into runs) ──
	type LogRow =
		| { kind: 'event'; event: SimEvent }
		| { kind: 'ecRun'; t0: number; t1: number; count: number };
	const logRows = $derived.by(() => {
		const rows: LogRow[] = [];
		for (const event of sim.events) {
			if (event.kind === 'burningTick') continue;
			if (event.kind === 'ecTick') {
				const last = rows[rows.length - 1];
				if (last?.kind === 'ecRun') {
					last.t1 = event.time;
					last.count += 1;
				} else {
					rows.push({ kind: 'ecRun', t0: event.time, t1: event.time, count: 1 });
				}
				continue;
			}
			rows.push({ kind: 'event', event });
		}
		return rows;
	});

	const fmtU = (u: number) => `${u.toFixed(2).replace(/\.?0+$/, '')}U`;
	const fmtT = (t: number) => `${t.toFixed(2)}s`;
	const consumedText = (list: { mod: AuraKey; amount: number }[]) =>
		list.map((c) => `−${fmtU(c.amount)} ${MOD_META[c.mod].label}`).join(', ');

	function attachText(e: Extract<SimEvent, { kind: 'apply' }>): string {
		switch (e.attach) {
			case 'new':
				return `applies ${fmtU(e.auraAfter)} aura (×0.8 tax)`;
			case 'topUp':
				return `tops the aura up to ${fmtU(e.auraAfter)} — original decay rate kept`;
			case 'pyroRefresh':
				return `refreshes Pyro to ${fmtU(e.auraAfter)} and re-derives its decay rate`;
			case 'tooWeak':
				return 'weaker than the remaining Pyro — no effect on the aura';
			case 'none':
				return e.element === 'anemo' || e.element === 'geo'
					? 'Anemo/Geo never attach as an aura'
					: 'trigger fully reacted — nothing attaches';
		}
	}

	// ── Pointer scrub ──────────────────────────────────────────────────────────
	function onMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		hoverT = Math.min(domain, Math.max(0, ((x - PADL) / (graphW - PADL - PADR)) * domain));
	}
	const hoverGauges = $derived(
		hoverT === null
			? null
			: MOD_ORDER.flatMap((mod) => {
					const u = gaugesAt(sim.series, hoverT!)[mod];
					return u === undefined ? [] : [{ mod, meta: MOD_META[mod], u }];
				})
	);
</script>

<div class="gx-instrument">
	<div class="gx-frame">
		<div class="gx-graph" bind:clientWidth={graphW}>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<svg
				width={graphW}
				height={svgH}
				role="img"
				aria-label="Elemental gauge decay timeline"
				onpointermove={onMove}
				onpointerleave={() => (hoverT = null)}
			>
				<!-- Time grid -->
				{#each ticks as s (s)}
					<line x1={xOf(s)} y1={TOP} x2={xOf(s)} y2={plotY1} stroke="rgba(255,255,255,0.07)" />
					<text
						x={xOf(s)}
						y={plotY1 + 14}
						fill="rgba(255,255,255,0.5)"
						font-size="10"
						text-anchor="middle"
					>
						{s}s
					</text>
				{/each}

				<!-- Gauge grid -->
				{#each uTicks as u (u)}
					<line
						x1={PADL}
						y1={yOf(u)}
						x2={graphW - PADR}
						y2={yOf(u)}
						stroke="rgba(255,255,255,{u % 1 === 0 ? 0.09 : 0.04})"
					/>
					{#if u % 1 === 0}
						<text
							x={PADL - 7}
							y={yOf(u) + 3.5}
							fill="rgba(255,255,255,0.5)"
							font-size="10"
							text-anchor="end"
						>
							{u}U
						</text>
					{/if}
				{/each}

				<!-- Application markers -->
				{#each markers as m (m.n)}
					<line x1={m.x} y1={18} x2={m.x} y2={plotY1} stroke={m.color} opacity="0.28" />
					<circle cx={m.x} cy={10} r="7.5" fill={m.color} />
					<text
						x={m.x}
						y={13}
						fill="#081225"
						font-size="9.5"
						font-weight="700"
						text-anchor="middle"
					>
						{m.n}
					</text>
					<text x={m.x} y={27} fill={m.color} font-size="9" font-weight="700" text-anchor="middle">
						{m.gauge}
					</text>
					{#each m.labels as label, li (li)}
						<text
							x={m.x}
							y={38 + li * 9.5}
							fill="rgba(255,255,255,0.62)"
							font-size="8.5"
							text-anchor="middle"
						>
							{label}
						</text>
					{/each}
				{/each}

				<!-- Gauge lines -->
				{#each paths as p, pi (pi)}
					<path
						d={p.d}
						fill="none"
						stroke={p.meta.color}
						stroke-width="2"
						stroke-dasharray={p.meta.dash ?? 'none'}
						stroke-linejoin="round"
					/>
				{/each}

				<!-- Dendro cores -->
				{#each cores as c, ci (ci)}
					<circle cx={xOf(c.time)} cy={plotY1 - 5} r="4" fill="var(--rx-dendro-core)" />
					<circle
						cx={xOf(c.time)}
						cy={plotY1 - 5}
						r="7"
						fill="var(--el-dendro-main)"
						opacity="0.25"
					/>
				{/each}

				<!-- Aura presence strip ("what icon hangs over the enemy") -->
				{#each stripRows as row (row.mod)}
					<image
						href="/assets/elements/flat-color/{row.meta.icon}.png"
						x="2"
						y={row.y + 2}
						width="12"
						height="12"
					/>
					<text x={17} y={row.y + 11.5} fill={row.meta.color} font-size="8.5">
						{row.meta.label}
					</text>
					{#each row.intervals as span, si (si)}
						<rect
							x={xOf(span.t0)}
							y={row.y + 3}
							width={Math.max(2, xOf(span.t1) - xOf(span.t0))}
							height="10"
							rx="2"
							fill={row.meta.color}
							opacity="0.32"
						/>
					{/each}
				{/each}

				<!-- Hover scrub -->
				{#if hoverT !== null}
					<line
						x1={xOf(hoverT)}
						y1={TOP}
						x2={xOf(hoverT)}
						y2={stripY0 + stripRows.length * ROW_H}
						stroke="rgba(255,255,255,0.4)"
						stroke-dasharray="2 3"
					/>
				{/if}
			</svg>
		</div>
	</div>

	<div class="gx-panels">
		<div class="vz-panel">
			<p class="vz-kicker">Scenario</p>
			<div class="vz-chips">
				{#each PRESETS as p (p.id)}
					<button class="vz-chip" class:active={preset === p.id} onclick={() => loadPreset(p)}>
						{p.label}
					</button>
				{/each}
			</div>
			<p class="gx-note">
				{presetNote ?? 'Custom sequence — edit applications or pick a scenario.'}
			</p>
		</div>

		<div class="vz-panel">
			<p class="vz-kicker">Applications</p>
			{#each appRows as row, i (i)}
				<div class="gx-app">
					<div class="gx-app-line">
						<div class="gx-elements" role="radiogroup" aria-label="Element">
							{#each ELEMENTS as e (e)}
								<button
									class="gx-el"
									class:active={row.element === e}
									style:--el="var(--el-{e}-main)"
									aria-label={e}
									title={e}
									onclick={() => {
										row.element = e;
										markCustom();
									}}
								></button>
							{/each}
						</div>
						<div class="gx-gauges">
							{#each GAUGE_OPTIONS as g (g)}
								<button
									class="vz-chip vz-chip-sm"
									class:active={row.gauge === g}
									onclick={() => {
										row.gauge = g;
										markCustom();
									}}
								>
									{g}U
								</button>
							{/each}
						</div>
						<button class="gx-remove" aria-label="Remove application" onclick={() => removeRow(i)}>
							×
						</button>
					</div>
					<div class="gx-app-line">
						<input
							type="range"
							min="0"
							max="15"
							step="0.1"
							bind:value={row.time}
							oninput={markCustom}
							class="vz-slider"
							aria-label="Application time in seconds"
						/>
						<span class="gx-value">{row.time.toFixed(1)}s</span>
					</div>
				</div>
			{/each}
			{#if appRows.length < MAX_APPS}
				<button class="gx-add" onclick={addRow}>+ Add application</button>
			{/if}
		</div>

		<div class="vz-panel">
			<p class="vz-kicker">Enemy Status</p>
			{#if hoverGauges}
				<p class="gx-note">at {fmtT(hoverT!)}</p>
				{#if hoverGauges.length === 0}
					<p class="gx-meta">No aura — the next element applies fresh.</p>
				{:else}
					{#each hoverGauges as h (h.mod)}
						<p class="gx-meta gx-status-row">
							<img
								src="/assets/elements/flat-color/{h.meta.icon}.png"
								alt=""
								width="14"
								height="14"
							/>
							<span style:color={h.meta.color}>{h.meta.label}</span>
							<span class="gx-strong">{fmtU(h.u)}</span>
						</p>
					{/each}
				{/if}
			{:else}
				<p class="gx-note">Hover the chart to read the enemy’s aura state at a moment in time.</p>
				{#each stripRows as row (row.mod)}
					<p class="gx-meta gx-status-row">
						<img
							src="/assets/elements/flat-color/{row.meta.icon}.png"
							alt=""
							width="14"
							height="14"
						/>
						<span style:color={row.meta.color}>{row.meta.label}</span>
						<span class="gx-strong">
							{row.intervals.map((s) => `${s.t0.toFixed(1)}–${s.t1.toFixed(1)}s`).join(', ')}
						</span>
					</p>
				{/each}
			{/if}
		</div>

		<div class="vz-panel">
			<p class="vz-kicker">Event Log</p>
			<div class="gx-log">
				{#each logRows as row, ri (ri)}
					{#if row.kind === 'ecRun'}
						<p class="gx-log-tick">
							{row.count === 1
								? `EC tick at ${fmtT(row.t0)}`
								: `EC ticks ×${row.count} (${fmtT(row.t0)}–${fmtT(row.t1)})`}
							— −0.4U Hydro &amp; Electro each
						</p>
					{:else if row.event.kind === 'apply'}
						<p class="gx-log-apply">
							<span class="gx-log-n" style:background="var(--el-{row.event.element}-main)">
								{row.event.appIndex + 1}
							</span>
							<span class="gx-strong">{fmtT(row.event.time)}</span>
							— {MOD_META[row.event.element as AuraKey]?.label ??
								row.event.element[0].toUpperCase() + row.event.element.slice(1)}
							{row.event.gauge}U · {attachText(row.event)}
						</p>
					{:else if row.event.kind === 'reaction'}
						<p class="gx-log-reaction">
							<span class="gx-strong">{REACTION_NAME[row.event.reaction]}</span>
							{#if row.event.of && (row.event.reaction === 'swirl' || row.event.reaction === 'crystallize')}
								({MOD_META[row.event.of].label})
							{/if}
							{#if row.event.consumed.length}
								· {consumedText(row.event.consumed)}
							{:else if row.event.reaction === 'aggravate' || row.event.reaction === 'spread'}
								· no gauge consumed
							{:else if row.event.reaction === 'crystallizeBlocked'}
								· within the 1s cooldown — nothing happens
							{/if}
							{#if row.event.spent > 0}
								· spends {fmtU(row.event.spent)} of the trigger
							{/if}
							{#if row.event.appIndex === null}
								<span class="gx-dim">(burning self-tick)</span>
							{/if}
						</p>
					{:else if row.event.kind === 'expire'}
						<p class="gx-log-tick">
							{fmtT(row.event.time)} — {MOD_META[row.event.mod].label} aura decays out
						</p>
					{:else if row.event.kind === 'burningEnd'}
						<p class="gx-log-tick">
							{fmtT(row.event.time)} — Burning ends{row.event.swept.length
								? ` (${row.event.swept.map((m) => MOD_META[m].label).join(', ')} swept)`
								: ''}
						</p>
					{:else if row.event.kind === 'core'}
						<p class="gx-log-tick">{fmtT(row.event.time)} — Dendro Core spawned 🌱</p>
					{/if}
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.gx-instrument {
		height: 100%;
		min-height: 0;
		overflow-y: auto;
		container-type: inline-size;
		container-name: gauge;
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	.gx-frame {
		padding: 0.4rem 0.6rem 0.2rem;
		border-radius: 8px;
		background: #081225;
		border: 1px solid color-mix(in srgb, var(--dire-tint, #c2185b) 38%, transparent);
	}

	.gx-graph svg {
		display: block;
	}

	.gx-graph text {
		font-family: var(--font-mono);
	}

	/* ── Panels ─────────────────────────────────────────────────────────────── */

	.gx-panels {
		display: grid;
		gap: 1rem;
		align-items: start;
	}

	@container gauge (min-width: 44rem) {
		.gx-panels {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@container gauge (min-width: 72rem) {
		.gx-panels {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	/* ── Chips ──────────────────────────────────────────────────────────────── */

	.vz-chip-sm {
		padding: 0.25rem 0.5rem;
		font-size: 0.7rem;
		letter-spacing: 0.02em;
	}

	/* ── Application rows ───────────────────────────────────────────────────── */

	.gx-app {
		display: grid;
		gap: 0.45rem;
		padding: 0.6rem 0.65rem;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.04);
	}

	.gx-app-line {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.gx-elements {
		display: flex;
		gap: 0.35rem;
	}

	.gx-el {
		width: 17px;
		height: 17px;
		border: none;
		border-radius: 50%;
		background: var(--el);
		opacity: 0.35;
		cursor: pointer;
		transition:
			opacity 150ms ease,
			box-shadow 150ms ease;
	}

	.gx-el:hover {
		opacity: 0.75;
	}

	.gx-el.active {
		opacity: 1;
		box-shadow:
			0 0 0 2px #0b1020,
			0 0 0 3px var(--el);
	}

	.gx-gauges {
		display: flex;
		gap: 0.3rem;
		margin-left: auto;
	}

	.gx-remove {
		border: none;
		background: none;
		color: var(--muted);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0.1rem 0.3rem;
	}

	.gx-remove:hover {
		color: var(--text);
	}

	.gx-add {
		border: none;
		border-radius: 4px;
		padding: 0.45rem 0.7rem;
		background: rgba(255, 255, 255, 0.06);
		color: var(--muted);
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}

	.gx-add:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text);
	}

	/* ── Sliders ────────────────────────────────────────────────────────────── */

	.gx-value {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 0.82rem;
		min-width: 3.2em;
		text-align: right;
	}

	/* ── Readout / log ──────────────────────────────────────────────────────── */

	.gx-note {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.35rem;
		color: var(--muted);
	}

	.gx-meta {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5rem;
		color: var(--muted);
	}

	.gx-status-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.gx-status-row img {
		display: block;
	}

	.gx-strong {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--text);
	}

	.gx-log {
		display: grid;
		gap: 0.35rem;
		max-height: 21rem;
		overflow-y: auto;
		padding-right: 0.3rem;
	}

	.gx-log p {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.25rem;
	}

	.gx-log-apply {
		color: var(--text);
	}

	.gx-log-n {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		color: #081225;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 700;
		vertical-align: 1px;
	}

	.gx-log-reaction {
		color: var(--muted);
		padding-left: 1.4rem;
	}

	.gx-log-tick {
		color: color-mix(in srgb, var(--muted) 75%, transparent);
		padding-left: 1.4rem;
	}

	.gx-dim {
		color: color-mix(in srgb, var(--muted) 65%, transparent);
	}
	/* the shared slider is width:100%; in the app rows it flexes beside the value */
	.gx-app-line > .vz-slider {
		flex: 1 1 0;
		width: auto;
	}
</style>
