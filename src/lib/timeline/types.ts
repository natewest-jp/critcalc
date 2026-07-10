/**
 * src/lib/timeline/types.ts
 *
 * Shared row/bar shapes for the timeline computation pipelines extracted from
 * RotationTimeline.svelte. Pure data types — no reactivity, no DOM.
 */

import type { Stat, Effect } from '$lib/types/ability';

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
