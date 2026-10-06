<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import Mark from '$lib/components/Mark.svelte';
	import {
		simulateGauge,
		gaugesAt,
		GAUGE_OPTIONS,
		type Application,
		type ElementId,
		type ReactionKind,
		type SimEvent
	} from '$lib/utils/gauge';
	import { AURA_MOD_META, AURA_MOD_ORDER, ELEMENT_LABEL, auraUMax } from '$lib/utils/auraDisplay';
	import { elementPalette, shiftHue } from '$lib/utils/elementColors';
	import { MAX_GAUGE_APPS, MAX_GAUGE_TIME } from './workspace';
	import Emphasis from '$lib/components/Emphasis.svelte';
	import EventLog, { type EventLogRow } from '$lib/components/EventLog.svelte';
	import { createPlayhead } from './playhead.svelte';
	import { PLAYHEAD_SPEEDS } from './playhead';

	// Workspace visibility: benched tiles suspend playback's rAF entirely
	let { active = true }: { active?: boolean } = $props();

	const ELEMENTS: ElementId[] = ['pyro', 'hydro', 'anemo', 'electro', 'cryo', 'geo', 'dendro'];

	// ↻ Gauge round L6: the mod vocabulary moved to `$lib/utils/auraDisplay.ts`
	// when the planner's aura lane became a second reader. ⛔ Don't re-inline it
	// — a Frozen bar must be the same colour in both tools.
	const MOD_META = AURA_MOD_META;
	const MOD_ORDER = AURA_MOD_ORDER;

	// ⚠️ STAYS LOCAL, and is not the planner's map. This is keyed on the GAUGE's
	// `ReactionKind` — the instrument drives `simulateGauge` directly and so sees
	// the distinctions `reactionBridge.ts` collapses on the way to the IR:
	// forward vs reverse multipliers, a blocked crystallize, a bloom that formed
	// off Quicken. The planner cannot say any of those.
	const REACTION_NAME: Record<ReactionKind, string> = {
		vaporize: 'Vaporize ×2',
		reverseVaporize: 'Vaporize ×1.5',
		melt: 'Melt ×2',
		reverseMelt: 'Melt ×1.5',
		overload: 'Overloaded',
		superconduct: 'Superconduct',
		electroCharged: 'Electro-Charged',
		freeze: 'Frozen',
		swirl: 'Swirl',
		crystallize: 'Crystallize',
		crystallizeBlocked: 'Crystallize (blocked)',
		quicken: 'Quicken',
		aggravate: 'Aggravate',
		spread: 'Spread',
		bloom: 'Bloom',
		quickenBloom: 'Bloom (via Quicken)',
		burning: 'Burning',
		hyperbloom: 'Hyperbloom',
		burgeon: 'Burgeon'
	};

	type PresetDef = {
		id: string;
		label: string;
		note: string;
		apps: [number, ElementId, number][];
	};
	// ══ THE SCENARIOS (rewritten 2026-08-17, ⚓ NATE) ═════════════════════════
	//
	// ⚓ 1U IS THE DEFAULT, because it is what the game is made of. The corpus we
	// measured is 1U ×327, 2U ×58, 4U ×2 — so a demo board built on 2U
	// applications taught the arithmetic with numbers a player almost never
	// meets, and every scenario read as "big hit lands, big thing happens". At 1U
	// the same mechanics show up at the scale they actually occur, and several
	// get MORE instructive rather than less: a single Hydro hit really does clear
	// a Pyro aura, and that is the lesson.
	//
	// ⚠️ THE EXCEPTIONS ARE ALL ONE EXCEPTION: a scenario keeps a larger first
	// application ONLY where the mechanic is INVISIBLE without a size difference.
	// ⛔ Never because the chart looked better.
	//
	// 🐛 AND THE TRAP THAT PRODUCED MOST OF THEM, twice, in two different
	// scenarios: a same-element re-application TOPS UP to the new value, it does
	// not STACK. So two 1U hits leave exactly the 0.8U aura one hit does, and
	// every "build it up with small hits" idea is silently a no-op. ⛔ Don't
	// reach for repeated 1U applications to make a bigger aura.
	//
	//   · Top-Up — two different sizes, or "the first application's decay rate is
	//     inherited" has nothing to show: equal applications share a rate.
	//   · Reverse Melt (2U) — the aura must SURVIVE its first trigger, which is
	//     the entire content of "the weak direction only nibbles".
	//   · Vaporize (2U) — so the ×2 consumption is VISIBLE rather than implied: a
	//     1U trigger clearing a 1U aura looks like any other clear.
	//   · Freeze (2U) — the note promises "leftover Hydro underneath", and a 1U
	//     aura is entirely consumed, so there was none.
	//   · Electro-Charged (2U Hydro) — the lesson is that the SMALLER gauge runs
	//     out first, which two equal auras cannot show. ⚠️ Its note previously
	//     claimed the asymmetry while the demo showed symmetry.
	//   · Quicken (1.5U) — ⚓ Nate: at 1U the Quicken line lands on top of the
	//     Dendro one and reads as the same object, when they are unrelated and
	//     decay differently. 1.5U is also exactly what Nahida's skill applies,
	//     which is the meta Quicken enabler.
	// ⚓ THE ORDER IS CONCEPTUAL (2026-10-02, ⚓ Nate): the aura's own rules
	// first, then the amplifying reactions, the ones where two auras COEXIST,
	// and the rest. The chips carry no group headings — the order does it.
	//
	// ⚠ The notes are the instrument's teaching, and each claim was checked
	// against gcsim `pkg/reactable` + `docs/library/game/elemental-reactions.md`
	// on 2026-10-02. Burning's said "re-applying 1U Pyro every 0.25s": that is
	// its DAMAGE cadence — the application rides the Burning ICD (BURNING_ICD in
	// gauge.ts), about every 2s.
	const PRESETS: PresetDef[] = [
		{
			id: 'single',
			label: 'Single aura',
			note: '1U application — the size of most hits in the game — lands as 0.8U after the ×0.8 aura tax, then decays out over 2.5 × 1 + 7 = **9.5s**.',
			apps: [[0, 'pyro', 1]]
		},
		{
			id: 'topup',
			label: 'Top-up',
			note: 'Re-applying the same element (except Pyro, as of version 3.0) tops the gauge up but keeps the **first** application’s decay rate. 2U onto a 1U aura refills it and still drains at the slow 1U rate.',
			apps: [
				[0, 'electro', 1],
				[3, 'electro', 2]
			]
		},
		{
			// ⚓ Added 2026-10-02: Top-up's exception, and the only scenario that
			// shows the log's two Pyro-only lines (too weak · refreshed). gcsim
			// `attachOverlapRefreshDuration`: below the standing aura → no-op; at
			// or above → the gauge AND the decay rate are replaced.
			// 2U at 0 stands at ~1.47U at 1s (beats a 0.8U taxed hit) and ~0.67U
			// at 7s (loses to one).
			id: 'pyroRefresh',
			label: 'Pyro refresh',
			note: 'Since version 3.0, Pyro doesn’t top up. A hit weaker than the aura left on the target does nothing; one at least as strong replaces it, decay rate included. Here the 1U hit at 1s is too weak, and the one at 7s takes over and drains at the 1U rate.',
			apps: [
				[0, 'pyro', 2],
				[1, 'pyro', 1],
				[7, 'pyro', 1]
			]
		},
		{
			id: 'vape',
			label: 'Vaporize',
			note: 'Hydro on Pyro is the strong direction: the trigger removes twice its own gauge. A single 1U Hydro hit clears a 2U Pyro aura outright — which is why one Vaporize usually leaves nothing behind.',
			apps: [
				[0, 'pyro', 2],
				[2.5, 'hydro', 1]
			]
		},
		{
			id: 'melt',
			label: 'Reverse Melt',
			note: 'Cryo on Pyro is the weak direction: the trigger removes only **half** its own gauge, so each 1U hit chips 0.5U off a 2U aura instead of clearing it. (The ×1.5 on the chart is the **damage** multiplier — a different number from what the reaction costs the aura.)',
			apps: [
				[0, 'pyro', 2],
				[2, 'cryo', 1],
				[4, 'cryo', 1],
				[6, 'cryo', 1]
			]
		},
		{
			id: 'ec',
			label: 'Electro-Charged',
			note: 'Hydro and Electro coexist, and each tick drains 0.4U from **both** gauges. The smaller aura runs out first, which ends the reaction and leaves the larger one on the target. A 2U Hydro aura outlives a 1U Electro one.',
			apps: [
				[0, 'hydro', 2],
				[1, 'electro', 1]
			]
		},
		{
			id: 'quicken',
			label: 'Quicken',
			note: 'Quicken forms 1:1 and lives 5 × gauge + 6s. Aggravate hits on it consume nothing — but the same hit can re-Quicken off leftover Dendro. This example uses a starting 1.5U of Dendro — the strength of Nahida’s Tri-Karma Purification hits.',
			apps: [
				[0, 'dendro', 1.5],
				[1, 'electro', 1],
				[2, 'electro', 1]
			]
		},
		{
			id: 'pyroec',
			// ⚓ NATE: "Overvape" is the name players use for this interaction; "Pyro
			// on EC" described the inputs rather than the thing being demonstrated.
			label: 'Overvape',
			note: 'One Pyro hit on an Electro-Charged target reacts with the Electro first (Overloaded); whatever gauge it has left then reacts with the Hydro (Vaporize).',
			apps: [
				[0, 'hydro', 1],
				[1, 'electro', 1],
				[2, 'pyro', 1]
			]
		},
		{
			id: 'freeze',
			label: 'Frozen',
			note: 'Frozen forms at 2 × min(aura, trigger) and decays on its own accelerating clock. Any leftover Hydro keeps ticking down underneath it.',
			apps: [
				[0, 'hydro', 2],
				[1.5, 'cryo', 1]
			]
		},
		{
			// ⚓ Added 2026-10-02. gcsim `TryMelt`: Pyro reduces Cryo AND Frozen,
			// each by up to 2 × its gauge, paying for the larger; `TryVaporize`
			// refuses outright while any Frozen remains. So the Hydro under the
			// ice outlives a hit that would have vaporized it bare.
			id: 'meltFrozen',
			label: 'Melt on Frozen',
			note: 'Pyro melts Frozen at ×2, just as it melts Cryo. The game refuses Vaporize while any Frozen remains, so the Hydro underneath survives a hit that would have cleared it on a bare target.',
			apps: [
				[0, 'hydro', 2],
				[1, 'cryo', 1],
				[2, 'pyro', 1]
			]
		},
		{
			id: 'swirl',
			label: 'Swirl',
			note: 'Anemo consumes at ×0.5 and can never attach as an aura — it takes half a unit and leaves the rest behind.',
			apps: [
				[0, 'pyro', 1],
				[2, 'anemo', 1]
			]
		},
		{
			id: 'crystallize',
			label: 'Crystallize',
			note: 'Geo consumes at ×0.5 with a 1s reaction cooldown — the attempt inside the window is blocked and takes no gauge at all.',
			// ⚓ Nate's spacing: 0.8 / 1.6 / 2.4 still shows blocked-then-allowed (the
			// 1.6 attempt falls inside 0.8's 1s window; 2.4 is clear of it) and stops
			// the three names crowding. ⚠️ The stagger above is the general fix — this
			// is just a demo that does not need to lean on it.
			apps: [
				[0, 'electro', 1],
				[0.8, 'geo', 1],
				[1.6, 'geo', 1],
				[2.4, 'geo', 1]
			]
		},
		{
			id: 'bloom',
			label: 'Bloom',
			note: 'Hydro on Dendro is the weak direction of Bloom: a 1U Hydro trigger removes only 0.5U of Dendro and spawns a Dendro Core, leaving the rest of the aura behind.',
			apps: [
				[0, 'dendro', 1],
				[2, 'hydro', 1]
			]
		},
		{
			id: 'burning',
			label: 'Burning',
			note: 'Burning = a fixed 2U aura plus a hidden fuel gauge that drains at 0.4U per second or faster. It deals damage every 0.25s and re-applies 1U Pyro about every 2s, until the fuel runs out. Feeding it more Dendro extends the burn.',
			apps: [
				[0, 'dendro', 1],
				[1, 'pyro', 1],
				[2, 'dendro', 1]
			]
		}
	];

	const MAX_APPS = MAX_GAUGE_APPS;

	// Elements involved in a preset, in order of first appearance — drives the
	// little overlapping icons inside the scenario chips
	const presetElements = (p: PresetDef): ElementId[] => [...new Set(p.apps.map(([, e]) => e))];

	// ══ THE APPLICATION LIST (rebuilt 2026-08-17, ⚓ NATE) ═════════════════════
	//
	// ⚓ THE CHART OWNS **WHEN**, THE PANEL OWNS **WHAT**. An application's time is
	// a position on the time axis, and it used to be set by a slider in a list
	// hundreds of pixels below that axis — ⚓ Nate: "as you add more elemental
	// applications you have to keep going downwards, but then to see the results
	// you have to scroll upwards." Each row cost three stacked lines, so eight
	// applications was ~800px of editor under a chart you had to keep looking at.
	// Time is dragged on the marker band now; the panel is ONE inspector for the
	// SELECTED application, so it no longer grows with the list at all.
	//
	// 🐛 AND IT CLOSES A REAL DISAGREEMENT. Every row's slider ranged over the
	// whole domain independently, so an application could be dragged past its
	// neighbours — ⚠ the SIMULATION was never wrong (`simulateGauge` sorts its
	// input), but it hands `apply` events an `appIndex` in TIME order while the
	// editor listed rows in INSERTION order, so the event log's #1 could be the
	// panel's third row. Sorting the list by time makes the chart, the panel and
	// the log one story.
	type AppRow = Application & { id: number };
	/** ⚠ IDENTITY, NOT POSITION. The list re-sorts under a drag, so every consumer
	 *  — the selection, the in-flight drag, the keyed `{#each}` over the markers —
	 *  has to name a row by something that survives the row moving. A bare index
	 *  would hand the drag to whichever application it swapped past. */
	let nextAppId = 0;
	const makeRows = (apps: Application[]): AppRow[] =>
		apps.map((a) => ({ ...a, id: nextAppId++ })).sort((a, b) => a.time - b.time);
	const presetRows = (p: PresetDef): AppRow[] =>
		makeRows(p.apps.map(([time, element, gauge]) => ({ time, element, gauge })));

	let preset = $state('single');
	// ⚠ Built once into a plain array first: `selectedId` needs the first row's id
	// at init, and reading it back off the `$state` array is the "only captures
	// the initial value" warning — which is exactly what is wanted here, but is
	// better said than suppressed.
	const initialRows = presetRows(PRESETS[0]);
	let appRows = $state<AppRow[]>(initialRows);
	let scrubbing = $state(false);
	/**
	 * ⚓ SOMETHING IS ALWAYS SELECTED while there is anything to select. The
	 * inspector is the only editor now, so an empty one would be a panel that
	 * changes height and a reader with no obvious way in; selecting the first
	 * application by default means the panel is populated from first paint and
	 * the ring on the chart teaches what the panel is pointed at.
	 * ⛔ It is not an INDEX — see AppRow's note.
	 */
	let selectedId = $state<number>(initialRows[0]?.id ?? -1);
	const selected = $derived(appRows.find((r) => r.id === selectedId) ?? null);

	/** Keep the list in time order. ⚠ The comparator MUST match the one inside
	 *  `simulateGauge`, and both must be stable, or `appIndex` stops addressing
	 *  the row it describes — that is the coupling `markers` depends on. */
	function resort() {
		appRows.sort((a, b) => a.time - b.time);
	}

	function setRows(apps: Application[]) {
		appRows = makeRows(apps);
		selectedId = appRows[0]?.id ?? -1;
	}

	function loadPreset(p: PresetDef) {
		preset = p.id;
		appRows = presetRows(p);
		selectedId = appRows[0]?.id ?? -1;
		playhead.stop();
	}
	const markCustom = () => {
		preset = 'custom';
		playhead.stop();
	};

	/**
	 * ⚓ A NEW APPLICATION IS A COPY OF THE SELECTED ONE (2026-10-02, ⚓ Nate).
	 * Both ways in — a click on bare band, the toolbar's ＋ — used to make Pyro
	 * 1U every time, so building a run of Hydro hits was add-then-retype, per
	 * hit. The selected application is the brush: its element and its size.
	 * Pyro 1U only when there is nothing to copy.
	 */
	const brush = (): Pick<Application, 'element' | 'gauge'> => ({
		element: selected?.element ?? 'pyro',
		gauge: selected?.gauge ?? 1
	});

	/** The ＋ in the toolbar — the keyboard's way in: a copy, 1s after the selected. */
	function addRow() {
		if (appRows.length >= MAX_APPS) return;
		const after = selected ?? appRows[appRows.length - 1];
		const row: AppRow = {
			id: nextAppId++,
			time: snapTime((after?.time ?? -1) + 1),
			...brush()
		};
		appRows.push(row);
		resort();
		// The new one is what you are about to edit — and its marker carries the
		// selection ring, which is the only thing saying WHERE on the chart it went.
		selectedId = row.id;
		markCustom();
	}

	export function reset() {
		loadPreset(PRESETS[0]);
	}

	// ── Share-link + handoff intake (workspace contract) ─────────────────────
	// One sanitizer serves both: share payloads carry [time, element, gauge]
	// tuples (the PresetDef form), handoffs carry Application objects.
	function sanitizeApps(raw: unknown): Application[] | null {
		if (!Array.isArray(raw) || raw.length === 0) return null;
		const out: Application[] = [];
		for (const item of raw.slice(0, MAX_APPS)) {
			let time: unknown, element: unknown, gauge: unknown;
			if (Array.isArray(item)) [time, element, gauge] = item;
			else if (typeof item === 'object' && item !== null)
				({ time, element, gauge } = item as Record<string, unknown>);
			else return null;
			if (typeof time !== 'number' || !Number.isFinite(time)) return null;
			if (!ELEMENTS.includes(element as ElementId)) return null;
			if (!(GAUGE_OPTIONS as readonly number[]).includes(gauge as number)) return null;
			out.push({
				time: Math.min(MAX_GAUGE_TIME, Math.max(0, Math.round((time as number) * 10) / 10)),
				element: element as ElementId,
				gauge: gauge as number
			});
		}
		return out;
	}

	export function getShareState() {
		return { v: 1, preset, apps: appRows.map((a) => [a.time, a.element, a.gauge]) };
	}

	export function applyShareState(state: unknown) {
		if (typeof state !== 'object' || state === null) return;
		const s = state as Record<string, unknown>;
		if (s.v !== 1) return;
		const apps = sanitizeApps(s.apps);
		if (!apps) return;
		setRows(apps);
		preset =
			typeof s.preset === 'string' && PRESETS.some((p) => p.id === s.preset) ? s.preset : 'custom';
		playhead.stop();
	}

	export function receiveHandoff(kind: string, payload: unknown) {
		if (kind !== 'applications') return;
		const apps = sanitizeApps(payload);
		if (!apps) return;
		setRows(apps);
		preset = 'custom';
		playhead.stop();
	}

	/** Remove by identity, then hand the selection to the neighbour that took its
	 *  place — so a run of deletes never has to be re-aimed, and the panel never
	 *  empties while applications remain. */
	function removeRow(id: number) {
		const i = appRows.findIndex((r) => r.id === id);
		if (i < 0) return;
		appRows.splice(i, 1);
		selectedId = (appRows[i] ?? appRows[i - 1])?.id ?? -1;
		markCustom();
	}

	/** Clamp to the axis and snap to the 0.1s the whole instrument quantises to. */
	const snapTime = (t: number) => Math.min(MAX_GAUGE_TIME, Math.max(0, Math.round(t * 10) / 10));

	/** ⚠ The ONE write path for an application's time, shared by the drag, the
	 *  stepper and the arrow keys: snap, then re-sort. ⛔ Don't set `row.time`
	 *  anywhere else, and ⚠ pass the row you read OUT of `appRows` — a plain
	 *  object you are about to push is not the reactive proxy the list stores, so
	 *  mutating it writes nothing anyone re-renders for. */
	function setTime(row: AppRow, t: number) {
		const next = snapTime(t);
		if (next === row.time) return;
		row.time = next;
		resort();
		markCustom();
	}
	function nudge(row: AppRow, seconds: number) {
		setTime(row, row.time + seconds);
	}

	const presetNote = $derived(PRESETS.find((p) => p.id === preset)?.note ?? null);

	const sim = $derived(simulateGauge(appRows));
	const lastAppTime = $derived(appRows.reduce((m, a) => Math.max(m, a.time), 0));

	// ── Geometry (pixel-true; width measured) ────────────────────────────────
	let graphW = $state(720);
	const PADL = 58;
	const PADR = 14;
	// The application marker band: reaction words at the top, then the element
	// pill, then the hairline down into the plot. ⚠ TOP must clear the pill —
	// three 10px label lines plus the pill's diameter is what sets it.
	const TOP = 64;
	const MARKER_PILL_CY = 50;
	const MARKER_PILL_R = 9;
	/** The plot's height at its least — it grows from here into the tile; the
	 *  marker band above it and the strips below keep their size. */
	const PLOT_MIN = 176;
	const AXIS_H = 24;
	const ROW_H = 18;
	let graphH = $state(0);
	const stripMods = $derived(MOD_ORDER.filter((mod) => sim.series.some((s) => s.key === mod)));
	// everything in the svg that is not the plot
	const chromeH = $derived(TOP + AXIS_H + stripMods.length * ROW_H + 6);
	const plotH = $derived(Math.max(PLOT_MIN, graphH - chromeH));
	const plotY1 = $derived(TOP + plotH);
	const stripY0 = $derived(plotY1 + AXIS_H);

	const liveDomain = $derived(
		Math.max(Math.ceil(Math.max(sim.duration + 0.4, lastAppTime + 2)), 8)
	);
	/**
	 * 🐛 THE AXIS FREEZES FOR THE LENGTH OF A DRAG, and it has to.
	 *
	 * `liveDomain` grows with the LAST application's time, and x is a fraction of
	 * the domain — so dragging the rightmost marker to the right pushes the axis
	 * out from under it and the pill crawls away from the cursor, slower the
	 * further you go. Pinning the domain at pointer-down makes the marker track
	 * the pointer exactly; the axis re-fits on release.
	 * ⚠ The consequence is real and intended: you cannot drag PAST the right edge
	 * of the axis you started with. Let go and the axis has grown — the edge is a
	 * thing you can see, which a rescaling one is not.
	 */
	let dragDomain = $state<number | null>(null);
	const domain = $derived(dragDomain ?? liveDomain);

	// ── Playback ─────────────────────────────────────────────────────────────
	const playhead = createPlayhead(() => domain);
	$effect(() => playhead.setActive(active));
	// The single time cursor: the playhead (playing, scrubbed, or parked)
	const displayT = $derived(
		playhead.playing || scrubbing || playhead.t > 0 ? Math.min(playhead.t, domain) : null
	);
	/**
	 * ⚓ HOVER READS (2026-10-02, ⚓ Nate). Pointing at the plot reads that moment
	 * into the Readout — reading used to need Play or a drag of the playhead.
	 * The pointer wins while it is over the plot; leaving hands the Readout back
	 * to the playhead (if one is parked) and then to the summary. ⚠ Not while
	 * playing (the playhead is the thing being watched) and not during a drag.
	 * A touch has no hover: a tap or drag there scrubs, as before.
	 */
	let hoverT = $state<number | null>(null);
	const readT = $derived(playhead.playing || scrubbing ? displayT : (hoverT ?? displayT));
	// ⚓ ONE CEILING, SHARED WITH THE PLANNER'S AURA LANE (2026-08-17). This was a
	// byte-identical copy of `auraUMax`, with nothing keeping the two in step —
	// and the duplication had already caused a real misreading, because the two
	// charts look like they scale differently when the difference is that this
	// one LABELS its unit axis. See auraDisplay for the floor's argument.
	const uMax = $derived(auraUMax(sim.series));
	const tickStep = $derived(domain <= 16 ? 1 : domain <= 32 ? 2 : 5);
	const ticks = $derived(
		Array.from({ length: Math.floor(domain / tickStep) + 1 }, (_, i) => i * tickStep)
	);
	const uTicks = $derived(Array.from({ length: Math.floor(uMax * 2) + 1 }, (_, i) => i / 2));

	const xOf = $derived((t: number) => PADL + (t / domain) * (graphW - PADL - PADR));
	const yOf = $derived((u: number) => plotY1 - (u / uMax) * (plotH - 10));

	const stripRows = $derived(
		stripMods.map((mod, i) => ({
			mod,
			meta: MOD_META[mod],
			y: stripY0 + i * ROW_H,
			intervals: sim.series
				.filter((s) => s.key === mod)
				.map(({ points }) => ({ t0: points[0].t, t1: points[points.length - 1].t }))
		}))
	);
	const svgH = $derived(stripY0 + stripRows.length * ROW_H + 6);

	const paths = $derived(
		sim.series
			.map(({ key, points }) => {
				const d = points
					.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.t).toFixed(1)},${yOf(p.u).toFixed(1)}`)
					.join(' ');
				// Area fill under each aura line — 'volume' of aura on the enemy.
				// The hidden fuel gauge stays a bare dashed line.
				const fillD =
					key === 'burningFuel'
						? null
						: `${d} L${xOf(points[points.length - 1].t).toFixed(1)},${plotY1} L${xOf(points[0].t).toFixed(1)},${plotY1} Z`;
				return { meta: MOD_META[key], d, fillD };
			})
			// ⚓ Bookkeeping series (the dashed fuel) paint LAST — see the same note
			// in auraPlot's computeAuraLane. MOD_ORDER groups a mod under the aura it
			// derives from, which puts burningFuel before dendro; during a burn the
			// two curves nearly coincide, so the solid one covered the dashed one.
			.sort((a, b) => (a.meta.dash ? 1 : 0) - (b.meta.dash ? 1 : 0))
	);

	const applyEvents = $derived(
		sim.events.filter((e): e is Extract<SimEvent, { kind: 'apply' }> => e.kind === 'apply')
	);
	/**
	 * The application disc's fill and its halo, for the chart pill AND the log
	 * pip — ⚓ they are the same object in the marker grammar, so a paint change
	 * to one is a paint change to both.
	 *
	 * ↻ ⚓ NATE 2026-08-17: white on a halo, on the `bar` rung, replacing dark ink
	 * on `main`. The planner's bars retired that idiom in 2026-08-11 and these
	 * were the last of it. `bar` is the rung the palette derives for "a fill with
	 * white written on it"; the halo is its dark shade at the timeline's own
	 * shiftHue(_, 0, −30).
	 */
	function pipPaint(element: string) {
		const pal = elementPalette(element);
		return { color: pal.bar, halo: shiftHue(pal.bar, 0, -30, 1) };
	}

	const markers = $derived(
		applyEvents.map((e) => {
			const names = sim.events
				.filter(
					(r): r is Extract<SimEvent, { kind: 'reaction' }> =>
						r.kind === 'reaction' && r.appIndex === e.appIndex
				)
				.map((r) => REACTION_NAME[r.reaction]);
			// ⚠ `appIndex` INDEXES `appRows` — that is the whole reason the list is
			// kept in time order (see AppRow). `simulateGauge` numbers its events by
			// position in its own time-sorted copy, so the two agree as long as both
			// sorts are stable and use the same comparator. ⛔ Never reach for
			// `appRows[i]` by a marker's position in THIS array instead; a dropped
			// past-the-cap application would silently shift everything after it.
			const row = appRows[e.appIndex] as AppRow | undefined;
			return {
				x: xOf(e.time),
				n: e.appIndex + 1,
				id: row?.id ?? -1,
				row,
				time: e.time,
				element: e.element,
				// ⚠ TWO RUNGS, ON PURPOSE. The HAIRLINE keeps `main` — it runs down
				// into the plot and has to be the same ink as the curve it points at.
				// The PILL takes `bar`, the rung that carries white (see pipPaint).
				color: `var(--el-${e.element}-main)`,
				pipColor: pipPaint(e.element).color,
				halo: pipPaint(e.element).halo,
				// ⛔ No "U" suffix — see the pill's note. The axis and the panel below
				// both say what the unit is; the disc only has room for the number.
				gauge: `${e.gauge}`,
				labels: names.length > 2 ? [...names.slice(0, 2), `+${names.length - 2} more`] : names
			};
		})
	);
	type Marker = (typeof markers)[number];

	/**
	 * ⚓ REACTION LABELS STAGGER RATHER THAN COLLIDE (⚓ NATE 2026-08-17).
	 *
	 * Two applications close in time put two centred names on top of each other —
	 * Crystallize's three geo hits were the case that showed it. Spacing that one
	 * demo out fixes that one demo; a reader building their own can always land
	 * two hits 0.3s apart, and the instrument exists to be edited.
	 *
	 * A greedy left-to-right pass: each marker takes the LOWEST tier whose last
	 * occupant it clears, so an isolated label stays at tier 0 (adjacent to its
	 * pill, where it belongs) and only a crowd climbs. ⛔ Not "alternate every
	 * other one" — that lifts labels which had nothing to avoid.
	 *
	 * ⚠️ Width is ESTIMATED from the character count rather than measured. The
	 * planner's lane measures because it decides whether to DROP a name and a
	 * wrong answer there loses information; here a wrong answer costs a tier of
	 * empty space, and the labels are a closed set of short reaction names. The
	 * estimate is deliberately generous.
	 */
	const LABEL_CHAR_PX = 5.6;
	const LABEL_TIER_PX = 11;
	const markerTiers = $derived.by(() => {
		const tierRight: number[] = [];
		return markers.map((m) => {
			if (m.labels.length === 0) return 0;
			const widest = m.labels.reduce((w, l) => Math.max(w, l.length), 0) * LABEL_CHAR_PX;
			const left = m.x - widest / 2;
			const right = m.x + widest / 2;
			let tier = 0;
			while (tierRight[tier] !== undefined && tierRight[tier] > left) tier++;
			tierRight[tier] = right;
			return tier;
		});
	});
	const cores = $derived(sim.events.filter((e) => e.kind === 'core'));

	// ── Event log (burning self-ticks hidden; EC drains collapsed into runs) ──
	type LogRow =
		| { kind: 'event'; event: SimEvent }
		| { kind: 'ecRun'; t0: number; t1: number; count: number };
	const logRows = $derived.by(() => {
		const rows: LogRow[] = [];
		for (const event of sim.events) {
			if (event.kind === 'burningTick') continue;
			if (event.kind === 'ecTick') {
				const last = rows[rows.length - 1];
				if (last?.kind === 'ecRun') {
					last.t1 = event.time;
					last.count += 1;
				} else {
					rows.push({ kind: 'ecRun', t0: event.time, t1: event.time, count: 1 });
				}
				continue;
			}
			rows.push({ kind: 'event', event });
		}
		return rows;
	});

	const fmtU = (u: number) => `${u.toFixed(2).replace(/\.?0+$/, '')}U`;
	const fmtT = (t: number) => `${t.toFixed(2)}s`;

	// ══ THE LOG'S VOICE (tightened 2026-08-17, ⚓ NATE: "a bit wordy") ═════════
	//
	// ⚓ A LOG LINE SAYS WHAT CHANGED, not what the mechanic is called. Every row
	// used to restate its own inputs — "Pyro 1U · applies 0.8U aura (×0.8 tax)"
	// repeats the element, the size AND a rule, when the pip beside it already
	// carries the size and the scenario note above already explains the tax.
	// Stripped to the outcome, the column becomes scannable, which is the only
	// thing a transcript is for.
	//
	// ⚠️ THE TEACHING DID NOT MOVE, it was already elsewhere: the ×0.8 tax is
	// stated in the Single Aura scenario note, the reaction multipliers ride the
	// reaction NAMES, and the unit is defined at the top of the Applications
	// panel. ⛔ Don't restore an explanation here that another surface owns —
	// three copies of one sentence is how they come to disagree.
	// ⛔ NO `→`. The first cut wrote "Pyro → 0.8U", which reads well and is on the
	// mark sweep's banned list (e2e/marks.spec.ts): an arrow is a CONTROL glyph
	// here, not prose, and the sweep caught it. ⚠ The exemption the icon-set note
	// grants `× · →` covers the help chapters' prose, which that spec skips by
	// selector — a readout panel is not prose. "aura" carries the same meaning in
	// a word the body face actually has.
	// ↻ 2026-10-02 (worksheet 03, ⚓ Nate): a line's qualifier rides in
	// PARENTHESES after the thing it qualifies, where a `·` used to glue
	// fragments together — a translator can see a phrase now. ⛔ Never two
	// parentheticals in a row.
	const elName = (el: ElementId) => ELEMENT_LABEL[el];
	function attachText(e: Extract<SimEvent, { kind: 'apply' }>): string {
		const el = elName(e.element);
		switch (e.attach) {
			case 'new':
				return `${el} (${fmtU(e.auraAfter)} after tax)`;
			// ⚠ "topped up TO", not "after tax": a top-up keeps the LARGER of the
			// standing aura and the new taxed gauge, so the number can be the old
			// aura, untouched by this hit.
			case 'topUp':
				return `${el} (topped up to ${fmtU(e.auraAfter)}, rate kept)`;
			case 'pyroRefresh':
				return `${el} (${fmtU(e.auraAfter)} after tax, refreshed, new rate)`;
			case 'tooWeak':
				return `${el} (too weak to attach)`;
			case 'none':
				return e.element === 'anemo' || e.element === 'geo'
					? `${el} (never attaches)`
					: `${el} (fully reacted)`;
		}
	}

	/** "Vaporize ×2: −2U Pyro, −1U Hydro trigger" — what the aura lost AND what the
	 *  trigger spent, because the two differ by the reaction's modifier, which is
	 *  the Vaporize / Reverse Melt lesson. */
	function reactionText(e: Extract<SimEvent, { kind: 'reaction' }>): string {
		const name =
			REACTION_NAME[e.reaction] +
			(e.of && (e.reaction === 'swirl' || e.reaction === 'crystallize')
				? ` (${MOD_META[e.of].label})`
				: '');
		if (e.reaction === 'crystallizeBlocked') return 'Crystallize (blocked by its 1s cooldown)';
		if (!e.consumed.length && (e.reaction === 'aggravate' || e.reaction === 'spread'))
			return `${name} (no gauge spent)`;
		const parts = e.consumed.map((c) => `−${fmtU(c.amount)} ${MOD_META[c.mod].label}`);
		if (e.spent > 0) {
			// ⚠ `appRows`, which `appIndex` addresses (see AppRow) — ⛔ not
			// `applyEvents`, whose positions shift with Burning's own re-applications.
			const trigger = e.appIndex === null ? null : appRows[e.appIndex]?.element;
			parts.push(`−${fmtU(e.spent)}${trigger ? ` ${elName(trigger)}` : ''} trigger`);
		}
		return parts.length ? `${name}: ${parts.join(', ')}` : name;
	}

	/**
	 * The transcript, in the shared row grammar (`$lib/components/EventLog`).
	 *
	 * ⚓ THE PIP CARRIES THE GAUGE, NOT THE ROW NUMBER (⚓ Nate) — see EventLog's
	 * header. It makes a log line and its marker on the chart the same object.
	 */
	const logRowsOut = $derived.by(() => {
		const rows: EventLogRow[] = [];
		for (const row of logRows) {
			if (row.kind === 'ecRun') {
				rows.push({
					time: row.t0,
					// ⚠ The START only, with the count in the text — the lane reached the
					// same answer for the same reason (`collapseReactionRuns`): a run's
					// extent is a chart's job, and a range in a time column is twice the
					// width of every other row's.
					// ⚠ "ticks", not a bare "Electro-Charged ×N". The reaction itself
					// already has its own row where it fired, so an unqualified repeat
					// reads as the reaction happening N more times rather than as the
					// drain it actually is. "from both" names what −0.4U comes off.
					text:
						row.count === 1
							? 'Electro-Charged tick (−0.4U from both)'
							: `${row.count} Electro-Charged ticks (−0.4U from both each tick)`,
					tone: 'quiet'
				});
				continue;
			}
			const e = row.event;
			if (e.kind === 'apply') {
				rows.push({
					time: e.time,
					pip: { text: `${e.gauge}`, ...pipPaint(e.element) },
					text: attachText(e),
					tone: 'lead'
				});
			} else if (e.kind === 'reaction') {
				rows.push({ text: reactionText(e), tone: 'sub' });
			} else if (e.kind === 'drained') {
				rows.push({ time: e.time, text: `${MOD_META[e.mod].label} gone`, tone: 'quiet' });
			} else if (e.kind === 'burningEnd') {
				const swept = e.swept.length
					? ` (${e.swept.map((m) => MOD_META[m].label).join(', ')} gone)`
					: '';
				rows.push({ time: e.time, text: `Burning ends${swept}`, tone: 'quiet' });
			} else if (e.kind === 'core') {
				// ⛔ The 🌱 that used to close this line went with the 🎲 in the crit
				// sampler: an emoji is drawn by whichever fallback face the engine
				// picks, in colour, at a weight nothing here chose.
				rows.push({ time: e.time, text: 'Dendro Core', tone: 'quiet' });
			}
		}
		return rows;
	});

	// ══ POINTER: THE BAND EDITS, THE PLOT SCRUBS ══════════════════════════════
	// One spatial rule, and it is the grammar's own: everything ABOVE the plot
	// (y < TOP) belongs to the APPLICATIONS — drag a pill to move it, click bare
	// band to add one there — and the plot and the strip below it belong to the
	// PLAYHEAD. ⚠ The band used to scrub too; losing it costs 64px of a ~280px
	// tall scrub target and buys direct manipulation of the thing the band is
	// made of.
	let svgEl = $state<SVGSVGElement | null>(null);

	/** Client x → seconds, in the FROZEN domain if a drag is in flight. */
	function timeAtX(clientX: number): number {
		if (!svgEl) return 0;
		const rect = svgEl.getBoundingClientRect();
		const x = clientX - rect.left;
		return Math.min(domain, Math.max(0, ((x - PADL) / (graphW - PADL - PADR)) * domain));
	}

	function onScrubDown(e: PointerEvent) {
		if (playhead.playing) return;
		scrubbing = true;
		playhead.seek(timeAtX(e.clientX));
		(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
	}
	function onScrubMove(e: PointerEvent) {
		if (scrubbing) playhead.seek(timeAtX(e.clientX));
		else if (e.pointerType === 'mouse' && dragId === null) hoverT = timeAtX(e.clientX);
	}
	const onPlotLeave = () => (hoverT = null);
	function onScrubUp(e: PointerEvent) {
		scrubbing = false;
		const el = e.currentTarget as SVGSVGElement;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
	}

	// ── Dragging an application along the band ────────────────────────────────
	let dragId = $state<number | null>(null);

	function onMarkerDown(e: PointerEvent, m: Marker) {
		// ⛔ The SVG's scrub handler must not also see this — a marker press would
		// otherwise fling the playhead to wherever you grabbed.
		e.stopPropagation();
		if (!m.row) return;
		selectedId = m.id;
		if (e.button !== 0) return;
		dragId = m.id;
		dragDomain = domain;
		playhead.stop();
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}
	function onMarkerMove(e: PointerEvent) {
		if (dragId === null) return;
		const row = appRows.find((r) => r.id === dragId);
		if (row) setTime(row, timeAtX(e.clientX));
	}
	function onMarkerUp(e: PointerEvent) {
		const el = e.currentTarget as Element;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
		dragId = null;
		dragDomain = null;
	}
	/** ⌨ The drag's equal, not its consolation: ← → nudge by the same 0.1s the
	 *  pointer snaps to, Shift by a second, and Delete removes. */
	function onMarkerKey(e: KeyboardEvent, m: Marker) {
		if (!m.row) return;
		const step = e.shiftKey ? 1 : 0.1;
		if (e.key === 'ArrowLeft') nudge(m.row, -step);
		else if (e.key === 'ArrowRight') nudge(m.row, step);
		else if (e.key === 'Delete' || e.key === 'Backspace') removeRow(m.id);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}

	/** Bare band → a copy of the selected application at that instant (see
	 *  `brush`). ⚠ Guarded on the cap so the click cannot silently do nothing. */
	/** Where a click on bare band would add, for the ghost marker that says so. */
	let bandT = $state<number | null>(null);
	function onBandMove(e: PointerEvent) {
		e.stopPropagation();
		hoverT = null;
		bandT = appRows.length < MAX_APPS && dragId === null ? snapTime(timeAtX(e.clientX)) : null;
	}

	function onBandDown(e: PointerEvent) {
		e.stopPropagation();
		if (appRows.length >= MAX_APPS || e.button !== 0) return;
		const row: AppRow = {
			id: nextAppId++,
			time: snapTime(timeAtX(e.clientX)),
			...brush()
		};
		appRows.push(row);
		resort();
		selectedId = row.id;
		markCustom();
	}
	const hoverGauges = $derived(
		readT === null
			? null
			: MOD_ORDER.flatMap((mod) => {
					const u = gaugesAt(sim.series, readT!)[mod];
					return u === undefined ? [] : [{ mod, meta: MOD_META[mod], u }];
				})
	);
</script>

<div class="instrument">
	<div class="gx-chart instrument-chart ctx-dark">
		<!-- ══ THE TOOLBAR (2026-10-02, ⚓ Nate) ════════════════════════════════════
		     The transport, then the SELECTED application's what — element, size,
		     the fine time step, remove — and ＋. It replaced the Applications
		     panel, which sat ~270px below the chart it edited, so every edit was a
		     scroll down and a scroll back up to see what it did. ⚓ The chart still
		     owns WHEN (drag a pill; click bare band to add a copy of the selected);
		     this row owns WHAT, directly over it. Wraps onto a second line in a
		     narrow tile rather than shrinking anything. -->
		<div class="panel gx-toolbar">
			<div class="gx-tb-group">
				<button
					class="btn btn--primary btn--icon gx-play"
					aria-pressed={playhead.playing}
					aria-label={playhead.playing ? 'Pause' : 'Play'}
					onclick={() => playhead.toggle()}
				>
					<!-- FILLED — see Mark's `filled` prop. An outlined triangle reads as
					     "insert" before it reads as "play"; the solid form is the idiom
					     every media transport on earth uses. -->
					<Mark name={playhead.playing ? 'pause' : 'play'} size={12} filled />
				</button>
				{#each PLAYHEAD_SPEEDS as sp (sp)}
					<button
						class="chip chip--control chip--sm"
						class:active={playhead.speed === sp}
						onclick={() => playhead.setSpeed(sp)}
					>
						{sp}×
					</button>
				{/each}
				<span class="gx-transport-time">{Math.min(playhead.t, domain).toFixed(1)}s / {domain}s</span
				>
			</div>

			<div class="gx-tb-group gx-tb-app">
				{#if selected}
					<div class="gx-elements" role="radiogroup" aria-label="Element">
						{#each ELEMENTS as e (e)}
							<button
								class="chip chip--icon gx-el"
								class:active={selected.element === e}
								style:--chip-color="var(--el-{e}-main)"
								role="radio"
								aria-checked={selected.element === e}
								aria-label={elName(e)}
								title={elName(e)}
								onclick={() => {
									selected.element = e;
									markCustom();
								}}
							>
								<img src={elementIcon(e)} alt="" width="16" height="16" />
							</button>
						{/each}
					</div>
					<div
						class="gx-gauges"
						role="radiogroup"
						aria-label="Gauge units"
						title="Gauge units (U): the strength of an elemental application. Most hits are 1U."
					>
						{#each GAUGE_OPTIONS as g (g)}
							<button
								class="chip chip--control chip--sm"
								class:active={selected.gauge === g}
								role="radio"
								aria-checked={selected.gauge === g}
								onclick={() => {
									selected.gauge = g;
									markCustom();
								}}
							>
								{g}U
							</button>
						{/each}
					</div>
				{/if}
				<!-- The MARKER group: when, remove, and add — one group, so the
				     toolbar has four (see .gx-toolbar). -->
				<div class="gx-tb-marker">
					{#if selected}
						<!-- ⚠ THE STEPPER IS THE FINE TIME CONTROL, not a second one: a
						     drag lands within a tenth, these land ON it — and a touch has
						     no arrow keys. -->
						<div class="gx-stepper">
							<button
								class="btn btn--sm btn--icon"
								aria-label="Move earlier"
								title="Move earlier — hold Shift for 1s"
								disabled={selected.time <= 0}
								onclick={(e) => nudge(selected, e.shiftKey ? -1 : -0.1)}
							>
								<Mark name="back" />
							</button>
							<span class="gx-time-value">{selected.time.toFixed(1)}s</span>
							<button
								class="btn btn--sm btn--icon"
								aria-label="Move later"
								title="Move later — hold Shift for 1s"
								disabled={selected.time >= MAX_GAUGE_TIME}
								onclick={(e) => nudge(selected, e.shiftKey ? 1 : 0.1)}
							>
								<Mark name="forward" />
							</button>
						</div>
						<button
							class="btn btn--sm btn--icon"
							aria-label="Remove this application"
							title="Remove this application"
							onclick={() => removeRow(selected.id)}
						>
							<Mark name="delete" />
						</button>
					{/if}
					<!-- ⚠ DISABLED AT THE CAP rather than hidden, with the limit in its
				     tooltip — a control that vanishes reads as having moved. -->
					<button
						class="btn btn--sm gx-add"
						aria-label="Add application"
						title={appRows.length >= MAX_APPS
							? `${MAX_APPS} applications is the most`
							: 'Add a copy of the selected application'}
						disabled={appRows.length >= MAX_APPS}
						onclick={addRow}
					>
						<Mark name="plus" />
						<span class="gx-add-word">Add</span>
					</button>
				</div>
			</div>
		</div>
		<div
			class="gx-graph instrument-graph"
			style:--graph-min="{PLOT_MIN + chromeH}px"
			bind:clientWidth={graphW}
			bind:clientHeight={graphH}
		>
			<svg
				bind:this={svgEl}
				width={graphW}
				height={svgH}
				role="img"
				aria-label="Elemental gauge decay timeline"
				onpointerdown={onScrubDown}
				onpointermove={onScrubMove}
				onpointerup={onScrubUp}
				onpointercancel={onScrubUp}
				onpointerleave={onPlotLeave}
				style:cursor={playhead.playing ? 'default' : 'ew-resize'}
			>
				<!-- Time grid -->
				{#each ticks as s (s)}
					<line x1={xOf(s)} y1={TOP} x2={xOf(s)} y2={plotY1} stroke="var(--chart-grid)" />
					<text
						x={xOf(s)}
						y={plotY1 + 14}
						fill="var(--chart-ink)"
						font-size="10"
						text-anchor="middle"
					>
						{s}s
					</text>
				{/each}

				<!-- Gauge grid -->
				{#each uTicks as u (u)}
					<line
						x1={PADL}
						y1={yOf(u)}
						x2={graphW - PADR}
						y2={yOf(u)}
						stroke={u % 1 === 0 ? 'var(--chart-rule)' : 'var(--chart-grid)'}
					/>
					{#if u % 1 === 0}
						<text
							x={PADL - 7}
							y={yOf(u) + 3.5}
							fill="var(--chart-ink)"
							font-size="10"
							text-anchor="end"
						>
							{u}U
						</text>
					{/if}
				{/each}

				<!-- Application markers -->
				<!-- ══ THE APPLICATION MARKER (unified 2026-08-17, ⚓ NATE) ═══════════
				     One grammar, read top to bottom, shared with the planner's aura
				     lane: what it CAUSED, then what LANDED, then a hairline down into
				     the gauge it changed.

				     ⚓ REACTIONS SIT ABOVE THE PILL, not below it. They used to hang
				     under the gauge value, which put the CONSEQUENCE further from the
				     plot than the cause and read bottom-up. Above-to-below is now
				     effect → application → the aura it acted on, in both tools.

				     ⚓ THE PILL CARRIES THE UNIT, not the application's index. The
				     index numbered nothing a reader could see — the applications
				     editor below does not number its rows — while the unit is the one
				     datum the whole instrument is about. -->
				<!-- ⚓ THE BAND IS THE APPLICATIONS' GROUND (2026-08-17). Bare band
				     adds one at that instant; a pill is dragged along it. It sits
				     BEFORE the markers so every pill's own hit area wins the press,
				     and it stops propagation so the SVG's scrub never sees either. -->
				<rect
					class="gx-add-zone"
					class:gx-add-zone--full={appRows.length >= MAX_APPS}
					x={PADL}
					y="0"
					width={Math.max(0, graphW - PADL - PADR)}
					height={TOP}
					fill="transparent"
					onpointerdown={onBandDown}
					onpointermove={onBandMove}
					onpointerleave={() => (bandT = null)}
					role="presentation"
				/>

				<!-- The GHOST: where a click on bare band would add, wearing the
				     selected application's element and size — the band's whole
				     instruction, said by showing rather than by a paragraph. -->
				{#if bandT !== null}
					{@const b = brush()}
					<g class="gx-ghost" aria-hidden="true">
						<text
							class="gx-word"
							x={xOf(bandT)}
							y={MARKER_PILL_CY - MARKER_PILL_R - 6}
							fill="var(--chart-ink)"
							font-size="10"
							text-anchor="middle"
						>
							Click to add
						</text>
						<circle
							cx={xOf(bandT)}
							cy={MARKER_PILL_CY}
							r={MARKER_PILL_R}
							fill={pipPaint(b.element).color}
							fill-opacity="0.45"
						/>
						<text
							class="gx-pill-num"
							x={xOf(bandT)}
							y={MARKER_PILL_CY + 3.5}
							font-size="10"
							font-weight="600"
							text-anchor="middle"
						>
							{b.gauge}
						</text>
					</g>
				{/if}

				<!-- ⚠ KEYED BY `m.id`, NOT BY POSITION OR BY `m.n`. Dragging one
				     application past another re-sorts the list, which reorders this
				     array — with a positional key Svelte would recycle nodes between
				     two markers and the POINTER CAPTURE would go with the node rather
				     than with the application under the finger. -->
				{#each markers as m, mi (m.id)}
					<line
						x1={m.x}
						y1={MARKER_PILL_CY + MARKER_PILL_R}
						x2={m.x}
						y2={plotY1}
						stroke={m.color}
						stroke-opacity="0.28"
					/>
					<!-- ⚠ The stack grows UPWARD from just above the pill, rather than
					     downward from a fixed top. One reaction is the common case, and
					     anchoring to the top left it floating ~38px clear of the mark it
					     belongs to; anchoring to the pill keeps cause and effect adjacent
					     whether there are one or three. -->
					{#each m.labels as label, li (li)}
						<text
							class="gx-word"
							x={m.x}
							y={MARKER_PILL_CY -
								MARKER_PILL_R -
								6 -
								(m.labels.length - 1 - li) * LABEL_TIER_PX -
								markerTiers[mi] * LABEL_TIER_PX}
							fill="var(--chart-ink)"
							font-size="10"
							text-anchor="middle"
						>
							{label}
						</text>
					{/each}
					<!-- ══ THE PILL IS THE TIME CONTROL ══════════════════════════════
					     ⚓ It replaced a 0–15s slider sitting in a list far below the
					     axis it addressed. The group carries the whole interaction so
					     the ring, the disc and the invisible hit target move as one
					     object, and it is a real focus stop — ⌨ arrows nudge, Delete
					     removes, so the keyboard path is the drag's equal rather than
					     its consolation.
					     ⚠ THE HIT AREA IS BIGGER THAN THE DISC (r+6). At 9px the disc
					     is a comfortable READ and a poor TARGET, and markers can land a
					     few px apart. -->
					<g
						class="gx-marker"
						class:gx-marker--held={dragId === m.id}
						role="button"
						tabindex="0"
						aria-label="{elName(m.element)} {m.gauge}U at {m.time.toFixed(1)} seconds"
						onpointerdown={(e) => onMarkerDown(e, m)}
						onpointermove={onMarkerMove}
						onpointerup={onMarkerUp}
						onpointercancel={onMarkerUp}
						onfocus={() => (selectedId = m.id)}
						onkeydown={(e) => onMarkerKey(e, m)}
					>
						{#if m.id === selectedId}
							<!-- GOLD for selected — the site's rule, and the only thing
							     that says which application the panel below is editing. -->
							<circle
								cx={m.x}
								cy={MARKER_PILL_CY}
								r={MARKER_PILL_R + 3}
								fill="none"
								stroke="var(--accent)"
								stroke-width="1.5"
							/>
						{/if}
						<circle cx={m.x} cy={MARKER_PILL_CY} r={MARKER_PILL_R} fill={m.pipColor} />
						<!-- ⚠ THE NUMBER ONLY, and set CONDENSED (2026-08-17). "1.5U" bled
						     out of the disc on both sides at the regular face; the U was the
						     part paying rent it did not earn, because the y axis is labelled
						     in U and the panel below opens by defining the unit. Condensed
						     buys the rest of the headroom — ⚠ it is a STATIC 400/600 face
						     (the weight ladder folds there), so 700 resolves to 600 and that
						     is fine at this size.
						     ⚠ INSIDE THE GROUP since the pill became draggable, and inert to
						     the pointer: as a sibling it painted on top of the hit target, so
						     a press landing on the digit fell through to the SVG and flung
						     the playhead instead of grabbing the marker.
						     ↻ ⚓ NATE 2026-08-17: WHITE ON A HALO, matching the log's pip and
						     the planner's bars — the disc took `bar` and the digit takes the
						     chart's own two-shadow recipe. ⚠ `text-shadow` on SVG text, which
						     is a CSS property SVG2 applies to <text>; the alternative
						     (`paint-order: stroke fill`) draws a HARD outline and would not
						     match the soft halo everywhere else on the site. -->
						<text
							class="gx-pill-num"
							x={m.x}
							y={MARKER_PILL_CY + 3.5}
							style:--label-halo={m.halo}
							font-size="10"
							font-weight="600"
							text-anchor="middle"
						>
							{m.gauge}
						</text>
						<!-- The target, painted last so nothing sits over it. -->
						<circle
							cx={m.x}
							cy={MARKER_PILL_CY}
							r={MARKER_PILL_R + 6}
							fill="transparent"
							role="presentation"
						/>
					</g>
				{/each}

				<!-- Aura volume fills (gradient fades to transparent at the baseline,
				     so coexisting auras like EC/Freeze overlap without turning to mud) -->
				<defs>
					{#each paths as p, pi (pi)}
						{#if p.fillD}
							<linearGradient id="gx-fill-{pi}" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color={p.meta.color} stop-opacity="0.26" />
								<stop offset="100%" stop-color={p.meta.color} stop-opacity="0" />
							</linearGradient>
						{/if}
					{/each}
				</defs>
				{#each paths as p, pi (pi)}
					{#if p.fillD}
						<path d={p.fillD} fill="url(#gx-fill-{pi})" />
					{/if}
				{/each}

				<!-- Gauge lines -->
				{#each paths as p, pi (pi)}
					<path
						d={p.d}
						fill="none"
						stroke={p.meta.color}
						stroke-width="2"
						stroke-dasharray={p.meta.dash ?? 'none'}
						stroke-linejoin="round"
						stroke-linecap={p.meta.dash ? 'butt' : 'round'}
					/>
				{/each}

				<!-- Dendro cores -->
				{#each cores as c, ci (ci)}
					<circle cx={xOf(c.time)} cy={plotY1 - 5} r="4" fill="var(--rx-dendro-core)" />
					<circle
						cx={xOf(c.time)}
						cy={plotY1 - 5}
						r="7"
						fill="var(--el-dendro-main)"
						fill-opacity="0.25"
					/>
				{/each}

				<!-- Aura presence strip ("what icon hangs over the enemy") -->
				{#each stripRows as row (row.mod)}
					<image href={elementIcon(row.meta.icon)} x="2" y={row.y + 2} width="12" height="12" />
					<text class="gx-word" x={17} y={row.y + 11.5} fill={row.meta.color} font-size="10">
						{row.meta.label}
					</text>
					{#each row.intervals as span, si (si)}
						<rect
							x={xOf(span.t0)}
							y={row.y + 3}
							width={Math.max(2, xOf(span.t1) - xOf(span.t0))}
							height="10"
							rx="2"
							fill={row.meta.color}
							fill-opacity="0.32"
						/>
					{/each}
				{/each}

				<!-- The hover cursor: the moment the Readout is reading, fainter than the
				     playhead because nothing is parked there. -->
				{#if hoverT !== null && readT === hoverT}
					<line
						x1={xOf(hoverT)}
						y1={TOP}
						x2={xOf(hoverT)}
						y2={stripY0 + stripRows.length * ROW_H}
						stroke="var(--chart-ink)"
						stroke-opacity="0.45"
						stroke-dasharray="3 3"
						pointer-events="none"
					/>
				{/if}

				<!-- Playhead: the one time cursor — drag it while paused -->
				{#if displayT !== null}
					<line
						x1={xOf(displayT)}
						y1={TOP}
						x2={xOf(displayT)}
						y2={stripY0 + stripRows.length * ROW_H}
						stroke="var(--chart-ink)"
						stroke-width="1.5"
					/>
				{/if}
			</svg>
		</div>
	</div>

	<div class="panel gx-scenarios instrument-controls">
		<p class="kicker">Example scenarios</p>
		<div class="chips gx-chips-dense">
			{#each PRESETS as p (p.id)}
				<button
					class="chip chip--control gx-preset-chip"
					class:active={preset === p.id}
					onclick={() => loadPreset(p)}
				>
					<span class="gx-chip-els" aria-hidden="true">
						{#each presetElements(p) as e (e)}
							<img src={elementIcon(e)} alt="" width="14" height="14" />
						{/each}
					</span>
					{p.label}
				</button>
			{/each}
		</div>
		<p class="note">
			<Emphasis text={presetNote ?? 'Custom sequence — edit applications or pick a scenario.'} />
		</p>
	</div>

	<!-- ⚓ ONE PAPER CARD PER INSTRUMENT (2026-08-13). This was two panels —
	     Enemy Status and Event Log — and the Gauge is the case that showed why
	     the rule has to be a rule: they say ONE thing at two speeds (what is
	     true at the playhead, and how it got there), and as two sheets of the
	     brightest material on the page they competed to be the answer. One
	     card, the state on top, the transcript under a quiet label. -->
	<div class="panel panel--paper gx-readout instrument-readout">
		<p class="kicker">Readout</p>
		{#if hoverGauges}
			<p class="note">at {fmtT(readT!)}</p>
			{#if hoverGauges.length === 0}
				<p class="gx-meta">No aura — the next element applies fresh.</p>
			{:else}
				{#each hoverGauges as h (h.mod)}
					<p class="gx-meta gx-status-row">
						<img src={elementIcon(h.meta.icon)} alt="" width="14" height="14" />
						<span>{h.meta.label}</span>
						<span class="gx-strong">{fmtU(h.u)}</span>
					</p>
				{/each}
			{/if}
		{:else}
			<p class="note">
				Point at the chart or press play to read the enemy’s aura state at a moment in time.
			</p>
			{#each stripRows as row (row.mod)}
				<p class="gx-meta gx-status-row">
					<img src={elementIcon(row.meta.icon)} alt="" width="14" height="14" />
					<span>{row.meta.label}</span>
					<span class="gx-strong">
						{row.intervals.map((s) => `${s.t0.toFixed(1)}–${s.t1.toFixed(1)}s`).join(', ')}
					</span>
				</p>
			{/each}
		{/if}

		<!-- ⚓ THE ROW GRAMMAR IS SHARED WITH THE PLANNER'S SIDE COLUMN
		     (2026-08-17) — see $lib/components/EventLog. Only the row BUILDING
		     is local, because only this tool can see `crystallizeBlocked`, a
		     reverse multiplier or a per-reaction consumption; the IR has
		     collapsed all three by the time the planner reads it. -->
		<p class="gx-sub">Aura log</p>
		<div class="gx-log">
			<EventLog rows={logRowsOut} empty="Nothing lands on the target." />
		</div>
	</div>
</div>

<style>
	/* ⚓ NO FRAME — the chart draws on the night (`.frame`'s retirement note in
	   app.css has the argument). The ground, the radius and the inset padding all
	   left together; what remains is a layout box.
	   ⚠ .ctx-dark stays CLAIMED and is doing real work: at TOOL_DIM the crest IS a
	   dark ground, and --frame-bg has to keep resolving somewhere for the --chart-*
	   stops that mix against it. Unpainted reference, not a leftover. (.gx-chart
	   is otherwise only the layout's chart slot — see app.css .instrument.) */
	.gx-graph svg {
		display: block;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	/* The layout is app.css's .instrument; this column is wider than the
	   others'. 🎛️ 25rem: the widest application line the log can print — "Pyro
	   (3.2U after tax, refreshed, new rate)", 257px — fits on one line beside
	   its time and pip (measured 2026-10-02; ⚓ Nate: the lines that start with
	   a marker should not wrap). Reactions may still. */
	.instrument {
		--instrument-side: minmax(18rem, 25rem);
	}

	/* ── The toolbar ─────────────────────────────────────────────────────────── */

	/* ══ FOUR GROUPS, EVEN GAPS (2026-10-02, ⚓ Nate) ════════════════════════════
	   Playback (+ time) · elements · gauge sizes · the marker's time, remove and
	   add. ONE ROW when they fit, spaced evenly across it; otherwise playback
	   keeps its own line and the three marker groups take the next, spaced
	   evenly across THAT.
	   ⚠ The switch is a measured width, not wherever flex-wrap breaks — a free
	   wrap would put the elements up on the playback line. 🎛️ 55rem: the groups
	   measured 248 + 195 + 153 + 202 = 798px, plus the plate's 22px of padding
	   and three gaps of at least 1.25rem (2026-10-02). Re-measure if a group
	   gains a control.
	   ⚠ The TOOLBAR is the container, not the tile: in the wide layout it shares
	   the tile's width with the Readout column, so the tile's width says
	   nothing about whether four groups fit here. */
	.gx-toolbar {
		container: gx-toolbar / inline-size;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem 1.25rem;
		padding: 0.5rem 0.7rem;
		margin-bottom: 0.5rem;
	}

	.gx-tb-group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.6rem;
		min-width: 0;
	}

	/* Narrow: the marker groups are a line of their own, spaced evenly. */
	.gx-tb-app {
		flex: 1 1 100%;
		justify-content: space-between;
		row-gap: 0.6rem;
		column-gap: 1.25rem;
	}

	/* Wide: the wrapper dissolves and its three groups join playback as four
	   items of one evenly spaced row. */
	@container gx-toolbar (min-width: 55rem) {
		.gx-tb-app {
			display: contents;
		}
	}

	/* Below `compact` the Add plate keeps its MARK and drops its WORD — the
	   site's narrow rule for band controls ($lib/breakpoints.ts: 40rem). Its
	   aria-label still names it. */
	@media (max-width: 40rem) {
		.gx-add-word {
			display: none;
		}
	}

	.gx-tb-marker {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.gx-stepper {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.gx-transport-time {
		margin-left: 0.3rem;
		font-family: var(--font-body);
		font-size: var(--fs-md);
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	/* Chart text: Mono for numbers (ticks, gauge tags), Condensed for word
	   labels (aura names, reaction names) so they fit their gutters at 10px */
	.gx-graph text {
		font-family: var(--font-body);
	}

	.gx-graph text.gx-word {
		font-family: var(--font-condensed);
	}

	/* The gauge digit inside the application pill. ⚠ FULL-opacity #fff over the
	   halo — alpha-reduced white lets the shadow bleed through the glyphs, which
	   is the rule the timeline's halo block states and the reason nothing dimmed
	   there carries one. */
	.gx-graph text.gx-pill-num {
		fill: #fff;
		font-family: var(--font-condensed);
		text-shadow:
			color-mix(in srgb, var(--label-halo, #081225) 25%, transparent) 0px 1px 2px,
			color-mix(in srgb, var(--label-halo, #081225) 50%, transparent) 0px 0px 6px;
		pointer-events: none;
	}

	/* ── The marker band's two affordances ──────────────────────────────────── */

	/* ⚠ THE CURSOR IS THE WHOLE ANNOUNCEMENT for both of these. Nothing is
	   painted to say "this strip adds" or "this pill drags" — the band already
	   carries reaction names, pills and hairlines, and a dashed outline or a
	   hover plate under all of that would compete with the chart it annotates.
	   `copy` and `grab` are the platform's own words for exactly these two acts,
	   and the panel's note says them once in prose for anyone who never hovers. */
	.gx-add-zone {
		cursor: copy;
	}
	/* At the cap the strip still swallows the press (so it cannot fall through
	   and fling the playhead) but stops claiming it will do something. */
	.gx-add-zone--full {
		cursor: default;
	}

	.gx-marker {
		cursor: grab;
	}
	.gx-marker--held {
		cursor: grabbing;
	}
	/* 🐛 THE UA RING HAS TO BE TURNED OFF BY HAND HERE. Everywhere else on the
	   site the focusable things are `.btn` / `.chip` / `.field`, which the global
	   reset already covers; a focusable SVG `<g>` is not any of those, so Chrome
	   drew its own `outline: auto 5px` in ITS blue on `:focus` — which fired
	   after every mouse DRAG, since dragging focuses the group. Measured:
	   `:focus-visible` correctly did NOT match, so this was never our rule
	   misfiring. ⛔ Don't "fix" that by dropping the tabindex — the marker is the
	   only way to reach an application from the keyboard. */
	.gx-marker:focus {
		outline: none;
	}
	/* A real focus stop needs a real focus ring. ⚠ `outline` on an SVG group is
	   drawn around its bounding box, which here is the hit circle — deliberately
	   the largest child, so the ring frames the target rather than the disc. */
	.gx-marker:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	/* Condensed trial: the 12-chip scenario row is the densest chip cluster */
	.gx-chips-dense :global(.chip) {
		font-family: var(--font-condensed);
	}

	.gx-preset-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	/* Overlapping element badges inside a scenario chip */
	.gx-chip-els {
		display: inline-flex;
	}

	.gx-chip-els img {
		width: 14px;
		height: 14px;
	}

	.gx-chip-els img + img {
		margin-left: -5px;
	}

	/* ── Panels ─────────────────────────────────────────────────────────────── */

	/* ── Chips ──────────────────────────────────────────────────────────────── */

	/* ⛔ The application INSPECTOR panel RETIRED (2026-10-02) — its element row,
	   size row and time stepper live in the toolbar over the chart now (see the
	   markup). `.gx-elements` / `.gx-gauges` / `.gx-time-value` came with them. */

	.gx-elements {
		display: flex;
		gap: 0.35rem;
	}

	.gx-gauges {
		display: flex;
		gap: 0.3rem;
	}

	/* .btn--primary .btn--icon, but round: a transport control, not a chip. */
	/* ↻ 2026-08-13: the ▶/⏸ inside became <Mark>s, which retires the type
	   metrics this button used to be balanced against — a glyph sat on the
	   baseline with its own side bearings, so the round plate needed no help to
	   look centred. An SVG is a box, so it does: `display: grid` + `place-items`
	   centres the mark's BOX, and the mark's own viewBox is symmetric, so its
	   ink lands centred too. (The retired-glyph hazard is the reverse case — an
	   optical nudge left behind after a swap; there was none here to leave.) */
	.gx-play {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--r-round);
	}

	/* 🎛️ Exactly as wide as the widest time it can show — "15.0s", measured IN
	   PLACE at 41.6px (2.6em at this size), since MAX_GAUGE_TIME is 15 — so the
	   arrows sit snug and never move as you step, and a shorter time centres.
	   🐛 The first cut set this and never applied: a later `.gx-value` rule at
	   the same specificity won with `min-width: 3.2em; text-align: right` (⚓
	   Nate found it in the inspector). That class had no other user once the
	   inspector panel retired, so its font moved here and it is gone. */
	.gx-time-value {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		font-size: var(--fs-xl);
		min-width: 2.6em;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	/* The ghost on the marker band: what a click there would add. Paint-only
	   alpha (§ Laws), and never a hit target — the band underneath takes the
	   press. */
	.gx-ghost {
		pointer-events: none;
	}

	/* ── Readout / log ──────────────────────────────────────────────────────── */

	.gx-meta {
		margin: 0;
		font-size: var(--fs-xl);
		line-height: 1.5rem;
		color: var(--muted);
	}

	/* ↻ 2026-10-02: the element NAME is in ink, the icon carries the colour.
	   The name used to wear the element's own colour, and on parchment Frozen's
	   and Cryo's pale ice all but vanished. */
	.gx-status-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.gx-status-row img {
		display: block;
	}

	.gx-strong {
		font-family: var(--font-body);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}

	/* The transcript's label inside the merged readout card. ⚠ DELIBERATELY NOT A
	   .kicker: a kicker is gold, and gold names a BLOCK — a second one in one card
	   would say "second panel" exactly where the merge was trying to stop saying
	   it. This is the LABEL voice (the slider-label rung) with a hairline over it,
	   which is the section-divider weight, not the rule weight. */
	.gx-sub {
		margin: 0.5rem 0 0;
		padding-top: 0.6rem;
		border-top: 1px solid var(--line-faint);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--muted);
	}

	/* ⛔ `.gx-log-apply` / `-n` / `-reaction` / `-tick` and `.gx-dim` RETIRED
	   (2026-08-17): the row grammar moved to the shared <EventLog>, so what is
	   left here is the BOX that holds it — the height cap this panel wants, which
	   is the one thing the shared component deliberately does not decide (the
	   planner hands it a whole column instead). */
	.gx-log {
		display: grid;
		min-height: 0;
		max-height: 21rem;
		overflow: hidden;
		padding-right: 0.3rem;
		/* ⚠⚠ THE ANCHOR ON PAPER IS --muted, NOT --text. `.ctx-light` inverts the
		   ink ladder — measured here, --text is #495366 and --muted #3b4255 — so
		   handing EventLog its dark-context default would draw every application
		   FAINTER than the reaction hanging under it. See that component's note;
		   it takes one ink and derives the rest, precisely so this is a single
		   declaration rather than three overrides. */
		--el-ink: var(--muted);
	}

	/* ══ WIDE: THE READOUT IS A COLUMN (2026-10-02, ⚓ Nate) ════════════════════
	   The Readout runs down the right edge at the tile's full height, where the
	   aura log — the panel's long part — gets the height a log wants and
	   scrolls inside it rather than being cut off at 21rem. */
	@container instrument (min-width: 60rem) {
		/* The note keeps a reading measure while the chips use the width */
		.gx-scenarios .note {
			max-width: 70ch;
		}

		.gx-readout {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		/* ⚠ align-content: start — a grid given spare height shares it out
		   between its rows, which spaced the log's lines a column apart. */
		.gx-log {
			flex: 1 1 auto;
			align-content: start;
			max-height: none;
			overflow-y: auto;
		}
	}
</style>
