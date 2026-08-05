<script lang="ts">
	import {
		DEFAULT_SHEET,
		REACTIONS,
		additiveChunk,
		additiveEffective,
		ampFactor,
		critFactor,
		defFactor,
		directTotal,
		dmgFactor,
		labStats,
		marginalGain,
		resFactor,
		scalingFactor,
		scalingTotal,
		transformativeTotal,
		type FamilyId,
		type SheetInputs
	} from './anatomy';
	import { levelMult, additiveEmBonus, transformativeEmBonus } from './reactionCurves';

	let family = $state<FamilyId>('direct');
	let reactionId = $state('none');
	let sheet = $state<SheetInputs>({ ...DEFAULT_SHEET });

	// Family switch keeps a legal reaction selected
	$effect(() => {
		if (!REACTIONS[family].some((r) => r.id === reactionId)) {
			reactionId = REACTIONS[family][0].id;
		}
	});
	const reaction = $derived(
		REACTIONS[family].find((r) => r.id === reactionId) ?? REACTIONS[family][0]
	);

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
		res: '#4ecbb4'
	};

	type Term = { name: string; math: string; real: string; factor: number; color: string };

	const fmtX = (v: number) => `×${v >= 10 ? v.toFixed(1) : v.toFixed(2)}`;
	const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');

	const directTerms = $derived.by((): Term[] => {
		const t: Term[] = [
			{
				name: 'Scaling Stat',
				math: '1 + stat% + flat⁄base',
				real: fmtInt(scalingTotal(sheet)),
				factor: scalingFactor(sheet),
				color: C.scaling
			},
			{
				name: 'DMG Bonus',
				math: '1 + DMG%',
				real: `${sheet.dmgPct.toFixed(1)}%`,
				factor: dmgFactor(sheet),
				color: C.dmg
			},
			{
				name: 'Crit (avg)',
				math: '1 + CR·CD',
				real: `${sheet.cr}% · ${sheet.cd}%`,
				factor: critFactor(sheet),
				color: C.crit
			}
		];
		if (reaction.mult > 1) {
			t.push({
				name: reaction.label.split(' ')[0],
				math: `${reaction.mult} × (1 + 2.78·EM⁄(1400+EM))`,
				real: `${sheet.em} EM`,
				factor: ampFactor(sheet, reaction.mult),
				color: C.em
			});
		}
		t.push(
			{
				name: 'Enemy DEF',
				math: '(100+yours)⁄(Σ levels)',
				real: `${sheet.charLevel} vs ${sheet.enemyLevel}`,
				factor: defFactor(sheet),
				color: C.def
			},
			{
				name: 'Enemy RES',
				math: 'regime(res)',
				real: `${sheet.enemyRes}%`,
				factor: resFactor(sheet),
				color: C.res
			}
		);
		return t;
	});

	const chunkTerms = $derived.by((): Term[] => [
		{
			name: 'Level',
			math: 'level table',
			real: `Lv ${sheet.charLevel}`,
			factor: levelMult(sheet.charLevel),
			color: C.level
		},
		{
			name: reaction.label.split(' ')[0],
			math: `×${reaction.mult}`,
			real: reaction.label.split(' ').pop() ?? '',
			factor: reaction.mult,
			color: C.reaction
		},
		{
			name: 'EM',
			math: family === 'additive' ? '1 + 5·EM⁄(1200+EM)' : '1 + 16·EM⁄(2000+EM)',
			real: `${sheet.em} EM`,
			factor:
				family === 'additive' ? 1 + additiveEmBonus(sheet.em) : 1 + transformativeEmBonus(sheet.em),
			color: C.em
		}
	]);

	const rideTerms = $derived.by((): Term[] => [
		{
			name: 'DMG Bonus',
			math: '1 + DMG%',
			real: `${sheet.dmgPct.toFixed(1)}%`,
			factor: dmgFactor(sheet),
			color: C.dmg
		},
		{
			name: 'Crit (avg)',
			math: '1 + CR·CD',
			real: `${sheet.cr}% · ${sheet.cd}%`,
			factor: critFactor(sheet),
			color: C.crit
		},
		{
			name: 'Enemy DEF',
			math: '(100+yours)⁄(Σ levels)',
			real: `${sheet.charLevel} vs ${sheet.enemyLevel}`,
			factor: defFactor(sheet),
			color: C.def
		},
		{
			name: 'Enemy RES',
			math: 'regime(res)',
			real: `${sheet.enemyRes}%`,
			factor: resFactor(sheet),
			color: C.res
		}
	]);

	const resTerm = $derived.by((): Term[] => [
		{
			name: 'Enemy RES',
			math: 'regime(res)',
			real: `${sheet.enemyRes}%`,
			factor: resFactor(sheet),
			color: C.res
		}
	]);

	// Box weight ∝ |ln(factor)| (multiplicative story, B's lesson): a ×2 block
	// is the same size wherever it comes from; a ×1.05 block stays slim.
	const weightOf = (f: number) => Math.max(0.45, Math.min(2.8, Math.abs(Math.log(f)) * 1.7));

	const dTotal = $derived(directTotal(sheet, reaction.mult));
	const aChunk = $derived(additiveChunk(sheet, reaction.mult));
	const aEffective = $derived(additiveEffective(sheet, reaction.mult));
	const tTotal = $derived(transformativeTotal(sheet, reaction.mult));

	const lab = $derived(labStats(family, reaction.mult));
	const gains = $derived(
		lab.map((s) => ({ stat: s, gain: marginalGain(family, sheet, reaction.mult, s) }))
	);
	const gainMax = $derived(Math.max(...gains.map((g) => g.gain), 1e-9));

	function commitNumber(raw: string, apply: (v: number) => void, max = 100000) {
		const v = Number(raw);
		if (!Number.isFinite(v) || raw.trim() === '') return;
		apply(Math.min(max, Math.max(0, v)));
	}

	// ── Workspace handle (share + reset) ─────────────────────────────────────
	export function reset() {
		family = 'direct';
		reactionId = 'none';
		sheet = { ...DEFAULT_SHEET };
	}

	export function getShareState() {
		return { v: 1, family, reaction: reactionId, sheet: { ...sheet } };
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		if (s.family === 'direct' || s.family === 'additive' || s.family === 'transformative')
			family = s.family;
		if (typeof s.reaction === 'string' && REACTIONS[family].some((r) => r.id === s.reaction))
			reactionId = s.reaction;
		if (typeof s.sheet === 'object' && s.sheet !== null) {
			const raw = s.sheet as Record<string, unknown>;
			const next = { ...sheet };
			for (const key of Object.keys(DEFAULT_SHEET) as (keyof SheetInputs)[]) {
				const v = raw[key];
				if (typeof v === 'number' && Number.isFinite(v))
					next[key] = Math.min(100000, Math.max(0, v));
			}
			next.charLevel = Math.min(90, Math.max(1, Math.round(next.charLevel)));
			next.enemyLevel = Math.min(110, Math.max(1, Math.round(next.enemyLevel)));
			next.enemyRes = Math.min(100, Math.max(-50, next.enemyRes));
			sheet = next;
		}
	}
</script>

{#snippet termBox(t: Term)}
	<span class="an-term" style:--c={t.color} style:flex-grow={weightOf(t.factor)}>
		<span class="an-t-name">{t.name}</span>
		<span class="an-t-math">{t.math}</span>
		<span class="an-t-real">{t.real}</span>
		<span class="an-t-factor">{fmtX(t.factor)}</span>
	</span>
{/snippet}

<div class="instrument">
	<!-- Family switch -->
	<div class="an-views">
		<button
			class="chip chip--control"
			class:active={family === 'direct'}
			onclick={() => (family = 'direct')}
		>
			Direct Hit
		</button>
		<button
			class="chip chip--control"
			class:active={family === 'additive'}
			onclick={() => (family = 'additive')}
		>
			Additive (on Quicken)
		</button>
		<button
			class="chip chip--control"
			class:active={family === 'transformative'}
			onclick={() => (family = 'transformative')}
		>
			Transformative
		</button>
	</div>

	<div class="an-frame frame ctx-dark">
		<div class="chips an-reactions">
			{#each REACTIONS[family] as r (r.id)}
				<button
					class="chip chip--control"
					class:active={reactionId === r.id}
					onclick={() => (reactionId = r.id)}
				>
					{r.label}
				</button>
			{/each}
		</div>

		{#if family === 'direct'}
			<div class="an-eq">
				{#each directTerms as t (t.name)}
					{@render termBox(t)}
					<span class="an-op">×</span>
				{/each}
				<span class="an-total">
					<span class="an-total-big">{fmtX(dTotal)}</span>
					<span class="an-total-sub">vs a bare hit</span>
				</span>
			</div>
			<p class="an-caption">
				Every box is a multiplier on your damage; box width shows how much it moves the hit (a ×2
				box is the same width wherever it comes from). Feeding a wide box barely widens it — that is
				the whole diminishing-returns lesson. Relative only: the game owns your real numbers.
			</p>
		{:else if family === 'additive'}
			<div class="an-eq">
				{#each chunkTerms as t (t.name)}
					{@render termBox(t)}
					<span class="an-op">×</span>
				{/each}
				<span class="an-total">
					<span class="an-total-big">{fmtInt(aChunk)}</span>
					<span class="an-total-sub">flat, added to the hit</span>
				</span>
			</div>
			<p class="an-join">the chunk then rides the rest of the hit —</p>
			<div class="an-eq">
				{#each rideTerms as t (t.name)}
					{@render termBox(t)}
					<span class="an-op">×</span>
				{/each}
				<span class="an-total">
					<span class="an-total-big">{fmtInt(aEffective)}</span>
					<span class="an-total-sub">effective, on average</span>
				</span>
			</div>
			<p class="an-caption">
				Spread/Aggravate add an exact flat chunk (level + EM only — no talent, no ATK), which then
				crits and scales like the rest of the hit. These numbers are complete and exact.
			</p>
		{:else}
			<div class="an-eq">
				{#each chunkTerms as t (t.name)}
					{@render termBox(t)}
					<span class="an-op">×</span>
				{/each}
				{#each resTerm as t (t.name)}
					{@render termBox(t)}
					<span class="an-op">=</span>
				{/each}
				<span class="an-total">
					<span class="an-total-big">{fmtInt(tTotal)}</span>
					<span class="an-total-sub">damage, exactly</span>
				</span>
			</div>
			<p class="an-caption">
				Transformative damage is complete from level, EM and enemy RES alone — crit, ATK and DMG% do
				nothing to it. This is the one family where the exact number is knowable.
			</p>
		{/if}
	</div>

	<div class="an-panels panels">
		<div class="panel">
			<p class="kicker">Your Sheet</p>
			<div class="an-row">
				<span class="an-row-label"
					>Base stat <span class="an-fine">ATK for most characters</span></span
				>
				<input
					class="an-input"
					type="number"
					value={sheet.base}
					oninput={(e) => commitNumber(e.currentTarget.value, (v) => (sheet.base = v), 5000)}
					aria-label="Base scaling stat"
				/>
			</div>
			<div class="an-row">
				<span class="an-row-label">Flat bonus</span>
				<input
					class="an-input"
					type="number"
					value={Math.round(sheet.statFlat)}
					oninput={(e) => commitNumber(e.currentTarget.value, (v) => (sheet.statFlat = v), 10000)}
					aria-label="Flat stat bonus"
				/>
			</div>
			<div class="slider-control">
				<div class="slider-header">
					<span class="slider-label">Stat%</span>
					<span class="readout">{sheet.statPct.toFixed(1)}%</span>
				</div>
				<input
					type="range"
					min="0"
					max="300"
					step="0.5"
					bind:value={sheet.statPct}
					class="slider"
					aria-label="Scaling stat percent bonus"
				/>
			</div>
			<div class="slider-control">
				<div class="slider-header">
					<span class="slider-label">DMG Bonus</span>
					<span class="readout">{sheet.dmgPct.toFixed(1)}%</span>
				</div>
				<input
					type="range"
					min="0"
					max="200"
					step="0.1"
					bind:value={sheet.dmgPct}
					class="slider"
					aria-label="Damage bonus percent"
				/>
			</div>
			<div class="slider-control">
				<div class="slider-header">
					<span class="slider-label">CRIT Rate</span>
					<span class="readout">{sheet.cr}%</span>
				</div>
				<input
					type="range"
					min="0"
					max="100"
					step="1"
					bind:value={sheet.cr}
					class="slider"
					aria-label="Crit rate percent"
				/>
			</div>
			<div class="slider-control">
				<div class="slider-header">
					<span class="slider-label">CRIT DMG</span>
					<span class="readout">{sheet.cd}%</span>
				</div>
				<input
					type="range"
					min="0"
					max="300"
					step="1"
					bind:value={sheet.cd}
					class="slider"
					aria-label="Crit damage percent"
				/>
			</div>
			<div class="slider-control">
				<div class="slider-header">
					<span class="slider-label">Elemental Mastery</span>
					<span class="readout">{sheet.em}</span>
				</div>
				<input
					type="range"
					min="0"
					max="1200"
					step="5"
					bind:value={sheet.em}
					class="slider"
					aria-label="Elemental mastery"
				/>
			</div>
		</div>

		<div class="panel">
			<p class="kicker">Levels &amp; Enemy</p>
			<div class="slider-control">
				<div class="slider-header">
					<span class="slider-label">Your Level</span>
					<span class="readout">{sheet.charLevel}</span>
				</div>
				<input
					type="range"
					min="1"
					max="90"
					step="1"
					bind:value={sheet.charLevel}
					class="slider"
					aria-label="Character level"
				/>
			</div>
			<div class="slider-control">
				<div class="slider-header">
					<span class="slider-label">Enemy Level</span>
					<span class="readout">{sheet.enemyLevel}</span>
				</div>
				<input
					type="range"
					min="1"
					max="110"
					step="1"
					bind:value={sheet.enemyLevel}
					class="slider"
					aria-label="Enemy level"
				/>
			</div>
			<div class="slider-control">
				<div class="slider-header">
					<span class="slider-label">Enemy RES</span>
					<span class="readout">{sheet.enemyRes}%</span>
				</div>
				<input
					type="range"
					min="-50"
					max="100"
					step="5"
					bind:value={sheet.enemyRes}
					class="slider"
					aria-label="Enemy resistance percent"
				/>
			</div>
			<p class="note">
				Deeper enemy anatomy (shred, ignore, RES regimes) lives in the Enemy DEF &amp; RES
				instrument.
			</p>
		</div>

		<div class="panel">
			<p class="kicker">What The Next Roll Buys</p>
			{#each gains as g (g.stat.key)}
				<div class="an-lab-row">
					<span class="an-lab-name">
						{g.stat.label}
						<span class="an-fine">{g.stat.stepLabel}</span>
					</span>
					<span class="an-lab-track">
						<span class="an-lab-fill" style:width="{(g.gain / gainMax) * 100}%"></span>
					</span>
					<span class="an-lab-gain">+{(g.gain * 100).toFixed(1)}%</span>
				</div>
			{/each}
			<p class="note">
				Average 5★ substat rolls, applied to YOUR current sheet — watch a bar deflate as you feed
				its stat. Fixed order, no verdicts: the bars speak for themselves.
			</p>
		</div>
	</div>
</div>

<style>
	.an-views {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.an-frame {
		display: grid;
		gap: 0.7rem;
		padding: 0.9rem 1rem 0.8rem;
		border-radius: 9px;
	}

	.an-reactions :global(.chip) {
		font-family: var(--font-condensed);
	}

	/* ── The weighted living equation ──────────────────────────────────────── */

	.an-eq {
		display: flex;
		align-items: stretch;
		flex-wrap: wrap;
		gap: 0.45rem 0.35rem;
	}

	.an-term {
		--c: var(--accent);
		flex: 1 1 0;
		min-width: 7.2rem;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 0.1rem;
		padding: 0.5rem 0.55rem 0.45rem;
		border-radius: 6px;
		background: color-mix(in srgb, var(--c) 10%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent);
		transition: flex-grow 220ms ease;
	}

	.an-t-name {
		font-family: var(--font-condensed);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: color-mix(in srgb, var(--c) 75%, var(--text));
		text-align: center;
	}

	.an-t-math {
		font-size: var(--fs-2xs);
		color: color-mix(in srgb, var(--muted) 80%, transparent);
		text-align: center;
	}

	.an-t-real {
		font-size: var(--fs-md);
		color: var(--muted);
	}

	.an-t-factor {
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		color: var(--text);
	}

	.an-op {
		align-self: center;
		color: var(--muted);
		font-size: var(--fs-2xl);
	}

	.an-total {
		align-self: center;
		display: grid;
		justify-items: start;
		padding-left: 0.3rem;
	}

	.an-total-big {
		font-size: var(--fs-4xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	.an-total-sub {
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	.an-join {
		margin: -0.2rem 0;
		font-family: var(--font-condensed);
		font-size: var(--fs-sm);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	.an-caption {
		margin: 0;
		font-size: var(--fs-md);
		line-height: 1.35rem;
		color: var(--muted);
	}

	/* ── Panels ─────────────────────────────────────────────────────────────── */

	.an-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.an-row-label {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--muted);
	}

	.an-fine {
		display: block;
		font-family: var(--font-condensed);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-normal);
		letter-spacing: var(--ls-mid);
		text-transform: none;
		color: color-mix(in srgb, var(--muted) 75%, transparent);
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
		font-size: var(--fs-lg);
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

	/* ── Stat lab ───────────────────────────────────────────────────────────── */

	.an-lab-row {
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr) 3.6rem;
		align-items: center;
		gap: 0.6rem;
	}

	.an-lab-name {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
	}

	.an-lab-track {
		height: 11px;
		border-radius: 3px;
		background: var(--fill-rest);
		overflow: hidden;
	}

	.an-lab-fill {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: var(--accent);
		opacity: 0.85;
		min-width: 2px;
		transition: width 180ms ease;
	}

	.an-lab-gain {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		text-align: right;
	}
</style>
