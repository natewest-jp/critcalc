/**
 * src/lib/timeline/types.ts
 *
 * Shared row/bar shapes for the timeline computation pipelines extracted from
 * RotationTimeline.svelte. Pure data types — no reactivity, no DOM.
 */

import type { Stat, Effect } from '$lib/types/ability';
import type { CharacterTrack } from '$lib/utils/notationParser';

/** A parser track annotated with the character-slot index it renders in. */
export type SlottedTrack = CharacterTrack & { slotIdx: number };

export type BuffEffect = Extract<Effect, { type: 'buff' }>;
export type ResShredEffect = Extract<Effect, { type: 'resShred' }>;

export type MergedEffectDisplay = { stat: Stat; displayValue: string };

export type TeamBuffBar = { start: number; end: number; effects: MergedEffectDisplay[] };

export type TeamBuffSubrow = {
	characterId: string;
	primaryStat: Stat;
	bars: TeamBuffBar[];
	sourceLabel: string;
	/** 'debuff' renders with the resShred (red-tinted) bar treatment.
	 *  Defaults to 'buff' when omitted. */
	kind?: 'buff' | 'debuff';
};

// Per-character received buff bars (TTDS, Widsith, etc.).
// Keyed by the *receiving* character's id. Rendered in each character's buff row.
// Effects sharing one ICD key (e.g. Widsith's 3 themes) are merged into one bar.
export type RampParams = {
	startValue: number;
	stepValue: number;
	stepInterval: number;
	cap?: number;
};
export type DecayParams = { startValue: number; endValue: number; duration: number };
export type CharReceivedBuffBar = {
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
export type CharReceivedBuffSubrow = {
	characterId: string;
	sourceLabel: string;
	primaryStat: Stat;
	bars: CharReceivedBuffBar[];
};

export type WeaponProcSubrow = {
	characterId: string;
	label: string;
	bars: Array<{ start: number; end: number }>;
};

export type SummonBar = {
	start: number;
	end: number;
	source: 'skill' | 'burst';
	/** Absolute timestamps (seconds) of summonTick effect emissions during
	 *  this bar's lifetime. P3: rendered as markers on the summon bar. */
	ticks: number[];
};
export type SummonSubrow = {
	slotIdx: number;
	characterId: string;
	label: string;
	bars: SummonBar[];
};

export type MoonsignRow = {
	slotIdx: number;
	windows: Array<{ start: number; duration: number }>;
};
