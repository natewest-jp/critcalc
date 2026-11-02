<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { shredSources } from '$lib/data/shredSources.generated';
	import { SHRED_ELEMENTS, type ShredElement } from '$lib/capabilities/shredSources';
	import {
		BASE_RES_MAX,
		BASE_RES_MIN,
		ENEMY_LEVEL_MAX,
		RES_RUNGS,
		appliesTo,
		defMultiplier,
		groupSources,
		resMultiplier,
		sumPicks,
		type SourceGroup
	} from './defres';
	import { MAX_LEVEL, snapLevel } from './reactionCurves';
	import DefResChart, { type ChartCurve, type ChartPoint } from './DefResChart.svelte';
	import InstrumentSlider from './kit/InstrumentSlider.svelte';
	import SettingLine from './kit/SettingLine.svelte';
	import { LEVEL_SLIDER } from './kit/level';

	const ELEMENT_NAME: Record<ShredElement, string> = {
		pyro: 'Pyro',
		hydro: 'Hydro',
		anemo: 'Anemo',
		electro: 'Electro',
		dendro: 'Dendro',
		cryo: 'Cryo',
		geo: 'Geo',
		physical: 'Physical'
	};

	const GROUPS = groupSources(shredSources);

	// ── State ─────────────────────────────────────────────────────────────
	let element = $state<ShredElement>('pyro');
	let charLevel = $state(90);
	/** A Transformative, Lunar or Stellar hit: DEF plays no part (gcsim IgnoreDefPercent 1). */
	let ignoresDef = $state(false);
	let enemyLevel = $state(100);
	let baseRes = $state(10);
	let immune = $state(false);
	/** Chip key → the amount picked for it. */
	let picks = $state<Record<string, number>>({});
	/** Shred from anything not listed, whole percent. */
	let otherRes = $state(0);
	let otherDef = $state(0);
	let otherIgnore = $state(0);

	export function reset() {
		element = 'pyro';
		charLevel = 90;
		ignoresDef = false;
		enemyLevel = 100;
		baseRes = 10;
		immune = false;
		picks = {};
		otherRes = 0;
		otherDef = 0;
		otherIgnore = 0;
	}

	export function getShareState() {
		return {
			v: 1,
			element,
			charLevel,
			ignoresDef,
			enemyLevel,
			baseRes: immune ? 'immune' : baseRes,
			picks: $state.snapshot(picks),
			other: [otherRes, otherDef, otherIgnore]
		};
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		const int = (v: unknown, lo: number, hi: number, step = 1) =>
			typeof v === 'number' && Number.isFinite(v)
				? Math.min(hi, Math.max(lo, Math.round(v / step) * step))
				: undefined;
		reset();
		if (SHRED_ELEMENTS.includes(s.element as ShredElement)) element = s.element as ShredElement;
		const lv = int(s.charLevel, 1, MAX_LEVEL);
		if (lv !== undefined) charLevel = snapLevel(lv);
		ignoresDef = s.ignoresDef === true;
		enemyLevel = int(s.enemyLevel, 1, ENEMY_LEVEL_MAX) ?? enemyLevel;
		if (s.baseRes === 'immune') immune = true;
		else baseRes = int(s.baseRes, BASE_RES_MIN, BASE_RES_MAX, 5) ?? baseRes;
		if (typeof s.picks === 'object' && s.picks !== null) {
			const next: Record<string, number> = {};
			for (const [key, amount] of Object.entries(s.picks)) {
				const g = GROUPS.find((x) => x.key === key);
				if (g?.options.some((o) => o.amount === amount)) next[key] = amount as number;
			}
			picks = next;
		}
		if (Array.isArray(s.other)) {
			otherRes = int(s.other[0], 0, 100, 5) ?? 0;
			otherDef = int(s.other[1], 0, 100, 5) ?? 0;
			otherIgnore = int(s.other[2], 0, 100, 5) ?? 0;
		}
	}

	// ── The arithmetic ────────────────────────────────────────────────────
	const picked = $derived(sumPicks(GROUPS, new Map(Object.entries(picks)), element));
	const resShred = $derived(picked.res + otherRes);
	const defShred = $derived(picked.def + otherDef);
	// several ignores add, and gcsim caps the sum at 100%
	const defIgnore = $derived(Math.min(100, picked.ignore + otherIgnore));

	const finalRes = $derived(baseRes - resShred);
	const resBase = $derived(immune ? 0 : resMultiplier(baseRes / 100));
	const resNow = $derived(immune ? 0 : resMultiplier(finalRes / 100));
	const defBase = $derived(ignoresDef ? 1 : defMultiplier(charLevel, enemyLevel));
	const defNow = $derived(
		ignoresDef ? 1 : defMultiplier(charLevel, enemyLevel, defShred / 100, defIgnore / 100)
	);
	const total = $derived(resNow * defNow);
	const totalBase = $derived(resBase * defBase);
	const minus = (v: number) => (v ? `−${v}%` : '0%');
	const gainPct = (now: number, base: number) => (base > 0 ? (now / base - 1) * 100 : 0);

	// ── Sources on screen ─────────────────────────────────────────────────
	const visible = $derived(GROUPS.filter((g) => appliesTo(g, element)));
	const SECTIONS: { stat: SourceGroup['stat']; label: string }[] = [
		{ stat: 'res', label: 'RES shred' },
		{ stat: 'def', label: 'DEF shred' },
		{ stat: 'ignore', label: 'DEF ignore' }
	];
	// characters before sets, then by name
	const ofStat = (stat: SourceGroup['stat']) =>
		visible
			.filter((g) => g.stat === stat)
			.sort(
				(a, b) =>
					Number(a.ownerKind === 'artifact') - Number(b.ownerKind === 'artifact') ||
					a.ownerName.localeCompare(b.ownerName)
			);

	function toggle(g: SourceGroup) {
		const next = { ...picks };
		if (g.key in next) delete next[g.key];
		else next[g.key] = g.options[g.options.length - 1].amount;
		picks = next;
	}
	function pickAmount(g: SourceGroup, amount: number) {
		picks = { ...picks, [g.key]: amount };
	}
	const conOf = (g: SourceGroup) => {
		const amount = picks[g.key] ?? g.options[g.options.length - 1].amount;
		return g.options.find((o) => o.amount === amount)?.minCon ?? 0;
	};
	const whoOf = (g: SourceGroup) =>
		g.stat !== 'ignore'
			? null
			: g.scope === 'skill'
				? 'own Skill DMG only'
				: g.target === 'team'
					? 'whole party'
					: 'own hits';

	// ── Charts ────────────────────────────────────────────────────────────
	const RES_X0 = -100;
	const RES_X1 = 200;
	const clampRes = (r: number) => Math.min(RES_X1, Math.max(RES_X0, r));
	const resAt = (r: number) => resMultiplier(r / 100);
	const fmtX = (m: number) => `×${m.toFixed(3)}`;

	const resCurves = $derived<ChartCurve[]>([
		{ value: resAt, kind: 'live' },
		...(!immune && resShred !== 0
			? [{ value: resAt, kind: 'span' as const, from: clampRes(finalRes), to: clampRes(baseRes) }]
			: [])
	]);
	const resPoints = $derived<ChartPoint[]>(
		immune
			? []
			: [
					...(resShred !== 0
						? [{ x: clampRes(baseRes), y: resAt(clampRes(baseRes)), hollow: true }]
						: []),
					{ x: clampRes(finalRes), y: resAt(clampRes(finalRes)) }
				]
	);
	// The marker stands on FINAL RES; dragging it re-derives the base.
	function setFinalRes(x: number) {
		immune = false;
		baseRes = Math.min(BASE_RES_MAX, Math.max(BASE_RES_MIN, x + resShred));
	}

	const defAt = (lv: number) =>
		ignoresDef ? 1 : defMultiplier(charLevel, lv, defShred / 100, defIgnore / 100);
	const defCurves = $derived<ChartCurve[]>([
		...(!ignoresDef && (defShred > 0 || defIgnore > 0)
			? [{ value: (lv: number) => defMultiplier(charLevel, lv), kind: 'ghost' as const }]
			: []),
		{ value: defAt, kind: 'live' }
	]);
</script>

<div class="instrument instrument--capped dr">
	<!-- One chart slot, two charts: RES takes the larger share of its height -->
	<div class="dr-charts instrument-chart">
		<div class="dr-chart dr-res ctx-dark">
			<DefResChart
				label="Damage multiplier versus the enemy's elemental RES"
				xMin={RES_X0}
				xMax={RES_X1}
				xTicks={[-100, -50, 0, 50, 100, 150, 200]}
				xTick={(x) => `${x}%`}
				xLabel="Enemy {ELEMENT_NAME[element]} RES after shred"
				yMax={1.5}
				yTicks={[0.5, 1, 1.5]}
				yLabel="damage kept"
				curves={resCurves}
				guides={[
					{ x: 0, label: 'below 0%, shred counts half', side: 'left' },
					{ x: 75, label: 'diminishing returns', side: 'right' }
				]}
				points={resPoints}
				marker={immune ? null : clampRes(finalRes)}
				read={(x) => `${x}% → ${fmtX(resAt(x))}`}
				onset={setFinalRes}
				snap={(x) => Math.round(x / 5) * 5}
				dim={immune}
				message={immune ? 'Immune: this element deals no damage' : undefined}
				plotH={140}
			/>
			<p class="dr-caption">
				Most enemies resist 10%. Shred subtracts from RES, and below 0% it still helps, at half the
				rate.
			</p>
		</div>

		<div class="dr-chart dr-def ctx-dark">
			<DefResChart
				label="Enemy DEF multiplier versus enemy level"
				xMin={1}
				xMax={ENEMY_LEVEL_MAX}
				xTicks={[1, 20, 40, 60, 80, 100, 110]}
				xTick={(x) => `${x}`}
				xLabel="Enemy level"
				yMax={1}
				yTicks={[0.25, 0.5, 0.75, 1]}
				yLabel="damage kept"
				curves={defCurves}
				guides={charLevel <= ENEMY_LEVEL_MAX
					? [{ x: charLevel, label: 'your level', side: 'left' }]
					: []}
				points={[{ x: enemyLevel, y: defNow }]}
				marker={enemyLevel}
				read={(x) => `Lv ${x} → ${fmtX(defAt(x))}`}
				onset={(x) => (enemyLevel = x)}
				snap={(x) => Math.round(x)}
				dim={ignoresDef}
				message={ignoresDef ? 'Transformative, Lunar and Stellar reactions ignore DEF' : undefined}
				plotH={110}
			/>
			<p class="dr-caption">
				Equal levels already cost you half your damage. DEF shred and DEF ignore win it back, and
				they multiply together.
			</p>
		</div>
	</div>

	<!-- SETTINGS (design §3): the hit and the enemy, set when you sit down. -->
	<div class="dr-controls panels instrument-settings">
		<div class="panel dr-hit">
			<section class="inst-section">
				<p class="kicker">Your hit</p>
				<div class="dr-elements" role="radiogroup" aria-label="The hit's element">
					{#each SHRED_ELEMENTS as e (e)}
						{#if e === 'physical'}
							<button
								class="chip chip--sm chip--element"
								class:active={element === e}
								style:--chip-color="var(--text)"
								role="radio"
								aria-checked={element === e}
								onclick={() => (element = e)}
							>
								Physical
							</button>
						{:else}
							<button
								class="chip chip--icon"
								class:active={element === e}
								style:--chip-color="var(--el-{e}-main)"
								role="radio"
								aria-checked={element === e}
								aria-label={ELEMENT_NAME[e]}
								title={ELEMENT_NAME[e]}
								onclick={() => (element = e)}
							>
								<img src={elementIcon(e)} alt="" width="16" height="16" />
							</button>
						{/if}
					{/each}
				</div>
				<!-- Set once (almost always 90), so it folds into a line. -->
				<SettingLine label="Your level" ariaLabel="Your level: {charLevel}">
					{#snippet summary()}{charLevel}{/snippet}
					<InstrumentSlider
						label="Your level"
						aria="Character level"
						bind:value={charLevel}
						{...LEVEL_SLIDER}
					/>
				</SettingLine>
				<label class="check">
					<input type="checkbox" bind:checked={ignoresDef} />
					<span class="check-box"></span>
					<span>Transformative, Lunar or Stellar reaction (ignores DEF)</span>
				</label>
			</section>
		</div>

		<div class="panel dr-enemy">
			<section class="inst-section">
				<p class="kicker">Enemy</p>
				<!-- Moving the RES slider leaves Immune. Only a CHANGE does: the field
				     writes its value back when you tab through it or press Escape, and
				     that must not quietly drop Immune. -->
				<InstrumentSlider
					label="{ELEMENT_NAME[element]} RES"
					aria="Enemy base resistance percent"
					bind:value={
						() => baseRes,
						(v) => {
							if (v !== baseRes) immune = false;
							baseRes = v;
						}
					}
					min={BASE_RES_MIN}
					max={BASE_RES_MAX}
					step={5}
					unit={immune ? '' : '%'}
					text={immune ? 'Immune' : null}
				/>
				<div class="chips dr-rungs" role="group" aria-label="Common RES values">
					{#each RES_RUNGS as r (r)}
						<button
							class="chip chip--sm"
							class:active={!immune && baseRes === r}
							onclick={() => {
								immune = false;
								baseRes = r;
							}}
						>
							{r}%
						</button>
					{/each}
					<button class="chip chip--sm" class:active={immune} onclick={() => (immune = !immune)}>
						Immune
					</button>
				</div>
				<InstrumentSlider
					label="Enemy level"
					aria="Enemy level"
					bind:value={enemyLevel}
					min={1}
					max={ENEMY_LEVEL_MAX}
					step={1}
				/>
			</section>
		</div>
	</div>

	<!-- LIVE, then the Readout: the shred list is the control you work here
	     (what does this shred buy?), and the Readout comes last at every width
	     (design §6). One right-hand column at the wide tier, two grid items in
	     their own right below it (see the container queries). -->
	<div class="dr-side">
		<div class="panel dr-sources instrument-live">
			<p class="kicker">Shred</p>
			<div class="inst-sections">
				{#each SECTIONS as sec (sec.stat)}
					{@const list = ofStat(sec.stat)}
					<div class="inst-section">
						<p class="dr-section-head">
							<span>{sec.label}{sec.stat === 'res' ? ` · ${ELEMENT_NAME[element]}` : ''}</span>
							<span class="dr-section-total">
								{sec.stat === 'res'
									? minus(resShred)
									: sec.stat === 'def'
										? minus(defShred)
										: `${defIgnore}%`}
							</span>
						</p>
						<ul class="dr-list">
							{#each list as g (g.key)}
								{@const on = g.key in picks}
								{@const who = whoOf(g)}
								<li class="dr-source" class:is-on={on}>
									<label class="check" title={g.options.map((o) => o.ability).join(' / ')}>
										<input type="checkbox" checked={on} onchange={() => toggle(g)} />
										<span class="check-box"></span>
										<span class="dr-name">{g.ownerName}</span>
										{#if conOf(g) > 0}<span class="dr-con">C{conOf(g)}</span>{/if}
										{#if who}<span class="dr-who">{who}</span>{/if}
									</label>
									{#if g.options.length > 1}
										<span class="dr-options" role="radiogroup" aria-label="{g.ownerName}'s amount">
											{#each g.options as o (o.amount)}
												<button
													class="chip chip--sm"
													class:active={on && picks[g.key] === o.amount}
													role="radio"
													aria-checked={on && picks[g.key] === o.amount}
													title={o.ability}
													onclick={() => pickAmount(g, o.amount)}
												>
													{o.amount}%
												</button>
											{/each}
										</span>
									{:else}
										<span class="dr-amount">{g.options[0].amount}%</span>
									{/if}
								</li>
							{:else}
								<li class="dr-none">
									No character or set in the data shreds {ELEMENT_NAME[element]} RES.
								</li>
							{/each}
						</ul>
						{#if sec.stat === 'res'}
							<InstrumentSlider
								label="Other sources"
								aria="Other resistance shred percent"
								bind:value={otherRes}
								min={0}
								max={100}
								step={5}
								unit="%"
							/>
						{:else if sec.stat === 'def'}
							<InstrumentSlider
								label="Other sources"
								aria="Other defense shred percent"
								bind:value={otherDef}
								min={0}
								max={100}
								step={5}
								unit="%"
							/>
						{:else}
							<InstrumentSlider
								label="Other sources"
								aria="Other defense ignore percent"
								bind:value={otherIgnore}
								min={0}
								max={100}
								step={5}
								unit="%"
							/>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="panel panel--paper dr-readout instrument-readout">
			<p class="kicker">Readout</p>
			<p class="readout-head">
				{fmtX(total)}<span class="readout-sentence">of your hit's damage gets through</span>
			</p>
			<dl class="dr-rows">
				<dt>RES</dt>
				<dd>
					{#if immune}
						Immune
					{:else}
						<span class="dr-strong">{fmtX(resNow)}</span>
						<span class="dr-sub"
							>at {finalRes}% RES{resShred ? ` (${baseRes}% before shred)` : ''}</span
						>
					{/if}
				</dd>
				<dt>DEF</dt>
				<dd>
					<span class="dr-strong">{fmtX(defNow)}</span>
					<span class="dr-sub">
						{#if ignoresDef}
							ignored by this hit
						{:else}
							Lv {charLevel} vs Lv {enemyLevel}{defShred ? ` · −${defShred}% DEF` : ''}{defIgnore
								? ` · ${defIgnore}% ignored`
								: ''}
						{/if}
					</span>
				</dd>
			</dl>
			{#if !immune && total !== totalBase}
				<p class="dr-meta">
					Your shred and DEF ignore add
					<span class="dr-strong">{gainPct(total, totalBase).toFixed(1)}%</span> damage against this enemy
				</p>
			{/if}
			<p class="note dr-regime">
				{#if immune}
					An immune enemy takes no damage of this element, whatever the shred.
				{:else if finalRes < 0}
					Below 0% RES, shred works at half strength.
				{:else if finalRes >= 75}
					Above 75% RES, shred works at less than full strength, until RES drops back under 75%.
				{:else}
					Between 0% and 75% RES, shred works at full strength.
				{/if}
			</p>
			<p class="dr-receipt">
				<span class="dr-formula">res &lt; 0: 1−res/2 · 0–75%: 1−res · ≥75%: 1/(4·res+1)</span>
				<span class="dr-formula"
					>(100+yours) / ((100+yours) + (100+enemy)·(1−shred)·(1−ignore))</span
				>
			</p>
		</div>
	</div>
</div>

<style>
	/* ══ THE LAYOUT IS app.css's .instrument, WITH THE SHRED LIST MOVED ═══════
	   The shred list is the live control (the slot classes are app.css's), but
	   it is a long list, so it does not head the rail as a live slot does:
	   narrow and mid, it comes after Your hit / Enemy, which would otherwise
	   sit under it; wide, it shares the right-hand column with the Readout.
	   The Readout is last at every width (⚓ Nate 2026-10-06; design §6).
	   Areas are one property, so this restates them at each tier. */
	.instrument {
		grid-template-areas: 'chart' 'settings' 'live' 'readout';
	}

	/* RES takes the larger share of the slot's height */
	.dr-charts {
		gap: 1rem;
	}

	.dr-res {
		flex: 3 1 0;
	}

	.dr-def {
		flex: 2 1 0;
	}

	/* No frame — the charts are on the night; .ctx-dark stays claimed for
	   --frame-bg. See .gx-chart / app.css's `.frame` retirement note. */
	/* The chart takes the track, its caption the line beneath. ⚠ An explicit
	   minmax(0, 1fr) column: an auto one grows to the SVG's width and clips it
	   (the Artifact Odds hazard). The row's min-content is the chart's floor
	   (.instrument-graph), never the SVG it last drew. */
	.dr-chart {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(min-content, 1fr) auto;
		min-width: 0;
	}

	.dr-caption {
		margin: 0.25rem 0 0;
		font-size: var(--fs-sm);
		line-height: 1.35;
		color: var(--chart-dim);
	}

	/* The shred list and the Readout: grid items in their own right below the
	   wide tier, one right-hand column at it. */
	.dr-side {
		display: contents;
	}

	/* ── Readout ── */
	.dr-rows {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.15rem 0.75rem;
		margin: 0.6rem 0 0;
		font-size: var(--fs-xl);
		line-height: 1.5rem;
		font-variant-numeric: tabular-nums;
	}

	.dr-rows dt {
		color: var(--muted);
	}

	.dr-rows dd {
		margin: 0;
	}

	.dr-sub {
		margin-left: 0.35rem;
		font-size: var(--fs-md);
		color: var(--muted);
	}

	.dr-meta {
		margin: 0.5rem 0 0;
		font-size: var(--fs-xl);
		line-height: 1.5rem;
		color: var(--muted);
	}

	.dr-strong {
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.dr-regime {
		margin: 0.5rem 0 0;
		max-width: none;
	}

	/* The receipts: exact formulas, after the plain-language lines */
	.dr-receipt {
		display: grid;
		gap: 0.1rem;
		margin: 0.5rem 0 0;
		font-size: var(--fs-sm);
		color: color-mix(in srgb, var(--muted) 85%, transparent);
	}

	.dr-formula {
		font-family: var(--font-body);
	}

	/* ── Your hit / Enemy ── */
	.dr-elements {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}

	/* The rungs belong to the RES slider above them: a rung closer, as a hint
	   is (app.css § THE SPACING LADDER) */
	.dr-rungs {
		margin: calc(var(--inst-gap-in) - var(--inst-gap-control)) 0 0;
	}

	.dr-rungs .chip {
		text-transform: none;
		font-variant-numeric: tabular-nums;
	}

	.dr-hit .check {
		font-size: var(--fs-md);
	}

	/* ── Shred sources ── */
	/* The kicker to its first stat is the ladder's control rung; the stats
	   are its sections, each an .inst-section (app.css § THE SPACING LADDER) */
	.dr-sources {
		gap: var(--inst-gap-control);
	}

	/* A stat's head names its list as a label names its track: a rung closer
	   than the controls under it */
	/* A group's head speaks at the label's size (round 2): at 12px it sat under
	   its own Other sources label, which the kit sets at --fs-lg. */
	.dr-section-head {
		display: flex;
		justify-content: space-between;
		margin: 0 0 calc(var(--inst-gap-in) - var(--inst-gap-control));
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.dr-section-total {
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}

	.dr-list {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.dr-source {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 1.75rem;
	}

	.dr-source .check {
		min-width: 0;
		gap: 0.45rem;
		font-size: var(--fs-md);
	}

	.dr-source.is-on .dr-name {
		color: var(--text);
	}

	.dr-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dr-con,
	.dr-who {
		flex: none;
		font-size: var(--fs-sm);
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	.dr-amount {
		flex: none;
		font-size: var(--fs-md);
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}

	.dr-options {
		display: flex;
		flex: none;
		gap: 2px;
	}

	.dr-options .chip {
		text-transform: none;
		padding: 0.1rem 0.35rem;
		font-variant-numeric: tabular-nums;
	}

	.dr-none {
		font-size: var(--fs-md);
		color: var(--muted);
	}

	/* ── Mid: the charts across; Your hit / Enemy over the shred list on the
	   left, the Readout on the right (app.css's mid rows) ── */
	@container instrument (38rem <= width < 60rem) {
		.instrument {
			grid-template-areas:
				'chart chart'
				'settings readout'
				'live readout';
		}

		/* Beside the shred list the Readout stays in view, so the answer is on
		   screen while you work down the list. */
		.dr-readout {
			position: sticky;
			top: 0;
		}
	}

	/* ── Wide: the charts over Your hit / Enemy on the left; on the right the
	   shred list, then the Readout at the column's foot ── */
	@container instrument (min-width: 60rem) {
		.instrument {
			grid-template-rows: minmax(min-content, 1fr) auto;
			grid-template-areas:
				'chart side'
				'settings side';
		}

		/* The charts share the left column with Your hit / Enemy, so they take
		   the height those leave, not the tile's (app.css's wide chart). Neither
		   panel changes height as you use it, so the charts hold still all the
		   same. */
		.dr-charts {
			position: static;
			align-self: stretch;
			height: auto;
		}

		.dr-side {
			grid-area: side;
			display: flex;
			flex-direction: column;
			gap: 1rem;
			min-width: 0;
			min-height: 0;
		}

		/* app.css's `align-self: start` for these slots would shrink them
		   across a flex column. */
		.dr-sources,
		.dr-readout {
			align-self: stretch;
		}

		/* The shred list FIRST, taking the height the Readout leaves and
		   scrolling inside it, top-anchored: when the Readout grows (a tick
		   adds the meta line, lengthens the sub-lines, swaps the regime note)
		   the list's window gets shorter, but its rows stay where they are.
		   The floor keeps a few rows in view on a short tile. */
		.dr-sources {
			flex: 1 1 0;
			min-height: 10rem;
			overflow-y: auto;
		}

		.dr-readout {
			flex: none;
		}
	}

	/* The column is the tile's height, and sticky, so the left column, when
	   it runs taller than the tile, scrolls past a shred list and Readout that
	   hold still. ⚠ Only where the tile is a SIZE container (from 1024px,
	   +page.svelte), or `cqh` would read the viewport; below that the column
	   stretches to the left column's height. */
	@media (min-width: 1024px) {
		@container instrument (min-width: 60rem) {
			.dr-side {
				position: sticky;
				top: 0;
				align-self: start;
				height: 100cqh;
			}
		}
	}
</style>
