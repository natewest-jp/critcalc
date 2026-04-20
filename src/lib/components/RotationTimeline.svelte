<script lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { EditorView } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { parseNotation, evalCondition, type ParsedRotation, type TimelineBar } from '$lib/utils/notationParser';
	import type { Stat, EffectTarget, Effect } from '$lib/types/ability';
	import { buildNotationExtensions } from '$lib/utils/notationEditorExtension';
	import { getCharacterById, getCharacterByDisplayName } from '$lib/data/characterLookup';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import { constellations, siteSettings, loadout, type LoadoutEntry } from '$lib/stores';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import type { CharacterTrack } from '$lib/utils/notationParser';
	import { getAllArtifactSets, getArtifactSetById, artifactImagePath } from '$lib/data/artifactLookup';
	import { getWeaponsByType, getWeaponById, weaponImagePath } from '$lib/data/weaponLookup';
	import LoadoutDropdown from '$lib/components/LoadoutDropdown.svelte';
	import type { DropdownItem } from '$lib/components/LoadoutDropdown.svelte';

	type BuffEffect = Extract<Effect, { type: 'buff' }>;

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
	let swapFrames = $state($siteSettings.swapFrames);

	$effect(() => {
		siteSettings.setSwapFrames(swapFrames);
	});

	// ---------------------------------------------------------------------------
	// Layout constants (px)
	// ---------------------------------------------------------------------------

	const LABEL_W = 126;
	const RULER_H = 24;
	const TEAM_BUFFS_H = 36;
	const TEAM_BUFF_SUBROW_H = 18;
	const TEAM_BUFF_PAD = 3;
	const NB_LANE_H = 24;
	const MOONSIGN_LANE_H = 24;
	const CHAR_PAD_TOP = 8;
	const E_ROW_H = 16;
	const Q_ROW_H = 16;
	const ACTIVE_ROW_H = 36;
	const CHAR_BUFF_ROW_H = 16;
	const CHAR_PAD_BOTTOM = 14;
	const ROW_GAP = 4;
	const LOADOUT_ROWS_H = 38; // weapon row (~18px) + gap (2px) + artifact row (~18px)
	const CHAR_BLOCK_H =
		CHAR_PAD_TOP +
		E_ROW_H +
		ROW_GAP +
		Q_ROW_H +
		ROW_GAP +
		ACTIVE_ROW_H +
		ROW_GAP +
		CHAR_BUFF_ROW_H +
		CHAR_PAD_BOTTOM +
		LOADOUT_ROWS_H; // = 156

	const ACTIVE_ROW_OFFSET =
		CHAR_PAD_TOP + E_ROW_H + ROW_GAP + Q_ROW_H + ROW_GAP; // = 48

	// ---------------------------------------------------------------------------
	// Element color palette (includes 'none' for blank/element-less)
	// ---------------------------------------------------------------------------

	type ElementPalette = { main: string; border: string; hi: string };

	const PALETTE: Record<string, ElementPalette> = {
		pyro:    { main: '#e05a4a', border: 'rgba(224,90,74,0.5)',    hi: '#f0ada5' },
		hydro:   { main: '#1472f0', border: 'rgba(20,114,240,0.5)',   hi: '#8ab9f8' },
		anemo:   { main: '#4ecbb4', border: 'rgba(78,203,180,0.5)',   hi: '#a7e5da' },
		electro: { main: '#c070f0', border: 'rgba(192,112,240,0.5)',  hi: '#e0b8f8' },
		cryo:    { main: '#88c8f0', border: 'rgba(136,200,240,0.5)',  hi: '#c4e4f8' },
		geo:     { main: '#d4a040', border: 'rgba(212,160,64,0.5)',   hi: '#ead0a0' },
		dendro:  { main: '#80c840', border: 'rgba(128,200,64,0.5)',   hi: '#c0e4a0' },
		none:    { main: '#6a7080', border: 'rgba(106,112,128,0.5)',  hi: '#b5b8c0' }
	};

	function pal(element: string | undefined): ElementPalette {
		return PALETTE[element ?? 'none'] ?? PALETTE.none;
	}

	// ---------------------------------------------------------------------------
	// Team buff stat → icon / label mappings
	// ---------------------------------------------------------------------------

	const BUFF_STAT_ICON: Partial<Record<Stat, string>> = {
		atk:             '/assets/effects/Icon_Attribute_Attack.webp',
		'atk%':          '/assets/effects/Icon_Attribute_Attack.webp',
		baseAtk:         '/assets/effects/Icon_Attribute_Attack.webp',
		critRate:        '/assets/effects/Icon_Attribute_Critical_Hit.webp',
		critDmg:         '/assets/effects/Icon_Attribute_Critical_Hit.webp',
		em:              '/assets/effects/Icon_Attribute_Elemental_Mastery.webp',
		cdReduction:     '/assets/effects/Icon_Attribute_Cooldown_Reduction.webp',
		def:             '/assets/effects/Icon_Attribute_Defense.webp',
		'def%':          '/assets/effects/Icon_Attribute_Defense.webp',
		hp:              '/assets/effects/Icon_Attribute_Health.webp',
		'hp%':           '/assets/effects/Icon_Attribute_Health.webp',
		allDmgBonus:     '/assets/elements/flat-white/omni.png',
		skillDmgBonus:   '/assets/elements/flat-white/omni.png',
		burstDmgBonus:   '/assets/elements/flat-white/omni.png',
		pyroDmgBonus:    '/assets/elements/flat-white/pyro.png',
		hydroDmgBonus:   '/assets/elements/flat-white/hydro.png',
		cryoDmgBonus:    '/assets/elements/flat-white/cryo.png',
		electroDmgBonus: '/assets/elements/flat-white/electro.png',
		anemoDmgBonus:   '/assets/elements/flat-white/anemo.png',
		geoDmgBonus:     '/assets/elements/flat-white/geo.png',
		dendroDmgBonus:  '/assets/elements/flat-white/dendro.png',
		lunarDmgBonus:   '/assets/elements/flat-white/lunar.png',
	};

	const BUFF_STAT_LABEL: Partial<Record<Stat, string>> = {
		atk:             'ATK',
		'atk%':          'ATK%',
		baseAtk:         'ATK',
		critRate:        'CRIT Rate',
		critDmg:         'CRIT DMG',
		em:              'Elem. Mastery',
		cdReduction:     'CD Reduction',
		def:             'DEF',
		'def%':          'DEF%',
		hp:              'HP',
		'hp%':           'HP%',
		allDmgBonus:     'DMG Bonus',
		skillDmgBonus:   'Skill DMG',
		burstDmgBonus:   'Burst DMG',
		pyroDmgBonus:    'Pyro DMG',
		hydroDmgBonus:   'Hydro DMG',
		cryoDmgBonus:    'Cryo DMG',
		electroDmgBonus: 'Electro DMG',
		anemoDmgBonus:   'Anemo DMG',
		geoDmgBonus:     'Geo DMG',
		dendroDmgBonus:  'Dendro DMG',
		lunarDmgBonus:   'Lunar DMG',
	};

	// ---------------------------------------------------------------------------
	// Team buff row computation
	// ---------------------------------------------------------------------------

	type MergedEffectDisplay = { stat: Stat; displayValue: string };
	type TeamBuffBar = { start: number; end: number; effects: MergedEffectDisplay[] };
	type TeamBuffSubrow = { characterId: string; primaryStat: Stat; bars: TeamBuffBar[]; sourceLabel: string };

	function isPctStat(stat: Stat): boolean {
		return stat.endsWith('%') || stat.endsWith('DmgBonus') || stat === 'critRate' || stat === 'critDmg' || stat === 'cdReduction' || stat === 'incomingHealingBonus';
	}

	function formatBuffDisplayValue(stat: Stat, value: import('$lib/types/ability').BuffValue, refinementIndex: number): string {
		const pct = isPctStat(stat);
		if (typeof value === 'number') return pct ? `+${value}%` : `+${value}`;
		if ('refinementValues' in value) {
			const v = value.refinementValues[refinementIndex];
			return pct ? `+${v}%` : `+${v}`;
		}
		if (value.type === 'unknown') return value.description;
		const ratioNum = typeof value.ratio === 'number' ? value.ratio : value.ratio.refinementValues[refinementIndex];
		const scalingLabel = value.stat === 'baseAtk' ? 'base ATK' : value.stat;
		return `~${Math.round(ratioNum * 100)}% ${scalingLabel}`;
	}

	function targetsTeamOrActive(target: EffectTarget | EffectTarget[]): boolean {
		const ts = Array.isArray(target) ? target : [target];
		return ts.some((t) => t === 'team' || t === 'teamExcludingSelf' || t === 'active');
	}

	function computeTeamBuffRows(
		tracks: CharacterTrack[],
		constellationLevels: Record<string, number>,
		loadoutMap: Record<string, LoadoutEntry>
	): TeamBuffSubrow[] {
		const rowMap = new SvelteMap<string, TeamBuffSubrow>();

		for (const track of tracks) {
			const char = getCharacterById(track.characterId);
			if (!char) continue;

			const cLevel = constellationLevels[track.characterId] ?? 0;

			// ── Character ability effects (onCast) — source-grouped by ability ──
			const abilityBarPairs: Array<[typeof char.abilities[0] | undefined, TimelineBar[], string]> = [
				[char.abilities.find((a) => a.abilityType === 'skill'), track.eBars, 'E'],
				[char.abilities.find((a) => a.abilityType === 'burst'), track.qBars, 'Q'],
			];

			for (const [ability, abBars, abLabel] of abilityBarPairs) {
				const allEffects = ability?.effects ?? [];

				// ── onCast effects ──
				const seenStats = new SvelteSet<string>();
				const qualifiedEffects = allEffects.filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (effect.trigger.type !== 'onCast') return false;
					if (!targetsTeamOrActive(effect.target)) return false;
					if (effect.duration == null) return false;
					if (evalCondition(effect.conditions, 4, new SvelteSet(), cLevel) === false) return false;
					if (seenStats.has(effect.stat)) return false;
					seenStats.add(effect.stat);
					return true;
				});
				if (qualifiedEffects.length > 0) {
					const primaryStat = qualifiedEffects[0].stat;
					const rowKey = `${track.characterId}::char::${abLabel}`;
					const sourceLabel = `${char.displayName} ${abLabel}`;

					for (const bar of abBars) {
						const buffStart = bar.start + (bar.summonActivatesAt ?? 0) / 60;
						const buffEnd = buffStart + qualifiedEffects[0].duration!;
						const effects: MergedEffectDisplay[] = qualifiedEffects.map((e) => ({
							stat: e.stat,
							displayValue: formatBuffDisplayValue(e.stat, e.value, 0)
						}));
						const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
						const existing = rowMap.get(rowKey);
						if (existing) {
							existing.bars.push(buffBar);
						} else {
							rowMap.set(rowKey, { characterId: track.characterId, primaryStat, bars: [buffBar], sourceLabel });
						}
					}
				}

				// ── afterDuration effects — buff fires when ability duration ends ──
				const seenStatsAfter = new SvelteSet<string>();
				const qualifiedEffectsAfter = allEffects.filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (effect.trigger.type !== 'afterDuration') return false;
					if (!targetsTeamOrActive(effect.target)) return false;
					if (effect.duration == null) return false;
					if (evalCondition(effect.conditions, 4, new SvelteSet(), cLevel) === false) return false;
					if (seenStatsAfter.has(effect.stat)) return false;
					seenStatsAfter.add(effect.stat);
					return true;
				});
				if (qualifiedEffectsAfter.length > 0) {
					const primaryStat = qualifiedEffectsAfter[0].stat;
					const attribution = qualifiedEffectsAfter[0].attribution;
					const rowKey = `${track.characterId}::char::${abLabel}::afterDuration`;
					const sourceLabel = attribution
						? `${char.displayName} ${attribution}`
						: `${char.displayName} ${abLabel} (end)`;

					for (const bar of abBars) {
						const buffStart = bar.start + bar.uptime;
						const buffEnd = buffStart + qualifiedEffectsAfter[0].duration!;
						const effects: MergedEffectDisplay[] = qualifiedEffectsAfter.map((e) => ({
							stat: e.stat,
							displayValue: formatBuffDisplayValue(e.stat, e.value, 0)
						}));
						const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
						const existing = rowMap.get(rowKey);
						if (existing) {
							existing.bars.push(buffBar);
						} else {
							rowMap.set(rowKey, { characterId: track.characterId, primaryStat, bars: [buffBar], sourceLabel });
						}
					}
				}
			}

			// ── Artifact 4pc effects (onCast only) — source-grouped by artifact ──
			const artifactSetId = loadoutMap[track.characterId]?.artifactSetId;
			if (artifactSetId) {
				const artifactSet = getArtifactSetById(artifactSetId);
				const allEffects = artifactSet?.fourPiece?.effects ?? [];

				// Group qualifying effects by their trigger ability key
				const byTrigger = new SvelteMap<string, BuffEffect[]>();
				for (const effect of allEffects) {
					if (effect.type !== 'buff') continue;
					if (effect.trigger.type !== 'onCast') continue;
					if (!targetsTeamOrActive(effect.target)) continue;
					if (effect.duration == null) continue;
					const tk = (effect.trigger as { ability?: string }).ability ?? 'any';
					const group = byTrigger.get(tk) ?? [];
					group.push(effect as BuffEffect);
					byTrigger.set(tk, group);
				}

				const sourceLabel = artifactSet!.shortName ?? artifactSet!.name;

				for (const [triggerKey, effects] of byTrigger) {
					const barSets: [TimelineBar[], string][] = [];
					if (triggerKey === 'any' || triggerKey === 'skill') barSets.push([track.eBars, 'E']);
					if (triggerKey === 'any' || triggerKey === 'burst') barSets.push([track.qBars, 'Q']);

					const primaryStat = effects[0].stat;

					for (const [bars, abLabel] of barSets) {
						const rowKey = `${track.characterId}::artifact::${artifactSetId}::${triggerKey}::${abLabel}`;
						for (const bar of bars) {
							const buffStart = bar.start + (bar.summonActivatesAt ?? 0) / 60;
							const buffEnd = buffStart + effects[0].duration!;
							const mergedEffects: MergedEffectDisplay[] = effects.map((e) => ({
								stat: e.stat,
								displayValue: formatBuffDisplayValue(e.stat, e.value, 0)
							}));
							const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects: mergedEffects };
							const existing = rowMap.get(rowKey);
							if (existing) {
								existing.bars.push(buffBar);
							} else {
								rowMap.set(rowKey, { characterId: track.characterId, primaryStat, bars: [buffBar], sourceLabel });
							}
						}
					}
				}
			}
		}

		return [...rowMap.values()];
	}

	// ---------------------------------------------------------------------------
	// Derived: character data per slot
	// ---------------------------------------------------------------------------

	let slotCharacters = $derived(characterSlots.map((id) => getCharacterById(id)));

	// ---------------------------------------------------------------------------
	// Derived: rotation (filtered to only characters present in slots)
	// ---------------------------------------------------------------------------

	let rotation = $derived.by(() => {
		try {
			return parseNotation(notation, getCharacterByDisplayName, swapFrames, $constellations, effectiveLoadout);
		} catch (e) {
			console.error('parseNotation threw:', e);
			return { tracks: [], totalDuration: 0, unknownTokens: [], weaponProcBars: new Map() } satisfies ParsedRotation;
		}
	});

	// ---------------------------------------------------------------------------
	// Track → slot mapping
	// Distributes multiple tracks for the same characterId across matching slots
	// in round-robin order (handles the all-blank case cleanly).
	// ---------------------------------------------------------------------------

	type SlottedTrack = CharacterTrack & { slotIdx: number };

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

	let teamBuffRows = $derived(computeTeamBuffRows(rotation.tracks, $constellations, effectiveLoadout));

	type WeaponProcSubrow = { characterId: string; label: string; bars: Array<{ start: number; end: number }> };
	let weaponProcRows = $derived.by((): WeaponProcSubrow[] => {
		const rows: WeaponProcSubrow[] = [];
		for (const [charId, bars] of rotation.weaponProcBars) {
			if (!bars.length) continue;
			const weaponId = effectiveLoadout[charId]?.weaponId;
			const weapon = weaponId ? getWeaponById(weaponId) : null;
			const label = weapon ? (weapon.shortName ?? weapon.name) : 'E reset';
			rows.push({ characterId: charId, label, bars });
		}
		return rows;
	});

	// Per-character received weapon buff bars (TTDS, Widsith, etc.).
	// Keyed by the *receiving* character's id. Rendered in each character's buff row.
	// Effects sharing one ICD key (e.g. Widsith's 3 themes) are merged into one bar.
	type CharReceivedBuffBar = {
		start: number; end: number;
		primaryStat: Stat;
		effects: MergedEffectDisplay[];
		sourceLabel: string;
		isMutuallyExclusive: boolean;
		procCooldown?: number;
		duration: number;
	};
	type CharReceivedBuffSubrow = { characterId: string; bars: CharReceivedBuffBar[] };
	let charReceivedBuffRows = $derived.by((): CharReceivedBuffSubrow[] => {
		const rowMap = new SvelteMap<string, CharReceivedBuffBar[]>();
		const procReadyAt = new SvelteMap<string, number>();
		const tracks = rotation.tracks;

		function addBar(receiverId: string, bar: CharReceivedBuffBar) {
			const existing = rowMap.get(receiverId);
			if (existing) { existing.push(bar); } else { rowMap.set(receiverId, [bar]); }
		}

		function processWeaponEffects(
			triggerType: 'onSwapOut' | 'onSwapIn',
			weapon: ReturnType<typeof getWeaponById>,
			refinementIndex: number,
			receiverId: string,
			holderId: string,
			swapTime: number
		) {
			if (!weapon) return;
			// Collect all matching effects, grouped by ICD key
			const byIcd = new SvelteMap<string, BuffEffect[]>();
			for (const effect of weapon.passive.effects) {
				if (effect.type !== 'buff') continue;
				if (effect.trigger.type !== triggerType) continue;
				if (effect.duration == null) continue;
				const icdKey = `${holderId}::${weapon.id}::${triggerType}`;
				const group = byIcd.get(icdKey) ?? [];
				group.push(effect as BuffEffect);
				byIcd.set(icdKey, group);
			}
			for (const [icdKey, effects] of byIcd) {
				const first = effects[0];
				const rawIcd = first.procCooldown;
				const icd = rawIcd == null ? 0 : typeof rawIcd === 'number' ? rawIcd : rawIcd.refinementValues[refinementIndex];
				const procReady = procReadyAt.get(icdKey) ?? 0;
				if (swapTime < procReady) continue;
				procReadyAt.set(icdKey, swapTime + icd);

				addBar(receiverId, {
					start: swapTime,
					end: swapTime + first.duration!,
					primaryStat: first.stat,
					effects: effects.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(e.stat, e.value, refinementIndex)
					})),
					sourceLabel: weapon.shortName ?? weapon.name,
					isMutuallyExclusive: effects.length > 1,
					procCooldown: icd > 0 ? icd : undefined,
					duration: first.duration!
				});
			}
		}

		for (let i = 0; i < tracks.length - 1; i++) {
			const track = tracks[i];
			const nextTrack = tracks[i + 1];
			const swapTime = nextTrack.activeStart;

			// onSwapOut: outgoing character's weapon → buff to incoming character (e.g. TTDS)
			const outEntry = effectiveLoadout[track.characterId];
			const outWeapon = outEntry?.weaponId ? getWeaponById(outEntry.weaponId) : null;
			processWeaponEffects('onSwapOut', outWeapon, (outEntry?.weaponRefinement ?? 1) - 1,
				nextTrack.characterId, track.characterId, swapTime);

			// onSwapIn: incoming character's weapon → buff to themselves (e.g. The Widsith)
			const inEntry = effectiveLoadout[nextTrack.characterId];
			const inWeapon = inEntry?.weaponId ? getWeaponById(inEntry.weaponId) : null;
			processWeaponEffects('onSwapIn', inWeapon, (inEntry?.weaponRefinement ?? 1) - 1,
				nextTrack.characterId, nextTrack.characterId, swapTime);
		}

		return [...rowMap.entries()].map(([characterId, bars]) => ({ characterId, bars }));
	});

	let teamBuffsH = $derived(
		teamBuffRows.length > 0
			? teamBuffRows.length * TEAM_BUFF_SUBROW_H + TEAM_BUFF_PAD * 2
			: TEAM_BUFFS_H
	);

	// ---------------------------------------------------------------------------
	// Moonsign buff window computation
	// ---------------------------------------------------------------------------

	/**
	 * For each non-Moonsign slot, collects all E/Q cast times from that character's
	 * tracks and emits a 20s buff window per cast. Windows are not deduplicated —
	 * stacking (DOM order) handles visual overlap.
	 */
	function computeMoonsignRows(
		tracks: CharacterTrack[],
		nonMoonsignSlots: number[],
		slots: string[]
	): Array<{ slotIdx: number; windows: Array<{ start: number; duration: number }> }> {
		return nonMoonsignSlots.map((slotIdx) => {
			const charId = slots[slotIdx];
			const events: number[] = [];
			for (const track of tracks) {
				if (track.characterId !== charId) continue;
				for (const bar of track.eBars) events.push(bar.start);
				for (const bar of track.qBars) events.push(bar.start);
			}
			events.sort((a, b) => a - b);
			return {
				slotIdx,
				windows: events.map((start) => ({ start, duration: 20 }))
			};
		});
	}

	let moonsignRows = $derived(
		teamComp.hasAscendantGleam
			? computeMoonsignRows(rotation.tracks, teamComp.nonMoonsignSlots, characterSlots)
			: []
	);

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

	function onTrackScroll(e: Event) {
		if (extScrollEl) extScrollEl.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft;
	}
	function onExtScroll(e: Event) {
		if (trackScrollEl) trackScrollEl.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft;
	}

	let totalDuration = $derived.by(() => {
		let max = rotation.totalDuration;
		for (const track of rotation.tracks) {
			for (const bar of track.eBars) {
				max = Math.max(max, bar.start + bar.cooldown);
				if (bar.uptime > 0) max = Math.max(max, bar.start + (bar.summonActivatesAt ?? 0) / 60 + bar.uptime);
			}
			for (const bar of track.qBars) {
				max = Math.max(max, bar.start + bar.cooldown);
				if (bar.uptime > 0) max = Math.max(max, bar.start + (bar.summonActivatesAt ?? 0) / 60 + bar.uptime);
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

	function barGeom(start: number, span: number): { left: number; width: number } {
		return {
			left: Math.round(start * scale),
			width: Math.max(Math.round(span * scale), 2)
		};
	}

	/**
	 * Connector between two consecutive notation segments.
	 * Spans vertically from the active row of the 'from' slot to the active row
	 * of the 'to' slot. Returns null if both tracks are in the same slot (no swap).
	 */
	function connectorStyle(from: SlottedTrack, to: SlottedTrack): string | null {
		if (from.slotIdx === to.slotIdx) return null;

		const x = Math.round(from.activeEnd * scale);
		const w = Math.max(Math.round((to.activeStart - from.activeEnd) * scale), 1);
		const r = Math.min(2, Math.floor(w / 2));

		const topSlot = Math.min(from.slotIdx, to.slotIdx);
		const bottomSlot = Math.max(from.slotIdx, to.slotIdx);

		// Align with the inset active bar (top: 1px, height: calc(100% - 2px))
		const y = RULER_H + topSlot * CHAR_BLOCK_H + ACTIVE_ROW_OFFSET + 1;
		const yBottom = RULER_H + bottomSlot * CHAR_BLOCK_H + ACTIVE_ROW_OFFSET + ACTIVE_ROW_H - 1;

		// Downward: from is top slot → free corners are TR and BL
		// Upward:   from is bottom slot → free corners are TL and BR
		const isDownward = from.slotIdx < to.slotIdx;
		const radius = isDownward ? `0 ${r}px 0 ${r}px` : `${r}px 0 ${r}px 0`;

		return `left:${x}px;top:${y}px;width:${w}px;height:${yBottom - y}px;border-radius:${radius}`;
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
				hasArrival:   prev != null && prev.slotIdx !== t.slotIdx,
				hasDeparture: next != null && next.slotIdx !== t.slotIdx
			});
		}
		return map;
	});

	function barRadius(conn: ConnectInfo | undefined): string {
		const l = conn?.hasArrival   ? '0' : '2px';
		const r = conn?.hasDeparture ? '0' : '2px';
		return `${l} ${r} ${r} ${l}`; // TL TR BR BL
	}

	// ---------------------------------------------------------------------------
	// Svelte action: mounts a CodeMirror EditorView into the host element.
	// Two-way sync: editor → notation via updateListener; notation → editor via
	// the update() hook (only dispatches when the value actually differs, so
	// the editor's own changes don't cause a redundant round-trip).
	// ---------------------------------------------------------------------------

	function mountEditor(node: HTMLElement, value: string) {
		// Guard flag: true while we are dispatching an external value change into
		// CodeMirror so the updateListener's `notation = v` write doesn't fire
		// re-entrantly during Svelte's reactive flush, which can confuse the signal
		// system and leave the timeline frozen until the next unrelated state change.
		let externalUpdate = false;

		const view = new EditorView({
			state: EditorState.create({
				doc: value,
				extensions: buildNotationExtensions((v) => {
					if (!externalUpdate) notation = v;
				})
			}),
			parent: node
		});

		return {
			update(newValue: string) {
				const current = view.state.doc.toString();
				if (newValue !== current) {
					externalUpdate = true;
					try {
						view.dispatch({ changes: { from: 0, to: current.length, insert: newValue } });
					} finally {
						externalUpdate = false;
					}
				}
			},
			destroy() { view.destroy(); }
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
			img.src = getAvatarFallback(slotId, 'side');
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
		if (popoverSlot === i) { popoverSlot = null; return; }
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
		if (refPopoverSlot === i) { refPopoverSlot = null; return; }
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		refPopoverX = rect.right + 8;
		refPopoverY = rect.top + rect.height / 2;
		refPopoverSlot = i;
	}

	function setRefinement(charId: string, r: 1|2|3|4|5) {
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
			.filter((c) => { const fresh = !seen.has(c.id); seen.add(c.id); return fresh; })
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
		tooltip = { ...data, x: rect.left + rect.width / 2, y: above ? rect.top - 6 : rect.bottom + 6, above };
	}

	function hideTooltip() {
		tooltip = null;
	}
</script>

<!-- ============================================================ -->
<!--  Root                                                        -->
<!-- ============================================================ -->
<div class="rp-root">

	<!-- ── Notation editor (CodeMirror) ─────────────────────── -->
	<div class="rp-notation-wrap">
		<div class="rp-notation" use:mountEditor={notation}></div>
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

		<!-- Right: sliders -->
		<div class="rp-controls-sliders">
			<button class="rp-zoom-btn" type="button" aria-label="Zoom out"
				onclick={() => scale = Math.max(20, scale - 5)}>🔍−</button>
			<input
				type="range"
				min={20}
				max={120}
				step={5}
				bind:value={scale}
				class="rp-zoom-slider"
				aria-label="Zoom"
			/>
			<button class="rp-zoom-btn" type="button" aria-label="Zoom in"
				onclick={() => scale = Math.min(120, scale + 5)}>🔍+</button>
			<span class="rp-controls-value">{scale}px/s</span>
			<span class="rp-controls-divider">|</span>
			<span class="rp-controls-label">Ping</span>
			<input
				type="range"
				min={4}
				max={20}
				step={1}
				bind:value={swapFrames}
				class="rp-zoom-slider"
				aria-label="Swap ping"
			/>
			<span class="rp-controls-value">{swapFrames}f</span>
			{#if hasCaveats}
				<span class="rp-controls-divider">|</span>
				<button
					class="rp-zoom-btn rp-notes-btn"
					class:rp-notes-btn--active={showCaveats}
					type="button"
					aria-label="Toggle notes panel"
					onclick={() => (showCaveats = !showCaveats)}
				>NOTES</button>
			{/if}
		</div>
	</div>

	<!-- ── Timeline ──────────────────────────────────────────── -->
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
				<div class="rp-label-cell char-label" style:height="{CHAR_BLOCK_H}px">
					<!-- Avatar + constellation overlay -->
					<div class="rp-avatar-area">
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<div
							class="rp-avatar-wrap"
							class:rp-avatar-clickable={!!onOpenSelector}
							style:border-color={p.main}
							style:color={p.main}
							onclick={onOpenSelector}
							role={onOpenSelector ? 'button' : undefined}
							tabindex={onOpenSelector ? 0 : undefined}
							aria-label={onOpenSelector ? 'Open character selector' : undefined}
						>
							{#if !avatarFallbacks[i]}
								<img
									class="rp-avatar-img"
									src={getAvatar(slotId, $siteSettings.useNewOutfits, 'side')}
									alt={char?.displayName ?? slotId}
									onerror={(e) => handleAvatarError(i, slotId, e)}
								/>
							{:else}
								<span class="rp-avatar-initials">
									{initials(char?.displayName ?? slotId)}
								</span>
							{/if}
						</div>
						{#if char}
							<button
								class="rp-constellation-badge"
								style:color={cLevel > 0 ? p.main : undefined}
								style:border-color={cLevel > 0 ? p.border : undefined}
								onclick={(e) => openConstellation(e, i)}
								aria-label="Set constellation for {char.displayName}"
							>C{cLevel}</button>
						{/if}
					</div>
					{#if char && entry !== null}
						<span class="rp-char-name">{char.displayName}</span>
						<div class="rp-loadout-rows">
							<LoadoutDropdown
								items={artifactItems}
								selected={entry.artifactSetId}
								placeholder="Artifact"
								onSelect={(id) => onTabLoadoutChange?.(char.id, { artifactSetId: id })}
							/>
							<div class="rp-weapon-group">
								<div class="rp-weapon-dd">
									<LoadoutDropdown
										items={weaponItemsForType(char.weapon ?? '')}
										selected={entry.weaponId}
										placeholder="Weapon"
										disabled={char.weapon === 'polearm'}
										title={char.weapon === 'polearm' ? 'No polearm-type weapons available' : undefined}
										onSelect={(id) => onTabLoadoutChange?.(char.id, { weaponId: id, weaponRefinement: entry.weaponRefinement ?? 1 })}
									/>
								</div>
								{#if entry.weaponId}
									<button
										class="rp-ref-badge"
										onclick={(e) => openRefinement(e, i)}
										aria-label="Set refinement for weapon"
									>R{entry.weaponRefinement ?? 1}</button>
								{/if}
							</div>
						</div>
					{:else if char}
						<span class="rp-char-name">{char.displayName}</span>
					{/if}
				</div>
			{/each}

			<!-- Team buffs label -->
			<div class="rp-label-cell" style:height="{teamBuffsH}px">
				<span class="rp-label-text">TEAM BUFFS</span>
			</div>

			<!-- NB lane label -->
			{#if teamComp.natlanCount >= 1}
				<div class="rp-label-cell" style:height="{NB_LANE_H}px">
					<span class="rp-label-text">NIGHTSOUL</span>
				</div>
			{/if}

			<!-- Moonsign lane label -->
			{#if teamComp.hasAscendantGleam}
				<div class="rp-label-cell" style:height="{MOONSIGN_LANE_H}px">
					<span class="rp-label-text">MOONSIGN</span>
				</div>
			{/if}

		</div>

		<!-- Right scrollable track area -->
		<div class="rp-track-scroll" bind:this={trackScrollEl} bind:clientWidth={trackScrollWidth} onscroll={onTrackScroll}>
			<div class="rp-tracks" style:width="{totalWidth}px">

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

					<div class="rp-char-block" style:height="{CHAR_BLOCK_H}px" style:--bar-hi={p.hi}>

						<!-- Grid lines -->
						{#each majorTicks as tick (tick.t)}
							<div class="rp-gridline" style:left="{tick.x}px"></div>
						{/each}

						<!-- E row -->
						<div class="rp-row" style:top="{CHAR_PAD_TOP}px" style:height="{E_ROW_H}px">
							{#each slotTracks as track, ti (`${slotIdx}_${ti}`)}
								{#each track.eBars as bar, barIdx (barIdx)}
									{@const eFieldOffset = (bar.summonActivatesAt ?? 0) / 60}
									{@const eFieldStart = bar.start + eFieldOffset}
									{#if bar.sacProcFired}
										<!-- Sac proc: bar spans duration only (CD reset to 0), dim+bordered Phase 2 style -->
										{@const span = bar.uptime > 0 ? bar.uptime : bar.castTime}
										{@const start = bar.uptime > 0 ? eFieldStart : bar.start}
										{@const g = barGeom(start, span)}
										<div
											class="rp-bar-uptime"
											style:left="{g.left}px"
											style:width="{g.width}px"
											style:background={p.main}
											style:opacity="0.65"
											style:border-radius="3px"
											style:box-shadow="inset 0 0 0 1px var(--bar-hi)"
										>
											<span class="rp-bar-row-badge">E</span>
										</div>
									{:else if bar.uptime > 0}
										{#if bar.cooldown >= eFieldOffset + bar.uptime}
											<!-- Case A: cooldown outlasts summon window -->
											{@const u = barGeom(eFieldStart, bar.uptime)}
											<div
												class="rp-bar-uptime"
												style:left="{u.left}px"
												style:width="{u.width}px"
												style:background={p.main}
												style:border-radius="3px"
												style:box-shadow="inset 0 0 0 1px var(--bar-hi)"
											>
												<span class="rp-bar-row-badge">E</span>
											</div>
											{@const cd = barGeom(eFieldStart + bar.uptime, bar.cooldown - eFieldOffset - bar.uptime)}
											{#if cd.width > 0}
												<div
													class="rp-bar-cd"
													style:left="{cd.left}px"
													style:width="{cd.width}px"
													style:background="color-mix(in srgb, {p.main} 23%, var(--bg))"
													style:border-color="transparent"
													style:z-index="0"
												>
													{#if cd.width > 32}
														<span class="rp-bar-cd-label">{Math.round(bar.cooldown * 10) / 10}s</span>
													{/if}
												</div>
											{/if}
										{:else}
											<!-- Case B: summon window outlasts cooldown (e.g. Ganyu Q, Nahida skill) -->
											{@const ph1 = barGeom(eFieldStart, bar.cooldown - eFieldOffset)}
											<div
												class="rp-bar-uptime"
												style:left="{ph1.left}px"
												style:width="{ph1.width}px"
												style:background={p.main}
											>
												<span class="rp-bar-row-badge">E</span>
											</div>
											{@const ph2 = barGeom(bar.start + bar.cooldown, eFieldOffset + bar.uptime - bar.cooldown)}
											{#if ph2.width > 0}
												<div
													class="rp-bar-cd"
													style:left="{ph2.left}px"
													style:width="{ph2.width}px"
													style:background={p.main}
													style:opacity="0.65"
													style:border-color={p.hi}
													style:z-index="2"
												></div>
											{/if}
										{/if}
									{:else}
										{@const cast = barGeom(bar.start, bar.castTime)}
										<div
											class="rp-bar-uptime"
											style:left="{cast.left}px"
											style:width="{cast.width}px"
											style:background={p.main}
											style:border-radius="3px"
											style:box-shadow="inset 0 0 0 1px var(--bar-hi)"
										>
											<span class="rp-bar-row-badge">E</span>
										</div>
										{@const cdSpan = bar.cooldown - bar.castTime}
										{#if cdSpan > 0}
											{@const cd = barGeom(bar.start + bar.castTime, cdSpan)}
											<div
												class="rp-bar-cd"
												style:left="{cd.left}px"
												style:width="{cd.width}px"
												style:background="color-mix(in srgb, {p.main} 23%, var(--bg))"
												style:border-color="transparent"
												style:z-index="0"
											>
												{#if cd.width > 32}
													<span class="rp-bar-cd-label">{Math.round(bar.cooldown * 10) / 10}s</span>
												{/if}
											</div>
										{/if}
									{/if}
								{/each}
							{/each}
						</div>

						<!-- Q row -->
						<div
							class="rp-row"
							style:top="{CHAR_PAD_TOP + E_ROW_H + ROW_GAP}px"
							style:height="{Q_ROW_H}px"
						>
							{#each slotTracks as track, ti (`${slotIdx}_${ti}`)}
								{#each track.qBars as bar, barIdx (barIdx)}
									{@const qFieldOffset = (bar.summonActivatesAt ?? 0) / 60}
									{@const qFieldStart = bar.start + qFieldOffset}
									{#if bar.uptime > 0}
										{#if bar.cooldown >= qFieldOffset + bar.uptime}
											<!-- Case A: cooldown outlasts summon window -->
											{@const u = barGeom(qFieldStart, bar.uptime)}
											<div
												class="rp-bar-uptime"
												style:left="{u.left}px"
												style:width="{u.width}px"
												style:background={p.main}
												style:border-radius="3px"
												style:box-shadow="inset 0 0 0 1px var(--bar-hi)"
											>
												<span class="rp-bar-row-badge">Q</span>
											</div>
											{@const cd = barGeom(qFieldStart + bar.uptime, bar.cooldown - qFieldOffset - bar.uptime)}
											{#if cd.width > 0}
												<div
													class="rp-bar-cd"
													style:left="{cd.left}px"
													style:width="{cd.width}px"
													style:background="color-mix(in srgb, {p.main} 23%, var(--bg))"
													style:border-color="transparent"
													style:z-index="0"
												>
													{#if cd.width > 32}
														<span class="rp-bar-cd-label">{Math.round(bar.cooldown * 10) / 10}s</span>
													{/if}
												</div>
											{/if}
										{:else}
											<!-- Case B: summon window outlasts cooldown (e.g. Ganyu Q) -->
											{@const ph1 = barGeom(qFieldStart, bar.cooldown - qFieldOffset)}
											<div
												class="rp-bar-uptime"
												style:left="{ph1.left}px"
												style:width="{ph1.width}px"
												style:background={p.main}
											>
												<span class="rp-bar-row-badge">Q</span>
											</div>
											{@const ph2 = barGeom(bar.start + bar.cooldown, qFieldOffset + bar.uptime - bar.cooldown)}
											{#if ph2.width > 0}
												<div
													class="rp-bar-cd"
													style:left="{ph2.left}px"
													style:width="{ph2.width}px"
													style:background={p.main}
													style:opacity="0.65"
													style:border-color={p.hi}
													style:z-index="2"
												></div>
											{/if}
										{/if}
									{:else}
										{@const cast = barGeom(bar.start, bar.castTime)}
										<div
											class="rp-bar-uptime"
											style:left="{cast.left}px"
											style:width="{cast.width}px"
											style:background={p.main}
											style:border-radius="3px"
											style:box-shadow="inset 0 0 0 1px var(--bar-hi)"
										>
											<span class="rp-bar-row-badge">Q</span>
										</div>
										{@const cdSpan = bar.cooldown - bar.castTime}
										{#if cdSpan > 0}
											{@const cd = barGeom(bar.start + bar.castTime, cdSpan)}
											<div
												class="rp-bar-cd"
												style:left="{cd.left}px"
												style:width="{cd.width}px"
												style:background="color-mix(in srgb, {p.main} 23%, var(--bg))"
												style:border-color="transparent"
												style:z-index="0"
											>
												{#if cd.width > 32}
													<span class="rp-bar-cd-label">{Math.round(bar.cooldown * 10) / 10}s</span>
												{/if}
											</div>
										{/if}
									{/if}
								{/each}
							{/each}
						</div>

						<!-- Active row (one bar per track in this slot) -->
						<div class="rp-row" style:top="{ACTIVE_ROW_OFFSET}px" style:height="{ACTIVE_ROW_H}px">
							{#each slotTracks as track, ti (`${slotIdx}_${ti}`)}
								{@const activeLeft = Math.round(track.activeStart * scale)}
								{@const activeW = Math.max(Math.round((track.activeEnd - track.activeStart) * scale), 4)}
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
									{@const blockLeft = Math.round(block.start * scale)}
									{@const blockW = Math.max(Math.round(block.duration * scale), 2)}
									<div
										class="rp-input-block rp-input-block--{block.kind}"
										style:left="{blockLeft}px"
										style:width="{blockW}px"
										style:background={block.kind === 'skill' || block.kind === 'burst' || block.kind === 'elemental-normal' ? p.border : undefined}
										style:border-right={bi === track.inputBlocks.length - 1 ? 'none' : undefined}
									>
										{#each block.parts as part (part)}
											<span class="rp-active-text">{part}</span>
										{/each}
									</div>
								{/each}
							{/each}
						</div>

						<!-- Char-specific buff row: weapon proc ICD bars + received weapon buffs -->
						<div
							class="rp-row"
							style:top="{ACTIVE_ROW_OFFSET + ACTIVE_ROW_H + ROW_GAP}px"
							style:height="{CHAR_BUFF_ROW_H}px"
						>
							{#each weaponProcRows.filter((r) => r.characterId === char?.id) as procRow (procRow.characterId)}
								{#each procRow.bars as bar, bi (bi)}
									{@const g = barGeom(bar.start, bar.end - bar.start)}
									<div class="rp-weapon-proc-bar" style:left="{g.left}px" style:width="{g.width}px">
										<span class="rp-buff-label">{procRow.label} trigger CD</span>
									</div>
								{/each}
							{/each}
							{#each charReceivedBuffRows.filter((r) => r.characterId === char?.id) as recRow (recRow.characterId)}
								{#each recRow.bars as bar, bi (bi)}
									{@const g = barGeom(bar.start, bar.end - bar.start)}
									{@const icon = BUFF_STAT_ICON[bar.primaryStat]}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div class="rp-team-buff-bar" style:left="{g.left}px" style:width="{g.width}px"
										onmouseenter={(e) => showTooltip(e, { sourceLabel: bar.sourceLabel, effects: bar.effects, isMutuallyExclusive: bar.isMutuallyExclusive, duration: bar.duration, procCooldown: bar.procCooldown })}
										onmouseleave={hideTooltip}
									>
										{#if icon}<img src={icon} alt="" class="rp-buff-icon" />{/if}
										<span class="rp-buff-label">{bar.sourceLabel}</span>
									</div>
								{/each}
							{/each}
						</div>

					</div>
				{/each}

				<!-- Team buffs row -->
				<div class="rp-team-buffs" style:height="{teamBuffsH}px">
					{#each majorTicks as tick (tick.t)}
						<div class="rp-gridline" style:left="{tick.x}px"></div>
					{/each}
					{#if teamBuffRows.length === 0}
						<span class="rp-team-buffs-empty">team buffs — add curated characters to see results</span>
					{:else}
						<div class="rp-team-buff-rows">
							{#each teamBuffRows as subrow (`${subrow.characterId}::${subrow.sourceLabel}`)}
								<div class="rp-team-buff-subrow">
									{#each subrow.bars as bar, bi (bi)}
										{@const g = barGeom(bar.start, bar.end - bar.start)}
										{@const icon = BUFF_STAT_ICON[subrow.primaryStat]}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div class="rp-team-buff-bar" style:left="{g.left}px" style:width="{g.width}px"
											onmouseenter={(e) => showTooltip(e, { sourceLabel: subrow.sourceLabel, effects: bar.effects, isMutuallyExclusive: false, duration: bar.end - bar.start })}
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
					<div class="rp-nb-lane" style:height="{NB_LANE_H}px">
						{#each majorTicks as tick (tick.t)}
							<div class="rp-gridline" style:left="{tick.x}px"></div>
						{/each}
						{#each nbBars as ev, i (i)}
							{@const cd = barGeom(ev.start, ev.cooldown)}
							<div
								class="rp-bar-cd rp-bar-instant"
								style:left="{cd.left}px"
								style:width="{cd.width}px"
								style:background="rgba(240,160,48,0.13)"
								style:border-color="rgba(240,160,48,0.12)"
								style:border-left-color="#f0a030"
							>
								<span class="rp-bar-cast-label" style:color="#f0a030">NB</span>
								{#if cd.width > 40}
									<span class="rp-bar-cd-label">{ev.cooldown}s</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<!-- Moonsign lane -->
				{#if teamComp.hasAscendantGleam}
					<div class="rp-moonsign-lane" style:height="{MOONSIGN_LANE_H}px">
						{#each majorTicks as tick (tick.t)}
							<div class="rp-gridline" style:left="{tick.x}px"></div>
						{/each}
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


				<!-- Swap connectors: between consecutive notation segments -->
				<!-- Color is keyed to the 'to' character's element -->
				{#each annotatedTracks as track, i (i)}
					{#if i < annotatedTracks.length - 1}
						{@const next = annotatedTracks[i + 1]}
						{@const style = connectorStyle(track, next)}
						{#if style}
							<div
								class="rp-connector"
								{style}
							></div>
						{/if}
					{/if}
				{/each}

			</div><!-- /rp-tracks -->
		</div><!-- /rp-track-scroll -->
	</div><!-- /rp-scroll-wrapper -->

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

	</div><!-- /rp-timeline-area -->

	<!-- ── External scrollbar (below timeline, synced to track) ─ -->
	<div class="rp-ext-scroll-wrap">
		<div class="rp-ext-scroll-spacer" style:width="{LABEL_W}px"></div>
		<div class="rp-ext-scroll" bind:this={extScrollEl} onscroll={onExtScroll}>
			<div style:width="{totalWidth}px" style:height="1px"></div>
		</div>
	</div>

	<!-- ── Constellation + refinement popovers ───────────────── -->
	{#if popoverSlot !== null || refPopoverSlot !== null}
		<div
			class="rp-popover-backdrop"
			role="button"
			tabindex="-1"
			aria-label="Close picker"
			onclick={() => { popoverSlot = null; refPopoverSlot = null; }}
			onkeydown={(e) => { if (e.key === 'Escape') { popoverSlot = null; refPopoverSlot = null; } }}
		></div>
	{/if}
	{#if popoverSlot !== null}
		{@const pchar = slotCharacters[popoverSlot]}
		{@const pp = pal(pchar?.element)}
		{@const currentLevel = pchar ? ($constellations[pchar.id] ?? 0) : 0}
		<div
			class="rp-constellation-popover"
			style:left="{popoverX}px"
			style:top="{popoverY}px"
		>
			{#each [0, 1, 2, 3, 4, 5, 6] as level (level)}
				<button
					class="rp-pip"
					class:rp-pip--filled={level > 0 && level <= currentLevel}
					class:rp-pip--current={level === currentLevel}
					style:--pip-color={pp.main}
					onclick={() => pchar && setConstellation(pchar.id, level)}
				>{level}</button>
			{/each}
		</div>
	{/if}
	{#if refPopoverSlot !== null}
		{@const rchar = slotCharacters[refPopoverSlot]}
		{@const rp = pal(rchar?.element)}
		{@const rEntry = rchar ? effectiveLoadoutEntry(rchar.id) : null}
		{@const currentRef = rEntry?.weaponRefinement ?? 1}
		<div
			class="rp-constellation-popover"
			style:left="{refPopoverX}px"
			style:top="{refPopoverY}px"
		>
			{#each [1, 2, 3, 4, 5] as r (r)}
				<button
					class="rp-pip"
					class:rp-pip--filled={r <= currentRef}
					class:rp-pip--current={r === currentRef}
					style:--pip-color={rp.main}
					onclick={() => rchar && setRefinement(rchar.id, r as 1|2|3|4|5)}
				>R{r}</button>
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
					{#if tooltip.duration != null && tooltip.procCooldown != null} · {/if}
					{#if tooltip.procCooldown != null}CD {tooltip.procCooldown}s{/if}
				</div>
			{/if}
		</div>
	{/if}

</div>


<style>
	/* ── Root ─────────────────────────────────────────────────── */
	.rp-root {
		--bg: #0f1528;
		--card: #17213a;
		--border: #253252;
		--text: #e6edf8;
		--muted: #9eacc8;

		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		font-size: 10px;
		color: var(--text);
		background: var(--bg);
		border-radius: 0 0 10px 10px;
		padding: 14px 16px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	/* ── Controls ─────────────────────────────────────────────── */
	.rp-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		color: var(--muted);
		min-height: 24px;
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
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.rp-controls-value {
		font-size: 9px;
		min-width: 44px;
	}
	.rp-controls-divider {
		opacity: 0.2;
		margin: 0 4px;
	}
	.rp-zoom-slider {
		width: 80px;
		accent-color: rgba(200, 205, 215, 0.5);
	}
	.rp-zoom-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 11px;
		line-height: 1;
		padding: 0 2px;
		color: var(--muted);
		opacity: 0.6;
		user-select: none;
	}
	.rp-zoom-btn:hover {
		opacity: 1;
	}

	/* ── Timeline area (scroll + optional caveat panel) ──────── */
	.rp-timeline-area {
		display: flex;
		flex-direction: row;
		align-items: stretch;
	}

	/* ── Caveat panel ─────────────────────────────────────────── */
	.rp-caveat-panel {
		width: 220px;
		flex-shrink: 0;
		border-left: 1px solid var(--border);
		overflow-y: auto;
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.rp-caveat-char {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.rp-caveat-char-name {
		font-family: 'Space Grotesk', 'IBM Plex Mono', sans-serif;
		font-size: 8px;
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
		font-size: 7.5px;
		font-weight: 700;
		color: var(--muted);
		letter-spacing: 0.04em;
	}
	.rp-caveat-text {
		margin: 0;
		font-size: 7.5px;
		color: var(--text);
		line-height: 1.55;
		opacity: 0.75;
	}

	/* ── Notes button ─────────────────────────────────────────── */
	.rp-notes-btn {
		font-family: 'Space Grotesk', 'IBM Plex Mono', sans-serif;
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.rp-notes-btn--active {
		opacity: 1;
		color: var(--text);
	}

	/* ── Scroll wrapper ───────────────────────────────────────── */
	.rp-scroll-wrapper {
		display: flex;
		flex: 1;
		min-width: 0;
	}

	/* ── Label column ─────────────────────────────────────────── */
	.rp-label-col {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: var(--bg);
	}
	.rp-label-spacer {
		flex-shrink: 0;
	}
	.rp-label-cell {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding-right: 10px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.rp-label-text {
		font-family: 'Space Grotesk', 'IBM Plex Mono', sans-serif;
		font-size: 8px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
		text-align: right;
		line-height: 1.4;
	}

	/* ── Character label cell ─────────────────────────────────── */
	.char-label {
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 6px 0;
		gap: 4px;
	}
	.rp-char-name {
		font-family: 'Space Grotesk', 'IBM Plex Mono', sans-serif;
		font-size: 9px;
		font-weight: 500;
		color: var(--muted);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: calc(100% - 8px);
		letter-spacing: 0.04em;
	}

	/* ── Avatar area (wrapper for avatar + constellation overlay) */
	.rp-avatar-area {
		position: relative;
		flex-shrink: 0;
	}
	.rp-constellation-badge {
		position: absolute;
		top: -5px;
		right: -22px;
		background: rgba(13, 18, 36, 0.92);
		border: 1px solid rgba(255, 255, 255, 0.12);
		padding: 3px 3px 1px;
		cursor: pointer;
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		font-size: 7px;
		font-weight: 700;
		color: var(--muted);
		letter-spacing: 0.05em;
		border-radius: 3px;
		line-height: 1;
		z-index: 2;
		transition: background 0.12s, border-color 0.12s;
	}
	.rp-constellation-badge:hover {
		background: rgba(255, 255, 255, 0.09);
	}

	/* ── Loadout rows (weapon + artifact stacked) ────────────── */
	.rp-loadout-rows {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: calc(100% - 8px);
		margin-top: 2px;
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
		background: none;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 3px;
		color: var(--muted);
		font-family: 'IBM Plex Mono', monospace;
		font-size: 7px;
		font-weight: 700;
		letter-spacing: 0.04em;
		cursor: pointer;
		padding: 3px 3px 2px;
		line-height: 1;
		white-space: nowrap;
		transition: background 0.1s, color 0.1s, border-color 0.1s;
	}
	.rp-ref-badge:hover {
		background: rgba(255, 255, 255, 0.07);
		color: rgba(255, 255, 255, 0.75);
		border-color: rgba(255, 255, 255, 0.22);
	}

	/* ── Avatar ───────────────────────────────────────────────── */
	.rp-avatar-wrap {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 1.5px solid;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		flex-shrink: 0;
		transition: box-shadow 0.18s;
	}
	.rp-avatar-clickable {
		cursor: pointer;
	}
	.rp-avatar-clickable:hover {
		box-shadow: 0 0 0 2px currentColor, 0 0 10px 1px currentColor;
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
		font-family: 'Space Grotesk', sans-serif;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.03em;
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
		border-bottom: 1px solid var(--border);
	}
	.rp-tick {
		position: absolute;
		bottom: 0;
		width: 1px;
		background: #253252;
		height: 4px;
	}
	.rp-tick.major {
		height: 8px;
		background: #3a4e72;
	}
	.rp-tick-label {
		position: absolute;
		bottom: 10px;
		left: 0;
		transform: translateX(-50%);
		font-size: 8.5px;
		color: var(--muted);
		white-space: nowrap;
		pointer-events: none;
	}

	/* ── Grid lines ───────────────────────────────────────────── */
	.rp-gridline {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: #1a2540;
		pointer-events: none;
		z-index: 0;
	}

	/* ── Team buffs row ───────────────────────────────────────── */
	.rp-team-buffs {
		position: relative;
		border-bottom: 1px solid #253252;
	}
	.rp-team-buffs-empty {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		padding-left: 8px;
		font-size: 8px;
		color: #3a4e72;
		pointer-events: none;
	}
	.rp-team-buff-rows {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 3px 0;
	}
	.rp-team-buff-subrow {
		position: relative;
		flex: 1;
		min-height: 0;
	}
	.rp-team-buff-bar {
		position: absolute;
		top: 0;
		height: 100%;
		background: #1c3254;
		border: 1px solid #3a5c84;
		border-left: 2px solid #6a96c0;
		border-radius: 2px;
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 0 4px;
		overflow: hidden;
		z-index: 1;
		min-width: 2px;
	}
	.rp-buff-icon {
		width: 10px;
		height: 10px;
		flex-shrink: 0;
		object-fit: contain;
		opacity: 0.8;
	}
	.rp-buff-label {
		font-size: 8px;
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
		background: rgba(200, 140, 40, 0.08);
		border: 1px solid rgba(200, 140, 40, 0.18);
		border-left: 2px solid rgba(200, 140, 40, 0.6);
		border-radius: 2px;
		display: flex;
		align-items: center;
		padding: 0 4px;
		overflow: hidden;
		z-index: 1;
		min-width: 2px;
	}
	.rp-weapon-proc-bar .rp-buff-label {
		color: rgba(200, 140, 40, 0.75);
	}

	/* ── NB lane ─────────────────────────────────────────────── */
	.rp-nb-lane {
		position: relative;
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: center;
	}

	/* ── Moonsign lane ───────────────────────────────────────── */
	.rp-moonsign-lane {
		position: relative;
		border-bottom: 1px solid var(--border);
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
		flex: 1;
		min-height: 0;
	}
	.rp-moonsign-bar {
		position: absolute;
		top: 0;
		height: 100%;
		background: #342d58;
		border: 1px solid #5a5090;
		border-left: 2px solid #b8a8e0;
		border-radius: 2px;
		z-index: 1;
	}


	/* ── Character block ──────────────────────────────────────── */
	.rp-char-block {
		position: relative;
		border-bottom: 1px solid var(--border);
	}

	/* ── Rows ─────────────────────────────────────────────────── */
	.rp-row {
		position: absolute;
		left: 0;
		right: 0;
	}
	/* ── Ability bars ─────────────────────────────────────────── */
	.rp-bar-uptime {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		border-radius: 3px 0 0 3px;
		box-shadow: inset 1px 0 0 0 var(--bar-hi, transparent), inset 0 1px 0 0 var(--bar-hi, transparent), inset 0 -1px 0 0 var(--bar-hi, transparent);
		z-index: 2;
		min-width: 2px;
		display: flex;
		align-items: center;
		padding: 0 3px;
		overflow: hidden;
	}
	.rp-bar-cd {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		border-radius: 0 3px 3px 0;
		border: 1px solid;
		border-left: none;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2px;
	}
	.rp-bar-instant {
		border-radius: 3px;
		border-left: 2px solid !important;
		justify-content: center;
	}
	/* Cast token pinned to the left edge inside instant bars */
	.rp-bar-instant .rp-bar-cast-label {
		position: absolute;
		left: 5px;
	}
	.rp-bar-cast-label {
		font-size: 7px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.85);
		white-space: nowrap;
		pointer-events: none;
		letter-spacing: 0.02em;
		flex-shrink: 0;
	}
	.rp-bar-cd-label {
		font-size: 7.5px;
		color: rgba(255, 255, 255, 0.4);
		white-space: nowrap;
		pointer-events: none;
	}

	/* ── Active background strip ─────────────────────────────── */
	.rp-active-bg {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		background: rgba(79, 84, 107, 1);
		z-index: 1;
		min-width: 4px;
		pointer-events: none;
	}
	.rp-active-bg--unset {
		background: transparent;
		border: 1.5px dashed #4F546B;
	}

	/* ── Input blocks ─────────────────────────────────────────── */
	.rp-input-block {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		border-right: 1px solid rgba(15, 21, 41, 0.3);
		box-sizing: border-box;
		z-index: 2;
		min-width: 2px;
		display: flex;
		align-items: center;
		padding: 0 3px;
		overflow: hidden;
	}
	.rp-input-block--normal {
		background: #4F546B;
	}
	.rp-input-block--movement {
		background: rgba(79, 84, 107, 0.45);
	}
	.rp-input-block--unset {
		background: transparent;
		border: 1px dashed #4F546B;
	}
	.rp-active-text {
		font-size: 8.5px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.66);
	}

	/* ── E/Q row left-edge badge ──────────────────────────────── */
	.rp-bar-row-badge {
		position: absolute;
		left: 3px;
		font-size: 7px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.66);
		pointer-events: none;
		letter-spacing: 0.02em;
	}

	/* ── Swap connector ───────────────────────────────────────── */
	.rp-connector {
		position: absolute;
		background: #4F546B;
		border: none;
		z-index: 1;
		pointer-events: none;
	}

	/* ── Notation box ─────────────────────────────────────────── */
	.rp-notation-wrap {
		display: flex;
		flex-direction: column;
		position: relative;
	}
	/* .rp-notation is the CodeMirror host div — structural only; all visual
	   styling (background, border, font, colors) is injected by notationTheme
	   inside buildNotationExtensions so it bypasses Svelte's CSS scoping. */
	.rp-notation {
		width: 100%;
		box-sizing: border-box;
	}

	/* ── Unknown token warning ───────────────────────────────── */
	.rp-unknown-label {
		color: #c0882a;
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
	}
	.rp-unknown-chip {
		background: rgba(192, 136, 42, 0.12);
		border: 1px solid rgba(192, 136, 42, 0.3);
		border-radius: 3px;
		padding: 1px 5px;
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		color: #c0882a;
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
		background: #17213a;
		border: 1px solid #253252;
		border-radius: 8px;
		padding: 6px 8px;
		display: flex;
		align-items: center;
		gap: 4px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
	}
	.rp-pip {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 1.5px solid #2a3a5c;
		background: none;
		color: #4a6090;
		font-family: 'IBM Plex Mono', 'JetBrains Mono', monospace;
		font-size: 8px;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition: background 0.1s, border-color 0.1s, color 0.1s;
	}
	.rp-pip--filled {
		background: color-mix(in srgb, var(--pip-color) 20%, transparent);
		border-color: color-mix(in srgb, var(--pip-color) 60%, transparent);
		color: var(--pip-color);
	}
	.rp-pip--current {
		background: color-mix(in srgb, var(--pip-color) 30%, transparent);
		border-color: var(--pip-color);
		box-shadow: 0 0 0 1.5px var(--pip-color);
	}
	.rp-pip:hover {
		border-color: var(--pip-color, #6cb5ff);
		color: var(--pip-color, #6cb5ff);
	}

	/* ── Buff tooltip ─────────────────────────────────────────── */
	.rp-tooltip {
		position: fixed;
		z-index: 100;
		transform: translateX(-50%);
		background: #17213a;
		border: 1px solid #3a5c84;
		border-radius: 6px;
		padding: 7px 10px;
		pointer-events: none;
		min-width: 110px;
		max-width: 210px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.55);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.rp-tooltip--above {
		transform: translateX(-50%) translateY(-100%);
	}
	.rp-tooltip-source {
		font-family: 'Space Grotesk', 'IBM Plex Mono', sans-serif;
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
		border-bottom: 1px solid var(--border);
		padding-bottom: 4px;
		margin-bottom: 1px;
	}
	.rp-tooltip-mutual {
		font-size: 7.5px;
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
		width: 10px;
		height: 10px;
		flex-shrink: 0;
		object-fit: contain;
		opacity: 0.8;
	}
	.rp-tooltip-stat {
		font-size: 8px;
		color: var(--text);
		flex: 1;
		min-width: 0;
	}
	.rp-tooltip-value {
		font-size: 8px;
		color: #90b4d0;
		font-weight: 600;
		white-space: nowrap;
	}
	.rp-tooltip-footer {
		font-size: 7.5px;
		color: var(--muted);
		letter-spacing: 0.03em;
		border-top: 1px solid var(--border);
		padding-top: 3px;
		margin-top: 1px;
	}
</style>
