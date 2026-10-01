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
		stepLevel,
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
	/** What a row's reading is built from: its value formatted, the boost as a
	 *  "times its base" figure, and the raw boost for sums of its own. */
	type Ctx = { v: string; times: string; boost: number };
	type Curve = {
		label: string;
		detail: string;
		color: string;
		/** The EM curve a Reaction Bonus trades against — null where none applies
		 *  (Crystallize's shield has no Reaction Bonus bracket). */
		em: EmCurve | null;
		value: (em: number, level: number, rb: number) => number;
		/** The row in plain words: the reading's first sentence. */
		read: (c: Ctx) => string;
	};

	const SHARE = TOP_CONTRIBUTOR_SHARE;

	const FAMILIES: {
		id: FamilyId;
		label: string;
		/** The family's explainer, at the head of the readout. */
		note: string;
		formula?: string;
		caveat?: string;
		yLabel: string;
		/** The readout's first two column heads. */
		rowHead: string;
		valueHead: string;
		usesLevel: boolean;
		curves: Curve[];
	}[] = [
		{
			id: 'all',
			label: 'All families',
			note: 'How much EM boosts each family. Level doesn’t change the boost.',
			yLabel: 'boost from EM',
			rowHead: 'Family',
			valueHead: 'Boost from EM',
			usesLevel: false,
			// ordered by height at the right edge, so the table reads like the chart
			curves: [
				{
					label: 'Transformative',
					detail: 'Overloaded · Swirl · Bloom · Hyperbloom',
					color: 'var(--el-pyro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, _lv, rb) => (emBonus(TRANSFORMATIVE_CURVE, em) + rb) * 100,
					read: (c) => `Transformative reactions would deal ${c.times} times their base damage.`
				},
				{
					label: 'Additive',
					detail: 'Spread · Aggravate',
					color: 'var(--el-dendro-main)',
					em: ADDITIVE_CURVE,
					value: (em, _lv, rb) => (emBonus(ADDITIVE_CURVE, em) + rb) * 100,
					read: (c) => `Spread and Aggravate would add ${c.times} times their base damage.`
				},
				{
					label: 'Lunar & Stellar',
					detail: 'Lunar-Charged · Lunar-Crystallize · Stellar Swirl',
					color: 'var(--el-electro-main)',
					em: SPECIAL_CURVE,
					value: (em, _lv, rb) => (emBonus(SPECIAL_CURVE, em) + rb) * 100,
					read: (c) => `Lunar and Stellar reactions would deal ${c.times} times their base damage.`
				},
				{
					label: 'Crystallize',
					detail: 'Shield',
					color: 'var(--el-geo-main)',
					em: null,
					value: (em) => emBonus(CRYSTALLIZE_CURVE, em) * 100,
					read: (c) => `A Crystallize shield would be ${c.times} times its base strength.`
				},
				{
					label: 'Amplifying',
					detail: 'Vaporize · Melt',
					color: 'var(--el-hydro-main)',
					em: AMP_CURVE,
					value: (em, _lv, rb) => (emBonus(AMP_CURVE, em) + rb) * 100,
					read: (c) =>
						`A forward Vaporize or Melt would multiply the hit by ×${(2 * (1 + c.boost)).toFixed(2)} instead of ×2, and a reverse one by ×${(1.5 * (1 + c.boost)).toFixed(2)} instead of ×1.5.`
				}
			]
		},
		{
			id: 'amplifying',
			label: 'Amplifying',
			note: 'Vaporize and Melt multiply the whole hit. Level plays no part, because the hit already scales with everything else.',
			formula: '2.78·EM/(1400+EM)',
			yLabel: 'hit multiplier',
			rowHead: 'Reaction',
			valueHead: 'Multiplier',
			usesLevel: false,
			curves: [
				{
					label: 'Forward ×2',
					detail: 'Hydro on Pyro Vaporize · Pyro on Cryo Melt',
					color: 'var(--el-hydro-main)',
					em: AMP_CURVE,
					value: (em, _lv, rb) => ampMultiplier(2, em, rb),
					read: (c) => `A forward Vaporize or Melt would multiply its hit by ${c.v}.`
				},
				{
					label: 'Reverse ×1.5',
					detail: 'Pyro on Hydro Vaporize · Cryo on Pyro Melt',
					color: 'var(--el-cryo-main)',
					em: AMP_CURVE,
					value: (em, _lv, rb) => ampMultiplier(1.5, em, rb),
					read: (c) => `A reverse Vaporize or Melt would multiply its hit by ${c.v}.`
				}
			]
		},
		{
			id: 'transformative',
			label: 'Transformative',
			note: 'Damage from the character’s level and EM alone. For most characters, crit, ATK, and DMG% do nothing.',
			formula: '16·EM/(2000+EM)',
			yLabel: 'damage',
			rowHead: 'Reaction',
			valueHead: 'Damage',
			usesLevel: true,
			curves: [
				{
					label: 'Hyperbloom · Burgeon · Shatter',
					detail: '×3',
					color: 'var(--el-dendro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(3, lv, em, rb),
					read: (c) =>
						`A Hyperbloom, Burgeon, or Shatter hit would deal ${c.v} damage before enemy RES.`
				},
				{
					label: 'Overloaded',
					detail: '×2.75',
					color: 'var(--el-pyro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(2.75, lv, em, rb),
					read: (c) => `An Overloaded explosion would deal ${c.v} damage before enemy RES.`
				},
				{
					label: 'Electro-Charged · Bloom',
					detail: '×2, Electro-Charged per tick',
					color: 'var(--el-electro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(2, lv, em, rb),
					read: (c) =>
						`An Electro-Charged tick or a Bloom would deal ${c.v} damage before enemy RES.`
				},
				{
					label: 'Superconduct',
					detail: '×1.5',
					color: 'var(--el-cryo-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(1.5, lv, em, rb),
					read: (c) => `A Superconduct hit would deal ${c.v} damage before enemy RES.`
				},
				{
					label: 'Swirl',
					detail: '×0.6',
					color: 'var(--el-anemo-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(0.6, lv, em, rb),
					read: (c) => `A Swirl hit would deal ${c.v} damage before enemy RES.`
				},
				{
					label: 'Burning',
					detail: '×0.25 per tick',
					color: 'var(--rx-burning)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(0.25, lv, em, rb),
					read: (c) => `Each Burning tick would deal ${c.v} damage before enemy RES.`
				}
			]
		},
		{
			id: 'additive',
			label: 'Additive',
			note: 'Flat damage added to the hit that triggers it, which then crits and scales with DMG% along with the hit.',
			formula: '5·EM/(1200+EM)',
			caveat: 'Before enemy RES.',
			yLabel: 'flat DMG added',
			rowHead: 'Reaction',
			valueHead: 'DMG added',
			usesLevel: true,
			curves: [
				{
					label: 'Spread',
					detail: '×1.25, a Dendro hit on Quicken',
					color: 'var(--el-dendro-main)',
					em: ADDITIVE_CURVE,
					value: (em, lv, rb) => additiveDamage(1.25, lv, em, rb),
					read: (c) => `Spread would add ${c.v} damage to the Dendro hit that triggers it.`
				},
				{
					label: 'Aggravate',
					detail: '×1.15, an Electro hit on Quicken',
					color: 'var(--el-electro-main)',
					em: ADDITIVE_CURVE,
					value: (em, lv, rb) => additiveDamage(1.15, lv, em, rb),
					read: (c) => `Aggravate would add ${c.v} damage to the Electro hit that triggers it.`
				}
			]
		},
		{
			id: 'lunar',
			label: 'Lunar & Stellar',
			note: 'Damage from level and EM, and it can crit. Each contributing party member is counted separately; these figures are the top contributor’s 60% share. Lunar-Bloom and Stellar-Conduct deal damage only through abilities.',
			formula: '6·EM/(2000+EM)',
			caveat: 'Stellar Swirl figures are from gcsim, not yet confirmed in game.',
			yLabel: 'damage',
			rowHead: 'Reaction',
			valueHead: 'Damage',
			usesLevel: true,
			curves: [
				{
					label: 'Lunar-Charged · Stellar Swirl blast',
					detail: '×1.8, per tick · after 3+ swirls',
					color: 'var(--el-electro-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(3, lv, em, rb),
					read: (c) =>
						`A Lunar-Charged tick, or a Stellar Swirl blast after 3+ swirls, would deal ${c.v} damage before enemy RES and crit.`
				},
				{
					label: 'Stellar Swirl blast',
					detail: '×1.2, after 1–2 swirls',
					color: 'var(--el-cryo-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(2, lv, em, rb),
					read: (c) =>
						`A Stellar Swirl blast after 1–2 swirls would deal ${c.v} damage before enemy RES and crit.`
				},
				{
					label: 'Lunar-Crystallize',
					detail: '×0.96, per Moondrift hit',
					color: 'var(--el-geo-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(1.6, lv, em, rb),
					read: (c) =>
						`Each Moondrift hit from Lunar-Crystallize would deal ${c.v} damage before enemy RES and crit.`
				},
				{
					label: 'Stellar Swirl',
					detail: '×0.45',
					color: 'var(--el-anemo-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(0.75, lv, em, rb),
					read: (c) => `A Stellar Swirl hit would deal ${c.v} damage before enemy RES and crit.`
				}
			]
		},
		{
			id: 'crystallize',
			label: 'Crystallize',
			note: 'The shard’s shield grows with the triggering character’s level and EM, on a level table of its own.',
			formula: '4.44·EM/(1400+EM)',
			yLabel: 'shield HP',
			rowHead: 'Shard',
			valueHead: 'Shield HP',
			usesLevel: true,
			curves: [
				{
					label: 'Shield',
					detail: 'any element',
					color: 'var(--el-geo-main)',
					em: null,
					value: (em, lv) => crystallizeShieldHp(lv, em),
					read: (c) =>
						`A Crystallize shield would absorb ${c.v} damage, or 2.5 times that against its own element.`
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
	/** The row the reading sentence describes — follows hover, focus and taps. */
	let readIdx = $state(0);

	const family = $derived(FAMILIES.find((f) => f.id === familyId)!);
	const takesRb = $derived(family.curves.some((c) => c.em));

	function pickFamily(id: FamilyId) {
		familyId = id;
		readIdx = 0;
	}

	export function reset() {
		pickFamily('all');
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
	const fmt1 = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });
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
				? `+${d.toFixed(2)}`
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
	const worthOf = (curve: EmCurve) => emWorthOfBonus(curve, em, rb);
	const fmtWorth = (curve: EmCurve) => {
		const n = worthOf(curve);
		return Number.isFinite(n) ? `${fmtInt(n)} EM` : 'beyond any EM';
	};

	// ── The reading: a row, in sentences ─────────────────────────────────
	// Every row's reading is built and stacked in one grid cell, with only the
	// chosen one visible — the box is as tall as the LONGEST, so moving between
	// rows never shifts the Build panel below.
	function readingOf(c: Curve): string {
		const v = at(c, em);
		const boost = family.id === 'all' ? v / 100 : 0;
		const first = c.read({ v: fmt(v), times: fmt1(1 + boost), boost });
		// The bonus's worth has its own column on All families; elsewhere this
		// sentence is the only place it shows — and only while the slider is on
		// screen, which Crystallize's own tab hides.
		if (family.id === 'all' || !takesRb || rbPct === 0 || !c.em) return first;
		const n = worthOf(c.em);
		return `${first} ${
			Number.isFinite(n)
				? `The +${rbPct}% Reaction Bonus would be worth ${fmtInt(n)} more EM here.`
				: `The +${rbPct}% Reaction Bonus would be worth more than any amount of EM here.`
		}`;
	}
	const readings = $derived(family.curves.map(readingOf));

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
		level = snapLevel(Number(el.value));
		el.value = String(level);
	}
	// The arrows step 90 → 95 → 100 themselves: a native step lands on 91,
	// which the nearest-stop snap would send straight back to 90.
	const STEP_KEYS: Record<string, 1 | -1> = {
		ArrowRight: 1,
		ArrowUp: 1,
		ArrowLeft: -1,
		ArrowDown: -1
	};
	function onLevelKey(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		const dir = STEP_KEYS[e.key];
		if (!dir) return;
		e.preventDefault();
		level = stepLevel(level, dir);
		e.currentTarget.value = String(level);
	}
	/** Where a level sits along the slider's travel, for the 90/95/100 marks. */
	const LEVEL_MARKS = [90, 95, 100];
	const markPos = (lv: number) => (lv - 1) / (MAX_LEVEL - 1);
</script>

<div class="instrument">
	<!-- The family picks what the chart draws, so it sits on the chart. -->
	<div class="segment rx-tabs" role="radiogroup" aria-label="Reaction family">
		{#each FAMILIES as f (f.id)}
			<button
				class="btn"
				class:is-active={familyId === f.id}
				role="radio"
				aria-checked={familyId === f.id}
				onclick={() => pickFamily(f.id)}
			>
				{f.label}
			</button>
		{/each}
	</div>

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
				<text x={0} y={TOP - 4} fill="var(--chart-dim)" font-size="10" text-anchor="start">
					{family.yLabel}
				</text>

				<!-- Curves — the one being read draws on top, a little heavier -->
				{#each paths as p, i (p.label)}
					<path
						d={p.d}
						fill="none"
						stroke={p.color}
						stroke-width={i === readIdx ? 2.75 : 2}
						stroke-linejoin="round"
					/>
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

	<div class="panel panel--paper rx-readout">
		<p class="kicker">Readout</p>
		<p class="note rx-intro">{family.note}</p>
		<table class="rx-table">
			<thead>
				<tr>
					<th scope="col">{family.rowHead}</th>
					<th scope="col" class="rx-num">{family.valueHead}</th>
					<th scope="col" class="rx-num">Next {GAIN_STEP} EM adds</th>
					{#if family.id === 'all' && rbPct > 0}
						<th scope="col" class="rx-num">+{rbPct}% bonus is worth</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each family.curves as c, i (c.label)}
					<tr
						class:is-read={i === readIdx}
						tabindex="0"
						onpointerenter={() => (readIdx = i)}
						onfocus={() => (readIdx = i)}
						onclick={() => (readIdx = i)}
					>
						<th scope="row">
							<span class="rx-dot" style:background={c.color}></span>
							<span class="rx-name">{c.label}</span>
							<span class="rx-detail">{c.detail}</span>
						</th>
						<td class="rx-num rx-strong">{fmt(at(c, em))}</td>
						<td class="rx-num">{fmtGain(c)}</td>
						{#if family.id === 'all' && rbPct > 0}
							<td class="rx-num">{c.em ? fmtWorth(c.em) : 'doesn’t apply'}</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
		<div class="rx-reading" aria-live="polite">
			{#each readings as r, i (i)}
				<p class:is-read={i === readIdx} aria-hidden={i !== readIdx}>{r}</p>
			{/each}
		</div>
		{#if family.formula || family.caveat}
			<p class="rx-receipt">
				{#if family.formula}<span class="rx-formula">{family.formula}</span>{/if}
				{#if family.caveat}<span>{family.caveat}</span>{/if}
			</p>
		{/if}
	</div>

	<div class="panel rx-build">
		<p class="kicker">Build</p>
		<div class="rx-sliders">
			<div class="slider-control" class:rx-wide={!takesRb}>
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
				<div class="slider-control rx-wide">
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
							onkeydown={onLevelKey}
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
			{/if}
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

	/* Six families outgrow a narrow tile's width — wrap rather than scroll. */
	.rx-tabs {
		flex-wrap: wrap;
		justify-self: start;
	}

	/* ── The readout: one row per curve, the columns' heads do the explaining,
	   and the reading says the chosen row in words ── */
	/* The full box, not .note's 56ch measure — the readout is already bounded,
	   and the lines it saves are height the Build box gets back */
	.rx-intro {
		max-width: none;
		margin: 0 0 0.6rem;
	}

	.rx-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
		font-variant-numeric: tabular-nums;
	}

	.rx-table thead th {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--muted);
		text-align: left;
		padding: 0 0.5rem 0.3rem;
		white-space: nowrap;
	}

	.rx-table tbody th,
	.rx-table tbody td {
		padding: 0.25rem 0.5rem;
		border-top: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
		vertical-align: baseline;
	}

	.rx-table tbody th {
		text-align: left;
		font-weight: inherit;
	}

	.rx-table tbody tr {
		cursor: default;
		transition: background-color var(--t-snap);
	}

	.rx-table tbody tr.is-read {
		background: color-mix(in srgb, var(--text) 7%, transparent);
	}

	.rx-table tbody tr:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.rx-num {
		text-align: right;
		white-space: nowrap;
	}

	.rx-table thead th.rx-num {
		text-align: right;
	}

	.rx-dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		margin-right: 0.45rem;
	}

	.rx-name {
		font-weight: var(--fw-semibold);
		margin-right: 0.45rem;
	}

	.rx-detail {
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	.rx-strong {
		font-weight: var(--fw-semibold);
	}

	.rx-reading {
		display: grid;
		margin-top: 0.6rem;
		font-size: var(--fs-md);
		line-height: var(--lh-normal);
	}

	.rx-reading > p {
		grid-area: 1 / 1;
		margin: 0;
		visibility: hidden;
	}

	.rx-reading > p.is-read {
		visibility: visible;
	}

	.rx-receipt {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 1rem;
		margin: 0.4rem 0 0;
		font-size: var(--fs-sm);
		color: color-mix(in srgb, var(--muted) 85%, transparent);
	}

	.rx-formula {
		font-family: var(--font-body);
	}

	/* ── Build: one full-width box, the sliders side by side ── */
	.rx-sliders {
		display: grid;
		/* EM and Reaction Bonus share a line; Level always takes a line of its
		   own (⚓ Nate) — a third of the box was too short a track to land a level */
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem 1.5rem;
		/* top, not stretch: the Level control is taller by its marks, and a
		   stretched neighbour spreads that height into its own rows, dropping
		   its label below Level's */
		align-items: start;
	}

	.rx-wide {
		grid-column: 1 / -1;
	}

	/* The Level slider's 90 / 95 / 100 marks. Above 90 only 95 and 100 exist,
	   so the slider keeps the gaps' width and jumps them; the marks say where
	   it can land. Positioned along the thumb's TRAVEL — its centre runs from
	   half a thumb (15px, app.css .slider) in from either end. */
	/* grid, so the input is blockified like its siblings' — inline, it sat on a
	   text line and rode 12px lower than the other two tracks */
	.rx-level {
		position: relative;
		display: grid;
	}

	/* ⚠ A range input carries the UA's 2px side margin (Chrome and WebKit
	   alike), so its track starts 2px in from this wrapper. The marks mirror
	   that box exactly — margin AND width — or every mark sits 2px left. */
	.rx-level-marks {
		position: relative;
		width: 100%;
		height: 5px;
		margin: 3px 2px 0;
	}

	.rx-level-mark {
		position: absolute;
		top: 0;
		/* centred on the thumb's centre: half the 1px mark back */
		left: calc(7.5px + var(--at) * (100% - 15px) - 0.5px);
		width: 1px;
		height: 5px;
		background: color-mix(in srgb, var(--text) 35%, transparent);
	}
</style>
