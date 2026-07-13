<script lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { parseNotation, type ParsedRotation } from '$lib/utils/notationParser';
	import type { Stat } from '$lib/types/ability';
	import type { CharacterData } from '$lib/types/character';
	import type { NotationEditor } from '$lib/utils/notationEditor';
	import { getIndexEntryByDisplayName } from '$lib/data/characterLookup';
	import { getLoadedCharacter } from '$lib/data/characterData';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import { constellations, siteSettings, loadout, type LoadoutEntry } from '$lib/stores';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import type { CharacterTrack } from '$lib/utils/notationParser';
	import { getAllArtifactSets, artifactImagePath } from '$lib/data/artifactLookup';
	import { getWeaponsByType, weaponImagePath } from '$lib/data/weaponLookup';
	import LoadoutDropdown from '$lib/components/LoadoutDropdown.svelte';
	import type { DropdownItem } from '$lib/components/LoadoutDropdown.svelte';
	import { elementPalette, type ElementPalette } from '$lib/utils/elementColors';
	import type { CharReceivedBuffBar, MergedEffectDisplay, SlottedTrack } from '$lib/timeline/types';
	import { computeTeamBuffRows } from '$lib/timeline/teamBuffRows';
	import { computeCharReceivedBuffRows } from '$lib/timeline/charReceivedBuffRows';
	import { computeWeaponProcRows } from '$lib/timeline/weaponProcRows';
	import { computeSummonSubrows, findCastSummon } from '$lib/timeline/summonSubrows';
	import { computeMoonsignRows } from '$lib/timeline/moonsignRows';
	import {
		renderTimelinePng,
		deliverPng,
		type TimelineSnapshot,
		type ExportBar
	} from '$lib/utils/timelineExport';
	import type { TimelineBar } from '$lib/utils/notationParser';

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------

	let {
		characterSlots = ['blank', 'blank', 'blank', 'blank'],
		notation = $bindable(''),
		tabLoadout = {} as Record<string, LoadoutEntry>,
		onOpenSelector,
		onTabLoadoutChange
	}: {
		characterSlots?: string[];
		notation?: string;
		tabLoadout?: Record<string, LoadoutEntry>;
		onOpenSelector?: () => void;
		onTabLoadoutChange?: (charId: string, update: Partial<LoadoutEntry>) => void;
	} = $props();

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------
	let scale = $state(60); // px per second
	// Swap ping now lives in site settings (chrome ⚙ overlay); the timeline
	// just reads it — edits there re-parse the rotation reactively.
	let swapFrames = $derived($siteSettings.swapFrames);

	// ---------------------------------------------------------------------------
	// Layout constants (px)
	// ---------------------------------------------------------------------------

	const LABEL_W = 150;
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
	const DEFAULT_RESERVED_AUX_ROWS = 4;

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

	// Cast-pill fill: a very subtle vertical top-light — 10% toward white at
	// the top edge, settling to the flat element color by 58% down the bar.
	// A whisper of the ramping-buff gradient language for polish; cast pills
	// only (summon/overflow/ghost bars stay flat so the hierarchy holds).
	function castFill(main: string): string {
		return `linear-gradient(180deg, color-mix(in srgb, ${main} 90%, white) 0%, ${main} 58%)`;
	}

	// ---------------------------------------------------------------------------
	// Team buff stat → icon / label mappings
	// ---------------------------------------------------------------------------

	const BUFF_STAT_ICON: Partial<Record<Stat, string>> = {
		atk: '/assets/effects/Icon_Attribute_Attack.webp',
		'atk%': '/assets/effects/Icon_Attribute_Attack.webp',
		baseAtk: '/assets/effects/Icon_Attribute_Attack.webp',
		critRate: '/assets/effects/Icon_Attribute_Critical_Hit.webp',
		critDmg: '/assets/effects/Icon_Attribute_Critical_Hit.webp',
		em: '/assets/effects/Icon_Attribute_Elemental_Mastery.webp',
		cdReduction: '/assets/effects/Icon_Attribute_Cooldown_Reduction.webp',
		def: '/assets/effects/Icon_Attribute_Defense.webp',
		'def%': '/assets/effects/Icon_Attribute_Defense.webp',
		hp: '/assets/effects/Icon_Attribute_Health.webp',
		'hp%': '/assets/effects/Icon_Attribute_Health.webp',
		allDmgBonus: '/assets/elements/flat-white/omni.png',
		skillDmgBonus: '/assets/elements/flat-white/omni.png',
		burstDmgBonus: '/assets/elements/flat-white/omni.png',
		normalDmgBonus: '/assets/elements/flat-white/omni.png',
		chargeDmgBonus: '/assets/elements/flat-white/omni.png',
		plungeDmgBonus: '/assets/elements/flat-white/omni.png',
		pyroDmgBonus: '/assets/elements/flat-white/pyro.png',
		hydroDmgBonus: '/assets/elements/flat-white/hydro.png',
		cryoDmgBonus: '/assets/elements/flat-white/cryo.png',
		electroDmgBonus: '/assets/elements/flat-white/electro.png',
		anemoDmgBonus: '/assets/elements/flat-white/anemo.png',
		geoDmgBonus: '/assets/elements/flat-white/geo.png',
		dendroDmgBonus: '/assets/elements/flat-white/dendro.png',
		lunarDmgBonus: '/assets/elements/flat-white/lunar.png',
		lunarChargedDmgBonus: '/assets/elements/flat-white/lunar.png',
		lunarBloomDmgBonus: '/assets/elements/flat-white/lunar.png',
		lunarCrystallizeDmgBonus: '/assets/elements/flat-white/lunar.png',
		lunarCrystallizeFlatDmg: '/assets/elements/flat-white/lunar.png',
		anemoRes: '/assets/elements/flat-white/anemo.png',
		cryoRes: '/assets/elements/flat-white/cryo.png',
		dendroRes: '/assets/elements/flat-white/dendro.png',
		electroRes: '/assets/elements/flat-white/electro.png',
		geoRes: '/assets/elements/flat-white/geo.png',
		hydroRes: '/assets/elements/flat-white/hydro.png',
		pyroRes: '/assets/elements/flat-white/pyro.png',
		physicalRes: '/assets/elements/flat-white/omni.png',
		allElementalRes: '/assets/elements/flat-white/omni.png',
		anemoCritDmg: '/assets/elements/flat-white/anemo.png',
		cryoCritDmg: '/assets/elements/flat-white/cryo.png',
		dendroCritDmg: '/assets/elements/flat-white/dendro.png',
		electroCritDmg: '/assets/elements/flat-white/electro.png',
		geoCritDmg: '/assets/elements/flat-white/geo.png',
		hydroCritDmg: '/assets/elements/flat-white/hydro.png',
		pyroCritDmg: '/assets/elements/flat-white/pyro.png'
	};

	const BUFF_STAT_LABEL: Partial<Record<Stat, string>> = {
		atk: 'ATK',
		'atk%': 'ATK%',
		baseAtk: 'ATK',
		critRate: 'CRIT Rate',
		critDmg: 'CRIT DMG',
		em: 'Elem. Mastery',
		cdReduction: 'CD Reduction',
		def: 'DEF',
		'def%': 'DEF%',
		hp: 'HP',
		'hp%': 'HP%',
		allDmgBonus: 'DMG Bonus',
		skillDmgBonus: 'Skill DMG',
		burstDmgBonus: 'Burst DMG',
		normalDmgBonus: 'Normal DMG',
		chargeDmgBonus: 'Charged DMG',
		plungeDmgBonus: 'Plunge DMG',
		pyroDmgBonus: 'Pyro DMG',
		hydroDmgBonus: 'Hydro DMG',
		cryoDmgBonus: 'Cryo DMG',
		electroDmgBonus: 'Electro DMG',
		anemoDmgBonus: 'Anemo DMG',
		geoDmgBonus: 'Geo DMG',
		dendroDmgBonus: 'Dendro DMG',
		lunarDmgBonus: 'Lunar DMG',
		lunarChargedDmgBonus: 'Lunar-Charged DMG',
		lunarBloomDmgBonus: 'Lunar-Bloom DMG',
		lunarCrystallizeDmgBonus: 'Lunar-Crystallize DMG',
		lunarCrystallizeFlatDmg: 'Lunar-Crystallize Flat DMG',
		anemoRes: 'Anemo RES',
		cryoRes: 'Cryo RES',
		dendroRes: 'Dendro RES',
		electroRes: 'Electro RES',
		geoRes: 'Geo RES',
		hydroRes: 'Hydro RES',
		pyroRes: 'Pyro RES',
		physicalRes: 'Physical RES',
		allElementalRes: 'All Elemental RES',
		anemoCritDmg: 'Anemo CRIT DMG',
		cryoCritDmg: 'Cryo CRIT DMG',
		dendroCritDmg: 'Dendro CRIT DMG',
		electroCritDmg: 'Electro CRIT DMG',
		geoCritDmg: 'Geo CRIT DMG',
		hydroCritDmg: 'Hydro CRIT DMG',
		pyroCritDmg: 'Pyro CRIT DMG'
	};

	// Returns a linear-gradient CSS string for ramping buff bars, fading from dim (ramp start)
	// to full opacity (ramp cap). Accounts for segment offset so mid-ramp segments start brighter.
	function rampingBackground(bar: CharReceivedBuffBar): string | undefined {
		const ramp = bar.rampParams;
		if (!ramp || bar.buffStart == null) return undefined;
		const rampDur =
			ramp.cap != null ? ((ramp.cap - ramp.startValue) / ramp.stepValue) * ramp.stepInterval : 10;
		const p0 = Math.min(1, Math.max(0, (bar.start - bar.buffStart) / rampDur));
		const p1 = Math.min(1, Math.max(0, (bar.end - bar.buffStart) / rampDur));
		const o0 = (0.2 + p0 * 0.8).toFixed(2);
		const o1 = (0.2 + p1 * 0.8).toFixed(2);
		return `linear-gradient(to right, rgba(28,50,84,${o0}), rgba(28,50,84,${o1}))`;
	}

	// Returns a linear-gradient CSS string for decaying buff bars, fading from full
	// opacity (decay start) to dim (decay end). Mirrors rampingBackground in reverse.
	// Decay duration equals the host effect's buff duration.
	function decayingBackground(bar: CharReceivedBuffBar): string | undefined {
		const decay = bar.decayParams;
		if (!decay || bar.buffStart == null || decay.duration <= 0) return undefined;
		const p0 = Math.min(1, Math.max(0, (bar.start - bar.buffStart) / decay.duration));
		const p1 = Math.min(1, Math.max(0, (bar.end - bar.buffStart) / decay.duration));
		const o0 = (1.0 - p0 * 0.8).toFixed(2);
		const o1 = (1.0 - p1 * 0.8).toFixed(2);
		return `linear-gradient(to right, rgba(28,50,84,${o0}), rgba(28,50,84,${o1}))`;
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

	let rotation = $derived.by(() => {
		try {
			return parseNotation(
				notation,
				resolveCharacter,
				swapFrames,
				$constellations,
				effectiveLoadout
			);
		} catch (e) {
			console.error('parseNotation threw:', e);
			return {
				tracks: [],
				totalDuration: 0,
				unknownTokens: [],
				weaponProcBars: new Map(),
				reactionEvents: [],
				hitEvents: [],
				shieldEndEvents: []
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
	// NB (Nightsoul Burst) event computation
	// ---------------------------------------------------------------------------

	/** Catalyst character IDs in the current team — their activeStart also triggers NB. */
	let nbCatalystIds = $derived(
		new SvelteSet(slotCharacters.filter((c) => c?.weapon === 'catalyst').map((c) => c!.id))
	);

	/**
	 * Computes NB fire events from the rotation.
	 * Triggered by any E/Q cast or by a catalyst character entering the field.
	 * Cooldown: 18s (1 Natlan unit), 12s (2), 9s (3–4).
	 */
	function computeNBBars(
		tracks: CharacterTrack[],
		catalystIds: Set<string>,
		natlanCount: number
	): Array<{ start: number; cooldown: number }> {
		if (natlanCount === 0) return [];
		const cd = natlanCount >= 3 ? 9 : natlanCount === 2 ? 12 : 18;

		const events: number[] = [];
		for (const track of tracks) {
			for (const bar of track.eBars) events.push(bar.start);
			for (const bar of track.qBars) events.push(bar.start);
			if (catalystIds.has(track.characterId)) {
				for (const block of track.inputBlocks) {
					if (block.kind !== 'movement' && block.kind !== 'unset') events.push(block.start);
				}
			}
		}
		events.sort((a, b) => a - b);

		const result: Array<{ start: number; cooldown: number }> = [];
		let nextAllowed = -Infinity;
		for (const t of events) {
			if (t >= nextAllowed) {
				result.push({ start: t, cooldown: cd });
				nextAllowed = t + cd;
			}
		}
		return result;
	}

	let nbBars = $derived(computeNBBars(rotation.tracks, nbCatalystIds, teamComp.natlanCount));

	let effectiveLoadout = $derived.by(() => {
		const allIds = new Set([...Object.keys($loadout), ...Object.keys(tabLoadout)]);
		const result: Record<string, LoadoutEntry> = {};
		for (const charId of allIds) {
			result[charId] = { ...($loadout[charId] ?? {}), ...(tabLoadout[charId] ?? {}) };
		}
		return result;
	});

	let teamFactionCounts = $derived.by(() => {
		const m = new SvelteMap<string, number>();
		for (const c of slotCharacters) {
			if (!c) continue;
			for (const f of c.factions ?? []) {
				m.set(f, (m.get(f) ?? 0) + 1);
			}
		}
		return m;
	});

	/** Per-holder element-count maps for `teamElementCount` Condition
	 *  resolution. For each char in the team, builds a `Map<Element, number>`
	 *  counting OTHER team members of each element. Used as
	 *  `ConditionContext.teamElementCounts` keyed by the current holder. */
	let teamElementCountsByHolder = $derived.by(() => {
		const result = new SvelteMap<string, Map<import('$lib/types/ability').Element, number>>();
		const chars = slotCharacters.filter((c): c is CharacterData => c != null);
		for (const holder of chars) {
			const counts = new SvelteMap<import('$lib/types/ability').Element, number>();
			for (const other of chars) {
				if (other.id === holder.id) continue;
				if (!other.element) continue;
				counts.set(other.element, (counts.get(other.element) ?? 0) + 1);
			}
			result.set(holder.id, counts);
		}
		return result;
	});

	let teamBuffRows = $derived(
		computeTeamBuffRows(
			rotation.tracks,
			$constellations,
			effectiveLoadout,
			teamFactionCounts,
			teamElementCountsByHolder,
			nbBars,
			rotation.reactionEvents,
			getLoadedCharacter
		)
	);

	let weaponProcRows = $derived(computeWeaponProcRows(rotation.weaponProcBars, effectiveLoadout));

	// Per-character received weapon buff bars (TTDS, Widsith, etc.) — see
	// src/lib/timeline/charReceivedBuffRows.ts; thin reactive wrapper only.
	let charReceivedBuffRows = $derived.by(() =>
		computeCharReceivedBuffRows(
			rotation.tracks,
			$constellations,
			effectiveLoadout,
			teamFactionCounts,
			teamElementCountsByHolder,
			nbBars,
			getLoadedCharacter
		)
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
		computeSummonSubrows(annotatedTracks, $constellations, getLoadedCharacter)
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
	//   0 summon + 2 buffs  → 4 reserved → buff reserves 4 (slot at baseline)
	//   1 summon + 0 buffs  → 4 reserved → buff reserves 3 (slot at baseline)
	//   1 summon + 4 buffs  → 5 reserved → buff reserves 4 (slot grows by stride)
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
			? computeMoonsignRows(rotation.tracks, teamComp.nonMoonsignSlots, characterSlots)
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
		for (const track of rotation.tracks) {
			for (const bar of track.eBars) {
				max = Math.max(max, bar.start + bar.cooldown);
				if (bar.uptime > 0)
					max = Math.max(max, bar.start + (bar.summonActivatesAt ?? 0) / 60 + bar.uptime);
			}
			for (const bar of track.qBars) {
				max = Math.max(max, bar.start + bar.cooldown);
				if (bar.uptime > 0)
					max = Math.max(max, bar.start + (bar.summonActivatesAt ?? 0) / 60 + bar.uptime);
			}
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

	function rulerTicks(dur: number, sc: number): Array<{ t: number; x: number; major: boolean }> {
		if (!isFinite(dur) || dur <= 0) return [];
		const step = sc >= 50 ? 1 : sc >= 25 ? 2 : 5;
		const ticks = [];
		for (let t = 0; t <= dur; t += step) {
			ticks.push({ t, x: Math.round(t * sc), major: t % 5 === 0 });
		}
		return ticks;
	}

	let ticks = $derived(rulerTicks(totalDuration, scale));
	let majorTicks = $derived(ticks.filter((t) => t.major));

	// ---------------------------------------------------------------------------
	// Geometry helpers
	// ---------------------------------------------------------------------------

	/** THE time→x mapping. Every horizontal position — DOM bars and the SVG
	 *  overlay layers alike — derives from this one helper, so the two
	 *  rendering worlds can never drift. (Also the substrate for the future
	 *  data→SVG→PNG export path.) */
	function xForTime(t: number): number {
		return Math.round(t * scale);
	}

	// Width is the DIFFERENCE of rounded endpoints (not a rounded span) so
	// adjacent segments telescope pixel-perfectly at every zoom — a rounded
	// span drifts ±1px against its neighbours whenever scale isn't a clean
	// multiple of the frame grid.
	function barGeom(start: number, span: number): { left: number; width: number } {
		const left = xForTime(start);
		return {
			left,
			width: Math.max(xForTime(start + span) - left, 2)
		};
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
		// Align with the inset active bar (top: 1px, height: calc(100% - 2px))
		const yTop = RULER_H + slotTopOffsets[topSlot] + activeRowOffsetForSlot(topSlot) + 1;
		const yBottom =
			RULER_H + slotTopOffsets[bottomSlot] + activeRowOffsetForSlot(bottomSlot) + ACTIVE_ROW_H - 1;
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
					displayName: char?.displayName ?? null,
					element: char?.element,
					consLevel: char ? ($constellations[char.id] ?? 0) : 0,
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

	/** Instance method for the page's PNG control (tab strip, next to Share). */
	export async function exportPng(
		mode: 'copy' | 'download'
	): Promise<'copied' | 'downloaded' | 'failed'> {
		try {
			const blob = await renderTimelinePng(buildSnapshot());
			return await deliverPng(blob, 'critcalc-rotation.png', mode);
		} catch (e) {
			console.error('PNG export failed:', e);
			return 'failed';
		}
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
	// ---------------------------------------------------------------------------
	// Avatar fallback state (per slot)
	// ---------------------------------------------------------------------------

	let avatarFallbacks = $state([false, false, false, false]);

	$effect(() => {
		characterSlots.join(','); // track any slot change
		avatarFallbacks = [false, false, false, false];
	});

	function handleAvatarError(slotIdx: number, slotId: string, event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(slotId, 'side', $siteSettings.travelerVariant);
		} else {
			avatarFallbacks[slotIdx] = true;
		}
	}

	function initials(name: string): string {
		return name.slice(0, 2).toUpperCase();
	}

	// ---------------------------------------------------------------------------
	// Constellation popover
	// ---------------------------------------------------------------------------

	// ---------------------------------------------------------------------------
	// Loadout helpers
	// ---------------------------------------------------------------------------

	const artifactItems: DropdownItem[] = getAllArtifactSets().map((a) => ({
		id: a.id,
		label: a.shortName ?? a.name,
		iconSrc: artifactImagePath(a.id)
	}));

	function effectiveLoadoutEntry(charId: string): LoadoutEntry {
		return { ...($loadout[charId] ?? {}), ...(tabLoadout[charId] ?? {}) };
	}

	function weaponItemsForType(weaponType: string): DropdownItem[] {
		return getWeaponsByType(weaponType as import('$lib/types/weapon').WeaponType).map((w) => ({
			id: w.id,
			label: w.shortName ?? w.name,
			iconSrc: weaponImagePath(w.id)
		}));
	}

	let popoverSlot = $state<number | null>(null);
	let popoverX = $state(0);
	let popoverY = $state(0);

	function openConstellation(e: MouseEvent, i: number) {
		e.stopPropagation();
		refPopoverSlot = null;
		if (popoverSlot === i) {
			popoverSlot = null;
			return;
		}
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		popoverX = rect.right + 8;
		popoverY = rect.top + rect.height / 2;
		popoverSlot = i;
	}

	function setConstellation(characterId: string, level: number) {
		constellations.setLevel(characterId, level);
		popoverSlot = null;
	}

	let refPopoverSlot = $state<number | null>(null);
	let refPopoverX = $state(0);
	let refPopoverY = $state(0);

	function openRefinement(e: MouseEvent, i: number) {
		e.stopPropagation();
		popoverSlot = null;
		if (refPopoverSlot === i) {
			refPopoverSlot = null;
			return;
		}
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		refPopoverX = rect.right + 8;
		refPopoverY = rect.top + rect.height / 2;
		refPopoverSlot = i;
	}

	function setRefinement(charId: string, r: 1 | 2 | 3 | 4 | 5) {
		onTabLoadoutChange?.(charId, { weaponRefinement: r });
		refPopoverSlot = null;
	}

	// ---------------------------------------------------------------------------
	// Caveat panel
	// ---------------------------------------------------------------------------

	let showCaveats = $state(false);

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
					.map((a) => ({ name: a.name, caveat: a.caveat! }))
			}))
			.filter((entry) => entry.caveats.length > 0);
	});

	let hasCaveats = $derived(slotCaveats.length > 0);

	$effect(() => {
		if (!hasCaveats) showCaveats = false;
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
	<!-- ── Notation editor (CodeMirror) ─────────────────────── -->
	<div class="rp-notation-wrap">
		<div class="rp-notation" use:mountEditor={notation}></div>
		<!-- Edit affordance: quiet pencil in the field's corner, gone on focus -->
		<svg
			class="rp-edit-glyph"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M12 20h9" />
			<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
		</svg>
	</div>
	<!-- ── Controls + unrecognised tokens ───────────────────── -->
	<div class="rp-controls">
		<!-- Left: unrecognised token warnings (hidden when none) -->
		<div class="rp-controls-warnings">
			{#if rotation.unknownTokens.length > 0}
				{@const dedupedUnknowns = [...new SvelteSet(rotation.unknownTokens)]}
				<span class="rp-unknown-label">Unrecognised:</span>
				{#each dedupedUnknowns as tok (tok)}
					<span class="rp-unknown-chip">{tok}</span>
				{/each}
			{/if}
		</div>

		<!-- Right: rotation length readout + notes. Zoom rides the ruler now;
		     swap ping lives in the chrome settings overlay. -->
		<div class="rp-controls-sliders">
			{#if rotation.totalDuration > 0}
				<span class="rp-controls-label">Total</span>
				<span class="rp-controls-value rp-controls-total"
					>{Math.round(rotation.totalDuration * 10) / 10}s</span
				>
				<span class="rp-controls-divider">|</span>
			{/if}
			<button
				class="rp-zoom-btn rp-notes-btn"
				class:rp-notes-btn--active={showCaveats}
				type="button"
				aria-label="Toggle notes panel"
				disabled={!hasCaveats}
				onclick={() => (showCaveats = !showCaveats)}
				>NOTES{#if hasCaveats}<span class="rp-notes-badge">!</span>{/if}</button
			>
		</div>
	</div>

	<!-- ── Timeline chart frame ──────────────────────────────── -->
	<div class="rp-frame vz-anim-frame">
		<div class="rp-timeline-area">
			<div class="rp-scroll-wrapper">
				<!-- Left label column (sticky, non-scrolling) -->
				<div class="rp-label-col" style:width="{LABEL_W}px">
					<!-- Ruler spacer -->
					<div class="rp-label-spacer" style:height="{RULER_H}px"></div>

					<!-- Character slot labels (always 4) -->
					{#each characterSlots as slotId, i (i)}
						{@const char = slotCharacters[i]}
						{@const p = pal(char?.element)}
						{@const cLevel = char ? ($constellations[char.id] ?? 0) : 0}
						{@const entry = char ? effectiveLoadoutEntry(char.id) : null}
						<div class="rp-label-cell char-label" style:height="{slotBlockH(i)}px">
							<!-- Three zones: identity header (glyph + name + constellation) on
							     top, the portrait centered alone in the middle space, loadouts
							     grounded at the base. Empty slots keep the full card language:
							     blank portrait, "Empty", disabled chips. -->
							<!-- Name row: element glyph + name ranged left, constellation
							     selector ranged right. -->
							<div class="rp-id-row">
								<span class="rp-id-name">
									{#if char?.element}
										<img
											class="rp-el-badge"
											src="/assets/elements/flat-color/{char.element}.png"
											alt={char.element}
										/>
									{/if}
									<span class="rp-char-name" class:rp-char-name--empty={!char}
										>{char?.displayName ?? 'Empty'}</span
									>
								</span>
								<button
									class="rp-cons-chip"
									class:rp-cons-chip--set={cLevel > 0}
									style:--el={p.main}
									disabled={!char}
									onclick={(e) => char && openConstellation(e, i)}
									aria-label={char
										? `Set constellation for ${char.displayName}`
										: 'Constellation (empty slot)'}>C{cLevel}</button
								>
							</div>
							<div class="rp-portrait-area">
								<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
								<div
									class="rp-avatar-chip"
									class:rp-avatar-clickable={!!onOpenSelector}
									style:--el={p.main}
									onclick={onOpenSelector}
									role={onOpenSelector ? 'button' : undefined}
									tabindex={onOpenSelector ? 0 : undefined}
									aria-label={onOpenSelector ? 'Open character selector' : undefined}
								>
									<span class="rp-avatar-clip">
										{#if !avatarFallbacks[i]}
											<img
												class="rp-avatar-img"
												src={getAvatar(
													slotId,
													$siteSettings.useNewOutfits,
													'side',
													$siteSettings.travelerVariant
												)}
												alt={char?.displayName ?? 'Empty slot'}
												onerror={(e) => handleAvatarError(i, slotId, e)}
											/>
										{:else}
											<span class="rp-avatar-initials">{initials(char?.displayName ?? slotId)}</span
											>
										{/if}
									</span>
								</div>
							</div>
							<div class="rp-loadout-rows">
								<LoadoutDropdown
									items={artifactItems}
									selected={entry?.artifactSetId}
									placeholder="Artifact"
									disabled={!char}
									onSelect={(id) => char && onTabLoadoutChange?.(char.id, { artifactSetId: id })}
								/>
								<div class="rp-weapon-group">
									<div class="rp-weapon-dd">
										<LoadoutDropdown
											items={char ? weaponItemsForType(char.weapon ?? '') : []}
											selected={entry?.weaponId}
											placeholder="Weapon"
											disabled={!char || char.weapon === 'polearm'}
											title={char?.weapon === 'polearm'
												? 'No polearm-type weapons available'
												: undefined}
											onSelect={(id) =>
												char &&
												onTabLoadoutChange?.(char.id, {
													weaponId: id,
													weaponRefinement: entry?.weaponRefinement ?? 1
												})}
										/>
									</div>
									{#if entry?.weaponId}
										<button
											class="rp-ref-badge"
											onclick={(e) => openRefinement(e, i)}
											aria-label="Set refinement for weapon">R{entry.weaponRefinement ?? 1}</button
										>
									{/if}
								</div>
							</div>
						</div>
					{/each}

					<!-- Team buffs label -->
					<div class="rp-label-cell" style:height="{teamBuffsH}px">
						<span class="rp-label-text">TEAM BUFFS</span>
					</div>

					<!-- NB lane label -->
					{#if teamComp.natlanCount >= 1}
						<div class="rp-label-cell" style:height="{nbLaneH}px">
							<span class="rp-label-text">NIGHTSOUL</span>
						</div>
					{/if}

					<!-- Moonsign lane label -->
					{#if teamComp.hasAscendantGleam}
						<div class="rp-label-cell" style:height="{moonsignLaneH}px">
							<span class="rp-label-text">MOONSIGN</span>
						</div>
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
							<div class="rp-gridline" style:left="{tick.x}px" style:top="{RULER_H}px"></div>
						{/each}

						<!-- Ruler -->
						<div class="rp-ruler" style:height="{RULER_H}px">
							{#each ticks as tick (tick.t)}
								<div class="rp-tick" class:major={tick.major} style:left="{tick.x}px">
									{#if tick.major && tick.t > 0}
										<span class="rp-tick-label">{tick.t}s</span>
									{/if}
								</div>
							{/each}
						</div>

						<!-- Character slot tracks (always 4 rows) -->
						{#each slotCharacters as char, slotIdx (slotIdx)}
							{@const p = pal(char?.element)}
							{@const slotTracks = tracksBySlot[slotIdx]}

							<div
								class="rp-char-block"
								style:height="{slotBlockH(slotIdx)}px"
								style:--bar-hi={p.hi}
							>
								<!-- E row -->
								<div class="rp-row" style:top="{CHAR_PAD_TOP}px" style:height="{E_ROW_H}px">
									{#each slotTracks as track, ti (`${slotIdx}_${ti}`)}
										{#each track.eBars as bar, barIdx (barIdx)}
											{@const eFieldOffset = (bar.summonActivatesAt ?? 0) / 60}
											{@const eFieldStart = bar.start + eFieldOffset}
											{@const eHasSummon = !!findCastSummon(char, 'skill', bar.label)}
											{#if bar.sacProcFired}
												<!-- Sac proc: bar spans duration only (CD reset to 0), dim
										     continuation tone. Opaque mix, never alpha — connectors
										     pass behind these bars. -->
												{@const span = bar.uptime > 0 ? bar.uptime : bar.castTime}
												{@const start = bar.uptime > 0 ? eFieldStart : bar.start}
												{@const g = barGeom(start, span)}
												<div
													class="rp-bar-uptime"
													style:left="{g.left}px"
													style:width="{g.width}px"
													style:background="color-mix(in srgb, {p.main} 65%, var(--rp-chart-bg))"
													style:border-radius="1px"
												>
													<span class="rp-bar-row-badge">E</span>
												</div>
											{:else if bar.uptime > 0 && !eHasSummon}
												<!-- Stance ability: caster-state window with optional CD overflow.
										     Phase 2 retains this two-case layout for Hu Tao E, Cyno Q, etc. -->
												{#if bar.cooldown >= eFieldOffset + bar.uptime}
													<!-- Case A: cooldown outlasts stance window -->
													{@const u = barGeom(eFieldStart, bar.uptime)}
													<div
														class="rp-bar-uptime"
														style:left="{u.left}px"
														style:width="{u.width}px"
														style:background={castFill(p.main)}
														style:border-radius="1px"
													>
														<span class="rp-bar-row-badge">E</span>
													</div>
													{@const cdSpan = bar.cooldown - eFieldOffset - bar.uptime}
													{#if cdSpan > 0}
														{@const cd = barGeom(eFieldStart + bar.uptime, cdSpan)}
														<div
															class="rp-bar-cd rp-bar-cd--ghost"
															style:left="{cd.left}px"
															style:width="{cd.width}px"
															style:background="color-mix(in srgb, {p.main} 20%, var(--rp-chart-bg))"
															style:border-right-color="color-mix(in srgb, {p.main} 45%, var(--rp-chart-bg))"
														>
															{#if cd.width > 32}
																<span class="rp-bar-cd-label"
																	>{Math.round(bar.cooldown * 10) / 10}s</span
																>
															{/if}
														</div>
													{/if}
												{:else}
													<!-- Case B: stance window outlasts cooldown -->
													{@const ph1 = barGeom(eFieldStart, bar.cooldown - eFieldOffset)}
													<div
														class="rp-bar-uptime"
														style:left="{ph1.left}px"
														style:width="{ph1.width}px"
														style:background={castFill(p.main)}
													>
														<span class="rp-bar-row-badge">E</span>
													</div>
													{@const ph2 = barGeom(
														bar.start + bar.cooldown,
														eFieldOffset + bar.uptime - bar.cooldown
													)}
													{#if ph2.width > 0}
														<div
															class="rp-bar-cd rp-bar-cd--overflow"
															style:left="{ph2.left}px"
															style:width="{ph2.width}px"
															style:background="color-mix(in srgb, {p.main} 65%, var(--rp-chart-bg))"
														></div>
													{/if}
												{/if}
											{:else}
												<!-- Single-phase: cast time + ghost CD remainder.
										     Covers instant abilities AND summon-bearing abilities
										     (whose lifetime now lives on the dedicated summon lane). -->
												{@const cast = barGeom(bar.start, bar.castTime)}
												<div
													class="rp-bar-uptime"
													style:left="{cast.left}px"
													style:width="{cast.width}px"
													style:background={castFill(p.main)}
													style:border-radius="1px"
												>
													<span class="rp-bar-row-badge">E</span>
												</div>
												{@const cdSpan = bar.cooldown - bar.castTime}
												{#if cdSpan > 0}
													{@const cd = barGeom(bar.start + bar.castTime, cdSpan)}
													<div
														class="rp-bar-cd rp-bar-cd--ghost"
														style:left="{cd.left}px"
														style:width="{cd.width}px"
														style:background="color-mix(in srgb, {p.main} 20%, var(--rp-chart-bg))"
														style:border-right-color="color-mix(in srgb, {p.main} 45%, var(--rp-chart-bg))"
													>
														{#if cd.width > 32}
															<span class="rp-bar-cd-label"
																>{Math.round(bar.cooldown * 10) / 10}s</span
															>
														{/if}
													</div>
												{/if}
											{/if}
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
												<!-- Opaque mix (not alpha) — swap connectors pass behind
											     this lane and must not show through. -->
												<div
													class="rp-summon-bar"
													style:left="{g.left}px"
													style:width="{g.width}px"
													style:background="color-mix(in srgb, {p.main} 60%, var(--rp-chart-bg))"
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
											{@const qFieldOffset = (bar.summonActivatesAt ?? 0) / 60}
											{@const qFieldStart = bar.start + qFieldOffset}
											{@const qHasSummon = !!findCastSummon(char, 'burst', bar.label)}
											{#if bar.uptime > 0 && !qHasSummon}
												<!-- Stance burst: caster-state window (e.g. Cyno Q, Raiden Q).
										     Retains the two-case layout. -->
												{#if bar.cooldown >= qFieldOffset + bar.uptime}
													<!-- Case A: cooldown outlasts stance window -->
													{@const u = barGeom(qFieldStart, bar.uptime)}
													<div
														class="rp-bar-uptime"
														style:left="{u.left}px"
														style:width="{u.width}px"
														style:background={castFill(p.main)}
														style:border-radius="1px"
													>
														<span class="rp-bar-row-badge">Q</span>
													</div>
													{@const cdSpan = bar.cooldown - qFieldOffset - bar.uptime}
													{#if cdSpan > 0}
														{@const cd = barGeom(qFieldStart + bar.uptime, cdSpan)}
														<div
															class="rp-bar-cd rp-bar-cd--ghost"
															style:left="{cd.left}px"
															style:width="{cd.width}px"
															style:background="color-mix(in srgb, {p.main} 20%, var(--rp-chart-bg))"
															style:border-right-color="color-mix(in srgb, {p.main} 45%, var(--rp-chart-bg))"
														>
															{#if cd.width > 32}
																<span class="rp-bar-cd-label"
																	>{Math.round(bar.cooldown * 10) / 10}s</span
																>
															{/if}
														</div>
													{/if}
												{:else}
													<!-- Case B: stance window outlasts cooldown -->
													{@const ph1 = barGeom(qFieldStart, bar.cooldown - qFieldOffset)}
													<div
														class="rp-bar-uptime"
														style:left="{ph1.left}px"
														style:width="{ph1.width}px"
														style:background={castFill(p.main)}
													>
														<span class="rp-bar-row-badge">Q</span>
													</div>
													{@const ph2 = barGeom(
														bar.start + bar.cooldown,
														qFieldOffset + bar.uptime - bar.cooldown
													)}
													{#if ph2.width > 0}
														<div
															class="rp-bar-cd rp-bar-cd--overflow"
															style:left="{ph2.left}px"
															style:width="{ph2.width}px"
															style:background="color-mix(in srgb, {p.main} 65%, var(--rp-chart-bg))"
														></div>
													{/if}
												{/if}
											{:else}
												<!-- Single-phase: cast time + ghost CD remainder.
										     Covers instant bursts AND summon-bearing bursts. -->
												{@const cast = barGeom(bar.start, bar.castTime)}
												<div
													class="rp-bar-uptime"
													style:left="{cast.left}px"
													style:width="{cast.width}px"
													style:background={castFill(p.main)}
													style:border-radius="1px"
												>
													<span class="rp-bar-row-badge">Q</span>
												</div>
												{@const cdSpan = bar.cooldown - bar.castTime}
												{#if cdSpan > 0}
													{@const cd = barGeom(bar.start + bar.castTime, cdSpan)}
													<div
														class="rp-bar-cd rp-bar-cd--ghost"
														style:left="{cd.left}px"
														style:width="{cd.width}px"
														style:background="color-mix(in srgb, {p.main} 20%, var(--rp-chart-bg))"
														style:border-right-color="color-mix(in srgb, {p.main} 45%, var(--rp-chart-bg))"
													>
														{#if cd.width > 32}
															<span class="rp-bar-cd-label"
																>{Math.round(bar.cooldown * 10) / 10}s</span
															>
														{/if}
													</div>
												{/if}
											{/if}
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

						<!-- Team buffs row -->
						<div class="rp-team-buffs" style:height="{teamBuffsH}px">
							{#if teamBuffRows.length === 0}
								<span class="rp-team-buffs-empty"
									>team buffs — add curated characters to see results</span
								>
							{:else}
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
										<div class="rp-moonsign-subrow">
											{#each row.windows as win, wi (wi)}
												{@const g = barGeom(win.start, win.duration)}
												<div
													class="rp-moonsign-bar"
													style:left="{g.left}px"
													style:width="{g.width}px"
												></div>
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

				<!-- Zoom rides the ruler's right end (DAW convention), fading in
				     over the scrolling tick strip. -->
				<div class="rp-zoom-inline" style:height="{RULER_H}px">
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
				</div>
			</div>
			<!-- /rp-scroll-wrapper -->

			{#if showCaveats && hasCaveats}
				<div class="rp-caveat-panel">
					{#each slotCaveats as entry (entry.id)}
						<div class="rp-caveat-char">
							<div class="rp-caveat-char-name" style:color={pal(entry.element).main}>
								{entry.displayName}
							</div>
							{#each entry.caveats as item, ci (ci)}
								<div class="rp-caveat-item">
									<span class="rp-caveat-ability">{item.name}</span>
									<p class="rp-caveat-text">{item.caveat}</p>
								</div>
							{/each}
						</div>
					{/each}
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
	</div>
	<!-- /rp-frame -->

	<!-- ── Constellation + refinement popovers ───────────────── -->
	{#if popoverSlot !== null || refPopoverSlot !== null}
		<div
			class="rp-popover-backdrop"
			role="button"
			tabindex="-1"
			aria-label="Close picker"
			onclick={() => {
				popoverSlot = null;
				refPopoverSlot = null;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					popoverSlot = null;
					refPopoverSlot = null;
				}
			}}
		></div>
	{/if}
	{#if popoverSlot !== null}
		{@const pchar = slotCharacters[popoverSlot]}
		{@const pp = pal(pchar?.element)}
		{@const currentLevel = pchar ? ($constellations[pchar.id] ?? 0) : 0}
		<div class="rp-constellation-popover" style:left="{popoverX}px" style:top="{popoverY}px">
			{#each [0, 1, 2, 3, 4, 5, 6] as level (level)}
				<button
					class="rp-pip"
					class:rp-pip--filled={level > 0 && level <= currentLevel}
					class:rp-pip--current={level === currentLevel}
					style:--pip-color={pp.main}
					onclick={() => pchar && setConstellation(pchar.id, level)}>{level}</button
				>
			{/each}
		</div>
	{/if}
	{#if refPopoverSlot !== null}
		{@const rchar = slotCharacters[refPopoverSlot]}
		{@const rp = pal(rchar?.element)}
		{@const rEntry = rchar ? effectiveLoadoutEntry(rchar.id) : null}
		{@const currentRef = rEntry?.weaponRefinement ?? 1}
		<div class="rp-constellation-popover" style:left="{refPopoverX}px" style:top="{refPopoverY}px">
			{#each [1, 2, 3, 4, 5] as r (r)}
				<button
					class="rp-pip"
					class:rp-pip--filled={r <= currentRef}
					class:rp-pip--current={r === currentRef}
					style:--pip-color={rp.main}
					onclick={() => rchar && setRefinement(rchar.id, r as 1 | 2 | 3 | 4 | 5)}>R{r}</button
				>
			{/each}
		</div>
	{/if}

	<!-- ── Buff tooltip ────────────────────────────────────────── -->
	{#if tooltip}
		<div
			class="rp-tooltip"
			class:rp-tooltip--above={tooltip.above}
			style:left="{tooltip.x}px"
			style:top="{tooltip.y}px"
		>
			<div class="rp-tooltip-source">{tooltip.sourceLabel}</div>
			{#if tooltip.isMutuallyExclusive}
				<div class="rp-tooltip-mutual">one of:</div>
			{/if}
			{#each tooltip.effects as fx (fx.stat)}
				<div class="rp-tooltip-row">
					{#if BUFF_STAT_ICON[fx.stat]}
						<img src={BUFF_STAT_ICON[fx.stat]} alt="" class="rp-tooltip-icon" />
					{/if}
					<span class="rp-tooltip-stat">{BUFF_STAT_LABEL[fx.stat] ?? fx.stat}</span>
					<span class="rp-tooltip-value">{fx.displayValue}</span>
				</div>
			{/each}
			{#if tooltip.duration != null || tooltip.procCooldown != null}
				<div class="rp-tooltip-footer">
					{#if tooltip.duration != null}{tooltip.duration}s{/if}
					{#if tooltip.duration != null && tooltip.procCooldown != null}
						·
					{/if}
					{#if tooltip.procCooldown != null}CD {tooltip.procCooldown}s{/if}
				</div>
			{/if}
		</div>
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

		font-family: var(--font-mono);
		font-size: 0.75rem;
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

	/* ── Controls ─────────────────────────────────────────────── */
	.rp-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		color: var(--muted);
		min-height: 26px;
	}
	.rp-controls-warnings {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
		font-size: 0.7rem;
		min-width: 0;
	}
	.rp-controls-sliders {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}
	.rp-controls-label {
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.rp-controls-value {
		font-size: 0.625rem;
		min-width: 48px;
	}
	.rp-controls-divider {
		opacity: 0.2;
		margin: 0 4px;
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
		font-size: 0.75rem;
		line-height: 1;
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
		display: flex;
		flex-direction: row;
		align-items: stretch;
	}

	/* ── Caveat panel ─────────────────────────────────────────── */
	.rp-caveat-panel {
		width: 240px;
		flex-shrink: 0;
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
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.rp-caveat-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.rp-caveat-ability {
		font-size: 0.6rem;
		font-weight: 700;
		color: var(--muted);
		letter-spacing: 0.04em;
	}
	.rp-caveat-text {
		margin: 0;
		font-size: 0.6rem;
		color: var(--text);
		line-height: 1.55;
		opacity: 0.75;
	}

	/* ── Notes button ─────────────────────────────────────────── */
	.rp-notes-btn {
		position: relative;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.1em;
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
		font-size: 0.55rem;
		font-weight: 700;
		line-height: 1;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	/* ── Scroll wrapper ───────────────────────────────────────── */
	.rp-scroll-wrapper {
		position: relative;
		display: flex;
		flex: 1;
		min-width: 0;
	}

	/* ── Inline zoom (over the ruler's right end) ─────────────── */
	.rp-zoom-inline {
		position: absolute;
		top: 0;
		right: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 2px 6px 28px;
		/* Fade over the scrolling tick strip so the control stays legible. */
		background: linear-gradient(to right, transparent, var(--rp-chart-bg) 24%);
		z-index: 5;
	}
	.rp-zoom-inline .rp-zoom-slider {
		width: 88px;
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
	.rp-label-text {
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
		text-align: right;
		line-height: 1.4;
	}

	/* ── Character label cell — the roster card ──────────────── */
	/* Three zones: identity header (glyph + name + constellation) across the
	   top, the portrait centered — alone — in the middle space, and the
	   loadout rows grounded at the base. */
	.char-label {
		position: relative;
		flex-direction: column;
		align-items: stretch;
		padding: 8px 10px 10px 8px;
		gap: 8px;
	}
	.rp-portrait-area {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	/* Name row: glyph+name ranged left, constellation selector ranged right. */
	.rp-id-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		min-width: 0;
	}
	.rp-id-name {
		display: flex;
		align-items: center;
		gap: 1px;
		min-width: 0;
	}
	/* Sized as large as the longest roster names allow: single-word names
	   sit on one line; multi-word outliers (Sangonomiya Kokomi, Shikanoin
	   Heizou…) wrap to a second line rather than truncate. */
	.rp-char-name {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text);
		line-height: 1.25;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		max-width: 100%;
		letter-spacing: 0.02em;
	}
	.rp-char-name--empty {
		color: var(--muted);
		font-weight: 500;
		opacity: 0.55;
	}

	/* Constellation selector: rides the name row, ranged right. Resting =
	   quiet dark chip; once a constellation is set it claims the element
	   color + an inset ring — the selected-chip idiom, border earning its
	   place as the investment signal. */
	.rp-cons-chip {
		flex-shrink: 0;
		width: 20px;
		height: 18px;
		display: grid;
		place-items: center;
		background: rgba(255, 255, 255, 0.07);
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: 0.55rem;
		font-weight: 700;
		color: var(--muted);
		letter-spacing: 0.05em;
		border-radius: 3px;
		line-height: 1;
		z-index: 1;
		transition:
			background 150ms ease,
			box-shadow 150ms ease,
			color 150ms ease;
	}
	.rp-cons-chip:hover {
		background: rgba(255, 255, 255, 0.13);
		color: var(--text);
	}
	.rp-cons-chip:disabled {
		opacity: 0.35;
		cursor: default;
		pointer-events: none;
	}
	.rp-cons-chip--set {
		background: color-mix(in srgb, var(--el) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el) 50%, transparent);
		color: color-mix(in srgb, var(--el) 75%, white);
	}
	.rp-cons-chip--set:hover {
		background: color-mix(in srgb, var(--el) 30%, transparent);
	}

	/* ── Loadout rows (artifact + weapon stacked) ────────────── */
	/* 4px gap: the 26px equipment icons overhang their 18px chips by 4px per
	   edge, so this is the minimum that keeps neighbouring icons clear. */
	.rp-loadout-rows {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
	}
	.rp-weapon-group {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 2px;
		width: 100%;
	}
	.rp-weapon-dd {
		flex: 1;
		min-width: 0;
	}
	.rp-ref-badge {
		flex-shrink: 0;
		background: rgba(255, 255, 255, 0.07);
		border: none;
		border-radius: 3px;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		cursor: pointer;
		padding: 3px 4px 2px;
		line-height: 1;
		white-space: nowrap;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.rp-ref-badge:hover {
		background: rgba(255, 255, 255, 0.12);
		color: var(--text);
	}

	/* ── Portrait ─────────────────────────────────────────────── */
	/* Circular — the side-avatar art is cropped to a circle in-game, so the
	   portrait honours that shape. Neutral backing (no element tint on the
	   art); element identity rides on the small glyph badge at the corner,
	   which sits OUTSIDE the clip, so chip = wrapper, clip = inner circle. */
	.rp-avatar-chip {
		position: relative;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.rp-avatar-clip {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #131c30;
		border: 1.5px solid var(--el, #6a7080);
		transition: box-shadow 150ms ease;
	}
	.rp-avatar-clickable {
		cursor: pointer;
	}
	.rp-avatar-clickable:hover .rp-avatar-clip {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--el, #9eacc8) 45%, transparent);
	}

	.rp-avatar-img {
		/* Side avatars are 128×128 with the character positioned toward the
		   center/bottom. Scale up and translate upward within the clipping circle. */
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}

	.rp-avatar-initials {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		color: var(--text);
	}

	/* Element glyph inline with the name, the
	   in-game card language for element identity. */
	.rp-el-badge {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		padding: 1px;
		background: none;
		pointer-events: none;
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

	/* ── Ruler ────────────────────────────────────────────────── */
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
		font-size: 0.625rem;
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
	.rp-team-buffs {
		position: relative;
		border-bottom: 1px solid var(--rp-line);
	}
	.rp-team-buffs-empty {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		padding-left: 8px;
		font-size: 0.625rem;
		color: #3a4e72;
		pointer-events: none;
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
		background: #1d3050;
		border: none;
		border-left: 2px solid #6a96c0;
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
	   buff bar; red tint communicates "applies to enemy" at a glance. */
	.rp-team-buff-bar.rp-team-debuff-bar {
		background: #371c22;
		border-left-color: #c06464;
	}
	.rp-team-buff-bar.rp-team-debuff-bar .rp-buff-label {
		color: #d09098;
	}
	.rp-buff-icon {
		width: 11px;
		height: 11px;
		flex-shrink: 0;
		object-fit: contain;
		opacity: 0.8;
	}
	.rp-buff-label {
		font-size: 0.5625rem;
		color: #90b4d0;
		white-space: nowrap;
		letter-spacing: 0.03em;
		pointer-events: none;
		line-height: 1;
	}

	.rp-weapon-proc-bar {
		position: absolute;
		top: 0;
		height: 100%;
		background: #2b2210;
		border: none;
		border-left: 2px solid rgba(200, 140, 40, 0.6);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
		border-radius: 1px;
		display: flex;
		align-items: center;
		padding: 0 5px;
		overflow: hidden;
		z-index: 1;
		min-width: 2px;
	}
	.rp-weapon-proc-bar .rp-buff-label {
		color: rgba(200, 140, 40, 0.8);
	}

	/* ── NB lane ─────────────────────────────────────────────── */
	/* NB + Moonsign bars are FLAT PLACEHOLDER fills — Nate has specific
	   color concepts for both lanes, queued as a follow-up round after the
	   initial redesign. Don't invest here. */
	.rp-nb-lane {
		position: relative;
		border-bottom: 1px solid var(--rp-line);
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
	.rp-nb-bar {
		position: absolute;
		top: 0;
		height: 100%;
		background: #6b5426;
		border-radius: 1px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		z-index: 1;
		min-width: 2px;
	}
	.rp-nb-bar .rp-bar-cast-label {
		position: absolute;
		left: 5px;
	}

	/* ── Moonsign lane ───────────────────────────────────────── */
	.rp-moonsign-lane {
		position: relative;
		border-bottom: 1px solid var(--rp-line);
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
	.rp-moonsign-bar {
		position: absolute;
		top: 0;
		height: 100%;
		background: #4a4372;
		border: none;
		border-radius: 1px;
		z-index: 1;
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
	.rp-bar-uptime {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
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
	   the cast pill — ending in a brighter notch that marks the exact moment
	   the ability comes back up. Fill + notch colors are opaque mixes set
	   inline per element. */
	.rp-bar-cd--ghost {
		top: 4px;
		height: calc(100% - 8px);
		border: none;
		border-right: 1px solid transparent;
		border-radius: 0 1px 1px 0;
		z-index: 0;
	}
	/* Stance/uptime continuation past the cooldown (Case B): full-height dim
	   tone of the cast bar. Opaque mix, never alpha — connectors pass behind. */
	.rp-bar-cd--overflow {
		top: 1px;
		height: calc(100% - 2px);
		border: none;
		border-radius: 0 1px 1px 0;
		z-index: 2;
	}
	.rp-bar-cast-label {
		font-size: 0.5625rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.85);
		white-space: nowrap;
		pointer-events: none;
		letter-spacing: 0.02em;
		flex-shrink: 0;
	}
	.rp-bar-cd-label {
		font-size: 0.5625rem;
		color: rgba(255, 255, 255, 0.4);
		white-space: nowrap;
		pointer-events: none;
	}

	/* ── Active background strip ─────────────────────────────── */
	/* Summon lane bars — subordinate to E/Q: dimmed via an opaque color-mix
	   toward the chart ground (set inline), NOT opacity — swap connectors
	   pass behind this lane and must not show through. */
	.rp-summon-bar {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		border-radius: 1px;
		z-index: 2;
		min-width: 2px;
		display: flex;
		align-items: center;
		padding: 0 3px;
		overflow: hidden;
	}
	.rp-summon-label {
		font-size: 0.5625rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.9);
		white-space: nowrap;
		pointer-events: none;
		letter-spacing: 0.02em;
	}
	/* Per-tick marker rendered on top of the summon bar (P3 — Summon.effects[]
	   summonTick triggers). 1px-wide vertical line, sits above the bar's
	   opacity-0.65 fill so the marker reads as a brighter notch. */
	.rp-summon-tick {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		width: 1px;
		z-index: 3;
		pointer-events: none;
		transform: translateX(-0.5px);
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
		border-right: 1px solid rgba(8, 18, 37, 0.4);
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
		font-size: 0.625rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.66);
	}

	/* ── E/Q row left-edge badge ──────────────────────────────── */
	.rp-bar-row-badge {
		position: absolute;
		left: 4px;
		font-size: 0.5625rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.66);
		pointer-events: none;
		letter-spacing: 0.02em;
	}

	/* ── Notation box ─────────────────────────────────────────── */
	.rp-notation-wrap {
		display: flex;
		flex-direction: column;
		position: relative;
	}
	/* Quiet "you can edit this" pencil pinned to the field's top-right; the
	   focus ring takes over as the signal once the user is actually in. */
	.rp-edit-glyph {
		position: absolute;
		top: 9px;
		right: 11px;
		width: 13px;
		height: 13px;
		color: var(--muted);
		opacity: 0.45;
		pointer-events: none;
		transition: opacity 150ms ease;
	}
	.rp-notation-wrap:focus-within .rp-edit-glyph {
		opacity: 0;
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
		min-height: 4.5rem;
		padding: 10px 12px;
		background: var(--surface);
		border: none;
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.09),
			inset 0 1px 0 rgba(255, 255, 255, 0.09);
		border-radius: 6px;
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.6;
		color: var(--text);
		white-space: pre;
		overflow: auto;
	}

	/* ── Unknown token warning ───────────────────────────────── */
	.rp-unknown-label {
		color: #d09a3c;
		font-family: var(--font-mono);
	}
	.rp-unknown-chip {
		background: rgba(208, 154, 60, 0.16);
		border: none;
		border-radius: 3px;
		padding: 2px 6px;
		font-family: var(--font-mono);
		color: #d09a3c;
	}

	/* ── Constellation popover ────────────────────────────────── */
	.rp-popover-backdrop {
		position: fixed;
		inset: 0;
		z-index: 49;
	}
	.rp-constellation-popover {
		position: fixed;
		transform: translateY(-50%);
		z-index: 50;
		background: var(--surface-raised);
		border: none;
		border-radius: 6px;
		padding: 7px 9px;
		display: flex;
		align-items: center;
		gap: 4px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 4px 16px rgba(0, 0, 0, 0.5);
	}
	.rp-pip {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.06);
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition:
			background 150ms ease,
			box-shadow 150ms ease,
			color 150ms ease;
	}
	.rp-pip--filled {
		background: color-mix(in srgb, var(--pip-color) 22%, transparent);
		color: var(--pip-color);
	}
	.rp-pip--current {
		background: color-mix(in srgb, var(--pip-color) 30%, transparent);
		box-shadow: inset 0 0 0 1.5px var(--pip-color);
	}
	.rp-pip:hover {
		background: rgba(255, 255, 255, 0.12);
		color: var(--pip-color, var(--text));
	}

	/* ── Buff tooltip ─────────────────────────────────────────── */
	.rp-tooltip {
		position: fixed;
		z-index: 100;
		transform: translateX(-50%);
		background: var(--surface-raised);
		border: none;
		border-radius: 6px;
		padding: 8px 11px;
		pointer-events: none;
		min-width: 120px;
		max-width: 230px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 4px 16px rgba(0, 0, 0, 0.55);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.rp-tooltip--above {
		transform: translateX(-50%) translateY(-100%);
	}
	.rp-tooltip-source {
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		padding-bottom: 4px;
		margin-bottom: 1px;
	}
	.rp-tooltip-mutual {
		font-size: 0.5625rem;
		color: var(--muted);
		font-style: italic;
		letter-spacing: 0.03em;
	}
	.rp-tooltip-row {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.rp-tooltip-icon {
		width: 11px;
		height: 11px;
		flex-shrink: 0;
		object-fit: contain;
		opacity: 0.8;
	}
	.rp-tooltip-stat {
		font-size: 0.625rem;
		color: var(--text);
		flex: 1;
		min-width: 0;
	}
	.rp-tooltip-value {
		font-size: 0.625rem;
		color: #90b4d0;
		font-weight: 600;
		white-space: nowrap;
	}
	.rp-tooltip-footer {
		font-size: 0.5625rem;
		color: var(--muted);
		letter-spacing: 0.03em;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding-top: 3px;
		margin-top: 1px;
	}
</style>
