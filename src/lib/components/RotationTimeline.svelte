<script lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { EditorView } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import {
		parseNotation,
		evalCondition,
		type ConditionContext,
		type InputBlock,
		type ParsedRotation,
		type TimelineBar
	} from '$lib/utils/notationParser';
	import {
		evalTriggerFilter,
		getDefaultDamageTag,
		type DamageTag,
		type TriggerFilterContext
	} from '$lib/types/ability';
	import type {
		Stat,
		EffectTarget,
		Effect,
		CastAbility,
		Reaction,
		Summon
	} from '$lib/types/ability';
	import type { CharacterData } from '$lib/types/character';
	import { buildNotationExtensions } from '$lib/utils/notationEditorExtension';
	import { getIndexEntryByDisplayName } from '$lib/data/characterLookup';
	import { getLoadedCharacter } from '$lib/data/characterData';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import { constellations, siteSettings, loadout, type LoadoutEntry } from '$lib/stores';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import type { CharacterTrack } from '$lib/utils/notationParser';
	import {
		getAllArtifactSets,
		getArtifactSetById,
		artifactImagePath
	} from '$lib/data/artifactLookup';
	import { getWeaponsByType, getWeaponById, weaponImagePath } from '$lib/data/weaponLookup';
	import LoadoutDropdown from '$lib/components/LoadoutDropdown.svelte';
	import type { DropdownItem } from '$lib/components/LoadoutDropdown.svelte';
	import { elementPalette, type ElementPalette } from '$lib/utils/elementColors';

	type BuffEffect = Extract<Effect, { type: 'buff' }>;
	type ResShredEffect = Extract<Effect, { type: 'resShred' }>;

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
	const CHAR_PAD_TOP = 8;
	const E_ROW_H = 16;
	const Q_ROW_H = 16;
	const ACTIVE_ROW_H = 32; // exactly 2× E/Q row height
	const CHAR_BUFF_ROW_H = 12; // tightened aux-row convention
	const CHAR_PAD_BOTTOM = 8;
	const ROW_GAP = 4;
	// 2px visual gap between consecutive buff subrows
	const CHAR_BUFF_ROW_STRIDE = CHAR_BUFF_ROW_H + 2; // = 14

	// Summon lane (between E and Q, conditional on summons[].length > 0)
	const SUMMON_ROW_H = 12;
	const SUMMON_ROW_STRIDE = SUMMON_ROW_H + 2; // = 14
	// Gap above and below the summon lane. 3px is chosen so adding a summon costs
	// exactly one CHAR_BUFF_ROW_STRIDE (14px) — `3 + 12 + 3 - 4(no-summon E↔Q gap)
	// = 14` — which is the same amount the buff reservation gives back when one
	// of its rows is replaced by a summon. Net slot-height delta: zero.
	const SUMMON_LANE_GAP = 3;

	// Default reservation for the shared aux-row pool — summon sub-rows above the
	// Q row and received-buff sub-rows below the active row count toward the same
	// budget. The slot grows only when summon + buff combined exceeds this.
	const DEFAULT_RESERVED_AUX_ROWS = 4;

	// Below-timeline lanes (team buffs, NB, Moonsign) — shared 12px bar + 2px
	// padding each side; multi-row lanes grow with row count.
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

	// ---------------------------------------------------------------------------
	// Team buff row computation
	// ---------------------------------------------------------------------------

	type MergedEffectDisplay = { stat: Stat; displayValue: string };
	type TeamBuffBar = { start: number; end: number; effects: MergedEffectDisplay[] };
	type TeamBuffSubrow = {
		characterId: string;
		primaryStat: Stat;
		bars: TeamBuffBar[];
		sourceLabel: string;
		/** 'debuff' renders with the resShred (red-tinted) bar treatment.
		 *  Defaults to 'buff' when omitted. */
		kind?: 'buff' | 'debuff';
	};

	function isPctStat(stat: Stat): boolean {
		return (
			stat.endsWith('%') ||
			stat.endsWith('DmgBonus') ||
			stat.endsWith('Res') ||
			stat.endsWith('CritDmg') ||
			stat === 'critRate' ||
			stat === 'critDmg' ||
			stat === 'cdReduction' ||
			stat === 'incomingHealingBonus'
		);
	}

	/** Helper for callers iterating effect arrays: pulls a buff effect's
	 *  canonicalAssumption.headlineValue if present (safe across narrower or
	 *  wider effect-type unions). Returns undefined when the effect doesn't
	 *  carry the marker, so `formatBuffDisplayValue` falls back to formula
	 *  computation. */
	function canonicalHeadlineOf(e: unknown): number | undefined {
		if (!e || typeof e !== 'object') return undefined;
		const ca = (e as { canonicalAssumption?: { headlineValue?: number } }).canonicalAssumption;
		return ca?.headlineValue;
	}

	function formatBuffDisplayValue(
		stat: Stat,
		value: import('$lib/types/ability').BuffValue,
		refinementIndex: number,
		stackContext?: ReadonlyMap<string, number>,
		canonicalHeadline?: number
	): string {
		const pct = isPctStat(stat);
		// canonicalAssumption short-circuit: when the buff is flagged as a
		// canonical-rotation assumption, the headline value renders directly
		// and the formula in `value` is treated as schema-level ground truth
		// only (preserved for the day a real primitive resolves the input).
		if (canonicalHeadline !== undefined) {
			return pct ? `+${canonicalHeadline}%` : `+${canonicalHeadline}`;
		}
		if (typeof value === 'number') return pct ? `+${value}%` : `+${value}`;
		if ('refinementValues' in value) {
			const v = value.refinementValues[refinementIndex];
			return pct ? `+${v}%` : `+${v}`;
		}
		if (value.type === 'unknown') return value.description;
		if (value.type === 'ramping') {
			const capStr = value.cap != null ? ` → ${value.cap}%` : '';
			return `+${value.startValue}%${capStr} (+${value.stepValue}%/${value.stepInterval}s)`;
		}
		if (value.type === 'decaying') {
			const end = value.endValue ?? 0;
			const startStr = pct ? `+${value.startValue}%` : `+${value.startValue}`;
			const endStr = pct ? `${end}%` : `${end}`;
			return `${startStr} → ${endStr} over duration`;
		}
		if (value.type === 'perStack') {
			const stacks = stackContext?.get(value.key);
			const threshold = value.threshold ?? 0;
			const effectiveStacks = (raw: number) => {
				const adjusted = Math.max(0, raw - threshold);
				return value.maxStacks != null ? Math.min(adjusted, value.maxStacks) : adjusted;
			};
			const overSuffix = threshold > 0 ? ` over ${threshold}` : '';
			const capSuffix = value.cap != null ? ` (cap ${value.cap})` : '';
			if (typeof value.per === 'object') {
				const scalingLabel = scalingStatLabel(value.per.stat);
				if (stacks != null && stacks > threshold) {
					const totalRatio = effectiveStacks(stacks) * value.per.ratio;
					return `~${totalRatio}% ${scalingLabel}${capSuffix}`;
				}
				return `~${value.per.ratio}% ${scalingLabel}/stack${overSuffix}${capSuffix}`;
			}
			if (stacks != null && stacks > threshold) {
				const rawTotal = effectiveStacks(stacks) * value.per;
				const total = value.cap != null ? Math.min(rawTotal, value.cap) : rawTotal;
				return pct ? `+${total}%` : `+${total}`;
			}
			const perStr = pct ? `+${value.per}%` : `+${value.per}`;
			return `${perStr}/stack${overSuffix}${capSuffix}`;
		}
		const ratioNum =
			typeof value.ratio === 'number' ? value.ratio : value.ratio.refinementValues[refinementIndex];
		const scalingLabel = scalingStatLabel(value.stat);
		const scalingCap = value.cap != null ? ` (cap ${value.cap})` : '';
		// ratio is in percentage points (see BuffValue.scaling JSDoc) — display
		// directly as `~{ratio}% {stat}` without further scaling.
		return `~${ratioNum}% ${scalingLabel}${scalingCap}`;
	}

	/** Friendly display name for the source stat of a scaling/perStack value.
	 *  Accepts the broader `Stat` union (the schema's `BuffValue.scaling.stat`
	 *  is the generic Stat, not the narrower ScalingStat) so this can be used
	 *  in both places. */
	function scalingStatLabel(stat: Stat): string {
		if (stat === 'baseAtk') return 'base ATK';
		if (stat === 'healingBonus') return 'Healing Bonus';
		return stat;
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

	function targetsTeamOrActive(target: EffectTarget | EffectTarget[]): boolean {
		const ts = Array.isArray(target) ? target : [target];
		return ts.some((t) => t === 'team' || t === 'teamExcludingSelf' || t === 'active');
	}

	function targetsEnemy(target: EffectTarget | EffectTarget[]): boolean {
		const ts = Array.isArray(target) ? target : [target];
		return ts.includes('enemy');
	}

	/** Maps a resShred element to the matching `${element}Res` Stat key for icon /
	 *  label lookup. Resists without an `element` field render under the generic
	 *  `allElementalRes` key (Itto burst, VV swirl — VV's actual swirl element is
	 *  not carried through the schema). */
	function resShredDisplayStat(element: import('$lib/types/ability').Element | undefined): Stat {
		if (element === 'physical') return 'physicalRes';
		if (element) return `${element}Res` as Stat;
		return 'allElementalRes';
	}

	/** Renders a resShred numeric `value` (always negative in authored data) as a
	 *  signed percentage. e.g. `-40` → `"-40%"`. */
	function formatResShredDisplayValue(value: number): string {
		return `${value}%`;
	}

	// Returns true only when the effect exclusively targets the active character.
	// These effects are segmented per on-field window rather than shown in the team buff row.
	function isActiveTargetOnly(target: EffectTarget | EffectTarget[]): boolean {
		return !Array.isArray(target) && target === 'active';
	}

	/** Maps a single Lunar reaction to the matching `lunar*DmgBonus` stat key
	 *  used by display formatting and de-dup. Returns null for reactions
	 *  outside the rendered set (Columbina-style multi-reaction "all lunar"
	 *  cases and any non-Lunar elevation are not yet rendered). */
	function elevateReactionToDisplayStat(
		reaction: import('$lib/types/ability').Reaction
	): Stat | null {
		if (reaction === 'lunarCharged') return 'lunarChargedDmgBonus';
		if (reaction === 'lunarBloom') return 'lunarBloomDmgBonus';
		if (reaction === 'lunarCrystallize') return 'lunarCrystallizeDmgBonus';
		return null;
	}

	/** Converts an `elevate` effect into a synthesized `buff` effect for renderer
	 *  ingestion. Single-reaction elevations map to the matching `lunar*DmgBonus`
	 *  stat; multi-reaction elevations return null (not yet rendered). All other
	 *  effect types pass through unchanged. */
	function normalizeBuffLikeEffect(effect: Effect): Effect | null {
		if (effect.type !== 'elevate') return effect;
		if (effect.reactions.length !== 1) return null;
		const stat = elevateReactionToDisplayStat(effect.reactions[0]);
		if (!stat) return null;
		return {
			type: 'buff',
			target: effect.target,
			trigger: effect.trigger,
			conditions: effect.conditions,
			duration: effect.duration,
			durationType: effect.durationType,
			procCooldown: effect.procCooldown,
			attribution: effect.attribution,
			source: effect.source,
			stat,
			value: effect.value,
			snapshottable: effect.snapshottable
		};
	}

	/** Flat-maps a list of effects through `normalizeBuffLikeEffect`, dropping
	 *  unrenderable elevations. Applied at character-effect collection helpers
	 *  so downstream filter sites can keep their `effect.type === 'buff'`
	 *  shape unchanged. */
	function normalizeBuffLikeEffects(effects: Effect[]): Effect[] {
		const out: Effect[] = [];
		for (const e of effects) {
			const n = normalizeBuffLikeEffect(e);
			if (n) out.push(n);
		}
		return out;
	}

	/**
	 * Collects all effects from a character that fire on the given cast type.
	 * Walks the character's abilities, passives, and constellations — effects
	 * live on their source (the C1 buff lives on the C1 constellation, not on
	 * the burst it triggers off).
	 *
	 * Trigger matching:
	 *   - `trigger.type` must be `'onCast'`.
	 *   - If `trigger.ability` is set, it must equal `castType`.
	 *   - If absent and source is skill/burst, the source's own abilityType
	 *     is the implicit binding.
	 *   - If absent and source is passive/constellation, the effect fires on
	 *     any cast (matches both skill and burst) — e.g. Kazuha C6 infusion
	 *     triggers after either E or Q.
	 */
	function getCharacterEffectsForCast(char: CharacterData, castType: 'skill' | 'burst'): Effect[] {
		const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
		const result: Effect[] = [];
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.trigger.type !== 'onCast') continue;
				const explicit = fx.trigger.ability;
				if (explicit !== undefined) {
					if (explicit !== castType) continue;
				} else if (src.abilityType === 'skill' || src.abilityType === 'burst') {
					if (src.abilityType !== castType) continue;
				}
				// passive / constellation with no explicit ability → fire for both casts
				result.push(fx);
			}
		}
		return normalizeBuffLikeEffects(result);
	}

	/** Collects `onHit` effects whose abilityType matches the cast class. Accepts
	 *  any of the five canonical classes — skill/burst (cast loops) and
	 *  normal/charged/plunge (input-block loops, F2B). Mirrors
	 *  `getCharacterEffectsForCast`'s passive/constellation fall-through, but
	 *  ONLY for skill/burst — for N/CA/P, an effect must declare `abilityType`
	 *  explicitly (otherwise a passive's onHit-without-abilityType would
	 *  fire on every N hit too, almost always wrong).
	 *
	 *  The fine-grained `trigger.filter` (G primitive) is NOT applied here —
	 *  filter eval is per-cast/per-block against the resolved context. This
	 *  helper is purely the candidate-pool collector. */
	function getCharacterEffectsForOnHit(
		char: CharacterData,
		castType: 'skill' | 'burst' | 'normal' | 'charged' | 'plunge'
	): Effect[] {
		const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
		const result: Effect[] = [];
		const isInputClass = castType === 'normal' || castType === 'charged' || castType === 'plunge';
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.trigger.type !== 'onHit') continue;
				const explicit = fx.trigger.abilityType;
				if (explicit !== undefined) {
					if (explicit !== castType) continue;
				} else if (src.abilityType === 'skill' || src.abilityType === 'burst') {
					if (src.abilityType !== castType) continue;
				} else if (isInputClass) {
					// passive/constellation onHit with no abilityType → would over-fire
					// on every N/CA/P hit. Require explicit declaration.
					continue;
				}
				// passive / constellation, castType skill|burst → fire for both casts
				result.push(fx);
			}
		}
		return normalizeBuffLikeEffects(result);
	}

	/** Maps an input block to its damage-tag class (the `castType` slot used by
	 *  `getCharacterEffectsForOnHit` and `resolveBlockContext`). Movement and
	 *  unset blocks return null (no hit fires). */
	function getBlockDamageTag(block: InputBlock): 'normal' | 'charged' | 'plunge' | null {
		if (block.kind === 'movement' || block.kind === 'unset') return null;
		if (block.kind === 'skill' || block.kind === 'burst') return null;
		const part = block.parts[0] ?? '';
		if (/^[hl]?P$/.test(part)) return 'plunge';
		if (/^C/.test(part)) return 'charged';
		return 'normal';
	}

	/** Resolves the (ability, hit-name) pair backing an InputBlock so the G
	 *  filter can evaluate against the block's actual damageTag/element/name.
	 *  Mirrors `resolveCastContext` but for N/CA/P blocks.
	 *
	 *  - `damageTag` from `getBlockDamageTag(block)`.
	 *  - `element` from `block.kind`: 'elemental-normal' → char element;
	 *    'normal' → 'physical'. Approximation — doesn't track per-frame
	 *    infusion state (Yoimiya burst infusing N hits, Cyno-stance, etc.);
	 *    relies on the parser tagging infused N attacks with
	 *    `kind: "elemental-normal"`.
	 *  - `abilityName` includes the bow chargeHit-specific name when relevant
	 *    (Wreath Arrow at C/C2 for Tighnari, Shadowpiercing Shot for Sethos)
	 *    so `filter.abilityName: "Wreath Arrow"` matches via substring.
	 *  - `isCrit: true` for optimistic-fire (filter v1 caveat).
	 *  - `hitIndex` is left undefined (filter cases that need it — Chongyun C1
	 *    N4-only, Kokomi A4 N3-final — require parser-side hitIndex tracking
	 *    on the block, deferred). */
	function resolveBlockContext(
		char: CharacterData,
		block: InputBlock
	): TriggerFilterContext | null {
		const tag = getBlockDamageTag(block);
		if (!tag) return null;
		const ability = char.abilities.find((a) => a.abilityType === 'normal');
		if (!ability) return null;
		const element: TriggerFilterContext['element'] =
			block.kind === 'elemental-normal'
				? (char.element as TriggerFilterContext['element'])
				: 'physical';
		const part = block.parts[0] ?? '';
		let abilityName = ability.name;
		const chargeHits = (ability as { chargeHits?: { name?: string }[] }).chargeHits;
		if (tag === 'charged' && chargeHits?.length) {
			const idx = part === 'C1' ? 0 : chargeHits.length - 1;
			const hitName = chargeHits[idx]?.name;
			if (hitName) abilityName = `${ability.name} ${hitName}`;
		}
		return {
			damageTag: tag,
			element,
			abilityName,
			isCrit: true
		};
	}

	/** Resolves the (ability, variant) pair backing a TimelineBar so the
	 *  G filter can evaluate against the cast's actual damageTag/element/name.
	 *  Mirrors the resolution in `findCastSummon` — uses the unconditioned
	 *  base ability and looks up the variant by matching label against
	 *  variant.input. */
	function resolveCastContext(
		char: CharacterData | null | undefined,
		kind: 'skill' | 'burst',
		bar: TimelineBar
	): TriggerFilterContext | null {
		if (!char) return null;
		const candidates = char.abilities.filter((a) => a.abilityType === kind);
		const ability = candidates.find((a) => a.conditions === undefined) ?? candidates[0];
		if (!ability) return null;
		const variant = (
			ability as { variants?: { input?: string[]; label?: string; damageTag?: DamageTag }[] }
		).variants?.find((v) => (v.input as string[] | undefined)?.includes(bar.label));
		const damageTag = getDefaultDamageTag(ability, variant as never);
		const variantLabel = variant?.label ? ` ${variant.label}` : '';
		return {
			damageTag,
			element: char.element as TriggerFilterContext['element'],
			abilityName: `${ability.name}${variantLabel}`,
			// Skill/burst single-hit casts have no hit index; default isCrit
			// to true (treat skill/burst snapshot as "crits expected" for
			// optimistic-fire semantics on isCrit:true filters).
			isCrit: true
		};
	}

	/** Same shape as `getCharacterEffectsForCast` but matching `afterDuration` triggers.
	 *  Trigger matching mirrors `getCharacterEffectsForCast`: if `trigger.ability`
	 *  is set, it must equal `castType`; otherwise the source's `abilityType`
	 *  determines which host ability's duration binds the trigger. */
	function getCharacterEffectsForAfterDuration(
		char: CharacterData,
		castType: 'skill' | 'burst'
	): Effect[] {
		const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
		const result: Effect[] = [];
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.trigger.type !== 'afterDuration') continue;
				const explicit = fx.trigger.ability;
				if (explicit !== undefined) {
					if (explicit !== castType) continue;
				} else {
					if (src.abilityType !== castType) continue;
				}
				result.push(fx);
			}
		}
		return normalizeBuffLikeEffects(result);
	}

	/** Collects effects with `trigger.type === "onTeamNightsoulBurst"`. The trigger
	 *  is global (fires on every team NB event in `nbBars`), so there's no per-cast
	 *  filtering — just gather candidates. Source-agnostic; passives/constellations
	 *  carry these triggers in practice (Mavuika A1, Varesa A4, Xilonen A2, Ifa A1). */
	function getCharacterEffectsForTeamNightsoulBurst(char: CharacterData): Effect[] {
		const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
		const result: Effect[] = [];
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.trigger.type !== 'onTeamNightsoulBurst') continue;
				result.push(fx);
			}
		}
		return normalizeBuffLikeEffects(result);
	}

	/** Collects effects with `trigger.type === "onReaction"`. Source-agnostic;
	 *  walks the full effect surface (abilities + passives + constellations).
	 *  Pairs with the parser's `reactionEvents` stream — the dispatcher matches
	 *  each event against `trigger.reaction` and the effect's `conditions` per
	 *  cast at fire time. */
	function getCharacterEffectsForOnReaction(char: CharacterData): Effect[] {
		const sources = [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])];
		const result: Effect[] = [];
		for (const src of sources) {
			for (const fx of src.effects ?? []) {
				if (fx.trigger.type !== 'onReaction') continue;
				result.push(fx);
			}
		}
		return normalizeBuffLikeEffects(result);
	}

	function computeTeamBuffRows(
		tracks: CharacterTrack[],
		constellationLevels: Record<string, number>,
		loadoutMap: Record<string, LoadoutEntry>,
		teamFactionCounts: ReadonlyMap<string, number>,
		teamElementCountsByHolder: ReadonlyMap<
			string,
			ReadonlyMap<import('$lib/types/ability').Element, number>
		>,
		nbBars: ReadonlyArray<{ start: number; cooldown: number }>,
		reactionEvents: ReadonlyArray<{
			characterId: string;
			reaction: Reaction;
			time: number;
			castKind: 'skill' | 'burst';
		}>
	): Array<TeamBuffSubrow & { key: string }> {
		const rowMap = new SvelteMap<string, TeamBuffSubrow>();

		// Characters that already had their character-scoped (rotation-wide
		// event pool) dispatches run. NB / onReaction pools are filtered by
		// characterId only — never by track — so running them once per TRACK
		// duplicates every bar when a character appears in multiple segments.
		const dispatchedCharScoped = new SvelteSet<string>();

		for (const track of tracks) {
			const char = getLoadedCharacter(track.characterId);
			if (!char) continue;
			const firstTrackOfChar = !dispatchedCharScoped.has(track.characterId);
			dispatchedCharScoped.add(track.characterId);

			// Per-holder context: teamFactionCounts stays whole-team (matches
			// teamFaction semantic), teamElementCounts narrows to this holder's
			// non-self count map.
			const baseCtx: ConditionContext = {
				teamFactionCounts,
				teamElementCounts: teamElementCountsByHolder.get(char.id)
			};

			const cLevel = constellationLevels[track.characterId] ?? 0;

			// ── resShred (debuff) shared helpers — used by every dispatch site below ──
			// Common base filter for `target: enemy` resShred effects; returns true
			// when type/target/duration match and base conditions resolve true (or
			// null). Per-bar conditions and onHit filter are layered at each call site.
			const resShredBase = (effect: Effect): effect is ResShredEffect => {
				if (effect.type !== 'resShred') return false;
				if (!targetsEnemy(effect.target)) return false;
				if (effect.duration == null) return false;
				if (
					evalCondition(
						effect.conditions,
						4,
						new SvelteSet(),
						cLevel,
						undefined,
						undefined,
						baseCtx
					) === false
				)
					return false;
				return true;
			};
			// Dedup by element (`_all` for unspecified) so multiple sources of the
			// same element shred collapse to a single bar. First-declared wins.
			const dedupResShredByElement = (pool: ResShredEffect[]): ResShredEffect[] => {
				const seen = new SvelteSet<string>();
				return pool.filter((e) => {
					const k = e.element ?? '_all';
					if (seen.has(k)) return false;
					seen.add(k);
					return true;
				});
			};

			// ── Character cast effects (onCast) — source-grouped by ability ──
			// Effects are sourced from the character's full effect surface (abilities +
			// passives + constellations) so that buffs declared on a constellation node
			// (e.g. Bennett C1) attach to the timeline bar of the cast they trigger off.
			const castPairs: Array<['skill' | 'burst', TimelineBar[], string]> = [
				['skill', track.eBars, 'E'],
				['burst', track.qBars, 'Q']
			];

			for (const [castType, abBars, abLabel] of castPairs) {
				const castEffects = getCharacterEffectsForCast(char, castType);
				const onHitEffects = getCharacterEffectsForOnHit(char, castType);
				const afterDurationEffects = getCharacterEffectsForAfterDuration(char, castType);

				// ── onCast + onHit effects (combined pool) ──
				// onHit triggers are filtered per-bar via evalTriggerFilter
				// against the cast's resolved (ability, variant) context.
				// onCast effects always pass that filter (their trigger has no
				// `filter` field). Dedup-by-stat prefers onCast over onHit when
				// both fire on the same stat (declaration order in the merged
				// pool: onCast first).
				const universalPool = (effect: Effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (!targetsTeamOrActive(effect.target)) return false;
					if (isActiveTargetOnly(effect.target)) return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							new SvelteSet(),
							cLevel,
							undefined,
							undefined,
							baseCtx
						) === false
					)
						return false;
					return true;
				};
				const seenStats = new SvelteSet<string>();
				const qualifiedEffects = [...castEffects, ...onHitEffects]
					.filter(universalPool)
					.filter((effect) => {
						if (seenStats.has(effect.stat)) return false;
						seenStats.add(effect.stat);
						return true;
					});
				if (qualifiedEffects.length > 0) {
					const rowKey = `${track.characterId}::char::${abLabel}`;
					const sourceLabel = `${char.displayName} ${abLabel}`;

					for (const bar of abBars) {
						const filterCtx = resolveCastContext(char, castType, bar);
						// Per-cast filter chain:
						//   1. evalCondition with bar.stackContext (drops stack-gated)
						//   2. evalTriggerFilter for onHit triggers (G primitive)
						const barEffects = qualifiedEffects.filter((effect) => {
							if (
								evalCondition(
									effect.conditions,
									4,
									new SvelteSet(),
									cLevel,
									undefined,
									bar.stackContext,
									baseCtx
								) === false
							) {
								return false;
							}
							if (effect.trigger.type === 'onHit' && filterCtx) {
								if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
							}
							return true;
						});
						if (barEffects.length === 0) continue;
						const buffStart = bar.start + (bar.summonActivatesAt ?? 0) / 60;
						const buffEnd = buffStart + barEffects[0].duration!;
						const effects: MergedEffectDisplay[] = barEffects.map((e) => ({
							stat: e.stat,
							displayValue: formatBuffDisplayValue(
								e.stat,
								e.value,
								0,
								bar.stackContext,
								canonicalHeadlineOf(e)
							)
						}));
						const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
						const primaryStat = barEffects[0].stat;
						const existing = rowMap.get(rowKey);
						if (existing) {
							existing.bars.push(buffBar);
						} else {
							rowMap.set(rowKey, {
								characterId: track.characterId,
								primaryStat,
								bars: [buffBar],
								sourceLabel
							});
						}
					}
				}

				// ── afterDuration effects — buff fires when ability duration ends ──
				const seenStatsAfter = new SvelteSet<string>();
				const qualifiedEffectsAfter = afterDurationEffects.filter(
					(effect): effect is BuffEffect => {
						if (effect.type !== 'buff') return false;
						if (!targetsTeamOrActive(effect.target)) return false;
						if (isActiveTargetOnly(effect.target)) return false;
						if (effect.duration == null) return false;
						if (
							evalCondition(
								effect.conditions,
								4,
								new SvelteSet(),
								cLevel,
								undefined,
								undefined,
								baseCtx
							) === false
						)
							return false;
						if (seenStatsAfter.has(effect.stat)) return false;
						seenStatsAfter.add(effect.stat);
						return true;
					}
				);
				if (qualifiedEffectsAfter.length > 0) {
					const attribution = qualifiedEffectsAfter[0].attribution;
					const rowKey = `${track.characterId}::char::${abLabel}::afterDuration`;
					const sourceLabel = attribution
						? `${char.displayName} ${attribution}`
						: `${char.displayName} ${abLabel} (end)`;

					for (const bar of abBars) {
						const barEffects = qualifiedEffectsAfter.filter(
							(effect) =>
								evalCondition(
									effect.conditions,
									4,
									new SvelteSet(),
									cLevel,
									undefined,
									bar.stackContext,
									baseCtx
								) !== false
						);
						if (barEffects.length === 0) continue;
						const buffStart = bar.start + bar.uptime;
						const buffEnd = buffStart + barEffects[0].duration!;
						const effects: MergedEffectDisplay[] = barEffects.map((e) => ({
							stat: e.stat,
							displayValue: formatBuffDisplayValue(
								e.stat,
								e.value,
								0,
								bar.stackContext,
								canonicalHeadlineOf(e)
							)
						}));
						const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
						const primaryStat = barEffects[0].stat;
						const existing = rowMap.get(rowKey);
						if (existing) {
							existing.bars.push(buffBar);
						} else {
							rowMap.set(rowKey, {
								characterId: track.characterId,
								primaryStat,
								bars: [buffBar],
								sourceLabel
							});
						}
					}
				}

				// ── resShred (debuff) dispatch — onCast + onHit + afterDuration ──
				// Mirrors the buff blocks above but for `target: enemy` resShred
				// effects. onCast/onHit fire at cast start (the `summonActivatesAt`
				// offset preserved); afterDuration fires at cast end (`bar.uptime`).
				const resShredStartPool = dedupResShredByElement(
					[...castEffects, ...onHitEffects].filter(resShredBase)
				);
				if (resShredStartPool.length > 0) {
					const rowKey = `${track.characterId}::char::${abLabel}::resShred`;
					const sourceLabel = `${char.displayName} ${abLabel}`;
					const primaryStat = resShredDisplayStat(resShredStartPool[0].element);
					for (const bar of abBars) {
						const filterCtx = resolveCastContext(char, castType, bar);
						const barEffects = resShredStartPool.filter((effect) => {
							if (
								evalCondition(
									effect.conditions,
									4,
									new SvelteSet(),
									cLevel,
									undefined,
									bar.stackContext,
									baseCtx
								) === false
							)
								return false;
							if (effect.trigger.type === 'onHit' && filterCtx) {
								if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
							}
							return true;
						});
						if (barEffects.length === 0) continue;
						const buffStart = bar.start + (bar.summonActivatesAt ?? 0) / 60;
						const buffEnd = buffStart + barEffects[0].duration!;
						const effects: MergedEffectDisplay[] = barEffects.map((e) => ({
							stat: resShredDisplayStat(e.element),
							displayValue: formatResShredDisplayValue(e.value)
						}));
						const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
						const existing = rowMap.get(rowKey);
						if (existing) {
							existing.bars.push(buffBar);
						} else {
							rowMap.set(rowKey, {
								characterId: track.characterId,
								primaryStat,
								bars: [buffBar],
								sourceLabel,
								kind: 'debuff'
							});
						}
					}
				}
				const resShredEndPool = dedupResShredByElement(afterDurationEffects.filter(resShredBase));
				if (resShredEndPool.length > 0) {
					const rowKey = `${track.characterId}::char::${abLabel}::afterDuration::resShred`;
					const sourceLabel = `${char.displayName} ${abLabel} (end)`;
					const primaryStat = resShredDisplayStat(resShredEndPool[0].element);
					for (const bar of abBars) {
						const buffStart = bar.start + bar.uptime;
						const buffEnd = buffStart + resShredEndPool[0].duration!;
						const effects: MergedEffectDisplay[] = resShredEndPool.map((e) => ({
							stat: resShredDisplayStat(e.element),
							displayValue: formatResShredDisplayValue(e.value)
						}));
						const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
						const existing = rowMap.get(rowKey);
						if (existing) {
							existing.bars.push(buffBar);
						} else {
							rowMap.set(rowKey, {
								characterId: track.characterId,
								primaryStat,
								bars: [buffBar],
								sourceLabel,
								kind: 'debuff'
							});
						}
					}
				}
			}

			// ── N/CA/P onHit effects (input-block class — F2B) ──
			// Mirrors the cast loop above but iterates `track.inputBlocks`. No
			// onCast pool (onCast doesn't fire on N/CA/P). Stack context is not
			// carried on InputBlock — stack-gated effects with `conditions.type:
			// "stacks"` would be excluded; rare for N/CA/P onHit, defer if needed.
			const blockClassPairs: Array<['normal' | 'charged' | 'plunge', string]> = [
				['normal', 'N'],
				['charged', 'CA'],
				['plunge', 'P']
			];
			for (const [blockClass, blockLabel] of blockClassPairs) {
				const onHitBlockEffects = getCharacterEffectsForOnHit(char, blockClass);
				if (onHitBlockEffects.length === 0) continue;
				const seenStats = new SvelteSet<string>();
				const qualifiedEffects = onHitBlockEffects
					.filter((effect): effect is BuffEffect => {
						if (effect.type !== 'buff') return false;
						if (!targetsTeamOrActive(effect.target)) return false;
						if (isActiveTargetOnly(effect.target)) return false;
						if (effect.duration == null) return false;
						if (
							evalCondition(
								effect.conditions,
								4,
								new SvelteSet(),
								cLevel,
								undefined,
								undefined,
								baseCtx
							) === false
						)
							return false;
						return true;
					})
					.filter((effect) => {
						if (seenStats.has(effect.stat)) return false;
						seenStats.add(effect.stat);
						return true;
					});
				if (qualifiedEffects.length > 0) {
					const rowKey = `${track.characterId}::char::${blockLabel}`;
					const sourceLabel = `${char.displayName} ${blockLabel}`;
					for (const block of track.inputBlocks) {
						if (getBlockDamageTag(block) !== blockClass) continue;
						const filterCtx = resolveBlockContext(char, block);
						const barEffects = qualifiedEffects.filter((effect) => {
							if (
								evalCondition(
									effect.conditions,
									4,
									new SvelteSet(),
									cLevel,
									undefined,
									undefined,
									baseCtx
								) === false
							) {
								return false;
							}
							if (effect.trigger.type === 'onHit' && filterCtx) {
								if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
							}
							return true;
						});
						if (barEffects.length === 0) continue;
						const buffStart = block.start + block.duration;
						const buffEnd = buffStart + barEffects[0].duration!;
						const effects: MergedEffectDisplay[] = barEffects.map((e) => ({
							stat: e.stat,
							displayValue: formatBuffDisplayValue(
								e.stat,
								e.value,
								0,
								undefined,
								canonicalHeadlineOf(e)
							)
						}));
						const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
						const primaryStat = barEffects[0].stat;
						const existing = rowMap.get(rowKey);
						if (existing) {
							existing.bars.push(buffBar);
						} else {
							rowMap.set(rowKey, {
								characterId: track.characterId,
								primaryStat,
								bars: [buffBar],
								sourceLabel
							});
						}
					}
				}

				// ── resShred (debuff) dispatch on N/CA/P input blocks ──
				// Mirrors the buff block above for `target: enemy` resShred effects.
				const resShredBlockPool = dedupResShredByElement(onHitBlockEffects.filter(resShredBase));
				if (resShredBlockPool.length > 0) {
					const rowKey = `${track.characterId}::char::${blockLabel}::resShred`;
					const sourceLabel = `${char.displayName} ${blockLabel}`;
					const primaryStat = resShredDisplayStat(resShredBlockPool[0].element);
					for (const block of track.inputBlocks) {
						if (getBlockDamageTag(block) !== blockClass) continue;
						const filterCtx = resolveBlockContext(char, block);
						const barEffects = resShredBlockPool.filter((effect) => {
							if (
								evalCondition(
									effect.conditions,
									4,
									new SvelteSet(),
									cLevel,
									undefined,
									undefined,
									baseCtx
								) === false
							)
								return false;
							if (effect.trigger.type === 'onHit' && filterCtx) {
								if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
							}
							return true;
						});
						if (barEffects.length === 0) continue;
						const buffStart = block.start + block.duration;
						const buffEnd = buffStart + barEffects[0].duration!;
						const effects: MergedEffectDisplay[] = barEffects.map((e) => ({
							stat: resShredDisplayStat(e.element),
							displayValue: formatResShredDisplayValue(e.value)
						}));
						const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
						const existing = rowMap.get(rowKey);
						if (existing) {
							existing.bars.push(buffBar);
						} else {
							rowMap.set(rowKey, {
								characterId: track.characterId,
								primaryStat,
								bars: [buffBar],
								sourceLabel,
								kind: 'debuff'
							});
						}
					}
				}
			}

			// ── onTeamNightsoulBurst effects — fire once per nbBars event ──
			// Global team event: emits buff bars regardless of which character is on
			// field at the NB event time. Stack-context isn't carried (no host cast),
			// so stack-gated effects with `conditions.type: "stacks"` resolve null
			// (preserved into render — they fall back to the placeholder).
			const nbEffects = getCharacterEffectsForTeamNightsoulBurst(char);
			if (firstTrackOfChar && nbBars.length > 0 && nbEffects.length > 0) {
				const seenStatsNB = new SvelteSet<string>();
				const qualifiedEffectsNB = nbEffects.filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (!targetsTeamOrActive(effect.target)) return false;
					if (isActiveTargetOnly(effect.target)) return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							new SvelteSet(),
							cLevel,
							undefined,
							undefined,
							baseCtx
						) === false
					)
						return false;
					if (seenStatsNB.has(effect.stat)) return false;
					seenStatsNB.add(effect.stat);
					return true;
				});
				if (qualifiedEffectsNB.length > 0) {
					const rowKey = `${track.characterId}::char::NB`;
					const sourceLabel = `${char.displayName} NB`;
					for (const nb of nbBars) {
						const buffStart = nb.start;
						const buffEnd = buffStart + qualifiedEffectsNB[0].duration!;
						const effects: MergedEffectDisplay[] = qualifiedEffectsNB.map((e) => ({
							stat: e.stat,
							displayValue: formatBuffDisplayValue(
								e.stat,
								e.value,
								0,
								undefined,
								canonicalHeadlineOf(e)
							)
						}));
						const buffBar: TeamBuffBar = { start: buffStart, end: buffEnd, effects };
						const primaryStat = qualifiedEffectsNB[0].stat;
						const existing = rowMap.get(rowKey);
						if (existing) {
							existing.bars.push(buffBar);
						} else {
							rowMap.set(rowKey, {
								characterId: track.characterId,
								primaryStat,
								bars: [buffBar],
								sourceLabel
							});
						}
					}
				}
			}

			// ── Artifact 4pc effects (onCast only) — source-grouped by artifact ──
			const artifactSetId = loadoutMap[track.characterId]?.artifactSetId;
			// Persisted loadout ids are unvalidated — tolerate a stale/unknown id
			// instead of crashing the teamBuffRows derived.
			const artifactSet = artifactSetId ? getArtifactSetById(artifactSetId) : null;
			if (artifactSet) {
				const allEffects = artifactSet.fourPiece?.effects ?? [];

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

				const sourceLabel = artifactSet.shortName ?? artifactSet.name;

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
								displayValue: formatBuffDisplayValue(
									e.stat,
									e.value,
									0,
									bar.stackContext,
									canonicalHeadlineOf(e)
								)
							}));
							const buffBar: TeamBuffBar = {
								start: buffStart,
								end: buffEnd,
								effects: mergedEffects
							};
							const existing = rowMap.get(rowKey);
							if (existing) {
								existing.bars.push(buffBar);
							} else {
								rowMap.set(rowKey, {
									characterId: track.characterId,
									primaryStat,
									bars: [buffBar],
									sourceLabel
								});
							}
						}
					}
				}

				// ── Artifact 4pc onReaction effects (E3 v1.5 + resShred) ──
				// Driven by the parser's synthetic reaction events. Each event
				// fires a bar at the cast time for `effect.duration`s. Multiple
				// matching events refresh-in-place by appending bars; the
				// renderer's bar-merging logic dedups overlap automatically.
				// Buff bars + resShred (debuff) bars share this dispatch site;
				// resShred uses a synthetic `${element}Res` stat for icon/label
				// lookup and renders with the debuff treatment.
				const artifactOnReactionEffects = allEffects.filter(
					(e): e is BuffEffect | ResShredEffect =>
						(e.type === 'buff' && targetsTeamOrActive(e.target)) ||
						(e.type === 'resShred' && targetsEnemy(e.target))
				);
				const artifactOnReactionFiltered = artifactOnReactionEffects.filter(
					(e) => e.trigger.type === 'onReaction' && e.duration != null
				);
				if (firstTrackOfChar && artifactOnReactionFiltered.length > 0) {
					const charReactionEvents = reactionEvents.filter(
						(ev) => ev.characterId === track.characterId
					);
					for (const effect of artifactOnReactionFiltered) {
						const trigReaction = (effect.trigger as { reaction: Reaction | Reaction[] | 'any' })
							.reaction;
						const matches = (r: Reaction): boolean =>
							trigReaction === 'any' ||
							(Array.isArray(trigReaction) ? trigReaction.includes(r) : trigReaction === r);
						const isDebuff = effect.type === 'resShred';
						const displayStat = isDebuff ? resShredDisplayStat(effect.element) : effect.stat;
						const displayValue = isDebuff
							? formatResShredDisplayValue(effect.value)
							: formatBuffDisplayValue(
									effect.stat,
									effect.value,
									0,
									undefined,
									canonicalHeadlineOf(effect)
								);
						const rowKey = `${track.characterId}::artifact::${artifactSetId}::onReaction::${displayStat}`;
						for (const ev of charReactionEvents) {
							if (!matches(ev.reaction)) continue;
							const buffStart = ev.time;
							const buffEnd = buffStart + effect.duration!;
							const buffBar: TeamBuffBar = {
								start: buffStart,
								end: buffEnd,
								effects: [{ stat: displayStat, displayValue }]
							};
							const existing = rowMap.get(rowKey);
							if (existing) {
								existing.bars.push(buffBar);
							} else {
								rowMap.set(rowKey, {
									characterId: track.characterId,
									primaryStat: displayStat,
									bars: [buffBar],
									sourceLabel,
									kind: isDebuff ? 'debuff' : 'buff'
								});
							}
						}
					}
				}
			}

			// ── Character onReaction effects (E3 v1.5 — buff + resShred) ──
			// Same reaction-event stream that drives the artifact onReaction
			// pass above; here we walk the character's full effect surface
			// (abilities + passives + constellations) for `onReaction` triggers.
			// Unblocks Chevreuse C overload, Citlali Ks/melt-frozen, Durin
			// overload, Nilou bloom (resShred); Kazuha A4 / Sucrose A4 / Baizhu /
			// Tighnari / Fischl / Freminet / Varka onReaction buffs; Linnea C1
			// Field Catalog consumer (uses `trigger.source: 'team'` to fire on
			// any teammate's lunarCrystallize, not just Linnea's own).
			const onReactionEffects = getCharacterEffectsForOnReaction(char);
			if (firstTrackOfChar && onReactionEffects.length > 0) {
				const ownReactionEvents = reactionEvents.filter(
					(ev) => ev.characterId === track.characterId
				);
				const qualified = onReactionEffects.filter((e): e is BuffEffect | ResShredEffect => {
					if (e.type === 'buff') {
						if (!targetsTeamOrActive(e.target)) return false;
						if (isActiveTargetOnly(e.target)) return false;
					} else if (e.type === 'resShred') {
						if (!targetsEnemy(e.target)) return false;
					} else {
						return false;
					}
					if (e.duration == null) return false;
					if (
						evalCondition(
							e.conditions,
							4,
							new SvelteSet(),
							cLevel,
							undefined,
							undefined,
							baseCtx
						) === false
					)
						return false;
					return true;
				});
				for (const effect of qualified) {
					const trig = effect.trigger as {
						reaction: Reaction | Reaction[] | 'any';
						source?: 'self' | 'team';
					};
					const trigReaction = trig.reaction;
					const matches = (r: Reaction): boolean =>
						trigReaction === 'any' ||
						(Array.isArray(trigReaction) ? trigReaction.includes(r) : trigReaction === r);
					// `source: 'team'` opts into firing on any team member's matching
					// reaction (Linnea C1 Field Catalog consumer). Default `'self'`
					// keeps the holder-only scoping that Kazuha A4 / Sucrose A4 etc.
					// rely on.
					const eventPool = trig.source === 'team' ? reactionEvents : ownReactionEvents;
					const isDebuff = effect.type === 'resShred';
					const displayStat = isDebuff ? resShredDisplayStat(effect.element) : effect.stat;
					const displayValue = isDebuff
						? formatResShredDisplayValue(effect.value)
						: formatBuffDisplayValue(
								effect.stat,
								effect.value,
								0,
								undefined,
								canonicalHeadlineOf(effect)
							);
					const rowKey = `${track.characterId}::char::onReaction::${displayStat}`;
					const sourceLabel = `${char.displayName} reaction`;
					for (const ev of eventPool) {
						if (!matches(ev.reaction)) continue;
						const buffStart = ev.time;
						const buffEnd = buffStart + effect.duration!;
						const buffBar: TeamBuffBar = {
							start: buffStart,
							end: buffEnd,
							effects: [{ stat: displayStat, displayValue }]
						};
						const existing = rowMap.get(rowKey);
						if (existing) {
							existing.bars.push(buffBar);
						} else {
							rowMap.set(rowKey, {
								characterId: track.characterId,
								primaryStat: displayStat,
								bars: [buffBar],
								sourceLabel,
								kind: isDebuff ? 'debuff' : 'buff'
							});
						}
					}
				}
			}
		}

		// Carry the rowMap dedup key (unique by construction) onto each row so the
		// keyed {#each} in the template renders with that exact identity. Deriving
		// the each-key from coarser fields (characterId + sourceLabel) collides
		// whenever one character yields multiple rows under one label — e.g.
		// Chevreuse's A4 emits both a Pyro- and an Electro-RES shred on Overloaded,
		// two distinct rows sharing the label "Chevreuse reaction" → Svelte
		// each_key_duplicate (freezes the tool).
		return [...rowMap].map(([key, row]) => ({ ...row, key }));
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
			rotation.reactionEvents
		)
	);

	type WeaponProcSubrow = {
		characterId: string;
		label: string;
		bars: Array<{ start: number; end: number }>;
	};
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
	type RampParams = { startValue: number; stepValue: number; stepInterval: number; cap?: number };
	type DecayParams = { startValue: number; endValue: number; duration: number };
	type CharReceivedBuffBar = {
		start: number;
		end: number;
		primaryStat: Stat;
		effects: MergedEffectDisplay[];
		sourceLabel: string;
		isMutuallyExclusive: boolean;
		procCooldown?: number;
		duration: number;
		buffStart?: number; // set when rampParams or decayParams is present, for gradient offset
		rampParams?: RampParams;
		decayParams?: DecayParams;
	};
	type CharReceivedBuffSubrow = {
		characterId: string;
		sourceLabel: string;
		primaryStat: Stat;
		bars: CharReceivedBuffBar[];
	};
	let charReceivedBuffRows = $derived.by((): CharReceivedBuffSubrow[] => {
		const rowMap = new SvelteMap<string, CharReceivedBuffSubrow>();
		const procReadyAt = new SvelteMap<string, number>();
		const tracks = rotation.tracks;
		const baseCtx: ConditionContext = { teamFactionCounts };

		function addBar(receiverId: string, bar: CharReceivedBuffBar) {
			const key = `${receiverId}::${bar.sourceLabel}`;
			const existing = rowMap.get(key);
			if (existing) {
				existing.bars.push(bar);
			} else {
				rowMap.set(key, {
					characterId: receiverId,
					sourceLabel: bar.sourceLabel,
					primaryStat: bar.primaryStat,
					bars: [bar]
				});
			}
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
				const icd =
					rawIcd == null
						? 0
						: typeof rawIcd === 'number'
							? rawIcd
							: rawIcd.refinementValues[refinementIndex];
				const procReady = procReadyAt.get(icdKey) ?? 0;
				if (swapTime < procReady) continue;
				procReadyAt.set(icdKey, swapTime + icd);

				addBar(receiverId, {
					start: swapTime,
					end: swapTime + first.duration!,
					primaryStat: first.stat,
					effects: effects.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(
							e.stat,
							e.value,
							refinementIndex,
							undefined,
							canonicalHeadlineOf(e)
						)
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
			// Consecutive segments of the SAME character are one continuous field
			// presence, not a swap (the parser emits one track per notation
			// segment) — no swap-triggered procs fire and no proc ICD is consumed.
			// Same rule the swap connectors already apply.
			if (track.characterId === nextTrack.characterId) continue;
			const swapTime = nextTrack.activeStart;

			// onSwapOut: outgoing character's weapon → buff to incoming character (e.g. TTDS)
			const outEntry = effectiveLoadout[track.characterId];
			const outWeapon = outEntry?.weaponId ? getWeaponById(outEntry.weaponId) : null;
			processWeaponEffects(
				'onSwapOut',
				outWeapon,
				(outEntry?.weaponRefinement ?? 1) - 1,
				nextTrack.characterId,
				track.characterId,
				swapTime
			);

			// onSwapIn: incoming character's weapon → buff to themselves (e.g. The Widsith)
			const inEntry = effectiveLoadout[nextTrack.characterId];
			const inWeapon = inEntry?.weaponId ? getWeaponById(inEntry.weaponId) : null;
			processWeaponEffects(
				'onSwapIn',
				inWeapon,
				(inEntry?.weaponRefinement ?? 1) - 1,
				nextTrack.characterId,
				nextTrack.characterId,
				swapTime
			);
		}

		// ── Active-target ability buff segmentation ──
		// Effects with target: "active" skip the team buff row and are sliced per on-field window.
		// Each source ability's buff window is intersected with every track's [activeStart, activeEnd].
		for (const sourceTrack of tracks) {
			const char = getLoadedCharacter(sourceTrack.characterId);
			if (!char) continue;
			const cLevel = $constellations[sourceTrack.characterId] ?? 0;

			const castPairs: Array<['skill' | 'burst', TimelineBar[], string]> = [
				['skill', sourceTrack.eBars, 'E'],
				['burst', sourceTrack.qBars, 'Q']
			];

			for (const [castType, abBars, abLabel] of castPairs) {
				const onCastList = getCharacterEffectsForCast(char, castType);
				const onHitList = getCharacterEffectsForOnHit(char, castType);
				const seenStats = new SvelteSet<string>();
				const activeEffects = [...onCastList, ...onHitList].filter(
					(effect): effect is BuffEffect => {
						if (effect.type !== 'buff') return false;
						if (!isActiveTargetOnly(effect.target)) return false;
						if (effect.duration == null) return false;
						// Universal pre-filter: only drop effects that are *definitively*
						// false at this scope (no segment context yet, so off-field
						// conditions stay null and survive into per-segment evaluation).
						if (
							evalCondition(
								effect.conditions,
								4,
								new SvelteSet(),
								cLevel,
								undefined,
								undefined,
								baseCtx
							) === false
						)
							return false;
						if (seenStats.has(effect.stat)) return false;
						seenStats.add(effect.stat);
						return true;
					}
				);
				if (activeEffects.length === 0) continue;

				const sourceLabel = `${char.displayName} ${abLabel}`;

				for (const abBar of abBars) {
					const filterCtx = resolveCastContext(char, castType, abBar);
					// Per-cast filter: stack-gated effects against bar.stackContext +
					// onHit-trigger filter eval (G primitive).
					const barEffects = activeEffects.filter((effect) => {
						if (
							evalCondition(
								effect.conditions,
								4,
								new SvelteSet(),
								cLevel,
								undefined,
								abBar.stackContext,
								baseCtx
							) === false
						)
							return false;
						if (effect.trigger.type === 'onHit' && filterCtx) {
							if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
						}
						return true;
					});
					if (barEffects.length === 0) continue;
					const primaryStat = barEffects[0].stat;
					const mergedEffects: MergedEffectDisplay[] = barEffects.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(
							e.stat,
							e.value,
							0,
							abBar.stackContext,
							canonicalHeadlineOf(e)
						)
					}));
					const firstValue = barEffects[0].value;
					const rampParams: RampParams | undefined =
						typeof firstValue === 'object' && 'type' in firstValue && firstValue.type === 'ramping'
							? {
									startValue: firstValue.startValue,
									stepValue: firstValue.stepValue,
									stepInterval: firstValue.stepInterval,
									cap: firstValue.cap
								}
							: undefined;
					const decayParams: DecayParams | undefined =
						typeof firstValue === 'object' && 'type' in firstValue && firstValue.type === 'decaying'
							? {
									startValue: firstValue.startValue,
									endValue: firstValue.endValue ?? 0,
									duration: barEffects[0].duration!
								}
							: undefined;
					const buffStart = abBar.start + (abBar.summonActivatesAt ?? 0) / 60;
					const buffEnd = buffStart + barEffects[0].duration!;

					// Collect all segments (one per on-field window that overlaps the buff).
					// Tracks are chronological, so segments are naturally ordered by segStart.
					const segments: Array<{ receiverId: string; segStart: number; segEnd: number }> = [];
					for (const receiverTrack of tracks) {
						const segStart = Math.max(buffStart, receiverTrack.activeStart);
						const segEnd = Math.min(buffEnd, receiverTrack.activeEnd);
						if (segEnd <= segStart) continue;
						segments.push({ receiverId: receiverTrack.characterId, segStart, segEnd });
					}

					for (let si = 0; si < segments.length; si++) {
						const { receiverId, segStart, segEnd } = segments[si];
						const isLast = si === segments.length - 1;

						// Per-segment off-field gating: when the receiver IS the source
						// character, the source is on-field; otherwise off-field. Inject
						// the affirmative state into resolvedStates and the inverse into
						// negatedStates so `state: "offField"` (and onField) resolve
						// definitively for this segment. Effects with such conditions
						// that resolve to false are dropped from the segment's bar.
						const sourceIsActive = receiverId === sourceTrack.characterId;
						const segResolved = new SvelteSet<string>([sourceIsActive ? 'onField' : 'offField']);
						const segNegated = new SvelteSet<string>([sourceIsActive ? 'offField' : 'onField']);
						const receiverChar = getLoadedCharacter(receiverId);
						const activeCharFactions = new SvelteSet<string>(receiverChar?.factions ?? []);
						const segCtx: ConditionContext = {
							teamFactionCounts,
							negatedStates: segNegated,
							activeCharFactions
						};

						const segEffects = barEffects.filter(
							(effect) =>
								evalCondition(
									effect.conditions,
									4,
									segResolved,
									cLevel,
									undefined,
									abBar.stackContext,
									segCtx
								) !== false
						);
						if (segEffects.length === 0) continue;

						const segMergedEffects: MergedEffectDisplay[] = segEffects.map((e) => ({
							stat: e.stat,
							displayValue: formatBuffDisplayValue(
								e.stat,
								e.value,
								0,
								abBar.stackContext,
								canonicalHeadlineOf(e)
							)
						}));
						const segPrimaryStat = segEffects[0].stat;
						// If the per-segment filter didn't drop anything, use the merged
						// pre-segment effect list for visual consistency. Otherwise the
						// segment-specific list (which may be a subset).
						const useSegList = segEffects.length !== barEffects.length;

						addBar(receiverId, {
							start: segStart,
							end: isLast ? buffEnd : segEnd,
							primaryStat: useSegList ? segPrimaryStat : primaryStat,
							effects: useSegList ? segMergedEffects : mergedEffects,
							sourceLabel,
							isMutuallyExclusive: false,
							duration: buffEnd - buffStart,
							...(rampParams ? { buffStart, rampParams } : {}),
							...(decayParams ? { buffStart, decayParams } : {})
						});
					}
				}
			}

			// ── N/CA/P onHit active-target effects (input-block class — F2B) ──
			const blockClassPairs: Array<['normal' | 'charged' | 'plunge', string]> = [
				['normal', 'N'],
				['charged', 'CA'],
				['plunge', 'P']
			];
			for (const [blockClass, blockLabel] of blockClassPairs) {
				const onHitBlockList = getCharacterEffectsForOnHit(char, blockClass);
				if (onHitBlockList.length === 0) continue;
				const seenStats = new SvelteSet<string>();
				const activeEffects = onHitBlockList.filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (!isActiveTargetOnly(effect.target)) return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							new SvelteSet(),
							cLevel,
							undefined,
							undefined,
							baseCtx
						) === false
					)
						return false;
					if (seenStats.has(effect.stat)) return false;
					seenStats.add(effect.stat);
					return true;
				});
				if (activeEffects.length === 0) continue;
				const sourceLabel = `${char.displayName} ${blockLabel}`;
				for (const block of sourceTrack.inputBlocks) {
					if (getBlockDamageTag(block) !== blockClass) continue;
					const filterCtx = resolveBlockContext(char, block);
					const barEffects = activeEffects.filter((effect) => {
						if (
							evalCondition(
								effect.conditions,
								4,
								new SvelteSet(),
								cLevel,
								undefined,
								undefined,
								baseCtx
							) === false
						)
							return false;
						if (effect.trigger.type === 'onHit' && filterCtx) {
							if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
						}
						return true;
					});
					if (barEffects.length === 0) continue;
					const primaryStat = barEffects[0].stat;
					const mergedEffects: MergedEffectDisplay[] = barEffects.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(
							e.stat,
							e.value,
							0,
							undefined,
							canonicalHeadlineOf(e)
						)
					}));
					const buffStart = block.start + block.duration;
					const buffEnd = buffStart + barEffects[0].duration!;
					const segments: Array<{ receiverId: string; segStart: number; segEnd: number }> = [];
					for (const receiverTrack of tracks) {
						const segStart = Math.max(buffStart, receiverTrack.activeStart);
						const segEnd = Math.min(buffEnd, receiverTrack.activeEnd);
						if (segEnd <= segStart) continue;
						segments.push({ receiverId: receiverTrack.characterId, segStart, segEnd });
					}
					for (let si = 0; si < segments.length; si++) {
						const { receiverId, segStart, segEnd } = segments[si];
						const isLast = si === segments.length - 1;
						const sourceIsActive = receiverId === sourceTrack.characterId;
						const segResolved = new SvelteSet<string>([sourceIsActive ? 'onField' : 'offField']);
						const segNegated = new SvelteSet<string>([sourceIsActive ? 'offField' : 'onField']);
						const receiverChar = getLoadedCharacter(receiverId);
						const activeCharFactions = new SvelteSet<string>(receiverChar?.factions ?? []);
						const segCtx: ConditionContext = {
							teamFactionCounts,
							negatedStates: segNegated,
							activeCharFactions
						};
						const segEffects = barEffects.filter(
							(effect) =>
								evalCondition(
									effect.conditions,
									4,
									segResolved,
									cLevel,
									undefined,
									undefined,
									segCtx
								) !== false
						);
						if (segEffects.length === 0) continue;
						const segMergedEffects: MergedEffectDisplay[] = segEffects.map((e) => ({
							stat: e.stat,
							displayValue: formatBuffDisplayValue(
								e.stat,
								e.value,
								0,
								undefined,
								canonicalHeadlineOf(e)
							)
						}));
						const segPrimaryStat = segEffects[0].stat;
						const useSegList = segEffects.length !== barEffects.length;
						addBar(receiverId, {
							start: segStart,
							end: isLast ? buffEnd : segEnd,
							primaryStat: useSegList ? segPrimaryStat : primaryStat,
							effects: useSegList ? segMergedEffects : mergedEffects,
							sourceLabel,
							isMutuallyExclusive: false,
							duration: buffEnd - buffStart
						});
					}
				}
			}
		}

		// ── Self-target ability buff ──
		// Effects with target: "self" apply only to the caster for the full buff duration,
		// shown as a bar on that character's individual received-buff row.
		// Includes onTeamNightsoulBurst self-target effects (Mavuika A1, Varesa A4,
		// Xilonen A2, Ifa A1) — fire from each nbBars event regardless of field state.
		// NB dispatch is character-scoped (rotation-wide nbBars pool), so it runs
		// on the character's FIRST track only — per-track would duplicate every
		// bar when a character appears in multiple segments.
		const nbSelfDispatched = new SvelteSet<string>();
		for (const sourceTrack of tracks) {
			const char = getLoadedCharacter(sourceTrack.characterId);
			if (!char) continue;
			const firstTrackOfChar = !nbSelfDispatched.has(sourceTrack.characterId);
			nbSelfDispatched.add(sourceTrack.characterId);
			const cLevel = $constellations[sourceTrack.characterId] ?? 0;

			const selfCastPairs: Array<['skill' | 'burst', TimelineBar[], string]> = [
				['skill', sourceTrack.eBars, 'E'],
				['burst', sourceTrack.qBars, 'Q']
			];

			for (const [castType, abBars, abLabel] of selfCastPairs) {
				const onCastSelf = getCharacterEffectsForCast(char, castType);
				const onHitSelf = getCharacterEffectsForOnHit(char, castType);
				const seenStats = new SvelteSet<string>();
				// Self-target buffs apply to the source character themselves; for
				// purposes of state resolution the source is always "on-field" in
				// these segments (you can't self-buff while off-field). Inject
				// onField/¬offField so a self-buff with `state: "offField"` is
				// definitively dropped rather than rendering on a window that
				// doesn't actually qualify.
				const selfResolved = new SvelteSet<string>(['onField']);
				const selfNegated = new SvelteSet<string>(['offField']);
				const selfCtx: ConditionContext = {
					teamFactionCounts,
					negatedStates: selfNegated,
					teamElementCounts: teamElementCountsByHolder.get(char.id)
				};
				const selfEffects = [...onCastSelf, ...onHitSelf].filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (effect.target !== 'self') return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							selfResolved,
							cLevel,
							undefined,
							undefined,
							selfCtx
						) === false
					)
						return false;
					if (seenStats.has(effect.stat)) return false;
					seenStats.add(effect.stat);
					return true;
				});
				if (selfEffects.length === 0) continue;

				const sourceLabel = `${char.displayName} ${abLabel}`;

				for (const abBar of abBars) {
					const filterCtx = resolveCastContext(char, castType, abBar);
					const barEffects = selfEffects.filter((effect) => {
						if (
							evalCondition(
								effect.conditions,
								4,
								selfResolved,
								cLevel,
								undefined,
								abBar.stackContext,
								selfCtx
							) === false
						)
							return false;
						if (effect.trigger.type === 'onHit' && filterCtx) {
							if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
						}
						return true;
					});
					if (barEffects.length === 0) continue;
					const primaryStat = barEffects[0].stat;
					const mergedEffects: MergedEffectDisplay[] = barEffects.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(
							e.stat,
							e.value,
							0,
							abBar.stackContext,
							canonicalHeadlineOf(e)
						)
					}));
					const buffStart = abBar.start + (abBar.summonActivatesAt ?? 0) / 60;
					const buffEnd = buffStart + barEffects[0].duration!;
					addBar(sourceTrack.characterId, {
						start: buffStart,
						end: buffEnd,
						primaryStat,
						effects: mergedEffects,
						sourceLabel,
						isMutuallyExclusive: false,
						duration: buffEnd - buffStart
					});
				}
			}

			// ── N/CA/P onHit self-target effects (input-block class — F2B) ──
			const blockClassPairs: Array<['normal' | 'charged' | 'plunge', string]> = [
				['normal', 'N'],
				['charged', 'CA'],
				['plunge', 'P']
			];
			const selfResolvedBlock = new SvelteSet<string>(['onField']);
			const selfNegatedBlock = new SvelteSet<string>(['offField']);
			const selfCtxBlock: ConditionContext = {
				teamFactionCounts,
				negatedStates: selfNegatedBlock,
				teamElementCounts: teamElementCountsByHolder.get(char.id)
			};
			for (const [blockClass, blockLabel] of blockClassPairs) {
				const onHitBlockSelf = getCharacterEffectsForOnHit(char, blockClass);
				if (onHitBlockSelf.length === 0) continue;
				const seenStats = new SvelteSet<string>();
				const selfEffects = onHitBlockSelf.filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (effect.target !== 'self') return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							selfResolvedBlock,
							cLevel,
							undefined,
							undefined,
							selfCtxBlock
						) === false
					)
						return false;
					if (seenStats.has(effect.stat)) return false;
					seenStats.add(effect.stat);
					return true;
				});
				if (selfEffects.length === 0) continue;
				const sourceLabel = `${char.displayName} ${blockLabel}`;
				for (const block of sourceTrack.inputBlocks) {
					if (getBlockDamageTag(block) !== blockClass) continue;
					const filterCtx = resolveBlockContext(char, block);
					const barEffects = selfEffects.filter((effect) => {
						if (
							evalCondition(
								effect.conditions,
								4,
								selfResolvedBlock,
								cLevel,
								undefined,
								undefined,
								selfCtxBlock
							) === false
						)
							return false;
						if (effect.trigger.type === 'onHit' && filterCtx) {
							if (!evalTriggerFilter(effect.trigger.filter, filterCtx)) return false;
						}
						return true;
					});
					if (barEffects.length === 0) continue;
					const primaryStat = barEffects[0].stat;
					const mergedEffects: MergedEffectDisplay[] = barEffects.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(
							e.stat,
							e.value,
							0,
							undefined,
							canonicalHeadlineOf(e)
						)
					}));
					const buffStart = block.start + block.duration;
					const buffEnd = buffStart + barEffects[0].duration!;
					addBar(sourceTrack.characterId, {
						start: buffStart,
						end: buffEnd,
						primaryStat,
						effects: mergedEffects,
						sourceLabel,
						isMutuallyExclusive: false,
						duration: buffEnd - buffStart
					});
				}
			}

			// ── onTeamNightsoulBurst self-target effects ──
			// Fire once per nbBars event, regardless of whether the source character
			// is on field at that time (NB is a global team event in-game). The
			// receiver is the source character themselves.
			const nbSelfPool = getCharacterEffectsForTeamNightsoulBurst(char);
			if (firstTrackOfChar && nbBars.length > 0 && nbSelfPool.length > 0) {
				const seenStatsNB = new SvelteSet<string>();
				const selfEffectsNB = nbSelfPool.filter((effect): effect is BuffEffect => {
					if (effect.type !== 'buff') return false;
					if (effect.target !== 'self') return false;
					if (effect.duration == null) return false;
					if (
						evalCondition(
							effect.conditions,
							4,
							new SvelteSet(),
							cLevel,
							undefined,
							undefined,
							baseCtx
						) === false
					)
						return false;
					if (seenStatsNB.has(effect.stat)) return false;
					seenStatsNB.add(effect.stat);
					return true;
				});
				if (selfEffectsNB.length > 0) {
					const sourceLabel = `${char.displayName} NB`;
					const primaryStat = selfEffectsNB[0].stat;
					const mergedEffects: MergedEffectDisplay[] = selfEffectsNB.map((e) => ({
						stat: e.stat,
						displayValue: formatBuffDisplayValue(
							e.stat,
							e.value,
							0,
							undefined,
							canonicalHeadlineOf(e)
						)
					}));
					for (const nb of nbBars) {
						const buffStart = nb.start;
						const buffEnd = buffStart + selfEffectsNB[0].duration!;
						addBar(sourceTrack.characterId, {
							start: buffStart,
							end: buffEnd,
							primaryStat,
							effects: mergedEffects,
							sourceLabel,
							isMutuallyExclusive: false,
							duration: buffEnd - buffStart
						});
					}
				}
			}
		}

		return [...rowMap.values()];
	});

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

	// ---------------------------------------------------------------------------
	// Summon lane computation — Phase 2 (2026-05-01)
	// ---------------------------------------------------------------------------
	//
	// One sub-row per (slotIdx, characterId, summon.label) so refreshes from
	// different casts sharing a label collapse onto a shared sub-row (e.g.
	// Fischl E Oz and Fischl Q Oz). Bars are derived from each E/Q cast event
	// — the bar's `uptime` already carries the resolved summon duration.

	type SummonBar = {
		start: number;
		end: number;
		source: 'skill' | 'burst';
		/** Absolute timestamps (seconds) of summonTick effect emissions during
		 *  this bar's lifetime. P3: rendered as markers on the summon bar. */
		ticks: number[];
	};
	type SummonSubrow = {
		slotIdx: number;
		characterId: string;
		label: string;
		bars: SummonBar[];
	};

	/** Compute tick timestamps for a summon's `effects[]` over [spawnAt, endAt].
	 *  Walks each effect with `trigger.type === "summonTick"` and emits one
	 *  marker per interval. Conditions on the effect must definitively-true
	 *  (or undefined); unresolvable runtime conditions abstain (no markers). */
	function computeSummonTicks(
		summon: Summon,
		spawnAt: number,
		endAt: number,
		cLevel: number
	): number[] {
		const ticks: number[] = [];
		for (const eff of summon.effects ?? []) {
			if (eff.trigger.type !== 'summonTick') continue;
			if (evalCondition(eff.conditions, 4, new SvelteSet(), cLevel) === false) continue;
			const interval = eff.trigger.interval;
			if (!(interval > 0)) continue;
			const firstDelay = eff.trigger.firstTickDelay ?? interval;
			for (let t = spawnAt + firstDelay; t < endAt; t += interval) {
				ticks.push(t);
			}
		}
		ticks.sort((a, b) => a - b);
		return ticks;
	}

	/** Resolve the summon owned by a given E/Q cast (variant-aware). Returns
	 *  undefined for stance abilities or abilities without `summons[]`. */
	function findCastSummon(
		char: CharacterData | null | undefined,
		kind: 'skill' | 'burst',
		label: string
	): Summon | undefined {
		if (!char) return undefined;
		const candidates = char.abilities.filter((a): a is CastAbility => a.abilityType === kind);
		// Use the unconditioned base ability — stance-conditioned variants
		// represent caster state and don't carry summons.
		const ability = candidates.find((a) => a.conditions === undefined) ?? candidates[0];
		if (!ability) return undefined;
		const variant = ability.variants?.find((v) =>
			(v.input as string[] | undefined)?.includes(label)
		);
		return variant?.summons?.[0] ?? ability.summons?.[0];
	}

	let summonSubrows = $derived.by((): SummonSubrow[] => {
		const rowMap = new SvelteMap<string, SummonSubrow>();
		const subrowOrder: SummonSubrow[] = [];

		// Walk slot-annotated tracks chronologically so swap-out events resolve
		// in source order. annotatedTracks already preserves segment ordering.
		for (let i = 0; i < annotatedTracks.length; i++) {
			const track = annotatedTracks[i];
			const char = getLoadedCharacter(track.characterId);

			// Find the next swap-out time for this character (used for terminatesOn:"swap").
			let swapOutAt = Infinity;
			for (let j = i + 1; j < annotatedTracks.length; j++) {
				if (annotatedTracks[j].slotIdx !== track.slotIdx) {
					swapOutAt = annotatedTracks[j].activeStart;
					break;
				}
			}
			// If this is the character's last track, the bar runs to its natural end.

			const cLevel = $constellations[track.characterId] ?? 0;

			const emit = (bar: TimelineBar, kind: 'skill' | 'burst') => {
				if (bar.uptime <= 0) return;
				const summon = findCastSummon(char, kind, bar.label);
				if (!summon) return;
				const spawnAt = bar.start + (bar.summonActivatesAt ?? 0) / 60;
				let endAt = spawnAt + bar.uptime;
				if (summon.terminatesOn === 'swap' && swapOutAt < endAt) {
					endAt = swapOutAt;
				}
				if (endAt <= spawnAt) return;

				const key = `${track.slotIdx}::${track.characterId}::${summon.label}`;
				let row = rowMap.get(key);
				if (!row) {
					row = {
						slotIdx: track.slotIdx,
						characterId: track.characterId,
						label: summon.label,
						bars: []
					};
					rowMap.set(key, row);
					subrowOrder.push(row);
				}

				// Recast termination: if the previous bar on this sub-row is still
				// open at the new spawn time and the source ability's summon is
				// `terminatesOn:"recast"`, truncate the prior bar (and trim its
				// ticks past the new end time).
				if (summon.terminatesOn === 'recast' && row.bars.length > 0) {
					const prev = row.bars[row.bars.length - 1];
					if (prev.end > spawnAt) {
						prev.end = spawnAt;
						prev.ticks = prev.ticks.filter((t) => t < spawnAt);
					}
				}

				const ticks = computeSummonTicks(summon, spawnAt, endAt, cLevel);
				row.bars.push({ start: spawnAt, end: endAt, source: kind, ticks });
			};

			for (const bar of track.eBars) emit(bar, 'skill');
			for (const bar of track.qBars) emit(bar, 'burst');
		}

		return subrowOrder;
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
		const y = RULER_H + slotTopOffsets[topSlot] + activeRowOffsetForSlot(topSlot) + 1;
		const yBottom =
			RULER_H + slotTopOffsets[bottomSlot] + activeRowOffsetForSlot(bottomSlot) + ACTIVE_ROW_H - 1;

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
				hasArrival: prev != null && prev.slotIdx !== t.slotIdx,
				hasDeparture: next != null && next.slotIdx !== t.slotIdx
			});
		}
		return map;
	});

	function barRadius(conn: ConnectInfo | undefined): string {
		const l = conn?.hasArrival ? '0' : '2px';
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
			destroy() {
				view.destroy();
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
			<button
				class="rp-zoom-btn"
				type="button"
				aria-label="Zoom out"
				onclick={() => (scale = Math.max(20, scale - 5))}>🔍−</button
			>
			<input
				type="range"
				min={20}
				max={120}
				step={5}
				bind:value={scale}
				class="rp-zoom-slider"
				aria-label="Zoom"
			/>
			<button
				class="rp-zoom-btn"
				type="button"
				aria-label="Zoom in"
				onclick={() => (scale = Math.min(120, scale + 5))}>🔍+</button
			>
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
					onclick={() => (showCaveats = !showCaveats)}>NOTES</button
				>
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
					<div class="rp-label-cell char-label" style:height="{slotBlockH(i)}px">
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
									aria-label="Set constellation for {char.displayName}">C{cLevel}</button
								>
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
											title={char.weapon === 'polearm'
												? 'No polearm-type weapons available'
												: undefined}
											onSelect={(id) =>
												onTabLoadoutChange?.(char.id, {
													weaponId: id,
													weaponRefinement: entry.weaponRefinement ?? 1
												})}
										/>
									</div>
									{#if entry.weaponId}
										<button
											class="rp-ref-badge"
											onclick={(e) => openRefinement(e, i)}
											aria-label="Set refinement for weapon">R{entry.weaponRefinement ?? 1}</button
										>
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

						<div class="rp-char-block" style:height="{slotBlockH(slotIdx)}px" style:--bar-hi={p.hi}>
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
										{@const eHasSummon = !!findCastSummon(char, 'skill', bar.label)}
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
													style:background={p.main}
													style:border-radius="3px"
													style:box-shadow="inset 0 0 0 1px var(--bar-hi)"
												>
													<span class="rp-bar-row-badge">E</span>
												</div>
												{@const cdSpan = bar.cooldown - eFieldOffset - bar.uptime}
												{#if cdSpan > 0}
													{@const cd = barGeom(eFieldStart + bar.uptime, cdSpan)}
													<div
														class="rp-bar-cd"
														style:left="{cd.left}px"
														style:width="{cd.width}px"
														style:background="color-mix(in srgb, {p.main} 23%, var(--bg))"
														style:border-color="transparent"
														style:z-index="0"
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
													style:background={p.main}
												>
													<span class="rp-bar-row-badge">E</span>
												</div>
												{@const ph2 = barGeom(
													bar.start + bar.cooldown,
													eFieldOffset + bar.uptime - bar.cooldown
												)}
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
											<!-- Single-phase: cast time + ghost CD remainder.
										     Covers instant abilities AND summon-bearing abilities
										     (whose lifetime now lives on the dedicated summon lane). -->
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
											<div
												class="rp-summon-bar"
												style:left="{g.left}px"
												style:width="{g.width}px"
												style:background={p.main}
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
													style:background={p.main}
													style:border-radius="3px"
													style:box-shadow="inset 0 0 0 1px var(--bar-hi)"
												>
													<span class="rp-bar-row-badge">Q</span>
												</div>
												{@const cdSpan = bar.cooldown - qFieldOffset - bar.uptime}
												{#if cdSpan > 0}
													{@const cd = barGeom(qFieldStart + bar.uptime, cdSpan)}
													<div
														class="rp-bar-cd"
														style:left="{cd.left}px"
														style:width="{cd.width}px"
														style:background="color-mix(in srgb, {p.main} 23%, var(--bg))"
														style:border-color="transparent"
														style:z-index="0"
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
													style:background={p.main}
												>
													<span class="rp-bar-row-badge">Q</span>
												</div>
												{@const ph2 = barGeom(
													bar.start + bar.cooldown,
													qFieldOffset + bar.uptime - bar.cooldown
												)}
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
											<!-- Single-phase: cast time + ghost CD remainder.
										     Covers instant bursts AND summon-bearing bursts. -->
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
									{@const activeLeft = Math.round(track.activeStart * scale)}
									{@const activeW = Math.max(
										Math.round((track.activeEnd - track.activeStart) * scale),
										4
									)}
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
											style:background={block.kind === 'skill' ||
											block.kind === 'burst' ||
											block.kind === 'elemental-normal'
												? p.border
												: undefined}
											style:border-right={bi === track.inputBlocks.length - 1 ? 'none' : undefined}
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
						{#each majorTicks as tick (tick.t)}
							<div class="rp-gridline" style:left="{tick.x}px"></div>
						{/each}
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
							{#each majorTicks as tick (tick.t)}
								<div class="rp-gridline" style:left="{tick.x}px"></div>
							{/each}
							<div class="rp-nb-rows">
								<div class="rp-nb-subrow">
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
							</div>
						</div>
					{/if}

					<!-- Moonsign lane -->
					{#if teamComp.hasAscendantGleam}
						<div class="rp-moonsign-lane" style:height="{moonsignLaneH}px">
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
		transition:
			background 0.12s,
			border-color 0.12s;
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
		transition:
			background 0.1s,
			color 0.1s,
			border-color 0.1s;
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
		box-shadow:
			0 0 0 2px currentColor,
			0 0 10px 1px currentColor;
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
		padding: 2px 0;
	}
	.rp-team-buff-subrow {
		position: relative;
		height: 12px;
		flex-shrink: 0;
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
	/* Debuff variant — applied to enemy resShred bars. Same geometry as the
	   buff bar; red tint communicates "applies to enemy" at a glance. */
	.rp-team-buff-bar.rp-team-debuff-bar {
		background: #3a1c20;
		border-color: #7a3c44;
		border-left-color: #c06464;
	}
	.rp-team-buff-bar.rp-team-debuff-bar .rp-buff-label {
		color: #d09098;
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
		height: 12px;
		flex-shrink: 0;
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
		height: 12px;
		flex-shrink: 0;
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
		box-shadow:
			inset 1px 0 0 0 var(--bar-hi, transparent),
			inset 0 1px 0 0 var(--bar-hi, transparent),
			inset 0 -1px 0 0 var(--bar-hi, transparent);
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
	/* Summon lane bars — subordinate to E/Q: lower opacity, no inset glow.
	   Phase 2 dropped the three-phase ghost-CD overlay from E/Q in favour of
	   rendering summon lifetime on a dedicated lane. */
	.rp-summon-bar {
		position: absolute;
		top: 1px;
		height: calc(100% - 2px);
		border-radius: 2px;
		opacity: 0.65;
		z-index: 2;
		min-width: 2px;
		display: flex;
		align-items: center;
		padding: 0 3px;
		overflow: hidden;
	}
	.rp-summon-label {
		font-size: 7px;
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
		opacity: 0.85;
		z-index: 3;
		pointer-events: none;
		transform: translateX(-0.5px);
	}

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
		border: 1.5px dashed #4f546b;
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
		background: #4f546b;
	}
	.rp-input-block--movement {
		background: rgba(79, 84, 107, 0.45);
	}
	.rp-input-block--unset {
		background: transparent;
		border: 1px dashed #4f546b;
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
		background: #4f546b;
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
		transition:
			background 0.1s,
			border-color 0.1s,
			color 0.1s;
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
