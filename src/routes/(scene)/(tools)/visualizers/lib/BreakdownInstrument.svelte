<script lang="ts">
	import {
		DEFAULT_SHEET,
		REACTIONS,
		RB_MAX,
		BASE_DMG_MAX,
		ELEVATION_MAX,
		additiveChunk,
		additiveEffective,
		ampFactor,
		baseDmgFactor,
		bestRoll,
		critFactor,
		defFactor,
		directTotal,
		dmgFactor,
		elevationFactor,
		emBracket,
		labStats,
		lunarTotal,
		marginalGain,
		resFactor,
		rollColumn,
		scalingFactor,
		scalingTotal,
		solveStat,
		statName,
		transformativeTotal,
		type ColumnId,
		type FamilyId,
		type ScalingStat,
		type SheetInputs
	} from './breakdown';
	import { levelMult, snapLevel } from './reactionCurves';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import InstrumentSlider from './kit/InstrumentSlider.svelte';
	import { LEVEL_SLIDER } from './kit/level';

	const uid = $props.id();

	const FAMILIES: { id: FamilyId; label: string }[] = [
		{ id: 'direct', label: 'Direct hit' },
		{ id: 'additive', label: 'Additive' },
		{ id: 'transformative', label: 'Transformative' },
		{ id: 'lunar', label: 'Lunar & Stellar' }
	];

	let family = $state<FamilyId>('direct');
	let reactionId = $state('none');
	let scaling = $state<ScalingStat>('atk');
	let sheet = $state<SheetInputs>({ ...DEFAULT_SHEET });

	function pickFamily(id: FamilyId) {
		family = id;
		if (!REACTIONS[id].some((r) => r.id === reactionId)) reactionId = REACTIONS[id][0].id;
		readIdx = null;
	}
	const reaction = $derived(
		REACTIONS[family].find((r) => r.id === reactionId) ?? REACTIONS[family][0]
	);
	const stat = $derived(statName(scaling));
	const rb = $derived(sheet.rbPct);
	const usesDef = $derived(family === 'direct' || family === 'additive');
	const amp = $derived(family === 'direct' && reaction.mult > 1);

	// ── The columns ───────────────────────────────────────────────────────────
	// One per bracket, in the formula's own order (⚓ fixed: a column never
	// moves while you drag). Every bar starts where the one before it ended,
	// on one log axis whose gridlines DOUBLE: a ×2 is the same size wherever
	// it sits, and a cut (×0.49) runs back by exactly as far as a ×2.04 runs
	// on.
	//
	// Color follows the house rule (⚓ Nate, 2026-08-11 bar rework): content
	// gets chroma, annotation doesn't. The reaction is the GAME, so its column
	// wears the trigger element's color (the mapping Reaction curves uses);
	// every stat bracket is our READING of the hit and wears --glass-bar, the
	// planner's buff material. ⛔ No categorical palette: each column is
	// labelled at its foot, so a hue per column would carry nothing the label
	// doesn't.
	const RX_COLOR: Record<string, string> = {
		vape2: 'var(--el-hydro-main)',
		vape15: 'var(--el-pyro-main)',
		melt2: 'var(--el-pyro-main)',
		melt15: 'var(--el-cryo-main)',
		spread: 'var(--el-dendro-main)',
		aggravate: 'var(--el-electro-main)',
		hyperbloom: 'var(--el-dendro-main)',
		burgeon: 'var(--el-dendro-main)',
		shatter: 'var(--rx-frozen)',
		overload: 'var(--el-pyro-main)',
		ec: 'var(--el-electro-main)',
		bloom: 'var(--el-dendro-main)',
		superconduct: 'var(--el-cryo-main)',
		swirl: 'var(--el-anemo-main)',
		burning: 'var(--rx-burning)',
		lc: 'var(--el-electro-main)',
		lcrys: 'var(--el-geo-main)',
		ssw: 'var(--el-anemo-main)',
		sswBlast12: 'var(--el-cryo-main)',
		sswBlast3: 'var(--el-cryo-main)'
	};
	const rxColor = $derived(RX_COLOR[reaction.id] ?? null);

	/** What dragging a column changes: the one stat that sets it. A column
	 *  two stats set (crit) or the enemy's (DEF, RES) has none. */
	type Drag = {
		key: keyof SheetInputs;
		label: string;
		unit: string;
		min: number;
		max: number;
		step: number;
		factor: (s: SheetInputs) => number;
	};

	/** One column: a starting value, a multiplier, a subtotal, or the result. */
	type Row = {
		id: ColumnId;
		kind: 'start' | 'mult' | 'subtotal' | 'total';
		name: string;
		/** The bracket's formula, in words where words will do */
		formula: string;
		/** The sheet's numbers that go in */
		real: string;
		/** The multiplier (kind 'mult') or the value (the others) */
		value: number;
		/** null = the glass material (annotation); a color = the game's own chroma */
		color: string | null;
		/** The column in a sentence, for whoever hovers or taps it */
		read: string;
		drag?: Drag;
	};

	const fmtX = (v: number) => `×${v >= 10 ? v.toFixed(1) : v.toFixed(2)}`;
	const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');
	/** ×1.62 → "+62%", ×0.49 → "−51%" (a true minus sign) */
	const fmtChange = (v: number) => {
		const d = Math.round((v - 1) * 100);
		return d >= 0 ? `+${d}%` : `−${Math.abs(d)}%`;
	};
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	/** A stat as the sheet shows it: whole, or to one decimal. */
	const pctS = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
	const bonusWord = $derived(rb > 0 ? ' + Reaction Bonus' : '');
	const emReal = $derived(rb > 0 ? `${sheet.em} EM · +${rb}%` : `${sheet.em} EM`);

	/** Enemy RES has three formulas, and the column shows the one in force */
	const resFormula = $derived(
		sheet.enemyRes < 0 ? '1 − RES ÷ 2' : sheet.enemyRes < 75 ? '1 − RES' : '1 ÷ (1 + 4 × RES)'
	);
	const defMods = $derived(sheet.defShredPct > 0 || sheet.defIgnorePct > 0);

	const EM_DRAG = { key: 'em', label: 'Elemental Mastery', unit: '', min: 0, max: 1200, step: 5 };

	const critRow = $derived<Row>({
		id: 'crit',
		kind: 'mult',
		name: 'Crit, on average',
		formula: '1 + CRIT Rate × CRIT DMG',
		real: `${pctS(sheet.cr)} · ${pctS(sheet.cd)}`,
		value: critFactor(sheet),
		color: null,
		read: `With ${pctS(sheet.cr)} CRIT Rate and ${pctS(sheet.cd)} CRIT DMG, the hit would average ${fmtX(critFactor(sheet))} a non-crit.`
	});
	const dmgRow = $derived<Row>({
		id: 'dmg',
		kind: 'mult',
		name: 'DMG Bonus',
		formula: '1 + DMG Bonus',
		real: `${sheet.dmgPct.toFixed(1)}%`,
		value: dmgFactor(sheet),
		color: null,
		read: `A ${sheet.dmgPct.toFixed(1)}% DMG Bonus would make the hit ${fmtX(dmgFactor(sheet))} as strong.`,
		drag: {
			key: 'dmgPct',
			label: 'DMG Bonus',
			unit: '%',
			min: 0,
			max: 200,
			step: 0.5,
			factor: dmgFactor
		}
	});
	/** The long DEF formula shows only while a shred or an ignore is set, so
	 *  the reading stays short for the common case. */
	const defRow = $derived<Row>({
		id: 'def',
		kind: 'mult',
		name: 'Enemy DEF',
		formula: defMods
			? '(100 + yours) ÷ (100 + yours + (100 + theirs) × (1 − shred) × (1 − ignore))'
			: '(100 + your level) ÷ (both levels + 200)',
		real: defMods
			? `Lv ${sheet.charLevel} vs ${sheet.enemyLevel} · −${sheet.defShredPct}% · −${sheet.defIgnorePct}%`
			: `Lv ${sheet.charLevel} vs ${sheet.enemyLevel}`,
		value: defFactor(sheet),
		color: null,
		read: defMods
			? `At level ${sheet.charLevel} against a level ${sheet.enemyLevel} enemy, its DEF after ${sheet.defShredPct}% shred and ${sheet.defIgnorePct}% ignore would let ${pct(defFactor(sheet))} of the hit through.`
			: `At level ${sheet.charLevel} against a level ${sheet.enemyLevel} enemy, its DEF would let ${pct(defFactor(sheet))} of the hit through.`
	});
	const resRow = $derived<Row>({
		id: 'res',
		kind: 'mult',
		name: 'Enemy RES',
		formula: resFormula,
		real: `${sheet.enemyRes}%`,
		value: resFactor(sheet),
		color: null,
		read:
			sheet.enemyRes < 0
				? `Below 0% RES only half the shred counts, so the enemy would take ${pct(resFactor(sheet))} of the hit.`
				: sheet.enemyRes < 75
					? `At ${sheet.enemyRes}% RES, the enemy would take ${pct(resFactor(sheet))} of the hit.`
					: `From 75% RES the formula changes to a curve, and the enemy would take ${pct(resFactor(sheet))} of the hit.`
	});
	const levelRow = $derived<Row>({
		id: 'level',
		kind: 'start',
		name: 'Level base',
		formula: 'from the level table',
		real: `Lv ${sheet.charLevel}`,
		value: levelMult(sheet.charLevel),
		color: null,
		read: `Every level ${sheet.charLevel} character starts a reaction from the same base: ${fmtInt(levelMult(sheet.charLevel))}.`
	});
	const reactionRow = $derived<Row>({
		id: 'reaction',
		kind: 'mult',
		name: reaction.name,
		formula:
			family === 'lunar' ? `${reaction.mult} × 60% top-contributor share` : `× ${reaction.mult}`,
		real: '',
		value: reaction.shown,
		color: rxColor,
		read:
			family === 'lunar'
				? `${reaction.phrase ? `A ${reaction.phrase}` : reaction.name} multiplies the base by ${reaction.mult}, and the top contributor deals 60% of it: ×${reaction.shown}.`
				: `${reaction.name} multiplies the base by ${reaction.mult}.`
	});
	const emRow = $derived.by<Row>(() => {
		const fam = family === 'direct' ? 'transformative' : family;
		const value = emBracket(fam, sheet);
		const formula =
			fam === 'additive'
				? `1 + 5 × EM ÷ (EM + 1200)${bonusWord}`
				: fam === 'lunar'
					? `1 + 6 × EM ÷ (EM + 2000)${bonusWord}`
					: `1 + 16 × EM ÷ (EM + 2000)${bonusWord}`;
		return {
			id: 'em',
			kind: 'mult',
			name: rb > 0 ? 'EM + Reaction Bonus' : 'EM',
			formula,
			real: emReal,
			value,
			color: null,
			read:
				rb > 0
					? `EM and the +${rb}% Reaction Bonus together would raise it ${fmtX(value)}.`
					: `EM would raise it ${fmtX(value)}.`,
			drag: { ...EM_DRAG, key: 'em', factor: (s) => emBracket(fam, s) }
		};
	});

	const aChunk = $derived(additiveChunk(sheet, reaction.mult));

	/** The columns each family draws, ending in its result */
	const rows = $derived.by((): Row[] => {
		if (family === 'direct') {
			const out: Row[] = [
				{
					id: 'scaling',
					kind: 'mult',
					name: `Scaling ${stat}`,
					formula: `1 + ${stat}% + flat ${stat} ÷ base ${stat}`,
					real: `${fmtInt(scalingTotal(sheet))} ${stat}`,
					value: scalingFactor(sheet),
					color: null,
					read: `Your ${fmtInt(scalingTotal(sheet))} ${stat} would make the hit ${fmtX(scalingFactor(sheet))} what base ${stat} alone deals.`,
					drag: {
						key: 'statPct',
						label: `${stat}%`,
						unit: '%',
						min: 0,
						max: 300,
						step: 0.5,
						factor: scalingFactor
					}
				},
				dmgRow,
				critRow
			];
			if (amp) {
				const mult = reaction.mult;
				const f = ampFactor(sheet, mult);
				out.push({
					id: 'amp',
					kind: 'mult',
					name: reaction.name,
					formula: `${mult} × (1 + 2.78 × EM ÷ (EM + 1400)${bonusWord})`,
					real: emReal,
					value: f,
					color: rxColor,
					read: `A ${mult === 2 ? 'forward' : 'reverse'} ${reaction.name} would multiply the hit by ${fmtX(f)}.`,
					drag: { ...EM_DRAG, key: 'em', factor: (s) => ampFactor(s, mult) }
				});
			}
			out.push(defRow, resRow, {
				id: 'total',
				kind: 'total',
				name: 'Your hit',
				formula: `vs base ${stat} alone`,
				real: '',
				value: directTotal(sheet, reaction.mult),
				color: null,
				read: `Together, these would make the hit ${fmtX(directTotal(sheet, reaction.mult))} what base ${stat} alone deals, before its talent multiplier.`
			});
			return out;
		}
		if (family === 'additive')
			return [
				levelRow,
				reactionRow,
				emRow,
				{
					id: 'chunk',
					kind: 'subtotal',
					name: 'The chunk',
					formula: 'added to the hit’s base damage',
					real: '',
					value: aChunk,
					color: null,
					read: `${reaction.name} would add ${fmtInt(aChunk)} to the hit’s base damage. From here it rides the rest of the hit.`
				},
				dmgRow,
				critRow,
				defRow,
				resRow,
				{
					id: 'total',
					kind: 'total',
					name: 'Damage added',
					formula: 'on average',
					real: '',
					value: additiveEffective(sheet, reaction.mult),
					color: null,
					read: `On average, ${reaction.name} would add ${fmtInt(additiveEffective(sheet, reaction.mult))} damage to each hit it triggers on.`
				}
			];
		if (family === 'lunar')
			return [
				levelRow,
				reactionRow,
				emRow,
				{
					id: 'base',
					kind: 'mult',
					name: 'Base DMG Bonus',
					formula: '1 + Base DMG Bonus',
					real: `${sheet.baseDmgPct}%`,
					value: baseDmgFactor(sheet),
					color: null,
					read: `A ${sheet.baseDmgPct}% Base DMG Bonus would raise it ${fmtX(baseDmgFactor(sheet))}.`,
					drag: {
						key: 'baseDmgPct',
						label: 'Base DMG Bonus',
						unit: '%',
						min: 0,
						max: BASE_DMG_MAX,
						step: 1,
						factor: baseDmgFactor
					}
				},
				{
					id: 'elevation',
					kind: 'mult',
					name: 'Elevation',
					formula: '1 + Elevation, after every other bracket',
					real: `${sheet.elevationPct}%`,
					value: elevationFactor(sheet),
					color: null,
					read: `A ${sheet.elevationPct}% Elevation would raise it ${fmtX(elevationFactor(sheet))}.`,
					drag: {
						key: 'elevationPct',
						label: 'Elevation',
						unit: '%',
						min: 0,
						max: ELEVATION_MAX,
						step: 1,
						factor: elevationFactor
					}
				},
				critRow,
				resRow,
				{
					id: 'total',
					kind: 'total',
					name: 'Damage',
					formula: 'on average',
					real: '',
					value: lunarTotal(sheet, reaction.mult),
					color: null,
					read: `On average, one ${reaction.phrase ?? `${reaction.name} hit`} would deal ${fmtInt(lunarTotal(sheet, reaction.mult))} damage as the top contributor.`
				}
			];
		return [
			levelRow,
			reactionRow,
			emRow,
			resRow,
			{
				id: 'total',
				kind: 'total',
				name: 'Damage',
				formula: '',
				real: '',
				value: transformativeTotal(sheet, reaction.mult),
				color: null,
				read: `One ${reaction.name} hit would deal ${fmtInt(transformativeTotal(sheet, reaction.mult))} damage.`
			}
		];
	});

	/** Each column's bar: where it starts and ends, as running values */
	const origin = $derived(family === 'direct' ? 1 : levelMult(sheet.charLevel));
	const bars = $derived.by(() => {
		let run = origin;
		return rows.map((r) => {
			if (r.kind === 'start') return { from: run, to: run };
			if (r.kind === 'mult') {
				const from = run;
				run *= r.value;
				return { from, to: run };
			}
			// a subtotal or the result spans the whole journey so far
			return { from: origin, to: run };
		});
	});

	// ── The next roll: the headline and the caps ─────────────────────────────
	// ⚓ Nate (2026-11-03): the headline is the best next roll. Every bracket
	// multiplies the rest, so a roll lifts its column by the same ratio it
	// lifts the result (`rollColumn`, tested): on the log axis each cap is as
	// tall as its gain, and caps on different columns compare directly.
	const lab = $derived(labStats(family, reaction.mult, scaling));
	const gains = $derived(
		lab.map((s) => ({ stat: s, gain: marginalGain(family, sheet, reaction.mult, s) }))
	);
	const best = $derived(bestRoll(gains));
	const fmtGain = (g: number) => `+${(g * 100).toFixed(1)}%`;
	/** Every roll that ties the best at the figure shown. On a 1:2 crit ratio
	 *  (the defaults' 70% and 140%) a CRIT Rate roll and a CRIT DMG roll add
	 *  the same, and the headline names both rather than pick one. */
	const bests = $derived(best ? gains.filter((g) => fmtGain(g.gain) === fmtGain(best.gain)) : []);
	const bestNames = $derived.by(() => {
		const names = bests.map((g) => g.stat.label);
		return names.length < 3
			? names.join(' or ')
			: `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
	});
	const capsOf = (id: ColumnId) => gains.filter((g) => rollColumn(family, g.stat.key) === id);
	const fmtStep = (s: { step: number; isPct: boolean }) =>
		s.isPct ? `+${s.step.toFixed(1)}%` : `+${s.step.toFixed(1)}`;
	const rollSentence = (g: (typeof gains)[number]) =>
		`One more ${g.stat.label} roll (${fmtStep(g.stat)}) would raise the damage by ${(g.gain * 100).toFixed(1)}%.`;

	/** What the headline's gain is a gain in. An additive reaction's is the
	 *  damage it adds, not the whole hit. */
	const headNoun = $derived(
		family === 'direct'
			? 'damage'
			: reaction.id === 'sswBlast12' || reaction.id === 'sswBlast3'
				? 'Stellar Swirl blast damage'
				: `${reaction.name} damage`
	);

	/** A column's share of the total swing: how much of the boost it supplies,
	 *  or how much of it a cut takes back */
	const boostLog = $derived(
		rows.reduce((s, r) => (r.kind === 'mult' && r.value > 1 ? s + Math.log(r.value) : s), 0)
	);
	const shareOf = (r: Row) =>
		r.kind === 'mult' && boostLog > 0 ? Math.abs(Math.log(r.value)) / boostLog : 0;
	const readingOf = (r: Row) => {
		const share = shareOf(r);
		const lead =
			r.kind !== 'mult' || share < 0.005
				? r.read
				: r.value >= 1
					? `${r.read} It supplies ${Math.round(share * 100)}% of the boost.`
					: `${r.read} It takes back ${Math.round(share * 100)}% of the boost.`;
		const rolls = capsOf(r.id).map(rollSentence);
		return [lead, ...rolls].join(' ');
	};

	const CAPTIONS: Record<FamilyId, string> = $derived({
		direct: `Each bar multiplies the hit, and each gridline doubles it, so a ×2 is the same size wherever it sits and a cut runs the other way. The result compares against a hit from base ${stat} alone, because the talent multiplier depends on the attack.`,
		additive:
			'Spread and Aggravate add a flat chunk from level and EM alone. The chunk then rides the rest of the hit, so it crits and takes DMG Bonus like the hit does.',
		transformative:
			'Damage from level and EM alone, so the result is a number. For most characters, crit, ATK, and DMG% do nothing, and enemy DEF doesn’t apply.',
		lunar:
			'Damage from level and EM, with two brackets of its own: Base DMG Bonus and Elevation. It can crit, and enemy DEF doesn’t apply. These figures are the top contributor’s 60% share.'
	});

	/** The column being read, by index; null reads the caption */
	let readIdx = $state<number | null>(null);

	// ── Geometry ─────────────────────────────────────────────────────────────
	/** The stage's width decides the form: upright columns where the widest
	 *  family's nine fit (🎛️ about 94px each), rows below (design §8). By the
	 *  width alone, never by the family, so a tab never turns the chart. */
	const UPRIGHT_MIN = 900;
	let stageW = $state(0);
	const upright = $derived(stageW >= UPRIGHT_MIN);

	let graphW = $state(900);
	let graphH = $state(0);
	let footH = $state(0);
	/** 🎛️ The y axis's numbers ("×0.25", "32k"). */
	const PADL = 44;
	const PADR = 12;
	/** The y axis's name, over the plot. */
	const TOP = 18;
	/** 🎛️ Over the highest bar: room for a cap's two-line label. */
	const CAP_ROOM = 30;
	const PLOT_MIN = 240;
	/** 🎛️ A bar's share of its column, and the widest a bar gets. */
	const BAR_SHARE = 0.66;
	const BAR_MAX = 132;
	const svgH = $derived(Math.max(PLOT_MIN + TOP, graphH - footH));
	const plotTop = TOP;
	const plotBottom = $derived(svgH - 6);
	const valTop = plotTop + CAP_ROOM;
	const plotW = $derived(Math.max(0, graphW - PADL - PADR));
	const n = $derived(rows.length);
	const slotW = $derived(plotW / Math.max(1, n));
	const barW = $derived(Math.min(BAR_MAX, slotW * BAR_SHARE));
	const cx = (k: number) => PADL + slotW * (k + 0.5);

	// The axis: log₂, padded, gridlines on doublings: of ×1 for a direct
	// hit, of 1,000 for damage. It takes in each cap's top, so a cap never
	// leaves the plot.
	const unit = $derived(family === 'direct' ? 1 : 1000);
	const PADLOG = Math.log2(1.08);
	const fitDomain = $derived.by(() => {
		const vals = bars.flatMap((b) => [b.from, b.to]);
		for (const g of gains) {
			const k = rows.findIndex((r) => r.id === rollColumn(family, g.stat.key));
			if (k >= 0) vals.push(bars[k].to * (1 + g.gain));
		}
		return {
			lo: Math.log2(Math.min(...vals)) - PADLOG,
			hi: Math.log2(Math.max(...vals)) + PADLOG
		};
	});
	/** ⚠ Frozen while a column is dragged: re-fitted under the hand, the
	 *  axis would move the bar away from the pointer, and the drag would run
	 *  away with it (the gauge's `dragDomain`, the same trap). It may still
	 *  grow, never shrink: `dragTo` solves for that growth, so the bar stays
	 *  under the pointer. */
	let frozen = $state<{ lo: number; hi: number } | null>(null);
	const domain = $derived(
		frozen ? { lo: frozen.lo, hi: Math.max(frozen.hi, fitDomain.hi) } : fitDomain
	);
	const span = $derived(Math.max(1e-9, domain.hi - domain.lo));
	/** Upright: a value's y. */
	const yOf = (v: number) =>
		plotBottom - ((Math.log2(v) - domain.lo) / span) * (plotBottom - valTop);
	/** Rows: a value's x, in % of the track. */
	const xPct = (v: number) => ((Math.log2(v) - domain.lo) / span) * 100;
	/** One doubling, in px on the upright axis. */
	const pxPerDoubling = $derived((plotBottom - valTop) / span);

	const ticks = $derived.by(() => {
		const lu = Math.log2(unit);
		const all: number[] = [];
		for (let k = Math.ceil(domain.lo - lu); k <= domain.hi - lu; k++) all.push(k);
		// a doubling too close to the next for its label: every other one
		const room = upright ? pxPerDoubling : 100 / Math.max(1, all.length);
		const every = upright ? (room < 22 ? 2 : 1) : all.length > 8 ? 2 : 1;
		return all.filter((k) => k % every === 0).map((k) => unit * 2 ** k);
	});
	const fmtTick = (v: number) =>
		family === 'direct'
			? `×${v < 1 ? v.toFixed(2).replace(/0+$/, '') : v}`
			: v >= 1000
				? `${v / 1000}k`
				: `${v}`;

	/** A column's bar, upright: its edges and its two ends' y. */
	const barGeom = (k: number) => {
		const b = bars[k];
		const x0 = cx(k) - barW / 2;
		const y0 = yOf(Math.max(b.from, b.to));
		const y1 = yOf(Math.min(b.from, b.to));
		return { x0, x1: x0 + barW, y0, y1, head: yOf(b.to), loss: b.to < b.from };
	};

	/** The bar is a band of chevron STRIPES (⚓ Nate's mockup, 2026-10-01):
	 *  each stripe's stroke is half the pitch, so stripe and gap are equal,
	 *  and they fade from the head to nothing at the tail. Upright, a stripe's
	 *  point keeps the rows' angle (🎛️ CHEV_SLOPE, depth over half the
	 *  bar's width), so a wide column's chevrons don't flatten. */
	const CHEV_PITCH = 14;
	const CHEV_SLOPE = 0.45;
	/** Faint (⚓ Nate): 12% at the head, fading to nothing at the tail */
	const CHEV_HEAD = 0.12;
	const chevAlpha = (k: number, count: number) =>
		count <= 1 ? CHEV_HEAD : CHEV_HEAD * (1 - k / (count - 1));
	function chevrons(k: number): { points: string; alpha: number }[] {
		const g = barGeom(k);
		const len = g.y1 - g.y0;
		if (len <= 0) return [];
		const count = Math.ceil(len / CHEV_PITCH) + 1;
		const xc = (g.x0 + g.x1) / 2;
		const d = CHEV_SLOPE * (barW / 2);
		const h = CHEV_PITCH / 2 + d;
		const s = g.loss ? -1 : 1; // a cut points down, from its head at the bottom
		const head = g.loss ? g.y1 : g.y0;
		// ⚓ Nate: the pattern runs through the whole bar, so the stripes start
		// past the head (clipped there) and fill its corners beside the point.
		const lead = Math.ceil(h / CHEV_PITCH);
		return Array.from({ length: count + lead }, (_, j) => {
			const i = j - lead;
			const t = head + s * (2 + i * CHEV_PITCH);
			const p = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
			return {
				points: [
					p(g.x0, t + s * h),
					p(g.x0, t + s * d),
					p(xc, t),
					p(g.x1, t + s * d),
					p(g.x1, t + s * h),
					p(xc, t + s * (CHEV_PITCH / 2))
				].join(' '),
				alpha: chevAlpha(Math.max(0, i), count)
			};
		});
	}

	/** Rows: the bar column's width, so a bar knows how many stripes it holds.
	 *  ⚠ CHEV_PITCH is mirrored in the CSS (--pitch). */
	let trackW = $state(0);
	const chevronsFor = (px: number) => (px <= 0 ? 0 : Math.ceil(px / CHEV_PITCH) + 1);

	/** 🎛️ The reaction's bar: its element color's share in a mix with the
	 *  stage's slate (⚓ Nate 2026-11-03: full strength was too vivid as a
	 *  column). In oklab, which keeps it clean where sRGB greys it. Both sides
	 *  are literals, so no mix is fed by another (the WebKit trap, ui.md). */
	const RX_MIX = 70;
	/** ⚓ Nate (2026-11-03): a sum isn't travelling, it's the readout, so it
	 *  wears no stripes, only their fade: the bright ink from the stripes'
	 *  CHEV_HEAD at its head to nothing at its tail. Tried first and set
	 *  aside: even stripes, the chevrons' width and fade with no point. */
	const isSum = (r: Row) => r.kind === 'subtotal' || r.kind === 'total';

	const barFill = (r: Row) =>
		r.kind === 'total'
			? 'color-mix(in srgb, var(--text) 85%, transparent)'
			: r.kind === 'subtotal'
				? 'color-mix(in srgb, var(--text) 40%, transparent)'
				: r.color
					? `color-mix(in oklab, ${r.color} ${RX_MIX}%, var(--frame-bg))`
					: 'var(--glass-bar)';
	/** A stat bracket's stripes are white and fainter (the glass); the
	 *  element's and the sums' are the dark ink. */
	const isGlass = (r: Row) => r.color === null && r.kind === 'mult';

	/** The caps on a column, upright: each roll a slice of the bar's width,
	 *  as tall as its gain on the axis (at least a hairline). */
	const capGeom = (k: number) => {
		const caps = capsOf(rows[k].id);
		if (!caps.length) return [];
		const g = barGeom(k);
		const w = barW / caps.length;
		return caps.map((c, j) => {
			const h = Math.max(1.5, Math.log2(1 + c.gain) * pxPerDoubling);
			return {
				c,
				x: g.x0 + j * w,
				w,
				y: g.y0 - h,
				h,
				isBest: bests.includes(c)
			};
		});
	};

	/** The grip: a draggable column's two short lines, just inside its head,
	 *  where the bar is long enough to hold them. */
	const GRIP_MIN = 16;

	// ── Dragging a column (upright) ─────────────────────────────────────────
	let dragIdx = $state<number | null>(null);
	/** The column the keyboard is on, ringed by hand: an outline on an SVG
	 *  element is unreliable in Safari. */
	let ringIdx = $state<number | null>(null);
	const slotAt = (x: number) => {
		const k = Math.floor((x - PADL) / slotW);
		return k >= 0 && k < n ? k : null;
	};
	function setTo(k: number, raw: number) {
		const d = rows[k].drag;
		if (!d) return;
		const v = Math.min(d.max, Math.max(d.min, Math.round(raw / d.step) * d.step));
		sheet[d.key] = Number(v.toFixed(2));
	}
	function dragTo(k: number, y: number) {
		const d = rows[k].drag;
		if (!d) return;
		const f = Math.max(0, (plotBottom - y) / (plotBottom - valTop));
		// The axis grows to make room (never shrinks) while the dragged bar's
		// top stays under the pointer. P is how far over that top the axis's
		// ceiling must sit: the tallest bar after it (a cap included), plus
		// the padding. While it fits under the frozen ceiling the top is a
		// plain read of the axis; past it the ceiling is top + P, so the top
		// solves top = lo + f·(top + P − lo), that is lo + f·P / (1 − f).
		const fr = frozen ?? fitDomain;
		let peak = 1;
		for (let j = k; j < n; j++) {
			const cap = Math.max(0, ...capsOf(rows[j].id).map((c) => c.gain));
			peak = Math.max(peak, (bars[j].to * (1 + cap)) / bars[k].to);
		}
		const P = Math.log2(peak) + PADLOG;
		let L = fr.lo + f * (fr.hi - fr.lo);
		if (L + P > fr.hi) L = f < 0.999 ? fr.lo + (f * P) / (1 - f) : Infinity;
		const top = 2 ** L;
		setTo(k, solveStat(sheet, d.key, top / bars[k].from, d.factor, d.min, d.max));
	}
	function onDown(e: PointerEvent) {
		if (e.button !== 0) return;
		const svg = e.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const k = slotAt(e.clientX - rect.left);
		if (k === null) return;
		readIdx = k;
		if (!rows[k].drag) return;
		dragIdx = k;
		frozen = { ...fitDomain };
		svg.setPointerCapture(e.pointerId);
		dragTo(k, e.clientY - rect.top);
	}
	function onMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		if (dragIdx !== null) {
			dragTo(dragIdx, e.clientY - rect.top);
			return;
		}
		if (e.pointerType === 'mouse') readIdx = slotAt(e.clientX - rect.left);
	}
	function onUp() {
		dragIdx = null;
		frozen = null;
	}
	function onKey(e: KeyboardEvent, k: number) {
		const d = rows[k].drag;
		if (!d) return;
		const v = sheet[d.key];
		const big = d.step * 10;
		const next =
			e.key === 'ArrowUp' || e.key === 'ArrowRight'
				? v + d.step
				: e.key === 'ArrowDown' || e.key === 'ArrowLeft'
					? v - d.step
					: e.key === 'PageUp'
						? v + big
						: e.key === 'PageDown'
							? v - big
							: e.key === 'Home'
								? d.min
								: e.key === 'End'
									? d.max
									: null;
		if (next === null) return;
		e.preventDefault();
		setTo(k, next);
	}

	// ── The setup bar ───────────────────────────────────────────────────────
	type SliderDef = {
		key: keyof SheetInputs;
		label: string;
		aria: string;
		min: number;
		max: number;
		step: number;
		unit: string;
	};
	const S = $derived<Record<string, SliderDef>>({
		statPct: {
			key: 'statPct',
			label: `${stat}%`,
			aria: `${stat} percent bonus`,
			min: 0,
			max: 300,
			step: 0.5,
			unit: '%'
		},
		dmgPct: {
			key: 'dmgPct',
			label: 'DMG Bonus',
			aria: 'DMG Bonus percent',
			min: 0,
			max: 200,
			step: 0.1,
			unit: '%'
		},
		cr: {
			key: 'cr',
			label: 'CRIT Rate',
			aria: 'CRIT Rate percent',
			min: 0,
			max: 100,
			step: 1,
			unit: '%'
		},
		cd: {
			key: 'cd',
			label: 'CRIT DMG',
			aria: 'CRIT DMG percent',
			min: 0,
			max: 300,
			step: 1,
			unit: '%'
		},
		em: {
			key: 'em',
			label: 'Elemental Mastery',
			aria: 'Elemental Mastery',
			min: 0,
			max: 1200,
			step: 5,
			unit: ''
		},
		rbPct: {
			key: 'rbPct',
			label: 'Reaction Bonus',
			aria: 'Reaction Bonus percent',
			min: 0,
			max: RB_MAX,
			step: 5,
			unit: '%'
		},
		baseDmgPct: {
			key: 'baseDmgPct',
			label: 'Base DMG Bonus',
			aria: 'Base DMG Bonus percent',
			min: 0,
			max: BASE_DMG_MAX,
			step: 1,
			unit: '%'
		},
		elevationPct: {
			key: 'elevationPct',
			label: 'Elevation',
			aria: 'Elevation percent',
			min: 0,
			max: ELEVATION_MAX,
			step: 1,
			unit: '%'
		},
		enemyLevel: {
			key: 'enemyLevel',
			label: 'Enemy level',
			aria: 'Enemy level',
			min: 1,
			max: 110,
			step: 1,
			unit: ''
		},
		enemyRes: {
			key: 'enemyRes',
			label: 'Enemy RES after shred',
			aria: 'Enemy RES after shred, percent',
			min: -50,
			max: 100,
			step: 5,
			unit: '%'
		},
		defShredPct: {
			key: 'defShredPct',
			label: 'DEF shred',
			aria: 'DEF shred percent',
			min: 0,
			max: 100,
			step: 1,
			unit: '%'
		},
		defIgnorePct: {
			key: 'defIgnorePct',
			label: 'DEF ignore',
			aria: 'DEF ignore percent',
			min: 0,
			max: 100,
			step: 1,
			unit: '%'
		}
	});
	/** The stats that feed the family's formula. ⛔ A slider that changes
	 *  nothing on screen is noise, so the rest hide. */
	const statSliders = $derived(
		(family === 'direct'
			? ['statPct', 'dmgPct', 'cr', 'cd', ...(amp ? ['em', 'rbPct'] : [])]
			: family === 'additive'
				? ['em', 'rbPct', 'cr', 'cd', 'dmgPct']
				: family === 'lunar'
					? ['em', 'rbPct', 'cr', 'cd', 'baseDmgPct', 'elevationPct']
					: ['em', 'rbPct']
		).map((k) => S[k])
	);
	const enemySliders = $derived(
		(usesDef ? ['enemyLevel', 'enemyRes', 'defShredPct', 'defIgnorePct'] : ['enemyRes']).map(
			(k) => S[k]
		)
	);

	/** The Stats segment's face: the sheet at a glance (design §6: an input
	 *  is a segment at a glance), the artifact card's short names. */
	const statsFace = $derived.by(() => {
		const crit = `CR ${pctS(sheet.cr)} · CD ${pctS(sheet.cd)}`;
		const em = `EM ${fmtInt(sheet.em)}`;
		if (family === 'direct')
			return `${stat} ${fmtInt(scalingTotal(sheet))} · DMG ${pctS(sheet.dmgPct)} · ${crit}${amp ? ` · ${em}` : ''}`;
		if (family === 'additive') return `${em} · ${crit} · DMG ${pctS(sheet.dmgPct)}`;
		if (family === 'lunar') return `${em} · ${crit}`;
		return em;
	});
	const defRemoved = $derived(
		Math.round(100 * (1 - (1 - sheet.defShredPct / 100) * (1 - sheet.defIgnorePct / 100)))
	);
	const enemyFace = $derived(
		usesDef
			? `Lv ${sheet.enemyLevel} · RES ${sheet.enemyRes}%${defMods ? ` · DEF −${defRemoved}%` : ''}`
			: `RES ${sheet.enemyRes}%`
	);
	const reactionFace = (r: (typeof REACTIONS)[FamilyId][number]) =>
		r.id === 'none' ? 'None' : `${r.name} ×${r.shown}`;

	function commitNumber(raw: string, apply: (v: number) => void, max = 100000) {
		const v = Number(raw);
		if (!Number.isFinite(v) || raw.trim() === '') return;
		apply(Math.min(max, Math.max(0, v)));
	}

	// ── Workspace handle (share + reset) ─────────────────────────────────────
	export function reset() {
		pickFamily('direct');
		reactionId = 'none';
		scaling = 'atk';
		sheet = { ...DEFAULT_SHEET };
	}

	export function getShareState() {
		return { v: 2, family, reaction: reactionId, scaling, sheet: { ...sheet } };
	}

	const FAMILY_IDS: FamilyId[] = ['direct', 'additive', 'transformative', 'lunar'];

	/** v1 links predate Lunar & Stellar, the Reaction Bonus and the scaling
	 *  stat; their missing fields take the defaults. */
	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1 && s.v !== 2) return;
		if (FAMILY_IDS.includes(s.family as FamilyId)) family = s.family as FamilyId;
		if (typeof s.reaction === 'string' && REACTIONS[family].some((r) => r.id === s.reaction))
			reactionId = s.reaction;
		else reactionId = REACTIONS[family][0].id;
		if (s.scaling === 'atk' || s.scaling === 'hp' || s.scaling === 'def') scaling = s.scaling;
		if (typeof s.sheet === 'object' && s.sheet !== null) {
			const raw = s.sheet as Record<string, unknown>;
			const next = { ...DEFAULT_SHEET };
			for (const key of Object.keys(DEFAULT_SHEET) as (keyof SheetInputs)[]) {
				const v = raw[key];
				if (typeof v === 'number' && Number.isFinite(v))
					next[key] = Math.min(100000, Math.max(0, v));
			}
			next.charLevel = snapLevel(next.charLevel);
			next.enemyLevel = Math.min(110, Math.max(1, Math.round(next.enemyLevel)));
			// RES may be negative, so it is read past the ≥ 0 clamp above
			const res = raw.enemyRes;
			next.enemyRes =
				typeof res === 'number' && Number.isFinite(res)
					? Math.min(100, Math.max(-50, res))
					: DEFAULT_SHEET.enemyRes;
			next.rbPct = Math.min(RB_MAX, next.rbPct);
			next.baseDmgPct = Math.min(BASE_DMG_MAX, next.baseDmgPct);
			next.elevationPct = Math.min(ELEVATION_MAX, next.elevationPct);
			next.defShredPct = Math.min(100, next.defShredPct);
			next.defIgnorePct = Math.min(100, next.defIgnorePct);
			sheet = next;
		}
		readIdx = null;
	}
</script>

<!-- One slider for every SliderDef. A percent stat types to one decimal, as
     the game's own sheet shows it (CRIT Rate 55.5%); the track keeps its
     coarser step. -->
{#snippet slider(d: SliderDef)}
	<InstrumentSlider
		label={d.label}
		aria={d.aria}
		bind:value={sheet[d.key]}
		min={d.min}
		max={d.max}
		step={d.step}
		unit={d.unit}
		decimals={d.unit === '%' ? 1 : undefined}
	/>
{/snippet}

<!-- A column's value, at its foot (upright) or its row's end (rows). -->
{#snippet valueOf(r: Row)}
	<span class="bd-value"
		>{r.kind === 'mult' || family === 'direct' ? fmtX(r.value) : fmtInt(r.value)}</span
	>
	{#if r.kind === 'mult'}<span class="bd-change">{fmtChange(r.value)}</span>{/if}
{/snippet}

<!-- THE STAGE (design §6, §8). One box: the chart head (the best next roll),
     the chart's toolbar on its top edge (the families, then the setup bar),
     the chart, and the fine print. The old Readout table is on the chart:
     each roll is a cap on the column it lifts, the best one gold. Upright
     columns where the stage is wide, rows below. -->
<div class="stage-root">
	<div class="stage ctx-dark" bind:clientWidth={stageW}>
		<p class="readout-head stage-head">
			{fmtGain(best?.gain ?? 0)}<span class="readout-sentence"
				>{headNoun} from one more {bestNames || 'substat'} roll</span
			>
		</p>

		<div class="stage-toolbar">
			<div class="segment stage-tabs" role="radiogroup" aria-label="Damage family">
				{#each FAMILIES as f (f.id)}
					<button
						class="btn"
						class:is-active={family === f.id}
						role="radio"
						aria-checked={family === f.id}
						onclick={() => pickFamily(f.id)}
					>
						{f.label}
					</button>
				{/each}
			</div>

			<div class="setup-bar" role="group" aria-label="Setup">
				<BandMenu role="dialog" align="start" ariaLabel="Reaction: {reactionFace(reaction)}">
					{#snippet face()}
						<span class="setup-key">Reaction</span>
						<span class="setup-val">{reactionFace(reaction)}</span>
					{/snippet}
					{#snippet items()}
						<div class="setup-pop">
							<div class="bd-picks" role="radiogroup" aria-label="Reaction">
								{#each REACTIONS[family] as r (r.id)}
									<button
										class="bd-pick"
										class:is-on={r.id === reaction.id}
										role="radio"
										aria-checked={r.id === reaction.id}
										onclick={() => (reactionId = r.id)}
									>
										<span class="bd-dot" style:background={RX_COLOR[r.id] ?? 'var(--chart-ink)'}
										></span>
										<span class="bd-pick-name">{r.name}</span>
										{#if r.id !== 'none'}<span class="bd-pick-mult">×{r.shown}</span>{/if}
									</button>
								{/each}
							</div>
						</div>
					{/snippet}
				</BandMenu>

				<BandMenu role="dialog" align="start" ariaLabel="Stats: {statsFace}">
					{#snippet face()}
						<span class="setup-key">Stats</span>
						<span class="setup-val bd-glance">{statsFace}</span>
					{/snippet}
					{#snippet items()}
						<div class="setup-pop bd-stats-pop">
							{#if family === 'direct'}
								<div class="bd-sheet-row">
									<div class="segment" role="radiogroup" aria-label="Scaling stat">
										{#each ['atk', 'hp', 'def'] as const as s (s)}
											<button
												class="btn"
												class:is-active={scaling === s}
												role="radio"
												aria-checked={scaling === s}
												onclick={() => (scaling = s)}
											>
												{statName(s)}
											</button>
										{/each}
									</div>
									<label class="bd-field">
										<span class="bd-field-label">Base {stat}</span>
										<input
											class="bd-input"
											type="number"
											value={sheet.base}
											oninput={(e) =>
												commitNumber(e.currentTarget.value, (v) => (sheet.base = v), 50000)}
										/>
									</label>
									<label class="bd-field">
										<span class="bd-field-label">Flat {stat}</span>
										<input
											class="bd-input"
											type="number"
											value={Math.round(sheet.statFlat)}
											oninput={(e) =>
												commitNumber(e.currentTarget.value, (v) => (sheet.statFlat = v), 50000)}
										/>
									</label>
								</div>
							{/if}
							<div class="bd-sliders">
								{#each statSliders as d (d.key)}
									{@render slider(d)}
								{/each}
							</div>
						</div>
					{/snippet}
				</BandMenu>

				<BandMenu role="dialog" align="start" ariaLabel="Your level: {sheet.charLevel}">
					{#snippet face()}
						<span class="setup-key">Your level</span>
						<span class="setup-val setup-val--num">{sheet.charLevel}</span>
					{/snippet}
					{#snippet items()}
						<div class="setup-pop">
							<!-- Above 90 only 95 and 100 exist; the slider jumps the gaps. -->
							<InstrumentSlider
								label="Level"
								aria="Character level"
								bind:value={sheet.charLevel}
								{...LEVEL_SLIDER}
							/>
						</div>
					{/snippet}
				</BandMenu>

				<BandMenu role="dialog" align="start" ariaLabel="Enemy: {enemyFace}">
					{#snippet face()}
						<span class="setup-key">Enemy</span>
						<span class="setup-val bd-glance">{enemyFace}</span>
					{/snippet}
					{#snippet items()}
						<div class="setup-pop">
							{#each enemySliders as d (d.key)}
								{@render slider(d)}
							{/each}
						</div>
					{/snippet}
				</BandMenu>
			</div>
		</div>

		{#if upright}
			<!-- UPRIGHT (design §8): a column per bracket, up is more damage.
			     Drag a column with a grip to change its stat. -->
			<div
				class="stage-graph bd-graph"
				style:--graph-min="{PLOT_MIN + TOP + 6 + footH}px"
				bind:clientWidth={graphW}
				bind:clientHeight={graphH}
			>
				<svg
					width={graphW}
					height={svgH}
					role="group"
					aria-label="The hit's damage formula, one column per bracket"
					onpointerdown={onDown}
					onpointermove={onMove}
					onpointerup={onUp}
					onpointercancel={onUp}
					onpointerleave={() => {
						if (dragIdx === null) readIdx = null;
					}}
				>
					<defs>
						{#each rows as r, k (r.id)}
							{@const g = barGeom(k)}
							<clipPath id="{uid}-bar-{r.id}">
								<rect x={g.x0} y={g.y0} width={barW} height={Math.max(0, g.y1 - g.y0)} />
							</clipPath>
							{#if isSum(r)}
								<!-- from the head (the top, or the bottom for a cut) to the tail -->
								<linearGradient
									id="{uid}-fade-{r.id}"
									x1="0"
									x2="0"
									y1={g.loss ? 1 : 0}
									y2={g.loss ? 0 : 1}
								>
									<stop offset="0" style:stop-color="var(--bright-ink)" stop-opacity={CHEV_HEAD} />
									<stop offset="1" style:stop-color="var(--bright-ink)" stop-opacity="0" />
								</linearGradient>
							{/if}
						{/each}
					</defs>

					<!-- The column being read -->
					{#if readIdx !== null && readIdx < n}
						<rect
							x={PADL + readIdx * slotW + 2}
							y={plotTop}
							width={Math.max(0, slotW - 4)}
							height={svgH - plotTop}
							rx="4"
							fill="var(--text)"
							fill-opacity="0.06"
						/>
					{/if}

					<!-- Doubling gridlines -->
					{#each ticks as t (t)}
						<line x1={PADL} y1={yOf(t)} x2={graphW - PADR} y2={yOf(t)} stroke="var(--chart-grid)" />
						<text
							x={PADL - 7}
							y={yOf(t) + 3.5}
							fill="var(--chart-ink)"
							font-size="10"
							text-anchor="end">{fmtTick(t)}</text
						>
					{/each}
					<text x={PADL} y={TOP - 6} fill="var(--chart-dim)" font-size="10" text-anchor="start"
						>{family === 'direct' ? `times a hit from base ${stat} alone` : 'damage'}</text
					>

					<!-- A sum's column starts past a rule -->
					{#each rows as r, k (r.id)}
						{#if r.kind === 'subtotal' || r.kind === 'total'}
							<line
								x1={PADL + k * slotW}
								y1={plotTop}
								x2={PADL + k * slotW}
								y2={svgH}
								stroke="var(--chart-rule)"
							/>
						{/if}
					{/each}

					<!-- The bars, their stripes, and the start's tick -->
					{#each rows as r, k (r.id)}
						{@const g = barGeom(k)}
						{#if r.kind === 'start'}
							<rect x={g.x0} y={g.head - 1} width={barW} height="2" fill="var(--text)" />
						{:else}
							<rect
								x={g.x0}
								y={g.y0}
								width={barW}
								height={Math.max(1, g.y1 - g.y0)}
								style:fill={barFill(r)}
							/>
							{#if isSum(r)}
								<rect
									x={g.x0}
									y={g.y0}
									width={barW}
									height={Math.max(1, g.y1 - g.y0)}
									fill="url(#{uid}-fade-{r.id})"
								/>
							{:else}
								<g clip-path="url(#{uid}-bar-{r.id})">
									{#each chevrons(k) as c, i (i)}
										<polygon
											points={c.points}
											fill={isGlass(r) ? '#fff' : 'var(--bright-ink)'}
											fill-opacity={c.alpha * (isGlass(r) ? 0.6 : 1)}
										/>
									{/each}
								</g>
							{/if}
						{/if}
					{/each}

					<!-- The leading line (⚓ Nate): one 1px stroke at each bar's head,
					     across the gap to the next bar's tail, so it caps both. -->
					{#each rows as r, k (r.id)}
						{#if k < n - 1}
							{@const g = barGeom(k)}
							{@const next = barGeom(k + 1)}
							<line
								x1={g.x0}
								y1={g.head}
								x2={next.x1}
								y2={g.head}
								stroke="rgb(255 255 255 / 0.3)"
								stroke-width="1"
								shape-rendering="crispEdges"
							/>
						{/if}
					{/each}

					<!-- The grips: a draggable column's two short lines, just inside its
					     head, or just over it where the bar is too short to hold them -->
					{#each rows as r, k (r.id)}
						{#if r.drag}
							{@const g = barGeom(k)}
							{@const xc = (g.x0 + g.x1) / 2}
							{@const y = g.y1 - g.y0 >= GRIP_MIN ? g.y0 + 5 : g.y0 - 9}
							<g stroke="var(--text)" stroke-opacity="0.7" stroke-width="1.5">
								<line x1={xc - 7} y1={y} x2={xc + 7} y2={y} />
								<line x1={xc - 7} y1={y + 4} x2={xc + 7} y2={y + 4} />
							</g>
						{/if}
					{/each}

					<!-- The caps: one more roll of each substat, on the column it lifts -->
					{#each rows as r, k (r.id)}
						{#each capGeom(k) as c (c.c.stat.key)}
							<rect
								x={c.x + 1}
								y={c.y}
								width={Math.max(0, c.w - 2)}
								height={c.h}
								fill={c.isBest ? 'var(--accent)' : 'var(--text)'}
								fill-opacity={c.isBest ? 0.55 : 0.22}
								stroke={c.isBest ? 'var(--accent)' : 'var(--chart-ink)'}
								stroke-width="1"
								stroke-dasharray={c.isBest ? null : '2 2'}><title>{rollSentence(c.c)}</title></rect
							>
							<text
								class="stage-word"
								x={c.x + c.w / 2}
								y={c.y - 15}
								fill="var(--chart-ink)"
								font-size="10"
								text-anchor="middle">{c.c.stat.short}<title>{rollSentence(c.c)}</title></text
							>
							<text
								class="stage-word bd-cap-gain"
								class:is-best={c.isBest}
								x={c.x + c.w / 2}
								y={c.y - 4}
								fill={c.isBest ? 'var(--accent)' : 'var(--text)'}
								font-size="11"
								text-anchor="middle">{fmtGain(c.c.gain)}<title>{rollSentence(c.c)}</title></text
							>
						{/each}
					{/each}

					<!-- A draggable column is a slider: its whole slot takes the press,
					     and the keyboard steps it. -->
					{#each rows as r, k (r.id)}
						{#if r.drag}
							<rect
								class="bd-hit"
								x={PADL + k * slotW}
								y={plotTop}
								width={slotW}
								height={plotBottom - plotTop}
								fill="transparent"
								role="slider"
								tabindex="0"
								aria-label="{r.name}: {r.drag.label}"
								aria-valuemin={r.drag.min}
								aria-valuemax={r.drag.max}
								aria-valuenow={sheet[r.drag.key]}
								aria-valuetext="{sheet[r.drag.key]}{r.drag.unit}"
								onfocus={(e) => {
									readIdx = k;
									if (e.currentTarget.matches(':focus-visible')) ringIdx = k;
								}}
								onblur={() => (ringIdx = null)}
								onkeydown={(e) => onKey(e, k)}
							/>
						{/if}
					{/each}
					{#if ringIdx !== null && ringIdx < n}
						<rect
							x={PADL + ringIdx * slotW + 1}
							y={plotTop + 1}
							width={Math.max(0, slotW - 2)}
							height={plotBottom - plotTop - 2}
							rx="4"
							fill="none"
							stroke="var(--accent)"
							stroke-width="2"
							pointer-events="none"
						/>
					{/if}
				</svg>

				<!-- Each column's foot: its name, the sheet's numbers, its value -->
				<div
					class="bd-foot"
					style:grid-template-columns="repeat({n}, minmax(0, 1fr))"
					style:padding-inline="{PADL}px {PADR}px"
					bind:clientHeight={footH}
				>
					{#each rows as r, k (r.id)}
						<button
							type="button"
							class="bd-foot-cell"
							class:is-read={readIdx === k}
							class:is-sum={r.kind === 'subtotal' || r.kind === 'total'}
							class:is-total={r.kind === 'total'}
							style:--c={r.color ?? 'var(--text)'}
							onpointerenter={(e) => {
								if (e.pointerType === 'mouse') readIdx = k;
							}}
							onpointerleave={(e) => {
								if (e.pointerType === 'mouse') readIdx = null;
							}}
							onfocus={() => (readIdx = k)}
							onclick={() => (readIdx = readIdx === k ? null : k)}
						>
							<span class="bd-name">{r.name}</span>
							{#if r.real || r.kind !== 'mult'}<span class="bd-real"
									>{r.real || (r.kind === 'start' ? '' : r.formula)}</span
								>{/if}
							<span class="bd-foot-value">{@render valueOf(r)}</span>
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<!-- ROWS, below the upright width (design §8): the old waterfall's
			     rows, one per bracket, each bar from where the last one ended. -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="bd-wf" onpointerleave={() => (readIdx = null)}>
				<div class="bd-wf-axis" aria-hidden="true">
					<span class="bd-wf-track">
						{#each ticks as t (t)}
							<span class="bd-wf-tick" style:left="{xPct(t)}%">{fmtTick(t)}</span>
						{/each}
					</span>
				</div>
				<!-- ONE layer of gridlines behind every row, so each line runs unbroken -->
				<span
					class="bd-wf-gridlayer"
					style:grid-row="2 / span {n}"
					bind:clientWidth={trackW}
					aria-hidden="true"
				>
					{#each ticks as t (t)}
						<span class="bd-wf-grid" style:left="{xPct(t)}%"></span>
					{/each}
				</span>
				{#each rows as r, i (r.id)}
					{@const b = bars[i]}
					{@const lo = xPct(Math.min(b.from, b.to))}
					{@const hi = xPct(Math.max(b.from, b.to))}
					{@const caps = capsOf(r.id)}
					{@const nChev = chevronsFor(((hi - lo) / 100) * trackW)}
					<button
						type="button"
						class="bd-wf-row"
						class:is-sum={r.kind === 'subtotal' || r.kind === 'total'}
						class:is-total={r.kind === 'total'}
						class:is-read={readIdx === i}
						class:is-glass={isGlass(r)}
						style:grid-row={i + 2}
						style:--c={r.color ?? 'var(--text)'}
						onpointerenter={(e) => {
							if (e.pointerType === 'mouse') readIdx = i;
						}}
						onfocus={() => (readIdx = i)}
						onclick={() => (readIdx = readIdx === i ? null : i)}
					>
						<span class="bd-wf-op" aria-hidden="true"
							>{r.kind === 'mult' ? '×' : r.kind === 'start' ? '' : '='}</span
						>
						<span class="bd-wf-label">
							<span class="bd-name">{r.name}</span>
							{#if r.real}<span class="bd-real">{r.real}</span>{/if}
						</span>
						<span class="bd-wf-track">
							{#if i < n - 1}
								<span
									class="bd-wf-lead bd-wf-lead--down"
									style:left="{xPct(r.kind === 'start' ? b.from : b.to)}%"
								></span>
							{/if}
							{#if i > 0}
								<span
									class="bd-wf-lead bd-wf-lead--up"
									style:left="{xPct(r.kind === 'mult' ? b.from : b.to)}%"
								></span>
							{/if}
							{#if r.kind === 'start'}
								<span class="bd-wf-start" style:left="{lo}%"></span>
							{:else}
								<span
									class="bd-wf-bar"
									class:is-loss={b.to < b.from}
									style:left="{lo}%"
									style:width="{Math.max(hi - lo, 0.4)}%"
									style:background={barFill(r)}
								>
									{#if isSum(r)}
										<span class="bd-wf-fade"></span>
									{:else}
										<!-- k = 0 is the HEAD; each step back toward the tail fades.
										     k = −1 sits past the head, so the pattern runs through it. -->
										{#each { length: nChev + 1 }, j (j)}
											<span
												class="bd-wf-chev"
												style:--k={j - 1}
												style:--a={chevAlpha(Math.max(0, j - 1), nChev)}
											></span>
										{/each}
									{/if}
								</span>
							{/if}
							{#each caps as c, j (c.stat.key)}
								<span
									class="bd-wf-cap"
									class:is-best={bests.includes(c)}
									style:left="{xPct(b.to)}%"
									style:width="max(2px, {xPct(b.to * (1 + c.gain)) - xPct(b.to)}%)"
									style:--j={j}
									style:--m={caps.length}
									title={rollSentence(c)}
								></span>
							{/each}
						</span>
						<span class="bd-wf-value">
							<span class="bd-wf-num">{@render valueOf(r)}</span>
							{#each caps as c (c.stat.key)}
								<span class="bd-wf-roll" class:is-best={bests.includes(c)}
									>{c.stat.short} {fmtGain(c.gain)}</span
								>
							{/each}
						</span>
					</button>
				{/each}
			</div>
		{/if}

		<!-- The fine print: the caption, or the column being read with its
		     formula. All share one cell, so the height is the longest's and
		     reading a column never moves the stage. -->
		<div class="stage-fine bd-reading" aria-live="polite">
			<p class:is-read={readIdx === null}>
				{CAPTIONS[family]}
				<span class="bd-hint"
					>The marks at the end of a bar are one more average 5★ roll of that substat, added to your
					sheet. {upright
						? 'Hover or tap a column to read it, and drag one with a grip to change its stat.'
						: 'Hover or tap a row to read it.'}</span
				>
			</p>
			{#each rows as r, i (r.id)}
				<p class:is-read={readIdx === i}>
					{readingOf(r)}
					{#if r.formula}<span class="bd-formula">{r.formula}</span>{/if}
				</p>
			{/each}
		</div>
	</div>
</div>

<style>
	/* ── The setup bar's popovers ── */
	.bd-glance {
		font-variant-numeric: tabular-nums;
	}

	.bd-picks {
		display: grid;
		gap: 0.15rem;
	}

	.bd-pick {
		display: grid;
		grid-template-columns: auto 1fr auto;
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
		.bd-pick:hover {
			background: color-mix(in srgb, var(--text) 7%, transparent);
		}
	}

	.bd-pick.is-on {
		background: color-mix(in srgb, var(--text) 12%, transparent);
	}

	.bd-pick:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.bd-dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}

	.bd-pick-name {
		font-weight: var(--fw-semibold);
	}

	.bd-pick-mult {
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}

	/* The sheet: wider than a setting's 22rem, so its sliders sit two to a
	   line where the popover has the room. */
	.setup-pop.bd-stats-pop {
		width: min(36rem, calc(100vw - 2rem));
	}

	.bd-sheet-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--inst-gap-control) 1.5rem;
	}

	.bd-field {
		display: flex;
		align-items: center;
		gap: var(--inst-gap-in);
	}

	/* The label voice (app.css § .slider-label), so these read as the
	   sliders' labels do */
	.bd-field-label {
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	/* Dressed as the slider's typeable field (InstrumentSlider's .is-field),
	   so every typed value in the popover looks one way. Five characters: the
	   most these take is 50,000. */
	.bd-input {
		box-sizing: content-box;
		width: 5ch;
		padding: 0.12rem 0.4rem;
		border: none;
		border-radius: var(--r-sm);
		background: var(--fill-rest);
		color: var(--text);
		/* Input field — a sanctioned Mono home */
		font-family: var(--font-mono);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		text-align: right;
		appearance: textfield;
		-moz-appearance: textfield;
		transition: box-shadow var(--t-snap);
	}

	@media (hover: hover) {
		.bd-input:hover {
			box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, var(--border));
		}
	}

	/* iOS zooms the page into a focused field under 16px. */
	@media (pointer: coarse) {
		.bd-input {
			font-size: var(--fs-xl);
		}
	}

	.bd-input::-webkit-outer-spin-button,
	.bd-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.bd-input:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 1px;
	}

	.bd-sliders {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: var(--inst-gap-control) 1.5rem;
		align-items: start;
	}

	/* ── Upright ── */
	.bd-graph {
		display: flex;
		flex-direction: column;
	}

	.bd-graph svg {
		flex: none;
	}

	/* A column's drag is vertical, so a touch on it drags rather than
	   scrolls (the stage's svg pans on y). The ring is drawn in the svg. */
	.bd-hit {
		cursor: ns-resize;
		outline: none;
		touch-action: none;
	}

	.bd-cap-gain {
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}

	.bd-cap-gain.is-best {
		font-weight: var(--fw-bold);
	}

	.bd-foot {
		display: grid;
		flex: none;
	}

	.bd-foot-cell {
		display: grid;
		justify-items: center;
		align-content: start;
		gap: 1px;
		min-width: 0;
		margin-inline: 2px;
		padding: 0.35rem 0.2rem 0.4rem;
		border: none;
		border-radius: 0 0 4px 4px;
		background: transparent;
		color: inherit;
		font: inherit;
		line-height: var(--lh-snug);
		text-align: center;
		cursor: default;
	}

	.bd-foot-cell.is-read {
		background: color-mix(in srgb, var(--text) 6%, transparent);
	}

	.bd-foot-cell:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.bd-foot-value {
		display: grid;
		justify-items: center;
		margin-top: 0.15rem;
	}

	/* ── Shared: a column's or a row's words ── */
	.bd-name {
		font-weight: var(--fw-semibold);
		font-size: var(--fs-md);
		color: color-mix(in srgb, var(--c) 70%, var(--text));
	}

	.is-sum .bd-name {
		color: var(--text);
	}

	/* Tabular, so a number that changes while you drag (999 → 1,000 ATK)
	   keeps its width */
	.bd-real {
		font-size: var(--fs-sm);
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.bd-value {
		font-weight: var(--fw-semibold);
		font-size: var(--fs-md);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.bd-change {
		font-size: var(--fs-xs);
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.is-total .bd-value {
		font-size: var(--fs-2xl);
		font-weight: var(--fw-bold);
	}

	/* ── Rows ──────────────────────────────────────────────────────────────
	   One grid; every row is a SUBGRID of it, so names, bars and values line
	   up across rows. Cells are placed by column NUMBER. */
	.bd-wf {
		display: grid;
		grid-template-columns: 1rem minmax(0, 1fr) minmax(5rem, 1.4fr) minmax(4rem, max-content);
		column-gap: 0.5rem;
		row-gap: 2px;
	}

	.bd-wf-axis,
	.bd-wf-row {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: subgrid;
		align-items: center;
	}

	.bd-wf-axis {
		grid-row: 1;
		height: 1.1rem;
	}

	.bd-wf-axis > .bd-wf-track,
	.bd-wf-row > .bd-wf-track {
		grid-column: 3;
	}

	/* Behind the rows (they come later in the source and paint over it).
	   ⚠ Every row is pinned to its grid line (style:grid-row): left to
	   auto-placement, a full-width row can't share a line with this layer's
	   column, so the rows were pushed BELOW it and it collapsed to ~10px. */
	.bd-wf-gridlayer {
		grid-column: 3;
		position: relative;
		pointer-events: none;
	}

	.bd-wf-row {
		padding: 0.2rem 0.45rem;
		border: none;
		border-radius: var(--r-sm);
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: default;
		transition: background-color var(--t-snap);
	}

	.bd-wf-row.is-read {
		background: color-mix(in srgb, var(--text) 6%, transparent);
	}

	.bd-wf-row:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.bd-wf-row.is-sum {
		border-top: 1px solid var(--chart-rule);
		border-radius: 0 0 var(--r-sm) var(--r-sm);
	}

	.bd-wf-op {
		grid-column: 1;
		justify-self: end;
		color: var(--chart-dim);
		font-size: var(--fs-lg);
	}

	.bd-wf-label {
		grid-column: 2;
		display: grid;
		line-height: var(--lh-snug);
		min-width: 0;
	}

	/* The bar column fills the row's full height, and the bar sits on its
	   middle, so the leading line knows where the bar stops and the row
	   ends. 🎛️ ↻ 2026-11-03 (⚓ Nate): one height for every bar again, so
	   the rows read as one series; it was a share of the row (55%), which
	   made a two-line row's bar taller than a one-line row's. */
	.bd-wf-track {
		--bar-h: 1.5rem;
		position: relative;
		align-self: stretch;
		min-height: 1.5rem;
	}

	/* The leading line (⚓ Nate). ONE 1px stroke per step: from the TOP of a
	   bar's leading end, down through the gap, to the BOTTOM of the next bar's
	   starting end, so it caps both bars and spans the gap between them. */
	.bd-wf-lead {
		position: absolute;
		z-index: 1;
		width: 1px;
		margin-left: -0.5px;
		background: rgb(255 255 255 / 0.3);
		pointer-events: none;
	}

	.bd-wf-lead--down {
		top: calc(50% - var(--bar-h) / 2);
		bottom: calc(-0.2rem - 2px);
	}

	.bd-wf-lead--up {
		top: -0.2rem;
		bottom: calc(50% - var(--bar-h) / 2);
	}

	.bd-wf-row.is-sum .bd-wf-lead--up {
		top: calc(-0.2rem - 1px);
	}

	.bd-wf-axis .bd-wf-track {
		height: 100%;
		min-height: 0;
	}

	.bd-wf-tick {
		position: absolute;
		bottom: 0;
		transform: translateX(-50%);
		font-size: var(--fs-xs);
		color: var(--chart-dim);
		white-space: nowrap;
	}

	.bd-wf-grid {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--chart-grid);
	}

	/* Solid bars with chevron stripes painted over them (⚓ Nate, 2026-10-01).
	   Each stripe: stroke = half the pitch, point depth --depth, so its box is
	   stroke + depth wide and the next one starts a pitch further back.
	   ⚠ Each stripe is its own element with its alpha in its PAINT: no tiled
	   background (real Safari has drawn 1px gaps in tiled bar backgrounds),
	   no element opacity (sub-pixel law). A cut mirrors them. */
	.bd-wf-bar {
		position: absolute;
		top: calc(50% - var(--bar-h) / 2);
		height: var(--bar-h);
		overflow: hidden;
		--arrow-c: var(--bright-ink);
	}

	/* A sum wears the stripes' fade alone (⚓ Nate 2026-11-03): its own
	   element over the fill, so the bar keeps one background layer (real
	   Safari has drawn 1px gaps in multi-layer bar backgrounds). 12% is
	   CHEV_HEAD; the head is the right end, the left for a cut. */
	.bd-wf-fade {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to left,
			color-mix(in srgb, var(--bright-ink) 12%, transparent),
			transparent
		);
	}

	.bd-wf-bar.is-loss .bd-wf-fade {
		background: linear-gradient(
			to right,
			color-mix(in srgb, var(--bright-ink) 12%, transparent),
			transparent
		);
	}

	.bd-wf-row.is-glass .bd-wf-bar {
		--arrow-c: rgb(255 255 255);
		--chev-scale: 0.6;
	}

	.bd-wf-chev {
		--pitch: 14px;
		--depth: 6px;
		position: absolute;
		top: 0;
		bottom: 0;
		right: calc(2px + var(--k) * var(--pitch));
		width: calc(var(--pitch) / 2 + var(--depth));
		background: color-mix(
			in srgb,
			var(--arrow-c) calc(var(--a) * var(--chev-scale, 1) * 100%),
			transparent
		);
		clip-path: polygon(
			0 0,
			calc(var(--pitch) / 2) 0,
			100% 50%,
			calc(var(--pitch) / 2) 100%,
			0 100%,
			var(--depth) 50%
		);
	}

	.bd-wf-bar.is-loss .bd-wf-chev {
		right: auto;
		left: calc(2px + var(--k) * var(--pitch));
		clip-path: polygon(
			100% 0,
			calc(100% - var(--pitch) / 2) 0,
			0 50%,
			calc(100% - var(--pitch) / 2) 100%,
			100% 100%,
			calc(100% - var(--depth)) 50%
		);
	}

	.bd-wf-start {
		position: absolute;
		top: calc(50% - var(--bar-h) / 2 - 0.15rem);
		height: calc(var(--bar-h) + 0.3rem);
		width: 2px;
		margin-left: -1px;
		background: var(--c);
	}

	/* A roll's cap at its bar's head: each a slice of the bar's height. */
	.bd-wf-cap {
		position: absolute;
		top: calc(50% - var(--bar-h) / 2 + var(--j) * var(--bar-h) / var(--m));
		height: calc(var(--bar-h) / var(--m));
		box-sizing: border-box;
		border: 1px dashed var(--chart-ink);
		background: color-mix(in srgb, var(--text) 22%, transparent);
	}

	.bd-wf-cap.is-best {
		border: 1px solid var(--accent);
		background: color-mix(in srgb, var(--accent) 55%, transparent);
	}

	.bd-wf-value {
		grid-column: 4;
		justify-self: end;
		display: grid;
		justify-items: end;
		min-width: 6ch;
		line-height: var(--lh-snug);
	}

	.bd-wf-num {
		display: flex;
		align-items: baseline;
		gap: 0.3rem;
	}

	.bd-wf-roll {
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		color: var(--chart-ink);
	}

	.bd-wf-roll.is-best {
		font-weight: var(--fw-semibold);
		color: var(--accent);
	}

	/* ── The fine print: the caption and every column's sentence, in one cell ── */
	.bd-reading {
		display: grid;
		max-width: 96ch;
	}

	.bd-reading > p {
		grid-area: 1 / 1;
		margin: 0;
		visibility: hidden;
	}

	.bd-reading > p.is-read {
		visibility: visible;
	}

	.bd-hint {
		color: var(--chart-dim);
	}

	.bd-formula {
		display: block;
		margin-top: 0.2rem;
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
		color: var(--chart-dim);
	}
</style>
