<script lang="ts">
	import {
		BANNERS,
		cdfAt,
		cdfStats,
		clampPity,
		copiesCdfs,
		sumCdf,
		type BannerDef,
		type BannerId
	} from './wish';

	// ── What you're pulling for ──────────────────────────────────────────────
	// `pair` is a 5★ character AND their weapon: two banners, two pities, and
	// the total is the sum of the pulls each goal takes on its own.
	type Target = 'character' | 'fourStar' | 'weapon' | 'pair';
	const TARGETS: { id: Target; label: string }[] = [
		{ id: 'character', label: 'Featured 5★' },
		{ id: 'fourStar', label: 'Featured 4★' },
		{ id: 'weapon', label: 'Charted weapon' },
		{ id: 'pair', label: '5★ and weapon' }
	];

	/** One banner's state. `have`/`goal` count COPIES: 0 = not owned, 1 = C0 (or R1). */
	type BannerState = { pity: number; guaranteed: boolean; have: number; goal: number };
	const fresh = (): BannerState => ({ pity: 0, guaranteed: false, have: 0, goal: 1 });

	const DEFAULT_PULLS = 90;
	let target = $state<Target>('character');
	let pulls = $state(DEFAULT_PULLS);
	const states = $state<Record<BannerId, BannerState>>({
		character: fresh(),
		fourStar: fresh(),
		weapon: fresh()
	});

	/** C6 is the 7th copy; R5 the 5th. */
	const maxCopies = (id: BannerId) => (id === 'weapon' ? 5 : 7);
	const levelName = (id: BannerId, copies: number) =>
		id === 'weapon' ? `R${copies}` : `C${copies - 1}`;
	const haveName = (id: BannerId, copies: number) =>
		copies === 0 ? 'Not owned' : levelName(id, copies);

	function setHave(id: BannerId, copies: number) {
		const s = states[id];
		s.have = copies;
		if (s.goal <= copies) s.goal = copies + 1;
	}

	const blocks = $derived<BannerId[]>(target === 'pair' ? ['character', 'weapon'] : [target]);

	// ── The curves: one per level up to the goal, or (pair) each goal + both ─
	type Curve = { label: string; cdf: number[]; primary: boolean };

	function levelCurves(id: BannerId): Curve[] {
		const s = states[id];
		const banner = BANNERS[id];
		const need = s.goal - s.have;
		const cdfs = copiesCdfs(banner, need, s.pity, s.guaranteed);
		return Array.from({ length: need }, (_, i) => ({
			label: levelName(id, s.have + i + 1),
			cdf: cdfs[i + 1],
			primary: i + 1 === need
		}));
	}

	const curves = $derived.by<Curve[]>(() => {
		if (target !== 'pair') return levelCurves(target);
		const c = levelCurves('character').at(-1)!;
		const w = levelCurves('weapon').at(-1)!;
		return [
			{ ...c, primary: false },
			{ ...w, primary: false },
			{ label: `${c.label}${w.label}`, cdf: sumCdf(c.cdf, w.cdf), primary: true }
		];
	});
	const goal = $derived(curves.find((c) => c.primary)!);
	const rows = $derived(
		curves.map((c) => ({ ...c, stats: cdfStats(c.cdf), chance: cdfAt(c.cdf, pulls) }))
	);
	const goalRow = $derived(rows.find((r) => r.primary)!);

	// The axis runs to where the goal is 99.9% done, in whole tens — the 4★
	// chain never strictly ends, and the slider's ceiling follows it.
	const domain = $derived.by(() => {
		let n = goal.cdf.findIndex((p) => p >= 0.999);
		if (n < 0) n = goal.cdf.length - 1;
		return Math.max(10, Math.ceil(n / 10) * 10);
	});
	const shownPulls = $derived(Math.min(pulls, domain));

	// Soft pity, only where it reads: the very next 5★ copy on one banner.
	const softAt = $derived.by(() => {
		if (target === 'pair' || target === 'fourStar' || curves.length !== 1) return 0;
		const b = BANNERS[target];
		return b.softStart - clampPity(b, states[target].pity);
	});

	// ── Geometry ─────────────────────────────────────────────────────────────
	let graphW = $state(720);
	const PADL = 58;
	const PADR = 16;
	const TOP = 16;
	const PLOT_H = 230;
	const plotY1 = TOP + PLOT_H;
	const H = plotY1 + 30;
	/** Axis labels stay at least this far apart (as in the ICD Timeline). */
	const MIN_TICK_PX = 44;
	const TICK_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500];

	const plotW = $derived(Math.max(1, graphW - PADL - PADR));
	const xOf = $derived((k: number) => PADL + (k / domain) * plotW);
	const yOf = (p: number) => plotY1 - p * (PLOT_H - 8);

	const xTicks = $derived.by(() => {
		const step = TICK_STEPS.find((s) => (s / domain) * plotW >= MIN_TICK_PX) ?? TICK_STEPS.at(-1)!;
		return Array.from({ length: Math.floor(domain / step) + 1 }, (_, i) => i * step);
	});

	function pathOf(cdf: number[]) {
		let d = `M${xOf(0).toFixed(1)},${yOf(0).toFixed(1)}`;
		for (let k = 1; k <= domain; k++)
			d += ` L${xOf(k).toFixed(1)},${yOf(cdfAt(cdf, k)).toFixed(1)}`;
		return d;
	}

	// Each curve is named where it crosses a height, just left of the line.
	// Levels of one goal cross 50% in order; a pair's two goals cross at 75%
	// and 25% so their (often equal) medians don't print on top of each other.
	/** Clear space kept between two labels on one row. */
	const LABEL_PAD_PX = 5;
	/** A condensed 11px glyph, generously — only decides which side a label sits. */
	const LABEL_CHAR_PX = 7;
	const labels = $derived.by(() => {
		const heights = target === 'pair' ? [0.75, 0.25, 0.5] : curves.map(() => 0.5);
		const placed = curves.map((c, i) => {
			const h = heights[i];
			const k = c.cdf.findIndex((p) => p >= h);
			const x = xOf(k < 0 ? domain : k);
			const w = c.label.length * LABEL_CHAR_PX;
			// a label that would run into the y axis's numbers goes right of its line
			const right = x - 6 - w < PADL;
			const x0 = right ? x + 6 : x - 6 - w;
			return {
				text: c.label,
				x: right ? x + 6 : x - 6,
				y: yOf(h) + 3.5,
				anchor: right ? 'start' : 'end',
				primary: c.primary,
				x0,
				x1: x0 + w
			};
		});
		// A crowded fan keeps the goal's label first, then each other label that
		// clears every one already kept on its row.
		const kept: typeof placed = [];
		for (const l of [...placed].sort((a, b) => Number(b.primary) - Number(a.primary))) {
			const clear = kept.every(
				(k) => k.y !== l.y || l.x1 + LABEL_PAD_PX < k.x0 || k.x1 + LABEL_PAD_PX < l.x0
			);
			if (clear) kept.push(l);
		}
		return kept;
	});

	// Drag scrubs the pulls-saved marker
	let scrubbing = $state(false);
	function markerFrom(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (e.clientX - rect.left - PADL) / plotW));
		pulls = Math.round(frac * domain);
	}
	function onDown(e: PointerEvent) {
		scrubbing = true;
		markerFrom(e);
		(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
	}
	function onMove(e: PointerEvent) {
		if (scrubbing) markerFrom(e);
	}
	function onUp(e: PointerEvent) {
		scrubbing = false;
		const el = e.currentTarget as SVGSVGElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}

	const fmtPct = (p: number, digits = 1) => {
		// never print a certainty the model doesn't have, nor a zero it doesn't either
		const s = (p * 100).toFixed(digits);
		if (p < 1 && Number(s) >= 100) return `>${(100 - 10 ** -digits).toFixed(digits)}%`;
		if (p > 0 && Number(s) <= 0) return `<${(10 ** -digits).toFixed(digits)}%`;
		return `${s}%`;
	};
	const pullsPhrase = (n: number) => (n === 1 ? '1 pull' : `${n} pulls`);

	const RULES: Record<BannerId, { kicker: string; pityAria: string; guarantee: string }> = {
		character: {
			kicker: 'Character Event',
			pityAria: 'Pulls since your last five-star',
			guarantee: 'Guarantee held (lost the last 50/50)'
		},
		fourStar: {
			kicker: 'Character Event',
			pityAria: 'Pulls since your last four-star',
			guarantee: 'Guarantee held (last 4★ wasn’t featured)'
		},
		weapon: {
			kicker: 'Weapon Event',
			pityAria: 'Pulls since your last five-star weapon',
			guarantee: 'Fate point held'
		}
	};

	// ── Workspace handle (share + reset) ─────────────────────────────────────
	export function reset() {
		target = 'character';
		pulls = DEFAULT_PULLS;
		for (const id of Object.keys(states) as BannerId[]) states[id] = fresh();
	}

	export function getShareState() {
		return { v: 2, target, pulls, banners: $state.snapshot(states) };
	}

	function readBanner(id: BannerId, raw: unknown) {
		if (typeof raw !== 'object' || raw === null) return;
		const r = raw as Record<string, unknown>;
		const b: BannerDef = BANNERS[id];
		const int = (v: unknown, lo: number, hi: number) =>
			typeof v === 'number' && Number.isFinite(v)
				? Math.min(hi, Math.max(lo, Math.round(v)))
				: undefined;
		const s = fresh();
		s.pity = int(r.pity, 0, b.hard - 1) ?? 0;
		s.guaranteed = r.guaranteed === true;
		s.have = int(r.have, 0, maxCopies(id) - 1) ?? 0;
		s.goal = Math.max(s.have + 1, int(r.goal, 1, maxCopies(id)) ?? 1);
		states[id] = s;
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		const readPulls = (v: unknown) => {
			if (typeof v === 'number' && Number.isFinite(v))
				pulls = Math.min(2000, Math.max(0, Math.round(v)));
		};
		// v1 (before 2026-10-04): one featured item, `banner` + flat state
		if (s.v === 1) {
			reset();
			const id: BannerId = s.banner === 'weapon' ? 'weapon' : 'character';
			target = id;
			readBanner(id, s);
			readPulls(s.pulls);
			return;
		}
		if (s.v !== 2) return;
		if (TARGETS.some((t) => t.id === s.target)) target = s.target as Target;
		const banners = (s.banners ?? {}) as Record<string, unknown>;
		for (const id of Object.keys(states) as BannerId[]) readBanner(id, banners[id]);
		readPulls(s.pulls);
	}
</script>

<div class="instrument">
	<div class="wi-chart ctx-dark">
		<div class="wi-graph" bind:clientWidth={graphW}>
			<svg
				width={graphW}
				height={H}
				role="img"
				aria-label="Chance of reaching each level within a number of pulls"
				onpointerdown={onDown}
				onpointermove={onMove}
				onpointerup={onUp}
				onpointercancel={onUp}
				style:cursor="ew-resize"
			>
				<!-- X grid (pulls from now) -->
				{#each xTicks as t (t)}
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
					y={plotY1 + 27}
					fill="var(--chart-dim)"
					font-size="10"
					text-anchor="end"
				>
					pulls from now
				</text>

				<!-- Y grid: cumulative chance -->
				{#each [0.25, 0.5, 0.75, 1] as p (p)}
					<line
						x1={PADL}
						y1={yOf(p)}
						x2={graphW - PADR}
						y2={yOf(p)}
						stroke={p === 1 ? 'var(--chart-rule)' : 'var(--chart-grid)'}
					/>
					<text
						x={PADL - 7}
						y={yOf(p) + 3.5}
						fill="var(--chart-ink)"
						font-size="10"
						text-anchor="end"
					>
						{Math.round(p * 100)}%
					</text>
				{/each}
				<text x="4" y={TOP - 4} fill="var(--chart-dim)" font-size="10" text-anchor="start">
					chance by then
				</text>

				{#if softAt > 0 && softAt < domain}
					<line
						x1={xOf(softAt)}
						y1={TOP}
						x2={xOf(softAt)}
						y2={plotY1}
						stroke="var(--chart-rule)"
						stroke-dasharray="4 4"
					/>
					<text
						class="wi-word"
						x={xOf(softAt) + 5}
						y={TOP + 11}
						fill="var(--chart-dim)"
						font-size="10"
					>
						soft pity
					</text>
				{/if}

				<!-- One line per level; the goal's is the bold one -->
				{#each curves as c (c.label)}
					<path
						d={pathOf(c.cdf)}
						fill="none"
						stroke={c.primary ? 'var(--text)' : 'var(--chart-ink)'}
						stroke-width={c.primary ? 2 : 1.25}
						stroke-linejoin="round"
					/>
				{/each}
				{#each labels as l (l.text)}
					<text
						class="wi-word"
						x={l.x}
						y={l.y}
						fill={l.primary ? 'var(--text)' : 'var(--chart-ink)'}
						font-size="11"
						font-weight={l.primary ? 600 : 400}
						text-anchor={l.anchor}
					>
						{l.text}
					</text>
				{/each}

				<!-- Pulls-saved marker: a dot where it crosses each line -->
				<line
					x1={xOf(shownPulls)}
					y1={TOP}
					x2={xOf(shownPulls)}
					y2={plotY1}
					stroke="var(--chart-ink)"
					stroke-width="1.5"
				/>
				{#each rows as r (r.label)}
					<circle
						cx={xOf(shownPulls)}
						cy={yOf(r.chance)}
						r={r.primary ? 4.5 : 3}
						fill={r.primary ? 'var(--accent)' : 'var(--chart-ink)'}
						style="stroke: var(--frame-bg)"
						stroke-width="1.5"
					/>
				{/each}
				<text
					class="wi-word"
					x={xOf(shownPulls) + (shownPulls > domain * 0.7 ? -8 : 8)}
					y={Math.max(TOP + 12, yOf(goalRow.chance) - 10)}
					fill="var(--text)"
					font-size="11"
					font-weight="600"
					text-anchor={shownPulls > domain * 0.7 ? 'end' : 'start'}
				>
					{fmtPct(goalRow.chance, 0)}
				</text>
			</svg>
		</div>
	</div>

	<!-- ONE panel, a section per question: what you're pulling for, then each
	     banner it touches. Sections stack in a shared tile and sit side by side
	     in a wide one (see the container queries). -->
	<div class="panel wi-controls">
		<section class="wi-section">
			<p class="kicker">Pulling for</p>
			<div class="chips wi-targets" role="group" aria-label="Pulling for">
				{#each TARGETS as t (t.id)}
					<button
						class="chip chip--control"
						class:active={target === t.id}
						aria-pressed={target === t.id}
						onclick={() => (target = t.id)}
					>
						{t.label}
					</button>
				{/each}
			</div>
			<div class="slider-control">
				<div class="slider-header">
					<span class="slider-label">Pulls saved</span>
					<span class="readout">{pulls}</span>
				</div>
				<input
					type="range"
					min="0"
					max={Math.max(domain, pulls)}
					step="1"
					bind:value={pulls}
					class="slider"
					aria-label="Pulls you have saved"
				/>
			</div>
			<p class="note">Or drag across the chart.</p>
		</section>

		{#each blocks as id (id)}
			{@const s = states[id]}
			{@const b = BANNERS[id]}
			<section class="wi-section">
				<p class="kicker">{RULES[id].kicker}</p>
				<div class="wi-levels">
					<span class="slider-label" id="wi-have-{id}">You have</span>
					<div class="chips wi-level-chips" role="group" aria-labelledby="wi-have-{id}">
						{#each Array.from({ length: maxCopies(id) }, (_, i) => i) as copies (copies)}
							<button
								class="chip chip--control"
								class:active={s.have === copies}
								aria-pressed={s.have === copies}
								onclick={() => setHave(id, copies)}
							>
								{haveName(id, copies)}
							</button>
						{/each}
					</div>
					<span class="slider-label" id="wi-goal-{id}">Aiming for</span>
					<div class="chips wi-level-chips" role="group" aria-labelledby="wi-goal-{id}">
						{#each Array.from({ length: maxCopies(id) }, (_, i) => i + 1) as copies (copies)}
							<button
								class="chip chip--control"
								class:active={s.goal === copies}
								aria-pressed={s.goal === copies}
								disabled={copies <= s.have}
								onclick={() => (states[id].goal = copies)}
							>
								{levelName(id, copies)}
							</button>
						{/each}
					</div>
				</div>
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Current pity</span>
						<span class="readout">{clampPity(b, s.pity)}</span>
					</div>
					<input
						type="range"
						min="0"
						max={b.hard - 1}
						step="1"
						bind:value={states[id].pity}
						class="slider"
						aria-label={RULES[id].pityAria}
					/>
				</div>
				<label class="check">
					<input type="checkbox" bind:checked={states[id].guaranteed} />
					<span class="check-box"></span>
					{RULES[id].guarantee}
				</label>
				{#if id === 'character'}
					<p class="note">
						Without a guarantee, you’ll win the 50/50 about 55% of the time (the official rate,
						including Capturing Radiance).
						<span class="wi-fine"
							>Capturing Radiance’s exact rules aren’t public, so every 50/50 here is a flat 55%.</span
						>
					</p>
				{:else if id === 'fourStar'}
					<p class="note">
						Without a guarantee, each 4★ you pull has a 16.7% chance to be the featured character
						you want. If your last 4★ wasn’t featured, that goes up to 33.3%. Over many pulls, it
						averages out to about 22%.
						<span class="wi-fine"
							>Losing the 50/50 never gives you one of the three, even if they’re already on the
							standard banner.</span
						>
					</p>
				{:else}
					<p class="note">
						Without a fate point, each 5★ you pull has a 37.5% chance to be the weapon you charted,
						37.5% to be the other featured weapon, and 25% to be a standard 5★ weapon.
					</p>
				{/if}
			</section>
		{/each}
	</div>

	<div class="panel panel--paper wi-readout">
		<p class="kicker">Readout</p>
		<p class="wi-big">
			{fmtPct(goalRow.chance)}<span class="wi-big-unit"
				>chance of {goalRow.label} within {pullsPhrase(pulls)}</span
			>
		</p>
		<table class="wi-table">
			<thead>
				<tr>
					<th scope="col">Level</th>
					<th scope="col" class="wi-num">Chance</th>
					<th scope="col" class="wi-num">Half by</th>
					<th scope="col" class="wi-num">Unlucky tenth</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.label)}
					<tr class:is-goal={r.primary}>
						<th scope="row">{r.label}</th>
						<td class="wi-num">{fmtPct(r.chance, 0)}</td>
						<td class="wi-num">{r.stats.median}</td>
						<td class="wi-num">{r.stats.p90}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="wi-meta">
			On average, {goalRow.label} would take
			<span class="wi-strong">{Math.round(goalRow.stats.mean)}</span> pulls from here.
		</p>
		<p class="note">
			Half by: half of players get there within this many pulls. Unlucky tenth: the unluckiest 10%
			of players need this many or more.
			{#if target === 'pair'}
				Your character and weapon banners keep separate pity, so this adds the pulls for both.
			{/if}
		</p>
	</div>
</div>

<style>
	/* No frame — the chart is on the night; .ctx-dark stays claimed for
	   --frame-bg. See .gx-chart / app.css's `.frame` retirement note. */
	.wi-chart {
		min-width: 0;
	}

	.wi-graph svg {
		display: block;
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
	}

	.wi-graph text {
		font-family: var(--font-body);
	}

	.wi-graph text.wi-word {
		font-family: var(--font-condensed);
	}

	/* ⚓ Its own grid column, not `.instrument`'s AUTO one (instrument passes
	   2026-10-01 §4): an auto column grows to its widest unbreakable child. */
	.instrument {
		grid-template-columns: minmax(0, 1fr);
	}

	/* Label above its chips: a row of eight needs the panel's whole width */
	.wi-levels {
		display: grid;
		gap: 0.35rem;
	}

	.wi-levels .wi-level-chips + .slider-label {
		margin-top: 0.4rem;
	}

	.wi-level-chips {
		gap: 0.2rem;
	}

	.wi-level-chips :global(.chip) {
		font-family: var(--font-condensed);
		text-transform: none;
		letter-spacing: var(--ls-mid);
		/* tight enough that "Not owned … C5" holds one row in half a shared tile, down
		   to two tiles at 1360 (272px for the row) */
		padding-inline: 0.35rem;
	}

	.wi-big {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	/* Its own line: beside the number it broke mid-phrase in a narrow Readout */
	.wi-big-unit {
		display: block;
		margin-top: 0.15rem;
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.wi-table {
		width: 100%;
		margin: 0.75rem 0 0.5rem;
		border-collapse: collapse;
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
		font-variant-numeric: tabular-nums;
	}

	.wi-table thead th {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--muted);
		text-align: left;
		padding: 0 0.5rem 0.3rem;
	}

	.wi-table tbody th,
	.wi-table tbody td {
		padding: 0.25rem 0.5rem;
		border-top: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
		vertical-align: baseline;
	}

	.wi-table tbody th {
		text-align: left;
		font-weight: inherit;
		font-family: var(--font-condensed);
	}

	.wi-table tr.is-goal {
		font-weight: var(--fw-semibold);
	}

	.wi-num,
	.wi-table thead th.wi-num {
		text-align: right;
		white-space: nowrap;
	}

	.wi-meta {
		margin: 0;
		font-size: var(--fs-xl);
		line-height: 1.5rem;
		color: var(--muted);
	}

	.wi-strong {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.wi-fine {
		display: block;
		font-size: var(--fs-md);
		color: color-mix(in srgb, var(--muted) 70%, transparent);
	}

	/* One panel, its sections stacked (⚓ Nate, 2026-10-04: a shared tile
	   split the banner panels around "Pulling for" when they were separate). */
	.wi-controls {
		display: grid;
		gap: 1.25rem 1.5rem;
		align-content: start;
	}

	/* Each section keeps the panel's own rhythm (`.panel` is a 0.7rem grid) —
	   as plain blocks, what followed a slider sat right on its track. */
	.wi-section {
		display: grid;
		gap: 0.7rem;
		align-content: start;
	}

	/* ══ SHARED: the Readout sits BESIDE the controls, under a full-width
	   chart, at an even split (⚓ Nate, 2026-10-04 — a column sized to its
	   chips changed width with the target). Below this it can't: the level
	   table needs ~15rem of its own. */
	@container instrument (min-width: 38rem) {
		.instrument {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-template-areas:
				'chart chart'
				'controls readout';
		}

		.wi-chart {
			grid-area: chart;
		}

		.wi-controls {
			grid-area: controls;
			align-self: start;
		}

		/* ⚠️ Named, never auto-placed: without its area the Readout landed in
		   the chart's row in the wide layout, and its height stretched that row
		   and pushed the panel down (⚓ Nate, 2026-10-04). */
		.wi-readout {
			grid-area: readout;
			align-self: start;
		}
	}

	/* ══ WIDE: THE READOUT IS A COLUMN — the Crit Heatmap's, Gauge Explorer's
	   and ICD Timeline's layout — and the sections sit side by side. */
	@container instrument (min-width: 60rem) {
		.instrument {
			grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
			grid-template-rows: auto minmax(0, 1fr);
			grid-template-areas:
				'chart readout'
				'controls readout';
			align-content: stretch;
		}

		/* "Pulling for" is a narrow column of stacked chips, so each banner
		   section keeps the width for its eight level chips on one row. */
		.wi-controls {
			grid-template-columns: 11rem repeat(auto-fit, minmax(17.5rem, 1fr));
		}

		.wi-targets {
			flex-direction: column;
			align-items: flex-start;
		}

		.wi-readout {
			align-self: stretch;
			align-content: start;
		}
	}
</style>
