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
		critFactor,
		defFactor,
		directTotal,
		dmgFactor,
		elevationFactor,
		labStats,
		lunarTotal,
		marginalGain,
		resFactor,
		scalingFactor,
		scalingTotal,
		statName,
		transformativeTotal,
		type FamilyId,
		type ScalingStat,
		type SheetInputs
	} from './anatomy';
	import {
		levelMult,
		additiveEmBonus,
		transformativeEmBonus,
		specialEmBonus,
		snapLevel,
		stepLevel,
		MAX_LEVEL
	} from './reactionCurves';

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
		boxIdx = null;
		rollIdx = 0;
	}
	const reaction = $derived(
		REACTIONS[family].find((r) => r.id === reactionId) ?? REACTIONS[family][0]
	);
	const stat = $derived(statName(scaling));
	const rb = $derived(sheet.rbPct);

	// ── The waterfall ─────────────────────────────────────────────────────────
	// One row per bucket, in the formula's own order (⚓ fixed — a row never
	// moves while a slider is dragged). Every bar starts where the one above
	// ended, on one shared axis whose gridlines DOUBLE: a ×2 is the same length
	// wherever it sits, and a cut (×0.49) runs backward by exactly as far as a
	// ×2.04 runs forward. Labels live in their own columns, so a bar's length is
	// its multiplier and nothing else.
	//
	// Hues: the dataviz reference categorical eight, assigned so EVERY family's
	// adjacent rows pass the validator in dark mode on the dimmed night (16 of
	// the 40,320 assignments do). Two pairs share a slot by meaning and never
	// meet: the starting magnitude (scaling stat / level) and the bonus bracket
	// (DMG Bonus / Base DMG Bonus). Provisional until Nate's eye.
	const C = {
		start: '#d95926',
		bonus: '#199e70',
		em: '#c98500',
		reaction: '#3987e5',
		crit: '#9085e9',
		elevation: '#e66767',
		def: '#008300',
		res: '#d55181'
	};

	/** One row: a starting value, a multiplier, a subtotal, or the result. */
	type Row = {
		id: string;
		kind: 'start' | 'mult' | 'subtotal' | 'total';
		name: string;
		/** The bucket's formula, in words where words will do */
		formula: string;
		/** The sheet's numbers that go in */
		real: string;
		/** The multiplier (kind 'mult') or the value (the others) */
		value: number;
		color: string;
		/** The row in a sentence, for whoever hovers or taps it */
		read: string;
	};

	const fmtX = (v: number) => `×${v >= 10 ? v.toFixed(1) : v.toFixed(2)}`;
	const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const bonusWord = $derived(rb > 0 ? ' + Reaction Bonus' : '');
	const emReal = $derived(rb > 0 ? `${sheet.em} EM · +${rb}%` : `${sheet.em} EM`);

	/** Enemy RES has three formulas, and the row shows the one in force */
	const resFormula = $derived(
		sheet.enemyRes < 0 ? '1 − RES ÷ 2' : sheet.enemyRes < 75 ? '1 − RES' : '1 ÷ (1 + 4 × RES)'
	);

	const critRow = $derived<Row>({
		id: 'crit',
		kind: 'mult',
		name: 'Crit, on average',
		formula: '1 + CRIT Rate × CRIT DMG',
		real: `${sheet.cr}% · ${sheet.cd}%`,
		value: critFactor(sheet),
		color: C.crit,
		read: `With ${sheet.cr}% CRIT Rate and ${sheet.cd}% CRIT DMG, the hit would average ${fmtX(critFactor(sheet))} a non-crit.`
	});
	const dmgRow = $derived<Row>({
		id: 'dmg',
		kind: 'mult',
		name: 'DMG Bonus',
		formula: '1 + DMG Bonus',
		real: `${sheet.dmgPct.toFixed(1)}%`,
		value: dmgFactor(sheet),
		color: C.bonus,
		read: `A ${sheet.dmgPct.toFixed(1)}% DMG Bonus would make the hit ${fmtX(dmgFactor(sheet))} as strong.`
	});
	const defRow = $derived<Row>({
		id: 'def',
		kind: 'mult',
		name: 'Enemy DEF',
		formula: '(100 + your level) ÷ (both levels + 200)',
		real: `Lv ${sheet.charLevel} vs ${sheet.enemyLevel}`,
		value: defFactor(sheet),
		color: C.def,
		read: `At level ${sheet.charLevel} against a level ${sheet.enemyLevel} enemy, its DEF would let ${pct(defFactor(sheet))} of the hit through.`
	});
	const resRow = $derived<Row>({
		id: 'res',
		kind: 'mult',
		name: 'Enemy RES',
		formula: resFormula,
		real: `${sheet.enemyRes}%`,
		value: resFactor(sheet),
		color: C.res,
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
		color: C.start,
		read: `Every level ${sheet.charLevel} character starts a reaction from the same base: ${fmtInt(levelMult(sheet.charLevel))}.`
	});
	const reactionRow = $derived<Row>({
		id: 'reaction',
		kind: 'mult',
		name: reaction.name,
		formula:
			family === 'lunar' ? `${reaction.mult} × 60% top-contributor share` : `× ${reaction.mult}`,
		real: 'picked above',
		value: reaction.shown,
		color: C.reaction,
		read:
			family === 'lunar'
				? `${reaction.name} multiplies the base by ${reaction.mult}, and the top contributor deals 60% of it: ×${reaction.shown}.`
				: `${reaction.name} multiplies the base by ${reaction.mult}.`
	});
	const emRow = $derived.by<Row>(() => {
		const [value, formula] =
			family === 'additive'
				? [1 + additiveEmBonus(sheet.em) + rb / 100, `1 + 5 × EM ÷ (EM + 1200)${bonusWord}`]
				: family === 'lunar'
					? [1 + specialEmBonus(sheet.em) + rb / 100, `1 + 6 × EM ÷ (EM + 2000)${bonusWord}`]
					: [
							1 + transformativeEmBonus(sheet.em) + rb / 100,
							`1 + 16 × EM ÷ (EM + 2000)${bonusWord}`
						];
		return {
			id: 'em',
			kind: 'mult',
			name: rb > 0 ? 'EM + Reaction Bonus' : 'EM',
			formula,
			real: emReal,
			value,
			color: C.em,
			read:
				rb > 0
					? `EM and the +${rb}% Reaction Bonus together would raise it ${fmtX(value)}.`
					: `EM would raise it ${fmtX(value)}.`
		};
	});

	const aChunk = $derived(additiveChunk(sheet, reaction.mult));

	/** The rows each family draws, ending in its result */
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
					color: C.start,
					read: `Your ${fmtInt(scalingTotal(sheet))} ${stat} would make the hit ${fmtX(scalingFactor(sheet))} what base ${stat} alone deals.`
				},
				dmgRow,
				critRow
			];
			if (reaction.mult > 1) {
				const f = ampFactor(sheet, reaction.mult);
				out.push({
					id: 'amp',
					kind: 'mult',
					name: reaction.name,
					formula: `${reaction.mult} × (1 + 2.78 × EM ÷ (EM + 1400)${bonusWord})`,
					real: emReal,
					value: f,
					color: C.em,
					read: `A ${reaction.mult === 2 ? 'forward' : 'reverse'} ${reaction.name} would multiply the hit by ${fmtX(f)}.`
				});
			}
			out.push(defRow, resRow, {
				id: 'total',
				kind: 'total',
				name: 'Your hit',
				formula: `vs base ${stat} alone`,
				real: '',
				value: directTotal(sheet, reaction.mult),
				color: '',
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
					color: '',
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
					color: '',
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
					color: C.bonus,
					read: `A ${sheet.baseDmgPct}% Base DMG Bonus would raise it ${fmtX(baseDmgFactor(sheet))}.`
				},
				{
					id: 'elevation',
					kind: 'mult',
					name: 'Elevation',
					formula: '1 + Elevation, after every other bracket',
					real: `${sheet.elevationPct}%`,
					value: elevationFactor(sheet),
					color: C.elevation,
					read: `A ${sheet.elevationPct}% Elevation would raise it ${fmtX(elevationFactor(sheet))}.`
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
					color: '',
					read: `On average, one ${reaction.name} hit would deal ${fmtInt(lunarTotal(sheet, reaction.mult))} damage as the top contributor.`
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
				color: '',
				read: `One ${reaction.name} hit would deal ${fmtInt(transformativeTotal(sheet, reaction.mult))} damage.`
			}
		];
	});

	/** Each row's bar: where it starts and ends, as running values */
	const bars = $derived.by(() => {
		const origin = family === 'direct' ? 1 : levelMult(sheet.charLevel);
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

	// The axis: log₂, padded, gridlines on doublings — of ×1 for a direct hit,
	// of 1,000 for damage
	const unit = $derived(family === 'direct' ? 1 : 1000);
	const domain = $derived.by(() => {
		const vals = bars.flatMap((b) => [b.from, b.to]);
		return {
			lo: Math.log2(Math.min(...vals) / 1.12),
			hi: Math.log2(Math.max(...vals) * 1.12)
		};
	});
	const xPct = (v: number) => ((Math.log2(v) - domain.lo) / (domain.hi - domain.lo)) * 100;
	const ticks = $derived.by(() => {
		const out: number[] = [];
		for (let k = Math.ceil(domain.lo - Math.log2(unit)); k <= domain.hi - Math.log2(unit); k++)
			out.push(unit * 2 ** k);
		return out;
	});
	const fmtTick = (v: number) =>
		family === 'direct'
			? `×${v < 1 ? v.toFixed(2).replace(/0+$/, '') : v}`
			: v >= 1000
				? `${v / 1000}k`
				: `${v}`;

	/** A row's share of the total swing — how much of the boost it supplies,
	 *  or how much of it a cut takes back */
	const boostLog = $derived(
		rows.reduce((s, r) => (r.kind === 'mult' && r.value > 1 ? s + Math.log(r.value) : s), 0)
	);
	const shareOf = (r: Row) =>
		r.kind === 'mult' && boostLog > 0 ? Math.abs(Math.log(r.value)) / boostLog : 0;
	const readingOf = (r: Row) => {
		const share = shareOf(r);
		if (r.kind !== 'mult' || share < 0.005) return r.read;
		return r.value >= 1
			? `${r.read} It supplies ${Math.round(share * 100)}% of the boost.`
			: `${r.read} It takes back ${Math.round(share * 100)}% of the boost.`;
	};

	const CAPTIONS: Record<FamilyId, string> = $derived({
		direct: `Each row multiplies the hit, and each gridline doubles it, so a ×2 is the same length wherever it sits and a cut runs backward. The result compares against a hit from base ${stat} alone, because the talent multiplier depends on the attack.`,
		additive:
			'Spread and Aggravate add a flat chunk from level and EM alone. The chunk then rides the rest of the hit, so it crits and takes DMG Bonus like the hit does.',
		transformative:
			'Damage from level and EM alone, so the result is a number. For most characters, crit, ATK, and DMG% do nothing, and enemy DEF doesn’t apply.',
		lunar:
			'Damage from level and EM, with two brackets of its own: Base DMG Bonus and Elevation. It can crit, and enemy DEF doesn’t apply. These figures are the top contributor’s 60% share.'
	});

	/** The row being read, by index; null reads the caption */
	let boxIdx = $state<number | null>(null);

	// ── What the next roll buys ──────────────────────────────────────────────
	const lab = $derived(labStats(family, reaction.mult, scaling));
	const gains = $derived(
		lab.map((s) => ({ stat: s, gain: marginalGain(family, sheet, reaction.mult, s) }))
	);
	const gainMax = $derived(Math.max(...gains.map((g) => g.gain), 1e-9));
	let rollIdx = $state(0);
	const fmtStep = (s: { step: number; isPct: boolean }) =>
		s.isPct ? `+${s.step.toFixed(1)}%` : `+${s.step.toFixed(1)}`;
	const fmtGain = (g: number) => `+${(g * 100).toFixed(1)}%`;
	const rollReadings = $derived(
		gains.map(
			(g) =>
				`One more ${g.stat.label} roll (${fmtStep(g.stat)}) would raise the damage by ${(g.gain * 100).toFixed(1)}%.`
		)
	);

	// ── Build ────────────────────────────────────────────────────────────────
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
			label: 'Enemy RES',
			aria: 'Enemy RES percent',
			min: -50,
			max: 100,
			step: 5,
			unit: '%'
		}
	});
	/** The sliders that feed the family's formula, before and after Level —
	 *  ⛔ a slider that changes nothing on screen is noise, so the rest hide. */
	const sliders = $derived.by(() => {
		const amp = family === 'direct' && reaction.mult > 1;
		const before: (keyof typeof S)[] =
			family === 'direct'
				? ['statPct', 'dmgPct', 'cr', 'cd', ...(amp ? (['em', 'rbPct'] as const) : [])]
				: family === 'additive'
					? ['em', 'rbPct', 'cr', 'cd', 'dmgPct']
					: family === 'lunar'
						? ['em', 'rbPct', 'cr', 'cd', 'baseDmgPct', 'elevationPct']
						: ['em', 'rbPct'];
		const after: (keyof typeof S)[] =
			family === 'direct' || family === 'additive' ? ['enemyLevel', 'enemyRes'] : ['enemyRes'];
		return { before: before.map((k) => S[k]), after: after.map((k) => S[k]) };
	});
	const fmtSlider = (d: SliderDef) => {
		const v = sheet[d.key] as number;
		return `${d.step < 1 ? v.toFixed(1) : v}${d.unit}`;
	};

	function commitNumber(raw: string, apply: (v: number) => void, max = 100000) {
		const v = Number(raw);
		if (!Number.isFinite(v) || raw.trim() === '') return;
		apply(Math.min(max, Math.max(0, v)));
	}

	function onLevel(e: Event & { currentTarget: HTMLInputElement }) {
		const el = e.currentTarget;
		sheet.charLevel = snapLevel(Number(el.value));
		el.value = String(sheet.charLevel);
	}
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
		sheet.charLevel = stepLevel(sheet.charLevel, dir);
		e.currentTarget.value = String(sheet.charLevel);
	}
	const LEVEL_MARKS = [90, 95, 100];
	const markPos = (lv: number) => (lv - 1) / (MAX_LEVEL - 1);

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
			sheet = next;
		}
		boxIdx = null;
		rollIdx = 0;
	}
</script>

<div class="instrument">
	<div class="segment an-tabs" role="radiogroup" aria-label="Damage family">
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

	<div class="an-chart ctx-dark">
		<div class="chips an-reactions">
			{#each REACTIONS[family] as r (r.id)}
				<button
					class="chip chip--control"
					class:active={reactionId === r.id}
					onclick={() => (reactionId = r.id)}
				>
					{r.id === 'none' ? r.name : `${r.name} ×${r.shown}`}
				</button>
			{/each}
		</div>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="an-wf" onpointerleave={() => (boxIdx = null)}>
			<!-- The axis: gridlines double; labels sit over the bar column -->
			<div class="an-wf-axis" aria-hidden="true">
				<span class="an-wf-track">
					{#each ticks as t (t)}
						<span class="an-wf-tick" style:left="{xPct(t)}%">{fmtTick(t)}</span>
					{/each}
				</span>
			</div>
			{#each rows as r, i (r.id)}
				{@const b = bars[i]}
				{@const lo = xPct(Math.min(b.from, b.to))}
				{@const hi = xPct(Math.max(b.from, b.to))}
				<button
					type="button"
					class="an-wf-row"
					class:is-sum={r.kind === 'subtotal' || r.kind === 'total'}
					class:is-total={r.kind === 'total'}
					class:is-read={boxIdx === i}
					style:--c={r.color || 'var(--chart-ink)'}
					onpointerenter={() => (boxIdx = i)}
					onfocus={() => (boxIdx = i)}
					onclick={() => (boxIdx = boxIdx === i ? null : i)}
				>
					<span class="an-wf-op" aria-hidden="true"
						>{r.kind === 'mult' ? '×' : r.kind === 'start' ? '' : '='}</span
					>
					<span class="an-wf-label">
						<span class="an-wf-name">{r.name}</span>
						{#if r.real}<span class="an-wf-real">{r.real}</span>{/if}
						{#if r.formula}<span class="an-wf-formula-inline">{r.formula}</span>{/if}
					</span>
					<span class="an-wf-formula">{r.formula}</span>
					<span class="an-wf-track">
						{#each ticks as t (t)}
							<span class="an-wf-grid" style:left="{xPct(t)}%"></span>
						{/each}
						{#if r.kind === 'start'}
							<span class="an-wf-start" style:left="{lo}%"></span>
						{:else}
							<span
								class="an-wf-bar"
								class:is-loss={b.to < b.from}
								style:left="{lo}%"
								style:width="{Math.max(hi - lo, 0.4)}%"
							></span>
						{/if}
					</span>
					<span class="an-wf-value"
						>{r.kind === 'mult' || family === 'direct' ? fmtX(r.value) : fmtInt(r.value)}</span
					>
				</button>
			{/each}
		</div>

		<!-- The caption and every row's sentence share one cell, so the height
		     is the longest's and reading a row never moves the panels below -->
		<div class="an-reading" aria-live="polite">
			<p class:is-read={boxIdx === null}>
				{CAPTIONS[family]} <span class="an-hint">Hover or tap a row to read it.</span>
			</p>
			{#each rows as r, i (r.id)}
				<p class:is-read={boxIdx === i}>{readingOf(r)}</p>
			{/each}
		</div>
	</div>

	<div class="panel panel--paper an-readout">
		<p class="kicker">What the next roll buys</p>
		<table class="an-table">
			<thead>
				<tr>
					<th scope="col">Substat</th>
					<th scope="col" class="an-num">One roll</th>
					<th scope="col" class="an-num">Damage gained</th>
					<th scope="col" class="an-bar-col" aria-label="Compared"></th>
				</tr>
			</thead>
			<tbody>
				{#each gains as g, i (g.stat.key)}
					<tr
						class:is-read={i === rollIdx}
						tabindex="0"
						onpointerenter={() => (rollIdx = i)}
						onfocus={() => (rollIdx = i)}
						onclick={() => (rollIdx = i)}
					>
						<th scope="row">{g.stat.label}</th>
						<td class="an-num">{fmtStep(g.stat)}</td>
						<td class="an-num an-strong">{fmtGain(g.gain)}</td>
						<td class="an-bar-col">
							<span class="an-lab-track">
								<span class="an-lab-fill" style:width="{(g.gain / gainMax) * 100}%"></span>
							</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<div class="an-roll-reading" aria-live="polite">
			{#each rollReadings as r, i (i)}
				<p class:is-read={i === rollIdx}>{r}</p>
			{/each}
		</div>
		<p class="an-receipt">
			Average 5★ substat rolls on your current sheet. A bar shrinks as you feed its stat, and the
			order stays fixed. DMG Bonus isn’t listed, because no artifact substat carries it.
		</p>
	</div>

	<div class="panel an-build">
		<p class="kicker">Build</p>
		{#if family === 'direct'}
			<div class="an-sheet-row">
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
				<label class="an-field">
					<span class="an-field-label">Base {stat}</span>
					<input
						class="an-input"
						type="number"
						value={sheet.base}
						oninput={(e) => commitNumber(e.currentTarget.value, (v) => (sheet.base = v), 50000)}
					/>
				</label>
				<label class="an-field">
					<span class="an-field-label">Flat {stat}</span>
					<input
						class="an-input"
						type="number"
						value={Math.round(sheet.statFlat)}
						oninput={(e) => commitNumber(e.currentTarget.value, (v) => (sheet.statFlat = v), 50000)}
					/>
				</label>
			</div>
		{/if}
		<div class="an-sliders">
			{#each sliders.before as d, i (d.key)}
				<div
					class="slider-control"
					class:an-wide={i === sliders.before.length - 1 && sliders.before.length % 2 === 1}
				>
					<div class="slider-header">
						<span class="slider-label">{d.label}</span>
						<span class="readout">{fmtSlider(d)}</span>
					</div>
					<input
						type="range"
						min={d.min}
						max={d.max}
						step={d.step}
						bind:value={sheet[d.key]}
						class="slider"
						aria-label={d.aria}
					/>
				</div>
			{/each}
			<div class="slider-control an-wide">
				<div class="slider-header">
					<span class="slider-label">Level</span>
					<span class="readout">{sheet.charLevel}</span>
				</div>
				<div class="an-level">
					<input
						type="range"
						min="1"
						max={MAX_LEVEL}
						step="1"
						value={sheet.charLevel}
						oninput={onLevel}
						onkeydown={onLevelKey}
						class="slider"
						aria-label="Character level"
					/>
					<!-- Above 90 only 95 and 100 exist; the slider jumps the gaps. -->
					<div class="an-level-marks" aria-hidden="true">
						{#each LEVEL_MARKS as lv (lv)}
							<span class="an-level-mark" style:--at={markPos(lv)}></span>
						{/each}
					</div>
				</div>
			</div>
			{#each sliders.after as d, i (d.key)}
				<div
					class="slider-control"
					class:an-wide={i === sliders.after.length - 1 && sliders.after.length % 2 === 1}
				>
					<div class="slider-header">
						<span class="slider-label">{d.label}</span>
						<span class="readout">{fmtSlider(d)}</span>
					</div>
					<input
						type="range"
						min={d.min}
						max={d.max}
						step={d.step}
						bind:value={sheet[d.key]}
						class="slider"
						aria-label={d.aria}
					/>
				</div>
			{/each}
		</div>
		<p class="note">Shred and DEF ignore live in the Enemy DEF &amp; RES instrument.</p>
	</div>
</div>

<style>
	/* Four families outgrow a narrow tile's width — wrap rather than scroll. */
	.an-tabs {
		flex-wrap: wrap;
		justify-self: start;
	}

	/* No frame — the chart is on the night; .ctx-dark stays claimed for
	   --frame-bg. See .gx-chart / app.css's `.frame` retirement note. */
	.an-chart {
		display: grid;
		gap: 0.7rem;
		min-width: 0;
	}

	.an-reactions :global(.chip) {
		font-family: var(--font-condensed);
	}

	/* ── The waterfall ─────────────────────────────────────────────────────
	   One grid; every row is a SUBGRID of it, so names, formulas, bars and
	   values line up across rows. Cells are placed by column NUMBER, so the
	   narrow layout can collapse the formula column without anything sliding
	   into it. */
	.an-wf {
		display: grid;
		grid-template-columns: 1rem minmax(7rem, max-content) minmax(0, 17rem) minmax(7rem, 1fr) minmax(
				4rem,
				max-content
			);
		column-gap: 0.6rem;
		row-gap: 2px;
	}

	.an-wf-axis,
	.an-wf-row {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: subgrid;
		align-items: center;
	}

	.an-wf-axis {
		height: 1.1rem;
	}

	.an-wf-axis > .an-wf-track,
	.an-wf-row > .an-wf-track {
		grid-column: 4;
	}

	.an-wf-row {
		padding: 0.2rem 0;
		border: none;
		border-radius: var(--r-sm);
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: default;
		transition: background-color var(--t-snap);
	}

	.an-wf-row.is-read,
	.an-wf-row:hover {
		background: color-mix(in srgb, var(--text) 6%, transparent);
	}

	.an-wf-row:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.an-wf-row.is-sum {
		border-top: 1px solid var(--chart-rule);
		border-radius: 0 0 var(--r-sm) var(--r-sm);
	}

	.an-wf-op {
		grid-column: 1;
		justify-self: end;
		color: var(--chart-dim);
		font-size: var(--fs-lg);
	}

	.an-wf-label {
		grid-column: 2;
		display: grid;
		line-height: var(--lh-snug);
		min-width: 0;
	}

	.an-wf-name {
		font-weight: var(--fw-semibold);
		font-size: var(--fs-md);
		color: color-mix(in srgb, var(--c) 70%, var(--text));
		white-space: nowrap;
	}

	.an-wf-row.is-sum .an-wf-name {
		color: var(--text);
	}

	.an-wf-real {
		font-size: var(--fs-sm);
		color: var(--muted);
		white-space: nowrap;
	}

	.an-wf-formula {
		grid-column: 3;
		font-size: var(--fs-sm);
		color: var(--chart-ink);
		line-height: var(--lh-snug);
	}

	/* Shown under the name only when the formula column is gone */
	.an-wf-formula-inline {
		display: none;
		font-size: var(--fs-xs);
		color: var(--chart-ink);
	}

	.an-wf-track {
		position: relative;
		height: 1.5rem;
	}

	.an-wf-axis .an-wf-track {
		height: 100%;
	}

	.an-wf-tick {
		position: absolute;
		bottom: 0;
		transform: translateX(-50%);
		font-size: var(--fs-xs);
		color: var(--chart-dim);
		white-space: nowrap;
	}

	.an-wf-grid {
		position: absolute;
		top: -2px;
		bottom: -2px;
		width: 1px;
		background: var(--chart-grid);
	}

	.an-wf-bar {
		position: absolute;
		top: 0.3rem;
		bottom: 0.3rem;
		border-radius: 2px;
		background: var(--c);
		transition:
			left var(--t-move),
			width var(--t-move);
	}

	/* A cut runs backward and is drawn hollow, so a loss never reads as a gain
	   of the same length */
	.an-wf-bar.is-loss {
		background: color-mix(in srgb, var(--c) 22%, transparent);
		box-shadow: inset 0 0 0 1.5px var(--c);
	}

	.an-wf-row.is-sum .an-wf-bar {
		background: color-mix(in srgb, var(--text) 32%, transparent);
	}

	.an-wf-row.is-total .an-wf-bar {
		background: color-mix(in srgb, var(--accent) 70%, transparent);
	}

	.an-wf-start {
		position: absolute;
		top: 0.15rem;
		bottom: 0.15rem;
		width: 2px;
		margin-left: -1px;
		background: var(--c);
		transition: left var(--t-move);
	}

	.an-wf-value {
		grid-column: 5;
		justify-self: end;
		font-weight: var(--fw-semibold);
		font-size: var(--fs-md);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.an-wf-row.is-total .an-wf-value {
		font-size: var(--fs-2xl);
		font-weight: var(--fw-bold);
	}

	/* Narrow tile: the formula leaves its column for a line under the name.
	   46rem, not 40: at a 675px tile (1440×900, two tiles) the column left the
	   bars ~150px, too short to compare */
	@container instrument (max-width: 46rem) {
		.an-wf {
			grid-template-columns: 1rem minmax(6rem, max-content) 0 minmax(6rem, 1fr) minmax(
					3.6rem,
					max-content
				);
			column-gap: 0.5rem;
		}

		.an-wf-formula {
			display: none;
		}

		.an-wf-formula-inline {
			display: block;
		}
	}

	/* Caption + every box's sentence, stacked in one cell */
	.an-reading,
	.an-roll-reading {
		display: grid;
	}

	.an-reading > p,
	.an-roll-reading > p {
		grid-area: 1 / 1;
		margin: 0;
		visibility: hidden;
	}

	.an-reading > p.is-read,
	.an-roll-reading > p.is-read {
		visibility: visible;
	}

	.an-reading > p {
		font-size: var(--fs-lg);
		line-height: 1.35rem;
		color: var(--muted);
	}

	.an-hint {
		color: var(--chart-dim);
	}

	/* ── The readout: one row per substat ──────────────────────────────────── */
	.an-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
		font-variant-numeric: tabular-nums;
	}

	.an-table thead th {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--muted);
		text-align: left;
		padding: 0 0.5rem 0.3rem;
		white-space: nowrap;
	}

	.an-table tbody th,
	.an-table tbody td {
		padding: 0.25rem 0.5rem;
		border-top: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
		vertical-align: middle;
	}

	.an-table tbody th {
		text-align: left;
		font-weight: var(--fw-semibold);
		white-space: nowrap;
	}

	.an-table tbody tr {
		cursor: default;
		transition: background-color var(--t-snap);
	}

	.an-table tbody tr.is-read {
		background: color-mix(in srgb, var(--text) 7%, transparent);
	}

	.an-table tbody tr:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.an-num,
	.an-table thead th.an-num {
		text-align: right;
		white-space: nowrap;
	}

	.an-strong {
		font-weight: var(--fw-semibold);
	}

	.an-bar-col {
		width: 40%;
	}

	.an-lab-track {
		display: block;
		height: 9px;
		border-radius: 3px;
		background: var(--fill-rest);
		overflow: hidden;
	}

	/* Alpha in the PAINT, never element opacity (the sub-pixel law) */
	.an-lab-fill {
		display: block;
		height: 100%;
		min-width: 2px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--accent) 85%, transparent);
		transition: width var(--t-move);
	}

	.an-roll-reading {
		margin-top: 0.6rem;
	}

	.an-roll-reading > p {
		font-size: var(--fs-md);
		line-height: var(--lh-normal);
	}

	.an-receipt {
		margin: 0.4rem 0 0;
		font-size: var(--fs-sm);
		color: color-mix(in srgb, var(--muted) 85%, transparent);
	}

	/* ── Build: one full-width box; sliders two to a line, Level alone ──── */
	.an-sheet-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1.5rem;
		margin-bottom: 0.6rem;
	}

	.an-field {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.an-field-label {
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--muted);
	}

	.an-input {
		width: 5.2rem;
		padding: 0.24rem 0.45rem;
		border: none;
		border-radius: 3px;
		background: var(--fill-rest);
		color: var(--text);
		/* Input field — a sanctioned Mono home */
		font-family: var(--font-mono);
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		text-align: right;
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.an-input::-webkit-outer-spin-button,
	.an-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.an-input:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 1px;
	}

	.an-sliders {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem 1.5rem;
		/* top, not stretch — see ReactionCurvesInstrument's .rx-sliders */
		align-items: start;
	}

	.an-wide {
		grid-column: 1 / -1;
	}

	/* The 90 / 95 / 100 marks — ⚠ mirror the range input's UA 2px side margin
	   (box AND width), or every mark sits 2px left; see ReactionCurvesInstrument */
	.an-level {
		position: relative;
		display: grid;
	}

	.an-level-marks {
		position: relative;
		width: 100%;
		height: 5px;
		margin: 3px 2px 0;
	}

	.an-level-mark {
		position: absolute;
		top: 0;
		left: calc(7.5px + var(--at) * (100% - 15px) - 0.5px);
		width: 1px;
		height: 5px;
		background: color-mix(in srgb, var(--text) 35%, transparent);
	}

	.an-build .note {
		margin-top: 0.6rem;
	}
</style>
