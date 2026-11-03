<script lang="ts">
	import CritHeatmap from './CritHeatmap.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import InstrumentSlider from './kit/InstrumentSlider.svelte';
	import {
		CR_MIN,
		CR_MAX,
		CD_MIN,
		CD_MAX,
		clamp,
		averageDamageMultiplier,
		critValue,
		zeroCritProbability,
		riskGradient,
		HITS_MIN,
		HITS_MAX,
		sampleRotation,
		formatMultiplier,
		formatChance,
		critCountDistribution,
		rotationMultiplier,
		type FieldRect
	} from './crit';

	// Your build, bound to the field's marker and both handles
	let myCR = $state(0.7);
	let myCD = $state(1.4);

	// The rotation: its hits, and whether the field is shaded by its no-crit risk
	let shading = $state(true);
	let hitsPerRotation = $state(8);

	// A second, pinned build for eyeballing a trade (a circlet swap): no
	// verdict, two markers and the change between them
	let pinned = $state<{ critRate: number; critDamage: number } | null>(null);

	// "Roll": one sampled rotation, variance as an experience, not a number
	let rollResult = $state<boolean[] | null>(null);
	let rollNonce = $state(0); // remounts the dots so the stagger replays
	function rollIt() {
		rollResult = sampleRotation(myCR, hitsPerRotation);
		rollNonce++;
	}
	// A sample is only honest for the stats it was drawn at
	$effect(() => {
		void myCR;
		void hitsPerRotation;
		rollResult = null;
	});
	const rollCrits = $derived(rollResult ? rollResult.filter(Boolean).length : 0);

	const myMultiplier = $derived(averageDamageMultiplier(myCR, myCD));
	const zeroCritRisk = $derived(zeroCritProbability(myCR, hitsPerRotation));
	const distribution = $derived(critCountDistribution(myCR, hitsPerRotation));
	const averageCrits = $derived(clamp(myCR, 0, 1) * hitsPerRotation);
	const pinnedDelta = $derived(
		pinned ? myMultiplier / averageDamageMultiplier(pinned.critRate, pinned.critDamage) - 1 : 0
	);

	// The strip's row the fine print reads: the hovered or tapped one, else
	// the rolled one
	let hoverCount = $state<number | null>(null);
	const readCount = $derived(hoverCount ?? (rollResult ? rollCrits : null));

	const hitsWord = (n: number) => (n === 1 ? 'hit' : 'hits');

	// ── Geometry ───────────────────────────────────────────────────────────
	let graphW = $state(900);
	let graphH = $state(0);
	/** The toolbar on the chart's top edge: measured, because it wraps, and
	 *  the CRIT Rate track hangs from the column's top past it. */
	let topH = $state(36);
	/** Half the slider thumb's 15px: a handle's track runs this far past each
	 *  end of its axis, so the thumb sits on the marker's line. */
	const THUMB_R = 7.5;
	/** 🎛️ Left to right: the strip, STRIP_GAP, the CRIT Rate handle (the
	 *  thumb's 15px), CR_GAP, the y axis's numbers ("100%", right-aligned
	 *  TICK_GAP from the plot; CritHeatmap), the field, then the average's
	 *  axis ("×1.98", AVG_W). */
	const STRIP_GAP = 10;
	const CR_TRACK = 15;
	const CR_GAP = 8;
	const TICK_W = 26;
	const TICK_GAP = 6;
	const AVG_W = 40;
	const PADR = 2;
	/** 🎛️ Above the plot: the average axis's name and the top numbers' half. */
	const TOP = 18;
	/** Under the plot: the x axis's numbers and the strip's name. The CRIT DMG
	 *  handle is under the SVG. */
	const BOTTOM = 22;
	/** 🎛️ Between the toolbar on the chart's top edge and the chart. */
	const TOOLBAR_GAP = 6;
	/** 🎛️ The strip beside the field: a share of the plot's height, within
	 *  limits (by height, so the column's width can follow the field without
	 *  chasing itself). */
	const STRIP_PER_H = 0.15;
	const STRIP_MIN = 56;
	const STRIP_MAX = 110;
	/** 🎛️ Below this chart width (a phone) the strip leaves the field's side
	 *  and lies under the chart on its own axis (⚓ Nate 2026-11-03: on the
	 *  phone it took the field's width). */
	const STRIP_SIDE_MIN = 560;
	/** 🎛️ The strip under the chart: its height, bars and numbers. */
	const STRIP_BELOW_H = 56;
	/** 🎛️ THE FIELD'S WIDEST, as a multiple of its height (⚓ Nate
	 *  2026-11-03: one up on a wide screen it stretched past 2:1). From 1024px
	 *  the chart's column is capped at the width that gives the field this
	 *  shape. */
	const FIELD_MAX_ASPECT = 1.5;
	/** The plot's least height; below 1024px (natural height) it is a near
	 *  square of the chart's width, up to PLOT_NATURAL_MAX. */
	const PLOT_MIN = 240;
	const PLOT_NATURAL_MAX = 560;

	const plotH = $derived(Math.max(PLOT_MIN, graphH - TOP - BOTTOM));
	const stripSide = $derived(graphW >= STRIP_SIDE_MIN);
	const stripW = $derived(
		stripSide ? clamp(Math.round(plotH * STRIP_PER_H), STRIP_MIN, STRIP_MAX) : 0
	);
	const strip = $derived({ x0: 0, w: stripW });
	const crX = $derived(stripSide ? stripW + STRIP_GAP : 0);
	/** Everything across the chart but the field. */
	const chromeW = $derived(crX + CR_TRACK + CR_GAP + TICK_W + TICK_GAP + AVG_W + PADR);
	const colMax = $derived(Math.round(plotH * FIELD_MAX_ASPECT + chromeW));
	const rect = $derived<FieldRect>({
		x0: crX + CR_TRACK + CR_GAP + TICK_W + TICK_GAP,
		y0: TOP,
		w: Math.max(80, graphW - chromeW),
		h: plotH
	});
	/** Below 1024px the stage has its natural height, so the chart's floor is
	 *  its height: a near square of its width. From 1024px the chart fills the
	 *  tile and the floor is only the least plot (CSS, `.cv-graph`). */
	const naturalMin = $derived(
		TOP + BOTTOM + clamp(Math.round(graphW * 0.8), PLOT_MIN, PLOT_NATURAL_MAX)
	);

	// The strip under the chart: a column per crit count across the field's
	// width, 0 at the left.
	const belowPeak = $derived(Math.max(...distribution));
	const belowColW = $derived(rect.w / distribution.length);
	const BELOW_AXIS = 14;
	function pickBelow(e: PointerEvent) {
		const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const k = Math.floor((e.clientX - box.left - rect.x0) / belowColW);
		hoverCount = k >= 0 && k < distribution.length ? k : null;
	}

	// ── Workspace handle (share + reset) ───────────────────────────────────

	export function reset() {
		myCR = 0.7;
		myCD = 1.4;
		shading = true;
		hitsPerRotation = 8;
		pinned = null;
		rollResult = null;
		hoverCount = null;
	}

	// ⚓ v1 still: the stage draws the CV line always, so `cvLine` is no longer
	// written, and an older state's is ignored.
	export function getShareState() {
		return {
			v: 1,
			cr: myCR,
			cd: myCD,
			variance: shading,
			hits: hitsPerRotation,
			pin: pinned ? [pinned.critRate, pinned.critDamage] : null
		};
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
		if (num(s.cr)) myCR = clamp(s.cr, CR_MIN, CR_MAX);
		if (num(s.cd)) myCD = clamp(s.cd, CD_MIN, CD_MAX);
		if (typeof s.variance === 'boolean') shading = s.variance;
		if (num(s.hits)) hitsPerRotation = Math.min(HITS_MAX, Math.max(HITS_MIN, Math.round(s.hits)));
		pinned =
			Array.isArray(s.pin) && num(s.pin[0]) && num(s.pin[1])
				? {
						critRate: clamp(s.pin[0], CR_MIN, CR_MAX),
						critDamage: clamp(s.pin[1], CD_MIN, CD_MAX)
					}
				: null;
	}
</script>

<!-- A strip row's sentence: "k of n hits crit", what that scores, and how often.
     A snippet, because its longest case also reserves the line's room. -->
{#snippet countLine(k: number, chance: string)}
	{k} of {hitsPerRotation}
	{hitsWord(hitsPerRotation)} crit:
	<strong>{formatMultiplier(rotationMultiplier(k, hitsPerRotation, myCD))}</strong>, in {chance} of rotations.
{/snippet}

<!-- THE CRIT RATE HANDLE (design §6): its name and field where the chart
     has room for them (over the y axis's numbers, ending at the field's left
     edge; on a phone beside CRIT DMG's, under the chart), its track always
     hung down the field's left from the chart column's top. The model holds
     fractions; the fields show percent. -->
{#snippet crHandle()}
	<div
		class="cv-cr"
		style:--cr-top="{topH + TOOLBAR_GAP + rect.y0 - THUMB_R}px"
		style:--cr-h="{rect.h * (1 - CR_MIN) + 2 * THUMB_R}px"
		style:--cr-w="{CR_TRACK}px"
		style:--cr-x="{crX}px"
		style:--cr-head-w={stripSide ? `${rect.x0 - TICK_GAP}px` : null}
	>
		<InstrumentSlider
			vertical
			label="CRIT Rate"
			aria="Crit rate"
			bind:value={myCR}
			min={CR_MIN}
			max={CR_MAX}
			step={0.005}
			scale={100}
			unit="%"
		/>
	</div>
{/snippet}

<!-- THE STAGE (design §6). One box: the chart head (your average per hit),
     the chart with every control on its top edge (CRIT Rate's field, the
     hits, the shading, Pin and Roll) and a handle on each axis, and the fine
     print. ⚓ Nate (2026-11-03): where the tile is wide, the head and the fine
     print are a column at the left edge and the chart stands beside them,
     so the field gets the tile's height. -->
<div class="stage-root">
	<div class="stage ctx-dark cv-stage">
		<p class="readout-head stage-head cv-head">
			{formatMultiplier(myMultiplier)}<span class="readout-sentence">average damage per hit</span>
		</p>

		<div
			class="cv-chart-col"
			style:--cv-col-max="{colMax}px"
			style:--cv-toolbar-gap="{TOOLBAR_GAP}px"
		>
			<!-- THE CHART'S TOOLBAR, on its top edge: nothing behind a popover,
			     since each setting is one value. CRIT Rate's name and field lead,
			     over its track; the track itself hangs down the chart's left. -->
			<div class="cv-toolbar" bind:clientHeight={topH}>
				{#if stripSide}{@render crHandle()}{/if}

				<!-- The hits: a short slider inline, its track the risk ramp (how the
				     no-crit chance falls as hits are added, at your CRIT Rate). -->
				<div class="cv-hits">
					<InstrumentSlider
						label="Hits per rotation"
						bind:value={hitsPerRotation}
						min={HITS_MIN}
						max={HITS_MAX}
						step={1}
						trackStyle="background-image: {riskGradient(myCR)}"
					/>
				</div>

				<!-- The chart tools: one group, so they wrap together and hold the
				     toolbar's far end. -->
				<div class="cv-tools">
					<button
						class="btn"
						class:is-active={shading}
						aria-pressed={shading}
						title="Darkens each CRIT Rate by its chance of a whole rotation without a single crit"
						onclick={() => (shading = !shading)}
					>
						No-crit shading
					</button>

					<!-- Pin and Roll: a mark and a word, the word gone where the tile is
				     narrow. Pin's two words share one cell, so it keeps one width. -->
					<button
						class="btn cv-tool"
						aria-pressed={!!pinned}
						aria-label={pinned ? 'Clear pin' : 'Pin this build'}
						onclick={() => (pinned = pinned ? null : { critRate: myCR, critDamage: myCD })}
					>
						<Mark name="pin" size={12} />
						<span class="cv-stack cv-tool-word" aria-hidden="true">
							<span class:cv-ghost={!!pinned}>Pin this build</span>
							<span class:cv-ghost={!pinned}>Clear pin</span>
						</span>
					</button>
					<button
						class="btn cv-tool"
						aria-label="Roll {hitsPerRotation} {hitsWord(hitsPerRotation)}"
						onclick={rollIt}
					>
						<Mark name="dice" size={12} />
						<span class="cv-tool-word" aria-hidden="true"
							>Roll {hitsPerRotation} {hitsWord(hitsPerRotation)}</span
						>
					</button>
				</div>
			</div>

			<div class="cv-graph-wrap">
				<div
					class="stage-graph instrument-graph cv-graph"
					style:--cv-natural-min="{naturalMin}px"
					style:--cv-fill-min="{TOP + BOTTOM + PLOT_MIN}px"
					bind:clientWidth={graphW}
					bind:clientHeight={graphH}
				>
					<CritHeatmap
						bind:critRate={myCR}
						bind:critDamage={myCD}
						bind:hoverCount
						width={graphW}
						height={rect.y0 + rect.h + BOTTOM}
						{rect}
						{strip}
						hits={hitsPerRotation}
						{distribution}
						{shading}
						{pinned}
						{pinnedDelta}
						{readCount}
					/>
				</div>

				<!-- THE CRIT DMG HANDLE, on the x axis. One decimal, as its field
				     always had: a marker dragged on the field lands between whole
				     percents. -->
				<div
					class="stage-handle"
					class:cv-handles={!stripSide}
					style:--stage-handle-l="{rect.x0 - THUMB_R}px"
					style:--stage-handle-r="{graphW - rect.x0 - rect.w - THUMB_R}px"
				>
					<InstrumentSlider
						label="CRIT DMG"
						aria="Crit damage"
						bind:value={myCD}
						min={CD_MIN}
						max={CD_MAX}
						step={0.01}
						scale={100}
						decimals={1}
						unit="%"
					/>
					{#if !stripSide}{@render crHandle()}{/if}
				</div>

				<!-- The strip under the chart, where the chart is too narrow for it
				     beside the field: a column per crit count, 0 to the hits. -->
				{#if !stripSide}
					<svg
						class="cv-strip-below"
						width={graphW}
						height={STRIP_BELOW_H}
						aria-hidden="true"
						onpointerdown={pickBelow}
						onpointermove={(e) => e.pointerType === 'mouse' && pickBelow(e)}
						onpointerleave={(e) => e.pointerType === 'mouse' && (hoverCount = null)}
					>
						{#each distribution as chance, k (k)}
							{@const h = belowPeak > 0 ? (chance / belowPeak) * (STRIP_BELOW_H - BELOW_AXIS) : 0}
							<rect
								x={rect.x0 + k * belowColW + belowColW * 0.14}
								y={STRIP_BELOW_H - BELOW_AXIS - h}
								width={belowColW * 0.72}
								height={h}
								rx="1"
								fill={readCount === k ? 'var(--text)' : 'var(--chart-ink)'}
								fill-opacity={readCount === k ? 1 : 0.45}
							/>
						{/each}
						<line
							x1={rect.x0}
							y1={STRIP_BELOW_H - BELOW_AXIS}
							x2={rect.x0 + rect.w}
							y2={STRIP_BELOW_H - BELOW_AXIS}
							stroke="var(--chart-rule)"
						/>
						<text
							x={rect.x0 + belowColW / 2}
							y={STRIP_BELOW_H - 2}
							fill="var(--chart-ink)"
							font-size="10"
							text-anchor="middle">0</text
						>
						<text
							x={rect.x0 + rect.w - belowColW / 2}
							y={STRIP_BELOW_H - 2}
							fill="var(--chart-ink)"
							font-size="10"
							text-anchor="middle">{hitsPerRotation}</text
						>
						<text
							x={rect.x0 + rect.w / 2}
							y={STRIP_BELOW_H - 2}
							fill="var(--chart-dim)"
							font-size="10"
							text-anchor="middle"
						>
							crits in {hitsPerRotation}
							{hitsWord(hitsPerRotation)}
						</text>
					</svg>
				{/if}
			</div>
		</div>

		<!-- The fine print: the strip read (a hover, a tap or a roll), over a
		     ghost of its longest form, so reading never moves the stage. -->
		<div class="stage-fine cv-fine">
			<p class="cv-stack" aria-live="polite">
				<span>
					{#if hoverCount !== null}
						{@render countLine(hoverCount, formatChance(distribution[hoverCount]))}
					{:else if rollResult}
						{rollCrits} of {rollResult.length}
						{hitsWord(rollResult.length)} crit:
						<strong
							>{formatMultiplier(rotationMultiplier(rollCrits, rollResult.length, myCD))}</strong
						>
						this time.
						{#key rollNonce}
							<span class="cv-roll-dots" aria-hidden="true">
								{#each rollResult as crit, i (i)}
									<span
										class="cv-roll-dot"
										class:cv-roll-crit={crit}
										style:animation-delay="{i * 45}ms"
									></span>
								{/each}
							</span>
						{/key}
					{:else}
						A hit that doesn’t crit is ×1. On average {averageCrits.toFixed(1)} of {hitsPerRotation}
						{hitsWord(hitsPerRotation)} crit, and {formatChance(zeroCritRisk)} of rotations land none.
					{/if}
				</span>
				<span class="cv-ghost" aria-hidden="true">
					A hit that doesn’t crit is ×1. On average 59.4 of 60 hits crit, and &lt;0.1% of rotations
					land none.
				</span>
			</p>
			<!-- ⚓ TOTAL, on purpose (Nate 2026-10-02): a KQM reader takes a bare
			     "280 CV" for artifact CV, where 280 is near impossible. -->
			<p>
				Each curve joins the builds with one average, read on the right edge. The straight line is
				every build with your {Math.round(critValue(myCR, myCD) * 100)} total crit value (CV), 2 × CRIT
				Rate + CRIT DMG with base crit stats included, and its ring is that budget’s best split: press
				it to move there. Hover or tap a bar to read one rotation.
			</p>
		</div>
	</div>
</div>

<style>
	/* ── The stacked form: the head, the chart, the fine print ── */
	.cv-chart-col {
		/* the CRIT Rate track's containing block (it hangs from this top) */
		position: relative;
		display: flex;
		flex-direction: column;
		flex: 1 0 auto;
		gap: var(--cv-toolbar-gap);
		min-width: 0;
	}
	/* The column is no wider than the field at FIELD_MAX_ASPECT needs (the
	   script measures it), and centred in what it has. From 1024px only, where
	   the tile's height is definite (breakpoints.test.ts names the stop). */
	@media (min-width: 1024px) {
		.cv-chart-col {
			width: min(100%, var(--cv-col-max));
			align-self: center;
		}
	}

	/* ── The side form (⚓ Nate 2026-11-03): from a 60rem tile the head and
	   the fine print are a column at the stage's left edge, and the chart
	   stands beside them at the tile's full height, centred in the rest. ── */
	@container instrument (min-width: 60rem) {
		.cv-stage {
			display: grid;
			grid-template-columns: var(--cv-side-w, 17rem) minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr);
			grid-template-areas:
				'head chart'
				'fine chart';
			column-gap: 2.5rem;
			row-gap: 1rem;
		}
		.cv-head {
			grid-area: head;
			/* the figure over its sentence, in a column this narrow */
			display: block;
			white-space: normal;
		}
		.cv-head :global(.readout-sentence) {
			margin-top: 0.15rem;
		}
		.cv-chart-col {
			grid-area: chart;
			/* ⚠ In the grid, align-self is the block axis: stretch to the
			   stage's height, and centre across instead. */
			align-self: stretch;
			justify-self: center;
		}
		.cv-fine {
			grid-area: fine;
		}
	}

	/* ── The toolbar on the chart's top edge ── */
	.cv-toolbar {
		/* Pin and Roll drop their words by the toolbar's own width: the chart's
		   column is narrower than the tile in the side form. */
		container: cv-toolbar / inline-size;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
	}

	/* CRIT Rate: its name and field in the toolbar, its track hung down the
	   chart's left edge from 100% to 5%, the lowest a build can have, between
	   the strip and the y axis's numbers. The column is the containing block. */
	.cv-cr :global(.slider-control) {
		display: block;
	}
	.cv-cr :global(.slider-header) {
		justify-content: flex-start;
		gap: 0.5rem;
	}
	/* Beside the field: the name and field end at the field's left edge, over
	   the y axis's numbers (⚓ Nate 2026-11-03), and grow leftward if they
	   must. */
	.cv-toolbar .cv-cr {
		display: flex;
		justify-content: flex-end;
		min-width: var(--cr-head-w);
	}

	/* On a phone, CRIT Rate's name and field sit beside CRIT DMG's under the
	   chart (⚓ Nate): the CRIT DMG track across, then the two names. Both
	   sliders' boxes dissolve into this grid; CRIT Rate's track stays hung
	   from the column. */
	.cv-handles {
		display: grid;
		grid-template-columns: auto auto;
		grid-template-areas:
			'cd-track cd-track'
			'cr-head cd-head';
		justify-content: start;
		column-gap: 1rem;
		row-gap: var(--inst-gap-in, 0.5rem);
		/* The names take the stage's full width; only the track keeps the
		   inset that puts its thumb on the marker's line. */
		padding-inline: 0;
	}
	.cv-handles > :global(.slider-control > .is-track) {
		margin-inline: var(--stage-handle-l) var(--stage-handle-r);
	}
	.cv-handles :global(.slider-header) {
		gap: 0.35rem;
	}
	.cv-handles :global(.slider-label) {
		white-space: nowrap;
	}
	.cv-handles :global(.slider-control),
	.cv-handles .cv-cr {
		display: contents;
	}
	.cv-handles > :global(.slider-control > .is-track) {
		grid-area: cd-track;
	}
	.cv-handles > :global(.slider-control > .slider-header) {
		grid-area: cd-head;
	}
	.cv-handles .cv-cr :global(.slider-header) {
		grid-area: cr-head;
	}
	.cv-cr :global(.is-track) {
		position: absolute;
		top: var(--cr-top);
		left: var(--cr-x);
		width: var(--cr-w);
		height: var(--cr-h);
		justify-items: center;
		/* ⚠ Over the chart: the track comes first in the page and hangs over
		   the chart's box, whose SVG would otherwise take its presses. */
		z-index: 1;
	}

	/* The hits: name, field, then a short track, on one line. */
	.cv-hits :global(.slider-control) {
		grid-template-columns: auto minmax(5rem, 8rem);
		align-items: center;
		column-gap: 0.75rem;
	}
	.cv-hits :global(.slider-header) {
		justify-content: flex-start;
		gap: 0.5rem;
	}

	/* The chart tools hold the toolbar's far end, and wrap as one. */
	.cv-tools {
		display: flex;
		gap: 0.5rem;
		margin-left: auto;
	}
	.cv-tool {
		gap: 0.4rem;
	}
	/* 🎛️ Below the width the whole row needs with its words (measured about
	   836px), Pin and Roll keep their marks alone. */
	@container cv-toolbar (max-width: 52rem) {
		.cv-tool .cv-tool-word {
			display: none;
		}
	}

	/* The chart box and the CRIT DMG handle under it: one unit, so the
	   column's gap doesn't fall between the chart and its handle. */
	.cv-graph-wrap {
		display: flex;
		flex-direction: column;
		flex: 1 0 auto;
		gap: var(--inst-gap-control);
	}

	.cv-graph {
		position: relative;
		min-height: var(--cv-natural-min);
	}
	/* The tile is a size container from 1024px (breakpoints.test.ts names the
	   stop), and the stage its height: the chart takes what the rest leave. */
	@media (min-width: 1024px) {
		.cv-graph {
			min-height: var(--cv-fill-min);
		}
	}

	.cv-strip-below {
		display: block;
		margin-top: 0.25rem;
		touch-action: pan-y;
	}

	.cv-fine {
		display: grid;
		gap: 0.25rem;
		align-content: start;
	}
	.cv-fine p {
		margin: 0;
	}
	.cv-fine strong {
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	/* A swapping text over its longest form, in one cell (design §4). The
	   ghost is aria-hidden, and hidden ink leaves the accessible name too. */
	.cv-stack {
		display: grid;
	}
	.cv-stack > :global(*) {
		grid-area: 1 / 1;
	}
	.cv-ghost {
		visibility: hidden;
	}

	/* One rolled rotation: a hit that didn't crit is a ring, a crit the same
	   ink filled. ⚠ The ring is an inset shadow: Chrome floors a 1.5px border
	   to 1px. */
	.cv-roll-dots {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-left: 0.4rem;
		vertical-align: -1px;
	}
	.cv-roll-dot {
		width: 9px;
		height: 9px;
		border-radius: var(--r-round);
		box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--chart-ink) 70%, transparent);
		animation: cv-dot-in 260ms ease-out backwards;
	}
	.cv-roll-crit {
		background: var(--text);
		box-shadow: none;
	}
	@keyframes cv-dot-in {
		from {
			transform: scale(0.2);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
	/* A keyframe, so reduced motion is honoured by hand. */
	@media (prefers-reduced-motion: reduce) {
		.cv-roll-dot {
			animation: none;
		}
	}
</style>
