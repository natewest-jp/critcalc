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

	// ── Equation terms per family ─────────────────────────────────────────────
	// Provisional bucket palette (element-free lane — no elements render in this
	// instrument, so hue collisions can't mislead). Nate tunes at review.
	const C = {
		scaling: '#ddb04a',
		dmg: '#e2543e',
		crit: '#c070f0',
		em: '#80c840',
		level: '#6a96c0',
		reaction: '#e2ec6f',
		def: '#9eacc8',
		res: '#4ecbb4',
		base: '#e89a5c',
		elevation: '#f0d7a0'
	};

	/** One box. Its four lines are the key's four lines: what it is, how it is
	 *  worked out, the sheet's numbers that go in, and what it multiplies by. */
	type Term = {
		id: string;
		name: string;
		math: string;
		real: string;
		factor: number;
		/** The bottom line when it isn't a multiplier (a level base, a chunk) */
		display?: string;
		color: string;
		/** The box in a sentence, for whoever hovers or taps it */
		read: string;
	};

	const fmtX = (v: number) => `×${v >= 10 ? v.toFixed(1) : v.toFixed(2)}`;
	const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const emBracket = (k: number, c: number) => `1 + ${k}·EM⁄(${c}+EM) + bonus`;
	const emReal = $derived(rb > 0 ? `${sheet.em} EM · +${rb}%` : `${sheet.em} EM`);

	const critTerm = $derived<Term>({
		id: 'crit',
		name: 'Crit, on average',
		math: '1 + CR·CD',
		real: `${sheet.cr}% · ${sheet.cd}%`,
		factor: critFactor(sheet),
		color: C.crit,
		read: `With ${sheet.cr}% CRIT Rate and ${sheet.cd}% CRIT DMG, the hit would average ${fmtX(critFactor(sheet))} a non-crit.`
	});
	const dmgTerm = $derived<Term>({
		id: 'dmg',
		name: 'DMG Bonus',
		math: '1 + DMG%',
		real: `${sheet.dmgPct.toFixed(1)}%`,
		factor: dmgFactor(sheet),
		color: C.dmg,
		read: `A ${sheet.dmgPct.toFixed(1)}% DMG Bonus would make the hit ${fmtX(dmgFactor(sheet))} as strong.`
	});
	const defTerm = $derived<Term>({
		id: 'def',
		name: 'Enemy DEF',
		math: '(100+yours)⁄(Σ levels)',
		real: `${sheet.charLevel} vs ${sheet.enemyLevel}`,
		factor: defFactor(sheet),
		color: C.def,
		read: `At level ${sheet.charLevel} against a level ${sheet.enemyLevel} enemy, its DEF would let ${pct(defFactor(sheet))} of the hit through.`
	});
	const resTerm = $derived<Term>({
		id: 'res',
		name: 'Enemy RES',
		math: 'by RES range',
		real: `${sheet.enemyRes}%`,
		factor: resFactor(sheet),
		color: C.res,
		read: `At ${sheet.enemyRes}% RES, the enemy would take ${pct(resFactor(sheet))} of the hit.`
	});
	const levelTerm = $derived<Term>({
		id: 'level',
		name: 'Level',
		math: 'level table',
		real: `Lv ${sheet.charLevel}`,
		factor: levelMult(sheet.charLevel),
		display: fmtInt(levelMult(sheet.charLevel)),
		color: C.level,
		read: `The level table gives every level ${sheet.charLevel} character the same reaction base: ${fmtInt(levelMult(sheet.charLevel))}.`
	});
	const reactionTerm = $derived<Term>({
		id: 'reaction',
		name: reaction.name,
		math: family === 'lunar' ? `${reaction.mult} × 60% share` : `×${reaction.mult}`,
		real: 'picked above',
		factor: reaction.shown,
		color: C.reaction,
		read:
			family === 'lunar'
				? `${reaction.name} multiplies that base by ${reaction.mult}, and the top contributor deals 60% of it: ×${reaction.shown}.`
				: `${reaction.name} multiplies that base by ${reaction.mult}.`
	});
	const emTerm = $derived.by<Term>(() => {
		const [factor, math] =
			family === 'additive'
				? [1 + additiveEmBonus(sheet.em) + rb / 100, emBracket(5, 1200)]
				: family === 'lunar'
					? [1 + specialEmBonus(sheet.em) + rb / 100, emBracket(6, 2000)]
					: [1 + transformativeEmBonus(sheet.em) + rb / 100, emBracket(16, 2000)];
		return {
			id: 'em',
			name: 'EM',
			math,
			real: emReal,
			factor,
			color: C.em,
			read:
				rb > 0
					? `EM and the +${rb}% Reaction Bonus together would raise it ${fmtX(factor)}.`
					: `EM would raise it ${fmtX(factor)}.`
		};
	});

	const directTerms = $derived.by((): Term[] => {
		const t: Term[] = [
			{
				id: 'scaling',
				name: `Scaling ${stat}`,
				math: '1 + stat% + flat⁄base',
				real: fmtInt(scalingTotal(sheet)),
				factor: scalingFactor(sheet),
				color: C.scaling,
				read: `Your ${fmtInt(scalingTotal(sheet))} ${stat} would make the hit ${fmtX(scalingFactor(sheet))} what base ${stat} alone deals.`
			},
			dmgTerm,
			critTerm
		];
		if (reaction.mult > 1) {
			const f = ampFactor(sheet, reaction.mult);
			t.push({
				id: 'amp',
				name: reaction.name,
				math: `${reaction.mult} × (${emBracket(2.78, 1400)})`,
				real: emReal,
				factor: f,
				color: C.em,
				read: `A ${reaction.mult === 2 ? 'forward' : 'reverse'} ${reaction.name} would multiply the hit by ${fmtX(f)}.`
			});
		}
		t.push(defTerm, resTerm);
		return t;
	});

	const chunkTerms = $derived<Term[]>([levelTerm, reactionTerm, emTerm]);
	const aChunk = $derived(additiveChunk(sheet, reaction.mult));
	const rideTerms = $derived<Term[]>([
		{
			id: 'chunk',
			name: 'The chunk',
			math: 'row above',
			real: `${reaction.name}`,
			factor: aChunk,
			display: fmtInt(aChunk),
			color: C.reaction,
			read: `The ${fmtInt(aChunk)} from the row above, before it rides the hit.`
		},
		dmgTerm,
		critTerm,
		defTerm,
		resTerm
	]);
	const transTerms = $derived<Term[]>([levelTerm, reactionTerm, emTerm, resTerm]);
	const lunarTerms = $derived<Term[]>([
		levelTerm,
		reactionTerm,
		emTerm,
		{
			id: 'base',
			name: 'Base DMG Bonus',
			math: '1 + base%',
			real: `${sheet.baseDmgPct}%`,
			factor: baseDmgFactor(sheet),
			color: C.base,
			read: `A ${sheet.baseDmgPct}% Base DMG Bonus would raise it ${fmtX(baseDmgFactor(sheet))}.`
		},
		{
			id: 'elevation',
			name: 'Elevation',
			math: '1 + elevation%',
			real: `${sheet.elevationPct}%`,
			factor: elevationFactor(sheet),
			color: C.elevation,
			read: `A ${sheet.elevationPct}% Elevation would raise it ${fmtX(elevationFactor(sheet))}, after every other bracket.`
		},
		critTerm,
		resTerm
	]);

	// The rows the equation draws, each ending in its total
	type EqRow = { terms: Term[]; total: string; totalSub: string };
	const rows = $derived.by((): EqRow[] => {
		if (family === 'direct')
			return [
				{
					terms: directTerms,
					total: fmtX(directTotal(sheet, reaction.mult)),
					totalSub: `vs base ${stat} alone`
				}
			];
		if (family === 'additive')
			return [
				{ terms: chunkTerms, total: fmtInt(aChunk), totalSub: 'flat, added to the hit' },
				{
					terms: rideTerms,
					total: fmtInt(additiveEffective(sheet, reaction.mult)),
					totalSub: 'added, on average'
				}
			];
		if (family === 'lunar')
			return [
				{
					terms: lunarTerms,
					total: fmtInt(lunarTotal(sheet, reaction.mult)),
					totalSub: 'damage, on average'
				}
			];
		return [
			{
				terms: transTerms,
				total: fmtInt(transformativeTotal(sheet, reaction.mult)),
				totalSub: 'damage'
			}
		];
	});
	const allTerms = $derived(rows.flatMap((r) => r.terms));

	const CAPTIONS: Record<FamilyId, string> = $derived({
		direct: `Each box multiplies the hit, and its width shows how far: a ×2 box is the same width wherever it comes from. The total compares against a hit from base ${stat} alone, because the talent multiplier depends on the attack.`,
		additive:
			'Spread and Aggravate add a flat chunk from level and EM alone. The chunk then rides the rest of the hit, so it crits and takes DMG Bonus like the hit does.',
		transformative:
			'Damage from level and EM alone, so the number is exact. For most characters, crit, ATK, and DMG% do nothing, and enemy DEF doesn’t apply.',
		lunar:
			'Damage from level and EM, with two brackets of its own: Base DMG Bonus and Elevation. It can crit, and enemy DEF doesn’t apply. These figures are the top contributor’s 60% share.'
	});

	/** The box being read, by its index in `allTerms`; null reads the caption */
	let boxIdx = $state<number | null>(null);

	// Box weight ∝ |ln(factor)| (multiplicative story, B's lesson): a ×2 block
	// is the same size wherever it comes from; a ×1.05 block stays slim.
	const weightOf = (f: number) => Math.max(0.45, Math.min(2.8, Math.abs(Math.log(f)) * 1.7));

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

{#snippet termBox(t: Term, i: number)}
	<button
		type="button"
		class="an-term"
		class:is-read={boxIdx === i}
		style:--c={t.color}
		style:flex-grow={weightOf(t.factor)}
		onpointerenter={() => (boxIdx = i)}
		onfocus={() => (boxIdx = i)}
		onclick={() => (boxIdx = boxIdx === i ? null : i)}
	>
		<span class="an-t-name">{t.name}</span>
		<span class="an-t-math">{t.math}</span>
		<span class="an-t-real">{t.real}</span>
		<span class="an-t-factor">{t.display ?? fmtX(t.factor)}</span>
	</button>
{/snippet}

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
		<div class="an-eqs" onpointerleave={() => (boxIdx = null)}>
			{#each rows as row, ri (ri)}
				{@const offset = rows.slice(0, ri).reduce((n, r) => n + r.terms.length, 0)}
				<div class="an-eq">
					<!-- The key: what each of a box's four lines is -->
					<span class="an-key" aria-hidden="true">
						<span>What</span>
						<span>Formula</span>
						<span>Your numbers</span>
						<span>Multiplier</span>
					</span>
					{#each row.terms as t, ti (t.id)}
						{#if ti > 0}<span class="an-op" aria-hidden="true">×</span>{/if}
						{@render termBox(t, offset + ti)}
					{/each}
					<!-- "=" and the total wrap as one, or a wrap strands the "=" -->
					<span class="an-result">
						<span class="an-op" aria-hidden="true">=</span>
						<span class="an-total">
							<span class="an-total-big">{row.total}</span>
							<span class="an-total-sub">{row.totalSub}</span>
						</span>
					</span>
				</div>
			{/each}
		</div>

		<!-- Every box's sentence and the caption share one cell, so the height
		     is the longest's and reading a box never moves the panels below -->
		<div class="an-reading" aria-live="polite">
			<p class:is-read={boxIdx === null}>
				{CAPTIONS[family]} <span class="an-hint">Hover or tap a box to read it.</span>
			</p>
			{#each allTerms as t, i (t.id + i)}
				<p class:is-read={boxIdx === i}>{t.read}</p>
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

	/* ── The weighted living equation ──────────────────────────────────────
	   A box is four fixed-height lines, and the key at the start of each row
	   names them — fixed, so a key line and a box line always sit level. The
	   operators sit on the MULTIPLIER line: only that line takes part in the
	   product, and putting the × beside it is what says so. */
	.an-eqs {
		display: grid;
		gap: 0.6rem;
	}

	.an-eq {
		--line-name: 1.15rem;
		--line-math: 1.05rem;
		--line-real: 1.35rem;
		--line-factor: 1.8rem;
		--box-pad-y: 0.4rem;
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 0.45rem 0.35rem;
	}

	.an-key,
	.an-term {
		display: grid;
		grid-template-rows: var(--line-name) var(--line-math) var(--line-real) var(--line-factor);
		align-items: center;
		padding: var(--box-pad-y) 0.55rem;
	}

	.an-key {
		flex: none;
		padding-left: 0;
		font-family: var(--font-condensed);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-mid);
		color: var(--chart-dim);
		text-align: right;
	}

	.an-term {
		--c: var(--accent);
		flex: 1 1 0;
		/* at least as wide as its widest line — a cut-off formula is worse than
		   one more wrapped row */
		min-width: max-content;
		justify-items: center;
		border: none;
		border-radius: var(--r-sm);
		background: color-mix(in srgb, var(--c) 10%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent);
		color: inherit;
		font: inherit;
		cursor: default;
		transition:
			flex-grow var(--t-move),
			background-color var(--t-snap);
	}

	.an-term > span {
		white-space: nowrap;
	}

	.an-term.is-read,
	.an-term:hover {
		background: color-mix(in srgb, var(--c) 20%, transparent);
	}

	.an-term:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.an-t-name {
		font-family: var(--font-condensed);
		font-size: var(--fs-sm);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: color-mix(in srgb, var(--c) 75%, var(--text));
	}

	.an-t-math {
		font-size: var(--fs-xs);
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	.an-t-real {
		font-size: var(--fs-lg);
		color: var(--muted);
	}

	.an-t-factor {
		font-size: var(--fs-2xl);
		font-weight: var(--fw-bold);
		color: var(--text);
	}

	/* On the multiplier line: a box's top padding + its first three lines down */
	.an-op {
		align-self: flex-start;
		margin-top: calc(var(--box-pad-y) + var(--line-name) + var(--line-math) + var(--line-real));
		height: var(--line-factor);
		display: flex;
		align-items: center;
		color: var(--muted);
		font-size: var(--fs-3xl);
	}

	/* Bottom-aligned, so it sits on the multiplier line inline AND sits flush
	   when a narrow row wraps it to a line of its own (a top offset left a
	   blank band there) */
	.an-result {
		align-self: flex-end;
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		padding-bottom: var(--box-pad-y);
	}

	.an-result .an-op {
		margin-top: 0;
		height: auto;
	}

	.an-total {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		padding-left: 0.1rem;
	}

	.an-total-big {
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-none);
	}

	.an-total-sub {
		font-size: var(--fs-md);
		color: var(--muted);
		white-space: nowrap;
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
