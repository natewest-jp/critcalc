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

export type MergedEffectDisplay = {
	stat: Stat;
	displayValue: string;
	/** This effect's OWN length, printed beside its value — set only on a
	 *  SEAMED bar (`fuseNestedBars`), where the parts of one cast run to
	 *  different ends and the bar's footer can state only the longest. */
	note?: string;
};

export type TeamBuffBar = {
	start: number;
	end: number;
	effects: MergedEffectDisplay[];
	/** Absolute frames where a SHORTER part of this bar ends — one cast whose
	 *  effects run to different lengths is one bar with a lit seam at each inner
	 *  end (pool round, 2026-09-17). Absent = no seam. */
	seams?: number[];
	/** The Polestar Field's recorded-hit count for this grant cycle — the number
	 *  that set the bar's value. ⚠️ Carried OUTSIDE `effects` on purpose: it is
	 *  not a stat, and putting it in the display list would make it part of the
	 *  refresh-merge key. The merge gets its own equality test instead. */
	stacks?: number;
	/** See `BarStep`. Absent = the bar's value holds for its whole span. */
	steps?: BarStep[];
	/** The count at which a step is drawn at full density. */
	stepMax?: number;
};

/**
 * ⚓ ONE STRETCH OF A STEPPED BAR (stepped stacks round, 2026-09-27) — a
 * `whileStacks` buff whose count moved under it. The bar is drawn as hard
 * density steps (thinner glass = fewer stacks, the ramp envelope's grammar)
 * and the tooltip reads the step under the pointer. `effects` is the value AT
 * this count, formatted by the same formatter the bar's own `effects` use.
 */
export type BarStep = {
	start: number;
	end: number;
	count: number;
	effects: MergedEffectDisplay[];
};

export type TeamBuffSubrow = {
	characterId: string;
	primaryStat: Stat;
	bars: TeamBuffBar[];
	sourceLabel: string;
	/** Row-level icon override. ⚠️ The default is keyed by STAT
	 *  (`BUFF_STAT_ICON`), which is right for a character's buff and wrong for a
	 *  row whose identity is not its stat: the Polestar Field's Cryo bonus would
	 *  wear a Cryo pip and read as somebody's Cryo buff. */
	icon?: string;
	/** Whether the row is a buff on the team or a shred on the enemy.
	 *  ⛔ NOT PAINT — the debuff bar variant was deleted 2026-08-11 (⚓ Nate:
	 *  "there's really no need to colour-split the buff/debuff bars. They're
	 *  both good things to the user."). This note used to say "renders with the
	 *  resShred (red-tinted) bar treatment" and outlived that by three days.
	 *  What `kind` still does is separate ROWS (a shred and a buff off one cast
	 *  are two rows) and pick the display formatter; the bars look identical.
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
	/** See `TeamBuffBar.seams`. */
	seams?: number[];
	/** Where this slice's buff ENDS ON ITS OWN (`buffStart + duration`), which a
	 *  slice cut at the receiver's swap-out never reaches. ⚓ A seam is drawn
	 *  only at a natural end: a slice that stops because its receiver left the
	 *  field is a fact the swap connector one row up already states. */
	naturalEnd?: number;
	buffStart?: number; // set when rampParams or decayParams is present, for gradient offset
	rampParams?: RampParams;
	decayParams?: DecayParams;
	/** See `BarStep`. */
	steps?: BarStep[];
	stepMax?: number;
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
	/** Stack-threshold fires on this lane (stack-threshold round, 2026-09-18) —
	 *  a different mark from a tick: full-height, in the hit's element, and it
	 *  applied nothing. Read off the window's `fires`, never derived. */
	fires?: { time: number; element: string }[];
	/** Ticks in the summon's ABSORBED element (absorption round, 2026-10-17) —
	 *  the first turns the bar into that element, and all merge into `ticks`
	 *  one stub per frame (`summonMarks`). Read off the window, never derived. */
	absorbedTicks?: { time: number; element: string }[];
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
