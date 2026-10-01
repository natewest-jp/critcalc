<script lang="ts">
	import {
		ampMultiplier,
		transformativeDamage,
		additiveDamage,
		specialReactionDamage,
		crystallizeShieldHp,
		emBonus,
		emWorthOfBonus,
		snapLevel,
		AMP_CURVE,
		TRANSFORMATIVE_CURVE,
		ADDITIVE_CURVE,
		SPECIAL_CURVE,
		CRYSTALLIZE_CURVE,
		TOP_CONTRIBUTOR_SHARE,
		MAX_LEVEL,
		type EmCurve
	} from './reactionCurves';

	type FamilyId = 'all' | 'amplifying' | 'transformative' | 'additive' | 'lunar' | 'crystallize';
	type Curve = {
		label: string;
		detail: string;
		color: string;
		/** The EM curve a Reaction Bonus trades against — null where none applies
		 *  (Crystallize's shield has no Reaction Bonus bracket). */
		em: EmCurve | null;
		value: (em: number, level: number, rb: number) => number;
	};

	const SHARE = TOP_CONTRIBUTOR_SHARE;

	const FAMILIES: {
		id: FamilyId;
		label: string;
		note: string;
		formula?: string;
		/** Shown in place of the Level slider when the family ignores level. */
		levelNote?: string;
		caveat: string;
		yLabel: string;
		usesLevel: boolean;
		curves: Curve[];
	}[] = [
		{
			id: 'all',
			label: 'All families',
			note: 'What EM adds to each family’s payout.',
			levelNote: 'The EM bonus is the same at every level.',
			caveat: 'Crystallize’s shield takes no Reaction Bonus.',
			yLabel: 'EM bonus',
			usesLevel: false,
			// ordered by height at the right edge, so the legend reads like the chart
			curves: [
				{
					label: 'Transformative',
					detail: 'Overloaded · Swirl · Bloom · Hyperbloom · …',
					color: 'var(--el-pyro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, _lv, rb) => (emBonus(TRANSFORMATIVE_CURVE, em) + rb) * 100
				},
				{
					label: 'Additive',
					detail: 'Spread · Aggravate',
					color: 'var(--el-dendro-main)',
					em: ADDITIVE_CURVE,
					value: (em, _lv, rb) => (emBonus(ADDITIVE_CURVE, em) + rb) * 100
				},
				{
					label: 'Lunar & Stellar',
					detail: 'Lunar-Charged · Lunar-Crystallize · Stellar Swirl',
					color: 'var(--el-electro-main)',
					em: SPECIAL_CURVE,
					value: (em, _lv, rb) => (emBonus(SPECIAL_CURVE, em) + rb) * 100
				},
				{
					label: 'Crystallize',
					detail: 'Shield',
					color: 'var(--el-geo-main)',
					em: null,
					value: (em) => emBonus(CRYSTALLIZE_CURVE, em) * 100
				},
				{
					label: 'Amplifying',
					detail: 'Vaporize · Melt',
					color: 'var(--el-hydro-main)',
					em: AMP_CURVE,
					value: (em, _lv, rb) => (emBonus(AMP_CURVE, em) + rb) * 100
				}
			]
		},
		{
			id: 'amplifying',
			label: 'Amplifying',
			note: 'Vaporize and Melt multiply the whole hit — more EM pushes the multiplier higher with diminishing returns, and character level plays no part.',
			formula: '2.78·EM/(1400+EM)',
			levelNote:
				'Amplifying reactions ignore level — the multiplier rides the hit, which already scales with everything else.',
			caveat: 'Before enemy RES.',
			yLabel: 'hit multiplier',
			usesLevel: false,
			curves: [
				{
					label: 'Forward ×2',
					detail: 'Hydro→Pyro Vaporize · Pyro→Cryo Melt',
					color: 'var(--el-hydro-main)',
					em: AMP_CURVE,
					value: (em, _lv, rb) => ampMultiplier(2, em, rb)
				},
				{
					label: 'Reverse ×1.5',
					detail: 'Pyro→Hydro Vaporize · Cryo→Pyro Melt',
					color: 'var(--el-cryo-main)',
					em: AMP_CURVE,
					value: (em, _lv, rb) => ampMultiplier(1.5, em, rb)
				}
			]
		},
		{
			id: 'transformative',
			label: 'Transformative',
			note: 'Fixed damage from the character’s level and EM — for most characters, crit, ATK, and DMG% do nothing. Every reaction rides the same curve with its own multiplier.',
			formula: '16·EM/(2000+EM)',
			caveat: 'Before enemy RES.',
			yLabel: 'damage',
			usesLevel: true,
			curves: [
				{
					label: '×3',
					detail: 'Hyperbloom · Burgeon · Shatter',
					color: 'var(--el-dendro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(3, lv, em, rb)
				},
				{
					label: '×2.75',
					detail: 'Overload',
					color: 'var(--el-pyro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(2.75, lv, em, rb)
				},
				{
					label: '×2',
					detail: 'Electro-Charged (per tick) · Bloom',
					color: 'var(--el-electro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(2, lv, em, rb)
				},
				{
					label: '×1.5',
					detail: 'Superconduct',
					color: 'var(--el-cryo-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(1.5, lv, em, rb)
				},
				{
					label: '×0.6',
					detail: 'Swirl',
					color: 'var(--el-anemo-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(0.6, lv, em, rb)
				},
				{
					label: '×0.25',
					detail: 'Burning (per tick)',
					color: 'var(--rx-burning)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(0.25, lv, em, rb)
				}
			]
		},
		{
			id: 'additive',
			label: 'Additive',
			note: 'Spread and Aggravate ADD a flat chunk of damage to the triggering hit — the chunk then crits and scales with DMG% like the rest of the hit.',
			formula: '5·EM/(1200+EM)',
			caveat: 'Before enemy RES.',
			yLabel: 'flat DMG added',
			usesLevel: true,
			curves: [
				{
					label: 'Spread ×1.25',
					detail: 'Dendro hit on Quicken',
					color: 'var(--el-dendro-main)',
					em: ADDITIVE_CURVE,
					value: (em, lv, rb) => additiveDamage(1.25, lv, em, rb)
				},
				{
					label: 'Aggravate ×1.15',
					detail: 'Electro hit on Quicken',
					color: 'var(--el-electro-main)',
					em: ADDITIVE_CURVE,
					value: (em, lv, rb) => additiveDamage(1.15, lv, em, rb)
				}
			]
		},
		{
			id: 'lunar',
			label: 'Lunar & Stellar',
			note: 'Damage from level and EM on a gentler curve than Transformative, and it can crit. Each party member who contributes is computed separately; these curves are the top contributor’s 60% share. Lunar-Bloom and Stellar-Conduct deal damage only through abilities.',
			formula: '6·EM/(2000+EM)',
			caveat:
				'Before enemy RES and crit. Stellar Swirl’s numbers come from gcsim and aren’t yet confirmed in game.',
			yLabel: 'damage',
			usesLevel: true,
			curves: [
				{
					label: '×1.8',
					detail: 'Lunar-Charged (per tick) · Stellar Swirl blast, 3+ swirls',
					color: 'var(--el-electro-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(3, lv, em, rb)
				},
				{
					label: '×1.2',
					detail: 'Stellar Swirl blast, 1–2 swirls',
					color: 'var(--el-cryo-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(2, lv, em, rb)
				},
				{
					label: '×0.96',
					detail: 'Lunar-Crystallize (per Moondrift hit)',
					color: 'var(--el-geo-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(1.6, lv, em, rb)
				},
				{
					label: '×0.45',
					detail: 'Stellar Swirl',
					color: 'var(--el-anemo-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(0.75, lv, em, rb)
				}
			]
		},
		{
			id: 'crystallize',
			label: 'Crystallize',
			note: 'Crystallize shards grant a shield that grows with the triggering character’s level and EM — on its own level table, higher than the damage one.',
			formula: '4.44·EM/(1400+EM)',
			caveat: 'Before the 150% same-element bonus.',
			yLabel: 'shield HP',
			usesLevel: true,
			curves: [
				{
					label: 'Shield',
					detail: 'before the 150% same-element bonus',
					color: 'var(--el-geo-main)',
					em: null,
					value: (em, lv) => crystallizeShieldHp(lv, em)
				}
			]
		}
	];

	let familyId = $state<FamilyId>('all');
	let em = $state(200);
	let level = $state(90);
	/** Reaction Bonus in whole percent. */
	let rbPct = $state(0);
	const rb = $derived(rbPct / 100);

	const family = $derived(FAMILIES.find((f) => f.id === familyId)!);
	const takesRb = $derived(family.curves.some((c) => c.em));

	export function reset() {
		familyId = 'all';
		em = 200;
		level = 90;
		rbPct = 0;
	}

	// ── Geometry ───────────────────────────────────────────────────────────────
	let graphW = $state(720);
	const PADL = 58;
	const PADR = 14;
	const TOP = 16;
	const PLOT_H = 210;
	const plotY1 = TOP + PLOT_H;
	const H = plotY1 + 28;

	const EM_MAX = 1200;
	const X_TICKS = [0, 200, 400, 600, 800, 1000, 1200];

	const at = (c: Curve, e: number) => c.value(e, level, rb);

	const yMax = $derived.by(() => {
		const peak = Math.max(...family.curves.map((c) => at(c, EM_MAX)));
		// nice ceiling: round up to half the peak's magnitude, so the top curve
		// nearly fills the plot at any level
		const unit = 10 ** Math.floor(Math.log10(peak)) / 2;
		return Math.ceil(peak / unit) * unit;
	});
	// Gridlines on a round step (1 · 2 · 2.5 · 5 × 10ⁿ) that gives three to five
	// lines under the ceiling — quarters of the ceiling read as 163% / 8.8k.
	const yTicks = $derived.by(() => {
		const mag = 10 ** Math.floor(Math.log10(yMax / 4));
		const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => yMax / st <= 5)!;
		return Array.from({ length: Math.floor(yMax / step + 1e-9) }, (_, i) => (i + 1) * step);
	});

	const xOf = $derived((e: number) => PADL + (e / EM_MAX) * (graphW - PADL - PADR));
	const yOf = $derived((v: number) => plotY1 - (v / yMax) * (PLOT_H - 8));

	const SAMPLES = 60;
	const paths = $derived(
		family.curves.map((c) => ({
			...c,
			d: Array.from({ length: SAMPLES + 1 }, (_, i) => {
				const e = (i / SAMPLES) * EM_MAX;
				return `${i ? 'L' : 'M'}${xOf(e).toFixed(1)},${yOf(at(c, e)).toFixed(1)}`;
			}).join(' ')
		}))
	);

	const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');
	const fmt = (v: number) =>
		family.id === 'all'
			? `+${fmtInt(v)}%`
			: family.id === 'amplifying'
				? `×${v.toFixed(2)}`
				: fmtInt(v);
	// Marginal gain: what the NEXT 50 EM buys from here — the curve's
	// diminishing returns as a number instead of a slope
	const GAIN_STEP = 50;
	const fmtGain = (c: Curve) => {
		const d = at(c, em + GAIN_STEP) - at(c, em);
		return family.id === 'all'
			? `+${d.toFixed(1)}%`
			: family.id === 'amplifying'
				? `+${d.toFixed(3)}×`
				: `+${fmtInt(d)}`;
	};
	const fmtTick = (v: number) =>
		family.id === 'all'
			? `${Math.round(v)}%`
			: family.id === 'amplifying'
				? v.toFixed(1)
				: v >= 1000
					? `${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`
					: `${Math.round(v)}`;

	/** What the current Reaction Bonus is worth in EM on one curve, from here. */
	const fmtWorth = (curve: EmCurve) => {
		const n = emWorthOfBonus(curve, em, rb);
		return Number.isFinite(n) ? `+${fmtInt(n)} EM` : 'more than any EM';
	};

	// The chart moves the EM marker on press-and-drag only — a plain hover
	// used to move it too, and leave it wherever the pointer crossed out.
	let dragging = $state(false);
	function emAt(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		em =
			Math.round(
				Math.min(EM_MAX, Math.max(0, ((x - PADL) / (graphW - PADL - PADR)) * EM_MAX)) / 5
			) * 5;
	}
	function onDown(e: PointerEvent) {
		if (e.button !== 0) return;
		dragging = true;
		(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
		emAt(e);
	}
	function onMove(e: PointerEvent) {
		if (dragging) emAt(e);
	}
	function onUp() {
		dragging = false;
	}

	function onLevel(e: Event & { currentTarget: HTMLInputElement }) {
		const el = e.currentTarget;
		level = snapLevel(Number(el.value), level);
		el.value = String(level);
	}
	/** Where a level sits along the slider's travel, for the 90/95/100 marks. */
	const LEVEL_MARKS = [90, 95, 100];
	const markPos = (lv: number) => (lv - 1) / (MAX_LEVEL - 1);
</script>

<div class="instrument">
	<div class="rx-chart ctx-dark">
		<div class="rx-graph" bind:clientWidth={graphW}>
			<svg
				width={graphW}
				height={H}
				role="img"
				aria-label="Reaction scaling curves vs Elemental Mastery"
				onpointerdown={onDown}
				onpointermove={onMove}
				onpointerup={onUp}
				onpointercancel={onUp}
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

				<!-- Curves -->
				{#each paths as p (p.label)}
					<path d={p.d} fill="none" stroke={p.color} stroke-width="2" stroke-linejoin="round" />
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
						cy={yOf(at(c, em))}
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
				{#if family.formula}<span class="rx-formula">{family.formula}</span>{/if}
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
			{#if takesRb}
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Reaction Bonus</span>
						<span class="readout">{rbPct}%</span>
					</div>
					<input
						type="range"
						min="0"
						max="100"
						step="5"
						bind:value={rbPct}
						class="slider"
						aria-label="Reaction Bonus in percent"
					/>
				</div>
			{/if}
			{#if family.usesLevel}
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Level</span>
						<span class="readout">{level}</span>
					</div>
					<div class="rx-level">
						<input
							type="range"
							min="1"
							max={MAX_LEVEL}
							step="1"
							value={level}
							oninput={onLevel}
							class="slider"
							aria-label="Character level"
						/>
						<!-- Above 90 only 95 and 100 exist; the slider jumps the gaps. -->
						<div class="rx-level-marks" aria-hidden="true">
							{#each LEVEL_MARKS as lv (lv)}
								<span class="rx-level-mark" style:--at={markPos(lv)}></span>
							{/each}
						</div>
					</div>
				</div>
			{:else if family.levelNote}
				<p class="note">{family.levelNote}</p>
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
						<span class="rx-strong">{fmt(at(c, em))}</span>
						<span class="rx-gain">next +{GAIN_STEP} EM: {fmtGain(c)}</span>
						{#if family.id === 'all' && rbPct > 0}
							<span class="rx-gain">
								{c.em ? `+${rbPct}% ≈ ${fmtWorth(c.em)}` : 'no Reaction Bonus'}
							</span>
						{/if}
					</span>
				</div>
			{/each}
			{#if family.id !== 'all' && rbPct > 0 && family.curves[0].em}
				<p class="note">
					A +{rbPct}% Reaction Bonus is worth {fmtWorth(family.curves[0].em)} from here.
				</p>
			{/if}
			<p class="note">{family.caveat}</p>
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
		/* a horizontal drag sets EM; a vertical one still scrolls the tile, and
		   neither selects the tick labels */
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
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

	/* The Level slider's 90 / 95 / 100 marks. Above 90 only 95 and 100 exist,
	   so the slider keeps the gaps' width and jumps them; the marks say where
	   it can land. Positioned along the thumb's TRAVEL — its centre runs from
	   half a thumb (15px, app.css .slider) in from either end. */
	.rx-level {
		position: relative;
	}

	.rx-level-marks {
		position: relative;
		height: 5px;
		margin-top: 3px;
	}

	.rx-level-mark {
		position: absolute;
		top: 0;
		left: calc(7.5px + var(--at) * (100% - 15px));
		width: 1px;
		height: 5px;
		background: color-mix(in srgb, var(--text) 35%, transparent);
	}

	/* The receipt: exact curve formula, tucked after the plain-language line */
	.rx-formula {
		display: block;
		font-family: var(--font-body);
		font-size: var(--fs-md);
		color: color-mix(in srgb, var(--muted) 70%, transparent);
	}
</style>
