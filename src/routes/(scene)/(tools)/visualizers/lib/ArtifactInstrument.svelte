<script lang="ts">
	import {
		SLOTS,
		SUBSTATS,
		FOUR_LINE,
		RESIN_PER_RUN,
		RESIN_PER_DAY,
		EXTRA_FIVE_STAR,
		ADVANCED_EXEGESIS,
		substatPool,
		substatById,
		presenceProbability,
		pieceChance,
		farmMiss,
		farmStats,
		floorDist,
		pairOutcome,
		distStats,
		compareTo,
		percentileOf,
		meanOf,
		rollEvents,
		reshapeDust,
		type SlotId,
		type MainStatId,
		type SubstatId,
		type ValueDist,
		type ValueUnit
	} from './artifactOdds';
	import {
		inferRollCounts,
		resolvePiece,
		possibleValues,
		pieceNow,
		pieceFuture,
		pieceReshape,
		type PieceQuery
	} from './appraise';
	import ValueWheel from './ValueWheel.svelte';

	// ⚓ Three views, a piece's life (Nate, 2026-10-06): it DROPS, it is LEVELLED,
	// and then it is YOUR piece — ranked, levelled further, or reshaped. The old
	// Appraise and Reshape views merged here: a reshape needs a real piece, and
	// the "current rolls" slider only ever stood in for one.
	type View = 'drop' | 'level' | 'piece';
	const VIEWS: { id: View; label: string }[] = [
		{ id: 'drop', label: 'Drop' },
		{ id: 'level', label: 'Level up' },
		{ id: 'piece', label: 'Your piece' }
	];
	const LEVELS = [0, 4, 8, 12, 16, 20];
	const RESHAPES = [
		{ floor: 2, label: 'Standard ≥2' },
		{ floor: 3, label: 'Advanced ≥3' },
		{ floor: 4, label: 'Decreed ≥4' }
	] as const;

	/** A week of resin — where the farming marker starts. */
	const DEFAULT_RESIN = 7 * RESIN_PER_DAY;
	/** The demo piece: a +20 flower with double crit, so the view teaches itself. */
	const demoLines = () => [
		{ id: 'cr' as SubstatId | '', raw: '6.6' },
		{ id: 'cd' as SubstatId | '', raw: '21.0' },
		{ id: 'atkPct' as SubstatId | '', raw: '9.9' },
		{ id: 'er' as SubstatId | '', raw: '5.2' }
	];

	// ── State ──────────────────────────────────────────────────────────────
	let view = $state<View>('drop');
	let slotId = $state<SlotId>('flower');
	let mainId = $state<MainStatId>('hp');
	let pair = $state<SubstatId[]>(['cr', 'cd']);
	/** A Sanctifying Elixir piece: its two defined lines get ≥2 rolls by +20 */
	let defined = $state(false);
	let fourLine = $state(true);
	let resin = $state(DEFAULT_RESIN);
	let level = $state(20);
	/** The 4th line may be '' (not there yet) at +0 only */
	let lines = $state(demoLines());
	let resolutionPick = $state(0);
	let reshapeFloor = $state<2 | 3 | 4>(2);

	const slot = $derived(SLOTS.find((s) => s.id === slotId)!);
	const main = $derived(slot.mains.find((m) => m.id === mainId) ?? slot.mains[0]);
	const pool = $derived(substatPool(main.id));

	function pickSlot(id: SlotId) {
		slotId = id;
		const s = SLOTS.find((x) => x.id === id)!;
		if (!s.mains.some((m) => m.id === mainId)) mainId = s.mains[0].id;
		fixPair();
	}

	function pickMain(id: MainStatId) {
		mainId = id;
		fixPair();
	}

	// The pair must live in the pool; refill from crit-first defaults if the
	// main stat swallowed one of them
	function fixPair() {
		let next = pair.filter((p) => p !== mainId);
		for (const candidate of ['cr', 'cd', 'atkPct', 'er'] as SubstatId[]) {
			if (next.length >= 2) break;
			if (candidate !== mainId && !next.includes(candidate)) next = [...next, candidate];
		}
		pair = next;
	}

	// Click: deselect if selected; otherwise select, displacing the oldest
	function togglePairStat(id: SubstatId) {
		if (pair.includes(id)) {
			if (pair.length > 1) pair = pair.filter((p) => p !== id);
		} else {
			pair = [...pair, id].slice(-2);
		}
	}

	// ── The pair ───────────────────────────────────────────────────────────
	const pairValid = $derived(pair.length === 2);
	/** Crit value for the crit pair; roll value for any other */
	const unit = $derived<ValueUnit>(pair.includes('cr') && pair.includes('cd') ? 'cv' : 'rv');
	/** The engine's order: CR first for crit value, else as picked */
	const orderedPair = $derived((unit === 'cv' ? ['cr', 'cd'] : pair) as [SubstatId, SubstatId]);
	const pairLabel = $derived(pair.map((p) => substatById(p).short).join(' + '));
	const unitWord = $derived(unit === 'cv' ? 'CV' : 'RV');
	const floor = $derived(defined ? 2 : 0);

	/** Each substat's chance to be among the piece's 4 lines (by +4) */
	const lineChance = $derived(
		Object.fromEntries(
			SUBSTATS.map((s) => [s.id, s.id === main.id ? 0 : presenceProbability(pool, [s.id], 4)])
		) as Record<SubstatId, number>
	);

	// ── Drop ───────────────────────────────────────────────────────────────
	const p3 = $derived(pairValid ? presenceProbability(pool, pair, 3) : 0);
	const p4 = $derived(pairValid ? presenceProbability(pool, pair, 4) : 0);
	const pAtDrop = $derived((1 - FOUR_LINE.domain) * p3 + FOUR_LINE.domain * p4);
	const perPiece = $derived(pieceChance(main.chance, p4));

	const farm = $derived({
		domain: farmStats(perPiece, false),
		outbreak: farmStats(perPiece, true)
	});

	/** The axis runs to where the domain alone is 99% done, in whole ticks. */
	const farmDomain = $derived.by(() => {
		const perRun = (1 - perPiece) * (1 - EXTRA_FIVE_STAR * perPiece);
		const runs = perPiece > 0 ? Math.ceil(Math.log(0.01) / Math.log(perRun)) : 100;
		const step = niceStep(runs * RESIN_PER_RUN, 5);
		return Math.max(step, Math.ceil((runs * RESIN_PER_RUN) / step) * step);
	});
	const shownResin = $derived(Math.min(resin, farmDomain));
	const chanceBy = $derived({
		domain: 1 - farmMiss(shownResin, perPiece, false),
		outbreak: 1 - farmMiss(shownResin, perPiece, true)
	});

	// ── Level up ───────────────────────────────────────────────────────────
	const events = $derived(rollEvents(fourLine));
	const levelDist = $derived(pairValid ? pairOutcome(unit, orderedPair, events, floor) : []);
	const levelGhost = $derived(
		pairValid && defined ? pairOutcome(unit, orderedPair, events, 0) : null
	);
	const levelStats = $derived(distStats(levelDist));
	const levelRolls = $derived(floorDist(events, 0.5, floor));

	// ── Your piece ─────────────────────────────────────────────────────────
	const pieceLines = $derived(lines.filter((l) => l.id !== '') as { id: SubstatId; raw: string }[]);
	const lineInferences = $derived(
		pieceLines.map((l) => {
			const v = Number(l.raw);
			if (l.id === main.id || !Number.isFinite(v) || l.raw.trim() === '') return [];
			return inferRollCounts(l.id, v);
		})
	);
	const resolutions = $derived(resolvePiece(lineInferences, level));
	const resolution = $derived(
		resolutions.length ? resolutions[Math.min(resolutionPick, resolutions.length - 1)] : null
	);
	const hasPair = $derived(
		orderedPair.map((id) => pieceLines.some((l) => l.id === id)) as [boolean, boolean]
	);
	const pairOnPiece = $derived(Number(hasPair[0]) + Number(hasPair[1]));

	const query = $derived<PieceQuery | null>(
		resolution && pairValid && pairOnPiece > 0
			? {
					unit,
					pair: orderedPair,
					main: main.id,
					level,
					lines: pieceLines.map((l) => ({ id: l.id, value: Number(l.raw) })),
					counts: resolution.counts
				}
			: null
	);
	const now = $derived(query ? pieceNow(query) : []);
	const nowX = $derived(meanOf(now));
	const finished = $derived(level >= 20);
	const future = $derived(query && !finished ? pieceFuture(query, floor) : []);
	const futureStats = $derived(distStats(future));
	/** Every piece with these lines, for ranking a finished one */
	const population = $derived(
		query && resolution && finished
			? pairOutcome(unit, orderedPair, resolution.events, floor, hasPair)
			: []
	);
	const percentile = $derived(population.length ? percentileOf(population, now) : 0);
	const canReshape = $derived(query !== null && finished && pairOnPiece === 2);
	const reshaped = $derived(
		canReshape && query && resolution ? pieceReshape(query, resolution.events, reshapeFloor) : []
	);
	const reshapeOdds = $derived(compareTo(reshaped, now));

	const pieceSolid = $derived(finished ? (canReshape ? reshaped : population) : future);
	const pieceGhost = $derived(finished && canReshape ? population : null);

	const fmtLineValue = (id: SubstatId, n: number) =>
		substatById(id).isPct ? n.toFixed(1) : String(n);

	// Wheel options per line: exactly the values the game can display
	const lineOptions = $derived(
		lines.map(({ id }) => (id === '' ? [] : possibleValues(id).map((n) => fmtLineValue(id, n))))
	);

	// Changing a line's stat snaps its value to the nearest legal one
	function setLineStat(index: number, id: SubstatId | '') {
		if (id === '') {
			lines = lines.map((l, i) => (i === index ? { id: '', raw: '' } : l));
			return;
		}
		const options = possibleValues(id);
		const current = Number(lines[index].raw);
		const nearest =
			Number.isFinite(current) && lines[index].raw !== ''
				? options.reduce((a, b) => (Math.abs(b - current) < Math.abs(a - current) ? b : a))
				: options[0];
		lines = lines.map((l, i) => (i === index ? { id, raw: fmtLineValue(id, nearest) } : l));
	}

	// Past +0 a piece has all four lines: fill an empty 4th with the first free stat
	function setLevel(next: number) {
		level = next;
		resolutionPick = 0;
		if (next > 0 && lines[3].id === '') {
			const free = SUBSTATS.find((s) => s.id !== main.id && !lines.some((l) => l.id === s.id))!;
			setLineStat(3, free.id);
		}
	}

	// ── Formatting ─────────────────────────────────────────────────────────
	const fmtPct = (p: number, digits = 1) => {
		// never print a certainty the model doesn't have, nor a zero it doesn't either
		const s = (p * 100).toFixed(digits);
		if (p < 1 && Number(s) >= 100) return `>${(100 - 10 ** -digits).toFixed(digits)}%`;
		if (p > 0 && Number(s) <= 0) return `<${(10 ** -digits).toFixed(digits)}%`;
		return `${s}%`;
	};
	const oneIn = (p: number) => (p > 0 ? Math.round(1 / p).toLocaleString('en-US') : '—');
	const fmtResin = (n: number) =>
		Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—';
	const fmtDays = (n: number) => {
		const d = n / RESIN_PER_DAY;
		return d < 10 ? d.toFixed(1) : Math.round(d).toLocaleString('en-US');
	};
	const fmtAxis = (n: number) => (n >= 10_000 ? `${n / 1000}k` : n.toLocaleString('en-US'));
	const fmtValue = (x: number) => (unit === 'cv' ? x.toFixed(1) : String(Math.round(x)));

	// ── Geometry ───────────────────────────────────────────────────────────
	let graphW = $state(720);
	const PADL = 44;
	const PADR = 16;
	const TOP = 22;
	const PLOT_H = 210;
	const plotY1 = TOP + PLOT_H;
	const H = plotY1 + 30;
	/** Axis labels stay at least this far apart (as in the ICD Timeline). */
	const MIN_TICK_PX = 44;
	const plotW = $derived(Math.max(1, graphW - PADL - PADR));

	/** The smallest 1/2/5 × 10ⁿ step that cuts `span` into at most `parts`. */
	function niceStep(span: number, parts: number) {
		const raw = span / parts;
		const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
		return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
	}

	// The farming chart: chance of the piece by resin spent, two curves
	const farmXOf = $derived((r: number) => PADL + (r / farmDomain) * plotW);
	const yOf = (p: number) => plotY1 - p * (PLOT_H - 8);
	const farmTicks = $derived.by(() => {
		const step = niceStep(farmDomain, Math.max(1, Math.floor(plotW / MIN_TICK_PX / 1.6)));
		return Array.from({ length: Math.floor(farmDomain / step) + 1 }, (_, i) => i * step);
	});
	function farmPath(outbreak: boolean) {
		const n = Math.min(240, Math.max(2, Math.round(plotW / 3)));
		let d = '';
		for (let i = 0; i <= n; i++) {
			const r = (i / n) * farmDomain;
			const p = 1 - farmMiss(r, perPiece, outbreak);
			d += `${i ? ' L' : 'M'}${farmXOf(r).toFixed(1)},${yOf(p).toFixed(1)}`;
		}
		return d;
	}
	/** Where each curve crosses half — its label sits there */
	const farmLabels = $derived(
		[
			{ text: 'Domain', median: farm.domain.median, primary: false },
			{ text: 'Outbreak', median: farm.outbreak.median, primary: true }
		].map((l) => ({ ...l, x: farmXOf(Math.min(l.median, farmDomain)) }))
	);

	// Drag scrubs the resin marker
	let scrubbing = $state(false);
	function markerFrom(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (e.clientX - rect.left - PADL) / plotW));
		resin = Math.round((frac * farmDomain) / RESIN_PER_RUN) * RESIN_PER_RUN;
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

	// The value histogram (Level up, Your piece): 1-CV or 10-RV bins
	type Bin = { x: number; p: number };
	const binW = $derived(unit === 'cv' ? 1 : 10);
	function binsOf(dist: ValueDist, w: number): Bin[] {
		const out: Bin[] = [];
		for (const d of dist) {
			const x = Math.floor(d.x / w + 1e-9) * w;
			const last = out.at(-1);
			if (last && last.x === x) last.p += d.p;
			else out.push({ x, p: d.p });
		}
		return out;
	}

	const histSolid = $derived(view === 'level' ? levelDist : pieceSolid);
	const histGhost = $derived(view === 'level' ? levelGhost : pieceGhost);
	const solidBins = $derived(binsOf(histSolid, binW));
	const ghostBins = $derived(histGhost ? binsOf(histGhost, binW) : []);
	const histX0 = $derived(
		Math.min(solidBins[0]?.x ?? 0, ghostBins[0]?.x ?? Infinity, view === 'piece' ? nowX : Infinity)
	);
	const histX1 = $derived(
		Math.max((solidBins.at(-1)?.x ?? 1) + binW, (ghostBins.at(-1)?.x ?? -Infinity) + binW)
	);
	const histMax = $derived(
		Math.max(1e-9, ...solidBins.map((b) => b.p), ...ghostBins.map((b) => b.p))
	);
	const histXOf = $derived((x: number) => PADL + ((x - histX0) / (histX1 - histX0)) * plotW);
	const barW = $derived(Math.max(1, (binW / (histX1 - histX0)) * plotW - 1));
	const histTicks = $derived.by(() => {
		const step = Math.max(
			binW,
			niceStep(histX1 - histX0, Math.max(1, Math.floor(plotW / MIN_TICK_PX / 1.4)))
		);
		const first = Math.ceil(histX0 / step) * step;
		return Array.from(
			{ length: Math.floor((histX1 - first) / step) + 1 },
			(_, i) => first + i * step
		);
	});

	type Marker = { x: number; label: string; strong: boolean };
	const markers = $derived.by<Marker[]>(() => {
		if (view === 'level')
			return [
				{ x: levelStats.p10, label: `p10 ${fmtValue(levelStats.p10)}`, strong: false },
				{ x: levelStats.median, label: `median ${fmtValue(levelStats.median)}`, strong: false },
				{ x: levelStats.p90, label: `p90 ${fmtValue(levelStats.p90)}`, strong: false }
			];
		if (!query) return [];
		return [{ x: nowX, label: finished ? 'your piece' : 'now', strong: true }];
	});

	// Point to read: the bin under the pointer
	let hoverX = $state<number | null>(null);
	function onHistMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const x = histX0 + ((e.clientX - rect.left - PADL) / plotW) * (histX1 - histX0);
		hoverX = x < histX0 || x > histX1 ? null : Math.floor(x / binW + 1e-9) * binW;
	}
	const hovered = $derived.by(() => {
		if (hoverX === null) return null;
		const bin = solidBins.find((b) => b.x === hoverX);
		const atLeast = histSolid.reduce((acc, d) => (d.x >= hoverX! - 1e-9 ? acc + d.p : acc), 0);
		return { x: hoverX, p: bin?.p ?? 0, atLeast };
	});

	// ── Workspace handle (share + reset) ───────────────────────────────────
	export function reset() {
		view = 'drop';
		slotId = 'flower';
		mainId = 'hp';
		pair = ['cr', 'cd'];
		defined = false;
		fourLine = true;
		resin = DEFAULT_RESIN;
		level = 20;
		lines = demoLines();
		resolutionPick = 0;
		reshapeFloor = 2;
	}

	export function getShareState() {
		return {
			v: 1,
			view,
			slot: slotId,
			main: mainId,
			pair,
			defined,
			fourLine,
			resin,
			level,
			reshape: reshapeFloor,
			lines: lines.map((l) => [l.id, l.raw])
		};
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		if (typeof s.slot === 'string' && SLOTS.some((x) => x.id === s.slot)) slotId = s.slot as SlotId;
		const sl = SLOTS.find((x) => x.id === slotId)!;
		if (typeof s.main === 'string' && sl.mains.some((m) => m.id === s.main))
			mainId = s.main as MainStatId;
		else if (!sl.mains.some((m) => m.id === mainId)) mainId = sl.mains[0].id;
		if (Array.isArray(s.pair)) {
			const p = s.pair.filter(
				(x): x is SubstatId =>
					typeof x === 'string' && x !== mainId && SUBSTATS.some((ss) => ss.id === x)
			);
			if (p.length === 2 && p[0] !== p[1]) pair = p;
		}
		fixPair();
		if (typeof s.defined === 'boolean') defined = s.defined;
		if (typeof s.fourLine === 'boolean') fourLine = s.fourLine;
		if (typeof s.resin === 'number' && Number.isFinite(s.resin))
			resin = Math.min(
				10_000_000,
				Math.max(0, Math.round(s.resin / RESIN_PER_RUN) * RESIN_PER_RUN)
			);
		if (typeof s.level === 'number' && LEVELS.includes(s.level)) level = s.level;
		if (s.reshape === 2 || s.reshape === 3 || s.reshape === 4) reshapeFloor = s.reshape;
		if (Array.isArray(s.lines) && s.lines.length === 4) {
			const next: { id: SubstatId | ''; raw: string }[] = [];
			for (const item of s.lines) {
				if (!Array.isArray(item)) break;
				const [id, raw] = item;
				if (typeof id !== 'string' || typeof raw !== 'string' || raw.length > 8) break;
				if (id !== '' && !SUBSTATS.some((ss) => ss.id === id)) break;
				next.push({ id: id as SubstatId | '', raw });
			}
			const ids = next.map((l) => l.id).filter((id) => id !== '');
			// distinct stats only — duplicates would break roll inference; only the
			// 4th may be empty, and only at +0
			const emptyOk = next.every((l, i) => l.id !== '' || (i === 3 && level === 0));
			if (next.length === 4 && new Set(ids).size === ids.length && emptyOk) {
				lines = next;
				resolutionPick = 0;
			}
		}
		if (typeof s.view === 'string' && VIEWS.some((v) => v.id === s.view)) view = s.view as View;
	}
</script>

<div class="instrument">
	<div class="ao-chart ctx-dark">
		<div class="chips ao-views" role="group" aria-label="View">
			{#each VIEWS as v (v.id)}
				<button
					class="chip chip--control"
					class:active={view === v.id}
					aria-pressed={view === v.id}
					onclick={() => (view = v.id)}
				>
					{v.label}
				</button>
			{/each}
		</div>

		{#if !pairValid}
			<p class="ao-empty">Pick two target substats.</p>
		{:else if view === 'drop'}
			<div class="ao-graph" bind:clientWidth={graphW}>
				<svg
					width={graphW}
					height={H}
					role="img"
					aria-label="Chance of this piece by resin spent"
					onpointerdown={onDown}
					onpointermove={onMove}
					onpointerup={onUp}
					onpointercancel={onUp}
					style:cursor="ew-resize"
				>
					{#each farmTicks as t (t)}
						<line x1={farmXOf(t)} y1={TOP} x2={farmXOf(t)} y2={plotY1} stroke="var(--chart-grid)" />
						<text
							x={farmXOf(t)}
							y={plotY1 + 15}
							fill="var(--chart-ink)"
							font-size="10"
							text-anchor="middle"
						>
							{fmtAxis(t)}
						</text>
					{/each}
					<text
						x={graphW - PADR}
						y={plotY1 + 27}
						fill="var(--chart-dim)"
						font-size="10"
						text-anchor="end"
					>
						resin spent
					</text>
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
					<text x="4" y={TOP - 8} fill="var(--chart-dim)" font-size="10" text-anchor="start">
						chance by then
					</text>

					<path
						d={farmPath(false)}
						fill="none"
						stroke="var(--chart-ink)"
						stroke-width="1.25"
						stroke-linejoin="round"
					/>
					<path
						d={farmPath(true)}
						fill="none"
						stroke="var(--text)"
						stroke-width="2"
						stroke-linejoin="round"
					/>
					{#each farmLabels as l (l.text)}
						<text
							class="ao-word"
							x={l.primary ? l.x - 6 : l.x + 6}
							y={yOf(0.5) + (l.primary ? -6 : 14)}
							fill={l.primary ? 'var(--text)' : 'var(--chart-ink)'}
							font-size="11"
							font-weight={l.primary ? 600 : 400}
							text-anchor={l.primary ? 'end' : 'start'}
						>
							{l.text}
						</text>
					{/each}

					<line
						x1={farmXOf(shownResin)}
						y1={TOP}
						x2={farmXOf(shownResin)}
						y2={plotY1}
						stroke="var(--chart-ink)"
						stroke-width="1.5"
					/>
					{#each [chanceBy.domain, chanceBy.outbreak] as p, i (i)}
						<circle
							cx={farmXOf(shownResin)}
							cy={yOf(p)}
							r={i ? 4.5 : 3}
							fill={i ? 'var(--accent)' : 'var(--chart-ink)'}
							style="stroke: var(--frame-bg)"
							stroke-width="1.5"
						/>
					{/each}
				</svg>
			</div>
			<p class="note">
				Drag along the chart to choose how much resin you spend. Outbreak: every run during a
				Stygian Onslaught Disturbance Outbreak, which adds a 5★ from the same domain for each 120
				resin.
			</p>
		{:else if view === 'piece' && !resolution}
			<p class="ao-empty">Dial in your piece's lines below.</p>
		{:else if view === 'piece' && pairOnPiece === 0}
			<p class="ao-empty">Neither target substat is on this piece — pick a pair it has.</p>
		{:else}
			<div class="ao-graph" bind:clientWidth={graphW}>
				<svg
					width={graphW}
					height={H}
					role="img"
					aria-label="{unit === 'cv' ? 'Crit value' : 'Roll value'} distribution"
					onpointermove={onHistMove}
					onpointerleave={() => (hoverX = null)}
				>
					{#each ghostBins as bin (bin.x)}
						<rect
							x={histXOf(bin.x) + 0.5}
							y={TOP + PLOT_H * (1 - bin.p / histMax)}
							width={barW}
							height={PLOT_H * (bin.p / histMax)}
							fill="var(--chart-grid)"
						/>
					{/each}
					{#each solidBins as bin (bin.x)}
						<rect
							x={histXOf(bin.x) + 0.5}
							y={TOP + PLOT_H * (1 - bin.p / histMax)}
							width={ghostBins.length ? Math.max(1, barW * 0.6) : barW}
							height={PLOT_H * (bin.p / histMax)}
							fill="var(--accent)"
							fill-opacity={hoverX === bin.x ? 1 : 0.75}
							transform={ghostBins.length ? `translate(${barW * 0.2} 0)` : undefined}
						/>
					{/each}
					<line x1={PADL} y1={plotY1} x2={graphW - PADR} y2={plotY1} stroke="var(--chart-rule)" />
					{#each histTicks as t (t)}
						<text
							x={histXOf(t)}
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
						{unit === 'cv' ? 'crit value' : `roll value into ${pairLabel}`}
					</text>
					{#each markers as m, i (i)}
						<line
							x1={histXOf(m.x)}
							y1={TOP - 2}
							x2={histXOf(m.x)}
							y2={plotY1}
							stroke={m.strong ? 'var(--text)' : 'var(--chart-ink)'}
							stroke-width={m.strong ? 1.5 : 1}
							stroke-dasharray={m.strong ? '4 4' : '3 4'}
						/>
						<text
							x={histXOf(m.x)}
							y={TOP - 7}
							fill={m.strong ? 'var(--text)' : 'var(--chart-ink)'}
							font-size="10"
							text-anchor="middle"
						>
							{m.label}
						</text>
					{/each}
				</svg>
			</div>
			<p class="note ao-probe">
				{#if hovered}
					<span class="ao-strong">{hovered.x}{binW > 1 ? '' : `–${hovered.x + 1}`} {unitWord}</span
					>:
					{fmtPct(hovered.p)} of outcomes · {fmtPct(hovered.atLeast)} reach at least {hovered.x}
				{:else if view === 'level'}
					{unit === 'cv' ? 'Crit value' : `Roll value into ${pairLabel}`} at +20 on a piece with both
					lines ({events} upgrade rolls{defined ? ', at least 2 into the pair' : ''}).
					{#if defined}Ghost: the same piece farmed.{/if}
				{:else if !finished}
					What the piece can become by +20, from where it is now.
				{:else if canReshape}
					Solid: after a {RESHAPES.find((r) => r.floor === reshapeFloor)?.label} reshape. Ghost: every
					piece with these lines.
				{:else}
					Every piece with these lines — a reshape needs both target lines on the piece.
				{/if}
			</p>
		{/if}
	</div>

	<!-- ONE panel, a section per question (the Wish Odds layout) -->
	<div class="panel ao-controls">
		<section class="ao-section">
			<p class="kicker">Piece</p>
			<div class="ao-slots">
				{#each SLOTS as s (s.id)}
					<button
						class="ao-slot"
						class:active={s.id === slotId}
						onclick={() => pickSlot(s.id)}
						title={s.name}
						aria-label={s.name}
						aria-pressed={s.id === slotId}
					>
						<img src="/assets/artifacts/generic-full-set/{s.id}.webp" alt="" />
					</button>
				{/each}
			</div>
			<div class="chips">
				{#each slot.mains as m (m.id)}
					<button
						class="chip chip--control"
						class:active={m.id === main.id}
						aria-pressed={m.id === main.id}
						onclick={() => pickMain(m.id)}
					>
						{m.name}{#if slot.mains.length > 1}&nbsp;<span class="chip-sub"
								>{fmtPct(m.chance, m.chance < 0.05 ? 1 : 0)}{m.each ? ' each' : ''}</span
							>{/if}
					</button>
				{/each}
			</div>
		</section>

		<section class="ao-section">
			<p class="kicker">Target pair</p>
			<div class="chips ao-dense" role="group" aria-label="Target pair">
				{#each SUBSTATS as s (s.id)}
					{#if s.id !== main.id}
						<button
							class="chip chip--control"
							class:active={pair.includes(s.id)}
							aria-pressed={pair.includes(s.id)}
							onclick={() => togglePairStat(s.id)}
						>
							{s.short}&nbsp;<span class="chip-sub">{fmtPct(lineChance[s.id], 0)}</span>
						</button>
					{/if}
				{/each}
			</div>
			<p class="note">Each substat's chance to be one of the piece's four lines.</p>
		</section>

		{#if view === 'level'}
			<section class="ao-section">
				<p class="kicker">Rolls</p>
				<div class="chips">
					<button
						class="chip chip--control"
						class:active={fourLine}
						aria-pressed={fourLine}
						onclick={() => (fourLine = true)}
					>
						4-line start
					</button>
					<button
						class="chip chip--control"
						class:active={!fourLine}
						aria-pressed={!fourLine}
						onclick={() => (fourLine = false)}
					>
						3-line start
					</button>
				</div>
				<div class="chips">
					<button
						class="chip chip--control"
						class:active={!defined}
						aria-pressed={!defined}
						onclick={() => (defined = false)}
					>
						Farmed
					</button>
					<button
						class="chip chip--control"
						class:active={defined}
						aria-pressed={defined}
						onclick={() => (defined = true)}
					>
						Defined
					</button>
				</div>
				{#if defined}
					<p class="note">
						Defined with Sanctifying Elixir: the two lines you chose get at least 2 of the {events} rolls.
					</p>
				{/if}
			</section>
		{:else if view === 'piece'}
			<section class="ao-section">
				<p class="kicker">Your piece</p>
				<div class="chips ao-dense" role="group" aria-label="Level">
					{#each LEVELS as l (l)}
						<button
							class="chip chip--control"
							class:active={level === l}
							aria-pressed={level === l}
							onclick={() => setLevel(l)}
						>
							+{l}
						</button>
					{/each}
				</div>
				{#each lines as line, i (i)}
					<div class="ao-line-row">
						<select
							class="ao-select"
							value={line.id}
							onchange={(e) => setLineStat(i, e.currentTarget.value as SubstatId | '')}
							aria-label="Substat {i + 1}"
						>
							{#if i === 3 && level === 0}
								<option value="">—</option>
							{/if}
							{#each SUBSTATS as s (s.id)}
								{#if s.id !== main.id && (s.id === line.id || !lines.some((l) => l.id === s.id))}
									<option value={s.id}>{s.short}</option>
								{/if}
							{/each}
						</select>
						{#if line.id !== ''}
							<ValueWheel
								values={lineOptions[i]}
								bind:value={lines[i].raw}
								label="Value for substat {i + 1}"
							/>
							<span class="ao-count-badge">
								{#if resolution}
									×{resolution.counts[pieceLines.findIndex((l) => l.id === line.id)]}
								{:else if lineInferences[pieceLines.findIndex((l) => l.id === line.id)]?.length}
									×{lineInferences[pieceLines.findIndex((l) => l.id === line.id)]
										.map((c) => c.count)
										.join('/')}
								{:else}
									—
								{/if}
							</span>
						{:else}
							<span class="ao-count-badge ao-span2">not yet</span>
						{/if}
					</div>
				{/each}
				{#if resolutions.length > 1}
					<div class="chips">
						{#each resolutions as r, i (i)}
							<button
								class="chip chip--control"
								class:active={resolution === r}
								aria-pressed={resolution === r}
								onclick={() => (resolutionPick = i)}
							>
								{r.fourLineStart ? '4-line start' : '3-line start'}
							</button>
						{/each}
					</div>
					<p class="note">Rounding makes two roll totals possible — pick the true start.</p>
				{/if}
				<div class="chips">
					<button
						class="chip chip--control"
						class:active={!defined}
						aria-pressed={!defined}
						onclick={() => (defined = false)}
					>
						Farmed
					</button>
					<button
						class="chip chip--control"
						class:active={defined}
						aria-pressed={defined}
						onclick={() => (defined = true)}
					>
						Defined
					</button>
				</div>
			</section>
			{#if finished}
				<section class="ao-section">
					<p class="kicker">Reshape</p>
					<div class="chips" role="group" aria-label="Reshape">
						{#each RESHAPES as r (r.floor)}
							<button
								class="chip chip--control"
								class:active={reshapeFloor === r.floor}
								aria-pressed={reshapeFloor === r.floor}
								disabled={!canReshape}
								onclick={() => (reshapeFloor = r.floor)}
							>
								{r.label}
							</button>
						{/each}
					</div>
				</section>
			{/if}
		{/if}
	</div>

	<div class="panel panel--paper ao-readout">
		<p class="kicker">Readout</p>
		{#if !pairValid}
			<p class="note">Pick two target substats.</p>
		{:else if view === 'drop'}
			<p class="ao-big">
				{fmtPct(chanceBy.outbreak)}<span class="ao-big-unit"
					>chance of this piece within {fmtResin(shownResin)} resin in an Outbreak</span
				>
			</p>
			<table class="ao-table">
				<thead>
					<tr>
						<th scope="col">Farming</th>
						<th scope="col" class="ao-num">Chance</th>
						<th scope="col" class="ao-num">Half by</th>
						<th scope="col" class="ao-num">Unlucky tenth</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">Domain</th>
						<td class="ao-num">{fmtPct(chanceBy.domain, 0)}</td>
						<td class="ao-num">{fmtResin(farm.domain.median)}</td>
						<td class="ao-num">{fmtResin(farm.domain.p90)}</td>
					</tr>
					<tr class="is-goal">
						<th scope="row">Outbreak</th>
						<td class="ao-num">{fmtPct(chanceBy.outbreak, 0)}</td>
						<td class="ao-num">{fmtResin(farm.outbreak.median)}</td>
						<td class="ao-num">{fmtResin(farm.outbreak.p90)}</td>
					</tr>
				</tbody>
			</table>
			<p class="ao-meta">
				Each 5★ from the domain is this piece <span class="ao-strong">1 in {oneIn(perPiece)}</span>.
			</p>
			<p class="ao-meta">
				Both lines at drop: <span class="ao-strong">{fmtPct(pAtDrop)}</span> · by +4:
				<span class="ao-strong">{fmtPct(p4)}</span>
			</p>
			<p class="note">
				In resin. Half by: half of players have the piece by then. Unlucky tenth: the unluckiest 10%
				need this much or more. {RESIN_PER_DAY} resin is a day's worth — half by is {fmtDays(
					farm.domain.median
				)} days from the domain alone.
			</p>
		{:else if view === 'level'}
			<p class="ao-big">
				{fmtValue(levelStats.median)}<span class="ao-big-unit">median {unitWord} at +20</span>
			</p>
			<p class="ao-meta">
				p10–p90: <span class="ao-strong"
					>{fmtValue(levelStats.p10)}–{fmtValue(levelStats.p90)} {unitWord}</span
				>
			</p>
			<p class="ao-meta">
				Mean: <span class="ao-strong">{levelStats.mean.toFixed(1)} {unitWord}</span>
			</p>
			<table class="ao-table">
				<thead>
					<tr>
						<th scope="col">Rolls into {pairLabel}</th>
						{#each levelRolls as _, k (k)}
							<th scope="col" class="ao-num">{k}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">Chance</th>
						{#each levelRolls as p, k (k)}
							<td class="ao-num">{p > 0 ? fmtPct(p, 0) : '—'}</td>
						{/each}
					</tr>
				</tbody>
			</table>
			{#if unit === 'rv'}
				<p class="note">
					RV = roll value, each roll's strength as a % of the strongest possible roll.
				</p>
			{/if}
		{:else if !query}
			<p class="note">Enter a piece with at least one target line.</p>
		{:else if !finished}
			<p class="ao-big">
				{fmtValue(futureStats.median)}<span class="ao-big-unit">median {unitWord} at +20</span>
			</p>
			<p class="ao-meta">Now: <span class="ao-strong">{fmtValue(nowX)} {unitWord}</span></p>
			<p class="ao-meta">
				p10–p90 at +20: <span class="ao-strong"
					>{fmtValue(futureStats.p10)}–{fmtValue(futureStats.p90)} {unitWord}</span
				>
			</p>
		{:else}
			<p class="ao-big">
				p{Math.round(percentile * 100)}<span class="ao-big-unit">of pieces with these lines</span>
			</p>
			<p class="ao-meta">
				{pairLabel}: <span class="ao-strong">{fmtValue(nowX)} {unitWord}</span> ·
				{resolution?.fourLineStart ? '4-line' : '3-line'} start
			</p>
			{#if canReshape}
				<p class="ao-reshape-odds">
					<span class="ao-odds better">{fmtPct(reshapeOdds.above)} better</span>
					<span class="ao-odds same">{fmtPct(reshapeOdds.equal)} same</span>
					<span class="ao-odds worse">{fmtPct(reshapeOdds.below)} worse</span>
				</p>
				<p class="note">
					A reshape keeps each line's first roll and deals every upgrade again. It costs {reshapeDust(
						slotId
					)} Dust of Enlightenment here; every {ADVANCED_EXEGESIS} Dust makes the next one Advanced, and
					the third Advanced is Decreed. You choose which result to keep.
				</p>
			{/if}
		{/if}
	</div>
</div>

<style>
	/* No frame — the chart is on the night; .ctx-dark stays claimed for
	   --frame-bg. See .gx-chart / app.css's `.frame` retirement note. */
	.ao-chart {
		display: grid;
		gap: 0.5rem;
		min-width: 0;
		align-content: start;
	}

	.ao-graph svg {
		display: block;
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
	}

	.ao-graph text {
		font-family: var(--font-body);
	}

	.ao-graph text.ao-word {
		font-family: var(--font-condensed);
	}

	.ao-empty {
		margin: 0;
		padding: 2rem 0;
		text-align: center;
		color: var(--muted);
	}

	.ao-probe {
		min-height: 2.6em;
	}

	/* ⚓ Its own grid column, not `.instrument`'s AUTO one (instrument passes
	   2026-10-01 §4): an auto column grows to its widest unbreakable child. */
	.instrument {
		grid-template-columns: minmax(0, 1fr);
	}

	/* ── Controls ───────────────────────────────────────────────────────────── */

	.ao-controls {
		display: grid;
		gap: 1.25rem 1.5rem;
		align-content: start;
	}

	/* Each section keeps the panel's own rhythm (`.panel` is a 0.7rem grid) */
	.ao-section {
		display: grid;
		gap: 0.7rem;
		align-content: start;
	}

	.ao-slots {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.ao-slot {
		width: 46px;
		height: 46px;
		padding: 4px;
		border: none;
		border-radius: var(--r-sm);
		background: var(--control-face);
		cursor: pointer;
		opacity: 0.55;
		transition:
			opacity var(--t-snap),
			background var(--t-snap),
			box-shadow var(--t-snap);
	}

	.ao-slot img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.ao-slot:hover {
		opacity: 0.85;
	}

	/* Selection is carried by full opacity + the ring, NOT by lightening the
	   face: mixing the accent into --surface resolved to a PAPER chip in the
	   light context and re-hid the white glyph on the chosen piece. */
	.ao-slot.active {
		opacity: 1;
		background: color-mix(in srgb, var(--accent) 20%, var(--control-face));
		box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 65%, transparent);
	}

	/* The densest chip rows (nine substats, six levels) */
	.ao-dense :global(.chip) {
		font-family: var(--font-condensed);
	}

	.ao-line-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 5.2rem 3.2rem;
		align-items: center;
		gap: 0.5rem;
	}

	.ao-select {
		padding: 0.32rem 0.5rem;
		border: none;
		border-radius: 3px;
		background: var(--fill-rest);
		color: var(--text);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}

	.ao-select option {
		background: var(--surface);
		color: var(--text);
	}

	.ao-count-badge {
		font-family: var(--font-body);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--muted);
		text-align: right;
	}

	.ao-span2 {
		grid-column: span 2;
	}

	/* ── Readout ────────────────────────────────────────────────────────────── */

	.ao-big {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--fs-5xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	/* Its own line: beside the number it broke mid-phrase in a narrow Readout */
	.ao-big-unit {
		display: block;
		margin-top: 0.15rem;
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.ao-meta {
		margin: 0;
		font-size: var(--fs-xl);
		line-height: 1.5rem;
		color: var(--muted);
	}

	.ao-strong {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.ao-table {
		width: 100%;
		margin: 0.25rem 0;
		border-collapse: collapse;
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
		font-variant-numeric: tabular-nums;
	}

	.ao-table thead th {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--muted);
		text-align: left;
		padding: 0 0.5rem 0.3rem;
	}

	.ao-table tbody th,
	.ao-table tbody td {
		padding: 0.25rem 0.5rem;
		border-top: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
		vertical-align: baseline;
	}

	.ao-table tbody th {
		text-align: left;
		font-weight: inherit;
		font-family: var(--font-condensed);
	}

	.ao-table tr.is-goal {
		font-weight: var(--fw-semibold);
	}

	.ao-num,
	.ao-table thead th.ao-num {
		text-align: right;
		white-space: nowrap;
	}

	.ao-reshape-odds {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.ao-odds {
		padding: 0.3rem 0.6rem;
		border-radius: 3px;
		background: var(--fill-rest);
		font-family: var(--font-body);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}

	/* ⚠ THE CHART'S OWN LITERALS, kept as literals on purpose — § Laws forbids a
	   UI state token inside a visualization, and these are the risk ramp's stops.
	   ↻ 2026-08-12: better re-synced #4ecca3 → #5be0ac with crit.ts's RISK_STOPS.
	   ⛔ `same` is NOT --ui-provisional even though the hex matches: provisional
	   means "our data is incomplete", and "this roll is a wash" is a full and
	   confident answer. Same value, different fact. */
	.ao-odds.better {
		color: #5be0ac;
	}

	.ao-odds.same {
		color: #f6d365;
	}

	.ao-odds.worse {
		color: #e63946;
	}

	/* ══ SHARED: the Readout sits BESIDE the controls, under a full-width
	   chart, at an even split (the Wish Odds layout). */
	@container instrument (min-width: 38rem) {
		.instrument {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-template-areas:
				'chart chart'
				'controls readout';
		}

		.ao-chart {
			grid-area: chart;
		}

		.ao-controls {
			grid-area: controls;
			align-self: start;
		}

		/* ⚠️ Named, never auto-placed (the Wish Odds pass's trap) */
		.ao-readout {
			grid-area: readout;
			align-self: start;
		}
	}

	/* ══ WIDE: THE READOUT IS A COLUMN, and the sections sit side by side */
	@container instrument (min-width: 60rem) {
		.instrument {
			grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
			grid-template-rows: auto minmax(0, 1fr);
			grid-template-areas:
				'chart readout'
				'controls readout';
			align-content: stretch;
		}

		.ao-controls {
			grid-template-columns: repeat(auto-fit, minmax(17.5rem, 1fr));
		}

		.ao-readout {
			align-self: stretch;
			align-content: start;
		}
	}
</style>
