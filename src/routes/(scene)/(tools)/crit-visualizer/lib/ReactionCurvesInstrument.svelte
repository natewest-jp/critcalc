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
		yLabel: string;
		usesLevel: boolean;
		curves: Curve[];
	}[] = [
		{
			id: 'amplifying',
			label: 'Amplifying',
			note: 'Vaporize and Melt multiply the triggering hit — EM feeds the strongest of the three EM curves (2.78·EM/(1400+EM)), and level plays no part.',
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
			note: 'Fixed damage from level and EM only (16·EM/(2000+EM)) — crit, ATK, and DMG% do nothing. Same curve, different multipliers per reaction.',
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
					color: 'color-mix(in srgb, var(--el-pyro-main) 55%, #ffb03b)',
					value: (em, lv) => transformativeDamage(0.25, lv, em)
				}
			]
		},
		{
			id: 'additive',
			label: 'Additive',
			note: 'Spread and Aggravate ADD flat damage to the triggering hit (5·EM/(1200+EM)) — the flat chunk then crits and scales with DMG% like the rest of the hit.',
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
			note: 'Crystallize shards grant a shield whose absorption scales with the triggering character’s level and EM (4.44·EM/(1400+EM)) — its own level table, higher than the damage one.',
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

<div class="rx-instrument">
	<div class="rx-frame">
		<div class="rx-graph" bind:clientWidth={graphW}>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<svg
				width={graphW}
				height={H}
				role="img"
				aria-label="Reaction scaling curves vs Elemental Mastery"
				onpointermove={onMove}
			>
				<!-- EM grid -->
				{#each X_TICKS as t (t)}
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
					y={plotY1 + 26}
					fill="rgba(255,255,255,0.35)"
					font-size="9"
					text-anchor="end"
				>
					Elemental Mastery
				</text>

				<!-- Value grid -->
				{#each yTicks as v (v)}
					<line
						x1={PADL}
						y1={yOf(v)}
						x2={graphW - PADR}
						y2={yOf(v)}
						stroke="rgba(255,255,255,0.07)"
					/>
					<text
						x={PADL - 7}
						y={yOf(v) + 3.5}
						fill="rgba(255,255,255,0.5)"
						font-size="10"
						text-anchor="end"
					>
						{fmtTick(v)}
					</text>
				{/each}
				<text
					x={PADL - 7}
					y={TOP - 4}
					fill="rgba(255,255,255,0.35)"
					font-size="9"
					text-anchor="end"
				>
					{family.yLabel}
				</text>

				<!-- Curves + right-edge multiplier tags -->
				{#each paths as p (p.label)}
					<path d={p.d} fill="none" stroke={p.color} stroke-width="2" stroke-linejoin="round" />
					<text
						x={graphW - PADR + 3}
						y={yOf(p.value(EM_MAX, level)) + 3}
						fill={p.color}
						font-size="8.5"
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
					stroke="rgba(255,255,255,0.4)"
					stroke-dasharray="2 3"
				/>
				{#each family.curves as c (c.label)}
					<circle
						cx={xOf(em)}
						cy={yOf(c.value(em, level))}
						r="3.5"
						fill={c.color}
						stroke="#081225"
						stroke-width="1.5"
					/>
				{/each}
			</svg>
		</div>
	</div>

	<div class="rx-panels">
		<div class="rx-panel">
			<p class="rx-kicker">Reaction Family</p>
			<div class="rx-chips">
				{#each FAMILIES as f (f.id)}
					<button
						class="rx-chip"
						class:active={familyId === f.id}
						onclick={() => (familyId = f.id)}
					>
						{f.label}
					</button>
				{/each}
			</div>
			<p class="rx-note">{family.note}</p>
		</div>

		<div class="rx-panel">
			<p class="rx-kicker">Build</p>
			<div class="rx-slider-control">
				<div class="rx-slider-header">
					<span class="rx-slider-label">Elemental Mastery</span>
					<span class="rx-value">{em}</span>
				</div>
				<input
					type="range"
					min="0"
					max={EM_MAX}
					step="5"
					bind:value={em}
					class="rx-slider"
					aria-label="Elemental Mastery"
				/>
			</div>
			{#if family.usesLevel}
				<div class="rx-slider-control">
					<div class="rx-slider-header">
						<span class="rx-slider-label">Level</span>
						<span class="rx-value">{level}</span>
					</div>
					<input
						type="range"
						min="1"
						max={MAX_LEVEL}
						step="1"
						bind:value={level}
						class="rx-slider"
						aria-label="Character level"
					/>
				</div>
			{:else}
				<p class="rx-note">
					Amplifying reactions ignore level — the multiplier rides the hit, which already scales
					with everything else.
				</p>
			{/if}
		</div>

		<div class="rx-panel">
			<p class="rx-kicker">Readout</p>
			{#each family.curves as c (c.label)}
				<div class="rx-read">
					<span class="rx-dot" style:background={c.color}></span>
					<span class="rx-read-body">
						<span class="rx-read-label">{c.label}</span>
						<span class="rx-read-detail">{c.detail}</span>
					</span>
					<span class="rx-strong">{fmt(c.value(em, level))}</span>
				</div>
			{/each}
			<p class="rx-note">
				Before enemy RES; +% reaction bonuses (4pc Crimson Witch, Nahida A4, …) not included.
			</p>
		</div>
	</div>
</div>

<style>
	.rx-instrument {
		height: 100%;
		min-height: 0;
		overflow-y: auto;
		container-type: inline-size;
		container-name: rxcurves;
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	.rx-frame {
		padding: 0.4rem 0.6rem 0.2rem;
		border-radius: 8px;
		background: #081225;
		border: 1px solid color-mix(in srgb, var(--dire-tint, #c2185b) 38%, transparent);
	}

	.rx-graph svg {
		display: block;
	}

	.rx-graph text {
		font-family: var(--font-mono);
	}

	.rx-panels {
		display: grid;
		gap: 1rem;
		align-items: start;
	}

	@container rxcurves (min-width: 44rem) {
		.rx-panels {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.rx-panel {
		display: grid;
		gap: 0.7rem;
		padding: 1.1rem 1.2rem;
		border-radius: 6px;
		background: var(--surface-raised);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
		align-content: start;
	}

	.rx-kicker {
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

	.rx-kicker::after {
		content: '';
		flex: 1;
		height: 1px;
		background: linear-gradient(
			to right,
			color-mix(in srgb, var(--accent) 45%, transparent),
			transparent
		);
	}

	.rx-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.rx-chip {
		padding: 0.35rem 0.75rem;
		border: none;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.rx-chip:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text);
	}

	.rx-chip.active {
		background: color-mix(in srgb, var(--accent) 24%, var(--surface));
		color: var(--text);
	}

	.rx-slider-control {
		display: grid;
		gap: 0.5rem;
	}

	.rx-slider-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.875rem;
	}

	.rx-slider-label {
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.rx-value {
		font-family: var(--font-mono);
		font-weight: 600;
	}

	.rx-slider {
		appearance: none;
		width: 100%;
		height: 4px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--text) 16%, transparent);
		outline-offset: 4px;
	}

	.rx-slider::-webkit-slider-thumb {
		appearance: none;
		width: 15px;
		height: 15px;
		border: none;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 3px rgba(4, 8, 18, 0.6);
		cursor: pointer;
	}

	.rx-slider::-moz-range-thumb {
		width: 15px;
		height: 15px;
		border: none;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 3px rgba(4, 8, 18, 0.6);
		cursor: pointer;
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
		line-height: 1.2;
		min-width: 0;
	}

	.rx-read-label {
		font-size: 0.82rem;
		font-weight: 600;
	}

	.rx-read-detail {
		font-size: 0.7rem;
		color: var(--muted);
	}

	.rx-strong {
		margin-left: auto;
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 0.95rem;
	}

	.rx-note {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.35rem;
		color: var(--muted);
	}
</style>
