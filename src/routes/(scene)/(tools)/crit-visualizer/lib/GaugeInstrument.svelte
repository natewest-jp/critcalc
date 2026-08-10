<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
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
	import { MAX_GAUGE_APPS, MAX_GAUGE_TIME } from './workspace';
	import { createPlayhead } from './playhead.svelte';
	import { PLAYHEAD_SPEEDS } from './playhead';

	// Workspace visibility: benched tiles suspend playback's rAF entirely
	let { active = true }: { active?: boolean } = $props();

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

	const MAX_APPS = MAX_GAUGE_APPS;

	// Elements involved in a preset, in order of first appearance — drives the
	// little overlapping icons inside the scenario chips
	const presetElements = (p: PresetDef): ElementId[] => [...new Set(p.apps.map(([, e]) => e))];

	let preset = $state('single');
	let appRows = $state<Application[]>(
		PRESETS[0].apps.map(([time, element, gauge]) => ({ time, element, gauge }))
	);
	let scrubbing = $state(false);

	function loadPreset(p: PresetDef) {
		preset = p.id;
		appRows = p.apps.map(([time, element, gauge]) => ({ time, element, gauge }));
		playhead.stop();
	}
	const markCustom = () => {
		preset = 'custom';
		playhead.stop();
	};

	function addRow() {
		if (appRows.length >= MAX_APPS) return;
		const last = appRows[appRows.length - 1];
		appRows.push({
			time: Math.min(MAX_GAUGE_TIME, (last?.time ?? 0) + 2),
			element: 'pyro',
			gauge: 1
		});
		markCustom();
	}

	export function reset() {
		loadPreset(PRESETS[0]);
	}

	// ── Share-link + handoff intake (workspace contract) ─────────────────────
	// One sanitizer serves both: share payloads carry [time, element, gauge]
	// tuples (the PresetDef form), handoffs carry Application objects.
	function sanitizeApps(raw: unknown): Application[] | null {
		if (!Array.isArray(raw) || raw.length === 0) return null;
		const out: Application[] = [];
		for (const item of raw.slice(0, MAX_APPS)) {
			let time: unknown, element: unknown, gauge: unknown;
			if (Array.isArray(item)) [time, element, gauge] = item;
			else if (typeof item === 'object' && item !== null)
				({ time, element, gauge } = item as Record<string, unknown>);
			else return null;
			if (typeof time !== 'number' || !Number.isFinite(time)) return null;
			if (!ELEMENTS.includes(element as ElementId)) return null;
			if (!(GAUGE_OPTIONS as readonly number[]).includes(gauge as number)) return null;
			out.push({
				time: Math.min(MAX_GAUGE_TIME, Math.max(0, Math.round((time as number) * 10) / 10)),
				element: element as ElementId,
				gauge: gauge as number
			});
		}
		return out;
	}

	export function getShareState() {
		return { v: 1, preset, apps: appRows.map((a) => [a.time, a.element, a.gauge]) };
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		const apps = sanitizeApps(s.apps);
		if (!apps) return;
		appRows = apps;
		preset =
			typeof s.preset === 'string' && PRESETS.some((p) => p.id === s.preset) ? s.preset : 'custom';
		playhead.stop();
	}

	export function receiveHandoff(kind: string, payload: unknown) {
		if (kind !== 'applications') return;
		const apps = sanitizeApps(payload);
		if (!apps) return;
		appRows = apps;
		preset = 'custom';
		playhead.stop();
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
	const TOP = 64; // application marker band (3 label lines at 10px fit above)
	const PLOT_H = 176;
	const plotY1 = TOP + PLOT_H;
	const AXIS_H = 24;
	const stripY0 = plotY1 + AXIS_H;
	const ROW_H = 18;

	const domain = $derived(Math.max(Math.ceil(Math.max(sim.duration + 0.4, lastAppTime + 2)), 8));

	// ── Playback ─────────────────────────────────────────────────────────────
	const playhead = createPlayhead(() => domain);
	$effect(() => playhead.setActive(active));
	// The single time cursor: the playhead (playing, scrubbed, or parked)
	const displayT = $derived(
		playhead.playing || scrubbing || playhead.t > 0 ? Math.min(playhead.t, domain) : null
	);
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
		sim.series.map(({ key, points }) => {
			const d = points
				.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.t).toFixed(1)},${yOf(p.u).toFixed(1)}`)
				.join(' ');
			// Area fill under each aura line — 'volume' of aura on the enemy.
			// The hidden fuel gauge stays a bare dashed line.
			const fillD =
				key === 'burningFuel'
					? null
					: `${d} L${xOf(points[points.length - 1].t).toFixed(1)},${plotY1} L${xOf(points[0].t).toFixed(1)},${plotY1} Z`;
			return { meta: MOD_META[key], d, fillD };
		})
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

	// ── Pointer scrub: drag the playhead, but only while paused ────────────────
	function chartT(e: PointerEvent): number {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		return Math.min(domain, Math.max(0, ((x - PADL) / (graphW - PADL - PADR)) * domain));
	}
	function onScrubDown(e: PointerEvent) {
		if (playhead.playing) return;
		scrubbing = true;
		playhead.seek(chartT(e));
		(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
	}
	function onScrubMove(e: PointerEvent) {
		if (scrubbing) playhead.seek(chartT(e));
	}
	function onScrubUp(e: PointerEvent) {
		scrubbing = false;
		const el = e.currentTarget as SVGSVGElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}
	const hoverGauges = $derived(
		displayT === null
			? null
			: MOD_ORDER.flatMap((mod) => {
					const u = gaugesAt(sim.series, displayT!)[mod];
					return u === undefined ? [] : [{ mod, meta: MOD_META[mod], u }];
				})
	);
</script>

<div class="instrument">
	<div class="gx-frame frame ctx-dark">
		<div class="gx-transport">
			<button
				class="btn btn--primary btn--icon gx-play"
				aria-pressed={playhead.playing}
				aria-label={playhead.playing ? 'Pause playback' : 'Play the timeline'}
				onclick={() => playhead.toggle()}
			>
				{playhead.playing ? '⏸' : '▶'}
			</button>
			{#each PLAYHEAD_SPEEDS as sp (sp)}
				<button
					class="chip chip--control chip--sm"
					class:active={playhead.speed === sp}
					onclick={() => playhead.setSpeed(sp)}
				>
					{sp}×
				</button>
			{/each}
			<span class="gx-transport-time">{Math.min(playhead.t, domain).toFixed(1)}s / {domain}s</span>
		</div>
		<div class="gx-graph" bind:clientWidth={graphW}>
			<svg
				width={graphW}
				height={svgH}
				role="img"
				aria-label="Elemental gauge decay timeline"
				onpointerdown={onScrubDown}
				onpointermove={onScrubMove}
				onpointerup={onScrubUp}
				onpointercancel={onScrubUp}
				style:cursor={playhead.playing ? 'default' : 'ew-resize'}
			>
				<!-- Time grid -->
				{#each ticks as s (s)}
					<line x1={xOf(s)} y1={TOP} x2={xOf(s)} y2={plotY1} stroke="var(--chart-grid)" />
					<text
						x={xOf(s)}
						y={plotY1 + 14}
						fill="var(--chart-ink)"
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
							fill="var(--chart-ink)"
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
						style="fill: var(--bright-ink)"
						font-size="9.5"
						font-weight="700"
						text-anchor="middle"
					>
						{m.n}
					</text>
					<text x={m.x} y={27} fill={m.color} font-size="10" font-weight="700" text-anchor="middle">
						{m.gauge}
					</text>
					{#each m.labels as label, li (li)}
						<text
							class="gx-word"
							x={m.x}
							y={39 + li * 11}
							fill="var(--chart-ink)"
							font-size="10"
							text-anchor="middle"
						>
							{label}
						</text>
					{/each}
				{/each}

				<!-- Aura volume fills (gradient fades to transparent at the baseline,
				     so coexisting auras like EC/Freeze overlap without turning to mud) -->
				<defs>
					{#each paths as p, pi (pi)}
						{#if p.fillD}
							<linearGradient id="gx-fill-{pi}" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color={p.meta.color} stop-opacity="0.26" />
								<stop offset="100%" stop-color={p.meta.color} stop-opacity="0" />
							</linearGradient>
						{/if}
					{/each}
				</defs>
				{#each paths as p, pi (pi)}
					{#if p.fillD}
						<path d={p.fillD} fill="url(#gx-fill-{pi})" />
					{/if}
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
					<image href={elementIcon(row.meta.icon)} x="2" y={row.y + 2} width="12" height="12" />
					<text class="gx-word" x={17} y={row.y + 11.5} fill={row.meta.color} font-size="10">
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

				<!-- Playhead: the one time cursor — drag it while paused -->
				{#if displayT !== null}
					<line
						x1={xOf(displayT)}
						y1={TOP}
						x2={xOf(displayT)}
						y2={stripY0 + stripRows.length * ROW_H}
						stroke="var(--chart-ink)"
						stroke-width="1.5"
					/>
				{/if}
			</svg>
		</div>
	</div>

	<div class="gx-panels panels">
		<div class="panel">
			<p class="kicker">Example Scenarios</p>
			<div class="chips gx-chips-dense">
				{#each PRESETS as p (p.id)}
					<button
						class="chip chip--control gx-preset-chip"
						class:active={preset === p.id}
						onclick={() => loadPreset(p)}
					>
						<span class="gx-chip-els" aria-hidden="true">
							{#each presetElements(p) as e (e)}
								<img src={elementIcon(e)} alt="" width="14" height="14" />
							{/each}
						</span>
						{p.label}
					</button>
				{/each}
			</div>
			<p class="note">
				{presetNote ?? 'Custom sequence — edit applications or pick a scenario.'}
			</p>
		</div>

		<div class="panel">
			<p class="kicker">Applications</p>
			<p class="note">
				U = gauge units, the invisible strength of an elemental application — most hits are 1U.
			</p>
			{#each appRows as row, i (i)}
				<div class="gx-app">
					<div class="gx-app-content">
						<div class="gx-app-line">
							<div class="gx-elements" role="radiogroup" aria-label="Element">
								{#each ELEMENTS as e (e)}
									<button
										class="chip chip--icon gx-el"
										class:active={row.element === e}
										style:--chip-color="var(--el-{e}-main)"
										aria-label={e}
										title={e}
										onclick={() => {
											row.element = e;
											markCustom();
										}}
									>
										<img src={elementIcon(e)} alt="" width="16" height="16" />
									</button>
								{/each}
							</div>
						</div>
						<div class="gx-app-line">
							<div class="gx-gauges">
								{#each GAUGE_OPTIONS as g (g)}
									<button
										class="chip chip--control chip--sm"
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
						</div>
						<div class="gx-app-line">
							<input
								type="range"
								min="0"
								max="15"
								step="0.1"
								bind:value={row.time}
								oninput={markCustom}
								class="slider"
								aria-label="Application time in seconds"
							/>
							<span class="gx-value">{row.time.toFixed(1)}s</span>
						</div>
					</div>
					<button class="gx-remove" aria-label="Remove application" onclick={() => removeRow(i)}>
						×
					</button>
				</div>
			{/each}
			{#if appRows.length < MAX_APPS}
				<button class="btn gx-add" onclick={addRow}>+ Add application</button>
			{/if}
		</div>

		<div class="panel">
			<p class="kicker">Enemy Status</p>
			{#if hoverGauges}
				<p class="note">at {fmtT(displayT!)}</p>
				{#if hoverGauges.length === 0}
					<p class="gx-meta">No aura — the next element applies fresh.</p>
				{:else}
					{#each hoverGauges as h (h.mod)}
						<p class="gx-meta gx-status-row">
							<img src={elementIcon(h.meta.icon)} alt="" width="14" height="14" />
							<span style:color={h.meta.color}>{h.meta.label}</span>
							<span class="gx-strong">{fmtU(h.u)}</span>
						</p>
					{/each}
				{/if}
			{:else}
				<p class="note">
					Press play — or drag the paused playhead — to read the enemy’s aura state at a moment in
					time.
				</p>
				{#each stripRows as row (row.mod)}
					<p class="gx-meta gx-status-row">
						<img src={elementIcon(row.meta.icon)} alt="" width="14" height="14" />
						<span style:color={row.meta.color}>{row.meta.label}</span>
						<span class="gx-strong">
							{row.intervals.map((s) => `${s.t0.toFixed(1)}–${s.t1.toFixed(1)}s`).join(', ')}
						</span>
					</p>
				{/each}
			{/if}
		</div>

		<div class="panel">
			<p class="kicker">Event Log</p>
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
	.gx-frame {
		padding: 0.4rem 0.6rem 0.2rem;
		border-radius: var(--r-sm);
	}

	.gx-graph svg {
		display: block;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	/* ── Transport ──────────────────────────────────────────────────────────── */

	.gx-transport {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.2rem 0.35rem;
	}

	.gx-transport-time {
		margin-left: 0.3rem;
		font-family: var(--font-body);
		font-size: var(--fs-md);
		color: var(--muted);
	}

	/* Chart text: Mono for numbers (ticks, gauge tags), Condensed for word
	   labels (aura names, reaction names) so they fit their gutters at 10px */
	.gx-graph text {
		font-family: var(--font-body);
	}

	.gx-graph text.gx-word {
		font-family: var(--font-condensed);
	}

	/* Condensed trial: the 12-chip scenario row is the densest chip cluster */
	.gx-chips-dense :global(.chip) {
		font-family: var(--font-condensed);
	}

	.gx-preset-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	/* Overlapping element badges inside a scenario chip */
	.gx-chip-els {
		display: inline-flex;
	}

	.gx-chip-els img {
		width: 14px;
		height: 14px;
	}

	.gx-chip-els img + img {
		margin-left: -5px;
	}

	/* ── Panels ─────────────────────────────────────────────────────────────── */

	/* ── Chips ──────────────────────────────────────────────────────────────── */

	/* ── Application rows ───────────────────────────────────────────────────── */

	.gx-app {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		border-radius: 3px;
		background: var(--fill-rest);
		overflow: hidden;
	}

	.gx-app-content {
		display: grid;
		gap: 0.45rem;
		padding: 0.6rem 0.65rem;
		min-width: 0;
	}

	.gx-app-line {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 0.6rem;
	}

	.gx-elements {
		display: flex;
		gap: 0.35rem;
	}

	.gx-gauges {
		display: flex;
		gap: 0.3rem;
	}

	/* The row's whole right edge deletes it — quiet until hovered, then the
	   shared accent-chip hover treatment */
	/* .btn with a resting fill — the Applications list's add affordance. */
	.gx-add {
		background: var(--fill-rest);
		font-size: var(--fs-lg);
		padding: 0.45rem 0.7rem;
		text-transform: none;
		letter-spacing: normal;
	}
	/* .btn--primary .btn--icon, but round: a transport control, not a chip. */
	.gx-play {
		width: 28px;
		height: 28px;
		border-radius: var(--r-round);
	}

	.gx-remove {
		align-self: stretch;
		width: 26px;
		border: none;
		border-radius: 0 3px 3px 0;
		background: none;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
		font-size: var(--fs-2xl);
		line-height: var(--lh-none);
		cursor: pointer;
		padding: 0;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.gx-remove:hover {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--text);
	}

	/* ── Sliders ────────────────────────────────────────────────────────────── */

	.gx-value {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		font-size: var(--fs-xl);
		min-width: 3.2em;
		text-align: right;
	}

	/* ── Readout / log ──────────────────────────────────────────────────────── */

	.gx-meta {
		margin: 0;
		font-size: var(--fs-xl);
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
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
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
		font-size: var(--fs-lg);
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
		color: var(--bright-ink);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
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
	.gx-app-line > .slider {
		flex: 1 1 0;
		width: auto;
	}
</style>
