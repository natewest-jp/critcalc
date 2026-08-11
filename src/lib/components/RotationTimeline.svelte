<script lang="ts">
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import Mark from './Mark.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { parseNotation, type ParsedRotation } from '$lib/utils/notationParser';
	import type { Stat } from '$lib/types/ability';
	import type { NotationEditor } from '$lib/utils/notationEditor';
	import { getIndexEntryByDisplayName } from '$lib/data/characterLookup';
	import { getLoadedCharacter } from '$lib/data/characterData';
	import { getAvatar } from '$lib/utils/getAvatar';
	import { constellations, siteSettings, loadout, type LoadoutEntry } from '$lib/stores';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import type { CharacterTrack } from '$lib/utils/notationParser';
	import { artifactImagePath } from '$lib/data/artifactLookup';
	import { weaponImagePath } from '$lib/data/weaponLookup';
	import BuffTooltip from '$lib/components/BuffTooltip.svelte';
	import { scrollFade } from '$lib/actions/scrollFade';
	import { benchBand, BENCH_SLOT_MIN_H } from '$lib/benchBand.svelte';
	import { documentBar } from '$lib/documentBar.svelte';
	import { plannerView as pv } from '$lib/plannerView.svelte';
	import { onDestroy } from 'svelte';
	import { BUFF_STAT_ICON } from '$lib/timeline/buffStatMaps';
	import {
		elementPalette,
		shiftHue,
		castFill,
		desaturate,
		type ElementPalette
	} from '$lib/utils/elementColors';
	import { UPTIME_DIM_MIX, GHOST_FILL_MIX, GHOST_CHROMA_KEEP } from '$lib/timeline/barMix';
	import {
		xForTime as projectX,
		barGeom as projectBar,
		rulerTicks
	} from '$lib/timeline/barGeometry';
	import type { CharReceivedBuffBar, MergedEffectDisplay, SlottedTrack } from '$lib/timeline/types';
	import { projectTeamBuffRows } from '$lib/timeline/teamBuffRows';
	import { projectCharReceivedBuffRows } from '$lib/timeline/charReceivedBuffRows';
	import { computeWeaponProcRows } from '$lib/timeline/weaponProcRows';
	import { computeSummonSubrows, findCastSummon } from '$lib/timeline/summonSubrows';
	import { barPhases } from '$lib/timeline/barPhases';
	import { computeMoonsignRows } from '$lib/timeline/moonsignRows';
	import { computeNBBars } from '$lib/timeline/nbRows';
	import { isCurated } from '$lib/utils/characterLint';
	import {
		renderTimelinePng,
		deliverPng,
		type TimelineSnapshot,
		type ExportBar
	} from '$lib/utils/timelineExport';
	import type { TimelineBar } from '$lib/utils/notationParser';
	import { toKqmNotation } from '$lib/utils/kqmExport';
	import { resolve } from '$app/paths';

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------

	let {
		characterSlots = ['blank', 'blank', 'blank', 'blank'],
		notation = $bindable(''),
		tabLoadout = {} as Record<string, LoadoutEntry>,
		tabCon = {} as Record<string, number>,
		sourceOpen = false,
		sourceOverlay,
		underChart
	}: {
		characterSlots?: string[];
		notation?: string;
		tabLoadout?: Record<string, LoadoutEntry>;
		/** Per-tab constellation overrides (Layer 2). Shadows the roster's global
		 *  `constellations` field-by-field, exactly like tabLoadout shadows loadout.
		 *  The slot cards themselves live in the layout-level bench band now —
		 *  these props feed the parser's effective-con and the PNG export. */
		tabCon?: Record<string, number>;
		/** When true, the character Source panel is layered over the track area. */
		sourceOpen?: boolean;
		/** Source panel content (the planner page's CharacterSelector), rendered
		 *  in-frame from the portrait column's edge. */
		sourceOverlay?: import('svelte').Snippet;
		/** Rendered BETWEEN the chart and the composer — the always-on bonuses
		 *  strip. ⚓ Nate 2026-08-11 moved it here from the page's bottom edge:
		 *  "sandwiched right in-between the buff bars / nightsoul / moonsign and
		 *  the notation box." It reads as part of the instrument now rather than
		 *  a footnote after it, which is what it always was — an always-on buff
		 *  is the BASELINE the timeline's temporary bars sit on top of, so it
		 *  belongs beside the lanes that show them.
		 *  ⚠ A SNIPPET, NOT AN IMPORT, deliberately: the block needs the page's
		 *  `slots` and the timeline only needs to decide WHERE it goes. Same
		 *  contract as sourceOverlay. */
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

	// Sticky: true after the Source overlay first opens — from then on it stays
	// mounted (CSS-hidden when closed) so reopening skips the grid remount.
	let sourceEverOpened = $state(false);
	$effect(() => {
		if (sourceOpen) sourceEverOpened = true;
	});
	// Swap ping (network latency, ms) lives in site settings (chrome ⚙ overlay);
	// the timeline converts it to swap-delay frames for the parser. gcsim's
	// relationship: frames ≈ ping × 2 × 60 / 1000 = ping × 0.12.
	let swapFrames = $derived(Math.round($siteSettings.swapPing * 0.12));

	// "Explore alternatives →" opens the Team Builder's per-slot alternatives
	// view. The team itself no longer travels by URL — it IS the shared working
	// team (bench-band round); ?alts=1 only asks for the view. Sent only when a
	// slot is filled, so an empty team lands on the Atlas cards as usual.
	const exploreHasTeam = $derived(characterSlots.some((id) => id && id !== 'blank'));

	// ---------------------------------------------------------------------------
	// Layout constants (px)
	// ---------------------------------------------------------------------------

	/** The CONVERGED SLOT-CARD width — the thing the two tools actually share,
	 *  and the width the ribbon is built around (RIBBON_W = this + chrome).
	 *
	 *  160 is set by the Bench's base row, the card's widest band:
	 *      action 26 + gap 4 + pill 76 + gap 4 + action 26 = 136
	 *      + 18 card padding = 154, leaving ~6px of slack.
	 *  Undershoot it and the TB card silently OVERFLOWS its grid track rather
	 *  than clipping — the bench keeps its width while the portrait drifts
	 *  right. probe-bench-align asserts both that and cross-tool card parity.
	 *
	 *  The planner reads it for ONE thing now: the PNG export, which draws its
	 *  own label column with no strip standing over it. The on-screen gutter
	 *  retired with the abutting round — the frame starts at the ribbon's right
	 *  edge, so the tracks begin at the frame's own padding box. */
	const LABEL_W = 160;
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
	const BLANK_PAL: ElementPalette = { main: '#768093', border: '#768093', hi: '#768093' };

	// castFill (the cast-pill / summon vertical top-light) now lives in
	// $lib/utils/elementColors so the Team Builder's Compare bars share the exact
	// finish. Its Safari-revert history travelled with it.

	/** The thinnest a scaling buff's material gets, as a fraction of --glass-bar's
	 *  own density. 🎛️ ⚠ IT IS NOT THE OLD 0.2. When the envelope mixed an
	 *  OPAQUE fill toward the chart ground, 0.2 still produced a solid colour
	 *  near that ground — thin meant "close to the background", and the bar was
	 *  always there. Scaling a translucent material by 0.2 gives alpha .116,
	 *  which is SHEER, and sheer is retired ("opaque or obviously translucent —
	 *  the middle is not a place"). 0.5 keeps the thin end at alpha .29: still
	 *  unmistakably a bar, still obviously less than full. */
	const ENVELOPE_MIN = 0.5;

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

	// Returns a linear-gradient CSS string for ramping buff bars, fading from dim (ramp start)
	// to full opacity (ramp cap). Accounts for segment offset so mid-ramp segments start brighter.
	function rampingBackground(bar: CharReceivedBuffBar): string | undefined {
		const ramp = bar.rampParams;
		if (!ramp || bar.buffStart == null) return undefined;
		const rampDur =
			ramp.cap != null ? ((ramp.cap - ramp.startValue) / ramp.stepValue) * ramp.stepInterval : 10;
		const p0 = Math.min(1, Math.max(0, (bar.start - bar.buffStart) / rampDur));
		const p1 = Math.min(1, Math.max(0, (bar.end - bar.buffStart) / rampDur));
		const o0 = ENVELOPE_MIN + p0 * (1 - ENVELOPE_MIN);
		const o1 = ENVELOPE_MIN + p1 * (1 - ENVELOPE_MIN);
		return `linear-gradient(to right, ${buffStop(o0)}, ${buffStop(o1)})`;
	}

	// Returns a linear-gradient CSS string for decaying buff bars, fading from full
	// opacity (decay start) to dim (decay end). Mirrors rampingBackground in reverse.
	// Decay duration equals the host effect's buff duration.
	function decayingBackground(bar: CharReceivedBuffBar): string | undefined {
		const decay = bar.decayParams;
		if (!decay || bar.buffStart == null || decay.duration <= 0) return undefined;
		const p0 = Math.min(1, Math.max(0, (bar.start - bar.buffStart) / decay.duration));
		const p1 = Math.min(1, Math.max(0, (bar.end - bar.buffStart) / decay.duration));
		const o0 = 1.0 - p0 * (1 - ENVELOPE_MIN);
		const o1 = 1.0 - p1 * (1 - ENVELOPE_MIN);
		return `linear-gradient(to right, ${buffStop(o0)}, ${buffStop(o1)})`;
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
	// specific variant (Cryo Traveler lands soon); only this label diverges.
	function slotLabel(char: { id: string; displayName: string }): string {
		return char.id.startsWith('traveler') ? 'Traveler' : char.displayName;
	}

	let rotation = $derived.by(() => {
		try {
			return parseNotation(
				notation,
				resolveCharacter,
				swapFrames,
				effectiveCon,
				effectiveLoadout,
				// Slot roster (post-P4 #5 arc): NB derivation + team-scoped buff
				// context read the SLOTS, which can hold members never typed in
				// the notation.
				slotCharacters
			);
		} catch (e) {
			console.error('parseNotation threw:', e);
			return {
				tracks: [],
				totalDuration: 0,
				unknownTokens: [],
				events: [],
				windows: []
			} satisfies ParsedRotation;
		}
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
	let nbBars = $derived(computeNBBars(rotation.events));

	let effectiveLoadout = $derived.by(() => {
		const allIds = new Set([...Object.keys($loadout), ...Object.keys(tabLoadout)]);
		const result: Record<string, LoadoutEntry> = {};
		for (const charId of allIds) {
			result[charId] = { ...($loadout[charId] ?? {}), ...(tabLoadout[charId] ?? {}) };
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
	let teamBuffRows = $derived(projectTeamBuffRows(rotation.windows, getLoadedCharacter));

	let weaponProcRows = $derived(computeWeaponProcRows(rotation.windows, effectiveLoadout));

	// Per-character received buff bars (TTDS, Widsith, active-target slices,
	// self buffs) — projection of the parser's buff windows.
	let charReceivedBuffRows = $derived(
		projectCharReceivedBuffRows(rotation.windows, getLoadedCharacter)
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
	let summonSubrows = $derived.by(() =>
		computeSummonSubrows(annotatedTracks, rotation.windows, effectiveCon, getLoadedCharacter)
	);

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
	// ⚠ FLOORED BY THE BENCH CARD, NOT BY THE ROWS. The card that labels this
	// slot needs 86px before its portrait gets a pixel (see BENCH_SLOT_MIN_H),
	// and after two condensing rounds the tracks ask for less than that — so the
	// CARD sets the minimum now. Without this floor the 68px portrait disc spills
	// straight through the identity row and the loadout pill; it is capped rather
	// than floored on its own side, so nothing else would catch it.
	// The extra height lands as slack BELOW the last aux row (every row is
	// positioned from the slot's top), which is where it is least noticeable.
	function slotBlockH(slotIdx: number): number {
		const buffRows = slotBuffRowsReserved(slotIdx);
		const buffH = buffRows > 0 ? buffRows * CHAR_BUFF_ROW_STRIDE - 2 : 0;
		return Math.max(BENCH_SLOT_MIN_H, buffRowsTopForSlot(slotIdx) + buffH + CHAR_PAD_BOTTOM);
	}

	// Cumulative Y offsets per slot, accounting for variable block heights.
	// Used by swap connectors which span vertically between slots.
	let slotTopOffsets = $derived(
		characterSlots.reduce((acc, _id, i) => {
			acc.push(i === 0 ? 0 : acc[i - 1] + slotBlockH(i - 1));
			return acc;
		}, [] as number[])
	);

	let teamBuffsH = $derived(auxLaneH(teamBuffRows.length));
	// NB events all stack onto a single sub-row; the lane is always 1-row tall.
	let nbLaneH = $derived(auxLaneH(1));
	// moonsignLaneH is declared further down, after moonsignRows.

	// Moonsign buff windows — see src/lib/timeline/moonsignRows.ts.
	let moonsignRows = $derived(
		teamComp.hasAscendantGleam
			? computeMoonsignRows(rotation.events, teamComp.nonMoonsignSlots, characterSlots)
			: []
	);
	let moonsignLaneH = $derived(auxLaneH(moonsignRows.length));

	let annotatedTracks = $derived(mapTracksToSlots(rotation.tracks, characterSlots));

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
			characterSlots.map((_, i) => slotBlockH(i)),
			characterSlots.map((id, i) => id === 'blank' && tracksBySlot[i].length > 0)
		);
	});
	onDestroy(() => publishBenchMetrics(null));

	// ---------------------------------------------------------------------------
	// Derived: timeline dimensions
	// ---------------------------------------------------------------------------

	let trackScrollWidth = $state(0);
	let trackScrollEl: HTMLDivElement | undefined;
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
			if (ev.uptime > 0) max = Math.max(max, ev.time + ev.summonActivatesAt / 60 + ev.uptime);
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
		const viewportSeconds = trackScrollWidth > 0 ? trackScrollWidth / scale : 25;
		return Math.max(max + 2, viewportSeconds, 25);
	});
	let totalWidth = $derived(Math.round(totalDuration * scale));

	// ⛔ `majorTicks` is gone (2026-08-11): it existed only to draw gridlines for
	// the 5s marks, and every tick draws one now.
	let ticks = $derived(rulerTicks(totalDuration, scale));

	// ---------------------------------------------------------------------------
	// Geometry helpers
	// ---------------------------------------------------------------------------

	/** Thin reactive wrappers over the pure projection in
	 *  $lib/timeline/barGeometry — they close over this component's live `scale`
	 *  so every existing call site stays unchanged. The pure module is shared
	 *  with the Team Builder's Compare bars so the two renderers can never
	 *  drift. */
	function xForTime(t: number): number {
		return projectX(t, scale);
	}

	function barGeom(start: number, span: number): { left: number; width: number } {
		return projectBar(start, span, scale);
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

	// Full content height of the track area (ruler + slots + lanes) — sizes the
	// PNG export canvas.
	let contentH = $derived(
		RULER_H +
			characterSlots.reduce((acc, _id, i) => acc + slotBlockH(i), 0) +
			teamBuffsH +
			(teamComp.natlanCount >= 1 ? nbLaneH : 0) +
			(teamComp.hasAscendantGleam ? moonsignLaneH : 0)
	);

	// ---------------------------------------------------------------------------
	// PNG export — assembles a snapshot of everything already derived and hands
	// it to the canvas painter (timelineExport.ts). Copy first, download as
	// the fallback.
	// ---------------------------------------------------------------------------

	function buildSnapshot(): TimelineSnapshot {
		const laneStride = AUX_LANE_BAR_STRIDE;
		// Lanes open directly under the 4th track group (the ribbon-clearance
		// gap retired with the tall bench — the strip clears the lanes by
		// standing over the whole label column instead).
		const slotsBottom = slotTopOffsets[3] + slotBlockH(3);
		const nbVisible = teamComp.natlanCount >= 1;
		const moonVisible = teamComp.hasAscendantGleam;
		const teamNames = slotCharacters
			.filter((c): c is NonNullable<typeof c> => c != null)
			.map((c) => c.displayName);
		const total = Math.round(rotation.totalDuration * 10) / 10;
		const withSummon = (
			char: (typeof slotCharacters)[number],
			source: 'skill' | 'burst',
			bars: TimelineBar[]
		): ExportBar[] =>
			bars.map((b) => ({ ...b, hasSummon: !!findCastSummon(char, source, b.label) }));

		return {
			title: teamNames.length > 0 ? `${teamNames.join(' · ')}  —  ${total}s` : 'critcalc rotation',
			notation,
			scale,
			labelW: LABEL_W,
			rulerH: RULER_H,
			totalWidth,
			contentH,
			ticks,
			slots: characterSlots.map((slotId, i) => {
				const char = slotCharacters[i];
				return {
					// slotLabel: the export's label column mirrors the on-screen
					// portrait area (travelers read "Traveler")
					displayName: char ? slotLabel(char) : null,
					element: char?.element,
					// No-frame-map (uncurated, non-Blank) → dire N/C/P treatment in export.
					isApprox: char != null && !isCurated(char) && char.id !== 'blank',
					consLevel: char ? effectiveConLevel(char.id) : 0,
					blockH: slotBlockH(i),
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
					equipIcons: char
						? (() => {
								const entry = effectiveLoadoutEntry(char.id);
								const icons: string[] = [];
								if (entry.artifactSetId) icons.push(artifactImagePath(entry.artifactSetId));
								if (entry.weaponId) icons.push(weaponImagePath(entry.weaponId));
								return icons;
							})()
						: []
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
			statIconFor: (stat) => BUFF_STAT_ICON[stat as Stat],
			avatarFor: (i) =>
				getAvatar(
					characterSlots[i],
					$siteSettings.useNewOutfits,
					'side',
					$siteSettings.travelerVariant
				),
			elementGlyphFor: (el) => elementIcon(el)
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

	async function runPng(mode: 'copy' | 'download') {
		if (pngBusy) return;
		pngBusy = true;
		try {
			const blob = await renderTimelinePng(buildSnapshot());
			const result = await deliverPng(blob, 'critcalc-rotation.png', mode);
			documentBar.showNotice(
				result === 'copied'
					? 'Image copied'
					: result === 'downloaded'
						? 'Image saved'
						: 'Export failed'
			);
		} catch (e) {
			console.error('PNG export failed:', e);
			documentBar.showNotice('Export failed');
		}
		pngBusy = false;
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
			map.set(t.activeStart, {
				hasArrival: prev != null && prev.slotIdx !== t.slotIdx,
				hasDeparture: next != null && next.slotIdx !== t.slotIdx
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

	function mountEditor(node: HTMLElement, value: string) {
		let editor: NotationEditor | null = null;
		let destroyed = false;
		// The latest external value, replayed into the editor when it arrives
		// (the user can't type into the placeholder, but tab switches / URL
		// imports can update notation while the chunk is still loading).
		let pendingValue = value;

		const placeholder = document.createElement('div');
		placeholder.className = 'rp-notation-placeholder';
		placeholder.textContent = value;
		node.appendChild(placeholder);

		import('$lib/utils/notationEditor').then(({ createNotationEditor }) => {
			if (destroyed) return;
			placeholder.remove();
			editor = createNotationEditor(node, pendingValue, (v) => {
				notation = v;
			});
		});

		return {
			update(newValue: string) {
				pendingValue = newValue;
				if (editor) editor.setValue(newValue);
				else placeholder.textContent = newValue;
			},
			destroy() {
				destroyed = true;
				editor?.destroy();
				editor = null;
			}
		};
	}

	// ---------------------------------------------------------------------------
	// Effective loadout / constellation resolution (tab Layer-2 over roster Layer-1)
	// ---------------------------------------------------------------------------

	function effectiveLoadoutEntry(charId: string): LoadoutEntry {
		return { ...($loadout[charId] ?? {}), ...(tabLoadout[charId] ?? {}) };
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
		pv.totalDuration = rotation.totalDuration;
	});

	// ---------------------------------------------------------------------------
	// Tooltip
	// ---------------------------------------------------------------------------

	type TooltipPayload = {
		sourceLabel: string;
		effects: MergedEffectDisplay[];
		isMutuallyExclusive: boolean;
		duration?: number;
		procCooldown?: number;
	};
	type TooltipState = TooltipPayload & { x: number; y: number; above: boolean };

	let tooltip = $state<TooltipState | null>(null);

	function showTooltip(e: MouseEvent, data: TooltipPayload) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const above = rect.top > 80;
		tooltip = {
			...data,
			x: rect.left + rect.width / 2,
			y: above ? rect.top - 6 : rect.bottom + 6,
			above
		};
	}

	function hideTooltip() {
		tooltip = null;
	}

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
	<div class="rp-frame" class:rp-frame--picking={sourceOpen}>
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
			<div
				class="rp-ruler-scroll scroll-fade-x"
				bind:this={rulerScrollEl}
				use:scrollFade={{ axis: 'x' }}
			>
				<!-- Ruler — the frame's TOP time axis (DAW convention): ticks
				     rise to the seam, labels above them. -->
				<div class="rp-ruler" style:width="{totalWidth}px" style:height="{RULER_H}px">
					{#each ticks as tick (tick.t)}
						<div class="rp-tick" class:major={tick.major} style:left="{tick.x}px">
							{#if tick.major && tick.t > 0}
								<span class="rp-tick-label">{tick.t}s</span>
							{/if}
						</div>
					{/each}
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

						<!-- Character slot tracks (always 4 rows) -->
						{#each slotCharacters as char, slotIdx (slotIdx)}
							{@const p = char?.id === 'blank' ? BLANK_PAL : pal(char?.element)}
							{@const slotTracks = tracksBySlot[slotIdx]}
							<!-- No-frame-map characters (uncurated stubs, but NOT Blank — Blank
							     is presented as a normal generic kit) mark their generic-timed
							     N/C/P tokens with a dire gradient fill + dire text. -->
							{@const isApprox = char != null && !isCurated(char) && char.id !== 'blank'}

							<div
								class="rp-char-block"
								style:height="{slotBlockH(slotIdx)}px"
								style:--label-halo={char ? shiftHue(p.main, 0, -30, 1) : undefined}
							>
								<!-- E row -->
								<div class="rp-row" style:top="{CHAR_PAD_TOP}px" style:height="{E_ROW_H}px">
									{#each slotTracks as track, ti (`${slotIdx}_${ti}`)}
										{#each track.eBars as bar, barIdx (barIdx)}
											{@const eHasSummon = !!findCastSummon(char, 'skill', bar.label)}
											<!-- Three-case E/Q pill geometry lives in the shared barPhases()
										     helper (mirrored by the PNG exporter). Roles carry the styling
										     intent; this template projects each to its DOM treatment. -->
											{#each barPhases(bar, eHasSummon) as seg, si (si)}
												{@const g = barGeom(seg.start, seg.span)}
												{#if seg.role === 'uptime'}
													<div
														class="rp-bar-uptime"
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background={castFill(p.main)}
														style:border-radius="1px"
													>
														<span class="rp-bar-row-badge">{bar.label}</span>
													</div>
												{:else if seg.role === 'uptimeFlush'}
													<div
														class="rp-bar-uptime"
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background={castFill(p.main)}
													>
														<span class="rp-bar-row-badge">{bar.label}</span>
													</div>
												{:else if seg.role === 'uptimeDim'}
													<!-- Sac proc: bar spans duration only (CD reset to 0), dim
											     continuation tone. Opaque mix, never alpha — connectors
											     pass behind these bars. --dim keeps the badge white+halo:
											     ink only sits on full-strength fills. -->
													<div
														class="rp-bar-uptime rp-bar-uptime--dim"
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background="color-mix(in srgb, {p.main}
														{UPTIME_DIM_MIX}%, var(--rp-chart-bg))"
														style:border-radius="1px"
													>
														<span class="rp-bar-row-badge">{bar.label}</span>
													</div>
												{:else if seg.role === 'overflow'}
													{#if g.width > 0}
														<div
															class="rp-bar-cd rp-bar-cd--overflow"
															style:left="{g.left}px"
															style:width="{g.width}px"
															style:background="color-mix(in srgb, {p.main}
															{UPTIME_DIM_MIX}%, var(--rp-chart-bg))"
														></div>
													{/if}
												{:else if seg.role === 'ghost'}
													<div
														class="rp-bar-cd rp-bar-cd--ghost"
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background="color-mix(in srgb, {desaturate(
															p.main,
															GHOST_CHROMA_KEEP
														)}
														{GHOST_FILL_MIX}%, transparent)"
													>
														{#if g.width > 32}
															<span class="rp-bar-cd-label"
																>{Math.round((seg.cooldown ?? 0) * 10) / 10}s</span
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
												<!-- Full-strength castFill — same finish as the E/Q pills
											     (Nate 2026-07-18). Opaque, so swap connectors passing
											     behind this lane can't show through. -->
												<div
													class="rp-summon-bar"
													style:left="{g.left}px"
													style:width="{g.width}px"
													style:background={castFill(p.main)}
												>
													<span class="rp-summon-label">{srow.label}</span>
												</div>
												{#each sbar.ticks as tickT, tIdx (tIdx)}
													{@const tg = barGeom(tickT, 0)}
													<div
														class="rp-summon-tick"
														style:left="{tg.left}px"
														style:background={p.hi}
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
											{@const qHasSummon = !!findCastSummon(char, 'burst', bar.label)}
											<!-- Same shared barPhases() geometry as the E row (badge 'Q').
										     Bursts never fire the sac proc, so the uptimeDim role is
										     unreachable here, but kept for E/Q symmetry. -->
											{#each barPhases(bar, qHasSummon) as seg, si (si)}
												{@const g = barGeom(seg.start, seg.span)}
												{#if seg.role === 'uptime'}
													<div
														class="rp-bar-uptime"
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background={castFill(p.main)}
														style:border-radius="1px"
													>
														<span class="rp-bar-row-badge">{bar.label}</span>
													</div>
												{:else if seg.role === 'uptimeFlush'}
													<div
														class="rp-bar-uptime"
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background={castFill(p.main)}
													>
														<span class="rp-bar-row-badge">{bar.label}</span>
													</div>
												{:else if seg.role === 'uptimeDim'}
													<div
														class="rp-bar-uptime rp-bar-uptime--dim"
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background="color-mix(in srgb, {p.main}
														{UPTIME_DIM_MIX}%, var(--rp-chart-bg))"
														style:border-radius="1px"
													>
														<span class="rp-bar-row-badge">{bar.label}</span>
													</div>
												{:else if seg.role === 'overflow'}
													{#if g.width > 0}
														<div
															class="rp-bar-cd rp-bar-cd--overflow"
															style:left="{g.left}px"
															style:width="{g.width}px"
															style:background="color-mix(in srgb, {p.main}
															{UPTIME_DIM_MIX}%, var(--rp-chart-bg))"
														></div>
													{/if}
												{:else if seg.role === 'ghost'}
													<div
														class="rp-bar-cd rp-bar-cd--ghost"
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background="color-mix(in srgb, {desaturate(
															p.main,
															GHOST_CHROMA_KEEP
														)}
														{GHOST_FILL_MIX}%, transparent)"
													>
														{#if g.width > 32}
															<span class="rp-bar-cd-label"
																>{Math.round((seg.cooldown ?? 0) * 10) / 10}s</span
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
												style:background={isApprox &&
												block.kind !== 'skill' &&
												block.kind !== 'burst'
													? 'linear-gradient(to right, color-mix(in srgb, var(--ui-danger) 20%, transparent), transparent)'
													: block.kind === 'skill' ||
														  block.kind === 'burst' ||
														  block.kind === 'elemental-normal'
														? `color-mix(in srgb, ${p.main} 50%, var(--rp-active))`
														: undefined}
												style:border-right={bi === track.inputBlocks.length - 1
													? 'none'
													: undefined}
												title={isApprox && block.kind !== 'skill' && block.kind !== 'burst'
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
													>{procRow.label} trigger CD</span
												>
											</div>
										{/each}
									</div>
								{/each}
								<!-- Per-source received buff subrows — stacked below any proc ICD rows -->
								{#each charReceivedBuffRows.filter((r) => r.characterId === char?.id) as recRow, ri (`${recRow.characterId}::${recRow.sourceLabel}`)}
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
											{@const envBg = rampingBackground(bar) ?? decayingBackground(bar)}
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<div
												class="rp-team-buff-bar"
												style:left="{g.left}px"
												style:width="{g.width}px"
												style:background={envBg}
												onmouseenter={(e) =>
													showTooltip(e, {
														sourceLabel: bar.sourceLabel,
														effects: bar.effects,
														isMutuallyExclusive: bar.isMutuallyExclusive,
														duration: bar.duration,
														procCooldown: bar.procCooldown
													})}
												onmouseleave={hideTooltip}
											>
												{#if icon}<img src={icon} alt="" class="rp-buff-icon" />{/if}
												<span
													class="rp-buff-label"
													style:max-width={labelCapPx(g, recRow.bars[bi + 1], !!icon)}
													>{bar.sourceLabel}</span
												>
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
						<div class="rp-team-buffs" style:height="{teamBuffsH}px">
							{#if teamBuffRows.length > 0}
								<span class="rp-lane-name">TEAM BUFFS</span>
								<div class="rp-team-buff-rows">
									{#each teamBuffRows as subrow (subrow.key)}
										<div class="rp-team-buff-subrow">
											{#each subrow.bars as bar, bi (bi)}
												{@const g = barGeom(bar.start, bar.end - bar.start)}
												{@const icon = BUFF_STAT_ICON[subrow.primaryStat]}
												<!-- svelte-ignore a11y_no_static_element_interactions -->
												<div
													class="rp-team-buff-bar"
													style:left="{g.left}px"
													style:width="{g.width}px"
													onmouseenter={(e) =>
														showTooltip(e, {
															sourceLabel: subrow.sourceLabel,
															effects: bar.effects,
															isMutuallyExclusive: false,
															duration: bar.end - bar.start
														})}
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
												</div>
											{/each}
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- NB (Nightsoul Burst) lane -->
						{#if teamComp.natlanCount >= 1}
							<div class="rp-nb-lane" style:height="{nbLaneH}px">
								<span class="rp-lane-name">NIGHTSOUL BURSTS</span>
								<div class="rp-nb-rows">
									<div class="rp-nb-subrow">
										{#each nbBars as ev, i (i)}
											{@const cd = barGeom(ev.start, ev.cooldown)}
											<div class="rp-nb-bar" style:left="{cd.left}px" style:width="{cd.width}px">
												<span class="rp-bar-cast-label">NB</span>
												{#if cd.width > 40}
													<span class="rp-bar-cd-label">{ev.cooldown}s</span>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							</div>
						{/if}

						<!-- Moonsign lane -->
						{#if teamComp.hasAscendantGleam}
							<div class="rp-moonsign-lane" style:height="{moonsignLaneH}px">
								<span class="rp-lane-name">ASCENDANT GLEAM</span>
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
												<!-- svelte-ignore a11y_no_static_element_interactions -->
												<div
													class="rp-moonsign-bar"
													style:left="{g.left}px"
													style:width="{g.width}px"
													onmouseenter={(e) =>
														showTooltip(e, {
															sourceLabel: `Ascendant Gleam — ${msChar?.displayName ?? '?'}`,
															effects: [moonsignScaling(msChar?.element)],
															isMutuallyExclusive: false,
															duration: win.duration
														})}
													onmouseleave={hideTooltip}
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

		<!-- ── Character Source overlay ─────────────────────────────
		     Non-modal, and a sibling of the frame's own rows so it covers
		     EVERYTHING right of the portrait column — ruler strip, view
		     cluster, tracks, external scrollbar, composer — instead of the
		     track area alone. That makes the planner in picking mode the
		     mirror of the Team Builder at rest: bench on one edge, grid and
		     filters filling the rest of one surface. The 4 live portraits stay
		     visible on the left as the team display. The content is the
		     planner page's CharacterSelector, handed in as a snippet. Kept
		     MOUNTED after the first open (hidden, not destroyed) so reopening
		     skips the ~122-card remount — a visible stall in Safari 26.x, and
		     free even where mounts are fast. -->
		{#if sourceEverOpened && sourceOverlay}
			<div class="rp-source-overlay" hidden={!sourceOpen}>
				{@render sourceOverlay()}
				<!-- ← Explore alternatives is tied to the picker, not the main
				     surface, and it lives INSIDE the picker now (tall-bench round:
				     the ribbon owns the label column it used to dock in). Bottom
				     edge, leading arrow — the Team Builder sits to the planner's
				     LEFT in the tool order — and it hands over the whole team,
				     which is already shared. -->
				<a
					class="rp-explore-link"
					href="{resolve('/team-builder')}{exploreHasTeam ? '?alts=1' : ''}"
					title="Open the current team in the Team Builder to compare alternatives"
				>
					<span class="rp-explore-arrow"><Mark name="back" size={12} /></span> Explore alternatives
				</a>
			</div>
		{/if}
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
	{#if underChart}
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

	     `inert` while picking: the Source overlay bounds to the frame and used
	     to cover the composer as part of it. It no longer reaches, so the
	     "picking takes over the instrument" reading is asserted directly rather
	     than by an accident of geometry.

	     ↻ TOOLBAR ROUND: the KQM/PNG pair that used to sit just outside the box
	     is gone from here. Both are EXPORTS, and exports are one family with the
	     share link — they live in band A's Share menu now. -->
	<div class="rp-composer" class:rp-composer--picking={sourceOpen} inert={sourceOpen}>
		<div class="rp-notation-wrap">
			<div class="rp-notation" use:mountEditor={notation}></div>
		</div>
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
		/* The Source overlay's containing block: it insets to the frame's
		   padding box, so it covers every row right of the portrait column. */
		position: relative;
	}
	/* Picking: guarantee the Source overlay a usable height even when the
	   rotation is short (an empty timeline is just 4 slot cards tall). Lives on
	   the FRAME now that the overlay bounds to the frame rather than the track
	   area. Knob — the picker gets this minus the frame's padding. */
	.rp-frame--picking {
		min-height: 26rem;
	}

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
	/* ── Character Source overlay ─────────────────────────────── */
	/* Non-modal: an opaque panel over the whole frame — ruler, view cluster,
	   tracks, external scrollbar and composer. The 4 live portraits stay
	   visible in the RIBBON beside the frame as the team display (they are no
	   longer inside it to be covered), and the frame's own --picking
	   min-height keeps the panel usable under a short rotation. */
	.rp-source-overlay {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		/* The panel fills the frame's padding box. It used to stop short of the
		   portrait column; the ribbon holds the portraits outside the frame
		   now, so there is nothing left inside for it to clear. */
		left: 0;
		z-index: 6;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
		padding: 10px 12px 12px;
		/* Opaque, and now the ONE opaque box on this surface besides the composer
		   — picking is a takeover, so it should cover. ↻ 2026-08-11: it used to
		   inherit its edges from the frame it sat inside; with no frame it needs
		   its own, so the stray border-left (a seam against a portrait column
		   that has not existed since the tall-bench round) is replaced by the
		   radius that makes it read as a panel laid on the scene. */
		background: var(--rp-chart-bg);
		border-radius: var(--r-sm);
	}
	/* The explicit display:flex above would beat the UA's [hidden] rule. */
	.rp-source-overlay[hidden] {
		display: none;
	}

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
	/* No seam under the ruler (round two, with the slot separators). The ticks
	   rising to the axis line ARE the axis; a rule beneath them was saying the
	   same thing a second time, in the heaviest way available. */
	.rp-ruler {
		position: relative;
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
	   lanes whose fills are the most deliberately authored on the chart. The
	   fix is the palette, and the palette round is next.
	   ⛔ So the fill is back on the bar itself and the ::before is gone; the
	   export's globalAlpha went with it. Don't reintroduce either as a
	   brightness lever. */
	.rp-nb-bar {
		--label-halo: #f85b21;
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
		/* Buff-bar label grammar: icon + label ranged left, same inset. */
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
		/* Edge and ring gone in the flattening pass — see .rp-nb-bar. */
		border: none;
		border-radius: 1px;
		z-index: 2;
	}
	/* This override is a no-op since the buff labels went full white (2026-08-11)
	   and is kept only as the anchor for the halo selector below — the moonsign
	   fill is light enough that its labels are the one place the halo is load-
	   bearing rather than ornamental. */

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
	   nothing, and quietly outlives the reason it existed. GHOST_EDGE_MIX is no
	   longer imported here; the EXPORT still uses it (its ghosts keep their
	   outlines — flat paper, no scene, same reasoning as the separators it
	   kept), so the knob itself stays live in barMix.ts.

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
	   became "who still has a bright fill" — and after the flattening and the
	   glass rounds, that is only the two decorated lanes.

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
	.rp-summon-label {
		font-size: var(--fs-xs);
		/* ↻ 2026-08-11: bold → medium (⚓ Nate) — a genuine two-rung drop now
		   that the body face is variable. See the --fw-* block in app.css. */
		font-weight: var(--fw-medium);
		/* ↻ 2026-08-11 round two: --bright-ink → white with every other label.
		   See the halo block for the deferred contrast debt this carries. */
		color: #fff;
		white-space: nowrap;
		pointer-events: none;
		letter-spacing: var(--ls-tight);
	}
	/* Per-tick marker rendered on top of the summon bar (P3 — Summon.effects[]
	   summonTick triggers). Short bottom-anchored stub (ruler-mark cadence) —
	   leaves the bar's top-light gradient uncut. Slight alpha is fine here:
	   it composites over the bar's own opaque fill, never the connectors. */
	.rp-summon-tick {
		position: absolute;
		bottom: 0;
		/* Integer height (≈40% of the 12px bar) — a %-height lands on a
		   subpixel and fuzzes the bottom edge past the bar */
		height: 5px;
		width: 1px;
		opacity: 0.92;
		z-index: 3;
		pointer-events: none;
		/* No centering shift — a tick at the bar's start time (Linnea Q)
		   must sit flush with the bar's left edge, not straddle it */
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
		border: 1.5px dashed var(--rp-active);
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
	/* ↻ 2026-08-11: 0.85 white → full (⚓ Nate, "all labels back to white"). The
	   active strip is opaque so this is not a legibility-over-scene fix, but the
	   token names on it are the chart's most-read text and they now match every
	   other label rather than sitting a step below them for no reason. */
	.rp-active-text {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: #fff;
	}
	/* N/C/P (everything but E/Q) tokens on a no-frame-map character: warning-
	   tinted text, marking the actions whose timing is generic. --ui-danger,
	   not a domain color — approximate timing is a consequence to the user's
	   data, not a game fact (dire-retirement round, 2026-08-05). */
	.rp-active-text--danger {
		color: color-mix(in srgb, rgba(255, 255, 255, 0.9) 55%, var(--ui-danger));
	}

	/* ── E/Q row left-edge badge ──────────────────────────────── */
	/* ↻ 2026-08-11 round two: --bright-ink → white. This badge and the summon
	   label were the last two holdouts of the bright-chip idiom; both convert,
	   and the --dim variant no longer needs an override because white IS the
	   base now. See the halo block for the deferred contrast debt. */
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

	.rp-composer {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 var(--rp-frame-pad-x);
	}
	/* Picking takes over the instrument. The Source overlay bounds to the frame
	   and used to cover this as part of it; it no longer reaches, so the state
	   is asserted rather than implied — `inert` in the markup kills interaction,
	   this says so. Paint alpha, never element opacity (the WebKit law): the
	   composer sits over the live scene. */
	.rp-composer--picking {
		background: color-mix(in srgb, var(--surface-raised) 45%, transparent);
	}
	.rp-composer--picking .rp-notation-wrap {
		visibility: hidden;
	}
	/* ← Explore alternatives — the picker's own footer chip (tall-bench round:
	   it used to dock in the label column, which the ribbon now owns at every
	   height). Same chip register as the KQM/PNG export buttons — a solid quiet
	   fill, brightening on hover. align-self keeps it hugging its text at the
	   overlay's bottom-left; the picker above it takes the remaining height. */
	.rp-explore-link {
		flex-shrink: 0;
		align-self: flex-start;
		box-sizing: border-box;
		margin-top: 8px;
		padding: 6px 10px;
		border-radius: var(--r-sm);
		background: var(--control-face);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		text-decoration: none;
		white-space: nowrap;
		color: var(--control-ink);
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.rp-explore-link:hover {
		background: var(--control-face-hover);
	}
	.rp-explore-arrow {
		display: inline-flex;
		vertical-align: -2px;
		transition: transform 150ms ease;
	}
	.rp-explore-link:hover .rp-explore-arrow {
		transform: translateX(-2px);
	}
	.rp-notation-wrap {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
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
		font-family: var(--font-body);
		font-size: 13px;
		line-height: var(--lh-relaxed);
		color: var(--text);
		white-space: pre;
		overflow: auto;
	}
</style>
