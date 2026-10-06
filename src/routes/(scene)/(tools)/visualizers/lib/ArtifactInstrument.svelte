<script lang="ts">
	import {
		SLOTS,
		SUBSTATS,
		RESIN_PER_RUN,
		RESIN_PER_DAY,
		EXTRA_FIVE_STAR,
		ADVANCED_EXEGESIS,
		substatPool,
		substatById,
		presenceProbability,
		targetLinesChance,
		pieceChance,
		farmMiss,
		farmStats,
		freshOutcome,
		mixOutcomes,
		collapse,
		distStats,
		compareTo,
		percentileOf,
		meanOf,
		rollEvents,
		reshapeDust,
		unitFor,
		primaryMain,
		type SlotId,
		type MainStatId,
		type SubstatId,
		type Outcome,
		type ValueDist
	} from './artifactOdds';
	import {
		inferRollCounts,
		resolvePiece,
		possibleValues,
		pieceNow,
		pieceFuture,
		piecePopulation,
		pieceReshape,
		upgradeTotals,
		type PieceQuery
	} from './appraise';
	import ValueWheel from './ValueWheel.svelte';
	import Mark from '$lib/components/Mark.svelte';

	// ⚓ Three views, a piece's life (Nate, 2026-10-06): it DROPS, it is LEVELLED,
	// and then it is YOUR piece — ranked, levelled further, or reshaped.
	// ⚓ "What counts as good" is the player's set of stats (1–4), not a pair:
	// a reshape selects two lines, and that selection lives on the piece card,
	// where the game puts it (the radial on each line's right).
	type View = 'drop' | 'level' | 'piece';
	const VIEWS: { id: View; label: string }[] = [
		{ id: 'drop', label: 'Drop' },
		{ id: 'level', label: 'Level up' },
		{ id: 'piece', label: 'Your piece' }
	];
	/** Levels by the upgrade they have reached: +0–3 has none, +20 all five */
	const LEVELS = [
		{ at: 0, label: '+0–3' },
		{ at: 4, label: '+4–7' },
		{ at: 8, label: '+8–11' },
		{ at: 12, label: '+12–15' },
		{ at: 16, label: '+16–19' },
		{ at: 20, label: '+20' }
	];
	const RESHAPES = [
		{ floor: 2, label: 'Standard', hint: 'at least 2' },
		{ floor: 3, label: 'Advanced', hint: 'at least 3' },
		{ floor: 4, label: 'Decreed', hint: 'at least 4' }
	] as const;
	const MAX_WANTED = 4;
	/** The main stat a slot starts on (⚓ Nate: sands ATK%, not the list's first HP%) */
	const DEFAULT_MAIN: Partial<Record<SlotId, MainStatId>> = {
		sands: 'atkPct',
		goblet: 'elemDmg',
		circlet: 'cr'
	};
	const DEFAULT_DAYS = 7;

	type Line = { id: SubstatId | ''; raw: string };
	/** The demo piece: a +20 flower with double crit, so the view teaches itself. */
	const demoLines = (): Line[] => [
		{ id: 'cr', raw: '6.6' },
		{ id: 'cd', raw: '21.0' },
		{ id: 'atkPct', raw: '9.9' },
		{ id: 'er', raw: '5.2' }
	];

	// ── State ──────────────────────────────────────────────────────────────
	let view = $state<View>('drop');
	let slotId = $state<SlotId>('flower');
	/** Main stats you'd take. Drop accepts several; the other views use the first. */
	let mains = $state<MainStatId[]>(['hp']);
	/** Your stats — what counts as good */
	let wanted = $state<SubstatId[]>(['cr', 'cd']);
	/** Drop: at least this many of your stats on the piece */
	let atLeast = $state(2);
	let eitherSet = $state(false);
	let days = $state(DEFAULT_DAYS);
	/** Level up: the piece has this many of your stats */
	let levelHas = $state(2);
	let fourLine = $state(true);
	/** Made with Sanctifying Elixir: its two selected lines get ≥2 upgrades by +20 */
	let defined = $state(false);
	let level = $state(20);
	let lines = $state<Line[]>(demoLines());
	/** The card's radials: a reshape's two lines (a defined piece's, too) */
	let selected = $state<SubstatId[]>(['cr', 'cd']);
	let resolutionPick = $state(0);
	let reshapeFloor = $state<2 | 3 | 4>(2);
	/** A value to beat; null = the default (see each view) */
	let refLevel = $state<number | null>(null);
	let refPiece = $state<number | null>(null);

	const slot = $derived(SLOTS.find((s) => s.id === slotId)!);
	const mainStats = $derived(slot.mains.filter((m) => mains.includes(m.id)));
	const main = $derived(primaryMain(slotId, mains));
	const pool = $derived(substatPool(main.id));
	/** Your stats a substat line can hold (the main stat aside) */
	const wantedSubs = $derived(wanted.filter((id) => id !== main.id));
	const unit = $derived(unitFor(wantedSubs));

	function resetRefs() {
		refLevel = null;
		refPiece = null;
	}

	function pickSlot(id: SlotId) {
		slotId = id;
		const s = SLOTS.find((x) => x.id === id)!;
		const kept = mains.filter((m) => s.mains.some((x) => x.id === m));
		mains = kept.length ? kept : [DEFAULT_MAIN[id] ?? s.mains[0].id];
		fixLines();
		resetRefs();
	}

	// Drop takes every main you'd accept; the other views are ONE piece
	function pickMain(id: MainStatId) {
		if (view === 'drop' && slot.mains.length > 1) {
			if (mains.includes(id)) {
				if (mains.length > 1) mains = mains.filter((m) => m !== id);
			} else mains = [...mains, id];
		} else mains = [id, ...mains.filter((m) => m !== id)];
		fixLines();
		resetRefs();
	}

	function toggleWanted(id: SubstatId) {
		if (wanted.includes(id)) {
			if (wanted.length > 1) wanted = wanted.filter((w) => w !== id);
		} else if (wanted.length < MAX_WANTED) wanted = [...wanted, id];
		atLeast = Math.min(Math.max(1, atLeast), wanted.length);
		resetRefs();
	}

	// ── Drop ───────────────────────────────────────────────────────────────
	const linesChance = $derived(targetLinesChance(mainStats, wanted, atLeast));
	const perPiece = $derived(pieceChance(1, linesChance, eitherSet));
	const farm = $derived({
		domain: farmStats(perPiece, false),
		outbreak: farmStats(perPiece, true)
	});
	/** Each of your stats' chance to be one of the piece's four lines */
	const lineChance = $derived(
		Object.fromEntries(
			SUBSTATS.map((s) => [s.id, s.id === main.id ? 0 : presenceProbability(pool, [s.id], 4)])
		) as Record<SubstatId, number>
	);

	/**
	 * The axis runs to where the domain alone is 90% done — the unluckiest
	 * tenth — in whole ticks. ⚓ Nate: people farm a little and look; at 99%
	 * three quarters of the width went to the flat top of the curve.
	 */
	const farmDomain = $derived.by(() => {
		const perRun = (1 - perPiece) * (1 - EXTRA_FIVE_STAR * perPiece);
		const runs = perPiece > 0 ? Math.ceil(Math.log(0.1) / Math.log(perRun)) : 100;
		const span = (runs * RESIN_PER_RUN) / RESIN_PER_DAY;
		const step = niceStep(span, 5);
		return Math.max(step, Math.ceil(span / step) * step);
	});
	const shownDays = $derived(Math.min(days, farmDomain));
	/**
	 * The days slider runs on a SQUARE-ROOT scale, so its first half covers the
	 * first quarter of the axis — the early days, where the chance moves fastest.
	 */
	const SLIDER_STEPS = 1000;
	const sliderOf = (d: number) => Math.round(Math.sqrt(Math.min(1, d / farmDomain)) * SLIDER_STEPS);
	function setDaysFromSlider(t: number) {
		const d = (t / SLIDER_STEPS) ** 2 * farmDomain;
		days = Math.max(1, d < 20 ? Math.round(d) : Math.round(d / 5) * 5);
	}
	const resinOf = (d: number) => Math.floor((d * RESIN_PER_DAY) / RESIN_PER_RUN) * RESIN_PER_RUN;
	const chanceBy = $derived({
		domain: 1 - farmMiss(resinOf(shownDays), perPiece, false),
		outbreak: 1 - farmMiss(resinOf(shownDays), perPiece, true)
	});

	// ── Level up ───────────────────────────────────────────────────────────
	const events = $derived(rollEvents(fourLine));
	const levelK = $derived(Math.min(levelHas, Math.max(1, wantedSubs.length)));
	const levelFloor = $derived(defined && levelK >= 2 ? 2 : 0);
	function levelOutcome(floor: number): Outcome {
		if (!wantedSubs.length) return [];
		// crit with one of the two on the piece: CR or CD, equally likely
		if (unit === 'cv' && levelK === 1 && wantedSubs.length === 2)
			return mixOutcomes(
				wantedSubs.map((id) => ({ w: 0.5, out: freshOutcome(unit, [id], events, floor) }))
			);
		return freshOutcome(unit, wantedSubs.slice(0, levelK), events, floor);
	}
	const levelOut = $derived(levelOutcome(levelFloor));
	const levelGhost = $derived(levelFloor ? collapse(levelOutcome(0)) : null);

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
	/** Every substat has a value (3 are enough at +0–3) */
	const pieceComplete = $derived(pieceLines.length >= (level === 0 ? 3 : 4));
	/** Which levels these values fit — the level chips say so (once there is a piece) */
	const fitsLevel = $derived(
		Object.fromEntries(
			LEVELS.map((l) => [l.at, resolvePiece(lineInferences, l.at).length > 0])
		) as Record<number, boolean>
	);
	const totals = $derived(
		lineInferences.every((i) => i.length) ? upgradeTotals(lineInferences) : []
	);
	const upgradesAt = (at: number) => Math.floor(at / 4);

	const wantedOnPiece = $derived(pieceLines.filter((l) => wantedSubs.includes(l.id)).length);
	const sel = $derived(selected.filter((id) => pieceLines.some((l) => l.id === id)));
	const pieceFloor = $derived(defined && sel.length === 2 ? 2 : 0);

	const query = $derived<PieceQuery | null>(
		resolution && wantedOnPiece > 0
			? {
					unit,
					wanted: wantedSubs,
					main: main.id,
					level,
					lines: pieceLines.map((l) => ({ id: l.id, value: Number(l.raw) })),
					counts: resolution.counts,
					selected: sel
				}
			: null
	);
	const finished = $derived(level >= 20);
	const now = $derived(query ? pieceNow(query) : []);
	const nowX = $derived(meanOf(now));
	/** Every finished piece with these lines: the ranking, and the default to beat */
	const population = $derived(
		query && resolution ? piecePopulation(query, resolution.events, pieceFloor) : []
	);
	const percentile = $derived(population.length ? percentileOf(population, now) : 0);
	const future = $derived(query && !finished ? pieceFuture(query, pieceFloor) : []);
	const canReshape = $derived(query !== null && finished && sel.length === 2);
	const reshaped = $derived(
		canReshape && query && resolution ? pieceReshape(query, resolution.events, reshapeFloor) : []
	);

	// ── The value chart, whichever view draws it ───────────────────────────
	const solid = $derived<Outcome>(
		view === 'level' ? levelOut : finished ? (canReshape ? reshaped : []) : future
	);
	const solidDist = $derived(collapse(solid));
	const ghost = $derived<ValueDist | null>(
		view === 'level' ? levelGhost : finished ? population : null
	);
	const stats = $derived(distStats(solidDist.length ? solidDist : (ghost ?? [])));
	/** The value to beat: dragged, or the default — a typical piece */
	const refDefault = $derived(
		view === 'level' ? distStats(collapse(levelOut)).median : distStats(population).median
	);
	const reference = $derived(
		view === 'level' ? (refLevel ?? refDefault) : finished ? nowX : (refPiece ?? refDefault)
	);
	const odds = $derived(
		finished && view === 'piece'
			? compareTo(collapse(reshaped), now)
			: compareTo(solidDist, [{ x: reference, p: 1 }])
	);

	const fmtLineValue = (id: SubstatId, n: number) =>
		substatById(id).isPct ? n.toFixed(1) : String(n);

	// Wheel options per line: exactly the values the game can display
	const lineOptions = $derived(
		lines.map(({ id }) => (id === '' ? [] : possibleValues(id).map((n) => fmtLineValue(id, n))))
	);

	// Changing a line's stat snaps its value to the nearest legal one
	function setLineStat(index: number, id: SubstatId | '') {
		const old = lines[index].id;
		if (id === '') {
			lines = lines.map((l, i) => (i === index ? { id: '', raw: '' } : l));
		} else {
			const options = possibleValues(id);
			const current = Number(lines[index].raw);
			const nearest =
				Number.isFinite(current) && lines[index].raw !== ''
					? options.reduce((a, b) => (Math.abs(b - current) < Math.abs(a - current) ? b : a))
					: options[0];
			lines = lines.map((l, i) => (i === index ? { id, raw: fmtLineValue(id, nearest) } : l));
		}
		if (old) selected = selected.filter((s) => s !== old);
		resolutionPick = 0;
		resetRefs();
	}

	// A substat can't be the main stat (the game never makes one): a line the
	// new main stat collides with is CLEARED, never swapped for a guess
	function fixLines() {
		lines.forEach((l, i) => {
			if (l.id !== '' && l.id === main.id) setLineStat(i, '');
		});
	}

	/** Blank the card to enter a piece from scratch */
	function clearPiece() {
		lines = [
			{ id: '', raw: '' },
			{ id: '', raw: '' },
			{ id: '', raw: '' },
			{ id: '', raw: '' }
		];
		selected = [];
		resolutionPick = 0;
		resetRefs();
	}

	function setLevel(at: number) {
		level = at;
		resolutionPick = 0;
		refPiece = null;
		fixLines();
	}

	// The game's radial: two at most, and a third waits for one to be cleared
	function toggleSelected(id: SubstatId) {
		if (selected.includes(id)) selected = selected.filter((s) => s !== id);
		else if (sel.length < 2) selected = [...sel, id];
	}

	// An ambiguous line's badge cycles the readings
	function cycleReading() {
		resolutionPick = (resolutionPick + 1) % Math.max(1, resolutions.length);
	}
	const countOptions = (i: number) => [...new Set(resolutions.map((r) => r.counts[i]))];

	// ── Formatting ─────────────────────────────────────────────────────────
	const fmtPct = (p: number, digits = 1) => {
		// never print a certainty the model doesn't have, nor a zero it doesn't either
		const s = (p * 100).toFixed(digits);
		if (p < 1 && Number(s) >= 100) return `>${(100 - 10 ** -digits).toFixed(digits)}%`;
		if (p > 0 && Number(s) <= 0) return `<${(10 ** -digits).toFixed(digits)}%`;
		return `${s}%`;
	};
	/** "N in 100", rounded, never 0 or 100 for an uncertain thing */
	const inHundred = (p: number) => Math.min(99, Math.max(p > 0 ? 1 : 0, Math.round(p * 100)));
	const oneIn = (p: number) => (p > 0 ? Math.round(1 / p).toLocaleString('en-US') : '—');
	const fmtNum = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');
	const fmtDays = (resin: number) => {
		if (!Number.isFinite(resin)) return '—';
		const d = resin / RESIN_PER_DAY;
		return d < 10 ? d.toFixed(1) : fmtNum(d);
	};
	const fmtValue = (x: number) => x.toFixed(1);
	const unitWord = $derived(unit === 'cv' ? 'CV' : 'useful rolls');
	const valueOf = (x: number) => `${fmtValue(x)} ${unitWord}`;
	const slotWord = $derived(slot.name.toLowerCase());
	/** ⚠️ Sands is its own plural */
	const slotPlural = $derived(slotId === 'sands' ? 'sands' : `${slotWord}s`);
	const statList = (ids: SubstatId[]) => ids.map((id) => substatById(id).short).join(', ');

	// ── Geometry ───────────────────────────────────────────────────────────
	let graphW = $state(720);
	const PADL = 44;
	const PADR = 16;
	const TOP = 26;
	const PLOT_H = 200;
	const plotY1 = TOP + PLOT_H;
	const H = plotY1 + 30;
	/** Axis labels stay at least this far apart (as in the ICD Timeline). */
	const MIN_TICK_PX = 44;
	const plotW = $derived(Math.max(1, graphW - PADL - PADR));

	/** The smallest 1/2/5 × 10ⁿ step that cuts `span` into at most `parts`. */
	function niceStep(span: number, parts: number) {
		const raw = span / Math.max(1, parts);
		const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
		return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
	}

	// The farming chart: chance of the piece by days of resin, two curves
	const farmXOf = $derived((d: number) => PADL + (d / farmDomain) * plotW);
	const yOf = (p: number) => plotY1 - p * (PLOT_H - 8);
	const farmTicks = $derived.by(() => {
		const step = niceStep(farmDomain, Math.floor(plotW / MIN_TICK_PX / 1.6));
		return Array.from({ length: Math.floor(farmDomain / step + 1e-9) + 1 }, (_, i) => i * step);
	});
	function farmPath(outbreak: boolean) {
		const n = Math.min(240, Math.max(2, Math.round(plotW / 3)));
		let d = '';
		for (let i = 0; i <= n; i++) {
			const at = (i / n) * farmDomain;
			const p = 1 - farmMiss(resinOf(at), perPiece, outbreak);
			d += `${i ? ' L' : 'M'}${farmXOf(at).toFixed(1)},${yOf(p).toFixed(1)}`;
		}
		return d;
	}
	const farmLabelX = $derived({
		domain: farmXOf(Math.min(farm.domain.median / RESIN_PER_DAY, farmDomain)),
		outbreak: farmXOf(Math.min(farm.outbreak.median / RESIN_PER_DAY, farmDomain))
	});

	// The value histogram: 1-CV or 0.1-roll bins, stacked by upgrades into your stats
	const binW = $derived(unit === 'cv' ? 1 : 0.1);
	const binOf = (x: number) => Math.round(Math.floor(x / binW + 1e-6) * binW * 10) / 10;
	type Bin = { x: number; p: number; byK: number[] };
	const solidBins = $derived.by<Bin[]>(() => {
		const out: Bin[] = [];
		for (const o of solid) {
			const x = binOf(o.x);
			let bin = out.find((b) => b.x === x);
			if (!bin) out.push((bin = { x, p: 0, byK: [0, 0, 0, 0, 0, 0] }));
			bin.p += o.p;
			bin.byK[o.k] += o.p;
		}
		return out.sort((a, b) => a.x - b.x);
	});
	const ghostBins = $derived.by(() => {
		const out: { x: number; p: number }[] = [];
		for (const d of ghost ?? []) {
			const x = binOf(d.x);
			const last = out.find((b) => b.x === x);
			if (last) last.p += d.p;
			else out.push({ x, p: d.p });
		}
		return out.sort((a, b) => a.x - b.x);
	});
	const ks = $derived([...new Set(solid.map((o) => o.k))].sort((a, b) => a - b));
	const histX0 = $derived(
		Math.min(
			solidBins[0]?.x ?? Infinity,
			ghostBins[0]?.x ?? Infinity,
			view === 'piece' && query ? binOf(nowX) : Infinity
		)
	);
	const histX1 = $derived(
		Math.max(
			(solidBins.at(-1)?.x ?? -Infinity) + binW,
			(ghostBins.at(-1)?.x ?? -Infinity) + binW,
			view === 'piece' && query ? binOf(nowX) + binW : -Infinity
		)
	);
	/** A few outcomes shouldn't turn into a handful of slabs: the axis spans at least this */
	const MIN_SPAN = $derived(unit === 'cv' ? 12 : 1.5);
	const histLo = $derived(
		Math.max(0, Math.min(histX0, histX1 - MIN_SPAN / 2 - (histX1 - histX0) / 2))
	);
	const histHi = $derived(Math.max(histX1, histLo + MIN_SPAN));
	const histMax = $derived(
		Math.max(1e-9, ...solidBins.map((b) => b.p), ...ghostBins.map((b) => b.p))
	);
	const histXOf = $derived((x: number) => PADL + ((x - histLo) / (histHi - histLo)) * plotW);
	const barW = $derived(Math.max(1, (binW / (histHi - histLo)) * plotW - 1));
	const barH = (p: number) => PLOT_H * (p / histMax);
	const histTicks = $derived.by(() => {
		const step = Math.max(binW, niceStep(histHi - histLo, Math.floor(plotW / MIN_TICK_PX / 1.4)));
		const first = Math.ceil(histLo / step - 1e-9) * step;
		return Array.from(
			{ length: Math.max(0, Math.floor((histHi - first) / step + 1e-9) + 1) },
			(_, i) => Math.round((first + i * step) * 10) / 10
		);
	});
	/** Upgrades into your stats → shade: more upgrades, denser gold */
	const kOpacity = (k: number) => 0.2 + (0.8 * k) / 5;
	/** A reference can be dragged in Level up and on an unfinished piece */
	const draggable = $derived(view === 'level' || (view === 'piece' && !finished));

	// Point to read; press and drag moves the value to beat (or the farming day)
	let hoverX = $state<number | null>(null);
	let scrubbing = $state(false);
	function chartX(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		return (e.clientX - rect.left - PADL) / plotW;
	}
	function scrub(e: PointerEvent) {
		const frac = Math.min(1, Math.max(0, chartX(e)));
		if (view === 'drop') {
			days = Math.max(1, Math.round(frac * farmDomain));
			return;
		}
		const x = Math.round((histLo + frac * (histHi - histLo)) * 10) / 10;
		if (view === 'level') refLevel = x;
		else refPiece = x;
	}
	function onDown(e: PointerEvent) {
		if (view !== 'drop' && !draggable) return;
		scrubbing = true;
		scrub(e);
		(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
	}
	function onMove(e: PointerEvent) {
		if (scrubbing) scrub(e);
		if (view !== 'drop') {
			const x = histLo + chartX(e) * (histHi - histLo);
			hoverX = x < histLo || x > histHi ? null : binOf(x);
		}
	}
	function onUp(e: PointerEvent) {
		scrubbing = false;
		const el = e.currentTarget as SVGSVGElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}
	const hovered = $derived.by(() => {
		if (hoverX === null) return null;
		const at = hoverX;
		const bin = solidBins.find((b) => b.x === at);
		const reach = solidDist.reduce((acc, d) => (d.x >= at - 1e-9 ? acc + d.p : acc), 0);
		return { x: at, p: bin?.p ?? 0, reach };
	});

	// ── Workspace handle (share + reset) ───────────────────────────────────
	export function reset() {
		view = 'drop';
		slotId = 'flower';
		mains = ['hp'];
		wanted = ['cr', 'cd'];
		atLeast = 2;
		eitherSet = false;
		days = DEFAULT_DAYS;
		levelHas = 2;
		fourLine = true;
		defined = false;
		level = 20;
		lines = demoLines();
		selected = ['cr', 'cd'];
		resolutionPick = 0;
		reshapeFloor = 2;
		resetRefs();
	}

	export function getShareState() {
		return {
			v: 1,
			view,
			slot: slotId,
			mains,
			wanted,
			atLeast,
			eitherSet,
			days,
			levelHas,
			fourLine,
			defined,
			level,
			selected,
			reshape: reshapeFloor,
			lines: lines.map((l) => [l.id, l.raw])
		};
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		const isSub = (x: unknown): x is SubstatId =>
			typeof x === 'string' && SUBSTATS.some((ss) => ss.id === x);
		const int = (v: unknown, lo: number, hi: number) =>
			typeof v === 'number' && Number.isFinite(v)
				? Math.min(hi, Math.max(lo, Math.round(v)))
				: undefined;
		if (typeof s.slot === 'string' && SLOTS.some((x) => x.id === s.slot)) slotId = s.slot as SlotId;
		const sl = SLOTS.find((x) => x.id === slotId)!;
		if (Array.isArray(s.mains)) {
			const m = s.mains.filter((x) => sl.mains.some((mm) => mm.id === x)) as MainStatId[];
			mains = m.length ? [...new Set(m)] : [sl.mains[0].id];
		} else mains = [sl.mains[0].id];
		if (Array.isArray(s.wanted)) {
			const w = [...new Set(s.wanted.filter(isSub))].slice(0, MAX_WANTED);
			if (w.length) wanted = w;
		}
		atLeast = Math.min(wanted.length, int(s.atLeast, 1, MAX_WANTED) ?? atLeast);
		if (typeof s.eitherSet === 'boolean') eitherSet = s.eitherSet;
		if (typeof s.days === 'number' && Number.isFinite(s.days))
			days = Math.min(100_000, Math.max(0.1, s.days));
		levelHas = int(s.levelHas, 1, MAX_WANTED) ?? levelHas;
		if (typeof s.fourLine === 'boolean') fourLine = s.fourLine;
		if (typeof s.defined === 'boolean') defined = s.defined;
		if (typeof s.level === 'number' && LEVELS.some((l) => l.at === s.level)) level = s.level;
		if (s.reshape === 2 || s.reshape === 3 || s.reshape === 4) reshapeFloor = s.reshape;
		if (Array.isArray(s.lines) && s.lines.length === 4) {
			const next: Line[] = [];
			for (const item of s.lines) {
				if (!Array.isArray(item)) break;
				const [id, raw] = item;
				if (typeof raw !== 'string' || raw.length > 8 || !(id === '' || isSub(id))) break;
				next.push({ id, raw });
			}
			const ids = next.map((l) => l.id).filter((id) => id !== '');
			// distinct stats only — duplicates would break roll inference; only the
			// 4th may be empty, and only at +0–3
			const emptyOk = next.every((l, i) => l.id !== '' || (i === 3 && level === 0));
			if (next.length === 4 && new Set(ids).size === ids.length && emptyOk) {
				lines = next;
				resolutionPick = 0;
			}
		}
		if (Array.isArray(s.selected)) selected = [...new Set(s.selected.filter(isSub))].slice(0, 2);
		fixLines();
		resetRefs();
		if (typeof s.view === 'string' && VIEWS.some((v) => v.id === s.view)) view = s.view as View;
	}
</script>

{#snippet oddsBar(
	o: { below: number; equal: number; above: number },
	labels: [string, string, string]
)}
	<div class="ao-odds">
		<div
			class="ao-odds-bar"
			role="img"
			aria-label="{labels[2]} {fmtPct(o.above)}, {labels[1]} {fmtPct(o.equal)}, {labels[0]} {fmtPct(
				o.below
			)}"
		>
			<span class="ao-odds-seg is-below" style:flex-grow={o.below}></span>
			<span class="ao-odds-seg is-equal" style:flex-grow={o.equal}></span>
			<span class="ao-odds-seg is-above" style:flex-grow={o.above}></span>
		</div>
		<div class="ao-odds-keys">
			<span><i class="is-below"></i>{labels[0]} <b>{fmtPct(o.below, 0)}</b></span>
			{#if o.equal > 0.0005}
				<span><i class="is-equal"></i>{labels[1]} <b>{fmtPct(o.equal, 0)}</b></span>
			{/if}
			<span><i class="is-above"></i>{labels[2]} <b>{fmtPct(o.above, 0)}</b></span>
		</div>
	</div>
{/snippet}

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

		{#if view === 'drop'}
			<div class="ao-graph" bind:clientWidth={graphW}>
				<svg
					width={graphW}
					height={H}
					role="img"
					aria-label="Chance of this piece by days of resin"
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
							{fmtNum(t)}
						</text>
					{/each}
					<text
						x={graphW - PADR}
						y={plotY1 + 28}
						fill="var(--chart-dim)"
						font-size="10"
						text-anchor="end"
					>
						days of resin
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
					<text x="4" y={TOP - 10} fill="var(--chart-dim)" font-size="10" text-anchor="start">
						chance you have it by then
					</text>

					<path
						d={farmPath(true)}
						fill="none"
						stroke="var(--chart-ink)"
						stroke-width="1.25"
						stroke-linejoin="round"
					/>
					<path
						d={farmPath(false)}
						fill="none"
						stroke="var(--text)"
						stroke-width="2"
						stroke-linejoin="round"
					/>
					<text
						class="ao-word"
						x={farmLabelX.outbreak - 6}
						y={yOf(0.5) - 6}
						fill="var(--chart-ink)"
						font-size="11"
						text-anchor="end"
					>
						In an Outbreak
					</text>
					<text
						class="ao-word"
						x={farmLabelX.domain + 6}
						y={yOf(0.5) + 14}
						fill="var(--text)"
						font-size="11"
						font-weight="600"
					>
						Domain
					</text>

					<line
						x1={farmXOf(shownDays)}
						y1={TOP}
						x2={farmXOf(shownDays)}
						y2={plotY1}
						stroke="var(--chart-ink)"
						stroke-width="1.5"
					/>
					{#each [chanceBy.outbreak, chanceBy.domain] as p, i (i)}
						<circle
							cx={farmXOf(shownDays)}
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
				Drag along the chart to choose how many days of resin you spend ({RESIN_PER_DAY} a day). In an
				Outbreak: every run during a Stygian Onslaught Disturbance Outbreak, which adds one more 5★ from
				the domain for each 120 resin.
			</p>
		{:else if view === 'level' && !wantedSubs.length}
			<p class="ao-empty">Your only stat is the main stat — pick a substat too.</p>
		{:else if view === 'piece' && !resolution}
			<div class="ao-empty">
				{#if pieceLines.length < (level === 0 ? 3 : 4)}
					<p>
						Enter your piece's substats{level === 0
							? ' — three, or four if it dropped with four'
							: ' — all four'}.
					</p>
				{:else if lineInferences.some((i) => !i.length)}
					<p>A value doesn't match any roll this stat can make — check it against the game.</p>
				{:else}
					<p>
						These values add up to {totals.join(' or ')} upgrade{totals.at(-1) === 1 ? '' : 's'},
						but a {LEVELS.find((l) => l.at === level)?.label} piece has had {Math.max(
							0,
							upgradesAt(level) - 1
						)}–{upgradesAt(level)}.
					</p>
					{#if LEVELS.some((l) => fitsLevel[l.at])}
						<p>
							They fit {LEVELS.filter((l) => fitsLevel[l.at])
								.map((l) => l.label)
								.join(' or ')}.
						</p>
					{/if}
				{/if}
			</div>
		{:else if view === 'piece' && wantedOnPiece === 0}
			<p class="ao-empty">None of your stats is on this piece.</p>
		{:else}
			<div class="ao-graph" bind:clientWidth={graphW}>
				<svg
					width={graphW}
					height={H}
					role="img"
					aria-label="{unit === 'cv' ? 'Crit value' : 'Useful rolls'} at +20"
					onpointerdown={onDown}
					onpointermove={onMove}
					onpointerup={onUp}
					onpointercancel={onUp}
					onpointerleave={() => (hoverX = null)}
					style:cursor={draggable ? 'ew-resize' : 'default'}
				>
					<!-- The likely range: the middle half of outcomes -->
					{#if solidBins.length}
						<rect
							x={histXOf(binOf(stats.p25))}
							y={TOP}
							width={Math.max(2, histXOf(binOf(stats.p75) + binW) - histXOf(binOf(stats.p25)))}
							height={PLOT_H}
							fill="var(--text)"
							fill-opacity="0.05"
						/>
						<text
							class="ao-word"
							x={histXOf(binOf(stats.p25)) + 4}
							y={TOP + 11}
							fill="var(--chart-dim)"
							font-size="10"
						>
							likely
						</text>
					{/if}
					{#each ghostBins as bin (bin.x)}
						<rect
							x={histXOf(bin.x) + 0.5}
							y={plotY1 - barH(bin.p)}
							width={barW}
							height={barH(bin.p)}
							fill="var(--chart-grid)"
						/>
					{/each}
					{#each solidBins as bin (bin.x)}
						{@const inset = ghostBins.length ? barW * 0.2 : 0}
						{#each ks as k (k)}
							{@const under = bin.byK.slice(0, k).reduce((a, b) => a + b, 0)}
							{#if bin.byK[k] > 0}
								<rect
									x={histXOf(bin.x) + 0.5 + inset}
									y={plotY1 - barH(under + bin.byK[k])}
									width={Math.max(1, barW - 2 * inset)}
									height={barH(bin.byK[k])}
									fill="var(--accent)"
									fill-opacity={hoverX === bin.x ? Math.min(1, kOpacity(k) + 0.15) : kOpacity(k)}
								/>
							{/if}
						{/each}
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
							{unit === 'cv' ? t : t.toFixed(1)}
						</text>
					{/each}
					<text
						x={graphW - PADR}
						y={plotY1 + 28}
						fill="var(--chart-dim)"
						font-size="10"
						text-anchor="end"
					>
						{unit === 'cv' ? 'crit value (CV) at +20' : 'useful rolls in your stats at +20'}
					</text>

					{#if view === 'level' || query}
						{@const mx = histXOf(view === 'piece' && finished ? binOf(nowX) + binW / 2 : reference)}
						<line
							x1={mx}
							y1={TOP - 4}
							x2={mx}
							y2={plotY1}
							stroke="var(--text)"
							stroke-width="1.5"
							stroke-dasharray="4 4"
						/>
						<text
							x={mx}
							y={TOP - 9}
							fill="var(--text)"
							font-size="10"
							font-weight="600"
							text-anchor={mx > graphW - 90 ? 'end' : mx < PADL + 60 ? 'start' : 'middle'}
						>
							{view === 'piece' && finished
								? `your piece · ${fmtValue(nowX)}`
								: `to beat · ${fmtValue(reference)}`}
						</text>
					{/if}
				</svg>
			</div>
			<div class="ao-legend">
				<span class="ao-legend-title">Upgrades into your stats</span>
				{#each ks as k (k)}
					<span class="ao-legend-key">
						<i
							style:background="color-mix(in srgb, var(--accent) {Math.round(kOpacity(k) * 100)}%,
							transparent)"
						></i>{k}
					</span>
				{/each}
				{#if ghost}
					<span class="ao-legend-key"
						><i class="is-ghost"></i>{view === 'level' ? 'farmed' : 'every piece like it'}</span
					>
				{/if}
			</div>
			<p class="note ao-probe">
				{#if hovered}
					<span class="ao-strong">{valueOf(hovered.x)}</span>: {fmtPct(hovered.p)} of outcomes ·
					{fmtPct(hovered.reach)} reach at least {fmtValue(hovered.x)}
				{:else if view === 'level'}
					Your {statList(wantedSubs.slice(0, levelK))} on a {slotWord} that has {levelK === 1
						? 'one of them'
						: 'them'}, levelled to +20 ({events} upgrades{levelFloor
						? ', at least 2 into your stats'
						: ''}). Drag to set a value to beat.
				{:else if !finished}
					What your stats on this piece can reach by +20. Drag to set a value to beat.
				{:else if canReshape}
					Gold: after a {RESHAPES.find((r) => r.floor === reshapeFloor)?.label} reshape. Grey: every finished
					{slotWord} with these substats.
				{:else}
					Every finished {slotWord} with these substats. Circle two lines on your piece to see a reshape.
				{/if}
			</p>
		{/if}
	</div>

	<!-- ONE panel, a section per question (the Wish Odds layout) -->
	<div class="panel ao-controls">
		{#if view !== 'piece'}
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
				<div class="chips" role="group" aria-label="Main stat">
					{#each slot.mains as m (m.id)}
						{@const on = view === 'drop' ? mains.includes(m.id) : m.id === main.id}
						{@const chance = view === 'drop' && slot.mains.length > 1}
						<button
							class="chip chip--control"
							class:ao-chance-chip={chance}
							class:active={on}
							aria-pressed={on}
							onclick={() => pickMain(m.id)}
						>
							<span>{m.name}</span>
							{#if chance}
								<span class="ao-chance"
									>{fmtPct(m.chance, m.chance < 0.05 ? 1 : 0)}{m.each ? ' each' : ''}</span
								>
							{/if}
						</button>
					{/each}
				</div>
				{#if view === 'drop' && slot.mains.length > 1}
					<p class="note">Pick every main stat you'd take. Under each: how often it drops.</p>
				{/if}
			</section>
		{/if}

		<section class="ao-section">
			<p class="kicker">Your stats</p>
			<div class="chips ao-dense" role="group" aria-label="Your stats">
				{#each SUBSTATS as s (s.id)}
					{@const on = wanted.includes(s.id)}
					<button
						class="chip chip--control"
						class:ao-chance-chip={view === 'drop'}
						class:active={on}
						aria-pressed={on}
						disabled={!on && wanted.length >= MAX_WANTED}
						onclick={() => toggleWanted(s.id)}
					>
						<span>{s.short}</span>
						{#if view === 'drop'}
							<span class="ao-chance"
								>{s.id === main.id ? 'main' : fmtPct(lineChance[s.id], 0)}</span
							>
						{/if}
					</button>
				{/each}
			</div>
			<p class="note">
				What counts as good, up to four.
				{#if view === 'drop'}
					Under each: its chance to be one of the substats on a {slotWord} with {main.name} main.
				{/if}
			</p>
			{#if view === 'drop' && wanted.length > 1}
				<div class="chips" role="group" aria-label="How many of them">
					{#each Array.from({ length: wanted.length }, (_, i) => i + 1) as n (n)}
						<button
							class="chip chip--control"
							class:active={atLeast === n}
							aria-pressed={atLeast === n}
							onclick={() => (atLeast = n)}
						>
							{n === wanted.length ? (n === 2 ? 'Both' : `All ${n}`) : `At least ${n}`}
						</button>
					{/each}
				</div>
			{/if}
		</section>

		{#if view === 'drop'}
			<section class="ao-section">
				<p class="kicker">Farming</p>
				<div class="slider-control">
					<div class="slider-header">
						<span class="slider-label">Days of resin</span>
						<span class="readout">{fmtNum(shownDays)}</span>
					</div>
					<input
						type="range"
						min="0"
						max={SLIDER_STEPS}
						step="1"
						value={sliderOf(shownDays)}
						oninput={(e) => setDaysFromSlider(Number(e.currentTarget.value))}
						class="slider"
						aria-label="Days of resin"
						aria-valuetext="{fmtNum(shownDays)} days"
					/>
				</div>
				<div class="chips">
					<button
						class="chip chip--control"
						class:active={!eitherSet}
						aria-pressed={!eitherSet}
						onclick={() => (eitherSet = false)}
					>
						One of the domain's sets
					</button>
					<button
						class="chip chip--control"
						class:active={eitherSet}
						aria-pressed={eitherSet}
						onclick={() => (eitherSet = true)}
					>
						Either set
					</button>
				</div>
			</section>
		{:else if view === 'level'}
			<section class="ao-section">
				<p class="kicker">The piece</p>
				{#if wantedSubs.length > 1}
					<div class="chips" role="group" aria-label="How many of your stats it has">
						{#each Array.from({ length: wantedSubs.length }, (_, i) => i + 1) as n (n)}
							<button
								class="chip chip--control"
								class:active={levelK === n}
								aria-pressed={levelK === n}
								onclick={() => (levelHas = n)}
							>
								Has {n === wantedSubs.length && n > 1 ? `all ${n}` : n}
							</button>
						{/each}
					</div>
				{/if}
				<div class="chips">
					<button
						class="chip chip--control"
						class:active={fourLine}
						aria-pressed={fourLine}
						onclick={() => (fourLine = true)}
					>
						Dropped with 4 substats
					</button>
					<button
						class="chip chip--control"
						class:active={!fourLine}
						aria-pressed={!fourLine}
						onclick={() => (fourLine = false)}
					>
						With 3
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
						disabled={levelK < 2}
						onclick={() => (defined = true)}
					>
						Made with Elixir
					</button>
				</div>
				<p class="note">
					A 4-substat drop gets 5 upgrades by +20; a 3-substat drop spends its first adding the 4th.
					{#if defined && levelK >= 2}
						Made with Sanctifying Elixir: two of your stats are guaranteed at least 2 of them.
					{/if}
				</p>
			</section>
		{:else}
			<section class="ao-section">
				<p class="kicker">Your piece</p>
				<div class="ao-card">
					<div class="ao-card-head">
						<div class="ao-slots ao-slots--small">
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
						<button class="chip chip--control ao-clear" onclick={clearPiece}>
							<Mark name="reset" size={12} />
							<span>Clear</span>
						</button>
					</div>
					<div class="ao-main-row">
						<span class="ao-main-mark" aria-hidden="true"><Mark name="star" size={12} /></span>
						{#if slot.mains.length > 1}
							<span class="ao-pick">
								<select
									class="ao-select"
									value={main.id}
									onchange={(e) => pickMain(e.currentTarget.value as MainStatId)}
									aria-label="Main stat"
								>
									{#each slot.mains as m (m.id)}
										<option value={m.id}>{m.name}</option>
									{/each}
								</select>
								<Mark name="chevron" size={12} />
							</span>
						{:else}
							<span class="ao-main-fixed">{main.name}</span>
						{/if}
					</div>
					{#each lines as line, i (i)}
						{@const at = pieceLines.findIndex((l) => l.id === line.id)}
						{@const options = at >= 0 ? countOptions(at) : []}
						{@const isWanted = line.id !== '' && wantedSubs.includes(line.id)}
						{@const isSel = line.id !== '' && sel.includes(line.id)}
						<div class="ao-line" class:is-wanted={isWanted}>
							{#if line.id === ''}
								<span class="ao-badge is-none" aria-hidden="true"></span>
							{:else if resolution && options.length > 1}
								<button
									class="ao-badge is-choice"
									onclick={cycleReading}
									title="These values can be read two ways — match the number the game shows"
									aria-label="Upgrades: {resolution.counts[at] - 1}. Tap for the other reading"
								>
									{resolution.counts[at] - 1}
								</button>
							{:else if resolution}
								<span class="ao-badge" class:is-zero={resolution.counts[at] === 1}
									>{resolution.counts[at] > 1 ? resolution.counts[at] - 1 : ''}</span
								>
							{:else}
								<span class="ao-badge is-unknown" aria-hidden="true">?</span>
							{/if}
							<span class="ao-pick" class:is-blank={line.id === ''}>
								<select
									class="ao-select"
									value={line.id}
									onchange={(e) => setLineStat(i, e.currentTarget.value as SubstatId | '')}
									aria-label="Substat {i + 1}"
								>
									<option value="">{i === 3 && level === 0 ? 'Not yet' : 'Substat…'}</option>
									{#each SUBSTATS as s (s.id)}
										{#if s.id !== main.id && (s.id === line.id || !lines.some((l) => l.id === s.id))}
											<option value={s.id}>{s.name}</option>
										{/if}
									{/each}
								</select>
								<Mark name="chevron" size={12} />
							</span>
							{#if line.id !== ''}
								<ValueWheel
									values={lineOptions[i]}
									bind:value={lines[i].raw}
									label="Value for substat {i + 1}"
								/>
								<button
									class="ao-radial"
									class:is-on={isSel}
									disabled={!isSel && sel.length >= 2}
									aria-pressed={isSel}
									aria-label="Select {substatById(line.id).name} for a reshape"
									onclick={() => toggleSelected(line.id as SubstatId)}
								></button>
							{:else}
								<span class="ao-blank-value" aria-hidden="true">—</span><span></span>
							{/if}
						</div>
					{/each}
				</div>
				<div class="chips ao-dense ao-levels" role="group" aria-label="Level">
					{#each LEVELS as l (l.at)}
						<button
							class="chip chip--control"
							class:active={level === l.at}
							class:is-misfit={pieceComplete && !fitsLevel[l.at]}
							aria-pressed={level === l.at}
							onclick={() => setLevel(l.at)}
						>
							{l.label}
						</button>
					{/each}
				</div>
				<p class="note">
					{#if resolution}
						The number on the left is each line's upgrades, as the game shows them when you reshape.
						Your stats are highlighted; the circles on the right pick a reshape's two lines.
					{:else if pieceComplete}
						Pick your piece's level — the ones these values can't be are dimmed.
					{:else}
						Choose each substat and dial in its value as the game shows it, then the piece's level.
					{/if}
				</p>
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
						Made with Elixir
					</button>
				</div>
				{#if defined}
					<p class="note">
						Circle the two substats you defined: they get at least 2 upgrades between them by +20.
					</p>
				{/if}
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
								{r.label}&nbsp;<span class="chip-sub">{r.hint}</span>
							</button>
						{/each}
					</div>
					<p class="note">
						{#if canReshape}
							The two circled lines get at least this many of the piece's upgrades. It costs {reshapeDust(
								slotId
							)} Dust of Enlightenment for a {slotWord}; every {ADVANCED_EXEGESIS} Dust you spend makes
							the next reshape Advanced, and the third Advanced is Decreed.
						{:else}
							Circle two lines on your piece to reshape it.
						{/if}
					</p>
				</section>
			{/if}
		{/if}
	</div>

	<div class="panel panel--paper ao-readout">
		<p class="kicker">Readout</p>
		{#if view === 'drop'}
			<p class="ao-big">
				{inHundred(chanceBy.domain)} in 100<span class="ao-big-unit"
					>players farming the domain for {fmtValue(shownDays).replace(/\.0$/, '')} day{shownDays ===
					1
						? ''
						: 's'} have this piece</span
				>
			</p>
			<table class="ao-table">
				<thead>
					<tr>
						<th scope="col">Days of resin</th>
						<th scope="col" class="ao-num">Half have it by</th>
						<th scope="col" class="ao-num">Unluckiest tenth</th>
					</tr>
				</thead>
				<tbody>
					<tr class="is-goal">
						<th scope="row">Domain</th>
						<td class="ao-num">{fmtDays(farm.domain.median)}</td>
						<td class="ao-num">{fmtDays(farm.domain.p90)}</td>
					</tr>
					<tr>
						<th scope="row">In an Outbreak</th>
						<td class="ao-num">{fmtDays(farm.outbreak.median)}</td>
						<td class="ao-num">{fmtDays(farm.outbreak.p90)}</td>
					</tr>
				</tbody>
			</table>
			<p class="ao-meta">
				<span class="ao-strong">1 in {oneIn(perPiece)}</span> of the domain's 5★ drops is this piece.
			</p>
			<p class="note">
				{fmtNum(resinOf(shownDays))} resin is {fmtNum(resinOf(shownDays) / RESIN_PER_RUN)} runs. The unluckiest
				tenth of players need at least the days in the last column.
			</p>
		{:else if view === 'level'}
			{#if wantedSubs.length}
				<p class="ao-big">
					{fmtPct(odds.above, 0)}<span class="ao-big-unit"
						>chance to end above {valueOf(reference)}</span
					>
				</p>
				{@render oddsBar(odds, ['Below', 'Equal', 'Above'])}
				<p class="ao-meta">
					Likely: <span class="ao-strong">{fmtValue(stats.p25)}–{fmtValue(stats.p75)}</span>
					{unitWord}
				</p>
				<p class="ao-meta">Typical: <span class="ao-strong">{valueOf(stats.median)}</span></p>
				{#if unit === 'rolls'}
					<p class="note">
						Useful rolls: each roll into your stats counts by its size — a top roll 1, the smallest
						0.7 — and a line's first roll counts too.
					</p>
				{/if}
			{/if}
		{:else if !query}
			<p class="note">Enter your piece to see how it measures up.</p>
		{:else if !finished}
			<p class="ao-big">
				{fmtPct(odds.above, 0)}<span class="ao-big-unit"
					>chance it ends above {valueOf(reference)}</span
				>
			</p>
			{@render oddsBar(odds, ['Below', 'Equal', 'Above'])}
			<p class="ao-meta">Now: <span class="ao-strong">{valueOf(nowX)}</span></p>
			<p class="ao-meta">
				Likely at +20: <span class="ao-strong">{fmtValue(stats.p25)}–{fmtValue(stats.p75)}</span>
				{unitWord}
			</p>
			{#if refPiece === null}
				<p class="note">
					The default to beat is a typical finished {slotWord} with these substats.
				</p>
			{/if}
		{:else}
			<p class="ao-big">
				Better than {Math.round(percentile * 100)}%<span class="ao-big-unit"
					>of finished {slotPlural} with these substats</span
				>
			</p>
			<p class="ao-meta">
				{statList(wantedSubs.filter((id) => pieceLines.some((l) => l.id === id)))}:
				<span class="ao-strong">{valueOf(nowX)}</span>
			</p>
			{#if canReshape}
				<p class="ao-sub">
					After a {RESHAPES.find((r) => r.floor === reshapeFloor)?.label} reshape
				</p>
				{@render oddsBar(odds, ['Worse', 'The same', 'Better'])}
				<p class="note">
					A reshape keeps each line's first roll and deals the upgrades again. You choose whether to
					keep the result.
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

	/* min-width 0 + a capped svg: otherwise the svg's own width props the box
	   open, the measured width never shrinks, and a narrower tile clips the
	   chart's right end */
	.ao-graph {
		min-width: 0;
	}

	.ao-graph svg {
		display: block;
		max-width: 100%;
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

	/* As tall as a chart + its legend + note, so the controls don't jump when
	   a piece stops resolving (the next value you dial brings the chart back) */
	.ao-empty {
		display: grid;
		align-content: center;
		min-height: calc(256px + 4.6rem);
		margin: 0;
		padding: 0 0.5rem;
		text-align: center;
		color: var(--muted);
	}

	.ao-empty p {
		margin: 0 0 0.4rem;
	}

	.ao-probe {
		min-height: 2.6em;
	}

	.ao-legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.7rem;
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	.ao-legend-title {
		font-weight: var(--fw-semibold);
	}

	.ao-legend-key {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-variant-numeric: tabular-nums;
	}

	.ao-legend-key i {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}

	.ao-legend-key i.is-ghost {
		background: var(--chart-grid);
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

	.ao-slots--small .ao-slot {
		width: 34px;
		height: 34px;
		padding: 3px;
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

	/* The densest chip rows (ten substats, six levels) */
	.ao-dense :global(.chip) {
		font-family: var(--font-condensed);
	}

	.ao-levels :global(.chip) {
		padding-inline: 0.4rem;
	}

	/* A chip with its chance UNDER its name: side by side, "ATK 58%" read as
	   58% ATK (⚓ Nate) — a second line makes the number a fact about the chip */
	.ao-chance-chip {
		display: inline-grid;
		justify-items: center;
		gap: 0.05rem;
		padding-block: 0.3rem 0.25rem;
		line-height: 1.1;
	}

	.ao-chance {
		font-family: var(--font-body);
		font-size: var(--fs-xs);
		font-weight: var(--fw-normal);
		letter-spacing: 0;
		text-transform: none;
		opacity: 0.7;
		font-variant-numeric: tabular-nums;
	}

	.ao-dense :global(.chip.is-misfit:not(.active)) {
		opacity: 0.45;
	}

	/* ── The piece card: the game's reshape screen, line for line ─────────── */

	.ao-card {
		display: grid;
		gap: 0.3rem;
	}

	.ao-card-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.2rem;
	}

	.ao-clear {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	/* The main stat sits on its own row, above the four substats (the game's) */
	.ao-main-row {
		display: grid;
		grid-template-columns: 1.5rem minmax(0, 1fr) 6.7rem;
		align-items: center;
		gap: 0.45rem;
		padding: 0 0.3rem 0.2rem;
	}

	.ao-main-row .ao-pick {
		grid-column: 2 / -1;
	}

	/* The game marks its main stat with a star where substats carry a badge */
	.ao-main-mark {
		display: grid;
		place-items: center;
		color: var(--muted);
	}

	.ao-main-fixed {
		grid-column: 2 / -1;
		padding-left: 0.6rem;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.ao-line {
		display: grid;
		grid-template-columns: 1.5rem minmax(0, 1fr) 5.2rem 1.5rem;
		align-items: center;
		gap: 0.45rem;
		padding: 0.2rem 0.3rem;
		border-radius: 3px;
	}

	/* One height for every field on the card: the select, the wheel, the blank */
	.ao-line .ao-select,
	.ao-main-row .ao-select,
	.ao-line :global(.vw-field),
	.ao-blank-value {
		height: 2rem;
	}

	.ao-blank-value {
		display: grid;
		align-items: center;
		justify-items: end;
		padding-inline: 0.45rem;
		border-radius: 3px;
		background: color-mix(in srgb, var(--text) 4%, transparent);
		color: var(--muted);
		font-family: var(--font-mono);
	}

	/* A styled select: the native face and arrow go, the site's chevron comes in */
	.ao-pick {
		position: relative;
		display: grid;
		min-width: 0;
	}

	.ao-pick :global(svg) {
		position: absolute;
		right: 0.55rem;
		top: 50%;
		translate: 0 -50%;
		pointer-events: none;
		color: var(--muted);
	}

	.ao-pick.is-blank .ao-select {
		color: var(--muted);
		font-weight: var(--fw-normal);
	}

	.ao-line.is-wanted {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.ao-line.is-wanted .ao-select {
		color: var(--accent);
	}

	.ao-select {
		appearance: none;
		-webkit-appearance: none;
		width: 100%;
		min-width: 0;
		padding: 0 1.7rem 0 0.6rem;
		font-family: var(--font-body);
		text-overflow: ellipsis;
		transition: background var(--t-snap);
		border: none;
		border-radius: 3px;
		background: var(--fill-rest);
		color: var(--text);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}

	.ao-select:hover {
		background: var(--fill-hover);
	}

	.ao-select:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 1px;
	}

	.ao-select option {
		background: var(--surface);
		color: var(--text);
	}

	/* The upgrade badge: a gold disc with the count, a dot for none (the game's) */
	.ao-badge {
		display: inline-grid;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		border: none;
		border-radius: 50%;
		padding: 0;
		background: var(--accent);
		color: var(--frame-bg);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
	}

	.ao-badge.is-zero {
		width: 0.4rem;
		height: 0.4rem;
		margin: auto;
		background: var(--muted);
	}

	.ao-badge.is-none,
	.ao-badge.is-unknown {
		background: transparent;
		color: var(--muted);
	}

	.ao-badge.is-choice {
		cursor: pointer;
		background: transparent;
		color: var(--accent);
		box-shadow: inset 0 0 0 1.5px var(--accent);
	}

	/* The game's reshape radial */
	.ao-radial {
		width: 1.15rem;
		height: 1.15rem;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: transparent;
		box-shadow: inset 0 0 0 1.5px var(--muted);
		cursor: pointer;
		transition: background var(--t-snap);
	}

	.ao-radial.is-on {
		background: var(--accent);
		box-shadow: none;
	}

	.ao-radial:disabled {
		cursor: default;
		opacity: 0.35;
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

	.ao-sub {
		margin: 0.5rem 0 0;
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
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

	/* Worse / same / better: INK densities, never verdict colours — on paper
	   (⚓ Nate: no gold on paper), and the judgment is the player's. Better is
	   the densest because it is the part you're asking about. */
	.ao-odds {
		display: grid;
		gap: 0.4rem;
		margin: 0.2rem 0 0.3rem;
	}

	.ao-odds-bar {
		display: flex;
		height: 12px;
		border-radius: 3px;
		overflow: hidden;
		background: color-mix(in srgb, var(--text) 8%, transparent);
	}

	.ao-odds-seg {
		flex-basis: 0;
	}

	.is-below {
		background: color-mix(in srgb, var(--text) 16%, transparent);
	}

	.is-equal {
		background: color-mix(in srgb, var(--text) 42%, transparent);
	}

	.is-above {
		background: var(--text);
	}

	.ao-odds-keys {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.9rem;
		font-size: var(--fs-md);
		color: var(--muted);
	}

	.ao-odds-keys span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.ao-odds-keys i {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}

	.ao-odds-keys b {
		color: var(--text);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
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
