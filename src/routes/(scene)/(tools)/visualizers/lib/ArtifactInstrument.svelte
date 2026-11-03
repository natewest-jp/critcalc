<script lang="ts">
	import type { Snippet } from 'svelte';
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
		survival,
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
		rollReshape,
		type PieceQuery,
		type ReshapeRoll as Roll
	} from './appraise';
	import { formatChance } from './chance';
	import type { FieldOption } from './statEntry';
	import StatField from './StatField.svelte';
	import InstrumentSlider from './kit/InstrumentSlider.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import ReshapeRoll from './ReshapeRoll.svelte';
	import { notices } from '$lib/notices.svelte';
	import { storageSession } from '$lib/storage/session.svelte';

	// ⚓ Four views, a piece's life (Nate, 2026-10-06; Reshape 2026-11-03): it
	// DROPS, it is LEVELLED, it is YOUR piece (entered and ranked), and it is
	// RESHAPED. Entering a piece and reshaping it are two jobs, as they are two
	// screens in the game (Nate, 2026-11-03): the card is for entry only, and
	// the reshape's two substats are picked on the Reshape view.
	// ⚓ "What counts as good" is the player's set of stats (1–4), not a pair.
	type View = 'drop' | 'level' | 'piece' | 'reshape';
	const VIEWS: { id: View; label: string }[] = [
		{ id: 'drop', label: 'Drop' },
		{ id: 'level', label: 'Level up' },
		{ id: 'piece', label: 'Your piece' },
		{ id: 'reshape', label: 'Reshape' }
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
	type Floor = (typeof RESHAPES)[number]['floor'];
	const MAX_WANTED = 4;
	/** The main stat a slot starts on (⚓ Nate: sands ATK%, not the list's first HP%) */
	const DEFAULT_MAIN: Partial<Record<SlotId, MainStatId>> = {
		sands: 'atkPct',
		goblet: 'elemDmg',
		circlet: 'cr'
	};
	const DEFAULT_DAYS = 7;
	/** The most days the field takes, typed or shared: past the axis, the head answers. */
	const MAX_DAYS = 1000;
	/** What a substat answers to, typed on the card, besides its name and its words. */
	const TERMS: Record<SubstatId, string[]> = {
		hp: ['flat hp'],
		atk: ['flat atk'],
		def: ['flat def'],
		hpPct: ['hp%'],
		atkPct: ['atk%'],
		defPct: ['def%'],
		er: ['er'],
		em: ['em'],
		cr: ['cr'],
		cd: ['cd', 'crit damage', 'cdmg']
	};
	/**
	 * A goblet's elemental DMG Bonus: the odds don't depend on which element
	 * (each is 5%), so the element is only how the piece is named ("+20 Pyro
	 * Goblet") and what the main stat field answers to ("pyro").
	 */
	const ELEMENTS = ['Pyro', 'Hydro', 'Electro', 'Cryo', 'Anemo', 'Geo', 'Dendro'] as const;
	type Element = (typeof ELEMENTS)[number];
	/** A main stat at its shortest, for the piece's summary (⚓ Nate: "+20 EM Circlet"). */
	const MAIN_SHORT: Partial<Record<MainStatId, string>> = {
		hpPct: 'HP%',
		atkPct: 'ATK%',
		defPct: 'DEF%',
		er: 'ER',
		em: 'EM',
		cr: 'CR',
		cd: 'CD',
		physDmg: 'Physical',
		healing: 'Healing'
	};

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
	let element = $state<Element>('Pyro');
	/** Your stats — what counts as good */
	let wanted = $state<SubstatId[]>(['cr', 'cd']);
	/** Drop: at least this many of your stats on the piece */
	let atLeast = $state(2);
	let eitherSet = $state(false);
	let days = $state(DEFAULT_DAYS);
	/** Level up: the piece has this many of your stats */
	let levelHas = $state(2);
	let fourLine = $state(true);
	/** Made with Sanctifying Elixir: its two defined lines get ≥2 upgrades by +20 */
	let defined = $state(false);
	let level = $state(20);
	let lines = $state<Line[]>(demoLines());
	/** At +0–3, the 4th line is grayed out in the game: a 3-line piece. */
	let unactivated = $state(false);
	/** A defined piece's two lines (the Elixir's Define Minor Affixes) */
	let definedSel = $state<SubstatId[]>([]);
	/** The reshape's two lines (the game's radials on its reshape screen) */
	let reshapeSel = $state<SubstatId[]>(['cr', 'cd']);
	let resolutionPick = $state(0);
	/** The player chose among the readings (the card's question is answered). */
	let readingPicked = $state(false);
	let reshapeFloor = $state<Floor>(2);
	/** A value to beat; null = the default (see each view) */
	let refLevel = $state<number | null>(null);
	let refPiece = $state<number | null>(null);

	let pieceMenu = $state<BandMenu>();
	let reshapeMenu = $state<BandMenu>();

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

	/** The card's lines changed: their readings start over, unanswered. */
	function resetReading() {
		resolutionPick = 0;
		readingPicked = false;
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
	/** Where the marker stands: typed past the axis, it waits at the end. */
	const shownDays = $derived(Math.min(days, farmDomain));
	const resinOf = (d: number) => Math.floor((d * RESIN_PER_DAY) / RESIN_PER_RUN) * RESIN_PER_RUN;
	const chanceBy = $derived({
		domain: 1 - farmMiss(resinOf(days), perPiece, false),
		outbreak: 1 - farmMiss(resinOf(days), perPiece, true)
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
	const levelDist = $derived(collapse(levelOutcome(levelFloor)));
	const levelGhost = $derived(levelFloor ? collapse(levelOutcome(0)) : null);

	// ── Your piece ─────────────────────────────────────────────────────────
	const pieceLines = $derived(lines.filter((l) => l.id !== '') as { id: SubstatId; raw: string }[]);
	/** The game shows all four lines of every piece; a grayed 4th counts only below +4 */
	const pieceComplete = $derived(pieceLines.length === 4);
	const unactivatedOn = $derived(unactivated && level === 0 && pieceComplete);
	const lineInferences = $derived(
		pieceLines.map((l) => {
			const v = Number(l.raw);
			if (l.id === main.id || !Number.isFinite(v) || l.raw.trim() === '') return [];
			return inferRollCounts(l.id, v);
		})
	);
	const resolutions = $derived(resolvePiece(lineInferences, level, unactivatedOn));
	const resolution = $derived(
		resolutions.length ? resolutions[Math.min(resolutionPick, resolutions.length - 1)] : null
	);
	/** Which levels these values fit — the level chips say so (once there is a piece) */
	const fitsLevel = $derived(
		Object.fromEntries(
			LEVELS.map((l) => [l.at, resolvePiece(lineInferences, l.at, unactivated).length > 0])
		) as Record<number, boolean>
	);
	const totals = $derived(
		lineInferences.every((i) => i.length) ? upgradeTotals(lineInferences) : []
	);
	const upgradesAt = (at: number) => Math.floor(at / 4);

	const wantedOnPiece = $derived(pieceLines.filter((l) => wantedSubs.includes(l.id)).length);
	const onPiece = (ids: SubstatId[]) => ids.filter((id) => pieceLines.some((l) => l.id === id));
	const defSel = $derived(onPiece(definedSel));
	const rshSel = $derived(onPiece(reshapeSel));
	const pieceFloor = $derived(defined && defSel.length === 2 ? 2 : 0);

	const query = $derived<PieceQuery | null>(
		resolution && wantedOnPiece > 0
			? {
					unit,
					wanted: wantedSubs,
					main: main.id,
					level,
					lines: pieceLines.map((l) => ({ id: l.id, value: Number(l.raw) })),
					counts: resolution.counts,
					selected: defSel,
					unactivated: unactivatedOn
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
	const future = $derived(query && !finished ? collapse(pieceFuture(query, pieceFloor)) : []);

	// ── Reshape ────────────────────────────────────────────────────────────
	const canReshape = $derived(query !== null && finished && rshSel.length === 2);
	/** All three reshapes, drawn together; the bar picks the one the head speaks for */
	const reshapes = $derived(
		canReshape && query && resolution
			? RESHAPES.map((r) => {
					const dist = collapse(
						pieceReshape({ ...query, selected: rshSel }, resolution.events, r.floor)
					);
					return { ...r, dist, beats: compareTo(dist, now).above };
				})
			: []
	);
	const reshapeName = $derived(RESHAPES.find((r) => r.floor === reshapeFloor)!.label);

	// ── Try a reshape ──────────────────────────────────────────────────────
	// One roll, played as the game plays it (ReshapeRoll.svelte), then lit on
	// the strip where it landed. The tries are this session's, for this piece
	// and this pick: a changed line, level or pick starts the trail over.
	type Try = { sig: string; floor: Floor; x: number; roll: Roll };
	let tries = $state<Try[]>([]);
	let rolling = $state<Roll | null>(null);
	const trySig = $derived(
		JSON.stringify([pieceLines, resolution?.counts, rshSel, wantedSubs, main.id])
	);
	const shownTries = $derived(tries.filter((t) => t.sig === trySig && t.floor === reshapeFloor));
	function tryReshape() {
		if (!query || !resolution || !canReshape) return;
		rolling = rollReshape({ ...query, selected: rshSel }, resolution.events, reshapeFloor);
	}
	/** A roll joins the trail once, as its result shows (the dialog doesn't dim
	 *  the strip, so its dot lights behind it) */
	function recordTry(r: Roll) {
		if (tries.some((t) => t.roll === r)) return;
		tries = [
			...tries.filter((t) => t.sig === trySig),
			{ sig: trySig, floor: reshapeFloor, x: r.x, roll: r }
		];
	}
	function closeRoll(keepIt: boolean) {
		const r = rolling;
		rolling = null;
		if (!r) return;
		recordTry(r);
		if (keepIt) keepRoll(r);
	}
	/** Try again: this roll joins the trail, and the next plays in the same dialog */
	function retryRoll() {
		if (rolling) recordTry(rolling);
		tryReshape();
	}
	/** Keep the reshaped result: it becomes your piece, with Undo. */
	function keepRoll(r: Roll) {
		const before = getShareState();
		const pid = storageSession.profile?.id;
		let k = 0;
		lines = lines.map((l) => (l.id === '' ? l : { ...l, raw: r.final[k++] }));
		// the roll knows its counts: pick that reading, so no question is asked
		const at = resolutions.findIndex((res) => res.counts.every((c, i) => c === r.counts[i]));
		resolutionPick = Math.max(0, at);
		readingPicked = resolutions.length > 1;
		notices.toast('success', 'Your piece is now the reshaped result', {
			actions: [
				{
					label: 'Undo',
					run: () => {
						if (storageSession.profile?.id === pid) applyShareState(before);
					}
				}
			]
		});
	}
	/** A value's place among a distribution: its mid-rank, as a dot's index */
	const dotIndex = (dist: ValueDist, x: number) => {
		const { below, equal } = compareTo(dist, [{ x, p: 1 }]);
		return Math.min(99, Math.max(0, Math.floor((below + equal / 2) * 100)));
	};
	/** The roll's meaning, said under the two cards (the values are on them) */
	const rollVerdict = (r: Roll) =>
		r.x > nowX + 1e-6
			? 'The reshaped result is better.'
			: r.x < nowX - 1e-6
				? 'Your piece is still better.'
				: 'They come out the same.';
	/** A card's place among this kind's reshapes, said under that card */
	const reshapeRank = (x: number) =>
		`Better than ${Math.round(compareTo(primaryDist, [{ x, p: 1 }]).below * 100)}% of ${reshapeName} reshapes`;

	// ── The readings: values that fit more than one upgrade count ──────────
	// ⚓ The streamer took the old tap-to-cycle badge for an "invalid value"
	// flag, and didn't see its number change. So the card asks the question
	// in words and offers each reading as a button that says what it is.
	/** The lines (card indices) whose upgrade count differs between readings. */
	const unsettled = $derived.by(() => {
		if (resolutions.length < 2) return [] as number[];
		const out: number[] = [];
		lines.forEach((line, i) => {
			const at = pieceLines.findIndex((l) => l.id === line.id);
			if (at >= 0 && new Set(resolutions.map((r) => r.counts[at])).size > 1) out.push(i);
		});
		return out;
	});
	/** A reading's button: the unsettled lines and their upgrades, "CD 2 · ATK% 1". */
	const readingText = (r: { counts: number[] }) =>
		unsettled
			.map((i) => {
				const id = lines[i].id as SubstatId;
				const at = pieceLines.findIndex((l) => l.id === id);
				return `${substatById(id).short} ${r.counts[at] - 1}`;
			})
			.join(' · ');

	// ── What the chart draws, by view ──────────────────────────────────────
	// Level up, Your piece and Reshape draw survival curves (the chance to end
	// ABOVE each value) over a 100-dot strip. The bold curve is the head's;
	// the thin ones are named at the marker.
	type Curve = { key: string; dist: ValueDist; name: string };
	const curves = $derived.by<Curve[]>(() => {
		if (view === 'level')
			return [
				{ key: 'piece', dist: levelDist, name: '' },
				...(levelGhost ? [{ key: 'farmed', dist: levelGhost, name: 'Farmed' }] : [])
			];
		if (view === 'piece') return [{ key: 'piece', dist: finished ? population : future, name: '' }];
		if (view === 'reshape') {
			const chosen = reshapes.find((r) => r.floor === reshapeFloor);
			return [
				...(chosen ? [{ key: chosen.label, dist: chosen.dist, name: '' }] : []),
				...reshapes
					.filter((r) => r.floor !== reshapeFloor)
					.map((r) => ({ key: r.label, dist: r.dist, name: r.label }))
			];
		}
		return [];
	});
	const primaryDist = $derived(curves[0]?.dist ?? []);
	const primaryS = $derived(survival(primaryDist));
	const primaryStats = $derived(distStats(primaryDist));
	/** The value the marker stands on: dragged, the default, or your piece */
	const refDefault = $derived(
		view === 'level' ? distStats(levelDist).median : distStats(population).median
	);
	/** Your piece is the marker at +20, and in Reshape. */
	const markIsPiece = $derived((view === 'piece' && finished) || view === 'reshape');
	const reference = $derived(
		view === 'level' ? (refLevel ?? refDefault) : markIsPiece ? nowX : (refPiece ?? refDefault)
	);
	const beats = $derived(
		view === 'reshape'
			? (reshapes.find((r) => r.floor === reshapeFloor)?.beats ?? 0)
			: primaryS(reference)
	);

	const fmtLineValue = (id: SubstatId, n: number) =>
		substatById(id).isPct ? n.toFixed(1) : String(n);

	// The value fields' options: exactly the values the game can display
	const valueOptions = $derived(
		lines.map(({ id }) =>
			id === ''
				? []
				: possibleValues(id).map((n) => {
						const s = fmtLineValue(id, n);
						return { value: s, label: s };
					})
		)
	);
	/** A line's name field: the substats it can be (not the main, not another line's). */
	const nameOptions = (i: number): FieldOption[] => [
		{ value: '', label: 'None' },
		...SUBSTATS.filter(
			(s) => s.id !== main.id && (s.id === lines[i].id || !lines.some((l) => l.id === s.id))
		).map((s) => ({ value: s.id, label: s.name, terms: [s.short.toLowerCase(), ...TERMS[s.id]] }))
	];
	/** The main stat field: a goblet's elemental DMG is one option per element. */
	const mainOptions = $derived<FieldOption[]>(
		slot.mains.flatMap((m) =>
			m.id === 'elemDmg'
				? ELEMENTS.map((e) => ({
						value: `elemDmg:${e}`,
						label: `${e} DMG Bonus`,
						terms: [e.toLowerCase()]
					}))
				: [
						{
							value: m.id,
							label: m.name,
							terms: MAIN_SHORT[m.id] ? [MAIN_SHORT[m.id]!.toLowerCase()] : []
						}
					]
		)
	);
	const mainValue = $derived(main.id === 'elemDmg' ? `elemDmg:${element}` : main.id);
	function pickMainField(v: string) {
		if (v.startsWith('elemDmg:')) {
			element = v.slice('elemDmg:'.length) as Element;
			pickMain('elemDmg');
		} else pickMain(v as MainStatId);
	}

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
		if (old) {
			definedSel = definedSel.filter((s) => s !== old);
			reshapeSel = reshapeSel.filter((s) => s !== old);
		}
		resetReading();
		resetRefs();
	}

	function setLineValue(index: number, raw: string) {
		lines = lines.map((l, i) => (i === index ? { ...l, raw } : l));
		resetReading();
	}

	// A substat can't be the main stat (the game never makes one): a line the
	// new main stat collides with is CLEARED, never swapped for a guess
	function fixLines() {
		lines.forEach((l, i) => {
			if (l.id !== '' && l.id === main.id) setLineStat(i, '');
		});
	}

	/**
	 * A narrow card (a phone) names substats by their short form, and its
	 * Clear drops the word. The CARD's width decides, never the screen's.
	 */
	let cardW = $state(400);
	const tightCard = $derived(cardW < 300);

	/** Blank the card to enter a piece from scratch */
	function clearPiece() {
		lines = [
			{ id: '', raw: '' },
			{ id: '', raw: '' },
			{ id: '', raw: '' },
			{ id: '', raw: '' }
		];
		definedSel = [];
		reshapeSel = [];
		unactivated = false;
		resetReading();
		resetRefs();
	}

	function setLevel(at: number) {
		level = at;
		resetReading();
		refPiece = null;
		fixLines();
	}

	/** Two at most (the game's radials, the Elixir's two), a third waits */
	function toggleTwo(list: SubstatId[], id: SubstatId): SubstatId[] {
		const on = onPiece(list);
		if (on.includes(id)) return on.filter((s) => s !== id);
		return on.length < 2 ? [...on, id] : on;
	}

	// ── Formatting ─────────────────────────────────────────────────────────
	const oneIn = (p: number) => (p > 0 ? Math.round(1 / p).toLocaleString('en-US') : '—');
	const fmtNum = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');
	/** Days, from resin: a decimal under ten, where a tenth of a day reads */
	const fmtDays = (resin: number) => {
		if (!Number.isFinite(resin)) return '—';
		const d = resin / RESIN_PER_DAY;
		return d < 10 ? d.toFixed(1) : fmtNum(d);
	};
	const daysPhrase = (d: number) => (d === 1 ? '1 day' : `${fmtNum(d)} days`);
	const fmtValue = (x: number) => x.toFixed(1);
	const unitWord = $derived(unit === 'cv' ? 'CV' : 'useful rolls');
	const valueOf = (x: number) => `${fmtValue(x)} ${unitWord}`;
	const slotWord = $derived(slot.name.toLowerCase());
	/** ⚠️ Sands is its own plural */
	const slotPlural = $derived(slotId === 'sands' ? 'sands' : `${slotWord}s`);
	const levelLabel = $derived(LEVELS.find((l) => l.at === level)!.label);
	/** "CR", "CR and CD", "CR, CD and ER" */
	const andList = (ids: SubstatId[]) => {
		const names = ids.map((id) => substatById(id).short);
		return names.length < 2
			? (names[0] ?? '')
			: `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
	};
	const statList = (ids: SubstatId[]) => ids.map((id) => substatById(id).short).join(', ');
	/** The Your stats segment's value: in Drop, how many of them it needs too */
	const wantedFace = $derived(
		view === 'drop' && atLeast < wanted.length
			? `${atLeast} of ${statList(wanted)}`
			: andList(wanted)
	);
	const pieceFace = $derived(
		`${slot.name} · ${(view === 'drop' ? mainStats : [main]).map((m) => m.name).join(', ')}`
	);
	const hasWord = (n: number) =>
		n === wantedSubs.length && n > 1 ? (n === 2 ? 'Both' : `All ${n}`) : String(n);
	/**
	 * THE PIECE AT A GLANCE (⚓ Nate 2026-11-03): its level, its main stat at
	 * its shortest (not on a flower or plume, whose main never varies) and its
	 * slot as one name, then each substat: "+20 Pyro Goblet · CR 6.6 · …".
	 */
	const pieceName = $derived.by(() => {
		const mainWord =
			slotId === 'flower' || slotId === 'plume'
				? ''
				: main.id === 'elemDmg'
					? element
					: (MAIN_SHORT[main.id] ?? main.name);
		return [levelLabel, mainWord, slot.name].filter(Boolean).join(' ');
	});
	const reshapeFace = $derived(
		`${rshSel.length === 2 ? andList(rshSel) : 'Pick 2'} · ${reshapeName}`
	);

	// ── Geometry ───────────────────────────────────────────────────────────
	// Top to bottom: the main plot, the companion strip on the same x axis
	// (the value views), then the axis's numbers. The handle sits under the
	// SVG, its track lined up with the plot's x range.
	let graphW = $state(720);
	let graphH = $state(0);
	const PADL = 52;
	const PADR = 16;
	const TOP = 16;
	/** The plot's height at its least — the chart grows from here into the tile. */
	const PLOT_MIN = 200;
	/** 🎛️ The companion strip's height (design §7: at most one, on the main x axis). */
	const COMP_H = 72;
	/** 🎛️ Between the plot and the strip; the strip's label sits in it. */
	const COMP_GAP = 24;
	/** The axis's numbers and its name. */
	const AXIS_H = 30;
	/** Half the slider thumb's 15px (app.css `.slider`): the handle's track runs
	 *  this far past each end of the axis, so the thumb sits on the marker. */
	const THUMB_R = 7.5;
	const hasStrip = $derived(view !== 'drop');
	const CHROME_H = $derived(TOP + (hasStrip ? COMP_GAP + COMP_H : 0) + AXIS_H);
	const plotH = $derived(Math.max(PLOT_MIN, graphH - CHROME_H));
	const plotY1 = $derived(TOP + plotH);
	const compY0 = $derived(plotY1 + COMP_GAP);
	const compY1 = $derived(compY0 + COMP_H);
	const axisY = $derived(hasStrip ? compY1 : plotY1);
	const H = $derived(axisY + AXIS_H);
	/** Axis labels stay at least this far apart (as in the ICD Timeline). */
	const MIN_TICK_PX = 44;
	const plotW = $derived(Math.max(1, graphW - PADL - PADR));
	const yOf = $derived((p: number) => plotY1 - p * (plotH - 8));
	/** A condensed 11px glyph, generously — only decides which side a label sits. */
	const LABEL_CHAR_PX = 7;
	/** 🎛️ The least gap between two dot labels, in px. */
	const DOT_LABEL_GAP = 13;

	/** The smallest 1/2/5 × 10ⁿ step that cuts `span` into at most `parts`. */
	function niceStep(span: number, parts: number) {
		const raw = span / Math.max(1, parts);
		const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
		return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
	}

	// The farming chart: chance of the piece by days of resin, two curves
	const farmXOf = $derived((d: number) => PADL + (d / farmDomain) * plotW);
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
	// Each curve is named where the space beside it is empty: the Outbreak's
	// above its curve, the Domain's below its own, both at 🎛️ FARM_LABEL_AT
	// of the axis, clear of the Half by (left) and the Unlucky tenth (right).
	// At their 50% crossings, as Wish odds names its curves, the two labels
	// sat on the curves' shallow tops.
	const FARM_LABEL_AT = 0.55;
	const farmLabels = $derived.by(() => {
		const d = FARM_LABEL_AT * farmDomain;
		const x = farmXOf(d);
		const y = (outbreak: boolean) => yOf(1 - farmMiss(resinOf(d), perPiece, outbreak));
		return {
			outbreak: { x, y: y(true) - 8, anchor: 'middle' },
			domain: { x, y: y(false) + 16, anchor: 'middle' }
		};
	});

	// The value axis: it spans every curve the view draws, and your piece
	const binW = $derived(unit === 'cv' ? 1 : 0.1);
	const valueSpan = $derived.by(() => {
		let lo = Infinity;
		let hi = -Infinity;
		for (const c of curves)
			for (const d of c.dist) {
				lo = Math.min(lo, d.x);
				hi = Math.max(hi, d.x);
			}
		if ((view === 'piece' || view === 'reshape') && query) {
			lo = Math.min(lo, nowX);
			hi = Math.max(hi, nowX);
		}
		return Number.isFinite(lo) ? { lo, hi: hi + binW } : { lo: 0, hi: 1 };
	});
	/** A few outcomes shouldn't crowd one end: the axis spans at least this */
	const MIN_SPAN = $derived(unit === 'cv' ? 12 : 1.5);
	const histLo = $derived(
		Math.max(
			0,
			Math.min(valueSpan.lo, valueSpan.hi - MIN_SPAN / 2 - (valueSpan.hi - valueSpan.lo) / 2)
		)
	);
	const histHi = $derived(Math.max(valueSpan.hi, histLo + MIN_SPAN));
	const histXOf = $derived((x: number) => PADL + ((x - histLo) / (histHi - histLo)) * plotW);
	const histTicks = $derived.by(() => {
		const step = Math.max(binW, niceStep(histHi - histLo, Math.floor(plotW / MIN_TICK_PX / 1.4)));
		const first = Math.ceil(histLo / step - 1e-9) * step;
		return Array.from(
			{ length: Math.max(0, Math.floor((histHi - first) / step + 1e-9) + 1) },
			(_, i) => Math.round((first + i * step) * 10) / 10
		);
	});

	/**
	 * A survival curve drawn as the steps it is: flat between the values a
	 * piece can end on, straight down at each one. (Sampled every 2px and
	 * joined, each drop leaned across its sample.)
	 */
	function survivalPath(dist: ValueDist) {
		const pts = [...dist].sort((a, b) => a.x - b.x);
		let s = 1;
		let d = `M${histXOf(histLo).toFixed(1)},${yOf(1).toFixed(1)}`;
		for (const pt of pts) {
			const x = histXOf(pt.x).toFixed(1);
			d += ` L${x},${yOf(s).toFixed(1)}`;
			s = Math.max(0, s - pt.p);
			d += ` L${x},${yOf(s).toFixed(1)}`;
		}
		return `${d} L${histXOf(histHi).toFixed(1)},${yOf(s).toFixed(1)}`;
	}

	/**
	 * THE 100-DOT STRIP: the bold curve's outcomes as 100 pieces, one dot each
	 * (a quantile dot plot), stacked where they land; the ones that end above
	 * the marker are lit, so "38 of 100" is counted, not computed. Each dot is
	 * a percentile: the (i + ½)th hundredth of the distribution.
	 * The values are discrete, so one value can hold twenty dots: a stack
	 * taller than the strip spills into columns beside its value, rather than
	 * every dot shrinking to a speck (a Standard reshape's first try). 🎛️ The
	 * dots are as big as the blocks allow without touching, DOT_MAX to DOT_MIN.
	 */
	const DOT_MAX = 9;
	const DOT_MIN = 4;
	const strip = $derived.by(() => {
		if (!hasStrip || !primaryDist.length) return { dots: [], lit: 0 };
		const xs: number[] = [];
		let acc = 0;
		let j = 0;
		for (let i = 0; i < 100; i++) {
			const q = (i + 0.5) / 100;
			while (j < primaryDist.length - 1 && acc + primaryDist[j].p < q) acc += primaryDist[j++].p;
			xs.push(primaryDist[j].x);
		}
		type Group = { x: number; n: number; cols: number };
		let size = DOT_MAX;
		let rows = 1;
		let groups: Group[] = [];
		for (; size >= DOT_MIN; size -= 0.5) {
			rows = Math.max(1, Math.floor((COMP_H - 2) / size));
			// dots within one dot's width share a block, centred on their mean
			groups = [];
			for (const x of xs) {
				const px = histXOf(x);
				const last = groups.at(-1);
				if (last && px - last.x < size) {
					last.x = (last.x * last.n + px) / (last.n + 1);
					last.n++;
				} else groups.push({ x: px, n: 1, cols: 1 });
			}
			for (const g of groups) g.cols = Math.ceil(g.n / rows);
			const fits = groups.every(
				(g, k) =>
					k === 0 || g.x - (g.cols * size) / 2 >= groups[k - 1].x + (groups[k - 1].cols * size) / 2
			);
			if (fits) break;
		}
		size = Math.max(DOT_MIN, size);
		let lit = 0;
		let at = 0;
		const dots = groups.flatMap((g) => {
			const left = g.x - (g.cols * size) / 2;
			return Array.from({ length: g.n }, (_, k) => {
				const on = xs[at++] > reference + 1e-6;
				if (on) lit++;
				// fill column by column from the bottom, the block's columns side by side
				const col = Math.floor(k / rows);
				const row = k % rows;
				return {
					cx: left + (col + 0.5) * size,
					cy: compY1 - (row + 0.5) * size,
					r: Math.max(1, size / 2 - 0.6),
					on
				};
			});
		});
		return { dots, lit };
	});
	/**
	 * YOU ARE THIS DOT: your piece's place among the strip's 100 (at +20, and
	 * in Reshape among the reshapes), and in Reshape each try's, the latest
	 * lit. A dot is the hundredth its rank falls in.
	 */
	const stripRings = $derived.by(() => {
		if (!strip.dots.length || !markIsPiece) return [];
		const top = (i: number) =>
			Math.min(...strip.dots.filter((d) => d.cx === strip.dots[i].cx).map((d) => d.cy)) -
			strip.dots[i].r;
		const rings: { key: string; i: number; kind: 'yours' | 'try' | 'last'; label: string }[] = [
			{ key: 'yours', i: dotIndex(primaryDist, nowX), kind: 'yours', label: 'yours' }
		];
		if (view === 'reshape')
			shownTries.forEach((t, k) => {
				const last = k === shownTries.length - 1;
				rings.push({
					key: `try${k}`,
					i: dotIndex(primaryDist, t.x),
					kind: last ? 'last' : 'try',
					label: last ? 'this roll' : ''
				});
			});
		// labels on one dot stack upward
		const used: Record<number, number> = {};
		return rings.map((r) => {
			const d = strip.dots[r.i];
			const n = r.label ? (used[r.i] ?? 0) : 0;
			if (r.label) used[r.i] = n + 1;
			return { ...r, cx: d.cx, cy: d.cy, rr: d.r + 2, ly: top(r.i) - 4 - n * 11 };
		});
	});
	const triesBeat = $derived(shownTries.filter((t) => t.x > nowX + 1e-6).length);
	const stripLabel = $derived(
		view === 'reshape'
			? `100 ${reshapeName} reshapes, one dot each: ${strip.lit} beat your piece` +
					(shownTries.length ? ` · your tries: ${shownTries.length}, ${triesBeat} beat it` : '')
			: view === 'piece' && finished
				? `100 +20 ${slotPlural} like yours, one dot each: ${strip.lit} beat it`
				: `100 pieces, one dot each: ${strip.lit} end above ${fmtValue(reference)}`
	);

	// ── The answer as geometry (design §6, §7: the chance-curve family) ────
	// Half by / Unlucky tenth on Drop's Domain curve (rising); Typical /
	// Unlucky tenth on a value curve (falling), where 50% and 90% of outcomes
	// end above. A dot, a drop line to the axis, and the figure at the line's
	// FOOT, just above the axis: the figure is an x value, and the space under
	// a curve is empty for either slope. Beside the dot (Wish odds' placement)
	// the Unlucky tenth, always near the right edge here, sat on the
	// Outbreak's curve. Right of its line, or left near the plot's right edge;
	// a label that would run into the one before steps up a row.
	const crossings = $derived.by(() => {
		const rising = view === 'drop';
		const raw = rising
			? [
					{
						key: 'half',
						p: 0.5,
						x: farm.domain.median / RESIN_PER_DAY,
						text: `Half by ${fmtDays(farm.domain.median)}`,
						title: 'Half of players have it within this many days.'
					},
					{
						key: 'tenth',
						p: 0.9,
						x: farm.domain.p90 / RESIN_PER_DAY,
						text: `Unlucky tenth ${fmtDays(farm.domain.p90)}`,
						title: 'The unluckiest 10% of players need this many days or more.'
					}
				]
			: primaryDist.length
				? [
						{
							key: 'half',
							p: 0.5,
							x: primaryStats.median,
							text: `Typical ${fmtValue(primaryStats.median)}`,
							title: 'Half end above this, and half at or below it.'
						},
						{
							key: 'tenth',
							p: 0.9,
							x: primaryStats.p10,
							text: `Unlucky tenth ${fmtValue(primaryStats.p10)}`,
							title: 'The unluckiest 10% end at or below this.'
						}
					]
				: [];
		const xOf = rising ? farmXOf : histXOf;
		const lo = rising ? 0 : histLo;
		const hi = rising ? farmDomain : histHi;
		const placed: { x0: number; x1: number; row: number }[] = [];
		return raw
			.filter((c) => Number.isFinite(c.x) && c.x >= lo && c.x <= hi)
			.sort((a, b) => a.x - b.x)
			.map((c) => {
				const x = xOf(c.x);
				const w = c.text.length * LABEL_CHAR_PX;
				const right = x + 5 + w <= graphW - PADR;
				const x0 = right ? x + 5 : x - 5 - w;
				let row = 0;
				while (placed.some((b) => b.row === row && x0 < b.x1 + 4 && b.x0 < x0 + w + 4)) row++;
				placed.push({ x0, x1: x0 + w, row });
				return {
					...c,
					cx: x,
					cy: yOf(c.p),
					lx: right ? x + 5 : x - 5,
					ly: plotY1 - 6 - row * 14,
					anchor: right ? 'start' : 'end'
				};
			});
	});

	/** The marker: the days you'll farm, the value to beat, or your piece. */
	const markX = $derived(view === 'drop' ? farmXOf(shownDays) : histXOf(reference));
	/** The dots where the marker crosses each curve; the head speaks for the first. */
	const markDots = $derived.by(() => {
		if (view === 'drop')
			return [
				{ key: 'domain', p: chanceBy.domain, primary: true, label: '' },
				{
					key: 'outbreak',
					p: chanceBy.outbreak,
					primary: false,
					label: `In an Outbreak ${formatChance(chanceBy.outbreak)}`
				}
			];
		if (view === 'reshape')
			return [
				...reshapes
					.filter((r) => r.floor === reshapeFloor)
					.map((r) => ({ key: r.label, p: r.beats, primary: true, label: '' })),
				...reshapes
					.filter((r) => r.floor !== reshapeFloor)
					.map((r) => ({
						key: r.label,
						p: r.beats,
						primary: false,
						label: `${r.label} ${formatChance(r.beats)}`
					}))
			];
		return curves.map((c, i) => {
			const p = survival(c.dist)(reference);
			return {
				key: c.key,
				p,
				primary: i === 0,
				label: c.name ? `${c.name} ${formatChance(p)}` : ''
			};
		});
	});
	const dotLabels = $derived.by(() => {
		if (!markDots.length) return [];
		// Drop's curves rise, so the Outbreak's label goes left of the marker,
		// above its curve, where it fits; a falling curve's dot labels go right,
		// until the marker nears the plot's right edge.
		const widest = Math.max(0, ...markDots.map((d) => d.label.length * LABEL_CHAR_PX));
		const left = view === 'drop' ? markX - 8 - widest >= PADL : markX > PADL + plotW * 0.7;
		const placed = markDots
			.filter((d) => d.label)
			.map((d) => ({ key: d.key, text: d.label, y: yOf(d.p) }))
			.sort((a, b) => a.y - b.y);
		for (let i = 1; i < placed.length; i++)
			placed[i].y = Math.max(placed[i].y, placed[i - 1].y + DOT_LABEL_GAP);
		const headY = yOf(markDots[0].p);
		for (const l of placed) if (Math.abs(l.y - headY) < DOT_LABEL_GAP) l.y = headY - DOT_LABEL_GAP;
		// A dot label that would sit on a crossing's label goes to the marker's
		// other side.
		const boxes = crossings.map((c) => {
			const w = c.text.length * LABEL_CHAR_PX;
			const x0 = c.anchor === 'start' ? c.lx : c.lx - w;
			return { x0, x1: x0 + w, y0: c.ly - 11, y1: c.ly + 2 };
		});
		return placed.map((l) => {
			const w = l.text.length * LABEL_CHAR_PX;
			const at = (onLeft: boolean) => {
				const x0 = onLeft ? markX - 8 - w : markX + 8;
				return { x0, x1: x0 + w, y0: l.y + 3.5 - 11, y1: l.y + 3.5 + 2 };
			};
			const hits = (b: { x0: number; x1: number; y0: number; y1: number }) =>
				boxes.some((c) => b.x0 < c.x1 + 4 && c.x0 < b.x1 + 4 && b.y0 < c.y1 + 4 && c.y0 < b.y1 + 4);
			const side = hits(at(left)) && !hits(at(!left)) ? !left : left;
			return {
				...l,
				x: side ? markX - 8 : markX + 8,
				y: l.y + 3.5,
				anchor: side ? 'end' : 'start'
			};
		});
	});

	/** A value to beat can be dragged in Level up and on an unfinished piece */
	const draggable = $derived(!markIsPiece);

	// Press and drag moves the value to beat (or the days you'll farm)
	let scrubbing = $state(false);
	function scrub(e: PointerEvent) {
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (e.clientX - rect.left - PADL) / plotW));
		if (view === 'drop') {
			days = Math.max(1, Math.round(frac * farmDomain));
			return;
		}
		const x = Math.round((histLo + frac * (histHi - histLo)) * 10) / 10;
		if (view === 'level') refLevel = x;
		else refPiece = x;
	}
	function onDown(e: PointerEvent) {
		if (!draggable) return;
		scrubbing = true;
		scrub(e);
		(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
	}
	function onMove(e: PointerEvent) {
		if (scrubbing) scrub(e);
	}
	function onUp(e: PointerEvent) {
		scrubbing = false;
		const el = e.currentTarget as SVGSVGElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}

	/** What the chart can't draw yet, and why (null: the chart is drawn). */
	const emptyReason = $derived.by(() => {
		if (view === 'drop') return null;
		if (!wantedSubs.length) return 'main';
		if (view === 'level') return null;
		if (!resolution) {
			if (!pieceComplete) return 'incomplete';
			if (lineInferences.some((i) => !i.length)) return 'impossible';
			return 'misfit';
		}
		if (wantedOnPiece === 0) return 'none';
		if (view === 'reshape') {
			if (!finished) return 'unfinished';
			if (rshSel.length < 2) return 'pick';
		}
		return null;
	});

	// ── Workspace handle (share + reset) ───────────────────────────────────
	export function reset() {
		view = 'drop';
		slotId = 'flower';
		mains = ['hp'];
		element = 'Pyro';
		wanted = ['cr', 'cd'];
		atLeast = 2;
		eitherSet = false;
		days = DEFAULT_DAYS;
		levelHas = 2;
		fourLine = true;
		defined = false;
		level = 20;
		lines = demoLines();
		unactivated = false;
		definedSel = [];
		reshapeSel = ['cr', 'cd'];
		resetReading();
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
			// the reshape's two lines (before 2026-11-03, also a defined piece's)
			selected: reshapeSel,
			reshape: reshapeFloor,
			lines: lines.map((l) => [l.id, l.raw]),
			// added 2026-10-15 — older v1 links lack both and open on the defaults
			reading: resolutionPick,
			ref: [refLevel, refPiece],
			// added 2026-11-03: the reading was chosen, the Elixir's two lines, a
			// grayed 4th line, the goblet's element
			picked: readingPicked,
			defSel: definedSel,
			unact: unactivated,
			el: element
		};
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		const isSub = (x: unknown): x is SubstatId =>
			typeof x === 'string' && SUBSTATS.some((ss) => ss.id === x);
		const two = (v: unknown) =>
			Array.isArray(v) ? [...new Set(v.filter(isSub))].slice(0, 2) : null;
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
		if (typeof s.el === 'string' && (ELEMENTS as readonly string[]).includes(s.el))
			element = s.el as Element;
		if (Array.isArray(s.wanted)) {
			const w = [...new Set(s.wanted.filter(isSub))].slice(0, MAX_WANTED);
			if (w.length) wanted = w;
		}
		atLeast = Math.min(wanted.length, int(s.atLeast, 1, MAX_WANTED) ?? atLeast);
		if (typeof s.eitherSet === 'boolean') eitherSet = s.eitherSet;
		if (typeof s.days === 'number' && Number.isFinite(s.days))
			days = Math.min(MAX_DAYS, Math.max(1, Math.round(s.days)));
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
			// distinct stats only — duplicates would break roll inference
			if (next.length === 4 && new Set(ids).size === ids.length) lines = next;
		}
		unactivated = s.unact === true;
		const sel = two(s.selected);
		if (sel) reshapeSel = sel;
		// before 2026-11-03 one selection served both: a defined piece's too
		definedSel = two(s.defSel) ?? (defined && sel ? sel : []);
		fixLines();
		resetRefs();
		// after the lines: the reading indexes their resolutions
		resolutionPick = int(s.reading, 0, Math.max(0, resolutions.length - 1)) ?? 0;
		readingPicked = s.picked === true;
		if (Array.isArray(s.ref)) {
			// a dragged value to beat, at the 0.1 the drag rounds to
			const ref = (v: unknown) =>
				typeof v === 'number' && Number.isFinite(v)
					? Math.round(Math.min(100, Math.max(0, v)) * 10) / 10
					: null;
			refLevel = ref(s.ref[0]);
			refPiece = ref(s.ref[1]);
		}
		if (typeof s.view === 'string' && VIEWS.some((v) => v.id === s.view)) view = s.view as View;
	}
</script>

{#snippet segment(key: string, value: string, aria: string, body: Snippet)}
	<!-- A setting on the setup bar: its name and value, opening the setting. -->
	<BandMenu role="dialog" align="start" ariaLabel="{key}: {aria}">
		{#snippet face()}
			<span class="setup-key">{key}</span>
			<span class="setup-val">{value}</span>
		{/snippet}
		{#snippet items()}
			<div class="setup-pop">{@render body()}</div>
		{/snippet}
	</BandMenu>
{/snippet}

{#snippet slotPicker(small: boolean)}
	<div class="ao-slots" class:ao-slots--small={small}>
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
{/snippet}

{#snippet pieceBody()}
	{@render slotPicker(false)}
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
						>{formatChance(m.chance).replace(/\.0%$/, '%')}{m.each ? ' each' : ''}</span
					>
				{/if}
			</button>
		{/each}
	</div>
	{#if view === 'drop' && slot.mains.length > 1}
		<p class="inst-hint">
			Pick every main stat you'd be happy with. The number under each is how often it drops.
		</p>
	{/if}
{/snippet}

{#snippet wantedBody()}
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
						>{s.id === main.id ? 'main' : `${Math.round(lineChance[s.id] * 100)}%`}</span
					>
				{/if}
			</button>
		{/each}
	</div>
	<p class="inst-hint">
		Pick up to four substats you want.
		{#if view === 'drop'}
			The number under each is its chance to be one of the piece's four substats.
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
{/snippet}

{#snippet setBody()}
	<div class="chips">
		<button
			class="chip chip--control"
			class:active={!eitherSet}
			aria-pressed={!eitherSet}
			onclick={() => (eitherSet = false)}
		>
			One set
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
{/snippet}

{#snippet hasBody()}
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
{/snippet}

{#snippet startBody()}
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
	<p class="note">
		A piece that drops with 4 substats gets 5 upgrades by +20. One that drops with 3 spends its
		first upgrade adding a 4th substat.
	</p>
{/snippet}

{#snippet madeBody()}
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
			disabled={view === 'level' && levelK < 2}
			onclick={() => (defined = true)}
		>
			Made with Elixir
		</button>
	</div>
	{#if view === 'level'}
		<p class="note">
			A piece made with Sanctifying Elixir guarantees at least 2 of its upgrades go to the two
			substats you chose for it.
		</p>
	{:else if defined}
		<!-- The Elixir's own screen: Define Minor Affixes, two of the piece's lines. -->
		<span class="slider-label" id="ao-defined-label">Defined substats</span>
		<div class="chips" role="group" aria-labelledby="ao-defined-label">
			{#each pieceLines as l (l.id)}
				{@const on = defSel.includes(l.id)}
				<button
					class="chip chip--control"
					class:active={on}
					aria-pressed={on}
					disabled={!on && defSel.length >= 2}
					onclick={() => (definedSel = toggleTwo(definedSel, l.id))}
				>
					{substatById(l.id).short}
				</button>
			{/each}
		</div>
		<p class="note">
			Pick the two substats you chose when making it. Together they're guaranteed at least 2
			upgrades by +20.
		</p>
	{/if}
{/snippet}

{#snippet reshapeBody()}
	<!-- The game's reshape screen: the piece's lines with their upgrades, a
	     radial on each, then the kind of reshape. -->
	<div class="ao-rs-lines" role="group" aria-label="Substats to reshape">
		{#each pieceLines as l, i (l.id)}
			{@const on = rshSel.includes(l.id)}
			{@const count = resolution ? resolution.counts[i] - 1 : null}
			<button
				class="ao-rs-line"
				class:is-on={on}
				class:is-wanted={wantedSubs.includes(l.id)}
				aria-pressed={on}
				disabled={!on && rshSel.length >= 2}
				onclick={() => (reshapeSel = toggleTwo(reshapeSel, l.id))}
			>
				<span class="ao-badge" class:is-zero={count === 0}>{count ? count : ''}</span>
				<span class="ao-rs-name">{substatById(l.id).name}</span>
				<span class="ao-rs-value">{l.raw}{substatById(l.id).isPct ? '%' : ''}</span>
				<span class="ao-radial" class:is-on={on} aria-hidden="true"></span>
			</button>
		{/each}
	</div>
	<p class="note">
		Pick 2 substats. After the reshape, they get at least {reshapeFloor} of the piece's upgrades between
		them.
	</p>
	<div class="chips" role="group" aria-label="Kind of reshape">
		{#each RESHAPES as r (r.floor)}
			<button
				class="chip chip--control"
				class:active={reshapeFloor === r.floor}
				aria-pressed={reshapeFloor === r.floor}
				onclick={() => (reshapeFloor = r.floor)}
			>
				{r.label}&nbsp;<span class="chip-sub">{r.hint}</span>
			</button>
		{/each}
	</div>
	<p class="note">
		Every {ADVANCED_EXEGESIS} Dust of Enlightenment you spend makes your next reshape Advanced, and the
		third Advanced in a row is Decreed. The chart shows all three.
	</p>
{/snippet}

{#snippet warnMark()}
	<!-- ⚓ Nate's notification mark (assets-src/tools/notification.svg),
	     inlined as geometry, turned 7° clockwise like the game's own warn
	     mark. Paths re-based to the 24-unit box: the disc is the source's
	     circle (12,12,r12), the "!" its path shifted by the source's nested
	     transforms. -->
	<svg class="ao-warn" viewBox="0 0 24 24" aria-hidden="true">
		<g transform="rotate(7 12 12)">
			<circle class="ao-warn-disc" cx="12" cy="12" r="12" />
			<path
				class="ao-warn-ink"
				transform="translate(-275.407631 -194.536737)"
				d="M287.339,210.822L287.495,210.822C287.975,210.822 288.411,210.985 288.799,211.317C289.203,211.663 289.404,212.098 289.404,212.623L289.404,212.775L289.396,212.852C289.39,212.885 289.384,212.909 289.384,212.925C289.384,213.273 289.218,213.648 288.84,214.026C288.478,214.387 288.083,214.562 287.662,214.57L287.535,214.589L287.271,214.589C287.246,214.589 287.222,214.587 287.197,214.582C287.165,214.576 287.141,214.57 287.124,214.57C286.714,214.57 286.319,214.399 285.951,214.03C285.591,213.67 285.412,213.239 285.412,212.739L285.412,212.683L285.427,212.698C285.423,212.677 285.421,212.655 285.421,212.632L285.421,212.61L285.419,212.607L285.422,212.593C285.432,212.155 285.613,211.749 285.98,211.381C286.353,211.009 286.805,210.822 287.339,210.822ZM285.538,200.334L285.538,199.894C285.538,199.03 286.205,198.484 287.681,198.484L287.715,198.486L287.827,198.494C287.827,198.494 288.021,198.509 287.827,198.494C288.334,198.5 288.685,198.655 288.898,198.903C289.103,199.141 289.228,199.513 289.228,200.031L289.228,200.479L289.226,200.527L289.218,200.619L289.217,200.629L289.208,200.842L289.207,200.863C289.202,200.93 289.199,200.995 289.199,201.056L289.197,201.094L289.178,201.322C289.165,201.472 289.16,201.722 289.16,202.072C289.16,202.444 289.098,203.162 288.971,204.225C288.848,205.262 288.753,206.181 288.685,206.982C288.614,207.812 288.546,208.359 288.486,208.621C288.395,209.014 288.053,209.293 287.369,209.293L287.242,209.293C287.009,209.293 286.817,209.224 286.662,209.099C286.463,208.939 286.315,208.67 286.264,208.271C285.779,204.394 285.538,201.748 285.538,200.334Z"
			/>
		</g>
	</svg>
{/snippet}

{#snippet pieceCard()}
	<!-- THE PIECE CARD: the game's reshape screen, line for line, for entering
	     a piece (⚓ Nate: it keeps this shape). Behind the piece's segment now
	     that it does one job (entry), so the stage is one box again; the
	     reshape's radials are on the Reshape view. -->
	<div class="ao-card" bind:clientWidth={cardW}>
		<div class="ao-card-head">
			{@render slotPicker(true)}
			<button
				class="chip chip--control ao-clear"
				onclick={clearPiece}
				aria-label="Clear"
				title={tightCard ? 'Clear' : undefined}
			>
				<Mark name="reset" size={12} />
				{#if !tightCard}<span>Clear</span>{/if}
			</button>
		</div>
		<div class="ao-main-row">
			<span class="ao-main-mark" aria-hidden="true"><Mark name="mainStat" size={12} /></span>
			{#if slot.mains.length > 1}
				<StatField
					kind="name"
					label="Main stat"
					options={mainOptions}
					value={mainValue}
					onpick={pickMainField}
				/>
			{:else}
				<span class="ao-main-fixed">{main.name}</span>
			{/if}
		</div>
		{#each lines as line, i (i)}
			{@const at = pieceLines.findIndex((l) => l.id === line.id)}
			{@const isWanted = line.id !== '' && wantedSubs.includes(line.id)}
			{@const open = unsettled.includes(i) && !readingPicked}
			{@const grayed = unactivatedOn && i === 3}
			<div class="ao-line" class:is-wanted={isWanted && !grayed} class:is-grayed={grayed}>
				{#if line.id === ''}
					<span class="ao-badge is-none" aria-hidden="true"></span>
				{:else if resolution && at >= 0}
					<span
						class="ao-badge"
						class:is-zero={resolution.counts[at] === 1 && !open}
						class:is-open={open}
						title={open
							? 'These values fit more than one upgrade count. Pick the one that matches the game under the card.'
							: undefined}
					>
						{resolution.counts[at] > 1 || open ? resolution.counts[at] - 1 : ''}
						{#if open}{@render warnMark()}{/if}
					</span>
				{:else}
					<span class="ao-badge is-unknown" aria-hidden="true">?</span>
				{/if}
				<StatField
					kind="name"
					label="Substat {i + 1}"
					options={nameOptions(i)}
					value={line.id}
					placeholder="Substat…"
					display={line.id !== '' && tightCard ? substatById(line.id).short : undefined}
					onpick={(v) => setLineStat(i, v as SubstatId | '')}
				/>
				<!-- The value field is there for a blank line too, so a Tab from its
				     name lands on it once the name is set. -->
				<StatField
					kind="value"
					label="Value for substat {i + 1}"
					options={valueOptions[i]}
					value={line.raw}
					placeholder="—"
					onpick={(v) => setLineValue(i, v)}
				/>
			</div>
		{/each}
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
		{#if level === 0}
			<!-- The game shows a 3-line piece's 4th substat grayed out until +4. -->
			<label class="check ao-unactivated">
				<input
					type="checkbox"
					bind:checked={
						() => unactivated,
						(v) => {
							unactivated = v;
							resetReading();
						}
					}
				/>
				<span class="check-box"></span>
				The 4th substat is grayed out (unactivated)
			</label>
		{/if}
		{#if unsettled.length}
			<!-- THE QUESTION, in words, under everything you touch on the card. -->
			<div
				class="ao-reading"
				class:is-open={!readingPicked}
				role="group"
				aria-label="Upgrade counts"
			>
				<p class="ao-reading-ask">
					{#if !readingPicked}{@render warnMark()}{/if}
					<span>
						These values fit {resolutions.length === 2 ? 'two' : resolutions.length} different upgrade
						counts.
						{finished
							? 'Pick the one the game shows when you reshape the piece:'
							: 'Pick the one it got, if you know it:'}
					</span>
				</p>
				<div class="chips">
					{#each resolutions as r, ri (ri)}
						<button
							class="chip chip--control ao-reading-chip"
							class:active={readingPicked && ri === resolutionPick}
							aria-pressed={readingPicked && ri === resolutionPick}
							onclick={() => {
								resolutionPick = ri;
								readingPicked = true;
							}}
						>
							{readingText(r)}
						</button>
					{/each}
				</div>
			</div>
		{/if}
		<p class="note ao-card-note">
			{#if resolution}
				The number beside each substat is how many upgrades it got, the same number the game shows
				on its reshape screen. Your stats are highlighted.
			{:else if pieceComplete}
				Pick your piece's level. Levels these values can't belong to are dimmed.
			{:else}
				Enter each substat and its value exactly as the game shows them, then pick the piece's
				level.
			{/if}
		</p>
	</div>
{/snippet}

{#snippet pieceSegment()}
	<!-- THE PIECE AT A GLANCE, opening the card: "+20 Pyro Goblet · CR 6.6 · …" -->
	<BandMenu
		bind:this={pieceMenu}
		role="dialog"
		align="start"
		ariaLabel="Your piece: {pieceLines.length ? pieceName : 'not entered'}"
	>
		{#snippet face()}
			{#if pieceLines.length}
				<span class="ao-glance">
					<span class="setup-val">{pieceName}</span>
					{#each lines as l, i (i)}
						{#if l.id !== ''}
							<span class="ao-glance-sep" aria-hidden="true">·</span>
							<span
								class="ao-glance-line"
								class:is-wanted={wantedSubs.includes(l.id)}
								class:is-grayed={unactivatedOn && i === 3}
								>{substatById(l.id).short} <span class="ao-glance-num">{l.raw}</span></span
							>
						{/if}
					{/each}
				</span>
			{:else}
				<span class="setup-val">Enter your piece</span>
			{/if}
		{/snippet}
		{#snippet items()}
			<div class="setup-pop ao-card-pop">{@render pieceCard()}</div>
		{/snippet}
	</BandMenu>
{/snippet}

<!-- THE STAGE (design §6; app.css § THE STAGE). One box: the chart head,
     the chart's toolbar on its top edge (the view tabs and the setup bar),
     and the chart with its companion and its handle. -->
<div class="stage-root">
	<div class="stage ctx-dark">
		<!-- THE CHART HEAD: the view's answer, at the stage's top left. -->
		<p class="readout-head stage-head">
			{#if view === 'drop'}
				{formatChance(chanceBy.domain)}<span class="readout-sentence"
					>chance of the piece within {daysPhrase(days)}</span
				>
			{:else if emptyReason}
				—<span class="readout-sentence"
					>{emptyReason === 'main'
						? 'Pick a substat'
						: emptyReason === 'unfinished'
							? 'Reshaping needs a +20 piece'
							: emptyReason === 'pick'
								? 'Pick two substats to reshape'
								: 'Enter your piece to see how it measures up'}</span
				>
			{:else if view === 'reshape'}
				{formatChance(beats)}<span class="readout-sentence"
					>chance a {reshapeName} reshape beats your piece</span
				>
			{:else if view === 'piece' && finished}
				Better than {Math.round(percentile * 100)}%<span class="readout-sentence"
					>of +20 {slotPlural} with these four substats</span
				>
			{:else}
				{formatChance(beats)}<span class="readout-sentence"
					>chance it ends above {valueOf(reference)}{view === 'piece' ? ' at +20' : ''}</span
				>
			{/if}
		</p>

		<!-- THE CHART'S TOOLBAR: the view tabs, then the setup bar. -->
		<div class="stage-toolbar">
			<div class="segment stage-tabs" role="radiogroup" aria-label="View">
				{#each VIEWS as v (v.id)}
					<button
						class="btn"
						class:is-active={view === v.id}
						role="radio"
						aria-checked={view === v.id}
						onclick={() => (view = v.id)}
					>
						{v.label}
					</button>
				{/each}
			</div>
			<div class="setup-bar" role="group" aria-label="Setup">
				{#if view === 'piece' || view === 'reshape'}
					{@render pieceSegment()}
				{:else}
					{@render segment('Piece', pieceFace, pieceFace, pieceBody)}
				{/if}
				{@render segment('Your stats', wantedFace, wantedFace, wantedBody)}
				{#if view === 'drop'}
					{@render segment(
						'Set',
						eitherSet ? 'Either' : 'One',
						eitherSet ? 'Either' : 'One',
						setBody
					)}
				{/if}
				{#if view === 'level'}
					{#if wantedSubs.length > 1}
						{@render segment('Has', hasWord(levelK), hasWord(levelK), hasBody)}
					{/if}
					{@render segment(
						'Dropped with',
						fourLine ? '4 substats' : '3 substats',
						fourLine ? '4 substats' : '3 substats',
						startBody
					)}
				{/if}
				{#if view === 'level' || view === 'piece'}
					{@render segment(
						'Made',
						defined ? 'With Elixir' : 'Farmed',
						defined ? 'With Elixir' : 'Farmed',
						madeBody
					)}
				{/if}
				{#if view === 'reshape'}
					<BandMenu
						bind:this={reshapeMenu}
						role="dialog"
						align="start"
						ariaLabel="Reshape: {reshapeFace}"
					>
						{#snippet face()}
							<span class="setup-key">Reshape</span>
							<span class="setup-val">{reshapeFace}</span>
						{/snippet}
						{#snippet items()}
							<div class="setup-pop">{@render reshapeBody()}</div>
						{/snippet}
					</BandMenu>
				{/if}
			</div>
			<!-- A chart tool, at the toolbar's far end (design §6). -->
			{#if view === 'reshape' && !emptyReason}
				<button class="btn ao-tool" onclick={tryReshape}>
					<Mark name="dice" size={14} /> Try a reshape
				</button>
			{/if}
		</div>

		{#if rolling}
			<ReshapeRoll
				lines={pieceLines.map((l) => ({
					name: substatById(l.id).name,
					short: substatById(l.id).short,
					selected: rshSel.includes(l.id),
					wanted: wantedSubs.includes(l.id),
					unit: substatById(l.id).isPct ? '%' : ''
				}))}
				original={pieceLines.map((l) => l.raw)}
				originalCounts={resolution?.counts ?? []}
				roll={rolling}
				mainName={main.id === 'elemDmg' ? `${element} DMG Bonus` : main.name}
				kind={reshapeName}
				originalValue={valueOf(nowX)}
				resultValue={valueOf(rolling.x)}
				originalRank={reshapeRank(nowX)}
				resultRank={reshapeRank(rolling.x)}
				verdict={rollVerdict(rolling)}
				onsettle={() => rolling && recordTry(rolling)}
				onclose={closeRoll}
				onretry={retryRoll}
			/>
		{/if}

		<div class="ao-chart-col">
			<div
				class="stage-graph instrument-graph"
				style:--graph-min="{PLOT_MIN + CHROME_H}px"
				bind:clientWidth={graphW}
				bind:clientHeight={graphH}
			>
				{#if emptyReason}
					<div class="ao-empty">
						{#if emptyReason === 'main'}
							<p>Your only chosen stat is this piece's main stat. Pick a substat too.</p>
						{:else if emptyReason === 'incomplete'}
							<p>
								{pieceLines.length
									? 'Enter all four of its substats, a grayed-out one too.'
									: 'Enter a piece to see how it measures up.'}
							</p>
							<button class="btn" onclick={() => pieceMenu?.show()}>
								{pieceLines.length ? 'Finish your piece' : 'Enter your piece'}
							</button>
						{:else if emptyReason === 'impossible'}
							<p>One of these values isn't possible for that substat. Check it against the game.</p>
							<button class="btn" onclick={() => pieceMenu?.show()}>Edit your piece</button>
						{:else if emptyReason === 'misfit'}
							<p>
								These values add up to {totals.join(' or ')} upgrade{totals.at(-1) === 1
									? ''
									: 's'}, but a {levelLabel} piece has only {Math.max(
									0,
									upgradesAt(level) - 1
								)}–{upgradesAt(level)}.
								{#if LEVELS.some((l) => fitsLevel[l.at])}
									Recheck your values, or pick {LEVELS.filter((l) => fitsLevel[l.at])
										.map((l) => l.label)
										.join(' or ')}.
								{:else}
									Recheck your values.
								{/if}
							</p>
							<button class="btn" onclick={() => pieceMenu?.show()}>Edit your piece</button>
						{:else if emptyReason === 'unfinished'}
							<p>This piece is {levelLabel}. Level it to +20 to reshape it.</p>
							<button class="btn" onclick={() => pieceMenu?.show()}>Edit your piece</button>
						{:else if emptyReason === 'pick'}
							<p>Pick the two substats to reshape, as the game's reshape screen asks.</p>
							<button class="btn" onclick={() => reshapeMenu?.show()}>Pick two substats</button>
						{:else}
							<p>None of your chosen stats are on this piece.</p>
						{/if}
					</div>
				{:else}
					<svg
						width={graphW}
						height={H}
						role="img"
						aria-label={view === 'drop'
							? 'Chance of this piece by days of resin'
							: `Chance to end above each ${unit === 'cv' ? 'crit value' : 'count of useful rolls'} at +20`}
						onpointerdown={onDown}
						onpointermove={onMove}
						onpointerup={onUp}
						onpointercancel={onUp}
						style:cursor={draggable ? 'ew-resize' : 'default'}
					>
						<!-- X grid and the axis's numbers, through the plot and the strip -->
						{#if view === 'drop'}
							{#each farmTicks as t (t)}
								<line
									x1={farmXOf(t)}
									y1={TOP}
									x2={farmXOf(t)}
									y2={plotY1}
									stroke="var(--chart-grid)"
								/>
								<text
									x={farmXOf(t)}
									y={axisY + 15}
									fill="var(--chart-ink)"
									font-size="10"
									text-anchor="middle"
								>
									{fmtNum(t)}
								</text>
							{/each}
						{:else}
							{#each histTicks as t (t)}
								<line
									x1={histXOf(t)}
									y1={TOP}
									x2={histXOf(t)}
									y2={plotY1}
									stroke="var(--chart-grid)"
								/>
								<line
									x1={histXOf(t)}
									y1={compY0}
									x2={histXOf(t)}
									y2={compY1}
									stroke="var(--chart-grid)"
								/>
								<text
									x={histXOf(t)}
									y={axisY + 15}
									fill="var(--chart-ink)"
									font-size="10"
									text-anchor="middle"
								>
									{unit === 'cv' ? t : t.toFixed(1)}
								</text>
							{/each}
						{/if}
						<text
							x={graphW - PADR}
							y={axisY + 27}
							fill="var(--chart-dim)"
							font-size="10"
							text-anchor="end"
						>
							{view === 'drop'
								? 'days of resin'
								: unit === 'cv'
									? 'crit value (CV) at +20'
									: 'useful rolls in your stats at +20'}
						</text>

						<!-- Y grid: the chance -->
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
						<line x1={PADL} y1={plotY1} x2={graphW - PADR} y2={plotY1} stroke="var(--chart-rule)" />
						<text x="4" y={TOP - 4} fill="var(--chart-dim)" font-size="10" text-anchor="start">
							{view === 'drop'
								? 'chance you have it by then'
								: view === 'reshape'
									? 'chance a reshape ends above'
									: 'chance it ends above'}
						</text>

						{#if view === 'drop'}
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
								class="stage-word"
								x={farmLabels.outbreak.x}
								y={farmLabels.outbreak.y}
								fill="var(--chart-ink)"
								font-size="11"
								text-anchor={farmLabels.outbreak.anchor}
							>
								In an Outbreak
							</text>
							<text
								class="stage-word"
								x={farmLabels.domain.x}
								y={farmLabels.domain.y}
								fill="var(--text)"
								font-size="11"
								font-weight="600"
								text-anchor={farmLabels.domain.anchor}
							>
								Domain
							</text>
						{:else}
							<!-- The companion: 100 pieces, one dot each, on the same x axis -->
							<line
								x1={PADL}
								y1={compY1}
								x2={graphW - PADR}
								y2={compY1}
								stroke="var(--chart-rule)"
							/>
							<text x="4" y={compY0 - 6} fill="var(--chart-dim)" font-size="10" text-anchor="start">
								{stripLabel}
							</text>
							{#each strip.dots as d, i (i)}
								<circle
									cx={d.cx}
									cy={d.cy}
									r={d.r}
									fill={d.on ? 'var(--accent)' : 'var(--chart-ink)'}
									fill-opacity={d.on ? 0.95 : 0.4}
								/>
							{/each}
							{#each stripRings as r (r.key)}
								<circle
									cx={r.cx}
									cy={r.cy}
									r={r.rr}
									fill="none"
									stroke={r.kind === 'yours' ? 'var(--text)' : 'var(--accent)'}
									stroke-width={r.kind === 'try' ? 1 : 1.75}
									stroke-opacity={r.kind === 'try' ? 0.55 : 1}
								/>
								{#if r.label}
									<text
										class="stage-word"
										x={r.cx}
										y={r.ly}
										fill={r.kind === 'yours' ? 'var(--text)' : 'var(--accent)'}
										font-size="10"
										text-anchor="middle">{r.label}</text
									>
								{/if}
							{/each}

							<!-- The curves: the head's bold, the others thin -->
							{#each curves.slice(1) as c (c.key)}
								<path
									d={survivalPath(c.dist)}
									fill="none"
									stroke="var(--chart-ink)"
									stroke-width="1.25"
									stroke-linejoin="round"
								/>
							{/each}
							{#if curves[0]}
								<path
									d={survivalPath(curves[0].dist)}
									fill="none"
									stroke="var(--text)"
									stroke-width="2"
									stroke-linejoin="round"
								/>
							{/if}

							<!-- Your piece now, on the way to +20 -->
							{#if view === 'piece' && !finished && query}
								<line
									x1={histXOf(nowX)}
									y1={TOP}
									x2={histXOf(nowX)}
									y2={plotY1}
									stroke="var(--chart-rule)"
									stroke-dasharray="4 4"
								/>
								<text
									class="stage-word"
									x={histXOf(nowX) + 5}
									y={TOP + 11}
									fill="var(--chart-dim)"
									font-size="10"
								>
									now {fmtValue(nowX)}
								</text>
							{/if}
						{/if}

						<!-- The crossings, drawn where they are -->
						{#each crossings as c (c.key)}
							<line
								x1={c.cx}
								y1={c.cy}
								x2={c.cx}
								y2={plotY1}
								stroke="var(--chart-ink)"
								stroke-dasharray="2 3"
							/>
							<circle
								cx={c.cx}
								cy={c.cy}
								r="3"
								fill="var(--frame-bg)"
								stroke="var(--text)"
								stroke-width="1.5"
							/>
							<text
								class="stage-word"
								x={c.lx}
								y={c.ly}
								fill="var(--chart-ink)"
								font-size="11"
								text-anchor={c.anchor}
							>
								{c.text}<title>{c.title}</title>
							</text>
						{/each}

						<!-- The marker: a dot where it crosses each curve, down to the handle -->
						<line
							x1={markX}
							y1={TOP}
							x2={markX}
							y2={axisY}
							stroke="var(--chart-ink)"
							stroke-width="1.5"
						/>
						{#each markDots as d (d.key)}
							<circle
								cx={markX}
								cy={yOf(d.p)}
								r={d.primary ? 4.5 : 3}
								fill={d.primary ? 'var(--accent)' : 'var(--chart-ink)'}
								style="stroke: var(--frame-bg)"
								stroke-width="1.5"
							/>
						{/each}
						{#each dotLabels as l (l.key)}
							<text
								class="stage-word"
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
				{/if}
			</div>

			<!-- THE HANDLE: the x axis's own. Days in Drop; the value to beat in
			     Level up and on an unfinished piece; your piece at +20 and in
			     Reshape. -->
			{#if !emptyReason}
				<div
					class="stage-handle"
					style:--stage-handle-l="{PADL - THUMB_R}px"
					style:--stage-handle-r="{PADR - THUMB_R}px"
				>
					{#if view === 'drop'}
						<InstrumentSlider
							label="Days of resin"
							bind:value={() => days, (v) => (days = v)}
							min={0}
							max={farmDomain}
							step={1}
							fieldMin={1}
							fieldMax={MAX_DAYS}
							snap={(v) => Math.max(1, Math.round(v))}
							valueText={daysPhrase(days)}
						/>
					{:else if markIsPiece}
						<InstrumentSlider
							label="Your piece"
							value={nowX}
							min={histLo}
							max={histHi}
							step={0.1}
							decimals={1}
							typeable={false}
							disabled
						/>
					{:else}
						<InstrumentSlider
							label="To beat"
							aria="The value to beat"
							bind:value={
								() => reference,
								(v) => {
									if (view === 'level') refLevel = v;
									else refPiece = v;
								}
							}
							min={histLo}
							max={histHi}
							step={0.1}
							decimals={1}
							fieldMin={0}
							fieldMax={100}
						/>
					{/if}
				</div>
			{/if}

			<!-- The fine print: what no part of the chart can show. -->
			{#if view === 'drop'}
				<p class="stage-fine">
					About 1 in every {oneIn(perPiece)} five-star drops from this domain is the piece you want.
					{daysPhrase(days)} is {fmtNum(resinOf(days))} resin, at {RESIN_PER_DAY} a day. During a Stygian
					Onslaught Disturbance Outbreak, every 120 resin you spend also earns one extra 5★ from the domain.
				</p>
			{:else if !emptyReason && view === 'level' && unit === 'rolls'}
				<p class="stage-fine">
					Useful rolls count every roll in your stats by its size: a max roll counts as 1, the
					smallest as 0.7. A substat's starting roll counts too.
				</p>
			{:else if !emptyReason && view === 'piece' && !finished && refPiece === null}
				<p class="stage-fine">
					Until you drag it, the value to beat is a typical +20 {slotWord} with these substats.
				</p>
			{:else if !emptyReason && view === 'piece' && finished}
				<p class="stage-fine">
					<button class="btn btn--sm ao-next" onclick={() => (view = 'reshape')}>
						Reshape this piece <Mark name="forwardSlim" size={11} />
					</button>
				</p>
			{:else if !emptyReason && view === 'reshape'}
				<p class="stage-fine">
					Reshaping keeps each substat's starting roll and rerolls all its upgrades. You keep
					whichever result you prefer, so the piece can't come out worse: a reshape costs 1 Dust of
					Enlightenment for a flower or plume, and 2 for other pieces.
				</p>
			{/if}
		</div>
	</div>
</div>

<style>
	/* ── The chart's column: the chart, its handle, the fine print ──
	   The stage (app.css § THE STAGE) is a column; this takes what the head
	   and the toolbar leave. */
	.ao-chart-col {
		flex: 1 1 0;
		min-height: max-content;
		display: flex;
		flex-direction: column;
		gap: var(--inst-gap-control);
		min-width: 0;
	}

	/* A capped svg (and .instrument-graph's min-width 0): otherwise the svg's
	   own width props the box open, the measured width never shrinks, and a
	   narrower tile clips the chart's right end */
	.ao-chart-col :global(svg) {
		max-width: 100%;
	}

	/* What the chart can't draw yet, in the chart's own box, with the way on */
	.ao-empty {
		display: grid;
		justify-items: center;
		height: 100%;
		align-content: center;
		gap: 0.9rem;
		padding: 0 1rem;
		text-align: center;
		color: var(--chart-ink);
	}

	.ao-empty p {
		margin: 0 auto;
		max-width: 44ch;
	}

	.ao-next {
		gap: 0.35rem;
	}

	/* A chart tool holds the toolbar's far end */
	.ao-tool {
		margin-left: auto;
		gap: 0.4rem;
	}

	/* ── The piece at a glance (the setup bar's first segment) ──
	   Its figures tabular; your stats in the gold the card gives them; a
	   grayed-out 4th line dim, as the game shows it. On a narrow bar it may
	   wrap inside its segment rather than run past the bar. */
	.ao-glance {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 0.4rem;
		white-space: normal;
		text-align: left;
	}

	.ao-glance-line {
		color: var(--text);
		white-space: nowrap;
	}

	.ao-glance-line.is-wanted {
		color: var(--accent);
	}

	.ao-glance-line.is-grayed {
		color: var(--chart-dim);
	}

	.ao-glance-num {
		font-variant-numeric: tabular-nums;
	}

	.ao-glance-sep {
		color: var(--chart-dim);
	}

	/* ── Popover contents ─────────────────────────────────────────────────── */

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

	/* 🎛️ The card's popover: wider than a setting's 22rem, for the lines'
	   names beside their values (the card's own 22rem column on the stage
	   before it moved behind the segment) */
	.ao-card-pop {
		width: min(24rem, calc(100vw - 2rem));
	}

	.ao-card {
		display: grid;
		gap: 0.3rem;
		min-width: 0;
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
		grid-template-columns: 1.5rem minmax(0, 1fr);
		align-items: center;
		gap: 0.45rem;
		padding: 0 0.3rem 0.2rem;
	}

	/* The game marks its main stat with a star where substats carry a badge */
	.ao-main-mark {
		display: grid;
		place-items: center;
		color: var(--muted);
	}

	/* As tall as the field it replaces on a flower or plume, so switching
	   slots doesn't move the card */
	.ao-main-fixed {
		display: flex;
		align-items: center;
		height: 2rem;
		padding-left: 0.6rem;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	.ao-line {
		display: grid;
		grid-template-columns: 1.5rem minmax(0, 1fr) 5.2rem;
		align-items: center;
		gap: 0.45rem;
		padding: 0.2rem 0.3rem;
		border-radius: 3px;
	}

	.ao-line.is-wanted {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.ao-line.is-wanted > :global(.sf--name .sf-input) {
		color: var(--accent);
	}

	/* A grayed-out 4th line, as the game shows one below +4 */
	.ao-line.is-grayed :global(.sf-input) {
		color: var(--muted);
	}

	/* The upgrade badge: a gold disc with the count, a dot for none (the game's) */
	.ao-badge {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
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

	/* A count still to be settled: the pip open (a ring, not a fill), with
	   the notification mark on its top-right corner. The same mark leads the
	   question under the card, so the two read as one thing. */
	.ao-badge.is-open {
		background: transparent;
		box-shadow: inset 0 0 0 1.5px var(--accent);
		color: var(--accent);
	}

	/* 12px, overlapping the pip by about half its width (⚓ Nate: a touch bigger,
	   a touch further in) */
	.ao-badge .ao-warn {
		position: absolute;
		top: -5px;
		right: -6px;
		width: 12px;
		height: 12px;
		pointer-events: none;
	}

	/* ↻ 2026-11-03: the disc was --ui-danger, which the streamer read as an
	   error ("invalid value"). It isn't one: the model took a reading that
	   may be a stand-in, which is what --ui-provisional means. Its "!" is the
	   dark ground, as the pip's figures are. */
	.ao-warn-disc {
		fill: var(--ui-provisional);
	}

	.ao-warn-ink {
		fill: var(--frame-bg);
	}

	/* The six levels on one row at any card width: even columns, the chips
	   filling them (as a wrapping row, +20 went to a line of its own). */
	.ao-levels {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.25rem;
		margin-top: 0.4rem;
	}

	.ao-levels :global(.chip) {
		justify-content: center;
		padding-inline: 0;
	}

	.ao-unactivated {
		margin-top: 0.3rem;
		font-size: var(--fs-md);
	}

	/* The readings: the question in words, and each answer a chip that says
	   what it sets. Under the level chips, so it moves nothing you touch. */
	.ao-reading {
		display: grid;
		gap: 0.45rem;
		margin-top: 0.5rem;
		padding: 0.55rem 0.6rem;
		border-radius: var(--r-sm);
		background: color-mix(in srgb, var(--text) 5%, transparent);
	}

	.ao-reading.is-open {
		background: var(--ui-provisional-soft);
	}

	.ao-reading-ask {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		margin: 0;
		font-size: var(--fs-md);
		line-height: var(--lh-snug);
		color: var(--text);
	}

	.ao-reading-ask .ao-warn {
		flex: none;
		width: 14px;
		height: 14px;
		margin-top: 0.1rem;
	}

	.ao-reading-chip {
		font-variant-numeric: tabular-nums;
	}

	.ao-card-note {
		margin-top: 0.4rem;
	}

	/* ── The Reshape popover: the game's reshape screen ──
	   Each line a button: its badge, name and value, and the game's radial on
	   its right; two at most. */
	.ao-rs-lines {
		display: grid;
		gap: 0.3rem;
	}

	.ao-rs-line {
		display: grid;
		grid-template-columns: 1.5rem minmax(0, 1fr) auto 1.5rem;
		align-items: center;
		gap: 0.45rem;
		width: 100%;
		min-height: 2.2rem;
		padding: 0.2rem 0.5rem 0.2rem 0.3rem;
		border: 1px solid color-mix(in srgb, var(--text) 18%, transparent);
		border-radius: 3px;
		background: transparent;
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		text-align: left;
		cursor: pointer;
		transition:
			background var(--t-snap),
			border-color var(--t-snap);
	}

	.ao-rs-line:hover:not(:disabled) {
		background: var(--fill-hover);
	}

	.ao-rs-line.is-on {
		border-color: color-mix(in srgb, var(--accent) 65%, transparent);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.ao-rs-line:disabled {
		cursor: default;
		opacity: 0.55;
	}

	.ao-rs-line.is-wanted .ao-rs-name {
		color: var(--accent);
	}

	.ao-rs-value {
		font-variant-numeric: tabular-nums;
	}

	/* The game's reshape radial */
	.ao-radial {
		justify-self: center;
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1.5px var(--muted);
		transition: background var(--t-snap);
	}

	.ao-radial.is-on {
		background: var(--accent);
		box-shadow: none;
	}
</style>
