<script lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
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
	import SlotPortrait from '$lib/components/SlotPortrait.svelte';
	import BuffTooltip from '$lib/components/BuffTooltip.svelte';
	import { BUFF_STAT_ICON } from '$lib/timeline/buffStatMaps';
	import {
		elementPalette,
		shiftHue,
		castFill,
		type ElementPalette
	} from '$lib/utils/elementColors';
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
		onOpenSelector,
		onTabLoadoutChange,
		onTabConChange,
		sourceOpen = false,
		sourceOverlay
	}: {
		characterSlots?: string[];
		notation?: string;
		tabLoadout?: Record<string, LoadoutEntry>;
		/** Per-tab constellation overrides (Layer 2). Shadows the roster's global
		 *  `constellations` field-by-field, exactly like tabLoadout shadows loadout. */
		tabCon?: Record<string, number>;
		onOpenSelector?: () => void;
		onTabLoadoutChange?: (charId: string, update: Partial<LoadoutEntry>) => void;
		/** A constellation chip was set in the planner — writes Layer 2 (the tab),
		 *  never the roster, and never marks the character owned (theorycraft ≠
		 *  ownership). */
		onTabConChange?: (charId: string, level: number) => void;
		/** When true, the character Source panel is layered over the track area. */
		sourceOpen?: boolean;
		/** Source panel content (the planner page's CharacterSelector), rendered
		 *  in-frame from the portrait column's edge. */
		sourceOverlay?: import('svelte').Snippet;
	} = $props();

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------
	let scale = $state(60); // px per second
	// Swap ping now lives in site settings (chrome ⚙ overlay); the timeline
	// just reads it — edits there re-parse the rotation reactively.
	let swapFrames = $derived($siteSettings.swapFrames);

	// "Explore alternatives →" hands the whole current team to the Team Builder.
	const exploreTeamParam = $derived(characterSlots.filter((id) => id && id !== 'blank').join(','));

	// ---------------------------------------------------------------------------
	// Layout constants (px)
	// ---------------------------------------------------------------------------

	const LABEL_W = 145;
	const RULER_H = 28;
	const CHAR_PAD_TOP = 10;
	const E_ROW_H = 20;
	const Q_ROW_H = 20;
	const ACTIVE_ROW_H = 40; // exactly 2× E/Q row height
	const CHAR_BUFF_ROW_H = 14; // tightened aux-row convention
	const CHAR_PAD_BOTTOM = 10;
	const ROW_GAP = 4;
	// 2px visual gap between consecutive buff subrows
	const CHAR_BUFF_ROW_STRIDE = CHAR_BUFF_ROW_H + 2; // = 16

	// Summon lane (between E and Q, conditional on summons[].length > 0)
	const SUMMON_ROW_H = 14;
	const SUMMON_ROW_STRIDE = SUMMON_ROW_H + 2; // = 16
	// Gap above and below the summon lane. 3px is chosen so adding a summon costs
	// exactly one CHAR_BUFF_ROW_STRIDE (16px) — `3 + 14 + 3 - 4(no-summon E↔Q gap)
	// = 16` — which is the same amount the buff reservation gives back when one
	// of its rows is replaced by a summon. Net slot-height delta: zero.
	const SUMMON_LANE_GAP = 3;

	// Default reservation for the shared aux-row pool — summon sub-rows above the
	// Q row and received-buff sub-rows below the active row count toward the same
	// budget. The slot grows only when summon + buff combined exceeds this.
	// Cut 4 → 3 (Nate 2026-07-19): the reserve is the tool's single largest
	// vertical investment (one row = 16px × 4 slots = 64px), the typical
	// rotation fills fewer rows, and overflow already grows the slot safely.
	const DEFAULT_RESERVED_AUX_ROWS = 3;

	// Below-timeline lanes (team buffs, NB, Moonsign) — shared 14px bar + 2px
	// padding each side; multi-row lanes grow with row count.
	const AUX_LANE_BAR_H = 14;
	const AUX_LANE_PAD_Y = 2;
	const AUX_LANE_BAR_STRIDE = AUX_LANE_BAR_H + 2; // = 16
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

	// castFill (the cast-pill / summon vertical top-light) now lives in
	// $lib/utils/elementColors so the Team Builder's Compare bars share the exact
	// finish. Its Safari-revert history travelled with it.

	// One gradient stop for the time-scaling buff envelope: --calm-tint (the buff
	// body/fill) at the given alpha. color-mix with transparent ≡ rgba(calm-tint,
	// alpha), so ramp/decay bars track any future --calm-tint change and stay in
	// sync with the flat buff bars (which fill solid --calm-tint).
	function calmStop(alpha: number): string {
		return `color-mix(in srgb, var(--calm-tint) ${(alpha * 100).toFixed(1)}%, transparent)`;
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
		const o0 = 0.2 + p0 * 0.8;
		const o1 = 0.2 + p1 * 0.8;
		return `linear-gradient(to right, ${calmStop(o0)}, ${calmStop(o1)})`;
	}

	// Returns a linear-gradient CSS string for decaying buff bars, fading from full
	// opacity (decay start) to dim (decay end). Mirrors rampingBackground in reverse.
	// Decay duration equals the host effect's buff duration.
	function decayingBackground(bar: CharReceivedBuffBar): string | undefined {
		const decay = bar.decayParams;
		if (!decay || bar.buffStart == null || decay.duration <= 0) return undefined;
		const p0 = Math.min(1, Math.max(0, (bar.start - bar.buffStart) / decay.duration));
		const p1 = Math.min(1, Math.max(0, (bar.end - bar.buffStart) / decay.duration));
		const o0 = 1.0 - p0 * 0.8;
		const o1 = 1.0 - p1 * 0.8;
		return `linear-gradient(to right, ${calmStop(o0)}, ${calmStop(o1)})`;
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
			// E ↔ Q: standard ROW_GAP when no summon lane sits between them.
			return CHAR_PAD_TOP + E_ROW_H + ROW_GAP;
		}
		// E ↔ summon ↔ Q: tight 2px gaps on both sides of the summon lane.
		return CHAR_PAD_TOP + E_ROW_H + SUMMON_LANE_GAP + summonH + SUMMON_LANE_GAP;
	}

	function activeRowOffsetForSlot(slotIdx: number): number {
		return qRowTopForSlot(slotIdx) + Q_ROW_H + ROW_GAP;
	}

	function buffRowsTopForSlot(slotIdx: number): number {
		return activeRowOffsetForSlot(slotIdx) + ACTIVE_ROW_H + ROW_GAP;
	}

	// Aux-row budget: summon sub-rows (between E and Q) and received-buff sub-rows
	// (below the active row) share one DEFAULT_RESERVED_AUX_ROWS reservation.
	// Examples (rows reserved → buff slots reserved):
	//   0 summon + 2 buffs  → 3 reserved → buff reserves 3 (slot at baseline)
	//   1 summon + 0 buffs  → 3 reserved → buff reserves 2 (slot at baseline)
	//   1 summon + 3 buffs  → 4 reserved → buff reserves 3 (slot grows by stride)
	function slotBuffRowsReserved(slotIdx: number): number {
		const summonCount = summonSubrows.filter((r) => r.slotIdx === slotIdx).length;
		const buffCount = slotReceivedSubrowCounts[slotIdx] ?? 0;
		const totalAux = summonCount + buffCount;
		const reservedAux = Math.max(DEFAULT_RESERVED_AUX_ROWS, totalAux);
		return Math.max(0, reservedAux - summonCount);
	}

	// Block height intentionally excludes LOADOUT_ROWS_H — the loadout panel
	// in the label column lives within the cell's existing real estate, so the
	// track column doesn't carry a parallel dead band underneath.
	function slotBlockH(slotIdx: number): number {
		const buffRows = slotBuffRowsReserved(slotIdx);
		const buffH = buffRows > 0 ? buffRows * CHAR_BUFF_ROW_STRIDE - 2 : 0;
		return buffRowsTopForSlot(slotIdx) + buffH + CHAR_PAD_BOTTOM;
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

	// ---------------------------------------------------------------------------
	// Derived: timeline dimensions
	// ---------------------------------------------------------------------------

	let trackScrollWidth = $state(0);
	let trackScrollEl: HTMLDivElement | undefined;
	let extScrollEl: HTMLDivElement | undefined;
	// The ruler strip viewport — a pure FOLLOWER of the two real scrollers
	// (overflow hidden, no user scroll, never a latch source): it only ever
	// receives programmatic scrollLeft writes, so it can't trigger the
	// Safari interrupted-momentum jump the latch protects against.
	let rulerScrollEl: HTMLDivElement | undefined;

	// Mirrored-scroll gesture latching. The two scrollers mirror each other,
	// but a programmatic scrollLeft write onto an element that is momentum-
	// scrolling breaks the scroll: Chrome/Firefox hitch, and Safari resolves
	// the interrupted momentum by JUMPING the scroll to its end position
	// (WebKit's known interrupted-momentum behavior). Echo detection by
	// expected-value comparison proved fragile against Safari's scroll-event
	// cadence, so latch instead — mirroring what browsers themselves do with
	// gestures: whichever element last saw a scroll event while the other was
	// idle is the SOURCE; the other side's events are ignored wholesale until
	// the source has been quiet for 150ms. Mirror writes are batched to rAF so
	// they never run inside the source's scroll-event dispatch, and the
	// actively-scrolling element never receives a programmatic write.
	let syncSource: 'track' | 'ext' | null = null;
	let syncSourceTimer: ReturnType<typeof setTimeout> | undefined;
	let mirrorRaf = 0;

	function latchSource(side: 'track' | 'ext') {
		syncSource = side;
		clearTimeout(syncSourceTimer);
		syncSourceTimer = setTimeout(() => (syncSource = null), 150);
	}

	function scheduleMirror() {
		if (mirrorRaf) return;
		mirrorRaf = requestAnimationFrame(() => {
			mirrorRaf = 0;
			if (!trackScrollEl || !extScrollEl) return;
			if (syncSource === 'track') extScrollEl.scrollLeft = trackScrollEl.scrollLeft;
			else if (syncSource === 'ext') trackScrollEl.scrollLeft = extScrollEl.scrollLeft;
			// Ruler follows whichever side drove this mirror pass.
			if (rulerScrollEl && syncSource) {
				rulerScrollEl.scrollLeft =
					syncSource === 'track' ? trackScrollEl.scrollLeft : extScrollEl.scrollLeft;
			}
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
		clearTimeout(syncSourceTimer);
		cancelAnimationFrame(mirrorRaf);
	});

	function onTrackScroll() {
		markScrolling();
		if (syncSource === 'ext') return; // echo of our ext-driven mirror write
		latchSource('track');
		scheduleMirror();
	}
	function onExtScroll() {
		markScrolling();
		if (syncSource === 'track') return; // echo of our track-driven mirror write
		latchSource('ext');
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

	let ticks = $derived(rulerTicks(totalDuration, scale));
	let majorTicks = $derived(ticks.filter((t) => t.major));

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
	function connectorStyle(from: SlottedTrack, to: SlottedTrack): string | null {
		const geo = connectorGeom(from, to);
		if (!geo) return null;
		const { x, w, yTop, yBottom, downward } = geo;
		const r = Math.min(3, Math.floor(w / 2));
		// Downward: free corners are TR and BL; upward: TL and BR
		const radius = downward ? `0 ${r}px 0 ${r}px` : `${r}px 0 ${r}px 0`;
		return `left:${x}px;top:${yTop}px;width:${w}px;height:${yBottom - yTop}px;border-radius:${radius}`;
	}

	// Full content height of the track area (ruler + slots + lanes) — sizes
	// the PNG export canvas.
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
			elementGlyphFor: (el) => (el ? `/assets/elements/flat-color/${el}.png` : null)
		};
	}

	// PNG export lives on the chart it renders (bottom view cluster). The
	// button's own label carries the outcome feedback — no page-level notice.
	let pngMenuOpen = $state(false);
	let pngBusy = $state(false);
	let pngFeedback = $state<string | null>(null);
	let pngFeedbackTimer: ReturnType<typeof setTimeout> | undefined;

	async function runPng(mode: 'copy' | 'download') {
		pngMenuOpen = false;
		if (pngBusy) return;
		pngBusy = true;
		let result: 'copied' | 'downloaded' | 'failed';
		try {
			const blob = await renderTimelinePng(buildSnapshot());
			result = await deliverPng(blob, 'critcalc-rotation.png', mode);
		} catch (e) {
			console.error('PNG export failed:', e);
			result = 'failed';
		}
		pngBusy = false;
		pngFeedback =
			result === 'copied' ? '✓ Copied' : result === 'downloaded' ? '✓ Saved' : '✗ Failed';
		clearTimeout(pngFeedbackTimer);
		pngFeedbackTimer = setTimeout(() => (pngFeedback = null), 1600);
	}

	// KQM copy lives on the notation head — it copies the canonical form of
	// exactly the text it sits on. Same transient in-label feedback idiom.
	let kqmFeedback = $state<string | null>(null);
	let kqmFeedbackTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyKqm() {
		if (!notation.trim()) return;
		let ok = true;
		try {
			await navigator.clipboard.writeText(toKqmNotation(notation));
		} catch {
			ok = false;
		}
		kqmFeedback = ok ? '✓ Copied' : '✗ Failed';
		clearTimeout(kqmFeedbackTimer);
		kqmFeedbackTimer = setTimeout(() => (kqmFeedback = null), 1600);
	}

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

	// ---------------------------------------------------------------------------
	// Caveat panel
	// ---------------------------------------------------------------------------

	let showNotes = $state(false);

	let slotCaveats = $derived.by(() => {
		const seen = new SvelteSet<string>();
		return slotCharacters
			.filter((c): c is NonNullable<typeof c> => c != null)
			.filter((c) => {
				const fresh = !seen.has(c.id);
				seen.add(c.id);
				return fresh;
			})
			.map((char) => ({
				id: char.id,
				displayName: char.displayName,
				element: char.element,
				caveats: [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])]
					.filter((a) => a.caveat)
					.map((a) => ({
						name: a.name,
						caveat: a.caveat!,
						kind:
							a.abilityType === 'constellation'
								? `C${a.constellationLevel}`
								: a.abilityType.charAt(0).toUpperCase() + a.abilityType.slice(1)
					}))
			}))
			.filter((entry) => entry.caveats.length > 0);
	});

	let hasCaveats = $derived(slotCaveats.length > 0);

	$effect(() => {
		if (!hasCaveats) showNotes = false;
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
<div class="rp-root">
	<!-- ── Timeline chart frame ──────────────────────────────── -->
	<!-- The frame is ONE instrument with a fixed grammar: time axis (ruler +
	     view controls) on the TOP edge per DAW/NLE convention, rendered tracks
	     in the middle, and the notation COMPOSER (input + its KQM/PNG submit
	     pair) on the BOTTOM edge — the chat-app register: you write at the
	     bottom, the conversation renders above. -->
	<div class="rp-frame vz-anim-frame">
		<!-- ── Ruler strip (full frame width, ABOVE the track area) ── -->
		<!-- Its own row so the notes panel can never push it: the ruler
		     viewport is a scroll FOLLOWER (overflow hidden, mirrored from the
		     track/ext scrollers), and the view cluster stays pinned to the
		     frame's right edge. -->
		<div class="rp-ruler-strip">
			<div class="rp-ruler-spacer" style:width="{LABEL_W}px"></div>
			<div class="rp-ruler-scroll" bind:this={rulerScrollEl}>
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
			<!-- View cluster — rides the strip's right end (the frame's "view
			     controls" corner), fading in over the scrolling tick strip:
			     total · zoom · Notes. -->
			<div class="rp-view-cluster" style:height="{RULER_H}px">
				{#if rotation.totalDuration > 0}
					<span class="rp-ruler-total" title="Total rotation length"
						><span class="rp-ruler-total-key">Total</span>{Math.round(rotation.totalDuration * 10) /
							10}s</span
					>
				{/if}
				<button
					class="rp-zoom-btn"
					type="button"
					aria-label="Zoom out"
					onclick={() => (scale = Math.max(20, scale - 5))}>−</button
				>
				<input
					type="range"
					min={20}
					max={120}
					step={5}
					bind:value={scale}
					class="vz-slider rp-zoom-slider"
					aria-label="Zoom"
					title="Zoom — pixels per second"
				/>
				<button
					class="rp-zoom-btn"
					type="button"
					aria-label="Zoom in"
					onclick={() => (scale = Math.min(120, scale + 5))}>+</button
				>
				<button
					class="rp-zoom-btn rp-notes-btn"
					class:rp-notes-btn--active={showNotes}
					type="button"
					aria-label="Toggle notes panel"
					disabled={!hasCaveats}
					onclick={() => (showNotes = !showNotes)}
					>NOTES{#if hasCaveats}<span class="rp-notes-badge">!</span>{/if}</button
				>
			</div>
		</div>
		<div
			class="rp-timeline-area"
			class:rp-timeline-area--notes={showNotes && hasCaveats}
			class:rp-timeline-area--picking={sourceOpen}
		>
			<div class="rp-scroll-wrapper">
				<!-- Left label column (sticky, non-scrolling) -->
				<div class="rp-label-col" style:width="{LABEL_W}px">
					<!-- Character slot labels (always 4) -->
					{#each characterSlots as slotId, i (i)}
						{@const char = slotCharacters[i]}
						<!-- The per-slot roster card (shared with the Team Builder Bench).
							     Constellation/loadout edits here are Layer-2 (the tab) writes —
							     the callbacks route to onTabConChange / onTabLoadoutChange, which
							     never touch the roster or mark ownership. -->
						<div class="rp-label-cell char-label" style:height="{slotBlockH(i)}px">
							<SlotPortrait
								{slotId}
								{char}
								conLevel={char ? effectiveConLevel(char.id) : 0}
								loadoutEntry={char ? effectiveLoadoutEntry(char.id) : {}}
								onSetCon={(level) => char && onTabConChange?.(char.id, level)}
								onSetArtifact={(id) => char && onTabLoadoutChange?.(char.id, { artifactSetId: id })}
								onSetWeapon={(id, ref) =>
									char && onTabLoadoutChange?.(char.id, { weaponId: id, weaponRefinement: ref })}
								onSetRefinement={(r) =>
									char && onTabLoadoutChange?.(char.id, { weaponRefinement: r })}
								onPortraitClick={onOpenSelector}
							/>
						</div>
					{/each}

					{#if sourceOpen}
						<!-- Explore alternatives → is tied to the picker, not the main
						     surface: while you're choosing team members it docks under the
						     portraits (over the now-irrelevant lane labels, which the Source
						     overlay covers on the right anyway) and hands the whole team to
						     the Team Builder. -->
						<a
							class="rp-explore-link"
							href="{resolve('/team-builder')}{exploreTeamParam ? `?team=${exploreTeamParam}` : ''}"
							title="Open the current team in the Team Builder to compare alternatives"
						>
							<span class="rp-explore-inner"
								>Explore <span class="rp-explore-tail"
									>alternatives <span class="rp-explore-arrow">→</span></span
								></span
							>
						</a>
					{:else}
						<!-- Team buffs label (lane cells: border-top separators only).
							 The header hides when the lane is empty — the row itself stays
							 (unchanged height) so nothing below it shifts. -->
						<div class="rp-label-cell rp-label-cell--lane" style:height="{teamBuffsH}px">
							{#if teamBuffRows.length > 0}
								<span class="rp-label-text">TEAM BUFFS</span>
							{/if}
						</div>

						<!-- NB lane label -->
						{#if teamComp.natlanCount >= 1}
							<div
								class="rp-label-cell rp-label-cell--lane rp-label-cell--lane-sep"
								style:height="{nbLaneH}px"
							>
								<span class="rp-label-text">NIGHTSOUL BURSTS</span>
							</div>
						{/if}

						<!-- Moonsign lane label -->
						{#if teamComp.hasAscendantGleam}
							<div
								class="rp-label-cell rp-label-cell--lane rp-label-cell--lane-sep"
								style:height="{moonsignLaneH}px"
							>
								<span class="rp-label-text">ASCENDANT GLEAM</span>
							</div>
						{/if}
					{/if}
				</div>

				<!-- Right scrollable track area -->
				<div
					class="rp-track-scroll"
					bind:this={trackScrollEl}
					bind:clientWidth={trackScrollWidth}
					onscroll={onTrackScroll}
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
						     ghost CD tracks. -->
						{#each majorTicks as tick (tick.t)}
							<div class="rp-gridline" style:left="{tick.x}px"></div>
						{/each}

						<!-- Character slot tracks (always 4 rows) -->
						{#each slotCharacters as char, slotIdx (slotIdx)}
							{@const p = pal(char?.element)}
							{@const slotTracks = tracksBySlot[slotIdx]}

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
											     pass behind these bars. -->
													<div
														class="rp-bar-uptime"
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background="color-mix(in srgb, {p.main} 65%, var(--rp-chart-bg))"
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
															style:background="color-mix(in srgb, {p.main} 65%, var(--rp-chart-bg))"
														></div>
													{/if}
												{:else if seg.role === 'ghost'}
													<div
														class="rp-bar-cd rp-bar-cd--ghost"
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background="color-mix(in srgb, {p.main} 20%, var(--rp-chart-bg))"
														style:border-color="color-mix(in srgb, {p.main} 25%, var(--rp-chart-bg))"
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
														class="rp-bar-uptime"
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background="color-mix(in srgb, {p.main} 65%, var(--rp-chart-bg))"
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
															style:background="color-mix(in srgb, {p.main} 65%, var(--rp-chart-bg))"
														></div>
													{/if}
												{:else if seg.role === 'ghost'}
													<div
														class="rp-bar-cd rp-bar-cd--ghost"
														style:left="{g.left}px"
														style:width="{g.width}px"
														style:background="color-mix(in srgb, {p.main} 20%, var(--rp-chart-bg))"
														style:border-color="color-mix(in srgb, {p.main} 25%, var(--rp-chart-bg))"
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
												style:background={block.kind === 'skill' ||
												block.kind === 'burst' ||
												block.kind === 'elemental-normal'
													? `color-mix(in srgb, ${p.main} 50%, var(--rp-active))`
													: undefined}
												style:border-right={bi === track.inputBlocks.length - 1
													? 'none'
													: undefined}
											>
												{#each block.parts as part (part)}
													<span class="rp-active-text">{part}</span>
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
												<span class="rp-buff-label">{procRow.label} trigger CD</span>
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
												<span class="rp-buff-label">{bar.sourceLabel}</span>
											</div>
										{/each}
									</div>
								{/each}
							</div>
						{/each}

						<!-- Team buffs row. When there are no buffs the lane stays present
							 (same height) but renders nothing — the hidden header carries
							 the "empty" signal, no placeholder text. -->
						<div class="rp-team-buffs" style:height="{teamBuffsH}px">
							{#if teamBuffRows.length > 0}
								<div class="rp-team-buff-rows">
									{#each teamBuffRows as subrow (subrow.key)}
										<div class="rp-team-buff-subrow">
											{#each subrow.bars as bar, bi (bi)}
												{@const g = barGeom(bar.start, bar.end - bar.start)}
												{@const icon = BUFF_STAT_ICON[subrow.primaryStat]}
												{@const isDebuff = subrow.kind === 'debuff'}
												<!-- svelte-ignore a11y_no_static_element_interactions -->
												<div
													class="rp-team-buff-bar"
													class:rp-team-debuff-bar={isDebuff}
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
													<span class="rp-buff-label">{subrow.sourceLabel}</span>
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
								<div class="rp-moonsign-rows">
									{#each moonsignRows as row (row.slotIdx)}
										{@const msChar = slotCharacters[row.slotIdx]}
										<div class="rp-moonsign-subrow">
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
													{#if g.width > 40}
														<span class="rp-bar-cd-label">{win.duration}s</span>
													{/if}
												</div>
											{/each}
											<!-- Row label floats above the (freely overlapping) windows so
											     later windows can't paint over it -->
											{#if row.windows.length > 0}
												{@const fg = barGeom(row.windows[0].start, 0)}
												<span class="rp-moonsign-label" style:left="{fg.left + 4}px"
													>{msChar?.displayName} · Ascendant Gleam</span
												>
											{/if}
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

			{#if showNotes && hasCaveats}
				<div class="rp-caveat-panel">
					{#each slotCaveats as entry (entry.id)}
						<div class="rp-caveat-char">
							<div class="rp-caveat-char-name" style:color={pal(entry.element).main}>
								{entry.displayName}
							</div>
							{#each entry.caveats as item, ci (ci)}
								<div class="rp-caveat-item">
									<span class="rp-caveat-ability"
										><span class="rp-caveat-kind">{item.kind}</span>{item.name}</span
									>
									<p class="rp-caveat-text">{item.caveat}</p>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			{/if}

			<!-- ── Character Source overlay ─────────────────────────────
			     Non-modal: layers over the track area from the portrait
			     column's right edge (the 4 live portraits stay the team
			     display). Positioning is ours; the content is the planner
			     page's CharacterSelector, handed in as a snippet. -->
			{#if sourceOpen && sourceOverlay}
				<div class="rp-source-overlay" style:left="{LABEL_W}px">
					{@render sourceOverlay()}
				</div>
			{/if}
		</div>
		<!-- /rp-timeline-area -->

		<!-- ── External scrollbar (below timeline, synced to track) ─ -->
		<div class="rp-ext-scroll-wrap">
			<div class="rp-ext-scroll-spacer" style:width="{LABEL_W}px"></div>
			<div class="rp-ext-scroll" bind:this={extScrollEl} onscroll={onExtScroll}>
				<div style:width="{totalWidth}px" style:height="1px"></div>
			</div>
		</div>

		<!-- ── Composer (bottom edge) ────────────────────────────── -->
		<!-- The notation input rides the frame's bottom like a chat composer:
		     you write the rotation here, the timeline renders it above. The
		     KQM/PNG pair sits just outside the box on the right — the
		     "submit/send" position for a finished rotation. Left margin aligns
		     the box with the track area (right edge of portraits). -->
		<div class="rp-composer" style:margin-left="{LABEL_W}px">
			<div class="rp-notation-wrap">
				<div class="rp-notation" use:mountEditor={notation}></div>
			</div>
			<div class="rp-composer-actions">
				<button
					class="rp-composer-btn"
					type="button"
					disabled={!notation.trim()}
					onclick={copyKqm}
					title="Copy this rotation as KQM combat notation">{kqmFeedback ?? '⎘ KQM'}</button
				>
				<div class="rp-png-wrap">
					<button
						class="rp-composer-btn"
						type="button"
						disabled={!notation.trim() || pngBusy}
						aria-haspopup="menu"
						aria-expanded={pngMenuOpen}
						onclick={() => (pngMenuOpen = !pngMenuOpen)}
						title="Export the timeline as an image">{pngFeedback ?? '⧉ PNG'}</button
					>
					{#if pngMenuOpen}
						<div
							class="rp-popover-backdrop"
							role="button"
							tabindex="-1"
							aria-label="Close export menu"
							onclick={() => (pngMenuOpen = false)}
							onkeydown={(e) => {
								if (e.key === 'Escape') pngMenuOpen = false;
							}}
						></div>
						<div class="rp-png-menu" role="menu">
							<button class="rp-png-item" role="menuitem" onclick={() => runPng('copy')}
								>Copy image</button
							>
							<button class="rp-png-item" role="menuitem" onclick={() => runPng('download')}
								>Download</button
							>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
	<!-- /rp-frame -->

	<!-- Constellation + refinement popovers now live inside SlotPortrait. -->

	<!-- ── Buff tooltip ────────────────────────────────────────── -->
	{#if tooltip}
		<BuffTooltip tip={tooltip} />
	{/if}
</div>

<style>
	/* ── Root ─────────────────────────────────────────────────── */
	.rp-root {
		/* Chart ground — the canonical instrument-frame fill, shared with the
		   Visualizers chart frames. Also read by the Phase-3 ghost-bar
		   color-mix in the markup, so the ghost tint stays anchored to the
		   surface it actually sits on. The old local --bg/--card/--border
		   redefinitions are gone; this component reads global app.css tokens. */
		--rp-chart-bg: #081225;
		/* Structural lines inside the chart, hue-consistent with the ground:
		   grid = faint vertical second-lines; line = lane separators. */
		--rp-grid: #13203a;
		--rp-line: #1c2a4a;
		/* The active-strip neutral: the continuous "who's on field" surface —
		   input blocks, swap connectors, and the active background strip all
		   share it (the elemental block mix in the markup references it too). */
		--rp-active: #5a6180;

		font-family: var(--font-body);
		font-size: var(--fs-md);
		color: var(--text);
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	/* ── Chart frame (timeline + external scrollbar) ─────────── */
	/* .vz-anim-frame (app.css) supplies the 1px dire-tint border + #081225
	   fill; this only shapes it. Radius 9 per the 3/6/9 scale. */
	.rp-frame {
		border-radius: 9px;
		padding: 10px 14px 4px;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	/* Track/thumb styling comes from the shared .vz-slider (app.css). */
	.rp-zoom-slider {
		width: 96px;
	}
	.rp-zoom-btn {
		background: rgba(255, 255, 255, 0.06);
		border: none;
		border-radius: 3px;
		cursor: pointer;
		font-size: var(--fs-md);
		line-height: var(--lh-none);
		height: 18px;
		padding: 0 6px;
		display: grid;
		place-items: center;
		color: var(--muted);
		user-select: none;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.rp-zoom-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text);
	}

	/* ── Timeline area (scroll + optional caveat panel) ──────── */
	.rp-timeline-area {
		position: relative;
		display: flex;
		flex-direction: row;
		align-items: stretch;
	}
	/* Notes open: the tracks yield the panel's width (the "push"); the panel
	   itself is an absolute overlay so its height is LOCKED to the track
	   area's — long caveats scroll in place and can never grow the frame. */
	.rp-timeline-area--notes .rp-scroll-wrapper {
		margin-right: 240px;
	}
	/* Picking: guarantee the Source overlay a usable height even when the
	   rotation is short (an empty timeline is just 4 slot cards tall). The
	   composer stays visible below. */
	.rp-timeline-area--picking {
		min-height: 24rem;
	}

	/* ── Character Source overlay ─────────────────────────────── */
	/* Non-modal: opaque panel over the track area only, from the portrait
	   column's right edge (left set inline = LABEL_W). The 4 live portraits
	   stay visible on the left as the team display. Locked to the track area's
	   box like the caveat panel — it never grows the frame past its min-height. */
	.rp-source-overlay {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 6;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
		padding: 10px 12px 12px;
		background: var(--rp-chart-bg);
		border-left: 1px solid var(--rp-line);
	}

	/* ── Caveat panel ─────────────────────────────────────────── */
	.rp-caveat-panel {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 240px;
		border-left: 1px solid var(--rp-line);
		overflow-y: auto;
		padding: 8px 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.rp-caveat-char {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.rp-caveat-char-name {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
	}
	.rp-caveat-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.rp-caveat-ability {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--muted);
		letter-spacing: var(--ls-mid);
	}
	.rp-caveat-kind {
		display: inline-block;
		margin-right: 6px;
		padding: 0 4px;
		border: 1px solid var(--rp-line);
		border-radius: 3px;
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-widest);
		opacity: 0.8;
	}
	.rp-caveat-text {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--text);
		line-height: var(--lh-normal);
		opacity: 0.75;
	}

	/* ── Scroll wrapper ───────────────────────────────────────── */
	.rp-scroll-wrapper {
		position: relative;
		display: flex;
		flex: 1;
		min-width: 0;
	}

	/* ── View cluster (over the top ruler's right end) ─────────── */
	/* The frame's "view controls" corner: total · zoom · Notes. */
	.rp-view-cluster {
		position: absolute;
		top: 0;
		right: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		/* Right padding keeps the NOTES badge (the last item) clear of the
		   frame edge; bottom padding lifts the controls off the tick strip. */
		padding: 0 8px 6px 48px;
		/* Fade the ruler out under the controls: a fixed 40px ramp to solid
		   chart ground, with the contents starting past it (padding-left) so
		   ticks never show through the translucent chips. */
		background: linear-gradient(to right, transparent, var(--rp-chart-bg) 40px);
		z-index: 5;
	}
	.rp-view-cluster .rp-zoom-slider {
		width: 88px;
	}
	/* Total-length readout — chip backing separates it from the ruler's tick
	   numbers; the TOTAL key says what it is. */
	.rp-ruler-total {
		background: rgba(255, 255, 255, 0.06);
		border-radius: 3px;
		padding: 2px 7px;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		color: var(--text);
		white-space: nowrap;
	}
	.rp-ruler-total-key {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		color: var(--muted);
		margin-right: 6px;
	}

	/* ── Notes button (view cluster) ──────────────────────────── */
	.rp-notes-btn {
		position: relative;
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		padding: 0 8px;
	}
	.rp-notes-btn:disabled {
		opacity: 0.3;
		cursor: default;
		pointer-events: none;
	}
	.rp-notes-btn--active {
		background: rgba(255, 255, 255, 0.12);
		color: var(--text);
	}
	/* Notification dot: notes exist for the loaded characters. */
	.rp-notes-badge {
		position: absolute;
		top: -5px;
		right: -6px;
		width: 13px;
		height: 13px;
		border-radius: 50%;
		background: var(--dire-tint);
		color: var(--text);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		line-height: var(--lh-none);
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	/* ── PNG pop-out (composer) ───────────────────────────────── */
	.rp-png-wrap {
		position: relative;
	}
	/* Opens upward — the button rides the composer at the frame's bottom. */
	.rp-png-menu {
		position: absolute;
		bottom: calc(100% + 4px);
		right: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		background: var(--surface-raised);
		border-radius: 6px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 4px 16px rgba(0, 0, 0, 0.5);
		padding: 2px 0;
		min-width: 124px;
	}
	.rp-png-item {
		background: transparent;
		border: none;
		padding: 6px 12px;
		font-size: var(--fs-xs);
		color: var(--text);
		text-align: left;
		cursor: pointer;
		white-space: nowrap;
	}
	.rp-png-item:hover {
		background: color-mix(in srgb, var(--accent) 16%, transparent);
	}

	/* ── Label column ─────────────────────────────────────────── */
	.rp-label-col {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
	}
	.rp-label-spacer {
		flex-shrink: 0;
	}
	.rp-label-cell {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding-right: 10px;
		border-bottom: 1px solid var(--rp-line);
		flex-shrink: 0;
	}
	/* Lane label cells mirror the track-side lane borders: top-only
	   separators, nothing after the bottom-most lane. */
	.rp-label-cell--lane {
		border-bottom: none;
	}
	.rp-label-cell--lane-sep {
		border-top: 1px solid var(--rp-line);
	}
	.rp-label-text {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		color: var(--muted);
		text-align: right;
		line-height: var(--lh-snug);
	}

	/* ── Character label cell — hosts the shared SlotPortrait card ─── */
	/* The cell supplies the fixed row height (inline style) + the bottom
	   separator; the SlotPortrait card fills it (its .sp-card is flex:1). */
	.char-label {
		flex-direction: column;
		align-items: stretch;
		padding: 0;
	}

	/* ── Track scroll container ───────────────────────────────── */
	.rp-track-scroll {
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
	}
	.rp-track-scroll::-webkit-scrollbar {
		display: none;
	}

	/* ── External scrollbar strip ─────────────────────────────── */
	.rp-ext-scroll-wrap {
		display: flex;
		flex-shrink: 0;
	}
	.rp-ext-scroll-spacer {
		flex-shrink: 0;
	}
	.rp-ext-scroll {
		flex: 1;
		min-width: 0;
		height: 14px;
		overflow-x: auto;
		overflow-y: hidden;
	}

	/* ── Track area ───────────────────────────────────────────── */
	.rp-tracks {
		position: relative;
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
	.rp-ruler-spacer {
		flex-shrink: 0;
	}
	.rp-ruler-scroll {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}
	.rp-ruler {
		position: relative;
		border-bottom: 1px solid var(--rp-line);
	}
	.rp-tick {
		position: absolute;
		bottom: 0;
		width: 1px;
		background: #22304c;
		height: 4px;
	}
	.rp-tick.major {
		height: 8px;
		background: #35486e;
	}
	.rp-tick-label {
		position: absolute;
		bottom: 11px;
		left: 0;
		transform: translateX(-50%);
		font-size: var(--fs-xs);
		color: var(--muted);
		white-space: nowrap;
		pointer-events: none;
	}

	/* ── Overlay layers (gridlines + swap connectors) ─────────── */
	/* Plain divs, deliberately: Safari pixel-snaps CSS boxes but paints
	   inline-SVG geometry at the exact fractional page offset, so SVG
	   overlays here sat ~1px off the bars they join (Chrome/Firefox were
	   flush). See connectorStyle. */
	.rp-gridline {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--rp-grid);
		pointer-events: none;
		z-index: 0;
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
		height: 14px;
		flex-shrink: 0;
	}
	/* Buff bars overlap and must stay individually readable — solid
	   low-luminance fill, a hairline ring barely above the fill (the
	   .vz-panel register), and the brighter left edge as the scan hook. */
	.rp-team-buff-bar {
		position: absolute;
		top: 0;
		height: 100%;
		background: var(--calm-tint);
		border: none;
		border-left: 2px solid var(--calm-edge);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
		border-radius: 1px;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 5px;
		overflow: hidden;
		z-index: 1;
		min-width: 2px;
	}
	/* Debuff variant — applied to enemy resShred bars. Same geometry as the
	   buff bar; the dire tint communicates "applies to enemy" at a glance and
	   ties debuffs to the site's accent hue (--dire-tint, the calm tint's
	   adversarial counterpart). */
	.rp-team-buff-bar.rp-team-debuff-bar {
		background: color-mix(in srgb, var(--dire-tint) 24%, var(--rp-chart-bg));
		border-left-color: var(--dire-tint);
	}
	.rp-team-buff-bar.rp-team-debuff-bar .rp-buff-label {
		color: rgba(255, 255, 255, 0.85);
	}
	.rp-buff-icon {
		width: 11px;
		height: 11px;
		flex-shrink: 0;
		object-fit: contain;
		opacity: 0.85;
	}
	.rp-buff-label {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		color: rgba(255, 255, 255, 0.85);
		white-space: nowrap;
		letter-spacing: var(--ls-mid);
		pointer-events: none;
		line-height: var(--lh-none);
	}

	/* Sacrificial-proc rows share the debuff bars' register (Nate 2026-07-18;
	   formerly a gold-tinted look of their own) */
	.rp-weapon-proc-bar {
		position: absolute;
		top: 0;
		height: 100%;
		background: color-mix(in srgb, var(--dire-tint) 24%, var(--rp-chart-bg));
		border: none;
		border-left: 2px solid var(--dire-tint);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
		border-radius: 1px;
		display: flex;
		align-items: center;
		padding: 0 5px;
		overflow: hidden;
		z-index: 1;
		min-width: 2px;
	}

	/* ── NB lane ─────────────────────────────────────────────── */
	.rp-nb-lane {
		position: relative;
		border-top: 1px solid var(--rp-line);
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
		height: 14px;
		flex-shrink: 0;
	}
	/* Phlogiston fill (Nate 2026-07-18) — static "flowy" fire gradient echoing
	   the in-game Natlan energy bar. Layered px-sized tiles (odd prime widths
	   so layers never visibly sync) repeat-x over the bar: one aquamarine
	   hot-spot layer (mixed toward the light orange — full #70e1c1 is too hot
	   at this size), two light-orange blooms, and a drifting linear flow base.
	   Fixed px tiles keep the density constant at any bar width/zoom. */
	.rp-nb-bar {
		position: absolute;
		top: 0;
		height: 100%;
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
		z-index: 1;
		min-width: 2px;
	}
	/* NB is a lane, not an E/Q/summon bar — its label stays semibold and its
	   halo pins the phlogiston palette's darkest orange. */
	.rp-nb-bar .rp-bar-cast-label {
		position: absolute;
		left: 5px;
		font-weight: var(--fw-semibold);
	}
	.rp-nb-bar {
		--label-halo: #f85b21;
	}

	/* ── Moonsign lane ───────────────────────────────────────── */
	.rp-moonsign-lane {
		position: relative;
		border-top: 1px solid var(--rp-line);
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
		height: 14px;
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
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background-color: #bdbeff;
		/* Two tiled layers, top then bottom. Top: occasional soft cyan + coral
		   blooms, semi-transparent, tiled at a different prime width so they land
		   at varying points along the base; their transparent stops carry the
		   bloom's OWN hue at alpha 0, not the `transparent` keyword which WebKit
		   fades through black. Bottom: the base moonlight gradient 9DC1FF / BDBEFF
		   / D2BEFF, palindromic so BDBEFF always sits between the two ends and the
		   tile loops seamlessly. No grey wash — the tones are soft enough on their
		   own. Mirror any change in timelineExport.ts. */
		background-image:
			linear-gradient(
				80deg,
				#69dbf200 0%,
				#69dbf259 15%,
				#69dbf200 30%,
				#ef8e9100 60%,
				#ef8e9133 80%,
				#ef8e9100 100%
			),
			linear-gradient(100deg, #9dc1ff 0%, #bdbeff 25%, #d2beff 50%, #bdbeff 75%, #9dc1ff 100%);
		background-size:
			433px 100%,
			719px 100%;
		background-repeat: repeat-x;
		border: none;
		border-radius: 1px;
		z-index: 1;
	}
	/* Near-white + shared halo like every other bar label (Nate 2026-07-18).
	   Absolutely positioned above the windows (z:2) so overlapping later
	   windows can't paint over it. */
	.rp-moonsign-label {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		z-index: 2;
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		color: #fff;
		white-space: nowrap;
		pointer-events: none;
		letter-spacing: var(--ls-tight);
	}

	/* ── Character block ──────────────────────────────────────── */
	.rp-char-block {
		position: relative;
		border-bottom: 1px solid var(--rp-line);
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
	/* Ghost CD remainder: a recessed slim track — physically subordinate to
	   the cast pill — outlined on top/right/bottom (the left edge stays open so
	   the track reads as flowing out of the pill), the right edge landing on the
	   exact moment the ability comes back up. Fill + outline colors are opaque
	   element mixes set inline (border-color per element). */
	/* 14px — matches the summon/buff/debuff row height (Nate 2026-07-18) */
	.rp-bar-cd--ghost {
		top: 3px;
		height: calc(100% - 6px);
		border: none;
		border-top: 1px solid transparent;
		border-right: 1px solid transparent;
		border-bottom: 1px solid transparent;
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
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: #fff;
		white-space: nowrap;
		pointer-events: none;
		letter-spacing: var(--ls-tight);
		flex-shrink: 0;
	}
	.rp-bar-cd-label {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		color: rgba(255, 255, 255, 0.4);
		white-space: nowrap;
		pointer-events: none;
	}
	/* NB + moonsign lane durations stay full-strength — their bright fills
	   swallow the quiet 0.4 used on the element ghost tracks */
	.rp-nb-bar .rp-bar-cd-label,
	.rp-moonsign-bar .rp-bar-cd-label {
		color: #fff;
	}
	/* Shared label halo (Nate 2026-07-18): white text on light element fills
	   needs separation, and dark text didn't sit right — a soft shadow in a
	   DARK SHADE OF THE BAR'S OWN ELEMENT COLOR (--label-halo, set on each
	   char block via shiftHue lightness −30; NB/moonsign lanes pin their
	   darkest palette color) keeps the labels white without reading as an
	   effect. Text must be FULL-opacity white: alpha-reduced white lets the
	   shadow bleed through the glyphs and muddies them. Small blur radii
	   only; static, so paint cost is negligible. */
	.rp-bar-cast-label,
	.rp-bar-cd-label,
	.rp-bar-row-badge,
	.rp-summon-label,
	.rp-moonsign-label {
		text-shadow:
			color-mix(in srgb, var(--label-halo, #081225) 25%, transparent) 0px 1px 2px,
			color-mix(in srgb, var(--label-halo, #081225) 50%, transparent) 0px 0px 6px;
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
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
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
	.rp-active-bg--unset {
		background: transparent;
		border: 1.5px dashed var(--rp-active);
	}

	/* ── Input blocks ─────────────────────────────────────────── */
	.rp-input-block {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		border-right: 1px solid rgba(8, 18, 37, 0.25);
		box-sizing: border-box;
		z-index: 2;
		min-width: 2px;
		display: flex;
		align-items: center;
		padding: 0 4px;
		overflow: hidden;
	}
	.rp-input-block--normal {
		background: var(--rp-active);
	}
	.rp-input-block--movement {
		background: rgba(90, 97, 128, 0.45);
		box-shadow: none;
	}
	.rp-input-block--unset {
		background: transparent;
		border: 1px dashed var(--rp-active);
		box-shadow: none;
	}
	.rp-active-text {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		color: rgba(255, 255, 255, 0.85);
	}

	/* ── E/Q row left-edge badge ──────────────────────────────── */
	.rp-bar-row-badge {
		position: absolute;
		left: 4px;
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: #fff;
		pointer-events: none;
		letter-spacing: var(--ls-tight);
	}

	/* ── Composer (in-frame, bottom edge) ─────────────────────── */
	/* Chat-composer register: a single-line notation box as its own inset
	   well (darker-than-chart-ground + 1px three-state border = the
	   textfield signal; bg/border styling lives in notationTheme — keep in
	   lockstep), with the export pair (KQM, PNG) side-by-side just OUTSIDE
	   it on the right — the send/submit position. The box starts at the
	   portrait column's right edge (margin-left = LABEL_W, inline) rather
	   than the frame's left edge; the vertical margins are its breathing
	   room, deliberately more below. */
	.rp-composer {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 12px 0 14px;
	}
	/* Explore alternatives → docks in the label column beneath the portraits
	   while the Source picker is open (the mirror of the Bench's "Send to
	   Rotation Planner"). Same chip register as the KQM/PNG export buttons — a
	   solid quiet fill, brightening on hover — with the 2-line label centered. */
	.rp-explore-link {
		flex-shrink: 0;
		box-sizing: border-box;
		display: grid;
		place-items: center;
		margin: 6px 8px 0;
		min-height: 36px;
		padding: 6px 10px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.05);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		text-decoration: none;
		color: var(--muted);
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.rp-explore-link:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text);
	}
	/* Ragged-right wrapped text (the arrow stays attached to the last word),
	   the whole block centered in the button by the grid above. */
	/* Centered (not right-aligned) so the button reads as belonging to the
	   portrait column beneath it, not to the notation box on its right. */
	.rp-explore-inner {
		text-align: center;
		line-height: var(--lh-snug);
	}
	/* Keep "alternatives →" together so the arrow never orphans onto its own
	   line — the break falls after "Explore". */
	.rp-explore-tail {
		white-space: nowrap;
	}
	.rp-explore-arrow {
		transition: transform 150ms ease;
	}
	.rp-explore-link:hover .rp-explore-arrow {
		transform: translateX(2px);
	}
	.rp-notation-wrap {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.rp-composer-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	/* Export chips — same chip register as the view-cluster buttons. Fixed
	   min-width so the transient "✓ Copied" label doesn't reflow the row. */
	.rp-composer-btn {
		min-width: 84px;
		height: 24px;
		display: grid;
		place-items: center;
		background: rgba(255, 255, 255, 0.05);
		border: none;
		border-radius: 3px;
		padding: 0 8px;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		text-align: center;
		color: var(--muted);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.rp-composer-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text);
	}
	.rp-composer-btn:disabled {
		opacity: 0.3;
		cursor: default;
		pointer-events: none;
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
		background: color-mix(in srgb, #000 40%, var(--rp-chart-bg));
		border: 1px solid var(--rp-line);
		border-radius: 6px;
		font-family: var(--font-body);
		font-size: 13px;
		line-height: var(--lh-relaxed);
		color: var(--text);
		white-space: pre;
		overflow: auto;
	}

	/* Full-screen backdrop for the PNG export menu (the constellation /
	   refinement popovers moved into SlotPortrait with their own backdrop). */
	.rp-popover-backdrop {
		position: fixed;
		inset: 0;
		z-index: 49;
	}
</style>
