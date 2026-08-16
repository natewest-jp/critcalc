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

import type { AuraKey } from '$lib/utils/gauge';
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
};

export const AURA_MOD_META: Record<AuraKey, AuraModMeta> = {
	pyro: { label: 'Pyro', icon: 'pyro', color: 'var(--el-pyro-main)' },
	burning: { label: 'Burning', icon: 'pyro', color: 'var(--rx-burning)' },
	// ⚠️ The fuel is the DENDRO being consumed, not an aura the target carries —
	// dashed everywhere it is drawn so it reads as bookkeeping.
	burningFuel: { label: 'Fuel', icon: 'dendro', color: 'var(--rx-burning-fuel)', dash: '5 4' },
	hydro: { label: 'Hydro', icon: 'hydro', color: 'var(--el-hydro-main)' },
	cryo: { label: 'Cryo', icon: 'cryo', color: 'var(--el-cryo-main)' },
	frozen: { label: 'Frozen', icon: 'cryo', color: 'var(--rx-frozen)' },
	electro: { label: 'Electro', icon: 'electro', color: 'var(--el-electro-main)' },
	dendro: { label: 'Dendro', icon: 'dendro', color: 'var(--el-dendro-main)' },
	quicken: { label: 'Quicken', icon: 'dendro', color: 'var(--rx-quicken)' }
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
