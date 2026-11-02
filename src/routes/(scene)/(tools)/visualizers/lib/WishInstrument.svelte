<script lang="ts">
	import {
		BANNERS,
		cdfAt,
		cdfStats,
		clampPity,
		copiesCdfs,
		RADIANCE_CHANCE,
		sumCdf,
		toPmf,
		worstCasePulls,
		type BannerDef,
		type BannerId,
		type RadianceCounter
	} from './wish';
	import {
		RADIANCE_SINCE,
		radianceMatters,
		readAnswers,
		readPaimonExport,
		type Answer,
		type ImportError,
		type ImportResult,
		type ReplayStep
	} from './wishHistory';
	import { formatChance } from './chance';
	import Mark from '$lib/components/Mark.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import InstrumentSlider from './kit/InstrumentSlider.svelte';

	/** The most pulls the instrument takes, typed or shared. */
	const MAX_PULLS = 2000;

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
	/** `worst`: the most pulls this level can take (null: uncapped), so a chance past it reads as certain. */
	type Curve = { label: string; cdf: number[]; primary: boolean; worst: number | null };

	function levelCurves(id: BannerId): Curve[] {
		const s = states[id];
		const banner = BANNERS[id];
		const need = s.goal - s.have;
		const cdfs = copiesCdfs(banner, need, s.pity, s.guaranteed, s.counter);
		return Array.from({ length: need }, (_, i) => ({
			label: levelName(id, s.have + i + 1),
			cdf: cdfs[i + 1],
			primary: i + 1 === need,
			worst: worstCasePulls(banner, i + 1, s.pity, s.guaranteed, s.counter)
		}));
	}

	const curves = $derived.by<Curve[]>(() => {
		if (target !== 'pair') return levelCurves(target);
		const c = levelCurves('character').at(-1)!;
		const w = levelCurves('weapon').at(-1)!;
		return [
			{ ...c, primary: false },
			{ ...w, primary: false },
			{
				label: `${c.label}${w.label}`,
				cdf: sumCdf(c.cdf, w.cdf),
				primary: true,
				// two banners pulled one after the other: their worst cases add
				worst: c.worst === null || w.worst === null ? null : c.worst + w.worst
			}
		];
	});
	const goal = $derived(curves.find((c) => c.primary)!);
	/** P(done within n pulls); certain once n reaches the level's worst case. */
	const chanceAt = (c: Curve, n: number) =>
		c.worst !== null && n >= c.worst ? 1 : cdfAt(c.cdf, n);
	const rows = $derived(
		curves.map((c) => ({ ...c, stats: cdfStats(c.cdf), chance: chanceAt(c, pulls) }))
	);
	const goalRow = $derived(rows.find((r) => r.primary)!);

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
		before: Pick<BannerState, 'pity' | 'guaranteed' | 'counter'> & { weaponPity: number };
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
				before: {
					pity: s.pity,
					guaranteed: s.guaranteed,
					counter: s.counter,
					weaponPity: states.weapon.pity
				}
			};
			s.pity = clampPity(BANNERS.character, r.pity);
			if (r.weaponPity !== null) states.weapon.pity = clampPity(BANNERS.weapon, r.weaponPity);
			s.guaranteed = r.replay.guaranteed;
			s.counter = r.replay.counter;
			interviewRestart();
		} catch {
			importError = 'not-a-workbook';
		} finally {
			reading = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function undoImport() {
		if (!imported) return;
		const { weaponPity, ...character } = imported.before;
		Object.assign(states.character, character);
		states.weapon.pity = weaponPity;
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

	// Find mine's interview (wishHistory.ts `readAnswers`): newest 5★ first,
	// done as soon as every state that fits the answers ends on one counter.
	// A featured answer asks about the Radiance animation only when that would
	// change the counter. The result is written straight into the controls.
	let answers = $state<Answer[]>([]);
	/** A featured 5★ was picked and its animation is being asked about. */
	let askingRadiance = $state(false);
	const told = $derived(readAnswers(answers));
	const interviewDone = $derived(answers.length > 0 && told.counters.length === 1);

	function answer(a: Answer) {
		answers = [...answers, a];
		askingRadiance = false;
		const r = readAnswers(answers);
		if (r.counters.length === 1) {
			states.character.counter = r.counters[0];
			states.character.guaranteed = r.guaranteed ?? false;
			imported = null;
		}
	}
	function answerFeatured() {
		if (radianceMatters(answers)) askingRadiance = true;
		else answer('featured');
	}
	function interviewBack() {
		if (askingRadiance) askingRadiance = false;
		else answers = answers.slice(0, -1);
	}
	function interviewRestart() {
		answers = [];
		askingRadiance = false;
	}

	const ANSWER_LABEL: Record<Answer, string> = {
		featured: 'Featured',
		'featured-radiance': 'Featured, Radiance',
		'featured-plain': 'Featured',
		standard: 'Standard',
		none: 'None since 5.0'
	};

	const STEP_LABEL: Record<ReplayStep['kind'], string> = {
		lost: 'Lost',
		guarantee: 'Guarantee',
		won: 'Won',
		radiance: 'Radiance'
	};

	// The axis runs to where the goal is 99.9% done, in whole tens — the 4★
	// chain never strictly ends, and the slider's ceiling follows it — or to
	// the goal's worst case where it has one, so "at most" is on the axis.
	const domain = $derived.by(() => {
		let n = goal.cdf.findIndex((p) => p >= 0.999);
		if (n < 0) n = goal.cdf.length - 1;
		if (goal.worst !== null) n = Math.max(n, goal.worst);
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
	// Top to bottom: the main plot (the chance by each pull), the companion
	// strip on the same x axis (the chance on each pull), then the axis's
	// numbers. The handle (Pulls saved) sits under the SVG, its track lined up
	// with the plot's x range.
	let graphW = $state(720);
	let graphH = $state(0);
	const PADL = 58;
	const PADR = 16;
	const TOP = 16;
	/** The plot's height at its least — the chart grows from here into the tile. */
	const PLOT_MIN = 230;
	/** 🎛️ The companion strip's height (design §7: at most one, on the main x axis). */
	const COMP_H = 72;
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
	 *  this far past each end of the axis, so the thumb's centre lands on the
	 *  marker line at every value. */
	const THUMB_R = 7.5;
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

	// ── The answer as geometry (design §6, §7: the chance-curve family) ──────
	// The goal's Half by and Unlucky tenth are where its curve crosses 50% and
	// 90%: a dot on the curve, a drop line to the axis, and the figure beside
	// it. The label goes below and right of its dot, where a rising curve leaves
	// the space empty, or above and left (also empty) where it would run off the
	// plot. The goal's level name already sits left of the 50% crossing.
	const crossings = $derived.by(() => {
		const { median, p90 } = goalRow.stats;
		return [
			{
				key: 'half',
				k: median,
				text: `Half by ${median}`,
				title: 'Half of players get there within this many pulls.'
			},
			{
				key: 'tenth',
				k: p90,
				text: `Unlucky tenth ${p90}`,
				title: 'The unluckiest 10% of players need this many pulls or more.'
			}
		]
			.filter((c) => c.k > 0 && c.k <= domain)
			.map((c) => {
				const x = xOf(c.k);
				const right = x + 8 + c.text.length * LABEL_CHAR_PX <= graphW - PADR;
				const y = yOf(cdfAt(goal.cdf, c.k));
				// below and right of the dot, or above and left: clear of a shallow curve too
				return {
					...c,
					x,
					y,
					lx: right ? x + 8 : x - 8,
					ly: right ? y + 14 : y - 7,
					anchor: right ? 'start' : 'end'
				};
			});
	});

	// With more than one level on the chart, each level's dot carries its
	// chance (the head speaks for the goal's). Beside the marker, on the side
	// with room, nudged apart where two would touch.
	/** 🎛️ The least gap between two dot labels, in px. */
	const DOT_LABEL_GAP = 13;
	const dotLabels = $derived.by(() => {
		if (rows.length < 2) return [];
		const x = xOf(shownPulls);
		const left = shownPulls > domain * 0.7;
		const placed = rows
			.filter((r) => !r.primary)
			.map((r) => ({
				key: r.label,
				text: `${r.label} ${formatChance(r.chance)}`,
				y: yOf(r.chance)
			}))
			.sort((a, b) => a.y - b.y);
		for (let i = 1; i < placed.length; i++)
			placed[i].y = Math.max(placed[i].y, placed[i - 1].y + DOT_LABEL_GAP);
		// the goal's dot is unlabeled (the head speaks for it) but not to be
		// written over: a label that lands on it steps above it
		const goalY = yOf(goalRow.chance);
		for (const l of placed) if (Math.abs(l.y - goalY) < DOT_LABEL_GAP) l.y = goalY - DOT_LABEL_GAP;
		return placed.map((l) => ({
			...l,
			x: left ? x - 8 : x + 8,
			y: l.y + 3.5,
			anchor: left ? 'end' : 'start'
		}));
	});

	// The distribution's two landmarks, on the strip that draws it: the
	// average, and the worst case where the strip runs out.
	const stripMarks = $derived.by(() => {
		const marks: { key: string; x: number; text: string; anchor: 'middle' | 'end' }[] = [];
		const mean = Math.round(goalRow.stats.mean);
		if (mean > 0 && mean <= domain)
			marks.push({ key: 'mean', x: xOf(mean), text: `average ${mean}`, anchor: 'middle' });
		if (goalRow.worst !== null && goalRow.worst <= domain)
			marks.push({
				key: 'worst',
				x: xOf(goalRow.worst),
				text: `at most ${goalRow.worst}`,
				anchor: 'end'
			});
		return marks;
	});

	// The companion strip: the chance the goal is done ON each pull, the
	// main curve's slope. Its spikes are why the curve jumps (soft pity, the
	// hard pity wall). Scaled to its own peak, so it shows shape, not size.
	const goalPmf = $derived(toPmf(goal.cdf));
	const compPath = $derived.by(() => {
		let peak = 0;
		for (let k = 1; k <= domain; k++) peak = Math.max(peak, goalPmf[k] ?? 0);
		if (!(peak > 0)) return '';
		const y = (p: number) => (compY1 - (p / peak) * (COMP_H - 4)).toFixed(1);
		const x = (k: number) => xOf(Math.min(domain, Math.max(0, k))).toFixed(1);
		// a step per pull, centred on its pull, as the marker line is
		let d = `M${x(0)},${compY1}`;
		for (let k = 1; k <= domain; k++) {
			const yk = y(goalPmf[k] ?? 0);
			d += ` L${x(k - 0.5)},${yk} L${x(k + 0.5)},${yk}`;
		}
		return `${d} L${x(domain)},${compY1} Z`;
	});

	const pullsPhrase = (n: number) => (n === 1 ? '1 pull' : `${n} pulls`);

	/** `held` is the guarantee chip's word; `guarantee` says in full what it means
	 *  (its tooltip and accessible name). */
	const RULES: Record<
		BannerId,
		{ kicker: string; pityAria: string; held: string; guarantee: string }
	> = {
		character: {
			kicker: 'Character Event',
			pityAria: 'Pulls since your last five-star',
			held: 'Guarantee',
			guarantee: 'Guarantee held (lost the last 50/50)'
		},
		fourStar: {
			kicker: 'Character Event',
			pityAria: 'Pulls since your last four-star',
			held: 'Guarantee',
			guarantee: 'Guarantee held (last 4★ wasn’t featured)'
		},
		weapon: {
			kicker: 'Weapon Event',
			pityAria: 'Pulls since your last five-star weapon',
			held: 'Fate point',
			guarantee: 'Fate point held'
		}
	};

	// ── Workspace handle (share + reset) ─────────────────────────────────────
	export function reset() {
		imported = null;
		importError = null;
		answers = [];
		askingRadiance = false;
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
		answers = [];
		askingRadiance = false;
		const readPulls = (v: unknown) => {
			if (typeof v === 'number' && Number.isFinite(v))
				pulls = Math.min(MAX_PULLS, Math.max(0, Math.round(v)));
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

{#snippet counterPanel()}
	{@const s = states.character}
	<div class="wi-pop">
		<div class="chips wi-level-chips" role="group" aria-label="Radiance counter">
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

		{@render bannerNote('character')}

		<p class="wi-pop-head">Find mine</p>
		<div class="wi-actions">
			<button
				class="btn btn--sm"
				disabled={reading}
				onclick={() => {
					fileInput?.click();
				}}
			>
				Read a Paimon.moe export
			</button>
			<span class="wi-fine">The file stays on your device.</span>
		</div>
		{#if importError}
			<p class="note wi-error" role="alert">
				{#if importError === 'not-a-workbook'}
					That file isn’t a spreadsheet. In Paimon.moe, open the Wish Counter’s Settings and choose
					Export to Excel.
				{:else if importError === 'not-paimon'}
					That spreadsheet isn’t a Paimon.moe wish history export.
				{:else}
					That export has no character banner wishes in it.
				{/if}
			</p>
		{/if}

		<div class="wi-interview" aria-live="polite">
			<p class="note">Or answer a few questions, starting from your most recent 5★.</p>
			{#if answers.length > 0}
				<ol class="wi-strip" aria-label="Your answers, newest first">
					{#each answers as a, i (i)}
						<li class="wi-step">{ANSWER_LABEL[a]}</li>
					{/each}
				</ol>
			{/if}

			{#if answers.length > 0 && told.counters.length === 0}
				<p class="note wi-error">Those answers can’t all be right. Check the last one.</p>
			{:else if interviewDone}
				<p class="note wi-done">
					{#if told.guaranteed}
						That’s enough: your counter is {told.counters[0]}, and you hold a guarantee.
					{:else}
						That’s enough: your counter is {told.counters[0]}.
					{/if}
				</p>
			{:else if askingRadiance}
				<p class="wi-question">Did it play the Capturing Radiance animation?</p>
				<div class="wi-actions">
					<button class="btn btn--sm" onclick={() => answer('featured-radiance')}>Yes</button>
					<button class="btn btn--sm" onclick={() => answer('featured-plain')}>No</button>
					<button class="btn btn--sm" onclick={() => answer('featured')}>Not sure</button>
				</div>
			{:else}
				<p class="wi-question">
					{answers.length === 0
						? 'Your most recent 5★ on the character banners was'
						: 'And the 5★ before that was'}
				</p>
				<div class="wi-actions">
					<button class="btn btn--sm" onclick={answerFeatured}>The featured character</button>
					<button class="btn btn--sm" onclick={() => answer('standard')}>A standard 5★</button>
					<button class="btn btn--sm" onclick={() => answer('none')}>
						{answers.length === 0 ? 'None yet since 5.0' : 'None before that since 5.0'}
					</button>
				</div>
			{/if}

			{#if answers.length > 0 || askingRadiance}
				<div class="wi-actions">
					<button class="btn btn--sm" onclick={interviewBack}>Back</button>
					<button class="btn btn--sm" onclick={interviewRestart}>Start over</button>
				</div>
			{/if}
		</div>

		{#if imported}
			{@const r = imported.result}
			{@const since = sinceRadiance(r.replay.steps)}
			{@const lastRadiance = r.replay.steps.findLast((st) => st.kind === 'radiance')}
			<div class="wi-report" role="status">
				<span class="wi-report-head">Your wish history</span>
				<p class="note">
					Read {r.wishes.toLocaleString('en-US')} character banner wishes, {dayOf(r.first)} to
					{dayOf(r.last)}.
				</p>
				{#if since.length > 0}
					<span class="wi-report-head">
						{lastRadiance ? 'Since your last Radiance' : 'Since 5.0'}
					</span>
					{@render strip(since)}
				{:else if lastRadiance?.time}
					<p class="note">No 50/50s since your last Radiance, on {dayOf(lastRadiance.time)}.</p>
				{/if}
				{#if r.weaponPity !== null}
					<p class="note">
						Your weapon banner pity is {r.weaponPity}. Whether you hold a fate point isn’t in the
						export.
					</p>
				{/if}
				{#if r.first.slice(0, 10) > RADIANCE_SINCE}
					<p class="note">
						If you wished on the character banners before {dayOf(r.first)}, the counter may be off.
					</p>
				{/if}
				<div class="wi-actions">
					<button class="btn btn--sm" onclick={undoImport}>Undo</button>
				</div>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet bannerNote(id: BannerId)}
	<!-- What the banner's rules come to from here, in the popover of the setting
	     it explains (the guarantee, and the Radiance counter). -->
	{@const s = states[id]}
	{#if id === 'character'}
		{#if s.counter === null}
			<p class="note">
				Without a guarantee, you’ll win the 50/50 about 55% of the time (the official rate,
				including Capturing Radiance).
			</p>
		{:else if s.counter === 3 && s.guaranteed}
			<p class="note">
				Your next two featured 5★s are certain: the guarantee, then a Capturing Radiance.
			</p>
		{:else if s.counter === 3}
			<p class="note">
				Your next 50/50 is a Capturing Radiance: you’ll get the featured character.
			</p>
		{:else if s.counter === 2}
			<p class="note">
				You’ll win your next 50/50 about 55% of the time: half of them, plus a small chance of
				Capturing Radiance (we estimate {Math.round(RADIANCE_CHANCE[2] * 100)}%).
			</p>
		{:else}
			<p class="note">Your next 50/50 is an even one.</p>
		{/if}
	{:else if id === 'fourStar'}
		<p class="note">
			Without a guarantee, each 4★ you pull has a 16.7% chance to be the featured character you
			want. If your last 4★ wasn’t featured, that goes up to 33.3%. Over many pulls, it averages out
			to about 22%.
			<span class="wi-fine"
				>Losing the 50/50 never gives you one of the three, even if they’re already on the standard
				banner.</span
			>
		</p>
	{:else}
		<p class="note">
			Without a fate point, each 5★ you pull has a 37.5% chance to be the weapon you charted, 37.5%
			to be the other featured weapon, and 25% to be a standard 5★ weapon.
		</p>
	{/if}
{/snippet}

{#snippet viewTabs()}
	<!-- What you're pulling for picks what the chart draws: the instrument's
	     view tabs, under its picker. -->
	<div class="segment wi-tabs" role="radiogroup" aria-label="Pulling for">
		{#each TARGETS as t (t.id)}
			<button
				class="btn"
				class:is-active={target === t.id}
				role="radio"
				aria-checked={target === t.id}
				onclick={() => (target = t.id)}
			>
				{t.label}
			</button>
		{/each}
	</div>
{/snippet}

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

<!-- THE STAGE (design §6, the first instrument on it). One box: the head row
     (the view tabs and the headline), the setup bar, the chart with its
     companion, and the handle. No answer card: what the card held is
     drawn on the chart, or sits in the popover of the setting it explains. -->
<div class="wi-root">
	<div class="wi-stage ctx-dark">
		<!-- THE HEAD ROW (Nate 2026-11-02): the instrument's view tabs, under its
		     picker, and the headline at the row's far end; under the tabs where
		     the tile is too narrow for both. -->
		<div class="wi-head-row">
			{@render viewTabs()}
			<!-- The chart head (design §6): the answer, where the chart is. It
			     follows the handle and a drag on the chart. -->
			<p class="readout-head wi-head">
				{formatChance(goalRow.chance)}<span class="readout-sentence"
					>chance of {goalRow.label} within {pullsPhrase(pulls)}</span
				>
			</p>
		</div>

		<!-- THE SETUP BAR, right over the chart and centred on it (Nate). -->
		<div class="wi-controls">
			{#each blocks as id (id)}
				{@const s = states[id]}
				{@const b = BANNERS[id]}
				<!-- THE SETUP BAR: one plate per banner, a setting per segment, each
				     showing its value and opening its setting. Dropping a file on the
				     character banner's bar is a pointer shortcut for "Read a Paimon.moe
				     export", which stays the accessible path. -->
				<div
					class="wi-bar"
					class:is-dropping={id === 'character' && dropping}
					role="group"
					aria-label={RULES[id].kicker}
					ondragover={id === 'character' ? onDragOver : undefined}
					ondragleave={id === 'character' ? onDragLeave : undefined}
					ondrop={id === 'character' ? onDrop : undefined}
				>
					{#if blocks.length > 1}
						<span class="wi-bar-name">{RULES[id].kicker}</span>
					{/if}

					<BandMenu role="dialog" align="start" ariaLabel="Current pity: {clampPity(b, s.pity)}">
						{#snippet face()}
							<span class="wi-chip-key">Pity</span>
							<span class="wi-chip-val wi-chip-val--num">{clampPity(b, s.pity)}</span>
						{/snippet}
						{#snippet items()}
							<div class="wi-chip-pop">
								<InstrumentSlider
									label="Current pity"
									aria={RULES[id].pityAria}
									bind:value={() => clampPity(b, states[id].pity), (v) => (states[id].pity = v)}
									min={0}
									max={b.hard - 1}
									step={1}
								/>
							</div>
						{/snippet}
					</BandMenu>

					<BandMenu
						role="dialog"
						align="start"
						ariaLabel="{RULES[id].held}: {s.guaranteed ? 'Held' : 'None'}"
					>
						{#snippet face()}
							<span class="wi-chip-key">{RULES[id].held}</span>
							<span class="wi-chip-val">{s.guaranteed ? 'Held' : 'None'}</span>
						{/snippet}
						{#snippet items()}
							<div class="wi-chip-pop">
								<label class="check">
									<input type="checkbox" bind:checked={states[id].guaranteed} />
									<span class="check-box"></span>
									{RULES[id].guarantee}
								</label>
								{@render bannerNote(id)}
							</div>
						{/snippet}
					</BandMenu>

					<BandMenu
						role="dialog"
						align="start"
						ariaLabel="Goal: {haveName(id, s.have)} to {levelName(id, s.goal)}"
					>
						{#snippet face()}
							<span class="wi-chip-key">Goal</span>
							<span class="wi-chip-val"
								>{haveName(id, s.have)}<Mark name="forwardSlim" size={11} />{levelName(
									id,
									s.goal
								)}</span
							>
						{/snippet}
						{#snippet items()}
							<div class="wi-chip-pop">
								<div class="wi-pop wi-levels">
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
							</div>
						{/snippet}
					</BandMenu>

					{#if id === 'character'}
						<BandMenu
							role="dialog"
							align="start"
							ariaLabel="Radiance counter: {s.counter === null ? 'Don’t know' : s.counter}"
						>
							{#snippet face()}
								<span class="wi-chip-key">Radiance counter</span>
								<span class="wi-chip-val">{s.counter === null ? 'Don’t know' : s.counter}</span>
							{/snippet}
							{#snippet items()}
								<div class="wi-chip-pop">{@render counterPanel()}</div>
							{/snippet}
						</BandMenu>
						<input
							bind:this={fileInput}
							type="file"
							accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
							class="wi-file"
							onchange={(e) => importFile(e.currentTarget.files?.[0])}
						/>
					{/if}
				</div>
			{/each}
		</div>

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
				<!-- X grid (pulls from now), through the plot and the strip -->
				{#each xTicks as t (t)}
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
					<line
						x1={xOf(softAt)}
						y1={compY0}
						x2={xOf(softAt)}
						y2={compY1}
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

				<!-- The companion: the chance on each pull -->
				<line x1={PADL} y1={compY1} x2={graphW - PADR} y2={compY1} stroke="var(--chart-rule)" />
				{#if compPath}
					<path d={compPath} fill="var(--chart-ink)" fill-opacity="0.45" />
				{/if}
				<text x="4" y={compY0 - 6} fill="var(--chart-dim)" font-size="10" text-anchor="start">
					chance on each pull
				</text>
				{#each stripMarks as m (m.key)}
					<line
						x1={m.x}
						y1={compY0}
						x2={m.x}
						y2={compY1}
						stroke="var(--chart-ink)"
						stroke-dasharray="2 3"
					/>
					<text
						class="wi-word"
						x={m.x}
						y={compY0 - 6}
						fill="var(--chart-ink)"
						font-size="11"
						text-anchor={m.anchor}
					>
						{m.text}
					</text>
				{/each}

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

				<!-- The goal's Half by and Unlucky tenth, drawn where they are -->
				{#each crossings as c (c.key)}
					<line
						x1={c.x}
						y1={c.y}
						x2={c.x}
						y2={plotY1}
						stroke="var(--chart-ink)"
						stroke-dasharray="2 3"
					/>
					<circle
						cx={c.x}
						cy={c.y}
						r="3"
						fill="var(--frame-bg)"
						stroke="var(--text)"
						stroke-width="1.5"
					/>
					<text
						class="wi-word"
						x={c.lx}
						y={c.ly}
						fill="var(--chart-ink)"
						font-size="11"
						text-anchor={c.anchor}
					>
						{c.text}<title>{c.title}</title>
					</text>
				{/each}

				<!-- Pulls-saved marker: a dot where it crosses each line, down through
				     the strip to the handle under the chart -->
				<line
					x1={xOf(shownPulls)}
					y1={TOP}
					x2={xOf(shownPulls)}
					y2={compY1}
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
				{#each dotLabels as l (l.key)}
					<text
						class="wi-word"
						x={l.x}
						y={l.y}
						fill="var(--chart-ink)"
						font-size="11"
						text-anchor={l.anchor}
					>
						{l.text}
					</text>
				{/each}
			</svg>
		</div>

		<!-- THE HANDLE (design §6): the live control is the x axis's. Its track
		     runs the plot's width, so the thumb sits under the marker line.
		     Typed, it runs past the chart (to MAX_PULLS), where every goal is past
		     99.9%: the head answers, the marker waits at the axis's end. -->
		<div
			class="wi-handle"
			style:--wi-handle-l="{PADL - THUMB_R}px"
			style:--wi-handle-r="{PADR - THUMB_R}px"
		>
			<InstrumentSlider
				label="Pulls saved"
				aria="Pulls you have saved"
				bind:value={pulls}
				min={0}
				max={domain}
				step={1}
				fieldMax={MAX_PULLS}
			/>
		</div>

		<!-- The fine print: what no part of the chart can show. -->
		{#if target === 'pair'}
			<p class="wi-fine-print">
				Your character and weapon banners keep separate pity, so the chart adds the pulls for both.
			</p>
		{/if}
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

	/* A word on the chart wears the site's soft halo (the Gauge's pill digits,
	   the planner's bars), a touch denser, so it stays legible where it
	   crosses a line or a rule (a level's chance beside the goal's curve). A
	   hard outline (`paint-order: stroke`) was tried and smeared the glyphs. */
	.wi-graph text.wi-word {
		font-family: var(--font-condensed);
		text-shadow:
			color-mix(in srgb, var(--label-halo, #081225) 90%, transparent) 0px 0px 2px,
			color-mix(in srgb, var(--label-halo, #081225) 70%, transparent) 0px 0px 6px;
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

	.wi-fine {
		display: block;
		font-size: var(--fs-md);
		color: color-mix(in srgb, var(--muted) 70%, transparent);
	}

	/* ══ THE STAGE (design §6; Wish odds is its first instrument) ═════════════
	   ONE BOX: the controls row, the chart head, the chart with its companion,
	   and the handle. There is no answer card: what it held is drawn on the
	   chart or sits in the popover of the setting it explains (Nate, the second
	   pass: two boxes sat diagonally from each other).
	   - Narrow: natural height; the page scrolls.
	   - From 1024px: the tile's height, and capped at 🎛️ --wi-stage-aspect ×
	     the tile's height, centred, so an ultrawide doesn't stretch every slope
	     flat (the rail's --instrument-main-aspect rule, with no side column
	     now, so set where a 16:10 one up is still uncapped).
	   The stage replaces the rail one instrument at a time; once a second
	   instrument wears it, this moves to app.css. */
	.wi-root {
		min-height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}

	.wi-stage {
		display: flex;
		flex-direction: column;
		gap: var(--inst-gap-control);
		min-width: 0;
	}

	/* ⚠ `cqh` only where the tile is a SIZE container: from 1024px (app.css §
	   THE RAIL; breakpoints.ts `visualizers`). */
	@media (min-width: 1024px) {
		.wi-root {
			grid-template-columns: minmax(0, calc(100cqh * var(--wi-stage-aspect, 1.9)));
			justify-content: center;
		}
		.wi-stage {
			height: 100cqh;
			min-height: max-content;
		}
	}

	/* ── The head row ──
	   The view tabs under the instrument's picker, and the headline at the
	   row's far end, right aligned (Nate 2026-11-02). Where the tile is too
	   narrow for both, the headline goes under the tabs, still at the right.
	   By the TILE's width, never by whether the content happens to fit: the
	   headline's length changes as you drag, and a row that rewrapped mid-drag
	   would move the chart under your hand. 🎛️ 60rem: the four tabs (420px)
	   and the longest one-line headline (about 505px) with room between. */
	.wi-head-row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.wi-head {
		align-self: flex-end;
		text-align: right;
	}

	@container instrument (min-width: 60rem) {
		.wi-head-row {
			flex-direction: row;
			align-items: flex-end;
			justify-content: space-between;
			gap: 2rem;
		}
	}

	/* THE HEADLINE ON ONE LINE where the tile has room: the figure and its
	   sentence share a baseline, each at its own size. From 38rem, where the
	   longest ("0.0263% chance of C2R1 within 1,000 pulls", about 505px)
	   fits; below it, the figure over its sentence. */
	@container instrument (min-width: 38rem) {
		.wi-head {
			display: flex;
			align-items: baseline;
			column-gap: 0.6rem;
			white-space: nowrap;
		}
		.wi-head .readout-sentence {
			margin-top: 0;
		}
	}

	/* Four tabs don't fit a narrow tile: wrap rather than scroll. */
	.wi-tabs {
		flex-wrap: wrap;
		max-width: 100%;
	}

	/* ── The setup bar's row ──
	   Right over the chart and centred on it (Nate 2026-11-02): the settings
	   belong to the chart below them. A pair's two bars sit side by side, or
	   one over the other, centred either way. The bar (a raised plate: each
	   segment is a value you set) and the tabs (a recessed track: one is
	   chosen) are different materials, so they read as two things. */
	.wi-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem 1rem;
		min-width: 0;
	}

	/* THE SETUP BAR: one glass plate, a setting per segment. The segments are
	   bare buttons on the plate (BandMenu's triggers), which light under the
	   hand and while their popover is open; each one's chevron ends it, so no
	   hairlines (they dangled at the end of a wrapped line on a phone). */
	.wi-bar {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		max-width: 100%;
		padding: 2px;
		border-radius: var(--r-sm);
		background: var(--glass-panel);
	}

	.wi-bar > :global(.btn) {
		background: transparent;
		border-radius: var(--r-xs);
	}

	@media (hover: hover) {
		.wi-bar > :global(.btn:hover:not(:disabled)) {
			background: var(--glass-hover);
		}
	}

	.wi-bar > :global(.btn.is-active) {
		background: color-mix(in srgb, var(--accent) 20%, var(--btn-face));
	}

	/* A pair's banner name leads its bar. */
	.wi-bar-name {
		padding-inline: 0.6rem 0.5rem;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--chart-ink);
	}

	/* A chip's face: the setting's name, then its value in the ink. */
	.wi-chip-key {
		color: var(--chart-ink);
	}

	.wi-chip-val {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	/* Pity runs 0–89: two figures held, so the chips after it never shift. */
	.wi-chip-val--num {
		min-width: 2ch;
		justify-content: flex-end;
		font-variant-numeric: tabular-nums;
	}

	/* A chip's popover (BandMenu, portalled): as SettingLine's, 22rem, about
	   the old rail's width, so a slider inside keeps its track. */
	.wi-chip-pop {
		display: grid;
		gap: var(--inst-gap-control);
		width: min(22rem, calc(100vw - 2rem));
		padding: 0.6rem;
	}

	/* ── The chart head ──
	   The Readout head's type (app.css .readout-head), on the chart's ground.
	   Its sentence stays one line where there is room and wraps on a phone. */
	.wi-head {
		color: var(--text);
	}

	/* The fine print, under the handle: what no part of the chart can show. */
	.wi-fine-print {
		margin: 0;
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
		color: var(--chart-ink);
	}

	/* ── The handle ──
	   The track spans the plot's x range plus half a thumb each side (THUMB_R),
	   so the thumb's centre is on the marker line at every value. The label
	   and the typed value sit under the track, the track right under the
	   axis's numbers. */
	.wi-handle {
		padding-inline: var(--wi-handle-l) var(--wi-handle-r);
		margin-top: calc(-1 * var(--inst-gap-control) + 0.15rem);
	}

	.wi-handle :global(.slider-control) {
		grid-template-areas: 'track' 'header';
	}

	.wi-handle :global(.slider-header) {
		grid-area: header;
		justify-content: flex-start;
	}

	.wi-handle :global(.is-track) {
		grid-area: track;
	}

	/* ⚠ Chrome gives a range input 2px side margins, which put the thumb 2px
	   off the marker line. */
	.wi-handle :global(.slider) {
		margin-inline: 0;
	}

	/* The import's report, at the foot of the Radiance counter's popover */
	.wi-report {
		display: grid;
		gap: 0.4rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
	}

	.wi-report-head {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	/* ── The Radiance counter's history tools ── */
	.wi-file {
		display: none;
	}

	/* A popover's contents (BandMenu, portalled: the band menu's own surface),
	   inside .wi-chip-pop, which pads it and sets its width. */
	.wi-pop {
		display: grid;
		gap: 0.6rem;
	}

	.wi-pop-head {
		margin: 0.4rem 0 0;
		padding-top: 0.6rem;
		border-top: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.wi-interview {
		display: grid;
		gap: 0.5rem;
	}

	.wi-question {
		margin: 0.2rem 0 0;
		font-weight: var(--fw-semibold);
	}

	.wi-done {
		color: var(--text);
	}

	.wi-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem 0.6rem;
	}

	.wi-error {
		color: var(--ui-warning);
	}

	/* A file dragged over the character banner's bar: it takes the drop */
	.wi-bar.is-dropping {
		outline: 1px solid var(--accent);
		outline-offset: 4px;
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
</style>
