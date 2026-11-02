<script lang="ts">
	import {
		BANNERS,
		cdfAt,
		cdfStats,
		clampPity,
		copiesCdfs,
		RADIANCE_CHANCE,
		sumCdf,
		worstCasePulls,
		type BannerDef,
		type BannerId,
		type RadianceCounter
	} from './wish';
	import {
		RADIANCE_SINCE,
		readPaimonExport,
		replay,
		type ImportError,
		type ImportResult,
		type ReplayStep
	} from './wishHistory';

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

	/**
	 * One banner's state. `have`/`goal` count COPIES: 0 = not owned, 1 = C0 (or
	 * R1). `counter` is Capturing Radiance's (character banner only); null is
	 * "Don't know", which takes every 50/50 as the official 55%.
	 */
	type BannerState = {
		pity: number;
		guaranteed: boolean;
		have: number;
		goal: number;
		counter: RadianceCounter | null;
	};
	const fresh = (): BannerState => ({
		pity: 0,
		guaranteed: false,
		have: 0,
		goal: 1,
		counter: null
	});
	const COUNTERS: (RadianceCounter | null)[] = [null, 0, 1, 2, 3];

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
		const cdfs = copiesCdfs(banner, need, s.pity, s.guaranteed, s.counter);
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

	// The most the goal can take (null: nothing caps a featured 4★). A pair's
	// two banners are pulled one after the other, so their worst cases add.
	function worstOf(id: BannerId) {
		const s = states[id];
		return worstCasePulls(BANNERS[id], s.goal - s.have, s.pity, s.guaranteed, s.counter);
	}
	const worst = $derived.by(() => {
		if (target !== 'pair') return worstOf(target);
		const c = worstOf('character');
		const w = worstOf('weapon');
		return c === null || w === null ? null : c + w;
	});

	// ── The Radiance counter from a wish history ─────────────────────────────
	// Two sources, one replay (wishHistory.ts): a Paimon.moe export, or the 5★s
	// the player lists by hand. Either one sets the counter and the guarantee;
	// the export also sets pity.
	const dateFmt = new Intl.DateTimeFormat('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});
	/** A wish history's 'YYYY-MM-DD HH:mm:ss' (server time) as "June 14, 2025". */
	const dayOf = (time: string) => dateFmt.format(new Date(`${time.slice(0, 10)}T00:00:00Z`));

	/** The steps since the last certain Radiance: all the counter depends on. */
	function sinceRadiance(steps: ReplayStep[]) {
		const i = steps.findLastIndex((s) => s.kind === 'radiance');
		return steps.slice(i + 1);
	}

	let fileInput = $state<HTMLInputElement>();
	let reading = $state(false);
	let dropping = $state(false);
	let importError = $state<ImportError | null>(null);
	type Imported = {
		result: ImportResult;
		before: Pick<BannerState, 'pity' | 'guaranteed' | 'counter'>;
	};
	let imported = $state<Imported | null>(null);

	async function importFile(file: File | undefined) {
		if (!file || reading) return;
		reading = true;
		importError = null;
		try {
			const r = await readPaimonExport(await file.arrayBuffer());
			if (typeof r === 'string') {
				importError = r;
				return;
			}
			const s = states.character;
			imported = {
				result: r,
				before: { pity: s.pity, guaranteed: s.guaranteed, counter: s.counter }
			};
			s.pity = clampPity(BANNERS.character, r.pity);
			s.guaranteed = r.replay.guaranteed;
			s.counter = r.replay.counter;
			listing = false;
			listed = [];
		} catch {
			importError = 'not-a-workbook';
		} finally {
			reading = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function undoImport() {
		if (!imported) return;
		Object.assign(states.character, imported.before);
		imported = null;
	}

	function onDragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
		dropping = true;
	}
	function onDragLeave(e: DragEvent) {
		if (!(e.currentTarget as Node).contains(e.relatedTarget as Node | null)) dropping = false;
	}
	function onDrop(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		dropping = false;
		importFile(e.dataTransfer.files[0]);
	}

	// By hand: every 5★ since the last Radiance (or since 5.0), featured or not.
	// The replay works out which were 50/50s, so a guarantee can't be entered
	// as a win.
	let listing = $state(false);
	let listed = $state<boolean[]>([]);
	const listedReplay = $derived(replay(listed));
	function setListed(next: boolean[]) {
		listed = next;
		const r = replay(next);
		states.character.counter = r.counter;
		states.character.guaranteed = r.guaranteed;
		imported = null;
	}

	const STEP_LABEL: Record<ReplayStep['kind'], string> = {
		lost: 'Lost',
		guarantee: 'Guarantee',
		won: 'Won',
		radiance: 'Radiance'
	};

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
	let graphH = $state(0);
	const PADL = 58;
	const PADR = 16;
	const TOP = 16;
	/** The plot's height at its least — the chart grows from here into the tile. */
	const PLOT_MIN = 230;
	const CHROME_H = TOP + 30; // above the plot + the axis below it
	const plotH = $derived(Math.max(PLOT_MIN, graphH - CHROME_H));
	const plotY1 = $derived(TOP + plotH);
	const H = $derived(plotY1 + 30);
	/** Axis labels stay at least this far apart (as in the ICD Timeline). */
	const MIN_TICK_PX = 44;
	const TICK_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500];

	const plotW = $derived(Math.max(1, graphW - PADL - PADR));
	const xOf = $derived((k: number) => PADL + (k / domain) * plotW);
	const yOf = $derived((p: number) => plotY1 - p * (plotH - 8));

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
		imported = null;
		importError = null;
		listing = false;
		listed = [];
		target = 'character';
		pulls = DEFAULT_PULLS;
		for (const id of Object.keys(states) as BannerId[]) states[id] = fresh();
	}

	export function getShareState() {
		return { v: 3, target, pulls, banners: $state.snapshot(states) };
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
		// v3: the Radiance counter (character banner only; absent or null is "Don't know")
		if (id === 'character') s.counter = (int(r.counter, 0, 3) ?? null) as RadianceCounter | null;
		states[id] = s;
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		imported = null;
		importError = null;
		listing = false;
		listed = [];
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
		if (s.v !== 2 && s.v !== 3) return;
		if (TARGETS.some((t) => t.id === s.target)) target = s.target as Target;
		const banners = (s.banners ?? {}) as Record<string, unknown>;
		for (const id of Object.keys(states) as BannerId[]) readBanner(id, banners[id]);
		readPulls(s.pulls);
	}
</script>

{#snippet strip(steps: ReplayStep[])}
	<ol class="wi-strip">
		{#each steps as st, i (i)}
			<li
				class="wi-step wi-step--{st.kind}"
				title={st.name && st.time ? `${st.name}, ${dayOf(st.time)}` : undefined}
			>
				{STEP_LABEL[st.kind]}
			</li>
		{/each}
	</ol>
{/snippet}

<div class="instrument instrument--capped">
	<div class="wi-chart instrument-chart ctx-dark">
		<div
			class="wi-graph instrument-graph"
			style:--graph-min="{PLOT_MIN + CHROME_H}px"
			bind:clientWidth={graphW}
			bind:clientHeight={graphH}
		>
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
	<div class="panel wi-controls instrument-controls">
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
			<!-- Dropping a file on the character banner's section is a pointer shortcut
			     for "Read a Paimon.moe export", which stays the accessible path. -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<section
				class="wi-section"
				class:is-dropping={id === 'character' && dropping}
				ondragover={id === 'character' ? onDragOver : undefined}
				ondragleave={id === 'character' ? onDragLeave : undefined}
				ondrop={id === 'character' ? onDrop : undefined}
			>
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
					<div class="wi-levels">
						<span class="slider-label" id="wi-counter">Radiance counter</span>
						<div class="chips wi-level-chips" role="group" aria-labelledby="wi-counter">
							{#each COUNTERS as k (k ?? 'unknown')}
								<button
									class="chip chip--control"
									class:active={s.counter === k}
									aria-pressed={s.counter === k}
									onclick={() => (states.character.counter = k)}
								>
									{k === null ? 'Don’t know' : k}
								</button>
							{/each}
						</div>
					</div>
					{#if s.counter === null}
						<p class="note">
							Without a guarantee, you’ll win the 50/50 about 55% of the time (the official rate,
							including Capturing Radiance).
							<span class="wi-fine"
								>Set your Radiance counter to use the community’s model of how Capturing Radiance
								works instead.</span
							>
						</p>
					{:else if s.counter === 3}
						<p class="note">
							Your next 50/50 is a Capturing Radiance: you’ll get the featured character.
						</p>
					{:else if s.counter === 2}
						<p class="note">
							You’ll win your next 50/50 about 55% of the time: half of them, plus a small chance of
							Capturing Radiance.
							<span class="wi-fine"
								>How small isn’t known. We use {Math.round(RADIANCE_CHANCE[2] * 100)}%, which makes
								the long-run rate the official 55%; community estimates run from 2% to 20%.</span
							>
						</p>
					{:else}
						<p class="note">
							Your next 50/50 is an even one.
							<span class="wi-fine"
								>Each lost 50/50 adds one to the counter and each win takes one off. At 3, your next
								50/50 is a Capturing Radiance.</span
							>
						</p>
					{/if}

					<div class="wi-history">
						<div class="wi-actions">
							<button class="btn btn--sm" disabled={reading} onclick={() => fileInput?.click()}>
								Read a Paimon.moe export
							</button>
							<button
								class="btn btn--sm"
								class:is-active={listing}
								aria-expanded={listing}
								onclick={() => (listing = !listing)}
							>
								Work it out
							</button>
							<input
								bind:this={fileInput}
								type="file"
								accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
								class="wi-file"
								onchange={(e) => importFile(e.currentTarget.files?.[0])}
							/>
						</div>

						{#if importError}
							<p class="note wi-error" role="alert">
								{#if importError === 'not-a-workbook'}
									That file isn’t a spreadsheet. In Paimon.moe, open the Wish Counter’s Settings and
									choose Export to Excel.
								{:else if importError === 'not-paimon'}
									That spreadsheet isn’t a Paimon.moe wish history export.
								{:else}
									That export has no character banner wishes in it.
								{/if}
							</p>
						{/if}

						{#if imported}
							{@const r = imported.result}
							{@const since = sinceRadiance(r.replay.steps)}
							{@const lastRadiance = r.replay.steps.findLast((st) => st.kind === 'radiance')}
							<div class="wi-imported" role="status">
								<p class="note">
									Read {r.wishes.toLocaleString('en-US')} character banner wishes, {dayOf(r.first)} to
									{dayOf(r.last)}.
								</p>
								{#if since.length > 0}
									<span class="slider-label">
										{lastRadiance ? 'Since your last Radiance' : 'Since 5.0'}
									</span>
									{@render strip(since)}
								{:else if lastRadiance?.time}
									<p class="note">
										No 50/50s since your last Radiance, on {dayOf(lastRadiance.time)}.
									</p>
								{/if}
								{#if r.first.slice(0, 10) > RADIANCE_SINCE}
									<p class="wi-fine">
										If you wished on the character banners before {dayOf(r.first)}, the counter may
										be off.
									</p>
								{/if}
								<div class="wi-actions">
									<button class="btn btn--sm" onclick={undoImport}>Undo</button>
								</div>
							</div>
						{:else if listing}
							<div class="wi-listing">
								<p class="note">
									Add each 5★ you’ve pulled on the character banners since your last Capturing
									Radiance (or since 5.0, if you haven’t had one), oldest first.
								</p>
								<div class="wi-actions">
									<button class="btn btn--sm" onclick={() => setListed([...listed, true])}>
										Featured
									</button>
									<button class="btn btn--sm" onclick={() => setListed([...listed, false])}>
										Not featured
									</button>
									<button
										class="btn btn--sm"
										disabled={listed.length === 0}
										onclick={() => setListed(listed.slice(0, -1))}
									>
										Undo
									</button>
								</div>
								{#if listed.length > 0}
									{@render strip(listedReplay.steps)}
								{/if}
							</div>
						{:else}
							<p class="wi-fine">The file is read on your device and isn’t uploaded.</p>
						{/if}
					</div>
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

	<div class="panel panel--paper wi-readout instrument-readout">
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
			{#if worst !== null}
				On average, {goalRow.label} would take
				<span class="wi-strong">{Math.round(goalRow.stats.mean)}</span> pulls from here, and at most
				<span class="wi-strong">{worst}</span>.
			{:else}
				On average, {goalRow.label} would take
				<span class="wi-strong">{Math.round(goalRow.stats.mean)}</span> pulls from here.
			{/if}
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
	/* No frame — the chart (.wi-chart) is on the night; .ctx-dark stays claimed
	   for --frame-bg. See .gx-chart / app.css's `.frame` retirement note. */
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

	/* ── The Radiance counter's history tools ── */
	.wi-file {
		display: none;
	}

	.wi-history,
	.wi-imported,
	.wi-listing {
		display: grid;
		gap: 0.5rem;
	}

	.wi-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.wi-error {
		color: var(--ui-warning);
	}

	/* A file dragged over the section: it takes the drop */
	.wi-section.is-dropping {
		border-radius: var(--r-sm);
		box-shadow: 0 0 0 1px var(--accent);
	}

	.wi-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.wi-step {
		padding: 0.05rem 0.45rem;
		border-radius: var(--r-round);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 25%, transparent);
		font-family: var(--font-condensed);
		font-size: var(--fs-sm);
		color: var(--text);
	}

	.wi-step--lost {
		color: var(--muted);
	}

	.wi-step--radiance {
		box-shadow: inset 0 0 0 1px var(--accent);
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

	/* ══ WIDE (the layout itself is app.css's .instrument): the sections sit
	   side by side under the chart. */
	@container instrument (min-width: 60rem) {
		/* "Pulling for" is a narrow column of stacked chips, so each banner
		   section keeps the width for its eight level chips on one row. */
		.wi-controls {
			grid-template-columns: 11rem repeat(auto-fit, minmax(17.5rem, 1fr));
		}

		.wi-targets {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
