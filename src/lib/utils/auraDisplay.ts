/**
 * src/lib/utils/auraDisplay.ts
 *
 * How an aura mod is NAMED, ORDERED and COLOURED — the display vocabulary for
 * everything `gauge.ts` can put on a target (gauge round L6).
 *
 * ⚓ EXTRACTED BECAUSE THERE ARE TWO READERS NOW. It lived inside
 * `GaugeInstrument.svelte` while the instrument was the only surface a gauge
 * reached; the planner's aura lane is the second, and a Frozen bar that is
 * `--rx-frozen` in one tool and cryo in the other would be two answers to one
 * question. Same law that put `icd.ts` and `gauge.ts` here: one model, several
 * shapes.
 *
 * ⛔ These are CSS variable references, not literals — the canvas export
 * hand-mirrors them in `timelineExport.ts` under the palette-mirror guard, the
 * way it mirrors every other token it paints.
 *
 * ⚠️ Nine mods, and four of them are not elements. `frozen`, `quicken`,
 * `burning` and `burningFuel` are reaction STATES that sit on the target
 * alongside (or instead of) an elemental aura, which is why they get their own
 * `--rx-*` hues rather than borrowing the element that caused them: a Frozen
 * bar drawn in cryo would say "the cryo aura is still there", and it is not —
 * it has become something with a different decay curve.
 */

import type { AuraKey, SeriesInterval } from '$lib/utils/gauge';
import type { Reaction } from '$lib/types/ability';

export type AuraModMeta = {
	/** Player-facing name. */
	label: string;
	/** Element icon key (`$lib/data/elementIcons.generated`). */
	icon: string;
	/** CSS colour reference. */
	color: string;
	/** SVG stroke-dasharray, for the one mod that is not really an aura. */
	dash?: string;
	/**
	 * A reaction STATE rather than an element — the four the header note names.
	 *
	 * ⚓ MACHINE-READABLE BECAUSE THE LABEL RULE NEEDS IT (2026-08-17). The plot
	 * names an element ONCE and a compound state EVERY time, and the reason is
	 * what colour can say: this audience reads Hydro-blue and Electro-purple
	 * without help (the `--el-*` ramps are Genshin's own, transcribed), so the
	 * word is only news on first sight. `--rx-frozen` and `--rx-quicken` are OUR
	 * hues for states the game gives no colour to, so their word is news every
	 * time. See `auraSpanLabels`.
	 *
	 * ⛔ Don't infer this from the `--rx-` prefix in `color`. That is sniffing a
	 * token name for a fact, and it would break silently the first time a state
	 * borrowed an element ramp.
	 */
	compound?: true;
};

export const AURA_MOD_META: Record<AuraKey, AuraModMeta> = {
	pyro: { label: 'Pyro', icon: 'pyro', color: 'var(--el-pyro-main)' },
	burning: { label: 'Burning', icon: 'pyro', color: 'var(--rx-burning)', compound: true },
	// ⚠️ The fuel is the DENDRO being consumed, not an aura the target carries —
	// dashed everywhere it is drawn so it reads as bookkeeping.
	burningFuel: {
		label: 'Fuel',
		icon: 'dendro',
		color: 'var(--rx-burning-fuel)',
		// ↻ '5 4' → '9 5' (⚓ NATE 2026-08-17): at 5px on / 4px off, drawn with the
		// ROUND caps every aura line wears, each dash rendered as a lozenge and the
		// series read as a badly-aliased solid line rather than a deliberate dashed
		// one. ⚠️ The cap is the other half of the fix — a dashed path must be drawn
		// BUTT-capped, or every dash grows half its stroke-width at each end and the
		// gaps close up. Both renderers do that now; ⛔ don't lengthen this without
		// checking the cap.
		dash: '9 5',
		compound: true
	},
	hydro: { label: 'Hydro', icon: 'hydro', color: 'var(--el-hydro-main)' },
	cryo: { label: 'Cryo', icon: 'cryo', color: 'var(--el-cryo-main)' },
	frozen: { label: 'Frozen', icon: 'cryo', color: 'var(--rx-frozen)', compound: true },
	electro: { label: 'Electro', icon: 'electro', color: 'var(--el-electro-main)' },
	dendro: { label: 'Dendro', icon: 'dendro', color: 'var(--el-dendro-main)' },
	quicken: { label: 'Quicken', icon: 'dendro', color: 'var(--rx-quicken)', compound: true }
};

/**
 * ⚓ WHICH REACTIONS TICK, and what keeps them ticking (2026-08-17).
 *
 * A reaction is one of two things and the lane has to draw them differently.
 * Vaporize, Melt, Overload, Swirl, Crystallize, Bloom, Aggravate and the rest
 * are DISCRETE — they happen at an instant, and naming each one is right.
 * Electro-Charged, Lunar-Charged and Burning are CONTINUOUS STATES that tick
 * for as long as the auras behind them coexist, so drawing each tick as its own
 * named event says "this happened twelve times" when a player experienced one
 * ongoing thing — and paints twelve copies of one long word across the row.
 *
 * ⚓ THIS IS ALREADY SETTLED ELSEWHERE, TWICE. The Gauge Explorer's event log
 * collapses consecutive `ecTick`s into an `ecRun {t0, t1, count}` and hides
 * burning self-ticks outright; `mergeRefreshedBars.ts` makes one bar with one
 * label out of a buff re-applied before it expires. The aura lane was the last
 * surface still treating a tick as an event.
 *
 * ⚠️ A reaction ABSENT from this map never merges, and that is the safety of the
 * design: two Vaporizes half a second apart stay two markers, because they ARE
 * two events. Only the entries here can ever collapse.
 *
 * The value is the mods that must be CONTINUOUSLY present for the run to be one
 * run. Electro-Charged needs both auras alive; if either lapses and comes back,
 * that is a second episode and gets a second marker. Burning is its own mod, so
 * its presence IS the condition. ⚓ Deriving the break from the gauge means the
 * rule needs no threshold — ⛔ never "markers closer together than N seconds",
 * which is a guess wearing a number.
 */
export const REACTION_SUSTAINED_BY: Partial<Record<Reaction, AuraKey[]>> = {
	electroCharged: ['hydro', 'electro'],
	lunarCharged: ['hydro', 'electro'],
	burning: ['burning']
};

/**
 * Row order wherever mods are stacked.
 *
 * ⚓ Grouped by the aura each derivative BELONGS TO rather than alphabetically
 * or by element wheel: Burning and its Fuel sit under Pyro because they are
 * what a Pyro application became, Frozen under Cryo, Quicken under Dendro. A
 * reader scanning the lane finds the derived state next to its parent.
 */
export const AURA_MOD_ORDER: AuraKey[] = [
	'pyro',
	'burning',
	'burningFuel',
	'hydro',
	'cryo',
	'frozen',
	'electro',
	'dendro',
	'quicken'
];

/**
 * Player-facing reaction names, in OUR vocabulary (`Reaction`), not the gauge's.
 *
 * ⚠️ Two vocabularies exist and this is the one the IR speaks — `sim/aura.ts`
 * pushes `reaction` events already translated through `reactionBridge.ts`, so
 * the planner never sees a bare `swirl`. The instrument drives the gauge
 * directly and keeps its own map of the gauge's `ReactionKind`; ⛔ do not merge
 * the two, they are keyed on different unions on purpose.
 *
 * ⚠️ AND THAT TRANSLATION IS LOSSY, DELIBERATELY: `reverseVaporize` and
 * `vaporize` both arrive as `vaporize`, because a curator authors "vaporize" and
 * never "the 1.5× one" — the multiplier is the only thing they differ by and
 * nothing downstream dispatches on it. So the lane says **Vaporize**, not
 * "Vaporize ×2", and that is a real gap rather than a wording choice: we know
 * the direction at the gauge and drop it at the bridge. ⛔ Do not fix it by
 * leaking the gauge's key into the IR — the bridge exists to stop exactly that.
 * Carrying it would mean a multiplier field on `ReactionEvent`, which is a
 * schema question, not a label one.
 */
export const REACTION_LABEL: Record<Reaction, string> = {
	vaporize: 'Vaporize',
	melt: 'Melt',
	overloaded: 'Overload',
	superConduct: 'Superconduct',
	stellarConduct: 'Stellar-Conduct',
	electroCharged: 'Electro-Charged',
	frozen: 'Freeze',
	shatter: 'Shatter',
	burning: 'Burning',
	bloom: 'Bloom',
	hyperbloom: 'Hyperbloom',
	burgeon: 'Burgeon',
	quicken: 'Quicken',
	aggravate: 'Aggravate',
	spread: 'Spread',
	pyroSwirl: 'Swirl (Pyro)',
	hydroSwirl: 'Swirl (Hydro)',
	cryoSwirl: 'Swirl (Cryo)',
	electroSwirl: 'Swirl (Electro)',
	stellarSwirl: 'Stellar Swirl',
	pyroCrystallize: 'Crystallize (Pyro)',
	hydroCrystallize: 'Crystallize (Hydro)',
	cryoCrystallize: 'Crystallize (Cryo)',
	electroCrystallize: 'Crystallize (Electro)',
	lunarCrystallize: 'Lunar-Crystallize',
	lunarBloom: 'Lunar-Bloom',
	lunarCharged: 'Lunar-Charged'
};

/**
 * The reaction FAMILY — what a marker says when it has a few characters, which
 * is what a glance is asking for. The variants collapse: four swirls read
 * "Swirl", four crystallizes read "Crystallize", and which aura it took is in
 * the tooltip via {@link REACTION_LABEL}.
 *
 * ⚓ An exhaustive `Record` on both maps rather than a lookup with a fallback,
 * so a new `Reaction` is a typecheck failure here instead of a blank marker
 * nobody notices.
 */
export const REACTION_FAMILY: Record<Reaction, string> = {
	vaporize: 'Vaporize',
	melt: 'Melt',
	overloaded: 'Overload',
	superConduct: 'Superconduct',
	stellarConduct: 'Stellar-Conduct',
	electroCharged: 'Electro-Charged',
	frozen: 'Freeze',
	shatter: 'Shatter',
	burning: 'Burning',
	bloom: 'Bloom',
	hyperbloom: 'Hyperbloom',
	burgeon: 'Burgeon',
	quicken: 'Quicken',
	aggravate: 'Aggravate',
	spread: 'Spread',
	pyroSwirl: 'Swirl',
	hydroSwirl: 'Swirl',
	cryoSwirl: 'Swirl',
	electroSwirl: 'Swirl',
	stellarSwirl: 'Swirl',
	pyroCrystallize: 'Crystallize',
	hydroCrystallize: 'Crystallize',
	cryoCrystallize: 'Crystallize',
	electroCrystallize: 'Crystallize',
	lunarCrystallize: 'Lunar-Cryst.',
	lunarBloom: 'Lunar-Bloom',
	lunarCharged: 'Lunar-Charged'
};

/**
 * The y ceiling a gauge chart draws to, in units: the peak rounded UP to a half
 * unit, and floored at {@link AURA_UMAX_FLOOR}.
 *
 * ⚓ ONE CEILING, TWO CHARTS (2026-08-17). The Gauge Explorer and the planner's
 * aura lane each had their own copy of this arithmetic — byte-identical, with
 * nothing keeping them that way. ⚠️ That duplication had already caused a real
 * misreading: the two charts LOOK like they scale differently (the Explorer
 * labelled its unit axis and the lane did not), so the lane was reported as the
 * one with a fixed ceiling. Same law as `icd.ts` and `gauge.ts` — one model,
 * several shapes.
 */
export function auraUMax(series: SeriesInterval[]): number {
	const peak = series.reduce((m, s) => s.points.reduce((n, p) => Math.max(n, p.u), m), 0);
	return Math.max(AURA_UMAX_FLOOR, Math.ceil(peak * 2) / 2);
}

/**
 * 🎛️ The shortest ceiling either gauge chart will draw to.
 *
 * ↻ 2U → 1U (⚓ NATE 2026-08-17), and the reasoning genuinely changed rather
 * than being overruled. The 2U floor existed so a rotation that only ever lands
 * 0.8U auras could not draw them full-height and imply a saturated target — the
 * plot's height had to mean something ABSOLUTE, not "relative to the best
 * moment". Two things retired that argument:
 *
 *   1. **The datum is named now.** Both charts label their whole-unit rules, so
 *      a 0.8U aura reads as "just under the 1U line" rather than as "a tall
 *      bar". The ambiguity the floor was defending against is answered by the
 *      label, and answered better — a label states the scale, a floor only
 *      hints at it by leaving room.
 *   2. **1U IS the common case, measured.** The corpus is 1U ×327, 2U ×58,
 *      4U ×2. A floor set above the size of nearly every application in the
 *      game meant the normal rotation always drew in the bottom 40% of its box
 *      and the empty top half said nothing.
 *
 * ⚠️ It is still a FLOOR, not "fit to content": the ceiling never drops below a
 * whole unit, so charts of different rotations remain comparable at the bottom
 * of the range, and a half-unit aura still reads as half of something.
 *
 * ⛔ Don't take it lower. Below 1U the y axis has no whole-unit rule to name
 * (see `auraUnitLines`) and the plot becomes a shape with no scale at all.
 */
export const AURA_UMAX_FLOOR = 1;
