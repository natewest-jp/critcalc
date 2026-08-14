<script lang="ts">
	import {
		ampMultiplier,
		transformativeDamage,
		additiveDamage,
		crystallizeShieldHp,
		MAX_LEVEL
	} from './reactionCurves';

	type FamilyId = 'amplifying' | 'transformative' | 'additive' | 'crystallize';
	type Curve = {
		label: string;
		detail: string;
		color: string;
		value: (em: number, level: number) => number;
	};

	const FAMILIES: {
		id: FamilyId;
		label: string;
		note: string;
		formula: string;
		yLabel: string;
		usesLevel: boolean;
		curves: Curve[];
	}[] = [
		{
			id: 'amplifying',
			label: 'Amplifying',
			note: 'Vaporize and Melt multiply the whole hit — more EM pushes the multiplier higher with diminishing returns, and character level plays no part.',
			formula: '2.78·EM/(1400+EM)',
			yLabel: 'hit multiplier',
			usesLevel: false,
			curves: [
				{
					label: 'Forward ×2',
					detail: 'Hydro→Pyro Vaporize · Pyro→Cryo Melt',
					color: 'var(--el-hydro-main)',
					value: (em) => ampMultiplier(2, em)
				},
				{
					label: 'Reverse ×1.5',
					detail: 'Pyro→Hydro Vaporize · Cryo→Pyro Melt',
					color: 'var(--el-cryo-main)',
					value: (em) => ampMultiplier(1.5, em)
				}
			]
		},
		{
			id: 'transformative',
			label: 'Transformative',
			note: 'Fixed damage from your level and EM only — crit, ATK, and DMG% do nothing. Every reaction rides the same curve with its own multiplier.',
			formula: '16·EM/(2000+EM)',
			yLabel: 'damage',
			usesLevel: true,
			curves: [
				{
					label: '×3',
					detail: 'Hyperbloom · Burgeon · Shatter',
					color: 'var(--el-dendro-main)',
					value: (em, lv) => transformativeDamage(3, lv, em)
				},
				{
					label: '×2.75',
					detail: 'Overload',
					color: 'var(--el-pyro-main)',
					value: (em, lv) => transformativeDamage(2.75, lv, em)
				},
				{
					label: '×2',
					detail: 'Electro-Charged (per tick) · Bloom',
					color: 'var(--el-electro-main)',
					value: (em, lv) => transformativeDamage(2, lv, em)
				},
				{
					label: '×1.5',
					detail: 'Superconduct',
					color: 'var(--el-cryo-main)',
					value: (em, lv) => transformativeDamage(1.5, lv, em)
				},
				{
					label: '×0.6',
					detail: 'Swirl',
					color: 'var(--el-anemo-main)',
					value: (em, lv) => transformativeDamage(0.6, lv, em)
				},
				{
					label: '×0.25',
					detail: 'Burning (per tick)',
					color: 'var(--rx-burning)',
					value: (em, lv) => transformativeDamage(0.25, lv, em)
				}
			]
		},
		{
			id: 'additive',
			label: 'Additive',
			note: 'Spread and Aggravate ADD a flat chunk of damage to the triggering hit — the chunk then crits and scales with DMG% like the rest of the hit.',
			formula: '5·EM/(1200+EM)',
			yLabel: 'flat DMG added',
			usesLevel: true,
			curves: [
				{
					label: 'Spread ×1.25',
					detail: 'Dendro hit on Quicken',
					color: 'var(--el-dendro-main)',
					value: (em, lv) => additiveDamage(1.25, lv, em)
				},
				{
					label: 'Aggravate ×1.15',
					detail: 'Electro hit on Quicken',
					color: 'var(--el-electro-main)',
					value: (em, lv) => additiveDamage(1.15, lv, em)
				}
			]
		},
		{
			id: 'crystallize',
			label: 'Crystallize',
			note: 'Crystallize shards grant a shield that grows with the triggering character’s level and EM — on its own level table, higher than the damage one.',
			formula: '4.44·EM/(1400+EM)',
			yLabel: 'shield HP',
			usesLevel: true,
			curves: [
				{
					label: 'Shield',
					detail: 'before the 150% same-element bonus',
					color: 'var(--el-geo-main)',
					value: (em, lv) => crystallizeShieldHp(lv, em)
				}
			]
		}
	];

	let familyId = $state<FamilyId>('transformative');
	let em = $state(200);
	let level = $state(90);

	const family = $derived(FAMILIES.find((f) => f.id === familyId)!);

	export function reset() {
		familyId = 'transformative';
		em = 200;
		level = 90;
	}

	// ── Geometry ───────────────────────────────────────────────────────────────
	let graphW = $state(720);
	const PADL = 58;
	const PADR = 44; // room for the right-edge multiplier tags
	const TOP = 16;
	const PLOT_H = 210;
	const plotY1 = TOP + PLOT_H;
	const H = plotY1 + 28;

	const EM_MAX = 1200;
	const X_TICKS = [0, 200, 400, 600, 800, 1000, 1200];

	const yMax = $derived.by(() => {
		const peak = Math.max(...family.curves.map((c) => c.value(EM_MAX, level)));
		// nice ceiling: round up to half the peak's magnitude, so the top curve
		// nearly fills the plot at any level
		const unit = 10 ** Math.floor(Math.log10(peak)) / 2;
		return Math.ceil(peak / unit) * unit;
	});
	const yTicks = $derived([0.25, 0.5, 0.75, 1].map((f) => f * yMax));

	const xOf = $derived((e: number) => PADL + (e / EM_MAX) * (graphW - PADL - PADR));
	const yOf = $derived((v: number) => plotY1 - (v / yMax) * (PLOT_H - 8));

	const SAMPLES = 60;
	const paths = $derived(
		family.curves.map((c) => ({
			...c,
			d: Array.from({ length: SAMPLES + 1 }, (_, i) => {
				const e = (i / SAMPLES) * EM_MAX;
				return `${i ? 'L' : 'M'}${xOf(e).toFixed(1)},${yOf(c.value(e, level)).toFixed(1)}`;
			}).join(' ')
		}))
	);

	const fmt = (v: number) =>
		family.id === 'amplifying' ? `×${v.toFixed(2)}` : Math.round(v).toLocaleString('en-US');
	// Marginal gain: what the NEXT 50 EM buys from here — the curve's
	// diminishing returns as a number instead of a slope
	const GAIN_STEP = 50;
	const fmtGain = (c: Curve) => {
		const d = c.value(em + GAIN_STEP, level) - c.value(em, level);
		return family.id === 'amplifying'
			? `+${d.toFixed(3)}×`
			: `+${Math.round(d).toLocaleString('en-US')}`;
	};
	const fmtTick = (v: number) =>
		family.id === 'amplifying'
			? v.toFixed(1)
			: v >= 1000
				? `${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`
				: `${Math.round(v)}`;

	function onMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		em =
			Math.round(
				Math.min(EM_MAX, Math.max(0, ((x - PADL) / (graphW - PADL - PADR)) * EM_MAX)) / 5
			) * 5;
	}
</script>

<div class="instrument">
	<div class="rx-chart ctx-dark">
		<div class="rx-graph" bind:clientWidth={graphW}>
			<svg
				width={graphW}
				height={H}
				role="img"
				aria-label="Reaction scaling curves vs Elemental Mastery"
				onpointermove={onMove}
			>
				<!-- EM grid -->
				{#each X_TICKS as t (t)}
					<line x1={xOf(t)} y1={TOP} x2={xOf(t)} y2={plotY1} stroke="var(--chart-grid)" />
					<text
						x={xOf(t)}
						y={plotY1 + 15}
						fill="var(--chart-ink)"
						font-size="10"
						text-anchor="middle"
					>
						{t}
					</text>
				{/each}
				<text
					x={graphW - PADR}
					y={plotY1 + 26}
					fill="var(--chart-dim)"
					font-size="10"
					text-anchor="end"
				>
					Elemental Mastery
				</text>

				<!-- Value grid -->
				{#each yTicks as v (v)}
					<line x1={PADL} y1={yOf(v)} x2={graphW - PADR} y2={yOf(v)} stroke="var(--chart-grid)" />
					<text
						x={PADL - 7}
						y={yOf(v) + 3.5}
						fill="var(--chart-ink)"
						font-size="10"
						text-anchor="end"
					>
						{fmtTick(v)}
					</text>
				{/each}
				<text x={PADL - 7} y={TOP - 4} fill="var(--chart-dim)" font-size="10" text-anchor="end">
					{family.yLabel}
				</text>

				<!-- Curves + right-edge multiplier tags -->
				{#each paths as p (p.label)}
					<path d={p.d} fill="none" stroke={p.color} stroke-width="2" stroke-linejoin="round" />
					<text
						x={graphW - PADR + 3}
						y={yOf(p.value(EM_MAX, level)) + 3}
						fill={p.color}
						font-size="10"
						text-anchor="start"
					>
						{p.label.split(' ').pop()}
					</text>
				{/each}

				<!-- EM marker -->
				<line
					x1={xOf(em)}
					y1={TOP}
					x2={xOf(em)}
					y2={plotY1}
					stroke="var(--chart-dim)"
					stroke-dasharray="2 3"
				/>
				{#each family.curves as c (c.label)}
					<circle
						cx={xOf(em)}
						cy={yOf(c.value(em, level))}
						r="3.5"
						fill={c.color}
						style="stroke: var(--frame-bg)"
						stroke-width="1.5"
					/>
				{/each}
			</svg>
		</div>
	</div>

	<div class="rx-panels panels">
		<div class="panel">
			<p class="kicker">Reaction Family</p>
			<div class="chips">
				{#each FAMILIES as f (f.id)}
					<button
						class="chip chip--control"
						class:active={familyId === f.id}
						onclick={() => (familyId = f.id)}
					>
						{f.label}
					</button>
				{/each}
			</div>
			<p class="note">
				{family.note}
				<span class="rx-formula">{family.formula}</span>
			</p>
		</div>

		<div class="panel">
			<p class="kicker">Build</p>
			<div class="slider-control">
				<div class="slider-header">
					<span class="slider-label">Elemental Mastery</span>
					<span class="readout">{em}</span>
				</div>
				<input
					type="range"
					min="0"
					max={EM_MAX}
					step="5"
					bind:value={em}
					class="slider"
					aria-label="Elemental Mastery"
				/>
			</div>
			{#if family.usesLevel}
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Level</span>
						<span class="readout">{level}</span>
					</div>
					<input
						type="range"
						min="1"
						max={MAX_LEVEL}
						step="1"
						bind:value={level}
						class="slider"
						aria-label="Character level"
					/>
				</div>
			{:else}
				<p class="note">
					Amplifying reactions ignore level — the multiplier rides the hit, which already scales
					with everything else.
				</p>
			{/if}
		</div>

		<div class="panel panel--paper">
			<p class="kicker">Readout</p>
			{#each family.curves as c (c.label)}
				<div class="rx-read">
					<span class="rx-dot" style:background={c.color}></span>
					<span class="rx-read-body">
						<span class="rx-read-label">{c.label}</span>
						<span class="rx-read-detail">{c.detail}</span>
					</span>
					<span class="rx-read-values">
						<span class="rx-strong">{fmt(c.value(em, level))}</span>
						<span class="rx-gain">next +{GAIN_STEP} EM: {fmtGain(c)}</span>
					</span>
				</div>
			{/each}
			<p class="note">
				Before enemy RES; +% reaction bonuses (4pc Crimson Witch, Nahida A4, …) not included.
			</p>
		</div>
	</div>
</div>

<style>
	/* No frame — the chart is on the night; .ctx-dark stays claimed for
	   --frame-bg. See .gx-chart / app.css's `.frame` retirement note. */
	.rx-chart {
		min-width: 0;
	}

	.rx-graph svg {
		display: block;
	}

	.rx-graph text {
		font-family: var(--font-body);
	}

	.rx-read {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.rx-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.rx-read-body {
		display: grid;
		line-height: var(--lh-tight);
		min-width: 0;
	}

	.rx-read-label {
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
	}

	.rx-read-detail {
		font-size: var(--fs-md);
		color: var(--muted);
	}

	.rx-read-values {
		margin-left: auto;
		display: grid;
		justify-items: end;
		line-height: var(--lh-tight);
	}

	.rx-strong {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		font-size: var(--fs-2xl);
	}

	.rx-gain {
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		color: color-mix(in srgb, var(--muted) 85%, transparent);
		white-space: nowrap;
	}

	/* The receipt: exact curve formula, tucked after the plain-language line */
	.rx-formula {
		display: block;
		font-family: var(--font-body);
		font-size: var(--fs-md);
		color: color-mix(in srgb, var(--muted) 70%, transparent);
	}
</style>
