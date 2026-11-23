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
	import Msg from '$lib/components/Msg.svelte';
	import { m } from '$lib/paraglide/messages';

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
		/** Never translated: a formula reads the same in every locale. */
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
			label: m.vz_rc_all_families(),
			note: m.vz_rc_how_much_em_boosts_each_family(),
			yLabel: m.vz_rc_boost_from_em(),
			rowHead: m.vz_rc_family(),
			usesLevel: false,
			// ordered by height at the right edge, so the table reads like the chart
			curves: [
				{
					label: m.vz_rc_transformative(),
					noun: m.vz_rc_transformative_boost(),
					detail: m.vz_rc_overloaded_swirl_bloom_hyperbloom(),
					color: 'var(--el-pyro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, _lv, rb) => (emBonus(TRANSFORMATIVE_CURVE, em) + rb) * 100,
					read: (c) => m.vz_rc_transformative_reactions_would_deal({ times: c.times })
				},
				{
					label: m.vz_rc_additive(),
					noun: m.vz_rc_additive_boost(),
					detail: m.vz_rc_spread_aggravate(),
					color: 'var(--el-dendro-main)',
					em: ADDITIVE_CURVE,
					value: (em, _lv, rb) => (emBonus(ADDITIVE_CURVE, em) + rb) * 100,
					read: (c) => m.vz_rc_spread_and_aggravate_would_add_times({ times: c.times })
				},
				{
					label: m.vz_rc_lunar_stellar(),
					noun: m.vz_rc_lunar_and_stellar_boost(),
					detail: m.vz_rc_lunar_charged_lunar_crystallize_stellar(),
					color: 'var(--el-electro-main)',
					em: SPECIAL_CURVE,
					value: (em, _lv, rb) => (emBonus(SPECIAL_CURVE, em) + rb) * 100,
					read: (c) => m.vz_rc_lunar_and_stellar_reactions_would_deal({ times: c.times })
				},
				{
					label: m.vz_rc_crystallize(),
					noun: m.vz_rc_crystallize_shield_boost(),
					detail: m.vz_rc_shield(),
					color: 'var(--el-geo-main)',
					em: null,
					value: (em) => emBonus(CRYSTALLIZE_CURVE, em) * 100,
					read: (c) => m.vz_rc_a_crystallize_shield_would_be_times({ times: c.times })
				},
				{
					label: m.vz_rc_amplifying(),
					noun: m.vz_rc_amplifying_boost(),
					detail: m.vz_rc_vaporize_melt(),
					color: 'var(--el-hydro-main)',
					em: AMP_CURVE,
					value: (em, _lv, rb) => (emBonus(AMP_CURVE, em) + rb) * 100,
					read: (c) =>
						m.vz_rc_a_forward_vaporize_or_melt_would_78d1({
							forward: (2 * (1 + c.boost)).toFixed(2),
							reverse: (1.5 * (1 + c.boost)).toFixed(2)
						})
				}
			]
		},
		{
			id: 'amplifying',
			label: m.vz_rc_amplifying(),
			note: m.vz_rc_vaporize_and_melt_multiply_the_whole_hit(),
			formula: '2.78·EM/(1400+EM)',
			yLabel: m.vz_rc_hit_multiplier(),
			rowHead: m.vz_rc_reaction(),
			usesLevel: false,
			curves: [
				{
					label: m.vz_rc_forward_2(),
					noun: m.vz_rc_forward_vaporize_or_melt_multiplier(),
					detail: m.vz_rc_hydro_on_pyro_vaporize_pyro_on_cryo_melt(),
					color: 'var(--el-hydro-main)',
					em: AMP_CURVE,
					value: (em, _lv, rb) => ampMultiplier(2, em, rb),
					read: (c) => m.vz_rc_a_forward_vaporize_or_melt_would_6b58({ value: c.v })
				},
				{
					label: m.vz_rc_reverse_1_5(),
					noun: m.vz_rc_reverse_vaporize_or_melt_multiplier(),
					detail: m.vz_rc_pyro_on_hydro_vaporize_cryo_on_pyro_melt(),
					color: 'var(--el-cryo-main)',
					em: AMP_CURVE,
					value: (em, _lv, rb) => ampMultiplier(1.5, em, rb),
					read: (c) => m.vz_rc_a_reverse_vaporize_or_melt_would({ value: c.v })
				}
			]
		},
		{
			id: 'transformative',
			label: m.vz_rc_transformative(),
			note: m.vz_rc_damage_from_the_character_s_level_and_em(),
			formula: '16·EM/(2000+EM)',
			yLabel: m.vz_rc_damage(),
			rowHead: m.vz_rc_reaction(),
			usesLevel: true,
			curves: [
				{
					label: m.vz_rc_hyperbloom_burgeon_shatter(),
					noun: m.vz_rc_hyperbloom_burgeon_or_shatter_damage(),
					detail: '×3',
					color: 'var(--el-dendro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(3, lv, em, rb),
					read: (c) => m.vz_rc_a_hyperbloom_burgeon_or_shatter_hit({ value: c.v })
				},
				{
					label: m.vz_rc_overloaded(),
					noun: m.vz_rc_overloaded_damage(),
					detail: '×2.75',
					color: 'var(--el-pyro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(2.75, lv, em, rb),
					read: (c) => m.vz_rc_an_overloaded_explosion_would_deal_v({ value: c.v })
				},
				{
					label: m.vz_rc_electro_charged_bloom(),
					noun: m.vz_rc_electro_charged_or_bloom_damage(),
					detail: m.vz_rc_2_electro_charged_per_tick(),
					color: 'var(--el-electro-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(2, lv, em, rb),
					read: (c) => m.vz_rc_an_electro_charged_tick_or_a_bloom_would({ value: c.v })
				},
				{
					label: m.vz_rc_superconduct(),
					noun: m.vz_rc_superconduct_damage(),
					detail: '×1.5',
					color: 'var(--el-cryo-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(1.5, lv, em, rb),
					read: (c) => m.vz_rc_a_superconduct_hit_would_deal_v_damage({ value: c.v })
				},
				{
					label: m.vz_rc_swirl(),
					noun: m.vz_rc_swirl_damage(),
					detail: '×0.6',
					color: 'var(--el-anemo-main)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(0.6, lv, em, rb),
					read: (c) => m.vz_rc_a_swirl_hit_would_deal_v_damage_before({ value: c.v })
				},
				{
					label: m.vz_rc_burning(),
					noun: m.vz_rc_damage_per_burning_tick(),
					detail: m.vz_rc_0_25_per_tick(),
					color: 'var(--rx-burning)',
					em: TRANSFORMATIVE_CURVE,
					value: (em, lv, rb) => transformativeDamage(0.25, lv, em, rb),
					read: (c) => m.vz_rc_each_burning_tick_would_deal_v_damage({ value: c.v })
				}
			]
		},
		{
			id: 'additive',
			label: m.vz_rc_additive(),
			note: m.vz_rc_flat_damage_added_to_the_hit_that(),
			formula: '5·EM/(1200+EM)',
			caveat: m.vz_rc_before_enemy_res(),
			yLabel: m.vz_rc_flat_dmg_added(),
			rowHead: m.vz_rc_reaction(),
			usesLevel: true,
			curves: [
				{
					label: m.vz_rc_spread(),
					noun: m.vz_rc_spread_damage(),
					detail: m.vz_rc_1_25_a_dendro_hit_on_quicken(),
					color: 'var(--el-dendro-main)',
					em: ADDITIVE_CURVE,
					value: (em, lv, rb) => additiveDamage(1.25, lv, em, rb),
					read: (c) => m.vz_rc_spread_would_add_v_damage_to_the_dendro({ value: c.v })
				},
				{
					label: m.vz_rc_aggravate(),
					noun: m.vz_rc_aggravate_damage(),
					detail: m.vz_rc_1_15_an_electro_hit_on_quicken(),
					color: 'var(--el-electro-main)',
					em: ADDITIVE_CURVE,
					value: (em, lv, rb) => additiveDamage(1.15, lv, em, rb),
					read: (c) => m.vz_rc_aggravate_would_add_v_damage_to_the({ value: c.v })
				}
			]
		},
		{
			id: 'lunar',
			label: m.vz_rc_lunar_stellar(),
			note: m.vz_rc_damage_from_level_and_em_and_it_can_crit(),
			formula: '6·EM/(2000+EM)',
			caveat: m.vz_rc_stellar_swirl_figures_are_from_gcsim_not(),
			yLabel: m.vz_rc_damage(),
			rowHead: m.vz_rc_reaction(),
			usesLevel: true,
			curves: [
				{
					label: m.vz_rc_lunar_charged_stellar_swirl_blast(),
					noun: m.vz_rc_lunar_charged_or_stellar_swirl_blast(),
					detail: m.vz_rc_1_8_per_tick_after_3_swirls(),
					color: 'var(--el-electro-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(3, lv, em, rb),
					read: (c) => m.vz_rc_a_lunar_charged_tick_or_a_stellar_swirl({ value: c.v })
				},
				{
					label: m.vz_rc_stellar_swirl_blast(),
					noun: m.vz_rc_stellar_swirl_blast_damage_after_1_2(),
					detail: m.vz_rc_1_2_after_1_2_swirls(),
					color: 'var(--el-cryo-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(2, lv, em, rb),
					read: (c) => m.vz_rc_a_stellar_swirl_blast_after_1_2_swirls({ value: c.v })
				},
				{
					label: m.vz_rc_lunar_crystallize(),
					noun: m.vz_rc_damage_per_moondrift_hit(),
					detail: m.vz_rc_0_96_per_moondrift_hit(),
					color: 'var(--el-geo-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(1.6, lv, em, rb),
					read: (c) => m.vz_rc_each_moondrift_hit_from_lunar({ value: c.v })
				},
				{
					label: m.vz_rc_stellar_swirl(),
					noun: m.vz_rc_stellar_swirl_damage(),
					detail: '×0.45',
					color: 'var(--el-anemo-main)',
					em: SPECIAL_CURVE,
					value: (em, lv, rb) => SHARE * specialReactionDamage(0.75, lv, em, rb),
					read: (c) => m.vz_rc_a_stellar_swirl_hit_would_deal_v_damage({ value: c.v })
				}
			]
		},
		{
			id: 'crystallize',
			label: m.vz_rc_crystallize(),
			note: m.vz_rc_the_shard_s_shield_grows_with_the(),
			formula: '4.44·EM/(1400+EM)',
			yLabel: m.vz_rc_shield_hp(),
			rowHead: m.vz_rc_shard(),
			usesLevel: true,
			curves: [
				{
					label: m.vz_rc_shield(),
					noun: m.vz_rc_shield_hp(),
					detail: m.vz_rc_any_element(),
					color: 'var(--el-geo-main)',
					em: null,
					value: (em, lv) => crystallizeShieldHp(lv, em),
					read: (c) => m.vz_rc_a_crystallize_shield_would_absorb_v({ value: c.v })
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
		const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((st) => yMax / st <= 5)!;
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
		return Number.isFinite(n)
			? m.vz_rc_n_more_em({ amount: fmtInt(n) })
			: m.vz_rc_more_than_any_amount_of_em();
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
		// …then back up from the plot's floor, so a short plot (a phone) never
		// stacks them down onto the strip's label.
		const floor = plotY1 - 6;
		for (let k = placed.length - 1; k >= 0; k--)
			placed[k].y = Math.min(
				placed[k].y,
				k === placed.length - 1 ? floor : placed[k + 1].y - DOT_LABEL_GAP
			);
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
		// an SVG path, not text
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
			<Msg
				parts={m.vz_rc_headgain_noun_from_the_next_gain_step_em.parts({
					gain: fmtGain(headGain),
					noun: picked.noun,
					step: GAIN_STEP
				})}
				tags={{ sentence }}
			/>
			{#snippet sentence(text: string)}<span class="readout-sentence">{text}</span>{/snippet}
		</p>

		<div class="stage-toolbar">
			<div class="segment stage-tabs" role="radiogroup" aria-label={m.vz_rc_reaction_family()}>
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

			<div class="setup-bar" role="group" aria-label={m.vz_rc_setup()}>
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
					<BandMenu role="dialog" align="start" ariaLabel={m.vz_rc_reaction_bonus_rbpct({ rbPct })}>
						{#snippet face()}
							<span class="setup-key">{m.vz_rc_reaction_bonus()}</span>
							<span class="setup-val setup-val--num">{rbPct}%</span>
						{/snippet}
						{#snippet items()}
							<div class="setup-pop">
								<InstrumentSlider
									label={m.vz_rc_reaction_bonus()}
									aria={m.vz_rc_reaction_bonus_in_percent()}
									bind:value={rbPct}
									min={0}
									max={RB_MAX}
									step={5}
									unit="%"
								/>
								{#if bonusWorth === 'none'}
									<p class="rx-pop-note">{m.vz_rc_a_reaction_bonus_doesn_t_apply_to_a()}</p>
								{:else if bonusWorth}
									<p class="rx-pop-note">
										{m.vz_rc_at_em_em_rbpct_reaction_bonus_is_worth({
											em,
											rbPct,
											worth: bonusWorth,
											curve: picked.label
										})}
									</p>
								{:else}
									<p class="rx-pop-note">
										{m.vz_rc_a_reaction_bonus_adds_to_the_boost_from()}
									</p>
								{/if}
							</div>
						{/snippet}
					</BandMenu>
				{/if}

				{#if family.usesLevel}
					<BandMenu role="dialog" align="start" ariaLabel="{m.vz_rc_level()}: {level}">
						{#snippet face()}
							<span class="setup-key">{m.vz_rc_level()}</span>
							<span class="setup-val setup-val--num">{level}</span>
						{/snippet}
						{#snippet items()}
							<div class="setup-pop">
								<!-- Above 90 only 95 and 100 exist; the slider jumps the gaps. -->
								<InstrumentSlider
									label={m.vz_rc_level()}
									aria={m.vz_rc_character_level()}
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
				aria-label={m.vz_rc_reaction_scaling_curves_vs_elemental()}
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
					{m.vz_rc_elemental_mastery()}
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
						{m.vz_rc_next_gain_step_em({ step: GAIN_STEP })}
					</text>
				{/if}

				<!-- The companion: what the next 100 EM adds, at every EM -->
				<line x1={PADL} y1={compY1} x2={graphW - PADR} y2={compY1} stroke="var(--chart-rule)" />
				{#if compPath}
					<path d={compPath} fill="var(--chart-ink)" fill-opacity="0.45" />
				{/if}
				<text x={PADL} y={compY0 - 6} fill="var(--chart-dim)" font-size="10" text-anchor="start">
					{m.vz_rc_what_the_next_gain_step_em_adds({ step: GAIN_STEP })}
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
				label={m.vz_rc_elemental_mastery()}
				aria={m.vz_rc_elemental_mastery()}
				bind:value={em}
				min={0}
				max={EM_MAX}
				step={5}
			/>
		</div>

		<!-- The fine print: the family's working, which no mark can show. -->
		<p class="stage-fine">
			{family.note}
			{#if family.formula}<span class="rx-formula"
					>{m.vz_rc_em_bonus_formula({ formula: family.formula })}</span
				>{/if}
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
