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
		RB_MAX,
		type EmCurve
	} from './reactionCurves';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import InstrumentSlider from './kit/InstrumentSlider.svelte';
	import { LEVEL_SLIDER } from './kit/level';

	type FamilyId = 'all' | 'amplifying' | 'transformative' | 'additive' | 'lunar' | 'crystallize';
	/** What a curve's reading is built from: its value formatted, the boost as a
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
		/** The row in plain words: the dot label's tooltip. */
		read: (c: Ctx) => string;
		/** What the headline's figure is a gain in: "{noun} from the next 100 EM". */
		noun: string;
	};

	const SHARE = TOP_CONTRIBUTOR_SHARE;

	const FAMILIES: {
		id: FamilyId;
		label: string;
		/** The family's explainer, in the fine print. */
		note: string;
		formula?: string;
		caveat?: string;
		yLabel: string;
		/** The setup bar's name for the curve the headline reads. */
		rowHead: string;
		usesLevel: boolean;
		curves: Curve[];
	}[] = [
		{
			id: 'all',
			label: 'All families',
			note: 'How much EM boosts each family.',
			yLabel: 'boost from EM',
			rowHead: 'Family',
			usesLevel: false,
			// ordered by height at the right edge, so the table reads like the chart
			curves: [
				{
					label: 'Transformative',
					noun: 'Transformative boost',
					detail: 'Overloaded · Swirl · Bloom · Hyperbloom',
					color: 'var(--el-pyro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, _lv, rb) => (emBonus(TRANSFORMATIVE_CURVE, em) + rb) * 100,
					read: (c) => `Transformative reactions would deal ${c.times} times their base damage.`
				},
				{
					label: 'Additive',
					noun: 'Additive boost',
					detail: 'Spread · Aggravate',
					color: 'var(--el-dendro-main)',
					em: ADDITIVE_CURVE,
					value: (em, _lv, rb) => (emBonus(ADDITIVE_CURVE, em) + rb) * 100,
					read: (c) => `Spread and Aggravate would add ${c.times} times their base damage.`
				},
				{
					label: 'Lunar & Stellar',
					noun: 'Lunar and Stellar boost',
					detail: 'Lunar-Charged · Lunar-Crystallize · Stellar Swirl',
					color: 'var(--el-electro-main)',
					em: SPECIAL_CURVE,
					value: (em, _lv, rb) => (emBonus(SPECIAL_CURVE, em) + rb) * 100,
					read: (c) => `Lunar and Stellar reactions would deal ${c.times} times their base damage.`
				},
				{
					label: 'Crystallize',
					noun: 'Crystallize shield boost',
					detail: 'Shield',
					color: 'var(--el-geo-main)',
					em: null,
					value: (em) => emBonus(CRYSTALLIZE_CURVE, em) * 100,
					read: (c) => `A Crystallize shield would be ${c.times} times its base strength.`
				},
				{
					label: 'Amplifying',
					noun: 'Amplifying boost',
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
			usesLevel: false,
			curves: [
				{
					label: 'Forward ×2',
					noun: 'forward Vaporize or Melt multiplier',
					detail: 'Hydro on Pyro Vaporize · Pyro on Cryo Melt',
					color: 'var(--el-hydro-main)',
					em: AMP_CURVE,
					value: (em, _lv, rb) => ampMultiplier(2, em, rb),
					read: (c) => `A forward Vaporize or Melt would multiply its hit by ${c.v}.`
				},
				{
					label: 'Reverse ×1.5',
					noun: 'reverse Vaporize or Melt multiplier',
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
			usesLevel: true,
			curves: [
				{
					label: 'Hyperbloom · Burgeon · Shatter',
					noun: 'Hyperbloom, Burgeon, or Shatter damage',
					detail: '×3',
					color: 'var(--el-dendro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(3, lv, em, rb),
					read: (c) =>
						`A Hyperbloom, Burgeon, or Shatter hit would deal ${c.v} damage before enemy RES.`
				},
				{
					label: 'Overloaded',
					noun: 'Overloaded damage',
					detail: '×2.75',
					color: 'var(--el-pyro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(2.75, lv, em, rb),
					read: (c) => `An Overloaded explosion would deal ${c.v} damage before enemy RES.`
				},
				{
					label: 'Electro-Charged · Bloom',
					noun: 'Electro-Charged or Bloom damage',
					detail: '×2, Electro-Charged per tick',
					color: 'var(--el-electro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(2, lv, em, rb),
					read: (c) =>
						`An Electro-Charged tick or a Bloom would deal ${c.v} damage before enemy RES.`
				},
				{
					label: 'Superconduct',
					noun: 'Superconduct damage',
					detail: '×1.5',
					color: 'var(--el-cryo-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(1.5, lv, em, rb),
					read: (c) => `A Superconduct hit would deal ${c.v} damage before enemy RES.`
				},
				{
					label: 'Swirl',
					noun: 'Swirl damage',
					detail: '×0.6',
					color: 'var(--el-anemo-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(0.6, lv, em, rb),
					read: (c) => `A Swirl hit would deal ${c.v} damage before enemy RES.`
				},
				{
					label: 'Burning',
					noun: 'damage per Burning tick',
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
			usesLevel: true,
			curves: [
				{
					label: 'Spread',
					noun: 'Spread damage',
					detail: '×1.25, a Dendro hit on Quicken',
					color: 'var(--el-dendro-main)',
					em: ADDITIVE_CURVE,
					value: (em, lv, rb) => additiveDamage(1.25, lv, em, rb),
					read: (c) => `Spread would add ${c.v} damage to the Dendro hit that triggers it.`
				},
				{
					label: 'Aggravate',
					noun: 'Aggravate damage',
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
			usesLevel: true,
			curves: [
				{
					label: 'Lunar-Charged · Stellar Swirl blast',
					noun: 'Lunar-Charged or Stellar Swirl blast damage',
					detail: '×1.8, per tick · after 3+ swirls',
					color: 'var(--el-electro-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(3, lv, em, rb),
					read: (c) =>
						`A Lunar-Charged tick, or a Stellar Swirl blast after 3+ swirls, would deal ${c.v} damage before enemy RES and crit.`
				},
				{
					label: 'Stellar Swirl blast',
					noun: 'Stellar Swirl blast damage after 1–2 swirls',
					detail: '×1.2, after 1–2 swirls',
					color: 'var(--el-cryo-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(2, lv, em, rb),
					read: (c) =>
						`A Stellar Swirl blast after 1–2 swirls would deal ${c.v} damage before enemy RES and crit.`
				},
				{
					label: 'Lunar-Crystallize',
					noun: 'damage per Moondrift hit',
					detail: '×0.96, per Moondrift hit',
					color: 'var(--el-geo-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(1.6, lv, em, rb),
					read: (c) =>
						`Each Moondrift hit from Lunar-Crystallize would deal ${c.v} damage before enemy RES and crit.`
				},
				{
					label: 'Stellar Swirl',
					noun: 'Stellar Swirl damage',
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
			usesLevel: true,
			curves: [
				{
					label: 'Shield',
					noun: 'shield HP',
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
	/** The curve the headline reads: the setup bar's first segment, or a click
	 *  on its label on the chart. */
	let pick = $state(0);

	const family = $derived(FAMILIES.find((f) => f.id === familyId)!);
	const takesRb = $derived(family.curves.some((c) => c.em));
	const picked = $derived(family.curves[Math.min(pick, family.curves.length - 1)]);

	function pickFamily(id: FamilyId) {
		familyId = id;
		pick = 0;
	}

	export function reset() {
		pickFamily('all');
		em = 200;
		level = 90;
		rbPct = 0;
	}

	// ── Workspace handle (share) ───────────────────────────────────────────────
	export function getShareState() {
		return { v: 1, family: familyId, em, level, rb: rbPct, pick };
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		// clamped to the slider's range and snapped to its step
		const num = (v: unknown, hi: number, step: number) =>
			typeof v === 'number' && Number.isFinite(v)
				? Math.round(Math.min(hi, Math.max(0, v)) / step) * step
				: undefined;
		reset();
		const f = FAMILIES.find((x) => x.id === s.family);
		if (f) pickFamily(f.id);
		em = num(s.em, EM_MAX, 5) ?? em;
		if (typeof s.level === 'number' && Number.isFinite(s.level)) level = snapLevel(s.level);
		rbPct = num(s.rb, RB_MAX, 5) ?? rbPct;
		// an older link has no pick: the family's first curve, as before
		pick = num(s.pick, family.curves.length - 1, 1) ?? 0;
	}

	// ── Geometry ───────────────────────────────────────────────────────────────
	let graphW = $state(720);
	let graphH = $state(0);
	/** 🎛️ The left margin is what the y axis's numbers need ("12.5k"), so the
	 *  widest starts near the stage's edge; every word on the chart starts at
	 *  the plot's left edge (PADL), never in the margin. */
	const PADL = 38;
	const PADR = 12;
	const TOP = 16;
	/** The plot's height at its least — the chart grows from here into the tile. */
	const PLOT_MIN = 210;
	/** 🎛️ The companion strip's height (design §7: at most one, on the main x axis). */
	const COMP_H = 64;
	/** 🎛️ Between the plot and the strip; the strip's label sits in it. */
	const COMP_GAP = 24;
	/** The axis's numbers and its name, under the strip. */
	const AXIS_H = 30;
	const CHROME_H = TOP + COMP_GAP + COMP_H + AXIS_H;
	const plotH = $derived(Math.max(PLOT_MIN, graphH - CHROME_H));
	const plotY1 = $derived(TOP + plotH);
	const compY0 = $derived(plotY1 + COMP_GAP);
	const compY1 = $derived(compY0 + COMP_H);
	const H = $derived(compY1 + AXIS_H);
	/** Half the slider thumb's 15px (app.css `.slider`): the handle's track runs
	 *  this far past each end of the axis, so the thumb sits on the marker. */
	const THUMB_R = 7.5;

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

	const plotW = $derived(graphW - PADL - PADR);
	const xOf = $derived((e: number) => PADL + (e / EM_MAX) * plotW);
	const yOf = $derived((v: number) => plotY1 - (v / yMax) * (plotH - 8));

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
	const fmtTick = (v: number) =>
		family.id === 'all'
			? `${Math.round(v)}%`
			: family.id === 'amplifying'
				? v.toFixed(1)
				: v >= 1000
					? `${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`
					: `${Math.round(v)}`;

	// ── The headline: what the NEXT 100 EM adds (⚓ Nate) ─────────────────
	// The curve's diminishing returns as one number. A gain, not a slope: what
	// the step from here to 100 EM more really adds, so the step drawn on the
	// curve rises by exactly the headline's figure.
	const GAIN_STEP = 100;
	const gainOf = (c: Curve, e: number) => at(c, e + GAIN_STEP) - at(c, e);
	const fmtGain = (d: number) =>
		family.id === 'all'
			? `+${d.toFixed(1)}%`
			: family.id === 'amplifying'
				? `+${d.toFixed(2)}`
				: `+${fmtInt(d)}`;
	const headGain = $derived(gainOf(picked, em));

	/** What the current Reaction Bonus is worth in EM on the picked curve. */
	const bonusWorth = $derived.by(() => {
		if (!picked.em) return 'none';
		if (rbPct === 0) return null;
		const n = emWorthOfBonus(picked.em, em, rb);
		return Number.isFinite(n) ? `${fmtInt(n)} more EM` : 'more than any amount of EM';
	});

	/** A curve's reading in words: its dot label's tooltip. */
	function readingOf(c: Curve): string {
		const v = at(c, em);
		const boost = family.id === 'all' ? v / 100 : 0;
		return c.read({ v: fmt(v), times: fmt1(1 + boost), boost });
	}

	// ── The answer as geometry (design §7: the response-curve family) ──────
	// Each curve's dot at your EM carries its name and value (the headline
	// speaks for the gain, not the value), nudged apart where two would touch;
	// the picked one's in the ink.
	/** 🎛️ The least gap between two dot labels, in px. */
	const DOT_LABEL_GAP = 13;
	/** A condensed 11px glyph, generously — only decides which side a label sits. */
	const LABEL_CHAR_PX = 6.4;
	const labelOf = (c: Curve) => `${c.label} ${fmt(at(c, em))}`;
	/** The dot labels go LEFT of the marker, above each rising curve, where
	 *  the step (right of the marker, under the picked curve) leaves them
	 *  clear; right of it only where the widest wouldn't fit on the left. */
	const labelsLeft = $derived(
		xOf(em) - 8 - Math.max(...family.curves.map((c) => labelOf(c).length)) * LABEL_CHAR_PX >= PADL
	);
	const dotLabels = $derived.by(() => {
		const x = xOf(em);
		const left = labelsLeft;
		const placed = family.curves
			.map((c, i) => ({
				i,
				text: labelOf(c),
				title: readingOf(c),
				y: yOf(at(c, em))
			}))
			.sort((a, b) => a.y - b.y);
		for (let k = 1; k < placed.length; k++)
			placed[k].y = Math.max(placed[k].y, placed[k - 1].y + DOT_LABEL_GAP);
		return placed.map((l) => ({
			...l,
			x: left ? x - 8 : x + 8,
			y: l.y + 3.5,
			anchor: left ? 'end' : 'start'
		}));
	});

	/** The step on the picked curve: 100 EM across, then up by what it adds. */
	const step = $derived.by(() => {
		if (em + GAIN_STEP > EM_MAX) return null;
		const x0 = xOf(em);
		const x1 = xOf(em + GAIN_STEP);
		const y0 = yOf(at(picked, em));
		const y1 = yOf(at(picked, em + GAIN_STEP));
		return { x0, x1, y0, y1 };
	});

	// The companion strip: what the next 100 EM adds, at every EM, on the
	// picked curve. Falling, always: the diminishing returns, drawn. Scaled to
	// its own peak, so it shows shape, not size.
	const compPath = $derived.by(() => {
		const g = (e: number) => gainOf(picked, e);
		const peak = Math.max(g(0), g(EM_MAX));
		if (!(peak > 0)) return '';
		const y = (d: number) => (compY1 - (d / peak) * (COMP_H - 4)).toFixed(1);
		let d = `M${xOf(0).toFixed(1)},${compY1}`;
		for (let i = 0; i <= SAMPLES; i++) {
			const e = (i / SAMPLES) * EM_MAX;
			d += ` L${xOf(e).toFixed(1)},${y(g(e))}`;
		}
		return `${d} L${xOf(EM_MAX).toFixed(1)},${compY1} Z`;
	});
	const compDotY = $derived.by(() => {
		const peak = Math.max(gainOf(picked, 0), gainOf(picked, EM_MAX));
		return peak > 0 ? compY1 - (headGain / peak) * (COMP_H - 4) : compY1;
	});

	// The chart moves the EM marker on press-and-drag only.
	let dragging = $state(false);
	function emAt(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		em = Math.round(Math.min(EM_MAX, Math.max(0, ((x - PADL) / plotW) * EM_MAX)) / 5) * 5;
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
</script>

<!-- THE STAGE (design §6). One box: the chart head (what the next 100 EM
     adds), the chart's toolbar on its top edge (the families, then the setup
     bar), the chart with its companion, and the EM handle on its bottom edge.
     The old Readout table is on the chart: each curve's value at its dot, the
     gain as the step and the strip, the readings as the dots' tooltips. -->
<div class="stage-root">
	<div class="stage ctx-dark">
		<p class="readout-head stage-head">
			{fmtGain(headGain)}<span class="readout-sentence"
				>{picked.noun} from the next {GAIN_STEP} EM</span
			>
		</p>

		<div class="stage-toolbar">
			<div class="segment stage-tabs" role="radiogroup" aria-label="Reaction family">
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

			<div class="setup-bar" role="group" aria-label="Setup">
				{#if family.curves.length > 1}
					<BandMenu role="dialog" align="start" ariaLabel="{family.rowHead}: {picked.label}">
						{#snippet face()}
							<span class="setup-key">{family.rowHead}</span>
							<span class="setup-val">{picked.label}</span>
						{/snippet}
						{#snippet items()}
							<div class="setup-pop">
								<div class="rx-picks" role="radiogroup" aria-label={family.rowHead}>
									{#each family.curves as c, i (c.label)}
										<button
											class="rx-pick"
											class:is-on={c === picked}
											role="radio"
											aria-checked={c === picked}
											onclick={() => (pick = i)}
										>
											<span class="rx-dot" style:background={c.color}></span>
											<span class="rx-pick-name">{c.label}</span>
											<span class="rx-pick-detail">{c.detail}</span>
										</button>
									{/each}
								</div>
							</div>
						{/snippet}
					</BandMenu>
				{/if}

				{#if takesRb}
					<BandMenu role="dialog" align="start" ariaLabel="Reaction Bonus: {rbPct}%">
						{#snippet face()}
							<span class="setup-key">Reaction Bonus</span>
							<span class="setup-val setup-val--num">{rbPct}%</span>
						{/snippet}
						{#snippet items()}
							<div class="setup-pop">
								<InstrumentSlider
									label="Reaction Bonus"
									aria="Reaction Bonus in percent"
									bind:value={rbPct}
									min={0}
									max={RB_MAX}
									step={5}
									unit="%"
								/>
								{#if bonusWorth === 'none'}
									<p class="rx-pop-note">A Reaction Bonus doesn’t apply to a Crystallize shield.</p>
								{:else if bonusWorth}
									<p class="rx-pop-note">
										At {em} EM, +{rbPct}% Reaction Bonus is worth {bonusWorth} on {picked.label}.
									</p>
								{:else}
									<p class="rx-pop-note">
										A Reaction Bonus adds to the boost from EM, so it’s worth less EM where the
										curve is steep and more where it has flattened.
									</p>
								{/if}
							</div>
						{/snippet}
					</BandMenu>
				{/if}

				{#if family.usesLevel}
					<BandMenu role="dialog" align="start" ariaLabel="Level: {level}">
						{#snippet face()}
							<span class="setup-key">Level</span>
							<span class="setup-val setup-val--num">{level}</span>
						{/snippet}
						{#snippet items()}
							<div class="setup-pop">
								<!-- Above 90 only 95 and 100 exist; the slider jumps the gaps. -->
								<InstrumentSlider
									label="Level"
									aria="Character level"
									bind:value={level}
									{...LEVEL_SLIDER}
								/>
							</div>
						{/snippet}
					</BandMenu>
				{/if}
			</div>
		</div>

		<div
			class="stage-graph"
			style:--graph-min="{PLOT_MIN + CHROME_H}px"
			bind:clientWidth={graphW}
			bind:clientHeight={graphH}
		>
			<svg
				width={graphW}
				height={H}
				role="img"
				aria-label="Reaction scaling curves vs Elemental Mastery"
				onpointerdown={onDown}
				onpointermove={onMove}
				onpointerup={onUp}
				onpointercancel={onUp}
				style:cursor="ew-resize"
			>
				<!-- EM grid, through the plot and the strip -->
				{#each X_TICKS as t (t)}
					<line x1={xOf(t)} y1={TOP} x2={xOf(t)} y2={plotY1} stroke="var(--chart-grid)" />
					<line x1={xOf(t)} y1={compY0} x2={xOf(t)} y2={compY1} stroke="var(--chart-grid)" />
					<text
						x={xOf(t)}
						y={compY1 + 15}
						fill="var(--chart-ink)"
						font-size="10"
						text-anchor="middle"
					>
						{t}
					</text>
				{/each}
				<text
					x={graphW - PADR}
					y={compY1 + 27}
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
				<text x={PADL} y={TOP - 4} fill="var(--chart-dim)" font-size="10" text-anchor="start">
					{family.yLabel}
				</text>

				<!-- Curves: the picked one draws on top, a little heavier -->
				{#each paths as p (p.label)}
					{#if p !== picked}
						<path d={p.d} fill="none" stroke={p.color} stroke-width="1.75" stroke-opacity="0.7" />
					{/if}
				{/each}
				{#each paths as p (p.label)}
					{#if p.label === picked.label}
						<path d={p.d} fill="none" stroke={p.color} stroke-width="2.75" />
					{/if}
				{/each}

				<!-- The step: the next 100 EM across, and what it adds, up -->
				{#if step}
					<path
						d="M{step.x0},{step.y0} L{step.x1},{step.y0} L{step.x1},{step.y1}"
						fill="none"
						stroke="var(--text)"
						stroke-width="1.25"
						stroke-dasharray="3 2"
					/>
				{/if}
				{#if step && labelsLeft}
					<text
						class="stage-word"
						x={(step.x0 + step.x1) / 2}
						y={step.y0 + 13}
						fill="var(--chart-dim)"
						font-size="10"
						text-anchor="middle"
					>
						next {GAIN_STEP} EM
					</text>
				{/if}

				<!-- The companion: what the next 100 EM adds, at every EM -->
				<line x1={PADL} y1={compY1} x2={graphW - PADR} y2={compY1} stroke="var(--chart-rule)" />
				{#if compPath}
					<path d={compPath} fill="var(--chart-ink)" fill-opacity="0.45" />
				{/if}
				<text x={PADL} y={compY0 - 6} fill="var(--chart-dim)" font-size="10" text-anchor="start">
					what the next {GAIN_STEP} EM adds
				</text>

				<!-- The EM marker, down through the strip to the handle -->
				<line
					x1={xOf(em)}
					y1={TOP}
					x2={xOf(em)}
					y2={compY1}
					stroke="var(--chart-ink)"
					stroke-width="1.5"
				/>
				<circle
					cx={xOf(em)}
					cy={compDotY}
					r="3"
					fill="var(--accent)"
					style="stroke: var(--frame-bg)"
					stroke-width="1.5"
				/>
				{#each family.curves as c (c.label)}
					<circle
						cx={xOf(em)}
						cy={yOf(at(c, em))}
						r={c === picked ? 4.5 : 3}
						fill={c === picked ? 'var(--accent)' : c.color}
						style="stroke: var(--frame-bg)"
						stroke-width="1.5"
					/>
				{/each}
				<!-- A label is also a pointer shortcut to read its curve; the setup
				     bar's first segment is the keyboard's way. -->
				{#each dotLabels as l (l.i)}
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
					<text
						class="stage-word rx-label"
						class:is-picked={l.i === pick}
						x={l.x}
						y={l.y}
						fill={l.i === pick ? 'var(--text)' : 'var(--chart-ink)'}
						font-size="11"
						text-anchor={l.anchor}
						onpointerdown={(e) => e.stopPropagation()}
						onclick={() => (pick = l.i)}
					>
						{l.text}<title>{l.title}</title>
					</text>
				{/each}
			</svg>
		</div>

		<!-- THE HANDLE (design §6): EM is the x axis's, so its control is too. -->
		<div
			class="stage-handle"
			style:--stage-handle-l="{PADL - THUMB_R}px"
			style:--stage-handle-r="{PADR - THUMB_R}px"
		>
			<InstrumentSlider
				label="Elemental Mastery"
				aria="Elemental Mastery"
				bind:value={em}
				min={0}
				max={EM_MAX}
				step={5}
			/>
		</div>

		<!-- The fine print: the family's working, which no mark can show. -->
		<p class="stage-fine">
			{family.note}
			{#if family.formula}<span class="rx-formula">EM bonus {family.formula}.</span>{/if}
			{#if family.caveat}{family.caveat}{/if}
		</p>
	</div>
</div>

<style>
	/* The picked curve's label reads in the ink; a label is clickable. */
	.rx-label {
		cursor: pointer;
	}

	.rx-label.is-picked {
		font-weight: var(--fw-semibold);
	}

	/* The curve the headline reads: a list, a row per curve, its reactions under
	   its name, past the dot. */
	.rx-picks {
		display: grid;
		gap: 0.15rem;
	}

	.rx-pick {
		display: grid;
		grid-template-columns: auto 1fr;
		column-gap: 0.45rem;
		align-items: baseline;
		padding: 0.3rem 0.5rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	@media (hover: hover) {
		.rx-pick:hover {
			background: color-mix(in srgb, var(--text) 7%, transparent);
		}
	}

	.rx-pick.is-on {
		background: color-mix(in srgb, var(--text) 12%, transparent);
	}

	.rx-pick:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.rx-dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}

	.rx-pick-name {
		font-weight: var(--fw-semibold);
	}

	.rx-pick-detail {
		grid-column: 2;
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	.rx-pop-note {
		margin: 0.5rem 0 0;
		font-size: var(--fs-sm);
		line-height: var(--lh-snug);
		color: var(--muted);
	}

	.rx-formula {
		font-variant-numeric: tabular-nums;
	}
</style>
