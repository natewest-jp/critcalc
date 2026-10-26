<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { parseNotation, type ParsedRotation } from '$lib/utils/notationParser';
	import type { Stat } from '$lib/types/ability';
	import type { NotationEditor } from '$lib/utils/notationEditor';
	import { emptySeating, type Seating } from '$lib/utils/notationEdit';
	import RotationCoverage from './RotationCoverage.svelte';
	import { getCharacterIndexEntry, getIndexEntryByDisplayName } from '$lib/data/characterLookup';
	import { getLoadedCharacter } from '$lib/data/characterData';
	import { getAvatar } from '$lib/utils/getAvatar';
	import { constellations, ownership, siteSettings, loadout, type LoadoutEntry } from '$lib/stores';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import type { CharacterTrack } from '$lib/utils/notationParser';
	import { artifactImagePath, getArtifactSetById } from '$lib/data/artifactLookup';
	import { GENERIC_ARTIFACT_ICON, weaponTypeIcon } from '$lib/utils/loadoutIcons';
	import { rotationTabs } from '$lib/rotationTabs.svelte';
	import { resolveEntry } from '$lib/storage/teamLoadout';
	import { nextLayout } from '$lib/nextLayout';
	import { weaponImagePath } from '$lib/data/weaponLookup';
	import BuffTooltip, { type TooltipEffectRow } from '$lib/components/BuffTooltip.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { scrollFade } from '$lib/actions/scrollFade';
	import { benchBand, BENCH_SLOT_MIN_H } from '$lib/benchBand.svelte';
	import { below, narrowForm } from '$lib/media.svelte';
	import { page } from '$app/state';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { documentBar } from '$lib/documentBar.svelte';
	import { notices } from '$lib/notices.svelte';
	import type { Outcome } from '$lib/controlAnswer.svelte';
	import {
		barKey,
		plannerView as pv,
		castKey,
		type BarLane,
		type InspectedBar,
		type InspectedCast
	} from '$lib/plannerView.svelte';
	import { flagNotation } from '$lib/utils/notationFlags';
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { scrollBehavior } from '$lib/motion';
	import { notationTints } from '$lib/timeline/notationTints';
	import { tokenizeNotation } from '$lib/utils/tokenizer';
	import { BUFF_STAT_ICON } from '$lib/timeline/buffStatMaps';
	import {
		elementPalette,
		shiftHue,
		castFill,
		desaturate,
		tickInk,
		type ElementPalette
	} from '$lib/utils/elementColors';
	import { UPTIME_DIM_MIX, GHOST_FILL_MIX, GHOST_CHROMA_KEEP } from '$lib/timeline/barMix';
	import {
		xForTime as projectX,
		barGeom as projectBar,
		rulerTicks
	} from '$lib/timeline/barGeometry';
	import { FPS, swapFramesForPing } from '$lib/utils/frames';
	import type { HumanTiming } from '$lib/sim/humanTiming';
	import type { InputBlock } from '$lib/sim/types';
	import type {
		BarStep,
		CharReceivedBuffBar,
		MergedEffectDisplay,
		SlottedTrack
	} from '$lib/timeline/types';
	import { stepAt, stepCeiling, stepDensity } from '$lib/timeline/barSteps';
	import { projectTeamBuffRows } from '$lib/timeline/teamBuffRows';
	import { projectCharReceivedBuffRows } from '$lib/timeline/charReceivedBuffRows';
	import { computeWeaponProcRows } from '$lib/timeline/weaponProcRows';
	import { computeSummonSubrows, findCastSummons } from '$lib/timeline/summonSubrows';
	import { decayDensities, rampDensities } from '$lib/timeline/buffEnvelope';
	import { ABSORB_FADE_PX, LUNAR_GLEAM_STOPS, summonMarks } from '$lib/timeline/summonMarks';
	const LUNAR_GLEAM_BG = `linear-gradient(90deg, ${LUNAR_GLEAM_STOPS.map(([at, c]) => `${c} ${at * 100}%`).join(', ')})`;
	import { computeShieldSubrows } from '$lib/timeline/shieldRows';
	import {
		computeGadgetRows,
		type GadgetBar,
		type GadgetRun,
		type GadgetSpawn
	} from '$lib/timeline/gadgetRows';
	import {
		auraPathD,
		auraSpanLabels,
		auraSpanPoints,
		auraUnitLines,
		auraMarkerLabels,
		auraMarkerRows,
		auraReactionsAt,
		computeAuraLane,
		EMPTY_AURA_LANE,
		type AuraMarker
	} from '$lib/timeline/auraPlot';
	import { buildAuraLog } from '$lib/timeline/auraLog';
	import { AURA_MOD_META, AURA_MOD_ORDER } from '$lib/utils/auraDisplay';
	import { gaugesAt } from '$lib/utils/gauge';
	import { barPhases } from '$lib/timeline/barPhases';
	import { computeMoonsignRows } from '$lib/timeline/moonsignRows';
	import { computeNBBars } from '$lib/timeline/nbRows';
	import { isCurated } from '$lib/utils/characterLint';
	import {
		renderTimelinePng,
		deliverPng,
		type TimelineSnapshot,
		type ExportBenchCard,
		type ExportBar
	} from '$lib/utils/timelineExport';
	import type { TimelineBar } from '$lib/utils/notationParser';
	import { toKqmNotation } from '$lib/utils/kqmExport';
	import { playback } from '$lib/playback/playback.svelte';
	import { cuesFor } from '$lib/playback/cues';
	import { REPEAT_LAPS, repeatNotation } from '$lib/playback/repeat';

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------

	let {
		characterSlots = ['blank', 'blank', 'blank', 'blank'],
		notation = $bindable(''),
		seating = $bindable<Seating>(emptySeating()),
		tabLoadout = {} as Record<string, LoadoutEntry>,
		tabCon = {} as Record<string, number>,
		tabId = '',
		underChart
	}: {
		characterSlots?: string[];
		notation?: string;
		/** ⚓ The party's slots and their flags (§8.1), round-tripped through the
		 *  editor so its history can restore them: ⌘Z after a newcomer took a
		 *  resting seat gives the seat back. */
		seating?: Seating;
		/** Which document `notation` is — the planner's active tab. The editor
		 *  keeps one undo history per id (see `showDocument`). */
		tabId?: string;
		tabLoadout?: Record<string, LoadoutEntry>;
		/** Per-tab constellation overrides (Layer 2). Shadows the roster's global
		 *  `constellations` field-by-field, exactly like tabLoadout shadows loadout.
		 *  The slot cards themselves live in the layout-level bench band now —
		 *  these props feed the parser's effective-con and the PNG export. */
		tabCon?: Record<string, number>;
		/** Rendered BETWEEN the chart and the composer — the always-on bonuses
		 *  strip. ⚓ Nate 2026-08-11 moved it here from the page's bottom edge:
		 *  "sandwiched right in-between the buff bars / nightsoul / moonsign and
		 *  the notation box." It reads as part of the instrument now rather than
		 *  a footnote after it, which is what it always was — an always-on buff
		 *  is the BASELINE the timeline's temporary bars sit on top of, so it
		 *  belongs beside the lanes that show them.
		 *  ⚠ A SNIPPET, NOT AN IMPORT, deliberately: the block needs the page's
		 *  `slots` and the timeline only needs to decide WHERE it goes. It is the
		 *  last snippet prop standing — `sourceOverlay` used the same contract to
		 *  hand in the character Source, which the Source retirement removed. */
		underChart?: import('svelte').Snippet;
	} = $props();

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------
	// Zoom and the notes panel are VIEW controls and live in band B now (toolbar
	// round, 2026-08-07) — the shared module is where the band and this chart
	// meet. Aliased locally because the geometry below reads `scale` dozens of
	// times and `pv.scale` at every site would bury it.
	const scale = $derived(pv.scale);

	// ══ THE LAYERS (2026-08-17) ═══════════════════════════════════════════════
	// What the chart draws BESIDE ability timings. Both are band-B toggles that
	// persist in siteSettings (see the note on `showAuraLane` there for why
	// these persist when zoom does not).
	//
	// ⚓ THE CUT IS: a bar that says when an ability IS stays; a bar that says
	// what an ability GRANTS goes. So E/Q pills and their ghost tails, the
	// active row, input blocks, cast markers and swap connectors are never
	// hidden — and neither are SUMMONS or SHIELDS (⚓ Nate 2026-08-17: a shield
	// is a MECHANIC, not a buff. It is a thing standing in the world with a
	// duration, read the way a summon's field is read, and it shares that lane).
	// What goes: received buff rows, weapon-proc rows, the team-buff lane, the
	// Nightsoul-burst lane and the Ascendant Gleam lane.
	//
	// ⚠ GATED AT THE PROJECTION, NOT AT THE MARKUP, and that is the whole trick:
	// every height, the shared aux reserve, the bench's published slot metrics
	// and the PNG snapshot are all computed FROM these arrays, so an empty array
	// collapses the rows, shrinks the slot blocks and shortens the bench cards
	// with no second code path to keep in step. ⛔ Don't add `{#if showBuffs}`
	// around the rows and leave the projections running — that is the version
	// where the layout keeps paying for what it no longer draws.
	let showBuffs = $derived($siteSettings.showTimelineBuffs);
	let showAura = $derived($siteSettings.showAuraLane);

	// Swap ping (network latency, ms) lives in site settings (chrome ⚙ overlay);
	// the timeline converts it to swap-delay frames for the parser through the
	// ONE conversion in `$lib/utils/frames` (KQM's measured ping + 90 ms — ⛔ not
	// gcsim's `ping × 0.12`, which this line carried until 2026-09-14).
	let swapFrames = $derived(swapFramesForPing($siteSettings.swapPing));

	// Human timing (2026-09-14): the band B plate turns the three Settings
	// values into the ONE object the parse takes (`$lib/sim/humanTiming.ts`).
	// The mode is a three-way choice, so a lit plate always does something.
	let humanTiming = $derived.by((): HumanTiming | null => {
		if (!$siteSettings.humanTiming) return null;
		const mode = $siteSettings.humanTimingMode;
		return {
			padFrames: mode === 'animations' ? 0 : $siteSettings.humanTimingPadFrames,
			fullAnimations: mode !== 'padding'
		};
	});

	// ---------------------------------------------------------------------------
	// Layout constants (px)
	// ---------------------------------------------------------------------------

	/** The chart frame's horizontal padding — JS-side because .rp-frame reads it
	 *  back as --rp-frame-pad-x and the dock's inset is measured against it. */
	const FRAME_PAD_X = 14;
	const RULER_H = 28;
	// ══ 🎛️ THE VERTICAL BUDGET (⚓ NATE 2026-08-11, rounds one and two) ═════════
	// The chart sat too low once bands A and B took their shape above it, and on
	// a 16:10 screen the fourth slot was near the fold. It began at 158px:
	//
	//     pad 10 + E 20 + gap 4 + Q 20 + gap 4 + ACTIVE 40 + gap 4 + aux 46 + pad 10
	//
	// and lands at 124 with the reserve full, ~96 on a typical rotation once the
	// reserve adapts (see slotBuffRowsReserved). Every row is still there.
	//
	// ⚠ THE GAP BETWEEN BARS IS `STRIDE − ROW`, AND THAT IS THE WHOLE STORY.
	// Round one slimmed the painted bar to 6px inside a 12px row and pushed
	// consecutive bars 8px apart — ⚓ Nate: "there's no point making them
	// narrower if we can't also collapse the space between them. The minimal gap
	// that we have between bars is by design, because otherwise they look more
	// 'noisy' with more space between them." He is right, and the arithmetic is
	// blunt: a bar that does not fill its row spends the row's leftover as
	// whitespace. The bar fills its row again, so the gap is the 2px of stride
	// and nothing else. ⛔ Don't reintroduce a slim bar inside a taller row —
	// whatever it buys in daintiness it spends twice over in emptiness.
	const CHAR_PAD_TOP = 8;
	// ↻ 20 → 14 (round two). ⚓ Nate: "when they're at a similar size, it's hard
	// to tell who you should pay attention to first. The active row needs to
	// take priority because it is the actual source of truth about what flow of
	// inputs is going through." Round one had cut ACTIVE 40 → 28, which left
	// these at 20 and the ratio at 1.4:1 — too close to rank. Restoring 2:1 by
	// taking the DURATION rows down rather than the input row back up is the
	// version that pays for itself: E/Q say how long something lasts, the active
	// row says what is happening.
	const E_ROW_H = 14;
	const Q_ROW_H = 14;
	// ↻ 40 → 28 (round one). It was "exactly 2× E/Q", which is hierarchy
	// expressed as arithmetic — but the row carries a SINGLE LINE of --fs-sm text
	// (.rp-input-block is a one-line flex row; nothing in it wraps), so 40px was
	// 3.6× leading.
	//
	// ↻ 28 → 30 (⚓ NATE 2026-08-11), and the extra 2px is a CORRECTION, not
	// generosity. He caught that the two rows are not measured the same way:
	// .rp-bar-uptime is `top: 0; height: 100%`, so an E/Q row PAINTS its full
	// height, while .rp-active-bg and .rp-input-block are `top: 1px;
	// height: calc(100% - 2px)` — so a 28px active row painted only 26. The 2:1
	// we thought we had restored was really 26:14. At 30 the painted heights are
	// 28:14 and the ratio is true.
	// ⚠ THE 1px INSET IS LOAD-BEARING, so don't "fix" this the other way by
	// removing it: connectorGeom aligns swap connectors to the inset bar's
	// edges (yTop + 1, yBottom − 1) and would need to move with it.
	const ACTIVE_ROW_H = 30;
	// The row AND its bar — they are the same number again (see the gap note).
	// 12 holds --fs-xs with a px of air each side, which is the floor for text.
	const CHAR_BUFF_ROW_H = 12;
	const CHAR_PAD_BOTTOM = 8;
	// ══ 🎛️ THE GAP LADDER (⚓ NATE 2026-08-11) ════════════════════════════════
	// One ROW_GAP of 4 used to serve every seam in the slot. Nate's spec splits
	// it in two, and the split says something the single value could not:
	//
	//     E bar ───────┐
	//        2px       │  the ABILITY BLOCK — E, its summons and Q are one
	//     Summon ──────┤  object, so their seams are the tightest in the slot
	//        2px       │
	//     Q bar ───────┘
	//        3px          ← the active row stands apart from what surrounds it
	//     ACTIVE ROW
	//        3px
	//     Buff bar ────┐
	//        2px       │  the buff stack, already at its own 2px stride
	//     Buff bar ────┘
	//
	// So gap encodes GROUPING: 2px means "same object", 3px means "next to".
	// (Nate wrote the block top-down as Q → summon → E; the DOM runs E → summon
	// → Q. The gaps are symmetric about the summon lane, so the spec is the same
	// either way round.)
	const ABILITY_ROW_GAP = 2;
	const ACTIVE_ROW_GAP = 3;
	// 2px visual gap between consecutive buff subrows
	const CHAR_BUFF_ROW_STRIDE = CHAR_BUFF_ROW_H + 2; // = 14

	// Summon lane (between E and Q, conditional on summons[].length > 0)
	// ⚠ SUMMON_ROW_H IS NOT FREE — it is pinned by the invariant below.
	const SUMMON_ROW_H = 12;
	const SUMMON_ROW_STRIDE = SUMMON_ROW_H + 2; // = 14
	// Gap above and below the summon lane, chosen so adding a summon costs
	// exactly one CHAR_BUFF_ROW_STRIDE — `gap + SUMMON_ROW_H + gap −
	// ABILITY_ROW_GAP(the no-summon E↔Q seam) = CHAR_BUFF_ROW_STRIDE` — which is
	// the same amount the buff reservation gives back when one of its rows is
	// replaced by a summon. Net slot-height delta: zero.
	// ⚠ IT MOVED WITH THE GAP LADDER AND THE INVARIANT STILL SOLVES: the seam it
	// subtracts went 4 → 2, so this went 3 → 2 to match. 2 + 12 + 2 − 2 = 14 ✓
	// (and it is the same 2px as the rest of the ability block, which is why the
	// number Nate asked for and the number the invariant needs are the same one.)
	const SUMMON_LANE_GAP = 2;

	// ══ THE AUX RESERVE, ADAPTIVE (⚓ NATE 2026-08-11, round two) ══════════════
	// Summon sub-rows above the Q row and received-buff sub-rows below the active
	// row draw on one shared budget. This was a FLOOR of 3 applied to each slot
	// INDEPENDENTLY, and it was wrong in both directions at once: a character who
	// receives nothing still paid for three empty rows, and because each slot
	// took its own max, slots ended up DIFFERENT heights anyway — so the floor
	// bought neither density nor uniformity, which are the only two things a
	// reservation can buy.
	//
	// It reserves the MAXIMUM ACTUAL across the four slots now. Slots come out
	// uniform (they did not before), a rotation with no received buffs pays
	// nothing, and the layout still never jumps when one slot gains a row —
	// which was the floor's real job. The old constant is kept as a CEILING-FREE
	// minimum of 0: there is no floor any more.
	// ⚠ This is why the budget note above quotes two slot heights. The 124 is the
	// worst case, not the common one.
	const MIN_RESERVED_AUX_ROWS = 0;

	// Below-timeline lanes (team buffs, NB, Moonsign) — shared bar + 2px padding
	// each side; multi-row lanes grow with row count. ↻ 14 → 12 with the char
	// buff rows: these lanes carry the same bar grammar, and a lane bar taller
	// than the identical bar inside a slot would read as a different class of
	// thing. The CSS subrows read AUX_LANE_BAR_H back as --rp-aux-bar-h rather
	// than repeating the literal, which is how the two used to drift.
	const AUX_LANE_BAR_H = 12;
	const AUX_LANE_PAD_Y = 2;
	const AUX_LANE_BAR_STRIDE = AUX_LANE_BAR_H + 2; // = 14
	function auxLaneH(rowCount: number): number {
		const rows = Math.max(1, rowCount);
		return rows * AUX_LANE_BAR_STRIDE - 2 + AUX_LANE_PAD_Y * 2;
	}

	// ---------------------------------------------------------------------------
	// Element color palette — values live in `src/app.css` as `--el-*-*`.
	// We mirror them in JS for inline-style construction below.
	// ---------------------------------------------------------------------------

	function pal(element: string | undefined): ElementPalette {
		return elementPalette(element);
	}

	// Blank (the generic placeholder) has no element, so its bars would fall to
	// the flat `none` gray — a touch flatter than the active-row tint. Give it the
	// active-row hue (--rp-active) so its E/Q pills carry the same slight
	// saturation as the rows around them.
	// Literal, not var(--neutral): these values also feed the PNG export path,
	// and canvas can't resolve custom properties. Mirrors --neutral (app.css).
	// ⚠ `bar` is the SAME value here, deliberately. Blank is a neutral standing in
	// for "no element", and the bar rung's derivation spends freed gamut on
	// chroma — on a gray that would invent a hue it does not have. Same reasoning
	// as physical/none in elementColors.ts.
	const BLANK_PAL: ElementPalette = {
		main: '#768093',
		bar: '#768093',
		border: '#768093',
		hi: '#768093'
	};

	// castFill (the cast-pill / summon vertical top-light) now lives in
	// $lib/utils/elementColors so the PNG export shares the exact finish (the
	// Team Builder's Compare bars did too, until 2026-10-13). Its Safari-revert
	// history travelled with it.

	/** One gradient stop for the time-scaling buff envelope (Yelan Q, Mavuika Q
	 *  — a buff whose value ramps or decays over its own window).
	 *
	 *  ↻ 2026-08-11: the bars became GLASS, and that changes what a stop IS.
	 *  This used to mix the opaque fill toward --rp-chart-bg, on the
	 *  alpha-compositing law's "a fill on a KNOWN ground mixes opaquely against
	 *  it". Two things broke that: the chart has no painted ground any more, and
	 *  — the sharp one — mixing a translucent colour toward an OPAQUE one raises
	 *  its alpha as the mix fraction falls, so the old formula would have made a
	 *  fading buff MORE solid. Backwards, and silently so.
	 *
	 *  Mixing toward `transparent` is the correct operation for a material:
	 *  color-mix premultiplies, so this scales --glass-bar's alpha and leaves its
	 *  rgb alone. A ramping buff now genuinely thins as material, which is what
	 *  "the buff is weaker here" should look like on glass.
	 *  ⚠ One level of mix — --glass-bar is a literal, so the nesting law holds. */
	function buffStop(density: number): string {
		return `color-mix(in srgb, var(--glass-bar) ${(density * 100).toFixed(1)}%, transparent)`;
	}

	// The ramp / decay envelope as a CSS gradient — the densities come from
	// `$lib/timeline/buffEnvelope.ts`, shared with the PNG export.
	function rampingBackground(bar: CharReceivedBuffBar): string | undefined {
		const d = rampDensities(bar);
		return d && `linear-gradient(to right, ${buffStop(d[0])}, ${buffStop(d[1])})`;
	}
	function decayingBackground(bar: CharReceivedBuffBar): string | undefined {
		const d = decayDensities(bar);
		return d && `linear-gradient(to right, ${buffStop(d[0])}, ${buffStop(d[1])})`;
	}

	/**
	 * ⚓ A STEPPED BAR (stepped stacks round, 2026-09-27) — a `whileStacks` buff
	 * whose count moved under it, drawn in the ramp envelope's grammar (thinner
	 * glass = weaker) with HARD stops, because the count moves in whole stacks.
	 * ⚓ Nate's pick of three (Columbina-style overlap and seamed segments were
	 * the others): one bar per buff, the density IS the count, the tooltip reads
	 * the step under the pointer. One gradient, one layer (the Safari veto on
	 * tiled multi-layer bar backgrounds holds).
	 */
	function steppedBackground(bar: {
		start: number;
		end: number;
		steps?: BarStep[];
		stepMax?: number;
	}): string | undefined {
		const steps = bar.steps;
		const span = bar.end - bar.start;
		if (!steps?.length || !(span > 0)) return undefined;
		const ceiling = stepCeiling(steps, bar.stepMax);
		const stops = steps.map((st) => {
			const a = (((st.start - bar.start) / span) * 100).toFixed(3);
			const b = (((st.end - bar.start) / span) * 100).toFixed(3);
			return `${buffStop(stepDensity(st.count, ceiling))} ${a}% ${b}%`;
		});
		return `linear-gradient(to right, ${stops.join(', ')})`;
	}

	/** A stepped bar's tooltip is the STEP under the pointer — anchored to the
	 *  cursor, because the bar's centre is one moment among several. */
	function showStepTooltip(
		e: MouseEvent,
		bar: { start: number; end: number; steps?: BarStep[] },
		label: string
	) {
		if (!bar.steps?.length) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const frame =
			bar.start + ((e.clientX - rect.left) / Math.max(1, rect.width)) * (bar.end - bar.start);
		const st = stepAt(bar.steps, frame);
		showTooltip(
			e,
			{ sourceLabel: `${label} ×${st.count}`, effects: st.effects, isMutuallyExclusive: false },
			true
		);
	}

	// ---------------------------------------------------------------------------
	// Derived: character data per slot
	// ---------------------------------------------------------------------------

	let slotCharacters = $derived(characterSlots.map((id) => getLoadedCharacter(id)));

	// ---------------------------------------------------------------------------
	// Derived: rotation (filtered to only characters present in slots)
	// ---------------------------------------------------------------------------

	// Parser character resolver: displayName → index entry → loaded payload.
	// Reading the lazy-load cache here makes the parse $derived re-run when a
	// payload lands; a still-loading character degrades to an unknown token
	// for the beat until it resolves (the parser is null-tolerant by design).
	function resolveCharacter(name: string) {
		const entry = getIndexEntryByDisplayName(name);
		return entry ? getLoadedCharacter(entry.id) : null;
	}

	// Portrait-column display name: travelers read as just "Traveler" — the
	// element glyph beside the name carries the variant. NOTATION stays
	// element-qualified ("Anemo Traveler") so typed rotations can address a
	// specific variant; only this label diverges. (Cryo landed 2026-08-31.)
	function slotLabel(char: { id: string; displayName: string }): string {
		return char.id.startsWith('traveler') ? 'Traveler' : char.displayName;
	}

	/** Character id → the name a reader sees, for the aura log and the marker
	 *  tooltip. ⚠ Falls back to the ID rather than an em dash: in a LOG an
	 *  unresolved name still has to be attributable to something. */
	function displayNameOf(id: string): string {
		const char = getLoadedCharacter(id);
		return char ? slotLabel(char) : id;
	}

	function parse(text: string): ParsedRotation {
		try {
			return parseNotation(
				text,
				resolveCharacter,
				swapFrames,
				effectiveCon,
				effectiveLoadout,
				// Slot roster (post-P4 #5 arc): NB derivation + team-scoped buff
				// context read the SLOTS, which can hold members never typed in
				// the notation.
				slotCharacters,
				humanTiming
			);
		} catch (e) {
			console.error('parseNotation threw:', e);
			return {
				tracks: [],
				totalDuration: 0,
				unknownTokens: [],
				events: [],
				windows: [],
				applications: [],
				auraSeries: []
			} satisfies ParsedRotation;
		}
	}

	// ══ THE DOCUMENT AND THE STREAM (playback round B, 2026-09-29) ═════════════
	//
	// `docRotation` is the notation as written — what the editor's tints and band
	// B's Total read. `rotation` is what the chart DRAWS: the document, or, with
	// Repeat lit, the document joined to itself by a swap `REPEAT_LAPS` times and
	// simulated as ONE run (`$lib/playback/repeat.ts`). Every projection below
	// reads `rotation`, so the laps that follow are drawn by the same code as the
	// first and the sim's own waits, carries and auras come through untouched.
	// ⚠ The stream is a second parse and is computed only while armed — Repeat
	// off costs nothing over today. ⛔ Never the editor's text: the lint and the
	// tints take the document, and `src` ranges past its length are nobody's.
	let docRotation = $derived.by(() => parse(notation));
	let rotation = $derived.by(() =>
		pv.repeat ? parse(repeatNotation(notation, REPEAT_LAPS)) : docRotation
	);

	// Where each lap after the first begins, in seconds, for the ruler's lap
	// marks. ⚓ One track per segment (run.ts creates the track at the turn's
	// head and skips only an unknown name — which the copies skip identically),
	// so a lap is a fixed STRIDE of the document's track count. The first lap
	// gets no mark: the ruler's own zero is that.
	let lapStarts = $derived.by(() => {
		if (!pv.repeat) return [] as { lap: number; t: number }[];
		const stride = docRotation.tracks.length;
		if (stride === 0) return [];
		const out: { lap: number; t: number }[] = [];
		for (let k = 1; k * stride < rotation.tracks.length; k++) {
			out.push({ lap: k + 1, t: rotation.tracks[k * stride].activeStart / FPS });
		}
		return out;
	});

	// ---------------------------------------------------------------------------
	// Track → slot mapping
	// Distributes multiple tracks for the same characterId across matching slots
	// in round-robin order (handles the all-blank case cleanly).
	// ---------------------------------------------------------------------------

	function mapTracksToSlots(tracks: CharacterTrack[], slots: string[]): SlottedTrack[] {
		const slotUsage: Record<string, number> = {};
		const result: SlottedTrack[] = [];
		for (const track of tracks) {
			const matching = slots
				.map((id, idx) => (id === track.characterId ? idx : -1))
				.filter((idx) => idx >= 0);
			// ↻ 2026-08-13 (single truth): this `continue` is where a parsed track
			// with no slot used to vanish — no lane, no message. It survives, but it
			// is no longer silent and no longer common: the slots ARE the notation's
			// first four characters, so the only track that can land here is a FIFTH
			// one, and notationFlags squiggles that name in the composer with "no
			// slot — a team holds four". ⚓ Nate 2026-08-13 chose flagging over
			// growing a fifth lane: the bench holds four, and a chart that disagreed
			// with it would be a worse lie than the drop.
			if (matching.length === 0) continue;
			const usage = slotUsage[track.characterId] ?? 0;
			const slotIdx = matching[usage % matching.length];
			slotUsage[track.characterId] = usage + 1;
			result.push({ ...track, slotIdx });
		}
		return result;
	}

	let teamComp = $derived(deriveTeamComposition(slotCharacters.map((c) => c ?? undefined)));

	// ---------------------------------------------------------------------------
	// NB (Nightsoul Burst) lane projection
	// ---------------------------------------------------------------------------

	// NB fire events are PARSER-derived since post-P4 #5 phase 3 (the parser
	// receives slotCharacters and emits `nightsoulBurst` events); this is a
	// pure filter of the event stream.
	let nbBars = $derived(showBuffs ? computeNBBars(rotation.events) : []);

	// The layer under the tab's own: its team's loadout under the switch, the
	// roster default off it (rotationTabs.inheritedLoadout).
	let inheritedLoadout = $derived(rotationTabs.inheritedLoadout($loadout));
	let effectiveLoadout = $derived.by(() => {
		const allIds = new Set([...Object.keys(inheritedLoadout), ...Object.keys(tabLoadout)]);
		const result: Record<string, LoadoutEntry> = {};
		for (const charId of allIds) {
			result[charId] = resolveEntry(inheritedLoadout[charId], tabLoadout[charId]);
		}
		return result;
	});

	// Effective constellation per character: the tab's Layer-2 override wins over
	// the roster's Layer-1 default, mirroring effectiveLoadout. A `?? ` keeps an
	// explicit C0 override (0) distinct from "no override" (absent). Fed to the
	// parser, summon lane, PNG export, portrait chip, and popover.
	let effectiveCon = $derived.by(() => {
		const result: Record<string, number> = { ...$constellations };
		for (const [id, level] of Object.entries(tabCon)) result[id] = level;
		return result;
	});

	// Post-P4 #5 phase 5: the team faction/element-count context, cast/reaction
	// event partitioning, and every buff derivation moved PARSER-side (the
	// parser receives slotCharacters via parseNotation and builds the same
	// maps internally) — the renderer-side copies of those deriveds are gone.

	// Post-P4 #5 phase 5: the buff MEANING is parser-derived (`buff` windows
	// in rotation.windows — the parser receives slotCharacters, constellations,
	// and the loadout); these projections only group + format.
	let teamBuffRows = $derived(
		showBuffs ? projectTeamBuffRows(rotation.windows, getLoadedCharacter) : []
	);

	let weaponProcRows = $derived(
		showBuffs ? computeWeaponProcRows(rotation.windows, effectiveLoadout) : []
	);

	// Per-character received buff bars (TTDS, Widsith, active-target slices,
	// self buffs) — projection of the parser's buff windows.
	let charReceivedBuffRows = $derived(
		showBuffs ? projectCharReceivedBuffRows(rotation.windows, getLoadedCharacter) : []
	);

	// Total stacked subrow count per slot: weapon proc ICD rows + received buff subrows.
	// Used to compute dynamic character block heights for vertical stacking.
	let slotReceivedSubrowCounts = $derived(
		characterSlots.map((charId) => {
			if (!charId) return 0;
			const procCount = weaponProcRows.filter((r) => r.characterId === charId).length;
			const buffCount = charReceivedBuffRows.filter((r) => r.characterId === charId).length;
			return procCount + buffCount;
		})
	);

	// Summon lane data — see src/lib/timeline/summonSubrows.ts; thin reactive
	// wrapper only (lane geometry stays below).
	//
	// ↻ 2026-08-14 — SHIELDS RIDE THIS LANE. A shield is a labelled span with no
	// tick markers, i.e. a summon sub-row minus its ticks, and for nine
	// characters it was ALREADY drawn here (as a stand-in `summons[]` entry —
	// "Curtain of Slumber", "Jade Shield"). Appending the shield rows to this
	// one array rather than building a lane of their own means the height math
	// below, the character-block layout and the PNG export snapshot all pick
	// them up unchanged — and it puts every shield in the place readers already
	// find them.
	//
	// 🐛 ⚓ NATE 2026-08-14: shields were simply APPENDED, which broke the lane's
	// one ordering rule. The lane sits between the E row and the Q row, and its
	// sub-rows are walked eBars-then-qBars so an E-spawned row lands next to the
	// E bar and a Q-spawned one next to the Q bar — "each closest to its
	// emitter". Concatenating put every shield below every summon regardless, so
	// Thoma's Q field (Scorching Ooyoroi) always sat above his E shield (Blazing
	// Barrier) whichever he cast first. The merge below restores the rule.
	let summonSubrows = $derived.by(() => {
		const summons = computeSummonSubrows(
			annotatedTracks,
			rotation.windows,
			effectiveCon,
			getLoadedCharacter
		);
		// A linear scan, not a lookup map: characterId ↔ slotIdx is a bijection
		// over the tracks (see computeSummonSubrows' TRAP note), the array is a
		// handful of entries, and a `new Map` inside a $derived trips the
		// prefer-svelte-reactivity lint for a value that is never reactive.
		const shields = computeShieldSubrows(
			rotation.windows,
			(id) => annotatedTracks.find((t) => t.characterId === id)?.slotIdx
		);
		// Skill-sourced rows above burst-sourced ones, which is the walk order
		// computeSummonSubrows already produces for summons — so this is a NO-OP
		// on a summon-only lane and only decides where the shields land. A row's
		// first bar is the signal: its bars are walk-ordered too, so bars[0] is
		// the E cast whenever the row has one (Fischl's shared E/Q Oz row sorts
		// with E, as it always has).
		// ⚠ Sort, not partition — `Array.prototype.sort` is stable, so summons
		// and shields keep their own internal order within each group.
		const rank = (r: { bars: { source: 'skill' | 'burst' }[] }) =>
			r.bars[0]?.source === 'burst' ? 1 : 0;
		return [...summons, ...shields].sort((a, b) => rank(a) - rank(b));
	});

	let slotSummonLaneHeights = $derived(
		characterSlots.map((_charId, slotIdx) => {
			const count = summonSubrows.filter((r) => r.slotIdx === slotIdx).length;
			return count > 0 ? count * SUMMON_ROW_STRIDE - 2 : 0;
		})
	);

	// ---------------------------------------------------------------------------
	// Per-slot vertical layout (offsets depend on summon-lane presence)
	// ---------------------------------------------------------------------------

	function summonLaneTop(): number {
		// Only called when a summon lane is rendered, so use the tighter gap.
		return CHAR_PAD_TOP + E_ROW_H + SUMMON_LANE_GAP;
	}

	function qRowTopForSlot(slotIdx: number): number {
		const summonH = slotSummonLaneHeights[slotIdx];
		if (summonH === 0) {
			// E ↔ Q direct: the ability block's own seam.
			return CHAR_PAD_TOP + E_ROW_H + ABILITY_ROW_GAP;
		}
		// E ↔ summon ↔ Q — the same seam either side of the lane.
		return CHAR_PAD_TOP + E_ROW_H + SUMMON_LANE_GAP + summonH + SUMMON_LANE_GAP;
	}

	// The two seams that set the active row apart from what surrounds it — see
	// the gap ladder at ACTIVE_ROW_GAP. Deliberately the SAME constant on both
	// sides: the row is one object standing clear, not a thing pushed downward.
	function activeRowOffsetForSlot(slotIdx: number): number {
		return qRowTopForSlot(slotIdx) + Q_ROW_H + ACTIVE_ROW_GAP;
	}

	function buffRowsTopForSlot(slotIdx: number): number {
		return activeRowOffsetForSlot(slotIdx) + ACTIVE_ROW_H + ACTIVE_ROW_GAP;
	}

	/** Aux rows actually used by one slot — summon sub-rows (between E and Q) plus
	 *  received-buff sub-rows (below the active row), which draw on one budget. */
	function slotAuxRowsUsed(slotIdx: number): number {
		return (
			summonSubrows.filter((r) => r.slotIdx === slotIdx).length +
			(slotReceivedSubrowCounts[slotIdx] ?? 0)
		);
	}

	/** The reservation every slot takes: the BUSIEST slot's actual usage. See the
	 *  aux-reserve note at MIN_RESERVED_AUX_ROWS for why this replaced a fixed
	 *  per-slot floor of 3. Uniform across slots by construction — that is half
	 *  the point — so it takes no slotIdx. */
	let auxRowsReserved = $derived(
		Math.max(MIN_RESERVED_AUX_ROWS, ...[0, 1, 2, 3].map(slotAuxRowsUsed))
	);

	// Reserved rows go to SUMMONS first (they sit in their own lane between E and
	// Q); what is left is the slot's buff-row allowance. A slot with fewer
	// summons than the busiest one therefore gets the difference back as buff
	// rows, which is what keeps every slot the same height.
	function slotBuffRowsReserved(slotIdx: number): number {
		const summonCount = summonSubrows.filter((r) => r.slotIdx === slotIdx).length;
		return Math.max(0, auxRowsReserved - summonCount);
	}

	// Block height intentionally excludes LOADOUT_ROWS_H — the loadout panel
	// in the label column lives within the cell's existing real estate, so the
	// track column doesn't carry a parallel dead band underneath.
	// ⚠ FLOORED BY THE BENCH CARD, which labels this slot and cannot be shorter
	// than its own portrait (BENCH_SLOT_MIN_H = 86). The disc is capped rather
	// than floored on its own side, so without this nothing would catch a slot
	// too short to hold it and it would SPILL — that bug shipped once.
	// ↻ 2026-08-12 (the bench-card round): the floor was 126 and the card was
	// genuinely the binding constraint; the card is a ROW now and 86 sits under
	// what a busy slot asks for (122) and 4px over a sparse one (82). So this is
	// back to being a guard rather than a governor — it binds on empty and
	// near-empty rotations only. Any slack lands BELOW the last aux row (every
	// row is positioned from the slot's top), where it is least noticeable.
	function slotNaturalH(slotIdx: number): number {
		const buffRows = slotBuffRowsReserved(slotIdx);
		const buffH = buffRows > 0 ? buffRows * CHAR_BUFF_ROW_STRIDE - 2 : 0;
		return buffRowsTopForSlot(slotIdx) + buffH + CHAR_PAD_BOTTOM;
	}

	// 🐛 ONE HEIGHT FOR ALL FOUR SLOTS, and this is the aux reserve's own stated
	// property finally being TRUE rather than nearly true (2026-08-17).
	//
	// The reserve hands every slot the same NUMBER OF ROWS and splits it between
	// the summon lane and the buff stack — but each of those two areas drops its
	// TRAILING 2px gap when it is empty (`rows > 0 ? rows * STRIDE - 2 : 0`, and
	// the summon lane does the same). So a slot with rows in both areas paid −4,
	// a slot with rows in only one paid −2, and the four blocks came out up to
	// 2px apart with an identical row budget.
	//
	// That was almost invisible while received-buff rows were always on: they
	// pushed the reserve high enough that every slot kept at least one of each.
	// The LAYER TOGGLE makes it the common case — with buffs hidden the split is
	// summons-only, so any slot with fewer summons than the busiest one lands on
	// the other side of the ±2. Measured: 108/110/110/108 on a four-character
	// rotation, which the bench's cards mirror exactly, so the misalignment
	// arrives on the one coupling the ribbon exists to guarantee.
	//
	// ⚓ Taking the MAX rather than chasing the gap term: the property wanted here
	// is "the four blocks are the same height", and a max says that directly and
	// survives whatever the next row kind does with its own trailing gap. Costs
	// at most 2px on the slots that were shorter, which lands below the last aux
	// row where the block note above already says slack is least noticeable.
	//
	// ⚠ The BENCH_SLOT_MIN_H floor moved here with it and still means what it
	// meant — see the note above; applying it once to the max is the same answer
	// it gave per slot.
	let slotBlockH = $derived(
		Math.max(BENCH_SLOT_MIN_H, ...characterSlots.map((_, i) => slotNaturalH(i)))
	);

	// ── BELOW `toolMin` EACH SLOT IS ITS OWN HEIGHT (⚓ Nate 2026-10-14) ───────
	// The uniform height above exists for ONE reader: the bench's cards, which
	// stand beside the track groups they label and must be as tall as them.
	// Below `toolMin` the bench is a ROW above the chart and labels nothing
	// vertically, so the reason is gone and a phone — where the chart's height
	// is the scarce thing — stops paying for the busiest slot's rows in every
	// slot. Each takes its OWN summon lane (already per slot) and its OWN
	// received-buff rows, with no card floor (there is no card beside it).
	// ⚠ Every height reader takes `slotHeights`, so the bench metrics, the
	// connectors and the PNG snapshot (which has always carried a per-slot
	// `blockH`) follow the screen with no second path.
	// ↻ It follows the BENCH'S FORM, so a short screen's row (`narrowForm()`,
	// responsive sweep §3 item 4) fits its slots too.
	let fitSlotHeights = $derived(narrowForm());
	function slotOwnH(slotIdx: number): number {
		const rows = slotReceivedSubrowCounts[slotIdx] ?? 0;
		const buffH = rows > 0 ? rows * CHAR_BUFF_ROW_STRIDE - 2 : 0;
		return buffRowsTopForSlot(slotIdx) + buffH + CHAR_PAD_BOTTOM;
	}
	let slotHeights = $derived(
		characterSlots.map((_, i) => (fitSlotHeights ? slotOwnH(i) : slotBlockH))
	);

	// Cumulative Y offsets per slot — a walk, because below `toolMin` the
	// heights genuinely differ.
	let slotTopOffsets = $derived(
		slotHeights.map((_, i) => slotHeights.slice(0, i).reduce((a, h) => a + h, 0))
	);

	// ── Which below-slot lanes are on screen ─────────────────────────────────
	// ⚠ ONE ANSWER EACH, read by the height math, the markup AND the PNG
	// snapshot. The team-buff lane keeps its own long-standing rule (present at
	// full height even with no rows — the empty lane is the "no team buffs here"
	// signal); the layer toggle is a different question and removes it outright.
	// The Gleam lane appears only when someone RECEIVES the grant — an
	// all-Moonsign team (or Moonsign pair beside empty slots) has nobody to draw.
	let showTeamBuffsLane = $derived(showBuffs);
	let showNbLane = $derived(showBuffs && teamComp.natlanCount >= 1);
	let showMoonsignLane = $derived(
		showBuffs && teamComp.hasAscendantGleam && teamComp.nonMoonsignSlots.length > 0
	);

	let teamBuffsH = $derived(showTeamBuffsLane ? auxLaneH(teamBuffRows.length) : 0);
	// NB events all stack onto a single sub-row; the lane is always 1-row tall.
	let nbLaneH = $derived(auxLaneH(1));
	// moonsignLaneH is declared further down, after moonsignRows.

	// Moonsign buff windows — see src/lib/timeline/moonsignRows.ts.
	let moonsignRows = $derived(
		showMoonsignLane
			? computeMoonsignRows(rotation.events, teamComp.nonMoonsignSlots, characterSlots)
			: []
	);
	let moonsignLaneH = $derived(auxLaneH(moonsignRows.length));

	// ══ THE AURA LANE (gauge round L6) ════════════════════════════════════════
	// The target's elemental state — the first surface the gauge has. See
	// $lib/timeline/auraPlot.ts for the shape, and for why it is ONE overlaid
	// plot rather than a row per mod (⚓ Nate measured the premise the rows were
	// built on and it was false: auras barely coexist).
	// ⚠ GATED ON THE TOGGLE AT THE PROJECTION, like the buff rows — computing a
	// lane nobody draws costs a walk of every application and every reaction in
	// the rotation on each keystroke, and the aura layer is OFF by default, so
	// this is the common path rather than an edge case.
	// ↻ 2026-08-17: TWO READERS NOW, and the gate had to widen to match. The side
	// column's aura LOG is the same projection in words (`buildAuraLog`), and it
	// is deliberately not tied to the layer — wanting the transcript without the
	// chart is a real want — so the lane is computed when EITHER surface is on and
	// they share the one walk. ⛔ Don't give the log its own `computeAuraLane`
	// call: two projections of one thing is how a row and the mark above it come
	// to disagree.
	let laneSource = $derived(
		showAura || pv.showLog
			? computeAuraLane(rotation.auraSeries, rotation.applications, rotation.events)
			: EMPTY_AURA_LANE
	);
	let auraLane = $derived(showAura ? laneSource : EMPTY_AURA_LANE);
	/** ⚠ A module-level constant, not an inline literal: a fresh object each
	 *  time would make `auraLane` a new value on every unrelated re-run, and
	 *  every derived below it recomputes off its identity. */
	/** ↻ 2026-10-22 (⚓ Nate): the lane is ON whenever the layer is, empty or
	 *  not. It used to wait for the first application, so with Auras lit it
	 *  popped in mid-keystroke and shoved the whole chart down — and a lit
	 *  plate over an absent lane said nothing about why. Its empty plot and 1U
	 *  rule are the "nothing on the target yet" reading. */
	let showAuraLane = $derived(showAura);
	// The reaction labels' band and the application ticks' strip both sit ABOVE
	// the plot — a point stream reads as an annotation of the continuum under it,
	// and putting the ticks between the labels and the plot keeps each closer to
	// the thing it describes.
	const AURA_MARKER_H = 13;
	// ══ THE APPLICATION MARKER (unified with the Gauge Explorer, 2026-08-17) ═══
	// ⚓ ONE GRAMMAR, read top to bottom in both tools: what it CAUSED (the
	// reaction row above), what LANDED (this pill), and a HAIRLINE down into the
	// gauge it changed. ↻ It was a 2px stub 6px tall — ⚓ Nate: "incredibly tiny
	// touch points" — which named its element by colour alone and connected to
	// nothing. The pill is a target; the hairline is what ties an application to
	// the step it causes in the plot, which was previously left to the eye.
	//
	// ⚠️ SMALLER THAN THE EXPLORER'S PILL, and that is the density difference
	// between the two tools rather than a style drift: the instrument draws at
	// most MAX_GAUGE_APPS (8) and can afford 18px discs carrying text, while a
	// heavy rotation makes ~230 applications. The unit VALUE therefore lives in
	// this pill's tooltip, not inside it. ⛔ Don't put text in here without
	// measuring a real rotation first.
	const AURA_TICK_H = 10;
	const AURA_PILL_R = 4;
	// 🎛️ THE PLOT'S HEIGHT — the whole point of overlaying the mods.
	//
	// ⚓ FIXED, NOT PER-SERIES-COUNT, and that is a decision: a chart whose y axis
	// changes height with its content produces shapes that cannot be compared
	// between two rotations, and a lane that grows as a new aura appears makes the
	// whole timeline jump mid-read. The cost is that a one-aura rotation pays for
	// the same box a four-aura one does; the box is what makes them the same
	// picture.
	//
	// ↻ 56 → 80 (⚓ NATE 2026-08-17). The lane became the planner's headline
	// surface and 56px was reading as a strip rather than a chart — at the 1U
	// ceiling a whole aura's rise and decay had 50px to happen in, and two
	// overlaid mods sat inside each other's stroke.
	//
	// ⚠️ THE 24px WAS BOUGHT, NOT FOUND: --tool-pad-bottom went 3rem → 1.5rem in
	// the same commit, so the net page cost is ZERO on every screen. That matters
	// because the budget here is unforgiving — measured, the chart frame lives in
	// `viewport − 300px` of fixed page (chrome + pads + both bands above, the
	// bonuses strip + composer + bottom pad below), and at 1080p a heavy
	// four-character rotation was already ~30px into a page scroll BEFORE this.
	// ⛔ So don't grow this again without naming where the pixels come from; the
	// next 24 would come out of track rows.
	// ⛔ And ⛔ don't make it viewport-derived to dodge that: auraPlotH rides the
	// PNG snapshot, so two readers would export visibly different charts of the
	// same rotation.
	const AURA_PLOT_H = 80;
	// ⚠ The floor a LIVE aura is never drawn below. A 0.02U tail is a fraction of
	// a pixel, and not drawing it reads as "the aura ended" a second before it
	// did. ⛔ A gauge of exactly zero is not lifted — see `auraSpanPoints`.
	const AURA_MIN_PX = 1.5;
	// 🎛️ Label suppression: a span narrower than this cannot hold its own name,
	// and two labels closer than the gap would collide (Frozen opening on top of
	// Cryo is the standing case).
	const AURA_LABEL_MIN_SPAN = 46;
	const AURA_LABEL_MIN_GAP = 40;
	// ⚠ The vertical half of the collision test — one line-height. Two labels at
	// the same instant but different gauges do NOT collide, and Burning-on-Pyro
	// is exactly that pair.
	const AURA_LABEL_MIN_ROW = 12;
	// 🎛️ The unit datum's own label — inset from the plot's left edge, and lifted
	// so it sits on the rule's shoulder rather than across it.
	// ⛔ AURA_UNIT_LABEL_X / _MID / _MIN_Y and AURA_UNIT_RULE_INSET all retired
	// (2026-08-17). They positioned the unit labels INSIDE the plot — nudging a
	// baseline, clamping the top one, and making the rule yield its first 20px so
	// a hairline did not strike through 8px type. The labels moved to the frame's
	// left gutter, where none of those problems exist; the CSS is the whole of
	// their placement now.
	// ══ THE MARKER ROW'S LABEL RULE (2026-08-17) ══════════════════════════════
	// ⚠ MEASURED, NOT GUESSED. This used to be `room >= 26`, a stand-in for "the
	// shortest family name that survives" — so anything between 26px and its own
	// width was CLIPPED, and one Electro-Charged rotation read
	// `Electro-C · Electro-Ch · Electro-Cha · Electro-Charge`. See
	// `auraMarkerLabels`; the pad below is the pip plus its clearance.
	const AURA_MARKER_LABEL_PAD = 10;
	/** The marker label's type, for measurement only — it must MIRROR the
	 *  `.rp-aura-marker-label` rule below (--fs-xs at --fw-semibold) and the
	 *  export's own `600 9px SANS`. ⚠ `measureText` knows nothing about
	 *  letter-spacing, so --ls-mid (0.04em) is added per character. */
	const AURA_LABEL_FONT = '600 10px "IBM Plex Sans Variable", "IBM Plex Sans", sans-serif';
	const AURA_LABEL_TRACKING = 0.4;
	let labelMetrics: CanvasRenderingContext2D | null = null;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a pure memo of text metrics, keyed by string and never read reactively; making it a SvelteMap would invalidate every consumer the first time a new label is measured
	const labelWidthCache = new Map<string, number>();
	/**
	 * How wide a marker label renders, in px.
	 *
	 * ⚠ A CANVAS, NOT THE DOM. The alternative is measuring a rendered span, which
	 * is a forced layout per label per zoom change on a row that can hold dozens —
	 * and the values never change, so they are cached by text.
	 * ⚠ The `typeof document` guard is the SSR path: the timeline renders on the
	 * server, where the lane is always empty (no notation yet) so nothing asks —
	 * but a crash in a getter that "cannot be reached" is exactly the kind that is.
	 */
	function auraLabelWidth(text: string): number {
		const cached = labelWidthCache.get(text);
		if (cached !== undefined) return cached;
		if (!labelMetrics && typeof document !== 'undefined') {
			labelMetrics = document.createElement('canvas').getContext('2d');
			if (labelMetrics) labelMetrics.font = AURA_LABEL_FONT;
		}
		const width = labelMetrics
			? labelMetrics.measureText(text).width + text.length * AURA_LABEL_TRACKING
			: text.length * 6;
		labelWidthCache.set(text, width);
		return width;
	}
	// ══ THE GADGET STRIP (Polestar-Field round, 2026-09-01) ═══════════════════
	// ⚓ WHAT THE REACTION LEFT BEHIND, under the plot's baseline — the fourth
	// clause of the lane's top-to-bottom sentence (caused → landed → the gauge it
	// changed → what is still in the world). It sits BELOW the 0U datum on
	// purpose: a core and a Prism are entities, not gauge, and drawing them
	// inside the plot would put them on an axis that does not measure them.
	//
	// ⚠️⚠️ ITS HEIGHT IS CONDITIONAL, AND THAT IS WHAT PAYS FOR IT. `headerH`
	// moves the bench and spends a viewport budget `--tool-pad-bottom` has
	// already been raided once for (see AURA_PLOT_H's note). A rotation with no
	// bloom and no Stellar enabler — nearly all of them — pays ZERO here, and the
	// two teams that do pay get a row each. ⛔ Don't give the strip a resting
	// height so the layout "stops jumping": that is 20px taken from every reader
	// to spare two.
	// ══ THE GADGET ROW: MARKS FOR EVENTS, AN AREA FOR STATE ═══════════════════
	//
	// ⚓⚓ A MINIATURE OF THE PLOT ABOVE IT. The aura lane reads points-over-
	// continuum — application pills above, the gauge beneath — and this row says
	// the same sentence about the world instead of about the enemy: a dot where a
	// core appeared, an area for how many are standing.
	//
	// ⚓ AND THE REASON THREE EARLIER CUTS THRASHED: a dendro core's DURATION IS A
	// CONSTANT (6s unless something eats it), so every per-life duration mark was
	// ink spent on the one quantity that never varies. ⛔ Don't bring one back.
	const GADGET_ROW_GAP = 2;
	const GADGET_PROFILE_H = 16;
	/** A counted row needs height for its steps; a binary one (the Prism) is just
	 *  its own dot tall. */
	const gadgetRowH = (capacity: number) => (capacity > 1 ? GADGET_PROFILE_H : AURA_PILL_R * 2);
	/** ⚓ THE SAME DISC AS AN APPLICATION PILL (⚓ Nate) — one mark size for "a
	 *  thing happened at this instant" across the whole header, and SOLID, because
	 *  a spawn is a fact and not a provenance hedge. Dots ride the row's TOP edge:
	 *  events above the state they caused, which is the plot's own arrangement. */
	const gadgetDotCy = AURA_PILL_R;

	/**
	 * 🎛️ THE STATE'S FILL. ⚠ ONE FLAT ALPHA, ⛔ no gradient and ⛔ no outline
	 * (⚓ Nate 2026-09-01) — the knob to turn if a single core reads too faint,
	 * since a lone core is only a fifth of the row deep.
	 */
	const GADGET_FILL_ALPHA = 0.35;

	/**
	 * The live-count staircase, as a filled shape.
	 *
	 * ⚓ IT HANGS FROM THE TOP (⚓ Nate): the row's baseline is its TOP edge, where
	 * the spawn discs sit, and each live core steps the boundary DOWN. So the
	 * discs read as the surface and the state as what is suspended beneath them —
	 * a disc and the step it caused share an edge and read as one gesture.
	 *
	 * ⚓ FILL ONLY, WHICH IS WHAT UNIFIES THE TWO ROWS (⚓ Nate). A stroked
	 * boundary made the core row a CHART and the Prism row a bar with a line on
	 * it — two idioms in a 28px strip. Without it both rows say the same thing in
	 * the same way: a solid dot for the event, a translucent shape for the state,
	 * and the Prism's shape is simply the degenerate one-step case.
	 * ⚠️ It also retires an outline defect rather than just a taste: the stroke
	 * traced the CLOSED path, so it drew the baseline and both end walls too —
	 * three edges that were never data.
	 *
	 * ⚓ SQUARE STEPS. The count is an integer that changes at an instant — a core
	 * spawns or it does not — so a slope between two runs would draw a transition
	 * the game does not have. (The plot above interpolates because a gauge really
	 * is continuous; ⛔ the two are not the same kind of series.)
	 */
	function gadgetStair(runs: GadgetRun[], capacity: number, h: number): string {
		if (runs.length === 0) return '';
		const yOf = (n: number) => (Math.min(n, capacity) / capacity) * h;
		let d = `M ${xForTime(runs[0].start)} 0`;
		for (const run of runs) {
			d += ` L ${xForTime(run.start)} ${yOf(run.count)} L ${xForTime(run.end)} ${yOf(run.count)}`;
		}
		return d + ` L ${xForTime(runs[runs.length - 1].end)} 0 Z`;
	}

	type GadgetRowShape = { kind: string; label: string; capacity: number; bars: GadgetBar[] };

	/** A run's hover: the count, STATED — "is it four or five" is exactly what an
	 *  area at ~3px a step cannot answer on its own (⚓ Nate). */
	function gadgetRunEnter(e: MouseEvent, row: GadgetRowShape, run: GadgetRun, index: number) {
		gadgetHover = `${row.kind}:run:${index}`;
		onAuraMarkEnter(run.start);
		const consumedHere = row.bars.filter(
			(b) => b.end === run.start && b.endReason === 'consumed'
		).length;
		showTooltip(e, {
			sourceLabel: `${row.label} · ${secondsLabel(run.start)}–${secondsLabel(run.end)}s`,
			effects: [
				{
					stat: row.capacity > 1 ? 'On the field' : 'Standing',
					displayValue:
						row.capacity > 1
							? `${run.count} ${run.count === 1 ? 'core' : 'cores'}`
							: `${((run.end - run.start) / FPS).toFixed(2)}s`
				},
				...(consumedHere > 0
					? [{ stat: 'Just now', displayValue: `${consumedHere} consumed by a reaction` }]
					: [])
			],
			isMutuallyExclusive: false
		});
	}

	/** A spawn disc's hover: what appeared here, and what it joined. */
	function gadgetDotEnter(e: MouseEvent, row: GadgetRowShape, spawn: GadgetSpawn, index: number) {
		gadgetHover = `${row.kind}:dot:${index}`;
		onAuraMarkEnter(spawn.time);
		const first = spawn.bars[0];
		const ends = new Set(spawn.bars.map((b) => b.end));
		showTooltip(e, {
			sourceLabel: `${row.label} · ${secondsLabel(spawn.time)}s`,
			effects: [
				// ⚠ A group's lives can END at different instants even though they
				// began together (one eaten, the rest expiring), so the duration is
				// only stated when they agree.
				...(ends.size === 1
					? [
							{
								stat: 'On the field',
								displayValue: `${((first.end - spawn.time) / FPS).toFixed(2)}s`
							}
						]
					: []),
				...(spawn.bars.length > 1
					? [{ stat: 'Spawned', displayValue: `${spawn.bars.length} at once` }]
					: []),
				...(row.capacity > 1
					? [
							{
								stat: 'Alongside',
								displayValue: `${
									row.bars.filter((b) => b.start <= spawn.time && b.end > spawn.time).length
								} live`
							}
						]
					: []),
				...(spawn.bars.some((b) => b.endReason === 'consumed')
					? [{ stat: 'Ends', displayValue: 'consumed by a reaction' }]
					: spawn.bars.some((b) => b.endReason === 'popped')
						? [{ stat: 'Ends', displayValue: 'pushed out by a newer core' }]
						: [])
			],
			isMutuallyExclusive: false
		});
	}
	let gadgetRows = $derived(showAura ? computeGadgetRows(rotation.windows) : []);
	let gadgetStripH = $derived(
		gadgetRows.reduce((h, r) => h + gadgetRowH(r.capacity) + GADGET_ROW_GAP, 0)
	);
	/** The life the cursor is standing on, `${kind}:${index}` — everything else in
	 *  its row dims. ⚠ Keyed by ROW TOO: two rows are two independent charts and
	 *  hovering one must not dim the other. */
	let gadgetHover = $state<string | null>(null);

	let auraLaneH = $derived(
		showAuraLane ? AURA_MARKER_H + AURA_TICK_H + AURA_PLOT_H + gadgetStripH + AUX_LANE_PAD_Y * 2 : 0
	);

	/**
	 * THE HEADER — everything above the first track row, measured from the
	 * surface's top: the aura lane, then the ruler.
	 *
	 * ⚓ ONE NUMBER, and it has three readers that must never disagree about
	 * where the tracks begin — the on-screen layout, the BENCH (published via
	 * `claimMetrics`, so the cards keep labelling their track groups) and the
	 * PNG export's origin. That agreement used to rest on the bench's
	 * `RIBBON_FRAME_TOP_INSET` being hand-copied from RULER_H, which held only
	 * while the header contained exactly one thing.
	 *
	 * ⚠ It is therefore ZOOM-INDEPENDENT but LAYER-dependent: toggling the aura
	 * lane moves every track row, the bench's card column and the export
	 * together, in one step, with no animation (the ribbon has not animated
	 * since the tail round).
	 */
	let headerH = $derived(RULER_H + auraLaneH);
	/**
	 * 🎛️ HEADROOM ABOVE THE CEILING (⚓ NATE 2026-08-17). The ceiling used to map
	 * to y=0, which put the top rule on the plot's very edge — so a line sitting
	 * AT the ceiling (Burning's fixed 2U aura is the standing case) was drawn
	 * half outside the box and clipped down the middle, and the top label could
	 * not be centred on its own rule without being clipped too.
	 *
	 * ⚠️ It buys BOTH fixes at once, which is why it is a geometry change rather
	 * than two label special-cases: with the rule a few px down, a value at the
	 * ceiling draws its full stroke and every label centres by the same rule.
	 * ⛔ Don't go back to clamping the top label — that was the workaround this
	 * replaces.
	 */
	const AURA_PLOT_HEAD = 6;
	/** Units → px within the plot box. ⚓ The plot draws at 1:1 (one SVG spanning
	 *  the whole track, no viewBox stretch), which is what lets the gauge line be
	 *  a real STROKE — the row form could only ever be a fill. */
	const auraYOf = (u: number): number =>
		AURA_PLOT_H - (u / auraLane.uMax) * (AURA_PLOT_H - AURA_PLOT_HEAD);
	let auraLabels = $derived(
		auraSpanLabels(
			auraLane.series,
			xForTime,
			auraYOf,
			AURA_LABEL_MIN_SPAN,
			AURA_LABEL_MIN_GAP,
			AURA_LABEL_MIN_ROW
		)
	);
	let auraUnitRules = $derived(auraUnitLines(auraLane.uMax));
	/** Which markers show their name — measured against the room to the next pip.
	 *  Re-derives on zoom, which is what moves the room. */
	let auraMarkerShown = $derived(
		auraMarkerLabels(auraLane.markers, xForTime, auraLabelWidth, AURA_MARKER_LABEL_PAD)
	);
	/** Every span's polyline, pre-mapped once per zoom change — the fill and the
	 *  line share it, and so does the PNG export by calling the same function. */
	let auraPaths = $derived(
		auraLane.series.flatMap((s, si) =>
			s.spans.map((span, pi) => {
				const points = auraSpanPoints(span, xForTime, auraYOf, AURA_MIN_PX);
				return {
					id: `${s.mod}-${si}-${pi}`,
					color: s.color,
					dash: s.dash,
					// ⚠ The fuel is bookkeeping, not an aura on the target, so it draws
					// as a bare dashed line with NO area under it — the same distinction
					// the Gauge Explorer makes.
					fill: s.dash ? null : auraPathD(points, AURA_PLOT_H),
					line: auraPathD(points)
				};
			})
		)
	);

	// The padding sliver is a DISPLAY choice; the parse pads either way. Stripped
	// here, once, so the live chart and the PNG snapshot read the same blocks.
	let displayTracks = $derived(
		$siteSettings.showHumanPadding
			? rotation.tracks
			: rotation.tracks.map((t) => ({
					...t,
					inputBlocks: t.inputBlocks.filter((b) => b.kind !== 'pad')
				}))
	);
	let annotatedTracks = $derived(mapTracksToSlots(displayTracks, characterSlots));

	/** The padding sliver's tooltip — names the pixel: how long, and what it
	 *  followed. A swap's pad is the wait for the incoming character to appear. */
	function padTitle(block: InputBlock): string {
		const f = block.duration;
		const s = (f / FPS).toFixed(2);
		const after: Record<NonNullable<InputBlock['padAfter']>, string> = {
			normal: 'a normal attack',
			charged: 'a charged attack',
			plunge: 'a plunge',
			skill: 'a skill',
			burst: 'a burst',
			dash: 'a dash',
			jump: 'a jump',
			swap: 'the swap'
		};
		const what = block.padAfter ? after[block.padAfter] : 'an action';
		return block.padAfter === 'swap'
			? `Human timing: ${f} frames (${s}s) after the swap — nothing buffers until the new character appears.`
			: `Human timing: ${f} frames (${s}s) after ${what}, before an input the game does not buffer.`;
	}

	// Group tracks by slot index for rendering character blocks
	let tracksBySlot = $derived(
		Array.from({ length: 4 }, (_, i) => annotatedTracks.filter((t) => t.slotIdx === i))
	);

	// Publish per-slot block heights + blank-usage to the bench band (bench-band
	// round): the band's cards align to their track groups through this DATA
	// channel, never by reading each other's DOM. Ownership-guarded in the
	// module so this instance's retention-delayed teardown can't stomp a newer
	// timeline's metrics.
	const publishBenchMetrics = benchBand.claimMetrics();
	$effect(() => {
		publishBenchMetrics(
			slotHeights,
			characterSlots.map((id, i) => id === 'blank' && tracksBySlot[i].length > 0),
			// ⚠ The third value is the HEADER's height — how far the first track
			// row sits below the surface's top — and it is published rather than
			// mirrored on the bench side because it is no longer a constant. See
			// `benchBand.trackTop`.
			headerH
		);
	});
	onDestroy(() => publishBenchMetrics(null));

	// ---------------------------------------------------------------------------
	// Derived: timeline dimensions
	// ---------------------------------------------------------------------------

	let trackScrollWidth = $state(0);
	let trackScrollEl: HTMLDivElement | undefined;
	/** The track scroller's inline padding, each side: the scrollers reach out
	 *  to their neighbours and pad back by the insets they crossed (see THE SIDE
	 *  FADES in the styles), so a content x sits `trackPad.left` further along
	 *  the scroll than it reads, and the content viewport is the client width
	 *  less both. The sides differ (the bench's gap on the left, the screen's
	 *  edge or an aside's gap on the right). Re-read whenever the client width
	 *  moves — opening an aside or crossing a breakpoint moves both. */
	let trackPad = $derived.by(() => {
		void trackScrollWidth;
		if (!trackScrollEl) return { left: 0, right: 0 };
		const cs = getComputedStyle(trackScrollEl);
		return { left: parseFloat(cs.paddingLeft) || 0, right: parseFloat(cs.paddingRight) || 0 };
	});
	// The ruler strip viewport — a pure FOLLOWER of the track scroller (overflow
	// hidden, no user scroll): it only ever receives programmatic scrollLeft
	// writes, so it can't be momentum-scrolling when one lands.
	let rulerScrollEl: HTMLDivElement | undefined;

	// ↻ 2026-08-11 (the timeline round): THE GESTURE LATCH IS GONE, and it is
	// worth recording what it was for, because deleting a hard-won workaround
	// looks reckless without the reason.
	//
	// There used to be TWO user-scrollable elements here — the tracks and a
	// hand-built external scrollbar below them — mirroring each other. A
	// programmatic scrollLeft write onto an element that is momentum-scrolling
	// breaks the scroll (Chrome/Firefox hitch; Safari resolves the interrupted
	// momentum by JUMPING to the end), so each side had to know when the other
	// was driving, via a 150ms source latch.
	//
	// ⚓ NATE 2026-08-11: "the only thing we need [the custom scrollbar] to
	// avoid" was the native overlay scrollbar drawing on top of the bottom lane's
	// bars. Styling ::-webkit-scrollbar makes the scrollbar non-overlay — it
	// takes layout space instead of floating over content — so a bottom gutter
	// on the scroller solves that directly (see .rp-track-scroll). With the
	// second scroller gone there is exactly ONE gesture source and one
	// write-only follower, which is a shape that cannot have the bug the latch
	// defended against. The whole class of failure left with the DOM node.
	let mirrorRaf = 0;

	function scheduleMirror() {
		if (mirrorRaf) return;
		mirrorRaf = requestAnimationFrame(() => {
			mirrorRaf = 0;
			if (!trackScrollEl || !rulerScrollEl) return;
			rulerScrollEl.scrollLeft = trackScrollEl.scrollLeft;
		});
	}

	/**
	 * The header strip's wheel, handed to the tracks (2026-08-17).
	 *
	 * The strip is `overflow: hidden` — that is what makes it a follower — so a
	 * gesture over it did nothing at all. That was invisible while the strip held
	 * only the ruler (nobody scrolls a chart by its axis), and stopped being
	 * invisible the moment the AURA LANE moved up here: it is a chart occupying
	 * a third of the header, and a chart that will not scroll under the cursor
	 * reads as broken.
	 *
	 * ⚠ HORIZONTAL ONLY, deliberately. Over the tracks a vertical wheel scrolls
	 * the PAGE (the scroller is x-only), so forwarding deltaY would give the
	 * header a behaviour the surface it mirrors does not have. Writing
	 * `trackScrollEl.scrollLeft` fires its scroll event, which brings the strip
	 * back into line through the existing mirror — the follower is never written
	 * from two places.
	 */
	function onHeaderWheel(e: WheelEvent) {
		if (!trackScrollEl || e.deltaX === 0) return;
		trackScrollEl.scrollLeft += e.deltaX;
		e.preventDefault();
	}

	// Pointer guard while scrolling. Chrome freezes hover processing during an
	// active trackpad gesture but resumes it around gesture end — which on
	// macOS is FINGER LIFT, while OS momentum events are still streaming. From
	// that moment, bars sweeping under a stationary cursor fire mouseenter/
	// mouseleave, and each tooltip mount/unmount is a Svelte flush + layout of
	// a fixed-position element — enough main-thread churn to coalesce the
	// remaining momentum deltas into one visible lump ("jump to the end").
	// Standard virtualized-list mitigation: disable pointer hit-testing on the
	// scroll content while scroll events are streaming; restore shortly after
	// the last one. Tooltips simply don't appear mid-scroll.
	let scrollPointerGuard = $state(false);
	let scrollIdleTimer: ReturnType<typeof setTimeout> | undefined;
	function markScrolling() {
		if (!scrollPointerGuard) {
			scrollPointerGuard = true;
			tooltip = null;
		}
		clearTimeout(scrollIdleTimer);
		scrollIdleTimer = setTimeout(() => (scrollPointerGuard = false), 150);
	}
	$effect(() => () => {
		clearTimeout(scrollIdleTimer);
		cancelAnimationFrame(mirrorRaf);
	});

	function onTrackScroll() {
		markScrolling();
		scheduleMirror();
	}

	let totalDuration = $derived.by(() => {
		let max = rotation.totalDuration;
		// The IR window/event extents cover spans the drawn geometry does NOT —
		// a shield window whose end trails its owner cast, a state window, etc.
		// Fold them in. The window records still do NOT cover every DRAWN
		// extent: a plain skill/burst cast can carry a `duration`-derived uptime
		// pill with no backing stance/summon window (e.g. Skirk `hE` uptime
		// 12.57, Varka `E` uptime 12 — instant/hold variants inheriting a stance
		// ability's duration but resolving as non-stance, so no window record is
		// emitted). Post-P4 #3 the cast events carry the full geometry
		// (cooldown/uptime/spawn offset — bars are projections of them), so the
		// ghost-CD tail and the uptime pill extents read straight off the casts:
		// `time + cooldown` for the cd tail, `time + offset + uptime` for the
		// pill (adversarial-review fix — dropping the pill term shrank valid
		// rotations). For swap-clamped stance owners the un-clamped
		// `time + offset + uptime` likewise stays the extent (the stance
		// window's swap-clamped `end` is <= it, so `Math.max` prefers the cast).
		for (const win of rotation.windows) max = Math.max(max, win.end);
		for (const ev of rotation.events) {
			max = Math.max(max, ev.time);
			if (ev.kind !== 'cast') continue;
			max = Math.max(max, ev.time + ev.cooldown);
			if (ev.uptime > 0) max = Math.max(max, ev.time + ev.summonActivatesAt + ev.uptime);
		}
		for (const track of rotation.tracks) {
			max = Math.max(max, track.activeEnd);
		}
		for (const ev of nbBars) max = Math.max(max, ev.start + ev.cooldown);
		for (const subrow of teamBuffRows) {
			for (const bar of subrow.bars) max = Math.max(max, bar.end);
		}
		for (const row of moonsignRows) {
			for (const win of row.windows) max = Math.max(max, win.start + win.duration);
		}
		for (const row of charReceivedBuffRows) {
			for (const bar of row.bars) max = Math.max(max, bar.end);
		}
		for (const row of weaponProcRows) {
			for (const bar of row.bars) max = Math.max(max, bar.end);
		}
		// ⚠️ `scale` is px per SECOND, so the viewport width converts to frames via
		// the same seam the geometry wrappers use. The tail pad (2s) and the floor
		// (25s) are frame counts now — they are axis lengths, not px.
		const viewportW = trackScrollWidth - trackPad.left - trackPad.right;
		const viewportFrames = viewportW > 0 ? (viewportW / scale) * FPS : 25 * FPS;
		return Math.max(max + 2 * FPS, viewportFrames, 25 * FPS);
	});
	let totalWidth = $derived(Math.round((totalDuration / FPS) * scale));

	// ⛔ `majorTicks` is gone (2026-08-11): it existed only to draw gridlines for
	// the 5s marks, and every tick draws one now.
	// ⚠ `rulerTicks` walks SECONDS (its 1s/2s/5s step ladder and `t % 5` major
	// rule are seconds rules) — so the axis converts here.
	let ticks = $derived(rulerTicks(totalDuration / FPS, scale));

	// ---------------------------------------------------------------------------
	// Geometry helpers
	// ---------------------------------------------------------------------------

	/** Thin reactive wrappers over the pure projection in
	 *  $lib/timeline/barGeometry — they close over this component's live `scale`
	 *  so every existing call site stays unchanged. (The Team Builder's Compare
	 *  bars shared the pure module until they retired, 2026-10-13.)
	 *
	 *  ⚓⚓ THESE TWO FUNCTIONS ARE THE FRAMES→SECONDS SEAM, and they are the
	 *  reason the ~20 `barGeom(...)` call sites in the template below did not
	 *  change when the IR went frames-native (gauge-round.md C1). Everything on
	 *  the parser side of this line is frames; `scale` is px per SECOND, because
	 *  `barGeometry` was shared with the Team Builder's Compare (retired
	 *  2026-10-13), whose data had no frame in it.
	 *  ⛔ Don't push the division outward into the call sites — one seam that is
	 *  named is worth twenty that are not. */
	/** FRAMES → the "12.5s" readout. ⚓ The surface is the ONE place the frames
	 *  contract lets a value go back to seconds; naming it keeps the four call
	 *  sites below from each growing their own `/ 60`. */
	const secondsLabel = (frames: number): number => Math.round((frames / FPS) * 10) / 10;

	function xForTime(f: number): number {
		return projectX(f / FPS, scale);
	}

	function barGeom(startF: number, spanF: number): { left: number; width: number } {
		return projectBar(startF / FPS, spanF / FPS, scale);
	}

	/** Cap a buff-bar label's width at the NEXT bar's left edge. Inset = bar
	 *  padding (5) + icon 11 + gap 4 when an icon leads, plus 2px for the
	 *  neighbour's edge line. Null (no cap) only when nothing follows in this
	 *  subrow, where the lane's own width is the bound.
	 *
	 *  ↻ 2026-08-11 (the label-decoupling round) — THE NEIGHBOUR IS NOW THE ONLY
	 *  BOUND, so this applies whether or not the two bars overlap. It used to
	 *  return null for non-overlapping bars because the BAR clipped its own
	 *  label (overflow:hidden) and the cap was needed only where a neighbour
	 *  painted over the tail. The label leaves its bar now — vertically by
	 *  design, and horizontally as the readability win, since a 5px bar with
	 *  three seconds of empty lane after it can finally say what it is. What it
	 *  must never do is run under the next bar, which is exactly this. */
	function labelCapPx(
		g: { left: number; width: number },
		next: { start: number } | undefined,
		hasIcon: boolean
	): string | null {
		if (!next) return null;
		const nextLeft = barGeom(next.start, 0).left;
		return `${Math.max(0, nextLeft - g.left - (hasIcon ? 20 : 5) - 2)}px`;
	}

	/**
	 * Swap connector between two consecutive notation segments, as an SVG path.
	 * Spans vertically from the active row of the 'from' slot to the active row
	 * of the 'to' slot. Returns null if both tracks are in the same slot (no swap).
	 *
	 * Corner-rounding logic (the flip): travelling downward the free corners
	 * are top-right + bottom-left; upward they are top-left + bottom-right —
	 * expressed as quadratic bends on those two corners.
	 */
	/** Shared connector geometry — consumed by the SVG path builder below and
	 *  by the PNG export snapshot, so the two renders can never diverge. */
	function connectorGeom(
		from: SlottedTrack,
		to: SlottedTrack
	): { x: number; w: number; yTop: number; yBottom: number; downward: boolean } | null {
		if (from.slotIdx === to.slotIdx) return null;
		const x = xForTime(from.activeEnd);
		const w = Math.max(xForTime(to.activeStart) - x, 1);
		const topSlot = Math.min(from.slotIdx, to.slotIdx);
		const bottomSlot = Math.max(from.slotIdx, to.slotIdx);
		// Align with the inset active bar (top: 1px, height: calc(100% - 2px)).
		// The ruler lives in its own full-width strip ABOVE the track area (so
		// the notes panel can't push it), so tracks carry no ruler offset.
		const yTop = slotTopOffsets[topSlot] + activeRowOffsetForSlot(topSlot) + 1;
		const yBottom =
			slotTopOffsets[bottomSlot] + activeRowOffsetForSlot(bottomSlot) + ACTIVE_ROW_H - 1;
		return { x, w, yTop, yBottom, downward: from.slotIdx < to.slotIdx };
	}

	/**
	 * Connector as a positioned-div style string. Divs, not SVG paths, for the
	 * LIVE view: Safari pixel-snaps CSS boxes but paints inline-SVG content at
	 * the exact fractional page offset, so an SVG connector can sit ~1px off
	 * the div bars it must join (Chrome/Firefox render both identically; the
	 * headless-WebKit probe couldn't reproduce it, real Safari shows it). The
	 * PNG export keeps drawing from the same connectorGeom.
	 */
	/**
	 * ══ THE CONNECTOR'S CORNERS ROUND THEMSELVES (⚓ NATE 2026-08-11) ══════════
	 * ⚓ "I'm wondering how possible it would be to make this border radius fully
	 * round the corner no matter what ping setting or zoom display is chosen.
	 * Would it be as simple as making it border-radius 999px on that corner? Or
	 * would it need to be calculated from ping and zoom?"
	 *
	 * As simple as 999px, and the reason it needs no arithmetic is a rule CSS
	 * already applies for us. Per CSS Backgrounds §5.5, when the radii on a side
	 * exceed that side's length the engine computes ONE scale factor
	 * f = min over sides of (side length ÷ sum of that side's two radii) and
	 * scales EVERY radius by it. Only two opposite corners carry a radius here,
	 * so each side's sum is just R, and f = min(w, h) ÷ R. The used radius comes
	 * out at exactly min(w, h) — the largest arc the box can hold — for any R
	 * big enough to trigger the clamp.
	 *
	 * So the box's own dimensions ARE the calculation, and they already track
	 * ping and zoom: w is the swap gap in px (xForTime of the next active start
	 * minus this one, so ping × scale) and h spans the two active rows. Nothing
	 * to recompute, and nothing to keep in sync when either knob moves.
	 *
	 * ⚠ THIS IS A REAL SHAPE CHANGE, NOT JUST A CAP LIFT. The old radius was
	 * min(3, floor(w / 2)) — capped at 3px AND at HALF the width. The used value
	 * is now the FULL min(w, h), so a connector at a wide swap gap sweeps rather
	 * than nicks its corner.
	 *
	 * ⚠ 999px is doing real work and is not a lazy "big number": it must exceed
	 * min(w, h) at every zoom for the clamp to bite, and ZOOM_MAX × a long ping
	 * can be hundreds of px. Don't "tidy" it down to something that looks
	 * reasonable — a value that stops triggering the clamp silently becomes a
	 * fixed radius again.
	 */
	function connectorStyle(from: SlottedTrack, to: SlottedTrack): string | null {
		const geo = connectorGeom(from, to);
		if (!geo) return null;
		const { x, w, yTop, yBottom, downward } = geo;
		// Downward: free corners are TR and BL; upward: TL and BR
		const radius = downward ? '0 999px 0 999px' : '999px 0 999px 0';
		return `left:${x}px;top:${yTop}px;width:${w}px;height:${yBottom - yTop}px;border-radius:${radius}`;
	}

	// Full height of the chart column (header + slots + lanes) — sizes the PNG
	// export canvas. ↻ 2026-08-17: the aura band is inside `headerH` now rather
	// than a term at the end; the SUM is unchanged, which is the point.
	let contentH = $derived(
		headerH +
			slotHeights.reduce((a, h) => a + h, 0) +
			teamBuffsH +
			(showNbLane ? nbLaneH : 0) +
			(showMoonsignLane ? moonsignLaneH : 0)
	);

	// ---------------------------------------------------------------------------
	// PNG export — assembles a snapshot of everything already derived and hands
	// it to the canvas painter (timelineExport.ts). Copy first, download as
	// the fallback.
	// ---------------------------------------------------------------------------

	/** One slot's bench card for the export — what SlotPortrait shows, read
	 *  from the same layer-resolved con and loadout the bench reads. */
	function benchCard(
		char: (typeof slotCharacters)[number],
		slotId: string,
		ownedConOf: (id: string) => number | null | undefined
	): ExportBenchCard {
		const con = char ? effectiveConLevel(char.id) : 0;
		const owned = char ? ownedConOf(char.id) : undefined;
		const entry: LoadoutEntry = char ? effectiveLoadoutEntry(char.id) : {};
		const artifactSet = !!entry.artifactSetId && !!getArtifactSetById(entry.artifactSetId);
		const real = char != null && char.id !== 'blank';
		return {
			displayName: real ? slotLabel(char) : null,
			element: char?.element,
			sideArt: getAvatar(
				real ? slotId : 'blank',
				$siteSettings.useNewOutfits,
				'side',
				$siteSettings.travelerVariant
			),
			conLevel: con,
			conShort: real && owned !== undefined && (owned === null || owned < con),
			uncurated: real && getCharacterIndexEntry(char.id)?.curated === false,
			artifactIcon: artifactSet ? artifactImagePath(entry.artifactSetId!) : GENERIC_ARTIFACT_ICON,
			artifactSet,
			weaponIcon: entry.weaponId
				? weaponImagePath(entry.weaponId)
				: weaponTypeIcon(real ? getCharacterIndexEntry(char.id)?.weapon : undefined),
			weaponSet: !!entry.weaponId,
			refinement: entry.weaponRefinement ?? 1
		};
	}

	function buildSnapshot(): TimelineSnapshot {
		const laneStride = AUX_LANE_BAR_STRIDE;
		// Lanes open directly under the 4th track group (the ribbon-clearance
		// gap retired with the tall bench — the strip clears the lanes by
		// standing over the whole label column instead).
		const slotsBottom = slotTopOffsets[3] + slotHeights[3];
		const nbVisible = showNbLane;
		const moonVisible = showMoonsignLane;
		// ⚓ The footer says how the reader is timing it, in words (Nate 2026-10-16:
		// the export is what the reader has set, no checkboxes) — so a padded
		// rotation is never taken for a frame-perfect one.
		const ping = `${$siteSettings.swapPing} ms swap ping`;
		const pad = `${$siteSettings.humanTimingPadFrames}-frame padding`;
		const timingNote = !$siteSettings.humanTiming
			? `Frame-perfect · ${ping}`
			: $siteSettings.humanTimingMode === 'animations'
				? `Human timing · full animations · ${ping}`
				: $siteSettings.humanTimingMode === 'both'
					? `Human timing · full animations and ${pad} · ${ping}`
					: `Human timing · ${pad} · ${ping}`;
		// The tab's own name, unless it is still a default one.
		const label = rotationTabs.tabs.find((t) => t.id === tabId)?.label ?? '';
		const tabLabel = /^(Tab \d+|Shared rotation|Imported team)$/.test(label) ? null : label || null;
		// The bench card's roster comparison (BenchBand's `ownedConOf`): unknown
		// while nothing is marked owned, null when this character isn't.
		const rosterHasContent = Object.values($ownership).includes('owned');
		const ownedConOf = (id: string): number | null | undefined =>
			!rosterHasContent || id === 'blank'
				? undefined
				: $ownership[id] === 'owned'
					? ($constellations[id] ?? 0)
					: null;
		const withSummon = (
			char: (typeof slotCharacters)[number],
			source: 'skill' | 'burst',
			bars: TimelineBar[]
		): ExportBar[] =>
			bars.map((b) => ({
				...b,
				hasSummon:
					findCastSummons(char, source, b.label, b.abilityId, b.variantLabel ?? null).length > 0
			}));

		return {
			tabLabel,
			notation,
			notationTints: notationTints(rotation),
			timingNote,
			endFrame: rotation.totalDuration,
			scale,
			rulerH: RULER_H,
			totalWidth,
			contentH,
			ticks,
			slots: characterSlots.map((slotId, i) => {
				const char = slotCharacters[i];
				return {
					element: char?.element,
					// No-frame-map (uncurated, non-Blank) → dire N/C/P treatment in export.
					isApprox: char != null && !isCurated(char) && char.id !== 'blank',
					blockH: slotHeights[i],
					qRowTop: qRowTopForSlot(i),
					activeRowTop: activeRowOffsetForSlot(i),
					buffRowsTop: buffRowsTopForSlot(i),
					summonLaneTop: summonLaneTop(),
					tracks: tracksBySlot[i].map((t) => ({
						activeStart: t.activeStart,
						activeEnd: t.activeEnd,
						hasUnsetDuration: t.hasUnsetDuration,
						inputBlocks: t.inputBlocks,
						eBars: withSummon(char, 'skill', t.eBars),
						qBars: withSummon(char, 'burst', t.qBars)
					})),
					summonRows: summonSubrows.filter((r) => r.slotIdx === i),
					procRows: weaponProcRows.filter((r) => r.characterId === char?.id),
					receivedRows: charReceivedBuffRows.filter((r) => r.characterId === char?.id),
					bench: benchCard(char, characterSlots[i], ownedConOf)
				};
			}),
			slotTops: slotTopOffsets,
			connectors: annotatedTracks
				.slice(0, -1)
				.map((t, i) => connectorGeom(t, annotatedTracks[i + 1]))
				.filter((g): g is NonNullable<typeof g> => g != null),
			eRowH: E_ROW_H,
			qRowH: Q_ROW_H,
			activeRowH: ACTIVE_ROW_H,
			buffRowH: CHAR_BUFF_ROW_H,
			buffRowStride: laneStride,
			summonRowH: SUMMON_ROW_H,
			summonRowStride: SUMMON_ROW_STRIDE,
			charPadTop: CHAR_PAD_TOP,
			teamBuffRows,
			teamBuffsTop: slotsBottom,
			teamBuffsH,
			nbBars,
			nbTop: nbVisible ? slotsBottom + teamBuffsH : null,
			nbH: nbLaneH,
			moonsignRows,
			moonsignTop: moonVisible ? slotsBottom + teamBuffsH + (nbVisible ? nbLaneH : 0) : null,
			moonsignH: moonsignLaneH,
			auraLane,
			// ⚠ A HEIGHT, NOT A TOP (2026-08-17). The lane moved above the ruler, so
			// its position is no longer a distance down the lane stack — it OPENS the
			// chart column, and every track offset the export computes is pushed down
			// by exactly this. 0 = the layer is off, or the rotation landed nothing.
			auraHeaderH: auraLaneH,
			auraPlotH: AURA_PLOT_H,
			auraPlotHead: AURA_PLOT_HEAD,
			auraMarkerH: AURA_MARKER_H,
			auraTickH: AURA_TICK_H,
			gadgetRows,
			gadgetProfileH: GADGET_PROFILE_H,
			gadgetDotR: AURA_PILL_R,
			gadgetFillAlpha: GADGET_FILL_ALPHA,
			gadgetRowGap: GADGET_ROW_GAP,
			auraPillR: AURA_PILL_R,
			auraMinPx: AURA_MIN_PX,
			auraLabelMinSpan: AURA_LABEL_MIN_SPAN,
			auraLabelMinGap: AURA_LABEL_MIN_GAP,
			auraLabelMinRow: AURA_LABEL_MIN_ROW,
			statIconFor: (stat) => BUFF_STAT_ICON[stat as Stat]
		};
	}

	// ── Chart-bound exports ────────────────────────────────────────────────
	// Both exports need THIS component: the PNG renders a snapshot of the chart
	// as drawn, and the KQM copy canonicalizes the notation the composer holds.
	// The buttons, though, belong with the share link in band A — one family,
	// one menu (toolbar round). So the timeline REGISTERS them, exactly as it
	// registers its bench-slot metrics, and the band offers them only while a
	// planner is mounted to serve them.
	let pngBusy = false;

	async function runPng(mode: 'copy' | 'download'): Promise<Outcome> {
		// A second click while one renders: said, rather than swallowed.
		if (pngBusy)
			return { ok: false, short: 'Still working', long: 'The image is still being made' };
		pngBusy = true;
		try {
			// ⚓ THE EXPORT IS THE DOCUMENT (plan §3.3), never the Repeat stream.
			// Every projection is a `$derived` of `rotation`, and deriveds are
			// pulled, so disarming Repeat for the length of one synchronous
			// snapshot recomputes them from the document and puts them back before
			// any effect or the DOM sees the change.
			const wasRepeat = pv.repeat;
			pv.repeat = false;
			let snapshot: TimelineSnapshot;
			try {
				snapshot = buildSnapshot();
			} finally {
				pv.repeat = wasRepeat;
			}
			const blob = await renderTimelinePng(snapshot);
			const result = await deliverPng(blob, 'critcalc-rotation.png', mode);
			pngBusy = false;
			if (result === 'copied') return { ok: true, short: 'Copied', long: 'Image copied' };
			// A refused clipboard (Safari) falls back to a download, which must
			// not read as the copy having worked: a warning that stays to be read.
			if (mode === 'copy') {
				notices.toast('warning', 'Couldn’t copy the image, so it was downloaded instead');
				return { ok: false, short: 'Downloaded', long: '' };
			}
			return { ok: true, short: 'Downloaded', long: 'Image downloaded' };
		} catch (e) {
			console.error('PNG export failed:', e);
			pngBusy = false;
			notices.toast(
				'error',
				'Couldn’t make the image. Try again, or report this if it keeps happening.'
			);
			return { ok: false, short: 'Failed', long: '' };
		}
	}

	async function copyKqm() {
		if (!notation.trim()) return false;
		try {
			await navigator.clipboard.writeText(toKqmNotation(notation));
			return true;
		} catch {
			return false;
		}
	}

	$effect(() => documentBar.registerExporters({ kqm: copyKqm, png: runPng }));

	// ---------------------------------------------------------------------------
	// Connection info per track (arrival/departure of swap connectors)
	// ---------------------------------------------------------------------------

	type ConnectInfo = { hasArrival: boolean; hasDeparture: boolean };

	let trackConnections = $derived.by(() => {
		const map = new SvelteMap<number, ConnectInfo>();
		for (let i = 0; i < annotatedTracks.length; i++) {
			const t = annotatedTracks[i];
			const prev = annotatedTracks[i - 1];
			const next = annotatedTracks[i + 1];
			// ⚠️ OR'd into a key already set: a bare name a same-character `>`
			// continues is a ZERO-width track sharing its start with the next one
			// (run.ts, the stay's min width), and the swap arrives at the first.
			const prior = map.get(t.activeStart);
			map.set(t.activeStart, {
				hasArrival: (prior?.hasArrival ?? false) || (prev != null && prev.slotIdx !== t.slotIdx),
				hasDeparture: (prior?.hasDeparture ?? false) || (next != null && next.slotIdx !== t.slotIdx)
			});
		}
		return map;
	});

	function barRadius(conn: ConnectInfo | undefined): string {
		const l = conn?.hasArrival ? '0' : '1px';
		const r = conn?.hasDeparture ? '0' : '1px';
		return `${l} ${r} ${r} ${l}`; // TL TR BR BL
	}

	// ---------------------------------------------------------------------------
	// Svelte action: mounts the CodeMirror notation editor into the host element.
	// CodeMirror is dynamically imported ($lib/utils/notationEditor) so its
	// ~287KB stays out of the planner route chunk — the chunk's parse/compile
	// was the dominant navigation mount block (perf audit 2026-07-10, F2).
	// Until the editor chunk lands, the host shows the raw notation in a
	// placeholder styled to match the editor's theme (same box, font, padding),
	// so the first paint is visually identical and there is no layout shift.
	// Two-way sync once live: editor → notation via its change callback;
	// notation → editor via the update() hook (which no-ops on equal values, so
	// the editor's own changes don't cause a redundant round-trip).
	// ---------------------------------------------------------------------------

	/**
	 * The live editor, once its chunk lands — the composer's history buttons
	 * need a handle on it, and only this action has one.
	 *
	 * ⚠ `historyTick` is what makes `canUndo`/`canRedo` REACTIVE. CodeMirror's
	 * undo depth is its own state, invisible to Svelte, so the two deriveds
	 * below read this counter to know when to ask again. It is bumped on BOTH
	 * sync directions on purpose: a programmatic write (a bench or Builder edit,
	 * a swap) runs through the action's update() with the change callback
	 * suppressed, so counting only typed changes would leave the Undo button
	 * greyed out immediately after the one edit most likely to want it.
	 */
	let editorApi = $state<NotationEditor | null>(null);

	// ── THE DOCK (⚓ Nate 2026-10-14, the mobile round, item 6) ──────────────
	// Below `compact` the composer is not a row in the page: it is PINNED to the
	// bottom of the screen over the chart, and when you are not typing it
	// collapses to a one-line strip showing the END of the notation — the part
	// you were just writing. ⚓ ANY tap outside it collapses it, a bar included
	// (Nate: touching a bar to read its details is exactly when you are done
	// typing); the tap still lands, so the bar's tooltip opens too.
	//
	// ⚠ It is MOVED to <body> while docked, never re-mounted — the editor (and
	// its undo history) is one instance either way. It has to leave the page:
	// the tool pan TRANSFORMS the page layer, and a transformed ancestor makes
	// `position: fixed` relative to itself. It moves BACK the moment the planner
	// stops being the route, so on a pan away it slides out with its page
	// rather than hanging over the next tool.
	let docked = $derived(below('compact'));
	let onPlanner = $derived(page.url.pathname.startsWith(resolve('/planner')));
	let dockOn = $derived(docked && onPlanner);
	let dockOpen = $state(false);
	/** ⚠️ Chrome on iOS can widen its address pill over the page AFTER the
	 *  keyboard lands and never tell the page (Nate's phone: the late
	 *  re-measure did not catch it), covering the key row. Its UA says `CriOS`.
	 *  There the open dock carries extra bottom padding the pill can cover
	 *  instead — breathing room when the pill stays down. */
	const iosChrome = typeof navigator !== 'undefined' && /CriOS/.test(navigator.userAgent);
	/** The history buttons' shortcut hint. CodeMirror's keymap is `Mod-z`,
	 *  which is Ctrl off Apple platforms. Mac on the first paint, read at mount. */
	let isMac = $state(true);
	onMount(() => {
		isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
	});
	/** px a finger may travel and still count as a tap (dock collapse, key row). */
	const TAP_SLOP = 10;
	let composerEl = $state<HTMLElement | null>(null);

	// The toast home sits ABOVE the composer (notices §3.2): it is the thing
	// at the bottom of the planner on every width (the phone's dock, the
	// desk's editor), and a toast over it would cover what is being typed.
	// Published as --notice-floor; read by NoticeRegion.
	$effect(() => {
		const el = composerEl;
		if (!el) return;
		const root = document.documentElement;
		const set = () => {
			const top = el.getBoundingClientRect().top;
			const floor = innerHeight - top;
			// Only while it really is at the bottom (not scrolled up mid-page).
			if (floor > 0 && floor < innerHeight / 2)
				root.style.setProperty('--notice-floor', `${floor + 12}px`);
			else root.style.removeProperty('--notice-floor');
		};
		const ro = new ResizeObserver(set);
		ro.observe(el);
		set();
		addEventListener('resize', set);
		addEventListener('scroll', set, true);
		return () => {
			ro.disconnect();
			removeEventListener('resize', set);
			removeEventListener('scroll', set, true);
			root.style.removeProperty('--notice-floor');
		};
	});

	// ── THE PINNED COMPOSER (responsive sweep 2026-10-15, §3 item 10) ─────────
	// Above `toolMin` the composer is `position: sticky; bottom` (see the CSS),
	// so at a laptop height you can type without scrolling band B, the ruler and
	// the top bench cards away. It only PAINTS a plate while it is actually
	// pinned — at rest at the end of the page it is the bare row it always was,
	// which is why 1080p and up see no change at all. CSS cannot ask "am I
	// stuck" in Safari, so this does: the composer is .rp-root's LAST flow
	// child, so its box ends where .rp-root's does unless sticky has lifted it.
	// ⚠ The answer may change PAINT only, never a size: anything that moved the
	// composer's height would move the page's, and the answer with it.
	let composerPinned = $state(false);
	function pinWatch(node: HTMLElement) {
		// ⚠ Read BEFORE `dockable` runs (it is listed first on the element):
		// the dock moves this node to <body>, and then it has no page to end in.
		const root = node.parentElement;
		let raf = 0;
		const measure = () => {
			raf = 0;
			if (!root || node.parentElement !== root) {
				composerPinned = false;
				return;
			}
			const lifted = root.getBoundingClientRect().bottom - node.getBoundingClientRect().bottom;
			composerPinned = getComputedStyle(node).position === 'sticky' && lifted > 0.5;
		};
		const schedule = () => {
			if (!raf) raf = requestAnimationFrame(measure);
		};
		// Capture: the scroller is .tool-shell, and a scroll event does not bubble.
		document.addEventListener('scroll', schedule, { capture: true, passive: true });
		window.addEventListener('resize', schedule);
		const ro = new ResizeObserver(schedule);
		if (root) ro.observe(root);
		schedule();
		return {
			destroy() {
				document.removeEventListener('scroll', schedule, { capture: true });
				window.removeEventListener('resize', schedule);
				ro.disconnect();
				if (raf) cancelAnimationFrame(raf);
			}
		};
	}
	/** How far the on-screen keyboard reaches up the screen. iOS does not
	 *  shrink the layout viewport for the keyboard, so a `bottom: 0` dock sits
	 *  BEHIND it; the visual viewport is the only honest measure. */
	let keyboardInset = $state(0);

	/**
	 * The collapsed strip's text: the notation's LAST non-empty line, painted
	 * the way the editor paints it (⚓ Nate 2026-10-14). The same two answers
	 * the editor reads — the tokenizer's kinds, and the parse's per-token tint
	 * (`notationTints`, keyed by source range) — so a token wears the colour the
	 * chart resolved for it. Gaps between tokens ride along as plain text.
	 */
	type TailSpan = { text: string; kind: 'char' | 'sep' | 'plain'; color?: string };
	let tailSpans = $derived.by((): TailSpan[] => {
		const lines = [...notation.matchAll(/[^\n]*\S[^\n]*/g)];
		const last = lines.at(-1);
		if (!last || last.index === undefined) return [];
		const from = last.index;
		const to = from + last[0].length;
		const tint: Record<string, string | undefined> = {};
		for (const t of notationTints(docRotation))
			tint[`${t.from}:${t.to}`] = t.element ? elementPalette(t.element).main : undefined;
		const spans: TailSpan[] = [];
		let at = from;
		for (const tok of tokenizeNotation(notation)) {
			if (tok.to <= from || tok.from >= to) continue;
			if (tok.from > at) spans.push({ text: notation.slice(at, tok.from), kind: 'plain' });
			const kind = tok.kind === 'character' ? 'char' : tok.kind === 'separator' ? 'sep' : 'plain';
			spans.push({ text: tok.text, kind, color: tint[`${tok.from}:${tok.to}`] });
			at = tok.to;
		}
		if (at < to) spans.push({ text: notation.slice(at, to), kind: 'plain' });
		return spans;
	});

	/** The action's own placer, so the navigation hooks below can move the
	 *  node without waiting on an effect. */
	let dockPlace: ((on: boolean) => void) | null = null;

	// ⚠️ WHY NOT JUST `dockOn`: leaving the planner does not destroy this page —
	// the tool pan keeps it alive for the slide-out, and Svelte PAUSES the
	// effects of a block on its way out, so `dockOn` never re-runs and the dock
	// stayed pinned over the Team Builder (measured). These hooks are plain
	// callbacks registered at mount, not effects, so they still fire: leaving
	// puts the composer back in its page (it slides out with it), arriving
	// re-docks it — on a revival the action's `update` would not run, because
	// `dockOn` is the same value it was before the pause.
	beforeNavigate((nav) => {
		if (!nav.to?.url.pathname.startsWith(resolve('/planner'))) {
			dockOpen = false;
			dockPlace?.(false);
			// The transport's clock and scheduler are not effects either, so the
			// pause does not reach them: without this the count-in and the press
			// tones play on over the next tool until the page is destroyed.
			playback.stop();
		}
	});
	afterNavigate((nav) => {
		if (nav.to?.url.pathname.startsWith(resolve('/planner'))) dockPlace?.(docked);
	});

	function dockable(node: HTMLElement, on: boolean) {
		const anchor = document.createComment('composer');
		node.before(anchor);
		const inTool = !!node.closest('.tool-shell');
		const place = (d: boolean) => {
			if (d && node.parentNode !== document.body) {
				document.body.appendChild(node);
				// The accent zone rides along, as `portal` does for popovers.
				if (inTool) node.dataset.zone = 'tool';
			} else if (!d && node.parentNode === document.body) {
				anchor.after(node);
				delete node.dataset.zone;
			}
		};
		place(on);
		dockPlace = place;
		return {
			update: place,
			destroy() {
				dockPlace = null;
				if (node.parentNode === document.body) node.remove();
				anchor.remove();
			}
		};
	}

	// ── THE KEY ROW (⚓ Nate 2026-10-14) ─────────────────────────────────────
	// A phone keyboard cannot be given a ">" key — a page may only choose among
	// the system layouts — so the dock carries its own row above it, and the
	// row READS THE SEGMENT THE CARET IS IN:
	//   · a segment with no character yet → the team's names (the notation's
	//     own, so it is the team the planner derived — single truth);
	//   · inside a character's segment → ">", that character's casts (the
	//     eager index's `casts`, the same list the editor's lint reads, so
	//     Flins offers sQ), N, C, and P when the kit has a plunge;
	//   · right after an N → the digits 1–5 first.
	// A key types what a keystroke would (one undoable edit), spacing itself.
	let cursorPos = $state(0);
	type DockKey = { label: string; insert: string };
	let dockKeys = $derived.by((): DockKey[] => {
		const pos = Math.min(cursorPos, notation.length);
		const tokens = tokenizeNotation(notation);
		const before = tokens.filter((t) => t.to <= pos);
		const segStart = before.findLast((t) => t.kind === 'separator')?.to ?? 0;
		const name = before.findLast((t) => t.kind === 'character' && t.from >= segStart)?.text;
		const prev = notation.slice(0, pos).trimEnd().at(-1) ?? '';
		const gap = /\s/.test(notation[pos - 1] ?? ' ') ? '' : ' ';
		const sep: DockKey = { label: '>', insert: `${gap}> ` };
		if (!name) {
			const team = [
				...new Set(tokens.filter((t) => t.kind === 'character').map((t) => t.text))
			].slice(0, 4);
			return [
				...team.map((n) => ({ label: n, insert: `${gap}${n} ` })),
				...(pos > 0 && prev !== '>' ? [sep] : [])
			];
		}
		const entry = getIndexEntryByDisplayName(name);
		const tok = (t: string): DockKey => ({ label: t, insert: `${gap}${t}` });
		// ⚓ Nate: `tE` and `pE` are KQM's other spellings of a plain `E` (the
		// parser times all three alike — castTokens.ts adds them to every
		// skill), so the row offers the one spelling.
		const ALIASES = ['tE', 'pE'];
		const casts = entry?.casts?.length
			? entry.casts.filter((c) => !ALIASES.includes(c))
			: ['E', 'Q'];
		const keys = [sep, ...casts.map(tok), tok('N'), tok('C'), ...(entry?.plunge ? [tok('P')] : [])];
		if (prev === 'N' && notation[pos - 1] === 'N')
			return [...['1', '2', '3', '4', '5'].map((d) => ({ label: d, insert: d })), ...keys];
		return keys;
	});

	function pressDockKey(key: DockKey) {
		editorApi?.insert(key.insert);
	}
	/** ⚠️ A key fires on LIFT, not on `click`: its pointerdown is cancelled so
	 *  the press never takes focus from the editor (the keyboard stays up), and
	 *  in WebKit's touch path that swallowed the click as well (measured). The
	 *  tap rule is the dock's — lifted within TAP_SLOP — so swiping the row
	 *  sideways never types. `click` stays for KEYBOARD activation only
	 *  (`detail === 0`). */
	let keyDown: { id: number; x: number; y: number } | null = null;
	function keyPointerDown(e: PointerEvent) {
		e.preventDefault();
		keyDown = { id: e.pointerId, x: e.clientX, y: e.clientY };
	}
	function keyPointerUp(e: PointerEvent, key: DockKey) {
		const d = keyDown;
		keyDown = null;
		if (!d || d.id !== e.pointerId) return;
		if (Math.hypot(e.clientX - d.x, e.clientY - d.y) <= TAP_SLOP) pressDockKey(key);
	}

	/** An invisible input the strip focuses INSIDE the tap. ⚠️ iOS raises the
	 *  keyboard only for a focus made during the user's gesture, and the editor
	 *  is not shown until the next render — so focusing it a frame later (the
	 *  first cut) opened the box with no keyboard and cost a second tap
	 *  (⚓ Nate, on his phone). Focus moving from this input to the editor keeps
	 *  the keyboard up. 16px so iOS has nothing to zoom into. */
	let dockProxy = $state<HTMLInputElement | null>(null);

	async function openDock() {
		dockProxy?.focus();
		dockOpen = true;
		// ⚠️ Chrome on iOS sometimes widens its address pill over the page a
		// beat AFTER the keyboard lands (Nate's phone), and the key row went
		// under it. If that settles into the visual viewport with no event of
		// its own, a late look catches it; if Chrome draws over the page
		// without telling it, nothing here can — see the round record.
		for (const ms of [150, 400, 800]) setTimeout(measureKeyboard, ms);
		await tick();
		const content = composerEl?.querySelector<HTMLElement>('.cm-content');
		content?.focus();
		const sel = window.getSelection();
		if (content && sel) {
			sel.selectAllChildren(content);
			sel.collapseToEnd();
		}
	}

	// ⚓ A TAP collapses, a DRAG does not (Nate 2026-10-14, on his phone): you
	// should be able to scroll the chart up, down and along with the keyboard
	// still up. A tap is a press that lifts within TAP_SLOP of where it landed;
	// a scroll never gets that far — the browser takes the touch over and sends
	// `pointercancel` instead of `pointerup`. ⛔ Not `click`: iOS fires it only
	// on elements that look clickable, so a tap on bare chart would not count.
	// Capture phase, and the tap is never stopped — a bar's tooltip still opens.
	$effect(() => {
		if (!dockOn || !dockOpen) return;
		let down: { id: number; x: number; y: number } | null = null;
		const outside = (t: EventTarget | null) =>
			t instanceof Element && !composerEl?.contains(t) && !t.closest('.cm-tooltip');
		const onDown = (e: PointerEvent) => {
			down = outside(e.target) ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
		};
		const onUp = (e: PointerEvent) => {
			if (!down || e.pointerId !== down.id) return;
			const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
			down = null;
			if (moved > TAP_SLOP) return;
			dockOpen = false;
			(document.activeElement as HTMLElement | null)?.blur();
		};
		const onCancel = () => (down = null);
		document.addEventListener('pointerdown', onDown, true);
		document.addEventListener('pointerup', onUp, true);
		document.addEventListener('pointercancel', onCancel, true);
		return () => {
			document.removeEventListener('pointerdown', onDown, true);
			document.removeEventListener('pointerup', onUp, true);
			document.removeEventListener('pointercancel', onCancel, true);
		};
	});

	function measureKeyboard() {
		const vv = window.visualViewport;
		if (vv) keyboardInset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
	}
	$effect(() => {
		if (!dockOn || !window.visualViewport) return;
		const vv = window.visualViewport;
		const measure = measureKeyboard;
		measure();
		vv.addEventListener('resize', measure);
		vv.addEventListener('scroll', measure);
		return () => {
			vv.removeEventListener('resize', measure);
			vv.removeEventListener('scroll', measure);
			keyboardInset = 0;
		};
	});
	let historyTick = $state(0);
	let canUndo = $derived.by(() => {
		void historyTick;
		return editorApi?.canUndo() ?? false;
	});
	let canRedo = $derived.by(() => {
		void historyTick;
		return editorApi?.canRedo() ?? false;
	});

	// ⚓ THE NOTATION WEARS THE CHART'S COLOURS (⚓ Nate 2026-09-24). Each token
	// is tinted with what the parse resolved for it — infusions, stances, party-
	// resolved elements, swings that land nothing — rather than the editor's
	// text-only guess. `doc` travels with the list so the editor can refuse (or
	// hold) a parse of text it does not show. See `$lib/timeline/notationTints`.
	$effect(() => {
		const api = editorApi;
		if (!api) return;
		const doc = notation;
		// A tab switch swaps the editor's whole state, tints included; two tabs
		// with the same text would otherwise leave the fresh one untinted.
		void tabId;
		// The DOCUMENT's events: a tint is a source range in the editor, and the
		// stream's copies have ranges past the text's end.
		const tints = notationTints(docRotation);
		untrack(() => api.setTints(doc, tints));
	});

	function mountEditor(node: HTMLElement, doc: { value: string; key: string; seats: Seating }) {
		let editor: NotationEditor | null = null;
		let destroyed = false;
		// The latest external value, replayed into the editor when it arrives
		// (the user can't type into the placeholder, but tab switches / URL
		// imports can update notation while the chunk is still loading).
		let pendingValue = doc.value;
		let pendingKey = doc.key;
		let pendingSeats = doc.seats;

		const placeholder = document.createElement('div');
		placeholder.className = 'rp-notation-placeholder';
		placeholder.textContent = doc.value;
		node.appendChild(placeholder);

		import('$lib/utils/notationEditor').then(({ createNotationEditor }) => {
			if (destroyed) return;
			placeholder.remove();
			editor = createNotationEditor(
				node,
				pendingValue,
				(v, s) => {
					// Seats FIRST: the store's notation setter then finds them settled
					// (the seat rule is idempotent), so the two writes cannot disagree.
					seating = s;
					notation = v;
					historyTick++;
				},
				pendingKey,
				(pos) => (cursorPos = pos),
				pendingSeats
			);
			editorApi = editor;
			historyTick++;
		});

		return {
			// ⚠ UNTRACKED. Svelte runs an action's update() inside the effect that
			// reads its parameter, and `historyTick++` reads the counter it writes.
			// A string parameter hid that (an equal value skips the call); this
			// object is new on every run, so a tracked body loops until Svelte
			// throws `effect_update_depth_exceeded`.
			update(next: { value: string; key: string; seats: Seating }) {
				untrack(() => {
					pendingValue = next.value;
					pendingKey = next.key;
					pendingSeats = next.seats;
					if (editor) {
						editor.showDocument(next.key, next.value, next.seats);
						historyTick++;
					} else placeholder.textContent = next.value;
				});
			},
			destroy() {
				destroyed = true;
				if (editorApi === editor) editorApi = null;
				editor?.destroy();
				editor = null;
			}
		};
	}

	// ---------------------------------------------------------------------------
	// Effective loadout / constellation resolution (tab Layer-2 over roster Layer-1)
	// ---------------------------------------------------------------------------

	function effectiveLoadoutEntry(charId: string): LoadoutEntry {
		return resolveEntry(inheritedLoadout[charId], tabLoadout[charId]);
	}

	function effectiveConLevel(charId: string): number {
		return tabCon[charId] ?? $constellations[charId] ?? 0;
	}

	// The caveat panel left in the aside-column round (2026-08-08): the notes are
	// the surface's ASIDE COLUMN now — <RotationNotes>, a box beside this one,
	// fed by the planner page. Nothing about them was ever chart geometry, and
	// keeping them here is what forced the panel to be an absolute overlay with
	// a matching margin on the tracks. The only publication left is the readout
	// below, which genuinely is the chart's to make (see plannerView for the
	// direction-of-flow contract).

	$effect(() => {
		// ⚓ Published in SECONDS: its only consumer is band B's `{…}s` readout on
		// the planner page, so the conversion belongs at the publish, not there.
		// The DOCUMENT's: band B's Total says how long one lap runs whatever the
		// chart is drawing.
		pv.totalDuration = docRotation.totalDuration / FPS;
		// The presses and the end, for the transport (playback round, 2026-09-29)
		// — the same publish, the same direction of flow, and seconds for the
		// same reason. These are the DRAWN rotation's: with Repeat lit the cursor
		// runs the stream and the tones sound every lap's presses.
		pv.playbackEnd = rotation.totalDuration / FPS;
		pv.playbackCues = cuesFor(rotation);
	});

	// ══ THE PLAYHEAD (playback round, 2026-09-29) ══════════════════════════════
	//
	// ⚓ ONE CURSOR, TWO SCROLLERS. The header (aura lane + ruler) and the tracks
	// are separate scroll containers mirrored by scrollLeft, so the cursor is
	// drawn once in each at the same x — exactly as the aura crosshair is drawn
	// in the header and read against the tracks below it. Both read
	// `playback.t`; nothing here owns the clock (`$lib/playback`).
	//
	// Shown while playing, and while parked anywhere but the start: a paused
	// cursor is where you were, and a cursor at 0 on an idle chart is furniture.
	// The count-in runs at negative t and is drawn AT zero — the cursor waits on
	// the first press while the beats count it in.
	let playheadX = $derived(
		playback.playing || playback.t > 0 ? projectX(Math.max(0, playback.t), scale) : null
	);

	// ⚓ PAGE-JUMP, NOT SMOOTH FOLLOW. When the cursor leaves the viewport the
	// tracks jump so it re-enters near the left edge, with a run of chart ahead
	// of it — the way a score turns a page. A continuous follow would write
	// scrollLeft on every frame into a scroller with a documented tear against
	// momentum scrolling (see onTrackScroll), and would also take the scroll
	// position away from a reader who has just dragged it. `behavior: 'auto'`
	// on purpose: a page turn is instant, and smooth scrolling is rAF-driven,
	// which is exactly what a hidden tab freezes.
	const FOLLOW_LEAD = 0.12;
	$effect(() => {
		if (!playback.playing || playheadX === null) return;
		const el = trackScrollEl;
		if (!el) return;
		// In the scroller's own coordinates, past the reach padding; the page
		// turns at the CONTENT viewport's edges, not in the fades beyond them.
		const x = playheadX + trackPad.left;
		const viewW = el.clientWidth - trackPad.left - trackPad.right;
		const left = el.scrollLeft + trackPad.left;
		if (x >= left && x <= left + viewW) return;
		el.scrollTo({
			left: Math.max(0, x - trackPad.left - viewW * FOLLOW_LEAD),
			behavior: 'auto'
		});
	});

	// Leaving the tool stops the transport: a cursor keeping time on a chart
	// nobody can see is a timer nobody asked for. ⚠ An effect cleanup, not
	// onDestroy, for the tool-page revival (A→B→A) — see plannerView. It runs
	// only at a real destroy; the navigation itself is `beforeNavigate` above.
	$effect(() => () => playback.stop());

	// ⛔ `pv.hasAura = showAuraLane` RETIRED (2026-08-17). It was the notes panel's
	// second gate, so the standing aura-modelling block could reach a team with no
	// caveats; that block moved to the head of the aura LOG, and the flag had no
	// other reader. ⚠ `hasAuraLog` below is NOT its replacement — it asks whether
	// there is anything to read, not whether the lane is drawn.

	// ══ THE AURA LOG, PUBLISHED TO THE SIDE COLUMN (2026-08-17) ═══════════════
	// ⚠ `hasAuraLog` reads `rotation.applications`, NOT the lane: the lane is
	// gated on two toggles and this answers "is there anything to read", which
	// must be true before the button that opens the panel is enabled. Gating the
	// button on the panel's own state would make it un-openable.
	$effect(() => {
		pv.hasAuraLog = rotation.applications.length > 0;
	});
	$effect(() => {
		// ⚠ EMPTY UNLESS THE PANEL IS OPEN. A heavy rotation makes a few hundred
		// rows, and this runs on every keystroke; `laneSource` is already gated the
		// same way, so with the panel shut neither the walk nor this projection
		// happens at all.
		pv.auraLog = pv.showLog ? buildAuraLog(laneSource, displayNameOf) : [];
	});
	$effect(() => {
		// Content went away under an open panel — the same courtesy the notes get.
		// ⛔ `closeIfShowing`, not a bare assignment: an empty rotation must not
		// close the NOTES panel as a side effect.
		if (!pv.hasAuraLog) pv.closeIfShowing('log');
	});

	// ---------------------------------------------------------------------------
	// Tooltip
	// ---------------------------------------------------------------------------

	type TooltipPayload = {
		/** ⚠ `TooltipEffectRow`, not `MergedEffectDisplay`: a row's `stat` may be
		 *  PROSE rather than a `Stat` key, which BuffTooltip has always allowed
		 *  and which the aura lane needs — "Peak · 1.60U" names no stat and has
		 *  no icon. `MergedEffectDisplay` is assignable to it, so every existing
		 *  buff call site is unchanged. */
		effects: TooltipEffectRow[];
		sourceLabel: string;
		isMutuallyExclusive: boolean;
		duration?: number;
		procCooldown?: number;
	};
	type TooltipState = TooltipPayload & { x: number; y: number; above: boolean };

	let tooltip = $state<TooltipState | null>(null);

	/**
	 * Anchor the tooltip to the hovered element's centre — the right answer for a
	 * BAR, whose whole width is the thing being described.
	 *
	 * ⚠ `anchorToCursor` is for the aura plot, and it is not a preference: that
	 * element spans the entire track, so its centre is halfway along the rotation
	 * and the readout would appear nowhere near the time it reports. There the
	 * pointer IS the subject.
	 */
	function showTooltip(e: MouseEvent, data: TooltipPayload, anchorToCursor = false) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const above = rect.top > 80;
		// The centre of the bar's VISIBLE part — a long bar running off either
		// edge anchors on what is on screen (⚓ Nate 2026-10-14). BuffTooltip
		// then keeps the whole box inside the viewport.
		const left = Math.max(rect.left, 0);
		const right = Math.min(rect.right, window.innerWidth);
		tooltip = {
			...data,
			x: anchorToCursor
				? e.clientX
				: right > left
					? (left + right) / 2
					: rect.left + rect.width / 2,
			y: above ? rect.top - 6 : rect.bottom + 6,
			above
		};
	}

	function hideTooltip() {
		tooltip = null;
	}

	// ══ HOVER PEEKS, CLICK INSPECTS (inspector round, 2026-10-23; design §7) ══
	// Under the switch a click on a buff bar opens it in the inspector pane. The
	// pane prints what the tooltip prints — ONE payload builder per lane, read by
	// both — plus where the bar sits and who it lands on.
	//
	// ⚓ The pick is a REFERENCE (`InspectTarget`), and this is where it is
	// re-resolved: every rebuild rebuilds the page from the rows the chart is
	// drawing NOW, and a bar an edit removed drops the page back to the team.

	type ReceivedRow = (typeof charReceivedBuffRows)[number];
	type TeamRow = (typeof teamBuffRows)[number];
	type MoonRow = (typeof moonsignRows)[number];

	/** A stepped bar's payload is the step AT a frame — the hover's rule. */
	function stepPayload(
		bar: { start: number; end: number; steps?: BarStep[] },
		label: string,
		at: number
	): TooltipPayload | null {
		if (!bar.steps?.length) return null;
		const st = stepAt(bar.steps, at);
		return {
			sourceLabel: `${label} ×${st.count}`,
			effects: st.effects,
			isMutuallyExclusive: false
		};
	}

	function receivedPayload(bar: ReceivedRow['bars'][number]): TooltipPayload {
		return {
			sourceLabel: bar.sourceLabel,
			effects: bar.effects,
			isMutuallyExclusive: bar.isMutuallyExclusive,
			duration: bar.duration,
			procCooldown: bar.procCooldown
		};
	}

	function teamPayload(subrow: TeamRow, bar: TeamRow['bars'][number]): TooltipPayload {
		return {
			sourceLabel: subrow.sourceLabel,
			// ⚓ THE COUNT UNDER THE VALUE. A Polestar Field bar's number is a
			// payout, and the ledger that paid it is the thing a player recognises —
			// Genshin shows the count on screen while you play. It rides BELOW the
			// stats rather than replacing them.
			// ⚠️ It is the count from the PREVIOUS 4s, which is what set this bar;
			// the in-game counter is meanwhile filling toward the next grant. Two
			// clocks — this is the one this bar can be checked against.
			effects:
				bar.stacks === undefined
					? bar.effects
					: [
							...bar.effects,
							{ stat: 'Recorded hits', displayValue: `${bar.stacks} in the previous 4s` }
						],
			isMutuallyExclusive: false,
			duration: bar.end - bar.start
		};
	}

	function moonPayload(row: MoonRow, win: MoonRow['windows'][number]): TooltipPayload {
		const msChar = slotCharacters[row.slotIdx];
		return {
			sourceLabel: `Ascendant Gleam — ${msChar?.displayName ?? '?'}`,
			effects: [moonsignScaling(msChar?.element)],
			isMutuallyExclusive: false,
			duration: win.duration
		};
	}

	/** The pinned bar, resolved against the rows on screen now — or null when
	 *  the edit that triggered this rebuild took it away. */
	let inspectedTip = $derived.by((): InspectedBar | null => {
		const t = pv.target;
		if (!$nextLayout || t?.kind !== 'bar') return null;
		if (t.lane === 'received') {
			const row = charReceivedBuffRows.find((r) => r.key === t.row);
			const bar = row?.bars.find((b) => b.start === t.start);
			if (!row || !bar) return null;
			return {
				...(stepPayload(bar, bar.sourceLabel, t.at) ?? receivedPayload(bar)),
				on: getLoadedCharacter(row.characterId)?.displayName ?? row.characterId,
				start: bar.start,
				end: bar.end
			};
		}
		if (t.lane === 'team') {
			const row = teamBuffRows.find((r) => r.key === t.row);
			const bar = row?.bars.find((b) => b.start === t.start);
			if (!row || !bar) return null;
			return {
				...(stepPayload(bar, row.sourceLabel, t.at) ?? teamPayload(row, bar)),
				on: null,
				start: bar.start,
				end: bar.end
			};
		}
		const row = moonsignRows.find((r) => String(r.slotIdx) === t.row);
		const win = row?.windows.find((w) => w.start === t.start);
		if (!row || !win) return null;
		return { ...moonPayload(row, win), on: null, start: win.start, end: win.start + win.duration };
	});

	// Publish for the page, which renders the pane; and drop a pick whose bar is
	// gone. ⚠ Only a BAR pick is dropped — a character pick is the bench's.
	$effect(() => {
		pv.inspectedTip = inspectedTip;
		if ($nextLayout && pv.target?.kind === 'bar' && !inspectedTip) pv.target = null;
	});

	// ── Casts (stage 2) ─────────────────────────────────────────────────────
	// An E or Q pill opens its CAST; a summon or shield bar opens the cast that
	// raised it — "a bar that says when an ability IS" (the Layers law's half
	// that stays) is answered by the ability. Resolved against `rotation` (what
	// is DRAWN, laps included); the editor mark only for a token in the text.

	type CastEv = Extract<(typeof rotation.events)[number], { kind: 'cast' }>;

	/** The latest cast of `ability` by `char` at or before `at` — whose summon
	 *  or shield a bar starting at `at` is. */
	function castAtOrBefore(char: string, ability: 'skill' | 'burst', at: number): CastEv | null {
		let best: CastEv | null = null;
		for (const ev of rotation.events) {
			if (ev.kind !== 'cast' || ev.characterId !== char || ev.ability !== ability) continue;
			if (ev.time <= at && (!best || ev.time >= best.time)) best = ev;
		}
		return best;
	}

	let pickedCastEvent = $derived.by((): CastEv | null => {
		const t = pv.target;
		if (!$nextLayout || t?.kind !== 'cast') return null;
		for (const ev of rotation.events)
			if (
				ev.kind === 'cast' &&
				ev.characterId === t.char &&
				ev.ability === t.ability &&
				ev.time === t.start
			)
				return ev;
		return null;
	});

	let inspectedCast = $derived.by((): InspectedCast | null => {
		const ev = pickedCastEvent;
		if (!ev) return null;
		const char = getLoadedCharacter(ev.characterId);
		const ability = char?.abilities.find((a) => a.id === ev.abilityId);
		const raised = summonSubrows
			.filter(
				(r) =>
					r.characterId === ev.characterId &&
					r.bars.some((b) => castAtOrBefore(ev.characterId, b.source, b.start)?.id === ev.id)
			)
			.map((r) => r.label);
		const src = ev.src;
		const standIn =
			src && src.to <= notation.length
				? (flagNotation(notation, seating?.seats).find(
						(f) => f.reason === 'approximate-cast' && f.from < src.to && f.to > src.from
					)?.message ?? null)
				: null;
		return {
			characterId: ev.characterId,
			displayName: char?.displayName ?? ev.characterId,
			element: char?.element ?? '',
			ability: ev.ability,
			abilityName:
				ability?.name ?? (ev.ability === 'skill' ? 'Elemental Skill' : 'Elemental Burst'),
			variantLabel: ev.variantLabel,
			label: ev.label,
			time: ev.time,
			castTime: ev.castTime,
			uptime: ev.uptime,
			cooldown: ev.cooldown,
			readyAt: ev.readyAt,
			cdReduced: ev.cdReduced,
			energyCost: ability && 'energyCost' in ability ? ability.energyCost : undefined,
			charges: ability && 'charges' in ability ? ability.charges : undefined,
			raised: [...new Set(raised)],
			standIn,
			uncurated: char != null && !isCurated(char) && char.id !== 'blank'
		};
	});

	$effect(() => {
		pv.inspectedCast = inspectedCast;
		if ($nextLayout && pv.target?.kind === 'cast' && !inspectedCast) pv.target = null;
	});

	// The token that made the picked cast wears the ring in the editor too.
	$effect(() => {
		const api = editorApi;
		if (!api) return;
		const src = pickedCastEvent?.src;
		const picked = pv.inspectedCastKey !== null && src && src.to <= notation.length ? src : null;
		const doc = notation;
		untrack(() => api.setPicked(doc, picked ? { from: picked.from, to: picked.to } : null));
	});

	function inspectCast(char: string | undefined, ability: 'skill' | 'burst', start: number) {
		if (!$nextLayout || !char) return;
		hideTooltip();
		pv.inspect({ kind: 'cast', char, ability, start });
	}

	/** A summon or shield bar opens the cast that raised it. */
	function inspectRaised(char: string, ability: 'skill' | 'burst', at: number) {
		const ev = castAtOrBefore(char, ability, at);
		if (ev) inspectCast(char, ability, ev.time);
	}

	/** The frame under the pointer on a bar — what a stepped bar reads. */
	function frameUnder(e: MouseEvent, start: number, end: number): number {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		return start + ((e.clientX - rect.left) / Math.max(1, rect.width)) * (end - start);
	}

	function inspectBar(e: MouseEvent, lane: BarLane, row: string, start: number, end: number) {
		if (!$nextLayout) return;
		hideTooltip();
		pv.inspect({ kind: 'bar', lane, row, start, at: frameUnder(e, start, end) });
	}

	// ── The aura plot's crosshair readout ────────────────────────────────────
	//
	// ⚓ OVERLAID SERIES CANNOT BE HOVERED INDIVIDUALLY, and the answer is better
	// than the per-span tooltips the row form had: a vertical cursor reads out
	// EVERY aura on the target at one instant, which is the question a gauge
	// chart is actually asked. A per-series hit target would also have had to
	// pick a winner wherever two lines cross — exactly where the reader is most
	// likely to be pointing.
	/** Where the pointer is ON THE LANE, in seconds — set by the plot, by a tick
	 *  and by a reaction marker alike, so all three drive one focus. */
	let lanePointerSeconds = $state<number | null>(null);
	/**
	 * ⚓ ONE FOCUSED INSTANT, WHICHEVER SURFACE IS DRIVING (2026-08-17). The
	 * lane's pointer sets it — over the plot, over an application pip or over a
	 * reaction marker — and so does hovering a row in the side column's aura LOG.
	 * Everything that lights up on either surface reads THIS: the crosshair, the
	 * pips, the markers, and (through `pv.auraHover`) the log's own rows.
	 *
	 * ⚠ THE POINTER WINS. If it is on the lane, that is the authority; the log's
	 * hover only speaks when the lane's does not. ⛔ Never both at once — two
	 * cursors on one axis is a chart with two answers.
	 */
	let auraFocus = $derived(lanePointerSeconds ?? pv.logHover);
	let auraCursorX = $derived(auraFocus === null ? null : projectX(auraFocus, scale));
	/** How near the crosshair a discrete event counts as "here", in px. A
	 *  reaction is a point and the cursor is a pixel, so an instant-exact test
	 *  would answer "nothing here" everywhere except one column.
	 *  ⚠ DECLARED ABOVE ITS FIRST READER, not beside the handler that grew it: a
	 *  `$derived` is lazy but TypeScript still calls a const read above its
	 *  declaration a TDZ error, and it is right to. */
	const AURA_CROSSHAIR_REACH = 6;
	/** The crosshair's reach in SECONDS at the current zoom — one number for
	 *  "is this mark at the focused instant", shared with the log (see
	 *  `pv.auraHover`) so both surfaces agree on what counts as here. */
	let auraFocusReach = $derived(AURA_CROSSHAIR_REACH / scale);
	/** Is this instant the focused one? ⚠ A point test; a run uses `auraRunLit`. */
	const auraLit = (frames: number) =>
		auraFocus !== null && Math.abs(frames / FPS - auraFocus) <= auraFocusReach;
	/** A run has WIDTH, so containment rather than proximity — the same split the
	 *  log's rows make with `endTime`, and `auraReactionsAt` before them. */
	const auraRunLit = (from: number, to: number) =>
		auraFocus !== null &&
		auraFocus >= from / FPS - auraFocusReach &&
		auraFocus <= to / FPS + auraFocusReach;

	/**
	 * One marker's card. ⚠ A RUN IS SUMMARISED, NOT ENUMERATED: twelve
	 * Electro-Charged entries would print twelve identical rows, so a run says its
	 * span and its tick count and lists each distinct trigger once.
	 */
	function markerTooltip(marker: AuraMarker): TooltipPayload {
		return {
			sourceLabel:
				marker.count > 1
					? `Reaction · ${secondsLabel(marker.time)}–${secondsLabel(marker.endTime)}s`
					: `Reaction · ${secondsLabel(marker.time)}s`,
			// ⚠ ONE ROW PER REACTION, built in the projection so the uniqueness is
			// testable — see `auraMarkerRows` for the duplicate-key crash it closes.
			effects: auraMarkerRows(
				marker,
				(id) => getLoadedCharacter(id)?.displayName ?? '—'
			) satisfies TooltipEffectRow[],
			isMutuallyExclusive: false
		};
	}

	function onAuraMove(e: MouseEvent) {
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX - box.left;
		const frames = (x / scale) * FPS;
		lanePointerSeconds = frames / FPS;
		// ⚠ PUBLISHED IN SECONDS WITH ITS REACH, so the log can light the rows the
		// cursor is standing on. The reach is the same px→time conversion the
		// tooltip below makes, and it has to travel: at ZOOM_MIN one pixel is a
		// twentieth of a second and at ZOOM_MAX a hundred-and-twentieth, so a
		// tolerance decided in the log would be wrong at every zoom but one.
		pv.auraHover = { at: frames / FPS, reach: auraFocusReach };
		// ⚓ `gaugesAt` is gauge.ts's own interpolation over its own series — ⛔ not
		// a second reading of the trajectory. It wants SECONDS, which is what
		// `rotation.auraSeries` is in; the plot's frames are the projection's.
		const present = gaugesAt(rotation.auraSeries, frames / FPS);
		const rows: TooltipEffectRow[] = AURA_MOD_ORDER.filter((mod) => (present[mod] ?? 0) > 0.01).map(
			(mod) => ({
				stat: AURA_MOD_META[mod].label,
				displayValue: `${(present[mod] ?? 0).toFixed(2)}U`
			})
		);
		// ⚓ THE CROSSHAIR ANSWERS FOR THE MARKER ROW TOO (2026-08-17). Suppressing
		// a label that does not fit is only honest if the name is still reachable,
		// and this is the lane's own established answer to "too much to draw" —
		// the same cursor already exists because overlaid series cannot be hovered
		// individually. A RUN is a containment test (it has width); a discrete
		// reaction is a proximity test.
		// ⚠ Merged by name in the projection — two episodes of one reaction can
		// both be in reach, and two rows sharing a name is a duplicate key as well
		// as a worse card.
		for (const hit of auraReactionsAt(
			auraLane.markers,
			frames,
			(AURA_CROSSHAIR_REACH / scale) * FPS
		)) {
			rows.push({
				stat: hit.label,
				displayValue: hit.spans
					.map(([start, end]) =>
						end > start ? `${secondsLabel(start)}–${secondsLabel(end)}s` : `${secondsLabel(start)}s`
					)
					.join(', ')
			});
		}
		showTooltip(
			e,
			{
				sourceLabel: `${secondsLabel(frames)}s`,
				// ⚠ An empty aura is a REAL answer here and the one the lane exists to
				// show — a gap is where the next trigger has nothing to react with. It
				// says so rather than showing an empty card.
				effects: rows.length > 0 ? rows : [{ stat: 'No aura', displayValue: '—' }],
				isMutuallyExclusive: false
			},
			true
		);
	}

	function onAuraLeave() {
		lanePointerSeconds = null;
		pv.auraHover = null;
		hideTooltip();
	}

	/**
	 * A PIP OR A MARKER TAKES FOCUS TOO (⚓ NATE 2026-08-17). Hovering the plot
	 * already lit the log's rows; hovering the marks above it — which are the
	 * things the log is a list OF — did not, which made the link feel like it
	 * only worked in the anonymous part of the lane.
	 *
	 * ⚠ It publishes the same `{at, reach}` the plot does rather than an event
	 * identity, so the log's matching rule stays ONE rule. A consequence worth
	 * having: hovering a reaction marker also lights the application row above
	 * it, because they share a frame — which is exactly the pair the reader is
	 * asking about.
	 */
	function onAuraMarkEnter(frames: number) {
		lanePointerSeconds = frames / FPS;
		pv.auraHover = { at: frames / FPS, reach: auraFocusReach };
	}
	function onAuraMarkLeave() {
		lanePointerSeconds = null;
		pv.auraHover = null;
		hideTooltip();
	}

	/**
	 * "Take me there" — the aura log's rows call this through `plannerView`.
	 *
	 * ⚠ CENTRED, not scrolled-to-the-edge. A log row names an instant, and an
	 * instant parked against the left edge of the viewport has no context on the
	 * side you were reading toward; the middle is the only position that shows
	 * both. Clamped by the scroller itself, so an event near either end simply
	 * lands as close as the content allows.
	 * ⛔ Not `scrollIntoView` on a rendered mark: at low zoom several applications
	 * share a pixel and there is no element that IS the instant — the arithmetic
	 * is exact and the DOM is not.
	 */
	function scrollToSeconds(seconds: number) {
		if (!trackScrollEl) return;
		const el = trackScrollEl;
		const viewW = el.clientWidth - trackPad.left - trackPad.right;
		const target = projectX(seconds, scale) - viewW / 2;
		// ⚠ THE NATIVE OPTION, deliberately: it is one line and the scroller
		// clamps the target itself. ↻ 2026-10-18: the UA does NOT honour
		// `prefers-reduced-motion` for it (Chrome animates regardless), so the
		// behaviour asks $lib/motion's `scrollBehavior()`. A hand-rolled rAF
		// tween lived here for an hour on the strength of a measurement that turned out to be an ARTEFACT — `behavior: 'smooth'`
		// looked like a silent no-op on this element, and the real cause was that a
		// BACKGROUNDED TAB freezes requestAnimationFrame, which is what smooth
		// scrolling runs on. ⚠ Anything rAF-driven measures as broken when the tab
		// under test is not the front one; check that before blaming the code.
		el.scrollTo({ left: Math.max(0, target), behavior: scrollBehavior() });
	}
	$effect(() => {
		// ⚠ An effect with a cleanup, not onMount — see plannerView.scrollToSeconds
		// for the tool-page revival this survives.
		pv.scrollToSeconds = scrollToSeconds;
		// ⚠ The identity test stops a stale instance's teardown from clearing a
		// live handler — the tool-page revival case. It is safe to read here only
		// because the field is NOT `$state`; see plannerView for the effect loop
		// that taught us that.
		return () => {
			if (pv.scrollToSeconds === scrollToSeconds) pv.scrollToSeconds = null;
		};
	});

	// Ascendant Gleam (Moonsign Team Bonus): non-Moonsign members grant a
	// Lunar Reaction DMG Bonus on E/Q cast, scaling on a per-element stat
	// (docs/library/game/factions.md). Stat-dependent, so we display the
	// scaling rule rather than a computed value.
	//
	// Every window in the lane grants the same stat, so the lane's glyph is a
	// constant rather than a per-bar lookup — but it still comes from
	// BUFF_STAT_ICON, so the moonsign bars and the buff bars can never end up
	// showing different art for the same stat.
	const LUNAR_ICON = BUFF_STAT_ICON.lunarDmgBonus;

	function moonsignScaling(element: string | undefined): MergedEffectDisplay {
		if (element === 'hydro') {
			return { stat: 'lunarDmgBonus', displayValue: '+0.6% / 1,000 Max HP (cap 36%)' };
		}
		if (element === 'geo') {
			return { stat: 'lunarDmgBonus', displayValue: '+1% / 100 DEF (cap 36%)' };
		}
		if (element === 'anemo' || element === 'dendro') {
			return { stat: 'lunarDmgBonus', displayValue: '+2.25% / 100 EM (cap 36%)' };
		}
		// pyro / electro / cryo
		return { stat: 'lunarDmgBonus', displayValue: '+0.9% / 100 ATK (cap 36%)' };
	}

	// Dismiss the tooltip whenever the bar-generating inputs change: a reactive
	// rebuild (notation edit, zoom, constellation/loadout change) can remove or
	// reposition the hovered bar, and the browser never fires mouseleave on a
	// destroyed node — the tooltip would stay orphaned at its stale coordinates.
	$effect(() => {
		void rotation;
		void scale;
		tooltip = null;
	});
</script>

<!-- ============================================================ -->
<!--  Root                                                        -->
<!-- ============================================================ -->
<!-- ↻ TOOLBAR ROUND: the frame no longer insets ITSELF past the ribbon's
     column. It is rendered inside a ToolStack, whose padding-left holds the
     bands AND the surface off the strip together — one declaration instead of
     the three that had to agree. (TeamBonusesBlock still sits outside the
     stack at the content margin, below the strip's bottom end.) -->
<div
	class="rp-root ctx-dark"
	style:--rp-frame-pad-x="{FRAME_PAD_X}px"
	style:--rp-aux-bar-h="{AUX_LANE_BAR_H}px"
>
	<!-- ── Timeline chart frame ──────────────────────────────── -->
	<!-- The frame is ONE instrument with a fixed grammar: time axis (ruler +
	     view controls) on the TOP edge per DAW/NLE convention, rendered tracks
	     in the middle, and the notation COMPOSER (input + its KQM/PNG submit
	     pair) on the BOTTOM edge — the chat-app register: you write at the
	     bottom, the conversation renders above. -->
	<div class="rp-frame">
		<!-- The RIBBON's dock used to live here, hanging off this frame's padding
		     box. It moved up to the TOOL STACK in the toolbar round: the strip
		     now stands proud of the BANDS as well as the surface, so its anchor
		     has to span both — and one dock definition, shared by both benched
		     tools, replaces the two that had silently drifted apart. -->
		<!-- ── Ruler strip (full frame width, ABOVE the track area) ── -->
		<!-- Its own row so the notes panel can never push it: the ruler
		     viewport is a scroll FOLLOWER (overflow hidden, mirrored from the
		     track/ext scrollers), and the view cluster stays pinned to the
		     frame's right edge. -->
		<div class="rp-ruler-strip">
			<!-- The ruler takes the SAME edge roll-off as the tracks below it
			     (⚓ NATE 2026-08-11): it is the same instrument seen from the top,
			     and a faded bar under a hard-cut time axis reads as two objects.
			     Its scrollLeft is written programmatically, which still fires the
			     scroll events the action listens for. -->
			<!-- ⚓ THE UNIT DATUM'S LABELS, on the far side of the 0s line (⚓ NATE
			     2026-08-17) — in the frame's own left padding, which is the only room
			     that exists there: the ruler and the tracks below both begin at the
			     frame's padding box, and the axis has to stay aligned with the bars it
			     measures.
			     ⚠⚠ A SIBLING OF THE SCROLLER, NOT A CHILD OF THE PLOT. The first attempt
			     hung them off the plot's left edge, where `getBoundingClientRect`
			     reported a perfectly good box and NOTHING PAINTED — `.rp-ruler-scroll`
			     is `overflow: hidden` (that is what makes it a follower) and clips
			     anything outside its content box. ⛔ Don't move them back inside.
			     ⚓ Sitting outside the scroller also makes them a real LEGEND: they hold
			     still while the chart scrolls under them, which is what a datum reading
			     is for. -->
			{#if showAuraLane}
				<div
					class="rp-aura-units"
					style:top="{AURA_MARKER_H + AURA_TICK_H + AUX_LANE_PAD_Y}px"
					style:height="{AURA_PLOT_H}px"
					aria-hidden="true"
				>
					{#each auraUnitRules as u (u)}
						<span class="rp-aura-unit-label" style:top="{auraYOf(u)}px">{u}U</span>
					{/each}
				</div>
			{/if}
			<div
				class="rp-ruler-scroll scroll-fade-x"
				bind:this={rulerScrollEl}
				use:scrollFade={{ axis: 'x' }}
				onwheel={onHeaderWheel}
			>
				<!-- ONE width-sized box for the whole header, so the aura plot and the
				     ruler cannot disagree about how long the rotation is — they are two
				     readings of the same x axis and the width is stated once. -->
				<div class="rp-header-inner" style:width="{totalWidth}px">
					<!-- ══ TARGET AURA lane (L6; moved here 2026-08-17) ═══════════════
				     The first surface the gauge has. Three bands, top to bottom,
				     each closer to what it describes: reaction labels, then the
				     applications that caused them, then the auras those left
				     behind. Rendered whenever the Auras layer is on, even with
				     nothing landed yet (↻ 2026-10-22: it waited for the first
				     application and jumped the chart while you typed).

				     ⚓ NATE: IT SITS ABOVE THE TIME AXIS. It shipped at the bottom
				     of the track area, ~600px from the ticks it is read against;
				     here the ruler becomes a SHARED axis with a chart on either
				     side of it, which is the same DAW convention that put the axis
				     on the top edge in the first place.

				     ⚠ IT IS IN THE RULER'S STRIP, NOT THE TRACK SCROLLER, so it is
				     a scroll FOLLOWER: `rulerScrollEl.scrollLeft` is mirrored from
				     the tracks. That is what keeps the notes panel from pushing it
				     (the whole reason this strip exists) — and it costs the wheel,
				     which the strip's own handler forwards back. -->
					{#if showAuraLane}
						<div class="rp-aura-lane" style:height="{auraLaneH}px">
							<!-- Reaction markers. ⚓ THE PAYOFF: reactions have been in the
						     IR since P4 and drawn NOWHERE — the player saw the buff
						     bars a reaction caused but never the reaction itself. -->
							<div class="rp-aura-markers" style:height="{AURA_MARKER_H}px">
								<span class="rp-lane-name">Target aura</span>
								{#each auraLane.markers as marker (marker.time)}
									<!-- ⚓ A RUN IS ONE MARKER. A ticking reaction (Electro-Charged,
									     Lunar-Charged, Burning) collapses into a single marker whose
									     name carries the count — see `collapseReactionRuns`. The pip
									     marks the instant it STARTED; the span and the ticks are in
									     the tooltip and under the crosshair.
									     ⛔ It does NOT draw a bracket, and that was measured rather
									     than judged: at resting zoom the label is wider than the run
									     it names, so any extent from the pip reads as an underline of
									     the text. -->
									<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
									<div
										class="rp-aura-marker"
										class:rp-aura-marker--lit={auraRunLit(marker.time, marker.endTime)}
										style:left="{xForTime(marker.time)}px"
										onmouseenter={(e) => {
											showTooltip(e, markerTooltip(marker));
											onAuraMarkEnter(marker.time);
										}}
										onmouseleave={onAuraMarkLeave}
										onclick={() => pv.revealInLog(marker.time / FPS)}
									>
										<span class="rp-aura-marker-pip"></span>
										<!-- ⚠ DROPPED, never truncated — a two-character stub names
										     nothing and still costs the pip its clearance. The
										     threshold is the label's OWN measured width now
										     (`auraMarkerLabels`); it was a flat 26px, which sliced
										     every name longer than that into a different-looking
										     stub. The pip alone is honest ("a reaction happened
										     here") and the tooltip still says which. -->
										{#if auraMarkerShown.has(marker.time)}
											<span class="rp-aura-marker-label">{marker.label}</span>
										{/if}
									</div>
								{/each}
							</div>

							<!-- Application ticks — every gauge the rotation put on the
						     target. ⚓ The tick carries its ELEMENT'S colour (it belongs
						     to the row below it); the --ui-provisional FOOT is the
						     squiggle rule: we took this application, and its unit value
						     is our 1U stand-in rather than measured data. -->
							<div
								class="rp-aura-ticks"
								style:height="{AURA_TICK_H}px"
								style:--rp-pill-r="{AURA_PILL_R}px"
							>
								{#each auraLane.ticks as tick, ti (ti)}
									<!-- ⚓ Clicking a pip or a marker opens the LOG at its row
									     (Nate 2026-09-24). No key handler: the log is reached by
									     its own band-B plate, and its rows are the keyboard path. -->
									<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
									<span
										class="rp-aura-tick"
										class:rp-aura-tick--provisional={tick.provisional}
										class:rp-aura-tick--lit={auraLit(tick.time)}
										style:left="{xForTime(tick.time)}px"
										style:background={pal(tick.element).main}
										onmouseenter={(e) => {
											onAuraMarkEnter(tick.time);
											showTooltip(e, {
												sourceLabel: `${getLoadedCharacter(tick.characterId)?.displayName ?? tick.characterId} · ${secondsLabel(tick.time)}s`,
												effects: [
													{
														stat: `${tick.element[0].toUpperCase()}${tick.element.slice(1)} applied`,
														displayValue: `${tick.units}U`
													},
													// ⚠️⚠️ WHAT THIS PILL IS STANDING IN FOR. Applications on
													// one frame draw at one x, so all but the first are
													// invisible — and the Polestar Field's ledger counts
													// APPLICATIONS, so a reader checking that number against
													// the marks would come up short with nothing to explain
													// the gap. ⚓ Near-coincident pills separate as you zoom;
													// these never do, which is why the count is stated.
													...(tick.sameFrame
														? [
																{
																	stat: 'On this frame',
																	displayValue: `${tick.sameFrame} applications`
																}
															]
														: []),
													// ⚓ THE SQUIGGLE RULE IN WORDS. The yellow foot says a
													// value is a stand-in; only here can it say WHICH value
													// and what would replace it. A provenance mark the reader
													// cannot resolve is just a blemish.
													...(tick.provisional
														? [
																{
																	stat: 'Gauge strength',
																	displayValue: 'not measured — 1U assumed'
																}
															]
														: [])
												],
												isMutuallyExclusive: false
											});
										}}
										onmouseleave={onAuraMarkLeave}
										onclick={() => pv.revealInLog(tick.time / FPS)}
									></span>
								{/each}
							</div>

							<!-- ⚓ ONE OVERLAID PLOT, drawn at 1:1 across the whole track.
						     A single SVG at the track's own width means no viewBox
						     stretch — which is what makes the gauge LINE possible, and
						     the line is what lets two auras cross legibly where two
						     solid areas would have gone to mud. -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="rp-aura-plot"
								style:height="{AURA_PLOT_H}px"
								onmousemove={onAuraMove}
								onmouseleave={onAuraLeave}
							>
								<svg class="rp-aura-svg" width={totalWidth} height={AURA_PLOT_H} aria-hidden="true">
									<!-- The one datum: whole units below the ceiling, so the y
							     axis can be read without hovering. Under the fills.

							     ⚓ NAMED AT ITS LEFT END (⚓ NATE 2026-08-17). An unlabelled
							     rule tells a theorycrafter what they already know and tells
							     everyone else nothing — it reads as chart furniture rather
							     than as a QUANTITY, so a 0.8U aura under it looks like a
							     short bar instead of "most of one unit". The Gauge Explorer
							     has labelled its unit axis since it was built; this is the
							     lane catching up, and it is what stops the 2U ceiling
							     reading as arbitrary (see `auraUMax`).
							     ⚠ It SCROLLS with the plot, like the lane names — one datum
							     stated where the chart begins. -->
									<!-- ⚓ THE HAIRLINE HALF OF THE APPLICATION MARKER, shared with
									     the Gauge Explorer: each pill above drops a line into the
									     gauge it changed, so the step in the plot is TIED to the hit
									     that caused it instead of being left to the eye.
									     ⚠ Drawn FIRST, under the rules and the auras — it is a
									     pointer, not data, and an application whose line crossed a
									     gauge line would read as a value. `stroke-opacity` is paint
									     alpha, which the sub-pixel laws require here. -->
									{#each auraLane.ticks as tick, ti (`h${ti}`)}
										<line
											x1={xForTime(tick.time)}
											x2={xForTime(tick.time)}
											y1="0"
											y2={AURA_PLOT_H}
											stroke={pal(tick.element).main}
											stroke-opacity="0.22"
										/>
									{/each}
									<!-- ⚓ THE RULES RUN THE WHOLE TRACK; their labels live OUTSIDE
									     it (⚓ NATE 2026-08-17), in the frame's own left padding on the
									     far side of the 0s line — which is exactly how the Gauge
									     Explorer reads, and it retires two workarounds at once: the
									     rule no longer has to yield its first 20px to a label sitting
									     on top of the data, and the label no longer has to dodge it.
									     ⚠ The labels are NOT in this SVG (see .rp-aura-units below):
									     the plot is inside the horizontal scroller and a datum legend
									     that scrolled away would be useless. -->
									{#each auraUnitRules as u (u)}
										<line
											x1="0"
											x2={totalWidth}
											y1={auraYOf(u)}
											y2={auraYOf(u)}
											stroke="var(--rp-grid)"
										/>
									{/each}
									<defs>
										<!-- The fill fades OUT toward the baseline so overlapping
									     auras stay separable; the colour lives in the line. -->
										{#each auraPaths as p (p.id)}
											{#if p.fill}
												<linearGradient id="rp-aura-{p.id}" x1="0" y1="0" x2="0" y2="1">
													<stop offset="0%" stop-color={p.color} stop-opacity="0.34" />
													<stop offset="100%" stop-color={p.color} stop-opacity="0" />
												</linearGradient>
											{/if}
										{/each}
									</defs>
									{#each auraPaths as p (p.id)}
										{#if p.fill}
											<path d={p.fill} fill="url(#rp-aura-{p.id})" />
										{/if}
									{/each}
									<!-- Lines last, so a short aura is never buried under a
								     taller one's fill. -->
									{#each auraPaths as p (p.id)}
										<path
											d={p.line}
											fill="none"
											stroke={p.color}
											stroke-width="2"
											stroke-dasharray={p.dash ?? 'none'}
											stroke-linejoin="round"
											stroke-linecap={p.dash ? 'butt' : 'round'}
										/>
									{/each}
								</svg>
								{#each auraLabels as entry (entry.mod + entry.span.start)}
									<span
										class="rp-aura-series-name"
										style:color={entry.color}
										style:left="{xForTime(entry.span.start) + 4}px"
										style:top="{Math.max(0, auraYOf(entry.span.openingU) - 11)}px"
										>{entry.label}</span
									>
								{/each}
								{#if auraCursorX !== null}
									<span class="rp-aura-crosshair" style:left="{auraCursorX}px"></span>
								{/if}
							</div>
							<!-- ⚓ WHAT THE REACTION LEFT IN THE WORLD. Under the baseline
							     because these are ENTITIES, not gauge: a dendro core and a
							     Starlight Prism have lifetimes but no units, and putting
							     them inside the plot would hang them off an axis that does
							     not measure them.
							     ⚠ A core's bar ends where something ATE it — that instant
							     comes from the gauge's own events and cannot be derived from
							     the Bloom, which is the whole reason the strip is worth its
							     pixels rather than being a nominal 6s stub. -->
							{#if gadgetRows.length > 0}
								<div class="rp-gadget-strip" style:height="{gadgetStripH}px">
									{#each gadgetRows as row (row.kind)}
										{@const h = gadgetRowH(row.capacity)}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											class="rp-gadget-row"
											style:height="{h}px"
											onmouseleave={() => {
												gadgetHover = null;
												onAuraMarkLeave();
											}}
										>
											<svg width={totalWidth} height={h} aria-hidden="true">
												<!-- STATE: how many are standing, as ONE translucent shape.
												     ⛔ No gradient and ⛔ no outline — the fill alone is what
												     lets this row and the Prism's read as the same object. -->
												<path
													d={gadgetStair(row.runs, row.capacity, h)}
													fill={row.color}
													fill-opacity={GADGET_FILL_ALPHA}
													stroke="none"
												/>
												<!-- Hit areas for the state, one per run — the count is what a
												     reader cannot get off a 3px step, so every run can be asked. -->
												{#each row.runs as run, ri (`r${ri}`)}
													<rect
														x={xForTime(run.start)}
														y="0"
														width={Math.max(1, xForTime(run.end) - xForTime(run.start))}
														height={h}
														fill="transparent"
														onmouseenter={(e) => gadgetRunEnter(e, row, run, ri)}
													/>
												{/each}
												<!-- EVENTS: one solid disc per spawn, the application pill's own
												     size. ⚓ Painted LAST so a mark is never behind the state it
												     caused, and hit LAST for the same reason — the dot is what a
												     reader is aiming at. -->
												<!-- ⚓ HOVER IS A RING, NOT A DIMMING (⚓ Nate). Dimming was
												     answering "which life is this" — a question the row stopped
												     asking when the leaders went; what is left is "which SPAWN am
												     I pointing at", and that wants a mark ON the thing rather
												     than a wash over everything else. The ring is the aura tick's
												     own lit state (`box-shadow: 0 0 0 2px var(--chrome)`), in the
												     form SVG can carry it. -->
												{#each row.spawns as spawn, si (`d${si}`)}
													<circle
														cx={xForTime(spawn.time)}
														cy={gadgetDotCy}
														r={AURA_PILL_R}
														fill={row.color}
														stroke="var(--chrome)"
														stroke-width="2"
														stroke-opacity={gadgetHover === `${row.kind}:dot:${si}` ? 1 : 0}
														onmouseenter={(e) => gadgetDotEnter(e, row, spawn, si)}
													/>
												{/each}
											</svg>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
					<!-- Ruler — the frame's TOP time axis (DAW convention): ticks
				     rise to the seam, labels above them. -->
					<div class="rp-ruler" style:height="{RULER_H}px">
						{#each ticks as tick (tick.t)}
							<div class="rp-tick" class:major={tick.major} style:left="{tick.x}px">
								{#if tick.major && tick.t > 0}
									<span class="rp-tick-label">{tick.t}s</span>
								{/if}
							</div>
						{/each}
						<!-- Lap marks (Round B): where each repeat begins. A gold rule
						     the ruler's height with a ×N label — the axis's own
						     vocabulary for "again", and gold because a lap seam is
						     the one thing on the ruler the READER put there. -->
						{#each lapStarts as lap (lap.lap)}
							<div class="rp-lap-mark" style:left="{projectX(lap.t, scale)}px">
								<span class="rp-lap-label">×{lap.lap}</span>
							</div>
						{/each}
					</div>
					{#if playheadX !== null}
						<span class="rp-playhead" style:left="{playheadX}px"></span>
					{/if}
				</div>
			</div>
			<!-- The view cluster (total · zoom · Notes) used to ride this strip's
			     right end. It moved to BAND B in the toolbar round: it is view
			     state, and the bands are where view state lives now, in every
			     tool. The ruler keeps the full frame width it always wanted. -->
		</div>
		<div class="rp-timeline-area">
			<div class="rp-scroll-wrapper">
				<!-- The label column is GONE (abutting round). It was already pure
				     reservation — the ribbon stood over its full height, so nothing
				     in it could be seen — and now the frame starts where the ribbon
				     ends, leaving no width for it to reserve. The band's cards align
				     to the track groups through the published slot metrics
				     (benchBand.claimMetrics), which was always the real contract;
				     the shadow column never carried it. -->
				<!-- Scrollable track area -->
				<div
					class="rp-track-scroll scroll-fade-x"
					bind:this={trackScrollEl}
					bind:clientWidth={trackScrollWidth}
					onscroll={onTrackScroll}
					use:scrollFade={{ axis: 'x' }}
				>
					<div
						class="rp-tracks"
						style:width="{totalWidth}px"
						style:pointer-events={scrollPointerGuard ? 'none' : undefined}
					>
						<!-- Gridline layer: ONE pass of full-height divs across the whole
						     track area, replacing the old per-container loops. Divs, not
						     SVG, so Safari pixel-snaps them together with the bars (see
						     connectorStyle). z:0 + first in DOM keeps them beneath the
						     ghost CD tracks.
						     ↻ 2026-08-11: EVERY tick draws a line, not just the majors —
						     the minors are fainter and shorter (see .rp-gridline). The
						     `major` flag is `t % 5 === 0`, so "minor" is exactly Nate's
						     sub-5s. This loop is the ruler's ticks one-for-one now, which
						     is what lets a tick and its line be one stroke. -->
						{#each ticks as tick (tick.t)}
							<div class="rp-gridline" class:major={tick.major} style:left="{tick.x}px"></div>
						{/each}
						{#each lapStarts as lap (lap.lap)}
							<div class="rp-lap-line" style:left="{projectX(lap.t, scale)}px"></div>
						{/each}
						{#if playheadX !== null}
							<span class="rp-playhead" style:left="{playheadX}px"></span>
						{/if}

						<!-- Character slot tracks (always 4 rows) -->
						{#each slotCharacters as char, slotIdx (slotIdx)}
							{@const p = char?.id === 'blank' ? BLANK_PAL : pal(char?.element)}
							{@const slotTracks = tracksBySlot[slotIdx]}
							<!-- No-frame-map characters (uncurated stubs, but NOT Blank — Blank
							     is presented as a normal generic kit) mark their generic-timed
							     N/C/P tokens with a dire gradient fill + dire text. -->
							{@const isApprox = char != null && !isCurated(char) && char.id !== 'blank'}

							<!-- ↻ 2026-08-12: THE HALO IS DERIVED FROM `bar`, NOT `main`. Its
							     one job is to hold white ink off the fill it sits on, so it
							     has to be that fill's own shade — a halo drawn from `main`
							     under a `bar` fill is a slightly different hue AND the wrong
							     distance from it, which is exactly the drift the shared
							     castFill() contract exists to prevent. -30 HSL points from
							     whatever the bar is; the /lab board judged it this way. -->
							<div
								class="rp-char-block"
								style:height="{slotHeights[slotIdx]}px"
								style:--label-halo={char ? shiftHue(p.bar, 0, -30, 1) : undefined}
							>
								<!-- E row -->
								<div class="rp-row" style:top="{CHAR_PAD_TOP}px" style:height="{E_ROW_H}px">
									{#each slotTracks as track, ti (`${slotIdx}_${ti}`)}
										{#each track.eBars as bar, barIdx (barIdx)}
											{@const eHasSummon =
												findCastSummons(
													char,
													'skill',
													bar.label,
													bar.abilityId,
													bar.variantLabel ?? null
												).length > 0}
											<!-- The BAR's palette when its first hit lands an element that is not the
													     slot's (Varka's Four Winds and burst, `CastEvent.element`), else the slot's.
													     Pill, ghost tail and badge halo all take it, so the halo stays the fill's own shade. -->
											{@const bp = bar.element ? pal(bar.element) : p}
											<!-- Three-case E/Q pill geometry lives in the shared barPhases()
										     helper (mirrored by the PNG exporter). Roles carry the styling
										     intent; this template projects each to its DOM treatment. -->
											{#each barPhases(bar, eHasSummon) as seg, si (si)}
												{@const g = barGeom(seg.start, seg.span)}
												{#if seg.role === 'uptime'}
													<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
													<div
														class="rp-bar-uptime"
														class:rp-inspectable={$nextLayout}
														class:rp-inspected={pv.inspectedCastKey ===
															castKey(char?.id ?? '', 'skill', bar.start)}
														onclick={() => inspectCast(char?.id, 'skill', bar.start)}
														style:--label-halo={bar.element
															? shiftHue(bp.bar, 0, -30, 1)
															: undefined}
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background={castFill(bp.bar)}
														style:border-radius="1px"
													>
														<span class="rp-bar-row-badge">{bar.label}</span>
													</div>
												{:else if seg.role === 'uptimeFlush'}
													<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
													<div
														class="rp-bar-uptime"
														class:rp-inspectable={$nextLayout}
														class:rp-inspected={pv.inspectedCastKey ===
															castKey(char?.id ?? '', 'skill', bar.start)}
														onclick={() => inspectCast(char?.id, 'skill', bar.start)}
														style:--label-halo={bar.element
															? shiftHue(bp.bar, 0, -30, 1)
															: undefined}
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background={castFill(bp.bar)}
													>
														<span class="rp-bar-row-badge">{bar.label}</span>
													</div>
												{:else if seg.role === 'uptimeDim'}
													<!-- Sac proc: bar spans duration only (CD reset to 0), dim
											     continuation tone. Opaque mix, never alpha — connectors
											     pass behind these bars. --dim keeps the badge white+halo:
											     ink only sits on full-strength fills. -->
													<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
													<div
														class="rp-bar-uptime rp-bar-uptime--dim"
														class:rp-inspectable={$nextLayout}
														class:rp-inspected={pv.inspectedCastKey ===
															castKey(char?.id ?? '', 'skill', bar.start)}
														onclick={() => inspectCast(char?.id, 'skill', bar.start)}
														style:--label-halo={bar.element
															? shiftHue(bp.bar, 0, -30, 1)
															: undefined}
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background="color-mix(in srgb, {bp.bar}
														{UPTIME_DIM_MIX}%, var(--rp-chart-bg))"
														style:border-radius="1px"
													>
														<span class="rp-bar-row-badge">{bar.label}</span>
													</div>
												{:else if seg.role === 'overflow'}
													{#if g.width > 0}
														<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
														<div
															class="rp-bar-cd rp-bar-cd--overflow"
															class:rp-inspectable={$nextLayout}
															onclick={() => inspectCast(char?.id, 'skill', bar.start)}
															style:left="{g.left}px"
															style:width="{g.width}px"
															style:background="color-mix(in srgb, {bp.bar}
															{UPTIME_DIM_MIX}%, var(--rp-chart-bg))"
														></div>
													{/if}
												{:else if seg.role === 'ghost'}
													<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
													<div
														class="rp-bar-cd rp-bar-cd--ghost"
														class:rp-inspectable={$nextLayout}
														onclick={() => inspectCast(char?.id, 'skill', bar.start)}
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background="color-mix(in srgb, {desaturate(
															bp.bar,
															GHOST_CHROMA_KEEP
														)}
														{GHOST_FILL_MIX}%, transparent)"
													>
														{#if g.width > 32}
															<span class="rp-bar-cd-label">{secondsLabel(seg.cooldown ?? 0)}s</span
															>
														{/if}
													</div>
												{/if}
											{/each}
										{/each}
									{/each}
								</div>

								<!-- Summon lane (between E and Q) — only rendered when this slot's
						     character owns at least one summon. One sub-row per unique label. -->
								{#if slotSummonLaneHeights[slotIdx] > 0}
									{#each summonSubrows.filter((r) => r.slotIdx === slotIdx) as srow, si (`${srow.characterId}::${srow.label}`)}
										<div
											class="rp-row"
											style:top="{summonLaneTop() + si * SUMMON_ROW_STRIDE}px"
											style:height="{SUMMON_ROW_H}px"
										>
											{#each srow.bars as sbar, sbi (sbi)}
												{@const g = barGeom(sbar.start, sbar.end - sbar.start)}
												{@const marks = summonMarks(sbar)}
												<!-- Full-strength castFill — same finish as the E/Q pills
											     (Nate 2026-07-18). Opaque, so swap connectors passing
											     behind this lane can't show through. -->
												<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
												<div
													class="rp-summon-bar"
													class:rp-inspectable={$nextLayout}
													onclick={() => inspectRaised(srow.characterId, sbar.source, sbar.start)}
													style:left="{g.left}px"
													style:width="{g.width}px"
													style:background={castFill(p.bar)}
												>
													<!-- ⚓ An absorbing summon BECOMES its element (⚓ Nate,
													     2026-10-17): a fade from its first absorbed hit, then that
													     element to the bar's end. One layer, one gradient — not the
													     tiled multi-layer fill the Safari veto forbids. -->
													{#if marks.absorbed}
														{@const fx = barGeom(marks.absorbed.time, 0).left - g.left}
														{@const el = pal(marks.absorbed.element).bar}
														<div
															class="rp-summon-absorbed"
															style:left="{fx}px"
															style:background="linear-gradient(90deg, {el}00 0, {el}
															{ABSORB_FADE_PX}px)"
															aria-hidden="true"
														></div>
													{/if}
													<span class="rp-summon-label">{srow.label}</span>
												</div>
												<!-- One stub per FRAME (`summonMarks`): an absorbed twin shares its
												     Anemo tick's; a stream keeps its own cadence. Past the fade, a
												     stub takes the element's hi. -->
												{#each marks.ticks as tick, tIdx (tIdx)}
													{@const tg = barGeom(tick.time, 0)}
													<div
														class="rp-summon-tick"
														style:left="{tg.left}px"
														style:background={tick.absorbed && marks.absorbed
															? tickInk(marks.absorbed.element)
															: tickInk(char?.element)}
														aria-hidden="true"
													></div>
												{/each}
												<!-- A stack-threshold FIRE on this lane (Columbina's Gravity
												     Interference): a different object from a tick — one hit the
												     accrual paid for, applying nothing to the gauge (Durability 0),
												     so it draws here and nowhere in the aura lane. ⚓ A falling
												     moonbeam GLEAM, not the hit's element (Nate, 2026-10-17;
												     `LUNAR_GLEAM_STOPS`). -->
												{#each sbar.fires ?? [] as fire, fIdx (fIdx)}
													{@const fg = barGeom(fire.time, 0)}
													<div
														class="rp-summon-fire"
														style:left="{fg.left}px"
														style:background={LUNAR_GLEAM_BG}
														aria-hidden="true"
													></div>
												{/each}
											{/each}
										</div>
									{/each}
								{/if}

								<!-- Q row -->
								<div
									class="rp-row"
									style:top="{qRowTopForSlot(slotIdx)}px"
									style:height="{Q_ROW_H}px"
								>
									{#each slotTracks as track, ti (`${slotIdx}_${ti}`)}
										{#each track.qBars as bar, barIdx (barIdx)}
											{@const qHasSummon =
												findCastSummons(
													char,
													'burst',
													bar.label,
													bar.abilityId,
													bar.variantLabel ?? null
												).length > 0}
											<!-- The BAR's palette when its first hit lands an element that is not the
													     slot's (Varka's Four Winds and burst, `CastEvent.element`), else the slot's.
													     Pill, ghost tail and badge halo all take it, so the halo stays the fill's own shade. -->
											{@const bp = bar.element ? pal(bar.element) : p}
											<!-- Same shared barPhases() geometry as the E row (badge 'Q').
										     Bursts never fire the sac proc, so the uptimeDim role is
										     unreachable here, but kept for E/Q symmetry. -->
											{#each barPhases(bar, qHasSummon) as seg, si (si)}
												{@const g = barGeom(seg.start, seg.span)}
												{#if seg.role === 'uptime'}
													<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
													<div
														class="rp-bar-uptime"
														class:rp-inspectable={$nextLayout}
														class:rp-inspected={pv.inspectedCastKey ===
															castKey(char?.id ?? '', 'burst', bar.start)}
														onclick={() => inspectCast(char?.id, 'burst', bar.start)}
														style:--label-halo={bar.element
															? shiftHue(bp.bar, 0, -30, 1)
															: undefined}
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background={castFill(bp.bar)}
														style:border-radius="1px"
													>
														<span class="rp-bar-row-badge">{bar.label}</span>
													</div>
												{:else if seg.role === 'uptimeFlush'}
													<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
													<div
														class="rp-bar-uptime"
														class:rp-inspectable={$nextLayout}
														class:rp-inspected={pv.inspectedCastKey ===
															castKey(char?.id ?? '', 'burst', bar.start)}
														onclick={() => inspectCast(char?.id, 'burst', bar.start)}
														style:--label-halo={bar.element
															? shiftHue(bp.bar, 0, -30, 1)
															: undefined}
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background={castFill(bp.bar)}
													>
														<span class="rp-bar-row-badge">{bar.label}</span>
													</div>
												{:else if seg.role === 'uptimeDim'}
													<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
													<div
														class="rp-bar-uptime rp-bar-uptime--dim"
														class:rp-inspectable={$nextLayout}
														class:rp-inspected={pv.inspectedCastKey ===
															castKey(char?.id ?? '', 'burst', bar.start)}
														onclick={() => inspectCast(char?.id, 'burst', bar.start)}
														style:--label-halo={bar.element
															? shiftHue(bp.bar, 0, -30, 1)
															: undefined}
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background="color-mix(in srgb, {bp.bar}
														{UPTIME_DIM_MIX}%, var(--rp-chart-bg))"
														style:border-radius="1px"
													>
														<span class="rp-bar-row-badge">{bar.label}</span>
													</div>
												{:else if seg.role === 'overflow'}
													{#if g.width > 0}
														<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
														<div
															class="rp-bar-cd rp-bar-cd--overflow"
															class:rp-inspectable={$nextLayout}
															onclick={() => inspectCast(char?.id, 'burst', bar.start)}
															style:left="{g.left}px"
															style:width="{g.width}px"
															style:background="color-mix(in srgb, {bp.bar}
															{UPTIME_DIM_MIX}%, var(--rp-chart-bg))"
														></div>
													{/if}
												{:else if seg.role === 'ghost'}
													<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
													<div
														class="rp-bar-cd rp-bar-cd--ghost"
														class:rp-inspectable={$nextLayout}
														onclick={() => inspectCast(char?.id, 'burst', bar.start)}
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background="color-mix(in srgb, {desaturate(
															bp.bar,
															GHOST_CHROMA_KEEP
														)}
														{GHOST_FILL_MIX}%, transparent)"
													>
														{#if g.width > 32}
															<span class="rp-bar-cd-label">{secondsLabel(seg.cooldown ?? 0)}s</span
															>
														{/if}
													</div>
												{/if}
											{/each}
										{/each}
									{/each}
								</div>

								<!-- Active row (one bar per track in this slot) -->
								<div
									class="rp-row"
									style:top="{activeRowOffsetForSlot(slotIdx)}px"
									style:height="{ACTIVE_ROW_H}px"
								>
									{#each slotTracks as track, ti (`${slotIdx}_${ti}`)}
										{@const activeLeft = xForTime(track.activeStart)}
										{@const activeW = Math.max(xForTime(track.activeEnd) - activeLeft, 4)}
										{@const conn = trackConnections.get(track.activeStart)}
										<!-- Dim background strip — visual grounding for gaps and dead time -->
										<div
											class="rp-active-bg"
											class:rp-active-bg--unset={track.hasUnsetDuration}
											style:left="{activeLeft}px"
											style:width="{activeW}px"
											style:border-radius={barRadius(conn)}
										></div>
										<!-- Per-input building blocks -->
										{#each track.inputBlocks as block, bi (bi)}
											{@const blockLeft = xForTime(block.start)}
											{@const blockW = Math.max(
												xForTime(block.start + block.duration) - blockLeft,
												2
											)}
											<div
												class="rp-input-block rp-input-block--{block.kind}"
												style:left="{blockLeft}px"
												style:width="{blockW}px"
												style:background={block.kind === 'skill' ||
												block.kind === 'burst' ||
												block.kind === 'elemental-normal'
													? `color-mix(in srgb, ${block.element ? pal(block.element).bar : p.bar} 50%, var(--rp-active))`
													: undefined}
												style:border-right={bi === track.inputBlocks.length - 1
													? 'none'
													: undefined}
												title={block.kind === 'pad'
													? padTitle(block)
													: isApprox && block.kind !== 'skill' && block.kind !== 'burst'
														? 'No frame data yet — cast animations and normal attacks use generic timings.'
														: undefined}
											>
												{#each block.parts as part (part)}
													<span
														class="rp-active-text"
														class:rp-active-text--danger={isApprox &&
															block.kind !== 'skill' &&
															block.kind !== 'burst'}>{part}</span
													>
												{/each}
											</div>
										{/each}
									{/each}
								</div>

								<!-- Weapon proc ICD rows — one stacked row per proc entry -->
								{#each weaponProcRows.filter((r) => r.characterId === char?.id) as procRow, pi (procRow.characterId)}
									<div
										class="rp-row"
										style:top="{buffRowsTopForSlot(slotIdx) + pi * CHAR_BUFF_ROW_STRIDE}px"
										style:height="{CHAR_BUFF_ROW_H}px"
									>
										{#each procRow.bars as bar, bi (bi)}
											{@const g = barGeom(bar.start, bar.end - bar.start)}
											<div
												class="rp-weapon-proc-bar"
												style:left="{g.left}px"
												style:width="{g.width}px"
											>
												<!-- The cap is not optional here. This row's bar used to clip
												     its own label (overflow:hidden) and so never needed one;
												     the slim bar lets the label out on both axes, so without
												     labelCapPx a long proc name would run straight over the
												     next trigger window. -->
												<span
													class="rp-buff-label"
													style:max-width={labelCapPx(g, procRow.bars[bi + 1], false)}
													>{procRow.label} trigger cooldown</span
												>
											</div>
										{/each}
									</div>
								{/each}
								<!-- Per-source received buff subrows — stacked below any proc ICD rows -->
								{#each charReceivedBuffRows.filter((r) => r.characterId === char?.id) as recRow, ri (recRow.key)}
									<div
										class="rp-row"
										style:top="{buffRowsTopForSlot(slotIdx) +
											(weaponProcRows.filter((r) => r.characterId === char?.id).length + ri) *
												CHAR_BUFF_ROW_STRIDE}px"
										style:height="{CHAR_BUFF_ROW_H}px"
									>
										{#each recRow.bars as bar, bi (bi)}
											{@const g = barGeom(bar.start, bar.end - bar.start)}
											{@const icon = BUFF_STAT_ICON[recRow.primaryStat]}
											{@const envBg =
												rampingBackground(bar) ?? decayingBackground(bar) ?? steppedBackground(bar)}
											<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
											<div
												class="rp-team-buff-bar"
												class:rp-inspectable={$nextLayout}
												class:rp-inspected={pv.inspectedBar ===
													barKey('received', recRow.key, bar.start)}
												style:left="{g.left}px"
												style:width="{g.width}px"
												style:background={envBg}
												onmouseenter={(e) =>
													bar.steps
														? showStepTooltip(e, bar, bar.sourceLabel)
														: showTooltip(e, receivedPayload(bar))}
												onmousemove={(e) => bar.steps && showStepTooltip(e, bar, bar.sourceLabel)}
												onmouseleave={hideTooltip}
												onclick={(e) => inspectBar(e, 'received', recRow.key, bar.start, bar.end)}
											>
												{#if icon}<img src={icon} alt="" class="rp-buff-icon" />{/if}
												<span
													class="rp-buff-label"
													style:max-width={labelCapPx(g, recRow.bars[bi + 1], !!icon)}
													>{bar.sourceLabel}</span
												>
												{#each bar.seams ?? [] as seam (seam)}
													<i
														class="rp-buff-seam"
														style:left="{barGeom(seam, 0).left - g.left - 2}px"
													></i>
												{/each}
											</div>
										{/each}
									</div>
								{/each}
							</div>
						{/each}

						<!-- Team buffs row. When there are no buffs the lane stays present
							 (same height) but renders nothing — the hidden name carries
							 the "empty" signal, no placeholder text.
							 ↻ Tall-bench round: the lane NAME rides the lane itself, pinned
							 to the track viewport's left edge and painted UNDER the bars —
							 the ribbon owns the label column at every height now, so there
							 is no column left to name a lane from. A bar that starts at 0s
							 covers it, which is the intended trade: the bar says what it is
							 (label + tooltip) better than the lane's name does. -->
						<!-- ⚠ The layer toggle removes the lane OUTRIGHT; the empty-lane
						     rule above is about a rotation that grants nothing, which is a
						     different statement and still worth its 16px. -->
						{#if showTeamBuffsLane}
							<div class="rp-team-buffs" style:height="{teamBuffsH}px">
								{#if teamBuffRows.length > 0}
									<span class="rp-lane-name">Team buffs</span>
									<div class="rp-team-buff-rows">
										{#each teamBuffRows as subrow (subrow.key)}
											<div class="rp-team-buff-subrow">
												{#each subrow.bars as bar, bi (bi)}
													{@const g = barGeom(bar.start, bar.end - bar.start)}
													{@const icon = subrow.icon ?? BUFF_STAT_ICON[subrow.primaryStat]}
													<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
													<div
														class="rp-team-buff-bar"
														class:rp-inspectable={$nextLayout}
														class:rp-inspected={pv.inspectedBar ===
															barKey('team', subrow.key, bar.start)}
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background={steppedBackground(bar)}
														onmousemove={(e) =>
															bar.steps && showStepTooltip(e, bar, subrow.sourceLabel)}
														onmouseenter={(e) =>
															bar.steps
																? showStepTooltip(e, bar, subrow.sourceLabel)
																: showTooltip(e, teamPayload(subrow, bar))}
														onclick={(e) => inspectBar(e, 'team', subrow.key, bar.start, bar.end)}
														onmouseleave={hideTooltip}
													>
														{#if icon}
															<img src={icon} alt="" class="rp-buff-icon" />
														{/if}
														<span
															class="rp-buff-label"
															style:max-width={labelCapPx(g, subrow.bars[bi + 1], !!icon)}
															>{subrow.sourceLabel}</span
														>
														{#each bar.seams ?? [] as seam (seam)}
															<i
																class="rp-buff-seam"
																style:left="{barGeom(seam, 0).left - g.left - 2}px"
															></i>
														{/each}
													</div>
												{/each}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}

						<!-- NB (Nightsoul Burst) lane -->
						{#if showNbLane}
							<div class="rp-nb-lane" style:height="{nbLaneH}px">
								<span class="rp-lane-name">Nightsoul bursts</span>
								<div class="rp-nb-rows">
									<div class="rp-nb-subrow">
										{#each nbBars as ev, i (i)}
											{@const cd = barGeom(ev.start, ev.cooldown)}
											<div class="rp-nb-bar" style:left="{cd.left}px" style:width="{cd.width}px">
												<span class="rp-bar-cast-label">NB</span>
												{#if cd.width > 40}
													<span class="rp-bar-cd-label">{secondsLabel(ev.cooldown)}s</span>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							</div>
						{/if}

						<!-- Moonsign lane -->
						{#if showMoonsignLane}
							<div class="rp-moonsign-lane" style:height="{moonsignLaneH}px">
								<span class="rp-lane-name">Ascendant Gleam</span>
								<div class="rp-moonsign-rows">
									{#each moonsignRows as row (row.slotIdx)}
										{@const msChar = slotCharacters[row.slotIdx]}
										<div class="rp-moonsign-subrow">
											<!-- Windows overlap freely, so each carries ITS OWN label in the
											     buff-bar grammar — icon + "name · Ascendant Gleam", capped at
											     the next window's edge so it dissolves at the seam instead of
											     running under the neighbour. (Replaces the old single floating
											     row label, which read as one label bleeding across the seams —
											     Nate 2026-07-31.) The lunar glyph rides each bar the way a buff
											     bar carries its stat icon — what Ascendant Gleam grants IS a
											     Lunar DMG bonus. Duration lives in the tooltip, like buff bars. -->
											{#each row.windows as win, wi (wi)}
												{@const g = barGeom(win.start, win.duration)}
												<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
												<div
													class="rp-moonsign-bar"
													class:rp-inspectable={$nextLayout}
													class:rp-inspected={pv.inspectedBar ===
														barKey('moonsign', String(row.slotIdx), win.start)}
													style:left="{g.left}px"
													style:width="{g.width}px"
													onmouseenter={(e) => showTooltip(e, moonPayload(row, win))}
													onmouseleave={hideTooltip}
													onclick={(e) =>
														inspectBar(
															e,
															'moonsign',
															String(row.slotIdx),
															win.start,
															win.start + win.duration
														)}
												>
													{#if LUNAR_ICON}<img src={LUNAR_ICON} alt="" class="rp-buff-icon" />{/if}
													<span
														class="rp-buff-label"
														style:max-width={labelCapPx(g, row.windows[wi + 1], !!LUNAR_ICON)}
														>{msChar?.displayName} · Ascendant Gleam</span
													>
												</div>
											{/each}
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Swap connectors between consecutive notation segments. z:1 —
						     above ghost CD tracks, below the solid cast/active bars. -->
						{#each annotatedTracks as track, i (i)}
							{#if i < annotatedTracks.length - 1}
								{@const style = connectorStyle(track, annotatedTracks[i + 1])}
								{#if style}
									<div class="rp-connector" {style}></div>
								{/if}
							{/if}
						{/each}
					</div>
					<!-- /rp-tracks -->
				</div>
				<!-- /rp-track-scroll -->
			</div>
			<!-- /rp-scroll-wrapper -->
		</div>
		<!-- /rp-timeline-area -->

		<!-- The EXTERNAL SCROLLBAR stood here — a second real scroller mirroring
		     the tracks, built for one reason: the native overlay scrollbar drew
		     on top of the bottom lane's bars. It is retired (⚓ NATE 2026-08-11).
		     The track scroller styles its own scrollbar now, which makes it
		     non-overlay, and reserves a gutter for it — so the bar lands on empty
		     space by construction rather than by being moved somewhere else. See
		     .rp-track-scroll, and scheduleMirror for what the second scroller was
		     costing in sync machinery. -->

		<!-- ⛔ THE CHARACTER SOURCE OVERLAY STOOD HERE — retired 2026-08-13.
		     It was a non-modal panel covering the whole frame: the ~122-card
		     grid over the tracks, its filter rail over the notes, kept mounted
		     after first open to dodge a Safari remount stall. What retired it
		     was not its cost but its JOB: the planner's picker could only fill
		     the LOWEST EMPTY SLOT, while the Team Builder's audition targets the
		     slot you clicked and pins its incumbent to compare against. ⇄ on a
		     bench card goes there now (?swap=N), so the planner has no grid of
		     its own to cover its own instrument with. ↻ 2026-10-13: the audition
		     retired into the Builder's swap mode; ?swap=N lands there. -->
	</div>
	<!-- /rp-frame -->

	<!-- ── Always-on bonuses, sandwiched between chart and composer ──────────
	     ⚓ NATE 2026-08-11: it used to hang off the bottom of the PAGE, below the
	     composer, "looking a bit out of place" — and it was: an always-on buff is
	     the BASELINE every temporary bar above it is measured against, so
	     reading it is part of reading the chart. Below the composer it read as a
	     footnote about the tool; here it reads as the last row of it.
	     ⚠ The seam that separated it from the stack was a DOUBLE tool gutter,
	     deliberately, on the reasoning that "this separates the tool from a
	     caption ABOUT the tool". That reasoning inverts with the move — it is
	     inside the tool now — so it takes the ordinary single gutter that
	     .rp-root's `gap` already provides, and the page's double-gutter rule
	     went with the element. -->
	<!-- ⚓ Nate 2026-10-14: the always-on buffs ride the BUFFS layer too, at
	     every width — a team bonus is what an ability GRANTS, the side of the
	     layer cut that goes. A markup gate is the honest one HERE: nothing
	     measures this strip, and the PNG does not draw it. -->
	{#if underChart && showBuffs}
		<div class="rp-underchart">{@render underChart()}</div>
	{/if}

	<!-- ── Composer ─────────────────────────────────────────────
	     The notation input: you write the rotation here, the timeline renders
	     it above.

	     ↻ BREATHING-ROOM ROUND 2026-08-08: it is its own PANEL below the frame
	     now, not the frame's bottom edge. The planner measured 2.1% bare scene
	     inside its own bounding box — the tightest of the three tools — and it
	     had exactly one honest split available, because the timeline really is
	     one instrument and its lanes have to share a coordinate system. The
	     composer was never part of that instrument: it is where you WRITE, and
	     the frame is where you READ. Giving the seam TOOL_GUTTER of scene says
	     so.

	     It stays inside RotationTimeline rather than being hoisted to the page.
	     Two things live up in .rp-root that it needs — --rp-chart-bg and
	     --rp-line, which both the placeholder and the CodeMirror theme read —
	     and the bench ribbon's dock spans the whole .tool-stack, so a composer
	     outside the stack would stop the strip standing beside the whole tool
	     object, which is the toolbar round's headline.

	     ↻ 2026-08-13: the composer used to go `inert` and blank while the Source
	     was up, asserting a takeover the overlay's geometry had stopped reaching
	     far enough to perform. Nothing takes this surface over any more — the
	     planner has no panel of its own left to raise over it.

	     ↻ TOOLBAR ROUND: the KQM/PNG pair that used to sit just outside the box
	     is gone from here. Both are EXPORTS, and exports are one family with the
	     share link — they live in band A's Share menu now. -->
	<!-- The dock's room in the page: the chart's end has to scroll clear of
	     the collapsed strip. -->
	{#if dockOn}
		<div class="rp-dock-spacer" aria-hidden="true"></div>
	{/if}
	<div
		class="rp-composer"
		class:rp-composer--docked={dockOn}
		class:rp-composer--collapsed={dockOn && !dockOpen}
		class:ctx-glass={dockOn}
		class:rp-composer--ios-chrome={dockOn && iosChrome}
		class:rp-composer--pinned={composerPinned}
		style:--rp-kb-inset="{dockOn ? keyboardInset : 0}px"
		bind:this={composerEl}
		use:pinWatch
		use:dockable={dockOn}
	>
		{#if rotationTabs.held}
			<!-- Held by another tab: said HERE too, where the typing is refused
			     (notices round) — the banner is up at the toolbar, far from a
			     phone's dock. -->
			{@const held = rotationTabs.held}
			<div class="rp-held" role="status">
				<Mark name="locked" size={14} />
				<span class="rp-held-text">Open in another tab, so this tab can’t change it.</span>
				<button class="btn btn--sm btn--primary" onclick={held.editHere}>Edit here</button>
			</div>
		{/if}
		{#if dockOn && !dockOpen}
			<button class="rp-dock-strip" type="button" aria-label="Edit the notation" onclick={openDock}>
				<span class="rp-dock-tail" class:rp-dock-tail--empty={!tailSpans.length}>
					<!-- prettier-ignore -->
					<bdi>{#if tailSpans.length}{#each tailSpans as sp, i (i)}<span class="rp-dock-{sp.kind}" style:color={sp.color}>{sp.text}</span>{/each}{:else}Type a rotation in KQM notation{/if}</bdi>
				</span>
				<Mark name="edit" />
			</button>
			<input
				class="rp-dock-proxy"
				bind:this={dockProxy}
				tabindex="-1"
				aria-hidden="true"
				autocomplete="off"
			/>
		{/if}
		<!-- ── THE COMPOSER'S BODY (2026-10-18, ⚓ Nate) ──────────────────────
		     The field and its history pair as ONE footprint, so the pinned plate
		     (.rp-composer-body::before) covers what you write in and nothing
		     else: hung off the whole row it ran on past the field's 140-character
		     measure to the tool's right edge, and narrowed with the main column
		     whenever the aside opened. In the dock it is `display: contents` —
		     the dock's wrapping row is unchanged. -->
		<div class="rp-composer-body">
			<div class="rp-notation-wrap">
				<div
					class="rp-notation"
					use:mountEditor={{ value: notation, key: tabId, seats: seating }}
				></div>
				<!-- ⚓ Opt-in (Settings → Coverage strips, OFF by default): the slotted
			     characters' coverage under the box, what this rotation doesn't
			     reach dimmed. Under the box rather than beside it, so the strips
			     share the notation's left edge — which is the chart's. -->
				{#if $siteSettings.showCoverageStrips}
					<RotationCoverage
						ids={characterSlots.filter(
							(id, i) => id !== 'blank' && characterSlots.indexOf(id) === i
						)}
						events={rotation.events}
						constellations={effectiveCon}
					/>
				{/if}
			</div>
			<!-- ── THE HISTORY PAIR (single truth, 2026-08-13) ─────────────────────
		     ⚓ NATE asked for undo/redo buttons on one side of the notation box.
		     They are a thin wrapper over CodeMirror's own history commands, which
		     ⌘Z/⌘⇧Z have always reached — what changed is that the box is no longer
		     the only thing that writes here. A swap renames a character's
		     segments and a removal deletes them, and those land as editor
		     transactions precisely so this pair can walk them back. A keystroke is
		     not a discoverable way to undo something you did with a mouse two
		     panels away.

		     ⚠ THE TRAILING EDGE, not the leading one. The composer's left edge is
		     the CHART's left edge (both read --rp-frame-pad-x), and that alignment
		     is the only thing tying the box to the instrument above it; controls
		     in front of the box would indent the notation away from the tracks it
		     describes. -->
			<div class="rp-history" role="group" aria-label="Notation history">
				<button
					class="btn btn--sm"
					type="button"
					aria-label="Undo the last notation change"
					title={isMac ? 'Undo (⌘Z)' : 'Undo (Ctrl+Z)'}
					disabled={!canUndo}
					onclick={() => {
						editorApi?.undo();
						historyTick++;
					}}><Mark name="undo" /><span class="rp-history-word">Undo</span></button
				>
				<button
					class="btn btn--sm"
					type="button"
					aria-label="Redo the last undone notation change"
					title={isMac ? 'Redo (⌘⇧Z)' : 'Redo (Ctrl+Shift+Z)'}
					disabled={!canRedo}
					onclick={() => {
						editorApi?.redo();
						historyTick++;
					}}><Mark name="redo" /><span class="rp-history-word">Redo</span></button
				>
				<!-- ⚓ Phase 2e (Nate 2026-10-22): Clear beside its own undo, so a
				     mistaken clear is one click back. Under the switch only; band
				     A's ⋯ still carries Reset with it off. -->
				{#if $nextLayout}
					<button
						class="btn btn--sm"
						type="button"
						aria-label="Clear this rotation"
						title="Clear this rotation (Undo brings it back)"
						disabled={!rotationTabs.notation.trim() && rotationTabs.seats.every((s) => !s)}
						onclick={() => {
							rotationTabs.clearDocument();
							historyTick++;
						}}><Mark name="clear" /><span class="rp-history-word">Clear</span></button
					>
				{/if}
			</div>
		</div>
		{#if dockOn && dockOpen && dockKeys.length}
			<!-- The key row. pointerdown is cancelled so a press never takes focus
			     from the editor — the keyboard stays up. -->
			<div class="rp-dock-keys" role="toolbar" aria-label="Notation keys">
				{#each dockKeys as key (key.label)}
					<button
						class="btn btn--sm rp-dock-key"
						type="button"
						onpointerdown={keyPointerDown}
						onpointerup={(e) => keyPointerUp(e, key)}
						onpointercancel={() => (keyDown = null)}
						onclick={(e) => e.detail === 0 && pressDockKey(key)}>{key.label}</button
					>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Constellation + refinement popovers now live inside SlotPortrait. -->

	<!-- ── Buff tooltip ────────────────────────────────────────── -->
	{#if tooltip}
		<BuffTooltip tip={tooltip} />
	{/if}
</div>

<style>
	/* ── Root ─────────────────────────────────────────────────── */
	.rp-root {
		/* Chart ground — ↻ 2026-08-05 (Genshin-UI archetype): the dark
		   context's SURFACE (#1c1a1a). The well-cut-into-the-frame idiom
		   (⚓ NATE 2026-08-01, then #15151c = mix(#000 40%, the old frame))
		   survives with the roles the archetype gives them: the frame wears
		   the RAISED rung (#212121, see .rp-frame) and the chart sits one
		   rung deeper on the surface. Every derived mix below (ghosts, dims,
		   buffStop, grid/lane lines) follows it. ⚠ the exporter mirrors this
		   literal. */
		/* ↻ 2026-08-09 (Genshin Night): this is --surface-well now, a role that
		   exists BECAUSE of this declaration. The well used to be the literal
		   #242c40, which was also the old --surface — the two were the same
		   colour, and the well idiom survived only because the FRAME sat on the
		   raised rung above it. That is why it silently inverted in 2026-08-05
		   when the surface moved. Naming the ground "one rung below the surface"
		   makes the relationship hold on its own. */
		--rp-chart-bg: var(--surface-well);
		/* Structural lines inside the chart, derived from --border toward the
		   CHART ground (not the frame's) so they blend with the darker well.
		   grid = faint vertical second-lines (resolves ≈ #262631); line = lane
		   separators, zone splits, the ruler seam (resolves ≈ #343443). Opaque
		   mixes, not alpha (the dire-gradient lesson); the export mirrors the
		   resolved literals (the mirror test enforces). */
		--rp-grid: color-mix(in srgb, var(--border) 45%, var(--rp-chart-bg));
		--rp-line: color-mix(in srgb, var(--border) 85%, var(--rp-chart-bg));
		/* ══ THE SUB-5s LINE — ⚓ NATE'S OWN VALUES, 2026-08-11 ═══════════════
		   ⚓ "I think I was wrong about height being the main factor to make them
		   not too noisy — it's visibility mostly." Measured in the inspector at
		   85% reach and 17% ink, and landed verbatim: these are his numbers, not
		   a derivation. The previous pair (22% ink, 45% reach) was my guess that
		   short was what tamed a dense grid; it was faintness.

		   ⚠ AND IT MIXES TOWARD `transparent`, NOT TOWARD THE GROUND — the one
		   place in this component that does. That is not a slip, it is the
		   alpha-compositing law being followed rather than bent: a line mixes
		   opaquely against a KNOWN ground, and carries ALPHA where the ground is
		   unknown. This line sits on the bare scene. The majors are still opaque
		   mixes because at 45% ink the difference is beneath notice over a range
		   this narrow (see .rp-frame); at 17% it is not, which is exactly why
		   the faint one is the one that had to move.

		   ⚠ color-mix TOWARD transparent IS SAFE AND IS NOT THE WEBKIT TRAP. It
		   premultiplies, so this resolves to --border at alpha .17 — it does NOT
		   darken toward black. (The trap is GRADIENT INTERPOLATION through the
		   `transparent` keyword; see .rp-gridline for why that case is benign
		   here too.) And --border is an alias of a literal in .ctx-dark, so this
		   is one level of mix — the nesting law is untouched. */
		--rp-grid-faint: color-mix(in srgb, var(--border) 17%, transparent);
		/* 🎛️ Where each gridline's downward fade reaches nothing — see
		   .rp-gridline. 100% = across the whole chart; pull either up to bring
		   that line's horizon closer to the ruler. */
		--rp-grid-fade: 100%;
		--rp-grid-fade-minor: 85%;
		/* The active-strip neutral: the continuous "who's on field" surface —
		   input blocks, swap connectors, and the active background strip all
		   share it (the elemental block mix in the markup references it too).
		   Now an alias of the site-wide --neutral (app.css): this was a local
		   #717898 that turned out to be the codebase's universal "inactive /
		   unknown" gray, so it was promoted rather than duplicated. Keep the
		   local name — the planner's markup reads it in a color-mix. */
		/* No longer the --neutral alias: Nate sampled this from the happy
		   accident where the movement blocks' leftover translucent #717898
		   composited over the neutral strip (2026-07-31) — the blended color
		   read better than the strip itself, so it IS the strip now. Swap
		   connectors ride the same var. */
		--rp-active: #757f93;

		/* 🎛️ How far a lane's NAME is inset from the tracks' left edge. Shared,
		   because the always-on strip below the chart lines up with it (⚓ Nate
		   2026-08-11: "snug the Always-on buffs over to the left, to match the
		   positioning of the Team Buffs label") and two literals would drift the
		   moment either moved. */
		--rp-lane-name-inset: 8px;

		/* ⛔ --rp-buff-bar-h is DELETED (round two). It was the slim bar's painted
		   height, separate from its row's; the bar fills its row again, so a
		   second number could only ever put whitespace back between the bars.
		   The row height is the knob now, and it lives in JS (CHAR_BUFF_ROW_H /
		   AUX_LANE_BAR_H) because the bench column aligns to it. */

		font-family: var(--font-body);
		font-size: var(--fs-lg);
		color: var(--text);
		display: flex;
		flex-direction: column;
		/* The tool's one interior rhythm ($lib/toolGutter). Was 0.6rem, back
		   when the only thing this gap separated was the frame from a caption;
		   the composer became a sibling panel in the breathing-room round and
		   this is now a seam the reader actually looks at. */
		gap: var(--tool-gutter);
	}

	/* ── Chart area (formerly the chart FRAME) ───────────────── */
	/* ══ ⚓ NATE 2026-08-11: NO FRAME, NO CHART GROUND — THE TIMELINE IS ON THE
	   SCENE. This element used to be a `.frame`: a 1px border, the dark
	   context's RAISED rung as fill, a radius and symmetric padding. All of it
	   is gone. What is left is a layout box that still earns its place three
	   ways — it is the flex column that stacks ruler over tracks, it is the
	   Source overlay's containing block (position:relative below), and it is
	   where the horizontal padding that aligns the tracks with the composer
	   lives.

	   WHAT SURVIVED THE GROUND, AND WHY EACH ONE DID:
	   · --rp-chart-bg stays DECLARED and is no longer PAINTED. It is the ground
	     the bar mixes are composited against, and the PNG exporter still paints
	     it for real (an exported image has no scene behind it). The
	     alpha-compositing law wants a KNOWN ground for those mixes; a notional
	     one that the export makes real is exactly that.
	   · The grid and lane LINES stay opaque mixes rather than going alpha, which
	     is the one place this round argued with the night rule and won on
	     measurement. Composite TOOL_DIM .75 of #101013 over the scene and the
	     dimmed world lands around #12151c–#1e222a — DARKER than the slate-900
	     ground these lines were cut against, and only ~12 levels wide. An opaque
	     line reads identically everywhere across that range; an alpha one would
	     shimmer with the sky for no gain. (The exception the law is really about
	     — glass — is a ground that moves a lot more than this.)
	   · Everything gains contrast rather than losing it, for the same reason:
	     the scene is darker than the ground we removed.

	   THE HORIZONTAL PADDING STAYS AND THE VERTICAL PADDING GOES. The 14px sides
	   are not frame inset — they are the clearance from the bench ribbon, which
	   abuts this surface's left edge, and the alignment contract with the
	   composer below (both read --rp-frame-pad-x). The 10px top and bottom WERE
	   frame inset, so they left with the frame — and the 11px the top gives back
	   (border 1 + padding 10) is the first of the height this round is after.
	   ⚠ RIBBON_FRAME_TOP_INSET in benchBand.svelte.ts is that same sum; it moved
	   with this declaration. */
	.rp-frame {
		padding: 0 var(--rp-frame-pad-x);
		/* The surface BEGINS at the ribbon's right edge — but it is the TOOL
		   STACK that puts it there now (toolbar round), so the bands above and
		   the tracks share one inset by construction rather than by two
		   declarations agreeing. */
		display: flex;
		flex-direction: column;
		min-width: 0;
		/* ⛔ `position: relative` LEFT WITH THE SOURCE (2026-08-13). It was the
		   overlay's containing block and nothing else's: both remaining children
		   — .rp-ruler-strip and .rp-timeline-area — declare their own, so every
		   absolutely-positioned descendant already anchors nearer than this. A
		   stale "containing block for X" on a frame with no X is how a stacking
		   context gets inherited by accident later. */
	}
	/* ⛔ `.rp-frame--picking` (min-height: 26rem) left with it. It guaranteed the
	   Source a usable height under a short rotation — an empty timeline is only
	   4 slot cards tall — and a min-height propping up a panel that no longer
	   exists would just be a floor on every empty timeline. */

	/* ── Timeline area (the track scroller) ──────────────────── */
	/* The notes panel used to be the second child here, pushing the tracks with
	   a margin. It is the surface's ASIDE COLUMN now (aside-column round), which
	   narrows the whole frame — ruler included — instead of this one row. */
	.rp-timeline-area {
		position: relative;
		display: flex;
		flex-direction: row;
		align-items: stretch;
	}
	/* ⛔ THE SOURCE OVERLAY'S RULES STOOD HERE — retired with the panel
	   (2026-08-13). Worth naming what went, because two of them were hard-won
	   and the reasoning outlives the element:
	   · display:none in BOTH states (not `visibility`), so ~122 cards were not
	     being laid out on every zoom of a timeline they were not on screen for.
	   · A fade IN and an instant OUT, from one class: a transition is driven by
	     the after-change style, so the shut rule's `transition: none` was the
	     exit and the open rule's was the entry. The exit had to be instant
	     because the frame's --picking min-height is LAYOUT tier and could not be
	     faded alongside it — fading out left a ghost shrinking onto a
	     collapsing frame.
	   Both notes are kept for the next panel that wants to cover an instrument;
	   the Team Builder's roster still uses the [hidden] variant of the first. */

	/* ── Scroll wrapper ───────────────────────────────────────── */
	.rp-scroll-wrapper {
		position: relative;
		display: flex;
		flex: 1;
		min-width: 0;
	}

	/* ── Lane names (tall-bench round) ───────────────────────────
	   The label column is under the ribbon at every height now, so each aux
	   lane carries its OWN name: pinned to the track viewport's left edge
	   (sticky, so horizontal scroll never takes it away) and painted UNDER
	   the bars, which are free to cover it — Nate's call, and the honest one:
	   a bar states what it is more precisely than the lane's name does. Dimmed
	   to the chart's receding ink so it reads as ground, not content. */
	/* ↻ ⚓ NATE 2026-08-11: THEY SCROLL NOW. "Let's take TEAM BUFFS, NIGHTSOUL
	   BURST and ASCENDANT GLEAM scroll with the timeline — not fixed. The user
	   really only needs to see them once; they don't need to hang around."

	   They were `position: sticky; left: 0`, pinned to the viewport's left edge
	   for the whole rotation. A lane name is an INTRODUCTION, not a legend: once
	   you have read "TEAM BUFFS" you know what that row is, and re-reading it at
	   40s costs a permanent obstruction over the one place bars start.

	   ✅ AND IT CLOSES A KNOWN CONFLICT rather than trading one for another. The
	   horizontal edge fade (round one) is strongest exactly where a sticky name
	   sat, so scrolling right dissolved these names into the mask — flagged at
	   the time as the one thing to watch, and now moot: they leave the viewport
	   with their content long before the fade could eat them. */
	.rp-lane-name {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 0;
		display: flex;
		align-items: center;
		width: max-content;
		height: 100%;
		padding-left: var(--rp-lane-name-inset);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		color: var(--chart-dim);
		white-space: nowrap;
		line-height: var(--lh-none);
		pointer-events: none;
	}

	/* ── Track scroll container ───────────────────────────────── */
	/* ⚓ NATE 2026-08-11 — THE ONE JOB THE CUSTOM SCROLLBAR HAD. The native
	   scrollbar was hidden here and rebuilt as a second scroller below the
	   timeline for exactly one reason: on macOS the OVERLAY scrollbar floats
	   over content, so scrolling drew the bar across the bottom lane's buff bars.
	   Nate: "if there's a way to avoid this, we don't need a custom scroll bar at
	   all — that's the only thing we need it to avoid."

	   There is, and it is a GUTTER: reserve --rp-scrollbar-gutter of empty space
	   at the bottom of the scroller, and the bar has somewhere to be that isn't
	   on top of a bar. Styling ::-webkit-scrollbar additionally opts the element
	   out of overlay scrollbars in WebKit/Blink (it becomes a classic one that
	   takes layout space), but THE GUTTER DOES NOT DEPEND ON THAT — which is the
	   point of the next warning.

	   ⚠ TWO KNOBS ON PURPOSE, AND THEY ARE NOT THE SAME NUMBER. --…-thickness is
	   how thick the bar is PAINTED; --…-gutter is how much room is RESERVED. The
	   gutter is the larger of the two because it has to cover the case where the
	   engine ignores the opt-out and keeps an overlay scrollbar: macOS overlay
	   bars live in a ~15px band whose thumb sits a few px off the edge, so a
	   gutter sized to the painted thickness alone would still let the thumb
	   clip the last lane by a pixel or two. Sized to the band, both readings are
	   safe. (Headless Chrome reports NO scrollbar at all — offsetHeight ===
	   clientHeight — so this is one of the few things here that a probe cannot
	   settle and only a real browser can.)

	   ⚠ THE GUTTER IS NOT DECORATION, IT IS THE FIX. This scroller is height:auto
	   (stretched by its content), and a classic horizontal scrollbar is placed
	   INSIDE the padding box — so without the reservation it would clip the
	   bottom of the last lane rather than overlap it. Either way the lane loses.
	   ⚠ It reserves the space whether or not the rotation actually overflows.
	   With no ground left to paint, an unused gutter is invisible scene.

	   🎛️ --scroll-fade at 48 is longer than the roster's 32: the timeline's
	   content is CONTINUOUS, so unlike a grid of cards there is no gap for a
	   short roll-off to hide in and the edge stays legible as a hard cut. */
	.rp-track-scroll {
		--rp-scrollbar-thickness: 10px;
		--rp-scrollbar-gutter: 14px;
		--scroll-fade: 48px;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		/* ⚓ Nate 2026-09-24: no rubber band. The ruler and the aura lane are
		   scroll FOLLOWERS mirrored from scrollLeft, and an elastic overscroll
		   moves the content without moving scrollLeft — so a sharp fling tore
		   the ticks away from the bars they time. Momentum itself stays (that
		   is the OS's, and harmless); only the bounce past the ends goes. */
		overscroll-behavior-x: none;
		padding-bottom: var(--rp-scrollbar-gutter);
		/* Firefox has no ::-webkit-scrollbar; this is its whole vocabulary. */
		scrollbar-width: thin;
		scrollbar-color: var(--rp-active) transparent;
	}
	.rp-track-scroll::-webkit-scrollbar {
		height: var(--rp-scrollbar-thickness);
	}
	/* Transparent track — the scene IS the track now. */
	.rp-track-scroll::-webkit-scrollbar-track {
		background: transparent;
	}
	.rp-track-scroll::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, var(--rp-active) 60%, transparent);
		border-radius: 999px;
	}
	.rp-track-scroll::-webkit-scrollbar-thumb:hover {
		background: var(--rp-active);
	}

	/* ── Track area ───────────────────────────────────────────── */
	/* ↻ 2026-08-11: no background-color. The chart ground is gone — see the note
	   on .rp-frame for what --rp-chart-bg still means now that nothing paints
	   it. */
	.rp-tracks {
		position: relative;
		/* Fade width for truncating bar labels (buff chips, cd/cast labels) —
		   clipped text dissolves over this many px instead of slicing mid-glyph. */
		--buff-label-fade: 12px;
	}

	/* ── Ruler strip (top time axis, DAW convention) ──────────── */
	/* Full frame width, its own row above the track area — the notes panel
	   pushes only the tracks, never this strip. The viewport is a scroll
	   FOLLOWER (overflow hidden, mirrored in scheduleMirror). Ticks rise to
	   the seam below; labels sit above the stubs. Mirrored by the PNG
	   painter. */
	.rp-ruler-strip {
		position: relative;
		display: flex;
	}
	.rp-ruler-scroll {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		/* Must match .rp-track-scroll's, or the two edges of one instrument would
		   ramp at different rates. A follower needs no scrollbar gutter. */
		--scroll-fade: 48px;
	}
	/* ↻ 2026-08-17: the strip carries the AURA LANE above the ruler, so its
	   contents are a column and the width is stated ONCE, on this box. Two
	   readings of one x axis cannot be allowed to disagree about how long the
	   rotation is. */
	.rp-header-inner {
		position: relative;
		display: flex;
		flex-direction: column;
	}

	/* ── The playhead (playback round, 2026-09-29) ─────────────────────────
	   A 2px gold rule the full height of each scroller. GOLD, not the
	   crosshair's dim ink: the crosshair says "you are pointing here", the
	   playhead says "the rotation is HERE", and the site's engaged hue is
	   gold. Alpha in the PAINT (sub-pixel law); left is `projectX`'s rounded
	   px, so nothing here is transform-placed. Above every bar (the bar
	   ladder tops out at 4 in the tracks) and under nothing. */
	.rp-playhead {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		margin-left: -1px;
		background: color-mix(in srgb, var(--accent) 80%, transparent);
		pointer-events: none;
		z-index: 6;
	}

	/* ── Lap marks (playback round B) ──────────────────────────────────────
	   The seam where a repeat begins: a 1px gold rule on the ruler with its
	   ×N label, and the same rule faint down the tracks beside the gridlines
	   (z:0, under every bar — it is furniture, where the playhead is not). */
	.rp-lap-mark {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: color-mix(in srgb, var(--accent) 70%, transparent);
		pointer-events: none;
	}
	.rp-lap-label {
		position: absolute;
		top: 2px;
		left: 4px;
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		color: var(--accent);
		white-space: nowrap;
	}
	.rp-lap-line {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: color-mix(in srgb, var(--accent) 28%, transparent);
		pointer-events: none;
		z-index: 0;
	}
	/* No seam under the ruler (round two, with the slot separators). The ticks
	   rising to the axis line ARE the axis; a rule beneath them was saying the
	   same thing a second time, in the heaviest way available. */
	.rp-ruler {
		position: relative;
		/* Its width comes from .rp-header-inner now — see there. */
		width: 100%;
	}
	/* ══ A TICK IS THE TOP OF ITS OWN GRIDLINE (⚓ NATE 2026-08-11) ════════════
	   ⚓ "Unify the tickmarks with their lines — either remove the tickmarks and
	   have the lines serve that purpose, or make the tickmark's color at the top
	   of the gradient blend in."

	   The second reading, and the mismatch he was seeing was real and specific:
	   a MAJOR tick was painted --border while the line continuing straight down
	   from it started at --rp-grid, which is that same ink at 45%. So the stroke
	   got visibly DIMMER at the moment it crossed from ruler into chart — one
	   line rendered as two objects, with a seam at the join.

	   Each tick now takes exactly its own line's opening stop: majors --rp-grid,
	   minors --rp-grid-faint. Nothing separates the two elements — .rp-ruler
	   lost its border-bottom in round two and the ticks sit at bottom: 0 — so a
	   tick now reads as the part of the gridline that rises INTO the axis, which
	   is what it always was geometrically. The 8px/4px heights stay: they are
	   how far up each level reaches, and they are the only thing distinguishing
	   the two in the ruler now that the labels sit above.

	   ⚠ KEEP THE FOUR VALUES IN TWO PAIRS. tick colour ↔ gradient's first stop,
	   per level. Change one and the seam comes back. */
	.rp-tick {
		position: absolute;
		bottom: 0;
		width: 1px;
		background: var(--rp-grid-faint);
		height: 4px;
	}
	.rp-tick.major {
		height: 8px;
		background: var(--rp-grid);
	}
	.rp-tick-label {
		position: absolute;
		bottom: 11px;
		left: 0;
		transform: translateX(-50%);
		font-size: var(--fs-sm);
		color: var(--muted);
		white-space: nowrap;
		pointer-events: none;
	}

	/* ── Overlay layers (gridlines + swap connectors) ─────────── */
	/* Plain divs, deliberately: Safari pixel-snaps CSS boxes but paints
	   inline-SVG geometry at the exact fractional page offset, so SVG
	   overlays here sat ~1px off the bars they join (Chrome/Firefox were
	   flush). See connectorStyle. */
	/* ══ THE GRIDLINES FADE DOWNWARD (⚓ NATE 2026-08-11, round two) ═══════════
	   They ran full height at one strength, which on the bare scene made them
	   the strongest structure on screen — vertical bars of ink from the ruler to
	   the last lane, holding the chart in a cage. You read time at the TOP, next
	   to the axis that labels it, so that is where the reference belongs; below
	   the first slot it is reassurance you have already had.

	   A HORIZON, NOT A CAGE. Full strength at the ruler, gone by
	   --rp-grid-fade — so the chart is precisely located where you look for a
	   time and floats where you don't.

	   ⚠ ON FADING TO THE `transparent` KEYWORD, which the moonsign bar warns
	   about. Two different things get called the same trap and only one is real
	   here. The moonsign case is a BLOOM: transparent stops sitting BETWEEN two
	   different hues mid-gradient, where an engine that interpolates
	   un-premultiplied drags the midpoints toward black. This is the benign
	   shape — one hue fading to nothing at the END. Gradients interpolate in
	   PREMULTIPLIED space, where a stop at alpha 0 contributes no colour at all,
	   so the hue is carried by the live stop the whole way down.
	   And the belt to that brace: the residue is bounded by the ground behind
	   being the dimmed scene at roughly #12151c–#1e222a, so even a wrong
	   interpolation would travel a couple of levels. Neither reason survives on
	   a light surface — don't copy this shortcut there.
	   ⚠ And this is a gradient taking a derived value, NOT a color-mix taking
	   one — the nesting law is about mix-inside-mix. The NB and moonsign fills
	   already put color-mix results inside gradients.

	   ↻ ⚓ NATE 2026-08-11, same day: THE SUB-5s TICKS GET LINES TOO — "fainter
	   and shorter than the main separators". Two levels of the same idea.

	   ↻ AND THEN, MEASURED: ⚓ "I think I was wrong about height being the main
	   factor to make them not too noisy — it's visibility mostly." Worth
	   recording because I had it backwards in the same breath as building it: I
	   argued shortness was what kept a dense grid from accumulating into
	   texture, and reached 45%. His inspector pass says the reach can run almost
	   the full chart (85%) as long as the ink is quiet enough (17%). A faint
	   line that goes far reads as depth; a darker line that stops short reads as
	   a mark that ended.

	   🎛️ The knobs are --rp-grid-fade / --rp-grid-fade-minor (how far each
	   reaches) and --rp-grid / --rp-grid-faint (how dark each starts). */
	.rp-gridline {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: linear-gradient(
			to bottom,
			var(--rp-grid-faint),
			transparent var(--rp-grid-fade-minor)
		);
		pointer-events: none;
		z-index: 0;
	}
	.rp-gridline.major {
		background: linear-gradient(to bottom, var(--rp-grid), transparent var(--rp-grid-fade));
	}
	.rp-connector {
		position: absolute;
		background: var(--rp-active);
		pointer-events: none;
		z-index: 1;
	}

	/* ── Team buffs row ───────────────────────────────────────── */
	/* Lane rows carry border-TOP separators only (team buffs' opening line is
	   the 4th char block's border-bottom), so whichever lane is bottom-most
	   leaves NO line before the ruler gap. Mirrored by the PNG painter. */
	.rp-team-buffs {
		position: relative;
	}
	.rp-team-buff-rows {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 2px 0;
	}
	.rp-team-buff-subrow {
		position: relative;
		height: var(--rp-aux-bar-h);
		flex-shrink: 0;
	}
	/* ══ THE BAR FILLS ITS ROW (⚓ NATE 2026-08-11, round two) ═════════════════
	   Round one took Genshin's HP-bar idiom — a bar too slim to contain its own
	   label, with the glyphs breaking its top and bottom walls — and it was the
	   wrong borrowing. Genshin's bar is ONE bar with nothing stacked under it;
	   ours is a lane of stacked rows, and there the escape room and the gap
	   between bars are THE SAME PIXELS. A 6px bar centred in a 12px row put
	   consecutive bars 8px apart where they had been 2px, which is the noise
	   Nate called out. Filling the row is the fix, and it is the whole fix.

	   ⚠ WHAT DIED WITH IT, so nobody re-derives it: the label went back to
	   --fs-xs (11px does not fit a 12px row with the bar in it), and the bar
	   clips its own label again, so .rp-buff-label's max-width is once more a
	   refinement rather than the only bound. labelCapPx still applies whether or
	   not the bars overlap — that part of round one was right and is worth
	   keeping: it makes a label dissolve at the neighbour's edge instead of
	   sliding under it.

	   ⚠ WHAT DID NOT COME BACK: the inset hairline ring. It lifted a
	   low-luminance fill off the chart ground, and there is no chart ground now
	   — the scene is darker than the ground it compensated for. The 2px bright
	   left edge went with it in the flattening pass. */
	/* ══ THE LEFT EDGE COMES BACK (⚓ NATE 2026-08-11) ═════════════════════════
	   ⚓ "They really are better with a 2px left border — #fff at .3. The main
	   purpose is to separate stacking buff bars, of course. It also helps
	   distinguish their look — that they're specifically a different kind of bar
	   from the others."

	   A deliberate exception to this morning's flattening pass, which took the
	   2px edge off EVERY bar. That was right as a sweep and wrong for this one
	   consumer, and the reason is in the material: glass bars in one subrow can
	   share a span, and where two overlap the alpha stacks into a single
	   continuous slab with no seam. Every other bar on the chart is opaque, so
	   the one in front simply covers the one behind and the boundary draws
	   itself. These need the boundary drawn for them.

	   ⚠ WHITE AT .3, NOT THE BAR'S OWN HUE LIGHTENED. It is the only edge left on
	   the chart, so it is also doing identity work — a neutral highlight reads as
	   "a lit edge on this material" rather than as a second colour in the
	   register, and it survives whatever the element round does around it.
	   ⚠ Safe against the timing: the global reset is border-box, so the 2px
	   comes OUT of the bar's computed width rather than adding to it. A
	   content-box border here would push every bar 2px past its end time.
	   ⚠ Mirrored in the export as the composited literal — canvas has no
	   translucency over a scene to resolve. */
	.rp-team-buff-bar {
		position: absolute;
		top: 0;
		height: 100%;
		background: var(--glass-bar);
		border: none;
		border-left: 2px solid rgb(255 255 255 / 0.3);
		border-radius: 1px;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 5px;
		overflow: hidden;
		z-index: 2;
		min-width: 2px;
	}
	/* ⚓ THE SEAM — where a SHORTER part of one cast's buff ends (pool round,
	   2026-09-17). Same ink as the leading edge, because it is the same
	   statement: "the buff changed here". Placed in the bar's padding box (the
	   2px border is subtracted by the caller), clipped by the bar's overflow.
	   ⚠ Paint alpha, not element opacity — the bar is left/width-placed inside a
	   scroller, and the sub-pixel laws apply the day that layer ever animates. */
	.rp-buff-seam {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: rgb(255 255 255 / 0.3);
		pointer-events: none;
	}
	/* ══ PICKED (inspector round, 2026-10-23) ══════════════════════════════════
	   Under the switch a buff bar is a door into the inspector, so it says so
	   with the cursor; the bar the pane is showing wears the GOLD ring — the
	   glass grammar's "selected", ⛔ never a fill change, which would read as a
	   different buff. An INSET shadow: paint inside the bar's own box, so it
	   moves no geometry and the bar's `overflow: hidden` cannot clip it.
	   ⚠ DOM-only by construction: the PNG export draws from the rows, never
	   from these classes, so a picked bar exports unringed. */
	.rp-inspectable {
		cursor: pointer;
	}
	.rp-inspected {
		box-shadow: inset 0 0 0 1.5px var(--accent);
	}
	/* ⛔ THE DEBUFF VARIANT IS GONE (⚓ NATE 2026-08-11). It carried its own fill
	   through three colour schemes — dire, then --debuff-fill, then a cool
	   counterpart — and the round that was supposed to perfect the split killed
	   it instead: "there's really no need to colour-split the buff/debuff bars.
	   They're both good things to the user. Splitting them only adds
	   complication to the chart, when we want to go in the opposite direction
	   and simplify." A buff on you and a shred on the enemy are the same fact to
	   a reader — something helpful is running — so they are one bar now. The
	   `kind` is still in the data and still in the tooltip; it just stopped
	   being paint. */
	.rp-buff-icon {
		width: 11px;
		height: 11px;
		flex-shrink: 0;
		object-fit: contain;
		/* ↻ ⚓ NATE 2026-08-11: half strength, with the labels. ⚠ AND THIS ONE HAS
		   TO BE ELEMENT OPACITY where the label alongside it uses paint alpha —
		   an <img> has no colour channel to dim. The sub-pixel laws prefer paint,
		   but they are about transform-placed subtrees, and these icons are
		   placed by `left`/`width` in px inside a scroller. If a future round
		   ever transform-animates the track layer, this is the line that will
		   shimmer first. */
		opacity: 0.65;
	}
	.rp-buff-label {
		/* Truncation fade (--buff-label-fade, set on .rp-tracks): the mask's
		   transparent tail lines up with the padding, so a label that FITS shows
		   no fade — only clipped text runs under it and dissolves instead of
		   slicing mid-glyph.
		   ↻ 2026-08-11 round two: back to --fs-xs. The bar fills its row again
		   (see .rp-team-buff-bar), so the label is sized to fit inside one —
		   --fs-sm was what the slim bar bought and it went back with it. The
		   colour does NOT go back: full white stays. ⚓ Nate: "all labels back to
		   white, please — especially since we're going right over the scene."
		   ↻ 2026-08-11: semibold → medium (⚓ Nate), and it is a true 500 — the
		   body face went variable in the same session, so this rung exists.
		   ↻ 2026-08-11, once the bars were glass: HALF-STRENGTH white (⚓ Nate).
		   Alpha in the PAINT, not element opacity — a colour has a channel for
		   this and the sub-pixel laws want it used.
		   ⚠ MEASURED AT ~4:1 ON THE BAR, ~3.6:1 AGAINST A STAR — under the 4.5:1
		   small-text floor, deliberately. The full table and the reasoning live
		   at --glass-bar in app.css; the short version is that these labels are
		   supplementary (the tooltip carries every bar's real detail) and the
		   point of the round was that dozens of them should not shout. α .62 is
		   where it would clear AA, if it ever needs to. */
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		color: rgb(255 255 255 / 0.65);
		white-space: nowrap;
		letter-spacing: var(--ls-mid);
		pointer-events: none;
		line-height: var(--lh-none);
		min-width: 0;
		overflow: hidden;
		padding-right: var(--buff-label-fade);
		-webkit-mask-image: linear-gradient(
			to right,
			#000 calc(100% - var(--buff-label-fade)),
			transparent
		);
		mask-image: linear-gradient(to right, #000 calc(100% - var(--buff-label-fade)), transparent);
	}

	/* Identical to .rp-team-buff-bar now — same material, same geometry. It used
	   to borrow the debuff register (Nate 2026-07-18), which was always a visual
	   choice rather than a semantic one: a weapon ICD is on your OWN character,
	   not the enemy. With one bar material there is nothing left to borrow. */
	.rp-weapon-proc-bar {
		position: absolute;
		top: 0;
		height: 100%;
		background: var(--glass-bar);
		border: none;
		border-left: 2px solid rgb(255 255 255 / 0.3);
		border-radius: 1px;
		display: flex;
		align-items: center;
		padding: 0 5px;
		overflow: hidden;
		z-index: 2;
		min-width: 2px;
	}

	/* ── NB lane ─────────────────────────────────────────────── */
	/* Border-top gone with the slot separators (round two) — same rule, same
	   reason. These lanes are already set off by the whole slot stack ending
	   above them and by their own sticky lane names. */
	.rp-nb-lane {
		position: relative;
	}
	.rp-nb-rows {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 2px 0;
	}
	.rp-nb-subrow {
		position: relative;
		height: var(--rp-aux-bar-h);
		flex-shrink: 0;
	}
	/* Phlogiston fill (Nate 2026-07-18) — static "flowy" fire gradient echoing
	   the in-game Natlan energy bar. Layered px-sized tiles (odd prime widths
	   so layers never visibly sync) repeat-x over the bar: one aquamarine
	   hot-spot layer (mixed toward the light orange — full #70e1c1 is too hot
	   at this size), two light-orange blooms, and a drifting linear flow base.
	   Fixed px tiles keep the density constant at any bar width/zoom.

	   ↻ 2026-08-11 round two: THE EDGE GRAMMAR IS GONE — the heavy left border
	   and the thin ring both (Nate 2026-07-28 gave them to every bar; the
	   flattening pass takes them back from every bar). The phlogiston fill was
	   always the point of this lane, and it carries itself.
	   ⚠️ Mirrored by paintNbBar() in timelineExport.ts. */
	.rp-nb-bar {
		position: absolute;
		top: 0;
		height: 100%;
		border: none;
		background-color: #f85b21;
		background-image:
			radial-gradient(
				24px 12px at 160px 30%,
				color-mix(in srgb, #70e1c1 55%, #e1a566) 0%,
				transparent 82%
			),
			radial-gradient(34px 12px at 60px 75%, #e1a566 0%, transparent 72%),
			radial-gradient(26px 10px at 15px 25%, #e1a566 0%, transparent 70%),
			linear-gradient(
				100deg,
				#f85b21 0%,
				#e1a566 24%,
				#f85b21 46%,
				color-mix(in srgb, #f85b21 55%, #e1a566) 65%,
				#e1a566 82%,
				#f85b21 100%
			);
		background-size:
			211px 100%,
			173px 100%,
			127px 100%,
			251px 100%;
		background-repeat: repeat-x;
		border-radius: 1px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		z-index: 2;
		min-width: 2px;
	}
	/* NB is a lane, not an E/Q/summon bar — its label stays semibold and its
	   halo pins the phlogiston palette's darkest orange. */
	.rp-nb-bar .rp-bar-cast-label {
		position: absolute;
		left: 5px;
		font-weight: var(--fw-semibold);
		/* Dissolve on narrow bars instead of hard-clipping at the bar edge. */
		max-width: calc(100% - 5px);
		overflow: hidden;
		padding-right: var(--buff-label-fade, 12px);
		-webkit-mask-image: linear-gradient(
			to right,
			#000 calc(100% - var(--buff-label-fade, 12px)),
			transparent
		);
		mask-image: linear-gradient(
			to right,
			#000 calc(100% - var(--buff-label-fade, 12px)),
			transparent
		);
	}
	/* ⏸️ THE .9 DIM IS REVERTED (⚓ NATE 2026-08-11, same day). It shipped for a
	   few minutes as a ::before at opacity .9 so the labels could stay white.
	   His own diagnosis is why it went: "the problem is that they're just too
	   bright right now, and I was trying to solve it with opacity when I should
	   really be adjusting their colours. Let's hold off until after we adjust
	   element colours, as that will also affect the brightness/saturation
	   balance on the timeline."

	   ⚠ WORTH KEEPING AS A RULE: opacity is not a brightness control. Dimming a
	   fill to fix "too bright" makes it thinner as well as darker, and on a
	   translucent chart that reads as a different MATERIAL rather than a
	   different colour — which is a change nobody asked for, applied to the two
	   lanes whose fills are the most deliberately authored on the chart.
	   ⛔ So the fill is back on the bar itself and the ::before is gone; the
	   export's globalAlpha went with it. Don't reintroduce either as a
	   brightness lever.

	   ✅ CLOSED 2026-08-12, AND NOT THE WAY THE NOTE ABOVE EXPECTED. The element
	   colours did move (twice — Genshin's palette, then the `bar` rung), and
	   ⚓ Nate looked again: "they fit in pretty well with the new bars. Let's keep
	   them for now." No palette change here.

	   🐛 AND THE PREMISE WAS WRONG ANYWAY — worth recording so nobody re-opens it
	   on the old reasoning. Measured against the shipped bar rung, these two are
	   DARKER than every element bar and their labels read BETTER:
	     brightest element bar (cryo #50e1e2)  lum .610  white-on-fill 1.59
	     NB       #f85b21 → #e1a566            lum .275–.439      2.15–3.23
	     moonsign #b0a9ff → #bea1ff            lum .437–.448      2.11–2.16
	   "Too bright" was never a luminance fact, so darkening the palette — the fix
	   this note assumed — was aimed at the wrong axis. The likelier reading is
	   that they are the LAST TWO LIT BARS on a chart that was flattened
	   (castFill() went flat the same day); busy reads as bright. Left alone
	   because Nate's eye is the verdict and his eye now says they fit. ⚠ If it
	   ever comes back, try FLATTENING before re-colouring. */
	/* ⚓ NATE 2026-08-12: the buff register's 2px left edge comes to these two.
	   It was the buff/proc bars' alone because it was justified by GLASS — two
	   translucent bars sharing a span stack into one slab with no seam, and every
	   opaque bar draws its own boundary by covering what is behind it. That is
	   still true, but it is not the only thing the edge does: it is the annotation
	   register's tell, and NB and moonsign are annotation lanes. Now that they sit
	   beside deeper element bars rather than brighter ones, the edge is what says
	   these belong to the same family as the buffs above them.
	   ⚠ Declared here rather than on the shared rule because the two lanes carry
	   their own multi-stop fills; box-sizing is border-box so the 2px comes OUT of
	   the width and no bar ends 2px late. */
	.rp-nb-bar {
		--label-halo: #f85b21;
		border-left: 2px solid rgb(255 255 255 / 0.3);
	}

	/* ── Moonsign lane ───────────────────────────────────────── */
	.rp-moonsign-lane {
		position: relative;
		/* Border-top gone with the slot separators — see .rp-nb-lane. */
		/* Halo — a dark indigo shade of the pale moonlight palette, so the white
		   labels keep separation now that the bar itself is soft/light. */
		--label-halo: #2b3576;
	}
	.rp-moonsign-rows {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 2px 0;
	}
	.rp-moonsign-subrow {
		position: relative;
		height: var(--rp-aux-bar-h);
		flex-shrink: 0;
	}
	/* Moon-gravity-wave fill (Nate 2026-07-18) — same layered-tile technique as
	   the NB phlogiston bar. The five palette colors always sit adjacent in
	   order (deep yellow → lemon → turquoise → aqua → deep blue), so the base
	   wave runs the spectrum forward then mirrors back for a seamless loop.
	   Evenly spaced stops keep the ramp maximally smooth. A semi-transparent
	   counter-wave at a different angle/prime width adds the interference
	   shimmer. Long prime tile widths keep the waves slow and smooth;
	   repeat-x. */
	.rp-moonsign-bar {
		position: absolute;
		top: 0;
		height: 100%;
		/* Buff-bar label grammar: icon + label ranged left, same inset — and
		   since 2026-08-12 the buff register's 2px edge too; see .rp-nb-bar. */
		border-left: 2px solid rgb(255 255 255 / 0.3);
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 5px;
		overflow: hidden;
		background-color: #b0a9ff;
		background-image:
			linear-gradient(
				80deg,
				#69dbf200,
				#69dbf266 15%,
				#69dbf200 30%,
				#ef8e9100,
				#ef8e9133,
				#ef8e9100
			),
			linear-gradient(100deg, #87b3ff, #b0a9ff 25.21%, #bea1ff, #b0a9ff, #87b3ff);
		background-size:
			433px 100%,
			719px 100%;
		background-repeat: repeat-x;
		/* 🐛 2026-08-14: a `border: none` sat HERE, left over from the flattening
		   pass, and the shorthand reset the border-left declared 20 lines up — so
		   the moonsign lane was the one annotation bar with no 2px register edge.
		   ⚠ The fill is a background, not a border, so there is nothing left for
		   the reset to remove; it is deleted rather than narrowed. */
		border-radius: 1px;
		z-index: 2;
	}
	/* This override is a no-op since the buff labels went full white (2026-08-11)
	   and is kept only as the anchor for the halo selector below — the moonsign
	   fill is light enough that its labels are the one place the halo is load-
	   bearing rather than ornamental. */

	/* ── Target aura lane (gauge round L6) ────────────────────── */
	/* ⚓ THE ONLY LANE THAT IS NOT MADE OF BARS AT ALL, and it says so in its
	   materials. Every other lane down here draws a granted effect: a filled
	   register bar with a 2px lit edge, a stat icon and a source name. This one
	   draws the TARGET'S state — not something anyone gave anyone — so it takes
	   none of that grammar. It is a CHART: a line whose height is a quantity over
	   a fill that fades away beneath it, on the bare night like the timeline above
	   it. A reader should not have to be told these are a different kind of
	   object.
	   ↻ It shipped as one bar per mod and became this when ⚓ Nate measured the
	   premise: auras barely coexist, so N thin lanes were paying for a collision
	   that mostly does not happen — and the height they were spending is exactly
	   what depth needed. */
	.rp-aura-lane {
		position: relative;
		display: flex;
		flex-direction: column;
	}

	/* Reaction band ─ the labels sit ABOVE their applications, which sit above
	   the auras they made. Each band annotates the one below it. */
	.rp-aura-markers {
		position: relative;
		flex-shrink: 0;
	}
	.rp-aura-marker {
		position: absolute;
		cursor: pointer;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 3px;
		/* The marker's x is the reaction's INSTANT; the label runs right from it
		   rather than centring on it, so the pip stays honest at any zoom and two
		   markers can never swap reading order. */
		transform: translateX(-1px);
		z-index: 3;
	}
	/* ⛔ NO RUN BRACKET, and the reason is geometry rather than taste (2026-08-17).
	   A hairline from the pip to the run's last tick was built and reversed: at
	   resting zoom a real Electro-Charged run measured 72px while its own label
	   measured 82px, so the extent is SHORTER than the word above it and renders
	   as an underline of the text — at --rp-grid (nearly invisible), at
	   --chart-dim (a link underline), and with an end pip (two marks reading as
	   two reactions, the exact confusion the collapse removes). The count lives
	   in the NAME instead. ⚓ A chart cannot draw a duration narrower than the
	   duration's own name; check that ratio before drawing an extent here. */
	.rp-aura-marker-pip {
		width: 3px;
		height: 3px;
		flex-shrink: 0;
		border-radius: 999px;
		/* ⚠ A reaction is not an element and must not borrow one — it is what
		   happened BETWEEN two. Neutral chart ink, the same voice the ruler
		   speaks in. */
		background: var(--chart-dim);
	}

	/* ══ LIT — THIS MARK IS AT THE FOCUSED INSTANT (2026-08-17) ═══════════════
	   ⚓ INK BRIGHTENS HERE, A GROUND FILLS IN THE LOG, and the difference is
	   what each object is made of: a log row has AREA, so it can take a fill; a
	   marker is two or three pixels of ink standing on the night, and a fill
	   behind it would be a bigger object than the mark itself.
	   ⚠ The label lifts with its pip — they are one mark, and lighting only the
	   3px dot under a word that stays dim reads as a rendering glitch. */
	.rp-aura-marker--lit .rp-aura-marker-pip {
		background: var(--text);
	}
	.rp-aura-marker--lit .rp-aura-marker-label {
		color: var(--text);
	}
	/* ⛔ NO `overflow`/`text-overflow` HERE ANY MORE (2026-08-17). They existed to
	   cap a label at the room available, which is exactly the clipping that
	   produced `Electro-C`; the label is now either drawn in full or not drawn at
	   all (`auraMarkerLabels`), so a cap could only ever hide the fact that the
	   measurement was wrong. ⚠ If a label ever overlaps its neighbour again, the
	   bug is in AURA_LABEL_FONT drifting from this rule — fix the mirror, don't
	   re-add the clip. */
	.rp-aura-marker-label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		color: var(--chart-dim);
		white-space: nowrap;
		line-height: var(--lh-none);
		pointer-events: none;
	}

	/* Application strip ─ one PILL per gauge landed on the target, sitting on the
	   head of its hairline (which is drawn in the plot's SVG below). */
	.rp-aura-ticks {
		position: relative;
		flex-shrink: 0;
	}
	.rp-aura-tick {
		position: absolute;
		cursor: pointer;
		bottom: 0;
		width: calc(var(--rp-pill-r) * 2);
		height: calc(var(--rp-pill-r) * 2);
		/* Centred on its instant — the hairline below leaves from the same x. */
		margin-left: calc(var(--rp-pill-r) * -1);
		border-radius: 999px;
		/* ⚠ Alpha in the PAINT, never element opacity — these are
		   transform-adjacent marks and an opacity subtree rasterizes at rounded
		   coordinates in WebKit (the sub-pixel laws). The inline background
		   carries the element colour; the strip itself is what recedes. */
		opacity: 0.9;
	}

	/* ⚓ A RING, because the pip's own body is the ELEMENT and must stay legible
	   as one — recolouring it to say "focused" would cost the only thing it is
	   there to say. White reads on every element hue at this size, and it is the
	   hover register (⛔ gold means SELECTED, and nothing here is).
	   ⚠ box-shadow rather than a border: a border would grow the 8px disc and
	   shift it off its instant, since the pip is centred by a negative margin
	   computed from its radius. */
	.rp-aura-tick--lit {
		opacity: 1;
		box-shadow: 0 0 0 2px var(--chrome);
	}
	/* ⚓ THE SQUIGGLE RULE, as a FOOT. --ui-provisional is a provenance
	   statement — "we took this application and its unit value is a stand-in" —
	   so it must not replace the element colour, which is the tick's identity.
	   It sits under the tick instead: the mark still reads as its element, and
	   what is uncertain is the ground it stands on. Measured, most rotations run
	   60–90% defaulted, so a nearly-solid yellow footline is the honest picture
	   and not an error state. */
	/* ↻ A RING, not a foot (2026-08-17). The mark moved with its host: a foot
	   under a 2px stub became a ring around a disc, which keeps the rule intact —
	   --ui-provisional is a statement about the VALUE, so it must not replace the
	   element colour that is the pill's identity. ⚠ Drawn as a box-shadow rather
	   than a border so the pill's diameter (and therefore its centring on the
	   hairline) does not change when the flag does. */
	.rp-aura-tick--provisional {
		box-shadow: 0 0 0 1px var(--ui-provisional);
	}
	/* ⚠ The hit area is still grown past the paint. The pill is a real target now
	   rather than a 2px stub, but at a dense burst the discs are only a few px
	   apart and the extra ring makes pointing forgiving. Nearest in DOM order
	   wins where two overlap, which means the later application — the one a
	   reader is pointing at. */
	.rp-aura-tick::after {
		content: '';
		position: absolute;
		inset: -2px;
	}

	/* ⚓ ONE PLOT, at 1:1 with the track. The row form's SVG was normalized and
	   stretched into each bar's width, which forbade a stroke; a single SVG sized
	   to the track draws in real pixels, so the gauge LINE is a 2px stroke of
	   uniform weight and the fill can fade out beneath it. */
	.rp-aura-plot {
		position: relative;
		flex: 1;
		margin: 2px 0;
	}
	/* ══ THE GADGET STRIP ══════════════════════════════════════════════════════
	   ⚠ `flex-shrink: 0`, like the marker and tick bands: `.rp-aura-plot` is
	   `flex: 1` (basis 0, grow 1) and would otherwise eat this strip's height —
	   the plot's inline height is a statement of intent that the flex-grow
	   honours only because `auraLaneH` accounts for every band exactly. */
	.rp-gadget-strip {
		position: relative;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.rp-gadget-row {
		position: relative;
		flex-shrink: 0;
	}
	.rp-gadget-row svg {
		display: block;
		/* ⚠️ THE HOVER RING NEEDS TO PAINT OUTSIDE THE BOX. An SVG root clips to its
		   viewport by default, and a spawn disc is exactly as tall as its row — a
		   dot at cy = r touches both edges — so the 2px ring was shaved off the top
		   on the core row and off BOTH edges on the Prism's, whose row is one dot
		   tall. ⛔ Not fixed by shrinking the disc: it is deliberately the
		   application pill's size (⚓ Nate), and ⛔ not by padding the row, which
		   would spend strip height on a state that is only visible under the
		   cursor. The overhang is 1px into a 2px row gap, so it collides with
		   nothing. */
		overflow: visible;
		/* ⚠ Sized in the markup at the track's own width, like the aura plot — a
		   percentage width would stretch every dot into an ellipse and give the
		   1px leader a non-uniform weight (the objectBoundingBox trap). */
	}
	/* ⚠ ALPHA IN THE PAINT — `fill-opacity` / `stroke-opacity` per element, never
	   element `opacity` on a transform-placed subtree (sub-pixel laws). Dimming
	   is therefore a value change on each mark rather than a wash over the group,
	   which is why the transition names the two properties. */
	.rp-gadget-row path,
	.rp-gadget-row circle {
		transition:
			stroke-opacity var(--t-snap),
			fill-opacity var(--t-snap);
	}
	.rp-aura-svg {
		display: block;
		/* ⚠ The svg is sized in the markup (width = totalWidth), not stretched by
		   CSS — a percentage width here would re-introduce the non-uniform scaling
		   the whole conversion exists to escape. */
		pointer-events: none;
	}
	/* Each aura names itself where it APPEARS, which is the one moment the word
	   is news. ⚠ Sits ON the plot because an overlaid chart has nowhere to put a
	   permanent legend that is not on top of the data; the halo is what keeps it
	   off its own fill. The PNG export does have somewhere — see its label
	   column. */
	/* The unit datum's labels, in the frame's left padding on the far side of 0s.
	   ⚠ NOT in the plot's SVG and NOT in the scroller: a datum legend that
	   scrolled away with the chart would be useless exactly when a reader needs
	   it. `right: 100%` hangs the column off the plot's left edge. */
	.rp-aura-units {
		position: absolute;
		/* Out into .rp-frame's padding — the strip's own left edge is already inset
		   by exactly that, so this walks back that far and no further. */
		left: calc(var(--rp-frame-pad-x) * -1);
		width: var(--rp-frame-pad-x);
		pointer-events: none;
		z-index: 1;
	}
	/* The rule's own voice, not the series names'. A reading that competed with
	   the auras would be furniture shouting. */
	.rp-aura-unit-label {
		position: absolute;
		right: 2px;
		/* Centred ON its rule — the plot's headroom (AURA_PLOT_HEAD) is what makes
		   that possible for the topmost one without clipping. */
		transform: translateY(-50%);
		font-size: 8px;
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		color: var(--chart-dim);
		white-space: nowrap;
	}
	.rp-aura-series-name {
		position: absolute;
		z-index: 3;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		white-space: nowrap;
		line-height: var(--lh-none);
		opacity: 0.8;
		text-shadow:
			0 0 3px var(--frame-bg),
			0 0 6px var(--frame-bg);
		pointer-events: none;
	}
	/* The readout's cursor. ⚓ A hairline, not a highlight: it marks WHERE the
	   tooltip's numbers were taken and must not become a second thing to read. */
	.rp-aura-crosshair {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--chart-dim);
		opacity: 0.45;
		pointer-events: none;
	}

	/* ── Character block ──────────────────────────────────────── */
	/* ⚓ NATE 2026-08-11, round two — NO SLOT SEPARATOR. There was a full-width
	   1px rule under every slot. On the old chart ground that was cheap
	   structure; on the bare scene it was four hard rules across the sky, and
	   with the ruler seam and the lane border-tops the chart read as a cage
	   drawn around bars that are supposed to float.

	   The grouping survives without it, which Nate predicted before the frame
	   came off: bars are element-coloured PER CHARACTER, the active row shows
	   every swap explicitly, and the bench ribbon's cards label each slot group
	   from the left edge. Three redundant signals; the rule was a fourth.
	   The vertical rhythm — CHAR_PAD_TOP/BOTTOM either side of ROW_GAP — is what
	   separates slots now, and it was already doing most of the work. */
	.rp-char-block {
		position: relative;
	}

	/* ── Rows ─────────────────────────────────────────────────── */
	.rp-row {
		position: absolute;
		left: 0;
		right: 0;
	}
	/* ── Ability bars ─────────────────────────────────────────── */
	/* Cast pill: flat element fill (no hairlines/shadows — Nate's call).
	   The only depth is the whisper of top-light in the castFill() gradient
	   set inline. */
	/* Full row height — the old 1px top/bottom inset read as a dark bottom
	   shading line and squared off the tight 1px corner radius (Nate
	   2026-07-18; the actual inset-shadow it echoed died in redesign r5). */
	.rp-bar-uptime {
		position: absolute;
		top: 0;
		height: 100%;
		border-radius: 1px 0 0 1px;
		z-index: 2;
		min-width: 2px;
		display: flex;
		align-items: center;
		padding: 0 3px;
		overflow: hidden;
	}
	.rp-bar-cd {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2px;
	}
	/* ══ THE GHOST CD TRACK (⚓ NATE 2026-08-11) ═══════════════════════════════
	   The cooldown remainder: physically subordinate to the cast pill it flows
	   out of, its right edge landing on the exact moment the ability comes back
	   up. It used to be a slim track OUTLINED on top/right/bottom (left open, so
	   it read as flowing out of the pill), with the outline colour an opaque
	   element mix set inline per bar.

	   ↻ ⚓ NATE 2026-08-11, once the buff bars became glass: "the natural next
	   conclusion is to mix the CD bars with transparent." So the fill is the
	   element at GHOST_FILL_MIX% ALPHA rather than that much element mixed into
	   the chart ground — the same move the buff bars made, for the same reason:
	   there is no chart ground to mix into any more.
	   ⚠ SAFE HERE PRECISELY BECAUSE OF THE Z-ORDER, and this is the one thing to
	   check before copying it. The dim continuation and overflow bars stay
	   OPAQUE mixes because swap connectors pass BEHIND them and must not show
	   through; ghosts sit at z-index 0 and connectors at z-index 1, so a
	   connector paints OVER a ghost and transparency reveals only the scene.

	   ↻ 12px, AND THE OUTLINE IS GONE. ⚓ "Let's change the CD bars to 12px (E/Q
	   is only 1px proud on each side) and let's remove their edge border.
	   They're the last things on the chart with an edge border and I tested it —
	   they don't need it, it cleans it up." Both halves are the same move: the
	   inset was carrying the recession, the outline was carrying the SHAPE, and
	   at 1px proud the pill's own edges state where the ghost begins and ends
	   without help. It is the fill's job now, which is what the ghost mix was
	   always cut to do.

	   ⚠ THE INLINE `style:border-color` WENT WITH IT at both markup sites — a
	   border-colour on a border-less element is a value that resolves, paints
	   nothing, and quietly outlives the reason it existed.
	   ↻ 2026-10-17: the PNG export kept an outlined, 3px-inset ghost ("flat
	   paper, no scene") until Nate spotted it — that reasoning died with the
	   scene-backdrop redesign. It mirrors this rule now; GHOST_EDGE_MIX is gone.

	   🎛️ The 1px inset is the knob: it is the whole of the recession now. */
	.rp-bar-cd--ghost {
		top: 1px;
		height: calc(100% - 2px);
		border: none;
		border-radius: 0 1px 1px 0;
		z-index: 0;
	}
	/* Stance/uptime continuation past the cooldown (Case B): full-height dim
	   tone of the cast bar. Opaque mix, never alpha — connectors pass behind. */
	.rp-bar-cd--overflow {
		top: 0;
		height: 100%;
		border: none;
		border-radius: 0 1px 1px 0;
		z-index: 2;
	}
	.rp-bar-cast-label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: #fff;
		white-space: nowrap;
		pointer-events: none;
		letter-spacing: var(--ls-tight);
		flex-shrink: 0;
	}
	/* 🐛 ⚓ NATE: "I noticed their labels somehow got turned white — it's much too
	   intense. #fff at .5 is probably more right (like the buff bars)." They HAD
	   been turned white, by me, in 27da633 — a comment inserted into the middle
	   of the halo selector list re-pointed this selector at a `color: #fff`
	   body. The full autopsy is at that list; the fix is there too.
	   ⚠ MY FIRST READ WAS WRONG and is worth recording, because it was the
	   plausible one: I checked the declared value, saw .4, and concluded the
	   value had not changed and the CONTEXT had (a darker track under it,
	   everything else on the chart dimmed around it). That story explained the
	   symptom perfectly and was false. Reading the declaration is not reading
	   the cascade.
	   ⚠ The halo left with the whiteness — see the list — which is also what
	   "like the buff bars" means: they carry none either. .5, no halo. */
	.rp-bar-cd-label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		color: rgb(255 255 255 / 0.5);
		white-space: nowrap;
		pointer-events: none;
		/* Same dissolve-not-slice treatment as .rp-buff-label. Symmetric padding
		   keeps the flex-centered label centered; the fade zone lives in the
		   right padding, so it only touches glyphs when the label is actually
		   clipped (narrow bar, or a moonsign window's visible sliver). */
		min-width: 0;
		overflow: hidden;
		padding: 0 var(--buff-label-fade, 12px);
		-webkit-mask-image: linear-gradient(
			to right,
			#000 calc(100% - var(--buff-label-fade, 12px)),
			transparent
		);
		mask-image: linear-gradient(
			to right,
			#000 calc(100% - var(--buff-label-fade, 12px)),
			transparent
		);
	}
	/* NB lane durations stay full-strength — the phlogiston fill swallows the
	   quiet alpha the element ghost tracks use. ⚠ AND THE HALO STAYS HERE, where
	   it left the ghost track: this lane really does have a bright fill of its
	   own, which is the condition the halo exists for. Full white + halo is also
	   the pairing the halo block requires. */
	.rp-nb-bar .rp-bar-cd-label {
		color: #fff;
		text-shadow:
			color-mix(in srgb, var(--label-halo, #081225) 25%, transparent) 0px 1px 2px,
			color-mix(in srgb, var(--label-halo, #081225) 50%, transparent) 0px 0px 6px;
	}
	/* ══ THE LABEL HALO — WHO STILL GETS ONE, AND WHY ═════════════════════════
	   A halo is a soft shadow in a dark shade of the bar's own element colour
	   (--label-halo). Its ONE job is to hold white text off a BRIGHT fill.

	   ↻ 2026-08-11: the bright-chip idiom is retired from this chart (it said
	   full-strength castFill carries DARK ink, and this list enumerated the
	   exceptions that stayed white; ⚓ "all labels back to white" made the
	   exception the rule). So the question stopped being "who stays white" and
	   became "who still has a bright fill".

	   ✅ 2026-08-14 — THE DEFERRED CONTRAST DEBT IS PAID, and the answer to that
	   question turned out to be wider than "the two decorated lanes". The
	   2026-08-11 round left an explicit instruction here: ⚓ "don't worry about
	   whether white works on E/Q labels — just convert them. We'll be balancing
	   element colors in the next session… Don't 'helpfully' add one here in the
	   meantime." That session happened — Genshin's palette was transcribed and
	   then given its `bar` rung (2026-08-12) — so the precondition is met and
	   the instruction has expired.
	   ⚓ Nate 2026-08-14: "the halos were created but not extended far enough
	   such that they emit… it was wired into the bars but not far enough for
	   them to be picked up." Exactly right, and mechanically so: --label-halo is
	   computed per character on .rp-char-block (shiftHue(p.bar, 0, −30)), and
	   the only in-block selector that consumed it was `.rp-bar-cast-label`,
	   which had by then moved to the NB lane. The variable was being derived for
	   nobody. Both element-fill labels inside a char block now take it.
	   ⚠ THE RULE IS THE FILL, NOT THE ROW: E/Q badges and summon/shield labels
	   sit on full-strength castFill and qualify; the buff rows in the same block
	   do NOT, because their bars are `--glass-bar` — translucent over the scene,
	   with nothing bright to be held off.

	   🐛 AND THIS LIST IS WHERE I BROKE THE CD LABELS. In 27da633 I inserted a
	   comment and two rules INTO THE MIDDLE of this selector list, between
	   `.rp-bar-cd-label,` and the moonsign selector. The list silently
	   re-terminated on the moonsign rule's `color: #fff` body — so every
	   selector above it, .rp-bar-cd-label included, was assigned FULL WHITE, and
	   it won on source order over the .4 declared earlier. ⚓ Nate spotted it
	   from the chart alone: "their labels somehow got turned white — it's much
	   too intense." He was right and my first reading of it ("the value never
	   changed, the context did") was wrong.
	   ⚠ THE LESSON IS MECHANICAL, not aesthetic: never insert into a
	   comma-separated selector list. A stray rule inside one does not error — it
	   re-points every selector before it at the next body it finds. Add a
	   separate rule instead, as the two below now are.

	   ⚠ White text over a halo must be FULL opacity: alpha-reduced white lets the
	   shadow bleed through the glyphs. That is why nothing dimmed carries one —
	   and why .rp-bar-cd-label, now at .5, correctly has none. */
	.rp-bar-cast-label,
	.rp-moonsign-bar .rp-buff-label {
		text-shadow:
			color-mix(in srgb, var(--label-halo, #081225) 25%, transparent) 0px 1px 2px,
			color-mix(in srgb, var(--label-halo, #081225) 50%, transparent) 0px 0px 6px;
	}
	/* The element-fill labels inside a character block — the E/Q pill badge and
	   the summon/shield lane label. ⚠ A SEPARATE RULE, not two more selectors on
	   the list above: both take their halo from the char block's own
	   --label-halo rather than a lane constant, and the list above is the one
	   this file has already been broken by inserting into once.
	   ⚠ Both are full-opacity #fff, which is what a halo requires. */
	.rp-bar-row-badge,
	.rp-summon-label {
		text-shadow:
			color-mix(in srgb, var(--label-halo, #081225) 25%, transparent) 0px 1px 2px,
			color-mix(in srgb, var(--label-halo, #081225) 50%, transparent) 0px 0px 6px;
	}

	/* ⚠ THE MOONSIGN LANE OPTS OUT OF THE .5 DIM, by law rather than taste: its
	   label carries a halo (above), and halo + alpha-white is the bleed case.
	   Its bar is also the one bar that never became glass — a pale moonlight
	   fill needs full-strength ink on it regardless. */
	.rp-moonsign-bar .rp-buff-label {
		color: #fff;
	}
	.rp-moonsign-bar .rp-buff-icon {
		opacity: 1;
	}
	/* The moonsign lane's lunar glyph is part of that label, so it takes the
	   same halo — text-shadow can't reach an <img>, and drop-shadow's blur is
	   the same standard-deviation semantics, so the two stack identically.
	   Safe as a filter here where the chrome marks were not: this paints once
	   and never hovers, transforms or sits over the parallaxed scene. */
	.rp-moonsign-bar .rp-buff-icon {
		filter: drop-shadow(0 1px 2px color-mix(in srgb, var(--label-halo, #081225) 25%, transparent))
			drop-shadow(0 0 6px color-mix(in srgb, var(--label-halo, #081225) 50%, transparent));
	}

	/* ── Active background strip ─────────────────────────────── */
	/* Summon lane bars — subordinate to E/Q: dimmed via an opaque color-mix
	   toward the chart ground (set inline), NOT opacity — swap connectors
	   pass behind this lane and must not show through. */
	.rp-summon-bar {
		position: absolute;
		top: 0;
		height: 100%;
		border-radius: 1px;
		z-index: 2;
		min-width: 2px;
		display: flex;
		align-items: center;
		padding: 0 3px;
		overflow: hidden;
	}
	/* The absorbed element's fill (see the markup): inside the bar, under its
	   label, to the bar's end — the bar's own overflow clips it. */
	.rp-summon-absorbed {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
	}
	.rp-summon-label {
		position: relative;
		font-size: var(--fs-xs);
		/* ↻ 2026-08-11: bold → medium (⚓ Nate) — a genuine two-rung drop now
		   that the body face is variable. See the --fw-* block in app.css. */
		font-weight: var(--fw-medium);
		/* ↻ 2026-08-11 round two: --bright-ink → white with every other label.
		   ✅ 2026-08-14: the contrast debt that carried is PAID — this label takes
		   the char block's --label-halo (see the halo block). */
		color: #fff;
		white-space: nowrap;
		pointer-events: none;
		letter-spacing: var(--ls-tight);
	}
	/* Per-tick marker rendered on top of the summon bar (P3 — Summon.effects[]
	   summonTick triggers). Short bottom-anchored stub (ruler-mark cadence) —
	   leaves the bar's top-light gradient uncut.
	   ↻ 2026-09-18 (⚓ Nate): 5px at .92 read too faint once the row also
	   carried seams and threshold fires — 7px, opaque. Still a stub (a fire is
	   full-height); the height is the difference between "the summon hit" and
	   "the accrual paid for a hit". */
	.rp-summon-tick {
		position: absolute;
		bottom: 0;
		/* Integer height (≈60% of the 12px bar) — a %-height lands on a
		   subpixel and fuzzes the bottom edge past the bar */
		height: 7px;
		width: 1px;
		z-index: 3;
		pointer-events: none;
		/* No centering shift — a tick at the bar's start time (Linnea Q)
		   must sit flush with the bar's left edge, not straddle it */
	}

	/* A threshold fire's mark on a summon lane (stack-threshold round,
	   2026-09-18): ↻ 2026-10-17 a falling moonbeam gleam (⚓ Nate) — the lilac
	   across (inline, `LUNAR_GLEAM_STOPS`), and a mask that fades it from the
	   bar's top edge to nothing at its foot, where the ticks rise. Centered on
	   its instant — unlike a tick, a fire never coincides with the bar's start.
	   Alpha in the paint and the mask, never element opacity. */
	.rp-summon-fire {
		position: absolute;
		top: 0;
		height: 100%;
		/* LUNAR_GLEAM_W, centred on the instant on whole pixels. */
		width: 10px;
		margin-left: -5px;
		-webkit-mask-image: linear-gradient(#000, transparent);
		mask-image: linear-gradient(#000, transparent);
		z-index: 4;
		pointer-events: none;
	}

	.rp-active-bg {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		background: var(--rp-active);
		z-index: 1;
		min-width: 4px;
		pointer-events: none;
	}
	/* ~?s unknown-duration strip: the original dashed border, now with a
	   semi-opaque fill so the strip reads as a real (if provisional) window
	   rather than an empty outline. */
	.rp-active-bg--unset {
		background: color-mix(in srgb, var(--rp-active) 60%, transparent);
		/* 1px, not 1.5 — Chrome floors border-width to whole CSS px, so this has
		   always painted 1px there; see the measurement at --inset-stroke. */
		border: 1px dashed var(--rp-active);
	}

	/* ── Input blocks ─────────────────────────────────────────── */
	.rp-input-block {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		border-right: 1px solid rgba(8, 18, 37, 0.2);
		box-sizing: border-box;
		z-index: 2;
		min-width: 2px;
		display: flex;
		align-items: center;
		padding: 0 4px;
		overflow: hidden;
	}
	/* Only the frameless N/C/P blocks carry a `title` (the generic-timing
	   tooltip), so this precisely targets them — help cursor for the affordance. */
	.rp-input-block[title] {
		cursor: help;
	}
	.rp-input-block--normal {
		background: var(--rp-active);
	}
	/* Movement (dash/jump) and other non-infused inputs carry NO fill of
	   their own — the active strip's color IS the token surface; only an
	   elemental infusion may overlay it (the inline elemental-normal mix).
	   The old translucent fill here was the accident --rp-active's value
	   was sampled from. */
	.rp-input-block--movement {
		background: transparent;
		box-shadow: none;
	}
	.rp-input-block--unset {
		background: transparent;
		box-shadow: none;
	}
	/* Human timing's padding (2026-09-14): the time a player spent between two
	   inputs the game did not buffer. A hatched sliver OVER the active strip —
	   the character is on field and idle, so the strip shows through and the
	   hatch says "nothing was pressed". No divider: it is a gap, not a token.
	   Mirrored by the PNG export's `pad` branch. */
	.rp-input-block--pad {
		/* 🎛️ ⚓ Nate 2026-09-14: 2px at .12 on a 6px period — the first cut's
		   weight (he liked it) at roughly half its alpha (.22 was "slightly" too
		   loud). A 1px/.14/8px try read as texture and lost the weight; discarded.
		   The three numbers are mirrored by name in timelineExport's PAD_HATCH_*
		   constants. */
		background: repeating-linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.12) 0 2px,
			transparent 2px 6px
		);
		box-shadow: none;
		border-right: none;
		padding: 0;
	}
	/* ↻ 2026-08-11: 0.85 white → full (⚓ Nate, "all labels back to white"). The
	   active strip is opaque so this is not a legibility-over-scene fix, but the
	   token names on it are the chart's most-read text and they now match every
	   other label rather than sitting a step below them for no reason. */
	.rp-active-text {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: #fff;
	}
	/* N/C/P (everything but E/Q) tokens on a no-frame-map character: marking the
	   actions whose timing is generic. Not a domain color — approximate timing
	   is a consequence to the user's data, not a game fact (dire-retirement
	   round, 2026-08-05).
	   ↻ 2026-08-12: --ui-provisional, and THIS RULE ASKED FOR IT IN WRITING. Its
	   own comment called the effect "warning-tinted text" and then reached for
	   --ui-danger, because in a three-value family there was nothing between
	   "you did something wrong" and "everything is fine". Approximate timing is
	   neither: it is a statement about what WE know. The class keeps its
	   --danger suffix for now — renaming it means touching the projection that
	   emits it, and the token is the part that was lying. */
	/* ↻ ⚓ Nate 2026-09-14: a no-frames token is the ORDINARY strip with its
	   label in --ui-provisional — the left-to-right provisional gradient is
	   retired (it was also what the human-timing sliver inherited on a
	   frameless character, which is how it came up), and the label goes from a
	   55/45 mix with white to the provisional ink itself, so the one mark that
	   says "approximate" is the word, not a wash behind it. Mirrored in the PNG
	   export (`approxToken`). */
	.rp-active-text--danger {
		color: var(--ui-provisional);
	}

	/* ── E/Q row left-edge badge ──────────────────────────────── */
	/* ↻ 2026-08-11 round two: --bright-ink → white. This badge and the summon
	   label were the last two holdouts of the bright-chip idiom; both convert,
	   and the --dim variant no longer needs an override because white IS the
	   base now. ✅ 2026-08-14: the deferred contrast debt is PAID — both take the
	   char block's --label-halo (see the halo block). The --dim variant inherits
	   it, which is what it used to get from its own override. */
	.rp-bar-row-badge {
		position: absolute;
		left: 4px;
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: #fff;
		pointer-events: none;
		letter-spacing: var(--ls-tight);
	}

	/* ── Composer (its own panel, below the frame) ────────────── */
	/* Chat-composer register: a single-line notation box as its own inset well
	   (darker-than-its-ground + 1px three-state border = the textfield signal;
	   bg/border styling lives in notationTheme — keep in lockstep).

	   ↻ 2026-08-08: a PANEL, not the frame's bottom edge. Its own ground, its
	   own padding, TOOL_GUTTER of bare scene above it (.rp-root's gap). The
	   12px/14px vertical margins are gone — they were breathing room improvised
	   inside a box that had none to give, and the gutter is the spacing now. It
	   takes the frame's own horizontal padding so the notation box still starts
	   on the same x as the timeline's content above it (probe-frame-rework
	   asserts that, and post-split it is a genuine CROSS-PANEL alignment check
	   rather than the near-tautology it used to be). */
	/* ↻ ⚓ NATE 2026-08-11: NO PANEL. "I'd like to try making the notation box
	   styled like the search boxes in the character roster filter column — with
	   no box around it, taking up all of its width, and directly on the scene."
	   So the `.frame` goes (it was the last opaque panel on this surface) and
	   what remains is a bare row: the FIELD is the object now, exactly as the
	   filter rail's search is a bare .field in a column of scene.
	   ⚠ The horizontal padding stays --rp-frame-pad-x, which is the whole point
	   of that variable: the notation's left edge and the timeline's tracks have
	   started on the same x since the breathing-room round, and losing the panel
	   must not lose the alignment. The vertical padding goes with the panel. */
	/* ⚓ NATE 2026-08-11: its label lines up with the LANE NAMES above it, not
	   with the tracks' edge — so it carries the frame's inset PLUS the lane
	   name's own, and reads as one more lane label at the bottom of the stack.
	   ⚠ The one thing it does NOT share with them is scrolling: the lane names
	   travel with the chart now, this strip does not, because it is not on the
	   time axis at all — an always-on buff has no start. Same x, different
	   behaviour, and that is correct rather than an oversight. */
	.rp-underchart {
		padding: 0 var(--rp-frame-pad-x);
		padding-left: calc(var(--rp-frame-pad-x) + var(--rp-lane-name-inset));
	}

	/* Its own line across the composer, above the editor. */
	.rp-composer:has(.rp-held) {
		flex-wrap: wrap;
	}
	.rp-held {
		flex-basis: 100%;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.35rem 0.5rem 0.5rem;
		font-size: var(--fs-lg);
		color: var(--ui-warning);
	}
	.rp-held-text {
		flex: 1;
		color: var(--text);
	}
	.rp-composer {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 var(--rp-frame-pad-x);
	}
	/* ── PINNED TO THE FOOT (responsive sweep 2026-10-15, §3 item 10) ────────
	   Above `toolMin` the composer sticks to the shell's foot, the way the
	   phone dock pins it: at 1366×768 it started at y≈997 for a four-character
	   rotation, so typing meant scrolling band B, the ruler and the top bench
	   cards off screen. Sticky moves PAINT, never layout — the page is as tall
	   as before, the bench's metrics and its alignment to the track groups are
	   untouched, and where the page does not scroll (1080p and up, a short
	   rotation) nothing sticks and nothing changes.
	   · 8px off the foot, so the field never sits on the screen's edge; the
	     plate below covers that gap.
	   · z 7: over the chart it now floats across (the playhead tops out at 6).
	   ⛔ No padding here and no size change while pinned — see pinWatch.
	   Released below `toolMin` (the block at the end of this sheet). */
	.rp-composer {
		position: sticky;
		bottom: 8px;
		z-index: 7;
	}
	/* The plate it stands on while pinned, as a pseudo-element that reaches 8px
	   past the BODY (the field + its history pair) on every side, so the row
	   keeps its size. Transparent at rest, so at the page's end it is the bare
	   row it always was; the SURFACE band (--t-quick), alpha in the paint.
	   OPAQUE, the aside's own rung (--surface-raised, slate-700): the dock's
	   glass (slate-700 at .8) was tried first, and at 1366×768 the bars under a
	   pinned box read straight through the notation — the dock's chart is
	   behind one collapsed line, this one is behind every line you type.
	   ↻ 2026-10-18 (⚓ Nate): on the BODY, not the row. Hung off .rp-composer
	   it was as wide as the main column — empty slate past the field's
	   140-character measure (1630px of plate for 1116 of field at 1920), and
	   its right edge jumped 278px when the aside opened. Now it is the field's
	   own footprint: its left edge is the field's −8 at every width, and its
	   right edge moves only where the field's does. */
	.rp-composer-body {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		/* Shrink-wrap: as wide as the field's measure plus the pair, or the
		   row, whichever is less (see .rp-notation-wrap's `width`). */
		flex: 0 1 auto;
		min-width: 0;
	}
	.rp-composer-body::before {
		content: '';
		position: absolute;
		inset: -8px;
		z-index: -1;
		border-radius: var(--r-md) var(--r-md) 0 0;
		background-color: transparent;
		transition: background-color var(--t-quick);
		pointer-events: none;
	}
	.rp-composer--pinned .rp-composer-body::before {
		background-color: var(--surface-raised);
	}
	/* The dock keeps its own one wrapping row (field · pair · key row). */
	.rp-composer--docked .rp-composer-body {
		display: contents;
	}
	/* ⛔ `.rp-composer--picking` AND `.rp-explore-link` LEFT WITH THE SOURCE
	   (2026-08-13). The first dimmed and blanked the composer while the picker
	   was up — the overlay bounded to the frame and no longer reached down here,
	   so the takeover had to be asserted rather than inherited. The second was
	   the picker's own footer chip, "← Explore alternatives", which opened the
	   Team Builder on the whole team; ⇄ on a bench card supersedes it and aims
	   at ONE slot, so the planner keeps a single way out instead of two. */
	.rp-notation-wrap {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		/* ── A READING MEASURE (responsive sweep 2026-10-15, §3 item 14) ─────
		   140 characters of the notation, then it wraps: the box ran to 196
		   characters a line at 1920 and 391 at 3440. Its left edge stays the
		   tracks' (the composer's padding), and the history pair follows the
		   bounded field instead of standing at the far end of the row.
		   ⚠ The editor's own metrics, restated (as .rp-history's height is):
		   IBM Plex Mono advances 0.6em, at notationEditorExtension's 13px, plus
		   .cm-content's 12px a side — change one, change the other. `ch` cannot
		   say it: it resolves in THIS box's font, which is the body face.
		   No media query: the field is narrower than this below ~1500px, which
		   is above `wide` (71rem), so the bound only ever binds there. */
		max-width: calc(140 * 0.6 * 13px + 2 * 12px);
	}
	/* The measure as a WIDTH too, outside the dock, so the shrink-wrapped body
	   (.rp-composer-body) asks for the full measure rather than its text's
	   width — the field is as wide as before, and the body ends where it
	   does. ⛔ Not in the dock: its row WRAPS, and a 1116px hypothetical size
	   would push the history pair onto a line of its own. */
	.rp-composer:not(.rp-composer--docked) .rp-notation-wrap {
		width: calc(140 * 0.6 * 13px + 2 * 12px);
	}
	/* The history pair. A bare flex group, not a plate — same reasoning as band
	   B's .rp-zoom: the buttons paint themselves, and wrapping them in a second
	   ground would stack a surface on a surface. `align-self: start` pins them to
	   the TOP of the row so they stay level with the notation's first line if the
	   box ever wraps to two.
	   ↻ 2026-09-24 (⚓ Nate): WORDS, and STACKED — Undo over Redo, the pair as
	   tall as the ONE-LINE notation box. ⚠ That height is the editor's own
	   metrics (notationEditorExtension: 13px × 1.6 line + 10px padding top and
	   bottom), restated here — change one, change the other. Not `stretch`: the
	   box grows with its text and the coverage strips sit under it, and a pair
	   that grew with them would stop reading as two buttons. */
	.rp-history {
		display: grid;
		grid-template-rows: 1fr 1fr;
		align-self: start;
		gap: 2px;
		height: calc(13px * 1.6 + 20px);
	}
	.rp-history .btn {
		justify-content: flex-start;
		gap: 4px;
		padding-block: 0;
		line-height: 1;
	}
	/* Disabled dims the INK, not the plate — the same ruling band B's controls
	   took (⚓ Nate 2026-08-12). These sit on the bare scene beside a full-width
	   field, so fading the element fades the glass and punches a hole in the row;
	   an empty history should read as a button with nothing to do, not as a gap. */
	.rp-history .btn:disabled {
		opacity: 1;
		color: color-mix(in srgb, var(--text) 45%, transparent);
	}
	/* .rp-notation is the CodeMirror host div — structural only; all visual
	   styling (background, border, font, colors) is injected by notationTheme
	   inside buildNotationExtensions so it bypasses Svelte's CSS scoping. */
	.rp-notation {
		width: 100%;
		box-sizing: border-box;
	}
	/* Pre-editor placeholder: shows the raw notation while the lazy CodeMirror
	   chunk loads (see mountEditor). Mirrors notationTheme's container +
	   .cm-content metrics exactly (box, border, font, padding, min-height) so
	   the editor swap-in causes no visual jump. :global — created imperatively. */
	.rp-notation :global(.rp-notation-placeholder) {
		box-sizing: content-box;
		min-height: 21px;
		padding: 10px 12px;
		/* ↻ 2026-08-11: follows the editor onto the .field treatment (see
		   notationTheme). If these two drift, the swap-in when the lazy
		   CodeMirror chunk lands is a visible jump — which is the only reason
		   this stand-in is styled at all. */
		background: var(--fill-rest);
		box-shadow: inset 0 0 0 1px var(--border);
		border: none;
		border-radius: var(--r-sm);
		/* ↻ 2026-10-14: mono, 1.6 and WRAPPING, as the editor is — it had
		   drifted to the body face, --lh-relaxed and `pre`. */
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.6;
		color: var(--text);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		overflow: auto;
	}

	/* ── THE DOCK (⚓ Nate 2026-10-14, the mobile round, item 6) ─────────────
	   Below `compact` the composer is pinned to the screen's foot as a glass
	   plate (the band material — it floats over the night chart, never over
	   another glass). z 15: over the tool layer (10), under the loading veil
	   (20), the drawer and the chrome overlays (50), the menus (90) and the
	   tooltips (100). It rides up over the keyboard by --rp-kb-inset. */
	.rp-composer--docked {
		position: fixed;
		left: 0;
		right: 0;
		bottom: var(--rp-kb-inset, 0px);
		z-index: 15;
		padding: 8px 16px;
		align-items: flex-start;
		border-radius: var(--r-md) var(--r-md) 0 0;
		background: var(--glass-dock);
	}
	/* 🎛️ The pill's overlap in Nate's screenshot, ~22pt; 24 clears it. */
	.rp-composer--ios-chrome:not(.rp-composer--collapsed) {
		padding-bottom: calc(8px + 24px);
	}
	/* ⚓ Nate 2026-10-14: OPEN, it floats on the keyboard — four corners. */
	.rp-composer--docked:not(.rp-composer--collapsed) {
		border-radius: var(--r-md);
	}
	/* ⚓ Nate 2026-10-14: ONE plate, not a box within a box — the dock IS the
	   field, so the editor drops its own ground and ring. */
	.rp-composer--docked :global(.cm-editor),
	.rp-composer--docked :global(.cm-editor:hover),
	.rp-composer--docked :global(.cm-editor.cm-focused) {
		background: none;
		box-shadow: none;
	}
	.rp-composer--docked {
		flex-wrap: wrap;
		row-gap: 8px;
	}
	.rp-composer--docked :global(.cm-editor) {
		max-height: 35svh;
	}
	/* The key row: the dock's last line, against the keyboard. One line that
	   scrolls sideways rather than wraps — its height must not move under
	   the thumb as the segment changes. */
	.rp-dock-keys {
		flex: 1 0 100%;
		display: flex;
		gap: 6px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.rp-dock-keys::-webkit-scrollbar {
		display: none;
	}
	.rp-dock-key {
		flex: none;
		min-width: 40px;
		height: 36px;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 15px;
		/* ⚠ CASE IS NOTATION: .btn uppercases its label, and `sQ` is not `SQ`.
		   The key shows exactly what it types. */
		text-transform: none;
		letter-spacing: 0;
	}
	.rp-composer--collapsed .rp-notation-wrap,
	.rp-composer--collapsed .rp-history {
		display: none;
	}
	/* The collapsed strip: the notation's LAST LINE, its START cut rather than
	   its end — `direction: rtl` puts the ellipsis on the left, and the <bdi>
	   keeps the notation itself reading left to right. */
	.rp-dock-strip {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 36px;
		padding: 0 4px;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}
	.rp-dock-tail {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		direction: rtl;
		text-align: left;
		font-family: var(--font-mono);
		font-size: 13px;
	}
	/* The editor's two class colours (notationEditorExtension: .rp-tok-char,
	   .rp-tok-sep — the separator is --muted at 30% over the composer ground). */
	.rp-dock-char {
		font-weight: 500;
	}
	.rp-dock-sep {
		color: color-mix(in srgb, var(--muted) 30%, transparent);
		padding: 0 3px;
	}
	.rp-dock-tail--empty {
		color: color-mix(in srgb, var(--text) 55%, transparent);
	}
	.rp-dock-proxy {
		position: absolute;
		left: 0;
		bottom: 0;
		width: 1px;
		height: 1px;
		opacity: 0;
		font-size: 16px;
		border: 0;
		padding: 0;
		pointer-events: none;
	}
	/* The collapsed strip's height (8 + 36 + 8) plus a gutter. */
	.rp-dock-spacer {
		flex: none;
		height: 68px;
	}

	/* ── AUTOCOMPLETE UNDER A FINGER (⚓ Nate 2026-10-14) ───────────────────
	   The suggestion list was a 0.8rem list with 5px rows — a mouse's target.
	   On a touch screen each row is a ~44px target (WCAG 2.5.5's size). Keyed
	   on `pointer: coarse`, the AXIS the narrow round named for touch, never a
	   width. The list is portalled to <body> by CodeMirror, hence :global; the
	   leading `body` outranks the editor theme's scoped rule.
	   ⏭ Its desktop look is queued for Nate's eye, not touched here. */
	/* The pinned composer is a desk form (sweep §3 item 10): below `toolMin`
	   ($lib/breakpoints.ts — 54rem, where the bench turns into a row) it rides
	   in the page again, and below `compact` the dock takes it over. Relative,
	   not static, so the plate's pseudo-element keeps this box as its own. */
	@media (max-width: 54rem) {
		.rp-composer:not(.rp-composer--docked) {
			position: relative;
			bottom: auto;
		}
	}

	@media (pointer: coarse) {
		:global(body .cm-tooltip.cm-tooltip-autocomplete > ul) {
			max-height: 40svh;
			font-size: 15px;
		}
		:global(body .cm-tooltip.cm-tooltip-autocomplete > ul > li) {
			padding: 12px 14px;
		}
	}

	/* ── THE SIDE FADES (⚓ Nate 2026-10-15, iPhone 13; ↻ every width
	   2026-10-25, the edges round) ──────────────────────────────────────────
	   The x roll-off used to sit INSIDE the chart: the scrollers stood inside
	   the frame's side padding (--rp-frame-pad-x, 14) and faded over 33.6
	   more, so the bars went whole well inside the line the bands and the
	   composer align to (on a phone, ~64px in from each screen edge).
	   · THE SCROLLERS REACH OUT to their neighbours (a negative inline margin
	     of the frame pad plus the room ToolStack publishes: the bench's gap or
	     the screen's edge on the left, the screen's edge or an aside's gap on
	     the right) and PAD BACK by the same amount, so at scrollLeft 0 the
	     first bar still starts where it did and, at max scroll, the last one
	     still ends there — the padding is scrollable overflow at both ends.
	     Once scrolled, the fade is transparent AT the neighbour
	     (app.css § THE FADE ENDS AT THE NEIGHBOUR).
	   · On a phone the fade shortens to 20 (14 effective at the 0.7 scale), so
	     it sits AT the screen's edges and takes a sliver rather than a band.
	   ⚠ The aura lane's unit labels (.rp-aura-units) stand in the frame's left
	   padding, so scrolled content passes UNDER them; their halo is what keeps
	   them legible there, as it has been on a phone since 2026-10-15.
	   ⚠ BOTH SCROLLERS, ONE RULE: the ruler (and the aura lane inside it) is a
	   scroll follower mirrored from scrollLeft, so its box, padding and fade must
	   match the tracks' exactly or the ticks slide off the bars they time.
	   ⚠ The padding is read back in JS (`trackPad`, per side): the content
	   viewport is the client width MINUS both, for the axis floor, the playback
	   follow and scroll-to-seconds. */
	.rp-track-scroll,
	.rp-ruler-scroll {
		--rp-reach-l: calc(var(--room-left, 0px) + var(--rp-frame-pad-x));
		--rp-reach-r: calc(var(--room-right, 0px) + var(--rp-frame-pad-x));
		margin-left: calc(var(--rp-reach-l) * -1);
		margin-right: calc(var(--rp-reach-r) * -1);
		padding-left: var(--rp-reach-l);
		padding-right: var(--rp-reach-r);
	}
	@media (max-width: 40rem) {
		.rp-track-scroll,
		.rp-ruler-scroll {
			--scroll-fade: 20px;
		}
	}

	/* ── THE COMPOSER ON A PHONE (⚓ Nate 2026-10-14, the mobile round) ──────
	   The notation wraps by design; what a phone can do is give the TEXT the
	   row. Below `compact` (BP.compact, 40rem):
	   · the history pair keeps its MARKS and drops its WORDS — the narrow
	     round's rule for every band control (breakpoints.ts);
	   · the box's side padding tightens 12 → 8 (the pre-load stand-in follows,
	     or the swap-in jumps).
	   Measured on an eight-segment rotation (see the round record). */
	@media (max-width: 40rem) {
		.rp-history-word {
			display: none;
		}
		.rp-history .btn {
			justify-content: center;
		}
		.rp-notation :global(.cm-content),
		.rp-notation :global(.rp-notation-placeholder) {
			padding-inline: 8px;
		}
	}
</style>
